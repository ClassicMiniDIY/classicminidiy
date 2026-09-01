import type { UnitDescriptions } from './units';

export interface TorqueSpecs {
  engineTable: Table;
  suspensionTable: Table;
  electricalTable: ElectricalTable;
  gearboxTable: Table;
}

export interface ElectricalTable {
  title: string;
  icon: string;
  search: string;
  items: ElectricalTableItem[];
  /**
   * What each numeric column of THIS section holds — see `data/models/units.ts`.
   *
   * Per section because the unit varies by section: the Electrical torque table
   * is published in pound-INCHES while the rest are pound-feet. Optional, so a
   * consumer that never reads it is unaffected.
   */
  units?: UnitDescriptions;
}

export interface ElectricalTableItem {
  name: string;
  lbin: number | string;
  nm: number | string;
  notes: string;
}

export interface Table {
  title: string;
  icon: string;
  search: string;
  items: EngineTableItem[];
  /**
   * What each numeric column of THIS section holds — see `data/models/units.ts`.
   *
   * Per section because the unit varies by section: the Electrical torque table
   * is published in pound-INCHES while the rest are pound-feet. Optional, so a
   * consumer that never reads it is unaffected.
   */
  units?: UnitDescriptions;
}

export interface EngineTableItem {
  name: string;
  lbft: string;
  nm: string;
  notes?: string;
}
