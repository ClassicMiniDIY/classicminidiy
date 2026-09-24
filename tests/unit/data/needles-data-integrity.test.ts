import { describe, it, expect } from 'vitest';
import { getReferenceDataset } from '~~/server/utils/referenceData';

// ---------------------------------------------------------------------------
// Why this file exists
//
// SU needle data is a POSITIONAL series: each `data` array is 16 stations down
// the needle, so the ordering IS the data. A DynamoDB Number Set once scrambled
// every row and dropped repeated values (16 in, 14 out), and every number still
// looked plausible (ClassicMiniDIY/classicminidiy-supabase#64).
//
// The data is published in Supabase (reference dataset `needles`), and the same
// rules are enforced at PUBLISH time by publish-reference-data, so a bad needle
// never reaches here. This file keeps the web's own check on what it serves:
// the fixtures in unit runs, the live snapshot in the deploy job
// (`bun run test:reference-live`). The whitespace-stripped hash pin and the
// fixed count of 710 are gone: the count changes when a needle is published,
// and the editor shows it in the diff instead.
// ---------------------------------------------------------------------------

const STATIONS_PER_NEEDLE = 16;

type NeedleRecord = { name: string; size: number; data: number[] };

const needles = (await getReferenceDataset<NeedleRecord[]>('needles')).value;
const defaultNeedles = (await getReferenceDataset<NeedleRecord[]>('default_needles')).value;

// ---------------------------------------------------------------------------
// Ordering integrity — the checks that would have caught the DynamoDB bug
// ---------------------------------------------------------------------------
describe('needles ordering integrity', () => {
  it('has not been sorted — arrays are in taper order, not numeric order', () => {
    // A Number Set round-trip returns values in set order. The single loudest
    // symptom is that arrays come back sorted. Real taper data is not.
    const sortedAscending = needles.filter((n) => {
      const values = n.data.map(Number);
      return values.every((v, i) => i === 0 || values[i - 1] <= v);
    });

    // 407 needles end in one or more zeros, so an ascending run is only
    // suspicious when it covers a needle with genuine variation.
    const suspicious = sortedAscending.filter((n) => new Set(n.data.map(Number)).size > 2);
    expect(suspicious.map((n) => n.name)).toEqual([]);
  });

  it('preserves repeated values rather than deduplicating them', () => {
    // 410 of 709 needles repeat at least one value. A set-backed store loses
    // those entries entirely, so assert every needle still carries a full
    // 16 stations even where values collide.
    const withRepeats = needles.filter((n) => new Set(n.data.map(Number)).size < n.data.length);

    expect(withRepeats.length).toBeGreaterThan(0);
    for (const needle of withRepeats) {
      expect(needle.data).toHaveLength(STATIONS_PER_NEEDLE);
    }
  });
});

// ---------------------------------------------------------------------------
// Shape invariants
// ---------------------------------------------------------------------------
describe('needles shape', () => {
  it(`gives every needle exactly ${STATIONS_PER_NEEDLE} stations`, () => {
    const wrongLength = needles
      .filter((n) => n.data.length !== STATIONS_PER_NEEDLE)
      .map((n) => `${n.name} (${n.data.length})`);
    expect(wrongLength).toEqual([]);
  });

  it('has finite, non-negative numeric values throughout', () => {
    const bad = needles
      .filter((n) => n.data.some((v) => !Number.isFinite(Number(v)) || Number(v) < 0))
      .map((n) => n.name);
    expect(bad).toEqual([]);
  });

  it('has unique needle names', () => {
    const names = needles.map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only the three known needle sizes', () => {
    const sizes = [...new Set(needles.map((n) => String(n.size)))].sort();
    expect(sizes).toEqual(['0.09', '0.1', '0.125']);
  });
});

// ---------------------------------------------------------------------------
// Starter set consistency
// ---------------------------------------------------------------------------
describe('default_needles', () => {
  it('references needles that exist in the canonical set', () => {
    const canonical = new Map(needles.map((n) => [n.name, n]));
    const missing = defaultNeedles.filter((n) => !canonical.has(n.name)).map((n) => n.name);
    expect(missing).toEqual([]);
  });

  it('carries data identical to the canonical record, in order', () => {
    const canonical = new Map(needles.map((n) => [n.name, n]));
    for (const starter of defaultNeedles) {
      expect(starter.data).toEqual(canonical.get(starter.name)?.data);
    }
  });
});
