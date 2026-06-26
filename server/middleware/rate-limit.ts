import { consumeRateLimit } from '../utils/rateLimit';

/**
 * Per-IP rate limiting for two classes of abuse-prone traffic:
 *
 *   1. The public, UNAUTHENTICATED LangGraph AI proxy (`/api/langgraph/**`).
 *      The chat is intentionally open to every site visitor (no login), so this
 *      throttle is the only thing between an anonymous scripted caller and
 *      unbounded LLM runs billed to our LangSmith key.
 *
 *   2. Mutating requests to the rest of the JSON API (POST/PUT/PATCH/DELETE on
 *      `/api/**`). These are the content-submission surfaces — registry/wheel/
 *      color/model submissions, comments, gear & alignment configs, uploads.
 *      A spam account that scripts these could flood the moderation queue or
 *      drop scam links across the site. The limit is generous enough that a
 *      real person clicking through forms never approaches it, while an abuse
 *      loop blows past in seconds. This complements (does not replace) the
 *      Turnstile challenge on login and the Vercel BotID guards on high-value
 *      POSTs — see docs/runbooks/2026-06-15-botid-endpoint-protection.md.
 *
 * Limits are tunable without a code change via env:
 *   LANGGRAPH_RATELIMIT_MAX / LANGGRAPH_RATELIMIT_WINDOW_MS  (chat)
 *   WRITE_RATELIMIT_MAX      / WRITE_RATELIMIT_WINDOW_MS      (mutations)
 *
 * Note: the counter is per warm serverless instance (see utils/rateLimit.ts),
 * so this dampens abuse rather than enforcing a precise global quota.
 */
const LANGGRAPH_WINDOW_MS = Number(process.env.LANGGRAPH_RATELIMIT_WINDOW_MS) || 60_000;
const LANGGRAPH_MAX = Number(process.env.LANGGRAPH_RATELIMIT_MAX) || 40;

const WRITE_WINDOW_MS = Number(process.env.WRITE_RATELIMIT_WINDOW_MS) || 60_000;
const WRITE_MAX = Number(process.env.WRITE_RATELIMIT_MAX) || 30;

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Paths exempt from the mutation throttle. `/api/admin/**` is excluded so a
 * moderator working through the review queue (bulk approve/reject) is never
 * throttled mid-session — admin access is already gated by requireAdminAuth.
 * `/api/langgraph` is handled by its own (stricter, unauthenticated) policy
 * above and must not be double-counted here.
 */
const WRITE_EXEMPT_PREFIXES = ['/api/langgraph', '/api/admin'];

/**
 * Resolve the client IP for keying. On Vercel, 'x-real-ip' is set by the edge
 * proxy and cannot be spoofed by the client, so it is preferred. The left-most
 * 'x-forwarded-for' entry (what getRequestIP returns) IS client-controllable
 * and would otherwise let an attacker rotate the header to dodge the limit;
 * it is only the fallback for non-Vercel/local environments.
 */
function clientIp(event: any): string {
  return getHeader(event, 'x-real-ip') || getRequestIP(event, { xForwardedFor: true }) || 'unknown';
}

function applyLimit(event: any, key: string, max: number, windowMs: number, message: string) {
  const result = consumeRateLimit(key, { max, windowMs });

  setHeader(event, 'X-RateLimit-Limit', String(max));
  setHeader(event, 'X-RateLimit-Remaining', String(result.remaining));
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (result.limited) {
    setHeader(event, 'Retry-After', String(result.retryAfter));
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message,
    });
  }
}

export default defineEventHandler((event) => {
  const { pathname } = getRequestURL(event);

  // Policy 1: the public AI chat proxy.
  if (pathname.startsWith('/api/langgraph')) {
    applyLimit(
      event,
      `langgraph:${clientIp(event)}`,
      LANGGRAPH_MAX,
      LANGGRAPH_WINDOW_MS,
      'Too many AI chat requests from your network. Please wait a moment and try again.'
    );
    return;
  }

  // Policy 2: mutating requests to the rest of the API.
  if (
    pathname.startsWith('/api/') &&
    WRITE_METHODS.has(event.method) &&
    // Match on a path-segment boundary so a prefix of '/api/admin' exempts
    // '/api/admin' and '/api/admin/...' but NOT '/api/admin-foo'.
    !WRITE_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
  ) {
    applyLimit(
      event,
      `write:${clientIp(event)}`,
      WRITE_MAX,
      WRITE_WINDOW_MS,
      'Too many requests from your network. Please slow down and try again in a minute.'
    );
  }
});
