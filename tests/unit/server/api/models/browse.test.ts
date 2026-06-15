/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// A chainable Supabase query-builder mock: every builder method returns the
// builder, and awaiting it resolves to a per-table result. `eq` is a spy so we
// can assert the published-only filter and slug/id resolution.
const eqSpy = vi.fn();
const textSearchSpy = vi.fn();
const orderSpy = vi.fn();
let resultByTable: Record<string, any> = {};
let singleByTable: Record<string, any> = {};

function makeBuilder(table: string) {
  const builder: any = {
    select: () => builder,
    eq: (...args: any[]) => {
      eqSpy(table, ...args);
      return builder;
    },
    in: () => builder,
    order: (...args: any[]) => {
      orderSpy(...args);
      return builder;
    },
    range: () => builder,
    textSearch: (...args: any[]) => {
      textSearchSpy(...args);
      return builder;
    },
    maybeSingle: () => Promise.resolve(singleByTable[table] ?? { data: null, error: null }),
    then: (resolve: any) => resolve(resultByTable[table] ?? { data: [], count: 0, error: null }),
  };
  return builder;
}

const mockService = { from: vi.fn((table: string) => makeBuilder(table)) };

vi.mock('~/server/utils/supabase', () => ({ getServiceClient: () => mockService }));

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal(
  'getQuery',
  vi.fn(() => ({}))
);
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  return e;
});
const runtimeConfig = vi.fn();
vi.stubGlobal('useRuntimeConfig', runtimeConfig);

describe('server/api/models browse + detail routes', () => {
  let listHandler: Function;
  let detailHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    resultByTable = {};
    singleByTable = {};
    runtimeConfig.mockReturnValue({ public: { supabaseUrl: 'https://x.supabase.co' } });
    (getQuery as any).mockReturnValue({});
    if (!listHandler) listHandler = (await import('~/server/api/models/index.get')).default;
    if (!detailHandler) detailHandler = (await import('~/server/api/models/[modelId].get')).default;
  });

  describe('GET /api/models (browse)', () => {
    it('reads the unified model_browse_cards view', async () => {
      resultByTable['model_browse_cards'] = { data: [], count: 0, error: null };
      await listHandler({});
      expect(mockService.from).toHaveBeenCalledWith('model_browse_cards');
    });

    it('ranks first-party above external as the primary sort, for every sort type', async () => {
      for (const sort of ['newest', 'popular', 'likes', 'featured']) {
        orderSpy.mockClear();
        (getQuery as any).mockReturnValue({ sort });
        resultByTable['model_browse_cards'] = { data: [], count: 0, error: null };
        await listHandler({});
        // `kind` DESC must be the FIRST order key so first-party always wins.
        expect(orderSpy.mock.calls[0]).toEqual(['kind', { ascending: false }]);
      }
    });

    it('applies full-text search when q is present', async () => {
      (getQuery as any).mockReturnValue({ q: 'gauge pod' });
      resultByTable['model_browse_cards'] = { data: [], count: 0, error: null };
      await listHandler({});
      expect(textSearchSpy).toHaveBeenCalledWith('search', 'gauge pod', expect.objectContaining({ type: 'websearch' }));
    });

    it('scopes to external listings of a given source site', async () => {
      (getQuery as any).mockReturnValue({ source: 'thingiverse' });
      resultByTable['model_browse_cards'] = { data: [], count: 0, error: null };
      await listHandler({});
      expect(eqSpy).toHaveBeenCalledWith('model_browse_cards', 'kind', 'external');
      expect(eqSpy).toHaveBeenCalledWith('model_browse_cards', 'source_site', 'thingiverse');
    });

    it('maps first-party + external rows to discriminated cards', async () => {
      resultByTable['model_browse_cards'] = {
        data: [
          {
            kind: 'first_party',
            id: 'm1',
            slug: 'gauge-pod',
            title: 'Gauge Pod',
            summary: null,
            category_slug: 'dash-gauges',
            created_at: '2026-06-11T00:00:00Z',
            published_at: null,
            like_count: 2,
            comment_count: 0,
            download_count: 9,
            click_count: null,
            pricing_mode: 'free',
            price_cents: null,
            min_price_cents: null,
            currency: 'usd',
            license_code: 'CC-BY-4.0',
            safety_critical: false,
            is_featured: false,
            author_id: 'u1',
            source_site: null,
            source_url: null,
            source_author_name: null,
            primary_image_path: 'm1/a.webp',
          },
          {
            kind: 'external',
            id: 'e1',
            slug: 'cool-knob',
            title: 'Cool Knob',
            summary: 'shiny',
            category_slug: 'interior',
            created_at: '2026-06-12T00:00:00Z',
            published_at: '2026-06-13T00:00:00Z',
            like_count: 5,
            comment_count: 0,
            download_count: null,
            click_count: 12,
            pricing_mode: null,
            price_cents: null,
            min_price_cents: null,
            currency: null,
            license_code: null,
            safety_critical: false,
            is_featured: false,
            author_id: null,
            source_site: 'thingiverse',
            source_url: 'https://www.thingiverse.com/thing:1',
            source_author_name: 'Bob',
            primary_image_path: 'external/e1/x.webp',
          },
        ],
        count: 2,
        error: null,
      };
      resultByTable['profiles'] = { data: [{ id: 'u1', display_name: 'Cole', username: 'cole', avatar_url: null }] };

      const res = await listHandler({});
      expect(res.total).toBe(2);
      const fp = res.models.find((c: any) => c.kind === 'first_party');
      const ext = res.models.find((c: any) => c.kind === 'external');
      expect(fp).toMatchObject({ id: 'm1', slug: 'gauge-pod', pricingMode: 'free' });
      expect(fp.primaryImage).toContain('/storage/v1/object/public/model-images/m1/a.webp');
      expect(fp.author).toMatchObject({ displayName: 'Cole' });
      expect(ext).toMatchObject({ id: 'e1', sourceSite: 'thingiverse', sourceAuthorName: 'Bob', clickCount: 12 });
      expect(ext.primaryImage).toContain('/storage/v1/object/public/model-images/external/e1/x.webp');
    });

    it('500s when the query errors', async () => {
      resultByTable['model_browse_cards'] = { data: null, count: null, error: { message: 'boom' } };
      await expect(listHandler({})).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('GET /api/models/[modelId] (detail)', () => {
    it('resolves by slug for a non-uuid param', async () => {
      (getRouterParam as any).mockReturnValue('gauge-pod');
      singleByTable['models'] = { data: null, error: null }; // 404, but the eq spy still records the resolution column
      await expect(detailHandler({})).rejects.toMatchObject({ statusCode: 404 });
      expect(eqSpy).toHaveBeenCalledWith('models', 'slug', 'gauge-pod');
      expect(eqSpy).toHaveBeenCalledWith('models', 'status', 'published');
    });

    it('resolves by id for a uuid param', async () => {
      (getRouterParam as any).mockReturnValue('11111111-2222-3333-4444-555555555555');
      singleByTable['models'] = { data: null, error: null };
      await expect(detailHandler({})).rejects.toMatchObject({ statusCode: 404 });
      expect(eqSpy).toHaveBeenCalledWith('models', 'id', '11111111-2222-3333-4444-555555555555');
    });

    it('400s when the param is missing', async () => {
      (getRouterParam as any).mockReturnValue(undefined);
      await expect(detailHandler({})).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
