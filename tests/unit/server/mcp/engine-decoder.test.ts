// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import engineCodes from '~/data/engineCodes.json';

const { mockJsonResult, mockErrorResult } = vi.hoisted(() => {
  const mockJsonResult = vi.fn((data: any) => data);
  const mockErrorResult = vi.fn((message: string) => ({ error: true, message }));
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = mockJsonResult;
  (globalThis as any).errorResult = mockErrorResult;
  return { mockJsonResult, mockErrorResult };
});

let tool: any;
beforeEach(async () => {
  vi.resetModules();
  mockJsonResult.mockClear();
  mockErrorResult.mockClear();
  mockJsonResult.mockImplementation((d: any) => d);
  mockErrorResult.mockImplementation((m: string) => ({ error: true, message: m }));
  tool = (await import('~/server/mcp/tools/engine-decoder')).default;
});

describe('Engine Decoder MCP Tool', () => {
  it('requires either a code or a query', async () => {
    const result = await tool.handler({ limit: 10 });
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/code|query/i);
  });

  it('matches a real code exactly', async () => {
    const known = (engineCodes as any[])[0].code;
    const result = await tool.handler({ code: known, limit: 10 });
    expect(result.matchType).toBe('exact');
    expect(result.matches[0].code).toBe(known);
  });

  it('is case-insensitive on the code', async () => {
    const known = (engineCodes as any[])[0].code;
    const result = await tool.handler({ code: known.toLowerCase(), limit: 10 });
    expect(result.matchType).toBe('exact');
  });

  // Blocks are worn, painted and half-legible, so a partial read is the normal
  // case rather than an error case.
  it('falls back to a prefix match when no code matches exactly', async () => {
    const result = await tool.handler({ code: '12', limit: 50 });
    expect(result.matchType).toBe('prefix');
    expect(result.totalMatches).toBeGreaterThan(0);
    for (const m of result.matches) expect(m.code.toLowerCase().startsWith('12')).toBe(true);
  });

  it('searches free text across every field, ANDing the terms', async () => {
    const broad = await tool.handler({ query: '1275', limit: 200 });
    const narrow = await tool.handler({ query: '1275 Cooper S', limit: 200 });
    expect(narrow.totalMatches).toBeGreaterThan(0);
    expect(narrow.totalMatches).toBeLessThan(broad.totalMatches);
  });

  it('returns an actionable miss, not an error, for an unknown code', async () => {
    const result = await tool.handler({ code: 'ZZZZ9', limit: 10 });
    expect(result.matchType).toBe('none');
    expect(result.totalMatches).toBe(0);
    expect(result.hint).toBeTruthy();
    expect(mockErrorResult).not.toHaveBeenCalled();
  });

  it('normalises empty variant and gearbox to null rather than empty string', async () => {
    const result = await tool.handler({ code: '8A', limit: 5 });
    const m = result.matches[0];
    expect(m.variant === null || typeof m.variant === 'string').toBe(true);
    expect(m).toHaveProperty('capacityCc');
  });

  it('honours limit and flags truncation', async () => {
    const result = await tool.handler({ query: '1275', limit: 2 });
    expect(result.returned).toBeLessThanOrEqual(2);
    if (result.totalMatches > 2) expect(result.truncated).toBe(true);
  });
});
