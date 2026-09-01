#!/usr/bin/env bash
# JSON-RPC transport tests for /mcp, run against a BUILT Cloudflare artifact.
#
# Why this exists as a separate script rather than more Vitest:
#
# The unit tests under tests/unit/server/mcp/ stub defineMcpTool/jsonResult and
# call `.handler()` directly. They prove the tool logic and nothing else — no
# routing, no auth middleware, no @nuxtjs/mcp-toolkit, no JSON-RPC framing, and
# critically no transport PROVIDER. mcp-toolkit picks its provider at BUILD time
# from the Nitro preset, so the Cloudflare path only exists in a cloudflare
# build. Issue #721 was a fault in exactly that provider: every authenticated
# call 500'd while every unit test stayed green, because no test in the repo
# spoke the protocol.
#
# A Nuxt/Vitest e2e test would not have caught it either — it would exercise the
# NODE provider. Only a real request to a real worker does.
#
# Usage:  ./scripts/test-mcp-transport.sh [port]
# Requires .output built with NITRO_PRESET=cloudflare_module:
#   NITRO_PRESET=cloudflare_module bun run build
#
# Supabase-backed tools are skipped unless SUPABASE_SERVICE_KEY is set; they need
# a live database and their absence must not fail an offline run.

set -uo pipefail

PORT="${1:-8799}"
ORIGIN="http://localhost:$PORT"
KEY="mcp-transport-test-$$"

PASS=0
FAIL=0
ok()  { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS + 1)); }
bad() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL + 1)); }
note() { printf '  ....  %s\n' "$1"; }
# Unsigned-integer test, used before any [ -eq ] on a value parsed out of a
# response body. Builtin `case` rather than a grep subprocess.
is_uint() { case "${1:-}" in '' | *[!0-9]*) return 1 ;; *) return 0 ;; esac; }

if [ ! -f .output/server/index.mjs ]; then
  echo "ERROR: .output/server/index.mjs not found."
  echo "Build first: NITRO_PRESET=cloudflare_module bun run build"
  exit 2
fi

# The provider is baked in at build time, so a node-preset build would test the
# wrong code path while looking identical. Fail loudly rather than pass falsely —
# that is the whole lesson of #721.
if ! grep -rqs "agents/mcp\|createLegacyMcpHandler\|createMcpHandler" .output/server/chunks/nitro/nitro.mjs .output/server/chunks 2>/dev/null; then
  echo "ERROR: this .output does not contain the Cloudflare MCP provider."
  echo "Rebuild with NITRO_PRESET=cloudflare_module, or these tests prove nothing."
  exit 2
fi

# Refuse to run if the port is already taken.
#
# Checked by BINDING rather than by asking whether something answers HTTP,
# because the occupant may not speak HTTP at all — and because the dangerous
# case is an occupant that answers perfectly: a stale `wrangler dev` in this
# directory serving an OLD .output. wrangler does not fail loudly on a busy
# port, and it hot-reloads .dev.vars, so that stale worker would pick up the key
# written below and could take the whole suite green while certifying an
# artifact that is not the one about to deploy. A liveness check on our own PID
# does not cover it. Refusing to start does.
if ! python3 -c "
import socket, sys
s = socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(('127.0.0.1', $PORT))
except OSError:
    sys.exit(1)
finally:
    s.close()
" 2>/dev/null; then
  echo "ERROR: port $PORT is already in use."
  echo "Refusing to run: whatever is listening would answer these requests, and a"
  echo "stale wrangler serving an older .output can pass them while proving nothing"
  echo "about the artifact about to deploy."
  echo "Free the port, or pass another: ./scripts/test-mcp-transport.sh 8801"
  exit 2
fi

WORK_DIR=$(mktemp -d)
DEV_VARS_BACKUP=""
[ -f .dev.vars ] && DEV_VARS_BACKUP="$WORK_DIR/.dev.vars.bak" && cp .dev.vars "$DEV_VARS_BACKUP"

