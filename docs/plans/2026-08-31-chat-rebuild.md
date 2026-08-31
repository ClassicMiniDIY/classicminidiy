# Chat rebuild — absorb the agent, harden the stack, meter the membership

**Status:** Phase 0 in progress. The Phase 1 decision gate has been answered — see
"What the transcripts say".

## Context

`/chat` is a Nuxt front end talking to an externally hosted LangGraph agent through
an unauthenticated proxy at `server/api/langgraph/**`. It was built before this site
moved to Cloudflare Workers, and before the MCP server, omnisearch and the
subscription stack existed. It is due to become a paid benefit of the Sustaining
Member tier in the native apps, which means it has to defend a paywall and carry
metered spend — neither of which its current shape supports.

Decisions taken up front: absorb the agent into this repo; ship chat as a Sustaining
Member benefit with no new SKU; harden the live stack before replacing it.

## What the transcripts say

The store held **473 non-empty threads and 809 human questions** across 15 months.
It is the only record of what people ask, and it disappears when the deployment is
retired, so it was exported first (`scripts/harvest-chat-threads.mjs`). Aggregates
only below — the export is user data and never enters this repo.

**The assistant almost never uses its own tools.**

| Tool                                                           | Threads it appeared in |
| -------------------------------------------------------------- | ---------------------- |
| `tavily_search` (generic web search)                           | 331                    |
| Shop-bot store CRUD (`search_products`, `save_website_faq`, …) | 159 / 95 / 90 / 75 / … |
| **All 11 Classic Mini MCP tools combined**                     | **11**                 |

Six of the eleven — `torque-specs`, `clearances`, `parts-equivalency`,
`vehicle-weights`, `wheel-search`, `color-lookup` — have **never been called once**.
`torque-specs` is the most-used tool on the `/mcp` endpoint by every other client.

Meanwhile **125 threads (26%) used no tool at all**, answering technical questions
from model knowledge alone, and **144 used only web search**.

**The questions were answerable.** A keyword pass over the 809 questions puts
**19.2% (155)** squarely in a domain one of the existing tools already covers —
gearing, torque, needles, wheels, chassis/engine identification, compression,
colours, parts equivalency, clearances. Roughly 155 answerable questions produced
about 11 tool-using conversations. Median question length is 33 characters, so these
are short, direct lookups: exactly the shape the tools are built for. The 19.2% is a
floor, not a ceiling — a keyword heuristic over very short strings undercounts.

**73% of threads are a single human turn** (343 of 473). People ask once and leave.

### What this settles

The gate asked whether the engagement problem is an architecture problem. It is a
**tool-selection problem**, which the rebuild addresses directly but which is not
_caused_ by the transport, the model, or the hosting.

Two things it rules out:

- **It is not the `CMDIY_API_KEY` failure.** The upstream agent defaults that key to
  the string `"."` inside a bare try/except that falls back to an empty tool list, so
  a wrong key would silently ship a bot with no Classic Mini tools at all. Five
  different MCP tools appear in the transcripts, so the wiring works. The agent simply
  does not reach for it.
- **It is not that people ask out-of-scope questions.** A fifth of them are squarely
  in scope and got a web search instead of the authoritative answer sitting one tool
  call away.

What it points at is the **system prompt**, which lives in LangSmith Hub under the
name `cmdiy-shop` rather than in git. It is a shop-assistant prompt, and the agent has
been behaving accordingly — `save_product_info` and `save_website_faq` fired in 170+
threads, writing to a global, cross-conversation store, for a site with no product
catalogue.

**Cheapest possible experiment, available today:** the prompt is editable in the
LangSmith UI with no deploy. Rewriting it to prefer the Classic Mini tools tests the
whole hypothesis in an afternoon. Do that before, not instead of, the rebuild — the
rebuild is still right (see below), but this tells us how much of the gap is prompt.

## Why rebuild anyway

Even with a better prompt, the current shape cannot carry a paid feature:

- The agent lives in a private repo, its prompt is not in git, and its retrieval layer
  (`get_enhanced_system_prompt`) is defined but never called.
- It is a stock `create_agent` ReAct loop with no custom graph topology, so LangGraph
  is paying a platform and Python-service tax for a feature nothing here uses.
- The tools it needs live inside this Worker; it reaches them back over public HTTP.
- Self-hosting the LangGraph platform is Enterprise-tier only, so there is no exit
  short of a rewrite.

