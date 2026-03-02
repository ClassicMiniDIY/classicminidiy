import { describe, it, expect } from 'vitest';
import { options, kphFactor, tableHeaders, chartOptions } from '~/data/models/gearing';
import type {
  TireOption,
  DiffOption,
  GearRatioOption,
  SpeedometerOption,
  SpeedoRatioOption,
  DropGearOption,
  GearingOptions,
} from '~/data/models/gearing';

// ---------------------------------------------------------------------------
// kphFactor
// ---------------------------------------------------------------------------
describe('kphFactor', () => {
  it('equals 1.60934', () => {
    expect(kphFactor).toBe(1.60934);
  });

  it('is a number', () => {
    expect(typeof kphFactor).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// options.tires
// ---------------------------------------------------------------------------
describe('options.tires', () => {
  it('has 17 tire entries', () => {
    expect(options.tires).toHaveLength(17);
  });

  it('each tire has a label string', () => {
    for (const tire of options.tires) {
      expect(typeof tire.label).toBe('string');
      expect(tire.label.length).toBeGreaterThan(0);
    }
  });

  it('each tire has a value with width, profile, and size', () => {
    for (const tire of options.tires) {
      expect(typeof tire.value.width).toBe('number');
      expect(typeof tire.value.profile).toBe('number');
      expect(typeof tire.value.size).toBe('number');
    }
  });

  it('includes common tire sizes (10", 12", 13")', () => {
    const sizes = options.tires.map((t) => t.value.size);
    expect(sizes).toContain(10);
    expect(sizes).toContain(12);
    expect(sizes).toContain(13);
  });

  it('first entry is 145/80r10', () => {
    expect(options.tires[0].label).toBe('145/80r10');
    expect(options.tires[0].value).toEqual({ width: 145, profile: 80, size: 10 });
  });

  it('last entry is the Hoosier specialty tire with a diameter property', () => {
    const last = options.tires[options.tires.length - 1];
    expect(last.label).toContain('Hoosier');
    expect(last.value).toHaveProperty('diameter');
  });
});

// ---------------------------------------------------------------------------
// options.diffs
// ---------------------------------------------------------------------------
describe('options.diffs', () => {
  it('has entries', () => {
    expect(options.diffs.length).toBeGreaterThan(0);
  });

  it('each diff has a numeric value and a string label', () => {
    for (const diff of options.diffs) {
      expect(typeof diff.value).toBe('number');
      expect(typeof diff.label).toBe('string');
    }
  });

  it('includes the common 3.444 diff ratio', () => {
    const found = options.diffs.find((d) => d.value === 3.444);
    expect(found).toBeDefined();
    expect(found!.label).toContain('3.444');
  });

  it('values range from approximately 2.76 to 4.571', () => {
    const values = options.diffs.map((d) => d.value);
    expect(Math.min(...values)).toBeCloseTo(2.76, 1);
    expect(Math.max(...values)).toBeCloseTo(4.571, 1);
  });
});

// ---------------------------------------------------------------------------
// options.gearRatios
// ---------------------------------------------------------------------------
describe('options.gearRatios', () => {
  it('has entries', () => {
    expect(options.gearRatios.length).toBeGreaterThan(0);
  });

  it('each gear ratio set has a label and a 4-element value array', () => {
    for (const gr of options.gearRatios) {
      expect(typeof gr.label).toBe('string');
      expect(Array.isArray(gr.value)).toBe(true);
      expect(gr.value).toHaveLength(4);
    }
  });

  it('all gear ratio values are positive numbers', () => {
    for (const gr of options.gearRatios) {
      for (const ratio of gr.value) {
        expect(typeof ratio).toBe('number');
        expect(ratio).toBeGreaterThan(0);
      }
    }
  });

  it('4th gear is 1.0 for most entries (direct drive)', () => {
    const fourthGears = options.gearRatios.map((gr) => gr.value[3]);
    const directDriveCount = fourthGears.filter((v) => v === 1.0).length;
    // Nearly all should be 1.0
    expect(directDriveCount).toBeGreaterThanOrEqual(options.gearRatios.length - 2);
  });

  it('includes the Magic Wand gear set', () => {
    const found = options.gearRatios.find((gr) => gr.label.includes('Magic Wand'));
    expect(found).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// options.speedos
// ---------------------------------------------------------------------------
describe('options.speedos', () => {
  it('has metric and imperial arrays', () => {
    expect(Array.isArray(options.speedos.metric)).toBe(true);
    expect(Array.isArray(options.speedos.imperial)).toBe(true);
  });

  it('metric array has entries', () => {
    expect(options.speedos.metric.length).toBeGreaterThan(0);
  });

  it('imperial array has entries', () => {
    expect(options.speedos.imperial.length).toBeGreaterThan(0);
  });

  it('each metric speedometer has turns, speed, and name', () => {
    for (const speedo of options.speedos.metric) {
      expect(typeof speedo.turns).toBe('number');
      expect(typeof speedo.speed).toBe('number');
      expect(typeof speedo.name).toBe('string');
      expect(speedo.turns).toBeGreaterThan(0);
      expect(speedo.speed).toBeGreaterThan(0);
    }
  });

  it('each imperial speedometer has turns, speed, and name', () => {
    for (const speedo of options.speedos.imperial) {
      expect(typeof speedo.turns).toBe('number');
      expect(typeof speedo.speed).toBe('number');
      expect(typeof speedo.name).toBe('string');
      expect(speedo.turns).toBeGreaterThan(0);
      expect(speedo.speed).toBeGreaterThan(0);
    }
  });

  it('imperial speedometers have higher turns values than metric', () => {
    const avgImperial = options.speedos.imperial.reduce((sum, s) => sum + s.turns, 0) / options.speedos.imperial.length;
    const avgMetric = options.speedos.metric.reduce((sum, s) => sum + s.turns, 0) / options.speedos.metric.length;
    expect(avgImperial).toBeGreaterThan(avgMetric);
  });
});

// ---------------------------------------------------------------------------
// options.speedosRatios
// ---------------------------------------------------------------------------
describe('options.speedosRatios', () => {
  it('has entries', () => {
    expect(options.speedosRatios.length).toBeGreaterThan(0);
  });

  it('each has a numeric value and a string label', () => {
    for (const sr of options.speedosRatios) {
      expect(typeof sr.value).toBe('number');
      expect(typeof sr.label).toBe('string');
    }
  });

  it('includes the common 6/17 ratio (0.3529)', () => {
    const found = options.speedosRatios.find((s) => s.value === 0.3529);
    expect(found).toBeDefined();
    expect(found!.label).toContain('6/17');
  });
});

// ---------------------------------------------------------------------------
// options.dropGears
// ---------------------------------------------------------------------------
describe('options.dropGears', () => {
  it('has entries', () => {
    expect(options.dropGears.length).toBeGreaterThan(0);
  });

  it('includes standard 1:1 drop gear', () => {
    const standard = options.dropGears.find((d) => d.value === 1);
    expect(standard).toBeDefined();
    expect(standard!.label).toContain('1:1');
  });

  it('each has a numeric value and a string label', () => {
    for (const dg of options.dropGears) {
      expect(typeof dg.value).toBe('number');
      expect(typeof dg.label).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// options.rpmTicks
// ---------------------------------------------------------------------------
describe('options.rpmTicks', () => {
  it('has entries', () => {
    expect(Object.keys(options.rpmTicks).length).toBeGreaterThan(0);
  });

  it('keys and values are RPM strings', () => {
    for (const [key, value] of Object.entries(options.rpmTicks)) {
      expect(Number(key)).toBeGreaterThan(0);
      expect(typeof value).toBe('string');
    }
  });

  it('includes 6000, 7000, and 9000 RPM', () => {
    expect(options.rpmTicks[6000]).toBe('6000');
    expect(options.rpmTicks[7000]).toBe('7000');
    expect(options.rpmTicks[9000]).toBe('9000');
  });
});

// ---------------------------------------------------------------------------
// tableHeaders
// ---------------------------------------------------------------------------
describe('tableHeaders', () => {
  it('has tableHeadersGearing', () => {
    expect(Array.isArray(tableHeaders.tableHeadersGearing)).toBe(true);
    expect(tableHeaders.tableHeadersGearing.length).toBeGreaterThan(0);
  });

  it('tableHeadersGearing contains gear, ratio, and maxSpeed columns', () => {
    const keys = tableHeaders.tableHeadersGearing.map((h) => h.key);
    expect(keys).toContain('gear');
    expect(keys).toContain('ratio');
    expect(keys).toContain('maxSpeed');
  });

  it('has tableHeadersSpeedos', () => {
    expect(Array.isArray(tableHeaders.tableHeadersSpeedos)).toBe(true);
    expect(tableHeaders.tableHeadersSpeedos.length).toBeGreaterThan(0);
  });

  it('tableHeadersSpeedos contains speed, turns, speedometer, result columns', () => {
    const keys = tableHeaders.tableHeadersSpeedos.map((h) => h.key);
    expect(keys).toContain('speed');
    expect(keys).toContain('turns');
    expect(keys).toContain('speedometer');
    expect(keys).toContain('result');
  });

  it('all headers have key, label, and title properties', () => {
    const allHeaders = [...tableHeaders.tableHeadersGearing, ...tableHeaders.tableHeadersSpeedos];
    for (const header of allHeaders) {
      expect(header).toHaveProperty('key');
      expect(header).toHaveProperty('label');
      expect(header).toHaveProperty('title');
      expect(header).toHaveProperty('sortable');
    }
  });
});

// ---------------------------------------------------------------------------
// chartOptions
// ---------------------------------------------------------------------------
describe('chartOptions', () => {
  it('has chart property with zoomType', () => {
    expect(chartOptions.chart).toHaveProperty('zoomType');
  });

  it('has title with text', () => {
    expect(chartOptions.title).toHaveProperty('text');
    expect(chartOptions.title.text).toBe('Speed and RPM');
  });

  it('has xAxis with title "RPM"', () => {
    expect(chartOptions.xAxis.title.text).toBe('RPM');
  });

  it('has yAxis with title "Speed"', () => {
    expect(chartOptions.yAxis.title.text).toBe('Speed');
  });

  it('has an empty series array', () => {
    expect(chartOptions.series).toEqual([]);
  });

  it('has responsive rules', () => {
    expect(Array.isArray(chartOptions.responsive.rules)).toBe(true);
    expect(chartOptions.responsive.rules.length).toBeGreaterThan(0);
  });

  it('has legend configuration', () => {
    expect(chartOptions.legend).toHaveProperty('layout');
    expect(chartOptions.legend).toHaveProperty('align');
    expect(chartOptions.legend).toHaveProperty('verticalAlign');
  });

  it('has plotOptions with pointStart and pointInterval', () => {
    expect(chartOptions.plotOptions.series.pointStart).toBe(1000);
    expect(chartOptions.plotOptions.series.pointInterval).toBe(500);
  });
});
