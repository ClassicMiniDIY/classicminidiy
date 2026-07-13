# The Mini Exchange → CMDIY Cutover Checklist

**Created:** 2026-07-12. Operational runbook for the dev→main cutover of the consolidated
marketplace. Companion to `docs/plans/2026-07-06-tme-cutover-final-plan.md` (phases) and
`docs/plans/2026-06-28-tme-consolidation-handoff.md` (branch model + invariants). Pattern
mirrors `docs/runbooks/2026-06-12-model-library-launch-checklist.md`.

Every production-facing step below is **Cole-in-the-loop** — nothing in Stages B–E runs
without explicit confirmation.

---

## Stage A — Preconditions (done before this runbook executes)

- [x] `dev` contains `main` (0 behind) and is content-identical to `tme-merge`.
- [x] Unit suite green on `dev` (4,624 baseline → 4,634 after the anti-scam port).
- [x] **Deploy-stall regression fixed (Phase 1 hard gate).** Root cause: a module-level
      `setInterval` in `server/utils/exchange/rateLimit.ts` was bundled into Nitro's core
      chunk (`nitro.mjs`); the prerender process loads it during build, the timer keeps the
      Node event loop alive after `✨ Build complete!`, `nuxi build` never exits, and
      Vercel's builder waits until its 45-minute timeout (every native git AND full-CLI
      deploy; `--prebuilt` was immune because it skips the remote build). Fix: lazy
      throttled sweep on access (PR #650), mirroring `server/utils/rateLimit.ts`.
      **Never reintroduce module-level timers/sockets in `server/utils/**` — they run
      inside the build.**
  - Acceptance: 3 consecutive native git preview deploys of `dev` READY + 1 clean
    re-deploy with build cache. Record deployment URLs here when done:
    - [ ] deploy 1: ____
    - [ ] deploy 2: ____
    - [ ] deploy 3: ____
    - [ ] cached re-deploy: ____
- [ ] Phase 2 gap-closers merged to `dev`:
  - [ ] PR #650 — rate-limit timer fix (the hard gate itself)
  - [ ] sharp removal (`chore/drop-unused-sharp`)
  - [ ] stale social runtimeConfig cleanup (`chore/prune-stale-social-runtimeconfig`)
  - [ ] TME PR #101 anti-scam messaging re-port (`fix/exchange-antiscam-report`)
  - [ ] this runbook (`docs/exchange-cutover-runbook`)

## Stage B — Supabase staged deploy (⛔ Cole confirms; TME still live; flag off)

In `classicminidiy-supabase`:

1. [ ] Merge PR #48 (`tme-merge`, 9 commits) to `main`.
2. [ ] Deploy **safe-now** edge functions (no user-visible effect while the web flag is
       off and TME prod is live):
   ```bash
   supabase functions deploy create-listing-checkout verify-listing-payment \
     stripe-listings-webhook process-notifications post-listing-social
   ```
   `post-listing-social` is deployed but its `*/15` cron is **NOT scheduled yet**.
3. [ ] Apply migration `20260628000001` (widens `notification_queue.valid_event_type` —
       additive, safe). NOTE: prod already has `20260629184818` applied, which is newer
       than the `20260628*` files → `supabase db push` needs `--include-all`.
4. [ ] **DEFER until Stage D go-live:** migration `20260628000002` (listing watcher
       triggers — would double-email alongside live TME) and the `post-listing-social`
       cron schedule (would double-post).
5. [ ] Edge-fn secrets (Supabase dashboard → Edge Functions → secrets), reusing TME's
       existing values:
   - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` (newsletter subscriber merge)
   - `STRIPE_LISTINGS_SECRET_KEY` + `STRIPE_LISTINGS_WEBHOOK_SECRET` — NO new Stripe
     endpoint (the account is out of webhook slots): **repurpose the existing
     `the-mini-exchange` destination** (`theminiexchange.com/api/payments/webhook`,
     2 events: `checkout.session.completed` + `charge.refunded` — the edge fn handles
     exactly these). Its signing secret survives a URL edit, so set both secrets NOW
     from the existing endpoint (`STRIPE_LISTINGS_SECRET_KEY` = the account key, same
     value as `STRIPE_SECRET_KEY`; isolation stays at the per-endpoint-secret level),
     then at Stage D edit the destination URL to
     `https://<project-ref>.supabase.co/functions/v1/stripe-listings-webhook`.
     No gap window: both handlers write the same shared-DB tables, and the old URL
     dies behind the host 301s at DNS cutover anyway.
   - Meta + Bluesky creds for `post-listing-social`
6. [ ] Verify: `newsletter_preview` action via the web admin proxy on a flag-on preview;
       Stripe test-mode replay against `stripe-listings-webhook`; confirm the membership
       and model webhooks still validate with their own secrets (triple-webhook isolation).

## Stage C — dev → main + prod env (⛔ Cole confirms; still invisible)

1. [ ] Merge `dev` into `main`. Repo is **rebase-only** (squash + merge-commit disabled);
       a ~146-commit rebase is expected — get Cole's explicit sign-off on strategy first.
2. [ ] Confirm the `main` production deploy goes READY from the plain git push (the Stage
       A gate guarantees this; if it stalls anyway: STOP, unblock with
       `vercel build --prod && vercel deploy --prebuilt --prod`, reopen the investigation).
3. [ ] Set Vercel **production** env vars, flag still off:
   - `CAMINO_API_KEY` (optional — meeting-spot/distance proxies 502 gracefully without it)
   - `NUXT_PUBLIC_VAPID_PUBLIC_KEY` (optional — web push progressive enhancement)
   - Do **NOT** set `NUXT_PUBLIC_EXCHANGE_ENABLED` yet.
4. [ ] Smoke prod: `/exchange` → 404; models/toolbox/archive/membership unaffected;
       sitemap.xml + robots.txt unchanged (no exchange URLs); unit suite green on `main`.

## Stage D — Go-live (⛔ Cole executes/approves; order matters: flag before DNS)

1. [ ] Flip `NUXT_PUBLIC_EXCHANGE_ENABLED=true` in Vercel Production (runtime override —
       no rebuild). Verify: `/exchange` renders; browse → detail → checkout (Stripe test
       mode) → messages → dashboard tabs; nav switches from the external
       theminiexchange.com link to internal `/exchange`; sitemap/robots include exchange;
       `/exchange/feed/*` respond.
2. [ ] Enable the deferred Supabase pieces, and **simultaneously disable the standalone
       TME site's own senders** (take TME to a redirect shell or kill its cron/email):
   - apply migration `20260628000002` (watcher triggers)
   - schedule the `post-listing-social` `*/15` cron
3. [ ] In the Stripe dashboard, edit the `the-mini-exchange` webhook destination URL →
       `https://<project-ref>.supabase.co/functions/v1/stripe-listings-webhook`
       (same signing secret — already set as `STRIPE_LISTINGS_WEBHOOK_SECRET`; same 2 events).
4. [ ] Point `theminiexchange.com` + `www` DNS at the CMDIY Vercel project → activates the
       28 host-scoped 301s in `vercel.json`. Verify legacy deep links 301 correctly:
   ```bash
   for p in / /listings/some-slug /wanted /finds /messages /terms /feed.xml; do
     curl -s -o /dev/null -w "%{http_code} %{redirect_url}  <- $p\n" "https://theminiexchange.com$p"
   done
   ```
   Keep the domain registered indefinitely.
5. [ ] Live verification (the four zero-functionality-loss proofs):
   - [ ] one listing-promotion purchase end-to-end (checkout → `stripe-listings-webhook` →
         `listing_promotions` row → premium badge)
   - [ ] a transactional email fires from `notification_queue` (e.g. `listing_submitted`)
   - [ ] social sweep posts a promoted listing exactly once (idempotent claim, no dupes)
   - [ ] realtime messaging smoke with two sessions

## Stage E — Post-cutover cleanup (after ~1 week soak)

1. [ ] Remove the flag + `exchange-flag.global.ts`; drop `exchangeEnabled` from
       runtimeConfig; remove flag conditionals in nav/sitemap/robots/prerender.
       **Keep `exchange-onboarding.global.ts`** (permanent behavior).
2. [ ] Retire the standalone TME Vercel project + archive `ClassicMiniDIY/TheMiniExchange`
       (final README pointer to `classicminidiy`); remove TME-only secrets.
3. [ ] Delete stale branches: `tme-merge` (both repos, after parity check), leftover
       `exchange/*` section branches.
4. [ ] Docs: mark the handoff + design docs COMPLETE; update repo `CLAUDE.md` (still says
       Nuxt-UI-only and omits `/exchange`); update CMDIY Platform Project #9 (TME property
       → consolidated).
