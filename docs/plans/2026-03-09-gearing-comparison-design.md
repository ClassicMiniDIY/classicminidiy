# Gearing Comparison Feature Design

**Date:** 2026-03-09
**Status:** Approved

## Overview

Upgrade the `/technical/gearing` calculator to support comparing up to 5 gear configurations simultaneously on the same chart. Add save/load functionality for authenticated users, a private dashboard page, and a public profile page.

## Core Concept

- **Shared settings:** Tire size, max RPM, speedo drive ratio, and imperial/metric toggle apply to all configurations
- **Variable per config:** Gearset, final drive, drop gear (the three things people actually swap when comparing)
- **Up to 5 configs** compared simultaneously on chart and comparison table

## Data Model

New table `saved_gear_configs`:

```sql
create table saved_gear_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_public boolean default false,
  tire text not null,
  gearset text not null,
  final_drive text not null,
  drop_gear text not null,
  max_rpm integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

- Keys stored as option identifiers from `gearing.ts` data model (not full objects)
- RLS: users CRUD own rows, anyone can SELECT where `is_public = true`

## UI Layout

### Shared Settings (top)

Card with tire size, max RPM, speedo drive ratio, imperial/metric toggle. Visually separated as "shared" settings that apply to all configs.

### Configuration Cards (middle)

Stacked compact cards, one per config:

- Color indicator (left border) matching chart series color
- Editable name field (auto-populated as "Gearset · Final Drive · Drop Gear")
- Three dropdowns in a row: gearset, final drive, drop gear
- Delete button (X) — first config can't be deleted
- Save button (bookmark icon) for authenticated users
- "Add Configuration" button below (disabled at 5)
- "Load Saved" button for authenticated users

### Chart (bottom, part 1)

- **Default:** 4th gear only — one solid line per config, color-coded
- **Toggle:** "Show all gears" adds 1st-3rd as dashed lines, lighter opacity
- 5-color fixed palette: blue, orange, green, red, purple
- Dark mode gets lighter variants
- Legend click toggles series on/off
- Tooltip: config name + gear + speed at hovered RPM
- X-axis zoom retained

### Comparison Table (bottom, part 2)

Purpose-built grid — configs as columns, metrics as rows:

| Metric             | Config 1 | Config 2 | Config 3 |
| ------------------ | -------- | -------- | -------- |
| 4th Gear Max Speed | 98 mph   | 112 mph  | 85 mph   |
| 3rd Gear Max Speed | 72 mph   | 81 mph   | 63 mph   |
| 2nd Gear Max Speed | 48 mph   | 53 mph   | 41 mph   |
| 1st Gear Max Speed | 28 mph   | 31 mph   | 24 mph   |
| 4th Gear Ratio     | 3.44:1   | 3.1:1    | 3.76:1   |
| Total Ratio (4th)  | 3.44     | 3.1      | 3.76     |
| Speedo Match       | Perfect  | Close    | Poor     |

- Column headers show config name with color indicator
- Best value per row highlighted
- Speedo match uses existing compatibility logic with color badges
- Mobile: horizontal scroll with frozen metric column
- Tire info cards remain below (shared across configs)

## Save/Load System

### Saving (gearing page)

- Bookmark icon on each config card (outline = unsaved, filled = saved)
- Saves to `saved_gear_configs` with current name + shared tire/RPM
- Changes to already-saved config auto-update the record
- No save button for unauthenticated users (comparison works without auth)

### Loading (gearing page)

- "Load Saved" button opens modal with saved configs list
- Shows name, gearset summary, date
- Select to add to next empty slot (disabled if 5 configs already loaded)
- Can delete from modal

### Dashboard (`/dashboard`)

- Private, requires auth
- "Saved Gear Configurations" section: list with name, gearset, final drive, drop gear, public/private toggle, edit name, delete
- Future-proofed for other dashboard sections

### Public Profile (`/users/[id]`)

- Shows display name, avatar, bio, member since
- "Gear Configurations" section showing only `is_public = true` configs
- View-only (no loading into own calculator in v1)

## API Endpoints

| Method | Route                               | Purpose                                  |
| ------ | ----------------------------------- | ---------------------------------------- |
| GET    | `/api/gear-configs`                 | List authenticated user's saved configs  |
| POST   | `/api/gear-configs`                 | Save a new config                        |
| PUT    | `/api/gear-configs/[id]`            | Update name, settings, or public toggle  |
| DELETE | `/api/gear-configs/[id]`            | Delete a saved config                    |
| GET    | `/api/gear-configs/public/[userId]` | List user's public configs (for profile) |

## Composable: `useGearConfigs.ts`

- `fetchConfigs()` — load user's saved configs
- `saveConfig(config)` — create new
- `updateConfig(id, changes)` — update existing
- `deleteConfig(id)` — remove
- `fetchPublicConfigs(userId)` — load another user's public configs

## Component Architecture

Break `Gearbox.vue` (1,128 lines) into:

| Component                    | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `Gearbox.vue`                | Orchestrator — manages state, passes props      |
| `GearboxSharedSettings.vue`  | Tire, RPM, speedo drive, unit toggle            |
| `GearboxConfigCard.vue`      | Single config: 3 dropdowns + name + save/delete |
| `GearboxComparisonChart.vue` | Highcharts multi-config chart with gear toggle  |
| `GearboxComparisonTable.vue` | Side-by-side metrics comparison grid            |
| `GearboxSaveLoadModal.vue`   | Modal for loading/managing saved configs        |

All calculation logic stays client-side (pure math). Server only handles CRUD for saved configs.
