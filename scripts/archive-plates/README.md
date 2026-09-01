# Archive plates

Vector masters for technical illustrations that Classic Mini DIY draws itself and
publishes into the archive, rather than scanning.

Each plate is a Python generator that emits an SVG. The generator is the source of
truth: geometry (stud positions, sequence order) is computed rather than hand-typed,
so a correction is a one-line change and a re-render instead of a redraw. Keep the
generator and its committed `.svg` in step — regenerate and commit both in the same
change.

## Re-rendering

```bash
python3 scripts/archive-plates/<plate>.py
rsvg-convert -w 4000 scripts/archive-plates/<plate>.svg -o <plate>.png
```

4000px wide is the archive copy. A ~900px render is used for the card thumbnail.
PNG is what gets published because the `archive-documents` and `archive-thumbnails`
buckets accept raster only — the SVG never leaves this repo, which is exactly why it
has to live here.

## Plates

### `cylinder-head-nut-tightening-sequence`

The nine-nut tightening order for an A-series cylinder head, redrawn from the Rover
Mini workshop manual engine section (fig. 12M0143).

Two things on this plate are load-bearing and must not drift:

- **The sequence is the point.** Five-nut row `8, 4, 1, 5, 9`; four-nut row
  `6, 2, 3, 7`. Nut 1 is central. The dashed overlay is derived from that numbering,
  not drawn separately, so it cannot disagree with the badges.
- **The torque figures are 1275 A+ only** — 34 Nm (25 lb-ft) first pass, 68 Nm
  (50 lb-ft) final. They are _not_ the 848/998 or the earlier eleven-stud figures,
  both of which are lower and live in `data/torqueSpecs.json`. The footer says so on
  the plate itself. A reader who applies 68 Nm to a 998 head is the failure this
  wording exists to prevent, so do not trim it for tidiness.

Metric is the unit the source publishes; the imperial figures are converted. Same
rule as the reference-data unit invariants in the root `CLAUDE.md` — deliver the
source's own unit and label it.
