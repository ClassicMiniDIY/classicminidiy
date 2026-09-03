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

2. **Shopify's sending domain is `cmdiy.co`, not `classicminidiy.com`.**
   Confirmed in Shopify admin on 2026-09-03: the store's sender email is
   `orders@cmdiy.co` and Email domain authentication reads **Authenticated**.
   The six DKIM CNAMEs in the `cmdiy.co` zone are the live, working path.

   That makes every Shopify record on `classicminidiy.com` an orphan: the
   `maileri5q` mailer CNAME has no DKIM behind it because nothing was ever
   meant to send from that domain. Defect 2 is therefore not "Shopify is
   unauthenticated" — Shopify is fine. It is "`classicminidiy.com` carries
   Shopify records it does not use, one of which wastes an SPF lookup".

Also found, none of it previously documented:

- **Postmark is dead.** Confirmed by Cole 2026-09-03: an abandoned trial from
  years ago, not in use. Its remnants are a `pm-bounces` host on both
  `classicminidiy.com` and `cmdiy.co` plus a DKIM key on `cmdiy.co`. All of it
  is removable, and one of those records had already gone wrong — see below.
- **`theminiexchange.com` has SES SPF on the wrong names.** `mail.` and `send.`
  subdomains both carry `v=spf1 include:amazonses.com ~all` with SES bounce MX,
  but the **apex** — the domain mail actually comes from — still names Resend.
  A stale `resend._domainkey` TXT is also still published.
- **Ghost sends via Mailgun** on `ghost.news.classicminidiy.com`, with its own
  DKIM key. That subdomain publishes no SPF of its own, so Ghost mail is
  DKIM-only. Working as configured, worth knowing.
- **SES custom MAIL FROM** is set up on `noreply.classicminidiy.com` correctly.

### The `cmdiy.co` record migration — done 2026-09-03

Applied with `scripts/migrate-r53-zone-to-cf.py`: **10 records created,
`pm-bounces` unproxied, 11 changes, 0 failures.** A re-run reports 0 to create
and 15 already present, and all 14 names resolve identically on both `anita` and
`thomas`. The zone is still `pending`, so none of it is live until the NS flip.

**Cloudflare's zone import had turned proxying ON for `pm-bounces.cmdiy.co`.**
A proxied CNAME resolves to Cloudflare's edge rather than the provider, so a
proxied bounce host is silently broken. The first version of the migration
script missed it: the record matched on type, name and content, so it was
skipped as "already present" and would have survived the nameserver flip in
that state. The script now checks the proxy flag on every proxyable type and
fixes it, because nothing it migrates should ever be proxied.

The lesson generalises beyond this zone: **an auto-imported Cloudflare zone is
not a faithful copy.** Record data can match while a Cloudflare-only attribute
makes the record behave differently. Any future zone import needs the same
check.

### Revised fix list

All senders are now identified, so the list is concrete. Nothing below is
applied yet; every item touches a live zone and needs its own approval.

#### Records that must NOT be touched

Stated first, because "delete the Shopify records" is a sentence that could take
the store offline. These are live and confirmed Connected in Shopify admin:

```
store.classicminidiy.com     -> shops.myshopify.com     Online Store (primary)
merch.classicminidiy.com     -> shops.myshopify.com     Online Store alias
account.classicminidiy.com   -> shops.myshopify.com     Customer Account (primary)
```

The six Shopify DKIM CNAMEs and two mailer hosts on `cmdiy.co` are also live —
they are what makes `orders@cmdiy.co` authenticate. Leave all of them.

The distinction is clean: every live storefront record points at
`shops.myshopify.com`, and nothing in the fix list below points there.

Removing `include:shops.shopify.com` from an SPF record has no effect on the
storefront. SPF governs email only.

#### Changes to make

| Domain                | Fix                                                                               |
| --------------------- | --------------------------------------------------------------------------------- |
| `classicminidiy.com`  | SPF -> `v=spf1 include:amazonses.com -all` (8 lookups -> 1)                       |
| `theminiexchange.com` | apex SPF -> `v=spf1 include:amazonses.com -all`; delete stale `resend._domainkey` |
| `classicminidiy.com`  | delete Postmark `pm-bounces`                                                      |
| `cmdiy.co`            | delete Postmark `pm-bounces` and its DKIM key                                     |
| all three             | after cutover: delete `forward-email-site-verification` TXT and `fe-bounces`      |

