# Classic Mini DIY MCP Server

Model Context Protocol (MCP) server exposing the Classic Mini DIY calculators and
archive to LLMs.

## Overview

Eleven tools, in three groups:

**Calculators** — the same code the site runs, imported rather than reimplemented
(`app/utils/*Calculations.ts`, `app/composables/useNeedleCompare.ts`), so a tool
answer and the on-site answer cannot drift apart.

- **compression-calculator**: compression ratio and engine capacity
- **gearbox-calculator**: gear ratios, top speed, speedometer accuracy
- **needle-compare**: SU needle profiles — lookup, compare, or find richer/leaner

**Identification**

- **chassis-decoder**: decode a chassis number (identifies the CAR)
- **engine-decoder**: decode an engine prefix code (identifies the ENGINE fitted,
  which is frequently not the original)

**Reference and archive**

- **torque-specs**, **clearances**, **parts-equivalency**, **vehicle-weights**:
  searchable reference tables
- **wheel-search**, **color-lookup**: the Supabase archive, approved entries only

Tools take a query and return the matching subset. The site's API routes return
whole tables because a browser filters client-side; an LLM should not have to
receive several hundred rows to answer one question.

## Authentication and tiers

**All MCP endpoints require authentication via Bearer token.**

### Getting a key (self-serve)

