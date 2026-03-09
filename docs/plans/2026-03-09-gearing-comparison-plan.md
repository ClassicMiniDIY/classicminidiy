# Gearing Comparison Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the gearing calculator to compare up to 5 gear configurations simultaneously with save/load for authenticated users, a private dashboard, and a public profile page.

**Architecture:** Break the monolithic `Gearbox.vue` (1,128 lines) into focused child components. Add a `saved_gear_configs` Supabase table with RLS policies. Create a `useGearConfigs` composable for CRUD operations. Add 5 server API endpoints for config persistence. Build new `/dashboard` and `/users/[id]` pages.

**Tech Stack:** Nuxt 4 / Vue 3 / TypeScript / Nuxt UI / Highcharts / Supabase / Font Awesome 6

**Design Doc:** `docs/plans/2026-03-09-gearing-comparison-design.md`

---

### Task 1: Database Migration — `saved_gear_configs` table

**Files:**

- Create: migration SQL file (apply via Supabase dashboard or migration tooling — this is the shared database at `psoqirvbujwohemmwplv`)

**Step 1: Write the migration SQL**

```sql
-- Create saved_gear_configs table
create table if not exists public.saved_gear_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_public boolean not null default false,
  tire text not null,
  gearset text not null,
  final_drive text not null,
  drop_gear text not null,
  speedo_drive text not null,
  max_rpm integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_saved_gear_configs_user_id on public.saved_gear_configs(user_id);
create index idx_saved_gear_configs_public on public.saved_gear_configs(is_public) where is_public = true;

-- RLS
alter table public.saved_gear_configs enable row level security;

-- Users can read their own configs
create policy "Users can view own configs"
  on public.saved_gear_configs for select
  using ((select auth.uid()) = user_id);

-- Anyone can read public configs
create policy "Anyone can view public configs"
  on public.saved_gear_configs for select
  using (is_public = true);

-- Users can insert their own configs (max 25 per user enforced at API level)
create policy "Users can create own configs"
  on public.saved_gear_configs for insert
  with check ((select auth.uid()) = user_id);

-- Users can update their own configs
create policy "Users can update own configs"
  on public.saved_gear_configs for update
  using ((select auth.uid()) = user_id);

-- Users can delete their own configs
create policy "Users can delete own configs"
  on public.saved_gear_configs for delete
  using ((select auth.uid()) = user_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Only create trigger if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_saved_gear_configs'
  ) then
    create trigger set_updated_at_saved_gear_configs
      before update on public.saved_gear_configs
      for each row execute function public.handle_updated_at();
  end if;
end;
$$;
```

**Step 2: Apply migration**

Apply via Supabase dashboard SQL editor against the shared database. Verify the table exists:

```sql
select * from public.saved_gear_configs limit 1;
```

Expected: Empty result set, no error.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-09-gearing-comparison-plan.md docs/plans/2026-03-09-gearing-comparison-design.md
git commit -m "docs: add gearing comparison design and implementation plan"
```

---

### Task 2: Server Auth Utility — `requireUserAuth`

**Files:**

- Create: `server/utils/userAuth.ts`
- Reference: `server/utils/adminAuth.ts` (follow same pattern minus admin check)

**Step 1: Write the `requireUserAuth` utility**

This is a simplified version of `requireAdminAuth` that validates JWT but doesn't check `is_admin`. It extracts the access token from Authorization header or Supabase auth cookies, validates it, and returns the user.

```typescript
// server/utils/userAuth.ts
import { getServiceClient } from './supabase';

