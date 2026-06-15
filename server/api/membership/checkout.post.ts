/**
 * POST /api/membership/checkout
 *
 * Web sales proxy for the Sustaining Member ($1.99/mo) membership (keystone §7,
 * §9). Forwards the caller's Supabase access token to the
 * `create-membership-checkout` Edge Function, which creates a Stripe Checkout
 * session (mode=subscription) and returns its URL. The membership page redirects
 * the browser to that URL.
 *
 * The web never writes `subscriptions` — that is owned by the
 * `stripe-membership-webhook`. We only mint the checkout session and add the
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
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to start membership checkout' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const siteUrl = ((config.public.siteUrl as string) || 'https://www.classicminidiy.com').replace(/\/$/, '');

  try {
    const res = await $fetch<{ url?: string }>(`${supabaseUrl}/functions/v1/create-membership-checkout`, {
      method: 'POST',
      headers: {
        authorization,
        apikey: supabaseKey,
        'content-type': 'application/json',
      },
      body: {
        successUrl: `${siteUrl}/membership?subscribed=1`,
        cancelUrl: `${siteUrl}/membership?canceled=1`,
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
    const message = error?.statusMessage || 'Could not start membership checkout';
    // Keep the raw Edge Function / Stripe error in the log only.
    console.error('[membership/checkout] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
