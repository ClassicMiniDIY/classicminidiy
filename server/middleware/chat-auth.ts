import { getServiceClient } from '../utils/supabase';
import { extractAccessToken } from '../utils/userAuth';
import {
  CHAT_TIER_CACHE_TTL_SECONDS,
  SUSTAINING_PRODUCT_ID,
  chatTierCacheId,
  setChatAuth,
  type ChatTier,
} from '../utils/chatTiers';

/**
 * Resolve who is asking the assistant, for `/api/chat` only.
 *
 * ## This gate FAILS OPEN. That is deliberate, and it is the opposite of mcp-auth.
 *
 * `server/middleware/mcp-auth.ts` fails closed: it is a paid API, so an
 * unresolvable credential must be denied. This is a PUBLIC assistant, and the
 * invariant in CLAUDE.md is that `/api/chat` must never *require* auth — a 401
 * is never a valid response from it. So every uncertainty here resolves
 * DOWNWARD to a working tier rather than to an error:
 *
 *   - no token                → anonymous
 *   - a token we cannot verify → anonymous
 *   - Supabase unreachable     → anonymous
 *   - membership RPC errors    → free (the account is proven, the perk is not)
 *
 * A Supabase outage therefore degrades a member to anonymous limits. It does
 * not 503 the chat. Denying would break the surface's entire reason to exist,
 * and the cost of being wrong in this direction is a handful of extra messages.
 *
 * ## Ordering
 *
 * Nitro runs middleware in FILENAME order, and `chat-auth` sorts before
 * `rate-limit`. That is load-bearing and invisible: the limiter reads the tier
 * this sets, and `mcp-auth` already depends on the same alphabetical guarantee.
 * Renaming this file to something after "rate-limit" would silently drop every
 * request to the anonymous budget.
 *
 * ## Cost
 *
 * Resolution runs at most once per user per TTL — the result is cached in
 * `useStorage('cache')`, which is the KV binding on Cloudflare. Anonymous
 * requests do no I/O at all: no token, no lookup.
 */
export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event);
  if (!pathname.startsWith('/api/chat')) return;

  // No token is the common case — the assistant is public. Cheapest path first,
  // and it must never touch the database.
  const accessToken = extractAccessToken(event);
  if (!accessToken) {
    setChatAuth(event, { tier: 'anonymous' });
    return;
  }

  try {
    const supabase = getServiceClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(accessToken);

    if (userErr || !user) {
      // An expired or forged token is not an error worth surfacing here; the
      // caller simply gets the public tier.
      setChatAuth(event, { tier: 'anonymous' });
      return;
    }

    const cacheStorage = useStorage('cache');
    const cacheId = chatTierCacheId(user.id);

    const cached = (await cacheStorage.getItem(cacheId).catch(() => null)) as { tier: ChatTier } | null;
    if (cached?.tier) {
      setChatAuth(event, { tier: cached.tier, userId: user.id });
      return;
    }

    // The account is proven at this point, so the floor is 'free'. Only the
    // membership perk is in question.
    let tier: ChatTier = 'free';
    const { data: hasSub, error: subErr } = await supabase.rpc('user_has_subscription', {
      p_user_id: user.id,
      p_product_id: SUSTAINING_PRODUCT_ID,
    });

    if (subErr) {
      console.error(`[Chat Auth] user_has_subscription lookup failed: ${subErr.message}`);
    } else if (hasSub === true) {
      tier = 'member';
    }

    // A degraded resolution is NOT cached. Writing { tier: 'free' } for a member
    // during a transient RPC hiccup would hold them at the lower quota for the
    // full TTL; skipping the write means the next request retries.
    if (!subErr) {
      const write = cacheStorage.setItem(cacheId, { tier }, { ttl: CHAT_TIER_CACHE_TTL_SECONDS }).catch(() => {});
      (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(write);
    }

    setChatAuth(event, { tier, userId: user.id });
  } catch (error: any) {
    // Infrastructure failure. Fail OPEN, per the note above: the assistant keeps
    // working for everyone at the public quota rather than going down.
    console.error(`[Chat Auth] tier resolution failed, degrading to anonymous: ${error?.message ?? error}`);
    setChatAuth(event, { tier: 'anonymous' });
  }
});
