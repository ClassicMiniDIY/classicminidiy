#!/usr/bin/env python3
"""Archive plate: 1275 A-series cylinder head nut tightening sequence.

The head artwork is NOT redrawn by hand. It is a potrace vectorisation of the
figure's own 624x1056 CCITT stencil, lifted from the archive's copy of
RCL0193ENG, so the casting outline, the spark plug wells and the rocker gear are
the manual's geometry rather than an approximation of it.

What this script changes about the figure, and why:

* It drops all thirteen of the manual's numerals and sets its own in their exact
  former positions, so the manual's leader lines still point at the right nut.
* It renumbers. The source numbers all thirteen fasteners 1-13, but only NINE are
  main head studs; the other four sit on the rocker pedestal castings. Numbering
  studs 1-9 and lettering the rest A-D is what lets an owner count studs and
  confirm which head they have. The renumbering is verifiable: taking the studs in
  the source's order yields top row 6, 2, 3, 7 and bottom row 9, 4, 1, 5, 8 -- the
  same pattern as fig. 12M0143, mirrored, which views the head from the other end.
* It drops the artwork's baked-in "12M3412" caption; the plate header carries it.

Re-render with::

    python3 scripts/archive-plates/cylinder-head-nut-tightening-sequence.py
    rsvg-convert -w 4000 scripts/archive-plates/cylinder-head-nut-tightening-sequence.svg -o plate.png
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent
TRACE = HERE / "cylinder-head-nut-tightening-sequence.trace.svg"

W, H = 1600, 1410

INK     = "#1c1f24"
LINE    = "#111418"
SUBINK  = "#5b6169"
RULE    = "#c7ccd1"
PAPER   = "#ffffff"

# Studs carry the CMDIY secondary. The four non-stud fixings are BLUE rather than
# the house olive: olive against orange is a red-green pair, which is the single
# most common confusion for colour-vision deficiency, and it only cleared 4.4:1 on
# white. This blue is 8.6:1 and stays separable under deuteranopia and protanopia.
STUD    = "#ed7135"
FIXING  = "#1e40af"
OLIVE   = "#6b7a52"   # panel furniture only, never a fastener label

FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"
MONO = "Menlo, DejaVu Sans Mono, Courier New, monospace"

# Every numeral in the trace is discarded — this plate sets its own. Indices were
# read off a rendered, colour-classified trace. RE-TRACE THE FIGURE AND THEY ARE
# MEANINGLESS; re-derive them by looking, do not assume they carried over.
SOURCE_NUMERALS = {0, 1, 2, 3, 4, 24, 25, 26, 27, 28, 50, 51, 52, 53, 54, 55, 56}
FIGURE_CAPTION = {57, 58, 59, 60, 61, 62, 63}   # the artwork's own "12M3412"
DISCARD = SOURCE_NUMERALS | FIGURE_CAPTION

# Centre of each discarded numeral, in the trace's own 1056x624 coordinates. Placing
# the replacement label here keeps it on the end of the manual's own leader line.
# label -> (cx, cy). Bottom-row heights genuinely differ; the leaders are unequal.
STUDS = {
    "6": (258.6, 68.4),  "2": (463.0, 68.6),  "3": (674.0, 70.5),  "7": (881.5, 68.5),
    "9": (185.2, 541.7), "4": (367.8, 573.5), "1": (567.5, 574.5),
    "5": (772.5, 573.0), "8": (959.0, 570.5),
}
FIXINGS = {
    "C": (256.3, 394.5), "A": (463.2, 393.7), "B": (677.6, 392.1), "D": (881.5, 394.5),
}

FIG_W, FIG_H = 1056.0, 624.0
FIG_SCALE = 1300.0 / FIG_W
FIG_X, FIG_Y = (W - FIG_W * FIG_SCALE) / 2, 188.0

LABEL_SIZE = 46
CAP_HALF = 0.3585 * LABEL_SIZE      # digit centre sits this far above the baseline


def to_plate(nx, ny):
    return FIG_X + nx * FIG_SCALE, FIG_Y + ny * FIG_SCALE


def traced_paths():
    src = TRACE.read_text()
    paths = re.findall(r'<path d=".*?"\s*/>', src, re.S)
    if len(paths) != 64:
        raise SystemExit(f"expected 64 traced paths, found {len(paths)} — re-derive DISCARD")
    return [p.replace("<path", f'<path fill="{LINE}"', 1)
            for i, p in enumerate(paths) if i not in DISCARD]


out = []
add = out.append

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
    f'viewBox="0 0 {W} {H}" role="img" '
    f'aria-label="Cylinder head nut tightening sequence for the 1275 A-series nine-stud head">')
add('<title>Cylinder Head Nut Tightening Sequence — 1275 A-Series 9-Stud Head</title>')
add('<desc>The 1275 A-series cylinder head with the rocker gear fitted. Nine main head studs are '
    'numbered in tightening order: 6, 2, 3, 7 across the upper row and 9, 4, 1, 5, 8 across the '
    'lower row. Four further fixings on the rocker pedestal castings are lettered A to D and are '
    'not head studs. Tighten to 34 Nm (25 lb-ft), then finally to 68 Nm (50 lb-ft).</desc>')
add(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')

# ---------------- header ----------------
add(f'<text x="80" y="92" font-family="{FONT}" font-size="46" font-weight="700" '
    f'fill="{INK}" letter-spacing="-0.4">Cylinder Head Nut Tightening Sequence</text>')
add(f'<text x="80" y="132" font-family="{FONT}" font-size="23" font-weight="500" '
    f'fill="{SUBINK}">1275 A-series 9-stud head — shown with the rocker gear fitted</text>')
add(f'<rect x="80" y="158" width="120" height="5" fill="{STUD}"/>')
add(f'<text x="{W-80}" y="92" text-anchor="end" font-family="{MONO}" font-size="20" '
    f'fill="{SUBINK}" letter-spacing="1.5">SOURCE 12M3412</text>')
add(f'<text x="{W-80}" y="126" text-anchor="end" font-family="{FONT}" font-size="19" '
    f'fill="{SUBINK}">Classic Mini DIY Archive</text>')

# ---------------- the figure ----------------
add(f'<g transform="translate({FIG_X:.1f},{FIG_Y:.1f}) scale({FIG_SCALE:.6f})">')
add(f'<g transform="translate(0,{FIG_H}) scale(0.1,-0.1)" stroke="none">')
out.extend(traced_paths())
add('</g></g>')

# ---------------- our own labels, on the manual's leader lines ----------------
for group, colour in ((STUDS, STUD), (FIXINGS, FIXING)):
    for label, (nx, ny) in group.items():
        px, py = to_plate(nx, ny)
        add(f'<text x="{px:.1f}" y="{py + CAP_HALF:.1f}" text-anchor="middle" '
            f'font-family="{FONT}" font-size="{LABEL_SIZE}" font-weight="700" '
            f'fill="{colour}">{label}</text>')

# ---------------- legend ----------------
LEG_Y = FIG_Y + FIG_H * FIG_SCALE + 40


def legend(x, colour, label):
    add(f'<circle cx="{x+9}" cy="{LEG_Y-6:.0f}" r="9" fill="{colour}"/>')
    add(f'<text x="{x+28}" y="{LEG_Y:.0f}" font-family="{FONT}" font-size="19" '
        f'fill="{INK}">{label}</text>')


legend(300, STUD, "1&#8211;9 &#8212; the nine main head studs")
legend(780, FIXING, "A&#8211;D &#8212; rocker pedestal fixings, not head studs")

CAP_Y = LEG_Y + 46
add(f'<text x="{W/2:.0f}" y="{CAP_Y:.0f}" text-anchor="middle" font-family="{FONT}" font-size="21" '
    f'font-style="italic" fill="{SUBINK}">'
    f'The order works outwards from the centre — stud 1 is central on the lower row, '
    f'and 8 and 9 are the end studs.</text>')

# ---------------- procedure panel ----------------
PY, PH = CAP_Y + 36, 200.0
add(f'<rect x="80" y="{PY:.0f}" width="{W-160}" height="{PH}" rx="10" fill="#fbfaf7" '
    f'stroke="{RULE}" stroke-width="2"/>')
add(f'<rect x="80" y="{PY:.0f}" width="6" height="{PH}" rx="3" fill="{OLIVE}"/>')
add(f'<text x="118" y="{PY+40:.0f}" font-family="{FONT}" font-size="15" font-weight="700" '
    f'fill="{OLIVE}" letter-spacing="2.2">PROCEDURE</text>')
add(f'<text x="118" y="{PY+78:.0f}" font-family="{FONT}" font-size="21" fill="{INK}">'
    f'Tighten progressively in the order shown, in two passes over the sequence.</text>')
add(f'<text x="118" y="{PY+110:.0f}" font-family="{FONT}" font-size="21" fill="{INK}">'
    f'A–D are tightened in among the studs: A after 2, B after 3, C after 6, D after 7.</text>')
add(f'<text x="118" y="{PY+142:.0f}" font-family="{FONT}" font-size="21" fill="{INK}">'
    f'The rocker shaft bracket nuts are separate fasteners — those take 25 Nm.</text>')
add(f'<text x="118" y="{PY+176:.0f}" font-family="{FONT}" font-size="18" fill="{SUBINK}">'
    f'Metric figures are as published in the source; imperial equivalents are converted.</text>')


def stage(x, label, nm, lbft):
    add(f'<rect x="{x}" y="{PY+42:.0f}" width="272" height="116" rx="8" fill="#ffffff" '
        f'stroke="{RULE}" stroke-width="2"/>')
    add(f'<text x="{x+136}" y="{PY+70:.0f}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="14" font-weight="700" fill="{OLIVE}" letter-spacing="2">{label}</text>')
    add(f'<text x="{x+136}" y="{PY+116:.0f}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="42" font-weight="700" fill="{INK}">{nm}</text>')
    add(f'<text x="{x+136}" y="{PY+142:.0f}" text-anchor="middle" font-family="{FONT}" '
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
    f'Studs renumbered 1–9 and the other fixings lettered A–D; the source numbers all thirteen '
    f'1–13. Other A-series heads differ — check the torque chart.</text>')
add(f'<text x="{W-80}" y="{FY+4:.0f}" text-anchor="end" font-family="{FONT}" font-size="17" '
    f'font-weight="600" fill="{OLIVE}">classicminidiy.com</text>')

add('</svg>')

OUT = pathlib.Path(__file__).with_suffix(".svg")
OUT.write_text("\n".join(out))
print(f"wrote {OUT}")
