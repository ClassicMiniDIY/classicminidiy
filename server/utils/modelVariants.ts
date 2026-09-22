/**
 * Read side of the Model Variants archive.
 *
 * The rows live in `model_variants` (+ `model_variant_colors`,
 * `model_variant_photos`) in classicminidiy-supabase, seeded from the Wayback
 * copy of austinminiwebsearch.com and corrected through the review queue.
 * The API routes, the sitemap source and the `model-variants` MCP tool all
 * read through `loadModelVariants()`; nothing else queries those tables for
 * public output.
 *
 * The whole archive is a few hundred rows, so it is loaded once per isolate
 * and filtered in memory, with a short TTL. The approve route calls
 * `invalidateModelVariants()` so a reviewer sees their own approval at once on
 * the isolate that served it; other isolates catch up within the TTL.
 *
 * Service role, so RLS does not apply: `status = 'approved'` is re-applied here
 * on the variant AND on its embedded photos. Never widen either filter.
 *
 * Search is the in-process rule from `.claude/rules/contributions.md`: every
 * query word must prefix-match a word of the row (`variantSearchWords`), never
 * a substring — the index page uses the same builder.
 */
import { getServiceClient } from './supabase';
import {
  countSourcedSpecs,
  matchesEveryWord,
  variantSearchWords,
  type ModelVariant,
  type ModelVariantCard,
  type VariantBody,
  type VariantFamily,
  type VariantMarket,
  type VariantMarque,
  type VariantPhoto,
} from '../../data/models/variants';

const TTL_MS = 5 * 60 * 1000;

const VARIANT_COLUMNS = [
  'id',
  'slug',
  'name',
  'source_slug',
  'marque',
  'family',
  'body_style',
  'mark',
  'market',
  'year_start',
  'year_end',
  'is_limited_edition',
  'edition_size',
  'production_total',
  'production',
  'notes',
  'engine_cc',
  'engine_note',
  'compression_ratio',
  'power_bhp',
  'power_rpm',
  'power_standard',
  'torque_lbft',
  'torque_rpm',
  'fuel_system',
  'carburettor',
  'final_drive',
  'wheels',
  'tyres',
  'kerb_weight_kg',
  'top_speed_mph',
  'description',
  'engine_code',
  'bore_mm',
  'stroke_mm',
  'gearbox',
  'brakes_front',
  'brakes_rear',
  'length_mm',
  'width_mm',
  'height_mm',
  'wheelbase_mm',
  'specs_source',
  'sources',
  'legacy_submitted_by',
  'updated_at',
].join(', ');

const SELECT = `${VARIANT_COLUMNS}, model_variant_colors (color_name, color_id, sort_order), model_variant_photos (url, kind, caption, credit, is_primary, sort_order, status)`;

interface Snapshot {
  rows: readonly ModelVariant[];
  bySlug: Map<string, ModelVariant>;
  byId: Map<string, ModelVariant>;
  words: Map<string, string[]>;
  facets: ModelVariantFacets;
  loadedAt: number;
}

let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;
/**
 * Bumped by `invalidateModelVariants()`. A fetch that STARTED before the bump
 * may have read pre-approval rows, so its result is served to the callers
 * already waiting on it but not kept as the snapshot.
 */
