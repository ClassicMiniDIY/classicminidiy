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
                       ALSO sends via Postmark as sales@cmdiy.co: the purchase
                       orders the "Auto Purchase Orders" Shopify app emails to
                       suppliers (Postmark is that app's carrier; there is no
                       Postmark account of our own). Found 2026-09-18
                       from the POs' own headers, AFTER this script had deleted
                       Postmark's DKIM key and return-path host as "dead" on
                       2026-09-03. Every PO since then failed DMARC and landed
                       in suppliers' spam. Both records are now in `create`.

Deliberately NOT touched, because they are live:
  store / merch / account.classicminidiy.com  -> shops.myshopify.com (storefront)
  the six Shopify DKIM CNAMEs on cmdiy.co     -> what makes orders@ authenticate
  pm-bounces / 20240927014807pm._domainkey    -> what makes sales@ authenticate
    on cmdiy.co                                  (Postmark; recreated by `create`)
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
import re
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

# Where DMARC aggregate reports go.
#
# Cloudflare DMARC Management (zone -> Email -> DMARC Management). All three
# zones are on Cloudflare, so its dashboard is the one place the reports can be
# read without a second vendor. Enabling it is dashboard-only: there is no
# public API for it, and enabling is what mints the per-zone `rua` mailbox at
# `dmarc-reports.cloudflare.net`. Cloudflare then writes that mailbox into the
# zone's `_dmarc` record itself.
#
# The mailboxes it minted on 2026-09-18 are pinned below, so this script can
# restore them if anything strips them again — which happened once: step 3 of
# the runbook was run from `main` with the previous version of this script,
# which knew only Postmark's addresses and "corrected" the record back to them.
# For a zone not listed here it falls back to reading the mailbox out of the
# current `_dmarc` record; if neither yields one it leaves the record alone and
# says so: the fix is to enable DMARC Management, not to guess.
#
# Postmark's DMARC Digests carried the reports from 2026-09-04 to 2026-09-18 as
# a stopgap. Its addresses are kept below only so the transition is visible in
# a dry run; once every zone reports `dmarc via Cloudflare` they can go.
CF_DMARC_RUA_DOMAIN = "dmarc-reports.cloudflare.net"
CF_DMARC_RUA = {
    "classicminidiy.com": f"06aa511942f64669b5b8fd43bc3811d0@{CF_DMARC_RUA_DOMAIN}",
    "theminiexchange.com": f"b8449acbe5774671ab39db0ab6b65c44@{CF_DMARC_RUA_DOMAIN}",
    "cmdiy.co": f"773c1a7d02b34a4888b722bed05cb9ca@{CF_DMARC_RUA_DOMAIN}",
}

# The policy this script will publish, per domain, once the Cloudflare mailbox
# is known. `p=none` until the reports have been read: see the ladder in
# docs/plans/2026-09-03-forward-email-retirement.md.
#
# `sp` is deliberately absent. classicminidiy.com has two sending subdomains
# (`ghost.news.` on Mailgun for Ghost, `noreply.` on SES) and neither has been
# confirmed DKIM-aligned by a report yet, so `sp=reject` would be a guess with
# the newsletter as the stake. With `sp` absent, subdomains inherit `p`.
DMARC_POLICY = {
    "classicminidiy.com": "p=none",
    "theminiexchange.com": "p=none",
    "cmdiy.co": "p=none",
}

# Retired 2026-09-18 in favour of Cloudflare DMARC Management. Left so a dry
# run against a zone that has not been switched yet prints a recognisable
# "from:" line rather than an unexplained mailbox.
POSTMARK_DMARC = {
    "classicminidiy.com": "v=DMARC1; p=none; pct=100; rua=mailto:re+nykoii9r5fe@dmarc.postmarkapp.com; sp=none; aspf=r;",
    "theminiexchange.com": "v=DMARC1; p=none; pct=100; rua=mailto:re+jsn5589chc9@dmarc.postmarkapp.com; sp=none; aspf=r;",
    "cmdiy.co": "v=DMARC1; p=none; pct=100; rua=mailto:re+qzg2ankxcbe@dmarc.postmarkapp.com; sp=none; aspf=r;",
}

