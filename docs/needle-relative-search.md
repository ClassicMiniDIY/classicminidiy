# Relative Needle Search — Reference

> Source material for the mobile port of the Classic Mini DIY needle configurator's
> "find relative needles" feature to the iOS (Swift/SwiftUI) and Android
> (Kotlin/Compose) apps in the `Native CMDIY Apps` monorepo.
>
> This document is intentionally exhaustive. The mobile developers will not
> see the web source code directly, so every formula, tolerance, and edge case
> that matters for behavioural parity is written out here.

---

## 1. Overview & User Story

### The feedback that drove the feature

A user tuning a friend's Triumph TR6 gave us the following tuning goal in plain
English:

> "A little richer low down. Same in middle and more up top."

Before this feature, the only way to find candidate needles that matched that
description was to pick a reference needle, then eyeball-compare it to random
other needles on the chart one-by-one looking for two curves that bowed the
right way in each RPM band. Users reported doing exactly that — "random
compare to find candidates" — and giving up after a handful of tries.

### What the feature does

The relative-needle-search feature converts the above tuning intent into a
structured query against the full needle catalogue:

1. The user picks a **reference needle** from the list of needles currently on
   the chart.
2. The user specifies a **band** (Low / Mid / High / Any) and a **direction**
   (Richer / Leaner / Similar).
3. The tool scans every other needle in the pool, scores it against the
   reference, and returns a ranked list with per-band percentage deltas.
4. Each result can be added to the chart with one tap, where a shaded diff
   overlay visualises where it is richer (green) or leaner (red) than the
   reference.

The TR6 request above maps to two passes of the same tool:

- `band = low,  direction = richer,  isolateBand = true`  → needles that push
  more fuel at off-idle without materially shifting mid or top.
- `band = high, direction = richer,  isolateBand = true`  → needles that push
  more fuel near redline without materially shifting low or mid.

The `isolateBand` flag is the key piece of behaviour — it is what turns
"richer overall" (not useful) into "richer only where I asked" (useful).

---

## 2. Data Model

### The `Needle` shape

Source of truth: [`data/models/needles.ts`](../data/models/needles.ts) and
[`data/needles.json`](../data/needles.json).

```ts
export interface Needle {
  name: string;    // e.g. "AAA", "M", "6", "BBW"
  size: number;    // carb throat size in inches: 0.09 (HS4 / 1.25") or 0.1 (HIF44 / 1.5")
  data: number[];  // 13–16 station samples, each the needle DIAMETER in mm
}
```

### Interpreting `data`

- `data[i]` is the **diameter of the needle in millimetres** at station index
  `i`. The station is a fixed position along the needle's length; as the SU
  piston rises the wider part of the needle sits in the jet and less fuel flows
  past it.
- **Smaller diameter = richer mixture.** More air can pull more fuel around a
  thinner needle. Conversely, a thicker needle at a given station chokes off
  fuel and leans the mixture.
- The chart Y-axis is therefore **reversed**: richer needles plot *higher* on
  screen, which is the intuition everyone already has.

### Sample

A real row from `data/needles.json`:

```json
{
  "name": "6",
  "size": 0.09,
  "data": [2.261, 2.159, 2.068, 1.994, 1.918, 1.842, 1.768, 1.692, 1.615, 1.539, 1.466, 1.397, 1.321, 0, 0, 0]
}
```

Thirteen real diameter readings (stations 0 through 12) followed by three
trailing zeros. The array length is padded to 16 so every needle has the same
column count in the raw data, but the trailing `0`s are not real measurements.

### Zero values

A value of `0` at a station does **not** mean "the needle has a diameter of
0 mm there." It means **the needle simply doesn't extend that far**. Short
needles trail off with zeros; longer needles have real readings further down
the array.

All comparison code must skip stations where either needle being compared
has `0` at that index. Treating `0` as a real reading would make every short
needle appear to be catastrophically rich at redline, which is nonsense.

### Station 0 is the idle anchor

Station 0 is the "parked" diameter at idle. It is virtually identical across
every needle in the catalogue — it has to be, because SU needles all share a
common jet size at idle. Station 0 therefore carries no discriminating signal
and is **excluded from every band average** in the algorithm. Including it
would drag every comparison toward the same constant and drown out real
differences.

---

## 3. Station → Engine Band Mapping

The three-band model is the informal tuner convention that Minty Lamb /
7ent use when documenting needle behaviour. It is approximate — the exact
RPM at any given station depends on carb size, piston spring colour, and
engine displacement — but it is the same mental model every experienced
SU tuner applies when reading a needle profile, and it is precise enough
for relative ranking.

| Band   | Stations inclusive | Approximate RPM range       |
| ------ | ------------------ | --------------------------- |
| —      | `0`                | idle anchor (excluded)      |
| Low    | `1..4`             | off-idle → ~2500 rpm        |
| Mid    | `5..9`             | cruise → ~4000 rpm          |
| High   | `10..15`           | WOT → redline               |

```ts
export const NEEDLE_BANDS = {
  low:  { start: 1,  end: 4  },
  mid:  { start: 5,  end: 9  },
  high: { start: 10, end: 15 },
} as const;
```

Caveats the mobile UI should carry through (tooltip or help sheet):

