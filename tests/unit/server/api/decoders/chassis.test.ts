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

    it('throws 400 when yearRange is too long (over 20 chars)', async () => {
      vi.mocked(readBody).mockResolvedValue({
        yearRange: 'A'.repeat(21),
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
});
