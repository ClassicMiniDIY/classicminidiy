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
  error rather than a validation message. The old client-side
  `useListings().publishListing()` had no callers and is deleted; do not bring
  back a "publish my draft" button.

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

- **Listing owner columns and relist (2026-10-03).** A seller session may write
  the content of its own listing, and nothing that is money, a perk, a ranking
  key or ownership: `tier` (except while the listing is a never-approved draft,
  which is the wizard choosing a plan), `featured_until`, `promoted_on_social`,
  `promoted_on_social_at`, the payment columns, `created_at`, `published_at` and
  `user_id`. The database is the boundary and refuses such a write with `42501`
  (from `classicminidiy-supabase` migration `20261003000002`); the mechanism is
  documented in `classicminidiy-supabase`
  (`docs/plans/2026-10-03-listing-owner-column-guard.md` and its CLAUDE.md). The
  wizard resends unchanged `tier` and `user_id` on every draft save, and that
  stays legal: only a changed value is refused. So a client must never pass a
  protected `timestamptz` through a JS `Date` and send it back: the microseconds
  are lost, the value differs, and the write is refused. Omit the column
  instead.

  The seller relist used to write `published_at`, `featured_until` and the social
  flag from the browser. It is now `POST /api/exchange/listings/[id]/relist`, a
  service-role route that checks ownership, a relistable status
  (`sold`/`expired`/`cancelled`) and an earlier moderator approval, and writes
  only if the status is still the one it read. The admin relist and the seller
  relist build their columns with the same `relistUpdates()`, so "relist" means
  the same thing whoever clicks it by construction. `listing_relisted` carries
  `via: 'route'`, so the rollout can see when tabs running the old client relist
  are gone.

- **Featured is perpetual while the listing is live, and a paid listing is
  posted to social once (Cole, 2026-10-03).** Featured = `isListingFeatured()`:
  `tier = 'paid'` and status `active` (or `example_paid` for demo rows). Before
  this, every reader required a future `featured_until`, the window was 30 days
  from payment, and it started while the listing still waited in moderation; on
  2026-10-03 no active premium listing was featured anywhere on the site.
  `featured_until` is deprecated: no web path reads or writes it, and the column
  is dropped later in its own migration. A relist never writes
  `promoted_on_social` or `promoted_on_social_at`; this reverses the 30-day
  re-queue of #922 ("never repost on socials unless they buy a totally new
  listing"). A new post needs a new listing. The admin tier route writes `tier`
  only and refuses a draft with 409: a premium draft reaches review only through
  the payment path, so a hand grant on a draft left it unsubmittable.

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

## Finds link previews: Facebook needs a phone browser User-Agent (2026-09-18)

The Stage 6 convergence (2026-06-23) replaced TheMiniExchange's Puppeteer scraper with the
SSRF-guarded OG fetch and recorded Facebook Marketplace as a known loss: "login wall, degrades
to manual entry". The wall is keyed on the User-Agent AND on the egress IP, and two findings
in the same afternoon disagreed until both were measured from the right place:

- From a residential IP (curl, `bun run dev`): desktop Chrome gets a 400 "Error" page; an
  honest link-preview UA (`ClassicMiniDIY-LinkPreview/1.0`), `facebookexternalhit`,
  `Twitterbot`, Slack, Discord, Googlebot and iPhone Safari ALL get HTTP 200 with `og:title`,
  `og:description` and `og:image`. The first fix shipped the honest UA on that evidence and
  changed nothing in production.
- From Cloudflare's egress (a throwaway Worker on workers.dev, eight UAs, `www.` and `m.`
  hosts, repeated): desktop Chrome gets the 400; EVERY bot identity gets a 200 login wall
  (`<title>Facebook</title>` after a 302 to `/login/?next=…`); and mobile Safari is the only
  UA that gets the OG head. Jina Reader's renderer gets the wall too, so the render fallback
  does not rescue it.

So `requestHeadersFor` in `parse.post.ts` sends an iPhone Safari UA to Facebook, threaded
through `fetchExternalPage`'s `headers` argument, and keeps the desktop defaults everywhere
else. A residential-proxy fetch service was considered and is not needed while the phone UA
works; if Facebook closes that too, a proxy is the next step, not another UA. The probe
Worker was deleted after the run; it is small enough to recreate: fetch the listing with each
UA and report status, final URL, `<title>` and whether `og:title` / `og:image` are present.

One trap: Facebook's HTML embeds a "similar listings" rail as JSON with THOSE items'
`formatted_price` values, and the listing's own price is not in the payload. The `$`-regex
over the raw HTML therefore returned a neighbour's `$180` for a Mini. `extractPrice` scans
title + description only for Facebook. Tests: "request headers" block in
`tests/unit/exchange/server/routes/external-listings-parse.post.test.ts`.
