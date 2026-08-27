# MCP: investigating #721, and the expansion backlog

Date: 2026-08-26
Issue: https://github.com/ClassicMiniDIY/classicminidiy/issues/721

## Outcome first

**#721 does not reproduce.** Production `/mcp` works correctly on the currently
deployed, unpatched `main`. No code fix was needed or shipped. What this branch
carries is the deploy check that would have caught the bug, and would catch it
again — because the reason nobody noticed for months is that the smoke test could
not tell a working handler from a broken one.

## What was measured

Against `https://www.classicminidiy.com` on 2026-08-26, with the production key:

| Call | Result |
|---|---|
| Unauthenticated `tools/list` | 401 |
| Authenticated `tools/list` | **200**, full tool catalogue |
| Authenticated `tools/call` (compression) | **200**, 9.43:1 on 1272.75cc — correct for a stock 1275 |
| Response headers | `server: cloudflare`, `cf-ray` present, no Vercel headers |

Production is running current `main`, not a stale artifact: the admin consolidation
from `8a3ad005` is live, including its `/admin/registry/review` →
`/admin/queue?targetType=registry` redirect, and the `/listings` → `/exchange/listings`
301 from `32b9a16b`.

Locally, `NITRO_PRESET=cloudflare_module` + `wrangler dev --local`, three
configurations were tried and **none** reproduced the failure:

| Configuration | Authenticated `tools/list` |
|---|---|
| Nitro output bundle, unpatched | 200, with the agents v1 deprecation warning |
| `wrangler deploy --dry-run` artifact, unpatched | 200 |
| Nitro output bundle, patched to `createLegacyMcpHandler` | 200 |

That deprecation warning is the informative part: unpatched, the `instanceof` check
in `agents`' compat shim **passes**, and `createMcpHandler` delegates to
`createLegacyMcpHandler` on its own. The shim works here.

## What the issue described, and why it is not actionable now

`@nuxtjs/mcp-toolkit`'s Cloudflare provider
(`dist/runtime/server/mcp/providers/cloudflare.js:35`) does
`await import('agents/mcp')` at request time and passes an MCP SDK v1 `McpServer`
to `createMcpHandler`. That shim accepts a v1 server only via
`instanceof McpServer || instanceof Server` against the SDK v1 classes; when both
miss it throws the `TypeError` in the issue. Because the import is dynamic, the
failure cannot surface at build time — the deploy goes green and the handler breaks
only when first called.

The leading hypothesis was that the deployed single-file bundle gave the dynamic
chunk a separate module instance of those classes, so two structurally identical
classes failed `instanceof`. It was never reproduced, and production now contradicts
it. The most likely story is that the artifact deployed when the issue was filed was
built from a dependency tree that resolved `agents` differently, and one of the
several deploys since (`ecb9771f`, `8a3ad005`, `89ebdd38`) rebuilt it correctly.

**A patch was written and then dropped.** Swapping the provider to
`createLegacyMcpHandler` via `bun patch` did work locally, and was safe in principle
— it calls the function the shim delegates to anyway. But it fixes nothing currently
broken, it addresses a mechanism that was never observed, and a patched dependency
has to be re-verified on every `@nuxtjs/mcp-toolkit` bump. Not worth carrying.
**No upstream issue was filed**, for the same reason: the draft asserted a cause
this investigation could not demonstrate.

If the symptom returns, the patch is one line and the reasoning is above — but
reproduce it first.

## What shipped

`scripts/verify-cf-deploy.sh`, two changes, both about the same defect class: a
check that cannot distinguish "healthy" from "never ran".

1. **An authenticated `/mcp` assertion.** The pre-existing check asserted only that
   an anonymous call gets 401 — and that 401 comes from `server/middleware/mcp-auth.ts`,
   which runs *before* the handler. It passes whether the handler works or not, which
   is exactly how a 500 on every authenticated call went unnoticed. With `MCP_SMOKE_KEY`
   set, an authenticated `tools/list` must return the catalogue; without it the check
   is skipped rather than silently passing. Confirmed to fail against a deliberately
   broken build.

2. **A preflight reachability gate.** Several checks are satisfied by an *empty*
   response: the indexable gate greps for a `noindex` tag it will not find, and the
   chat gate falls through its `case` to the `ok` branch. Run against an unreachable
   host the battery reported "passed 6, failed 19" — six green assertions about a
   deployment nothing had contacted. Curl reports `000` for a DNS/TLS/connection
   failure, which no live origin returns, so the script now aborts on it.

   (This was found the honest way: the origin argument was left as an unsubstituted
   `<preview-origin>` placeholder on a real run, and six checks still passed.)

## Expansion backlog

