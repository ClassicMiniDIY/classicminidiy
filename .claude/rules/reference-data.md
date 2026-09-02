---
paths:
  - 'data/torqueSpecs.json'
  - 'data/commonClearances.json'
  - 'data/weights.json'
  - 'data/models/units.ts'
  - 'server/mcp/tools/torque-specs.ts'
  - 'server/mcp/tools/clearances.ts'
  - 'server/mcp/tools/vehicle-weights.ts'
  - 'server/api/torque*'
  - 'server/api/clearance*'
  - 'server/api/weights*'
  - 'app/pages/technical/torque*'
  - 'app/pages/technical/clearance*'
  - 'tests/static/torque-unit-consistency.test.ts'
---

# Reference-data unit rules

Detail and the two-time Electrical-section error: `docs/invariants/reference-data-units.md`.

- **Imperial is the SOURCE, metric is DERIVED.** Where they disagree the imperial figure is right. `tests/static/torque-unit-consistency.test.ts` has no exemptions; a row that cannot be reconciled is removed, not exempted.
- **Every torque row is lb-ft.** The Electrical section was mislabelled `lbin` and correcting the conversion while trusting the label shipped six fasteners twelvefold too low. A field name is not evidence; two independent columns agreeing (kgm x 9.80665 vs lbft x 1.35582) is. `lbin` stays defined in `units.ts` for future rows.
- `thou` holds INCHES (`0.012` = 12 thou). Vehicle weights are kilograms and say so nowhere.
- `data/models/units.ts` is the single source for units; consumers import it, never restate. Describe every numeric column present (`unitsForItems()`), never convert on the way out, derive headers from every row not row zero, and keep the row counts in `torque-specs.ts`'s description asserted against the data.
