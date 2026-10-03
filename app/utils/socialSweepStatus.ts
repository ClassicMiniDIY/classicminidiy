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

// Mirrors of the sweep policy constants in classicminidiy-supabase. Display only:
// if they drift, the badge text is wrong, but nothing is posted or skipped.
const MINUTE_MS = 60 * 1000;
const RETRY_BASE_MS = 15 * MINUTE_MS;
const PARK_AFTER_FAILURES = 5;
const PARKED_RETRY_MS = 24 * 60 * MINUTE_MS;

export interface SocialSweepStatus {
  failures: number;
  /** ISO time of the last failed sweep attempt. */
  lastFailedAt: string;
  /** ISO time the sweep next tries this listing. */
  retryAt: string;
  /** True on the daily retry (after 5 failures). */
  parked: boolean;
}

/**
 * The sweep back-off state recorded in a promotion row's `features`, or null when
 * there is nothing to show: no counter, no failure time, or the back-off has
 * already run out (the listing is due on the next sweep).
 */
export function socialSweepStatus(features: unknown, now: number = Date.now()): SocialSweepStatus | null {
  if (!features || typeof features !== 'object' || Array.isArray(features)) return null;
  const f = features as Record<string, unknown>;
  const raw = f.social_sweep_failures;
  const failures = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  if (failures === 0) return null;

  const failedAt = typeof f.social_sweep_failed_at === 'string' ? Date.parse(f.social_sweep_failed_at) : NaN;
  if (!Number.isFinite(failedAt)) return null;

  const parked = failures >= PARK_AFTER_FAILURES;
  const delay = parked ? PARKED_RETRY_MS : RETRY_BASE_MS * 2 ** (failures - 1);
  const retryAt = failedAt + delay;
  if (now >= retryAt) return null;

  return {
    failures,
    lastFailedAt: new Date(failedAt).toISOString(),
    retryAt: new Date(retryAt).toISOString(),
    parked,
  };
}
