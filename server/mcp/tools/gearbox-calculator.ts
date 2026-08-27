import { z } from 'zod';
import { options, kphFactor } from '../../../data/models/gearing';
import {
  calculateTire,
  calculateGearingTable,
  calculateSpeedoData,
  calculateSpeedometerTable,
} from '../../../app/utils/gearingCalculations';

/**
 * Gearbox Calculator MCP Tool
 * Calculate gear ratios, top speed, and speedometer compatibility for Classic Mini gearboxes
 */
export default defineMcpTool({
  description:
    'Calculate gear ratios, top speed, and speedometer compatibility for Classic Mini gearboxes. Supports both 4-speed and 5-speed gearboxes (including the Minispares Evolution 5-Speed with overdrive 5th), various final drives (2.76:1 to 4.571:1), gear ratios (Pre-64 Magic Wand to modern dog engagement kits), tire sizes (145/80r10 to 195/50r13), and speedometer drives.',

  inputSchema: {
    metric: z.boolean().default(false).describe('Use metric units (true for km/h, false for mph)'),
    final_drive: z
      .number()
      .default(3.444)
      .describe('Final drive ratio (e.g., 3.444 for standard). Range: 2.76 to 4.571'),
    gear_ratios: z
      .array(z.number())
      .min(4)
      .max(5)
      .default([2.583, 1.644, 1.25, 1.0])
      .describe(
        'Gear ratios in order [1st, 2nd, 3rd, 4th, optional 5th]. Length 4 for 4-speed (e.g., [2.583, 1.644, 1.25, 1.0]) or 5 for 5-speed (e.g., [2.583, 1.644, 1.25, 1.0, 0.865]).'
      ),
    drop_gear: z.number().default(1).describe('Drop gear ratio. Standard: 1.0'),
    speedo_drive: z.number().default(0.3529).describe('Speedometer drive ratio. Common: 0.3529 (5/18)'),
    max_rpm: z.number().default(6500).describe('Maximum engine RPM. Typical: 6000-7000 RPM'),
    tire_type: z
      .object({
        width: z.number().describe('Tire width in mm (e.g., 145)'),
        profile: z.number().describe('Tire profile percentage (e.g., 80 for 80%)'),
        size: z.number().describe('Wheel size in inches (e.g., 10)'),
        // Racing slicks are sold by overall diameter, not width/profile, so
        // deriving one from the other is wrong for them. TireValue has carried
        // this field all along; the schema omitted it, which silently stripped
        // it from any caller that supplied one and sent the tool back to the
        // derived figure. For the Hoosier 19.0x5.0-10 that meant 254mm instead
        // of 477.52mm — a top speed of 56mph where the truth is 106mph.
        diameter: z
          .number()
          .optional()
          .describe(
            'Overall tire diameter in mm. Optional; supply it for tires specified by diameter (racing slicks such as the Hoosier 19.0 x 5.0-10, which is 477.52mm). When present it is used directly and width/profile/size are not used to derive it.'
          ),
      })
      .default({ width: 145, profile: 80, size: 10 })
      .describe('Tire specifications: width, profile and wheel size, or an explicit overall diameter'),
  },

  async handler({ metric, final_drive, gear_ratios, drop_gear, speedo_drive, max_rpm, tire_type }) {
    // All arithmetic comes from app/utils/gearingCalculations.ts — the same code
    // the on-site calculator runs. This tool used to re-implement it and had
    // drifted in three ways that changed the answers: Math.PI where the site
    // deliberately uses a 3.14159 literal, tire_type.diameter ignored so preset
    // tires that carry an explicit diameter were recomputed from width/profile,
    // and a speedometer assessment that measured something else entirely AND
    // dropped drop_gear from the calculation.
    const tireInfo = calculateTire(tire_type);
    const typeCircInMiles = tireInfo.typeCircInMiles;
    const speedoDetails = calculateSpeedoData(tireInfo.tireTurnsPerMile, final_drive, speedo_drive, drop_gear);

    const gearingRows = calculateGearingTable(gear_ratios, final_drive, drop_gear, max_rpm, typeCircInMiles, metric);

    const gearingData = gearingRows.map((row) => ({
      gear: row.gear,
      ratio: row.ratio,
      totalRatio: Math.round((row.ratio * final_drive * drop_gear + Number.EPSILON) * 1000) / 1000,
      maxSpeed: row.maxSpeedRaw,
      unit: metric ? 'kph' : 'mph',
    }));

    // Highest gear is the last entry (4th for a 4-speed, 5th for a 5-speed).
    const topSpeed = gearingData[gearingData.length - 1]?.maxSpeed || 0;

    // Speedometer accuracy, in the site's terms: how far the needle reads from
    // true, as a percentage. The previous "Perfect/Close/Poor Match" verdict
    // answered a question the site never asks and ignored drop_gear, so a
    // dropped-gear setup got a confidently wrong assessment.
    const speedometers = metric ? options.speedos.metric : options.speedos.imperial;
    const speedometerData = calculateSpeedometerTable(speedometers, speedoDetails.turnsPerMile, drop_gear, metric).map(
      (row) => ({
        speedometer: row.speedometer,
        turns: row.turns,
        speed: row.speed,
        // 100 = reads true. Above reads fast, below reads slow.
        variation: row.variation,
        readsOverPercent: row.variation > 100 ? row.variation - 100 : 0,
        readsUnderPercent: row.variation < 100 ? 100 - row.variation : 0,
        result: row.result,
      })
    );

    // Find matching options for context
    const matchingTire = options.tires.find(
      (t: any) =>
        t.value.width === tire_type.width && t.value.profile === tire_type.profile && t.value.size === tire_type.size
    );
    const matchingDiff = options.diffs.find((d: any) => d.value === final_drive);
    const matchingGearRatio = options.gearRatios.find(
      (g: any) => JSON.stringify(g.value) === JSON.stringify(gear_ratios)
    );
    const matchingSpeedoDrive = options.speedosRatios.find((s: any) => s.value === speedo_drive);

    // Convert display values for metric
    const displayEngineRevs = metric
      ? Math.round(speedoDetails.engineRevsMile / kphFactor)
      : speedoDetails.engineRevsMile;
    const displayGearTurns = metric ? Math.round(speedoDetails.turnsPerMile / kphFactor) : speedoDetails.turnsPerMile;
    const displayTireTurns = metric ? Math.round(tireInfo.tireTurnsPerMile / kphFactor) : tireInfo.tireTurnsPerMile;
    const distanceUnit = metric ? 'Km' : 'Mile';

    // Format gear table
    const gearingTable = gearingData
      .map((g) => `${g.gear}: ${g.ratio} (${g.totalRatio}:1 total) - Max: ${g.maxSpeed}${g.unit}`)
      .join('\n');

    // Closest speedometers first — smallest deviation from a true reading.
    const speedoMatches = [...speedometerData]
      .sort((a, b) => Math.abs(a.variation - 100) - Math.abs(b.variation - 100))
      .slice(0, 5)
      .map((s) => `${s.speedometer} (${s.turns} turns): ${s.result}`)
      .join('\n');

    const resultText = `**Gearbox Calculator Results**

**Configuration:**
- Tire: ${matchingTire?.label || `${tire_type.width}/${tire_type.profile}r${tire_type.size} (custom)`}
- Final Drive: ${matchingDiff?.label || `${final_drive}:1 (custom)`}
- Gear Ratios: ${matchingGearRatio?.label || 'Custom gear ratios'}
- Speedo Drive: ${matchingSpeedoDrive?.label || `${speedo_drive}:1 (custom)`}
- Max RPM: ${max_rpm}
- Units: ${metric ? 'Metric' : 'Imperial'}

**Performance:**
- **Top Speed: ${topSpeed}${metric ? 'kph' : 'mph'}**
- Engine Revs per ${distanceUnit}: ${displayEngineRevs}
- Gearbox Turns per ${distanceUnit}: ${displayGearTurns}
- Tire Turns per ${distanceUnit}: ${displayTireTurns}

**Gear Ratios:**
${gearingTable}

**Tire Information:**
- Diameter: ${tireInfo.diameter}mm
- Circumference: ${tireInfo.circ}mm
- Turns per Mile: ${tireInfo.tireTurnsPerMile}

**Speedometer Accuracy (closest first):**
${speedoMatches || 'No speedometer data available'}`;

    return jsonResult({
      inputs: {
        metric,
        final_drive,
        gear_ratios,
        drop_gear,
        speedo_drive,
        max_rpm,
        tire_type,
      },
      results: {
        topSpeed: topSpeed,
        topSpeedUnit: metric ? 'kph' : 'mph',
        engineRevsPerDistance: displayEngineRevs,
        gearboxTurnsPerDistance: displayGearTurns,
        tireTurnsPerDistance: displayTireTurns,
        distanceUnit: distanceUnit,
      },
      gearing: gearingData,
      speedometers: speedometerData,
      tireInfo: {
        diameter: tireInfo.diameter,
        circumference: tireInfo.circ,
        turnsPerMile: tireInfo.tireTurnsPerMile,
      },
      context: {
        tireSize: matchingTire?.label || `${tire_type.width}/${tire_type.profile}r${tire_type.size} (custom)`,
        finalDrive: matchingDiff?.label || `${final_drive}:1 (custom)`,
        gearRatios: matchingGearRatio?.label || 'Custom gear ratios',
        speedoDrive: matchingSpeedoDrive?.label || `${speedo_drive}:1 (custom)`,
      },
      formattedText: resultText,
    });
  },

  // Deliberately NOT cached. The toolkit's default cache key is
  // Object.values(args).map(String).join(':') (mcp-toolkit
  // definitions/tools.js), and tire_type is an OBJECT, so every tire
  // configuration stringifies to the same "[object Object]" segment and shares
  // one key. Two callers differing only in tire size would collide.
  //
  // Measured as latent rather than live — under wrangler dev --local and against
  // production, different tire sizes returned correctly different results, so
  // the cache is not currently serving mismatched values. It is removed rather
  // than re-keyed because this is pure arithmetic in the microsecond range:
  // there is nothing to gain, and a wrong answer is a poor trade for it. Any
  // tool taking an object-valued input needs an explicit getKey if it caches.
});
