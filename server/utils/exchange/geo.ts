/**
 * Geographic utility functions for distance calculations,
 * coordinate fuzzing, and midpoint computation
 */

/**
 * Calculate the haversine distance between two points in meters
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

/**
 * Calculate the geographic midpoint between two coordinates
 */
export function calculateMidpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { lat: number; lon: number } {
  return {
    lat: (lat1 + lat2) / 2,
    lon: (lon1 + lon2) / 2,
  };
}

/**
 * Fuzz coordinates to a ~3 mile radius for privacy
 * Rounds to nearest 0.05 degrees (~3.5 miles)
 */
export function fuzzCoordinates(lat: number, lon: number, precision = 0.05): { lat: number; lon: number } {
  return {
    lat: Math.round(lat / precision) * precision,
    lon: Math.round(lon / precision) * precision,
  };
}
