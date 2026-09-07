/**
 * The supplier directory: what it is, and what it deliberately is not.
 *
 * The part-number archive crawls three British shops, so a reader in Melbourne
 * or Osaka searching a part number gets three British links and a customs bill.
 * That is the gap this closes, and it closes it with a CURATED LIST rather than
 * with more crawling.
 *
 * The distinction is the whole design (see
 * `classicminidiy-supabase/docs/plans/2026-09-07-supplier-expansion.md`). Two
 * different questions were being answered by one mechanism:
 *
 *   "Where can I buy Mini parts?"  — a directory. Name, country, speciality,
 *   link. No crawl budget, no parser, no per-source legality review, and for a
 *   reader outside the UK it is most of the value.
 *
 *   "Who has THIS part number?"    — a crawl, and it only needs enough sources
 *   to be useful. The fourteenth UK generalist adds a buy link to parts that
 *   already have three, at the same per-source cost as the first.
 *
 * So this file is a list of shops, curated and dated. It makes NO claim about
 * stock, price, availability or fitment, and it is not evidence that any of
 * these shops has a given part. Nothing here is crawled: a supplier appearing
 * in the directory does not become a `part_sources` row, and a directory entry
 * is not an admission decision.
 *
 * EVERY ENTRY WAS FETCHED AND READ before it was added, on the date in
 * `data/suppliers.json`'s accompanying provenance. That is not ceremony — the
 * verification pass rejected 25 candidates, and two of them were shops that a
 * plausible-looking domain would have got wrong: `newtoncommercial.co.uk` is a
 * parked GoDaddy page (the real Newton Commercial is `newtoncomm.co.uk`), and
 * Rimmer Bros turns out to sell Triumph, MG, Rover, Land Rover, Jaguar, MX5,
 * Morris Minor and Austin Healey, and no Mini at all. A directory of dead and
 * wrong links is worse than no directory.
 */

/** Where a supplier sits in the list. Regional first, speciality within the UK. */
export type SupplierGroup = 'uk-generalist' | 'uk-performance' | 'uk-trim-body' | 'us' | 'anz' | 'europe' | 'japan';

/**
 * The facets a reader would actually filter on.
 *
 * A CONTROLLED VOCABULARY, not the words each shop uses about itself. The raw
 * verification pass produced ninety distinct tags across sixty-eight shops —
 * `body-shells` beside `bodyshells`, and a `*-stock` tag per country restating
 * what `country` already says. Ninety facets is a list, not a filter.
 */
export type SupplierTag =
  | 'full-range'
  | 'heritage'
  | 'engine'
  | 'transmission'
  | 'suspension-brakes'
  | 'electrical'
  | 'body-panels'
  | 'trim-interior'
  | 'wheels-tyres'
  | 'performance'
  | 'restoration'
  | 'used-parts'
  | 'services'
  | 'tools'
  | 'archive';

export interface Supplier {
  /** Stable kebab-case key. Used for the anchor and as the list key. */
  id: string;
  name: string;
  /** The trading name in its own script, where the site gives one. */
  nameLocal?: string;
  /** The exact URL that was fetched and read. */
  url: string;
  /** ISO 3166-1 alpha-2. The seller of record, which is not always where it ships from. */
  country: string;
  group: SupplierGroup;
  /** One neutral sentence. Description, never the shop's own marketing copy. */
  speciality: string;
  tags: SupplierTag[];
  /**
   * Whether the site itself says it ships worldwide.
   *
   * NULL IS NOT FALSE, and the difference matters to the reader this page exists
   * for. Null means the site did not say, which is the commonest case; false
   * would mean it said it does not. Rendering null as "no" would tell somebody
   * in Japan that a shop which ships everywhere does not.
   */
  shipsInternationally: boolean | null;
  /** Set on Classic Mini DIY's own entry. Marked plainly rather than hidden. */
  ours?: boolean;
}

/** Display order. Regional coverage first, because that is what the list is for. */
export const SUPPLIER_GROUP_ORDER: SupplierGroup[] = [
  'uk-generalist',
  'uk-performance',
  'uk-trim-body',
  'us',
  'anz',
  'europe',
  'japan',
];

/**
 * Filter chips, in the order they are offered.
 *
 * Not every tag in `SupplierTag`: `tools` and `archive` describe exactly one
 * entry — this site's own — so offering them as filters would be a control that
 * narrows sixty-eight shops down to us.
 */
export const SUPPLIER_FILTER_TAGS: SupplierTag[] = [
  'full-range',
  'heritage',
  'engine',
  'transmission',
  'suspension-brakes',
  'electrical',
  'body-panels',
  'trim-interior',
  'wheels-tyres',
  'performance',
  'restoration',
  'used-parts',
  'services',
];

/** Flag emoji from an ISO alpha-2 code, for the country badge. */
export function flagFor(country: string): string {
  if (!/^[A-Za-z]{2}$/.test(country)) return '';
  return String.fromCodePoint(
    ...country
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}
