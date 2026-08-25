<script setup lang="ts">
  import { options, kphFactor, type TireValue } from '../../../data/models/gearing';
  import {
    calculateTire,
    calculateGearingTable,
    calculateSpeedoData,
    calculateSpeedometerTable,
    type ChartSeriesData,
  } from '../../utils/gearingCalculations';
  import type { GearConfig } from '../../types/gearing';
  import type { MathStep, MathConstant } from '../../types/mathBreakdown';
  import type { SavedGearConfig } from '../../composables/useGearConfigs';

  const { t } = useI18n();
  const { capture } = usePostHog();
  const { track } = useAnalytics();
  const { user, isAuthenticated } = useAuth();
  const {
    configs: savedConfigs,
    loading: savedLoading,
    fetchConfigs,
    saveConfig,
    deleteConfig: deleteSavedConfig,
  } = useGearConfigs();

  const CONFIG_COLORS = ['#5b8a8a', '#c17f59', '#7a9a6d', '#8b6d8b', '#6b7fa0'];
  const MAX_CONFIGS = 5;

  // Shared settings
  const metric = ref(false);
  const tireType = ref<TireValue>({ width: 145, profile: 80, size: 10 });
  const speedoDrive = ref(0.3529);
  const maxRpm = ref(6500);

  // Gear configurations (1-5)
  const configs = ref<GearConfig[]>([
    {
      name: 'Minispares Evolution Helical Heavy... · 3.444:1 · 1:1',
      gearset: [2.583, 1.644, 1.25, 1.0],
      finalDrive: 3.444,
      dropGear: 1,
    },
  ]);

  // Save/load state
  const showLoadModal = ref(false);
  const savingIndex = ref<number | null>(null);

  // Debounced calculation trigger
  const debouncedUpdate = ref(0);
  let debounceTimer: NodeJS.Timeout | null = null;

  const triggerDebouncedUpdate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedUpdate.value++;
      capture('calculator_used', {
        calculator: 'gearbox',
        config_count: configs.value.length,
        gearbox_type: configs.value[0]?.gearset.length === 4 ? '4-speed' : '5-speed',
        final_drive: configs.value[0]?.finalDrive,
      });
    }, 150);
  };

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Tire calculations (shared across all configs)
  const tireCalcs = computed(() => {
    debouncedUpdate.value;
    return calculateTire(tireType.value);
  });

  // Per-config calculations
  const configResults = computed(() => {
    debouncedUpdate.value;
    const tire = tireCalcs.value;
    const speedometers = metric.value ? options.speedos.metric : options.speedos.imperial;

    return configs.value.map((config, index) => {
      const gearingTable = calculateGearingTable(
        config.gearset,
        config.finalDrive,
        config.dropGear,
        maxRpm.value,
        tire.typeCircInMiles,
        metric.value
      );

      const speedoData = calculateSpeedoData(
        tire.tireTurnsPerMile,
        config.finalDrive,
        speedoDrive.value,
        config.dropGear
      );

      const speedoTable = calculateSpeedometerTable(
        speedometers,
        speedoData.turnsPerMile,
        config.dropGear,
        metric.value
      );

      // Find best speedo match
      const getSpeedoVariation = (result: string): number => {
        if (result === 'Reads correctly!') return 0;
        const digits = parseInt(result.replace(/[^\d]/g, ''));
        return isNaN(digits) ? 100 : digits;
      };

      const bestMatch = speedoTable.find((s) => s.status === 'text-green');
      const closestMatch = speedoTable.reduce((best, current) => {
        return getSpeedoVariation(current.result) < getSpeedoVariation(best.result) ? current : best;
      });

      const speedoMatch = bestMatch ? bestMatch.speedometer : `${closestMatch.speedometer} (${closestMatch.result})`;
      const speedoStatus = bestMatch ? 'text-green' : closestMatch.status;
      // The row the "recommended speedo" callout is derived from — reused by the
      // math breakdown so the worked example matches the recommendation shown.
      const speedoBestRow = bestMatch || closestMatch;

      const topGearRow = gearingTable[gearingTable.length - 1];
      const totalRatioTop = `${(config.finalDrive * (topGearRow?.ratio || 1) * config.dropGear).toFixed(3)}:1`;

      return {
        name: config.name,
        colorIndex: index,
        gearingTable,
        speedoData,
        speedoTable,
        speedoMatch,
        speedoStatus,
        speedoBestRow,
        totalRatioTop,
      };
    });
  });

  // Chart data for all gears view
  const GEAR_MARKERS = ['circle', 'square', 'diamond', 'triangle', 'triangle-down'];
  const GEAR_NAMES = ['1st', '2nd', '3rd', '4th', '5th'];

  const maxGearCount = computed(() => Math.max(...configs.value.map((c) => c.gearset.length)));

  const allGearsSeries = computed((): ChartSeriesData[] => {
    const tire = tireCalcs.value;
    const series: ChartSeriesData[] = [];

    configs.value.forEach((config, configIndex) => {
      config.gearset.forEach((gear, gearIndex) => {
        const speedData: number[] = [];
        for (let rpm = 1000; rpm <= maxRpm.value; rpm += 500) {
          let speed = Math.round((rpm / config.dropGear / gear / config.finalDrive) * tire.typeCircInMiles * 60);
          if (metric.value) speed = Math.round(speed * kphFactor);
          speedData.push(speed);
        }
        series.push({
          name: `${config.name} - ${GEAR_NAMES[gearIndex]}`,
          data: speedData,
          color: CONFIG_COLORS[configIndex],
          dashStyle: gearIndex === 3 ? 'Solid' : 'ShortDash',
          marker: { symbol: GEAR_MARKERS[gearIndex], enabled: true },
        });
      });
    });

    return series;
  });

  // Pick the config with the most gears for the "primary" side panels so a
  // 5-speed in config 1 still surfaces its 5th gear when config 0 is 4-speed.
  // Ties go to the lowest index (preserves config-0-first behavior for equal-length sets).
  const primaryConfigIndex = computed(() => {
    const list = configResults.value;
    if (list.length === 0) return 0;
    let idx = 0;
    let max = list[0]?.gearingTable.length ?? 0;
    for (let i = 1; i < list.length; i++) {
      const len = list[i]?.gearingTable.length ?? 0;
      if (len > max) {
        max = len;
        idx = i;
      }
    }
    return idx;
  });

  // Speedo + gearing details from the primary config (defined above)
  const primarySpeedoData = computed(() => {
    return configResults.value[primaryConfigIndex.value]?.speedoData || { turnsPerMile: 0, engineRevsMile: 0 };
  });

  const primarySpeedoTable = computed(() => {
    return configResults.value[primaryConfigIndex.value]?.speedoTable || [];
  });

  const primaryGearingTable = computed(() => {
    return configResults.value[primaryConfigIndex.value]?.gearingTable || [];
  });

  // Top speed from primary config (last gear = highest top speed)
  const topSpeed = computed(() => {
    const table = primaryGearingTable.value;
    if (table.length === 0) return '---';
    return table[table.length - 1]?.maxSpeed || '---';
  });

  // Display values with unit conversion
  const distanceUnit = computed(() => (metric.value ? 'Km' : 'Mile'));

  const displayEngineRevs = computed(() => {
    const val = primarySpeedoData.value.engineRevsMile;
    if (!val) return '---';
    return (metric.value ? Math.round(val / kphFactor) : val).toString();
  });

  const displayGearTurns = computed(() => {
    const val = primarySpeedoData.value.turnsPerMile;
    if (!val) return '---';
    return (metric.value ? Math.round(val / kphFactor) : val).toString();
  });

  const displayTireTurns = computed(() => {
    const val = tireCalcs.value.tireTurnsPerMile;
    if (!val) return '---';
    return (metric.value ? Math.round(val / kphFactor) : val).toString();
  });

  // ---- Verifiable math breakdown --------------------------------------
  // Everything below reads the SAME computed values the result cards and
  // tables render (tireCalcs / primarySpeedoData / primaryGearingTable), so a
  // reader redoing the arithmetic by hand lands on the numbers on screen. Do
  // not recompute the results here — a second implementation would drift and
  // the panel would then be actively misleading rather than merely stale.
  const primaryConfig = computed(() => configs.value[primaryConfigIndex.value]);

  function fmt(value: number, digits = 4): string {
    if (!Number.isFinite(value)) return '---';
    return Number.isInteger(value) ? String(value) : String(parseFloat(value.toFixed(digits)));
  }

  const mathSteps = computed<MathStep[]>(() => {
    const tire = tireCalcs.value;
    const config = primaryConfig.value;
    const result = configResults.value[primaryConfigIndex.value];
    if (!config || !result) return [];

    const circMiles = fmt(tire.typeCircInMiles, 7);
    const steps: MathStep[] = [];

    // 1. Tire diameter — crossply sizes carry a measured diameter instead.
    if (tireType.value.diameter) {
      steps.push({
        label: t('math.tire_diameter'),
        formula: t('math.tire_diameter_fixed_formula'),
        substitution: `${fmt(tireType.value.diameter)} mm`,
        result: `${tire.diameter} mm`,
        note: t('math.note_fixed_diameter'),
      });
    } else {
      steps.push({
        label: t('math.tire_diameter'),
        formula: '(width × profile ÷ 100 × 2) + (size × 25.4)',
        substitution: `(${tire.width} × ${tire.profile} ÷ 100 × 2) + (${tire.size} × 25.4)`,
        result: `${tire.diameter} mm`,
        note: t('math.note_rounded'),
      });
    }

    // 2. Circumference
    steps.push({
      label: t('math.tire_circumference'),
      formula: 'π × diameter',
      substitution: `3.14159 × ${tire.diameter}`,
      result: `${tire.circ} mm`,
      note: t('math.note_rounded'),
    });

    // 3. Circumference expressed in miles
    steps.push({
      label: t('math.circumference_in_miles'),
      formula: 'circumference ÷ (1760 × 914.4)',
      substitution: `${tire.circ} ÷ (1760 × 914.4)`,
      result: `${circMiles} mi`,
      note: t('math.note_yards'),
    });

    // 4. Tire turns per mile
    steps.push({
      label: t('math.tire_turns'),
      formula: '1760 ÷ (circumference ÷ 914.4)',
      substitution: `1760 ÷ (${tire.circ} ÷ 914.4)`,
      result: fmt(tire.tireTurnsPerMile),
      note: t('math.note_rounded'),
    });

    // 5. Engine revolutions per mile
    steps.push({
      label: t('math.engine_revs'),
      formula: 'tire turns per mile × final drive × drop gear',
      substitution: `${tire.tireTurnsPerMile} × ${config.finalDrive} × ${config.dropGear}`,
      result: fmt(result.speedoData.engineRevsMile),
      note: metric.value ? t('math.note_metric_distance') : undefined,
    });

    // 6. Speedo drive turns per mile
    steps.push({
      label: t('math.speedo_turns'),
      formula: 'tire turns per mile × final drive × speedo drive ratio',
      substitution: `${tire.tireTurnsPerMile} × ${config.finalDrive} × ${speedoDrive.value}`,
      result: fmt(result.speedoData.turnsPerMile),
      note: metric.value ? t('math.note_metric_distance') : undefined,
    });

    // 7. Top speed in the highest gear
    const topRow = result.gearingTable[result.gearingTable.length - 1];
    if (topRow) {
      steps.push({
        label: t('math.top_speed', { gear: topRow.gear }),
        formula: '(max RPM ÷ drop gear ÷ gear ratio ÷ final drive) × circumference in miles × 60',
        substitution: `(${maxRpm.value} ÷ ${config.dropGear} ÷ ${topRow.ratio} ÷ ${config.finalDrive}) × ${circMiles} × 60`,
        result: topRow.maxSpeed,
        note: metric.value ? t('math.note_metric_speed', { factor: kphFactor }) : t('math.note_rounded'),
      });
    }

    // 8. Speedometer accuracy for the recommended head
    const speedoRow = result.speedoBestRow;
    if (speedoRow) {
      const turnsPer = metric.value ? result.speedoData.turnsPerMile / kphFactor : result.speedoData.turnsPerMile;
      steps.push({
        label: t('math.speedo_accuracy', { speedo: speedoRow.speedometer }),
        formula: '(speedo drive turns ÷ speedometer head turns) × 100 × drop gear',
        substitution: `(${fmt(turnsPer)} ÷ ${speedoRow.turns}) × 100 × ${config.dropGear}`,
        result: `${Math.round((turnsPer / speedoRow.turns) * 100 * config.dropGear)}% — ${speedoRow.result}`,
        note: metric.value ? t('math.note_metric_turns', { factor: kphFactor }) : t('math.note_speedo'),
      });
    }

    return steps;
  });

  const mathConstants = computed<MathConstant[]>(() => [
    { label: t('math.const_pi'), value: '3.14159' },
    { label: t('math.const_yards'), value: '1760' },
    { label: t('math.const_mm_per_yard'), value: '914.4' },
    { label: t('math.const_inch'), value: '25.4 mm' },
    { label: t('math.const_kph'), value: String(kphFactor) },
  ]);

  const MATH_SOURCE_FILE = 'app/utils/gearingCalculations.ts';
  const MATH_SOURCE_URL = `https://github.com/ClassicMiniDIY/classicminidiy/blob/main/${MATH_SOURCE_FILE}`;

  // Config management
  function addConfig() {
    if (configs.value.length >= MAX_CONFIGS) return;
    const newConfig: GearConfig = {
      name: `Config ${configs.value.length + 1}`,
      gearset: [2.583, 1.644, 1.25, 1.0],
      finalDrive: 3.444,
      dropGear: 1,
    };
    configs.value.push(newConfig);
    capture('gearbox_config_added', { config_count: configs.value.length });
    triggerDebouncedUpdate();
  }

  function removeConfig(index: number) {
    if (configs.value.length <= 1) return;
    configs.value.splice(index, 1);
    capture('gearbox_config_removed', { config_count: configs.value.length });
    triggerDebouncedUpdate();
  }

  function updateConfig(index: number, updated: GearConfig) {
    configs.value[index] = updated;
    triggerDebouncedUpdate();
  }

  // Save/load functionality
  async function handleSave(index: number) {
    const config = configs.value[index];
    savingIndex.value = index;

    const tireLabel =
      options.tires.find(
        (t) =>
          t.value.width === tireType.value.width &&
          t.value.profile === tireType.value.profile &&
          t.value.size === tireType.value.size
      )?.label || `${tireType.value.width}/${tireType.value.profile}R${tireType.value.size}`;

    const gearsetLabel =
      options.gearRatios.find(
        (g) => g.value.length === config.gearset.length && g.value.every((v, i) => v === config.gearset[i])
      )?.label || config.gearset.join(', ');

    const result = await saveConfig({
      name: config.name,
      tire: tireLabel,
      gearset: gearsetLabel,
      final_drive: String(config.finalDrive),
      drop_gear: String(config.dropGear),
      speedo_drive: String(speedoDrive.value),
      max_rpm: maxRpm.value,
    });

    if (result) {
      configs.value[index] = { ...config, savedId: result.id };
      capture('gearbox_config_saved', { config_name: config.name });
    }

    savingIndex.value = null;
  }

  async function handleLoadConfig(saved: SavedGearConfig) {
    if (configs.value.length >= MAX_CONFIGS) return;

    // Find the matching gearset from options
    const gearsetOption = options.gearRatios.find((g) => g.label === saved.gearset);
    const diffOption = options.diffs.find((d) => String(d.value) === saved.final_drive);
    const dropOption = options.dropGears.find((d) => String(d.value) === saved.drop_gear);

    const newConfig: GearConfig = {
      name: saved.name,
      gearset: gearsetOption?.value || [2.583, 1.644, 1.25, 1.0],
      finalDrive: diffOption?.value || parseFloat(saved.final_drive),
      dropGear: dropOption?.value || parseFloat(saved.drop_gear),
      savedId: saved.id,
    };

    configs.value.push(newConfig);
    showLoadModal.value = false;
    capture('gearbox_config_loaded', { config_name: saved.name });
    triggerDebouncedUpdate();
  }

  async function handleDeleteSaved(id: string) {
    await deleteSavedConfig(id);
    // Also remove savedId from any active config
    configs.value.forEach((config) => {
      if (config.savedId === id) config.savedId = undefined;
    });
  }

  function openLoadModal() {
    if (isAuthenticated.value) {
      fetchConfigs();
    }
    showLoadModal.value = true;
    track('gearbox_load_modal_opened');
  }

  // Debounced input field tracking
  let gearboxFieldTimer: ReturnType<typeof setTimeout> | null = null;
  function trackGearboxField(field: string) {
    if (gearboxFieldTimer) clearTimeout(gearboxFieldTimer);
    gearboxFieldTimer = setTimeout(() => {
      track('gearbox_input_changed', { field });
    }, 600);
  }

  onUnmounted(() => {
    if (gearboxFieldTimer) clearTimeout(gearboxFieldTimer);
  });

  // Speedo table headers
  const tableHeadersSpeedos = [
    { key: 'speedometer', title: 'Speedometer' },
    { key: 'turns', title: 'Turns' },
    { key: 'speed', title: 'Speed' },
    { key: 'result', title: 'Result' },
  ];

  // Initialize
  onMounted(() => {
    nextTick(() => {
      triggerDebouncedUpdate();
    });
  });
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <!-- Shared Settings -->
    <CalculatorsGearboxSharedSettings
      :metric="metric"
      :tire-type="tireType"
      :speedo-drive="speedoDrive"
      :max-rpm="maxRpm"
      @update:metric="
        metric = $event;
        track('gearbox_input_changed', { field: 'metric', value: $event });
        triggerDebouncedUpdate();
      "
      @update:tire-type="
        tireType = $event;
        trackGearboxField('tire_dimensions');
        triggerDebouncedUpdate();
      "
      @update:speedo-drive="
        speedoDrive = $event;
        trackGearboxField('speedo_drive');
        triggerDebouncedUpdate();
      "
      @update:max-rpm="
        maxRpm = $event;
        trackGearboxField('max_rpm');
        triggerDebouncedUpdate();
      "
    />

    <!-- Configuration Cards -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold"><i class="fad fa-gears mr-2"></i>{{ t('configurations') }}</h3>
        <div class="flex items-center gap-2">
          <button v-if="isAuthenticated" class="btn btn-outline btn-sm" @click="openLoadModal">
            <i class="fas fa-folder-open"></i>
            {{ t('load_saved') }}
          </button>
          <button class="btn btn-outline btn-sm" :disabled="configs.length >= MAX_CONFIGS" @click="addConfig">
            <i class="fas fa-plus"></i>
            {{ t('add_config') }}
          </button>
        </div>
      </div>

      <CalculatorsGearboxConfigCard
        v-for="(config, index) in configs"
        :key="index"
        :config="config"
        :color-index="index"
        :can-delete="configs.length > 1"
        :is-authenticated="isAuthenticated"
        :is-saving="savingIndex === index"
        @update:config="updateConfig(index, $event)"
        @delete="removeConfig(index)"
        @save="handleSave(index)"
      />
    </div>

    <div class="divider my-4">
      <span class="text-sm opacity-70">{{ t('results_divider') }}</span>
    </div>

    <!-- Quick Stats (from first config) -->
    <div class="grid grid-cols-1 gap-6" :class="configs.length === 1 ? 'md:grid-cols-4' : 'md:grid-cols-3'">
      <div class="rounded-lg bg-stone-400 shadow-sm p-6 text-center">
        <h3 class="text-lg text-white opacity-70">
          <i class="fa-jelly-duo fa-regular fa-arrows-rotate fa-spin text-white"></i>
          {{ t('results.revolutions_per', { unit: distanceUnit }) }}
        </h3>
        <p class="text-3xl text-white font-bold">{{ displayEngineRevs }}</p>
      </div>
      <div class="rounded-lg bg-secondary shadow-sm p-6 text-center">
        <h3 class="text-lg text-white opacity-70">
          <i class="fa-jelly-duo fa-regular fa-arrow-rotate-right fa-spin"></i>
          {{ t('results.gear_turns_per', { unit: distanceUnit }) }}
        </h3>
        <p class="text-3xl text-white font-bold">{{ displayGearTurns }}</p>
      </div>
      <div class="rounded-lg bg-primary shadow-sm p-6 text-center">
        <h3 class="text-lg text-white opacity-70">
          <i class="fa-jelly-duo fa-regular fa-gauge"></i> {{ t('results.top_speed') }}
        </h3>
        <p class="text-3xl text-white font-bold">{{ topSpeed || '---' }}</p>
      </div>
      <div v-if="configs.length === 1" class="rounded-lg bg-accent shadow-sm p-6 text-center">
        <h3 class="text-lg text-white opacity-70">
          <i class="fa-jelly-duo fa-regular fa-percent"></i> {{ t('results.total_ratio') }}
        </h3>
        <p class="text-3xl text-white font-bold">{{ configResults[primaryConfigIndex]?.totalRatioTop || '---' }}</p>
      </div>
    </div>

    <!-- Tire Info Cards -->
    <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-arrow-down-to-line"></i>
          {{ t('tire_info.tire_width') }}
        </h3>
        <p class="text-lg font-bold">{{ tireCalcs.width || '---' }}mm</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly fa-regular fa-circle"></i>
          {{ t('tire_info.tire_profile') }}
        </h3>
        <p class="text-lg font-bold">{{ tireCalcs.profile || '---' }}%</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-expand"></i>
          {{ t('tire_info.tire_size') }}
        </h3>
        <p class="text-lg font-bold">{{ tireCalcs.size || '---' }}"</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-arrow-right-to-bracket"></i>
          {{ t('tire_info.tire_diameter') }}
        </h3>
        <p class="text-lg font-bold">{{ tireCalcs.diameter || '---' }}mm</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-circle"></i>
          {{ t('tire_info.circumference') }}
        </h3>
        <p class="text-lg font-bold">{{ tireCalcs.circ || '---' }}mm</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-duotone fa-solid fa-tire fa-spin"></i>
          {{ t('tire_info.tire_turns_per', { unit: distanceUnit }) }}
        </h3>
        <p class="text-lg font-bold">{{ displayTireTurns }}</p>
      </div>
    </div>

    <!-- Chart -->
    <div class="mt-6">
      <CalculatorsGearboxComparisonChart
        :all-gears-series="allGearsSeries"
        :config-names="configs.map((c) => c.name)"
        :config-colors="configs.map((_, i) => CONFIG_COLORS[i])"
        :metric="metric"
        :max-rpm="maxRpm"
        :max-gear-count="maxGearCount"
      />
    </div>

    <!-- Comparison Table (shown when 2+ configs) -->
    <div v-if="configs.length > 1" class="mt-6">
      <CalculatorsGearboxComparisonTable :configs="configResults" :metric="metric" />
    </div>

    <!-- Speedo Table (from first config) -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
      <div class="col-span-1 md:col-span-7">
        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="font-semibold text-lg flex items-center">
              <i class="fa-duotone fa-gauge mr-2"></i>
              {{ t('tables.speedo_information') }}
            </h2>
            <div class="overflow-x-auto">
              <table class="table table-sm w-full">
                <thead>
                  <tr>
                    <th v-for="header in tableHeadersSpeedos" :key="header.key" class="text-left font-medium">
                      {{ header.title }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in primarySpeedoTable" :key="index">
                    <td class="font-bold">{{ item.speedometer }}</td>
                    <td>{{ item.turns }}</td>
                    <td>{{ item.speed }}{{ metric ? 'kph' : 'mph' }}</td>
                    <td :class="item.status">{{ item.result }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-span-1 md:col-span-5">
        <!-- Gearing Table (from first config) -->
        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="font-semibold text-lg flex items-center">
              <i class="fa-duotone fa-gear fa-spin mr-2"></i>
              {{ t('tables.gearing_information') }}
            </h2>
            <div class="overflow-x-auto">
              <table class="table table-sm w-full">
                <thead>
                  <tr>
                    <th class="text-left font-medium">Gear</th>
                    <th class="text-left font-medium">Ratio</th>
                    <th class="text-left font-medium">{{ metric ? 'Max Speed (km/h)' : 'Max Speed (mph)' }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in primaryGearingTable" :key="index">
                    <td>{{ item.gear }}</td>
                    <td>{{ item.ratio }}</td>
                    <td>{{ item.maxSpeed }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="mt-6">
          <div class="divider my-4">
            <span class="text-sm opacity-70">{{ t('support_divider') }}</span>
          </div>
          <patreon-card size="large" />
        </div>
      </div>
    </div>

    <!-- Verifiable math -->
    <div class="mt-6">
      <CalculatorsMathBreakdown
        calculator="gearbox"
        :steps="mathSteps"
        :constants="mathConstants"
        :source-url="MATH_SOURCE_URL"
        :source-file="MATH_SOURCE_FILE"
      />
    </div>

    <div class="mt-6 text-center max-w-3xl mx-auto">
      <p>
        <i18n-t keypath="disclaimer" tag="span">
          <template #approximate
            ><strong>{{ t('disclaimer_approximate') }}</strong></template
          >
          <template #doublecheck
            ><strong>{{ t('disclaimer_doublecheck') }}</strong></template
          >
        </i18n-t>
      </p>
    </div>

    <!-- Save/Load Modal -->
    <CalculatorsGearboxSaveLoadModal
      :open="showLoadModal"
      :configs="savedConfigs"
      :loading="savedLoading"
      :slots-remaining="MAX_CONFIGS - configs.length"
      @update:open="showLoadModal = $event"
      @load="handleLoadConfig"
      @delete="handleDeleteSaved"
    />
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "configurations": "Gear Configurations",
    "add_config": "Add Configuration",
    "load_saved": "Load Saved",
    "results_divider": "Results",
    "results": {
      "revolutions_per": "Revolutions per/{unit}",
      "gear_turns_per": "Gear Turns per/{unit}",
      "top_speed": "Top Speed",
      "total_ratio": "Total Ratio"
    },
    "tire_info": {
      "tire_width": "Tire Width",
      "tire_profile": "Tire Profile",
      "tire_size": "Tire Size",
      "tire_diameter": "Tire Diameter",
      "circumference": "Circumference",
      "tire_turns_per": "Tire Turns per/{unit}"
    },
    "tables": {
      "speedo_information": "Speedo Information",
      "gearing_information": "Gearing Information"
    },
    "support_divider": "Support",
    "disclaimer": "Please note the above figures are {approximate}. Before purchasing parts and building your engine we recommend {doublecheck} your calculations multiple times using more than one source.",
    "disclaimer_approximate": "approximate values",
    "disclaimer_doublecheck": "doublechecking",
    "math": {
      "tire_diameter": "Tire diameter",
      "tire_diameter_fixed_formula": "published diameter (crossply sizes are listed, not derived)",
      "tire_circumference": "Tire circumference",
      "circumference_in_miles": "Circumference in miles",
      "tire_turns": "Tire turns per mile",
      "engine_revs": "Engine revolutions per mile",
      "speedo_turns": "Speedo drive turns per mile",
      "top_speed": "Top speed in gear {gear}",
      "speedo_accuracy": "Accuracy of the {speedo} speedometer",
      "note_rounded": "Rounded to the nearest whole number, the same as the calculator.",
      "note_yards": "A mile is 1760 yards and a yard is 914.4 mm.",
      "note_fixed_diameter": "Crossply sizes use a published diameter instead of the width and profile formula.",
      "note_speedo": "100% reads correctly. Above 100% the speedometer over-reads, below 100% it under-reads.",
      "note_metric_distance": "Calculated per mile. The result card divides this by 1.60934 to show it per kilometre.",
      "note_metric_speed": "Calculated in mph first, then multiplied by {factor} for km/h.",
      "note_metric_turns": "In metric mode the turns per mile are divided by {factor} first.",
      "const_pi": "Pi",
      "const_yards": "Yards in a mile",
      "const_mm_per_yard": "Millimetres in a yard",
      "const_inch": "One inch",
      "const_kph": "Miles to kilometres"
    }
  },
  "es": {
    "configurations": "Configuraciones de Engranajes",
    "add_config": "Agregar Configuración",
    "load_saved": "Cargar Guardada",
    "results_divider": "Resultados",
    "results": {
      "revolutions_per": "Revoluciones por/{unit}",
      "gear_turns_per": "Vueltas de Engranaje por/{unit}",
      "top_speed": "Velocidad Máxima",
      "total_ratio": "Relación Total"
    },
    "tire_info": {
      "tire_width": "Ancho del Neumático",
      "tire_profile": "Perfil del Neumático",
      "tire_size": "Tamaño del Neumático",
      "tire_diameter": "Diámetro del Neumático",
      "circumference": "Circunferencia",
      "tire_turns_per": "Vueltas del Neumático por/{unit}"
    },
    "tables": {
      "speedo_information": "Información del Velocímetro",
      "gearing_information": "Información de Engranajes"
    },
    "support_divider": "Apoyo",
    "disclaimer": "Ten en cuenta que las cifras anteriores son {approximate}. Antes de comprar piezas y construir tu motor, recomendamos {doublecheck} tus cálculos múltiples veces usando más de una fuente.",
    "disclaimer_approximate": "valores aproximados",
    "disclaimer_doublecheck": "verificar",
    "math": {
      "tire_diameter": "Diámetro del neumático",
      "tire_diameter_fixed_formula": "diámetro publicado (las medidas diagonales vienen tabuladas, no calculadas)",
      "tire_circumference": "Circunferencia del neumático",
      "circumference_in_miles": "Circunferencia en millas",
      "tire_turns": "Vueltas del neumático por milla",
      "engine_revs": "Revoluciones del motor por milla",
      "speedo_turns": "Vueltas del mando del velocímetro por milla",
      "top_speed": "Velocidad máxima en la marcha {gear}",
      "speedo_accuracy": "Precisión del velocímetro {speedo}",
      "note_rounded": "Redondeado al número entero más cercano, igual que la calculadora.",
      "note_yards": "Una milla son 1760 yardas y una yarda son 914,4 mm.",
      "note_fixed_diameter": "Las medidas diagonales usan un diámetro publicado en vez de la fórmula de ancho y perfil.",
      "note_speedo": "100% indica correctamente. Por encima del 100% el velocímetro marca de más, por debajo marca de menos.",
      "note_metric_distance": "Calculado por milla. La tarjeta de resultado lo divide entre 1,60934 para mostrarlo por kilómetro.",
      "note_metric_speed": "Se calcula primero en mph y luego se multiplica por {factor} para obtener km/h.",
      "note_metric_turns": "En modo métrico las vueltas por milla se dividen primero entre {factor}.",
      "const_pi": "Pi",
      "const_yards": "Yardas en una milla",
      "const_mm_per_yard": "Milímetros en una yarda",
      "const_inch": "Una pulgada",
      "const_kph": "Millas a kilómetros"
    }
  },
  "fr": {
    "configurations": "Configurations d'Engrenages",
    "add_config": "Ajouter une Configuration",
    "load_saved": "Charger Sauvegardée",
    "results_divider": "Résultats",
    "results": {
      "revolutions_per": "Révolutions par/{unit}",
      "gear_turns_per": "Tours d'engrenage par/{unit}",
      "top_speed": "Vitesse maximale",
      "total_ratio": "Rapport total"
    },
    "tire_info": {
      "tire_width": "Largeur de pneu",
      "tire_profile": "Profil de pneu",
      "tire_size": "Taille de pneu",
      "tire_diameter": "Diamètre de pneu",
      "circumference": "Circonférence",
      "tire_turns_per": "Tours de pneu par/{unit}"
    },
    "tables": {
      "speedo_information": "Informations compteur",
      "gearing_information": "Informations d'engrenage"
    },
    "support_divider": "Support",
    "disclaimer": "Veuillez noter que les chiffres ci-dessus sont des {approximate}. Avant d'acheter des pièces et de construire votre moteur, nous recommandons de {doublecheck} vos calculs plusieurs fois en utilisant plus d'une source.",
    "disclaimer_approximate": "valeurs approximatives",
    "disclaimer_doublecheck": "revérifier",
    "math": {
      "tire_diameter": "Diamètre du pneu",
      "tire_diameter_fixed_formula": "diamètre publié (les tailles diagonales sont listées, pas calculées)",
      "tire_circumference": "Circonférence du pneu",
      "circumference_in_miles": "Circonférence en miles",
      "tire_turns": "Tours de pneu par mile",
      "engine_revs": "Tours moteur par mile",
      "speedo_turns": "Tours du pignon de compteur par mile",
      "top_speed": "Vitesse maximale en {gear}e",
      "speedo_accuracy": "Précision du compteur {speedo}",
      "note_rounded": "Arrondi au nombre entier le plus proche, comme le calculateur.",
      "note_yards": "Un mile fait 1760 yards et un yard fait 914,4 mm.",
      "note_fixed_diameter": "Les tailles diagonales utilisent un diamètre publié au lieu de la formule largeur et profil.",
      "note_speedo": "100% indique correctement. Au-dessus de 100% le compteur sur-indique, en dessous il sous-indique.",
      "note_metric_distance": "Calculé par mile. La carte de résultat divise cette valeur par 1,60934 pour l'afficher par kilomètre.",
      "note_metric_speed": "Calculé d'abord en mph, puis multiplié par {factor} pour obtenir des km/h.",
      "note_metric_turns": "En mode métrique, les tours par mile sont d'abord divisés par {factor}.",
      "const_pi": "Pi",
      "const_yards": "Yards dans un mile",
      "const_mm_per_yard": "Millimètres dans un yard",
      "const_inch": "Un pouce",
      "const_kph": "Miles vers kilomètres"
    }
  },
  "de": {
    "configurations": "Getriebe-Konfigurationen",
    "add_config": "Konfiguration hinzufügen",
    "load_saved": "Gespeicherte laden",
    "results_divider": "Ergebnisse",
    "results": {
      "revolutions_per": "Umdrehungen pro/{unit}",
      "gear_turns_per": "Gang-Umdrehungen pro/{unit}",
      "top_speed": "Höchstgeschwindigkeit",
      "total_ratio": "Gesamtübersetzung"
    },
    "tire_info": {
      "tire_width": "Reifenbreite",
      "tire_profile": "Reifenprofil",
      "tire_size": "Reifengröße",
      "tire_diameter": "Reifendurchmesser",
      "circumference": "Umfang",
      "tire_turns_per": "Reifen-Umdrehungen pro/{unit}"
    },
    "tables": {
      "speedo_information": "Tacho-Informationen",
      "gearing_information": "Getriebe-Informationen"
    },
    "support_divider": "Unterstützung",
    "disclaimer": "Bitte beachten Sie, dass die obigen Zahlen {approximate} sind. Vor dem Kauf von Teilen und dem Bau Ihres Motors empfehlen wir, Ihre Berechnungen mehrmals mit mehr als einer Quelle zu {doublecheck}.",
    "disclaimer_approximate": "Näherungswerte",
    "disclaimer_doublecheck": "überprüfen",
    "math": {
      "tire_diameter": "Reifendurchmesser",
      "tire_diameter_fixed_formula": "angegebener Durchmesser (Diagonalreifen sind tabelliert, nicht berechnet)",
      "tire_circumference": "Reifenumfang",
      "circumference_in_miles": "Umfang in Meilen",
      "tire_turns": "Reifenumdrehungen pro Meile",
      "engine_revs": "Motorumdrehungen pro Meile",
      "speedo_turns": "Umdrehungen des Tachoantriebs pro Meile",
      "top_speed": "Höchstgeschwindigkeit im {gear}. Gang",
      "speedo_accuracy": "Genauigkeit des Tachometers {speedo}",
      "note_rounded": "Auf die nächste ganze Zahl gerundet, genau wie im Rechner.",
      "note_yards": "Eine Meile hat 1760 Yards, ein Yard hat 914,4 mm.",
      "note_fixed_diameter": "Diagonalreifen verwenden einen angegebenen Durchmesser statt der Formel aus Breite und Querschnitt.",
      "note_speedo": "100% zeigt korrekt an. Über 100% zeigt der Tacho zu viel an, unter 100% zu wenig.",
      "note_metric_distance": "Pro Meile berechnet. Die Ergebniskarte teilt diesen Wert durch 1,60934, um ihn pro Kilometer anzuzeigen.",
      "note_metric_speed": "Zuerst in mph berechnet, dann mit {factor} multipliziert für km/h.",
      "note_metric_turns": "Im metrischen Modus werden die Umdrehungen pro Meile zuerst durch {factor} geteilt.",
      "const_pi": "Pi",
      "const_yards": "Yards in einer Meile",
      "const_mm_per_yard": "Millimeter in einem Yard",
      "const_inch": "Ein Zoll",
      "const_kph": "Meilen in Kilometer"
    }
  },
  "it": {
    "configurations": "Configurazioni Ingranaggi",
    "add_config": "Aggiungi Configurazione",
    "load_saved": "Carica Salvata",
    "results_divider": "Risultati",
    "results": {
      "revolutions_per": "Giri per/{unit}",
      "gear_turns_per": "Giri ingranaggio per/{unit}",
      "top_speed": "Velocità massima",
      "total_ratio": "Rapporto totale"
    },
    "tire_info": {
      "tire_width": "Larghezza pneumatico",
      "tire_profile": "Profilo pneumatico",
      "tire_size": "Dimensione pneumatico",
      "tire_diameter": "Diametro pneumatico",
      "circumference": "Circonferenza",
      "tire_turns_per": "Giri pneumatico per/{unit}"
    },
    "tables": {
      "speedo_information": "Informazioni tachimetro",
      "gearing_information": "Informazioni ingranaggi"
    },
    "support_divider": "Supporto",
    "disclaimer": "Si prega di notare che le cifre sopra sono {approximate}. Prima di acquistare parti e costruire il vostro motore raccomandiamo di {doublecheck} i vostri calcoli più volte utilizzando più di una fonte.",
    "disclaimer_approximate": "valori approssimativi",
    "disclaimer_doublecheck": "ricontrollare",
    "math": {
      "tire_diameter": "Diametro del pneumatico",
      "tire_diameter_fixed_formula": "diametro dichiarato (le misure diagonali sono tabellate, non calcolate)",
      "tire_circumference": "Circonferenza del pneumatico",
      "circumference_in_miles": "Circonferenza in miglia",
      "tire_turns": "Giri del pneumatico per miglio",
      "engine_revs": "Giri motore per miglio",
      "speedo_turns": "Giri del rinvio tachimetro per miglio",
      "top_speed": "Velocità massima in {gear}a marcia",
      "speedo_accuracy": "Precisione del tachimetro {speedo}",
      "note_rounded": "Arrotondato al numero intero più vicino, come fa il calcolatore.",
      "note_yards": "Un miglio è 1760 iarde e una iarda è 914,4 mm.",
      "note_fixed_diameter": "Le misure diagonali usano un diametro dichiarato invece della formula di larghezza e profilo.",
      "note_speedo": "100% indica correttamente. Sopra il 100% il tachimetro segna in eccesso, sotto segna in difetto.",
      "note_metric_distance": "Calcolato per miglio. La scheda del risultato lo divide per 1,60934 per mostrarlo al chilometro.",
      "note_metric_speed": "Calcolato prima in mph, poi moltiplicato per {factor} per ottenere km/h.",
      "note_metric_turns": "In modalità metrica i giri per miglio vengono prima divisi per {factor}.",
      "const_pi": "Pi greco",
      "const_yards": "Iarde in un miglio",
      "const_mm_per_yard": "Millimetri in una iarda",
      "const_inch": "Un pollice",
      "const_kph": "Miglia in chilometri"
    }
  },
  "ja": {
    "configurations": "ギア構成",
    "add_config": "構成を追加",
    "load_saved": "保存済みを読み込む",
    "results_divider": "結果",
    "results": {
      "revolutions_per": "{unit}あたりの回転数",
      "gear_turns_per": "{unit}あたりのギア回転数",
      "top_speed": "最高速度",
      "total_ratio": "総減速比"
    },
    "tire_info": {
      "tire_width": "タイヤ幅",
      "tire_profile": "タイヤプロファイル",
      "tire_size": "タイヤサイズ",
      "tire_diameter": "タイヤ直径",
      "circumference": "円周",
      "tire_turns_per": "{unit}あたりのタイヤ回転数"
    },
    "tables": {
      "speedo_information": "スピードメーター情報",
      "gearing_information": "ギア情報"
    },
    "support_divider": "サポート",
    "disclaimer": "上記の数値は{approximate}であることにご注意ください。部品を購入してエンジンを構築する前に、複数のソースを使用して計算を{doublecheck}することをお勧めします。",
    "disclaimer_approximate": "概算値",
    "disclaimer_doublecheck": "何度も再確認",
    "math": {
      "tire_diameter": "タイヤ直径",
      "tire_diameter_fixed_formula": "公称直径（バイアスタイヤは計算ではなく表の値を使用）",
      "tire_circumference": "タイヤ外周",
      "circumference_in_miles": "外周（マイル換算）",
      "tire_turns": "1マイルあたりのタイヤ回転数",
      "engine_revs": "1マイルあたりのエンジン回転数",
      "speedo_turns": "1マイルあたりのスピードメーター駆動回転数",
      "top_speed": "{gear}速での最高速度",
      "speedo_accuracy": "{speedo} スピードメーターの精度",
      "note_rounded": "計算機と同じく、整数に四捨五入しています。",
      "note_yards": "1マイルは1760ヤード、1ヤードは914.4 mmです。",
      "note_fixed_diameter": "バイアスタイヤは幅と扁平率の式ではなく公称直径を使用します。",
      "note_speedo": "100%が正確な表示です。100%を超えると過大表示、下回ると過小表示になります。",
      "note_metric_distance": "1マイルあたりで計算しています。結果カードでは1.60934で割り、1キロあたりで表示します。",
      "note_metric_speed": "まず mph で計算し、次に {factor} を掛けて km/h に換算します。",
      "note_metric_turns": "メートル法モードでは、1マイルあたりの回転数をまず {factor} で割ります。",
      "const_pi": "円周率",
      "const_yards": "1マイルのヤード数",
      "const_mm_per_yard": "1ヤードのミリメートル数",
      "const_inch": "1インチ",
      "const_kph": "マイルからキロメートル"
    }
  },
  "ko": {
    "configurations": "기어 구성",
    "add_config": "구성 추가",
    "load_saved": "저장된 항목 불러오기",
    "results_divider": "결과",
    "results": {
      "revolutions_per": "{unit}당 회전수",
      "gear_turns_per": "{unit}당 기어 회전수",
      "top_speed": "최고 속도",
      "total_ratio": "총 기어비"
    },
    "tire_info": {
      "tire_width": "타이어 폭",
      "tire_profile": "타이어 프로파일",
      "tire_size": "타이어 크기",
      "tire_diameter": "타이어 직경",
      "circumference": "둘레",
      "tire_turns_per": "{unit}당 타이어 회전수"
    },
    "tables": {
      "speedo_information": "속도계 정보",
      "gearing_information": "기어링 정보"
    },
    "support_divider": "지원",
    "disclaimer": "위 수치들은 {approximate}임을 알려드립니다. 부품을 구매하고 엔진을 제작하기 전에 여러 소스를 사용하여 계산을 {doublecheck}할 것을 권장합니다.",
    "disclaimer_approximate": "근사값",
    "disclaimer_doublecheck": "여러 번 재확인",
    "math": {
      "tire_diameter": "타이어 직경",
      "tire_diameter_fixed_formula": "공칭 직경 (바이어스 규격은 계산이 아니라 표에 명시된 값)",
      "tire_circumference": "타이어 둘레",
      "circumference_in_miles": "둘레 (마일 환산)",
      "tire_turns": "마일당 타이어 회전수",
      "engine_revs": "마일당 엔진 회전수",
      "speedo_turns": "마일당 속도계 구동 회전수",
      "top_speed": "{gear}단 최고 속도",
      "speedo_accuracy": "{speedo} 속도계의 정확도",
      "note_rounded": "계산기와 동일하게 가장 가까운 정수로 반올림합니다.",
      "note_yards": "1마일은 1760야드이고 1야드는 914.4 mm입니다.",
      "note_fixed_diameter": "바이어스 규격은 폭과 편평비 공식 대신 공칭 직경을 사용합니다.",
      "note_speedo": "100%가 정확한 표시입니다. 100%를 넘으면 과다 표시, 미만이면 과소 표시입니다.",
      "note_metric_distance": "마일 단위로 계산합니다. 결과 카드는 이 값을 1.60934로 나누어 킬로미터 단위로 표시합니다.",
      "note_metric_speed": "먼저 mph로 계산한 뒤 {factor}를 곱해 km/h로 환산합니다.",
      "note_metric_turns": "미터법 모드에서는 마일당 회전수를 먼저 {factor}로 나눕니다.",
      "const_pi": "원주율",
      "const_yards": "1마일의 야드 수",
      "const_mm_per_yard": "1야드의 밀리미터 수",
      "const_inch": "1인치",
      "const_kph": "마일에서 킬로미터"
    }
  },
  "pt": {
    "configurations": "Configurações de Engrenagens",
    "add_config": "Adicionar Configuração",
    "load_saved": "Carregar Salva",
    "results_divider": "Resultados",
    "results": {
      "revolutions_per": "Revoluções por/{unit}",
      "gear_turns_per": "Voltas da Engrenagem por/{unit}",
      "top_speed": "Velocidade Máxima",
      "total_ratio": "Relação Total"
    },
    "tire_info": {
      "tire_width": "Largura do Pneu",
      "tire_profile": "Perfil do Pneu",
      "tire_size": "Tamanho do Pneu",
      "tire_diameter": "Diâmetro do Pneu",
      "circumference": "Circunferência",
      "tire_turns_per": "Voltas do Pneu por/{unit}"
    },
    "tables": {
      "speedo_information": "Informações do Velocímetro",
      "gearing_information": "Informações de Engrenagem"
    },
    "support_divider": "Suporte",
    "disclaimer": "Por favor, note que os números acima são {approximate}. Antes de comprar peças e construir seu motor, recomendamos {doublecheck} seus cálculos várias vezes usando mais de uma fonte.",
    "disclaimer_approximate": "valores aproximados",
    "disclaimer_doublecheck": "verificar novamente",
    "math": {
      "tire_diameter": "Diâmetro do pneu",
      "tire_diameter_fixed_formula": "diâmetro publicado (as medidas diagonais são tabeladas, não calculadas)",
      "tire_circumference": "Circunferência do pneu",
      "circumference_in_miles": "Circunferência em milhas",
      "tire_turns": "Voltas do pneu por milha",
      "engine_revs": "Rotações do motor por milha",
      "speedo_turns": "Voltas do acionamento do velocímetro por milha",
      "top_speed": "Velocidade máxima na {gear}ª marcha",
      "speedo_accuracy": "Precisão do velocímetro {speedo}",
      "note_rounded": "Arredondado para o número inteiro mais próximo, igual à calculadora.",
      "note_yards": "Uma milha tem 1760 jardas e uma jarda tem 914,4 mm.",
      "note_fixed_diameter": "As medidas diagonais usam um diâmetro publicado em vez da fórmula de largura e perfil.",
      "note_speedo": "100% indica corretamente. Acima de 100% o velocímetro marca a mais, abaixo marca a menos.",
      "note_metric_distance": "Calculado por milha. O cartão de resultado divide este valor por 1,60934 para mostrá-lo por quilómetro.",
      "note_metric_speed": "Calculado primeiro em mph e depois multiplicado por {factor} para obter km/h.",
      "note_metric_turns": "No modo métrico as voltas por milha são primeiro divididas por {factor}.",
      "const_pi": "Pi",
      "const_yards": "Jardas numa milha",
      "const_mm_per_yard": "Milímetros numa jarda",
      "const_inch": "Uma polegada",
      "const_kph": "Milhas para quilómetros"
    }
  },
  "ru": {
    "configurations": "Конфигурации передач",
    "add_config": "Добавить конфигурацию",
    "load_saved": "Загрузить сохранённую",
    "results_divider": "Результаты",
    "results": {
      "revolutions_per": "Оборотов на/{unit}",
      "gear_turns_per": "Оборотов шестерни на/{unit}",
      "top_speed": "Максимальная скорость",
      "total_ratio": "Общее передаточное число"
    },
    "tire_info": {
      "tire_width": "Ширина шины",
      "tire_profile": "Профиль шины",
      "tire_size": "Размер шины",
      "tire_diameter": "Диаметр шины",
      "circumference": "Окружность",
      "tire_turns_per": "Оборотов шины на/{unit}"
    },
    "tables": {
      "speedo_information": "Информация о спидометре",
      "gearing_information": "Информация о передачах"
    },
    "support_divider": "Поддержка",
    "disclaimer": "Обратите внимание, что приведенные выше цифры являются {approximate}. Перед покупкой деталей и сборкой двигателя мы рекомендуем {doublecheck} ваши расчеты несколько раз, используя более одного источника.",
    "disclaimer_approximate": "приблизительными значениями",
    "disclaimer_doublecheck": "перепроверить",
    "math": {
      "tire_diameter": "Диаметр шины",
      "tire_diameter_fixed_formula": "паспортный диаметр (диагональные размеры берутся из таблицы, а не вычисляются)",
      "tire_circumference": "Длина окружности шины",
      "circumference_in_miles": "Длина окружности в милях",
      "tire_turns": "Оборотов шины на милю",
      "engine_revs": "Оборотов двигателя на милю",
      "speedo_turns": "Оборотов привода спидометра на милю",
      "top_speed": "Максимальная скорость на {gear}-й передаче",
      "speedo_accuracy": "Точность спидометра {speedo}",
      "note_rounded": "Округлено до целого числа, как и в калькуляторе.",
      "note_yards": "В миле 1760 ярдов, в ярде 914,4 мм.",
      "note_fixed_diameter": "Для диагональных размеров используется паспортный диаметр вместо формулы ширины и профиля.",
      "note_speedo": "100% — показания верны. Выше 100% спидометр завышает, ниже 100% занижает.",
      "note_metric_distance": "Рассчитано на милю. Карточка результата делит это значение на 1,60934, чтобы показать на километр.",
      "note_metric_speed": "Сначала рассчитывается в милях в час, затем умножается на {factor} для км/ч.",
      "note_metric_turns": "В метрическом режиме обороты на милю сначала делятся на {factor}.",
      "const_pi": "Пи",
      "const_yards": "Ярдов в миле",
      "const_mm_per_yard": "Миллиметров в ярде",
      "const_inch": "Один дюйм",
      "const_kph": "Мили в километры"
    }
  },
  "zh": {
    "configurations": "齿轮配置",
    "add_config": "添加配置",
    "load_saved": "加载已保存",
    "results_divider": "结果",
    "results": {
      "revolutions_per": "每{unit}转数",
      "gear_turns_per": "每{unit}齿轮转数",
      "top_speed": "最高速度",
      "total_ratio": "总传动比"
    },
    "tire_info": {
      "tire_width": "轮胎宽度",
      "tire_profile": "轮胎轮廓",
      "tire_size": "轮胎尺寸",
      "tire_diameter": "轮胎直径",
      "circumference": "周长",
      "tire_turns_per": "每{unit}轮胎转数"
    },
    "tables": {
      "speedo_information": "速度表信息",
      "gearing_information": "齿轮信息"
    },
    "support_divider": "支持",
    "disclaimer": "请注意上述数字是{approximate}。在购买零件和制造发动机之前，我们建议使用多个来源{doublecheck}您的计算。",
    "disclaimer_approximate": "近似值",
    "disclaimer_doublecheck": "多次检查",
    "math": {
      "tire_diameter": "轮胎直径",
      "tire_diameter_fixed_formula": "标称直径（斜交胎为表列值，非计算值）",
      "tire_circumference": "轮胎周长",
      "circumference_in_miles": "周长（英里）",
      "tire_turns": "每英里轮胎转数",
      "engine_revs": "每英里发动机转数",
      "speedo_turns": "每英里速度表驱动转数",
      "top_speed": "{gear}挡最高速度",
      "speedo_accuracy": "{speedo} 速度表的准确度",
      "note_rounded": "与计算器一致，四舍五入为整数。",
      "note_yards": "1英里为1760码，1码为914.4毫米。",
      "note_fixed_diameter": "斜交胎使用标称直径，而非宽度与扁平比公式。",
      "note_speedo": "100% 表示读数准确。高于 100% 为读数偏高，低于 100% 为读数偏低。",
      "note_metric_distance": "按英里计算。结果卡片将其除以 1.60934 后按公里显示。",
      "note_metric_speed": "先以 mph 计算，再乘以 {factor} 得到 km/h。",
      "note_metric_turns": "公制模式下，先将每英里转数除以 {factor}。",
      "const_pi": "圆周率",
      "const_yards": "1英里的码数",
      "const_mm_per_yard": "1码的毫米数",
      "const_inch": "1英寸",
      "const_kph": "英里换算公里"
    }
  }
}
</i18n>

<style lang="scss">
  .text-red {
    color: #ff5252;
  }
  .text-green {
    color: #4caf50;
  }
  .text-primary {
    color: #2196f3;
  }
</style>
