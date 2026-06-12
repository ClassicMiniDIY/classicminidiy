/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fileSingle = vi.fn();
const modelSingle = vi.fn();
const upsert = vi.fn();
const rpc = vi.fn();
const mockService = {
  from: vi.fn((table: string) => {
    if (table === 'model_files') return { select: () => ({ eq: () => ({ single: fileSingle }) }) };
    if (table === 'models') return { select: () => ({ eq: () => ({ single: modelSingle }) }) };
    if (table === 'model_downloads') return { upsert };
    throw new Error(`unexpected table ${table}`);
  }),
  rpc,
};

const mockRequireUserAuth = vi.fn();
const mockIsAdmin = vi.fn();
const mockConsumeRateLimit = vi.fn();
const mockDownloadUrl = vi.fn();

vi.mock('~/server/utils/userAuth', () => ({ requireUserAuth: mockRequireUserAuth }));
vi.mock('~/server/utils/adminAuth', () => ({ isAdminAuthenticated: mockIsAdmin }));
vi.mock('~/server/utils/supabase', () => ({ getServiceClient: () => mockService }));
vi.mock('~/server/utils/rateLimit', () => ({ consumeRateLimit: mockConsumeRateLimit }));
vi.mock('~/server/utils/s3Models', () => ({ createModelDownloadUrl: mockDownloadUrl }));

let params: Record<string, string | undefined>;
let query: Record<string, any>;

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('getRouterParam', (_e: any, name: string) => params[name]);
vi.stubGlobal('getQuery', () => query);
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal(
  'sendRedirect',
  vi.fn(() => 'REDIRECTED')
);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  return e;
});
const runtimeConfig = vi.fn();
vi.stubGlobal('useRuntimeConfig', runtimeConfig);

describe('server/api/models/[modelId]/files/[fileId]/download.get', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    params = { modelId: 'm1', fileId: 'f1' };
    query = {};
    runtimeConfig.mockReturnValue({ public: {} });
    mockRequireUserAuth.mockResolvedValue({ user: { id: 'u1' } });
    fileSingle.mockResolvedValue({
      data: {
        id: 'f1',
        s3_key: 'models/m1/v1/f1/a.stl',
        file_name: 'a.stl',
        upload_status: 'uploaded',
        model_id: 'm1',
        version_id: 'ver1',
      },
      error: null,
    });
    modelSingle.mockResolvedValue({ data: { id: 'm1', owner_id: 'owner', status: 'published' }, error: null });
    mockIsAdmin.mockResolvedValue(false);
    rpc.mockResolvedValue({ data: true, error: null });
    mockConsumeRateLimit.mockReturnValue({ limited: false, remaining: 59, resetAt: 1, retryAfter: 1 });
    upsert.mockResolvedValue({ error: null });
    mockDownloadUrl.mockResolvedValue('https://s3.example/get?sig=abc');

    if (!handler) handler = (await import('~/server/api/models/[modelId]/files/[fileId]/download.get')).default;
  });

  it('propagates 401 when unauthenticated', async () => {
    mockRequireUserAuth.mockRejectedValue(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
    await expect(handler({})).rejects.toMatchObject({ statusCode: 401 });
  });

  it('400s when route params are missing', async () => {
    params = { modelId: undefined, fileId: undefined };
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s when the file is missing or belongs to another model', async () => {
    fileSingle.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 });

    fileSingle.mockResolvedValue({
      data: {
        id: 'f1',
        s3_key: 'k',
        file_name: 'a.stl',
        upload_status: 'uploaded',
        model_id: 'OTHER',
        version_id: 'ver1',
      },
      error: null,
    });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('409s when the file is not finished uploading', async () => {
    fileSingle.mockResolvedValue({
      data: { id: 'f1', s3_key: 'k', file_name: 'a.stl', upload_status: 'pending', model_id: 'm1', version_id: 'ver1' },
      error: null,
    });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 409 });
  });

  it('404s on an unpublished model for a non-owner/non-admin', async () => {
    modelSingle.mockResolvedValue({ data: { id: 'm1', owner_id: 'owner', status: 'draft' }, error: null });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 });
    expect(rpc).not.toHaveBeenCalled(); // never reaches entitlement
  });

  it('403s when the entitlement RPC returns false', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 });
  });

  it('short-circuits the entitlement RPC for the owner', async () => {
    modelSingle.mockResolvedValue({ data: { id: 'm1', owner_id: 'u1', status: 'draft' }, error: null });
    const res = await handler({});
    expect(rpc).not.toHaveBeenCalled();
    expect(res).toBe('REDIRECTED');
  });

  it('short-circuits the entitlement RPC for an admin', async () => {
    mockIsAdmin.mockResolvedValue(true);
    rpc.mockResolvedValue({ data: false, error: null }); // would deny if consulted
    const res = await handler({});
    expect(rpc).not.toHaveBeenCalled();
    expect(res).toBe('REDIRECTED');
  });

  it('500s when the entitlement RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 500 });
  });

  it('429s when the per-user download limit is hit', async () => {
    mockConsumeRateLimit.mockReturnValue({ limited: true, remaining: 0, resetAt: 1, retryAfter: 120 });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 429 });
  });

  it('records the download (dedup) and 302-redirects to a presigned GET', async () => {
    const res = await handler({});
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ file_id: 'f1', model_id: 'm1', version_id: 'ver1', user_id: 'u1' }),
      { onConflict: 'file_id,user_id,day_bucket', ignoreDuplicates: true }
    );
    expect(mockDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: 'attachment', expiresInSeconds: 60 })
    );
    expect(sendRedirect).toHaveBeenCalledWith({}, 'https://s3.example/get?sig=abc', 302);
    expect(res).toBe('REDIRECTED');
  });

  it('serves inline for the viewer when ?disposition=inline', async () => {
    query = { disposition: 'inline' };
    await handler({});
    expect(mockDownloadUrl).toHaveBeenCalledWith(expect.objectContaining({ disposition: 'inline' }));
  });

  it('rate-limits per user id', async () => {
    await handler({});
    expect(mockConsumeRateLimit).toHaveBeenCalledWith('model-dl:u1', { max: 60, windowMs: 3_600_000 });
  });
});
