# Forward Email retirement

**Date:** 2026-09-03
**Status:** Plan — admin page implemented, infra steps pending
**Branch:** `claude/forward-email-retirement-938008`

Retire the three paid Forward Email subscriptions. Move inbound mail to Cloudflare
Email Routing, fix the sender-authentication defects found along the way, and
replace Forward Email's DNS status table with an `/admin/email` page that checks
more than the table it replaces.

Three open questions in the first draft were answered by Cole on 2026-09-03 and
the plan below reflects the answers, not the original assumptions.

## Why this is cheap

One catch-all per domain, all three to the same mailbox:

```
*@classicminidiy.com   -> classicminidiy@gmail.com
*@cmdiy.co             -> classicminidiy@gmail.com
*@theminiexchange.com  -> classicminidiy@gmail.com
```

Cloudflare Email Routing supports catch-all natively and costs nothing. There is
no per-alias migration: three rules, one verified destination address.

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
classicminidiy.com    NS Cloudflare          MX forwardemail  SPF 8/10 lookups  DMARC p=none
theminiexchange.com   NS Cloudflare          MX forwardemail  SPF names Resend  DMARC p=none
cmdiy.co              NS Route 53            MX forwardemail  SPF absent        DMARC p=none
```

Two zones are already on Cloudflare from the Workers migration
(`docs/plans/2026-08-06-cloudflare-workers-migration.md`). **`cmdiy.co` is the only
zone that has to move** — it was never in that plan's domain table.

## Four defects this uncovered

These matter more than the subscription line item.

1. **`theminiexchange.com` authorizes the wrong provider.** Its SPF is
   `v=spf1 include:send.resend.com ~all`. Resend is not used anywhere on the
   platform — transactional mail is SES, and SES is absent from the record. Any
   TME mail still sending under `TME_FROM_EMAIL` fails SPF today.

2. **Shopify sends as `@classicminidiy.com` and is authenticated by nothing.**
   Confirmed by Cole that Shopify does send as this domain. But:
   - `include:shops.shopify.com` resolves to bare `v=spf1 ~all` — zero
     mechanisms, so it authorizes no sender while still costing a lookup.
   - No Shopify DKIM CNAME is published at any common selector.

   So the include reads as "Shopify is authorized" and grants nothing. The fix
   is Shopify's domain authentication (its DKIM CNAMEs, from Shopify admin →
   Settings → Notifications → sender email), **not** a different SPF include.
   `p=none` is why this has gone unnoticed.

3. **`classicminidiy.com` SPF is at 8 of the 10 permitted DNS lookups**, and
   only one of its four includes authorizes a sender we actually use:

   | Include                | Lookups | Authorizes                        |
   | ---------------------- | ------- | --------------------------------- |
   | `spf.forwardemail.net` | 5       | Forward Email — being retired     |
   | `_spf.google.com`      | 1       | Google — nothing sends via Google |
   | `shops.shopify.com`    | 1       | nobody (see defect 2)             |
   | `amazonses.com`        | 1       | **SES — the only real sender**    |

   Exceeding 10 makes the whole record a `permerror`, which receivers treat as a
   failure. The cleanup takes this from 8 to 1.

4. **`cmdiy.co` sends mail and publishes no SPF at all.** An earlier revision of
   this plan called it receive-only, reasoning from the domain appearing nowhere
   in this repo's code. **That was wrong** — code is not the only thing that
   sends mail. Reading the Route 53 zone (comment: "Emailing from the CMDIY
   store") shows it is the Shopify store's authenticated sending domain:

   - two complete sets of Shopify DKIM CNAMEs, from two different Shopify mail
     configs, plus a mailer host for each
   - a Postmark DKIM key and a `pm-bounces` host
   - and no SPF record, so neither sender is SPF-authorised

   This is the domain in the worst shape, not the safest one, and it is the one
   whose nameservers are about to move.

## Answered: there is no Gmail send-as to preserve

The first draft flagged Gmail "Send mail as" as a blocker, because Cloudflare
Email Routing is forward-only and cannot send. **It is not a blocker.**

Gmail → Settings → Accounts shows exactly one "Send mail as" entry,
`Cole Gentry <classicminidiy@gmail.com>`. There is no custom-domain send-as, so:

- No SMTP relay is in use and none needs replacing.
- Replies already go out as `classicminidiy@gmail.com` today. Nothing changes.
- `include:_spf.google.com` is vestigial. Google is not the MX, the account is
  consumer Gmail rather than Workspace, and with no send-as entry Gmail cannot
  send as a custom domain at all. Nothing can send as `@classicminidiy.com` via
  Google, so the include authorizes a sender that does not exist.

**Optional, not required:** if you later want to reply as
`hello@classicminidiy.com`, create SES SMTP credentials and add the address in
Gmail under "Add another email address", pointing at
`email-smtp.<region>.amazonaws.com:587`. That would then justify keeping a Google
or SES include. It is a feature you do not have today, not something the cutover
takes away.

## Target state

```
classicminidiy.com    MX route*.mx.cloudflare.net   SPF v=spf1 include:amazonses.com -all
theminiexchange.com   MX route*.mx.cloudflare.net   SPF v=spf1 include:amazonses.com -all
cmdiy.co              MX route*.mx.cloudflare.net   SPF see below — NOT `-all`
```

`cmdiy.co` cannot take `v=spf1 -all`: it sends. What it should publish depends on
which of its two senders are still live, which is an open question below. Until
that is answered, leave its SPF absent rather than publishing `-all` and hard-
failing the store's own mail.

`classicminidiy.com` drops from 8 lookups to 1. Three includes go:
`spf.forwardemail.net` (retired), `_spf.google.com` (vestigial),
`shops.shopify.com` (authorizes nobody).

DMARC stays `p=none` in this change. Moving to `p=quarantine` should follow
aggregate-report evidence, and mixing it into a mail cutover makes any failure
impossible to attribute.

Cloudflare Email Routing rewrites the envelope sender (SRS), so forwarding itself
needs no SPF include on our side.

## Audit of every AWS hosted zone, 2026-09-03

Run at Cole's request while the Route 53 credentials were open, using the
dump-and-diff the Workers migration plan calls for. `scripts/migrate-r53-zone-to-cf.py`
carries the reusable half of this.

| Zone                  | R53 records | Actually served by | Migration fidelity     |
| --------------------- | ----------- | ------------------ | ---------------------- |
| `classicminidiy.com`  | 37          | Cloudflare         | **identical**          |
| `theminiexchange.com` | 16          | Cloudflare         | **identical**          |
| `cmdiy.co`            | 16          | Route 53           | not yet moved          |
| `ultralog.co`         | 5           | Route 53           | different project      |
| `oecua.org`           | 4           | Cloudflare         | token has no DNS scope |
| `openecualliance.org` | 9           | Cloudflare         | token has no DNS scope |

**The migration lost nothing.** Both CMDIY zones on Cloudflare diff clean against
their Route 53 originals, once Route 53's quoted/chunked TXT encoding and its
`ALIAS`-versus-`CNAME` representation are normalised. The Route 53 zones are
still intact as rollback targets.

The two OpenECU zones belong to a different project and the CMDIY token
deliberately excludes them (`scripts/verify-cf-token.py` lists them as foreign).
They are not in scope here.

### What the zone contents revealed

Migration fidelity was clean; the _records themselves_ are another matter. Reading
the zones answered two things that could not be seen from outside:

1. **SES DKIM is fully configured.** `classicminidiy.com` and
   `theminiexchange.com` each publish three SES DKIM CNAMEs. So the `/admin/email`
   DKIM row reporting `unknown` is now a solvable gap rather than an unknowable
   one — see the follow-ups.

2. **Shopify's authenticated sending domain is `cmdiy.co`, not
   `classicminidiy.com`.** `cmdiy.co` has the full Shopify DKIM CNAME sets.
   `classicminidiy.com` has a Shopify _mailer_ CNAME but **no Shopify DKIM
   records at all** — a domain authentication that was started and never
   finished. This refines defect 2: Shopify mail is properly signed when it goes
   out as `@cmdiy.co` and unauthenticated if it goes out as
   `@classicminidiy.com`.

Also found, none of it previously documented:

- **Postmark is in use**, or was. `pm-bounces` hosts on both
  `classicminidiy.com` and `cmdiy.co`, and a Postmark DKIM key on `cmdiy.co`.
  Neither domain's SPF authorises Postmark. Nothing in this repo sends through
  Postmark, so this is likely Shopify-side or legacy — but it is unaudited.
- **`theminiexchange.com` has SES SPF on the wrong names.** `mail.` and `send.`
  subdomains both carry `v=spf1 include:amazonses.com ~all` with SES bounce MX,
  but the **apex** — the domain mail actually comes from — still names Resend.
  A stale `resend._domainkey` TXT is also still published.
- **Ghost sends via Mailgun** on `ghost.news.classicminidiy.com`, with its own
  DKIM key. That subdomain publishes no SPF of its own, so Ghost mail is
  DKIM-only. Working as configured, worth knowing.
- **SES custom MAIL FROM** is set up on `noreply.classicminidiy.com` correctly.

### Revised fix list

| Domain                | Fix                                                                       |
| --------------------- | ------------------------------------------------------------------------- |
| `classicminidiy.com`  | SPF -> `v=spf1 include:amazonses.com -all` (8 lookups to 1)               |
| `theminiexchange.com` | apex SPF -> `v=spf1 include:amazonses.com -all`; drop `resend._domainkey` |
| `cmdiy.co`            | move the zone; then publish an SPF once its senders are confirmed         |
| all three             | drop `forward-email-site-verification` TXT and `fe-*` hosts               |

## Cutover runbook

Cole's call, 2026-09-03: **no phased soak.** Move the nameservers, pull everything
over from Route 53, enable routing. The steps below are ordered so mail is never
without an MX, but they are meant to be done in one sitting.

One caveat, stated once and then dropped: mail failures are silent, and the person
who notices a dropped message is the sender, who has no way to tell you. The
`/admin/email` page is the compensating control — check it after the cutover
rather than waiting to hear about a problem.

### 1. Prerequisite

Verify `classicminidiy@gmail.com` as a Cloudflare Email Routing destination
address. This sends a confirmation link that must be clicked once. **Do this
before any MX change** — an unverified destination silently drops mail.

### 2. Move `cmdiy.co` to Cloudflare

Only this zone needs it; the other two are already on Cloudflare.

The zone already exists in Cloudflare (`status=pending`, nameservers
`anita`/`thomas.ns.cloudflare.com`), so only the records and the NS flip remain.

**Blocked on token scope.** `CLOUDFLARE_API_TOKEN` in `.env` is zone-scoped and
`cmdiy.co` is not among its zone resources — it reads DNS on
`classicminidiy.com` and `theminiexchange.com` and returns `Authentication error`
for `cmdiy.co`. Add `cmdiy.co` to the token's zone resources (Cloudflare
dashboard -> My Profile -> API Tokens), then:

```bash
set -a; . ./.env; set +a
AWS_PROFILE=cmdiy-route53 python3 scripts/migrate-r53-zone-to-cf.py \
    --domain cmdiy.co --r53-zone Z025269833N0YRFKVP2UM          # dry run
