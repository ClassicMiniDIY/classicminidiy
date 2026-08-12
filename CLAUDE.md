# CLAUDE.md

This file provides guidance to Claude Code when working with the Classic Mini DIY project.

## CMDIY Ecosystem Context

This repo is part of the Classic Mini DIY property ecosystem. For the full cross-repo architecture, please refer to the central documentation. Key related repos:

- **classicminidiy-supabase** — Shared Supabase backend (PostgreSQL, Auth, Edge Functions, RLS)
- ~~**TheMiniExchange**~~ — **RETIRED.** The marketplace was consolidated into this repo and
  lives at `/exchange` on classicminidiy.com (cutover completed 2026-07-13). The
  `TheMiniExchange` repo is retired and its remaining infra is being torn down separately —
  **make no changes there**. `theminiexchange.com` 301s here via the host rules in `vercel.json`; those
  redirects are load-bearing SEO and must not be removed.
- **Native CMDIY Apps** — iOS (Swift) and Android (Kotlin) mobile apps

This site shares the Supabase auth and profiles with the other properties. Database schema lives in `classicminidiy-supabase`.

## Project Overview

**Classic Mini DIY** is a comprehensive web application serving as both a toolkit and permanent archive for Classic Mini enthusiasts. It provides technical information, calculators, historical documents, and interactive tools for Classic Mini owners and mechanics.

- **Framework**: Nuxt `~4.4.8` (Vue 3.5) with TypeScript — deliberately pinned, see "Intentional dependency pins"
- **Purpose**: Classic Mini car enthusiast website and knowledgebase
- **URL**: https://classicminidiy.com
- **Repository**: https://github.com/somethingnew71/classicminidiy
- **License**: GPL-3.0

## Architecture

### Frontend

- **Framework**: Nuxt `~4.4.8` with TypeScript (pinned — do not bump to 4.5.x)
- **UI Components**: **daisyUI 5** (`card`, `btn`, `badge`, `modal`, `tabs`, `alert`, …). `@nuxt/ui` is NOT installed — it was removed in `3c6d6125 refactor: migrate from @nuxt/ui to daisyui 5`, and `<U*>` components do not exist in this codebase
- **Styling**: TailwindCSS `^4.3.3` with @tailwindcss/vite
- **Icons**: Font Awesome 6 (exclusive icon library - no Heroicons or Lucide)
- **Search**: Fuse.js for advanced fuzzy search functionality
- **Charts**: Highcharts for data visualization
- **PWA**: Configured with @vite-pwa/nuxt for offline functionality
- **SEO**: Comprehensive meta tags, structured data, sitemap generation

### Backend & Infrastructure

- **Hosting**: Vercel with serverless deployment
- **Database**:
  - DynamoDB for primary data storage
  - PostgreSQL for Nuxt Content
- **Storage**: AWS S3 with intelligent tiering and versioning
- **CDN**: S3 static assets with custom domain
- **Analytics**: Google Analytics, Vercel Analytics & Speed Insights

### AI Integration

- **LangGraph SDK**: AI-powered chat functionality
- **Nuxt-LLMs**: Content integration for AI responses
- **MCP Server**: Model Context Protocol server for structured data access

## Development Environment

### Package Management

- **Primary**: bun (Node.js v24+)
- **Current Version**: see `package.json` (`10.0.0` at time of writing)
- **Scripts**:
  - `bun run dev` - Start development server (using `nuxi dev`)
  - `bun run build` - Build for production (using `nuxi build`)
  - `bun run start` - Preview production build (using `nuxi preview`)
  - `bun run format` - Format code with Prettier

**Note**: A `postinstall` script handles native module compilation for `better-sqlite3` across platforms.

### Key Technologies

- **Nuxt `~4.4.8`** with Vue 3.5 Composition API (pinned — do not bump to 4.5.x)
- **TypeScript** for type safety
- **daisyUI 5** for UI components (buttons, cards, badges, modals, tabs, alerts) — loaded as a Tailwind 4 plugin via `@plugin "daisyui"` in `app/assets/css/main.css`, not a Nuxt module
- **TailwindCSS `^4.3.3`** with @tailwindcss/vite for styling
- **Font Awesome 6** for all icons (exclusive - no Heroicons/Lucide)
- **Nuxt Content** for content management
- **AWS SDK v3** (v3.894.0) for cloud services
- **LangChain/LangGraph SDK** (`^1.9.27`) for AI functionality
- **Highcharts** (`^13.0.0`) for interactive data visualization
- **Fuse.js** (`^7.5.0`) for advanced search functionality

## Project Structure

### Core Directories

- `app/` - Main application code
  - `components/` - Vue components organized by feature
  - `pages/` - File-based routing structure
  - `composables/` - Reusable composition functions
  - `middleware/` - Route middleware
  - `plugins/` - Nuxt plugins
- `server/` - API routes and server utilities
- `data/` - Static data files and TypeScript models
- `public/` - Static assets

### Key Features

#### Technical Toolbox (`app/technical`)

- **Compression Ratio Calculator** (`/technical/compression`) - Engine compression calculations with piston, crankshaft, head gasket configurations
- **Gearbox Calculator** (`/technical/gearing`) - Gear ratio calculations and speed computations
- **SU Carb Needle Configurator** (`/technical/needles`) - Interactive needle comparison with Highcharts visualization
- **Chassis Number Decoder** (`/technical/chassis-decoder`) - Historical chassis number database and identification
- **Engine Number Decoder** (`/technical/engine-decoder`) - Engine code interpretation and specifications
- **Common Clearances Reference** (`/technical/clearance`) - Comprehensive clearance specifications by system
- **Parts Equivalency Database** (`/technical/parts`) - Cross-reference part numbers between brands
- **Torque Specifications Chart** (`/technical/torque`) - Complete torque specification database

#### Archive System (`app/archive`)

