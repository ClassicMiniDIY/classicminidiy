/**
 * MCP Server Authentication Middleware
 * Protects MCP endpoints with Bearer token authentication
 *
 * API keys must be provided via:
 * - Authorization header: "Bearer <api-key>"
 *
 * Two kinds of key resolve here (docs/plans/2026-08-28-developer-api-subscription.md):
 *
 *  - ENV KEYS (MCP_API_KEY / MCP_API_KEYS) — the ops/CI path. Checked first,
 *    exactly as before the Developer API existed, and resolve to tier
 *    'internal' with no database involved. scripts/test-mcp-transport.sh and
 *    scripts/verify-cf-deploy.sh authenticate this way.
 *
 *  - SELF-SERVE KEYS ('cmdiy_' + 40 base62, minted at /dashboard/api-keys) —
 *    looked up by SHA-256 hash in api_keys via a KV-backed cache, with the
 *    owner's 'developer' subscription deciding tier 'developer' vs 'free'.
 *
 * The resolved tier is stashed on event.context.mcpAuth for rate-limit.ts
 * (which runs after this file — Nitro orders global middleware by filename)
 * and for the tool-tiering plugin. This middleware stays fail-closed: no env
 * match and no api_keys row means 403, in every environment.
 */

import { isProtectedMcpPath } from '../utils/mcpRoutes';
import {
  getMcpAuth,
  keyCacheId,
  MCP_KEY_CACHE_TTL_SECONDS,
  MCP_KEY_NEGATIVE_CACHE_TTL_SECONDS,
  MCP_KEY_PREFIX,
  type McpKeyCacheEntry,
  setMcpAuth,
  sha256Hex,
} from '../utils/mcpTiers';
import { clientIp } from '../utils/clientIp';
import { consumeRateLimit } from '../utils/rateLimit';
import { getServiceClient } from '../utils/supabase';

/**
 * Cache misses (and only misses) reach Supabase, so this bounds how fast one
 * address can turn unknown keys into database reads. Legitimate traffic is
 * untouched: a real key misses the cache about once per five minutes.
 */
const LOOKUP_MAX_PER_MINUTE = 30;