export async function requireUserAuth(event: any) {
  const authHeader = getHeader(event, 'authorization');
  let accessToken: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7);
  }

  if (!accessToken) {
    const cookieHeader = getHeader(event, 'cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader
        .split(';')
        .filter((c: string) => c.trim())
        .map((c: string) => {
          const [key, ...val] = c.trim().split('=');
          return [key, val.join('=')];
        })
    );

    const authCookieKey = Object.keys(cookies).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (authCookieKey) {
      try {
        const decoded = JSON.parse(decodeURIComponent(cookies[authCookieKey]));
        accessToken = decoded?.access_token || decoded?.[0];
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    });
  }

  const supabase = getServiceClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired session',
    });
  }

  return { user };
}
```

**Step 2: Commit**

```bash
git add server/utils/userAuth.ts
git commit -m "feat: add requireUserAuth server utility for authenticated API endpoints"
```

---

### Task 3: Gear Config API Endpoints

**Files:**

- Create: `server/api/gear-configs/index.get.ts`
- Create: `server/api/gear-configs/index.post.ts`
- Create: `server/api/gear-configs/[id].put.ts`
- Create: `server/api/gear-configs/[id].delete.ts`
- Create: `server/api/gear-configs/public/[userId].get.ts`

**Step 1: GET `/api/gear-configs` — list user's own configs**

```typescript
// server/api/gear-configs/index.get.ts
import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch configs' });
  }

  return data;
});
```

**Step 2: POST `/api/gear-configs` — create new config**

```typescript
// server/api/gear-configs/index.post.ts
import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const body = await readBody(event);

  // Validate required fields
  const { name, tire, gearset, final_drive, drop_gear, speedo_drive, max_rpm, is_public } = body;
  if (!name || !tire || !gearset || !final_drive || !drop_gear || !speedo_drive || !max_rpm) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  // Validate name length
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Name must be 1-100 characters' });
  }

  const supabase = getServiceClient();

  // Enforce max 25 configs per user
  const { count, error: countError } = await supabase
    .from('saved_gear_configs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check config count' });
  }

  if ((count ?? 0) >= 25) {
    throw createError({ statusCode: 400, statusMessage: 'Maximum of 25 saved configurations reached' });
  }

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .insert({
      user_id: user.id,
      name: name.trim(),
      tire,
      gearset,
      final_drive: String(final_drive),
      drop_gear: String(drop_gear),
      speedo_drive: String(speedo_drive),
      max_rpm: Number(max_rpm),
      is_public: is_public === true,
    })
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create config' });
  }

  return data;
});
```

**Step 3: PUT `/api/gear-configs/[id]` — update config**

```typescript
// server/api/gear-configs/[id].put.ts
import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Config ID required' });
  }

  // Validate name if provided
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Name must be 1-100 characters' });
    }
  }

  const supabase = getServiceClient();

  // Build update object with only provided fields
  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.tire !== undefined) updates.tire = body.tire;
  if (body.gearset !== undefined) updates.gearset = body.gearset;
  if (body.final_drive !== undefined) updates.final_drive = String(body.final_drive);
  if (body.drop_gear !== undefined) updates.drop_gear = String(body.drop_gear);
  if (body.speedo_drive !== undefined) updates.speedo_drive = String(body.speedo_drive);
  if (body.max_rpm !== undefined) updates.max_rpm = Number(body.max_rpm);
  if (body.is_public !== undefined) updates.is_public = body.is_public === true;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update config' });
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Config not found' });
  }

  return data;
});
```

**Step 4: DELETE `/api/gear-configs/[id]` — delete config**

```typescript
// server/api/gear-configs/[id].delete.ts
import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Config ID required' });
  }

  const supabase = getServiceClient();

  const { error } = await supabase.from('saved_gear_configs').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete config' });
  }

  return { success: true };
});
```

**Step 5: GET `/api/gear-configs/public/[userId]` — list public configs for a user**

```typescript
// server/api/gear-configs/public/[userId].get.ts
import { getServiceClient } from '../../../utils/supabase';

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'userId');

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'User ID required' });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .select('id, name, tire, gearset, final_drive, drop_gear, speedo_drive, max_rpm, created_at')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch public configs' });
  }

  return data;
});
```

**Step 6: Commit**

```bash
git add server/api/gear-configs/
git commit -m "feat: add CRUD API endpoints for saved gear configurations"
```

---

### Task 4: `useGearConfigs` Composable

**Files:**

- Create: `app/composables/useGearConfigs.ts`

**Step 1: Write the composable**

```typescript
// app/composables/useGearConfigs.ts

export interface SavedGearConfig {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  tire: string;
  gearset: string;
  final_drive: string;
  drop_gear: string;
  speedo_drive: string;
  max_rpm: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGearConfigInput {
  name: string;
  tire: string;
  gearset: string;
  final_drive: string;
  drop_gear: string;
  speedo_drive: string;
  max_rpm: number;
  is_public?: boolean;
}

export const useGearConfigs = () => {
  const supabase = useSupabase();
  const { user } = useAuth();

  const configs = useState<SavedGearConfig[]>('gear-configs', () => []);
  const loading = useState<boolean>('gear-configs-loading', () => false);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const fetchConfigs = async () => {
    if (!user.value) return;
    loading.value = true;
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedGearConfig[]>('/api/gear-configs', { headers });
      configs.value = data;
    } catch (error) {
      console.error('Failed to fetch gear configs:', error);
    } finally {
      loading.value = false;
    }
  };

  const saveConfig = async (input: CreateGearConfigInput): Promise<SavedGearConfig | null> => {
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedGearConfig>('/api/gear-configs', {
        method: 'POST',
        headers,
        body: input,
      });
      configs.value.unshift(data);
      return data;
    } catch (error) {
      console.error('Failed to save gear config:', error);
      return null;
    }
  };

  const updateConfig = async (
    id: string,
    updates: Partial<CreateGearConfigInput & { is_public: boolean }>
  ): Promise<SavedGearConfig | null> => {
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedGearConfig>(`/api/gear-configs/${id}`, {
        method: 'PUT',
        headers,
        body: updates,
      });
      const index = configs.value.findIndex((c) => c.id === id);
      if (index !== -1) configs.value[index] = data;
      return data;
    } catch (error) {
      console.error('Failed to update gear config:', error);
      return null;
    }
  };

  const deleteConfig = async (id: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      await $fetch(`/api/gear-configs/${id}`, {
        method: 'DELETE',
        headers,
      });
      configs.value = configs.value.filter((c) => c.id !== id);
      return true;
    } catch (error) {
      console.error('Failed to delete gear config:', error);
      return false;
    }
  };

  const fetchPublicConfigs = async (userId: string): Promise<SavedGearConfig[]> => {
    try {
      return await $fetch<SavedGearConfig[]>(`/api/gear-configs/public/${userId}`);
    } catch (error) {
      console.error('Failed to fetch public gear configs:', error);
      return [];
    }
  };

  return {
    configs,
    loading,
    fetchConfigs,
    saveConfig,
    updateConfig,
    deleteConfig,
    fetchPublicConfigs,
  };
};
```

**Step 2: Commit**

```bash
git add app/composables/useGearConfigs.ts
git commit -m "feat: add useGearConfigs composable for saved gear config CRUD"
```

---

### Task 5: Extract Gearing Calculation Logic

**Files:**

- Create: `app/utils/gearingCalculations.ts`
- Reference: `app/components/Calculators/Gearbox.vue` (lines 159-273 — the calculation logic)

**Step 1: Extract pure calculation functions**

Extract the tire, speedo, gearing, and chart data calculations from `Gearbox.vue` into pure functions. These are currently inline computed properties; we need them as standalone functions so multiple configs can use them.

```typescript
// app/utils/gearingCalculations.ts
import { kphFactor, type TireValue, type ISpeedometer } from '../../data/models/gearing';

