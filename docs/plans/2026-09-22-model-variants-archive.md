# Model Variants archive — design

Status: design. Nothing built. Data preservation spike done (see §8).
Branch here: `claude/mini-model-archive-f61ebf`.

Related: `docs/plans/2026-03-01-phase6-contribution-system.md` (submission queue + trust),
`docs/plans/2026-09-04-parts-number-database.md` (process template: schema → ingest → surface),
`docs/plans/2026-09-04-chat-agent-knowledge-expansion.md` (why the agent needs archive
tools), and the membership contract in `classicminidiy-supabase`.

## Summary

A new archive section that holds one row per **model variant** of the Classic Mini
(1959–2000): Austin Seven, Morris Mini-Minor, Cooper 997, Cooper S 1071, Clubman 1275 GT,
Innocenti Cooper 1300, Authi 1275 GT, Mini Thirty, Cooper RSP, every limited edition, and
so on. Each row carries a typed spec sheet, factory colours, production numbers, photos,
and sources. The section is:

1. **A public archive surface** at `/archive/variants` (index + detail pages).
2. **A contribution target.** Members add variants, propose spec edits, attach photos
   and link colours through the existing `submission_queue` → `/admin/queue` flow.
3. **An MCP tool** (`model-variants`) that the `/chat` agent and Developer API keys call
   to answer "what engine did the Innocenti Cooper 1300 have" with archive data.
4. **Seeded from a defunct site.** `austinminiwebsearch.com` (French enthusiast site,
   offline since ~2023) documented 140+ variants with the same spec sheet on every page.
   The Wayback Machine copy was crawled on 2026-09-22 and parsed to JSON (§8). That is
   the seed. It is not the ceiling: the schema is wider than the source.

The design follows the wheels/colours pattern exactly. New concepts are kept to the
minimum: one new `target_type_enum` value, one new storage bucket, one new MCP tool.

## 0. Naming decision

The working title was "Model Registry". Two names are already taken:

| Taken name          | What it is                                                   |
| ------------------- | ------------------------------------------------------------ |
| `/archive/registry` | The **car register**: individual real cars owned by members. |
| `/models`           | The **3D printable model library** (`models` table).         |

"Model Registry" reads as either of those. The design uses **variant** everywhere:

| Thing               | Name                                                 |
| ------------------- | ---------------------------------------------------- |
| Route               | `/archive/variants`, `/archive/variants/[slug]`       |
| Section label       | "Model Variants" (subnav key `variants`)             |
| Table               | `model_variants` (+ `model_variant_photos`, `model_variant_colors`) |
| `target_type_enum`  | `variant`                                            |
| `ContributionKind`  | `variant`                                            |
| Storage bucket      | `archive-variants`                                   |
| MCP tool            | `server/mcp/tools/model-variants.ts`                 |
| Wizard payload key  | `variant`                                            |

`variant` is already the site's word: `variant_enum` on `listings`, and the `variants`
history category in `data/miniHistory.json`. The design file (`Model Registry.dc.html`)
keeps its title; the page it describes ships at `/archive/variants`.

**Decision for Cole:** confirm `variants` over `models`. Everything below assumes it.

## 1. Data model (lives in `classicminidiy-supabase`)

All DDL, RLS, grants, enums and the seed migration go in the private repo. This repo
regenerates `types/database.ts` and reads. Column names below are the contract.

### 1.1 `model_variants` — one row per variant

Identity and classification:

