/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// createError is referenced by getModelsS3 (not exercised here) — stub for safety.
vi.stubGlobal('createError', (opts: any) => Object.assign(new Error(opts.statusMessage), opts));
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({ S3_MODELS_BUCKET: 'b', S3_MODELS_ACCESS_KEY_ID: 'k', S3_MODELS_SECRET_ACCESS_KEY: 's' }))
);

import { buildModelKey, sanitizeModelFilename, contentDisposition } from '~/server/utils/s3Models';

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
