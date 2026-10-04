# DiscourseConnect provider for the community forum

Date: 2026-10-03. Status: proposed design, not implemented. Branch for the build:
`feature/discourse-sso`.
Parent: the forum design lives in the private `classicminidiy-discourse` repo
(`docs/plans/2026-10-03-community-forum.md`). The member-flair sync lives in
`classicminidiy-supabase` (`docs/plans/2026-10-03-discourse-member-flair.md`).
Rules: `.claude/rules/security.md`, `.claude/rules/account-settings.md`.

## Problem

Classic Mini DIY Community (`community.classicminidiy.com`) is a Discourse forum. Its
only sign-in is the classicminidiy.com account, through DiscourseConnect. This site is
the identity provider. Discourse sends the browser here with a signed request, and this
site sends the browser back with a signed answer that says who the user is.

The first proposal was one GET server route, `server/api/discourse/sso.get.ts`. That
cannot work on this site:

- The Supabase session lives in the browser's localStorage, not in a cookie. A
  top-level GET to `/api/...` carries no bearer token, so `requireUserAuth` returns 401
  every time.
- The login and callback pages finish with a client-side `navigateTo(path)`. A stored
  redirect to `/api/...` resolves to the catch-all page and throws a 404.

`/discord/connect` already has this shape and it works: a page reads the session, POSTs
with `Authorization: Bearer`, and then does an external navigation. This design copies
it.

## Protocol (DiscourseConnect)

Discourse sends the browser to `discourse_connect_url` with two query parameters:

- `sso`: base64 of a query string with `nonce` and `return_sso_url`.
- `sig`: lowercase hex HMAC-SHA256 of the `sso` string (the base64 text, not the
  decoded bytes) under the shared secret.

The provider answers by sending the browser to `return_sso_url?sso=<b64>&sig=<hex>`,
where the payload is a query string with at least `nonce`, `external_id` and `email`,
base64-encoded strictly (no line breaks). Discourse checks the signature, accepts each
nonce one time, and expires it after 30 minutes. The nonce is also bound to the
browser's forum session (`discourse_connect_csrf_protection`), so the round trip must
finish in the browser that started it. A magic link opened on another device already
fails at the PKCE step, so this adds no new limit.

## Design

### Flow

```
community.classicminidiy.com  "Log in"
  └─▶ https://classicminidiy.com/discourse/sso?sso=…&sig=…        (page, client-only)
        ├─ no session ─▶ /login?redirect=/discourse/sso?sso=…&sig=…  (existing stash)
        │                 … sign in … ─▶ back to /discourse/sso?sso=…&sig=…
        ├─ no username ─▶ one-time "choose your forum name" step (see Identity)
        └─ POST /api/discourse/sso  { sso, sig }   Authorization: Bearer <access token>
              ◀─ 200 { redirect: "https://community…/session/sso_login?sso=…&sig=…" }
           navigateTo(redirect, { external: true })
```

### Page: `app/pages/discourse/sso.vue`

- States, as in `discord/connect.vue`: `checking`, `signin`, `identity`, `connecting`,
  `unverified`, `error`.
- Read `sso` and `sig` from `route.query`. If either is missing, show `error` with a
  link back to the forum. Do not call the server.
- If not signed in, go to `/login?redirect=${encodeURIComponent(fullPath)}`. The
  existing validator (`app/utils/redirect.ts`) accepts a relative path with a query
  string, and the stash carries it through magic link and OAuth in the same browser.
- On 401 from the server: `signOut({ scope: 'local' })`, then the login redirect (the
  same loop guard as `discord/connect.vue`).
- On 403 `email_unverified`: show `unverified` with the steps to confirm the email. On
  403 `banned`: show the generic suspended message the site already uses.
- `<ClientOnly>` or a `hasMounted` gate for every auth branch
  (`tests/static/hydration-auth-gates.test.ts`).
- `useHead` noindex. Add `/discourse/sso` to the sitemap `exclude` list and give it the
  `prerender: false` + `cache-control: no-store, must-revalidate` route rule that
  `/discord/connect` has. The `sso` value is single-use.
- POST exactly once per page load (a guard flag, not just the state). A second POST
  with the same `sso` reuses the nonce, and Discourse refuses it. On any failure after
  the POST, show "Start again from the forum" with a link to `DISCOURSE_URL`: a fresh
  click there mints a fresh nonce. The nonce lasts 30 minutes, which a first-time user
  can use up across magic link, `/welcome` and the name step.
- PostHog: strip the query from the `$pageview` on this route (and from the
  `/login?redirect=` pageview that carries it), so `sso` and `sig` never reach analytics.
- i18n block with all ten locales.
- Analytics: `forum_sso_started`, `forum_sso_completed`, `forum_sso_failed` (`reason`),
  typed in `types/analytics.ts`.

