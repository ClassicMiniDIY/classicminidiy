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

    // Verify comment exists
    const { data: comment, error: fetchError } = await supabase
      .from('listing_comments')
      .select('id, user_id, is_flagged')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      throw createError({
        statusCode: 404,
        message: 'Comment not found',
      });
    }

    // Don't allow flagging your own comments
    if (comment.user_id === user.id) {
      throw createError({
        statusCode: 400,
        message: 'You cannot flag your own comments',
      });
    }

    // Update the comment to mark as flagged
    const { error: updateError } = await supabase
      .from('listing_comments')
      .update({
        is_flagged: true,
        moderation_status: 'pending', // Move to pending for admin review
      })
      .eq('id', commentId);

    if (updateError) {
      throw createError({
        statusCode: 500,
        message: updateError.message,
      });
    }

    return {
      success: true,
      message: 'Comment has been flagged for review',
    };
  } catch (error: any) {
    console.error('Error flagging comment:', error);

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to flag comment',
    });
  }
});
