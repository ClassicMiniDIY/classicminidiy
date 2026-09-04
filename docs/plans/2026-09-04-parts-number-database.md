# Classic Mini part-number database — design and feasibility

Status: design + feasibility spike. **Phase 1 built and verified on the local stack,
not yet applied to the remote project** — migration `20260904000001_parts_number_database.sql`
in `classicminidiy-supabase`, branch `feature/parts-db-phase-1`. Branch here:
`feature/parts-number-database`.

Follows `docs/plans/2026-09-04-chat-agent-knowledge-expansion.md`, which gave `/chat`
allowlisted web search over `data/trustedSources.ts` and named this project as the
carve-out: "a crawler, a schema (which would live in `classicminidiy-supabase`, not
here), a refresh cadence, and a terms-of-service question about bulk-extracting a
commercial retailer's catalogue."

## Summary

The chat agent can read one retailer page it finds. It cannot enumerate a catalogue,
and nothing it reads becomes archive data. A part-number database closes both gaps: a
part number, its supersession chain, what it fits, what a kit contains, and which
factory plate it appears on, all held as our own rows and served to the archive, the
MCP tools and the mobile apps.

The spike answered seven questions. The findings, in order of how much they constrain
the design:

1. **Legality is the governing constraint.** All three candidate sources reserve rights
   and require written permission for reuse. Cole's recorded decision is to proceed with
   mitigations. Section 1 states the position, the risk, and the four mitigations the
   design adopts as invariants.
2. **The data is machine-readable.** Somerford publishes factory parts-list plates as
   structured callout data, not only as pixels. That makes the callout-to-part join a
   data problem, not an image problem.
3. **The schema is not hard, but it is ragged.** Applicability is free text upstream.
   The design keeps the raw string as the source of truth and treats every parsed facet
   as derived and nullable.
4. **Everything about extraction stays in the private repo.** The schema, the ingest
   code and the scheduled runner all live in `classicminidiy-supabase`. This repo gains
   read consumers only — plus one admin screen, `/admin/parts`, which is the licence kill
   switch (§7.3) and ships in Phase 2, ahead of the first row of data.

A domain typo is also fixed here. The Somerford entry in `data/trustedSources.ts`
carried a pluralised misspelling of the domain, and that spelling does not resolve — it
is NXDOMAIN, and DNS records no history of it. The allowlist entry could therefore never
match, so **Anthropic web search has never once covered Somerford**, and nothing failed
to say so. The registrable domain is `somerfordmini.co.uk`, which `data/models/decoders.ts`
already used correctly. Fixed in a separate commit, with the id and name corrected to
match the company at the same time.

---

## 1. Legality

### 1.1 What the three terms pages say

Quoted for analysis. Section numbers are the sites' own.

| Source                                     | Robots and signals                                                                                                                                                                                                                                                                        | Operative terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Somerford Mini** (`somerfordmini.co.uk`) | Robots allows all user agents; only account, checkout and comparison paths are disallowed. No Content-Signal header. A sitemap index covers roughly 372 category plates and about 12,000 products, marked as changing weekly with current modification dates.                             | Conditions of use §4.2: "You may print off one copy, and may download extracts … for your personal reference". §4.3: "you must not use any illustrations, photographs … or any graphics separately from any accompanying text". §4.5: "You must not use any part of the materials on our sites for commercial purposes without obtaining a licence to do so from us or our licensors". §11.3: "nor may you create a link to any part of our sites other than the home page". §11.4: "If you wish to make any use of material on our sites other than that set out above, please address your request to spares@somerfordmini.co.uk". |
| **Mini Spares** (`minispares.com`)         | Behind Cloudflare. The managed robots block sets `Content-Signal: search=yes, ai-train=no, use=reference` and disallows the named AI crawlers by user agent, including `ClaudeBot`. Generic agents are allowed outside the catalogue, search and customer paths. The sitemap returns 503. | Terms §5.1: "Mini Spares Centre Ltd is the owner of the copyright in the website and no part of the website may be reproduced in any material form (including without limitation, photocopying or storing it in any medium by electronic means) without the written consent and permission of Keith Dodd and Mini Spares Centre Ltd." §5.2 disclaims accuracy.                                                                                                                                                                                                                                                                       |
| **Mini Sport** (`minisport.com`)           | Behind Cloudflare, with the same managed Content-Signal block and the same named AI crawlers disallowed. Query-string URLs and the internal catalogue and search paths are disallowed; category and product pages are allowed. The sitemap returns 404.                                   | Website terms of use are the same template as Somerford: personal reference only; "must not use any illustrations … separately from any accompanying text"; "nor may you create a link to any part of our site other than the homepage"; "If you wish to make any use of material on our site other than that set out above, please address your request to info@minisport.co.uk". Copyright notice: "© Copyright 2019 - Present Mini Sport. All Rights Reserved."                                                                                                                                                                   |