| Column               | Type                     | Notes                                                                                      |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `id`                 | uuid pk                  |                                                                                            |
| `slug`               | text unique              | `cooper-s-1275-mk1`, `innocenti-cooper-1300-export`. URL key. Never changes once approved. |
| `name`               | text                     | Display name: "Austin / Morris Mini Cooper S 1275 Mk1".                                    |
| `marque`             | `variant_marque_enum`    | `austin`, `morris`, `austin_morris`, `mini` (post-1969 marque), `rover`, `innocenti`, `authi`, `riley`, `wolseley`, `leyland`, `other` |
| `family`             | `variant_family_enum`    | `saloon`, `cooper`, `cooper_s`, `clubman`, `clubman_estate`, `1275_gt`, `countryman_traveller`, `van`, `pickup`, `moke`, `elf_hornet`, `cabriolet`, `limited_edition`, `special` |
| `body_style`         | `variant_body_enum`      | `saloon`, `estate`, `van`, `pickup`, `moke`, `cabriolet`                                   |
| `mark`               | smallint null            | 1–7. Null for cars outside the UK mark sequence (Innocenti, Authi).                        |
| `market`             | `variant_market_enum`    | `uk`, `europe`, `italy`, `spain`, `france`, `germany`, `japan`, `south_africa`, `australia`, `new_zealand`, `usa`, `other` |
| `year_start`         | smallint                 |                                                                                            |
| `year_end`           | smallint null            | Null = single model year or unknown.                                                       |
| `is_limited_edition` | boolean                  |                                                                                            |
| `edition_size`       | integer null             | Announced run for limited editions.                                                        |
| `production_total`   | integer null             | Sum across marques where known.                                                            |
| `production`         | jsonb                    | `[{"marque":"austin","count":12395},{"marque":"morris","count":12465}]`. Source of `production_total`. |
| `based_on_id`        | uuid null fk self        | Limited edition → the base variant (Mini Sprite 1983 → Mini City E).                       |
| `description`        | text null                | Free prose. Markdown allowed; rendered with the existing sanitiser.                        |
| `distinguishing`     | text[]                   | Short bullets: "Twin fuel tanks", "Hydrolastic from 1964". Feeds the chat tool.            |

Spec sheet (typed; the source strings are kept in `specs_source`):

| Column               | Type          | Unit rule (`.claude/rules/reference-data.md`)                       |
| -------------------- | ------------- | ------------------------------------------------------------------- |
| `engine_cc`          | smallint null |                                                                     |
| `engine_code`        | text null     | Factory prefix, cross-links `/technical/engine-decoder`.            |
| `bore_mm`            | numeric null  |                                                                     |
| `stroke_mm`          | numeric null  |                                                                     |
| `compression_ratio`  | numeric null  | 9.0 for "9 : 1".                                                    |
| `power_bhp`          | numeric null  | Source unit. Metric (PS/kW) derived on read.                        |
| `power_rpm`          | smallint null |                                                                     |
| `torque_lbft`        | numeric null  | Source unit. The site gave mkg; converted on import (×7.233).       |
| `torque_rpm`         | smallint null |                                                                     |
| `fuel_system`        | `variant_fuel_enum` | `carb_single`, `carb_twin`, `spi`, `mpi`                       |
| `carburettor`        | text null     | "Twin SU HS2", "SU HS4". Cross-links `/technical/needles`.          |
| `gearbox`            | text null     | "4-speed manual", "AP automatic".                                   |
| `final_drive`        | numeric null  | 3.765                                                               |
| `suspension`         | `variant_suspension_enum` null | `rubber_cone`, `hydrolastic`                       |
| `brakes_front`       | text null     | "7-inch drum", "7.5-inch disc", "8.4-inch disc".                     |
| `brakes_rear`        | text null     |                                                                     |
| `wheels`             | text null     | "Steel 3.5J x 10". Free text; cross-links `/archive/wheels` by search. |
| `tyres`              | text null     | "Dunlop Gold Seal 5.20 x 10".                                       |
| `kerb_weight_kg`     | numeric null  | Kilograms per the weights rule.                                     |
| `top_speed_mph`      | numeric null  | Source unit. km/h derived on read.                                  |
| `length_mm` / `width_mm` / `height_mm` / `wheelbase_mm` | numeric null | Not in the seed; here for contributions. |
| `specs_source`       | jsonb         | The raw label→value pairs from the source page, verbatim.           |

Provenance and moderation (same shape as `wheels`):

| Column                | Type                        | Notes                                                                   |
| --------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `sources`             | jsonb                       | `[{"type":"web_archive","url":"…","title":"…","accessed":"2026-09-22"}]` |
| `status`              | `moderation_status_enum`    | Only `approved` is ever public.                                         |
| `submitted_by`        | uuid null fk profiles       | Trust ledger. Every approval writes it.                                 |
| `legacy_submitted_by` | text null                   | `austinminiwebsearch.com` for the seed.                                 |
| `created_at`, `updated_at`, `reviewed_by`, `reviewed_at` |         |                                                       |

Constraints: `year_start <= year_end`, `mark between 1 and 7`, `slug ~ '^[a-z0-9-]+$'`,
`edition_size > 0`. A unique index on `(marque, name, year_start)` stops the duplicate
problem the colours archive had (`docs/invariants/contributions.md`).

### 1.2 `model_variant_photos`

