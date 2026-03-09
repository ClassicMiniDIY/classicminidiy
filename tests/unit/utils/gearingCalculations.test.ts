import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateTire,
  calculateGearingTable,
  calculateSpeedoData,
  calculateSpeedometerTable,
  calculateChartData,
} from '~/app/utils/gearingCalculations';
import type { TireCalculationResult, GearingTableRow, ChartSeriesData } from '~/app/utils/gearingCalculations';
import type { TireValue, ISpeedometer } from '~/data/models/gearing';
import { kphFactor } from '~/data/models/gearing';

// ---------------------------------------------------------------------------
// Shared fixtures used across multiple describe blocks
// ---------------------------------------------------------------------------

/**
 * Standard 145/80r10 tire (Classic Mini 10" wheel).
 *
 * Hand-computed expectations:
 *   diameter        = Math.round(145 * 0.80 * 2 + 10 * 25.4) = Math.round(486) = 486 mm
 *   circ            = Math.round(3.14159 * 486)               = Math.round(1526.81) = 1527 mm
 *   tireTurnsPerMile= Math.round(1760 / (1527 / 914.4))       = Math.round(1053.9)  = 1054
 *   typeCircInMiles = 1527 / (1760 * 914.4)                   ≈ 0.00094887
 */
const STANDARD_TIRE: TireValue = { width: 145, profile: 80, size: 10 };

/**
 * Hoosier specialty tire with an explicit diameter (no width/profile calculation).
 *
 *   diameter        = 477.52 mm (passed directly)
 *   circ            = Math.round(3.14159 * 477.52) = Math.round(1499.87) = 1500 mm
 *   tireTurnsPerMile= Math.round(1760 / (1500 / 914.4))       = Math.round(1073.0) = 1073
 *   typeCircInMiles = 1500 / (1760 * 914.4)                   ≈ 0.00093199
 */
const HOOSIER_TIRE: TireValue = { width: 5.2, profile: 0, size: 10, diameter: 477.52 };

/**
 * MKI/II Cooper gear ratios - a realistic 4-speed set.
 */
const GEAR_RATIOS = [3.627, 2.172, 1.412, 1.0] as const;
const FINAL_DRIVE = 3.444;
const DROP_GEAR_STANDARD = 1.0;
const MAX_RPM = 7000;

// Pre-calculate the typeCircInMiles for the standard tire so we can reuse it.
// 1527 / (1760 * 914.4)
const STANDARD_TIRE_CIRC_IN_MILES = 1527 / (1760 * 914.4);

