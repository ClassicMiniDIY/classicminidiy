import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import { keyCacheId } from '../../utils/mcpTiers';

/**
 * Purge the auth-cache entries for ALL of the caller's active keys, so a tier
 * change is picked up on the next MCP request instead of after the cache TTL.
 * Called by the post-checkout activation poller the moment the Developer API
 * subscription lands — this is what makes an upgrade feel instant on keys the
 * user minted while still on the free tier.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);

  const db = getServiceClient() as unknown as SupabaseClient;

  const { data, error } = await db
    .from('api_keys')
    .select('key_hash')
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (error) {
    console.error('[developer/refresh] key lookup failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to refresh keys' });
  }

  const storage = useStorage('cache');
  await Promise.all(
    (data ?? []).map((row: { key_hash: string }) => storage.removeItem(keyCacheId(row.key_hash)).catch(() => {}))
  );

  return { refreshed: (data ?? []).length };
});
