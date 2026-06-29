/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the service-role Supabase client used by createFeedHandler/assembleFeed.
//
// feedBuilder.ts imports `getServiceClient` from '../supabase' (relative); the
// `~~/` alias resolves to the same absolute module, so this mock intercepts it.
//
// Each table query in assembleFeed terminates in `.limit(n)` which is awaited
// for `{ data }`. We build a per-table chainable builder where every chain
// method returns `this` and `.limit()` resolves to that table's seeded rows.
// ---------------------------------------------------------------------------

let listingsRows: any[] | null = [];
let findsRows: any[] | null = [];
let wantedRows: any[] | null = [];

function makeBuilder(getData: () => any[] | null) {
  const builder: Record<string, any> = {};
  for (const m of ['select', 'eq', 'order', 'in', 'is', 'not', 'neq']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.limit = vi.fn(() => Promise.resolve({ data: getData(), error: null }));
  return builder;
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'listings') return makeBuilder(() => listingsRows);
  if (table === 'external_listings') return makeBuilder(() => findsRows);
  if (table === 'wanted_posts') return makeBuilder(() => wantedRows);
  return makeBuilder(() => []);
});

const mockSupabase = { from: mockFrom };

vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}));

import {
  escapeHtml,
  imageMimeFromUrl,
  storagePublicUrl,
  formatMoney,
  assembleFeed,
  createFeedHandler,
  FEED_META,
  type FeedType,
} from '~~/server/utils/exchange/feedBuilder';

// h3 globals are not stubbed by vitest.setup. Re-apply them in beforeEach so they
// survive the per-test vi.unstubAllGlobals() teardown (some tests stub
// useRuntimeConfig and restore via unstubAllGlobals, which also clears these).
const setHeaderSpy = vi.fn();
function stubH3Globals() {
  vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
  vi.stubGlobal('setHeader', setHeaderSpy);
  vi.stubGlobal('createError', (opts: any) => {
    const e: any = new Error(opts.statusMessage || opts.message);
    e.statusCode = opts.statusCode;
    return e;
  });
}

const RUNTIME_BASE = {
  public: { siteUrl: 'https://www.classicminidiy.com', supabaseUrl: 'https://test.supabase.co' },
};

beforeEach(() => {
  listingsRows = [];
  findsRows = [];
  wantedRows = [];
  setHeaderSpy.mockClear();
  mockFrom.mockClear();
  stubH3Globals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ===========================================================================
// escapeHtml — XSS-critical: all 5 entities
// ===========================================================================
describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quote', () => {
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('escapes single quote (as numeric entity &#39;)', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes all five entities together in one pass', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('neutralizes a script-injection payload', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersand before producing entities (no double-escaping order bug)', () => {
    // A raw `&lt;` in input must become `&amp;lt;`, not collapse to `<`.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves a string with no special characters untouched', () => {
    expect(escapeHtml('plain text 123')).toBe('plain text 123');
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeHtml('&&&')).toBe('&amp;&amp;&amp;');
  });
});

