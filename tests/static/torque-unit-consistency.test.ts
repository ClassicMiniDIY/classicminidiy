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
 * There are NO exemptions, and none is needed. The one row that could not be
 * reconciled by arithmetic — `Alternator (16ACR) Shaft nut` — turned out to be
 * a mislabelled COLUMN rather than a bad row: the whole Electrical section had
 * been filed as `lbin` when the source publishes it in lb-ft, which its kgm
 * column confirms independently. Correcting the column reconciled that row and
 * the five beside it, and the row was restored.
 */
const LBFT_TO_NM = 1.3558179;
const LBIN_TO_NM = 0.1129848;

/**
 * Absolute slack, because BOTH figures are rounded independently.
 *
 * An integer imperial figure could be anything within +/-0.5 lb-ft, which is
 * +/-0.68 Nm, and the metric figure carries its own +/-0.5 Nm. So two honestly
 * rounded columns can legitimately disagree by about 1.2 Nm, and a tighter
 * bound flags correct data: the general-fastener table's 1/4 UNF row is 9 Nm
 * and 6 lb-ft, which is 0.87 Nm apart and right.
 *
 * It is still far tighter than any real error this has caught. The Electrical
 * section was out by a factor of ten, and the oil filter housing row by 1.34.
 */
const ABS_TOLERANCE_NM = 1.2;
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
