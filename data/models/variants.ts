/**
 * Model Variants archive — types, closed vocabularies and unit contracts.
 *
 * Design: docs/plans/2026-09-22-model-variants-archive.md. The row shape here is
 * the §1.1 contract, served from the `model_variants` table through
 * `server/utils/modelVariants.ts`. The recovered seed lives in
 * `docs/plans/data/2026-09-22-model-variants-seed.json`.
 *
 * Units follow `.claude/rules/reference-data.md`: the stored column is the
 * source unit (bhp, lb-ft, kg, mph) and metric is derived on read by the
 * helpers at the bottom of this file. Never store a converted value.
 */
import type { UnitDescriptions } from './units';

export const VARIANT_MARQUES = [
  'austin',
  'morris',
  'austin_morris',
  'mini',
  'rover',
  'innocenti',
  'authi',
  'riley',
  'wolseley',
  'leyland',
  'other',
] as const;
export type VariantMarque = (typeof VARIANT_MARQUES)[number];

export const VARIANT_FAMILIES = [
  'saloon',
  'cooper',
  'cooper_s',
  'clubman',
  'clubman_estate',
  '1275_gt',
  'countryman_traveller',
  'van',
  'pickup',
  'moke',
  'elf_hornet',
  'cabriolet',
  'limited_edition',
  'special',
] as const;
export type VariantFamily = (typeof VARIANT_FAMILIES)[number];

export const VARIANT_BODIES = ['saloon', 'estate', 'van', 'pickup', 'moke', 'cabriolet'] as const;
export type VariantBody = (typeof VARIANT_BODIES)[number];

export const VARIANT_MARKETS = [
  'uk',
  'europe',
  'italy',
  'spain',
  'france',
  'germany',
  'netherlands',
  'switzerland',
  'portugal',
  'japan',
  'south_africa',
  'australia',
  'new_zealand',
  'venezuela',
  'usa',
  'other',
] as const;
export type VariantMarket = (typeof VARIANT_MARKETS)[number];

export const VARIANT_FUEL_SYSTEMS = ['carb_single', 'carb_twin', 'spi', 'mpi'] as const;
export type VariantFuelSystem = (typeof VARIANT_FUEL_SYSTEMS)[number];

/** English display labels. The pages translate these keys in their i18n blocks. */
export const MARQUE_LABELS: Record<VariantMarque, string> = {
  austin: 'Austin',
  morris: 'Morris',
  austin_morris: 'Austin / Morris',
  mini: 'Mini',
  rover: 'Rover',
  innocenti: 'Innocenti',
  authi: 'Authi',
  riley: 'Riley',
  wolseley: 'Wolseley',
  leyland: 'Leyland',
  other: 'Coachbuilt / other',
};

export const FAMILY_LABELS: Record<VariantFamily, string> = {
  saloon: 'Saloon',
  cooper: 'Cooper',
  cooper_s: 'Cooper S',
  clubman: 'Clubman',
  clubman_estate: 'Clubman Estate',
  '1275_gt': '1275 GT',
  countryman_traveller: 'Countryman / Traveller',
  van: 'Van',
  pickup: 'Pick-up',
  moke: 'Moke',
  elf_hornet: 'Elf / Hornet',
  cabriolet: 'Cabriolet',
  limited_edition: 'Limited edition',
  special: 'Special',
};

export const BODY_LABELS: Record<VariantBody, string> = {
  saloon: 'Saloon',
  estate: 'Estate',
  van: 'Van',
  pickup: 'Pick-up',
  moke: 'Moke',
  cabriolet: 'Cabriolet',
};

export const MARKET_LABELS: Record<VariantMarket, string> = {
  uk: 'United Kingdom',
  europe: 'Europe',
  italy: 'Italy',
  spain: 'Spain',
  france: 'France',
  germany: 'Germany',
  netherlands: 'Netherlands',
  switzerland: 'Switzerland',
  portugal: 'Portugal',
  japan: 'Japan',
  south_africa: 'South Africa',
  australia: 'Australia',
  new_zealand: 'New Zealand',
  venezuela: 'Venezuela',
  usa: 'United States',
  other: 'Other',
};

export const FUEL_SYSTEM_LABELS: Record<VariantFuelSystem, string> = {
  carb_single: 'Single carburettor',
  carb_twin: 'Twin carburettors',
  spi: 'Single-point injection',
  mpi: 'Multi-point injection',
};

