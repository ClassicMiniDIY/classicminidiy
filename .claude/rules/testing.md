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
- **An E2E selector must not be able to match site chrome.** `a[href^="/exchange/listings/"]` also matches the header CTA and the nav dropdown's Sell link, which is in the DOM, earlier in document order and permanently invisible; `.first()` picked it and the test burned its full 90s waiting for a closed menu item to become clickable. Select the thing under test by `data-testid` (`listing-card`, `listings-empty`), never by a URL prefix the nav shares.
- **A ClientOnly, client-fetched region needs the fetch to LAND before a `count() === 0` skip.** Reading zero right after hydration makes the test skip itself — a silent false pass, worse than the failure it hides. Poll until either the content or its empty state exists, then skip only on the empty state.
- **A test that names a tier, plan or plan-order literally goes stale the day one is added.** `chat.spec.ts` asserted the reset copy against `member`, which stopped being the top tier when Plus and Pro shipped, and the nightly went red on correct code. Derive from `CHAT_TIER_ORDER` / `nextTier` in `shared/utils/chatTiers.ts`; E2E specs may import that module directly (pure constants, no Nuxt runtime).
- A dependency that reads `global.*` at module scope (vuedraggable) 500s an SSR'd route on Workers but not in dev: dynamic `import()` + `<ClientOnly>`, verified on `wrangler dev --local`. Evaluation decides, not import style.
- Nitro registers every file under `server/api/` and `server/routes/` as a route; helpers go in `server/utils/` (`api-contract.test.ts`).
- Pins: `nuxt ~4.5.2` (the 4.4.8 hold is LIFTED; re-verify JSON-LD is non-empty on a BUILT page if you touch nuxt or `@nuxtjs/seo`); `dompurify` exact `3.4.15` and `tests/unit/exchange/utils/markdown.test.ts` on `@vitest-environment jsdom` (happy-dom is silently UNSAFE for DOMPurify); `@takumi-rs/core` and `@takumi-rs/wasm` on the same 1.x (wasm is what the Workers build needs); `@types/node` 25.x; **`typescript` exact `6.0.3`** — `vue-tsc` 3.3.11 resolves `typescript/lib/tsc`, which TS 7 (the native port) does not export, so vue-tsc dies with `ERR_PACKAGE_PATH_NOT_EXPORTED` and `scripts/typecheck.mjs` then reports zero errors; wait for a vue-tsc that supports TS 7 and move both together. `scripts/typecheck.mjs` now fails when the checker emits NO diagnostics while the baseline is non-zero — never lower BASELINE on a run that checked 0 files. A test must not depend on whether a lazy `import()` has resolved: take a fresh module (`vi.resetModules()` + `await import(...)`) instead — under vitest 5 the full-suite run and `test:coverage` both silently moved the markdown 'server path' tests onto the client path. The cause is NOT the pool (resolved config is `forks` either way); do not pin one. rolldown-vite needs function-form `manualChunks` + `cssMinify: 'esbuild'`; highcharts-vue needs the unwrap in `app/plugins/highcharts.ts`.