Two things follow directly. First, no source grants bulk reuse; all three route it to a
permission request. Second, the Content-Signal values on the two Magento sites read
`search=yes, use=reference`, which is consistent with what the chat agent already does.
Anthropic's retrieval agents are distinct from the blocked training crawler, so the
existing web search needs no change.

### 1.2 The decision

**Cole's decision, 2026-09-04: proceed.** The stated rationale is that the exploded
views and part numbers are public information because of the age of the material, the
use is non-commercial, and the references are free archival references.

This is the governing position for the rest of the document. It is recorded once and is
not reopened below.

### 1.3 The risk, stated plainly

This is a position and its risk. It is not legal advice.

Part numbers, descriptions, applicability and supersession are facts. Facts are not
protected by copyright, and restating them in our own words and our own layout is the
part of this project with no meaningful exposure. Two things sit outside that.

**The drawings.** The exploded views are reproductions of the BMC, BL and Rover factory
plates. Copyright in a published corporate artistic work runs 70 years from publication
in the UK, so 1959–2000 material expires between 2030 and 2071. British Motor Heritage
licenses this material today, and Somerford's own navigation carries a heritage
approval page. Age does not yet clear the drawings, whatever it does for the numbers.

**Database right.** The larger exposure is not copyright at all. The Copyright and
Rights in Databases Regulations 1997 protect a compiled catalogue for 15 years,
independently of whether its contents are facts, where there has been substantial
investment in obtaining or verifying them. Extracting a substantial part of such a
catalogue is the act the right covers. "Commercial" in that assessment is judged on the
enterprise as a whole — memberships, the marketplace, the paid Developer API — not on
whether one reference page is free to read.

The realistic outcome of a dispute is a takedown request or a cease-and-desist letter,
not litigation. Every mitigation below costs nothing and is designed so that such a
request can be honoured in minutes rather than argued about.

### 1.4 The four mitigations, adopted as design invariants

These are not aspirations. Each one is a named column, route or setting in the sections
below, so a later change that drops one shows up in a diff.

1. **Attribution and link-back on every part and every diagram.** Each public row
   carries its source name and source URL, rendered on the page. The archive sends
   traffic to the retailer instead of replacing it.
2. **Never store or show prices, stock or retailer product identifiers on a public
   surface.** Commercial data stays out of the public tables entirely; retailer
   identifiers stay in the service-role record table because the ingest needs them to
   re-find a page.
3. **The crawler identifies itself and behaves.** A user agent that names Classic Mini
   DIY and a contact address, robots.txt honoured, at most one request per second,
   sitemap-driven rather than link-crawling. This is the same standard the site's own
   WAF applies to crawlers that visit us — see
   `docs/runbooks/2026-07-30-ai-crawler-firewall.md`.
4. **A published takedown contact and a per-source kill switch.** `/archive/parts`
   carries the contact. Setting a source's licence status to declined hides every row
   from that source without deleting anything, so a request can be honoured immediately
   and reversed if it is resolved. The switch is a toggle on `/admin/parts` (§7.3), and
   it is **enforced in the database, not in the page** — a kill switch that depends on
   every consumer remembering to filter is not a kill switch.
   **Not adopted: a courtesy notice before the first run.** An earlier draft of this design
   made a proactive email to Somerford the fifth mitigation. **Cole's decision, 2026-09-04:
   do not send it — say nothing until contacted.** Recorded here rather than dropped
   silently, because the four mitigations above were sized against a risk posture that
   included it.

