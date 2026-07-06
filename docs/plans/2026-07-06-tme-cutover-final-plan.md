# TME → CMDIY Consolidation: Final Cutover Plan

## Context

The Mini Exchange (TME, `theminiexchange.com`) — a standalone Nuxt 4 marketplace — has been fully ported into `classicminidiy` under `/exchange`, flag-gated behind `NUXT_PUBLIC_EXCHANGE_ENABLED`. The port is **code-complete on the `dev` branch** but has **not been cut over to production**. This plan is the remaining work: verify, merge `dev → main`, deploy the Supabase side, flip production live, move DNS, and decommission the standalone TME site.

### State as of 2026-07-06 (verified)

**Branches (classicminidiy):**
- `tme-merge` = source-of-truth port branch. `dev` = integration branch. Both are **content-identical** (`git diff origin/dev origin/tme-merge` is empty) and **140 commits ahead of `main`, 0 behind** (~87.8k insertions, 294 files). Nothing exchange-related has landed on `main`.
- All 11 section PRs are merged to `dev`: #638 (copilot instructions), #639–#648 (sections 1–10), #649 (build hardening + social edge fn + open browsing + TME home port, merged 2026-06-30). PR #637 was the abandoned mega-PR (closed unmerged, superseded).

**What is DONE on `dev` (do not redo):**
- All routes/pages/components/composables/server APIs under `/exchange`, `admin/exchange`, dashboard tabs, onboarding gate (open browsing: only action routes gated), real TME home page port, 10-locale i18n on all public surfaces.
- Flag wiring: `nuxt.config.ts:540` (`exchangeEnabled`), prerender exclusion at `:251`, `app/middleware/exchange-flag.global.ts` + `exchange-onboarding.global.ts` sharing `app/utils/exchangeRoutes.ts#EXCHANGE_PREFIXES`.
- 28 host-scoped 301 redirects in `vercel.json` (keyed on `host: theminiexchange.com`) — dormant until DNS points at the CMDIY Vercel project.
- Build hardening: 8GB Node heap, `sharp`/`@atproto/api` externalized from Nitro, server sourcemaps dropped.
- ~2,950 new unit tests; full suite green at 4,684 passing on `dev`.
- Social auto-posting + newsletter + transactional email all **converged server-side to Supabase** (`post-listing-social` edge fn + `*/15` cron; `process-notifications` extended with 7 marketplace event types, weekly digest + Shopify merge, newsletter preview/test/send actions; watcher-trigger migration for `watchlist_sold`/`price_drop`). Web side is thin `requireAdminAuth` Bearer proxies (`server/api/admin/exchange/{social-retry,newsletter/*}`). `vercel.json` `crons` is intentionally `null` (cron lives in Supabase now).

