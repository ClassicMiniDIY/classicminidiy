// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { latestPromotionByListing, socialSweepStatus } from '~/utils/socialSweepStatus';

const MINUTE = 60 * 1000;
const NOW = Date.parse('2026-10-03T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('latestPromotionByListing', () => {
  it('picks the newest row per listing, not the first one returned', () => {
    const rows = [
      { id: 'a', listing_id: 'L1', features: { facebook_post_id: 'old' }, created_at: '2026-08-01T00:00:00Z' },
      { id: 'b', listing_id: 'L1', features: { facebook_post_id: 'new' }, created_at: '2026-09-01T00:00:00Z' },
      { id: 'c', listing_id: 'L2', features: {}, created_at: '2026-07-01T00:00:00Z' },
    ];
    const latest = latestPromotionByListing(rows);
    expect(latest.get('L1')?.id).toBe('b');
    expect(latest.get('L2')?.id).toBe('c');
    expect(latest.size).toBe(2);
  });

  it('breaks a created_at tie on the lower id, like the writers (created_at DESC, id ASC)', () => {
    const t = '2026-09-01T00:00:00.123456+00:00';
    const latest = latestPromotionByListing([
      { id: 'zz', listing_id: 'L1', features: {}, created_at: t },
      { id: 'aa', listing_id: 'L1', features: {}, created_at: t },
    ]);
    expect(latest.get('L1')?.id).toBe('aa');
  });

  it('keeps microseconds when two rows share a millisecond', () => {
    const latest = latestPromotionByListing([
      { id: 'a', listing_id: 'L1', features: {}, created_at: '2026-09-01T00:00:00.123400+00:00' },
      { id: 'b', listing_id: 'L1', features: {}, created_at: '2026-09-01T00:00:00.123900+00:00' },
    ]);
    expect(latest.get('L1')?.id).toBe('b');
  });

  it('sorts a NULL created_at first, as Postgres does in DESC order', () => {
    const latest = latestPromotionByListing([
      { id: 'a', listing_id: 'L1', features: {}, created_at: '2026-09-01T00:00:00Z' },
      { id: 'b', listing_id: 'L1', features: {}, created_at: null },
    ]);
    expect(latest.get('L1')?.id).toBe('b');
  });

  it('returns an empty map for no rows', () => {
    expect(latestPromotionByListing(null).size).toBe(0);
    expect(latestPromotionByListing([]).size).toBe(0);
  });
});

describe('socialSweepStatus', () => {
  it('is null for a listing never attempted (no counter, no timestamp)', () => {
    expect(socialSweepStatus({ facebook_post_id: 'x' }, null, NOW)).toBeNull();
    expect(socialSweepStatus(null, undefined, NOW)).toBeNull();
    expect(socialSweepStatus([], null, NOW)).toBeNull();
  });

  it('backs off 15 minutes after one failure, timed from social_sweep_failed_at', () => {
    const status = socialSweepStatus(
      { social_sweep_failures: 1, social_sweep_failed_at: ago(5 * MINUTE) },
      ago(60 * MINUTE),
      NOW
    );
    expect(status).toMatchObject({ failures: 1, parked: false, since: ago(5 * MINUTE) });
    expect(Date.parse(status!.retryAt)).toBe(NOW + 10 * MINUTE);
  });

  it('doubles the window per failure: 120 minutes after four', () => {
    const status = socialSweepStatus(
      { social_sweep_failures: 4, social_sweep_failed_at: ago(100 * MINUTE) },
      ago(100 * MINUTE),
      NOW
    );
    expect(status).toMatchObject({ failures: 4, parked: false });
    expect(Date.parse(status!.retryAt)).toBe(NOW + 20 * MINUTE);
  });

  it('is on the daily retry from five failures', () => {
    const status = socialSweepStatus(
      { social_sweep_failures: 7, social_sweep_failed_at: ago(60 * MINUTE) },
      ago(60 * MINUTE),
      NOW
    );
    expect(status).toMatchObject({ failures: 7, parked: true });
    expect(Date.parse(status!.retryAt)).toBe(NOW + 23 * 60 * MINUTE);
  });

  it('(a) no counter but already attempted: daily retry timed from promoted_on_social_at', () => {
    const status = socialSweepStatus({ facebook_post_id: null }, ago(3 * 60 * MINUTE), NOW);
    expect(status).toMatchObject({ failures: 0, parked: true, since: ago(3 * 60 * MINUTE) });
    expect(Date.parse(status!.retryAt)).toBe(NOW + 21 * 60 * MINUTE);
    // No promotion row at all behaves the same.
    expect(socialSweepStatus(undefined, ago(3 * 60 * MINUTE), NOW)).toMatchObject({ parked: true });
  });

  it('(b) counter but no readable failure time: timed from promoted_on_social_at', () => {
    for (const failedAt of [undefined, 'soon']) {
      const status = socialSweepStatus(
        { social_sweep_failures: 2, social_sweep_failed_at: failedAt },
        ago(10 * MINUTE),
        NOW
      );
      expect(status).toMatchObject({ failures: 2, parked: false, since: ago(10 * MINUTE) });
      expect(Date.parse(status!.retryAt)).toBe(NOW + 20 * MINUTE);
    }
  });

  it('(b) counter with no usable time anywhere: due now', () => {
    expect(socialSweepStatus({ social_sweep_failures: 2 }, null, NOW)).toBeNull();
  });

  it('mirrors the 5-minute grace: due from 5 minutes before the retry time', () => {
    const features = (failedAgo: number) => ({ social_sweep_failures: 1, social_sweep_failed_at: ago(failedAgo) });
    // Retry at +5 min: inside the grace, so the next sweep posts it.
    expect(socialSweepStatus(features(10 * MINUTE), null, NOW)).toBeNull();
    // Retry at +5 min + 1 s: still waiting.
    expect(socialSweepStatus(features(10 * MINUTE - 1000), null, NOW)).not.toBeNull();
  });

  it('is null once the window has run out (e.g. an old counter or timestamp after a relist)', () => {
    expect(
      socialSweepStatus({ social_sweep_failures: 1, social_sweep_failed_at: ago(16 * MINUTE) }, ago(16 * MINUTE), NOW)
    ).toBeNull();
    expect(
      socialSweepStatus(
        { social_sweep_failures: 9, social_sweep_failed_at: ago(40 * 24 * 60 * MINUTE) },
        ago(31 * 24 * 60 * MINUTE),
        NOW
      )
    ).toBeNull();
    expect(socialSweepStatus({}, ago(31 * 24 * 60 * MINUTE), NOW)).toBeNull();
  });
});
