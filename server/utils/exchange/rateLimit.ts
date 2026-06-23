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

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

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

  const entry = rateLimitStore.get(key);

  // No entry or expired - create new entry
  if (!entry || entry.resetAt < now) {
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
    // Get identifier (prefer user ID, fallback to IP)
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
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
