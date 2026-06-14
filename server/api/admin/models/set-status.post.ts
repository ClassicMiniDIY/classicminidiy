/**
 * POST /api/admin/models/set-status  (admin model library management)
 *
 * Manual visibility control for the admin "All models" tab:
 *   - published → archived  ("Hide": removed from the public library, buyer
 *                            access retained — has_model_entitlement keeps it)
 *   - archived/removed/flagged → published  ("Show": re-publish)
 *   - any → removed          ("Remove": takedown — revokes all access incl. buyers)
 *
 * Service-role (admin RLS would also permit the write, but we gate + validate
 * here and write an admin_audit_log entry). Re-publishing requires an existing
 * current_version_id; raw drafts/pending go through the Queue (submit/approve),
 * not a direct status flip.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

const ALLOWED = ['published', 'archived', 'removed'];

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ modelId?: string; status?: string }>(event);

  const modelId = body?.modelId;
  const status = body?.status;
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing modelId' });
  if (!status || !ALLOWED.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'status must be published, archived, or removed' });
  }

  const db = getServiceClient();
  const { data: model, error: mErr } = await db
    .from('models')
    .select('id, status, current_version_id, title')
    .eq('id', modelId)
    .single();
  if (mErr || !model) throw createError({ statusCode: 404, statusMessage: 'Model not found' });

  if (status === 'published' && !model.current_version_id) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Model has no published version to show — review it in the Queue instead',
    });
  }
  if (model.status === status) return { ok: true, unchanged: true };

  const { error: upErr } = await db.from('models').update({ status }).eq('id', modelId);
  if (upErr) throw createError({ statusCode: 500, statusMessage: upErr.message });

  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: status === 'published' ? 'model_shown' : status === 'archived' ? 'model_hidden' : 'model_removed',
    target_type: 'model',
    target_id: modelId,
    details: { from: model.status, to: status, title: model.title },
  });

  return { ok: true };
});
