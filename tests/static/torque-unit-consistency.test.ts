// @vitest-environment node
import { describe, expect, it } from 'vitest';
import torqueSpecs from '../../data/torqueSpecs.json';
import { read, REPO_ROOT } from './_scan';

/**
 * Every metric torque figure must convert from the imperial one beside it.
 *
 * The imperial column is the SOURCE — it is what the original manuals printed.
 * Metric is a courtesy this project adds, which makes it derived data, and
 * derived data that disagrees with its source is simply wrong. Seven of 93 rows
 * did: one lb-ft rounding slip, and the whole Electrical section, which is
 * published in pound-INCHES and had been converted as though it were
 * pound-feet — about ten times high, on distributor clamp bolts and alternator
 * brush-box screws, the fasteners least able to survive it.
 *
 * Nothing catches this by reading the code, because both numbers look
 * plausible in isolation. Only the relationship between them is wrong, so the
 * relationship is what gets asserted.
 *
 * There are NO exemptions, deliberately. The one row that could not be resolved
 * by arithmetic — `Alternator (16ACR) Shaft nut`, filed as `"lbin": "25 to 30"`
 * with `"nm": "34 to 41"` — was REMOVED from the dataset rather than exempted.
 * Its metric figure is the exact lb-FT conversion of its imperial one, so either
 * the field name or the value is wrong, and 25-30 lb-in is barely more than
 * finger-tight for a nut holding a pulley against belt tension. A wrong figure
 * for a real fastener is worse than a missing one, and an exemption list is
 * where such a row would quietly live forever. It can be restored once the
 * source manual settles which column is right.
 */
const LBFT_TO_NM = 1.3558179;
const LBIN_TO_NM = 0.1129848;

/** Absolute and relative slack, because the published figures are rounded. */
const ABS_TOLERANCE_NM = 0.55;
const REL_TOLERANCE = 0.04;

interface Row {
  name?: string;
  lbft?: string;
  lbin?: string;
  nm?: string | number;
}

function numbers(value: string | number): number[] {
  return (String(value).match(/\d*\.?\d+/g) ?? []).map(Number);
}

describe('torque figures convert to their own metric column', () => {
  const rows: { section: string; row: Row }[] = [];
  for (const [section, table] of Object.entries(torqueSpecs as Record<string, { items?: Row[] }>)) {
    for (const row of table.items ?? []) rows.push({ section, row });
  }

  it('finds the dataset at all', () => {
    // A path or shape change would otherwise make every assertion below pass
    // against an empty list.
    expect(rows.length).toBeGreaterThanOrEqual(90);
  });

  it('every row converts', () => {
    const wrong: string[] = [];

    for (const { section, row } of rows) {
      const field = row.lbft ? 'lbft' : row.lbin ? 'lbin' : null;
      if (!field || row.nm === undefined || row.nm === '') continue;

      const factor = field === 'lbft' ? LBFT_TO_NM : LBIN_TO_NM;
      const source = numbers(row[field] as string);
      const metric = numbers(row.nm);

      // A range must stay a range: "45 to 50" cannot become a single figure.
      if (source.length !== metric.length) {
        wrong.push(`[${section}] ${row.name}: "${row[field]}" ${field} vs "${row.nm}" Nm — different shapes`);
        continue;
      }

      for (const [i, value] of source.entries()) {
        const expected = value * factor;
        const actual = metric[i] as number;
        if (Math.abs(expected - actual) > Math.max(ABS_TOLERANCE_NM, expected * REL_TOLERANCE)) {
          wrong.push(
            `[${section}] ${row.name}: ${value} ${field} is ${expected.toFixed(1)} Nm, but the row says ${actual}`
          );
        }
      }
    }

    expect(wrong, `metric figures that do not convert from their own source column:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('does not silently regain the row that was removed as bad data', () => {
    // Re-adding it is fine once the source unit is settled — but it has to come
    // back with a metric figure that converts, which the check above enforces.
    // This names it so a reappearance is a deliberate act, not an accident.
    const readded = rows.find(({ row }) => row.name === 'Alternator (16ACR) Shaft nut');
    expect(
      readded,
      'the 16ACR shaft nut is back: confirm against the source manual whether it is lb-in or lb-ft before keeping it'
    ).toBeUndefined();
  });

  it('the tool description states the real row counts', () => {
    // Removing one row left the description claiming "Electrical (6)". These
    // counts are the first thing the model reads about the dataset, and a stale
    // one tells it rows exist that do not. Nothing else checks them.
    const description = read(`${REPO_ROOT}server/mcp/tools/torque-specs.ts`);
    for (const [, table] of Object.entries(torqueSpecs as Record<string, { title?: string; items?: Row[] }>)) {
      const count = table.items?.length ?? 0;
      // The counts are written as "Engine (41 fasteners)" but "Suspension (24)",
      // so match the opening of the parenthetical rather than a fixed suffix.
      const title = String(table.title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`${title} \\(${count}[ )]`);
      expect(pattern.test(description), `the description does not say "${table.title} (${count}...)"`).toBe(true);
    }
  });
});
