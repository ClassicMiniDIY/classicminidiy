# Runbook — AI crawler firewall (Cloudflare WAF)

Companion to `docs/plans/2026-06-14-generative-engine-optimization.md` (Phase 3, edge
enforcement). This runbook was written on 2026-07-30 because the configuration existed
only in a console, with nothing in the repo describing it.

**Platform note (2026-08-30).** The rule was originally a Vercel WAF rule. Vercel is
retired and the rule now lives in the **Cloudflare zone WAF**. It survived the migration
intact: `scripts/verify-ai-crawler-firewall.sh` passes all expectations against
production — 9 training crawlers denied 403, 6 answer bots and 5 search engines allowed
200, both permission-only tokens allowed, GEO surfaces reachable, no false positives.
Re-run that script rather than trusting this sentence; it is the only thing that can
prove the rule is still there.

Cloudflare's WAF is configured **per zone**, never account-wide. A second hostname on a
different zone gets none of this until the rule is added to that zone too.

## The policy in one line

**Allow the AI bots that cite you. Block the ones that only harvest you.**

`robots.txt` states that policy politely; the WAF enforces it. Both are generated from
the same lists in **`server/utils/aiBots.ts`** — except the WAF regex, which the zone
holds as a copy (see [Drift](#drift-the-one-real-hazard)).

## Why the split isn't arbitrary

The vendors deliberately ship _separate_ user-agents for retrieval and for training, so
you can accept one and refuse the other:

| Vendor     | Cites you as                       | Trains on you as            |
| ---------- | ---------------------------------- | --------------------------- |
| OpenAI     | `OAI-SearchBot`, `ChatGPT-User`    | `GPTBot`                    |
| Anthropic  | `Claude-User`, `Claude-SearchBot`  | `ClaudeBot`, `anthropic-ai` |
| Perplexity | `PerplexityBot`, `Perplexity-User` | —                           |
| Google     | `Googlebot`                        | `Google-Extended`           |
| Apple      | `Applebot`                         | `Applebot-Extended`         |

**Google AI Overviews are served from the normal Googlebot index.** Blocking
`Google-Extended` opts out of Gemini _training_ without removing the site from AI
Overviews. Blocking `Googlebot` would remove it from Google entirely — never do that.

## The live rule

Project `classicminidiy` → Firewall → Custom Rules.

- **Name:** `Block AI Training Crawlers`
- **ID:** `rule_block_ai_training_crawlers_nbb6RE`
- **Condition:** `User-Agent` _matches regex_
- **Action:** `Deny` (403)
- **Regex:**

```
(GPTBot|ClaudeBot|anthropic-ai|CCBot|Bytespider|Meta-ExternalAgent|Diffbot|Omgilibot|ImagesiftBot)
```

This string is the value of `WAF_DENY_REGEX` in `server/utils/aiBots.ts` and is pinned by
`tests/unit/server/utils/aiBots.test.ts`.

Everything else stays default: **Attack Mode off**, **System Mitigations active**, no IP
blocks, no system bypasses.

### What is deliberately NOT in the rule

- **`Google-Extended` / `Applebot-Extended`** — training _permission tokens_, not
  crawlers. No request ever arrives with those UAs, so denying them at the edge is a
  no-op. They are robots.txt-only (`AI_TRAINING_PERMISSION_TOKENS`).
- **The managed "AI Bots" ruleset** — it is all-or-nothing and would also block the
  answer bots we depend on for citations. Leave it off (or on Log). Do not flip it to
  Deny.
- **The paid OWASP Managed Ruleset** — not needed for this.

## Verify

```bash
bash scripts/verify-ai-crawler-firewall.sh
```

37 assertions: training bots 403, answer + search bots 200, permission tokens 200,
allowed bots reach `/robots.txt` `/sitemap.xml` `/llms.txt` `/llms-full.txt`, and no
false positives on browsers, Slack, Facebook, Twitter, Discord, or an empty UA. Exits
non-zero on any failure. Pass a preview URL as `$1` to check a preview deployment.

Read the live config without the dashboard. The custom-rules entrypoint for the zone
holds it; `scripts/sync-cf-zone-settings.py` uses the same `zones/{id}/rulesets/...`
shape for the redirect phase and is the working reference for auth and zone id:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE/rulesets/phases/http_request_firewall_custom/entrypoint" \
  | jq '.result.rules[] | {description, expression, action}'
```

## Changing the policy

The code is the source of truth, but **editing the code does not change production** —
the zone holds a copy. Do all four steps or the surfaces drift apart:

1. Edit `EDGE_DENY_BOTS` (and/or `AI_ANSWER_BOTS`) in `server/utils/aiBots.ts`.
2. Run `bun run test tests/unit/server/utils/aiBots.test.ts`. It will fail on the pinned
   `LIVE_RULE_REGEX` — that failure is the reminder, not a bug. Update the expected
   string to the new `WAF_DENY_REGEX`.
3. Update the zone rule's expression with the new `WAF_DENY_REGEX`. On Cloudflare a
   ruleset write takes effect immediately — there is no draft/publish step to forget,
   and equally no staging: a bad regex is live the moment the request returns.
4. Re-run `scripts/verify-ai-crawler-firewall.sh` against production.

Deploying the code alone updates `robots.txt` (advisory) but leaves the edge unchanged.
Updating the zone rule alone leaves robots.txt silent and `bot_crawl` analytics blind.
Both, always.

## Drift: the one real hazard

This has already happened once. `Diffbot`, `Omgilibot`, and `ImagesiftBot` were in the
console regex from day one but were **missing from `server/utils/aiBots.ts` until
2026-07-30**. Consequences while drifted:

- `robots.txt` never disallowed them — they were 403'd at the edge without ever being
  asked to stay away.
- `matchBot()` couldn't classify them, so they were invisible in the `bot_crawl`
  PostHog data.

Nothing failed loudly, which is exactly why the pinned-regex test now exists. If you
find them out of sync again, reconcile toward whichever list is _more_ correct and fix
both sides in the same change.

## Related enforcement (not part of this rule)

- **BotID** (`app/plugins/botid.client.ts` + `checkBotId()` server-side) protects
  abuse-prone POST endpoints — the unauthenticated LangGraph chat proxy and Stripe
  Connect seller onboarding. Separate mechanism, separate runbook:
  `docs/runbooks/2026-06-15-botid-endpoint-protection.md`. Note `/api/models/checkout`
  was deliberately **removed** from BotID after it false-positive-blocked real buyers.
- **Per-IP rate limiting** on `/api/langgraph/**` (`server/middleware/rate-limit.ts`) —
  that proxy is intentionally unauthenticated, so rate limiting is its primary guard.
- **`server/middleware/bot-analytics.ts`** records `bot_crawl` events for known bots and
  **never blocks**. It is observability only; enforcement is the WAF's job.
