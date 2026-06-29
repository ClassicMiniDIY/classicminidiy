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

const handler = (await import('~~/server/api/admin/exchange/newsletter/test.post')).default;

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = 'admin@classicminidiy.com';
const EDGE_RESULT = { success: true, sentTo: ADMIN_EMAIL, listingCount: 7 };

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
  // adminAuth passes by default, yielding an admin with an email.
  (requireAdminAuth as any).mockResolvedValue({ user: { id: 'admin-1', email: ADMIN_EMAIL }, profile: { is_admin: true } });
  // body default: no email -> falls back to the admin's account email.
  (readBody as any).mockResolvedValue({});
  // edge function succeeds by default; the route returns its body verbatim.
  ($fetch as any).mockResolvedValue(EDGE_RESULT);
  defaultRuntimeConfig();
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('server/api/admin/exchange/newsletter/test.post', () => {
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

  // =========================================================================
  //  Config guard (500) — supabaseUrl / serviceKey must both be present
  // =========================================================================
  it('throws 500 when supabaseUrl is missing', async () => {
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

  it('throws 500 when SUPABASE_SERVICE_KEY is missing', async () => {
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

  // =========================================================================
  //  Recipient resolution — body.email || user.email
  // =========================================================================
  it('throws 400 when neither a body email nor an admin account email exists', async () => {
    (requireAdminAuth as any).mockResolvedValue({ user: { id: 'admin-1' }, profile: { is_admin: true } });
    (readBody as any).mockResolvedValue({});

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'No test recipient — provide an email',
    });
    // No edge call once we have no recipient.
    expect($fetch).not.toHaveBeenCalled();
  });

  it('throws 400 when body.email is whitespace-only and admin has no email', async () => {
    // '   '.trim() is falsy -> falls through to user.email (also absent).
    (requireAdminAuth as any).mockResolvedValue({ user: { id: 'admin-1', email: '' }, profile: { is_admin: true } });
    (readBody as any).mockResolvedValue({ email: '   ' });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'No test recipient — provide an email',
    });
    expect($fetch).not.toHaveBeenCalled();
  });

  it("falls back to the admin's account email when body.email is blank", async () => {
    (readBody as any).mockResolvedValue({});

    const result = await handler(evt());

    expect(result).toEqual(EDGE_RESULT);
    const [, opts] = fetchCall()!;
    expect(opts.body).toEqual({ action: 'newsletter_test', email: ADMIN_EMAIL });
  });

  it('prefers an explicit body.email over the admin account email', async () => {
    (readBody as any).mockResolvedValue({ email: 'someone@else.test' });

    await handler(evt());

    const [, opts] = fetchCall()!;
    expect(opts.body).toEqual({ action: 'newsletter_test', email: 'someone@else.test' });
  });

  it('trims surrounding whitespace from a supplied body.email', async () => {
    (readBody as any).mockResolvedValue({ email: '  spaced@example.com  ' });

    await handler(evt());

    const [, opts] = fetchCall()!;
    // body.email && body.email.trim() yields the trimmed value.
    expect(opts.body.email).toBe('spaced@example.com');
  });

  // =========================================================================
  //  Happy path — proxy to the process-notifications edge function
  // =========================================================================
  it('returns the edge function body verbatim', async () => {
    const result = await handler(evt());
    expect(result).toBe(EDGE_RESULT);
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

  it('POSTs with the service key as Bearer, the anon key as apikey, and the newsletter_test action', async () => {
    await handler(evt());

    const [url, opts] = fetchCall()!;
    expect(url).toBe('https://test.supabase.co/functions/v1/process-notifications');
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({
      Authorization: 'Bearer test-service-key',
      apikey: 'test-anon-key',
      'content-type': 'application/json',
    });
    expect(opts.body).toEqual({ action: 'newsletter_test', email: ADMIN_EMAIL });
  });

  it('calls the edge function exactly once', async () => {
    await handler(evt());
    expect($fetch).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  //  Edge-function error mapping
  // =========================================================================
  it('maps an edge error with statusCode + data.error to that status/message', async () => {
    ($fetch as any).mockRejectedValue(
      Object.assign(new Error('upstream'), { statusCode: 422, data: { error: 'No subscribers' } })
    );

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: 'No subscribers',
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
      statusMessage: 'Failed to send test newsletter',
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

  it('does not call the edge function when recipient resolution fails (ordering)', async () => {
    // No recipient: the 400 must precede any outbound network call.
    (requireAdminAuth as any).mockResolvedValue({ user: { id: 'admin-1' }, profile: { is_admin: true } });
    (readBody as any).mockResolvedValue({ email: '' });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect($fetch).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Ordering invariant — auth runs before the config guard
  // =========================================================================
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
});
