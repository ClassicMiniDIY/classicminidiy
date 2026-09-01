import type { TorqueSpecs } from '../../data/models/torque';
import specs from '../../data/torqueSpecs.json';
import { withUnits, TORQUE_UNITS } from '../../data/models/units';

export default defineEventHandler((event): TorqueSpecs => {
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
    return withUnits(specs, TORQUE_UNITS);
  } catch (error) {
    console.error('Error fetching torque specs:', error);
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' });
  }
});
