/** @vitest-environment node */
import { describe, it, expect, vi, afterEach } from 'vitest';

// createError is referenced by getModelsS3 (not exercised here) — stub for safety.
vi.stubGlobal('createError', (opts: any) => Object.assign(new Error(opts.statusMessage), opts));
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({ S3_MODELS_BUCKET: 'b', S3_MODELS_ACCESS_KEY_ID: 'k', S3_MODELS_SECRET_ACCESS_KEY: 's' }))
);

import {
  buildModelKey,
  sanitizeModelFilename,
  contentDisposition,
  createModelUploadUrl,
  createModelDownloadUrl,
  headModelObject,
  getModelObjectHead,
} from '~/server/utils/s3Models';

describe('server/utils/s3Models — buildModelKey', () => {
  it('produces the canonical key scheme', () => {
    expect(buildModelKey({ modelId: 'm-1', versionNumber: 3, fileId: 'f-9', safeFilename: 'bracket.stl' })).toBe(
      'models/m-1/v3/f-9/bracket.stl'
    );
  });
});

describe('server/utils/s3Models — sanitizeModelFilename', () => {
  it('strips path components and forces the lowercase extension', () => {
    expect(sanitizeModelFilename('/etc/../My Bracket.STL', 'stl')).toBe('My-Bracket.stl');
    expect(sanitizeModelFilename('C:\\models\\part.3MF', '3mf')).toBe('part.3mf');
  });

  it('collapses unsafe characters and trims separators', () => {
    expect(sanitizeModelFilename('weird  **name**!!.obj', 'obj')).toBe('weird-name.obj');
  });

  it('falls back to "file" when the stem is empty', () => {
    expect(sanitizeModelFilename('***.stl', 'stl')).toBe('file.stl');
  });

  it('strips combining diacritics instead of hyphenating them', () => {
    expect(sanitizeModelFilename('café.stl', 'stl')).toBe('cafe.stl');
    expect(sanitizeModelFilename('pièce-moteur.obj', 'obj')).toBe('piece-moteur.obj');
  });

  it('bounds the stem length to 80 chars', () => {
    const long = 'a'.repeat(200);
    const out = sanitizeModelFilename(`${long}.stl`, 'stl');
    expect(out.endsWith('.stl')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(84);
  });
});

describe('server/utils/s3Models — contentDisposition', () => {
  it('quotes an ascii filename', () => {
    expect(contentDisposition('attachment', 'bracket.stl')).toBe(
      'attachment; filename="bracket.stl"; filename*=UTF-8\'\'bracket.stl'
    );
  });

  it('neutralizes quotes and control characters in the ascii fallback', () => {
    const out = contentDisposition('inline', 'a"b\nc.stl');
    expect(out.startsWith('inline; filename="a_b_c.stl"')).toBe(true);
    expect(out).not.toContain('"a"b');
  });

  it('rfc5987-encodes non-ascii names', () => {
    const out = contentDisposition('attachment', 'pièce.stl');
    expect(out).toContain("filename*=UTF-8''");
    expect(out).toContain('pi%C3%A8ce.stl');
  });
});

/**
 * These two suites guard the properties that carry the SECURITY guarantees of the
 * presigned-PUT design. Both replaced something the old presigned POST policy did
 * implicitly, so a regression here is silent rather than loud.
 */
describe('server/utils/s3Models — presigned PUT (upload cap)', () => {
  it('signs content-length, which is what enforces the size cap', async () => {
    const res = await createModelUploadUrl({ key: 'models/m/v1/f/a.stl', contentType: 'application/octet-stream', sizeBytes: 1024 });
    expect(res.method).toBe('PUT');
    expect(res.headers['content-length']).toBe('1024');
    // The signature must actually cover it — otherwise the cap is decorative.
    const signedHeaders = new URL(res.url).searchParams.get('X-Amz-SignedHeaders') ?? '';
    expect(signedHeaders).toContain('content-length');
  });

  it('signs the storage class so it cannot be downgraded by the client', async () => {
    const res = await createModelUploadUrl({ key: 'models/m/v1/f/a.stl', contentType: 'application/octet-stream', sizeBytes: 10 });
    expect(res.headers['x-amz-storage-class']).toBe('INTELLIGENT_TIERING');
    expect(new URL(res.url).searchParams.get('X-Amz-SignedHeaders')).toContain('x-amz-storage-class');
  });

  it('sets an explicit 15-minute expiry (aws4fetch defaults s3 to 24h)', async () => {
    const res = await createModelUploadUrl({ key: 'models/m/v1/f/a.stl', contentType: 'application/octet-stream', sizeBytes: 10 });
    expect(new URL(res.url).searchParams.get('X-Amz-Expires')).toBe('900');
  });

  it('binds the sha256 checksum when supplied', async () => {
    const res = await createModelUploadUrl({
      key: 'models/m/v1/f/a.stl', contentType: 'application/octet-stream', sizeBytes: 10, checksumSha256: 'YmFzZTY0',
    });
    expect(res.headers['x-amz-checksum-sha256']).toBe('YmFzZTY0');
    expect(new URL(res.url).searchParams.get('X-Amz-SignedHeaders')).toContain('x-amz-checksum-sha256');
  });
});

describe('server/utils/s3Models — presigned GET (download)', () => {
  it('defaults to a 60-second expiry, not aws4fetch\'s 24-hour s3 default', async () => {
    const url = await createModelDownloadUrl({ key: 'models/m/v1/f/a.stl', fileName: 'a.stl' });
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('60');
  });

  it('signs response-content-disposition so the filename cannot be tampered with', async () => {
    const url = await createModelDownloadUrl({ key: 'models/m/v1/f/a.stl', fileName: 'a.stl' });
    const p = new URL(url).searchParams;
    expect(p.get('response-content-disposition')).toContain('attachment');
    expect(p.get('X-Amz-Signature')).toBeTruthy();
  });

  it('encodes each key segment but keeps the / separators', async () => {
    const url = await createModelDownloadUrl({ key: 'models/m/v1/f/a b.stl', fileName: 'a b.stl' });
    expect(new URL(url).pathname).toBe('/models/m/v1/f/a%20b.stl');
  });
});

/**
 * Error-path coverage for the two functions that talk to S3.
 *
 * These exist because a code review caught both mapping HTTP 403 to a
 * "benign" result. 403 from S3 means the CREDENTIALS are bad — measured against
 * the real bucket, a missing key with valid credentials is 404 and only invalid
 * credentials produce 403. Conflating them turned an IAM/key-rotation outage
 * into "your upload didn't arrive" (409) and, on the ranged GET, into a
 * PERMANENT upload_status:'failed'.
 */
function mockS3Response(status: number, headers: Record<string, string> = {}, body = new Uint8Array(0)) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as unknown as Response;
}

