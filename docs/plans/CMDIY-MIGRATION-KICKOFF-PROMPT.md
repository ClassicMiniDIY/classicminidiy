# CMDIY Cloudflare migration — kickoff prompt

Copy everything below the line into a fresh Claude Code session started in
`/Users/colegentry/Development/classicminidiy`.

---

Migrate the whole Vercel estate to Cloudflare Workers: **five domains** —
`classicminidiy.com` (the app), `theminiexchange.com` (a 28-redirect estate), and
`classicminidiy.net`, `classicminidiy.org`, `wheeldictionary.com` (redirects to the primary
site, and all three hosted on Vercel DNS, so they gate decommissioning).
OpenECUAlliance already completed this migration as the pathfinder — its findings are
binding, and re-deriving them is wasted work.

## Anchor document — read it FIRST, all of it

Master plan: `docs/plans/2026-08-06-cloudflare-workers-migration.md` on branch
`claude/cmdiy-vercel-cloudflare-migration-3f4a6a` (committed 2026-08-24 as b6d08797; if
you're on another branch, `git show claude/cmdiy-vercel-cloudflare-migration-3f4a6a:docs/plans/2026-08-06-cloudflare-workers-migration.md`).

Read the whole thing, in this priority order when sections conflict:

1. **"TRANSFERABILITY REPORT — OpenECUAlliance pathfinder"** — the completed migration's
   verdict on every amendment. This wins over everything else.
2. **"Pathfinder log — OpenECUAlliance"** (15 entries) — the evidence behind the report.
3. **"Adversarial review — BINDING AMENDMENTS"** (A1–A4, B1–B2, C1–C8, D1–D4, E1–E6) —
   still binding EXCEPT where the Transferability report contradicts them.
4. The original phase text — lowest priority; several parts are now known wrong.

## What the pathfinder settled — do not relitigate

- **Cutover method: grey-cloud sequence.** C1's cert pre-provisioning does NOT work for
  full-setup zones. Instead: set every web record DNS-only BEFORE the NS flip, so the flip
  moves DNS authority only and traffic keeps reaching Vercel on Vercel's TLS (invisible, no
  cert gap). Then, once the Cloudflare cert is Active, proxy the records and add the Worker
  route — that is the actual traffic switch, independently reversible.
- **Use Worker ROUTES, not custom domains.** A custom domain requires deleting the
  production DNS record. A route + proxied record (content can be a dummy) avoids the
  deletion entirely and makes rollback a single `proxied: false` toggle.
- **`NODE_OPTIONS=--max-old-space-size=6144` on the CI build step is mandatory.** Node caps
  its own heap near 2 GB regardless of runner RAM. Builds fine locally, fails only in CI
  after merge. cmdiy's bundle is bigger than OECUA's — this WILL bite.
- **Grep `server/` for module-scope `setInterval`/`setTimeout` in the spike.** A global-scope
  timer aborts worker startup entirely — every route dead, not a degraded request. The
  `typeof x !== 'undefined'` guard does NOT catch it.
- **Confirm every negative result at the edge before acting on it.** Local resolver caches
  and mailbox search each produced a confident, wrong "it's broken" during the OECUA
  cutover. Use `curl --resolve <host>:443:<edge-ip>` plus a public resolver (1.1.1.1,
  8.8.8.8). On a high-traffic domain a false alarm invites an unnecessary rollback, which is
  worse than the problem it's trying to solve.
- **Measure the delegation TTL, don't assume 48 h.** `dig +norecurse NS <domain> @<tld-ns>`.
  .org was 3600 and propagated in ~1 h. Also: whois showing new nameservers is NOT
  propagation — only the TLD's DNS answer is.
- **CF's zone auto-scan imported all records byte-perfect for OECUA**, including a 218-char
  DKIM TXT. C2's discipline still applies, but its role is *verification*, not import: get an
  authoritative record dump and diff against it. **cmdiy's SES DKIM CNAMEs are the case C2
  was actually written about and remain untested.**
- **Workers Paid is required.** OECUA's bundle was 3.54 MB gzip, over the 3 MiB free cap.
- **Cost: this is a net increase until cmdiy migrates.** No savings from OECUA's move; the
  Pro seat stays for cmdiy. Don't sell this on cost.

## What is still UNPROVEN — this is where cmdiy's real risk lives

The pathfinder could not exercise any of these. Treat each as full risk:

- **A1 — AWS SDK `client.send()` on workerd** (`server/utils/s3Models.ts:130,147`). The plan
  says rewrite as `fetch()` against presigned URLs. Verify the failure first, then fix.
- **A3 — `/mcp` needs the uninstalled `agents` package.**
- **A4 — unbounded request body buffering** (Vercel's 4.5 MB cap disappears).
- **B1 — the 28-redirect TheMiniExchange estate.** The plan's restructure (zone-edge Single
  Redirects + Bulk Redirects, `rm` the 7 meta-refresh artifacts, shrink `run_worker_first`)
  is untested. OECUA had zero host redirects, so B1's reasoning was only indirectly confirmed.
- **takumi-wasm OG rendering** and the 10 MB bundle ceiling.
- **KV-backed cached handlers** and E1's swr coalescing question.
- **D2/D3 — preview environments** and their separate secret sets.
- **Supabase auth**: cmdiy uses localStorage; OECUA used cookie SSR auth — the opposite
  model. OECUA's auth bug was app-level (a build-baked redirect origin), not platform-level.
  Grep cmdiy's auth flows for hardcoded/`site.url`-derived redirect origins before trusting
  any allowlist work.

## Cole-action batch — front-load ALL of this, it cost the most calendar time on OECUA

Ask once, at the start, not piecemeal:

