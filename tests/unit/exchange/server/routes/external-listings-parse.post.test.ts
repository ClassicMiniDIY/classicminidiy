/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';
import { _resetRateLimitStore } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// The route under test:
//   server/api/exchange/external-listings/parse.post.ts
//
// It is an UNAUTHENTICATED, per-IP rate-limited link-preview scraper. Pipeline:
//   readBody -> require url (400) -> rateLimit(event) -> require http(s) (400)
//   -> detect source site -> fetchExternalPage (SSRF-guarded OG/JSON-LD)
//   -> Microlink render fallback -> derive year/model/price/auctionEnd/category
//   -> rehost the OG image to Supabase Storage.
//
// What we mock vs. exercise for real:
//   - ogParser (fetchExternalPage/parseOpenGraph/parseJsonLd) -> MOCKED so we can
//     drive each branch (404, <400 success, thrown ScrapeError/SsrfError).
//   - render (renderExternalPage) -> MOCKED to drive the fallback branch.
//   - supabase (getServiceClient) -> MOCKED (storage upload/getPublicUrl).
//   - ssrf -> PARTIALLY mocked: safeFetch + readBodyCapped overridden (rehostImage
//     calls them) but the REAL SsrfError class preserved (the route does
//     `err instanceof SsrfError`).
//   - errors -> NOT mocked: the real ScrapeError class is needed for the route's
//     `err instanceof ScrapeError && err.statusCode === 400` branch.
//   - rateLimit -> NOT mocked: the real lenient preset (30/min) genuinely gates;
//     we reset its store per test and stub setResponseHeader.
//
// vi.mock matches by RESOLVED module id, so mocking the `~~/server/utils/...`
// ids covers the route's relative `../../../utils/...` imports (same files).
// ---------------------------------------------------------------------------

vi.mock('~~/server/utils/external-models/ogParser', () => ({
  fetchExternalPage: vi.fn(),
  parseOpenGraph: vi.fn(),
  parseJsonLd: vi.fn(),
}));

vi.mock('~~/server/utils/external-models/render', () => ({
  renderExternalPage: vi.fn(),
}));

vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));

// Preserve the real SsrfError class (used in an `instanceof` branch) while
// overriding safeFetch/readBodyCapped (called by rehostImage).
vi.mock('~~/server/utils/external-models/ssrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/utils/external-models/ssrf')>();
  return {
    ...actual,
    safeFetch: vi.fn(),
    readBodyCapped: vi.fn(),
  };
});

// The rate-limit middleware calls setResponseHeader, which is not part of the
// shared h3 global setup. Stub it so the middleware doesn't throw.
vi.stubGlobal('setResponseHeader', vi.fn());

import { fetchExternalPage, parseOpenGraph, parseJsonLd } from '~~/server/utils/external-models/ogParser';
import { renderExternalPage } from '~~/server/utils/external-models/render';
import { getServiceClient } from '~~/server/utils/supabase';
import { safeFetch, readBodyCapped, SsrfError } from '~~/server/utils/external-models/ssrf';
import { ScrapeError } from '~~/server/utils/external-models/errors';

const handler = (await import('~~/server/api/exchange/external-listings/parse.post')).default;

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

/**
 * Minimal h3 event. The rate-limit middleware reads `event.context.user?.id`,
 * so `context` must exist. All request accessors (readBody/getHeader/...) are
 * globally mocked and ignore the event arg.
 */
function evt(): any {
  return { context: {} };
}

const emptyOg = () => ({
  title: null,
  description: null,
  image: null,
  images: [] as string[],
  siteName: null,
  author: null,
  keywords: [] as string[],
  license: null,
  jsonLd: [] as unknown[],
});

/** Build an OgMetadata with overrides over an empty base. */
function og(over: Partial<ReturnType<typeof emptyOg>>) {
  return { ...emptyOg(), ...over };
}

