#!/usr/bin/env python3
"""Parse the archived austinminiwebsearch.com model pages into structured JSON.

Output: models_raw.json — one record per page with:
  slug, source_file, source_url, title_lines, name, mark, years, specs_raw (ordered label->value),
  images (list of original image URLs), body_text (fallback free text), notes
"""
import html
import json
import os
import re
import sys
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.abspath(__file__))
HTML_DIR = os.path.join(ROOT, "html")
WB_PREFIX = re.compile(r"^/web/\d+(?:im_|js_|cs_)?/")

TAG = re.compile(r"<[^>]+>")


def clean(s: str) -> str:
    s = html.unescape(s)
    s = s.replace("\xa0", " ")
    s = re.sub(r"[ \t\r\n]+", " ", s)
    return s.strip()


def cell_lines(cell_html: str):
    """Split a <td> on <br> and strip tags from each line."""
    parts = re.split(r"<br[^>]*>", cell_html, flags=re.I)
    out = [clean(TAG.sub(" ", p)) for p in parts]
    # keep interior blanks (an empty spec value) but trim the ends
    while out and not out[0]:
        out.pop(0)
    while out and not out[-1]:
        out.pop()
    return out


def parse_page(path: str):
    raw = open(path, "rb").read().decode("iso-8859-1")
    # Drop wayback chrome + scripts + comments
    body = re.sub(r"<script.*?</script>", " ", raw, flags=re.S | re.I)
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.S)
    body = re.sub(r"<style.*?</style>", " ", body, flags=re.S | re.I)
    m = re.search(r"<body[^>]*>(.*)</body>", body, flags=re.S | re.I)
    if m:
        body = m.group(1)

    title_tag = re.search(r"<title>(.*?)</title>", raw, flags=re.S | re.I)
    page_title = clean(TAG.sub(" ", title_tag.group(1))) if title_tag else ""

    # Images (original host URLs)
    images = []
    for src in re.findall(r"<img[^>]+src=[\"']([^\"']+)[\"']", body, flags=re.I):
        orig = WB_PREFIX.sub("", src)
        if "layoutminismall" in orig or "_static" in orig:
            continue
        if orig not in images:
            images.append(orig)
    img_alts = [clean(a) for a in re.findall(r"<img[^>]+alt=[\"']([^\"']*)[\"']", body, flags=re.I)]

    # Tables
    tables = re.findall(r"<table.*?</table>", body, flags=re.S | re.I)
    cells_by_table = []
    for t in tables:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", t, flags=re.S | re.I)
        cells_by_table.append(cells)

    # Nav table is the first with MINI MODELS etc. Skip tables whose text contains 'MINI COLORS'
    header_lines = []
    specs = OrderedDict()
    extra_text = []
    for cells in cells_by_table:
        joined = clean(TAG.sub(" ", " ".join(cells)))
        if "MINI COLORS" in joined or "DIECAST" in joined:
            continue
        # Spec table: a cell with '/' labels, later cell with values
        label_idx = None
        for i, c in enumerate(cells):
            lines = cell_lines(c)
            if len(lines) >= 3 and sum(1 for l in lines if "/" in l) >= 2 and not any(re.search(r"\d{3}cc", l) for l in lines):
                label_idx = i
                break
        if label_idx is not None:
            labels = cell_lines(cells[label_idx])
            values = []
            for c in cells[label_idx + 1 :]:
                v = cell_lines(c)
                if v:
                    values = v
                    break
            # Pair up; if counts differ keep raw arrays as note
            if len(values) <= len(labels):
                values = values + [""] * (len(labels) - len(values))
                for l, v in zip(labels, values):
                    specs[l] = v
            else:
                specs["__labels__"] = labels
                specs["__values__"] = values
            continue
        # Header table: big bold text
        if not header_lines and cells:
            lines = []
            for c in cells:
                lines.extend(cell_lines(c))
            if lines and len(joined) < 400:
                header_lines = lines
                continue
        if joined:
            extra_text.append(joined)

    # Free text outside tables (some pages have descriptive paragraphs)
    no_tables = re.sub(r"<table.*?</table>", " ", body, flags=re.S | re.I)
    free = clean(TAG.sub(" ", no_tables))

    slug = os.path.splitext(os.path.basename(path))[0]
    return OrderedDict(
        slug=slug,
        source_file=os.path.basename(path),
        source_url="http://austinminiwebsearch.com/" + os.path.basename(path).replace(" ", "%20"),
        page_title=page_title,
        header_lines=header_lines,
        specs_raw=specs,
        images=images,
        image_alts=img_alts,
        extra_tables=extra_text,
        free_text=free,
    )


def main():
    records = []
    label_counter = Counter()
    for fn in sorted(os.listdir(HTML_DIR)):
        if not fn.lower().endswith(".html"):
            continue
        p = os.path.join(HTML_DIR, fn)
        if os.path.getsize(p) < 1500:
            print("SKIP tiny", fn, file=sys.stderr)
            continue
        rec = parse_page(p)
        records.append(rec)
        for k in rec["specs_raw"]:
            label_counter[k] += 1
    with open(os.path.join(ROOT, "models_raw.json"), "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(len(records), "records")
    print("--- labels ---")
    for k, n in label_counter.most_common():
        print(n, k)
    print("--- pages without specs ---")
    for r in records:
        if not r["specs_raw"]:
            print(r["slug"], "|", r["header_lines"][:3], "|", r["free_text"][:120])
    print("--- pages with mismatched label/value counts ---")
    for r in records:
        if "__labels__" in r["specs_raw"]:
            print(r["slug"], len(r["specs_raw"]["__labels__"]), len(r["specs_raw"]["__values__"]))


if __name__ == "__main__":
    main()
