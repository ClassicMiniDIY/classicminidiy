import { z } from 'zod';
import { options, kphFactor } from '../../../data/models/gearing';

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
      .min(3)
      .max(6)
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
      })
      .default({ width: 145, profile: 80, size: 10 })
      .describe('Tire specifications object with width, profile, and size'),
  },

  async handler({ metric, final_drive, gear_ratios, drop_gear, speedo_drive, max_rpm, tire_type }) {
    // Constants
    const YARDS_IN_MILE = 1760;
    const MM_IN_YARD = 914.4;
    const pi = Math.PI;

    // Calculate tire details
    const tireInfo = {
      width: tire_type.width,
      profile: tire_type.profile,
      size: tire_type.size,
      diameter: Math.round(tire_type.width * (tire_type.profile / 100) * 2 + tire_type.size * 25.4),
      circ: 0,
      tireTurnsPerMile: 0,
    };

    tireInfo.circ = Math.round(pi * tireInfo.diameter); // in mm
    const typeCircInMiles = tireInfo.circ / (YARDS_IN_MILE * MM_IN_YARD); // in miles
    tireInfo.tireTurnsPerMile = Math.round(YARDS_IN_MILE / (tireInfo.circ / MM_IN_YARD));

    // Calculate speedometer details
    const speedoDetails = {
      turnsPerMile: Math.round(tireInfo.tireTurnsPerMile * final_drive * speedo_drive),
      engineRevsMile: Math.round(tireInfo.tireTurnsPerMile * final_drive * drop_gear),
    };

    // Calculate gearing data
    const gearingData = gear_ratios.map((ratio, index) => {
      const gearRatio = ratio * final_drive * drop_gear;
      const maxSpeedAtRpm = (max_rpm / gearRatio) * typeCircInMiles * 60; // Multiply by 60 to convert from minutes to hours
      const maxSpeed = metric ? Math.round(maxSpeedAtRpm * kphFactor) : Math.round(maxSpeedAtRpm);

      return {
        gear: index + 1,
        ratio: ratio,
        totalRatio: Math.round((gearRatio + Number.EPSILON) * 1000) / 1000,
        maxSpeed: maxSpeed,
        unit: metric ? 'kph' : 'mph',
      };
    });

    // Calculate top speed from the highest gear (last entry — 4th for 4-speed, 5th for 5-speed)
    const topSpeedGear = gearingData[gearingData.length - 1];
    const topSpeed = topSpeedGear?.maxSpeed || 0;

    // Calculate speedometer compatibility
    const speedometers = metric ? options.speedos.metric : options.speedos.imperial;
    const factor = metric ? kphFactor : 1;
    const turnsPer = speedoDetails.turnsPerMile / factor;

    const speedometerData = speedometers.map((speedometer: { turns: number; speed: number; name: string }) => {
      const calculatedSpeed = Math.round((speedometer.turns / turnsPer) * speedometer.speed);
      const difference = Math.abs(calculatedSpeed - speedometer.speed);
      const percentageDiff = Math.round((difference / speedometer.speed) * 100);

      let result = 'Perfect Match';
      if (percentageDiff > 0 && percentageDiff <= 5) {
        result = 'Close Match';
      } else if (percentageDiff > 5) {
        result = 'Poor Match';
      }

      return {
        speedometer: speedometer.name,
        turns: speedometer.turns,
        speed: calculatedSpeed,
        expectedSpeed: speedometer.speed,
        difference: difference,
        percentageDiff: percentageDiff,
        result: result,
      };
    });

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

    // Format speedometer matches
    const speedoMatches = speedometerData
      .filter((s: any) => s.result === 'Perfect Match' || s.result === 'Close Match')
      .slice(0, 5)
      .map((s: any) => `${s.speedometer}: ${s.result} (${s.percentageDiff}% diff)`)
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

**Compatible Speedometers:**
${speedoMatches || 'No close matches found'}`;

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

  // Cache results for 1 hour since calculations are deterministic
  cache: '1h',
});
