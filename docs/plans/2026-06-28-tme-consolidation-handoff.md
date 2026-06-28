# The Mini Exchange → CMDIY consolidation — CONTINUATION HANDOFF

**Last updated:** 2026-06-28. Read this first to resume without losing progress.

## TL;DR

The whole TheMiniExchange (TME) marketplace has been ported into this repo under `/exchange`,
**flag-gated** behind `NUXT_PUBLIC_EXCHANGE_ENABLED` (off = invisible/404 in prod). All the ported
code lives on the **`tme-merge`** branch (the source of truth). We are now landing it into **`dev`**
as a series of small **per-section PRs** (because one mega-PR was too big for code review). When `dev`
is complete it merges to `main` and we flip the flag — that's cutover.

## Branch model + review (IMPORTANT)

- **`tme-merge`** = source of truth; all ported work is here as linear commits on top of `main`.
- **`dev`** = integration branch; auto-deploys to a Vercel **preview**. Section PRs target `dev`.
- **`main`** = production. `dev` → `main` is the cutover merge.
- **Merges: REBASE ONLY.** Squash and merge-commit are disabled on this repo. Use
  `gh pr merge <n> --rebase --delete-branch`. (If it says "Head branch is out of date," it's usually
  a transient stale state right after a push — just retry; only rebase the branch if `merge-base(dev,
  branch) != dev tip`.)
- **Code review:** GitHub **Copilot** (reads `.github/copilot-instructions.md`, already merged to
  `dev`). NOTE: `gemini-code-assist[bot]` was ALSO auto-reviewing through PR #640 (its findings were
  good and were addressed); Cole said #640 is the last Gemini one. Verify which bot is the gate.

## Section PR progress

| PR | Section | status |
|----|---------|--------|
| #638 | `.github/copilot-instructions.md` | ✅ merged to dev |
| #639 | 1 — foundation (flag, gate, deps, shared composables, browse) | ✅ merged (+review fixes) |
| #640 | 2 — listing detail page | ✅ merged (+review fixes) |
| #641 | 3 — read pages (finds/wanted/sold + full browse) | ✅ merged (+review fixes) |
| #642 | 4 — create-listing wizard + Stripe proxy | ✅ merged (+review fixes) |
| #643 | 5 — edit/bulk + write server routes | ✅ merged (+review fixes) |
| #644 | 6 — messaging + Finds scraper | ✅ merged (+review fixes) |
| #645 | 7 — dashboard + admin core | ✅ merged (+review fixes) |
| #646 | 8 — admin rest (finds/promotions/messages/newsletter) | ✅ merged (+review fixes) |
| #647 | 9 — onboarding + remaining pages + seller signals | ✅ merged (+review fixes) |
| #648 | 10 — feeds + sitemap/robots + legal + redirects | ✅ merged (+review fixes) |

✅ **Section-PR phase COMPLETE — all 10 sections merged to `dev` (51 commits ahead of `main`).**
The entire TME consolidation now lives on `dev` behind `NUXT_PUBLIC_EXCHANGE_ENABLED` (off in prod).
Next step is **NOT** another section — it's the dev→main cutover, which depends on the "NOT YET
BUILT" backend work below landing first. Nothing more to cherry-pick from `tme-merge` for sections.

## How to cut the next section PR (the loop)

Sections must merge in order (later ones import earlier composables). Each is cut **fresh off the
latest `dev`** and the section's commit range is cherry-picked from `tme-merge` (this stays correct
regardless of how prior sections merged — it's content-based). Commit **positions** in
`git rev-list --reverse --no-merges origin/main..origin/tme-merge` are stable (1–36 = the section
commits; 37 = copilot; 38+ = review-fix commits appended on top):

| Section | positions (cherry-pick `A..B`) | ~files / lines |
|---------|--------------------------------|----------------|
| 3 | A=11 B=14 | 21 / 6.7k |
| 4 | A=14 B=15 | 22 / 7.2k |
| 5 | A=15 B=17 | 30 / 8.9k |
| 6 | A=17 B=19 | 23 / 3.6k |
| 7 | A=19 B=23 | 22 / 5.6k |
| 8 | A=23 B=27 | 8 / 4.3k |
| 9 | A=27 B=33 | 23 / 4.3k |
| 10 | A=33 B=36 | 28 / 1.5k |

Template (section 3 shown — `NN-name` per the section):

```bash
cd ~/Development/classicminidiy && git fetch origin --quiet
A=$(git rev-list --reverse --no-merges origin/main..origin/tme-merge | sed -n '11p')
B=$(git rev-list --reverse --no-merges origin/main..origin/tme-merge | sed -n '14p')
git checkout -b exchange/03-read-pages origin/dev
git cherry-pick ${A}..${B}        # expect clean; new files
git push -u origin exchange/03-read-pages
gh pr create --base dev --head exchange/03-read-pages --title "feat(exchange): read pages (3/10)" --body "..."
git checkout tme-merge            # restore the source-of-truth working tree
```

