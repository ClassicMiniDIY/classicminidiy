// TODO: Migrate to Redis/Upstash for distributed rate limiting in production.
// The current in-memory Map resets on every server restart/deployment.

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (will reset on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Hard ceiling on tracked keys; the map never grows past this. A flood of
// unique identifiers (e.g. spoofed IPs) would otherwise leak memory and slow
// the periodic sweep — a self-inflicted DoS vector. See server/utils/rateLimit.ts.
const MAX_TRACKED_KEYS = 50_000;

// Expired entries are swept lazily on access (throttled below), NOT via a
// module-level setInterval. This file is bundled into Nitro's core chunk, so a
// module-level timer also runs inside the prerender process at build time and
// keeps the Node event loop alive after `nuxi build` finishes — which is
// exactly what hung every Vercel deploy at "Build complete!" until the 45-min
// build timeout (2026-06/07 deploy-stall incident). Do not reintroduce a
// timer here; mirror server/utils/rateLimit.ts (lazy throttled sweep).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = 0;

/** Remove expired entries, at most once per SWEEP_INTERVAL_MS. */
function sweepExpired(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/** Strictly bound the map before inserting a new key. */
function makeRoomForNewKey(now: number): void {
  if (rateLimitStore.size < MAX_TRACKED_KEYS) return;
  // First reclaim any expired entries.
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
  // If still at capacity, evict oldest-inserted entries in O(1) via Map
  // insertion order until under the cap — never an O(N) search.
  while (rateLimitStore.size >= MAX_TRACKED_KEYS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitStore.delete(oldestKey);
  }
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

/**
 * Rate limit a request
 * @param identifier - Unique identifier (IP, user ID, email, etc.)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const { maxRequests, windowMs, keyPrefix = 'rl' } = config;
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();

  sweepExpired(now);

  const entry = rateLimitStore.get(key);

  // No entry or expired - create new entry
  if (!entry || entry.resetAt < now) {
    // Only bound the map when we're about to add a genuinely new key.
    if (!entry) makeRoomForNewKey(now);
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Rate limit middleware for API endpoints
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (event: any) => {
    // Resolve the client IP for keying. On Vercel, 'x-real-ip' is set by the
    // edge proxy and cannot be spoofed by the client, so it is preferred. The
    // left-most 'x-forwarded-for' entry (what getRequestIP returns) IS
    // client-controllable and would let an attacker rotate the header to dodge
    // the limit; it is only the fallback for non-Vercel/local environments.
    const ip = getHeader(event, 'x-real-ip') || getRequestIP(event, { xForwardedFor: true }) || 'unknown';
    const identifier = event.context.user?.id || ip;

    const result = checkRateLimit(identifier, config);

    // Set rate limit headers
    setResponseHeader(event, 'X-RateLimit-Limit', config.maxRequests.toString());
    setResponseHeader(event, 'X-RateLimit-Remaining', result.remaining.toString());
    setResponseHeader(event, 'X-RateLimit-Reset', new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      setResponseHeader(event, 'Retry-After', retryAfter.toString());

      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      });
    }

    return result;
  };
}

/** Test/maintenance helper: clear all tracked entries. */
export function _resetExchangeRateLimitStore(): void {
  rateLimitStore.clear();
  lastSweep = 0;
}

/** Test helper: current number of tracked keys. */
export function _rateLimitStoreSize(): number {
  return rateLimitStore.size;
}

/** Exposed for tests so eviction can be exercised without inserting 50k keys. */
export const _MAX_TRACKED_KEYS = MAX_TRACKED_KEYS;

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
  // Strict limits for sensitive operations
  strict: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Moderate limits for standard API endpoints
  moderate: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // Lenient limits for read operations
  lenient: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  // Very lenient for authenticated users
  authenticated: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;