/**
 * The UK mark sequence. Cars built outside it (Innocenti, Authi, Leyland
 * Australia, coachbuilt specials) carry `mark: null` and group under
 * `OVERSEAS_GROUP` on the index page.
 */
export const MARK_RANGES: Record<number, { start: number; end: number; roman: string }> = {
  1: { start: 1959, end: 1967, roman: 'I' },
  2: { start: 1967, end: 1969, roman: 'II' },
  3: { start: 1969, end: 1976, roman: 'III' },
  4: { start: 1976, end: 1984, roman: 'IV' },
  5: { start: 1984, end: 1992, roman: 'V' },
  6: { start: 1992, end: 1996, roman: 'VI' },
  7: { start: 1996, end: 2000, roman: 'VII' },
};
export const MARK_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
export const OVERSEAS_GROUP = 'overseas';

/** The A-series capacities the review card treats as known. Anything else needs a note. */
export const KNOWN_ENGINE_CC = [848, 970, 997, 998, 1071, 1098, 1275] as const;

/**
 * Unit contract for the spec columns, in the shape `data/models/units.ts`
 * consumers expect. Stored units are the SOURCE; metric is derived by the
 * `to*` helpers below and never persisted.
 */
export const VARIANT_UNITS: UnitDescriptions = {
  engine_cc: 'cubic centimetres (cc)',
  compression_ratio: 'ratio to 1 (9.0 means 9.0:1)',
  power_bhp: 'brake horsepower (bhp). The seed converted French "ch" (metric hp) with ×0.986',
  power_rpm: 'revolutions per minute',
  torque_lbft: 'pound-feet (lb-ft). The seed converted "mkg" with ×7.233',
  torque_rpm: 'revolutions per minute',
  final_drive: 'ratio to 1',
  kerb_weight_kg: 'kilograms (kg)',
  top_speed_mph: 'miles per hour (mph). The seed converted km/h with ÷1.609',
};

export interface VariantProductionEntry {
  /** Lower-case marque as printed by the source, or null for an unattributed total. */
  marque: string | null;
  count: number;
}

/** Photo-import bookkeeping on the SEED file only (docs/plans/data). */
export interface VariantSeedImage {
  original_url: string;
  /** Present only when `archived` is true: the exact Wayback capture. */
  wayback_url?: string;
  alt: string;
  /** False when the Wayback Machine never captured the file. */
  archived: boolean;
}

export const VARIANT_PHOTO_KINDS = ['brochure', 'factory', 'period', 'owner', 'interior', 'engine', 'badge'] as const;
export type VariantPhotoKind = (typeof VARIANT_PHOTO_KINDS)[number];

/** An approved, hosted photo (`model_variant_photos`). */
export interface VariantPhoto {
  url: string;
  kind: VariantPhotoKind;
  caption: string | null;
  credit: string | null;
  is_primary: boolean;
}

/** A factory colour as printed, linked to the colours archive when it resolves. */
export interface VariantColor {
  name: string;
  color_id: string | null;
}

export interface VariantSource {
  type: 'web_archive' | 'book' | 'brochure' | 'period_document' | 'link' | 'other';
  title: string;
  url?: string;
  accessed?: string;
}

/** One row of the archive — the §1.1 contract, as `server/utils/modelVariants.ts` serves it. */
export interface ModelVariant {
  id: string;
  slug: string;
  name: string;
  /** The source page's file name, kept for provenance. */
  source_slug: string;
  marque: VariantMarque;
  family: VariantFamily;
  body_style: VariantBody;
  mark: number | null;
  market: VariantMarket;
  year_start: number | null;
  year_end: number | null;
  is_limited_edition: boolean;
  edition_size: number | null;
  production_total: number | null;
  production: VariantProductionEntry[];
  engine_cc: number | null;
  compression_ratio: number | null;
  power_bhp: number | null;
  power_rpm: number | null;
  /** "SAE" or "DIN" when the source said which standard the figure is quoted to. */
  power_standard: string | null;
  torque_lbft: number | null;
  torque_rpm: number | null;
  fuel_system: VariantFuelSystem | null;
  carburettor: string | null;
  final_drive: number | null;
  wheels: string | null;
  tyres: string | null;
  kerb_weight_kg: number | null;
  top_speed_mph: number | null;
  description: string | null;
  engine_code: string | null;
  bore_mm: number | null;
  stroke_mm: number | null;
  gearbox: string | null;
  brakes_front: string | null;
  brakes_rear: string | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  colors: VariantColor[];
  notes: string | null;
  engine_note: string | null;
  /** The source page's label → value pairs, verbatim. */
  specs_source: Record<string, string>;
  photos: VariantPhoto[];
  sources: VariantSource[];
  legacy_submitted_by: string | null;
  updated_at: string;
}