What changes without it: the first Somerford hears of the archive is finding it. The
link-back, the absence of prices and stock, the crawler etiquette and the kill switch all
still stand on their own, and all four are visible to anyone who looks at a page or at a
request log — so the good-faith evidence is in the artefact rather than in an email
nobody may have read. What is lost is the chance to have the conversation on our timing
instead of theirs. Appendix A keeps the drafted text, repurposed as the prepared reply
for inbound contact, so a response does not have to be written under time pressure.

**Source priority for ingest:** Somerford first, for the diagrams and callouts. Mini
Spares second, for alternatives, kits and the deepest coverage. Mini Sport third, for
body panels and a few callout tables.

---

## 2. Structure of the three sources

Contract level only. This repository is public, so selectors, page internals and exact
request shapes are not recorded here. They are in the private spike note (Appendix B).

**Somerford is the diagram source, and the diagrams are data.** Each category page is a
factory parts-list plate presented two ways. One view is a line drawing with callout
numbers, published together with structured callout data: a callout number, a product
identifier, a product name, a quantity, a link, and the outline coordinates of each
callout region in image-pixel space. The other view is a plain table with five columns —
callout number, part number, description, quantity, notes — where heading rows carry the
sub-assembly and applicability text, for example an alternator type with a year range,
or a starter type with the engine sizes it applies to. Table rows are not linked, and a
product's page address contains its part number only about four percent of the time in a
sample of 1,000. The join from a callout to a product therefore runs through the
structured identifiers, never through the address. Product pages carry schema.org
`Product` structured data with `sku`, `name`, `image` and `offers`, plus a breadcrumb
list. They carry no applicability field and no supersession field.

**Mini Spares is the relationship source.** Product pages carry schema.org `Product`
structured data with `sku`, `mpn`, `brand`, `description`, `image` and `offers`. Three
further sections are unstructured but consistent across the catalogue: an alternative
parts list, which is the supersession and alternative relation; a kit contents list,
which is a bill of materials with quantities; and links into their own online mechanical
parts manual, which means they hold diagrams too. Applicability is free text in the
title and description, such as a year range or a model qualifier. Category pages expose
a product identifier per tile. There are no callout tables.

**Mini Sport is a secondary source.** Product pages carry schema.org `Product`
structured data with `sku`, `mpn`, `upc`, `weight` and `description`, with applicability
again as free text, plus a short attribute table giving the SKU and the manufacturer.
Some product pages embed a diagram callout table with four columns — number,
description, notes, part number — beneath a hand-drawn image. There is no hotspot
geometry, so those diagrams are callout tables with a picture, not interactive plates.

**Access behaviour observed during the spike.** All three sites returned normal
responses to a browser user agent, with no challenge presented and no rate limiting seen
at one request per second. The spike was a handful of pages fetched by hand. Nothing was
crawled, and nothing beyond a few example rows was retained.

---

## 3. Schema

All of it lives in `classicminidiy-supabase`. This repository never gains a migration;
it runs `bun run gen:types` after the migration lands and consumes the generated types.

Conventions follow the existing archive tables: a uuid primary key, a `metadata jsonb`
column, `created_at` and `updated_at`, the established RLS pattern, and the trigram and
weighted text-search precedents already present in that repo. Every table is prefixed
`part_`.

### 3.1 Tables

**`part_sources`** — slug, name, domain, kind (`retailer`, `factory-catalogue`,
`community`), `licence_status` (`none`, `requested`, `granted`, `declined`), terms URL,
precedence, last reviewed date. Publicly readable, because every part and diagram page
renders the attribution and the link from it. A declined source drops out of this read
too, so no page can credit a source we were asked to stop using. Every fact row in every
other table carries a `source_id`.

