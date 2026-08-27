// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockJsonResult, mockErrorResult } = vi.hoisted(() => {
  const mockJsonResult = vi.fn((data: any) => data);
  const mockErrorResult = vi.fn((message: string) => ({ error: true, message }));
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = mockJsonResult;
  (globalThis as any).errorResult = mockErrorResult;
  return { mockJsonResult, mockErrorResult };
});

// The four reference-table tools are one implementation behind four datasets,
// so they are covered as a table rather than four near-identical suites. Each
// query is a real question the dataset can answer, so a wrong wiring (e.g. the
// clearances tool importing torque data) fails here rather than in production.
const TOOLS = [
  { name: 'torque-specs', query: 'main bearing', expectField: 'lbft', section: 'Engine' },
  { name: 'clearances', query: 'crankshaft endfloat', expectField: 'thou', section: 'Engine' },
  { name: 'parts-equivalency', query: 'K&N', expectField: 'part', section: 'Air Filters' },
  { name: 'vehicle-weights', query: 'van', expectField: 'weight', section: 'Curb Weights' },
];

describe('reference-table MCP tools', () => {
  beforeEach(() => {
    vi.resetModules();
    mockJsonResult.mockClear();
    mockErrorResult.mockClear();
    mockJsonResult.mockImplementation((d: any) => d);
    mockErrorResult.mockImplementation((m: string) => ({ error: true, message: m }));
  });

  it.each(TOOLS)('$name has a description and a query/section/limit schema', async ({ name }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    expect(typeof tool.description).toBe('string');
    expect(tool.description.length).toBeGreaterThan(40);
    const keys = Object.keys(tool.inputSchema);
    expect(keys).toEqual(expect.arrayContaining(['query', 'section', 'limit']));
  });

  it.each(TOOLS)('$name finds a known row for "$query"', async ({ name, query, expectField }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    const result = await tool.handler({ query, limit: 10 });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.matches[0].item).toHaveProperty(expectField);
  });

  it.each(TOOLS)('$name filters by section title', async ({ name, section }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    const result = await tool.handler({ section, limit: 200 });
    expect(result.totalMatches).toBeGreaterThan(0);
    for (const m of result.matches) expect(m.sectionTitle).toBe(section);
  });

  it.each(TOOLS)('$name returns an actionable miss rather than an error', async ({ name }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    const result = await tool.handler({ query: 'zzzz-not-a-real-part-zzzz', limit: 10 });
    expect(result.totalMatches).toBe(0);
    expect(result.matches).toEqual([]);
    expect(result.availableSections.length).toBeGreaterThan(0);
    expect(result.hint).toBeTruthy();
    expect(mockErrorResult).not.toHaveBeenCalled();
  });

  it.each(TOOLS)('$name honours limit and flags truncation', async ({ name }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    const result = await tool.handler({ limit: 2 });
    expect(result.matches.length).toBeLessThanOrEqual(2);
    if (result.totalMatches > 2) expect(result.truncated).toBe(true);
  });

  // These search a bundled object in memory; a cache round-trip would cost more
  // than the search. Asserted so re-adding one is a deliberate act.
  it.each(TOOLS)('$name declares no cache', async ({ name }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    expect(tool.cache).toBeUndefined();
  });

  // The schema's own `section` examples must be values that actually match.
  // lookup() compares exactly, and the torque/clearances section is titled
  // "Clutch & Gearbox" — an example of "Gearbox" steered a caller straight into
  // a false "no data".
  it.each(TOOLS)('$name only names section values that really exist', async ({ name }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    const describeText: string = tool.inputSchema.section.description ?? '';
    const quoted = [...describeText.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(quoted.length).toBeGreaterThan(0);

    const available = (await tool.handler({ limit: 1 })).availableSections;
    const valid = new Set([...available.map((s: any) => s.title), ...available.map((s: any) => s.section)]);
    for (const example of quoted) {
      expect(valid.has(example), `${name}: section example "${example}" matches nothing`).toBe(true);
    }
  });

  it.each(TOOLS)('$name returns rows for every section value it advertises', async ({ name }) => {
    const tool = (await import(`~/server/mcp/tools/${name}`)).default;
    const describeText: string = tool.inputSchema.section.description ?? '';
    for (const example of [...describeText.matchAll(/"([^"]+)"/g)].map((m) => m[1])) {
      const result = await tool.handler({ section: example, limit: 5 });
      expect(result.totalMatches, `${name}: section "${example}" returned nothing`).toBeGreaterThan(0);
    }
  });

  it('each tool searches its OWN dataset', async () => {
    const torque = (await import('~/server/mcp/tools/torque-specs')).default;
    const weights = (await import('~/server/mcp/tools/vehicle-weights')).default;
    const torqueSections = (await torque.handler({ limit: 1 })).availableSections.map((s: any) => s.section);
    const weightSections = (await weights.handler({ limit: 1 })).availableSections.map((s: any) => s.section);
    expect(torqueSections).toContain('engineTable');
    expect(weightSections).toContain('CurbWeights');
    expect(weightSections).not.toContain('engineTable');
  });
});
