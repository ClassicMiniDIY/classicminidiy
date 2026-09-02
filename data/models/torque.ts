import type { UnitDescriptions } from './units';

export interface TorqueSpecs {
  engineTable: Table;
  suspensionTable: Table;
  electricalTable: ElectricalTable;
  gearboxTable: Table;
  /**
   * General-purpose figures by thread and spanner size, for a fastener with no
   * published spec of its own. A named fastener in the other sections always
   * wins — this is the fallback, not a shortcut.
   */
  generalTable: Table;
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
  lbft: string;
  nm: string;
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
