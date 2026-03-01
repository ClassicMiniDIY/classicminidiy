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

  // Insert the approved color into the colors table
  const { error: colorError } = await supabase.from('colors').insert({
    name: details.name,
    code: details.code || '',
    short_code: details.shortCode || '',
    ditzler_ppg_code: details.ditzlerPpgCode || '',
    dulux_code: details.duluxCode || '',
    hex_value: details.primaryColor || '',
    has_swatch: details.hasSwatch || false,
    swatch_path: details.imageSwatch || null,
    contributor_images: details.images || [],
    status: 'approved',
    legacy_submitted_by: details.submittedBy || null,
    legacy_submitted_by_email: details.submittedByEmail || null,
  });

  if (colorError) {
    throw createError({ statusCode: 500, statusMessage: colorError.message });
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
    console.error('Queue update failed after color insert:', queueError);
  }

  return { success: true, message: 'Color has been approved', colorId: uuid };
});
