#!/usr/bin/env python3
"""Generate theminiexchange.com's zone-edge redirect rules from the app's table.

The 28-entry map in `server/utils/tmeRedirects.ts` stays the single source of
truth: the Nitro middleware and its 78 table-driven tests read it, and so does
this script. Nothing is transcribed by hand.

WHY ZONE RULES AND NOT THE WORKER
---------------------------------
`/about`, `/contact`, `/privacy`, `/onboarding`, `/` and `/profile` all exist as
PRERENDERED assets, and on Workers the static asset layer runs BEFORE the worker.
Serving TME from the worker therefore returned 200 with the CMDIY page on those
paths instead of redirecting — measured, and exactly amendment B1's failure mode.
Forcing the worker first for them would turn the CMDIY homepage and several real
pages into per-request SSR forever, which B1 also warns against.

Zone rules run before both, so neither problem exists.

FITTING THE FREE-PLAN CAP
-------------------------
Cloudflare Free allows 10 rules in `http_request_dynamic_redirect` (verified:
"exceeded the maximum number of rules in the phase ...: 28 out of 10"). Grouping
by the TRANSFORM each mapping performs rather than by source collapses 28
mappings into 8 rules, leaving headroom.

ORDERING IS LOAD-BEARING: `/admin/users` is an exact source that must be matched
BEFORE the `/admin` prefix rule, or it would redirect to /admin/exchange/users.
Exact-source rules are therefore emitted before prefix rules.

Usage:  CLOUDFLARE_API_TOKEN=... python3 scripts/sync-tme-zone-redirects.py [--apply]
Without --apply it prints what it would do and changes nothing.
"""
import json, os, re, sys, urllib.request, urllib.error

API = "https://api.cloudflare.com/client/v4"
BASE = "https://www.classicminidiy.com"
ZONE = "theminiexchange.com"
HOST = f'(http.host eq "{ZONE}" or http.host eq "www.{ZONE}")'
APPLY = "--apply" in sys.argv


def call(path, method="GET", body=None):
    token = os.environ["CLOUDFLARE_API_TOKEN"]
    req = urllib.request.Request(f"{API}/{path}", method=method,
                                 data=json.dumps(body).encode() if body else None)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return json.load(e)
        except Exception:
            return {"success": False, "errors": [{"message": f"HTTP {e.code}"}]}


# The map is 19 exact + 9 prefix. Asserted, not assumed: the parser below reads
# a TypeScript file with a regex, and this repo runs Prettier. A formatting pass
# that switches those single quotes to double quotes makes the regex match
# NOTHING — and since applying does a PUT (replace, not merge), a silent parse
# failure would delete every live redirect and leave theminiexchange.com serving
# 404s with no error. A floor is therefore as important as the rule-count ceiling.
EXPECTED_EXACT = 19
EXPECTED_PREFIX = 9


def read_table():
    src = open("server/utils/tmeRedirects.ts").read()
    def pairs(name):
        m = re.search(name + r"[^=]*=\s*\[(.*?)\n\];", src, re.S)
        if not m:
            sys.exit(f"  ABORT: could not locate {name} in server/utils/tmeRedirects.ts "
                     f"(reformatted or renamed?) — refusing to touch live rules")
        found = re.findall(r"""\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]""", m.group(1))
        if not found:
            sys.exit(f"  ABORT: {name} parsed to ZERO entries — refusing to PUT an empty "
                     f"ruleset, which would delete all live redirects")
        return found
    exact, prefix = pairs("TME_EXACT"), pairs("TME_PREFIX")
    if (len(exact), len(prefix)) != (EXPECTED_EXACT, EXPECTED_PREFIX):
        sys.exit(f"  ABORT: expected {EXPECTED_EXACT} exact + {EXPECTED_PREFIX} prefix, got "
                 f"{len(exact)} + {len(prefix)}. If the map genuinely changed, update "
                 f"EXPECTED_* deliberately — a shrinking map must never be silent.")
    return exact, prefix