## Phases

### Phase 0 — harden in place (in progress)

No agent changes. Everything here survives the rebuild.

| Item                                                | State                                           |
| --------------------------------------------------- | ----------------------------------------------- |
| Remove wildcard CORS from the stream route          | done, `tests/static/no-wildcard-cors.test.ts`   |
| Encode SSE chunks as `Uint8Array`                   | done                                            |
| Delete the dead assistant-id runtimeConfig read     | done                                            |
| Server tests for `stream.post.ts`                   | done, 14 cases                                  |
| Decouple the links rail from `tavily_search`        | done                                            |
| `chat_run_completed` telemetry incl. `tools_called` | done, `server/utils/chatUsage.ts`               |
| Remove BotID from the chat paths                    | done                                            |
| Zone rate-limit rule on `POST /api/langgraph/*`     | already existed; now asserted on its own merits |
| Harvest the thread store                            | done                                            |
| Per-reply thumbs up/down                            | outstanding                                     |

Two notes worth keeping:

- **BotID never protected this path.** `botid/server` is aliased to a fail-open stub
  on Cloudflare whose own contract says no route may depend on it — and the two POST
  routes that actually spend money never called it anyway. The real control was, and
  remains, the zone rate-limit rule plus the in-app limiter.
- **`scripts/verify-cf-ratelimit.py` derived its targets solely from `checkBotId()`
  call sites**, so removing those calls would have silently stopped asserting the
  chat's zone rule while the reason for it was untouched. It now also reads an
  explicit `ALWAYS_REQUIRED` list. A route earns a zone rule by what it costs an
  abuser to call, not by which library it imports.

### Phase 1 — the in-Worker agent

Vercel AI SDK, not LangGraph.js (no topology to justify it) and not the Cloudflare
Agents SDK (built for durable stateful agents; this is stateless request/response).
`streamText` _is_ the ReAct loop, and adopting it means deleting the 665-line
hand-ported streaming composable rather than maintaining it.

- **Tools in-process.** `defineMcpTool` in `@nuxtjs/mcp-toolkit` is an identity
  function, so each `server/mcp/tools/*.ts` file is a plain
  `{description, inputSchema, handler}` object that bridges to an AI SDK tool with no
  logic duplicated. Pin the registry to the filesystem with a static test. Give the
  agent the paid-only tools too — the Developer API paywall gates third-party
  programmatic access, not our own assistant.
- **Retrieval: omnisearch as a twelfth tool. No Vectorize.** The corpus is structured
  data reached by purpose-built tools; a torque lookup is an exact-match table query
  and embedding it is strictly worse. The upstream's "semantic search" was never
  semantic — no index was ever configured — and nobody noticed in 15 months.
- **Prompt in git**, static block first so Anthropic's prefix cache can hit.
- **Drop the shop-bot store tools.** There is no store, and their writes went to a
  global namespace every conversation reads.

Given the transcript findings, the prompt and tool-selection work is the highest-value
part of this phase, not the plumbing.

### Phase 2 — replace the transport

Ship Phase 1 behind a `runtimeConfig.public` flag at a new `server/api/chat.post.ts`
while the old path still serves, then delete: the streaming composable, the 8 proxy
routes, `server/utils/langgraph.ts`, `usePersistentThread`, the SDK dependency, both
Worker secrets, and `server/api/admin/threads/*` plus `app/pages/admin/threads/*`
(they read a store that will no longer exist — harvest first).

Thread state becomes client-owned; `useChatHistory` widens from storing ids to storing
messages. Keep all 9 UI components, and change the message shape once rather than
writing a shim.

### Phase 3 — metering and the membership gate

Mirrors the MCP tiering pattern, with one deliberate inversion: `chat-auth` **fails
open to the lowest tier**, where `mcp-auth` fails closed. For a paid API uncertainty
means deny; for a public chat it means treat as anonymous, because denying breaks the
surface's reason to exist.

`/api/chat` is optionally authenticated and must never _require_ auth. A 401 is never
a valid response; an exhausted quota is a 429 with an upgrade pointer. Signed-in usage
is counted exactly in Postgres; anonymous usage is bounded at the edge only, never in
a table.

Sell **capability, not model** — synced history, higher quota — rather than upgrading
members to a more expensive model, which would consume the entire per-member budget
for a difference nobody perceives on a spec lookup.
