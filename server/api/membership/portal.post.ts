/**
 * POST /api/membership/portal
 *
 * Self-management proxy for existing web members (keystone §9). Forwards the
 * caller's Supabase access token to the optional `create-billing-portal-session`
 * Edge Function, which returns a Stripe Billing Portal URL where the member can
 * update payment details or cancel. The membership page redirects there.
 *
 * Depends on the sibling Edge Function shipping in supabase Phase 1; until then
 * this returns the Edge Function's error and the page surfaces a toast. Members
 * who subscribed in the iOS/Android apps manage through App Store / Play instead.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to manage your membership' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  const siteUrl = ((config.public.siteUrl as string) || 'https://classicminidiy.com').replace(/\/$/, '');

  try {
    const res = await $fetch<{ url?: string }>(`${supabaseUrl}/functions/v1/create-billing-portal-session`, {
      method: 'POST',
      headers: {
        authorization,
        apikey: supabaseKey,
        'content-type': 'application/json',
      },
      body: {
        returnUrl: `${siteUrl}/membership`,
      },
    });

    if (!res?.url) {
      throw createError({ statusCode: 502, statusMessage: 'Billing portal session did not return a URL' });
    }

    return { url: res.url };
  } catch (error: any) {
    if (error?.statusCode === 502) throw error;
    const status = error?.statusCode || error?.response?.status || 502;
    console.error('[membership/portal] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: 'Could not open the billing portal' });
  }
});
