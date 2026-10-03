/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { FEATURED_DURATION_DAYS, featuredUntilFromNow, relistUpdates } from '~~/shared/utils/listingPromotion';

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

describe('relistUpdates', () => {
  const NOW = Date.UTC(2026, 9, 3, 12);

  it('puts the listing back live, stamps published_at and clears the sale trail', () => {
    expect(relistUpdates({ now: NOW })).toEqual({
      status: 'active',
      published_at: new Date(NOW).toISOString(),
      sold_date: null,
      final_price: null,
      tracking_number: null,
      tracking_carrier: null,
    });
  });

  it('sets the price only when one is given (0 included)', () => {
    expect(relistUpdates({ now: NOW, price: 4500 }).price).toBe(4500);
    expect(relistUpdates({ now: NOW, price: 0 }).price).toBe(0);
    expect('price' in relistUpdates({ now: NOW })).toBe(false);
  });

  it('never writes a featured or social column', () => {
    const updates = relistUpdates({ now: NOW, price: 1 });
    expect('featured_until' in updates).toBe(false);
    expect('promoted_on_social' in updates).toBe(false);
    expect('promoted_on_social_at' in updates).toBe(false);
  });

  it('defaults to the current time', () => {
    const before = Date.now();
    const stamped = Date.parse(relistUpdates().published_at);
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped - before).toBeLessThan(5_000);
  });
});