Verify the slice compiles (dev server, flag is ON in local `.env`): `curl -s -o /dev/null -w '%{http_code}'`
the new routes. Gemini-flagged whole-codebase patterns to expect (already fixed in 1–2; watch for
repeats): module-level caches → use `useState`; `crypto.randomUUID()` → add a fallback; browser-only
libs (mapbox) → client-only dynamic import; relative/locale dates → `<ClientOnly>` or `timeZone:'UTC'`;
SSR view-count/RPC writes → gate on `import.meta.client`.

### Addressing review feedback on a section PR
Fix on **`tme-merge` first** (source of truth), then mirror to the PR branch:
```bash
# on tme-merge: edit files, then
git commit -am "fix(exchange): address PR #<n> review feedback"
git push origin tme-merge
FIX=$(git rev-parse HEAD)
git checkout exchange/NN-...; git cherry-pick $FIX; git push; git checkout tme-merge
gh pr merge <n> --rebase --delete-branch
```

## NOT YET BUILT (separate work after the section PRs land)

These were designed/decided but not yet coded — they need secrets/Supabase and were deferred:

1. **Social auto-posting — ✅ DONE (web; authored, not deployed).** On CMDIY `tme-merge`:
   `server/utils/exchange/{socialMedia,imageProcessor}.ts` (Meta Graph + Bluesky + sharp), the
   `server/api/admin/exchange/social-retry.post.ts` admin route (requireAdminAuth; the promotions page's
   404 call now resolves), and `server/api/cron/exchange/social-sweep.get.ts` — a Vercel Cron
   (`*/15`, in vercel.json) that posts paid+active+`promoted_on_social=false` listings (CRON_SECRET
   bearer, flag-gated, bounded 10/run; idempotent atomic claim). `sharp` added; meta*/bluesky* +
   `cronSecret` private runtimeConfig added (reuse TME creds). SES failure-email → console.error.
   Routes verified compiling (401, sharp resolves). **Deploy/env:** set META_ACCESS_TOKEN, META_PAGE_ID,
   META_INSTAGRAM_ACCOUNT_ID, BLUESKY_HANDLE, BLUESKY_APP_PASSWORD, CRON_SECRET in Vercel; confirm the
   plan allows the `*/15` cron (Hobby = once/day max → bump the schedule if so).
2. **Newsletter — ✅ core DONE (bulk send), ⬜ admin proxies remain.**
   - ✅ **Bulk send + Shopify merge (supabase `tme-merge`, commit 58cf152, deno-checked, NOT deployed):**
     process-notifications already had `processWeeklyDigest` (premium/free curation, SES send,
     `newsletter_sends` logging) + a pg_cron (`weekly-digest-newsletter`, Mon 09:00 UTC). Enriched it
     with `_shared/shopify.ts` (ported Shopify Admin GraphQL subscriber fetch) + `email_suppressions`
     filtering — recipients = opted-in profiles ∪ Shopify subs (deduped) − suppressed. So the
     consolidation's "edge fn + pg_cron + keep Shopify merge" decision is satisfied by EXTENDING the
     existing digest, not a new fn (avoids a duplicate newsletter). **Deploy/env:** set
     SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN as edge-fn secrets.
   - ⬜ **Admin proxies (`/api/admin/exchange/newsletter/{preview,test,send}` — still 404):** the admin
     newsletter page (`app/pages/admin/exchange/newsletter.vue`) calls these for manual preview/test/send.
     Wire as thin web routes (requireAdminAuth) → for `send`, invoke process-notifications with
     `{action:'weekly_digest'}` (the pattern: `$fetch(\`${supabaseUrl}/functions/v1/process-notifications\`, { headers: Bearer service-key })`, see server/api/models/checkout.post.ts). `preview`/`test`
     need small new process-notifications actions (return counts + listings + emailHtml; send to one
     address) OR render web-side — preview/test reuse the same curation+template, so a process-notifications
     `newsletter_preview`/`newsletter_test` action is the DRY path. Tables already exist (shared DB).