**Supabase repo (`classicminidiy-supabase`) — per docs, NOT verifiable from this session (repo wasn't attached):**
- Branch `tme-merge` there carries: `create-listing-checkout` / `verify-listing-payment` / `stripe-listings-webhook` edge fns, `post-listing-social` edge fn + cron, `process-notifications` enhancements, migrations `20260628000001` (widen `notification_queue.valid_event_type`) and `20260628000002` (listing watcher triggers). Tracked in **supabase PR #48** — as of 2026-06-30 it was staged but **NOT merged/deployed**. The listing-detail RPC fix (`get_seller_stats`, `get_related_listings`) was already applied to prod.
- Watcher triggers + social cron were **deliberately deferred** so live TME prod behavior is untouched (double-email / double-post risk). They activate at cutover.

**Known open blocker (CONFIRMED still broken by Cole, 2026-07-06):**
- Native Vercel git-deploys of this repo stall at the *finalize* step (infra-side; a `--prebuilt` deploy of identical output went READY in ~13s; no-build-cache did not fix it). This blocks the normal git-push production deploy of `main`. The working path is CLI: `vercel build` + `vercel deploy --prebuilt` — the plan uses that for all production deploys until Vercel resolves the infra issue (support ticket).

**Key reference docs (on `dev`):**
- `docs/plans/2026-06-28-tme-consolidation-handoff.md` — branch model, cutover steps, invariants (READ FIRST)
- `docs/plans/2026-06-17-theminiexchange-consolidation.md` — master design (cutover switch, redirects, backend convergence)
- `docs/plans/2026-06-17-exchange-migration-map.md`, `2026-06-17-exchange-icon-mapping.md`, `2026-06-28-exchange-onboarding-gate.md`

### Load-bearing invariants (do NOT "fix")
- Merges on this repo are **REBASE ONLY** (squash + merge-commit disabled).
- daisyUI 5 + Tailwind v4 (repo CLAUDE.md's "Nuxt UI" claim is stale for exchange surfaces); Font Awesome 6 only; per-SFC `<i18n lang="json">` with all 10 locales, no HTML in messages; `/legal`, `/about`, `/admin/*` English-only.
- No DB migrations in the web repo — they live in `classicminidiy-supabase`.
- Email is AWS SES, not Resend. Exchange Stripe (listing promotions) is separate from membership Stripe and model-marketplace Stripe (triple-webhook isolation).
- `EXCHANGE_PREFIXES` in `app/utils/exchangeRoutes.ts` is shared by both global middlewares — keep in sync until the flag is removed.

### Session prerequisites for the executing chat
- Attach **`ClassicMiniDIY/classicminidiy-supabase`** and **`ClassicMiniDIY/TheMiniExchange`** to the session (`add_repo` / repo picker) — this session could not access them, so all supabase/TME facts below MUST be re-verified there first.
- Production actions (Vercel env + DNS, Stripe dashboard, `supabase db push` / `functions deploy`) are Cole-in-the-loop: pause and confirm at each ⛔ checkpoint. Everything before Phase 3 is safe/invisible (flag off).

---

## Phase 0 — Verify current state (read-only)

1. `git fetch origin main dev tme-merge`; confirm `dev` still contains `main` (`git rev-list --count origin/dev..origin/main` == 0). If `main` moved ahead, rebase `dev` onto `main` first (rebase-only repo) and re-run the test suite.
2. Confirm `dev` == `tme-merge` content (`git diff origin/dev origin/tme-merge` empty). `tme-merge` is retired as source-of-truth after cutover; `dev` is what merges.
3. In **classicminidiy-supabase**: check PR #48 state (open/merged), whether branch `tme-merge` there is current with its `main`, and which pieces are deployed (edge fns list via `supabase functions list` or dashboard; migrations applied via `supabase migration list`). Update the picture — docs say "staged, not deployed" as of 06-30.
4. In **TheMiniExchange**: list commits since 2026-06-17 (`git log --since=2026-06-17 --oneline`). Any production changes made to TME after the port snapshot must be re-ported to `dev` (use `docs/plans/2026-06-17-exchange-migration-map.md` to find the CMDIY-side location for each touched file). If none — record that and move on.
5. Run the full unit suite on `dev` (`bun install --frozen-lockfile && bun run test` or the vitest command in package.json) — expect ~4,684 passing.
6. **Vercel deploy blocker — confirmed still broken.** Native git deploys stall at finalize. Dry-run the workaround now so it's proven before cutover: `vercel pull --environment=production && vercel build --prod && vercel deploy --prebuilt --prod --skip-domain` (or a preview-target equivalent) and confirm it goes READY. Script it (e.g. `scripts/deploy-prebuilt.sh`) so Phases 3–4 are repeatable, and draft the Vercel support ticket for the root cause (evidence: identical `--prebuilt` output deploys in ~13s; no-build-cache didn't help).

## Phase 1 — Close the small code gaps (on `dev`, flag still off)

All small; each as a normal PR to `dev` (rebase merge):

1. **Stale runtimeConfig cleanup** (`nuxt.config.ts:236-248`): `metaAccessToken`/`metaPageId`/`metaInstagramAccountId`/`blueskyHandle`/`blueskyAppPassword`/`cronSecret` + their comments reference `server/api/cron/exchange/*` and `server/utils/exchange/socialMedia.ts`, which PR #649 removed (social now lives in the `post-listing-social` edge fn; web is a thin proxy). Verify nothing on `dev` reads these keys (`git grep -l "metaAccessToken\|blueskyHandle\|cronSecret" origin/dev -- server/ app/`); remove dead keys/comments, keep any that the admin proxies still use.
2. **Re-port TME drift** found in Phase 0.4 (if any).
3. **Cutover runbook doc**: write `docs/runbooks/2026-07-XX-exchange-cutover-checklist.md` capturing Phases 2–5 below with the exact env var names and verification commands (mirror the pattern of `docs/runbooks/2026-06-12-model-library-launch-checklist.md`). The handoff doc's Cutover section is the seed.
4. Optional, non-blocking: note remaining test debt (integration tests for RLS/auth/CRUD deferred to CI — needs a live test Supabase). Do not build now; record in the runbook as post-cutover work.

## Phase 2 — Supabase deploy (staged; TME still live)

In `classicminidiy-supabase` (verify each against actual repo state from Phase 0.3):

1. Merge PR #48 (or the `tme-merge` branch) to its `main` if not already.
2. Deploy the **safe-now** pieces (no user-visible effect while the web flag is off and TME is live):
   - Edge fns: `create-listing-checkout`, `verify-listing-payment`, `stripe-listings-webhook`, updated `process-notifications`, `post-listing-social` (fn deployed, **cron NOT scheduled yet**).
   - Migration `20260628000001` (event-type widening — additive, safe).
3. **Defer until DNS cutover (Phase 4):** migration `20260628000002` (watcher triggers — would double-email alongside live TME) and the `*/15` social cron schedule (would double-post).
4. Secrets (edge-fn secrets in Supabase): `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ACCESS_TOKEN`, `STRIPE_LISTINGS_WEBHOOK_SECRET` (create the listing webhook endpoint in the Stripe dashboard pointing at `stripe-listings-webhook`; separate from membership + model webhooks), Meta/Bluesky creds for `post-listing-social` (reuse TME's values).
5. Verify: invoke `process-notifications` `newsletter_preview` action via the web admin proxy on a flag-on preview; Stripe test-mode replay against `stripe-listings-webhook` confirming triple-webhook isolation (membership/model/listing secrets don't cross-validate).

⛔ **Checkpoint: confirm with Cole before touching prod Supabase/Stripe.**

## Phase 3 — Merge dev → main + prod env (still invisible)

1. Merge `dev` into `main` (flag off ⇒ `/exchange/**` 404s, sitemap/robots/nav unchanged, redirects dormant). Repo is rebase-only — expect a rebase of the 140 commits or an explicitly-approved merge strategy; do NOT squash.
2. Deploy production via the prebuilt workaround from Phase 0.6 (`vercel build --prod` + `vercel deploy --prebuilt --prod`) — do NOT rely on the git-push deploy; it stalls at finalize. Also disable/ignore the auto git deploy for this push if it would race the prebuilt one.
3. Set Vercel **production** env vars, flag still off: `CAMINO_API_KEY` (optional), and whichever social/cron keys survived Phase 1.1. Do NOT set `NUXT_PUBLIC_EXCHANGE_ENABLED` yet.
4. Smoke prod: `/exchange` returns 404; existing site (models, toolbox, archive, membership) unaffected; run the unit suite on `main`.

⛔ **Checkpoint: confirm prod deploy is healthy before go-live.**

## Phase 4 — Go-live

Order matters (flag before DNS, so redirect targets exist):

1. Flip `NUXT_PUBLIC_EXCHANGE_ENABLED=true` in Vercel Production (runtime override — no rebuild needed). Verify `/exchange` renders, browse/detail/checkout (test mode)/messages/dashboard tabs work, nav entry switches from external `theminiexchange.com` link to internal `/exchange`, sitemap + robots include exchange, feeds respond.
2. Enable the deferred Supabase pieces: apply migration `20260628000002` (watcher triggers) + schedule the `post-listing-social` `*/15` cron. **Simultaneously disable the standalone TME site's own cron/email senders** (or take TME down to a redirect shell) to avoid a double-fire window.
3. Point `theminiexchange.com` + `www` DNS at the CMDIY Vercel project → activates the 28 host-scoped 301s. Verify a sample of legacy deep links (`/listings/[slug]`, `/wanted`, `/finds`, `/messages`, `/terms`, `/`, feeds) 301 to their `/exchange/*` equivalents; keep the domain registered indefinitely.
4. Live verification: one real (or test-mode) listing-promotion purchase end-to-end (checkout → webhook → `listing_promotions` row → premium badge); a transactional email fires from `notification_queue` (e.g. `listing_submitted`); social sweep posts a promoted listing once (idempotent claim — no dupes); realtime messaging smoke with two sessions.

⛔ **Checkpoint: Cole executes/approves DNS + Stripe-live steps.**

## Phase 5 — Post-cutover cleanup (after a soak period, ~1 week suggested)

1. Remove the flag + gates: delete `exchange-flag.global.ts`, drop `exchangeEnabled` from runtimeConfig, remove the flag conditionals in nav/sitemap/robots/prerender, keep `exchange-onboarding.global.ts` (that one is permanent behavior). Delete `.env` flag references.
2. Retire the standalone TME Vercel project + repo (archive `ClassicMiniDIY/TheMiniExchange`; final README pointer to `classicminidiy`). Remove TME-only secrets from its Vercel project.
3. Delete stale branches: `tme-merge` (both repos, after confirming content parity with what shipped), and the merged `exchange/*` section branches if any remain.
4. Update docs: mark `docs/plans/2026-06-28-tme-consolidation-handoff.md` + the design doc as COMPLETE; update repo `CLAUDE.md` (it still says "Nuxt UI" and doesn't mention `/exchange`); update the CMDIY Platform #9 project card (TME property → Shipped/consolidated).
5. Backlog (record, don't block): integration test suite in CI against a test Supabase; Finds scraper metadata-coverage review (Puppeteer was dropped for OG/JSON-LD + Microlink — watch for bot-blocked sites); confirm which review bot (Copilot vs Gemini) is the active gate.

## Verification summary

- Every phase ends with the unit suite green (baseline 4,684) and, from Phase 3 on, a READY production deploy.
- The four end-to-end proofs that define "zero functionality loss": paid listing promotion via Stripe (isolated webhook), transactional email via `notification_queue`, social auto-post via the edge-fn cron (no double-post), legacy-URL 301 coverage.
- Rollback levers, in order of severity: flag off (instant, runtime), DNS back to TME (while it still exists), revert the supabase cron/trigger pieces (migration `20260628000002` has no destructive DDL).
