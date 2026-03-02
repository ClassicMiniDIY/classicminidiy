/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('setResponseHeaders', vi.fn());
vi.stubGlobal(
  'createError',
  (opts: any) => {
    const e = new Error(opts.message || opts.statusMessage);
    (e as any).statusCode = opts.statusCode;
    return e;
  },
);

describe('server/api/clearance', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/clearance');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns data with engineTable key', () => {
    const result = handler({});
    expect(result).toHaveProperty('engineTable');
  });

  it('engineTable has a title', () => {
    const result = handler({});
    expect(result.engineTable).toHaveProperty('title');
    expect(typeof result.engineTable.title).toBe('string');
  });

  it('calls setResponseHeaders with cache headers', () => {
    const mockEvent = { id: 'test' };
    handler(mockEvent);
    expect(setResponseHeaders).toHaveBeenCalledWith(mockEvent, expect.objectContaining({
      'Cache-Control': expect.stringContaining('max-age='),
    }));
  });

  it('throws createError when setResponseHeaders throws', () => {
    vi.mocked(setResponseHeaders).mockImplementationOnce(() => {
      throw new Error('header error');
    });
    expect(() => handler({})).toThrow();
  });
});

describe('server/api/engines', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/engines');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns data with engines key', () => {
    const result = handler({});
    expect(result).toHaveProperty('engines');
  });

  it('engines is an array', () => {
    const result = handler({});
    expect(Array.isArray(result.engines)).toBe(true);
  });

  it('each engine entry has expected fields', () => {
    const result = handler({});
    expect(result.engines.length).toBeGreaterThan(0);
    const first = result.engines[0];
    expect(first).toHaveProperty('group');
    expect(first).toHaveProperty('engineSize');
  });

  it('throws createError when setResponseHeaders throws', () => {
    vi.mocked(setResponseHeaders).mockImplementationOnce(() => {
      throw new Error('header error');
    });
    expect(() => handler({})).toThrow();
  });
});

describe('server/api/torque', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/torque');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns data with engineTable key', () => {
    const result = handler({});
    expect(result).toHaveProperty('engineTable');
  });

  it('engineTable has items array', () => {
    const result = handler({});
    expect(result.engineTable).toHaveProperty('items');
    expect(Array.isArray(result.engineTable.items)).toBe(true);
  });

  it('torque items have name, lbft, and nm fields', () => {
    const result = handler({});
    const first = result.engineTable.items[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('lbft');
    expect(first).toHaveProperty('nm');
  });

  it('throws createError when setResponseHeaders throws', () => {
    vi.mocked(setResponseHeaders).mockImplementationOnce(() => {
      throw new Error('header error');
    });
    expect(() => handler({})).toThrow();
  });
});

describe('server/api/weights', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/weights');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns data with CurbWeights key', () => {
    const result = handler({});
    expect(result).toHaveProperty('CurbWeights');
  });

  it('CurbWeights has items array', () => {
    const result = handler({});
    expect(result.CurbWeights).toHaveProperty('items');
    expect(Array.isArray(result.CurbWeights.items)).toBe(true);
  });

  it('weight items have item and weight fields', () => {
    const result = handler({});
    const first = result.CurbWeights.items[0];
    expect(first).toHaveProperty('item');
    expect(first).toHaveProperty('weight');
    expect(typeof first.weight).toBe('number');
  });

  it('throws createError when setResponseHeaders throws', () => {
    vi.mocked(setResponseHeaders).mockImplementationOnce(() => {
      throw new Error('header error');
    });
    expect(() => handler({})).toThrow();
  });
});

describe('server/api/parts', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/parts');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns data with airFilters key', () => {
    const result = handler({});
    expect(result).toHaveProperty('airFilters');
  });

  it('airFilters has items array', () => {
    const result = handler({});
    expect(result.airFilters).toHaveProperty('items');
    expect(Array.isArray(result.airFilters.items)).toBe(true);
  });

  it('parts items have expected fields', () => {
    const result = handler({});
    const first = result.airFilters.items[0];
    expect(first).toHaveProperty('brand');
    expect(first).toHaveProperty('part');
  });

  it('throws createError when setResponseHeaders throws', () => {
    vi.mocked(setResponseHeaders).mockImplementationOnce(() => {
      throw new Error('header error');
    });
    expect(() => handler({})).toThrow();
  });
});

describe('server/api/gearing', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('~/server/api/gearing');
    handler = mod.default;
  });

  it('returns truthy data', () => {
    const result = handler({});
    expect(result).toBeTruthy();
  });

  it('returns data with tires array', () => {
    const result = handler({});
    expect(result).toHaveProperty('tires');
    expect(Array.isArray(result.tires)).toBe(true);
    expect(result.tires.length).toBeGreaterThan(0);
  });

  it('returns data with diffs array', () => {
    const result = handler({});
    expect(result).toHaveProperty('diffs');
    expect(Array.isArray(result.diffs)).toBe(true);
    expect(result.diffs.length).toBeGreaterThan(0);
  });

  it('returns data with gearRatios array', () => {
    const result = handler({});
    expect(result).toHaveProperty('gearRatios');
    expect(Array.isArray(result.gearRatios)).toBe(true);
    expect(result.gearRatios.length).toBeGreaterThan(0);
  });

  it('returns data with speedosRatios array', () => {
    const result = handler({});
    expect(result).toHaveProperty('speedosRatios');
    expect(Array.isArray(result.speedosRatios)).toBe(true);
  });

  it('returns data with dropGears array', () => {
    const result = handler({});
    expect(result).toHaveProperty('dropGears');
    expect(Array.isArray(result.dropGears)).toBe(true);
  });

  it('returns data with speedos object containing metric and imperial', () => {
    const result = handler({});
    expect(result).toHaveProperty('speedos');
    expect(result.speedos).toHaveProperty('metric');
    expect(result.speedos).toHaveProperty('imperial');
    expect(Array.isArray(result.speedos.metric)).toBe(true);
    expect(Array.isArray(result.speedos.imperial)).toBe(true);
  });

  it('returns data with rpmTicks object', () => {
    const result = handler({});
    expect(result).toHaveProperty('rpmTicks');
    expect(typeof result.rpmTicks).toBe('object');
  });

  it('tire options have correct shape', () => {
    const result = handler({});
    const tire = result.tires[0];
    expect(tire).toHaveProperty('label');
    expect(tire).toHaveProperty('value');
    expect(tire.value).toHaveProperty('width');
    expect(tire.value).toHaveProperty('profile');
    expect(tire.value).toHaveProperty('size');
  });

  it('diff options have value and label', () => {
    const result = handler({});
    const diff = result.diffs[0];
    expect(diff).toHaveProperty('value');
    expect(diff).toHaveProperty('label');
    expect(typeof diff.value).toBe('number');
  });

  it('gear ratio options have 4-element value array', () => {
    const result = handler({});
    const gear = result.gearRatios[0];
    expect(gear).toHaveProperty('value');
    expect(gear).toHaveProperty('label');
    expect(Array.isArray(gear.value)).toBe(true);
    expect(gear.value.length).toBe(4);
  });

  it('throws createError when setResponseHeaders throws', () => {
    vi.mocked(setResponseHeaders).mockImplementationOnce(() => {
      throw new Error('header error');
    });
    expect(() => handler({})).toThrow();
  });
});
