/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// A chainable Supabase query-builder mock. The browse handler queries the
// `model_browse_cards` view once per kind (a head count + a row range), so the
// view results are keyed by the `kind` filter; head queries return only a count.
const eqSpy = vi.fn();
const textSearchSpy = vi.fn();
let viewByKind: Record<string, { rows?: any[]; count?: number; error?: any }> = {};
let resultByTable: Record<string, any> = {};
let singleByTable: Record<string, any> = {};

function makeBuilder(table: string) {
  let kind: string | null = null;
  let head = false;
  const builder: any = {
    select: (_cols?: any, opts?: any) => {
      if (opts?.head) head = true;
      return builder;
    },
    eq: (...args: any[]) => {
      eqSpy(table, ...args);
      if (args[0] === 'kind') kind = args[1];
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
    then: (resolve: any) => {
      if (table === 'model_browse_cards') {
        const v = viewByKind[kind ?? ''] ?? {};
        if (v.error) return resolve({ data: null, count: null, error: v.error });
        const count = v.count ?? v.rows?.length ?? 0;
        if (head) return resolve({ data: null, count, error: null });
        return resolve({ data: v.rows ?? [], count, error: null });
      }
      return resolve(resultByTable[table] ?? { data: [], count: 0, error: null });
    },
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

function mkRow(kind: 'first_party' | 'external', id: string, over: Record<string, any> = {}) {
  return {
    kind,
    id,
    slug: id,
    title: id,
    summary: null,
    category_slug: 'misc',
    created_at: '2026-06-11T00:00:00Z',
    published_at: kind === 'external' ? '2026-06-11T00:00:00Z' : null,
    like_count: 0,
    comment_count: 0,
    download_count: kind === 'first_party' ? 0 : null,
    click_count: kind === 'external' ? 0 : null,
    pricing_mode: kind === 'first_party' ? 'free' : null,
    price_cents: null,
    min_price_cents: null,
    currency: kind === 'first_party' ? 'usd' : null,
    license_code: kind === 'first_party' ? 'CC0-1.0' : null,
    safety_critical: false,
    is_featured: false,
    author_id: null,
    source_site: kind === 'external' ? 'thingiverse' : null,
    source_url: kind === 'external' ? 'https://www.thingiverse.com/thing:1' : null,
    source_author_name: null,
    primary_image_path: null,
    ...over,
  };
}

describe('server/api/models browse + detail routes', () => {
  let listHandler: Function;
  let detailHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    viewByKind = {};
    resultByTable = {};
    singleByTable = {};
    runtimeConfig.mockReturnValue({ public: { supabaseUrl: 'https://x.supabase.co' } });
    (getQuery as any).mockReturnValue({});
    if (!listHandler) listHandler = (await import('~/server/api/models/index.get')).default;
    if (!detailHandler) detailHandler = (await import('~/server/api/models/[modelId].get')).default;
  });

  describe('GET /api/models (browse)', () => {
    it('reads the unified model_browse_cards view', async () => {
      viewByKind = { first_party: { count: 0 }, external: { count: 0 } };
      await listHandler({});
      expect(mockService.from).toHaveBeenCalledWith('model_browse_cards');
    });

    it('applies full-text search when q is present', async () => {
      (getQuery as any).mockReturnValue({ q: 'gauge pod' });
      viewByKind = { first_party: { count: 0 }, external: { count: 0 } };
      await listHandler({});
      expect(textSearchSpy).toHaveBeenCalledWith('search', 'gauge pod', expect.objectContaining({ type: 'websearch' }));
    });

    it('scopes to external listings of a given source site (single-kind path)', async () => {
      (getQuery as any).mockReturnValue({ source: 'thingiverse' });
      viewByKind = { external: { rows: [], count: 0 } };
      await listHandler({});
      expect(eqSpy).toHaveBeenCalledWith('model_browse_cards', 'kind', 'external');
      expect(eqSpy).toHaveBeenCalledWith('model_browse_cards', 'source_site', 'thingiverse');
    });

    it('maps first-party + external rows to discriminated cards', async () => {
      viewByKind = {
        first_party: {
          rows: [mkRow('first_party', 'm1', { slug: 'gauge-pod', category_slug: 'dash-gauges', author_id: 'u1', download_count: 9, like_count: 2, primary_image_path: 'm1/a.webp' })],
          count: 1,
        },
        external: {
          rows: [mkRow('external', 'e1', { slug: 'cool-knob', summary: 'shiny', click_count: 12, source_author_name: 'Bob', primary_image_path: 'external/e1/x.webp' })],
          count: 1,
        },
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

    it('leads with two first-party then one external (2:1 interleave)', async () => {
      const fpRows = [0, 1, 2, 3, 4].map((i) => mkRow('first_party', `f${i}`));
      const extRows = [0, 1, 2, 3, 4].map((i) => mkRow('external', `e${i}`));
      viewByKind = {
        first_party: { rows: fpRows, count: 5 },
        external: { rows: extRows, count: 5 },
      };
      const res = await listHandler({});
      expect(res.total).toBe(10);
      // 2 first-party, then 1 external, repeating — external never buried.
      expect(res.models.map((c: any) => c.id)).toEqual(['f0', 'f1', 'e0', 'f2', 'f3', 'e1', 'f4', 'e2', 'e3', 'e4']);
    });

    it('500s when a query errors', async () => {
      viewByKind = { first_party: { error: { message: 'boom' } }, external: { count: 0 } };
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
