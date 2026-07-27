/**
 * POST /api/admin/marketing/drafts
 *
 * Marketing-admin only. Creates a marketing email draft. Writes are
 * server-side only (marketing_emails has no client write policies) so the
 * allowlist gate + validation live in one place; reads happen client-side via
 * the is_admin() SELECT policy.
 *
 *   body: { subject, preheader?, blocks }
 *   returns: the inserted row
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireMarketingAdmin } from '../../../utils/marketingAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireMarketingAdmin(event);
  const body = await readBody<{ subject?: string; preheader?: string; blocks?: unknown[] }>(event);

  const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  const preheader =
    typeof body?.preheader === 'string' && body.preheader.trim() ? body.preheader.trim().slice(0, 200) : null;
  const blocks = Array.isArray(body?.blocks) ? body.blocks : [];
  if (!subject) throw createError({ statusCode: 400, statusMessage: 'subject is required' });

  // marketing_emails postdates the generated Database types — cast until
  // `bun run gen:types` runs against the migrated schema.
  const db = getServiceClient() as any;
  const { data: row, error } = await db
    .from('marketing_emails')
    .insert({ subject, preheader, blocks, created_by: user.id })
    .select('*')
    .single();
  if (error || !row) {
    console.error('[marketing/drafts] insert failed:', error?.message);
    throw createError({ statusCode: 500, statusMessage: 'Could not create draft' });
  }
  return row;
});
