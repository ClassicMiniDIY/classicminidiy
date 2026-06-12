/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// requireUserClient resolves with a user + a chainable supabase stub the
// individual tests override per-call.
const rpc = vi.fn();
const userSupabase: any = { from: vi.fn(), rpc };
const mockRequireUserClient = vi.fn(async () => ({ user: { id: 'u1' }, accessToken: 't', supabase: userSupabase }));
const serviceSupabase: any = { from: vi.fn() };

vi.mock('~/server/utils/userAuth', () => ({ requireUserClient: mockRequireUserClient }));
vi.mock('~/server/utils/supabase', () => ({ getServiceClient: () => serviceSupabase }));

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({ public: { supabaseUrl: 'https://x.supabase.co' } }))
);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  return e;
});

// Insert chain helper: .insert().select().single() → result
function insertChain(result: any) {
  return { insert: () => ({ select: () => ({ single: () => Promise.resolve(result) }) }) };
}

describe('PR7 wizard backend routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUserClient.mockResolvedValue({ user: { id: 'u1' }, accessToken: 't', supabase: userSupabase } as any);
  });

  describe('POST /api/models (create draft)', () => {
    let handler: Function;
    beforeEach(async () => {
      handler = (await import('~/server/api/models/index.post')).default;
    });

    it('400s when the title is too short', async () => {
      (readBody as any).mockResolvedValue({ title: 'ab', categorySlug: 'interior', licenseCode: 'CC0-1.0' });
      await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    });

    it('400s when the category is missing', async () => {
      (readBody as any).mockResolvedValue({ title: 'Gauge Pod', licenseCode: 'CC0-1.0' });
      await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    });

    it('400s when the license is missing', async () => {
      (readBody as any).mockResolvedValue({ title: 'Gauge Pod', categorySlug: 'interior' });
      await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    });

    it('creates the model + first version and returns the ids', async () => {
      (readBody as any).mockResolvedValue({ title: 'Gauge Pod', categorySlug: 'dash-gauges', licenseCode: 'CC0-1.0' });
      // slug-collision check (service role)
      serviceSupabase.from.mockReturnValue({ select: () => ({ like: () => Promise.resolve({ data: [] }) }) });
      // model insert then version insert
      userSupabase.from
        .mockReturnValueOnce(insertChain({ data: { id: 'm1', slug: 'gauge-pod' }, error: null }))
        .mockReturnValueOnce(insertChain({ data: { id: 'v1', version_number: 1 }, error: null }));

      const res = await handler({});
      expect(res).toEqual({ modelId: 'm1', slug: 'gauge-pod', versionId: 'v1', versionNumber: 1 });
    });

    it('400s and surfaces the DB message when the model insert fails (e.g., license×pricing)', async () => {
      (readBody as any).mockResolvedValue({
        title: 'Paid Pod',
        categorySlug: 'dash-gauges',
        licenseCode: 'CC0-1.0',
        pricingMode: 'fixed',
      });
      serviceSupabase.from.mockReturnValue({ select: () => ({ like: () => Promise.resolve({ data: [] }) }) });
      userSupabase.from.mockReturnValueOnce(
        insertChain({ data: null, error: { message: 'fixed pricing requires a paid license' } })
      );
      await expect(handler({})).rejects.toMatchObject({
        statusCode: 400,
        message: 'fixed pricing requires a paid license',
      });
    });
  });

  describe('PATCH /api/models/[modelId]', () => {
    let handler: Function;
    beforeEach(async () => {
      handler = (await import('~/server/api/models/[modelId].patch')).default;
    });

    it('400s when no editable fields are provided', async () => {
      (getRouterParam as any).mockReturnValue('m1');
      (readBody as any).mockResolvedValue({});
      await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    });

    it('updates provided fields (incl. safety_ack) under RLS', async () => {
      (getRouterParam as any).mockReturnValue('m1');
      (readBody as any).mockResolvedValue({ safetyAck: true, summary: 'A pod' });
      const update = vi.fn(() => ({
        eq: () => ({ select: () => ({ single: () => Promise.resolve({ error: null }) }) }),
      }));
      userSupabase.from.mockReturnValue({ update });
      const res = await handler({});
      expect(res).toEqual({ ok: true });
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ safety_ack: true, summary: 'A pod' }));
    });
  });

  describe('POST …/versions/[versionId]/submit', () => {
    let handler: Function;
    beforeEach(async () => {
      handler = (await import('~/server/api/models/[modelId]/versions/[versionId]/submit.post')).default;
    });

    it('400s when versionId is missing', async () => {
      (getRouterParam as any).mockReturnValue(undefined);
      await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    });

    it('surfaces the RPC validation error as 400', async () => {
      (getRouterParam as any).mockReturnValue('v1');
      rpc.mockResolvedValue({ data: null, error: { message: 'at least one uploaded file is required' } });
      await expect(handler({})).rejects.toMatchObject({
        statusCode: 400,
        message: 'at least one uploaded file is required',
      });
    });

    it('returns the model/version status on success', async () => {
      (getRouterParam as any).mockReturnValue('v1');
      rpc.mockResolvedValue({ data: [{ model_status: 'pending', version_status: 'pending' }], error: null });
      const res = await handler({});
      expect(res).toEqual({ modelStatus: 'pending', versionStatus: 'pending' });
      expect(rpc).toHaveBeenCalledWith('submit_model_version', { p_version_id: 'v1' });
    });
  });

  describe('POST /api/models/[modelId]/versions (new version)', () => {
    let handler: Function;
    beforeEach(async () => {
      handler = (await import('~/server/api/models/[modelId]/versions/index.post')).default;
    });

    it('400s when modelId is missing', async () => {
      (getRouterParam as any).mockReturnValue(undefined);
      await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    });

    it('numbers the new draft version max+1', async () => {
      (getRouterParam as any).mockReturnValue('m1');
      userSupabase.from.mockImplementation((table: string) => {
        if (table === 'models')
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: 'm1', license_code: 'CC0-1.0' }, error: null }),
              }),
            }),
          };
        // model_versions: first the max lookup, then the insert
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { version_number: 2 } }) }) }),
            }),
          }),
          insert: () => ({
            select: () => ({ single: () => Promise.resolve({ data: { id: 'v3', version_number: 3 }, error: null }) }),
          }),
        };
      });
      const res = await handler({});
      expect(res).toEqual({ versionId: 'v3', versionNumber: 3 });
    });
  });
});
