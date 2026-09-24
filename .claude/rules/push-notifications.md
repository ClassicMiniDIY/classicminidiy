---
paths:
  - 'app/utils/pushSubscription.ts'
  - 'app/composables/usePushNotifications.ts'
  - 'app/composables/useAuth.ts'
  - 'app/pages/dashboard/notifications.vue'
  - 'service-worker/*.ts'
---

# Web Push rules

Detail: `docs/invariants/push-notifications.md`. Server contract (the claim RPC, table checks): `classicminidiy-supabase` CLAUDE.md.

- A browser keeps its push endpoint across sign-ins, and the endpoint is UNIQUE in `push_subscriptions`. Treat the endpoint as belonging to whoever is signed in on the browser now.
- `subscribe()` writes only through `claimPushSubscription()` (the `claim_push_subscription` RPC). Never go back to a direct `.upsert()`: on a shared browser it fails for the second user.
- Sign-out order: delete the row (`detachBrowserPushRow`) BEFORE `auth.signOut()`, because only the owner's session may delete it; unsubscribe the browser only AFTER a successful sign-out; if sign-out fails, restore the row with the claim.
- Any auth event with no session unsubscribes the browser (`unsubscribeBrowserPush`). No database call there: the session is gone, and `process-notifications` prunes the dead endpoint's row on its 410.
- At session start the listener drops a browser subscription the user owns no row for (`reconcileBrowserPush`). It must NEVER claim it: claiming would turn push on for someone who did not ask.
- A late (stalled) cleanup must not act under a later session: the pre-sign-out delete is skipped after its timeout, and the unsubscribe checks that nobody signed in meanwhile.
- `unsubscribe()` with no subscription on this device deletes nothing. Never delete by `user_id`: that turns push off on every other device.
- The `/dashboard/notifications` toggle is the per-user preference, which `process-notifications` applies to ALL the user's devices. Under it, `pushDeviceStatus()` tells the user when THIS device has no owned subscription (with a "Turn on for this device" button) or has notifications blocked. The page never re-subscribes on its own, even with permission granted: only the toggle or the button may claim. Unknown device state (not mounted, check pending or failed, busy) shows nothing, never a guess.
- `checkExistingSubscription()` reads through `getBrowserPushSubscription()` (`getRegistration()`), never `serviceWorker.ready`, which never resolves without a registered service worker.
- The service worker (`service-worker/sw.ts`, built to `/sw.js` by @vite-pwa/nuxt `injectManifest`) is push-only: `push` and `notificationclick` listeners, no `fetch` listener, no precache, no `clients.claim()`. It must show a notification for every push (`userVisibleOnly`). Adding caching needs a design doc. `tests/static/push-service-worker.test.ts` pins this.
- Only `ensurePushServiceWorker()`, called from `subscribe()` AFTER the permission prompt, registers the worker. Nothing registers it on page load (`injectRegister: false`, `client.registerPlugin: false`), so visitors who never turn push on get no worker.
- `pushsubscriptionchange` is not handled: the worker has no session to save a rotated endpoint with. The next visit's ownership check drops it as unowned, and the status line offers the button.
- Click URLs open on the worker's own origin only: relative, or an http(s) URL on `SITE_HOSTS` (bare domain and www), rebuilt on the origin; anything else opens the root. The server's `SITE_URL` defaults to the bare domain, which 301s to www.
- The worker's `activate` deletes only the old Workbox caches (`isLegacyWorkboxCache`); other Cache Storage is kept.
- `claimPushSubscription()` marks the endpoint claimed for the page's lifetime, and `dropUnownedPushSubscription()` never drops a marked one: an ownership read sent before the claim landed would otherwise kill the push the user just turned on.
- `bun run dev` serves no `/sw.js`, so turning push on fails locally. Test push on a build (`bun run build && bun run start`). `scripts/verify-cf-deploy.sh` checks the live `/sw.js` after each deploy.
