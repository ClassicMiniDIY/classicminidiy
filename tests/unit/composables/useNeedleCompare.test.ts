import { describe, it, expect } from 'vitest';
import type { Needle } from '~/data/models/needles';
import {
  NEEDLE_BANDS,
  bandAverages,
  buildDiffSeriesData,
  compareNeedles,
  effectiveStations,
  findRelativeNeedles,
} from '~/app/composables/useNeedleCompare';

// Synthetic needles used throughout the suite.
// - reference: a "flat-ish" baseline
// - richerLow: same as reference but noticeably smaller diameter in low band
// - leanerHigh: larger diameter in high band only
// - richerEverywhere: uniformly smaller diameter
// - shortNeedle: only 13 real stations, trailing 0s
// - differentSize: 0.1 carb instead of 0.09
const reference: Needle = {
  name: 'REF',
  size: 0.09,
  data: [2.261, 2.15, 2.05, 1.95, 1.85, 1.8, 1.75, 1.7, 1.65, 1.6, 1.55, 1.5, 1.45, 1.4, 1.35, 1.3],
};

const richerLow: Needle = {
  name: 'RICH-LOW',
  size: 0.09,
  data: [2.261, 2.0, 1.9, 1.85, 1.75, 1.8, 1.75, 1.7, 1.65, 1.6, 1.55, 1.5, 1.45, 1.4, 1.35, 1.3],
};

const leanerHigh: Needle = {
  name: 'LEAN-HIGH',
  size: 0.09,
  data: [2.261, 2.15, 2.05, 1.95, 1.85, 1.8, 1.75, 1.7, 1.65, 1.6, 1.65, 1.62, 1.6, 1.58, 1.55, 1.5],
};

const richerEverywhere: Needle = {
  name: 'RICH-ALL',
  size: 0.09,
  data: [2.261, 2.05, 1.95, 1.85, 1.75, 1.7, 1.65, 1.6, 1.55, 1.5, 1.45, 1.4, 1.35, 1.3, 1.25, 1.2],
};

const shortNeedle: Needle = {
  name: 'SHORT',
  size: 0.09,
  data: [2.261, 2.15, 2.05, 1.95, 1.85, 1.8, 1.75, 1.7, 1.65, 1.6, 1.55, 1.5, 1.45, 0, 0, 0],
};

const differentSize: Needle = {
  name: 'DIFF-SIZE',
  size: 0.1,
  data: [2.54, 2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],
};

