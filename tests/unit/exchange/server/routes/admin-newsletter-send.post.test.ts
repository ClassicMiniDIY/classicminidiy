/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports requireAdminAuth via the relative specifier
// (../../../../utils/adminAuth). Vitest resolves that to the same absolute
// module as the `~~/server/utils/adminAuth` id below, and vi.mock matches by
// resolved id.
//
// Everything else the route touches is a Nuxt/h3 GLOBAL already provided by
// tests/setup/vitest.setup.ts: useRuntimeConfig (public.supabaseUrl /
// public.supabaseKey + SUPABASE_SERVICE_KEY), readBody, createError,
// defineEventHandler, and $fetch (the outbound edge-function call). We drive
// those per-test rather than mocking modules.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/adminAuth', () => ({
  requireAdminAuth: vi.fn(),
}));

import { requireAdminAuth } from '~~/server/utils/adminAuth';

const handler = (await import('~~/server/api/admin/exchange/newsletter/send.post')).default;

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const ADMIN_ID = 'admin-1';
const ADMIN_EMAIL = 'admin@classicminidiy.com';
const EDGE_SUCCESS = { success: true, status: 'sent', totalAttempted: 12, listingCount: 7, sendId: 'send-abc' };

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
  // body default: no forceOverride.
  (readBody as any).mockResolvedValue({});
  // edge function succeeds by default; the route returns its body verbatim.
  ($fetch as any).mockResolvedValue(EDGE_SUCCESS);
  defaultRuntimeConfig();
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('server/api/admin/exchange/newsletter/send.post', () => {
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
    // Config guard runs before the body read + edge call.
    expect(readBody).not.toHaveBeenCalled();
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
  //  Happy path — proxy to the process-notifications edge function
  // =========================================================================
  it('returns the edge function body verbatim on success', async () => {
    const result = await handler(evt());
    expect(result).toBe(EDGE_SUCCESS);
  });

  it('targets the process-notifications endpoint with a trimmed trailing slash on the base url', async () => {
    (useRuntimeConfig as any).mockReturnValue({
      public: { supabaseUrl: 'https://test.supabase.co/', supabaseKey: 'test-anon-key' },
      SUPABASE_SERVICE_KEY: 'test-service-key',
    });

    await handler(evt());

    const [url] = fetchCall()!;
    // The route does `.replace(/\/$/, '')` so there is no double slash.
    expect(url).toBe('https://test.supabase.co/functions/v1/process-notifications');
  });

  it('POSTs with the service key as Bearer, the anon key as apikey, and json content-type', async () => {
    await handler(evt());

    const [url, opts] = fetchCall()!;
    expect(url).toBe('https://test.supabase.co/functions/v1/process-notifications');
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({
      Authorization: 'Bearer test-service-key',
      apikey: 'test-anon-key',
      'content-type': 'application/json',
    });
  });

  it('sends the newsletter_send action with the admin id as sentBy and forceOverride=false by default', async () => {
    await handler(evt());

    const [, opts] = fetchCall()!;
    expect(opts.body).toEqual({ action: 'newsletter_send', forceOverride: false, sentBy: ADMIN_ID });
  });

  it('calls the edge function exactly once', async () => {
    await handler(evt());
    expect($fetch).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  //  forceOverride coercion — always a boolean via !!body?.forceOverride
  // =========================================================================
  it('forwards forceOverride=true when the body sets it', async () => {
    (readBody as any).mockResolvedValue({ forceOverride: true });

    await handler(evt());

    const [, opts] = fetchCall()!;
    expect(opts.body).toEqual({ action: 'newsletter_send', forceOverride: true, sentBy: ADMIN_ID });
  });

  it('coerces a truthy non-boolean forceOverride to true', async () => {
    (readBody as any).mockResolvedValue({ forceOverride: 'yes' as any });

    await handler(evt());

    const [, opts] = fetchCall()!;
    expect(opts.body.forceOverride).toBe(true);
  });

  it('coerces a falsy forceOverride to false', async () => {
    (readBody as any).mockResolvedValue({ forceOverride: 0 as any });

    await handler(evt());

    const [, opts] = fetchCall()!;
    expect(opts.body.forceOverride).toBe(false);
  });

  it('defaults forceOverride to false when the body is null (optional-chained body?.forceOverride)', async () => {
    (readBody as any).mockResolvedValue(null);

    await handler(evt());

    const [, opts] = fetchCall()!;
    expect(opts.body.forceOverride).toBe(false);
  });

  // =========================================================================
  //  Result-mapping — blocked guard surfaces as 429
  // =========================================================================
  it('maps a blocked result (success:false, status:blocked) to a 429 with the result error message', async () => {
    ($fetch as any).mockResolvedValue({
      success: false,
      status: 'blocked',
      error: 'Newsletter sent 2 days ago',
    });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: 'Newsletter sent 2 days ago',
    });
  });

  it('maps a blocked result without an error message to a 429 with the default message', async () => {
    ($fetch as any).mockResolvedValue({ success: false, status: 'blocked' });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 429,
      statusMessage: 'Newsletter was already sent recently',
    });
  });

  // =========================================================================
  //  Result-mapping — any other success:false surfaces as 400
  // =========================================================================
  it('maps a non-blocked failure (success:false) to a 400 with the result error message', async () => {
    ($fetch as any).mockResolvedValue({
      success: false,
      status: 'no_subscribers',
      error: 'No subscribers to send to',
    });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'No subscribers to send to',
    });
  });

  it('maps a non-blocked failure without an error to a 400 whose message includes the status', async () => {
    ($fetch as any).mockResolvedValue({ success: false, status: 'empty' });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Newsletter not sent (empty)',
    });
  });

  it('prioritizes the 429 blocked branch over the generic 400 branch', async () => {
    // status:blocked must short-circuit to 429, never falling through to 400.
    ($fetch as any).mockResolvedValue({ success: false, status: 'blocked', error: 'too soon' });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
  });

  it('treats success:true with a non-sent status as success (returns the body)', async () => {
    // Only `success === false` triggers the throw branches; a truthy success is
    // returned verbatim regardless of status.
    const partial = { success: true, status: 'partial', totalAttempted: 5, listingCount: 2, sendId: 's1' };
    ($fetch as any).mockResolvedValue(partial);

    const result = await handler(evt());
    expect(result).toBe(partial);
  });

  // =========================================================================
  //  Edge-function thrown-error mapping (network/HTTP failures)
  // =========================================================================
  it('maps an edge error with statusCode + data.error to that status/message', async () => {
    ($fetch as any).mockRejectedValue(
      Object.assign(new Error('upstream'), { statusCode: 422, data: { error: 'Bad request' } })
    );

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'Bad request',
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
      statusMessage: 'Failed to send newsletter',
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

  // =========================================================================
  //  Edge cases — result presence guards (`result && ...`)
  // =========================================================================
  it('returns a null result verbatim (the success:false guards are short-circuited)', async () => {
    // The route guards with `result && result.success === false`, so a null
    // result skips both throw branches and is returned as-is.
    ($fetch as any).mockResolvedValue(null);

    const result = await handler(evt());
    expect(result).toBeNull();
  });
});
