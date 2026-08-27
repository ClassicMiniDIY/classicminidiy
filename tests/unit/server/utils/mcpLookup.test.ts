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
