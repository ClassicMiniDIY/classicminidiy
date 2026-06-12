/**
 * POST /api/models/[modelId]/checkout  (keystone §6)
 *
 * Thin web proxy for model purchases and tips. Forwards the caller's Supabase
 * access token to the `create-model-checkout` Edge Function, which validates the
 * model, re-checks the seller gate, resolves the amount, and creates a DIRECT
 * charge Checkout Session on the seller's connected account. We never touch
 * Stripe here — the web only mints the session via the edge function and the
 * client redirects to the returned URL.
 *
 *   body: { kind: 'purchase'|'tip', amountCents?, successUrl?, cancelUrl? }
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

  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const body = await readBody<{ kind?: string; amountCents?: number; successUrl?: string; cancelUrl?: string }>(event);
  const kind = body?.kind === 'tip' ? 'tip' : body?.kind === 'purchase' ? 'purchase' : null;
  if (!kind) {
    throw createError({ statusCode: 400, statusMessage: 'kind must be "purchase" or "tip"' });
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
