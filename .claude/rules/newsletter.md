---
paths:
  - 'app/pages/newsletter.vue'
  - 'server/api/newsletter/**'
  - 'server/routes/email/**'
  - 'server/utils/mailingListConfirm.ts'
  - 'server/utils/marketingUnsub.ts'
  - 'server/utils/turnstile.ts'
  - 'app/pages/admin/marketing.vue'
---

# Newsletter rules

Server contract (table, RPCs, token, opt-out scope): `classicminidiy-supabase` CLAUDE.md
"Mailing list invariants" and its `docs/plans/2026-10-06-ghost-retirement-phase2-mailing-list.md`.

- **Double opt-in only.** `POST /api/newsletter/subscribe` never subscribes; it verifies
  Turnstile and asks the `send-marketing-email` edge function (`mailing_list_signup`) to
  send a confirm link. Only `POST /email/confirm` subscribes (`mailing_list_confirm`).
- **The subscribe route answers `{ ok: true }` for every list state.** Never add a
  response that tells a visitor an address is already subscribed or suppressed. Only an
  undeliverable address is a 400.
- **GET never writes** on `/email/unsubscribe` or `/email/confirm`: mail scanners prefetch
  links. The GET shows a POST form with the same signed query.
- **Confirm tokens carry the `confirm:` prefix** inside the HMAC
  (`server/utils/mailingListConfirm.ts`); unsubscribe tokens are the HMAC of the bare
  email (`marketingUnsub.ts`). Keep them distinct, and change the edge function in the same
  release (the golden vector in `tests/unit/server/utils/mailingListConfirm.test.ts` is
  shared with the backend test).
- **Turnstile is verified server-side** with `runtimeConfig.turnstile.secretKey`
  (`NUXT_TURNSTILE_SECRET_KEY`, runtime-only; `nuxt dev` falls back to Cloudflare's test
  secret). Unset in production = the subscribe route answers 503. The widget renders with
  `action: 'newsletter'` and the route requires that action, because login shares the
  site key. `remoteip` comes from `clientIp()` (cf-connecting-ip), never X-Forwarded-For.
- **`/email/confirm` passes the link's issue time** (`x` minus 7 days) to
  `mailing_list_confirm`, which answers `stale` for a link older than the latest
  unsubscribe. Show the "sign up again" page, never "You're subscribed".
- **`/email/unsubscribe` also calls `mailing_list_unsubscribe`.** Its suppression upsert
  is `ignoreDuplicates` and writes nothing when a bounce row exists, so the database
  trigger alone would leave the newsletter row subscribed.
- **Map only the edge's own `invalid_email` to a 400.** The edge answers other 400s too
  (`Unknown action` before its deploy); those are 502. Deploy the edge function before
  this web code.
- The admin composer shows `audience_counts.mailing_list` when present; older sends lack
  the key, so read it as optional.