// ---------------------------------------------------------------------------
// calculateTire
// ---------------------------------------------------------------------------
describe('calculateTire', () => {
  describe('standard tire derived from width, profile, and size', () => {
    let result: TireCalculationResult;

    // We call once and share across these assertions.
    beforeEach(() => {
      result = calculateTire(STANDARD_TIRE);
    });

    it('passes width, profile, and size through unchanged', () => {
      expect(result.width).toBe(145);
      expect(result.profile).toBe(80);
      expect(result.size).toBe(10);
    });

    it('calculates diameter as 486 mm', () => {
      // Math.round(145 * (80/100) * 2 + 10 * 25.4) = Math.round(232 + 254) = 486
      expect(result.diameter).toBe(486);
    });

    it('calculates circumference as 1527 mm', () => {
      // Math.round(3.14159 * 486) = Math.round(1526.81...) = 1527
      expect(result.circ).toBe(1527);
    });

    it('calculates tireTurnsPerMile as 1054', () => {
      // Math.round(1760 / (1527 / 914.4)) = Math.round(1760 / 1.67001...) = Math.round(1053.9...) = 1054
      expect(result.tireTurnsPerMile).toBe(1054);
    });

    it('calculates typeCircInMiles as a positive fraction less than 0.01', () => {
      // 1527 / (1760 * 914.4) ≈ 0.000949
      expect(result.typeCircInMiles).toBeGreaterThan(0);
      expect(result.typeCircInMiles).toBeLessThan(0.01);
      expect(result.typeCircInMiles).toBeCloseTo(STANDARD_TIRE_CIRC_IN_MILES, 10);
    });

    it('tireTurnsPerMile is the reciprocal relationship to typeCircInMiles within rounding error', () => {
      // tireTurnsPerMile ≈ 1 / typeCircInMiles (both derived from circumference)
      const reconstructed = 1 / result.typeCircInMiles;
      expect(result.tireTurnsPerMile).toBeCloseTo(reconstructed, -1); // within ~5%
    });
  });

  describe('specialty tire with explicit diameter (Hoosier)', () => {
    let result: TireCalculationResult;

    beforeEach(() => {
      result = calculateTire(HOOSIER_TIRE);
    });

    it('uses the provided diameter directly without recalculating', () => {
      // diameter = 477.52, not derived from width/profile/size
      expect(result.diameter).toBe(477.52);
    });

    it('calculates circumference as 1500 mm', () => {
      // Math.round(3.14159 * 477.52) = Math.round(1499.87...) = 1500
      expect(result.circ).toBe(1500);
    });

    it('calculates tireTurnsPerMile as 1073', () => {
      // Math.round(1760 / (1500 / 914.4)) = Math.round(1760 / 1.64021...) = Math.round(1073.0...) = 1073
      expect(result.tireTurnsPerMile).toBe(1073);
    });

    it('calculates typeCircInMiles as a positive fraction', () => {
      // 1500 / (1760 * 914.4) ≈ 0.000932
      expect(result.typeCircInMiles).toBeGreaterThan(0);
      expect(result.typeCircInMiles).toBeLessThan(0.01);
    });

    it('passes through width, profile, and size from the input', () => {
      expect(result.width).toBe(5.2);
      expect(result.profile).toBe(0);
      expect(result.size).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('treats a 0 diameter as falsy and falls back to width/profile/size calculation', () => {
      // diameter: 0 is falsy, so the function must derive from w/p/s
      const tire: TireValue = { width: 145, profile: 80, size: 10, diameter: 0 };
      const result = calculateTire(tire);
      // Should match standard tire computed result
      expect(result.diameter).toBe(486);
    });

    it('returns a result object with all expected keys', () => {
      const result = calculateTire(STANDARD_TIRE);
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('profile');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('diameter');
      expect(result).toHaveProperty('circ');
      expect(result).toHaveProperty('tireTurnsPerMile');
      expect(result).toHaveProperty('typeCircInMiles');
    });

    it('produces integer values for diameter, circ, and tireTurnsPerMile', () => {
      const result = calculateTire(STANDARD_TIRE);
      expect(Number.isInteger(result.diameter)).toBe(true);
      expect(Number.isInteger(result.circ)).toBe(true);
      expect(Number.isInteger(result.tireTurnsPerMile)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// calculateGearingTable
// ---------------------------------------------------------------------------
describe('calculateGearingTable', () => {
  describe('imperial mode (metric = false)', () => {
    let rows: GearingTableRow[];

    beforeEach(() => {
      rows = calculateGearingTable(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
    });

    it('returns one row per gear ratio', () => {
      expect(rows).toHaveLength(GEAR_RATIOS.length);
    });

    it('numbers gears starting at 1', () => {
      expect(rows[0].gear).toBe(1);
      expect(rows[1].gear).toBe(2);
      expect(rows[2].gear).toBe(3);
      expect(rows[3].gear).toBe(4);
    });

    it('preserves the original ratio on each row', () => {
      rows.forEach((row, i) => {
        expect(row.ratio).toBe(GEAR_RATIOS[i]);
      });
    });

    it('formats maxSpeed with mph suffix', () => {
      for (const row of rows) {
        expect(row.maxSpeed).toMatch(/^\d+mph$/);
      }
    });

    it('maxSpeedRaw equals the numeric value embedded in maxSpeed', () => {
      for (const row of rows) {
        const numeric = parseInt(row.maxSpeed.replace('mph', ''), 10);
        expect(row.maxSpeedRaw).toBe(numeric);
      }
    });

    it('calculates 1st gear max speed as 32 mph at 7000 rpm', () => {
      // (7000 / 1.0 / 3.627 / 3.444) * typeCircInMiles * 60 ≈ 31.91 → 32
      expect(rows[0].maxSpeedRaw).toBe(32);
      expect(rows[0].maxSpeed).toBe('32mph');
    });

    it('calculates 2nd gear max speed as 53 mph at 7000 rpm', () => {
      // (7000 / 1.0 / 2.172 / 3.444) * typeCircInMiles * 60 ≈ 53.27 → 53
      expect(rows[1].maxSpeedRaw).toBe(53);
      expect(rows[1].maxSpeed).toBe('53mph');
    });

    it('calculates 3rd gear max speed as 82 mph at 7000 rpm', () => {
      // (7000 / 1.0 / 1.412 / 3.444) * typeCircInMiles * 60 ≈ 81.93 → 82
      expect(rows[2].maxSpeedRaw).toBe(82);
      expect(rows[2].maxSpeed).toBe('82mph');
    });

    it('calculates 4th gear max speed as 116 mph at 7000 rpm', () => {
      // (7000 / 1.0 / 1.0 / 3.444) * typeCircInMiles * 60 ≈ 115.71 → 116
      expect(rows[3].maxSpeedRaw).toBe(116);
      expect(rows[3].maxSpeed).toBe('116mph');
    });

    it('max speed increases with each gear (lower ratio = higher top speed)', () => {
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].maxSpeedRaw).toBeGreaterThan(rows[i - 1].maxSpeedRaw);
      }
    });
  });

  describe('metric mode (metric = true)', () => {
    let rows: GearingTableRow[];

    beforeEach(() => {
      rows = calculateGearingTable(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        true
      );
    });

    it('formats maxSpeed with km/h suffix', () => {
      for (const row of rows) {
        expect(row.maxSpeed).toMatch(/^\d+km\/h$/);
      }
    });

    it('maxSpeedRaw equals the numeric value embedded in maxSpeed', () => {
      for (const row of rows) {
        const numeric = parseInt(row.maxSpeed.replace('km/h', ''), 10);
        expect(row.maxSpeedRaw).toBe(numeric);
      }
    });

    it('calculates 1st gear max speed as 51 km/h', () => {
      // 32 mph * 1.60934 = 51.50 → but Math.round(Math.round(mph) * kphFactor) = Math.round(32 * 1.60934) = 51
      expect(rows[0].maxSpeedRaw).toBe(51);
      expect(rows[0].maxSpeed).toBe('51km/h');
    });

    it('calculates 4th gear max speed as 187 km/h', () => {
      // 116 mph * 1.60934 = 186.68 → 187
      expect(rows[3].maxSpeedRaw).toBe(187);
      expect(rows[3].maxSpeed).toBe('187km/h');
    });

    it('metric values are consistently larger than imperial by approximately kphFactor', () => {
      const imperialRows = calculateGearingTable(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      for (let i = 0; i < rows.length; i++) {
        const ratio = rows[i].maxSpeedRaw / imperialRows[i].maxSpeedRaw;
        expect(ratio).toBeCloseTo(kphFactor, 0);
      }
    });
  });

  describe('drop gear influence', () => {
    it('overdrive drop gear produces higher max speeds than 1:1', () => {
      // Drop gear < 1.0 means dividing by a smaller number → higher speed
      const overdrive = calculateGearingTable(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        0.9333, // overdrive (< 1.0)
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      const standard = calculateGearingTable(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      for (let i = 0; i < standard.length; i++) {
        expect(overdrive[i].maxSpeedRaw).toBeGreaterThanOrEqual(standard[i].maxSpeedRaw);
      }
    });
  });

  describe('rpm influence', () => {
    it('higher maxRpm produces proportionally higher top speeds', () => {
      const low = calculateGearingTable(
        [1.0],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        6000,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      const high = calculateGearingTable(
        [1.0],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        9000,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(high[0].maxSpeedRaw).toBeGreaterThan(low[0].maxSpeedRaw);
    });
  });
});

// ---------------------------------------------------------------------------
// calculateSpeedoData
// ---------------------------------------------------------------------------
describe('calculateSpeedoData', () => {
  // Inputs: tireTurnsPerMile=1054, finalDrive=3.444, speedoDrive=0.3529, dropGear=1.0
  //
  // turnsPerMile    = Math.round(1054 * 3.444 * 0.3529)
  //                 = Math.round(1054 * 1.21558...) = Math.round(1281.2...) = 1281
  //
  // engineRevsMile  = Math.round(1054 * 3.444 * 1.0)
  //                 = Math.round(3629.97...) = 3630

  it('calculates turnsPerMile correctly', () => {
    const { turnsPerMile } = calculateSpeedoData(1054, 3.444, 0.3529, 1.0);
    expect(turnsPerMile).toBe(1281);
  });

  it('calculates engineRevsMile correctly', () => {
    const { engineRevsMile } = calculateSpeedoData(1054, 3.444, 0.3529, 1.0);
    expect(engineRevsMile).toBe(3630);
  });

  it('returns an object with turnsPerMile and engineRevsMile keys', () => {
    const result = calculateSpeedoData(1054, 3.444, 0.3529, 1.0);
    expect(result).toHaveProperty('turnsPerMile');
    expect(result).toHaveProperty('engineRevsMile');
  });

  it('turnsPerMile and engineRevsMile are integers', () => {
    const result = calculateSpeedoData(1054, 3.444, 0.3529, 1.0);
    expect(Number.isInteger(result.turnsPerMile)).toBe(true);
    expect(Number.isInteger(result.engineRevsMile)).toBe(true);
  });

  it('turnsPerMile scales linearly with the speedo drive ratio', () => {
    const base = calculateSpeedoData(1000, 3.444, 0.3529, 1.0);
    const doubled = calculateSpeedoData(1000, 3.444, 0.3529 * 2, 1.0);
    // Doubling speedoDrive should approximately double turnsPerMile (within rounding)
    expect(doubled.turnsPerMile).toBeCloseTo(base.turnsPerMile * 2, -1);
  });

  it('engineRevsMile is independent of the speedo drive ratio', () => {
    const a = calculateSpeedoData(1000, 3.444, 0.3, 1.0);
    const b = calculateSpeedoData(1000, 3.444, 0.5, 1.0);
    // speedoDrive does not affect engineRevsMile
    expect(a.engineRevsMile).toBe(b.engineRevsMile);
  });

  it('engineRevsMile scales with dropGear', () => {
    const standard = calculateSpeedoData(1000, 3.444, 0.3529, 1.0);
    const overdrive = calculateSpeedoData(1000, 3.444, 0.3529, 0.9333);
    expect(overdrive.engineRevsMile).toBeLessThan(standard.engineRevsMile);
  });

  it('both results are positive for realistic inputs', () => {
    const result = calculateSpeedoData(1054, 3.444, 0.3529, 1.0);
    expect(result.turnsPerMile).toBeGreaterThan(0);
    expect(result.engineRevsMile).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// calculateSpeedometerTable
// ---------------------------------------------------------------------------
describe('calculateSpeedometerTable', () => {
  describe('over-reading speedometer', () => {
    // variation = Math.round((1440 / 1000) * 100 * 1) = Math.round(144) = 144
    // 144 > 100 → status='text-red', result='Over 44%'
    const speedometers: ISpeedometer[] = [{ name: 'Smiths - Generic', turns: 1000, speed: 100 }];

    it('detects over-reading and returns text-red status', () => {
      const rows = calculateSpeedometerTable(speedometers, 1440, 1.0, false);
      expect(rows[0].status).toBe('text-red');
    });

    it('returns the correct over-reading percentage in the result string', () => {
      const rows = calculateSpeedometerTable(speedometers, 1440, 1.0, false);
      expect(rows[0].result).toBe('Over 44%');
    });

    it('result string starts with "Over"', () => {
      const rows = calculateSpeedometerTable(speedometers, 1440, 1.0, false);
      expect(rows[0].result).toMatch(/^Over \d+%$/);
    });
  });

  describe('exact-reading speedometer', () => {
    // variation = Math.round((1280 / 1280) * 100 * 1) = Math.round(100) = 100
    // 100 === 100 → status='text-green', result='Reads correctly!'
    const speedometers: ISpeedometer[] = [{ name: 'Cooper S Smiths central', turns: 1280, speed: 120 }];

    it('detects exact match and returns text-green status', () => {
      const rows = calculateSpeedometerTable(speedometers, 1280, 1.0, false);
      expect(rows[0].status).toBe('text-green');
    });

    it('returns "Reads correctly!" for an exact match', () => {
      const rows = calculateSpeedometerTable(speedometers, 1280, 1.0, false);
      expect(rows[0].result).toBe('Reads correctly!');
    });
  });

  describe('under-reading speedometer', () => {
    // variation = Math.round((1000 / 1440) * 100 * 1) = Math.round(69.44...) = 69
    // 69 < 100 → status='text-primary', result='Under 31%'
    const speedometers: ISpeedometer[] = [{ name: 'Metro Aftermarket', turns: 1440, speed: 100 }];

    it('detects under-reading and returns text-primary status', () => {
      const rows = calculateSpeedometerTable(speedometers, 1000, 1.0, false);
      expect(rows[0].status).toBe('text-primary');
    });

    it('returns the correct under-reading percentage in the result string', () => {
      const rows = calculateSpeedometerTable(speedometers, 1000, 1.0, false);
      expect(rows[0].result).toBe('Under 31%');
    });

    it('result string starts with "Under"', () => {
      const rows = calculateSpeedometerTable(speedometers, 1000, 1.0, false);
      expect(rows[0].result).toMatch(/^Under \d+%$/);
    });
  });

  describe('row structure', () => {
    const speedometers: ISpeedometer[] = [{ name: 'Test Speedo', turns: 1280, speed: 90 }];

    it('returns one row per speedometer', () => {
      const multiSpeedo: ISpeedometer[] = [
        { name: 'A', turns: 1000, speed: 100 },
        { name: 'B', turns: 1280, speed: 90 },
        { name: 'C', turns: 1500, speed: 110 },
      ];
      const rows = calculateSpeedometerTable(multiSpeedo, 1280, 1.0, false);
      expect(rows).toHaveLength(3);
    });

    it('maps speedometer name onto the row', () => {
      const rows = calculateSpeedometerTable(speedometers, 1280, 1.0, false);
      expect(rows[0].speedometer).toBe('Test Speedo');
    });

    it('maps speedometer turns onto the row', () => {
      const rows = calculateSpeedometerTable(speedometers, 1280, 1.0, false);
      expect(rows[0].turns).toBe(1280);
    });

    it('maps speedometer speed onto the row', () => {
      const rows = calculateSpeedometerTable(speedometers, 1280, 1.0, false);
      expect(rows[0].speed).toBe(90);
    });

    it('each row has status, speedometer, turns, speed, result keys', () => {
      const rows = calculateSpeedometerTable(speedometers, 1280, 1.0, false);
      expect(rows[0]).toHaveProperty('status');
      expect(rows[0]).toHaveProperty('speedometer');
      expect(rows[0]).toHaveProperty('turns');
      expect(rows[0]).toHaveProperty('speed');
      expect(rows[0]).toHaveProperty('result');
    });
  });

  describe('metric mode', () => {
    // In metric mode the factor is kphFactor (1.60934).
    // turnsPerMile / kphFactor is used for the variation calculation,
    // so for the same speedometer to read correctly in metric we need
    // a higher raw turnsPerMile value than in imperial mode.
    const speedometers: ISpeedometer[] = [{ name: 'Smiths Metric', turns: 900, speed: 160 }];

    it('applies the kph factor so metric inputs yield different variations to imperial', () => {
      const imperialRows = calculateSpeedometerTable(speedometers, 1281, 1.0, false);
      const metricRows = calculateSpeedometerTable(speedometers, 1281, 1.0, true);
      // Dividing by kphFactor changes the effective turnsPerMile, so results differ
      expect(metricRows[0].result).not.toBe(imperialRows[0].result);
    });

    it('returns a valid status string in metric mode', () => {
      const rows = calculateSpeedometerTable(speedometers, 1281, 1.0, true);
      expect(['text-red', 'text-green', 'text-primary']).toContain(rows[0].status);
    });
  });

  describe('drop gear influence', () => {
    // variation = Math.round((turnsPerMile / turns) * 100 * dropGear)
    // A higher dropGear inflates the variation, pushing it toward over-reading.
    const speedometers: ISpeedometer[] = [{ name: 'Test', turns: 1280, speed: 100 }];

    it('a higher drop gear increases the variation value', () => {
      const standard = calculateSpeedometerTable(speedometers, 1000, 1.0, false);
      const higher = calculateSpeedometerTable(speedometers, 1000, 1.1364, false);
      // standard is under-reading at dropGear=1 (1000 < 1280)
      // variation(standard) = round((1000/1280)*100*1.0)    = round(78.1)  = 78 → Under 22%
      expect(standard[0].status).toBe('text-primary');
      // With dropGear=1.1364, variation = round((1000/1280)*100*1.1364) = round(88.78) = 89 → Under 11%
      // Still under, but a numerically higher variation than 78
      expect(higher[0].status).toBe('text-primary');
      // Parse the "Under X%" percentage from each result and confirm higher dropGear → smaller gap
      const underPct = (result: string) => parseInt(result.replace('Under ', '').replace('%', ''), 10);
      expect(underPct(higher[0].result)).toBeLessThan(underPct(standard[0].result));
    });
  });
});

// ---------------------------------------------------------------------------
// calculateChartData
// ---------------------------------------------------------------------------
describe('calculateChartData', () => {
  // Using a single-gear array to keep expected data straightforward.
  // 1st gear (3.627), typeCircInMiles from standard tire, imperial, no configName.
  //
  // Data points (rpm 1000 → 7000, step 500) for 1st gear imperial:
  //   rpm 1000 → Math.round((1000/1/3.627/3.444) * typeCircInMiles * 60) = 5
  //   rpm 1500 → 7
  //   rpm 2000 → 9
  //   rpm 2500 → 11
  //   rpm 3000 → 14
  //   rpm 3500 → 16
  //   rpm 4000 → 18
  //   rpm 4500 → 21
  //   rpm 5000 → 23
  //   rpm 5500 → 25
  //   rpm 6000 → 27
  //   rpm 6500 → 30
  //   rpm 7000 → 32

  const EXPECTED_FIRST_GEAR_IMPERIAL = [5, 7, 9, 11, 14, 16, 18, 21, 23, 25, 27, 30, 32];

  describe('basic data generation', () => {
    it('returns one series per gear ratio', () => {
      const result = calculateChartData(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result).toHaveLength(GEAR_RATIOS.length);
    });

    it('generates 13 data points for rpm range 1000–7000 step 500', () => {
      // (7000 - 1000) / 500 + 1 = 13 points
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result[0].data).toHaveLength(13);
    });

    it('generates the expected speed data points for 1st gear in imperial mode', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result[0].data).toEqual(EXPECTED_FIRST_GEAR_IMPERIAL);
    });

    it('data values are all positive integers', () => {
      const result = calculateChartData(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      for (const series of result) {
        for (const point of series.data) {
          expect(Number.isInteger(point)).toBe(true);
          expect(point).toBeGreaterThan(0);
        }
      }
    });

    it('speed values increase monotonically within each series', () => {
      const result = calculateChartData(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      for (const series of result) {
        for (let i = 1; i < series.data.length; i++) {
          expect(series.data[i]).toBeGreaterThanOrEqual(series.data[i - 1]);
        }
      }
    });
  });

  describe('series naming without configName', () => {
    it('names the first series "1st Gear"', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result[0].name).toBe('1st Gear');
    });

    it('names the four gears 1st, 2nd, 3rd, 4th Gear', () => {
      const result = calculateChartData(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result[0].name).toBe('1st Gear');
      expect(result[1].name).toBe('2nd Gear');
      expect(result[2].name).toBe('3rd Gear');
      expect(result[3].name).toBe('4th Gear');
    });

    it('returns an empty string name for a 5th gear (beyond the named array)', () => {
      const fiveGears = [3.627, 2.172, 1.412, 1.0, 0.9];
      const result = calculateChartData(
        fiveGears,
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result[4].name).toBe('');
    });
  });

  describe('series naming with configName', () => {
    it('prepends the configName to the gear name with a dash separator', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false,
        'Cooper S'
      );
      expect(result[0].name).toBe('Cooper S - 1st Gear');
    });

    it('applies the configName to all gears', () => {
      const result = calculateChartData(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false,
        'MKI'
      );
      expect(result[0].name).toBe('MKI - 1st Gear');
      expect(result[1].name).toBe('MKI - 2nd Gear');
      expect(result[2].name).toBe('MKI - 3rd Gear');
      expect(result[3].name).toBe('MKI - 4th Gear');
    });

    it('without configName the gear name has no prefix', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false,
        undefined
      );
      expect(result[0].name).toBe('1st Gear');
    });
  });

  describe('color propagation', () => {
    it('attaches the provided color to every series', () => {
      const result = calculateChartData(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false,
        undefined,
        '#FF0000'
      );
      for (const series of result) {
        expect(series.color).toBe('#FF0000');
      }
    });

    it('color is undefined when not provided', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result[0].color).toBeUndefined();
    });

    it('each series object has name and data keys', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('data');
    });
  });

  describe('metric mode', () => {
    // Each imperial speed value is converted: Math.round(speed * kphFactor)
    // 1st gear at 1000 rpm: 5 mph → Math.round(5 * 1.60934) = Math.round(8.047) = 8
    // 1st gear at 7000 rpm: 32 mph → Math.round(32 * 1.60934) = Math.round(51.5) = 52

    it('converts speed values to kph', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        true
      );
      // First point: 8 kph (5 mph → Math.round(Math.round(speed) * kphFactor))
      expect(result[0].data[0]).toBe(8);
      // Last point: 51 kph (32 mph * 1.60934 = 51.499... → 51)
      expect(result[0].data[result[0].data.length - 1]).toBe(51);
    });

    it('metric data values are larger than imperial data values', () => {
      const imperial = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false
      );
      const metric = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        true
      );
      for (let i = 0; i < imperial[0].data.length; i++) {
        expect(metric[0].data[i]).toBeGreaterThan(imperial[0].data[i]);
      }
    });

    it('metric series still has 13 data points', () => {
      const result = calculateChartData(
        [GEAR_RATIOS[0]],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        true
      );
      expect(result[0].data).toHaveLength(13);
    });
  });

  describe('returned type shape', () => {
    it('each series conforms to the ChartSeriesData interface shape', () => {
      const result: ChartSeriesData[] = calculateChartData(
        [...GEAR_RATIOS],
        FINAL_DRIVE,
        DROP_GEAR_STANDARD,
        MAX_RPM,
        STANDARD_TIRE_CIRC_IN_MILES,
        false,
        'Config',
        '#00FF00'
      );
      for (const series of result) {
        expect(typeof series.name).toBe('string');
        expect(Array.isArray(series.data)).toBe(true);
      }
    });
  });
});