let generation = 0;

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/** PostgREST row → the public `ModelVariant` shape. Numeric columns arrive as numbers or strings. */
export function mapModelVariantRow(r: any): ModelVariant {
  const photos: VariantPhoto[] = (r.model_variant_photos ?? [])
    .filter((p: any) => p?.status === 'approved' && typeof p.url === 'string')
    .sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p: any) => ({
      url: p.url,
      kind: p.kind,
      caption: p.caption ?? null,
      credit: p.credit ?? null,
      is_primary: Boolean(p.is_primary),
    }));
  const colors = (r.model_variant_colors ?? [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c: any) => ({ name: String(c.color_name), color_id: c.color_id ?? null }));
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    source_slug: r.source_slug ?? '',
    marque: r.marque,
    family: r.family,
    body_style: r.body_style,
    mark: r.mark ?? null,
    market: r.market,
    year_start: r.year_start ?? null,
    year_end: r.year_end ?? null,
    is_limited_edition: Boolean(r.is_limited_edition),
    edition_size: r.edition_size ?? null,
    production_total: r.production_total ?? null,
    production: Array.isArray(r.production) ? r.production : [],
    engine_cc: r.engine_cc ?? null,
    compression_ratio: num(r.compression_ratio),
    power_bhp: num(r.power_bhp),
    power_rpm: r.power_rpm ?? null,
    power_standard: r.power_standard ?? null,
    torque_lbft: num(r.torque_lbft),
    torque_rpm: r.torque_rpm ?? null,
    fuel_system: r.fuel_system ?? null,
    carburettor: r.carburettor ?? null,
    final_drive: num(r.final_drive),
    wheels: r.wheels ?? null,
    tyres: r.tyres ?? null,
    kerb_weight_kg: num(r.kerb_weight_kg),
    top_speed_mph: num(r.top_speed_mph),
    description: r.description ?? null,
    engine_code: r.engine_code ?? null,
    bore_mm: num(r.bore_mm),
    stroke_mm: num(r.stroke_mm),
    gearbox: r.gearbox ?? null,
    brakes_front: r.brakes_front ?? null,
    brakes_rear: r.brakes_rear ?? null,
    length_mm: num(r.length_mm),
    width_mm: num(r.width_mm),
    height_mm: num(r.height_mm),
    wheelbase_mm: num(r.wheelbase_mm),
    colors,
    notes: r.notes ?? null,
    engine_note: r.engine_note ?? null,
    specs_source: r.specs_source && typeof r.specs_source === 'object' ? r.specs_source : {},
    photos,
    sources: Array.isArray(r.sources) ? r.sources : [],
    legacy_submitted_by: r.legacy_submitted_by ?? null,
    updated_at: r.updated_at,
  };
}

function buildSnapshot(rows: ModelVariant[]): Snapshot {
  const sorted = rows.slice().sort(compareVariants);
  return {
    rows: sorted,
    bySlug: new Map(sorted.map((v) => [v.slug, v])),
    byId: new Map(sorted.map((v) => [v.id, v])),
    words: new Map(sorted.map((v) => [v.slug, variantSearchWords(toModelVariantCard(v))])),
    facets: modelVariantFacets(sorted),
    loadedAt: Date.now(),
  };
}