- **Workshop Manuals** (`/archive/manuals`) - Complete digitized workshop manuals with search
- **Electrical Wiring Diagrams** (`/archive/electrical`) - Positive/negative ground systems by year and model
- **Historical Advertisements** (`/archive/adverts`) - Period advertising materials and brochures
- **Vendor Catalogues** (`/archive/catalogues`) - Historical parts catalogs and documentation
- **Tuning & Modifications** (`/archive/tuning`) - Performance modification guides and specs
- **Registry System** (`/archive/registry`) - User-submitted Classic Mini registrations with admin approval
- **Wheel Fitment Library** (`/archive/wheels`) - Comprehensive wheel database with user photos
- **Color Database** (`/archive/colors`) - Historical paint colors with hex values and user contributions
- **Engine Specifications** (`/archive/engines`) - Complete engine database with performance specs
- **Vehicle Weights Reference** (`/archive/weights`) - Weight specifications by model and year

#### AI-Powered Features (`app/chat`)

- **CMDIY Assistant** - LangGraph-powered conversational AI with context awareness
- **Model Context Protocol (MCP) Server** - AI integration with calculators and tools
- **Streaming Responses** - Real-time AI chat with persistent conversation threads
- **Hydration invariant**: `/chat` is SSR'd and the server always renders the empty/welcome branch. The persisted thread (localStorage, `usePersistentThread`) is read synchronously during setup, so nothing may branch the template on it until after `onMounted` (see `hasMounted` gate in `ChatWindow.vue`) — otherwise refreshing with a <24h-old thread causes a structural hydration mismatch that corrupts the page DOM. Also note `createStreamSession()`/`provideStreamContext()` call `useI18n()`/`provide()` and must keep running synchronously during setup (the `immediate: true` watch), never deferred to post-mount.

#### Administrative Features (`app/admin`)

- **Registry Review System** (`/admin/registry/review`) - Approve/reject user submissions
- **Wheel Review System** (`/admin/wheels/review`) - Review user-submitted wheel data
- **Authentication System** - Secure admin login and session management

#### E-commerce Integration (`/maps`)

- **ECU Maps Store** - Multi-ECU support (Haltech, Speeduino, MegaSquirt, etc.)
- **GitHub Integration** - Real-time repository updates and release management
- **Feature Matrix** - Ignition maps, fuel maps, VE tables, target AFR configurations

#### Internationalization (i18n)

- **Multi-Language Support** - 10 languages with comprehensive translations
- **Browser Detection** - Automatic language detection and SEO optimization
- **Nuxt i18n Module** - @nuxtjs/i18n for full internationalization support
- **Language Switching** - Dynamic locale switching with persistent user preferences

## API Structure

### Core APIs (51+ endpoints)

#### Technical Tools APIs

- `/api/decoders/chassis` - Chassis number decoding by year ranges
- `/api/decoders/engine` - Engine code interpretation and identification
- `/api/mcp/compression` - MCP integration for compression calculator
- `/api/mcp/gearbox` - MCP integration for gearbox calculator
- `/api/mcp/chassis-decoder` - MCP integration for chassis decoding

#### Database APIs

- `/api/wheels/` - Wheel fitment database with image handling
- `/api/registry/` - User registration system with approval workflow
- `/api/colors/` - Paint color database with user contributions
- `/api/engines/` - Engine specifications and performance data
- `/api/weights/` - Vehicle weight specifications

#### AI & Chat APIs

- `/api/langgraph/` - AI chat integration with streaming responses
- `/api/mcp/` - Model Context Protocol server for tool integration

#### Administrative APIs

- `/api/admin/registry/review` - Registry submission review and approval
- `/api/admin/wheels/review` - Wheel submission review and management
- `/api/admin/auth` - Authentication and session management

#### Content & Media APIs

- `/api/github/` - Repository statistics, commits, and release data
- `/api/youtube/` - Channel statistics and video integration
- `/api/maps/` - ECU maps store with GitHub integration

### External Integrations

- **GitHub API**: Repository statistics, commits, releases, and automated content updates
- **YouTube API**: Channel statistics, video feeds, and content synchronization
- **AWS Services**: S3 storage with intelligent tiering, DynamoDB queries and operations

## Development Guidelines

### Auto-import gotcha: never shadow an auto-imported name

**A local `const ref = …` anywhere in a `<script setup>` block suppresses
`import { ref } from 'vue'` for the WHOLE file.** Nuxt's auto-import (unimport)
scans the module for declared identifiers and skips injecting any name it thinks is
already provided — it does not do scope analysis. So one `const ref` inside a
`computed()` callback silently strips the top-level import, and every `ref()` at
setup scope throws `ReferenceError: ref is not defined` at runtime. Nothing fails at
build time; the component just never mounts.

This took the SU needle configurator (`app/components/Calculators/Needles.vue`) down
completely — `const ref = referenceNeedle.value` shadowed it from `ce5dc70b` until it
was found in 2026-08. Applies equally to `computed`, `watch`, `useState`, `props`,
and any composable name. If you want a short local for a "reference" something, call
it `reference`.

`python3 scripts/find-shadowed-autoimports.py` sweeps the repo for this and exits
non-zero on a hit — run it if a component mysteriously never mounts. To confirm a
specific case in dev, fetch the transformed module and look at the vue import line:
`curl -s localhost:3000/_nuxt/components/<Path>.vue | grep -oE 'import \{[^}]*\} from "[^"]*vue.runtime[^"]*"'`

### Layout invariants

- **`hero-content` is a daisyUI class, and it carries `max-width: 80rem; padding: 1rem`.**
  `Hero.vue`/`HeroPromo.vue` are not daisyUI `hero`s — they're custom `.hero-section`
  banners — so picking up `.hero-content` was accidental, and its max-width pinned the
  hero text column to the LEFT EDGE of the viewport (capped at 1280px starting at x=0)
  rather than centring it. Combined with a left-only `pl-6 md:pl-20`, the homepage H1
  sat ~250px left of every other section at 2000px wide, and got worse the wider the
  screen. Both files now neutralise it (`w-full max-w-none p-0`) and lay the column out
  in `container mx-auto px-4` — **the same container every page body uses**. Hero text
  must line up with the content beneath it; if you touch either file, verify the H1's
  `x` equals a body `section.container` child's `x` at a wide viewport.

- **Don't reintroduce per-component viewport clamps to compensate for hero padding.**
  `HomeSearchBar`'s `max-width: calc(100vw - 5rem)` existed only because the old column
  was padded on one side and overflowed right on phones. With a symmetric container that
  clamp pulls the field *off* the grid. Same reasoning for anything else placed in a hero.

