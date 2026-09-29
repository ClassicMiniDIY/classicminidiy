/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// social-retry is a thin proxy: requireAdminAuth -> validate body -> forward to
// the `post-listing-social` Supabase edge function with the service-role bearer,
// returning its body verbatim (errors mapped in the catch). The route imports
// requireAdminAuth via a relative specifier that resolves to the same module as
// `~~/server/utils/adminAuth`. Everything else it touches (useRuntimeConfig,
// readBody, createError, defineEventHandler, $fetch) is a Nuxt/h3 GLOBAL from
// tests/setup/vitest.setup.ts, driven per-test.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/adminAuth', () => ({
  requireAdminAuth: vi.fn(),
}));

import { requireAdminAuth } from '~~/server/utils/adminAuth';

const handler = (await import('~~/server/api/admin/exchange/social-retry.post')).default;

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const ADMIN_ID = 'admin-1';
const ADMIN_EMAIL = 'admin@classicminidiy.com';
const LISTING_ID = 'listing-123';
const PLATFORMS = ['facebook', 'bluesky'];
const EDGE_SUCCESS = {
  success: true,
  results: [
    { platform: 'facebook', success: true },
    { platform: 'bluesky', success: true },
  ],
  allSucceeded: true,
};

function evt(): any {
  return { context: {} };
}

/** Capture the args $fetch was invoked with (url, options). */
function fetchCall(): [string, any] | undefined {
  return ($fetch as any).mock.calls[0];
}

