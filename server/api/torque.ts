import type { TorqueSpecs } from '../../data/models/torque';
import { withUnits, TORQUE_UNITS } from '../../data/models/units';
import { getReferenceDataset, setReferenceCacheHeaders } from '../utils/referenceData';

export default defineEventHandler(async (event): Promise<TorqueSpecs> => {
  try {
    setReferenceCacheHeaders(event);
    // The intersection lets withUnits (which walks any record of tables) type-check.
    const specs = (
      await getReferenceDataset<TorqueSpecs & Record<string, { items?: readonly unknown[] }>>('torque_specs')
    ).value;

    // `units` describes what each numeric column holds. Two of these columns
    // mislead when read by name — `lbin` is pound-INCHES, and clearance `thou`
    // holds inches — and weights state no unit at all, so a consumer holding
    // only the raw table has to guess. withUnits returns a new object; the
    // loader's shared value is never mutated.
    return withUnits(specs, TORQUE_UNITS);
  } catch (error) {
    console.error('Error fetching torque specs:', error);
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' });
  }
});
