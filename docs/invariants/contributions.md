# Contribution loop invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/contributions.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

### Contribution Loop Invariants

The UX cohesion pass turned the archive into a contribution platform. The loop is
_wizard → admin inbox → review drawer → contributor profile_, and these are the
parts of it that break silently if you get them wrong.

- **Approving a queued submission MUST write `submitted_by` on the inserted row.**
  `insertApprovedItem()` in `server/api/admin/queue/approve.post.ts` used to set only
  the free-text `legacy_submitted_by`, so an approved contribution was never linked to
  the account that made it — no profile stats, no badges, no leaderboard entry, no
  "added by @handle" credit anywhere. Every archive table has the FK; it just wasn't
  being populated. A new approval path must populate it too.

- **"Attach to an existing entry" is carried differently for colours than for
  everything else, and dropping it creates duplicate archive rows.** Wheels and
  registry entries gap-fill through `edit_suggestion` + `target_id`, so the
  association lives on the submission row and `applyEditSuggestion()` cannot lose
  it. Colours can't: `/contribute/color` is the one archive form that is not the
  wizard, so it submits a `new_item` and stamps the chosen colour's id inside
  `data.originalColorId`. `insertApprovedItem()` ignored that field until
  2026-08 and INSERTed a photo-only stub instead — same name, no hex, no swatch,
  empty paint codes — which is how `/archive/colors` ended up listing colours
  twice. The blast radius was bigger than the listing: a stub shares its real
  colour's `name+code+short_code`, the exact tuple
  `20260727000001_restore_wheel_colour_legacy_ids.sql` matches on, so a legacy
  DynamoDB id was restored onto a stub and that colour's legacy deep link broke.
  (Two live instances, rows cleaned up by supabase PR #77.) When merging into an
  existing row, `submitted_by` and `swatch_path` are only written if the row does
  not already have one — reassigning either steals another contributor's credit
  or overwrites curated data.

- **ONE route approves colours now, and its load-bearing decisions live in
  `server/utils/archiveApprovals.ts`.** There used to be two —
  `server/api/admin/queue/approve.post.ts` (the admin inbox, the path
  submissions actually flow through) and `server/api/colors/queue/save.ts`
  behind the older `/admin/colors/review` page, unlinked from every nav but
  reachable by URL, with `/api/colors/queue/list` spreading `...item.data` so
  the SAME submissions were approvable from it. They drifted on all four
  decisions that matter: honouring `originalColorId`, appending rather than
  replacing `contributor_images`, pinning asset URLs to this submission's own
  uploads (`isOwnUploadUrl` — `submission_queue.data` is browser-written), and
  writing `submitted_by`. The second door was deleted with the admin
  consolidation (2026-08-26). The util stays, covered directly by
  `tests/unit/server/utils/archiveApprovals.test.ts`: **a second approval
  surface imports from it, it does not copy.** Adding one and reimplementing
  any of those four decisions re-opens the duplicate-colour bug.

- **`contributor_archive_items` is the single source for every contributor stat.**
  It unions the approved, user-attributed rows of wheels / registry_entries / colors /
  archive_documents. `get_contributor_impact`, `contributor_badge_metrics`,
  `get_contributor_leaderboard` and `get_archive_latest_additions` all read it, so a new
  contributable table is one branch in that view — not five aggregate rewrites.

- **Nothing an anonymous caller writes may move a number a visitor can see.**
  Two places this shows up: omnisearch zero-result telemetry lands in the admin-only
  `archive_search_misses` and is promoted to a public Most Wanted row by hand
  (`promote_search_miss`), and `archive_requests.ask_count` only moves through
  `request_archive_item()`, which is one-ask-per-account via the `archive_request_asks`
  ledger. Same reasoning for reach: `record_archive_view` is **service-role only** and
  `archive_item_views` is keyed `(target, day, visitor_hash, is_download)`, so a refresh
  loop is worthless — the same shape `model_downloads` already uses.

- **`changes_requested` deliberately touches no counter.** It is a request for a
  revision, not a verdict. Counting it against the contributor would teach reviewers to
  reject instead of coach, which is the opposite of why the third button exists.
  `/api/admin/queue/request-changes` requires a reviewer note for the same reason — the
  note is the entire deliverable of that action.

- **`data/models/toolbox-catalog.ts` is keyed on the same `to` paths as `ToolboxItems`
  in `generic.ts`.** The catalog carries the wayfinding metadata (English names for
  server-side search, `category` for the subnav, `relatedArchive` for the tool-page
  box, `archiveBacked` for the olive tag). Add or move a tool and both must change.
  Tool names live there in English rather than as i18n keys because `/api/search` runs
  server-side and has no `useI18n()`.

- **Omnisearch is two sources merged in the Nitro route, on purpose.** Postgres
  `omnisearch()` covers the data surfaces; the Toolbox is matched in process from the
  static catalog. That keeps "add a calculator" a code change rather than a migration,
  and lets tool matching use synonyms ("CR", "lb-ft", "HIF44") that would be awkward to
  store. The SQL is ILIKE rather than tsvector deliberately — these corpora are small
  and the queries are as often part numbers and wheel sizes as words, which stemming
  actively hurts.

- **`/search` must keep `useFacetedSeo('/search', { indexableParams: [] })`.** `?q=` and
  `?surface=` would otherwise self-canonicalise every query into its own indexable
  near-duplicate — the same crawl trap documented under SEO invariants above.

- **`useRecentTools().load()` runs in `onMounted`, never during setup.** It reads
  localStorage, and the server renders "no chips"; reading it during setup is exactly
  the structural hydration mismatch that corrupted `/chat`.

- **`ContributeWizard.vue` is the only archive submission form — except colours.**
  Documents, registry entries, wheels and fixes all go through it. The
  `/contribute/{document,registry,wheel}` ROUTES still exist but are thin
  `ContributeLauncher` pages that open the wizard: `nuxt.config.ts` 301s
  `/archive/documents/submit`, `/archive/colors/contribute` and `/archive/wheels/submit`
  at them, so deleting the routes would break years-old inbound links. `?uuid=` on
  `/contribute/wheel` still means "add to this existing entry" and maps to the wizard's
  gap-fill. `/contribute/color` remains a real form — its swatch-versus-contributor-photo
  split does not fit the wizard's shared step 2.

  The registry step must keep collecting `trim`, `bodyType` and `engineSize`. They are
  real `registry_entries` columns, `trim` is a visible `RegistryTable` column, and the
  payload keys have to stay as-is because `insertApprovedItem()` maps them by name
  (`bodyNum` → `body_number`, `engineNum` → `engine_number`).
