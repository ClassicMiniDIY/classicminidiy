/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
  FEATURED_DURATION_DAYS,
  SOCIAL_REPOST_AFTER_DAYS,
  featuredUntilFromNow,
  relistSocialReset,
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
