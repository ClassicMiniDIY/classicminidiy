import specs from '../../data/commonClearances.json';
import { withUnits, CLEARANCE_UNITS } from '../../data/models/units';

export default defineEventHandler((event) => {
  try {
    // Set cache headers for better performance - cache for 1 day
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'CDN-Cache-Control': 'public, max-age=86400',
    });

    // `units` describes what each numeric column holds. Two of these columns
    // mislead when read by name — `lbin` is pound-INCHES, and clearance `thou`
    // holds inches — and weights state no unit at all, so a consumer holding
    // only the raw table has to guess. The native apps read these routes, and
    // they are the consumer this repo cannot check.
    return withUnits(specs, CLEARANCE_UNITS);
  } catch (error: any) {
    console.error('Error fetching clearance specs:', error);
    const statusCode = error?.statusCode || 500;
    const statusMessage = error?.message || 'Internal Server Error';
    throw createError({ statusCode, statusMessage });
  }
});
