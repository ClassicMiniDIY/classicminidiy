/**
 * DELETE /api/exchange/external-listings/[id]
 *
 * Delete a Find (external listing). Mirrors wanted/[id].delete auth, but a HARD
 * delete (Finds have no conversation cascade to preserve). Submitters may delete
 * only their own PENDING submission (matches RLS); admins may delete any.
 */
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';

const rateLimitMiddleware = createRateLimitMiddleware({ ...RateLimitPresets.moderate, keyPrefix: 'finds-delete' });

export default defineEventHandler(async (event) => {
  await rateLimitMiddleware(event);

  try {
    const { user } = await requireUserClient(event);
    const supabase = getServiceClient();

    const findId = getRouterParam(event, 'id');
    if (!findId) throw createError({ statusCode: 400, message: 'Find ID is required' });

    const { data: find, error: fetchError } = await supabase
      .from('external_listings')
      .select('id, submitted_by, status')
      .eq('id', findId)
      .single();

    if (fetchError || !find) throw createError({ statusCode: 404, message: 'Find not found' });

    const { data: profile } = await supabase.from('profile_private').select('is_admin').eq('user_id', user.id).single();
    const isAdmin = profile?.is_admin === true;
    const isOwner = find.submitted_by === user.id;

    // Owner may delete only their own pending submission; admin may delete any.
    if (!isAdmin && !(isOwner && find.status === 'pending')) {
      throw createError({ statusCode: 403, message: 'You do not have permission to delete this find' });
    }

    const { error: deleteError } = await supabase.from('external_listings').delete().eq('id', findId);
    if (deleteError) {
      console.error('Error deleting find:', deleteError);
      throw createError({ statusCode: 500, message: deleteError.message });
    }

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Error deleting find:', error);
    throw createError({ statusCode: 500, message: 'Failed to delete find' });
  }
});
