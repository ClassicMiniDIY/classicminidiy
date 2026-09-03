# Forward Email retirement

**Date:** 2026-09-03
**Status:** Plan — infra steps pending, admin page implemented on this branch
**Branch:** `claude/forward-email-retirement-938008`

Retire the three paid Forward Email subscriptions. Move inbound mail to Cloudflare
Email Routing, fix three SPF defects found along the way, and replace Forward
Email's DNS status table with an `/admin/email` page that checks more than the
table it replaces.

## Why this is cheap

The alias configuration is the simplest case there is — one catch-all per domain,
all three to the same mailbox:

```
*@classicminidiy.com   -> classicminidiy@gmail.com
*@cmdiy.co             -> classicminidiy@gmail.com
*@theminiexchange.com  -> classicminidiy@gmail.com
```

Cloudflare Email Routing supports catch-all natively and costs nothing. There is
no per-alias migration to do: three rules, one verified destination address.

## What Forward Email is doing today

Three jobs. Only the first is the product.

| Job              | Evidence                                      | Replacement              |
| ---------------- | --------------------------------------------- | ------------------------ |
| Inbound MX       | `MX 10 mx1/mx2.forwardemail.net` on all three | Cloudflare Email Routing |
| SPF relay        | `include:spf.forwardemail.net` on the apex    | SES (already in place)   |
| DNS status table | the account summary screen                    | `/admin/email`           |

Outbound transactional mail already goes through AWS SES v2 (`notification_queue`
plus the `process-notifications` edge function in `classicminidiy-supabase`).
Forward Email carries inbound only.

## Starting state, measured 2026-09-03

```
classicminidiy.com    NS anita/thomas.ns.cloudflare.com    MX forwardemail  SPF 8/10 lookups  DMARC p=none
theminiexchange.com   NS anita/thomas.ns.cloudflare.com    MX forwardemail  SPF names Resend  DMARC p=none
cmdiy.co              NS ns-*.awsdns-*  (Route 53)         MX forwardemail  SPF absent        DMARC p=none
```

Two zones are already on Cloudflare from the Workers migration
(`docs/plans/2026-08-06-cloudflare-workers-migration.md`). `cmdiy.co` was never in
that plan's domain table and is the only zone that has to move.

### Three defects this uncovered

These matter more than the subscription line item.

1. **`theminiexchange.com` SPF authorizes the wrong provider.** It reads
   `v=spf1 include:send.resend.com ~all`. Resend is not used anywhere in the
   platform — transactional mail is SES. Any TME mail still sending under
   `TME_FROM_EMAIL` fails SPF today.
2. **`cmdiy.co` publishes no SPF at all**, so nothing states that the domain does
   not send. It is a receive-only domain: it appears nowhere in this repo's code.
   (The `cmdiy.com` addresses in `tests/unit/exchange/composables/useNewsletter.test.ts`
   are fixtures on an unrelated parked domain, not ours.)
3. **`classicminidiy.com` SPF is at 8 of the 10 permitted DNS lookups.**
   `include:spf.forwardemail.net` alone costs 5 — it nests `a:forwardemail.net`
   plus three further includes. Exceeding 10 makes the whole record `permerror`,
   which receivers treat as a failure. Retiring Forward Email takes this to 3.

Separately, `include:shops.shopify.com` resolves to bare `v=spf1 ~all`. It
authorizes no senders and costs a lookup. Removing it is safe **only if** Shopify
no longer sends as `@classicminidiy.com`; that is a decision for Cole, not a
silent cleanup, so this plan leaves it in place and flags it on the admin page.

## Target state

```
classicminidiy.com    MX route*.mx.cloudflare.net   SPF v=spf1 include:_spf.google.com include:amazonses.com include:shops.shopify.com -all
theminiexchange.com   MX route*.mx.cloudflare.net   SPF v=spf1 include:amazonses.com -all
cmdiy.co              MX route*.mx.cloudflare.net   SPF v=spf1 -all
```

`include:_spf.google.com` stays on the apex only if Gmail send-as routes through
Google's servers — see the blocker below. DMARC stays `p=none` in this change:
moving to `p=quarantine` is a separate decision that should follow a period of
aggregate-report evidence, and mixing it into a mail cutover makes a failure
impossible to attribute.

Cloudflare Email Routing rewrites the envelope sender (SRS), so forwarding
itself needs no SPF include on our side.

## The one blocker: Gmail send-as

Cloudflare Email Routing is **forward-only**. It cannot send.

The `include:_spf.google.com` on the apex indicates Gmail "Send mail as" is or was
configured for these addresses. If Cole replies from `hello@classicminidiy.com` in
Gmail, that path must keep working, and Forward Email may be the SMTP relay behind
it today.

**Resolve before cancelling:** open Gmail → Settings → Accounts → "Send mail as",
and read what each custom address routes through.

