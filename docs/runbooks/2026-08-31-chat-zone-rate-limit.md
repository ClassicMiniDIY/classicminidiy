# Repointing the chat's zone rate-limit rule

The Cloudflare **zone** rate-limit rule is the edge backstop for the
unauthenticated chat route. It runs before the Worker bills anything, and it is
the only control that does — `server/middleware/rate-limit.ts` is per-isolate and
its own header calls it "an abuse dampener, not a hard global quota".

When the agent moved in-Worker on 2026-08-31 the route changed from
`POST /api/langgraph/*` to `POST /api/chat`. **The zone rule does not follow a
code change.** Until its expression is updated it guards a path that no longer
exists, and the live route has no edge protection at all.

`scripts/verify-cf-ratelimit.py` detects exactly this and fails until it is
fixed. Run it after any change that moves or adds a money-spending route:

```bash
CLOUDFLARE_API_TOKEN=... python3 scripts/verify-cf-ratelimit.py
```

**Status: applied 2026-08-31.** The rule now matches
`POST /api/chat` and `POST /api/models/seller/onboard`, and
`scripts/verify-cf-ratelimit.py` reports both `ok` against the live zone. The
procedure below is kept for the next time a money-spending route moves.

## Updating the expression

Thresholds and zone identifiers are deliberately absent from this repo — it is
public, and an abuse threshold tuned in infra is operational state. Derive the
ids and PATCH only the expression, leaving the rate limit itself untouched:

```bash
ZONE=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=classicminidiy.com" \
  | jq -r '.result[0].id')

RULESET=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/phases/http_ratelimit/entrypoint" \
  | jq -r '.id')

RULE=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/phases/http_ratelimit/entrypoint" \
  | jq -r '.result.rules[0].id')

curl -sS -X PATCH \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/$RULESET/rules/$RULE" \
  --data '{"expression":"(http.request.uri.path eq \"/api/chat\" and http.request.method eq \"POST\") or (http.request.uri.path eq \"/api/models/seller/onboard\" and http.request.method eq \"POST\")"}'
```

A PATCH carrying only `expression` preserves the configured threshold, period
and action, so the tuning stays where it belongs. Re-run the verifier afterwards;
it must print `ok /api/chat`.

## 2026-09-15: `GET /api/search` has no zone rule, on purpose

The unified-search work (`docs/plans/2026-09-14-unified-search.md`) made every
keystroke in the palette up to four database reads, and `GET /api/search` had
no throttle at all. `server/middleware/rate-limit.ts` now caps it in-Worker at
120/min/IP (`SEARCH_RATELIMIT_*`).

There is no edge rule for it, and the verifier does not demand one, because
the zone is on the **Free plan: one rate-limiting rule**, and the chat rule
holds it. Search cannot share that rule — a person typing sends bursts of a
few requests a second, and the chat threshold (single digits per ten seconds,
tuned for model spend) would block them mid-word. One rule cannot carry two
thresholds.

Search spends database reads, not model runs, so the in-Worker limit plus
Cloudflare's free DDoS protection is the accepted posture. If the plan ever
allows a second rule, add it as a SEPARATE rule (expression
`(http.request.uri.path eq "/api/search" and http.request.method eq "GET")`,
a count in the low hundreds per minute per IP, action block) and move
`/api/search` into `ALWAYS_REQUIRED` in `scripts/verify-cf-ratelimit.py` in
the same change.

## Why the rule is not in code

Cloudflare rate limiting is per-ZONE and cannot be expressed in
`wrangler.jsonc`. The stub contract in `server/stubs/botid-server-stub.mjs`
states the same thing: "the rule inventory is maintained in Cloudflare rather
than in this repo." The verifier exists so that split cannot rot silently.