def path_match(src, kind):
    """Match both slash forms. Vercel's patterns were literal globs (`/about` did
    NOT match `/about/`), and several slash variants exist as prerendered CMDIY
    assets — so a missed variant serves a CMDIY page on a TME URL."""
    if src == "/":
        return 'http.request.uri.path eq "/"'
    if kind == "exact":
        return f'(http.request.uri.path eq "{src}" or http.request.uri.path eq "{src}/")'
    return f'(http.request.uri.path eq "{src}" or starts_with(http.request.uri.path, "{src}/"))'


def build():
    exact, prefix = read_table()
    groups = {}
    for s, d in exact:
        key = "exchange+path" if d == f"{BASE}/exchange{s}" else \
              "root+path" if d == f"{BASE}{s}" else f"static::{d}"
        groups.setdefault(key, []).append(("exact", s))
    for s, d in prefix:
        key = "exchange+path" if d == f"{BASE}/exchange{s}" else \
              "root+path" if d == f"{BASE}{s}" else f"staticprefix::{s}::{d}"
        groups.setdefault(key, []).append(("prefix", s))

    rules = []
    def emit(key, members):
        expr = f"{HOST} and (" + " or ".join(path_match(s, k) for k, s in members) + ")"
        srcs = ", ".join(s for _, s in members)
        if key.startswith("static::"):
            tgt = {"value": key.split("::", 1)[1]}
        elif key.startswith("staticprefix::"):
            _, s, d = key.split("::")
            # Keep whatever follows the prefix: substring() from the prefix length.
            tgt = {"expression": f'concat("{d}", substring(http.request.uri.path, {len(s)}))'}
        # ACCEPTED TRADE — the trailing slash rides through into the target, so
        # `/sold/` -> `/exchange/sold/`. Once CMDIY is on Cloudflare that costs one
        # extra 307 (html_handling is drop-trailing-slash), but it is still a strict
        # improvement on the baseline: vercel.json had ZERO slash-suffixed sources,
        # so `/sold/` matched no rule and served a CMDIY page as a 200 — the
        # duplicate content amendment B1 describes.
        #
        # Fixing it properly needs a slash and a no-slash rule for each of the three
        # concat groups, i.e. 11 rules against a Free-plan cap of 10. Cloudflare's
        # expression language has no conditional and regex_replace is Business+, so
        # there is no single-rule form. Revisit if the zone ever goes Pro.
        elif key == "exchange+path":
            tgt = {"expression": f'concat("{BASE}/exchange", http.request.uri.path)'}
        else:
            tgt = {"expression": f'concat("{BASE}", http.request.uri.path)'}
        rules.append({
            "action": "redirect", "enabled": True, "expression": expr,
            "description": f"TME {key.split('::')[0]}: {srcs}"[:200],
            "action_parameters": {"from_value": {
                "status_code": 301, "target_url": tgt, "preserve_query_string": True}},
        })

    # Exact-only groups first, then mixed, then prefix-only — so /admin/users
    # (exact, inside root+path) is evaluated before the /admin prefix rule.
    static_exact = {k: v for k, v in groups.items() if k.startswith("static::")}
    mixed = {k: v for k, v in groups.items() if k in ("exchange+path", "root+path")}
    static_prefix = {k: v for k, v in groups.items() if k.startswith("staticprefix::")}
    for k, v in static_exact.items(): emit(k, v)
    for k, v in mixed.items(): emit(k, sorted(v, key=lambda m: m[0] != "exact"))
    for k, v in static_prefix.items(): emit(k, v)
    return rules


rules = build()
print(f"  {len(rules)} rules generated from server/utils/tmeRedirects.ts")
for r in rules:
    print(f"    - {r['description'][:88]}")
if len(rules) > 10:
    sys.exit(f"  ABORT: {len(rules)} rules exceeds the Free-plan cap of 10")

if not APPLY:
    print("\n  (dry run — pass --apply to write)")
    sys.exit(0)

zid = (call(f"zones?name={ZONE}").get("result") or [{}])[0]["id"]
res = call(f"zones/{zid}/rulesets/phases/http_request_dynamic_redirect/entrypoint", "PUT", {"rules": rules})
if res.get("success"):
    print(f"\n  APPLIED: {len(res['result'].get('rules') or [])} rules live on {ZONE}")
else:
    print("\n  FAILED:", [e.get("message") for e in res.get("errors", [])])
    sys.exit(1)
