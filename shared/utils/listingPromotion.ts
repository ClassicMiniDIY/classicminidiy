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
