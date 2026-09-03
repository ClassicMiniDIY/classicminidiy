#!/usr/bin/env python3
"""Copy a Route 53 hosted zone's records into an existing Cloudflare zone.

Written for the `cmdiy.co` leg of the Forward Email retirement
(`docs/plans/2026-09-03-forward-email-retirement.md`), which is the last CMDIY
zone still served by Route 53. It is generic enough to reuse: the zone pair is
arguments, not constants.

Run it BEFORE flipping nameservers at the registrar. Cloudflare serves nothing
until the NS change, so writing records into a `pending` zone is inert — that is
what makes this step safe to do at leisure and verify with `dig @<cf-ns>` first.

What it deliberately does NOT copy:
  - apex NS and SOA. Cloudflare owns those, and copying Route 53's would point
    the new zone at the old nameservers.
  - anything already present in the Cloudflare zone with the same
    type + name + content, so re-running is a no-op rather than a duplicate.

Everything is created DNS-only (proxied=False). Every record in the CMDIY mail
zones is a mail or verification record, and proxying a mail CNAME through
Cloudflare breaks it — there is no case here where the orange cloud is correct.

Usage:
  set -a; . ./.env; set +a
  AWS_PROFILE=cmdiy-route53 python3 scripts/migrate-r53-zone-to-cf.py \
      --domain cmdiy.co --r53-zone Z025269833N0YRFKVP2UM [--apply]

Without --apply it prints the plan and changes nothing.

The Cloudflare token is read from CLOUDFLARE_API_TOKEN and is never placed on a
command line, printed, or included in an error message.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"

# Route 53 record types Cloudflare cannot hold, or that belong to the old zone.
SKIP_APEX_TYPES = {"NS", "SOA"}


def cf(path, method="GET", body=None):
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if not token:
        sys.exit("CLOUDFLARE_API_TOKEN not in environment. Run: set -a; . ./.env; set +a")
    req = urllib.request.Request(
        f"{API}/{path}",
        method=method,
        data=json.dumps(body).encode() if body else None,
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
    """Route 53 stores TXT quoted, and splits >255-byte strings into several
    quoted chunks that concatenate with no separator. Cloudflare wants the
    payload. Getting this wrong silently truncates a DKIM key."""
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


def r53_records(zone_id):
    out = subprocess.run(
        ["aws", "route53", "list-resource-record-sets", "--hosted-zone-id", zone_id, "--output", "json"],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        sys.exit(f"route53 read failed: {out.stderr.strip()[:400]}")
    return json.loads(out.stdout)["ResourceRecordSets"]


def flatten(records, domain):
    """Route 53 record sets -> one dict per Cloudflare record to create."""
    planned, skipped = [], []
    for rec in records:
        name = rec["Name"].rstrip(".").replace("\\052", "*")
        rtype = rec["Type"]

        if rtype in SKIP_APEX_TYPES and name == domain:
            skipped.append((rtype, name, "Cloudflare owns the apex NS/SOA"))
            continue

        if rec.get("AliasTarget"):
            # A Route 53 ALIAS has no Cloudflare equivalent. A CNAME to the same
            # target is the correct translation and Cloudflare flattens it at the
            # apex, but this needs a human to confirm the intent, not a guess.
            skipped.append((rtype, name, f"ALIAS -> {rec['AliasTarget']['DNSName']}; create by hand"))
            continue

        ttl = int(rec.get("TTL", 300))
        for rr in rec.get("ResourceRecords", []):
            value = rr["Value"]
            entry = {"type": rtype, "name": name, "ttl": ttl, "proxied": False}
            if rtype == "TXT":
                entry["content"] = unquote_txt(value)
            elif rtype == "MX":
                prio, _, host = value.partition(" ")
                entry["priority"] = int(prio)
                entry["content"] = host.rstrip(".")
            elif rtype in ("CNAME", "PTR", "NS"):
                entry["content"] = value.rstrip(".")
            else:
                entry["content"] = value
            planned.append(entry)
    return planned, skipped


def existing_key(rec):
    content = rec.get("content", "")
    if rec["type"] == "TXT":
        content = unquote_txt(content)
    if rec["type"] in ("CNAME", "PTR", "NS", "MX"):
        content = content.rstrip(".")
    prio = rec.get("priority") if rec["type"] == "MX" else None
    return (rec["type"], rec["name"].rstrip("."), content, prio)


def planned_key(entry):
    return (entry["type"], entry["name"], entry["content"], entry.get("priority"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", required=True, help="e.g. cmdiy.co")
    ap.add_argument("--r53-zone", required=True, help="Route 53 hosted zone id")
    ap.add_argument("--apply", action="store_true", help="actually create the records")
    args = ap.parse_args()

    # --- resolve the Cloudflare zone ---
    z = cf(f"zones?name={args.domain}")
    result = z.get("result") or []
    if not result:
        sys.exit(f"No Cloudflare zone for {args.domain} visible to this token: {errmsg(z)}")
    zone = result[0]
    zid, status = zone["id"], zone["status"]
    print(f"cloudflare zone {zid}  status={status}")
    print(f"assigned nameservers: {', '.join(zone.get('name_servers') or [])}")
    if status == "active":
        print("\nNOTE: this zone is already ACTIVE — it is serving live traffic.")
        print("Adding records here takes effect immediately, not at a later NS flip.")

    have = cf(f"zones/{zid}/dns_records?per_page=500")
    if have.get("result") is None:
        sys.exit(
            f"Cannot read DNS for {args.domain}: {errmsg(have)}\n"
            f"The token is zone-scoped; add {args.domain} to its zone resources."
        )
    existing = {existing_key(r) for r in have["result"]}
    print(f"cloudflare already holds {len(have['result'])} record(s)")

    # --- build the plan ---
    planned, skipped = flatten(r53_records(args.r53_zone), args.domain)
    todo = [e for e in planned if planned_key(e) not in existing]
    already = len(planned) - len(todo)

    print(f"\nroute53 yields {len(planned)} record value(s): {len(todo)} to create, {already} already present")

    if skipped:
        print("\nnot copied:")
        for rtype, name, why in skipped:
            print(f"  {rtype:<6} {name:<44} {why}")

    if todo:
        print("\nto create (all DNS-only):")
        for e in todo:
            prio = f"[{e['priority']}] " if "priority" in e else ""
            print(f"  {e['type']:<6} {e['name']:<44} ttl={e['ttl']:<5} {prio}{e['content'][:70]}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to create these records.")
        return

    if not todo:
        print("\nNothing to do.")
        return

    print("\napplying:")
    failures = 0
    for e in todo:
        res = cf(f"zones/{zid}/dns_records", method="POST", body=e)
        if res.get("success"):
            print(f"  ok      {e['type']:<6} {e['name']}")
        else:
            failures += 1
            print(f"  FAILED  {e['type']:<6} {e['name']}: {errmsg(res)}")

    print(f"\n{len(todo) - failures} created, {failures} failed")
    if failures:
        sys.exit(1)
    print(f"\nNext: verify against Cloudflare's nameservers before flipping NS, e.g.")
    ns = (zone.get("name_servers") or ["<cf-ns>"])[0]
    print(f"  dig @{ns} {args.domain} MX +short")
    print(f"  dig @{ns} {args.domain} TXT +short")


if __name__ == "__main__":
    main()
