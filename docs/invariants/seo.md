# SEO / head invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/images-seo.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### SEO / Head Invariants

- **Never pass a possibly-empty string (or any non-string) to `ogImage` / `twitterImage` in `useSeoMeta`.** unhead's flat-meta unpacking coerces `''` to boolean `true`, and nuxt-og-image's `tags:afterResolve` hook calls `.replaceAll()` on every `og:image`/`twitter:image` content — a truthy non-string 500s the whole SSR render (this took down `/archive/colors/[id]` for months). Derive share images with `computed()` (a lazy `watch` never fires during SSR, so a ref stays at its initial value server-side) and always fall back to a real URL. `app/plugins/seo-tag-guard.server.ts` + `app/utils/seoTagGuards.ts` are the SSR safety net that sanitizes these tags before nuxt-og-image sees them — don't remove them.

- **Every dynamic route must 404 on a miss — `app/pages/[...slug].vue` most of all.** That file is the site-wide catch-all, so _any_ unmatched URL on the domain reaches it. Until 2026-07 it answered HTTP 200 with `<title>undefined - Classic Mini Archive</title>` and a self-referencing canonical for literally every unknown path (`/wp-admin`, `/foo/bar/baz`, …) — an unbounded soft-404 space that Google indexes and burns crawl budget on. It, and every `[slug]`/`[id]` detail page, must `throw createError({ statusCode: 404, fatal: true })` when the record isn't found. The one deliberate exception is `/exchange/listings/[slug]`: an SSR miss there can also be a _pending_ listing whose RLS row only the signed-in owner can read (SSR has no session), so it sets `setResponseStatus(event, 404)` + `noindex` and still renders, letting the `onMounted` retry recover it for the owner.

- **Every redirect matcher must anchor at a segment boundary from the START of
  the path — never `path.includes(...)`.** `app/middleware/oldRouteRedirect.global.ts`
  matched substrings, and its `registry` rule matched the bare word anywhere.
  Listing and model slugs are USER-GENERATED, so an ordinary ad titled "heritage
  registry certificate" produced a slug that was silently 301'd to
  `/archive/registry` — confirmed live in production, and a 301 also tells Google
  the listing moved permanently, so it lost its indexing. The old rule needed
  `!includes('archive')` / `!includes('admin')` / `!includes('contribute')`
  exclusions to stay usable; those exclusions were the tell. An anchored matcher
  needs none of them, because `/archive/registry` does not start with `/registry`.
  Use `pathInPrefixes()` from `app/utils/exchangeRoutes.ts` rather than writing a
  fourth comparison. `MUST_NOT_REDIRECT` in `tests/fixtures/route-manifest.mjs`
  keeps this honest against a running server.

- **A routeRule makes a path a "known route" to `@nuxtjs/sitemap`.** `/technical/calculators/{needles,gearbox}` had no page files but kept `prerender: false` routeRules, which was enough to put both dead URLs in the sitemap, where they resolved through the catch-all as `undefined`-titled 200s. If you delete a page, delete or 301 its routeRules too, and add the path to `sitemap.exclude`. (On Vercel these `redirect` routeRules serve real 301s; the meta-refresh `index.html` in `.output/public` is a build artifact the platform routing shadows — same as `/archive/manuals`.)

- **Browse pages with query params must use `useFacetedSeo()`** (`app/composables/useFacetedSeo.ts`). `nuxt-seo-utils` derives the canonical from the _current URL including its query string_, so without it every filter/sort permutation self-canonicalises into its own indexable near-duplicate — a combinatorial crawl trap, and one that swallows `?utm_source=`/`?fbclid=` URLs too. The composable canonicalises to an allowlist of params (default `['page']`) and marks anything else `noindex, follow`. It routes robots through **`useRobotsRule()`**, not `useSeoMeta({ robots })`: the latter _replaces_ @nuxtjs/robots' tag and silently drops `max-image-preview:large` / `max-snippet:-1`. Never pass `true` to `useRobotsRule` to "restore" the default — it maps to `robotsEnabledValue` unconditionally and would force `index, follow` onto preview deployments. Not calling it is what leaves the environment default intact.

- **There is deliberately NO FAQPage JSON-LD, and no visible FAQ block, on the technical pages.** Google requires FAQ markup to match content that is _visible_ on the page, and a visible Q&A section was judged to add nothing for human readers on pages that are already spec tables. Shipping the schema without its on-page counterpart is a structured-data policy violation, so the project ships **neither**: `app/utils/geo/generateFaqs.ts` now feeds only `server/plugins/llms-faq.ts` → **`/llms-full.txt`**, which is the legitimate machine-readable channel (it isn't the page, so it isn't cloaking). Both halves or neither — don't re-add FAQPage schema without rendering the questions.
