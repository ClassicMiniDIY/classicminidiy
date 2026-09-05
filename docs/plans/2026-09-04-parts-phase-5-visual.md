# Phase 5 — make the archive visual and multi-source

Status: design, in progress. Follows `2026-09-04-parts-number-database.md`, which
this supersedes for Phase 5 only: that plan's Phase 5 was "scheduled refresh, then
Mini Spares and Mini Sport". Cole redirected it on 2026-09-04 after using the live
archive.

## What is wrong with what shipped

Three things, all fair:

1. **A part page says too little.** It carries a part number, a description, its
   supersession chain and a link out. `system`, `category` and `kind` are NULL on
   all 10,073 rows — the ingest never populated them — so there is no context for
   what the part _is_ or what assembly it belongs to.
2. **A part page has no picture.** The archive holds 161 drawings and 37,066
   placed callouts, and shows none of that on the page a reader actually lands on.
3. **`/archive/parts` is an index, not a page.** A search box over 10,073 rows
   serves someone who already knows the part number. It serves nobody browsing.

Underneath all three: the visuals are the value, and they are currently only on
the plate page, which nothing links to prominently.

## The finding that shapes the fix

**`catalogue_section` is not a taxonomy.** It is the leading number in the drawing
filename, and it is a PAGE NUMBER, not a system id. Section "01" contains
Manifolds, Battery, Cooling, Fascias, Front End Panels and Manual Gearbox — six
unrelated systems. "Manual Gearbox" appears under sections 01 through 12, because
those are gearbox pages 1 to 12.

The real taxonomy is the section NAME, also in the filename, and it is exactly the
category a reader thinks in: Manual Gearbox (10 plates, 707 parts), External
Brightwork and Finishers (9), Heating (7), Carburetters (6), Brake Systems (5),
Cylinder Head (4), Internal Engine (4).

It needs cleaning before it can be a menu — around 60 raw names with near
duplicates ("Fuel Tanks, Fuel Pump and Fuel System" vs "...Systems"), hyphen-joined
variants, and one plate whose filename did not match the number pattern at all and
took the whole filename as its name.

## The work, in value order

### A. Show the reader where the part sits — the crop

The highest-value visual addition and it needs no new data: 37,066 callouts already
carry hotspot geometry in image-pixel space, and every plate has a stored drawing.

A part page renders a small window onto its plate, centred on that part's hotspot,
with the outline drawn. Cropped with CSS against the existing preview derivative —
no new storage, no new requests, no new images to generate.

This answers "a portion of the map where it visualizes it" and is the thing that
turns a part number into something recognisable.

### B. Browse by system, not a search box

`/archive/parts` becomes a visual browse: systems, then the plates within each,
each plate as its 23 KB thumbnail. Search stays, as a second way in rather than
the only one.

Needs the section-name cleanup above, expressed as a curated map rather than
`initcap` — which turns "ECUs" into "Ecus".

### C. Fill in what a part page can say

`system` populated from the cleaned section name, plus context already in the data
and not yet surfaced: the assembly a part belongs to, the quantity that assembly
uses, and the other parts sharing its callout.

### D. Multiple places to buy — Mini Spares and Mini Sport

The schema already supports it: `part_source_records` is keyed per source, and a
part page and the MCP tool both already render a list. Today that list has one
entry because there is one source.

This is the largest piece and it is genuinely two new parsers, not a config flag:
Mini Spares has no working sitemap and no plates, Mini Sport's diagrams carry no
hotspot geometry. Their value here is the buy links and the alternative-part
relations, not more drawings.

## Deliberately not doing yet

**Copying retailer product photography.** It would improve a part page, and it is a
different question from the factory drawings. The drawings are reproductions of
BMC/BL plates whose copyright sits with British Motor Heritage; a retailer's
product photograph is that retailer's own creative work, taken by them, this
decade. Same terms cover both, but the second is the one they would mind about.
Raising it rather than quietly doing it — see the open question at the end.

## Open questions

1. **Product photos: copy, hotlink, or leave out?** Recommendation: leave out for
   now. The crop in (A) gives a reader the recognition a photo would, and it uses
   material we have already reasoned about.
2. **How many top-level systems?** Around 60 raw section names is too many for a
   menu and 10 is probably too few. The plate counts suggest a natural dozen or so.
