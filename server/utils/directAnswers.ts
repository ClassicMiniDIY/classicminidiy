import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { DirectAnswer, SearchIntent } from '../../shared/utils/searchIntent';
import { REFERENCE_NOUNS, type ReferenceNoun } from '../../data/models/referenceNouns';
import { chassisRanges } from '../../data/models/decoders';
import engineCodes from '../../data/engineCodes.json';
import { getReferenceDataset } from './referenceData';
import { validateChassisNumber } from './chassisDecode';
import { findVisiblePart, type VisiblePartSources } from './partsSearch';

/**
 * Direct answers for the search palette (docs/plans/2026-09-14-unified-search.md §4).
 *
 * A direct answer renders the thing itself — the part, the paint code, the
 * decoded chassis number, the torque figure — instead of a link to the page
 * that holds it. Each resolver here is the lookup the matching MCP tool runs,
 * on the same data, so the palette and the assistant cannot disagree.
 *
 * The intent from `analyseQuery` decides which resolvers run: a query only
 * ever has one shape, so at most one structured resolver fires, plus the
 * reference-noun match for a short lookup. Every resolver returns nothing
 * rather than a doubtful card. A wrong answer in the palette is worse than
 * no answer, because it is rendered as a fact.
 */

type ServiceClient = SupabaseClient<Database>;

/** The palette shows at most this many; the cap is applied here, not in the UI. */
export const MAX_DIRECT_ANSWERS = 2;

/** More words than this is a question, and questions are for the bot. */
const MAX_NOUN_QUERY_WORDS = 4;

const PARTS_URL = '/archive/parts';
const COLOURS_URL = '/archive/colors';
const CHASSIS_DECODER_URL = '/technical/chassis-decoder';
const ENGINE_DECODER_URL = '/technical/engine-decoder';
const TORQUE_URL = '/technical/torque';
const CLEARANCE_URL = '/technical/clearance';

function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-./]/g, '');
}

/**
 * The part that IS the number typed: an equality inside the shared kill
 * switch. The source list is the one omnisearch already loaded for its own
 * parts surface, so a part-number query costs one extra read, not three.
 */
async function resolvePart(
  db: ServiceClient,
  query: string,
  sources: VisiblePartSources | null | undefined
): Promise<DirectAnswer | null> {
  const part = await findVisiblePart(db, query, sources);
  if (!part) return null;
  return {
    kind: 'part',
    partNumber: part.partNumber,
    description: part.description,
    system: part.system,
    sourceName: part.sourceName,
    url: `${PARTS_URL}?q=${encodeURIComponent(part.partNumber)}`,
  };
}

/**
 * A factory paint code, approved rows only — the same gate `color-lookup`
 * applies. Codes are stored with or without the space (`BLVC 62`, `GN37`),
 * so both spellings are tried rather than one normalised column that does
 * not exist.
 */
async function resolveColour(db: ServiceClient, query: string): Promise<DirectAnswer | null> {
  // The intent regex already limited this to letters and digits; the strip is
  // what keeps that true if the regex ever loosens, because `compact` lands
  // inside a PostgREST `or()` where a comma or a dot changes the filter's shape.
  const compact = normaliseCode(query).replace(/[^A-Z0-9]/g, '');
  if (compact.length < 3) return null;
  const spaced = compact.replace(/^([A-Z]+)(\d+)$/, '$1 $2');
  const { data, error } = await db
    .from('colors')
    .select('id, name, code, short_code, hex_value, year_start, year_end')
    .eq('status', 'approved')
    .or(`code.ilike.${compact},code.ilike.${spaced},short_code.ilike.${compact}`)
    .order('name')
    .limit(1);
  if (error) {
    console.error('[search] colour answer failed:', error.message);
    return null;
  }
  const row = data?.[0];
  if (!row) return null;
  const years =
    row.year_start && row.year_end ? `${row.year_start}–${row.year_end}` : row.year_start ? `${row.year_start}+` : null;
  return {
    kind: 'colour',
    name: row.name,
    code: row.code,
    shortCode: row.short_code,
    hex: row.hex_value,
    years,
    url: `${COLOURS_URL}/${row.id}`,
  };
}

/**
 * A chassis number, decoded against every era; a card only when exactly ONE
 * era accepts it.
 *
 * The decoder page makes the visitor pick the era first; the palette cannot
 * ask. Several eras share an option table — 1969-1974, 1974-1980 and 1980
 * all accept `X-A2S1N-777-A` — and they decode the same letters to DIFFERENT
 * meanings (`N` is "Mini 1000" in one era and "Standard trim" in the next).
 * A merged card would be a guess dressed as a fact, so those numbers get no
 * card and the visitor gets the tool, which asks the era. The 1959-1969 and
 * 1980-on forms are distinct and do render. Recorded in
 * `.claude/rules/contributions.md`.
 */
function resolveChassis(query: string): DirectAnswer | null {
  if (!/^[A-Za-z0-9\-\s/]+$/.test(query)) return null;
  const valid = chassisRanges
    .map((range) => validateChassisNumber(query, range))
    .filter((result) => result.isValid && result.decodedPositions.some((position) => position.matched));
  if (valid.length !== 1) return null;
  const [decoded] = valid;
  return {
    kind: 'chassis',
    chassisNumber: decoded!.chassisNumber,
    yearRange: decoded!.yearRange,
    fields: decoded!.decodedPositions
      .filter((position) => position.matched && position.value)
      .map((position) => ({ label: position.value, value: position.name.trim() })),
    url: CHASSIS_DECODER_URL,
  };
}

