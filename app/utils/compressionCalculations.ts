/**
 * Compression ratio and engine capacity for A-series engines.
 *
 * Shared by the on-site calculator (app/components/Calculators/Compression.vue)
 * and the MCP tool (server/mcp/tools/compression-calculator.ts), which each held
 * their own copy of these expressions. The two agreed when this was written and
 * had no way of staying that way — the gearbox pair, forked the same way, had
 * already drifted into answering different questions.
 *
 * Units are CENTIMETRES for bore and stroke, cc for volumes, and thousandths of
 * an inch for deck height. That is what the site's inputs have always used; the
 * MCP tool's schema documents the same.
 *
 * Note this uses Math.PI, while gearing uses a 3.14159 literal. That difference
 * is deliberate and long-standing on the site — see the PI_DISPLAY comment in
 * Compression.vue — so it is preserved here rather than quietly harmonised.
 */

/** Ringland volume per unit bore. Correct for 18cc Accrallite 73.5mm pistons. */
const RINGLAND_FACTOR = 0.047619;

/** Thousandths of an inch -> centimetres. */
const THOU_TO_CM = 0.0254;

export const COMPRESSION_PI = Math.PI;

export interface CompressionInputs {
  /** Bore diameter, cm. */
  bore: number;
  /** Stroke length, cm. */
  stroke: number;
  /** Piston dish volume, cc. */
  pistonDish: number;
  /** Cylinder head chamber volume, cc. */
  headVolume: number;
  /** Piston deck height, thousandths of an inch. */
  deckHeight: number;
  /** Head gasket volume in cc, or 0 to use customGasket. */
  gasket: number;
  /** Gasket volume used when `gasket` is 0. */
  customGasket: number;
  /** Decompression plate volume, cc. */
  decomp: number;
}

export interface CompressionResult {
  boreRadius: number;
  deck: number;
  deckVolume: number;
  ringland: number;
  gasketVolume: number;
  /** Total combustion chamber volume, cc. */
  vc: number;
  /** Swept volume of ONE cylinder. */
  sweptVolume: number;
  /** Compression ratio, rounded to 2dp. */
  ratio: number;
  /** Engine capacity in cc (4 cylinders), rounded to 2dp. */
  capacity: number;
}

/** Round to 2dp the way both calculators always have. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCompression(inputs: CompressionInputs): CompressionResult {
  const { bore, stroke, pistonDish, headVolume, deckHeight, gasket, customGasket, decomp } = inputs;

  const boreRadius = bore / 2;
  const deck = deckHeight * THOU_TO_CM;
  const deckVolume = boreRadius * boreRadius * (deck / 10) * COMPRESSION_PI;
  const ringland = bore * RINGLAND_FACTOR;
  const gasketVolume = gasket === 0 ? customGasket : gasket;

  const vc = pistonDish + gasketVolume + headVolume + deckVolume + ringland + decomp;
  const sweptVolume = stroke * (boreRadius * boreRadius) * COMPRESSION_PI;

  return {
    boreRadius,
    deck,
    deckVolume,
    ringland,
    gasketVolume,
    vc,
    sweptVolume,
    ratio: round2((sweptVolume + vc) / vc),
    capacity: round2(sweptVolume * 4),
  };
}