// NOTE: do NOT use vi.unstubAllGlobals() here — it would also remove the
// module-level `createError` / `useRuntimeConfig` stubs above, breaking every
// other suite in this file. Restore only `fetch`.
const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
function stubFetch(fn: () => Promise<Response>) {
  fetchMock = vi.fn(fn);
  (globalThis as any).fetch = fetchMock;
}
afterEach(() => {
  (globalThis as any).fetch = realFetch;
});

describe('server/utils/s3Models — headModelObject error mapping', () => {
  it('reports a missing object for 404', async () => {
    stubFetch(async () => mockS3Response(404));
    await expect(headModelObject('models/m/v1/f/a.stl')).resolves.toEqual({ exists: false, size: 0 });
  });

  it('THROWS on 403 rather than claiming the object is missing', async () => {
    // Regression guard: 403 means bad credentials. Reporting {exists:false} here
    // makes finalize answer 409 "Upload not found in storage" for every user the
    // moment a key is rotated, with nothing logged.
    stubFetch(async () => mockS3Response(403));
    await expect(headModelObject('models/m/v1/f/a.stl')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws on other non-ok statuses', async () => {
    stubFetch(async () => mockS3Response(500));
    await expect(headModelObject('models/m/v1/f/a.stl')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('returns the size from content-length on success', async () => {
    stubFetch(async () => mockS3Response(200, { 'content-length': '4096' }));
    await expect(headModelObject('models/m/v1/f/a.stl')).resolves.toEqual({ exists: true, size: 4096 });
    // Proves these suites exercise the stub rather than reaching the network.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 attempts on 5xx rather than aws4fetch\'s default 10 retries', async () => {
    // Regression guard: the default (retries:10, initRetryMs:50) spends ~51s
    // retrying inside a single request, past any serverless timeout.
    stubFetch(async () => mockS3Response(500));
    await expect(headModelObject('models/m/v1/f/a.stl')).rejects.toMatchObject({ statusCode: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('server/utils/s3Models — getModelObjectHead error mapping', () => {
  it('THROWS on 404 instead of returning an empty buffer', async () => {
    // Regression guard: an empty buffer fails the caller's magic-byte sniff, and
    // finalize marks a failed sniff as upload_status:'failed' permanently.
    stubFetch(async () => mockS3Response(404));
    await expect(getModelObjectHead('models/m/v1/f/a.stl')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('THROWS on 403 instead of returning an empty buffer', async () => {
    stubFetch(async () => mockS3Response(403));
    await expect(getModelObjectHead('models/m/v1/f/a.stl')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('accepts 206 (the normal ranged-GET answer) and returns the bytes', async () => {
    const body = new Uint8Array([0x73, 0x6f, 0x6c, 0x69, 0x64]); // "solid"
    stubFetch(async () => mockS3Response(206, {}, body));
    const buf = await getModelObjectHead('models/m/v1/f/a.stl', 512);
    expect(Buffer.from(buf).toString('utf8')).toBe('solid');
  });

  it('truncates to the requested length', async () => {
    stubFetch(async () => mockS3Response(206, {}, new Uint8Array(1000).fill(0x41)));
    expect((await getModelObjectHead('models/m/v1/f/a.stl', 512)).length).toBe(512);
  });
});
