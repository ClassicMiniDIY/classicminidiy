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
  it('is null with no counter', () => {
    expect(socialSweepStatus({ facebook_post_id: 'x' }, NOW)).toBeNull();
    expect(socialSweepStatus(null, NOW)).toBeNull();
    expect(socialSweepStatus([], NOW)).toBeNull();
  });

  it('is null when the failure time is missing or unreadable', () => {
    expect(socialSweepStatus({ social_sweep_failures: 2 }, NOW)).toBeNull();
    expect(socialSweepStatus({ social_sweep_failures: 2, social_sweep_failed_at: 'soon' }, NOW)).toBeNull();
  });

  it('reports backing off inside the window: 15 minutes after one failure', () => {
    const status = socialSweepStatus({ social_sweep_failures: 1, social_sweep_failed_at: ago(5 * MINUTE) }, NOW);
    expect(status).toMatchObject({ failures: 1, parked: false });
    expect(Date.parse(status!.retryAt)).toBe(NOW + 10 * MINUTE);
  });

  it('doubles the window per failure: 120 minutes after four', () => {
    const status = socialSweepStatus({ social_sweep_failures: 4, social_sweep_failed_at: ago(100 * MINUTE) }, NOW);
    expect(status).toMatchObject({ failures: 4, parked: false });
    expect(Date.parse(status!.retryAt)).toBe(NOW + 20 * MINUTE);
  });

  it('reports the daily retry from five failures', () => {
    const status = socialSweepStatus({ social_sweep_failures: 7, social_sweep_failed_at: ago(60 * MINUTE) }, NOW);
    expect(status).toMatchObject({ failures: 7, parked: true });
    expect(Date.parse(status!.retryAt)).toBe(NOW + 23 * 60 * MINUTE);
  });

  it('is null once the window has run out (due on the next sweep, e.g. an old counter after a relist)', () => {
    expect(socialSweepStatus({ social_sweep_failures: 1, social_sweep_failed_at: ago(16 * MINUTE) }, NOW)).toBeNull();
    expect(
      socialSweepStatus({ social_sweep_failures: 9, social_sweep_failed_at: ago(25 * 60 * MINUTE) }, NOW)
    ).toBeNull();
  });
});
