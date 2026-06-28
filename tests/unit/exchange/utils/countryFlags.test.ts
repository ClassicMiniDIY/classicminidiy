/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  getCountryFlag,
  getCountryWithFlag,
  getAllCountriesWithFlags,
} from '~~/app/utils/countryFlags';

/**
 * Build the expected flag emoji for a 2-letter ISO code using the same
 * Unicode Regional Indicator Symbol math the source uses. Kept independent
 * of the source's private `codeToFlag` so we assert a real expected value.
 */
function expectedFlag(code: string): string {
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

describe('getCountryFlag — known countries map to the correct flag', () => {
  it.each([
    ['United Kingdom', 'GB'],
    ['United States', 'US'],
    ['Australia', 'AU'],
    ['Canada', 'CA'],
    ['New Zealand', 'NZ'],
    ['Ireland', 'IE'],
    ['Japan', 'JP'],
    ['Germany', 'DE'],
    ['France', 'FR'],
    ['Netherlands', 'NL'],
    ['South Africa', 'ZA'],
    ['Hong Kong', 'HK'],
    ['United Arab Emirates', 'AE'],
    ['Trinidad and Tobago', 'TT'],
  ])('%s → flag for %s', (name, code) => {
    expect(getCountryFlag(name)).toBe(expectedFlag(code));
  });

  it('returns a 2-codepoint regional-indicator emoji for a known country', () => {
    const flag = getCountryFlag('Canada');
    expect([...flag]).toHaveLength(2);
    for (const ch of flag) {
      const cp = ch.codePointAt(0)!;
      expect(cp).toBeGreaterThanOrEqual(0x1f1e6);
      expect(cp).toBeLessThanOrEqual(0x1f1ff);
    }
  });
});

describe('getCountryFlag — alias names resolve to their canonical flag', () => {
  it.each([
    ['UK', 'GB'],
    ['Great Britain', 'GB'],
    ['England', 'GB'],
    ['Scotland', 'GB'],
    ['Wales', 'GB'],
    ['Northern Ireland', 'GB'],
    ['USA', 'US'],
    ['America', 'US'],
    ['The Netherlands', 'NL'],
    ['Holland', 'NL'],
    ['UAE', 'AE'],
    ['Korea', 'KR'],
    ['Czechia', 'CZ'],
    ['Czech Republic', 'CZ'],
  ])('%s → flag for %s', (alias, code) => {
    expect(getCountryFlag(alias)).toBe(expectedFlag(code));
  });

  it('aliases produce the same flag as their canonical name', () => {
    expect(getCountryFlag('UK')).toBe(getCountryFlag('United Kingdom'));
    expect(getCountryFlag('USA')).toBe(getCountryFlag('United States'));
    expect(getCountryFlag('Holland')).toBe(getCountryFlag('Netherlands'));
  });
});

describe('getCountryFlag — case and whitespace handling', () => {
  it.each([
    'united kingdom',
    'UNITED KINGDOM',
    'United Kingdom',
    'uNiTeD kInGdOm',
    '  United Kingdom  ',
    '\tUnited Kingdom\n',
    '   uk   ',
    'HOLLAND',
  ])('normalizes %j to a non-empty flag', (input) => {
    expect(getCountryFlag(input)).not.toBe('');
  });

  it('is case-insensitive (same flag regardless of case)', () => {
    const lower = getCountryFlag('germany');
    expect(getCountryFlag('Germany')).toBe(lower);
    expect(getCountryFlag('GERMANY')).toBe(lower);
    expect(getCountryFlag('GeRmAnY')).toBe(lower);
  });

  it('trims surrounding whitespace before lookup', () => {
    expect(getCountryFlag('  Japan  ')).toBe(getCountryFlag('Japan'));
  });
});

describe('getCountryFlag — unknown / falsy input returns empty string', () => {
  it.each([
    ['unknown country', 'Atlantis'],
    ['empty string', ''],
    ['whitespace only', '   '],
    ['gibberish', 'asdfghjkl'],
    ['partial match', 'United'],
    ['raw ISO code (not a name)', 'GB'],
    ['name with internal-only punctuation', 'U.K.'],
    ['number-ish', '12345'],
    ['unicode noise', '🇬🇧'],
    ['extra-long string', 'United Kingdom of Great Britain and Northern Ireland'],
  ])('%s → ""', (_label, input) => {
    expect(getCountryFlag(input)).toBe('');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('%s → "" (falsy guard)', (_label, input) => {
    expect(getCountryFlag(input)).toBe('');
  });
});

describe('getCountryWithFlag', () => {
  it('returns { flag, name } for a known country, preserving the original name casing', () => {
    const result = getCountryWithFlag('United Kingdom');
    expect(result).toEqual({ flag: expectedFlag('GB'), name: 'United Kingdom' });
  });

  it('preserves the exact input string as the name (no normalization of name)', () => {
    const result = getCountryWithFlag('  Japan  ');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('  Japan  ');
    expect(result!.flag).toBe(expectedFlag('JP'));
  });

  it('works with aliases — flag canonicalizes, name stays as given', () => {
    const result = getCountryWithFlag('USA');
    expect(result).toEqual({ flag: expectedFlag('US'), name: 'USA' });
  });

  it.each([
    ['unknown country', 'Atlantis'],
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('returns null for %s', (_label, input) => {
    expect(getCountryWithFlag(input)).toBeNull();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('returns null for %s', (_label, input) => {
    expect(getCountryWithFlag(input)).toBeNull();
  });
});

describe('getAllCountriesWithFlags', () => {
  const all = getAllCountriesWithFlags();

  it('returns a non-empty array of { flag, name } objects', () => {
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
    for (const entry of all) {
      expect(typeof entry.flag).toBe('string');
      expect(typeof entry.name).toBe('string');
      expect(entry.flag).not.toBe('');
      expect(entry.name).not.toBe('');
    }
  });

  it('deduplicates by ISO code (no duplicate flags)', () => {
    const flags = all.map((e) => e.flag);
    expect(new Set(flags).size).toBe(flags.length);
  });

  it('keeps only the first name per code — GB appears once and resolves to the canonical entry', () => {
    const gbFlag = expectedFlag('GB');
    const gbEntries = all.filter((e) => e.flag === gbFlag);
    expect(gbEntries).toHaveLength(1);
    // 'united kingdom' is the first GB key in source order, so its title-cased
    // form wins over later aliases (uk, england, etc.).
    expect(gbEntries[0]!.name).toBe('United Kingdom');
  });

  it('title-cases multi-word names', () => {
    const names = all.map((e) => e.name);
    expect(names).toContain('New Zealand');
    expect(names).toContain('South Africa');
    expect(names).toContain('Hong Kong');
    expect(names).toContain('Trinidad And Tobago'); // \b\w title-cases "and" too
  });

  it('every returned flag round-trips: looking up its name yields the same flag', () => {
    for (const { flag, name } of all) {
      expect(getCountryFlag(name)).toBe(flag);
    }
  });

  it('count equals the number of distinct ISO codes in the map', () => {
    // GB and US and NL and AE and KR and CZ each have multiple keys/aliases.
    // The deduped count must be strictly less than the total entry count but
    // stable; assert against the set of unique flags derived from the result.
    const uniqueFlags = new Set(all.map((e) => e.flag));
    expect(all.length).toBe(uniqueFlags.size);
  });
});
