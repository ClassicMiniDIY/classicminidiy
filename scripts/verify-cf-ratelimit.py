#!/usr/bin/env python3
"""Assert the Cloudflare zone rate-limit rules that stand in for stubbed BotID.

`nuxt.config.ts` aliases `botid/server` to a stub on Cloudflare builds, so every
`checkBotId()` call is a no-op in production. The contract stated there is that
each route which calls it must be covered by BOTH an in-app limiter
(`server/middleware/rate-limit.ts`) and a Cloudflare **zone** rate-limit rule.

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

targets = routes_calling_botid()
print(f"Zone {ZONE_NAME}: {len(rules)} enabled rate-limit rule(s)")
print(f"Routes calling checkBotId() (BotID is stubbed on Cloudflare): {len(targets)}\n")

failed = 0
for path in targets:
    if covered(path, expressions):
        print(f"  ok    {path}")
    else:
        print(f"  FAIL  {path}  — no enabled zone rate-limit rule matches it")
        failed += 1

if not targets:
    print("  (no route calls checkBotId() any more — this script can be deleted)")

if failed:
    print(
        f"\n{failed} route(s) call checkBotId(), which does nothing on Cloudflare,\n"
        "and have no zone rate-limit rule behind them. Add the path to the zone\n"
        "rule's expression, or drop the checkBotId() call if it is not needed."
    )
    sys.exit(1)

print("\nEvery stubbed-BotID route is covered by an enabled zone rate-limit rule.")
