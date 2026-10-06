/**
 * POST /api/membership/change-plan
 *
 * A Stripe member changes their Sustaining Member level (Member / Plus / Pro).
 * Forwards the caller's Supabase access token to the `change-membership-plan`
 * Edge Function, which swaps the price on the member's own Stripe subscription.
 * The Stripe Customer Portal cannot do this: it lists at most one price per
 * billing interval per product, and the membership is one product with three
 * monthly prices.
 *
 * The web never writes `subscriptions`; the membership webhook writes the new
 * plan when Stripe reports the change.
 *
 * Answers: `{ changed, plan }`, or an error whose `data.code` the card maps to
 * copy (PAYMENT_REQUIRED carries `data.invoiceUrl`).
 */
import { MEMBERSHIP_PLANS } from '../../../shared/utils/chatTiers';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required to change your membership level' });
  }

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const supabaseKey = config.public.supabaseKey as string;
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL not configured' });
  }

  let body: { plan?: unknown } | null;
  try {
    body = (await readBody(event)) ?? null;
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Body must be JSON' });
  }
  const plan = body?.plan;
  if (typeof plan !== 'string' || !MEMBERSHIP_PLANS.some((p) => p.plan === plan)) {
    throw createError({ statusCode: 400, statusMessage: 'plan must be base, plus or pro' });
  }

  try {
    const res = await $fetch<{ changed?: boolean; plan?: string }>(
      `${supabaseUrl}/functions/v1/change-membership-plan`,
      {
        method: 'POST',
        headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
        body: { plan },
      }
    );
    return { changed: res?.changed === true, plan: res?.plan ?? plan };
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    console.error('[membership/change-plan] edge function error:', error?.data || error?.message || error);
    // Pass the edge function's code through so the card can say what to do
    // (CANCEL_SCHEDULED, NOT_ACTIVE, PLAN_UNAVAILABLE, PAYMENT_REQUIRED, ...).
    // Only a Stripe-hosted invoice URL is passed on; the card opens it.
    const invoiceUrl =
      typeof error?.data?.invoiceUrl === 'string' && error.data.invoiceUrl.startsWith('https://invoice.stripe.com/')
        ? error.data.invoiceUrl
        : null;
    throw createError({
      statusCode: status,
      statusMessage: 'Could not change the membership level',
      data: { code: error?.data?.code ?? null, invoiceUrl },
    });
  }
});
