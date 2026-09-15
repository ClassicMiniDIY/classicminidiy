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

## 2026-09-15: adding `GET /api/search` (unified search)

The unified-search work (`docs/plans/2026-09-14-unified-search.md`) made every
keystroke in the palette up to four database reads, and `GET /api/search` had
no edge rule. `server/middleware/rate-limit.ts` now throttles it in-Worker
(120/min/IP, `SEARCH_RATELIMIT_*`), and `scripts/verify-cf-ratelimit.py` lists
`/api/search` as required, so it fails until the zone rule covers it too.

Search is a different shape from chat: bursts of a few requests a second while
typing, then nothing. Use a SEPARATE rule rather than widening the chat rule's
expression, so the chat threshold stays tuned for model spend. Suggested
starting point, tuned in the dashboard and never recorded here: a count in the
low hundreds per minute per IP, action `block` for a short period. Expression:

```
(http.request.uri.path eq "/api/search" and http.request.method eq "GET")
```

Create it with the same API the section above uses, as a NEW rule in the
`http_ratelimit` entrypoint ruleset (POST to `.../rulesets/$RULESET/rules`
with `action: "block"`, the expression, and a `ratelimit` block carrying
`characteristics: ["ip.src"]`, `period`, `requests_per_period` and
`mitigation_timeout`), or in the dashboard under Security → WAF → Rate limiting
rules. Then re-run the verifier; it must print `ok /api/search`.

**Status: pending.** The in-Worker throttle is live from the merge of the
unified-search PRs; the zone rule needs a dashboard change.

## Why the rule is not in code

Cloudflare rate limiting is per-ZONE and cannot be expressed in
`wrangler.jsonc`. The stub contract in `server/stubs/botid-server-stub.mjs`
states the same thing: "the rule inventory is maintained in Cloudflare rather
than in this repo." The verifier exists so that split cannot rot silently.
