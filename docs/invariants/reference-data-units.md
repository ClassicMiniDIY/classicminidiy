# Reference-data unit invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/reference-data.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

### Reference-data unit invariants

`data/{torqueSpecs,commonClearances,weights}.json` feed the website tables, the
`/api/{torque,clearance,weights}` routes, four `/mcp` tools and the generated
FAQ corpus. Two of their columns are actively misleading if read by name, and
getting one wrong is a wrong figure for a real fastener rather than a cosmetic
bug.

- **The imperial column is the SOURCE; metric is DERIVED.** The original manuals
  printed lb-ft (or lb-in); the Nm column is a courtesy this project adds. So
  where the two disagree, the imperial one is right and the conversion is wrong.
  `tests/static/torque-unit-consistency.test.ts` holds every row to its own
  source column and has NO exemptions — a row that cannot be reconciled is
  removed rather than exempted, because a wrong torque figure is worse than a
  missing one. Seven of 93 rows disagreed when this was first checked.

- **Every torque row is pound-feet. The Electrical section was filed as `lbin`
  in error, and that error cost real figures twice.** Its metric column did not
  convert, which looked like a bad conversion; correcting the CONVERSION while
  trusting the field name then made those six fasteners twelvefold too LOW,
  briefly in production. The source publishes that section in lb-ft like every
  other, and its kgm column confirms it independently — kgm x 9.80665 and
  lbft x 1.35582 agree to the rounding on all six rows.

  The lesson is about which column to trust. A field NAME is not evidence; two
  independent columns agreeing is. When an imperial and a metric figure
  disagree, work out which reading makes both the metric column and the
  physical context true before changing either — a distributor clamp bolt
  cannot be torqued harder than the cylinder head studs, and that check would
  have caught it in both directions.

  `lbin` remains described in `data/models/units.ts` and handled by the torque
  page's column header, deliberately, though no row uses it: manuals do publish
  small fasteners in pound-inches, and one arriving unlabelled is the twelvefold
  error again.

- **`thou` holds INCHES despite the name.** `0.012` means 12 thou, not 0.012
  thou. Read literally it is out by a thousand.

- **Vehicle weights are kilograms and say so nowhere in the data.** The rows are
  bare numbers.

**`data/models/units.ts` is the single source for all of this**, and it lives
beside the data rather than in any one consumer for a reason: the same fact used
to be restated in the MCP tool, the page's table headers, that page's Dataset
JSON-LD and the FAQ generator, and they drifted — the FAQ generator rendered
clearances as inches while the table header said thou, live, for months. A new
consumer imports from there; it does not restate the unit.

Corollaries when touching these datasets:

- Every numeric column a caller can see must be described. `unitsForItems()`
  returns only the columns actually present, because naming a unit that is not
  in the answer invites a conversion nobody asked for.
- Never convert between units on the way out. Deliver the figure the source
  published, in the unit it published it in.
- A column header must be derived from every row, not from row zero. The
  Electrical table is uniformly lb-in by luck, not by constraint.
- The row counts in `torque-specs.ts`'s description are asserted against the
  data; they are the first thing a model reads about the dataset.
