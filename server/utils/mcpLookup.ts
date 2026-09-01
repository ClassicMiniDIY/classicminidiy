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
 */
const RELATED_MAX_MATCHES = 1;

/** Cap on `related`, which is a hint rather than an answer. */
const RELATED_LIMIT = 10;

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
 * Rows excluded by exactly one query term.
 *
 * Each term is dropped in turn and the remainder re-matched; anything new is
 * reported with the term that had been keeping it out. Dropping only ONE term is
 * deliberate — relaxing further returns rows that have little to do with the
 * question, and a hint nobody can trust is a hint nobody reads.
 */
function findRelated(data: LookupData, wantedSection: string | undefined, terms: string[], matched: LookupMatch[]) {
  const seen = new Set<Record<string, unknown>>(matched.map((m) => m.item));
  const related: LookupRelated[] = [];

  // Deduped: a repeated term would rescan the whole dataset to produce the
  // identical relaxed set, since matching is a substring test.
  for (const term of new Set(terms)) {
    const relaxed = terms.filter((t) => t !== term);
    if (relaxed.length === 0) continue;

    for (const candidate of scannableItems(data, wantedSection)) {
      if (related.length >= RELATED_LIMIT) return related;
      if (seen.has(candidate.item)) continue;
      if (!matchesQuery(candidate.item, relaxed)) continue;

      seen.add(candidate.item);
      related.push({ ...candidate, excludedBy: term });
    }
  }

  return related;
}

export function lookup(data: LookupData, options: LookupOptions = {}): LookupResult {
  const { query, section, limit = 50 } = options;
  const terms = (query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const wantedSection = section?.trim().toLowerCase();

  const matches: LookupMatch[] = [];
  for (const candidate of scannableItems(data, wantedSection)) {
    if (matchesQuery(candidate.item, terms)) matches.push(candidate);
  }

  // A limit of 0 or less means "count only" — never silently return everything.
  const capped = limit > 0 ? matches.slice(0, limit) : [];

  // Only when the query could plausibly have been too narrow: two or more terms
  // to relax, and at most one hit, so the caller might be missing something.
  const related =
    terms.length >= 2 && matches.length <= RELATED_MAX_MATCHES ? findRelated(data, wantedSection, terms, matches) : [];

  return {
    matches: capped,
    totalMatches: matches.length,
    truncated: matches.length > capped.length,
    availableSections: listSections(data),
    related,
  };
}
