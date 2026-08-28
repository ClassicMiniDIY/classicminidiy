import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

/**
 * The caller's MCP usage for the last 30 days — rows from mcp_usage_daily
 * (exact per-key/tool counts written by the worker on every successful tool
 * call). Feeds the usage chart on /dashboard/api-keys.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceDay = since.toISOString().slice(0, 10);

  const db = getServiceClient() as unknown as SupabaseClient;

  const { data, error } = await db
    .from('mcp_usage_daily')
    .select('key_id, tool, day, call_count')
    .eq('user_id', user.id)
    .gte('day', sinceDay)
    .order('day', { ascending: true });

  if (error) {
    console.error('[developer/usage] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load usage' });
  }

  return { since: sinceDay, rows: data ?? [] };
});
