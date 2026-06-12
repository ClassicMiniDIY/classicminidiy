/**
 * DELETE /api/models/[modelId]  (keystone §12 — hard-delete drafts only)
 *
 * Owner deletes their own draft model (RLS only permits DELETE on owned drafts
 * with purchase_count = 0; versions/files/images cascade). S3 objects + storage
 * images orphan and are reclaimed by the nightly cleanup. Anything else (a
 * published model with sales) is a soft-archive concern, not a delete.
 */
import { requireUserClient } from '../../utils/userAuth';

export default defineEventHandler(async (event) => {
  const { supabase } = await requireUserClient(event);
  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  const { data, error } = await supabase.from('models').delete().eq('id', modelId).select('id');
  if (error) {
    console.error('[models/delete] failed:', error.message);
    throw createError({ statusCode: 400, statusMessage: error.message || 'Could not delete model' });
  }
  if (!data || data.length === 0) {
    // RLS returned no rows — not a deletable draft (published, has sales, or not owner).
    throw createError({ statusCode: 403, statusMessage: 'Only your own drafts can be deleted' });
  }

  return { ok: true };
});
