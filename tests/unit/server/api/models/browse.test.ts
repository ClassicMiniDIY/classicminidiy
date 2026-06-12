/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// A chainable Supabase query-builder mock: every builder method returns the
// builder, and awaiting it resolves to a per-table result. `eq` is a spy so we
// can assert the published-only filter and slug/id resolution.
const eqSpy = vi.fn();
const textSearchSpy = vi.fn();
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
    order: () => builder,
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
    it('only ever queries published models', async () => {
      resultByTable['models'] = { data: [], count: 0, error: null };
      await listHandler({});
      expect(eqSpy).toHaveBeenCalledWith('models', 'status', 'published');
    });

    it('applies full-text search when q is present', async () => {
      (getQuery as any).mockReturnValue({ q: 'gauge pod' });
      resultByTable['models'] = { data: [], count: 0, error: null };
      await listHandler({});
      expect(textSearchSpy).toHaveBeenCalledWith('search', 'gauge pod', expect.objectContaining({ type: 'websearch' }));
    });

    it('maps rows to cards with batched image + author', async () => {
      resultByTable['models'] = {
        data: [
          {
            id: 'm1',
            slug: 'gauge-pod',
            title: 'Gauge Pod',
            summary: null,
            category_slug: 'dash-gauges',
            pricing_mode: 'free',
            price_cents: null,
            min_price_cents: null,
            currency: 'usd',
            license_code: 'CC-BY-4.0',
            like_count: 2,
            comment_count: 0,
            download_count: 9,
            safety_critical: false,
            is_featured: false,
            owner_id: 'u1',
            created_at: '2026-06-11T00:00:00Z',
          },
        ],
        count: 1,
        error: null,
      };
      resultByTable['model_images'] = {
        data: [{ model_id: 'm1', storage_path: 'm1/a.webp', is_primary: true, sort_order: 0 }],
      };
      resultByTable['profiles'] = { data: [{ id: 'u1', display_name: 'Cole', username: 'cole', avatar_url: null }] };

      const res = await listHandler({});
      expect(res.total).toBe(1);
      expect(res.models[0]).toMatchObject({ id: 'm1', slug: 'gauge-pod', pricingMode: 'free' });
      expect(res.models[0].primaryImage).toContain('/storage/v1/object/public/model-images/m1/a.webp');
      expect(res.models[0].author).toMatchObject({ displayName: 'Cole' });
    });

    it('500s when the query errors', async () => {
      resultByTable['models'] = { data: null, count: null, error: { message: 'boom' } };
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
