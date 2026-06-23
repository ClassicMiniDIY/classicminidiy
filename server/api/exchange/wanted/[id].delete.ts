import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';

// Rate limit: 10 requests per 1 minute (moderate preset)
const rateLimitMiddleware = createRateLimitMiddleware({
  ...RateLimitPresets.moderate,
  keyPrefix: 'wanted-delete',
});

export default defineEventHandler(async (event) => {
  // Apply rate limiting
  await rateLimitMiddleware(event);

  try {
    const { user } = await requireUserClient(event);
    const supabase = getServiceClient();

    // Get the wanted post ID from the route
    const postId = getRouterParam(event, 'id');

    if (!postId) {
      throw createError({
        statusCode: 400,
        message: 'Wanted post ID is required',
      });
    }

    // Fetch the existing wanted post to verify ownership
    const { data: existingPost, error: fetchError } = await supabase
      .from('wanted_posts')
      .select('id, user_id')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      throw createError({
        statusCode: 404,
        message: 'Wanted post not found',
      });
    }

    // Check if user is admin
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();

    const isOwner = existingPost.user_id === user.id;
    const isAdmin = profile?.is_admin === true;

    // Verify ownership or admin access
    if (!isOwner && !isAdmin) {
      throw createError({
        statusCode: 403,
        message: 'You do not have permission to delete this wanted post',
      });
    }

    // Soft delete: update status to 'removed' instead of hard deleting
    // Hard delete would CASCADE to conversations, destroying message history
    const { error: updateError } = await supabase.from('wanted_posts').update({ status: 'removed' }).eq('id', postId);

    if (updateError) {
      console.error('Error removing wanted post:', updateError);
      throw createError({
        statusCode: 500,
        message: updateError.message,
      });
    }

    return {
      success: true,
    };
  } catch (error: any) {
    // Re-throw if it's already an H3 error (from createError)
    if (error.statusCode) {
      throw error;
    }

    console.error('Error deleting wanted post:', error);

    throw createError({
      statusCode: 500,
      message: 'Failed to delete wanted post',
    });
  }
});
