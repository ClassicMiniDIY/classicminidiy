/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _resetExchangeRateLimitStore, RateLimitPresets } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports caminoFetch via the relative specifier
// '../../../utils/exchange/camino', which Vitest resolves to the same absolute
// module as the '~~/server/utils/exchange/camino' id below. Mocking it lets us
// drive the proxied API response (and exercise the 502 graceful-failure path)
// without a real CAMINO_API_KEY or network call.
//
// rateLimit is intentionally REAL so the per-IP lenient counter (30/min) is
// genuinely exercised end-to-end via the shared in-memory store.
const mockCaminoFetch = vi.fn();
vi.mock('~~/server/utils/exchange/camino', () => ({
  caminoFetch: (...args: any[]) => mockCaminoFetch(...args),
}));

// The rate-limit middleware calls setResponseHeader; the route's caching layer
// calls useStorage('cache'). Neither is part of the shared h3 global setup, so
// stub them. useStorage returns a controllable in-memory cache so we can assert
// cache reads/writes and the cache-hit short-circuit.
const cacheStore = new Map<string, any>();
const mockGetItem = vi.fn(async (key: string) => (cacheStore.has(key) ? cacheStore.get(key) : null));
const mockSetItem = vi.fn(async (key: string, value: any, _opts?: any) => {
  cacheStore.set(key, value);
});
vi.stubGlobal('setResponseHeader', vi.fn());
vi.stubGlobal(
  'useStorage',
  vi.fn(() => ({ getItem: mockGetItem, setItem: mockSetItem }))
);

const handler = (await import('~~/server/api/exchange/camino/distance.post')).default;

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const VALID_BODY = {
  buyerLat: 51.5074,
  buyerLon: -0.1278,
  listingLat: 52.4862,
  listingLon: -1.8904,
};

const CAMINO_RESPONSE = {
  distance: '160 km',
  direction: 'north-west',
  walking_time: '32 hours',
  actual_distance_km: 161.3,
  duration_seconds: 7200,
  driving_time: '2 hours',
  description: 'A drive from London to Birmingham.',
};

/** Minimal h3 event. rateLimit reads event.context.user?.id, so context must exist. */
function makeEvent(): any {
  return { context: {} };
}

function setBody(body: any) {
  (readBody as any).mockResolvedValue(body);
}

/** x-real-ip is the canonical (un-spoofable on Vercel) client IP source. */
function setRealIp(ip: string | undefined) {
  (getHeader as any).mockImplementation((_e: any, name: string) => (name === 'x-real-ip' ? ip : undefined));
}

