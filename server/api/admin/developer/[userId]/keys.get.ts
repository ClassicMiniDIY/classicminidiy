import { requireAdminAuth } from '../../../../utils/adminAuth';
import { getServiceClient } from '../../../../utils/supabase';

/**
 * List one user's ACTIVE API keys, for the Developer API section of the admin
 * user modal. Metadata only — the plaintext exists nowhere after minting and
 * key_hash never leaves the server, so an admin cannot read out a key that
 * already exists; they can only revoke it or issue a new one.
 */
export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const userId = getRouterParam(event, 'userId');
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Missing userId' });

  const { data, error } = await getServiceClient()
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[admin/developer] key list failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load API keys' });
  }
  return { keys: data ?? [] };
});
