/**
 * POST /api/admin/exchange/newsletter/test
 *
 * Admin-only. Sends a one-off TEST newsletter (the rendered weekly digest) to a
 * single address — the supplied `email`, or the admin's own account email when
 * blank. Thin proxy to the process-notifications `newsletter_test` action.
 *
 *   body: { email?: string }
 *   returns: { success, sentTo, listingCount }
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

  const body = await readBody<{ email?: string }>(event);
  const toEmail = (body?.email && body.email.trim()) || user.email;
  if (!toEmail) {
    throw createError({ statusCode: 400, statusMessage: 'No test recipient — provide an email' });
  }

  try {
    return await $fetch(`${supabaseUrl}/functions/v1/process-notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: config.public.supabaseKey as string,
        'content-type': 'application/json',
      },
      body: { action: 'newsletter_test', email: toEmail },
    });
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message = error?.data?.error || error?.statusMessage || 'Failed to send test newsletter';
    console.error('[newsletter/test] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
