/**
 * Listing promotion rules shared by the client and the server: what makes a
 * listing "featured", and what a relist writes.
 */

/**
 * A listing is featured when it is premium (`tier = 'paid'`) and live:
 * `active`, or `example_paid` for the demo rows. It has no end date while it is
 * live. A sold, expired, cancelled, pending or draft premium listing is never
 * featured. No column records a featured end date.
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
 * It never contains `promoted_on_social` or `promoted_on_social_at`. Featured
 * has no window to renew, and a relist never re-queues a social post.
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

/** How many cards the homepage featured strip shows. */
export const FEATURED_STRIP_SIZE = 6;

/**
 * Pick the listings the homepage featured strip shows on this page load.
 *
 * Every featured listing has the same chance on every load, and the order is
 * random too: featured has no end date (`isListingFeatured()`), so a strip of
 * the newest few would never show an older paid listing. Real listings come
 * before the `example_*` demo rows, which only fill places the real ones leave.
 *
 * Fisher-Yates over copies; the input is not changed. `random` is injectable
 * for tests and must return a number in [0, 1).
 */
export function pickFeaturedRotation<T extends { status?: string | null }>(
  rows: readonly T[],
  count: number = FEATURED_STRIP_SIZE,
  random: () => number = Math.random
): T[] {
  const shuffle = (list: T[]): T[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  };
  const isExample = (row: T) => typeof row.status === 'string' && row.status.startsWith('example_');
  const real = shuffle(rows.filter((row) => !isExample(row)));
  const examples = shuffle(rows.filter(isExample));
  return [...real, ...examples].slice(0, Math.max(0, count));
}
