/** @vitest-environment node */
import {
  FEATURED_STRIP_SIZE,
  isListingFeatured,
  pickFeaturedRotation,
  relistUpdates,
} from '~~/shared/utils/listingPromotion';

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

describe('pickFeaturedRotation', () => {
  const rows = (n: number, status = 'active') =>
    Array.from({ length: n }, (_, i) => ({ id: `${status}-${i}`, status }));

  it('shows six cards by default', () => {
    expect(FEATURED_STRIP_SIZE).toBe(6);
    expect(pickFeaturedRotation(rows(19))).toHaveLength(6);
  });

  it('returns every row, each once, when there are fewer than the strip holds', () => {
    const input = rows(4);
    const picked = pickFeaturedRotation(input);
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((r) => r.id))).toEqual(new Set(input.map((r) => r.id)));
  });

  it('does not change the input array', () => {
    const input = rows(10);
    const copy = input.map((r) => r.id);
    pickFeaturedRotation(input);
    expect(input.map((r) => r.id)).toEqual(copy);
  });

  it('can show any listing, not only the first ones (older paid listings get a turn)', () => {
    const input = rows(19);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) pickFeaturedRotation(input).forEach((r) => seen.add(r.id));
    expect(seen.size).toBe(19);
  });

  it('randomises the order, not only the selection', () => {
    const input = rows(6);
    const orders = new Set<string>();
    for (let i = 0; i < 200; i++)
      orders.add(
        pickFeaturedRotation(input)
          .map((r) => r.id)
          .join(',')
      );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('puts demo rows after real listings and uses them only to fill places', () => {
    const input = [...rows(2, 'example_paid'), ...rows(5)];
    const picked = pickFeaturedRotation(input);
    expect(picked.slice(0, 5).every((r) => r.status === 'active')).toBe(true);
    expect(picked[5]!.status).toBe('example_paid');
    expect(pickFeaturedRotation([...rows(2, 'example_paid'), ...rows(8)]).every((r) => r.status === 'active')).toBe(
      true
    );
  });

  it('is a uniform Fisher-Yates over the injected random source', () => {
    // random() = 0 always swaps with index 0: [a,b,c] -> [b,c,a]
    const input = [
      { id: 'a', status: 'active' },
      { id: 'b', status: 'active' },
      { id: 'c', status: 'active' },
    ];
    expect(pickFeaturedRotation(input, 3, () => 0).map((r) => r.id)).toEqual(['b', 'c', 'a']);
    // random() just under 1 never swaps
    expect(pickFeaturedRotation(input, 3, () => 0.999999).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing for a non-positive count or no rows', () => {
    expect(pickFeaturedRotation(rows(3), 0)).toEqual([]);
    expect(pickFeaturedRotation(rows(3), -1)).toEqual([]);
    expect(pickFeaturedRotation([])).toEqual([]);
  });
});
