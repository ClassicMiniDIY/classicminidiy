/**
 * POST /api/discord/reissue
 *
 * Self-serve Discord claim proxy (keystone §5.3). Forwards the caller's
 * Supabase access token to the `discord-claim-reissue` Edge Function, which
 * verifies the paid Sustaining Membership, rotates the claim jti, and returns
 * either the fresh claim URL (status 'pending') or the guild deep link when
 * the member is already connected (status 'active'). /discord/connect
 * redirects the browser to the claim URL, re-entering the normal
 * /discord/claim?token= → Discord OAuth chain.
 *
 * The client must be signed in: it sends `Authorization: Bearer <access token>`
 * — same pattern as /api/membership/checkout.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to claim Discord access' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  try {
    const res = await $fetch<{ status?: string; claim_url?: string; discord_url?: string }>(
      `${supabaseUrl}/functions/v1/discord-claim-reissue`,
      {
        method: 'POST',
        headers: {
          authorization,
          apikey: supabaseKey,
        },
      }
    );

    if (res?.status !== 'active' && res?.status !== 'pending') {
      throw createError({ statusCode: 502, statusMessage: 'Discord claim did not return a usable state' });
    }

    return res;
  } catch (error: any) {
    // Preserve the Edge Function's status (403 not_active drives the page's
    // membership upsell state) but never leak its raw error body.
    const status = error?.statusCode || error?.response?.status || 502;
    const message =
      status === 403
        ? 'An active Sustaining Membership is required to join the members-only Discord'
        : error?.statusMessage || 'Could not start the Discord claim';
    console.error('[discord/reissue] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
