/**
 * POST /api/exchange/camino/distance
 * Distance + drive time between buyer and listing locations, proxied through the
 * server to keep the Camino API key private. Converged from TheMiniExchange's
 * /api/camino/distance. Public + rate-limited; cached 24h.
 */
import { caminoFetch, type CaminoRelationshipResponse } from '../../../utils/exchange/camino';
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';

interface DistanceRequest {
  buyerLat: number;
  buyerLon: number;
  listingLat: number;
  listingLon: number;
}

export interface DistanceResponse {
  distance_km: number;
  distance_miles: number;
  driving_time: string;
  duration_seconds: number;
  direction: string;
  description: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DistanceRequest>(event);

  if (body.buyerLat == null || body.buyerLon == null || body.listingLat == null || body.listingLon == null) {
    throw createError({ statusCode: 400, message: 'Missing coordinates' });
  }

  if (
    Math.abs(body.buyerLat) > 90 ||
    Math.abs(body.listingLat) > 90 ||
    Math.abs(body.buyerLon) > 180 ||
    Math.abs(body.listingLon) > 180
  ) {
    throw createError({ statusCode: 400, message: 'Invalid coordinates' });
  }

  const rateLimitCheck = createRateLimitMiddleware({
    ...RateLimitPresets.lenient,
    keyPrefix: 'camino-distance',
  });
  await rateLimitCheck(event);

  const cacheKey = `camino:distance:${Math.round(body.buyerLat * 10)}:${Math.round(body.buyerLon * 10)}:${body.listingLat}:${body.listingLon}`;
  const cached = await useStorage('cache').getItem<DistanceResponse>(cacheKey);
  if (cached) return cached;

  try {
    const data = await caminoFetch<CaminoRelationshipResponse>('/relationship', {
      method: 'POST',
      body: {
        start: { lat: body.buyerLat, lon: body.buyerLon },
        end: { lat: body.listingLat, lon: body.listingLon },
        include: ['distance', 'direction', 'travel_time', 'description'],
      },
    });

    const distanceKm = data.actual_distance_km || 0;
    const result: DistanceResponse = {
      distance_km: distanceKm,
      distance_miles: Math.round(distanceKm * 0.621371 * 10) / 10,
      driving_time: data.driving_time || '',
      duration_seconds: data.duration_seconds || 0,
      direction: data.direction || '',
      description: data.description || '',
    };

    await useStorage('cache').setItem(cacheKey, result, { ttl: 86400 });
    return result;
  } catch (err: any) {
    console.error('Camino distance API error:', err?.message || err);
    throw createError({ statusCode: 502, message: 'Failed to calculate distance' });
  }
});
