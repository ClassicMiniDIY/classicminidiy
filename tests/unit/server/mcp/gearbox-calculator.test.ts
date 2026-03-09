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

import { options, kphFactor } from '~/data/models/gearing';

// ---------------------------------------------------------------------------
// Helper: import the tool config
// ---------------------------------------------------------------------------
let toolConfig: any;

beforeEach(async () => {
  vi.resetModules();
  mockJsonResult.mockClear();
  mockJsonResult.mockImplementation((data: any) => data);
  const mod = await import('~/server/mcp/tools/gearbox-calculator');
  toolConfig = mod.default;
});

// Default inputs matching the Zod defaults
const defaultInputs = {
  metric: false,
  final_drive: 3.444,
  gear_ratios: [2.583, 1.644, 1.25, 1.0],
  drop_gear: 1,
  speedo_drive: 0.3529,
  max_rpm: 6500,
  tire_type: { width: 145, profile: 80, size: 10 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Gearbox Calculator MCP Tool', () => {
  // ---- Tool metadata ----
  describe('tool configuration', () => {
    it('has a description string', () => {
      expect(typeof toolConfig.description).toBe('string');
      expect(toolConfig.description.length).toBeGreaterThan(0);
    });

    it('has an inputSchema with all expected fields', () => {
      const keys = Object.keys(toolConfig.inputSchema);
      expect(keys).toContain('metric');
      expect(keys).toContain('final_drive');
      expect(keys).toContain('gear_ratios');
      expect(keys).toContain('drop_gear');
      expect(keys).toContain('speedo_drive');
      expect(keys).toContain('max_rpm');
      expect(keys).toContain('tire_type');
    });

    it('has a handler function', () => {
      expect(typeof toolConfig.handler).toBe('function');
    });

    it('has a cache setting of 1h', () => {
      expect(toolConfig.cache).toBe('1h');
    });
  });

  // ---- Default value calculations ----
  describe('default values', () => {
    it('produces a reasonable top speed in mph (70-120 mph range)', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result.results.topSpeed).toBeGreaterThanOrEqual(70);
      expect(result.results.topSpeed).toBeLessThanOrEqual(120);
    });

    it('reports imperial units by default', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result.results.topSpeedUnit).toBe('mph');
      expect(result.results.distanceUnit).toBe('Mile');
    });
  });

  // ---- Imperial vs Metric toggle ----
  describe('imperial vs metric output', () => {
    it('reports kph when metric is true', async () => {
      const result = await toolConfig.handler({ ...defaultInputs, metric: true });
      expect(result.results.topSpeedUnit).toBe('kph');
      expect(result.results.distanceUnit).toBe('Km');
    });

    it('metric top speed is approximately kphFactor times imperial top speed', async () => {
      const imperial = await toolConfig.handler({ ...defaultInputs, metric: false });
      const metric = await toolConfig.handler({ ...defaultInputs, metric: true });
      // Because of rounding, allow a tolerance of +/- 2
      const expectedMetric = Math.round(imperial.results.topSpeed * kphFactor);
      expect(Math.abs(metric.results.topSpeed - expectedMetric)).toBeLessThanOrEqual(2);
    });

    it('all gear speeds use kph when metric is true', async () => {
      const result = await toolConfig.handler({ ...defaultInputs, metric: true });
      for (const gear of result.gearing) {
        expect(gear.unit).toBe('kph');
      }
    });

    it('all gear speeds use mph when metric is false', async () => {
      const result = await toolConfig.handler({ ...defaultInputs, metric: false });
      for (const gear of result.gearing) {
        expect(gear.unit).toBe('mph');
      }
    });
  });

  // ---- Gear output structure ----
  describe('gearing output', () => {
    it('produces exactly 4 gears', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result.gearing).toHaveLength(4);
    });

    it('gears are numbered 1 through 4', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result.gearing.map((g: any) => g.gear)).toEqual([1, 2, 3, 4]);
    });

    it('4th gear is used for top speed', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const fourthGear = result.gearing.find((g: any) => g.gear === 4);
      expect(result.results.topSpeed).toBe(fourthGear.maxSpeed);
    });

    it('each gear has ratio, totalRatio, maxSpeed, and unit', async () => {
      const result = await toolConfig.handler(defaultInputs);
      for (const gear of result.gearing) {
        expect(gear).toHaveProperty('gear');
        expect(gear).toHaveProperty('ratio');
        expect(gear).toHaveProperty('totalRatio');
        expect(gear).toHaveProperty('maxSpeed');
        expect(gear).toHaveProperty('unit');
      }
    });

    it('higher gears have higher max speeds', async () => {
      const result = await toolConfig.handler(defaultInputs);
      for (let i = 1; i < result.gearing.length; i++) {
        expect(result.gearing[i].maxSpeed).toBeGreaterThan(result.gearing[i - 1].maxSpeed);
      }
    });
  });

  // ---- Gear ratio calculations ----
  describe('gear ratio calculations', () => {
    it('total ratio equals ratio * final_drive * drop_gear', async () => {
      const result = await toolConfig.handler(defaultInputs);
      for (const gear of result.gearing) {
        const expected =
          Math.round((gear.ratio * defaultInputs.final_drive * defaultInputs.drop_gear + Number.EPSILON) * 1000) / 1000;
        expect(gear.totalRatio).toBe(expected);
      }
    });

    it('higher final drive ratio reduces top speed', async () => {
      const low = await toolConfig.handler({ ...defaultInputs, final_drive: 3.105 });
      const high = await toolConfig.handler({ ...defaultInputs, final_drive: 4.2 });
      expect(low.results.topSpeed).toBeGreaterThan(high.results.topSpeed);
    });

    it('higher max RPM increases top speed', async () => {
      const lowRpm = await toolConfig.handler({ ...defaultInputs, max_rpm: 5500 });
      const highRpm = await toolConfig.handler({ ...defaultInputs, max_rpm: 7500 });
      expect(highRpm.results.topSpeed).toBeGreaterThan(lowRpm.results.topSpeed);
    });

    it('drop gear affects total ratio', async () => {
      const standard = await toolConfig.handler({ ...defaultInputs, drop_gear: 1 });
      const overdrive = await toolConfig.handler({ ...defaultInputs, drop_gear: 0.9333 });
      // Overdrive (lower drop gear) means lower total ratio, higher top speed
      expect(overdrive.results.topSpeed).toBeGreaterThan(standard.results.topSpeed);
      expect(overdrive.gearing[0].totalRatio).toBeLessThan(standard.gearing[0].totalRatio);
    });
  });

  // ---- Tire calculations ----
  describe('tire calculations', () => {
    it('tire diameter is calculated correctly for default tire', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expectedDiameter = Math.round(145 * (80 / 100) * 2 + 10 * 25.4);
      expect(result.tireInfo.diameter).toBe(expectedDiameter);
    });

    it('tire circumference is pi times diameter', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expectedCirc = Math.round(Math.PI * result.tireInfo.diameter);
      expect(result.tireInfo.circumference).toBe(expectedCirc);
    });

    it('different tire sizes produce different top speeds', async () => {
      const small = await toolConfig.handler({
        ...defaultInputs,
        tire_type: { width: 145, profile: 80, size: 10 },
      });
      const large = await toolConfig.handler({
        ...defaultInputs,
        tire_type: { width: 195, profile: 50, size: 13 },
      });
      expect(small.results.topSpeed).not.toBe(large.results.topSpeed);
    });

    it('larger tire diameter increases top speed', async () => {
      const small = await toolConfig.handler({
        ...defaultInputs,
        tire_type: { width: 145, profile: 80, size: 10 },
      });
      const large = await toolConfig.handler({
        ...defaultInputs,
        tire_type: { width: 185, profile: 70, size: 13 },
      });
      expect(large.results.topSpeed).toBeGreaterThan(small.results.topSpeed);
    });

    it('tireInfo includes turnsPerMile', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(typeof result.tireInfo.turnsPerMile).toBe('number');
      expect(result.tireInfo.turnsPerMile).toBeGreaterThan(0);
    });
  });

  // ---- Speedometer compatibility ----
  describe('speedometer compatibility', () => {
    it('returns speedometer array for imperial mode', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(Array.isArray(result.speedometers)).toBe(true);
      expect(result.speedometers.length).toBe(options.speedos.imperial.length);
    });

    it('returns speedometer array for metric mode', async () => {
      const result = await toolConfig.handler({ ...defaultInputs, metric: true });
      expect(result.speedometers.length).toBe(options.speedos.metric.length);
    });

    it('each speedometer entry has required fields', async () => {
      const result = await toolConfig.handler(defaultInputs);
      for (const speedo of result.speedometers) {
        expect(speedo).toHaveProperty('speedometer');
        expect(speedo).toHaveProperty('turns');
        expect(speedo).toHaveProperty('speed');
        expect(speedo).toHaveProperty('expectedSpeed');
        expect(speedo).toHaveProperty('difference');
        expect(speedo).toHaveProperty('percentageDiff');
        expect(speedo).toHaveProperty('result');
      }
    });

    it('speedometer result is one of Perfect Match, Close Match, or Poor Match', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const validResults = ['Perfect Match', 'Close Match', 'Poor Match'];
      for (const speedo of result.speedometers) {
        expect(validResults).toContain(speedo.result);
      }
    });
  });

  // ---- Full output structure ----
  describe('output structure', () => {
    it('includes inputs section echoing back all inputs', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('inputs');
      expect(result.inputs.metric).toBe(false);
      expect(result.inputs.final_drive).toBe(3.444);
      expect(result.inputs.gear_ratios).toEqual([2.583, 1.644, 1.25, 1.0]);
      expect(result.inputs.drop_gear).toBe(1);
      expect(result.inputs.max_rpm).toBe(6500);
    });

    it('includes results section', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('results');
      expect(typeof result.results.topSpeed).toBe('number');
      expect(typeof result.results.engineRevsPerDistance).toBe('number');
      expect(typeof result.results.gearboxTurnsPerDistance).toBe('number');
      expect(typeof result.results.tireTurnsPerDistance).toBe('number');
    });

    it('includes gearing array', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('gearing');
      expect(Array.isArray(result.gearing)).toBe(true);
    });

    it('includes speedometers array', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('speedometers');
      expect(Array.isArray(result.speedometers)).toBe(true);
    });

    it('includes tireInfo section', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('tireInfo');
      expect(result.tireInfo).toHaveProperty('diameter');
      expect(result.tireInfo).toHaveProperty('circumference');
      expect(result.tireInfo).toHaveProperty('turnsPerMile');
    });

    it('includes context section', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('context');
      expect(typeof result.context.tireSize).toBe('string');
      expect(typeof result.context.finalDrive).toBe('string');
      expect(typeof result.context.gearRatios).toBe('string');
      expect(typeof result.context.speedoDrive).toBe('string');
    });

    it('includes formattedText string', async () => {
      const result = await toolConfig.handler(defaultInputs);
      expect(result).toHaveProperty('formattedText');
      expect(typeof result.formattedText).toBe('string');
      expect(result.formattedText).toContain('Gearbox Calculator Results');
    });
  });

  // ---- Context label matching ----
  describe('context labels from gearing options', () => {
    it('matches known tire option label for default tire', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expected = options.tires.find(
        (t) => t.value.width === 145 && t.value.profile === 80 && t.value.size === 10
      );
      expect(result.context.tireSize).toBe(expected!.label);
    });

    it('matches known diff option label for default final drive', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expected = options.diffs.find((d) => d.value === 3.444);
      expect(result.context.finalDrive).toBe(expected!.label);
    });

    it('matches known gear ratio option label for default ratios', async () => {
      const result = await toolConfig.handler(defaultInputs);
      const expected = options.gearRatios.find(
        (g) => JSON.stringify(g.value) === JSON.stringify([2.583, 1.644, 1.25, 1.0])
      );
      expect(result.context.gearRatios).toBe(expected!.label);
    });

    it('shows "(custom)" when tire does not match any known option', async () => {
      const inputs = { ...defaultInputs, tire_type: { width: 200, profile: 60, size: 15 } };
      const result = await toolConfig.handler(inputs);
      expect(result.context.tireSize).toContain('(custom)');
    });

    it('shows "(custom)" when final drive does not match any known option', async () => {
      const inputs = { ...defaultInputs, final_drive: 5.5 };
      const result = await toolConfig.handler(inputs);
      expect(result.context.finalDrive).toContain('(custom)');
    });

    it('shows "Custom gear ratios" when gear ratios do not match any known option', async () => {
      const inputs = { ...defaultInputs, gear_ratios: [3.0, 2.0, 1.5, 1.0] };
      const result = await toolConfig.handler(inputs);
      expect(result.context.gearRatios).toBe('Custom gear ratios');
    });
  });

  // ---- jsonResult invocation ----
  describe('jsonResult invocation', () => {
    it('calls jsonResult exactly once', async () => {
      await toolConfig.handler(defaultInputs);
      expect(mockJsonResult).toHaveBeenCalledTimes(1);
    });
  });
});
