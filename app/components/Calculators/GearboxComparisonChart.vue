<script setup lang="ts">
  import { chartOptions } from '../../../data/models/gearing';
  import type { ChartSeriesData } from '../../utils/gearingCalculations';

  const { t } = useI18n();

  const props = withDefaults(
    defineProps<{
      allGearsSeries: ChartSeriesData[];
      configNames: string[];
      configColors: string[];
      metric: boolean;
      maxRpm: number;
      maxGearCount?: number;
    }>(),
    { maxGearCount: 4 }
  );

  const colorMode = useColorMode();
  const isDark = computed(() => colorMode.isDark.value);

  const ALL_GEAR_SHAPES: { symbol: string; dash: string; label: string }[] = [
    { symbol: 'circle', dash: 'ShortDash', label: '1st Gear' },
    { symbol: 'square', dash: 'ShortDash', label: '2nd Gear' },
    { symbol: 'diamond', dash: 'ShortDash', label: '3rd Gear' },
    { symbol: 'triangle', dash: 'Solid', label: '4th Gear' },
    { symbol: 'triangle-down', dash: 'ShortDash', label: '5th Gear' },
  ];

  const GEAR_SHAPES = computed(() => ALL_GEAR_SHAPES.slice(0, props.maxGearCount));

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
    tooltip: {
      backgroundColor: '#ffffff',
      style: { color: '#171717' },
    },
  };

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
      legend: { enabled: false },
      tooltip: {
        ...chartOptions.tooltip,
        ...modeOptions.tooltip,
        shared: true,
        useHTML: true,
        formatter: function (this: any) {
          const unit = props.metric ? 'km/h' : 'mph';
          const symbolMap: Record<string, string> = {
            circle: '\u25CF',
            square: '\u25A0',
            diamond: '\u25C6',
            triangle: '\u25B2',
            'triangle-down': '\u25BC',
          };
          let html = `<b>${this.x} RPM</b><br/>`;
          for (const point of this.points) {
            const symbol = symbolMap[point.series.options.marker?.symbol] || '\u25CF';
            const gear = point.series.name.split(' - ').pop() || '';
            html += `<span style="color:${point.series.color}">${symbol}</span> ${gear}: <b>${point.y} ${unit}</b><br/>`;
          }
          return html;
        },
      },
      series: props.allGearsSeries,
    };
  });
</script>

<template>
  <div class="card bg-base-100 shadow-md border border-base-300">
    <div class="card-body">
      <h3 class="text-lg font-semibold mb-4"><i class="fad fa-chart-line mr-2"></i>{{ t('chart_title') }}</h3>
      <ClientOnly>
        <highcharts :options="mapOptions" :updateArgs="[true, true, true]" constructorType="chart" />
        <template #fallback>
          <div>
            <div class="skeleton h-96 w-full"></div>
            <p class="py-10 text-center text-2xl">{{ t('loading') }}</p>
          </div>
        </template>
      </ClientOnly>

      <!-- Custom Legend -->
      <div class="mt-4 pt-4 border-t border-base-300 flex flex-wrap gap-x-8 gap-y-3 justify-center">
        <!-- Gear shapes -->
        <div class="flex items-center gap-4">
          <span class="text-xs font-semibold uppercase opacity-60">{{ t('gears') }}</span>
          <div v-for="gear in GEAR_SHAPES" :key="gear.label" class="flex items-center gap-1.5">
            <svg width="24" height="12" viewBox="0 0 24 12">
              <line
                x1="0"
                y1="6"
                x2="24"
                y2="6"
                stroke="currentColor"
                stroke-width="1.5"
                :stroke-dasharray="gear.dash === 'ShortDash' ? '4,3' : 'none'"
                class="opacity-40"
              />
              <template v-if="gear.symbol === 'circle'">
                <circle cx="12" cy="6" r="3.5" fill="currentColor" class="opacity-60" />
              </template>
              <template v-else-if="gear.symbol === 'square'">
                <rect x="8.5" y="2.5" width="7" height="7" fill="currentColor" class="opacity-60" />
              </template>
              <template v-else-if="gear.symbol === 'diamond'">
                <polygon points="12,1.5 16.5,6 12,10.5 7.5,6" fill="currentColor" class="opacity-60" />
              </template>
              <template v-else-if="gear.symbol === 'triangle'">
                <polygon points="12,1.5 17,10.5 7,10.5" fill="currentColor" class="opacity-60" />
              </template>
              <template v-else-if="gear.symbol === 'triangle-down'">
                <polygon points="12,10.5 7,1.5 17,1.5" fill="currentColor" class="opacity-60" />
              </template>
            </svg>
            <span class="text-xs">{{ gear.label }}</span>
          </div>
        </div>

        <!-- Config colors -->
        <div v-if="configNames.length > 0" class="flex items-center gap-4">
          <span class="text-xs font-semibold uppercase opacity-60">{{ t('configs') }}</span>
          <div v-for="(name, i) in configNames" :key="i" class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: configColors[i] }"></span>
            <span class="text-xs truncate max-w-32">{{ name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "chart_title": "Speed vs RPM Comparison",
    "loading": "Chart is loading",
    "gears": "Gears",
    "configs": "Configs"
  },
  "es": {
    "chart_title": "Comparación de Velocidad vs RPM",
    "loading": "El gráfico está cargando",
    "gears": "Marchas",
    "configs": "Configs"
  },
  "fr": {
    "chart_title": "Comparaison Vitesse vs RPM",
    "loading": "Le graphique se charge",
    "gears": "Rapports",
    "configs": "Configs"
  },
  "de": {
    "chart_title": "Geschwindigkeit vs Drehzahl Vergleich",
    "loading": "Diagramm lädt",
    "gears": "Gänge",
    "configs": "Konfigs"
  },
  "it": {
    "chart_title": "Confronto Velocità vs Giri",
    "loading": "Il grafico si sta caricando",
    "gears": "Marce",
    "configs": "Config"
  },
  "pt": {
    "chart_title": "Comparação Velocidade vs RPM",
    "loading": "O gráfico está a carregar",
    "gears": "Marchas",
    "configs": "Config"
  },
  "ru": {
    "chart_title": "Сравнение скорости и оборотов",
    "loading": "График загружается",
    "gears": "Передачи",
    "configs": "Конфиги"
  },
  "ja": {
    "chart_title": "速度 vs 回転数 比較",
    "loading": "グラフを読み込んでいます",
    "gears": "ギア",
    "configs": "設定"
  },
  "zh": {
    "chart_title": "速度与转速对比",
    "loading": "图表加载中",
    "gears": "档位",
    "configs": "配置"
  },
  "ko": {
    "chart_title": "속도 vs RPM 비교",
    "loading": "차트를 불러오는 중",
    "gears": "기어",
    "configs": "구성"
  }
}
</i18n>
