import type { H3Event } from 'h3';
import { getServiceClient } from './supabase';
import { ANON_CHAT_SESSION_COOKIE, CHAT_QUOTAS, MEMBERSHIP_URL } from '../../shared/utils/chatTiers';
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
 *   Anonymous  — approximate, in KV, keyed on a random session id in a cookie.
 *                There is no account to count against, and the alternative —
 *                hashing the IP — buys precision with privacy surface for a
 *                bound that only needs to stop casual abuse. Clearing cookies
 *                resets it; that is acceptable, because the scripted case is
 *                held by the Cloudflare zone rule and the in-process limiter,
 *                not by this.
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
}

function anonCounterId(sessionId: string): string {
  return `chat-anon:${sessionId}`;
}

/**
 * Read, or mint, the anonymous session id.
 *
 * `httpOnly` so page scripts cannot read or forge it, `sameSite: 'lax'` so it
 * survives ordinary navigation to /chat. It carries no personal data — it is a
 * random opaque id whose only job is to make a daily count possible without
 * storing anything about who the visitor is.
 */
function anonSessionId(event: H3Event): string {
  const existing = getCookie(event, ANON_CHAT_SESSION_COOKIE);
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;

  const minted = crypto.randomUUID().replace(/-/g, '');
  setCookie(event, ANON_CHAT_SESSION_COOKIE, minted, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
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
  const quota = CHAT_QUOTAS[tier];

  if (tier === 'anonymous') {
    if (quota.perDay === null) return { allowed: true };
    try {
      const storage = useStorage('cache');
      const id = anonCounterId(anonSessionId(event));
      const used = Number((await storage.getItem(id)) ?? 0) + 1;
      // TTL is refreshed on every write, so this is a rolling window rather
      // than a calendar day. That is the friendlier reading for a visitor who
      // starts chatting late in the evening.
      await storage.setItem(id, used, { ttl: ANON_WINDOW_SECONDS });
      return { allowed: used <= quota.perDay, used, limit: quota.perDay };
    } catch (error: any) {
      console.error(`[Chat Quota] anonymous counter unavailable, allowing: ${error?.message ?? error}`);
      return { allowed: true };
    }
  }

  const userId = getChatAuth(event)?.userId;
  if (!userId || quota.perMonth === null) return { allowed: true };

  try {
    const { data, error } = await getServiceClient().rpc('consume_chat_quota', {
      p_user_id: userId,
      p_monthly_limit: quota.perMonth,
    });
    if (error) {
      console.error(`[Chat Quota] consume_chat_quota failed, allowing: ${error.message}`);
      return { allowed: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: row?.allowed !== false,
      used: row?.used ?? undefined,
      limit: quota.perMonth,
    };
  } catch (error: any) {
    console.error(`[Chat Quota] consume_chat_quota threw, allowing: ${error?.message ?? error}`);
    return { allowed: true };
  }
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
  const upgrade =
    tier === 'member'
      ? 'You have reached this month’s message limit. It resets at the start of next month.'
      : `You have reached the ${tier === 'anonymous' ? 'daily' : 'monthly'} message limit. ` +
        `Sustaining Members get a much higher allowance — ${MEMBERSHIP_URL}`;

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

  (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(write);
}
