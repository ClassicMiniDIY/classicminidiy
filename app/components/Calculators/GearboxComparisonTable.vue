<script setup lang="ts">
  import type { GearingTableRow } from '../../utils/gearingCalculations';

  const { t } = useI18n();

  const CONFIG_COLORS = ['#5b8a8a', '#c17f59', '#7a9a6d', '#8b6d8b', '#6b7fa0'];

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
      <div class="flex items-center">
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
  },
  "es": {
    "title": "Comparación de Configuraciones",
    "metric": "Métrica",
    "4th_gear_max_speed": "Velocidad Máx. 4ª Marcha",
    "3rd_gear_max_speed": "Velocidad Máx. 3ª Marcha",
    "2nd_gear_max_speed": "Velocidad Máx. 2ª Marcha",
    "1st_gear_max_speed": "Velocidad Máx. 1ª Marcha",
    "4th_gear_ratio": "Relación 4ª Marcha",
    "total_ratio_4th": "Relación Total (4ª)",
    "best_speedo_match": "Mejor Coincidencia Velocímetro"
  },
  "fr": {
    "title": "Comparaison des Configurations",
    "metric": "Métrique",
    "4th_gear_max_speed": "Vitesse Max 4ème",
    "3rd_gear_max_speed": "Vitesse Max 3ème",
    "2nd_gear_max_speed": "Vitesse Max 2ème",
    "1st_gear_max_speed": "Vitesse Max 1ère",
    "4th_gear_ratio": "Rapport 4ème",
    "total_ratio_4th": "Rapport Total (4ème)",
    "best_speedo_match": "Meilleure Correspondance Compteur"
  },
  "de": {
    "title": "Konfigurationsvergleich",
    "metric": "Metrik",
    "4th_gear_max_speed": "Max. Geschwindigkeit 4. Gang",
    "3rd_gear_max_speed": "Max. Geschwindigkeit 3. Gang",
    "2nd_gear_max_speed": "Max. Geschwindigkeit 2. Gang",
    "1st_gear_max_speed": "Max. Geschwindigkeit 1. Gang",
    "4th_gear_ratio": "Übersetzung 4. Gang",
    "total_ratio_4th": "Gesamtübersetzung (4. Gang)",
    "best_speedo_match": "Beste Tacho-Übereinstimmung"
  },
  "it": {
    "title": "Confronto Configurazioni",
    "metric": "Metrica",
    "4th_gear_max_speed": "Vel. Max 4ª Marcia",
    "3rd_gear_max_speed": "Vel. Max 3ª Marcia",
    "2nd_gear_max_speed": "Vel. Max 2ª Marcia",
    "1st_gear_max_speed": "Vel. Max 1ª Marcia",
    "4th_gear_ratio": "Rapporto 4ª Marcia",
    "total_ratio_4th": "Rapporto Totale (4ª)",
    "best_speedo_match": "Migliore Corrispondenza Tachimetro"
  },
  "pt": {
    "title": "Comparação de Configurações",
    "metric": "Métrica",
    "4th_gear_max_speed": "Vel. Máx. 4ª Marcha",
    "3rd_gear_max_speed": "Vel. Máx. 3ª Marcha",
    "2nd_gear_max_speed": "Vel. Máx. 2ª Marcha",
    "1st_gear_max_speed": "Vel. Máx. 1ª Marcha",
    "4th_gear_ratio": "Relação 4ª Marcha",
    "total_ratio_4th": "Relação Total (4ª)",
    "best_speedo_match": "Melhor Correspondência Velocímetro"
  },
  "ru": {
    "title": "Сравнение конфигураций",
    "metric": "Метрика",
    "4th_gear_max_speed": "Макс. скорость 4-й передачи",
    "3rd_gear_max_speed": "Макс. скорость 3-й передачи",
    "2nd_gear_max_speed": "Макс. скорость 2-й передачи",
    "1st_gear_max_speed": "Макс. скорость 1-й передачи",
    "4th_gear_ratio": "Передаточное число 4-й передачи",
    "total_ratio_4th": "Общее передаточное число (4-я)",
    "best_speedo_match": "Лучшее совпадение спидометра"
  },
  "ja": {
    "title": "設定の比較",
    "metric": "指標",
    "4th_gear_max_speed": "4速 最高速度",
    "3rd_gear_max_speed": "3速 最高速度",
    "2nd_gear_max_speed": "2速 最高速度",
    "1st_gear_max_speed": "1速 最高速度",
    "4th_gear_ratio": "4速 ギア比",
    "total_ratio_4th": "総合変速比 (4速)",
    "best_speedo_match": "最適なスピードメーター一致"
  },
  "zh": {
    "title": "配置对比",
    "metric": "指标",
    "4th_gear_max_speed": "4档最高速度",
    "3rd_gear_max_speed": "3档最高速度",
    "2nd_gear_max_speed": "2档最高速度",
    "1st_gear_max_speed": "1档最高速度",
    "4th_gear_ratio": "4档传动比",
    "total_ratio_4th": "总传动比（4档）",
    "best_speedo_match": "最佳速度表匹配"
  },
  "ko": {
    "title": "구성 비교",
    "metric": "지표",
    "4th_gear_max_speed": "4단 최고 속도",
    "3rd_gear_max_speed": "3단 최고 속도",
    "2nd_gear_max_speed": "2단 최고 속도",
    "1st_gear_max_speed": "1단 최고 속도",
    "4th_gear_ratio": "4단 기어비",
    "total_ratio_4th": "총 변속비 (4단)",
    "best_speedo_match": "최적 속도계 일치"
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
