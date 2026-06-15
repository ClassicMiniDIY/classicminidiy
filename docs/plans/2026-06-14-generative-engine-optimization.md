# Generative Engine Optimization (GEO) — classicminidiy.com

> Status: in progress. Phase 1 on `feature/geo-foundation`. Each phase ships as its own PR.

## Context

GEO (Generative Engine Optimization) — also called AEO (Answer Engine Optimization) — is the
discipline of making a site surface and get **cited** inside AI-generated answers (Google
**AI Overviews / AI Mode**, ChatGPT Search, Perplexity, Gemini, Claude), versus classic SEO which
optimizes for blue-link rankings. It is *not* a single Google product announcement, and (reality
check from current research) **it is not "just add llms.txt."**

classicminidiy.com owns an unusually strong GEO asset — a deep body of **authoritative, factual,
structured reference data** (torque specs, clearances, SU needles, chassis/engine decoders, engine
specs, weights, parts equivalency, paint colors, wheel fitment). That is exactly what generative
engines prefer to cite. The site already has a solid classic-SEO baseline (~80%). This plan closes
the GEO-specific gaps so the content becomes the *cited source* when enthusiasts ask AI engines
about Classic Minis.

### What actually moves the needle (research-ranked, mid-2026)
1. **Crawler access** for AI answer/search bots (binary: you're in the knowledge base or invisible).
2. **Structured data** — FAQPage / HowTo / QAPage / Article / Dataset / ItemList. (Google retired the
   *classic rich-result UI* for FAQ/HowTo, but the markup still measurably boosts LLM extraction &
   citation — valid FAQ/HowTo/QAPage schema appears ~20–30% more often in AI summaries.)
3. **Answer-first content** — quick-answer blocks above the fold, "Top-N"/listicle + **tables**
   (tables and lead sentences are extracted preferentially by LLMs).
4. **Entity / authority signals** — Person (author) E-E-A-T, `sameAs`, consistent brand entity.
5. **Complete sitemap + prerender/SSR coverage** so every detail page is discoverable.
6. **llms.txt** — *low priority*. Google has said it won't consume it, most crawlers skip it,
   adoption ~10%. Cheap insurance + a Business-to-Agent surface, not the centerpiece.

## Decisions locked
- **Module architecture:** adopt the **`@nuxtjs/seo` umbrella** (typed `nuxt-schema-org` graph,
  automatic self-referencing canonicals, `@id`-linked entities).
- **AI crawler policy:** **allow answer/search bots, block bulk training crawlers.**
- **Authorship:** **named founder entity (Cole Gentry)** — Person schema + `/about` + bylines.

## Current state (audit summary)
**Good:** SSR on; site-wide WebSite+Organization+SearchAction; many pages already hand-roll solid
JSON-LD (TechArticle+Dataset on `technical/torque.vue`, DigitalDocument on
`archive/documents/[slug].vue`, Product via `app/composables/useModelSeo.ts`); core/technical pages
prerendered; clean cacheable reference APIs; nuxt-llms + nuxt-og-image already installed.

**Gaps to fix:**
- **Canonical bug (highest priority):** `nuxt.config.ts` hardcodes a global
  `canonical → https://classicminidiy.com`; ~37 of 67 pages never override it, declaring themselves
  duplicates of the homepage. `useSeoMeta` does **not** emit a canonical `<link>`.
- **Fake hreflang:** `hreflang="en"`/`"x-default"` both point at the bare homepage. With i18n
  `strategy:'no_prefix'` there are no per-locale URLs → real hreflang is impossible. **Remove.**
- **Dead SearchAction:** the WebSite `SearchAction` targets `/search?q=` — no such page exists. **Drop.**
- **Zero** FAQPage / HowTo / QAPage / VideoObject / Person(author) schema anywhere.
- **Sitemap** only emits published `/models/[slug]`. Missing: colors, wheels, documents, registry.
- **OG images** only on `/models/[slug]`; everything else falls back to one static S3 image.
- **Calculators** (`needles`, `gearbox`) are `prerender:false` + JS-only → crawlers see no content.
- **llms.txt** is link-only; omits the model library, detail pages, and any body content.
- **No author/E-E-A-T entity** (Organization has `sameAs` but no `founder` Person).

## Architecture

### Module adoption (`@nuxtjs/seo` 5.x)
Bundles `@nuxtjs/sitemap` 8.2, `@nuxtjs/robots` 6.1, `nuxt-og-image` 6.6, `nuxt-schema-org` 6.2,
`nuxt-seo-utils`, `nuxt-link-checker`, `nuxt-site-config` — all supersets of what's pinned. Remove the
three separately-installed sub-modules from `modules[]` + `package.json`; add `@nuxtjs/seo`. Existing
`site:`/`sitemap:`/`robots:` blocks carry over. The robots module's **default** `robotsEnabledValue`
is already `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` — identical
to the static meta, so the static robots meta is removed (the module reproduces it). The 22 hand-rolled
JSON-LD pages keep working (two LD+JSON blocks per page is valid) → incremental migration, no big-bang.

### Reusable helpers (Phase 2)
- `app/composables/useGeoSeo.ts` — orchestrator (canonical from `useSiteConfig().url + path`,
  `useSeoMeta`, optional OG image, optional schema node(s)), modeled on `useModelSeo.ts`.
- `app/utils/schema/*.ts` — pure builders fed to `useSchemaOrg` (raw nodes integrate into the `@id`
  graph): `itemList`, `dataset`, `techArticle`, `faqPage`, `howTo`, `person`.

### FAQ/HowTo generated from existing data (Phase 2)
`app/utils/geo/generateFaqs.ts` — one generator per source (`chassisFaqs` ← `data/models/decoders.ts`,
`engineCodeFaqs` ← `data/engineCodes.json`, `clearanceFaqs`, `torqueFaqs`, `needleFaqs`). Both the
visible above-the-fold block (`app/components/geo/QuickAnswer.vue`) and the FAQPage JSON-LD are
generated from the **same** `{q,a}` array so they can't drift (cap ~15 entries). Answers render as
data (English-only domain data → sidesteps the 10-locale/no-HTML-in-messages i18n rules); only the
~6 question *templates* per page go through `t()` with a single `{name}` param.

### Crawler access (robots groups) — allow answers, block training (Phase 2)
- **Allow:** `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-User`,
  `Claude-SearchBot`, `Googlebot`, `Bingbot`, `DuckDuckBot`, `Applebot`, `Amazonbot`.
- **Disallow:** `GPTBot`, `ClaudeBot`, `anthropic-ai`, `CCBot`, `Google-Extended`,
  `Applebot-Extended`, `Bytespider`, `Meta-ExternalAgent`.
- ChatGPT cites via OAI-SearchBot/ChatGPT-User (not GPTBot); Claude via Claude-User/Claude-SearchBot
  (not ClaudeBot); Google **AI Overviews use the normal Googlebot index**, so blocking
  `Google-Extended` opts out of *Gemini training* without removing you from AI Overviews.

### Edge enforcement (Vercel WAF + BotID) (Phase 3)
robots is advisory; enforce the same split at the edge.
- **WAF custom Deny rules** by `user_agent`/`Signature-Agent` for the bulk-training tokens that hit
  the edge (`GPTBot`, `ClaudeBot`, `anthropic-ai`, `CCBot`, `Bytespider`, `Meta-ExternalAgent`,
  `Diffbot`, `Omgilibot`, `ImagesiftBot`). **Do not** flip the all-or-nothing managed *AI-Bots
  ruleset* to Deny — it would also block the answer-bots we allow; set it to **Log**.
  `Google-Extended`/`Applebot-Extended` are training-permission tokens (no edge UA) → robots-only.
- Single source of truth `server/utils/aiBots.ts` (allow/deny UA lists) shared by robots + analytics.
- Manage rules as code via `vercel firewall` CLI / the "Block AI Bots Firewall Rule" template;
  runbook `docs/runbooks/2026-06-14-ai-crawler-firewall.md`.
- **BotID** (`@vercel/botid`: `initBotId()` + `checkBotId()`) on abuse-prone write endpoints —
  `/api/langgraph/**` chat proxy (Deep mode if on Pro), `/contribute/**`, checkout/onboarding.
  Complements existing Turnstile + rate-limit. Exclude sitemap/og/robots/llms paths from challenges.

### Sitemap + prerender completeness (Phase 4)
Add `server/api/__sitemap__/{colors,wheels,documents,registry}.ts` (mirroring `urls.ts`; registry =
approved only); register in `sitemap.sources`. Detail pages stay SSR (optional `routeRules` ISR).
Calculators stay `prerender:false` — `QuickAnswer.vue` SSR block is the crawler fix.

### Authority / E-E-A-T (Phase 5)
`app/utils/schema/person.ts` → founder Person (`@id`, `sameAs`, `jobTitle`, `knowsAbout`).
Organization references `founder @id`; swap placeholder TechArticle `author` to the real Person `@id`.
New `app/pages/about.vue` (Person schema, bio, `prerender:true`); visible bylines linking to `/about`.

### Measurement (Phase 6, reuse PostHog + GSC + middleware)
`app/plugins/posthog.ts` → classify `document.referrer` into an `ai_source` super-property;
`app/composables/useAnalytics.ts` → `trackAiReferral()`. New `server/middleware/bot-analytics.ts` →
server-side `bot_crawl` capture for known AI bots (never block). Verify Search Console; build a
PostHog dashboard (project 309759).

### hreflang — intentionally removed, not added
`no_prefix` = one URL per page (locale via the `i18n_redirected` cookie). Real hreflang needs distinct
per-locale URLs, which don't exist. Remove the misleading tags; keep `<html lang>` accurate. English
is the authoritative locale for the domain data. Per-locale SEO would need a `prefix_except_default`
migration — out of scope.

## Phased delivery (each phase = one `feature/*` PR)

### Phase 1 — Foundation (`feature/geo-foundation`)  ← highest ROI
Fixes the ~37 broken canonicals + establishes the base graph. (Reusable `useGeoSeo`/builders moved to
Phase 2, where pages consume them, to keep this PR tight.)
- `nuxt.config.ts`: add `@nuxtjs/seo`; remove the 3 sub-modules (config + `package.json`); remove the
  hardcoded global `canonical` + fake `hreflang`; remove the static robots meta (module reproduces it);
  remove hand-rolled WebSite+Org `<script>`; fix `site.name` (was a paragraph) + add `site.description`.
- `app/app.vue`: add `useSchemaOrg([defineOrganization(...), defineWebSite(...)])` base graph (no
  SearchAction — no `/search` page).
- `app/pages/index.vue`: drop duplicate WebSite/Org JSON-LD + hardcoded canonical.
- **Verify:** every page emits exactly one self-referencing canonical + one base-graph node; build green.

### Phase 2 — Structured data + crawler access (`feature/geo-structured-data`)  ← where GEO lands
`useGeoSeo` + `app/utils/schema/*` + `generateFaqs.ts` + `QuickAnswer.vue`; wire into
`technical/*` (FAQPage/Dataset/HowTo) + archive wheel/color detail (Product/ImageObject) + `models`
index (ItemList + canonical); robots groups.

### Phase 3 — Edge enforcement (`feature/geo-edge-enforcement`)
Vercel WAF Deny rules + managed ruleset → Log; `server/utils/aiBots.ts`; `@vercel/botid` on write
endpoints; runbook.

### Phase 4 — Completeness (`feature/geo-sitemap-llms`)
Sitemap sources for colors/wheels/documents/registry; enrich `llms:` config; optional ISR.

### Phase 5 — Authority / E-E-A-T (`feature/geo-authority`)
`/about` + founder Person; Organization `founder @id`; bylines.

### Phase 6 — Measurement (`feature/geo-measurement`)
`ai_source` super-property; `trackAiReferral()`; `bot-analytics.ts`; PostHog dashboard; GSC.

## Verification
- **Build:** `bun run build` green after each phase (watch `unplugin-vue-i18n` HTML-in-message hard-fail).
- **Schema:** Google Rich Results Test + schema.org validator; one self-referencing canonical per page.
- **robots:** `/robots.txt` — answer-bots allowed, training bots disallowed; sitemap/og reachable.
- **WAF/BotID:** `curl -A 'GPTBot'` → 403, `curl -A 'PerplexityBot'` → 200; sitemap/og still 200;
  scripted hit to a protected endpoint rejected, real users pass.
- **Sitemap:** `/sitemap.xml` includes color/wheel/document/registry detail URLs.
- **QuickAnswer SSR:** raw HTML of a calculator route contains the answer text + table.
- **OG/llms:** `/llms.txt` + `/llms-full.txt` contain new sections + FAQ bodies.
- **Tests:** Vitest for `app/utils/schema/*` + `generateFaqs.ts`.
- **Measurement:** PostHog `ai_source` populates on a referred visit; `bot_crawl` fires for a spoofed UA.

## Non-goals
- Per-locale URLs / real hreflang (would need `prefix_except_default`).
- Prerendering the interactive calculators (QuickAnswer SSR block is the alternative).
- Aggressive llms.txt investment.

## References (mid-2026)
- AI crawler UA landscape & robots strategy: agentsurge.io, cubitrek.com, nohacks.co, citevera.com.
- llms.txt reality check: presenc.ai/research/state-of-llms-txt-2026, codersera.com, wix.com.
- GEO + FAQ/HowTo/QAPage still boosting AI summaries: frase.io, gen-optima.com, llmrefs.com.
- Nuxt schema.org: nuxtseo.com/docs/schema-org.
- Vercel edge enforcement: vercel.com/docs/bot-management, /docs/vercel-firewall, /docs/botid.
