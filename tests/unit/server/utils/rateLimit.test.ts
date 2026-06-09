/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { consumeRateLimit, _resetRateLimitStore } from '~/server/utils/rateLimit';

describe('server/utils/rateLimit', () => {
  const opts = { max: 3, windowMs: 60_000 };

  beforeEach(() => {
    _resetRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to max, then limits', () => {
    expect(consumeRateLimit('ip-a', opts).limited).toBe(false); // 1
    expect(consumeRateLimit('ip-a', opts).limited).toBe(false); // 2
    expect(consumeRateLimit('ip-a', opts).limited).toBe(false); // 3 (== max)
    expect(consumeRateLimit('ip-a', opts).limited).toBe(true); // 4 (> max)
  });

  it('reports remaining counting down to zero', () => {
    expect(consumeRateLimit('ip-b', opts).remaining).toBe(2);
    expect(consumeRateLimit('ip-b', opts).remaining).toBe(1);
    expect(consumeRateLimit('ip-b', opts).remaining).toBe(0);
    expect(consumeRateLimit('ip-b', opts).remaining).toBe(0); // stays 0 once over
  });

  it('tracks keys independently', () => {
    consumeRateLimit('ip-c', opts);
    consumeRateLimit('ip-c', opts);
    consumeRateLimit('ip-c', opts);
    expect(consumeRateLimit('ip-c', opts).limited).toBe(true);
    // A different key has its own fresh budget.
    expect(consumeRateLimit('ip-d', opts).limited).toBe(false);
  });

  it('resets after the window elapses', () => {
    consumeRateLimit('ip-e', opts);
    consumeRateLimit('ip-e', opts);
    consumeRateLimit('ip-e', opts);
    expect(consumeRateLimit('ip-e', opts).limited).toBe(true);

    // Advance past the window — the bucket should be rebuilt fresh.
    vi.advanceTimersByTime(opts.windowMs + 1);
    expect(consumeRateLimit('ip-e', opts).limited).toBe(false);
    expect(consumeRateLimit('ip-e', opts).remaining).toBe(1);
  });

  it('exposes a retryAfter of at least 1 second while limited', () => {
    consumeRateLimit('ip-f', opts);
    const res = consumeRateLimit('ip-f', opts);
    expect(res.retryAfter).toBeGreaterThanOrEqual(1);
    expect(res.retryAfter).toBeLessThanOrEqual(60);
  });
});