- **Never size an avatar (or any fixed chrome image) with `h-full w-full`.** A percentage
  height against an auto-height parent resolves to `auto` — the image's INTRINSIC size. If
  the parent's sizing rule is ever missing or late (scoped CSS not yet applied, style block
  dropped), a 1024px avatar renders at 1024px, overflows the header flex row, shrink-crushes
  the omnisearch field (it has `flex-shrink: 1`) and drags the account dropdown off-screen.
  `MainNav.vue` uses explicit px on the `<img>` so the worst case is a merely-unrounded
  avatar, not a wrecked header.

### Code Standards

- **TypeScript**: Strict type checking enabled
- **Vue 3**: Composition API preferred over Options API
- **Prettier**: Code formatting with 2-space indentation
- **ESLint**: Linting rules for code quality

### Component Patterns

- **Single File Components**: .vue files with `<script setup>` syntax
- **Composables**: Reusable logic in `/composables/` directory
- **Type Safety**: All components properly typed with TypeScript interfaces
- **CSS**: TailwindCSS classes preferred

### Icons (Font Awesome 6 - EXCLUSIVE)

**IMPORTANT**: This project uses Font Awesome 6 as the ONLY icon library. Do NOT use Heroicons, Lucide, or any other icon libraries.

Font Awesome is loaded via a **Font Awesome Kit** (CDN script configured in `nuxt.config.ts`), not via an npm package.

#### Always use the class form — the Iconify `i-fa6-*` form does NOT render

The FA Kit works by scanning the DOM for `fa-` class tokens and swapping the element for an
inline `<svg class="svg-inline--fa">`. A single hyphenated class like `i-fa6-solid-house` has
no `fa-` token, there is no Iconify Tailwind plugin in `main.css`, and nothing renders `<Icon>`
components — so an `i-fa6-*` string used as a class produces a **silently empty element**.

The Iconify format only ever worked as a Nuxt UI `icon` prop, and Nuxt UI is gone (see above).
Any `i-fa6-*` you find is a leftover. Eleven of them were live toast icons rendering nothing
(`toast.add({ icon })` flows into `:class` in `Toaster.vue`) — fixed 2026-07-31.

```vue
<!-- Correct, everywhere: solid / regular / brands -->
<i class="fas fa-house"></i>
<i class="far fa-heart"></i>
<i class="fab fa-github"></i>
```

Pass the same class string wherever a component takes an `icon` option — `Toaster.vue` binds it
straight into `:class`, so it must be `'fas fa-circle-check'`, never `'i-fa6-solid-circle-check'`.

**Two deliberate exceptions** — do not "clean these up":

- `app/pages/models/index.vue` parses `^i-fa6-(solid|regular|brands)-(.+)$` on purpose, because
  3D-model **category icons are stored in the database in Iconify form** and converted on read.
- `app/components/Breadcrumb.vue` uses the string as a sentinel value and renders
  `<i class="fas fa-house">` explicitly.

Both exceptions are **pure string manipulation** — they emit an FA class for the Kit to swap and
never resolve Iconify icon *data*. That is why the `@iconify-json/*` collections could be dropped
along with `@nuxt/icon` (the transition-only module for the TME merge) once the last `<Icon>` tag
was converted. Nothing in `app/` renders `<Icon>` or needs an Iconify collection; don't re-add one
to "support" these two files.

**Gotcha:** `@nuxt/icon` and `@iconify-json/carbon` are still physically present in
`node_modules` as transitive deps of `nuxtseo-layer-devtools` → `@nuxt/ui` (the `@nuxtjs/seo`
devtools layer). Their presence on disk is **not** evidence the site uses them — the module is not
in `nuxt.config.ts`'s `modules` array, so it never runs, and `@nuxt/ui` being reachable in
`node_modules` still does not mean `<U*>` components exist here.

#### Inline Icons

For inline icons in templates, use the traditional Font Awesome class syntax:

```vue
<i class="fas fa-house"></i>
<!-- Solid -->
<i class="far fa-heart"></i>
<!-- Regular -->
<i class="fab fa-github"></i>
<!-- Brands -->
<i class="fad fa-spinner"></i>
<!-- Duotone -->
```

#### Common Icon Mappings

| Purpose     | Iconify Format                     | Class Format                  |
| ----------- | ---------------------------------- | ----------------------------- |
| Home        | `i-fa6-solid-house`                | `fas fa-house`                |
| Search      | `i-fa6-solid-magnifying-glass`     | `fas fa-magnifying-glass`     |
| Settings    | `i-fa6-solid-gear`                 | `fas fa-gear`                 |
| User        | `i-fa6-solid-user`                 | `fas fa-user`                 |
| Info        | `i-fa6-solid-circle-info`          | `fas fa-circle-info`          |
| Warning     | `i-fa6-solid-triangle-exclamation` | `fas fa-triangle-exclamation` |
| Error       | `i-fa6-solid-circle-xmark`         | `fas fa-circle-xmark`         |
| Plus        | `i-fa6-solid-plus`                 | `fas fa-plus`                 |
| Close       | `i-fa6-solid-xmark`                | `fas fa-xmark`                |
| Arrow Right | `i-fa6-solid-arrow-right`          | `fas fa-arrow-right`          |
| File        | `i-fa6-solid-file-lines`           | `fas fa-file-lines`           |
| Car         | `i-fa6-solid-car`                  | `fas fa-car`                  |

### Performance Optimizations

- **SSR/ISR**: Strategic prerendering for static content
- **Image Optimization**: Multiple formats (WebP, AVIF) with responsive sizes
- **Code Splitting**: Manual chunks for better caching
- **Service Worker**: PWA caching strategies for offline functionality
- **CDN Integration**: S3 static assets with intelligent tiering
- **Bundle Optimization**: Tree shaking and dependency optimization

### Image Optimization Invariants

