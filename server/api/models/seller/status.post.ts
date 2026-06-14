/**
 * POST /api/models/seller/status  (keystone §6)
 *
 * Thin web proxy for `refresh-seller-status`. Forwards the caller's access token
 * to the edge function, which retrieves the live Stripe account and reconciles
 * `seller_accounts` — the webhook-lag fallback that makes onboarding completion
 * deterministic instead of depending on the `account.updated` webhook.
 *
 *   -> { hasAccount: false }
 *   or { hasAccount: true, charges_enabled, payouts_enabled, details_submitted, selling_disabled }
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl || !supabaseKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL or key not configured' });
  }

  try {
    return await $fetch(`${supabaseUrl}/functions/v1/refresh-seller-status`, {
      method: 'POST',
      headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
    });
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message =
      error?.data?.error || error?.statusMessage || error?.data?.statusMessage || 'Could not refresh seller status';
    console.error('[models/seller/status] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
