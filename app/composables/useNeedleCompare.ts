import type { Needle } from '../../data/models/needles';

/**
 * useNeedleCompare
 * -----------------
 * Pure, framework-free utilities for SU needle comparison.
 *
 * This composable powers the "find similar / relative needles" feature on the
 * Needle Configurator tool and is intentionally written as plain TypeScript
 * (no Vue reactivity) so the same logic can be ported 1:1 to the native iOS
 * (Swift) and Android (Kotlin) Classic Mini Toolbox apps.
 *
 * Data model recap (see `data/models/needles.ts` and `data/needles.json`):
 *   - Each needle has `data: number[]` — a profile of needle *diameter in mm*
 *     at fixed stations (positions) along the needle. 13–16 stations total.
 *   - A value of `0` at a station means the needle simply doesn't extend that
 *     far — treat it as "no data", not as a real diameter.
 *   - Smaller diameter = more fuel passes around the needle = RICHER mixture.
 *   - Larger diameter = less fuel = LEANER mixture.
 *   - In the chart the Y-axis is reversed, so richer needles appear *higher*.
 *
 * Station-to-engine-band mapping
 * ------------------------------
 * The mapping is approximate — the exact RPM each station corresponds to
 * depends on carb size, piston spring, and engine displacement — but the
 * three-band model below is the same one tuners have used informally for
 * decades and matches how Minty Lamb / 7ent document needle behaviour.
 *
 *   Station 0       → idle anchor (virtually identical across all needles).
 *                     Excluded from band averages because it carries no signal.
 *   Stations 1..4   → LOW  (off-idle → ~2500 rpm)
 *   Stations 5..9   → MID  (cruise  → ~4000 rpm)
 *   Stations 10..15 → HIGH (WOT     → redline)
 *
 * Trailing `0` station values are also skipped (they indicate a shorter
 * needle, not a zero-diameter measurement).
 */

/** Inclusive station-index ranges for each band. */
export const NEEDLE_BANDS = {
  low: { start: 1, end: 4 },
  mid: { start: 5, end: 9 },
  high: { start: 10, end: 15 },
} as const;

export type NeedleBand = keyof typeof NEEDLE_BANDS;

export type NeedleDirection = 'richer' | 'leaner' | 'similar';

/** Per-band average diameter and per-station samples used for ranking. */
export interface BandAverages {
  low: number | null;
  mid: number | null;
  high: number | null;
}

/**
 * Delta report comparing a candidate needle to a reference needle.
 * All values are expressed from the perspective of the CANDIDATE:
 *   - `richness` > 0  → candidate is RICHER than reference in that band
 *   - `richness` < 0  → candidate is LEANER than reference in that band
 *
 * `richness` is in absolute mm (reference.diameter - candidate.diameter).
 * `richnessPct` is the same quantity expressed as a percentage of the
 * reference band average, which is easier to surface in the UI.
 */
export interface BandDelta {
  reference: number | null;
  candidate: number | null;
  richness: number | null;
  richnessPct: number | null;
}

export interface NeedleComparison {
  candidate: Needle;
  reference: Needle;
  sameSize: boolean;
  bands: Record<NeedleBand, BandDelta>;
  /** Mean absolute richness across all three bands, in mm. */
  overallDistance: number;
  /** True if candidate is richer than reference in every band. */
  uniformlyRicher: boolean;
  /** True if candidate is leaner than reference in every band. */
  uniformlyLeaner: boolean;
}

export interface FindRelativeOptions {
  /** Which band to target. Use `'any'` to search across all three bands. */
  band: NeedleBand | 'any';
  /** What relationship to the reference to search for. */
  direction: NeedleDirection;
  /** Only return candidates whose `size` equals the reference `size`. Default true. */
  sameSizeOnly?: boolean;
  /**
   * For `direction === 'similar'`: maximum mean |richness| across bands to
   * qualify (mm). Default 0.02mm (~1% of typical diameter).
   *
   * For `direction === 'richer' | 'leaner'`: the minimum magnitude the
   * candidate must differ by in the target band. Default 0.005mm.
   */
  tolerance?: number;
  /**
   * When true (default) for 'richer'/'leaner' with a specific band, candidates
   * must be *approximately unchanged* in the other two bands — within
   * `isolationTolerance` mm. This surfaces the "richer only in the low range"
   * use-case Matt asked for (TR6 needed more low-end richness with mid & top
   * roughly preserved).
   */
  isolateBand?: boolean;
  /** mm tolerance for the non-target bands when `isolateBand` is true. Default 0.015mm. */
  isolationTolerance?: number;
  /** Limit on returned results after ranking. Default 10. */
  limit?: number;
}