- **`image.domains` in `nuxt.config.ts` is matched on the LITERAL hostname, and a miss is
  silent.** @nuxt/image passes an unlisted URL straight through — no resize, no format
  conversion — *even inside `<nuxt-img>`*, so the markup looks optimized while shipping the
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
  unoptimized image is an *absolute* S3/Supabase URL (external → never crawled), but an
  optimized one is a same-origin `/_ipx/...` path, so the crawler treats every variant as a
  route and transcodes it through sharp **at build time**. When this was first missed it was
  **603 of 768 prerendered routes (78%)**, and the resulting RSS inflation pushed the Nitro
  bundling step past the 8 GB build container — SIGKILL, OOM.

  Two things make this hard to diagnose, so recognise the shape: the kill lands during Nitro
  *bundling*, well after prerender reports success, and because the build sits near the
  ceiling it can first fail on a commit that touches nothing (it initially tripped on a
  docs-only commit). A `SIGKILL` is the **container** OOM killer, not a V8 heap error — if you
  see `JavaScript heap out of memory` instead, that's a genuinely different problem.

  Prerendering ipx output is worthless anyway: variants regenerate at runtime and Vercel's CDN
  holds them for 7 days (`s-maxage=604800`), and user-uploaded photos added after a build have
  no baked variant regardless. The same reasoning applies to any future runtime-generated
  image route.

### SEO / Head Invariants

- **Never pass a possibly-empty string (or any non-string) to `ogImage` / `twitterImage` in `useSeoMeta`.** unhead's flat-meta unpacking coerces `''` to boolean `true`, and nuxt-og-image's `tags:afterResolve` hook calls `.replaceAll()` on every `og:image`/`twitter:image` content — a truthy non-string 500s the whole SSR render (this took down `/archive/colors/[id]` for months). Derive share images with `computed()` (a lazy `watch` never fires during SSR, so a ref stays at its initial value server-side) and always fall back to a real URL. `app/plugins/seo-tag-guard.server.ts` + `app/utils/seoTagGuards.ts` are the SSR safety net that sanitizes these tags before nuxt-og-image sees them — don't remove them.

- **Every dynamic route must 404 on a miss — `app/pages/[...slug].vue` most of all.** That file is the site-wide catch-all, so *any* unmatched URL on the domain reaches it. Until 2026-07 it answered HTTP 200 with `<title>undefined - Classic Mini Archive</title>` and a self-referencing canonical for literally every unknown path (`/wp-admin`, `/foo/bar/baz`, …) — an unbounded soft-404 space that Google indexes and burns crawl budget on. It, and every `[slug]`/`[id]` detail page, must `throw createError({ statusCode: 404, fatal: true })` when the record isn't found. The one deliberate exception is `/exchange/listings/[slug]`: an SSR miss there can also be a *pending* listing whose RLS row only the signed-in owner can read (SSR has no session), so it sets `setResponseStatus(event, 404)` + `noindex` and still renders, letting the `onMounted` retry recover it for the owner.

- **A routeRule makes a path a "known route" to `@nuxtjs/sitemap`.** `/technical/calculators/{needles,gearbox}` had no page files but kept `prerender: false` routeRules, which was enough to put both dead URLs in the sitemap, where they resolved through the catch-all as `undefined`-titled 200s. If you delete a page, delete or 301 its routeRules too, and add the path to `sitemap.exclude`. (On Vercel these `redirect` routeRules serve real 301s; the meta-refresh `index.html` in `.output/public` is a build artifact the platform routing shadows — same as `/archive/manuals`.)

- **Browse pages with query params must use `useFacetedSeo()`** (`app/composables/useFacetedSeo.ts`). `nuxt-seo-utils` derives the canonical from the *current URL including its query string*, so without it every filter/sort permutation self-canonicalises into its own indexable near-duplicate — a combinatorial crawl trap, and one that swallows `?utm_source=`/`?fbclid=` URLs too. The composable canonicalises to an allowlist of params (default `['page']`) and marks anything else `noindex, follow`. It routes robots through **`useRobotsRule()`**, not `useSeoMeta({ robots })`: the latter *replaces* @nuxtjs/robots' tag and silently drops `max-image-preview:large` / `max-snippet:-1`. Never pass `true` to `useRobotsRule` to "restore" the default — it maps to `robotsEnabledValue` unconditionally and would force `index, follow` onto preview deployments. Not calling it is what leaves the environment default intact.

- **There is deliberately NO FAQPage JSON-LD, and no visible FAQ block, on the technical pages.** Google requires FAQ markup to match content that is *visible* on the page, and a visible Q&A section was judged to add nothing for human readers on pages that are already spec tables. Shipping the schema without its on-page counterpart is a structured-data policy violation, so the project ships **neither**: `app/utils/geo/generateFaqs.ts` now feeds only `server/plugins/llms-faq.ts` → **`/llms-full.txt`**, which is the legitimate machine-readable channel (it isn't the page, so it isn't cloaking). Both halves or neither — don't re-add FAQPage schema without rendering the questions.

### Image Optimization Invariants

- **Never set `image.provider` in `nuxt.config.ts`.** Leaving it unset (`'auto'`) is
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

### Security Invariants

Load-bearing contracts — don't "fix" these without understanding why they're this way:

- **`/api/langgraph/**` is intentionally UNAUTHENTICATED.** The AI chat must work for every anonymous site visitor (no login). Do NOT add `requireUserAuth`/login to this proxy — it would break public chat. Abuse is mitigated by per-IP rate limiting in `server/middleware/rate-limit.ts` (default 40 req/60s, tune via `LANGGRAPH_RATELIMIT_MAX` / `LANGGRAPH_RATELIMIT_WINDOW_MS`), not by auth. The privileged `NUXT_LANGSMITH_API_KEY` stays server-only (private `runtimeConfig`).
- **`/mcp` auth fails closed.** Valid keys come ONLY from `MCP_API_KEY` / `MCP_API_KEYS` env vars — there is no hardcoded/default key. The old `dev-mcp-key-classic-mini-diy` default is in public git history and must never be re-accepted in any environment. For local dev, set `MCP_API_KEY` in `.env`.
- **`SUPABASE_SERVICE_KEY` is server-only.** It lives in private `runtimeConfig` and is read only via `server/utils/supabase.ts#getServiceClient`. Never import that into `app/` or move the key to `runtimeConfig.public`.
- **Edit-suggestion field keys are raw column names, gated by an allowlist.** `SuggestEditModal`'s `editable-fields` keys (and the matching `current-data` keys) are written verbatim into `submission_queue.data.changes` **by the browser**, and `applyEditSuggestion()` in `server/api/admin/queue/approve.post.ts` maps them straight onto the UPDATE — there is no camelCase-to-snake_case layer, so every key must be a real snake_case column on the mapped table. Because that JSON is client-controlled, `EDIT_TARGETS` in that file is the security boundary: it is what stops a crafted suggestion from rewriting `status`, `submitted_by`, `reviewed_by`, `legacy_id` or `legacy_submitted_by_email` the moment an admin approves. **Adding a field to any `SuggestEditModal` call site means adding the column name to `EDIT_TARGETS[targetType].columns` too**, or approval is refused outright. Never add ownership/moderation/audit columns or asset paths to those lists. Past instances of getting this wrong: `bodyNum`/`engineNum` (registry, fixed for supabase#65) and `offset` vs `offset_value` (wheels).

