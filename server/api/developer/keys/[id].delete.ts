import { requireUserAuth } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { keyCacheId } from '../../../utils/mcpTiers';

/**
 * Revoke one of the caller's API keys. Soft delete (revoked_at) so
 * mcp_usage_daily history keeps its FK, then purge the key's auth-cache entry
 * — the web app and the MCP endpoint run in the SAME worker, so deleting from
 * useStorage('cache') here makes revocation effective immediately instead of
 * after the cache TTL.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = getRouterParam(event, 'id');

  const db = getServiceClient();

  const { data, error } = await db
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id, key_hash')
    .maybeSingle();

  if (error) {
    console.error('[developer/keys] revoke failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to revoke API key' });
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' });
  }

  await useStorage('cache')
    .removeItem(keyCacheId(data.key_hash))
    .catch(() => {});

  return { revoked: true };
});
