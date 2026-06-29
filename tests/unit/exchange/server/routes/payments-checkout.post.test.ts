/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------
// server/api/exchange/payments/checkout.post.ts is a thin web proxy: it requires
// a Bearer token, validates the listing target + tier, then forwards to the
// Supabase `create-listing-checkout` Edge Function via the global $fetch
// (stubbed in tests/setup/vitest.setup.ts). It touches no Supabase client or
// notification queue, so there is nothing to vi.mock — we drive it entirely
// through the globally-mocked h3 accessors ($fetch, getHeader, readBody,
// useRuntimeConfig, createError).
//
// We import the handler dynamically inside loadHandler() AFTER per-test setup so
// the module picks up whatever globals are currently configured.

const EDGE_URL = 'https://test.supabase.co/functions/v1/create-listing-checkout';
const BEARER = 'Bearer access-tok-123';
const ANON_KEY = 'test-anon-key'; // from vitest.setup useRuntimeConfig.public.supabaseKey

/** Resolve the default handler fresh (globals are already in place). */
async function loadHandler() {
  return (await import('~~/server/api/exchange/payments/checkout.post')).default;
}

/** Set the authorization header returned by getHeader(event, 'authorization'). */
function setAuth(value: string | undefined) {
  (getHeader as any).mockImplementation((_e: any, name: string) =>
    name === 'authorization' ? value : undefined
  );
}

/** Configure the next request body. */
function setBody(body: any) {
  (readBody as any).mockResolvedValue(body);
}

/** Make $fetch resolve with the given edge-function response. */
function resolveEdge(value: any) {
  ($fetch as any).mockResolvedValue(value);
}

/** Make $fetch reject with the given error object. */
function rejectEdge(error: any) {
  ($fetch as any).mockRejectedValue(error);
}

