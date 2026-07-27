/**
 * POST /api/admin/marketing/preview
 *
 * Marketing-admin only. Renders the block composition to branded email HTML
 * via the send-marketing-email `marketing_preview` action. No audience
 * resolution happens here (the composer calls this debounced per edit).
 *
 *   body: { subject, preheader?, blocks }
 *   returns: { emailHtml, subject }
 */
import { requireMarketingAdmin } from '../../../utils/marketingAuth';
import { callMarketingEdge } from '../../../utils/marketingEdge';

export default defineEventHandler(async (event) => {
  await requireMarketingAdmin(event);
  const body = await readBody<{ subject?: string; preheader?: string; blocks?: unknown[] }>(event);
  return callMarketingEdge({
    action: 'marketing_preview',
    subject: body?.subject,
    preheader: body?.preheader,
    blocks: body?.blocks,
  });
});
