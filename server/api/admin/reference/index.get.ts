/**
 * GET /api/admin/reference — every reference dataset with its current version,
 * publisher, date, size and publish switch. Admin only.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const { data, error } = await getServiceClient().rpc('admin_reference_datasets');
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return { datasets: data ?? [] };
});
