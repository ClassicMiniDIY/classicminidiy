import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);

  const search = query.search?.toString();
  const trustLevel = query.trustLevel?.toString();
  const limit = parseInt(query.limit?.toString() || '50');
  const offset = parseInt(query.offset?.toString() || '0');

  let q = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (trustLevel && trustLevel !== 'all') {
    if (trustLevel === 'admin') {
      q = q.eq('is_admin', true);
    } else {
      q = q.eq('trust_level', trustLevel);
    }
  }
  if (search) q = q.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error, count } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return {
    users: data || [],
    total: count || 0,
  };
});