// ===========================================================================
// imageMimeFromUrl — MIME inference, query/hash stripping, default
// ===========================================================================
describe('imageMimeFromUrl', () => {
  it('maps .png to image/png', () => {
    expect(imageMimeFromUrl('https://x/a.png')).toBe('image/png');
  });

  it('maps .webp to image/webp', () => {
    expect(imageMimeFromUrl('https://x/a.webp')).toBe('image/webp');
  });

  it('maps .gif to image/gif', () => {
    expect(imageMimeFromUrl('https://x/a.gif')).toBe('image/gif');
  });

  it('maps .avif to image/avif', () => {
    expect(imageMimeFromUrl('https://x/a.avif')).toBe('image/avif');
  });

  it('maps .jpg to image/jpeg (NOT image/jpg)', () => {
    expect(imageMimeFromUrl('https://x/a.jpg')).toBe('image/jpeg');
  });

  it('maps .jpeg to image/jpeg via the default branch', () => {
    expect(imageMimeFromUrl('https://x/a.jpeg')).toBe('image/jpeg');
  });

  it('defaults unknown extensions to image/jpeg', () => {
    expect(imageMimeFromUrl('https://x/a.tiff')).toBe('image/jpeg');
  });

  it('defaults a URL with no extension to image/jpeg', () => {
    expect(imageMimeFromUrl('https://x/image')).toBe('image/jpeg');
  });

  it('is case-insensitive on the extension', () => {
    expect(imageMimeFromUrl('https://x/A.PNG')).toBe('image/png');
    expect(imageMimeFromUrl('https://x/A.WebP')).toBe('image/webp');
  });

  it('strips a query string before reading the extension', () => {
    expect(imageMimeFromUrl('https://x/a.png?width=200&token=abc')).toBe('image/png');
  });

  it('strips a hash fragment before reading the extension', () => {
    expect(imageMimeFromUrl('https://x/a.webp#frag')).toBe('image/webp');
  });

  it('strips both query and hash, query first', () => {
    expect(imageMimeFromUrl('https://x/a.gif?q=1#h')).toBe('image/gif');
  });

  it('does not let a dot in the query string mask the real extension', () => {
    // Without stripping, `.pop()` would read `jpg?v=1.0` and miss png.
    expect(imageMimeFromUrl('https://x/photo.png?v=1.0')).toBe('image/png');
  });
});

// ===========================================================================
// storagePublicUrl — /-preserving per-segment encoding
// ===========================================================================
describe('storagePublicUrl', () => {
  const base = 'https://test.supabase.co';

  it('builds the canonical storage public URL', () => {
    expect(storagePublicUrl(base, 'listing-photos', 'abc/def.jpg')).toBe(
      'https://test.supabase.co/storage/v1/object/public/listing-photos/abc/def.jpg'
    );
  });

  it('preserves path separators (does NOT percent-encode "/" as %2F)', () => {
    const url = storagePublicUrl(base, 'b', 'a/b/c/d.png');
    expect(url).toContain('/a/b/c/d.png');
    expect(url).not.toContain('%2F');
  });

  it('encodes spaces in a segment', () => {
    expect(storagePublicUrl(base, 'b', 'my folder/my file.jpg')).toBe(
      'https://test.supabase.co/storage/v1/object/public/b/my%20folder/my%20file.jpg'
    );
  });

  it('encodes unicode characters in a segment', () => {
    expect(storagePublicUrl(base, 'b', 'café/naïve.png')).toBe(
      'https://test.supabase.co/storage/v1/object/public/b/caf%C3%A9/na%C3%AFve.png'
    );
  });

  it('encodes reserved characters within a segment but keeps the slashes', () => {
    const url = storagePublicUrl(base, 'b', 'a?b/c#d/e f.jpg');
    expect(url).toBe('https://test.supabase.co/storage/v1/object/public/b/a%3Fb/c%23d/e%20f.jpg');
    // Three segments => slashes preserved between them.
    expect(url.split('/storage/v1/object/public/b/')[1].split('/')).toHaveLength(3);
  });

  it('handles a single-segment key with no slashes', () => {
    expect(storagePublicUrl(base, 'b', 'solo.gif')).toBe(
      'https://test.supabase.co/storage/v1/object/public/b/solo.gif'
    );
  });
});

// ===========================================================================
// formatMoney — whole units, currency symbol, null/NaN graceful
// ===========================================================================
describe('formatMoney', () => {
  it('formats whole USD units with no decimals', () => {
    expect(formatMoney(1500, 'USD')).toBe('$1,500');
  });

  it('rounds away fractional cents (whole-unit, maximumFractionDigits 0)', () => {
    // 1500.75 -> "$1,501" (no decimals shown).
    expect(formatMoney(1500.75, 'USD')).toBe('$1,501');
  });

  it('formats zero as $0 (not empty)', () => {
    expect(formatMoney(0, 'USD')).toBe('$0');
  });

  it('respects a non-USD currency code (GBP)', () => {
    expect(formatMoney(1000, 'GBP')).toBe('£1,000');
  });

  it('respects EUR currency code', () => {
    expect(formatMoney(2500, 'EUR')).toBe('€2,500');
  });

  it('returns empty string for null', () => {
    expect(formatMoney(null, 'USD')).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatMoney(undefined, 'USD')).toBe('');
  });

  it('returns empty string for NaN', () => {
    expect(formatMoney(NaN, 'USD')).toBe('');
  });
});

