/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  MAX_CONTENT_LENGTH,
  VALID_CATEGORIES,
  VALID_CONDITION_PREFERENCES,
  ADMIN_CACHE_TTL_MS,
  MAX_BUDGET,
} from '~~/app/utils/constants';

describe('exchange constants — numeric values', () => {
  it.each([
    ['MAX_CONTENT_LENGTH', MAX_CONTENT_LENGTH, 2000],
    ['ADMIN_CACHE_TTL_MS', ADMIN_CACHE_TTL_MS, 2 * 60 * 1000],
    ['MAX_BUDGET', MAX_BUDGET, 10_000_000],
  ])('%s equals %d', (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it.each([
    ['MAX_CONTENT_LENGTH', MAX_CONTENT_LENGTH],
    ['ADMIN_CACHE_TTL_MS', ADMIN_CACHE_TTL_MS],
    ['MAX_BUDGET', MAX_BUDGET],
  ])('%s is a positive finite integer', (_name, value) => {
    expect(typeof value).toBe('number');
    expect(Number.isInteger(value)).toBe(true);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  });

  it('ADMIN_CACHE_TTL_MS is exactly 2 minutes in ms', () => {
    expect(ADMIN_CACHE_TTL_MS).toBe(120_000);
  });

  it('MAX_BUDGET is 10 million', () => {
    expect(MAX_BUDGET).toBe(10000000);
  });
});

describe('VALID_CATEGORIES', () => {
  it('has the exact expected membership', () => {
    expect(VALID_CATEGORIES).toEqual(['vehicle', 'engine', 'parts']);
  });

  it('contains exactly 3 entries', () => {
    expect(VALID_CATEGORIES).toHaveLength(3);
  });

  it('has no duplicate entries', () => {
    expect(new Set(VALID_CATEGORIES).size).toBe(VALID_CATEGORIES.length);
  });

  it.each(['vehicle', 'engine', 'parts'])('includes %s', (cat) => {
    expect(VALID_CATEGORIES).toContain(cat);
  });

  it.each(['', ' ', 'Vehicle', 'VEHICLE', 'car', 'wheels', 'misc', 'parts ', null, undefined, 0])(
    'rejects non-member value %p',
    (cat) => {
      expect(VALID_CATEGORIES).not.toContain(cat as unknown as string);
    }
  );

  it('every entry is a non-empty lowercase string', () => {
    for (const cat of VALID_CATEGORIES) {
      expect(typeof cat).toBe('string');
      expect(cat.length).toBeGreaterThan(0);
      expect(cat).toBe(cat.toLowerCase());
      expect(cat.trim()).toBe(cat);
    }
  });
});

describe('VALID_CONDITION_PREFERENCES', () => {
  it('has the exact expected membership in order', () => {
    expect(VALID_CONDITION_PREFERENCES).toEqual(['any', 'excellent', 'good', 'fair', 'project']);
  });

  it('contains exactly 5 entries', () => {
    expect(VALID_CONDITION_PREFERENCES).toHaveLength(5);
  });

  it('has no duplicate entries', () => {
    expect(new Set(VALID_CONDITION_PREFERENCES).size).toBe(VALID_CONDITION_PREFERENCES.length);
  });

  it('includes the wildcard "any" preference', () => {
    expect(VALID_CONDITION_PREFERENCES).toContain('any');
  });

  it.each(['any', 'excellent', 'good', 'fair', 'project'])('includes %s', (pref) => {
    expect(VALID_CONDITION_PREFERENCES).toContain(pref);
  });

  it.each(['', ' ', 'Any', 'EXCELLENT', 'new', 'used', 'poor', 'fair ', null, undefined])(
    'rejects non-member value %p',
    (pref) => {
      expect(VALID_CONDITION_PREFERENCES).not.toContain(pref as unknown as string);
    }
  );

  it('every entry is a non-empty lowercase string', () => {
    for (const pref of VALID_CONDITION_PREFERENCES) {
      expect(typeof pref).toBe('string');
      expect(pref.length).toBeGreaterThan(0);
      expect(pref).toBe(pref.toLowerCase());
      expect(pref.trim()).toBe(pref);
    }
  });
});

describe('cross-constant invariants', () => {
  it('VALID_CATEGORIES and VALID_CONDITION_PREFERENCES share no values', () => {
    const overlap = VALID_CATEGORIES.filter((c) => (VALID_CONDITION_PREFERENCES as readonly string[]).includes(c));
    expect(overlap).toEqual([]);
  });

  it('both lists are arrays', () => {
    expect(Array.isArray(VALID_CATEGORIES)).toBe(true);
    expect(Array.isArray(VALID_CONDITION_PREFERENCES)).toBe(true);
  });
});