/** Restore the default runtimeConfig the setup file provides. */
function defaultRuntimeConfig() {
  (useRuntimeConfig as any).mockReturnValue({
    public: {
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-anon-key',
    },
    SUPABASE_SERVICE_KEY: 'test-service-key',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // adminAuth passes by default, yielding an admin user.
  (requireAdminAuth as any).mockResolvedValue({ user: { id: ADMIN_ID, email: ADMIN_EMAIL }, profile: { is_admin: true } });
  // valid body by default: a listing id + a non-empty platforms array.
  (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: PLATFORMS });
  // edge function succeeds by default; the route returns its body verbatim.
  ($fetch as any).mockResolvedValue(EDGE_SUCCESS);
  defaultRuntimeConfig();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('server/api/admin/exchange/social-retry.post', () => {
  // =========================================================================
  //  Auth (401 / 403) — propagated from requireAdminAuth before any work
  // =========================================================================
  it('propagates 401 from requireAdminAuth before reading the body or calling the edge fn', async () => {
    (requireAdminAuth as any).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 })
    );

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(readBody).not.toHaveBeenCalled();
    expect($fetch).not.toHaveBeenCalled();
  });

  it('propagates 403 from requireAdminAuth (authenticated but not admin)', async () => {
    (requireAdminAuth as any).mockRejectedValue(
      Object.assign(new Error('Admin access required'), { statusCode: 403 })
    );

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect($fetch).not.toHaveBeenCalled();
  });

  it('passes the event through to requireAdminAuth', async () => {
    const e = evt();
    await handler(e);
    expect(requireAdminAuth).toHaveBeenCalledWith(e);
  });

  // =========================================================================
  //  Body validation (400) — before the config guard + edge call
  // =========================================================================
  it('throws 400 when listingId is missing', async () => {
    (readBody as any).mockResolvedValue({ platforms: PLATFORMS });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing listingId',
    });
    expect($fetch).not.toHaveBeenCalled();
  });

  it('throws 400 when platforms is missing', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing or invalid platforms array',
    });
    expect($fetch).not.toHaveBeenCalled();
  });

  it('throws 400 when platforms is an empty array', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: [] });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing or invalid platforms array',
    });
    expect($fetch).not.toHaveBeenCalled();
  });

  it('throws 400 when platforms is not an array', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: 'facebook' as any });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing or invalid platforms array',
    });
    expect($fetch).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Config guard (500) — supabaseUrl / serviceKey must both be present
  // =========================================================================
  it('throws 500 when supabaseUrl is empty', async () => {
    (useRuntimeConfig as any).mockReturnValue({
      public: { supabaseUrl: '', supabaseKey: 'test-anon-key' },
      SUPABASE_SERVICE_KEY: 'test-service-key',
    });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Supabase not configured',
    });
    expect($fetch).not.toHaveBeenCalled();
  });

  it('throws 500 when SUPABASE_SERVICE_KEY is empty', async () => {
    (useRuntimeConfig as any).mockReturnValue({
      public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-anon-key' },
      SUPABASE_SERVICE_KEY: '',
    });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Supabase not configured',
    });
    expect($fetch).not.toHaveBeenCalled();
  });

  it('throws 500 when supabaseUrl is undefined (optional-chained .replace)', async () => {
    (useRuntimeConfig as any).mockReturnValue({
      public: { supabaseKey: 'test-anon-key' },
      SUPABASE_SERVICE_KEY: 'test-service-key',
    });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Supabase not configured',
    });
  });

  it('runs requireAdminAuth before the supabase-config guard', async () => {
    (useRuntimeConfig as any).mockReturnValue({
      public: { supabaseUrl: '', supabaseKey: '' },
      SUPABASE_SERVICE_KEY: '',
    });
    (requireAdminAuth as any).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 })
    );

    // Auth failure (401) wins over the would-be config 500.
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
  });

  // =========================================================================
  //  Happy path — proxy to the post-listing-social edge function
  // =========================================================================
  it('returns the edge function body verbatim on success', async () => {
    const result = await handler(evt());
    expect(result).toBe(EDGE_SUCCESS);
  });

  it('targets the post-listing-social endpoint with a trimmed trailing slash on the base url', async () => {
    (useRuntimeConfig as any).mockReturnValue({
      public: { supabaseUrl: 'https://test.supabase.co/', supabaseKey: 'test-anon-key' },
      SUPABASE_SERVICE_KEY: 'test-service-key',
    });

    await handler(evt());

    const [url] = fetchCall()!;
    // The route does `.replace(/\/$/, '')` so there is no double slash.
    expect(url).toBe('https://test.supabase.co/functions/v1/post-listing-social');
  });

  it('POSTs with the service key as Bearer, the anon key as apikey, and json content-type', async () => {
    await handler(evt());

    const [url, opts] = fetchCall()!;
    expect(url).toBe('https://test.supabase.co/functions/v1/post-listing-social');
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({
      Authorization: 'Bearer test-service-key',
      apikey: 'test-anon-key',
      'content-type': 'application/json',
    });
  });

  it('forwards the listingId and platforms in the request body', async () => {
    await handler(evt());

    const [, opts] = fetchCall()!;
    expect(opts.body).toEqual({ listingId: LISTING_ID, platforms: PLATFORMS });
  });

  it('calls the edge function exactly once', async () => {
    await handler(evt());
    expect($fetch).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  //  Edge-function thrown-error mapping (network/HTTP failures)
  // =========================================================================
  it('maps an edge error with statusCode + data.error to that status/message', async () => {
    ($fetch as any).mockRejectedValue(
      Object.assign(new Error('upstream'), { statusCode: 422, data: { error: 'Listing not found' } })
    );

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'Listing not found',
    });
  });

  it('maps an edge error using response.status when statusCode is absent', async () => {
    ($fetch as any).mockRejectedValue(
      Object.assign(new Error('upstream'), { response: { status: 503 }, data: { error: 'Service down' } })
    );

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Service down',
    });
  });

  it('falls back to 502 + a generic message when the edge error carries no status or message', async () => {
    ($fetch as any).mockRejectedValue(new Error('network blip'));

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Failed to retry social posting',
    });
  });

  it('uses statusMessage from the error when data.error is absent', async () => {
    ($fetch as any).mockRejectedValue(
      Object.assign(new Error('boom'), { statusCode: 418, statusMessage: 'Teapot' })
    );

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 418,
      statusMessage: 'Teapot',
    });
  });

  it('logs the edge function error to console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ($fetch as any).mockRejectedValue(
      Object.assign(new Error('boom'), { statusCode: 500, data: { error: 'kaboom' } })
    );

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
