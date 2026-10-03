/** @vitest-environment node */
import { isListingFeatured, relistUpdates } from '~~/shared/utils/listingPromotion';

describe('isListingFeatured', () => {
  it('features a premium listing while it is live', () => {
    expect(isListingFeatured({ tier: 'paid', status: 'active' })).toBe(true);
    expect(isListingFeatured({ tier: 'paid', status: 'example_paid' })).toBe(true);
  });

  it.each(['sold', 'expired', 'cancelled', 'pending', 'draft', 'example_free', null, undefined])(
    'never features a premium listing that is %s',
    (status) => {
      expect(isListingFeatured({ tier: 'paid', status })).toBe(false);
    }
  );

  it.each(['active', 'example_paid', 'sold', 'pending'])('never features a free listing (%s)', (status) => {
    expect(isListingFeatured({ tier: 'free', status })).toBe(false);
    expect(isListingFeatured({ tier: null, status })).toBe(false);
  });

  it('has no end date: featured_until plays no part', () => {
    const past = { tier: 'paid', status: 'active', featured_until: '2020-01-01T00:00:00.000Z' };
    const none = { tier: 'paid', status: 'active', featured_until: null };
    const future = { tier: 'free', status: 'active', featured_until: '2099-01-01T00:00:00.000Z' };
    expect(isListingFeatured(past)).toBe(true);
    expect(isListingFeatured(none)).toBe(true);
    expect(isListingFeatured(future)).toBe(false);
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
