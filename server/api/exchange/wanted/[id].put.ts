import { sanitizeUserInput } from '../../../utils/exchange/sanitize';
import { moderateMessage } from '../../../utils/exchange/contentFilter';
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';
import { VALID_CATEGORIES, VALID_CONDITION_PREFERENCES, MAX_CONTENT_LENGTH } from '~/utils/constants';
import { validateBudgetValue, validateBudgetRange } from '../../../utils/exchange/validators';
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';

// Rate limit: 10 requests per 1 minute (moderate preset)
const rateLimitMiddleware = createRateLimitMiddleware({
  ...RateLimitPresets.moderate,
  keyPrefix: 'wanted-update',
});

export default defineEventHandler(async (event) => {
  // Apply rate limiting
  await rateLimitMiddleware(event);

  try {
    // Verify authentication
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

    // Get request body
    const body = await readBody(event);
    const {
      title,
      description,
      category,
      partsSubcategory,
      conditionPreference,
      budgetMin,
      budgetMax,
      currency,
      city,
      stateProvince,
      country,
    } = body;

    // Fetch the existing wanted post to verify ownership
    const { data: existingPost, error: fetchError } = await supabase
      .from('wanted_posts')
      .select('id, user_id, status, moderation_status, budget_min, budget_max')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      throw createError({
        statusCode: 404,
        message: 'Wanted post not found',
      });
    }

    // Check if user is admin
    const { data: profile } = await supabase.from('profiles').select('is_admin, is_banned').eq('id', user.id).single();

    const isOwner = existingPost.user_id === user.id;
    const isAdmin = profile?.is_admin === true;

    // Verify ownership or admin access
    if (!isOwner && !isAdmin) {
      throw createError({
        statusCode: 403,
        message: 'You do not have permission to update this wanted post',
      });
    }

    // Check if user is banned
    if (profile?.is_banned) {
      throw createError({
        statusCode: 403,
        message: 'Your account has been suspended. You cannot update wanted posts.',
      });
    }

    // Build the update object with only provided fields
    const updateData: Record<string, any> = {};
    let allModerationIssues: string[] = [];
    let isFlagged = false;

    // Sanitize and validate title if provided
    if (title !== undefined) {
      const sanitizedTitle = sanitizeUserInput(title);
      if (sanitizedTitle.length === 0 || sanitizedTitle.length > 200) {
        throw createError({
          statusCode: 400,
          message: 'Title must be between 1 and 200 characters',
        });
      }
      const titleModeration = moderateMessage(sanitizedTitle);
      if (titleModeration.moderationStatus === 'flagged') {
        isFlagged = true;
      }
      allModerationIssues.push(...titleModeration.issues);
      updateData.title = sanitizedTitle;
    }

    // Sanitize and validate description if provided
    if (description !== undefined) {
      const sanitizedDescription = sanitizeUserInput(description);
      if (sanitizedDescription.length === 0 || sanitizedDescription.length > MAX_CONTENT_LENGTH) {
        throw createError({
          statusCode: 400,
          message: `Description must be between 1 and ${MAX_CONTENT_LENGTH} characters`,
        });
      }
      const descriptionModeration = moderateMessage(sanitizedDescription);
      if (descriptionModeration.moderationStatus === 'flagged') {
        isFlagged = true;
      }
      allModerationIssues.push(...descriptionModeration.issues);
      updateData.description = sanitizedDescription;
    }

    // Validate and set category if provided
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        throw createError({
          statusCode: 400,
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
      }
      updateData.category = category;

      // Handle parts subcategory when category changes
      if (category === 'parts') {
        // partsSubcategory is required if category is parts
        const subcategory = partsSubcategory ?? body.parts_subcategory;
        if (!subcategory) {
          throw createError({
            statusCode: 400,
            message: 'Parts subcategory is required when category is parts',
          });
        }
        updateData.parts_subcategory = subcategory;
      } else {
        // Clear parts subcategory for non-parts categories
        updateData.parts_subcategory = null;
      }
    } else if (partsSubcategory !== undefined) {
      // Allow updating subcategory without changing category
      updateData.parts_subcategory = partsSubcategory;
    }

    // Validate condition preference if provided
    if (conditionPreference !== undefined) {
      if (!VALID_CONDITION_PREFERENCES.includes(conditionPreference)) {
        throw createError({
          statusCode: 400,
          message: `Invalid condition preference. Must be one of: ${VALID_CONDITION_PREFERENCES.join(', ')}`,
        });
      }
      updateData.condition_preference = conditionPreference;
    }

    // Handle budget fields with range validation
    if (budgetMin !== undefined) {
      validateBudgetValue(budgetMin, 'Minimum budget');
      updateData.budget_min = budgetMin;
    }
    if (budgetMax !== undefined) {
      validateBudgetValue(budgetMax, 'Maximum budget');
      updateData.budget_max = budgetMax;
    }

    // Validate budget range if both are provided or being updated
    if (updateData.budget_min !== undefined && updateData.budget_max !== undefined) {
      validateBudgetRange(updateData.budget_min, updateData.budget_max);
    }

    // Handle currency
    if (currency !== undefined) {
      updateData.currency = currency;
    }

    // Sanitize location fields if provided
    if (city !== undefined) {
      updateData.city = city ? sanitizeUserInput(city) : null;
    }
    if (stateProvince !== undefined) {
      updateData.state_province = stateProvince ? sanitizeUserInput(stateProvince) : null;
    }
    if (country !== undefined) {
      updateData.country = country ? sanitizeUserInput(country) : null;
    }

    // If no fields to update, return early
    if (Object.keys(updateData).length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No fields provided to update',
      });
    }

    // Update moderation status if content was flagged
    if (isFlagged) {
      updateData.status = 'flagged';
      updateData.moderation_status = 'flagged';
      updateData.moderation_issues = [...new Set(allModerationIssues)];
    } else if (existingPost.moderation_status === 'flagged' && (title !== undefined || description !== undefined)) {
      // Content was re-checked and passed moderation — clear the flagged status
      updateData.status = 'active';
      updateData.moderation_status = 'approved';
      updateData.moderation_issues = [];
    }

    // Perform the update
    const { data: updatedPost, error: updateError } = await supabase
      .from('wanted_posts')
      .update(updateData)
      .eq('id', postId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating wanted post:', updateError);
      throw createError({
        statusCode: 500,
        message: 'Failed to update wanted post',
      });
    }

    return {
      success: true,
      post: updatedPost,
      flagged: isFlagged,
    };
  } catch (error: any) {
    // Re-throw if it's already an H3 error (from createError)
    if (error.statusCode) {
      throw error;
    }

    console.error('Error updating wanted post:', error);

    throw createError({
      statusCode: 500,
      message: 'Failed to update wanted post',
    });
  }
});
