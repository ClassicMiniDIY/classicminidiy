import { ref } from 'vue';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  placeName: string;
}

/**
 * Composable for geocoding location strings to coordinates using Mapbox Geocoding API
 */
export const useGeocoding = () => {
  const config = useRuntimeConfig();
  const isGeocoding = ref(false);
  const geocodingError = ref<string | null>(null);

  // Cache geocoded results to avoid repeated API calls
  const geocodeCache = new Map<string, GeocodingResult>();

  /**
   * Convert a location string (city, state, zip, etc.) to coordinates
   */
  const geocodeLocation = async (locationQuery: string): Promise<GeocodingResult | null> => {
    if (!locationQuery.trim()) {
      return null;
    }

    // Check cache first
    const cacheKey = locationQuery.toLowerCase().trim();
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }

    const accessToken = config.public.mapboxAccessToken;
    if (!accessToken) {
      geocodingError.value = 'Mapbox access token not configured';
      return null;
    }

    isGeocoding.value = true;
    geocodingError.value = null;

    try {
      // Use Mapbox Geocoding API
      // Bias results towards USA since this is a Classic Mini marketplace
      const encodedQuery = encodeURIComponent(locationQuery);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${accessToken}&country=us,ca,gb,au&limit=1&types=place,postcode,locality,neighborhood`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        geocodingError.value = 'Location not found';
        return null;
      }

      const feature = data.features[0];
      const result: GeocodingResult = {
        longitude: feature.center[0],
        latitude: feature.center[1],
        placeName: feature.place_name,
      };

      // Cache the result
      geocodeCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Geocoding error:', error);
      geocodingError.value = error instanceof Error ? error.message : 'Failed to geocode location';
      return null;
    } finally {
      isGeocoding.value = false;
    }
  };

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in miles
   */
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  /**
   * Clear the geocoding cache
   */
  const clearCache = () => {
    geocodeCache.clear();
  };

  return {
    isGeocoding,
    geocodingError,
    geocodeLocation,
    calculateDistance,
    clearCache,
  };
};
