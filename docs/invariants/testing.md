# Test tiers, E2E runner, runtime traps, dependency pins

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/testing.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### The three test tiers, and what each one alone cannot see

Design doc: `docs/plans/2026-08-30-hardening-and-e2e.md`.

1. **Unit** (`tests/unit/**`, `bun run test`) — 174 files, 5,000+ assertions.
   Exercises units. It has never rendered a route, which is the gap the other
   two tiers exist to close.
2. **Static invariants** (`tests/static/**`) — filesystem-level contract checks
   that run inside the same `bun run test`, so they gate PRs at ~1.4s and no CI
   cost. i18n locale completeness, hydration-safe auth branches, the
   client↔server API contract, dynamic-route 404s, getter-form `useFetch`, and
   the plain Worker env registry.
3. **Rendered** — `scripts/smoke-routes.mjs` (every route, HTML assertions) and
   `tests/e2e/**` (Playwright, chromium + firefox).

- **Every allowlist in tiers 2 and 3 is SHRINK-ONLY, and that is the whole
  point.** Each check is seeded with today's known violations so it is green on
  day one. A NEW violation fails — and an allowlist entry that stops
  reproducing ALSO fails. So a fix cannot merge without deleting its own entry,
  and the allowlists stay a live inventory of remaining debt instead of a place
  things go to be forgotten. `KNOWN_UNGATED`, `KNOWN_MISSING_LOCALES`,
  `KNOWN_MISSING_ROUTES`, `KNOWN_SOFT_404_PAGES`, `KNOWN_GETTER_FORM_USEFETCH`,
  `KNOWN_ERRORS`. Never add an entry to make a check pass — the entry is a
  promise to come back.

- **`hydration-auth-gates.test.ts` walks the real template AST, not a regex.**
  It must understand nesting: a branch inside `<ClientOnly>`, or inside a
  subtree already gated by a `hasMounted`-derived name, is safe. A regex version
  reported `MainNav` as broken, because its `v-if="userProfile?.avatar_url"`
  sits inside `v-if="isSignedIn"`.

- **Route-crawler manifest: static routes are DERIVED from `app/pages/**`,
  dynamic ones are sampled from `/api/__sitemap__/*`.** Nothing is hand-listed
  that a filename or the live site can supply, so the manifest cannot rot. Only
  expectation overrides and the redirect/404 sets are written by hand.
  Consequence worth knowing: if a sitemap source endpoint breaks, the crawler
  reports it — and the sitemap is broken too.

- **Strip HTML comments before any crawler content check.** SSR ships template
  comments, and `/chat` documents the historical nuxt-schema-org failure in a
  comment that quotes the error string verbatim. Without stripping, the crawler
  reports the documentation as the defect.

#### E2E is a separate runner, on purpose

- **Playwright has its own `playwright.config.ts`; do NOT fold it into
  `vitest.config.ts` or reach for `@nuxt/test-utils`.** The unit config maps
  `~` to the REPO ROOT (real Nuxt maps it to `app/`), sets
  `fileParallelism: false`, rewrites `import.meta.client` at transform time, and
  loads a setup file that stubs `fetch` to **reject**. Every one of those is
  correct for unit tests and fatal for a browser suite. `tests/e2e/**` is
  excluded from vitest discovery for the same reason — its specs import
  `@playwright/test`, which has no vitest runtime.

- **The Firefox project is not redundant coverage.** Hydration-mismatch repair
  is browser- and timing-dependent, and the nav dropdown bug reproduced ONLY in
  Firefox while every Chromium verification passed. Keep both projects.

- **Never use `waitForLoadState('networkidle')` in these specs — use
  `gotoHydrated` from `tests/e2e/_helpers.ts`.** `/login` mounts a Turnstile
  widget that holds a connection open, so the network never idles and the wait
  burns its full timeout on a page that hydrated in 118 ms. The helper waits for
  `__vue_app__` on `#__nuxt`, which Vue sets when `app.mount()` completes —
  exactly when hydration has finished and any mismatch warning has already been
  logged. Switching took the suite from 1.8 min with 6 failures to 22 s with 0.

- **The dev server needs `NODE_OPTIONS=--max-old-space-size=8192` for a full E2E
  run.** At the default heap its SSR worker dies partway through with `Worker
terminated due to reaching memory limit: JS heap out of memory`, after which
  EVERY route 500s and the remaining failures are noise unrelated to the code
  under test. Set in `playwright.config.ts` and both workflows. Same class of
  limit the production build already carries.

- **`/mcp` stays out of E2E scope.** mcp-toolkit picks its transport provider at
  BUILD time from the Nitro preset, so a dev-server run exercises the Node
  provider and proves nothing about the deployed Cloudflare one.
  `scripts/test-mcp-transport.sh` is the only gate that can.

#### Runtime traps this pass surfaced

- **A dependency that reads `global.*` at MODULE SCOPE breaks the whole route on
  Workers.** `vuedraggable@4.1.0` runs `var console = getConsole()` at module
  scope, falling back to `global.console` when `window` is undefined; workerd's
  webpack `global` shim resolves to `undefined`, so EVALUATING it in an SSR'd
  route chunk throws `Cannot read properties of undefined (reading 'console')`
  and 500s that route. It is present in the built artifact as
  `function r(){return w.console}` inside `chunks/_/vuedraggable.umd.min.mjs`.
  **Dev is unaffected**, which is exactly why it went unnoticed — only the
  production route crawl found it. Import such a library behind a dynamic
  `import()` AND render it inside `<ClientOnly>` (see
  `app/pages/admin/marketing.vue`), and verify on a real Worker
  (`wrangler dev .output/server/index.mjs --local`), never in dev.

  **What decides whether it fires is EVALUATION, not import style.** For a while
  `PhotoUploadSection.vue` imported vuedraggable statically and
  `/exchange/listings/new` was fine — because that component sits on a later
  wizard step and its chunk was never evaluated during SSR. That was a property
  of the step layout, not a guarantee: rendering it on step 1, or a bundler
  hoisting it into the page chunk, would have 500'd the PAID listing flow. Both
  call sites are now async + `<ClientOnly>`. Do not read "it works today" as "a
  static import is safe" — verify on a real Worker.

