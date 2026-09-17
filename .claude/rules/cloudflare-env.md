---
paths:
  - '.github/workflows/**'
  - 'wrangler.*'
  - 'nuxt.config.ts'
  - 'server/middleware/rate-limit.ts'
  - 'server/middleware/bot-analytics.ts'
  - 'server/utils/chatUsage.ts'
  - 'server/utils/mcpUsage.ts'
  - 'server/routes/t/**'
  - 'server/utils/external-models/**'
  - 'scripts/set-cf-secrets.sh'
  - 'scripts/verify-cf-deploy.sh'
  - 'scripts/verify-ai-crawler-firewall.sh'
  - 'tests/static/worker-env-contract.test.ts'
  - 'tests/static/ci-probe-user-agent.test.ts'
---

# Cloudflare deploy and secrets rules

Detail and the 2026-08-26 outage sequence: `docs/invariants/cloudflare-secrets-and-deploy.md`.

- **CI owns production.** `deploy-cloudflare.yml` deploys the whole worker on every push to `main`; a local `wrangler deploy` is silently reverted by the next merge. Verify worker fixes with `wrangler dev --local` against the built artifact; compare `wrangler deployments list` with `gh run list --workflow=deploy-cloudflare.yml` to learn what is live. A green PR is not evidence of a deployable `main`: the deploy is the only step that runs the production bundler, and a failed deploy leaves the OLD commit serving.
- `<ns>.default is not a function` on a Worker means "this module failed to initialise once" (esbuild `__esm` guard); the real error is only on the first request after a cold start.
- **Build-time vs runtime is load-bearing; an absent value is `''`, not an error.** The two sets OVERLAP; a key can need both. Build env (workflow `env:`): every `NUXT_PUBLIC_*`, `POSTHOG_PUBLIC_KEY`, and, because prerender needs them at build time AND the Worker needs them at runtime, `SUPABASE_SERVICE_KEY`, `GITHUB_API_KEY`, `YOUTUBE_API_KEY` (set these in both places), `NUXT_OG_IMAGE_SECRET` (must be the SAME value at runtime or every baked `og:image` 403s), `NUXT_PUBLIC_TURNSTILE_SITE_KEY` (unset substitutes Cloudflare's always-pass `1x…` test key and sign-in dies at the last step; the workflow asserts the VALUE starts `0x`). Runtime (`wrangler secret put` via `./scripts/set-cf-secrets.sh`, never the build env): Supabase service key, GitHub/YouTube, MCP keys, marketing unsubscribe HMAC, `S3_MODELS_*`, `SHOPIFY_STOREFRONT_TOKEN`, optional Jina Reader/Cults3D/Camino, Anthropic.
- `compatibility_flags` carries `enable_request_signal` for `/api/chat`'s abort wiring (`docs/invariants/chat.md`); removing it silently zeroes `client_disconnect`. Never add `request_signal_passthrough`.
- Never bulk-import a `.env` into Actions or Worker secrets without diffing each value's production meaning.
- **Every CI probe of a production PAGE document sends a named User-Agent.** A zone WAF custom rule (2026-09-16) Managed-Challenges script-client UAs (`curl`, `wget`, `python`, `go`, `scrapy`, `axios`, `node-fetch`) on `GET` page documents; `/api/**`, `/mcp`, `/cdn-cgi/**` and any path with a `.` are spared. curl's default UA is `curl/x.y.z`, so a bare `curl` in `scripts/verify-cf-deploy.sh` gets a 403 challenge page and the smoke step fails AFTER the deploy step has already replaced production. Use `cf_curl` there (it adds `-A "$SMOKE_UA"`), keep `scripts/smoke-routes.mjs` on its own `user-agent`, and never fix a red smoke by loosening the zone rule; `tests/static/ci-probe-user-agent.test.ts` enforces the wrapper and the UA shape.
- Env names are derived: `NUXT_ + UPPER_SNAKE(key)`. Keep private keys UPPER_SNAKE and never start a key with `NUXT_`. `NUXT_OG_IMAGE_SECRET` is the one literal exception (read from `cloudflare.env` directly). Prefer `useRuntimeConfig(event)`.
- Raw `process.env.*` reads need PLAIN Worker vars, not `NUXT_` secrets: the rate-limit knobs (`CHAT_/SEARCH_/WRITE_/MCP_RATELIMIT_*`, per-tier `MCP_RATELIMIT_{FREE,DEVELOPER,INTERNAL}_MAX`; `MCP_RATELIMIT_MAX` is only the internal fallback), `POSTHOG_INGEST_HOST`, `JINA_READER_URL`. `JINA_API_KEY` is NOT one of them; set `NUXT_JINA_API_KEY` only. `PLAIN_WORKER_ENV_NAMES` in `worker-env-contract.test.ts` must match the raw reads exactly.
- `nuxt build` auto-loads `.env`; reproduce CI with `bunx nuxi build --dotenv <file>`.
- Vercel is retired and `vercel.json` is gone: PostHog `/t/*` is `server/routes/t/[...path].ts`; TME host 301s are `server/middleware/tme-redirects.ts` + zone rules.
