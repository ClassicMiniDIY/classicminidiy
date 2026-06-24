// Classic Mini wheel-alignment tool — parameter ranges, presets, and unit helpers.
//
// Research basis: docs/plans/2026-06-23-alignment-tool.md (sourced from MED Engineering,
// Mini Spares, Calver ST, The Mini Forum, TurboMinis, and the Rover/Haynes workshop manuals).
//
// SIGN CONVENTIONS (load-bearing — surfaced verbatim in the UI):
//   Camber: positive = top of wheel leans OUT, negative = leans IN. Factory FRONT camber is
//           POSITIVE; every performance setup runs negative. Do not assume camber is negative.
//   Caster: always POSITIVE on a Mini (steering axis trails).
//   Toe:    NEGATIVE = toe-OUT, POSITIVE = toe-IN, for BOTH axles. The FRONT runs toe-OUT
//           (negative); the REAR runs toe-IN (positive). Values are TOTAL across both wheels
//           (Mini hobby convention) — set each wheel to half the figure.

export type AlignmentAxle = 'front' | 'rear';
export type AlignmentParamKind = 'camber' | 'caster' | 'toe';
export type AlignmentParamId = 'frontCamber' | 'frontCaster' | 'frontToe' | 'rearCamber' | 'rearToe';
export type AlignmentPresetId = 'stockRoad' | 'fastRoad' | 'trackDay' | 'boostedRoad' | 'boostedTrack';
export type AlignmentConfidence = 'high' | 'medium' | 'low';

export interface AlignmentValues {
  frontCamber: number; // degrees
  frontCaster: number; // degrees (positive)
  frontToe: number; // mm, total, negative = toe-out
  rearCamber: number; // degrees
  rearToe: number; // mm, total, positive = toe-in
}

export interface AlignmentParameter {
  id: AlignmentParamId;
  axle: AlignmentAxle;
  kind: AlignmentParamKind;
  unit: 'deg' | 'mm';
  min: number;
  max: number;
  step: number;
  /** Factory/stock value — also the tool's initial value. */
  stockDefault: number;
}

export interface AlignmentPreset {
  id: AlignmentPresetId;
  confidence: AlignmentConfidence;
  values: AlignmentValues;
  /** Supporting URLs (not localized — reference links). */
  sources: string[];
}

/** Max saved alignment configs per user (enforced at the API layer, mirrors gear configs). */
export const ALIGNMENT_MAX_CONFIGS = 25;

export const MM_PER_INCH = 25.4;

/** Wheel diameters offered in the tool (inches). Drives the optional toe degree readout and
 *  the camber-guidance note — camber recommendations scale with rim size. */
export const ALIGNMENT_WHEEL_SIZES = [10, 12, 13] as const;
export type AlignmentWheelSize = (typeof ALIGNMENT_WHEEL_SIZES)[number];
export const ALIGNMENT_DEFAULT_WHEEL_SIZE: AlignmentWheelSize = 10;

export interface CamberRange {
  min: number; // most negative end (degrees)
  max: number; // least negative / neutral end (degrees)
}

/**
 * Typical NEGATIVE (performance) camber range by rim size. Smaller rims tolerate — and want —
 * more static negative camber to keep the tyre flat through the Mini's big body roll; bigger
 * rims need less. Source: Mini Spares splits front 10"≈−1.5/−2.0, 12"≈−1.0/−1.5, 13"≈−0.5/−0.75;
 * rear roughly half that. These are guidance ranges, not hard limits, and assume a grip-oriented
 * (not factory) setup — the factory front figure is positive, flagged separately.
 */
export const ALIGNMENT_CAMBER_GUIDANCE: Record<number, { front: CamberRange; rear: CamberRange }> = {
  10: { front: { min: -2.0, max: -1.5 }, rear: { min: -1.0, max: -0.75 } },
  12: { front: { min: -1.5, max: -1.0 }, rear: { min: -0.5, max: 0 } },
  13: { front: { min: -0.75, max: -0.5 }, rear: { min: -0.25, max: 0 } },
};

export function getCamberGuidance(wheelSize: number, axle: AlignmentAxle): CamberRange {
  const g = ALIGNMENT_CAMBER_GUIDANCE[wheelSize] ?? ALIGNMENT_CAMBER_GUIDANCE[ALIGNMENT_DEFAULT_WHEEL_SIZE];
  return g[axle];
}

export const ALIGNMENT_PARAMETERS: AlignmentParameter[] = [
  { id: 'frontCamber', axle: 'front', kind: 'camber', unit: 'deg', min: -3, max: 2.5, step: 0.25, stockDefault: 2 },
  { id: 'frontCaster', axle: 'front', kind: 'caster', unit: 'deg', min: 1, max: 6, step: 0.25, stockDefault: 3 },
  { id: 'frontToe', axle: 'front', kind: 'toe', unit: 'mm', min: -4, max: 3, step: 0.25, stockDefault: -1.59 },
  { id: 'rearCamber', axle: 'rear', kind: 'camber', unit: 'deg', min: -2, max: 1, step: 0.25, stockDefault: 0 },
  { id: 'rearToe', axle: 'rear', kind: 'toe', unit: 'mm', min: -1, max: 5, step: 0.25, stockDefault: 3.18 },
];

