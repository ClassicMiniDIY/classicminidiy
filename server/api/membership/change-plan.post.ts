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
 * Body `{ plan }` changes the level and answers `{ changed, plan }`. Body
 * `{ action: 'status' }` answers the Stripe subscription's own level
 * (`{ plan, interval, monthlyCents, onCurrentPrice, blocked }`), which the card
 * needs because get_my_membership().plan is the highest level across channels.
 * Errors carry `data.code` for the card's copy (PAYMENT_REQUIRED also carries
 * `data.invoiceUrl`).
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

  let body: { plan?: unknown; action?: unknown } | null;
  try {
    body = (await readBody(event)) ?? null;
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Body must be JSON' });
  }
  const isStatus = body?.action === 'status';
  const plan = body?.plan;
  if (!isStatus && (typeof plan !== 'string' || !MEMBERSHIP_PLANS.some((p) => p.plan === plan))) {
    throw createError({ statusCode: 400, statusMessage: 'plan must be base, plus or pro' });
  }

  try {
    const res = await $fetch<Record<string, unknown>>(`${supabaseUrl}/functions/v1/change-membership-plan`, {
      method: 'POST',
      headers: { authorization, apikey: supabaseKey, 'content-type': 'application/json' },
      body: isStatus ? { action: 'status' } : { plan },
    });
    if (isStatus) {
      return {
        plan: typeof res?.plan === 'string' ? res.plan : null,
        interval: res?.interval === 'month' || res?.interval === 'year' ? res.interval : null,
        monthlyCents: typeof res?.monthlyCents === 'number' ? res.monthlyCents : null,
        onCurrentPrice: res?.onCurrentPrice !== false,
        blocked: typeof res?.blocked === 'string' ? res.blocked : null,
      };
    }
    return { changed: res?.changed === true, plan: typeof res?.plan === 'string' ? res.plan : plan };
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
