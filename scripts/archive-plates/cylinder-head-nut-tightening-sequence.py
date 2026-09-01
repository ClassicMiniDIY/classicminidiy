#!/usr/bin/env python3
"""Vector master for the A-series cylinder head nut tightening sequence archive plate.

Re-render with::

    python3 scripts/archive-plates/cylinder-head-nut-tightening-sequence.py
    rsvg-convert -w 4000 scripts/archive-plates/cylinder-head-nut-tightening-sequence.svg \
        -o plate.png

The published copy lives in Supabase Storage; see the README beside this file.
"""
import math
import pathlib

W, H = 1600, 1180

INK      = "#1c1f24"
SUBINK   = "#5b6169"
RULE     = "#c7ccd1"
CAST     = "#f1f2ee"
CASTLINE = "#3b4148"
ACCENT   = "#ed7135"   # CMDIY secondary
OLIVE    = "#6b7a52"   # CMDIY accent
PAPER    = "#ffffff"

FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"
MONO = "Menlo, DejaVu Sans Mono, Courier New, monospace"

# --- head casting geometry -------------------------------------------------
L, R, T, B = 220.0, 1300.0, 400.0, 700.0
CR = 16.0                      # corner radius
BCX, BCY, BR = 1348.0, 550.0, 58.0   # end boss (water outlet)

dy = math.sqrt(BR * BR - (R - BCX) ** 2)
by1, by2 = BCY - dy, BCY + dy

head_path = (
    f"M {L+CR:.1f} {T:.1f} "
    f"L {R-CR:.1f} {T:.1f} "
    f"A {CR} {CR} 0 0 1 {R:.1f} {T+CR:.1f} "
    f"L {R:.1f} {by1:.2f} "
    f"A {BR} {BR} 0 1 1 {R:.1f} {by2:.2f} "
    f"L {R:.1f} {B-CR:.1f} "
    f"A {CR} {CR} 0 0 1 {R-CR:.1f} {B:.1f} "
    f"L {L+CR:.1f} {B:.1f} "
    f"A {CR} {CR} 0 0 1 {L:.1f} {B-CR:.1f} "
    f"L {L:.1f} {T+CR:.1f} "
    f"A {CR} {CR} 0 0 1 {L+CR:.1f} {T:.1f} Z"
)

# --- stud / nut positions --------------------------------------------------
TOP_Y, BOT_Y = 445.0, 655.0
BOT_X = [300.0, 530.0, 760.0, 990.0, 1220.0]
TOP_X = [415.0, 645.0, 875.0, 1105.0]
BOT_N = [8, 4, 1, 5, 9]
TOP_N = [6, 2, 3, 7]

nuts = {}
for x, n in zip(BOT_X, BOT_N):
    nuts[n] = (x, BOT_Y, "bottom")
for x, n in zip(TOP_X, TOP_N):
    nuts[n] = (x, TOP_Y, "top")

NUT_AF = 25.0     # across-flats radius (centre -> flat)
NUT_R = NUT_AF / math.cos(math.radians(30))   # circumradius


def hexagon(cx, cy, r, rot=0.0):
    pts = []
    for i in range(6):
        a = math.radians(rot + 60 * i)
        pts.append(f"{cx + r*math.cos(a):.2f},{cy + r*math.sin(a):.2f}")
    return " ".join(pts)


out = []
add = out.append

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
    f'viewBox="0 0 {W} {H}" role="img" '
    f'aria-label="Cylinder head nut tightening sequence for the A-series nine-stud head">')
add('<title>Cylinder Head Nut Tightening Sequence — A-Series Nine-Stud Head</title>')
add('<desc>Plan view of an A-series cylinder head showing the nine stud nut positions numbered '
    'in tightening order: bottom row left to right 8, 4, 1, 5, 9; top row left to right 6, 2, 3, 7. '
    'Tighten progressively in that order to 34 Nm (25 lb-ft), then finally to 68 Nm (50 lb-ft).</desc>')
