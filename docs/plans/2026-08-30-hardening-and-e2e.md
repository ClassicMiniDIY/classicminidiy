# Repo hardening: static invariants, a route crawler, and browser flow coverage

**Date:** 2026-08-30
**Status:** harness shipped; findings tracked as issues under the
`Hardening pass 2026-Q3` milestone.

## Why

The unit suite is large — 174 files, 5,135 assertions — and it exercises
**units**. Before this work nothing booted the app, walked a route, or asserted
that a page renders: **5 of 263 `.vue` files had any test at all.**

Every production incident of the last six months landed in exactly that gap.
`/mcp` 500'd on every authenticated call for months with a green suite. Paid
`/exchange` listings sat in `draft` from the TME cutover until 2026-08-12
because the admin approve routes the client called did not exist. All seven
`.atom` endpoints 500'd because the one Atom test ran against an empty feed.
`/archive/colors/[id]` 500'd on an empty-string `ogImage`. The nav dropdown
hydration mismatch survived several "fixes" because every verification ran in
Chromium.

One shape recurs: **a defect that only appears when the real route is rendered
or the real HTTP contract is exercised.** Three tiers of check now cover it,
cheapest first.

## Tier 1 — `tests/static/**` (no server, runs in `bun run test`)

Filesystem-level assertions of contracts the unit suite structurally cannot
see. They run inside the existing vitest invocation, so they gate PRs with no
CI change and cost ~1.4s.

| File                               | Contract                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `i18n-locale-completeness.test.ts` | all 10 locales, identical key sets vs `en`, valid JSON, no HTML in message values |
| `hydration-auth-gates.test.ts`     | no template branches structurally on ungated client-only auth state               |
| `api-contract.test.ts`             | every client `/api/…` call resolves to a handler; every route file exports one    |
| `ssr-contracts.test.ts`            | dynamic routes throw a 404; no getter-form `useFetch`                             |
| `worker-env-contract.test.ts`      | every raw `process.env` read is a registered plain Worker var                     |

**Every one carries a shrink-only allowlist.** Today's known violations are
seeded so the checks are green on day one; a _new_ violation fails, and an
allowlist entry that stops reproducing **also** fails. A fix therefore cannot
merge without deleting its own entry, and the allowlists are a live inventory
of remaining debt rather than a place things go to be forgotten.

`scripts/find-shadowed-autoimports.py` is now wired into `pr-check.yml` too —
it was written to be CI-wireable and never had been.

### Load-bearing detail

`hydration-auth-gates` walks the real template AST via `@vue/compiler-dom`
rather than grepping, because it must understand nesting: a branch inside
`<ClientOnly>`, or inside a subtree already gated by a `hasMounted`-derived
name, is safe. A regex version reported `MainNav` as broken — its
`v-if="userProfile?.avatar_url"` sits inside `v-if="isSignedIn"`, which is
already gated.

`api-contract` blanks comments before extracting paths (a `/api/...` example
lives in a `Needles.vue` comment) and matches the real `server/api/**` filename
tree, treating only the bare `server/api/[...].ts` as a non-handler — genuine
catch-alls like the LangGraph proxy must still match.

## Tier 2 — `scripts/smoke-routes.mjs` (renders every route)

Dependency-free crawler, in the style of the other `scripts/` tools, so it runs
on a bare clone. Static routes are **derived** from `app/pages/**` so the
manifest cannot drift; dynamic routes are sampled from the `/api/__sitemap__/*`
source endpoints, so it always walks URLs that really exist.

Per route: expected status, non-empty `<title>` free of `undefined`, exactly one
`<h1>`, a canonical on indexable pages, a **non-empty** `application/ld+json`,
an absolute `og:image`, no raw i18n key leaking into text, no error payload.
Plus negative sets: paths that must 404, redirects that must fire, and paths
that must **not** be redirected.

Errors fail the run; softer checks are warnings until a category is clean
(`--strict` promotes them). `KNOWN_ERRORS` in the manifest is shrink-only, same
contract as the static allowlists.

Two decisions worth keeping:

- **HTML comments are stripped before content checks.** `/chat` documents the
  historical nuxt-schema-org failure in a template comment that quotes the error
  string verbatim, and SSR ships comments — the crawler was reporting the
  documentation as the defect.
- **Only a 200 gets its body inspected.** A route expected to redirect has no
  title or headings by definition.

## Tier 3 — Playwright (`tests/e2e/**`)

A **separate runner**, not `@nuxt/test-utils`. `vitest.config.ts` maps `~` to
the repo root (real Nuxt maps it to `app/`), disables file parallelism, rewrites
`import.meta.client` at transform time, and loads a setup file that stubs
`fetch` to _reject_. Each is correct for unit tests and fatal for a browser
suite, so the two configs stay apart; `tests/e2e/**` is excluded from vitest
discovery.

**Firefox is a first-class project, not redundancy.** The nav dropdown bug
reproduced only in Firefox 154 while every Chromium check passed. That gap is
now closed by default.

Specs:

- `nav-dropdown.spec.ts` — the direct structural assertion: **no
  `.dropdown-content` may exist without a `.dropdown` ancestor.** That is
  exactly what hydration repair destroyed, and it is browser-independent. Plus
  viewport containment, focus-open, and Escape-to-dismiss.
- `console-budget.spec.ts` — zero console errors and **zero Vue hydration
  warnings** across 14 representative routes. Verified to fail on an injected
  mismatch (`[Vue warn]: Hydration node mismatch` / `Hydration completed but
contains mismatches.`).
- `core-flows.spec.ts` — omnisearch, the gearing calculator, archive browse →
  detail, exchange browse, locale switching, the contribute gate, `/login`.

### `gotoHydrated`, and why `networkidle` is wrong here

`tests/e2e/_helpers.ts` waits for `__vue_app__` on `#__nuxt` — the property Vue
sets when `app.mount()` completes, i.e. exactly when hydration has finished and
any mismatch warning has already been logged.

`waitForLoadState('networkidle')` was the first attempt and is actively wrong on
this app: `/login` mounts a Turnstile widget that holds a connection open, so
the network never idles and the wait burns its full timeout on a page that
hydrated in 118ms. Switching to the hydration signal took the suite from
**1.8 minutes with 6 failures to 22 seconds with 0**.

### The dev server needs a raised heap

At the default heap the dev server's SSR worker dies partway through a
two-browser run:

```
Worker terminated due to reaching memory limit: JS heap out of memory
```

After that **every** route 500s and the remaining failures are noise that has
nothing to do with the code under test. `playwright.config.ts` and both
workflows set `NODE_OPTIONS=--max-old-space-size=8192` — the same class of limit
the production build already carries. Measured, not guessed.

### Out of scope: `/mcp`

mcp-toolkit picks its transport provider at **build time** from the Nitro
preset. A dev-server E2E run exercises the Node provider and proves nothing
about the deployed Cloudflare one. `scripts/test-mcp-transport.sh` remains the
only gate that can, and stays the pre-deploy gate.

## Where each tier runs

| Check                           | PR                  | Nightly |
| ------------------------------- | ------------------- | ------- |
| Unit + `tests/static/**`        | ✅ (`bun run test`) | —       |
| Shadowed auto-imports           | ✅                  | —       |
| Route crawler vs `nuxi dev`     | ✅ (`routes` job)   | —       |
| Route crawler vs **production** | —                   | ✅      |
| Playwright (chromium + firefox) | —                   | ✅      |

The crawler gates PRs against the dev server rather than a production build:
the build needs ~8 GB and 5+ minutes, and every defect this catches reproduces
in dev. Browser tests run nightly so a flaky browser test never blocks a merge.

The nightly production crawl is the highest-yield half. On its **first run it
found `/admin/marketing` returning HTTP 500 in production while returning 200
in dev** — see below.

## What the harness found on day one

Filed under the `Hardening pass 2026-Q3` milestone.

- **`/admin/marketing` is down in production.** SSR throws
  `Cannot read properties of undefined (reading 'console')`.
  `vuedraggable@4.1.0` runs `var console = getConsole()` at module scope, which
  falls back to `global.console` when `window` is undefined; on workerd the
  webpack `global` shim resolves to `undefined`. Dev is unaffected, which is why
  nobody noticed. The listing wizard also imports vuedraggable but is not
  affected (verified 200).
- **`oldRouteRedirect.global.ts` matches route substrings**, so any
  user-generated slug containing "registry" outside `/archive`, `/admin`,
  `/contribute` is 301'd to `/archive/registry`. Confirmed live in production
  for both `/exchange/listings/…-registry-certificate` and
  `/models/registry-plate-bracket`.
- **Three client `$fetch` calls target routes that do not exist**, two of them
  swallowed by `.catch()` while the UI reports success.
- **A third getter-form `useFetch`** in `NeedleTable.vue`, which CLAUDE.md
  asserted was down to zero.
- **`server/api/langgraph/_utils.ts`** is a helper module inside the route tree,
  so Nitro registers `/api/langgraph/_utils` as a route with no handler.
- **32 ungated structural auth branches**, `dashboard.vue` covering 14 routes.
- **Three `en`-only i18n blocks** (`/membership`, `/membership/claim`,
  `/discord/connect`) plus partial gaps on the homepage, Needles and the gearbox
  settings.
- **`FloatingChatInput` focuses its textarea on mount**, which steals focus on
  the homepage and kills the `/` omnisearch shortcut the header advertises there.
- **10 pages with 0 or 2 `<h1>` elements.**

## Deliberately not done here

- No application defect was fixed. Each is an issue so it can be reviewed on its
  own merits.
- **No `typescript`/`vue-tsc` dependency was added.** Doing so bumps the tree
  from the transitively-resolved TypeScript 6.0.3 to 7.x — a major jump that has
  nothing to do with hardening. Enabling typecheck is its own issue, where the
  version can be chosen deliberately and verified.
- Security findings whose write-up would amount to an abuse recipe are tracked
  in the private `classicminidiy-supabase` repo, per the public-repo rules at
  the top of CLAUDE.md.