async function fetchSnapshot(): Promise<Snapshot> {
  const supabase = getServiceClient();
  const all: any[] = [];
  // Page explicitly: a PostgREST list is capped at 1000 rows and the cap is
  // silent (.claude/rules/parts-archive.md).
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('model_variants')
      .select(SELECT)
      .eq('status', 'approved')
      .eq('model_variant_photos.status', 'approved')
      .order('slug')
      .range(from, from + 999);
    if (error) throw new Error(`model_variants read failed: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return buildSnapshot(all.map(mapModelVariantRow));
}

async function current(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.loadedAt < TTL_MS) return snapshot;
  if (inflight) return inflight;
  const startedAt = generation;
  const pending: Promise<Snapshot> = fetchSnapshot()
    .then((s) => {
      if (startedAt === generation) snapshot = s;
      return s;
    })
    .catch((err) => {
      // A stale archive beats an error page; only fail with nothing to serve.
      if (snapshot) {
        console.error('[modelVariants] refresh failed, serving stale snapshot:', err);
        return snapshot;
      }
      throw err;
    })
    .finally(() => {
      // Only clear our own slot: an invalidate may already have detached us.
      if (inflight === pending) inflight = null;
    });
  inflight = pending;
  return pending;
}

/**
 * Expire the cached snapshot on this isolate (called after an approval). It is
 * expired, not dropped, so a Supabase error on the next read still falls back
 * to the last good archive; an in-flight fetch is detached for the same reason
 * a stale one is not kept (see `generation`).
 */
export function invalidateModelVariants(): void {
  generation += 1;
  if (snapshot) snapshot = { ...snapshot, loadedAt: 0 };
  inflight = null;
}

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
  /** Variants offered in this colours-archive colour. */
  colorId?: string;
}

export async function loadModelVariants(): Promise<readonly ModelVariant[]> {
  return (await current()).rows;
}

export async function listModelVariants(filters: ModelVariantFilters = {}): Promise<ModelVariant[]> {
  const s = await current();
  return filterModelVariants(s.rows, filters, (v) => s.words.get(v.slug));
}

export async function getModelVariant(slug: string): Promise<ModelVariant | null> {
  return (await current()).bySlug.get(slug) ?? null;
}

export async function getModelVariantById(id: string): Promise<ModelVariant | null> {
  return (await current()).byId.get(id) ?? null;
}

export async function getModelVariantFacets(): Promise<ModelVariantFacets> {
  return (await current()).facets;
}

export async function relatedModelVariantsFor(variant: ModelVariant, limit = 6): Promise<ModelVariantCard[]> {
  return relatedModelVariants((await current()).rows, variant, limit);
}

// ---- pure helpers (unit-tested over the seed) --------------------------------

/** An unknown `year_end` is treated as open-ended: the source often recorded only the launch year. */
function inProduction(v: ModelVariant, year: number): boolean {
  if (!v.year_start) return false;
  const end = v.year_end ?? 2000;
  return v.year_start <= year && year <= end;
}

export function toModelVariantCard(v: ModelVariant): ModelVariantCard {
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
    photo_count: v.photos.length,
    photo_url: v.photos[0]?.url ?? null,
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

export function filterModelVariants(
  rows: readonly ModelVariant[],
  filters: ModelVariantFilters,
  wordsFor: (v: ModelVariant) => string[] | undefined = () => undefined
): ModelVariant[] {
  const q = filters.query?.trim();
  return rows
    .filter((v) => {
      if (filters.marque && v.marque !== filters.marque) return false;
      if (filters.family && v.family !== filters.family) return false;
      if (filters.body && v.body_style !== filters.body) return false;
      if (filters.market && v.market !== filters.market) return false;
      if (filters.mark !== undefined && filters.mark !== null && v.mark !== filters.mark) return false;
      if (filters.year && !inProduction(v, filters.year)) return false;
      if (filters.engine_cc && v.engine_cc !== filters.engine_cc) return false;
      if (filters.limitedOnly && !v.is_limited_edition) return false;
      if (filters.colorId && !v.colors.some((c) => c.color_id === filters.colorId)) return false;
      if (q && !matchesEveryWord(wordsFor(v) ?? variantSearchWords(toModelVariantCard(v)), q)) return false;
      return true;
    })
    .sort(compareVariants);
}

/**
 * Siblings worth linking from a detail page: same family first, then same
 * mark, never the row itself. Capped so the block stays a block.
 */
export function relatedModelVariants(
  rows: readonly ModelVariant[],
  variant: ModelVariant,
  limit = 6
): ModelVariantCard[] {
  const sameFamily = rows.filter((v) => v.slug !== variant.slug && v.family === variant.family);
  const sameMark = rows.filter(
    (v) => v.slug !== variant.slug && v.family !== variant.family && v.mark !== null && v.mark === variant.mark
  );
  return [...sameFamily.sort(compareVariants), ...sameMark.sort(compareVariants)]
    .slice(0, limit)
    .map(toModelVariantCard);
}

export interface ModelVariantFacets {
  marques: { value: string; count: number }[];
  families: { value: string; count: number }[];
  bodies: { value: string; count: number }[];
  markets: { value: string; count: number }[];
  marks: { value: number; count: number }[];
  engines: { value: number; count: number }[];
  total: number;
}

/** Distinct values across the WHOLE archive, for the index page's filter controls. */
export function modelVariantFacets(rows: readonly ModelVariant[]): ModelVariantFacets {
  const count = <K extends string | number>(pick: (v: ModelVariant) => K | null) => {
    const m = new Map<K, number>();
    for (const v of rows) {
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
    total: rows.length,
  };
}
