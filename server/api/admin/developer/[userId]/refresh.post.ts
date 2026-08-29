import { requireAdminAuth } from '../../../../utils/adminAuth';
import { getServiceClient } from '../../../../utils/supabase';
import { keyCacheId } from '../../../../utils/mcpTiers';

/**
 * Purge the auth-cache entries for all of a user's active keys.
 *
 * Called right after an admin comps or revokes the Developer API tier: the
 * entitlement changed but each key's cached entry still carries the OLD tier
 * for up to the cache TTL, so without this the admin grants access and the
 * customer keeps getting the upsell for five minutes (or keeps paid access for
 * five minutes after a revoke). The comp RPCs run against Supabase directly and
 * cannot reach the worker's KV, which is why this is a separate call.
 */
export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const userId = getRouterParam(event, 'userId');
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Missing userId' });

  const { data, error } = await getServiceClient()
    .from('api_keys')
    .select('key_hash')
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (error) {
    console.error('[admin/developer] refresh lookup failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to refresh keys' });
  }

  const storage = useStorage('cache');
  await Promise.all(
    (data ?? []).map((row: { key_hash: string }) => storage.removeItem(keyCacheId(row.key_hash)).catch(() => {}))
  );
  return { refreshed: (data ?? []).length };
});
