/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { FEATURED_DURATION_DAYS, featuredUntilFromNow } from '~~/shared/utils/listingPromotion';

describe('featuredUntilFromNow', () => {
  it('is exactly FEATURED_DURATION_DAYS after the given instant, as ISO', () => {
    const now = Date.UTC(2026, 0, 1);
    expect(featuredUntilFromNow(now)).toBe(new Date(now + FEATURED_DURATION_DAYS * 86_400_000).toISOString());
  });

  it('defaults to the current time', () => {
    const before = Date.now();
    const until = Date.parse(featuredUntilFromNow());
    expect(until - before).toBeGreaterThanOrEqual(FEATURED_DURATION_DAYS * 86_400_000);
    expect(until - before).toBeLessThan(FEATURED_DURATION_DAYS * 86_400_000 + 5_000);
  });
});
