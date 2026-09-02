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
 * Absolute slack, PER SECTION, because the sections do not all derive their
 * metric column the same way.
 *
 * Everywhere the archive publishes a named fastener, the imperial figure is the
 * source and the metric one is converted from it, so the two should agree to
 * little more than rounding. 0.55 Nm is that bound, and it is the one that
 * caught the oil filter housing row being 1.34 out.
 *
 * `generalTable` is the exception and has to be, because its two columns are
 * INDEPENDENT: the MPI workshop manual prints both Nm and lb-ft for a general
 * fastener, each rounded on its own, so nothing is derived from anything. Its
 * 1/4 UNF row is 9 Nm against 6 lb-ft (8.13 converted) — correct as published,
 * and 0.87 apart.
 *
 * That single row is why this started as one global 1.2, which quietly halved
 * the guard on the other hundred-odd rows to admit twelve. Scoping the slack
 * keeps the derived sections held to the tight bound where the invariant
 * actually applies, and still catches an order-of-magnitude error in the
 * general table, which is the failure that matters there.
 */
const DEFAULT_ABS_TOLERANCE_NM = 0.55;
const SECTION_ABS_TOLERANCE_NM: Record<string, number> = { generalTable: 1.25 };

function toleranceFor(section: string): number {
  return SECTION_ABS_TOLERANCE_NM[section] ?? DEFAULT_ABS_TOLERANCE_NM;
}
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
        if (Math.abs(expected - actual) > Math.max(toleranceFor(section), expected * REL_TOLERANCE)) {
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
