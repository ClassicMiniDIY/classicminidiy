import { describe, it, expect } from 'vitest';
import { REFERENCE_NOUNS } from '~~/data/models/referenceNouns';
import { getReferenceDataset } from '~~/server/utils/referenceData';

// Published reference data: the fixtures, or the live snapshot under
// REFERENCE_SOURCE=snapshot (`bun run test:reference-live`, run by the deploy
// job before every deploy, so a published rename cannot ship a broken noun).
const torqueSpecs = (await getReferenceDataset('torque_specs')).value;
const commonClearances = (await getReferenceDataset('common_clearances')).value;

/**
 * `data/models/referenceNouns.ts` maps what people type to ONE row of the
 * torque or clearance tables, and the search palette renders that row's
 * figure as a direct answer. A row name that drifts from the published data would
 * render a wrong number as an answer — worse than no card — so this walks
 * every entry against the live data and fails the build instead.
 */

type Table = Record<string, { title?: string; items?: { name: string }[] }>;
const TABLES: Record<string, Table> = {
  torque: torqueSpecs as Table,
  clearance: commonClearances as Table,
};

describe('REFERENCE_NOUNS', () => {
  it.each(REFERENCE_NOUNS.map((noun) => [noun.table, noun.section, noun.item] as const))(
    '%s › %s › %s names a real row',
    (table, section, item) => {
      const rows = TABLES[table]?.[section]?.items ?? [];
      expect(rows.map((row) => row.name)).toContain(item);
    }
  );

  it('keeps every term lower-case, trimmed, and unique across the file', () => {
    const seen = new Map<string, string>();
    for (const noun of REFERENCE_NOUNS) {
      for (const term of noun.terms) {
        expect(term).toBe(term.trim().toLowerCase());
        expect(term.length).toBeGreaterThan(0);
        const owner = seen.get(term);
        expect(owner, `"${term}" appears on both "${owner}" and "${noun.item}"`).toBeUndefined();
        seen.set(term, noun.item);
      }
    }
  });
});
