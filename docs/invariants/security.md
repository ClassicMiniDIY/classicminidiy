# Security invariants (chat, MCP, admin edit allowlists)

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/security.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### Security Invariants

Load-bearing contracts — don't "fix" these without understanding why they're this way:

- **`/api/chat` is intentionally UNAUTHENTICATED, and must never _require_ auth.**
  The assistant has to work for every anonymous visitor — that is the point of
  the surface and why it is indexed. Do NOT add `requireUserAuth` to it. When
  membership metering lands, the route resolves identity _if present_ and
  applies a tiered quota; **a 401 is never a valid response from this route**,
  and an exhausted quota is a 429 carrying an upgrade pointer, the same posture
  as the MCP free-tier gated result.

  Abuse is held by two things, and only one of them is in this repo: per-IP rate
  limiting in `server/middleware/rate-limit.ts` (default 40 req/60s, tune via
  `CHAT_RATELIMIT_MAX` / `CHAT_RATELIMIT_WINDOW_MS`; the old `LANGGRAPH_*` names
  are still read so a value configured in Cloudflare does not silently revert),
  and a Cloudflare **zone** rate-limit rule that runs at the edge before the
  Worker bills anything. **That zone rule does not follow a code change.** Moving
  or renaming this route without updating the rule leaves the live path
  unprotected while everything still looks green —
  `scripts/verify-cf-ratelimit.py` exists to fail in exactly that case, and
  `docs/runbooks/2026-08-31-chat-zone-rate-limit.md` is the fix. The privileged
  `NUXT_ANTHROPIC_API_KEY` stays server-only (private `runtimeConfig`).

- **`/api/chat`'s tier gate fails OPEN, and that is the deliberate opposite of
  `/mcp`'s.** `server/middleware/chat-auth.ts` resolves membership when a token
  is present, but every uncertainty resolves DOWNWARD to a working tier: no
  token, an unverifiable token, or Supabase being unreachable all yield
  `anonymous`, and a membership RPC error yields `free` rather than denying an
  account that is already proven. A Supabase outage therefore degrades a member
  to anonymous limits — it does not 503 the chat. Do NOT "fix" this into failing
  closed by pattern-matching on `mcp-auth` next door: for a paid API uncertainty
  must mean deny, but for a public assistant it must mean "treat as anonymous",
  because denying breaks the surface's entire reason to exist. A banned account
  is the one case that resolves to `anonymous` on purpose rather than by
  degradation.

- **The chat's `store-search` tool uses a Shopify STOREFRONT token, never an
  Admin token.** `/api/chat` is unauthenticated by the invariant above and the
  MODEL decides when a tool fires, so a credential behind it is reachable by
  anyone on the internet through a prompt. A Storefront token is public-scoped
  and read-only over published products; an Admin token can read customers and
  orders, which makes it a data-exfiltration path rather than a feature. The
  header name is the tell — `X-Shopify-Storefront-Access-Token`, never
  `X-Shopify-Access-Token` — and
  `tests/unit/server/utils/shopifyCatalog.test.ts` asserts it.

  The surface is exactly two read operations, keyword search and one product by
  handle. Shopify's own Storefront MCP ships cart mutations; do not bridge them.

  It fails to an EMPTY result with an explicit `checked: false`, never a thrown
  error — but never silently. A failed lookup reports `store-search:unavailable`
  (or `:not-configured`) into `tools_called` on `chat_run_completed`, because
  `store-search` appearing in that array cannot otherwise distinguish "the store
  had nothing" from "the store was unreachable". That distinction is the whole
  point: the old agent's `/mcp` fetch fell back to an empty tool list inside a
  bare try/except and demoted the assistant to generic web search for fifteen
  months with no signal in either usage sink. If those markers start appearing,
  the store lookup is broken; a stale `API_VERSION` in
  `server/utils/shopifyCatalog.ts` lands there too, so check it first.

  **Prompt guidance for it is scoped by INTENT, not topic** — "the reader is
  asking to purchase, not asking a specification". Scoping by topic ("wheels" ->
  search the store) turns every technical answer into an advert, which is
  precisely what the `cmdiy-shop` prompt did. Design doc:
  `docs/plans/2026-09-01-shopify-catalog-tool.md`.

