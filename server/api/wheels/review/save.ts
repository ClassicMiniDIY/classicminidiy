import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const supabase = getServiceClient();

  try {
    const body = await readBody(event);

    if (!body || typeof body !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request body' });
    }

    if (!body.wheel?.new?.uuid) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required wheel uuid' });
    }

    const submissionId = body.wheel.new.uuid;
    const wheelData = body.wheel.new;

    // Update submission status to approved
    const { error: queueError } = await supabase
      .from('submission_queue')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (queueError) {
      throw createError({ statusCode: 500, statusMessage: queueError.message });
    }

    // Parse photos from either old format (array of {src} objects) or new format (array of strings)
    const photos = (wheelData.images || wheelData.photos || [])
      .map((img: any) => (typeof img === 'string' ? img : img.src || img.location || ''))
      .filter(Boolean);

    // Insert the approved wheel into the wheels table
    const { error: wheelError } = await supabase.from('wheels').insert({
      name: wheelData.name || '',
      wheel_type: wheelData.type || '',
      size: parseInt(wheelData.size) || 10,
      width: wheelData.width || '',
      offset_value: wheelData.offset || '',
      bolt_pattern: wheelData.boltPattern || null,
      center_bore: wheelData.centerBore || null,
      manufacturer: wheelData.manufacturer || null,
      weight: wheelData.weight || null,
      notes: wheelData.notes || null,
      photos,
      status: 'approved',
      legacy_submitted_by: wheelData.userName || null,
      legacy_submitted_by_email: wheelData.emailAddress || null,
    });

    if (wheelError) {
      throw createError({ statusCode: 500, statusMessage: wheelError.message });
    }

    return { response: 'wheel has been updated' };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error saving approved wheel changes:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error saving approved wheel changes: ${error.message || 'Unknown error'}`,
    });
  }
});
