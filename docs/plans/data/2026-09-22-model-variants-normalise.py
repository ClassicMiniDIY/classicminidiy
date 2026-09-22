#!/usr/bin/env python3
"""models_raw.json -> model_variants_seed.json (schema in docs/plans/2026-09-22-model-variants-archive.md §1).

KNOWN GAP (fixed in data, not here): 21 pages list several names and year
ranges in their header ("AUSTIN SEVEN 1959 - 1961 / AUSTIN MINI 1962 - 1967").
This script names the variant from the FIRST header line and takes its years
from the first range only. The corrected names and spans were applied to the
seed JSON and to production by classicminidiy-supabase migration
20260923000001; re-running this script would undo them.
"""
import json
import os
import re
import unicodedata
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.abspath(__file__))
ACCESSED = "2026-09-22"
WAYBACK = "https://web.archive.org/web/20230129061027/"

MARK_RANGES = {1: (1959, 1967), 2: (1967, 1969), 3: (1969, 1976), 4: (1976, 1984), 5: (1984, 1992), 6: (1992, 1996), 7: (1996, 2000)}

LABEL_MAP = {
    "Cylindrée / Engine": "engine",
    "Taux de compression / Compression Ratio": "compression",
    "Puissance / Power output": "power",
    "Couple / Torque": "torque",
    "Alimentation / Carb": "carb",
    "Rapport de pont / Final drive": "final_drive",
    "Jantes / Wheels": "wheels",
    "Pneus / Tyres": "tyres",
    "Poids / Weight": "weight",
    "Vitesse max / Max speed": "max_speed",
    "Production": "production",
    "Couleurs / Colors": "colors",
}


def num(s):
    return float(s.replace(",", "."))


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s


def parse_years(lines):
    text = " ".join(lines)
    m = re.search(r"\b(19[5-9]\d|2000)\s*-\s*(19[5-9]\d|2000)\b", text)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"\b(19[5-9]\d|2000)\b", text)
    if m:
        return int(m.group(1)), None
    return None, None


def parse_mark(lines, slug):
    text = " ".join(lines)
    m = re.search(r"\bMK\s?(\d)\b", text, flags=re.I) or re.search(r"mk(\d)", slug, flags=re.I)
    return int(m.group(1)) if m else None


def marque_of(name):
    n = name.upper()
    if "AUSTIN" in n and "MORRIS" in n:
        return "austin_morris"
    for k, v in [
        ("INNOCENTI", "innocenti"), ("AUTHI", "authi"), ("RILEY", "riley"), ("WOLSELEY", "wolseley"),
        ("LEYLAND", "leyland"), ("BLMC", "leyland"), ("ROVER", "rover"), ("AUSTIN", "austin"), ("MORRIS", "morris"),
    ]:
        if k in n:
            return v
    if n.startswith("MINI"):
        return "mini"
    return "other"


def market_of(name, slug):
    n = name.upper()
    s = slug.lower()
    for k, v in [
        ("SOUTH AFRICA", "south_africa"), ("(SA)", "south_africa"), ("AUSTRALIA", "australia"), ("(NZ)", "new_zealand"),
        ("NEW ZEALAND", "new_zealand"), ("JAPAN", "japan"), ("NEDERLAND", "netherlands"), ("(NL)", "netherlands"),
        ("VENEZUELA", "venezuela"), ("(D)", "germany"), ("DEUTSCHLAND", "germany"), ("(F)", "france"), ("FRANCE", "france"), ("PORTUGAL", "portugal"), ("(FR)", "france"), ("(CH)", "switzerland"), ("(P)", "portugal"),
        ("(I)", "italy"), ("(GB)", "uk"),
    ]:
        if k in n:
            return v
    if "INNOCENTI" in n:
        return "italy"
    if "AUTHI" in n:
        return "spain"
    if "japan" in s:
        return "japan"
    if s.endswith(" fr") or s.endswith("35 fr"):
        return "france"
    if s == "35d":
        return "germany"
    return "uk"


