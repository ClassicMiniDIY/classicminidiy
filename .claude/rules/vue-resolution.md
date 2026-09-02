---
paths:
  - 'app/**/*.vue'
  - 'app/composables/**'
  - 'app/utils/**'
  - 'shared/**'
---

# Vue auto-import and resolution rules

Detail and incident history: `docs/invariants/auto-imports-and-resolution.md`.

- **Never declare a local named like an auto-import** (`ref`, `computed`, `watch`, `useState`, `props`, any composable). unimport does no scope analysis: one `const ref = …` inside a callback strips the top-level `import { ref } from 'vue'` for the whole file and the component never mounts, with no build error. Call a local "reference" `reference`. Sweep: `python3 scripts/find-shadowed-autoimports.py`.
- **Client code reaches `shared/` through `~~/`, never a relative path.** A relative import passes dev, vitest and vue-tsc and then fails ONLY in the production Nitro bundle, which leaves production silently on the previous commit. `tests/static/shared-import-alias.test.ts` enforces it.
- **Reference nested components by their registered name, directory prefix included.** `app/components/profile/ContributorImpact.vue` is `<ProfileContributorImpact>`. A wrong name logs a Vue warning and renders nothing. `tests/static/component-resolution.test.ts` reads `.nuxt/components.d.ts` (Nuxt's own manifest, never derived from paths).
- **Never use the getter form `useFetch(() => url)`.** Under Nuxt 4.5 it stops blocking async setup; use a string, or a computed ref when the URL is reactive. `tests/static/ssr-contracts.test.ts` enforces it.
- **A dependency that reads `global.*` at module scope (vuedraggable) 500s an SSR'd route on Workers but not in dev.** Import it behind a dynamic `import()` AND render it inside `<ClientOnly>` (see `app/pages/admin/marketing.vue`, `PhotoUploadSection.vue`); EVALUATION decides, not import style, so a static import that "works today" is not safe. Verify on `wrangler dev --local`.
- **Any scanner over source must blank comments first** (`blankComments()` in `tests/static/_scan.ts`); three checks have been wrong because prose counted as code.
