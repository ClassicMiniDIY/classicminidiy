import { chassisRanges, type ChassisRange } from '../../../data/models/decoders';

// Test data
// A-AB1-L/807922 - 1965 - Moke
// XAU1N-547206A - 1972 - pickup

interface ChassisDecoderRequest {
  yearRange: string;
  chassisNumber: string;
}

interface ChassisPosition {
  position: number;
  value: string;
  name: string;
  matched: boolean;
}

interface ChassisDecoderResponse {
  success: boolean;
  yearRange: string;
  chassisNumber: string;
  decodedPositions: ChassisPosition[];
  isValid: boolean;
  errors: string[];
  pattern: string;
  rangeData: ChassisRange | null;
}

const validateChassisNumber = (chassisNumber: string, range: ChassisRange): ChassisDecoderResponse => {
  const response: ChassisDecoderResponse = {
    success: true,
    yearRange: range.title,
    chassisNumber: chassisNumber.toUpperCase(),
    decodedPositions: [],
    isValid: true,
    errors: [],
    pattern: '',
    rangeData: range,
  };

  // Input validation
  if (!chassisNumber || typeof chassisNumber !== 'string') {
    response.errors.push('Chassis number is required and must be a string');
    response.isValid = false;
    response.success = false;
    return response;
  }

  // Clean the chassis number (remove spaces, convert to uppercase)
  const cleanChassisNumber = chassisNumber.replace(/\s+/g, '').toUpperCase();

  // Check for empty chassis number after cleaning
  if (!cleanChassisNumber) {
    response.errors.push('Chassis number cannot be empty');
    response.isValid = false;
    response.success = false;
    return response;
  }

  // Update the cleaned chassis number in response
  response.chassisNumber = cleanChassisNumber;

  // Build the expected pattern from the primary example with null safety
  const example = range.value.PrimaryExample;
  if (!example) {
    response.errors.push('Invalid range configuration: missing primary example');
    response.isValid = false;
    response.success = false;
    return response;
  }

  // Build pattern with null checks
  let pattern = '';
  for (let i = 1; i <= 11; i++) {
    const key = i.toString() as keyof typeof example;
    pattern += example[key] || '';
  }
  pattern += example.numbers || '';
  pattern += example.last || '';

  response.pattern = pattern;

  // Decode each position
  let currentIndex = 0;
  const is1959To1969 = range.title === '1959-1969';
  const is1969To1974 = range.title === '1969-1974';
  const canHaveMissingAssemblyPlant = [
    '1959-1969',
    '1969-1974',
    '1974-1980',
    '1980',
    '1980-1985',
    '1985-1990',
  ].includes(range.title);
  const isNonEnglishWhenMissing = ['1985-1990', '1990-on'].includes(range.title);

  for (let pos = 1; pos <= 11; pos++) {
    const posKey = pos.toString() as '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11';
    const expectedValue = example[posKey];
    const options = range.value.options[posKey];

    if (!expectedValue || expectedValue === '') continue;

    const position: ChassisPosition = {
      position: pos,
      value: '',
      name: 'Unknown',
      matched: false,
    };

    // Special handling for 1959-1969 position 5 (trim level)
    if (is1959To1969 && pos === 5) {
      // Check if we're at the numbers section (position 5 might be missing)
      const remainingChars = cleanChassisNumber.substring(currentIndex);

      // For 1959-1969, after position 4, we should either see:
      // 1. A trim code (D, L, S) followed by optional dash then numbers
      // 2. A dash followed by numbers (position 5 missing)
      // 3. Numbers directly (position 5 missing, no separating dash)

      if (/^-?\d/.test(remainingChars)) {
        // Position 5 is missing - either "-digits" or "digits"
        // Skip the optional dash if present
        if (remainingChars.startsWith('-')) {
          currentIndex++; // Skip the dash
        }

        const inferredPosition: ChassisPosition = {
          position: 5,
          value: '(missing)',
          name: 'Standard RHD (inferred from missing position)',
          matched: true,
        };
        response.decodedPositions.push(inferredPosition);
        continue; // Skip to numbers processing
      }
    }

    // Special handling for 1990-on position 11 (assembly plant)
    if (range.title === '1990-on' && pos === 11) {
      // Check if we're at the numbers section (position 11 might be missing)
      const remainingChars = cleanChassisNumber.substring(currentIndex);

      if (/^-?\d/.test(remainingChars)) {
        // Position 11 is missing - either "-digits" or "digits"
        // Skip the optional dash if present
        if (remainingChars.startsWith('-')) {
          currentIndex++; // Skip the dash
        }

        const inferredPosition: ChassisPosition = {
          position: 11,
          value: '(missing)',
          name: 'Non-English built car (inferred from missing position)',
          matched: true,
        };
        response.decodedPositions.push(inferredPosition);
        continue;
      }
    }

    if (currentIndex < cleanChassisNumber.length) {
      // Special handling for 1959-1969 positions 3 and 4 (body type and series)
      if (is1959To1969 && (pos === 3 || pos === 4) && options && options.length > 0) {
        // Try to match against available options, prioritizing longer matches first
        const sortedOptions = options.sort((a, b) => b.value.length - a.value.length);
        let matched = false;

        for (const option of sortedOptions) {
          const optionLength = option.value.length;
          if (currentIndex + optionLength <= cleanChassisNumber.length) {
            const candidateValue = cleanChassisNumber.substring(currentIndex, currentIndex + optionLength);
            if (candidateValue === option.value) {
              position.value = candidateValue;
              position.name = option.name;
              position.matched = true;
              currentIndex += optionLength;
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          // Fallback to expected length if no option matches
          const endIndex = currentIndex + expectedValue.length;
          if (endIndex > cleanChassisNumber.length) {
            response.errors.push(`Position ${pos}: Chassis number is too short for expected value "${expectedValue}"`);
            response.isValid = false;
            position.matched = false;
          } else {
            const extractedValue = cleanChassisNumber.substring(currentIndex, endIndex);
            position.value = extractedValue;
            position.matched = false;
            response.errors.push(`Position ${pos}: "${extractedValue}" is not a valid option for ${range.title}`);
            response.isValid = false;
            currentIndex = endIndex;
          }
        }

        // For 1959-1969, skip optional separator after positions 3 and 4
        if (currentIndex < cleanChassisNumber.length && cleanChassisNumber[currentIndex] === '-') {
          currentIndex++;
        }
      } else if (is1969To1974 && pos === 3 && options && options.length > 0) {
        // Special handling for 1969-1974 position 3 which has variable-length body types
        const sortedOptions = options.sort((a, b) => b.value.length - a.value.length);
        let matched = false;

        for (const option of sortedOptions) {
          const optionLength = option.value.length;
          if (currentIndex + optionLength <= cleanChassisNumber.length) {
            const candidateValue = cleanChassisNumber.substring(currentIndex, currentIndex + optionLength);
            if (candidateValue === option.value) {
              position.value = candidateValue;
              position.name = option.name;
              position.matched = true;
              currentIndex += optionLength;
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          // Fallback to expected length if no option matches
          const endIndex = currentIndex + expectedValue.length;
          if (endIndex > cleanChassisNumber.length) {
            response.errors.push(`Position ${pos}: Chassis number is too short for expected value "${expectedValue}"`);
            response.isValid = false;
            position.matched = false;
          } else {
            const extractedValue = cleanChassisNumber.substring(currentIndex, endIndex);
            position.value = extractedValue;
            position.matched = false;
            response.errors.push(`Position ${pos}: "${extractedValue}" is not a valid option for ${range.title}`);
            response.isValid = false;
            currentIndex = endIndex;
          }
        }
      } else if (is1969To1974 && pos === 4 && options && options.length > 0) {
        // Special handling for 1969-1974 position 4 which can be blank, "1", or "2"
        let matched = false;

        // First, try matching non-blank options ("1" and "2")
        for (const option of options) {
          if (option.value !== '') {
            if (currentIndex < cleanChassisNumber.length && cleanChassisNumber[currentIndex] === option.value) {
              position.value = option.value;
              position.name = option.name;
              position.matched = true;
              currentIndex++;
              matched = true;
              break;
            }
          }
        }

        // If no match and the next character is "N", then position 4 is blank (Mini 850)
        if (!matched && currentIndex < cleanChassisNumber.length && cleanChassisNumber[currentIndex] === 'N') {
          const blankOption = options.find((opt) => opt.value === '');
          if (blankOption) {
            position.value = '';
            position.name = blankOption.name;
            position.matched = true;
            matched = true;
            // Don't increment currentIndex as position 4 is blank
          }
        }

        if (!matched) {
          // Fallback to expected length if no option matches
          const endIndex = currentIndex + expectedValue.length;
          if (endIndex > cleanChassisNumber.length) {
            response.errors.push(`Position ${pos}: Chassis number is too short for expected value "${expectedValue}"`);
            response.isValid = false;
            position.matched = false;
          } else {
            const extractedValue = cleanChassisNumber.substring(currentIndex, endIndex);
            position.value = extractedValue;
            position.matched = false;
            response.errors.push(`Position ${pos}: "${extractedValue}" is not a valid option for ${range.title}`);
            response.isValid = false;
            currentIndex = endIndex;
          }
        }
      } else if (expectedValue.endsWith('-')) {
        // Fixed prefix - extract the exact length
        const prefixLength = expectedValue.length - 1;
        const endIndex = currentIndex + prefixLength;

        // Check bounds before extraction
        if (endIndex > cleanChassisNumber.length) {
          response.errors.push(`Position ${pos}: Chassis number is too short for expected prefix "${expectedValue}"`);
          response.isValid = false;
          position.matched = false;
          response.decodedPositions.push(position);
          continue;
        }

        const extractedValue = cleanChassisNumber.substring(currentIndex, endIndex);
        position.value = extractedValue;
        currentIndex = endIndex;

        // Skip the dash if present
        if (currentIndex < cleanChassisNumber.length && cleanChassisNumber[currentIndex] === '-') {
          currentIndex++;
        }
      } else {
        // Standard single character or specific pattern parsing
        const endIndex = currentIndex + expectedValue.length;

        // Check bounds before extraction
        if (endIndex > cleanChassisNumber.length) {
          response.errors.push(`Position ${pos}: Chassis number is too short for expected value "${expectedValue}"`);
          response.isValid = false;
          position.matched = false;
          response.decodedPositions.push(position);
          continue;
        }

        const extractedValue = cleanChassisNumber.substring(currentIndex, endIndex);
        position.value = extractedValue;
        currentIndex = endIndex;
      }

      // Find matching option (only for non-1959-1969 variable positions or when not already matched)
      if (!position.matched && options && options.length > 0) {
        const matchingOption = options.find((opt: { value: string; name: string }) => opt.value === position.value);
        if (matchingOption) {
          position.name = matchingOption.name;
          position.matched = true;
        } else {
          position.matched = false;
          response.errors.push(`Position ${pos}: "${position.value}" is not a valid option for ${range.title}`);
          response.isValid = false;
        }
      } else if (!position.matched && (!options || options.length === 0)) {
        // No options defined, just validate the format
        position.matched = position.value === expectedValue;
        if (!position.matched) {
          response.errors.push(`Position ${pos}: Expected "${expectedValue}" but found "${position.value}"`);
          response.isValid = false;
        }
      }
    } else {
      response.errors.push(`Position ${pos}: Chassis number is too short`);
      response.isValid = false;
    }

    response.decodedPositions.push(position);
  }

  // Handle numbers section
  if (range.value.number && range.value.number !== '') {
    if (currentIndex < cleanChassisNumber.length) {
      // Skip optional separators (dash or forward slash) before numbers
      if (currentIndex < cleanChassisNumber.length && /[\-\/]/.test(cleanChassisNumber[currentIndex] || '')) {
        currentIndex++;
      }

      // Extract all consecutive digits (variable length from 1 to 8 digits)
      let numbersSection = '';
      let tempIndex = currentIndex;

      // Extract consecutive digits
      while (tempIndex < cleanChassisNumber.length && /\d/.test(cleanChassisNumber[tempIndex] || '')) {
        numbersSection += cleanChassisNumber[tempIndex];
        tempIndex++;
      }

      currentIndex = tempIndex;

      // Skip dash after numbers if present
      if (cleanChassisNumber[currentIndex] === '-') {
        currentIndex++;
      }

      const numberPosition: ChassisPosition = {
        position: 12, // Special position for numbers
        value: numbersSection,
        name: 'Production sequence number',
        matched: false, // Will be set based on validation below
      };

      // Validate production sequence number
      if (!numbersSection || numbersSection.length === 0) {
        response.errors.push('Production sequence number is missing');
        response.isValid = false;
      } else if (!/^\d+$/.test(numbersSection)) {
        response.errors.push(`Production sequence number: "${numbersSection}" should contain only digits`);
        response.isValid = false;
      } else if (numbersSection.length < 1 || numbersSection.length > 8) {
        response.errors.push(
          `Production sequence number: "${numbersSection}" should be 1-8 digits long (found: ${numbersSection.length} digits)`
        );
        response.isValid = false;
      } else {
        const sequenceNumber = parseInt(numbersSection, 10);

        // Check for parsing errors (NaN) and safe integer range
        if (isNaN(sequenceNumber) || !Number.isSafeInteger(sequenceNumber)) {
          response.errors.push(`Production sequence number: "${numbersSection}" is not a valid number`);
          response.isValid = false;
        } else if (sequenceNumber >= 0 && sequenceNumber <= 99999999) {
          // Updated max for 8-digit support
          numberPosition.matched = true;
        } else {
          response.errors.push(
            `Production sequence number: "${numbersSection}" should be between 0 and 99999999 (found: ${sequenceNumber})`
          );
          response.isValid = false;
        }
      }

      response.decodedPositions.push(numberPosition);
    } else {
      response.errors.push('Chassis number is missing the production sequence numbers');
      response.isValid = false;
    }
  }

  // Handle last position (assembly plant)
  if (range.value.last && range.value.last.length > 0) {
    if (currentIndex < cleanChassisNumber.length) {
      const lastValue = cleanChassisNumber.substring(currentIndex);
      const matchingLast = range.value.last.find((opt) => opt.value === lastValue);

      const lastPosition: ChassisPosition = {
        position: 13, // Special position for last
        value: lastValue,
        name: matchingLast ? matchingLast.name : 'Unknown assembly plant',
        matched: !!matchingLast,
      };

      if (!lastPosition.matched) {
        response.errors.push(`Assembly plant: "${lastValue}" is not a valid assembly plant code`);
        response.isValid = false;
      }

      response.decodedPositions.push(lastPosition);
    } else if (canHaveMissingAssemblyPlant) {
      // Special handling for 1959-1969, 1969-1974, 1974-1980, and 1980: assembly plant might be missing
      // For 1985-1990 and 1990-on, if assembly plant is missing, it's likely a non-English built car
      const inferredLastPosition: ChassisPosition = {
        position: 13,
        value: '(missing)',
        name: isNonEnglishWhenMissing
          ? 'Non-English built car (inferred from missing position)'
          : 'Unknown assembly plant (inferred from missing position)',
        matched: true,
      };
      response.decodedPositions.push(inferredLastPosition);
    } else if (isNonEnglishWhenMissing) {
      // Special handling for ranges like 1990-on where missing assembly plant indicates non-English built
      const inferredLastPosition: ChassisPosition = {
        position: 13,
        value: '(missing)',
        name: 'Non-English built car (inferred from missing position)',
        matched: true,
      };
      response.decodedPositions.push(inferredLastPosition);
    }
  }

  return response;
};

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
