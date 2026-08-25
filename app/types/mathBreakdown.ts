/**
 * Shared shape for the "show the math" panels on the technical calculators.
 *
 * Each step is one line of arithmetic a reader can redo by hand: the symbolic
 * formula, the same formula with the reader's own live inputs substituted in,
 * and the result the calculator arrived at. The substitution must be built
 * from the SAME computed values the calculator displays — never recomputed
 * alongside it — or the panel will quietly drift from the real answer and
 * defeat the whole point of publishing it.
 */
export interface MathStep {
  /** Short name of the quantity being derived, e.g. "Tire circumference". */
  label: string;
  /** Symbolic form, e.g. "π × diameter". */
  formula: string;
  /** Same form with live values, e.g. "3.14159 × 442". */
  substitution: string;
  /** The calculator's own value for this step, with units. */
  result: string;
  /** Optional caveat (rounding, unit conversion, assumption). */
  note?: string;
}

/** A fixed value the formulas depend on, listed so it can be checked too. */
export interface MathConstant {
  label: string;
  value: string;
}
