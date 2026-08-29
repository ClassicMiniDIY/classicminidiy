import { requireAdminAuth } from '../../../../utils/adminAuth';
import { getServiceClient } from '../../../../utils/supabase';

/**
 * One user's MCP usage over the same 30-day window the user sees on their own
 * dashboard (29 days back + today), so the two never disagree when a customer
 * is on the phone reading their chart out.
 */
export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const userId = getRouterParam(event, 'userId');
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Missing userId' });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  const sinceDay = since.toISOString().slice(0, 10);

  const { data, error } = await getServiceClient()
    .from('mcp_usage_daily')
    .select('key_id, tool, day, call_count')
    .eq('user_id', userId)
    .gte('day', sinceDay)
    .order('day', { ascending: true });

  if (error) {
    console.error('[admin/developer] usage query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load usage' });
  }
  return { since: sinceDay, rows: data ?? [] };
});
