/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('setResponseHeaders', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e = new Error(opts.message || opts.statusMessage);
  (e as any).statusCode = opts.statusCode;
  return e;
});

describe('server/api/decoders/engine', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/decoders/engine');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns an array of engine codes', () => {
    const result = handler({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('engine code entries have code field', () => {
    const result = handler({});
    const first = result[0];
    expect(first).toHaveProperty('code');
    expect(typeof first.code).toBe('string');
  });

  it('engine code entries have size field', () => {
    const result = handler({});
    const first = result[0];
    expect(first).toHaveProperty('size');
  });

  it('engine code entries have description field', () => {
    const result = handler({});
    const first = result[0];
    expect(first).toHaveProperty('description');
    expect(typeof first.description).toBe('string');
  });

  it('calls setResponseHeaders with long-lived cache headers', () => {
    const mockEvent = { id: 'test' };
    handler(mockEvent);
    expect(setResponseHeaders).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        'Cache-Control': expect.stringContaining('31536000'),
      })
    );
  });

  it('contains known engine code 8A', () => {
    const result = handler({});
    const found = result.find((entry: any) => entry.code === '8A');
    expect(found).toBeTruthy();
    expect(found.size).toBe('850');
  });
});
