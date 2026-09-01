import { unitsForItems, type UnitDescriptions } from '../../data/models/units';
/**
 * Shared search for the reference-table MCP tools.
 *
 * `data/torqueSpecs.json`, `commonClearances.json`, `parts.json` and
 * `weights.json` all share one shape — an object of sections, each with a title
 * and an `items` array — but their item fields differ (`lbft`/`nm`, `thou`/`mm`,
 * `brand`/`part`, `weight`). Matching every string field rather than a named one
 * keeps a single implementation honest across all four, and means adding a
 * column to any dataset does not silently fall out of search.
 *
 * These tools exist because the site's API routes return WHOLE tables: a browser
 * filters client-side, and an LLM should not have to receive several hundred
 * rows to answer one question.
 */

export interface LookupSection {
  title?: string;
  items?: Record<string, unknown>[];
  [key: string]: unknown;
}

export type LookupData = Record<string, LookupSection>;

export interface LookupMatch {
  /** The section key, e.g. 'engineTable'. */
  section: string;
  /** The section's human title, e.g. 'Engine'. */
  sectionTitle: string;
  item: Record<string, unknown>;
}

/** A row the AND query excluded, and the single term that excluded it. */
export interface LookupRelated extends LookupMatch {
  excludedBy: string;
}

/**
 * `related` is computed only when the query returned at most this many rows.
 *
 * One, measured rather than guessed. Against the real torque data, a one-hit
 * query returns near-misses that are entirely the point — "main bearing bolts",
 * "big end bolts" and "con rod bolts" each surface exactly the two 1275 rows the
 * caller could not otherwise see. At two hits the signal is already half noise,
 * and at three it collapses: "flywheel bolts" produces 22 near-misses, almost
 * all of them simply other rows containing the word "bolts".
 *
 * So the rule is deliberately narrow: hint only when the caller has nothing, or
 * has exactly one confident-looking row that might be the wrong one. Those are
 * the two shapes that shipped a hedged answer to a real 1275 question.
 *
 * Re-checked after the near-miss search was rewritten to remove its query-word
 * bias, in case a fairer hint made a looser threshold affordable. It does not:
 * the reason two hits need no hint is that both applicable rows are already IN
 * `matches` there — "cylinder head nuts" and "main bearing 1275" each return
 * their 1275 row directly — so the extra near-misses would be a different
 * fastener, not a missing one.
 */
const RELATED_MAX_MATCHES = 1;

/** Cap on `related`, which is a hint rather than an answer. */
const RELATED_LIMIT = 10;

/**
 * The instruction that ships beside `related`, built once here rather than
 * copy-pasted into each tool.
 *
 * It lived as four near-identical 300-character literals in the four lookup
 * tools, which meant a correction to how `excludedBy` should be read had to land
 * in four places with nothing failing if one was missed — and one such
 * correction was needed immediately.
 *
 * `subject` is the tool's noun ("fastener", "component"); `extra` carries
 * whatever is true only of that dataset.
 */
export function relatedNote(subject: string, extra?: string): string {
  return [
    'Rows in `related` matched every word but one — `excludedBy` names the single word each row is missing, ' +
      `which is the word that kept it out. Check them before answering: a ${subject} is often named differently ` +
      'between variants, so a precise-sounding query can hide the row that actually applies.',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface LookupOptions {
  /** Free-text query matched against every string/number field of an item. */
  query?: string;
  /** Restrict to one section, by key or by title (both case-insensitive). */
  section?: string;
  /** Cap on returned items. */
  limit?: number;
}

export interface LookupResult {
  matches: LookupMatch[];
  /** Total matches before `limit` was applied. */
  totalMatches: number;
  /** True when `limit` cut the list — so a caller knows to narrow rather than assume it saw everything. */
  truncated: boolean;
  /**
   * True when `RELATED_LIMIT` cut the near-miss list.
   *
   * Same reasoning as `truncated`, and it matters more here: near-misses are cut
   * in DATASET order, because there is no principled way to rank one near-miss
   * above another. Removing the previous query-word bias stopped the FIRST word
   * from monopolising the list, but a row late in the file can still be dropped,
   * and on this data a dropped row can be the one that applies to the reader's
   * engine. Silently is the one way that must not happen.
   */
  relatedTruncated: boolean;
  /** Every section in the dataset, so a caller with no match can see what exists. */
  availableSections: { section: string; title: string; itemCount: number }[];
  /**
   * Rows that matched every term BUT ONE, when the full query was narrow.
   *
   * This exists because AND matching can silently hide the row the caller
   * actually wanted. `data/torqueSpecs.json` names the same fastener differently
   * across engine variants — the 848/998 row is "Main Bearing Bolts" while the
   * 970/1071/1275 rows are "set screws" and "nuts" — so the obvious query "main
   * bearing bolts" returns ONE confident-looking row that does not apply to a
   * 1275, and the two that do are invisible. Measured on the real data, the same
   * trap covers con rod big-ends and cylinder head fasteners: the three
   * highest-torque joints in an engine rebuild.
   *
   * A caller that sees only `matches` cannot tell a precise hit from an
   * over-narrow one, so this is the difference between quoting 63 lb-ft at a
   * 1275 owner and quoting the 67 or 57 that actually applies.
   */
  related: LookupRelated[];
}

/** Every searchable scalar of an item, lowercased. */
function itemHaystack(item: Record<string, unknown>): string {
  return Object.values(item)
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .join(' ')
    .toLowerCase();
}

/**
 * All query terms must appear somewhere in the item (AND, not OR). "crankshaft
 * endfloat" should not return every row mentioning a crankshaft.
 */
function matchesQuery(item: Record<string, unknown>, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = itemHaystack(item);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Unit descriptions live in `data/models/units.ts`, beside the data they
 * describe, because the same fact is needed by the MCP tools, the website
 * tables, that page's JSON-LD and the public API routes — and when it was
 * restated in each of them they drifted, disagreeing about the same column by a
 * factor of a thousand.
 */
export type UnitMap = UnitDescriptions;

/** `unitsForItems`, for the `{ section, item }` rows this module returns. */
export function unitsInUse(rows: { item: Record<string, unknown> }[], units: UnitMap): UnitMap | undefined {
  return unitsForItems(
    rows.map((row) => row.item),
    units
  );
}

export function listSections(data: LookupData) {
  return Object.entries(data).map(([section, value]) => ({
    section,
    title: typeof value?.title === 'string' ? value.title : section,
    itemCount: Array.isArray(value?.items) ? value.items.length : 0,
  }));
}

/**
 * Walk the sections a query is allowed to see.
 *
 * Shared by the match pass and the `related` pass below so the two cannot
 * disagree about section filtering — a `related` row from a section the caller
 * excluded would be worse than no hint at all.
 */
function* scannableItems(data: LookupData, wantedSection?: string) {
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value?.items)) continue;

    const title = typeof value.title === 'string' ? value.title : key;
    if (wantedSection && key.toLowerCase() !== wantedSection && title.toLowerCase() !== wantedSection) {
      continue;
    }

    for (const item of value.items) {
      if (item && typeof item === 'object') {
        yield { section: key, sectionTitle: title, item: item as Record<string, unknown> };
      }
    }
  }
}

