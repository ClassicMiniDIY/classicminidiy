/**
 * 301s for paths that moved. Every entry is matched on SEGMENT BOUNDARIES from
 * the START of the path — never as a substring.
 *
 * That distinction is the whole point of this file's shape. It previously used
 * `to.path.includes(...)`, which matched the pattern anywhere in the path, and
 * the `registry` rule matched the bare word. Listing and model slugs are
 * user-generated, so an ordinary Classic Mini ad titled "heritage registry
 * certificate" produced `/exchange/listings/1969-cooper-s-with-heritage-
 * registry-certificate`, which was silently 301'd to `/archive/registry` —
 * confirmed live in production. A 301 tells Google the URL moved permanently,
 * so affected listings lost their indexing too.
 *
 * The old rule needed `!includes('archive')`, `!includes('admin')` and
 * `!includes('contribute')` exclusions to stay usable. Those exclusions were
 * the symptom: an anchored matcher needs none of them, because
 * `/archive/registry` simply does not start with `/registry`.
 */
import { pathInPrefixes } from '~/utils/exchangeRoutes';

/**
 * `from` is a full path. It matches that exact path and anything beneath it,
 * so `/archive/manuals/haynes` still lands on the documents view.
 *
 * Note the four `/archive/*` entries are ALSO covered by exact-path routeRules
 * in nuxt.config.ts, which serve a real server-side 301. These remain so a
 * client-side navigation and a deep sub-path both redirect too.
 */
const redirects: { from: string; to: string }[] = [
  // Old technical paths moved to archive
  { from: '/technical/colors', to: '/archive/colors' },
  { from: '/technical/manuals', to: '/archive/documents?type=manual' },
  { from: '/technical/wheels', to: '/archive/wheels' },
  { from: '/technical/electrical', to: '/archive/electrical' },
  { from: '/technical/engines', to: '/archive/engines' },
  // Renamed technical paths
  { from: '/technical/chassisDecoder', to: '/technical/chassis-decoder' },
  { from: '/technical/chasisDecoder', to: '/technical/chassis-decoder' },
  { from: '/technical/engineDecoder', to: '/technical/engine-decoder' },
  // Removed archive pages consolidated into /archive/documents
  { from: '/archive/carbs', to: '/archive/documents?type=tuning' },
  { from: '/archive/manuals', to: '/archive/documents?type=manual' },
  { from: '/archive/adverts', to: '/archive/documents?type=advert' },
  { from: '/archive/catalogues', to: '/archive/documents?type=catalogue' },
  { from: '/archive/tuning', to: '/archive/documents?type=tuning' },
  // The standalone registry section moved under /archive. Anchored, so
  // /archive/registry, /admin/registry and /contribute/registry are all
  // untouched without needing to be named.
  { from: '/registry', to: '/archive/registry' },
];

export default defineNuxtRouteMiddleware((to) => {
  for (const redirect of redirects) {
    if (pathInPrefixes(to.path, [redirect.from])) {
      return navigateTo(redirect.to, { redirectCode: 301 });
    }
  }
});
