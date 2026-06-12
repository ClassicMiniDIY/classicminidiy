/**
 * POST /api/models/uploads/presign  (keystone §5 step 1)
 *
 * Mints a presigned POST so the browser can upload a model file directly to the
 * private `classicminidiy-models` S3 bucket (200 MB files cannot stream through
 * serverless Nitro). Before presigning we:
 *   - confirm the caller owns a draft/rejected version (via RLS — the insert
 *     runs under the caller's JWT, not the service role);
 *   - enforce the extension allowlist (lowercase, the DB constraint is too),
 *     per-file size cap, per-version file count, and 500 MB per-version total;
 *   - insert a `pending` model_files row that `finalize` later flips to uploaded.
 *
 * The presign policy pins the exact key, a content-length-range, the content
 * type, and INTELLIGENT_TIERING; an optional base64 SHA-256 is bound so S3
 * verifies the hash during the upload.
 */
import { randomUUID } from 'node:crypto';
import { requireUserClient } from '../../../utils/userAuth';
import {
  MODEL_FILE_MAX_BYTES,
  MODEL_VERSION_MAX_FILES,
  MODEL_VERSION_MAX_TOTAL_BYTES,
  MODEL_FILE_KINDS,
  type ModelFileKind,
  normalizeExt,
  isAllowedExt,
  inferKind,
  RENDERABLE_EXTS,
} from '../../../utils/models';
import { buildModelKey, sanitizeModelFilename, createModelUploadPost } from '../../../utils/s3Models';

export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireUserClient(event);
  const body = await readBody(event);

  const versionId = typeof body?.versionId === 'string' ? body.versionId.trim() : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
  const sizeBytes = Number(body?.sizeBytes);
  const sha256 = typeof body?.sha256 === 'string' && body.sha256.trim() ? body.sha256.trim() : null;

  if (!versionId || !fileName) {
    throw createError({ statusCode: 400, statusMessage: 'versionId and fileName are required' });
  }

  // Extension allowlist — normalize to lowercase (DB rejects uppercase).
  const ext = normalizeExt(body?.ext ?? fileName.split('.').pop() ?? '');
  if (!isAllowedExt(ext)) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported file type: .${ext || '?'}` });
  }

  // Size bounds.
  if (!Number.isFinite(sizeBytes) || !Number.isInteger(sizeBytes) || sizeBytes < 1) {
    throw createError({ statusCode: 400, statusMessage: 'sizeBytes must be a positive integer' });
  }
  if (sizeBytes > MODEL_FILE_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'File exceeds the 200 MB per-file limit' });
  }

  // Kind — honor an explicit valid value, else infer from extension.
  let kind: ModelFileKind = inferKind(ext);
  if (body?.kind != null) {
    if (!(MODEL_FILE_KINDS as readonly string[]).includes(body.kind)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid kind' });
    }
    kind = body.kind as ModelFileKind;
  }

  // Version must exist, be owned by the caller (RLS), and be editable. Reading
  // through the user-scoped client means a non-owner simply gets no row.
  const { data: version, error: versionError } = await supabase
    .from('model_versions')
    .select('id, model_id, version_number, status')
    .eq('id', versionId)
    .single();

  if (versionError || !version) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' });
  }
  if (version.status !== 'draft' && version.status !== 'rejected') {
    throw createError({ statusCode: 409, statusMessage: 'Files can only be added while the version is a draft' });
  }

  // Per-version quotas: count + total bytes (existing rows are owner-visible via RLS).
  const { data: existing, error: existingError } = await supabase
    .from('model_files')
    .select('size_bytes')
    .eq('version_id', versionId);

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to read existing files' });
  }

  const fileCount = existing?.length ?? 0;
  const existingBytes = (existing ?? []).reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);

  if (fileCount >= MODEL_VERSION_MAX_FILES) {
    throw createError({
      statusCode: 400,
      statusMessage: `A version may have at most ${MODEL_VERSION_MAX_FILES} files`,
    });
  }
  if (existingBytes + sizeBytes > MODEL_VERSION_MAX_TOTAL_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Adding this file would exceed the 500 MB per-version limit' });
  }

  // Build identity + key.
  const fileId = randomUUID();
  const safeFilename = sanitizeModelFilename(fileName, ext);
  const key = buildModelKey({
    modelId: version.model_id,
    versionNumber: version.version_number,
    fileId,
    safeFilename,
  });
  const isRenderable = RENDERABLE_EXTS.has(ext);
  const contentType = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';

  // Insert the pending row UNDER THE CALLER'S JWT so the model_files INSERT RLS
  // policy (owner + version draft/rejected) is the authoritative gate.
  const { error: insertError } = await supabase.from('model_files').insert({
    id: fileId,
    version_id: versionId,
    model_id: version.model_id,
    kind,
    file_name: safeFilename,
    file_ext: ext,
    s3_key: key,
    size_bytes: sizeBytes,
    sha256,
    is_renderable: isRenderable,
    upload_status: 'pending',
  });

  if (insertError) {
    console.error('[models/presign] insert failed:', insertError.message);
    throw createError({ statusCode: 403, statusMessage: 'Not allowed to add files to this version' });
  }

  const post = await createModelUploadPost({
    key,
    contentType,
    maxBytes: MODEL_FILE_MAX_BYTES,
    checksumSha256: sha256,
  });

  return {
    fileId,
    key,
    isRenderable,
    maxBytes: MODEL_FILE_MAX_BYTES,
    expiresIn: 900,
    upload: { url: post.url, fields: post.fields },
  };
});
