/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _resetRateLimitStore, RateLimitPresets } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports findMeetingSpots + enrichWithDriveTimes via the relative
// specifier '../../../utils/exchange/meetingSpots', which Vitest resolves to the
// same absolute module as the '~~/server/utils/exchange/meetingSpots' id below.
// Mocking it lets us drive the spot results (and exercise the empty-result and
// 502 graceful-failure paths) without a real CAMINO_API_KEY or network call.
//
// geo (fuzzCoordinates / calculateMidpoint) and rateLimit are intentionally
// REAL so coordinate fuzzing, midpoint math, and the per-IP moderate counter
// (10/min) are genuinely exercised end-to-end.
const mockFindMeetingSpots = vi.fn();
const mockEnrichWithDriveTimes = vi.fn();
vi.mock('~~/server/utils/exchange/meetingSpots', () => ({
  findMeetingSpots: (...args: any[]) => mockFindMeetingSpots(...args),
  enrichWithDriveTimes: (...args: any[]) => mockEnrichWithDriveTimes(...args),
}));

// The rate-limit middleware calls setResponseHeader, which is not part of the
// shared h3 global setup, so stub it.
vi.stubGlobal('setResponseHeader', vi.fn());

const handler = (await import('~~/server/api/exchange/camino/meeting-spots.post')).default;

// Real geo helpers, imported to compute the EXPECTED midpoint the route returns.
import { fuzzCoordinates, calculateMidpoint } from '~~/server/utils/exchange/geo';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const VALID_BODY = {
  buyerLat: 51.5074,
  buyerLon: -0.1278,
  sellerLat: 52.4862,
  sellerLon: -1.8904,
};

/** The midpoint the route returns: midpoint of the FUZZED buyer + seller coords. */
function expectedMidpoint(body = VALID_BODY) {
  const fb = fuzzCoordinates(body.buyerLat, body.buyerLon);
  const fs = fuzzCoordinates(body.sellerLat, body.sellerLon);
  return calculateMidpoint(fb.lat, fb.lon, fs.lat, fs.lon);
}

const RAW_SPOTS = [
  { id: 'a', name: 'Central Police Station', lat: 52.0, lon: -1.0, score: 50, distanceFromMidpoint: 120 },
  { id: 'b', name: 'Westfield Shopping Center', lat: 52.01, lon: -1.01, score: 30, distanceFromMidpoint: 800 },
];