cleanup() {
  [ -n "${WRANGLER_PID:-}" ] && kill "$WRANGLER_PID" 2>/dev/null
  pkill -f "wrangler dev .output/server/index.mjs --assets .output/public --port $PORT" 2>/dev/null
  if [ -n "$DEV_VARS_BACKUP" ]; then cp "$DEV_VARS_BACKUP" .dev.vars; else rm -f .dev.vars; fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

{
  echo "NUXT_MCP_API_KEY=$KEY"
  [ -n "${SUPABASE_SERVICE_KEY:-}" ] && echo "NUXT_SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY"
} > .dev.vars

echo "Starting worker on $ORIGIN ..."
bunx wrangler dev .output/server/index.mjs --assets .output/public --port "$PORT" --local \
  > "$WORK_DIR/wrangler.log" 2>&1 &
WRANGLER_PID=$!

for _ in $(seq 1 180); do
  curl -s -o /dev/null -m 2 "$ORIGIN/" 2>/dev/null && break
  sleep 1
done
if ! curl -s -o /dev/null -m 5 "$ORIGIN/" 2>/dev/null; then
  echo "ERROR: worker did not come up. Last lines:"
  tail -20 "$WORK_DIR/wrangler.log"
  exit 2
fi

# Something answering on the port is NOT proof that it is OUR worker. If the port
# was already held — a previous run killed mid-flight, or a developer's own
# `wrangler dev` — our process exits on the failed bind while the squatter answers
# the readiness probe, and the whole suite then certifies an artifact that is not
# the one about to deploy. Worse, `wrangler dev` hot-reloads .dev.vars, so a stale
# worker in this directory picks up the key written above and even the
# authenticated checks go green: a full false pass on the wrong build.
if ! kill -0 "$WRANGLER_PID" 2>/dev/null; then
  echo "ERROR: our wrangler process is gone, but something is answering on port $PORT."
  echo "That is almost certainly a stale worker or another dev server holding the port."
  echo "Nothing was verified. Free the port (or pass a different one) and re-run."
  tail -20 "$WORK_DIR/wrangler.log"
  exit 2
fi
echo

# rpc <json-body> [auth: yes|no] -> body on stdout, HTTP status in $STATUS_FILE.
#
# The status goes through a FILE, not a variable. `out=$(rpc ...)` runs the
# function in a subshell, so a status assigned to a shell variable inside it is
# discarded and the caller silently reads the PREVIOUS call's value — which
# reports a failure that did not happen, and can just as easily report a pass
# that did not happen.
STATUS_FILE="$WORK_DIR/status"
rpc() {
  local body="$1" auth="${2:-yes}"
  local -a hdrs=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
  [ "$auth" = "yes" ] && hdrs+=(-H "Authorization: Bearer $KEY")
  local out
  out=$(curl -s -m 30 -w '\n%{http_code}' -X POST "$ORIGIN/mcp" "${hdrs[@]}" --data "$body" 2>/dev/null)
  printf '%s' "${out##*$'\n'}" > "$STATUS_FILE"
  printf '%s' "${out%$'\n'*}"
}

# Status of the most recent rpc call. Errors loudly if no call has been made,
# so a typo cannot silently compare against an empty string.
rpc_status() { cat "$STATUS_FILE" 2>/dev/null || echo "NO-STATUS"; }

# The transport may answer as plain JSON or as an SSE frame; both are valid
# Streamable HTTP. Normalise so assertions do not depend on which was used.
#
# The fallback is load-bearing, not defensive clutter: stripping only the SSE
# `data:` prefix yields an EMPTY string for a plain-JSON body, which would fail
# every downstream assertion and block deploys of a perfectly healthy /mcp. The
# Cloudflare provider answers SSE today, so that is one upstream change away.
payload() {
  local body
  body=$(cat)
  local sse
  sse=$(printf '%s' "$body" | sed -n 's/^data: //p' | head -1)
  if [ -n "$sse" ]; then printf '%s' "$sse"; else printf '%s' "$body"; fi
}

jq_get() { python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read() or '{}')
except Exception:
    print(''); raise SystemExit
for k in '$1'.split('.'):
    if k == '': continue
    if isinstance(d, list):
        try: d = d[int(k)]
        except Exception: print(''); raise SystemExit
    elif isinstance(d, dict): d = d.get(k, '')
    else: print(''); raise SystemExit
print(json.dumps(d) if isinstance(d, (dict, list)) else (d if d is not None else ''))
"; }

echo "== auth =="
rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' no > /dev/null
status=$(rpc_status)
[ "$status" = "401" ] && ok "unauthenticated tools/list -> 401" \
  || bad "unauthenticated tools/list -> $status, want 401"

out=$(rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' yes)
status=$(rpc_status)
[ "$status" = "200" ] && ok "authenticated tools/list -> 200" \
  || bad "authenticated tools/list -> $status, want 200"

echo
echo "== JSON-RPC envelope =="
# #721's exact shape: auth passes, the handler throws, the caller gets a 500.
# Asserting on the ENVELOPE is what makes that visible.
init=$(rpc '{"jsonrpc":"2.0","id":7,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"transport-test","version":"1"}}}' yes | payload)
[ "$(printf '%s' "$init" | jq_get 'jsonrpc')" = "2.0" ] && ok "initialize returns a JSON-RPC 2.0 envelope" \
  || bad "initialize envelope wrong: $(printf '%s' "$init" | head -c 120)"
[ "$(printf '%s' "$init" | jq_get 'id')" = "7" ] && ok "initialize echoes the request id" \
  || bad "initialize id not echoed"
sname=$(printf '%s' "$init" | jq_get 'result.serverInfo.name')
[ -n "$sname" ] && ok "initialize advertises serverInfo ($sname)" || bad "initialize has no serverInfo.name"
pver=$(printf '%s' "$init" | jq_get 'result.protocolVersion')
[ -n "$pver" ] && ok "initialize advertises protocolVersion ($pver)" || bad "initialize has no protocolVersion"

echo
echo "== tools/list =="
list=$(printf '%s' "$out" | payload)
names=$(printf '%s' "$list" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read() or '{}')
print('\n'.join(t['name'] for t in d.get('result', {}).get('tools', [])))
")
count=$(printf '%s' "$names" | grep -c . || true)
[ "$count" -ge 11 ] && ok "tools/list returns $count tools" || bad "tools/list returned $count tools, want >= 11"

# The env key resolves to the INTERNAL tier (Developer API tiering,
# docs/plans/2026-08-28-developer-api-subscription.md), which must see every
# tool — the paid-only set included. A gated or missing tool here means the
# tiering plugin misclassified the env key.
for tool in chassis-decoder engine-decoder wheel-search color-lookup; do
  if printf '%s\n' "$names" | grep -qx "$tool"; then
    ok "internal tier lists paid tool $tool"
  else
    bad "internal tier is missing paid tool $tool"
  fi
done

# Every tool must carry a description and an inputSchema, or a model cannot
# choose it. A tool that lists but cannot be selected is invisible in practice.
missing=$(printf '%s' "$list" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read() or '{}')
bad = [t['name'] for t in d.get('result', {}).get('tools', [])
       if not t.get('description') or not t.get('inputSchema')]
print(','.join(bad))
")
# Guarded on the count: with an empty tool list there is nothing to be missing,
# so this passes vacuously on a dead handler — which is precisely the
# healthy-versus-never-ran confusion this whole suite exists to remove.
if [ "$count" -eq 0 ]; then
  bad "cannot check tool metadata: tools/list returned nothing"
elif [ -z "$missing" ]; then
  ok "all $count tools have a description and an inputSchema"
else
  bad "tools missing description/inputSchema: $missing"
fi

echo
echo "== tools/call =="
# One real call per tool, asserting the RESULT SHAPE the protocol requires:
# result.content[0].text, and isError absent. A tool that throws comes back as
# isError:true with the message in content, which is why isError is checked
# rather than just the HTTP status.
call_tool() {
  local name="$1" args="$2"
  local res
  res=$(rpc "{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}" yes | payload)
  local is_err text
  is_err=$(printf '%s' "$res" | jq_get 'result.isError')
  text=$(printf '%s' "$res" | jq_get 'result.content.0.text')
  if [ "$is_err" = "True" ] || [ "$is_err" = "true" ]; then
    bad "$name -> isError: $(printf '%s' "$text" | head -c 90)"
  elif [ -z "$text" ]; then
    bad "$name -> no result.content[0].text (got $(printf '%s' "$res" | head -c 90))"
  else
    ok "$name -> $(printf '%s' "$text" | tr -d '\n' | head -c 58)..."
  fi
}

call_tool compression-calculator '{"bore":7.06,"stroke":8.128,"pistonDish":6.5,"headVolume":25.5,"deckHeight":20,"gasket":3.4,"decomp":0}'
call_tool gearbox-calculator '{}'
call_tool chassis-decoder '{"yearRange":"1959-1969","chassisNumber":"A-A2S7L-123A"}'
call_tool engine-decoder '{"code":"12H","limit":3}'
call_tool needle-compare '{"mode":"lookup","needle":"AAA"}'
call_tool torque-specs '{"query":"main bearing","limit":3}'
call_tool clearances '{"section":"Engine","limit":3}'
call_tool parts-equivalency '{"query":"K&N","limit":3}'
call_tool vehicle-weights '{"section":"Electrics","limit":3}'

# The two archive tools read Postgres, so they can fail for a reason that has
# nothing to do with the transport. This gate blocks deploys, and coupling that
# to the availability of a third-party database would mean a Supabase outage
# blocks every deploy — including the fix for the outage.
#
# So the assertion is narrowed to what this suite is actually for: a WELL-FORMED
# JSON-RPC envelope carrying a readable result. A tool reporting isError because
# it could not reach the database has still proved the transport works end to
# end, and is reported as a note rather than a failure. A missing or malformed
# envelope is still a hard failure, because that is a transport fault.
call_tool_db_backed() {
  local name="$1" args="$2"
  local res is_err text
  res=$(rpc "{\"jsonrpc\":\"2.0\",\"id\":10,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}" yes | payload)
  is_err=$(printf '%s' "$res" | jq_get 'result.isError')
  text=$(printf '%s' "$res" | jq_get 'result.content.0.text')
  if [ -z "$text" ]; then
    bad "$name -> no result.content[0].text (transport fault): $(printf '%s' "$res" | head -c 90)"
  elif [ "$is_err" = "True" ] || [ "$is_err" = "true" ]; then
    note "$name -> transport OK, backend unavailable: $(printf '%s' "$text" | tr -d '\n' | head -c 60)"
  else
    ok "$name -> $(printf '%s' "$text" | tr -d '\n' | head -c 58)..."
  fi
}

if [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
  call_tool_db_backed wheel-search '{"query":"minilite","limit":3}'
  call_tool_db_backed color-lookup '{"query":"green","limit":3}'
else
  note "wheel-search / color-lookup (set SUPABASE_SERVICE_KEY to run)"
fi

echo
echo "== protocol errors =="
# An unknown method and an unknown tool must come back as JSON-RPC, not as an
# HTTP crash. This is the class of failure #721 produced.
unknown=$(rpc '{"jsonrpc":"2.0","id":11,"method":"no/such/method"}' yes | payload)
code=$(printf '%s' "$unknown" | jq_get 'error.code')
[ -n "$code" ] && ok "unknown method returns a JSON-RPC error (code $code)" \
  || bad "unknown method did not return a JSON-RPC error: $(printf '%s' "$unknown" | head -c 100)"

notool=$(rpc '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"no-such-tool","arguments":{}}}' yes | payload)
if [ -n "$(printf '%s' "$notool" | jq_get 'error.code')" ] \
   || [ "$(printf '%s' "$notool" | jq_get 'result.isError')" = "True" ]; then
  ok "unknown tool is reported, not crashed"
else
  bad "unknown tool neither errored nor reported: $(printf '%s' "$notool" | head -c 100)"
fi

# Bad arguments must be rejected by the schema rather than reaching the handler.
badargs=$(rpc '{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"engine-decoder","arguments":{"limit":-5}}}' yes | payload)
if [ -n "$(printf '%s' "$badargs" | jq_get 'error.code')" ] \
   || [ "$(printf '%s' "$badargs" | jq_get 'result.isError')" = "True" ]; then
  ok "schema-invalid arguments are rejected"
else
  bad "negative limit was accepted: $(printf '%s' "$badargs" | head -c 100)"
fi

echo
echo "== free-tier gating =="
# Everything above authenticates with the ENV key, which resolves to the
# internal tier and sees every tool by design — so none of it can tell a
# working tier gate from one that never ran. That blind spot shipped a fully
# gated free tier to production: every tool, calculators included, answered the
# upsell stub worded 'The "undefined" tool', because the tiering hook read a
# tool name the toolkit does not populate until AFTER the hook. Only a REAL
# free-tier key exercises the gate.
#
# Optional, exactly like MCP_SMOKE_KEY: absent, this notes and skips rather
# than failing a deploy on a missing secret. To arm it, mint a key at
# /dashboard/api-keys and set it with `gh secret set MCP_FREE_TIER_KEY`.
#
# The account that owns that key must be a DEDICATED fixture account that will
# never hold a subscription — not a real person's, and never an admin's. The
# tier is decided per request by user_has_subscription(owner, 'developer'), so
# granting the owner that subscription (an admin comp counts) makes the key
# developer-tier and turns this section into a deploy-blocking failure. The
# tempting fix then is to delete the secret, which is worse than the failure:
# it silently disarms the only check in the repo that can tell a working tier
# gate from one that never ran. Both happened on 2026-08-31.
rpc_as() {
  local key="$1" body="$2"
  local out
  out=$(curl -s -m 30 -w '\n%{http_code}' -X POST "$ORIGIN/mcp" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -H "Authorization: Bearer $key" --data "$body" 2>/dev/null)
  printf '%s' "${out##*$'\n'}" > "$STATUS_FILE"
  printf '%s' "${out%$'\n'*}"
}

if [ -z "${MCP_FREE_TIER_KEY:-}" ]; then
  note "MCP_FREE_TIER_KEY unset — free-tier gating not exercised (set it to arm)"
elif [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
  note "SUPABASE_SERVICE_KEY unset — worker cannot resolve DB-backed keys; skipping"
else
  free_list=$(rpc_as "$MCP_FREE_TIER_KEY" '{"jsonrpc":"2.0","id":20,"method":"tools/list"}' | payload)
  free_status=$(rpc_status)
  if [ "$free_status" != "200" ]; then
    bad "free-tier tools/list -> $free_status, want 200 (is the key valid and unrevoked?)"
  else
    # A free key must see SOME tools ungated and the paid ones gated. All-gated
    # and none-gated both mean something is wrong, but they mean DIFFERENT
    # things, so the two are reported separately below.
    counts=$(printf '%s' "$free_list" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read() or '{}')
tools = d.get('result', {}).get('tools', [])
gated = [t['name'] for t in tools if 'Requires the CMDIY Developer API subscription' in (t.get('description') or '')]
print(len(tools), len(gated), ','.join(sorted(gated)))
")
    total=$(printf '%s' "$counts" | cut -d' ' -f1)
    ngated=$(printf '%s' "$counts" | cut -d' ' -f2)
    gatedlist=$(printf '%s' "$counts" | cut -d' ' -f3)
    # Guard the counts before comparing them. An unparseable body leaves both
    # empty, `[ -eq ]` errors on every branch, and the last one would report an
    # inverted gate that is not there — the exact wrong-diagnosis failure this
    # section was just fixed to stop producing. The body is whitespace-collapsed
    # so a multi-line error page cannot break the one-line PASS/FAIL format.
    if ! is_uint "$total" || ! is_uint "$ngated"; then
      bad "could not count tools in the free-tier tools/list body: $(printf '%s' "$free_list" | tr -s '[:space:]' ' ' | head -c 120)"
    elif [ "$total" -eq 0 ]; then
      # Zero tools is not a tier fault at all, and must not be reported as one:
      # the branches below would blame a subscription for what is really the
      # toolkit registering nothing — the #721 class of failure this whole
      # script exists to catch.
      bad "free-tier tools/list returned 0 tools — the toolkit registered none, so this is a discovery/provider fault, not a tier one"
    elif [ "$ngated" -gt 0 ] && [ "$ngated" -lt "$total" ]; then
      ok "free tier gates $ngated of $total tools ($gatedlist)"
    elif [ "$ngated" -eq 0 ]; then
      # Nothing gated is more often a FIXTURE fault than a code one, so name
      # that first. The tier follows user_has_subscription(owner, 'developer'),
      # so the moment this key's account gains a developer subscription — an
      # admin comp counts — the key resolves to the developer tier and sees
      # every tool ungated, by design. That is what happened on 2026-08-31, and
      # the message below used to send the reader into the tiering code
      # instead. Check the account first, the code second.
      bad "free tier gated 0 of $total tools — does MCP_FREE_TIER_KEY's account hold a 'developer' subscription (an admin comp counts)? Otherwise the gate never ran, or the gated-description marker changed"
    else
      # Every tool gated is the fault this whole section exists to catch: the
      # gate ran and over-applied, as when tool-name derivation returns
      # undefined and FREE_TOOLS therefore matches nothing.
      bad "free tier gated ALL $total tools — the gate is inverted (tool-name derivation?)"
    fi

    # A FREE tool must actually run for a free key.
    freecall=$(rpc_as "$MCP_FREE_TIER_KEY" '{"jsonrpc":"2.0","id":21,"method":"tools/call","params":{"name":"torque-specs","arguments":{"query":"flywheel"}}}' | payload)
    if [ "$(printf '%s' "$freecall" | jq_get 'result.isError')" = "True" ]; then
      bad "free tier cannot call torque-specs: $(printf '%s' "$freecall" | jq_get 'result.content.0.text' | head -c 90)"
    else
      ok "free tier can call a free tool (torque-specs)"
    fi

    # A PAID tool must be refused, and the refusal must NAME the tool — an
    # 'undefined' here means the name derivation broke again.
    paidcall=$(rpc_as "$MCP_FREE_TIER_KEY" '{"jsonrpc":"2.0","id":22,"method":"tools/call","params":{"name":"wheel-search","arguments":{"query":"minilite"}}}' | payload)
    paidtext=$(printf '%s' "$paidcall" | jq_get 'result.content.0.text')
    if [ "$(printf '%s' "$paidcall" | jq_get 'result.isError')" != "True" ]; then
      bad "free tier was served the PAID wheel-search tool"
    elif printf '%s' "$paidtext" | grep -q '"undefined"'; then
      bad "gated message says \"undefined\" — tool-name derivation is broken"
    else
      ok "free tier is refused a paid tool, and the refusal names it"
    fi
  fi
fi

echo
echo "== public routes stay public =="
for path in /mcp/badge.svg /mcp/deeplink; do
  status=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$ORIGIN$path" 2>/dev/null)
  [ "$status" = "200" ] && ok "$path -> 200 (unauthenticated)" || bad "$path -> $status, want 200"
done

# The trailing-slash form reaches the same handler, so it must be gated too.
for path in "/mcp/" "/mcp//"; do
  status=$(curl -s -o /dev/null -m 20 -w '%{http_code}' -X POST "$ORIGIN$path" \
    -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' 2>/dev/null)
  [ "$status" = "401" ] && ok "unauthenticated $path -> 401" || bad "unauthenticated $path -> $status, want 401"
done

echo
printf 'passed %d, failed %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
