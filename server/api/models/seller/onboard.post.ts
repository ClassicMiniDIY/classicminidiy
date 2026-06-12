/**
 * POST /api/models/seller/onboard  (keystone §6)
 *
 * Thin web proxy for Stripe Connect STANDARD seller onboarding. Forwards the
 * caller's access token to `create-seller-onboarding`, which enforces the seller
 * gate (trust ≥ contributor, not selling_disabled, not banned), creates or
 * reuses the connected account, and returns an onboarding AccountLink URL. The
 * client redirects the browser there.
 *
 *   body: { returnUrl?, refreshUrl? }   (built from the browser origin so dev
 *                                        returns to localhost, prod to the site)
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to start seller onboarding' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const body = await readBody<{ returnUrl?: string; refreshUrl?: string }>(event).catch(() => ({}) as any);

  try {
    const res = await $fetch<{ url?: string }>(`${supabaseUrl}/functions/v1/create-seller-onboarding`, {
      method: 'POST',
      headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
      body: {
        ...(body?.returnUrl ? { returnUrl: body.returnUrl } : {}),
        ...(body?.refreshUrl ? { refreshUrl: body.refreshUrl } : {}),
      },
    });

    if (!res?.url) {
      throw createError({ statusCode: 502, statusMessage: 'Onboarding did not return a URL' });
    }
    return { url: res.url };
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    // Preserve the edge function's gate messages (TRUST_TOO_LOW, SELLING_DISABLED…).
    const message =
      error?.data?.error || error?.statusMessage || error?.data?.statusMessage || 'Could not start seller onboarding';
    console.error('[models/seller/onboard] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
