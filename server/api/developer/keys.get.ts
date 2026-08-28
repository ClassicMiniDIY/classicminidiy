import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

/**
 * List the caller's ACTIVE API keys (Developer API,
 * docs/plans/2026-08-28-developer-api-subscription.md). Metadata only — the
 * plaintext key exists nowhere after minting, and key_hash never leaves the
 * server.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);

  const db = getServiceClient();

  const { data, error } = await db
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[developer/keys] list failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load API keys' });
  }

  return { keys: data ?? [] };
});
