import { describe, it, expect } from 'vitest';
import { formOptions } from '~/data/models/compression';

// ---------------------------------------------------------------------------
// formOptions top-level structure
// ---------------------------------------------------------------------------
describe('formOptions structure', () => {
  it('has pistonOptions', () => {
    expect(formOptions).toHaveProperty('pistonOptions');
    expect(Array.isArray(formOptions.pistonOptions)).toBe(true);
  });

  it('has crankshaftOptions', () => {
    expect(formOptions).toHaveProperty('crankshaftOptions');
    expect(Array.isArray(formOptions.crankshaftOptions)).toBe(true);
  });

  it('has headGasketOptions', () => {
    expect(formOptions).toHaveProperty('headGasketOptions');
    expect(Array.isArray(formOptions.headGasketOptions)).toBe(true);
  });

  it('has decompPlateOptions', () => {
    expect(formOptions).toHaveProperty('decompPlateOptions');
    expect(Array.isArray(formOptions.decompPlateOptions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pistonOptions
// ---------------------------------------------------------------------------
describe('formOptions.pistonOptions', () => {
  it('has 17 entries', () => {
    expect(formOptions.pistonOptions).toHaveLength(17);
  });

  it('each entry has label, subtitle, and value', () => {
    for (const piston of formOptions.pistonOptions) {
      expect(typeof piston.label).toBe('string');
      expect(piston.label.length).toBeGreaterThan(0);
      expect(typeof piston.subtitle).toBe('string');
      expect(typeof piston.value).toBe('number');
    }
  });

  it('all values are in the expected bore range (6.0 to 7.5 cm)', () => {
    for (const piston of formOptions.pistonOptions) {
      expect(piston.value).toBeGreaterThanOrEqual(6.0);
      expect(piston.value).toBeLessThanOrEqual(7.5);
    }
  });

  it('includes stock 1275 piston (70.60mm / 7.06cm)', () => {
    const stock1275 = formOptions.pistonOptions.find((p) => p.value === 7.06);
    expect(stock1275).toBeDefined();
    expect(stock1275!.label).toContain('1275');
    expect(stock1275!.subtitle).toBe('1275');
  });

  it('includes 850cc piston (62.9mm / 6.29cm)', () => {
    const p850 = formOptions.pistonOptions.find((p) => p.value === 6.29);
    expect(p850).toBeDefined();
    expect(p850!.subtitle).toBe('850');
  });

  it('subtitles reflect engine families (850, 997, 998/1098, 1275)', () => {
    const subtitles = [...new Set(formOptions.pistonOptions.map((p) => p.subtitle))];
    expect(subtitles).toContain('850');
    expect(subtitles).toContain('997');
    expect(subtitles).toContain('998/1098');
    expect(subtitles).toContain('1275');
  });

  it('has no duplicate values', () => {
    const values = formOptions.pistonOptions.map((p) => p.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// crankshaftOptions
// ---------------------------------------------------------------------------
describe('formOptions.crankshaftOptions', () => {
  it('has entries', () => {
    expect(formOptions.crankshaftOptions.length).toBeGreaterThan(0);
  });

  it('each entry has label, subtitle, and value', () => {
    for (const crank of formOptions.crankshaftOptions) {
      expect(typeof crank.label).toBe('string');
      expect(crank.label.length).toBeGreaterThan(0);
      expect(typeof crank.subtitle).toBe('string');
      // Value can be number or string depending on the entry
      expect(crank.value).toBeDefined();
    }
  });

  it('includes standard variants', () => {
    const standard = formOptions.crankshaftOptions.filter((c) => c.subtitle === 'Standard');
    expect(standard.length).toBeGreaterThanOrEqual(3);
  });

  it('includes stroked variants', () => {
    const stroked = formOptions.crankshaftOptions.filter((c) => c.subtitle === 'Stroked');
    expect(stroked.length).toBeGreaterThanOrEqual(1);
  });

  it('includes the 1275cc standard crankshaft (81.28mm / 8.128cm)', () => {
    const crank1275 = formOptions.crankshaftOptions.find((c) => c.value === 8.128);
    expect(crank1275).toBeDefined();
    expect(crank1275!.label).toContain('1275cc');
    expect(crank1275!.subtitle).toBe('Standard');
  });

  it('includes the 850cc standard crankshaft (68.26mm / 6.826cm)', () => {
    const crank850 = formOptions.crankshaftOptions.find((c) => c.value === 6.826);
    expect(crank850).toBeDefined();
    expect(crank850!.label).toContain('850cc');
  });

  it('includes a Special variant (South African 1275cc)', () => {
    const special = formOptions.crankshaftOptions.find((c) => c.subtitle === 'Special');
    expect(special).toBeDefined();
    expect(special!.label).toContain('South African');
  });
});

// ---------------------------------------------------------------------------
// headGasketOptions
// ---------------------------------------------------------------------------
describe('formOptions.headGasketOptions', () => {
  it('has entries', () => {
    expect(formOptions.headGasketOptions.length).toBeGreaterThan(0);
  });

  it('each entry has label and value', () => {
    for (const gasket of formOptions.headGasketOptions) {
      expect(typeof gasket.label).toBe('string');
      expect(gasket.label.length).toBeGreaterThan(0);
      expect(typeof gasket.value).toBe('number');
    }
  });

  it('includes the Custom Volume option with value 0', () => {
    const custom = formOptions.headGasketOptions.find((g) => g.value === 0);
    expect(custom).toBeDefined();
    expect(custom!.label).toBe('Custom Volume');
  });

  it('includes standard 850 gasket (2.4cc)', () => {
    const g850 = formOptions.headGasketOptions.find((g) => g.value === 2.4);
    expect(g850).toBeDefined();
    expect(g850!.label).toContain('850');
  });

  it('includes standard 998 gasket (2.8cc)', () => {
    const g998 = formOptions.headGasketOptions.find((g) => g.value === 2.8);
    expect(g998).toBeDefined();
    expect(g998!.label).toContain('998');
  });

  it('includes standard 1275 gasket (3.4cc)', () => {
    const g1275 = formOptions.headGasketOptions.find((g) => g.value === 3.4);
    expect(g1275).toBeDefined();
    expect(g1275!.label).toContain('1275');
  });

  it('non-custom gasket values are all positive', () => {
    const nonCustom = formOptions.headGasketOptions.filter((g) => g.value !== 0);
    for (const gasket of nonCustom) {
      expect(gasket.value).toBeGreaterThan(0);
    }
  });

  it('includes aftermarket MED Cometic options', () => {
    const cometic = formOptions.headGasketOptions.filter((g) => g.label.includes('Cometic'));
    expect(cometic.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// decompPlateOptions
// ---------------------------------------------------------------------------
describe('formOptions.decompPlateOptions', () => {
  it('has entries', () => {
    expect(formOptions.decompPlateOptions.length).toBeGreaterThan(0);
  });

  it('each entry has label, subtitle, and value', () => {
    for (const decomp of formOptions.decompPlateOptions) {
      expect(typeof decomp.label).toBe('string');
      expect(decomp.label.length).toBeGreaterThan(0);
      expect(typeof decomp.subtitle).toBe('string');
      expect(typeof decomp.value).toBe('number');
    }
  });

  it('starts with "None (0cc)" at value 0', () => {
    const first = formOptions.decompPlateOptions[0];
    expect(first.label).toBe('None (0cc)');
    expect(first.value).toBe(0);
  });

  it('all non-zero values are positive', () => {
    const nonZero = formOptions.decompPlateOptions.filter((d) => d.value !== 0);
    for (const decomp of nonZero) {
      expect(decomp.value).toBeGreaterThan(0);
    }
  });

  it('includes 998cc plate options', () => {
    const plates998 = formOptions.decompPlateOptions.filter((d) => d.subtitle === '998cc Plates');
    expect(plates998.length).toBeGreaterThanOrEqual(1);
  });

  it('includes 1275cc plate options', () => {
    const plates1275 = formOptions.decompPlateOptions.filter((d) => d.subtitle === '1275cc Plates');
    expect(plates1275.length).toBeGreaterThanOrEqual(1);
  });

  it('values are in the expected range (0 to 13cc)', () => {
    for (const decomp of formOptions.decompPlateOptions) {
      expect(decomp.value).toBeGreaterThanOrEqual(0);
      expect(decomp.value).toBeLessThanOrEqual(13);
    }
  });

  it('largest decomp plate is 12.4cc', () => {
    const values = formOptions.decompPlateOptions.map((d) => d.value);
    expect(Math.max(...values)).toBe(12.4);
  });
});
