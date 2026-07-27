/**
 * POST /api/admin/marketing/send
 *
 * Marketing-admin only. Triggers the full send for a draft via the
 * `marketing_send` action. The edge fn atomically claims the row
 * (draft→sending), resolves the live audience, and runs the SES loop to
 * completion in Deno — which can outlive THIS request's window on Vercel. A
 * proxy timeout therefore does NOT mean failure: the audit row is written
 * before forwarding, and on timeout we return started:true so the composer
 * polls the marketing_emails row for progress instead of erroring.
 *
 *   body: { id }
 *   returns: edge result, or { started: true, polling: true } on proxy timeout
 *   429 when the row was not in draft state (already sending/sent).
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireMarketingAdmin } from '../../../utils/marketingAuth';
import { callMarketingEdge } from '../../../utils/marketingEdge';

export default defineEventHandler(async (event) => {
  const { user } = await requireMarketingAdmin(event);
  const body = await readBody<{ id?: string }>(event);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' });

  // marketing_emails postdates the generated Database types — cast until
  // `bun run gen:types` runs against the migrated schema.
  const db = getServiceClient() as any;
  const { data: draft, error: lookupError } = await db
    .from('marketing_emails')
    .select('id, subject, status')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) {
    console.error('[marketing/send] lookup failed:', lookupError.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to look up marketing email' });
  }
  if (!draft) throw createError({ statusCode: 404, statusMessage: 'Marketing email not found' });
  if (draft.status !== 'draft') {
    throw createError({ statusCode: 429, statusMessage: `Marketing email is ${draft.status}, not draft` });
  }

  // Audit intent BEFORE forwarding — the edge call may outlive this request.
  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: 'marketing_email_sent',
    target_type: 'marketing_email',
    target_id: id,
    details: { subject: draft.subject },
  });

  let result: any;
  try {
    result = await callMarketingEdge({ action: 'marketing_send', marketingEmailId: id, sentBy: user.id });
  } catch (error: any) {
    // Distinguish "edge rejected it" from "proxy gave up waiting". On a
    // timeout/abort the Deno loop keeps running — tell the client to poll.
    const status = error?.statusCode;
    if (!status || status === 502 || status === 504 || status === 408) {
      console.warn('[marketing/send] proxy timed out awaiting edge fn; send continues edge-side');
      return { started: true, polling: true, sendId: id };
    }
    throw error;
  }

  if (result && result.success === false && result.status === 'blocked') {
    throw createError({ statusCode: 429, statusMessage: result.error || 'Marketing email is not in draft state' });
  }
  if (result && result.success === false) {
    throw createError({ statusCode: 400, statusMessage: result.error || `Send failed (${result.status})` });
  }
  return result;
});
