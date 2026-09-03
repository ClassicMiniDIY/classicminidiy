# Runbook: Forward Email → Cloudflare Email Routing cutover

Design doc: `docs/plans/2026-09-03-forward-email-retirement.md`

Everything scriptable is already done. What remains needs the Cloudflare
dashboard, because adding a destination address sends a verification email a
human must click, and the CMDIY API token has no account-level Email Routing
permission.

## State at the start of this runbook

```
ALL THREE DONE 2026-09-03. Routing enabled, catch-all -> classicminidiy@gmail.com,
MX -> route1/2/3.mx.cloudflare.net, exactly one SPF record each.

Kept for the next time a zone is onboarded — the two traps below are properties
of Cloudflare's wizard, not of this particular migration.
```

All three are served by Cloudflare. `cmdiy.co` completed its nameserver move on
2026-09-03 with every record verified.

Target for all three: catch-all → `classicminidiy@gmail.com`.

## Read this before you start

**The one way this breaks outbound mail: a second SPF record.**

Cloudflare's Email Routing wizard offers to add
`v=spf1 include:_spf.mx.cloudflare.net ~all` as a TXT record. Two SPF records on
one name is a `permerror` under RFC 7208 §4.5, and receivers treat a permerror
as a failure — so accepting it would break SPF for **every** message the domain
sends, including SES transactional mail and the Shopify store's order emails.

**Do not let the wizard create an SPF record.** Email Routing does not need one:
it rewrites the envelope sender (SRS) when forwarding, so forwarded mail passes
SPF on Cloudflare's own domain. Skip or untick that record. The MX records are
the only ones you need.

Current apex SPF, which must stay exactly as-is:

```
classicminidiy.com    v=spf1 include:amazonses.com -all
theminiexchange.com   v=spf1 include:amazonses.com ~all
cmdiy.co              (none — deliberate)
```

If the wizard adds one anyway, delete the duplicate immediately and confirm with
step 5 below.

**The one way this loses inbound mail: activation does not start forwarding.**

Enabling Email Routing leaves the catch-all rule `enabled: false` with action
`drop`. The MX now points at Cloudflare, so mail arrives and is discarded — not
bounced, discarded, which is the failure nobody notices. Observed on
`theminiexchange.com`, 2026-09-03. Setting the catch-all is a separate step and
it is the step that matters. Do it immediately after activating, not later.

**Never add Cloudflare's SPF record programmatically after pre-merging.** This
caused the only real outage of the migration. The pre-merged record
(`v=spf1 include:amazonses.com include:_spf.mx.cloudflare.net -all`) is not
byte-equal to Cloudflare's (`v=spf1 include:_spf.mx.cloudflare.net ~all`), so a
script that decides what to add by comparing content verbatim sees Cloudflare's
as missing and creates a SECOND SPF record. Cloudflare then refuses to enable —
`Multiple SPF records exist` — while the apex MX already points at its servers,
so inbound mail fails until someone notices.

**When adding Cloudflare's record set, filter by TYPE and NAME, never by
content.** Any existing apex SPF means the SPF row is already handled. On
`classicminidiy.com`, 2026-09-03, this cost about a minute of failed inbound.

**Cloudflare will not swap the MX for you.** Activation refuses while any
non-Cloudflare MX exists:

> Existing non-Cloudflare MX records conflict with Email Routing. Remove or
> update them and try again.

Remove them first — but in the order below, which never leaves the domain
without an MX.

**Third thing to know:** you have no Gmail send-as for these domains, so replies
will go out as `classicminidiy@gmail.com`. That is already true today — Email
Routing does not change it.

## 1. Verify the destination address (once)

Do this first and completely. **An unverified destination silently drops mail.**

There are two Email Routing pages and they look different. Either works:

- **Account-level:** sidebar → **Compute** → **Email Service** → **Email Routing**.
  Domains are added here with **+ Onboard Domain**, and destination addresses
  live behind the **Destination Addresses** button, top right.
- **Per-zone:** pick a domain first, then **Email** → **Email Routing**. This one
  offers **Get started** for that single zone.

Steps, from the account-level page:

1. `dash.cloudflare.com` → **Compute** → **Email Service** → **Email Routing**.
2. **Destination Addresses** (top right).
3. Add `classicminidiy@gmail.com` → Save.
4. Open Gmail. Find the Cloudflare verification email and click its link.
5. Confirm the address reads **Verified**.

Destination addresses are account-level, so this covers all three domains. Do
not continue until it says Verified.

## 2. Cut over, one domain at a time

Order matters — least consequential first, so a mistake is cheap:

1. **`theminiexchange.com`** — retired marketplace, lowest inbound volume.
2. **`cmdiy.co`** — customer replies to Shopify order emails land here.
3. **`classicminidiy.com`** — most addresses, highest volume. Last.

For each domain, in that order:

1. **Pre-merge the SPF first**, if the domain has one. The wizard offers its own
   `v=spf1 include:_spf.mx.cloudflare.net ~all` and gives no way to untick it, so
   put Cloudflare's include into the existing record beforehand. Then either the
   wizard skips its record, or it adds a duplicate that is safe to delete —
   and there is never a window where the real sender loses authorisation.
   `scripts/fix-mail-dns.py` holds the merged values and collapses a duplicate
   if one appears.

2. **Swap the MX — but check the priorities first.** Cloudflare assigns them per
   zone, from `GET /zones/{id}/email/routing/dns`. If all three are numerically
   HIGHER than Forward Email's 10, add them first: Forward Email keeps winning
   and mail flow does not change until you delete it. That worked for
   `theminiexchange.com` (69–100) and `cmdiy.co` (39–88).

   If any is LOWER than 10 it outranks Forward Email, and pre-adding would
   divert mail to a routing-disabled endpoint. `classicminidiy.com` drew a 3.
   In that case delete Forward Email's MX first and add Cloudflare's
   immediately after, in one scripted run — a sub-second gap with no MX, which
   senders retry through, rather than minutes pointed at a dead endpoint.

3. Click **+ Onboard Domain** and pick the domain. It will activate now that no
   foreign MX remains. (From the per-zone page the same flow is **Get started**.)

4. **Set the catch-all immediately.** This is the step that stops mail being
   dropped. Either the dashboard — that domain's **Routing rules** →
   **Catch-all address** → **Edit** → **Send to an email** →
   `classicminidiy@gmail.com` → Save → **Enabled** — or the API:

   ```
   PUT /zones/{zone_id}/email/routing/rules/catch_all
   {"enabled":true,"matchers":[{"type":"all"}],
    "actions":[{"type":"forward","value":["classicminidiy@gmail.com"]}]}
   ```

5. Confirm the rule reads `enabled=True` with a `forward` action, NOT `drop`.

6. Verify DNS changed, substituting the domain:

   ```bash
   dig +short MX theminiexchange.com
   ```

   Expect three `route*.mx.cloudflare.net` hosts and no `forwardemail.net`.

7. Confirm SPF is still single and unchanged:

   ```bash
   dig +short TXT theminiexchange.com | grep spf1
   ```

   Expect exactly **one** line. Two lines means the wizard added its record —
   delete the Cloudflare one before going further.

8. **Send a real test message** from an outside mailbox (not Gmail — send from
   your phone's carrier address or another provider) to a random address at that
   domain, for example `ping-0903@theminiexchange.com`. Confirm it arrives in
   `classicminidiy@gmail.com`. This is the only step that proves the catch-all
   actually forwards; every check before it proves only that DNS is right.

Do not start the next domain until step 8 has arrived for the current one.

The account-level page invites the opposite: it lists every eligible domain and
onboarding all three in a row takes seconds. Resist it. Onboarding is the step
that swaps the MX, so three at once means three simultaneous chances to lose
inbound mail with no way to tell which one broke.

## 3. Confirm all three

```bash
bun run dev   # then open /admin/email
```

Every MX row should read **Cloudflare Email Routing**. The DKIM row stays
`unknown` by design; DMARC stays `p=none` until you enable reporting.

## 4. Decommission

Only after all three domains have passed step 8.

1. Delete the leftover Forward Email records. Add them to
   `scripts/fix-mail-dns.py` as a `delete` batch rather than clicking through
   the dashboard, so the change stays recorded:

   ```
   TXT    forward-email-site-verification=…   on all three apexes
   CNAME  fe-bounces.classicminidiy.com
   TXT    fe-e97285d697._domainkey.classicminidiy.com
   ```

2. Cancel the three Forward Email subscriptions.

Leave the Route 53 hosted zones in place. They are the pre-change rollback
snapshot.

## Rollback

At any point before cancelling the subscription, Forward Email still works —
nothing was removed on their side. To revert one domain:

1. In Cloudflare DNS, delete the three `route*.mx.cloudflare.net` MX records.
2. Re-add two MX records at the apex, both priority 10:
   `mx1.forwardemail.net` and `mx2.forwardemail.net`.
3. Disable Email Routing for that zone.

Mail resumes on the old path within the MX TTL.

## Afterwards: DMARC reporting

Not part of the cutover, but it is the next thing worth doing and it is free.
Adding `rua=` to each `_dmarc` record produces daily aggregate reports naming
every IP sending as these domains. That evidence is what unblocks two decisions
currently on hold:

- what SPF record `cmdiy.co` should publish, and
- whether `theminiexchange.com` can tighten from `~all` to `-all`.

Reports arrive daily as XML attachments, so send them somewhere that will not
bury your inbox — a dedicated address, or a parsing service. Decide the
destination, then the record change itself is a one-line edit per domain.
