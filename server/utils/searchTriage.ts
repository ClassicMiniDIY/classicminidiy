/**
 * TypeSafe reads on the search surface: what kind of miss a zero-result query
 * was, and (in shadow) what kind of query the regex intent classifier is
 * looking at.
 *
 * Design: the private repo's TypeSafe phase 4 doc. Two rules from the
 * programme shape this file:
 *   - The keystroke path stays regex. Nothing here runs per keystroke, and the
 *     intent shadow never touches the response: it is logged beside the regex
 *     kind so the disagreement rate can be read before anything reorders.
 *   - A miss is labelled, never acted on. `promote_search_miss()` stays a
 *     human's click; the label sorts the list they click through.
 *
 * `TYPESAFE_SEARCH_MODE` (`NUXT_TYPESAFE_SEARCH_MODE`): unset means the miss
 * triage runs when the key is set and the intent shadow does not; `shadow`
 * turns the intent shadow on. There is no mode that changes results.
 */
import type { H3Event } from 'h3';
import { askTypeSafe, choice, typesafeConfigured } from './typesafe';
import { serverRuntimeConfig } from './runtimeConfig';
import { getServiceClient } from './supabase';
import { captureServerEvent } from './chatUsage';
import { SURFACES, type QueryKind, type Surface } from '~~/shared/utils/searchIntent';
import { ToolCatalog, ARCHIVE_SEARCH_SECTIONS } from '~~/data/models/toolbox-catalog';

export const MISS_KINDS = ['typo', 'synonym', 'missing_content', 'question', 'junk'] as const;
export type MissKind = (typeof MISS_KINDS)[number];

/** Longest the intent shadow waits; it runs beside the search and is dropped after this. */
export const INTENT_SHADOW_CEILING_MS = 250;
const TRIAGE_CEILING_MS = 2500;
const MAX_TYPO_CANDIDATES = 5;

/** What each surface covers, in the words the palette uses. Sent as state so the model picks from what exists. */
export const SURFACE_COVERS: Record<Surface, string> = {
  tools:
    'calculators and decoders: compression ratio, gearbox ratios, carb needles, chassis and engine number decoders, torque and clearance lookups',
  wheels: 'the wheel registry: wheel names, sizes, widths, offsets and manufacturers',
  archive: 'reference documents: manuals, wiring diagrams, paint colours, engine identification, weights, the registry',
  models: '3D printable models and printed parts',
  exchange: 'the marketplace: cars and parts for sale, wanted posts',
  parts: 'factory part numbers, supersessions and which retailers stock them',
  suppliers: 'parts suppliers and specialists by country',
  videos: "Cole's YouTube videos: how-to repairs, removals, rebuilds",
};

export function searchIntentShadowEnabled(event: H3Event): boolean {
  const raw = (serverRuntimeConfig(event).TYPESAFE_SEARCH_MODE as string) || '';
  return raw.trim().toLowerCase() === 'shadow' && typesafeConfigured(event);
}

/** Character bigram similarity, enough to shortlist what a typo was probably aiming at. */
function bigrams(s: string): Set<string> {
  const t = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const out = new Set<string>();
  for (const word of t.split(' ')) for (let i = 0; i < word.length - 1; i++) out.add(word.slice(i, i + 2));
  return out;
}
function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return (2 * hit) / (a.size + b.size);
}

/** The names a misspelled query might have meant, from the tool and archive catalogues. */
export function typoCandidates(query: string, limit = MAX_TYPO_CANDIDATES): string[] {
  const q = bigrams(query);
  const names = [...ToolCatalog.map((t) => t.name), ...ARCHIVE_SEARCH_SECTIONS.map((s) => s.name)];
  return names
    .map((name) => ({ name, score: dice(q, bigrams(name)) }))
    .filter((c) => c.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => c.name);
}

export function buildTriageRequest(query: string) {
  const candidates = typoCandidates(query);
  const corrections: Record<string, string | null> = {
    none: 'None of these; the query is not a misspelling of any of them.',
  };
  for (const c of candidates) corrections[c] = null;
  return {
    state: {
      query,
      surfaces: SURFACES.map((s) => ({ name: s, covers: SURFACE_COVERS[s] })),
      candidates,
      context:
        'A visitor typed `query` into the site search of a classic Mini (1959-2000) reference site and got no results. `surfaces` is what the search covers.',
    },
    questions: {
      kind: choice('What is `query`, as a search assistant for this site would judge it? Pick the single best fit.', {
        typo: 'A misspelling or a slip of a term the site does cover: the visitor meant something in `surfaces` and mistyped it.',
        synonym:
          'A real term for something the site covers, but under a different word than the site uses: the content exists, the search did not connect the word.',
        missing_content:
          'A clear request for Mini content the site plausibly does not have: a part, a document, a topic, a car. A real gap.',
        question:
          'A question in sentence form that wants an explanation or a diagnosis, not a lookup: it belongs with the assistant, not the search box.',
        junk: 'Not a search: a fragment, a test string, a URL, another car entirely, or nonsense.',
      }),
      corrected: choice(
        'If `query` is a misspelling, which entry in `candidates` did the visitor mean? Pick `none` unless one clearly fits.',
        corrections
      ),
    },
    candidates,
  };
}

