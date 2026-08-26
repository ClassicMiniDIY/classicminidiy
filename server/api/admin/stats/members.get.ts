/**
 * GET /api/admin/stats/members  →  { count }
 *
 * Active Sustaining Member count, for the /admin dashboard tile.
 *
 * This is a server route rather than a client-side count because RLS on
 * `subscriptions` is `auth.uid() = user_id OR auth.role() = 'service_role'` —
 * there is NO `is_admin()` branch, unlike `models` or `model_reports`. An
 * admin counting that table from the browser gets their OWN rows, silently:
 * PostgREST answers 200 with a count of 0 or 1, so the dashboard would have
 * rendered a confident, wrong number with nothing to log.
 *
 * That policy is why every other subscription read in this repo goes through an
 * RPC (`user_has_subscription`, `get_my_membership`, `admin_get_membership`).
 * If you need another aggregate over `subscriptions`, it belongs here or in an
 * RPC — never in a client-side `.from('subscriptions')`.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);

  const { count, error } = await getServiceClient()
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return { count: count || 0 };
});
