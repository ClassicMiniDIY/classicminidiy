#!/usr/bin/env bash
# Verify a Cloudflare Workers deployment of classicminidiy.
#
# Written in Phase 2 rather than Phase 4 on purpose: on the OpenECUAlliance
# pathfinder the equivalent script caught a stale deployment and two of its own
# assertion bugs while still on a preview URL, where a mistake costs nothing.
#
# Usage:  ./scripts/verify-cf-deploy.sh [origin]
# Default origin is the workers.dev deployment. Pass the production origin once
# the zone is live.
#
# Zone-dependent checks (redirects, HSTS, image transformations) stay behind the
# ZONE_CHECKS guard and arm automatically when run against a real zone origin.

set -uo pipefail

ORIGIN="${1:-https://classicminidiy.classicminidiy.workers.dev}"
ORIGIN="${ORIGIN%/}"
case "$ORIGIN" in
  *workers.dev*) ZONE_CHECKS=0 ;;
  *)             ZONE_CHECKS=1 ;;
esac

PASS=0; FAIL=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
skip() { printf '  ....  %s (zone-only)\n' "$1"; }

# expect_status <path> <expected> [label]
expect_status() {
  local path="$1" want="$2" label="${3:-$1}"
  local got
  got=$(curl -sS -o /dev/null -m 30 -w '%{http_code}' "$ORIGIN$path" 2>/dev/null)
  [ "$got" = "$want" ] && ok "$label -> $got" || bad "$label -> got $got, want $want"
}

# expect_body <path> <grep-pattern> <label>
expect_body() {
  local path="$1" pat="$2" label="$3"
  if curl -sS -m 30 "$ORIGIN$path" 2>/dev/null | grep -qE "$pat"; then
    ok "$label"
  else
    bad "$label (pattern not found: $pat)"
  fi
}

echo "Verifying: $ORIGIN"
echo

echo "== core routes render =="
expect_status "/" 200
expect_status "/models" 200
expect_status "/technical/torque" 200
expect_status "/archive/colors" 200
expect_status "/api/torque" 200

echo
echo "== URL shape (the html_handling contract) =="
# Vercel serves prerendered routes at their NO-SLASH url as 200. The Workers
# assets default would 307 to the slashed form, breaking every canonical and
# sitemap entry. wrangler.jsonc sets html_handling: drop-trailing-slash.
expect_status "/technical/torque" 200 "no-slash form is 200"
expect_status "/technical/torque/" 307 "slashed form redirects back"

echo
echo "== 404 handling =="
# app/pages/[...slug].vue must throw a real 404; it used to answer 200 with an
# undefined title for every unknown path, an unbounded soft-404 space.
expect_status "/definitely-not-a-real-page-xyz" 404 "unknown URL is a real 404"

echo
echo "== SEO invariants =="
# nuxt is pinned at ~4.4.8 because 4.5 renders EMPTY schema.org JSON-LD. This is
# the canary for that pin.
expect_body "/" 'application/ld\+json' "JSON-LD block present"
expect_body "/" '<title>' "title tag present"
expect_status "/robots.txt" 200
expect_status "/sitemap.xml" 200
expect_status "/llms.txt" 200

echo
echo "== deployment must not be indexable =="
# A non-production origin serves a full, working copy of the site backed by
# PRODUCTION data (NUXT_PUBLIC_SUPABASE_* is build-baked, not a runtime secret).
# If it is also indexable, that is duplicate content against the real site plus
# a second unmonitored public front-end. The build must set NUXT_SITE_ENV=preview.
# Asserted here because a battery that only checks "robots.txt returns 200"
# passes identically whether it says `Allow: /` or `Disallow: /`.
if [ "$ZONE_CHECKS" = "0" ]; then
  if curl -sS -m 30 "$ORIGIN/technical/torque" 2>/dev/null | grep -qiE '<meta[^>]*name="robots"[^>]*content="[^"]*noindex'; then
    ok "non-production origin emits noindex"
  else
    bad "non-production origin is INDEXABLE — set NUXT_SITE_ENV=preview on the build"
  fi
  if curl -sS -m 30 "$ORIGIN/robots.txt" 2>/dev/null | grep -qi 'indexable'; then
    bad "robots.txt advertises the indexable variant on a non-production origin"
  else
    ok "robots.txt is not the indexable variant"
  fi
