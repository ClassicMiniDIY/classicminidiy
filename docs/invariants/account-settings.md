# Dashboard and settings

Rules: `.claude/rules/account-settings.md`. Design: `docs/plans/2026-09-28-settings-page-and-dashboard-sidebar.md`.

## Why there are two pages

Until 2026-09-28 there was no settings page. The account dropdown held Membership,
"API & Dev Tools" and a language picker; the mobile drawer and the signed-out header
held two more copies of that picker; `/dashboard` held API keys and Notifications as
tabs, twelve tabs in a strip that overflowed. A currency picker existed only in
onboarding, and `initUserCurrency()` was never called, so a saved currency was never
read back.

The split is: `/dashboard` is what you made or bought, `/settings` is how the site and
your account behave.

## Old paths are permanent redirects

`process-notifications` and the shared email template in `classicminidiy-supabase`
link to `/dashboard/notifications` (the footer "manage your email preferences" link
and the digest unsubscribe fallback). `server/mcp/README.md` has been published with
`/dashboard/api-keys`. Both 301 to `/settings/*`. Mail clients sometimes append
`&…` to the path, so both old and new notification paths are in `EMAILED_PATHS`
in `server/middleware/mangled-link-redirect.ts`.

## Member or join

`isSustainingMember` reads `userProfile`. On a fresh sign-in, `onAuthStateChange` sets
`user` and defers the profile fetch with `setTimeout`, so for a moment the visitor is
signed in with no profile. `/settings/membership` shows a spinner until the profile
exists; branching on `isSustainingMember` alone showed a paying member the join card.

## Currency read timing

Prices render in USD on the server. Reading the saved currency before hydration made
every converted price a hydration mismatch, so `app.vue` reads it in `onMounted` and
again when the user id changes. A choice made in Settings while the profile read is in
flight wins: `setUserCurrency` bumps a generation counter that the read checks before
it applies the profile value.
