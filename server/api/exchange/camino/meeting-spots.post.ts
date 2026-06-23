/**
 * POST /api/exchange/camino/meeting-spots
 * Suggests safe, public meeting locations roughly halfway between buyer and
 * seller. Coordinates are fuzzed for privacy before computing the midpoint.
 * Converged from TheMiniExchange's /api/camino/meeting-spots.
 */
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';
import { fuzzCoordinates, calculateMidpoint } from '../../../utils/exchange/geo';
import { findMeetingSpots, enrichWithDriveTimes } from '../../../utils/exchange/meetingSpots';

interface MeetingSpotsRequest {
  buyerLat: number;
  buyerLon: number;
  sellerLat: number;
  sellerLon: number;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<MeetingSpotsRequest>(event);

  if (!body.buyerLat || !body.buyerLon || !body.sellerLat || !body.sellerLon) {
    throw createError({ statusCode: 400, message: 'Missing coordinates for both parties' });
  }

  if (
    Math.abs(body.buyerLat) > 90 ||
    Math.abs(body.sellerLat) > 90 ||
    Math.abs(body.buyerLon) > 180 ||
    Math.abs(body.sellerLon) > 180
  ) {
    throw createError({ statusCode: 400, message: 'Invalid coordinates' });
  }

  const rateLimitCheck = createRateLimitMiddleware({
    ...RateLimitPresets.moderate,
    keyPrefix: 'camino-meeting',
  });
  await rateLimitCheck(event);

  try {
    const fuzzedBuyer = fuzzCoordinates(body.buyerLat, body.buyerLon);
    const fuzzedSeller = fuzzCoordinates(body.sellerLat, body.sellerLon);
    const midpoint = calculateMidpoint(fuzzedBuyer.lat, fuzzedBuyer.lon, fuzzedSeller.lat, fuzzedSeller.lon);

    const spots = await findMeetingSpots(midpoint.lat, midpoint.lon);
    if (spots.length === 0) {
      return { midpoint, suggestions: [] };
    }

    const enriched = await enrichWithDriveTimes(
      spots,
      { lat: body.buyerLat, lon: body.buyerLon },
      { lat: body.sellerLat, lon: body.sellerLon }
    );

    return { midpoint, suggestions: enriched };
  } catch (err: any) {
    console.error('Meeting spot error:', err?.message || err);
    throw createError({ statusCode: 502, message: 'Failed to find meeting spots' });
  }
});
