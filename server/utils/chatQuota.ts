import type { H3Event } from 'h3';
import { getServiceClient } from './supabase';
import { clientIp } from './clientIp';
import { serverRuntimeConfig } from './runtimeConfig';
import {
  ANON_CHAT_SESSION_COOKIE,
  CHAT_QUOTAS,
  MEMBERSHIP_URL,
  nextTier,
  type ChatTier,
} from '../../shared/utils/chatTiers';
import { getChatAuth } from './chatTiers';

/**
 * Quota enforcement for `/api/chat`.
 *
 * Two counters, because the two tiers are countable in different ways:
 *
 *   Signed in  — exact, in Postgres, keyed on the user id. A month-scoped
 *                counter belongs in a database, not in KV (eventually
 *                consistent, last-write-wins) and not in a Durable Object
 *                (real integration cost for a number that changes forty times
 *                a month).
 *   Anonymous  — approximate, in KV, keyed on a cookie session id for browsers
 *                and on a SALTED HASH of the IP for everything else. There is
 *                no account to count against, so the identity has to be
 *                synthesised, and it must not be synthesised from something the
 *                caller can simply withhold: a cookie-only key is defeated by
 *                any client that ignores Set-Cookie, which would make the whole
 *                gate decorative — signing out, or using curl, would be the
 *                cheapest way past it. The IP is never stored raw; only a hash
 *                with a per-deployment salt, in a 24h-TTL KV entry.
 *
 * **Exhausting a quota is a 429, never a 401.** `/api/chat` must stay usable by
 * everyone — see the invariant in CLAUDE.md. The response carries an upgrade
 * pointer, the same posture as the MCP free-tier gated result.
 */

/** Rolling window for the anonymous counter. */
const ANON_WINDOW_SECONDS = 24 * 60 * 60;

export interface QuotaVerdict {
  allowed: boolean;
  /** Messages used in the window after this call, when known. */
  used?: number;
  limit?: number;
  /**
   * The ceiling could not be evaluated and the request was allowed anyway.
   * Surfaced on `chat_run_completed` so a broken counter is visible as data
   * rather than as an absence of enforcement nobody notices.
   */
  degraded?: boolean;
}

/**
 * Stable-ish identity for an anonymous caller, and the counter key for it.
 *
 * A browser that accepts cookies is counted per browser, which is the friendlier
 * unit — two people behind one office NAT get their own allowance. Anything that
 * does NOT return the cookie falls back to a salted hash of the IP, so a
 * scripted client cannot mint a fresh allowance per request just by dropping
 * Set-Cookie.
 *
 * The salt matters. Without one, a hashed IPv4 is trivially reversible — the
 * whole space is 2^32 and rainbow-tabling it is minutes of work — so the digest
 * would be personal data in everything but name. Salted with a server-side
 * secret it is an opaque bucket id. `NUXT_OG_IMAGE_SECRET` is reused as the salt
 * rather than adding another secret to provision, since it is already required
 * on every deployment and never leaves the worker.
 */
async function anonBucketId(event: H3Event, salt: string): Promise<string> {
  const cookieId = getCookie(event, ANON_CHAT_SESSION_COOKIE);
  if (cookieId && /^[A-Za-z0-9_-]{16,64}$/.test(cookieId)) return `chat-anon:c:${cookieId}`;

  const minted = mintAnonSession(event);
  const ip = clientIp(event);
  if (ip === 'unknown') return `chat-anon:c:${minted}`;
  return ipBucketId(ip, salt);
}

/** The salted-IP bucket, shared by the spend and the peek so they cannot drift. */
async function ipBucketId(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  const hex = Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `chat-anon:i:${hex}`;
}

/**
 * Read, or mint, the anonymous session id.
 *
 * `httpOnly` so page scripts cannot read or forge it, `sameSite: 'lax'` so it
 * survives ordinary navigation to /chat. It carries no personal data — it is a
 * random opaque id whose only job is to make a daily count possible without
 * storing anything about who the visitor is.
 */
function mintAnonSession(event: H3Event): string {
  const minted = crypto.randomUUID().replace(/-/g, '');
  setCookie(event, ANON_CHAT_SESSION_COOKIE, minted, {
    httpOnly: true,
    sameSite: 'lax',
    // Secure everywhere except local development.
    //
    // Browsers refuse to STORE a Secure cookie sent over http://localhost, so
    // in dev the cookie never came back, every request fell through to the IP
    // fallback, and one machine shared a single 15-a-day allowance across every
    // browser and tab on it — which reads as the quota being broken rather than
    // as a cookie that was never kept.
    //
    // Keyed on the BUILD flag, never on the request's host or forwarded
    // protocol: those are caller-supplied, so a spoofed `Host: localhost` would
    // otherwise be enough to ask production for a non-Secure cookie.
    // `import.meta.dev` is fixed at build time and no request can influence it.
    secure: !import.meta.dev,
    path: '/',
    maxAge: ANON_WINDOW_SECONDS,
  });
  return minted;
}

