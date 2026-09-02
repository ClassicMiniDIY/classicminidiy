# Passkey invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/passkeys.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### Passkey invariants

- **`auth.experimental.passkey: true` in `app/composables/useSupabase.ts` is a hard
  requirement, not a feature toggle.** Without it every `registerPasskey()`,
  `signInWithPasskey()` and `auth.passkey.*` call THROWS instead of returning an
  error result (`assertPasskeyExperimentalEnabled` in auth-js), so removing it
  breaks the passkey UI with an exception rather than a graceful fallback.

- **The passkey authentication challenge is captcha-protected; registration is
  not.** `POST /auth/v1/passkeys/authentication/options` answers
  `400 captcha_failed` with no `captcha_token`, so `/login` must hand the
  Turnstile token to `signInWithPasskey()` and keep the button disabled until
  the widget has produced one. The token is single-use and is spent by the
  challenge request — so a ceremony the user then dismisses still burns it, and
  the widget must be reset before a retry. Registration goes the other way:
  `.../registration/options` is Bearer-gated (`401 no_authorization`) and takes
  no captcha, which is why the profile card needs no Turnstile widget.

- **Passkey sign-in never reaches `/auth/callback`.** There is no round trip and
  no code to exchange — auth-js persists the session and emits `SIGNED_IN`
  in-page. `/login` therefore owns the post-sign-in redirect itself, including
  consuming the `cmdiy-post-auth-redirect` stash that `/auth/callback` consumes
  for the OAuth and magic-link paths. Leaving that stash behind lets a later,
  unrelated sign-in replay it.

- **Never branch a template on WebAuthn support during setup.**
  `window.PublicKeyCredential` does not exist during SSR, so
  `usePasskeys().isSupported()` is false server-side and true on the client —
  rendering directly from it is the same structural hydration mismatch
  documented for `/chat`. Both `/login` and `ProfilePasskeyManager` set a
  `mounted`/`passkeyAvailable` ref in `onMounted` and branch on that.

- **A dismissed system prompt is not an error.** Supabase returns cancellation
  as an `error` (a `NotAllowedError`/`AbortError`), the same channel as a real
  failure. `usePasskeys().isCancelled()` separates the two; every caller must
  route through it, or users get an error toast every time they change their
  mind at the Touch ID sheet.

- **The Relying Party Origins list in the Supabase dashboard is what makes
  passkeys work per hostname, and a miss fails in the BROWSER, not at our
  API.** RP ID `classicminidiy.com` covers the subdomain, but the origins
  allowlist must name every origin users actually sign in from — the canonical
  host is `https://www.classicminidiy.com`, and the apex is served by the worker
  too. That config lives outside this repo; adding a new public hostname means
  adding it there too.

- **Passkeys cannot be exercised on `localhost`, and that is a property of
  WebAuthn rather than a missing setting.** An origin must BE the Relying Party
  ID or a subdomain of it, so no `localhost` origin is compatible with RP ID
  `classicminidiy.com` — the dashboard rejects it outright. Verify passkey
  changes on a deployed preview, not `bun run dev`. Everything else on `/login`
  and the profile card still works locally; only the ceremony itself cannot run,
  and reaching it would need a `*.classicminidiy.com` hostname pointed at the
  dev server over HTTPS (WebAuthn requires a secure context, and the
  localhost exemption does not apply once the hostname is not localhost).
