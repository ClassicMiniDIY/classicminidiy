# Scanner block and script-client challenge (zone WAF custom rules)

Two Cloudflare **WAF custom rules** were added to the zone on 2026-09-16, after
a "spike in automated traffic" email. They sit beside the AI-training-crawler
block from `docs/runbooks/2026-07-30-ai-crawler-firewall.md`. Like every zone
rule they live in Cloudflare, not in this repo: a code change never updates
them and a deploy never removes them.

## What happened

One hosting /24 sent ~12k `curl` requests per day to `/` and `/archive/wheels`
for several days. Almost all were edge cache hits, so the cost was negligible,
but the same range also probed for `.env` files. The range belongs to a
scanning fleet that GreyNoise profiled publicly
(https://www.labs.greynoise.io/grimoire/2026-03-23-bucklog-k8s/).

The Pro plan allows **one** zone rate-limit rule and it is already spent on
`POST /api/chat` (see `docs/runbooks/2026-08-31-chat-zone-rate-limit.md`), so
a per-IP page-navigation rate limit was not an option. Custom rules were.

## The rules

1. **Block AS211590** — a plain ASN + CIDR block. Nothing legitimate originates
   there. Safe to keep forever; safe to delete if the ASN is ever reassigned.
2. **Challenge script clients on page documents** — Managed Challenge for
   `GET` requests on the two web hosts whose path has no file extension and
   whose user agent is a known script client (curl, wget, python, go, scrapy,
   node http clients). The exact user-agent list is in the rule description in
   the dashboard. The rule deliberately does **not** match:
   - `/api/**` (native apps call these with OkHttp / URLSession)
   - `/mcp` (Developer API, Bearer auth)
   - `/t/**` (PostHog reverse proxy) and `/cdn-cgi/**`
   - any path containing a `.` (sitemaps, feeds, `robots.txt`, `_nuxt` assets)
   - verified bots (`cf.client.bot`)
   - an **empty** user agent — `scripts/verify-ai-crawler-firewall.sh` asserts
     that an empty UA gets a 200 and runs nightly; matching it would fail CI
   - `HeadlessChrome` — the Playwright e2e suite

## Verify

```bash
# page document with a script UA -> 403 (challenge)
curl -s -o /dev/null -w '%{http_code}\n' https://www.classicminidiy.com/
# API and MCP unaffected -> not 403
curl -s -o /dev/null -w '%{http_code}\n' -A 'okhttp/4.12.0' https://www.classicminidiy.com/api/diagrams
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.classicminidiy.com/mcp
# the two existing verifiers must stay green
bash scripts/verify-ai-crawler-firewall.sh https://www.classicminidiy.com
python3 scripts/verify-cf-ratelimit.py
```

## Disable or remove

Dashboard: Security → WAF → Custom rules → toggle the rule off. Or via API,
list the rules and PATCH `{"enabled": false}` on the rule id:

```bash
ZONE=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=classicminidiy.com" | jq -r '.result[0].id')
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/phases/http_request_firewall_custom/entrypoint" \
  | jq '.result.rules[] | {id, enabled, description}'
```

## Reading the bot picture without Bot Management

The Pro plan has no `botScore` field in GraphQL. What works:
`httpRequests1dGroups` for daily totals, and `httpRequestsAdaptiveGroups`
(one day per query) grouped by `userAgent`, `clientRequestPath`,
`clientCountryName`, `clientIP`, `cacheStatus`, `edgeResponseContentTypeName`.
`clientAsn`, `clientRefererHost` and `botScore*` are refused. Use
`firewallEventsAdaptive` to see which rule produced a 403; `source` is
`firewallCustom` for these rules and `firewallManaged` for Cloudflare's own
AI-bot and managed rules.

## Cloudflare's managed AI-bot layer must stay off

While verifying, `scripts/verify-ai-crawler-firewall.sh` failed on answer bots
that the 2026-07-30 policy allows. The 403s came from Cloudflare's **managed**
AI-crawler controls (`firewallEventsAdaptive.source = firewallManaged`), not
from any custom rule. Two things to know:

- **Bot Preference Sync** (Cloudflare, 2026-08-21) turns the zone's "AI
  training: disallow" preference into an edge block for every crawler that
  *Cloudflare* classes as training. That list is broader than
  `server/utils/aiBots.ts` and includes bots the GEO policy relies on for
  citations. The policy is expressed in two places that this repo owns, the
  origin `robots.txt` (nuxt-robots) and the "Block AI training crawlers" custom
  rule, so the managed layer is redundant and must stay disabled. If the
  verifier ever reports an allowed bot getting 403 with a `firewallManaged`
  source, someone re-enabled it.
- `PUT /zones/{id}/bot_management` **replaces the whole settings object.** A
  body with one field resets every other field to its default. Always read the
  current object first and send it back in full with the one change applied.
