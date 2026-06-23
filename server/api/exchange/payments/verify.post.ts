/**
 * POST /api/exchange/payments/verify
 *
 * Thin web proxy for the listing-payment success page. Forwards the caller's
 * Supabase access token + { sessionId } to the `verify-listing-payment` Edge
 * Function (webhook-lag fallback that marks the listing(s) paid if the session
 * is paid). Mirrors the checkout proxy; no Stripe here.
 *
 *   body: { sessionId: string }
 *   returns: { verified, listingIds?, recorded? } | { verified: false, paymentStatus }
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const body = await readBody<{ sessionId?: string }>(event);
  if (!body?.sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'sessionId required' });
  }

  try {
    return await $fetch(`${supabaseUrl}/functions/v1/verify-listing-payment`, {
      method: 'POST',
      headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
      body: { sessionId: body.sessionId },
    });
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message =
      error?.data?.error || error?.statusMessage || error?.data?.statusMessage || 'Could not verify payment';
    console.error('[exchange/payments/verify] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
