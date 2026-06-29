import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// navigator.geolocation.getCurrentPosition mock, re-created per test.
let mockGetCurrentPosition: ReturnType<typeof vi.fn>;

/**
 * Returns a fresh useBuyerLocation composable by resetting modules.
 * The location ref is backed by useState('buyerLocation'); the useState store
 * lives in tests/setup/vitest.setup.ts and persists across vi.resetModules(),
 * so beforeEach also clears it via __resetNuxtState() for true isolation.
 */
const getUseBuyerLocation = async () => {
  vi.resetModules();
  const module = await import('~/composables/useBuyerLocation');
  return module.useBuyerLocation;
};

describe('useBuyerLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the Nuxt useState store so each test starts with location = null.
    if ((global as any).__resetNuxtState) {
      (global as any).__resetNuxtState();
    }

    // Fresh navigator.geolocation mock per test.
    mockGetCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    if ((global as any).__resetNuxtState) {
      (global as any).__resetNuxtState();
    }
  });

  // ---------------------------------------------------------------------------
  // initial state
  // ---------------------------------------------------------------------------
  describe('initial state', () => {
    it('has location as null', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location } = useBuyerLocation();
      expect(location.value).toBeNull();
    });

    it('has loading as false', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { loading } = useBuyerLocation();
      expect(loading.value).toBe(false);
    });

    it('has error as null', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { error } = useBuyerLocation();
      expect(error.value).toBeNull();
    });

    it('shares location across calls via useState (same key)', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const first = useBuyerLocation();
      first.setLocation(30.27, -97.74, 'Austin, TX');

      // A second invocation reads the same useState-backed location.
      const second = useBuyerLocation();
      expect(second.location.value).toEqual({ lat: 30.27, lon: -97.74, city: 'Austin, TX' });
    });
  });

  // ---------------------------------------------------------------------------
  // exposed refs are readonly
  // ---------------------------------------------------------------------------
  describe('returned refs', () => {
    it('exposes location, loading, error as readonly refs', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, loading, error } = useBuyerLocation();

      // Mutating a readonly ref is a no-op (and warns) — value stays put.
      (location as any).value = { lat: 1, lon: 2 };
      (loading as any).value = true;
      (error as any).value = 'nope';

      expect(location.value).toBeNull();
      expect(loading.value).toBe(false);
      expect(error.value).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // setLocation()
  // ---------------------------------------------------------------------------
  describe('setLocation()', () => {
    it('sets coordinates and optional city', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, setLocation } = useBuyerLocation();

      setLocation(30.27, -97.74, 'Austin, TX');

      expect(location.value).toEqual({ lat: 30.27, lon: -97.74, city: 'Austin, TX' });
    });

    it('sets coordinates without city (city is undefined)', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, setLocation } = useBuyerLocation();

      setLocation(51.5074, -0.1278);

      expect(location.value).toEqual({ lat: 51.5074, lon: -0.1278, city: undefined });
    });

    it('handles zero coordinates (null island)', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, setLocation } = useBuyerLocation();

      setLocation(0, 0);

      expect(location.value).toEqual({ lat: 0, lon: 0, city: undefined });
    });

    it('handles negative coordinates', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, setLocation } = useBuyerLocation();

      setLocation(-33.8688, 151.2093, 'Sydney');

      expect(location.value).toEqual({ lat: -33.8688, lon: 151.2093, city: 'Sydney' });
    });

    it('overwrites a previously set location', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, setLocation } = useBuyerLocation();

      setLocation(30.27, -97.74, 'Austin, TX');
      setLocation(40.7128, -74.006, 'New York, NY');

      expect(location.value).toEqual({ lat: 40.7128, lon: -74.006, city: 'New York, NY' });
    });

    it('clears a previous error', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { error, setLocation, requestBrowserLocation } = useBuyerLocation();

      // Force an error first by removing geolocation support.
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      await requestBrowserLocation();
      expect(error.value).toBe('Geolocation not supported');

      setLocation(30.27, -97.74);
      expect(error.value).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // clearLocation()
  // ---------------------------------------------------------------------------
  describe('clearLocation()', () => {
    it('resets location to null', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, setLocation, clearLocation } = useBuyerLocation();

      setLocation(30.27, -97.74, 'Austin, TX');
      expect(location.value).not.toBeNull();

      clearLocation();
      expect(location.value).toBeNull();
    });

    it('resets error to null', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { error, requestBrowserLocation, clearLocation } = useBuyerLocation();

      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      await requestBrowserLocation();
      expect(error.value).toBe('Geolocation not supported');

      clearLocation();
      expect(error.value).toBeNull();
    });

    it('is idempotent when already cleared', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, error, clearLocation } = useBuyerLocation();

      clearLocation();
      clearLocation();

      expect(location.value).toBeNull();
      expect(error.value).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // requestBrowserLocation()
  // ---------------------------------------------------------------------------
  describe('requestBrowserLocation()', () => {
    it('sets location (lat/lon only, no city) from the geolocation API on success', async () => {
      mockGetCurrentPosition.mockImplementation((successCb: PositionCallback) => {
        successCb({
          coords: { latitude: 30.2672, longitude: -97.7431 },
        } as GeolocationPosition);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { location, loading, error, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(location.value).toEqual({ lat: 30.2672, lon: -97.7431 });
      expect(loading.value).toBe(false);
      expect(error.value).toBeNull();
    });

    it('passes enableHighAccuracy:false and timeout:10000 to getCurrentPosition', async () => {
      mockGetCurrentPosition.mockImplementation((successCb: PositionCallback) => {
        successCb({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
      const optsArg = mockGetCurrentPosition.mock.calls[0][2];
      expect(optsArg).toEqual({ enableHighAccuracy: false, timeout: 10000 });
    });

    it('sets "Location access denied" on error code 1', async () => {
      mockGetCurrentPosition.mockImplementation((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ code: 1, message: 'User denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { location, error, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(error.value).toBe('Location access denied');
      expect(location.value).toBeNull();
    });

    it('sets "Location unavailable" on error code 2', async () => {
      mockGetCurrentPosition.mockImplementation((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ code: 2, message: 'Position unavailable', POSITION_UNAVAILABLE: 2 } as GeolocationPositionError);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { error, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(error.value).toBe('Location unavailable');
    });

    it('sets "Location request timed out" on error code 3', async () => {
      mockGetCurrentPosition.mockImplementation((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ code: 3, message: 'Timeout', TIMEOUT: 3 } as GeolocationPositionError);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { error, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(error.value).toBe('Location request timed out');
    });

    it('sets generic "Could not get location" on an unknown error code', async () => {
      mockGetCurrentPosition.mockImplementation((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ code: 99, message: 'Unknown' } as any);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { error, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(error.value).toBe('Could not get location');
    });

    it('sets generic "Could not get location" when the error object has no code', async () => {
      mockGetCurrentPosition.mockImplementation((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ message: 'no code field' } as any);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { error, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(error.value).toBe('Could not get location');
    });

    it('sets "Geolocation not supported" and returns early when navigator.geolocation is absent', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { error, loading, location, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(error.value).toBe('Geolocation not supported');
      // Returns before the try block, so loading is never toggled.
      expect(loading.value).toBe(false);
      expect(location.value).toBeNull();
      // getCurrentPosition is never reachable here.
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    });

    it('leaves loading false after a successful geolocation', async () => {
      mockGetCurrentPosition.mockImplementation((successCb: PositionCallback) => {
        successCb({ coords: { latitude: 40.7128, longitude: -74.006 } } as GeolocationPosition);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { loading, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(loading.value).toBe(false);
    });

    it('leaves loading false after a geolocation error', async () => {
      mockGetCurrentPosition.mockImplementation((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ code: 1, message: 'Denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { loading, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();

      expect(loading.value).toBe(false);
    });

    it('clears a previous error before resolving successfully', async () => {
      // First attempt fails.
      mockGetCurrentPosition.mockImplementationOnce((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ code: 1, message: 'Denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
      });

      const useBuyerLocation = await getUseBuyerLocation();
      const { error, location, requestBrowserLocation } = useBuyerLocation();

      await requestBrowserLocation();
      expect(error.value).toBe('Location access denied');

      // Second attempt succeeds — error cleared, location set.
      mockGetCurrentPosition.mockImplementationOnce((successCb: PositionCallback) => {
        successCb({ coords: { latitude: 30.27, longitude: -97.74 } } as GeolocationPosition);
      });

      await requestBrowserLocation();
      expect(error.value).toBeNull();
      expect(location.value).toEqual({ lat: 30.27, lon: -97.74 });
    });

    it('does not overwrite an existing location when a later request errors', async () => {
      const useBuyerLocation = await getUseBuyerLocation();
      const { location, error, setLocation, requestBrowserLocation } = useBuyerLocation();

      // Seed a manual location (e.g. city fallback) with a city.
      setLocation(30.27, -97.74, 'Austin, TX');

      // A subsequent failed geolocation attempt only sets error, not location.
      mockGetCurrentPosition.mockImplementation((_s: PositionCallback, errorCb: PositionErrorCallback) => {
        errorCb({ code: 2, message: 'Position unavailable', POSITION_UNAVAILABLE: 2 } as GeolocationPositionError);
      });
      await requestBrowserLocation();

      expect(error.value).toBe('Location unavailable');
      expect(location.value).toEqual({ lat: 30.27, lon: -97.74, city: 'Austin, TX' });
    });
  });
});
