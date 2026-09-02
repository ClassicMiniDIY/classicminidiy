# Calculator invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/calculators.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### Calculator invariants

- **Every technical calculator publishes its arithmetic, and the panel is fed from
  the calculator's OWN computed values.** `CalculatorsMathBreakdown`
  (`app/components/Calculators/MathBreakdown.vue`) renders an ordered list of
  `MathStep`s — symbolic formula, the same formula with the reader's live inputs
  substituted, and the result — so a reader can redo the sums by hand and land on
  the numbers on screen. The steps are built in the calculator itself
  (`Gearbox.vue`, `Compression.vue`) by reading the same `computed`s the result
  cards and tables render. **Never recompute a result inside the steps array.** A
  second implementation drifts silently from the first, and a breakdown that
  disagrees with the answer above it is worse than no breakdown at all — it makes
  the calculator look wrong when it is right, or hides a real bug.

  Corollary: when you change a formula in `app/utils/gearingCalculations.ts` or in
  `Compression.vue`'s computeds, update the matching `formula`/`substitution`
  strings in the same commit. Nothing enforces this at build time.

- **The "these equations live here" source links must point at a path that exists
  on `main`.** Both calculators previously linked to `SomethingNew71/classicminidiy`
  at `blob/dev/components/SpeedoDriveCalculator.vue#L512` and
  `blob/master/components/CompressionCalculator.vue#L344`. Both 404'd: the files
  were renamed (`SpeedoDriveCalculator` → `GearboxCalculator` → `Calculators/Gearbox.vue`)
  and the Nuxt 4 restructure moved root `components/` under `app/`, while `dev` and
  `master` no longer carry that layout. Link the FILE on `main`, never a line
  number — line anchors rot on the next edit, and the panel above already tells the
  reader which step to look for.