| Column         | Type                     | Notes                                                          |
| -------------- | ------------------------ | -------------------------------------------------------------- |
| `id`           | uuid pk                  |                                                                |
| `variant_id`   | uuid fk → model_variants |                                                                |
| `url`          | text                     | Public storage URL in `archive-variants`.                      |
| `kind`         | `variant_photo_kind_enum` | `brochure`, `factory`, `period`, `owner`, `interior`, `engine`, `badge` |
| `caption`      | text null                |                                                                |
| `credit`       | text null                | Free text credit line.                                         |
| `is_primary`   | boolean                  | One per variant (partial unique index).                        |
| `sort_order`   | smallint                 |                                                                |
| `status`       | `moderation_status_enum` |                                                                |
| `submitted_by` | uuid null                |                                                                |
| `source`       | jsonb null               | Same shape as `sources` above.                                 |

Separate table, not a `photos text[]` column, because each photo has its own status,
credit and kind, and because a photo can be rejected without touching the variant.

### 1.3 `model_variant_colors`

| Column         | Type                     | Notes                                                                 |
| -------------- | ------------------------ | --------------------------------------------------------------------- |
| `variant_id`   | uuid fk                  |                                                                       |
| `color_id`     | uuid null fk → colors    | Set when the name resolves to an approved colour.                     |
| `color_name`   | text                     | Always kept. "Island Blue". Resolved lazily; unresolved rows still render. |
| `year_start`, `year_end` | smallint null  | Colour availability inside the variant's run, when known.             |
| `sort_order`   | smallint                 |                                                                       |

Primary key `(variant_id, color_name)`. This is the join that makes the colour pages
show "available on" and the variant pages link into `/archive/colors`. The seed writes
`color_name` only; a follow-up job resolves `color_id` by exact name match against
approved colours and leaves the rest for contributors.

### 1.4 Shared plumbing changes

- `target_type_enum` += `variant`.
- `contributor_archive_items` view gains a `model_variants` branch (rule: single source
  for contributor stats).
- `omnisearch()` gains a `variants` source (name, marque, family, engine_cc, years).
- Storage bucket `archive-variants`, public read, writes only through the upload route.
- RLS: `select` where `status = 'approved'` for anon/authenticated; writes service-role
  only. Contributors never write these tables directly; they write `submission_queue`.
- Grants are explicit (local-stack grant asymmetry memory).
- A `model_variants_public` view is not needed: no private columns.

## 2. Contribution flows

All through `ContributeWizard.vue` (the only archive form) and `submission_queue`.

| Flow                | `submission_queue.type` | `target_type` | `target_id` | `data` payload                                                 | Approval effect                                                                 |
| ------------------- | ----------------------- | ------------- | ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| New variant         | `new_item`              | `variant`     | null        | Full §1.1 shape (typed fields), `colors[]`, `uploadedFiles[]`  | Insert `model_variants` + photos + colours; write `submitted_by`; trust ledger. |
| Spec edit           | `edit_suggestion`       | `variant`     | variant id  | `changes: { power_bhp: 76, torque_lbft: 79 }` + `reason`       | Column-allowlisted update (`EDIT_TARGETS.variant`).                             |
| Add photo           | `edit_suggestion`       | `variant`     | variant id  | `uploadedFiles[]` only, plus `photoKind`, `caption`, `credit`  | Insert `model_variant_photos` (`PHOTO_APPEND_TARGETS.variant`).                 |
| Add / remove colour | `edit_suggestion`       | `variant`     | variant id  | `changes: { colors: [...] }`                                   | Replace the colour set (treated as one allowlisted "column").                   |

`EDIT_TARGETS.variant.columns` = every spec column in §1.1 plus `name`, `description`,
`distinguishing`, `year_start`, `year_end`, `production`, `edition_size`, `based_on_id`,
`sources`. **Never** `slug`, `status`, `submitted_by`, `marque`/`family`/`mark` changes
without a reviewer note (a reclassification is a moderation act, so those three are
excluded from the allowlist and go through `request-changes` + admin edit).

Wizard step 2 for `variant` is a grouped form: Identity (marque, family, body, mark,
market, years), Engine, Drivetrain, Running gear, Production, Colours (chips backed by
`useColors()` search with free-text fallback), Sources. Every numeric field has the unit
in the label from `data/models/units.ts`. Review card in `server/utils/review/surfaces.ts`
adds two findings: year sanity (reuse `yearFinding`) and "engine_cc not one of the known
A-series capacities" (848, 970, 997, 998, 1071, 1098, 1275 + `other` allowed with a note).

