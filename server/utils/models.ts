/**
 * Shared constants and guards for the 3D Model Library server routes
 * (keystone `2026-06-11-3d-model-library.md`). Kept util-level so the presign,
 * finalize, and download routes agree on limits.
 */

// --- File limits (mirror marketplace_config seeds; keystone §4/§5) -----------

/** Per-file hard cap: 200 MiB. Mirrors `model_files.size_bytes <= 209715200`. */
export const MODEL_FILE_MAX_BYTES = 209_715_200;

/** Per-version file count cap. Mirrors `marketplace_config.max_files_per_version`. */
export const MODEL_VERSION_MAX_FILES = 20;

/** Per-version total-bytes cap: 500 MiB (keystone §5 step 1). */
export const MODEL_VERSION_MAX_TOTAL_BYTES = 524_288_000;

/**
 * Allowed file extensions, lowercase only — the DB `file_ext` check constraint
 * rejects uppercase, so the presign route normalizes before insert (keystone §4).
 */
export const MODEL_FILE_EXTS = [
  'stl',
  '3mf',
  'obj',
  'step',
  'stp',
  'iges',
  'igs',
  'f3d',
  'f3z',
  'scad',
  'dxf',
  'pdf',
] as const;

export type ModelFileExt = (typeof MODEL_FILE_EXTS)[number];

/** Extensions the in-browser three.js viewer can render (keystone §4 `is_renderable`). */
export const RENDERABLE_EXTS = new Set<ModelFileExt>(['stl', '3mf', 'obj']);

/** `model_files.kind` check values. */
export const MODEL_FILE_KINDS = ['model', 'source', 'document'] as const;
export type ModelFileKind = (typeof MODEL_FILE_KINDS)[number];

/** Normalize a user-supplied extension: strip a leading dot, lowercase, trim. */
export function normalizeExt(ext: string): string {
  return String(ext || '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
}

export function isAllowedExt(ext: string): ext is ModelFileExt {
  return (MODEL_FILE_EXTS as readonly string[]).includes(ext);
}

/**
 * Infer the default `kind` from extension when the client does not specify one.
 * PDFs are documents; CAD source formats are `source`; mesh/printable formats
 * are `model`. The client may override with any valid kind.
 */
export function inferKind(ext: ModelFileExt): ModelFileKind {
  if (ext === 'pdf') return 'document';
  if (RENDERABLE_EXTS.has(ext)) return 'model';
  return 'source';
}

// --- Model metadata (used by the upload wizard's draft-CRUD routes) ----------

export const MODEL_PRICING_MODES = ['free', 'tips', 'pwyw', 'fixed'] as const;
export type ModelPricingMode = (typeof MODEL_PRICING_MODES)[number];

export function isPricingMode(v: unknown): v is ModelPricingMode {
  return typeof v === 'string' && (MODEL_PRICING_MODES as readonly string[]).includes(v);
}

/**
 * Force the price columns to match the pricing_mode so the DB's
 * `valid_pricing_shape` check always holds, regardless of leftover client
 * values: fixed → price only; pwyw → min (+ optional suggested); free/tips → none.
 */
export function normalizePricing(
  mode: ModelPricingMode,
  vals: { priceCents: number | null; minPriceCents: number | null; suggestedPriceCents: number | null }
): { price_cents: number | null; min_price_cents: number | null; suggested_price_cents: number | null } {
  if (mode === 'fixed') {
    return { price_cents: vals.priceCents, min_price_cents: null, suggested_price_cents: null };
  }
  if (mode === 'pwyw') {
    // Pay-what-you-want has no seller-set minimum — the only floor is the
    // platform minimum (Stripe can't process tiny charges). Suggested is optional.
    return {
      price_cents: null,
      min_price_cents: MODEL_MIN_PRICE_CENTS,
      suggested_price_cents: vals.suggestedPriceCents,
    };
  }
  return { price_cents: null, min_price_cents: null, suggested_price_cents: null };
}

/** Min price/tip floor in cents (Stripe economics; keystone §6). */
export const MODEL_MIN_PRICE_CENTS = 100;

export const MODEL_TITLE_MIN = 3;
export const MODEL_TITLE_MAX = 120;
export const MODEL_SUMMARY_MAX = 280;
export const MODEL_DESCRIPTION_MAX = 20000;
export const MODEL_MAX_TAGS = 10;

/** URL-safe slug from a title: lowercase, de-accented, hyphenated, ≤90 chars. */
export function slugifyModelTitle(title: string): string {
  return (
    String(title || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'model'
  );
}
