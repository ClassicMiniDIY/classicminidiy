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

The thirteen-nut tightening order for the MPi cylinder head, from fig. 12M3412 in
RCL0193ENG (2nd Edition, Engine, Repairs) — the manual is itself in the archive, so
the plate and its source travel together.

The head artwork is a potrace vectorisation of the figure's own stencil. The
generator only recolours the manual's numerals into the CMDIY accent and drops its
baked-in `12M3412` caption, because the plate header carries that instead. Those two
edits are index sets over potrace's path list (`NUMERALS`, `FIGURE_CAPTION`), and the
generator asserts the trace still has 64 paths — **re-trace the figure and those
indices are meaningless.** Re-derive them by rendering the classified figure and
looking at it, rather than assuming they carried over.

Load-bearing content, do not trim:

- **The sequence.** Upper row `8, 2, 4, 10`; middle row `9, 3, 5, 11`; lower row
  `13, 6, 1, 7, 12`. Nut 1 is central on the lower row.
- **The torque figures are MPi only** — 34 Nm (25 lb-ft) first pass, 68 Nm
  (50 lb-ft) final. They are _not_ the 848/998 or the earlier eleven-stud figures,
  both of which are lower and live in `data/torqueSpecs.json`. The footer says so on
  the plate itself; a reader who applies 68 Nm to a 998 head is the failure that
  wording exists to prevent.
- **The rocker shaft bracket nuts are a different fastener set** at 25 Nm. The
  procedure panel says so because the figure shows both in the same view.

Metric is the unit the source publishes; the imperial figures are converted. Same
rule as the reference-data unit invariants in the root `CLAUDE.md` — deliver the
source's own unit and label it.
