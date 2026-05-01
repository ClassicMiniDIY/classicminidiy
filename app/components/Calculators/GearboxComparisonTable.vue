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
    totalRatioTop: string;
  }

  interface MetricRow {
    key: string;
    label: string;
    gearIndex: number; // -1 for non-gear rows
  }

  const props = defineProps<{
    configs: ConfigResult[];
    metric: boolean;
  }>();

  const maxGearCount = computed(() => {
    if (props.configs.length === 0) return 4;
    return Math.max(...props.configs.map((c) => c.gearingTable.length));
  });

  const metrics = computed<MetricRow[]>(() => {
    const rows: MetricRow[] = [];
    // Gear speeds — top gear first, descending so the visual flow is "fast → slow"
    for (let n = maxGearCount.value; n >= 1; n--) {
      rows.push({
        key: `gear_${n}_speed`,
        gearIndex: n - 1,
        label: t('gear_max_speed', { ordinal: t(`ordinals.${n}`) }),
      });
    }
    rows.push({ key: 'top_gear_ratio', gearIndex: -1, label: t('top_gear_ratio') });
    rows.push({ key: 'total_ratio', gearIndex: -1, label: t('total_ratio_top') });
    rows.push({ key: 'speedo', gearIndex: -1, label: t('best_speedo_match') });
    return rows;
  });

  const speedoStatusClass: Record<string, string> = {
    'text-red': 'text-error',
    'text-green': 'text-success',
    'text-primary': 'text-info',
  };

  function getValue(config: ConfigResult, row: MetricRow): string {
    if (row.key.startsWith('gear_')) {
      return config.gearingTable[row.gearIndex]?.maxSpeed || '—';
    }
    if (row.key === 'top_gear_ratio') {
      const top = config.gearingTable[config.gearingTable.length - 1];
      return top ? `${top.ratio}:1` : '—';
    }
    if (row.key === 'total_ratio') {
      return config.totalRatioTop;
    }
    if (row.key === 'speedo') {
      return config.speedoMatch;
    }
    return '—';
  }

  function getRawValue(config: ConfigResult, row: MetricRow): number | null {
    if (row.key.startsWith('gear_')) {
      const cell = config.gearingTable[row.gearIndex];
      return cell ? cell.maxSpeedRaw : null;
    }
    return null;
  }

  function isBest(config: ConfigResult, row: MetricRow): boolean {
    if (!row.key.startsWith('gear_')) return false;
    if (props.configs.length < 2) return false;
    const val = getRawValue(config, row);
    if (val === null) return false;
    const allValues = props.configs
      .map((c) => getRawValue(c, row))
      .filter((v): v is number => v !== null);
    if (allValues.length < 2) return false;
    return val === Math.max(...allValues);
  }
</script>

