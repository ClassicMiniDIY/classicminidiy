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

# Preflight: the origin must actually answer before any assertion runs.
#
# Several checks below are satisfied by an EMPTY response — the indexable gate
# greps for a noindex tag it will not find, and the chat gate falls through its
# case to the ok branch. Run against an unreachable host they report PASS, so a
# typo'd or unsubstituted origin produces a partly-green battery describing a
# deployment nobody contacted. That is the same false assurance this script
# warns about twice below, and the shape of the /mcp bug it failed to catch:
# a check that cannot distinguish "fine" from "never ran".
#
# Curl reports 000 whenever it never got a response line: a malformed URL, a DNS
# miss, a refused connection, a TLS failure — or a TIMEOUT. The first four mean
# the origin is wrong, the last can just mean a cold deploy is slow, so the
# budget matches the 30s every assertion below gets rather than cutting in ahead
# of them. Curl's exit code separates the cases and is reported, so a slow origin
# is never described as a typo'd one.
preflight=$(curl -sS -o /dev/null -m 30 -w '%{http_code}' "$ORIGIN/" 2>/dev/null)
preflight_rc=$?
if [ "$preflight" = "000" ]; then
  case "$preflight_rc" in
    28) reason="timed out after 30s (resolved, but no response)" ;;
    6)  reason="could not resolve host" ;;
    7)  reason="connection refused" ;;
    35) reason="TLS handshake failed" ;;
    3)  reason="malformed URL" ;;
    *)  reason="curl could not connect (exit $preflight_rc)" ;;
  esac
  printf '  \033[31mABORT\033[0m  %s: %s\n' "$ORIGIN" "$reason"
  echo
  echo "Nothing was verified. If the origin itself looks wrong, check the"
  echo "argument — a placeholder like <preview-origin> is not substituted for you."
  exit 2
