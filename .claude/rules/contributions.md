---
paths:
  - 'app/pages/contribute/**'
  - 'app/components/Contribute*'
  - 'app/components/contribute/**'
  - 'app/components/profile/**'
  - 'server/api/admin/queue/**'
  - 'server/utils/archiveApprovals.ts'
  - 'server/api/search/**'
  - 'app/components/dashboard/**'
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
- `data/models/toolbox-catalog.ts` is keyed on the same `to` paths as `ToolboxItems`; add or move a tool in both. Omnisearch merges Postgres `omnisearch()` (ILIKE on purpose) with the in-process toolbox catalog, the archive sections, wiring diagrams, suppliers, the parts archive (through `server/utils/partsSearch.ts`) and the KV video index. In-process sources rank ONE WORD AT A TIME by word-prefix, never substring (`ratio` must not reach `restoration`); a one- or two-word query must match every word.
- **A search miss is recorded only by `POST /api/search/miss`, on a commit** (Enter, close, 1.5s idle, or landing on `/search`), never by the search call. Recording on the 180ms debounce put `bad wo`, `bad wol` and `bad wolf` into `archive_search_misses`, which `promote_search_miss` turns into public Most Wanted rows. `useOmnisearch.commitMiss` dedupes per session. The chat agent's `site-search` never records.
- **Direct answers render facts, so a doubtful one renders nothing.** `server/utils/directAnswers.ts` answers a part only when the first hit IS the number, a chassis only when exactly one era accepts it (1969-1974, 1974-1980 and 1980 share an option table and decode the same letters to different meanings, so a Mk3/Mk4 number gets no card and the decoder asks the era — a known gap, not a bug), a torque or clearance only through `data/models/referenceNouns.ts`, whose every row `tests/static/reference-nouns.test.ts` checks against the JSON tables. Add a noun by adding terms; never point one at a row name you have not copied from the table.
- **The Ask row is always present with a query and never the only option while results exist.** Its position follows `intent.askPosition` (top for a question or an empty list, bottom for a lookup); `Cmd/Ctrl+Enter` selects it from anywhere. The handoff is `/chat?message=&source=omnisearch`, the one the retired homepage `FloatingChatInput` used; `chat_message_sent.source` splits chat by origin. Do not bring the floating box back: six uses a month against 235 palette opens.
- **The query's shape decides the surface order** (`shared/utils/searchIntent.ts`, heuristics only, shared by client and server). `lookup` keeps the pre-2026-09 order so existing queries rank as before. Add a detector by adding fixture rows to `tests/unit/shared/searchIntent.test.ts`. Design: `docs/plans/2026-09-14-unified-search.md`.
- `/search` keeps `useFacetedSeo('/search', { indexableParams: [] })`. `useRecentTools().load()` runs in `onMounted` only.
- `ContributeWizard.vue` is the only archive submission form except `/contribute/color`; the `/contribute/{document,registry,wheel}` routes are launchers that old links depend on. The registry step keeps `trim`, `bodyType`, `engineSize`, and the payload keys `bodyNum`/`engineNum` map by name in `insertApprovedItem()`.
- Public profile reads go through the `public_profiles` view; `profiles` for another user returns zero rows.
- Trust levels: 3 approved → contributor; 10 approved with <20% rejections → trusted; a 30-day tenure path also reaches contributor. `DashboardTrustProgressCard` (`app/components/dashboard/TrustProgressCard.vue`) is the user-facing explanation and its copy must stay in sync with the DB thresholds if they change.
