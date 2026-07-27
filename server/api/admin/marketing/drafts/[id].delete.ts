/**
 * DELETE /api/admin/marketing/drafts/:id
 *
 * Marketing-admin only. Deletes a DRAFT (sent/sending rows are history and
 * cannot be removed — the status-scoped delete refuses them).
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireMarketingAdmin } from '../../../../utils/marketingAuth';

export default defineEventHandler(async (event) => {
  await requireMarketingAdmin(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });

  // marketing_emails postdates the generated Database types — cast until
  // `bun run gen:types` runs against the migrated schema.
  const db = getServiceClient() as any;
  const { data: row, error } = await db
    .from('marketing_emails')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[marketing/drafts] delete failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Could not delete draft' });
  }
  if (!row) throw createError({ statusCode: 409, statusMessage: 'Draft not found or not deletable' });
  return { success: true };
});
