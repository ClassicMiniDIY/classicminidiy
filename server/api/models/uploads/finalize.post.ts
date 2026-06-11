/**
 * POST /api/models/uploads/finalize  (keystone §5 step 3)
 *
 * Called after the browser finishes the direct-to-S3 upload. Verifies the
 * object exists, sniffs its first 512 bytes against the declared extension
 * (catching a lie like a `.pdf` that is really a zip), and — only on success —
 * flips the `model_files` row from `pending` to `uploaded` via the service role
 * (users cannot UPDATE `upload_status` themselves; that is the finalize gate).
 *
 * Sniffing is best-effort (STL has no magic number; some CAD formats are plain
 * text) — human moderation of new/contributor uploads is the real backstop.
 */
import { requireUserAuth } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { assertModelsEnabled } from '../../../utils/models';
import { headModelObject, getModelObjectHead } from '../../../utils/s3Models';
import { sniffModelFile } from '../../../utils/uploadValidation';

export default defineEventHandler(async (event) => {
  assertModelsEnabled();

  const { user } = await requireUserAuth(event);
  const body = await readBody(event);
  const fileId = typeof body?.fileId === 'string' ? body.fileId.trim() : '';

  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: 'fileId is required' });
  }

  const service = getServiceClient();

  const { data: file, error: fileError } = await service
    .from('model_files')
    .select('id, s3_key, file_ext, size_bytes, upload_status, model_id, version_id')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' });
  }

  // Ownership: only the model owner may finalize their own pending file.
  const { data: model, error: modelError } = await service
    .from('models')
    .select('owner_id')
    .eq('id', file.model_id)
    .single();

  if (modelError || !model || model.owner_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Not allowed to finalize this file' });
  }

  // Idempotent: already finalized.
  if (file.upload_status === 'uploaded') {
    return { ok: true, fileId, uploadStatus: 'uploaded' };
  }

  // Confirm the object landed.
  const head = await headModelObject(file.s3_key);
  if (!head.exists) {
    throw createError({ statusCode: 409, statusMessage: 'Upload not found in storage' });
  }

  // Sniff the first bytes against the declared extension. Skip the ranged GET
  // for a 0-byte object — `bytes=0-511` on an empty object is a 416 from S3; an
  // empty buffer simply fails the sniff below (presign's content-length-range
  // min of 1 should already prevent this, but guard defensively).
  const headBytes = head.size > 0 ? await getModelObjectHead(file.s3_key, 512) : Buffer.alloc(0);
  const sniff = sniffModelFile({ ext: file.file_ext, head: headBytes, size: head.size });

  if (!sniff.ok) {
    await service.from('model_files').update({ upload_status: 'failed' }).eq('id', fileId);
    console.warn(`[models/finalize] sniff failed for ${fileId} (.${file.file_ext}): ${sniff.reason}`);
    throw createError({ statusCode: 422, statusMessage: 'Uploaded file failed format verification' });
  }

  const { error: updateError } = await service
    .from('model_files')
    .update({ upload_status: 'uploaded' })
    .eq('id', fileId);

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to finalize file' });
  }

  return { ok: true, fileId, uploadStatus: 'uploaded', sizeBytes: head.size };
});