<template>
  <div v-if="configs.length > 0" class="card bg-base-100 shadow-md border border-base-300">
    <div class="card-body">
      <div class="flex items-center">
        <i class="fad fa-table-columns mr-2"></i>
        <h3 class="text-lg font-semibold">{{ t('title') }}</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="table table-sm w-full">
          <thead>
            <tr>
              <th class="text-left font-medium w-48">{{ t('metric') }}</th>
              <th v-for="(config, idx) in configs" :key="idx" class="text-center font-medium">
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
            <tr v-for="row in metrics" :key="row.key">
              <td class="font-medium">{{ row.label }}</td>
              <td
                v-for="(config, idx) in configs"
                :key="idx"
                class="text-center"
                :class="{ 'font-bold text-success': isBest(config, row) }"
              >
                <span v-if="row.key === 'speedo'" :class="speedoStatusClass[config.speedoStatus]">
                  {{ getValue(config, row) }}
                </span>
                <span v-else>{{ getValue(config, row) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Configuration Comparison",
    "metric": "Metric",
    "ordinals": { "1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th" },
    "gear_max_speed": "{ordinal} Gear Max Speed",
    "top_gear_ratio": "Top Gear Ratio",
    "total_ratio_top": "Total Ratio (Top)",
    "best_speedo_match": "Best Speedo Match"
  },
  "es": {
    "title": "Comparación de Configuraciones",
    "metric": "Métrica",
    "ordinals": { "1": "1ª", "2": "2ª", "3": "3ª", "4": "4ª", "5": "5ª" },
    "gear_max_speed": "Velocidad Máx. {ordinal} Marcha",
    "top_gear_ratio": "Relación Marcha Superior",
    "total_ratio_top": "Relación Total (Superior)",
    "best_speedo_match": "Mejor Coincidencia Velocímetro"
  },
  "fr": {
    "title": "Comparaison des Configurations",
    "metric": "Métrique",
    "ordinals": { "1": "1ère", "2": "2ème", "3": "3ème", "4": "4ème", "5": "5ème" },
    "gear_max_speed": "Vitesse Max {ordinal}",
    "top_gear_ratio": "Rapport Vitesse Supérieure",
    "total_ratio_top": "Rapport Total (Supérieure)",
    "best_speedo_match": "Meilleure Correspondance Compteur"
  },
  "de": {
    "title": "Konfigurationsvergleich",
    "metric": "Metrik",
    "ordinals": { "1": "1.", "2": "2.", "3": "3.", "4": "4.", "5": "5." },
    "gear_max_speed": "Max. Geschwindigkeit {ordinal} Gang",
    "top_gear_ratio": "Übersetzung höchster Gang",
    "total_ratio_top": "Gesamtübersetzung (höchster Gang)",
    "best_speedo_match": "Beste Tacho-Übereinstimmung"
  },
  "it": {
    "title": "Confronto Configurazioni",
    "metric": "Metrica",
    "ordinals": { "1": "1ª", "2": "2ª", "3": "3ª", "4": "4ª", "5": "5ª" },
    "gear_max_speed": "Vel. Max {ordinal} Marcia",
    "top_gear_ratio": "Rapporto Marcia Superiore",
    "total_ratio_top": "Rapporto Totale (Superiore)",
    "best_speedo_match": "Migliore Corrispondenza Tachimetro"
  },
  "pt": {
    "title": "Comparação de Configurações",
    "metric": "Métrica",
    "ordinals": { "1": "1ª", "2": "2ª", "3": "3ª", "4": "4ª", "5": "5ª" },
    "gear_max_speed": "Vel. Máx. {ordinal} Marcha",
    "top_gear_ratio": "Relação Marcha Superior",
    "total_ratio_top": "Relação Total (Superior)",
    "best_speedo_match": "Melhor Correspondência Velocímetro"
  },
  "ru": {
    "title": "Сравнение конфигураций",
    "metric": "Метрика",
    "ordinals": { "1": "1-й", "2": "2-й", "3": "3-й", "4": "4-й", "5": "5-й" },
    "gear_max_speed": "Макс. скорость {ordinal} передачи",
    "top_gear_ratio": "Передаточное число высшей передачи",
    "total_ratio_top": "Общее передаточное число (высш.)",
    "best_speedo_match": "Лучшее совпадение спидометра"
  },
  "ja": {
    "title": "設定の比較",
    "metric": "指標",
    "ordinals": { "1": "1速", "2": "2速", "3": "3速", "4": "4速", "5": "5速" },
    "gear_max_speed": "{ordinal} 最高速度",
    "top_gear_ratio": "トップギア比",
    "total_ratio_top": "総合変速比 (トップ)",
    "best_speedo_match": "最適なスピードメーター一致"
  },
  "zh": {
    "title": "配置对比",
    "metric": "指标",
    "ordinals": { "1": "1档", "2": "2档", "3": "3档", "4": "4档", "5": "5档" },
    "gear_max_speed": "{ordinal}最高速度",
    "top_gear_ratio": "顶档传动比",
    "total_ratio_top": "总传动比（顶档）",
    "best_speedo_match": "最佳速度表匹配"
  },
  "ko": {
    "title": "구성 비교",
    "metric": "지표",
    "ordinals": { "1": "1단", "2": "2단", "3": "3단", "4": "4단", "5": "5단" },
    "gear_max_speed": "{ordinal} 최고 속도",
    "top_gear_ratio": "최고단 기어비",
    "total_ratio_top": "총 변속비 (최고단)",
    "best_speedo_match": "최적 속도계 일치"
  }
}
</i18n>