// ===========================================================================
// FEED_META — config invariants the handler factory relies on
// ===========================================================================
describe('FEED_META', () => {
  it('has an entry for every FeedType', () => {
    const types: FeedType[] = ['everything', 'listings', 'vehicles', 'engines', 'parts', 'finds', 'wanted'];
    for (const t of types) expect(FEED_META[t]).toBeTruthy();
  });

  it('everything includes listings + finds + wanted', () => {
    expect(FEED_META.everything.includeListings).toBe(true);
    expect(FEED_META.everything.includeFinds).toBe(true);
    expect(FEED_META.everything.includeWanted).toBe(true);
  });

  it('category feeds pin a listingCategory', () => {
    expect(FEED_META.vehicles.listingCategory).toBe('vehicle');
    expect(FEED_META.engines.listingCategory).toBe('engine');
    expect(FEED_META.parts.listingCategory).toBe('parts');
  });

  it('finds-only feed excludes listings and wanted', () => {
    expect(FEED_META.finds.includeListings).toBe(false);
    expect(FEED_META.finds.includeFinds).toBe(true);
    expect(FEED_META.finds.includeWanted).toBe(false);
  });
});

// ===========================================================================
// assembleFeed — query selection, item building, sorting, escaping
// ===========================================================================
describe('assembleFeed', () => {
  const sampleListing = {
    id: 'l1',
    title: 'Mk1 Cooper S',
    slug: 'mk1-cooper-s',
    description: 'A lovely <b>car</b> & more',
    price: 12000,
    year: 1965,
    model: 'Cooper S',
    location: 'Old Location',
    city: 'Oxford',
    state_province: 'Oxfordshire',
    country: 'United Kingdom',
    created_at: '2026-01-03T00:00:00.000Z',
    user: { display_name: 'Jane <Seller>' },
    listing_photos: [
      { storage_path: 'l1/main photo.jpg', is_primary: true },
      { storage_path: 'l1/second.jpg', is_primary: false },
    ],
  };

  const sampleFind = {
    id: 'f1',
    title: 'Spotted online',
    slug: 'spotted-online',
    description: 'find desc',
    og_description: 'og desc',
    og_image_url: 'https://cdn/x.png',
    editor_commentary: 'great find & rare',
    published_at: '2026-01-02T00:00:00.000Z',
  };

  const sampleWanted = {
    id: 'w1',
    title: 'WTB engine',
    description: 'looking for a 1275',
    category: 'engine',
    budget_min: 500,
    budget_max: 1500,
    currency: 'USD',
    city: 'Leeds',
    state_province: null,
    country: 'United Kingdom',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('builds an "everything" feed querying all three tables', async () => {
    listingsRows = [sampleListing];
    findsRows = [sampleFind];
    wantedRows = [sampleWanted];

    const feed = await assembleFeed('everything', mockSupabase as any, RUNTIME_BASE);
    const tables = mockFrom.mock.calls.map((c) => c[0]);
    expect(tables).toContain('listings');
    expect(tables).toContain('external_listings');
    expect(tables).toContain('wanted_posts');

    const rss = feed.rss2();
    expect(rss).toContain('Mk1 Cooper S');
    expect(rss).toContain('[Mini Find] Spotted online');
    expect(rss).toContain('[Wanted] WTB engine');
  });

  it('listings-only feed does NOT query finds or wanted tables', async () => {
    listingsRows = [sampleListing];
    await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const tables = mockFrom.mock.calls.map((c) => c[0]);
    expect(tables).toContain('listings');
    expect(tables).not.toContain('external_listings');
    expect(tables).not.toContain('wanted_posts');
  });

  it('finds-only feed queries only external_listings', async () => {
    findsRows = [sampleFind];
    await assembleFeed('finds', mockSupabase as any, RUNTIME_BASE);
    const tables = mockFrom.mock.calls.map((c) => c[0]);
    expect(tables).toEqual(['external_listings']);
  });

  it('wanted-only feed queries only wanted_posts', async () => {
    wantedRows = [sampleWanted];
    await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const tables = mockFrom.mock.calls.map((c) => c[0]);
    expect(tables).toEqual(['wanted_posts']);
  });

  it('filters category feeds by listing_category', async () => {
    listingsRows = [sampleListing];
    const builder = makeBuilder(() => listingsRows);
    mockFrom.mockReturnValueOnce(builder as any);
    await assembleFeed('vehicles', mockSupabase as any, RUNTIME_BASE);
    // category feed adds a second .eq() for listing_category
    expect(builder.eq).toHaveBeenCalledWith('listing_category', 'vehicle');
  });

  it('escapes HTML in listing content (XSS) while linking the raw slug', async () => {
    listingsRows = [sampleListing];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    // raw "<b>car</b>" in the description must be escaped inside content...
    expect(rss).not.toContain('<b>car</b>');
    // ...while the surrounding plain text survives (and the & is entity-encoded)
    expect(rss).toContain('lovely');
    expect(rss).toContain('&amp;');
    // link uses the slug verbatim
    expect(rss).toContain('/exchange/listings/mk1-cooper-s');
  });

  it('builds the primary photo storage URL preserving slashes and encoding spaces', async () => {
    listingsRows = [sampleListing];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('https://test.supabase.co/storage/v1/object/public/listing-photos/l1/main%20photo.jpg');
    expect(rss).not.toContain('%2F');
  });

  it('sorts mixed items newest-first by date', async () => {
    listingsRows = [sampleListing]; // 2026-01-03
    findsRows = [sampleFind]; // 2026-01-02
    wantedRows = [sampleWanted]; // 2026-01-01
    const feed = await assembleFeed('everything', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    const iListing = rss.indexOf('Mk1 Cooper S');
    const iFind = rss.indexOf('[Mini Find] Spotted online');
    const iWanted = rss.indexOf('[Wanted] WTB engine');
    expect(iListing).toBeGreaterThanOrEqual(0);
    expect(iFind).toBeGreaterThanOrEqual(0);
    expect(iWanted).toBeGreaterThanOrEqual(0);
    // newest (listing, Jan 3) before find (Jan 2) before wanted (Jan 1)
    expect(iListing).toBeLessThan(iFind);
    expect(iFind).toBeLessThan(iWanted);
  });

  it('handles a null data result from Supabase without throwing', async () => {
    listingsRows = null;
    findsRows = null;
    wantedRows = null;
    const feed = await assembleFeed('everything', mockSupabase as any, RUNTIME_BASE);
    expect(feed.items).toHaveLength(0);
  });

  it('produces an empty-but-valid feed when there are no rows', async () => {
    const feed = await assembleFeed('everything', mockSupabase as any, RUNTIME_BASE);
    expect(feed.items).toHaveLength(0);
    const rss = feed.rss2();
    expect(rss).toContain('<rss');
    expect(rss).toContain('The Mini Exchange - Everything');
  });

  it('falls back to the default site URL when siteUrl is absent', async () => {
    listingsRows = [sampleListing];
    const feed = await assembleFeed('listings', mockSupabase as any, {
      public: { supabaseUrl: 'https://test.supabase.co' },
    });
    const rss = feed.rss2();
    expect(rss).toContain('https://www.classicminidiy.com/exchange/listings/mk1-cooper-s');
  });

  it('formats a wanted budget range with whole-unit currency', async () => {
    wantedRows = [sampleWanted];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('$500');
    expect(rss).toContain('$1,500');
  });
});

// ===========================================================================
// Missing-field fallbacks & remaining budget/location branches
// (covers feedBuilder.ts:133 formatServerLocation fallback,
//  244-246 formatBudget max-only/min-only/Flexible, and the per-item
//  fallback branches: Anonymous Seller, Free / Contact for price,
//  find description chain, category label fallback, no-photo listing).
// ===========================================================================
describe('assembleFeed — missing-field fallbacks', () => {
  it('falls back to listing.location when no city/state/country parts exist (line 133)', async () => {
    listingsRows = [
      {
        id: 'l-loc',
        title: 'No address listing',
        slug: 'no-address',
        description: 'desc',
        price: 100,
        year: 1970,
        model: 'Mini',
        location: 'Somewhere, UK',
        city: null,
        state_province: null,
        country: null,
        created_at: '2026-02-01T00:00:00.000Z',
        user: { display_name: 'Sam' },
        listing_photos: [],
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Somewhere, UK');
  });

  it('omits the country part when it equals "United States" but keeps city/state', async () => {
    listingsRows = [
      {
        id: 'l-us',
        title: 'US listing',
        slug: 'us-listing',
        description: 'desc',
        price: 100,
        year: 1970,
        model: 'Mini',
        location: 'ignored fallback',
        city: 'Detroit',
        state_province: 'MI',
        country: 'United States',
        created_at: '2026-02-01T00:00:00.000Z',
        user: { display_name: 'Sam' },
        listing_photos: [],
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Detroit, MI');
    expect(rss).not.toContain('United States');
    // location fallback must NOT be used when parts exist
    expect(rss).not.toContain('ignored fallback');
  });

  it('uses "Anonymous Seller" when the listing has no user display_name', async () => {
    listingsRows = [
      {
        id: 'l-anon',
        title: 'Sellerless',
        slug: 'sellerless',
        description: 'desc',
        price: 100,
        year: 1970,
        model: 'Mini',
        location: '',
        city: null,
        state_province: null,
        country: null,
        created_at: '2026-02-01T00:00:00.000Z',
        user: null,
        listing_photos: [],
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Anonymous Seller');
  });

  it('renders "Free" when price is exactly 0', async () => {
    listingsRows = [
      {
        id: 'l-free',
        title: 'Freebie',
        slug: 'freebie',
        description: 'desc',
        price: 0,
        year: 1970,
        model: 'Mini',
        location: '',
        created_at: '2026-02-01T00:00:00.000Z',
        user: { display_name: 'Sam' },
        listing_photos: [],
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Free');
  });

  it('renders "Contact for price" when price is null/undefined', async () => {
    listingsRows = [
      {
        id: 'l-nop',
        title: 'No price',
        slug: 'no-price',
        description: 'desc',
        price: null,
        year: 1970,
        model: 'Mini',
        location: '',
        created_at: '2026-02-01T00:00:00.000Z',
        user: { display_name: 'Sam' },
        listing_photos: [],
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Contact for price');
  });

  it('omits the enclosure/img when a listing has no photos', async () => {
    listingsRows = [
      {
        id: 'l-nophoto',
        title: 'Photoless',
        slug: 'photoless',
        description: 'desc',
        price: 100,
        year: 1970,
        model: 'Mini',
        location: '',
        created_at: '2026-02-01T00:00:00.000Z',
        user: { display_name: 'Sam' },
        listing_photos: [],
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Photoless');
    expect(rss).not.toContain('storage/v1/object/public/listing-photos');
    expect(rss).not.toContain('<enclosure');
  });

  it('uses the first photo when none is flagged is_primary', async () => {
    listingsRows = [
      {
        id: 'l-noprimary',
        title: 'No primary photo',
        slug: 'no-primary',
        description: 'desc',
        price: 100,
        year: 1970,
        model: 'Mini',
        location: '',
        created_at: '2026-02-01T00:00:00.000Z',
        user: { display_name: 'Sam' },
        listing_photos: [
          { storage_path: 'np/first.jpg', is_primary: false },
          { storage_path: 'np/second.jpg', is_primary: false },
        ],
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('listing-photos/np/first.jpg');
    expect(rss).not.toContain('np/second.jpg');
  });

  it('falls back through editor_commentary -> description -> og_description for finds', async () => {
    findsRows = [
      {
        id: 'f-desc',
        title: 'Find with description only',
        slug: 'find-desc',
        description: 'plain description',
        og_description: 'og fallback',
        og_image_url: null,
        editor_commentary: null,
        published_at: '2026-02-02T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('finds', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('plain description');
    // no og_image_url => no enclosure/img tag
    expect(rss).not.toContain('<enclosure');
  });

  it('falls back to og_description when find has neither commentary nor description', async () => {
    findsRows = [
      {
        id: 'f-og',
        title: 'Find with og only',
        slug: 'find-og',
        description: null,
        og_description: 'og only content',
        og_image_url: null,
        editor_commentary: null,
        published_at: '2026-02-02T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('finds', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('og only content');
  });

  it('renders an empty find content when all description sources are absent', async () => {
    findsRows = [
      {
        id: 'f-empty',
        title: 'Find no content',
        slug: 'find-empty',
        description: null,
        og_description: null,
        og_image_url: null,
        editor_commentary: null,
        published_at: '2026-02-02T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('finds', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('[Mini Find] Find no content');
  });

  it('formats a "Up to" budget when only budget_max is set (line 244)', async () => {
    wantedRows = [
      {
        id: 'w-max',
        title: 'WTB max only',
        description: 'desc',
        category: 'parts',
        budget_min: null,
        budget_max: 2000,
        currency: 'USD',
        city: 'Bath',
        state_province: null,
        country: 'United Kingdom',
        created_at: '2026-02-03T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Up to $2,000');
  });

  it('formats a "From" budget when only budget_min is set (line 245)', async () => {
    wantedRows = [
      {
        id: 'w-min',
        title: 'WTB min only',
        description: 'desc',
        category: 'parts',
        budget_min: 300,
        budget_max: null,
        currency: 'USD',
        city: 'Bath',
        state_province: null,
        country: 'United Kingdom',
        created_at: '2026-02-03T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('From $300');
  });

  it('formats a "Flexible" budget when neither min nor max is set (line 246)', async () => {
    wantedRows = [
      {
        id: 'w-flex',
        title: 'WTB flexible',
        description: 'desc',
        category: 'vehicle',
        budget_min: null,
        budget_max: null,
        currency: 'USD',
        city: 'Bath',
        state_province: null,
        country: 'United Kingdom',
        created_at: '2026-02-03T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('Flexible');
  });

  it('falls back to the raw category when it has no CATEGORY_LABELS entry', async () => {
    wantedRows = [
      {
        id: 'w-cat',
        title: 'WTB misc',
        description: 'desc',
        category: 'misc',
        budget_min: null,
        budget_max: null,
        currency: 'USD',
        city: 'Bath',
        state_province: null,
        country: 'United Kingdom',
        created_at: '2026-02-03T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('misc');
  });

  it('defaults wanted currency to USD when currency is absent', async () => {
    wantedRows = [
      {
        id: 'w-nocur',
        title: 'WTB no currency',
        description: 'desc',
        category: 'engine',
        budget_min: 750,
        budget_max: null,
        currency: null,
        city: 'Bath',
        state_province: null,
        country: 'United Kingdom',
        created_at: '2026-02-03T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('From $750');
  });

  it('tolerates a listing with null title/model/description and absent listing_photos (field fallbacks)', async () => {
    listingsRows = [
      {
        id: 'l-nulls',
        title: null,
        slug: 'null-fields',
        description: null,
        price: 100,
        year: 1970,
        model: null,
        location: '',
        created_at: '2026-02-01T00:00:00.000Z',
        user: { display_name: 'Sam' },
        // listing_photos key intentionally absent -> exercises `|| []`
      },
    ];
    const feed = await assembleFeed('listings', mockSupabase as any, RUNTIME_BASE);
    expect(feed.items).toHaveLength(1);
    const rss = feed.rss2();
    // null title/model/description must not throw; year still renders
    expect(rss).toContain('1970');
    expect(rss).not.toContain('storage/v1/object/public/listing-photos');
  });

  it('renders a wanted post with a null description (field fallback)', async () => {
    wantedRows = [
      {
        id: 'w-nulldesc',
        title: 'WTB null desc',
        description: null,
        category: 'parts',
        budget_min: 100,
        budget_max: 200,
        currency: 'USD',
        city: 'Bath',
        state_province: null,
        country: 'United Kingdom',
        created_at: '2026-02-03T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    expect(feed.items).toHaveLength(1);
    const rss = feed.rss2();
    expect(rss).toContain('[Wanted] WTB null desc');
  });

  it('omits the Location line for a wanted post with no location at all', async () => {
    wantedRows = [
      {
        id: 'w-noloc',
        title: 'WTB no location',
        description: 'desc',
        category: 'parts',
        budget_min: null,
        budget_max: null,
        currency: 'USD',
        city: null,
        state_province: null,
        country: null,
        location: null,
        created_at: '2026-02-03T00:00:00.000Z',
      },
    ];
    const feed = await assembleFeed('wanted', mockSupabase as any, RUNTIME_BASE);
    const rss = feed.rss2();
    expect(rss).toContain('[Wanted] WTB no location');
    expect(rss).not.toContain('<strong>Location:</strong>');
  });
});

// ===========================================================================
// createFeedHandler — flag gating + content-type per format
// ===========================================================================
describe('createFeedHandler', () => {
  it('throws a 404 createError when exchangeEnabled is false', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { ...RUNTIME_BASE.public, exchangeEnabled: false },
    }));
    const handler = createFeedHandler('everything', 'rss');
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when exchangeEnabled is undefined (default off)', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { ...RUNTIME_BASE.public } }));
    const handler = createFeedHandler('listings', 'rss');
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does NOT call Supabase when the flag is off', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { ...RUNTIME_BASE.public, exchangeEnabled: false },
    }));
    const handler = createFeedHandler('everything', 'rss');
    await handler({} as any).catch(() => {});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('builds RSS and sets the XML content-type when the flag is on', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { ...RUNTIME_BASE.public, exchangeEnabled: true },
    }));
    listingsRows = [];
    const handler = createFeedHandler('listings', 'rss');
    const out = await handler({} as any);
    expect(typeof out).toBe('string');
    expect(out).toContain('<rss');
    expect(setHeaderSpy).toHaveBeenCalledWith(expect.anything(), 'Content-Type', 'application/xml; charset=utf-8');
    expect(setHeaderSpy).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'public, max-age=3600');
  });

  it('builds Atom and sets the atom+xml content-type', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { ...RUNTIME_BASE.public, exchangeEnabled: true },
    }));
    const handler = createFeedHandler('listings', 'atom');
    const out = await handler({} as any);
    expect(out).toContain('<feed');
    expect(setHeaderSpy).toHaveBeenCalledWith(
      expect.anything(),
      'Content-Type',
      'application/atom+xml; charset=utf-8'
    );
  });

  it('builds JSON Feed and sets the json content-type', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { ...RUNTIME_BASE.public, exchangeEnabled: true },
    }));
    const handler = createFeedHandler('listings', 'json');
    const out = await handler({} as any);
    // feed.json1() returns a JSON string
    const parsed = JSON.parse(out as string);
    expect(parsed.version).toContain('jsonfeed.org');
    expect(setHeaderSpy).toHaveBeenCalledWith(expect.anything(), 'Content-Type', 'application/json; charset=utf-8');
  });
});
