import { sanitizeUserInput } from '../../../utils/exchange/sanitize';
import { moderateMessage } from '../../../utils/exchange/contentFilter';
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';
import { VALID_CATEGORIES, VALID_CONDITION_PREFERENCES, MAX_CONTENT_LENGTH } from '~/utils/constants';
import { validateBudgetValue, validateBudgetRange } from '../../../utils/exchange/validators';
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { queueAdminNotification } from '../../../utils/exchange/notificationQueue';

// Rate limit: 3 requests per 15 minutes (strict preset)
const rateLimitMiddleware = createRateLimitMiddleware({
  ...RateLimitPresets.strict,
  keyPrefix: 'wanted-create',
});

export default defineEventHandler(async (event) => {
  // Apply rate limiting
  await rateLimitMiddleware(event);

  try {
    // Verify authentication
    const { user } = await requireUserClient(event);

    const supabase = getServiceClient();

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

    // Validate required fields
    if (!title || !description || !category) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields: title, description, and category',
      });
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      throw createError({
        statusCode: 400,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    // Validate parts subcategory is provided when category is 'parts'
    if (category === 'parts' && !partsSubcategory) {
      throw createError({
        statusCode: 400,
        message: 'Parts subcategory is required when category is parts',
      });
    }

    // Validate condition preference if provided
    if (conditionPreference !== undefined && !VALID_CONDITION_PREFERENCES.includes(conditionPreference)) {
      throw createError({
        statusCode: 400,
        message: `Invalid condition preference. Must be one of: ${VALID_CONDITION_PREFERENCES.join(', ')}`,
      });
    }

    // Sanitize text inputs
    const sanitizedTitle = sanitizeUserInput(title);
    const sanitizedDescription = sanitizeUserInput(description);
    const sanitizedCity = city ? sanitizeUserInput(city) : null;
    const sanitizedStateProvince = stateProvince ? sanitizeUserInput(stateProvince) : null;
    const sanitizedCountry = country ? sanitizeUserInput(country) : null;

    // Validate lengths after sanitization
    if (sanitizedTitle.length === 0 || sanitizedTitle.length > 200) {
      throw createError({
        statusCode: 400,
        message: 'Title must be between 1 and 200 characters',
      });
    }

    if (sanitizedDescription.length === 0 || sanitizedDescription.length > MAX_CONTENT_LENGTH) {
      throw createError({
        statusCode: 400,
        message: `Description must be between 1 and ${MAX_CONTENT_LENGTH} characters`,
      });
    }

    // Run content moderation on title and description
    const titleModeration = moderateMessage(sanitizedTitle);
    const descriptionModeration = moderateMessage(sanitizedDescription);

    // Determine overall moderation status (worst of the two)
    const isFlagged =
      titleModeration.moderationStatus === 'flagged' || descriptionModeration.moderationStatus === 'flagged';
    const moderationIssues = [...new Set([...titleModeration.issues, ...descriptionModeration.issues])];

    // Check if user is banned
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_banned, display_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw createError({
        statusCode: 404,
        message: 'User profile not found',
      });
    }

    if (profile.is_banned) {
      throw createError({
        statusCode: 403,
        message: 'Your account has been suspended. You cannot create wanted posts.',
      });
    }

    // Validate budget range
    validateBudgetValue(budgetMin, 'Minimum budget');
    validateBudgetValue(budgetMax, 'Maximum budget');
    validateBudgetRange(budgetMin, budgetMax);

    // Insert the wanted post
    const { data: post, error: insertError } = await supabase
      .from('wanted_posts')
      .insert({
        user_id: user.id,
        title: sanitizedTitle,
        description: sanitizedDescription,
        category,
        parts_subcategory: category === 'parts' ? partsSubcategory : null,
        condition_preference: conditionPreference || 'any',
        budget_min: budgetMin ?? null,
        budget_max: budgetMax ?? null,
        currency: currency || 'USD',
        city: sanitizedCity,
        state_province: sanitizedStateProvince,
        country: sanitizedCountry,
        status: isFlagged ? 'flagged' : 'active',
        moderation_status: isFlagged ? 'flagged' : 'approved',
        moderation_issues: moderationIssues.length > 0 ? moderationIssues : null,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error inserting wanted post:', insertError);
      throw createError({
        statusCode: 500,
        message: 'Failed to create wanted post',
      });
    }

    // Notify admins of the pending wanted post (batched digest, flags content
    // -moderation hits). Fire-and-forget; never blocks the create response.
    await queueAdminNotification({
      eventType: 'admin_wanted_pending',
      payload: {
        postTitle: sanitizedTitle,
        posterName: profile.display_name || 'a member',
        isFlagged,
      },
    });

    return {
      success: true,
      post,
      flagged: isFlagged,
    };
  } catch (error: any) {
    // Re-throw if it's already an H3 error (from createError)
    if (error.statusCode) {
      throw error;
    }

    console.error('Error creating wanted post:', error);

    throw createError({
      statusCode: 500,
      message: 'Failed to create wanted post',
    });
  }
});
