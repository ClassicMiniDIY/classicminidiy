import { kphFactor, type TireValue, type ISpeedometer } from '../../data/models/gearing';

const YARDS_IN_MILE = 1760;
const MM_IN_YARD = 914.4;

export interface TireCalculationResult {
  width: number;
  profile: number;
  size: number;
  diameter: number;
  circ: number;
  tireTurnsPerMile: number;
  typeCircInMiles: number;
}

export interface GearingTableRow {
  gear: number;
  ratio: number;
  maxSpeed: string;
  maxSpeedRaw: number;
}

export interface ChartSeriesData {
  name: string;
  data: number[];
  dashStyle?: string;
  color?: string;
  visible?: boolean;
  marker?: { symbol?: string; enabled?: boolean };
}

export function calculateTire(tireType: TireValue): TireCalculationResult {
  let diameter: number;
  if (tireType.diameter) {
    diameter = tireType.diameter;
  } else {
    diameter = Math.round(tireType.width * (tireType.profile / 100) * 2 + tireType.size * 25.4);
  }

  const circ = Math.round(3.14159 * diameter);
  const typeCircInMiles = circ / (YARDS_IN_MILE * MM_IN_YARD);
  const tireTurnsPerMile = Math.round(YARDS_IN_MILE / (circ / MM_IN_YARD));

  return {
    width: tireType.width,
    profile: tireType.profile,
    size: tireType.size,
    diameter,
    circ,
    tireTurnsPerMile,
    typeCircInMiles,
  };
}

export function calculateGearingTable(
  gearRatios: number[],
  finalDrive: number,
  dropGear: number,
  maxRpm: number,
  typeCircInMiles: number,
  metric: boolean
): GearingTableRow[] {
  return gearRatios.map((gear, index) => {
    const maxSpeedMph = Math.round((maxRpm / dropGear / gear / finalDrive) * typeCircInMiles * 60);
    const maxSpeedRaw = metric ? Math.round(maxSpeedMph * kphFactor) : maxSpeedMph;
    const maxSpeed = metric ? `${maxSpeedRaw}km/h` : `${maxSpeedMph}mph`;

    return {
      gear: index + 1,
      ratio: gear,
      maxSpeed,
      maxSpeedRaw,
    };
  });
}

export function calculateSpeedoData(
  tireTurnsPerMile: number,
  finalDrive: number,
  speedoDrive: number,
  dropGear: number
) {
  return {
    turnsPerMile: Math.round(tireTurnsPerMile * finalDrive * speedoDrive),
    engineRevsMile: Math.round(tireTurnsPerMile * finalDrive * dropGear),
  };
}

export function calculateSpeedometerTable(
  speedometers: ISpeedometer[],
  turnsPerMile: number,
  dropGear: number,
  metric: boolean
) {
  const factor = metric ? kphFactor : 1;

  return speedometers.map((speedometer) => {
    const turnsPer = turnsPerMile / factor;
    const variation = Math.round((turnsPer / speedometer.turns) * 100 * dropGear);
    let result = '';
    let status = '';

    if (variation > 100) {
      status = 'text-red';
      result = `Over ${variation - 100}%`;
    } else if (variation === 100) {
      status = 'text-green';
      result = 'Reads correctly!';
    } else {
      status = 'text-primary';
      result = `Under ${100 - variation}%`;
    }

    return {
      status,
      speedometer: speedometer.name,
      turns: speedometer.turns,
      speed: speedometer.speed,
      result,
    };
  });
}
