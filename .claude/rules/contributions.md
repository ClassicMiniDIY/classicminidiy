---
paths:
  - 'app/pages/contribute/**'
  - 'app/components/Contribute*'
  - 'app/components/contribute/**'
  - 'app/components/profile/**'
  - 'server/api/admin/queue/**'
  - 'server/utils/archiveApprovals.ts'
  - 'server/api/search*'
  - 'data/models/toolbox-catalog.ts'
  - 'app/composables/useRecentTools.ts'
  - 'app/pages/search.vue'
---

# Contribution loop and trust rules

Detail and the duplicate-colour incident: `docs/invariants/contributions.md`. Trust pipeline contract: `classicminidiy-supabase/docs/plans/2026-07-13-unified-trust-pipeline.md`.

- Every human-reviewed approval must feed trust (counters + `contributions` ledger + `recalculate_trust_level()`, DB-side). A new approval surface must do the same.
- Approving a queued submission MUST write `submitted_by` on the inserted row, not only `legacy_submitted_by`.
- Colours attach to an existing entry via `data.originalColorId` (the only non-wizard form); ignoring it inserts a photo-only duplicate that collides with the legacy-id matcher. When merging, write `submitted_by`/`swatch_path` only if empty.
- ONE route approves colours; its four load-bearing decisions live in `server/utils/archiveApprovals.ts` (covered by its own unit test). A second approval surface imports from it, never copies.
- `contributor_archive_items` is the single source for contributor stats; a new contributable table is one branch in that view.
- Nothing an anonymous caller writes may move a visible number: search misses land admin-only, `ask_count` moves only through `request_archive_item()`, `record_archive_view` is service-role only.
- `changes_requested` touches no counter and requires a reviewer note.
- `data/models/toolbox-catalog.ts` is keyed on the same `to` paths as `ToolboxItems`; add or move a tool in both. Omnisearch merges Postgres `omnisearch()` (ILIKE on purpose) with the in-process toolbox catalog.
- `/search` keeps `useFacetedSeo('/search', { indexableParams: [] })`. `useRecentTools().load()` runs in `onMounted` only.
- `ContributeWizard.vue` is the only archive submission form except `/contribute/color`; the `/contribute/{document,registry,wheel}` routes are launchers that old links depend on. The registry step keeps `trim`, `bodyType`, `engineSize`, and the payload keys `bodyNum`/`engineNum` map by name in `insertApprovedItem()`.
- Public profile reads go through the `public_profiles` view; `profiles` for another user returns zero rows. Keep `DashboardTrustProgressCard` copy in sync with the DB thresholds.