/** Configure fetchExternalPage to resolve a successful page. */
function pageOk(html = '<html></html>', status = 200) {
  (fetchExternalPage as any).mockResolvedValue({ html, finalUrl: 'https://x', status });
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let uploadSpy: ReturnType<typeof vi.fn>;
let getPublicUrlSpy: ReturnType<typeof vi.fn>;
let storageFromSpy: ReturnType<typeof vi.fn>;

/** Wire a Supabase service client whose storage upload succeeds by default. */
function wireSupabase(opts: { uploadError?: any; publicUrl?: string } = {}) {
  mockSupabase = createMockSupabaseClient();
  uploadSpy = vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: opts.uploadError ?? null });
  getPublicUrlSpy = vi
    .fn()
    .mockReturnValue({ data: { publicUrl: opts.publicUrl ?? 'https://cdn.test/finds/abc.jpg' } });
  storageFromSpy = vi.fn(() => ({ upload: uploadSpy, getPublicUrl: getPublicUrlSpy }));
  (mockSupabase as any).storage = { from: storageFromSpy };
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

/** A successful image fetch (safeFetch + readBodyCapped) for rehostImage. */
function wireImageFetch(contentType = 'image/jpeg', ok = true) {
  (safeFetch as any).mockResolvedValue({
    ok,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
  });
  (readBodyCapped as any).mockResolvedValue(new Uint8Array([1, 2, 3]));
}

