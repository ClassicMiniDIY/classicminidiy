---
paths:
  - 'app/pages/archive/variants/**'
  - 'app/composables/useModelVariants.ts'
  - 'server/utils/modelVariants.ts'
  - 'server/utils/variantApprovals.ts'
  - 'server/utils/variantAdmin.ts'
  - 'server/api/admin/variants/**'
  - 'app/pages/admin/variants.vue'
  - 'server/api/archive/variants/**'
  - 'server/api/__sitemap__/variants.ts'
  - 'server/mcp/tools/model-variants.ts'
  - 'data/models/variants.ts'
  - 'shared/utils/variantMatch.ts'
  - 'app/components/RegistryTable.vue'
  - 'app/composables/useRegistry.ts'
---

# Model Variants archive (`/archive/variants`)

Design and phases: `docs/plans/2026-09-22-model-variants-archive.md`. Named `variants`
on purpose: `/archive/registry` is the car register and `/models` is the 3D library.
Schema (`model_variants`, `model_variant_photos`, `model_variant_colors`) lives in
`classicminidiy-supabase` migrations `20260922000001`–`04`.

- **One read path.** Pages, the sitemap source and the `model-variants` MCP tool read
  through `server/utils/modelVariants.ts` (service role, cached per isolate, 5-min TTL).
  It re-applies `status = 'approved'` on variants AND embedded photos, because the
  service role skips RLS. Never query those tables for public output anywhere else.
- **One write path.** Approvals go through `server/utils/variantApprovals.ts`, imported by
  the approve route and never copied. `submission_queue.data` is browser-written: enums are
  checked against the closed lists, numbers parsed, columns limited to
  `VARIANT_EDITABLE_COLUMNS`, photo URLs pinned by `isOwnUploadUrl`. Classification
  (marque / family / mark / market) and `slug` are never suggestion-editable. Every spec
  change and every new variant must carry a source; approval appends it to `sources`.
- **Units are the source unit** (`power_bhp`, `torque_lbft`, `kerb_weight_kg`,
  `top_speed_mph`); metric is derived on read by the `to*` helpers in
  `data/models/variants.ts` and never stored. `VARIANT_UNITS` describes them.
- **Search is word-prefix AND** via `variantSearchWords` + `matchesEveryWord`, used by the
  server and the index page alike; a parity test pins them together.
- **The index is SSR** (`prerender: false`): facets live in the URL. Filter `<select>`s mark
  the URL value with `:selected` on the option, because SSR ignores `:value` on a select.
- **The seed is a recovered artefact**, `docs/plans/data/2026-09-22-model-variants-seed.json`
  (141 rows from the Wayback copy of austinminiwebsearch.com). It is the unit-test fixture
  and the input the seed migration was generated from; it is no longer bundled.
- **Photos render from `model_variant_photos`** (bucket `archive-variants`). The 72 recovered
  brochure scans are credited "via austinminiwebsearch.com (Wayback Machine)"; never strip
  the credit. A takedown is `status = 'rejected'` on the row.
- **The MCP tool is paid** (`PAID_ONLY_TOOLS`) and always available to `/chat` through
  `buildAgentTools()`. It is a `call_tool_db_backed` check in the transport script.
- **Registry cars link through `registry_entries.variant_id`** (`variant_match` says how).
  One matcher, `shared/utils/variantMatch.ts`, serves the backfill, the approve route
  (`resolveRegistryVariant`: owner's pick, else confident `auto` only) and the wizard's
  suggestions. Never auto-link an unconfident score; unlinked is correct. A new
  `registry_entries` column needs a per-column `GRANT SELECT` in the private repo.
- **Admin writes go through `/api/admin/variants/**`** (page `/admin/variants`). Edits are
  limited to `ADMIN_VARIANT_COLUMNS` (`server/utils/variantAdmin.ts`); `status`, `slug`,
  `sources` and provenance never join it. Every route writes `admin_audit_log` through
  `auditVariantAction`, which also calls `invalidateModelVariants()`. An admin registry
  link is `variant_match = 'reviewed'`. A colour-name link groups rows by
  `lower(trim(color_name))` in code and updates with `.in()`, never `ilike` (whose `%`,
  `_` and `*` widen the match). `replaceColours` keeps a kept name's `color_id`. The primary photo
  changes only through the `set_variant_primary_photo` RPC (one transaction); never
  clear-then-set over PostgREST.
- **The seed normaliser drops extra header names** (see its docstring). Never regenerate
  the seed from it without re-applying migration `20260923000001`'s corrections.
