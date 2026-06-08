# Sustaining Member Value Prop — classicminidiy.com (web)

**Date:** 2026-06-07
**Status:** Design — pre-implementation
**Repo:** `classicminidiy` (knowledgebase / community site, Nuxt 4)
**Keystone:** `classicminidiy-supabase/docs/plans/2026-06-07-membership-entitlement-contract.md` — single source of truth. Read it first. This doc covers only what the **web** does and must not restate the whole contract; references below point at "keystone §N."
**Keystone phase:** **Phase 3** (keystone §11). Depends on Phase 0 (verify-subscription live, untracked work committed) and Phase 1 (entitlement fan-out: Ghost comp + Discord direct from `subscriptions`) being shipped in the supabase repo.

---

## 1. Purpose

Make the web the coherent **sales + marketing + management surface** for the unified Sustaining Member value prop. Per keystone Decision #4, the web **sells the membership via Stripe Billing** (in addition to StoreKit/Play in the apps). Its job is to:

- Market the canonical value prop with the canonical name, price, and the 6-benefit list verbatim (keystone §4).
- Be **membership-aware**: load `is_sustaining_member` into global auth state so the badge and a "your benefits" area can render correctly for the logged-in user.
- Host the **Discord claim proxy page** at `/discord/claim` that the claim email links to (keystone §12) — it does not exist yet and must be built here.
- **Sell the membership via Stripe Checkout** (subscription mode) by calling the `create-membership-checkout` Edge Function, and let existing web members manage/cancel through the Stripe Billing Portal (keystone Decision #4, §7, §9). No app-store deep-linking.
- Keep **Patreon strictly separate** as a tip jar, not the membership (keystone decision 3, §4).

Gating rule (keystone §9): consumers read membership **only** through `user_has_subscription()` (server/RLS) or the `is_sustaining_member` field on the public-profile RPCs. Never query `subscriptions` directly. The one write path is purchase, and it goes through Stripe Checkout + the `stripe-membership-webhook` (keystone §7) — the web never writes `subscriptions` itself.

---

## 2. Current state in this repo

Verified against current code on branch `chore/posthog-tracking-coverage` (2026-06-07).

**Stack note (correcting CLAUDE.md):** CLAUDE.md still says "Nuxt UI." The repo is mid-migration to **daisyUI 5** per `DAISYUI_MIGRATION.md` (branch `feature/daisy-ui-rebuild`). Current page code uses raw daisyUI classes (`btn`, `btn-primary`, `card`, `card-body`, `modal`, `avatar`, `badge`) — e.g. `app/pages/profile/index.vue:100,115,156,169`. **Design against daisyUI.** Icons remain Font Awesome 6 only (inline `<i class="fas|far|fad|fab fa-*">`, or `i-fa6-*` on any surviving Nuxt UI component). No Heroicons/Lucide.

**Auth / membership state:**
- `app/composables/useAuth.ts` — `fetchUserProfile` (`:40-61`) selects `is_admin, display_name, email, avatar_url, trust_level, total_submissions, approved_submissions, rejected_submissions` from `profiles` — **does NOT load `is_sustaining_member`.** The `UserProfile` interface (`:3-12`) has no membership field. So nothing in global state knows if the current user is a member.
- The only place membership is read today is per-page: `app/pages/profile/index.vue:26-36` calls `getPublicProfile(user.id)` and pulls `publicResult.profile.is_sustaining_member` into a local `ref`. `app/pages/users/[id].vue:132` reads `profile?.is_sustaining_member` from the public-profile fetch. Both go through the RPC, which is correct, but membership is not in shared state.

**Profile / RPC plumbing:**
- `app/composables/useProfile.ts` — `PublicProfile.is_sustaining_member` (`:9`); `getPublicProfile` calls `get_public_profile_by_id` RPC (`:139`). This is the contract-correct read (keystone §9).
- `app/composables/useSupabase.ts` — browser/SSR client, **untyped** (`createClient(...)` with no `Database` generic, `:9`, `:48`). PKCE, manual `exchangeCodeForSession`, in-memory lock.
- `server/utils/supabase.ts` — service client `getServiceClient()`, also **untyped** (`:8`).
- **No `types/database.ts`** exists in the repo (no `types/` dir). Both clients are untyped — keystone §12 flags this; it's a prerequisite for typed membership reads.

**Badge surfaces (display-only, no logic to change):**
- `app/components/profile/SustainingBadge.vue` — pure display, FA6 `fas fa-star`, daisyUI `bg-warning/20 text-warning`, i18n label "Sustaining Member" across 10 locales. Already canonical-named. Keep.
- `app/pages/profile/index.vue:134` — `<ProfileSustainingBadge v-if="isSustainingMember" size="sm" />`.
- `app/pages/users/[id].vue:132` — `<ProfileSustainingBadge v-if="profile?.is_sustaining_member" size="sm" />`.

**Patreon / support copy (needs reframing):**
- `app/components/PatreonCard.vue` — large/small support card. Title "SUPPORT THE SITE," copy says "Membership comes with tons of free perks and benefits!" and links to `patreon.com/classicminidiy`. The word "Membership" here conflates Patreon with the Sustaining Member tier — must be reworded.
- `app/pages/index.vue:268-293` — home support block: eyebrow "SUPPORT" + Patreon "Donate" button + GitHub "Contribute" button. No mention of Sustaining Member.
- `app/pages/index.vue:1136-1148` — **dead** scoped CSS: a `.benefits-list` block styling `.fa-discord`/`.fa-video`/`.fa-gift`/`.fa-circle-info`. No `class="benefits-list"` markup exists anywhere in the file. Dead code — remove or repurpose for the new benefits section.
- `README.md:135` — aspirational claim: "Sustaining Members ($1.99/mo via App Store / Google Play) receive premium features across all properties." True under the keystone target state, but premature today (verify-subscription is 501; keystone §1). Reconcile wording. `README.md:29,593` are Patreon "support" links — leave (separate tip jar).

**Routing:** `app/pages/` has no `discord/` dir. `/discord/claim` does not exist (keystone §12 confirms). Server routes live under `server/api/` and use `defineEventHandler` + `getServiceClient()` (e.g. `server/api/weights.ts`).

**Analytics:** `useAnalytics()` exposes `track`, `trackOutbound({ destination, label?, group?, location? })` (`app/composables/useAnalytics.ts:41,101`). PatreonCard uses `usePostHog().capture('support_cta_clicked', { type:'patreon', location })`. Reuse these for new CTAs — no new infra.

---

## 3. Scope for this repo (mapped to the contract)

| # | Deliverable | Keystone ref |
|---|---|---|
| A | Load + expose `is_sustaining_member` in global auth state | §9 ("load into auth/session state") |
| B | Generate `types/database.ts` and adopt the `Database` generic on both clients | §12 (untyped client) |
| C | Sustaining Member **benefits + sign-up + management page**: market the 6-benefit list, **Subscribe via Stripe Checkout** (`create-membership-checkout`), Billing Portal link for members | §4, §7, §9 |
| D | Discord **claim proxy page** at `/discord/claim` forwarding to `discord-claim` Edge Function | §12 |
| E | "Your benefits" status area for logged-in members (badge, Discord connect status, Pro blog link) | §4, §9 |
| F | Reframe Patreon as a separate tip jar; reconcile README claim; remove dead CSS | §4 decision 3, §12 |

**Out of scope (other repos):** verify-subscription / notifications / fan-out / `sync-entitlements` / `discord_links` re-key / `entitlement_outbox` (all supabase, Phases 0–1); TME free premium listings (Phase 2); app copy/claim (Phase 4). The web only *consumes* the RPCs and *proxies* the claim.

---

## 4. File-by-file changes

### A. Load membership into global auth state — `app/composables/useAuth.ts`
- Extend the `UserProfile` interface (`:3-12`) with `is_sustaining_member: boolean`.
- **Do not** add `is_sustaining_member` to the `profiles.select(...)` in `fetchUserProfile` (`:44-46`). `is_sustaining_member` is **not** a column on `profiles` — it is computed by `user_has_subscription()` and surfaced via the RPCs (keystone §9). Selecting it from `profiles` would either error or read a stale/absent column.
- Instead, after the `profiles` fetch succeeds, derive membership via the contract gate. Two options, pick one at implementation:
  - **Preferred:** add an RPC call `supabase.rpc('user_has_subscription', { p_user_id: userId })` (default product `'sustaining'`) and set `userProfile.value.is_sustaining_member` from the boolean. This is the canonical gate and is cheap.
  - Alternative: reuse `get_public_profile_by_id(userId)` and read `is_sustaining_member` (already done in `useProfile`), but that returns null for private profiles, so the RPC gate is more robust for the logged-in self.
- Expose a computed `isSustainingMember = computed(() => userProfile.value?.is_sustaining_member ?? false)` from the composable's return (alongside `isAdmin`, `:212,219`). This becomes the single source for badge + benefits gating across pages, replacing the ad-hoc per-page `ref` in `profile/index.vue`.
- Keep the existing `onAuthStateChange` deferral pattern (`:105-119`); the membership read happens inside the same deferred `fetchUserProfile` path so it stays in sync on sign-in/out.
- PostHog: optionally add `is_sustaining_member` to `syncPostHogIdentity` props (`:30-37`) for cohorting. Keep it a person property, not an event.

### B. Generate and adopt typed Supabase client
- Run from repo root (project ref is the shared `ClassicMiniDIY` project — get the ref from the supabase repo / Cole):
  `supabase gen types typescript --project-id <ref> > types/database.ts`
- `app/composables/useSupabase.ts`: `import type { Database } from '~/types/database'` and parametrize both `createClient<Database>(...)` calls (`:9`, `:48`). Update the `useState<SupabaseClient>` generic to `SupabaseClient<Database>`.
- `server/utils/supabase.ts`: `createClient<Database>(...)` (`:8`); type `serviceClient` as `SupabaseClient<Database> | null`.
- This makes `.from('profiles')`, `.rpc('user_has_subscription', ...)`, `.rpc('get_public_profile_by_id', ...)` type-checked, removing the `as PublicProfile` cast in `useProfile.ts:151` over time.
- Add a `package.json` script (match house convention) e.g. `"gen:types": "supabase gen types typescript --project-id <ref> > types/database.ts"` so regen after future schema changes is one command (keystone §9 / Development CLAUDE.md rule 1).

### C. Sustaining Member benefits + management page
- **New page:** `app/pages/membership/index.vue` (route `/membership`). Rationale: distinct, marketable, SEO-indexable noun; `/contribute/*` already exists for UGC contributions and would muddy the meaning. Confirm slug with Cole (open question).
- Sections (daisyUI, FA6 icons):
  1. **Hero / value prop** — canonical name "Sustaining Member," price "$1.99/month — subscribe here, or in the iOS/Android apps."
  2. **Benefit list** — render the 6 canonical benefits in canonical order (see §5). Use a `card`/`list` layout; FA6 icons per benefit (suggested: `fas fa-user` one-account, `fad fa-wrench`/`fas fa-screwdriver-wrench` maintenance, `fab fa-discord` Discord, `fad fa-book`/`fas fa-book-open` Pro blog, `fas fa-tag` TME listings, `fad fa-hands-heart` support). This is a good home to **repurpose the dead `.benefits-list` CSS** from `index.vue:1136-1148` (move it here, scoped, and actually use `class="benefits-list"`).
  3. **Subscribe CTA (logged-out or non-member)** — a primary **"Become a Sustaining Member — $1.99/mo"** button that hits a server route → `create-membership-checkout` Edge Function → redirects to the returned **Stripe Checkout** URL. If the user is logged out, route them through sign-in first (the webhook needs `metadata.user_id` to attribute the row). Secondary note: "Also available in the iOS and Android apps." Track `track('membership_checkout_started', { source:'web' })`.
  4. **Member management (logged-in member)** — the "your benefits" area (deliverable E), rendered inline when `isSustainingMember` is true.
- SEO: `useHead` with title/description; this page should be indexable (unlike `/profile` which is `noindex`). Add canonical value-prop copy to meta description.
- i18n: add a `membership` section to `i18n/locales/en.json` (master) mirroring the verbatim copy; other locales can fall back to `en` until translated (the badge component already shows the localized-label precedent).

**Stripe wiring (new to this repo — classicminidiy has no Stripe today):**
- New server route `server/api/membership/checkout.post.ts` → calls the `create-membership-checkout` Edge Function with the user's Supabase JWT, returns the Checkout `url`; the page redirects via `navigateTo(url, { external: true })`.
- Membership creation/renewal/cancellation is handled entirely by `stripe-membership-webhook` in supabase (keystone §7) — the web never writes `subscriptions`.
- Member management: a "Manage membership" button → `create-billing-portal-session` (if shipped) → Stripe Billing Portal.
- **No Stripe secret key in this repo** — session creation lives in the Edge Function; at most a publishable key (only if Stripe.js redirect is used) goes in `runtimeConfig.public`. Optional secondary app-store links may still live in `runtimeConfig.public`.

### D. Discord claim proxy page — `app/pages/discord/claim.vue` (route `/discord/claim`)
The `discord-claim` Edge Function documents the exact contract (verified in `classicminidiy-supabase/supabase/functions/discord-claim/index.ts`):
> The Nuxt page at `classicminidiy.com/discord/claim?token=<jwt>` proxies here: `GET /functions/v1/discord-claim?token=<jwt>`. On success it 302-redirects to Discord OAuth; on failure it 302-redirects to `classicminidiy.com/?discord_error=<code>`.

- **New page:** `app/pages/discord/claim.vue`. On load, read `token` from the query. **Server-side redirect is cleanest:** create `server/routes/discord/claim.get.ts` (or a server route) that 302-forwards `GET ${supabaseUrl}/functions/v1/discord-claim?token=<token>` so the browser follows the Edge Function's own redirect chain (Edge Function → Discord OAuth → `discord-callback` → bot grants role). Using a server route avoids exposing the proxy hop to client JS and preserves the 302.
  - Alternatively a client page that `navigateTo(\`${supabaseUrl}/functions/v1/discord-claim?token=${token}\`, { external: true })`. Server route preferred for clean redirect semantics + no flash.
- Build the Edge Function URL from `config.public.supabaseUrl` + `/functions/v1/discord-claim`. Do not hard-code the project ref.
- **Error display:** the Edge Function redirects failures to `/?discord_error=<code>` (codes seen: `missing_token`, `expired_link`). The home page (`app/pages/index.vue`) should detect `route.query.discord_error` and show a daisyUI `alert alert-error` toast/banner with a friendly message ("This Discord invite link has expired — open the Classic Mini DIY app to request a new one"). Add i18n keys for each known code. This is the one home-page touch the claim flow needs.
- Add a `<NoIndex>`/`noindex` meta on `/discord/claim` — it's a transient redirect page, not content.
- Track `track('discord_claim_proxied')` (membership-event) server-side or on the page for funnel visibility.

### E. "Your benefits" status area (logged-in member)
- Rendered inside the management section of `/membership` (deliverable C) and optionally surfaced on `app/pages/profile/index.vue` near the badge (`:131-152`).
- Contents (all reads through the contract, never `subscriptions` directly):
  - **Badge** — reuse `ProfileSustainingBadge`, gated on the new global `isSustainingMember` computed (deliverable A).
  - **Discord connect status** — OPTIONAL and depends on the keystone adding a SELECT-own RLS policy on `discord_links` (keystone §6.2, §9 "Discord connection status (optional)"). If present, read `discord_links.status` for the current user via a typed `.select('status').eq('user_id', user.id)` and show "Discord: connected / pending / not connected." If the keystone does **not** ship the SELECT-own policy in Phase 1, render a static "Join the members-only Discord" entry point instead and treat connect-status as a follow-up (flag in open questions).
  - **Pro blog link** — a link to the Ghost subscriber blog ("Pro access to the blog"). Comp is granted by `sync-entitlements` (keystone §5.2); the web only links to the blog URL. Put the blog URL in `runtimeConfig.public` (e.g. `blogUrl`). Copy: "Pro access to the blog" — never "newsletter" (keystone §4 guardrail).
- Non-members see the purchase CTA (deliverable C) in place of this area.

### F. Patreon separation + README + dead CSS
- `app/components/PatreonCard.vue`:
  - Reword i18n `membership_benefits` ("Membership comes with tons of free perks and benefits!") to remove "Membership" so Patreon is unambiguously a **tip jar**, not the Sustaining Member tier. Suggested EN: "A one-time or recurring tip that helps keep the lights on — separate from Sustaining Membership." Update all 10 locales (or set EN and let others fall back, matching badge precedent).
  - Keep the Patreon link, `fab fa-patreon` icon, and `support_cta_clicked` tracking. Optionally add a small "Looking for member perks? See Sustaining Member →" link to `/membership` to disambiguate.
- `app/pages/index.vue:268-293` support block: keep Patreon + GitHub as tip-jar/contribution CTAs, but add a third CTA or a line linking to `/membership` so the home page points at the real value prop. Do not merge Patreon and membership into one button.
- `app/pages/index.vue:1136-1148`: remove the dead `.benefits-list` scoped CSS (or move it to the new `/membership` page where it will actually be used).
- `README.md:135`: reconcile the aspirational claim. Either (a) soften to present tense once Phases 0–1 ship, or (b) qualify now: "Sustaining Members ($1.99/mo via App Store / Google Play) unlock a unified set of benefits across all properties" without implying every benefit is live today. Coordinate with the keystone's rollout — don't claim parity before verify-subscription is un-stubbed. README `:29,593` Patreon links stay.

---

## 5. Copy to adopt

### Verbatim from keystone §4 (do not paraphrase, do not reorder)

**Name (one name, everywhere):** **Sustaining Member**. Retire "Supporting Member," "Patreon membership" (for this tier), and ad-hoc CTA names. Rotating CTAs may still vary verb ("Become a member" / "Subscribe") but the noun is always "Sustaining Member."

**Price:** **$1.99/month**, same on every channel — App Store, Google Play, or classicminidiy.com via Stripe Billing.

**Benefit list (canonical order — all paywalls/benefit sheets use this set and order):**
1. **One account across everything** — classicminidiy.com, The Mini Exchange, and the Classic Mini DIY Toolbox apps. One profile, one login, a Sustaining Member badge on your public profile.
2. **Maintenance tracking** — multi-vehicle garage, service history, smart reminders, PDF export, cloud-synced (in the apps).
3. **Members-only Discord** — a private community to talk shop, share builds, and get help.
4. **Pro access to the blog** — complimentary access to subscriber content on the Classic Mini DIY blog.
5. **Free premium listings on The Mini Exchange** — premium listing upgrade included at no charge while your membership is active.
6. **Support the channel** — fund continued development and free technical resources for the Classic Mini community.

**Naming guardrails:**
- On TME, "**Premium listing**" = the $10 one-time Stripe upgrade. The member benefit is phrased "**Premium listings included free for Sustaining Members**" — never bare "Premium" in a way that collides.
- "Pro access to the blog" = Ghost comped membership. Do not call it "newsletter" (the paid newsletter is a separate Ghost-direct purchase; see keystone §13).

### This repo's before → after copy changes

| Surface | Before | After |
|---|---|---|
| `PatreonCard.vue` `membership_benefits` | "Membership comes with tons of free perks and benefits!" | "A one-time or recurring tip that helps keep the lights on — separate from Sustaining Membership." |
| `PatreonCard.vue` `title` | "SUPPORT THE SITE" | Keep (tip jar) — optionally add "Looking for member perks? See Sustaining Member →" link to `/membership` |
| `/membership` (new) | — | Canonical name + price + 6-benefit list (verbatim above) + Stripe Subscribe CTA + member management |
| `index.vue` support block | Patreon "Donate" + GitHub "Contribute" only | Same + a "Become a Sustaining Member →" link to `/membership` |
| `README.md:135` | "...receive premium features across all properties." | "...unlock a unified set of benefits across all properties" (don't imply all benefits are live pre-Phase 0/1) |
| Home `?discord_error=` (new) | — | i18n error messages for `missing_token`, `expired_link` |

---

## 6. Testing

- **Vitest** (house default: Vitest 4.x + `@vue/test-utils` + `happy-dom`):
  - `useAuth` — `isSustainingMember` computed is false when no profile / no subscription, true when the membership gate RPC returns true; mock the Supabase client's `.rpc('user_has_subscription')`.
  - `useAuth` — `fetchUserProfile` still does **not** request `is_sustaining_member` as a `profiles` column (guard against regression to the wrong read path).
  - `/membership` page — renders all 6 benefits in canonical order; the Subscribe CTA POSTs to the checkout server route (mock it) and redirects to the returned URL; logged-out users are routed to sign-in first.
  - `/membership` management area — shows benefits status only when `isSustainingMember` is true; shows purchase CTA otherwise.
  - `PatreonCard` — reworded copy contains no standalone "Membership" claim that conflates with the tier.
- **Manual / E2E:**
  - Discord claim happy path: hit `/discord/claim?token=<valid jwt>` (test token from supabase) → 302 to Discord OAuth. Invalid/expired token → redirect to `/?discord_error=expired_link` → home renders the error alert.
  - Membership badge end-to-end depends on Phase 0 (a real test `subscriptions` row). Until then, stub the gate RPC.
- **Build:** `bun run build` must pass with the new typed client (`types/database.ts` resolves; no `any` leaks break strict TS).

---

## 7. Dependencies & sequencing

- **Keystone phase: 3** (keystone §11). Hard dependencies:
  - **Phase 0 (supabase):** `verify-subscription` live + notifications + untracked Ghost/Discord work committed. Until this ships, `user_has_subscription()` is false for everyone and the badge never flips (keystone §1) — the web membership-aware work renders but shows no members. Build it anyway; it's correct by construction and lights up when Phase 0 lands.
  - **Phase 1 (supabase):** entitlement fan-out — `discord-claim`/`discord-callback` re-keyed to `user_id`, claim email migrated to Resend, optional SELECT-own RLS on `discord_links`. The claim proxy page (D) works against the *existing* `discord-claim` contract today (it keys on `ghost_member_id` pre-Phase-1, `user_id` post), so the proxy is stable across the re-key; only the Discord-connect-status read (E) needs the SELECT-own policy. **Phase 1 also ships `create-membership-checkout` + `stripe-membership-webhook` (keystone §7) — the web Subscribe CTA (C) calls these, so the sign-up flow hard-depends on Phase 1.**
- **Within this repo, do B (types) before A/E** (typed reads), and A before C/E (global `isSustainingMember` powers them). D is independent and can land first.
- **Cross-property tracking:** this is a cross-property feature — ensure a card exists on [CMDIY Platform #9](https://github.com/orgs/ClassicMiniDIY/projects/9) (set Web = In Progress). The keystone is the umbrella; this is the Web row.
- **Branch:** new work off `main` as `feature/sustaining-member-web` (current branch `chore/posthog-tracking-coverage` is unrelated — do not pile onto it; user CLAUDE.md "fresh branch off main" rule).

---

## 8. Open questions

1. **Route slug:** `/membership` vs `/sustaining-member` vs nesting under `/contribute`? Proposed `/membership` (clean, marketable, distinct from UGC `/contribute/*`).
2. **Stripe membership config:** the `STRIPE_MEMBERSHIP_PRICE_ID` and (if Stripe.js redirect is used) publishable key from the supabase/Stripe setup, for the web Subscribe flow. Plus: keep secondary app-store links on the page or web-only?
3. **Blog URL:** the Ghost "Pro access to the blog" target URL for deliverable E — subdomain/path TBD with the Substack→Ghost migration.
4. **Discord connect status (E):** does keystone Phase 1 ship the SELECT-own RLS policy on `discord_links`? If not, web shows a static "Join Discord" entry instead of live connect-status — confirm acceptable.
5. **README claim timing:** soften now or wait until Phase 0 makes the claim literally true? Proposed: qualify now (don't imply live parity).
6. **i18n depth:** translate `/membership` copy into all 10 locales up front, or ship EN + fall back (badge precedent) and translate later? Proposed: EN first, fall back.
7. **Home-page membership CTA placement:** add to the existing support block (§4.F) or a dedicated home section? Proposed: a link in the support block to avoid scope creep on the home page.