## Trust System Invariants

- **Every human-reviewed approval must feed trust.** Counters + `contributions` ledger + `recalculate_trust_level()` fire DB-side (submission_queue trigger, model-version RPCs, `moderate_external_model`, listings pending→active trigger). If you add a new approval surface, it must do the same — contract: `classicminidiy-supabase/docs/plans/2026-07-13-unified-trust-pipeline.md`.
- **Public profile reads go through the `public_profiles` view, not `profiles`.** Since the profiles split, `profiles` SELECT is own-row/admin-only; the view carries the community-facing trust columns (`trust_level`, `total_submissions`, `approved_submissions`). Querying `profiles` for another user silently returns zero rows.
- **Trust visibility:** `DashboardTrustProgressCard` on `/dashboard/submissions` is the user-facing explanation of levels/thresholds (3 approved → contributor; 10 + <20% rejections → trusted; 30-day tenure path to contributor). Keep its copy in sync with the DB thresholds if they change.

## Marketplace (`/exchange`) Invariants

- **A paid listing is born `draft`, and ONLY the payment path may promote it to
  `pending`.** `ListingWizard.submitListing()` creates paid-tier rows as `draft`
  on purpose, so an abandoned Stripe checkout never lands in the moderation
  queue. That makes the promotion a hard requirement of every surface that
  completes a payment, and there are three: the Sustaining Member comp
  (`grantComplimentaryPremiumListing`), the webhook, and the verify fallback
  (both via `markListingPaid`). All three call `promoteListingToPending` in
  `classicminidiy-supabase/supabase/functions/_shared/listings.ts`.

  Getting this wrong is invisible in testing and total in production. A `draft`
  is filtered out of **both** directions — browse reads `status='active'` only
  (`useExampleListings.activeStatuses`) and the admin queue reads
  `status='pending'` only (`/admin/exchange/moderation`) — so the listing exists,
  is complete, and is readable by nobody but its owner via own-row RLS. From the
  2026-07-13 TME cutover until 2026-08-12 every paid listing landed there. It
  surfaced as a seller reporting his ad had *disappeared*, not that it had never
  published, because the comped confirmation screen claimed "Live Now" in all 10
  locales. Nobody caught it sooner because the paid path also never called
  `/api/exchange/listings/submit`, so no `admin_listing_pending` email ever fired.

  `promoteListingToPending` is filtered on `status='draft'` and that predicate is
  load-bearing, not defensive: it is the only thing stopping a payment from
  flipping a `pending` listing live (bypassing review), resurrecting a `sold`
  one, or demoting an `active` one. Never widen it. `pending → active` belongs to
  moderation alone, which is also what fires the `on_listing_approved` trust
  trigger — so promoting a swallowed listing straight to `active` silently robs
  the seller of trust credit. Send it to `pending` and let review approve it.

- **`useListings().publishListing()` has no callers, and wiring it up client-side
  is the wrong fix for the above.** It sets `status: 'active'` directly, and the
  `Update listings policy` RLS rule is `auth.uid() = user_id` with **no
  `with_check` and no column allowlist** — so an owner can already self-publish
  straight past moderation from the browser. Promotion belongs server-side, in
  the edge function, where ownership and payment are both verified.

## Contribution Loop Invariants

The UX cohesion pass turned the archive into a contribution platform. The loop is
_wizard → admin inbox → review drawer → contributor profile_, and these are the
parts of it that break silently if you get them wrong.

- **Approving a queued submission MUST write `submitted_by` on the inserted row.**
  `insertApprovedItem()` in `server/api/admin/queue/approve.post.ts` used to set only
  the free-text `legacy_submitted_by`, so an approved contribution was never linked to
  the account that made it — no profile stats, no badges, no leaderboard entry, no
  "added by @handle" credit anywhere. Every archive table has the FK; it just wasn't
  being populated. A new approval path must populate it too.