Photo uploads reuse `/api/archive/upload` with `bucket=archive-variants`, JPEG/PNG/WebP,
5 MB, added to `BUCKET_CONFIGS` there and `UPLOAD_BUCKETS` in `archiveApprovals.ts`.

## 3. Web surfaces (this repo)

### 3.1 `/archive/variants` — index

Implements `Model Registry.dc.html` (design file; see §9 for the import blocker).
Structure per the wheels pattern: `<hero>` → `<ArchiveSubnav active-key="variants">` →
breadcrumb → contribute banner → `<PageIntro>` → filters → grid.

- Filters via `useFacetedSeo()` with allowlisted params: `marque`, `family`, `mark`,
  `market`, `era` (decade), `engine` (cc), `q`. Word-prefix search client-side over the
  approved list (Fuse.js, same as wheels).
- Default sort: `mark`, then `year_start`, then `name`. A "by mark" timeline strip
  (Mk1 1959–67 … Mk7 1996–2000) doubles as the mark filter.
- Card: primary photo (`<NuxtImg format="webp">`), name, years, engine cc, marque chip,
  limited-edition badge.
- `CollectionPage` + `ItemList` JSON-LD. `ogImage` is a constant S3 social card.
- Data: `useVariants()` composable, explicit column list, `status = 'approved'`, paged
  with `.range()` (never a JS tally of a PostgREST list).

### 3.2 `/archive/variants/[slug]` — detail

- `useAsyncData` on slug; **404 with `fatal: true` on a miss**.
- Header: name, marque, years, mark, market, edition size.
- Spec sheet: two-column table grouped Engine / Drivetrain / Running gear / Dimensions.
  Each value shows source unit with the derived unit beside it (`76 bhp (77 PS)`,
  `635 kg (1,400 lb)`). Nulls are hidden, not shown as dashes.
- Colours: chips. Resolved ones link to `/archive/colors/[id]` and carry the swatch.
- Photos: gallery from `model_variant_photos` with kind + credit. Primary first.
- Production: table by marque + total.
- "Also see": `based_on_id` relation both ways, siblings in the same family, and
  cross-links to `/technical/engine-decoder`, `/technical/needles` (when carburettor is
  known), and matching `/archive/wheels` search.
- Sources list, rendered as a plain list with the accessed date.
- Actions (gated on `hasMounted`): "Suggest a spec edit", "Add a photo", "Add a colour"
  → `openWizard({ kind: 'variant', mode: 'contribute', targetType: 'variant', targetId })`.
- SEO: `Product`-free; use `Article`-style JSON-LD with `about: Car` (`brand`, `model`,
  `vehicleEngine`). `ogImage` is a `computed()` with a real fallback, never `''`.
- `defineOgImageComponent` only if the route stays out of prerender (OG-cards memory).

### 3.3 Registration checklist (six places that must agree)

1. `data/models/toolbox-catalog.ts` `ARCHIVE_SECTIONS` + `ARCHIVE_SEARCH_SECTIONS`.
2. `app/components/archive/ArchiveSubnav.vue` i18n `sections.variants` × 10 locales.
3. `data/models/generic.ts` `ArchiveItems` + `app/pages/archive/index.vue` title map +
   i18n × 10 locales.
4. `nuxt.config.ts`: `'/archive/variants': { prerender: true }` for the index; the
   detail class stays SSR; sitemap prefix list.
5. `app/components/archive/ArchiveActivity.vue` latest-additions strip.
6. `data/models/units.ts`: `VARIANT_UNITS` map.

Admin: `/admin/queue` needs no new page. `approve.post.ts` gains `case 'variant'` in
`insertApprovedItem`, `EDIT_TARGETS.variant`, `PHOTO_APPEND_TARGETS.variant`, and the
colour-set branch. `surfaces.ts` gains the description + findings.

## 4. MCP tool: `model-variants`

File `server/mcp/tools/model-variants.ts`, modelled on `color-lookup.ts`.

Input:

```
query?: string      // name fragment: "cooper s", "innocenti", "1275 gt", "sprite"
marque?: enum
family?: enum
mark?: 1..7
year?: number       // variant in production that year
engine_cc?: number
limit?: 1..50 (default 10)
```

Behaviour:

- Service client, explicit columns, `status = 'approved'`, PostgREST `.or()` with `,()`
  stripped from the query, `limit + 1` over-fetch for an exact `truncated` flag,
  `readableError()` on failure.
