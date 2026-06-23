import { MAX_BUDGET } from '~/utils/constants';

/**
 * Validates a single budget value is a number within allowed range.
 * Throws H3 createError with 400 if invalid.
 */
export function validateBudgetValue(value: unknown, label: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || value < 0 || value > MAX_BUDGET) {
    throw createError({
      statusCode: 400,
      message: `${label} must be between 0 and ${MAX_BUDGET.toLocaleString()}`,
    });
  }
}

/**
 * Validates that budget min does not exceed budget max when both are provided.
 * Throws H3 createError with 400 if invalid.
 */
export function validateBudgetRange(min: number | null | undefined, max: number | null | undefined): void {
  if (min != null && max != null && min > max) {
    throw createError({
      statusCode: 400,
      message: 'Minimum budget cannot exceed maximum budget',
    });
  }
}