else
  # On the real origin the opposite is required: it MUST be indexable.
  if curl -sS -m 30 "$ORIGIN/technical/torque" 2>/dev/null | grep -qiE '<meta[^>]*name="robots"[^>]*content="[^"]*noindex'; then
    bad "PRODUCTION origin is noindex — NUXT_SITE_ENV is wrong for this deploy"
  else
    ok "production origin is indexable"
  fi
fi

echo
echo "== MCP (fails closed) =="
mcp_status=$(curl -sS -o /dev/null -m 30 -w '%{http_code}' -X POST "$ORIGIN/mcp" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' 2>/dev/null)
[ "$mcp_status" = "401" ] && ok "/mcp rejects an unauthenticated call -> 401" \
  || bad "/mcp unauthenticated -> got $mcp_status, want 401"
# The CF provider does `await import('agents/mcp')` at REQUEST time, so a missing
# dependency deploys green and only fails when first called. 401 proves the
# handler actually ran.

echo
echo "== zone-dependent =="
if [ "$ZONE_CHECKS" = "1" ]; then
  # Two traps here, both of which this check previously fell into.
  #
  # 1. The modifier key is `w=`, NOT `width=`. The @nuxt/image cloudflare provider
  #    maps width->w, height->h, quality->q, format->f (see its keyMap). Matching
  #    `width=` fails against a correctly-working deployment.
  # 2. Match a SAME-ORIGIN src. The finds feature renders scraped third-party
  #    og_image_url values, and some of those hosts (media.carsandbids.com) also
  #    use Cloudflare Images — so a bare `/cdn-cgi/image/` substring match, or an
  #    unanchored grep that strips the host, tests a URL that was never ours.
  #
  # The page must also carry MODIFIERS: the provider returns the raw src unchanged
  # when no modifiers are set, so a bare-image page would pass while transformation
  # was entirely off.
  # `w=[0-9]` rather than `width=` (the provider's keyMap is width->w), and no
  # separator guard before it — the operations segment follows `image/` directly,
  # so `/cdn-cgi/image/w=128,h=37,f=webp,q=80/...` has no delimiter to anchor on.
  expect_body "/archive/wheels" 'src="/cdn-cgi/image/[^"]*w=[0-9]' "images emit same-origin /cdn-cgi/image/ WITH modifiers"
  # And prove real transformed BYTES come back, not just the URL shape.
  img=$(curl -sS -m 30 "$ORIGIN/archive/wheels" 2>/dev/null \
        | grep -oE 'src="/cdn-cgi/image/[^"]+' | head -1 | sed 's/^src="//')
  if [ -n "$img" ]; then
    ctype=$(curl -sS -o /dev/null -m 30 -w '%{content_type}' "$ORIGIN$img" 2>/dev/null)
    case "$ctype" in
      image/*) ok "transformed bytes returned ($ctype)" ;;
      *)       bad "transformed image returned $ctype, not an image" ;;
    esac
  else
    bad "no /cdn-cgi/image/ URL found to fetch" ;
  fi
  hsts=$(curl -sSI -m 30 "$ORIGIN/" 2>/dev/null | grep -ci 'strict-transport-security')
  [ "$hsts" -ge 1 ] && ok "HSTS header present" || bad "HSTS header missing"
else
  skip "images emit /cdn-cgi/image/"
  skip "HSTS header present"
  skip "TME redirect map"
fi

echo
printf 'passed %d, failed %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
