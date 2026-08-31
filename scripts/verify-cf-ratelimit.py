#!/usr/bin/env python3
"""Assert the Cloudflare zone rate-limit rules that stand in for stubbed BotID.

`nuxt.config.ts` aliases `botid/server` to a stub on Cloudflare builds, so every
`checkBotId()` call is a no-op in production. The contract stated there is that
each route which calls it must be covered by BOTH an in-app limiter
(`server/middleware/rate-limit.ts`) and a Cloudflare **zone** rate-limit rule.

Two sources of demand, because deriving the list from `checkBotId()` alone made
the assertion accidental rather than principled:

  * routes that call `checkBotId()`, derived from source, and
  * ALWAYS_REQUIRED below — routes that need a zone rule for a reason that has
    nothing to do with BotID.

The chat proxy is why the second list exists. It used to call `checkBotId()`, so
its zone rule was covered here as a side effect; when the call was removed on
2026-08-31 (it classified nothing and implied a guarantee the platform does not
provide) the rule would have silently stopped being asserted, even though the
reason it must exist — an unauthenticated endpoint that spends money on every
request — was untouched. A route earns a zone rule by what it costs an abuser to
call, not by which library it happens to import.

The zone half lives in the Cloudflare dashboard, not this repo, so nothing in CI
could see it and it was a thing only a human could confirm. This script is that
confirmation, and it derives the list of routes it demands coverage for FROM THE
SOURCE — so adding a new `checkBotId()` call makes this fail until the zone rule
is extended, rather than silently shipping an unprotected route.

Cloudflare's WAF and rate limiting are configured per ZONE, never account-wide.

Deliberately prints no thresholds. This repo is public, and an abuse threshold
tuned in infra is exactly the kind of operational detail CLAUDE.md says not to
publish. The script asserts that coverage EXISTS; what the limits are stays in
the dashboard.

Usage:
    CLOUDFLARE_API_TOKEN=... python3 scripts/verify-cf-ratelimit.py

Exits non-zero if a route that calls checkBotId() has no matching zone rule.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

ZONE_NAME = "classicminidiy.com"
API = "https://api.cloudflare.com/client/v4"

# Routes that must have a zone rate-limit rule regardless of BotID, with the
# reason stated so a future reader can judge whether it still holds. Keep this
# to routes where an anonymous caller can make us spend money or do real work.
ALWAYS_REQUIRED = {
    "/api/langgraph/*": "unauthenticated AI chat proxy — every POST bills an LLM run",
}

token = os.environ.get("CLOUDFLARE_API_TOKEN")
if not token:
    sys.exit("CLOUDFLARE_API_TOKEN is not set. This reads zone config; it writes nothing.")


def call(path):
    req = urllib.request.Request(
        f"{API}/{path}", headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e)


def strip_comments(src):
    """Blank // and /* */ comments, preserving newlines.

    Prose is not a call. `server/api/models/checkout.post.ts` carries the
    comment "Do NOT re-add checkBotId() without ..." — a record of the incident
    where BotID false-positive-blocked essentially every real buyer at checkout.
    Scanning raw source counted that as a call and demanded a zone rule for a
    route that deliberately has no BotID at all.
    """
    src = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), src, flags=re.S)
    return re.sub(r"//[^\n]*", "", src)


def routes_calling_botid():
    """Every server route whose source calls checkBotId(), as a URL path."""
    found = []
    for root, _dirs, files in os.walk("server/api"):
        for name in files:
            if not name.endswith(".ts"):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8") as fh:
                src = strip_comments(fh.read())
            # An import alone is not a call.
            if not re.search(r"\bcheckBotId\s*\(", src):
                continue
            # server/api/models/seller/onboard.post.ts -> /api/models/seller/onboard
            url = "/" + os.path.relpath(path, "server").replace(os.sep, "/")
            url = re.sub(r"\.(get|post|put|patch|delete)?\.ts$", "", url)
            url = re.sub(r"\.ts$", "", url)
            url = re.sub(r"/index$", "", url)
            # A catch-all segment covers everything beneath its parent.
            url = re.sub(r"/\[\.\.\.[^\]]+\]$", "/*", url)
            found.append(url)
    return sorted(set(found))


def covered(path, expressions):
    """True if some rule expression plausibly matches this path.

    Matching is intentionally loose — a Cloudflare expression is not a thing to
    reimplement here. It checks that the path, or a wildcard prefix of it,
    appears literally in some rule.
    """
    literal = path.rstrip("/*")
    for expr in expressions:
        if path in expr:
            return True
        # `/api/langgraph/*` in the rule covers `/api/langgraph/threads`
        for m in re.findall(r'"([^"]+)"', expr):
            if m.endswith("*") and literal.startswith(m[:-1].rstrip("/")):
                return True
            if m == literal:
                return True
    return False


zones = call(f"zones?name={ZONE_NAME}").get("result") or []
if not zones:
    sys.exit(f"zone {ZONE_NAME} not found or not readable by this token")
zid = zones[0]["id"]

resp = call(f"zones/{zid}/rulesets/phases/http_ratelimit/entrypoint")
if not resp.get("success"):
    msgs = "; ".join(e.get("message", "?") for e in resp.get("errors", []))
    sys.exit(f"could not read the rate-limit ruleset: {msgs}")

rules = [r for r in (resp.get("result") or {}).get("rules") or [] if r.get("enabled", True)]
expressions = [r.get("expression", "") for r in rules]

botid_routes = routes_calling_botid()
targets = sorted(set(botid_routes) | set(ALWAYS_REQUIRED))

print(f"Zone {ZONE_NAME}: {len(rules)} enabled rate-limit rule(s)")
print(f"Routes calling checkBotId() (BotID is stubbed on Cloudflare): {len(botid_routes)}")
print(f"Routes required regardless of BotID: {len(ALWAYS_REQUIRED)}\n")

failed = 0
for path in targets:
    why = ALWAYS_REQUIRED.get(path)
    label = f"{path}  ({why})" if why else path
    if covered(path, expressions):
        print(f"  ok    {label}")
    else:
        print(f"  FAIL  {label}  — no enabled zone rate-limit rule matches it")
        failed += 1

if failed:
    print(
        f"\n{failed} route(s) need a zone rate-limit rule and have none. Add the\n"
        "path to the zone rule's expression. If the route is in ALWAYS_REQUIRED and\n"
        "genuinely no longer needs one, remove the entry AND say why — do not just\n"
        "delete it to make this pass."
    )
    sys.exit(1)

print("\nEvery route needing a zone rate-limit rule is covered by an enabled one.")
