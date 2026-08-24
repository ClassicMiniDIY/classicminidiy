/**
 * 301s theminiexchange.com traffic to its classicminidiy.com equivalent.
 *
 * These redirects live in `vercel.json` today. That file is Vercel-only, so the
 * map has to exist in the app itself to survive the move to Cloudflare Workers.
 *
 * Once the theminiexchange.com zone is live on Cloudflare the same table is also
 * expressed as zone-edge rules (Single Redirects + a Bulk Redirects list), which
 * is strictly better: they are host-scoped by construction, they cost no worker
 * invocation, and they keep working during a worker outage. This middleware then
 * becomes the backstop rather than the primary path — but it stays, because it is
 * the version-controlled spec the zone rules are generated from and the only
 * thing a test can assert against.
 *
 * Runs before the static asset layer matters: on Workers, prerendered assets can
 * shadow routes, and this app HAS prerendered `/about`, `/contact`, `/privacy`,
 * `/onboarding`, `/dashboard`, `/profile` and `/users`. Without a host check
 * ahead of them, `theminiexchange.com/about/` would serve the CMDIY page as a
 * 200 — duplicate content on the exact URLs these 301s exist to consolidate.
 */
import { isTmeHost, resolveTmeRedirect } from '../utils/tmeRedirects';

export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'host');
  if (!isTmeHost(host)) return;

  const url = getRequestURL(event);
  const destination = resolveTmeRedirect(url.pathname);

  // An unmapped TME path is NOT redirected to the homepage. It falls through to
  // the app's real 404, matching production today: `theminiexchange.com/nope`
  // returns 404, and a catch-all here would convert the entire unmatched URL
  // space into soft-200 redirects.
  if (!destination) return;

  // Preserve the query string. Vercel's rules do this implicitly; ours must not
  // silently drop `?utm_source=` and friends from inbound links.
  const target = destination + (url.search || '');

  return sendRedirect(event, target, 301);
});
