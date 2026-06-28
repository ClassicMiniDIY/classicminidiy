/**
 * Meeting spot suggestion logic
 * Finds safe, public locations near the midpoint between buyer and seller
 */

import { caminoFetch } from './camino';
import type { CaminoQueryResult, CaminoRelationshipResponse } from './camino';
import { haversineDistance } from './geo';

const SAFE_PLACE_QUERIES = [
  'police station',
  'fire station',
  'shopping center parking lot',
  'bank with parking lot',
  'gas station well-lit',
];

const SAFETY_BOOST: Record<string, number> = {
  police: 50,
  fire_station: 40,
  fire: 40,
  shopping: 30,
  mall: 30,
  bank: 25,
  gas_station: 15,
  gas: 15,
  convenience: 10,
};

export interface MeetingSpot extends CaminoQueryResult {
  distanceFromMidpoint: number;
  score: number;
  buyerDriveTime?: string;
  buyerDriveMinutes?: number;
  sellerDriveTime?: string;
  sellerDriveMinutes?: number;
}

/**
 * Query Camino for safe public locations near a midpoint
 */
export async function findMeetingSpots(midLat: number, midLon: number): Promise<MeetingSpot[]> {
  const results = await Promise.allSettled(
    SAFE_PLACE_QUERIES.map((query) =>
      caminoFetch<any>('/query', {
        params: {
          query,
          lat: midLat,
          lon: midLon,
          radius: 8000,
          limit: 3,
          rank: true,
        },
      })
    )
  );

  const allSpots = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .flatMap((r) => {
      // Handle both array responses and { results: [] } responses
      if (Array.isArray(r.value)) return r.value;
      if (r.value?.results) return r.value.results;
      return [];
    });

  return deduplicateAndRank(allSpots, midLat, midLon);
}

/**
 * Deduplicate nearby results and rank by safety score
 */
function deduplicateAndRank(spots: any[], midLat: number, midLon: number): MeetingSpot[] {
  const unique: any[] = [];
  for (const spot of spots) {
    if (spot.lat == null || spot.lon == null) continue;
    const isDuplicate = unique.some((s) => haversineDistance(s.lat, s.lon, spot.lat, spot.lon) < 100);
    if (!isDuplicate) unique.push(spot);
  }

  return unique
    .map((spot) => {
      const distFromMid = haversineDistance(midLat, midLon, spot.lat, spot.lon);
      let safetyScore = 0;
      const nameLower = (
        (spot.name || '') +
        ' ' +
        (spot.tags?.join(' ') || '') +
        ' ' +
        (spot.type || '')
      ).toLowerCase();

      for (const [keyword, boost] of Object.entries(SAFETY_BOOST)) {
        if (nameLower.includes(keyword)) safetyScore += boost;
      }

      return {
        ...spot,
        distanceFromMidpoint: distFromMid,
        score: safetyScore - distFromMid / 100,
      } as MeetingSpot;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Enrich meeting spots with drive times from both parties
 */
export async function enrichWithDriveTimes(
  spots: MeetingSpot[],
  buyerLoc: { lat: number; lon: number },
  sellerLoc: { lat: number; lon: number }
): Promise<MeetingSpot[]> {
  const enriched = await Promise.all(
    spots.map(async (spot) => {
      try {
        const [buyerTrip, sellerTrip] = await Promise.all([
          caminoFetch<CaminoRelationshipResponse>('/relationship', {
            method: 'POST',
            body: {
              start: { lat: buyerLoc.lat, lon: buyerLoc.lon },
              end: { lat: spot.lat, lon: spot.lon },
              include: ['distance', 'travel_time'],
            },
          }),
          caminoFetch<CaminoRelationshipResponse>('/relationship', {
            method: 'POST',
            body: {
              start: { lat: sellerLoc.lat, lon: sellerLoc.lon },
              end: { lat: spot.lat, lon: spot.lon },
              include: ['distance', 'travel_time'],
            },
          }),
        ]);

        return {
          ...spot,
          buyerDriveTime: buyerTrip.driving_time,
          buyerDriveMinutes: buyerTrip.duration_seconds ? Math.round(buyerTrip.duration_seconds / 60) : undefined,
          sellerDriveTime: sellerTrip.driving_time,
          sellerDriveMinutes: sellerTrip.duration_seconds ? Math.round(sellerTrip.duration_seconds / 60) : undefined,
        };
      } catch {
        // If drive time enrichment fails for a spot, return it without times
        return spot;
      }
    })
  );

  // Sort by fairness: minimize the max drive for either party
  return enriched.sort((a, b) => {
    const aMax = Math.max(a.buyerDriveMinutes || Infinity, a.sellerDriveMinutes || Infinity);
    const bMax = Math.max(b.buyerDriveMinutes || Infinity, b.sellerDriveMinutes || Infinity);
    return aMax - bMax;
  });
}
