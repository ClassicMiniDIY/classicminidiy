/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MODEL_FILE_MAX_BYTES, MODEL_VERSION_MAX_TOTAL_BYTES } from '~/server/utils/models';

// --- mock supabase (user-scoped) chains ------------------------------------
const versionSingle = vi.fn();
const filesEq = vi.fn();
const insert = vi.fn();
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'model_versions') return { select: () => ({ eq: () => ({ single: versionSingle }) }) };
    if (table === 'model_files') return { select: () => ({ eq: filesEq }), insert };
    throw new Error(`unexpected table ${table}`);
  }),
};

const mockRequireUserClient = vi.fn();
const mockCreateUploadUrl = vi.fn();

vi.mock('~/server/utils/userAuth', () => ({ requireUserClient: mockRequireUserClient }));
vi.mock('~/server/utils/s3Models', () => ({
  buildModelKey: (o: any) => `models/${o.modelId}/v${o.versionNumber}/${o.fileId}/${o.safeFilename}`,
  sanitizeModelFilename: (name: string, ext: string) => `${name.replace(/\.[^.]*$/, '')}.${ext}`,
  createModelUploadUrl: mockCreateUploadUrl,
}));

// --- globals ----------------------------------------------------------------
vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  return e;
});
const runtimeConfig = vi.fn();
vi.stubGlobal('useRuntimeConfig', runtimeConfig);

const validBody = { versionId: 'v1', fileName: 'bracket.stl', ext: 'stl', sizeBytes: 1000 };

describe('server/api/models/uploads/presign.post', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    runtimeConfig.mockReturnValue({ public: {} });
    mockRequireUserClient.mockResolvedValue({ user: { id: 'u1' }, accessToken: 't', supabase: mockSupabase });
    (readBody as any).mockResolvedValue({ ...validBody });
    versionSingle.mockResolvedValue({
      data: { id: 'v1', model_id: 'm1', version_number: 1, status: 'draft' },
      error: null,
    });
    filesEq.mockResolvedValue({ data: [], error: null });
    insert.mockResolvedValue({ error: null });
    mockCreateUploadUrl.mockResolvedValue({
      url: 'https://s3.example/upload',
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream', 'content-length': '1024' },
    });

    if (!handler) handler = (await import('~/server/api/models/uploads/presign.post')).default;
  });

  it('400s when versionId is missing', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, versionId: '' });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('400s when fileName is missing', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, fileName: '' });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('400s on a disallowed extension', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, fileName: 'malware.exe', ext: 'exe' });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('400s when sizeBytes is not a positive integer', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, sizeBytes: 0 });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
    (readBody as any).mockResolvedValue({ ...validBody, sizeBytes: 1.5 });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('413s when the file exceeds the per-file cap', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, sizeBytes: MODEL_FILE_MAX_BYTES + 1 });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 413 });
  });

  it('400s on an invalid kind', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, kind: 'malware' });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s when the version is not found (or not owned)', async () => {
    versionSingle.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('409s when the version is not a draft/rejected', async () => {
    versionSingle.mockResolvedValue({
      data: { id: 'v1', model_id: 'm1', version_number: 1, status: 'published' },
      error: null,
    });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 409 });
  });

  it('400s when the version already has the max files', async () => {
    filesEq.mockResolvedValue({ data: new Array(20).fill({ size_bytes: 1 }), error: null });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('413s when adding the file exceeds the per-version total', async () => {
    filesEq.mockResolvedValue({ data: [{ size_bytes: MODEL_VERSION_MAX_TOTAL_BYTES }], error: null });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 413 });
  });

  it('403s when the RLS-scoped insert fails', async () => {
    insert.mockResolvedValue({ error: { message: 'permission denied' } });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 });
  });

  it('inserts a pending, lowercase-ext, renderable row and returns the presigned POST', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, ext: 'STL' }); // uppercase normalized
    const res = await handler({});

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        version_id: 'v1',
        model_id: 'm1',
        file_ext: 'stl',
        kind: 'model',
        is_renderable: true,
        upload_status: 'pending',
        size_bytes: 1000,
      })
    );
    expect(res.fileId).toBeTruthy();
    expect(res.isRenderable).toBe(true);
    expect(res.upload.url).toBe('https://s3.example/upload');
    // The upload cap is no longer a policy condition — it is the SIGNED
    // content-length, so the route must pass the validated sizeBytes through.
    expect(mockCreateUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ sizeBytes: validBody.sizeBytes }));
  });

  it('forwards an optional base64 sha256 to the presigned PUT', async () => {
    (readBody as any).mockResolvedValue({ ...validBody, sha256: 'YmFzZTY0aGFzaA==' });
    await handler({});
    expect(mockCreateUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ checksumSha256: 'YmFzZTY0aGFzaA==' }));
  });
});
