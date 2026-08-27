// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import needlesData from '~/data/needles.json';
import { compareNeedles } from '~/app/composables/useNeedleCompare';

const { mockJsonResult, mockErrorResult } = vi.hoisted(() => {
  const mockJsonResult = vi.fn((data: any) => data);
  const mockErrorResult = vi.fn((message: string) => ({ error: true, message }));
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = mockJsonResult;
  (globalThis as any).errorResult = mockErrorResult;
  return { mockJsonResult, mockErrorResult };
});

const needles = needlesData as any[];
let tool: any;

beforeEach(async () => {
  vi.resetModules();
  mockJsonResult.mockClear();
  mockErrorResult.mockClear();
  mockJsonResult.mockImplementation((d: any) => d);
  mockErrorResult.mockImplementation((m: string) => ({ error: true, message: m }));
  tool = (await import('~/server/mcp/tools/needle-compare')).default;
});

describe('SU Needle MCP Tool', () => {
  it('rejects an unknown needle with a usable message', async () => {
    const result = await tool.handler({ mode: 'lookup', needle: 'NOT-A-NEEDLE', limit: 10 });
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/Unknown needle/i);
  });

  describe('lookup', () => {
    it('returns the profile and band averages for a known needle', async () => {
      const result = await tool.handler({ mode: 'lookup', needle: 'AAA', limit: 10 });
      expect(result.needle.name).toBe('AAA');
      expect(result.stations).toHaveLength(16);
      const { low, mid, high } = result.needle.bandAverages;
      for (const v of [low, mid, high]) expect(typeof v).toBe('number');
    });

    it('rounds band averages instead of emitting float noise', async () => {
      const result = await tool.handler({ mode: 'lookup', needle: 'AAA', limit: 10 });
      for (const v of Object.values(result.needle.bandAverages) as number[]) {
        expect(String(v).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
      }
    });

    it('matches a needle name case-insensitively', async () => {
      const result = await tool.handler({ mode: 'lookup', needle: 'aaa', limit: 10 });
      expect(result.needle.name).toBe('AAA');
    });
  });

  describe('compare', () => {
    it('requires the second needle', async () => {
      const result = await tool.handler({ mode: 'compare', needle: 'AAA', limit: 10 });
      expect(result.error).toBe(true);
      expect(result.message).toMatch(/against/i);
    });

    // The tool must not re-implement the comparison the site uses — that fork is
    // exactly what this whole line of work removed from the gearbox tool.
    it('agrees with useNeedleCompare directly', async () => {
      const result = await tool.handler({ mode: 'compare', needle: 'AAA', against: 'ABB', limit: 10 });
      const reference = needles.find((n) => n.name === 'AAA');
      const candidate = needles.find((n) => n.name === 'ABB');
      const direct = compareNeedles(reference, candidate);

      expect(result.uniformlyRicher).toBe(direct.uniformlyRicher);
      expect(result.uniformlyLeaner).toBe(direct.uniformlyLeaner);
      expect(result.sameSize).toBe(direct.sameSize);
      expect(result.bands).toEqual(direct.bands);
    });

    it('reports a band-by-band breakdown', async () => {
      const result = await tool.handler({ mode: 'compare', needle: 'AAA', against: 'ABB', limit: 10 });
      for (const band of ['low', 'mid', 'high']) expect(result.bands).toHaveProperty(band);
      expect(result.formattedText).toMatch(/Low|Mid|High/);
    });
  });

  describe('find', () => {
    it('returns needles richer in the low band, ranked', async () => {
      const result = await tool.handler({
        mode: 'find',
        needle: 'AAA',
        direction: 'richer',
        band: 'low',
        limit: 5,
      });
      expect(result.totalMatches).toBeGreaterThan(0);
      expect(result.matches.length).toBeLessThanOrEqual(5);
      const scores = result.matches.map((m: any) => m.score);
      expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    });

    it('defaults to same-size candidates, since another size will not suit the jet', async () => {
      const result = await tool.handler({ mode: 'find', needle: 'AAA', direction: 'richer', limit: 10 });
      expect(result.criteria.sameSizeOnly).toBe(true);
      for (const m of result.matches) expect(m.sameSize).toBe(true);
    });

    it('never returns the reference needle as its own match', async () => {
      const result = await tool.handler({ mode: 'find', needle: 'AAA', direction: 'richer', limit: 20 });
      expect(result.matches.map((m: any) => m.name)).not.toContain('AAA');
    });

    it('gives an actionable hint when nothing matches', async () => {
      const result = await tool.handler({
        mode: 'find',
        needle: 'AAA',
        direction: 'similar',
        band: 'low',
        sameSizeOnly: true,
        isolateBand: true,
        limit: 5,
      });
      if (result.totalMatches === 0) expect(result.hint).toBeTruthy();
      else expect(result.matches.length).toBeGreaterThan(0);
    });

    it('echoes the criteria it actually applied', async () => {
      const result = await tool.handler({
        mode: 'find',
        needle: 'AAA',
        direction: 'leaner',
        band: 'high',
        limit: 3,
      });
      expect(result.criteria).toMatchObject({ direction: 'leaner', band: 'high' });
    });
  });
});
