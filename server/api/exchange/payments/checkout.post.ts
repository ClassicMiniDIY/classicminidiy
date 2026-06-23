/**
 * POST /api/exchange/payments/checkout
 *
 * Thin web proxy for The Mini Exchange premium-listing checkout. Forwards the
 * caller's Supabase access token to the `create-listing-checkout` Edge Function,
 * which verifies ownership, comps Sustaining Members, and mints a platform
 * Stripe Checkout Session. We never touch Stripe here — the Stripe secret lives
 * only in Supabase (resolves the env-collision the lift-and-shift would have had).
 *
 *   body: { listingId?: string, listingIds?: string[], tier: 'paid', successUrl?, cancelUrl? }
 *   returns: { url, sessionId } | { comped: true }
 *
 * No BotID here: per the documented checkout incident (BotID false-positive-blocked
 * real buyers), the gates are auth (Bearer required) + the edge function's
 * ownership/member validation + Stripe. Mirrors server/api/models/[modelId]/checkout.post.ts.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to start checkout' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const body = await readBody<{
    listingId?: string;
    listingIds?: string[];
    tier?: string;
    successUrl?: string;
    cancelUrl?: string;
  }>(event);

  const hasSingle = typeof body?.listingId === 'string' && body.listingId.length > 0;
  const hasBulk = Array.isArray(body?.listingIds) && body.listingIds.length > 0;
  if (!hasSingle && !hasBulk) {
    throw createError({ statusCode: 400, statusMessage: 'listingId or listingIds required' });
  }
  if ((body?.tier ?? 'paid') !== 'paid') {
    throw createError({ statusCode: 400, statusMessage: 'Only the paid tier requires checkout' });
  }

  try {
    const res = await $fetch<{ url?: string; sessionId?: string; comped?: boolean }>(
      `${supabaseUrl}/functions/v1/create-listing-checkout`,
      {
        method: 'POST',
        headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
        body: {
          ...(hasBulk ? { listingIds: body.listingIds } : { listingId: body.listingId }),
          tier: 'paid',
          ...(body?.successUrl ? { successUrl: body.successUrl } : {}),
          ...(body?.cancelUrl ? { cancelUrl: body.cancelUrl } : {}),
        },
      }
    );

    // Sustaining Member comp: no Stripe redirect needed.
    if (res?.comped) return { comped: true };

    if (!res?.url) {
      throw createError({ statusCode: 502, statusMessage: 'Checkout session did not return a URL' });
    }
    return { url: res.url, sessionId: res.sessionId };
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message =
      error?.data?.error || error?.statusMessage || error?.data?.statusMessage || 'Could not start checkout';
    console.error('[exchange/payments/checkout] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
