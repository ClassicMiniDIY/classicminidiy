import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const supabase = getServiceClient();

  try {
    const { uuid, details } = await readBody<{
      uuid: string;
      issueNumber?: string | number;
      details: any;
    }>(event);

    if (!uuid || !details) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required uuid or details' });
    }

    // Update submission status to approved
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
      throw createError({ statusCode: 500, statusMessage: queueError.message });
    }

    // Insert the approved registry entry into the registry_entries table
    const { error: regError } = await supabase.from('registry_entries').insert({
      year: details.year || 0,
      model: details.model || '',
      body_number: details.bodyNum || '',
      engine_number: details.engineNum || '',
      engine_size: details.engineSize || null,
      body_type: details.bodyType || null,
      color: details.color || null,
      trim: details.trim || null,
      build_date: details.buildDate || null,
      owner: details.submittedBy || null,
      location: details.location || null,
      notes: details.notes || null,
      status: 'approved',
      legacy_submitted_by: details.submittedBy || null,
      legacy_submitted_by_email: details.submittedByEmail || null,
    });

    if (regError) {
      throw createError({ statusCode: 500, statusMessage: regError.message });
    }

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error saving registry info:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error saving registry info: ${error.message || 'Unknown error'}`,
    });
  }
});
