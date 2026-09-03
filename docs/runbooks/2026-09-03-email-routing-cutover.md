# Runbook: Forward Email → Cloudflare Email Routing cutover

Design doc: `docs/plans/2026-09-03-forward-email-retirement.md`

Everything scriptable is already done. What remains needs the Cloudflare
dashboard, because adding a destination address sends a verification email a
human must click, and the CMDIY API token has no account-level Email Routing
permission.

## State at the start of this runbook

```
classicminidiy.com   zone active   email routing unconfigured   MX -> forwardemail
theminiexchange.com  zone active   email routing unconfigured   MX -> forwardemail
cmdiy.co             zone active   email routing unconfigured   MX -> forwardemail
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

**Second thing to know:** you have no Gmail send-as for these domains, so replies
will go out as `classicminidiy@gmail.com`. That is already true today — Email
Routing does not change it.

## 1. Verify the destination address (once)

Do this first and completely. **An unverified destination silently drops mail.**

1. Go to `dash.cloudflare.com` and pick any one of the three domains.
2. Left sidebar → **Email** → **Email Routing**.
3. Open the **Destination addresses** tab.
4. **Add destination address** → `classicminidiy@gmail.com` → Save.
5. Open Gmail. Find the Cloudflare verification email and click its link.
6. Return to the tab and confirm the address reads **Verified**.

Destination addresses are account-level, so this covers all three domains. Do
not continue until it says Verified.

## 2. Cut over, one domain at a time

Order matters — least consequential first, so a mistake is cheap:

1. **`theminiexchange.com`** — retired marketplace, lowest inbound volume.
2. **`cmdiy.co`** — customer replies to Shopify order emails land here.
3. **`classicminidiy.com`** — most addresses, highest volume. Last.

For each domain, in that order:

1. Select the domain → **Email** → **Email Routing** → **Get started** / **Enable**.
2. Cloudflare shows the DNS records it wants to add. **Accept the three MX
   records** (`route1`/`route2`/`route3.mx.cloudflare.net`) and let it remove the
   two Forward Email MX records — that swap is atomic, which is why it is safer
   than editing MX by hand. **Decline the SPF TXT record** (see the warning
   above).
3. Go to the **Routing rules** tab → **Catch-all address** → **Edit**.
4. Action: **Send to an email**. Destination: `classicminidiy@gmail.com`. Save.
5. Set the catch-all to **Enabled**.
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
   `classicminidiy@gmail.com`.

Do not start the next domain until step 8 has arrived for the current one.

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