/**
 * Consume one message from the caller's quota.
 *
 * Called BEFORE the model runs — a quota checked after the fact is not a quota.
 * Every failure path allows the request: a counter that cannot be read must not
 * take the assistant down, and the in-process limiter plus the zone rule are
 * still underneath.
 */
export async function consumeChatQuota(event: H3Event): Promise<QuotaVerdict> {
  const tier = getChatAuth(event)?.tier ?? 'anonymous';

  if (tier === 'anonymous') {
    // Read the tier's OWN entry rather than an indexed union: the quotas are
    // declared `as const satisfies`, so this is the literal 15 and the
    // per-tier nullability lives in the type instead of in guards that cannot
    // fire.
    const limit = CHAT_QUOTAS.anonymous.perDay;
    try {
      const storage = useStorage('cache');
      const salt = (serverRuntimeConfig(event).OG_IMAGE_SECRET as string) || 'cmdiy-anon-salt';
      const id = await anonBucketId(event, salt);

      // `Number.isFinite`, not a bare `Number(...)`: a non-numeric entry would
      // otherwise yield NaN, and `NaN <= limit` is false — refusing the caller
      // forever while the next write stores NaN again and refreshes the TTL.
      // A garbage value has to reset the count, not weaponise it.
      const raw = Number(await storage.getItem(id));
      const previous = Number.isFinite(raw) && raw >= 0 ? raw : 0;

      if (previous >= limit) {
        // Do NOT write. Counting a refused attempt lets someone already over
        // the ceiling inflate their own total, and refreshing the TTL on every
        // retry would hold the window open indefinitely — turning a 24h bound
        // into a permanent lockout for anyone who kept clicking. The Postgres
        // path deliberately behaves the same way.
        return { allowed: false, used: previous, limit };
      }

      const used = previous + 1;
      // TTL is refreshed only on an ALLOWED call, so the window rolls off 24h
      // after the last accepted message rather than the last attempt.
      await storage.setItem(id, used, { ttl: ANON_WINDOW_SECONDS });
      return { allowed: true, used, limit };
    } catch (error: any) {
      // Fail open for this request, but say so on the run event: a KV binding
      // that breaks after a deploy would otherwise leave anonymous chat
      // completely unbounded with nothing but a console line to show for it.
      console.error(`[Chat Quota] anonymous counter unavailable, allowing: ${error?.message ?? error}`);
      return { allowed: true, degraded: true };
    }
  }

  const monthlyLimit = CHAT_QUOTAS[tier].perMonth;
  const userId = getChatAuth(event)?.userId;
  // A signed-in tier with no user id should be impossible — chat-auth sets them
  // together — but allowing beats throwing on a route that must stay up.
  if (!userId) return { allowed: true, degraded: true };

  try {
    const { data, error } = await getServiceClient().rpc('consume_chat_quota', {
      p_user_id: userId,
      p_monthly_limit: monthlyLimit,
    });
    if (error) {
      console.error(`[Chat Quota] consume_chat_quota failed, allowing: ${error.message}`);
      return { allowed: true, degraded: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: row?.allowed !== false,
      used: row?.used ?? undefined,
      limit: monthlyLimit,
    };
  } catch (error: any) {
    console.error(`[Chat Quota] consume_chat_quota threw, allowing: ${error?.message ?? error}`);
    return { allowed: true, degraded: true };
  }
}

export interface QuotaPeek {
  tier: ChatTier;
  /** Messages used in the current window, or null when the counter could not be read. */
  used: number | null;
  limit: number;
}

/**
 * Read the caller's quota WITHOUT consuming from it.
 *
 * Exists for the search palette's "Ask DIY Mini Bot" row, which changes its
 * copy and target when the allowance is spent (sign in / become a member /
 * resets on the 1st) — the moment of intent is the moment the offer lands.
 * `ChatWindow.vue` deliberately has no status read in front of every chat
 * load; this is fetched once per palette open, after the input has focus,
 * and never blocks a render.
 *
 * Reads the same counters `consumeChatQuota` writes, and nothing else: an
 * anonymous caller is looked up under the same bucket the spend would use —
 * the session cookie when the browser kept it, else the salted IP hash — and
 * is NOT minted a cookie here (a peek must not create state). A signed-in
 * caller's month is summed from `chat_usage_daily` directly rather than
 * through the consuming RPC. Every failure reads as "unknown", which the
 * client treats as available — the chat route still enforces the real
 * ceiling.
 */
export async function peekChatQuota(event: H3Event): Promise<QuotaPeek> {
  const auth = getChatAuth(event);
  const tier = auth?.tier ?? 'anonymous';

  if (tier === 'anonymous') {
    const limit = CHAT_QUOTAS.anonymous.perDay;
    try {
      // The same bucket the spend uses. A browser that drops Set-Cookie is
      // counted on its IP by consumeChatQuota, and a peek that answered 0 for
      // it would offer the bot to someone the chat route is about to refuse.
      const cookieId = getCookie(event, ANON_CHAT_SESSION_COOKIE);
      let id: string | null = null;
      if (cookieId && /^[A-Za-z0-9_-]{16,64}$/.test(cookieId)) {
        id = `chat-anon:c:${cookieId}`;
      } else {
        const ip = clientIp(event);
        if (ip !== 'unknown') {
          const salt = (serverRuntimeConfig(event).OG_IMAGE_SECRET as string) || 'cmdiy-anon-salt';
          id = await ipBucketId(ip, salt);
        }
      }
      if (!id) return { tier, used: 0, limit };
      const raw = Number(await useStorage('cache').getItem(id));
      return { tier, used: Number.isFinite(raw) && raw >= 0 ? raw : 0, limit };
    } catch (error: any) {
      console.error(`[Chat Quota] anonymous peek unavailable: ${error?.message ?? error}`);
      return { tier, used: null, limit };
    }
  }

  const limit = CHAT_QUOTAS[tier].perMonth;
  if (!auth?.userId) return { tier, used: null, limit };

  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    const { data, error } = await getServiceClient()
      .from('chat_usage_daily')
      .select('messages')
      .eq('user_id', auth.userId)
      .gte('day', monthStart.toISOString().slice(0, 10));
    if (error) {
      console.error(`[Chat Quota] peek failed: ${error.message}`);
      return { tier, used: null, limit };
    }
    // At most one row per day, so this sum never meets the PostgREST row cap.
    const used = (data ?? []).reduce((sum, row) => sum + (row.messages ?? 0), 0);
    return { tier, used, limit };
  } catch (error: any) {
    console.error(`[Chat Quota] peek threw: ${error?.message ?? error}`);
    return { tier, used: null, limit };
  }
}

