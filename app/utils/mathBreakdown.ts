/**
 * Formatting shared by every calculator's "show the math" panel.
 *
 * It lives here rather than in each calculator so the panels format the same
 * quantity identically — a reader comparing two tools must not have to wonder
 * whether a difference in presentation means a difference in value.
 */

/**
 * Render a number for a substitution line: trailing zeros trimmed, capped at
 * `digits` decimal places, and never in exponential notation — a reader is
 * meant to key this straight into their own calculator, and `1e-7` is not
 * something you can type into one.
 *
 * A value too small to survive the rounding falls back to its full form rather
 * than collapsing to "0", so the panel never claims a non-zero term is zero.
 */
export function formatMathValue(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '---';
  if (Number.isInteger(value)) return String(value);

  const fixed = value.toFixed(digits);
  if (parseFloat(fixed) === 0) return String(value);

  // toFixed pads with trailing zeros; drop them without leaving a bare dot.
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