const YARDS_IN_MILE = 1760;
const MM_IN_YARD = 914.4;

export interface TireCalculationResult {
  width: number;
  profile: number;
  size: number;
  diameter: number;
  circ: number;
  tireTurnsPerMile: number;
  typeCircInMiles: number;
}

export interface GearingTableRow {
  gear: number;
  ratio: number;
  maxSpeed: string;
  maxSpeedRaw: number;
}

export interface ChartSeriesData {
  name: string;
  data: number[];
  dashStyle?: string;
  color?: string;
  visible?: boolean;
}

export function calculateTire(tireType: TireValue): TireCalculationResult {
  let diameter: number;
  if (tireType.diameter) {
    diameter = tireType.diameter;
  } else {
    diameter = Math.round(tireType.width * (tireType.profile / 100) * 2 + tireType.size * 25.4);
  }

  const circ = Math.round(3.14159 * diameter);
  const typeCircInMiles = circ / (YARDS_IN_MILE * MM_IN_YARD);
  const tireTurnsPerMile = Math.round(YARDS_IN_MILE / (circ / MM_IN_YARD));

  return {
    width: tireType.width,
    profile: tireType.profile,
    size: tireType.size,
    diameter,
    circ,
    tireTurnsPerMile,
    typeCircInMiles,
  };
}

export function calculateGearingTable(
  gearRatios: number[],
  finalDrive: number,
  dropGear: number,
  maxRpm: number,
  typeCircInMiles: number,
  metric: boolean
): GearingTableRow[] {
  return gearRatios.map((gear, index) => {
    const maxSpeedMph = Math.round((maxRpm / dropGear / gear / finalDrive) * typeCircInMiles * 60);
    const maxSpeedRaw = metric ? Math.round(maxSpeedMph * kphFactor) : maxSpeedMph;
    const maxSpeed = metric ? `${maxSpeedRaw}km/h` : `${maxSpeedMph}mph`;

    return {
      gear: index + 1,
      ratio: gear,
      maxSpeed,
      maxSpeedRaw,
    };
  });
}

export function calculateSpeedoData(
  tireTurnsPerMile: number,
  finalDrive: number,
  speedoDrive: number,
  dropGear: number
) {
  return {
    turnsPerMile: Math.round(tireTurnsPerMile * finalDrive * speedoDrive),
    engineRevsMile: Math.round(tireTurnsPerMile * finalDrive * dropGear),
  };
}

export function calculateSpeedometerTable(
  speedometers: ISpeedometer[],
  turnsPerMile: number,
  dropGear: number,
  metric: boolean
) {
  const factor = metric ? kphFactor : 1;

  return speedometers.map((speedometer) => {
    const turnsPer = turnsPerMile / factor;
    const variation = Math.round((turnsPer / speedometer.turns) * 100 * dropGear);
    let result = '';
    let status = '';

    if (variation > 100) {
      status = 'text-red';
      result = `Over ${variation - 100}%`;
    } else if (variation === 100) {
      status = 'text-green';
      result = 'Reads correctly!';
    } else {
      status = 'text-primary';
      result = `Under ${100 - variation}%`;
    }

    return {
      status,
      speedometer: speedometer.name,
      turns: speedometer.turns,
      speed: speedometer.speed,
      result,
    };
  });
}