**`part_source_private`** — the sensitive half, split off on the same reasoning as
`profiles` / `profile_private`: licence note, who changed the licence status and when,
contact address, and the crawl budget (§5). No public policy at all. Splitting the table
rather than granting columns is deliberate — the column-grant regime used by the wheels
and colours archives breaks `select('*')` and taxes every future column.

The licence status is the kill switch, so the row also records who last changed it, when,
and why: `licence_changed_by`, `licence_changed_at`, and a required reason captured into
the licence note. A takedown is the one action here most likely to be asked about months
later — by the retailer, or by Cole trying to remember what was agreed — and an
unattributed status flip answers none of those questions. The admin audit log gets the
same entry; this column pair is the copy that survives beside the data it governs.

> **Provenance is `source_id`, never `submitted_by`.** Scraped and licensed rows must
> not touch `contributions`, `contributor_archive_items` or any trust counter — see
> `.claude/rules/contributions.md`. Crediting a scrape to a contributor would corrupt
> the trust pipeline. Community rows, when they arrive in Phase 6, take the normal
> route: `submitted_by`, the submission queue, and `server/utils/archiveApprovals.ts`
> imported rather than copied.

**`parts`** — canonical identity, one row per part number. A normalised number
(uppercased, spaces and hyphens stripped) with a unique constraint, a display number,
description, kind (`genuine`, `reproduction`, `kit`, `assembly`), system or category,
notes, and status (`published`, `hidden`, `withdrawn`).

**`part_source_records`** — one row per source and source reference. Title and
description as listed, source URL, the raw payload, a content hash, first-seen and
last-seen timestamps, a missing-since timestamp and a current flag. Service role only,
because it holds retailer identifiers and licensed payloads. **No prices and no stock
are stored, ever** (mitigation 2).

This table is also the conflict story. Canonical values in `parts` are chosen by source
precedence — factory catalogue, then Somerford, then Mini Spares, then Mini Sport, then
community — with an admin override column that wins over all of them. The losing values
are not discarded. They stay visible on their record rows, so a disagreement between two
retailers is inspectable rather than silently resolved.

**`part_supersessions`** — predecessor, successor, relation (`supersedes`,
`alternative`, `equivalent`), source, note. A check constraint forbids a row pointing at
itself. The chain is served by a recursive RPC rather than materialised. Cycle detection
belongs in the ingest, where it can report which source produced the cycle; the database
only refuses the trivial case.

**`part_kit_contents`** — kit part, component part, quantity, source.

**`part_applicability`** — the ragged one, and the one most likely to be got wrong.

> **The raw upstream string is kept and is the source of truth.** Every facet is derived
> and nullable: year from, year to, body, engine, fuel system, transmission, drive side,
> market, trim. A confidence value and a source accompany them. **A row is never dropped
> because the parser could not facet it.** An unparsed qualifier still renders as text
> and still tells the reader something true; a discarded one is a fact deleted because
> our regular expression was weak.

**`part_diagrams`** — source, title, catalogue section (the factory plate reference
where it is known), image path in the private Supabase Storage bucket, image width and
height, source URL, `image_licence` (`copied`, `linked`, `none`), applicability text,
status. The licence column is what makes mitigation 4 a switch rather than a migration.
The stored path is never rendered directly: pages resolve it to a signed URL at request
time (§4), so a declined source's drawings stop being served rather than merely stopping
being linked.

**`part_diagram_callouts`** — diagram, callout number as text (so "13" and "13A" both
work), part (nullable, because a callout that cannot be resolved is still worth
recording), part number as printed, description as printed, quantity, notes, and the
hotspot outline stored as coordinates in image-pixel space. Unique on diagram, callout
number and part: one callout maps to several parts across different applicability.

**`part_change_log`** — source record, seen-at, change kind (`added`, `changed`,
`missing`, `withdrawn`), and the difference. Admin and service role only.

### 3.2 Access