/**
 * Label one recorded miss. Fire-and-forget from the miss route: it never
 * delays the 204, never throws, and writes only the triage columns.
 */
export async function triageSearchMiss(event: H3Event, query: string): Promise<void> {
  if (!typesafeConfigured(event)) return;
  const { state, questions, candidates } = buildTriageRequest(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRIAGE_CEILING_MS);
  try {
    const answer = await askTypeSafe(event, state, questions, {
      caller: 'search-miss-triage',
      signal: controller.signal,
      retry: { maxRetries: 0 },
    });
    const kindAnswer = answer.answers.kind;
    const kind = (MISS_KINDS as readonly string[]).includes(kindAnswer.choice)
      ? (kindAnswer.choice as MissKind)
      : 'junk';
    const p = Math.round(kindAnswer.confidence * 1000) / 1000;
    const correctedChoice = answer.answers.corrected.choice;
    const corrected = kind === 'typo' && candidates.includes(correctedChoice) ? correctedChoice : null;

    const { error } = await getServiceClient().rpc('record_search_miss_triage', {
      p_query: query,
      p_kind: kind,
      p_p: p,
      p_corrected: corrected ?? undefined,
      p_version: answer.model,
    });
    if (error) console.warn('[search] record_search_miss_triage failed:', error.message);
    console.log(
      JSON.stringify({ event: 'search_miss_triaged', kind, p, corrected: corrected !== null, model: answer.model })
    );
  } catch (e) {
    if (!controller.signal.aborted) {
      console.warn('[search] miss triage failed:', e instanceof Error ? e.message : String(e));
    }
  } finally {
    clearTimeout(timer);
  }
}

const QUERY_KINDS: QueryKind[] = ['part-number', 'colour-code', 'chassis', 'engine', 'question', 'lookup'];

export function buildIntentRequest(query: string) {
  const leads: Record<string, string | null> = {};
  for (const s of SURFACES) leads[s] = SURFACE_COVERS[s];
  return {
    state: {
      query,
      surfaces: SURFACES.map((s) => ({ name: s, covers: SURFACE_COVERS[s] })),
      context: 'A visitor is typing `query` into the site search of a classic Mini (1959-2000) reference site.',
    },
    questions: {
      kind: choice('What kind of search is `query`? Pick the single best fit.', {
        'part-number': 'A factory or retailer part number, letters and digits, e.g. 12G940 or GSV1009.',
        'colour-code': 'A paint colour name or code, e.g. BLVC 122, Almond Green, GN37.',
        chassis: 'A chassis or VIN number, a prefix followed by digits.',
        engine: 'An engine number or engine code prefix, e.g. 12H, 99H, 8A.',
        question: 'A question that wants an explanation, a procedure or a diagnosis, in sentence form.',
        lookup: 'A short lookup of a thing by name: a tool, a wheel, a document, a topic, a supplier, a video.',
      }),
      lead: choice('Which surface in `surfaces` should lead the results for `query`?', leads),
    },
  };
}

/**
 * The intent shadow: beside the search, with a ceiling, logged only. Returns
 * nothing the caller could use, on purpose.
 */
export function shadowSearchIntent(event: H3Event, query: string, regex: { kind: QueryKind; lead: Surface }): void {
  if (!searchIntentShadowEnabled(event)) return;
  if (regex.kind !== 'lookup' && regex.kind !== 'question') return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INTENT_SHADOW_CEILING_MS);
  const { state, questions } = buildIntentRequest(query);
  const run = askTypeSafe(event, state, questions, {
    caller: 'search-intent-shadow',
    signal: controller.signal,
    retry: { maxRetries: 0 },
  })
    .then((answer) => {
      const modelKind = answer.answers.kind.choice;
      const modelLead = answer.answers.lead.choice;
      captureServerEvent(event, 'search_intent_shadow', 'search:intent', {
        $process_person_profile: false,
        outcome: 'answered',
        regex_kind: regex.kind,
        model_kind: QUERY_KINDS.includes(modelKind as QueryKind) ? modelKind : 'other',
        model_kind_p: Math.round(answer.answers.kind.confidence * 1000) / 1000,
        regex_lead: regex.lead,
        model_lead: (SURFACES as readonly string[]).includes(modelLead) ? modelLead : 'other',
        model_lead_p: Math.round(answer.answers.lead.confidence * 1000) / 1000,
        agree_kind: modelKind === regex.kind,
        agree_lead: modelLead === regex.lead,
        duration_ms: answer.durationMs,
      });
    })
    .catch(() => {
      // Past the ceiling or failed. The timeout share is half of what decides
      // whether a reorder is worth the wait, so it is counted, not dropped.
      captureServerEvent(event, 'search_intent_shadow', 'search:intent', {
        $process_person_profile: false,
        outcome: controller.signal.aborted ? 'timeout' : 'error',
        regex_kind: regex.kind,
        regex_lead: regex.lead,
      });
    })
    .finally(() => clearTimeout(timer));
  (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(run);
}