### Server route: `server/api/discourse/sso.post.ts`

1. Config: `DISCOURSE_CONNECT_SECRET` (private) and `DISCOURSE_URL` (public origin, for
   example `https://community.classicminidiy.com`) in `runtimeConfig`, set by
   `scripts/set-cf-secrets.sh`. Either one unset → 503 `sso_unconfigured`.
2. Body: `{ sso: string, sig: string }`. Reject anything over 2 KB, a `sig` that is not
   64 hex characters, or an `sso` that is not base64 → 400 `bad_request`.
3. Verify `sig` with Web Crypto: `crypto.subtle.importKey('raw', secret, { name: 'HMAC',
   hash: 'SHA-256' })`, then `crypto.subtle.verify('HMAC', key, hexToBytes(sig),
   utf8(sso))`. `subtle.verify` compares in constant time. Do not compare hex strings
   with `===`. Failure → 400 `bad_signature`. Do not use `node:crypto`: this repo
   already does so in `marketingUnsub.ts`, but this route uses the platform API.
4. Decode the payload. `nonce` must be present and non-empty. `return_sso_url` must
   parse as a URL whose origin equals `DISCOURSE_URL` exactly. Anything else → 400.
   The signature already proves Discourse made it; the origin check stops a
   misconfigured or leaked secret from turning this route into an open redirect that
   carries a user's email.
5. `requireUserAuth(event)`. That function verifies the token with GoTrue
   (`auth.getUser`) and returns 401 or 403 for a banned account.
6. Refuse an unconfirmed email: `user.email_confirmed_at` empty, or no `user.email` →
   403 `email_unverified`. This check is load-bearing. Discourse links a DiscourseConnect
   login to an existing account with the same email, and imported archive accounts
   carry their authors' real addresses. An unconfirmed address would let someone claim
   another person's archive posts.
7. Read the profile with the service client: `username`, `display_name`, `avatar_url`
   from `profiles` for `user.id`. Re-check the username here; never trust that the page
   ran the identity step. `username` null, not matching
   `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$`, or on the reserved list (a shared constant that
   mirrors the database list) → 409 `username_required`, and the page shows the identity
   step. Without this, a direct POST with no username lets Discourse invent one.
8. Membership: `getServiceClient().rpc('user_has_subscription', { p_user_id: user.id,
   p_product_id: SUSTAINING_PRODUCT_ID })`. An RPC error → 503, because guessing would
   flip someone's flair. Never read `plan`.
