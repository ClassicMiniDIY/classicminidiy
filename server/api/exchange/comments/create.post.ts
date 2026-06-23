import { sanitizeCommentContent } from '../../../utils/exchange/sanitize';
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';
import { queueNotification, buildBatchKey } from '../../../utils/exchange/notificationQueue';
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';

// Rate limit: 10 comments per minute
const rateLimitMiddleware = createRateLimitMiddleware({
  ...RateLimitPresets.moderate,
  keyPrefix: 'comment-create',
});

export default defineEventHandler(async (event) => {
  // Apply rate limiting
  await rateLimitMiddleware(event);

  try {
    const { user } = await requireUserClient(event);
    const supabase = getServiceClient();

    // Get request body
    const body = await readBody(event);
    const { listingId, externalListingId, content, parentId, isQuestion } = body;

    if (!content) {
      throw createError({
        statusCode: 400,
        message: 'Missing required field: content',
      });
    }

    if (!listingId && !externalListingId) {
      throw createError({
        statusCode: 400,
        message: 'Either listingId or externalListingId is required',
      });
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeCommentContent(content);

    // Validate content length after sanitization
    if (sanitizedContent.length === 0 || sanitizedContent.length > 2000) {
      throw createError({
        statusCode: 400,
        message: 'Comment must be between 1 and 2000 characters',
      });
    }

    if (externalListingId) {
      // Verify external listing exists and is approved
      const { data: externalListing, error: externalError } = await supabase
        .from('external_listings')
        .select('id, status')
        .eq('id', externalListingId)
        .single();

      if (externalError || !externalListing) {
        throw createError({
          statusCode: 404,
          message: 'External listing not found',
        });
      }

      if (externalListing.status !== 'approved') {
        throw createError({
          statusCode: 400,
          message: 'Cannot comment on unapproved listings',
        });
      }
    } else {
      // Verify listing exists
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id, user_id, status')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) {
        throw createError({
          statusCode: 404,
          message: 'Listing not found',
        });
      }

      // Don't allow comments on inactive listings
      if (listing.status !== 'active') {
        throw createError({
          statusCode: 400,
          message: 'Cannot comment on inactive listings',
        });
      }
    }

    // If parentId provided, verify parent comment exists
    if (parentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('listing_comments')
        .select('id, listing_id, external_listing_id')
        .eq('id', parentId)
        .single();

      if (parentError || !parentComment) {
        throw createError({
          statusCode: 404,
          message: 'Parent comment not found',
        });
      }

      // Verify parent comment is on the same listing/external listing
      if (externalListingId) {
        if (parentComment.external_listing_id !== externalListingId) {
          throw createError({
            statusCode: 400,
            message: 'Parent comment is not on this listing',
          });
        }
      } else {
        if (parentComment.listing_id !== listingId) {
          throw createError({
            statusCode: 400,
            message: 'Parent comment is not on this listing',
          });
        }
      }
    }

    // Create the comment with sanitized content
    const insertData: Record<string, any> = {
      user_id: user.id,
      parent_id: parentId || null,
      content: sanitizedContent,
      is_question: isQuestion || false,
      moderation_status: 'approved', // Auto-approve for now
    };

    if (externalListingId) {
      insertData.external_listing_id = externalListingId;
    } else {
      insertData.listing_id = listingId;
    }

    const { data: newComment, error: insertError } = await supabase
      .from('listing_comments')
      .insert(insertData)
      .select(
        `
        id,
        listing_id,
        user_id,
        parent_id,
        content,
        is_question,
        is_seller_response,
        is_flagged,
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
      .single();

    if (insertError) {
      throw createError({
        statusCode: 500,
        message: insertError.message,
      });
    }

    // Fire-and-forget: queue notification for comment/reply
    try {
      const commenterName = (newComment?.user as any)?.display_name || 'Someone';
      const commentPreview = sanitizedContent.slice(0, 200);

      // Fetch listing title and slug for email links
      let listingTitle = '';
      let listingSlug = '';
      if (listingId) {
        const { data: listingInfo } = await supabase
          .from('listings')
          .select('user_id, title, slug')
          .eq('id', listingId)
          .single();

        if (listingInfo) {
          listingTitle = listingInfo.title || '';
          listingSlug = listingInfo.slug || '';

          if (parentId) {
            // It's a reply — notify the parent comment author
            const { data: parentComment } = await supabase
              .from('listing_comments')
              .select('user_id')
              .eq('id', parentId)
              .single();

            if (parentComment && parentComment.user_id !== user.id) {
              await queueNotification({
                userId: parentComment.user_id,
                eventType: 'comment_reply',
                payload: {
                  replierName: commenterName,
                  replyPreview: commentPreview,
                  listingTitle,
                  listingSlug,
                },
                channel: 'email',
                batchKey: buildBatchKey('comment_reply', {
                  parentCommentId: parentId,
                }),
              });
            }
          } else if (listingInfo.user_id !== user.id) {
            // Top-level comment — notify the listing owner
            await queueNotification({
              userId: listingInfo.user_id,
              eventType: 'new_comment',
              payload: {
                commenterName,
                commentPreview,
                listingTitle,
                listingSlug,
              },
              channel: 'email',
              batchKey: buildBatchKey('new_comment', { listingId }),
            });
          }
        }
      }
    } catch (queueErr) {
      // Never let queue failures break comment creation
      console.error('[CommentCreate] Failed to queue notification:', queueErr);
    }

    return {
      comment: newComment,
      success: true,
    };
  } catch (error: any) {
    console.error('Error creating comment:', error);

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create comment',
    });
  }
});