Public read covers `part_sources`, `parts`, `part_supersessions`, `part_kit_contents`,
`part_applicability`, `part_diagrams` and `part_diagram_callouts`, restricted to published
rows from non-declined sources. Writes are service role for the ingest, plus the community
path through the submission queue in Phase 6.

> **An RLS policy does not confer the privilege it filters.** A new table in this project
> lands with no table grants for `anon` or `authenticated`, so a correct `FOR SELECT`
> policy still returns `42501 permission denied` to every browser client. The migration
> grants `SELECT` explicitly on the seven public tables and nothing at all on the five
> private ones. This was found by executing a read as `anon` against the local stack — the
> full migration applied cleanly first, which is why policy review alone would not have
> caught it. Recorded as an invariant in the private repo's `CLAUDE.md`.

Two RPCs, both `SECURITY INVOKER` so the caller's RLS — including the kill switch —
applies rather than being re-implemented inside a definer function: a part lookup, and the
recursive supersession chain.

The lookup uses **trigram and `ILIKE` with a positional rank, not `tsvector`**, following
the reasoning already recorded on `omnisearch()`: these queries are part numbers as often
as words, and stemming actively hurts `12G2994`. Rank is deterministic — exact, then
prefix, then contains, then description — because a lookup that reorders between identical
calls is hard to trust. Revisit if this passes roughly 50,000 rows.

A parts branch is added to `omnisearch()` in Phase 6.

`data/parts.json` and the existing `parts-equivalency` MCP tool stay exactly as they
are. Those 24 hand-curated service cross-references are a different thing from a
catalogue: curated, short, and correct. They sit beside the new tables and are not
migrated into them.

---

## 4. Images

Context to cite rather than re-decide: `docs/plans/2026-08-24-s3-to-r2-analysis.md` is
**decided as of 2026-08-24 — stay on S3**, and R2 is not a live option. Archive content
images, however, already live in Supabase Storage and are served through
`auth.classicminidiy.com`, which is already in the image allowlist.

Ranked:

1. **Copy the drawing into a PRIVATE Supabase Storage bucket, served by signed URL.
   Decided (Cole, 2026-09-04).** It matches how the wheels and colours archives already
   work and needs no new entry in `image.domains`. Hotspots are stored as our own
   coordinates and rendered as our own overlay: the drawing is copied once, the source's
   interactive widget never is. Every diagram page carries attribution and a link back
   (mitigation 1), and the licence column records that the image was copied.

   **Private, not public, is what makes the kill switch real.** A public object stays
   fetchable by anyone holding its URL after the row is hidden, which reduces a takedown
   to "we stopped linking it". Signed URLs mean declining a source stops the drawings
   being served, not just being shown. The costs, accepted with the decision: a signing
   step on render, no plain CDN caching of the object itself, and the PWA runtime caching
   rules need a signed-URL-aware pattern rather than the plain archive-bucket pattern the
   other archives use. Settle the URL lifetime in Phase 1 — long enough that a reader
   scrolling a plate does not see images expire, short enough that a leaked link is not
   permanent.

2. **Link out only.** The fallback if a source objects but is content to be cited. The
   callout table still renders from our own rows, and the drawing is reached through the
   source URL. Lower value for the reader, and the reason it is second, not first.
3. **Hotlink the source's image. Never.** Fragile, and the one behaviour both terms
   templates single out by name.

The drawings carry a second copyright layer of their own, held by British Motor
Heritage rather than by the retailer. That is recorded in §1.3 and is a reason the
licence column exists.

---

## 5. Refresh

Weekly, which matches the change frequency Somerford publishes for its own sitemap.

### 5.1 The crawl is a budgeted queue, not a walk

Somerford's first import is roughly 372 plates plus 12,000 products. Run as a single pass
at one request per second, that is about three and a half hours of unbroken traffic from
one address. It reads as a scrape in their logs, it is the shape most likely to trip a
WAF, and it offers no point at which to stop and look at what came back.

So the crawl drains a queue under a budget, in two moves:

- **Discovery** reads the sitemap and upserts one `part_ingest_queue` row per URL — about
  thirteen requests for the whole Somerford catalogue.