- Stations are ordinal positions along the needle, not linear RPM.
- A bigger carb (e.g. HIF44 vs HS2) will shift the RPM that each station maps
  to; the ordering is preserved but the absolute numbers move.
- Stiffer piston springs (red vs blue vs yellow) delay the piston rising, so
  effectively shift station → RPM up the rev range.

---

## 4. Algorithm

Source of truth: [`app/composables/useNeedleCompare.ts`](../app/composables/useNeedleCompare.ts).

The composable is intentionally framework-free — it is plain TypeScript with
no Vue reactivity — so the port to Swift and Kotlin is a straight transliteration.

### 4.1 `effectiveStations(needle)`

Returns the indices of stations that carry real (non-zero) readings. Used
primarily for diagnostics and for the diff overlay; the band algorithms
inline the same filter.

```ts
export function effectiveStations(needle: Needle): number[] {
  const out: number[] = [];
  for (let i = 0; i < needle.data.length; i += 1) {
    const v = needle.data[i];
    if (typeof v === 'number' && v > 0) out.push(i);
  }
  return out;
}
```

### 4.2 Fuel-flow area model (`jetAreaMm2`, `fuelAreaMm2`)

Earlier versions of this algorithm ranked needles by raw **diameter**
deltas. That's the wrong physics: the quantity the engine actually sees is
the **annular flow area** around the needle inside the jet — and a 0.1 mm
diameter change on a thin needle moves materially more fuel than the same
0.1 mm on a fat needle. A 0.090" jet also has a different baseline from a
0.100" jet. Using area instead of diameter makes the percentages
scale-independent and physically meaningful.

```ts
export const INCHES_TO_MM = 25.4;

/** Jet flow area (mm²) for an SU jet size given in inches. */
export function jetAreaMm2(sizeInches: number): number {
  const radiusMm = (sizeInches * INCHES_TO_MM) / 2;
  return Math.PI * radiusMm * radiusMm;
}

/** Effective annular fuel-flow area (mm²) at a single station. */
export function fuelAreaMm2(jetArea: number, needleDiameterMm: number): number {
  const needleRadiusMm = needleDiameterMm / 2;
  return jetArea - Math.PI * needleRadiusMm * needleRadiusMm;
}
```

**Units gotcha.** `Needle.size` is in **inches** (it's the SU jet
designation — 0.090", 0.100"), while `Needle.data[i]` is in
**millimetres**. The helpers convert the jet size to mm before computing
π·r², so everything downstream lives in mm². The mobile ports must respect
this mismatch.

### 4.3 `bandAverages(needle)`

