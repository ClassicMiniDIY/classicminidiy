---
paths:
  - 'app/components/Calculators/**'
  - 'app/utils/gearingCalculations.ts'
  - 'app/pages/technical/**'
---

# Calculator rules

Detail: `docs/invariants/calculators.md`.

- Every technical calculator publishes its arithmetic through `CalculatorsMathBreakdown` (`app/components/Calculators/MathBreakdown.vue`), and the `MathStep` list is fed from the calculator's OWN computeds. **Never recompute a result inside the steps array**; a second implementation drifts silently.
- When a formula changes in `app/utils/gearingCalculations.ts` or `Compression.vue`, update the matching `formula`/`substitution` strings in the same commit. Nothing enforces this at build time.
- The "these equations live here" source links must point at the FILE on `main`, never a line number or a dead branch (`dev`/`master` no longer carry the layout).
