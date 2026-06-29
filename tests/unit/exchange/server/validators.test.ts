/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// `validators.ts` throws H3's auto-imported `createError`. In the Nitro runtime
// this is a global; under vitest it is not, so stub it to a plain Error that
// carries `statusCode` + `message` (matching the shape the source reads).
vi.stubGlobal('createError', (opts: { statusCode: number; message?: string; statusMessage?: string }) => {
  const e = new Error(opts.message || opts.statusMessage);
  (e as any).statusCode = opts.statusCode;
  return e;
});

// The source imports `MAX_BUDGET` from `~/utils/constants`. Nuxt maps `~` to
// `app/`; the vitest config maps the `~/utils` subtree to `app/utils` so that
// import resolves here the same way it does at runtime. We import the same
// constant below to assert against the genuine value (no hardcoded copy).
import { validateBudgetValue, validateBudgetRange } from '~~/server/utils/exchange/validators';
import { MAX_BUDGET } from '~~/app/utils/constants';

/**
 * Helper: capture the error thrown by a validator (or `undefined` if none).
 * The source `throw`s the result of `createError`, which our stub makes a real
 * Error carrying `statusCode`, so `expect(fn).toThrow(...)` also works — but we
 * frequently want to inspect `statusCode`/`message` together.
 */
function thrown(fn: () => void): (Error & { statusCode?: number }) | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error & { statusCode?: number };
  }
  return undefined;
}

describe('validateBudgetValue', () => {
  // --- Optional: null / undefined are explicitly allowed (early return) ---
  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('returns without throwing when value is %s (optional)', (_label, value) => {
    expect(() => validateBudgetValue(value, 'Budget')).not.toThrow();
    expect(validateBudgetValue(value, 'Budget')).toBeUndefined();
  });

  // --- Happy path: valid in-range numbers ---
  it.each([
    ['zero (lower boundary)', 0],
    ['one', 1],
    ['a typical budget', 5000],
    ['MAX_BUDGET - 1 (just inside upper boundary)', MAX_BUDGET - 1],
    ['MAX_BUDGET (upper boundary, inclusive)', MAX_BUDGET],
    ['a fractional value', 1234.56],
  ])('accepts %s', (_label, value) => {
    expect(() => validateBudgetValue(value as number, 'Budget')).not.toThrow();
    expect(validateBudgetValue(value as number, 'Budget')).toBeUndefined();
  });

  // --- Invalid: out of numeric range ---
  it.each([
    ['negative', -1],
    ['large negative', -100000],
    ['just below zero (fractional)', -0.0001],
    ['above MAX_BUDGET by 1', MAX_BUDGET + 1],
    ['far above MAX_BUDGET', MAX_BUDGET * 2],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('throws 400 for %s', (_label, value) => {
    const err = thrown(() => validateBudgetValue(value as number, 'Budget'));
    expect(err).toBeInstanceOf(Error);
    expect(err?.statusCode).toBe(400);
  });

  // --- Invalid: wrong type (typeof !== 'number') ---
  it.each([
    ['string number', '5000'],
    ['empty string', ''],
    ['boolean true', true],
    ['boolean false', false],
    ['object', {}],
    ['array', [5000]],
    ['bigint', 5000n],
    ['symbol', Symbol('x')],
    ['function', () => 5000],
  ])('throws 400 for non-number: %s', (_label, value) => {
    const err = thrown(() => validateBudgetValue(value, 'Budget'));
    expect(err?.statusCode).toBe(400);
  });

  // --- NaN: typeof NaN === 'number' but NaN < 0 and NaN > MAX are both false,
  // so NaN slips past the range checks and does NOT throw. Documented behavior. ---
  it('does NOT throw for NaN (NaN comparisons are always false — passes through)', () => {
    expect(() => validateBudgetValue(NaN, 'Budget')).not.toThrow();
    expect(validateBudgetValue(NaN, 'Budget')).toBeUndefined();
  });

  // --- The label is interpolated into the error message, including MAX_BUDGET ---
  it('includes the label and formatted MAX_BUDGET in the error message', () => {
    const err = thrown(() => validateBudgetValue(-5, 'Maximum budget'));
    expect(err?.message).toBe(`Maximum budget must be between 0 and ${MAX_BUDGET.toLocaleString()}`);
  });

  it('uses the provided label verbatim for a different field', () => {
    const err = thrown(() => validateBudgetValue(MAX_BUDGET + 1, 'Minimum budget'));
    expect(err?.message).toMatch(/^Minimum budget must be between 0 and /);
  });
});

describe('validateBudgetRange', () => {
  // --- Optional: any null/undefined on either side short-circuits (no throw) ---
  it.each([
    ['both undefined', undefined, undefined],
    ['both null', null, null],
    ['min null, max set', null, 100],
    ['min set, max null', 100, null],
    ['min undefined, max set', undefined, 100],
    ['min set, max undefined', 100, undefined],
    // Even an "invalid" pairing is skipped when one side is nullish:
    ['min set high, max null (skipped)', 999999, null],
  ])('does not throw when %s', (_label, min, max) => {
    expect(() => validateBudgetRange(min as number | null, max as number | null)).not.toThrow();
    expect(validateBudgetRange(min as number | null, max as number | null)).toBeUndefined();
  });

  // --- Happy path: both present and min <= max ---
  it.each([
    ['min < max', 100, 500],
    ['min == max (boundary, allowed)', 500, 500],
    ['zero range at zero', 0, 0],
    ['min 0, max positive', 0, 1000],
    ['fractional min < max', 1.5, 2.5],
    ['equal fractional', 1.5, 1.5],
  ])('accepts %s', (_label, min, max) => {
    expect(() => validateBudgetRange(min, max)).not.toThrow();
    expect(validateBudgetRange(min, max)).toBeUndefined();
  });

  // --- Invalid: min > max throws 400 ---
  it.each([
    ['min > max by 1', 501, 500],
    ['min far greater than max', 1000000, 1],
    ['min positive, max zero', 100, 0],
    ['fractional min > max', 2.5, 1.5],
    ['negative min > negative max', -1, -2],
  ])('throws 400 when %s', (_label, min, max) => {
    const err = thrown(() => validateBudgetRange(min, max));
    expect(err).toBeInstanceOf(Error);
    expect(err?.statusCode).toBe(400);
    expect(err?.message).toBe('Minimum budget cannot exceed maximum budget');
  });

  // --- NaN edges: `min > max` with a NaN operand is false, so it never throws ---
  it.each([
    ['min NaN, max number', NaN, 100],
    ['min number, max NaN', 100, NaN],
    ['both NaN', NaN, NaN],
  ])('does not throw when %s (NaN comparison is false)', (_label, min, max) => {
    expect(() => validateBudgetRange(min, max)).not.toThrow();
  });

  // --- `!= null` (loose) catches both null and undefined but lets 0 through ---
  it('treats 0 as a present value (min 0 vs max 0 is a valid range)', () => {
    expect(() => validateBudgetRange(0, 0)).not.toThrow();
  });

  it('treats 0 vs negative max as out of order (throws)', () => {
    const err = thrown(() => validateBudgetRange(0, -1));
    expect(err?.statusCode).toBe(400);
  });
});
