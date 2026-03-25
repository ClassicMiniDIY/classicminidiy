import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupGlobalMocks } from '../../setup/testHelpers';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { mapboxAccessToken: 'test-token' },
  }));
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useMapbox', () => {
  // ---------------------------------------------------------------------------
  // searchSuggestions()
  // ---------------------------------------------------------------------------
  describe('searchSuggestions()', () => {
    it('returns empty array when query is less than 2 characters', async () => {
      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { searchSuggestions } = useMapbox();

      expect(await searchSuggestions('')).toEqual([]);
      expect(await searchSuggestions('a')).toEqual([]);
    });

    it('throws when access token is not configured', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        public: { mapboxAccessToken: '' },
      }));

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { searchSuggestions } = useMapbox();

      await expect(searchSuggestions('London')).rejects.toThrow('Mapbox access token not configured');
    });

    it('calls Mapbox API with correct URL and parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ features: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { searchSuggestions } = useMapbox();
      await searchSuggestions('London', { types: ['place'], countries: ['gb'], limit: 3 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.mapbox.com/geocoding/v5/mapbox.places/London.json');
      expect(calledUrl).toContain('access_token=test-token');
      expect(calledUrl).toContain('limit=3');
      expect(calledUrl).toContain('autocomplete=true');
      expect(calledUrl).toContain('types=place');
      expect(calledUrl).toContain('country=gb');
    });

    it('returns features from API response', async () => {
      const features = [
        { id: '1', place_name: 'London, UK', text: 'London', place_type: ['place'], center: [-0.1, 51.5] },
      ];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ features }),
        })
      );

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { searchSuggestions } = useMapbox();
      const result = await searchSuggestions('London');

      expect(result).toEqual(features);
    });

    it('returns empty array on API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          statusText: 'Unauthorized',
        })
      );

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { searchSuggestions } = useMapbox();
      const result = await searchSuggestions('London');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // extractLocationData()
  // ---------------------------------------------------------------------------
  describe('extractLocationData()', () => {
    it('extracts city from place_type "place"', async () => {
      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { extractLocationData } = useMapbox();

      const suggestion = {
        id: '1',
        place_name: 'London, England, United Kingdom',
        text: 'London',
        place_type: ['place'],
        center: [-0.1278, 51.5074] as [number, number],
        context: [
          { id: 'region.123', text: 'England', short_code: 'GB-ENG' },
          { id: 'country.456', text: 'United Kingdom' },
        ],
      };

      const result = extractLocationData(suggestion);
      expect(result.city).toBe('London');
    });

    it('extracts state from region context with short_code', async () => {
      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { extractLocationData } = useMapbox();

      const suggestion = {
        id: '1',
        place_name: 'Austin, Texas, United States',
        text: 'Austin',
        place_type: ['place'],
        center: [-97.74, 30.27] as [number, number],
        context: [
          { id: 'region.789', text: 'Texas', short_code: 'US-TX' },
          { id: 'country.012', text: 'United States' },
        ],
      };

      const result = extractLocationData(suggestion);
      expect(result.state_province).toBe('TX');
    });

    it('extracts country from country context', async () => {
      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { extractLocationData } = useMapbox();

      const suggestion = {
        id: '1',
        place_name: 'Paris, France',
        text: 'Paris',
        place_type: ['place'],
        center: [2.35, 48.86] as [number, number],
        context: [{ id: 'country.456', text: 'France' }],
      };

      const result = extractLocationData(suggestion);
      expect(result.country).toBe('France');
    });

    it('extracts postal code from postcode place_type', async () => {
      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { extractLocationData } = useMapbox();

      const suggestion = {
        id: '1',
        place_name: '90210, Beverly Hills, California, United States',
        text: '90210',
        place_type: ['postcode'],
        center: [-118.41, 34.09] as [number, number],
        context: [
          { id: 'place.123', text: 'Beverly Hills' },
          { id: 'region.456', text: 'California', short_code: 'US-CA' },
          { id: 'country.789', text: 'United States' },
        ],
      };

      const result = extractLocationData(suggestion);
      expect(result.postal_code).toBe('90210');
    });

    it('falls back to suggestion.text for city when no other source', async () => {
      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { extractLocationData } = useMapbox();

      const suggestion = {
        id: '1',
        place_name: 'Some Place',
        text: 'FallbackCity',
        place_type: ['neighborhood'],
        center: [0, 0] as [number, number],
      };

      const result = extractLocationData(suggestion);
      expect(result.city).toBe('FallbackCity');
    });

    it('builds formatted_address from place_name', async () => {
      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { extractLocationData } = useMapbox();

      const suggestion = {
        id: '1',
        place_name: 'London, England, United Kingdom',
        text: 'London',
        place_type: ['place'],
        center: [-0.1278, 51.5074] as [number, number],
      };

      const result = extractLocationData(suggestion);
      expect(result.formatted_address).toBe('London, England, United Kingdom');
    });
  });

  // ---------------------------------------------------------------------------
  // reverseGeocode()
  // ---------------------------------------------------------------------------
  describe('reverseGeocode()', () => {
    it('throws when access token is not configured', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        public: { mapboxAccessToken: '' },
      }));

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { reverseGeocode } = useMapbox();

      await expect(reverseGeocode(-0.1278, 51.5074)).rejects.toThrow('Mapbox access token not configured');
    });

    it('calls Mapbox reverse geocoding API with coordinates', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            features: [
              {
                id: '1',
                place_name: 'London, England, United Kingdom',
                text: 'London',
                place_type: ['place'],
                center: [-0.1278, 51.5074],
              },
            ],
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { reverseGeocode } = useMapbox();
      await reverseGeocode(-0.1278, 51.5074);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.mapbox.com/geocoding/v5/mapbox.places/-0.1278,51.5074.json');
      expect(calledUrl).toContain('access_token=test-token');
      expect(calledUrl).toContain('types=place%2Clocality%2Cpostcode');
    });

    it('returns null when no features found', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ features: [] }),
        })
      );

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { reverseGeocode } = useMapbox();
      const result = await reverseGeocode(-0.1278, 51.5074);

      expect(result).toBeNull();
    });

    it('returns extracted location data on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              features: [
                {
                  id: '1',
                  place_name: 'London, England, United Kingdom',
                  text: 'London',
                  place_type: ['place'],
                  center: [-0.1278, 51.5074],
                  context: [
                    { id: 'region.123', text: 'England', short_code: 'GB-ENG' },
                    { id: 'country.456', text: 'United Kingdom' },
                  ],
                },
              ],
            }),
        })
      );

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { reverseGeocode } = useMapbox();
      const result = await reverseGeocode(-0.1278, 51.5074);

      expect(result).not.toBeNull();
      expect(result!.city).toBe('London');
      expect(result!.country).toBe('United Kingdom');
      expect(result!.formatted_address).toBe('London, England, United Kingdom');
    });

    it('returns null on API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          statusText: 'Server Error',
        })
      );

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { reverseGeocode } = useMapbox();
      const result = await reverseGeocode(-0.1278, 51.5074);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getCurrentLocation()
  // ---------------------------------------------------------------------------
  describe('getCurrentLocation()', () => {
    it('returns null when geolocation is not available', async () => {
      vi.stubGlobal('navigator', { geolocation: undefined });

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { getCurrentLocation } = useMapbox();
      const result = await getCurrentLocation();

      expect(result).toBeNull();
    });

    it('returns coordinates on success', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: vi.fn((success: PositionCallback) => {
            success({
              coords: { latitude: 51.5074, longitude: -0.1278 },
              timestamp: Date.now(),
            } as GeolocationPosition);
          }),
        },
      });

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { getCurrentLocation } = useMapbox();
      const result = await getCurrentLocation();

      expect(result).toEqual({ latitude: 51.5074, longitude: -0.1278 });
    });

    it('returns null when user denies permission', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
            error({
              code: 1,
              message: 'User denied Geolocation',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          }),
        },
      });

      const { useMapbox } = await import('~/app/composables/useMapbox');
      const { getCurrentLocation } = useMapbox();
      const result = await getCurrentLocation();

      expect(result).toBeNull();
    });
  });
});