- One query joins `model_variant_colors (color_name, color_id)` and the primary photo.
- Result per match: identity, the full spec sheet with units in the key names
  (`power_bhp`, `torque_lbft`, `kerb_weight_kg`, `top_speed_mph`), `production`,
  `colors[]`, `distinguishing[]`, `url: https://www.classicminidiy.com/archive/variants/<slug>`.
- `formattedText`: a compact spec sheet the agent can quote.
- `related`: sibling variants by family via `pickRelated()`.

Registration: `DEFINITIONS` in `server/utils/agentTools.ts`; `PAID_ONLY_TOOLS` in
`shared/utils/mcpTiers.ts` (archive tools are paid; `parts-lookup` is the only
exception); `scripts/test-mcp-transport.sh` paid-tool check; `server/mcp/README.md`
table. The `/chat` agent gets it through `buildAgentTools()` with no tier gate.

Prompt guidance (`server/agent/prompt.ts` `toolGuidanceList`): "For questions about a
specific Mini model, trim, year range, engine, or limited edition, call `model-variants`
before `mini-history`. Quote the spec sheet; say when a field is missing rather than
guessing."

## 5. Search

- `omnisearch()` (private repo) gets a `variants` union branch; intent ordering in
  `server/utils/searchTriage.ts` sends model-shaped queries ("mini 1275 gt specs",
  "cooper s 1071") to variants first.
- `ARCHIVE_SEARCH_SECTIONS` terms: `models`, `variants`, `mark`, `mk1`…`mk7`, `cooper`,
  `cooper s`, `clubman`, `1275 gt`, `innocenti`, `authi`, `limited edition`, `specs`.

## 6. Mobile

Not in scope. When wanted, the iOS/Android apps read the same tables through PostgREST
(no edge function needed) and the `/api/variants` contract is the Android one, like
`/api/diagrams`.

## 7. Phases

| Phase | Repo                     | Work                                                                                                          | Gate                                        |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1     | `classicminidiy-supabase` | Migration: enums, three tables, RLS, grants, `target_type_enum`, view branch, bucket, omnisearch branch. Seed migration from §8 JSON (specs + colours, `legacy_submitted_by`). | Local stack green; Cole approves `db push`. |
| 2     | this repo                 | `bun run gen:types`; `useVariants()`; index + detail pages from the design file; six-place registration; static tests (i18n × 10, hydration gate, auto-import collisions). | PR, code review pass.                        |
| 3     | this repo                 | Photo import job (§8.3) into `archive-variants`; `model_variant_photos` rows with `source`.                     | Copyright decision (§8.4).                  |
| 4     | this repo                 | Contribution: wizard step, upload bucket, approve branches, review findings, `CLAUDE.md` rule in `.claude/rules/contributions.md`. | PR, code review pass.                        |
| 5     | this repo                 | MCP tool + agent guidance + tier partition + transport script + README.                                         | `scripts/test-mcp-transport.sh` green.       |
| 6     | this repo                 | Colour resolution job; "available on" block on `/archive/colors/[id]`; search triage.                          |                                             |

Phase 2 can ship with seed data and no contribution UI. Phase 4 and 5 are independent.

## 8. Data preservation spike (done 2026-09-22)

### 8.1 Source

`http://austinminiwebsearch.com/minilibrairyGB.html`, Wayback capture `20230129061027`.
The index lists variants grouped by mark (Mk1 1959–67, Mk2 1967–69, Mk3 1969–76,
Mk4 1976–84, Mk5 1984–92, Mk6 1992–96, Mk7 1996–2000) plus Innocenti, Authi, South
Africa, Australia, New Zealand and Japan lines. 141 variant pages were linked. The site
also had colours, wheels, die-cast and books sections; those are out of scope (the
colours and wheels archives already exist here).

### 8.2 Page shape

Every page has the same twelve-row spec table with bilingual labels:

```
Cylindrée / Engine            997cc
Taux de compression           9 : 1
Puissance / Power output      55ch - 6000tr/min
Couple / Torque               7,45mkg - 3600 tr/min
Alimentation / Carb           double carb HS2
Rapport de pont / Final drive 3,76
Jantes / Wheels               steel 3,5x10
Pneus / Tyres                 Dunlop Gold Seal Nylon 5,20 x 10
Poids / Weight                635kg
Vitesse max / Max speed       137km/h
Production                    AUSTIN: 12395 ex, MORRIS: 12465 ex
Couleurs / Colors             Island Blue, Almond Green, …
```

