import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);
  const targetType = query.targetType?.toString();

  let q = supabase.from('submission_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending');

  if (targetType) q = q.eq('target_type', targetType);

  const { count, error } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return { count: count || 0 };
});
