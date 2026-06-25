# Classic Mini Alignment Tool — Design Doc

**Date:** 2026-06-23
**Author:** Cole (w/ Claude)
**Status:** In progress
**Branch:** `claude/crazy-bouman-504d1b`

## Context

The technical toolbox has calculators for compression, gearing, needles, etc., but nothing
for **wheel alignment** — one of the most-discussed and most-misunderstood setup topics in the
Classic Mini world (factory front camber is *positive*; front runs toe-*out*; rear runs
toe-*in* — all easy to get backwards). Owners currently piece this together from scattered
forum threads.

This adds a `/technical/alignment` tool that:

1. Lets a user dial in the five adjustable alignment parameters and **see a live top-down +
   elevation diagram** update in real time (à la hurreysoffroad / robrobinette calculators).
2. Ships **5 research-derived presets** (Stock Road, Fast Road, Track Day, Boosted Road,
   Boosted Track) sourced from MED, Mini Spares, Calver, The Mini Forum, TurboMinis, and the
   Rover/Haynes workshop manuals.
3. Lets logged-in users **save configurations with a dated journal log** to their profile
   (mirrors saved gear configs), so they can track spec changes and driving impressions over
   time.

Web first; the data model + presets are intended to cascade to the iOS/Android toolbox later
(GitHub Project #9 card).

## Parameters (canonical units + sign conventions)

| Param | Unit | Sign convention | Min | Max | Step | Stock default |
|---|---|---|---|---|---|---|
| Front camber | ° | + = top leans OUT, − = top leans IN (stock is **positive**) | −3 | 2.5 | 0.25 | +2 |
| Front caster | ° | always **positive** | 1 | 7 | 0.25 | +3 |
| Front toe (total) | mm | − = toe-**OUT**, + = toe-IN (front runs **toe-out**) | −4 | 3 | 0.25 | −1.59 |
| Rear camber | ° | + = out, − = in | −2 | 1 | 0.25 | 0 |
| Rear toe (total) | mm | + = toe-**IN**, − = toe-OUT (rear runs **toe-in**) | −1 | 5 | 0.25 | +3.18 |

Plus a **wheel-diameter** selector (10″ / 12″ / 13″) that drives an optional toe degree readout
(`angle = 2·atan((total/2)/diameter)`) and a camber-guidance note (camber recs scale with rim size).

**Toe is TOTAL across both wheels** (Mini hobby convention), not per-wheel — surfaced explicitly
in the UI. Key conversions: 1/16″ = 1.5875 mm, 1/8″ = 3.175 mm, 3/16″ = 4.7625 mm.

## Presets

A clear ladder from mildest to most aggressive, plus the two boosted setups. (Renamed 2026-06-25
per user/community feedback — "fast road" dropped; Factory split out from a gently-improved Stock
Road; boosted caster raised to match real forced-induction practice.)

| Preset | F camber | F caster | F toe (mm) | R camber | R toe (mm) | Conf. |
|---|---|---|---|---|---|---|
| Factory | +2 | +3 | −1.59 (1/16″ out) | 0 | +3.18 (1/8″ in) | high |
| Stock Road | −0.5 | +3 | −1.59 | 0 | +3.18 | high |
| Performance | −1 | +3.5 | −1.59 | −0.5 | +1.59 | high |
| Track | −2 | +4.5 | −1.59 | −0.5 | 0 (straight) | medium |
| Boosted Road | −1 | +6 | 0 (parallel) | −0.5 | +3.18 | medium |
| Boosted Track | −2.5 | +6.5 | −1 | −1 | +1.59 | low |

Factory = pure Haynes geometry; Stock Road = factory gently corrected for modern radials (mild
negative front camber). Each preset carries a `rationale` + `sources[]` + `confidence`. The
Boosted-Road headline is **front toe set parallel** (Wiginton) to cut torque steer; the high
boosted caster (6° / 6.5°) reflects practitioner input (turbo Minis run far more caster than N/A).
Full numbers/rationale/sources live in `data/models/alignment.ts`. Standing disclaimer in the tool:
starting points only, verify on a rig, match sides within 0.5°.

## Architecture (mirrors saved gear configs 1:1)

Save/load uses the established pattern: client composable → `/api/*` route with
`Authorization: Bearer <token>` (from `supabase.auth.getSession()`) → `getServiceClient()`
server-side with explicit `.eq('user_id', user.id)` → RLS-backed table. (Per the load-bearing
rule: Supabase session is localStorage, so server routes need the explicit Bearer header.)

### New Supabase table (in `classicminidiy-supabase`, applied to remote)

`saved_alignment_configs`: `id`, `user_id` (FK auth.users, cascade), `name`, `is_public`,
`front_camber/front_caster/front_toe/rear_camber/rear_toe` (numeric), `wheel_size` (text, null),
`preset` (text, null — preset it was based on), `notes` (text, null), `journal` (jsonb, default
`[]` — array of `{ id, date, body }`), `created_at`, `updated_at`. Same 5 RLS policies + public-read
policy + `set_updated_at` trigger reusing existing `public.handle_updated_at()`. Then regen
`types/database.ts` in the web repo.

### Web files

- `data/models/alignment.ts` — `ALIGNMENT_PARAMETERS`, `ALIGNMENT_PRESETS`, unit conversions, source list, disclaimer.
- `app/types/alignment.ts` — `AlignmentValues`, `SavedAlignmentConfig`, `CreateAlignmentConfigInput`, `JournalEntry`.
- `app/composables/useAlignmentConfigs.ts` — copy of `useGearConfigs.ts` + journal helpers (add/update/delete entry → `updateConfig({ journal })`).
- `server/api/alignment-configs/{index.post,index.get}.ts`, `[id].{put,delete}.ts`, `public/[userId].get.ts` — copy of gear-configs routes (validate the 5 numerics + name; max 25/user).
- `app/components/Calculators/AlignmentDiagram.vue` — reactive SVG: top-down plan view (toe, visually exaggerated), front + rear elevation insets (camber), side inset (caster). Brand palette, animated transitions.
- `app/components/Calculators/Alignment.vue` — 5 sliders + wheel-size + preset selector + readouts + diagram + save/load (anonymous can use everything except save).
- `app/components/Alignment/AlignmentSaveLoadModal.vue` — load a saved config (mirrors GearboxSaveLoadModal).
- `app/pages/technical/alignment.vue` — page wrapper (hero/breadcrumb/PageIntro/ClientOnly + Lazy component + SEO/JSON-LD), per gearing.vue.
- `app/pages/dashboard/alignment-configs.vue` — dashboard tab: list configs, edit values inline, manage the dated journal, public toggle, delete.
- Register: add card to `ToolboxItems` in `data/models/generic.ts` (+ i18n keys in `technical/index.vue`); add tab to `tabs[]` in `dashboard.vue` (+ i18n).

### Visualization approach

Custom inline SVG (no Highcharts — wrong fit for a plan view; no 3D lib exists). Real toe angles
are <0.5° so the diagram applies a fixed visual-exaggeration factor for legibility while the numeric
readout shows the true value. Front toe-out splays the wheels' leading edges apart; rear toe-in
brings them together; camber leans the wheel tops; caster tilts the steering axis rearward. Smooth
CSS transitions on transforms give the "real-time" feel as sliders move.

## i18n

Per-component `<i18n lang="json">` blocks, all 10 locales (en es fr de it pt ru ja zh ko), no HTML
in messages. Build English-complete first, then a translation pass fills the other 9. Add keys to
`technical/index.vue`, `dashboard.vue`, and the new components/pages.

## Verification

1. `bun run dev`; load `/technical/alignment` — diagram renders, presets populate the sliders,
   dragging a slider animates the diagram live (preview MCP: snapshot + screenshot + console).
2. Toe sign sanity: front negative ⇒ wheels splay out (toe-out label); rear positive ⇒ wheels toe in.
3. Logged in: save a config → appears in `/dashboard/alignment-configs`; add a journal entry; reload
   into the tool; toggle public; delete. Confirm rows via Supabase.
4. `bun run build` passes (Nitro). Vitest for `data/models/alignment.ts` conversions/preset integrity.

## Out of scope / follow-ups

- Mobile (iOS/Android) port — tracked on Project #9.
- Per-wheel (split L/R) alignment entry — tool uses total-toe convention only for now.
- Wheel size drives the toe°-at-rim readout and per-rim camber guidance (typical range + an aggressive-camber nudge under the camber sliders); *auto-rewriting preset camber numbers* per rim is still out of scope (presets assume ~10″).
