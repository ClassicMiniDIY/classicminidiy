---
paths:
  - 'tests/**'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/setup/vitest.setup.ts'
  - 'scripts/smoke-routes.mjs'
  - 'package.json'
  - 'app/plugins/highcharts.ts'
  - 'app/pages/admin/marketing.vue'
  - 'app/components/exchange/**/PhotoUploadSection.vue'
---

# Testing and dependency rules

Detail: `docs/invariants/testing.md`. Design doc: `docs/plans/2026-08-30-hardening-and-e2e.md`.

- Three tiers: unit (`tests/unit/**`), static invariants (`tests/static/**`, same `bun run test`, ~1.4s), rendered (`scripts/smoke-routes.mjs` + `tests/e2e/**` Playwright chromium+firefox).
- **Every allowlist in tiers 2 and 3 is SHRINK-ONLY.** A new violation fails and an entry that stops reproducing also fails. Never add an entry to make a check pass (`KNOWN_UNGATED`, `KNOWN_MISSING_LOCALES`, `KNOWN_MISSING_ROUTES`, `KNOWN_SOFT_404_PAGES`, `KNOWN_GETTER_FORM_USEFETCH`, `KNOWN_ERRORS`).
- `hydration-auth-gates.test.ts` walks the template AST and understands nesting; do not regress it to a regex.
- The route manifest derives static routes from `app/pages/**` and samples dynamic ones from `/api/__sitemap__/*`; strip HTML comments before content checks.
- Playwright has its own config; never fold it into vitest or use `@nuxt/test-utils`. Keep the Firefox project. Use `gotoHydrated` from `tests/e2e/_helpers.ts`, never `networkidle`. The dev server needs `NODE_OPTIONS=--max-old-space-size=8192` for a full run. `/mcp` stays out of E2E scope.
- A dependency that reads `global.*` at module scope (vuedraggable) 500s an SSR'd route on Workers but not in dev: dynamic `import()` + `<ClientOnly>`, verified on `wrangler dev --local`. Evaluation decides, not import style.
- Nitro registers every file under `server/api/` and `server/routes/` as a route; helpers go in `server/utils/` (`api-contract.test.ts`).
- Pins: `nuxt ~4.5.2` (the 4.4.8 hold is LIFTED; re-verify JSON-LD is non-empty on a BUILT page if you touch nuxt or `@nuxtjs/seo`); `dompurify` exact `3.4.14` and `tests/unit/exchange/utils/markdown.test.ts` on `@vitest-environment jsdom` (happy-dom is silently UNSAFE for DOMPurify); `@takumi-rs/core` and `@takumi-rs/wasm` on the same 1.x (wasm is what the Workers build needs); `@types/node` 25.x. rolldown-vite needs function-form `manualChunks` + `cssMinify: 'esbuild'`; highcharts-vue needs the unwrap in `app/plugins/highcharts.ts`.
