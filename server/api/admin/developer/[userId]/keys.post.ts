import { requireAdminAuth } from '../../../../utils/adminAuth';
import { getServiceClient } from '../../../../utils/supabase';
import {
  keyCacheId,
  MCP_KEY_DISPLAY_PREFIX_LENGTH,
  MCP_MAX_ACTIVE_KEYS,
  mintApiKey,
  sha256Hex,
} from '../../../../utils/mcpTiers';

/**
 * Issue an API key ON BEHALF OF a user (support case: helping someone get set
 * up who cannot mint one themselves).
 *
 * This hands the admin a working credential for another person's account — it
 * calls the MCP as them and counts against their usage — so it is deliberately
 * not indistinguishable from a key the user made:
 *
 *   - The name is FORCED to "Admin-issued by <admin email>", so the key is
 *     labelled as such in the user's own /dashboard/api-keys list and they can
 *     revoke it. The admin does not get to name it something innocuous.
 *   - Every issue writes an admin_audit_log row naming the acting admin, the
 *     target user and the key prefix.
 *   - The 5-active-key cap still applies. Admins do not bypass a user's limit.
 *
 * As with self-serve minting, the plaintext is returned exactly once and only
 * the SHA-256 hash is stored.
 */
export default defineEventHandler(async (event) => {
  const { user: admin } = await requireAdminAuth(event);
  const userId = getRouterParam(event, 'userId');
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Missing userId' });

  const db = getServiceClient();

  const { count, error: countError } = await db
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (countError) {
    console.error('[admin/developer] key count failed:', countError.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to check key count' });
  }
  if ((count ?? 0) >= MCP_MAX_ACTIVE_KEYS) {
    throw createError({
      statusCode: 409,
      statusMessage: `User already holds the maximum of ${MCP_MAX_ACTIVE_KEYS} active API keys`,
    });
  }

  const plaintext = mintApiKey();
  const keyHash = await sha256Hex(plaintext);
  const keyPrefix = plaintext.slice(0, MCP_KEY_DISPLAY_PREFIX_LENGTH);
  const name = `Admin-issued by ${admin.email ?? 'admin'}`.slice(0, 60);

  const { data, error } = await db
    .from('api_keys')
    .insert({ user_id: userId, name, key_hash: keyHash, key_prefix: keyPrefix })
    .select('id, name, key_prefix, created_at')
    .single();
  if (error) {
    console.error('[admin/developer] key insert failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to issue API key' });
  }

  // A probe of this key before it existed may have left a negative auth-cache
  // entry — clear it so the key works the moment it is pasted into a client.
  await useStorage('cache')
    .removeItem(keyCacheId(keyHash))
    .catch(() => {});

  // The count-then-insert above races with itself, and there is no DB-side
  // constraint behind the cap — recount and roll this insert back if it pushed
  // the user over. Kept identical to the self-serve route so the two
  // enforcement paths cannot drift.
  const { count: afterCount } = await db
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if ((afterCount ?? 0) > MCP_MAX_ACTIVE_KEYS) {
    await db.from('api_keys').delete().eq('id', data.id);
    throw createError({
      statusCode: 409,
      statusMessage: `User already holds the maximum of ${MCP_MAX_ACTIVE_KEYS} active API keys`,
    });
  }

  await db.from('admin_audit_log').insert({
    admin_id: admin.id,
    action: 'developer_key_issued',
    target_type: 'user',
    target_id: userId,
    details: { key_id: data.id, key_prefix: keyPrefix, name },
  });

  return { ...data, key: plaintext };
});
