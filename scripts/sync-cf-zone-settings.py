#!/usr/bin/env python3
"""Apply classicminidiy.com's zone-level settings that live only in Cloudflare.

Some of the migration's configuration has no home in the codebase: it is state in
Cloudflare, applied once by hand and then invisible. If the zone were ever
recreated, nothing here would tell you these had to exist. This script is that
record, and it is idempotent — safe to re-run at any time.

It deliberately does NOT manage:
  - DNS records          (Route 53 remains the authoritative source; see the
                          migration plan's dump-and-diff procedure)
  - the TME redirect map (scripts/sync-tme-zone-redirects.py, generated from
                          server/utils/tmeRedirects.ts)
  - worker routes        (wrangler.jsonc)

Usage:  CLOUDFLARE_API_TOKEN=... python3 scripts/sync-cf-zone-settings.py [--apply]
Without --apply it prints the diff and changes nothing.
"""
import json, os, sys, urllib.request, urllib.error

API = "https://api.cloudflare.com/client/v4"
ZONE = "classicminidiy.com"
WWW = f"www.{ZONE}"
APPLY = "--apply" in sys.argv


def call(path, method="GET", body=None):
    req = urllib.request.Request(f"{API}/{path}", method=method,
                                 data=json.dumps(body).encode() if body else None)
    req.add_header("Authorization", f"Bearer {os.environ['CLOUDFLARE_API_TOKEN']}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return json.load(e)
        except Exception:
            return {"success": False, "errors": [{"message": f"HTTP {e.code}"}]}


# --- settings -------------------------------------------------------------
# always_use_https: Vercel redirected http->https for us; nothing does on
# Cloudflare unless this is on.
#
# HSTS: two years, per the migration plan's amendment C3. Deliberately WITHOUT
# include_subdomains — auth. (Supabase), news. (Ghost), forum. (Discourse) and
# the Shopify hostnames are third parties that terminate their own TLS, and
# forcing HSTS onto them is not ours to do. Deliberately WITHOUT preload, which
# is a one-way door and deserves its own decision.
SETTINGS = {
    "always_use_https": "on",
    "security_header": {"strict_transport_security": {
        "enabled": True, "max_age": 63072000,
        "include_subdomains": False, "preload": False, "nosniff": True}},
}

# The apex must redirect to www. Vercel served this as a 308; without it the apex
# serves the ENTIRE SITE as a 200 with index,follow — duplicate content on every
# URL, with only a canonical (a hint, not a directive) pointing at www. This was
# missed at cutover and found by diffing against docs/baselines/.
APEX_RULE = {
    "action": "redirect", "enabled": True,
    # Apex ONLY. Matching www as well would loop.
    "expression": f'(http.host eq "{ZONE}")',
    "description": "apex -> www (Vercel served this as a 308; without it the apex is duplicate content)",
    "action_parameters": {"from_value": {
        "status_code": 301,
        "target_url": {"expression": f'concat("https://{WWW}", http.request.uri.path)'},
        "preserve_query_string": True}},
}

zid = (call(f"zones?name={ZONE}").get("result") or [{}])[0].get("id")
if not zid:
    sys.exit(f"  zone {ZONE} not found or not readable by this token")

changed = []
for name, want in SETTINGS.items():
    cur = (call(f"zones/{zid}/settings/{name}").get("result") or {}).get("value")
    if cur == want:
        print(f"  ok       {name}")
        continue
    changed.append(name)
    print(f"  DIFFERS  {name}\n     have: {json.dumps(cur)[:90]}\n     want: {json.dumps(want)[:90]}")
    if APPLY:
        r = call(f"zones/{zid}/settings/{name}", "PATCH", {"value": want})
        print("     ->", "applied" if r.get("success") else r.get("errors"))

cur_rules = (call(f"zones/{zid}/rulesets/phases/http_request_dynamic_redirect/entrypoint")
             .get("result") or {}).get("rules") or []
has_apex = any(r.get("expression") == APEX_RULE["expression"] for r in cur_rules)
if has_apex and len(cur_rules) == 1:
    print("  ok       apex->www redirect rule")
else:
    changed.append("apex-redirect")
    print(f"  DIFFERS  apex->www redirect rule (zone has {len(cur_rules)} rule(s), apex present={has_apex})")
    if APPLY:
        # PUT replaces the phase. Safe here because this zone's ONLY dynamic
        # redirect is the apex rule — the TME map lives on its own zone. Guard
        # anyway so a future rule cannot be silently destroyed.
        unknown = [r for r in cur_rules if r.get("expression") != APEX_RULE["expression"]]
        if unknown:
            print("     -> REFUSING: zone has other redirect rules this script does not know about:")
            for r in unknown:
                print("        ", (r.get("description") or r.get("expression"))[:80])
            sys.exit(1)
        r = call(f"zones/{zid}/rulesets/phases/http_request_dynamic_redirect/entrypoint",
                 "PUT", {"rules": [APEX_RULE]})
        print("     ->", "applied" if r.get("success") else r.get("errors"))

if not changed:
    print("\n  zone matches the committed configuration")
elif not APPLY:
    print(f"\n  {len(changed)} difference(s) — pass --apply to write")
