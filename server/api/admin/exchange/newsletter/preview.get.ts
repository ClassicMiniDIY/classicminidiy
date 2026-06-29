/**
 * GET /api/admin/exchange/newsletter/preview
 *
 * Admin-only. Thin proxy to the process-notifications edge function's
 * `newsletter_preview` action, which curates the week's listings, renders the
 * email HTML, and resolves subscriber counts (TME profiles + Shopify − suppressions).
 * The edge fn owns the template + Shopify creds, so the preview is 1:1 with the
 * cron-sent newsletter. Consumed by useNewsletter().fetchPreview.
 */
import { requireAdminAuth } from '../../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const config = useRuntimeConfig();

  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const serviceKey = config.SUPABASE_SERVICE_KEY as string;
  if (!supabaseUrl || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase not configured' });
  }

  try {
    return await $fetch(`${supabaseUrl}/functions/v1/process-notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: config.public.supabaseKey as string,
        'content-type': 'application/json',
      },
      body: { action: 'newsletter_preview' },
    });
  } catch (error: any) {
    const status = error?.statusCode || error?.response?.status || 502;
    const message = error?.data?.error || error?.statusMessage || 'Failed to load newsletter preview';
    console.error('[newsletter/preview] edge function error:', error?.data || error?.message || error);
    throw createError({ statusCode: status, statusMessage: message });
  }
});