```

The script copies all 14 records DNS-only, skips the apex NS/SOA that Cloudflare
owns, and is idempotent. Add `--apply` once the plan reads right. Then:

1. Verify against Cloudflare's nameservers _before_ flipping:
   `dig @anita.ns.cloudflare.com cmdiy.co MX +short` and the DKIM CNAMEs.
2. Change nameservers at the registrar (Amazon Registrar).
3. Wait for Cloudflare to report the zone Active. Keep the Route 53 zone intact
   as the rollback target.

Take particular care with the six Shopify DKIM CNAMEs and the two mailer hosts.
They must be **DNS-only**; proxying a mail CNAME through Cloudflare breaks it,
which is why the script never sets `proxied`.

### 3. Enable Email Routing on all three zones

Per domain:

1. Enable Email Routing. Cloudflare offers to install its MX records — accept
   this, which replaces the Forward Email MX in one atomic edit.
2. Add the catch-all rule → `classicminidiy@gmail.com`.
3. Send a live test to a random address at that domain (`ping-<date>@domain`)
   from an outside mailbox and confirm arrival.

### 4. Fix the SPF records

Apply the target records above. Do this after inbound is confirmed working, so a
mail problem has only one possible cause at a time.

### 5. Confirm and decommission

1. Open `/admin/email`. Every row should read **Healthy** except the DKIM row,
   which is always `unknown`.
2. Remove the `forward-email-site-verification` TXT records from all three zones.
3. Cancel the three Forward Email subscriptions.

**Rollback at any point:** restore `MX 10 mx1.forwardemail.net` / `mx2` and the
prior SPF string. Forward Email keeps working until the subscription is actually
cancelled, so the fallback stays live throughout.

## The admin page

`/admin/email`, in the existing **Email** nav group in `app/components/admin/Shell.vue`.

**Read-only by design.** Routing writes stay in the Cloudflare dashboard. Putting
zone-write credentials in the Worker to save a few dashboard clicks is a bad
trade, and it matches the line `scripts/sync-cf-zone-settings.py` already draws
between what the codebase manages and what lives in Cloudflare.

### Mechanism

`server/api/admin/email/health.get.ts` resolves each domain over DNS-over-HTTPS
against `cloudflare-dns.com/dns-query` (`Accept: application/dns-json`). DoH
rather than `node:dns` because the resolver is not part of the Workers runtime
contract, and a plain `fetch` is portable everywhere this deploys.

Pure parsing lives in `server/utils/emailHealth.ts` and is unit-tested (47 tests);
the route is only I/O plus assembly.

### What it checks that Forward Email's table did not

- **SPF lookup budget** — recursive count against the limit of 10, the defect
  that is two lookups from breaking `classicminidiy.com` outright.
- **Includes that authorize nobody** — an include resolving to a record with no
  `ip4`/`ip6`/`a`/`mx`/`exists` mechanism. This is what caught Shopify, and it is
  the check a green tick actively hides: the include looks present and correct.
- **Stale provider includes** — SPF naming a provider the platform does not use,
  which is how the Resend include survived unnoticed.
- **Expected-vs-actual MX**, so the page doubles as the cutover verification tool.
- **DMARC policy strength**, reported rather than merely present.

### Deliberately not checked

**DKIM.** SES DKIM uses three CNAMEs at per-identity selector tokens that cannot
be derived from the domain name, so checking them means storing the tokens. That
is real value, but it is configuration this repo does not hold today, and
inventing a home for it belongs in its own change. The page reports DKIM as
unknown rather than implying a pass.

Note that DKIM is exactly where defect 2 lives, so this gap is not free — see the
follow-up below.

## Follow-ups, out of scope here

1. **Authenticate Shopify's sending domain** (defect 2). Shopify admin →
   Settings → Notifications → sender email → add the DKIM CNAMEs it gives you.
   Until then Shopify mail as `@classicminidiy.com` is unauthenticated.
2. **Turn on DMARC aggregate reporting** (`rua=mailto:…`) on all three domains.
   It is the only way to see who is actually sending as these domains, and it is
   the evidence needed before `p=quarantine`.
3. **Store SES DKIM selector tokens** somewhere the admin page can read, so the
   DKIM row stops being `unknown`. The tokens are now known — they are in the
   Route 53 zones — but they are infra config, and this repo is public, so they
   belong in an env var or `classicminidiy-supabase`, not committed here.
4. **Audit Postmark.** Two domains carry Postmark bounce hosts and one a Postmark
   DKIM key, no SPF authorises it, and nothing in this repo sends through it.
   Establish whether it is live; if not, remove the records.
5. **Finish or remove Shopify's `classicminidiy.com` domain authentication.**
   There is a mailer CNAME with no DKIM records behind it. Either complete it in
   Shopify admin or drop the orphan record.
6. **Give the two OpenECU zones the same audit.** They are on Cloudflare with
   live Route 53 zones behind them and this token cannot see them, so nobody has
   diffed them.
