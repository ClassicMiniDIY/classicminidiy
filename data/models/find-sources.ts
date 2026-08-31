/**
 * Source-site detection for Exchange "finds" — community-submitted links to
 * Classic Minis for sale elsewhere.
 *
 * Distinct from `external-sources.ts`, which is the registry for the 3D MODEL
 * listings (thingiverse, printables, …). Same idea, different feature.
 *
 * This module exists because the type and the resolver were duplicated
 * byte-for-byte in `app/composables/useExternalListings.ts` and
 * `server/api/exchange/external-listings/parse.post.ts`, with a comment on each
 * asking the reader to keep them in sync by hand. They had already drifted in
 * name (`detectSourceSite` vs `detectFindSourceSite`).
 */

export type FindSourceSite = 'bat' | 'carsandbids' | 'copart' | 'craigslist' | 'facebook' | 'ebay' | 'other';

/**
 * Registered domain → site id. Order is irrelevant: matching is exact-or-
 * subdomain, so no entry can shadow another.
 */
const FIND_SOURCE_HOSTS: readonly (readonly [string, FindSourceSite])[] = [
  ['bringatrailer.com', 'bat'],
  ['carsandbids.com', 'carsandbids'],
  ['copart.com', 'copart'],
  ['craigslist.org', 'craigslist'],
  ['facebook.com', 'facebook'],
  ['ebay.com', 'ebay'],
  ['ebay.co.uk', 'ebay'],
];

/**
 * True when `hostname` IS `domain` or a subdomain of it.
 *
 * Deliberately not `hostname.includes(domain)`. A substring test matches
 * anywhere in the host, so `ebay.com.example.net` and `notebay.com` both read
 * as eBay — and find URLs are submitted by users, so that is reachable input.
 * The result is only a display badge, not an authorization decision, but a
 * marketplace mislabelling where a listing came from is worth getting right.
 * (CodeQL js/incomplete-url-substring-sanitization.)
 */
function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Resolve a find's source site from its URL. Returns `'other'` for anything
 * unrecognised, and for a URL that will not parse.
 *
 * Note `'copart'` is returned for display even though the `external_listings`
 * CHECK constraint may not accept it yet — the insert path in
 * `useExternalListings` catches the constraint violation (23514) and retries as
 * `'other'`. That asymmetry is deliberate; do not "fix" it by dropping copart
 * from this list, or the badge disappears for a site we do recognise.
 */
export function detectFindSourceSite(url: string): FindSourceSite {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  for (const [domain, site] of FIND_SOURCE_HOSTS) {
    if (hostMatches(hostname, domain)) return site;
  }
  return 'other';
}
