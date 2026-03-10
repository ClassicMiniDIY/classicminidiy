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
  import type { SavedGearConfig } from '../../composables/useGearConfigs';

  const { t } = useI18n();
  const { capture } = usePostHog();
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

      const totalRatio4th = `${(config.finalDrive * (gearingTable[3]?.ratio || 1) * config.dropGear).toFixed(3)}:1`;

      return {
        name: config.name,
        colorIndex: index,
        gearingTable,
        speedoData,
        speedoTable,
        speedoMatch,
        speedoStatus,
        totalRatio4th,
      };
    });
  });

  // Chart data for all gears view
  const GEAR_MARKERS = ['circle', 'square', 'diamond', 'triangle'];
  const GEAR_NAMES = ['1st', '2nd', '3rd', '4th'];

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

  // Speedo details for the first config (used for the shared speedo info card)
  const primarySpeedoData = computed(() => {
    return configResults.value[0]?.speedoData || { turnsPerMile: 0, engineRevsMile: 0 };
  });

  const primarySpeedoTable = computed(() => {
    return configResults.value[0]?.speedoTable || [];
  });

  // Top speed from first config
  const topSpeed = computed(() => {
    return configResults.value[0]?.gearingTable[3]?.maxSpeed || '---';
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
  }

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
        triggerDebouncedUpdate();
      "
      @update:tire-type="
        tireType = $event;
        triggerDebouncedUpdate();
      "
      @update:speedo-drive="
        speedoDrive = $event;
        triggerDebouncedUpdate();
      "
      @update:max-rpm="
        maxRpm = $event;
        triggerDebouncedUpdate();
      "
    />

    <!-- Configuration Cards -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold"><i class="fad fa-gears mr-2"></i>{{ t('configurations') }}</h3>
        <div class="flex items-center gap-2">
          <UButton
            v-if="isAuthenticated"
            icon="i-fa6-solid-folder-open"
            variant="outline"
            size="sm"
            @click="openLoadModal"
          >
            {{ t('load_saved') }}
          </UButton>
          <UButton
            icon="i-fa6-solid-plus"
            variant="outline"
            size="sm"
            :disabled="configs.length >= MAX_CONFIGS"
            @click="addConfig"
          >
            {{ t('add_config') }}
          </UButton>
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

    <USeparator class="my-4">
      <span class="text-sm text-muted">{{ t('results_divider') }}</span>
    </USeparator>

    <!-- Quick Stats (from first config) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      />
    </div>

    <!-- Comparison Table (shown when 2+ configs) -->
    <div v-if="configs.length > 1" class="mt-6">
      <CalculatorsGearboxComparisonTable :configs="configResults" :metric="metric" />
    </div>

    <!-- Speedo Table (from first config) -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
      <div class="col-span-1 md:col-span-7">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-lg flex items-center">
              <i class="fa-duotone fa-gauge mr-2"></i>
              {{ t('tables.speedo_information') }}
            </h2>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default">
                  <th v-for="header in tableHeadersSpeedos" :key="header.key" class="text-left p-2 font-medium">
                    {{ header.title }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in primarySpeedoTable"
                  :key="index"
                  class="border-b border-default last:border-0"
                >
                  <td class="p-2 font-bold">{{ item.speedometer }}</td>
                  <td class="p-2">{{ item.turns }}</td>
                  <td class="p-2">{{ item.speed }}{{ metric ? 'kph' : 'mph' }}</td>
                  <td class="p-2" :class="item.status">{{ item.result }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>

      <div class="col-span-1 md:col-span-5">
        <!-- Gearing Table (from first config) -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-lg flex items-center">
              <i class="fa-duotone fa-gear fa-spin mr-2"></i>
              {{ t('tables.gearing_information') }}
            </h2>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default">
                  <th class="text-left p-2 font-medium">Gear</th>
                  <th class="text-left p-2 font-medium">Ratio</th>
                  <th class="text-left p-2 font-medium">{{ metric ? 'Max Speed (km/h)' : 'Max Speed (mph)' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in configResults[0]?.gearingTable || []"
                  :key="index"
                  class="border-b border-default last:border-0"
                >
                  <td class="p-2">{{ item.gear }}</td>
                  <td class="p-2">{{ item.ratio }}</td>
                  <td class="p-2">{{ item.maxSpeed }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
        <div class="mt-6">
          <USeparator class="my-4">
            <span class="text-sm text-muted">{{ t('support_divider') }}</span>
          </USeparator>
          <patreon-card size="large" />
        </div>
      </div>
    </div>

    <div class="mt-6 text-center max-w-3xl mx-auto">
      <p>
        <span v-html="t('disclaimer', { strong_start: '<strong>', strong_end: '</strong>' })"></span>
        <UButton
          variant="link"
          color="primary"
          to="https://github.com/SomethingNew71/classicminidiy/blob/dev/components/SpeedoDriveCalculator.vue#L512"
          target="_blank"
        >
          {{ t('equation_source') }}
        </UButton>
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
      "top_speed": "Top Speed"
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
    "disclaimer": "Please note the above figures are {strong_start}approximate values{strong_end}. Before purchasing parts and building your engine we recommend {strong_start}doublechecking{strong_end} your calculations multiple times using more than one source. The mathematical equations used in this tool can be found here:",
    "equation_source": "Equation Source Code"
  },
  "es": {
    "configurations": "Configuraciones de Engranajes",
    "add_config": "Agregar Configuración",
    "load_saved": "Cargar Guardada",
    "results_divider": "Resultados",
    "results": {
      "revolutions_per": "Revoluciones por/{unit}",
      "gear_turns_per": "Vueltas de Engranaje por/{unit}",
      "top_speed": "Velocidad Máxima"
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
    "disclaimer": "Ten en cuenta que las cifras anteriores son {strong_start}valores aproximados{strong_end}. Antes de comprar piezas y construir tu motor, recomendamos {strong_start}verificar{strong_end} tus cálculos múltiples veces usando más de una fuente. Las ecuaciones matemáticas usadas en esta herramienta se pueden encontrar aquí:",
    "equation_source": "Código Fuente de las Ecuaciones"
  },
  "fr": {
    "configurations": "Configurations d'Engrenages",
    "add_config": "Ajouter une Configuration",
    "load_saved": "Charger Sauvegardée",
    "results_divider": "Résultats",
    "results": {
      "revolutions_per": "Révolutions par/{unit}",
      "gear_turns_per": "Tours d'engrenage par/{unit}",
      "top_speed": "Vitesse maximale"
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
    "disclaimer": "Veuillez noter que les chiffres ci-dessus sont des {strong_start}valeurs approximatives{strong_end}. Avant d'acheter des pièces et de construire votre moteur, nous recommandons de {strong_start}revérifier{strong_end} vos calculs plusieurs fois en utilisant plus d'une source. Les équations mathématiques utilisées dans cet outil peuvent être trouvées ici :",
    "equation_source": "Code source des équations"
  },
  "de": {
    "configurations": "Getriebe-Konfigurationen",
    "add_config": "Konfiguration hinzufügen",
    "load_saved": "Gespeicherte laden",
    "results_divider": "Ergebnisse",
    "results": {
      "revolutions_per": "Umdrehungen pro/{unit}",
      "gear_turns_per": "Gang-Umdrehungen pro/{unit}",
      "top_speed": "Höchstgeschwindigkeit"
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
    "disclaimer": "Bitte beachten Sie, dass die obigen Zahlen {strong_start}Näherungswerte{strong_end} sind. Vor dem Kauf von Teilen und dem Bau Ihres Motors empfehlen wir, Ihre Berechnungen mehrmals mit mehr als einer Quelle zu {strong_start}überprüfen{strong_end}. Die in diesem Tool verwendeten mathematischen Gleichungen finden Sie hier:",
    "equation_source": "Gleichungs-Quellcode"
  },
  "it": {
    "configurations": "Configurazioni Ingranaggi",
    "add_config": "Aggiungi Configurazione",
    "load_saved": "Carica Salvata",
    "results_divider": "Risultati",
    "results": {
      "revolutions_per": "Giri per/{unit}",
      "gear_turns_per": "Giri ingranaggio per/{unit}",
      "top_speed": "Velocità massima"
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
    "disclaimer": "Si prega di notare che le cifre sopra sono {strong_start}valori approssimativi{strong_end}. Prima di acquistare parti e costruire il vostro motore raccomandiamo di {strong_start}ricontrollare{strong_end} i vostri calcoli più volte utilizzando più di una fonte. Le equazioni matematiche utilizzate in questo strumento possono essere trovate qui:",
    "equation_source": "Codice sorgente equazioni"
  },
  "ja": {
    "configurations": "ギア構成",
    "add_config": "構成を追加",
    "load_saved": "保存済みを読み込む",
    "results_divider": "結果",
    "results": {
      "revolutions_per": "{unit}あたりの回転数",
      "gear_turns_per": "{unit}あたりのギア回転数",
      "top_speed": "最高速度"
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
    "disclaimer": "上記の数値は{strong_start}概算値{strong_end}であることにご注意ください。部品を購入してエンジンを構築する前に、複数のソースを使用して計算を{strong_start}何度も再確認{strong_end}することをお勧めします。このツールで使用されている数学的方程式はこちらで見つけることができます：",
    "equation_source": "方程式ソースコード"
  },
  "ko": {
    "configurations": "기어 구성",
    "add_config": "구성 추가",
    "load_saved": "저장된 항목 불러오기",
    "results_divider": "결과",
    "results": {
      "revolutions_per": "{unit}당 회전수",
      "gear_turns_per": "{unit}당 기어 회전수",
      "top_speed": "최고 속도"
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
    "disclaimer": "위 수치들은 {strong_start}근사값{strong_end}임을 알려드립니다. 부품을 구매하고 엔진을 제작하기 전에 여러 소스를 사용하여 계산을 {strong_start}여러 번 재확인{strong_end}할 것을 권장합니다. 이 도구에 사용된 수학 공식은 여기에서 찾을 수 있습니다:",
    "equation_source": "공식 소스 코드"
  },
  "pt": {
    "configurations": "Configurações de Engrenagens",
    "add_config": "Adicionar Configuração",
    "load_saved": "Carregar Salva",
    "results_divider": "Resultados",
    "results": {
      "revolutions_per": "Revoluções por/{unit}",
      "gear_turns_per": "Voltas da Engrenagem por/{unit}",
      "top_speed": "Velocidade Máxima"
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
    "disclaimer": "Por favor, note que os números acima são {strong_start}valores aproximados{strong_end}. Antes de comprar peças e construir seu motor, recomendamos {strong_start}verificar novamente{strong_end} seus cálculos várias vezes usando mais de uma fonte. As equações matemáticas usadas nesta ferramenta podem ser encontradas aqui:",
    "equation_source": "Código Fonte da Equação"
  },
  "ru": {
    "configurations": "Конфигурации передач",
    "add_config": "Добавить конфигурацию",
    "load_saved": "Загрузить сохранённую",
    "results_divider": "Результаты",
    "results": {
      "revolutions_per": "Оборотов на/{unit}",
      "gear_turns_per": "Оборотов шестерни на/{unit}",
      "top_speed": "Максимальная скорость"
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
    "disclaimer": "Обратите внимание, что приведенные выше цифры являются {strong_start}приблизительными значениями{strong_end}. Перед покупкой деталей и сборкой двигателя мы рекомендуем {strong_start}перепроверить{strong_end} ваши расчеты несколько раз, используя более одного источника. Математические уравнения, используемые в этом инструменте, можно найти здесь:",
    "equation_source": "Исходный код уравнения"
  },
  "zh": {
    "configurations": "齿轮配置",
    "add_config": "添加配置",
    "load_saved": "加载已保存",
    "results_divider": "结果",
    "results": {
      "revolutions_per": "每{unit}转数",
      "gear_turns_per": "每{unit}齿轮转数",
      "top_speed": "最高速度"
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
    "disclaimer": "请注意上述数字是{strong_start}近似值{strong_end}。在购买零件和制造发动机之前，我们建议使用多个来源{strong_start}多次检查{strong_end}您的计算。此工具中使用的数学方程可以在这里找到：",
    "equation_source": "方程源代码"
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
