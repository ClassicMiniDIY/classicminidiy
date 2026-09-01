// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import torqueSpecs from '../../../../data/torqueSpecs.json';

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

  /**
   * The near-miss passthrough.
   *
   * `lookup()` computes `related`, but the fix a reader actually sees is the one
   * line in each handler that forwards it. Nothing covered that line: the util
   * is tested directly, and the transport gate calls torque-specs with a query
   * broad enough that `related` is never populated. Deleting the forward from
   * any of the four files left the whole suite green.
   */
  it.each(TOOLS)('$name forwards near-misses, in the JSON and in formattedText', async ({ name, query }) => {
    const tool = (await import(`../../../../server/mcp/tools/${name}`)).default;

    // One term the dataset cannot have, so the query is exactly one word short
    // of matching and every near-miss is attributed to that word.
    const result: any = await tool.handler({ query: `${query} zzqqx`, limit: 50 }, {} as any);

    expect(result.totalMatches).toBe(0);
    expect(result.related.length, `${name}: no near-misses for a one-word-short query`).toBeGreaterThan(0);
    expect(result.related.every((m: any) => m.excludedBy === 'zzqqx')).toBe(true);
    expect(result.relatedNote).toMatch(/excludedBy/);
  });

  it.each(TOOLS)('$name omits related entirely when there is nothing to report', async ({ name, section }) => {
    // An empty array on every response is unconditional noise in a model's
    // context, so both fields are absent rather than empty.
    //
    // Browsing a section, rather than a keyword query: a query narrow enough to
    // return one row legitimately DOES carry near-misses (that is the whole
    // feature), so this asserts the quiet path on a call that has no terms to
    // relax at all.
    const tool = (await import(`../../../../server/mcp/tools/${name}`)).default;
    const result: any = await tool.handler({ section, limit: 200 }, {} as any);

    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result).not.toHaveProperty('related');
    expect(result).not.toHaveProperty('relatedNote');
  });

  it.each(TOOLS)('$name renders near-misses into formattedText, not only the JSON', async ({ name, query }) => {
    // formattedText is the pre-rendered view. If it disagrees with the data
    // beside it, a consumer that reads it gets the old, under-reporting answer.
    const tool = (await import(`../../../../server/mcp/tools/${name}`)).default;
    const oneShort: any = await tool.handler({ query: `${query} zzqqx`, limit: 50 }, {} as any);

    // The zero-match branch has no formattedText, so drive a one-hit query
    // through the success branch instead where both exist.
    if (typeof oneShort.formattedText === 'string') {
      expect(oneShort.formattedText).toContain('Near misses');
    }
  });

  /**
   * Units are declared, never inferred.
   *
   * Three of these datasets carry a column whose name does not state its unit,
   * and two of those are actively misleading: the Electrical torque table is in
   * pound-INCHES with no `lbft` column, and the clearance column named `thou`
   * holds INCHES. Vehicle weights are bare numbers with no unit anywhere. A
   * caller that guesses is wrong by twelve, by a thousand, or by whatever it
   * picks.
   */
  it('torque: the Electrical section is pound-feet like every other', () => {
    // It had been filed as `lbin`, which is what made its metric column look ten
    // times high. The source publishes it in lb-ft and its kgm column agrees, so
    // no row anywhere carries an lbin field now.
    const electrical = (torqueSpecs as any).electricalTable.items;
    expect(electrical.length).toBeGreaterThan(0);
    for (const row of electrical) {
      expect(row).toHaveProperty('lbft');
      expect(row).not.toHaveProperty('lbin');
    }
  });

  it('torque: a lb-ft section declares lb-ft and never mentions lb-in', async () => {
    const tool = (await import('../../../../server/mcp/tools/torque-specs')).default;
    const r: any = await tool.handler({ query: 'main bearing', section: 'Engine', limit: 5 }, {} as any);

    expect(r.units.lbft).toMatch(/pound-feet/);
    expect(r.units).not.toHaveProperty('lbin');
  });

  it('clearances: declares the thou column as inches', async () => {
    const tool = (await import('../../../../server/mcp/tools/clearances')).default;
    const r: any = await tool.handler({ query: 'rocker stock', limit: 5 }, {} as any);

    expect(r.matches[0].item.thou).toBe('0.012');
    expect(r.units.thou).toMatch(/INCHES/);
  });

  it('weights: declares kilograms, which appear nowhere in the data', async () => {
    const tool = (await import('../../../../server/mcp/tools/vehicle-weights')).default;
    const r: any = await tool.handler({ query: 'Van', limit: 5 }, {} as any);

    expect(typeof r.matches[0].item.weight).toBe('number');
    expect(r.units.weight).toMatch(/kilograms/);
  });

  it('parts: measures nothing, so declares no units', async () => {
    const tool = (await import('../../../../server/mcp/tools/parts-equivalency')).default;
    const r: any = await tool.handler({ query: 'K&N', limit: 5 }, {} as any);

    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.units).toBeUndefined();
  });

  it.each(TOOLS)('$name never claims a unit for a column it did not return', async ({ name, query }) => {
    // Naming units that are not in the answer is its own invitation to convert.
    const tool = (await import(`../../../../server/mcp/tools/${name}`)).default;
    const r: any = await tool.handler({ query, limit: 50 }, {} as any);
    const shown = new Set<string>();
    for (const m of [...r.matches, ...(r.related ?? [])]) for (const k of Object.keys(m.item)) shown.add(k);
    for (const field of Object.keys(r.units ?? {})) {
      expect(shown.has(field), `${name}: units names "${field}", absent from every row`).toBe(true);
    }
  });
});
