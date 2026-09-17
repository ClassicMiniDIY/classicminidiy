# 3D Model Library contracts

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/models-3d.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

### 3D Model Library (marketplace)

A community 3D-printable parts library with a Stripe Connect marketplace. Backend lives in
`classicminidiy-supabase` (migrations `20260611*`, edge functions, RLS). Keystone contract:
`classicminidiy-supabase/docs/plans/2026-06-11-3d-model-library.md`. Built on the long-lived
`feature/3d-models` branch (no `modelsEnabled` flag — "launch" = merge to main).

**Load-bearing contracts:**

- **Supabase session is in localStorage, not a cookie.** Any `/api/*` route that needs the
  user must receive an explicit `Authorization: Bearer <access_token>` header (get it from
  `supabase.auth.getSession()`). Direct `useSupabase()` → PostgREST/RPC calls are auto-authed
  and need no Bearer.
- **Payments are thin web proxies → edge functions.** `POST /api/models/[id]/checkout`,
  `/verify-purchase`, and `/api/models/seller/onboard` forward the Bearer token to
  `create-model-checkout` / `verify-model-purchase` / `create-seller-onboarding`. The web
  never calls Stripe directly. Redirect URLs are built from the browser origin and validated
  by the edge functions' allowlist (localhost is allowed for dev).
- **Stripe Connect (model sales) is separate from membership Stripe.** Direct charges on the
  seller's Standard connected account + platform commission via `application_fee_amount`;
  metadata `cmdiy_kind` starts `model_`. Its webhook endpoint + `STRIPE_CONNECT_WEBHOOK_SECRET`
  are distinct from the membership webhook. Do not conflate with the `$1.99/mo` membership.
- **Entitlement is the download gate.** `has_model_entitlement(model_id)` RPC: free/tips and
  owner/admin always true; paid needs a purchase row; `removed`/`flagged` revokes everyone.
  The download route (`/api/models/[modelId]/files/[fileId]/download`) enforces it server-side;
  the detail page reads the RPC client-side to choose download vs. PriceBox.
- **Admin moderation** (`/admin/models`): approve/reject call the `is_admin()`-guarded RPCs
  client-side (admin JWT). Report-resolution (takedown + reporter notification + audit) and
  the seller kill-switch are service-role routes under `server/api/admin/models/`.
- **Contribution management is unified under `/dashboard`** (tabbed: models, gear-configs,
  submissions, selling, purchases). `/models/mine` redirects to `/dashboard/models`.
- New web env: `S3_MODELS_BUCKET`, `S3_MODELS_ACCESS_KEY_ID`, `S3_MODELS_SECRET_ACCESS_KEY`
  (dedicated IAM user, separate bucket from static assets). Launch steps:
  `docs/runbooks/2026-06-12-model-library-launch-checklist.md`.
- **External-model scraper: Printables goes through its GraphQL API, not the page.**
  Bug report 2026-09-17: "Fetch Details" on a public Printables model returned "The preview
  service is busy right now (rate-limited)". Cause: `printables.com` had started answering
  every server-side page fetch with a Cloudflare managed challenge (`cf-mitigated: challenge`,
  403 "Just a moment..."), so the OG/JSON-LD parse saw nothing and every Printables URL fell
  through to the render fallback, then Microlink. `NUXT_MICROLINK_API_KEY` was never set on the
  Worker, so that call ran on Microlink's free tier, which is quota'd per egress IP (Workers
  share theirs) and answers `EPROXYNEEDED` for antibot-protected pages anyway. Fix:
  `server/utils/external-models/printables.ts` queries `api.printables.com/graphql/` (the
  endpoint the Printables front end uses; unauthenticated for public models; not challenged)
  and maps the node straight to listing fields, with richer data than OG ever had (license
  abbreviation, tags, materials, layer heights, gallery images from `media.printables.com`).
  `print: null` is a terminal 404; transport / GraphQL errors return `null` so the old page +
  render chain still gets a turn. Introspection is disabled on that endpoint, so the query's
  field list was verified by hand; a removed field 400s the whole query, which is the fallback
  trigger. Tests: `tests/unit/external-models/scraper.test.ts` ("Printables GraphQL API").
- **Render fallback is Jina Reader, not Microlink (2026-09-17).** Same incident. Microlink's
  paid tier was the only way past its antibot refusal and was not worth the price for this
  feature. `server/utils/external-models/render.ts` now calls `r.jina.ai/<url>` with
  `Accept: application/json` and `X-Target-Selector: head`: the body is ~25 tokens and
  `data.metadata` still carries the full `<meta>` set, so the free 10M-token allowance is
  effectively unlimited here. `NUXT_JINA_API_KEY` (runtimeConfig `JINA_API_KEY`) lifts the
  keyless 20 req/min cap to 200; `JINA_READER_URL` is the plain-var endpoint override. Live
  result on cutover day: MakerWorld and MyMiniFactory render through the Cloudflare challenge;
  Cults3D still returns the "Just a moment..." interstitial (with upstream 200, so the title
  is the only tell) and GrabCAD is still CloudFront-403. The renderer therefore rejects three
  shapes rather than storing them: upstream `httpStatus >= 400`, an interstitial title, and a
  result with no title at all (MakerWorld's soft-404 has a default share image and no title).
  The exchange Finds parser (`server/api/exchange/external-listings/parse.post.ts`) shares
  this renderer and inherits the change.
- **Cults3D goes through its authenticated GraphQL API (2026-09-17).** Cults3D pages are
  Cloudflare-challenged for a plain fetch AND for the Jina render ("Just a moment..." with
  upstream 200), so `server/utils/external-models/cults3d.ts` is the only working path. The
  API (`cults3d.com/graphql`, introspection enabled) takes HTTP Basic auth with a Cults3D
  username + the account's API key: runtimeConfig `CULTS_3D_USER` / `CULTS_3D_API_KEY`,
  Worker secrets `NUXT_CULTS_3D_USER` / `NUXT_CULTS_3D_API_KEY`. Lookup is `creation(slug:)`
  with the slug the site `urlPattern` already captures as the external id. Findings that
  shaped the adapter: `description` + `details` are CRLF plain text (joined for the listing);
  `license` carries Cults' own `code`, an SPDX id and `allowsCommercialUse`, and Cults marks
  CC0 non-commercial, so CC licenses derive from the SPDX id via `license.ts` and only the
  Cults-specific codes (`cults_pu` = no remix/no commercial, `cults_cu`, `cults_cu_nd`) use
  the flag; the `version: DEFAULT` originals on `fbi.cults3d.com` are served
  `application/octet-stream`, which the submit route's image re-host skips, so the adapter
  keeps the 516px `images.cults3d.com` thumbnails; Cults' Cloudflare rules 1010-blocked
  Python's default User-Agent, so the request sends an explicit product UA. `safe: false`
  (NSFW) and non-`PUBLIC` visibility are refused with 422 rather than queued for moderation.
  `API_ADAPTERS` in `index.ts` is the table both adapters hang off; `deps.apiImpl` is the
  single test seam for either.
