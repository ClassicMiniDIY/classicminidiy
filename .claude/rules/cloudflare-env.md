---
paths:
  - '.github/workflows/**'
  - 'wrangler.*'
  - 'nuxt.config.ts'
  - 'server/middleware/rate-limit.ts'
  - 'server/middleware/bot-analytics.ts'
  - 'server/utils/external-models/**'
  - 'scripts/set-cf-secrets.sh'
  - 'tests/static/worker-env-contract.test.ts'
---

# Cloudflare deploy and secrets rules

Detail and the 2026-08-26 outage sequence: `docs/invariants/cloudflare-secrets-and-deploy.md`.

- **CI owns production.** `deploy-cloudflare.yml` deploys the whole worker on every push to `main`; a local `wrangler deploy` is silently reverted by the next merge. Verify worker fixes with `wrangler dev --local` against the built artifact; compare `wrangler deployments list` with `gh run list --workflow=deploy-cloudflare.yml` to learn what is live. A green PR is not evidence of a deployable `main`: the deploy is the only step that runs the production bundler, and a failed deploy leaves the OLD commit serving.
- `<ns>.default is not a function` on a Worker means "this module failed to initialise once" (esbuild `__esm` guard); the real error is only on the first request after a cold start.
- **Build-time vs runtime is load-bearing; an absent value is `''`, not an error.** Build env (workflow `env:`): every `NUXT_PUBLIC_*`, `POSTHOG_PUBLIC_KEY`, `SUPABASE_SERVICE_KEY`, `GITHUB_API_KEY`, `YOUTUBE_API_KEY` (prerender needs them), `NUXT_OG_IMAGE_SECRET` (must be the SAME value at runtime or every baked `og:image` 403s), `NUXT_PUBLIC_TURNSTILE_SITE_KEY` (unset substitutes Cloudflare's always-pass `1x…` test key and sign-in dies at the last step; the workflow asserts the VALUE starts `0x`). Runtime: `wrangler secret put` via `./scripts/set-cf-secrets.sh`.
- Never bulk-import a `.env` into Actions or Worker secrets without diffing each value's production meaning.
- Env names are derived: `NUXT_ + UPPER_SNAKE(key)`. Keep private keys UPPER_SNAKE and never start a key with `NUXT_`. `NUXT_OG_IMAGE_SECRET` is the one literal exception (read from `cloudflare.env` directly). Prefer `useRuntimeConfig(event)`.
- Raw `process.env.*` reads need PLAIN Worker vars, not `NUXT_` secrets: the rate-limit knobs (`CHAT_/WRITE_/MCP_RATELIMIT_*`, per-tier `MCP_RATELIMIT_{FREE,DEVELOPER,INTERNAL}_MAX`; `MCP_RATELIMIT_MAX` is only the internal fallback), `POSTHOG_INGEST_HOST`, `MICROLINK_API_URL`. `MICROLINK_API_KEY` is NOT one of them; set `NUXT_MICROLINK_API_KEY` only. `PLAIN_WORKER_ENV_NAMES` in `worker-env-contract.test.ts` must match the raw reads exactly.
- `nuxt build` auto-loads `.env`; reproduce CI with `bunx nuxi build --dotenv <file>`.
- Vercel is retired and `vercel.json` is gone: PostHog `/t/*` is `server/routes/t/[...path].ts`; TME host 301s are `server/middleware/tme-redirects.ts` + zone rules.
