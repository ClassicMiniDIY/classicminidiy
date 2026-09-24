/** GET /api/admin/reference/:key/history — every published version, newest first. Admin only. */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';
import { assertDatasetKey } from '../../../../utils/referenceAdmin';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const key = assertDatasetKey(getRouterParam(event, 'key'));
  const { data, error } = await getServiceClient().rpc('admin_reference_history', { p_dataset: key });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return { versions: data ?? [] };
});