/** Five research-derived starting points. Numeric values + sources only; display name,
 *  summary, and rationale are localized via i18n keys (`presets.<id>.*`) in the component. */
export const ALIGNMENT_PRESETS: AlignmentPreset[] = [
  {
    id: 'stockRoad',
    confidence: 'high',
    values: { frontCamber: 2, frontCaster: 3, frontToe: -1.59, rearCamber: 0, rearToe: 3.18 },
    sources: [
      'https://www.minimania.com/msgThread/110236/1/1/Alignment_Specs',
      'https://www.theminiforum.co.uk/forums/topic/353453-camber-caster-toe-tracking-figures/page-2',
      'https://us.haynes.com/products/mini-1969-2001-haynes-repair-manual',
    ],
  },
  {
    id: 'fastRoad',
    confidence: 'high',
    values: { frontCamber: -1, frontCaster: 3.5, frontToe: -1.59, rearCamber: -0.5, rearToe: 1.59 },
    sources: [
      'https://www.minispares.com/blog/2020/02/26/suspension-basic-set-up-method/',
      'https://www.med-engineering.co.uk/blogs/news/classic-mini-suspension-geometry-setup-guide',
      'https://www.calverst.com/technical-info/suspension-basic-set-up-method/',
    ],
  },
  {
    id: 'trackDay',
    confidence: 'medium',
    values: { frontCamber: -2, frontCaster: 4.5, frontToe: -1.59, rearCamber: -0.5, rearToe: 0 },
    sources: [
      'https://www.med-engineering.co.uk/blogs/news/classic-mini-suspension-geometry-setup-guide',
      'https://www.theminiforum.co.uk/forums/topic/238535-please-help-with-front-end-alignment-specs-for-road-racing-setup/',
      'https://www.calverst.com/technical-info/suspension-basic-set-up-method/',
    ],
  },
  {
    id: 'boostedRoad',
    confidence: 'medium',
    values: { frontCamber: -1, frontCaster: 4, frontToe: 0, rearCamber: -0.5, rearToe: 3.18 },
    sources: [
      'https://www.turbominis.co.uk/forums/index.php?p=vt&tid=593349',
      'https://www.med-engineering.co.uk/blogs/news/classic-mini-suspension-geometry-setup-guide',
      'https://www.hpacademy.com/forum/motorsport-wheel-alignment-fundamentals/show/fwd-alignment-loads-of-tourqe-steer/',
    ],
  },
  {
    id: 'boostedTrack',
    confidence: 'low',
    values: { frontCamber: -2.5, frontCaster: 5, frontToe: -1, rearCamber: -1, rearToe: 1.59 },
    sources: [
      'https://www.turbominis.co.uk/forums/index.php?p=vt&tid=345429',
      'https://www.turbominis.co.uk/forums/index.php?p=vt&tid=593349',
      'https://www.med-engineering.co.uk/blogs/news/classic-mini-suspension-geometry-setup-guide',
    ],
  },
];

export function getAlignmentPreset(id: AlignmentPresetId): AlignmentPreset | undefined {
  return ALIGNMENT_PRESETS.find((p) => p.id === id);
}

/** Default tool state = factory/stock geometry. */
export function defaultAlignmentValues(): AlignmentValues {
  return { ...(getAlignmentPreset('stockRoad') as AlignmentPreset).values };
}

/**
 * Convert a TOTAL toe distance (mm, measured across both wheels at the rim) to a per-axle
 * angle in degrees. Wheel-diameter dependent, which is exactly why mm — not degrees — is the
 * canonical toe unit; this readout is informational only.
 */
export function toeMmToDegrees(totalMm: number, wheelDiameterIn: number): number {
  const diameterMm = wheelDiameterIn * MM_PER_INCH;
  if (diameterMm === 0) return 0;
  return 2 * Math.atan(totalMm / 2 / diameterMm) * (180 / Math.PI);
}

/**
 * Render a mm toe value as the nearest common imperial fraction (the Mini world quotes toe in
 * 1/16" increments). Returns an unsigned magnitude string like `1/16"` or `0`; the caller adds
 * the in/out direction word. 1/16" = 1.5875 mm, 1/8" = 3.175 mm, 3/16" = 4.7625 mm.
 */
export function mmToInchFraction(mm: number): string {
  const sixteenths = Math.round((Math.abs(mm) / MM_PER_INCH) * 16);
  if (sixteenths === 0) return '0';
  let num = sixteenths;
  let den = 16;
  while (num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  return den === 1 ? `${num}"` : `${num}/${den}"`;
}
