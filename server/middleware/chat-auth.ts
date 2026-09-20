import { getServiceClient } from '../utils/supabase';
import { extractAccessToken, isUserBanned } from '../utils/userAuth';
import { chatTierForPlan, type ChatTier } from '../../shared/utils/chatTiers';
import { CHAT_TIER_CACHE_TTL_SECONDS, chatTierCacheId, setChatAuth } from '../utils/chatTiers';
import { sha256Hex } from '../utils/mcpTiers';

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
 *   - a plan we do not know    → member (paid is proven, the size is not)
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
const CHAT_TIERED_PATHS = new Set(['/api/chat', '/api/chat/quota']);

export default defineEventHandler(async (event) => {
  // Exact matches, not a prefix. `startsWith('/api/chat')` would silently apply
  // chat tiering and the chat quota to a future `/api/chat-export` or
  // `/api/chatbot-admin`, surfacing only as unexplained 429s. The quota peek is
  // listed because it must answer for the SAME caller the chat route would see.
  const { pathname } = getRequestURL(event);
  if (!CHAT_TIERED_PATHS.has(pathname)) return;

  // No token is the common case — the assistant is public. Cheapest path first,
  // and it must never touch the database.
  const accessToken = extractAccessToken(event);
  if (!accessToken) {
    setChatAuth(event, { tier: 'anonymous' });
    return;
  }

  try {
    const cacheStorage = useStorage('cache');

    // Keyed on a HASH OF THE TOKEN, checked BEFORE `getUser`.
    //
    // Keying on the user id instead meant every signed-in message paid a full
    // Supabase auth round trip before the cache was even consulted, so the
    // cache only ever saved the RPC — a local index lookup — while the
    // expensive part ran every time, on the request path of a streaming route
    // whose time-to-first-token is the metric being tracked.
    //
    // The token is never stored: only its SHA-256, via the same helper the MCP
    // key cache uses, so a plaintext credential cannot land in a storage key.
    const cacheId = chatTierCacheId(await sha256Hex(accessToken));
    const cached = (await cacheStorage.getItem(cacheId).catch(() => null)) as {
      tier: ChatTier;
      userId: string;
    } | null;
    if (cached?.tier) {
      setChatAuth(event, { tier: cached.tier, userId: cached.userId });
      return;
    }

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

    // A valid access token keeps working until it expires even after we ban the
    // account, so without this a banned scammer keeps the member allowance on a
    // route that spends real money for the rest of the token's life.
    // `requireUserAuth` gates every other authenticated surface the same way.
    // Note the fail direction still holds: isUserBanned fails OPEN internally,
    // so an unavailable ban lookup does not lock anyone out of the chat.
    if (await isUserBanned(supabase, user.id)) {
      setChatAuth(event, { tier: 'anonymous' });
      return;
    }

    // The account is proven at this point, so the floor is 'free'. Only the
    // membership perk is in question. `get_membership_plan` is the
    // `user_has_subscription` predicate returning the granting row's plan
    // instead of a boolean, so one round trip yields both "is a member" and
    // "which allowance": NULL → free, base → member, plus / pro → themselves.
    // It is service-role only, which this client is.
    let tier: ChatTier = 'free';
    const { data: plan, error: subErr } = await supabase.rpc('get_membership_plan', {
      p_user_id: user.id,
    });

    if (subErr) {
      console.error(`[Chat Auth] get_membership_plan lookup failed: ${subErr.message}`);
    } else {
      tier = chatTierForPlan(plan);
    }

    // A degraded resolution is NOT cached. Writing { tier: 'free' } for a member
    // during a transient RPC hiccup would hold them at the lower quota for the
    // full TTL; skipping the write means the next request retries.
    if (!subErr) {
      const write = cacheStorage
        .setItem(cacheId, { tier, userId: user.id }, { ttl: CHAT_TIER_CACHE_TTL_SECONDS })
        .catch(() => {});
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