1. **Cloudflare zones — there are FIVE, not two.** `classicminidiy.com` and
   `theminiexchange.com` are on Route 53. `classicminidiy.net`, `classicminidiy.org` and
   `wheeldictionary.com` all redirect to the primary site and are hosted on **Vercel DNS**
   (`ns1/ns2.vercel-dns.com`; no MX and no TXT on any of the three). That makes them a **Phase 5
   blocker** — deleting the Vercel projects while they still delegate there NXDOMAINs them, it
   does not merely stop the redirect — and it makes them the **zero-risk rehearsal**: migrate
   `wheeldictionary.com` first, then `.net`/`.org`, then the two real zones. See "Domain
   inventory — all FIVE zones" in the master plan. **Cole creates all five zones in the
   dashboard** ("Add a site", Free plan, stop at the nameserver screen — do NOT touch the
   registrar yet); account-owned tokens cannot create zones and their permission-group catalog
   is unreadable, so do not plan around API-driven zone creation.
2. **A dedicated Cloudflare API token for this migration** — Cole's explicit ask: one token,
   revocable at Phase 5, not a reused account-wide one. Name it `cmdiy-cf-migration`. Zone
   Resources: Include → **Specific zone** → all five, listed individually, never "All zones";
   the policy must be **zone-scoped**, because an account-scoped policy alone leaves
   DNS/SSL/Zone-Settings denied even on zones that already exist. **Edit** on: DNS, Zone
   Settings, SSL and Certificates, Dynamic Redirect, **Workers Routes**; plus account-scope
   Workers Scripts and Workers KV — and Bulk Redirect Lists + Rules if B1's 19 exact-source TME
   redirects are built as a Bulk Redirects list, which is an account resource, not a zone one.
   Give it an explicit ~90-day expiry and revoke it deliberately at Phase 5. Store it as
   **`CLOUDFLARE_API_TOKEN`** (plus `CLOUDFLARE_ACCOUNT_ID`) — **do not reuse `CLOUDFLARE_TOKEN`
   or `CLOUDFLARE_ZONE`**, which the dead "Purge my Cache" workflow still references; delete or
   repoint that workflow as an explicit Phase 2 step. Verify the token with a **real write**:
   create then delete a throwaway TXT on `wheeldictionary.com`, read a zone setting on
   `classicminidiy.com`, and attempt one Workers Routes write. Reads succeeding proves nothing.
3. **GitHub Actions secrets** — offer to set these yourself with `gh secret set` if the values
   are already in the environment or `.env`; on OECUA that removed the step entirely.
4. **Supabase**: redirect-URL allowlist entries for every origin that will serve the site,
   plus the edge-function origin allowlists (D4: FOUR functions, TWO env vars,
   `MODELS_ALLOWED_ORIGINS` and `MEMBERSHIP_ALLOWED_ORIGINS`, exact-match Sets).
5. **Authoritative DNS dump for all five zones** — `aws route53 list-resource-record-sets` for
   the two Route 53 zones, and the Vercel DNS record listing for the other three — as the
   verification oracle. Flag every mail record explicitly; cmdiy's SES DKIM **CNAMEs** are the
   untested case C2 was actually written about. Note that `theminiexchange.com` publishes
   `v=spf1 include:send.resend.com ~all` while transactional mail is **SES** — record the
   discrepancy, do not "fix" it during a zone move.
6. **Registrar NS changes** at Amazon Registrar — Phase 3a for the three redirect zones,
   Phase 4a for the two real ones. **NO registrar transfer, ever**; Cole has ruled that out
   permanently.
7. **Vercel domain removal / project deletion** (Phase 5) — five domains and four projects, and
   note that deleting the project removes the rollback path. Gate it on `dig NS` showing
   Cloudflare for all five.

## Process rules

- **Baseline snapshot before any code change**, committed to `docs/baselines/`. Capture
  `curl -sI` for http+https on **every hostname across all five domains** (apex and `www`),
  redirect status codes and targets, path and query preservation, HSTS, cache-control, and the
  full DNS picture. The Phase 4 battery diffs against it. Note OECUA discovered Vercel's apex
  redirect is a **307**, not 308 — measure, don't assume, and capture the three redirect
  domains' behavior *before* Vercel stops serving them, since it is unrecoverable afterwards.
- **Write `scripts/verify-cf-deploy.sh` in Phase 2, not Phase 4**, parameterized by origin
  (default production, accepts a workers.dev target). On OECUA it caught a stale deployment
  and two of its own assertion bugs while still on preview. A battery first exercised on
  cutover day is a battery whose bugs surface at the worst moment.
- **Design doc first**: `docs/plans/<today>-cloudflare-workers-migration.md` in this repo,
  tracking phase status. Branch `feature/cloudflare-workers-migration` off fresh
  `origin/main` (`git fetch` first). Conventional commits. Push freely to the feature
  branch; never to `main`.
- **Fix bugs without asking.** If something breaks — especially something you introduced —
  branch, fix, PR, merge, and report. Don't open a "may I fix this?" round trip. Keep asking
  first for: destructive DNS operations, schema migrations, outward-facing actions, `main`
  pushes, and feature PRs where scope is a judgment call.
- **Evidence before success.** Show the command and its output before calling anything green.
- **Batch questions once per phase.** Do all work that doesn't depend on the answers first.
- **After three failed attempts at the same thing, stop.** Name the assumption that might be
  wrong and ask one question. On OECUA the third failure was always a broken measurement,
  not a broken system.
- **Append findings to the master plan's pathfinder section** as you go, same format. cmdiy
  is the last migration, but the log is where the next person learns why things are shaped
  this way.

## Start with

Read the master plan end-to-end (Transferability report first), take the baseline snapshot,
then present the Phase 0 spike checklist adapted to cmdiy — with the A-series blockers as
explicit go/no-go gates, and the Cole-action batch above — before executing it.
