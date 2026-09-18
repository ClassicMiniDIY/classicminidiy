---
paths:
  - 'app/pages/models/**'
  - 'app/components/models/**'
  - 'app/pages/dashboard/**'
  - 'server/api/models/**'
  - 'server/api/admin/models/**'
  - 'server/utils/external-models/**'
---

# 3D Model Library rules

Detail: `docs/invariants/models-3d.md`. Keystone: `classicminidiy-supabase/docs/plans/2026-06-11-3d-model-library.md`.

- The Supabase session is in localStorage; any `/api/*` route that needs the user takes an explicit `Authorization: Bearer <access_token>`. Direct `useSupabase()` PostgREST/RPC calls need none.
- Payments are thin proxies to edge functions (`create-model-checkout`, `verify-model-purchase`, `create-seller-onboarding`); the web never calls Stripe directly.
- Stripe Connect (model sales, direct charges + `application_fee_amount`, `cmdiy_kind` starts `model_`, own webhook secret) is separate from the membership Stripe. Never conflate.
- `has_model_entitlement(model_id)` is the download gate, enforced in the download route; `removed`/`flagged` revokes everyone.
- Admin approve/reject use the `is_admin()` RPCs client-side; takedowns and the seller kill-switch are service-role routes under `server/api/admin/models/`.
- `/models/mine` redirects to `/dashboard/models`. Model-category icons are stored in Iconify form and converted on read in `app/pages/models/index.vue` (deliberate).
- **The SSRF guard resolves over DNS-over-HTTPS, never `node:dns` (`server/utils/external-models/ssrf.ts`).** workerd's `dns.lookup()` hands back CNAME targets as addresses, and the guard refuses a non-IP (fail closed), so under `node:dns` every CNAME-fronted host (Facebook, eBay, Copart, most `www.`) was rejected with "That URL could not be fetched" while bare-A apexes worked. `resolveHost` queries `cloudflare-dns.com/dns-query` for A + AAAA and keeps only types 1 and 28. Both the Finds parser and the external-model submit route sit behind it. Story: `docs/invariants/models-3d.md`.
- **External-model scraper (`server/utils/external-models/`):** `API_ADAPTERS` in `index.ts` run FIRST for sites with a first-party API: Printables (`printables.ts`, public GraphQL, no key; the Worker's shared egress IPs are 429-throttled by that API, so on a direct failure the same query goes as a GET through Jina Reader via `readThroughReader`; never remove that fallback) and Cults3D (`cults3d.ts`, GraphQL with HTTP Basic `NUXT_CULTS_3D_USER` + `NUXT_CULTS_3D_API_KEY`; without them Cults3D links cannot be listed at all, since its pages are challenged on every path). Both sites' HTML pages answer server fetches with a Cloudflare challenge, so the page + render chain is only their fallback. Thingiverse still parses direct. Every other site falls back to Jina Reader (`render.ts`, metadata-only via `X-Target-Selector: head`, key `NUXT_JINA_API_KEY`); it passes the challenge on MakerWorld and MyMiniFactory, not on GrabCAD. License flags on the API paths come from `license.ts`, never the registry default when the site reports a real license. A render result with no title, an upstream 4xx, or an interstitial title ("Just a moment...") is blocked, never stored. Never route Printables back through the page scrape.
