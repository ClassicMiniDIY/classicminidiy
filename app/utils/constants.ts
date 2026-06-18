/**
 * Shared constants for The Mini Exchange
 *
 * Centralizes magic numbers and repeated literals so they can be
 * updated in one place instead of many.
 */

/** Maximum content length for messages, comments, and descriptions */
export const MAX_CONTENT_LENGTH = 2000;

/** Valid listing/wanted post categories */
export const VALID_CATEGORIES = ['vehicle', 'engine', 'parts'] as const;
export type ListingCategory = (typeof VALID_CATEGORIES)[number];

/** Valid condition preferences for wanted posts */
export const VALID_CONDITION_PREFERENCES = ['any', 'excellent', 'good', 'fair', 'project'] as const;
export type ConditionPreference = (typeof VALID_CONDITION_PREFERENCES)[number];

/** Cache TTL for admin dashboard data (2 minutes) */
export const ADMIN_CACHE_TTL_MS = 2 * 60 * 1000;

/** Maximum budget value for wanted posts */
export const MAX_BUDGET = 10_000_000;
