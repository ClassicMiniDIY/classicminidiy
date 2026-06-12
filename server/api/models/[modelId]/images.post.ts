/**
 * POST /api/models/[modelId]/images  (keystone §11 PR 7)
 *
 * Uploads a gallery image for a model to the public Supabase Storage
 * `model-images` bucket, mirroring the archive image pattern (server-side,
 * service role, magic-byte validated). Ownership is enforced here because the
 * service role bypasses RLS. Returns the inserted row + public URL.
 *
 * Model FILE bytes go to S3 via presign/finalize (separate flow); only images
 * come through the server.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireUserAuth } from '../../../utils/userAuth';
import { detectMimeFromMagic, generateSafeFilename, type DetectedMime } from '../../../utils/uploadValidation';

const ALLOWED: DetectedMime[] = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB (keystone Migration F)
const MAX_IMAGES = 12; // keystone §4 (≤12/model, also trigger-enforced)

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  const service = getServiceClient();

  const { data: model, error: modelError } = await service
    .from('models')
    .select('id, owner_id')
    .eq('id', modelId)
    .single();
  if (modelError || !model) throw createError({ statusCode: 404, statusMessage: 'Model not found' });
  if (model.owner_id !== user.id)
    throw createError({ statusCode: 403, statusMessage: 'Not allowed to add images here' });

  const query = getQuery(event);
  const versionId = typeof query.versionId === 'string' && query.versionId ? query.versionId : null;
  const altText = typeof query.altText === 'string' ? query.altText.slice(0, 280) : null;

  const form = await readMultipartFormData(event);
  const file = form?.find((f) => f.data && f.filename);
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'No image uploaded' });
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Image exceeds the 10 MB limit' });
  }

  const mime = detectMimeFromMagic(file.data);
  if (!mime || !ALLOWED.includes(mime)) {
    throw createError({ statusCode: 400, statusMessage: 'File is not a JPG, PNG, or WebP image' });
  }

  // Count existing images (cap + sort_order + first-is-primary).
  const { data: existing } = await service.from('model_images').select('id, is_primary').eq('model_id', modelId);
  const count = existing?.length ?? 0;
  if (count >= MAX_IMAGES) {
    throw createError({ statusCode: 400, statusMessage: `A model may have at most ${MAX_IMAGES} images` });
  }
  const isPrimary = count === 0; // first image is primary by default

  const safeName = generateSafeFilename(mime);
  const storagePath = `${modelId}/${safeName}`;

  const { error: uploadError } = await service.storage
    .from('model-images')
    .upload(storagePath, file.data, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error('[models/images] storage upload failed:', uploadError.message);
    throw createError({ statusCode: 500, statusMessage: 'Image upload failed' });
  }

  const { data: row, error: insertError } = await service
    .from('model_images')
    .insert({
      model_id: modelId,
      version_id: versionId,
      storage_path: storagePath,
      alt_text: altText,
      is_primary: isPrimary,
      sort_order: count,
    })
    .select('id, storage_path, is_primary, sort_order, alt_text')
    .single();

  if (insertError || !row) {
    // Roll back the orphaned object so storage doesn't leak.
    await service.storage.from('model-images').remove([storagePath]);
    console.error('[models/images] row insert failed:', insertError?.message);
    throw createError({ statusCode: 400, statusMessage: insertError?.message || 'Could not save image' });
  }

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  return {
    id: row.id,
    url: `${supabaseUrl}/storage/v1/object/public/model-images/${row.storage_path}`,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
    altText: row.alt_text,
  };
});