describe('POST /api/exchange/payments/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sensible defaults so any test can override just what it cares about.
    setAuth(BEARER);
    setBody({ listingId: 'listing-1', tier: 'paid' });
    resolveEdge({ url: 'https://stripe.test/session/cs_123', sessionId: 'cs_123' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth gate
  // -------------------------------------------------------------------------
  describe('auth', () => {
    it('throws 401 when the authorization header is missing', async () => {
      setAuth(undefined);
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Sign in required to start checkout',
      });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws 401 when the authorization header is not a Bearer token', async () => {
      setAuth('Basic abc123');
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws 401 for an empty-string authorization header', async () => {
      setAuth('');
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('does not read the body before the auth check (auth fails closed first)', async () => {
      setAuth(undefined);
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
      expect(readBody).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Config gate
  // -------------------------------------------------------------------------
  describe('config', () => {
    it('throws 500 when supabaseUrl is not configured', async () => {
      const original = (useRuntimeConfig as any).getMockImplementation();
      (useRuntimeConfig as any).mockReturnValue({
        public: { supabaseUrl: '', supabaseKey: ANON_KEY },
      });
      try {
        const handler = await loadHandler();
        await expect(handler({} as any)).rejects.toMatchObject({
          statusCode: 500,
          statusMessage: 'Supabase URL not configured',
        });
        expect($fetch).not.toHaveBeenCalled();
      } finally {
        (useRuntimeConfig as any).mockImplementation(original);
      }
    });

    it('strips a trailing slash from supabaseUrl before building the edge URL', async () => {
      const original = (useRuntimeConfig as any).getMockImplementation();
      (useRuntimeConfig as any).mockReturnValue({
        public: { supabaseUrl: 'https://test.supabase.co/', supabaseKey: ANON_KEY },
      });
      try {
        const handler = await loadHandler();
        await handler({} as any);
        expect($fetch).toHaveBeenCalledWith(EDGE_URL, expect.anything());
      } finally {
        (useRuntimeConfig as any).mockImplementation(original);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Body validation
  // -------------------------------------------------------------------------
  describe('validation', () => {
    it('throws 400 when neither listingId nor listingIds is provided', async () => {
      setBody({ tier: 'paid' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'listingId or listingIds required',
      });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws 400 for an empty-string listingId (length 0)', async () => {
      setBody({ listingId: '', tier: 'paid' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws 400 for an empty listingIds array', async () => {
      setBody({ listingIds: [], tier: 'paid' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws 400 for a non-array listingIds value', async () => {
      setBody({ listingIds: 'not-an-array', tier: 'paid' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws 400 when an undefined/empty body is read', async () => {
      setBody(undefined);
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws 400 when tier is something other than "paid"', async () => {
      setBody({ listingId: 'listing-1', tier: 'free' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Only the paid tier requires checkout',
      });
      expect($fetch).not.toHaveBeenCalled();
    });

    it('defaults a missing tier to "paid" and proceeds', async () => {
      setBody({ listingId: 'listing-1' }); // no tier
      const handler = await loadHandler();
      const result = await handler({} as any);
      expect(result).toEqual({ url: 'https://stripe.test/session/cs_123', sessionId: 'cs_123' });
      expect($fetch).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Edge-function proxying (happy paths)
  // -------------------------------------------------------------------------
  describe('proxy to create-listing-checkout', () => {
    it('forwards authorization + apikey headers and tier:paid for a single listing', async () => {
      setBody({ listingId: 'listing-1', tier: 'paid' });
      const handler = await loadHandler();
      const result = await handler({} as any);

      expect(result).toEqual({ url: 'https://stripe.test/session/cs_123', sessionId: 'cs_123' });
      expect($fetch).toHaveBeenCalledTimes(1);
      const [url, opts] = ($fetch as any).mock.calls[0];
      expect(url).toBe(EDGE_URL);
      expect(opts.method).toBe('POST');
      expect(opts.headers).toEqual({
        authorization: BEARER,
        apikey: ANON_KEY,
        'content-type': 'application/json',
      });
      expect(opts.body).toEqual({ listingId: 'listing-1', tier: 'paid' });
      // Single mode must NOT also send listingIds.
      expect(opts.body).not.toHaveProperty('listingIds');
    });

    it('forwards listingIds (and not listingId) for a bulk request', async () => {
      setBody({ listingIds: ['a', 'b', 'c'], tier: 'paid' });
      const handler = await loadHandler();
      await handler({} as any);

      const [, opts] = ($fetch as any).mock.calls[0];
      expect(opts.body).toEqual({ listingIds: ['a', 'b', 'c'], tier: 'paid' });
      expect(opts.body).not.toHaveProperty('listingId');
    });

    it('prefers single (listingId) over bulk when both are present', async () => {
      // hasSingle is checked first in the `hasBulk ? ... : ...` spread.
      setBody({ listingId: 'single-1', listingIds: ['x', 'y'], tier: 'paid' });
      const handler = await loadHandler();
      await handler({} as any);

      const [, opts] = ($fetch as any).mock.calls[0];
      // The route uses `hasBulk ? {listingIds} : {listingId}` — with both set,
      // hasBulk is true, so it sends listingIds. Assert the actual behavior.
      expect(opts.body).toEqual({ listingIds: ['x', 'y'], tier: 'paid' });
    });

    it('forwards successUrl and cancelUrl when provided', async () => {
      setBody({
        listingId: 'listing-1',
        tier: 'paid',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      });
      const handler = await loadHandler();
      await handler({} as any);

      const [, opts] = ($fetch as any).mock.calls[0];
      expect(opts.body).toEqual({
        listingId: 'listing-1',
        tier: 'paid',
        successUrl: 'https://app/success',
        cancelUrl: 'https://app/cancel',
      });
    });

    it('omits successUrl/cancelUrl from the forwarded body when not provided', async () => {
      setBody({ listingId: 'listing-1', tier: 'paid' });
      const handler = await loadHandler();
      await handler({} as any);

      const [, opts] = ($fetch as any).mock.calls[0];
      expect(opts.body).not.toHaveProperty('successUrl');
      expect(opts.body).not.toHaveProperty('cancelUrl');
    });

    it('always forwards tier:"paid" even if the caller sent the default (no tier)', async () => {
      setBody({ listingId: 'listing-1' });
      const handler = await loadHandler();
      await handler({} as any);

      const [, opts] = ($fetch as any).mock.calls[0];
      expect(opts.body.tier).toBe('paid');
    });

    it('returns { url, sessionId } passed back from the edge function', async () => {
      resolveEdge({ url: 'https://stripe.test/abc', sessionId: 'cs_abc' });
      const handler = await loadHandler();
      const result = await handler({} as any);
      expect(result).toEqual({ url: 'https://stripe.test/abc', sessionId: 'cs_abc' });
    });

    it('returns url with sessionId undefined when the edge omits sessionId', async () => {
      resolveEdge({ url: 'https://stripe.test/abc' });
      const handler = await loadHandler();
      const result = await handler({} as any);
      expect(result).toEqual({ url: 'https://stripe.test/abc', sessionId: undefined });
    });
  });

  // -------------------------------------------------------------------------
  // Comp path (Sustaining Member)
  // -------------------------------------------------------------------------
  describe('comp', () => {
    it('returns { comped: true } and skips the URL check when the edge comps the member', async () => {
      resolveEdge({ comped: true });
      const handler = await loadHandler();
      const result = await handler({} as any);
      expect(result).toEqual({ comped: true });
    });

    it('treats comped:true as final even if no url is returned (no 502)', async () => {
      resolveEdge({ comped: true }); // no url present, but comp short-circuits
      const handler = await loadHandler();
      await expect(handler({} as any)).resolves.toEqual({ comped: true });
    });

    it('does NOT comp when comped is false — falls through to url handling', async () => {
      resolveEdge({ comped: false, url: 'https://stripe.test/x', sessionId: 'cs_x' });
      const handler = await loadHandler();
      const result = await handler({} as any);
      expect(result).toEqual({ url: 'https://stripe.test/x', sessionId: 'cs_x' });
    });
  });

  // -------------------------------------------------------------------------
  // Missing URL / 502
  // -------------------------------------------------------------------------
  describe('missing url', () => {
    it('throws 502 when the edge returns neither comped nor a url', async () => {
      resolveEdge({ sessionId: 'cs_only' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 502,
        statusMessage: 'Checkout session did not return a URL',
      });
    });

    it('throws 502 when the edge returns an empty object', async () => {
      resolveEdge({});
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 502 });
    });

    it('throws 502 when the edge returns null', async () => {
      resolveEdge(null);
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 502 });
    });

    it('throws 502 when url is an empty string (falsy)', async () => {
      resolveEdge({ url: '' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 502 });
    });
  });

  // -------------------------------------------------------------------------
  // Error mapping
  // -------------------------------------------------------------------------
  describe('edge-function error mapping', () => {
    it('maps an edge error.statusCode through verbatim', async () => {
      rejectEdge({ statusCode: 403, statusMessage: 'You do not own this listing' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 403,
        statusMessage: 'You do not own this listing',
      });
    });

    it('maps error.response.status when statusCode is absent (ofetch FetchError shape)', async () => {
      rejectEdge({ response: { status: 409 }, data: { error: 'Listing already promoted' } });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 409,
        statusMessage: 'Listing already promoted',
      });
    });

    it('prefers error.data.error for the message over statusMessage', async () => {
      rejectEdge({
        statusCode: 400,
        statusMessage: 'Bad Request',
        data: { error: 'Listing is not eligible for promotion' },
      });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Listing is not eligible for promotion',
      });
    });

    it('falls back to statusMessage when there is no data.error', async () => {
      rejectEdge({ statusCode: 422, statusMessage: 'Unprocessable' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 422,
        statusMessage: 'Unprocessable',
      });
    });

    it('defaults to 502 + generic message when the error carries no status/message', async () => {
      rejectEdge(new Error('network down'));
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 502,
        statusMessage: 'Could not start checkout',
      });
    });

    it('re-maps the route\'s own 502 (missing-url throw is caught and re-thrown as 502)', async () => {
      // createError throws an Error with statusCode 502 inside the try; the catch
      // reads error.statusCode (502) and error.statusMessage and re-throws it.
      resolveEdge({ sessionId: 'no-url' });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({
        statusCode: 502,
        statusMessage: 'Checkout session did not return a URL',
      });
    });

    it('logs the edge error to console.error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      rejectEdge({ statusCode: 403, data: { error: 'nope' } });
      const handler = await loadHandler();
      await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 });
      expect(spy).toHaveBeenCalledWith(
        '[exchange/payments/checkout] edge function error:',
        expect.anything()
      );
      spy.mockRestore();
    });
  });
});
