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

// ---------------------------------------------------------------------------
// Helper: fetch mock factory. Accepts a response body and returns a mock
// that resolves to a Response-like object.
// ---------------------------------------------------------------------------
function mockFetchOk(body: any) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function mockFetchErr(status: number, statusText: string, body = 'Bad Request') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
    text: async () => body,
  });
}

const sampleDecoderResponse = {
  chassisNumber: 'YMA2S1-12345',
  yearRange: '1961-1978 (Australia)',
  pattern: 'YMA2S1####',
  isValid: true,
  errors: [],
  decodedPositions: [
    {
      position: 1,
      value: 'Y',
      name: 'Origin of manufacture: Australia (BMC / Leyland Australia, Zetland NSW)',
      matched: true,
    },
    {
      position: 2,
      value: 'M',
      name: 'Morris (Morris 850, Mini Deluxe, Mini Minor, Mini-Matic Mk1)',
      matched: true,
    },
    { position: 3, value: 'A', name: 'A-series engine, 800–999cc', matched: true },
    { position: 4, value: '2', name: '2-door body', matched: true },
    { position: 5, value: 'S', name: 'Saloon (Sedan)', matched: true },
    {
      position: 6,
      value: '1',
      name: 'Mk1: Morris 850 (YMA2S1) or Morris Cooper (YKA2S1), 1961–1966',
      matched: true,
    },
    { position: 12, value: '12345', name: 'Production sequence number', matched: true },
  ],
};

// ---------------------------------------------------------------------------
// Import the tool config once mocks are in place
// ---------------------------------------------------------------------------
let toolConfig: any;

beforeEach(async () => {
  vi.resetModules();
  mockJsonResult.mockClear();
  mockErrorResult.mockClear();
  mockUseRuntimeConfig.mockClear();
  mockJsonResult.mockImplementation((data: any) => data);
  mockErrorResult.mockImplementation((message: string) => ({ error: true, message }));
  mockUseRuntimeConfig.mockImplementation(() => ({ public: { siteUrl: 'http://localhost:3000' } }));
  const mod = await import('~/server/mcp/tools/chassis-decoder');
  toolConfig = mod.default;
});

// ---------------------------------------------------------------------------
// Tool configuration / metadata
// ---------------------------------------------------------------------------
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
    globalThis.fetch = mockFetchOk(sampleDecoderResponse) as any;
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
// Handler — fetch wiring
// ---------------------------------------------------------------------------
describe('Chassis Decoder MCP Tool — API call', () => {
  it('calls the chassis decoder API via PUT with JSON body', async () => {
    const fetchMock = mockFetchOk(sampleDecoderResponse);
    globalThis.fetch = fetchMock as any;

    await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1-12345',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/decoders/chassis');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1-12345',
    });
  });

  it('uses siteUrl from runtime config when provided', async () => {
    mockUseRuntimeConfig.mockImplementation(() => ({
      public: { siteUrl: 'https://classicminidiy.com' },
    }));
    const fetchMock = mockFetchOk(sampleDecoderResponse);
    globalThis.fetch = fetchMock as any;

    await toolConfig.handler({
      yearRange: '1959-1969',
      chassisNumber: 'A-A2S7L-807922A',
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://classicminidiy.com/api/decoders/chassis');
  });

  it('falls back to localhost when siteUrl is missing', async () => {
    mockUseRuntimeConfig.mockImplementation(() => ({ public: {} }));
    const fetchMock = mockFetchOk(sampleDecoderResponse);
    globalThis.fetch = fetchMock as any;

    await toolConfig.handler({
      yearRange: '1959-1969',
      chassisNumber: 'A-A2S7L-807922A',
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/decoders/chassis');
  });
});

// ---------------------------------------------------------------------------
// Handler — response shaping
// ---------------------------------------------------------------------------
describe('Chassis Decoder MCP Tool — response shaping', () => {
  it('returns a structured result with inputs, results, context, and humanReadable sections', async () => {
    globalThis.fetch = mockFetchOk(sampleDecoderResponse) as any;
    const result = await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1-12345',
    });

    expect(result).toHaveProperty('inputs');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('humanReadable');
    expect(result).toHaveProperty('formattedText');
  });

  it('echoes yearRange and chassisNumber into the inputs block', async () => {
    globalThis.fetch = mockFetchOk(sampleDecoderResponse) as any;
    const result = await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1-12345',
    });
    expect(result.inputs.yearRange).toBe('1961-1978 (Australia)');
    expect(result.inputs.chassisNumber).toBe('YMA2S1-12345');
  });

  it('surfaces the decoded positions in results.decodedPositions', async () => {
    globalThis.fetch = mockFetchOk(sampleDecoderResponse) as any;
    const result = await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1-12345',
    });
    expect(Array.isArray(result.results.decodedPositions)).toBe(true);
    expect(result.results.decodedPositions.length).toBe(sampleDecoderResponse.decodedPositions.length);
  });

  it('formatted text contains VALID marker and pattern when isValid=true', async () => {
    globalThis.fetch = mockFetchOk(sampleDecoderResponse) as any;
    const result = await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1-12345',
    });
    expect(result.formattedText).toContain('VALID');
    expect(result.formattedText).toContain('YMA2S1####');
    expect(result.formattedText).toContain('YMA2S1-12345');
  });

  it('formatted text breaks down each decoded position', async () => {
    globalThis.fetch = mockFetchOk(sampleDecoderResponse) as any;
    const result = await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YMA2S1-12345',
    });
    // One line per decoded position, with position number and matched/unmatched marker
    for (const pos of sampleDecoderResponse.decodedPositions) {
      expect(result.humanReadable.breakdown).toContain(`Position ${pos.position}:`);
    }
  });

  it('surfaces errors from the API response when isValid=false', async () => {
    globalThis.fetch = mockFetchOk({
      ...sampleDecoderResponse,
      isValid: false,
      errors: ['Unknown Make letter at position 2'],
    }) as any;

    const result = await toolConfig.handler({
      yearRange: '1961-1978 (Australia)',
      chassisNumber: 'YZA2S1-12345',
    });

    expect(result.formattedText).toContain('INVALID');
    expect(result.formattedText).toContain('Unknown Make letter at position 2');
    expect(result.context.validationStatus).toMatch(/Invalid/i);
    expect(result.context.errors).toEqual(['Unknown Make letter at position 2']);
  });
});

// ---------------------------------------------------------------------------
// Handler — error propagation
// ---------------------------------------------------------------------------
describe('Chassis Decoder MCP Tool — error handling', () => {
  it('returns errorResult when the API responds with a non-OK status', async () => {
    globalThis.fetch = mockFetchErr(400, 'Bad Request', 'Chassis number too short') as any;
    const result = await toolConfig.handler({
      yearRange: '1959-1969',
      chassisNumber: 'A-A',
    });
    expect(mockErrorResult).toHaveBeenCalledOnce();
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/Chassis decoder API error: 400/);
    expect(result.message).toContain('Chassis number too short');
  });

  it('returns errorResult when fetch itself throws (network failure)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable')) as any;
    const result = await toolConfig.handler({
      yearRange: '1959-1969',
      chassisNumber: 'A-A2S7L-807922A',
    });
    expect(mockErrorResult).toHaveBeenCalledOnce();
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/Internal server error/);
    expect(result.message).toContain('Network unreachable');
  });
});
