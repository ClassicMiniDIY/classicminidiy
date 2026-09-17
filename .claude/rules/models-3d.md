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
- **External-model scraper (`server/utils/external-models/`):** Printables is fetched through its public GraphQL API (`printables.ts`) FIRST; its HTML pages have answered server fetches with a Cloudflare challenge since 2026-09, so the page + render chain is only its fallback. Thingiverse still parses direct. Every other site falls back to Jina Reader (`render.ts`, metadata-only via `X-Target-Selector: head`, key `NUXT_JINA_API_KEY`); it passes the challenge on MakerWorld and MyMiniFactory, not on Cults3D or GrabCAD. A render result with no title, an upstream 4xx, or an interstitial title ("Just a moment...") is blocked, never stored. Never route Printables back through the page scrape.
