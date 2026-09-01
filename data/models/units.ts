/**
 * What each numeric column of the reference datasets is published in.
 *
 * This lives beside the data rather than inside any one consumer because the
 * unit is a property of the DATASET, and it had been restated independently by
 * the MCP tool, the page's table headers, that page's Dataset JSON-LD and the
 * FAQ generator. Those four drifted: the FAQ generator rendered clearances as
 * inches while the table header said "thou" — a thousandfold disagreement about
 * the same column, live, for months.
 *
 * One column is actively misleading if read by name: `thou` holds INCHES, so
 * `0.012` means 12 thou, not 0.012 thou — read literally it is out by a
 * thousand. And one states no unit at all: vehicle weights are bare numbers.
 *
 * `lbin` is described but currently unused. The Electrical torque rows were
 * once filed under it, wrongly — the source publishes that section in lb-ft
 * like every other, and its kgm column confirms it. The entry stays because
 * manuals do publish small fasteners in pound-inches, and a future row that
 * arrives in them must not be described as pound-feet; `unitsForItems` only
 * ever names columns that are actually present, so an unused entry costs
 * nothing and a missing one would cost a factor of twelve.
 *
 * The imperial column is the SOURCE — it is what the original manuals printed.
 * Metric is a courtesy this project adds, which makes it derived, and
 * `tests/static/torque-unit-consistency.test.ts` holds it to its source.
 */
export interface UnitDescriptions {
  [field: string]: string;
}

export const TORQUE_UNITS: UnitDescriptions = {
  lbft: 'pound-feet (lb-ft)',
  // Unused by the current data — see the note above. Do not delete.
  lbin: 'pound-INCHES (lb-in). One twelfth of a pound-foot. NOT interchangeable with lb-ft.',
  nm: 'newton-metres (Nm), converted from the imperial figure beside it',
};

export const CLEARANCE_UNITS: UnitDescriptions = {
  thou: 'INCHES, despite the field name — 0.002 means 0.002 in, i.e. 2 thou',
  mm: 'millimetres (mm)',
};

export const WEIGHT_UNITS: UnitDescriptions = {
  weight: 'kilograms (kg)',
};

/**
 * The subset of a unit map that a given set of rows actually uses.
 *
 * Naming a unit for a column the caller cannot see is its own invitation to
 * convert something, so only the columns actually present are described. This
 * is the single implementation: `unitsInUse` in `server/utils/mcpLookup.ts`
 * delegates here rather than repeating it.
 */
export function unitsForItems(
  items: readonly Record<string, unknown>[],
  units: UnitDescriptions
): UnitDescriptions | undefined {
  const present = new Set<string>();
  for (const item of items) {
    for (const [field, value] of Object.entries(item ?? {})) {
      if (units[field] && value !== null && value !== undefined && value !== '') present.add(field);
    }
  }
  if (present.size === 0) return undefined;
  return Object.fromEntries([...present].sort().map((field) => [field, units[field] as string]));
}

/**
 * Attach `units` to every section of a reference dataset.
 *
 * Per SECTION rather than at the top level, twice over: the unit genuinely
 * varies by section — the Electrical torque table is pound-inches while the
 * rest are pound-feet — and every consumer of these datasets iterates the
 * sections with `Object.entries`, so a sibling key at the top level would hand
 * each of them a non-table to render.
 *
 * The cast is narrow and is the reason this is a helper rather than three
 * copies: the returned object has exactly the input's keys, each value the
 * input's value plus one optional field, which TypeScript cannot infer through
 * `Object.fromEntries`.
 */
export function withUnits<T extends Record<string, { items?: readonly unknown[] }>>(
  specs: T,
  units: UnitDescriptions
): T {
  // Through `unknown`: `Object.fromEntries` erases the key types, so TypeScript
  // sees an index signature rather than T and cannot check the two against each
  // other. What IS true, and what the cast asserts, is that every key of T is
  // present and every value is its original plus one optional field.
  return Object.fromEntries(
    Object.entries(specs).map(([section, table]) => [
      section,
      { ...table, units: unitsForItems((table.items ?? []) as Record<string, unknown>[], units) },
    ])
  ) as unknown as T;
}
