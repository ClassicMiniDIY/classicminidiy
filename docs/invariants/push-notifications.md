# Web Push: shared browsers and sign-out

Rules: `.claude/rules/push-notifications.md`. Server side: `classicminidiy-supabase`
(migration `20260923000008`, its verify snippet, and that repo's CLAUDE.md).

## What went wrong (2026-09-23)

`usePushNotifications().subscribe()` saved the browser's Web Push subscription with an
upsert on `endpoint`, which is UNIQUE. `signOut()` only called `supabase.auth.signOut()`.
A browser returns the same endpoint to every user who subscribes on it, so on a shared
browser:

1. After user A signed out, A's row still pointed at that browser, and A's notifications
   (message previews included) kept arriving there.
2. When user B turned push on, B's upsert hit A's row, and the own-row update rule
   refused it, so B saw "Failed to enable push notifications".

## The fix, layer by layer

Each layer covers a case the one before cannot.

- **Explicit sign-out** deletes the row while the session still exists, then unsubscribes
  the browser once sign-out succeeds. If sign-out fails, the row is claimed back so push
  keeps working for the user who is still signed in. The delete is time-boxed (3 s) so a
  stalled service worker cannot hold up sign-out, and it is skipped if it resumes after
  the timeout, so it cannot delete a row the next user has just claimed.
- **Any auth event without a session** unsubscribes the browser. This covers a session
  that ended without `signOut()`: an expired or revoked refresh token, a sign-out in
  another tab, or a session that died while no tab was open. auth-js emits `SIGNED_OUT`
  for that last case inside `initialize()`, before our listener exists, so the listener
  sees `INITIAL_SESSION` with no session instead; that is why the check is "no session",
  not "event is SIGNED_OUT". Nothing is deleted here (RLS needs the owner's session); the
  push service rejects the dead endpoint and `process-notifications` prunes the row on
  the 410.
- **Session start** (`INITIAL_SESSION` / `SIGNED_IN` with a session) drops a browser
  subscription the signed-in user owns no row for. It never claims it, because claiming
  would enrol a user who did not ask for push. A failed ownership read leaves it alone.
- **Turning push on** calls the `claim_push_subscription` RPC, which takes the endpoint
  over from a previous owner. This is the only path that moves a row between users, and
  it runs only on the user's explicit opt-in.

## Accepted trade-offs

- After an involuntary sign-out (revoked or rate-limited refresh, `session_not_found`),
  push stays off on that browser until the user turns it on again. Nothing tells them.
- The notifications toggle reflects the per-user preference, not this device, so it can
  show ON on a device whose subscription was cleaned up. Turning it OFF then ON
  re-subscribes the device. Turning it OFF no longer deletes other devices' rows.

## Deploy order

The web build calls the RPC, so the migration must be live before the web change merges.
A green PR does not prove this; check the deploy run after the merge.