def body_of(name):
    n = name.upper()
    if "ESTATE" in n or "COUNTRYMAN" in n or "TRAVELLER" in n:
        return "estate"
    if "VAN" in n and "VANDEN" not in n and "ADVANTAGE" not in n:
        return "van"
    if "PICK" in n:
        return "pickup"
    if "MOKE" in n:
        return "moke"
    if "CABRIO" in n:
        return "cabriolet"
    return "saloon"


def family_of(name, body, is_le):
    n = name.upper()
    if "COOPER S" in n or "COOPER-S" in n:
        return "cooper_s"
    if "1275 GT" in n or "1275GT" in n:
        return "1275_gt"
    if "COOPER" in n:
        return "cooper"
    if "ELF" in n or "HORNET" in n:
        return "elf_hornet"
    if "CLUBMAN" in n and body == "estate":
        return "clubman_estate"
    if "CLUBMAN" in n:
        return "clubman"
    if body == "estate":
        return "countryman_traveller"
    if body in ("van", "pickup", "moke", "cabriolet"):
        return body
    if is_le:
        return "limited_edition"
    return "saloon"


def parse_engine(v):
    m = re.findall(r"(\d{3,4})\s*cc", v)
    return (int(m[0]) if m else None), (len(m) > 1)


def parse_compression(v):
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*:\s*1", v)
    return round(num(m.group(1)), 2) if m else None


def parse_power(v):
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(ch|cv|bhp|hp)\b\s*(SAE|DIN)?", v, flags=re.I)
    rpm = re.search(r"(\d{4})\s*tr/min", v)
    if not m:
        return None, None, None
    val = num(m.group(1))
    unit = m.group(2).lower()
    bhp = round(val * 0.98632, 1) if unit in ("ch", "cv") else val
    return bhp, (int(rpm.group(1)) if rpm else None), (m.group(3).upper() if m.group(3) else None)


def parse_torque(v):
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*mkg", v)
    rpm = re.search(r"(\d{4})\s*tr/min", v)
    if not m:
        return None, None
    return round(num(m.group(1)) * 7.2330, 1), (int(rpm.group(1)) if rpm else None)


def parse_fuel(v):
    s = v.lower()
    if "mpi" in s or "multi" in s:
        return "mpi"
    if "spi" in s or "injection" in s or "monopoint" in s or "single point" in s:
        return "spi"
    if "double" in s or "twin" in s or "2 carb" in s or "x2" in s:
        return "carb_twin"
    if "carb" in s or "su" in s or "hs" in s or "hif" in s:
        return "carb_single"
    return None


def parse_production(v):
    """'AUSTIN: 12395 ex, MORRIS: 12465 ex' | '6795 ex' | '1000' | '1309 ex between 1991-1995 (all models)'"""
    out = []
    for m in re.finditer(r"([A-Za-z][A-Za-z ]*?)\s*:\s*(\d[\d\s.]*)\s*(?:ex)?", v):
        out.append({"marque": m.group(1).strip().lower().replace(" ", "_"), "count": int(re.sub(r"\D", "", m.group(2)))})
    if not out:
        m = re.search(r"(\d[\d\s.]{0,8})\s*(?:ex\b|$)", v.strip())
        if m and re.sub(r"\D", "", m.group(1)):
            out.append({"marque": None, "count": int(re.sub(r"\D", "", m.group(1)))})
    total = sum(x["count"] for x in out) if out else None
    return out, total


def parse_colors(v):
    parts = [p.strip(" .") for p in re.split(r",|/| et | and |;", v) if p.strip(" .")]
    seen, out = set(), []
    for p in parts:
        p = re.sub(r"\s+", " ", p)
        key = p.lower()
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


