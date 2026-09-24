/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminAuth = vi.fn();
vi.mock('~~/server/utils/adminAuth', () => ({ requireAdminAuth }));
const invalidateReferenceDatasets = vi.fn();
vi.mock('~~/server/utils/referenceData', () => ({ invalidateReferenceDatasets }));

const raw = vi.fn();
vi.stubGlobal('$fetch', Object.assign(vi.fn(), { raw }));
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('setResponseStatus', vi.fn());
vi.stubGlobal('useRuntimeConfig', () => ({ public: { supabaseUrl: 'https://auth.example.com/', supabaseKey: 'pk' } }));
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.statusMessage), { statusCode: o.statusCode }));

const { forwardToPublishFunction, assertDatasetKey } = await import('~~/server/utils/referenceAdmin');
const body = { mode: 'publish', note: 'fix', items: [{ dataset: 'needles', base_version: 1, payload: '[\n 1 ]' }] };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminAuth.mockResolvedValue({ user: { id: 'u' }, accessToken: 'admin-jwt', tokenSource: 'header' });
  (readBody as any).mockResolvedValue(structuredClone(body));
  raw.mockResolvedValue({ status: 200, _data: { results: [] } });
});

describe('forwardToPublishFunction', () => {
  it("forwards with the admin's own token, and the route's mode overrides the body's", async () => {
    await forwardToPublishFunction({} as any, 'validate');
    const [url, opts] = raw.mock.calls[0];
    expect(url).toBe('https://auth.example.com/functions/v1/publish-reference-data');
    expect(opts.headers.Authorization).toBe('Bearer admin-jwt');
    expect(opts.body.mode).toBe('validate');
    // The payload string reaches the function unchanged.
    expect(opts.body.items[0].payload).toBe('[\n 1 ]');
    expect(invalidateReferenceDatasets).not.toHaveBeenCalled();
  });

  it('refuses a cookie-authenticated admin (header only: no CSRF path)', async () => {
    requireAdminAuth.mockResolvedValue({ user: { id: 'u' }, accessToken: 't', tokenSource: 'cookie' });
    await expect(forwardToPublishFunction({} as any, 'publish')).rejects.toMatchObject({ statusCode: 401 });
    expect(raw).not.toHaveBeenCalled();
  });

  it('invalidates the web caches for published datasets, and passes the status through', async () => {
    await forwardToPublishFunction({} as any, 'publish');
    expect(invalidateReferenceDatasets).toHaveBeenCalledWith(['needles']);
    raw.mockResolvedValue({ status: 409, _data: { code: 'publish_disabled' } });
    const res = await forwardToPublishFunction({} as any, 'publish');
    expect(setResponseStatus).toHaveBeenLastCalledWith({}, 409);
    expect(res).toEqual({ code: 'publish_disabled' });
    expect(invalidateReferenceDatasets).toHaveBeenCalledTimes(1);
  });

  it('refuses a body that is not an object', async () => {
    (readBody as any).mockResolvedValue([1]);
    await expect(forwardToPublishFunction({} as any, 'validate')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('assertDatasetKey', () => {
  it('accepts dataset keys and refuses anything else', () => {
    expect(assertDatasetKey('torque_specs')).toBe('torque_specs');
    for (const bad of ['', 'Torque', '../x', 'a', 3]) expect(() => assertDatasetKey(bad)).toThrow();
  });
});