/**
 * Rows that were exactly one term short of matching.
 *
 * Stated as a property of the ROW rather than as a series of relaxed re-queries:
 * count the terms a row is missing, and keep it when that count is exactly one.
 * The term it is missing IS the term that excluded it, so `excludedBy` is a fact
 * about the row rather than an artifact of which relaxation happened to reach it
 * first.
 *
 * The obvious implementation — drop each term in turn and re-run the match — was
 * wrong in three separate ways, all of which this shape removes rather than
 * patches. It rescanned the whole dataset once per term. It attributed a row
 * reachable by dropping either of two terms to whichever term the loop met
 * first. And filling the cap term-by-term let the FIRST query word consume the
 * entire budget: measured, `alpha beta gamma` returned ten rows all excluded by
 * `alpha` and omitted the one row that dropping `gamma` would have found. On a
 * torque query the last word is the fastener type — `bolts` versus `nuts` — so
 * that is precisely the relaxation that matters, and it was the one being
 * starved.
 */
function findRelated(data: LookupData, wantedSection: string | undefined, terms: string[], matched: LookupMatch[]) {
  const already = new Set<Record<string, unknown>>(matched.map((m) => m.item));
  const related: LookupRelated[] = [];

  for (const candidate of scannableItems(data, wantedSection)) {
    if (already.has(candidate.item)) continue;

    // One haystack per row, not one per row per term.
    const haystack = itemHaystack(candidate.item);
    const missing = terms.filter((term) => !haystack.includes(term));
    if (missing.length !== 1) continue;

    related.push({ ...candidate, excludedBy: missing[0] as string });
    // One past the cap, so the caller can be told the list was cut rather than
    // being handed a short list that looks complete.
    if (related.length > RELATED_LIMIT) break;
  }

  return related;
}

export function lookup(data: LookupData, options: LookupOptions = {}): LookupResult {
  const { query, section, limit = 50 } = options;
  // Deduped, because `findRelated` counts the terms a row is missing and a word
  // repeated in the query would be counted twice, disqualifying every row that
  // lacks it. Deduping is free for matching itself: `includes` is idempotent.
  const terms = [
    ...new Set(
      (query ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0)
    ),
  ];

  const wantedSection = section?.trim().toLowerCase();

  const matches: LookupMatch[] = [];
  for (const candidate of scannableItems(data, wantedSection)) {
    if (matchesQuery(candidate.item, terms)) matches.push(candidate);
  }

  // A limit of 0 or less means "count only" — never silently return everything.
  const capped = limit > 0 ? matches.slice(0, limit) : [];

  // Only when the query could plausibly have been too narrow: two or more terms,
  // and at most one hit, so the caller might be missing something.
  //
  // `limit > 0` because a non-positive limit means "count only", and returning
  // near-miss ROWS to a caller that asked for no rows would break that contract
  // through the side door.
  const narrow = terms.length >= 2 && matches.length <= RELATED_MAX_MATCHES;
  const found = narrow && limit > 0 ? findRelated(data, wantedSection, terms, matches) : [];
  const related = found.slice(0, RELATED_LIMIT);

  return {
    matches: capped,
    totalMatches: matches.length,
    truncated: matches.length > capped.length,
    availableSections: listSections(data),
    related,
    relatedTruncated: found.length > related.length,
  };
}
