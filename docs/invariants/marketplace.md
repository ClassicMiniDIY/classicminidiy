# Marketplace (`/exchange`) invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/marketplace.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

### Marketplace (`/exchange`) Invariants

- **A paid listing is born `draft`, and ONLY the payment path may promote it to
  `pending`.** `ListingWizard.submitListing()` creates paid-tier rows as `draft`
  on purpose, so an abandoned Stripe checkout never lands in the moderation
  queue. That makes the promotion a hard requirement of every surface that
  completes a payment, and there are three: the Sustaining Member comp
  (`grantComplimentaryPremiumListing`), the webhook, and the verify fallback
  (both via `markListingPaid`). All three call `promoteListingToPending` in
  `classicminidiy-supabase/supabase/functions/_shared/listings.ts`.

  Getting this wrong is invisible in testing and total in production. A `draft`
  is filtered out of **both** directions — browse reads `status='active'` only
  (`useExampleListings.activeStatuses`) and the admin queue reads
  `status='pending'` only (`/admin/exchange/moderation`) — so the listing exists,
  is complete, and is readable by nobody but its owner via own-row RLS. From the
  2026-07-13 TME cutover until 2026-08-12 every paid listing landed there. It
  surfaced as a seller reporting his ad had _disappeared_, not that it had never
  published, because the comped confirmation screen claimed "Live Now" in all 10
  locales. Nobody caught it sooner because the paid path also never called
  `/api/exchange/listings/submit`, so no `admin_listing_pending` email ever fired.

  The promotion is deliberately narrow — it moves a listing into review and
  nothing else; completing a payment never publishes anything. Its constraints and
  the reasons for them are documented in `classicminidiy-supabase`. One
  consequence matters on this side: `pending → active` belongs to moderation
  alone, and that transition is also what credits the seller's trust score, so
  repairing a stuck listing by jumping it straight to `active` silently costs them
  that credit. Route it to `pending` and let review approve it.

- **A listing becoming publicly visible is enforced server-side, and client code
  must never try to do it.** Only moderation makes a listing `active`, via the
  admin routes below. Client-side writes that set a listing live are rejected —
  the enforcement lives in the database, so a rejection surfaces as a permission
  error rather than a validation message. `useListings().publishListing()` is a
  leftover with no callers; it is not a supported path and should not be wired to
  a "publish my draft" button.

  **The mechanism, and the reasoning behind its exact shape, are documented in
  `classicminidiy-supabase` (private) — see the `listings` notes in that repo's
  CLAUDE.md.** Deliberately not restated here; see "Public repository" below.
  What you need on this side: if you add any owner-facing action that changes a
  listing's status, exercise it against a real non-admin session before shipping,
  because the server, not the form, is what will refuse it.

- **Admin listing moderation runs through two server routes that must exist:**
  `PUT /api/admin/listings/[id]/status` and `.../tier`. They are the only path to
  `active` (service-role, so they pass the trigger above), and `useAdmin()` has
  been calling them since the TME consolidation — but they were never ported, so
  every approve/reject/relist/tier click 404'd from the cutover until 2026-08-12.
  Combined with paid listings never reaching `pending`, the paid pipeline was dead
  at both ends: nothing arrived in the queue, and nothing could leave it. The
  status route is also what emails the seller on approval — the `on_listing_approved`
  trigger only moves trust counters, so without it the "we'll email you when your
  listing is approved" promise in the submission confirmation goes unkept.

- **Every feed item's `id` must be an absolute IRI, and the feed tests must seed
  rows before asserting on Atom.** The `feed` package renders the Atom entry id as
  `sanitizeUrl(item.id ?? item.link)` — i.e. `new URL(id)` — so a bare row id
  throws `TypeError: Invalid URL` and 500s the route. `rss2()` and `json1()` treat
  the id as an opaque string and never parse it, so the exact same assembled feed
  serves 200 as RSS and JSON while every `.atom` sibling is down. That is what
  happened from the TME cutover until 2026-08-25: all seven Atom endpoints
  (`/exchange/atom.xml` plus the six `/exchange/feed/*.atom`) 500'd, and
  `theminiexchange.com/atom.xml` 301'd straight into one of them.
  `feedItemId()` in `server/utils/exchange/feedBuilder.ts` is the contract — it
  returns `urn:uuid:<row id>` (all three source tables have UUID PKs, so this is
  permanent and unique across sources) and falls back to the item permalink for
  anything that is not a UUID, so it can never produce an unparseable id.

  The RSS `<guid>` is set separately and deliberately keeps the older prefixed
  strings (`<uuid>`, `external-<uuid>`, `wanted-<uuid>`). Readers dedupe on it, so
  changing it would re-notify every subscriber with up to 50 "new" items. Don't
  collapse `guid` into `id`.

  It shipped because the one Atom test ran against an EMPTY feed — rows are reset
  in `beforeEach` and it seeded none, so there was no entry to serialise. A format
  assertion with no items proves nothing about item serialisation; seed rows first.

- **Enclosure URLs go into the feed RAW, and only if they are absolute.**
  `rss2()` and `atom1()` both push an enclosure href through `new URL()`, so the
  same unparseable-URL failure that killed the Atom routes applies to images —
  and there it takes down the RSS routes too, for every item in the feed, not
  just the offending one. `og_image_url` is browser-written (the find submit path
  inserts it through PostgREST, bypassing the rehosting in
  `parse.post.ts`) and a broken image is invisible in moderation because the admin
  thumbnail falls back on `@error`, so a relative or malformed URL can reach an
  approved row. `absoluteFeedUrl()` is the guard: non-absolute or non-http(s)
  drops that item's enclosure and keeps the feed up.

  Do NOT `escapeHtml()` a URL on its way into an enclosure. The library's
  `sanitizeUrl()` already escapes `&` and percent-encodes anything that could
  break out of an XML attribute; pre-escaping double-escapes, so `?w=1&h=2` ships
  as `&amp;amp;` and every reader resolves an image URL that 404s. escapeHtml
  still belongs on the `<img>` in the item's HTML content — that really is HTML.
