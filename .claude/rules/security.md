---
paths:
  - 'server/api/chat.post.ts'
  - 'server/middleware/**'
  - 'server/mcp/**'
  - 'server/utils/agentTools.ts'
  - 'server/utils/shopifyCatalog.ts'
  - 'server/utils/chatUsage.ts'
  - 'server/utils/mcpUsage.ts'
  - 'server/utils/supabase.ts'
  - 'server/api/admin/queue/**'
  - 'app/components/Chat/**'
  - 'app/pages/chat*.vue'
  - 'scripts/test-mcp-transport.sh'
  - 'scripts/verify-cf-ratelimit.py'
---

# Security and chat rules

Detail and incident history: `docs/invariants/security.md`. Chat hydration: `CLAUDE.md`.

## `/api/chat`

- **Intentionally UNAUTHENTICATED; never add `requireUserAuth`, a 401 is never valid.** Exhausted quota is a 429 with an upgrade pointer. Abuse is held by `server/middleware/rate-limit.ts` (40 req/60s, `CHAT_RATELIMIT_*`, legacy `LANGGRAPH_*` still read) and a Cloudflare ZONE rule that does not follow code changes; `scripts/verify-cf-ratelimit.py` fails when they diverge, runbook `docs/runbooks/2026-08-31-chat-zone-rate-limit.md`.
- **The tier gate fails OPEN** (`server/middleware/chat-auth.ts`): no/invalid token or Supabase down resolves to `anonymous`, membership RPC error to `free`. Do not make it fail closed by analogy with `mcp-auth`. A banned account resolves to `anonymous` on purpose.
- The agent runs IN this Worker (Vercel AI SDK v7 + Anthropic) and calls the eleven `/mcp` tools in-process via `server/utils/agentTools.ts`. `tools_called` on `chat_run_completed` is the only wiring signal: an empty array on a real question means tools are down.
- `store-search` uses a Shopify STOREFRONT token only (`X-Shopify-Storefront-Access-Token`, asserted in `tests/unit/server/utils/shopifyCatalog.test.ts`); two read operations, no cart mutations. Failure reports `store-search:unavailable`/`:not-configured` into `tools_called`, never a thrown error and never silence. Prompt guidance is scoped by purchase INTENT, not topic.
- `/chat`'s full-height shell is CSS-only (`.chat-shell` + `:has()` in `main.css`), never `useHead({ bodyAttrs })`, which made nuxt-schema-org 500 the route on cold boot.

## `/mcp`

- Auth fails CLOSED; keys only from `MCP_API_KEY`/`MCP_API_KEYS`. The old default `dev-mcp-key-classic-mini-diy` is in public history and must never be re-accepted.
- Only `scripts/test-mcp-transport.sh` tests the real transport (unit tests stub `defineMcpTool`; the provider is chosen at build time from the Nitro preset). **Adding a tool means adding a `tools/call` there.** It is the pre-deploy gate.
- `MCP_FREE_TIER_KEY` must live on a dedicated account that never holds a subscription (a comp makes it developer-tier). An unset key SKIPS the tier section silently; re-point it, never unset it. Read the `free tier gates N of M tools` PASS line, not the assertion total.
- A cached tool with an object-valued argument needs an explicit `getKey` (default key stringifies objects to `[object Object]`); `gearbox-calculator` is uncached for this reason.

## Keys and allowlists

- `SUPABASE_SERVICE_KEY` is read only via `server/utils/supabase.ts#getServiceClient`; never in `app/`, never public runtimeConfig.
- Edit-suggestion field keys are raw snake_case column names written by the browser; `EDIT_TARGETS` in `server/api/admin/queue/approve.post.ts` is the security boundary. Adding a `SuggestEditModal` field means adding the column there; never add ownership, moderation, audit columns or asset paths.
