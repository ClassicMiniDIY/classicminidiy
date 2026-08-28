import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import {
  keyCacheId,
  MCP_KEY_DISPLAY_PREFIX_LENGTH,
  MCP_MAX_ACTIVE_KEYS,
  mintApiKey,
  sha256Hex,
} from '../../utils/mcpTiers';

/**
 * Mint a new API key for the caller (Developer API). The response is the ONLY
 * time the plaintext key exists outside the caller's hands: the database keeps
 * the SHA-256 hash and a display prefix, nothing more. Minting is a server
 * route (not client PostgREST) because the active-key cap is enforced here and
 * RLS deliberately grants no INSERT on api_keys.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const body = await readBody(event);

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 60) {
    throw createError({ statusCode: 400, statusMessage: 'Name must be 1-60 characters' });
  }

  const db = getServiceClient() as unknown as SupabaseClient;

  const { count, error: countError } = await db
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (countError) {
    console.error('[developer/keys] count failed:', countError.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to check key count' });
  }
  if ((count ?? 0) >= MCP_MAX_ACTIVE_KEYS) {
    throw createError({
      statusCode: 409,
      statusMessage: `Maximum of ${MCP_MAX_ACTIVE_KEYS} active API keys reached`,
    });
  }

  const plaintext = mintApiKey();
  const keyHash = await sha256Hex(plaintext);
  const keyPrefix = plaintext.slice(0, MCP_KEY_DISPLAY_PREFIX_LENGTH);

  const { data, error } = await db
    .from('api_keys')
    .insert({ user_id: user.id, name, key_hash: keyHash, key_prefix: keyPrefix })
    .select('id, name, key_prefix, created_at')
    .single();

  if (error) {
    console.error('[developer/keys] insert failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to create API key' });
  }

  // A probe of this key BEFORE it existed may have left a negative auth-cache
  // entry (60s TTL on KV; unbounded on the dev memory driver) — clear it so the
  // key works the moment the user pastes it into a client.
  await useStorage('cache')
    .removeItem(keyCacheId(keyHash))
    .catch(() => {});

  return { ...data, key: plaintext };
});