3. **Transactional email — ✅ DONE (authored, not deployed).** SES builders + web enqueues + watcher
   triggers all landed; deploying `process-notifications` + applying migrations `20260628000001/2` at
   cutover makes it live.
   - ✅ **Supabase (`classicminidiy-supabase` `tme-merge`, commit 3287675, deno-checked, NOT deployed):**
     `process-notifications` now renders 7 new TME-branded marketplace templates +
     migration `20260628000001` widens `notification_queue.valid_event_type`:
     `listing_submitted`, `seller_inquiry`, `watchlist_sold`, `price_drop`, `admin_listing_pending`,
     `admin_wanted_pending`, `admin_find_pending`. (5 older types — `new_message`, `new_comment`,
     `comment_reply`, `listing_status`, `saved_search_match` — were already built.) New types use the
     TME From identity (out of `CMDIY_EVENT_TYPES`) and are unmapped in the prefs map
     (admin = always-sent; user = default-on email). URLs use `SITE_URL` + bare TME paths and rely on
     the host 301s.
   - ✅ **Web enqueues wired (CMDIY `tme-merge`):** `notificationQueue.ts` `EventType` union +
     `buildBatchKey` extended; added `queueAdminNotification()` (one row per `profiles.is_admin=true`,
     shared batch key → one digest per admin). The 4 `TODO(Stage 8)` sites now enqueue:
     `listings/submit` → `listing_submitted` + `admin_listing_pending`; `contact-seller` →
     `seller_inquiry` (confirmed NOT redundant — it's the anonymous contact form, no conversation/
     `new_message`; unique batch key per inquiry); `wanted/create` → `admin_wanted_pending`;
     `external-listings/notify-submit` → `admin_find_pending`. All fire-and-forget + awaited.
   - ✅ **`watchlist_sold` / `price_drop` fire via DB trigger** (supabase `tme-merge`, migration
     `20260628000002`, commit 43080d4). An `AFTER UPDATE ON listings` trigger
     (`notify_listing_watchers`, SECURITY DEFINER) fans rows out to every watcher (except the seller):
     status→`sold` ⇒ `watchlist_sold`, active price decrease (`NEW.price < OLD.price`) ⇒ `price_drop`.
     Chosen over a web route because mark-sold/price edits run client-side via PostgREST (a route hook
     would be skippable) and the trigger gets `OLD.price` vs `NEW.price` natively. Validated in a
     disposable Postgres (sale→2, drop→2, seller excluded, no-op updates don't fire; payloads match the
     builders). The web `EventType` union still lists both for parity; they have no web caller by design.
   - **Email is AWS SES, NOT Resend.**
4. **Supabase edge-fn branch — ✅ merged up to date.** `classicminidiy-supabase` `tme-merge` has
   `create-listing-checkout / verify-listing-payment / stripe-listings-webhook` (S1) and is now merged
   current with `main` (merge commit 7346d83). Still **NOT deployed** — deploy at cutover.
5. **Tests.** TME's ~142 vitest tests not yet ported.

## Cutover (dev → main), later

1. Merge `dev` → `main` (flag still off → still invisible).
2. Deploy the Supabase edge fns; set the **listing** Stripe webhook secret + Meta/Bluesky/Shopify
   tokens + a cron secret as CMDIY prod env vars (same values as TME).
3. Flip `NUXT_PUBLIC_EXCHANGE_ENABLED=true` in Vercel production.
4. Point `theminiexchange.com` (+www) at the CMDIY Vercel project → activates the 28 host-301s in
   `vercel.json`.
5. Remove the flag + `exchange-flag`/`exchange-onboarding` gates; retire the standalone TME deploy.

## Load-bearing invariants (don't "fix" these)

- **daisyUI 5 + Tailwind v4**, NOT Nuxt UI (stale docs). **Font Awesome 6 only** (`<i class="fas …">`);
  no Heroicons/Lucide in app code.
- **i18n:** per-SFC `<i18n lang="json">` with ALL 10 locales (en es fr de it pt ru ja zh ko); NO HTML
  in message values; `/legal`, `/about`, `/admin/*` are English-only. Build-breakers: duplicate
  top-level identifiers in an SFC `<script setup>` (500s the whole app — SFC-parse won't catch it),
  HTML-in-i18n, invalid i18n JSON, `*/` inside a JSDoc block.
- **Security:** `/api/langgraph/**` intentionally unauthenticated; `/mcp` fails closed;
  `SUPABASE_SERVICE_KEY` server-only via `getServiceClient`. No migrations in this repo (they live in
  `classicminidiy-supabase`).
- **Exchange gating:** `app/utils/exchangeRoutes.ts#EXCHANGE_PREFIXES` is the shared list for both
  `exchange-flag.global.ts` and `exchange-onboarding.global.ts` — keep them in sync.

## Key references

- Consolidation design doc: `docs/plans/2026-06-17-theminiexchange-consolidation.md`
- Onboarding gate: `docs/plans/2026-06-28-exchange-onboarding-gate.md`
- Icon map: `docs/plans/2026-06-17-exchange-icon-mapping.md`
- Migration map: `docs/plans/2026-06-17-exchange-migration-map.md`
- Local recovery tags: `tme-merge-prerebase-backup`, `dev-prereset-backup` (on Cole's machine only).
