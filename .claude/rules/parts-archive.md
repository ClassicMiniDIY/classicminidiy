---
paths:
  - 'app/pages/archive/parts/**'
  - 'app/pages/admin/parts.vue'
  - 'server/api/archive/parts/**'
  - 'server/api/admin/parts/**'
  - 'server/utils/partSections.ts'
  - 'server/utils/partSearchFilter.ts'
  - 'server/utils/hotspotBounds.ts'
  - 'server/mcp/tools/parts-lookup.ts'
  - 'server/mcp/tools/parts-equivalency.ts'
  - 'shared/utils/sourceOrder.ts'
---

# Parts archive (`/archive/parts`, `part_*` tables)

Design doc: `docs/plans/2026-09-04-parts-number-database.md`. Schema, RLS and the
ingest scripts live in `classicminidiy-supabase`; nothing here writes `part_*`.

- **Two filters on every public read of source-derived rows**, not one. The
  licence kill switch (`licence_status <> 'declined'`) is enforced by RLS, but
  service-role reads bypass RLS, so a route using `getServiceClient` must apply
  it itself. `part_source_records` additionally needs `is_current = true`: the
  refresh retires a record when the retailer stops listing it, and a retired
  record is a link to a 404.
- **Never tally a PostgREST list in JavaScript.** The response caps at 1000
  rows with no error, so `rows.length` and any client-side group-by silently
  under-report. This has shipped twice: 37,066 callouts counted as 1,000 (eight
  systems reported zero parts) and a queue tally that stopped growing at 1,000.
  Use `{ count: 'exact', head: true }`, an RPC, or `.range()` paging.
- **A failed count renders as unknown, never as zero.** On `/admin/parts` a zero
  reads as "declining this source hides nothing", which is the one wrong answer
  that makes the kill switch look safe to pull.
- **Never interpolate user text into a PostgREST `or()`.** `part_number` reaches
  the filter builder in `server/utils/partSearchFilter.ts`, which is an
  allowlist (letters, digits, space, `/`, `-`). `a,b` and a bare `%` both used to
  reach the parser. Widen the allowlist only with a test.
- **Hotspot overlays use presentation attributes, not utility classes.** This
  build never emits `fill-transparent`, so a class-styled polygon falls back to
  default black and paints the drawing out. `fill="none"` on the element.
- **Source order is a seeded shuffle, never `Math.random()`.**
  `shuffleSourcesForPart()` keys off the part number so server and client agree;
  a random order corrupts hydration, and any fixed order is a ranking of
  retailers we do not intend to make.
- **No price, no stock, ever** — not in `raw`, not in a title. The archive is
  part numbers and drawings; storing commercial data is the thing the sources
  would object to.