LE_HINTS = [
    "LIMITED", "JUBILEE", "TRUSSARDI", "JPS", "SPECIAL", "MAYFAIR", "25", "30", "35", "40", "RITZ", "CHELSEA", "PICCADILLY",
    "PARK LANE", "ADVANTAGE", "JET BLACK", "RED HOT", "DESIGNER", "SKY", "ROSE", "FLAME", "RACING GREEN", "CHECK MATE",
    "RSP", "AFTER EIGHT", "NEON", "STUDIO", "TWININGS", "BRITISH OPEN", "ARC DE TRIOMPHE", "SPRITE", "WOODBURY",
    "ITALIAN JOB", "COSMO", "RIO", "SEALINE", "SEAWAY", "SILVERSTONE", "TAHITI", "TROPIC", "MONTE CARLO", "SILVERBULLET",
    "BALMORAL", "TARTAN", "SIDE WALK", "SIDEWALK", "BLUE STAR", "KENSINGTON", "EQUINOX", "CHIC", "SEVEN", "CLASSIC COOPER",
    "FOR EVER", "SPORT", "MONZA", "BROOKLANDS", "PAUL SMITH", "LAPAGAYO", "FUJI", "MISTER BEAN", "KNIGHTSBRIDGE", "LADY",
    "BEAUBOURG", "PRINTEMPS", "EBONY", "KOELLIKER", "IMA", "LAMM", "PROTOTYPE", "GR A", "GROUPE A", "VANDEN PLAS", "MINI 20",
]


def is_limited(name, slug, production):
    n = name.upper()
    if "AUSTIN SEVEN" in n and "MPI" not in n:
        return False
    if any(h in n for h in LE_HINTS):
        return True
    return False


