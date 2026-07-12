# TME → CMDIY Consolidation: Final Cutover Plan

## Context

The Mini Exchange (TME, `theminiexchange.com`) — a standalone Nuxt 4 marketplace — has been fully ported into `classicminidiy` under `/exchange`, flag-gated behind `NUXT_PUBLIC_EXCHANGE_ENABLED`. The port is **code-complete on the `dev` branch** but has **not been cut over to production**. This plan is the remaining work: verify, **fix the Vercel deploy regression the merge introduced (hard gate)**, deploy the Supabase side, merge `dev → main`, flip production live, move DNS, and decommission the standalone TME site.

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

**Known open blocker (CONFIRMED still broken by Cole, 2026-07-06) — MUST BE FIXED BEFORE dev→main:**
- Native Vercel git-deploys stall at the *finalize* step. **Cole's determination: this is a regression introduced by the merge work, not Vercel infra** — deploys worked before the consolidation landed on `dev`. Fixing it is a **hard gate** for Phase 3; see Phase 1. The `--prebuilt` CLI deploy (identical output goes READY in ~13s) is a diagnostic tool and emergency rollback lever only — NOT the plan of record.
- Already ruled out on `dev` (commits `6916831`/`1b62d53`): removing the 28 host redirects; disabling build cache. Deploy-relevant deltas in `main..dev`: `vercel.json` (buildCommand → `NODE_OPTIONS=--max-old-space-size=8192`, +28 redirects), `package.json` (+12 deps incl. `sharp` — now unused dead weight with native binaries, `mapbox-gl`, `chart.js`, `@nuxt/icon`, `heic2any`, `three` usage growth), `nuxt.config.ts` (+82 lines: flag, prerender exclusion, `sourceMap: false`, vite `optimizeDeps`), plus ~88k lines of app/server code (server bundle size, prerender route count, output file count).

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
- Production actions (Vercel env + DNS, Stripe dashboard, `supabase db push` / `functions deploy`) are Cole-in-the-loop: pause and confirm at each ⛔ checkpoint. Everything before Phase 4 is safe/invisible (flag off); Phase 1’s bisect deploys are previews on throwaway branches.

---

## Phase 0 — Verify current state (read-only)

1. `git fetch origin main dev tme-merge`; confirm `dev` still contains `main` (`git rev-list --count origin/dev..origin/main` == 0). If `main` moved ahead, rebase `dev` onto `main` first (rebase-only repo) and re-run the test suite.
2. Confirm `dev` == `tme-merge` content (`git diff origin/dev origin/tme-merge` empty). `tme-merge` is retired as source-of-truth after cutover; `dev` is what merges.
3. In **classicminidiy-supabase**: check PR #48 state (open/merged), whether branch `tme-merge` there is current with its `main`, and which pieces are deployed (edge fns list via `supabase functions list` or dashboard; migrations applied via `supabase migration list`). Update the picture — docs say "staged, not deployed" as of 06-30.
4. In **TheMiniExchange**: list commits since 2026-06-17 (`git log --since=2026-06-17 --oneline`). Any production changes made to TME after the port snapshot must be re-ported to `dev` (use `docs/plans/2026-06-17-exchange-migration-map.md` to find the CMDIY-side location for each touched file). If none — record that and move on.
5. Run the full unit suite on `dev` (`bun install --frozen-lockfile && bun run test` or the vitest command in package.json) — expect ~4,684 passing.
6. **Reproduce the deploy stall fresh:** push a trivial commit to `dev` and to a throwaway branch off `main`; confirm the `dev` preview stalls at finalize while the `main`-based one goes READY (proves the regression is in the `dev` diff and the baseline still works). Capture the exact last log line / step where the `dev` deploy hangs (build log + deployment events) — "finalize" covers output upload, build-cache upload, and function packaging, and knowing which narrows the search immediately.

## Phase 1 — FIX the Vercel deploy regression (HARD GATE — nothing merges to `main` until this passes)

Cole confirmed deploys worked before the consolidation, so the cause is in the `main..dev` diff. Approach: measure first, then layer-bisect off `main` with real git preview deploys as the test.

1. **Measure locally** — run `vercel build` on `main` and on `dev` checkouts and compare: `.vercel/output` total size and file count, per-function size (`.vercel/output/functions/*`), prerendered route count, `node_modules` size after `bun install --frozen-lockfile`. A finalize hang usually correlates with an upload-volume or file-count explosion; this tells us which layer to suspect before burning deploys.
2. **Layer bisect** (throwaway branches off `main`, each git-pushed for a preview deploy; ~4 deploys):
   - a. `main` + the `vercel.json` diff only (8GB buildCommand + redirects).
   - b. `main` + the `package.json`/`bun.lock` dep additions only.
   - c. `main` + the `nuxt.config.ts` diff only (needs a stub `/exchange` page dir or trimmed conditionals to build).
   - d. If a–c all deploy READY → the app/server code volume is the trigger: bisect the 140 commits by section-PR boundaries (foundation → +listing detail → +read pages → …) — `git bisect` with the preview-deploy result as the test, chunked so it's ~7 deploys, not 140.
