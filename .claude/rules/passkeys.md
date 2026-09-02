---
paths:
  - 'app/composables/usePasskeys.ts'
  - 'app/composables/useSupabase.ts'
  - 'app/pages/login.vue'
  - 'app/pages/auth/**'
  - 'app/components/profile/*Passkey*'
---

# Passkey rules

Detail: `docs/invariants/passkeys.md`.

- `auth.experimental.passkey: true` in `useSupabase.ts` is a hard requirement; without it every passkey call THROWS.
- The authentication challenge is captcha-protected (needs the Turnstile token, single-use, reset the widget before a retry); registration is Bearer-gated and takes no captcha.
- Passkey sign-in never reaches `/auth/callback`; `/login` owns the post-sign-in redirect and must consume the `cmdiy-post-auth-redirect` stash itself.
- Never branch a template on WebAuthn support during setup (`window.PublicKeyCredential` is absent in SSR); set a ref in `onMounted`.
- A dismissed system prompt arrives as an `error`; route every caller through `usePasskeys().isCancelled()`.
- The Relying Party Origins list lives in the Supabase dashboard (outside this repo) and must name every origin users sign in from. Passkeys cannot run on `localhost` at all; verify on a deployed preview.
