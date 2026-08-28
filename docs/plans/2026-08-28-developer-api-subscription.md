# CMDIY Developer API — self-serve MCP keys and subscription (web half)

Status: design approved 2026-08-28. Implementation on `feature/developer-api`.
Private half (schema, RLS, edge functions, Stripe wiring):
`classicminidiy-supabase/docs/plans/2026-08-28-developer-api-subscription.md` — that
document is the contract keystone for the data model; this one covers the web app.

## What this is

The MCP server at `/mcp` becomes a self-serve product:

- **Free tier** — any signed-in account can mint an API key at
  `/dashboard/api-keys`. Free keys get the 7 calculator/reference tools
  (`compression-calculator`, `gearbox-calculator`, `needle-compare`,
  `torque-specs`, `clearances`, `parts-equivalency`, `vehicle-weights`) at a low
  per-key rate limit.
- **Developer API subscription** — $4.99/month or $47.90/year (20% off), sold on
  the web via Stripe Billing. Unlocks all 11 tools (adds `chassis-decoder`,
  `engine-decoder`, `wheel-search`, `color-lookup`) and a 12× rate limit.
- This is a **separate product from the Sustaining Member membership**. Same
  `subscriptions` table, distinct `product_id = 'developer'`, own Stripe
  Product/Prices/webhook per the house one-stack-per-product convention. The two
  must never share a checkout flow, webhook, or price id.

Enforcement is rate-limits only — no monthly quota. Usage is recorded async
(Supabase daily rollup per key/tool for the user-facing chart; a server-side
PostHog `mcp_tool_called` event for product dashboards, sampled at ~10% for
free-tier calls with a `sample_rate` property so dashboards re-weight).

## Tiers

| Tier | Who | Tools | Rate limit (default) |
|---|---|---|---|
| `free` | any account with a key | 7 calculator/reference tools | 20/min (`MCP_RATELIMIT_FREE_MAX`) |
| `developer` | active `developer` subscription | all 11 | 240/min (`MCP_RATELIMIT_DEVELOPER_MAX`) |
| `internal` | env-var keys (`MCP_API_KEY`/`MCP_API_KEYS`) | all 11 | 600/min (`MCP_RATELIMIT_INTERNAL_MAX`) |

The env-var key path survives unchanged as the `internal` tier — it is what
`scripts/test-mcp-transport.sh` (CI pre-deploy gate) and
`scripts/verify-cf-deploy.sh` (`MCP_SMOKE_KEY`) authenticate with, and it is the
ops bootstrap when the DB path is unavailable.

## Key model (web-visible contract)

- Keys are minted server-side only, format `cmdiy_` + 40 base62 chars, shown to
  the user exactly once. The database stores a SHA-256 hash and a display prefix
  (first 12 chars); the plaintext is never persisted.
- Per-user cap: 5 active keys. Revocation is immediate (see cache purge below).
- All key CRUD goes through Nitro server routes with `requireUserAuth` + the
  service client. Client-side PostgREST reads are limited to the owner's key
  metadata and usage rows.

## Hot path (`/mcp` request)

`server/middleware/mcp-auth.ts` (runs before `rate-limit.ts` — alphabetical
global-middleware order, already load-bearing and documented in both files):

1. Env keys checked first, unchanged → `event.context.mcpAuth = { tier: 'internal' }`.
2. Tokens not starting with `cmdiy_` → existing 403, no DB traffic.
3. Failed `cmdiy_` auth attempts are throttled per IP before any DB lookup
   (`consumeRateLimit`, 30/min) so invalid-key floods never become Supabase reads.
4. SHA-256 of the token → `useStorage('cache')` lookup (the KV `CACHE` binding on
   Cloudflare). Positive entries carry `{ keyId, userId, tier, keyPrefix }`
   (TTL 300s); negative entries 403 (TTL 60s).
5. Cache miss → service-client lookup of the key row, then
   `user_has_subscription(userId, 'developer')` decides `developer` vs `free`.
   Result cached; `last_used_at` updated fire-and-forget via `event.waitUntil`.

Tier-change latency: revoke and post-checkout upgrade purge the KV entry
directly (web app and MCP run in the same worker), so both are effectively
instant; a lapsed subscription downgrades within the 5-minute TTL.

`server/middleware/rate-limit.ts` Policy 0 picks the per-key max from
`event.context.mcpAuth?.tier`; a missing context falls back to the free max
(fail conservative). Bucketing (FNV-1a per key) and the per-isolate in-memory
window are unchanged — still a dampener, not a global quota.

## Tool tiering

`server/plugins/mcp-tiering.ts` registers the mcp-toolkit Nitro hook
`mcp:config:resolved({ config, event })`, which fires per request before the MCP
server is built. Rules the implementation must respect:

- `config.tools` elements are **shared module-level definition objects** —
  always shallow-copy, never mutate.
- Hook exceptions are swallowed by the toolkit, so the gate must fail closed by
  construction: missing `event.context.mcpAuth` ⇒ free tier.
- Free tier: paid-only tools stay **visible but gated** — description gains an
  upgrade note pointing at `/developers`, and the handler is replaced with one
  returning an `isError` result telling the caller to subscribe. A direct
  `tools/call` on a gated tool therefore gets a clean, actionable error.
