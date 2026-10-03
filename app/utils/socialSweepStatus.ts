/**
 * Read-side helpers for the social sweep state shown on /admin/exchange/promotions.
 *
 * The sweep itself is the `post-listing-social` edge function in
 * classicminidiy-supabase (its retry policy is `sweep-policy.ts` there). It
 * writes post ids and its failure counter to the LATEST `listing_promotions`
 * row of a listing, ordered `created_at DESC, id ASC`. A listing can have
 * several rows (a paid upgrade, then an admin comp), so a reader that takes any
 * row shows stale post ids and the wrong counter.
 *
 * This file only reads. The web app never writes the counter.
 */

export interface PromotionRowLike {
  id?: string | null;
  listing_id: string;
  features: unknown;
  created_at: string | null;
}

/** True when `a` is newer than `b` in the writers' order (`created_at DESC, id ASC`; NULL first in DESC). */
function isNewerPromotion(a: PromotionRowLike, b: PromotionRowLike): boolean {
  if (a.created_at !== b.created_at) {
    if (a.created_at === null) return true;
    if (b.created_at === null) return false;
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    if (ta !== tb) return ta > tb;
    // Same millisecond: PostgREST prints one format, so the string keeps microseconds.
    return a.created_at > b.created_at;
  }
  return (a.id ?? '') < (b.id ?? '');
}

/** The latest promotion row for each listing id. */
export function latestPromotionByListing<T extends PromotionRowLike>(
  rows: readonly T[] | null | undefined
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows ?? []) {
    const current = latest.get(row.listing_id);
    if (!current || isNewerPromotion(row, current)) latest.set(row.listing_id, row);
  }
  return latest;
}

// Mirrors of the sweep policy in classicminidiy-supabase (`decideSweep` in
// post-listing-social/sweep-policy.ts). Display only: if they drift, the badge
// text is wrong, but nothing is posted or skipped.
const MINUTE_MS = 60 * 1000;
const RETRY_BASE_MS = 15 * MINUTE_MS;
const PARK_AFTER_FAILURES = 5;
const PARKED_RETRY_MS = 24 * 60 * MINUTE_MS;
/** The sweep posts a listing up to this long before its retry time (cron jitter). */
const RETRY_GRACE_MS = 5 * MINUTE_MS;

export interface SocialSweepStatus {
  /** Failed sweep attempts on the latest promotion row; 0 when there is no counter. */
  failures: number;
  /** ISO time the wait is timed from: the last failure, else the last claim. */
  since: string;
  /** ISO time the sweep next tries this listing. */
  retryAt: string;
  /** True on the daily retry (5+ failures, or attempted with no counter). */
  parked: boolean;
}

function parseTime(value: unknown): number | null {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Why the sweep is holding a pending listing back, or null when the next sweep
 * posts it. Same decision as `decideSweep`:
 * - a failure counter of n: wait 15, 30, 60, 120 minutes for n = 1-4, then 24
 *   hours, timed from `social_sweep_failed_at`, else from `promoted_on_social_at`;
 * - no counter but `promoted_on_social_at` set (attempted before): 24 hours from it;
 * - never attempted, or no usable time: due now.
 * The sweep posts from 5 minutes before the retry time.
 *
 * `promotedOnSocialAt` is the listing's `promoted_on_social_at`; pass it only for
 * a listing with `promoted_on_social = false`.
 */
export function socialSweepStatus(
  features: unknown,
  promotedOnSocialAt: string | null | undefined,
  now: number = Date.now()
): SocialSweepStatus | null {
  const f =
    features && typeof features === 'object' && !Array.isArray(features) ? (features as Record<string, unknown>) : {};
  const raw = f.social_sweep_failures;
  const failures = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  const lastAttemptAt = parseTime(promotedOnSocialAt);

  let delay: number;
  let from: number | null;
  if (failures > 0) {
    delay = failures >= PARK_AFTER_FAILURES ? PARKED_RETRY_MS : RETRY_BASE_MS * 2 ** (failures - 1);
    from = parseTime(f.social_sweep_failed_at) ?? lastAttemptAt;
  } else if (lastAttemptAt !== null) {
    delay = PARKED_RETRY_MS;
    from = lastAttemptAt;
  } else {
    return null;
  }
  if (from === null) return null;

  const retryAt = from + delay;
  if (now >= retryAt - RETRY_GRACE_MS) return null;

  return {
    failures,
    since: new Date(from).toISOString(),
    retryAt: new Date(retryAt).toISOString(),
    parked: delay === PARKED_RETRY_MS,
  };
}
