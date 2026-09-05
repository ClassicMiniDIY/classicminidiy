/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  buildPartSearchFilter,
  safePartNumberPattern,
  safeDescriptionPattern,
  normalisePartNumber,
} from '~~/server/utils/partSearchFilter';

/**
 * These exist because the public search box returned HTTP 500 for `a,b`.
 *
 * PostgREST's or() is parsed as text — commas separate conditions, parens group
 * them — so a value carrying one changes the filter's SHAPE rather than
 * failing, and an unbalanced parse 500s the request. Separately the value lands
 * in an `ilike` pattern, where `%` and `_` are wildcards: searching `%` matched
 * all 10,073 parts.
 */
describe('part search filter', () => {
  it('normalises a part number the way the DB CHECK does', () => {
    expect(normalisePartNumber('12g-29.94')).toBe('12G2994');
    expect(normalisePartNumber(' ala 6654 ')).toBe('ALA6654');
  });

  it.each([
    ['a,b', 'AB'],
    ['a)or(b', 'AORB'],
    ["'; drop table parts;--", 'DROPTABLEPARTS'],
    ['12G2994', '12G2994'],
  ])('reduces %s to a safe part-number pattern', (input, expected) => {
    expect(safePartNumberPattern(input)).toBe(expected);
  });

  it.each(['a,b', 'a)or(b', '((((', "'; drop table parts;--", '*', '%'])(
    'never lets a PostgREST metacharacter through for %s',
    (input) => {
      const filter = buildPartSearchFilter(input);
      if (filter === null) return;
      // Split off the two known separators the builder itself adds, then assert
      // nothing structural survives inside a value.
      for (const clause of filter.split(',')) {
        const value = clause.split('.ilike.')[1] ?? '';
        expect(value).not.toMatch(/[(),]/);
        expect(value.replace(/^\*|\*$/g, '')).not.toMatch(/[*%_]/);
      }
    }
  );

  it('neutralises LIKE wildcards so % is not a match-everything', () => {
    // `%` alone reduces to nothing usable, so the caller returns no results
    // rather than the whole archive.
    expect(buildPartSearchFilter('%')).toBeNull();
    expect(safeDescriptionPattern('50% off')).not.toContain('%');
  });

  it('keeps only the punctuation that is safe inside an or() value', () => {
    // Slash and hyphen survive because real rows read like
    // WASHER-PLAIN - 1/4" x 9/16" O.D. and both carry meaning.
    expect(safeDescriptionPattern('1/4" washer')).toContain('/');
    expect(safeDescriptionPattern('idler-gear')).toContain('-');
    // Quotes, hash and ampersand do NOT. An earlier version allowed them on the
    // grounds that they appear in descriptions, and `'; drop table parts;--`
    // still 500d — a value carrying a quote can leave PostgREST's parse
    // unbalanced. ilike is a contains match, so dropping them costs nothing.
    expect(safeDescriptionPattern("O'ring & seal")).not.toMatch(/['&]/);
    expect(safeDescriptionPattern('a#b"c')).not.toMatch(/[#"]/);
  });

  it('still builds a useful filter for ordinary searches', () => {
    const filter = buildPartSearchFilter('idler gear');
    expect(filter).toContain('description.ilike.*idler gear*');
  });

  it('matches a part number and a description from one term', () => {
    const filter = buildPartSearchFilter('12G2994');
    expect(filter).toContain('part_number_norm.ilike.*12G2994*');
  });

  it('returns null when nothing usable remains', () => {
    expect(buildPartSearchFilter('()')).toBeNull();
    expect(buildPartSearchFilter('   ')).toBeNull();
  });
});
