# CLAUDE.md

This file provides guidance to Claude Code when working with the Classic Mini DIY project.

## Public repository — everything here is world-readable

**`ClassicMiniDIY/classicminidiy` is a PUBLIC repo (GPL-3.0). Every file you add
or edit — code, comments, docs, commit messages, PR titles and bodies — is
published, permanently, to anyone. `classicminidiy-supabase` is PRIVATE; that is
where anything that must not be public belongs.** Write as if a stranger is
reading, because one is.

Note what this does and does not buy you. The source here is already public, so
redacting something from a doc that the code plainly shows achieves nothing —
the rate-limit defaults and the `/api/admin/**` throttle exemption, for example,
are right there in `server/middleware/rate-limit.ts`. What documentation
uniquely exposes, and what therefore needs judgement, is:

1. **Private-repo internals.** RLS policy bodies, migration contents, trigger and
   schema detail from `classicminidiy-supabase` are not otherwise visible here.
   Restating them turns a private design into a public one. Reference the
   contract and the behaviour developers must respect; point at the private repo
   for the mechanism.
2. **Attack narratives.** A synthesised "here is how you would defeat X" — an
   ordered bypass sequence, a probe map, a named function that is a ready-made
   exploit call — is worth far more to an adversary than the scattered code it
   was assembled from. Document the rule to uphold, not the route around it. The
   same applies to describing a weakness in the present tense; if something is
   genuinely exploitable, fix it in code rather than annotate it in prose.
3. **Operational state.** What is currently unfixed, infra-side configuration
   that lives outside this repo (WAF and firewall rules, env values, dashboard
   settings), abuse thresholds tuned in infra rather than code, and incident
   specifics naming real users or their data.

Also never commit real user data — no customer emails, listing or user ids, or
support-ticket contents — even in a test fixture or a comment. Use obviously
fake values.

If a note is genuinely valuable but fails the above, write it in
`classicminidiy-supabase`'s CLAUDE.md and leave a pointer here. And remember that
scrubbing after the fact is only partial: history, forks and API caches keep what
was pushed, and rewriting `main` is not an option.

## CMDIY Ecosystem Context

This repo is part of the Classic Mini DIY property ecosystem. For the full cross-repo architecture, please refer to the central documentation. Key related repos:

- **classicminidiy-supabase** — Shared Supabase backend (PostgreSQL, Auth, Edge Functions, RLS)
- ~~**TheMiniExchange**~~ — **RETIRED.** The marketplace was consolidated into this repo and
  lives at `/exchange` on classicminidiy.com (cutover completed 2026-07-13). The
  `TheMiniExchange` repo is retired and its remaining infra is being torn down separately —
  **make no changes there**. `theminiexchange.com` 301s here via
  `server/middleware/tme-redirects.ts` (map in `server/utils/tmeRedirects.ts`, mirrored to
  zone-edge rules by `scripts/sync-tme-zone-redirects.py`); those redirects are load-bearing
  SEO and must not be removed. They used to live in `vercel.json`, which is gone — see
  "Deployment" below.
- **Native CMDIY Apps** — iOS (Swift) and Android (Kotlin) mobile apps

This site shares the Supabase auth and profiles with the other properties. Database schema lives in `classicminidiy-supabase`.

## Project Overview

**Classic Mini DIY** is a comprehensive web application serving as both a toolkit and permanent archive for Classic Mini enthusiasts. It provides technical information, calculators, historical documents, and interactive tools for Classic Mini owners and mechanics.

- **Framework**: Nuxt `~4.5.2` (Vue 3.5) with TypeScript
- **Purpose**: Classic Mini car enthusiast website and knowledgebase
- **URL**: https://classicminidiy.com
- **Repository**: https://github.com/somethingnew71/classicminidiy
- **License**: GPL-3.0

## Architecture

### Frontend

- **Framework**: Nuxt `~4.5.2` with TypeScript
- **UI Components**: **daisyUI 5** (`card`, `btn`, `badge`, `modal`, `tabs`, `alert`, …). `@nuxt/ui` is NOT installed — it was removed in `3c6d6125 refactor: migrate from @nuxt/ui to daisyui 5`, and `<U*>` components do not exist in this codebase
- **Styling**: TailwindCSS `^4.3.3` with @tailwindcss/vite
- **Icons**: Font Awesome 6 (exclusive icon library - no Heroicons or Lucide)
- **Search**: Fuse.js for advanced fuzzy search functionality
- **Charts**: Highcharts for data visualization
- **PWA**: Configured with @vite-pwa/nuxt for offline functionality
- **SEO**: Comprehensive meta tags, structured data, sitemap generation

### Backend & Infrastructure

- **Hosting**: Cloudflare Workers (Vercel retired — see "Deployment")
- **Database**: Supabase (PostgreSQL) is the primary store; DynamoDB retains
  legacy archive data only
- **Storage**: AWS S3 with intelligent tiering and versioning
- **CDN**: S3 static assets with custom domain
- **Analytics**: PostHog (replaced Google Analytics and Vercel Analytics)

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
  - `bun run format` - Format code with Prettier. **Formats the WHOLE repo — never run
    it on a feature branch.** Resolved Prettier versions differ enough between checkouts
    that it rewrites hundreds of untouched files and buries the real change. Format only
    your own paths: `bunx prettier --write <paths>`.

**Note**: There is no `postinstall` script. `bun install` therefore never runs `nuxt prepare`, so `.nuxt/tsconfig.json` — which the root `tsconfig.json` extends — is absent on a fresh checkout. Run `bunx nuxi prepare` before `bun run test` there; CI does this explicitly in `pr-check.yml` and `deploy-cloudflare.yml`.

### Key Technologies

- **Nuxt `~4.5.2`** with Vue 3.5 Composition API
- **TypeScript** for type safety
- **daisyUI 5** for UI components (buttons, cards, badges, modals, tabs, alerts) — loaded as a Tailwind 4 plugin via `@plugin "daisyui"` in `app/assets/css/main.css`, not a Nuxt module
- **TailwindCSS `^4.3.3`** with @tailwindcss/vite for styling
- **Font Awesome 6** for all icons (exclusive - no Heroicons/Lucide)
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
- **Hydration invariant**: `/chat` is SSR'd and the server always renders the empty/welcome branch. Stored conversations live in localStorage (`useChatHistory`), so nothing may branch the template on them until after `onMounted` (see the `hasMounted` gate in `ChatWindow.vue`) — otherwise refreshing with a saved conversation causes a structural hydration mismatch that corrupts the page DOM. The rule got STRICTER at the 2026-08-31 cutover, not looser: the transcript itself is client-owned now, so more of the page depends on state the server cannot see. `useChatHistory.load()` and the conversation restore both run in `onMounted`, never during setup.

- **`/chat`'s full-height shell is CSS-only, keyed off `.chat-shell` with `:has()` in
  `app/assets/css/main.css` — never `useHead({ bodyAttrs })`.** Setting body attributes from
  that page's head made `nuxt-schema-org` throw during SSR on a cold dev server (`Cannot read
