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

## Why the rule is not in code

Cloudflare rate limiting is per-ZONE and cannot be expressed in
`wrangler.jsonc`. The stub contract in `server/stubs/botid-server-stub.mjs`
states the same thing: "the rule inventory is maintained in Cloudflare rather
than in this repo." The verifier exists so that split cannot rot silently.
