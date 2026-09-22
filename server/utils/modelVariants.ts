/**
 * Read side of the Model Variants archive.
 *
 * Today the archive is the bundled seed, `data/modelVariants.json` (141 rows
 * preserved from austinminiwebsearch.com; see the design doc). Phase 1 moves
 * the rows to the `model_variants` table and this module becomes the one
 * place that changes: the API routes, the sitemap source and the MCP tool all
 * read through it and never touch the JSON directly.
 *
 * Search is the in-process rule from `.claude/rules/contributions.md`: every
 * query word must prefix-match a word of the row, never a substring, so
 * "cooper s" finds "Cooper S" and "Cooper Sport" but "per" finds nothing.
 */
import rows from '../../data/modelVariants.json';
import {
  BODY_LABELS,
  FAMILY_LABELS,
  MARK_RANGES,
  MARQUE_LABELS,
  MARKET_LABELS,
  countSourcedSpecs,
  type ModelVariant,
  type ModelVariantCard,
  type VariantBody,
  type VariantFamily,
  type VariantMarket,
  type VariantMarque,
} from '../../data/models/variants';

const ALL: readonly ModelVariant[] = rows as unknown as ModelVariant[];
const BY_SLUG = new Map(ALL.map((v) => [v.slug, v]));

export interface ModelVariantFilters {
  query?: string;
  marque?: VariantMarque | string;
  family?: VariantFamily | string;
  body?: VariantBody | string;
  market?: VariantMarket | string;
  mark?: number | null;
  /** A year the variant was in production. */
  year?: number;
  engine_cc?: number;
  limitedOnly?: boolean;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The words a query may prefix-match. Built once per row. */
const HAYSTACK = new Map<string, string[]>(
  ALL.map((v) => {
    const parts = [
      v.name,
      MARQUE_LABELS[v.marque],
      FAMILY_LABELS[v.family],
      BODY_LABELS[v.body_style],
      MARKET_LABELS[v.market],
      v.mark ? `mk${v.mark} mk${MARK_RANGES[v.mark]?.roman ?? ''} mark${v.mark}` : '',
      v.engine_cc ? `${v.engine_cc} ${v.engine_cc}cc` : '',
      v.year_start ? String(v.year_start) : '',
      v.year_end ? String(v.year_end) : '',
      v.is_limited_edition ? 'limited edition le' : '',
      v.carburettor ?? '',
    ];
    return [v.slug, words(parts.join(' '))];
  })
);

export function matchesEveryWord(haystack: readonly string[], query: string): boolean {
  const needles = words(query);
  if (needles.length === 0) return true;
  return needles.every((needle) => haystack.some((w) => w.startsWith(needle)));
}

function inProduction(v: ModelVariant, year: number): boolean {
  if (!v.year_start) return false;
  const end = v.year_end ?? v.year_start;
  return v.year_start <= year && year <= end;
}

export function toCard(v: ModelVariant): ModelVariantCard {
  return {
    slug: v.slug,
    name: v.name,
    marque: v.marque,
    family: v.family,
    body_style: v.body_style,
    mark: v.mark,
    market: v.market,
    year_start: v.year_start,
    year_end: v.year_end,
    is_limited_edition: v.is_limited_edition,
    engine_cc: v.engine_cc,
    photo_count: v.images.filter((i) => Boolean(i.url)).length,
    spec_count: countSourcedSpecs(v),
  };
}

/** Sort: UK mark order, then first year, then name. Null marks sort last. */
export function compareVariants(a: ModelVariant, b: ModelVariant): number {
  const am = a.mark ?? 99;
  const bm = b.mark ?? 99;
  if (am !== bm) return am - bm;
  const ay = a.year_start ?? 9999;
  const by = b.year_start ?? 9999;
  if (ay !== by) return ay - by;
  return a.name.localeCompare(b.name);
}

export function listModelVariants(filters: ModelVariantFilters = {}): ModelVariant[] {
  const q = filters.query?.trim();
  return ALL.filter((v) => {
    if (filters.marque && v.marque !== filters.marque) return false;
    if (filters.family && v.family !== filters.family) return false;
    if (filters.body && v.body_style !== filters.body) return false;
    if (filters.market && v.market !== filters.market) return false;
    if (filters.mark !== undefined && filters.mark !== null && v.mark !== filters.mark) return false;
    if (filters.year && !inProduction(v, filters.year)) return false;
    if (filters.engine_cc && v.engine_cc !== filters.engine_cc) return false;
    if (filters.limitedOnly && !v.is_limited_edition) return false;
    if (q && !matchesEveryWord(HAYSTACK.get(v.slug) ?? [], q)) return false;
    return true;
  }).sort(compareVariants);
}

export function getModelVariant(slug: string): ModelVariant | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Siblings worth linking from a detail page: same family first, then same
 * mark, never the row itself. Capped so the block stays a block.
 */
export function relatedModelVariants(variant: ModelVariant, limit = 6): ModelVariantCard[] {
  const sameFamily = ALL.filter((v) => v.slug !== variant.slug && v.family === variant.family);
  const sameMark = ALL.filter(
    (v) => v.slug !== variant.slug && v.family !== variant.family && v.mark !== null && v.mark === variant.mark
  );
  return [...sameFamily.sort(compareVariants), ...sameMark.sort(compareVariants)].slice(0, limit).map(toCard);
}

/** Distinct values present in the archive, for the index page's filter chips. */
export function modelVariantFacets() {
  const count = <K extends string | number>(pick: (v: ModelVariant) => K | null) => {
    const m = new Map<K, number>();
    for (const v of ALL) {
      const k = pick(v);
      if (k === null || k === undefined) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([value, n]) => ({ value, count: n }));
  };
  return {
    marques: count((v) => v.marque),
    families: count((v) => v.family),
    bodies: count((v) => v.body_style),
    markets: count((v) => v.market),
    marks: count((v) => v.mark).sort((a, b) => a.value - b.value),
    engines: count((v) => v.engine_cc).sort((a, b) => a.value - b.value),
    total: ALL.length,
  };
}

export function allModelVariants(): readonly ModelVariant[] {
  return ALL;
}
