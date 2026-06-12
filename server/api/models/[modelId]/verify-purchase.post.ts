/**
 * POST /api/models/[modelId]/verify-purchase  (keystone §6)
 *
 * Webhook-lag fallback for the purchase success page. Forwards the caller's
 * access token + the Checkout Session id to `verify-model-purchase`, which
 * retrieves the session from the seller's connected account and performs the
 * same idempotent model_purchases upsert as the webhook — so the success page
 * reflects the purchase immediately instead of waiting on webhook latency.
 *
 *   body: { sessionId }
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to verify a purchase' });
  }

  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const body = await readBody<{ sessionId?: string }>(event);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId.startsWith('cs_')) {
    throw createError({ statusCode: 400, statusMessage: 'A valid sessionId is required' });
  }

  try {
    return await $fetch<{ verified: boolean; kind?: string; recorded?: boolean; paymentStatus?: string }>(
      `${supabaseUrl}/functions/v1/verify-model-purchase`,
      {
        method: 'POST',
        headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
        body: { modelId, sessionId },
      }
    );
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message =
      error?.data?.error || error?.statusMessage || error?.data?.statusMessage || 'Could not verify purchase';
    console.error('[models/verify-purchase] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
