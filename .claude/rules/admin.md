---
paths:
  - 'app/pages/admin/**'
  - 'app/components/admin/**'
  - 'server/api/admin/**'
---

# Admin surface rules

Detail, viewport measurements and the consolidation design (`docs/plans/2026-08-26-admin-consolidation.md`): `docs/invariants/admin.md`.

- `<AdminShell>` (`app/components/admin/Shell.vue`) is the ONLY admin chrome; every `/admin/**` page wraps in it and new pages go into its `NAV_GROUPS`. There is no `app/layouts/`; `definePageMeta({ layout })` does nothing here.
- `/admin/queue` is the one submission-review surface; the old `*/review` pages are 301s carrying `?targetType=`. `/api/registry/queue/list` survives only for the public `/archive/registry/pending` page.
- `/admin` is a triage board of counts; charts stay on `/admin/exchange`. Every count loads independently and swallows its own error.
- The shell uses `max-w-[1400px]`, pinned to `MainNav`'s width, not `.container`; wider than the nav misaligns the ADMIN strip, narrower clips the last table column. Tables scroll sideways under ~1280 by design.
- A scroll container wraps the TABLE ONLY, never the pager. `truncate` in a cell needs an explicit `max-w-*`. A `1fr` track cannot shrink below min-content; put `min-w-0` on the grid item. Every interpolated name/address/URL needs `min-w-0` on its flex ancestors plus `truncate` or `break-words`.
- Viewport fixtures must contain a long UNBROKEN token (`ClassicMiniRestorationProjectSaudiArabia1959CooperSMkITwinCarbHydrolastic`); a name with spaces hides the bug. A too-wide `modal-box` is a symptom of document overflow, not the bug.
