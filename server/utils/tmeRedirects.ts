/**
 * The theminiexchange.com -> classicminidiy.com redirect map.
 *
 * TME was consolidated into this app at /exchange (cutover 2026-07-13). These
 * 301s are load-bearing SEO for the retired domain and must survive the move off
 * Vercel, where they currently live as host-conditioned rules in `vercel.json`.
 *
 * This table is the SINGLE SOURCE OF TRUTH. It is transcribed from vercel.json
 * mechanically (not by hand) and is consumed by:
 *   - `server/middleware/tme-redirects.ts` — the runtime backstop, and the only
 *     implementation until the theminiexchange.com zone is live on Cloudflare;
 *   - the Phase 3 zone-edge rules (Single Redirects for the wildcard prefixes,
 *     a Bulk Redirects list for the exact sources), which are generated FROM
 *     this table so the two cannot drift.
 *
 * Ordering is NOT significant here: `resolveTmeRedirect()` checks exact matches
 * before wildcards, so `/admin/users` wins over `/admin/*` regardless of array
 * position. vercel.json relies on array order for that; this does not.
 */

/** Hosts whose traffic this map applies to. Matched case-insensitively, port stripped. */
export const TME_HOSTS = ['theminiexchange.com', 'www.theminiexchange.com'] as const;

/** Exact-path sources. Key is the path with no trailing slash (except the root). */
export const TME_EXACT: ReadonlyArray<readonly [string, string]> = [
  ['/admin/users', 'https://www.classicminidiy.com/admin/users'],
  ['/settings/membership', 'https://www.classicminidiy.com/membership'],
  ['/settings/notifications', 'https://www.classicminidiy.com/dashboard/notifications'],
  ['/settings/saved-searches', 'https://www.classicminidiy.com/dashboard/saved-searches'],
  ['/terms', 'https://www.classicminidiy.com/legal/marketplace-terms'],
  ['/feed.xml', 'https://www.classicminidiy.com/exchange/feed.xml'],
  ['/atom.xml', 'https://www.classicminidiy.com/exchange/atom.xml'],
  ['/feed.json', 'https://www.classicminidiy.com/exchange/feed.json'],
  ['/feeds', 'https://www.classicminidiy.com/exchange/feeds'],
  ['/watchlist', 'https://www.classicminidiy.com/exchange/watchlist'],
  ['/sold', 'https://www.classicminidiy.com/exchange/sold'],
  ['/social', 'https://www.classicminidiy.com/exchange/social'],
  ['/how-it-works', 'https://www.classicminidiy.com/exchange/how-it-works'],
  ['/safety', 'https://www.classicminidiy.com/exchange/safety'],
  ['/about', 'https://www.classicminidiy.com/exchange'],
  ['/onboarding', 'https://www.classicminidiy.com/onboarding'],
  ['/contact', 'https://www.classicminidiy.com/contact'],
  ['/privacy', 'https://www.classicminidiy.com/privacy'],
  ['/', 'https://www.classicminidiy.com/exchange'],
];

/** Prefix sources. `/listings` also covers `/listings/anything/deeper`. */
export const TME_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ['/admin', 'https://www.classicminidiy.com/admin/exchange'],
  ['/feed', 'https://www.classicminidiy.com/exchange/feed'],
  ['/listings', 'https://www.classicminidiy.com/exchange/listings'],
  ['/wanted', 'https://www.classicminidiy.com/exchange/wanted'],
  ['/finds', 'https://www.classicminidiy.com/exchange/finds'],
  ['/messages', 'https://www.classicminidiy.com/exchange/messages'],
  ['/dashboard', 'https://www.classicminidiy.com/dashboard'],
  ['/profile', 'https://www.classicminidiy.com/profile'],
  ['/users', 'https://www.classicminidiy.com/users'],
];

/**
 * Resolve a TME path to its destination, or null if unmapped.
 *
 * Handles BOTH slash forms deliberately. Vercel's patterns are literal path
 * globs — `/about` does not match `/about/` — and `about/`, `contact/`,
 * `privacy/`, `onboarding/`, `dashboard/`, `profile/` and `users/` all exist as
 * PRERENDERED assets in this app. Without the slash-insensitive match, a request
 * for `theminiexchange.com/about/` would serve the CMDIY page as a 200 instead
 * of redirecting: the exact duplicate-content failure these rules prevent.
 *
 * Query strings are preserved by the caller, not here.
 */
export function resolveTmeRedirect(pathname: string): string | null {
  // Normalise: strip a single trailing slash, but keep the root as '/'.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname || '/';

  for (const [source, destination] of TME_EXACT) {
    if (path === source) return destination;
  }

  // Longest prefix wins, so a future nested rule cannot be shadowed by a shorter one.
  let best: readonly [string, string] | null = null;
  for (const entry of TME_PREFIX) {
    const [source] = entry;
    if (path === source || path.startsWith(source + '/')) {
      if (!best || source.length > best[0].length) best = entry;
    }
  }
  if (!best) return null;

  const [source, destination] = best;
  const rest = path.slice(source.length); // '' or '/deeper/path'
  return destination + rest;
}

/** True when this Host header should be treated as TME traffic. */
export function isTmeHost(host: string | undefined): boolean {
  if (!host) return false;
  const bare = host.toLowerCase().split(':')[0];
  return (TME_HOSTS as readonly string[]).includes(bare);
}
