import { describe, it, expect } from 'vitest';
import { toDateOrNull } from '~/server/utils/sanitize';

describe('toDateOrNull', () => {
  it('returns null for the registry empty-array default ([] / "[]")', () => {
    // The bug: [] is truthy, so `value || null` sent "[]" to a date column.
    expect(toDateOrNull([])).toBeNull();
    expect(toDateOrNull('[]')).toBeNull();
  });

  it('returns null for null, undefined, empty/whitespace strings, and objects', () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
    expect(toDateOrNull('')).toBeNull();
    expect(toDateOrNull('   ')).toBeNull();
    expect(toDateOrNull({})).toBeNull();
    expect(toDateOrNull('{}')).toBeNull();
  });

  it('passes a real date string through (trimmed) for Postgres to validate', () => {
    expect(toDateOrNull('1967-03-15')).toBe('1967-03-15');
    expect(toDateOrNull('  1967-03-15  ')).toBe('1967-03-15');
  });
});
