/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
  FEATURED_DURATION_DAYS,
  SOCIAL_REPOST_AFTER_DAYS,
  featuredUntilFromNow,
  relistSocialReset,
  relistUpdates,
} from '~~/shared/utils/listingPromotion';

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

describe('relistSocialReset', () => {
  const NOW = Date.UTC(2026, 9, 3, 12);
  const DAY_MS = 86_400_000;
  const daysAgo = (d: number) => new Date(NOW - d * DAY_MS).toISOString();

  it('uses one featured window as the re-post limit', () => {
    expect(SOCIAL_REPOST_AFTER_DAYS).toBe(FEATURED_DURATION_DAYS);
  });

  it('re-queues a listing that was never posted', () => {
    expect(relistSocialReset(null, NOW)).toEqual({ promoted_on_social: false });
    expect(relistSocialReset(undefined, NOW)).toEqual({ promoted_on_social: false });
  });

  it('re-queues an unreadable timestamp, as the sweep treats it as never attempted', () => {
    expect(relistSocialReset('not a date', NOW)).toEqual({ promoted_on_social: false });
  });

  it('re-queues at and after the limit, without writing the timestamp', () => {
    expect(relistSocialReset(daysAgo(SOCIAL_REPOST_AFTER_DAYS), NOW)).toEqual({ promoted_on_social: false });
    expect(relistSocialReset(daysAgo(90), NOW)).toEqual({ promoted_on_social: false });
  });

  it('writes nothing for a post inside the limit', () => {
    expect(relistSocialReset(daysAgo(SOCIAL_REPOST_AFTER_DAYS - 1), NOW)).toEqual({});
    expect(relistSocialReset(daysAgo(0), NOW)).toEqual({});
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
