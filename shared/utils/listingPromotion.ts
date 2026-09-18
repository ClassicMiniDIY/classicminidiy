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