properties of undefined (reading 'webSiteResolver')` out of its resolver preload) and 500 the
  route until the module warmed up. Measured at 3 failures per cold boot with `bodyAttrs` and 0
  without, while `/` and `/technical/needles` stayed clean either way — the same
  `nuxt-schema-org` fragility as the Nuxt 4.5 pin note. Keep the shell out of the head pipeline.

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

#### Database APIs

- `/api/wheels/` - Wheel fitment database with image handling
- `/api/registry/` - User registration system with approval workflow
- `/api/colors/` - Paint color database with user contributions
- `/api/engines/` - Engine specifications and performance data
- `/api/weights/` - Vehicle weight specifications

#### AI & Chat APIs

- `/api/chat` - the AI assistant. The agent runs IN this Worker (`server/api/chat.post.ts`, Vercel AI SDK v7 + Anthropic), calls the eleven `/mcp` tools in-process via `server/utils/agentTools.ts`, and searches the site through `site-search`. It replaced a proxy to an externally hosted LangGraph deployment on 2026-08-31; `server/api/langgraph/**` no longer exists.
- `/mcp` - Model Context Protocol server. **There are no `/api/mcp/*` routes** —
  the whole surface is one JSON-RPC endpoint at `/mcp`, served by
  `@nuxtjs/mcp-toolkit`, which discovers tools from `server/mcp/tools/*.ts`
  (filename = tool name). Bearer auth via `server/middleware/mcp-auth.ts`.
  Nothing under `server/api/langgraph/**` references MCP — but do NOT read that
  as "the chat does not use these tools", which is what this note used to say.
  The externally hosted agent calls `https://www.classicminidiy.com/mcp` from
  its own side with a Bearer key, so MCP is very much in the chat's path; it is
  just not in this repo's half of it.

  That distinction matters because the agent's MCP fetch is wrapped in a bare
  try/except that falls back to an EMPTY tool list, so a bad key degrades the
  assistant to generic web search with no error anywhere. Neither sink can see
  it: `recordMcpUsage` skips the Supabase counter for the internal env-key tier
  (no `api_keys` row) and deliberately emits nothing to PostHog for it. The
  `tools_called` array on `chat_run_completed`
  (`server/utils/chatUsage.ts`) is the only signal that reports it — an empty
  array on a real question means the tool wiring is down, not that the question
  was unusual.

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

### Module resolution invariants

- **Client code reaches `shared/` through the `~~/` alias, never a relative path.**
  A relative `../../shared/utils/x` resolves in dev, in vitest and under
  `vue-tsc`, then fails the PRODUCTION build:

  ```
  [nitro] RollupError: Could not resolve "../../../../../shared/utils/chatTiers.ts"
  from ".nuxt/dist/server/_nuxt/chat-CM26o58_.js"
  ```

  What makes this worth a rule rather than a fix is WHERE it fails. Every PR gate
  was green — unit suite, typecheck, format, CodeQL, route smoke — so the PR
  merged, and the deploy then died at the Nitro bundling step. `main` carried
  code that could not be built, and because a failed deploy leaves the previous
  Worker serving traffic, **production silently stayed on the older commit**.
  Nothing was red on the site; the feature simply was not there. Two PRs shipped
  that way before anyone noticed, and the second was only found because its
  "successful" merge was followed by a check of the deploy log rather than the
  site.

  The general shape: a green PR is not evidence of a deployable `main`, because
  the only gate that runs the production bundler is the deploy itself. If a merge
  matters, look at the deploy run, not the checks.

  `tests/static/shared-import-alias.test.ts` enforces the import form
  (shrink-only, currently empty).

### Component resolution invariants

- **A nested component must be referenced by the name Nuxt registers, which
  includes its directory prefix.** `app/components/profile/ContributorImpact.vue`
  registers as **`ProfileContributorImpact`**, not `ContributorImpact`. Getting
  this wrong does not throw and does not fail the build: Vue logs
  `[Vue warn]: Failed to resolve component` to the browser console and renders
  **nothing**, so the feature reads as never-built rather than broken. Same
  silent-empty-element family as the `i-fa6-*` icon strings above.

  It bit `<ContributorImpact>` on both `/profile` and `/users/[id]`, so the
  contributor impact panel — the visible payoff of the whole trust and
  contribution pipeline — was empty space on the two pages that show it. Every
  sibling in that directory was already referenced with the prefix, which is
  exactly why it survived review.

  `tests/static/component-resolution.test.ts` enforces it. **It reads
  `.nuxt/components.d.ts`** rather than deriving names from paths, because
  deriving means reimplementing Nuxt's rules — including the duplicate-prefix
  collapse that makes `archive/ArchiveSubnav.vue` into `ArchiveSubnav` and not
  `ArchiveArchiveSubnav`. A first version that derived them reported 20
  violations of which 18 were false. Nuxt's own manifest cannot disagree with
  Nuxt. An explicit `import Foo from './Foo.vue'` still wins over auto-import
  and is accepted; `Chat/ChatWindow.vue`'s children work that way.

- **Any check that scans source for a call must blank comments first.** Three
  separate checks in this repo have been wrong because prose counted as code:
  the Worker env registry (a doc comment naming `process.env.MICROLINK_API_KEY`
  kept a dead entry alive), the BotID zone verifier (`checkout.post.ts`'s
  "Do NOT re-add checkBotId()" comment demanded a rule for a route that
  deliberately has none), and the component check above. `blankComments()` in
  `tests/static/_scan.ts` blanks in place, so line numbers survive.

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
  clamp pulls the field _off_ the grid. Same reasoning for anything else placed in a hero.

- **Never size an avatar (or any fixed chrome image) with `h-full w-full`.** A percentage
  height against an auto-height parent resolves to `auto` — the image's INTRINSIC size. If
  the parent's sizing rule is ever missing or late (scoped CSS not yet applied, style block
  dropped), a 1024px avatar renders at 1024px, overflows the header flex row, shrink-crushes
  the omnisearch field (it has `flex-shrink: 1`) and drags the account dropdown off-screen.
  `MainNav.vue` uses explicit px on the `<img>` so the worst case is a merely-unrounded
  avatar, not a wrecked header.

### Calculator invariants

- **Every technical calculator publishes its arithmetic, and the panel is fed from
  the calculator's OWN computed values.** `CalculatorsMathBreakdown`
  (`app/components/Calculators/MathBreakdown.vue`) renders an ordered list of
  `MathStep`s — symbolic formula, the same formula with the reader's live inputs
  substituted, and the result — so a reader can redo the sums by hand and land on
  the numbers on screen. The steps are built in the calculator itself
  (`Gearbox.vue`, `Compression.vue`) by reading the same `computed`s the result
  cards and tables render. **Never recompute a result inside the steps array.** A
  second implementation drifts silently from the first, and a breakdown that
  disagrees with the answer above it is worse than no breakdown at all — it makes
  the calculator look wrong when it is right, or hides a real bug.

  Corollary: when you change a formula in `app/utils/gearingCalculations.ts` or in
  `Compression.vue`'s computeds, update the matching `formula`/`substitution`
  strings in the same commit. Nothing enforces this at build time.

- **The "these equations live here" source links must point at a path that exists
  on `main`.** Both calculators previously linked to `SomethingNew71/classicminidiy`
  at `blob/dev/components/SpeedoDriveCalculator.vue#L512` and
  `blob/master/components/CompressionCalculator.vue#L344`. Both 404'd: the files
  were renamed (`SpeedoDriveCalculator` → `GearboxCalculator` → `Calculators/Gearbox.vue`)
  and the Nuxt 4 restructure moved root `components/` under `app/`, while `dev` and
  `master` no longer carry that layout. Link the FILE on `main`, never a line
  number — line anchors rot on the next edit, and the panel above already tells the
  reader which step to look for.

### Dropdown invariants

- **A "dropdown is always visible and off-screen" report is a HYDRATION bug until proven
  otherwise — do not start in the CSS.** The Supabase session lives in localStorage, so
  `useAuth().isAuthenticated` is ALWAYS false during SSR and flips true on the client after
  `initAuth()`. `MainNav` branched a `v-if`/`v-else` pair straight off it, so the server
  emitted the signed-OUT subtree while the client's first render wanted the signed-IN one.
  Vue's hydration repair merged them: the signed-out wrapper survived and the account
  `<ul class="dropdown-content">` was patched INTO it, orphaned from any `.dropdown`.
  Because every rule that places or hides a menu is scoped `.dropdown … .dropdown-content`,
  an orphan loses `position: absolute` (lays out in the header flex row, spills right) AND
  its closed-state `display: none` (never hides) — one defect, both symptoms. The adjacent
  language dropdown lost its own menu as collateral, which is the tell that this is
  structural corruption rather than styling. Fix: gate structural auth branches on a
  `hasMounted` ref (`isSignedIn`/`showAdminLink` in `MainNav.vue`), never on
  `isAuthenticated`/`isAdmin` directly — same rule as `/chat` and the passkey UI.
  `tests/unit/components/main-nav-hydration.test.ts` enforces both halves.

  **That backlog is CLEARED.** This note used to say ~19 other call sites in `app/`
  still branched structurally on ungated `isAuthenticated`/`isAdmin`. They have all
  been gated: `KNOWN_UNGATED` in `tests/static/hydration-auth-gates.test.ts` is
  empty and the check passes, and that allowlist is shrink-only, so the count
  cannot quietly grow again — a new ungated branch fails the build.

  Do not reason from the old number. It sent me hunting the wrong cause for a
  hydration mismatch that turned out to be a test-harness bug, which is exactly
  the cost of a stale invariant in this file.

- **Verify dropdown fixes in FIREFOX, not only the Chromium preview pane.** This bug was
  reported on Firefox 154 and every prior verification ran in Chromium, which is why it
  survived being "fixed" repeatedly. Hydration-mismatch repair is browser- and
  timing-dependent, so a clean Chromium check is not evidence.

- **Dropdown behaviour is global, in `app/assets/css/main.css`, not per component.** daisyUI 5's
  `.dropdown .dropdown-content` sets ONLY `position: absolute` — no `top`, no `bottom`, no size
  limit — so placement falls out of the static position and a menu taller than the window has no
  way to reach its own last item (`position-area`, which daisyUI puts on `.dropdown`, is inert on
  a `position: relative` box with no anchor-name). The global block states the default placement,
  caps every menu at `calc(100dvh - 5rem)` and lets it scroll. **Fix dropdown problems there, not
  in one component** — this was first patched in `MainNav` alone, which left the admin tables,
  `ReviewDrawer` and `LanguageSwitcher` still broken.

- **A clipping ancestor beats any z-index.** An admin row kebab sits inside `.overflow-x-auto`
  (which computes to `overflow: auto auto` — a non-`visible` axis forces the other to `auto`)
  nested in `.card` (`overflow: hidden`). Measured on the listings table: 204px of menu cut off,
  last action unclickable, and the `z-[9999]` already on it did nothing, because clipping is not
  stacking. The global rule unclips those containers only while a menu inside is open
  (`:has(.dropdown:focus-within)`).

- **EVERY rule in that block must stay unlayered — placement and sizing included.** The
  unclip rule overrides `.overflow-x-auto`, a Tailwind _utility_. But the same reasoning
  applies to all of them, because **daisyUI 5 ships the whole `.dropdown` component inside
  `@layer utilities`** (see `node_modules/daisyui/components/dropdown.css`), not `components`.
  Utilities sort after `components`, so anything we put in `@layer components` is structurally
  outranked by daisyUI's own declarations no matter how specific it is — layer order beats
  specificity, and unlayered beats every layer. The placement/size defaults _were_ in
  `@layer components`, which happened to work only because daisyUI sets no `top`/`max-height`
  on `.dropdown-content` for the default case; it was one upstream declaration away from being
  silently overridden. Directional variants (`.dropdown-top` et al) still win because the
  placement rule **excludes them by selector** (`:not(.dropdown-top, …)`) rather than relying
  on layer order — verify that when touching it, since nothing else protects them now.
  Nothing in `app/` sets `top`/`bottom`/`max-height`/`overflow` on a `.dropdown-content` via a
  Tailwind utility, so unlayering tramples nothing; re-check that before adding one.

- **`.dropdown { position: relative }` is restated unlayered, and it is load-bearing.** Every
  other rule positions the menu against `.dropdown`. If that declaration ever fails to apply,
  the menu resolves against the _initial containing block_ instead — which pins it to the
  VIEWPORT edges rather than the trigger: hard against the right edge of the window, and
  vertically wherever the static position lands. daisyUI does set it, but in `utilities`, where
  a stray utility outranks it. `[popover]` dropdowns are excluded because daisyUI deliberately
  makes those `position: fixed`.

- **Never unclip a vertical scroll container.** `.overflow-y-auto` / `.overflow-auto` are
  deliberately excluded: switching a scrolled container to `overflow: visible` resets its scroll
  offset, so the region would jump to the top the moment a menu opened inside it.
  `ReviewDrawer`'s scrolling body is exactly that shape.

- **Escape-to-dismiss lives in `app/plugins/dropdown-dismiss.client.ts`.** These menus are pure
  CSS opened on `:focus-within`, so there is no state to clear — closing one means blurring out
  of it. It acts only when focus is genuinely inside a `.dropdown`, so it never swallows an
  Escape meant for the omnisearch palette, the contribute wizard or a `<dialog class="modal">`.

- **Verifying dropdowns in a headless/background pane: assert on `:focus-within`, not on
  `display`.** daisyUI transitions `display` with `transition-behavior: allow-discrete`. When the
  pane is backgrounded (`document.visibilityState === 'hidden'`, `document.timeline.currentTime`
  stuck at 0) the animation clock never advances, so a closed menu reads as `display: flex;
opacity: 0` forever and looks like a stuck-open bug that does not exist.

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
never resolve Iconify icon _data_. That is why the `@iconify-json/*` collections could be dropped
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

### SEO / Head Invariants

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

### Image Optimization Invariants

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

### Security Invariants

Load-bearing contracts — don't "fix" these without understanding why they're this way:

- **`/api/chat` is intentionally UNAUTHENTICATED, and must never _require_ auth.**
  The assistant has to work for every anonymous visitor — that is the point of
  the surface and why it is indexed. Do NOT add `requireUserAuth` to it. When
  membership metering lands, the route resolves identity _if present_ and
  applies a tiered quota; **a 401 is never a valid response from this route**,
  and an exhausted quota is a 429 carrying an upgrade pointer, the same posture
  as the MCP free-tier gated result.

  Abuse is held by two things, and only one of them is in this repo: per-IP rate
  limiting in `server/middleware/rate-limit.ts` (default 40 req/60s, tune via
  `CHAT_RATELIMIT_MAX` / `CHAT_RATELIMIT_WINDOW_MS`; the old `LANGGRAPH_*` names
  are still read so a value configured in Cloudflare does not silently revert),
  and a Cloudflare **zone** rate-limit rule that runs at the edge before the
  Worker bills anything. **That zone rule does not follow a code change.** Moving
  or renaming this route without updating the rule leaves the live path
  unprotected while everything still looks green —
  `scripts/verify-cf-ratelimit.py` exists to fail in exactly that case, and
  `docs/runbooks/2026-08-31-chat-zone-rate-limit.md` is the fix. The privileged
  `NUXT_ANTHROPIC_API_KEY` stays server-only (private `runtimeConfig`).

- **`/api/chat`'s tier gate fails OPEN, and that is the deliberate opposite of
  `/mcp`'s.** `server/middleware/chat-auth.ts` resolves membership when a token
  is present, but every uncertainty resolves DOWNWARD to a working tier: no
  token, an unverifiable token, or Supabase being unreachable all yield
  `anonymous`, and a membership RPC error yields `free` rather than denying an
  account that is already proven. A Supabase outage therefore degrades a member
  to anonymous limits — it does not 503 the chat. Do NOT "fix" this into failing
  closed by pattern-matching on `mcp-auth` next door: for a paid API uncertainty
  must mean deny, but for a public assistant it must mean "treat as anonymous",
  because denying breaks the surface's entire reason to exist. A banned account
  is the one case that resolves to `anonymous` on purpose rather than by
  degradation.

- **`/mcp` auth fails closed.** Valid keys come ONLY from `MCP_API_KEY` / `MCP_API_KEYS` env vars — there is no hardcoded/default key. The old `dev-mcp-key-classic-mini-diy` default is in public git history and must never be re-accepted in any environment. For local dev, set `MCP_API_KEY` in `.env`.
- **`/mcp` is only truly tested by `scripts/test-mcp-transport.sh`.** The unit
  tests under `tests/unit/server/mcp/` stub `defineMcpTool` and call `.handler()`
  directly, so they exercise tool logic and nothing else — no routing, no auth
  middleware, no `@nuxtjs/mcp-toolkit`, no JSON-RPC framing, and no transport
  provider. mcp-toolkit chooses that provider at **build time** from the Nitro
  preset, so the Cloudflare path exists only in a `cloudflare_module` build and
  in no test that runs in-process; a Nuxt/Vitest e2e test would exercise the Node
  provider and prove nothing about production. That gap is how #721 shipped: every
  authenticated call 500'd for months while the whole suite stayed green. The
  transport script speaks real JSON-RPC to the built artifact under
  `wrangler dev --local` and runs as a pre-deploy gate in
  `deploy-cloudflare.yml`. **Adding a tool means adding a `tools/call` for it
  there** — a tool with only unit tests is untested against the protocol that
  actually serves it.
- **The free-tier fixture key must live on a dedicated account that will never
  hold a subscription.** `MCP_FREE_TIER_KEY` arms the `free-tier gating`
  section of that script, which is the ONLY check anywhere that can tell a
  working tier gate from one that never ran: every other assertion in the
  script authenticates with the env key, which is the `internal` tier and sees
  all eleven tools by design. A key's tier is a property of its OWNER, decided
  per request by `user_has_subscription(owner, 'developer')` — so granting that
  account a developer subscription, **an admin comp included**, makes the
  fixture developer-tier, and the section then fails on a fixture rather than a
  fault. Point the secret at an account nobody uses: never a real person's, and
  never an admin's.

  **The repair is the dangerous half, not the break.** Deleting the secret
  clears the failure and leaves every check green, because an unset key makes
  the section SKIP — the gate quietly drops from 33 assertions to 30 and
  nothing anywhere says the tier boundary stopped being covered. That is the
  full 2026-08-31 sequence: the key's owner was comped onto the developer tier
  deliberately (to give an MCP client the paid tools), the gate failed, and the
  secret was deleted to unblock deploys. So do not revoke a deliberate comp to
  satisfy this check, and do not unset the secret to silence it — re-point it
  at a subscription-free account. A healthy run logs
  `free tier gates 4 of 11 tools (chassis-decoder,color-lookup,engine-decoder,wheel-search)`
  followed by `passed 33, failed 0`; `passed 30` means it is unarmed.

- **A `/mcp` tool that caches and takes an OBJECT-valued argument must set an
  explicit `getKey`.** The toolkit's default key is
  `Object.values(args).map(String).join(':')`, so every object stringifies to
  `[object Object]` and all of them share one cache entry. `gearbox-calculator`
  is uncached for this reason: its `tire_type` is an object, and two tire sizes
  would have collided on one cached top speed.
- **`SUPABASE_SERVICE_KEY` is server-only.** It lives in private `runtimeConfig` and is read only via `server/utils/supabase.ts#getServiceClient`. Never import that into `app/` or move the key to `runtimeConfig.public`.
- **Edit-suggestion field keys are raw column names, gated by an allowlist.** `SuggestEditModal`'s `editable-fields` keys (and the matching `current-data` keys) are written verbatim into `submission_queue.data.changes` **by the browser**, and `applyEditSuggestion()` in `server/api/admin/queue/approve.post.ts` maps them straight onto the UPDATE — there is no camelCase-to-snake_case layer, so every key must be a real snake_case column on the mapped table. Because that JSON is client-controlled, `EDIT_TARGETS` in that file is the security boundary: it is what stops a crafted suggestion from rewriting `status`, `submitted_by`, `reviewed_by`, `legacy_id` or `legacy_submitted_by_email` the moment an admin approves. **Adding a field to any `SuggestEditModal` call site means adding the column name to `EDIT_TARGETS[targetType].columns` too**, or approval is refused outright. Never add ownership/moderation/audit columns or asset paths to those lists. Past instances of getting this wrong: `bodyNum`/`engineNum` (registry, fixed for supabase#65) and `offset` vs `offset_value` (wheels).

### Passkey invariants

- **`auth.experimental.passkey: true` in `app/composables/useSupabase.ts` is a hard
  requirement, not a feature toggle.** Without it every `registerPasskey()`,
  `signInWithPasskey()` and `auth.passkey.*` call THROWS instead of returning an
  error result (`assertPasskeyExperimentalEnabled` in auth-js), so removing it
  breaks the passkey UI with an exception rather than a graceful fallback.

- **The passkey authentication challenge is captcha-protected; registration is
  not.** `POST /auth/v1/passkeys/authentication/options` answers
  `400 captcha_failed` with no `captcha_token`, so `/login` must hand the
  Turnstile token to `signInWithPasskey()` and keep the button disabled until
  the widget has produced one. The token is single-use and is spent by the
  challenge request — so a ceremony the user then dismisses still burns it, and
  the widget must be reset before a retry. Registration goes the other way:
  `.../registration/options` is Bearer-gated (`401 no_authorization`) and takes
  no captcha, which is why the profile card needs no Turnstile widget.

- **Passkey sign-in never reaches `/auth/callback`.** There is no round trip and
  no code to exchange — auth-js persists the session and emits `SIGNED_IN`
  in-page. `/login` therefore owns the post-sign-in redirect itself, including
  consuming the `cmdiy-post-auth-redirect` stash that `/auth/callback` consumes
  for the OAuth and magic-link paths. Leaving that stash behind lets a later,
  unrelated sign-in replay it.

- **Never branch a template on WebAuthn support during setup.**
  `window.PublicKeyCredential` does not exist during SSR, so
  `usePasskeys().isSupported()` is false server-side and true on the client —
  rendering directly from it is the same structural hydration mismatch
  documented for `/chat`. Both `/login` and `ProfilePasskeyManager` set a
  `mounted`/`passkeyAvailable` ref in `onMounted` and branch on that.

- **A dismissed system prompt is not an error.** Supabase returns cancellation
  as an `error` (a `NotAllowedError`/`AbortError`), the same channel as a real
  failure. `usePasskeys().isCancelled()` separates the two; every caller must
  route through it, or users get an error toast every time they change their
  mind at the Touch ID sheet.

- **The Relying Party Origins list in the Supabase dashboard is what makes
  passkeys work per hostname, and a miss fails in the BROWSER, not at our
  API.** RP ID `classicminidiy.com` covers the subdomain, but the origins
  allowlist must name every origin users actually sign in from — the canonical
  host is `https://www.classicminidiy.com`, and the apex is served by the worker
  too. That config lives outside this repo; adding a new public hostname means
  adding it there too.

- **Passkeys cannot be exercised on `localhost`, and that is a property of
  WebAuthn rather than a missing setting.** An origin must BE the Relying Party
  ID or a subdomain of it, so no `localhost` origin is compatible with RP ID
  `classicminidiy.com` — the dashboard rejects it outright. Verify passkey
  changes on a deployed preview, not `bun run dev`. Everything else on `/login`
  and the profile card still works locally; only the ceremony itself cannot run,
  and reaching it would need a `*.classicminidiy.com` hostname pointed at the
  dev server over HTTPS (WebAuthn requires a secure context, and the
  localhost exemption does not apply once the hostname is not localhost).

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
  surfaced as a seller reporting his ad had _disappeared_, not that it had never
  published, because the comped confirmation screen claimed "Live Now" in all 10
  locales. Nobody caught it sooner because the paid path also never called
  `/api/exchange/listings/submit`, so no `admin_listing_pending` email ever fired.

  The promotion is deliberately narrow — it moves a listing into review and
  nothing else; completing a payment never publishes anything. Its constraints and
  the reasons for them are documented in `classicminidiy-supabase`. One
  consequence matters on this side: `pending → active` belongs to moderation
  alone, and that transition is also what credits the seller's trust score, so
  repairing a stuck listing by jumping it straight to `active` silently costs them
  that credit. Route it to `pending` and let review approve it.

- **A listing becoming publicly visible is enforced server-side, and client code
  must never try to do it.** Only moderation makes a listing `active`, via the
  admin routes below. Client-side writes that set a listing live are rejected —
  the enforcement lives in the database, so a rejection surfaces as a permission
  error rather than a validation message. `useListings().publishListing()` is a
  leftover with no callers; it is not a supported path and should not be wired to
  a "publish my draft" button.

  **The mechanism, and the reasoning behind its exact shape, are documented in
  `classicminidiy-supabase` (private) — see the `listings` notes in that repo's
  CLAUDE.md.** Deliberately not restated here; see "Public repository" below.
  What you need on this side: if you add any owner-facing action that changes a
  listing's status, exercise it against a real non-admin session before shipping,
  because the server, not the form, is what will refuse it.

- **Admin listing moderation runs through two server routes that must exist:**
  `PUT /api/admin/listings/[id]/status` and `.../tier`. They are the only path to
  `active` (service-role, so they pass the trigger above), and `useAdmin()` has
  been calling them since the TME consolidation — but they were never ported, so
  every approve/reject/relist/tier click 404'd from the cutover until 2026-08-12.
  Combined with paid listings never reaching `pending`, the paid pipeline was dead
  at both ends: nothing arrived in the queue, and nothing could leave it. The
  status route is also what emails the seller on approval — the `on_listing_approved`
  trigger only moves trust counters, so without it the "we'll email you when your
  listing is approved" promise in the submission confirmation goes unkept.

- **Every feed item's `id` must be an absolute IRI, and the feed tests must seed
  rows before asserting on Atom.** The `feed` package renders the Atom entry id as
  `sanitizeUrl(item.id ?? item.link)` — i.e. `new URL(id)` — so a bare row id
  throws `TypeError: Invalid URL` and 500s the route. `rss2()` and `json1()` treat
  the id as an opaque string and never parse it, so the exact same assembled feed
  serves 200 as RSS and JSON while every `.atom` sibling is down. That is what
  happened from the TME cutover until 2026-08-25: all seven Atom endpoints
  (`/exchange/atom.xml` plus the six `/exchange/feed/*.atom`) 500'd, and
  `theminiexchange.com/atom.xml` 301'd straight into one of them.
  `feedItemId()` in `server/utils/exchange/feedBuilder.ts` is the contract — it
  returns `urn:uuid:<row id>` (all three source tables have UUID PKs, so this is
  permanent and unique across sources) and falls back to the item permalink for
  anything that is not a UUID, so it can never produce an unparseable id.

  The RSS `<guid>` is set separately and deliberately keeps the older prefixed
  strings (`<uuid>`, `external-<uuid>`, `wanted-<uuid>`). Readers dedupe on it, so
  changing it would re-notify every subscriber with up to 50 "new" items. Don't
  collapse `guid` into `id`.

  It shipped because the one Atom test ran against an EMPTY feed — rows are reset
  in `beforeEach` and it seeded none, so there was no entry to serialise. A format
  assertion with no items proves nothing about item serialisation; seed rows first.

- **Enclosure URLs go into the feed RAW, and only if they are absolute.**
  `rss2()` and `atom1()` both push an enclosure href through `new URL()`, so the
  same unparseable-URL failure that killed the Atom routes applies to images —
  and there it takes down the RSS routes too, for every item in the feed, not
  just the offending one. `og_image_url` is browser-written (the find submit path
  inserts it through PostgREST, bypassing the rehosting in
  `parse.post.ts`) and a broken image is invisible in moderation because the admin
  thumbnail falls back on `@error`, so a relative or malformed URL can reach an
  approved row. `absoluteFeedUrl()` is the guard: non-absolute or non-http(s)
  drops that item's enclosure and keeps the feed up.

  Do NOT `escapeHtml()` a URL on its way into an enclosure. The library's
  `sanitizeUrl()` already escapes `&` and percent-encodes anything that could
  break out of an XML attribute; pre-escaping double-escapes, so `?w=1&h=2` ships
  as `&amp;amp;` and every reader resolves an image URL that 404s. escapeHtml
  still belongs on the `<img>` in the item's HTML content — that really is HTML.

## Admin Surface Invariants

Consolidated 2026-08-26. Design doc: `docs/plans/2026-08-26-admin-consolidation.md`.

- **`app/components/admin/Shell.vue` (`<AdminShell>`) is the ONLY admin chrome, and
  every `/admin/**` page must wrap in it.** Before the consolidation there were
  three navigations — a card grid on `/admin`, the exchange sidebar, and a third
  rail on `/admin/inbox` — and which one you got depended on which link you
  clicked. Adding an admin page means adding it to `NAV_GROUPS` in that file, not
  building another nav. The shell owns the container bounds, the breadcrumb, the
  ADMIN identity strip and sign-out, and the `title`/`subtitle`/`#actions`
  header, so pages render body content only.

- **There is no `app/layouts/` directory, and `definePageMeta({ layout: 'admin' })`
  never did anything.** `app.vue` renders `<NuxtPage>` with no `<NuxtLayout>`, so
  four admin pages were declaring a layout that did not exist while hand-rolling
  their own containers. Do not re-add that meta; wrap in `<AdminShell>` instead.

- **`/admin/queue` is the one submission-review surface.** `/admin/inbox` and
  `/admin/{registry,wheels,colors}/review` all read the SAME `submission_queue`
  table — the three `*/review` pages differed only by a `target_type` filter
  applied server-side in `/api/{registry,wheels,colors}/queue/list` — so they are
  301s in `nuxt.config.ts` routeRules now, carrying `?targetType=` so a reviewer
  lands on the subset the old page showed. `/admin/queue` reads that param on
  load; keep it in sync with `targetTypeFilters` if a new target type appears.
  Their backing API routes went with them (`/api/colors/queue/**`,
  `/api/registry/queue/{save,reject}`, `/api/wheels/review/**`) — an admin-gated
  approval route with no UI in front of it is still a live write path, and those
  two `save` routes wrote only `legacy_submitted_by`, which is the exact
  contributor-credit bug the Contribution Loop invariants below forbid.
  `/api/registry/queue/list` is the ONE survivor: it is read by the public
  `/archive/registry/pending` page, not by admin.

- **`/admin` is a triage board, not a launcher.** Navigation is the sidebar's job
  on every page, so the dashboard's job is the count. Marketplace charts stay on
  `/admin/exchange` — duplicating them onto `/admin` is how those two pages
  drifted apart in the first place. Every count on both pages loads independently
  and swallows its own error: a badge is decoration, and one unavailable table
  must not blank the first screen an admin sees after signing in.

- **`PUT /api/admin/listings/[id]` corrects listing CONTENT and must never touch
  review state.** It exists so a wrong price or a phone number in a description
  can be fixed on a LIVE listing without pushing it back through moderation, so
  it sets no status field and sends the seller no email — the `admin_audit_log`
  row is the record. `ADMIN_EDITABLE_COLUMNS` in that file is the security
  boundary (the `changes` object is browser-written, and the route is
  service-role so RLS is not standing behind it), in the same spirit as
  `EDIT_TARGETS` in the queue approve route. `status` and `tier` are deliberately
  excluded — they have their own routes so those transitions stay observable, and
  moderation must remain the only path to `active`. Never add ownership, payment,
  or worker-bookkeeping columns to that set.

- **`/exchange/listings/[slug]/edit` serves two writers on two paths.** RLS on
  `listings` is owner-scoped, so an admin's PostgREST update matches zero rows
  and still reports success — the admin save MUST go through the route above.
  The gate is client-only on purpose: the Supabase session is in localStorage,
  so `supabase.auth.getUser()` during SSR has nothing to read. It used to throw
  403 there unconditionally, which made a hard refresh of the page fail for the
  owner too; SSR now passes through and the client decides, matching what the
  `exchange-auth` middleware already does. Note the deliberate asymmetry in the
  change-diff: the seller path still treats a blank as "no change", the admin
  path sends an explicit null, because clearing bad data is the whole point of
  the admin edit.

### Admin viewport invariants

Audited across all 16 `/admin/**` pages at 390 / 768 / 1024 / 1280 / 1440 / 1920.
Three distinct root causes were found, and all three are invisible until the data
is long enough — an empty or short-fixture table proves nothing about them, so
measure with a realistically long display name, address and title.

- **`AdminShell` deliberately does NOT use `.container`, and its width is pinned
  to `MainNav`'s.** `.container` is `max-w-7xl` (1280px), a reading width:
  subtract the 16rem section rail and the gutters and the content column is
  ~928px, while the widest admin tables need ~1000-1100px, so `/admin/users`,
  `/admin/exchange/listings` and `.../wanted` clipped their LAST column (the
  trust-level select, the row action menu) even on a 1440px display. The shell
  uses `max-w-[1400px]` — **the same value as `MainNav`** — which leaves 1048px
  for the table. Do not widen it past the nav: at `max-w-[1600px]` the admin body
  was wider than the site header above it and the ADMIN strip started 100px LEFT
  of the site logo on a 1920px display. Below ~1280 these tables still scroll
  sideways, which is intended and is why the rail collapses to a dropdown under
  `lg`.

- **A scroll container must wrap the TABLE ONLY, never the table plus its
  pager.** `/admin/users` had the result count and pagination inside the
  `overflow-x-auto`, so on every viewport where the table overflowed the pager
  was laid out at the table's width and "Next" sat off-screen — you had to
  scroll the table sideways to page the table.

- **`truncate` inside a table cell needs an explicit `max-w-*`, or it makes the
  column WIDER.** `truncate` implies `white-space: nowrap`, and a column's
  minimum is its cell's min-content width, so an untruncatable long name set the
  User column to 430px. `min-w-0` alone does not help here — there is no flex
  parent to shrink against. Capping the cell took the users table's minimum from
  1078px to 975px, which is the difference between fitting and not at 1440.

- **A `1fr` grid track is `minmax(auto, 1fr)` and cannot shrink below its item's
  min-content width.** So one `truncate`d line inside a grid card sets the whole
  track, and the PAGE scrolls horizontally — `/admin` overflowed by 15px at
  390px for exactly this reason. Fix is `min-w-0` on the grid ITEM (or
  `minmax(0,1fr)` on the track), not on anything inside it.

- **Addresses AND display names are single unbreakable words, and they escape
  the viewport.** Both are user-supplied, and a display name is as likely to be
  one long token as an address is — that is the trap, because a fixture name with
  spaces wraps and hides the bug. In a flex row an unbreakable token sets the
  row's min-content; `flex-wrap` does NOT save you, since a single item wider
  than the row still overflows. Measured at 390px with an 87-character
  single-token name: `/admin/queue` 337px, `/admin/exchange/finds` 238px,
  `.../listings` and `.../wanted` 219px, `.../moderation` 211px of document
  scroll. Every interpolated name/address/URL needs `min-w-0` on its flex
  ancestors plus `truncate` (bounded) or `break-words`/`break-all` (unbounded).

- **Fixture data for a viewport check must contain a long UNBROKEN token.** A
  realistic-looking name with spaces passed all 16 pages; swapping it for the
  same length without spaces immediately failed five of them. Test with
  `ClassicMiniRestorationProjectSaudiArabia1959CooperSMkITwinCarbHydrolastic`,
  not `Classic Mini Restoration Project`.

- **A `modal-box` wider than the viewport is usually a SYMPTOM, not the bug.**
  `.modal` is `position: fixed; inset: 0`, so it sizes to the initial containing
  block — which grows once the document itself scrolls horizontally. Fix the
  element that overflows the page and the modals come back on their own. A CLOSED
  daisyUI modal still lays out, so it can be measured without opening it.

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

- **ONE route approves colours now, and its load-bearing decisions live in
  `server/utils/archiveApprovals.ts`.** There used to be two —
  `server/api/admin/queue/approve.post.ts` (the admin inbox, the path
  submissions actually flow through) and `server/api/colors/queue/save.ts`
  behind the older `/admin/colors/review` page, unlinked from every nav but
  reachable by URL, with `/api/colors/queue/list` spreading `...item.data` so
  the SAME submissions were approvable from it. They drifted on all four
  decisions that matter: honouring `originalColorId`, appending rather than
  replacing `contributor_images`, pinning asset URLs to this submission's own
  uploads (`isOwnUploadUrl` — `submission_queue.data` is browser-written), and
  writing `submitted_by`. The second door was deleted with the admin
  consolidation (2026-08-26). The util stays, covered directly by
  `tests/unit/server/utils/archiveApprovals.test.ts`: **a second approval
  surface imports from it, it does not copy.** Adding one and reimplementing
  any of those four decisions re-opens the duplicate-colour bug.

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

### Local development (`.env`)

```env
# AWS Credentials
dynamo_id=
dynamo_key=
s3_id=
s3_key=

# External APIs
GITHUB_API_KEY=
YOUTUBE_API_KEY=

# AI Services
NUXT_ANTHROPIC_API_KEY=

# Public URLs
NUXT_PUBLIC_SITE_URL=
s3Base=
```

`githubAPIKey` / `youtubeAPIKey` are still accepted as legacy aliases, so an
existing `.env` keeps working; new setups should use the uppercase names.

### A local `wrangler deploy` is not durable — CI owns production

`deploy-cloudflare.yml` deploys `main` on every push, and it deploys the WHOLE
worker. A local `wrangler deploy` from a feature branch therefore survives only
until the next merge to `main`, which silently reverts production to `main`'s
code with no failure anywhere.

This is worth stating because of how it fails when you are debugging. The
symptom you are chasing reappears, the fix "does not work", and grepping your
LOCAL `.output/` proves the offending code is absent — because it is absent
from your build, not from the deployed one. A local deploy was clobbered by a CI
deploy 18 minutes later during the YouTube/axios fix, and that mismatch is what
made axios look innocent when it was in fact the cause.

So: verify a worker fix with `wrangler dev --local` against the built artifact,
and land it through `main` rather than a local deploy. To check what is actually
live, compare `wrangler deployments list` against
`gh run list --workflow=deploy-cloudflare.yml` — if a CI run finished after your
deploy, production is running that run's commit, not yours. `wrangler versions
upload` uploads without taking traffic, which is the safe way to stage a build.

Corollary for diagnosis: esbuild's `__esm` guard is set BEFORE a module's body
runs, so a route chunk whose init throws once is never re-initialised. Its
namespace `default` getter stays `undefined`, and every later request on that
isolate reports `<ns>.default is not a function` instead of the original error.
That message means "this module failed to initialise", not "this module is
missing" — the real error is only visible on the first request after a cold
start.

### Build-time vs runtime secrets on Cloudflare Workers

**This split is load-bearing. Moving a value across it silently changes whether
production can see it.**

Nuxt compiles private `runtimeConfig` DEFAULTS into the JS bundle at build time.
Nitro then overrides each key at request time from the environment, so on
Workers a value can come from either place — and an absent value is an **empty
string, not an error**. That is the whole failure mode. Before this split the
runtime half did not exist: every private value came from the build env, that
env carried only a subset of the keys, and everything outside the subset
resolved to `''` in production. Chat was the visible casualty on 2026-08-26
(`LANGSMITH_API_KEY` empty, so LangGraph answered `403 Missing authentication
headers`), together with S3 model uploads, `/mcp` and the marketing unsubscribe
HMAC. The build, the deploy and the smoke test were all green. Nothing threw.
That is why the workflow now asserts the runtime half exists rather than
assuming it.

**BUILD-TIME** — must be in `.github/workflows/deploy-cloudflare.yml`'s build
`env:`, because they are compiled into the artifact and no runtime secret can
repair them afterwards:

- Every `NUXT_PUBLIC_*` value. These land in the CLIENT bundle, which the worker
  never touches.
- `POSTHOG_PUBLIC_KEY` — same, via `runtimeConfig.public`.
- `SUPABASE_SERVICE_KEY` — the sitemap sources prerender through
  `getServiceClient()`. **Also a runtime secret**; it is needed in both places.
- `GITHUB_API_KEY`, `YOUTUBE_API_KEY` — `crawlLinks` prerenders `/links` and
  `/maps`, which fetch `/api/{github,youtube}/*` during the build. Unset at
  build time bakes an empty widget into static HTML. **Also runtime secrets.**
- `NUXT_OG_IMAGE_SECRET` — **must be the SAME value in both places.**
  nuxt-og-image resolves its signing secret at BUILD time and falls back to a
  random per-build one when unset, so every `og:image` URL baked into
  prerendered HTML would carry a throwaway signature. The worker verifies with
  its own secret and answers `403 Invalid URL signature` for all of them. A
  mismatch here breaks share previews site-wide and nothing else notices.

**RUNTIME** — `wrangler secret put`, never the build env. Set them with
`./scripts/set-cf-secrets.sh` (reads your local `.env`, never prints a value):
Supabase service key, LangGraph/LangSmith, GitHub/YouTube, MCP, marketing,
`S3_MODELS_*`, and the optional Microlink/Camino keys.

**The env var name is derived, not chosen.** Nitro computes a key's override
name as `NUXT_ + snakeCase(key).toUpperCase()`
(`nitropack/dist/runtime/internal/utils.env.mjs`). Two consequences that have
already bitten:

- A key that **already starts with `NUXT_`** is not overridable under its own
  name — a `NUXT_FOO` runtimeConfig key would need `NUXT_NUXT_FOO`. Strip the
  prefix from the KEY so the derived env name comes out as the name everything
  already uses: `ANTHROPIC_API_KEY` in runtimeConfig is fed by
  `NUXT_ANTHROPIC_API_KEY`.
- camelCase keys work but hide their env name (`githubAPIKey` →
  `NUXT_GITHUB_API_KEY`). All private keys are UPPER_SNAKE so the Cloudflare
  secret name is mechanically `NUXT_<KEY>`. **Keep it that way when adding one.**

`NUXT_OG_IMAGE_SECRET` is the one exception to the whole scheme: nuxt-og-image
reads `event.context.cloudflare.env.NUXT_OG_IMAGE_SECRET` directly rather than
through `runtimeConfig`, so that name is literal and no derivation applies. It
is also the one secret whose two halves must hold the same value — see above.

**Module-scope reads are safe here, but only by accident.** With
`nodejs_compat` and a `compatibility_date` past 2025-04-01, workerd populates
`process.env` from the Worker's secrets BEFORE module evaluation — verified on
workerd, not assumed — so Nitro's module-scope `_sharedRuntimeConfig` does pick
them up and an eventless `useRuntimeConfig()` works. Prefer
`useRuntimeConfig(event)` in new code anyway: it is per-request, it costs
nothing, and it does not depend on that ordering holding.

**Raw `process.env.*` reads bypass the `NUXT_` scheme entirely.** These names
are read unprefixed at module scope and need PLAIN Worker vars — a
`NUXT_`-prefixed secret does NOT reach them. All have safe in-code defaults, so
they are tuning knobs rather than secrets; an unset value degrades to the
default rather than failing, which is exactly why a wrong one is hard to notice.

| Name                                                                       | Read in                                                                                       | Default                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| `CHAT_RATELIMIT_MAX` / `_WINDOW_MS` (and the legacy `LANGGRAPH_*` aliases) | `server/middleware/rate-limit.ts`                                                             | 40 / 60 000                |
| `WRITE_RATELIMIT_MAX` / `_WINDOW_MS`                                       | same                                                                                          | 30 / 60 000                |
| `MCP_RATELIMIT_WINDOW_MS`                                                  | same                                                                                          | 60 000                     |
| `MCP_RATELIMIT_FREE_MAX`                                                   | same                                                                                          | 20                         |
| `MCP_RATELIMIT_DEVELOPER_MAX`                                              | same                                                                                          | 240                        |
| `MCP_RATELIMIT_INTERNAL_MAX`                                               | same                                                                                          | 600                        |
| `MCP_RATELIMIT_MAX`                                                        | same                                                                                          | — legacy, see below        |
| `POSTHOG_INGEST_HOST`                                                      | `server/middleware/bot-analytics.ts`, `server/utils/mcpUsage.ts`, `server/utils/chatUsage.ts` | `https://us.i.posthog.com` |
| `MICROLINK_API_URL`                                                        | `server/utils/external-models/render.ts`                                                      | `https://api.microlink.io` |

`MCP_RATELIMIT_MAX` is not a fourth tier — it predates the tiers, when one cap
covered all `/mcp` traffic, and now survives ONLY as the fallback for
`MCP_RATELIMIT_INTERNAL_MAX`. Setting it does not raise the free or developer
tier. Reach for the per-tier name.

The per-tier knobs matter more than "has a default" suggests: without them
documented, "why is the free tier allowing 20 calls" is unanswerable from the
dashboard alone, because nothing there mentions the number.

**`MICROLINK_API_KEY` is NOT in that table, and deliberately so.** It is a
`runtimeConfig` value fed by **`NUXT_MICROLINK_API_KEY`**, forwarded into
`renderExternalPage()` by every caller. It briefly had a second
`process.env.MICROLINK_API_KEY` fallback as well, which is the trap this note
exists to close: one credential with two spellings, where the raw one could
never actually fire (callers always forward a defined string, and an unset
runtimeConfig key is `''`, not `undefined`), so a plain var set to key that call
did nothing at all and reported no error. Set the `NUXT_`-prefixed name only.

`tests/static/worker-env-contract.test.ts` is the enforcement: its
`PLAIN_WORKER_ENV_NAMES` list must match the raw reads exactly, so adding one
without documenting it fails the build, and so does leaving a dead name behind.

**`nuxt build` auto-loads `.env` from the project root.** A local build bakes
whatever is in your `.env` into `.output/`, which is why a local artifact is not
evidence about what CI produces. To reproduce the CI build, pass an explicit
build-time-only file: `bunx nuxi build --dotenv <file>`.

## Content Management

### Static Data

- JSON files in `/data/` directory for reference information
- TypeScript models for data structure validation
- Automated data processing for consistency

### Dynamic Content

- **Supabase**: User-generated content (registry, wheels, colors, submissions)
- **S3**: File storage for images and documents

## Deployment

### Cloudflare Workers

Production is Cloudflare Workers. **Vercel is retired** and `vercel.json` has been
deleted — nothing reads it. Do not restore it or reason from it.

- **Deployed by**: `.github/workflows/deploy-cloudflare.yml` on every push to `main`.
  CI owns the deploy; a local `wrangler deploy` is reverted by the next merge.
- **Install**: `bun install` (deliberately NOT `--frozen-lockfile` — see the comments
  in that workflow and `pr-check.yml`)
- **Build**: `NITRO_PRESET=cloudflare_module bun run build`
- **Pre-deploy gate**: `scripts/test-mcp-transport.sh` runs against the built artifact and
  fails closed, so a broken `/mcp` aborts the deploy rather than shipping.
- **Node version**: 24.x

What `vercel.json` used to carry, and what replaced it:

| Was in `vercel.json`            | Now                                                                      |
| ------------------------------- | ------------------------------------------------------------------------ |
| PostHog `/t/*` rewrites         | `server/routes/t/[...path].ts` + `posthogHost: '/t'` in `nuxt.config.ts` |
| `theminiexchange.com` host 301s | `server/middleware/tme-redirects.ts` + zone-edge rules                   |
| install/build commands          | `deploy-cloudflare.yml`                                                  |

### Performance Features

- **Prerendering**: Static pages cached at build time
- **Edge Functions**: API routes optimized for global distribution
- **Asset Optimization**: Compression, minification, tree shaking
- **Monitoring**: PostHog (Vercel Analytics and Speed Insights are retired)

## Testing & Quality

### The three test tiers, and what each one alone cannot see

Design doc: `docs/plans/2026-08-30-hardening-and-e2e.md`.

1. **Unit** (`tests/unit/**`, `bun run test`) — 174 files, 5,000+ assertions.
   Exercises units. It has never rendered a route, which is the gap the other
   two tiers exist to close.
2. **Static invariants** (`tests/static/**`) — filesystem-level contract checks
   that run inside the same `bun run test`, so they gate PRs at ~1.4s and no CI
   cost. i18n locale completeness, hydration-safe auth branches, the
   client↔server API contract, dynamic-route 404s, getter-form `useFetch`, and
   the plain Worker env registry.
3. **Rendered** — `scripts/smoke-routes.mjs` (every route, HTML assertions) and
   `tests/e2e/**` (Playwright, chromium + firefox).

- **Every allowlist in tiers 2 and 3 is SHRINK-ONLY, and that is the whole
  point.** Each check is seeded with today's known violations so it is green on
  day one. A NEW violation fails — and an allowlist entry that stops
  reproducing ALSO fails. So a fix cannot merge without deleting its own entry,
  and the allowlists stay a live inventory of remaining debt instead of a place
  things go to be forgotten. `KNOWN_UNGATED`, `KNOWN_MISSING_LOCALES`,
  `KNOWN_MISSING_ROUTES`, `KNOWN_SOFT_404_PAGES`, `KNOWN_GETTER_FORM_USEFETCH`,
  `KNOWN_ERRORS`. Never add an entry to make a check pass — the entry is a
  promise to come back.

- **`hydration-auth-gates.test.ts` walks the real template AST, not a regex.**
  It must understand nesting: a branch inside `<ClientOnly>`, or inside a
  subtree already gated by a `hasMounted`-derived name, is safe. A regex version
  reported `MainNav` as broken, because its `v-if="userProfile?.avatar_url"`
  sits inside `v-if="isSignedIn"`.

- **Route-crawler manifest: static routes are DERIVED from `app/pages/**`,
  dynamic ones are sampled from `/api/__sitemap__/*`.** Nothing is hand-listed
  that a filename or the live site can supply, so the manifest cannot rot. Only
  expectation overrides and the redirect/404 sets are written by hand.
  Consequence worth knowing: if a sitemap source endpoint breaks, the crawler
  reports it — and the sitemap is broken too.

- **Strip HTML comments before any crawler content check.** SSR ships template
  comments, and `/chat` documents the historical nuxt-schema-org failure in a
  comment that quotes the error string verbatim. Without stripping, the crawler
  reports the documentation as the defect.

### E2E is a separate runner, on purpose

- **Playwright has its own `playwright.config.ts`; do NOT fold it into
  `vitest.config.ts` or reach for `@nuxt/test-utils`.** The unit config maps
  `~` to the REPO ROOT (real Nuxt maps it to `app/`), sets
  `fileParallelism: false`, rewrites `import.meta.client` at transform time, and
  loads a setup file that stubs `fetch` to **reject**. Every one of those is
  correct for unit tests and fatal for a browser suite. `tests/e2e/**` is
  excluded from vitest discovery for the same reason — its specs import
  `@playwright/test`, which has no vitest runtime.

- **The Firefox project is not redundant coverage.** Hydration-mismatch repair
  is browser- and timing-dependent, and the nav dropdown bug reproduced ONLY in
  Firefox while every Chromium verification passed. Keep both projects.

- **Never use `waitForLoadState('networkidle')` in these specs — use
  `gotoHydrated` from `tests/e2e/_helpers.ts`.** `/login` mounts a Turnstile
  widget that holds a connection open, so the network never idles and the wait
  burns its full timeout on a page that hydrated in 118 ms. The helper waits for
  `__vue_app__` on `#__nuxt`, which Vue sets when `app.mount()` completes —
  exactly when hydration has finished and any mismatch warning has already been
  logged. Switching took the suite from 1.8 min with 6 failures to 22 s with 0.

- **The dev server needs `NODE_OPTIONS=--max-old-space-size=8192` for a full E2E
  run.** At the default heap its SSR worker dies partway through with `Worker
terminated due to reaching memory limit: JS heap out of memory`, after which
  EVERY route 500s and the remaining failures are noise unrelated to the code
  under test. Set in `playwright.config.ts` and both workflows. Same class of
  limit the production build already carries.

- **`/mcp` stays out of E2E scope.** mcp-toolkit picks its transport provider at
  BUILD time from the Nitro preset, so a dev-server run exercises the Node
  provider and proves nothing about the deployed Cloudflare one.
  `scripts/test-mcp-transport.sh` is the only gate that can.

### Runtime traps this pass surfaced

- **A dependency that reads `global.*` at MODULE SCOPE breaks the whole route on
  Workers.** `vuedraggable@4.1.0` runs `var console = getConsole()` at module
  scope, falling back to `global.console` when `window` is undefined; workerd's
  webpack `global` shim resolves to `undefined`, so EVALUATING it in an SSR'd
  route chunk throws `Cannot read properties of undefined (reading 'console')`
  and 500s that route. It is present in the built artifact as
  `function r(){return w.console}` inside `chunks/_/vuedraggable.umd.min.mjs`.
  **Dev is unaffected**, which is exactly why it went unnoticed — only the
  production route crawl found it. Import such a library behind a dynamic
  `import()` AND render it inside `<ClientOnly>` (see
  `app/pages/admin/marketing.vue`), and verify on a real Worker
  (`wrangler dev .output/server/index.mjs --local`), never in dev.

  **What decides whether it fires is EVALUATION, not import style.** For a while
  `PhotoUploadSection.vue` imported vuedraggable statically and
  `/exchange/listings/new` was fine — because that component sits on a later
  wizard step and its chunk was never evaluated during SSR. That was a property
  of the step layout, not a guarantee: rendering it on step 1, or a bundler
  hoisting it into the page chunk, would have 500'd the PAID listing flow. Both
  call sites are now async + `<ClientOnly>`. Do not read "it works today" as "a
  static import is safe" — verify on a real Worker.

- **Nitro registers EVERY file under `server/api/` and `server/routes/` as a
  route.** Its scan glob is `**/*.{js,mjs,cjs,ts,...}` with no underscore
  exclusion, so a helper module parked in the route tree becomes a publicly
  reachable route with no handler behind it. Shared helpers belong in
  `server/utils/`. `tests/static/api-contract.test.ts` enforces this.

### Intentional dependency pins (do not blindly bump)

- **`nuxt` is on `~4.5.2`. The 4.4.8 hold is LIFTED — do not reinstate it.** It was held
  because Nuxt 4.5's head-pipeline change broke `nuxt-schema-org` (via `@nuxtjs/seo`): every
  SSR request threw `unhandledRejection ... reading 'resolveGraph'/'push'` and ALL schema.org
  JSON-LD rendered as an EMPTY `<script type="application/ld+json">`, silently killing the GEO
  structured-data work (upstream: https://github.com/harlan-zw/nuxt-seo/issues/588). That no
  longer reproduces on nuxt 4.5.2 with the current `@nuxtjs/seo`: a built page carries a full
  `@graph`, and `/chat` renders two non-empty blocks. **If you touch the nuxt or `@nuxtjs/seo`
  version, re-verify JSON-LD is non-empty on a BUILT page** — that check is the whole reason
  this note exists, and an empty `ld+json` is silent.

  The other 4.5 breakages are fixed in-tree, not worked around: rolldown-vite requires
  function-form `manualChunks` + `cssMinify: 'esbuild'` (lightningcss chokes on daisyUI
  `round(to-zero, ...)`), highcharts-vue's UMD default import needs the install-unwrap in
  `app/plugins/highcharts.ts`, and `await useFetch(() => '/url')` — the getter form — stops
  blocking async setup, so SSR renders the pending branch and hydration hangs. Both call
  sites are converted: `Needles.vue` to a plain string (its URL was static), and
  `ModelComments.vue` to a **computed ref**, which it needs rather than a string because
  `/models/[slug]` reuses that component across model navigations, so `props.modelId`
  changes in place. `useFetch` wraps its request in `computed(() => toValue(request))`, so a
  computed ref keeps the reactivity a getter gave. **Do not reintroduce the getter form.**

  This note previously claimed "both call sites are converted". That was wrong — a repo
  sweep found **three** more (`app/pages/models/[slug].vue`, `models/external/[slug].vue`,
  `app/components/NeedleTable.vue`), all since converted. Note also that those three were
  NOT visibly broken: their 404s fired and their pages rendered. The form is forbidden
  because the breakage is version- and context-dependent and gives no error to search for,
  not because every instance misbehaves today. `tests/static/ssr-contracts.test.ts` now
  enforces the rule so the count cannot drift again.

- **`dompurify` is pinned to an exact version (currently `3.4.14`), and
  `tests/unit/exchange/utils/markdown.test.ts` MUST stay on `@vitest-environment jsdom`.**
  These two facts are one contract — don't change either in isolation. Since 3.4.8
  DOMPurify walks the DOM with a node iterator that happy-dom mis-implements, and the
  failure is silent-unsafe rather than noisy: under happy-dom, `sanitize()` returns
  markup with a live `javascript:` href intact, drops allowlisted tags, and never fires
  the `afterSanitizeAttributes` link-hardening hook. Under happy-dom the XSS suite is
  therefore asserting nothing. jsdom reproduces real-browser output byte-for-byte
  (verified against Chrome on 3.4.12 — the 3.4.14 bump was checked against the 61-test
  XSS suite on jsdom, not re-compared against Chrome), so that file — and any future test
  that exercises DOMPurify — runs on jsdom while the rest of the suite keeps the happy-dom
  default from `vitest.config.ts`. happy-dom 20.11.12 is still affected; recheck before
  "simplifying" the env back. The exact pin (no `^`) is deliberate: a DOMPurify bump is a security
  change and should be a visible, tested commit, not a silent range resolution.
- **`@takumi-rs/core` AND `@takumi-rs/wasm` stay on 1.x, at the same version.** 2.x breaks
  branded OG image rendering. They are a pair: `core` is the native binding used by the Node
  and Vercel builds, `wasm` is the one the **Cloudflare Workers** preset needs, because a
  native module cannot be bundled into a worker. `wasm` was missing entirely until 2026-08-26
  — declared nowhere, installed nowhere — so `NITRO_PRESET=cloudflare_module` died at the
  Nitro bundling step with `Cannot resolve "@takumi-rs/wasm/no-bundler" ... and externals are