**`maileri5q.classicminidiy.com` is deliberately NOT on that list.** It is a
Shopify mailer host for a third mail config (`p116`, distinct from `cmdiy.co`'s
`p347` and `p813`), almost certainly left from an earlier sender setup. But it
costs nothing — a CNAME consumes no SPF lookup — so deleting it buys nothing and
risks something. Leave it unless Shopify admin confirms no sender references it.

`cmdiy.co` gets no SPF in this pass, deliberately. Its only sender is Shopify,
which authenticates by DKIM and whose SPF include grants nothing, so there is no
envelope sender to authorise. `v=spf1 -all` is the tempting answer and the wrong
one until DMARC aggregate reports confirm Shopify's envelope domain — some
receivers weight an SPF hard fail heavily even when DKIM aligns. Turn on `rua=`
first; that is follow-up 2 and it is free.

## Applied 2026-09-03

### Records: `cmdiy.co` zone migrated

`scripts/migrate-r53-zone-to-cf.py`: **11 changes, 0 failures** — 10 records
created plus `pm-bounces` unproxied. Verified identical on both `anita` and
`thomas`; a re-run reports 0 to create, 15 already present.

Nameservers were changed at the registrar the same day. `whois` showed
`ANITA`/`THOMAS.NS.CLOUDFLARE.COM` immediately while the `.co` TLD servers still
served the Route 53 delegation on a 3600 s TTL — normal registry propagation
lag, not a failed change. The Cloudflare zone reports `pending` until it clears.

### SPF and dead-provider cleanup

`scripts/fix-mail-dns.py`: **6 changes, 0 failures.**

| Domain                | Before                                     | After                                      |
| --------------------- | ------------------------------------------ | ------------------------------------------ |
| `classicminidiy.com`  | 4 includes, **8 of 10 lookups**            | `v=spf1 include:amazonses.com -all`, **1** |
| `theminiexchange.com` | `include:send.resend.com ~all`, SES absent | `v=spf1 include:amazonses.com ~all`, **1** |

Deleted: `pm-bounces` on `classicminidiy.com` and `cmdiy.co`, the Postmark DKIM
key on `cmdiy.co`, and the stale `resend._domainkey` on `theminiexchange.com`.
All four confirmed gone at Cloudflare's own nameservers and via the API.

**Deviation from the fix table above:** `theminiexchange.com` kept `~all` rather
than tightening to `-all`. Swapping the include already changes which sender is
authorised; tightening the qualifier in the same edit would change two variables
at once on the domain whose senders are least certain. Tighten it once DMARC
aggregate reports confirm nothing else sends as that domain.

Verified untouched afterwards, because these were the collateral risk:

```
store / merch / account.classicminidiy.com   still -> shops.myshopify.com
SES DKIM CNAMEs on both sending domains      still resolve
MX on both domains                           still Forward Email
noreply. / send. / mail. SES MAIL FROM SPF   unchanged
```

Route 53 was deliberately not edited. It is now a frozen pre-change rollback
snapshot rather than a mirror, so it will read as drifted against Cloudflare.

### Health check now reads

```
classicminidiy.com   [WARN]  SPF ok, 1 of 10 lookups   MX pending, DMARC p=none
theminiexchange.com  [WARN]  SPF ok, 1 of 10 lookups   MX pending, DMARC p=none
cmdiy.co             [FAIL]  no SPF (deliberate)       MX pending, DMARC p=none
```

Every SPF finding is cleared. The remaining warnings are the two things this
change deliberately did not do: the MX cutover, and DMARC enforcement.

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

**Status 2026-09-03: `unconfigured` on all three zones.** This step cannot be
scripted end to end — adding a destination address sends a verification email
that a human must click, and the CMDIY API token has no account-level Email
Routing permission either. Do it in the Cloudflare dashboard.

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
5. ~~Finish or remove Shopify's `classicminidiy.com` domain authentication.~~
   **Answered:** Shopify's sender is `orders@cmdiy.co` and authenticates there.
   Nothing needs finishing on `classicminidiy.com`; see the `maileri5q` note
   above for why the leftover mailer CNAME is best left alone.
6. **Give the two OpenECU zones the same audit.** They are on Cloudflare with
   live Route 53 zones behind them and this token cannot see them, so nobody has
   diffed them.
