# Admin consolidation + admin listing editing

Date: 2026-08-26
Branch: `feature/admin-consolidation`

## Problem

`/admin` is a card launcher, `/admin/exchange/**` is a sidebar shell, and
`/admin/inbox` is a third left rail with its own six-entry `RAIL` const. Which
one you get depends on which link you happened to click. Three more facts made
it worse:

- `definePageMeta({ layout: 'admin' })` on `queue`, `users`, `discord` and
  `marketing` is **inert** — there is no `app/layouts/` directory and `app.vue`
  renders `<NuxtPage>` with no `<NuxtLayout>`. Those pages have been laying out
  their own containers while declaring a layout that does not exist.
- Five pages review the same `submission_queue` table: `/admin/queue`,
  `/admin/inbox`, and `/admin/{registry,wheels,colors}/review`. The three
  `*/review` pages differ only by a `target_type` filter applied server-side.
- There was no way for an admin to correct a live listing. `useListings()
.updateListing()` hard-filters `.eq('user_id', user.id)`, and the owner edit
  page 403s a non-owner. The only admin listing writes that existed were
  `status` and `tier`.

## Decisions

1. **One shell.** `AdminExchangeShell` is promoted to `AdminShell`
   (`app/components/admin/Shell.vue`) and every `/admin/**` page wraps in it.
   The sidebar is grouped, badge-bearing, and identical on every page. The
   `/admin` card grid and the `/admin/inbox` rail are both retired.
2. **One review queue.** `/admin/queue` is canonical — it is a strict superset
   (per-item drawer, field-level diff, `request-changes`, collections;
   `/admin/inbox` had bulk approve/reject only). `/admin/inbox` and the three
   `*/review` pages 301 to it with the matching `?targetType=`.
3. **Admin listing editing reuses the owner form.** `/exchange/listings/[slug]/edit`
   admits admins; when the editor is not the owner it saves through a new
   service-role route instead of PostgREST. One form, full field parity.

## Shell

`<AdminShell>` takes `title`, `subtitle`, `breadcrumb` and renders breadcrumb,
an ADMIN identity strip (who you are + sign out), the section nav, and the page
slot. Sections:

| Group       | Entries                                                                                |
| ----------- | -------------------------------------------------------------------------------------- |
| Overview    | Dashboard                                                                              |
| Review      | Submissions (badge), Marketplace moderation (badge), 3D models                         |
| Marketplace | Overview, Listings, Messages (badge), Finds, Wanted, Social, Announcements, Newsletter |
| Community   | Users, Discord roster, Chat threads                                                    |
| Email       | Marketing (allowlist-gated)                                                            |

Moderation appears once, under Review — not duplicated into Marketplace.

On `lg` and up the nav is the sticky sidebar. Below `lg` a 20-entry stacked
menu would push the page content off the first screen, so it collapses into a
single dropdown labelled with the current section.

Badge counts are loaded once by the shell and refreshed on route change. They
stay non-critical: every loader swallows its own error, because a failed count
must not take a working admin page down with it.

## Admin listing editing

`PUT /api/admin/listings/[id]` (service role, `requireAdminAuth`, audit-logged).

- **Content columns only, by allowlist.** `ADMIN_EDITABLE_COLUMNS` is the
  security boundary, in the same spirit as `EDIT_TARGETS` in the queue approve
  route. `status`, `tier`, `user_id`, `payment_status`, `paid_amount`,
  `promoted_on_social*`, `featured_until` and the trust/audit columns are NOT in
  it — status and tier already have their own routes, which exist precisely so
  those transitions stay observable, and payment columns are Stripe's to write.
- **It never changes review state.** This is the whole point of the feature: fix
  a price on a live listing without pushing it back through moderation. So the
  route touches no status field and fires no moderation email, and a listing
  that was `active` before the edit is `active` after it.
- **Clearing a field is a real edit.** The owner form's change-diff drops any
  new value that is `null`/`''`, so a field can be changed but never emptied.
  For an admin fixing bad data that is the exact operation wanted ("this
  chassis number is nonsense, remove it"), so the admin path diffs against the
  original and sends explicit nulls. The owner path is left as it is — widening
  it is a separate behavioural change to a form sellers use.
- **Title changes regenerate the slug**, matching `updateListing()`. The old
  URL 404s afterward, same as when a seller renames their own listing.
- The seller is emailed nothing. An admin correcting a typo is not a moderation
  event, and the audit log is the record.

The edit page gains an admin banner naming whose listing is being edited, so it
is never ambiguous that you are writing to someone else's row.

## What is deliberately NOT done

- The owner edit form's inability to clear a field is documented above and left
  alone.
- No schema change. Nothing here needs a migration.

## Cleaning up after the deleted pages

Removing the four review pages orphaned their backing API routes. An admin-gated
approval route with no UI in front of it is not harmless — it is a live write
path nobody is looking at — and two of them were writing bad data, so they go
with the pages:

| Route                                   | Fate                                                           |
| --------------------------------------- | -------------------------------------------------------------- |
| `/api/colors/queue/{list,reject,save}`  | deleted                                                        |
| `/api/registry/queue/{save,reject}`     | deleted                                                        |
| `/api/wheels/review/{list,save,delete}` | deleted                                                        |
| `/api/registry/queue/list`              | **kept** — read by the public `/archive/registry/pending` page |

`wheels/review/save.ts` and `registry/queue/save.ts` inserted approved rows with
`legacy_submitted_by` only and never `submitted_by`, which is precisely what the
"Contribution Loop Invariants" section of CLAUDE.md says an approval path must
never do: the contribution is never linked to the account that made it, so no
profile stats, no badges, no leaderboard entry. They were reachable by URL until
today. Deleting them removes the last approval path that could write an
unattributed row.

`server/utils/archiveApprovals.ts` survives with one caller. Its coverage used to
come through `tests/unit/server/api/colors/queue-save.test.ts`, which died with
its route, so the shared logic is now pinned directly in
`tests/unit/server/utils/archiveApprovals.test.ts` — a better place for it than
either route test, and the reason a future second approval surface can be added
safely.
