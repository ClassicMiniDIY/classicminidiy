# Image optimization invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/images-seo.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### Image Optimization Invariants

- **`image.domains` in `nuxt.config.ts` is matched on the LITERAL hostname, and a miss is
  silent.** @nuxt/image passes an unlisted URL straight through — no resize, no format
  conversion — _even inside `<nuxt-img>`_, so the markup looks optimized while shipping the
  full-size original. Three ways this has bitten us, all fixed 2026-07-31:
  - The asset bucket is referenced by **both** `classicminidiy.s3.amazonaws.com` (~230 call
    sites) and `classicminidiy.s3.us-east-1.amazonaws.com` (~40). Both must stay listed
    until the call sites are normalized onto one host.
  - **Supabase Storage is reached via the CUSTOM domain `auth.classicminidiy.com`**, because
    `storage.getPublicUrl()` builds every URL from `NUXT_PUBLIC_SUPABASE_URL`. The
    `psoqirvbujwohemmwplv.supabase.co` entry matches nothing in practice — it is kept only as
    a fallback if that env var is ever pointed back at the raw host. Listing photos, model
    images and avatars ALL depend on the custom domain being listed.
  - `i.ytimg.com` (YouTube thumbnails) and `cmdiy-archive.s3.us-east-1.amazonaws.com`.

  Adding a new remote image host means adding it here **and** to the PWA `runtimeCaching`
  `urlPattern` (which had the same regional-only / project-ref-only bugs), **and** a
  `preconnect`/`dns-prefetch` hint if it's a new origin. Verify by rendering a real page and
  confirming the `src` starts with `/_ipx/` — do not trust the config.

- **`<NuxtImg>` ignores the `image.format` list; only `<NuxtPicture>` uses it.** NuxtImg emits
  a single `<img>` in the SOURCE format unless given an explicit `format` prop, so every
  `<nuxt-img>` without `format="webp"` serves JPEG/PNG. Prefer explicit `format="webp"` over
  inheriting the config list — AVIF measured barely better than JPEG on detailed photos at
  q80 here and is far slower to encode on a cold serverless path.

- **`<NuxtPicture>` puts fallthrough `class` / `data-testid` / `@error` on the `<picture>`
  root, not the inner `<img>`.** `object-cover` on a `display:inline` `<picture>` silently
  does nothing and the img falls back to `object-fit: fill`, which SQUASHES non-matching
  aspect ratios instead of cropping; `error` does not bubble from `<img>` to `<picture>`, so
  `@error` never fires. Pass those via `:img-attrs="{ class: '...', onError: ... }"`, or use
  `<NuxtImg>` (a single `<img>`) when you just need the existing attributes to keep working.

- **Some image hosts CANNOT be allowlisted.** `exchange/finds/FindCard.vue` renders
  `og_image_url` scraped from arbitrary third-party sites, so it stays a raw `<img>` with its
  `@error` fallback. Same for `blob:`/`data:` upload previews. Don't "fix" these.

- **`/_ipx` MUST stay in `nitro.prerender.ignore` — this is a build-memory contract, not an
  optimization.** `crawlLinks: true` follows same-origin URLs out of prerendered pages. An
  unoptimized image is an _absolute_ S3/Supabase URL (external → never crawled), but an
  optimized one is a same-origin `/_ipx/...` path, so the crawler treats every variant as a
  route and transcodes it through sharp **at build time**. When this was first missed it was
  **603 of 768 prerendered routes (78%)**, and the resulting RSS inflation pushed the Nitro
  bundling step past the 8 GB build container — SIGKILL, OOM.

  Two things make this hard to diagnose, so recognise the shape: the kill lands during Nitro
  _bundling_, well after prerender reports success, and because the build sits near the
  ceiling it can first fail on a commit that touches nothing (it initially tripped on a
  docs-only commit). A `SIGKILL` is the **container** OOM killer, not a V8 heap error — if you
  see `JavaScript heap out of memory` instead, that's a genuinely different problem.

  Prerendering ipx output is worthless anyway: variants regenerate at runtime and Vercel's CDN
  holds them for 7 days (`s-maxage=604800`), and user-uploaded photos added after a build have
  no baked variant regardless. The same reasoning applies to any future runtime-generated
  image route.

#### Image Optimization Invariants

- **Never set `image.provider` in `nuxt.config.ts` — with ONE narrow exception, added for the
  Cloudflare migration.** A zone-backed Cloudflare build sets `provider: 'cloudflare'` (the
  platform optimizer there is `/cdn-cgi/image/`, not Vercel's), gated behind `useCloudflareImages`.
  Local dev still leaves it unset, so everything below still applies to it verbatim.

  **Vercel is retired**, so the Vercel-specific mechanics described in this section — the
  native optimizer, `.vercel/output/config.json`, `images.sizes`, `/_vercel/image` — are
  kept as the REASONING behind the rule, not as a live deployment path. The rule itself is
  unchanged: leave `provider` unset except behind the Cloudflare gate.
  Cloudflare PREVIEW builds also leave it unset on purpose: `/cdn-cgi/image/` exists only on a
  zone, so a workers.dev preview using that provider renders broken images everywhere.
  Leaving it unset (`'auto'`) is
  load-bearing: `@nuxt/image` resolves the provider from `std-env`'s deployment detection —
  Vercel's native optimizer in production, `ipx` locally. Pinning it to `'ipx'` broke every
  LOCAL image under `public/` in production with `[404] [IPX_FILE_NOT_FOUND]`
  (upstream: nuxt/image#1281): ipx resolves local paths with a **filesystem** read, but on
  Vercel `public/` ships to the CDN static output and is absent from the serverless function's
  filesystem. Remote images were unaffected — those are network fetches, which is why the bug
  looked selective. Verify a provider change by building with `VERCEL=1 NITRO_PRESET=vercel`
  and confirming `.vercel/output/config.json` has an `images` key and the HTML emits
  `/_vercel/image?url=…`, not `/_ipx/…`.

- **It hid behind the prerenderer for months.** Nitro's `crawlLinks` was baking the
  `/_ipx/...` variants into static output (603 of them), so the CDN answered and the runtime
  handler was never asked. Adding `/_ipx` to `nitro.prerender.ignore` to fix the build OOM
  removed that crutch and surfaced the real misconfiguration — the homepage mascot, the
  app-promo screenshots and the giveaway carousel all 404'd at once. Both facts are one
  contract: with the Vercel provider there is no `/_ipx` to prerender, and sharp leaves the
  build and the runtime entirely.

- **`image.screens` is the allowlist.** It is emitted into the Vercel build-output image
  config as `images.sizes`, and Vercel serves ONLY those widths. `@nuxt/image` snaps requested
  widths to the list, so a `sizes` expression that overstates the slot silently pulls a much
  larger variant. State the real CSS width — the giveaway card is in a `max-w-md` column, so
  `sizes="448px"` yields 640/1024 candidates where `sm:100vw md:448px` reached for 1280/1536.
