import { z } from 'zod';
import { chassisRanges } from '../../../data/models/decoders';

/**
 * Chassis Decoder MCP Tool
 * Decode and validate Classic Mini chassis numbers based on year range
 */
export default defineMcpTool({
  description:
    'Decode and validate Classic Mini chassis numbers based on year range. Supports UK chassis formats from 1959-1969, 1969-1974, 1974-1980, 1980, 1980-1985, 1985-1990, and 1990-on, plus Australian-built Minis (1961-1978) using the 6-character YMA2S1-style body/type code. Provides position-by-position breakdown of chassis number components.',

  inputSchema: {
    yearRange: z
      .enum(['1959-1969', '1969-1974', '1974-1980', '1980', '1980-1985', '1985-1990', '1990-on', '1961-1978 (Australia)'])
      .describe(
        'Year range for chassis number format. Each era has a different chassis number structure and decoding rules. Use "1961-1978 (Australia)" for Australian-built Morris / Cooper Minis.'
      ),
    chassisNumber: z
      .string()
      .min(1)
      .max(50)
      .describe('Classic Mini chassis number to decode (e.g., "A-A2S7L-123A" for 1959-1969, or "YMA2S1-12345" for Australian Morris 850)'),
  },

  async handler({ yearRange, chassisNumber }) {
    // Validate chassis number contains only allowed characters
    if (!/^[A-Za-z0-9\-\s\/]+$/.test(chassisNumber)) {
      return errorResult(
        'Chassis number contains invalid characters. Only letters, numbers, hyphens, spaces, and forward slashes are allowed'
      );
    }

    // Find the matching chassis range for validation
    const selectedRange = chassisRanges.find((range) => range.title === yearRange);

    if (!selectedRange) {
      return errorResult(
        `Invalid year range: ${yearRange}. Valid ranges are: ${chassisRanges.map((r) => r.title).join(', ')}`
      );
    }

    // Call the existing chassis decoder API internally
    try {
      const runtimeConfig = useRuntimeConfig();
      const apiUrl = runtimeConfig.public.siteUrl || 'http://localhost:3000';
      const endpoint = `${apiUrl}/api/decoders/chassis`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          yearRange,
          chassisNumber,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return errorResult(`Chassis decoder API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const decoderResponse = await response.json();

      // Format the response for MCP with human-readable context
      const positionsBreakdown = decoderResponse.decodedPositions
        .map((pos: any) => `Position ${pos.position}: "${pos.value}" = ${pos.name} ${pos.matched ? '✓' : '✗'}`)
        .join('\n');

      const validationStatus = decoderResponse.isValid ? '✅ VALID' : '❌ INVALID';
      const errorText =
        decoderResponse.errors && decoderResponse.errors.length > 0
          ? `\n\n**Validation Errors:**\n${decoderResponse.errors.join('\n')}`
          : '';

      const resultText = `**Chassis Decoder Results**

**Input:**
- Chassis Number: ${decoderResponse.chassisNumber}
- Year Range: ${decoderResponse.yearRange}
- Expected Pattern: ${decoderResponse.pattern}

**Validation Status:** ${validationStatus}

**Position-by-Position Breakdown:**
${positionsBreakdown}

**Summary:** Chassis number ${decoderResponse.chassisNumber} for ${decoderResponse.yearRange} range is ${decoderResponse.isValid ? 'VALID' : 'INVALID'}${errorText}`;

      return jsonResult({
        inputs: {
          yearRange: decoderResponse.yearRange,
          chassisNumber: decoderResponse.chassisNumber,
        },
        results: {
          isValid: decoderResponse.isValid,
          pattern: decoderResponse.pattern,
          decodedPositions: decoderResponse.decodedPositions,
        },
        context: {
          yearRange: decoderResponse.yearRange,
          expectedPattern: decoderResponse.pattern,
          validationStatus: decoderResponse.isValid ? 'Valid chassis number' : 'Invalid chassis number',
          errors: decoderResponse.errors || [],
        },
        humanReadable: {
          summary: `Chassis number ${decoderResponse.chassisNumber} for ${decoderResponse.yearRange} range is ${decoderResponse.isValid ? 'VALID' : 'INVALID'}`,
          breakdown: positionsBreakdown,
          errors:
            decoderResponse.errors && decoderResponse.errors.length > 0
              ? decoderResponse.errors.join('; ')
              : 'No errors',
        },
        formattedText: resultText,
      });
    } catch (error: any) {
      console.error('Chassis decoder MCP error:', error);
      return errorResult(`Internal server error decoding chassis number: ${error.message}`);
    }
  },

  // Cache results for 24 hours since chassis decoder logic is static
  cache: '24h',
});