For each band, computes the arithmetic mean of the **per-station
fuel-flow area (mm²)** within `[start, end]` inclusive, **excluding
stations with value `0`** and **excluding station `0`** (which is outside
every band's range anyway).

Critically, areas are computed *per station first, then averaged* — not
diameters averaged then converted, which would discard the non-linear area
response and produce the wrong answer on uneven profiles.

If a band has no real samples at all — common for short needles in the High
band — that band returns `null` rather than `0` or `NaN`.

```ts
export interface BandAverages {
  low:  number | null;  // mean fuel-flow area in this band, mm²
  mid:  number | null;
  high: number | null;
}

export function bandAverages(needle: Needle): BandAverages {
  const out: BandAverages = { low: null, mid: null, high: null };
  const jetArea = jetAreaMm2(needle.size);
  (Object.keys(NEEDLE_BANDS) as NeedleBand[]).forEach((band) => {
    const { start, end } = NEEDLE_BANDS[band];
    const samples: number[] = [];
    for (let i = start; i <= end; i += 1) {
      const d = needle.data[i];
      if (typeof d === 'number' && d > 0) samples.push(fuelAreaMm2(jetArea, d));
    }
    out[band] = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
  });
  return out;
}
```

### 4.4 `compareNeedles(reference, candidate)`

Produces a full per-band delta report of candidate vs reference.

All deltas are expressed **from the candidate's perspective** and in
**fuel-flow area (mm²)**:

- `richness = candidate.fuelArea - reference.fuelArea`
  - positive → candidate has MORE fuel-flow area → **richer** than reference
  - negative → candidate has LESS fuel-flow area → **leaner** than reference
- `richnessPct = (richness / reference) * 100`
  - the same quantity normalised to a percentage of the reference band's
    fuel area. This is what surfaces in the UI — mm² deltas are small
    numbers that don't read well in text, but a percentage is the same
    meaningful metric at any band or jet size.

Note the **sign-convention flip from the diameter-era algorithm**: we used
to compute `ref - cand` because *smaller diameter* meant richer. In
area space, *larger area* means richer, so the natural subtraction is
`cand - ref`. The external semantics (positive → candidate richer) are
preserved; the math under them changed.

Flags on the full comparison:

- `uniformlyRicher` — richness > 0 in every band that has data
- `uniformlyLeaner` — richness < 0 in every band that has data
- `overallDistance` — mean absolute richness across bands, in mm². Smaller =
  more similar overall.

```ts
export interface BandDelta {
  reference:   number | null;
  candidate:   number | null;
  richness:    number | null;
  richnessPct: number | null;
}

export interface NeedleComparison {
  candidate:        Needle;
  reference:        Needle;
  sameSize:         boolean;
  bands:            Record<NeedleBand, BandDelta>;
  overallDistance:  number;
  uniformlyRicher:  boolean;
  uniformlyLeaner:  boolean;
}

export function compareNeedles(reference: Needle, candidate: Needle): NeedleComparison {
  const refBands  = bandAverages(reference);
  const candBands = bandAverages(candidate);
  const bands = {} as Record<NeedleBand, BandDelta>;
  const richnessValues: number[] = [];

  (Object.keys(NEEDLE_BANDS) as NeedleBand[]).forEach((band) => {
    const r = refBands[band];
    const c = candBands[band];
    let richness:    number | null = null;
    let richnessPct: number | null = null;
    if (r !== null && c !== null) {
      richness    = c - r; // area-based: positive → candidate richer
      richnessPct = r !== 0 ? (richness / r) * 100 : null;
      richnessValues.push(Math.abs(richness));
    }
    bands[band] = { reference: r, candidate: c, richness, richnessPct };
  });

  const overallDistance = richnessValues.length
    ? richnessValues.reduce((a, b) => a + b, 0) / richnessValues.length
    : 0;

  const signed = (Object.keys(bands) as NeedleBand[])
    .map((b) => bands[b].richness)
    .filter((v): v is number => v !== null);

  return {
    candidate,
    reference,
    sameSize: reference.size === candidate.size,
    bands,
    overallDistance,
    uniformlyRicher: signed.length > 0 && signed.every((v) => v > 0),
    uniformlyLeaner: signed.length > 0 && signed.every((v) => v < 0),
  };
}
```

### 4.5 `findRelativeNeedles(reference, pool, options)`

The public entry point. Given a reference needle and a pool of candidates,
returns a ranked `RankedNeedle[]` (each is a `NeedleComparison` with an
additional `score` field — lower is better).

#### Options

```ts
export interface FindRelativeOptions {
  band:                NeedleBand | 'any'; // 'low' | 'mid' | 'high' | 'any'
  direction:           'richer' | 'leaner' | 'similar';
  sameSizeOnly?:       boolean;  // default true
  tolerance?:          number;   // default 0.04 for 'similar', 0.01 for 'richer'/'leaner'
  isolateBand?:        boolean;  // default true
  isolationTolerance?: number;   // default 0.04 (mm²)
  limit?:              number;   // default 10
}
```

All tolerance values are in **mm² of fuel-flow area**. Typical A-series
per-band fuel areas land between ~0.3 mm² (very rich positions) and
~2.0 mm² (leaner positions), so these defaults translate to:

- `similar`: max mean |Δarea| across bands = 0.04 mm² (~2–5%)
- `richer` / `leaner` in-band: min |Δarea| in target band = 0.01 mm² (~1%)
- `isolationTolerance`: allowed drift in non-target bands = 0.04 mm²

The numeric values were chosen so that, after converting to the area
domain on a representative A-series needle, they produce roughly the same
set of qualifying candidates as the previous diameter-based defaults
(`0.02`, `0.005`, `0.015` mm). Existing queries therefore behave
equivalently; the reported percentages are just now physically meaningful.

#### Pre-filters

Applied before any scoring:

1. Skip `candidate.name === reference.name` (don't rank a needle against itself).
2. If `sameSizeOnly` (default true), skip candidates where `candidate.size !== reference.size`.
   HS4 (0.09) and HIF44 (0.1) needles live in different physical carbs and
   aren't cross-compatible; allowing them in the pool without opt-in produces
   useless results.

#### Scoring by direction

##### `direction === 'similar'`

Goal: find needles that are as close to the reference as possible, across all
three bands, regardless of direction.

```ts
if (cmp.overallDistance > tolerance) continue; // tolerance default 0.04 mm²
ranked.push({ ...cmp, score: cmp.overallDistance });
```

Lowest `overallDistance` wins. This is the "twin" use-case — "what's almost
the same as my AAA so I can try it without ordering a third kit?"

##### `direction === 'richer' | 'leaner'` on a specific band

Goal: find needles that move **only** in the requested direction, **only**
(or predominantly) in the requested band.

```ts
const wantPositive = direction === 'richer';
const targetDelta  = cmp.bands[band].richness;

// Must have data in the target band
if (targetDelta === null) continue;

// Must move at least `tolerance` mm in the requested direction
if ( wantPositive && targetDelta <  tolerance) continue;
if (!wantPositive && targetDelta > -tolerance) continue;

// Isolation check on the other two bands
let isolationPenalty = 0;
if (isolateBand) {
  let disqualified = false;
  for (const b of otherBands) {
    const d = cmp.bands[b].richness;
    if (d === null) continue;
    const overflow = Math.abs(d) - isolationTolerance; // default 0.04 mm²
    if (overflow > 0) {
      // Soft penalty (×5 weight) so we still return *something* when no
      // perfectly-isolated match exists in the catalogue.
      isolationPenalty += overflow * 5;
      // Hard disqualification if the non-target band drifted more than 2x
      // the isolation tolerance — at that point it's not "isolated" anymore.
      if (overflow > isolationTolerance * 2) disqualified = true;
    }
  }
  if (disqualified) continue;
}

// Primary cost: bigger move in the target band wins (negative, so sort asc)
const score = -Math.abs(targetDelta) + isolationPenalty;
ranked.push({ ...cmp, score });
```

Notes on the soft-vs-hard isolation behaviour:

- The **soft penalty** means a candidate that's almost-but-not-quite isolated
  can still appear, just lower in the ranking. This is deliberate — the web UI
  shows the per-band deltas so the user can see what they are trading off.
- The **hard disqualification** (`overflow > 2 * isolationTolerance`, i.e. the
  non-target band drifted by more than `3 * isolationTolerance` total) prevents
  obviously-wrong results from cluttering the list. A needle that is richer in
  Low by 0.01 mm but *also* richer in High by 0.05 mm is not a useful answer
  to "richer only in the low range" — it's a different query entirely.

##### `direction === 'richer' | 'leaner'` on `band === 'any'`

Goal: find needles that move uniformly in the requested direction across *all*
bands.

```ts
if ( wantPositive && !cmp.uniformlyRicher) continue;
if (!wantPositive && !cmp.uniformlyLeaner) continue;

const movement = meanAbs([
  cmp.bands.low.richness,
  cmp.bands.mid.richness,
  cmp.bands.high.richness,
]);

if (movement < tolerance) continue; // default 0.01 mm²
ranked.push({ ...cmp, score: -movement }); // biggest mover wins
```

`isolateBand` is ignored in `band === 'any'` mode — there is no non-target
band to isolate against.

#### Final sort and trim

```ts
ranked.sort((a, b) => a.score - b.score);
return ranked.slice(0, limit); // default 10
```

Lower score is always better, by construction.

---

## 5. Diff Overlay — `buildDiffSeriesData`

The mobile apps should mirror the web's chart affordance: when a user picks
a reference needle and layers a candidate on top, the region between the two
curves is shaded to show **where** the candidate is richer and **where** it is
leaner.

> **Important split**: the ranking math (§4) operates in *fuel-flow area*
> (mm²), but the diff overlay operates in *diameter* (mm). The chart's Y
> axis is literally labelled "Needle Diameter (mm)", so the overlay shades
> the area between two diameter curves — not between two fuel-area curves.
> Both are correct; they are two views onto the same physical change. The
> richness labels in the result list are what the user reads for
> "how much richer/leaner"; the chart overlay is what they read for
> "in what shape of the range."

### Web implementation shape

`buildDiffSeriesData(reference, candidate)` returns two arrays of triples,
each suitable as an input to a Highcharts `arearange` series:

```ts
interface DiffSeries {
  richer: Array<[number, number | null, number | null]>; // [station, low, high]
  leaner: Array<[number, number | null, number | null]>;
}
```

### Rules

For every station index from `0` to `max(reference.data.length, candidate.data.length) - 1`:

```
r = reference.data[i]
c = candidate.data[i]
valid = (r is finite number > 0) AND (c is finite number > 0)

if not valid:
  richer.push([i, null, null])
  leaner.push([i, null, null])
  continue

if c < r:
  // candidate is richer here — shade between candidate (low) and ref (high)
  richer.push([i, c, r])
  leaner.push([i, null, null])
else if c > r:
  leaner.push([i, r, c])
  richer.push([i, null, null])
else:
  // exact tie — no shading
  richer.push([i, null, null])
  leaner.push([i, null, null])
```

### The null-gap rule

Every station index produces an entry in **both** arrays, even when neither
series has real data there. Emitting `[i, null, null]` is what creates a gap
in the rendered shaded region. Skipping the entry entirely would cause
Highcharts (and Swift Charts / Compose) to interpolate across the gap, which
paints a fill where no data exists.

The rule: if *either* needle lacks a real reading at station `i`, both
`richer[i]` and `leaner[i]` must be `[i, null, null]`. Real data on one side
is not enough — you need both curves to compute a fill between them.

### Colours

- **Green** fill → candidate is richer (`c < r`). Matches the "more fuel"
  mental model and lines up with the "richer appears higher" Y-axis reversal.
- **Red** fill → candidate is leaner (`c > r`).

Semi-transparent fills (web uses ~30% alpha) so overlapping diffs from
multiple candidates remain readable.

### Mobile equivalents

- **Swift Charts (iOS 16+)**: two `AreaMark` series using `yStart:yEnd:`, each
  filtered to its own sign of delta. Use `.foregroundStyle(.green.opacity(0.3))`
  / `.red.opacity(0.3)`.
- **Jetpack Compose**: either Vico's `ColumnCartesianLayer` with custom fills
  or a hand-rolled `Canvas` drawing two `Path` regions. Use
  `Color.Green.copy(alpha = 0.3f)` / `Color.Red.copy(alpha = 0.3f)`.
- The null-gap rule applies verbatim — break the path (don't close it) when
  either needle is missing data at that station.

---

## 6. Swift Port Pseudocode

```swift
import Foundation

// MARK: - Data model

struct Needle: Hashable {
    let name: String
    let size: Double       // SU jet size in INCHES (0.09 or 0.1)
    let data: [Double]     // needle diameter in MM per station; 0 = no data
}

// MARK: - Fuel-flow area helpers (physics)

let INCHES_TO_MM: Double = 25.4

func jetAreaMm2(_ sizeInches: Double) -> Double {
    let radiusMm = (sizeInches * INCHES_TO_MM) / 2
    return .pi * radiusMm * radiusMm
}

func fuelAreaMm2(jetArea: Double, needleDiameterMm: Double) -> Double {
    let needleRadiusMm = needleDiameterMm / 2
    return jetArea - .pi * needleRadiusMm * needleRadiusMm
}

enum NeedleBand: String, CaseIterable {
    case low, mid, high

    var range: ClosedRange<Int> {
        switch self {
        case .low:  return 1...4
        case .mid:  return 5...9
        case .high: return 10...15
        }
    }
}

enum NeedleDirection: String {
    case richer, leaner, similar
}

// MARK: - Band averages

struct BandAverages {
    var low:  Double?
    var mid:  Double?
    var high: Double?

    subscript(band: NeedleBand) -> Double? {
        get {
            switch band {
            case .low:  return low
            case .mid:  return mid
            case .high: return high
            }
        }
        set {
            switch band {
            case .low:  low  = newValue
            case .mid:  mid  = newValue
            case .high: high = newValue
            }
        }
    }
}

func bandAverages(_ needle: Needle) -> BandAverages {
    var out = BandAverages()
    let jet = jetAreaMm2(needle.size)
    for band in NeedleBand.allCases {
        let samples = band.range.compactMap { i -> Double? in
            guard i < needle.data.count else { return nil }
            let d = needle.data[i]
            return d > 0 ? fuelAreaMm2(jetArea: jet, needleDiameterMm: d) : nil
        }
        out[band] = samples.isEmpty ? nil : samples.reduce(0, +) / Double(samples.count)
    }
    return out
}

// MARK: - Compare

struct BandDelta {
    let reference:   Double?    // reference band mean fuel area, mm²
    let candidate:   Double?    // candidate band mean fuel area, mm²
    let richness:    Double?    // candidate - reference; positive = cand richer
    let richnessPct: Double?    // richness / reference * 100
}

struct NeedleComparison {
    let candidate:       Needle
    let reference:       Needle
    let sameSize:        Bool
    let bands:           [NeedleBand: BandDelta]
    let overallDistance: Double
    let uniformlyRicher: Bool
    let uniformlyLeaner: Bool
}

func compareNeedles(reference: Needle, candidate: Needle) -> NeedleComparison {
    let refBands  = bandAverages(reference)
    let candBands = bandAverages(candidate)

    var bands: [NeedleBand: BandDelta] = [:]
    var absRichness: [Double] = []
    var signedRichness: [Double] = []

    for band in NeedleBand.allCases {
        let r = refBands[band]
        let c = candBands[band]
        var richness: Double? = nil
        var richnessPct: Double? = nil
        if let r, let c {
            richness = c - r   // area: positive → candidate richer
            richnessPct = r != 0 ? (richness! / r) * 100 : nil
            absRichness.append(abs(richness!))
            signedRichness.append(richness!)
        }
        bands[band] = BandDelta(reference: r, candidate: c,
                                richness: richness, richnessPct: richnessPct)
    }

    let overall = absRichness.isEmpty ? 0
        : absRichness.reduce(0, +) / Double(absRichness.count)

    return NeedleComparison(
        candidate: candidate,
        reference: reference,
        sameSize:  reference.size == candidate.size,
        bands:     bands,
        overallDistance: overall,
        uniformlyRicher: !signedRichness.isEmpty && signedRichness.allSatisfy { $0 > 0 },
        uniformlyLeaner: !signedRichness.isEmpty && signedRichness.allSatisfy { $0 < 0 }
    )
}

// MARK: - Find relative

struct FindRelativeOptions {
    let band: NeedleBand?         // nil means "any"
    let direction: NeedleDirection
    var sameSizeOnly: Bool       = true
    var tolerance: Double?       = nil  // defaults applied at call site
    var isolateBand: Bool        = true
    var isolationTolerance: Double = 0.04   // mm² of fuel-flow area
    var limit: Int               = 10
}

struct RankedNeedle {
    let comparison: NeedleComparison
    let score: Double            // lower = better
}

func findRelativeNeedles(reference: Needle,
                         pool: [Needle],
                         options: FindRelativeOptions) -> [RankedNeedle] {
    let tolerance = options.tolerance
        ?? (options.direction == .similar ? 0.04 : 0.01)   // mm²

    var ranked: [RankedNeedle] = []

    for candidate in pool {
        if candidate.name == reference.name { continue }
        if options.sameSizeOnly && candidate.size != reference.size { continue }

        let cmp = compareNeedles(reference: reference, candidate: candidate)

        switch options.direction {

        case .similar:
            if cmp.overallDistance > tolerance { continue }
            ranked.append(RankedNeedle(comparison: cmp, score: cmp.overallDistance))

        case .richer, .leaner:
            let wantPositive = options.direction == .richer

            if options.band == nil {
                if wantPositive && !cmp.uniformlyRicher { continue }
                if !wantPositive && !cmp.uniformlyLeaner { continue }
                let deltas = NeedleBand.allCases.compactMap { cmp.bands[$0]?.richness }
                let movement = deltas.isEmpty ? 0
                    : deltas.map(abs).reduce(0, +) / Double(deltas.count)
                if movement < tolerance { continue }
                ranked.append(RankedNeedle(comparison: cmp, score: -movement))
                continue
            }

            // Specific-band case
            let targetBand = options.band!
            guard let targetDelta = cmp.bands[targetBand]?.richness else { continue }
            if wantPositive && targetDelta <  tolerance { continue }
            if !wantPositive && targetDelta > -tolerance { continue }

            var isolationPenalty = 0.0
            if options.isolateBand {
                var disqualified = false
                for b in NeedleBand.allCases where b != targetBand {
                    guard let d = cmp.bands[b]?.richness else { continue }
                    let overflow = abs(d) - options.isolationTolerance
                    if overflow > 0 {
                        isolationPenalty += overflow * 5
                        if overflow > options.isolationTolerance * 2 {
                            disqualified = true
                        }
                    }
                }
                if disqualified { continue }
            }

            let score = -abs(targetDelta) + isolationPenalty
            ranked.append(RankedNeedle(comparison: cmp, score: score))
        }
    }

    ranked.sort { $0.score < $1.score }
    return Array(ranked.prefix(options.limit))
}
```

Notes for the iOS port:

- `NeedleBand?` with `nil == "any"` reads cleaner in Swift than adding a
  fourth case to the enum.
- Keep the 0.005 / 0.02 / 0.015 constants centralised (e.g. `enum Defaults`).
  They are tuned against real catalogue data — tweaking them without testing
  against a wide pool will produce surprising results.

---

## 7. Kotlin Port Pseudocode

```kotlin
// Data model

data class Needle(
    val name: String,
    val size: Double,       // SU jet size in INCHES (0.09 or 0.1)
    val data: List<Double>  // needle diameter in MM per station; 0.0 = no data
)

// Fuel-flow area helpers (physics)

const val INCHES_TO_MM: Double = 25.4

fun jetAreaMm2(sizeInches: Double): Double {
    val radiusMm = (sizeInches * INCHES_TO_MM) / 2.0
    return Math.PI * radiusMm * radiusMm
}

fun fuelAreaMm2(jetArea: Double, needleDiameterMm: Double): Double {
    val needleRadiusMm = needleDiameterMm / 2.0
    return jetArea - Math.PI * needleRadiusMm * needleRadiusMm
}

enum class NeedleBand(val range: IntRange) {
    LOW(1..4),
    MID(5..9),
    HIGH(10..15);
}

enum class NeedleDirection { RICHER, LEANER, SIMILAR }

// Band averages

data class BandAverages(
    val low:  Double? = null,
    val mid:  Double? = null,
    val high: Double? = null,
) {
    operator fun get(band: NeedleBand): Double? = when (band) {
        NeedleBand.LOW  -> low
        NeedleBand.MID  -> mid
        NeedleBand.HIGH -> high
    }
}

fun bandAverages(needle: Needle): BandAverages {
    val jet = jetAreaMm2(needle.size)
    fun avgFor(band: NeedleBand): Double? {
        val samples = band.range
            .filter { it < needle.data.size && needle.data[it] > 0.0 }
            .map { fuelAreaMm2(jet, needle.data[it]) }
        return if (samples.isEmpty()) null else samples.average()
    }
    return BandAverages(
        low  = avgFor(NeedleBand.LOW),
        mid  = avgFor(NeedleBand.MID),
        high = avgFor(NeedleBand.HIGH),
    )
}

// Compare

data class BandDelta(
    val reference:   Double?,   // reference band mean fuel area, mm²
    val candidate:   Double?,   // candidate band mean fuel area, mm²
    val richness:    Double?,   // candidate - reference; >0 = cand richer
    val richnessPct: Double?,
)

data class NeedleComparison(
    val candidate:       Needle,
    val reference:       Needle,
    val sameSize:        Boolean,
    val bands:           Map<NeedleBand, BandDelta>,
    val overallDistance: Double,
    val uniformlyRicher: Boolean,
    val uniformlyLeaner: Boolean,
)

fun compareNeedles(reference: Needle, candidate: Needle): NeedleComparison {
    val refB  = bandAverages(reference)
    val candB = bandAverages(candidate)

    val bands = mutableMapOf<NeedleBand, BandDelta>()
    val signed = mutableListOf<Double>()
    val absVals = mutableListOf<Double>()

    NeedleBand.values().forEach { band ->
        val r = refB[band]
        val c = candB[band]
        var richness: Double? = null
        var pct: Double? = null
        if (r != null && c != null) {
            richness = c - r   // area: positive → candidate richer
            pct = if (r != 0.0) (richness / r) * 100 else null
            signed += richness
            absVals += kotlin.math.abs(richness)
        }
        bands[band] = BandDelta(r, c, richness, pct)
    }

    val overall = if (absVals.isEmpty()) 0.0 else absVals.average()

    return NeedleComparison(
        candidate        = candidate,
        reference        = reference,
        sameSize         = reference.size == candidate.size,
        bands            = bands,
        overallDistance  = overall,
        uniformlyRicher  = signed.isNotEmpty() && signed.all { it > 0 },
        uniformlyLeaner  = signed.isNotEmpty() && signed.all { it < 0 },
    )
}

// Find relative

data class FindRelativeOptions(
    val band: NeedleBand?,                 // null = "any"
    val direction: NeedleDirection,
    val sameSizeOnly: Boolean = true,
    val tolerance: Double? = null,         // default computed per-direction
    val isolateBand: Boolean = true,
    val isolationTolerance: Double = 0.04,   // mm² of fuel-flow area
    val limit: Int = 10,
)

data class RankedNeedle(val comparison: NeedleComparison, val score: Double)

fun findRelativeNeedles(
    reference: Needle,
    pool: List<Needle>,
    options: FindRelativeOptions,
): List<RankedNeedle> {
    val tolerance = options.tolerance
        ?: if (options.direction == NeedleDirection.SIMILAR) 0.04 else 0.01   // mm²

    val ranked = mutableListOf<RankedNeedle>()

    for (candidate in pool) {
        if (candidate.name == reference.name) continue
        if (options.sameSizeOnly && candidate.size != reference.size) continue

        val cmp = compareNeedles(reference, candidate)

        when (options.direction) {
            NeedleDirection.SIMILAR -> {
                if (cmp.overallDistance > tolerance) continue
                ranked += RankedNeedle(cmp, cmp.overallDistance)
            }

            NeedleDirection.RICHER, NeedleDirection.LEANER -> {
                val wantPositive = options.direction == NeedleDirection.RICHER

                if (options.band == null) {
                    if (wantPositive && !cmp.uniformlyRicher) continue
                    if (!wantPositive && !cmp.uniformlyLeaner) continue
                    val deltas = NeedleBand.values()
                        .mapNotNull { cmp.bands[it]?.richness }
                    val movement = if (deltas.isEmpty()) 0.0
                        else deltas.map { kotlin.math.abs(it) }.average()
                    if (movement < tolerance) continue
                    ranked += RankedNeedle(cmp, -movement)
                    continue
                }

                val targetDelta = cmp.bands[options.band]?.richness ?: continue
                if (wantPositive && targetDelta <  tolerance) continue
                if (!wantPositive && targetDelta > -tolerance) continue

                var isolationPenalty = 0.0
                if (options.isolateBand) {
                    var disqualified = false
                    for (b in NeedleBand.values()) {
                        if (b == options.band) continue
                        val d = cmp.bands[b]?.richness ?: continue
                        val overflow = kotlin.math.abs(d) - options.isolationTolerance
                        if (overflow > 0) {
                            isolationPenalty += overflow * 5
                            if (overflow > options.isolationTolerance * 2) {
                                disqualified = true
                            }
                        }
                    }
                    if (disqualified) continue
                }

                val score = -kotlin.math.abs(targetDelta) + isolationPenalty
                ranked += RankedNeedle(cmp, score)
            }
        }
    }

    ranked.sortBy { it.score }
    return ranked.take(options.limit)
}
```

Notes for the Android port:

- Keep the logic in a plain Kotlin module (no Compose imports) so it can be
  unit-tested against a JVM target without the Android SDK.
- Consider wrapping in a coroutine `Dispatchers.Default` for pools > ~500
  needles; the catalogue is currently ~70 so synchronous is fine.

---

## 8. UI Conventions

The web UI lives in
[`app/components/Calculators/Needles.vue`](../app/components/Calculators/Needles.vue).
Describe for parity, not pixel-copy — the mobile look and feel should remain
native.

### Layout, top-to-bottom

1. **Needle selector** — autocomplete search over the full catalogue; tapping
   a result adds it to the chart.
2. **Chart** — Highcharts line chart, Y-axis reversed (richer up), X-axis
   shows station index with the band boundaries (1/5/10) visually marked.
3. **Selected-needles list** — one row per needle on the chart, showing:
   - colour swatch (matches the chart series colour)
   - needle name and size
   - **reference radio button** (only one needle can be the reference at a
     time; the reference is what all comparisons and diff overlays are
     calculated against)
   - **diff toggle** per non-reference needle (when on, renders the green/red
     shaded overlay between that needle and the reference)
   - **remove** button
4. **Relative-search panel** — collapsed by default, expanded by a primary
   button labelled "Find relative needles". When expanded:
   - **Band dropdown** (Low / Mid / High / Any)
   - **Direction segmented control** (Richer / Leaner / Similar)
   - **Same-size toggle** (default on)
   - **Isolate-band toggle** (default on; disabled and hidden when band = Any
     or direction = Similar)
   - **Run search** button (also re-runs on any control change after a
     debounce — see §9)
   - **Results list** — one row per ranked result, showing:
     - needle name and size
     - **per-band percentage deltas** (Low / Mid / High), each coloured:
       - green if richer than reference (richness > 0)
       - red if leaner (richness < 0)
       - neutral if within ±0.5% or the band has no data
     - "Add to chart" button — adds the candidate and, if no reference is
       already chart-pinned, also pins it as a diff target against the
       reference automatically.

### Copy rules

- Use **"richer" / "leaner"**, never "rich" / "lean" by themselves — always
  comparative. These are deltas, not absolute classifications.
- When a band has no data for either needle (short needle, no High-band
  readings), render `—` (em-dash) not `0%` or blank. `0%` would imply "no
  difference", which is the opposite of the truth.
- Always show the reference name somewhere in the results header: "Relative
  to AAA (0.09)". Users forget which needle they picked as reference.

---

## 9. Analytics

Web fires a single PostHog event when the user runs a relative search:

- **Event name:** `relative_needle_search`
- **Properties:**
  - `reference` — reference needle name (string)
  - `band` — `'low' | 'mid' | 'high' | 'any'`
  - `direction` — `'richer' | 'leaner' | 'similar'`
  - `same_size_only` — boolean
  - `isolate_band` — boolean
  - `result_count` — number of results returned (post-limit, so always
    `<= options.limit`)
- **Debounce:** 800 ms after the user's last control change. This avoids
  flooding PostHog with one event per keystroke as the user iterates on
  dropdowns.

The mobile apps should mirror this event name and property schema **exactly**
when they wire up analytics — PostHog reporting dashboards are shared across
web and native, and renaming on one platform fragments the funnel.

Mobile-specific analytics wiring will land in a later phase (Phase 5 of the
CMDIY Unified Platform Migration Plan). Until then the mobile ports can
stub the event emitter; the property shape must still match.

---

## 10. File Map

### Web source of truth

| File | Purpose |
| ---- | ------- |
| [`app/composables/useNeedleCompare.ts`](../app/composables/useNeedleCompare.ts) | Pure logic — `bandAverages`, `compareNeedles`, `findRelativeNeedles`, `buildDiffSeriesData`, `effectiveStations`, `bandLabel`, `NEEDLE_BANDS` constants. **Single source of truth.** If the web and mobile implementations diverge, this file wins and the mobile ports must be updated to match. |
| [`app/components/Calculators/Needles.vue`](../app/components/Calculators/Needles.vue) | UI wiring — search panel, result list, chart integration, PostHog event emission. Template for the mobile screens but not a direct port target. |
| [`tests/unit/composables/useNeedleCompare.test.ts`](../tests/unit/composables/useNeedleCompare.test.ts) | Vitest unit tests for the pure logic. **The mobile ports should mirror these test cases** (XCTest on iOS, JUnit/kotest on Android) — parity at the test-case level is the easiest way to guarantee parity of behaviour. |
| [`app/plugins/highcharts.ts`](../app/plugins/highcharts.ts) | Registers `highcharts/highcharts-more` so the `arearange` series type (used by the diff overlay) is available. Mobile-equivalent setup is the charting library's own region/area-fill primitive — see §5. |

### Data

| File | Purpose |
| ---- | ------- |
| [`data/needles.json`](../data/needles.json) | Full catalogue. Every SU needle the tool knows about, as an array of `Needle` objects. Ship this file with the mobile apps (or fetch it once on first launch and cache) — the algorithm is useless without the pool. |
| [`data/models/needles.ts`](../data/models/needles.ts) | TypeScript interface for the `Needle` shape and related helpers. Mirrors the Swift `struct Needle` / Kotlin `data class Needle` in §6 and §7. |

---

## Appendix A — Worked example

All values below are in **mm² of fuel-flow area**. Jet area for a 0.090"
jet: `π × (0.09 × 25.4 / 2)² ≈ 4.10435 mm²`.

Reference needle: **"6"** (size 0.09")
```
data = [2.261, 2.159, 2.068, 1.994, 1.918, 1.842, 1.768, 1.692, 1.615, 1.539, 1.466, 1.397, 1.321, 0, 0, 0]
```

Band averages (mean of per-station fuel areas):

- Low  (stations 1..4):   **0.84642 mm²**
- Mid  (stations 5..9):   **1.84886 mm²**
- High (stations 10..12): **2.57427 mm²**

Candidate needle: **"7"** (size 0.09")
```
data = [2.261, 2.159, 2.068, 1.994, 1.918, 1.829, 1.742, 1.651, 1.575, 1.491, 1.405, 1.321, 1.245, 0, 0, 0]
```

Band averages:

- Low:  **0.84642 mm²** (stations 1..4 are identical to needle "6")
- Mid:  **1.93522 mm²**
- High: **2.72526 mm²**

Richness (candidate − reference):

- Low:  0.84642 − 0.84642 = **0.000 mm²** → 0.0%
- Mid:  1.93522 − 1.84886 = **+0.0864 mm²** → +4.67% (candidate richer)
- High: 2.72526 − 2.57427 = **+0.1510 mm²** → +5.87% (candidate clearly richer)

Overall distance: mean(|0|, |0.0864|, |0.1510|) = **0.0791 mm²**.

Interpreting this against the TR6 use-case ("richer low, same mid, more up top"):

- Candidate "7" against reference "6" with `band = high, direction = richer,
  isolateBand = true, isolationTolerance = 0.04`:
  - Low overflow: |0.000| − 0.04 = −0.04 → no penalty
  - Mid overflow: |0.0864| − 0.04 = 0.0464 → penalty = 0.0464 × 5 = 0.232; *and*
    0.0464 > 2 × 0.04 = 0.08? No (0.0464 < 0.08) — not disqualified.
  - Target delta (High) = +0.1510 mm², passes `>= 0.01` threshold.
  - Score = −|0.1510| + 0.232 = **+0.081** (higher = worse; this candidate
    isn't great because mid drifted a bit).

- Candidate "7" against reference "6" with `band = high, direction = richer,
  isolateBand = false`:
  - Score = −|0.1510| = **−0.151** (much better ranking).

This illustrates the value of `isolateBand`: with it on, needle "7" is visibly
penalised for also shifting mid, even though it isn't outright disqualified.
A user looking for "only high-band richness" would rightly see other
candidates ranked above it.

**Port parity check.** A correct Swift or Kotlin implementation of
`compareNeedles("6", "7")` must produce these six band numbers — the
reference means, the candidate means, and the three richness values —
within floating-point rounding. If any of them disagree, the port has a
bug; this is the single cheapest parity test to run first.