# Authorisation records an earlier revision of this script created when the
# rua was a self-hosted `reports@classicminidiy.com` mailbox. They live in the
# classicminidiy.com zone, unused since 2026-09-04, and are listed so a zone
# audit can account for them. Safe to delete; nothing depends on them.
ORPHANED_REPORT_AUTH = [
    "theminiexchange.com._report._dmarc.classicminidiy.com",
    "cmdiy.co._report._dmarc.classicminidiy.com",
]


def cloudflare_rua(current_record):
    """The Cloudflare DMARC Management mailbox in a `_dmarc` record, or None."""
    m = re.search(r"mailto:([^,;\s]+@" + re.escape(CF_DMARC_RUA_DOMAIN) + ")", current_record or "", re.I)
    return m.group(1) if m else None


def dmarc_for(domain, current_record):
    """The record to publish, or None when Cloudflare's mailbox is not yet known."""
    rua = CF_DMARC_RUA.get(domain) or cloudflare_rua(current_record)
    if not rua:
        return None
    return f"v=DMARC1; {DMARC_POLICY[domain]}; rua=mailto:{rua};"

# --- the desired state -------------------------------------------------------
#
# `spf` is the apex SPF record's exact content, or None to leave it absent.
# `create` is records that must exist, as Cloudflare API bodies; matched on
# (type, name) and created only when absent, never overwritten.
# `delete` is (type, fqdn) pairs to remove.
# DMARC is not listed per domain: see DMARC_POLICY and dmarc_for().
CHANGES = [
    {
        "domain": "classicminidiy.com",
        # Keeps the existing `-all`. Only the includes change, so this is a
        # minimal diff: one variable, not two.
        # Carries Cloudflare's include so the wizard's record can be collapsed
        # into this one. 2 lookups of 10 — still down from the original 8.
        "spf": "v=spf1 include:amazonses.com include:_spf.mx.cloudflare.net -all",
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
        # Tightened from `~all` to `-all` on 2026-09-04. SES and Cloudflare are
        # the only authorised senders and both are named, so the softfail was no
        # longer buying anything.
        #
        # It was deliberately left at `~all` for one day first: swapping the
        # include already changed which sender was authorised, and moving the
        # qualifier in the same edit would have changed two variables at once on
        # the domain whose senders were least certain.
        "spf": "v=spf1 include:amazonses.com include:_spf.mx.cloudflare.net -all",
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
        # Postmark sends the store's purchase orders as sales@cmdiy.co. It
        # authenticates by DKIM (this selector) and by SPF on its own
        # return-path host (`pm-bounces`, a CNAME that inherits pm.mtasv.net's
        # SPF), so the apex SPF above is not involved and needs no include.
        #
        # This script DELETED both on 2026-09-03 on the belief that Postmark
        # was an abandoned trial. It was not: the PO headers from before and
        # after show `dmarc=pass` turning into `dmarc=fail` on that date.
        # The original key (selector 20240927014807pm) was restored from the
        # frozen Route 53 zone on 2026-09-18, but Postmark kept signing with
        # its fallback domain, so the domain was removed and re-added in the
        # app the same day. That minted the selector below; the app's "Email
        # domain settings" page is the source if it ever rotates again. The
        # old TXT is still in the zone and harmless; it is not deleted here
        # because deleting DKIM records on a hunch is how this paragraph
        # came to exist.
        "create": [
            # Shopify's "Email domain authentication" page for orders@cmdiy.co
            # lists six CNAMEs (read 2026-09-18). Three were never in the zone:
            # a second DKIM pair under a second mailer host. Shopify still
            # reported "Authenticated" on the `4wr` set alone, so these are
            # not the PO fix; they are what Shopify asks for, added so the
            # page and the zone agree. The `701`/`mailer701` set that is also
            # in the zone is no longer on Shopify's list. It is left alone:
            # deleting a DKIM record on a hunch is how this file got its
            # Postmark paragraph.
            {
                "type": "CNAME",
                "name": "pdk1._domainkey.mailerl71.cmdiy.co",
                "content": "dkim3.b413469e422d.p339.email.myshopify.com",
                "proxied": False,
                "ttl": 300,
                "comment": "Shopify DKIM (orders@cmdiy.co), second mail config",
            },
            {
                "type": "CNAME",
                "name": "pdk2._domainkey.mailerl71.cmdiy.co",
                "content": "dkim4.b413469e422d.p339.email.myshopify.com",
                "proxied": False,
                "ttl": 300,
                "comment": "Shopify DKIM (orders@cmdiy.co), second mail config",
            },
            {
                "type": "CNAME",
                "name": "mailerl71.cmdiy.co",
                "content": "b413469e422d.p339.email.myshopify.com",
                "proxied": False,  # mail host: proxying it breaks SPF
                "ttl": 300,
                "comment": "Shopify envelope/return-path host, second mail config",
            },
            {
                "type": "CNAME",
                "name": "pm-bounces.cmdiy.co",
                "content": "pm.mtasv.net",
                "proxied": False,  # mail host: proxying it breaks SPF
                "ttl": 300,
                "comment": "Postmark return-path for sales@cmdiy.co purchase orders",
            },
            {
                "type": "TXT",
                "name": "20260918181434pm._domainkey.cmdiy.co",
                "content": "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCtBpRESgmXXCW6UkNPBsBiRUy3IWjPU2HhVxaw32m7e1grwLDEjubN6rhGlWCbxwFrxF99Jc/MNEnzsKCKhkbcYPWpqGyJ18mEPRu9VKXQfBHqDWhSe8qTBUNG2XGWHBoITKawtVVDmll1ddnQf1ToGHPjXGBPv3oD9/YLmsPM9wIDAQAB",
                "ttl": 300,
                "comment": "Postmark DKIM for sales@cmdiy.co purchase orders (Auto Purchase Orders app)",
            },
        ],
        "delete": [],
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

    total_ops, failures, manual = 0, 0, 0

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
        name = f"_dmarc.{domain}"
        cur = [r for r in records if r["type"] == "TXT" and r["name"].rstrip(".") == name]
        current_dmarc = unquote_txt(cur[0]["content"]).strip() if len(cur) == 1 else ""
        want_dmarc = dmarc_for(domain, current_dmarc)
        if not want_dmarc and len(cur) <= 1:
            print(f"  dmarc no {CF_DMARC_RUA_DOMAIN} mailbox in the record — enable DMARC Management")
            print(f"        in the dashboard (zone -> Email -> DMARC Management) and re-run.")
            print(f"        current: {current_dmarc or '(absent)'}")
            manual += 1
        if want_dmarc:
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
            elif current_dmarc == want_dmarc:
                print(f"  dmarc via Cloudflare, already correct: {want_dmarc}")
            else:
                print(f"  dmarc from: {current_dmarc}")
                print(f"          to: {want_dmarc}")
                total_ops += 1
                if args.apply:
                    res = cf(f"zones/{zid}/dns_records/{cur[0]['id']}", method="PATCH",
                             body={"content": want_dmarc})
                    print(f"          {'ok' if res.get('success') else 'FAILED: ' + errmsg(res)}")
                    failures += 0 if res.get("success") else 1

            # RFC 7489 s7.1 external-destination authorisation is not needed:
            # Cloudflare publishes the wildcard `*._report._dmarc` record on
            # dmarc-reports.cloudflare.net itself.

        # --- creations ---
        for body in change.get("create", []):
            rtype, fqdn = body["type"], body["name"]
            matches = [r for r in records if r["type"] == rtype and r["name"].rstrip(".") == fqdn]
            if matches:
                have_content = str(matches[0].get("content", ""))
                if rtype == "TXT":
                    have_content = unquote_txt(have_content)
                same = have_content.strip() == body["content"].strip()
                print(f"  add   {rtype:<6} {fqdn}  present{'' if same else ' BUT DIFFERENT — review by hand'}")
                failures += 0 if same else 1
                continue
            print(f"  add   {rtype:<6} {fqdn}  -> {body['content'][:44]}")
            total_ops += 1
            if args.apply:
                res = cf(f"zones/{zid}/dns_records", method="POST", body=body)
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
    if manual:
        print(f"{manual} zone(s) still need DMARC Management enabled in the dashboard")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
