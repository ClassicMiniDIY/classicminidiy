/**
 * POST /api/admin/marketing/upload-image
 *
 * Marketing-admin only. Uploads an image for embedding in a marketing email
 * to the PUBLIC marketing-images bucket (email clients fetch embedded images
 * from the inbox, so they need stable public URLs). Mirrors the model-images
 * pattern: magic-byte validated, random safe filename, service-role upload.
 * The edge-fn renderer only accepts image URLs under this bucket's public
 * prefix, so this route is the sole way images enter a marketing email.
 *
 *   multipart: file
 *   returns: { url }
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireMarketingAdmin } from '../../../utils/marketingAuth';
import { detectMimeFromMagic, generateSafeFilename, type DetectedMime } from '../../../utils/uploadValidation';

const ALLOWED: DetectedMime[] = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB (matches the bucket limit)

export default defineEventHandler(async (event) => {
  await requireMarketingAdmin(event);

  const form = await readMultipartFormData(event);
  const file = form?.find((f) => f.data && f.filename);
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'No image uploaded' });
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Image exceeds the 5 MB limit' });
  }

  const mime = detectMimeFromMagic(file.data);
  if (!mime || !ALLOWED.includes(mime)) {
    throw createError({ statusCode: 400, statusMessage: 'File is not a JPG, PNG, or WebP image' });
  }

  const safeName = generateSafeFilename(mime);
  const storagePath = `${new Date().getFullYear()}/${safeName}`;

  const service = getServiceClient();
  const { error: uploadError } = await service.storage
    .from('marketing-images')
    .upload(storagePath, file.data, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error('[marketing/upload-image] storage upload failed:', uploadError.message);
    throw createError({ statusCode: 500, statusMessage: 'Image upload failed' });
  }

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  return { url: `${supabaseUrl}/storage/v1/object/public/marketing-images/${storagePath}` };
});
