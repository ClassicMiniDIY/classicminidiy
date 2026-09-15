/**
 * What people type → which reference-table row answers it.
 *
 * The torque and clearance direct-answer cards (docs/plans/2026-09-14-unified-search.md)
 * render a figure in the search palette instead of a link to the table. That
 * needs a map from the words a person uses ("flywheel torque", "tappet gap")
 * to ONE row in `data/torqueSpecs.json` or `data/commonClearances.json`. The
 * map is data, here, so a new noun is a row and not a deploy of logic.
 *
 * RULES THE STATIC TEST ENFORCES (`tests/static/reference-nouns.test.ts`):
 *   * `section` + `item` must name a row that exists, character for character.
 *     A stale row would render a wrong number as an answer, which is worse
 *     than no card, so the test fails the build rather than the card.
 *   * Every `terms` entry is lower-case and unique across the file.
 *
 * MATCHING (`server/utils/directAnswers.ts`): a term matches when every word
 * of it appears as a WHOLE WORD in the query, in any order. The entry with the
 * longest matching term wins, so `flywheel housing` beats `flywheel`. A query
 * of more than four words never matches — that is a question for the bot.
 *
 * Where the tables hold several rows for one noun (head nuts by engine size,
 * main bearings early/late), the term maps to the row a person most often
 * means and the card links to the table for the rest. Units come from
 * `data/models/units.ts` at render time and are never restated here.
 */

export type ReferenceTable = 'torque' | 'clearance';

export interface ReferenceNoun {
  /** Lower-case phrases. Matched as whole words, any order. */
  terms: string[];
  table: ReferenceTable;
  /** The section key in the JSON file, e.g. `engineTable`. */
  section: string;
  /** The row's `name`, exactly as written in the JSON file. */
  item: string;
}

