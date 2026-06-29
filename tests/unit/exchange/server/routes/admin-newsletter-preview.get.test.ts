/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports requireAdminAuth via a relative specifier
// (../../../../utils/adminAuth). Vitest resolves that to the same absolute
// module as the `~~/server/utils/adminAuth` id below, and vi.mock matches by
// resolved id. Network ($fetch) and useRuntimeConfig are h3/Nuxt globals
// installed in tests/setup/vitest.setup.ts; we override them per test.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/adminAuth', () => ({
  requireAdminAuth: vi.fn(),
}));

import { requireAdminAuth } from '~~/server/utils/adminAuth';

const handler = (await import('~~/server/api/admin/exchange/newsletter/preview.get')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const EDGE_URL = 'https://test.supabase.co/functions/v1/process-notifications';

/** Shape the edge fn returns for the newsletter_preview action. */
const PREVIEW_BODY = {
  html: '<html><body>This week on TME</body></html>',
  subject: 'This Week on The Mini Exchange',
  listingCount: 7,
  subscriberCount: 1243,
};

function evt(): any {
  return { context: {} };
}

/** The default runtimeConfig from vitest.setup (supabaseUrl + service key set). */
const DEFAULT_CONFIG = {
  public: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-anon-key',
  },
  SUPABASE_SERVICE_KEY: 'test-service-key',
};

function setConfig(config: any) {
  (useRuntimeConfig as any).mockReturnValue(config);
}

beforeEach(() => {
  vi.clearAllMocks();
  // adminAuth passes by default.
  (requireAdminAuth as any).mockResolvedValue({ user: { id: 'admin-1' }, profile: { is_admin: true } });
  // Config fully wired by default.
  setConfig(DEFAULT_CONFIG);
  // Edge fn returns a preview body by default.
  (globalThis.$fetch as any).mockReset();
  (globalThis.$fetch as any).mockResolvedValue(PREVIEW_BODY);
});

afterEach(() => {
  vi.clearAllMocks();
  (globalThis.$fetch as any).mockReset();
});

