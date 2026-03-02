import { getServiceClient } from '../../utils/supabase';

const ALLOWED_BUCKETS = ['archive-documents', 'archive-thumbnails', 'archive-colors', 'archive-wheels'] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

interface BucketConfig {
  allowedTypes: string[];
  maxSizeBytes: number;
}

const BUCKET_CONFIGS: Record<AllowedBucket, BucketConfig> = {
  'archive-documents': {
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
  },
  'archive-thumbnails': {
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
  },
  'archive-colors': {
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
  },
  'archive-wheels': {
    allowedTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 3 * 1024 * 1024, // 3MB
  },
};

export default defineEventHandler(async (event) => {
  const params = getQuery(event);
  const bucket = params.bucket?.toString();
  const submissionId = params.submissionId?.toString();

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

  try {
    const formData = await readMultipartFormData(event);

    if (!formData || formData.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No files uploaded' });
    }

    const uploadedPaths: string[] = [];

    for (const file of formData) {
      if (!file.data || !file.filename) continue;

      // Validate file type
      const fileType = file.type || 'application/octet-stream';
      if (!config.allowedTypes.includes(fileType)) {
        throw createError({
          statusCode: 400,
          statusMessage: `File type "${fileType}" is not allowed for bucket "${bucket}". Allowed types: ${config.allowedTypes.join(', ')}`,
        });
      }

      // Validate file size
      if (file.data.length > config.maxSizeBytes) {
        const maxMB = config.maxSizeBytes / (1024 * 1024);
        throw createError({
          statusCode: 400,
          statusMessage: `File "${file.filename}" exceeds the maximum size of ${maxMB}MB for bucket "${bucket}"`,
        });
      }

      const storagePath = `uploads/${submissionId}/${file.filename}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file.data, {
          contentType: fileType,
          upsert: true,
        });

      if (error) {
        console.error(`Error uploading file ${file.filename}:`, error);
        throw createError({ statusCode: 500, statusMessage: `Upload failed: ${error.message}` });
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      uploadedPaths.push(urlData.publicUrl);
    }

    // Update the submission queue entry with new file paths
    if (uploadedPaths.length > 0) {
      const { data: existing } = await supabase
        .from('submission_queue')
        .select('data')
        .eq('id', submissionId)
        .single();

      const currentData = (existing?.data as Record<string, unknown>) || {};
      const currentFiles = (currentData.uploadedFiles as string[]) || [];

      await supabase
        .from('submission_queue')
        .update({
          data: {
            ...currentData,
            uploadedFiles: [...currentFiles, ...uploadedPaths],
          },
        })
        .eq('id', submissionId);
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