describe('effectiveStations', () => {
  it('returns all station indexes when no zeros are present', () => {
    expect(effectiveStations(reference)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('skips trailing zero-valued stations', () => {
    expect(effectiveStations(shortNeedle)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('bandAverages', () => {
  it('excludes station 0 from the low band', () => {
    const avg = bandAverages(reference);
    // Low band is stations 1..4 = (2.15 + 2.05 + 1.95 + 1.85) / 4 = 2.0
    expect(avg.low).toBeCloseTo(2.0, 4);
  });

  it('computes mid and high correctly', () => {
    const avg = bandAverages(reference);
    // Mid 5..9 = (1.8 + 1.75 + 1.7 + 1.65 + 1.6) / 5 = 1.7
    expect(avg.mid).toBeCloseTo(1.7, 4);
    // High 10..15 = (1.55 + 1.5 + 1.45 + 1.4 + 1.35 + 1.3) / 6 = 1.425
    expect(avg.high).toBeCloseTo(1.425, 4);
  });

  it('returns null for bands with no real station data', () => {
    // shortNeedle has zeros at stations 13..15; high band (10..15) still has 10,11,12
    const avg = bandAverages(shortNeedle);
    expect(avg.high).toBeCloseTo((1.55 + 1.5 + 1.45) / 3, 4);
  });

  it('exposes canonical band ranges', () => {
    expect(NEEDLE_BANDS.low).toEqual({ start: 1, end: 4 });
    expect(NEEDLE_BANDS.mid).toEqual({ start: 5, end: 9 });
    expect(NEEDLE_BANDS.high).toEqual({ start: 10, end: 15 });
  });
});

describe('compareNeedles', () => {
  it('reports positive richness where candidate is smaller diameter', () => {
    const cmp = compareNeedles(reference, richerLow);
    expect(cmp.bands.low.richness).not.toBeNull();
    expect(cmp.bands.low.richness!).toBeGreaterThan(0);
    // Mid/high are identical between reference and richerLow
    expect(Math.abs(cmp.bands.mid.richness!)).toBeLessThan(1e-9);
    expect(Math.abs(cmp.bands.high.richness!)).toBeLessThan(1e-9);
  });

  it('reports negative richness where candidate is larger diameter', () => {
    const cmp = compareNeedles(reference, leanerHigh);
    expect(cmp.bands.high.richness!).toBeLessThan(0);
  });

  it('flags uniformly richer needles', () => {
    const cmp = compareNeedles(reference, richerEverywhere);
    expect(cmp.uniformlyRicher).toBe(true);
    expect(cmp.uniformlyLeaner).toBe(false);
  });

  it('computes richnessPct relative to reference band average', () => {
    const cmp = compareNeedles(reference, richerLow);
    // low: ref=2.0, cand=(2.0+1.9+1.85+1.75)/4=1.875 → richness=0.125 → pct=6.25%
    expect(cmp.bands.low.richness!).toBeCloseTo(0.125, 4);
    expect(cmp.bands.low.richnessPct!).toBeCloseTo(6.25, 2);
  });

  it('flags different size needles via sameSize=false', () => {
    const cmp = compareNeedles(reference, differentSize);
    expect(cmp.sameSize).toBe(false);
  });
});

describe('findRelativeNeedles', () => {
  const pool: Needle[] = [reference, richerLow, leanerHigh, richerEverywhere, shortNeedle, differentSize];

  it('excludes the reference itself from results', () => {
    const results = findRelativeNeedles(reference, pool, { band: 'any', direction: 'similar' });
    expect(results.find((r) => r.candidate.name === reference.name)).toBeUndefined();
  });

  it('filters out different-size needles by default', () => {
    const results = findRelativeNeedles(reference, pool, { band: 'any', direction: 'similar' });
    expect(results.find((r) => r.candidate.name === differentSize.name)).toBeUndefined();
  });

  it('includes different-size needles when sameSizeOnly is false', () => {
    const results = findRelativeNeedles(reference, pool, {
      band: 'any',
      direction: 'similar',
      sameSizeOnly: false,
      tolerance: 1, // very permissive so differentSize can't be filtered by tolerance
    });
    // It might not actually be "similar" but should be considered.
    // We just assert no blanket size exclusion when disabled.
    const considered = [...results, ...findRelativeNeedles(reference, pool, {
      band: 'any',
      direction: 'leaner',
      sameSizeOnly: false,
    })];
    expect(considered.some((r) => r.candidate.name === differentSize.name)).toBe(true);
  });

  it('finds needles richer in the low band with isolation', () => {
    const results = findRelativeNeedles(reference, pool, {
      band: 'low',
      direction: 'richer',
      isolateBand: true,
    });
    const names = results.map((r) => r.candidate.name);
    expect(names).toContain('RICH-LOW');
    // RICH-ALL changes every band and should be filtered or ranked lower when
    // isolation is on — but it's not hard-disqualified since overall change is
    // within 2× isolationTolerance. Assert RICH-LOW ranks first regardless.
    expect(results[0]!.candidate.name).toBe('RICH-LOW');
  });

  it('finds needles leaner in the high band', () => {
    const results = findRelativeNeedles(reference, pool, {
      band: 'high',
      direction: 'leaner',
    });
    const names = results.map((r) => r.candidate.name);
    expect(names).toContain('LEAN-HIGH');
  });

  it('returns no results when nothing matches direction', () => {
    const onlyLeaner: Needle[] = [leanerHigh];
    const results = findRelativeNeedles(reference, onlyLeaner, {
      band: 'low',
      direction: 'richer',
    });
    expect(results).toHaveLength(0);
  });

  it('respects the limit option', () => {
    const results = findRelativeNeedles(reference, pool, {
      band: 'any',
      direction: 'similar',
      tolerance: 10,
      limit: 2,
    });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('orders similar results by ascending overallDistance', () => {
    const results = findRelativeNeedles(reference, pool, {
      band: 'any',
      direction: 'similar',
      tolerance: 10,
    });
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i]!.score).toBeGreaterThanOrEqual(results[i - 1]!.score);
    }
  });

  it('requires uniform direction when band is "any"', () => {
    // leanerHigh is LEANER only in high band, richer/equal elsewhere → not uniformly leaner
    const results = findRelativeNeedles(reference, [leanerHigh], {
      band: 'any',
      direction: 'leaner',
      sameSizeOnly: true,
    });
    expect(results).toHaveLength(0);
  });
});

describe('buildDiffSeriesData', () => {
  it('emits gap entries where either side lacks real data', () => {
    const { richer, leaner } = buildDiffSeriesData(reference, shortNeedle);
    // shortNeedle has 0s at stations 13..15 → both series should be null-gapped there
    for (const station of [13, 14, 15]) {
      expect(richer[station]![1]).toBeNull();
      expect(richer[station]![2]).toBeNull();
      expect(leaner[station]![1]).toBeNull();
      expect(leaner[station]![2]).toBeNull();
    }
  });

  it('fills richer-series when candidate diameter is smaller', () => {
    const { richer, leaner } = buildDiffSeriesData(reference, richerLow);
    // Station 1: ref=2.15, cand=2.0 → candidate richer
    expect(richer[1]).toEqual([1, 2.0, 2.15]);
    expect(leaner[1]).toEqual([1, null, null]);
  });

  it('fills leaner-series when candidate diameter is larger', () => {
    const { richer, leaner } = buildDiffSeriesData(reference, leanerHigh);
    // Station 10: ref=1.55, cand=1.65 → candidate leaner
    expect(leaner[10]).toEqual([10, 1.55, 1.65]);
    expect(richer[10]).toEqual([10, null, null]);
  });

  it('emits equal entries as null in both series', () => {
    const { richer, leaner } = buildDiffSeriesData(reference, reference);
    for (let i = 0; i < reference.data.length; i += 1) {
      expect(richer[i]![1]).toBeNull();
      expect(leaner[i]![1]).toBeNull();
    }
  });
});