**Status: hardening (#726), shared math (#727) and the new tools have shipped.**
Transport-level test coverage is the remaining item.

The tool count went from 3 to 11. Two things the build turned up that the plan
below did not predict, both found by querying the real data rather than trusting
the schema: `colors.year_start` is NULL on all 297 approved rows, so a planned
year filter could only ever have returned nothing and was dropped; and
`colors.hex_value` holds a colour FAMILY name ("red", "grey"), not a hex code,
so the field is surfaced as `colorFamily`. `wheels.width` is likewise free text
("5j", "5.5-8.5"), not a number.

### Hardening — SHIPPED (#726)

- **Chassis tool self-fetches production.** `server/mcp/tools/chassis-decoder.ts:44-64`
  HTTP-PUTs its own `/api/decoders/chassis` via `runtimeConfig.public.siteUrl`, so a
  preview deploy calls **production**; and the request re-enters the middleware stack
  as a mutating `/api/**` call, consuming the write rate limiter, where serverless
  egress has no `x-real-ip` and shares one global bucket. `validateChassisNumber`
  (`server/api/decoders/chassis.ts:30-468`) is pure and unexported — extract to a
  server util both import. The tool already imports `chassisRanges` directly, so the
  module boundary is half-crossed anyway.
- **`/mcp` has no rate limit.** It is not under `/api/`, so neither policy in
  `server/middleware/rate-limit.ts` covers it. Key a new one on the bearer token.
- **Auth over-matches.** `server/middleware/mcp-auth.ts:13` uses `startsWith('/mcp')`,
  which also 401s `/mcp/badge.svg` and `/mcp/deeplink` — routes the module registers
  specifically to be publicly linkable.
- **`browserRedirect` is unset**, so a browser hitting `/mcp` redirects to `undefined`
  once past auth. (`version` is fine — `initialize` already reports 1.0.0.)
- **Gearbox cache-key collision — verify before fixing.** `cache: '1h'` triggers the
  toolkit's default key builder, `Object.values(args).map(String).join(':')`, and
  `tire_type` is an object, so it stringifies to `"[object Object]"`. In principle
  every tire config collides on one key. It did **not** reproduce under
  `wrangler dev --local` — two tire sizes returned different results — so the cache
  appears inert there. Check what backs it in production (`env.CACHE` KV is bound)
  before claiming anyone received wrong figures.
- **Docs describe a server that does not exist.** `server/mcp/README.md:152-164` tells
  Cursor users to send `X-API-Key`, which hard-401s since the middleware reads only
  `Authorization: Bearer`. The root README and CLAUDE.md describe `/api/mcp/*` REST
  routes and a LangGraph↔MCP integration with no code behind them.

### Shared math — SHIPPED

Two items in this section were dropped as wrong on inspection: `browserRedirect`
is not unset (the module defaults it to `/`), and the Australian chassis range
does decode. The gearbox cache collision was recharacterised as latent, not live.

The shared-math work also turned up a defect not predicted below: the tool's
`tire_type` schema omitted the optional `diameter` field that `TireValue` has
always carried, so zod stripped it from any caller who supplied one. For the
Hoosier 19.0 x 5.0-10 that meant a derived 254mm instead of the real 477.52mm,
and a top speed of 56mph where the truth is 106mph.


The MCP tools re-implement the calculators rather than importing them, and the copies
have drifted: the gearbox tool uses `Math.PI` where the site uses a `3.14159` literal,
ignores `tireType.diameter`, and computes a *different quantity* for speedometer
accuracy than the site does — it answers a question the site does not ask, in the
site's name. Server code can import `app/utils` (precedent: `server/plugins/llms-faq.ts`,
`server/utils/exchange/contentFilter.ts`), so compression math extracts to
`app/utils/compressionCalculations.ts` and both tools import the site's utils. The
`CalculatorsMathBreakdown` invariant holds — the breakdown keeps reading the same
computeds the result cards read.

### New tools — SHIPPED

The site's data is its moat and almost none of it is exposed. Each wraps data already
in the repo, imported directly rather than over HTTP: `needle-compare` (the
distinctive one — `app/composables/useNeedleCompare.ts` is already pure portable TS),
`torque-specs`, `clearances`, `parts-equivalency`, `engine-decoder`, `vehicle-weights`,
and Supabase-backed `wheel-search` / `color-lookup` via `getServiceClient()` with the
column allowlist from `useWheels.ts:16-37`.

Tools should take a query and return the matching subset. The site's API routes return
whole tables because a browser filters client-side; an LLM should not have to.

### Test coverage — NOT STARTED

The existing MCP unit tests call `.handler()` directly, so the entire transport layer
is untested — structurally incapable of catching #721. Integration tests that actually
speak JSON-RPC (`initialize`, `tools/list`, `tools/call`) belong in CI, most cheaply as
a smoke script driving `wrangler dev --local`.
