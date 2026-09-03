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

# The SPF record Cloudflare's Email Routing onboarding wizard adds, verbatim.
# The wizard shows its record set with no way to untick anything, so this WILL
# appear on every domain that is onboarded. Two SPF records on one name is a
# permerror (RFC 7208 s4.5) that fails SPF for every message the domain sends,
# so the fix is to merge rather than to fight the wizard: keep one record
# carrying both includes.
CF_ROUTING_SPF = "v=spf1 include:_spf.mx.cloudflare.net ~all"
CF_ROUTING_INCLUDE = "include:_spf.mx.cloudflare.net"

# Where DMARC aggregate reports go. Reachable today because Email Routing's
# catch-all on classicminidiy.com forwards everything to Gmail.
DMARC_RUA = "reports@classicminidiy.com"
DMARC_RUA_DOMAIN = "classicminidiy.com"

# --- the desired state -------------------------------------------------------
#
# `spf` is the apex SPF record's exact content, or None to leave it absent.
# `delete` is (type, fqdn) pairs to remove.
CHANGES = [
    {
        "domain": "classicminidiy.com",
        # Keeps the existing `-all`. Only the includes change, so this is a
        # minimal diff: one variable, not two.
        # Carries Cloudflare's include so the wizard's record can be collapsed
        # into this one. 2 lookups of 10 — still down from the original 8.
        "spf": "v=spf1 include:amazonses.com include:_spf.mx.cloudflare.net -all",
        "dmarc": f"v=DMARC1; p=none; rua=mailto:{DMARC_RUA}",
        "delete": [
            ("CNAME", "pm-bounces.classicminidiy.com"),  # Postmark, dead
            # Forward Email decommission, 2026-09-03. Inbound moved to
            # Cloudflare Email Routing and all three domains tested working.
            ("CNAME", "fe-bounces.classicminidiy.com"),
            ("TXT", "fe-e97285d697._domainkey.classicminidiy.com"),
        ],
        # The apex `forward-email-site-verification` TXT shares a name with the
        # SPF and other verification TXTs, so it is matched on content.
        "delete_txt_containing": ["forward-email-site-verification"],
    },
    {
        "domain": "theminiexchange.com",
        # Deliberately keeps `~all` rather than tightening to `-all`, which is
        # what the plan's table originally said. Swapping the include already
        # changes which sender is authorised; tightening the qualifier in the
        # same edit would change two things at once on the domain whose senders
        # are least certain. Tighten to `-all` once DMARC reports confirm.
        # Tightened from `~all` to `-all` on 2026-09-04 at Cole's instruction.
        # SES and Cloudflare are the only authorised senders and both are named.
        "spf": "v=spf1 include:amazonses.com include:_spf.mx.cloudflare.net -all",
        "dmarc": f"v=DMARC1; p=none; rua=mailto:{DMARC_RUA}",
        "delete": [("TXT", "resend._domainkey.theminiexchange.com")],  # stale
        "delete_txt_containing": ["forward-email-site-verification"],
    },
    {
        "domain": "cmdiy.co",
        # Cloudflare's own record, added by Email Routing onboarding on
        # 2026-09-03. cmdiy.co had NO SPF before that, so this became its only
        # one — nothing to merge and no permerror.
        #
        # It does not affect the Shopify store. Shopify's envelope sender runs
        # through mailer4wr/mailer701, which are CNAMEs to Shopify, so SPF for
        # order mail is evaluated against Shopify's host, not this apex. The
        # `~all` softfail is also weaker than the `-all` this plan once
        # proposed, which is the right side to err on until DMARC aggregate
        # reports confirm the envelope domain.
        "spf": "v=spf1 include:_spf.mx.cloudflare.net ~all",
        "dmarc": f"v=DMARC1; p=none; rua=mailto:{DMARC_RUA}",
        "delete": [
            ("CNAME", "pm-bounces.cmdiy.co"),
            ("TXT", "20240927014807pm._domainkey.cmdiy.co"),
        ],
        "delete_txt_containing": ["forward-email-site-verification"],
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
            r
            for r in records
            if r["type"] == "TXT"
            and r["name"].rstrip(".") == domain
            and unquote_txt(r.get("content", "")).lower().startswith("v=spf1")
        ]
        want = change["spf"]

        # Email Routing onboarding adds its own SPF record alongside any that
        # already exists, and the wizard gives no way to decline it. Two SPF
        # records on one name is a permerror, so collapse them: delete exactly
        # Cloudflare's, and keep ours, which already carries their include.
        if len(spf_records) > 1:
            cf_added = [r for r in spf_records if unquote_txt(r["content"]).strip() == CF_ROUTING_SPF]
            others = [r for r in spf_records if r not in cf_added]
            if len(cf_added) == 1 and len(others) == 1:
                print("  spf   PERMERROR: 2 records. Removing the one Email Routing added:")
                print(f"          {CF_ROUTING_SPF}")
                total_ops += 1
                if args.apply:
                    res = cf(f"zones/{zid}/dns_records/{cf_added[0]['id']}", method="DELETE")
                    print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                    failures += 0 if res.get("success") else 1
                    spf_records = others
            else:
                print(f"  spf   {len(spf_records)} SPF records at the apex — refusing to guess:")
                for r in spf_records:
                    print(f"          {unquote_txt(r['content'])}")
                failures += 1
                spf_records = []

        if want is None:
            if spf_records:
                if all(unquote_txt(r["content"]).strip() == CF_ROUTING_SPF for r in spf_records):
                    # Acceptable to leave: it is the domain's only SPF record,
                    # it is a softfail, and it authorises the forwarder. Nothing
                    # here sends with this domain as the envelope.
                    print("  spf   only Email Routing's record — acceptable, leaving it")
                else:
                    print("  spf   present but the plan says none; leaving it for review:")
                    for r in spf_records:
                        print(f"          {unquote_txt(r['content'])}")
            else:
                print("  spf   absent, as intended")
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


        # --- DMARC ---
        # Adding `rua=` is purely additive: it changes no policy, it only asks
        # receivers to send aggregate reports. `p=` is left alone here.
        want_dmarc = change.get("dmarc")
        if want_dmarc:
            name = f"_dmarc.{domain}"
            cur = [r for r in records if r["type"] == "TXT" and r["name"].rstrip(".") == name]
            if len(cur) > 1:
                print(f"  dmarc {len(cur)} records at {name} — refusing to guess")
                failures += 1
            elif not cur:
                print(f"  dmarc MISSING, will create: {want_dmarc}")
                total_ops += 1
                if args.apply:
                    res = cf(f"zones/{zid}/dns_records", method="POST",
                             body={"type": "TXT", "name": name, "content": want_dmarc, "ttl": 300})
                    print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                    failures += 0 if res.get("success") else 1
            elif unquote_txt(cur[0]["content"]).strip() == want_dmarc:
                print(f"  dmarc already correct: {want_dmarc}")
            else:
                print(f"  dmarc from: {unquote_txt(cur[0]['content'])}")
                print(f"          to: {want_dmarc}")
                total_ops += 1
                if args.apply:
                    res = cf(f"zones/{zid}/dns_records/{cur[0]['id']}", method="PATCH",
                             body={"content": want_dmarc})
                    print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                    failures += 0 if res.get("success") else 1

            # RFC 7489 s7.1: when the rua mailbox is on a DIFFERENT domain than
            # the one being reported on, that domain must publish an
            # authorisation record or most reporters silently send nothing.
            # This is the usual reason "I turned on rua and got no reports".
            if domain != DMARC_RUA_DOMAIN:
                auth_name = f"{domain}._report._dmarc.{DMARC_RUA_DOMAIN}"
                rz = cf(f"zones?name={DMARC_RUA_DOMAIN}")
                rzid = (rz.get("result") or [{}])[0].get("id")
                rrecs = cf(f"zones/{rzid}/dns_records?per_page=500").get("result") or []
                if any(r["type"] == "TXT" and r["name"].rstrip(".") == auth_name for r in rrecs):
                    print(f"  dmarc report-auth already present: {auth_name}")
                else:
                    print(f"  dmarc report-auth MISSING, will create on {DMARC_RUA_DOMAIN}:")
                    print(f"          {auth_name}  TXT  v=DMARC1")
                    total_ops += 1
                    if args.apply:
                        res = cf(f"zones/{rzid}/dns_records", method="POST",
                                 body={"type": "TXT", "name": auth_name, "content": "v=DMARC1", "ttl": 300})
                        print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                        failures += 0 if res.get("success") else 1

        # --- deletions by TXT content ---
        # For names that hold several TXT records (an apex holds SPF plus every
        # provider's verification token), matching on name alone would delete
        # the wrong thing.
        for needle in change.get("delete_txt_containing", []):
            hits = [
                r for r in records
                if r["type"] == "TXT" and needle in unquote_txt(r.get("content", ""))
            ]
            if not hits:
                print(f"  del   TXT    ~{needle}  already gone")
            for rec in hits:
                print(f"  del   TXT    {rec['name'].rstrip('.'):<44} {unquote_txt(rec['content'])[:44]}")
                total_ops += 1
                if args.apply:
                    res = cf(f"zones/{zid}/dns_records/{rec['id']}", method="DELETE")
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
