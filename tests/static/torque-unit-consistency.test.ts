// @vitest-environment node
import { describe, expect, it } from 'vitest';
import torqueSpecs from '../../data/torqueSpecs.json';

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
 */
const LBFT_TO_NM = 1.3558179;
const LBIN_TO_NM = 0.1129848;

/** Absolute and relative slack, because the published figures are rounded. */
const ABS_TOLERANCE_NM = 0.55;
const REL_TOLERANCE = 0.04;

/**
 * Rows whose imperial column is itself in doubt, so the conversion cannot be
 * checked yet. SHRINK-ONLY: an entry that starts converting cleanly fails this
 * test, so a fix cannot land without deleting its own exemption.
 *
 * `Alternator (16ACR) Shaft nut` is filed under `lbin`, but 25-30 lb-in is
 * 2.8-3.4 Nm — barely more than finger-tight for a nut holding a pulley against
 * belt tension — while its stated 34-41 Nm is the exact lb-FT conversion, and
 * 25-30 lb-ft is the figure usually quoted for that alternator. Either the
 * field name or the value is wrong, and picking the wrong one under-torques a
 * pulley nut by twelve. It needs the source manual, not arithmetic.
 */
const UNRESOLVED_SOURCE_UNIT = ['Alternator (16ACR) Shaft nut'];

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

  it('every row converts, except the documented unresolved ones', () => {
    const wrong: string[] = [];

    for (const { section, row } of rows) {
      if (UNRESOLVED_SOURCE_UNIT.includes(row.name ?? '')) continue;

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

  it('keeps the unresolved list shrink-only', () => {
    // An entry that now converts cleanly means the source unit was settled, and
    // the exemption must go with it — otherwise the list rots into a place
    // things are forgotten rather than a list of open questions.
    for (const name of UNRESOLVED_SOURCE_UNIT) {
      const entry = rows.find(({ row }) => row.name === name);
      expect(entry, `"${name}" is exempted but no longer exists in the data`).toBeTruthy();

      const row = entry?.row as Row;
      const field = row.lbft ? 'lbft' : 'lbin';
      const factor = field === 'lbft' ? LBFT_TO_NM : LBIN_TO_NM;
      const source = numbers(row[field] as string);
      const metric = numbers(row.nm as string);
      const converts =
        source.length === metric.length &&
        source.every(
          (v, i) =>
            Math.abs(v * factor - (metric[i] as number)) <= Math.max(ABS_TOLERANCE_NM, v * factor * REL_TOLERANCE)
        );

      expect(converts, `"${name}" now converts cleanly — delete it from UNRESOLVED_SOURCE_UNIT`).toBe(false);
    }
  });
});
