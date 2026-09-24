/**
 * The reference datasets the web reads, and the highest schema_version of each
 * this build understands (design §5.3: the web pins its shapes, so a shape
 * published before the deploy that reads it cannot break the site).
 *
 * One list for the pull script, the build snapshot and the server loader
 * (`server/utils/referenceData.ts`), so they can never disagree. Plain,
 * type-erasable TS: Node and Bun import it directly from `scripts/`.
 * The mechanism and the publish rules live in classicminidiy-supabase
 * (private); this repo only reads.
 */
export const REFERENCE_MAX_SCHEMA = {
  needles: 1,
  default_needles: 1,
  suggested_needles: 1,
  torque_specs: 1,
  common_clearances: 1,
} as const;

export type ReferenceKey = keyof typeof REFERENCE_MAX_SCHEMA;

export const REFERENCE_KEYS = Object.keys(REFERENCE_MAX_SCHEMA) as ReferenceKey[];
