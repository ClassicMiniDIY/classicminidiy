/**
 * Model Variants archive — types, closed vocabularies and unit contracts.
 *
 * Design: docs/plans/2026-09-22-model-variants-archive.md. The row shape here is
 * the §1.1 contract; today it is served from `data/modelVariants.json` (the
 * austinminiwebsearch.com seed) through `server/utils/modelVariants.ts`, and the
 * same shape moves to the `model_variants` table in Phase 1 without the pages
 * or the MCP tool changing.
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

export interface VariantImage {
  /** Public URL once the photo is hosted (Phase 3). Nothing renders without it. */
  url?: string;
  original_url: string;
  /** Present only when `archived` is true: the exact Wayback capture. */
  wayback_url?: string;
  alt: string;
  /** False when the Wayback Machine never captured the file. Nothing renders it then. */
  archived: boolean;
}

export interface VariantSource {
  type: 'web_archive' | 'book' | 'brochure' | 'period_document' | 'link' | 'other';
  title: string;
  url?: string;
  accessed?: string;
}

/** One row of the archive — the §1.1 contract. */
export interface ModelVariant {
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
  /** Factory colour names as printed. Linked to `/archive/colors` by name search. */
  colors: string[];
  notes: string | null;
  engine_note: string | null;
  /** The source page's label → value pairs, verbatim. */
  specs_source: Record<string, string>;
  images: VariantImage[];
  sources: VariantSource[];
  legacy_submitted_by: string | null;
}

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
export function countSourcedSpecs(variant: Pick<ModelVariant, 'specs_source'>): number {
  return Object.values(variant.specs_source ?? {}).filter((v) => typeof v === 'string' && v.trim() !== '').length;
}
