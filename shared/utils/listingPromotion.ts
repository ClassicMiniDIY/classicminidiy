/**
 * Listing promotion rules shared by the client and the server: what makes a
 * listing "featured", and what a relist writes.
 */

/**
 * A listing is featured when it is premium (`tier = 'paid'`) and live:
 * `active`, or `example_paid` for the demo rows. It has no end date while it is
 * live. A sold, expired, cancelled, pending or draft premium listing is never
 * featured. `featured_until` plays no part: it is deprecated, and nothing may
 * read it.
 *
 * Used by the homepage featured strip (as its query filters), the listing card
 * ring and `FeaturedBadge`.
 */
export function isListingFeatured(listing: { tier?: string | null; status?: string | null }): boolean {
  return listing.tier === 'paid' && (listing.status === 'active' || listing.status === 'example_paid');
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
