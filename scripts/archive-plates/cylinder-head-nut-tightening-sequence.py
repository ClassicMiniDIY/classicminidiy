#!/usr/bin/env python3
"""Archive plate: MPi cylinder head nut tightening sequence (fig. 12M3412).

The head artwork is NOT redrawn by hand. It is a potrace vectorisation of the
figure's own 624x1056 CCITT stencil, lifted from the archive's copy of
RCL0193ENG, so the casting outline, the spark plug wells and the rocker gear are
the manual's geometry rather than an approximation of it. This script only
recolours the manual's numerals into the CMDIY accent, drops its baked-in
"12M3412" caption (the plate header carries it instead), and frames the result.

Re-render with::

    python3 scripts/archive-plates/cylinder-head-nut-tightening-sequence.py
    rsvg-convert -w 4000 scripts/archive-plates/cylinder-head-nut-tightening-sequence.svg -o plate.png
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent
TRACE = HERE / "cylinder-head-nut-tightening-sequence.trace.svg"

W, H = 1600, 1320

INK     = "#1c1f24"
LINE    = "#111418"
SUBINK  = "#5b6169"
RULE    = "#c7ccd1"
ACCENT  = "#ed7135"   # CMDIY secondary
OLIVE   = "#6b7a52"   # CMDIY accent
PAPER   = "#ffffff"

FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"
MONO = "Menlo, DejaVu Sans Mono, Courier New, monospace"

# Path indices in the potrace output. Verified by rendering the classified
# figure and reading it: every numeral orange, nothing else touched.
NUMERALS = {0, 1, 2, 3, 4, 24, 25, 26, 27, 28, 50, 51, 52, 53, 54, 55, 56}
FIGURE_CAPTION = {57, 58, 59, 60, 61, 62, 63}   # the artwork's own "12M3412"

# Native stencil size, and where the figure sits on the plate.
FIG_W, FIG_H = 1056.0, 624.0
FIG_SCALE = 1300.0 / FIG_W
FIG_X, FIG_Y = (W - FIG_W * FIG_SCALE) / 2, 188.0


def traced_paths() -> list[str]:
    src = TRACE.read_text()
    paths = re.findall(r'<path d=".*?"\s*/>', src, re.S)
    if len(paths) != 64:
        raise SystemExit(f"expected 64 traced paths, found {len(paths)} — re-check the index sets")
    out = []
    for i, p in enumerate(paths):
        if i in FIGURE_CAPTION:
            continue
        fill = ACCENT if i in NUMERALS else LINE
        out.append(p.replace("<path", f'<path fill="{fill}"', 1))
    return out


out = []
add = out.append

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
    f'viewBox="0 0 {W} {H}" role="img" '
    f'aria-label="Cylinder head nut tightening sequence for the MPi thirteen-nut head">')
add('<title>Cylinder Head Nut Tightening Sequence — MPi Thirteen-Nut Head</title>')
add('<desc>The Mini MPi cylinder head with the rocker gear fitted, its thirteen nuts numbered in '
    'tightening order. Upper row 8, 2, 4, 10; middle row 9, 3, 5, 11; lower row 13, 6, 1, 7, 12. '
    'Tighten progressively in that order to 34 Nm (25 lb-ft), then finally to 68 Nm (50 lb-ft).</desc>')
add(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')

# ---------------- header ----------------
add(f'<text x="80" y="92" font-family="{FONT}" font-size="46" font-weight="700" '
    f'fill="{INK}" letter-spacing="-0.4">Cylinder Head Nut Tightening Sequence</text>')
add(f'<text x="80" y="132" font-family="{FONT}" font-size="23" font-weight="500" '
    f'fill="{SUBINK}">Mini MPi 1275 — thirteen-nut head, shown with the rocker gear fitted</text>')
add(f'<rect x="80" y="158" width="120" height="5" fill="{ACCENT}"/>')
add(f'<text x="{W-80}" y="92" text-anchor="end" font-family="{MONO}" font-size="20" '
    f'fill="{SUBINK}" letter-spacing="1.5">PLATE 12M3412</text>')
add(f'<text x="{W-80}" y="126" text-anchor="end" font-family="{FONT}" font-size="19" '
    f'fill="{SUBINK}">Classic Mini DIY Archive</text>')

# ---------------- the figure ----------------
add(f'<g transform="translate({FIG_X:.1f},{FIG_Y:.1f}) scale({FIG_SCALE:.6f})">')
add(f'<g transform="translate(0,{FIG_H}) scale(0.1,-0.1)" stroke="none">')
out.extend(traced_paths())
add('</g></g>')

CAP_Y = FIG_Y + FIG_H * FIG_SCALE + 44
add(f'<text x="{W/2:.0f}" y="{CAP_Y:.0f}" text-anchor="middle" font-family="{FONT}" font-size="21" '
    f'font-style="italic" fill="{SUBINK}">'
    f'The order works outwards from the centre — nut 1 is central on the lower row, '
    f'and 12 and 13 are the end nuts.</text>')

# ---------------- torque panel ----------------
PY, PH = CAP_Y + 36, 176.0
add(f'<rect x="80" y="{PY:.0f}" width="{W-160}" height="{PH}" rx="10" fill="#fbfaf7" '
    f'stroke="{RULE}" stroke-width="2"/>')
add(f'<rect x="80" y="{PY:.0f}" width="6" height="{PH}" rx="3" fill="{OLIVE}"/>')
add(f'<text x="118" y="{PY+40:.0f}" font-family="{FONT}" font-size="15" font-weight="700" '
    f'fill="{OLIVE}" letter-spacing="2.2">PROCEDURE</text>')
add(f'<text x="118" y="{PY+78:.0f}" font-family="{FONT}" font-size="21" fill="{INK}">'
    f'Fit the nuts and tighten progressively in the order shown, in two passes.</text>')
add(f'<text x="118" y="{PY+110:.0f}" font-family="{FONT}" font-size="21" fill="{INK}">'
    f'The rocker shaft bracket nuts are separate fasteners — those take 25 Nm.</text>')
add(f'<text x="118" y="{PY+145:.0f}" font-family="{FONT}" font-size="18" fill="{SUBINK}">'
    f'Metric figures are as published in the source; imperial equivalents are converted.</text>')


def stage(x, label, nm, lbft):
    add(f'<rect x="{x}" y="{PY+30:.0f}" width="272" height="116" rx="8" fill="#ffffff" '
        f'stroke="{RULE}" stroke-width="2"/>')
    add(f'<text x="{x+136}" y="{PY+58:.0f}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="14" font-weight="700" fill="{OLIVE}" letter-spacing="2">{label}</text>')
    add(f'<text x="{x+136}" y="{PY+104:.0f}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="42" font-weight="700" fill="{INK}">{nm}</text>')
    add(f'<text x="{x+136}" y="{PY+130:.0f}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="19" fill="{SUBINK}">{lbft}</text>')


stage(940, "FIRST PASS", "34 Nm", "25 lb-ft")
stage(1232, "FINAL PASS", "68 Nm", "50 lb-ft")

# ---------------- footer ----------------
FY = PY + PH + 62
add(f'<line x1="80" y1="{FY-24:.0f}" x2="{W-80}" y2="{FY-24:.0f}" stroke="{RULE}" stroke-width="2"/>')
add(f'<text x="80" y="{FY+4:.0f}" font-family="{FONT}" font-size="17" fill="{SUBINK}">'
    f'Vector redraw of fig. 12M3412 from RCL0193ENG Mini Workshop Manual, 2nd Edition '
    f'(Engine, Repairs), held in the Classic Mini DIY archive.</text>')
add(f'<text x="80" y="{FY+30:.0f}" font-family="{FONT}" font-size="17" fill="{SUBINK}">'
    f'Figures are for the MPi thirteen-nut head. Other A-series engines differ — '
    f'check the torque chart first.</text>')
add(f'<text x="{W-80}" y="{FY+4:.0f}" text-anchor="end" font-family="{FONT}" font-size="17" '
    f'font-weight="600" fill="{OLIVE}">classicminidiy.com</text>')

add('</svg>')

OUT = pathlib.Path(__file__).with_suffix(".svg")
OUT.write_text("\n".join(out))
print(f"wrote {OUT}")
