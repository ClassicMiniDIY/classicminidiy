import type { Needle, NeedleResponse } from '../../../data/models/needles';
import { getReferenceDataset, setReferenceCacheHeaders } from '../../utils/referenceData';

export default defineEventHandler(async (event): Promise<NeedleResponse> => {
  setReferenceCacheHeaders(event);

  try {
    const [all, initial] = await Promise.all([
      getReferenceDataset<Needle[]>('needles'),
      getReferenceDataset<Needle[]>('default_needles'),
    ]);
    return { all: all.value, initial: initial.value };
  } catch (error: any) {
    console.error('Error loading needles data:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load needles data: ${error.message || 'Unknown error'}`,
    });
  }
});
