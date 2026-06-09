import { consumeRateLimit } from '../utils/rateLimit';

/**
 * Per-IP rate limiting for the public, UNAUTHENTICATED LangGraph AI proxy
 * (/api/langgraph/**). The chat is intentionally open to every site visitor
 * (no login required), so this throttle is the only thing between an anonymous
 * scripted caller and unbounded LLM runs billed to our LangSmith key.
 *
 * Limits are deliberately generous: the chat makes ~1 request per user message
 * (thread creation is folded into the stream call), so a real visitor never
 * approaches them, while an abuse loop blows past in seconds. Tune without a
 * code change via env: LANGGRAPH_RATELIMIT_MAX / LANGGRAPH_RATELIMIT_WINDOW_MS.
 *
 * Note: the counter is per warm serverless instance (see utils/rateLimit.ts),
 * so this dampens abuse rather than enforcing a precise global quota.
 */
const WINDOW_MS = Number(process.env.LANGGRAPH_RATELIMIT_WINDOW_MS) || 60_000;
const MAX = Number(process.env.LANGGRAPH_RATELIMIT_MAX) || 40;

export default defineEventHandler((event) => {
  const { pathname } = getRequestURL(event);
  if (!pathname.startsWith('/api/langgraph')) return;

  // Resolve the client IP for keying. On Vercel, 'x-real-ip' is set by the edge
  // proxy and cannot be spoofed by the client, so it is preferred. The left-most
  // 'x-forwarded-for' entry (what getRequestIP returns) IS client-controllable
  // and would otherwise let an attacker rotate the header to dodge the limit;
  // it is only the fallback for non-Vercel/local environments.
  const ip = getHeader(event, 'x-real-ip') || getRequestIP(event, { xForwardedFor: true }) || 'unknown';

  const result = consumeRateLimit(`langgraph:${ip}`, { max: MAX, windowMs: WINDOW_MS });

  setHeader(event, 'X-RateLimit-Limit', String(MAX));
  setHeader(event, 'X-RateLimit-Remaining', String(result.remaining));
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (result.limited) {
    setHeader(event, 'Retry-After', String(result.retryAfter));
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many AI chat requests from your network. Please wait a moment and try again.',
    });
  }
});