def main():
    raw = json.load(open(os.path.join(ROOT, "models_raw.json"), encoding="utf-8"))
    seed = []
    slugs = Counter()
    for r in raw:
        head = r["header_lines"] or [r["page_title"]]
        name_line = head[0]
        # Strip mark + years from the display name
        name = re.sub(r"\s*-?\s*\b(19[5-9]\d|2000)\s*-\s*(19[5-9]\d|2000)\b", "", name_line)
        name = re.sub(r"\s*-\s*\b(19[5-9]\d|2000)\b\s*$", "", name)
        name = re.sub(r"\s*\bMK\s?\d\b\s*$", "", name, flags=re.I).strip(" -")
        name = re.sub(r"\s+", " ", name)
        KEEP = {"GT", "GTS", "LE", "LS", "HL", "HLE", "GL", "RSP", "MPI", "SPI", "SA", "NZ", "JPS", "E", "S", "T", "BX", "BA", "SB", "FA", "II", "IMA", "JCG", "BLMC", "D", "F", "GB", "FR", "CH", "NL", "P", "I", "MC", "LAMM", "C"}
        def tw(w):
            core = w.strip("()")
            if core.upper() in KEEP or (core.isupper() and any(ch.isdigit() for ch in core)):
                out = core.upper()
            else:
                out = core.capitalize()
            return w.replace(core, out) if core else w
        name_title = " ".join(tw(w) for w in name.split(" "))
        year_start, year_end = parse_years(head)
        mark = parse_mark(head, r["slug"])
        marque = marque_of(name_line)
        if mark is None and market_of(name_line + " " + " ".join(head[1:]), r["slug"]) == "uk" and year_start:
            for k, (a, b) in MARK_RANGES.items():
                if a <= year_start < b or (k == 7 and year_start >= 1996):
                    mark = k
                    break
        specs_src = OrderedDict()
        for label, val in r["specs_raw"].items():
            key = LABEL_MAP.get(label, label)
            specs_src[key] = val
        prod_list, prod_total = parse_production(specs_src.get("production", ""))
        le = is_limited(name_line, r["slug"], prod_list)
        body = body_of(name_line)
        family = family_of(name_line, body, le)
        engine_cc, multi = parse_engine(specs_src.get("engine", ""))
        bhp, prpm, std = parse_power(specs_src.get("power", ""))
        lbft, trpm = parse_torque(specs_src.get("torque", ""))
        w = re.search(r"(\d+(?:[.,]\d+)?)\s*kg", specs_src.get("weight", ""))
        sp = re.search(r"(\d+)\s*km/?h", specs_src.get("max_speed", ""))
        fd = re.search(r"(\d+(?:[.,]\d+)?)", specs_src.get("final_drive", ""))
        slug = slugify(name_title + (f" mk{mark}" if mark and not re.search(r"mk\d", name_title.lower()) else ""))
        if not slug:
            slug = slugify(r["slug"])
        slugs[slug] += 1
        if slugs[slug] > 1:
            slug = f"{slug}-{slugs[slug]}"
        edition_size = None
        if le and prod_list and len(prod_list) == 1 and prod_list[0]["marque"] is None:
            edition_size = prod_list[0]["count"]
        rec = OrderedDict(
            slug=slug,
            name=name_title,
            source_slug=r["slug"],
            marque=marque,
            family=family,
            body_style=body,
            mark=mark,
            market=market_of(name_line + " " + " ".join(head[1:]), r["slug"]),
            year_start=year_start,
            year_end=year_end,
            is_limited_edition=le,
            edition_size=edition_size,
            production_total=prod_total,
            production=prod_list,
            engine_cc=engine_cc,
            compression_ratio=parse_compression(specs_src.get("compression", "")),
            power_bhp=bhp,
            power_rpm=prpm,
            power_standard=std,
            torque_lbft=lbft,
            torque_rpm=trpm,
            fuel_system=parse_fuel(specs_src.get("carb", "")),
            carburettor=specs_src.get("carb") or None,
            final_drive=(round(num(fd.group(1)), 3) if fd else None),
            wheels=specs_src.get("wheels") or None,
            tyres=specs_src.get("tyres") or None,
            kerb_weight_kg=(num(w.group(1)) if w else None),
            top_speed_mph=(round(int(sp.group(1)) / 1.609344, 1) if sp else None),
            colors=parse_colors(specs_src.get("colors", "")),
            notes=(" ".join(head[1:]) if len(head) > 2 else None),
            free_text=(r["free_text"] or None),
            engine_note=("multiple engine options listed" if multi else None),
            specs_source=specs_src,
            images=[{"original_url": u, "wayback_url": WAYBACK.replace("/20230129061027/", "/20230129061027im_/") + u, "alt": a} for u, a in zip(r["images"], r["image_alts"] + [""] * len(r["images"]))],
            sources=[{"type": "web_archive", "title": "austinminiwebsearch.com — " + name_line, "url": WAYBACK + r["source_url"], "accessed": ACCESSED}],
            legacy_submitted_by="austinminiwebsearch.com",
        )
        seed.append(rec)
    seed.sort(key=lambda x: ((x["mark"] or 99), x["year_start"] or 0, x["name"]))
    json.dump(seed, open(os.path.join(ROOT, "model_variants_seed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    # coverage report
    fields = ["mark", "year_start", "year_end", "engine_cc", "compression_ratio", "power_bhp", "torque_lbft", "fuel_system", "final_drive", "wheels", "tyres", "kerb_weight_kg", "top_speed_mph", "production_total", "colors", "images"]
    print(len(seed), "variants")
    for f in fields:
        n = sum(1 for s in seed if s[f] not in (None, [], ""))
        print(f"{f:20s} {n}/{len(seed)}")
    print("marque:", Counter(s["marque"] for s in seed).most_common())
    print("family:", Counter(s["family"] for s in seed).most_common())
    print("market:", Counter(s["market"] for s in seed).most_common())
    print("mark:", sorted(Counter(s["mark"] for s in seed).items(), key=lambda x: (x[0] is None, x[0])))
    print("limited:", sum(1 for s in seed if s["is_limited_edition"]))
    print("images:", sum(len(s["images"]) for s in seed))
    print("colour names:", len({c.lower() for s in seed for c in s["colors"]}))


if __name__ == "__main__":
    main()
