/**
 * POST /api/developer/checkout
 *
 * Web sales proxy for the Developer API subscription ($4.99/mo or $47.90/yr —
 * paid MCP access; docs/plans/2026-08-28-developer-api-subscription.md).
 * Forwards the caller's Supabase access token and the chosen billing interval
 * to the `create-developer-checkout` Edge Function, which creates a Stripe
 * Checkout session (mode=subscription) and returns its URL. The /developers
 * page redirects the browser to that URL.
 *
 * The web never writes `subscriptions` — that is owned by the
 * `stripe-developer-webhook`. We only mint the checkout session and add the
 * success/cancel return URLs (computed from the site URL).
 *
 * The client must be signed in: it sends `Authorization: Bearer <access token>`
 * so the Edge Function (and downstream webhook) can attribute the row via
 * metadata.user_id.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to start Developer API checkout' });
  }

  const body = await readBody(event);
  const interval = body?.interval === 'year' ? 'year' : body?.interval === 'month' ? 'month' : null;
  if (!interval) {
    throw createError({ statusCode: 400, statusMessage: "interval must be 'month' or 'year'" });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const siteUrl = ((config.public.siteUrl as string) || 'https://www.classicminidiy.com').replace(/\/$/, '');

  try {
    const res = await $fetch<{ url?: string }>(`${supabaseUrl}/functions/v1/create-developer-checkout`, {
      method: 'POST',
      headers: {
        authorization,
        apikey: supabaseKey,
        'content-type': 'application/json',
      },
      body: {
        interval,
        successUrl: `${siteUrl}/developers?subscribed=1`,
        cancelUrl: `${siteUrl}/developers?canceled=1`,
      },
    });

    if (!res?.url) {
      throw createError({ statusCode: 502, statusMessage: 'Checkout session did not return a URL' });
    }

    return { url: res.url };
  } catch (error: any) {
    // Always wrap in createError so $fetch FetchErrors become a clean JSON
    // response with the right status (not an opaque 500). Preserve our own
    // statusMessage (e.g. the missing-URL 502) when present.
    const status = error?.statusCode || error?.response?.status || 502;
    const message = error?.statusMessage || 'Could not start Developer API checkout';
    // Keep the raw Edge Function / Stripe error in the log only.
    console.error('[developer/checkout] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
