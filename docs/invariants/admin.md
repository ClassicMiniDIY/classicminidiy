# Admin surface and viewport invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/admin.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

### Admin Surface Invariants

Consolidated 2026-08-26. Design doc: `docs/plans/2026-08-26-admin-consolidation.md`.

- **`app/components/admin/Shell.vue` (`<AdminShell>`) is the ONLY admin chrome, and
  every `/admin/**` page must wrap in it.** Before the consolidation there were
  three navigations — a card grid on `/admin`, the exchange sidebar, and a third
  rail on `/admin/inbox` — and which one you got depended on which link you
  clicked. Adding an admin page means adding it to `NAV_GROUPS` in that file, not
  building another nav. The shell owns the container bounds, the breadcrumb, the
  ADMIN identity strip and sign-out, and the `title`/`subtitle`/`#actions`
  header, so pages render body content only.

- **There is no `app/layouts/` directory, and `definePageMeta({ layout: 'admin' })`
  never did anything.** `app.vue` renders `<NuxtPage>` with no `<NuxtLayout>`, so
  four admin pages were declaring a layout that did not exist while hand-rolling
  their own containers. Do not re-add that meta; wrap in `<AdminShell>` instead.

- **`/admin/queue` is the one submission-review surface.** `/admin/inbox` and
  `/admin/{registry,wheels,colors}/review` all read the SAME `submission_queue`
  table — the three `*/review` pages differed only by a `target_type` filter
  applied server-side in `/api/{registry,wheels,colors}/queue/list` — so they are
  301s in `nuxt.config.ts` routeRules now, carrying `?targetType=` so a reviewer
  lands on the subset the old page showed. `/admin/queue` reads that param on
  load; keep it in sync with `targetTypeFilters` if a new target type appears.
  Their backing API routes went with them (`/api/colors/queue/**`,
  `/api/registry/queue/{save,reject}`, `/api/wheels/review/**`) — an admin-gated
  approval route with no UI in front of it is still a live write path, and those
  two `save` routes wrote only `legacy_submitted_by`, which is the exact
  contributor-credit bug the Contribution Loop invariants below forbid.
  `/api/registry/queue/list` is the ONE survivor: it is read by the public
  `/archive/registry/pending` page, not by admin.

- **`/admin` is a triage board, not a launcher.** Navigation is the sidebar's job
  on every page, so the dashboard's job is the count. Marketplace charts stay on
  `/admin/exchange` — duplicating them onto `/admin` is how those two pages
  drifted apart in the first place. Every count on both pages loads independently
  and swallows its own error: a badge is decoration, and one unavailable table
  must not blank the first screen an admin sees after signing in.

- **`PUT /api/admin/listings/[id]` corrects listing CONTENT and must never touch
  review state.** It exists so a wrong price or a phone number in a description
  can be fixed on a LIVE listing without pushing it back through moderation, so
  it sets no status field and sends the seller no email — the `admin_audit_log`
  row is the record. `ADMIN_EDITABLE_COLUMNS` in that file is the security
  boundary (the `changes` object is browser-written, and the route is
  service-role so RLS is not standing behind it), in the same spirit as
  `EDIT_TARGETS` in the queue approve route. `status` and `tier` are deliberately
  excluded — they have their own routes so those transitions stay observable, and
  moderation must remain the only path to `active`. Never add ownership, payment,
  or worker-bookkeeping columns to that set.

- **`/exchange/listings/[slug]/edit` serves two writers on two paths.** RLS on
  `listings` is owner-scoped, so an admin's PostgREST update matches zero rows
  and still reports success — the admin save MUST go through the route above.
  The gate is client-only on purpose: the Supabase session is in localStorage,
  so `supabase.auth.getUser()` during SSR has nothing to read. It used to throw
  403 there unconditionally, which made a hard refresh of the page fail for the
  owner too; SSR now passes through and the client decides, matching what the
  `exchange-auth` middleware already does. Note the deliberate asymmetry in the
  change-diff: the seller path still treats a blank as "no change", the admin
  path sends an explicit null, because clearing bad data is the whole point of
  the admin edit.

