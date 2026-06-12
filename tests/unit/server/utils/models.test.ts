/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRuntimeConfig = vi.fn();
vi.stubGlobal('useRuntimeConfig', mockRuntimeConfig);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  return e;
});

import { normalizeExt, isAllowedExt, inferKind, RENDERABLE_EXTS, MODEL_FILE_EXTS } from '~/server/utils/models';

describe('server/utils/models — extension helpers', () => {
  it('normalizeExt strips a dot, lowercases, and trims', () => {
    expect(normalizeExt('.STL')).toBe('stl');
    expect(normalizeExt('  3MF ')).toBe('3mf');
    expect(normalizeExt('Stp')).toBe('stp');
  });

  it('isAllowedExt only accepts the allowlist', () => {
    for (const ext of MODEL_FILE_EXTS) expect(isAllowedExt(ext)).toBe(true);
    expect(isAllowedExt('exe')).toBe(false);
    expect(isAllowedExt('zip')).toBe(false);
    expect(isAllowedExt('STL')).toBe(false); // must be normalized first
  });

  it('inferKind maps pdf→document, renderable→model, else→source', () => {
    expect(inferKind('pdf')).toBe('document');
    expect(inferKind('stl')).toBe('model');
    expect(inferKind('3mf')).toBe('model');
    expect(inferKind('obj')).toBe('model');
    expect(inferKind('step')).toBe('source');
    expect(inferKind('scad')).toBe('source');
  });

  it('RENDERABLE_EXTS is exactly stl/3mf/obj', () => {
    expect([...RENDERABLE_EXTS].sort()).toEqual(['3mf', 'obj', 'stl']);
  });
});