export interface RankedNeedle extends NeedleComparison {
  /** Lower = better match for the requested direction/band. */
  score: number;
}

/** Return stations that carry real data (non-zero) for a needle. */
export function effectiveStations(needle: Needle): number[] {
  const out: number[] = [];
  for (let i = 0; i < needle.data.length; i += 1) {
    const v = needle.data[i];
    if (typeof v === 'number' && v > 0) out.push(i);
  }
  return out;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Return the average diameter for a needle in each of the three bands. */
export function bandAverages(needle: Needle): BandAverages {
  const out: BandAverages = { low: null, mid: null, high: null };
  (Object.keys(NEEDLE_BANDS) as NeedleBand[]).forEach((band) => {
    const { start, end } = NEEDLE_BANDS[band];
    const samples: number[] = [];
    for (let i = start; i <= end; i += 1) {
      const v = needle.data[i];
      if (typeof v === 'number' && v > 0) samples.push(v);
    }
    out[band] = mean(samples);
  });
  return out;
}

/** Produce a full delta report of candidate vs reference. */
export function compareNeedles(reference: Needle, candidate: Needle): NeedleComparison {
  const refBands = bandAverages(reference);
  const candBands = bandAverages(candidate);
  const bands = {} as Record<NeedleBand, BandDelta>;
  const richnessValues: number[] = [];

  (Object.keys(NEEDLE_BANDS) as NeedleBand[]).forEach((band) => {
    const r = refBands[band];
    const c = candBands[band];
    let richness: number | null = null;
    let richnessPct: number | null = null;
    if (r !== null && c !== null) {
      richness = r - c;
      richnessPct = r !== 0 ? (richness / r) * 100 : null;
      richnessValues.push(Math.abs(richness));
    }
    bands[band] = { reference: r, candidate: c, richness, richnessPct };
  });

  const overallDistance = richnessValues.length ? richnessValues.reduce((a, b) => a + b, 0) / richnessValues.length : 0;

  const richnessSigned = (Object.keys(bands) as NeedleBand[])
    .map((b) => bands[b].richness)
    .filter((v): v is number => v !== null);

  return {
    candidate,
    reference,
    sameSize: reference.size === candidate.size,
    bands,
    overallDistance,
    uniformlyRicher: richnessSigned.length > 0 && richnessSigned.every((v) => v > 0),
    uniformlyLeaner: richnessSigned.length > 0 && richnessSigned.every((v) => v < 0),
  };
}

function meanAbs(values: (number | null)[]): number {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return 0;
  return nums.reduce((acc, v) => acc + Math.abs(v), 0) / nums.length;
}

/**
 * Rank the pool of candidate needles against a reference needle for a given
 * relative-search query.
 *
 * Scoring (lower is better):
 *   - `similar`: score = mean |richness| across all bands.
 *   - `richer` / `leaner` on a single band:
 *       * skip candidates not going the requested direction in that band,
 *       * primary cost = -|richness_target| (bigger change wins),
 *       * if `isolateBand`, add a penalty proportional to how much the other
 *         two bands drifted beyond `isolationTolerance`.
 *   - `richer` / `leaner` on `'any'`:
 *       * candidate must be uniformly in that direction across bands,
 *       * score = -mean |richness| across bands (biggest mover wins).
 */
export function findRelativeNeedles(
  reference: Needle,
  pool: Needle[],
  options: FindRelativeOptions
): RankedNeedle[] {
  const {
    band,
    direction,
    sameSizeOnly = true,
    tolerance = direction === 'similar' ? 0.02 : 0.005,
    isolateBand = true,
    isolationTolerance = 0.015,
    limit = 10,
  } = options;

  const ranked: RankedNeedle[] = [];

  for (const candidate of pool) {
    if (candidate.name === reference.name) continue;
    if (sameSizeOnly && candidate.size !== reference.size) continue;

    const cmp = compareNeedles(reference, candidate);

    if (direction === 'similar') {
      if (cmp.overallDistance > tolerance) continue;
      ranked.push({ ...cmp, score: cmp.overallDistance });
      continue;
    }

    // richer or leaner
    const wantPositive = direction === 'richer';

    if (band === 'any') {
      if (wantPositive && !cmp.uniformlyRicher) continue;
      if (!wantPositive && !cmp.uniformlyLeaner) continue;
      const movement = meanAbs([cmp.bands.low.richness, cmp.bands.mid.richness, cmp.bands.high.richness]);
      if (movement < tolerance) continue;
      ranked.push({ ...cmp, score: -movement });
      continue;
    }

    const targetDelta = cmp.bands[band].richness;
    if (targetDelta === null) continue;
    if (wantPositive && targetDelta < tolerance) continue;
    if (!wantPositive && targetDelta > -tolerance) continue;

    let isolationPenalty = 0;
    if (isolateBand) {
      let disqualified = false;
      (Object.keys(NEEDLE_BANDS) as NeedleBand[]).forEach((b) => {
        if (b === band) return;
        const d = cmp.bands[b].richness;
        if (d === null) return;
        const overflow = Math.abs(d) - isolationTolerance;
        if (overflow > 0) {
          // Soft penalty rather than hard disqualification, so users still get
          // results when the pool doesn't contain a perfectly-isolated match.
          isolationPenalty += overflow * 5;
          if (overflow > isolationTolerance * 2) disqualified = true;
        }
      });
      if (disqualified) continue;
    }

    const score = -Math.abs(targetDelta) + isolationPenalty;
    ranked.push({ ...cmp, score });
  }

  ranked.sort((a, b) => a.score - b.score);
  return ranked.slice(0, limit);
}

/**
 * Build two station-by-station arrays suitable for driving a pair of
 * Highcharts `arearange` series that shade between a reference and a
 * candidate curve:
 *
 *   - `richer`  — fill where candidate.diameter < reference.diameter
 *   - `leaner`  — fill where candidate.diameter > reference.diameter
 *
 * Each entry is `[x, lowY, highY]`. Stations that don't have real data on
 * *both* curves are emitted as `[x, null, null]` so the series draws a gap
 * instead of a bogus fill down to 0.
 *
 * We deliberately emit an entry for every station (including gaps) rather
 * than only populated stations so the X axis alignment matches the main line
 * series exactly.
 */
export function buildDiffSeriesData(
  reference: Needle,
  candidate: Needle
): {
  richer: Array<[number, number | null, number | null]>;
  leaner: Array<[number, number | null, number | null]>;
} {
  const stationCount = Math.max(reference.data.length, candidate.data.length);
  const richer: Array<[number, number | null, number | null]> = [];
  const leaner: Array<[number, number | null, number | null]> = [];

  for (let i = 0; i < stationCount; i += 1) {
    const r = reference.data[i];
    const c = candidate.data[i];
    const valid = typeof r === 'number' && r > 0 && typeof c === 'number' && c > 0;

    if (!valid) {
      richer.push([i, null, null]);
      leaner.push([i, null, null]);
      continue;
    }

    if (c < r) {
      // candidate richer in this station — fill between candidate (low) and ref (high)
      richer.push([i, c as number, r as number]);
      leaner.push([i, null, null]);
    } else if (c > r) {
      leaner.push([i, r as number, c as number]);
      richer.push([i, null, null]);
    } else {
      richer.push([i, null, null]);
      leaner.push([i, null, null]);
    }
  }

  return { richer, leaner };
}

/** Human-readable label for a band. */
export function bandLabel(band: NeedleBand): string {
  switch (band) {
    case 'low':
      return 'Low (off-idle → ~2500 rpm)';
    case 'mid':
      return 'Mid (cruise → ~4000 rpm)';
    case 'high':
      return 'High (WOT → redline)';
  }
}
