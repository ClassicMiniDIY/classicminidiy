# classicminidiy: Vercel → Cloudflare Workers Migration

Assessment + hand-off implementation plan (target executor: Opus 5). Written 2026-08-06.

## Context

Cole asked whether migrating the CMDIY Vercel stack to Cloudflare Workers (keeping Supabase as the
backend) is a good idea, and for a full implementation plan. Two exhaustive repo audits, a Vercel
API/DNS survey, and a design pass were done in plan mode; three agents converged with line-level
citations. Scope decisions confirmed by Cole:

- **Migrate `classicminidiy` only.** OpenECUAlliance and the 3 redirect-only Vercel projects stay on
  Vercel for now (an OECUA appendix is included for later).
- **Bot defense after BotID removal: edge rate limits only** (CF WAF rule + existing in-app limits).
  No Turnstile on the protected endpoints for now.
- **Direct cutover** — no interim CF-proxying-Vercel phase. Build + verify the Worker on preview,
  then move DNS straight to it.
- **Previews: persistent dev worker + ephemeral PR preview URLs** (mirrors the dev-branch flow).

Supabase (auth, DB, Edge Functions, all Stripe webhooks, pg_cron jobs) is unaffected at the infra
level — this is a web-hosting-layer migration. `theminiexchange.com` moves too (its domains are
attached to the classicminidiy Vercel project and its 301 map lives in `vercel.json`).

## Verdict: worth doing, with eyes open

**Recommendation: yes — the coupling surface turned out much smaller than the CLAUDE.md scar tissue
suggests, and several current weaknesses get strictly better on Cloudflare.** But it is a real
infrastructure migration for a production site whose SEO was hard-won; the value is mostly
strategic, not cost. If the current migration load (mobile Firebase Phase 5, Ghost) feels heavy,
Phases 0–2 are zero-production-risk and can be done now while the cutover (Phase 4) waits.

**Pros**
- **Fixes real weaknesses today:** the unauthenticated `/api/langgraph` proxy is throttled only by
  per-warm-instance memory (near-no-op under distributed abuse) — a CF WAF rate rule enforces at the
  edge. The GEO initiative's Phase 3 (AI-crawler firewall, "needs Cole" on Vercel) becomes
  first-class CF WAF/AI-bot controls.
- **Kills BotID**, which already false-positive-blocked ~100% of checkout buyers once and injects
  hidden proxies to `api.vercel.com`.
