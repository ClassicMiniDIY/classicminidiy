import { requireAdminAuth } from '../../../../utils/adminAuth';
import { getServiceClient } from '../../../../utils/supabase';
import { keyCacheId } from '../../../../utils/mcpTiers';

/**
 * Revoke any user's API key. Soft delete (revoked_at) so mcp_usage_daily keeps
 * its FK, then purge the key's auth-cache entry — the web app and the MCP
 * endpoint run in the SAME worker, so deleting from useStorage('cache') here
 * makes the revocation effective on the next request rather than after the TTL.
 *
 * Unlike the user-facing route this is NOT scoped by user_id (that is the whole
 * point — an admin revokes someone else's key), so the audit row is the record
 * of who did it and to whom.
 */
export default defineEventHandler(async (event) => {
  const { user: admin } = await requireAdminAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' });
  }

  const db = getServiceClient();

  const { data, error } = await db
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)
    .select('id, user_id, key_hash, key_prefix, name')
    .maybeSingle();
  if (error) {
    console.error('[admin/developer] key revoke failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to revoke API key' });
  }
  if (!data) throw createError({ statusCode: 404, statusMessage: 'API key not found' });

  await useStorage('cache')
    .removeItem(keyCacheId(data.key_hash))
    .catch(() => {});

  await db.from('admin_audit_log').insert({
    admin_id: admin.id,
    action: 'developer_key_revoked',
    target_type: 'user',
    target_id: data.user_id,
    details: { key_id: data.id, key_prefix: data.key_prefix, name: data.name },
  });

  return { revoked: true };
});
