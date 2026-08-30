/**
 * Small request-validation helpers shared by API routes.
 *
 * These exist because the same checks were being re-typed per route and drifted:
 * `alignment-configs` guarded its route params as UUIDs and validated every
 * field, while its `gear-configs` twin guarded neither — so a malformed id
 * reached Postgres, failed the uuid cast, and surfaced as a blanket 500 where
 * the sibling returned a clean 400.
 */

/** Canonical UUID shape. Inlined in ~8 routes before this; prefer `isUuid`. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * A route param that must be a UUID. Returns it, or throws 400.
 *
 * Guarding here rather than letting Postgres reject the cast is the difference
 * between a 400 that says what is wrong and a 500 that says nothing — and it
 * keeps a malformed id from being reported as a server fault.
 */
export function requireUuidParam(value: unknown, label = 'id'): string {
  if (!isUuid(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid or missing ${label}` });
  }
  return value;
}

/**
 * A non-empty string within `maxLength`, trimmed. Throws 400 otherwise.
 *
 * `String(value)` coercion is deliberately NOT used: it turns `null` into
 * `"null"` and an object into `"[object Object]"`, both of which then persist
 * as real data.
 */
export function requireBoundedString(value: unknown, label: string, maxLength: number): string {
  // Absent and wrong-type are different mistakes and deserve different
  // messages — "Name must be a string" is unhelpful when the field simply was
  // not sent.
  if (value === undefined || value === null) {
    throw createError({ statusCode: 400, statusMessage: `${label} is required` });
  }
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: `${label} must be a string` });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw createError({ statusCode: 400, statusMessage: `${label} must be 1-${maxLength} characters` });
  }
  return trimmed;
}

/**
 * A numeric value stored in a TEXT column, returned as a bounded string.
 *
 * `final_drive`, `drop_gear` and `speedo_drive` are numbers that live in text
 * columns, and the calculator already sends them via `String(...)`. Accepting a
 * real number too keeps existing callers working; what is rejected is the
 * coercion that used to let `null` become `"null"` and an object become
 * `"[object Object]"`, and unbounded length.
 */
export function requireNumericText(value: unknown, label: string, maxLength: number): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw createError({ statusCode: 400, statusMessage: `${label} must be a finite number` });
    }
    return String(value);
  }
  return requireBoundedString(value, label, maxLength);
}

/**
 * A finite number within an inclusive range. Throws 400 otherwise.
 *
 * The range check is what stops `Number('abc')` → NaN reaching the database,
 * where it becomes a driver-level error and a 500.
 */
export function requireNumberInRange(value: unknown, label: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw createError({ statusCode: 400, statusMessage: `${label} must be a number between ${min} and ${max}` });
  }
  return parsed;
}

/**
 * PostgREST raises PGRST116 from `.single()` when no row matched — a missing
 * id, or a row that is not the caller's. That is a 404, not a 500.
 */
export function isNoRowsError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'PGRST116';
}
