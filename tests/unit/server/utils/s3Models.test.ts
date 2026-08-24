/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

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
