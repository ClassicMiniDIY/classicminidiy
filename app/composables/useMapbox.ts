/**
 * Mapbox Geocoding Composable
 *
 * Provides location autocomplete and geocoding using the Mapbox API.
 * Shared pattern with TheMiniExchange for consistent location data.
 *
 * @see https://docs.mapbox.com/api/search/geocoding/
 */

export interface MapboxSuggestion {
  id: string;
  place_name: string;
  text: string;
  place_type: string[];
  center: [number, number]; // [longitude, latitude]
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
}

export interface GeocodedLocation {
  formatted_address: string;
  city: string;
  state_province: string;
  country: string;
  postal_code: string;
  latitude: number;
  longitude: number;
}

export const useMapbox = () => {
  const config = useRuntimeConfig();
  const accessToken = config.public.mapboxAccessToken;

  /**
   * Search for location suggestions (autocomplete)
   */
  const searchSuggestions = async (
    query: string,
    options: {
      types?: string[];
      countries?: string[];
      limit?: number;
    } = {}
  ): Promise<MapboxSuggestion[]> => {
    if (!accessToken) {
      throw new Error('Mapbox access token not configured');
    }

    if (!query || query.length < 2) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        access_token: accessToken,
        limit: String(options.limit || 5),
        autocomplete: 'true',
      });

      if (options.types?.length) {
        params.append('types', options.types.join(','));
      }

      if (options.countries?.length) {
        params.append('country', options.countries.join(','));
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error('Mapbox search error:', error);
      return [];
    }
  };

  /**
   * Extract structured location data from a Mapbox suggestion
   */
  const extractLocationData = (suggestion: MapboxSuggestion): GeocodedLocation => {
    const [longitude, latitude] = suggestion.center;

    let city = '';
    let stateProvince = '';
    let country = '';
    let postalCode = '';

    if (suggestion.place_type.includes('place') || suggestion.place_type.includes('locality')) {
      city = suggestion.text;
    }

    if (suggestion.place_type.includes('postcode')) {
      postalCode = suggestion.text;
    }

    if (suggestion.context) {
      for (const ctx of suggestion.context) {
        if (ctx.id.startsWith('place')) {
          if (!city) city = ctx.text;
        } else if (ctx.id.startsWith('region')) {
          stateProvince = ctx.short_code?.replace(/^[A-Z]+-/, '') || ctx.text;
        } else if (ctx.id.startsWith('country')) {
          country = ctx.text;
        } else if (ctx.id.startsWith('postcode')) {
          if (!postalCode) postalCode = ctx.text;
        }
      }
    }

    if (!city && suggestion.text) {
      city = suggestion.text;
    }

    return {
      formatted_address: suggestion.place_name,
      city,
      state_province: stateProvince,
      country,
      postal_code: postalCode,
      latitude,
      longitude,
    };
  };

  /**
   * Reverse geocode coordinates to address
   */
  const reverseGeocode = async (longitude: number, latitude: number): Promise<GeocodedLocation | null> => {
    if (!accessToken) {
      throw new Error('Mapbox access token not configured');
    }

    try {
      const params = new URLSearchParams({
        access_token: accessToken,
        types: 'place,locality,postcode',
      });

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return null;
      }

      return extractLocationData(data.features[0]);
    } catch (error) {
      console.error('Mapbox reverse geocode error:', error);
      return null;
    }
  };

  /**
   * Get user's current location using browser geolocation
   */
  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => resolve(null),
        { timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  return {
    searchSuggestions,
    extractLocationData,
    reverseGeocode,
    getCurrentLocation,
  };
};
