/**
 * PUT /api/admin/marketing/drafts/:id
 *
 * Marketing-admin only. Updates a draft's content. Refuses unless the row is
 * still status='draft' (sent/sending emails are immutable history). The
 * status-scoped UPDATE also loses gracefully to a concurrent send claim.
 *
 *   body: { subject?, preheader?, blocks? }
 *   returns: the updated row
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireMarketingAdmin } from '../../../../utils/marketingAuth';

export default defineEventHandler(async (event) => {
  await requireMarketingAdmin(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  const body = await readBody<{ subject?: string; preheader?: string; blocks?: unknown[] }>(event);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.subject === 'string') updates.subject = body.subject.trim().slice(0, 200);
  if (body?.preheader !== undefined) {
    updates.preheader =
      typeof body.preheader === 'string' && body.preheader.trim() ? body.preheader.trim().slice(0, 200) : null;
  }
  if (Array.isArray(body?.blocks)) updates.blocks = body.blocks;

  const db = getServiceClient();
  const { data: row, error } = await db
    .from('marketing_emails')
    .update(updates)
    .eq('id', id)
    .eq('status', 'draft')
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('[marketing/drafts] update failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Could not update draft' });
  }
  if (!row) {
    throw createError({ statusCode: 409, statusMessage: 'Draft not found or no longer editable' });
  }
  return row;
});
