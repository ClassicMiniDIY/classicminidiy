/**
 * POST /api/admin/marketing/test
 *
 * Marketing-admin only. Sends the current composition as a [TEST]-prefixed
 * email to a single address (defaults to the requesting admin) with a real
 * signed unsubscribe link + RFC 8058 one-click headers, so header checks in
 * "Show original" reflect exactly what a real send produces.
 *
 *   body: { subject, preheader?, blocks, email? }
 *   returns: { success, sentTo }
 */
import { requireMarketingAdmin } from '../../../utils/marketingAuth';
import { callMarketingEdge } from '../../../utils/marketingEdge';

export default defineEventHandler(async (event) => {
  const { user } = await requireMarketingAdmin(event);
  const body = await readBody<{ subject?: string; preheader?: string; blocks?: unknown[]; email?: string }>(event);
  const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : user.email;
  if (!email) throw createError({ statusCode: 400, statusMessage: 'No test email address available' });
  return callMarketingEdge({
    action: 'marketing_test',
    subject: body?.subject,
    preheader: body?.preheader,
    blocks: body?.blocks,
    email,
  });
});