- **`/mcp` auth fails closed.** Valid keys come ONLY from `MCP_API_KEY` / `MCP_API_KEYS` env vars — there is no hardcoded/default key. The old `dev-mcp-key-classic-mini-diy` default is in public git history and must never be re-accepted in any environment. For local dev, set `MCP_API_KEY` in `.env`.
- **`/mcp` is only truly tested by `scripts/test-mcp-transport.sh`.** The unit
  tests under `tests/unit/server/mcp/` stub `defineMcpTool` and call `.handler()`
  directly, so they exercise tool logic and nothing else — no routing, no auth
  middleware, no `@nuxtjs/mcp-toolkit`, no JSON-RPC framing, and no transport
  provider. mcp-toolkit chooses that provider at **build time** from the Nitro
  preset, so the Cloudflare path exists only in a `cloudflare_module` build and
  in no test that runs in-process; a Nuxt/Vitest e2e test would exercise the Node
  provider and prove nothing about production. That gap is how #721 shipped: every
  authenticated call 500'd for months while the whole suite stayed green. The
  transport script speaks real JSON-RPC to the built artifact under
  `wrangler dev --local` and runs as a pre-deploy gate in
  `deploy-cloudflare.yml`. **Adding a tool means adding a `tools/call` for it
  there** — a tool with only unit tests is untested against the protocol that
  actually serves it.
- **The free-tier fixture key must live on a dedicated account that will never
  hold a subscription.** `MCP_FREE_TIER_KEY` arms the `free-tier gating`
  section of that script, which is the ONLY check anywhere that can tell a
  working tier gate from one that never ran: every other assertion in the
  script authenticates with the env key, which is the `internal` tier and sees
  all eleven tools by design. A key's tier is a property of its OWNER, decided
  per request by `user_has_subscription(owner, 'developer')` — so granting that
  account a developer subscription, **an admin comp included**, makes the
  fixture developer-tier, and the section then fails on a fixture rather than a
  fault. Point the secret at an account nobody uses: never a real person's, and
  never an admin's.

  **The repair is the dangerous half, not the break.** Deleting the secret
  clears the failure and leaves every check green, because an unset key makes
  the section SKIP — the gate quietly drops from 33 assertions to 30 and
  nothing anywhere says the tier boundary stopped being covered. That is the
  full 2026-08-31 sequence: the key's owner was comped onto the developer tier
  deliberately (to give an MCP client the paid tools), the gate failed, and the
  secret was deleted to unblock deploys. So do not revoke a deliberate comp to
  satisfy this check, and do not unset the secret to silence it — re-point it
  at a subscription-free account. A healthy run logs a
  `free tier gates N of M tools` PASS naming the four paid-only tools; an
  unarmed one prints the `MCP_FREE_TIER_KEY unset` skip note in its place.
  Read those two lines rather than the trailing assertion total — that number
  moves whenever a tool or an assertion is added, so a count written down here
  would be wrong by the next PR.

- **A `/mcp` tool that caches and takes an OBJECT-valued argument must set an
  explicit `getKey`.** The toolkit's default key is
  `Object.values(args).map(String).join(':')`, so every object stringifies to
  `[object Object]` and all of them share one cache entry. `gearbox-calculator`
  is uncached for this reason: its `tire_type` is an object, and two tire sizes
  would have collided on one cached top speed.
- **`SUPABASE_SERVICE_KEY` is server-only.** It lives in private `runtimeConfig` and is read only via `server/utils/supabase.ts#getServiceClient`. Never import that into `app/` or move the key to `runtimeConfig.public`.
- **Edit-suggestion field keys are raw column names, gated by an allowlist.** `SuggestEditModal`'s `editable-fields` keys (and the matching `current-data` keys) are written verbatim into `submission_queue.data.changes` **by the browser**, and `applyEditSuggestion()` in `server/api/admin/queue/approve.post.ts` maps them straight onto the UPDATE — there is no camelCase-to-snake_case layer, so every key must be a real snake_case column on the mapped table. Because that JSON is client-controlled, `EDIT_TARGETS` in that file is the security boundary: it is what stops a crafted suggestion from rewriting `status`, `submitted_by`, `reviewed_by`, `legacy_id` or `legacy_submitted_by_email` the moment an admin approves. **Adding a field to any `SuggestEditModal` call site means adding the column name to `EDIT_TARGETS[targetType].columns` too**, or approval is refused outright. Never add ownership/moderation/audit columns or asset paths to those lists. Past instances of getting this wrong: `bodyNum`/`engineNum` (registry, fixed for supabase#65) and `offset` vs `offset_value` (wheels).