9. Build the payload with `URLSearchParams`:

   | Field | Value |
   |---|---|
   | `nonce` | from the request |
   | `external_id` | `user.id` (Supabase auth user id) |
   | `email` | `user.email` |
   | `username` | `profiles.username` (always set by this point; see Identity) |
   | `name` | `profiles.display_name`, omitted when empty **or** when it equals the email local part (case-insensitive; the `handle_new_user` default) |
   | `avatar_url` | `profiles.avatar_url`, only when it is an absolute `https:` URL |
   | `require_activation` | `false` (the email is confirmed by step 6) |
   | `add_groups` / `remove_groups` | `sustaining_members` in one or the other, from step 8 |

   Booleans must be the strings `true` or `false`; Discourse reads anything else as
   unset. Do not send `admin`, `moderator`, `groups`, `title`, `bio`, `website` or
   `location`. Forum staff and profiles are managed in Discourse. The welcome message
   stays on (it is the forum's onboarding).
10. Sign: base64 of the payload, then hex HMAC-SHA256 of that base64 string. Return
    `{ redirect: return_sso_url + '?sso=' + encodeURIComponent(b64) + '&sig=' + hex }`
    with `cache-control: no-store`. The route never issues a 302 itself, because the
    page called it with `$fetch`.

Rate limiting: POSTs under `/api/` already pass through `server/middleware/rate-limit.ts`.

### Identity: the forum username

Decided 2026-10-03 (Cole): the one-time name step below.

The site has no UI to set `profiles.username`, so almost every account has none (counts
are in the private forum repo). `display_name` defaults to the email local part, which
for an Apple private-relay user is a random string, and for everyone else is part of
their email address made public.

So the first forum sign-in shows one step on `/discourse/sso`: "Choose your forum name".

- Username field. Prefill a suggestion from `display_name` only when `display_name` is
  NOT the email local part (the default `handle_new_user` writes); otherwise leave it
  empty. Cleaned to `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$`.
- Display name field, with the same rule: prefilled only when it is not the email local
  part. Saving the step counts as the user confirming their display name.
- Check with `is_username_available()`, then save both to the user's own `profiles` row
  (the owner UPDATE policy allows it, and `authenticated` holds the UPDATE grant on
  `username` and `display_name`). A unique-violation on save means the name was taken
  in between: show the "taken" message.
- The step shows when `username` is null or the route answers 409. After that, sign-in
  is one redirect.

**Prerequisite (classicminidiy-supabase):** reserved usernames are enforced by the
database, not only by the form. The mechanism and its rollout are in the private repo;
it ships before this route.

Discourse side: `max_username_length` is 30 (its default of 20 would truncate and
collide), and the brand names are on its `reserved_usernames` too. An imported archive
user can hold a name; a new user who picks the same name gets a number appended by
Discourse. The site name stays the source of truth (`auth_overrides_username`).

Discourse setting `auth_overrides_username` is on, so the forum name always follows the
site username. Changing it later on the site renames the user on the forum at the next
sign-in.

### Discourse-side settings this route depends on

Recorded in the forum repo, listed here so a reviewer can check the contract:
`enable_discourse_connect` on, `discourse_connect_url =
https://classicminidiy.com/discourse/sso`, the shared secret, `auth_overrides_email`,
`auth_overrides_username`, `auth_overrides_name` and
`discourse_connect_overrides_avatar` on (`auth_overrides_avatar` does not apply to
DiscourseConnect), `email_editable` off, `max_username_length` 30,
`discourse_connect_overrides_groups` OFF (it would remove every group not in the
payload), local logins off, `logout_redirect = https://classicminidiy.com/`.

### What does not change

- Membership copy, the benefits list, `/membership`, Discord and the YouTube bridge.
  The forum is free and public. The only membership effect is the cosmetic
  `sustaining_members` flair.
- `requireUserAuth`, the login page and `/auth/callback`.

## Out of scope

- Signing a user out of the forum when they sign out of the site. Discourse keeps its
  own session. Logging out of the forum sends the user to the site, not the reverse.
- Mirroring site moderation actions onto the forum. Forum moderation is done in Discourse.
- Forum links in the site navigation and "Discuss this" links. They come at launch.

## Tests

Unit (`tests/unit/server/api/discourse-sso.post.test.ts`, `@vitest-environment node`,
`requireUserAuth` and `getServiceClient` mocked as in
`membership-youtube-sync.post.test.ts`):

1. A valid `sso`/`sig` for a confirmed member returns a redirect to
   `DISCOURSE_URL/session/sso_login`, and its `sig` verifies over its `sso`.
2. The decoded answer has the request's `nonce`, `external_id = user.id`, the email,
   the username, `require_activation=false`, and `add_groups=sustaining_members`, and
   its base64 has no line breaks (`strict` encoding).
3. A non-member gets `remove_groups=sustaining_members` and no `add_groups`.
4. Wrong `sig` → 400 `bad_signature`, and no auth or DB call is made.
5. `sso` changed by one character after signing → 400.
6. `sig` in uppercase hex, or of the wrong length → 400 (strict format).
7. `return_sso_url` on another origin, or `http:` instead of `https:` → 400.
8. No bearer token → 401 (from `requireUserAuth`).
9. `email_confirmed_at` null → 403 `email_unverified`.
10. `user_has_subscription` errors → 503, and no redirect is returned.
11. Secret or URL unset → 503 `sso_unconfigured`.
12. Empty `display_name`, or one equal to the email local part → no `name` field. A
    storage-path `avatar_url` → no `avatar_url` field.
12a. `username` null, malformed, or reserved (`classicminidiy`) → 409 `username_required`,
    and no redirect is returned.
13. The signing helper matches a fixed vector: a known secret and payload give a known
    hex digest (taken from Discourse's own spec example), so a change in encoding
    (base64 line breaks, `+` vs `%2B`) fails here and not in production.

Page (`tests/unit/pages/discourse-sso.test.ts`, as `discord-connect.test.ts`):

14. Signed out → navigates to `/login?redirect=` with the full encoded path and query.
15. Signed in with a username → POSTs with the bearer token, then navigates externally
    to the returned URL.
16. Signed in with no username → shows the identity step and does not POST.
17. 401 → local sign-out, then the login redirect.
18. 403 `email_unverified` → the unverified state.
19. Missing `sso` or `sig` → the error state, no POST.
19a. Re-mount or a double click sends one POST only.
19b. 409 `username_required` → the identity step.
19c. A display name equal to the email local part is not prefilled in either field.

Static: the existing hydration, i18n and auto-import checks cover the page. Add
`/discourse/sso` to the route crawler's auth-page list if it has one.

Manual (staging forum or the real one before launch):

20. Magic link in the same browser, Google and Apple each end on the forum signed in.
21. An Apple private-relay user arrives with the relay address as email.
22. A member gets the flair; a non-member does not; a member who lapses loses it at the
    next sign-in.

## Implementation plan

0. Prerequisite: the reserved-username migration in `classicminidiy-supabase` is in
   production, and `types/database.ts` is regenerated.
1. Branch `feature/discourse-sso` off `origin/main`.
1a. `shared/utils/usernames.ts`: the username regex and the reserved list (a copy of the
   database list; the database trigger stays the enforcement, this copy only gives the
   early 409 and the form message).
2. `server/utils/discourseConnect.ts`: `verifyDiscourseSig`, `signDiscoursePayload`,
   `decodeDiscoursePayload`, all Web Crypto, pure, with tests 4–7 and 13.
3. `server/api/discourse/sso.post.ts` with tests 1–3 and 8–12.
4. `app/pages/discourse/sso.vue` with the identity step and tests 14–19.
5. `nuxt.config.ts`: runtimeConfig keys, route rule, sitemap exclude.
   `scripts/set-cf-secrets.sh`: the two new keys.
6. Code review (Opus), then PR. Set the Worker secrets only after Cole approves; the
   route answers 503 until they exist, so merging first is safe.

## AS-BUILT (2026-10-04, branch `feature/discourse-sso`)

Built as designed, with these differences:

- **Forum URL config.** The origin is public runtimeConfig `discourseUrl`
  (`NUXT_PUBLIC_DISCOURSE_URL`, default `https://community.classicminidiy.com`), because
  the page needs it for the "Start again from the forum" link. The secret is private
  `DISCOURSE_CONNECT_SECRET`. Both are `OPTIONAL` in `scripts/set-cf-secrets.sh`, so the
  script does not fail before the secret exists; the route answers 503 until then. Neither
  is in the deploy workflow's required-secrets check.
- **`return_sso_url`** must be exactly `https://<forum origin>/session/sso_login`: no
  credentials, and no `?` or `#` anywhere in the raw string. The answer URL is built from
  the parsed URL with `searchParams.set('sso', …)` and `searchParams.set('sig', …)`.
- **Input `sso`** may contain line breaks (Ruby `encode64` output, as in Discourse's
  published example). The signature is checked over the text exactly as received. The
  answer is always strict base64.
- **Extra error codes.** A profile read error is 503 `profile_unavailable`; a missing
  profile row is 409 `username_required`; a membership RPC error is 503
  `membership_unavailable`.
- **Session sign-in methods.** Forum sign-in requires a session from one of the site's own
  sign-in methods. When the access token's `amr` claim lists only `password`, the route
  answers 403 `reauth_required`, and the page signs the browser out locally and sends it
  to `/login` (as for a 401). A missing `amr` claim is accepted.
- **Avatar.** `avatar_url` is sent only for an https URL on `auth.classicminidiy.com` or the
  host of `runtimeConfig.public.supabaseUrl`, under `/storage/v1/object/public/avatars/`.
- **Usernames.** Two hyphens in a row (`--`) are refused, and `admins`, `everyone`, `here`,
  `all`, `discobot` and `sys` are reserved, to match the database rule.
- **Suspended account.** The site has no shared suspended message, so the page has its own
  `suspended` state for a 403 without `email_unverified`.
- **POST once.** The guard is `useState` keyed by the `sso` value, so a re-mount sees it.
  It is released on a failed POST (the server issued nothing), which keeps the
  409 → name step → POST and 401 → sign-in → return paths working. A re-mounted page that
  finds a POST still pending waits for it, and shows the start-again link if that POST is
  released without a redirect.
- **Name step.** The display name is required (1–50 characters, as on `/profile/edit`).
  The username suggestion comes from an existing but invalid username first, then the
  display name, and never from the email local part. A `23514` (check_violation) on save
  shows the reserved message; this assumes the database rule raises that code.
- **Analytics.** `types/analytics.ts` does not exist and `useAnalytics().track()` takes any
  string, so `forum_sso_started`, `forum_sso_completed` and `forum_sso_failed` (`reason`)
  are untyped like the other `track()` events.
- **PostHog query stripping** is a `before_send` hook (`app/utils/analyticsRedaction.ts`)
  that covers every event, not only `$pageview`: URL strings in properties, `$set` and
  `$set_once`, and the hand-off query inside autocapture's `$elements_chain`. It writes a
  property only when its value changes. The sign-in link on `/discourse/sso` is
  `ph-no-capture`. posthog-js `get_current_url` is not used: it changes only client-side URL
  targeting, not the URLs captured on events.
- **Requirement:** session replay must be disabled on `/discourse/sso` in PostHog settings.
- **Test 13** uses both of Discourse's published vectors (request and answer) and
  cross-checks them with `node:crypto` inside the test only.
- **Route crawler.** `/discourse/sso` is in `ROUTE_EXPECTATIONS` as
  `{ noindex: true, allowNoH1: true }`, like `/discord/connect`.
- **Prerequisite 0** is handled in `classicminidiy-supabase`; `types/database.ts` was not
  regenerated here (`is_username_available` and `user_has_subscription` were already in it).