const invalidKeyError = () =>
  createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Invalid API key provided.',
  });

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);

  // Gate the MCP endpoint and everything beneath it except the two routes
  // @nuxtjs/mcp-toolkit registers to be PUBLICLY linkable: /mcp/deeplink (the
  // one-click IDE install) and /mcp/badge.svg (the README badge image). Both
  // used to answer 401, so the module's install affordance was unusable and the
  // badge rendered broken wherever it was embedded. Neither exposes data.
  //
  // The matching rule lives in server/utils/mcpRoutes.ts because rate-limit.ts
  // must gate exactly the same set — see the note there about '/mcp/'.
  if (!isProtectedMcpPath(url.pathname)) {
    return;
  }

  const config = useRuntimeConfig();

  // Get API key from Authorization header (Bearer token only)
  const authHeader = getHeader(event, 'authorization');
  let providedKey: string | null = null;

  // Extract API key from Authorization header (Bearer token)
  // Case-insensitive check for "Bearer" prefix and trim whitespace
  if (authHeader) {
    const trimmedHeader = authHeader.trim();
    if (trimmedHeader.toLowerCase().startsWith('bearer ')) {
      providedKey = trimmedHeader.substring(7).trim();
    }
  }

  // If no API key provided, reject the request
  if (!providedKey) {
    console.error(`[MCP Auth] No valid Bearer token found. Header: ${authHeader ? 'present' : 'missing'}`);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Bearer token required. Provide via Authorization header: "Bearer <api-key>"',
    });
  }

  // Build the set of accepted API keys strictly from configured env values.
  // No hardcoded/default key is ever accepted: the former dev fallback
  // ('dev-mcp-key-classic-mini-diy') is published in this repo's git history and
  // is treated as permanently burned. If nothing is configured, validKeys stays
  // empty and env-key auth never matches — fail closed in ALL environments,
  // including when NODE_ENV is unset. For local development, set MCP_API_KEY
  // (or MCP_API_KEYS) in your .env.
  const validKeys: string[] = [];

  // Check for comma-separated API keys
  if (config.MCP_API_KEYS && typeof config.MCP_API_KEYS === 'string' && config.MCP_API_KEYS.length > 0) {
    const keys = config.MCP_API_KEYS.split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    validKeys.push(...keys);
  }

  // Check for single API key
  if (config.MCP_API_KEY && typeof config.MCP_API_KEY === 'string' && config.MCP_API_KEY.length > 0) {
    validKeys.push(config.MCP_API_KEY);
  }

  // Env keys resolve first, exactly as before self-serve keys existed.
  if (validKeys.includes(providedKey)) {
    setMcpAuth(event, { tier: 'internal' });
    console.log(`[MCP Auth] ✓ Authenticated request to ${url.pathname}`);
    return;
  }

  // Anything that isn't a self-serve key is now simply invalid — same 403 as
  // always, and deliberately BEFORE any cache or database work so random
  // garbage never costs a lookup.
  if (!providedKey.startsWith(MCP_KEY_PREFIX)) {
    console.error(
      `[MCP Auth] Invalid API key. Provided key does not match any valid keys. Valid keys count: ${validKeys.length}`
    );
    throw invalidKeyError();
  }

  // --- Self-serve key path -------------------------------------------------

  const keyHash = await sha256Hex(providedKey);
  const cacheStorage = useStorage('cache');
  const cached = (await cacheStorage.getItem(keyCacheId(keyHash))) as McpKeyCacheEntry | null;

  if (cached) {
    if (!cached.ok) {
      console.error('[MCP Auth] Invalid API key (cached negative).');
      throw invalidKeyError();
    }
    setMcpAuth(event, {
      tier: cached.tier,
      keyId: cached.keyId,
      userId: cached.userId,
      keyPrefix: cached.keyPrefix,
    });
    console.log(`[MCP Auth] ✓ Authenticated request to ${url.pathname}`);
    return;
  }

  // Cache miss: bound how fast one address can drive database lookups before
  // touching Supabase. Real keys re-validate ~once per TTL, so only a scanner
  // ever meets this limit.
  const lookupLimit = consumeRateLimit(`mcpauth:ip:${clientIp(event)}`, {
    max: LOOKUP_MAX_PER_MINUTE,
    windowMs: 60_000,
  });
  if (lookupLimit.limited) {
    setHeader(event, 'Retry-After', String(lookupLimit.retryAfter));
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many API key attempts from your network. Please slow down and try again in a minute.',
    });
  }

  const db = getServiceClient();

  const { data: keyRow, error: keyErr } = await db
    .from('api_keys')
    .select('id, user_id, key_prefix')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (keyErr) {
    // Infrastructure failure, not an invalid key: never cache it, and answer
    // 503 so a paid caller's client retries instead of treating its key as bad.
    console.error(`[MCP Auth] api_keys lookup failed: ${keyErr.message}`);
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'API key verification is temporarily unavailable. Please retry shortly.',
    });
  }

  if (!keyRow) {
    await cacheStorage.setItem(
      keyCacheId(keyHash),
      { ok: false } satisfies McpKeyCacheEntry,
      { ttl: MCP_KEY_NEGATIVE_CACHE_TTL_SECONDS }
    );
    console.error('[MCP Auth] Invalid API key. No matching api_keys row.');
    throw invalidKeyError();
  }

  // The owner's Developer API subscription decides the tier. On an RPC error,
  // degrade to 'free' rather than deny: the key itself is proven valid, and
  // free is the conservative tier (same default-false posture as useAuth).
  let tier: 'free' | 'developer' = 'free';
  const { data: hasSub, error: subErr } = await db.rpc('user_has_subscription', {
    p_user_id: keyRow.user_id,
    p_product_id: 'developer',
  });
  if (subErr) {
    console.error(`[MCP Auth] user_has_subscription lookup failed: ${subErr.message}`);
  } else if (hasSub === true) {
    tier = 'developer';
  }

  const entry: McpKeyCacheEntry = {
    ok: true,
    keyId: keyRow.id,
    userId: keyRow.user_id,
    tier,
    keyPrefix: keyRow.key_prefix,
  };
  await cacheStorage.setItem(keyCacheId(keyHash), entry, { ttl: MCP_KEY_CACHE_TTL_SECONDS });
  setMcpAuth(event, { tier, keyId: keyRow.id, userId: keyRow.user_id, keyPrefix: keyRow.key_prefix });

  // "Roughly when this key was last seen" — updated on cache misses only
  // (~once per TTL per key), backgrounded, failures swallowed.
  const touch = db
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(
      () => {},
      () => {}
    );
  (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(touch);

  console.log(`[MCP Auth] ✓ Authenticated request to ${url.pathname}`);
});