- The canonical free-tool list is `FREE_TOOLS` in `server/utils/mcpTiers.ts`.
  A unit test asserts every name in it matches a file in `server/mcp/tools/` so
  the list cannot drift from reality.

## Usage recording

`recordMcpUsage(event, toolName)` in `server/utils/mcpUsage.ts`, called from a
`withUsage` wrapper applied to every live tool handler in the tiering hook.
Backgrounded with `event.waitUntil`, errors swallowed, never blocks or fails a
tool call:

- Supabase: `increment_mcp_usage` RPC (service role) → `mcp_usage_daily`
  (key, tool, UTC day). Skipped for `internal` (no key row).
- PostHog: hand-rolled `$fetch` capture (same pattern as
  `server/middleware/bot-analytics.ts`; `posthog-node` stays uninstalled).
  Event `mcp_tool_called` `{ tool, tier, key_prefix, sample_rate }`,
  `distinct_id` = user id. Free tier sampled ~10%.

Known v1 caveat: the wrapper sits inside the toolkit's cache wrapper, so KV
cache **hits** on `chassis-decoder` (24h) and `compression-calculator` (1h) are
not recorded. Rate limiting is unaffected (per-request, in middleware).
Accepted; fix paths are documented in the private-half doc.

## Web surfaces

- **`/developers`** (`app/pages/developers.vue`) — public landing/pricing.
  Hero, connection snippet (`https://www.classicminidiy.com/mcp` + Bearer,
  reusing `/mcp/deeplink`), free-vs-paid tool table driven from `FREE_TOOLS` +
  the tool filenames, monthly/yearly toggle, CTA states (logged-out login
  replay `?subscribe=1&interval=…`, unsubscribed → checkout, subscribed →
  dashboard). Post-checkout activation polling via
  `app/composables/useSubscriptionPolling.ts` (extracted from `/membership`'s
  poller), then `/api/developer/refresh` so existing keys upgrade instantly.
- **`/dashboard/api-keys`** (`app/pages/dashboard/api-keys.vue`) — new dashboard
  tab. Key list/create/rename/revoke modeled on
  `app/components/profile/PasskeyManager.vue`, one-time reveal modal, plan badge
  via `get_my_subscription('developer')`, Stripe portal link when
  `platform === 'stripe'` (account-wide no-code portal accepted for v1), usage
  chart (Highcharts, calls/day stacked by tool). State in
  `app/composables/useDeveloperKeys.ts` (`useAuthFetch`).
- **MainNav** — "API & Dev Tools" item in the account dropdown (+ mobile
  drawer), `closeDropdowns()` + nav tracking as with every other item.
- All new components carry full 10-locale `<i18n lang="json">` blocks; daisyUI 5
  + Font Awesome 6 class form only.

## Server routes

`server/api/developer/` — all `requireUserAuth` + service client:
`keys.get` · `keys.post` (cap 409, mint, one-time plaintext return) ·
`keys/[id].patch` (rename) · `keys/[id].delete` (revoke + KV purge) ·
`usage.get` (last 30 days) · `refresh.post` (purge caller's key-cache entries) ·
`checkout.post` (thin proxy → `create-developer-checkout` edge function,
mirroring `server/api/membership/checkout.post.ts`).

## Env / config

- Unchanged worker secrets: `NUXT_MCP_API_KEY(S)` (now = internal tier),
  Supabase service key, PostHog public key.
- New plain worker vars (module-scope `process.env` reads, matching the existing
  rate-limit knobs): `MCP_RATELIMIT_FREE_MAX`, `MCP_RATELIMIT_DEVELOPER_MAX`,
  `MCP_RATELIMIT_INTERNAL_MAX`. The pre-tier `MCP_RATELIMIT_MAX` keeps its
  historical meaning as a fallback for the INTERNAL tier (the traffic it
  originally governed) — an operator's existing tuning is never silently
  reassigned to a different tier.
- Nothing new at build time; nothing new in `runtimeConfig.public`.

## Tests

- `mcp-auth`: all 21 existing cases stay green on the env-key path; new cases
  for cache hit/miss, revoked/unknown keys, negative caching, tier stashing,
  non-`cmdiy_` tokens never reaching the DB, and the failed-auth throttle.
- `mcpTiers`: key format, hash vector, `FREE_TOOLS` ↔ tool-filename drift guard.
- Tiering plugin: free stubs paid tools (isError + upgrade text), paid/internal
  untouched, originals never mutated, missing context ⇒ free.
- Rate limit: tier → max selection.
- `recordMcpUsage`: never throws, never blocks.
- Transport script: env-key path unchanged; add an assertion that the internal
  `tools/list` returns all 11 names. House rule stands: any new tool needs a
  `tools/call` there.

## Rollout

1. Supabase half (migration + edge functions, unreferenced) → regen types here.
2. Stripe product/prices/webhook + edge secrets (manual).
3. Web hot path (ships dark — no DB keys exist yet).
4. Key management UI + nav → free tier soft-launch.
5. `/developers` + checkout → revenue live; PostHog dashboard built in PostHog.

Accepted v1 trade-offs: cache-hit usage undercount on the two cached tools;
per-isolate rate windows; ≤5 min downgrade lag; account-wide Stripe portal
shows both subscriptions (a scoped portal session function is future work);
no self-serve monthly↔yearly switching.