- **"Attach to an existing entry" is carried differently for colours than for
  everything else, and dropping it creates duplicate archive rows.** Wheels and
  registry entries gap-fill through `edit_suggestion` + `target_id`, so the
  association lives on the submission row and `applyEditSuggestion()` cannot lose
  it. Colours can't: `/contribute/color` is the one archive form that is not the
  wizard, so it submits a `new_item` and stamps the chosen colour's id inside
  `data.originalColorId`. `insertApprovedItem()` ignored that field until
  2026-08 and INSERTed a photo-only stub instead — same name, no hex, no swatch,
  empty paint codes — which is how `/archive/colors` ended up listing colours
  twice. The blast radius was bigger than the listing: a stub shares its real
  colour's `name+code+short_code`, the exact tuple
  `20260727000001_restore_wheel_colour_legacy_ids.sql` matches on, so a legacy
  DynamoDB id was restored onto a stub and that colour's legacy deep link broke.
  (Two live instances, rows cleaned up by supabase PR #77.) When merging into an
  existing row, `submitted_by` and `swatch_path` are only written if the row does
  not already have one — reassigning either steals another contributor's credit
  or overwrites curated data.

- **TWO routes approve colours, and their shared decisions live in
  `server/utils/archiveApprovals.ts` so they cannot drift again.**
  `server/api/admin/queue/approve.post.ts` is the admin inbox and the path
  submissions actually flow through; `server/api/colors/queue/save.ts` is the
  older `/admin/colors/review` page, unlinked from every nav but reachable by
  URL — and `/api/colors/queue/list` spreads `...item.data`, so the SAME
  submissions are approvable from it. They had drifted on all four decisions
  that matter: honouring `originalColorId`, appending rather than replacing
  `contributor_images`, pinning asset URLs to this submission's own uploads
  (`isOwnUploadUrl` — `submission_queue.data` is browser-written), and writing
  `submitted_by`. Anything both routes must decide identically belongs in that
  util, not copied into one of them. If you add a third approval surface, it
  imports from there too.

- **`contributor_archive_items` is the single source for every contributor stat.**
  It unions the approved, user-attributed rows of wheels / registry_entries / colors /
  archive_documents. `get_contributor_impact`, `contributor_badge_metrics`,
  `get_contributor_leaderboard` and `get_archive_latest_additions` all read it, so a new
  contributable table is one branch in that view — not five aggregate rewrites.

- **Nothing an anonymous caller writes may move a number a visitor can see.**
  Two places this shows up: omnisearch zero-result telemetry lands in the admin-only
  `archive_search_misses` and is promoted to a public Most Wanted row by hand
  (`promote_search_miss`), and `archive_requests.ask_count` only moves through
  `request_archive_item()`, which is one-ask-per-account via the `archive_request_asks`
  ledger. Same reasoning for reach: `record_archive_view` is **service-role only** and
  `archive_item_views` is keyed `(target, day, visitor_hash, is_download)`, so a refresh
  loop is worthless — the same shape `model_downloads` already uses.

- **`changes_requested` deliberately touches no counter.** It is a request for a
  revision, not a verdict. Counting it against the contributor would teach reviewers to
  reject instead of coach, which is the opposite of why the third button exists.
  `/api/admin/queue/request-changes` requires a reviewer note for the same reason — the
  note is the entire deliverable of that action.

- **`data/models/toolbox-catalog.ts` is keyed on the same `to` paths as `ToolboxItems`
  in `generic.ts`.** The catalog carries the wayfinding metadata (English names for
  server-side search, `category` for the subnav, `relatedArchive` for the tool-page
  box, `archiveBacked` for the olive tag). Add or move a tool and both must change.
  Tool names live there in English rather than as i18n keys because `/api/search` runs
  server-side and has no `useI18n()`.

- **Omnisearch is two sources merged in the Nitro route, on purpose.** Postgres
  `omnisearch()` covers the data surfaces; the Toolbox is matched in process from the
  static catalog. That keeps "add a calculator" a code change rather than a migration,
  and lets tool matching use synonyms ("CR", "lb-ft", "HIF44") that would be awkward to
  store. The SQL is ILIKE rather than tsvector deliberately — these corpora are small
  and the queries are as often part numbers and wheel sizes as words, which stemming
  actively hurts.

- **`/search` must keep `useFacetedSeo('/search', { indexableParams: [] })`.** `?q=` and
  `?surface=` would otherwise self-canonicalise every query into its own indexable
  near-duplicate — the same crawl trap documented under SEO invariants above.

- **`useRecentTools().load()` runs in `onMounted`, never during setup.** It reads
  localStorage, and the server renders "no chips"; reading it during setup is exactly
  the structural hydration mismatch that corrupted `/chat`.

- **`ContributeWizard.vue` is the only archive submission form — except colours.**
  Documents, registry entries, wheels and fixes all go through it. The
  `/contribute/{document,registry,wheel}` ROUTES still exist but are thin
  `ContributeLauncher` pages that open the wizard: `nuxt.config.ts` 301s
  `/archive/documents/submit`, `/archive/colors/contribute` and `/archive/wheels/submit`
  at them, so deleting the routes would break years-old inbound links. `?uuid=` on
  `/contribute/wheel` still means "add to this existing entry" and maps to the wizard's
  gap-fill. `/contribute/color` remains a real form — its swatch-versus-contributor-photo
  split does not fit the wizard's shared step 2.

  The registry step must keep collecting `trim`, `bodyType` and `engineSize`. They are
  real `registry_entries` columns, `trim` is a visible `RegistryTable` column, and the
  payload keys have to stay as-is because `insertApprovedItem()` maps them by name
  (`bodyNum` → `body_number`, `engineNum` → `engine_number`).

## Environment Variables

### Required Runtime Config

```env
# AWS Credentials
dynamo_id=
dynamo_key=
s3_id=
s3_key=

# External APIs
githubAPIKey=
youtubeAPIKey=
validation_key=

# AI Services
NUXT_LANGGRAPH_API_URL=
NUXT_LANGSMITH_API_KEY=

# Database
POSTGRES_URL=

# Public URLs
NUXT_PUBLIC_SITE_URL=
s3Base=
```

## Content Management

### Static Data

- JSON files in `/data/` directory for reference information
- TypeScript models for data structure validation
- Automated data processing for consistency

### Dynamic Content

- **Nuxt Content**: Markdown-based content with frontmatter
- **DynamoDB**: User-generated content (registry, wheels)
- **S3**: File storage for images and documents

## Deployment

### Vercel Configuration

- **Config File**: `vercel.json` with bun commands
- **Install Command**: `bun install --frozen-lockfile`
- **Build Command**: `bun run build`
- **Output Directory**: `.nuxt/dist`
- **Node Version**: 24.x
- **Environment**: Production optimizations enabled

### Performance Features

- **Prerendering**: Static pages cached at build time
- **Edge Functions**: API routes optimized for global distribution
- **Asset Optimization**: Compression, minification, tree shaking
- **Monitoring**: Vercel Analytics and Speed Insights integration

## Testing & Quality

### Intentional dependency pins (do not blindly bump)

- **`nuxt` is held at `~4.4.8` — do NOT move to 4.5.x yet.** Nuxt 4.5's head-pipeline
  change breaks `nuxt-schema-org` (via `@nuxtjs/seo`): every SSR request throws
  `unhandledRejection ... reading 'resolveGraph'/'push'` and ALL schema.org JSON-LD
  renders as an EMPTY `<script type="application/ld+json">` — silently killing the GEO
  structured-data work. Upstream: https://github.com/harlan-zw/nuxt-seo/issues/588 (open).
  Nuxt 4.5 also surfaced (fixes already landed here, kept forward-compatible):
  rolldown-vite requires function-form `manualChunks` + `cssMinify: 'esbuild'`
  (lightningcss chokes on daisyUI `round(to-zero, ...)`), highcharts-vue's UMD default
  import needs the install-unwrap in `app/plugins/highcharts.ts`, and
  `await useFetch(() => '/url')` (getter form) stops blocking async setup — SSR renders
  the pending branch and client hydration hangs (fixed in Needles.vue; check
  `ModelComments.vue`'s reactive getter when unpinning). When #588 is fixed: bump nuxt,
  re-verify JSON-LD is non-empty on a built page, and adopt `experimental.watcher: 'builder'`.
- **`dompurify` is pinned to an exact version (currently `3.4.12`), and
  `tests/unit/exchange/utils/markdown.test.ts` MUST stay on `@vitest-environment jsdom`.**
  These two facts are one contract — don't change either in isolation. Since 3.4.8
  DOMPurify walks the DOM with a node iterator that happy-dom mis-implements, and the
  failure is silent-unsafe rather than noisy: under happy-dom, `sanitize()` returns
  markup with a live `javascript:` href intact, drops allowlisted tags, and never fires
  the `afterSanitizeAttributes` link-hardening hook. Under happy-dom the XSS suite is
  therefore asserting nothing. jsdom reproduces real-browser output byte-for-byte
  (verified against Chrome on 3.4.12), so that file — and any future test that exercises
  DOMPurify — runs on jsdom while the rest of the suite keeps the happy-dom default from
  `vitest.config.ts`. happy-dom 20.11.1 is still affected; recheck before "simplifying"
  the env back. The exact pin (no `^`) is deliberate: a DOMPurify bump is a security
  change and should be a visible, tested commit, not a silent range resolution.
- **`@takumi-rs/core` stays on 1.x.** nuxt-og-image's optional peer range is `^1.x`; 2.x
  breaks branded OG image rendering.
- **`@types/node` stays on 25.x** while `engines.node` is `^24` (26.x types target Node 26 APIs).

### Code Quality

- **TypeScript**: Compile-time type checking
- **Prettier**: Consistent code formatting
- **Build Validation**: Production build testing required

### Performance

- **Lighthouse**: Regular performance auditing
- **Core Web Vitals**: Monitoring via Vercel Speed Insights
- **PWA**: Progressive web app functionality testing

## Common Tasks

### Adding New Features

1. Create TypeScript interfaces in `/data/models/`
2. Add API routes in `/server/api/`
3. Create Vue components with proper typing
4. Update navigation and routing as needed
5. Test build process: `bun run build`

### Content Updates

- Static data: Update JSON files in `/data/`
- Dynamic content: Use admin interfaces (`/admin`) or direct API calls
- Images: Upload to S3 bucket with appropriate paths and WebP optimization
- User submissions: Review via admin panel for registry and wheel database entries

### Database Management

#### User-Generated Content

- **Registry System**: Admin approval workflow for Classic Mini registrations
- **Wheel Database**: Image processing and fitment data review system
- **Color Contributions**: User-submitted paint color database with validation

#### Static Reference Data

- **Technical Specifications**: JSON-based torque values, clearances, and part equivalencies
- **Historical Data**: Chassis numbers, engine codes, and specifications by year
- **Archive Content**: Digitized manuals, wiring diagrams, and historical documents

### Performance Optimization

- Run `bun run build` to test production build
- Check bundle analysis for large dependencies
- Verify image optimization is working correctly
- Test PWA functionality and caching strategies

## Internationalization (i18n)

**@nuxtjs/i18n v10**, `strategy: 'no_prefix'` (clean URLs — no `/de/` path prefix),
`defaultLocale: 'en'`, 10 locales: `en, es, fr, de, it, pt, ru, ja, zh, ko`. Locale
is chosen by the `i18n_redirected` cookie (browser detection on root only); SSR
honors the cookie.

### How translations actually work (read this before touching i18n)

Translations live in **per-component `<i18n lang="json">` SFC blocks** — each page or
component carries its own block with all 10 locales inline. There are **NO global
locale JSON files** (`i18n/locales/*.json` does not exist) and no `langDir`. The root
`i18n.config.ts` is plumbing only (`legacy: false`, empty `messages`); it does not
hold strings. `nuxt.config.ts` sets `i18n.restructureDir: '.'` so the root
`i18n.config.ts` resolves without a warning (v10 defaults the i18n dir to `i18n/`).

```vue
<script setup lang="ts">
  const { t } = useI18n(); // auto-imported — no import statement
</script>

<template>
  <h1>{{ t('hero.title') }}</h1>
  <p>{{ t('intro.body', { count }) }}</p>
</template>

<i18n lang="json">
{
  "en": { "hero": { "title": "..." }, "intro": { "body": "{count} models" } },
  "es": { "hero": { "title": "..." }, "intro": { "body": "{count} modelos" } }
  // ...fr, de, it, pt, ru, ja, zh, ko — all 10 required
}
</i18n>
```

### Rules

- **Add a new translatable surface** by adding `const { t } = useI18n()`, using `t('key')`
  in template/script, and appending an `<i18n lang="json">` block with **all 10 locales**.
  Do not create files under `i18n/locales/` — that pattern is not used here.
- **No HTML inside message values.** `unplugin-vue-i18n` hard-fails the build with
  "Detected HTML in '…' message" if a string contains tags like `<strong>`. Keep markup
  in the template wrapping `{{ t() }}`, or split the sentence into keyed segments. Do not
  put HTML in messages + render with `v-html`.
- Use named interpolation params (`t('x', { count })` ↔ `"{count} models"`) for dynamic text.
- The block is parsed at build time — invalid JSON breaks the build.
- `LanguageSwitcher.vue` (`/app/components/LanguageSwitcher.vue`) is the locale dropdown
  (persists the cookie; no route switching needed under `no_prefix`).

### Localization coverage

Most of the site is localized via these blocks. The **3D Model Library** user-facing UI
(browse, detail, the upload wizard, the dashboard `models`/`selling`/`purchases` tabs, and
the `app/components/models/*` components) is fully translated. **`/legal/*`, `/about`, and
`/admin/models` are intentionally English-only** — legal text is kept authoritative in one
language (translating it creates per-language liability), `/about` is authoritative founder
E-E-A-T identity content (same rationale), and admin is internal tooling.

## 3D Model Library (marketplace)

A community 3D-printable parts library with a Stripe Connect marketplace. Backend lives in
`classicminidiy-supabase` (migrations `20260611*`, edge functions, RLS). Keystone contract:
`classicminidiy-supabase/docs/plans/2026-06-11-3d-model-library.md`. Built on the long-lived
`feature/3d-models` branch (no `modelsEnabled` flag — "launch" = merge to main).

**Load-bearing contracts:**

- **Supabase session is in localStorage, not a cookie.** Any `/api/*` route that needs the
  user must receive an explicit `Authorization: Bearer <access_token>` header (get it from
  `supabase.auth.getSession()`). Direct `useSupabase()` → PostgREST/RPC calls are auto-authed
  and need no Bearer.
- **Payments are thin web proxies → edge functions.** `POST /api/models/[id]/checkout`,
  `/verify-purchase`, and `/api/models/seller/onboard` forward the Bearer token to
  `create-model-checkout` / `verify-model-purchase` / `create-seller-onboarding`. The web
  never calls Stripe directly. Redirect URLs are built from the browser origin and validated
  by the edge functions' allowlist (localhost is allowed for dev).
- **Stripe Connect (model sales) is separate from membership Stripe.** Direct charges on the
  seller's Standard connected account + platform commission via `application_fee_amount`;
  metadata `cmdiy_kind` starts `model_`. Its webhook endpoint + `STRIPE_CONNECT_WEBHOOK_SECRET`
  are distinct from the membership webhook. Do not conflate with the `$1.99/mo` membership.
- **Entitlement is the download gate.** `has_model_entitlement(model_id)` RPC: free/tips and
  owner/admin always true; paid needs a purchase row; `removed`/`flagged` revokes everyone.
  The download route (`/api/models/[modelId]/files/[fileId]/download`) enforces it server-side;
  the detail page reads the RPC client-side to choose download vs. PriceBox.
- **Admin moderation** (`/admin/models`): approve/reject call the `is_admin()`-guarded RPCs
  client-side (admin JWT). Report-resolution (takedown + reporter notification + audit) and
  the seller kill-switch are service-role routes under `server/api/admin/models/`.
- **Contribution management is unified under `/dashboard`** (tabbed: models, gear-configs,
  submissions, selling, purchases). `/models/mine` redirects to `/dashboard/models`.
- New web env: `S3_MODELS_BUCKET`, `S3_MODELS_ACCESS_KEY_ID`, `S3_MODELS_SECRET_ACCESS_KEY`
  (dedicated IAM user, separate bucket from static assets). Launch steps:
  `docs/runbooks/2026-06-12-model-library-launch-checklist.md`.

## Advanced Features

### Progressive Web App (PWA)

- **Offline Functionality**: Service worker caching for offline access
- **App-like Experience**: Installable web application
- **Mobile Optimization**: Responsive design with touch-friendly interfaces

### SEO & Social Integration

- **Comprehensive SEO**: Meta tags, structured data, XML sitemaps
- **Social Sharing**: Open Graph and Twitter cards for all pages
- **Multi-language SEO**: Language-specific meta tags and content optimization

### Developer Tools Integration

- **Recommended Tools Database**: Categorized tool lists with vendor integration
- **Amazon Affiliate Links**: Integrated product recommendations
- **Image Optimization**: WebP variants with fallback support

### Performance Monitoring

- **Analytics Integration**: Google Analytics, Vercel Analytics, Speed Insights
- **Core Web Vitals**: Real-time performance monitoring
- **Error Tracking**: Comprehensive error logging and monitoring

## Notable Technical Achievements

1. **Comprehensive Classic Mini Database**: One of the most complete digital archives for Classic Mini information worldwide
2. **Advanced AI Integration**: Sophisticated LangGraph implementation with MCP server for technical assistance
3. **Multi-language Support**: Full internationalization across 10 languages with browser detection
4. **User-Generated Content System**: Advanced submission and administrative review workflows
5. **Performance Excellence**: Extensive optimization strategies including PWA, CDN, and caching
6. **Real-time Features**: Streaming AI responses and live data synchronization

## Recent Updates & Changes

### Current Version: 10.0.0

**Major Framework Upgrades:**

- **Nuxt 4**: Upgraded from Nuxt 3; now pinned at `~4.4.8` (see "Intentional dependency pins")
- **TailwindCSS v4**: Migration to TailwindCSS 4.x with @tailwindcss/vite for better build performance and developer experience
- **Node.js 24**: Updated Node.js requirement to v24+ for latest performance improvements
- **Bun Package Manager**: Migrated from npm to bun for faster dependency installation and script execution

**Recent Commits and Updates:**

- **AWS Package Updates**: Updated AWS SDK packages to v3.894.0 for improved performance and security
- **Visual Normalization**: Extensive visual improvements across search and table views with new table options for archive pages
- **Wheel Submit Bugfixes**: Small improvements to the wheel submission functionality
- **Search Enhancement**: Migration to Fuse.js (now `^7.5.0`) for improved fuzzy search capabilities across the platform
- **Security Updates**: Regular package updates focusing on security improvements
- **Translation Fixes**: Ongoing improvements to internationalization support

**Key Dependencies Updated:**

- `@aws-sdk/*` packages: v3.894.0
- `nuxt`: `~4.4.8` (pinned)
- `daisyui`: v5.6.18 (Tailwind 4 plugin — replaced `@nuxt/ui`)
- `tailwindcss`: `^4.3.3`
- `fuse.js`: `^7.5.0`
- `highcharts`: `^13.0.0`
- `@langchain/langgraph-sdk`: `^1.9.27`

**Font Awesome**: Loaded via Font Awesome Kit (CDN script in nuxt.config.ts)

## Support Resources

- **Documentation**: Comprehensive README.md with setup instructions
- **Community**: GitHub Issues for bug reports and feature requests
- **Support**: Patreon for server costs and development funding
- **Related Projects**: YouTube channel and merchandise store integration