/** A row of the recovered seed file, `docs/plans/data/2026-09-22-model-variants-seed.json`. */
export type ModelVariantSeedRow = Omit<
  ModelVariant,
  | 'id'
  | 'colors'
  | 'photos'
  | 'updated_at'
  | 'description'
  | 'engine_code'
  | 'bore_mm'
  | 'stroke_mm'
  | 'gearbox'
  | 'brakes_front'
  | 'brakes_rear'
  | 'length_mm'
  | 'width_mm'
  | 'height_mm'
  | 'wheelbase_mm'
> & {
  colors: string[];
  images: VariantSeedImage[];
};

/**
 * Columns a contributor may change through a reviewed spec fix — the web
 * approve route's `EDIT_TARGETS.variant`. Never slug, status, provenance or
 * classification (marque / family / mark / market): reclassifying a car is a
 * moderation act, done by an admin, not a suggestion.
 */
export const VARIANT_EDITABLE_COLUMNS = [
  'name',
  'year_start',
  'year_end',
  'edition_size',
  'production_total',
  'description',
  'notes',
  'engine_cc',
  'engine_code',
  'bore_mm',
  'stroke_mm',
  'compression_ratio',
  'power_bhp',
  'power_rpm',
  'torque_lbft',
  'torque_rpm',
  'carburettor',
  'gearbox',
  'final_drive',
  'brakes_front',
  'brakes_rear',
  'wheels',
  'tyres',
  'kerb_weight_kg',
  'top_speed_mph',
  'length_mm',
  'width_mm',
  'height_mm',
  'wheelbase_mm',
] as const;
export type VariantEditableColumn = (typeof VARIANT_EDITABLE_COLUMNS)[number];

/** Which editable columns are numbers (the rest are text). */
export const VARIANT_NUMERIC_COLUMNS: ReadonlySet<string> = new Set([
  'year_start',
  'year_end',
  'edition_size',
  'production_total',
  'engine_cc',
  'bore_mm',
  'stroke_mm',
  'compression_ratio',
  'power_bhp',
  'power_rpm',
  'torque_lbft',
  'torque_rpm',
  'final_drive',
  'kerb_weight_kg',
  'top_speed_mph',
  'length_mm',
  'width_mm',
  'height_mm',
  'wheelbase_mm',
]);

/**
 * The model_variants CHECK constraints and column types, mirrored so the
 * wizard and the approve route reject a bad number with a readable message
 * instead of a Postgres 500 at approval. Keep in step with migration
 * 20260922000002 in classicminidiy-supabase.
 */
export const VARIANT_RANGES: Record<string, { min?: number; max?: number; integer?: boolean; positive?: boolean }> = {
  mark: { min: 1, max: 7, integer: true },
  year_start: { min: 1959, max: 2000, integer: true },
  year_end: { min: 1959, max: 2000, integer: true },
  edition_size: { positive: true, integer: true, max: 2_000_000 },
  production_total: { positive: true, integer: true, max: 10_000_000 },
  engine_cc: { min: 500, max: 2000, integer: true },
  bore_mm: { positive: true, max: 9999 },
  stroke_mm: { positive: true, max: 9999 },
  compression_ratio: { min: 5, max: 15 },
  power_bhp: { positive: true, max: 99999 },
  power_rpm: { positive: true, max: 32767, integer: true },
  torque_lbft: { positive: true, max: 99999 },
  torque_rpm: { positive: true, max: 32767, integer: true },
  final_drive: { positive: true, max: 99 },
  kerb_weight_kg: { positive: true, max: 99999 },
  top_speed_mph: { positive: true, max: 9999 },
  length_mm: { positive: true, max: 99999 },
  width_mm: { positive: true, max: 99999 },
  height_mm: { positive: true, max: 99999 },
  wheelbase_mm: { positive: true, max: 99999 },
};

