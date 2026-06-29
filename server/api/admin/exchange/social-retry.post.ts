/**
 * POST /api/admin/exchange/social-retry
 *
 * Admin endpoint to retry social-media posting for a specific listing, for only
 * the failed platform(s) — Facebook, Instagram, and/or Bluesky. Consumed by the
 * promotions admin page (app/pages/admin/exchange/promotions.vue).
 *
 * Thin proxy to the `post-listing-social` Supabase edge function (single mode).
 * The social-posting logic — Meta/Bluesky APIs + image processing — moved to that
 * Deno edge function so the heavy `@atproto/api` + `sharp` deps stay out of the
 * Vercel serverless bundle (mirrors the email/Stripe convergence). Auth is the
 * admin's session here (requireAdminAuth); the edge fn is reached with the
 * service-role bearer it requires.
 *
 *   body: { listingId: string, platforms: ('facebook'|'instagram'|'bluesky')[] }
 *   returns: { success, results, allSucceeded }
 */
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  // Throws 401 (not signed in) / 403 (not admin).
  await requireAdminAuth(event);
  const config = useRuntimeConfig();

  const body = await readBody(event);
  const { listingId, platforms } = body as {
    listingId: string;
    platforms: ('facebook' | 'instagram' | 'bluesky')[];
  };

  if (!listingId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing listingId' });
  }
  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid platforms array' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const serviceKey = config.SUPABASE_SERVICE_KEY as string;
  if (!supabaseUrl || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' });
  }

  try {
    return await $fetch(`${supabaseUrl}/functions/v1/post-listing-social`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: config.public.supabaseKey as string,
        'content-type': 'application/json',
      },
      body: { listingId, platforms },
    });
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message = error?.data?.error || error?.statusMessage || 'Failed to retry social posting';
    console.error('[social-retry] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