- **Nitro registers EVERY file under `server/api/` and `server/routes/` as a
  route.** Its scan glob is `**/*.{js,mjs,cjs,ts,...}` with no underscore
  exclusion, so a helper module parked in the route tree becomes a publicly
  reachable route with no handler behind it. Shared helpers belong in
  `server/utils/`. `tests/static/api-contract.test.ts` enforces this.

#### Intentional dependency pins (do not blindly bump)

- **`nuxt` is on `~4.5.2`. The 4.4.8 hold is LIFTED — do not reinstate it.** It was held
  because Nuxt 4.5's head-pipeline change broke `nuxt-schema-org` (via `@nuxtjs/seo`): every
  SSR request threw `unhandledRejection ... reading 'resolveGraph'/'push'` and ALL schema.org
  JSON-LD rendered as an EMPTY `<script type="application/ld+json">`, silently killing the GEO
  structured-data work (upstream: https://github.com/harlan-zw/nuxt-seo/issues/588). That no
  longer reproduces on nuxt 4.5.2 with the current `@nuxtjs/seo`: a built page carries a full
  `@graph`, and `/chat` renders two non-empty blocks. **If you touch the nuxt or `@nuxtjs/seo`
  version, re-verify JSON-LD is non-empty on a BUILT page** — that check is the whole reason
  this note exists, and an empty `ld+json` is silent.

  The other 4.5 breakages are fixed in-tree, not worked around: rolldown-vite requires
  function-form `manualChunks` + `cssMinify: 'esbuild'` (lightningcss chokes on daisyUI
  `round(to-zero, ...)`), highcharts-vue's UMD default import needs the install-unwrap in
  `app/plugins/highcharts.ts`, and `await useFetch(() => '/url')` — the getter form — stops
  blocking async setup, so SSR renders the pending branch and hydration hangs. Both call
  sites are converted: `Needles.vue` to a plain string (its URL was static), and
  `ModelComments.vue` to a **computed ref**, which it needs rather than a string because
  `/models/[slug]` reuses that component across model navigations, so `props.modelId`
  changes in place. `useFetch` wraps its request in `computed(() => toValue(request))`, so a
  computed ref keeps the reactivity a getter gave. **Do not reintroduce the getter form.**

  This note previously claimed "both call sites are converted". That was wrong — a repo
  sweep found **three** more (`app/pages/models/[slug].vue`, `models/external/[slug].vue`,
  `app/components/NeedleTable.vue`), all since converted. Note also that those three were
  NOT visibly broken: their 404s fired and their pages rendered. The form is forbidden
  because the breakage is version- and context-dependent and gives no error to search for,
  not because every instance misbehaves today. `tests/static/ssr-contracts.test.ts` now
  enforces the rule so the count cannot drift again.

- **`dompurify` is pinned to an exact version (currently `3.4.14`), and
  `tests/unit/exchange/utils/markdown.test.ts` MUST stay on `@vitest-environment jsdom`.**
  These two facts are one contract — don't change either in isolation. Since 3.4.8
  DOMPurify walks the DOM with a node iterator that happy-dom mis-implements, and the
  failure is silent-unsafe rather than noisy: under happy-dom, `sanitize()` returns
  markup with a live `javascript:` href intact, drops allowlisted tags, and never fires
  the `afterSanitizeAttributes` link-hardening hook. Under happy-dom the XSS suite is
  therefore asserting nothing. jsdom reproduces real-browser output byte-for-byte
  (verified against Chrome on 3.4.12 — the 3.4.14 bump was checked against the 61-test
  XSS suite on jsdom, not re-compared against Chrome), so that file — and any future test
  that exercises DOMPurify — runs on jsdom while the rest of the suite keeps the happy-dom
  default from `vitest.config.ts`. happy-dom 20.11.12 is still affected; recheck before
  "simplifying" the env back. The exact pin (no `^`) is deliberate: a DOMPurify bump is a security
  change and should be a visible, tested commit, not a silent range resolution.
- **`@takumi-rs/core` AND `@takumi-rs/wasm` stay on 1.x, at the same version.** 2.x breaks
  branded OG image rendering. They are a pair: `core` is the native binding used by the Node
  and Vercel builds, `wasm` is the one the **Cloudflare Workers** preset needs, because a
  native module cannot be bundled into a worker. `wasm` was missing entirely until 2026-08-26
  — declared nowhere, installed nowhere — so `NITRO_PRESET=cloudflare_module` died at the
  Nitro bundling step with `Cannot resolve "@takumi-rs/wasm/no-bundler" ... and externals are
not allowed!`. It surfaced only when CI first got far enough to reach bundling; before that
  the build failed earlier, on the sitemap sources. Keep both on the same version — bumping
  one alone is untested.
- **`@types/node` stays on 25.x** while `engines.node` is `^24` (26.x types target Node 26 APIs).
