# Exchange migration — shared-infra map (Stage 2)

Reference for stages 3–7. The auth-rewire and composable-dedup are applied **per slice** as each TME
file is copied into CMDIY (not in one big-bang), using the mappings below.

## Types — DONE
`types/database.ts` already contains all marketplace tables (`listings`, `listing_photos`,
`listing_promotions`, `listing_comments`, `conversations`, `messages`, `watchlist`, `saved_searches`,
`wanted_posts`, `external_listings`, `site_announcements`, `notification_preferences`,
`notification_queue`, …) because CMDIY's `bun run gen:types` pulls the full shared `public` schema. No
regeneration needed unless a new migration lands. Import via `~~/types/database` (`~~` = project root;
`~` = `app/`).

## Server auth rewire (TME → CMDIY)

TME uses `server/utils/verifyAuth.ts` → **delete it** after migration. Rewire every copied route:

| TME call | CMDIY replacement (`server/utils/`) | Returns |
|---|---|---|
| `verifyBearerToken(event)` → `{ userId }` | `requireUserAuth(event)` | `{ user, accessToken }` (use `user.id` for `userId`) |
| `verifyBearerToken` + then a token-scoped query | `requireUserClient(event)` | `{ user, accessToken, supabase }` (RLS-scoped client) |
| admin check | `requireAdminAuth(event)` | throws 401/403; verifies `is_admin()` RPC |
| boolean admin check | `isAdminAuthenticated(event)` | `boolean` |
| service-role query | `getServiceClient()` (`server/utils/supabase.ts`) | service client (bypasses RLS) |
| token-scoped client | `getUserClient(accessToken)` | RLS-respecting client |

Contract: marketplace `/api/exchange/*` routes needing the user must read the `Authorization: Bearer`
header (session is in localStorage, not a cookie) — `requireUserAuth`/`requireUserClient` already do via
`extractAccessToken`. Client callers forward the token (see `app/composables/useAuthFetch.ts` /
`useAdminFetch.ts`).

## Composable dedup (delete TME's, point at CMDIY's)

All CMDIY canonical composables exist and are auto-imported:

| TME composable | Action | CMDIY canonical |
|---|---|---|
| `useAuth` | delete TME | `useAuth` (user, userProfile, isAuthenticated, isAdmin, isSustainingMember, waitForAuth, signInWithEmail/Google/Apple, signOut) |
| `useSupabase` | delete TME | `useSupabase` |
| `useToast` | delete TME | `useToast` |
| `useProfile` | delete TME | `useProfile` |
| `useMapbox` | delete TME | `useMapbox` |
| `useAdminMembership` | delete TME | `useAdminMembership` |
| `usePosthog` | delete TME, rename calls | `usePostHog` (capital H) / prefer `useAnalytics` helpers |
| `useTheme` | delete TME | `useColorMode` (cmdiy / cmdiy-dark) |
| `useErrorHandler` | review | port if no CMDIY equiv |

Marketplace-unique composables move in flat to `app/composables/` as-is (reconcile any name clash first):
`useListings`, `useListingPhotos`, `useMessages`, `useMessageAttachments`, `useComments`, `useWatchlist`,
`useWantedPosts`, `useSavedSearches`, `useSearch`, `usePayments`, `useCurrency`, `useNotifications`,
`useNewsletter`, `useExternalListings`, `useExternalListingAdmin`, `useLocation`, `useBuyerLocation`,
`useGeocoding`, `useFormatters`, `useTableSort`, `useMiniColors`, `useAnnouncement`,
`useAnnouncementStyles`, `useListingsReturnUrl`, `useExampleListings`, `useAdmin`.

## Directory layout (TME root-level srcDir → CMDIY `app/`)

TME has no `app/` dir; its `components/`, `pages/`, `composables/`, `middleware/`, `plugins/`, `server/`
sit at the repo root. Targets in CMDIY:

| TME | CMDIY |
|---|---|
| `pages/<x>` (listings, wanted, finds, messages, watchlist, sold, social, safety, how-it-works, feeds) | `app/pages/exchange/<x>` |
| `pages/dashboard/{listings,wanted}`, `pages/settings/{notifications,saved-searches}` | `app/pages/dashboard/<tab>` (fold into existing hub) |
| `pages/admin/*` | `app/pages/admin/exchange/*` |
| `components/<group>/` | `app/components/exchange/<group>/` |
| `composables/` | `app/composables/` (flat) |
| `middleware/` | `app/middleware/` (reconcile with existing global guards) |
| `plugins/` | `app/plugins/` (reconcile auth/posthog/push) |
| `server/api/*` | `server/api/exchange/*` (admin → `server/api/admin/exchange/*`, cron → `server/api/cron/exchange/*`) |
| `server/utils/*` | `server/utils/exchange/*` (reconcile rateLimit/sanitize/validators) |
| `server/routes/feed/*` | `server/routes/exchange/feed/*` |

Every migrated `.vue` adds `const { t } = useI18n()` + a `<i18n lang="json">` block with all 10 locales
(en es fr de it pt ru ja zh ko); no HTML in message values. `/admin/exchange/*` + `/legal/marketplace-terms`
stay English-only.

## ⚠️ Component auto-import renaming (load-bearing)

Nuxt derives auto-import component names from the path under `components/`. Moving TME components into
`app/components/exchange/<group>/` **changes their tag names** — every cross-component reference in migrated
`.vue` files must be updated:

| TME path → tag | CMDIY path → tag |
|---|---|
| `components/listings/PriceDropBadge.vue` → `<ListingsPriceDropBadge>` | `app/components/exchange/listings/PriceDropBadge.vue` → `<ExchangeListingsPriceDropBadge>` |
| `components/listings/ListingShippingBadge.vue` → `<ListingsListingShippingBadge>` | → `<ExchangeListingsListingShippingBadge>` |
| `components/messages/MessageList.vue` → `<MessagesMessageList>` | → `<ExchangeMessagesMessageList>` |
| `components/Avatar.vue` → `<Avatar>` | reconcile: use CMDIY's `<Avatar>` if API-compatible, else `app/components/exchange/Avatar.vue` → `<ExchangeAvatar>` |

Rule: prepend `Exchange` to every `<Listings*>`, `<Messages*>`, `<Wanted*>`, `<Finds*>`, `<Dashboard*>`,
`<Home*>`, `<Profile*>`, `<Admin*>` tag as its file moves under `app/components/exchange/`. Global/un-grouped
TME components (`Avatar`, `ConfirmDialog`, `ToastContainer`, `AnnouncementBanner`) reconcile against CMDIY
equivalents first (CMDIY has `Toaster.vue`, possibly `Avatar`); only namespace the ones with no CMDIY peer.

## Component dependency graph (port leaves first)

Migrate each page's component tree **leaf-first** so parents always resolve their children. Example —
`ListingCard` (the marketplace's central card) depends on: `PriceDropBadge`, `ListingShippingBadge`,
`Avatar`, `DashboardListingAnalytics` (children) + `~/utils/countryFlags` (port to `app/utils/`) + the
already-ported composables. Build order for the browse slice: leaves (`PriceDropBadge`,
`ListingShippingBadge`, `Avatar` reconcile, `countryFlags` util) → `ListingCard` → `SearchBar`,
`SortDropdown`, `FilterSidebar`, `ListingsMap` → `pages/exchange/listings/index.vue`.

Link URLs inside components change too: `/listings/${slug}` → `/exchange/listings/${slug}`,
`/listings/new?draft=` → `/exchange/listings/new?draft=`, etc.
