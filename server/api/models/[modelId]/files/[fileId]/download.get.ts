/**
 * GET /api/models/[modelId]/files/[fileId]/download  (keystone §5)
 *
 * The single download gate. Order (all required):
 *   auth (logged-in account) → file uploaded & belongs to model →
 *   published ∨ owner ∨ admin → has_model_entitlement() →
 *   rate limit (~60 files/hr/user) → record model_downloads (service role,
 *   dedup per file/user/day) → 302 to a 60-second presigned GET.
 *
 * `?disposition=inline` serves the file inline for the 3D viewer; the default is
 * `attachment` for real downloads.
 */
import { requireUserAuth } from '../../../../../utils/userAuth';
import { isAdminAuthenticated } from '../../../../../utils/adminAuth';
import { getServiceClient } from '../../../../../utils/supabase';
import { consumeRateLimit } from '../../../../../utils/rateLimit';
import { createModelDownloadUrl } from '../../../../../utils/s3Models';

const DOWNLOADS_PER_HOUR = 60;
const HOUR_MS = 3_600_000;

export default defineEventHandler(async (event) => {
  // Downloads require a logged-in account (keystone §2.7).
  const { user } = await requireUserAuth(event);

  const modelId = getRouterParam(event, 'modelId');
  const fileId = getRouterParam(event, 'fileId');
  if (!modelId || !fileId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing model or file id' });
  }

  const service = getServiceClient();

  // File must exist, be uploaded, and belong to the model in the URL.
  const { data: file, error: fileError } = await service
    .from('model_files')
    .select('id, s3_key, file_name, upload_status, model_id, version_id')
    .eq('id', fileId)
    .single();

  if (fileError || !file || file.model_id !== modelId) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' });
  }
  if (file.upload_status !== 'uploaded') {
    throw createError({ statusCode: 409, statusMessage: 'File is not available' });
  }

  const { data: model, error: modelError } = await service
    .from('models')
    .select('id, owner_id, status')
    .eq('id', modelId)
    .single();

  if (modelError || !model) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' });
  }

  const isOwner = model.owner_id === user.id;
  const isAdmin = isOwner ? false : await isAdminAuthenticated(event);

  // Visibility pre-gate: never reveal an unpublished model to a stranger (404,
  // not 403, so existence does not leak).
  if (model.status !== 'published' && !isOwner && !isAdmin) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' });
  }

  // Entitlement gate: owner/admin always; free/tips always; paid needs a
  // purchase; removed/flagged is false for everyone but owner/admin. Owner/admin
  // are already established above, so short-circuit the RPC roundtrip for them
  // (has_model_entitlement returns true for them anyway).
  let entitled = isOwner || isAdmin;
  if (!entitled) {
    const { data, error: entError } = await service.rpc('has_model_entitlement', {
      p_model_id: modelId,
      p_user_id: user.id,
    });
    if (entError) {
      throw createError({ statusCode: 500, statusMessage: 'Could not verify download entitlement' });
    }
    entitled = !!data;
  }
  if (!entitled) {
    throw createError({ statusCode: 403, statusMessage: 'Purchase required to download this model' });
  }

  // Per-user download throttle (scraping defense; keystone §12).
  const limit = consumeRateLimit(`model-dl:${user.id}`, { max: DOWNLOADS_PER_HOUR, windowMs: HOUR_MS });
  setHeader(event, 'X-RateLimit-Limit', String(DOWNLOADS_PER_HOUR));
  setHeader(event, 'X-RateLimit-Remaining', String(limit.remaining));
  if (limit.limited) {
    setHeader(event, 'Retry-After', limit.retryAfter); // h3 types Retry-After as numeric seconds
    throw createError({ statusCode: 429, statusMessage: 'Download rate limit reached — try again shortly' });
  }

  // Record the download once per file/user/day (service role; trigger bumps the
  // counters only when a row is actually inserted). Best-effort — never block
  // the download on a counting hiccup.
  const dayBucket = new Date().toISOString().slice(0, 10);
  const { error: dlError } = await service.from('model_downloads').upsert(
    {
      file_id: file.id,
      model_id: modelId,
      version_id: file.version_id,
      user_id: user.id,
      day_bucket: dayBucket,
    },
    { onConflict: 'file_id,user_id,day_bucket', ignoreDuplicates: true }
  );
  if (dlError) {
    console.error('[models/download] failed to record download:', dlError.message);
  }

  const query = getQuery(event);
  const disposition = query.disposition === 'inline' ? 'inline' : 'attachment';
  const url = await createModelDownloadUrl({
    key: file.s3_key,
    fileName: file.file_name,
    disposition,
    expiresInSeconds: 60,
  });

  // The Supabase session lives in localStorage, so a plain <a href> navigation
  // can't carry the Bearer token (it 401s). `?json=1` lets the client fetch this
  // route WITH the Authorization header and receive the short-lived presigned URL
  // to trigger the download from JS. The default 302 stays for the 3D viewer,
  // which fetches with the header and follows the redirect.
  if (query.json) {
    return { url, fileName: file.file_name };
  }

  return sendRedirect(event, url, 302);
});
