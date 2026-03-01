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

    if (!body.uuid) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required uuid parameter' });
    }

    const { error } = await supabase
      .from('submission_queue')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', body.uuid);

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    return { response: 'Wheel review item rejected successfully' };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error rejecting wheel review item:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error rejecting wheel review item: ${error.message || 'Unknown error'}`,
    });
  }
});