#### Admin viewport invariants

Audited across all 16 `/admin/**` pages at 390 / 768 / 1024 / 1280 / 1440 / 1920.
Three distinct root causes were found, and all three are invisible until the data
is long enough — an empty or short-fixture table proves nothing about them, so
measure with a realistically long display name, address and title.

- **`AdminShell` deliberately does NOT use `.container`, and its width is pinned
  to `MainNav`'s.** `.container` is `max-w-7xl` (1280px), a reading width:
  subtract the 16rem section rail and the gutters and the content column is
  ~928px, while the widest admin tables need ~1000-1100px, so `/admin/users`,
  `/admin/exchange/listings` and `.../wanted` clipped their LAST column (the
  trust-level select, the row action menu) even on a 1440px display. The shell
  uses `max-w-[1400px]` — **the same value as `MainNav`** — which leaves 1048px
  for the table. Do not widen it past the nav: at `max-w-[1600px]` the admin body
  was wider than the site header above it and the ADMIN strip started 100px LEFT
  of the site logo on a 1920px display. Below ~1280 these tables still scroll
  sideways, which is intended and is why the rail collapses to a dropdown under
  `lg`.

- **A scroll container must wrap the TABLE ONLY, never the table plus its
  pager.** `/admin/users` had the result count and pagination inside the
  `overflow-x-auto`, so on every viewport where the table overflowed the pager
  was laid out at the table's width and "Next" sat off-screen — you had to
  scroll the table sideways to page the table.

- **`truncate` inside a table cell needs an explicit `max-w-*`, or it makes the
  column WIDER.** `truncate` implies `white-space: nowrap`, and a column's
  minimum is its cell's min-content width, so an untruncatable long name set the
  User column to 430px. `min-w-0` alone does not help here — there is no flex
  parent to shrink against. Capping the cell took the users table's minimum from
  1078px to 975px, which is the difference between fitting and not at 1440.

- **A `1fr` grid track is `minmax(auto, 1fr)` and cannot shrink below its item's
  min-content width.** So one `truncate`d line inside a grid card sets the whole
  track, and the PAGE scrolls horizontally — `/admin` overflowed by 15px at
  390px for exactly this reason. Fix is `min-w-0` on the grid ITEM (or
  `minmax(0,1fr)` on the track), not on anything inside it.

- **Addresses AND display names are single unbreakable words, and they escape
  the viewport.** Both are user-supplied, and a display name is as likely to be
  one long token as an address is — that is the trap, because a fixture name with
  spaces wraps and hides the bug. In a flex row an unbreakable token sets the
  row's min-content; `flex-wrap` does NOT save you, since a single item wider
  than the row still overflows. Measured at 390px with an 87-character
  single-token name: `/admin/queue` 337px, `/admin/exchange/finds` 238px,
  `.../listings` and `.../wanted` 219px, `.../moderation` 211px of document
  scroll. Every interpolated name/address/URL needs `min-w-0` on its flex
  ancestors plus `truncate` (bounded) or `break-words`/`break-all` (unbounded).

- **Fixture data for a viewport check must contain a long UNBROKEN token.** A
  realistic-looking name with spaces passed all 16 pages; swapping it for the
  same length without spaces immediately failed five of them. Test with
  `ClassicMiniRestorationProjectSaudiArabia1959CooperSMkITwinCarbHydrolastic`,
  not `Classic Mini Restoration Project`.

- **A `modal-box` wider than the viewport is usually a SYMPTOM, not the bug.**
  `.modal` is `position: fixed; inset: 0`, so it sizes to the initial containing
  block — which grows once the document itself scrolls horizontally. Fix the
  element that overflows the page and the modals come back on their own. A CLOSED
  daisyUI modal still lays out, so it can be measured without opening it.
