/**
 * Buyer Location Composable
 * Manages the buyer's location for distance calculations and meeting spot suggestions.
 * Attempts browser geolocation, with manual city entry as fallback.
 */

export interface BuyerLocation {
  lat: number;
  lon: number;
  city?: string;
}

export const useBuyerLocation = () => {
  const location = useState<BuyerLocation | null>('buyerLocation', () => null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Request the browser's geolocation API
   */
  async function requestBrowserLocation() {
    if (!import.meta.client || !navigator.geolocation) {
      error.value = 'Geolocation not supported';
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
        });
      });

      location.value = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
    } catch (err: any) {
      if (err?.code === 1) {
        error.value = 'Location access denied';
      } else if (err?.code === 2) {
        error.value = 'Location unavailable';
      } else if (err?.code === 3) {
        error.value = 'Location request timed out';
      } else {
        error.value = 'Could not get location';
      }
    } finally {
      loading.value = false;
    }
  }

  /**
   * Set location manually from coordinates
   */
  function setLocation(lat: number, lon: number, city?: string) {
    location.value = { lat, lon, city };
    error.value = null;
  }

  /**
   * Clear the stored location
   */
  function clearLocation() {
    location.value = null;
    error.value = null;
  }

  return {
    location: readonly(location),
    loading: readonly(loading),
    error: readonly(error),
    requestBrowserLocation,
    setLocation,
    clearLocation,
  };
};
