/**
 * 3D Model Library upload limits, shared by the wizard (`useModelUpload`) and
 * the server routes that enforce them (presign, image upload). One copy, so
 * the client rejects what the server would reject and the two never drift.
 * Values mirror the `marketplace_config` seeds and the `model_files` /
 * `model_images` constraints (keystone `2026-06-11-3d-model-library.md` §4/§5).
 */

/** Per-file hard cap: 200 MiB. Mirrors `model_files.size_bytes <= 209715200`. */
export const MODEL_FILE_MAX_BYTES = 209_715_200;

/** Per-version file count cap. Mirrors `marketplace_config.max_files_per_version`. */
export const MODEL_VERSION_MAX_FILES = 20;

/** Per-version total-bytes cap: 500 MiB (keystone §5 step 1). */
export const MODEL_VERSION_MAX_TOTAL_BYTES = 524_288_000;

/** Gallery image cap per model (keystone §4; also trigger-enforced). */
export const MODEL_MAX_IMAGES = 12;

/** Gallery image byte cap: 10 MiB, the `model-images` bucket limit (keystone Migration F). */
export const MODEL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
