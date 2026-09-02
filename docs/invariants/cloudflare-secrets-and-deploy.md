# Cloudflare Workers: deploys, build-time vs runtime secrets

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/cloudflare-env.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### A local `wrangler deploy` is not durable — CI owns production

`deploy-cloudflare.yml` deploys `main` on every push, and it deploys the WHOLE
worker. A local `wrangler deploy` from a feature branch therefore survives only
until the next merge to `main`, which silently reverts production to `main`'s
code with no failure anywhere.

This is worth stating because of how it fails when you are debugging. The
symptom you are chasing reappears, the fix "does not work", and grepping your
LOCAL `.output/` proves the offending code is absent — because it is absent
from your build, not from the deployed one. A local deploy was clobbered by a CI
deploy 18 minutes later during the YouTube/axios fix, and that mismatch is what
made axios look innocent when it was in fact the cause.

So: verify a worker fix with `wrangler dev --local` against the built artifact,
and land it through `main` rather than a local deploy. To check what is actually
live, compare `wrangler deployments list` against
`gh run list --workflow=deploy-cloudflare.yml` — if a CI run finished after your
deploy, production is running that run's commit, not yours. `wrangler versions
upload` uploads without taking traffic, which is the safe way to stage a build.

Corollary for diagnosis: esbuild's `__esm` guard is set BEFORE a module's body
runs, so a route chunk whose init throws once is never re-initialised. Its
namespace `default` getter stays `undefined`, and every later request on that
isolate reports `<ns>.default is not a function` instead of the original error.
That message means "this module failed to initialise", not "this module is
missing" — the real error is only visible on the first request after a cold
start.

#### Build-time vs runtime secrets on Cloudflare Workers

**This split is load-bearing. Moving a value across it silently changes whether
production can see it.**

Nuxt compiles private `runtimeConfig` DEFAULTS into the JS bundle at build time.
Nitro then overrides each key at request time from the environment, so on
Workers a value can come from either place — and an absent value is an **empty
string, not an error**. That is the whole failure mode. Before this split the
runtime half did not exist: every private value came from the build env, that
env carried only a subset of the keys, and everything outside the subset
resolved to `''` in production. Chat was the visible casualty on 2026-08-26
(`LANGSMITH_API_KEY` empty, so LangGraph answered `403 Missing authentication
headers`), together with S3 model uploads, `/mcp` and the marketing unsubscribe
HMAC. The build, the deploy and the smoke test were all green. Nothing threw.
That is why the workflow now asserts the runtime half exists rather than
assuming it.

**BUILD-TIME** — must be in `.github/workflows/deploy-cloudflare.yml`'s build
`env:`, because they are compiled into the artifact and no runtime secret can
repair them afterwards:

- Every `NUXT_PUBLIC_*` value. These land in the CLIENT bundle, which the worker
  never touches.
- `POSTHOG_PUBLIC_KEY` — same, via `runtimeConfig.public`.
- `SUPABASE_SERVICE_KEY` — the sitemap sources prerender through
  `getServiceClient()`. **Also a runtime secret**; it is needed in both places.
- `GITHUB_API_KEY`, `YOUTUBE_API_KEY` — `crawlLinks` prerenders `/links` and
  `/maps`, which fetch `/api/{github,youtube}/*` during the build. Unset at
  build time bakes an empty widget into static HTML. **Also runtime secrets.**
- `NUXT_OG_IMAGE_SECRET` — **must be the SAME value in both places.**
  nuxt-og-image resolves its signing secret at BUILD time and falls back to a
  random per-build one when unset, so every `og:image` URL baked into
  prerendered HTML would carry a throwaway signature. The worker verifies with
  its own secret and answers `403 Invalid URL signature` for all of them. A
  mismatch here breaks share previews site-wide and nothing else notices.
- `NUXT_PUBLIC_TURNSTILE_SITE_KEY` — **an unset value is worse than a missing
  one, because @nuxtjs/turnstile substitutes Cloudflare's ALWAYS-PASS test
  sitekey (`1x00000000000000000000AA`) and nothing looks wrong.** The widget
  renders, goes green, and hands back a dummy token; Supabase then verifies it
  against the real secret and refuses with `invalid-input-response`, so sign-in
  fails at the last step with an error that reads like a user problem. The
  production widget is `CMDIY Platform`; a real sitekey starts `0x`, and every
  documented dummy starts `1x`/`2x`/`3x`. The value must also pair with the
  secret configured in Supabase Auth's CAPTCHA settings, which lives outside
  this repo — changing the widget means changing both halves.

  It shipped exactly that way: the Actions secret was bulk-imported from a local
  `.env` holding the test key on 2026-08-26, and email and passkey sign-in were
  dead in production for six days. Note why no gate caught it. The secret
  EXISTED, so a presence check passes — which is why the build check now asserts
  the VALUE. And OAuth does not use Turnstile, so `login_success` kept ticking
  in PostHog while `magic_link_sent` flatlined to zero; the aggregate metric
  hid a total outage of one sign-in method. **A `.env` is a dev file — never
  bulk-import one into Actions or Worker secrets without diffing what each
  value means in production.**

**RUNTIME** — `wrangler secret put`, never the build env. Set them with
`./scripts/set-cf-secrets.sh` (reads your local `.env`, never prints a value):
Supabase service key, LangGraph/LangSmith, GitHub/YouTube, MCP, marketing,
`S3_MODELS_*`, `SHOPIFY_STOREFRONT_TOKEN`, and the optional Microlink/Camino
keys.

**The env var name is derived, not chosen.** Nitro computes a key's override
name as `NUXT_ + snakeCase(key).toUpperCase()`
(`nitropack/dist/runtime/internal/utils.env.mjs`). Two consequences that have
already bitten:

- A key that **already starts with `NUXT_`** is not overridable under its own
  name — a `NUXT_FOO` runtimeConfig key would need `NUXT_NUXT_FOO`. Strip the
  prefix from the KEY so the derived env name comes out as the name everything
  already uses: `ANTHROPIC_API_KEY` in runtimeConfig is fed by
  `NUXT_ANTHROPIC_API_KEY`.
- camelCase keys work but hide their env name (`githubAPIKey` →
  `NUXT_GITHUB_API_KEY`). All private keys are UPPER_SNAKE so the Cloudflare
  secret name is mechanically `NUXT_<KEY>`. **Keep it that way when adding one.**

`NUXT_OG_IMAGE_SECRET` is the one exception to the whole scheme: nuxt-og-image
reads `event.context.cloudflare.env.NUXT_OG_IMAGE_SECRET` directly rather than
through `runtimeConfig`, so that name is literal and no derivation applies. It
is also the one secret whose two halves must hold the same value — see above.

**Module-scope reads are safe here, but only by accident.** With
`nodejs_compat` and a `compatibility_date` past 2025-04-01, workerd populates
`process.env` from the Worker's secrets BEFORE module evaluation — verified on
workerd, not assumed — so Nitro's module-scope `_sharedRuntimeConfig` does pick
them up and an eventless `useRuntimeConfig()` works. Prefer
`useRuntimeConfig(event)` in new code anyway: it is per-request, it costs
nothing, and it does not depend on that ordering holding.

**Raw `process.env.*` reads bypass the `NUXT_` scheme entirely.** These names
are read unprefixed at module scope and need PLAIN Worker vars — a
`NUXT_`-prefixed secret does NOT reach them. All have safe in-code defaults, so
they are tuning knobs rather than secrets; an unset value degrades to the
default rather than failing, which is exactly why a wrong one is hard to notice.

| Name                                                                       | Read in                                                                                       | Default                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| `CHAT_RATELIMIT_MAX` / `_WINDOW_MS` (and the legacy `LANGGRAPH_*` aliases) | `server/middleware/rate-limit.ts`                                                             | 40 / 60 000                |
| `WRITE_RATELIMIT_MAX` / `_WINDOW_MS`                                       | same                                                                                          | 30 / 60 000                |
| `MCP_RATELIMIT_WINDOW_MS`                                                  | same                                                                                          | 60 000                     |
| `MCP_RATELIMIT_FREE_MAX`                                                   | same                                                                                          | 20                         |
| `MCP_RATELIMIT_DEVELOPER_MAX`                                              | same                                                                                          | 240                        |
| `MCP_RATELIMIT_INTERNAL_MAX`                                               | same                                                                                          | 600                        |
| `MCP_RATELIMIT_MAX`                                                        | same                                                                                          | — legacy, see below        |
| `POSTHOG_INGEST_HOST`                                                      | `server/middleware/bot-analytics.ts`, `server/utils/mcpUsage.ts`, `server/utils/chatUsage.ts` | `https://us.i.posthog.com` |
| `MICROLINK_API_URL`                                                        | `server/utils/external-models/render.ts`                                                      | `https://api.microlink.io` |

`MCP_RATELIMIT_MAX` is not a fourth tier — it predates the tiers, when one cap
covered all `/mcp` traffic, and now survives ONLY as the fallback for
`MCP_RATELIMIT_INTERNAL_MAX`. Setting it does not raise the free or developer
tier. Reach for the per-tier name.

The per-tier knobs matter more than "has a default" suggests: without them
documented, "why is the free tier allowing 20 calls" is unanswerable from the
dashboard alone, because nothing there mentions the number.

**`MICROLINK_API_KEY` is NOT in that table, and deliberately so.** It is a
`runtimeConfig` value fed by **`NUXT_MICROLINK_API_KEY`**, forwarded into
`renderExternalPage()` by every caller. It briefly had a second
`process.env.MICROLINK_API_KEY` fallback as well, which is the trap this note
exists to close: one credential with two spellings, where the raw one could
never actually fire (callers always forward a defined string, and an unset
runtimeConfig key is `''`, not `undefined`), so a plain var set to key that call
did nothing at all and reported no error. Set the `NUXT_`-prefixed name only.

`tests/static/worker-env-contract.test.ts` is the enforcement: its
`PLAIN_WORKER_ENV_NAMES` list must match the raw reads exactly, so adding one
without documenting it fails the build, and so does leaving a dead name behind.

**`nuxt build` auto-loads `.env` from the project root.** A local build bakes
whatever is in your `.env` into `.output/`, which is why a local artifact is not
evidence about what CI produces. To reproduce the CI build, pass an explicit
build-time-only file: `bunx nuxi build --dotenv <file>`.
