import { describe, it, expect } from 'vitest';
import { formatMathValue } from '~/app/utils/mathBreakdown';

// ---------------------------------------------------------------------------
// formatMathValue
//
// These strings are what a reader keys into their own calculator to check our
// arithmetic, so the contract is narrow: never exponential, never padded with
// noise zeros, and never rounded so hard that a real term reads as zero.
// ---------------------------------------------------------------------------
describe('formatMathValue', () => {
  describe('integers', () => {
    it('renders a whole number without a decimal point', () => {
      expect(formatMathValue(1054)).toBe('1054');
    });

    it('renders zero as "0"', () => {
      expect(formatMathValue(0)).toBe('0');
    });

    it('keeps a negative whole number intact', () => {
      expect(formatMathValue(-12)).toBe('-12');
    });
  });

  describe('decimals', () => {
    it('caps at four decimal places by default', () => {
      expect(formatMathValue(318.18734567)).toBe('318.1873');
    });

    it('trims the trailing zeros toFixed pads on', () => {
      expect(formatMathValue(3.5)).toBe('3.5');
    });

    it('does not leave a bare trailing dot', () => {
      expect(formatMathValue(2.00001)).toBe('2');
    });

    it('honours an explicit precision', () => {
      expect(formatMathValue(0.00094883, 7)).toBe('0.0009488');
    });
  });

  describe('values a reader could not retype', () => {
    it('never emits exponential notation for a small number', () => {
      expect(formatMathValue(0.0000001, 7)).not.toContain('e');
    });

    it('falls back to the full value rather than collapsing to zero', () => {
      // 1e-9 rounds to 0.0000000 at 7dp; reporting "0" would claim a real term
      // contributes nothing.
      expect(parseFloat(formatMathValue(1e-9, 7))).toBeCloseTo(1e-9, 12);
    });
  });

  describe('non-finite input', () => {
    it('renders NaN as the placeholder', () => {
      expect(formatMathValue(NaN)).toBe('---');
    });

    it('renders Infinity as the placeholder', () => {
      expect(formatMathValue(Infinity)).toBe('---');
    });
  });
});
