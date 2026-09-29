---
paths:
  - 'app/pages/settings.vue'
  - 'app/pages/settings/**'
  - 'app/pages/dashboard.vue'
  - 'app/components/account/**'
  - 'app/components/membership/ManageCard.vue'
  - 'app/components/LanguageSwitcher.vue'
  - 'app/components/settings/**'
  - 'app/plugins/account-shell-navigation.client.ts'
  - 'app/utils/accountShellNavigation.ts'
---

# Dashboard and settings rules

Design: `docs/plans/2026-09-28-settings-page-and-dashboard-sidebar.md`. Story: `docs/invariants/account-settings.md`.

- `/dashboard` (what you made) and `/settings` (how the site and your account behave) share `<AccountShell>` (routed sidebar at `lg`, one dropdown below) and `<AccountSignInGate>` (spinner, sign-in card, content). Never branch either page on raw auth flags; both read `useMountedAuth()`.
- `/settings` is open to every visitor. `/settings/preferences` (language, currency) is the ONLY language and currency control on the site; MainNav links there and holds no picker. Every other settings child declares `definePageMeta({ settingsAuth: true })`, and the parent renders the gate in its place.
- `/settings/notifications` is in `EXCHANGE_PREFIXES`: the marketplace flag 404s it and the sidebar hides it.
- `/dashboard/api-keys` and `/dashboard/notifications` 301 to `/settings/*` (routeRules and `oldRouteRedirect.global.ts`). PERMANENT: transactional emails and the published MCP README link to them.
- `/membership` stays the public sales and checkout page (Stripe returns there; activation polling lives there). Member management is `<MembershipManageCard>` on `/settings/membership`, which waits for `userProfile` before choosing member or join, so a member never sees the join card.
- The saved currency is read in `app.vue` `onMounted`, never before hydration: the server renders USD.
- A section change inside a shell (`isAccountShellSectionChange`) must update only the section: `account-shell-navigation.client.ts` turns off the site-wide view transition (it cross-fades the whole document) and the scroll-to-top for that navigation, and `<AccountShell>` scrolls to the section start only if the visitor was past it. Never solve this with `definePageMeta`: `viewTransition` is static, and the macro runs without auto-imports (an auto-imported helper there is `undefined`, the route fails and Nuxt hard-reloads).
