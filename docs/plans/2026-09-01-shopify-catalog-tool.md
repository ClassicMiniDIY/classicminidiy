# Shopify catalogue as a chat tool

**Status:** proposed
**Date:** 2026-09-01
**Depends on:** `docs/plans/2026-08-31-chat-rebuild.md` (the in-Worker agent)

## What this is

Give the CMDIY assistant a **read-only** view of the Shopify store, so "where do I
buy a set of Minilites" gets a real product and a link, instead of the assistant
either guessing or saying nothing.

## What this is not

It is not the old shop bot. The prompt it replaced (`cmdiy-shop`, in LangSmith Hub)
made the assistant a store assistant first and a technical reference second, and
the measurement is unambiguous: across 473 real conversations, generic web search
appeared in 331 threads and all eleven Classic Mini tools combined in 11, with six
never called once in fifteen months. Anything here that pushes the assistant back
toward selling is a regression, not a feature.

So the design constraint is not "add products". It is **add products without
changing what the assistant is**.

## Non-negotiables

### Storefront API, never Admin API

There is no Shopify credential in this repo today — the marketing audience builder
proxies to a Supabase edge function, so the token lives there. Whatever we do
introduces a new credential to the Worker, and it must be a **Storefront** token:
public-scoped, read-only, published products only.

The Admin token can read customers and orders. `/api/chat` is unauthenticated by
documented invariant — anyone on the internet can reach it. An Admin token behind
an unauthenticated, model-driven tool call is a data-exfiltration path, not a
feature. It must never be added to the Worker for this purpose.

### Read-only. No cart, no checkout, no customer data

Shopify's Storefront MCP does ship cart tools (`update_cart` and friends). Do not
bridge them. The tool surface is exactly two operations:

- search the catalogue by keyword
- fetch one product by handle

A model deciding to mutate a cart on a visitor's behalf is a class of bug this
codebase has no reason to open.

### UTM tagging happens in code, not in the prompt

The old prompt instructed the _model_ to append
`utm_source=diy_chat_bot&utm_medium=chat&...` to every store link. Models forget,
and the failure is invisible: you get partial attribution that is
indistinguishable from organic traffic, so the numbers look plausible and are
wrong.

Build the tagged URL in the tool's return value. The model cannot forget what it
never had to do.

`tests/unit/server/agent/prompt.test.ts` already asserts `utm_source` never
appears in the prompt; keep that assertion.

### Degrade to "no results", never to an error

The precedent to avoid is precise. The old agent fetched `/mcp` over HTTP inside a
bare `try/except` that fell back to an **empty tool list**, so a bad key silently
demoted the assistant to generic web search with no error anywhere — and neither
usage sink could see it, because `recordMcpUsage` skips the internal tier and
PostHog was told not to emit for it.

This tool makes an outbound call to Shopify. It therefore needs:

- a hard timeout (2s), well inside the chat's own budget
- failure returns an empty result set, not a thrown error
- the failure is **counted**, so it cannot be silent

`tools_called` on `chat_run_completed` (`server/utils/chatUsage.ts`) already
reports which tools fired per run. A store tool that stops appearing is the
signal; make sure a failure path is distinguishable from "nobody asked about
products".

## Options considered

| #   | Approach                                             | Trade-off                                                                                                                                                                   |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **In-process tool over the Storefront API**          | Live price and stock; one more entry in the tool catalogue; one new credential and one outbound call in the chat path. **Recommended.**                                     |
| 2   | Index the store as a `store` surface in `omnisearch` | No credential in the hot path, no live dependency, results rank alongside everything else and `site-search` already covers it — but price and stock go stale between syncs. |
| 3   | Shopify's hosted Storefront MCP over HTTP            | Least code, but an external hop in the render path and no control over which tools it exposes (see cart, above).                                                            |
| 4   | Do nothing                                           | The assistant stays a pure reference. Legitimate — see "The question worth answering first".                                                                                |

**Recommendation: 1**, because for a shop, a stale price is worse than a slow
answer. Option 2 is the fallback if the outbound call proves unreliable in
practice.

## Sketch

```
server/agent/tools.ts          + storeSearchTool()
server/utils/shopifyCatalog.ts   searchCatalogue(query, limit)  <- new
                                 - Storefront GraphQL, products(query:)
                                 - returns { title, price, available, url }
                                 - url built WITH utm params, in code
                                 - 2s timeout, [] on any failure
nuxt.config.ts                 + SHOPIFY_STOREFRONT_TOKEN, SHOPIFY_STORE_DOMAIN
                                 (private runtimeConfig -> NUXT_ prefixed secrets)
server/agent/prompt.ts         + one TOOL_GUIDANCE entry
```

**Nothing picks this tool up automatically — that claim was wrong in an earlier
draft of this doc and is the most expensive mistake available here.**

`AGENT_MCP_TOOL_NAMES` is `Object.keys(DEFINITIONS)` over `server/mcp/tools/`,
and `AGENT_TOOL_NAMES` is that list plus a hand-written `'site-search'`.
`tests/static/agent-tool-registry.test.ts` walks `server/mcp/tools` too. So a
tool defined in `server/agent/tools.ts` — which is where the sketch above puts
it, alongside `site-search` — is invisible to the derivation, to the registry
test, and therefore to `toolCatalogue()` and the "names every tool" unit test.

The result would be a tool the model holds but the prompt never mentions, with
every test green. That is precisely the 11-calls-in-473-threads failure this
whole rebuild exists to correct, re-shipped silently.

So either register it under `server/mcp/tools/` (and get the derivation and the
transport gate for free), or add it to `AGENT_TOOL_NAMES` and `TOOL_GUIDANCE` by
hand **and** extend the registry test to cover the second source. Decide which
before writing the tool, not after.

### Prompt guidance

One line in `TOOL_GUIDANCE`, and it must be scoped by **intent**, not topic:

> `store-search` — where to buy a part: the reader is asking to purchase, not
> asking a specification

Triggering on topic instead ("wheels" → search the store) is what turns every
technical answer into an advert. A torque question gets `torque-specs` and
nothing else.

## Verification

Unit tests cannot see the thing most likely to go wrong here, so:

1. Unit: URL construction carries the UTM params; a timeout returns `[]`; a
   non-200 returns `[]`.
2. Static: the new tool is in `AGENT_TOOL_NAMES`; the prompt still contains no
   `utm_source`.
3. **Transport:** add a `tools/call` for it to `scripts/test-mcp-transport.sh` if
   it is also exposed over `/mcp`. Per CLAUDE.md, a tool with only unit tests is
   untested against the protocol that serves it — that gap is how #721 shipped
   with every authenticated call 500ing for months while the suite stayed green.
4. **Behavioural, by hand:** ask ten questions — five specifications, five
   purchase-intent — and confirm the store tool fires on the second five and
   **not** the first. That is the whole risk of this change and no automated test
   covers it.
5. Watch `tools_called` for a week. If `store-search` starts appearing on
   specification questions, the guidance is wrong and the assistant is drifting
   back toward the shop bot.

## The question worth answering first

Adding this makes the assistant sell, next to a disclaimer saying it is not a
professional service and a safety section telling people to see a mechanic. That
is defensible when it fires only on purchase intent, and corrosive if it leaks
into technical answers.

Option 4 is on the table for that reason. The decision is about what the
assistant _is_, and it should be made deliberately rather than arrived at.