- **Drain** takes the next `max_requests_per_run` rows, plates before products, spaced by
  `min_request_interval_ms`, and stops.

An import is therefore a series of small resumable runs rather than one long burst, and
the same machinery does the weekly refresh afterwards. Progress lives in the queue rather
than in a cursor, so an interrupted run loses nothing and a re-run never re-fetches what
it already has.

**The rate limits live in data, not in code.** `part_source_private` carries
`crawl_enabled`, `max_requests_per_run`, `max_requests_per_day`, `min_request_interval_ms`
and `max_change_ratio` per source, so throttling a source is an admin edit rather than a
deploy. `crawl_enabled` defaults to false: adding a source never starts traffic by itself.

`part_ingest_runs` records every run — requests made, records seen, written, unchanged and
missing, and why it stopped. It does two jobs: it enforces the rolling daily cap, and it
is the durable evidence that the crawl ran at the rate we said it would, which is the only
mitigation whose compliance can be demonstrated after the fact.

Change detection is cheap first and expensive second: the sitemap's modification date
decides whether a page is fetched at all, and a content hash of the normalised record
decides whether anything is written.

Disappearance is handled conservatively. A record that stops appearing gets a
missing-since timestamp and keeps its row. After three consecutive misses — at least
three weeks — it is marked withdrawn. **Nothing is deleted, and the ingest never deletes
a canonical `parts` row.** A retailer discontinuing a line is not evidence that the part
never existed, and this archive outlives the shops it learned from.

One safety valve: if a run finds that more than 20% of a source's records are missing or
changed, it aborts without applying anything and queues an admin email through
`notification_queue` and the SES notification function. A site redesign, a WAF change or
a parser regression all look identical from inside the ingest, and all three should stop
the run rather than rewrite the archive. Every run writes a summary to
`part_change_log`.

---

## 6. Where the ingest runs

Ranked:

1. **A scheduled GitHub Action in the private `classicminidiy-supabase` repository.
   Recommended.** Scheduled plus manually dispatchable, shaped like the existing nightly
   workflow there. The ingest code lives with the schema it writes, the extraction logic
   never enters this public repository, the secrets are already present, and the run
   logs are retained. Trade-off: a six-hour job ceiling and no state between runs except
   what is in the database. Written in Bun and TypeScript, following the existing
   migration scripts in that repo (paginated walk, field map, upsert) and reusing the
   safe-fetch, capped-body and structured-data-parsing ideas already in
   `server/utils/external-models/`.
2. **A local run Cole triggers.** Best for the first bulk import and for spikes, because
   a human watches it and can stop it. Worst for cadence, because it depends on someone
   remembering. Phase 3 uses this deliberately.
3. **n8n.** Good for the alert and approval hop. Poor for a parser over thousands of
   pages: code nodes, no tests, no review. The parser does not go there.

Etiquette, restating mitigation 3 as operational rules — and note that the per-source
budget in §5.1 is what enforces most of it, in data rather than in a code path someone can
forget: a user agent naming Classic Mini DIY with a contact address; robots.txt honoured, including the disallowed catalogue,
search and query-string paths on the two Magento sites and the account and sorting paths
on Somerford; at most one request per second; driven by sitemaps where they work and by
category pages where they do not, since one sitemap returns 503 and another 404; and any
source whose licence status is declined is skipped entirely.

None of this touches the chat agent. Anthropic's web search runs on Anthropic's
infrastructure against the allowlist, and is unaffected by our crawler policy.

---

## 7. Consumers

### 7.1 MCP tool

A new `server/mcp/tools/parts-lookup.ts`, following `wheel-search.ts` exactly: the
service client, an explicit column list rather than a wildcard select, a filter to
published rows, over-fetch by one so truncation is reported exactly, readable errors,
and a camelCase remap that includes a canonical URL on classicminidiy.com.

Inputs: a free-text query, an exact part number, a supersession flag defaulting to true,
and a capped limit. Output: matches, the supersession chain, applicability rows, the
diagrams a part appears on with its callout number, and formatted text that must include
the chain — a superseded number returned without its successor is a wrong answer given
confidently.

