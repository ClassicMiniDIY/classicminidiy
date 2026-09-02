---
paths:
  - 'nuxt.config.ts'
  - 'app/pages/**'
  - 'app/composables/useFacetedSeo.ts'
  - 'app/plugins/seo-tag-guard.server.ts'
  - 'app/utils/seoTagGuards.ts'
  - 'app/utils/geo/**'
  - 'server/plugins/llms-faq.ts'
  - 'app/middleware/oldRouteRedirect.global.ts'
  - 'app/utils/exchangeRoutes.ts'
---

# Image and SEO rules

Detail and incident history: `docs/invariants/images.md`, `docs/invariants/seo.md`.

## Images

- `image.domains` in `nuxt.config.ts` matches the LITERAL hostname and a miss is silent: the original ships unoptimized even inside `<nuxt-img>`. Both S3 hosts (`classicminidiy.s3.amazonaws.com` and `…s3.us-east-1…`), `auth.classicminidiy.com` (Supabase Storage via the custom domain), `i.ytimg.com` and `cmdiy-archive.s3.us-east-1.amazonaws.com` must stay listed. A new host also goes into the PWA `runtimeCaching` pattern and a preconnect hint. Verify by checking a rendered `src` starts with `/_ipx/` (dev) or `/cdn-cgi/image/` (zone build).
- `<NuxtImg>` ignores `image.format`; pass `format="webp"` explicitly. `<NuxtPicture>` puts `class`/`@error` on the `<picture>` root; use `:img-attrs`.
- `exchange/finds/FindCard.vue` and blob/data upload previews are raw `<img>` on purpose (arbitrary hosts). Don't "fix" them.
- **`/_ipx` must stay in `nitro.prerender.ignore`**: crawlLinks once prerendered 603 of 768 routes through sharp and SIGKILLed the build container.
- **Never set `image.provider`** except the existing `useCloudflareImages` gate (zone builds only; workers.dev previews leave it unset because `/cdn-cgi/image/` exists only on a zone). Pinning `ipx` 404'd every `public/` image in production.
- `image.screens` is the served-width allowlist; state the real CSS width in `sizes`.

## SEO / head

- Never pass a possibly-empty string to `ogImage`/`twitterImage`: unhead coerces `''` to `true` and nuxt-og-image then 500s the whole SSR render. Derive share images with `computed()` and always fall back to a real URL. `seo-tag-guard.server.ts` is the safety net; keep it.
- Every dynamic route 404s on a miss with `throw createError({ statusCode: 404, fatal: true })`, `app/pages/[...slug].vue` most of all. Sole exception: `/exchange/listings/[slug]` sets 404 + noindex and still renders so the owner's `onMounted` retry can recover a pending listing.
- Redirect matchers anchor at a segment boundary from the start of the path via `pathInPrefixes()` (`app/utils/exchangeRoutes.ts`), never `path.includes()`; user-generated slugs got 301'd to `/archive/registry`.
- A routeRule makes a path a "known route" to the sitemap; delete or 301 routeRules when deleting a page and add it to `sitemap.exclude`.
- Browse pages with query params use `useFacetedSeo()` (allowlisted params, `useRobotsRule()` for the rest). Never pass `true` to `useRobotsRule`. `/search` keeps `indexableParams: []`.
- No FAQPage JSON-LD and no visible FAQ block on technical pages; `generateFaqs.ts` feeds only `/llms-full.txt`. Both halves or neither.