add(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')

# ---------------- header ----------------
add(f'<text x="80" y="92" font-family="{FONT}" font-size="46" font-weight="700" '
    f'fill="{INK}" letter-spacing="-0.4">Cylinder Head Nut Tightening Sequence</text>')
add(f'<text x="80" y="132" font-family="{FONT}" font-size="23" font-weight="500" '
    f'fill="{SUBINK}">A-Series nine-stud head &#8212; plan view with the rocker gear removed</text>')
add(f'<rect x="80" y="158" width="120" height="5" fill="{ACCENT}"/>')

# plate code, right aligned
add(f'<text x="{W-80}" y="92" text-anchor="end" font-family="{MONO}" font-size="20" '
    f'fill="{SUBINK}" letter-spacing="1.5">PLATE 12M0143</text>')
add(f'<text x="{W-80}" y="126" text-anchor="end" font-family="{FONT}" font-size="19" '
    f'fill="{SUBINK}">Classic Mini DIY Archive</text>')

# ---------------- drawing ----------------
# casting
add(f'<path d="{head_path}" fill="{CAST}" stroke="{CASTLINE}" stroke-width="3.2" '
    f'stroke-linejoin="round"/>')

# end boss inner detail (water outlet aperture)
add(f'<circle cx="{BCX}" cy="{BCY}" r="30" fill="{PAPER}" stroke="{CASTLINE}" stroke-width="2.4"/>')

add('<g transform="translate(0,-45)">')

# sequence path 1 -> 9, drawn over the casting so the pattern reads
seq_pts = " ".join(f"{nuts[i][0]:.0f},{nuts[i][1]:.0f}" for i in range(1, 10))
add(f'<polyline points="{seq_pts}" fill="none" stroke="{ACCENT}" stroke-width="3" '
    f'stroke-dasharray="10 8" opacity="0.5" stroke-linejoin="round" stroke-linecap="round"/>')

# valve seats: 4 pairs
pair_cx = [400.0, 640.0, 880.0, 1120.0]
for pcx in pair_cx:
    for off in (-62, 62):
        add(f'<circle cx="{pcx+off:.0f}" cy="550" r="30" fill="{PAPER}" '
            f'stroke="{CASTLINE}" stroke-width="2.2"/>')
        add(f'<circle cx="{pcx+off:.0f}" cy="550" r="9" fill="{RULE}"/>')

# nuts + sequence badges
for n in range(1, 10):
    cx, cy, side = nuts[n]
    add(f'<polygon points="{hexagon(cx, cy, NUT_R, 0)}" fill="{PAPER}" '
        f'stroke="{CASTLINE}" stroke-width="3"/>')
    add(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="10.5" fill="{CASTLINE}"/>')

    if side == "top":
        by = 340.0
        leader_from, leader_to = by + 26, cy - NUT_R - 4
    else:
        by = 764.0
        leader_from, leader_to = by - 26, cy + NUT_R + 4

    add(f'<line x1="{cx:.0f}" y1="{leader_from:.1f}" x2="{cx:.0f}" y2="{leader_to:.1f}" '
        f'stroke="{ACCENT}" stroke-width="2.4"/>')
    add(f'<circle cx="{cx:.0f}" cy="{by:.0f}" r="26" fill="{ACCENT}"/>')
    add(f'<text x="{cx:.0f}" y="{by+11:.0f}" text-anchor="middle" font-family="{FONT}" '
        f'font-size="32" font-weight="700" fill="#ffffff">{n}</text>')

# annotation: end boss
add(f'<line x1="{BCX:.0f}" y1="{BCY-BR-6:.0f}" x2="{BCX:.0f}" y2="345" '
    f'stroke="{RULE}" stroke-width="2"/>')
add(f'<text x="{BCX:.0f}" y="330" text-anchor="middle" font-family="{FONT}" font-size="18" '
    f'fill="{SUBINK}">Water outlet</text>')

# annotation: valve seats (leader into the empty left margin)
add(f'<line x1="308" y1="550" x2="212" y2="550" stroke="{RULE}" stroke-width="2"/>')
add(f'<text x="200" y="556" text-anchor="end" font-family="{FONT}" font-size="18" '
    f'fill="{SUBINK}">Valve seats</text>')
add('</g>')

# centre-out note
add(f'<text x="{W/2:.0f}" y="838" text-anchor="middle" font-family="{FONT}" font-size="21" '
    f'font-style="italic" fill="{SUBINK}">'
    f'The order works outwards from the centre of the head &#8212; nut 1 is central, 8 and 9 are the end nuts.</text>')

# ---------------- torque panel ----------------
PY = 878.0
PH = 176.0
add(f'<rect x="80" y="{PY}" width="{W-160}" height="{PH}" rx="10" fill="#fbfaf7" '
    f'stroke="{RULE}" stroke-width="2"/>')
add(f'<rect x="80" y="{PY}" width="6" height="{PH}" rx="3" fill="{OLIVE}"/>')

add(f'<text x="118" y="{PY+40:.0f}" font-family="{FONT}" font-size="15" font-weight="700" '
    f'fill="{OLIVE}" letter-spacing="2.2">PROCEDURE</text>')

add(f'<text x="118" y="{PY+78:.0f}" font-family="{FONT}" font-size="21" fill="{INK}">'
    f'Lightly oil the cylinder head stud threads, then fit all nuts finger tight.</text>')
add(f'<text x="118" y="{PY+110:.0f}" font-family="{FONT}" font-size="21" fill="{INK}">'
    f'Tighten progressively in the order shown, in two passes over the full sequence.</text>')
add(f'<text x="118" y="{PY+145:.0f}" font-family="{FONT}" font-size="18" fill="{SUBINK}">'
    f'Metric figures are as published in the source; imperial equivalents are converted.</text>')

# stage chips, right side of panel
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
FY = 1096.0
add(f'<line x1="80" y1="{FY-24:.0f}" x2="{W-80}" y2="{FY-24:.0f}" stroke="{RULE}" stroke-width="2"/>')
add(f'<text x="80" y="{FY+4:.0f}" font-family="{FONT}" font-size="17" fill="{SUBINK}">'
    f'Redrawn for legibility from the Rover Mini workshop manual engine section, fig. 12M0143. '
    f'Torque values apply to the 1275 A+ nine-stud head.</text>')
add(f'<text x="80" y="{FY+30:.0f}" font-family="{FONT}" font-size="17" fill="{SUBINK}">'
    f'Other A-series engines, including the 998 A+, use different figures &#8212; check the torque chart first.</text>')
add(f'<text x="{W-80}" y="{FY+4:.0f}" text-anchor="end" font-family="{FONT}" font-size="17" '
    f'font-weight="600" fill="{OLIVE}">classicminidiy.com</text>')

add('</svg>')

OUT = pathlib.Path(__file__).with_suffix(".svg")
OUT.write_text("\n".join(out))
print(f"wrote {OUT}")