beforeEach(() => {
  _resetRateLimitStore();
  vi.clearAllMocks();

  // Default happy-ish setup: a fetched page with NO OG (so the easy branches
  // can override). Each test reconfigures parse* as needed.
  (readBody as any).mockResolvedValue({ url: 'https://bringatrailer.com/listing/abc' });
  (getHeader as any).mockImplementation((_e: any, n: string) =>
    n === 'x-real-ip' ? '9.9.9.9' : n === 'authorization' ? 'Bearer tok' : undefined
  );
  pageOk();
  (parseJsonLd as any).mockReturnValue([]);
  (parseOpenGraph as any).mockReturnValue(emptyOg());
  (renderExternalPage as any).mockResolvedValue(emptyOg());
  wireSupabase();
  wireImageFetch();
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('server/api/exchange/external-listings/parse.post', () => {
  // -------------------------------------------------------------------------
  // url validation (400s)
  // -------------------------------------------------------------------------
  describe('url validation', () => {
    it('throws 400 when url is missing', async () => {
      (readBody as any).mockResolvedValue({});
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, message: 'url is required' });
    });

    it('throws 400 when body is null', async () => {
      (readBody as any).mockResolvedValue(null);
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, message: 'url is required' });
    });

    it('throws 400 when url is an empty/whitespace string', async () => {
      (readBody as any).mockResolvedValue({ url: '   ' });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, message: 'url is required' });
    });

    it('does not rate-limit or fetch when url is missing (url check precedes everything)', async () => {
      (readBody as any).mockResolvedValue({});
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
      expect(fetchExternalPage).not.toHaveBeenCalled();
      expect(getServiceClient).not.toHaveBeenCalled();
    });

    it('throws 400 for a non-http(s) scheme (ftp)', async () => {
      (readBody as any).mockResolvedValue({ url: 'ftp://example.com/file' });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'URL must start with http:// or https://',
      });
    });

    it('throws 400 for a javascript: scheme', async () => {
      (readBody as any).mockResolvedValue({ url: 'javascript:alert(1)' });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'URL must start with http:// or https://',
      });
    });

    it('trims surrounding whitespace before the scheme check', async () => {
      (readBody as any).mockResolvedValue({ url: '  https://carsandbids.com/auctions/abc  ' });
      (parseOpenGraph as any).mockReturnValue(og({ title: 'A Mini' }));
      const res: any = await handler(evt());
      expect(res.success).toBe(true);
      // trimmed url drives source-site detection
      expect(res.metadata.sourceSite).toBe('carsandbids');
    });

    it('the scheme check runs AFTER rate limiting (rateLimit invoked for a bad scheme)', async () => {
      // Exhaust the lenient (30/min) budget for this IP, then a bad-scheme
      // request from the same IP should still 429 (rate limit precedes scheme).
      for (let i = 0; i < 30; i++) await handler(evt());
      (readBody as any).mockResolvedValue({ url: 'ftp://example.com' });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting (real lenient middleware: 30/min per IP)
  // -------------------------------------------------------------------------
  describe('rate limiting', () => {
    it('throws 429 once the lenient per-IP limit (30/min) is exhausted', async () => {
      for (let i = 0; i < 30; i++) await handler(evt());
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('keys on x-real-ip so a different IP is not throttled by the first IP', async () => {
      for (let i = 0; i < 30; i++) await handler(evt());
      // Same handler, but a fresh IP via x-real-ip -> allowed.
      (getHeader as any).mockImplementation((_e: any, n: string) => (n === 'x-real-ip' ? '8.8.8.8' : undefined));
      const res: any = await handler(evt());
      expect(res.success).toBe(true);
    });

    it('rate-limits AFTER the url-required check but BEFORE the scheme check', async () => {
      // A missing url never reaches the limiter (asserted via fetch not called),
      // whereas the scheme check is gated behind the limiter (asserted above).
      (readBody as any).mockResolvedValue({});
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
      // The limiter never consumed a token: a subsequent valid request still works
      // even after this 400.
      (readBody as any).mockResolvedValue({ url: 'https://bringatrailer.com/x' });
      (parseOpenGraph as any).mockReturnValue(og({ title: 'ok' }));
      const res: any = await handler(evt());
      expect(res.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Source-site detection
  // -------------------------------------------------------------------------
  describe('source-site detection', () => {
    const cases: Array<[string, string]> = [
      ['https://bringatrailer.com/listing/x', 'bat'],
      ['https://www.carsandbids.com/auctions/x', 'carsandbids'],
      ['https://www.copart.com/lot/x', 'copart'],
      ['https://sfbay.craigslist.org/x', 'craigslist'],
      ['https://www.facebook.com/marketplace/item/x', 'facebook'],
      ['https://www.ebay.com/itm/x', 'ebay'],
      ['https://www.ebay.co.uk/itm/x', 'ebay'],
      ['https://some-random-classifieds.example/x', 'other'],
    ];
    for (const [url, expected] of cases) {
      it(`maps ${url} -> ${expected}`, async () => {
        (readBody as any).mockResolvedValue({ url });
        // Return minimal so we don't traverse the full derive pipeline.
        (fetchExternalPage as any).mockResolvedValue({ html: '', finalUrl: url, status: 404 });
        const res: any = await handler(evt());
        expect(res.metadata.sourceSite).toBe(expected);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Direct fetch -> 404 short-circuit -> minimal metadata
  // -------------------------------------------------------------------------
  describe('404 from direct fetch', () => {
    it('returns minimal metadata (title = url) without rendering or rehosting', async () => {
      const url = 'https://bringatrailer.com/listing/dead';
      (readBody as any).mockResolvedValue({ url });
      (fetchExternalPage as any).mockResolvedValue({ html: '', finalUrl: url, status: 404 });
      const res: any = await handler(evt());
      expect(res).toEqual({
        success: true,
        metadata: {
          title: url,
          description: null,
          imageUrl: null,
          sourceSite: 'bat',
          year: null,
          model: null,
          price: null,
          priceLabel: null,
          auctionEndTime: null,
          category: null,
        },
      });
      expect(renderExternalPage).not.toHaveBeenCalled();
      expect(safeFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // SSRF / bad-scheme hard-throw (400) — NEVER falls through to render
  // -------------------------------------------------------------------------
  describe('SSRF / blocked host hard-throw', () => {
    it('throws 400 when fetchExternalPage throws SsrfError', async () => {
      (fetchExternalPage as any).mockRejectedValue(new SsrfError('private address'));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'That URL could not be fetched',
      });
      expect(renderExternalPage).not.toHaveBeenCalled();
    });

    it('throws 400 when fetchExternalPage throws a ScrapeError with statusCode 400', async () => {
      (fetchExternalPage as any).mockRejectedValue(new ScrapeError('blocked', 400));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'That URL could not be fetched',
      });
      expect(renderExternalPage).not.toHaveBeenCalled();
    });

    it('does NOT hard-throw for a non-400 ScrapeError — falls through to render', async () => {
      // 422 (non-HTML) / 413 (oversized) / 4xx-5xx are recoverable -> Microlink.
      (fetchExternalPage as any).mockRejectedValue(new ScrapeError('non-html', 422));
      (renderExternalPage as any).mockResolvedValue(og({ title: 'Rendered Mini' }));
      const res: any = await handler(evt());
      expect(renderExternalPage).toHaveBeenCalledTimes(1);
      expect(res.metadata.title).toBe('Rendered Mini');
    });
  });

  // -------------------------------------------------------------------------
  // Microlink render fallback
  // -------------------------------------------------------------------------
  describe('Microlink render fallback', () => {
    it('falls back to render when the direct fetch yields no OG', async () => {
      // page <400 but parseOpenGraph returns nothing usable -> og stays null.
      pageOk('<html></html>', 200);
      (parseOpenGraph as any).mockReturnValue(emptyOg());
      (renderExternalPage as any).mockResolvedValue(og({ title: 'Via Microlink', image: 'https://img/x.jpg' }));
      const res: any = await handler(evt());
      expect(renderExternalPage).toHaveBeenCalledTimes(1);
      expect(res.metadata.title).toBe('Via Microlink');
    });

    it('forwards MICROLINK_API_KEY from runtimeConfig (undefined here) to renderExternalPage', async () => {
      (parseOpenGraph as any).mockReturnValue(emptyOg());
      (renderExternalPage as any).mockResolvedValue(og({ title: 't' }));
      await handler(evt());
      // useRuntimeConfig (global stub) has no MICROLINK_API_KEY -> undefined.
      expect(renderExternalPage).toHaveBeenCalledWith(
        'https://bringatrailer.com/listing/abc',
        undefined,
        undefined
      );
    });

    it('does NOT call render when the direct fetch already produced OG', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: 'Direct OG' }));
      await handler(evt());
      expect(renderExternalPage).not.toHaveBeenCalled();
    });

    it('returns minimal metadata when render throws (caught) and nothing was parsed', async () => {
      const url = 'https://bringatrailer.com/listing/abc';
      (parseOpenGraph as any).mockReturnValue(emptyOg());
      (renderExternalPage as any).mockRejectedValue(new ScrapeError('blocked', 422));
      const res: any = await handler(evt());
      expect(res.metadata.title).toBe(url);
      expect(res.metadata.imageUrl).toBeNull();
    });

    it('returns minimal metadata when render resolves with no title/image', async () => {
      (parseOpenGraph as any).mockReturnValue(emptyOg());
      (renderExternalPage as any).mockResolvedValue(emptyOg());
      const res: any = await handler(evt());
      expect(res.metadata.title).toBe('https://bringatrailer.com/listing/abc');
    });
  });

  // -------------------------------------------------------------------------
  // OG parse considered present only when title OR image is set
  // -------------------------------------------------------------------------
  describe('OG presence gating', () => {
    it('treats parsed OG as present when only an image is set (no title)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ image: 'https://img/only.jpg' }));
      const res: any = await handler(evt());
      // og present -> render NOT called; title falls back to the url.
      expect(renderExternalPage).not.toHaveBeenCalled();
      expect(res.metadata.title).toBe('https://bringatrailer.com/listing/abc');
      // image was rehosted
      expect(res.metadata.imageUrl).toBe('https://cdn.test/finds/abc.jpg');
    });
  });

  // -------------------------------------------------------------------------
  // Year / model extraction (Classic Mini heritage terms, 1959-2000 clamp)
  // -------------------------------------------------------------------------
  describe('year/model extraction', () => {
    it('extracts a valid year + model and sets category=vehicle', async () => {
      // The model regex is leftmost-match over the alternation, so put the
      // multi-word "Cooper S" first to exercise the `cooper\s*s` branch.
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Cooper S restoration', description: 'lovely' }));
      const res: any = await handler(evt());
      expect(res.metadata.year).toBe(1965);
      expect(res.metadata.model).toBe('Cooper S');
      expect(res.metadata.category).toBe('vehicle');
    });

    it('matches the leftmost model term (Austin before Cooper S positionally)', async () => {
      // Documents the leftmost-match behavior: "Austin" precedes "Cooper S".
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Austin Mini Cooper S' }));
      const res: any = await handler(evt());
      expect(res.metadata.model).toBe('Austin');
    });

    it('rejects an out-of-range year (>2000) -> year null', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '2015 Mini Hatch' }));
      const res: any = await handler(evt());
      expect(res.metadata.year).toBeNull();
      // model still matched -> category vehicle
      expect(res.metadata.model).toBe('Mini');
      expect(res.metadata.category).toBe('vehicle');
    });

    it('rejects an out-of-range year (<1959) -> year null', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1955 something' }));
      const res: any = await handler(evt());
      expect(res.metadata.year).toBeNull();
    });

    it('category is null when neither year nor model is found', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: 'A generic gadget for sale' }));
      const res: any = await handler(evt());
      expect(res.metadata.year).toBeNull();
      expect(res.metadata.model).toBeNull();
      expect(res.metadata.category).toBeNull();
    });

    it('normalizes multi-space model text ("cooper  s" -> "cooper s")', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: 'Cooper  S restoration' }));
      const res: any = await handler(evt());
      expect(res.metadata.model).toBe('Cooper  S'.replace(/\s+/g, ' '));
    });
  });

  // -------------------------------------------------------------------------
  // Price extraction + sold/current-bid label heuristic
  // -------------------------------------------------------------------------
  describe('price extraction', () => {
    it('reads price from JSON-LD offers.price (single offer object)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1969 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ offers: { price: '18500.4' } }]);
      const res: any = await handler(evt());
      expect(res.metadata.price).toBe(18500); // Math.round
      expect(res.metadata.priceLabel).toBe('$18,500');
    });

    it('reads price from JSON-LD offers[0].price (array of offers)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1969 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ offers: [{ price: 9000 }] }]);
      const res: any = await handler(evt());
      expect(res.metadata.price).toBe(9000);
    });

    it('ignores a JSON-LD price below MIN_PRICE (50) and falls back to the $-regex', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: 'Sticker $25 - actually $7,500 for the car' }));
      (parseJsonLd as any).mockReturnValue([{ offers: { price: 25 } }]);
      const res: any = await handler(evt());
      // 25 rejected; regex finds $7,500 (first $-match >= 50)... but the regex
      // matches the FIRST occurrence ($25) which is < 50 -> rejected -> null.
      // Documents the actual behavior: only the first $-match is considered.
      expect(res.metadata.price).toBeNull();
    });

    it('extracts price from the $-regex over title/description when no JSON-LD', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: 'Lovely Mini', description: 'Asking $12,995 ono' }));
      (parseJsonLd as any).mockReturnValue([]);
      const res: any = await handler(evt());
      expect(res.metadata.price).toBe(12995);
      expect(res.metadata.priceLabel).toBe('$12,995');
    });

    it('returns null price/label when nothing parseable is present', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: 'No money mentioned' }));
      (parseJsonLd as any).mockReturnValue([]);
      const res: any = await handler(evt());
      expect(res.metadata.price).toBeNull();
      expect(res.metadata.priceLabel).toBeNull();
    });

    it('uses html as a price haystack when title/description lack a price', async () => {
      (fetchExternalPage as any).mockResolvedValue({
        html: '<p>Final hammer price $44,000 plus fees</p>',
        finalUrl: 'x',
        status: 200,
      });
      (parseOpenGraph as any).mockReturnValue(og({ title: '1967 Mini' }));
      (parseJsonLd as any).mockReturnValue([]);
      const res: any = await handler(evt());
      expect(res.metadata.price).toBe(44000);
    });

    it('labels "Sold for $X" on bat when haystack says sold', async () => {
      (readBody as any).mockResolvedValue({ url: 'https://bringatrailer.com/listing/x' });
      (parseOpenGraph as any).mockReturnValue(og({ title: 'Sold for $30,000 - 1965 Mini Cooper' }));
      (parseJsonLd as any).mockReturnValue([{ offers: { price: 30000 } }]);
      const res: any = await handler(evt());
      expect(res.metadata.sourceSite).toBe('bat');
      expect(res.metadata.priceLabel).toBe('Sold for $30,000');
    });

    it('labels "Current Bid $X" on carsandbids when haystack says current bid', async () => {
      (readBody as any).mockResolvedValue({ url: 'https://carsandbids.com/auctions/x' });
      (parseOpenGraph as any).mockReturnValue(og({ title: 'Current bid $21,000 on this 1971 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ offers: { price: 21000 } }]);
      const res: any = await handler(evt());
      expect(res.metadata.sourceSite).toBe('carsandbids');
      expect(res.metadata.priceLabel).toBe('Current Bid $21,000');
    });

    it('does NOT apply the sold/bid label on non-auction sites (ebay)', async () => {
      (readBody as any).mockResolvedValue({ url: 'https://www.ebay.com/itm/x' });
      (parseOpenGraph as any).mockReturnValue(og({ title: 'Sold for $5,000 - 1967 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ offers: { price: 5000 } }]);
      const res: any = await handler(evt());
      expect(res.metadata.sourceSite).toBe('ebay');
      expect(res.metadata.priceLabel).toBe('$5,000');
    });
  });

  // -------------------------------------------------------------------------
  // Auction end extraction
  // -------------------------------------------------------------------------
  describe('auction end extraction', () => {
    it('reads priceValidUntil from a single offers object (ISO normalized)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1969 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ offers: { priceValidUntil: '2026-07-01T00:00:00Z' } }]);
      const res: any = await handler(evt());
      expect(res.metadata.auctionEndTime).toBe(new Date('2026-07-01T00:00:00Z').toISOString());
    });

    it('reads priceValidUntil from offers[0] (array form)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1969 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ offers: [{ priceValidUntil: '2026-08-15' }] }]);
      const res: any = await handler(evt());
      expect(res.metadata.auctionEndTime).toBe(new Date('2026-08-15').toISOString());
    });

    it('reads endDate from a JSON-LD Event node', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1969 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ '@type': 'Event', endDate: '2026-09-01T12:00:00Z' }]);
      const res: any = await handler(evt());
      expect(res.metadata.auctionEndTime).toBe(new Date('2026-09-01T12:00:00Z').toISOString());
    });

    it('ignores an unparseable date -> auctionEndTime null', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1969 Mini' }));
      (parseJsonLd as any).mockReturnValue([{ offers: { priceValidUntil: 'not-a-date' } }]);
      const res: any = await handler(evt());
      expect(res.metadata.auctionEndTime).toBeNull();
    });

    it('auctionEndTime is null when there is no JSON-LD (render path)', async () => {
      (parseOpenGraph as any).mockReturnValue(emptyOg());
      (renderExternalPage as any).mockResolvedValue(og({ title: '1969 Mini' }));
      const res: any = await handler(evt());
      expect(res.metadata.auctionEndTime).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Image rehosting (SSRF-guarded, size-capped, content-type allowlisted)
  // -------------------------------------------------------------------------
  describe('image rehosting', () => {
    it('rehosts an allowed jpeg image and returns the Supabase public URL', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Mini', image: 'https://img.test/car.jpg' }));
      wireImageFetch('image/jpeg', true);
      const res: any = await handler(evt());
      expect(safeFetch).toHaveBeenCalledWith('https://img.test/car.jpg');
      // uploaded to listing-photos bucket with a finds/<uuid>.jpg path
      expect(storageFromSpy).toHaveBeenCalledWith('listing-photos');
      const uploadPath = uploadSpy.mock.calls[0][0];
      expect(uploadPath).toMatch(/^finds\/[0-9a-f-]+\.jpg$/);
      expect(uploadSpy.mock.calls[0][2]).toMatchObject({ contentType: 'image/jpeg', upsert: false });
      expect(res.metadata.imageUrl).toBe('https://cdn.test/finds/abc.jpg');
    });

    it('maps content-type to the correct extension (png)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Mini', image: 'https://img.test/car.png' }));
      wireImageFetch('image/png; charset=binary', true);
      await handler(evt());
      expect(uploadSpy.mock.calls[0][0]).toMatch(/\.png$/);
      expect(uploadSpy.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' });
    });

    it('returns null imageUrl for a disallowed content-type (svg -> stored-XSS guard)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Mini', image: 'https://img.test/car.svg' }));
      wireImageFetch('image/svg+xml', true);
      const res: any = await handler(evt());
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(res.metadata.imageUrl).toBeNull();
    });

    it('returns null imageUrl when the image fetch is not ok', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Mini', image: 'https://img.test/car.jpg' }));
      wireImageFetch('image/jpeg', false);
      const res: any = await handler(evt());
      expect(res.metadata.imageUrl).toBeNull();
    });

    it('returns null imageUrl when safeFetch throws (SSRF on the image URL)', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Mini', image: 'https://169.254.169.254/x.jpg' }));
      (safeFetch as any).mockRejectedValue(new SsrfError('blocked image host'));
      const res: any = await handler(evt());
      // rehostImage swallows everything -> preview still succeeds without an image.
      expect(res.success).toBe(true);
      expect(res.metadata.imageUrl).toBeNull();
    });

    it('returns null imageUrl when the storage upload errors', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Mini', image: 'https://img.test/car.jpg' }));
      wireSupabase({ uploadError: { message: 'bucket full' } });
      wireImageFetch('image/jpeg', true);
      const res: any = await handler(evt());
      expect(res.metadata.imageUrl).toBeNull();
    });

    it('does not attempt to rehost when OG has no image', async () => {
      (parseOpenGraph as any).mockReturnValue(og({ title: '1965 Mini' }));
      const res: any = await handler(evt());
      expect(safeFetch).not.toHaveBeenCalled();
      expect(res.metadata.imageUrl).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Full happy-path return shape
  // -------------------------------------------------------------------------
  describe('happy path full shape', () => {
    it('returns the complete metadata contract', async () => {
      (readBody as any).mockResolvedValue({ url: 'https://bringatrailer.com/listing/full' });
      (fetchExternalPage as any).mockResolvedValue({
        html: '<p>some html</p>',
        finalUrl: 'https://bringatrailer.com/listing/full',
        status: 200,
      });
      (parseOpenGraph as any).mockReturnValue(
        og({
          title: '  1967 Austin Mini Cooper S — Sold for $42,000  ',
          description: '  Restored example  ',
          image: 'https://img.test/full.jpg',
        })
      );
      (parseJsonLd as any).mockReturnValue([
        { offers: { price: 42000, priceValidUntil: '2026-06-30T00:00:00Z' } },
      ]);
      wireImageFetch('image/jpeg', true);

      const res: any = await handler(evt());
      expect(res).toEqual({
        success: true,
        metadata: {
          title: '1967 Austin Mini Cooper S — Sold for $42,000',
          description: 'Restored example',
          imageUrl: 'https://cdn.test/finds/abc.jpg',
          sourceSite: 'bat',
          year: 1967,
          model: 'Austin',
          price: 42000,
          priceLabel: 'Sold for $42,000',
          auctionEndTime: new Date('2026-06-30T00:00:00Z').toISOString(),
          category: 'vehicle',
        },
      });
    });

    it('falls back title to the url when OG title is only whitespace', async () => {
      const url = 'https://bringatrailer.com/listing/blank';
      (readBody as any).mockResolvedValue({ url });
      (parseOpenGraph as any).mockReturnValue(og({ title: '   ', image: 'https://img.test/x.jpg' }));
      const res: any = await handler(evt());
      expect(res.metadata.title).toBe(url);
    });
  });

  // -------------------------------------------------------------------------
  // Never-throw invariant on recoverable errors
  // -------------------------------------------------------------------------
  describe('never-throw invariant', () => {
    it('returns minimal metadata (not a throw) when the direct fetch throws a generic ScrapeError and render fails', async () => {
      (fetchExternalPage as any).mockRejectedValue(new ScrapeError('502 upstream', 502));
      (renderExternalPage as any).mockRejectedValue(new ScrapeError('render down', 502));
      const res: any = await handler(evt());
      expect(res.success).toBe(true);
      expect(res.metadata.title).toBe('https://bringatrailer.com/listing/abc');
    });
  });
});
