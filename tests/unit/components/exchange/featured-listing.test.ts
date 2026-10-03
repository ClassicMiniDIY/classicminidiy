// @vitest-environment happy-dom
/**
 * Featured = premium and live (isListingFeatured()), with no end date. The
 * badge and the listing card ring must follow that rule and must ignore
 * featured_until: before this rule every active premium listing had a past
 * featured_until, so none was featured anywhere on the site.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import FeaturedBadge from '~/app/components/exchange/listings/FeaturedBadge.vue';
import ListingCard from '~/app/components/exchange/listings/ListingCard.vue';

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

const NuxtLinkStub = {
  name: 'NuxtLink',
  props: ['to'],
  template: '<a :href="to" v-bind="$attrs"><slot /></a>',
};

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-1',
    slug: 'mk1-cooper-s',
    title: '1965 Mk1 Cooper S',
    description: 'Matching numbers.',
    status: 'active',
    tier: 'paid',
    featured_until: PAST,
    price: 30000,
    currency: 'GBP',
    listing_photos: [],
    profiles: null,
    ...overrides,
  } as any;
}

function mountCard(l: Record<string, unknown>) {
  return mount(ListingCard, {
    props: { listing: l as any, showSellerInfo: false },
    global: { stubs: { NuxtLink: NuxtLinkStub, NuxtImg: true, 'nuxt-img': true } },
  });
}

beforeEach(() => {
  vi.stubGlobal('useListings', () => ({ getPhotoUrl: (p: string) => `https://cdn/${p}` }));
  vi.stubGlobal('useFormatters', () => ({
    formatStatus: (s: string) => s,
    formatManufacturer: (m: string) => m,
    formatListingPrice: (p: number) => String(p),
  }));
  vi.stubGlobal('useCurrency', () => ({
    formatCurrency: (n: number) => String(n),
    convertCurrency: (n: number) => n,
    fetchExchangeRates: vi.fn(),
    exchangeRates: ref(null),
    userCurrency: ref('GBP'),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FeaturedBadge', () => {
  it('shows for a premium live listing, with no featured_until prop at all', () => {
    expect(
      mount(FeaturedBadge, { props: { tier: 'paid', status: 'active' } })
        .find('.badge')
        .exists()
    ).toBe(true);
    expect(
      mount(FeaturedBadge, { props: { tier: 'paid', status: 'example_paid' } })
        .find('.badge')
        .exists()
    ).toBe(true);
  });

  it.each(['sold', 'expired', 'cancelled', 'pending', 'draft'])('does not show for a premium %s listing', (status) => {
    expect(
      mount(FeaturedBadge, { props: { tier: 'paid', status } })
        .find('.badge')
        .exists()
    ).toBe(false);
  });

  it('does not show for a free listing', () => {
    expect(
      mount(FeaturedBadge, { props: { tier: 'free', status: 'active' } })
        .find('.badge')
        .exists()
    ).toBe(false);
  });
});

describe('ListingCard featured ring', () => {
  const ring = (l: Record<string, unknown>) =>
    mountCard(l).find('[data-testid="listing-card"]').classes().includes('ring-2');

  it.each([
    ['a past', PAST],
    ['a NULL', null],
  ])('rings a premium active listing with %s featured_until', (_label, featuredUntil) => {
    expect(ring(listing({ featured_until: featuredUntil }))).toBe(true);
  });

  it('does not ring a premium sold listing, even with a future featured_until', () => {
    expect(ring(listing({ status: 'sold', featured_until: FUTURE }))).toBe(false);
  });

  it('does not ring a free active listing, even with a future featured_until', () => {
    expect(ring(listing({ tier: 'free', featured_until: FUTURE }))).toBe(false);
  });

  it('does not ring a demo row (example listings never get the ring)', () => {
    expect(ring(listing({ status: 'example_paid' }))).toBe(false);
  });
});
