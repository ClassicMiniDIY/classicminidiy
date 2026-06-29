import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupGlobalMocks } from '../../../setup/testHelpers';

// useGeocoding has no Supabase/auth dependency — its only inputs are
// useRuntimeConfig().public.mapboxAccessToken and the global fetch. The shared
// vitest.setup already provides a global useRuntimeConfig, but WITHOUT a
// mapboxAccessToken, so we override it per-suite to supply a token and exercise
// the missing-token branches explicitly.

const TOKEN_CONFIG = { public: { mapboxAccessToken: 'test-token' } };

const mockOkResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const austinFeature = {
  features: [{ center: [-97.74, 30.27], place_name: 'Austin, Texas, United States' }],
};

const loadComposable = async () => {
  const { useGeocoding } = await import('~/app/composables/useGeocoding');
  return useGeocoding;
};

describe('useGeocoding', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('useRuntimeConfig', () => TOKEN_CONFIG);
    // Keep console.error quiet but assertable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupGlobalMocks();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // initial state / shape
  // ===========================================================================
  describe('initial state', () => {
    it('exposes isGeocoding as a false ref initially', async () => {
      const useGeocoding = await loadComposable();
      const { isGeocoding } = useGeocoding();
      expect(isGeocoding.value).toBe(false);
    });

    it('exposes geocodingError as a null ref initially', async () => {
      const useGeocoding = await loadComposable();
      const { geocodingError } = useGeocoding();
      expect(geocodingError.value).toBeNull();
    });

    it('returns the full public API (refs + methods)', async () => {
      const useGeocoding = await loadComposable();
      const api = useGeocoding();
      expect(api).toHaveProperty('isGeocoding');
      expect(api).toHaveProperty('geocodingError');
      expect(typeof api.geocodeLocation).toBe('function');
      expect(typeof api.calculateDistance).toBe('function');
      expect(typeof api.clearCache).toBe('function');
    });
  });

  // ===========================================================================
  // geocodeLocation()
  // ===========================================================================
  describe('geocodeLocation()', () => {
    it('returns null for an empty query without calling fetch', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      expect(await geocodeLocation('')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns null for a whitespace-only query without calling fetch', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      expect(await geocodeLocation('   ')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not flip isGeocoding for an empty query', async () => {
      const useGeocoding = await loadComposable();
      const { geocodeLocation, isGeocoding } = useGeocoding();
      await geocodeLocation('');
      expect(isGeocoding.value).toBe(false);
    });

    it('returns null and sets error when access token is an empty string', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapboxAccessToken: '' } }));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();
      const result = await geocodeLocation('Austin TX');
      expect(result).toBeNull();
      expect(geocodingError.value).toBe('Mapbox access token not configured');
    });

    it('returns null and sets error when access token is undefined', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapboxAccessToken: undefined } }));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();
      const result = await geocodeLocation('Austin TX');
      expect(result).toBeNull();
      expect(geocodingError.value).toBe('Mapbox access token not configured');
    });

    it('does not call fetch when the access token is missing', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({ public: { mapboxAccessToken: '' } }));
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      await geocodeLocation('Austin TX');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('maps a successful Mapbox response to { longitude, latitude, placeName }', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOkResponse(austinFeature)));
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      const result = await geocodeLocation('Austin TX');
      expect(result).toEqual({
        longitude: -97.74,
        latitude: 30.27,
        placeName: 'Austin, Texas, United States',
      });
    });

    it('builds the Mapbox URL with the token, encoded query, and country bias', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      await geocodeLocation('Austin TX');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.mapbox.com/geocoding/v5/mapbox.places/');
      expect(calledUrl).toContain('access_token=test-token');
      expect(calledUrl).toContain(encodeURIComponent('Austin TX'));
      expect(calledUrl).toContain('country=us,ca,gb,au');
      expect(calledUrl).toContain('limit=1');
      expect(calledUrl).toContain('types=place,postcode,locality,neighborhood');
    });

    it('sets isGeocoding true during the request and false after it resolves', async () => {
      let resolveJson: ((value: unknown) => void) | undefined;
      const jsonPromise = new Promise((resolve) => {
        resolveJson = resolve;
      });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => jsonPromise }));

      const useGeocoding = await loadComposable();
      const { geocodeLocation, isGeocoding } = useGeocoding();

      const promise = geocodeLocation('Austin TX');
      // Let fetch resolve while json() is still pending.
      await new Promise((r) => setTimeout(r, 0));
      expect(isGeocoding.value).toBe(true);

      resolveJson!(austinFeature);
      await promise;
      expect(isGeocoding.value).toBe(false);
    });

    it('clears a prior error before a subsequent successful request', async () => {
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      await geocodeLocation('Bad Query');
      expect(geocodingError.value).toBeTruthy();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOkResponse(austinFeature)));
      await geocodeLocation('Austin TX');
      expect(geocodingError.value).toBeNull();
    });

    it('returns null with "Location not found" when features is empty', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOkResponse({ features: [] })));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();
      const result = await geocodeLocation('Nowhere Place');
      expect(result).toBeNull();
      expect(geocodingError.value).toBe('Location not found');
    });

    it('returns null with "Location not found" when features is absent', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOkResponse({})));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();
      const result = await geocodeLocation('Nowhere Place');
      expect(result).toBeNull();
      expect(geocodingError.value).toBe('Location not found');
    });

    it('surfaces a non-ok HTTP status as a "Geocoding request failed" error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();
      const result = await geocodeLocation('Bad Query');
      expect(result).toBeNull();
      expect(geocodingError.value).toContain('Geocoding request failed');
      expect(geocodingError.value).toContain('500');
    });

    it('surfaces a thrown Error message (network failure)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();
      const result = await geocodeLocation('Austin TX');
      expect(result).toBeNull();
      expect(geocodingError.value).toBe('Network error');
    });

    it('falls back to a generic message for non-Error thrown values', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, geocodingError } = useGeocoding();
      const result = await geocodeLocation('Austin TX');
      expect(result).toBeNull();
      expect(geocodingError.value).toBe('Failed to geocode location');
    });

    it('resets isGeocoding to false after a thrown error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const useGeocoding = await loadComposable();
      const { geocodeLocation, isGeocoding } = useGeocoding();
      await geocodeLocation('Austin TX');
      expect(isGeocoding.value).toBe(false);
    });

    it('logs caught errors to console.error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API failure')));
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      await geocodeLocation('Austin TX');
      expect(console.error).toHaveBeenCalledWith('Geocoding error:', expect.any(Error));
    });
  });

  // ===========================================================================
  // caching behavior
  // ===========================================================================
  describe('caching', () => {
    it('caches a successful result and skips fetch on repeat queries', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      await geocodeLocation('Austin TX');
      await geocodeLocation('Austin TX');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('uses case-insensitive cache keys', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      await geocodeLocation('Austin TX');
      await geocodeLocation('austin tx');
      await geocodeLocation('AUSTIN TX');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('trims whitespace when building cache keys', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      await geocodeLocation('Austin TX');
      await geocodeLocation('  Austin TX  ');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the cached object on a cache hit', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      const first = await geocodeLocation('Austin TX');
      const second = await geocodeLocation('Austin TX');
      expect(second).toEqual(first);
      expect(second).toEqual({
        longitude: -97.74,
        latitude: 30.27,
        placeName: 'Austin, Texas, United States',
      });
    });

    it('does not cache failed (non-ok) lookups', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      await geocodeLocation('Austin TX');

      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const result = await geocodeLocation('Austin TX');
      expect(result).not.toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does not cache "not found" (empty features) lookups', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOkResponse({ features: [] })));
      const useGeocoding = await loadComposable();
      const { geocodeLocation } = useGeocoding();
      expect(await geocodeLocation('Austin TX')).toBeNull();

      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const result = await geocodeLocation('Austin TX');
      expect(result).not.toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // clearCache()
  // ===========================================================================
  describe('clearCache()', () => {
    it('forces a re-fetch for a previously cached query', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const { geocodeLocation, clearCache } = useGeocoding();

      await geocodeLocation('Austin TX');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      clearCache();
      await geocodeLocation('Austin TX');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // calculateDistance() — Haversine, miles
  // ===========================================================================
  describe('calculateDistance()', () => {
    it('returns 0 for identical points', async () => {
      const useGeocoding = await loadComposable();
      const { calculateDistance } = useGeocoding();
      expect(calculateDistance(30, -97, 30, -97)).toBe(0);
    });

    it('computes Austin TX -> Dallas TX (~195 miles)', async () => {
      const useGeocoding = await loadComposable();
      const { calculateDistance } = useGeocoding();
      const distance = calculateDistance(30.27, -97.74, 32.78, -96.8);
      expect(distance).toBeGreaterThan(180);
      expect(distance).toBeLessThan(210);
    });

    it('computes London -> New York (~3450 miles)', async () => {
      const useGeocoding = await loadComposable();
      const { calculateDistance } = useGeocoding();
      const distance = calculateDistance(51.5074, -0.1278, 40.7128, -74.006);
      expect(distance).toBeGreaterThan(3400);
      expect(distance).toBeLessThan(3500);
    });

    it('is symmetric (distance is direction-independent)', async () => {
      const useGeocoding = await loadComposable();
      const { calculateDistance } = useGeocoding();
      const d1 = calculateDistance(30.27, -97.74, 32.78, -96.8);
      const d2 = calculateDistance(32.78, -96.8, 30.27, -97.74);
      expect(d1).toBeCloseTo(d2, 10);
    });

    it('handles southern/eastern (negative) coordinates: Sydney -> Melbourne', async () => {
      const useGeocoding = await loadComposable();
      const { calculateDistance } = useGeocoding();
      const distance = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
      expect(distance).toBeGreaterThan(440);
      expect(distance).toBeLessThan(480);
    });

    it('returns the result in miles: LA -> SF (~347 miles)', async () => {
      const useGeocoding = await loadComposable();
      const { calculateDistance } = useGeocoding();
      const distance = calculateDistance(34.0522, -118.2437, 37.7749, -122.4194);
      expect(distance).toBeGreaterThan(340);
      expect(distance).toBeLessThan(360);
    });
  });

  // ===========================================================================
  // per-instance isolation — each useGeocoding() owns its own cache + state
  // ===========================================================================
  describe('per-instance isolation', () => {
    it('gives each instance its own cache (no cross-instance sharing)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const a = useGeocoding();
      const b = useGeocoding();

      await a.geocodeLocation('Austin TX');
      await b.geocodeLocation('Austin TX');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('clearCache on one instance does not affect another', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockOkResponse(austinFeature));
      vi.stubGlobal('fetch', fetchSpy);
      const useGeocoding = await loadComposable();
      const a = useGeocoding();
      const b = useGeocoding();

      await a.geocodeLocation('Austin TX');
      await b.geocodeLocation('Austin TX');
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      a.clearCache();
      await a.geocodeLocation('Austin TX'); // a re-fetches
      await b.geocodeLocation('Austin TX'); // b still cached
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('keeps isGeocoding state independent per instance', async () => {
      const useGeocoding = await loadComposable();
      const a = useGeocoding();
      const b = useGeocoding();
      expect(a.isGeocoding.value).toBe(false);
      expect(b.isGeocoding.value).toBe(false);
    });

    it('keeps geocodingError state independent per instance', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const useGeocoding = await loadComposable();
      const a = useGeocoding();
      const b = useGeocoding();

      await a.geocodeLocation('Bad Query');
      expect(a.geocodingError.value).toBeTruthy();
      expect(b.geocodingError.value).toBeNull();
    });
  });
});
