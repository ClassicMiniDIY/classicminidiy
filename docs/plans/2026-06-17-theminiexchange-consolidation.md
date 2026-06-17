# The Mini Exchange → Classic Mini DIY Consolidation

**Status:** In progress (branch `tme-merge`, started 2026-06-17)
**Cascade:** Web + Supabase — tracked on [CMDIY Platform #9](https://github.com/orgs/ClassicMiniDIY/projects/9)
**Cutover switch:** `NUXT_PUBLIC_EXCHANGE_ENABLED` (off until go-live)

## Why

The Mini Exchange (TME) is a standalone Nuxt 4 marketplace (`theminiexchange.com`) for Classic Mini
classifieds — listings, messaging, wanted ads, external "finds", Stripe-paid promotions, social
auto-posting, newsletter, feeds. Maintaining it as a separate property doubles the surface area (auth,
deploy, design system, SEO) for one small team, even though it already shares CMDIY's Supabase backend.

This consolidation retires the standalone site and re-homes the entire feature set as an `/exchange`
**section** inside CMDIY, under CMDIY's design system, with 301 redirects for every old deep link,
**zero functionality loss**, and a **single clean cutover switch**. All work happens on one long-lived
branch (`tme-merge`) merged to `main` once at cutover behind the feature flag.

## Key discovery (de-risks the effort)

The repo CLAUDE.md claims CMDIY uses "Nuxt UI." **That is stale.** Verified from `package.json` +
`app/assets/css/main.css`: CMDIY runs **Tailwind v4 + daisyUI 5** (themes `cmdiy` / `cmdiy-dark`) — the
*same* stack as TME (themes `theminiexchange` / `theminiexchange-dark`). There is **no Nuxt UI anywhere**
(0 `U*` components; 1000+ daisyUI class usages). TME's daisyUI components drop in and auto-adopt CMDIY's
brand colors via semantic tokens (`btn-primary`, `bg-base-200`, `text-base-content`) once they render
under CMDIY's color-mode system. No large UI rewrite is required — the UI work is icon conversion
(TME's `@nuxt/icon` Heroicons/Lucide → CMDIY's Font Awesome 6 `i-fa6-*` / `fas fa-*`).

## Locked decisions

1. **Section prefix `/exchange`** — "The Mini Exchange" survives as the section label/title.
2. **Full 10-locale i18n during the move** — every migrated surface ships `<i18n lang="json">` with all
   10 locales (`en es fr de it pt ru ja zh ko`); no HTML in message values. `/admin/exchange/*` and
   `/legal/marketplace-terms` stay English-only (consistent with CMDIY's existing English-only admin/legal).
3. **Converge backend to CMDIY patterns** (not lift-and-shift):
   - Email → `notification_queue` + `process-notifications` edge function (app only enqueues).
   - Stripe listing-promotions → thin web proxy → new Supabase edge function (mirrors `create-model-checkout`);
     the Stripe secret leaves the web app entirely (eliminating env collision with membership/model Stripe).
   - Scraping (Finds) → CMDIY's lighter OG/JSON-LD + Microlink render + SSRF approach; drop Puppeteer.

## Target architecture

### Routes (TME → CMDIY), all public surfaces under `app/pages/exchange/`

| TME | New |
|---|---|
| `/` (TME home) | `/exchange` |
| `/listings`, `/listings/[slug]`, `/listings/[slug]/edit`, `/listings/new`, `/listings/bulk` | `/exchange/listings/*` |
| `/listings/payment/{success,cancel}` | `/exchange/listings/payment/*` |
| `/wanted`, `/wanted/[id]`, `/wanted/new` | `/exchange/wanted/*` |
| `/finds`, `/finds/[slug]`, `/finds/submit` | `/exchange/finds/*` |
| `/watchlist`, `/sold`, `/feeds`, `/safety`, `/how-it-works`, `/social` | `/exchange/*` |
| `/messages`, `/messages/[conversationId]` | `/exchange/messages/*` |

**Fold-ins (don't duplicate CMDIY equivalents):**
- **Dashboard** → tabs on CMDIY's existing `app/pages/dashboard.vue`: `dashboard/listings`, `dashboard/wanted`,
  `dashboard/notifications`, `dashboard/saved-searches`.
- **Admin** → `app/pages/admin/exchange/*` (`listings, wanted, finds, promotions, announcements, newsletter,
  moderation, messages`) + an "Exchange" card on `app/pages/admin/index.vue`.
- **Membership** → TME `/settings/membership` merges into CMDIY's existing `/membership`.

**Collision resolution (CMDIY's version wins; TME's dropped):** `/auth/callback`, `/admin`, `/admin/users`,
`/dashboard`, `/profile`, `/users/[id]`, `/about`, `/contact`, `/privacy` → keep CMDIY's. `/terms` → new
`app/pages/legal/marketplace-terms.vue` (301 from `/terms`). TME login redirect `/?login=required` → CMDIY's
real `/login`.

> **Correction to early analysis:** CMDIY does **NOT** currently have an `onboarding.global.ts` middleware
> (only `admin.global.ts` and `oldRouteRedirect.global.ts`). TME's onboarding middleware **and** its
> `/onboarding` page both need to be brought over in Stage 7 (not just the page).

### File placement
- Components → `app/components/exchange/{listings,messages,wanted,finds,home,profile,dashboard,admin,auth}/`
  (preserve TME subfolders). Reconcile globals against CMDIY's (`Toaster.vue`, `ColorModeButton`, `Avatar`).
- Composables → flat in `app/composables/` (CMDIY convention). Delete TME duplicates (`useAuth`, `useSupabase`,
  `useToast`, `useProfile`, `useMapbox`, `useAdminMembership`, `usePosthog`, `useTheme`→use `useColorMode`);
  marketplace-unique ones move in as-is.
- Server API → `server/api/exchange/*`; admin → `server/api/admin/exchange/*`; cron → `server/api/cron/exchange/*`.
  Rewire all routes from TME's `verifyAuth.ts` → CMDIY's `userAuth.ts`/`adminAuth.ts`; delete `verifyAuth.ts`.
- Server utils → `server/utils/exchange/*`. Feeds → `server/routes/exchange/feed/*`.

### Cutover switch
`runtimeConfig.public.exchangeEnabled` (env `NUXT_PUBLIC_EXCHANGE_ENABLED`; boolean default false → Nuxt
runtime-overrides from env, so go-live is one env flip in Vercel Production, **no rebuild**). Gates:
1. **Nav** — `app/components/MainNav.vue` exchange entry: internal `/exchange` when on, external
   `theminiexchange.com` until then.
2. **Routes** — `app/middleware/exchange-flag.global.ts` 404s `/exchange/**`, the dashboard/admin exchange
   tabs, and feeds when off (server + client, so uncrawlable).
3. **SEO** — marketplace sitemap sources + robots allow-rules conditional on the flag.

### Redirects (301, SEO-clean)
Primary: Vercel host-scoped 301s keyed on `has: [{ type:'host', value:'theminiexchange.com' }]` mapping every
legacy path to its `/exchange/*` equivalent (listings, wanted, finds, messages, watchlist, sold, dashboard,
admin→admin/exchange, profile, settings/membership→membership, terms→legal/marketplace-terms, feeds, `/`→`/exchange`).
`@nuxtjs/seo` auto-canonicalizes migrated pages to `classicminidiy.com/exchange/...`; keep `theminiexchange.com`
registered indefinitely so 301s persist.

## Backend convergence (parallel branch `tme-merge` in `classicminidiy-supabase`)

All schema/edge-function changes live in `classicminidiy-supabase` (hard rule) and land before the web code:
1. **Stripe** — new `create-listing-checkout` + `verify-listing-payment` edge fns (mirror
   `create-model-checkout`/`verify-model-purchase`): one-time $10 premium, writes `listing_promotions`,
   metadata `cmdiy_kind=listing_*`, own Stripe product + `STRIPE_LISTINGS_WEBHOOK_SECRET` in Supabase.
   Preserve sustaining-member free-premium comp + bulk checkout.
2. **Email** — map every TME transactional email to `notification_queue` event types (branded From per
   `CMDIY_EVENT_TYPES`); extend `process-notifications` (AWS SES v2). App only inserts queue rows.
3. **Scraping** — generalize CMDIY's `server/utils/external-models/*` (OG/JSON-LD + Microlink + SSRF) for
   marketplace finds. Tradeoff: bot-blocked sites (BaT/eBay/Craigslist/Copart/Facebook) may not yield rich
   metadata; mitigate with Microlink render + a manual-entry fallback on `/exchange/finds/submit`.

## Execution: stages (commit milestones on one branch)

- **Stage 0** — design doc + flag + `exchange-flag.global.ts` + placeholder `/exchange` + Project #9 card. ← *this commit*
- **Supabase branch (S1, S2)** — edge fns + queue convergence (lands first).
- **Stage 1** — deps merge (drop `puppeteer*`), `@iconify-json/heroicons`, icon-mapping plan.
- **Stage 2** — auth rewire, `gen:types`, composable dedup. No UI; green tests.
- **Stage 3** — read-only browse + i18n (`/exchange`, listings, finds-read, sold, wanted-read).
- **Stage 4** — create/edit + Stripe (thin proxy → S1). Triple-webhook isolation test. *(highest risk)*
- **Stage 5** — messaging + realtime (`postgres_changes`), web push, Camino.
- **Stage 6** — wanted (full) + converged Finds scraper.
- **Stage 7** — dashboard tabs + `/admin/exchange/*` + profile merge; bring TME onboarding (middleware + page).
- **Stage 8** — feeds, cron, social, newsletter, email enqueue.
- **Stage 9** — redirects + cutover prep (`vercel.json` host 301s, robots/sitemap).
- **Cutover** — open `tme-merge` PR → review → merge to `main` (flag off) → flip flag in Production → point
  `theminiexchange.com` at CMDIY with 301s → remove flag + gate → retire standalone TME deploy.

## Risks & verification

**Top risks:** triple Stripe webhook isolation; Finds metadata coverage loss after dropping Puppeteer; email
delivery gaps when converging to the queue; auth/session seam (`detectSessionInUrl` differs — keep CMDIY's
callback); icon-conversion glyph regressions (~80 components); Nuxt auto-import name collisions.

**Verify zero functionality loss:** port TME's 142 tests into CMDIY vitest, gate each stage on its subset
(`--exclude '**/.claude/**'`); per-stage preview-deploy QA with the flag on (preview env only); Stripe
test-mode replay for webhook signature + table isolation; RLS confirmation (shared backend); realtime smoke
(two sessions); feed validation + legacy 301 checks.
