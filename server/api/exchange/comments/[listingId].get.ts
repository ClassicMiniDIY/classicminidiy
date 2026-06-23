import { getServiceClient } from '../../../utils/supabase';

export default defineEventHandler(async (event) => {
  try {
    const listingId = getRouterParam(event, 'listingId');
    const query = getQuery(event);
    const isExternal = query.type === 'external';
    const limit = Math.min(parseInt(query.limit as string) || 20, 100);
    const offset = parseInt(query.offset as string) || 0;

    if (!listingId) {
      throw createError({
        statusCode: 400,
        message: 'Listing ID is required',
      });
    }

    const supabase = getServiceClient();

    // Fetch comments with user profile information
    // When type=external, listingId param is actually an external_listing_id
    let commentsQuery = supabase
      .from('listing_comments')
      .select(
        `
        id,
        listing_id,
        external_listing_id,
        user_id,
        parent_id,
        content,
        is_question,
        is_seller_response,
        is_flagged,
        moderation_status,
        created_at,
        updated_at,
        user:profiles (
          id,
          display_name,
          avatar_url,
          email
        )
      `
      )
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: true });

    if (isExternal) {
      commentsQuery = commentsQuery.eq('external_listing_id', listingId);
    } else {
      commentsQuery = commentsQuery.eq('listing_id', listingId);
    }

    const { data: comments, error } = await commentsQuery;

    if (error) {
      throw createError({
        statusCode: 500,
        message: error.message,
      });
    }

    // Organize comments into a tree structure (parent comments with their replies)
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create map of all comments
    comments?.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into tree structure
    comments?.forEach((comment) => {
      if (comment.parent_id) {
        // This is a reply
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        }
      } else {
        // This is a root comment
        rootComments.push(commentMap.get(comment.id));
      }
    });

    const total = rootComments.length;
    const paginatedComments = rootComments.slice(offset, offset + limit);

    return {
      comments: paginatedComments,
      total,
      hasMore: offset + limit < total,
    };
  } catch (error: any) {
    console.error('Error fetching comments:', error);

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch comments',
    });
  }
});
