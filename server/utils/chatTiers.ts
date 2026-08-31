import type { H3Event } from 'h3';
import type { ChatTier } from '../../shared/utils/chatTiers';

/**
 * Server-only half of the chat tier contract: the per-request context
 * accessors and the cache key. The client-safe constants live in
 * `shared/utils/chatTiers.ts` and are re-exported here so server code keeps a
 * single import path.
 */
export { CHAT_QUOTAS, MEMBERSHIP_URL, SUSTAINING_PRODUCT_ID } from '../../shared/utils/chatTiers';
export type { ChatQuota, ChatTier } from '../../shared/utils/chatTiers';

/**
 * Cache TTLs, reused from the MCP contract rather than invented.
 *
 * A lapsed membership downgrades within the positive TTL; a fresh checkout is
 * purged directly rather than waited out (see server/api/developer/refresh.post.ts
 * for the equivalent on the MCP side). Cloudflare KV's minimum TTL is 60s, so
 * both stay above it.
 */
export const CHAT_TIER_CACHE_TTL_SECONDS = 300;

/**
 * Storage id for a resolved membership.
 *
 * Keyed on a HASH OF THE ACCESS TOKEN, not the user id, so a cache hit can skip
 * the Supabase `getUser` round trip entirely rather than only the cheaper RPC
 * behind it. Hashing is what keeps a plaintext credential out of a storage key
 * — the same reasoning as `keyCacheId` in mcpTiers.
 */
export function chatTierCacheId(tokenHash: string): string {
  return `chat-tier:${tokenHash}`;
}

/** What `chat-auth` stashes on `event.context` for the route and the limiter. */
export interface ChatAuthContext {
  tier: ChatTier;
  /** Absent for the anonymous tier — there is no account to count against. */
  userId?: string;
}

export function getChatAuth(event: H3Event): ChatAuthContext | undefined {
  return (event.context as { chatAuth?: ChatAuthContext } | undefined)?.chatAuth;
}

export function setChatAuth(event: H3Event, ctx: ChatAuthContext): void {
  (event.context as { chatAuth?: ChatAuthContext }).chatAuth = ctx;
}
