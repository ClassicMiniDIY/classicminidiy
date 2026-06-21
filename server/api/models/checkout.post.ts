/**
 * POST /api/models/checkout  (keystone §6)
 *
 * Thin web proxy for model purchases and tips. Forwards the caller's Supabase
 * access token to the `create-model-checkout` Edge Function, which validates the
 * model, re-checks the seller gate, resolves the amount, and creates a DIRECT
 * charge Checkout Session on the seller's connected account. We never touch
 * Stripe here — the web only mints the session via the edge function and the
 * client redirects to the returned URL.
 *
 *   body: { modelId, kind: 'purchase'|'tip', amountCents?, successUrl?, cancelUrl? }
 *
 * NOTE: Vercel BotID was intentionally REMOVED from this route. It
 * false-positive-blocked legitimate buyers (403 'Bot detected') at ~100% —
 * zero sales from launch until this was removed — while the identical setup
 * passed on the langgraph chat proxy. Checkout is already gated by auth
 * (Bearer, below), the edge function's model/seller/amount validation,
 * Stripe-hosted payment, and per-IP rate limiting, so BotID here was
 * defense-in-depth, not the primary gate. Do NOT re-add checkBotId() without
 * first confirming (in a real browser, not just curl) that it no longer
 * rejects legitimate traffic.
 *
 * The edge function owns amount/seller/entitlement validation and surfaces
 * actionable error codes (ALREADY_OWNED, SELLER_UNAVAILABLE, AMOUNT_BELOW_MINIMUM
 * …); we preserve its status + message for the UI.
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
    modelId?: string;
    kind?: string;
    amountCents?: number;
    successUrl?: string;
    cancelUrl?: string;
  }>(event);

  const modelId = body?.modelId;
  if (!modelId || typeof modelId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid model id' });
  }

  const kind = body?.kind === 'tip' ? 'tip' : body?.kind === 'purchase' ? 'purchase' : null;
  if (!kind) {
    throw createError({ statusCode: 400, statusMessage: 'kind must be "purchase" or "tip"' });
  }

  // Defense-in-depth on the optional fields before they reach the edge function.
  if (
    body?.amountCents != null &&
    (typeof body.amountCents !== 'number' || !Number.isSafeInteger(body.amountCents) || body.amountCents < 0)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'amountCents must be a non-negative integer' });
  }
  if (body?.successUrl != null && typeof body.successUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'successUrl must be a string' });
  }
  if (body?.cancelUrl != null && typeof body.cancelUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'cancelUrl must be a string' });
  }

  try {
    const res = await $fetch<{ url?: string; sessionId?: string }>(
      `${supabaseUrl}/functions/v1/create-model-checkout`,
      {
        method: 'POST',
        headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
        body: {
          modelId,
          kind,
          ...(body?.amountCents != null ? { amountCents: body.amountCents } : {}),
          ...(body?.successUrl ? { successUrl: body.successUrl } : {}),
          ...(body?.cancelUrl ? { cancelUrl: body.cancelUrl } : {}),
        },
      }
    );

    if (!res?.url) {
      throw createError({ statusCode: 502, statusMessage: 'Checkout session did not return a URL' });
    }
    return { url: res.url, sessionId: res.sessionId };
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    // The edge function returns { error } JSON; surface it so the UI can show
    // "You already own this model", "Amount below minimum", etc.
    const message =
      error?.data?.error || error?.statusMessage || error?.data?.statusMessage || 'Could not start checkout';
    console.error('[models/checkout] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