The checklist that goes with a new tool: register it in the agent tool definitions, add
a call case to `scripts/test-mcp-transport.sh` (it is the fail-closed pre-deploy gate),
decide its tier in `shared/utils/mcpTiers.ts` — **recommendation: free**, because the
archive's purpose is to be reachable — add prompt guidance so a specification question
reaches this tool before web search, add the row to `server/mcp/README.md`, and let
`tests/static/agent-tool-registry.test.ts` pin the registry.

### 7.2 Archive pages

Three routes, all daisyUI 5 and Font Awesome 6 in class form, all with ten-locale
`<i18n>` blocks, all returning a 404 on a miss, and none passing a possibly-empty string
to `ogImage`:

- `/archive/parts` — search and facets, using `useFacetedSeo()` because it takes query
  parameters. Carries the takedown contact (mitigation 4).
- `/archive/parts/[number]` — description, the supersession chain as a timeline,
  applicability rows including any qualifier that was never parsed, the diagrams the part
  appears on, and source attribution with a link back (mitigation 1).
- `/archive/parts/diagrams/[id]` — the drawing with our own hotspot overlay and the
  callout table beside it, each callout linking to its part.

### 7.3 Admin surface — the licence kill switch

`/admin/parts`, wrapped in `<AdminShell>` like every other admin page, added to the
shell's `NAV_GROUPS` under **Review** beside 3D Models. One row per source: name, domain,
kind, current licence status, when it was last reviewed, and live counts of what that
source currently contributes — parts, diagrams, callouts, applicability rows.

**Those counts are the point of the screen.** The status control matters less than
knowing, before the click, that declining Somerford hides roughly 12,000 parts and 372
diagrams. A kill switch nobody dares pull because they cannot see its blast radius does
not get pulled during the phone call that needs it.

Controls: a four-way status control (`none`, `requested`, `granted`, `declined`) plus a
required reason. Moving a source **to** `declined` asks for confirmation and states the
row counts in the confirmation text; every other transition applies directly. Declining
is reversible by design — it hides rows, it never deletes them, and restoring the
previous status brings the same rows back with no re-ingest.

**Route:** `server/api/admin/parts/set-licence.post.ts`, modelled directly on
`server/api/admin/models/set-status.post.ts` — `requireAdminAuth`, service client, an
allowlist of the four statuses, 404 on an unknown source, a no-op short circuit when the
status is unchanged, and an `admin_audit_log` insert recording the from-status,
to-status, reason and source name.

Two invariants this must not violate:

> **It gets its own route. It does not join an edit allowlist.** `licence_status` is a
> moderation control, and `ADMIN_EDITABLE_COLUMNS` and `EDIT_TARGETS` never gain
> moderation columns (`CLAUDE.md`, `.claude/rules/admin.md`). The precedent is
> `users/toggle-admin.post.ts` and `models/set-status.post.ts`: single-purpose routes
> that validate one transition and write one audit row.

> **Enforcement belongs to the read policy, not to the consumers.** Public reads of the
> six published tables must already exclude rows whose source is declined, so the MCP
> lookup tool, the three archive routes, the mobile apps and any future feed all go dark
> together the moment the toggle flips. If each consumer filters for itself, the switch
> is only as good as the last consumer someone remembered to update — and the one that
> forgets is the one quoted back in the complaint.

One operational caveat to settle in Phase 4: if the public parts reads are cached at the
edge, the toggle must purge that cache or the switch will appear not to work for the
length of the TTL. "It is hidden, give it fifteen minutes" is not an answer to a takedown
request.

### 7.4 Other properties

The mobile apps read the public tables through PostgREST and call the lookup RPC. That
is a contract only; no app work is in scope here. The marketplace may later attach an
optional part reference to a listing. Out of scope.

---

## Phasing

0. **This change.** Design doc, the trusted-source domain fix, and the private spike
   note. No schema, no crawler.