fi


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
# The 401 comes from server/middleware/mcp-auth.ts, which runs BEFORE the handler
# — so it proves auth is wired, and nothing about whether the handler works. That
# is how #721 stayed green: every authenticated call 500'd for months while this
# check passed. Set MCP_SMOKE_KEY to a key the origin accepts to test the handler.
if [ -n "${MCP_SMOKE_KEY:-}" ]; then
  mcp_body=$(curl -sS -m 30 -X POST "$ORIGIN/mcp" \
    -H "Authorization: Bearer $MCP_SMOKE_KEY" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' 2>/dev/null)
  if printf '%s' "$mcp_body" | grep -q 'gearbox-calculator'; then
    ok "/mcp authenticated tools/list returns the tool catalogue"
  else
    bad "/mcp authenticated tools/list did not list tools (got: $(printf '%s' "$mcp_body" | head -c 200))"
  fi
else
  printf '  ....  %s\n' "/mcp authenticated tools/list (set MCP_SMOKE_KEY to run)"
fi

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
  # LOCAL-FILE TRANSFORM. This is the shape that broke on Vercel under ipx
  # (nuxt/image#1281): a transform whose SOURCE is a file in public/, not a remote
  # URL. ipx resolved it with a filesystem read and 404'd because public/ ships to
  # the CDN, not the function. On Cloudflare public/ is served by Workers Static
  # Assets on the same zone, so it SHOULD resolve as a same-zone fetch — but that
  # could not be tested before a zone existed, so it is an explicit gate here.
  local_img=$(curl -sS -m 30 "$ORIGIN/" 2>/dev/null \
              | grep -oE 'src="/cdn-cgi/image/[^"]+' | sed 's/^src="//' \
              | grep -vE '/https?:' | head -1)
  if [ -n "$local_img" ]; then
    lct=$(curl -sS -o /dev/null -m 30 -w '%{content_type}' "$ORIGIN$local_img" 2>/dev/null)
    case "$lct" in
      image/*) ok "LOCAL public/ file transforms ($lct)" ;;
      *)       bad "local public/ transform returned $lct — the nuxt/image#1281 shape is broken" ;;
    esac
  else
    bad "no local-file /cdn-cgi/image/ URL found — cannot verify the #1281 case"
  fi

  hsts=$(curl -sSI -m 30 "$ORIGIN/" 2>/dev/null | grep -ci 'strict-transport-security')
  [ "$hsts" -ge 1 ] && ok "HSTS header present" || bad "HSTS header missing"

  # TME redirect map. Only assertable once theminiexchange.com resolves to
  # Cloudflare — a Host header against workers.dev is rejected at the edge (403)
  # before the worker runs, so this cannot be faked from a preview.
  # `dig` is REQUIRED, not optional. If it is missing the guard below cannot tell
  # "zone not migrated" from "cannot check", and would silently skip the whole
  # redirect estate while the battery still reports success — the same
  # false-assurance failure this script already shipped once.
  #
  # The query is pinned to a public resolver: the migration plan records that a
  # cached LOCAL resolver answer produced confident wrong readings during the
  # pathfinder cutover, and a stale cache here would skip the gate on the one day
  # it matters.
  if ! command -v dig >/dev/null 2>&1; then
    bad "dig is not installed — cannot verify the TME redirect map (install dnsutils/bind-utils)"
    tme_ns=""
  else
    tme_ns=$(dig +short NS theminiexchange.com @1.1.1.1 2>/dev/null | grep -ci cloudflare)
  fi
  if [ "${tme_ns:-0}" -ge 1 ]; then
    for probe in "/:exchange" "/listings/abc:exchange/listings/abc" "/terms:legal/marketplace-terms"; do
      src="${probe%%:*}"; want="${probe##*:}"
      loc=$(curl -sS -o /dev/null -m 25 -w '%{redirect_url}' "https://www.theminiexchange.com$src" 2>/dev/null)
      case "$loc" in
        *"$want"*) ok "TME $src -> $want" ;;
        *)         bad "TME $src -> $loc (wanted …/$want)" ;;
      esac
    done
    # An unmapped TME path must 404, not blanket-redirect — a catch-all would turn
    # the whole unmatched URL space into soft-200 redirects.
    tme404=$(curl -sSL -o /dev/null -m 25 -w '%{http_code}' "https://www.theminiexchange.com/definitely-not-mapped-xyz" 2>/dev/null)
    [ "$tme404" = "404" ] && ok "unmapped TME path is a real 404" || bad "unmapped TME path -> $tme404, want 404"
  else
    skip "TME redirect map"
  fi
else
  skip "images emit /cdn-cgi/image/ WITH modifiers"
  skip "transformed bytes"
  skip "LOCAL public/ file transforms"
  skip "HSTS header present"
  skip "TME redirect map"
fi

# The assistant is a headline feature and it depends on a build-baked
# credential, so a deploy can be green in every other respect while chat is
# dead for every visitor — which is exactly what happened on the first CI
# deploy: build, deploy and this smoke test all passed while
# /api/langgraph/** answered 500 because NUXT_LANGSMITH_API_KEY was empty.
#
# This asserts only that OUR side is configured: an upstream auth rejection
# means we shipped without credentials. Other upstream failures are tolerated,
# so a LangGraph outage does not fail our deploy.
chat_body=$(curl -sS -m 30 -X POST "$ORIGIN/api/langgraph/threads/new/runs/stream" \
  -H 'Content-Type: application/json' \
  -d '{"assistant_id":"agent","input":{"messages":[{"type":"human","content":"deploy smoke test"}]}}' 2>/dev/null | head -c 2000)

case "$chat_body" in
  *"Missing authentication headers"*|*"HTTP 401"*|*"HTTP 403"*)
    bad "chat proxy has no upstream credentials (NUXT_LANGSMITH_API_KEY empty in the build?)"
    ;;
  *)
    ok "chat proxy authenticates upstream"
    ;;
esac

echo
printf 'passed %d, failed %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
