/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('setResponseHeaders', vi.fn());
vi.stubGlobal('assertMethod', vi.fn());
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e = new Error(opts.message || opts.statusMessage);
  (e as any).statusCode = opts.statusCode;
  return e;
});

describe('server/api/decoders/chassis', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    vi.mocked(assertMethod).mockReset();
    vi.mocked(readBody).mockReset();
    vi.mocked(setResponseHeaders).mockReset();
    const mod = await import('~/server/api/decoders/chassis');
    handler = mod.default;
  });

  // ============================================================
  // Validation error tests
  // ============================================================

  describe('validation errors', () => {
    it('throws 400 when body is null', async () => {
      vi.mocked(readBody).mockResolvedValue(null);
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
      }
    });

    it('throws 400 when body is not an object', async () => {
      vi.mocked(readBody).mockResolvedValue('string-body');
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
      }
    });

    it('throws 400 when yearRange is missing', async () => {
      vi.mocked(readBody).mockResolvedValue({ chassisNumber: 'A-A2S7L-123A' });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('yearRange');
      }
    });

    it('throws 400 when chassisNumber is missing', async () => {
      vi.mocked(readBody).mockResolvedValue({ yearRange: '1959-1969' });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('chassisNumber');
      }
    });

    it('throws 400 when chassisNumber is too long (over 50 chars)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 'A'.repeat(51),
      });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('too long');
      }
    });

    it('throws 400 when yearRange is too long (over 30 chars)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: 'A'.repeat(31),
        chassisNumber: 'ABC123',
      });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('too long');
      }
    });

    it('throws 400 when chassisNumber contains invalid characters', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 'ABC@#$123',
      });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('invalid characters');
      }
    });

    it('throws 400 when yearRange is not a recognized range', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '2025-2030',
        chassisNumber: 'ABC123',
      });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('Invalid year range');
      }
    });

    it('throws 400 when readBody throws (invalid JSON)', async () => {
      vi.mocked(readBody).mockRejectedValue(new Error('Invalid JSON'));
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('Invalid JSON');
      }
    });

    it('throws 400 when yearRange is a number instead of string', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: 1959,
        chassisNumber: 'ABC123',
      });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('yearRange');
      }
    });

    it('throws 400 when chassisNumber is a number instead of string', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 12345,
      });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('chassisNumber');
      }
    });
  });

  // ============================================================
  // Successful decoding tests -- one per year range
  // ============================================================

  describe('decoding 1959-1969 chassis numbers', () => {
    // PrimaryExample: A- A 2S 7 L- ### A
    // Valid: A-A2S7L-807922A
    it('decodes a valid 1959-1969 chassis number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 'A-A2S7L-807922A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1959-1969');
      expect(result.decodedPositions.length).toBeGreaterThan(0);
    });

    it('decodes 1959-1969 with missing trim level (position 5)', async () => {
      // When position 5 is missing, goes straight to numbers
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 'A-A2S7-807922A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      // Position 5 should be inferred as missing
      const pos5 = result.decodedPositions.find((p: any) => p.position === 5);
      expect(pos5).toBeTruthy();
      expect(pos5.value).toBe('(missing)');
      expect(pos5.matched).toBe(true);
    });

    it('decodes a Moke chassis number (1959-1969)', async () => {
      // Body type B = Moke
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 'A-AB1L-807922A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      // Find body type position
      const pos3 = result.decodedPositions.find((p: any) => p.position === 3);
      expect(pos3).toBeTruthy();
      expect(pos3.value).toBe('B');
    });
  });

  describe('decoding 1969-1974 chassis numbers', () => {
    // PrimaryExample: X- A 2S 1 N- ### A
    // Valid: X-A2S1N-547206A
    it('decodes a valid 1969-1974 chassis number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1969-1974',
        chassisNumber: 'X-A2S1N-547206A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1969-1974');
      expect(result.decodedPositions.length).toBeGreaterThan(0);
    });

    it('handles 1969-1974 with blank position 4 (Mini 850)', async () => {
      // Position 4 blank = Mini 850, next char should be N (pos 5)
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1969-1974',
        chassisNumber: 'X-A2SN-547206A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      const pos4 = result.decodedPositions.find((p: any) => p.position === 4);
      expect(pos4).toBeTruthy();
      expect(pos4.value).toBe('');
      expect(pos4.matched).toBe(true);
    });

    it('decodes Clubman body style (position 3 = D, position 4 = 2)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1969-1974',
        chassisNumber: 'X-AD2N-547206A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
    });
  });

  describe('decoding 1974-1980 chassis numbers', () => {
    // PrimaryExample: X- K 2S 1 N- ### A
    // Valid: X-K2S1N-123456A
    it('decodes a valid 1974-1980 chassis number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1974-1980',
        chassisNumber: 'X-K2S1A-123456A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1974-1980');
      expect(result.decodedPositions.length).toBeGreaterThan(0);
    });

    it('accepts N trim in position 5 for non-North America (Special Deluxe)', async () => {
      // N is the most common rest-of-world value and matches the PrimaryExample
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1974-1980',
        chassisNumber: 'X-L2S1N-123456A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.isValid).toBe(true);
      const pos5 = result.decodedPositions.find((p: any) => p.position === 5);
      expect(pos5).toBeTruthy();
      expect(pos5.value).toBe('N');
      expect(pos5.matched).toBe(true);
      expect(pos5.name).toMatch(/Special Deluxe|non-North America/i);
    });

    it('accepts 2D body code for 1275GT prefixes (e.g. X-E2D2)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1974-1980',
        chassisNumber: 'X-E2D2N-123456A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.isValid).toBe(true);
      const pos3 = result.decodedPositions.find((p: any) => p.position === 3);
      expect(pos3).toBeTruthy();
      expect(pos3.value).toBe('2D');
      expect(pos3.name).toMatch(/1275GT/);
    });

    it('missing assembly plant is inferred for 1974-1980', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1974-1980',
        chassisNumber: 'X-K2S1A-123456',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      // Assembly plant at position 13 should be inferred as missing
      const pos13 = result.decodedPositions.find((p: any) => p.position === 13);
      expect(pos13).toBeTruthy();
      expect(pos13.value).toBe('(missing)');
      expect(pos13.matched).toBe(true);
    });
  });

  describe('decoding 1980 chassis numbers', () => {
    // PrimaryExample: X- K 2S 1 N- ### A
    // Valid: X-K2S1N-123456A
    it('decodes a valid 1980 chassis number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980',
        chassisNumber: 'X-K2S1N-123456A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1980');
      expect(result.decodedPositions.length).toBeGreaterThan(0);
    });
  });

  describe('decoding 1980-1985 chassis numbers', () => {
    // PrimaryExample: SAX- (2 blank) X- K 2S (blank) 1 N- ### A
    // Valid: SAX-X-K2S1N-123456A
    it('decodes a valid 1980-1985 chassis number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980-1985',
        chassisNumber: 'SAX-X-K2S1N-123456A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1980-1985');
      expect(result.decodedPositions.length).toBeGreaterThan(0);
    });
  });

  describe('decoding 1985-1990 chassis numbers', () => {
    // PrimaryExample: SAX- (2 blank) X- L 2S (blank) 1 N 2 0- ### A
    // Valid: SAX-X-L2S1N20-123456A
    it('decodes a valid 1985-1990 chassis number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1985-1990',
        chassisNumber: 'SAX-X-L2S1N20-123456A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1985-1990');
      expect(result.decodedPositions.length).toBeGreaterThan(0);
    });

    it('missing assembly plant is inferred as non-English for 1985-1990', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1985-1990',
        chassisNumber: 'SAX-X-L2S1N20-123456',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      const pos13 = result.decodedPositions.find((p: any) => p.position === 13);
      expect(pos13).toBeTruthy();
      expect(pos13.value).toBe('(missing)');
      expect(pos13.name).toContain('Non-English');
    });

    it('accepts catalyst-equipped code "3" at position 8 (e.g. X-L2S3N)', async () => {
      // Catalyst-equipped Mini Mayfair 1989-92: SAX-X-L2S3N20-####-A
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1985-1990',
        chassisNumber: 'SAX-X-L2S3N20-123456A',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.isValid).toBe(true);
      const pos8 = result.decodedPositions.find((p: any) => p.position === 8);
      expect(pos8).toBeTruthy();
      expect(pos8.value).toBe('3');
      expect(pos8.name).toMatch(/catalyst/i);
    });
  });

  describe('decoding 1990-on chassis numbers', () => {
    // PrimaryExample: SAX XN- (blank) N- A- Y- B- B- D- ######
    // Valid: SAXXN-N-A-Y-B-B-D-123456
    it('decodes a valid 1990-on chassis number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1990-on',
        chassisNumber: 'SAXXN-N-A-Y-B-B-D-123456',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1990-on');
      expect(result.decodedPositions.length).toBeGreaterThan(0);
    });

    it('handles 1990-on with missing assembly plant (position 11)', async () => {
      // Position 11 (assembly plant D) is missing, goes straight to numbers
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1990-on',
        chassisNumber: 'SAXXN-N-A-Y-B-B-123456',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      const pos11 = result.decodedPositions.find((p: any) => p.position === 11);
      expect(pos11).toBeTruthy();
      expect(pos11.value).toBe('(missing)');
      expect(pos11.matched).toBe(true);
    });

    it('accepts Cooper code "C" at position 6 (XN-CA prefix)', async () => {
      // Mini Cooper 1990-96: SAX-XN-C-A-...  (Cooper 1.3i, MPi etc.)
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1990-on',
        chassisNumber: 'SAXXN-C-A-Y-B-B-D-123456',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.isValid).toBe(true);
      const pos6 = result.decodedPositions.find((p: any) => p.position === 6);
      expect(pos6).toBeTruthy();
      expect(pos6.value).toBe('C');
      expect(pos6.name).toMatch(/Cooper/);
    });
  });

  describe('decoding 1961-1978 (Australia) chassis numbers', () => {
    // PrimaryExample: Y M A 2 S 1 - #### (6-char body/type code)
    // Valid: YMA2S1-12345
    it('decodes a valid Australian Morris 850 (YMA2S1)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1-12345',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
      expect(result.yearRange).toBe('1961-1978 (Australia)');
      expect(result.isValid).toBe(true);
      // Origin
      const pos1 = result.decodedPositions.find((p: any) => p.position === 1);
      expect(pos1?.value).toBe('Y');
      expect(pos1?.name).toMatch(/Australia/);
      // Make = Morris
      const pos2 = result.decodedPositions.find((p: any) => p.position === 2);
      expect(pos2?.value).toBe('M');
      expect(pos2?.name).toMatch(/Morris/);
      // Production number extracted
      const numberPos = result.decodedPositions.find((p: any) => p.position === 12);
      expect(numberPos?.value).toBe('12345');
    });

    it('decodes an Australian Morris Cooper (YKA2S1)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YKA2S1-98765',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.isValid).toBe(true);
      const pos2 = result.decodedPositions.find((p: any) => p.position === 2);
      expect(pos2?.value).toBe('K');
      expect(pos2?.name).toMatch(/Cooper/);
    });

    it('decodes an Australian Cooper S Mk1 (YKG2S2) with 1275 engine code G', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YKG2S2-5555',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.isValid).toBe(true);
      const pos3 = result.decodedPositions.find((p: any) => p.position === 3);
      expect(pos3?.value).toBe('G');
      expect(pos3?.name).toMatch(/1275/);
      const pos6 = result.decodedPositions.find((p: any) => p.position === 6);
      expect(pos6?.value).toBe('2');
    });

    it('decodes an Australian Mini Deluxe (YMA2S2)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S2-1001',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.isValid).toBe(true);
      const pos6 = result.decodedPositions.find((p: any) => p.position === 6);
      expect(pos6?.value).toBe('2');
      expect(pos6?.name).toMatch(/Mk2|Deluxe/);
    });

    it('flags an unknown Make letter as invalid (e.g. Z at position 2)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YZA2S1-12345',
      });
      const result = await handler({});
      expect(result.success).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Production sequence number tests
  // ============================================================

  describe('production sequence number validation', () => {
    it('accepts a valid sequence number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980',
        chassisNumber: 'X-K2S1N-123456A',
      });
      const result = await handler({});
      const numberPos = result.decodedPositions.find((p: any) => p.position === 12);
      expect(numberPos).toBeTruthy();
      expect(numberPos.value).toBe('123456');
      expect(numberPos.matched).toBe(true);
      expect(numberPos.name).toBe('Production sequence number');
    });

    it('accepts a single digit sequence number', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980',
        chassisNumber: 'X-K2S1N-1A',
      });
      const result = await handler({});
      const numberPos = result.decodedPositions.find((p: any) => p.position === 12);
      expect(numberPos).toBeTruthy();
      expect(numberPos.value).toBe('1');
      expect(numberPos.matched).toBe(true);
    });
  });

  // ============================================================
  // General response structure tests
  // ============================================================

  describe('response structure', () => {
    it('includes all expected fields in response', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980',
        chassisNumber: 'X-K2S1N-123456A',
      });
      const result = await handler({});
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('yearRange');
      expect(result).toHaveProperty('chassisNumber');
      expect(result).toHaveProperty('decodedPositions');
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('pattern');
      expect(result).toHaveProperty('rangeData');
    });

    it('chassis number is uppercased in response', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980',
        chassisNumber: 'x-k2s1n-123456a',
      });
      const result = await handler({});
      expect(result.chassisNumber).toBe('X-K2S1N-123456A');
    });

    it('calls setResponseHeaders with long-lived cache', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980',
        chassisNumber: 'X-K2S1N-123456A',
      });
      const mockEvent = { id: 'test' };
      await handler(mockEvent);
      expect(setResponseHeaders).toHaveBeenCalledWith(
        mockEvent,
        expect.objectContaining({
          'Cache-Control': expect.stringContaining('31536000'),
        })
      );
    });

    it('assertMethod is called with PUT', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1980',
        chassisNumber: 'X-K2S1N-123456A',
      });
      await handler({});
      expect(assertMethod).toHaveBeenCalledWith({}, 'PUT');
    });
  });

  // ============================================================
  // Invalid chassis content tests
  // ============================================================

  describe('invalid chassis content', () => {
    it('reports errors for an unrecognized manufacturer code in 1959-1969', async () => {
      // Position 1 "Z" is not a valid manufacturer for 1959-1969
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 'Z-A2S7L-807922A',
      });
      const result = await handler({});
      expect(result.success).toBe(true); // Handler succeeds, but validation may flag errors
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.isValid).toBe(false);
    });

    it('reports error when chassis number is too short', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1959-1969',
        chassisNumber: 'A-A',
      });
      const result = await handler({});
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Australian range — exhaustive position coverage
  // ============================================================

  describe('1961-1978 (Australia) — every Make letter (position 2)', () => {
    const cases: Array<{ marque: 'M' | 'K' | 'J'; chassis: string; match: RegExp }> = [
      { marque: 'M', chassis: 'YMA2S1-10001', match: /Morris/ },
      { marque: 'K', chassis: 'YKA2S1-10002', match: /Cooper/ },
      { marque: 'J', chassis: 'YJA2V1-10003', match: /Commercial|Van|Utility/ },
    ];

    for (const { marque, chassis, match } of cases) {
      it(`decodes marque letter "${marque}" correctly`, async () => {
        vi.mocked(readBody).mockResolvedValue({
          yearRange: '1961-1978 (Australia)',
          chassisNumber: chassis,
        });
        const result = await handler({});
        const pos2 = result.decodedPositions.find((p: any) => p.position === 2);
        expect(pos2?.value).toBe(marque);
        expect(pos2?.matched).toBe(true);
        expect(pos2?.name).toMatch(match);
      });
    }
  });

  describe('1961-1978 (Australia) — every engine code (position 3)', () => {
    it('decodes "A" engine (800-999cc)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1-10001',
      });
      const result = await handler({});
      const pos3 = result.decodedPositions.find((p: any) => p.position === 3);
      expect(pos3?.value).toBe('A');
      expect(pos3?.matched).toBe(true);
      expect(pos3?.name).toMatch(/800|848|998/);
    });

    it('decodes "G" engine (1275cc Cooper S)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YKG2S2-10002',
      });
      const result = await handler({});
      const pos3 = result.decodedPositions.find((p: any) => p.position === 3);
      expect(pos3?.value).toBe('G');
      expect(pos3?.matched).toBe(true);
      expect(pos3?.name).toMatch(/1275/);
    });

    it('flags unknown engine letter "X" as unmatched at position 3', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMX2S1-10004',
      });
      const result = await handler({});
      expect(result.isValid).toBe(false);
      const pos3 = result.decodedPositions.find((p: any) => p.position === 3);
      expect(pos3?.matched).toBe(false);
    });
  });

  describe('1961-1978 (Australia) — every body letter (position 5)', () => {
    it('decodes "S" as Saloon', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1-20001',
      });
      const result = await handler({});
      const pos5 = result.decodedPositions.find((p: any) => p.position === 5);
      expect(pos5?.value).toBe('S');
      expect(pos5?.name).toMatch(/Saloon|Sedan/);
    });

    it('decodes "V" as Van / Commercial', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YJA2V1-20002',
      });
      const result = await handler({});
      const pos5 = result.decodedPositions.find((p: any) => p.position === 5);
      expect(pos5?.value).toBe('V');
      expect(pos5?.name).toMatch(/Van|Commercial/);
    });

    it('flags unknown body letter "X" as unmatched at position 5', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2X1-20003',
      });
      const result = await handler({});
      expect(result.isValid).toBe(false);
      const pos5 = result.decodedPositions.find((p: any) => p.position === 5);
      expect(pos5?.matched).toBe(false);
    });
  });

  describe('1961-1978 (Australia) — every model digit (position 6)', () => {
    const cases: Array<{ digit: string; chassis: string; match: RegExp }> = [
      { digit: '1', chassis: 'YMA2S1-30001', match: /Mk1/i },
      { digit: '2', chassis: 'YMA2S2-30002', match: /Mk2|Deluxe/i },
      { digit: '3', chassis: 'YMA2S3-30003', match: /Mini Minor|Mini 1100|1969/ },
      { digit: '4', chassis: 'YMA2S4-30004', match: /Mini-Matic|Cooper S/i },
      { digit: '5', chassis: 'YMA2S5-30005', match: /Mini-Matic Mk2/i },
      { digit: '8', chassis: 'YMA2S8-30008', match: /Clubman GT/ },
    ];

    for (const { digit, chassis, match } of cases) {
      it(`decodes model digit "${digit}"`, async () => {
        vi.mocked(readBody).mockResolvedValue({
          yearRange: '1961-1978 (Australia)',
          chassisNumber: chassis,
        });
        const result = await handler({});
        const pos6 = result.decodedPositions.find((p: any) => p.position === 6);
        expect(pos6?.value).toBe(digit);
        expect(pos6?.matched).toBe(true);
        expect(pos6?.name).toMatch(match);
      });
    }

    it('flags unknown model digit "9" as unmatched at position 6', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S9-30009',
      });
      const result = await handler({});
      expect(result.isValid).toBe(false);
      const pos6 = result.decodedPositions.find((p: any) => p.position === 6);
      expect(pos6?.matched).toBe(false);
    });
  });

  describe('1961-1978 (Australia) — production number and pattern', () => {
    it('extracts the production sequence into position 12', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1-99999',
      });
      const result = await handler({});
      const numberPos = result.decodedPositions.find((p: any) => p.position === 12);
      expect(numberPos?.value).toBe('99999');
      expect(numberPos?.matched).toBe(true);
    });

    it('accepts short production numbers (e.g. 101)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1-101',
      });
      const result = await handler({});
      const numberPos = result.decodedPositions.find((p: any) => p.position === 12);
      expect(numberPos?.value).toBe('101');
    });

    it('returns pattern "YMA2S1####" for Australian range', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1-12345',
      });
      const result = await handler({});
      expect(result.pattern).toBe('YMA2S1####');
    });

    it('accepts chassis numbers without hyphen separator', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1 12345',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
    });
  });

  describe('1961-1978 (Australia) — combined spot checks', () => {
    it('decodes a full Morris Cooper S Mk1 (YKG2S2)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YKG2S2-12345',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      expect(result.decodedPositions.find((p: any) => p.position === 2)?.value).toBe('K');
      expect(result.decodedPositions.find((p: any) => p.position === 3)?.value).toBe('G');
      expect(result.decodedPositions.find((p: any) => p.position === 6)?.value).toBe('2');
    });

    it('case-insensitive: lowercase input is uppercased and decodes', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'yma2s1-12345',
      });
      const result = await handler({});
      expect(result.chassisNumber).toBe('YMA2S1-12345');
      expect(result.isValid).toBe(true);
    });

    it('reports errors when origin letter is wrong (e.g. "XMA2S1")', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'XMA2S1-12345',
      });
      const result = await handler({});
      expect(result.isValid).toBe(false);
      const pos1 = result.decodedPositions.find((p: any) => p.position === 1);
      expect(pos1?.matched).toBe(false);
    });

    it('accepts the 30-char year range string (boundary check)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)', // 22 chars — previously over old 20-char limit
        chassisNumber: 'YMA2S1-12345',
      });
      const result = await handler({});
      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // UK additions — expanded coverage
  // ============================================================

  describe('1974-1980 — "N" trim (Special Deluxe) exhaustive checks', () => {
    it('N trim is accepted alongside canonical engine code K (Austin saloon)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1974-1980',
        chassisNumber: 'X-K2S1N-200001A',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      const pos5 = result.decodedPositions.find((p: any) => p.position === 5);
      expect(pos5?.value).toBe('N');
    });

    it('N trim is accepted with alternative Morris (L) engine code prefix', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1974-1980',
        chassisNumber: 'X-L2S1N-200002A',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      const pos5 = result.decodedPositions.find((p: any) => p.position === 5);
      expect(pos5?.value).toBe('N');
      expect(pos5?.name).toMatch(/Special Deluxe|non-North America/i);
    });
  });

  describe('1974-1980 — "2D" 1275GT body code exhaustive checks', () => {
    it('accepts E-engine + 2D body for a 1275GT', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1974-1980',
        chassisNumber: 'X-E2D2N-200010A',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      const pos3 = result.decodedPositions.find((p: any) => p.position === 3);
      expect(pos3?.value).toBe('2D');
      expect(pos3?.name).toMatch(/1275GT/);
      expect(pos3?.name).not.toMatch(/unclear/i);
    });
  });

  describe('1985-1990 — catalyst "3" exhaustive checks', () => {
    it('accepts "3" at position 8 alongside Mini Mayfair L2S pattern', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1985-1990',
        chassisNumber: 'SAX-X-L2S3N20-300010A',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      const pos8 = result.decodedPositions.find((p: any) => p.position === 8);
      expect(pos8?.value).toBe('3');
      expect(pos8?.name).toMatch(/catalyst/i);
    });

    it('existing "1" (non-catalyst) option still decodes alongside "3"', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1985-1990',
        chassisNumber: 'SAX-X-L2S1N20-300011A',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      const pos8 = result.decodedPositions.find((p: any) => p.position === 8);
      expect(pos8?.value).toBe('1');
      // "1" explicitly identifies the non-catalyst variant (the name contains
      // "non-catalyst"), which is distinct from "3" (catalyst-equipped).
      expect(pos8?.name).toMatch(/non-catalyst/i);
      expect(pos8?.name).not.toMatch(/catalyst-equipped/i);
    });
  });

  describe('1990-on — Cooper "C" exhaustive checks', () => {
    it('accepts XN-C-A pattern for Cooper 1.3i', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1990-on',
        chassisNumber: 'SAXXN-C-A-Y-B-B-D-400010',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      const pos6 = result.decodedPositions.find((p: any) => p.position === 6);
      expect(pos6?.value).toBe('C');
      expect(pos6?.name).toMatch(/Cooper/);
    });

    it('existing "N" (non-Cooper) option still decodes alongside "C"', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1990-on',
        chassisNumber: 'SAXXN-N-A-Y-B-B-D-400011',
      });
      const result = await handler({});
      expect(result.isValid).toBe(true);
      const pos6 = result.decodedPositions.find((p: any) => p.position === 6);
      expect(pos6?.value).toBe('N');
      expect(pos6?.name).not.toMatch(/Cooper/);
    });
  });

  // ============================================================
  // yearRange length boundary (20→30 char bump)
  // ============================================================

  describe('yearRange length boundary after 30-char bump', () => {
    it('accepts a yearRange string up to 30 chars when valid', async () => {
      // Inject a synthetic 30-char range is not testable (no such range exists),
      // but we can verify the new AU title (22 chars) is accepted — regression
      // guard for the previous 20-char cap.
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (Australia)',
        chassisNumber: 'YMA2S1-55555',
      });
      const result = await handler({});
      expect(result.success).toBe(true);
    });

    it('rejects yearRange strings over 30 chars with 400', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: '1961-1978 (AustraliaXXXXXXXXXXX)', // 31 chars
        chassisNumber: 'YMA2S1-55555',
      });
      await expect(handler({})).rejects.toThrow();
      try {
        await handler({});
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain('too long');
      }
    });
  });
});