/**
 * The human-readable half of the 429. Always names the tier ABOVE the one
 * just hit (design invariant 5): quoting the ceiling the caller already has
 * understates the upgrade by exactly the amount that makes it worth doing.
 * Pro has nowhere to go, so it gets the reset date instead.
 */
export function quotaExhaustedMessage(tier: ChatTier): string {
  const window = tier === 'anonymous' ? 'daily' : 'monthly';
  const next = nextTier(tier);
  if (!next) {
    return 'You have reached this month’s message limit. It resets at the start of next month.';
  }
  const nextLimit = CHAT_QUOTAS[next].perMonth;
  const offer =
    next === 'free'
      ? `Sign in for ${nextLimit} messages a month`
      : next === 'member'
        ? `Sustaining Members get ${nextLimit} messages a month`
        : `Member ${next === 'plus' ? 'Plus' : 'Pro'} gets ${nextLimit} messages a month`;
  return `You have reached the ${window} message limit. ${offer} — ${MEMBERSHIP_URL}`;
}

/**
 * The 429 a quota-exhausted caller receives.
 *
 * Deliberately not a 401 and deliberately not silent: it names the ceiling and
 * where to lift it, so the message is actionable rather than "try again", which
 * is advice that can never work for an exhausted quota.
 */
export function quotaExhaustedError(event: H3Event, verdict: QuotaVerdict) {
  const tier = getChatAuth(event)?.tier ?? 'anonymous';
  const upgrade = quotaExhaustedMessage(tier);

  return createError({
    statusCode: 429,
    statusMessage: 'Too Many Requests',
    message: upgrade,
    data: { tier, used: verdict.used, limit: verdict.limit, upgradeUrl: MEMBERSHIP_URL },
  });
}

/**
 * Record the tokens a finished run consumed, against the caller's account.
 *
 * Separate from `consumeChatQuota` because it happens AFTER the stream closes,
 * when the counts are known. Fire-and-forget and fully swallowed: this is
 * analytics, and a failed write must never turn a good answer into an error.
 * Anonymous callers are skipped — there is no account to attribute to, and
 * inventing one is exactly what the design avoids.
 */
export function recordChatTokens(event: H3Event, inputTokens: number, outputTokens: number): void {
  const userId = getChatAuth(event)?.userId;
  if (!userId || (!inputTokens && !outputTokens)) return;

  const write = getServiceClient()
    .rpc('record_chat_tokens', {
      p_user_id: userId,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
    })
    .then(
      ({ error }) => {
        if (error) console.error(`[Chat Quota] record_chat_tokens failed: ${error.message}`);
      },
      () => {}
    );

  (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(Promise.resolve(write));
}
