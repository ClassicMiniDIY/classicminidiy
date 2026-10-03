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
- **Featured = `isListingFeatured()` (`shared/utils/listingPromotion.ts`): `tier = 'paid'` and a live status (`active`, or `example_paid` for demo rows).** It lasts until the listing is no longer live; a sold, expired, cancelled, pending or draft premium listing is never featured. The homepage strip, the card ring and `FeaturedBadge` (props `tier` + `status`) all follow it. Never read `featured_until`: it is deprecated, and no web path writes it (relist and the admin tier route included). Copy says "featured until sold", never a number of days.
- **A relist never re-queues a social post: neither relist path writes `promoted_on_social` or `promoted_on_social_at`.** A paid listing is posted once; a new post needs a new listing. (This reverses the 30-day re-queue of #922.) The sweep (`post-listing-social`, supabase repo) selects on the FLAG, so it posts a listing only while the flag is false, which is true only for a listing that was never posted or whose post failed and was reverted. The sweep's failure counter lives on the latest `listing_promotions` row and belongs to the backend; the web app never resets it. Any reader of `listing_promotions.features` takes the LATEST row (`created_at DESC, id ASC`, `latestPromotionByListing()`), never an arbitrary one.
- `PUT /api/admin/listings/[id]` corrects CONTENT only; `ADMIN_EDITABLE_COLUMNS` is the boundary and excludes `status`/`tier`/ownership/payment columns. The edit page serves owner (PostgREST, RLS) and admin (this route) on separate paths; SSR passes through and the client decides.
- **Feed item `id` must be an absolute IRI** (`feedItemId()` → `urn:uuid:<id>`), or Atom 500s while RSS/JSON stay green. The RSS `<guid>` keeps the old prefixed strings; readers dedupe on it. Feed tests must SEED rows before asserting. Enclosure URLs go in RAW via `absoluteFeedUrl()`; never `escapeHtml()` a URL into an enclosure.
- `theminiexchange.com` 301s (`tme-redirects.ts`, map in `tmeRedirects.ts`, mirrored to zone rules by `scripts/sync-tme-zone-redirects.py`) are load-bearing SEO; never remove them. The TheMiniExchange repo is retired; make no changes there.
- **Finds link previews (`server/api/exchange/external-listings/parse.post.ts`) fetch Facebook as mobile Safari.** Facebook keys its Marketplace login wall on User-Agent AND egress IP: from Cloudflare's egress every bot identity (a link-preview UA, facebookexternalhit, Twitterbot, Googlebot) and desktop Chrome get the wall, and only a phone browser UA gets the OG head (title, description, image). Do not "fix" it back to an honest bot UA without re-running the probe from a Worker: it passes from a residential IP and fails from the platform. Every other source keeps the desktop-browser defaults. The price regex never scans Facebook HTML: the page embeds a similar-listings rail with other items' prices and not the listing's own. The parser must NEVER hard-fail on empty metadata; the manual-entry path is the fallback. Story: `docs/invariants/marketplace.md`.
