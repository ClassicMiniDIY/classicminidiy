#!/usr/bin/env bash
#
# Verify the "Block AI Training Crawlers" WAF rule against a live deployment.
#
# The rule lives in the Cloudflare zone WAF (it was a Vercel WAF rule until the 2026-08
# migration), not in this repo, so nothing in CI can prove it is still correct. This
# script is that proof — run it after a firewall change, after a domain/zone migration,
# or whenever robots policy changes. Cloudflare's WAF is per-zone, so a new hostname on
# a different zone is unprotected until the rule is added there too.
#
#   bash scripts/verify-ai-crawler-firewall.sh                        # production
#   bash scripts/verify-ai-crawler-firewall.sh https://preview.url    # a preview
#
# Exits non-zero if any expectation fails, so it can be wired into a check later.
# Policy + rationale: docs/runbooks/2026-07-30-ai-crawler-firewall.md
# UA lists: server/utils/aiBots.ts
set -uo pipefail

BASE="${1:-https://www.classicminidiy.com}"
FAILED=0

hit() { curl -s -o /dev/null -w '%{http_code}' -A "$1" "$BASE$2" --max-time 30; }

# expect <label> <expected-code> <user-agent> [path]
expect() {
  local label="$1" want="$2" ua="$3" path="${4:-/}"
  local got
  got=$(hit "$ua" "$path")
  if [ "$got" = "$want" ]; then
    printf '  ok    %-28s %s %s\n' "$label" "$path" "$got"
  else
    printf '  FAIL  %-28s %s expected %s, got %s\n' "$label" "$path" "$want" "$got"
    FAILED=1
  fi
}

ua_for() { echo "Mozilla/5.0 (compatible; $1/1.0; +https://example.com/bot)"; }

echo "Verifying AI-crawler firewall against $BASE"
echo
echo "[1] Training crawlers must be DENIED (403) — mirrors EDGE_DENY_BOTS"
for bot in GPTBot ClaudeBot anthropic-ai CCBot Bytespider Meta-ExternalAgent Diffbot Omgilibot ImagesiftBot; do
  expect "$bot" 403 "$(ua_for "$bot")"
done

echo
echo "[2] Answer bots must be ALLOWED — these drive citations; blocking them"
echo "    is the failure mode this whole split exists to avoid"
for bot in OAI-SearchBot ChatGPT-User PerplexityBot Perplexity-User Claude-User Claude-SearchBot; do
  expect "$bot" 200 "$(ua_for "$bot")"
done

echo
echo "[3] Search engines must be ALLOWED (Google AI Overviews rides Googlebot)"
for bot in Googlebot Bingbot DuckDuckBot Applebot Amazonbot; do
  expect "$bot" 200 "$(ua_for "$bot")"
done

echo
echo "[4] Permission-only tokens must NOT be denied at the edge — they send no"
echo "    crawler UA, so a 403 here means the regex is over-broad"
for bot in Google-Extended Applebot-Extended; do
  expect "$bot" 200 "$(ua_for "$bot")"
done

echo
echo "[5] Allowed agents must reach the GEO surfaces, not just the homepage"
for path in /robots.txt /sitemap.xml /llms.txt /llms-full.txt; do
  expect "OAI-SearchBot" 200 "$(ua_for OAI-SearchBot)" "$path"
  expect "Googlebot" 200 "$(ua_for Googlebot)" "$path"
done

echo
echo "[6] No false positives on humans and social unfurlers"
expect "Chrome desktop" 200 "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
expect "iPhone Safari" 200 "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
expect "Slackbot" 200 "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"
expect "facebookexternalhit" 200 "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
expect "Twitterbot" 200 "Twitterbot/1.0"
expect "Discordbot" 200 "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"
expect "empty UA" 200 ""

echo
if [ "$FAILED" -eq 0 ]; then
  echo "All firewall expectations met."
else
  echo "FAILURES above — see docs/runbooks/2026-07-30-ai-crawler-firewall.md"
fi
exit "$FAILED"
