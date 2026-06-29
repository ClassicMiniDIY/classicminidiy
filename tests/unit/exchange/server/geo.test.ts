/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { haversineDistance, metersToMiles, calculateMidpoint, fuzzCoordinates } from '~~/server/utils/exchange/geo';

// Reference coordinates (decimal degrees)
const LONDON = { lat: 51.5074, lon: -0.1278 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const NEW_YORK = { lat: 40.7128, lon: -74.006 };
const LOS_ANGELES = { lat: 34.0522, lon: -118.2437 };
const SYDNEY = { lat: -33.8688, lon: 151.2093 };

describe('haversineDistance', () => {
  it('returns 0 for identical points (same point)', () => {
    expect(haversineDistance(LONDON.lat, LONDON.lon, LONDON.lat, LONDON.lon)).toBe(0);
  });

  it('returns 0 for the equator origin to itself', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  // Known great-circle distances in meters (authoritative geodesic values
  // differ slightly because haversine assumes a spherical earth; tolerances
  // are chosen well within the spherical-model error band).
  it.each([
    // London <-> Paris ~ 343.5 km
    { name: 'London -> Paris', a: LONDON, b: PARIS, meters: 343_500, tol: 3_000 },
    // New York <-> Los Angeles ~ 3,936 km
    { name: 'New York -> Los Angeles', a: NEW_YORK, b: LOS_ANGELES, meters: 3_936_000, tol: 20_000 },
    // London <-> New York ~ 5,570 km
    { name: 'London -> New York', a: LONDON, b: NEW_YORK, meters: 5_570_000, tol: 30_000 },
    // Sydney <-> Los Angeles ~ 12,051 km
    { name: 'Sydney -> Los Angeles', a: SYDNEY, b: LOS_ANGELES, meters: 12_051_000, tol: 60_000 },
  ])('computes $name within tolerance', ({ a, b, meters, tol }) => {
    const d = haversineDistance(a.lat, a.lon, b.lat, b.lon);
    expect(Math.abs(d - meters)).toBeLessThanOrEqual(tol);
  });

  it('is symmetric: d(A,B) === d(B,A)', () => {
    const ab = haversineDistance(LONDON.lat, LONDON.lon, NEW_YORK.lat, NEW_YORK.lon);
    const ba = haversineDistance(NEW_YORK.lat, NEW_YORK.lon, LONDON.lat, LONDON.lon);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('is symmetric for an arbitrary southern-hemisphere pair', () => {
    const ab = haversineDistance(SYDNEY.lat, SYDNEY.lon, PARIS.lat, PARIS.lon);
    const ba = haversineDistance(PARIS.lat, PARIS.lon, SYDNEY.lat, SYDNEY.lon);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('computes the antipodal distance as ~half the earth circumference', () => {
    // North pole to south pole = pi * R = half meridian circumference.
    const halfCircumference = Math.PI * 6371e3; // ~20,015,086 m
    const d = haversineDistance(90, 0, -90, 0);
    expect(d).toBeCloseTo(halfCircumference, 0);
  });

  it('computes antipodal distance across the equator (0,0) -> (0,180)', () => {
    const halfCircumference = Math.PI * 6371e3;
    const d = haversineDistance(0, 0, 0, 180);
    expect(d).toBeCloseTo(halfCircumference, 0);
  });

  it('treats longitude wraparound consistently (lon 0 vs 360 equivalent)', () => {
    // A point at lon -0.1278 equals lon 359.8722 mathematically; haversine via
    // sin/cos of the delta should yield the same distance.
    const d1 = haversineDistance(LONDON.lat, LONDON.lon, PARIS.lat, PARIS.lon);
    const d2 = haversineDistance(LONDON.lat, LONDON.lon + 360, PARIS.lat, PARIS.lon);
    expect(d1).toBeCloseTo(d2, 3);
  });

  it('quarter-equator (0,0) -> (0,90) is ~ a quarter of the circumference', () => {
    const quarter = (Math.PI / 2) * 6371e3; // ~10,007,543 m
    const d = haversineDistance(0, 0, 0, 90);
    expect(d).toBeCloseTo(quarter, 0);
  });

  it('one degree of latitude at the meridian is ~111.2 km', () => {
    const d = haversineDistance(0, 0, 1, 0);
    // R * (pi/180)
    expect(d).toBeCloseTo((6371e3 * Math.PI) / 180, 3);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('returns a non-negative finite number for typical inputs', () => {
    const d = haversineDistance(NEW_YORK.lat, NEW_YORK.lon, SYDNEY.lat, SYDNEY.lon);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });
});

describe('metersToMiles', () => {
  it.each([
    { meters: 0, miles: 0 },
    { meters: 1609.344, miles: 1 },
    { meters: 1609344, miles: 1000 },
    { meters: 804.672, miles: 0.5 },
    { meters: 16093.44, miles: 10 },
  ])('converts $meters m -> $miles mi', ({ meters, miles }) => {
    expect(metersToMiles(meters)).toBeCloseTo(miles, 9);
  });

  it('is the inverse scaling of 1 mile = 1609.344 m exactly', () => {
    expect(metersToMiles(1609.344)).toBe(1);
  });

  it('handles negative meters (pure division, no clamping)', () => {
    expect(metersToMiles(-1609.344)).toBeCloseTo(-1, 9);
  });

  it('maps a haversine result to a sensible mileage (London->Paris ~213 mi)', () => {
    const meters = haversineDistance(LONDON.lat, LONDON.lon, PARIS.lat, PARIS.lon);
    const miles = metersToMiles(meters);
    expect(miles).toBeGreaterThan(208);
    expect(miles).toBeLessThan(218);
  });
});

describe('calculateMidpoint', () => {
  it('averages two points (simple positive quadrant)', () => {
    expect(calculateMidpoint(0, 0, 10, 20)).toEqual({ lat: 5, lon: 10 });
  });

  it('returns the same point when both inputs are identical', () => {
    expect(calculateMidpoint(LONDON.lat, LONDON.lon, LONDON.lat, LONDON.lon)).toEqual({
      lat: LONDON.lat,
      lon: LONDON.lon,
    });
  });

  it('handles mixed-sign coordinates straddling the prime meridian', () => {
    const mid = calculateMidpoint(51.5074, -0.1278, 48.8566, 2.3522);
    expect(mid.lat).toBeCloseTo(50.182, 3);
    expect(mid.lon).toBeCloseTo(1.1122, 4);
  });

  it('averages across the equator to 0', () => {
    expect(calculateMidpoint(10, 30, -10, -30)).toEqual({ lat: 0, lon: 0 });
  });

  // NOTE: this is a naive arithmetic mean, NOT a great-circle midpoint. It
  // does not handle the antimeridial wraparound — documenting that behavior.
  it('naively averages longitudes across the antimeridian (no wraparound handling)', () => {
    // 170 and -170 average to 0, not 180 (the true great-circle midpoint).
    expect(calculateMidpoint(0, 170, 0, -170)).toEqual({ lat: 0, lon: 0 });
  });
});

describe('fuzzCoordinates', () => {
  it('rounds to the nearest 0.05 by default', () => {
    // Float artifact: lon comes back as -0.15000000000000002, so compare numerically.
    const result = fuzzCoordinates(51.5074, -0.1278);
    expect(result.lat).toBeCloseTo(51.5, 10);
    expect(result.lon).toBeCloseTo(-0.15, 10);
  });

  it('rounds exact half-step boundaries upward (JS Math.round half-up)', () => {
    // 0.025 / 0.05 = 0.5 -> Math.round(0.5) = 1 -> 0.05
    expect(fuzzCoordinates(0.025, 0.025)).toEqual({ lat: 0.05, lon: 0.05 });
  });

  it('returns 0 for inputs that round to the origin bucket', () => {
    expect(fuzzCoordinates(0.01, -0.02)).toEqual({ lat: 0, lon: -0 });
  });

  it('handles exact multiples of the precision unchanged', () => {
    const result = fuzzCoordinates(0.1, -0.2);
    expect(result.lat).toBeCloseTo(0.1, 10);
    expect(result.lon).toBeCloseTo(-0.2, 10);
  });

  it('respects a custom precision value', () => {
    expect(fuzzCoordinates(51.5074, -0.1278, 1)).toEqual({ lat: 52, lon: -0 });
  });

  it('respects a coarse 0.1 precision', () => {
    const result = fuzzCoordinates(51.5674, -0.1678, 0.1);
    expect(result.lat).toBeCloseTo(51.6, 10);
    expect(result.lon).toBeCloseTo(-0.2, 10);
  });

  it('rounds negative coordinates toward the nearest bucket', () => {
    const result = fuzzCoordinates(-33.8688, 151.2093);
    expect(result.lat).toBeCloseTo(-33.85, 10);
    expect(result.lon).toBeCloseTo(151.2, 10);
  });

  it('preserves enough privacy: fuzzed point is within ~3.5 miles of the real one', () => {
    const real = { lat: 51.5074, lon: -0.1278 };
    const fuzzed = fuzzCoordinates(real.lat, real.lon);
    const meters = haversineDistance(real.lat, real.lon, fuzzed.lat, fuzzed.lon);
    expect(metersToMiles(meters)).toBeLessThan(3.6);
  });

  it('is idempotent: fuzzing an already-fuzzed point yields the same point', () => {
    const once = fuzzCoordinates(51.5074, -0.1278);
    const twice = fuzzCoordinates(once.lat, once.lon);
    expect(twice.lat).toBeCloseTo(once.lat, 10);
    expect(twice.lon).toBeCloseTo(once.lon, 10);
  });
});
