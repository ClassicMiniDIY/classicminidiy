import { getServiceClient } from '../../utils/supabase';
import { requireUserAuth } from '../../utils/userAuth';
import { detectMimeFromMagic, generateSafeFilename, type DetectedMime } from '../../utils/uploadValidation';

const ALLOWED_BUCKETS = ['archive-documents', 'archive-thumbnails', 'archive-colors', 'archive-wheels'] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

interface BucketConfig {
  allowedTypes: DetectedMime[];
  maxSizeBytes: number;
}

const BUCKET_CONFIGS: Record<AllowedBucket, BucketConfig> = {
  'archive-documents': {
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  'archive-thumbnails': {
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  'archive-colors': {
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  'archive-wheels': {
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 3 * 1024 * 1024,
  },
};

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);

  const params = getQuery(event);
  const bucket = params.bucket?.toString();
  const submissionId = params.submissionId?.toString();
  const category = params.category?.toString() || 'general';

  if (!bucket) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required bucket parameter' });
  }

  if (!submissionId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required submissionId parameter' });
  }

  if (!ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid bucket. Must be one of: ${ALLOWED_BUCKETS.join(', ')}`,
    });
  }

  const config = BUCKET_CONFIGS[bucket as AllowedBucket];
  const supabase = getServiceClient();

  const { data: submission, error: submissionError } = await supabase
    .from('submission_queue')
    .select('id, submitted_by, status')
    .eq('id', submissionId)
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

      if (file.data.length > config.maxSizeBytes) {
        const maxMB = config.maxSizeBytes / (1024 * 1024);
        throw createError({
          statusCode: 400,
          statusMessage: `File exceeds the maximum size of ${maxMB}MB for bucket "${bucket}"`,
        });
      }

      const detectedMime = detectMimeFromMagic(file.data);
      if (!detectedMime || !config.allowedTypes.includes(detectedMime)) {
        throw createError({
          statusCode: 400,
          statusMessage: `File content is not an allowed type for bucket "${bucket}". Allowed types: ${config.allowedTypes.join(', ')}`,
        });
      }

      const safeName = generateSafeFilename(detectedMime);
      const storagePath = `uploads/${submissionId}/${safeName}`;

      const { error } = await supabase.storage.from(bucket).upload(storagePath, file.data, {
        contentType: detectedMime,
        upsert: false,
      });

      if (error) {
        console.error(`Error uploading file:`, error);
        throw createError({ statusCode: 500, statusMessage: `Upload failed: ${error.message}` });
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      uploadedPaths.push(urlData.publicUrl);
    }

    if (uploadedPaths.length > 0) {
      const { data: existing } = await supabase
        .from('submission_queue')
        .select('data, submitted_by, status')
        .eq('id', submissionId)
        .single();

      if (!existing || existing.submitted_by !== user.id || existing.status !== 'pending') {
        throw createError({ statusCode: 409, statusMessage: 'Submission state changed during upload' });
      }

      const currentData = (existing?.data as Record<string, unknown>) || {};
      const currentFiles = (currentData.uploadedFiles as any[]) || [];
      const newFiles = uploadedPaths.map((url) => ({ url, category }));

      await supabase
        .from('submission_queue')
        .update({
          data: {
            ...currentData,
            uploadedFiles: [...currentFiles, ...newFiles],
          },
        })
        .eq('id', submissionId)
        .eq('submitted_by', user.id)
        .eq('status', 'pending');
    }

    return { ok: true, paths: uploadedPaths };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error uploading archive file:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error uploading archive file: ${error.message || 'Unknown error'}`,
    });
  }
});
