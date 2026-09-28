/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/membership/youtube-sync — YouTube member bridge proxy
// (classicminidiy-supabase docs/plans/2026-09-28-youtube-member-bridge.md §6).
// Forwards the caller's access token to the youtube-bridge-sync Edge Function,
// passes the four 200 statuses through, and keeps the edge function's error
// status with its code in data.error.
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();
const getHeader = vi.fn();

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  e.data = opts.data;
  return e;
});
vi.stubGlobal('getHeader', getHeader);
vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { supabaseUrl: 'https://test.supabase.co/', supabaseKey: 'test-anon-key' },
}));

const handler = (await import('~~/server/api/membership/youtube-sync.post')).default as (e: any) => Promise<any>;
const evt = (): any => ({ node: { req: {} } });

/** A FetchError-like rejection, as ofetch throws for a non-2xx answer. */
function edgeError(status: number, body: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { statusCode: status, data: body });
}

beforeEach(() => {
  fetchMock.mockReset();
  getHeader
    .mockReset()
    .mockImplementation((_e: unknown, name: string) => (name === 'authorization' ? 'Bearer user-token' : undefined));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/membership/youtube-sync', () => {
  it('401s without a Bearer token and never calls the edge function', async () => {
    getHeader.mockReturnValue(undefined);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401, data: { error: 'unauthorized' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401s on a non-Bearer authorization header', async () => {
    getHeader.mockReturnValue('Basic abc');
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the caller token and the anon key to youtube-bridge-sync, with no body', async () => {
    fetchMock.mockResolvedValue({ status: 'no_identity' });
    await handler(evt());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://test.supabase.co/functions/v1/youtube-bridge-sync');
    expect(opts).toEqual({
      method: 'POST',
      headers: { authorization: 'Bearer user-token', apikey: 'test-anon-key' },
    });
  });

  it.each(['base', 'plus', 'pro'] as const)('passes linked with plan %s through', async (plan) => {
    fetchMock.mockResolvedValue({ status: 'linked', plan });
    await expect(handler(evt())).resolves.toEqual({ status: 'linked', plan });
  });

  it('returns linked with a null plan when the plan is not one we know', async () => {
    fetchMock.mockResolvedValue({ status: 'linked', plan: 'platinum' });
    await expect(handler(evt())).resolves.toEqual({ status: 'linked', plan: null });
  });

  it.each(['no_identity', 'not_in_server', 'no_level_role'] as const)('passes %s through', async (status) => {
    fetchMock.mockResolvedValue({ status, plan: 'pro' });
    await expect(handler(evt())).resolves.toEqual({ status });
  });

  it('502s on a 200 with an unknown status', async () => {
    fetchMock.mockResolvedValue({ status: 'maybe' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 502, data: { error: 'sync_failed' } });
  });

  it.each([
    [401, 'unauthorized'],
    [409, 'identity_conflict'],
    [429, 'too_many_requests'],
    [503, 'not_configured'],
    [500, 'sync_failed'],
  ])('keeps the edge function status %i and its code %s', async (status, code) => {
    fetchMock.mockRejectedValue(edgeError(status, { error: code }));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: status, data: { error: code } });
  });

  it('falls back to 502 and sync_failed on a network error', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'));
    const err: any = await handler(evt()).catch((e) => e);
    expect(err.statusCode).toBe(502);
    expect(err.data).toEqual({ error: 'sync_failed' });
  });
});