describe('server/api/admin/exchange/newsletter/preview.get', () => {
  // =========================================================================
  //  Auth (401 / 403) — propagated from requireAdminAuth before any work
  // =========================================================================
  it('propagates 401 from requireAdminAuth before touching config or $fetch', async () => {
    (requireAdminAuth as any).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 })
    );

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(useRuntimeConfig).not.toHaveBeenCalled();
    expect(globalThis.$fetch).not.toHaveBeenCalled();
  });

  it('propagates 403 from requireAdminAuth (authenticated but not admin)', async () => {
    (requireAdminAuth as any).mockRejectedValue(
      Object.assign(new Error('Admin access required'), { statusCode: 403 })
    );

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(globalThis.$fetch).not.toHaveBeenCalled();
  });

  it('awaits requireAdminAuth exactly once with the event', async () => {
    await handler(evt());
    expect(requireAdminAuth).toHaveBeenCalledTimes(1);
    // Auth runs before the proxy call.
    expect((requireAdminAuth as any).mock.invocationCallOrder[0]).toBeLessThan(
      (globalThis.$fetch as any).mock.invocationCallOrder[0]
    );
  });

  // =========================================================================
  //  Config guard (500) — missing supabaseUrl or service key
  // =========================================================================
  it('throws 500 when supabaseUrl is missing', async () => {
    setConfig({ public: { supabaseUrl: '', supabaseKey: 'k' }, SUPABASE_SERVICE_KEY: 'svc' });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Supabase not configured',
    });
    expect(globalThis.$fetch).not.toHaveBeenCalled();
  });

  it('throws 500 when supabaseUrl is undefined', async () => {
    setConfig({ public: { supabaseKey: 'k' }, SUPABASE_SERVICE_KEY: 'svc' });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Supabase not configured',
    });
    expect(globalThis.$fetch).not.toHaveBeenCalled();
  });

  it('throws 500 when SUPABASE_SERVICE_KEY is missing', async () => {
    setConfig({ public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'k' } });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Supabase not configured',
    });
    expect(globalThis.$fetch).not.toHaveBeenCalled();
  });

  it('throws 500 when SUPABASE_SERVICE_KEY is an empty string', async () => {
    setConfig({ public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'k' }, SUPABASE_SERVICE_KEY: '' });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Supabase not configured',
    });
  });

  // The config guard runs AFTER auth — auth must already have passed to reach it.
  it('checks auth before the config guard', async () => {
    (requireAdminAuth as any).mockRejectedValue(Object.assign(new Error('nope'), { statusCode: 401 }));
    setConfig({ public: {}, SUPABASE_SERVICE_KEY: '' }); // would 500 if reached
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
  });

  // =========================================================================
  //  Happy path — proxies to the edge fn and returns its body verbatim
  // =========================================================================
  it('returns the edge function body unchanged', async () => {
    const result = await handler(evt());
    expect(result).toBe(PREVIEW_BODY);
    expect(result).toEqual(PREVIEW_BODY);
  });

  it('POSTs to the process-notifications edge fn with the newsletter_preview action', async () => {
    await handler(evt());
    expect(globalThis.$fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (globalThis.$fetch as any).mock.calls[0];
    expect(url).toBe(EDGE_URL);
    expect(opts.method).toBe('POST');
    expect(opts.body).toEqual({ action: 'newsletter_preview' });
  });

  it('sends the service key as Bearer Authorization, anon key as apikey, and JSON content-type', async () => {
    await handler(evt());
    const [, opts] = (globalThis.$fetch as any).mock.calls[0];
    expect(opts.headers).toMatchObject({
      Authorization: 'Bearer test-service-key',
      apikey: 'test-anon-key',
      'content-type': 'application/json',
    });
  });

  // INVARIANT: the privileged service key is used for Authorization, NOT the
  // public anon key. apikey carries the anon key. Guards against swapping them.
  it('does not leak the service key into the apikey header (uses anon key there)', async () => {
    await handler(evt());
    const [, opts] = (globalThis.$fetch as any).mock.calls[0];
    expect(opts.headers.apikey).toBe('test-anon-key');
    expect(opts.headers.apikey).not.toBe('test-service-key');
    expect(opts.headers.Authorization).toBe('Bearer test-service-key');
  });

  // INVARIANT: a trailing slash on supabaseUrl must be stripped so the path
  // doesn't double-slash (.../functions vs ...//functions).
  it('strips a trailing slash from supabaseUrl before building the function path', async () => {
    setConfig({
      public: { supabaseUrl: 'https://test.supabase.co/', supabaseKey: 'test-anon-key' },
      SUPABASE_SERVICE_KEY: 'test-service-key',
    });
    await handler(evt());
    const [url] = (globalThis.$fetch as any).mock.calls[0];
    expect(url).toBe(EDGE_URL);
  });

  it('forwards an undefined supabaseKey as the apikey header (no crash)', async () => {
    setConfig({
      public: { supabaseUrl: 'https://test.supabase.co' },
      SUPABASE_SERVICE_KEY: 'test-service-key',
    });
    await handler(evt());
    const [, opts] = (globalThis.$fetch as any).mock.calls[0];
    expect(opts.headers.apikey).toBeUndefined();
    expect(opts.headers.Authorization).toBe('Bearer test-service-key');
  });

  // =========================================================================
  //  Error mapping — $fetch failures translated to createError
  // =========================================================================
  it('maps an error.statusCode through to the thrown error', async () => {
    (globalThis.$fetch as any).mockRejectedValue(
      Object.assign(new Error('upstream'), { statusCode: 429, data: { error: 'rate limited' } })
    );
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: 'rate limited',
    });
  });

  it('falls back to error.response.status when no top-level statusCode', async () => {
    (globalThis.$fetch as any).mockRejectedValue(
      Object.assign(new Error('upstream'), { response: { status: 503 }, data: { error: 'unavailable' } })
    );
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'unavailable',
    });
  });

  // INVARIANT: the message precedence is data.error > statusMessage > literal
  // fallback. A plain Error carries .message but NOT .statusMessage, so the
  // route ignores .message and uses the literal fallback (the console.error
  // still logs error.message). Status defaults to 502.
  it('defaults to 502 + literal fallback when only a plain Error is thrown', async () => {
    (globalThis.$fetch as any).mockRejectedValue(new Error('network down'));
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Failed to load newsletter preview',
    });
  });

  // INVARIANT: message precedence is error.data.error > error.statusMessage >
  // the literal fallback. A plain Error (no data.error, no statusMessage) lands
  // on the literal fallback string.
  it('uses the literal fallback message when no data.error and no statusMessage', async () => {
    (globalThis.$fetch as any).mockRejectedValue({}); // bare object, nothing useful
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Failed to load newsletter preview',
    });
  });

  it('prefers error.data.error over error.statusMessage for the message', async () => {
    (globalThis.$fetch as any).mockRejectedValue({
      statusCode: 400,
      statusMessage: 'should-not-win',
      data: { error: 'preview unavailable: no listings this week' },
    });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'preview unavailable: no listings this week',
    });
  });

  it('uses error.statusMessage when error.data.error is absent', async () => {
    (globalThis.$fetch as any).mockRejectedValue({
      statusCode: 418,
      statusMessage: 'I am a teapot',
    });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 418,
      statusMessage: 'I am a teapot',
    });
  });

  it('prefers statusCode over response.status when both exist', async () => {
    (globalThis.$fetch as any).mockRejectedValue(
      Object.assign(new Error('x'), { statusCode: 404, response: { status: 500 }, data: { error: 'not found' } })
    );
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'not found',
    });
  });

  it('logs the upstream error to console.error on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (globalThis.$fetch as any).mockRejectedValue(
      Object.assign(new Error('boom'), { statusCode: 500, data: { error: 'edge exploded' } })
    );
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    expect(spy).toHaveBeenCalledWith('[newsletter/preview] edge function error:', { error: 'edge exploded' });
    spy.mockRestore();
  });
});
