---
paths:
  - 'app/pages/exchange/**'
  - 'app/components/exchange/**'
  - 'app/composables/useListings.ts'
  - 'app/composables/useExampleListings.ts'
  - 'server/api/exchange/**'
  - 'server/utils/exchange/**'
  - 'server/api/admin/listings/**'
  - 'server/middleware/tme-redirects.ts'
  - 'server/utils/tmeRedirects.ts'
---

# Marketplace (`/exchange`) rules

Detail and the 2026-07/08 draft-swallow incident: `docs/invariants/marketplace.md`. Status-transition mechanism is documented in `classicminidiy-supabase` (private); do not restate it here.

- **A paid listing is born `draft` and only the payment path promotes it to `pending`**: the Sustaining Member comp, the webhook and the verify fallback all call `promoteListingToPending` (`_shared/listings.ts` in the supabase repo). A `draft` is invisible to browse (`active` only) AND the admin queue (`pending` only), so the failure is total and silent. Never repair a stuck listing by jumping it to `active`: `pending → active` is what credits the seller's trust.
- **Only moderation makes a listing `active`**, via `PUT /api/admin/listings/[id]/status` and `.../tier` (service-role). The status route is also the ONLY thing that emails the seller on approval (the `on_listing_approved` trigger moves trust counters only), so an approval done by RPC or SQL breaks the "we'll email you" promise. Client writes that publish are rejected server-side. `useListings().publishListing()` has no callers and must not be wired to a button. Any owner-facing status action must be exercised against a real non-admin session.
- `PUT /api/admin/listings/[id]` corrects CONTENT only; `ADMIN_EDITABLE_COLUMNS` is the boundary and excludes `status`/`tier`/ownership/payment columns. The edit page serves owner (PostgREST, RLS) and admin (this route) on separate paths; SSR passes through and the client decides.
- **Feed item `id` must be an absolute IRI** (`feedItemId()` → `urn:uuid:<id>`), or Atom 500s while RSS/JSON stay green. The RSS `<guid>` keeps the old prefixed strings; readers dedupe on it. Feed tests must SEED rows before asserting. Enclosure URLs go in RAW via `absoluteFeedUrl()`; never `escapeHtml()` a URL into an enclosure.
- `theminiexchange.com` 301s (`tme-redirects.ts`, map in `tmeRedirects.ts`, mirrored to zone rules by `scripts/sync-tme-zone-redirects.py`) are load-bearing SEO; never remove them. The TheMiniExchange repo is retired; make no changes there.
