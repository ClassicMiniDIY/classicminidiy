# Archive plates

High-resolution technical illustrations that Classic Mini DIY publishes into the
archive as standalone figures, built from a committed vector master rather than a
one-off raster.

Two things live here per plate: a Python generator and the `.svg` it emits. The
generator is the source of truth — regenerate and commit both in the same change.

## Re-rendering

```bash
python3 scripts/archive-plates/<plate>.py
rsvg-convert -w 4000 scripts/archive-plates/<plate>.svg -o <plate>.png
```

4000px wide is the archive copy, ~900px the card thumbnail. PNG is what gets
published because the `archive-documents` and `archive-thumbnails` buckets accept
raster only — the SVG never leaves this repo, which is exactly why it has to live
here.

## Prefer tracing the source over redrawing it

Manual figures in this archive are 1-bit CCITT stencils inside the PDFs, typically
around 300 ppi, so rendering the PDF page at a higher DPI only upscales. Extract the
native stencil and vectorise it instead:

```bash
pdfimages -f <page> -l <page> -png manual.pdf stencil     # native bitmap
magick stencil-000.png -rotate -90 -negate -threshold 50% fig.pbm
potrace fig.pbm --svg -o <plate>.trace.svg --alphamax 1.0 --opttolerance 0.2 --turdsize 2 --unit 10
```

Stencils are often stored rotated and inverted — check before tracing. `potrace`
comes from `brew install potrace`.

**This matters more than it sounds.** A hand redraw of a cylinder head looks fine
until someone who knows the casting sees it: the outline, the spark plug well depth
and the valve gear all carry information, and approximating them produces a drawing
that is wrong in exactly the places a reader is checking. Trace the figure, then
restyle only the labelling.

## Plates

### `cylinder-head-nut-tightening-sequence`

The tightening order for the **1275 A-series nine-stud head**, from fig. 12M3412 in
RCL0193ENG (2nd Edition, Engine, Repairs, PDF page 64) — the manual is itself in the
archive, so the plate and its source travel together.

The head artwork is a potrace vectorisation of the figure's own stencil. The
generator discards all thirteen of the manual's numerals and its baked-in `12M3412`
caption, then sets its own labels at the discarded numerals' exact former positions
so the manual's leader lines still point at the right nut. `DISCARD` is an index set
over potrace's path list and the generator asserts the trace still has 64 paths —
**re-trace the figure and those indices are meaningless.** Re-derive them by
rendering a colour-classified trace and looking at it.

Load-bearing decisions, do not undo:

- **Nine of the thirteen numbered fasteners are head studs; four are not.** The
  studs are relabelled `1`–`9` in the source's own order, and the four rocker
  pedestal fixings become `A`–`D`. Owners identify a head by counting studs, so
  leaving the source's 1–13 makes a nine-stud head read as a thirteen-stud one.
  The renumbering is verifiable rather than invented: taking the studs in the
  source's order gives upper row `6, 2, 3, 7` and lower row `9, 4, 1, 5, 8`, which
  is fig. 12M0143's sequence for the same head, mirrored — that figure views the
  head from the other end.
- **A–D interleave with the studs** — A after 2, B after 3, C after 6, D after 7.
  The procedure panel says so. Drop that line and the plate implies you tighten
  1–9 and then the letters, which is not the published order.
- **A–D are blue, not the house olive.** Olive against the orange is a red-green
  pair, the most common confusion under colour-vision deficiency, and it only
  reached 4.4:1 on white. The blue is 8.6:1 and stays separable under deuteranopia
  and protanopia. Do not "re-brand" it back to olive; olive is panel furniture here,
  never a fastener label.
- **The plate covers two heads.** The 1275 came as a nine-stud and an eleven-stud
  head; the torque figures and the procedure are identical and only the stud count
  differs, so both belong on one plate rather than two. The eleven-stud rows are
  `9, 5, 1, 4, 8` upper and `10, 6, 2, 3, 7, 11` lower, and they are drawn as plain
  numbered dots labelled _schematic_ — there is no traceable factory figure for that
  variant in the archive, and inventing a casting outline is the exact mistake this
  plate already had to unwind once. If an eleven-stud figure turns up in a manual we
  hold, trace it and replace the schematic.
- **The torque figures are 1275 only** — 34 Nm (25 lb-ft) first pass, 68 Nm
  (50 lb-ft) final. They are _not_ the 848/998 or Cooper S figures, both lower, in
  `data/torqueSpecs.json`. A reader who applies 68 Nm to a 998 head is the failure
  the footer wording exists to prevent.
- **The rocker shaft bracket nuts are a third fastener set** at 25 Nm, tightened
  after the sequence — distinct from A–D.

Metric is the unit the source publishes; the imperial figures are converted. Same
rule as the reference-data unit invariants in the root `CLAUDE.md` — deliver the
source's own unit and label it.
