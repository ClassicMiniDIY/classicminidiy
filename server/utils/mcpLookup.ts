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

export function lookup(data: LookupData, options: LookupOptions = {}): LookupResult {
  const { query, section, limit = 50 } = options;
  const terms = (query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const wantedSection = section?.trim().toLowerCase();

  const matches: LookupMatch[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value?.items)) continue;

    const title = typeof value.title === 'string' ? value.title : key;
    if (wantedSection && key.toLowerCase() !== wantedSection && title.toLowerCase() !== wantedSection) {
      continue;
    }

    for (const item of value.items) {
      if (item && typeof item === 'object' && matchesQuery(item as Record<string, unknown>, terms)) {
        matches.push({ section: key, sectionTitle: title, item: item as Record<string, unknown> });
      }
    }
  }

  // A limit of 0 or less means "count only" — never silently return everything.
  const capped = limit > 0 ? matches.slice(0, limit) : [];

  return {
    matches: capped,
    totalMatches: matches.length,
    truncated: matches.length > capped.length,
    availableSections: listSections(data),
  };
}
