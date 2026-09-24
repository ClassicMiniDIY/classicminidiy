import { getReferenceDataset, setReferenceCacheHeaders } from '../../utils/referenceData';

export default defineEventHandler(async (event) => {
  setReferenceCacheHeaders(event);

  try {
    return (await getReferenceDataset('suggested_needles')).value;
  } catch (error: any) {
    console.error('Error loading suggested needles data:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load suggested needles data: ${error.message || 'Unknown error'}`,
    });
  }
});
