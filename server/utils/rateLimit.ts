/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * Mirrors the in-memory approach already used by server/utils/cache.ts. On
 * Vercel (Fluid Compute) the counter lives per warm function instance rather
 * than in shared storage, so it is an abuse *dampener*, not a hard global
 * quota — enough to stop a single client scripting thousands of requests/min
 * without standing up Redis/KV. Buckets self-expire and are swept lazily so
 * the map cannot grow unbounded under a flood of unique keys.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when the current window ends
}

const buckets = new Map<string, Bucket>();

// Hard cap so a flood of distinct keys (e.g. spoofed IPs) cannot grow the map
// without bound; we sweep expired entries before inserting past this size.
const MAX_TRACKED_KEYS = 50_000;

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  limited: boolean;
  /** Requests remaining in the current window (0 once limited). */
  remaining: number;
  /** Epoch ms at which the current window resets. */
  resetAt: number;
  /** Seconds until the window resets — suitable for a Retry-After header. */
  retryAfter: number;
}

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record one hit against `key` and report whether it exceeds the limit.
 * Calling this IS the increment — call it exactly once per request.
 */
export function consumeRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup before we risk inserting a brand-new key past the cap.
  if (buckets.size >= MAX_TRACKED_KEYS) sweepExpired(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const limited = bucket.count > opts.max;
  const remaining = Math.max(0, opts.max - bucket.count);
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return { limited, remaining, resetAt: bucket.resetAt, retryAfter };
}

/** Test/maintenance helper: clear all tracked buckets. */
export function _resetRateLimitStore(): void {
  buckets.clear();
}
