/**
 * POST /api/admin/exchange/newsletter/send
 *
 * Admin-only. Triggers the full weekly newsletter send via the
 * process-notifications `newsletter_send` action (the same code path the weekly
 * pg_cron uses). The edge fn runs the SES send loop to completion (Deno doesn't
 * freeze post-response like Vercel serverless), applies the recent-send guard,
 * and writes the newsletter_sends record.
 *
 *   body: { forceOverride?: boolean }
 *   returns: { success, status, totalAttempted, listingCount, sendId }
 *   429 when a send happened in the last 6 days (unless forceOverride).
 */
import { requireAdminAuth } from '../../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const config = useRuntimeConfig();

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const serviceKey = config.SUPABASE_SERVICE_KEY as string;
  if (!supabaseUrl || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' });
  }

  const body = await readBody<{ forceOverride?: boolean }>(event);

  let result: any;
  try {
    result = await $fetch(`${supabaseUrl}/functions/v1/process-notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: config.public.supabaseKey as string,
        'content-type': 'application/json',
      },
      body: { action: 'newsletter_send', forceOverride: !!body?.forceOverride, sentBy: user.id },
    });
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message = error?.data?.error || error?.statusMessage || 'Failed to send newsletter';
    console.error('[newsletter/send] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }

  // The guard blocked it (already sent recently) — surface as 429 so the UI shows
  // the "already sent" warning rather than a generic error.
  if (result && result.success === false && result.status === 'blocked') {
    throw createError({ statusCode: 429, statusMessage: result.error || 'Newsletter was already sent recently' });
  }
  if (result && result.success === false) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error || `Newsletter not sent (${result.status})`,
    });
  }

  return result;
});
