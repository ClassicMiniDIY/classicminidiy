import type { H3Event } from 'h3';
import type { McpTier } from '../../shared/utils/mcpTiers';
import { MCP_KEY_PREFIX, MCP_KEY_RANDOM_LENGTH } from '../../shared/utils/mcpTiers';

/**
 * Server-only half of the MCP tier contract (Developer API): key minting,
 * hashing, the auth cache, and the per-request context accessors.
 * Design doc: docs/plans/2026-08-28-developer-api-subscription.md
 *
 * The client-safe constants (tier type, FREE_TOOLS/PAID_ONLY_TOOLS, key
 * format, product id, endpoint) live in shared/utils/mcpTiers.ts so the
 * /developers pricing table can import them without pulling server plumbing
 * into the public bundle. Re-exported here so server code keeps one import.
 */
export {
  DEVELOPER_PRODUCT_ID,
  FREE_TOOLS,
  MCP_ENDPOINT,
  MCP_KEY_DISPLAY_PREFIX_LENGTH,
  MCP_KEY_PREFIX,
  MCP_KEY_RANDOM_LENGTH,
  MCP_MAX_ACTIVE_KEYS,
  PAID_ONLY_TOOLS,
} from '../../shared/utils/mcpTiers';
export type { McpTier } from '../../shared/utils/mcpTiers';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Mint a new plaintext API key. Rejection sampling keeps the base62 draw
 * unbiased (248 = 4 * 62 is the largest multiple of 62 below 256). The
 * plaintext is returned to the user exactly once; only its SHA-256 hex is
 * persisted (api_keys.key_hash).
 */
export function mintApiKey(): string {
  let out = '';
  const buf = new Uint8Array(64);
  while (out.length < MCP_KEY_RANDOM_LENGTH) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte >= 248) continue;
      out += BASE62[byte % 62];
      if (out.length === MCP_KEY_RANDOM_LENGTH) break;
    }
  }
  return MCP_KEY_PREFIX + out;
}

/** SHA-256 hex of a key — the api_keys lookup value. crypto.subtle exists on
 *  both Workers and Node 24, and the auth middleware is already async. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Storage id for a key's auth-cache entry in useStorage('cache') — the KV
 * CACHE binding on Cloudflare, in-memory in dev. Keyed on the HASH so the
 * plaintext credential never lands in a storage key.
 */
export function keyCacheId(keyHash: string): string {
  return `mcp-key:${keyHash}`;
}

/** Positive entries live this long; a lapsed subscription downgrades within it.
 *  Revocation and post-checkout upgrades purge entries directly instead of
 *  waiting it out. Cloudflare KV's minimum TTL is 60s — keep both above that. */
export const MCP_KEY_CACHE_TTL_SECONDS = 300;
export const MCP_KEY_NEGATIVE_CACHE_TTL_SECONDS = 60;

/** What the auth cache holds for a hash. */
export type McpKeyCacheEntry =
  | { ok: false }
  | { ok: true; keyId: string; userId: string; tier: 'free' | 'developer'; keyPrefix: string };

/** What mcp-auth stashes on event.context for rate-limit / tiering / usage. */
export interface McpAuthContext {
  tier: McpTier;
  keyId?: string;
  userId?: string;
  keyPrefix?: string;
}

export function getMcpAuth(event: H3Event): McpAuthContext | undefined {
  return (event.context as { mcpAuth?: McpAuthContext } | undefined)?.mcpAuth;
}

export function setMcpAuth(event: H3Event, ctx: McpAuthContext): void {
  (event.context as { mcpAuth?: McpAuthContext }).mcpAuth = ctx;
}