export const REFERENCE_NOUNS: ReferenceNoun[] = [
  // --- Torque: engine ------------------------------------------------------
  {
    terms: ['head nuts', 'cylinder head nuts', 'head torque', 'head nut torque'],
    table: 'torque',
    section: 'engineTable',
    item: 'Cylinder Head Nuts (11 stud head)',
  },
  {
    terms: ['head bolts', 'cylinder head bolts'],
    table: 'torque',
    section: 'engineTable',
    item: 'Cylinder Head Bolts (11 stud head)',
  },
  {
    terms: ['head stud nuts', '998 head nuts', '850 head nuts'],
    table: 'torque',
    section: 'engineTable',
    item: 'Cylinder Head Stud Nuts',
  },
  {
    terms: ['big end', 'big end bolts', 'con rod bolts', 'conrod bolts', 'big-end'],
    table: 'torque',
    section: 'engineTable',
    item: 'Con Rod Big-end Bolts',
  },
  {
    terms: ['big end nuts', 'con rod nuts', 'conrod nuts'],
    table: 'torque',
    section: 'engineTable',
    item: 'Con Rod Big-end Nuts',
  },
  {
    terms: ['main bearing', 'main bearings', 'main bearing bolts', 'main cap bolts', 'main caps'],
    table: 'torque',
    section: 'engineTable',
    item: 'Main Bearing Bolts',
  },
  {
    terms: ['crank pulley', 'crankshaft pulley', 'crank pulley bolt', 'crank bolt', 'damper bolt'],
    table: 'torque',
    section: 'engineTable',
    item: 'Crankshaft Pulley Bolt',
  },
  { terms: ['cam nut', 'camshaft nut'], table: 'torque', section: 'engineTable', item: 'Camshaft Nut' },
  {
    terms: ['cam plate', 'camshaft retaining plate', 'cam retaining plate'],
    table: 'torque',
    section: 'engineTable',
    item: 'Camshaft Retaining Plate Bolts',
  },
  {
    terms: ['rocker cover', 'rocker cover bolts', 'valve cover'],
    table: 'torque',
    section: 'engineTable',
    item: 'Rocker Cover Bolts',
  },
  {
    terms: ['rocker shaft', 'rocker shaft nuts', 'rocker pedestal'],
    table: 'torque',
    section: 'engineTable',
    item: 'Rocker Shaft Bracket Nuts',
  },
  {
    terms: ['spark plug torque', 'spark plugs torque', 'plug torque', 'spark plugs', 'spark plug'],
    table: 'torque',
    section: 'engineTable',
    item: 'Spark Plugs',
  },
  {
    terms: ['manifold', 'manifold nuts', 'manifold torque', 'exhaust manifold', 'inlet manifold'],
    table: 'torque',
    section: 'engineTable',
    item: 'Manifold to Cylinder Head',
  },
  { terms: ['oil pump', 'oil pump bolts'], table: 'torque', section: 'engineTable', item: 'Oil Pump Bolts' },
  {
    terms: ['oil filter housing', 'filter housing'],
    table: 'torque',
    section: 'engineTable',
    item: 'Oil Filter Housing Bolts',
  },
  {
    terms: ['thermostat housing', 'thermostat', 'stat housing'],
    table: 'torque',
    section: 'engineTable',
    item: 'Thermostat Housing',
  },
  { terms: ['water pump', 'water pump bolts'], table: 'torque', section: 'engineTable', item: 'Water Pump to Block' },
  { terms: ['water pump pulley'], table: 'torque', section: 'engineTable', item: 'Water Pump Pulley Bolts' },
  {
    terms: ['timing cover', 'front plate'],
    table: 'torque',
    section: 'engineTable',
    item: 'Timing Cover and Front Plate 5/16 UNF bolts',
  },
  {
    terms: ['gudgeon pin', 'gudgeon pin clamp', 'gudgeon bolt'],
    table: 'torque',
    section: 'engineTable',
    item: 'Gudgeon Pin Clamp Bolt',
  },
  {
    terms: ['side cover', 'tappet cover', 'tappet chest cover'],
    table: 'torque',
    section: 'engineTable',
    item: 'Cylinder Side Cover',
  },
  {
    terms: ['engine mount', 'engine mounts', 'engine mount bolts', 'engine mounting'],
    table: 'torque',
    section: 'engineTable',
    item: 'Engine Mount (LH) to Subframe',
  },
  {
    terms: ['tie bar', 'tie-bar', 'lower tie bar', 'engine tie bar'],
    table: 'torque',
    section: 'engineTable',
    item: 'Engine Lower Tie-Bar to Subframe',
  },
  {
    terms: ['upper tie bar', 'engine steady', 'engine steady bar'],
    table: 'torque',
    section: 'engineTable',
    item: 'Engine Upper Tie-Bar to Bulkhead',
  },
  {
    terms: ['oil pressure relief', 'oil pressure relief valve', 'relief valve dome nut', 'dome nut'],
    table: 'torque',
    section: 'engineTable',
    item: 'Oil Pressure Release Valve Dome Nut',
  },
  {
    terms: ['temperature sender', 'temp sender', 'thermal transmitter'],
    table: 'torque',
    section: 'engineTable',
    item: 'Thermal Transmitter',
  },

  // --- Torque: clutch and gearbox -----------------------------------------
  {
    terms: [
      'flywheel',
      'flywheel bolt',
      'flywheel torque',
      'flywheel centre bolt',
      'flywheel center bolt',
      'flywheel nut',
    ],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Flywheel Center Bolt',
  },
  {
    terms: ['flywheel housing', 'wok bolts', 'flywheel housing bolts', 'clutch housing'],
    table: 'torque',
    section: 'gearboxTable',
    item: "Flywheel Housing 'Wok' Bolts",
  },
  {
    terms: ['driving strap', 'driving straps', 'clutch straps'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Driving Strap to Flywheel (non-Verto)',
  },
  {
    terms: ['diaphragm spring', 'pressure plate', 'clutch pressure plate', 'diaphragm housing'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Diaphragm Spring Housing to Pressure Plate (non-Verto)',
  },
  {
    terms: ['first motion shaft', 'first motion shaft nut', 'primary gear nut', 'input shaft nut'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'First Motion Shaft Nut',
  },
  {
    terms: ['third motion shaft', 'third motion shaft nut', 'mainshaft nut'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Third Motion Shaft Nut',
  },
  {
    terms: ['diff end cover', 'differential end cover', 'diff cover'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Differential Housing End Cover bolts',
  },
  {
    terms: ['crownwheel', 'crown wheel', 'crownwheel bolts', 'driven gear'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Driven Gear to Differential Cage',
  },
  {
    terms: ['drive flange', 'driving flange', 'diff flange nut', 'output flange'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Driving Flange to Differential nut (tighten to next split pin hole)',
  },
  {
    terms: ['gearbox drain plug', 'transmission drain plug', 'drain plug', 'sump plug', 'oil drain plug'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Transmission Drain Plug',
  },
  {
    terms: ['transmission case', 'gearbox case', 'gearbox to block', 'transmission to crankcase'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Transmission Case to Crankcase',
  },
  {
    terms: ['clutch slave', 'slave cylinder', 'slave cylinder bolts'],
    table: 'torque',
    section: 'gearboxTable',
    item: 'Clutch Slave to Mounting Plate (Verto)',
  },

  // --- Torque: suspension, steering, brakes -------------------------------
  {
    terms: ['wheel nuts', 'wheel nut', 'wheel nut torque', 'lug nuts', 'wheel bolts'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Wheel Nuts',
  },
  {
    terms: ['hub nut', 'driveshaft nut', 'drive shaft nut', 'front hub nut', 'cv nut'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Driveshaft Retaining Nut (Drum Brake Models)',
  },
  { terms: ['rear hub nut', 'rear hub'], table: 'torque', section: 'suspensionTable', item: 'Rear Hub Retaining Nut' },
  {
    terms: ['caliper bolts', 'caliper', 'brake caliper', 'caliper retaining bolts'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Caliper retaining bolts',
  },
  {
    terms: ['ball joint', 'ball joints', 'swivel hub ball joint', 'ball joint socket'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Swivel Hub Ball Joint Socket',
  },
  {
    terms: ['ball joint nut', 'ball joint to arm'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Swivel Hub Ball Joint to Suspension Arms',
  },
  {
    terms: ['track rod end', 'track rod', 'tie rod end', 'trackrod end'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Steering Track-rod End to Steering Arm',
  },
  {
    terms: ['track rod lock nut', 'track rod end lock nut'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Track Rod End to Steering Rack Lock Nut',
  },
  {
    terms: ['steering wheel nut', 'steering wheel'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Steering-wheel Nut',
  },
  {
    terms: ['steering rack', 'rack u bolts', 'rack u-bolts', 'steering rack bolts'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Steering rack U-bolts to floor',
  },
  {
    terms: ['steering arm', 'steering arm bolts'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Steering arm to swivel hub',
  },
  {
    terms: ['radius arm', 'radius arm pivot', 'radius arm nut', 'rear radius arm'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Rear Radius Arm Pivot Shaft Nut',
  },
  {
    terms: ['upper arm', 'top arm', 'upper arm pivot', 'top arm pivot', 'upper support arm'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Front Suspension Upper Support Arm Pivot Shaft Nut',
  },
  {
    terms: ['lower arm', 'bottom arm', 'wishbone', 'lower wishbone', 'wishbone pivot'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Front Suspension Lower Wishbone Pivot Shaft Nut',
  },
  {
    terms: ['subframe tower', 'subframe turret', 'tower bolts', 'turret bolts'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Front Subframe Turret (Tower) Bolts',
  },
  {
    terms: ['front tie rod', 'suspension tie rod', 'tie rod to subframe'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Tie Rod to Front Subframe',
  },
  {
    terms: ['driveshaft u bolts', 'driveshaft u-bolts', 'rubber coupling', 'coupling u-bolts', 'pot joint u bolts'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Driveshaft Coupling U-bolts (rubber cross inner joints)',
  },
  {
    terms: ['backplate', 'brake backplate', 'backplate bolts'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Backplate to rear radius arm bolts',
  },
  {
    terms: ['column clamp', 'pinion clamp', 'steering column clamp'],
    table: 'torque',
    section: 'suspensionTable',
    item: 'Steering column/rack pinion clamp bolt',
  },

  // --- Torque: electrical --------------------------------------------------
  {
    terms: ['distributor clamp', 'dizzy clamp', 'distributor clamp bolt'],
    table: 'torque',
    section: 'electricalTable',
    item: 'Distributor Clamp Bolt (fixed nut type)',
  },
  {
    terms: ['alternator through bolts', 'alternator bolts'],
    table: 'torque',
    section: 'electricalTable',
    item: 'Alternator (11AC) through-bolts',
  },

  // --- Clearances ----------------------------------------------------------
  {
    terms: [
      'tappet',
      'tappets',
      'tappet gap',
      'tappet clearance',
      'valve clearance',
      'valve gap',
      'rocker clearance',
      'rocker gap',
      'valve lash',
    ],
    table: 'clearance',
    section: 'engineTable',
    item: 'Rocker/Valve Clearance - Stock',
  },
  {
    terms: ['roller rocker clearance', 'roller rockers', 'roller rocker gap'],
    table: 'clearance',
    section: 'engineTable',
    item: 'Rocker/Valve Clearance - Rollers',
  },
  {
    terms: [
      'crank endfloat',
      'crankshaft endfloat',
      'crank end float',
      'thrust washer',
      'thrust washers',
      'thrust washer clearance',
    ],
    table: 'clearance',
    section: 'engineTable',
    item: 'Crankshaft Thrust Washer Endfloat',
  },
  {
    terms: ['primary gear endfloat', 'primary gear', 'primary gear end float'],
    table: 'clearance',
    section: 'gearboxTable',
    item: 'Primary Gear Endfloat',
  },
  {
    terms: ['idler gear endfloat', 'idler gear', 'idler endfloat', 'idler gear end float'],
    table: 'clearance',
    section: 'gearboxTable',
    item: 'Idler Gear Helical Endfloat',
  },
  {
    terms: ['straight cut idler', 'straight cut idler endfloat'],
    table: 'clearance',
    section: 'gearboxTable',
    item: 'Idler Gear Straight Cut Endfloat',
  },
  {
    terms: ['third motion bearing', 'bearing retainer clearance'],
    table: 'clearance',
    section: 'gearboxTable',
    item: 'Third Motion Bearing Retainer Clearance',
  },
];
