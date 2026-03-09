import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { uuid, details } = body;

  if (!uuid || typeof uuid !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or missing uuid' });
  }

  if (!details || !details.name) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or missing color details' });
  }

  // Fetch the original submission to determine type and target
  const { data: submission, error: fetchError } = await supabase
    .from('submission_queue')
    .select('type, target_id, data')
    .eq('id', uuid)
    .single();

  if (fetchError || !submission) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' });
  }

  // Map uploaded files to swatch_path and contributor_images based on category
  const uploadedFiles = details.uploadedFiles || submission.data?.uploadedFiles || [];
  let swatchPath = details.imageSwatch || details.swatch_path || null;
  const contributorImages: { url: string; contributor?: string }[] = details.images || details.contributor_images || [];

  for (const file of uploadedFiles) {
    const fileObj = typeof file === 'string' ? { url: file, category: 'general' } : file;
    if (fileObj.category === 'swatch' && !swatchPath) {
      swatchPath = fileObj.url;
    } else if (fileObj.category === 'car-photos' || fileObj.category === 'general') {
      contributorImages.push({ url: fileObj.url, contributor: details.submittedBy || null });
    }
  }

  const colorData = {
    name: details.name,
    code: details.code || '',
    short_code: details.shortCode || details.short_code || '',
    ditzler_ppg_code: details.ditzlerPpgCode || details.ditzler_ppg_code || '',
    dulux_code: details.duluxCode || details.dulux_code || '',
    hex_value: details.primaryColor || details.hex_value || details.hexValue || '',
    has_swatch: !!swatchPath || details.hasSwatch || details.has_swatch || false,
    swatch_path: swatchPath,
    contributor_images: contributorImages,
    status: 'approved',
  };

  if (submission.type === 'edit_suggestion' && submission.target_id) {
    // UPDATE the existing color instead of inserting a new one
    const { error: colorError } = await supabase.from('colors').update(colorData).eq('id', submission.target_id);

    if (colorError) {
      throw createError({ statusCode: 500, statusMessage: colorError.message });
    }
  } else {
    // INSERT a new color for new_item submissions
    const { error: colorError } = await supabase.from('colors').insert({
      ...colorData,
      legacy_submitted_by: details.submittedBy || details.legacy_submitted_by || null,
      legacy_submitted_by_email: details.submittedByEmail || details.legacy_submitted_by_email || null,
    });

    if (colorError) {
      throw createError({ statusCode: 500, statusMessage: colorError.message });
    }
  }

  // Update submission queue status to approved
  const { error: queueError } = await supabase
    .from('submission_queue')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      data: details,
    })
    .eq('id', uuid);

  if (queueError) {
    console.error('Queue update failed after color approval:', queueError);
  }

  return { success: true, message: 'Color has been approved', colorId: uuid };
});
