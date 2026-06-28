# Exchange Onboarding Gate

**Date:** 2026-06-28
**Branch:** `tme-merge`
**Status:** building

## Goal

Introduce a profile-onboarding concept to CMDIY that gates the **Mini Exchange** behind a
complete account, without gating the knowledgebase/toolbox. Two tiers:

1. **Soft nudge (toolbox):** for a logged-in user who hasn't completed onboarding, a small
   fixed bottom-right card **replaces the AI chat overlay** site-wide. It's a CTA that opens
   the full onboarding experience. Non-blocking — the toolbox stays fully usable. Once
   onboarding is complete, the nudge disappears and the chat overlay returns.
2. **Hard gate (exchange):** a logged-in user who hasn't completed onboarding cannot enter any
   `/exchange/**` route — they are redirected to the full `/onboarding` page (non-skippable),
   with the intended destination preserved as `?redirect=`.

"Verified account" = `profiles.onboarding_completed = true` (display name + location + currency
set). Email is already verified by magic-link/OAuth at login, so there is **no separate
verification step**.

## Locked decisions (from the user)

- Nudge is a **site-wide** corner widget that **outranks the chat** for logged-in,
  not-onboarded users (shows instead of chat; reverts after completion).
- Nudge modal = a compact card whose **CTA opens the full onboarding** (one form, DRY).
- "Verified" = **completed profile** only.

## Assumptions (flag if wrong)

- **The whole concept is flag-gated** (`runtimeConfig.public.exchangeEnabled`). Pre-cutover it
  is fully invisible: no nudge, no gate, `/onboarding` 404s — consistent with the rest of the
  consolidation living behind the flag.
- **Anonymous browsing of the exchange stays public.** The hard gate applies to *logged-in*
  users only; anonymous visitors keep browsing public, indexable listing pages (the locked SEO
  plan — 301s, sitemaps, canonicals — depends on this). If you actually want the entire
  marketplace login-walled, that's a larger change and supersedes this assumption.
- `profiles.onboarding_completed` already exists in the shared DB (`boolean`, default false), so
  **no migration**. Existing CMDIY users therefore start as "needs onboarding" once the flag
  flips — intended (the nudge drives completion). (`onboarding_completed_app` is the separate
  mobile flag — untouched.)

## Pieces

| File | Role |
|---|---|
| `app/composables/useOnboardingGate.ts` | **Linchpin.** `needsOnboarding` computed = `exchangeEnabled && isAuthenticated && userProfile && onboarding_completed === false`. Consumed by the nudge, the homepage swap, and (indirectly) the middleware. |
| `app/middleware/exchange-onboarding.global.ts` | Hard gate. Client-side; flag-gated; only on `/exchange/**`; `waitForAuth` + active `fetchUserProfile`; redirects incomplete **logged-in** users to `/onboarding?redirect=…`. Anonymous → pass. Session cache by user id. |
| `app/components/OnboardingNudge.vue` | The soft nudge widget. `fixed bottom-6 right-6 z-50`. Renders only when `needsOnboarding`. CTA → `/onboarding?redirect=<current>`. 10-locale i18n. |
| `app/pages/onboarding.vue` | The full experience (port of TME's). `layout: false`, `middleware: exchange-auth` (must be logged in). Collects display name (req), location (req), preferred currency, bio, avatar. On complete → `fetchUserProfile` (flips `needsOnboarding`) → redirect to safe `?redirect=` or `/exchange`. 10-locale i18n. |
| `app/composables/useProfile.ts` | Add `completeOnboarding()` (upsert profile + `onboarding_completed: true`). |
| `app/utils/countryCurrency.ts` | Ported — currency auto-follows the location country until the user overrides. |
| `app/composables/useAuth.ts` | Add `onboarding_completed` to the `UserProfile` type **and** the `fetchUserProfile` select (currently omitted — the gate would read `undefined` otherwise). |
| `app/middleware/exchange-flag.global.ts` | Add `/onboarding` to `GUARDED_PREFIXES` so the page is invisible pre-cutover. |
| `app/app.vue` | Mount `<OnboardingNudge />` globally (self-gates via `v-if`). |
| `app/pages/index.vue` | Render `<FloatingChatInput v-if="!needsOnboarding" />` so the homepage chat yields to the nudge. |

## Why not a global onboarding wall (the TME approach)

TME's `onboarding.global.ts` runs on every route for every logged-in user — fine for a
pure marketplace, but in CMDIY it would wall the entire knowledgebase userbase behind a
marketplace setup form. This design scopes the *hard* gate to `/exchange/**` and makes the
toolbox experience a *soft*, dismissible-by-completion nudge instead.

## Edge cases handled

- **Loading race:** the middleware awaits auth + actively fetches the profile before deciding,
  so a not-onboarded user can't slip into `/exchange` during the auth-load window. The reactive
  `needsOnboarding` stays false while the profile is null (no premature nudge / no flash beyond
  the normal post-hydration auth settle).
- **No trap:** middleware never redirects `/onboarding` or `/auth/callback` to itself.
- **redirect safety:** the onboarding page only honors `?redirect=` values that start with a
  single `/` (internal paths); otherwise falls back to `/exchange`.
- **Completion reactivity:** `completeOnboarding` → `fetchUserProfile` refreshes
  `onboarding_completed`, so the nudge vanishes, the chat returns, and the exchange unlocks
  without a reload.

## Post-review adjustments (adversarial review, 2026-06-28)

A 4-lens adversarial review (24 candidate findings → 5 confirmed) drove these:

- **Gate scope (was the real bug):** the hard gate now keys off a shared
  `~/utils/exchangeRoutes.ts#EXCHANGE_PREFIXES` (= `/exchange` **plus** the user's marketplace
  dashboard tabs `/dashboard/{listings,wanted,notifications,saved-searches}`), imported by BOTH
  the flag-gate and the onboarding-gate so the two can't drift. Previously the onboarding gate
  only matched `/exchange/**`, letting a not-onboarded user reach `/dashboard/listings` (real
  writes). `/onboarding` and `/admin/exchange` are flag-hidden but intentionally NOT
  onboarding-gated (admins reach moderation via `is_admin`, not buyer/seller onboarding).
- **a11y:** the nudge is now an `<aside role="complementary" aria-live="polite">` with a label
  and `aria-hidden` decorative icons; the avatar picker is keyboard-operable (`role="button"`,
  `tabindex=0`, Enter/Space handlers, `aria-label`).
- **Accepted as-is:** nudge shares the bottom-right corner with toasts — but it inherits the
  exact anchor of the `FloatingChatInput` it replaces, so this is pre-existing corner behavior,
  not a regression.
- **Deferred to the profile merge:** `profiles.location` stores the full formatted address
  (matches TME) while the UI promises "only your country is public" — the public-display
  contract (country-only rendering on `/users/[id]`) is handled in the seller-signal merge.
