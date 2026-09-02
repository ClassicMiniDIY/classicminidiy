# CLAUDE.md

Guidance for Claude Code in the Classic Mini DIY repo. This file is deliberately short:
it holds the rules that apply to EVERY session. Area-specific contracts live in
`.claude/rules/*.md` and load only when you touch matching files; the reasoning and
incident history behind each rule is archived in `docs/invariants/*.md`.
`tests/static/claude-md-budget.test.ts` caps this file's size and checks that every
rule glob still matches real files. Put a new invariant in the narrowest place that
will still reach the person who needs it; put the story in `docs/invariants/`.

## Public repository: everything here is world-readable

`ClassicMiniDIY/classicminidiy` is PUBLIC (GPL-3.0). Every file, comment, commit
message and PR body is published permanently. `classicminidiy-supabase` is PRIVATE and
is where anything that must not be public belongs. Documentation uniquely exposes three
things the code does not, so use judgement on: (1) private-repo internals such as RLS
policy bodies and migration contents; reference the contract and point at the private
repo for the mechanism; (2) attack narratives, i.e. an ordered bypass or a ready-made
exploit call; document the rule to uphold, not the route around it, and fix a real
weakness in code rather than describing it; (3) operational state: what is unfixed,
infra config outside this repo (WAF rules, env values, dashboard settings), abuse
thresholds, and incident specifics naming real users. Never commit real user data, not
even in fixtures. Scrubbing after the fact is partial; history and forks keep it.

## Ecosystem

Part of the CMDIY property ecosystem (see `/Users/colegentry/Development/CLAUDE.md`).
Related repos: `classicminidiy-supabase` (shared PostgreSQL, Auth, Edge Functions, RLS;
ALL schema changes go there, this repo only regenerates `types/database.ts`) and
`Native CMDIY Apps` (iOS Swift, Android Kotlin). `TheMiniExchange` is RETIRED: the
marketplace lives here at `/exchange` (cutover 2026-07-13) and `theminiexchange.com`
301s here via `server/middleware/tme-redirects.ts`; make no changes in that repo and
never remove those redirects.

## Stack

- **Nuxt `~4.5.2`** (Vue 3.5, `<script setup>`, TypeScript strict), Node 24+, **Bun**.
- **daisyUI 5** as a Tailwind 4 plugin (`@plugin "daisyui"` in `app/assets/css/main.css`).
  `@nuxt/ui` is NOT installed; `<U*>` components do not exist. `@nuxt/ui` and `@nuxt/icon`
  on disk are transitive deps of the SEO devtools layer and prove nothing.
- **TailwindCSS 4** via `@tailwindcss/vite`.
- **Font Awesome 6 ONLY**, via the FA Kit CDN script in `nuxt.config.ts`. Always the class
  form: `<i class="fas fa-house">`, `far`, `fab`. The Iconify `i-fa6-*` string renders an
  EMPTY element (no `fa-` token for the Kit to swap) and only ever worked as a Nuxt UI
  prop; any you find is a leftover, including in `toast.add({ icon })`. Two deliberate
  exceptions that parse the string and emit an FA class: `app/pages/models/index.vue`
  (category icons are stored in Iconify form) and `Breadcrumb.vue` (sentinel). Never add
  Heroicons, Lucide or an Iconify collection. Long form: `docs/invariants/icons.md`.
- Search: Fuse.js. Charts: Highcharts (UMD unwrap in `app/plugins/highcharts.ts`). PWA:
  `@vite-pwa/nuxt`. SEO: `@nuxtjs/seo`. Analytics: PostHog (`useAnalytics()` helpers,
  typed events in `types/analytics.ts`).
- Data: Supabase is primary; DynamoDB holds legacy archive data; S3 holds assets.
  Payments: Stripe one-time listing upgrades (`listing_promotions`), Stripe Billing
  membership (`subscriptions`), Stripe Connect model sales; three distinct products.
- AI: `/api/chat` runs the agent IN this Worker (Vercel AI SDK v7 + Anthropic) and calls
  the eleven `/mcp` tools in-process. `/mcp` is one JSON-RPC endpoint served by
  `@nuxtjs/mcp-toolkit` from `server/mcp/tools/*.ts` (filename = tool name), Bearer auth
  in `server/middleware/mcp-auth.ts`. There are no `/api/mcp/*` or `server/api/langgraph`
  routes any more.
