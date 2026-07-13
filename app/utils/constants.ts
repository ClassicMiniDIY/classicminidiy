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

/**
 * Non-sensitive columns of public.profiles, for explicit selects during the
 * profiles sensitive-column split. email/is_admin/warning_count/firebase_uid/
 * auth_provider live on profile_private — never select them from profiles
 * (they are dropped from profiles in Phase 4 of the split).
 */
export const PROFILE_PUBLIC_COLUMNS =
  'id, username, display_name, avatar_url, location, bio, social_links, show_vehicles, is_public, is_banned, preferred_currency, unit_system, trust_level, total_submissions, approved_submissions, rejected_submissions, onboarding_completed, onboarding_completed_app, profile_completed_at, created_at, updated_at';
