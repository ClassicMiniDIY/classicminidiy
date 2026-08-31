/**
 * What `scripts/smoke-routes.mjs` walks, and what each route is expected to do.
 *
 * Static routes are DERIVED from `app/pages/**` rather than listed, so a new
 * page is crawled the day it lands and the manifest cannot silently drift out
 * of date. Only the things a filename cannot tell you live here by hand:
 * sample params for dynamic routes, per-route expectation overrides, and the
 * redirect/404 sets.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PAGES_DIR = join(REPO_ROOT, 'app/pages');

/** Turn `app/pages/archive/colors/index.vue` into `/archive/colors`. */
function fileToRoute(absPath) {
  const relPath = relative(PAGES_DIR, absPath)
    .split(sep)
    .join('/')
    .replace(/\.vue$/, '');
  const route = `/${relPath.replace(/\/?index$/, '')}`;
  return route === '/' ? '/' : route.replace(/\/$/, '');
}

function walkPages(dir = PAGES_DIR, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkPages(full, out);
    else if (entry.endsWith('.vue')) out.push(full);
  }
  return out;
}

/** Every non-dynamic page route, sorted. */
export const STATIC_ROUTES = [
  ...new Set(
    walkPages()
      .map(fileToRoute)
      .filter((route) => !route.includes('[') && !route.includes(']'))
  ),
].sort();

/**
 * Dynamic routes are sampled from the SITEMAP SOURCE endpoints rather than
 * hand-listed, so the crawler always walks URLs that really exist today and
 * the manifest cannot rot as content changes. These are the same endpoints
 * `@nuxtjs/sitemap` consumes (wired in nuxt.config.ts), so if one breaks, the
 * sitemap is broken too — worth knowing either way.
 *
 * `sample` is deliberately small: the point is to prove the DETAIL TEMPLATE
 * renders, not to crawl the whole archive.
 */
export const DYNAMIC_SOURCES = [
  { name: 'documents', endpoint: '/api/__sitemap__/documents', sample: 3 },
  { name: 'colors', endpoint: '/api/__sitemap__/colors', sample: 3 },
  { name: 'wheels', endpoint: '/api/__sitemap__/wheels', sample: 3 },
  { name: 'exchange', endpoint: '/api/__sitemap__/exchange', sample: 3 },
  { name: 'urls', endpoint: '/api/__sitemap__/urls', sample: 3 },
];

/**
 * Paths that must answer 404. A soft-404 (200 + "not found" copy) is the
 * defect this set exists to catch — it is an unbounded indexable space.
 */
export const MUST_404 = [
  '/this-page-does-not-exist',
  '/archive/documents/definitely-not-a-real-document-slug',
  '/wp-admin',
  '/foo/bar/baz',
  // A well-formed UUID that belongs to nobody. The page still RENDERS (the
  // owner of a private profile is recovered by its onMounted load), so the
  // status code is the only thing that distinguishes a miss — which is exactly
  // what this asserts.
  '/users/00000000-0000-0000-0000-000000000000',
  // Malformed id: must be a 404, never a 500 from the RPC rejecting the cast.
  '/users/not-a-uuid',
];

/** `from` must 301 (or 302) to `to`. */
export const MUST_REDIRECT = [
  { from: '/technical/calculators/needles', to: '/technical/needles' },
  { from: '/technical/calculators/gearbox', to: '/technical/gearing' },
  { from: '/developer', to: '/developers' },
  { from: '/admin/inbox', to: '/admin/queue' },
  { from: '/technical/colors', to: '/archive/colors' },
  { from: '/technical/wheels', to: '/archive/wheels' },
];

/**
 * Paths that must be served, NOT redirected.
 *
 * `app/middleware/oldRouteRedirect.global.ts` matches with
 * `to.path.includes(...)` on substrings, and its `registry` branch fires on any
 * path containing that word outside /archive, /admin and /contribute. Listing
 * and model slugs are user-generated, so an ordinary slug that happens to
 * mention a heritage registry is silently 301'd off the site. These cases must
 * reach a page or a 404 — never a redirect.
 */
export const MUST_NOT_REDIRECT = [
  '/exchange/listings/1969-cooper-s-with-heritage-registry-certificate',
  '/models/registry-plate-bracket',
  '/search?q=registry',
];

/**
 * Errors that reproduce today and are tracked in an open GitHub issue.
 * `route [check]`. The list is SHRINK-ONLY: the crawler fails if an entry stops
 * reproducing, so a fix cannot merge without deleting its line.
 *
 * Empty is the goal state, not an oversight.
 */
export const KNOWN_ERRORS = [];

/**
 * Per-route expectation overrides. Anything absent uses the defaults in
 * `scripts/smoke-routes.mjs`.
 *
 *   noindex      — page deliberately sets robots noindex, so no canonical check
 *   allowNoH1    — page has no single top-level heading by design
 *   allowNoJsonLd— page emits no schema.org graph by design
 *   expectStatus — non-200 expected (e.g. auth-gated SSR)
 */
export const ROUTE_EXPECTATIONS = {
  '/auth/callback': { noindex: true, allowNoH1: true, allowNoJsonLd: true },
  '/login': { noindex: true },
  '/onboarding': { noindex: true },
  '/welcome': { noindex: true },
  // These three render exactly one <h1> per state branch (redeeming / success /
  // sign-in / error), so at every moment a user sees, the page has one heading.
  // The crawler observes zero because the PRE-HYDRATION frame is a spinner —
  // forcing a heading into a loading state to satisfy the check would be worse
  // markup, not better.
  '/membership/claim': { noindex: true, allowNoH1: true },
  '/discord/connect': { noindex: true, allowNoH1: true },
  '/profile': { noindex: true },
  '/profile/edit': { noindex: true },
  '/dashboard': { noindex: true },
  '/models/mine': { noindex: true },
  '/models/upload': { noindex: true },
  '/models/submit-external': { noindex: true },
  '/exchange/messages': { noindex: true },
  '/exchange/watchlist': { noindex: true },
  '/exchange/listings/new': { noindex: true },
  '/exchange/listings/bulk': { noindex: true },
  '/exchange/finds/submit': { noindex: true },
  '/exchange/wanted/new': { noindex: true },
  '/exchange/listings/payment/success': { noindex: true, allowNoJsonLd: true, allowNoH1: true },
  '/exchange/listings/payment/cancel': { noindex: true, allowNoJsonLd: true },
  // Tab shells that redirect to their default child.
  '/dashboard': { expectStatus: 302 },
  '/models/mine': { expectStatus: 302 },
};

/** Admin pages are noindex by routeRule and gated client-side. */
export function expectationsFor(route) {
  const base = ROUTE_EXPECTATIONS[route] ?? {};
  if (route.startsWith('/admin') || route.startsWith('/dashboard')) {
    return { noindex: true, allowNoJsonLd: true, ...base };
  }
  return base;
}
