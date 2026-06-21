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
 * STATIC path — modelId rides in the BODY, not the URL — on purpose. Vercel
 * BotID's client protection (app/plugins/botid.client.ts) attaches the
 * x-is-human challenge by matching the OUTGOING request path. The old route,
 * /api/models/[modelId]/checkout, put the model id as a dynamic segment in the
 * MIDDLE of the path, which forced a mid-path wildcard in the BotID protect
 * list; that pattern never carried the challenge, so checkBotId() fail-closed
 * to 403 'Bot detected' for every real buyer (zero sales since launch). The
 * langgraph chat proxy was never affected because its protect entry is a
 * trailing wildcard. Keep this path static and listed verbatim in
 * botid.client.ts; any new BotID-protected route should avoid a dynamic
 * segment before the matched path.
 *
 * The edge function owns amount/seller/entitlement validation and surfaces
 * actionable error codes (ALREADY_OWNED, SELLER_UNAVAILABLE, AMOUNT_BELOW_MINIMUM
 * …); we preserve its status + message for the UI.
 */
import { checkBotId } from 'botid/server';

export default defineEventHandler(async (event) => {
  // Vercel BotID — block bots before minting a Stripe Checkout session.
  // Protected in app/plugins/botid.client.ts. No-op (always human) in local dev.
  const verification = await checkBotId();
  // Fail CLOSED: treat a missing/odd verification as a block. (Optional chaining
  // on `verification?.isBot` alone would fail OPEN on a nullish result, which is
  // the wrong default for a security gate — checkBotId() returns an object or throws.)
  if (!verification || verification.isBot) {
    // Surface the classification so this isn't a silent black box again — the
    // last regression hid for a week because the 403 carried no reason.
    console.warn('[models/checkout] BotID blocked request', {
      classificationReason: verification?.classificationReason,
      isVerifiedBot: verification?.isVerifiedBot,
    });
    throw createError({ statusCode: 403, statusMessage: 'Bot detected' });
  }

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
