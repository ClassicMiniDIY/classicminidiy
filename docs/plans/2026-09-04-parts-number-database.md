# Classic Mini part-number database — design and feasibility

Status: design + feasibility spike. No code beyond a data fix. Branch
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
   mitigations. Section 1 states the position, the risk, and the five mitigations the
   design adopts as invariants.
2. **The data is machine-readable.** Somerford publishes factory parts-list plates as
   structured callout data, not only as pixels. That makes the callout-to-part join a
   data problem, not an image problem.
3. **The schema is not hard, but it is ragged.** Applicability is free text upstream.
   The design keeps the raw string as the source of truth and treats every parsed facet
   as derived and nullable.
4. **Everything about extraction stays in the private repo.** The schema, the ingest
   code and the scheduled runner all live in `classicminidiy-supabase`. This repo gains
   read consumers only.

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

### 1.4 The five mitigations, adopted as design invariants

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
   and reversed if it is resolved.
5. **A courtesy notice before the first full run.** Somerford is emailed at the address
   their own terms name, before ingest starts. This is a notice of what is being built
   and of the link-back, not a permission gate. Mini Spares and Mini Sport get the same
   note when their ingest starts. Draft in Appendix A.

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
`community`), `licence_status` (`none`, `requested`, `granted`, `declined`),
licence note, terms URL, last reviewed date. Every fact row in every other table carries
a `source_id`.

> **Provenance is `source_id`, never `submitted_by`.** Scraped and licensed rows must
> not touch `contributions`, `contributor_archive_items` or any trust counter — see
> `.claude/rules/contributions.md`. Crediting a scrape to a contributor would corrupt
> the trust pipeline. Community rows, when they arrive in Phase 5, take the normal
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
where it is known), image path in Supabase Storage, image width and height, source URL,
`image_licence` (`copied`, `linked`, `none`), applicability text, status. The licence
column is what makes mitigation 4 a switch rather than a migration.

**`part_diagram_callouts`** — diagram, callout number as text (so "13" and "13A" both
work), part (nullable, because a callout that cannot be resolved is still worth
recording), part number as printed, description as printed, quantity, notes, and the
hotspot outline stored as coordinates in image-pixel space. Unique on diagram, callout
number and part: one callout maps to several parts across different applicability.

**`part_change_log`** — source record, seen-at, change kind (`added`, `changed`,
`missing`, `withdrawn`), and the difference. Admin and service role only.

### 3.2 Access

Public read covers `parts`, `part_supersessions`, `part_kit_contents`,
`part_applicability`, `part_diagrams` and `part_diagram_callouts`, restricted to
published rows. Writes are service role for the ingest, plus the community path through
the submission queue in Phase 5. Two RPCs: a lookup that combines trigram matching on
the normalised part number with text search over descriptions, and the recursive
supersession chain. A parts branch is added to `omnisearch()` in Phase 5.

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

1. **Copy the drawing into a Supabase Storage bucket. Recommended.** It matches how the
   wheels and colours archives already work, needs no new entry in `image.domains`, and
   only requires the new path pattern to be added to the PWA runtime caching rules
   beside the existing archive buckets. Hotspots are stored as our own coordinates and
   rendered as our own overlay: the drawing is copied once, the source's interactive
   widget never is. Every diagram page carries attribution and a link back (mitigation
   1), and the licence column records that the image was copied, so the kill switch can
   hide images without touching the callout data underneath.
2. **Link out only.** The fallback if a source objects. The callout table still renders
   from our own rows, and the drawing is reached through the source URL. Lower value for
   the reader, and the reason it is second, not first.
3. **Hotlink the source's image. Never.** Fragile, and the one behaviour both terms
   templates single out by name.

The drawings carry a second copyright layer of their own, held by British Motor
Heritage rather than by the retailer. That is recorded in §1.3 and is a reason the
licence column exists.

---

## 5. Refresh

Weekly, which matches the change frequency Somerford publishes for its own sitemap.

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
   remembering. Phase 2 uses this deliberately.
3. **n8n.** Good for the alert and approval hop. Poor for a parser over thousands of
   pages: code nodes, no tests, no review. The parser does not go there.

Etiquette, restating mitigation 3 as operational rules: a user agent naming Classic Mini
DIY with a contact address; robots.txt honoured, including the disallowed catalogue,
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

### 7.3 Other properties

The mobile apps read the public tables through PostgREST and call the lookup RPC. That
is a contract only; no app work is in scope here. The marketplace may later attach an
optional part reference to a listing. Out of scope.

---

## Phasing

0. **This change.** Design doc, the trusted-source domain fix, and the private spike
   note. No schema, no crawler.
1. **Migrations** in `classicminidiy-supabase`: tables, RLS, the two RPCs and the
   storage bucket. Then `bun run gen:types` here.
2. **Somerford ingest.** Courtesy email sent first. Then a single local run over roughly
   372 plates and 12,000 products. Verify the callout-to-part resolution rate and count
   the unresolved callouts **before publishing anything**.
3. **Consumers.** The lookup tool and the three archive routes.
4. **Scheduled refresh** in the private repo, then Mini Spares and Mini Sport — the
   alternative and kit relations first, callout tables second.
5. **Community contributions** and the `omnisearch()` branch.

---

## Open questions for Cole

1. **Ask Somerford for a licence, or only notify them?** The recommendation is to notify
   (Appendix A) and not to ask. A request creates a decision point where silence
   currently costs nothing, and their terms already name the address for one. If the
   answer to an ask were yes, the licence status column and the storage copy are already
   built for it.
2. **Should the lookup tool be free or paid?** Recommendation: free, matching the other
   archive tools. The Developer API tier is a plausible place for bulk part export
   later, and that is a different tool.
3. **Should a trusted-source domain be checked for DNS resolution in CI?** The typo
   fixed here removed a source from web search for the entire life of the allowlist, and
   nothing failed. A resolution check would have caught it. It is deliberately **not**
   added in this change: `tests/static` does no network I/O, and adding it would make a
   fast offline suite dependent on DNS. The options are a separate scheduled workflow, a
   manual review item, or accepting the risk.
4. **Which factory catalogue references should seed `part_sources` as
   `factory-catalogue`?** The AKD and AKM parts catalogues outrank every retailer in the
   precedence order, and having the top precedence tier empty at launch is a choice
   worth making on purpose.

---

## Appendix A — courtesy notice, draft

To be sent to Somerford at the address their own terms name, before the first full run.
Not a permission request.

> Subject: Classic Mini DIY — parts reference, and a link back to you
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

The same note, adjusted for the source, goes to Mini Spares and Mini Sport when their
ingest starts.

## Appendix B — the spike note

Raw findings from the spike — page structure detail, payload shapes, sitemap layout,
table column order, the terms clauses in full and the throwaway probe script — are in
the **private** repository:

`classicminidiy-supabase/docs/plans/2026-09-04-parts-db-spike-notes.md`

They are there and not here because this repository is public and that material is a
recipe. See the public-repository rule at the top of `CLAUDE.md`.
