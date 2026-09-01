// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { lookup, listSections, type LookupData } from '~/server/utils/mcpLookup';

const DATA: LookupData = {
  engineTable: {
    title: 'Engine',
    items: [
      { name: 'Crankshaft Thrust Washer Endfloat', thou: '0.002 - 0.003', mm: '0.05 - 0.07', notes: 'perf: .005' },
      { name: 'Main Bearing Bolts', lbft: '63', nm: '85', notes: '1275' },
      { name: 'Camshaft Nut', lbft: '66', nm: '90', notes: '848cc, 998cc' },
    ],
  },
  gearboxTable: {
    title: 'Gearbox',
    items: [{ name: 'Crankshaft Primary Gear Endfloat', thou: '0.0025 - 0.0035', mm: '0.06 - 0.09' }],
  },
  emptyTable: { title: 'Empty' },
};

describe('server/utils/mcpLookup', () => {
  it('returns everything when no query is given', () => {
    expect(lookup(DATA).totalMatches).toBe(4);
  });

  it('matches a term in any field, not just the name', () => {
    expect(lookup(DATA, { query: '848cc' }).matches[0].item.name).toBe('Camshaft Nut');
    expect(lookup(DATA, { query: '90' }).totalMatches).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    expect(lookup(DATA, { query: 'CAMSHAFT' }).totalMatches).toBe(1);
  });

  // ANDing the terms is what stops "crankshaft endfloat" returning every
  // crankshaft row; ORing would make multi-word queries useless.
  it('requires every term to match, not any', () => {
    const anyTerm = lookup(DATA, { query: 'crankshaft' }).totalMatches;
    const allTerms = lookup(DATA, { query: 'crankshaft primary' }).totalMatches;
    expect(anyTerm).toBe(2);
    expect(allTerms).toBe(1);
  });

  it('filters by section key or by section title', () => {
    expect(lookup(DATA, { section: 'gearboxTable' }).totalMatches).toBe(1);
    expect(lookup(DATA, { section: 'Gearbox' }).totalMatches).toBe(1);
    expect(lookup(DATA, { section: 'GEARBOX' }).totalMatches).toBe(1);
  });

  it('combines a section filter with a query', () => {
    expect(lookup(DATA, { section: 'Engine', query: 'crankshaft' }).totalMatches).toBe(1);
  });

  it('tags each match with its section', () => {
    const m = lookup(DATA, { query: 'primary' }).matches[0];
    expect(m.section).toBe('gearboxTable');
    expect(m.sectionTitle).toBe('Gearbox');
  });

  it('reports truncation rather than silently dropping matches', () => {
    const r = lookup(DATA, { limit: 2 });
    expect(r.matches).toHaveLength(2);
    expect(r.totalMatches).toBe(4);
    expect(r.truncated).toBe(true);
  });

  it('does not report truncation when everything fits', () => {
    expect(lookup(DATA, { limit: 50 }).truncated).toBe(false);
  });

  it('always lists the available sections so a miss is actionable', () => {
    const r = lookup(DATA, { query: 'definitely-not-present' });
    expect(r.totalMatches).toBe(0);
    expect(r.availableSections.map((s) => s.section)).toContain('engineTable');
  });

  it('tolerates a section with no items array', () => {
    expect(listSections(DATA).find((s) => s.section === 'emptyTable')?.itemCount).toBe(0);
    expect(() => lookup(DATA, { section: 'emptyTable' })).not.toThrow();
  });

  it('returns no items for a non-positive limit but still counts them', () => {
    const r = lookup(DATA, { limit: 0 });
    expect(r.matches).toHaveLength(0);
    expect(r.totalMatches).toBe(4);
    expect(r.truncated).toBe(true);
  });
});

/**
 * AND matching is correct and stays — but it can hide the row the caller wanted,
 * silently, behind a confident-looking single hit. `data/torqueSpecs.json` names
 * the same fastener differently across engine variants, so "main bearing bolts"
 * returns only the 848/998 row while the two 1275 rows (named "set screws" and
 * "nuts") vanish. That shipped a hedged answer to a real 1275 question.
 */