/** Null when `value` fits `column`'s range, else a short English reason. */
export function variantNumberProblem(column: string, value: number): string | null {
  const r = VARIANT_RANGES[column];
  if (!r) return null;
  if (r.integer && !Number.isInteger(value)) return `${column} must be a whole number`;
  if (r.positive && value <= 0) return `${column} must be greater than zero`;
  if (r.min !== undefined && value < r.min) return `${column} must be at least ${r.min}`;
  if (r.max !== undefined && value > r.max) return `${column} must be at most ${r.max}`;
  return null;
}

/** The text columns' length caps (name is CHECKed at 160 in the table). */
export const VARIANT_TEXT_MAX: Record<string, number> = { name: 160 };

/** A contributor's citation. Required on every spec change and every new variant. */
export const VARIANT_SOURCE_TYPES = ['book', 'brochure', 'period_document', 'link', 'other'] as const;

/** The subset the index page and search results carry. */
export interface ModelVariantCard {
  slug: string;
  name: string;
  marque: VariantMarque;
  family: VariantFamily;
  body_style: VariantBody;
  mark: number | null;
  market: VariantMarket;
  year_start: number | null;
  year_end: number | null;
  is_limited_edition: boolean;
  engine_cc: number | null;
  photo_count: number;
  /** First hosted photo, or null. Drives the card image vs. the gap state. */
  photo_url: string | null;
  /** How many of the twelve source spec rows carry a value. */
  spec_count: number;
}

export const SPEC_ROW_COUNT = 12;

/** "1964–1967", "1975", or "" when the year is unknown. */
export function yearsLabel(start: number | null, end: number | null): string {
  if (start && end && end !== start) return `${start}–${end}`;
  if (start) return String(start);
  return '';
}

export function markLabel(mark: number | null): string {
  if (!mark || !MARK_RANGES[mark]) return '';
  return `Mk ${MARK_RANGES[mark].roman}`;
}

export function toPs(bhp: number): number {
  return Math.round(bhp * 1.01387);
}
export function toKw(bhp: number): number {
  return Math.round(bhp * 0.7457);
}
export function toNm(lbft: number): number {
  return Math.round(lbft * 1.35582);
}
export function toLb(kg: number): number {
  return Math.round(kg * 2.20462);
}
export function toKmh(mph: number): number {
  return Math.round(mph * 1.609344);
}

/**
 * The words a search query may prefix-match, built from the fields a CARD
 * carries so the index page (client) and `server/utils/modelVariants.ts`
 * (API + MCP tool) rank identically. Word-prefix AND, never substring.
 */
export function variantSearchWords(v: ModelVariantCard): string[] {
  const text = [
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
  ].join(' ');
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Every query word must prefix-match some word of the row. Empty query matches all. */
export function matchesEveryWord(haystack: readonly string[], query: string): boolean {
  const needles = query
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (needles.length === 0) return true;
  return needles.every((needle) => haystack.some((w) => w.startsWith(needle)));
}

/** How many of the twelve source rows are filled — the "N of 12 specs sourced" figure. */
export function countSourcedSpecs(
  variant: Pick<
    ModelVariant,
    | 'engine_cc'
    | 'compression_ratio'
    | 'power_bhp'
    | 'torque_lbft'
    | 'carburettor'
    | 'fuel_system'
    | 'final_drive'
    | 'wheels'
    | 'tyres'
    | 'kerb_weight_kg'
    | 'top_speed_mph'
    | 'production_total'
  > & { colors: readonly unknown[] }
): number {
  // Counted from the TYPED columns — the twelve rows of the original spec
  // sheet — so a contributed variant or a sourced correction counts too.
  // (Every value on the page is cited: the seed row and each approved fix
  // append to `sources`.)
  const filled = [
    variant.engine_cc,
    variant.compression_ratio,
    variant.power_bhp,
    variant.torque_lbft,
    variant.carburettor ?? variant.fuel_system,
    variant.final_drive,
    variant.wheels,
    variant.tyres,
    variant.kerb_weight_kg,
    variant.top_speed_mph,
    variant.production_total,
  ].filter((v) => v !== null && v !== undefined && v !== '').length;
  return filled + (variant.colors.length > 0 ? 1 : 0);
}