- Hosting: **Cloudflare Workers**, deployed by `.github/workflows/deploy-cloudflare.yml`
  on every push to `main` (`NITRO_PRESET=cloudflare_module bun run build`, then
  `scripts/test-mcp-transport.sh` as a fail-closed gate). Vercel is retired and
  `vercel.json` is deleted; do not reason from it.

## Commands

```bash
bun install            # no postinstall: run `bunx nuxi prepare` before tests on a fresh checkout
bun run dev
bun run build
bun run test           # vitest: unit + static invariants (~1.4s for static)
bunx prettier --write <paths>   # NEVER `bun run format` on a feature branch: it rewrites the whole repo
bun run gen:types      # regenerate types/database.ts from the Supabase project
```

`.env` keys: `dynamo_id`, `dynamo_key`, `s3_id`, `s3_key`, `GITHUB_API_KEY`, `YOUTUBE_API_KEY`,
`NUXT_ANTHROPIC_API_KEY`, `SHOPIFY_STOREFRONT_TOKEN` (STOREFRONT only), `SHOPIFY_STORE_DOMAIN`,
`NUXT_PUBLIC_SITE_URL`, `s3Base`, `MCP_API_KEY` (no default key exists).
A `.claude/worktrees/` checkout needs `.env` copied in or SSR fails on `supabaseUrl`.

## Layout

`app/` (components, pages, composables, middleware, plugins; there is NO `app/layouts/`),
`server/` (api, routes, middleware, mcp, utils; every file under `server/api` and
`server/routes` becomes a route, so helpers go in `server/utils/`), `shared/` (reached
from client code via `~~/` only), `data/` (static JSON + `data/models/` types),
`tests/{unit,static,e2e}`, `scripts/`, `docs/{plans,runbooks,invariants}`.

Surfaces: technical toolbox (`/technical/*` calculators and decoders), archive
(`/archive/*` manuals, wiring, registry, wheels, colours, engines, weights), marketplace
(`/exchange`), 3D model library (`/models`), AI chat (`/chat`), admin (`/admin/**`),
membership (`/membership`), contribution wizard (`/contribute/*`), dashboard
(`/dashboard`). Ten locales via per-component `<i18n lang="json">` blocks.

## Rules that apply everywhere

- **Never shadow an auto-import.** A local `const ref = …` anywhere in a `<script setup>`
  strips `import { ref }` for the whole file and the component never mounts, with no
  build error. `python3 scripts/find-shadowed-autoimports.py` sweeps for it.
- **Never branch a template structurally on state the server cannot see.** The Supabase
  session lives in localStorage, so `isAuthenticated`/`isAdmin`, localStorage reads
  (`useChatHistory`, `useRecentTools`) and `window.*` feature checks are all false during
  SSR. Gate on a `hasMounted` ref set in `onMounted`, or wrap in `<ClientOnly>`.
  Hydration-mismatch repair corrupts the DOM silently (the `/chat` transcript, the nav
  dropdown) and reproduces in Firefox when Chromium looks fine. `tests/static/hydration-auth-gates.test.ts`
  enforces auth branches; its allowlist is empty and shrink-only.
- **Reference nested components by their registered name**, directory prefix included
  (`profile/ContributorImpact.vue` is `<ProfileContributorImpact>`); a wrong name renders
  nothing. Client code imports `shared/` via `~~/`, never relative; a relative path fails
  only in the production bundle. Never the getter form `useFetch(() => url)`.
- **Every allowlist in `tests/static` and the route crawler is shrink-only.** Never add an
  entry to make a check pass; an entry is a promise to come back.
- **A green PR is not a deployable `main`.** No PR gate runs the production bundler and a
  failed deploy leaves the previous Worker serving with nothing red. After a merge that
  matters, read the `deploy-cloudflare.yml` run, not the checks. A local `wrangler deploy`
  is reverted by the next merge.
- **i18n:** `const { t } = useI18n()` (auto-imported), keys in an `<i18n lang="json">`
  block with ALL ten locales (`en, es, fr, de, it, pt, ru, ja, zh, ko`), no HTML inside
  message values (hard build failure), named params for dynamic text. There are no
  `i18n/locales/*.json` files. `/legal/*`, `/about` and `/admin/models` are English-only
  on purpose. Long form: `docs/invariants/i18n.md`.