describe('near-miss reporting', () => {
  const VARIANTS: LookupData = {
    engineTable: {
      title: 'Engine',
      items: [
        { name: 'Main Bearing Bolts', lbft: '63', notes: '848cc, 998cc' },
        { name: 'Main Bearing set screws (early type)', lbft: '67', notes: '970cc, 1071cc, 1275cc' },
        { name: 'Main Bearing nuts (later type)', lbft: '57', notes: '970cc, 1071cc, 1275cc' },
        { name: 'Camshaft Nut', lbft: '66', notes: '848cc, 998cc' },
      ],
    },
    suspensionTable: {
      title: 'Suspension',
      items: [{ name: 'Main Suspension Bolts', lbft: '30' }],
    },
  };

  it('surfaces the rows one term excluded, and names the term', () => {
    const r = lookup(VARIANTS, { query: 'main bearing bolts', section: 'Engine' });

    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].item.name).toBe('Main Bearing Bolts');

    const related = r.related.map((m) => m.item.name);
    expect(related).toContain('Main Bearing set screws (early type)');
    expect(related).toContain('Main Bearing nuts (later type)');
    expect(r.related.every((m) => m.excludedBy === 'bolts')).toBe(true);
  });

  it('never repeats a row that already matched', () => {
    const r = lookup(VARIANTS, { query: 'main bearing bolts', section: 'Engine' });
    const names = new Set(r.matches.map((m) => m.item.name));
    expect(r.related.some((m) => names.has(m.item.name as string))).toBe(false);
  });

  it('respects the section filter, so a hint cannot come from a section the caller excluded', () => {
    // 'Main Suspension Bolts' matches "main bolts" but lives in another section.
    const r = lookup(VARIANTS, { query: 'main bearing bolts', section: 'Engine' });
    expect(r.related.map((m) => m.section)).not.toContain('suspensionTable');
  });

  it('stays quiet for a single-term query, which cannot be over-narrow', () => {
    expect(lookup(VARIANTS, { query: 'bearing' }).related).toEqual([]);
    expect(lookup(VARIANTS, {}).related).toEqual([]);
  });

  it('stays quiet once the query returned more than one row', () => {
    // Measured on the real torque data: at two hits the hint is already half
    // noise, and at three it collapses — "flywheel bolts" yields 22 near-misses
    // that are just other rows containing "bolts". A hint nobody can trust is a
    // hint nobody reads, so it is limited to the case that actually failed.
    const r = lookup(VARIANTS, { query: 'main bearing' });
    expect(r.totalMatches).toBe(3);
    expect(r.related).toEqual([]);

    const two = lookup(VARIANTS, { query: 'main bearing 1275', section: 'Engine' });
    expect(two.totalMatches).toBe(2);
    expect(two.related).toEqual([]);
  });

  it('still reports near-misses when NOTHING matched', () => {
    // "nothing matched, but these almost did" is the whole useful answer here.
    const r = lookup(VARIANTS, { query: 'main bearing studs', section: 'Engine' });
    expect(r.totalMatches).toBe(0);
    expect(r.related.map((m) => m.item.name)).toContain('Main Bearing Bolts');
    expect(r.related.every((m) => m.excludedBy === 'studs')).toBe(true);
  });

  it('gives a count-only caller no row payloads through the side door', () => {
    // `limit <= 0` is documented as "count only — never silently return
    // everything". Near-miss ROWS are rows, so the contract has to hold for
    // them too, and asserting only on `matches` would miss it.
    const r = lookup(VARIANTS, { query: 'main bearing bolts', section: 'Engine', limit: 0 });
    expect(r.matches).toEqual([]);
    expect(r.related).toEqual([]);
    expect(r.totalMatches).toBe(1);
  });

  it('attributes a row to the term it is actually missing, whatever the word order', () => {
    // Attribution used to depend on which relaxation reached a row first, so the
    // same row could be blamed on a different word purely by reordering the
    // query. It is now a property of the row: the one term it does not contain.
    const a = lookup(VARIANTS, { query: 'main bearing bolts', section: 'Engine' });
    const b = lookup(VARIANTS, { query: 'bolts bearing main', section: 'Engine' });
    const by = (r: typeof a) => r.related.map((m) => `${m.item.name}:${m.excludedBy}`).sort();
    expect(by(a)).toEqual(by(b));
    expect(a.related.every((m) => m.excludedBy === 'bolts')).toBe(true);
  });

  it('does not let the first query word crowd out the rest of the hint', () => {
    // The bug this replaced: the cap was filled term by term in QUERY order, so
    // twelve near-misses from dropping the first word consumed the whole budget
    // and the row from dropping the last word never appeared — on a torque query
    // the last word is the fastener type, which is the one that matters.
    // Near-misses are now found in one dataset pass, so no query word is
    // privileged and rows excluded by different terms appear together.
    const CROWDED: LookupData = {
      t: {
        title: 'T',
        items: [
          { name: 'alpha beta wanted' },
          ...Array.from({ length: 12 }, (_, i) => ({ name: `beta gamma filler ${i}` })),
        ],
      },
    };
    const r = lookup(CROWDED, { query: 'alpha beta gamma' });
    expect(r.totalMatches).toBe(0);
    expect(r.related.map((m) => m.item.name)).toContain('alpha beta wanted');
    expect(new Set(r.related.map((m) => m.excludedBy))).toEqual(new Set(['gamma', 'alpha']));
  });

  it('says so when the near-miss list was cut', () => {
    // Truncation is by dataset order, because there is no principled way to
    // rank one near-miss above another — so the one thing that must not happen
    // is doing it silently. Same contract as `truncated` for matches.
    const MANY: LookupData = {
      t: { title: 'T', items: Array.from({ length: 25 }, (_, i) => ({ name: `beta gamma row ${i}` })) },
    };
    const r = lookup(MANY, { query: 'alpha beta gamma' });
    expect(r.related).toHaveLength(10);
    expect(r.relatedTruncated).toBe(true);
  });

  it('does not claim truncation when the whole hint fits', () => {
    const r = lookup(VARIANTS, { query: 'main bearing bolts', section: 'Engine' });
    expect(r.related.length).toBeLessThan(10);
    expect(r.relatedTruncated).toBe(false);
  });

  it('caps the hint so it cannot swamp the answer', () => {
    const many: LookupData = {
      t: {
        title: 'T',
        items: Array.from({ length: 40 }, (_, i) => ({ name: `Widget ${i} alpha` })),
      },
    };
    const r = lookup(many, { query: 'alpha zzz' });
    expect(r.totalMatches).toBe(0);
    expect(r.related.length).toBeLessThanOrEqual(10);
  });
});
