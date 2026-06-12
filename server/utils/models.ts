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
