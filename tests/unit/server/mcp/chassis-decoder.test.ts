// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Nitro/MCP globals before importing the tool
// ---------------------------------------------------------------------------
const { mockJsonResult, mockErrorResult, mockUseRuntimeConfig } = vi.hoisted(() => {
  const mockJsonResult = vi.fn((data: any) => data);
  const mockErrorResult = vi.fn((message: string) => ({ error: true, message }));
  const mockUseRuntimeConfig = vi.fn(() => ({
    public: { siteUrl: 'http://localhost:3000' },
  }));
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = mockJsonResult;
  (globalThis as any).errorResult = mockErrorResult;
  (globalThis as any).useRuntimeConfig = mockUseRuntimeConfig;
  return { mockJsonResult, mockErrorResult, mockUseRuntimeConfig };
});

import { chassisRanges } from '~/data/models/decoders';
import { validateChassisNumber } from '~/server/utils/chassisDecode';

// ---------------------------------------------------------------------------
// The tool decodes IN PROCESS via server/utils/chassisDecode. It used to HTTP-PUT
// the site's own /api/decoders/chassis, and these tests mocked fetch and asserted
// against a hand-written response fixture — which proved the tool could parse a
// shape we invented, not that it decodes correctly. They now exercise the real
// decoder, and globalThis.fetch is stubbed to a throwing spy so any return of the
// self-fetch fails loudly.
// ---------------------------------------------------------------------------
const fetchSpy = vi.fn(() => {
  throw new Error('the chassis tool must not make network calls');
});
(globalThis as any).fetch = fetchSpy;

const AUS = '1961-1978 (Australia)';

// ---------------------------------------------------------------------------
// Import the tool config once mocks are in place
// ---------------------------------------------------------------------------
let toolConfig: any;

beforeEach(async () => {
  vi.resetModules();
  fetchSpy.mockClear();
  mockJsonResult.mockClear();
  mockErrorResult.mockClear();
  mockJsonResult.mockImplementation((data: any) => data);
  mockErrorResult.mockImplementation((message: string) => ({ error: true, message }));
  const mod = await import('~/server/mcp/tools/chassis-decoder');
  toolConfig = mod.default;
});

describe('Chassis Decoder MCP Tool — configuration', () => {
  it('has a description string that mentions Australian Minis', () => {
    expect(typeof toolConfig.description).toBe('string');
    expect(toolConfig.description.length).toBeGreaterThan(0);
    expect(toolConfig.description).toMatch(/Australian/);
  });

  it('has yearRange and chassisNumber in the input schema', () => {
    const keys = Object.keys(toolConfig.inputSchema);
    expect(keys).toContain('yearRange');
    expect(keys).toContain('chassisNumber');
  });

  it('has a handler function', () => {
    expect(typeof toolConfig.handler).toBe('function');
  });

  it('has a cache setting of 24h', () => {
    expect(toolConfig.cache).toBe('24h');
  });

  it('yearRange zod enum contains every range defined in chassisRanges', () => {
    // The zod enum values are stored on the schema's ._def.values (Zod v3)
    // or via .options in newer versions. Inspect both safely.
    const schema = toolConfig.inputSchema.yearRange;
    const values =
      (schema?._def?.values as readonly string[] | undefined) ??
      (schema?.options as readonly string[] | undefined) ??
      [];
    const enumValues = [...values];
    for (const range of chassisRanges) {
      expect(enumValues).toContain(range.title);
    }
  });

  it('yearRange zod enum explicitly includes the new Australian range', () => {
    const schema = toolConfig.inputSchema.yearRange;
    const values =
      (schema?._def?.values as readonly string[] | undefined) ??
      (schema?.options as readonly string[] | undefined) ??
      [];
    expect([...values]).toContain('1961-1978 (Australia)');
  });
});

