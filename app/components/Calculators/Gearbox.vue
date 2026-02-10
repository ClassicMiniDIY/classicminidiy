<script setup lang="ts">
  const { t } = useI18n();
  import {
    options,
    tableHeaders,
    chartOptions,
    kphFactor,
    type ISpeedometer,
    type TireValue,
  } from '../../../data/models/gearing';

  // Dark mode support
  const colorMode = useColorMode();
  const isDark = computed(() => colorMode.value === 'dark');

  // Dark mode chart colors
  const darkModeChartOptions = {
    chart: {
      backgroundColor: '#171717',
    },
    title: {
      style: { color: '#e5e5e5' },
    },
    subtitle: {
      style: { color: '#a3a3a3' },
    },
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

  // Light mode chart colors
  const lightModeChartOptions = {
    chart: {
      backgroundColor: '#ffffff',
    },
    title: {
      style: { color: '#171717' },
    },
    subtitle: {
      style: { color: '#525252' },
    },
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

  // Default Values for form elements
  const metric = ref(false);
  const final_drive = ref(3.444);
  const gear_ratios = ref([2.583, 1.644, 1.25, 1.0]);
  const drop_gear = ref(1);
  const speedo_drive = ref(0.3529);
  const max_rpm = ref(6500);
  const tire_type = ref<TireValue>({
    width: 145,
    profile: 80,
    size: 10,
  });

  // Form Options
  const tires = ref(options.tires);
  const diffs = ref(options.diffs);
  const speedosRatios = ref(options.speedosRatios);
  const dropGears = ref(options.dropGears);
  const gearRatios = ref(options.gearRatios);
  const speedos = ref(options.speedos);

  // Debounced calculation trigger
  const debouncedUpdate = ref(0);
  let debounceTimer: NodeJS.Timeout | null = null;

  const { capture } = usePostHog();

  const triggerDebouncedUpdate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedUpdate.value++;
      capture('calculator_used', {
        calculator: 'gearbox',
        gearbox_type: gear_ratios.value.length === 4 ? '4-speed' : '5-speed',
        final_drive: final_drive.value,
      });
    }, 150); // 150ms debounce
  };

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Section for Table Data - these will be computed now
  // Use type assertion to fix TypeScript errors with Vuetify table headers
  const tableHeadersGearing = tableHeaders.tableHeadersGearing as any[];
  const tableHeadersSpeedos = tableHeaders.tableHeadersSpeedos as any[];

  // Memoized chart options - avoiding expensive deep clone
  const mapOptions = computed(() => {
    const modeOptions = isDark.value ? darkModeChartOptions : lightModeChartOptions;
    const options = {
      ...chartOptions,
      chart: { ...chartOptions.chart, ...modeOptions.chart },
      title: { ...chartOptions.title, ...modeOptions.title },
      subtitle: { ...chartOptions.subtitle, ...modeOptions.subtitle },
      xAxis: { ...chartOptions.xAxis, ...modeOptions.xAxis },
      yAxis: {
        ...chartOptions.yAxis,
        ...modeOptions.yAxis,
        title: {
          ...chartOptions.yAxis.title,
          ...modeOptions.yAxis.title,
          text: metric.value ? 'Speed (km/h)' : 'Speed (mph)',
        },
      },
      legend: { ...chartOptions.legend, ...modeOptions.legend },
      tooltip: { ...chartOptions.tooltip, ...modeOptions.tooltip },
      series: chartData.value,
    };
    return options;
  });

  const YARDS_IN_MILE = 1760;
  const MM_IN_YARD = 914.4;

  // Memoized calculations - only recalculate when inputs change
  const tireCalculations = computed(() => {
    // Watch for debounced updates
    debouncedUpdate.value; // This makes the computed depend on debounced updates

    let diameter: number;
    if (tire_type.value.diameter) {
      diameter = tire_type.value.diameter;
    } else {
      diameter = Math.round(tire_type.value.width * (tire_type.value.profile / 100) * 2 + tire_type.value.size * 25.4);
    }

    const circ = Math.round(3.14159 * diameter);
    const typeCircInMiles = circ / (YARDS_IN_MILE * MM_IN_YARD);
    const tireTurnsPerMile = Math.round(YARDS_IN_MILE / (circ / MM_IN_YARD));

    return {
      width: tire_type.value.width,
      profile: tire_type.value.profile,
      size: tire_type.value.size,
      diameter,
      circ,
      tireTurnsPerMile,
      typeCircInMiles,
    };
  });

  const speedoCalculations = computed(() => {
    const tireCalcs = tireCalculations.value;
    return {
      turnsPerMile: Math.round(tireCalcs.tireTurnsPerMile * final_drive.value * speedo_drive.value),
      engineRevsMile: Math.round(tireCalcs.tireTurnsPerMile * final_drive.value * drop_gear.value),
    };
  });

  const gearingTableData = computed(() => {
    const tireCalcs = tireCalculations.value;
    return gear_ratios.value.map((gear: number, index) => {
      let maxSpeed = 0;
      if (tireCalcs.typeCircInMiles !== null) {
        maxSpeed = Math.round(
          (max_rpm.value / drop_gear.value / gear / final_drive.value) * tireCalcs.typeCircInMiles * 60
        );
      }

      const parsedMaxSpeed = metric.value ? `${Math.round(maxSpeed * kphFactor)}km/h` : `${maxSpeed}mph`;

      return {
        gear: index + 1,
        ratio: gear,
        maxSpeed: parsedMaxSpeed,
      };
    });
  });

  const speedometerTableData = computed(() => {
    const speedometers = metric.value ? speedos.value.metric : speedos.value.imperial;
    const factor = metric.value ? kphFactor : 1;
    const speedoCalcs = speedoCalculations.value;

    return speedometers.map((speedometer: ISpeedometer) => {
      const turnsPer = speedoCalcs.turnsPerMile / factor;
      const variation = Math.round((turnsPer / speedometer.turns) * 100 * drop_gear.value);
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
  });

  const chartData = computed(() => {
    const tireCalcs = tireCalculations.value;
    const data: Array<{ name: string; data: number[] }> = [];
    const gearNames = ['1st Gear', '2nd Gear', '3rd Gear', '4th Gear'];

    gear_ratios.value.forEach((gear, index) => {
      const speedData: number[] = [];
      for (let rpm = 1000; rpm <= max_rpm.value; rpm += 500) {
        let speed = 0;
        if (tireCalcs.typeCircInMiles !== null) {
          speed = Math.round((rpm / drop_gear.value / gear / final_drive.value) * tireCalcs.typeCircInMiles * 60);
          if (metric.value) {
            speed = Math.round(speed * kphFactor);
          }
        }
        speedData.push(speed);
      }
      data.push({
        name: gearNames[index] || '',
        data: speedData,
      });
    });

    return data;
  });

  // Template-compatible computed properties
  const topSpeed = computed(() => {
    const gearingData = gearingTableData.value;
    return gearingData[3]?.maxSpeed || '---';
  });

  const tireInfo = computed(() => tireCalculations.value);
  const speedoDetails = computed(() => speedoCalculations.value);
  const tableDataGearing = computed(() => gearingTableData.value);
  const tableDataSpeedos = computed(() => speedometerTableData.value);

  // USelect options for form selects
  const tireOptions = computed(() =>
    tires.value.map((item: { label: string; value: TireValue }) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const speedoRatioOptions = computed(() =>
    speedosRatios.value.map((item: { label: string; value: number }) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const dropGearOptions = computed(() =>
    dropGears.value.map((item: { label: string; value: number }) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const gearRatioOptions = computed(() =>
    gearRatios.value.map((item: { label: string; value: number[] }) => ({
      label: item.label,
      value: item.value,
    }))
  );

  const diffOptions = computed(() =>
    diffs.value.map((item: { label: string; value: number }) => ({
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

  // UTable column definitions
  const speedoColumns = computed(() => [
    { accessorKey: 'speedometer', header: tableHeadersSpeedos[0]?.title || 'Speedometer' },
    { accessorKey: 'turns', header: tableHeadersSpeedos[1]?.title || 'Turns' },
    { accessorKey: 'speed', header: tableHeadersSpeedos[2]?.title || 'Speed' },
    { accessorKey: 'result', header: tableHeadersSpeedos[3]?.title || 'Result' },
  ]);

  const gearingColumns = computed(() => [
    { accessorKey: 'gear', header: tableHeadersGearing[0]?.title || 'Gear' },
    { accessorKey: 'ratio', header: tableHeadersGearing[1]?.title || 'Ratio' },
    { accessorKey: 'maxSpeed', header: tableHeadersGearing[2]?.label || 'Max Speed' },
  ]);

  // Computed properties for metric conversion of "per Mile" values
  const displayEngineRevs = computed(() => {
    if (!speedoDetails.value.engineRevsMile) return '---';
    const value = metric.value
      ? Math.round(speedoDetails.value.engineRevsMile / kphFactor)
      : speedoDetails.value.engineRevsMile;
    return value.toString();
  });

  const displayGearTurns = computed(() => {
    if (!speedoDetails.value.turnsPerMile) return '---';
    const value = metric.value
      ? Math.round(speedoDetails.value.turnsPerMile / kphFactor)
      : speedoDetails.value.turnsPerMile;
    return value.toString();
  });

  const displayTireTurns = computed(() => {
    if (!tireInfo.value.tireTurnsPerMile) return '---';
    const value = metric.value
      ? Math.round(tireInfo.value.tireTurnsPerMile / kphFactor)
      : tireInfo.value.tireTurnsPerMile;
    return value.toString();
  });

  const distanceUnit = computed(() => (metric.value ? 'Km' : 'Mile'));

  // Update table headers reactively
  watch(
    metric,
    () => {
      tableHeadersGearing[2].label = metric.value ? 'Max Speed (km/h)' : 'Max Speed (mph)';
    },
    { immediate: true }
  );

  // Initialize debounced update on mount
  onMounted(() => {
    nextTick(() => {
      triggerDebouncedUpdate();
    });
  });
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <div class="flex items-center justify-start gap-3">
      <label class="text-sm font-medium">{{ t('form_labels.imperial_or_metric') }}</label>
      <USwitch v-model="metric" color="primary" @update:model-value="triggerDebouncedUpdate" />
    </div>

    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12 md:col-span-6">
        <label class="block text-sm font-medium mb-2">
          {{ t('form_labels.tire_size') }} <i class="fad fa-tire"></i>
        </label>
        <USelect
          v-model="tire_type"
          :items="tireOptions"
          value-key="value"
          class="w-full"
          @update:model-value="triggerDebouncedUpdate"
        />
      </div>
      <div class="col-span-12 md:col-span-6">
        <label class="block text-sm font-medium mb-2">
          {{ t('form_labels.speedo_drive_ratio') }} <i class="fad fa-percent"></i>
        </label>
        <USelect
          v-model="speedo_drive"
          :items="speedoRatioOptions"
          value-key="value"
          class="w-full"
          @update:model-value="triggerDebouncedUpdate"
        />
      </div>
      <div class="col-span-12 md:col-span-6">
        <label class="block text-sm font-medium mb-2">
          {{ t('form_labels.drop_gear_ratio') }} <i class="fad fa-gears"></i>
        </label>
        <USelect
          v-model="drop_gear"
          :items="dropGearOptions"
          value-key="value"
          class="w-full"
          @update:model-value="triggerDebouncedUpdate"
        />
      </div>
      <div class="col-span-12 md:col-span-6">
        <label class="block text-sm font-medium mb-2">
          {{ t('form_labels.gearset') }} <i class="fad fa-gear"></i>
        </label>
        <USelect
          v-model="gear_ratios"
          :items="gearRatioOptions"
          value-key="value"
          class="w-full"
          @update:model-value="triggerDebouncedUpdate"
        />
      </div>
      <div class="col-span-12 md:col-span-6">
        <label class="block text-sm font-medium mb-2">
          {{ t('form_labels.final_drive') }} <i class="fad fa-gears"></i>
        </label>
        <USelect
          v-model="final_drive"
          :items="diffOptions"
          value-key="value"
          class="w-full"
          @update:model-value="triggerDebouncedUpdate"
        />
      </div>
      <div class="col-span-12 md:col-span-6">
        <label class="block text-sm font-medium mb-2">
          {{ t('form_labels.max_rpm') }} <i class="fad fa-tachometer-alt"></i>
        </label>
        <USelect
          v-model="max_rpm"
          :items="rpmOptions"
          value-key="value"
          class="w-full"
          @update:model-value="triggerDebouncedUpdate"
        />
      </div>
    </div>

    <USeparator class="my-4">
      <span class="text-sm text-muted">{{ t('results_divider') }}</span>
    </USeparator>

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

    <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-arrow-down-to-line"></i>
          {{ t('tire_info.tire_width') }}
        </h3>
        <p class="text-lg font-bold">{{ tireInfo.width || '---' }}mm</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly fa-regular fa-circle"></i>
          {{ t('tire_info.tire_profile') }}
        </h3>
        <p class="text-lg font-bold">{{ tireInfo.profile || '---' }}%</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-expand"></i>
          {{ t('tire_info.tire_size') }}
        </h3>
        <p class="text-lg font-bold">{{ tireInfo.size || '---' }}"</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-arrow-right-to-bracket"></i>
          {{ t('tire_info.tire_diameter') }}
        </h3>
        <p class="text-lg font-bold">{{ tireInfo.diameter || '---' }}mm</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-jelly-duo fa-regular fa-circle"></i>
          {{ t('tire_info.circumference') }}
        </h3>
        <p class="text-lg font-bold">{{ tireInfo.circ || '---' }}mm</p>
      </div>
      <div class="rounded-lg bg-muted shadow-sm p-4 text-center">
        <h3 class="text-sm opacity-70">
          <i class="fa-duotone fa-solid fa-tire fa-spin"></i>
          {{ t('tire_info.tire_turns_per', { unit: distanceUnit }) }}
        </h3>
        <p class="text-lg font-bold">{{ displayTireTurns }}</p>
      </div>
    </div>
    <div class="mt-6">
      <UCard>
        <ClientOnly fallback-tag="span">
          <highcharts
            ref="gearSpeedChart"
            :options="mapOptions"
            :updateArgs="[true, true, true]"
            :constructorType="'chart'"
          ></highcharts>
          <template #fallback>
            <USkeleton class="h-96 w-full" />
            <p class="py-10 text-center text-2xl">{{ t('chart.loading') }}</p>
          </template>
        </ClientOnly>
      </UCard>
    </div>
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
                  v-for="(item, index) in tableDataSpeedos"
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
                  <th v-for="header in tableHeadersGearing" :key="header.key" class="text-left p-2 font-medium">
                    {{ header.title }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in tableDataGearing"
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
        {{ t('disclaimer', { strong_start: '<strong>', strong_end: '</strong>' }) }}
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
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "form_labels": {
      "imperial_or_metric": "Imperial or Metric",
      "tire_size": "Tire Size",
      "speedo_drive_ratio": "Speedo Drive Ratio",
      "drop_gear_ratio": "Drop Gear Ratio",
      "gearset": "Gearset",
      "final_drive": "Final Drive",
      "max_rpm": "Max RPM"
    },
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
    },
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
    "chart": {
      "loading": "Chart is loading"
    },
    "support_divider": "Support",
    "disclaimer": "Please note the above figures are {strong_start}approximate values{strong_end}. Before purchasing parts and building your engine we recommend {strong_start}doublechecking{strong_end} your calculations multiple times using more than one source. The mathematical equations used in this tool can be found here:",
    "equation_source": "Equation Source Code"
  },
  "es": {
    "form_labels": {
      "imperial_or_metric": "Imperial o Métrico",
      "tire_size": "Tamaño de Neumático",
      "speedo_drive_ratio": "Relación de Transmisión del Velocímetro",
      "drop_gear_ratio": "Relación de Engranaje de Caída",
      "gearset": "Conjunto de Engranajes",
      "final_drive": "Transmisión Final",
      "max_rpm": "RPM Máximo"
    },
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
    },
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
    "chart": {
      "loading": "El gráfico está cargando"
    },
    "support_divider": "Apoyo",
    "disclaimer": "Ten en cuenta que las cifras anteriores son {strong_start}valores aproximados{strong_end}. Antes de comprar piezas y construir tu motor, recomendamos {strong_start}verificar{strong_end} tus cálculos múltiples veces usando más de una fuente. Las ecuaciones matemáticas usadas en esta herramienta se pueden encontrar aquí:",
    "equation_source": "Código Fuente de las Ecuaciones"
  },
  "fr": {
    "form_labels": {
      "imperial_or_metric": "Impérial ou métrique",
      "tire_size": "Taille de pneu",
      "speedo_drive_ratio": "Rapport d'entraînement compteur",
      "drop_gear_ratio": "Rapport d'engrenage de chute",
      "gearset": "Jeu d'engrenages",
      "final_drive": "Transmission finale",
      "max_rpm": "RPM maximum"
    },
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
    },
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
    "chart": {
      "loading": "Le graphique se charge"
    },
    "support_divider": "Support",
    "disclaimer": "Veuillez noter que les chiffres ci-dessus sont des {strong_start}valeurs approximatives{strong_end}. Avant d'acheter des pièces et de construire votre moteur, nous recommandons de {strong_start}revérifier{strong_end} vos calculs plusieurs fois en utilisant plus d'une source. Les équations mathématiques utilisées dans cet outil peuvent être trouvées ici :",
    "equation_source": "Code source des équations"
  },
  "de": {
    "form_labels": {
      "imperial_or_metric": "Imperial oder Metrisch",
      "tire_size": "Reifengröße",
      "speedo_drive_ratio": "Tacho-Antriebsverhältnis",
      "drop_gear_ratio": "Drop-Gear-Verhältnis",
      "gearset": "Getriebesatz",
      "final_drive": "Achsantrieb",
      "max_rpm": "Max. Drehzahl"
    },
    "rpm_options": {
      "5000": "5000 U/min",
      "5500": "5500 U/min",
      "6000": "6000 U/min",
      "6500": "6500 U/min",
      "7000": "7000 U/min",
      "7500": "7500 U/min",
      "8000": "8000 U/min",
      "8500": "8500 U/min",
      "9000": "9000 U/min"
    },
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
    "chart": {
      "loading": "Diagramm lädt"
    },
    "support_divider": "Unterstützung",
    "disclaimer": "Bitte beachten Sie, dass die obigen Zahlen {strong_start}Näherungswerte{strong_end} sind. Vor dem Kauf von Teilen und dem Bau Ihres Motors empfehlen wir, Ihre Berechnungen mehrmals mit mehr als einer Quelle zu {strong_start}überprüfen{strong_end}. Die in diesem Tool verwendeten mathematischen Gleichungen finden Sie hier:",
    "equation_source": "Gleichungs-Quellcode"
  },
  "it": {
    "form_labels": {
      "imperial_or_metric": "Imperiale o Metrico",
      "tire_size": "Dimensione pneumatici",
      "speedo_drive_ratio": "Rapporto trasmissione tachimetro",
      "drop_gear_ratio": "Rapporto ingranaggio di caduta",
      "gearset": "Set ingranaggi",
      "final_drive": "Trasmissione finale",
      "max_rpm": "RPM massimi"
    },
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
    },
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
    "chart": {
      "loading": "Il grafico si sta caricando"
    },
    "support_divider": "Supporto",
    "disclaimer": "Si prega di notare che le cifre sopra sono {strong_start}valori approssimativi{strong_end}. Prima di acquistare parti e costruire il vostro motore raccomandiamo di {strong_start}ricontrollare{strong_end} i vostri calcoli più volte utilizzando più di una fonte. Le equazioni matematiche utilizzate in questo strumento possono essere trovate qui:",
    "equation_source": "Codice sorgente equazioni"
  },
  "ja": {
    "form_labels": {
      "imperial_or_metric": "ヤード・ポンド法またはメートル法",
      "tire_size": "タイヤサイズ",
      "speedo_drive_ratio": "スピードメーター駆動比",
      "drop_gear_ratio": "ドロップギア比",
      "gearset": "ギアセット",
      "final_drive": "ファイナルドライブ",
      "max_rpm": "最大回転数"
    },
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
    },
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
    "chart": {
      "loading": "チャートを読み込み中"
    },
    "support_divider": "サポート",
    "disclaimer": "上記の数値は{strong_start}概算値{strong_end}であることにご注意ください。部品を購入してエンジンを構築する前に、複数のソースを使用して計算を{strong_start}何度も再確認{strong_end}することをお勧めします。このツールで使用されている数学的方程式はこちらで見つけることができます：",
    "equation_source": "方程式ソースコード"
  },
  "ko": {
    "form_labels": {
      "imperial_or_metric": "야드파운드법 또는 미터법",
      "tire_size": "타이어 크기",
      "speedo_drive_ratio": "속도계 구동 비율",
      "drop_gear_ratio": "드롭 기어 비율",
      "gearset": "기어세트",
      "final_drive": "파이널 드라이브",
      "max_rpm": "최대 RPM"
    },
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
    },
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
    "chart": {
      "loading": "차트 로딩 중"
    },
    "support_divider": "지원",
    "disclaimer": "위 수치들은 {strong_start}근사값{strong_end}임을 알려드립니다. 부품을 구매하고 엔진을 제작하기 전에 여러 소스를 사용하여 계산을 {strong_start}여러 번 재확인{strong_end}할 것을 권장합니다. 이 도구에 사용된 수학 공식은 여기에서 찾을 수 있습니다:",
    "equation_source": "공식 소스 코드"
  },
  "pt": {
    "form_labels": {
      "imperial_or_metric": "Imperial ou Métrico",
      "tire_size": "Tamanho do Pneu",
      "speedo_drive_ratio": "Relação de Transmissão do Velocímetro",
      "drop_gear_ratio": "Relação de Engrenagem de Queda",
      "gearset": "Conjunto de Engrenagens",
      "final_drive": "Transmissão Final",
      "max_rpm": "RPM Máximo"
    },
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
    },
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
    "chart": {
      "loading": "O gráfico está carregando"
    },
    "support_divider": "Suporte",
    "disclaimer": "Por favor, note que os números acima são {strong_start}valores aproximados{strong_end}. Antes de comprar peças e construir seu motor, recomendamos {strong_start}verificar novamente{strong_end} seus cálculos várias vezes usando mais de uma fonte. As equações matemáticas usadas nesta ferramenta podem ser encontradas aqui:",
    "equation_source": "Código Fonte da Equação"
  },
  "ru": {
    "form_labels": {
      "imperial_or_metric": "Имперская или метрическая",
      "tire_size": "Размер шины",
      "speedo_drive_ratio": "Передаточное число спидометра",
      "drop_gear_ratio": "Передаточное число понижающей передачи",
      "gearset": "Набор шестерен",
      "final_drive": "Главная передача",
      "max_rpm": "Макс. об/мин"
    },
    "rpm_options": {
      "5000": "5000 об/мин",
      "5500": "5500 об/мин",
      "6000": "6000 об/мин",
      "6500": "6500 об/мин",
      "7000": "7000 об/мин",
      "7500": "7500 об/мин",
      "8000": "8000 об/мин",
      "8500": "8500 об/мин",
      "9000": "9000 об/мин"
    },
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
    "chart": {
      "loading": "График загружается"
    },
    "support_divider": "Поддержка",
    "disclaimer": "Обратите внимание, что приведенные выше цифры являются {strong_start}приблизительными значениями{strong_end}. Перед покупкой деталей и сборкой двигателя мы рекомендуем {strong_start}перепроверить{strong_end} ваши расчеты несколько раз, используя более одного источника. Математические уравнения, используемые в этом инструменте, можно найти здесь:",
    "equation_source": "Исходный код уравнения"
  },
  "zh": {
    "form_labels": {
      "imperial_or_metric": "英制或公制",
      "tire_size": "轮胎尺寸",
      "speedo_drive_ratio": "速度表传动比",
      "drop_gear_ratio": "降档比",
      "gearset": "齿轮组",
      "final_drive": "主减速器",
      "max_rpm": "最大转速"
    },
    "rpm_options": {
      "5000": "5000 转/分",
      "5500": "5500 转/分",
      "6000": "6000 转/分",
      "6500": "6500 转/分",
      "7000": "7000 转/分",
      "7500": "7500 转/分",
      "8000": "8000 转/分",
      "8500": "8500 转/分",
      "9000": "9000 转/分"
    },
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
    "chart": {
      "loading": "图表加载中"
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