plus a title line (name + mark), a year range, and one to eight brochure photos.
Limited-edition pages add an edition size and sometimes a paragraph of prose.

### 8.3 Pipeline and outputs

Committed next to this doc in `docs/plans/data/`:

- `2026-09-22-model-variants-parse.py` — regex parser over the saved HTML: header lines,
  the twelve spec pairs (values padded when a page leaves a row blank), image URLs.
- `2026-09-22-model-variants-normalise.py` — maps the bilingual labels to §1.1 columns,
  converts `ch` → bhp (×0.986), `mkg` → lb-ft (×7.233), `km/h` → mph (÷1.609), keeps
  every source string in `specs_source`, splits colours, derives `slug`, `marque`,
  `family`, `body_style`, `mark` (explicit, else from the UK year ranges), `market`,
  years, production, and `is_limited_edition`.
- `2026-09-22-model-variants-seed.json` — the seed: **141 variants**, every one with a
  Wayback `sources` entry and `legacy_submitted_by`.

Field coverage of the seed (non-null / 141):

| Field             | Count | Field            | Count |
| ----------------- | ----- | ---------------- | ----- |
| engine_cc         | 141   | kerb_weight_kg   | 132   |
| power_bhp         | 139   | top_speed_mph    | 131   |
| fuel_system       | 138   | colors           | 125   |
| wheels / tyres    | 138   | mark             | 117   |
| compression_ratio | 135   | torque_lbft      | 117   |
| final_drive       | 135   | production_total | 90    |
| year_start        | 140   | year_end         | 80    |

Distribution: 76 limited editions; marques mini 47, rover 37, austin 18, innocenti 11,
austin_morris 8, authi 6, leyland 6, wolseley 2, riley 1, morris 1, other 4 (IMA,
Koelliker, JCG prototype, Monza); markets uk 101, italy 11, spain 6, germany 6, france 4,
south_africa 3, plus nl/jp/ve/nz/au/ch/pt. 187 distinct colour names for §1.3
resolution. 551 image references (532 distinct files), but **the Wayback Machine only
captured 72 of them**: the 2023 page crawl did not fetch the photos, and the domain has
been parked since 2026. Each seed image carries `archived: true|false` and, when true,
the exact capture URL and `local_file`. The 72 recovered files (84 references across
38 variants) are in a tarball held outside the repo (§8.4). The other 460 are lost unless a contributor has the brochure; the photo
contribution flow (§2) is the recovery path.

The derived classification columns are heuristics from the page titles. Expect the
first contributions to be corrections to `market`, `family` and `mark` on the
non-UK and limited-edition rows; that is the intended path.

### 8.4 Copyright position

Spec figures are facts. The photos are brochure and period scans of unknown provenance
republished by a now-defunct hobby site. Position, following the parts-database
precedent:

- Import specs as data with `legacy_submitted_by = 'austinminiwebsearch.com'` and a
  `sources` entry to the Wayback URL on every row.
- Import the 72 recovered photos into `model_variant_photos` with `kind = 'brochure'`,
  `credit = 'via austinminiwebsearch.com (Wayback Machine)'`, and the Wayback URL in
  `source`. Photos render with the credit line. A takedown is one `status = 'rejected'`
  update.
- Never strip the credit. Never claim the photos.

**Decision for Cole:** import the photos in Phase 3 under this position, or hold them
and seed photos from contributors only.

## 9. Design file

The page design lives at `claude.ai/design/p/a64318a5-…?file=Model+Registry.dc.html`
(with `colors_and_type.css`, `support.js`, `assets/logo-wheel-black.png`). The design
MCP requires `/design-login` from an interactive session; this session could not read
it. Phase 2 starts by importing that file. Until then §3.1 is the structural contract
and the design file is the visual one.

## 10. Open questions

1. `variants` vs `models` for the route and label (§0).
2. Photo import position (§8.4).
3. Should `mark` be an enum with the year ranges baked in (`mk1`…`mk7`) so the timeline
   strip needs no lookup table? Proposal: keep `smallint` and put the ranges in
   `data/models/variants.ts` as `MARK_RANGES`.
4. Should the seed include Innocenti/Authi cars with `mark = null` or map them to the
   UK mark they were derived from? Proposal: `null`, with `based_on_id` pointing at the
   UK car where the source says so.
5. Tier for the MCP tool: paid (consistent) or free (a public-good reference table)?
   Proposal: paid, like `color-lookup`.