3. **Likely-fix candidates to try as soon as the layer is known** (each is a legitimate cleanup even if it isn't the trigger):
   - Drop the now-unused `sharp` dependency (nothing on `dev` imports it since PR #649 moved image processing to the edge fn; it ships large platform-native binaries that inflate install + cache + any traced function).
   - Audit Nitro function tracing: heavy client-only deps (`mapbox-gl`, `three`, `chart.js`, `heic2any`) must not be traced into the server function — check `.vercel/output/functions/__nitro.func` contents from step 1.
   - Prerender route count / output file count (the sitemap-driven `/exchange` exclusion changed prerender behavior).
   - The 8GB `NODE_OPTIONS` in `buildCommand` (test replacing with Vercel's larger build machine or verifying it's still needed post-#649 — sharp/@atproto externalization was the original OOM cause and both are gone now).
4. **Fix the root cause on `dev`** (normal PR, rebase merge). Do NOT paper over it with `--prebuilt`.
5. **Acceptance gate:** 3 consecutive native git preview deploys of `dev` go READY, plus one clean re-deploy with build cache enabled. Only then does Phase 4 (dev→main) proceed. Record the root cause + fix in the cutover runbook.

## Phase 2 — Close the small code gaps (on `dev`, flag still off)

All small; each as a normal PR to `dev` (rebase merge):

1. **Stale runtimeConfig cleanup** (`nuxt.config.ts:236-248`): `metaAccessToken`/`metaPageId`/`metaInstagramAccountId`/`blueskyHandle`/`blueskyAppPassword`/`cronSecret` + their comments reference `server/api/cron/exchange/*` and `server/utils/exchange/socialMedia.ts`, which PR #649 removed (social now lives in the `post-listing-social` edge fn; web is a thin proxy). Verify nothing on `dev` reads these keys (`git grep -l "metaAccessToken\|blueskyHandle\|cronSecret" origin/dev -- server/ app/`); remove dead keys/comments, keep any that the admin proxies still use.
2. **Re-port TME drift** found in Phase 0.4 (if any).
3. **Drop the unused `sharp` dependency** if Phase 1 hasn’t already (verify no imports: `git grep "from 'sharp'" origin/dev` is empty).
4. **Cutover runbook doc**: write `docs/runbooks/2026-07-XX-exchange-cutover-checklist.md` capturing Phases 3–6 below (incl. the Phase 1 root cause + fix) with the exact env var names and verification commands (mirror the pattern of `docs/runbooks/2026-06-12-model-library-launch-checklist.md`). The handoff doc's Cutover section is the seed.
5. Optional, non-blocking: note remaining test debt (integration tests for RLS/auth/CRUD deferred to CI — needs a live test Supabase). Do not build now; record in the runbook as post-cutover work.

## Phase 3 — Supabase deploy (staged; TME still live)

In `classicminidiy-supabase` (verify each against actual repo state from Phase 0.3). Can run in parallel with Phases 1–2 (independent of the web deploy issue):

1. Merge PR #48 (or the `tme-merge` branch) to its `main` if not already.
2. Deploy the **safe-now** pieces (no user-visible effect while the web flag is off and TME is live):
   - Edge fns: `create-listing-checkout`, `verify-listing-payment`, `stripe-listings-webhook`, updated `process-notifications`, `post-listing-social` (fn deployed, **cron NOT scheduled yet**).
   - Migration `20260628000001` (event-type widening — additive, safe).
3. **Defer until DNS cutover (Phase 5):** migration `20260628000002` (watcher triggers — would double-email alongside live TME) and the `*/15` social cron schedule (would double-post).
4. Secrets (edge-fn secrets in Supabase): `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ACCESS_TOKEN`, `STRIPE_LISTINGS_WEBHOOK_SECRET` (create the listing webhook endpoint in the Stripe dashboard pointing at `stripe-listings-webhook`; separate from membership + model webhooks), Meta/Bluesky creds for `post-listing-social` (reuse TME's values).
5. Verify: invoke `process-notifications` `newsletter_preview` action via the web admin proxy on a flag-on preview; Stripe test-mode replay against `stripe-listings-webhook` confirming triple-webhook isolation (membership/model/listing secrets don't cross-validate).

⛔ **Checkpoint: confirm with Cole before touching prod Supabase/Stripe.**

## Phase 4 — Merge dev → main + prod env (still invisible)

1. Merge `dev` into `main` (flag off ⇒ `/exchange/**` 404s, sitemap/robots/nav unchanged, redirects dormant). Repo is rebase-only — expect a rebase of the 140 commits or an explicitly-approved merge strategy; do NOT squash.
2. Production deploys via the normal git push — the Phase 1 gate guarantees native deploys are healthy again. Confirm the `main` deploy goes READY. (If it stalls despite the gate, the fix missed something: stop, fall back to `vercel build --prod` + `vercel deploy --prebuilt --prod` only to unblock, and reopen Phase 1.)
3. Set Vercel **production** env vars, flag still off: `CAMINO_API_KEY` (optional), and whichever social/cron keys survived Phase 2.1. Do NOT set `NUXT_PUBLIC_EXCHANGE_ENABLED` yet.
4. Smoke prod: `/exchange` returns 404; existing site (models, toolbox, archive, membership) unaffected; run the unit suite on `main`.

⛔ **Checkpoint: confirm prod deploy is healthy before go-live.**

## Phase 5 — Go-live

Order matters (flag before DNS, so redirect targets exist):

1. Flip `NUXT_PUBLIC_EXCHANGE_ENABLED=true` in Vercel Production (runtime override — no rebuild needed). Verify `/exchange` renders, browse/detail/checkout (test mode)/messages/dashboard tabs work, nav entry switches from external `theminiexchange.com` link to internal `/exchange`, sitemap + robots include exchange, feeds respond.
2. Enable the deferred Supabase pieces: apply migration `20260628000002` (watcher triggers) + schedule the `post-listing-social` `*/15` cron. **Simultaneously disable the standalone TME site's own cron/email senders** (or take TME down to a redirect shell) to avoid a double-fire window.
3. Point `theminiexchange.com` + `www` DNS at the CMDIY Vercel project → activates the 28 host-scoped 301s. Verify a sample of legacy deep links (`/listings/[slug]`, `/wanted`, `/finds`, `/messages`, `/terms`, `/`, feeds) 301 to their `/exchange/*` equivalents; keep the domain registered indefinitely.
4. Live verification: one real (or test-mode) listing-promotion purchase end-to-end (checkout → webhook → `listing_promotions` row → premium badge); a transactional email fires from `notification_queue` (e.g. `listing_submitted`); social sweep posts a promoted listing once (idempotent claim — no dupes); realtime messaging smoke with two sessions.

⛔ **Checkpoint: Cole executes/approves DNS + Stripe-live steps.**

## Phase 6 — Post-cutover cleanup (after a soak period, ~1 week suggested)

1. Remove the flag + gates: delete `exchange-flag.global.ts`, drop `exchangeEnabled` from runtimeConfig, remove the flag conditionals in nav/sitemap/robots/prerender, keep `exchange-onboarding.global.ts` (that one is permanent behavior). Delete `.env` flag references.
2. Retire the standalone TME Vercel project + repo (archive `ClassicMiniDIY/TheMiniExchange`; final README pointer to `classicminidiy`). Remove TME-only secrets from its Vercel project.
3. Delete stale branches: `tme-merge` (both repos, after confirming content parity with what shipped), and the merged `exchange/*` section branches if any remain.
4. Update docs: mark `docs/plans/2026-06-28-tme-consolidation-handoff.md` + the design doc as COMPLETE; update repo `CLAUDE.md` (it still says "Nuxt UI" and doesn't mention `/exchange`); update the CMDIY Platform #9 project card (TME property → Shipped/consolidated).
5. Backlog (record, don't block): integration test suite in CI against a test Supabase; Finds scraper metadata-coverage review (Puppeteer was dropped for OG/JSON-LD + Microlink — watch for bot-blocked sites); confirm which review bot (Copilot vs Gemini) is the active gate.

## Verification summary

- Every phase ends with the unit suite green (baseline 4,684) and, from Phase 4 on, a READY production deploy from a plain git push (no `--prebuilt` crutch).
- Phase 1 acceptance: 3 consecutive native git preview deploys of `dev` READY + one clean cached re-deploy; root cause documented.
- The four end-to-end proofs that define "zero functionality loss": paid listing promotion via Stripe (isolated webhook), transactional email via `notification_queue`, social auto-post via the edge-fn cron (no double-post), legacy-URL 301 coverage.
- Rollback levers, in order of severity: flag off (instant, runtime), DNS back to TME (while it still exists), revert the supabase cron/trigger pieces (migration `20260628000002` has no destructive DDL).