const ENRICHED_SPOTS = RAW_SPOTS.map((s, i) => ({
  ...s,
  buyerDriveTime: `${10 + i} min`,
  buyerDriveMinutes: 10 + i,
  sellerDriveTime: `${12 + i} min`,
  sellerDriveMinutes: 12 + i,
}));

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
describe('server/api/exchange/camino/meeting-spots.post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitStore();

    // Defaults: valid body, fixed IP, no x-forwarded-for fallback, happy upstream.
    setBody({ ...VALID_BODY });
    setRealIp('9.9.9.9');
    (getRequestIP as any).mockReturnValue(undefined);
    mockFindMeetingSpots.mockResolvedValue(RAW_SPOTS.map((s) => ({ ...s })));
    mockEnrichWithDriveTimes.mockResolvedValue(ENRICHED_SPOTS.map((s) => ({ ...s })));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Validation: missing coordinates -> 400 (== null guard, 0 is valid)
  // -------------------------------------------------------------------------
  describe('coordinate presence validation (== null guard)', () => {
    it.each([['buyerLat'], ['buyerLon'], ['sellerLat'], ['sellerLon']])(
      'returns 400 when %s is undefined',
      async (field) => {
        const body: any = { ...VALID_BODY };
        delete body[field];
        setBody(body);

        await expect(handler(makeEvent())).rejects.toMatchObject({
          statusCode: 400,
          message: 'Missing coordinates for both parties',
        });
        expect(mockFindMeetingSpots).not.toHaveBeenCalled();
      }
    );

    it.each([['buyerLat'], ['buyerLon'], ['sellerLat'], ['sellerLon']])(
      'returns 400 when %s is null',
      async (field) => {
        const body: any = { ...VALID_BODY, [field]: null };
        setBody(body);

        await expect(handler(makeEvent())).rejects.toMatchObject({
          statusCode: 400,
          message: 'Missing coordinates for both parties',
        });
        expect(mockFindMeetingSpots).not.toHaveBeenCalled();
      }
    );

    it('returns 400 on an empty body (all coords missing)', async () => {
      setBody({});
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 });
      expect(mockFindMeetingSpots).not.toHaveBeenCalled();
    });

    // The `== null` guard (NOT `!coord`) is load-bearing: 0,0 (Gulf of Guinea,
    // a legitimate lat/lon) must NOT be rejected as "missing".
    it('accepts 0 coordinates (== null guard, not falsy guard)', async () => {
      setBody({ buyerLat: 0, buyerLon: 0, sellerLat: 0, sellerLon: 0 });

      const result = await handler(makeEvent());
      expect(result.midpoint).toEqual({ lat: 0, lon: 0 });
      expect(mockFindMeetingSpots).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Validation: out-of-range coordinates -> 400
  // -------------------------------------------------------------------------
  describe('coordinate range validation', () => {
    it.each([
      ['buyerLat too high', { buyerLat: 90.1 }],
      ['buyerLat too low', { buyerLat: -90.1 }],
      ['sellerLat too high', { sellerLat: 91 }],
      ['sellerLat too low', { sellerLat: -91 }],
      ['buyerLon too high', { buyerLon: 180.1 }],
      ['buyerLon too low', { buyerLon: -180.1 }],
      ['sellerLon too high', { sellerLon: 181 }],
      ['sellerLon too low', { sellerLon: -181 }],
    ])('returns 400 when %s', async (_label, override) => {
      setBody({ ...VALID_BODY, ...override });
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400, message: 'Invalid coordinates' });
      expect(mockFindMeetingSpots).not.toHaveBeenCalled();
    });

    it('accepts boundary lat 90 / lon 180 (inclusive bounds via Math.abs)', async () => {
      setBody({ buyerLat: 90, buyerLon: 180, sellerLat: -90, sellerLon: -180 });
      const result = await handler(makeEvent());
      expect(result.suggestions).toEqual(ENRICHED_SPOTS);
      expect(mockFindMeetingSpots).toHaveBeenCalledTimes(1);
    });

    it('runs presence validation before range validation', async () => {
      // missing buyerLat AND an out-of-range sellerLon -> presence wins.
      setBody({ buyerLon: 0, sellerLat: 0, sellerLon: 999 });
      await expect(handler(makeEvent())).rejects.toMatchObject({ message: 'Missing coordinates for both parties' });
      expect(mockFindMeetingSpots).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: fuzz -> midpoint -> findMeetingSpots -> enrich
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('computes the midpoint from FUZZED coordinates and queries findMeetingSpots there', async () => {
      const result = await handler(makeEvent());

      const mid = expectedMidpoint();
      expect(result.midpoint).toEqual(mid);
      expect(mockFindMeetingSpots).toHaveBeenCalledTimes(1);
      expect(mockFindMeetingSpots).toHaveBeenCalledWith(mid.lat, mid.lon);
    });

    it('fuzzes the coordinates (midpoint is NOT the raw-coordinate midpoint)', async () => {
      await handler(makeEvent());

      const rawMid = calculateMidpoint(
        VALID_BODY.buyerLat,
        VALID_BODY.buyerLon,
        VALID_BODY.sellerLat,
        VALID_BODY.sellerLon
      );
      const [lat, lon] = mockFindMeetingSpots.mock.calls[0];
      // Fuzzing rounds to 0.05deg, so the queried midpoint differs from the
      // exact raw midpoint — this is the privacy guarantee.
      expect(lat).not.toBe(rawMid.lat);
      expect(lon).not.toBe(rawMid.lon);
      expect(lat).toBe(expectedMidpoint().lat);
      expect(lon).toBe(expectedMidpoint().lon);
    });

    it('enriches with drive times using the RAW (un-fuzzed) buyer + seller coords', async () => {
      const result = await handler(makeEvent());

      expect(mockEnrichWithDriveTimes).toHaveBeenCalledTimes(1);
      expect(mockEnrichWithDriveTimes).toHaveBeenCalledWith(
        RAW_SPOTS, // the spots returned by findMeetingSpots
        { lat: VALID_BODY.buyerLat, lon: VALID_BODY.buyerLon },
        { lat: VALID_BODY.sellerLat, lon: VALID_BODY.sellerLon }
      );
      expect(result).toEqual({ midpoint: expectedMidpoint(), suggestions: ENRICHED_SPOTS });
    });

    it('returns the enriched suggestions verbatim', async () => {
      const result = await handler(makeEvent());
      expect(result.suggestions).toEqual(ENRICHED_SPOTS);
    });
  });

  // -------------------------------------------------------------------------
  // Empty-result short-circuit: no spots -> returns [] and skips enrichment
  // -------------------------------------------------------------------------
  describe('empty meeting-spot results', () => {
    it('returns midpoint + empty suggestions and skips enrichWithDriveTimes', async () => {
      mockFindMeetingSpots.mockResolvedValue([]);

      const result = await handler(makeEvent());

      expect(result).toEqual({ midpoint: expectedMidpoint(), suggestions: [] });
      expect(mockFindMeetingSpots).toHaveBeenCalledTimes(1);
      expect(mockEnrichWithDriveTimes).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error path: a thrown upstream error -> 502 (message not leaked)
  // -------------------------------------------------------------------------
  describe('graceful 502 on upstream failure', () => {
    it('returns 502 when findMeetingSpots throws (key unset / network)', async () => {
      mockFindMeetingSpots.mockRejectedValue(new Error('CAMINO_API_KEY is not configured'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(handler(makeEvent())).rejects.toMatchObject({
        statusCode: 502,
        message: 'Failed to find meeting spots',
      });
      expect(mockEnrichWithDriveTimes).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it('returns 502 when enrichWithDriveTimes throws', async () => {
      mockEnrichWithDriveTimes.mockRejectedValue(new Error('relationship endpoint down'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 502 });
      errSpy.mockRestore();
    });

    it('does not leak the upstream error message to the client (logs it server-side)', async () => {
      mockFindMeetingSpots.mockRejectedValue(new Error('secret upstream detail 12345'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const err = await handler(makeEvent()).catch((e) => e);
      expect(err.statusCode).toBe(502);
      expect(err.message).toBe('Failed to find meeting spots');
      expect(err.message).not.toContain('secret upstream detail');
      // The detail is logged server-side, not returned.
      expect(errSpy).toHaveBeenCalledWith('Meeting spot error:', 'secret upstream detail 12345');
      errSpy.mockRestore();
    });

    it('returns 502 when findMeetingSpots throws a non-Error value (err?.message || err)', async () => {
      mockFindMeetingSpots.mockRejectedValue('plain string failure');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 502 });
      expect(errSpy).toHaveBeenCalledWith('Meeting spot error:', 'plain string failure');
      errSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting (real moderate preset: 10 req / 60s per IP)
  // -------------------------------------------------------------------------
  describe('rate limiting', () => {
    it('enforces the moderate preset and throws 429 once exhausted', async () => {
      const limit = RateLimitPresets.moderate.maxRequests; // 10
      for (let i = 0; i < limit; i++) {
        await expect(handler(makeEvent())).resolves.toMatchObject({ suggestions: ENRICHED_SPOTS });
      }
      // The (limit+1)th request from the same IP is rejected.
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('keys the limit per-IP — a different x-real-ip is not throttled', async () => {
      const limit = RateLimitPresets.moderate.maxRequests;
      for (let i = 0; i < limit; i++) {
        await handler(makeEvent());
      }
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 }); // 9.9.9.9 exhausted

      // A fresh IP gets its own bucket.
      setRealIp('1.2.3.4');
      await expect(handler(makeEvent())).resolves.toMatchObject({ suggestions: ENRICHED_SPOTS });
    });

    it('prefers x-real-ip over the spoofable x-forwarded-for fallback for keying', async () => {
      // Exhaust the limit keyed on x-real-ip=9.9.9.9 while a (changing) forwarded
      // IP is also present. If the limiter keyed off getRequestIP it would never
      // throttle; it must key off x-real-ip.
      const limit = RateLimitPresets.moderate.maxRequests;
      let forwarded = 0;
      (getRequestIP as any).mockImplementation(() => `10.0.0.${forwarded++}`);
      for (let i = 0; i < limit; i++) {
        await handler(makeEvent());
      }
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('runs validation before rate limiting (a 400 does not consume the limit)', async () => {
      // Spend nothing on a bad request, then confirm the full quota is available.
      setBody({}); // missing coords -> 400 before rate limit runs
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 });

      setBody({ ...VALID_BODY });
      const limit = RateLimitPresets.moderate.maxRequests;
      for (let i = 0; i < limit; i++) {
        await expect(handler(makeEvent())).resolves.toBeTruthy();
      }
      // Limit reached only after `limit` valid calls -> the earlier 400 was free.
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('runs rate limiting before calling findMeetingSpots (429 skips upstream)', async () => {
      const limit = RateLimitPresets.moderate.maxRequests;
      for (let i = 0; i < limit; i++) {
        await handler(makeEvent());
      }
      expect(mockFindMeetingSpots).toHaveBeenCalledTimes(limit);

      // Over-limit request must NOT call upstream again.
      await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 429 });
      expect(mockFindMeetingSpots).toHaveBeenCalledTimes(limit);
    });
  });
});