1. **Migrations** in `classicminidiy-supabase` — **built, verified locally, not yet
   applied to the remote project.** Twelve tables, RLS on all of them, explicit grants,
   the two RPCs, and the **private** `parts-diagrams` bucket. Verified by
   `snippets/verify_20260904_parts_kill_switch.sql`: nine self-seeding checks that roll
   back, covering the kill switch on parts, sources and callouts, its reversibility,
   lookup ranking, cycle termination, bucket privacy and crawl-off-by-default. Remaining:
   settle the signed-URL lifetime, apply to remote, then `bun run gen:types` here.
2. **The kill switch, before any data exists to kill.** `/admin/parts` and its route,
   plus the declined-source exclusion in the public read policy. This is deliberately
   ahead of the ingest: a mitigation that arrives after the material it mitigates is not
   a mitigation, and the window where rows are public with no way to pull them is the one
   window this project cannot afford. It is a small screen over an empty table, which is
   also the easiest time to build it.
3. **Somerford ingest.** A single local run over roughly
   372 plates and 12,000 products. Verify the callout-to-part resolution rate and count
   the unresolved callouts **before publishing anything**.
4. **Consumers.** The lookup tool and the three archive routes.
5. **Scheduled refresh** in the private repo, then Mini Spares and Mini Sport — the
   alternative and kit relations first, callout tables second.
6. **Community contributions** and the `omnisearch()` branch.

---

## Decisions taken, and the one question left

1. **The lookup tool is free**, matching the other archive tools. The Developer API tier
   is a plausible home for a bulk part export later; that is a different tool.
2. **No DNS resolution check in CI.** The typo fixed here removed a source from web
   search for the entire life of the allowlist and nothing failed, so a check would have
   earned its place — but `tests/static` does no network I/O, and making a fast offline
   suite depend on DNS is the wrong trade. Backlogged as a separate scheduled workflow.
3. **Diagram images live in a private bucket, served by signed URL** (Cole, 2026-09-04).
   See §4. Decided in Phase 1 while the bucket is empty, because retrofitting it once 372
   diagrams are public is not free.
4. **Which factory catalogue references should seed `part_sources` as
   `factory-catalogue`?** The AKD and AKM parts catalogues outrank every retailer in the
   precedence order. **Working answer: leave that tier empty at launch** and add a source
   when there is an actual copy to work from. Flagged because an empty top precedence tier
   should be a choice, not an oversight.

---

## Appendix A — prepared reply to inbound contact, draft

**Not sent proactively** — see §1.4. This is the response to have ready if Somerford (or
either of the other two) contacts us about the archive, so it does not have to be written
under time pressure. Adjust the opening to answer whatever they actually asked, and if
the message is a takedown request, pull the switch on `/admin/parts` first and say so in
the reply.

> Subject: Re: Classic Mini DIY — parts reference
>
> Hello,
>
> I run Classic Mini DIY, a free reference archive for classic Mini owners
> (classicminidiy.com). I am building a part-number reference: a part number, what it
> superseded, what it fits, and which factory plate it appears on.
>
> Your catalogue is the best-organised presentation of the factory parts plates on the
> web, and I want to be straightforward about how I intend to use it. Every part and
> every diagram in our archive will name Somerford Mini as the source and link to your
> page for it. We will not show prices or stock, and we will not sell parts. Our
> requests identify themselves, follow your robots file, and run at no more than one per
> second.
>
> If any of that is unwelcome, tell me and I will remove your material from the archive.
> There is a contact address on the reference pages for exactly that.
>
> Cole Gentry
> Classic Mini DIY

The same reply, adjusted for the source, covers Mini Spares and Mini Sport.

## Appendix B — the spike note

Raw findings from the spike — page structure detail, payload shapes, sitemap layout,
table column order, the terms clauses in full and the throwaway probe script — are in
the **private** repository:

`classicminidiy-supabase/docs/plans/2026-09-04-parts-db-spike-notes.md`

They are there and not here because this repository is public and that material is a
recipe. See the public-repository rule at the top of `CLAUDE.md`.