/** An engine prefix code, exact only — the intent already established that. */
function resolveEngine(query: string): DirectAnswer | null {
  const compact = normaliseCode(query);
  const entry = (
    engineCodes as { code: string; size: string; variant: string; gearbox: string; description: string }[]
  ).find((candidate) => normaliseCode(candidate.code) === compact);
  if (!entry) return null;
  return {
    kind: 'engine',
    code: entry.code,
    capacityCc: entry.size,
    variant: entry.variant || null,
    gearbox: entry.gearbox || null,
    description: entry.description,
    url: ENGINE_DECODER_URL,
  };
}

interface ReferenceRow {
  name: string;
  notes?: string;
  lbft?: string;
  nm?: string;
  thou?: string;
  mm?: string;
}
type ReferenceTable = Record<string, { title?: string; items?: ReferenceRow[] }>;
export type ReferenceTables = Record<ReferenceNoun['table'], ReferenceTable>;

/** The two tables reference nouns point into, from the reference-data loader. */
export async function loadReferenceTables(): Promise<ReferenceTables> {
  const [torque, clearance] = await Promise.all([
    getReferenceDataset<ReferenceTable>('torque_specs'),
    getReferenceDataset<ReferenceTable>('common_clearances'),
  ]);
  return { torque: torque.value, clearance: clearance.value };
}

/**
 * Whole-word containment: every word of the term appears in the query as a
 * word of its own, in any order. `flywheel` matches "flywheel torque" and
 * "torque flywheel"; it does not match "flywheels" — a plural is a different
 * word, and the noun list carries the plurals it wants.
 */
function termMatches(term: string, queryWords: Set<string>): boolean {
  return term.split(/\s+/).every((word) => queryWords.has(word));
}

/**
 * Words that say which TABLE the person wants. "spark plug gap" contains the
 * torque noun "spark plug", but "gap" says clearance, and there is no plug
 * gap row — so the right answer is no card, not the plug torque. A hint for
 * the other table vetoes the match; a hint for the same table is neutral.
 */
const TABLE_HINTS: Record<ReferenceNoun['table'], string[]> = {
  torque: ['torque', 'nm', 'lbft', 'lb', 'ft', 'ftlb', 'tighten', 'tightening'],
  clearance: ['gap', 'clearance', 'clearances', 'endfloat', 'float', 'lash', 'tolerance'],
};

/**
 * A torque or clearance figure for a short lookup.
 *
 * The longest matching term wins, so "flywheel housing" beats "flywheel"
 * when both appear. The row is looked up by exact name; the reference-live
 * check in the deploy job asserts every noun resolves against the published
 * data, so a miss here is a publish that has not been deployed against yet.
 */
export function resolveReferenceNoun(query: string, tables: ReferenceTables): DirectAnswer | null {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9/-]+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > MAX_NOUN_QUERY_WORDS) return null;
  const queryWords = new Set(words);

  let best: { noun: ReferenceNoun; term: string } | null = null;
  for (const noun of REFERENCE_NOUNS) {
    for (const term of noun.terms) {
      if (!termMatches(term, queryWords)) continue;
      if (!best || term.length > best.term.length) best = { noun, term };
    }
  }
  if (!best) return null;

  const otherTable: ReferenceNoun['table'] = best.noun.table === 'torque' ? 'clearance' : 'torque';
  if (TABLE_HINTS[otherTable].some((hint) => queryWords.has(hint))) return null;

  const { noun } = best;
  const section = tables[noun.table][noun.section];
  const row = section?.items?.find((item) => item.name === noun.item);
  if (!row) {
    console.error(`[search] reference noun "${noun.item}" has no row in ${noun.table}/${noun.section}`);
    return null;
  }
  const sectionTitle = section?.title ?? noun.section;

  if (noun.table === 'torque') {
    if (!row.lbft || !row.nm) return null;
    return {
      kind: 'torque',
      item: row.name,
      section: sectionTitle,
      lbft: row.lbft,
      nm: row.nm,
      notes: row.notes || null,
      url: TORQUE_URL,
    };
  }
  if (!row.thou || !row.mm) return null;
  return {
    kind: 'clearance',
    item: row.name,
    section: sectionTitle,
    thou: row.thou,
    mm: row.mm,
    notes: row.notes || null,
    url: CLEARANCE_URL,
  };
}

export interface DirectAnswerContext {
  /**
   * The visible part sources, when the caller has already loaded them.
   * `undefined` loads them; `null` means the load failed and no part answer
   * may render.
   */
  partSources?: VisiblePartSources | null;
}

export async function resolveDirectAnswers(
  db: ServiceClient,
  query: string,
  intent: SearchIntent,
  { partSources }: DirectAnswerContext = {}
): Promise<DirectAnswer[]> {
  const answers: (DirectAnswer | null)[] = [];
  try {
    switch (intent.kind) {
      case 'part-number':
        answers.push(await resolvePart(db, query, partSources));
        break;
      case 'colour-code':
        answers.push(await resolveColour(db, query));
        break;
      case 'chassis':
        answers.push(resolveChassis(query));
        break;
      case 'engine':
        answers.push(resolveEngine(query));
        break;
      case 'lookup':
      case 'question':
        answers.push(resolveReferenceNoun(query, await loadReferenceTables()));
        break;
    }
  } catch (error: any) {
    // An answer is a bonus on top of the results, never the reason search fails.
    console.error('[search] direct answer failed:', error?.message ?? error);
  }
  return answers.filter((answer): answer is DirectAnswer => answer !== null).slice(0, MAX_DIRECT_ANSWERS);
}
