/**
 * POST /api/admin/variants/:id/status — show or hide a whole variant.
 *
 * A dedicated route with a required reason, never a column in the edit
 * allowlist: `status` is a moderation control (same reasoning as the parts
 * licence route). `rejected` drops the variant from every public read (pages,
 * sitemap, search, MCP) through the approved-only read path; it deletes nothing.
 *
 *   body: { status: 'approved' | 'rejected', reason: string }
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';
import { auditVariantAction, UUID_RE } from '../../../../utils/variantAdmin';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const id = getRouterParam(event, 'id') ?? '';
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  const body = await readBody<{ status?: string; reason?: string }>(event);
  const status = body?.status;
  const reason = (body?.reason ?? '').trim();
  if (status !== 'approved' && status !== 'rejected') {
    throw createError({ statusCode: 400, statusMessage: "status must be 'approved' or 'rejected'" });
  }
  if (reason.length < 4 || reason.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Give a reason (4–500 characters)' });
  }

  const db = getServiceClient();
  const { data: before, error: readError } = await db
    .from('model_variants')
    .select('slug, name, status')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw createError({ statusCode: 500, statusMessage: readError.message });
  if (!before) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  if (before.status === status) return { success: true, unchanged: true };

  const { error } = await db
    .from('model_variants')
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const auditError = await auditVariantAction(db, user.id, 'variant_status_changed', 'variant', id, {
    slug: before.slug,
    name: before.name,
    from: before.status,
    to: status,
    reason,
  });
  return { success: true, warning: auditError };
});
