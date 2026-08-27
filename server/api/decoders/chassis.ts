import { chassisRanges } from '../../../data/models/decoders';
import { validateChassisNumber, type ChassisDecoderResponse } from '../../utils/chassisDecode';

interface ChassisDecoderRequest {
  yearRange: string;
  chassisNumber: string;
}

export default defineEventHandler(async (event): Promise<ChassisDecoderResponse> => {
  // Set cache headers - cache for 1 year since chassis decoder logic is very static
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000',
    'CDN-Cache-Control': 'public, max-age=31536000',
  });

  try {
    // Only allow PUT requests
    assertMethod(event, 'PUT');

    // Validate request body exists
    let body: Partial<ChassisDecoderRequest>;
    try {
      body = (await readBody(event)) as Partial<ChassisDecoderRequest>;
    } catch (error) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid JSON body in request',
      });
    }

    // Check if body is null or undefined
    if (!body || typeof body !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Request body is required and must be a JSON object',
      });
    }

    // Validate input parameters with type and length checks
    if (!body.yearRange || typeof body.yearRange !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing or invalid parameter: yearRange must be a string',
      });
    }

    if (!body.chassisNumber || typeof body.chassisNumber !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing or invalid parameter: chassisNumber must be a string',
      });
    }

    // Security: Limit input lengths to prevent abuse
    if (body.chassisNumber.length > 50) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Chassis number too long (maximum 50 characters)',
      });
    }

    if (body.yearRange.length > 30) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Year range too long (maximum 30 characters)',
      });
    }

    // Validate chassis number contains only allowed characters
    if (!/^[A-Za-z0-9\-\s\/]+$/.test(body.chassisNumber)) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Chassis number contains invalid characters. Only letters, numbers, hyphens, spaces, and forward slashes are allowed',
      });
    }

    // Find the matching chassis range
    const selectedRange = chassisRanges.find((range) => range.title === body.yearRange);

    if (!selectedRange) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid year range: ${body.yearRange}. Valid ranges are: ${chassisRanges.map((r) => r.title).join(', ')}`,
      });
    }

    // Validate and decode the chassis number
    const result = validateChassisNumber(body.chassisNumber, selectedRange);

    return result;
  } catch (error: any) {
    console.error('Error in chassis decoder:', error);

    // Handle different error types
    if (error.statusCode) {
      throw error; // Already a formatted error
    } else {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to decode chassis number: ${error.message || 'Unknown error'}`,
      });
    }
  }
});
