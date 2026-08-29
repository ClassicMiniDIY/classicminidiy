import { requireAdminAuth } from '../../../utils/adminAuth';
import { getServiceClient } from '../../../utils/supabase';
import { DEVELOPER_PRODUCT_ID } from '../../../utils/mcpTiers';

/**
 * Fleet view for /admin/developer: who is subscribed, how many keys exist, and
 * who is actually calling. The per-user modal answers "what about this person";
 * this answers "who are my subscribers", which is otherwise unanswerable
 * without searching users one at a time.
 *
 * Each section loads independently and an empty result is a legitimate answer —
 * this is a reporting screen, so one slow or empty table must not blank it.
 */
export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const db = getServiceClient();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  const sinceDay = since.toISOString().slice(0, 10);

  const [subs, keys, usage] = await Promise.all([
    db
      .from('subscriptions')
      .select('user_id, platform, status, expires_at, billing_interval, comp_note, created_at')
      .eq('product_id', DEVELOPER_PRODUCT_ID)
      .in('status', ['active', 'grace_period'])
      .order('created_at', { ascending: false }),
    db.from('api_keys').select('user_id, last_used_at').is('revoked_at', null),
    db.from('mcp_usage_daily').select('user_id, tool, call_count').gte('day', sinceDay),
  ]);

  // Entitled = the same predicate the gate uses: active/grace and unexpired.
  const now = Date.now();
  const subscribers = (subs.data ?? []).filter((s) => !s.expires_at || new Date(s.expires_at).getTime() > now);

  const keysByUser = new Map<string, number>();
  for (const k of keys.data ?? []) keysByUser.set(k.user_id, (keysByUser.get(k.user_id) ?? 0) + 1);

  const callsByUser = new Map<string, number>();
  const callsByTool = new Map<string, number>();
  for (const u of usage.data ?? []) {
    callsByUser.set(u.user_id, (callsByUser.get(u.user_id) ?? 0) + u.call_count);
    callsByTool.set(u.tool, (callsByTool.get(u.tool) ?? 0) + u.call_count);
  }

  // Resolve display names for everyone who appears in any section.
  const userIds = [...new Set([...subscribers.map((s) => s.user_id), ...callsByUser.keys()])];
  const profiles = userIds.length
    ? await db.from('public_profiles').select('id, username, display_name').in('id', userIds)
    : { data: [] as { id: string; username: string | null; display_name: string | null }[] };
  const nameById = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name || p.username || null]));

  return {
    since: sinceDay,
    subscribers: subscribers.map((s) => ({
      user_id: s.user_id,
      name: nameById.get(s.user_id) ?? null,
      platform: s.platform,
      billing_interval: s.billing_interval,
      expires_at: s.expires_at,
      comp_note: s.comp_note,
      active_keys: keysByUser.get(s.user_id) ?? 0,
      calls_30d: callsByUser.get(s.user_id) ?? 0,
    })),
    totals: {
      subscribers: subscribers.length,
      paid: subscribers.filter((s) => s.platform !== 'comp').length,
      comped: subscribers.filter((s) => s.platform === 'comp').length,
      active_keys: keys.data?.length ?? 0,
      calls_30d: [...callsByUser.values()].reduce((a, b) => a + b, 0),
    },
    top_users: [...callsByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([user_id, calls]) => ({ user_id, name: nameById.get(user_id) ?? null, calls })),
    top_tools: [...callsByTool.entries()].sort((a, b) => b[1] - a[1]).map(([tool, calls]) => ({ tool, calls })),
  };
});
