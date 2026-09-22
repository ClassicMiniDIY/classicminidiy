---
paths:
  - 'app/pages/archive/variants/**'
  - 'app/composables/useModelVariants.ts'
  - 'server/utils/modelVariants.ts'
  - 'server/api/archive/variants/**'
  - 'server/api/__sitemap__/variants.ts'
  - 'server/mcp/tools/model-variants.ts'
  - 'data/models/variants.ts'
  - 'data/modelVariants.json'
---

# Model Variants archive (`/archive/variants`)

Design and phases: `docs/plans/2026-09-22-model-variants-archive.md`. Named `variants`
on purpose: `/archive/registry` is the car register and `/models` is the 3D library.

- **One read path.** Pages, the sitemap source and the `model-variants` MCP tool read
  through `server/utils/modelVariants.ts`, never `data/modelVariants.json` directly. The
  JSON is the Phase 1 seed for the `model_variants` table in `classicminidiy-supabase`;
  when that lands only this module changes, and the tool joins `call_tool_db_backed` in
  `scripts/test-mcp-transport.sh`.
- **The seed is a recovered artefact.** 141 rows from the Wayback copy of the defunct
  austinminiwebsearch.com. Every row cites the capture URL in `sources[0]` and carries
  `legacy_submitted_by`. Regenerating it is `docs/plans/data/2026-09-22-model-variants-*.py`
  over the saved HTML, not a re-crawl. `tests/static/model-variants-seed.test.ts` is the
  contract the migration assumes.
- **Units are the source unit** (`power_bhp`, `torque_lbft`, `kerb_weight_kg`,
  `top_speed_mph`); metric is derived on read by the `to*` helpers in
  `data/models/variants.ts` and never stored (the seed test asserts it). `VARIANT_UNITS`
  is the one place the units are described.
- **Search is word-prefix AND**, like every in-process source (`matchesEveryWord`).
  The index page repeats the same rule client-side over the cards; keep the two in step.
- **The index is SSR** (`prerender: false`): facets live in the URL and a baked copy
  would hydrate a filtered link into the full list. `useFacetedSeo` with no indexable
  params. Detail pages 404 with `fatal: true` on a miss and the API route 404s first.
- **Photos render only from `images[].url`** (hosted). `archived` + `wayback_url` are
  import bookkeeping; the Wayback Machine holds 72 of the 532 referenced files. Phase 3
  imports them with a credit line; until then the gap state is the design.
- **Contributions are the generic `fix` kind for now** (`openWizard({ kind: 'fix' })`,
  `targetType` unset because `target_type_enum` has no `variant` yet). Phase 4 adds the
  real kind, `EDIT_TARGETS.variant`, the bucket and the review findings.
- **The MCP tool is paid** (`PAID_ONLY_TOOLS`) and always available to `/chat` through
  `buildAgentTools()`. Adding a field to the tool's result means adding it to
  `server/mcp/README.md` §13.
