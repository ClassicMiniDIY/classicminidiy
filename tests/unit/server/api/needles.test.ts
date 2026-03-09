/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('setResponseHeaders', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e = new Error(opts.message || opts.statusMessage);
  (e as any).statusCode = opts.statusCode;
  return e;
});

describe('server/api/needles/list', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/needles/list');
    handler = mod.default;
  });

  it('returns truthy data', async () => {
    const result = await handler({});
    expect(result).toBeTruthy();
  });

  it('returns object with all and initial keys', async () => {
    const result = await handler({});
    expect(result).toHaveProperty('all');
    expect(result).toHaveProperty('initial');
  });

  it('all is an array of needles', async () => {
    const result = await handler({});
    expect(Array.isArray(result.all)).toBe(true);
    expect(result.all.length).toBeGreaterThan(0);
  });

  it('initial is an array of starter needles', async () => {
    const result = await handler({});
    expect(Array.isArray(result.initial)).toBe(true);
    expect(result.initial.length).toBeGreaterThan(0);
  });

  it('needle entries have name, size, and data fields', async () => {
    const result = await handler({});
    const first = result.all[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('size');
    expect(first).toHaveProperty('data');
    expect(typeof first.name).toBe('string');
    expect(typeof first.size).toBe('number');
    expect(Array.isArray(first.data)).toBe(true);
  });

  it('needle data arrays have 16 stations', async () => {
    const result = await handler({});
    const first = result.all[0];
    expect(first.data.length).toBe(16);
  });

  it('initial needles also have correct shape', async () => {
    const result = await handler({});
    const first = result.initial[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('size');
    expect(first).toHaveProperty('data');
  });

  it('calls setResponseHeaders with cache headers', async () => {
    const mockEvent = { id: 'test' };
    await handler(mockEvent);
    expect(setResponseHeaders).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        'Cache-Control': expect.stringContaining('max-age='),
      })
    );
  });
});

describe('server/api/needles/suggested', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/needles/suggested');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns an object', () => {
    const result = handler({});
    expect(typeof result).toBe('object');
  });

  it('has keyed sections for different carb types', () => {
    const result = handler({});
    // The suggestedNeedles.json has keys like SingleHS2, etc.
    const keys = Object.keys(result);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('each section has title and items', () => {
    const result = handler({});
    const keys = Object.keys(result);
    const firstSection = result[keys[0]];
    expect(firstSection).toHaveProperty('title');
    expect(firstSection).toHaveProperty('items');
    expect(Array.isArray(firstSection.items)).toBe(true);
  });

  it('suggested needle items have expected fields', () => {
    const result = handler({});
    const keys = Object.keys(result);
    const firstSection = result[keys[0]];
    const firstItem = firstSection.items[0];
    expect(firstItem).toHaveProperty('engineSize');
    expect(firstItem).toHaveProperty('needleStd');
    expect(firstItem).toHaveProperty('needleRich');
    expect(firstItem).toHaveProperty('needleLean');
    expect(firstItem).toHaveProperty('springType');
  });

  it('calls setResponseHeaders with cache headers', () => {
    const mockEvent = { id: 'test' };
    handler(mockEvent);
    expect(setResponseHeaders).toHaveBeenCalledWith(
      mockEvent,
      expect.objectContaining({
        'Cache-Control': expect.stringContaining('max-age='),
      })
    );
  });
});
