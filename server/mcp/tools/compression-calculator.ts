import { z } from 'zod';
import { formOptions } from '../../../data/models/compression';
import { calculateCompression } from '../../../app/utils/compressionCalculations';

/**
 * Compression Calculator MCP Tool
 * Calculate compression ratio and engine capacity for Classic Mini engines
 */
export default defineMcpTool({
  description:
    'Calculate compression ratio and engine capacity for Classic Mini engines. Supports various piston sizes (62.9mm to 74mm), crankshafts (850cc to custom stroked), head gaskets, and decompression plates.',

  inputSchema: {
    bore: z.number().default(7.06).describe('Bore diameter in cm (e.g., 7.06 for 70.6mm). Range: 6.29cm to 7.4cm'),
    stroke: z
      .number()
      .default(8.128)
      .describe('Stroke length in cm (e.g., 8.128 for 81.28mm). Range: 6.826cm to custom'),
    pistonDish: z.number().default(6.5).describe('Piston dish volume in cc. Typical values: 6.5cc to 12cc'),
    headVolume: z.number().default(25.5).describe('Cylinder head chamber volume in cc. Typical values: 22cc to 30cc'),
    deckHeight: z
      .number()
      .default(20)
      .describe('Piston deck height in thousandths of an inch. Typical values: 10 to 40 thou'),
    gasket: z
      .number()
      .default(3.4)
      .describe('Head gasket volume in cc (use 0 for custom). Standard: 2.4cc (850), 3.4cc (1275)'),
    customGasket: z.number().default(0.1).describe('Custom gasket volume in cc (used when gasket is 0)'),
    decomp: z.number().default(0).describe('Decompression plate volume in cc. Range: 0cc to 12.4cc'),
  },

  async handler({ bore, stroke, pistonDish, headVolume, deckHeight, gasket, customGasket, decomp }) {
    // Same code the on-site calculator runs (app/utils/compressionCalculations.ts).
    // This used to be a second copy of the expressions; the gearbox pair, forked
    // the same way, had already drifted into answering a different question.
    const { boreRadius, deckVolume, ringland, gasketVolume, vc, sweptVolume, ratio, capacity } = calculateCompression({
      bore,
      stroke,
      pistonDish,
      headVolume,
      deckHeight,
      gasket,
      customGasket,
      decomp,
    });

    // Find matching piston and crankshaft options for context
    const matchingPiston = formOptions.pistonOptions.find((p) => p.value === bore);
    const matchingCrankshaft = formOptions.crankshaftOptions.find((c) => c.value === stroke);
    const matchingGasket = formOptions.headGasketOptions.find((g) => g.value === gasket);
    const matchingDecomp = formOptions.decompPlateOptions.find((d) => d.value === decomp);

    const pistonSize = matchingPiston?.label || `${bore}mm (custom)`;
    const crankshaft = matchingCrankshaft?.label || `${stroke}mm (custom)`;
    const headGasket = matchingGasket?.label || `${gasket === 0 ? customGasket : gasket}cc (custom)`;
    const decompPlate = matchingDecomp?.label || `${decomp}cc (custom)`;

    // Format results in a human-readable way
    const resultText = `
      **Compression Calculator Results**
      **Engine Configuration:**
      - Bore: ${bore}cm (${pistonSize})
      - Stroke: ${stroke}cm (${crankshaft})
      - Head Gasket: ${headGasket}
      - Decompression Plate: ${decompPlate}

      **Measurements:**
      - Piston Dish: ${pistonDish}cc
      - Head Volume: ${headVolume}cc
      - Deck Height: ${deckHeight} thou

      **Results:**
      - **Compression Ratio: ${ratio}:1**
      - **Engine Capacity: ${capacity}cc**
      - Combustion Chamber Volume: ${Math.round((vc + Number.EPSILON) * 100) / 100}cc

      **Calculation Details:**
      - Bore Radius: ${boreRadius}cm
      - Deck Volume: ${Math.round((deckVolume + Number.EPSILON) * 100) / 100}cc
      - Ringland Volume: ${Math.round((ringland + Number.EPSILON) * 100) / 100}cc
      - Total Chamber Volume: ${Math.round((vc + Number.EPSILON) * 100) / 100}cc`;

    return jsonResult({
      inputs: {
        bore,
        stroke,
        pistonDish,
        headVolume,
        deckHeight,
        gasket: gasket === 0 ? customGasket : gasket,
        decomp,
      },
      results: {
        compressionRatio: ratio,
        engineCapacity: capacity,
        combustionChamberVolume: Math.round((vc + Number.EPSILON) * 100) / 100,
      },
      context: {
        pistonSize,
        crankshaft,
        headGasket,
        decompPlate,
      },
      calculations: {
        boreRadius,
        deckVolume: Math.round((deckVolume + Number.EPSILON) * 100) / 100,
        ringlandVolume: Math.round((ringland + Number.EPSILON) * 100) / 100,
        totalCombustionChamberVolume: Math.round((vc + Number.EPSILON) * 100) / 100,
      },
      formattedText: resultText,
    });
  },

  // Cache results for 1 hour since calculations are deterministic
  cache: '1h',
});
