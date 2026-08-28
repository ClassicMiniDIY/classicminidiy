import type { H3Event } from 'h3';

/**
 * Resolve the client IP for rate-limit keying. Order matters: the key must come
 * from a header the SERVING PLATFORM sets, never one the caller can choose, or
 * the limit binds to a value the caller controls and stops being a limit.
 *
 * 'cf-connecting-ip' is first because production is Cloudflare Workers, and
 * Cloudflare sets it on every request it proxies — the authoritative source
 * here. 'x-real-ip' stays second for non-Cloudflare environments that set it;
 * it is NOT authoritative on Cloudflare and must never be consulted first.
 * getRequestIP's left-most 'x-forwarded-for' entry is a degraded last resort.
 *
 * Shared by server/middleware/rate-limit.ts and server/middleware/mcp-auth.ts
 * (the failed-key lookup throttle) so the two key on the same identity.
 */
export function clientIp(event: H3Event): string {
  return (
    getHeader(event, 'cf-connecting-ip') ||
    getHeader(event, 'x-real-ip') ||
    getRequestIP(event, { xForwardedFor: true }) ||
    'unknown'
  );
}