- **Cost (grounded in PostHog last-30d traffic: 12.7k visitors / 20.1k pageviews / 13.4k sessions —
  inside every included tier on both platforms):** Vercel today ≈ $20/mo (Pro seat; usage within the
  1 TB transfer / 10M edge-request allotments and $20 credit; image transformations $0.05/1k are
  pennies at this volume — verify the actual invoice in the dashboard). Cloudflare after ≈ $5–8/mo
  (Workers Paid $5; requests/CPU/KV within included; image transformations 5k unique free then
  $0.50/1k ≈ $0–3; zones/WAF/DNS $0; deleting the 2 Route 53 zones saves $1/mo). NOTE: with
  "classicminidiy only" scope the Pro seat stays for OECUA, so immediate savings ≈ usage-only (~$0);
  the ~$15/mo (~$180/yr) delta materializes when OECUA also leaves Vercel or moves to a free Hobby
  account (it's non-commercial). Cost is a weak driver either way — the strategic wins are the
  argument.
- **Runway:** R2 (zero-egress) as a future S3 replacement for archive/model assets; Cron Triggers;
  Turnstile already in the stack; build moves to GH Actions (16 GB, ends the 8 GB build-container
  OOM class permanently).
- **Simplifiers found by audit:** no ISR/SWR routeRules, no Nuxt Content (better-sqlite3 + pg are
  dead deps), no crons, no @vercel/analytics or speed-insights (docs were stale). Uploads already go
  browser→S3 presigned; downloads are 302 presigns; Stripe/email are Supabase Edge Function proxies.

**Cons / costs**
- Re-validates every SEO invariant (redirects, canonicals, prerender parity, JSON-LD, OG images) on
  a new platform — the highest-risk area, mitigated by a scripted verification battery.
- New platform semantics to learn: assets-served-before-worker (would silently break all redirects
  without `run_worker_first`), no CDN cache in front of Worker responses (GitHub/YouTube quota
  protection must move to KV-backed handler caching), per-isolate memory (weaker in-app limits).
- One hard runtime blocker to fix (the AWS SDK's `node:http` transport breaks model-upload
  finalize on workerd — see amendments A1), one native-binary swap (takumi → wasm), an SSE
  byte-stream fix, an uninstalled optional dep for `/mcp` (`agents`), and a DNS zone move for 2
  domains. (The originally-suspected `node:dns` SSRF-guard blocker is NOT one — workerd ships
  native `node:dns`/`node:net` under `nodejs_compat` since 2025-01 and nitropack keeps them
  external; see A2.)
- Rewrites ~12 CLAUDE.md invariant sections (listed in Phase 5) — the platform knowledge that took
  months to accumulate resets partially.
- Vercel-specific tooling (Vercel MCP/plugin, deploy-stall knowledge) loses relevance.

**Effort estimate:** Phase 0 ~half day; Phase 1 ~1 day + review cycle; Phase 2 ~1 day; Phase 3 ~half
day + Cole actions; Phase 4 cutover day + 2–4 week soak (monitoring only); Phase 5 ~half day.

## Verified current state (ground truth)

Verified via Vercel API, DNS, and file-level audits — trust these over CLAUDE.md prose:

- **Vercel projects:** `classicminidiy` (domains: classicminidiy.com, www, theminiexchange.com, www)
  — in scope. `open-ecu-alliance`, `classicminidiy-net-redirect`, `classicminidiy-org-redirect`,
  `wheel-dictionary-redirect` — out of scope, untouched.
- **DNS:** classicminidiy.com + theminiexchange.com on Route 53; all domains registered at Amazon
  Registrar (NS change only, no registrar transfer). `auth.classicminidiy.com` CNAMEs to Supabase —
  must be recreated **DNS-only (unproxied)** in the CF zone.
- **vercel.json:** install/build commands (`NODE_OPTIONS=--max-old-space-size=6144`), 2 PostHog
  rewrites that DUPLICATE existing Nitro routes ([server/routes/t/[...path].ts](server/routes/t/[...path].ts),
  `t/static/[...path].ts` — they take over automatically off-Vercel), and 28 host-gated 301s for
  `(www.)?theminiexchange.com` (9 use `:path*`; only load-bearing ordering: `/admin/users` before
  `/admin/:path*`). **CORRECTED 2026-08-08: these are LIVE production redirects, not dormant** —
  theminiexchange.com apex (A 216.150.1.1, `server: Vercel`) 308s to www, and www serves the full
  map today as 308s (`permanent: true` → Vercel emits 308, not 301) with query preservation. The
  cutover migrates a live, indexed redirect estate; treat every TME check as production SEO.
- **BotID** is the only Vercel platform package: dep + `botid/nuxt` module (injects 2 hidden
  routeRules proxying api.vercel.com) + [app/plugins/botid.client.ts](app/plugins/botid.client.ts)
  + `checkBotId()` in `server/api/langgraph/[...path].ts`, `server/api/langgraph/threads.post.ts`,
  `server/api/models/seller/onboard.post.ts` + `nitro.alias['next/headers']` →
  `server/stubs/next-headers-stub.mjs` (exists solely for botid).
- **Workers-runtime blockers (corrected 2026-08-08):** the REAL blocker is
  [server/utils/s3Models.ts:130,147](server/utils/s3Models.ts) — two live `client.send()` calls
  (HeadObject + ranged GetObject for magic-byte sniffing) used by upload finalize go through
  `@smithy/node-http-handler` → `node:http(s)`, which nitropack 2.13.4 lists in
  `unsupportedNodeModules` → unenv stubs whose `http.request` THROWS on workerd (presigning is pure
  crypto and fine, which is why the audit missed it). `node:dns`/`net.isIP` in
  [server/utils/external-models/ssrf.ts](server/utils/external-models/ssrf.ts) are NOT blockers
  (native in workerd since 2025-01; nitropack lists dns/net/tls as builtin) — spike-verify instead
  of rewriting. Still real: module-scope `useRuntimeConfig()` in
  [server/api/langgraph/_utils.ts](server/api/langgraph/_utils.ts); module-scope `process.env` reads
  in `server/middleware/rate-limit.ts:28-32` + `server/middleware/bot-analytics.ts:23`
  (external-models/render.ts is fine — reads are inside the function); SSE proxy
  ([server/api/langgraph/threads/[threadId]/runs/stream.post.ts](server/api/langgraph/threads/[threadId]/runs/stream.post.ts))
  enqueues **strings** into a `ReadableStream` Response body (Workers requires bytes).
- **Native binaries in today's server output:** `@takumi-rs/core` (OG renderer, 4 MB .node) and
  sharp+libvips (~16 MB, dragged in by ipx via @nuxt/image regardless of provider). Both must be out
  of the CF bundle. Remaining JS gzips to ~4.6 MB vs the 10 MB Workers paid limit — takumi-wasm
  addition needs a size check.
- **CDN-cache-dependent API routes:** `server/api/github/{repo,commits,releases}.ts`,
  `youtube/{stats,videos}.ts` protect external API quotas via Vercel CDN `s-maxage` — on CF there is
  no CDN cache in front of Worker responses; these need KV-backed `defineCachedEventHandler`.
  Cheap bundled-JSON routes (torque, parts, weights, gearing, engines, diagrams, clearance,
  needles/{list,suggested}, wheels/review/list) can simply lose edge caching.
  `exchange-rates.get.ts` needs a KV write-through under its in-memory L1.
- **In-memory state** (degrades to per-isolate; accepted, WAF is the backstop): two rate limiters,
  30 s ban cache ([server/utils/userAuth.ts](server/utils/userAuth.ts)), FX cache. One
  `useStorage('cache')` site: [server/api/exchange/camino/distance.post.ts](server/api/exchange/camino/distance.post.ts).
- **IP trust:** 3 sites prefer `x-real-ip` ("set by Vercel edge"): `server/middleware/rate-limit.ts`,
  `server/utils/exchange/rateLimit.ts`, `server/api/exchange/contact-seller.post.ts`. On CF the
  trusted header is `CF-Connecting-IP`.
- **Already CF-compatible:** `event.waitUntil` in bot-analytics; lazy S3/Supabase clients; AWS SDK
  is S3-only (~1.3 MB, no DynamoDB despite stale docs) — but ONLY the presigning paths; the two
  `client.send()` calls are the A1 blocker; `experimental.asyncContext` (ALS) works under
  `nodejs_compat`; the single nitro plugin (llms-faq) is hook-registration only. Verified-clean by
  the adversarial pass (do not re-litigate): `client-zip` is client-only, no web-push server path
  (sends live in the process-notifications edge fn), no DynamoDB usage.
- **No deploy workflow exists** — Vercel Git integration does everything. A dead "Purge my Cache"
  workflow already holds `CLOUDFLARE_ZONE`/`CLOUDFLARE_TOKEN` secrets (a CF zone existed once).
- An AI-training-bot block may exist in the **Vercel WAF console** (checked by
  [scripts/verify-ai-crawler-firewall.sh](scripts/verify-ai-crawler-firewall.sh)) — replicate as a
  CF WAF rule, then repoint the script.

## Domain inventory — all FIVE zones (measured by dig, 2026-08-23)

This plan was written for 2 zones. Cole owns **5**, and the other 3 are not the trivial
follow-up the "Out of scope" section assumed.

| Domain | Authoritative NS | Role | Mail | Zone-move risk |
|---|---|---|---|---|
| `classicminidiy.com` | Route 53 | Primary site (apex `A` → Vercel; `www` CNAME `…vercel-dns-017.com`) | MX forwardemail.net ×2, plus SPF / apple / pinterest / google / forward-email verification TXTs | **HIGH** — the real cutover |
| `theminiexchange.com` | Route 53 | 28-redirect estate → cmdiy (see B1) | MX forwardemail.net ×2, `v=spf1 include:send.resend.com ~all` | **MED** — mail records + redirect map |
| `classicminidiy.net` | **`ns1/ns2.vercel-dns.com`** | Redirect → primary | none | LOW |
| `classicminidiy.org` | **`ns1/ns2.vercel-dns.com`** | Redirect → primary | none | LOW |
| `wheeldictionary.com` | **`ns1/ns2.vercel-dns.com`** | Redirect → primary | none | LOW |

### The finding that changes the plan: three zones are hosted on Vercel DNS

The redirect domains delegate to `vercel-dns.com` — they are not Route 53 zones. Phase 5
("remove the domains, delete the projects, downgrade or cancel the plan") therefore **cannot
run while those three still point at Vercel**: deleting or downgrading removes their
*nameservers*, so they go NXDOMAIN — not merely un-redirected. This promotes them from
"future work" to an **in-scope Phase 5 blocker**, and it is the one dependency that decides
whether this migration can actually end with Vercel switched off.

### Turn that into an asset: move them FIRST, as the rehearsal (new Phase 3a)

They carry no mail, no meaningful traffic and no application code, so they are a free dress
rehearsal of the exact cutover sequence the primary zones will use:

1. Create the zone in the dashboard (free plan), let the scan run.
2. Verify the imported records against the authoritative dump — here, a trivially short list.
3. Set the web records **DNS-only (grey cloud)**, flip NS at the registrar.
4. Wait for Universal SSL to report **Active**.
5. Add the zone-edge Single Redirect rule, then **proxy** the records — the real switch.
6. Verify status code, target host, path and query preservation; roll back with one
   `proxied: false` toggle if anything is wrong.

Order: `wheeldictionary.com` → `classicminidiy.net` → `classicminidiy.org` → the two real
zones. A mistake on step 1-3 of `wheeldictionary.com` costs nothing and teaches everything.
This also exercises the dedicated API token against a live zone **before**
`classicminidiy.com` depends on it — which is exactly where OECUA lost the most calendar time.

### Two constraints on the redirect zones

- **Measure the current redirect behavior before Vercel stops serving it.** Status code,
  target host, whether the path is preserved, whether the query string survives, and the
  `www` variant of each — into the Phase 0 baseline snapshot. OECUA found Vercel's apex
  redirect was a **307**, not the assumed 308; do not assume `301` here either. Once the
  Vercel projects are gone this behavior is unrecoverable except from archived crawls.
- **Do not "tidy" records during any zone move.** `theminiexchange.com` publishes a **Resend**
  SPF include while the platform's transactional mail is **SES** — a real discrepancy, and
  cutover day is the wrong day to resolve it. Copy records verbatim, diff against the
  authoritative dump, change nothing. Fix mail hygiene as its own change, before or after,
  never during.

## Dedicated Cloudflare API token (one token, scoped to this migration)

Cole's requirement: this migration gets **its own** token, not a reused account-wide one, so it
can be revoked at Phase 5 without collateral damage.

- **Name:** `cmdiy-cf-migration` — obvious at revoke time.
- **Zone Resources:** Include → **Specific zone** → all five zones, listed individually. Not
  "All zones". The policy must be **zone-scoped**: an account-scoped policy alone leaves
  DNS / SSL / Zone-Settings **denied even on zones that already exist** (OECUA, 2026-08-24).
- **Zone permissions (Edit):** DNS · Zone Settings · SSL and Certificates · Dynamic Redirect ·
  **Workers Routes**.
- **Account permissions (Edit):** Workers Scripts · Workers KV Storage. Add **Bulk Redirect
  Lists + Bulk Redirect Rules** if B1's 19 exact-source TME redirects are implemented as a
  Bulk Redirects list — that is an account-level resource, not a zone one.
- **Zone creation is deliberately NOT included.** Account-owned tokens cannot grant
  `com.cloudflare.api.account.zone.create`, and the permission-group catalog is unreadable to
  them (OECUA, 2026-08-23 and 2026-08-24). All five zones are created by hand in the
  dashboard; the token never needs the permission, so stop trying to give it one.
- **TTL:** set an explicit expiry roughly 90 days out, and **revoke deliberately at Phase 5**.
  An unnoticed silent expiry mid-cutover is the failure mode to design against.
- **Secret naming — do not reuse `CLOUDFLARE_TOKEN`.** The dead "Purge my Cache" workflow
  (`.github/workflows/main.yml`, triggered on `deployment` events for the non-existent
  `master` branch) still references `CLOUDFLARE_ZONE` / `CLOUDFLARE_TOKEN`. Reusing those
  names hands migration credentials to a legacy purge action. Use **`CLOUDFLARE_API_TOKEN`**
  (plus `CLOUDFLARE_ACCOUNT_ID`), and delete or repoint that workflow in Phase 2 as an
  explicit step.
- **Verify with a real write, never a read.** Reads succeeding proves nothing about this
  token's scoping. Gate: create then delete a throwaway `TXT` on `wheeldictionary.com`, read a
  zone setting on `classicminidiy.com`, and attempt one Workers Routes write — all three
  before any cutover step depends on the token.

## Platform mapping

| Vercel today | Cloudflare after |
|---|---|
| Nitro `vercel` preset (auto-detected) | `cloudflare_module` preset + Workers Static Assets, `nodejs_compat`, current `compatibility_date`, Workers Paid ($5/mo) |
| Vercel image optimizer (`/_vercel/image`) | CF Image Transformations (`/cdn-cgi/image/`) via `@nuxt/image` `cloudflare` provider — **CF builds only**; ipx stays in dev; `/cdn-cgi` added to `prerender.ignore` (same crawler-trap class as `/_ipx`); zone transformations enabled + the 7 remote origins allowed |
| vercel.json TME host 301s | Nitro server middleware `00.tme-host-redirect.ts` (version-controlled, unit-tested) + `run_worker_first` so static assets can't shadow it |
| vercel.json PostHog rewrites | Deleted — existing Nitro `/t/**` proxy routes take over |
| BotID | Removed entirely; CF WAF rate-limiting rule on `POST /api/langgraph/*` + in-app limits |
| `x-real-ip` trust | `CF-Connecting-IP` on CF builds (build-target-keyed helper), `x-real-ip` on Vercel builds (rollback safety) |
| Vercel CDN `s-maxage` | KV-backed `defineCachedEventHandler` for quota-protecting routes; `nitro.storage.cache` → `cloudflare-kv-binding` |
| Vercel Git deploys + previews | GH Actions (bun build + `wrangler deploy`); dev branch → persistent `classicminidiy-preview` worker (`NUXT_SITE_ENV=preview` → noindex); PRs → `wrangler versions upload` preview URLs |
| Vercel env vars | wrangler vars/secrets with **`NUXT_`-prefixed names** for runtimeConfig keys (mapping table in Phase 2) |
| Vercel WAF AI-bot rule (GEO Phase 3) | CF WAF custom rule generated from `EDGE_DENY_BOTS` in `server/utils/aiBots.ts` |
| OG images (takumi native) | `@takumi-rs/wasm` pinned **1.8.7 exact** (locked pair with `@takumi-rs/core` per the 1.x pin) |

## Implementation plan

**Step 0 (repo convention):** copy this plan into the repo as
`docs/plans/2026-08-06-cloudflare-workers-migration.md` on the feature branch; keep it updated as
phases land. Branch naming: `feature/cloudflare-workers-migration` off fresh `origin/main`
(worktree branch `claude/cmdiy-vercel-cloudflare-migration-3f4a6a` already exists for this work).

### Phase 0 — Go/no-go spike (throwaway worker, no DNS, no prod risk)

On a spike branch: stub the blockers (checkBotId, module-scope config, node:dns), add
`@takumi-rs/wasm@1.8.7`, add a throwaway `wrangler.jsonc` + spike KV namespace, then:

```
NODE_OPTIONS=--max-old-space-size=6144 NITRO_PRESET=cloudflare_module bun run build
bunx wrangler deploy
```

Go/no-go checks (all must pass):
1. **Bundle size** `bunx wrangler deploy --dry-run` gzip < 9 MB; no `.node` files, no sharp/ipx in
   `.output/server` (`grep -rl 'sharp\|ipx' .output/server/chunks`).
2. **OG image** renders via wasm on workers.dev (`image/png`, >10 KB). If not auto-selected, set
   nuxt-og-image's runtime compatibility override.
3. **SSE** streams incrementally from the langgraph proxy (with the Phase 1 byte-stream fix applied).
4. **SSR parity spot-checks:** `/`, an archive color detail, a model page → 200 with **non-empty
   JSON-LD**; `/api/torque`; `/mcp` auth + AsyncLocalStorage works.
5. **Static assets:** `.output/public` under the 20k-file cap — if `compressPublicAssets` `.gz/.br`
   siblings blow it up, disable for CF builds (CF compresses at edge); check whether a `_headers`
   file is emitted.
6. **KV cache mount** works (camino distance second call = KV hit; one converted cached handler).
7. **Env timing:** lazily-read vars resolve; `NUXT_`-prefixed secret overrides land.

No-go fallbacks: bundle too big → satori renderer or prerender-time OG; SSE broken → escalate
(unlikely). Rollback: delete branch/worker/namespace.

### Phase 1 — Platform-neutral code changes (merge to main, ships via Vercel first, zero risk)

All of this works identically on Vercel, so it soaks in production before the platform moves:

1. **SSRF guard off node:dns** ([server/utils/external-models/ssrf.ts](server/utils/external-models/ssrf.ts)):
   replace `net.isIP` with a pure util; replace `dns.promises.lookup` with DNS-over-HTTPS
   (`cloudflare-dns.com/dns-query`, `Accept: application/dns-json`, A + AAAA); same `SsrfError`
   behavior on failure; keep `isBlockedAddress` pure; extend unit tests (mocked DoH).
2. **Lazy config/env reads:** `server/api/langgraph/_utils.ts` (move `useRuntimeConfig()` inside
   functions); memoized lazy getters for `process.env` in `server/middleware/rate-limit.ts` +
   `bot-analytics.ts`.
3. **Shared client-IP helper** (`server/utils/clientIp.ts`): trusts `cf-connecting-ip` on CF builds,
   `x-real-ip` otherwise (build-target-keyed with env override); adopt at the 3 call sites;
   unit-test both modes.
4. **SSE rewrite** ([stream.post.ts](server/api/langgraph/threads/[threadId]/runs/stream.post.ts)):
   use h3 `createEventStream(event)` (byte-encoded, flushes properly, loop runs after response
   commit); preserve the `thread_id` first event, error event, and `[DONE]` sentinel so client chat
   parsing is untouched. Verify chat streams on Vercel prod after merge.
5. **BotID removal:** dep, module, client plugin, `next/headers` alias + stub, 3 `checkBotId()`
   sites, stale comments (`checkout.post.ts`, `useModelCheckout.ts`, rate-limit header); mark the
   BotID runbook superseded.
6. **Dead weight:** remove `better-sqlite3`, `pg`, the better-sqlite3 `postinstall` rebuild and
   `trustedDependencies` entry; delete dead `server/utils/cache.ts` (fix comment ref in
   `server/utils/rateLimit.ts:4`). CI gets faster; `pr-check.yml`'s `bunx nuxi prepare`
   compensation note can be revisited.

Verification: full `bun run test` (with the worktree exclusion caveat), Vercel preview + prod
deploy, manual chat E2E. Rollback: git revert, no infra.

### Phase 2 — Cloudflare scaffolding in-repo (preview only; prod stays on Vercel)

1. **`wrangler.jsonc`:** name `classicminidiy`, `main: .output/server/index.mjs`,
   `compatibility_date` pinned current, `compatibility_flags: ["nodejs_compat"]`, assets from
   `.output/public` with **`run_worker_first`** listing all 28 TME redirect sources **plus the 11
   routeRules 301 sources** (their meta-refresh `index.html` artifacts in `.output/public` would
   otherwise be served as 200s — this inverts the Vercel behavior where platform routing shadowed
   them); `CACHE_KV` namespace binding; `env.preview` (`classicminidiy-preview`, own KV,
   `NUXT_SITE_ENV=preview`); observability on. Custom-domain routes added only at Phase 4.
2. **`nuxt.config.ts` gating (Vercel-rollback-safe):**
   `const isCfBuild = (process.env.NITRO_PRESET || '').replace('-','_') === 'cloudflare_module'` —
   CF builds get `image.provider: 'cloudflare'`, `nitro.storage.cache` =
   `cloudflare-kv-binding` (binding `CACHE_KV`), `compressPublicAssets: false` (if spike said so);
   ALL builds get `/cdn-cgi` appended to `prerender.ignore` and `/cdn-cgi/` added to robots
   disallow. Dev keeps ipx; Vercel builds keep auto-detection — same commit still deploys to Vercel
   for instant rollback.
3. **TME redirect middleware** `server/middleware/00.tme-host-redirect.ts` (sorts before
   bot-analytics): host-gate `(www.)?theminiexchange.com`, exact-match map (19) + ordered prefix
   table (9), query-string preservation, `sendRedirect(…, 301)`. Table-driven unit test covering
   all 28 sources + wildcard suffixes + non-TME passthrough — the test is the SEO spec.
4. **Cache conversions:** `defineCachedEventHandler` (KV via `cache` mount) for
   github/{repo,commits,releases} + youtube/{stats,videos} (maxAge matching current header TTLs,
   `swr: true`); KV write-through under the in-memory L1 in `exchange-rates.get.ts`; leave the
   bundled-JSON routes as-is (headers become inert but harmless); update "per warm serverless
   instance" comments to "per isolate".
5. **`public/_headers`** for `/_nuxt/*`, `/images/*`, `/fonts/*`, `/assets/*` immutable caching if
   the preset doesn't emit one (asset-layer responses never reach nitro.routeRules).
6. **GH Actions:** `deploy.yml` (main → build with `NITRO_PRESET=cloudflare_module` +
   `NODE_OPTIONS=--max-old-space-size=6144` + all `NUXT_PUBLIC_*` build-time vars incl.
   `NUXT_PUBLIC_EXCHANGE_ENABLED=true` (sitemap gate is build-time) → `wrangler deploy` → smoke
   script); `preview.yml` (dev branch → `deploy --env preview`; PRs → `versions upload` + PR
   comment; **verify previews serve noindex**, fall back to preview-env-only if version previews
   don't pick up `NUXT_SITE_ENV`). Keep `pr-check.yml` tests as-is.
7. **Secrets/vars via `wrangler secret put`** — runtimeConfig keys need `NUXT_`-prefixed names:
   `NUXT_SUPABASE_SERVICE_KEY`, `NUXT_GITHUB_API_KEY`, `NUXT_YOUTUBE_API_KEY`,
   `NUXT_VALIDATION_KEY`, `NUXT_LANGGRAPH_API_URL`, `NUXT_LANGSMITH_API_KEY`, `NUXT_MCP_API_KEY(S)`,
   `NUXT_MICROLINK_API_KEY`, `NUXT_CAMINO_API_KEY`, `NUXT_MARKETING_ADMIN_EMAILS`,
   `NUXT_MARKETING_UNSUB_SECRET`, `NUXT_S3_MODELS_*` (4), `NUXT_OG_IMAGE_SECRET`,
   `NUXT_TURNSTILE_SECRET_KEY`; plain unprefixed vars for the raw-env reads
   (`LANGGRAPH_RATELIMIT_*`, `WRITE_RATELIMIT_*`). Verify each empirically on preview.
8. **Supabase allowlists for preview origins:** add the workers.dev/preview URLs to the Supabase
   Auth redirect-URL allowlist and to the checkout/onboarding edge-function origin allowlists in
   `classicminidiy-supabase` (they currently know localhost + production + Vercel previews).

Verification: run the full Phase 4 battery against the preview worker (TME redirects via
`curl -H 'Host:'`, all 11 routeRules 301s return 301 not 200, `/cdn-cgi/image/` URL shape in HTML —
actual transformation bytes wait for the zone). Rollback: n/a (no prod traffic).

### Phase 3 — Zone prep (compute still on Vercel; requires Cole for account/registrar steps)

1. Create the CF zones `classicminidiy.com` + `theminiexchange.com` (free plan). **Phase 3a
   (the three redirect zones) runs first — see the domain inventory.** Import R53 records;
   diff record-for-record (`dig` both nameserver sets) — MX/SPF/DKIM/TXT especially.
   `auth.classicminidiy.com` **DNS-only (grey cloud)**. Lower R53 TTLs to 60 s ~48 h ahead. Keep R53
   zones intact for rollback.
2. Zone features: enable Image Transformations + allow the 7 remote origins; WAF custom rule
   blocking `EDGE_DENY_BOTS` UAs; WAF rate-limiting rule `POST /api/langgraph/*` (free plan = one
   rule, fixed 10 s window, ~10/10 s per IP, block) — the in-app 40/60 s limiter stays primary;
   apex Single Redirect `classicminidiy.com/*` → `https://www.classicminidiy.com/$1` 301 (mirror
   Vercel's current apex behavior).
3. Pre-stage the Worker custom domains config (activates when the zone goes live).

Cole-only actions in this phase: dashboard creation of **all five** zones + the dedicated
`cmdiy-cf-migration` API token (see its spec above), registrar NS changes (Phase 3a for the three
redirect zones, Phase 4 for the two real ones), secret values transfer, Supabase dashboard
allowlist edits (unless done via MCP).

### Phase 4 — Direct cutover + verification + soak

1. **NS change at Amazon Registrar** for classicminidiy.com (and theminiexchange.com). During
   propagation both stacks serve — both run the same commit (Phase 1 code is platform-neutral).
   Leave Vercel deploying `main`; its builds still auto-detect the vercel preset.
2. **Worker custom domains:** `www.classicminidiy.com`, `theminiexchange.com`,
   `www.theminiexchange.com` (apex handled by the zone redirect).
3. **Verification battery** (scripted as `scripts/verify-cf-deploy.sh`, run against prod):
   - All 28 TME 301s (single-hop, absolute targets, query preserved; `/admin/users` vs `/admin/foo`
     ordering) + all 11 routeRules 301s + apex→www with path.
   - Headers: no-store on the 4 auth/claim routes; immutable on `/_nuxt/*`, `/images/*`;
     prerendered pages served from the asset layer.
   - Images: page HTML emits `/cdn-cgi/image/`; transformed bytes (`image/webp`) come back for one
     image per remote domain (both S3 spellings, auth.classicminidiy.com storage, ytimg).
   - OG image bytes on a model page (takumi-wasm); robots.txt byte-diff vs Vercel snapshot;
     sitemap URL-set diff; `/llms.txt` + `/llms-full.txt`; canonicals + `?utm_source=` → noindex;
     **JSON-LD non-empty** (schema-org canary); unknown URL → real 404.
   - App: chat SSE in a real browser; 429s from in-app limiter and WAF; PostHog `/t/**` capture
     200s via the Nitro proxy routes; login; model presign upload + 302 download; exchange listing;
     camino distance KV hit; `/mcp`; marketing unsubscribe; a PostHog `bot_crawl` event (proves
     `waitUntil` on workerd); `scripts/verify-ai-crawler-firewall.sh` green against CF.
4. **Soak 2–4 weeks** with Vercel warm: Workers exceptions/observability, KV volumes, GitHub/YouTube
   quota dashboards (proves the cache conversions), 429 anomalies (IP-trust regression signal),
   Search Console coverage/crawl stats + CWV.

**Rollback (fast, the point of the sequencing):** remove the Worker custom domain, add proxied/
DNS-only CNAME `www` → `cname.vercel-dns.com` in CF DNS — minutes, no build, because vercel.json
and the Vercel-compatible config gating remain until Phase 5. Worst case: repoint NS back to R53.

### Phase 5 — Decommission + rewrite the documented invariants

- **Gate: all five zones must be off Vercel first.** `classicminidiy.net`, `.org` and
  `wheeldictionary.com` are hosted on **Vercel DNS** — deleting the projects or downgrading the
  plan while they still delegate to `vercel-dns.com` takes out their nameservers and NXDOMAINs
  them. Phase 3a moves them; confirm `dig NS` shows Cloudflare on all five before this phase runs.
- Delete `vercel.json`, the dead "Purge my Cache" workflow (delete it — do NOT repurpose its
  `CLOUDFLARE_TOKEN`/`CLOUDFLARE_ZONE` secret names; the migration uses `CLOUDFLARE_API_TOKEN`),
  the Vercel Git integration and the redirect-only projects, then the main project (after soak).
  Keep `/_ipx` in `prerender.ignore` (ipx is still the dev provider).
- **Revoke the `cmdiy-cf-migration` API token** once the deploy pipeline has its own long-lived
  credential.
- **Rewrite these CLAUDE.md sections** (the plan's biggest documentation deliverable):
  1. Ecosystem context — TME 301s now live in the middleware + its test.
  2. Backend & Infrastructure — hosting = Cloudflare Workers; purge stale DynamoDB/"Nuxt
     Content"/"Vercel Analytics" claims (already false today).
  3. Package management — postinstall note gone. 4. Key Technologies — drop Nuxt Content.
  5. Performance/CDN phrasing. 6. **Image Optimization Invariants** (both sections): "never set
  image.provider" inverts to "provider is `cloudflare` on CF builds, ipx in dev"; verification
  recipe becomes `/cdn-cgi/image/` emission; screens loses its Vercel-allowlist role; `/_ipx`
  contract gains the `/cdn-cgi` sibling. 7. **SEO/Head Invariants**: meta-refresh-shadow note
  becomes the **`run_worker_first` contract — adding a routeRules redirect means adding its source
  to wrangler.jsonc**. 8. Security Invariants — BotID gone, WAF rule, "per isolate", IP-helper
  contract. 9. Dependency pins — takumi pin covers core+wasm locked at 1.8.7. 10. Environment
  Variables — the `NUXT_`-prefix secret mapping table. 11. Deployment sections — wrangler/GH
  Actions/KV/previews/rollback. 12. Advanced Features → monitoring.
- Update `Development/CLAUDE.md` (TME section references vercel.json host rules) and the user-level
  CLAUDE.md Vercel mentions; check `.github/copilot-instructions.md` for Vercel references.
- Re-verify memory files that reference Vercel behavior (deploy-stall, BotID, ipx-on-Vercel) —
  mark platform-historical.

## Repos touched

| Repo | Work |
|---|---|
| `classicminidiy` | Everything above (all phases) |
| `classicminidiy-supabase` | Edge-function origin allowlists + Supabase Auth redirect URLs gain preview/workers.dev origins; runbook/doc touch-ups. No migrations. |
| `Development/CLAUDE.md`, user CLAUDE.md | Invariant rewrites (Phase 5) |
| Native apps, TheMiniExchange | **No changes** |
| OpenECUAlliance | Out of scope now — appendix below for later |

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Static assets shadow redirects (TME + routeRules 301s become 200s) | High (SEO) | `run_worker_first` list + battery asserts 301s; CLAUDE.md invariant |
| Silent image regression (unoptimized or broken remotes) | High | Per-domain byte checks in battery; zone origin allowlist mirrors `image.domains` |
| `/cdn-cgi` prerender crawl trap (repeat of the /_ipx OOM) | High (build) | `prerender.ignore` entry ships in Phase 2, before any CF build matters |
| SSE regression breaks chat | Med | Phase 1 rewrite soaks on Vercel first; spike check #3 |
| GitHub/YouTube quota burn without CDN cache | Med | KV-backed cached handlers (Phase 2), quota dashboards in soak |
| Rate limiting weaker per-isolate | Med | WAF edge rule; in-app stays; revisit Durable Objects only if abuse observed |
| Bundle > 10 MB after takumi-wasm | Med | Spike gate #1; fallback satori/prerender OG |
| DNS record drift during zone import (MX/SPF/DKIM) | Med (email) | Record-for-record dig diff; R53 kept intact |
| Preview URLs indexed | Low | `NUXT_SITE_ENV=preview` → noindex, asserted in battery |
| Supabase auth breaks on preview origins | Low | Allowlist updates in Phase 2 step 8 |

## Out of scope / future

- **OpenECUAlliance** (appendix): already CF-native IP detection; verify `useStorage('assets')`
  specs reads + shiki on workerd; no image module, no redirects, `crawlLinks: false`; fix its
  hardcoded global homepage canonical while in there. Migrating it later unlocks downgrading/
  cancelling the Vercel plan.
- ~~The 3 redirect-only Vercel projects~~ — **moved IN SCOPE 2026-08-23.** They are hosted on
  Vercel DNS, so they block Phase 5 decommissioning, and they are the zero-risk rehearsal for
  the cutover sequence. See "Domain inventory — all FIVE zones" and Phase 3a.
- S3 → R2 for archive/model assets (zero egress) — separate initiative.
- Turnstile on seller/onboard — only if abuse appears post-BotID.

## Verification summary (how we know it worked)

Phase gates: spike checklist (7 checks) → Phase 1 test suite + Vercel prod soak → Phase 2 full
battery on preview → Phase 4 scripted battery on prod + 2–4 week soak with Search Console + quota +
error monitoring. The battery lives in-repo as `scripts/verify-cf-deploy.sh` so every future deploy
can re-run it.

---

## Adversarial review (2026-08-08) — BINDING AMENDMENTS

A 5-lens adversarial workflow (Workers runtime, SEO/DNS, business flows, CI/ops, fact-check) plus
independent refute-verification produced 18 confirmed holes, 0 refutations of the findings, and one
refutation of the plan itself. **Where these amendments conflict with the phase text above, the
amendments win.** Verdicts: 13 verified by independent refuters, 5 verified by direct file/DNS
inspection; evidence cited inline.

### A. Runtime blockers (Phase 0/1 changes)

- **A1 (BLOCKER) — Upload finalize breaks on workerd.** `server/utils/s3Models.ts:130,147` makes
  two real S3 calls via `client.send()` (`@smithy/node-http-handler` → `node:http/https`).
  nitropack 2.13.4 lists http/https in `unsupportedNodeModules` → unenv stubs; `http.request` is
  `notImplemented` and THROWS (verified in `node_modules/.../cloudflare.mjs:49-81` +
  `unenv/dist/runtime/node/http.mjs:11`). workerd's native node:http client doesn't help — the
  bundler aliases at build time. **Fix (Phase 1, platform-neutral):** replace both calls with
  `fetch()` against presigned URLs (presigned HeadObject; presigned GetObject + `Range:
  bytes=0-511`). Add "model upload finalize succeeds" to the Phase 0 spike checklist and a
  `client.send(` grep to CI.
- **A2 (plan overcorrection, REFUTED blocker) — node:dns is fine.** `dns`, `net`, `tls` are in
  nitropack's `builtnNodeModules` (kept external) and workerd implements them natively under
  `nodejs_compat` (shipped 2025-01-28). **Fix:** demote Phase 1 item 1 from mandatory rewrite to
  "spike-verify `assertPublicUrl` end-to-end on workers.dev; keep the DoH rewrite in the back
  pocket only if lookup misbehaves." Saves a day of Phase 1 work and review risk.
- **A3 (HIGH) — `/mcp` needs the uninstalled `agents` package.** `@nuxtjs/mcp-toolkit` swaps to a
  cloudflare provider under the CF preset (`module.mjs:397`) whose handler does
  `await import('agents/mcp')` — an optional peer (`>=0.16.0`) NOT in node_modules (verified). The
  endpoint 500s on workers. **Fix (Phase 1):** add `agents` as a dependency (inert on Vercel);
  include its weight in the spike bundle gate; mount `mcp:sessions` + `mcp:sessions-meta` on KV in
  Phase 2 (they default to per-isolate memory).
- **A4 (MEDIUM) — Every request body is buffered.** `_module-handler.mjs:89` does
  `Buffer.from(await request.arrayBuffer())` before routing/auth, and Vercel's 4.5 MB platform body
  cap disappears (CF accepts up to ~100 MB). A crafted 100 MB POST ≈ 200+ MB of copies vs the
  128 MB isolate limit — cheap unauthenticated DoS. **Fix (Phase 3):** WAF rule blocking
  `Content-Length > ~15 MB` except tighter per-path caps on the upload routes + an early-413 nitro
  middleware on content-length; note the isolate ceiling in the rewritten Security Invariants.

### B. run_worker_first / redirect architecture (Phase 2 redesign)

- **B1 (HIGH, verified by direct ls) — The blanket 39-path list is wrong three ways.** (a) Patterns
  are literal path globs: `/about` does not match `/about/`, and `about/`, `contact/`, `privacy/`,
  `onboarding/`, `dashboard/`, `profile/`, `users/`, `index.html` all EXIST as prerendered assets —
  TME slash-variants would serve CMDIY pages as 200s (the exact SEO failure the middleware
  prevents). (b) Patterns are host-blind, and nitro's worker only forwards to ASSETS on exact
  manifest hits (`isPublicAssetURL('/')` is false) — so listing `/` converts the production
  homepage (+ /about, /privacy, /contact — homepage includes a per-request Supabase query) into
  per-request SSR forever. (c) Only **7** meta-refresh artifacts exist, not 11 (needles, gearbox,
  manuals, adverts, catalogues, tuning, submissions — verified; the 3 contribute 301s and
  `/submissions/**` produce none).
  **Fix — restructure:** (1) serve the TME map at the **zone edge**: Single Redirect rules for the
  9 wildcard prefixes + a Bulk Redirects list for the 19 exact sources on the theminiexchange.com
  zone (both fit free tier; host-scoped by construction; TME redirects then survive worker
  outages); keep the Nitro middleware + its table-driven test as version-controlled spec and
  backstop. (2) `rm` the 7 meta-refresh artifacts from `.output/public` in the deploy workflow so
  those paths fall through to the worker's real 301s. (3) `run_worker_first` then shrinks to
  nothing (or at most the 7 redirect paths as belt-and-braces until the rm step is trusted) — the
  homepage stays on the free static asset layer. (4) Battery: every TME source in BOTH slash forms
  × both hosts × query preservation.
- **B2 (LOW) — 308 vs 301.** Vercel serves the live map as 308s; the middleware/zone rules will
  emit 301. SEO-equivalent, but record it in the plan + battery so archived-crawl diffs aren't
  misread. Also assert the apex chain becomes single-hop (improvement, make it intentional).

### C. DNS / TLS / cutover mechanics (Phase 3/4 corrections)

- **C1 (HIGH) — Certificate gap at NS flip.** Universal SSL for both zones (and the worker
  custom-domain hostnames) is only issued after zone activation — early-propagating resolvers get
  TLS failures on the production domain. **Fix:** while zones are pending, add Cloudflare's DCV
  TXT/CNAME records into Route 53 so certs are Active BEFORE the NS change; make "cert status
  Active for apex+www on both zones" a hard gate; hit "Check nameservers" immediately after the
  registrar change.
- **C2 (HIGH) — Zone import must be BIND-export, never quick-scan.** CF's scan guesses names and
  will miss SES DKIM CNAMEs (`<token>._domainkey`), `_dmarc`, verification TXTs. SPF here is
  `-all` (hard fail) and there was a recent SES bounce-rate scare. **Fix:** `aws route53
  list-resource-record-sets` → BIND file → import-by-file; diff iterates the R53 export as source
  of truth; explicit checklist for SES DKIM, SPF, `_dmarc`, MX (forwardemail.net, both zones),
  google-site-verification, resend SPF (TME). "Search Console still verified" joins the battery.
  (Verified: no CAA records on either zone — nothing blocks cert issuance.)
- **C3 (HIGH) — http→https + HSTS are Vercel platform behaviors.** Verified: Vercel 308s all
  http:// and injects `strict-transport-security: max-age=63072000`; the repo sets HSTS nowhere.
  **Fix (Phase 3):** enable Always Use HTTPS + zone HSTS (max-age=63072000) on BOTH zones; battery
  probes `http://` (expect redirect) and asserts the HSTS header on a 200 and on a redirect.
- **C4 (HIGH) — Apex redirect mechanics.** Single Redirects only run on PROXIED hostnames, and the
  imported apex A record (Vercel IP) may land DNS-only — the rule silently never fires and apex
  traffic keeps flowing to Vercel until Phase 5 kills it. Also verified: Vercel's apex redirect
  preserves query strings; a `$1` wildcard redirect does not unless "preserve query string" is on.
  **Fix:** proxied apex placeholder records in both zones + `preserve_query_string=true`; battery
  asserts apex→www with path AND query.
- **C5 (MEDIUM) — "Pre-stage custom domains" is not a thing.** Attaching a Worker custom domain
  REPLACES any existing DNS record for that hostname at that moment — there is no dormant state,
  and the R53 import necessarily brings in the Vercel-pointing www/TME CNAMEs (verified values).
  The plan text contradicts itself (Phase 2 "added only at Phase 4" vs Phase 3 "pre-stage").
  **Fix:** keep imported Vercel records until the NS flip is confirmed propagating; attaching the
  three custom domains (with override) IS the cutover step, executed in Phase 4; rollback =
  remove custom domain + recreate `www` CNAME → `cname.vercel-dns.com`.
- **C6 (MEDIUM) — The dual-serve window is ~48 h and the stacks are intentionally different.**
  Registry NS TTL is ~2 days; lowering R53 record TTLs only helps the intra-zone rollback path,
  not the NS flip. During the window each stack's HTML references its own image URL scheme
  (`/cdn-cgi/image` vs `/_vercel/image`) — cross-stack fetches 404 transiently, Search Console
  logs noise, external-API quota burns double. **Fix:** correct the TTL claim; add a "known
  transient symptoms during propagation — do not chase" note + a dig-based propagation check
  before starting the battery.
- **C7 (MEDIUM) — auth.classicminidiy.com grey-cloud needs a durable guard.** Orange-clouding it
  later works for weeks, then Supabase's ACME renewal fails and the SSO domain for every property
  breaks. **Fix:** add it as a 13th CLAUDE.md invariant, a comment on the DNS record itself
  (records support comments), and a grey-cloud assertion in `verify-cf-deploy.sh`.
- **C8 — TME is a first-class cutover citizen** (already corrected in the ground-truth section):
  its NS move gets its own TTL prep, cert gate, and 301 battery run; **Phase 5 gains a hard
  precondition** — `dig NS theminiexchange.com` shows Cloudflare AND the TME battery passes
  against live DNS before the Vercel project (or its TME domain attachments) is touched. Graceful
  degradation note: imported R53 records point at Vercel, which keeps serving the 308 map until
  Phase 5 — an NS-propagation gap degrades to Vercel-served redirects, not 404s.

### D. Previews (Phase 2 redesign)

- **D1 (HIGH) — Previews are image-dead as designed.** `/cdn-cgi/image/` exists only on zone
  hostnames; workers.dev and version-preview URLs can never serve it (verified: CF docs + the
  @nuxt/image cloudflare provider emits host-relative URLs with no fallback), and preview URLs
  cannot leave workers.dev. Every archive/wheel/listing/model page renders broken images through
  Phases 2–4, defeating the preview flow's purpose. **Fix:** split gating — preview builds set the
  provider off (raw remote URLs, rendering-but-unoptimized) via env; after Phase 3, attach
  `preview.classicminidiy.com` to the preview worker so ONE environment exercises real
  transformation bytes pre-cutover. Note: the cloudflare provider emits the raw src when no
  modifiers are set — "URL shape" checks must use an image WITH width/format modifiers.
- **D2 (MEDIUM) — PR previews as written run unreviewed code with PROD secrets against PROD KV,
  indexable.** Bare `wrangler versions upload` targets the production worker: top-level secrets,
  production CACHE_KV (cache poisoning one bad handler away), production vars (so
  NUXT_SITE_ENV=preview never applies — verified: indexability comes from nuxt-site-config's env
  check, and the var name IS correct but lives only in env.preview). **Fix:** PR previews run
  `wrangler versions upload --env preview` — preview secrets/KV/vars by construction; battery
  asserts noindex on BOTH the persistent preview worker and a version-preview URL.
- **D3 (MEDIUM) — env.preview needs its own full secret set.** Secrets are per-worker;
  the ~18 `wrangler secret put` commands must run twice (`--env preview`), scripted via
  `wrangler secret bulk` from a gitignored file. First Phase 2 check: "preview worker answers an
  authenticated route 200."
- **D4 (MEDIUM, verified in supabase repo) — Step 2.8 is incomplete and partly impossible.** The
  origin allowlists are exact-match Sets with no wildcards, across FOUR functions and TWO env
  vars: `MODELS_ALLOWED_ORIGINS` (shared by create-model-checkout, create-seller-onboarding,
  create-listing-checkout via `_shared/marketplace.ts`) and `MEMBERSHIP_ALLOWED_ORIGINS`
  (create-membership-checkout). Ephemeral per-version preview origins can never be allowlisted.
  **Fix:** enumerate all four functions + both env vars; add only the stable persistent-preview
  origin; document that payment flows are testable ONLY on the persistent preview worker (or add a
  suffix-wildcard match in the supabase repo — a code change the plan currently claims isn't
  needed).

### E. Caching, CI, hygiene

- **E1 (LOW, verified) — KV-backed swr is per-POP amortization, not CDN coalescing.** Nitro's
  refresh dedupe is per-isolate; at TTL expiry N isolates × POPs fire parallel refreshes and
  collide with KV's 1-write/sec/key. **Fix:** generous `staleMaxAge` (hours), optional 60 s
  in-memory L1, and treat soak quota dashboards as a real gate. Header preservation through the
  cache is fine (verified).
- **E2 (LOW) — Dead immutable rules.** `/images/**`, `/fonts/**`, `/assets/**` don't exist in
  `.output/public`; real static dirs are `/_nuxt/`, `/brand/`, `/app-promo/`, `/_og-static-fonts/`
  etc. **Fix:** base `_headers` on real dirs; drop the dead nitro rules in Phase 5; fix the
  battery's immutable check to a path that resolves.
- **E3 (LOW) — Secret-table hygiene.** `NUXT_OG_IMAGE_SECRET` maps to nothing in the repo — drop
  it. `GITLAB` + `validation_key` are consumer-less runtimeConfig keys, and `GITLAB` currently
  bakes a live `glpat-…` PAT into every build artifact — delete both keys in Phase 1 and REVOKE
  the exposed GitLab token.
- **E4 (LOW) — Local workerd loop.** Add a `bun run build:cf && wrangler dev` recipe + gitignored
  `.dev.vars` template to Phase 2 — SSE/env-timing/asset-interplay bugs are exactly the
  Node-vs-workerd class, and the plan's only repro environment is a remote deploy.
- **E5 (LOW) — compat-date/wrangler pairing.** Pin CI's wrangler version and document the rule:
  bump wrangler first, `compatibility_date` second (local `wrangler dev` errors if the pinned date
  outruns the bundled workerd).
- **E6 (LOW) — PWA.** `pwa.selfDestroying: true` — the SW exists only to unregister old clients;
  the workbox/runtimeCaching config is inert and CLAUDE.md's PWA claims are stale. **Fix:**
  battery asserts `/sw.js` returns 200 (old Vercel-era clients need it to self-destruct on the new
  host); add the PWA sections to the Phase 5 doc-rewrite list as historical.

## Pathfinder: OpenECUAlliance goes first (scope change 2026-08-21)

Cole reversed the "classicminidiy only" scope decision: **OpenECUAlliance migrates first** as the
low-stakes pathfinder to validate the platform mechanics (CF account, wrangler/GH Actions pattern,
BIND-file zone import, DCV cert pre-provisioning, NS-flip playbook) before classicminidiy's
cutover. The OECUA migration runs in its own repo/session and MUST write findings back here.

### Pathfinder log — OpenECUAlliance (live; appended by the OECUA migration session)

Entry format — append below, newest last, one entry per gotcha/validation:

```
#### YYYY-MM-DD — <short title> [validates | contradicts | new-gotcha] [transfers-to-cmdiy: yes/no/partial]
- Plan said: <claim or amendment id, e.g. C1, B1 — or "not covered">
- Observed: <what actually happened, with the command/output or file:line>
- Resolution: <what OECUA did about it>
- CMDIY impact: <what to change in the phases/amendments above, or "none">
```

Rules for the OECUA session: read this entire document (especially the BINDING AMENDMENTS) before
each phase; after each phase — and immediately on any surprise — append entries here; never edit
the amendment sections themselves (this log is the append-only channel; Cole folds accepted
changes into the amendments). When the OECUA migration completes, append a final
**Transferability report** summarizing which amendments were exercised, which were validated,
and any new CMDIY plan changes required.

#### 2026-08-21 — Vercel HSTS + http→https confirmed platform-wide on OECUA [validates C3] [transfers-to-cmdiy: yes]
- Plan said: C3 — http→https 308 + `strict-transport-security: max-age=63072000` are Vercel platform behaviors set nowhere in the repo.
- Observed: identical on all 4 OECUA hostnames (`curl -sI http://…` → 308 with Refresh header; every https response carries the same HSTS value). Captured in `OpenECUAlliance/docs/baselines/2026-08-21-vercel-baseline/hostname-headers.txt`.
- Resolution: OECUA Phase 3 will enable Always Use HTTPS + zone HSTS max-age=63072000 and battery-assert both, exactly as C3 prescribes.
- CMDIY impact: none — C3 stands as written.

#### 2026-08-21 — Vercel apex→canonical-host redirect is 307, not 308/301 [new-gotcha] [transfers-to-cmdiy: partial]
- Plan said: B2 — Vercel serves the TME map as 308s; Phase 3 mirrors "Vercel's current apex behavior" with a 301 Single Redirect.
- Observed: OECUA's apex→www redirect (both domains) is **307 Temporary** (`https://openecualliance.org/` → 307 → www), while http→https is 308. Query strings and paths are preserved (validates C4's preserve_query_string requirement). So "Vercel emits 308" is true for vercel.json `permanent: true` redirects but NOT for the platform's implicit apex→primary-domain redirect.
- Resolution: OECUA replaces the 307 with an intentional 301 at the CF zone edge (SEO improvement, made deliberate + battery-noted like B2's 308→301 note).
- CMDIY impact: baseline-snapshot classicminidiy.com's apex→www status code before cutover — the plan's "mirror Vercel's current apex behavior" with a 301 may be a status-code change (307→301) worth recording in the battery expectations, same class as B2.

#### 2026-08-21 — Secondary domain is a full duplicate-content mirror [new-gotcha] [transfers-to-cmdiy: partial]
- Plan said: not covered (OECUA appendix didn't mention oecua.org).
- Observed: `https://www.oecua.org/` serves the entire site as 200s — a duplicate-content mirror, not a redirect; `oecua.org` apex 307s to **www.oecua.org**, never to openecualliance.org. Every page on both hosts emits the same hardcoded canonical `https://openecualliance.org` (the known global-canonical bug — the only thing accidentally mitigating the duplicate-content issue).
- Resolution: Cole decision queued: redirect oecua.org/* → primary at the CF zone edge (recommended) vs keep mirroring. The canonical fix (Phase 1) must land BEFORE or WITH any change that stops the mirror sharing canonicals.
- CMDIY impact: audit ALL domains attached to each Vercel project for mirror-vs-redirect behavior during baseline — a domain attached without vercel.json host rules mirrors silently. (theminiexchange.com has explicit rules; verify nothing else is attached bare.)

#### 2026-08-21 — SES inbound MX exists on openecualliance.org [validates C2] [transfers-to-cmdiy: yes]
- Plan said: C2 — BIND-file import only; explicit checklist for MX/DKIM/SPF because quick-scan misses mail records.
- Observed: `dig +short MX openecualliance.org` → `10 inbound-smtp.us-east-1.amazonaws.com` (SES inbound receiving). No TXT/SPF at either apex; oecua.org has no MX.
- Resolution: OECUA Phase 3 zone import uses `aws route53 list-resource-record-sets` → BIND file, with MX preservation as a named gate.
- CMDIY impact: none — C2 stands; OECUA now exercises it for real before CMDIY's higher-stakes zones.

#### 2026-08-21 — Site serves at www while canonical/sitemap/site.url say apex [new-gotcha] [transfers-to-cmdiy: no]
- Plan said: OECUA appendix — "fix its hardcoded global homepage canonical while in there."
- Observed: the bug is worse than a wrong canonical: `site.url` = apex, sitemap lists apex URLs, canonicals point at the apex — but the apex 307s to www, so the declared primary host redirects to the real serving host with a *temporary* status. Google's view of the primary host is currently ambiguous.
- Resolution: Cole decision queued (primary host apex vs www) before Phase 1's canonical fix; the fix will align canonical + site.url + sitemap + the zone-edge redirect direction to one host.
- CMDIY impact: none (classicminidiy.com's www-primary setup is consistent) — but the battery's canonical checks should assert host-consistency, not just non-emptiness.

#### 2026-08-23 — Module-scope setInterval aborts worker BOOT, not just the request [new-gotcha] [transfers-to-cmdiy: yes]
- Plan said: the module-scope inventory (ground truth + A-series) lists `useRuntimeConfig()` and `process.env` reads, but never module-scope TIMERS.
- Observed: OECUA `server/middleware/02.security.ts:200` had a module-scope `setInterval` (hourly map cleanup) behind a `typeof setInterval !== 'undefined'` guard. On workerd the guard PASSES but the call throws `Disallowed operation called within global scope` — and the entire worker fails to start (`wrangler dev` exits; every route dead), it does not degrade per-request.
- Resolution: replaced with a lazy once-per-hour sweep inside the request path (OECUA commit 70d33ad); platform-neutral, ships via Vercel first.
- CMDIY impact: add to Phase 0 spike checks + CI grep: `grep -rn "setInterval\|setTimeout" server/` for module scope — cmdiy's `rate-limit.ts`, `bot-analytics.ts`, and any cache-eviction util are the suspects. A single surviving module-scope timer = total outage on deploy, the worst failure class found so far.

#### 2026-08-23 — Workers Static Assets html_handling diverges from Vercel URL shapes [new-gotcha] [transfers-to-cmdiy: yes]
- Plan said: B1 covers assets shadowing redirects; nothing covers trailing-slash handling of prerendered `page/index.html` files.
- Observed: with the default `html_handling: auto-trailing-slash`, `/spec` → **307 → `/spec/`** on workerd, while Vercel serves `/spec` directly as 200 (and Vercel's `/spec/` 302s to `/login` — a pre-existing bug, see next entry). Every prerendered route gains a redirect hop on its canonical no-slash URL.
- Resolution: OECUA sets `assets.html_handling: "drop-trailing-slash"` in wrangler.jsonc → `/spec` 200, `/spec/` redirects back. Battery asserts both slash forms per prerendered route.
- CMDIY impact: cmdiy's wrangler.jsonc (Phase 2.1) needs an explicit `html_handling` decision + baseline capture of Vercel's slash behavior for its prerendered pages; add both slash forms of every prerendered route to the battery (same spirit as B1's "both slash forms" for TME).

#### 2026-08-23 — Vercel slash-variants of prerendered pages 302 to /login today [new-gotcha] [transfers-to-cmdiy: partial]
- Plan said: not covered.
- Observed: on Vercel prod, `/spec/` (trailing slash) misses the prerendered asset, falls through to SSR, fails @nuxtjs/supabase's EXACT-match exclude list, and 302s to `/login`. Same for unknown URLs (no real 404 — parity on both platforms, so not a migration regression, but a soft-404 SEO issue).
- Resolution: OECUA's drop-trailing-slash config fixes the slash-variant case at the asset layer; the auth-redirect-as-404 behavior is logged but out of migration scope.
- CMDIY impact: partial — cmdiy doesn't use @nuxtjs/supabase's redirect middleware, but the battery's "unknown URL → real 404" check (Phase 4.3) is validated as load-bearing; also check cmdiy prerendered-page slash variants against whatever its SSR fallback does.

#### 2026-08-23 — NUXT_-prefixed worker vars override build-baked runtimeConfig at runtime [validates Phase 2.7] [transfers-to-cmdiy: yes]
- Plan said: Phase 2.7 — runtimeConfig keys need `NUXT_`-prefixed names as wrangler vars/secrets; "verify each empirically on preview."
- Observed: OECUA bakes rateLimit config from `process.env` at build (baked value 30/min). `wrangler dev --var NUXT_RATE_LIMIT_LIST_PER_MINUTE:99` → `x-ratelimit-limit-minute: 99` at runtime. Nitro's env-override layer works on workerd exactly as the plan assumed (nested camelCase key ← SCREAMING_SNAKE env).
- Resolution: OECUA Phase 2 sets secrets/tunables as `NUXT_*` worker vars; build-time baking remains only the fallback default.
- CMDIY impact: none — Phase 2.7 stands, now empirically proven on workerd.

#### 2026-08-23 — wrangler 4.x auto-loads .env into local dev bindings [validates E4, simpler than planned] [transfers-to-cmdiy: yes]
- Plan said: E4 — add a `bun run build:cf && wrangler dev` recipe + gitignored `.dev.vars` template.
- Observed: wrangler 4.125.0 prints `Using secrets defined in .env` and exposes the repo's existing `.env` values as local bindings automatically — no `.dev.vars` duplication needed.
- Resolution: OECUA's E4 recipe is just `NITRO_PRESET=cloudflare_module bun run build && bunx wrangler dev` (wrangler.jsonc carries main/assets config).
- CMDIY impact: E4's `.dev.vars` template step can be dropped if cmdiy's `.env` already holds the right names; verify the same auto-load on its wrangler version.

#### 2026-08-23 — serverAssets/useStorage('assets') fully works on workerd; shiki never runs there [validates OECUA appendix, corrects one item] [transfers-to-cmdiy: partial]
- Plan said: OECUA appendix — "verify `useStorage('assets')` specs reads + shiki on workerd."
- Observed: all three call shapes green on workerd (`getKeys` list, `getItem` YAML parse incl. `?version=`, `getItemRaw` binary PNG + YAML download with correct content-disposition) — specs are inlined as JS modules under `chunks/raw/`. Shiki: every `CodeBlock.vue` use sits on a prerendered route, so shiki executes at build time and client-side only; highlighted markup verified intact in prerendered assets served by workerd. Bundle: 3.54 MB gzip (16 MB raw incl. the 1.6 MB specs) — over the 3 MiB free-plan cap (deploy rejected, code 10027), fine for paid.
- Resolution: spike core checks passed; Workers Paid activation queued to Cole.
- CMDIY impact: none directly (cmdiy doesn't use serverAssets at this scale) — but "free plan won't fit a real Nuxt SSR bundle" is now measured: budget Workers Paid for any Nuxt property.

#### 2026-08-23 — Preview auth dies at the APP layer before allowlists even matter [new-gotcha] [transfers-to-cmdiy: yes]
- Plan said: Phase 2.8/D4 treat Supabase allowlists as the thing standing between previews and working auth.
- Observed: OECUA's `useAuth.ts` built `emailRedirectTo` from `siteConfig.url` (build-baked production URL) — every magic link requested from workers.dev pointed back to production. This bug predates the migration: Vercel preview logins have been silently bouncing to prod all along. Only after fixing the app (current-origin redirect, OECUA commit fb3d74c) did the allowlist question become testable at all.
- Resolution: platform-neutral fix committed; allowlist test now pending the correct project's config.
- CMDIY impact: before trusting D2/D4's allowlist work, grep cmdiy's auth flows for `site.url`/hardcoded-origin redirect construction — an app-level pin makes the allowlist step appear broken (or silently masks it).

#### 2026-08-23 — GoTrue's allowlist rejection is a SILENT fallback with a readable signature [new-gotcha] [transfers-to-cmdiy: yes]
- Plan said: D-series — "verify each empirically"; nothing describes what allowlist failure looks like.
- Observed: when `redirect_to` is not allowlisted, GoTrue returns success, sends the email, and swaps the redirect for bare `SITE_URL` — the failure signature in the delivered link is `redirect_to=<SITE_URL>` with the requested `/auth/callback` path STRIPPED. No error surfaces anywhere client-side.
- Resolution: OECUA battery gains a magic-link email inspection step (request from target origin → assert `redirect_to` echoes that origin + path).
- CMDIY impact: Phase 2.8 verification should use this exact probe; a "login works" smoke test can pass via the SITE_URL fallback chain while previews are actually broken.

#### 2026-08-23 — OECUA auth is its OWN Supabase project, not the shared CMDIY instance [contradicts ecosystem docs] [transfers-to-cmdiy: no]
- Plan said: not covered (Development/CLAUDE.md implies all properties share `auth.classicminidiy.com`).
- Observed: OECUA's SUPABASE_URL is `ljigjawvlwvciqvegptp.supabase.co` — its own project, email-magic-link only (every OAuth provider disabled). The allowlist edit Cole made on the shared ClassicMiniDIY project therefore had no effect here.
- Resolution: allowlist entry redirected to the correct project; OECUA docs updated at Phase 5.
- CMDIY impact: none for the migration itself — but the ecosystem CLAUDE.md's shared-auth claim needs a footnote that OECUA is outside it.

#### 2026-08-23 — Phase 0 spike COMPLETE: all gates passed [validates Phase 0 design] [transfers-to-cmdiy: yes]
- Plan said: Phase 0 go/no-go on workers.dev with no prod risk.
- Observed: full pass on the deployed worker — serverAssets (all 3 useStorage shapes), rate-limit middleware, sitemap parity, prerendered pages incl. shiki markup, SSR pages, NUXT_ env overrides, and the full Supabase magic-link PKCE flow: email link carried the workers.dev redirect after the allowlist entry landed, callback exchanged the code, and a fresh SSR document request to /profile served the authenticated page (cookie SSR auth works on workerd). Two platform-neutral fixes were required to get here (module-scope setInterval, app-pinned auth redirect) — both committed and headed to main via Vercel first, exactly the Phase 1 soak pattern the plan prescribes.
- Resolution: OECUA proceeds to Phase 1.
- CMDIY impact: the spike-first sequencing is validated — both blockers found here would have been cutover-day outages if discovered on live DNS.

#### 2026-08-23 — Cole decisions: OECUA primary domain becomes oecua.org; CMDIY NS change stays viable [new-gotcha for OECUA scope; validates cutover mechanics for CMDIY] [transfers-to-cmdiy: partial]
- Plan said: OECUA appendix assumed openecualliance.org stays primary; CMDIY Phase 4 depends on an NS change at Amazon Registrar.
- Observed: Cole chose oecua.org (apex) as the go-forward primary — a full domain change with openecualliance.org 301-ing into it (accepted: site has minimal traffic and auth has been effectively broken for months, so re-index risk is negligible). Separately, Cole clarified his Cloudflare constraint for CMDIY is NO REGISTRAR TRANSFER only — the NS change the plan requires is acceptable.
- Resolution: OECUA Phases 1-4 target oecua.org as canonical host (site.url, canonicals, sitemap, zone redirects: all *.openecualliance.org + www.oecua.org → oecua.org). Registration stays at Amazon Registrar for all domains.
- CMDIY impact: none to the mechanics — but record the constraint: Cloudflare Registrar consolidation is permanently out of scope for classicminidiy.com.

#### 2026-08-23 — Apex-level dig sweeps miss most mail records; C2 is stronger than written [validates C2, strengthened] [transfers-to-cmdiy: yes]
- Plan said: C2 — use a BIND export, never CF's quick-scan, because the scan misses SES DKIM CNAMEs, `_dmarc`, verification TXTs.
- Observed: OECUA's Phase-0 baseline used `dig MX/TXT` **at the apex only** and concluded "no TXT records, no SPF — nothing sends mail from these domains." The Route 53 console listing proved that wrong: 5 of 9 records are mail, and 4 sit on subdomains an apex sweep never touches — `_dmarc` TXT, `resend._domainkey` TXT (DKIM), `send.` MX (`feedback-smtp.us-east-1.amazonses.com`), `send.` TXT (SPF `include:amazonses.com`). The site's magic-link email sends from `no-reply@openecualliance.org` through Resend, so losing any of them breaks login delivery, not just marketing mail.
- Resolution: full inventory committed to `OpenECUAlliance/docs/plans/dns-record-inventory.md`; `scripts/verify-cf-deploy.sh` asserts all five mail records resolve from the CF nameservers as a cutover gate.
- CMDIY impact: **C2 should be widened — an authoritative record dump (BIND export or console listing) is mandatory, and dig-based verification is NOT an acceptable substitute for discovery.** cmdiy has more mail surface (SES DKIM ×3, forwardemail.net MX, resend SPF on TME) and a recent bounce-rate scare; a dig sweep that "finds nothing" there would be a false all-clear.

#### 2026-08-23 — Account API tokens need account-level Zone:Edit to CREATE zones [new-gotcha] [transfers-to-cmdiy: yes]
- Plan said: Phase 3.1 "Create the CF zones" with a Cole-provisioned API token; token scoping listed Workers/DNS/SSL/Rules.
- Observed: a token with Zone:Read + DNS:Edit + Workers can list zones and edit records but `POST /zones` fails with `Requires permission "com.cloudflare.api.account.zone.create"`. Zone creation is an ACCOUNT-scope permission distinct from every zone-scope permission, and it is easy to omit because the token UI groups "Zone" under both scopes.
- Resolution: Cole adds Account → Zone → Edit to the existing token (zones cannot be created until then).
- CMDIY impact: put account-level **Zone:Edit** explicitly in the Phase 3 token checklist, and validate the token with a `POST /zones` dry attempt BEFORE cutover week — discovering it during the DNS window costs a dashboard round-trip at the worst time.

#### 2026-08-23 — Verification battery is portable and worth writing at Phase 2, not Phase 4 [contradicts phase ordering] [transfers-to-cmdiy: yes]
- Plan said: the battery lives in-repo as `scripts/verify-cf-deploy.sh` and runs at Phase 4 against prod.
- Observed: writing it at Phase 2 with an origin argument (defaulting to prod, accepting a workers.dev origin) made it immediately useful — it caught a stale worker deployment and two of its own assertion bugs while still on preview, and it now gates every deploy via the GH Actions smoke step. Zone-dependent checks (redirects, HSTS, mail records) sit behind an origin guard and arm automatically at cutover.
- Resolution: OECUA's battery passes 24/24 against the preview worker today; the same script becomes the cutover gate unchanged.
- CMDIY impact: move battery authoring into Phase 2 and parameterize by origin. A battery first exercised on cutover day is a battery whose own bugs surface at the worst moment — both of OECUA's assertion bugs would have read as production failures.

#### 2026-08-24 — "GH Actions' 16 GB ends the OOM class" is FALSE without NODE_OPTIONS [contradicts plan] [transfers-to-cmdiy: yes]
- Plan said: pros list — "build moves to GH Actions (16 GB, ends the 8 GB build-container OOM class permanently)."
- Observed: OECUA's very first post-merge deploy died at the Nitro bundling step with `FATAL ERROR: Ineffective mark-compacts near heap limit`, capping around 2 GB (`Mark-Compact 2035.7 (2092.0) -> 2034.8 MB`). Node caps its own old-space near 2 GB regardless of host RAM, so the runner's 16 GB is unreachable without raising it. The same build succeeds locally on macOS, where Node's default heap is larger — so this failure appears ONLY in CI, after merge.
- Resolution: `NODE_OPTIONS=--max-old-space-size=6144` in the workflow's build step env (OECUA branch `fix/ci-build-heap-limit`).
- CMDIY impact: **correct the pros claim** — GH Actions removes the container-size ceiling but not the V8 heap ceiling. cmdiy already carries `--max-old-space-size=6144` in its vercel.json build command; Phase 2.6 must carry it into `deploy.yml`'s build step or the first post-cutover deploy fails the same way. cmdiy's bundle is far larger than OECUA's, so treat this as a certainty, not a risk.

#### 2026-08-24 — Account-owned tokens appear unable to grant zone-create [new-gotcha, unresolved] [transfers-to-cmdiy: yes]
- Plan said: Phase 3.1 assumes an API token can create the zones.
- Observed: the account-owned token's new categorized permission UI has a "DNS & Zones" category containing only Account DNS Settings, DNS Firewall, DNS View, Registrar Domains, Registrar Sandbox Domains — **no "Zone" permission**, which is what grants `com.cloudflare.api.account.zone.create`. `POST /zones` keeps failing with that exact permission error. The permission-group catalog endpoints (`/user/tokens/permission_groups`, `/accounts/{id}/tokens/permission_groups`) are both unreadable by an account-owned token, so the catalog cannot be introspected to confirm.
- Resolution: creating the two zones through the dashboard instead; the token then only needs a zone-scoped policy for DNS/SSL/Settings/Redirects.
- CMDIY impact: do NOT plan on API-driven zone creation. Either create zones in the dashboard as a Cole step, or use a user-owned token for that one call. Also note account-owned tokens need an explicitly zone-scoped policy — an account-scoped policy alone leaves DNS/SSL/Zone-Settings reads denied even on existing zones (verified against the pre-existing deathlyhallows.co zone).

#### 2026-08-24 — C1's cert pre-provisioning mitigation does NOT apply to full-setup zones [contradicts C1 — HIGH for cmdiy] [transfers-to-cmdiy: yes]
- Plan said: C1 — "while zones are pending, add Cloudflare's DCV TXT/CNAME records into Route 53 so certs are Active BEFORE the NS change; make 'cert status Active' a hard gate."
- Observed: the documented DCV pre-validation flow is scoped to **partial (CNAME) setups**. Cloudflare's Universal SSL page states a full-setup zone "automatically receive[s] its Universal SSL certificate within 15 minutes to 24 hours of domain activation" — i.e. AFTER the NS change, not before. Delegated DCV is explicitly unavailable for pending zones ("works as long as the zone is active on Cloudflare"), so the `_acme-challenge` CNAME trick cannot pre-validate a pending full zone either. Both OECUA zones were created as `type: full`.
- Resolution (OECUA): accepted, because the site has negligible traffic — the plan is to flip NS, then watch cert status and hold the battery until certificates report Active. Documented as a known window rather than an engineered-away risk.
- CMDIY impact: **this is the highest-value finding so far and it needs a decision before cmdiy's cutover, because classicminidiy.com cannot absorb a TLS gap.** Options, in order of preference: (1) create the cmdiy zones as **partial/CNAME setups** first, pre-validate via DCV records in Route 53, confirm certs Active, then convert to full and flip NS; (2) **upload a custom certificate** to Cloudflare before the flip (Cloudflare's own documented "minimize downtime" path — needs a real cert for classicminidiy.com + www + TME hostnames); (3) accept a 15-min-to-24-h risk window on a high-traffic production domain — not acceptable. C1's hard gate ("cert Active before NS change") is still the right gate; only its stated mechanism is wrong for full zones.

#### 2026-08-24 — Cloudflare's auto-scan imported all 7 records correctly, but only the inventory could prove it [partially contradicts C2] [transfers-to-cmdiy: partial]
- Plan said: C2 — CF's scan "guesses names and will miss SES DKIM CNAMEs, `_dmarc`, verification TXTs"; use a BIND import instead.
- Observed: for OECUA the dashboard "Add a site" scan imported **all 7 importable records correctly** — apex A, www CNAME, both MX with priority 10, `_dmarc` TXT, `send.` SPF TXT, and the 218-character `resend._domainkey` DKIM TXT **byte-for-byte identical**, all correctly dns-only (unproxied). Verified programmatically against the committed inventory.
- Resolution: no repairs needed; the inventory did its job as the verification oracle rather than as an import source.
- CMDIY impact: soften C2's claim from "the scan WILL miss records" to "the scan CANNOT BE TRUSTED to be complete — you need an independent record list to verify against." The authoritative dump is still mandatory, but its role is verification, and a scan-then-verify flow is acceptable and less work than a BIND import. Note OECUA's zone had no CNAME-type DKIM (Resend uses a TXT here); cmdiy's SES DKIM **CNAMEs** are the case C2 was actually written about and remain untested.

#### 2026-08-24 — Grey-cloud cutover eliminates the C1 cert gap entirely; supersedes the partial-zone workaround [supersedes the previous C1 entry] [transfers-to-cmdiy: yes — RECOMMENDED]
- Plan said: C1 — pre-provision certs before the NS flip; C5 — attaching a Worker custom domain replaces the DNS record and IS the cutover step.
- Observed: a full-setup zone cannot pre-validate (previous entry), but the gap is avoidable without partial zones or custom certs. Cloudflare imported the apex/www records **proxied**; flipping NS in that state would send traffic to Cloudflare before a cert exists → TLS failure. Setting those same records **DNS-only (grey cloud)** makes Cloudflare answer DNS while traffic continues straight to Vercel on Vercel's own TLS — so the NS flip becomes a pure DNS-authority change with **zero user-visible effect**, and the cert issues in the background on the now-active zone.
- Resolution (OECUA): all four web records (apex + www × both zones) set DNS-only before the flip; mail records untouched. Cutover becomes two independent, individually reversible steps: (1) NS flip — invisible, still Vercel-served; (2) after the cert reports Active, attach the Worker custom domain / proxy the redirect hostnames — the actual traffic switch. Rollback from step 2 is a single record edit back to DNS-only Vercel, no NS involvement.
- CMDIY impact: **adopt this as the default cutover sequence — it is strictly better than all three options in the previous entry** and needs neither a partial-zone dance nor a purchased certificate. It also decouples "DNS moved" from "traffic moved," which shrinks C6's scary ~48 h dual-serve window into a period where every resolver, old or new, still reaches the same Vercel origin. Caveat to carry over: Single Redirects only fire on proxied hostnames (C4), so redirect rules stay dormant until step 2 — during step 1 the legacy hosts keep their existing Vercel behavior, which is the correct no-regression default.

#### 2026-08-24 — .org registry delegation TTL is 3600, not ~2 days; and whois updates instantly [contradicts C6] [transfers-to-cmdiy: partial]
- Plan said: C6 — "Registry NS TTL is ~2 days; lowering R53 record TTLs only helps the intra-zone rollback path, not the NS flip," implying a ~48 h dual-serve window.
- Observed: minutes after the registrar change, `whois` already returned the Cloudflare nameservers for both domains, while the .org TLD servers still served the AWS delegation with **TTL 3600 (1 hour)**, not 172800. So the propagation ceiling here is registry-push latency plus one hour, not two days. Also note the two views disagree during the window — whois reflects the registrar's record, TLD DNS reflects what resolvers actually follow; **whois showing the new NS is NOT evidence of propagation**, and only the TLD/registry DNS answer is.
- Resolution: OECUA monitors zone activation via the CF API rather than estimating from TTL.
- CMDIY impact: verify the actual delegation TTL for classicminidiy.com/theminiexchange.com with `dig +norecurse NS <domain> @<tld-ns>` before cutover rather than assuming 48 h — .com may differ from .org, but the "~2 days" figure should be measured, not assumed. Keep C6's "don't chase transient symptoms" advice; just size the window from evidence. (With the grey-cloud sequence above, the window is harmless regardless of length.)

#### 2026-08-24 — CUTOVER COMPLETE; and a verification-methodology warning [validates the amended plan] [transfers-to-cmdiy: yes]
- Plan said: Phase 4 — flip, verify with the scripted battery, soak.
- Observed: oecua.org went live on Workers with **zero downtime**. Sequence that worked: grey-cloud NS flip (invisible) → confirm cert valid → Worker **route** + proxy the redirect hostnames (the actual switch). Battery 36/37; the single failure was a stale *local* resolver cache, disproved with `curl --resolve` against the edge IP and by 1.1.1.1/8.8.8.8 both already returning Cloudflare. Mail proven intact by Google's own `Authentication-Results` (`dkim=pass s=resend`, `spf=pass`, `dmarc=pass`) on a message delivered AFTER the flip.
- Two methodology lessons, both of which produced false failure reports before being caught: (1) **the operator's own resolver cache is not ground truth** — always confirm a "broken" hostname with `curl --resolve <host>:443:<edge-ip>` and a public resolver before believing it; (2) **mailbox search is not a delivery oracle** — the Gmail index lagged so far behind reality that it never surfaced magic-link emails the user had already received and deleted, even minutes later and including trash. Verifying auth delivery by searching an inbox produced a confident, wrong "emails are not being delivered" conclusion.
- Resolution: both false alarms corrected in the OECUA repo; the battery now documents the `--resolve` technique.
- CMDIY impact: bake both into the cmdiy cutover runbook. On a high-traffic domain a false "it's broken" reading is worse than a missed check — it invites an unnecessary rollback mid-cutover. Every negative battery result must be confirmed against the edge before it is treated as real.

---

### CMDIY implementation log (appended by the cmdiy migration session)

#### 2026-08-23 — Token verified; A-series recon done before the spike [validates A1 scope-down, confirms A3] [source: this branch]
- **Token:** `cmdiy-cf-migration` verified by `scripts/verify-cf-token.py`. Five zones reachable,
  OECUA's three zones denied, all five required zone permissions plus Workers Scripts/KV present.
  **Gotcha for the next person:** `GET /zones` returns zones covered by the ACCOUNT-scope policy
  too, so a token correctly limited to five zones can still *list* eight. Listing is not access —
  probe `dns_records` per zone to tell them apart. Bulk Redirect Lists is NOT granted; add it only
  if B1's 19 exact sources ship as a Bulk Redirects list.
- **Module-scope timers: CLEAR.** Five `setTimeout` calls in `server/`, all inside request
  handlers (youtube retry backoff, github request timeouts). No `setInterval` anywhere. The
  lazy-sweep fix from web#650 held. No module-scope client construction either — grep for
  top-level `new *Client` / `createClient` in `server/` returns nothing.
- **A1 is far smaller than the risk register assumed.** The AWS SDK appears in exactly ONE file,
  `server/utils/s3Models.ts`, with exactly TWO `.send()` calls: `headModelObject` (HeadObject) and
  `getModelObjectHead` (ranged GetObject for magic-byte sniffing). Both sit on the model-upload
  **finalize** path only. The client is built lazily inside `getModelsS3()`, never at module
  scope. Critically, `createPresignedPost` and `getSignedUrl` do NOT call `.send()` — they are
  pure signing, so upload and download URLs should work on workerd untouched. A1's blast radius
  is upload-finalize, not the marketplace.
  Likely fix if the spike confirms the failure: pass `requestHandler: new FetchHttpHandler()` to
  the `S3Client` constructor so smithy uses `fetch` instead of `node:http`. Verify the failure
  first, per the plan.
- **A3 CONFIRMED, with its exact mechanism.** `/mcp` is served by `@nuxtjs/mcp-toolkit@0.18.0`,
  not a hand-written route. It declares `agents: ">=0.16.0"` as an **optional** peer, and its
  Cloudflare provider does `await import("agents/mcp")` at REQUEST time
  (`dist/runtime/server/mcp/providers/cloudflare.js`). Because the import is dynamic, this does
  not break the build or worker boot — the worker deploys green and `/mcp` 500s the first time an
  AI client calls it. That silent-until-used shape is the danger; put `/mcp` in the verification
  battery explicitly.

#### 2026-08-24 — MCP Server Portals evaluated and REJECTED; we are already on the first-party path [decision] [source: this branch]
- Question raised: should `/mcp` move to Cloudflare's first-party "MCP Server Portals" / MCP
  server features?
- **Portals: no.** They are a **Cloudflare One / Zero Trust** feature — a centralized gateway
  controlling which of an ORGANIZATION'S OWN USERS may reach which MCP servers (MFA, device
  posture, geo restrictions, role-based access, aggregated audit logs, Gateway/DLP scanning of
  upstream traffic). The docs require a Zero Trust organization with an identity provider and
  document **no anonymous or API-key public access**. cmdiy's `/mcp` is a PUBLIC product surface
  for enthusiasts' AI clients, gated by `MCP_API_KEY`; a Portal would force every user into our
  Zero Trust org and break the feature. Portals would only ever be relevant to governing which
  MCP servers *we* connect our own tooling to — a workstation-security question, not a platform one.
- **First-party hosting: already adopted.** Cloudflare's current recommendation for remote MCP
  servers is `createMcpHandler` on **standard Workers**, now graduated into the official MCP
  TypeScript SDK. That is precisely what `@nuxtjs/mcp-toolkit` invokes via
  `await import("agents/mcp")`. No architecture change needed.
- **DO-not-required is now confirmed from two independent directions**: the local `node_modules`
  read (`createMcpHandler` -> `createStatelessMcpHandler`, zero DurableObject refs) and
  Cloudflare's own announcement that "MCP itself no longer requires a Durable Object to speak the
  protocol." MCP is fully stateless — no `initialize` handshake, no `Mcp-Session-Id` in the core
  request path.
- **Watch item:** `@nuxtjs/mcp-toolkit` is `0.18.0` and its Cloudflare provider still carries
  session-invalidation logic keyed on `mcp-session-id`, i.e. it straddles both protocol
  generations. A green deploy proves little. The Phase 0 spike must call `/mcp` with a real MCP
  client and assert a valid tool listing, not merely a 200.
- **Open decision, deferred to the bundle measurement:** keep `/mcp` in the main worker (current;
  shared server utils, one deploy, but the MCP SDK rides in an already-tight bundle) vs. split it
  into its own Worker (lean main bundle, independent deploys, second deploy target; the tools in
  `server/mcp/tools/` are pure functions and port cheaply). Default is to stay in the main worker
  unless the Cloudflare-preset bundle size forces the split. Do not split preemptively.

#### 2026-08-24 — Phase 0 static gates PASS; three plan errors found in the build command alone [contradicts Phase 0 text] [source: this branch]
- **The documented build command does not work, in two independent ways.**
  1. `NITRO_PRESET=cloudflare_module` on nitropack **2.13.4** silently selects the **LEGACY**
     Workers Sites runtime and dies with
     `Cannot resolve "__STATIC_CONTENT_MANIFEST" ... and externals are not allowed!`. Cause: the
     modern preset (`name: cloudflare-module`, `stdName: cloudflare_workers`) declares
     `compatibilityDate: 2024-09-19`, and `_resolve.mjs` drops any preset whose declared date is
     newer than the project's. With cmdiy's `2024-08-29` the modern preset was filtered out,
     leaving `cloudflare-module-legacy` (which claims `cloudflare-module` as an alias) as the only
     match. **The preset name was never wrong — the date was.** OECUA never hit this because it is
     on nitropack 2.12.9.
  2. `NITRO_PRESET=cloudflare_workers` — the modern preset's own `stdName` — **can never resolve**.
     `_resolve.mjs` does `kebabCase(name)`, turning it into `cloudflare-workers`, which matches no
     preset's name, stdName or alias. It then re-filters on the RAW name in an error branch and
     reports `cannot be resolved with current compatibilityDate`, which points at the wrong cause
     entirely. Do not chase the date when you see that message — check the name first.
- **`compatibilityDate` bumped `2024-08-29` -> `2024-09-25`.** Nitro resolves an effective date
  6-8 days EARLIER than the configured value, so the naive `2024-09-19` still failed the
  `>= 2024-09-19` gate. This date governs the **Vercel** build too; verified no regression —
  `VERCEL=1 NITRO_PRESET=vercel` builds green and `.vercel/output/config.json` still carries the
  `images` key, so the image-provider auto-detection contract holds.
- **6144 MB of heap is NOT enough for cmdiy** — V8 `Reached heap limit`, SIGABRT. 8192 works. This
  extends the pathfinder's NODE_OPTIONS finding rather than repeating it: the value that is
  sufficient for OECUA is insufficient here, and note this is a **V8 heap** OOM, not the container
  SIGKILL documented in CLAUDE.md — different failure, different fix.
- **Bundle gate PASSES: 19283 KiB raw / 4774 KiB gzip (4.66 MB).** Under the 9 MB spike gate and
  under the 10 MB paid limit, but **well over the 3 MiB free cap** — Workers Paid confirmed
  necessary for cmdiy as it was for OECUA, now with the MCP SDK and `agents` included.
- **Other static gates:** no `.node` files; no real `sharp`/`ipx` imports (4 chunks contain the
  substrings, none is an import); `.output/public` is 1135 files against the 20k cap, so
  `compressPublicAssets` `.gz`/`.br` siblings (682 of them) are NOT a problem here and can stay;
  `_headers` IS emitted (34 lines) and needs reconciling with the planned header rules;
  `agents/mcp` is present in the bundle.
- **Open:** wrangler warns `Duplicate key "provider" in object literal` on the built worker — not
  fatal, unchased.
- **Not yet run:** every RUNTIME gate (OG image via wasm, SSE, SSR/JSON-LD parity, `/mcp` with a
  real client, KV, env timing, and A1's `client.send()`). Those need the worker deployed.
- **Spike-only, NOT production-safe:** `server/stubs/botid-server-stub.mjs` fail-OPENs on
  Cloudflare builds via a new `isCloudflareBuild` alias gate in `nuxt.config.ts`. A zone WAF rule
  must exist before any real cutover, or `/api/langgraph/*` and `/api/models/seller/onboard` lose
  bot protection silently.

#### 2026-08-24 — Phase 0 RUNTIME gates: A3 resolved, A1 confirmed, one site-wide URL bug caught [source: this branch]
Spike worker: `cmdiy-spike.classicminidiy.workers.dev`, startup 147 ms. Secrets pushed with
`wrangler secret put` (encrypted at rest, runtime-only bindings). Deliberately NOT on the spike:
`SUPABASE_SERVICE_KEY`, real S3 keys, `MARKETING_UNSUB_SECRET`, `GITLAB` — no gate needs them and
they carry the real blast radius.

- **GATE 2 PASS — takumi-wasm renders on workerd.** A model page's `_og/s/*.png` returns 200,
  `image/png`, **607727 bytes**, 1200x600. No fallback to satori needed. Note OG generation is
  used ONLY on model pages (`app/composables/useModelSeo.ts`); every other page ships a static
  S3 `social-share` image, so this gate has exactly one real test surface.
- **GATE 4 PASS — SSR parity + the schema-org canary.** `/` 200 with **non-empty JSON-LD**
  (1 block, non-empty — the nuxt-4.5 pin's whole reason for existing, healthy here), `/api/torque`
  200, unknown URL a real **404** (the `[...slug].vue` catch-all fix survives), and Supabase is
  reachable (`/api/models` returns live rows).
- **A3 RESOLVED — `/mcp` works.** 401 with no key, 403 with a bad key (fails closed as designed),
  and with a real key a valid `tools/list` over SSE carrying full tool schemas. That is a real MCP
  client response, not a bare 200. `agents` + AsyncLocalStorage both work on workerd.
- **NEW SITE-WIDE BUG CAUGHT — Workers Static Assets `html_handling`.** Default config **307'd**
  `/technical/torque`, `/archive/colors` and `/models` to their trailing-slash form, while
  production serves all three as **200** at the no-slash URL. Shipping that would have broken every
  canonical and every sitemap entry at once. Fix: `"html_handling": "drop-trailing-slash"` in the
  assets config (same value OECUA landed on). Verified after redeploy: no-slash 200, slashed form
  307s back. **This is now a mandatory line in the Phase 2 wrangler config, not an optional
  nicety.**
- **A1 CONFIRMED as a blocker — but the predicted signature is WRONG.** The probe
  (`server/api/__spike/a1.get.ts`, spike-only, delete before Phase 1) calls `headModelObject()`
  with deliberately fake credentials, so reaching AWS at all would have refuted A1. It never got
  there: `TypeError: Uj is not a function` — a **minified** missing function reference, NOT the
  `notImplemented` throw from `unenv`'s `http.request` that amendment A1 describes. The conclusion
  stands (`client.send()` is unusable on workerd) but the stated mechanism should not be trusted
  when choosing the fix. Recommend the plan's presigned-URL + `fetch()` rewrite over the
  `FetchHttpHandler` one-liner: it removes the SDK's HTTP layer from the path entirely and is
  identical on Node and workerd, so Phase 1 can ship and verify it on Vercel first.
- **Still unrun:** SSE streaming from the langgraph proxy, the KV cache mount, and env-timing
  checks.

#### 2026-08-24 — A1 ROOT CAUSE: `new S3Client()` itself fails; A1's scope AND mechanism are both wrong [contradicts A1 — raises severity] [source: this branch]
Isolating each SDK step on an UNMINIFIED worker build gave the real failure:

```
TypeError: emitWarningIfUnsupportedVersion$1 is not a function
    at getRuntimeConfig (index.js:325615:7)
    at new S3Client (index.js:325697:27)
```

In the bundle: `const no$2 = Symbol.for("node-only"); const emitWarningIfUnsupportedVersion$2 = no$2;`
— that is `@aws-sdk/core`'s **browser** build, where Node-only exports are sentinels rather than
functions. But `@aws-sdk/client-s3` kept its **Node** `getRuntimeConfig`, which calls that sentinel
as a function. A dual-package hazard: the CF preset's `workerd` export condition resolves the two
halves of the SDK to different builds.

- **A1's stated scope is WRONG and too small.** It says "upload finalize breaks". In fact
  `new S3Client()` throws, so **every** S3 operation fails on workerd — `createPresignedPost`
  (browser direct upload), `createModelDownloadUrl` / `getSignedUrl` (downloads), and both
  `.send()` helpers. The entire 3D model library storage layer is dead, not one finalize path.
  An earlier note in this log claimed presigning "should work untouched" — that was wrong; signing
  is pure crypto, but you cannot get to it without constructing a client.
- **A1's stated mechanism is WRONG.** It blames unenv stubbing `node:http`, with `http.request`
  being `notImplemented`. The failure is upstream of any transport and has nothing to do with
  node:http.
- **Fix attempt 1 — presign + `fetch()` instead of `client.send()` (the plan's prescription):
  FAILED.** Still needs `new S3Client()` to produce the signer. Rewriting the two `.send()` call
  sites was necessary but nowhere near sufficient. (The rewrite is kept: it is correct,
  platform-neutral, and removes the SDK transport from the path.)
- **Fix attempt 2 — add `browser` to nitro `exportConditions` on CF builds: FAILED.** Identical
  error, identical line numbers. Reverted; do not re-try without new information.
- **The assumption that may be wrong:** that the AWS SDK can be made to work on workerd through
  bundler configuration at all. The hazard lives in the SDK's own package `exports` map.
- **Recommended direction — drop the AWS SDK from the Workers path entirely** and sign S3 requests
  with **`aws4fetch`** (~4 KB, purpose-built for Cloudflare Workers, SigV4 via SubtleCrypto +
  `fetch`, works on Node 18+ too so it stays platform-neutral). It also removes a large dependency
  from a bundle currently at 4.66 MB gzip. **Cost:** `createPresignedPost` has no aws4fetch
  equivalent — the browser direct-upload POST policy (HMAC-SHA256 over a base64 policy document)
  would need implementing by hand. Bounded, but real, and it touches the upload path that
  `docs/runbooks/2026-06-12-model-library-launch-checklist.md` covers. **This is a Cole decision.**

Also settled this round:
- **GATE 6 PASS — KV works.** `useStorage('cache')` write/read round-trips against a real KV
  namespace bound as `CACHE`, mounted via `nitro.storage` gated on `isCloudflareBuild`.
- **GATE 3 (partial) — SSE transport works.** `/mcp` streams `event: message` frames correctly.
  The langgraph proxy answers 200; true incremental streaming still needs the Phase 1 byte-stream
  fix before it can be asserted.
- **GATE 7 PASS — env timing.** `NUXT_`-prefixed secrets resolve at runtime (`/api/models` returns
  live Supabase rows using only worker-provided secrets).

## TRANSFERABILITY REPORT — OpenECUAlliance pathfinder (2026-08-21 → 2026-08-24)

**Outcome: migration complete, zero downtime, no rollback needed.** oecua.org runs on
Cloudflare Workers; the battery passes 37/37 against production with the Vercel origin
removed entirely. Elapsed: ~3 days wall-clock, roughly a day of actual work. Soak was
skipped by Cole's decision after the C8 preconditions were met.

### The five findings that change cmdiy's plan

Ranked by what they would have cost on a high-traffic production domain.

1. **C1's cert pre-provisioning does not work for full-setup zones — but the gap is
   avoidable.** DCV pre-validation is a partial-zone feature; a full zone gets its cert
   15 min–24 h *after* activation. The fix that worked: **grey-cloud every web record
   before the NS flip.** Cloudflare then answers DNS while traffic still reaches the old
   origin on the old TLS, so the flip is invisible; proxy the records only after the cert
   is Active. This splits cutover into two independently reversible steps and shrinks C6's
   dual-serve window into a non-event. **Adopt this as cmdiy's default sequence.**
2. **A module-scope `setInterval` aborts the Worker at boot.** Not a degraded request — the
   whole worker fails to start, every route dead. The `typeof setInterval !== 'undefined'`
   guard passes and the call still throws. Grep `server/` for module-scope timers before
   cmdiy's spike; this class was absent from the plan's module-scope inventory, which only
   covered config and env reads.
3. **"GH Actions' 16 GB ends the OOM class" is false.** Node caps its own heap near 2 GB
   regardless of runner RAM. The first post-merge deploy died at Nitro bundling. It builds
   fine locally (macOS Node defaults higher), so **this failure only ever appears in CI,
   after merge.** cmdiy's bundle is larger — treat `NODE_OPTIONS=--max-old-space-size=6144`
   in the workflow as mandatory, not optional.
4. **Verification instruments lie, and false alarms are more dangerous than missed checks.**
   Two confident-but-wrong failure reports: a stale *local* resolver claimed a hostname was
   broken while the edge served a correct 301, and Gmail's search index claimed auth emails
   weren't delivering while three sat in the user's inbox. On cmdiy, either would invite an
   unnecessary mid-cutover rollback. **Rule: confirm every negative against the edge
   (`curl --resolve <host>:443:<edge-ip>`) and a public resolver before acting on it.**
5. **Zone creation needs permissions an account-owned token cannot grant.** The account-owned
   token UI has no "Zone" permission at all (`com.cloudflare.api.account.zone.create` is
   unavailable), and the permission-group catalog endpoints are unreadable by such a token.
   Create zones in the dashboard, then grant a **zone-scoped** policy — an account-scoped
   policy alone leaves DNS/SSL/Zone-Settings denied even on existing zones. Budget for
   several token round-trips; this cost the most calendar time of anything here.

### Amendments exercised and their verdicts

| Amendment | Verdict |
|---|---|
| C1 (cert gap) | **Contradicted** — mechanism invalid for full zones; superseded by grey-cloud cutover |
| C2 (BIND import, never quick-scan) | **Softened** — CF's scan imported all 7 records byte-perfect incl. a 218-char DKIM TXT. But only an independent record list could *prove* it. Keep the authoritative dump as the verification oracle, not the import source. cmdiy's SES DKIM **CNAMEs** remain untested — C2's actual worry |
| C3 (Always Use HTTPS + HSTS) | **Validated verbatim** — Vercel's `max-age=63072000` is a platform behavior set nowhere in the repo; matched it exactly |
| C4 (preserve_query_string, proxied-only rules) | **Validated** — Single Redirects fire only on proxied hostnames; query preservation must be explicit |
| C5 (custom domain replaces DNS) | **Sidestepped** — a Worker **route** + proxied dummy origin avoids the destructive record deletion and makes rollback a single `proxied` toggle. Prefer routes over custom domains |
| C6 (~48 h dual-serve) | **Contradicted** — .org delegation TTL was 3600, propagation ~1 h. Measure it (`dig +norecurse NS <domain> @<tld-ns>`); don't assume. Also: **whois updating is not propagation** |
| C8 (Phase 5 preconditions) | **Validated and used** — NS on Cloudflare + battery green were exactly the right gates |
| E4 (local workerd loop) | **Simplified** — wrangler 4.x auto-loads `.env`; no `.dev.vars` needed |
| E5 (pin wrangler with compat date) | **Validated** — pinned in devDependencies and in the workflow |
| Phase 2.7 (`NUXT_`-prefixed secrets) | **Validated empirically** — a `NUXT_*` worker var overrode a build-baked runtimeConfig value at runtime on workerd |
| A-series, B-series, D-series | **Not exercised** — OECUA has no AWS SDK writes, no host-redirect estate, no preview-environment requirement. B1's reasoning was indirectly confirmed: with no host redirects, assets-first needed no `run_worker_first` at all |

### Things cmdiy has that OECUA did not — still unproven

The pathfinder cannot speak to these; treat them as full risk on cmdiy's first attempt:
AWS SDK `client.send()` on workerd (A1), takumi-wasm OG rendering and the 10 MB bundle
ceiling, KV-backed cached handlers and the `swr` coalescing question (E1), the 28-redirect
TME estate and `run_worker_first` (B1), preview environments and their secret sets (D2/D3),
SES DKIM **CNAME** import, and localStorage-based Supabase auth (OECUA used cookie SSR auth
— the *opposite* model, and its auth bug was app-level, not platform-level).

### Cost

**No savings realized.** The Vercel Pro seat stays for classicminidiy.com, so removing OECUA
changes nothing on the invoice; the predicted ~$15/mo materializes only when cmdiy also
leaves. Cloudflare adds **Workers Paid $5/mo** — a real, if small, *increase* until then.
Bundle measured at 3.54 MB gzip, which **exceeds the 3 MiB free-plan cap** (deploy rejected,
error 10027): budget Workers Paid for any real Nuxt SSR property.

### Recommendation

Proceed with cmdiy, with the grey-cloud sequence as the cutover method and the five findings
above folded into the phases. The platform mechanics are proven; what remains untested on
cmdiy is application-level (A-series) and redirect-estate complexity (B-series), which is
where its risk actually concentrates — not in the DNS/TLS mechanics the C-series worried
about, all of which turned out to be either manageable or avoidable.

---

### Amended effort estimate

Phase 1 net change ≈ zero (A2 removes the DoH rewrite; A1 finalize rewrite + A3 dep add fill it).
Phase 2/3 grow by ~half a day each (zone redirect rules, DCV pre-provisioning, BIND import,
secrets×2, preview image gating). The risk register's top entry changes from "static assets shadow
redirects" (now architected away by B1) to "cutover-day TLS/DNS mechanics" (C1/C2/C4/C5), all of
which are now explicit gated steps.
