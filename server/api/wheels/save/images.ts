import { getServiceClient } from '../../../utils/supabase';

export default defineEventHandler(async (event) => {
  const params = getQuery(event);
  const uuid = params.uuid?.toString();

  if (!uuid) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required uuid parameter' });
  }

  const supabase = getServiceClient();

  try {
    // Use h3's built-in multipart form data parser
    const formData = await readMultipartFormData(event);

    if (!formData || formData.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No files uploaded' });
    }

    const uploadedPaths: string[] = [];

    for (const file of formData) {
      if (!file.data || !file.filename) continue;

      const storagePath = `uploads/${uuid}/${file.filename}`;

      const { error } = await supabase.storage.from('archive-wheels').upload(storagePath, file.data, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

      if (error) {
        console.error(`Error uploading file ${file.filename}:`, error);
        throw createError({ statusCode: 500, statusMessage: `Upload failed: ${error.message}` });
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage.from('archive-wheels').getPublicUrl(storagePath);

      uploadedPaths.push(urlData.publicUrl);
    }

    // Update the submission queue entry with new photo paths
    if (uploadedPaths.length > 0) {
      const { data: existing } = await supabase.from('submission_queue').select('data').eq('id', uuid).single();

      const currentData = existing?.data || {};
      const currentPhotos = currentData.images || currentData.photos || [];

      await supabase
        .from('submission_queue')
        .update({
          data: {
            ...currentData,
            images: [...currentPhotos, ...uploadedPaths],
          },
        })
        .eq('id', uuid);
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
