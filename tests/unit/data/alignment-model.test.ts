import { describe, it, expect } from 'vitest';
import {
  ALIGNMENT_PARAMETERS,
  ALIGNMENT_PRESETS,
  ALIGNMENT_WHEEL_SIZES,
  defaultAlignmentValues,
  getAlignmentPreset,
  mmToInchFraction,
  toeMmToDegrees,
  getCamberGuidance,
  ALIGNMENT_CAMBER_GUIDANCE,
  type AlignmentParamId,
  type AlignmentValues,
} from '~/data/models/alignment';

const PARAM_IDS: AlignmentParamId[] = ['frontCamber', 'frontCaster', 'frontToe', 'rearCamber', 'rearToe'];

describe('ALIGNMENT_PARAMETERS', () => {
  it('defines exactly the five expected parameters', () => {
    expect(ALIGNMENT_PARAMETERS).toHaveLength(5);
    expect(ALIGNMENT_PARAMETERS.map((p) => p.id).sort()).toEqual([...PARAM_IDS].sort());
  });

  it('each parameter is internally consistent (min < max, sane step, default in range)', () => {
    for (const p of ALIGNMENT_PARAMETERS) {
      expect(p.min).toBeLessThan(p.max);
      expect(p.step).toBeGreaterThan(0);
      expect(p.stockDefault).toBeGreaterThanOrEqual(p.min);
      expect(p.stockDefault).toBeLessThanOrEqual(p.max);
      expect(['deg', 'mm']).toContain(p.unit);
      expect(['front', 'rear']).toContain(p.axle);
      expect(['camber', 'caster', 'toe']).toContain(p.kind);
    }
  });

  it('uses degrees for camber/caster and mm for toe', () => {
    for (const p of ALIGNMENT_PARAMETERS) {
      expect(p.unit).toBe(p.kind === 'toe' ? 'mm' : 'deg');
    }
  });
});

describe('ALIGNMENT_PRESETS', () => {
  it('defines the five presets in the expected order', () => {
    expect(ALIGNMENT_PRESETS.map((p) => p.id)).toEqual([
      'stockRoad',
      'fastRoad',
      'trackDay',
      'boostedRoad',
      'boostedTrack',
    ]);
  });

  it('every preset value sits within its parameter slider range', () => {
    for (const preset of ALIGNMENT_PRESETS) {
      for (const id of PARAM_IDS) {
        const param = ALIGNMENT_PARAMETERS.find((p) => p.id === id)!;
        const v = preset.values[id as keyof AlignmentValues];
        expect(v, `${preset.id}.${id}`).toBeGreaterThanOrEqual(param.min);
        expect(v, `${preset.id}.${id}`).toBeLessThanOrEqual(param.max);
      }
    }
  });

  it('every preset has a valid confidence and at least one source', () => {
    for (const preset of ALIGNMENT_PRESETS) {
      expect(['high', 'medium', 'low']).toContain(preset.confidence);
      expect(preset.sources.length).toBeGreaterThan(0);
      for (const src of preset.sources) expect(src).toMatch(/^https?:\/\//);
    }
  });

  it('respects the Mini sign conventions: front toe-out, rear toe-in, positive stock front camber', () => {
    const stock = getAlignmentPreset('stockRoad')!;
    expect(stock.values.frontToe).toBeLessThan(0); // front runs toe-out
    expect(stock.values.rearToe).toBeGreaterThan(0); // rear runs toe-in
    expect(stock.values.frontCamber).toBeGreaterThan(0); // factory front camber is positive
    expect(stock.values.frontCaster).toBeGreaterThan(0); // caster always positive
  });

  it('boosted road sets the front toe parallel (the headline torque-steer finding)', () => {
    expect(getAlignmentPreset('boostedRoad')!.values.frontToe).toBe(0);
  });

  it('caster is positive across every preset', () => {
    for (const preset of ALIGNMENT_PRESETS) {
      expect(preset.values.frontCaster).toBeGreaterThan(0);
    }
  });
});

describe('defaultAlignmentValues', () => {
  it('returns the stock-road geometry as a fresh object', () => {
    const a = defaultAlignmentValues();
    expect(a).toEqual(getAlignmentPreset('stockRoad')!.values);
    a.frontCamber = 99;
    expect(getAlignmentPreset('stockRoad')!.values.frontCamber).not.toBe(99); // not a shared reference
  });
});

describe('mmToInchFraction', () => {
  it('maps the canonical Mini toe values to imperial fractions', () => {
    expect(mmToInchFraction(1.5875)).toBe('1/16"');
    expect(mmToInchFraction(3.175)).toBe('1/8"');
    expect(mmToInchFraction(4.7625)).toBe('3/16"');
    expect(mmToInchFraction(25.4)).toBe('1"');
  });

  it('is sign-agnostic and returns 0 for ~zero', () => {
    expect(mmToInchFraction(-1.5875)).toBe('1/16"');
    expect(mmToInchFraction(0)).toBe('0');
  });
});

describe('toeMmToDegrees', () => {
  it('returns 0 for zero toe', () => {
    expect(toeMmToDegrees(0, 10)).toBe(0);
  });

  it('computes ~0.72° total for 1/8" toe on 10" wheels', () => {
    expect(toeMmToDegrees(3.175, 10)).toBeCloseTo(0.716, 2);
  });

  it('yields a smaller angle on a larger wheel for the same mm', () => {
    expect(Math.abs(toeMmToDegrees(3.175, 13))).toBeLessThan(Math.abs(toeMmToDegrees(3.175, 10)));
  });

  it('exposes the supported wheel sizes', () => {
    expect(ALIGNMENT_WHEEL_SIZES).toContain(10);
    expect(ALIGNMENT_WHEEL_SIZES).toContain(13);
  });
});

describe('getCamberGuidance', () => {
  it('returns a neutral-to-negative range for every wheel size and axle', () => {
    for (const size of ALIGNMENT_WHEEL_SIZES) {
      for (const axle of ['front', 'rear'] as const) {
        const g = getCamberGuidance(size, axle);
        expect(g.min, `${size} ${axle}`).toBeLessThanOrEqual(g.max); // min is the more-negative end
        expect(g.max, `${size} ${axle}`).toBeLessThanOrEqual(0);
      }
    }
  });

  it('recommends more negative camber on smaller rims', () => {
    expect(getCamberGuidance(10, 'front').min).toBeLessThan(getCamberGuidance(13, 'front').min);
    expect(getCamberGuidance(10, 'rear').min).toBeLessThan(getCamberGuidance(13, 'rear').min);
  });

  it('keeps front camber at least as negative as rear for a given rim', () => {
    for (const size of ALIGNMENT_WHEEL_SIZES) {
      expect(getCamberGuidance(size, 'front').min).toBeLessThanOrEqual(getCamberGuidance(size, 'rear').min);
    }
  });

  it('falls back to the 10" guidance for an unknown wheel size', () => {
    expect(getCamberGuidance(99, 'front')).toEqual(ALIGNMENT_CAMBER_GUIDANCE[10].front);
  });
});
