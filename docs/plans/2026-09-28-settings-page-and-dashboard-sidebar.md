# Settings page and dashboard sidebar

Date: 2026-09-28. Status: approved design, implementation on `feature/settings-page`.

## Problem

There is no standalone settings page. Account settings are spread across the header
and the dashboard:

- the account dropdown holds Membership, "API & Dev Tools" and a language picker;
- the mobile drawer holds an API keys link and a second language picker;
- the signed-out header holds a third language picker;
- the dashboard holds API keys and Notifications as tabs.

The dashboard has twelve routed tabs in a `tabs-border` strip. The strip overflows.

A currency selector does not exist. `useCurrency().initUserCurrency()` is never
called, so a saved currency is never read back on page load.

## Decisions

- New `/settings`, open to every visitor. Signed-out visitors see only Preferences
  (language and currency). The account sections show a sign-in card.
- `/membership` stays the public sales and checkout page. Stripe returns to it, so the
  activation polling stays there. The member-management card moves to
  `/settings/membership`; `/membership` shows members a link to it.
- Passkeys and the delete-account link move from `/profile/edit` to
  `/settings/security`. `/account/delete` stays public at its path (Play Data Safety).
- The dashboard and settings share one routed sidebar component, `<AccountShell>`,
  copied from the `<AdminShell>` nav pattern: sticky menu at `lg` and up, one
  dropdown below `lg`.

## Route map

| Route                     | Access                      | Source                                                  |
| ------------------------- | --------------------------- | ------------------------------------------------------- |
| `/settings`               | redirect                    | `definePageMeta({ redirect: '/settings/preferences' })` |
| `/settings/preferences`   | public                      | new: language (`LanguageSwitcher.vue`) and currency     |
| `/settings/membership`    | signed in                   | member branch extracted from `membership/index.vue`     |
| `/settings/notifications` | signed in, marketplace flag | moved from `/dashboard/notifications`                   |
| `/settings/api-keys`      | signed in                   | moved from `/dashboard/api-keys`                        |
| `/settings/security`      | signed in                   | passkeys and danger zone from `/profile/edit`           |

A child page that needs a session declares `definePageMeta({ settingsAuth: true })`.
The parent `settings.vue` renders the spinner or the sign-in card in its place.

Dashboard sidebar groups: 3D models (Models, Selling, Purchases), Saved tools (Gear
configs, Alignment), Contributions (Submissions, External links), Marketplace
(Listings, Wanted, Saved searches; flag only), and a link to Settings.

## Redirects

Both are permanent. Transactional emails from `classicminidiy-supabase` link to
`/dashboard/notifications`, and `server/mcp/README.md` has been published with
`/dashboard/api-keys`.

| From                       | To                        |
| -------------------------- | ------------------------- |
| `/dashboard/api-keys`      | `/settings/api-keys`      |
| `/dashboard/notifications` | `/settings/notifications` |

They are routeRules 301s plus entries in the client table in
`app/middleware/oldRouteRedirect.global.ts`. The TME host map in
`server/utils/tmeRedirects.ts` points `/settings/notifications` and
`/settings/membership` at the new pages; run `scripts/sync-tme-zone-redirects.py`
after merge.

## Navigation

- Account dropdown: Messages, Profile, Dashboard, Submissions, Settings, Admin, Sign out.
- Signed-out header: a globe icon link to `/settings/preferences`.
- Mobile drawer: Dashboard and Settings when signed in; Settings when signed out. No
  language buttons, no API keys link.

## Currency

`app/plugins/currency.client.ts` calls `initUserCurrency()` on `app:mounted` (after
hydration, so server-rendered USD prices do not mismatch) and again when the signed-in
user changes. The selector calls `setUserCurrency(code, userId)`, which writes
localStorage and `profiles.preferred_currency`.

## Follow-ups

- `classicminidiy-supabase`: point email links at `/settings/notifications`.
- Run `scripts/sync-tme-zone-redirects.py` after merge.
