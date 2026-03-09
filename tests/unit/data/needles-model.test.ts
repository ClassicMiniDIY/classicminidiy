import { describe, it, expect } from 'vitest';
import { SpringType, chartOptions } from '~/data/models/needles';
import type { NeedleResponse, Needle, SuggestedNeedles, Item } from '~/data/models/needles';

// ---------------------------------------------------------------------------
// SpringType
// ---------------------------------------------------------------------------
describe('SpringType', () => {
  it('Blue equals "Blue"', () => {
    expect(SpringType.Blue).toBe('Blue');
  });

  it('Empty equals "-"', () => {
    expect(SpringType.Empty).toBe('-');
  });

  it('Red equals "Red"', () => {
    expect(SpringType.Red).toBe('Red');
  });

  it('Yellow equals "Yellow"', () => {
    expect(SpringType.Yellow).toBe('Yellow');
  });

  it('has exactly 4 members', () => {
    const values = Object.values(SpringType);
    expect(values).toHaveLength(4);
  });

  it('members are distinct values', () => {
    const values = Object.values(SpringType);
    const unique = new Set(values);
    expect(unique.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// chartOptions
// ---------------------------------------------------------------------------
describe('chartOptions', () => {
  it('is an object', () => {
    expect(typeof chartOptions).toBe('object');
    expect(chartOptions).not.toBeNull();
  });

  it('has chart property with zoomType', () => {
    expect(chartOptions.chart).toBeDefined();
    expect(chartOptions.chart).toHaveProperty('zoomType');
    expect(chartOptions.chart.zoomType).toBe('x');
  });

  it('has title with text "Needle Comparison Chart"', () => {
    expect(chartOptions.title).toBeDefined();
    expect(chartOptions.title.text).toBe('Needle Comparison Chart');
  });

  it('has subtitle with text', () => {
    expect(chartOptions.subtitle).toBeDefined();
    expect(typeof chartOptions.subtitle.text).toBe('string');
    expect(chartOptions.subtitle.text.length).toBeGreaterThan(0);
  });

  it('has series property', () => {
    expect(chartOptions.series).toBeDefined();
    expect(Array.isArray(chartOptions.series)).toBe(true);
  });

  it('has yAxis with title text "Needle Diameter (mm)"', () => {
    expect(chartOptions.yAxis).toBeDefined();
    expect(chartOptions.yAxis.title.text).toBe('Needle Diameter (mm)');
  });

  it('has yAxis reversed', () => {
    expect(chartOptions.yAxis.reversed).toBe(true);
  });

  it('has xAxis with title text "Needle Station"', () => {
    expect(chartOptions.xAxis).toBeDefined();
    expect(chartOptions.xAxis.title.text).toBe('Needle Station');
  });

  it('has legend with layout, align, and verticalAlign', () => {
    expect(chartOptions.legend).toBeDefined();
    expect(chartOptions.legend).toHaveProperty('layout');
    expect(chartOptions.legend).toHaveProperty('align');
    expect(chartOptions.legend).toHaveProperty('verticalAlign');
    expect(chartOptions.legend.layout).toBe('vertical');
    expect(chartOptions.legend.align).toBe('right');
    expect(chartOptions.legend.verticalAlign).toBe('middle');
  });

  it('has tooltip with headerFormat and shared', () => {
    expect(chartOptions.tooltip).toBeDefined();
    expect(chartOptions.tooltip).toHaveProperty('headerFormat');
    expect(chartOptions.tooltip).toHaveProperty('shared');
    expect(chartOptions.tooltip.shared).toBe(true);
  });

  it('has responsive rules array with at least one rule', () => {
    expect(chartOptions.responsive).toBeDefined();
    expect(Array.isArray(chartOptions.responsive.rules)).toBe(true);
    expect(chartOptions.responsive.rules.length).toBeGreaterThan(0);
  });

  it('responsive rule has condition with maxWidth', () => {
    const rule = chartOptions.responsive.rules[0];
    expect(rule).toHaveProperty('condition');
    expect(rule.condition).toHaveProperty('maxWidth');
    expect(typeof rule.condition.maxWidth).toBe('number');
  });

  it('responsive rule chartOptions adjusts legend to horizontal bottom', () => {
    const rule = chartOptions.responsive.rules[0];
    expect(rule).toHaveProperty('chartOptions');
    expect(rule.chartOptions.legend.layout).toBe('horizontal');
    expect(rule.chartOptions.legend.align).toBe('center');
    expect(rule.chartOptions.legend.verticalAlign).toBe('bottom');
  });

  it('has exporting property with contextButton menu items', () => {
    expect(chartOptions.exporting).toBeDefined();
    expect(chartOptions.exporting.buttons.contextButton.menuItems).toContain('downloadPNG');
    expect(chartOptions.exporting.buttons.contextButton.menuItems).toContain('downloadJPEG');
    expect(chartOptions.exporting.buttons.contextButton.menuItems).toContain('downloadPDF');
  });
});

// ---------------------------------------------------------------------------
// Interface structural contracts (compile-time checks via typed assignment)
// ---------------------------------------------------------------------------
describe('Needle interface', () => {
  it('accepts a Needle object with name, size, and data array', () => {
    const needle: Needle = {
      name: 'AAA',
      size: 1.5,
      data: [2.738, 2.711, 2.692, 2.68, 2.673, 2.673, 2.673],
    };
    expect(needle.name).toBe('AAA');
    expect(Array.isArray(needle.data)).toBe(true);
  });
});

describe('NeedleResponse interface', () => {
  it('accepts initial and all arrays with optional error', () => {
    const response: NeedleResponse = {
      initial: [{ name: 'AAA', size: 1.5, data: [] }],
      all: [
        { name: 'AAA', size: 1.5, data: [] },
        { name: 'ABB', size: 1.5, data: [] },
      ],
    };
    expect(response.initial).toHaveLength(1);
    expect(response.all).toHaveLength(2);
    expect(response.error).toBeUndefined();
  });
});

describe('Item interface', () => {
  it('accepts an Item with SpringType values', () => {
    const item: Item = {
      engineSize: '848cc',
      needleStd: 'EB',
      needleRich: 'ES',
      needleLean: 'EF',
      springType: SpringType.Blue,
    };
    expect(item.springType).toBe(SpringType.Blue);
  });
});

describe('SuggestedNeedles interface', () => {
  it('accepts a SuggestedNeedles object', () => {
    const suggested: SuggestedNeedles = {
      title: 'Standard 848cc',
      items: [
        {
          engineSize: '848cc',
          needleStd: 'EB',
          needleRich: 'ES',
          needleLean: 'EF',
          springType: SpringType.Empty,
        },
      ],
    };
    expect(suggested.title).toBe('Standard 848cc');
    expect(suggested.items).toHaveLength(1);
  });
});
