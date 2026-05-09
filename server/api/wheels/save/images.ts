import { getServiceClient } from '../../../utils/supabase';
import { requireUserAuth } from '../../../utils/userAuth';
import { detectMimeFromMagic, generateSafeFilename, type DetectedMime } from '../../../utils/uploadValidation';

const ALLOWED_TYPES: DetectedMime[] = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 3 * 1024 * 1024;

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);

  const params = getQuery(event);
  const uuid = params.uuid?.toString();

  if (!uuid) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required uuid parameter' });
  }

  const supabase = getServiceClient();

  const { data: submission, error: submissionError } = await supabase
    .from('submission_queue')
    .select('id, submitted_by, status')
    .eq('id', uuid)
    .single();

  if (submissionError || !submission) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' });
  }

  if (submission.submitted_by !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to upload to this submission' });
  }

  if (submission.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: 'Submission is no longer accepting uploads' });
  }

  try {
    const formData = await readMultipartFormData(event);

    if (!formData || formData.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No files uploaded' });
    }

    const uploadedPaths: string[] = [];

    for (const file of formData) {
      if (!file.data || !file.filename) continue;

      if (file.data.length > MAX_SIZE_BYTES) {
        throw createError({
          statusCode: 400,
          statusMessage: `File exceeds the maximum size of ${MAX_SIZE_BYTES / (1024 * 1024)}MB`,
        });
      }

      const detectedMime = detectMimeFromMagic(file.data);
      if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
        throw createError({
          statusCode: 400,
          statusMessage: `File content is not an allowed image type. Allowed: ${ALLOWED_TYPES.join(', ')}`,
        });
      }

      const safeName = generateSafeFilename(detectedMime);
      const storagePath = `uploads/${uuid}/${safeName}`;

      const { error } = await supabase.storage.from('archive-wheels').upload(storagePath, file.data, {
        contentType: detectedMime,
        upsert: false,
      });

      if (error) {
        console.error(`Error uploading file:`, error);
        throw createError({ statusCode: 500, statusMessage: `Upload failed: ${error.message}` });
      }

      const { data: urlData } = supabase.storage.from('archive-wheels').getPublicUrl(storagePath);

      uploadedPaths.push(urlData.publicUrl);
    }

    if (uploadedPaths.length > 0) {
      const { data: existing } = await supabase
        .from('submission_queue')
        .select('data, submitted_by, status')
        .eq('id', uuid)
        .single();

      if (!existing || existing.submitted_by !== user.id || existing.status !== 'pending') {
        throw createError({ statusCode: 409, statusMessage: 'Submission state changed during upload' });
      }

      const currentData = (existing?.data as Record<string, any>) || {};
      const currentPhotos = (currentData.images as any[]) || (currentData.photos as any[]) || [];

      await supabase
        .from('submission_queue')
        .update({
          data: {
            ...currentData,
            images: [...currentPhotos, ...uploadedPaths],
          },
        })
        .eq('id', uuid)
        .eq('submitted_by', user.id)
        .eq('status', 'pending');
    }

    return { ok: true };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error uploading wheel images:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error uploading wheel images: ${error.message || 'Unknown error'}`,
    });
  }
});
