# Auto-import, module and component resolution

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/vue-resolution.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### Auto-import gotcha: never shadow an auto-imported name

**A local `const ref = …` anywhere in a `<script setup>` block suppresses
`import { ref } from 'vue'` for the WHOLE file.** Nuxt's auto-import (unimport)
scans the module for declared identifiers and skips injecting any name it thinks is
already provided — it does not do scope analysis. So one `const ref` inside a
`computed()` callback silently strips the top-level import, and every `ref()` at
setup scope throws `ReferenceError: ref is not defined` at runtime. Nothing fails at
build time; the component just never mounts.

This took the SU needle configurator (`app/components/Calculators/Needles.vue`) down
completely — `const ref = referenceNeedle.value` shadowed it from `ce5dc70b` until it
was found in 2026-08. Applies equally to `computed`, `watch`, `useState`, `props`,
and any composable name. If you want a short local for a "reference" something, call
it `reference`.

`python3 scripts/find-shadowed-autoimports.py` sweeps the repo for this and exits
non-zero on a hit — run it if a component mysteriously never mounts. To confirm a
specific case in dev, fetch the transformed module and look at the vue import line:
`curl -s localhost:3000/_nuxt/components/<Path>.vue | grep -oE 'import \{[^}]*\} from "[^"]*vue.runtime[^"]*"'`

#### Module resolution invariants

- **Client code reaches `shared/` through the `~~/` alias, never a relative path.**
  A relative `../../shared/utils/x` resolves in dev, in vitest and under
  `vue-tsc`, then fails the PRODUCTION build:

  ```
  [nitro] RollupError: Could not resolve "../../../../../shared/utils/chatTiers.ts"
  from ".nuxt/dist/server/_nuxt/chat-CM26o58_.js"
  ```

  What makes this worth a rule rather than a fix is WHERE it fails. Every PR gate
  was green — unit suite, typecheck, format, CodeQL, route smoke — so the PR
  merged, and the deploy then died at the Nitro bundling step. `main` carried
  code that could not be built, and because a failed deploy leaves the previous
  Worker serving traffic, **production silently stayed on the older commit**.
  Nothing was red on the site; the feature simply was not there. Two PRs shipped
  that way before anyone noticed, and the second was only found because its
  "successful" merge was followed by a check of the deploy log rather than the
  site.

  The general shape: a green PR is not evidence of a deployable `main`, because
  the only gate that runs the production bundler is the deploy itself. If a merge
  matters, look at the deploy run, not the checks.

  `tests/static/shared-import-alias.test.ts` enforces the import form
  (shrink-only, currently empty).

#### Component resolution invariants

- **A nested component must be referenced by the name Nuxt registers, which
  includes its directory prefix.** `app/components/profile/ContributorImpact.vue`
  registers as **`ProfileContributorImpact`**, not `ContributorImpact`. Getting
  this wrong does not throw and does not fail the build: Vue logs
  `[Vue warn]: Failed to resolve component` to the browser console and renders
  **nothing**, so the feature reads as never-built rather than broken. Same
  silent-empty-element family as the `i-fa6-*` icon strings above.

  It bit `<ContributorImpact>` on both `/profile` and `/users/[id]`, so the
  contributor impact panel — the visible payoff of the whole trust and
  contribution pipeline — was empty space on the two pages that show it. Every
  sibling in that directory was already referenced with the prefix, which is
  exactly why it survived review.

  `tests/static/component-resolution.test.ts` enforces it. **It reads
  `.nuxt/components.d.ts`** rather than deriving names from paths, because
  deriving means reimplementing Nuxt's rules — including the duplicate-prefix
  collapse that makes `archive/ArchiveSubnav.vue` into `ArchiveSubnav` and not
  `ArchiveArchiveSubnav`. A first version that derived them reported 20
  violations of which 18 were false. Nuxt's own manifest cannot disagree with
  Nuxt. An explicit `import Foo from './Foo.vue'` still wins over auto-import
  and is accepted; `Chat/ChatWindow.vue`'s children work that way.

- **Any check that scans source for a call must blank comments first.** Three
  separate checks in this repo have been wrong because prose counted as code:
  the Worker env registry (a doc comment naming `process.env.MICROLINK_API_KEY`
  kept a dead entry alive), the BotID zone verifier (`checkout.post.ts`'s
  "Do NOT re-add checkBotId()" comment demanded a rule for a route that
  deliberately has none), and the component check above. `blankComments()` in
  `tests/static/_scan.ts` blanks in place, so line numbers survive.
