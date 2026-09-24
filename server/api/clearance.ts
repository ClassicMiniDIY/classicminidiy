import { withUnits, CLEARANCE_UNITS } from '../../data/models/units';
import { getReferenceDataset, setReferenceCacheHeaders } from '../utils/referenceData';

type ClearanceTables = Record<string, { items?: readonly unknown[] }>;

export default defineEventHandler(async (event) => {
  try {
    setReferenceCacheHeaders(event);
    const specs = (await getReferenceDataset<ClearanceTables>('common_clearances')).value;

    // `units` describes what each numeric column holds. Two of these columns
    // mislead when read by name — `lbin` is pound-INCHES, and clearance `thou`
    // holds inches — and weights state no unit at all, so a consumer holding
    // only the raw table has to guess. withUnits returns a new object; the
    // loader's shared value is never mutated.
    return withUnits(specs, CLEARANCE_UNITS);
  } catch (error: any) {
    console.error('Error fetching clearance specs:', error);
    const statusCode = error?.statusCode || 500;
    const statusMessage = error?.message || 'Internal Server Error';
    throw createError({ statusCode, statusMessage });
  }
});