Sign in at classicminidiy.com and mint a key at
[/dashboard/api-keys](https://classicminidiy.com/dashboard/api-keys). Keys look
like `cmdiy_` + 40 characters, are shown exactly once at creation, and only a
hash is stored — a lost key is replaced, never recovered. Up to 5 active keys
per account; revocation from the dashboard is immediate.

### Tiers

| Tier | Who | Tools | Rate limit |
|---|---|---|---|
| Free | any signed-in account | the 7 calculators/reference tables | 20 req/min per key |
| Developer | [Developer API subscribers](https://classicminidiy.com/developers) ($4.99/mo or $47.90/yr) | all 11 (adds `chassis-decoder`, `engine-decoder`, `wheel-search`, `color-lookup`) | 240 req/min per key |

The canonical free-tool list is `FREE_TOOLS` in `server/utils/mcpTiers.ts` (a
unit test pins it to the tool filenames). On a free key the paid tools still
appear in `tools/list` — their descriptions carry an upgrade note, and calling
one returns an `isError` result explaining the subscription. A subscription
change applies to existing keys within ~5 minutes (instantly on upgrade —
checkout completion purges the key cache).

### Providing API Keys

API keys must be provided via Authorization header with Bearer token:

```bash
curl -H "Authorization: Bearer cmdiy_..." https://www.classicminidiy.com/mcp
```

### Operator env keys (internal)

`MCP_API_KEY` / `MCP_API_KEYS` (comma-separated) env values remain valid and
resolve to an internal tier (all tools, highest limit) with no database
involved. This is the ops/CI path — `scripts/test-mcp-transport.sh` and the
deploy smoke authenticate with it — not a user-facing mechanism. There is no
built-in default key; authentication fails closed in every environment. For
local development, set `MCP_API_KEY` in your `.env` and send that value as the
Bearer token.

### Usage recording

Successful tool calls are counted per key/tool/day into the usage chart on
`/dashboard/api-keys` (fire-and-forget; a capture failure never fails a call).
Known caveat: calls served from the response cache of the two cached tools
(`chassis-decoder`, `compression-calculator`) are not counted. Rate limiting is
per-request and unaffected.

## MCP Server Endpoint

- **URL**: `https://www.classicminidiy.com/mcp`
- **Server Name**: `classic-mini-calculators`
- **Authentication**: API Key Required

## Available Tools

### 1. compression-calculator

Calculate compression ratio and engine capacity for Classic Mini engines.

**Parameters:**

- `bore` (number): Bore diameter in cm (e.g., 7.06 for 70.6mm)
- `stroke` (number): Stroke length in cm (e.g., 8.128 for 81.28mm)
- `pistonDish` (number): Piston dish volume in cc
- `headVolume` (number): Cylinder head chamber volume in cc
- `deckHeight` (number): Piston deck height in thousandths of an inch
- `gasket` (number): Head gasket volume in cc (use 0 for custom)
- `customGasket` (number): Custom gasket volume in cc (used when gasket is 0)
- `decomp` (number): Decompression plate volume in cc

**Example:**

```json
{
  "bore": 7.06,
  "stroke": 8.128,
  "pistonDish": 6.5,
  "headVolume": 25.5,
  "deckHeight": 20,
  "gasket": 3.4,
  "decomp": 0
}
```

### 2. gearbox-calculator

Calculate gear ratios, top speed, and speedometer compatibility.

**Parameters:**

- `metric` (boolean): Use metric units (true for km/h, false for mph)
- `final_drive` (number): Final drive ratio (e.g., 3.444)
- `gear_ratios` (array): Gear ratios in order [1st, 2nd, 3rd, 4th, optional 5th]. Length 4 for 4-speed gearboxes, length 5 for 5-speed (e.g., Minispares Evolution 5-Speed with overdrive)
- `drop_gear` (number): Drop gear ratio
- `speedo_drive` (number): Speedometer drive ratio
- `max_rpm` (number): Maximum engine RPM
- `tire_type` (object): Tire specifications with width, profile, and size

**Example:**

```json
{
  "metric": false,
  "final_drive": 3.444,
  "gear_ratios": [2.583, 1.644, 1.25, 1.0],
  "drop_gear": 1,
  "speedo_drive": 0.3529,
  "max_rpm": 6500,
  "tire_type": {
    "width": 145,
    "profile": 80,
    "size": 10
  }
}
```

### 3. chassis-decoder

Decode and validate Classic Mini chassis numbers based on year range.

**Parameters:**

- `yearRange` (string): Year range for chassis format
  - Valid values: "1959-1969", "1969-1974", "1974-1980", "1980", "1980-1985", "1985-1990", "1990-on"
- `chassisNumber` (string): Classic Mini chassis number to decode

**Example:**

```json
{
  "yearRange": "1959-1969",
  "chassisNumber": "A-A2S7L-123A"
}
```

### 4. engine-decoder

Identify an engine from its prefix code — the letters and numbers cast or stamped on the
block. Sibling to `chassis-decoder`: the chassis number identifies the CAR, this identifies
the engine currently in it, which on a Classic Mini is frequently not the original.

**Parameters:** `code` (string, e.g. `"12H"`), `query` (string, free text such as
`"1275 Cooper S"`), `limit` (number, default 25). Provide one of `code` or `query`.

An exact code match is tried first, then a prefix match — blocks are worn and half-legible,
so a partial read is the normal case rather than an error.

### 5. needle-compare

Look up and compare SU carburettor needles from 709 profiles, using the same comparison
logic as the on-site configurator. Richness is measured as **fuel-flow area in mm²**, not
needle diameter, because area is what meters fuel.

**Parameters:** `mode` (`"lookup" | "compare" | "find"`), `needle` (name, e.g. `"AAA"`),
`against` (second needle, for `compare`), `direction` (`"richer" | "leaner" | "similar"`),
`band` (`"low" | "mid" | "high" | "any"`), `sameSizeOnly`, `isolateBand`, `limit`.

Bands are throttle positions: low = stations 1-4 (idle/light), mid = 5-9 (cruise),
high = 10-15 (full). `isolateBand` (default true) requires the other two bands to stay
approximately unchanged, which is what makes "richer ONLY down low" answerable.

```json
{ "mode": "find", "needle": "AAA", "direction": "richer", "band": "low", "limit": 5 }
```

### 6-9. Reference tables

`torque-specs`, `clearances`, `parts-equivalency` and `vehicle-weights` share one
implementation (`server/utils/mcpLookup.ts`) over four datasets.

**Parameters (all four):** `query` (free text; every word must match, so extra words
narrow), `section` (restrict to one section, by key or title), `limit` (default 50).

| Tool                | Covers                                                                               |
| ------------------- | ------------------------------------------------------------------------------------ |
| `torque-specs`      | lb-ft and Nm for Engine (41), Suspension (24), Clutch & Gearbox (22), Electrical (6) |
| `clearances`        | 10 commonly-needed endfloat and clearance tolerances, in thou and mm                 |
| `parts-equivalency` | Cross-brand part numbers: oil filters (18), air filters (4), alternators (2)         |
| `vehicle-weights`   | Curb weights for 12 variants plus ~530 component weights, in kg                      |

Every response carries `availableSections` so a miss is actionable, and `truncated` so a
caller knows to narrow rather than assume it saw everything.

### 10-11. Archive lookups

`wheel-search` and `color-lookup` read the Supabase archive. **Only `status='approved'`
rows are ever returned** — these tools must not expose the moderation queue.

**`wheel-search`** — `query` (name or manufacturer), `size` (diameter in inches: 10, 12, 13),
`width` (string, matched exactly), `limit`. Returns offset, bolt pattern, centre bore and
weight where recorded.

> `width` is a **string**, not a number: the archive stores it as free text, so real values
> include `"4.5"`, `"5"`, `"5j"` and `"5.5-8.5"`. A null dimension means "not recorded",
> not zero.

**`color-lookup`** — `query` (colour name or paint code such as `"GN37"`), `limit`.
Returns factory, Ditzler/PPG and Dulux codes.

> `colorFamily` is a broad grouping (`"red"`, `"grey"`), **not a hex code** — the archive
> records families rather than exact values. There is deliberately no year filter:
> `year_start` is null on every approved row, so it could only ever return nothing.

## Using with AI Assistants

### Claude Desktop / Claude Code

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "classic-mini-diy": {
      "url": "https://www.classicminidiy.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "classic-mini-diy": {
      "url": "https://www.classicminidiy.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

`Authorization: Bearer` is the only accepted form. This example used to show an
`X-API-Key` header, which `server/middleware/mcp-auth.ts` does not read — anyone
following it got a 401 and no indication why.

### Custom MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'classic-mini-calculators',
  version: '1.0.0',
});

await client.connect({
  url: 'https://www.classicminidiy.com/mcp',
  headers: {
    Authorization: 'Bearer your-api-key',
  },
});

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: 'compression-calculator',
  arguments: {
    bore: 7.06,
    stroke: 8.128,
    pistonDish: 6.5,
    headVolume: 25.5,
  },
});
```

## Security Best Practices

1. **Keep API Keys Secret**: Never commit API keys to version control
2. **Use Environment Variables**: Store keys in `.env` files (git-ignored) or
   your client's secret storage — never inline in shared config
3. **Rotate by replacement**: Mint a new key at `/dashboard/api-keys`, move the
   integration over, revoke the old one (revocation is immediate)
4. **Unique Keys per Integration**: Give each LLM integration its own key — the
   per-key usage chart then tells you which integration is doing what
5. **Monitor Usage**: Watch the usage chart on `/dashboard/api-keys`; calls you
   don't recognize mean the key leaked — revoke it

## Error Responses

### 401 Unauthorized

No Bearer token provided:

```json
{
  "statusCode": 401,
  "statusMessage": "Unauthorized",
  "message": "Bearer token required. Provide via Authorization header: \"Bearer <api-key>\""
}
```

### 403 Forbidden

Invalid API key:

```json
{
  "statusCode": 403,
  "statusMessage": "Forbidden",
  "message": "Invalid API key provided."
}
```

## Caching

Only two tools cache: `chassis-decoder` (24h) and `compression-calculator` (1h).
Everything else is uncached on purpose — the reference tools search bundled JSON
in memory and the archive tools hit Postgres, so a cache round-trip would cost
more than the work it replaces.

**A tool taking an OBJECT-valued argument must supply an explicit `getKey` if it
caches.** The toolkit's default key is `Object.values(args).map(String).join(':')`,
so every distinct object stringifies to the same `[object Object]` and shares one
entry. This is why `gearbox-calculator` is uncached: its `tire_type` is an object,
and two different tire sizes would have collided on one cached top speed.

## Testing

`bun run test` covers the tool logic. It does **not** cover the transport: those
tests stub `defineMcpTool` and call `.handler()` directly, so they touch no
routing, no auth middleware, no mcp-toolkit and no JSON-RPC framing.

For the protocol itself:

```bash
NITRO_PRESET=cloudflare_module bun run build
./scripts/test-mcp-transport.sh
```

That speaks real JSON-RPC to the built artifact under `wrangler dev --local`, and
runs in CI as a pre-deploy gate. It has to be a real worker: mcp-toolkit picks its
transport provider at **build time** from the Nitro preset, so a Nuxt/Vitest e2e
test would exercise the Node provider while production runs the Cloudflare one.
Issue #721 was a fault in exactly that provider — every authenticated call 500'd
while the whole unit suite stayed green.

Set `SUPABASE_SERVICE_KEY` to include the two archive tools; without it they are
skipped rather than failed.

## Support

For issues or questions:

- GitHub: https://github.com/SomethingNew71/classicminidiy
- Website: https://www.classicminidiy.com
