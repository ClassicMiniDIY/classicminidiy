# Per-device push status on /dashboard/notifications

Date: 2026-09-23. Status: approved design, implementation on `fix/per-device-push-toggle`.
Rules: `.claude/rules/push-notifications.md`. Background: `docs/invariants/push-notifications.md`.

## Problem

The push toggle on `/dashboard/notifications` is bound to the per-user preference
`notification_preferences.push_new_messages`. It never reads this device's Web Push
subscription. `usePushNotifications().checkExistingSubscription()` fills a `subscription`
ref that the page ignores.

Since the shared-browser push fix, several paths unsubscribe a browser and leave the
preference alone:

- explicit sign-out (`detachBrowserPushRow` + `unsubscribeBrowserPush`);
- any auth event without a session (`unsubscribeBrowserPush`);
- the session-start ownership check (`reconcileBrowserPush`).

After any of them the toggle can read ON on a device that receives nothing. The only
recovery is OFF then ON, and nothing tells the user to do it.

## What the server does with the two pieces of state

`process-notifications` (in `classicminidiy-supabase`) sends a push for `new_message`
only when `push_new_messages` is true, and then sends to every `push_subscriptions` row
the user owns. So:

- the preference is an on/off switch for **all** the user's browsers;
- each row is one browser that receives push while the switch is on.

The page must show both facts without merging them into one.

## Options considered

| Option             | Summary                                                                                                                          | Decision                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| (a) Derived toggle | ON = preference AND owned device subscription; ON re-subscribes                                                                  | Rejected: device B shows OFF while device A still receives, and OFF on one device stops all   |
| (b) Status line    | Toggle stays the all-browsers preference; a line under it reports when THIS device is not receiving, with a button to turn it on | **Chosen**                                                                                    |
| (c) Two toggles    | Preference toggle plus a "this device" toggle                                                                                    | Rejected for now: more UI, and it needs rules for a device toggle while the preference is OFF |

## Design

### Toggle (unchanged behaviour, new copy)

- ON: `subscribe()` for this device (explicit user action, so the claim RPC is allowed),
  then write `push_new_messages = true`. A failed subscribe reverts the toggle.
- OFF: `unsubscribe()` this device's row by endpoint, then write `push_new_messages = false`.
  Push stops on all browsers because the preference is off. Other browsers' rows are not
  deleted (rule: never delete by `user_id`).
- The description now says the toggle applies to all signed-in browsers.

### Device status line

Shown only when the preference is ON and this device is not receiving:

| State                                                                               | Line                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Not mounted, not supported, check not finished, check failed, toggle or button busy | nothing                                                              |
| Preference OFF                                                                      | nothing                                                              |
| Preference ON, owned subscription on this device                                    | nothing                                                              |
| Preference ON, no subscription, `Notification.permission === 'denied'`              | warning: blocked in this browser's settings (no button)              |
| Preference ON, no subscription, permission `default` or `granted`                   | warning: not active on this device, button "Turn on for this device" |

The button calls `subscribe()` only. The preference is already ON, so it is not written.
If the user blocks the permission prompt, the line changes to the blocked state.

The decision is a pure function, `pushDeviceStatus()` in `app/utils/pushSubscription.ts`,
so it has unit tests without mounting the page.

### Composable changes (`usePushNotifications`)

- `checkExistingSubscription()` reads through `getBrowserPushSubscription()`
  (`serviceWorker.getRegistration()`), not `serviceWorker.ready`. `ready` never resolves
  when no service worker is registered, so the page would wait forever and never show the
  line.
- New readonly `checked` ref: true after a check completes without error. A failed check
  stays unchecked, so the page shows nothing rather than a false "not active".
- New readonly `permission` ref (`NotificationPermission | null`): read at check time and
  after every `subscribe()` attempt.
- The ownership check is unchanged: an unowned subscription is dropped, never claimed.

### Constraints kept

- No endpoint is claimed without an explicit user action (toggle ON or the button).
  The page never re-subscribes on its own, even when permission is already `granted`.
- No row of another device is deleted.
- The status line is gated on a `hasMounted` ref as well as on `checked`, so SSR and the
  first client render emit the same DOM.

## Out of scope

- Telling the user on other pages that push was turned off by an involuntary sign-out.
- A per-device toggle (option c) or a list of the user's registered browsers.
- Server changes. None are needed.

## Implementation plan

1. `app/utils/pushSubscription.ts`: add `pushDeviceStatus()` and its input type.
2. `app/composables/usePushNotifications.ts`: switch the check to
   `getBrowserPushSubscription()`, add `checked` and `permission`.
3. `app/pages/dashboard/notifications.vue`: `hasMounted`, busy flag, status line, button,
   new copy in all ten locales.
4. Tests: `pushDeviceStatus` table, composable `checked`/`permission`, page mount test for
   the line and the button.
5. Update `.claude/rules/push-notifications.md` and `docs/invariants/push-notifications.md`
   (the "toggle shows the preference" trade-off is now handled).
6. `bun run test`.
