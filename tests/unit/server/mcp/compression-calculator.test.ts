// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Nitro/MCP globals before importing the tool
// ---------------------------------------------------------------------------
const { mockJsonResult } = vi.hoisted(() => {
  const mockJsonResult = vi.fn((data: any) => data);
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = mockJsonResult;
  return { mockJsonResult };
});

import { formOptions } from '~/data/models/compression';

// ---------------------------------------------------------------------------
// Helper: import the tool config and provide a typed handler shortcut
// ---------------------------------------------------------------------------
let toolConfig: any;

beforeEach(async () => {
  vi.resetModules();
  mockJsonResult.mockClear();
  mockJsonResult.mockImplementation((data: any) => data);
  const mod = await import('~/server/mcp/tools/compression-calculator');
  toolConfig = mod.default;
});

// Default inputs matching the Zod defaults
const defaultInputs = {
  bore: 7.06,
  stroke: 8.128,
  pistonDish: 6.5,
  headVolume: 25.5,
  deckHeight: 20,
  gasket: 3.4,
  customGasket: 0.1,
  decomp: 0,
};

// ---------------------------------------------------------------------------
// Helper math functions that mirror the source implementation
// ---------------------------------------------------------------------------
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calcExpected(inputs: typeof defaultInputs) {
  const pi = Math.PI;
  const boreRadius = inputs.bore / 2;
  const deck = inputs.deckHeight * 0.0254;
  const deckVolume = boreRadius * boreRadius * (deck / 10) * pi;
  const ringland = inputs.bore * 0.047619;
  const gasketVolume = inputs.gasket === 0 ? inputs.customGasket : inputs.gasket;
  const vc = inputs.pistonDish + gasketVolume + inputs.headVolume + deckVolume + ringland + inputs.decomp;
  const ratio = round2((inputs.stroke * boreRadius * boreRadius * pi + vc) / vc);
  const capacity = round2(inputs.stroke * boreRadius * boreRadius * pi * 4);
  return { ratio, capacity, vc: round2(vc), boreRadius, deckVolume: round2(deckVolume), ringland: round2(ringland) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Compression Calculator MCP Tool', () => {
  // ---- Tool metadata ----
  describe('tool configuration', () => {
    it('has a description string', () => {
      expect(typeof toolConfig.description).toBe('string');
      expect(toolConfig.description.length).toBeGreaterThan(0);
    });

    it('has an inputSchema with all expected fields', () => {
      const keys = Object.keys(toolConfig.inputSchema);
      expect(keys).toContain('bore');
      expect(keys).toContain('stroke');
      expect(keys).toContain('pistonDish');
      expect(keys).toContain('headVolume');
      expect(keys).toContain('deckHeight');
      expect(keys).toContain('gasket');
      expect(keys).toContain('customGasket');
      expect(keys).toContain('decomp');
    });

    it('has a handler function', () => {
      expect(typeof toolConfig.handler).toBe('function');
    });

    it('has a cache setting of 1h', () => {
      expect(toolConfig.cache).toBe('1h');
    });
  });

  // ---- Default value calculations ----
  describe('default values (stock 1275)', () => {
    it('produces a valid compression ratio in the 9-10:1 range', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result.results.compressionRatio).toBeGreaterThanOrEqual(9);
      expect(result.results.compressionRatio).toBeLessThanOrEqual(10);
    });

    it('produces engine capacity close to 1275cc', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result.results.engineCapacity).toBeGreaterThan(1270);
      expect(result.results.engineCapacity).toBeLessThan(1280);
    });

    it('matches the expected mathematical result for ratio', async () => {
      const expected = calcExpected(defaultInputs);
      const result = await toolConfig.handler(defaultInputs);
      expect(result.results.compressionRatio).toBe(expected.ratio);
    });

    it('matches the expected mathematical result for capacity', async () => {
      const expected = calcExpected(defaultInputs);
      const result = await toolConfig.handler(defaultInputs);
      expect(result.results.engineCapacity).toBe(expected.capacity);
    });
  });

  // ---- Gasket selection logic ----
  describe('gasket volume selection', () => {
    it('uses customGasket when gasket is 0', async () => {
      const inputs = { ...defaultInputs, gasket: 0, customGasket: 4.2 };
      const result = await toolConfig.handler(inputs);
      expect(result.inputs.gasket).toBe(4.2);
    });

    it('uses gasket value when gasket is not 0', async () => {
      const inputs = { ...defaultInputs, gasket: 2.8, customGasket: 99 };
      const result = await toolConfig.handler(inputs);
      expect(result.inputs.gasket).toBe(2.8);
    });

    it('different gasket volumes produce different compression ratios', async () => {
      const result1 = await toolConfig.handler({ ...defaultInputs, gasket: 2.4 });
      const result2 = await toolConfig.handler({ ...defaultInputs, gasket: 3.4 });
      expect(result1.results.compressionRatio).not.toBe(result2.results.compressionRatio);
    });
  });

  // ---- Bore variations and capacity ----
  describe('bore variations', () => {
    it('850cc bore produces capacity near 850cc', async () => {
      const inputs = { ...defaultInputs, bore: 6.29, stroke: 6.826, gasket: 2.4 };
      const result = await toolConfig.handler(inputs);
      expect(result.results.engineCapacity).toBeGreaterThan(840);
      expect(result.results.engineCapacity).toBeLessThan(860);
    });

    it('998cc bore/stroke produces capacity near 998cc', async () => {
      const inputs = { ...defaultInputs, bore: 6.457, stroke: 7.62, gasket: 2.8 };
      const result = await toolConfig.handler(inputs);
      expect(result.results.engineCapacity).toBeGreaterThan(990);
      expect(result.results.engineCapacity).toBeLessThan(1010);
    });

    it('larger bore increases engine capacity', async () => {
      const small = await toolConfig.handler({ ...defaultInputs, bore: 7.06 });
      const large = await toolConfig.handler({ ...defaultInputs, bore: 7.4 });
      expect(large.results.engineCapacity).toBeGreaterThan(small.results.engineCapacity);
    });
  });

  // ---- Stroke variations ----
  describe('stroke variations', () => {
    it('longer stroke increases engine capacity', async () => {
      const short = await toolConfig.handler({ ...defaultInputs, stroke: 6.826 });
      const long = await toolConfig.handler({ ...defaultInputs, stroke: 8.128 });
      expect(long.results.engineCapacity).toBeGreaterThan(short.results.engineCapacity);
    });

    it('longer stroke increases compression ratio (all else equal)', async () => {
      const short = await toolConfig.handler({ ...defaultInputs, stroke: 6.826 });
      const long = await toolConfig.handler({ ...defaultInputs, stroke: 8.128 });
      expect(long.results.compressionRatio).toBeGreaterThan(short.results.compressionRatio);
    });
  });

  // ---- Decompression plate ----
  describe('decompression plate effect', () => {
    it('zero decomp produces higher ratio than non-zero decomp', async () => {
      const noDecomp = await toolConfig.handler({ ...defaultInputs, decomp: 0 });
      const withDecomp = await toolConfig.handler({ ...defaultInputs, decomp: 5.8 });
      expect(noDecomp.results.compressionRatio).toBeGreaterThan(withDecomp.results.compressionRatio);
    });

    it('larger decomp plate reduces compression ratio further', async () => {
      const small = await toolConfig.handler({ ...defaultInputs, decomp: 5.8 });
      const large = await toolConfig.handler({ ...defaultInputs, decomp: 12.4 });
      expect(small.results.compressionRatio).toBeGreaterThan(large.results.compressionRatio);
    });

    it('decomp plate does not change engine capacity', async () => {
      const noDecomp = await toolConfig.handler({ ...defaultInputs, decomp: 0 });
      const withDecomp = await toolConfig.handler({ ...defaultInputs, decomp: 8.8 });
      expect(noDecomp.results.engineCapacity).toBe(withDecomp.results.engineCapacity);
    });
  });

  // ---- Head volume effect ----
  describe('head volume effect', () => {
    it('higher head volume reduces compression ratio', async () => {
      const small = await toolConfig.handler({ ...defaultInputs, headVolume: 22 });
      const large = await toolConfig.handler({ ...defaultInputs, headVolume: 30 });
      expect(small.results.compressionRatio).toBeGreaterThan(large.results.compressionRatio);
    });
  });

  // ---- Output structure ----
  describe('output structure', () => {
    it('includes inputs section', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('inputs');
      expect(result.inputs).toHaveProperty('bore', 7.06);
      expect(result.inputs).toHaveProperty('stroke', 8.128);
      expect(result.inputs).toHaveProperty('pistonDish', 6.5);
      expect(result.inputs).toHaveProperty('headVolume', 25.5);
      expect(result.inputs).toHaveProperty('deckHeight', 20);
      expect(result.inputs).toHaveProperty('decomp', 0);
    });

    it('includes results section with ratio, capacity, and chamber volume', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('results');
      expect(typeof result.results.compressionRatio).toBe('number');
      expect(typeof result.results.engineCapacity).toBe('number');
      expect(typeof result.results.combustionChamberVolume).toBe('number');
    });

    it('includes context section', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('context');
      expect(typeof result.context.pistonSize).toBe('string');
      expect(typeof result.context.crankshaft).toBe('string');
      expect(typeof result.context.headGasket).toBe('string');
      expect(typeof result.context.decompPlate).toBe('string');
    });

    it('includes calculations section', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('calculations');
      expect(typeof result.calculations.boreRadius).toBe('number');
      expect(typeof result.calculations.deckVolume).toBe('number');
      expect(typeof result.calculations.ringlandVolume).toBe('number');
      expect(typeof result.calculations.totalCombustionChamberVolume).toBe('number');
    });

    it('includes formattedText string', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('formattedText');
      expect(typeof result.formattedText).toBe('string');
      expect(result.formattedText).toContain('Compression Calculator Results');
    });
  });

  // ---- Context label matching ----
  describe('context labels from formOptions', () => {
    it('matches known piston option label for default bore', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expected = formOptions.pistonOptions.find((p) => p.value === 7.06);
      expect(result.context.pistonSize).toBe(expected!.label);
    });

    it('matches known crankshaft option label for default stroke', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expected = formOptions.crankshaftOptions.find((c) => c.value === 8.128);
      expect(result.context.crankshaft).toBe(expected!.label);
    });

    it('matches known gasket option label for default gasket', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expected = formOptions.headGasketOptions.find((g) => g.value === 3.4);
      expect(result.context.headGasket).toBe(expected!.label);
    });

    it('matches known decomp option label for zero decomp', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expected = formOptions.decompPlateOptions.find((d) => d.value === 0);
      expect(result.context.decompPlate).toBe(expected!.label);
    });

    it('shows "(custom)" when bore does not match any known option', async () => {
      const inputs = { ...defaultInputs, bore: 7.123 };
      const result = await toolConfig.handler(inputs);
      expect(result.context.pistonSize).toContain('(custom)');
    });

    it('shows "(custom)" when stroke does not match any known option', async () => {
      const inputs = { ...defaultInputs, stroke: 9.0 };
      const result = await toolConfig.handler(inputs);
      expect(result.context.crankshaft).toContain('(custom)');
    });
  });

  // ---- Math precision ----
  describe('math precision', () => {
    it('compression ratio is rounded to 2 decimal places', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const ratioStr = result.results.compressionRatio.toString();
      const decimalPart = ratioStr.split('.')[1] || '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    });

    it('engine capacity is rounded to 2 decimal places', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const capStr = result.results.engineCapacity.toString();
      const decimalPart = capStr.split('.')[1] || '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    });

    it('combustion chamber volume is rounded to 2 decimal places', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const vcStr = result.results.combustionChamberVolume.toString();
      const decimalPart = vcStr.split('.')[1] || '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    });
  });

  // ---- jsonResult is called ----
  describe('jsonResult invocation', () => {
    it('calls jsonResult exactly once', async () => {
      await toolConfig.handler(defaultInputs);
      expect(mockJsonResult).toHaveBeenCalledTimes(1);
    });

    it('passes an object with inputs, results, context, calculations, and formattedText', async () => {
      await toolConfig.handler(defaultInputs);
      const callArg = mockJsonResult.mock.calls[0][0];
      expect(callArg).toHaveProperty('inputs');
      expect(callArg).toHaveProperty('results');
      expect(callArg).toHaveProperty('context');
      expect(callArg).toHaveProperty('calculations');
      expect(callArg).toHaveProperty('formattedText');
    });
  });
});