export function calculateChartData(
  gearRatios: number[],
  finalDrive: number,
  dropGear: number,
  maxRpm: number,
  typeCircInMiles: number,
  metric: boolean,
  configName?: string,
  color?: string
): ChartSeriesData[] {
  const gearNames = ['1st Gear', '2nd Gear', '3rd Gear', '4th Gear'];
  const data: ChartSeriesData[] = [];

  gearRatios.forEach((gear, index) => {
    const speedData: number[] = [];
    for (let rpm = 1000; rpm <= maxRpm; rpm += 500) {
      let speed = Math.round((rpm / dropGear / gear / finalDrive) * typeCircInMiles * 60);
      if (metric) {
        speed = Math.round(speed * kphFactor);
      }
      speedData.push(speed);
    }

    const seriesName = configName ? `${configName} - ${gearNames[index]}` : gearNames[index] || '';

    data.push({
      name: seriesName,
      data: speedData,
      color,
    });
  });

  return data;
}
```

**Step 2: Commit**

```bash
git add app/utils/gearingCalculations.ts
git commit -m "feat: extract gearing calculation logic into reusable utility functions"
```

---

### Task 6: GearboxSharedSettings Component

**Files:**

- Create: `app/components/Calculators/GearboxSharedSettings.vue`

**Step 1: Create the shared settings component**

This extracts the tire, speedo drive, max RPM, and imperial/metric toggle from the current `Gearbox.vue` form. It emits changes upward.

```vue
<script setup lang="ts">
  import { options, type TireValue } from '../../../data/models/gearing';

  const { t } = useI18n();

  const props = defineProps<{
    metric: boolean;
    tireType: TireValue;
    speedoDrive: number;
    maxRpm: number;
  }>();

  const emit = defineEmits<{
    'update:metric': [value: boolean];
    'update:tireType': [value: TireValue];
    'update:speedoDrive': [value: number];
    'update:maxRpm': [value: number];
  }>();

  const tireOptions = computed(() =>
    options.tires.map((item) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const speedoRatioOptions = computed(() =>
    options.speedosRatios.map((item) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const rpmOptions = [
    { label: t('rpm_options.5000'), value: 5000 },
    { label: t('rpm_options.5500'), value: 5500 },
    { label: t('rpm_options.6000'), value: 6000 },
    { label: t('rpm_options.6500'), value: 6500 },
    { label: t('rpm_options.7000'), value: 7000 },
    { label: t('rpm_options.7500'), value: 7500 },
    { label: t('rpm_options.8000'), value: 8000 },
    { label: t('rpm_options.8500'), value: 8500 },
    { label: t('rpm_options.9000'), value: 9000 },
  ];
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between bg-muted -m-4 p-4">
        <h3 class="text-lg font-semibold"><i class="fad fa-sliders mr-2"></i>{{ t('title') }}</h3>
        <div class="flex items-center gap-3">
          <label class="text-sm font-medium">{{ t('imperial_or_metric') }}</label>
          <USwitch :model-value="metric" color="primary" @update:model-value="emit('update:metric', $event)" />
        </div>
      </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      <div>
        <label class="block text-sm font-medium mb-2"> {{ t('tire_size') }} <i class="fad fa-tire"></i> </label>
        <USelect
          :model-value="tireType"
          :items="tireOptions"
          value-key="value"
          class="w-full"
          @update:model-value="emit('update:tireType', $event)"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2">
          {{ t('speedo_drive_ratio') }} <i class="fad fa-percent"></i>
        </label>
        <USelect
          :model-value="speedoDrive"
          :items="speedoRatioOptions"
          value-key="value"
          class="w-full"
          @update:model-value="emit('update:speedoDrive', $event)"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2"> {{ t('max_rpm') }} <i class="fad fa-tachometer-alt"></i> </label>
        <USelect
          :model-value="maxRpm"
          :items="rpmOptions"
          value-key="value"
          class="w-full"
          @update:model-value="emit('update:maxRpm', $event)"
        />
      </div>
    </div>
  </UCard>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Shared Settings",
    "imperial_or_metric": "Imperial or Metric",
    "tire_size": "Tire Size",
    "speedo_drive_ratio": "Speedo Drive Ratio",
    "max_rpm": "Max RPM",
    "rpm_options": {
      "5000": "5000 RPM",
      "5500": "5500 RPM",
      "6000": "6000 RPM",
      "6500": "6500 RPM",
      "7000": "7000 RPM",
      "7500": "7500 RPM",
      "8000": "8000 RPM",
      "8500": "8500 RPM",
      "9000": "9000 RPM"
    }
  }
}
</i18n>
```

**Step 2: Commit**

```bash
git add app/components/Calculators/GearboxSharedSettings.vue
git commit -m "feat: add GearboxSharedSettings component for shared tire/RPM/speedo settings"
```

---

### Task 7: GearboxConfigCard Component

**Files:**

- Create: `app/components/Calculators/GearboxConfigCard.vue`

**Step 1: Create the config card component**

Each card shows a color indicator, editable name, 3 dropdowns (gearset, final drive, drop gear), and save/delete buttons.

```vue
<script setup lang="ts">
  import { options } from '../../../data/models/gearing';

  const { t } = useI18n();

  export interface GearConfig {
    id?: string; // undefined if not saved to DB
    name: string;
    gearset: number[];
    finalDrive: number;
    dropGear: number;
    savedId?: string; // DB id if saved
  }

  const props = defineProps<{
    config: GearConfig;
    colorIndex: number;
    canDelete: boolean;
    isAuthenticated: boolean;
    isSaving: boolean;
  }>();

  const emit = defineEmits<{
    'update:config': [value: GearConfig];
    delete: [];
    save: [];
  }>();

  const CONFIG_COLORS = ['#2563eb', '#ea580c', '#16a34a', '#dc2626', '#9333ea'];

  const color = computed(() => CONFIG_COLORS[props.colorIndex] || CONFIG_COLORS[0]);

  const isEditing = ref(false);
  const editName = ref(props.config.name);

  const gearRatioOptions = computed(() =>
    options.gearRatios.map((item) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const diffOptions = computed(() =>
    options.diffs.map((item) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const dropGearOptions = computed(() =>
    options.dropGears.map((item) => ({
      label: item.label,
      value: item.value,
    }))
  );

  // Generate auto-name from current selections
  function getAutoName(): string {
    const gearLabel =
      options.gearRatios.find((g) => JSON.stringify(g.value) === JSON.stringify(props.config.gearset))?.label ||
      'Custom';
    const shortGear = gearLabel.length > 30 ? gearLabel.substring(0, 30) + '...' : gearLabel;
    return `${shortGear} · ${props.config.finalDrive}:1 · ${props.config.dropGear}:1`;
  }

  function startEditing() {
    editName.value = props.config.name;
    isEditing.value = true;
  }

  function finishEditing() {
    isEditing.value = false;
    if (editName.value.trim()) {
      emit('update:config', { ...props.config, name: editName.value.trim() });
    }
  }

  function updateGearset(value: number[]) {
    const updated = { ...props.config, gearset: value };
    if (!props.config.savedId) updated.name = getAutoName();
    emit('update:config', updated);
  }

  function updateFinalDrive(value: number) {
    const updated = { ...props.config, finalDrive: value };
    if (!props.config.savedId) updated.name = getAutoName();
    emit('update:config', updated);
  }

  function updateDropGear(value: number) {
    const updated = { ...props.config, dropGear: value };
    if (!props.config.savedId) updated.name = getAutoName();
    emit('update:config', updated);
  }
</script>

<template>
  <div
    class="rounded-lg border p-4 flex flex-col md:flex-row md:items-center gap-4"
    :style="{ borderLeftWidth: '4px', borderLeftColor: color }"
  >
    <!-- Name -->
    <div class="flex items-center gap-2 min-w-0 md:w-48">
      <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: color }"></span>
      <template v-if="isEditing">
        <UInput
          v-model="editName"
          size="sm"
          class="flex-1"
          maxlength="100"
          @keyup.enter="finishEditing"
          @blur="finishEditing"
          autofocus
        />
      </template>
      <template v-else>
        <span
          class="text-sm font-medium truncate cursor-pointer hover:underline"
          :title="config.name"
          @click="startEditing"
        >
          {{ config.name }}
        </span>
      </template>
    </div>

    <!-- Dropdowns -->
    <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
      <USelect
        :model-value="config.gearset"
        :items="gearRatioOptions"
        value-key="value"
        size="sm"
        class="w-full"
        @update:model-value="updateGearset"
      />
      <USelect
        :model-value="config.finalDrive"
        :items="diffOptions"
        value-key="value"
        size="sm"
        class="w-full"
        @update:model-value="updateFinalDrive"
      />
      <USelect
        :model-value="config.dropGear"
        :items="dropGearOptions"
        value-key="value"
        size="sm"
        class="w-full"
        @update:model-value="updateDropGear"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 shrink-0">
      <UButton
        v-if="isAuthenticated"
        :icon="config.savedId ? 'i-fa6-solid-bookmark' : 'i-fa6-regular-bookmark'"
        variant="ghost"
        size="sm"
        :loading="isSaving"
        :title="config.savedId ? t('saved') : t('save')"
        @click="emit('save')"
      />
      <UButton
        v-if="canDelete"
        icon="i-fa6-solid-xmark"
        variant="ghost"
        color="error"
        size="sm"
        :title="t('remove')"
        @click="emit('delete')"
      />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "save": "Save configuration",
    "saved": "Configuration saved",
    "remove": "Remove configuration"
  }
}
</i18n>
```

**Step 2: Commit**

```bash
git add app/components/Calculators/GearboxConfigCard.vue
git commit -m "feat: add GearboxConfigCard component for individual gear config editing"
```

---

### Task 8: GearboxComparisonChart Component

**Files:**

- Create: `app/components/Calculators/GearboxComparisonChart.vue`

**Step 1: Create the comparison chart component**

This wraps Highcharts and accepts multi-config chart data. Supports toggling between 4th-gear-only and all-gears view.

```vue
<script setup lang="ts">
  import { chartOptions } from '../../../data/models/gearing';
  import type { ChartSeriesData } from '../../utils/gearingCalculations';

  const { t } = useI18n();

  const props = defineProps<{
    allGearsSeries: ChartSeriesData[];
    fourthGearSeries: ChartSeriesData[];
    metric: boolean;
    maxRpm: number;
  }>();

  const showAllGears = ref(false);

  const colorMode = useColorMode();
  const isDark = computed(() => colorMode.value === 'dark');

  const darkModeChartOptions = {
    chart: { backgroundColor: '#171717' },
    title: { style: { color: '#e5e5e5' } },
    subtitle: { style: { color: '#a3a3a3' } },
    xAxis: {
      labels: { style: { color: '#a3a3a3' } },
      title: { style: { color: '#e5e5e5' } },
      gridLineColor: '#404040',
      lineColor: '#404040',
      tickColor: '#404040',
    },
    yAxis: {
      labels: { style: { color: '#a3a3a3' } },
      title: { style: { color: '#e5e5e5' } },
      gridLineColor: '#404040',
      lineColor: '#404040',
      tickColor: '#404040',
    },
    legend: {
      itemStyle: { color: '#e5e5e5' },
      itemHoverStyle: { color: '#ffffff' },
    },
    tooltip: {
      backgroundColor: '#262626',
      style: { color: '#e5e5e5' },
    },
  };

  const lightModeChartOptions = {
    chart: { backgroundColor: '#ffffff' },
    title: { style: { color: '#171717' } },
    subtitle: { style: { color: '#525252' } },
    xAxis: {
      labels: { style: { color: '#525252' } },
      title: { style: { color: '#171717' } },
      gridLineColor: '#e5e5e5',
      lineColor: '#d4d4d4',
      tickColor: '#d4d4d4',
    },
    yAxis: {
      labels: { style: { color: '#525252' } },
      title: { style: { color: '#171717' } },
      gridLineColor: '#e5e5e5',
      lineColor: '#d4d4d4',
      tickColor: '#d4d4d4',
    },
    legend: {
      itemStyle: { color: '#171717' },
      itemHoverStyle: { color: '#000000' },
    },
    tooltip: {
      backgroundColor: '#ffffff',
      style: { color: '#171717' },
    },
  };

  const activeSeries = computed(() => (showAllGears.value ? props.allGearsSeries : props.fourthGearSeries));

  const mapOptions = computed(() => {
    const modeOptions = isDark.value ? darkModeChartOptions : lightModeChartOptions;
    return {
      ...chartOptions,
      chart: { ...chartOptions.chart, ...modeOptions.chart },
      title: { ...chartOptions.title, ...modeOptions.title, text: t('chart_title') },
      subtitle: { ...chartOptions.subtitle, ...modeOptions.subtitle },
      xAxis: { ...chartOptions.xAxis, ...modeOptions.xAxis },
      yAxis: {
        ...chartOptions.yAxis,
        ...modeOptions.yAxis,
        title: {
          ...chartOptions.yAxis.title,
          ...modeOptions.yAxis.title,
          text: props.metric ? 'Speed (km/h)' : 'Speed (mph)',
        },
      },
      legend: { ...chartOptions.legend, ...modeOptions.legend },
      tooltip: { ...chartOptions.tooltip, ...modeOptions.tooltip },
      series: activeSeries.value,
    };
  });
</script>

<template>
  <UCard>
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold"><i class="fad fa-chart-line mr-2"></i>{{ t('chart_title') }}</h3>
      <div class="flex items-center gap-2">
        <label class="text-sm">{{ t('show_all_gears') }}</label>
        <USwitch v-model="showAllGears" size="sm" />
      </div>
    </div>
    <ClientOnly fallback-tag="span">
      <highcharts :options="mapOptions" :updateArgs="[true, true, true]" constructorType="chart" />
      <template #fallback>
        <USkeleton class="h-96 w-full" />
        <p class="py-10 text-center text-2xl">{{ t('loading') }}</p>
      </template>
    </ClientOnly>
  </UCard>
</template>

<i18n lang="json">
{
  "en": {
    "chart_title": "Speed vs RPM Comparison",
    "show_all_gears": "Show all gears",
    "loading": "Chart is loading"
  }
}
</i18n>
```

**Step 2: Commit**

```bash
git add app/components/Calculators/GearboxComparisonChart.vue
git commit -m "feat: add GearboxComparisonChart component with all-gears toggle"
```

---

### Task 9: GearboxComparisonTable Component

**Files:**

- Create: `app/components/Calculators/GearboxComparisonTable.vue`

**Step 1: Create the comparison table component**

Side-by-side grid with configs as columns and metrics as rows. Highlights best values.

```vue
<script setup lang="ts">
  import type { GearingTableRow } from '../../utils/gearingCalculations';

  const { t } = useI18n();

  const CONFIG_COLORS = ['#2563eb', '#ea580c', '#16a34a', '#dc2626', '#9333ea'];

  interface ConfigResult {
    name: string;
    colorIndex: number;
    gearingTable: GearingTableRow[];
    speedoMatch: string;
    speedoStatus: string;
    totalRatio4th: string;
  }

  const props = defineProps<{
    configs: ConfigResult[];
    metric: boolean;
  }>();

  const metrics = computed(() => [
    { key: '4th_speed', label: t('4th_gear_max_speed') },
    { key: '3rd_speed', label: t('3rd_gear_max_speed') },
    { key: '2nd_speed', label: t('2nd_gear_max_speed') },
    { key: '1st_speed', label: t('1st_gear_max_speed') },
    { key: '4th_ratio', label: t('4th_gear_ratio') },
    { key: 'total_ratio', label: t('total_ratio_4th') },
    { key: 'speedo', label: t('best_speedo_match') },
  ]);

  function getValue(config: ConfigResult, key: string): string {
    switch (key) {
      case '4th_speed':
        return config.gearingTable[3]?.maxSpeed || '---';
      case '3rd_speed':
        return config.gearingTable[2]?.maxSpeed || '---';
      case '2nd_speed':
        return config.gearingTable[1]?.maxSpeed || '---';
      case '1st_speed':
        return config.gearingTable[0]?.maxSpeed || '---';
      case '4th_ratio':
        return `${config.gearingTable[3]?.ratio || '---'}:1`;
      case 'total_ratio':
        return config.totalRatio4th;
      case 'speedo':
        return config.speedoMatch;
      default:
        return '---';
    }
  }

  function getRawValue(config: ConfigResult, key: string): number {
    switch (key) {
      case '4th_speed':
        return config.gearingTable[3]?.maxSpeedRaw || 0;
      case '3rd_speed':
        return config.gearingTable[2]?.maxSpeedRaw || 0;
      case '2nd_speed':
        return config.gearingTable[1]?.maxSpeedRaw || 0;
      case '1st_speed':
        return config.gearingTable[0]?.maxSpeedRaw || 0;
      default:
        return 0;
    }
  }

  function isBest(config: ConfigResult, key: string): boolean {
    if (!['4th_speed', '3rd_speed', '2nd_speed', '1st_speed'].includes(key)) return false;
    if (props.configs.length < 2) return false;
    const val = getRawValue(config, key);
    return val === Math.max(...props.configs.map((c) => getRawValue(c, key)));
  }
</script>

<template>
  <UCard v-if="configs.length > 0">
    <template #header>
      <div class="flex items-center bg-muted -m-4 p-4">
        <i class="fad fa-table-columns mr-2"></i>
        <h3 class="text-lg font-semibold">{{ t('title') }}</h3>
      </div>
    </template>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left p-3 font-medium w-48">{{ t('metric') }}</th>
            <th v-for="(config, idx) in configs" :key="idx" class="text-center p-3 font-medium">
              <div class="flex items-center justify-center gap-2">
                <span
                  class="w-3 h-3 rounded-full shrink-0"
                  :style="{ backgroundColor: CONFIG_COLORS[config.colorIndex] }"
                ></span>
                <span class="truncate max-w-32" :title="config.name">{{ config.name }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="metric in metrics" :key="metric.key" class="border-b border-default last:border-0">
            <td class="p-3 font-medium">{{ metric.label }}</td>
            <td
              v-for="(config, idx) in configs"
              :key="idx"
              class="p-3 text-center"
              :class="{ 'font-bold text-green-600 dark:text-green-400': isBest(config, metric.key) }"
            >
              <span v-if="metric.key === 'speedo'" :class="config.speedoStatus">
                {{ getValue(config, metric.key) }}
              </span>
              <span v-else>{{ getValue(config, metric.key) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Configuration Comparison",
    "metric": "Metric",
    "4th_gear_max_speed": "4th Gear Max Speed",
    "3rd_gear_max_speed": "3rd Gear Max Speed",
    "2nd_gear_max_speed": "2nd Gear Max Speed",
    "1st_gear_max_speed": "1st Gear Max Speed",
    "4th_gear_ratio": "4th Gear Ratio",
    "total_ratio_4th": "Total Ratio (4th)",
    "best_speedo_match": "Best Speedo Match"
  }
}
</i18n>
```

**Step 2: Commit**

```bash
git add app/components/Calculators/GearboxComparisonTable.vue
git commit -m "feat: add GearboxComparisonTable component for side-by-side metrics"
```

---

### Task 10: GearboxSaveLoadModal Component

**Files:**

- Create: `app/components/Calculators/GearboxSaveLoadModal.vue`

**Step 1: Create the save/load modal**

Modal listing user's saved configs with load and delete actions.

```vue
<script setup lang="ts">
  import type { SavedGearConfig } from '../../composables/useGearConfigs';

  const { t } = useI18n();

  const props = defineProps<{
    open: boolean;
    configs: SavedGearConfig[];
    loading: boolean;
    slotsRemaining: number;
  }>();

  const emit = defineEmits<{
    'update:open': [value: boolean];
    load: [config: SavedGearConfig];
    delete: [id: string];
  }>();
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold"><i class="fad fa-folder-open mr-2"></i>{{ t('title') }}</h3>
    </template>

    <div class="p-4">
      <div v-if="loading" class="flex justify-center py-8">
        <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>

      <div v-else-if="configs.length === 0" class="text-center py-8 opacity-60">
        <i class="fas fa-inbox text-4xl mb-3 block"></i>
        <p>{{ t('no_configs') }}</p>
      </div>

      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div
          v-for="config in configs"
          :key="config.id"
          class="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ config.name }}</p>
            <p class="text-xs opacity-60 mt-1">
              {{ config.gearset }} · {{ config.final_drive }}:1 · {{ config.drop_gear }}:1
            </p>
          </div>
          <div class="flex items-center gap-2 ml-4 shrink-0">
            <UButton size="sm" color="primary" :disabled="slotsRemaining <= 0" @click="emit('load', config)">
              {{ t('load') }}
            </UButton>
            <UButton
              size="sm"
              variant="ghost"
              color="error"
              icon="i-fa6-solid-trash"
              @click="emit('delete', config.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-sm opacity-60">
          {{ t('slots_remaining', { count: slotsRemaining }) }}
        </span>
        <UButton variant="ghost" @click="emit('update:open', false)">
          {{ t('close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Load Saved Configuration",
    "no_configs": "No saved configurations yet. Save a configuration from the calculator to see it here.",
    "load": "Load",
    "close": "Close",
    "slots_remaining": "{count} comparison slots remaining"
  }
}
</i18n>
```

**Step 2: Commit**

```bash
git add app/components/Calculators/GearboxSaveLoadModal.vue
git commit -m "feat: add GearboxSaveLoadModal component for loading saved configs"
```

---

### Task 11: Rewrite Gearbox.vue as Orchestrator

**Files:**

- Modify: `app/components/Calculators/Gearbox.vue` (full rewrite)

**Step 1: Rewrite the component**

This is the core task. The existing 1,128-line monolith becomes an orchestrator that:

- Manages an array of configs (1-5)
- Uses shared settings for tire/RPM/speedo
- Delegates rendering to child components
- Computes chart data and comparison table data for all configs
- Handles save/load interactions

Key state:

- `sharedSettings` — `{ metric, tireType, speedoDrive, maxRpm }`
- `configs` — array of `GearConfig` objects (1-5)
- Computed: `tireCalcs`, per-config `gearingTable`, `chartData`, `comparisonData`

The component should:

1. Import and use all child components created in Tasks 6-10
2. Import calculation functions from `utils/gearingCalculations.ts`
3. Use `useGearConfigs` composable for save/load
4. Use `useAuth` to check authentication
5. Use `usePostHog` for analytics
6. Keep the tire info cards and speedo table from the original (shown once, since they're shared)
7. Replace the single-config form with `GearboxSharedSettings` + multiple `GearboxConfigCard` components
8. Replace the single-config chart with `GearboxComparisonChart`
9. Replace the gearing/speedo tables with `GearboxComparisonTable`
10. Keep all i18n translations (can trim since labels moved to children, but keep for any remaining strings)

**Key implementation details:**

The `CONFIG_COLORS` array: `['#2563eb', '#ea580c', '#16a34a', '#dc2626', '#9333ea']`

Chart data for 4th-gear-only view: For each config, generate only the 4th gear series with the config's color and name.

Chart data for all-gears view: For each config, generate all 4 gear series. 4th gear solid line, 1st-3rd dashed lines (`dashStyle: 'ShortDash'`).

Comparison table data: For each config, compute `gearingTable` using the shared tire/RPM and the config's gearset/finalDrive/dropGear. Find the best speedo match from the speedometer table.

**Step 2: Verify the calculator still works**

```bash
cd /Users/colegentry/Development/classicminidiy && bun run dev
```

Navigate to `/technical/gearing` and verify:

- Shared settings card renders with tire, speedo, RPM
- Default config card renders with gearset, final drive, drop gear
- Can add up to 5 configs
- Chart shows comparison lines
- Comparison table shows side-by-side data
- Save/load works for authenticated users

**Step 3: Commit**

```bash
git add app/components/Calculators/Gearbox.vue
git commit -m "feat: rewrite Gearbox.vue as orchestrator for multi-config comparison"
```

---

### Task 12: Dashboard Page

**Files:**

- Create: `app/pages/dashboard/index.vue`

**Step 1: Create the dashboard page**

Private page showing user's saved gear configs with management (rename, toggle public, delete). Requires authentication — show auth gate for unauthenticated users (follow pattern from `pages/profile/edit.vue`).

Layout:

- Hero section with navigation
- Breadcrumb
- Auth gate (if not authenticated)
- Saved Gear Configurations section:
  - List of configs with: name (editable), gearset/final drive/drop gear summary, public toggle, delete button
  - Empty state if no configs saved

Use `useGearConfigs` composable to fetch and manage configs.

Follow the Nuxt UI patterns from `profile/edit.vue` — `UCard`, `UButton`, `USwitch`, `UAlert`.

Include i18n translations for English (other languages can be added later).

**Step 2: Commit**

```bash
git add app/pages/dashboard/index.vue
git commit -m "feat: add dashboard page with saved gear configurations management"
```

---

### Task 13: Public Profile Page

**Files:**

- Create: `app/pages/users/[id].vue`

**Step 1: Create the public profile page**

Public page showing a user's display name, avatar, bio, member since date, and their public gear configurations.

Implementation:

- Fetch user profile from `profiles` table using the `id` route param (via Supabase client, read-only)
- Fetch public gear configs using `useGearConfigs().fetchPublicConfigs(userId)`
- Show 404 if user not found
- Display profile card with avatar, name, bio, join date
- Display public gear configs section (view-only, no edit/load)
- If no public configs, show "No public configurations shared" message
- SEO: `noindex` to prevent search engines from indexing individual profiles

Follow existing page patterns — Hero, breadcrumb, UCard layout.

**Step 2: Commit**

```bash
git add app/pages/users/\\[id\\].vue
git commit -m "feat: add public user profile page with shared gear configurations"
```

---

### Task 14: Navigation Updates

**Files:**

- Modify: Layout/navbar files — add links to dashboard and profile

**Step 1: Add dashboard link for authenticated users**

Find the navigation component that renders the user menu (likely in `layouts/default.vue` or a nav component) and add a "Dashboard" link that navigates to `/dashboard`. Only show for authenticated users.

**Step 2: Add profile link**

Add a "View Profile" link that navigates to `/users/{userId}` in the same user menu.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add dashboard and profile links to user navigation"
```

---

### Task 15: PostHog Analytics Events

**Files:**

- Modify: `app/components/Calculators/Gearbox.vue` (add analytics calls)

**Step 1: Add analytics events**

Add PostHog tracking for:

- `gearbox_config_added` — when a config is added to comparison
- `gearbox_config_removed` — when a config is removed
- `gearbox_config_saved` — when a config is saved to database
- `gearbox_config_loaded` — when a saved config is loaded
- `gearbox_comparison_used` — when calculator is used with 2+ configs (debounced)

Use `captureRaw` since these are new events not yet in the typed analytics system.

**Step 2: Commit**

```bash
git add app/components/Calculators/Gearbox.vue
git commit -m "feat: add PostHog analytics for gearing comparison feature"
```

---

### Task 16: Final Testing & Cleanup

**Step 1: Run the dev server and manually test**

```bash
cd /Users/colegentry/Development/classicminidiy && bun run dev
```

Test checklist:

- [ ] Single config works (backwards compatible with current behavior)
- [ ] Add 2-5 configs and verify chart updates
- [ ] Toggle "Show all gears" and verify chart changes
- [ ] Comparison table shows correct values with best highlighted
- [ ] Save a config (authenticated) and verify bookmark fills
- [ ] Load saved modal opens and loads config into slot
- [ ] Delete a saved config
- [ ] Toggle public/private on dashboard
- [ ] Visit `/users/{userId}` and see public configs
- [ ] Responsive: works on mobile viewport
- [ ] Dark mode: chart and UI render correctly
- [ ] Imperial/metric toggle updates all configs

**Step 2: Run existing tests**

```bash
cd /Users/colegentry/Development/classicminidiy && bun run test
```

Fix any broken tests. The existing gearing model tests should still pass since we haven't changed the data model.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve issues found during manual testing"
```