// ===========================================================================
//  TESTS
// ===========================================================================
describe('server/api/exchange/camino/distance.post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    _resetExchangeRateLimitStore();

    // Defaults: valid body, fixed IP, no x-forwarded-for fallback, happy Camino.
    setBody({ ...VALID_BODY });
    setRealIp('9.9.9.9');
    (getRequestIP as any).mockReturnValue(undefined);
    mockCaminoFetch.mockResolvedValue({ ...CAMINO_RESPONSE });
    // Cache reads/writes use the controllable in-memory store.
    mockGetItem.mockImplementation(async (key: string) => (cacheStore.has(key) ? cacheStore.get(key) : null));
    mockSetItem.mockImplementation(async (key: string, value: any) => {
      cacheStore.set(key, value);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Validation: missing coordinates -> 400 (== null guard, 0 is valid)
  // -------------------------------------------------------------------------
  describe('coordinate presence validation (== null guard)', () => {
    it.each([['buyerLat'], ['buyerLon'], ['listingLat'], ['listingLon']])(
      'returns 400 when %s is undefined',
      async (field) => {
        const body: any = { ...VALID_BODY };
        delete body[field];
        setBody(body);

        await expect(handler(makeEvent())).rejects.toMatchObject({
          statusCode: 400,
          message: 'Missing coordinates',
        });
        expect(mockCaminoFetch).not.toHaveBeenCalled();
      }
    );

    it.each([['buyerLat'], ['buyerLon'], ['listingLat'], ['listingLon']])(
      'returns 400 when %s is null',
      async (field) => {
        const body: any = { ...VALID_BODY, [field]: null };
        setBody(body);

        await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400, message: 'Missing coordinates' });
        expect(mockCaminoFetch).not.toHaveBeenCalled();
      }
    );

    it('returns 400 on an empty body (all coords missing)', async () => {
      setBody({});
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 });
    });

    // The `== null` guard (NOT `!coord`) is load-bearing: 0,0 (Gulf of Guinea,
    // a legitimate lat/lon) must NOT be rejected as "missing".
    it('accepts 0 coordinates (== null guard, not falsy guard)', async () => {
      setBody({ buyerLat: 0, buyerLon: 0, listingLat: 0, listingLon: 0 });

      const result = await handler(makeEvent());
      expect(result.distance_km).toBe(CAMINO_RESPONSE.actual_distance_km);
      expect(mockCaminoFetch).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Validation: out-of-range coordinates -> 400
  // -------------------------------------------------------------------------
  describe('coordinate range validation', () => {
    it.each([
      ['buyerLat too high', { buyerLat: 90.1 }],
      ['buyerLat too low', { buyerLat: -90.1 }],
      ['listingLat too high', { listingLat: 91 }],
      ['listingLat too low', { listingLat: -91 }],
      ['buyerLon too high', { buyerLon: 180.1 }],
      ['buyerLon too low', { buyerLon: -180.1 }],
      ['listingLon too high', { listingLon: 181 }],
      ['listingLon too low', { listingLon: -181 }],
    ])('returns 400 when %s', async (_label, override) => {
      setBody({ ...VALID_BODY, ...override });
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400, message: 'Invalid coordinates' });
      expect(mockCaminoFetch).not.toHaveBeenCalled();
    });

    it.each([
      ['boundary lat 90 / lon 180', { buyerLat: 90, buyerLon: 180, listingLat: -90, listingLon: -180 }],
    ])('accepts %s (inclusive bounds via Math.abs)', async (_label, override) => {
      setBody({ ...VALID_BODY, ...override });
      const result = await handler(makeEvent());
      expect(result).toMatchObject({ distance_km: CAMINO_RESPONSE.actual_distance_km });
      expect(mockCaminoFetch).toHaveBeenCalledTimes(1);
    });

    it('runs presence validation before range validation', async () => {
      // missing buyerLat AND an out-of-range listingLon -> presence wins.
      setBody({ buyerLon: 0, listingLat: 0, listingLon: 999 });
      await expect(handler(makeEvent())).rejects.toMatchObject({ message: 'Missing coordinates' });
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: correct proxy call shape + response mapping
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('proxies to caminoFetch /relationship with the correct request shape', async () => {
      await handler(makeEvent());

      expect(mockCaminoFetch).toHaveBeenCalledTimes(1);
      expect(mockCaminoFetch).toHaveBeenCalledWith('/relationship', {
        method: 'POST',
        body: {
          start: { lat: VALID_BODY.buyerLat, lon: VALID_BODY.buyerLon },
          end: { lat: VALID_BODY.listingLat, lon: VALID_BODY.listingLon },
          include: ['distance', 'direction', 'travel_time', 'description'],
        },
      });
    });

    it('maps the Camino response into the DistanceResponse shape', async () => {
      const result = await handler(makeEvent());

      expect(result).toEqual({
        distance_km: 161.3,
        // 161.3 * 0.621371 = 100.226... -> rounded to 1 decimal = 100.2
        distance_miles: Math.round(161.3 * 0.621371 * 10) / 10,
        driving_time: '2 hours',
        duration_seconds: 7200,
        direction: 'north-west',
        description: 'A drive from London to Birmingham.',
      });
      expect(result.distance_miles).toBe(100.2);
    });

    it('coerces missing/zero Camino fields to safe defaults', async () => {
      mockCaminoFetch.mockResolvedValue({}); // empty upstream payload

      const result = await handler(makeEvent());

      expect(result).toEqual({
        distance_km: 0,
        distance_miles: 0,
        driving_time: '',
        duration_seconds: 0,
        direction: '',
        description: '',
      });
    });

    it('handles a zero actual_distance_km (|| 0 fallback)', async () => {
      mockCaminoFetch.mockResolvedValue({ ...CAMINO_RESPONSE, actual_distance_km: 0 });
      const result = await handler(makeEvent());
      expect(result.distance_km).toBe(0);
      expect(result.distance_miles).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Caching behaviour
  // -------------------------------------------------------------------------
  describe('caching', () => {
    it('writes the result to cache with a 24h ttl and a privacy-rounded buyer key', async () => {
      await handler(makeEvent());

      // buyer coords are coarsened (Math.round(x*10)) to protect buyer privacy;
      // listing coords are stored exactly.
      const expectedKey = `camino:distance:${Math.round(VALID_BODY.buyerLat * 10)}:${Math.round(
        VALID_BODY.buyerLon * 10
      )}:${VALID_BODY.listingLat}:${VALID_BODY.listingLon}`;

      expect(mockSetItem).toHaveBeenCalledTimes(1);
      const [key, value, opts] = mockSetItem.mock.calls[0];
      expect(key).toBe(expectedKey);
      expect(opts).toEqual({ ttl: 86400 });
      expect(value).toMatchObject({ distance_km: 161.3 });
    });

    it('returns the cached value and skips caminoFetch on a cache hit', async () => {
      const cached = {
        distance_km: 42,
        distance_miles: 26.1,
        driving_time: 'cached',
        duration_seconds: 99,
        direction: 'east',
        description: 'from cache',
      };
      const key = `camino:distance:${Math.round(VALID_BODY.buyerLat * 10)}:${Math.round(
        VALID_BODY.buyerLon * 10
      )}:${VALID_BODY.listingLat}:${VALID_BODY.listingLon}`;
      cacheStore.set(key, cached);

      const result = await handler(makeEvent());

      expect(result).toEqual(cached);
      expect(mockCaminoFetch).not.toHaveBeenCalled();
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('coarsens nearby buyer coordinates into the same cache key', async () => {
      // First call populates cache.
      await handler(makeEvent());
      expect(mockCaminoFetch).toHaveBeenCalledTimes(1);

      // A buyer ~0.01deg away rounds to the same *10 bucket -> cache hit, no refetch.
      setBody({ ...VALID_BODY, buyerLat: VALID_BODY.buyerLat + 0.01, buyerLon: VALID_BODY.buyerLon + 0.01 });
      const result = await handler(makeEvent());

      expect(mockCaminoFetch).toHaveBeenCalledTimes(1); // still 1 — served from cache
      expect(result).toMatchObject({ distance_km: 161.3 });
    });
  });

  // -------------------------------------------------------------------------
  // Error path: caminoFetch throws (e.g. unset key / upstream failure) -> 502
  // -------------------------------------------------------------------------
  describe('graceful 502 on upstream failure', () => {
    it('returns 502 when caminoFetch throws (key unset / network)', async () => {
      mockCaminoFetch.mockRejectedValue(new Error('CAMINO_API_KEY is not configured'));

      await expect(handler(makeEvent())).rejects.toMatchObject({
        statusCode: 502,
        message: 'Failed to calculate distance',
      });
      // Failure must NOT be cached.
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('returns 502 and does not leak the upstream error message to the client', async () => {
      mockCaminoFetch.mockRejectedValue(new Error('secret upstream detail 12345'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const err = await handler(makeEvent()).catch((e) => e);
      expect(err.statusCode).toBe(502);
      expect(err.message).toBe('Failed to calculate distance');
      expect(err.message).not.toContain('secret upstream detail');
      // The detail is logged server-side, not returned.
      expect(errSpy).toHaveBeenCalledWith('Camino distance API error:', 'secret upstream detail 12345');
      errSpy.mockRestore();
    });

    it('returns 502 when caminoFetch throws a non-Error value', async () => {
      mockCaminoFetch.mockRejectedValue('plain string failure');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 502 });
      expect(errSpy).toHaveBeenCalledWith('Camino distance API error:', 'plain string failure');
      errSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting (real lenient preset: 30 req / 60s per IP)
  // -------------------------------------------------------------------------
  describe('rate limiting', () => {
    it('enforces the lenient preset and throws 429 once exhausted', async () => {
      const limit = RateLimitPresets.lenient.maxRequests; // 30
      // Each call uses a unique cache key (bump listingLon) so caminoFetch and
      // the rate-limit counter both increment every request.
      for (let i = 0; i < limit; i++) {
        setBody({ ...VALID_BODY, listingLon: -1 - i * 0.001 });
        await expect(handler(makeEvent())).resolves.toMatchObject({ distance_km: 161.3 });
      }

      // The (limit+1)th request from the same IP is rejected.
      setBody({ ...VALID_BODY, listingLon: -5 });
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('checks the cache only AFTER passing rate limiting', async () => {
      // Rate limiting must gate even cache hits: throwing 429 before reading cache.
      // Verify the order indirectly — exhaust the limit, then a cached-key request
      // still 429s rather than returning the cached value.
      const limit = RateLimitPresets.lenient.maxRequests;
      const key = `camino:distance:${Math.round(VALID_BODY.buyerLat * 10)}:${Math.round(
        VALID_BODY.buyerLon * 10
      )}:${VALID_BODY.listingLat}:${VALID_BODY.listingLon}`;
      cacheStore.set(key, { distance_km: 1, distance_miles: 1, driving_time: '', duration_seconds: 0, direction: '', description: '' });

      for (let i = 0; i < limit; i++) {
        setBody({ ...VALID_BODY, listingLon: -10 - i * 0.001 });
        await handler(makeEvent()).catch(() => {});
      }
      // Now request the cached key — over the limit, so 429 wins over cache.
      setBody({ ...VALID_BODY });
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('keys the limit per-IP — a different x-real-ip is not throttled', async () => {
      const limit = RateLimitPresets.lenient.maxRequests;
      for (let i = 0; i < limit; i++) {
        setBody({ ...VALID_BODY, listingLon: -1 - i * 0.001 });
        await handler(makeEvent());
      }
      setBody({ ...VALID_BODY, listingLon: -50 });
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 }); // 9.9.9.9 exhausted

      // A fresh IP gets its own bucket.
      setRealIp('1.2.3.4');
      setBody({ ...VALID_BODY, listingLon: -51 });
      await expect(handler(makeEvent())).resolves.toMatchObject({ distance_km: 161.3 });
    });

    it('runs validation before rate limiting (a 400 does not consume the limit)', async () => {
      // Spend nothing on a bad request, then confirm the full quota is available.
      setBody({}); // missing coords -> 400 before rate limit runs
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 });

      const limit = RateLimitPresets.lenient.maxRequests;
      for (let i = 0; i < limit; i++) {
        setBody({ ...VALID_BODY, listingLon: -1 - i * 0.001 });
        await expect(handler(makeEvent())).resolves.toBeTruthy();
      }
      // Limit reached only after `limit` valid calls -> the earlier 400 was free.
      setBody({ ...VALID_BODY, listingLon: -99 });
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 });
    });
  });
});
