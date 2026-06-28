# GitHub Copilot instructions — Classic Mini DIY

Repo-wide custom instructions for Copilot code review and Copilot Chat. Classic Mini DIY
(CMDIY, classicminidiy.com) is a Nuxt 4 knowledgebase + toolkit for Classic Mini Coopers
(1959–2000), now also hosting **The Mini Exchange** marketplace under `/exchange`.

When reviewing, prioritize the **load-bearing contracts** below — these are the things that
silently break the build, the design system, security, or SEO if violated.

## Tech stack (assume these; flag deviations)

- **Nuxt 4** + Vue 3 **`<script setup>`** + TypeScript (strict). Source lives under `app/`
  (srcDir). Node 24+.
- **Bun** is the package manager. Don't suggest `npm`/`yarn`/`pnpm`.
- **Tailwind CSS v4** via `@tailwindcss/vite` (not `@nuxtjs/tailwindcss`).
- **daisyUI 5** is the component library — **NOT Nuxt UI**. (Any older "Nuxt UI" reference is
  stale; there are no `U*` components.) Use daisyUI classes (`btn`, `card`, `bg-base-200`,
  `text-base-content`, `tabs`, etc.).
- **Font Awesome 6 is the ONLY icon library.** Inline: `<i class="fas fa-…"></i>` (or `far`,
  `fab`, `fad`). FA is loaded via a Kit CDN script, not an npm package. **Do not introduce
  Heroicons or Lucide into app code** — flag any `i-heroicons-*` / `i-lucide-*` / `<Icon>` in
  `app/` as a regression (the `@iconify-json/heroicons` dep exists only as a porting aid).
- Tests: **Vitest** + `@vue/test-utils` + `happy-dom` (`bun run test`).
- Backend: **Supabase** (shared across CMDIY properties); plus AWS S3/DynamoDB and LangGraph.

## Build-breakers to catch in review

- **Duplicate top-level identifiers in an SFC `<script setup>`** (a `const`/`function` name
  declared twice) — this fails the Babel macro parse and 500s the whole app. SFC syntax can
  look fine; check for collisions (e.g. a destructured composable name shadowing a local).
- **HTML inside i18n message values** — `unplugin-vue-i18n` hard-fails the build on tags like
  `<strong>` in a message string. Keep markup in the template wrapping `{{ t() }}`.
- **Invalid JSON in an `<i18n lang="json">` block** — parsed at build time.
- A literal `*/` inside a JSDoc block comment (closes the comment early → build break).

## i18n contract

- Translations live in **per-component `<i18n lang="json">` SFC blocks**, each carrying **all
  10 locales**: `en, es, fr, de, it, pt, ru, ja, zh, ko`. There are **no** global
  `i18n/locales/*.json` files.
- A new translatable surface must add `const { t } = useI18n()`, use `t('key')`, and ship an
  `<i18n>` block with all 10 locales. Flag any missing locale (causes raw-key leakage) and any
  user-facing English string not wrapped in `t()`.
- Use `tm()` + `rt()` for repeated lists. Use named params: `t('x', { count })` ↔ `"{count} …"`.
- **English-only (no `<i18n>` block):** `/legal/*`, `/about`, and `/admin/*` (incl.
  `/admin/exchange/*`) — intentional.

## Security invariants (do not "fix" these)

- **`/api/langgraph/**` is intentionally UNAUTHENTICATED** (public AI chat). Do not add
  `requireUserAuth`/login. Abuse is handled by per-IP rate limiting in
  `server/middleware/rate-limit.ts`.
- **`/mcp` auth fails closed** — valid keys come only from `MCP_API_KEY`/`MCP_API_KEYS`. Never
  re-introduce a hardcoded/default key.
- **`SUPABASE_SERVICE_KEY` is server-only** — read only via `server/utils/supabase.ts#getServiceClient`.
  Never import it into `app/` or move it to `runtimeConfig.public`. Flag any service-role usage
  in client code.
- Supabase **session is in localStorage, not a cookie**: any `/api/*` route needing the user
  must receive an explicit `Authorization: Bearer <token>`; direct `useSupabase()` PostgREST/RPC
  calls are auto-authed.
- Flag any secret/token committed to the repo or placed in `runtimeConfig.public`.

## Supabase / data

- **Never add a database migration to this repo.** All schema/migrations/edge functions live in
  `classicminidiy-supabase`. This repo only regenerates types (`bun run gen:types` →
  `types/database.ts`); import `Database` from `~~/types/database` (note `~~`, not `~`).
- RLS is the security boundary — prefer RLS-respecting `getUserClient`/PostgREST over the
  service role unless bypass is justified.

## The Mini Exchange (`/exchange`) consolidation

The marketplace is merged in behind a single flag and is invisible until cutover.

- **Flag:** `runtimeConfig.public.exchangeEnabled` (`NUXT_PUBLIC_EXCHANGE_ENABLED`). The route
  gates live in `app/middleware/exchange-flag.global.ts` (404s marketplace routes when off) and
  `app/middleware/exchange-onboarding.global.ts` (logged-in users must finish onboarding to
  enter). Both key off the shared `app/utils/exchangeRoutes.ts#EXCHANGE_PREFIXES` — keep flag
  scope and onboarding scope in sync via that list; flag new marketplace surfaces that bypass it.
- **Components** moved under `app/components/exchange/**` get the `Exchange` auto-import prefix
  (e.g. `<ExchangeListingsListingCard>`). Server utils/routes are namespaced under
  `server/{utils,api,routes}/exchange/**`.
- **Payments** are thin web proxies → **Supabase edge functions** (listing checkout/verify/webhook).
  The web never calls Stripe directly. Don't conflate the one-time **listing** Stripe product with
  the recurring **membership** Stripe product (separate products/webhooks/tables).
- **Email is AWS SES** — transactional email enqueues to the `notification_queue` table and is
  sent by the `process-notifications` edge function (SES v2). The web app only enqueues; it does
  not send email directly. **Do not suggest Resend** (unused) or self-hosted Ghost.
- **Feeds/sitemap** for the marketplace are flag-gated (`server/routes/exchange/feed/*`,
  `server/api/__sitemap__/exchange.ts`).

## Conventions

- **Conventional Commits**, domain-y scopes: `feat(exchange): …`, `fix(needles): …`,
  `chore(deps): …`. No trailing period on the subject; em-dash (`—`) for clauses.
- Match surrounding code style — comment density, naming, and idiom.
- Prefer small, single-purpose PRs into `dev` (the preview/integration branch); `dev` merges to
  `main` for production.

## Review focus, in priority order

1. Build-breakers (duplicate identifiers, HTML-in-i18n, invalid i18n JSON).
2. Security-invariant violations (service key, langgraph auth, MCP keys, committed secrets).
3. Design-system drift (Heroicons/Lucide in app code, Nuxt UI components, non-daisyUI patterns).
4. i18n completeness (all 10 locales, no untranslated user-facing strings) on non-exempt pages.
5. A migration added to this repo; service-role used client-side.
6. Correctness, edge cases, error handling, and missing flag-gating on marketplace surfaces.