- Routes through `smtp.forwardemail.net` → create SES SMTP credentials and
  re-point Gmail at `email-smtp.<region>.amazonaws.com:587` before cancelling.
- Routes through Google → nothing to do; keep `include:_spf.google.com`.
- No custom send-as at all → drop `include:_spf.google.com` too, freeing a lookup.

Skipping this check does not break inbound. It silently breaks replies.

## Cutover runbook

Ordered so that every step is reversible and mail is never without an MX.

### Phase 0 — Prerequisites (Cole)

1. Read the Gmail send-as configuration and decide the SES-SMTP question above.
2. Verify `classicminidiy@gmail.com` as a Cloudflare Email Routing destination
   address. This sends a confirmation link and must be clicked once. Do it before
   any MX change — an unverified destination silently drops mail.
3. Lower MX/TXT TTLs on all three zones to 300s, at least 24h ahead.

### Phase 1 — Move `cmdiy.co` to Cloudflare

Same procedure the Workers migration used for the other two zones.

1. Create the `cmdiy.co` zone in Cloudflare.
2. Dump the Route 53 record set and recreate every record **DNS-only (grey
   cloud)**. Diff record-for-record with `dig` against both nameserver sets
   before proceeding.
3. Change nameservers at the registrar (Amazon Registrar).
4. Wait for Cloudflare to report the zone Active. Keep the Route 53 zone intact
   as the rollback target — do not delete it in this change.

### Phase 2 — Email Routing, one domain at a time

Start with `cmdiy.co`. It carries no code references and no known correspondence,
so it is the zero-risk rehearsal. Then `theminiexchange.com`, then
`classicminidiy.com` last.

Per domain:

1. Enable Email Routing on the zone. Cloudflare offers to install its MX records —
   **accept this**, which replaces the Forward Email MX in one atomic edit.
2. Add the catch-all rule → forward to `classicminidiy@gmail.com`.
3. Send a live test to a random address at that domain (`ping-<date>@domain`) from
   an outside mailbox. Confirm arrival in Gmail.
4. Only after arrival is confirmed, update the SPF record to the target above.
5. Confirm on `/admin/email` that the row is green before starting the next domain.

**Rollback at any point:** restore `MX 10 mx1.forwardemail.net` / `mx2` and the
prior SPF string. Forward Email keeps working until the subscription is actually
cancelled, so the fallback stays live throughout.

### Phase 3 — Decommission

Only after all three domains have been green for **7 days**:

1. Remove the `forward-email-site-verification` TXT records from all three zones.
2. Cancel the three Forward Email subscriptions.
3. Restore TTLs to 3600s.

The 7-day soak is the point of the exercise. Mail failures are quiet, and the
person who notices a dropped message is the sender, who has no way to tell you.

## The admin page

`/admin/email`, in the existing **Email** nav group in `app/components/admin/Shell.vue`.

**Read-only by design.** Routing writes stay in the Cloudflare dashboard. Putting
zone-write credentials in the Worker to save a few dashboard clicks is a bad
trade, and it matches the line `scripts/sync-cf-zone-settings.py` already draws
between what the codebase manages and what lives in Cloudflare.

### Mechanism

`server/api/admin/email/health.get.ts` resolves each domain over DNS-over-HTTPS
against `cloudflare-dns.com/dns-query` (`Accept: application/dns-json`). DoH rather
than `node:dns` because the resolver is not part of the Workers runtime contract,
and a plain `fetch` is portable everywhere this deploys.

Pure parsing lives in `server/utils/emailHealth.ts` and is unit-tested; the route
is only I/O plus assembly.

### What it checks that Forward Email's table does not

- **SPF lookup budget** — recursive count against the limit of 10, the defect
  that is two lookups from breaking `classicminidiy.com` outright.
- **Stale provider includes** — SPF naming a provider the platform does not use,
  which is how the Resend include survived unnoticed.
- **Expected-vs-actual MX**, so the page doubles as the Phase 2 verification tool
  rather than something built after the fact.
- **DMARC policy strength**, reported rather than merely present.

### Deliberately not checked

**DKIM.** SES DKIM uses three CNAMEs at selector tokens generated per identity;
they cannot be derived from the domain name, so checking them means storing the
tokens. That is real value, but it is configuration this repo does not hold today,
and inventing a home for it belongs in its own change. The page states DKIM is
unverified rather than implying a pass.

## Cost

Three Enhanced Protection subscriptions removed. Cloudflare Email Routing is free
on all plans. The admin page adds four DoH lookups per domain per page load, on an
admin-only route, which is not worth caching beyond the request.

## Open items for Cole

1. Gmail send-as — the blocker above. Answer before Phase 3.
2. Does Shopify still send as `@classicminidiy.com`? Determines whether
   `include:shops.shopify.com` stays.
3. Confirm nothing outside this repo depends on a `@cmdiy.co` address.
