import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const supabase = getServiceClient();

  try {
    const { uuid } = await readBody<{
      uuid: string;
      details?: any;
    }>(event);

    if (!uuid) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required uuid' });
    }

    const { error } = await supabase
      .from('submission_queue')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', uuid);

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error rejecting registry queue item:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error rejecting registry queue item: ${error.message || 'Unknown error'}`,
    });
  }
});
