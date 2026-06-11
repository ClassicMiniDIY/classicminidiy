/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fileSingle = vi.fn();
const modelSingle = vi.fn();
const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));
const mockService = {
  from: vi.fn((table: string) => {
    if (table === 'model_files') return { select: () => ({ eq: () => ({ single: fileSingle }) }), update };
    if (table === 'models') return { select: () => ({ eq: () => ({ single: modelSingle }) }) };
    throw new Error(`unexpected table ${table}`);
  }),
};

const mockRequireUserAuth = vi.fn();
const mockHeadObject = vi.fn();
const mockGetHead = vi.fn();
const mockSniff = vi.fn();

vi.mock('~/server/utils/userAuth', () => ({ requireUserAuth: mockRequireUserAuth }));
vi.mock('~/server/utils/supabase', () => ({ getServiceClient: () => mockService }));
vi.mock('~/server/utils/s3Models', () => ({ headModelObject: mockHeadObject, getModelObjectHead: mockGetHead }));
vi.mock('~/server/utils/uploadValidation', () => ({ sniffModelFile: mockSniff }));

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  return e;
});
const runtimeConfig = vi.fn();
vi.stubGlobal('useRuntimeConfig', runtimeConfig);

const baseFile = {
  id: 'f1',
  s3_key: 'models/m1/v1/f1/a.stl',
  file_ext: 'stl',
  size_bytes: 1000,
  upload_status: 'pending',
  model_id: 'm1',
  version_id: 'ver1',
};

describe('server/api/models/uploads/finalize.post', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    runtimeConfig.mockReturnValue({ public: { modelsEnabled: true } });
    mockRequireUserAuth.mockResolvedValue({ user: { id: 'u1' } });
    (readBody as any).mockResolvedValue({ fileId: 'f1' });
    fileSingle.mockResolvedValue({ data: { ...baseFile }, error: null });
    modelSingle.mockResolvedValue({ data: { owner_id: 'u1' }, error: null });
    updateEq.mockResolvedValue({ error: null });
    mockHeadObject.mockResolvedValue({ exists: true, size: 184 });
    mockGetHead.mockResolvedValue(Buffer.from('solid demo\n', 'latin1'));
    mockSniff.mockReturnValue({ ok: true });

    if (!handler) handler = (await import('~/server/api/models/uploads/finalize.post')).default;
  });

  it('404s when the feature flag is off', async () => {
    runtimeConfig.mockReturnValue({ public: { modelsEnabled: false } });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('400s when fileId is missing', async () => {
    (readBody as any).mockResolvedValue({});
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s when the file does not exist', async () => {
    fileSingle.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s when the caller does not own the model', async () => {
    modelSingle.mockResolvedValue({ data: { owner_id: 'someone-else' }, error: null });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 });
  });

  it('is idempotent for an already-uploaded file (no S3 calls)', async () => {
    fileSingle.mockResolvedValue({ data: { ...baseFile, upload_status: 'uploaded' }, error: null });
    const res = await handler({});
    expect(res).toMatchObject({ ok: true, uploadStatus: 'uploaded' });
    expect(mockHeadObject).not.toHaveBeenCalled();
  });

  it('409s when the object is missing from storage', async () => {
    mockHeadObject.mockResolvedValue({ exists: false, size: 0 });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 409 });
  });

  it('skips the ranged GET for a 0-byte object (avoids an S3 416) and fails the sniff', async () => {
    mockHeadObject.mockResolvedValue({ exists: true, size: 0 });
    mockSniff.mockReturnValue({ ok: false, reason: 'empty' });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 422 });
    expect(mockGetHead).not.toHaveBeenCalled();
    expect(mockSniff).toHaveBeenCalledWith(expect.objectContaining({ size: 0 }));
  });

  it('marks failed and 422s when the sniff fails', async () => {
    mockSniff.mockReturnValue({ ok: false, reason: 'expected-pdf-magic' });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 422 });
    expect(update).toHaveBeenCalledWith({ upload_status: 'failed' });
  });

  it('flips to uploaded and returns the size on success', async () => {
    const res = await handler({});
    expect(update).toHaveBeenCalledWith({ upload_status: 'uploaded' });
    expect(res).toMatchObject({ ok: true, uploadStatus: 'uploaded', sizeBytes: 184 });
  });
});
