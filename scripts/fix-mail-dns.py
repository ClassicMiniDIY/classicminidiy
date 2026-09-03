#!/usr/bin/env python3
"""Apply the mail-DNS fixes from the Forward Email retirement plan.

Design doc: docs/plans/2026-09-03-forward-email-retirement.md

This is the record of a change that otherwise lives only in Cloudflare. Same
reasoning as scripts/sync-cf-zone-settings.py: if a zone were recreated, nothing
in the codebase would say these records had to look like this. Idempotent and
dry-run by default, so it is safe to re-run as a verification pass.

Every sender was identified on 2026-09-03 by reading the Route 53 zones and
confirming with Cole:

  classicminidiy.com   sends via SES ONLY. The Google include is vestigial (no
                       Gmail send-as exists), the Shopify include resolves to
                       bare `v=spf1 ~all` and the store does not send as this
                       domain anyway, and Forward Email is being retired.
                       8 SPF lookups -> 1.
  theminiexchange.com  sends via SES. Its apex names Resend, which is not used
                       anywhere on the platform; SES was absent entirely.
  cmdiy.co             sends via Shopify as orders@cmdiy.co, authenticated by
                       DKIM. Gets NO SPF — see below.

Deliberately NOT touched, because they are live:
  store / merch / account.classicminidiy.com  -> shops.myshopify.com (storefront)
  the six Shopify DKIM CNAMEs on cmdiy.co     -> what makes orders@ authenticate
  maileri5q.classicminidiy.com                -> orphan, but a CNAME costs no
                                                 SPF lookup, so removing it buys
                                                 nothing and risks something

Route 53 is deliberately left alone. It is the frozen pre-change rollback
snapshot, not a mirror, so it will drift from Cloudflare after this runs.

Usage:
  set -a; . ./.env; set +a
  python3 scripts/fix-mail-dns.py [--domain <one>] [--apply]

The Cloudflare token is read from CLOUDFLARE_API_TOKEN and never printed.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"

# --- the desired state -------------------------------------------------------
#
# `spf` is the apex SPF record's exact content, or None to leave it absent.
# `delete` is (type, fqdn) pairs to remove.
CHANGES = [
    {
        "domain": "classicminidiy.com",
        # Keeps the existing `-all`. Only the includes change, so this is a
        # minimal diff: one variable, not two.
        "spf": "v=spf1 include:amazonses.com -all",
        "delete": [("CNAME", "pm-bounces.classicminidiy.com")],  # Postmark, dead
    },
    {
        "domain": "theminiexchange.com",
        # Deliberately keeps `~all` rather than tightening to `-all`, which is
        # what the plan's table originally said. Swapping the include already
        # changes which sender is authorised; tightening the qualifier in the
        # same edit would change two things at once on the domain whose senders
        # are least certain. Tighten to `-all` once DMARC reports confirm.
        "spf": "v=spf1 include:amazonses.com ~all",
        "delete": [("TXT", "resend._domainkey.theminiexchange.com")],  # stale
    },
    {
        "domain": "cmdiy.co",
        # No SPF, on purpose. The only sender is Shopify, which authenticates by
        # DKIM, and whose SPF include grants nothing — so there is no envelope
        # sender to authorise. `v=spf1 -all` is the tempting answer and the
        # wrong one until DMARC aggregate reports confirm Shopify's envelope
        # domain: some receivers weight an SPF hard fail heavily even when DKIM
        # aligns, and a hard fail here would land on the store's own mail.
        "spf": None,
        "delete": [
            ("CNAME", "pm-bounces.cmdiy.co"),
            ("TXT", "20240927014807pm._domainkey.cmdiy.co"),
        ],
    },
]


def cf(path, method="GET", body=None):
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if not token:
        sys.exit("CLOUDFLARE_API_TOKEN not in environment. Run: set -a; . ./.env; set +a")
    req = urllib.request.Request(
        f"{API}/{path}", method=method, data=json.dumps(body).encode() if body else None
    )
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


def errmsg(payload):
    return "; ".join(e.get("message", "?") for e in payload.get("errors", [])) or "denied"


def unquote_txt(value):
    """Cloudflare returns TXT content quoted, and chunked when over 255 bytes."""
    segments, cur, in_quotes, escaped = [], "", False, False
    for ch in value:
        if escaped:
            cur += ch
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            if in_quotes:
                segments.append(cur)
                cur = ""
            in_quotes = not in_quotes
            continue
        if in_quotes:
            cur += ch
    return "".join(segments) if segments else value.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", help="limit to one domain")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    plan = [c for c in CHANGES if not args.domain or c["domain"] == args.domain]
    if not plan:
        sys.exit(f"no change defined for {args.domain}")

    total_ops, failures = 0, 0

    for change in plan:
        domain = change["domain"]
        print(f"\n{'=' * 74}\n{domain}\n{'=' * 74}")

        z = cf(f"zones?name={domain}")
        result = z.get("result") or []
        if not result:
            print(f"  SKIP: no zone visible to this token ({errmsg(z)})")
            continue
        zone = result[0]
        zid = zone["id"]
        if zone["status"] != "active":
            print(f"  NOTE: zone status is '{zone['status']}' — writes are inert until it activates")

        have = cf(f"zones/{zid}/dns_records?per_page=500")
        if have.get("result") is None:
            print(f"  SKIP: cannot read DNS ({errmsg(have)})")
            continue
        records = have["result"]

        # --- SPF ---
        spf_records = [
            r for r in records
            if r["type"] == "TXT"
            and r["name"].rstrip(".") == domain
            and unquote_txt(r.get("content", "")).lower().startswith("v=spf1")
        ]
        want = change["spf"]

        if want is None:
            if spf_records:
                print(f"  spf   present but the plan says none; leaving it alone for review:")
                for r in spf_records:
                    print(f"          {unquote_txt(r['content'])}")
            else:
                print("  spf   absent, as intended")
        elif len(spf_records) > 1:
            print(f"  spf   {len(spf_records)} SPF records at the apex — refusing to guess. Fix by hand.")
            failures += 1
        elif not spf_records:
            print(f"  spf   MISSING, will create: {want}")
            total_ops += 1
            if args.apply:
                res = cf(
                    f"zones/{zid}/dns_records",
                    method="POST",
                    body={"type": "TXT", "name": domain, "content": want, "ttl": 300},
                )
                print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                failures += 0 if res.get("success") else 1
        else:
            rec = spf_records[0]
            current = unquote_txt(rec["content"])
            if current == want:
                print(f"  spf   already correct: {current}")
            else:
                print(f"  spf   from: {current}")
                print(f"          to: {want}")
                total_ops += 1
                if args.apply:
                    res = cf(
                        f"zones/{zid}/dns_records/{rec['id']}",
                        method="PATCH",
                        body={"content": want},
                    )
                    print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                    failures += 0 if res.get("success") else 1

        # --- deletions ---
        for rtype, fqdn in change["delete"]:
            matches = [r for r in records if r["type"] == rtype and r["name"].rstrip(".") == fqdn]
            if not matches:
                print(f"  del   {rtype:<6} {fqdn}  already gone")
                continue
            for rec in matches:
                print(f"  del   {rtype:<6} {fqdn}  -> {str(rec.get('content'))[:44]}")
                total_ops += 1
                if args.apply:
                    res = cf(f"zones/{zid}/dns_records/{rec['id']}", method="DELETE")
                    print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                    failures += 0 if res.get("success") else 1

    print(f"\n{'=' * 74}")
    if not args.apply:
        print(f"Dry run: {total_ops} change(s) pending. Re-run with --apply.")
    else:
        print(f"{total_ops - failures} change(s) applied, {failures} failed")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
