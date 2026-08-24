#!/usr/bin/env python3
"""Verify the cmdiy-cf-migration Cloudflare token's scope and permissions.

Reads CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from the environment (load
with `set -a; . ./.env; set +a`). The token value is never placed in a command
line, printed, or included in any error message -- an earlier shell version of
this check leaked it into a transcript via zsh's command-not-found echo.

Read-only. Exits non-zero if any required permission is missing.
"""
import json, os, sys, urllib.request, urllib.error

API = "https://api.cloudflare.com/client/v4"
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")

CMDIY_ZONES = ["classicminidiy.com", "theminiexchange.com",
               "classicminidiy.net", "classicminidiy.org", "wheeldictionary.com"]
FOREIGN_ZONES = ["oecua.org", "openecualliance.org", "deathlyhallows.co"]

if not TOKEN or not ACCOUNT:
    sys.exit("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not in environment. "
             "Run: set -a; . ./.env; set +a")


def call(path):
    """GET path. Returns (ok, payload). Never echoes the token, even on error."""
    req = urllib.request.Request(f"{API}/{path}")
    req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return True, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return False, json.load(e)
        except Exception:
            return False, {"errors": [{"message": f"HTTP {e.code}"}]}
    except Exception:
        return False, {"errors": [{"message": "request failed"}]}


def msg(payload):
    return "; ".join(e.get("message", "?") for e in payload.get("errors", [])) or "denied"


def zone_id(name):
    ok, d = call(f"zones?name={name}")
    r = d.get("result") or []
    return r[0]["id"] if ok and r else None


failures = []
print("== zone scope ==")
for z in CMDIY_ZONES:
    zid = zone_id(z)
    if not zid:
        print(f"  {z:<24} MISSING - zone not created"); failures.append(f"{z} missing"); continue
    ok, d = call(f"zones/{zid}/dns_records?per_page=1")
    print(f"  {z:<24} {'reachable' if ok else 'DENIED - ' + msg(d)}")
    if not ok:
        failures.append(f"{z} unreachable")

print("\n== isolation (these MUST be denied) ==")
for z in FOREIGN_ZONES:
    zid = zone_id(z)
    if not zid:
        print(f"  {z:<24} not visible - good"); continue
    ok, d = call(f"zones/{zid}/dns_records?per_page=1")
    print(f"  {z:<24} {'** WRITE SCOPE LEAK - DNS readable **' if ok else 'denied - good'}")
    if ok:
        failures.append(f"{z} readable — isolation broken")

print("\n== required zone permissions (on classicminidiy.com) ==")
cid = zone_id("classicminidiy.com")
if cid:
    for path, label in [("settings/always_use_https", "Zone Settings"),
                        ("ssl/universal/settings", "SSL and Certificates"),
                        ("workers/routes", "Workers Routes"),
                        ("rulesets", "Dynamic URL Redirects (rulesets)")]:
        ok, d = call(f"zones/{cid}/{path}")
        print(f"  {label:<34} {'OK' if ok else 'DENIED - ' + msg(d)}")
        if not ok:
            failures.append(label)

print("\n== required account permissions ==")
for path, label in [("workers/scripts", "Workers Scripts"),
                    ("storage/kv/namespaces", "Workers KV Storage")]:
    ok, d = call(f"accounts/{ACCOUNT}/{path}")
    n = len(d.get("result") or []) if ok else 0
    print(f"  {label:<34} {'OK (%d existing)' % n if ok else 'DENIED - ' + msg(d)}")
    if not ok:
        failures.append(label)

print("\n== optional (needed only if B1 uses a Bulk Redirects list) ==")
ok, d = call(f"accounts/{ACCOUNT}/rules/lists")
print(f"  {'Bulk Redirect Lists':<34} {'OK' if ok else 'not granted - add if needed'}")

print()
if failures:
    print("RESULT: FAILED -", "; ".join(failures)); sys.exit(1)
print("RESULT: token scope and permissions verified")
