/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * Mirrors the in-memory approach already used by server/utils/cache.ts. On
 * Vercel (Fluid Compute) the counter lives per warm function instance rather
 * than in shared storage, so it is an abuse *dampener*, not a hard global
 * quota — enough to stop a single client scripting thousands of requests/min
 * without standing up Redis/KV.
 *
 * Memory is strictly bounded: the map never exceeds MAX_TRACKED_KEYS. Expired
 * buckets are swept lazily (throttled to avoid an O(N) scan on every request),
 * and if the map is still at capacity we evict the oldest entries in O(1) via
 * Map insertion order. This prevents a flood of unique keys (e.g. spoofed IPs)
 * from either leaking memory or blocking the event loop.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when the current window ends
}

const buckets = new Map<string, Bucket>();

// Hard ceiling on tracked keys; we never let the map grow past this.
const MAX_TRACKED_KEYS = 50_000;

// Throttle full sweeps so a saturated map can't trigger an O(N) scan on every
// request (a self-inflicted DoS vector).
const SWEEP_INTERVAL_MS = 10_000;
let lastSweep = 0;

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

/** Remove expired buckets, at most once per SWEEP_INTERVAL_MS. */
function sweepExpired(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Strictly bound the map before inserting a new key. */
function makeRoomForNewKey(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  sweepExpired(now);
  // If the (possibly throttled) sweep didn't free enough, evict oldest-inserted
  // entries in O(1) until under the cap — never an O(N) search.
  while (buckets.size >= MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

/**
 * Record one hit against `key` and report whether it exceeds the limit.
 * Calling this IS the increment — call it exactly once per request.
 */
export function consumeRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // Only bound the map when we're about to add a genuinely new key.
    if (bucket === undefined) makeRoomForNewKey(now);
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const limited = bucket.count > opts.max;
  const remaining = Math.max(0, opts.max - bucket.count);
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return { limited, remaining, resetAt: bucket.resetAt, retryAfter };
}

/** Test/maintenance helper: clear all tracked buckets and sweep state. */
export function _resetRateLimitStore(): void {
  buckets.clear();
  lastSweep = 0;
}