// ---------------------------------------------------------------------------
// Handler — input validation (before fetch)
// ---------------------------------------------------------------------------
describe('Chassis Decoder MCP Tool — input validation', () => {
  it('rejects chassis numbers with disallowed characters', async () => {
    const result = await toolConfig.handler({
      yearRange: '1959-1969',
      chassisNumber: 'BAD@CHARS!',
    });
    expect(mockErrorResult).toHaveBeenCalledOnce();
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/invalid characters/i);
  });

  it('rejects unknown year range titles', async () => {
    const result = await toolConfig.handler({
      yearRange: 'not-a-real-range' as any,
      chassisNumber: 'ABC123',
    });
    expect(mockErrorResult).toHaveBeenCalledOnce();
    expect(result.message).toMatch(/Invalid year range/);
  });

  it('accepts hyphens, spaces, and forward slashes in chassis numbers', async () => {
    const result = await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1 / 12345 - A',
    });
    // Should not have been rejected by the character validator
    expect(mockErrorResult).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Handler — in-process decoding
// ---------------------------------------------------------------------------
describe('Chassis Decoder MCP Tool — decoding', () => {
  it('never makes a network call', async () => {
    await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('decodes a valid Australian chassis number', async () => {
    const result = await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });

    expect(mockErrorResult).not.toHaveBeenCalled();
    expect(result.results.isValid).toBe(true);
    expect(result.results.pattern).toBe('YMA2S1####');
    expect(result.results.decodedPositions.length).toBeGreaterThan(0);
    expect(result.context.errors).toEqual([]);
  });

  it('decodes a valid 1959-1969 UK chassis number', async () => {
    const result = await toolConfig.handler({ yearRange: '1959-1969', chassisNumber: 'A-A2S7L-123A' });

    expect(result.results.isValid).toBe(true);
    expect(result.results.pattern).toBe('A-A2S7L-###A');
  });

  it('agrees with the shared decoder it delegates to', async () => {
    const range = chassisRanges.find((r) => r.title === AUS)!;
    const direct = validateChassisNumber('YMA2S1-12345', range);
    const viaTool = await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });

    expect(viaTool.results.isValid).toBe(direct.isValid);
    expect(viaTool.results.pattern).toBe(direct.pattern);
    expect(viaTool.results.decodedPositions).toEqual(direct.decodedPositions);
  });
});

// ---------------------------------------------------------------------------
// Handler — response shaping
// ---------------------------------------------------------------------------
describe('Chassis Decoder MCP Tool — response shaping', () => {
  it('returns inputs, results, context and humanReadable sections', async () => {
    const result = await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });

    expect(result).toHaveProperty('inputs');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('humanReadable');
    expect(result).toHaveProperty('formattedText');
  });

  it('echoes yearRange and chassisNumber into the inputs block', async () => {
    const result = await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });

    expect(result.inputs.yearRange).toBe(AUS);
    expect(result.inputs.chassisNumber).toBe('YMA2S1-12345');
  });

  it('marks a valid number VALID in the formatted text and includes the pattern', async () => {
    const result = await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });

    expect(result.formattedText).toContain('VALID');
    expect(result.formattedText).toContain('YMA2S1####');
  });

  it('breaks down every decoded position in the formatted text', async () => {
    const result = await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });

    for (const pos of result.results.decodedPositions) {
      expect(result.humanReadable.breakdown).toContain(`Position ${pos.position}`);
    }
  });

  it('surfaces decoder errors when the number is invalid', async () => {
    const result = await toolConfig.handler({ yearRange: '1959-1969', chassisNumber: 'ZZZZ' });

    expect(result.results.isValid).toBe(false);
    expect(result.context.errors.length).toBeGreaterThan(0);
    expect(result.formattedText).toContain('INVALID');
    expect(result.humanReadable.errors).not.toBe('No errors');
  });

  it('reports no errors for a valid number', async () => {
    const result = await toolConfig.handler({ yearRange: AUS, chassisNumber: 'YMA2S1-12345' });

    expect(result.humanReadable.errors).toBe('No errors');
  });
});
