import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import Needles from '~/data/needles.json';
import DefaultNeedles from '~/data/default-needles.json';

// ---------------------------------------------------------------------------
// Why this file exists
//
// `data/needles.json` is the canonical SU needle dataset. Each `data` array is
// a POSITIONAL series — 16 stations down the needle — so the ordering IS the
// data. A reordered array is not a formatting difference, it is a different
// needle, and every number in it still looks plausible.
//
// This was not hypothetical. A DynamoDB `needles` table stored `data` as a
// Number Set (`NS`), which is unordered and deduplicating. All 54 of its rows
// came back scrambled, and because 410 of the 709 needles legitimately repeat a
// value (usually trailing zeros), an `NS` round-trip also silently DROPPED
// entries — 16 values in, 14 out. That table was deleted in July 2026 and was
// never used as a migration source. See ClassicMiniDIY/classicminidiy-supabase#64.
//
// Three byte-identical copies of this file ship today:
//   classicminidiy/data/needles.json                                (canonical)
//   ClassicMiniToolbox-android/app/src/main/assets/needles.json
//   Classic Mini DIY Toolbox/Data/needles.json                      (iOS)
//
// Each repo pins the SAME canonical hash below, so drift in any one copy fails
// that repo's CI. If you legitimately change needle data, update the hash in
// ALL THREE repos in the same change, and re-run the copy scripts in
// `Native CMDIY Apps/shared-data/`.
// ---------------------------------------------------------------------------

/**
 * Whitespace-stripped SHA-256 of `data/needles.json`.
 *
 * Whitespace is stripped so that a prettier reformat (which has happened three
 * times in this file's history) does not fail CI, while any change to a value,
 * to array ordering, or to record ordering does. Safe to do byte-wise here
 * because no needle name contains whitespace and the file is pure ASCII.
 *
 * Deliberately duplicated as a literal in the Android and iOS test suites —
 * the whole point is that three independent repos agree on one value.
 */
const CANONICAL_NEEDLES_SHA256 = 'fa1769214755f4bc0a78d35880e48795f1c1846d05abecf07685c7e962355273';

const EXPECTED_NEEDLE_COUNT = 709;
const STATIONS_PER_NEEDLE = 16;

type NeedleRecord = { name: string; size: number; data: number[] };

const needles = Needles as NeedleRecord[];

function canonicalHash(filePath: string): string {
  const raw = readFileSync(resolve(process.cwd(), filePath), 'utf8');
  return createHash('sha256').update(raw.replace(/\s+/g, '')).digest('hex');
}

// ---------------------------------------------------------------------------
// Ordering integrity — the checks that would have caught the DynamoDB bug
// ---------------------------------------------------------------------------
describe('needles.json ordering integrity', () => {
  it('matches the canonical whitespace-stripped hash', () => {
    // If this fails, needle data changed. That is allowed — but it must be
    // deliberate, and the Android and iOS copies must change with it.
    expect(canonicalHash('data/needles.json')).toBe(CANONICAL_NEEDLES_SHA256);
  });

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
describe('needles.json shape', () => {
  it(`contains exactly ${EXPECTED_NEEDLE_COUNT} needles`, () => {
    expect(needles).toHaveLength(EXPECTED_NEEDLE_COUNT);
  });

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
describe('default-needles.json', () => {
  it('references needles that exist in the canonical set', () => {
    const canonical = new Map(needles.map((n) => [n.name, n]));
    const missing = (DefaultNeedles as NeedleRecord[]).filter((n) => !canonical.has(n.name)).map((n) => n.name);
    expect(missing).toEqual([]);
  });

  it('carries data identical to the canonical record, in order', () => {
    const canonical = new Map(needles.map((n) => [n.name, n]));
    for (const starter of DefaultNeedles as NeedleRecord[]) {
      expect(starter.data).toEqual(canonical.get(starter.name)?.data);
    }
  });
});
