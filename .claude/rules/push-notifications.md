---
paths:
  - 'app/utils/pushSubscription.ts'
  - 'app/composables/usePushNotifications.ts'
  - 'app/composables/useAuth.ts'
  - 'app/pages/dashboard/notifications.vue'
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
- The `/dashboard/notifications` toggle shows the per-user preference, not this device's subscription, so it can read ON on a device where push was cleaned up.
