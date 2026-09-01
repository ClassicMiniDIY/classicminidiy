import type { UnitDescriptions } from './units';

export interface Item {
  item: string;
  weight: number | null;
}

export interface Table {
  title: string;
  search: string;
  items: Item[];
  /**
   * What each numeric column of THIS section holds — see `data/models/units.ts`.
   *
   * Per section because the unit varies by section: the Electrical torque table
   * is published in pound-INCHES while the rest are pound-feet. Optional, so a
   * consumer that never reads it is unaffected.
   */
  units?: UnitDescriptions;
}

/**
 * Every section in data/weights.json. This listed only five of the twelve until
 * 2026-08, so `/api/weights` was typed as returning less than it does while the
 * archive page renders whatever `Object.entries()` finds — the extra sections
 * displayed correctly but were invisible to the type system.
 *
 * The `title` is what the archive page prints as a heading, so it must be unique
 * across sections: `EngineBay` and `Engine` were both titled "Electrics", which
 * put three identically-headed panels on /archive/weights.
 */
export interface Weights {
  CurbWeights: Table;
  Brakes: Table;
  Body: Table;
  Electrics: Table;
  EngineBay: Table;
  Engine: Table;
  FuelSystem: Table;
  Interior: Table;
  LightweightReplacements: Table;
  Steering: Table;
  Suspension: Table;
  Transmission: Table;
}