5. [ ] Backlog (recorded, non-blocking): integration tests (RLS/auth/CRUD) in CI against a
       test Supabase; Finds scraper OG/JSON-LD coverage watch; confirm the active review
       bot (Copilot vs Gemini).

## Rollback levers (in escalation order)

1. Flag off (`NUXT_PUBLIC_EXCHANGE_ENABLED=false`) — instant, runtime, no rebuild.
2. DNS back to the standalone TME project (while it still exists — don't decommission
   until after the soak).
3. Revert Supabase cron/trigger pieces (`20260628000002` has no destructive DDL; the
   trigger + cron can be dropped without data loss).

## Post-snapshot TME drift ledger

Production changes made to TheMiniExchange after the 2026-06-17 port snapshot, and their
re-port status (Phase 0.4 audit, 2026-07-12):

| TME change | Status |
|---|---|
| PR #101 anti-scam messaging front-end (useBlockedUsers, held-message UX, new-account badge, report presets, friendly 42501 copy) | re-ported via `fix/exchange-antiscam-report` |
| PR #102 CI coverage-upload tweak | TME-only CI, not applicable |

If TME receives further prod changes before Stage D, re-run the audit:
`git -C ../TheMiniExchange log origin/main --since=2026-07-12 --oneline` and map via
`docs/plans/2026-06-17-exchange-migration-map.md`.
