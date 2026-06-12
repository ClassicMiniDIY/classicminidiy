/**
 * POST /api/models/[modelId]/versions/[versionId]/submit  (keystone §11 PR 7)
 *
 * Proxies the `submit_model_version` RPC under the caller's JWT (the RPC's owner
 * guard keys off auth.uid()). The RPC validates ≥1 uploaded file, ≥1 renderable
 * file or image, `safety_ack`, and `seller_can_sell` for paid pricing, then
 * either moves the model+version to `pending` (new/contributor) or publishes
 * immediately (trusted+). Validation failures come back as the RPC's
 * user-facing messages → surfaced as 400.
 */
import { requireUserClient } from '../../../../../utils/userAuth';

export default defineEventHandler(async (event) => {
  const { supabase } = await requireUserClient(event);
  const versionId = getRouterParam(event, 'versionId');
  if (!versionId) throw createError({ statusCode: 400, statusMessage: 'Missing version id' });

  const { data, error } = await supabase.rpc('submit_model_version', { p_version_id: versionId });
  if (error) {
    console.error('[models/submit] rpc failed:', error.message);
    throw createError({ statusCode: 400, statusMessage: error.message || 'Could not submit for review' });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { modelStatus: row?.model_status ?? null, versionStatus: row?.version_status ?? null };
});
