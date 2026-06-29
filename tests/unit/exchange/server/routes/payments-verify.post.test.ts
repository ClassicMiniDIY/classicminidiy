/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Route under test
//
//   server/api/exchange/payments/verify.post.ts
//
// A thin web proxy: it validates the Bearer auth header + { sessionId } body,
// reads supabaseUrl/supabaseKey from runtimeConfig.public, then forwards to the
// `verify-listing-payment` Edge Function via $fetch. On $fetch failure it maps
// the error to a status/message and re-throws via createError.
//
// There are NO Supabase service-client / notification-queue imports here, so we
// only need to drive the globally-mocked h3 accessors (getHeader, readBody,
// createError), useRuntimeConfig, and $fetch (all installed in
// tests/setup/vitest.setup.ts).
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://test.supabase.co';
const SUPABASE_KEY = 'test-anon-key';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/verify-listing-payment`;
const BEARER = 'Bearer access-tok-123';

/** Default runtimeConfig the route reads (matches vitest.setup defaults). */
function setRuntimeConfig(overrides?: { supabaseUrl?: any; supabaseKey?: any }) {
  (useRuntimeConfig as any).mockReturnValue({
    public: {
      supabaseUrl: overrides && 'supabaseUrl' in overrides ? overrides.supabaseUrl : SUPABASE_URL,
      supabaseKey: overrides && 'supabaseKey' in overrides ? overrides.supabaseKey : SUPABASE_KEY,
    },
  });
}

/** authorization header value used by the route. */
function setAuthHeader(value: string | undefined) {
  (getHeader as any).mockImplementation((_e: any, name: string) =>
    name === 'authorization' ? value : undefined
  );
}

function setBody(body: any) {
  (readBody as any).mockResolvedValue(body);
}

/** Configure the proxied edge-function $fetch (global mock). */
function resolveFetch(result: any) {
  (global as any).$fetch.mockResolvedValue(result);
}
function rejectFetch(error: any) {
  (global as any).$fetch.mockRejectedValue(error);
}

async function loadHandler() {
  return (await import('~~/server/api/exchange/payments/verify.post')).default;
}

beforeEach(() => {
  setRuntimeConfig();
  setAuthHeader(BEARER);
  setBody({ sessionId: 'cs_test_123' });
  resolveFetch({ verified: true, listingIds: ['listing-1'], recorded: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('POST /api/exchange/payments/verify', () => {
  // -------------------------------------------------------------------------
  // Auth header validation (401)
  // -------------------------------------------------------------------------
  describe('authorization', () => {
    it('throws 401 when the authorization header is missing', async () => {
      setAuthHeader(undefined);
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Sign in required',
      });
      expect((global as any).$fetch).not.toHaveBeenCalled();
    });

    it('throws 401 when the authorization header does not start with "Bearer "', async () => {
      setAuthHeader('access-tok-123'); // no "Bearer " prefix
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
      expect((global as any).$fetch).not.toHaveBeenCalled();
    });

    it('rejects a lowercase "bearer " prefix (case-sensitive guard)', async () => {
      setAuthHeader('bearer access-tok-123');
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
      expect((global as any).$fetch).not.toHaveBeenCalled();
    });

    it('rejects an empty-string authorization header', async () => {
      setAuthHeader('');
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // -------------------------------------------------------------------------
  // Supabase URL configuration (500)
  // -------------------------------------------------------------------------
  describe('supabase config', () => {
    it('throws 500 when supabaseUrl is not configured', async () => {
      setRuntimeConfig({ supabaseUrl: undefined });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 500,
        statusMessage: 'Supabase URL not configured',
      });
      expect((global as any).$fetch).not.toHaveBeenCalled();
    });

    it('throws 500 when supabaseUrl is an empty string', async () => {
      setRuntimeConfig({ supabaseUrl: '' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 500 });
    });

    it('checks auth BEFORE supabase config (401 wins when both are bad)', async () => {
      setAuthHeader(undefined);
      setRuntimeConfig({ supabaseUrl: undefined });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // -------------------------------------------------------------------------
  // Body validation (400)
  // -------------------------------------------------------------------------
  describe('body validation', () => {
    it('throws 400 when sessionId is missing', async () => {
      setBody({});
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'sessionId required',
      });
      expect((global as any).$fetch).not.toHaveBeenCalled();
    });

    it('throws 400 when the body is null', async () => {
      setBody(null);
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when sessionId is an empty string (falsy)', async () => {
      setBody({ sessionId: '' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('validates body AFTER supabase config (500 wins over a bad body)', async () => {
      setRuntimeConfig({ supabaseUrl: undefined });
      setBody({});
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — proxies to the edge function
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('forwards { sessionId } to verify-listing-payment and returns the edge response verbatim', async () => {
      const edgeResponse = { verified: true, listingIds: ['listing-1', 'listing-2'], recorded: true };
      resolveFetch(edgeResponse);
      const handler = await loadHandler();

      const result = await handler({} as any);

      expect(result).toBe(edgeResponse);
      expect((global as any).$fetch).toHaveBeenCalledTimes(1);
      expect((global as any).$fetch).toHaveBeenCalledWith(EDGE_URL, {
        method: 'POST',
        headers: {
          authorization: BEARER,
          apikey: SUPABASE_KEY,
          'content-type': 'application/json',
        },
        body: { sessionId: 'cs_test_123' },
      });
    });

    it('returns a { verified: false, paymentStatus } edge response unchanged', async () => {
      const edgeResponse = { verified: false, paymentStatus: 'unpaid' };
      resolveFetch(edgeResponse);
      const handler = await loadHandler();

      await expect(handler({} as any)).resolves.toEqual(edgeResponse);
    });

    it('strips a trailing slash from supabaseUrl before building the edge URL', async () => {
      setRuntimeConfig({ supabaseUrl: `${SUPABASE_URL}/` });
      const handler = await loadHandler();

      await handler({} as any);

      expect((global as any).$fetch).toHaveBeenCalledWith(EDGE_URL, expect.anything());
      // No double-slash before /functions
      const calledUrl = (global as any).$fetch.mock.calls[0][0];
      expect(calledUrl).toBe(EDGE_URL);
      expect(calledUrl).not.toContain('.co//');
    });

    it('forwards the caller Bearer token verbatim (not the anon key) as authorization', async () => {
      const customBearer = 'Bearer user-specific-jwt';
      setAuthHeader(customBearer);
      const handler = await loadHandler();

      await handler({} as any);

      const opts = (global as any).$fetch.mock.calls[0][1];
      expect(opts.headers.authorization).toBe(customBearer);
      expect(opts.headers.apikey).toBe(SUPABASE_KEY);
    });

    it('does not leak extra body fields — only sessionId is forwarded', async () => {
      setBody({ sessionId: 'cs_x', listingId: 'should-be-ignored', evil: true });
      const handler = await loadHandler();

      await handler({} as any);

      const opts = (global as any).$fetch.mock.calls[0][1];
      expect(opts.body).toEqual({ sessionId: 'cs_x' });
    });
  });

  // -------------------------------------------------------------------------
  // Error mapping — edge-function failures
  // -------------------------------------------------------------------------
  describe('error mapping', () => {
    it('maps error.statusCode + error.data.error to the rethrown error', async () => {
      rejectFetch({ statusCode: 409, data: { error: 'Session already verified' } });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 409,
        statusMessage: 'Session already verified',
      });
    });

    it('prefers error.statusCode over error.response.status', async () => {
      rejectFetch({ statusCode: 422, response: { status: 500 }, data: { error: 'Unprocessable' } });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 422 });
    });

    it('falls back to error.response.status when statusCode is absent', async () => {
      rejectFetch({ response: { status: 404 }, data: { error: 'Not found' } });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 404,
        statusMessage: 'Not found',
      });
    });

    it('defaults to 502 when neither statusCode nor response.status is present', async () => {
      rejectFetch({ message: 'network down' });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 502,
        statusMessage: 'Could not verify payment',
      });
    });

    it('falls back to error.statusMessage when data.error is absent', async () => {
      rejectFetch({ statusCode: 503, statusMessage: 'Service Unavailable' });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: 'Service Unavailable',
      });
    });

    it('falls back to error.data.statusMessage when data.error and statusMessage are absent', async () => {
      rejectFetch({ statusCode: 500, data: { statusMessage: 'Edge boom' } });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 500,
        statusMessage: 'Edge boom',
      });
    });

    it('uses the generic "Could not verify payment" message when nothing else is available', async () => {
      rejectFetch({ statusCode: 500 });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 500,
        statusMessage: 'Could not verify payment',
      });
    });

    it('message precedence: data.error beats statusMessage and data.statusMessage', async () => {
      rejectFetch({
        statusCode: 400,
        data: { error: 'winner', statusMessage: 'loser-data' },
        statusMessage: 'loser-top',
      });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toMatchObject({ statusMessage: 'winner' });
    });

    it('logs the edge-function error to console.error', async () => {
      rejectFetch({ statusCode: 500, data: { error: 'boom' } });
      const handler = await loadHandler();

      await expect(handler({} as any)).rejects.toBeDefined();
      expect(console.error).toHaveBeenCalledWith(
        '[exchange/payments/verify] edge function error:',
        { error: 'boom' }
      );
    });
  });
});