not allowed!`. It surfaced only when CI first got far enough to reach bundling; before that
  the build failed earlier, on the sitemap sources. Keep both on the same version — bumping
  one alone is untested.
- **`@types/node` stays on 25.x** while `engines.node` is `^24` (26.x types target Node 26 APIs).

### Code Quality

- **TypeScript**: Compile-time type checking
- **Prettier**: Consistent code formatting
- **Build Validation**: Production build testing required

### Performance

- **Lighthouse**: Regular performance auditing
- **Core Web Vitals**: Monitoring via PostHog
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

- **Analytics Integration**: PostHog
- **Core Web Vitals**: Real-time performance monitoring
- **Error Tracking**: Comprehensive error logging and monitoring

## Notable Technical Achievements

1. **Comprehensive Classic Mini Database**: One of the most complete digital archives for Classic Mini information worldwide
2. **Advanced AI Integration**: LangGraph-powered chat, plus a separate MCP server exposing the calculators to external AI clients
3. **Multi-language Support**: Full internationalization across 10 languages with browser detection
4. **User-Generated Content System**: Advanced submission and administrative review workflows
5. **Performance Excellence**: Extensive optimization strategies including PWA, CDN, and caching
6. **Real-time Features**: Streaming AI responses and live data synchronization

## Recent Updates & Changes

### Current Version: 10.0.0

**Major Framework Upgrades:**

- **Nuxt 4**: Upgraded from Nuxt 3; now on `~4.5.2` (the 4.4.8 hold is lifted)
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
- `nuxt`: `~4.5.2`
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
