import { requireUserClient } from '../../../../utils/userAuth';
import { getServiceClient } from '../../../../utils/supabase';

export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireUserClient(event);
    const supabase = getServiceClient();

    const commentId = getRouterParam(event, 'id');

    if (!commentId) {
      throw createError({
        statusCode: 400,
        message: 'Comment ID is required',
      });
    }

    // Get user profile to check admin status
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();

    // Verify comment exists and check ownership
    const { data: comment, error: fetchError } = await supabase
      .from('listing_comments')
      .select('id, user_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      throw createError({
        statusCode: 404,
        message: 'Comment not found',
      });
    }

    // Only comment owner or admin can delete
    const isOwner = comment.user_id === user.id;
    const isAdmin = profile?.is_admin === true;

    if (!isOwner && !isAdmin) {
      throw createError({
        statusCode: 403,
        message: 'You do not have permission to delete this comment',
      });
    }

    // Delete the comment (cascade will delete replies)
    const { error: deleteError } = await supabase.from('listing_comments').delete().eq('id', commentId);

    if (deleteError) {
      throw createError({
        statusCode: 500,
        message: deleteError.message,
      });
    }

    return {
      success: true,
      message: 'Comment deleted successfully',
    };
  } catch (error: any) {
    console.error('Error deleting comment:', error);

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to delete comment',
    });
  }
});
