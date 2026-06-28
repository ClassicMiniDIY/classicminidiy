import { sanitizeUserInput } from '../../utils/exchange/sanitize';
import { moderateMessage } from '../../utils/exchange/contentFilter';
import { checkRateLimit } from '../../utils/exchange/rateLimit';
import { getServiceClient } from '../../utils/supabase';
import { queueNotification, buildBatchKey } from '../../utils/exchange/notificationQueue';

export default defineEventHandler(async (event) => {
  try {
    // Rate limiting: 3 emails per IP per hour.
    // Prefer the provider-set 'x-real-ip' header (set by the Vercel edge proxy
    // and not client-spoofable) before falling back to the left-most
    // 'x-forwarded-for' entry, which IS client-controllable and would otherwise
    // let an attacker rotate the header to dodge the limit. Same approach as
    // server/middleware/rate-limit.ts.
    const ip = getHeader(event, 'x-real-ip') || getRequestIP(event, { xForwardedFor: true }) || 'unknown';
    const rateLimit = checkRateLimit(ip, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      keyPrefix: 'contact-seller',
    });

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000 / 60);
      throw createError({
        statusCode: 429,
        message: `Too many contact requests. Please try again in ${retryAfter} minutes.`,
      });
    }

    // Parse request body
    const body = await readBody(event);
    const { listingId, name, email, message, honeypot } = body;

    // Honeypot field check (catches bots)
    if (honeypot) {
      console.warn('Honeypot field filled - potential spam bot detected from IP:', ip);
      // Return success to not alert the bot
      return { success: true };
    }

    // Validate required fields
    if (!listingId) {
      throw createError({
        statusCode: 400,
        message: 'Listing information is missing. Please refresh the page and try again.',
      });
    }

    if (!name || !name.trim()) {
      throw createError({
        statusCode: 400,
        message: 'Please enter your name.',
      });
    }

    if (!email || !email.trim()) {
      throw createError({
        statusCode: 400,
        message: 'Please enter your email address.',
      });
    }

    if (!message || !message.trim()) {
      throw createError({
        statusCode: 400,
        message: 'Please enter a message.',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        message: 'Please enter a valid email address (e.g., you@example.com).',
      });
    }

    // Validate field lengths
    if (name.length > 100) {
      throw createError({
        statusCode: 400,
        message: `Your name is too long. Please use ${100 - name.length} fewer characters.`,
      });
    }

    if (message.length < 10) {
      throw createError({
        statusCode: 400,
        message: `Your message is too short. Please add at least ${10 - message.length} more characters.`,
      });
    }

    if (message.length > 2000) {
      throw createError({
        statusCode: 400,
        message: `Your message is too long. Please remove ${message.length - 2000} characters.`,
      });
    }

    // Sanitize inputs (prevent XSS)
    const sanitizedName = sanitizeUserInput(name);
    const sanitizedEmail = sanitizeUserInput(email);
    const sanitizedMessage = sanitizeUserInput(message);

    // Check for profanity and inappropriate content
    const nameModeration = moderateMessage(sanitizedName);
    const messageModeration = moderateMessage(sanitizedMessage);

    if (!nameModeration.isClean && nameModeration.issues.includes('profanity')) {
      throw createError({
        statusCode: 400,
        message: 'Your name contains inappropriate language. Please use a different name.',
      });
    }

    if (!messageModeration.isClean) {
      // Provide specific feedback based on what was detected
      if (messageModeration.issues.includes('profanity')) {
        throw createError({
          statusCode: 400,
          message: 'Your message contains inappropriate language. Please revise your message.',
        });
      }

      if (messageModeration.issues.includes('phone_number')) {
        throw createError({
          statusCode: 400,
          message:
            'Please do not include phone numbers in your message. The seller will contact you via email after receiving your inquiry.',
        });
      }

      if (messageModeration.issues.includes('email')) {
        throw createError({
          statusCode: 400,
          message:
            'Please do not include email addresses in your message. Your email is automatically shared with the seller.',
        });
      }

      if (messageModeration.issues.includes('external_url')) {
        throw createError({
          statusCode: 400,
          message:
            'Your message contains external links. Please limit URLs to 2 or remove them entirely. The seller will contact you directly.',
        });
      }

      if (messageModeration.issues.includes('social_media')) {
        throw createError({
          statusCode: 400,
          message: 'Please do not include social media handles in your message. The seller will contact you via email.',
        });
      }
    }

    // Check for spam patterns (excessive URLs, etc.)
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const urlMatches = sanitizedMessage.match(urlPattern) || [];
    if (urlMatches.length > 2) {
      throw createError({
        statusCode: 400,
        message: `Your message contains ${urlMatches.length} links. Please limit to 2 URLs maximum.`,
      });
    }

    // Fetch listing and seller information
    const supabase = getServiceClient();
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(
        `
        id,
        title,
        slug,
        user_id,
        profiles:user_id (
          email
        )
      `
      )
      .eq('id', listingId)
      .eq('status', 'active')
      .single();

    if (listingError || !listing) {
      throw createError({
        statusCode: 404,
        message: 'This listing is no longer available. It may have been sold or removed. Please browse other listings.',
      });
    }

    // Check if seller has email
    if (!listing.profiles?.email) {
      throw createError({
        statusCode: 400,
        message:
          'Unable to contact this seller at the moment. Please try the messaging system if you have an account, or try again later.',
      });
    }

    // Email the seller via notification_queue + process-notifications (SES).
    // Recipient = the listing owner; the buyer's email is surfaced in the body
    // (the queue send path has no per-email Reply-To). Unique batch key per
    // inquiry so concurrent inquiries never collapse into one. Fire-and-forget.
    const inquiryId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await queueNotification({
      userId: listing.user_id,
      eventType: 'seller_inquiry',
      payload: {
        listingTitle: listing.title,
        listingSlug: listing.slug,
        inquirerName: sanitizedName,
        inquirerEmail: sanitizedEmail,
        message: sanitizedMessage,
      },
      batchKey: buildBatchKey('seller_inquiry', { inquiryId }),
    });

    return {
      success: true,
      message: 'Your message has been sent to the seller!',
    };
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error;
    }

    // Log unexpected errors
    console.error('Contact seller error:', error);

    throw createError({
      statusCode: 500,
      message:
        'An unexpected error occurred while sending your message. Please refresh the page and try again, or create an account to use our messaging system.',
    });
  }
});
