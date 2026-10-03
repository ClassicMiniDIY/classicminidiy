/**
 * Paid-listing promotion window, shared by the client relist path
 * (`useListings.relistListing`) and the admin moderation route that activates
 * a paid listing. Both compute `featured_until` from it; one copy so a relist
 * and an approval never disagree on how long "featured" lasts.
 */
export const FEATURED_DURATION_DAYS = 30;

/** `featured_until` for a paid listing activated or relisted now. */
export function featuredUntilFromNow(now = Date.now()): string {
  return new Date(now + FEATURED_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * A relist re-queues a listing for the social sweep only when its last social
 * post (`promoted_on_social_at`) is at least this old, or it was never posted.
 * One paid featured window: without a limit, a seller could loop
 * sold → relist for a new post on the brand accounts every cycle.
 */
export const SOCIAL_REPOST_AFTER_DAYS = FEATURED_DURATION_DAYS;

/**
 * The social columns a relist writes, shared by `useListings.relistListing` and
 * the admin status route so "relist" means the same thing on both paths.
 *
 * - Never posted (`promoted_on_social_at` NULL or unreadable), or last post
 *   `SOCIAL_REPOST_AFTER_DAYS` or more ago: `{ promoted_on_social: false }`.
 *   The timestamp is KEPT. The sweep selects on the flag, and with an old
 *   timestamp and no recent failure it treats the listing as due.
 * - Posted more recently: `{}`. Both social columns stay as they are.
 *
 * Never NULLs the timestamp and never touches the sweep's failure counter.
 */
export function relistSocialReset(
  promotedOnSocialAt: string | null | undefined,
  now = Date.now()
): { promoted_on_social?: false } {
  const lastPost = promotedOnSocialAt ? Date.parse(promotedOnSocialAt) : NaN;
  if (!Number.isFinite(lastPost)) return { promoted_on_social: false };
  return now - lastPost >= SOCIAL_REPOST_AFTER_DAYS * 24 * 60 * 60 * 1000 ? { promoted_on_social: false } : {};
}

/** The columns a relist writes. See `relistUpdates()`. */
export interface RelistUpdates {
  status: 'active';
  published_at: string;
  sold_date: null;
  final_price: null;
  tracking_number: null;
  tracking_carrier: null;
  price?: number;
}

/**
 * The full column set of a relist, shared by the seller route
 * (`POST /api/exchange/listings/[id]/relist`) and the admin status route, so
 * "relist" means the same thing whoever clicks it.
 *
 * It puts the listing back live, stamps `published_at` (a relisted listing
 * sorts as newly published), clears the sale trail (a stale `tracking_*`
 * resurfaces old shipping details on the detail page) and, when given, sets a
 * new price.
 *
 * It never contains `featured_until`, `promoted_on_social` or
 * `promoted_on_social_at`. Featured has no window to renew, and a relist never
 * re-queues a social post.
 */
export function relistUpdates({ now = Date.now(), price }: { now?: number; price?: number } = {}): RelistUpdates {
  return {
    status: 'active',
    published_at: new Date(now).toISOString(),
    sold_date: null,
    final_price: null,
    tracking_number: null,
    tracking_carrier: null,
    ...(price !== undefined ? { price } : {}),
  };
}