- **Chat and MCP are public surfaces with opposite failure postures**: `/api/chat` is
  unauthenticated and its tier gate fails open; `/mcp` fails closed. Never add
  `requireUserAuth` to chat, never re-accept the old default MCP key.
- **`SUPABASE_SERVICE_KEY`** is read only through `server/utils/supabase.ts#getServiceClient`;
  never in `app/`, never public runtimeConfig.
- **Images:** `image.domains` is matched on the literal hostname and a miss is a silent
  unoptimized pass-through; `<NuxtImg>` needs an explicit `format="webp"`; `/_ipx` stays
  in `nitro.prerender.ignore`; never set `image.provider` outside the Cloudflare gate.
- **SEO:** never pass a possibly-empty string to `ogImage`; every dynamic route 404s on a
  miss; browse pages with query params use `useFacetedSeo()`; redirect matchers anchor at
  a segment boundary via `pathInPrefixes()`, never `path.includes()`.
- **Reference data:** the imperial column is the source and metric is derived; every
  torque row is lb-ft; `thou` holds inches; weights are kilograms; units come from
  `data/models/units.ts`, never restated.
- **Marketplace:** a paid listing is born `draft`; only the payment path promotes it to
  `pending`; only moderation (the admin status route) makes it `active`. Feed item ids
  are absolute IRIs.
- **Contributions:** every human-reviewed approval must write `submitted_by` and feed
  trust; colour approvals honour `originalColorId`; `server/utils/archiveApprovals.ts` is
  imported, never copied. Public profile reads use the `public_profiles` view.
- **Admin:** every `/admin/**` page wraps in `<AdminShell>`; `/admin/queue` is the one
  review surface; edit allowlists (`EDIT_TARGETS`, `ADMIN_EDITABLE_COLUMNS`) are security
  boundaries and never gain ownership, moderation or payment columns.
- **CLAUDE.md culture:** when you find a non-obvious invariant, write the rule into the
  matching `.claude/rules/*.md` (or here if it is universal) and the story into
  `docs/invariants/`. Do not bury it in a code comment.

## Area rules (path-scoped, in `.claude/rules/`)

| File                  | Loads for                                     | Covers                                                                        |
| --------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `vue-resolution.md`   | `app/**`, `shared/**`                         | auto-imports, `~~/`, component names, `useFetch` form                         |
| `layout-dropdowns.md` | `main.css`, nav, hero, admin components       | hero alignment, dropdown CSS layering, hydration gate                         |
| `calculators.md`      | `Calculators/**`, `/technical`                | math breakdown fed from own computeds                                         |
| `images-seo.md`       | `nuxt.config.ts`, `app/pages/**`              | image allowlist, ipx, ogImage, 404s, faceted SEO                              |
| `security.md`         | chat, mcp, middleware, queue approve          | fail-open vs fail-closed, storefront token, tier fixture key, edit allowlists |
| `passkeys.md`         | `usePasskeys`, `/login`, profile passkey card | experimental flag, captcha, redirect stash, cancellation                      |
| `reference-data.md`   | torque/clearance/weights data + consumers     | unit contracts                                                                |
| `marketplace.md`      | `/exchange` pages, api, feeds                 | draft→pending→active, feeds, TME redirects                                    |
| `admin.md`            | `/admin/**`, `server/api/admin/**`            | AdminShell, queue, viewport rules                                             |
| `contributions.md`    | contribute wizard, queue approve, search      | trust, `submitted_by`, colour merge, omnisearch                               |
| `cloudflare-env.md`   | workflows, wrangler, rate-limit               | build-time vs runtime secrets, env naming, CI owns deploy                     |
| `testing.md`          | `tests/**`, configs, `package.json`           | tiers, shrink-only lists, Playwright, pins                                    |
| `models-3d.md`        | `/models`, `server/api/models`                | Bearer, edge-fn proxies, Connect, entitlement                                 |

Design docs in `docs/plans/`, runbooks in `docs/runbooks/`. Membership contract:
`classicminidiy-supabase/docs/plans/2026-06-07-membership-entitlement-contract.md`.
