---
paths:
  - 'server/utils/referenceData.ts'
  - 'shared/referenceDataKeys.ts'
  - 'tests/fixtures/reference/**'
  - 'scripts/pull-reference-data.mjs'
  - 'scripts/reference-snapshot-module.mjs'
  - 'app/pages/admin/reference/**'
  - 'server/api/admin/reference/**'
  - 'data/weights.json'
  - 'data/models/units.ts'
  - 'server/mcp/tools/torque-specs.ts'
  - 'server/mcp/tools/clearances.ts'
  - 'server/mcp/tools/vehicle-weights.ts'
  - 'server/api/torque*'
  - 'server/api/clearance*'
  - 'server/api/weights*'
  - 'app/pages/technical/torque*'
  - 'app/pages/technical/clearance*'
  - 'tests/static/torque-unit-consistency.test.ts'
---

# Reference-data rules

Detail and the two-time Electrical-section error: `docs/invariants/reference-data-units.md`.

## Where the data lives (since 2026-09)

- **Needles, starter needles, suggested needles, torque specs and clearances are published in Supabase** (schema `reference`, in the private classicminidiy-supabase repo, which owns the publish rules). `server/utils/referenceData.ts#getReferenceDataset` is the ONLY reader. **Never re-add a `data/*.json` copy** of them: four hand copies drifted before this existed.
- Edit them in `/admin/reference`, which forwards to the `publish-reference-data` Edge Function. **The editor sends the textarea text unchanged; never `JSON.stringify` a parsed value** — the bytes are hashed and a re-serialisation is a different payload.
- The loader reads raw bytes (`getItemRaw`/`setItemRaw`): unstorage's `getItem` parses, and a text rebuilt from that is a different hash. Every text is checked against its sha256. The parsed `value` is shared across callers: never mutate it (`withUnits` returns a copy).
- **The reference pages render per request; never give them (or any route under `/t…`) a `swr`/`isr`/`cache` rule.** nitro's `extendMiddlewareWithRuleOverlaps` binds a cached route to the first wildcard handler whose prefix is a plain string prefix of it, with no segment boundary, so `/technical/torque` was served by the PostHog proxy `/t/**` (hang, or PostHog's 404). Found by the build comparison on 2026-09-24; the pages stay in `nitro.prerender.ignore` so the crawl does not bake them.
- The web pins the shape it reads (`shared/referenceDataKeys.ts#REFERENCE_MAX_SCHEMA`); raise it only in the same PR as the reader change.
- Build snapshot: the deploy runs `scripts/pull-reference-data.mjs` (fails the deploy in CI), and `#reference-snapshot` (a Nitro virtual module) bundles those exact texts as the loader's last fallback. Locally, with no service key, the fixtures stand in with a warning. This script is the one reader of `SUPABASE_SERVICE_KEY` outside `getServiceClient` (a build step has no Nitro runtime).
- Tests read `tests/fixtures/reference/` (exact bytes; `.prettierignore` excludes them) through a mocked loader. `bun run test:reference-live` re-runs the data-dependent tests against the pulled snapshot; the deploy job runs it before every deploy, so a published rename that breaks a reference noun blocks the deploy instead of shipping. Refresh the fixtures with `node --env-file=.env scripts/pull-reference-data.mjs --out tests/fixtures/reference`.

## Units

- **Imperial is the SOURCE, metric is DERIVED.** Where they disagree the imperial figure is right. `tests/static/torque-unit-consistency.test.ts` has no exemptions; a row that cannot be reconciled is removed, not exempted.
- **Every torque row is lb-ft.** The Electrical section was mislabelled `lbin` and correcting the conversion while trusting the label shipped six fasteners twelvefold too low. A field name is not evidence; two independent columns agreeing (kgm x 9.80665 vs lbft x 1.35582) is. `lbin` stays defined in `units.ts` for future rows.
- `thou` holds INCHES (`0.012` = 12 thou). Vehicle weights are kilograms and say so nowhere.
- `data/models/units.ts` is the single source for units; consumers import it, never restate. Describe every numeric column present (`unitsForItems()`), never convert on the way out, derive headers from every row not row zero, and keep the row counts in `torque-specs.ts`'s description asserted against the data.
