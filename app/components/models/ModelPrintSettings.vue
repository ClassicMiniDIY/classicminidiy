<script setup lang="ts">
  import type { PrintSettings } from '~~/data/models/model-library';

  const { t } = useI18n();
  const props = defineProps<{ settings: PrintSettings | null }>();

  interface Stat {
    label: string;
    value: string;
    icon: string;
  }

  const stats = computed<Stat[]>(() => {
    const s = props.settings;
    if (!s) return [];
    const out: Stat[] = [];
    const push = (label: string, value: string | number | undefined | null, icon: string, suffix = '') => {
      if (value === undefined || value === null || value === '') return;
      out.push({ label, value: `${value}${suffix}`, icon });
    };
    push(t('layerHeight'), s.layerHeight, 'fa-layer-group', ' mm');
    push(t('infill'), s.infillPercent, 'fa-percent', '%');
    push(t('infillPattern'), s.infillPattern, 'fa-border-all');
    push(t('walls'), s.wallCount, 'fa-grip-lines-vertical');
    push(t('nozzle'), s.nozzleSize, 'fa-circle-dot', ' mm');
    push(t('bedTemp'), s.bedTempCelsius, 'fa-temperature-half', ' °C');
    push(t('hotendTemp'), s.hotendTempCelsius, 'fa-fire', ' °C');
    push(t('orientation'), s.orientation, 'fa-arrows-up-down-left-right');
    push(t('bedAdhesion'), s.bedAdhesion, 'fa-bars-staggered');
    push(t('supportType'), s.supportType, 'fa-cubes-stacked');
    push(t('estPrintTime'), s.estimatedTimeHours, 'fa-clock', ' hr');
    push(t('estFilament'), s.estimatedFilamentGrams, 'fa-weight-hanging', ' g');
    return out;
  });

  const hasContent = computed(() => {
    const s = props.settings;
    return !!s && (stats.value.length > 0 || !!s.recommendedMaterial || !!s.notes);
  });
</script>

<template>
  <div v-if="hasContent" class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <h3 class="card-title text-lg"><i class="fas fa-print text-primary mr-1"></i> {{ t('title') }}</h3>

      <div v-if="settings?.recommendedMaterial" class="flex flex-wrap items-center gap-2 mb-2">
        <span class="badge badge-primary gap-1">
          <i class="fas fa-star text-[0.65rem]"></i> {{ settings.recommendedMaterial }}
        </span>
        <span v-for="m in settings?.alternativeMaterials || []" :key="m" class="badge badge-outline badge-sm">
          {{ m }}
        </span>
        <span
          v-for="m in settings?.notRecommendedMaterials || []"
          :key="`no-${m}`"
          class="badge badge-error badge-outline badge-sm gap-1"
        >
          <i class="fas fa-xmark text-[0.6rem]"></i> {{ m }}
        </span>
      </div>

      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div v-for="stat in stats" :key="stat.label" class="rounded-lg bg-base-200 px-3 py-2">
          <dt class="text-xs opacity-60 flex items-center gap-1">
            <i class="fas" :class="stat.icon"></i> {{ stat.label }}
          </dt>
          <dd class="font-semibold">{{ stat.value }}</dd>
        </div>
      </dl>

      <div v-if="settings?.supportsRequired !== undefined" class="text-sm mt-1">
        <i
          class="fas"
          :class="settings.supportsRequired ? 'fa-circle-check text-warning' : 'fa-circle-check text-success'"
        ></i>
        {{ settings.supportsRequired ? t('supportsRequired') : t('noSupports') }}
      </div>

      <p v-if="settings?.notes" class="text-sm opacity-80 mt-2 whitespace-pre-line">{{ settings.notes }}</p>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Print settings",
    "layerHeight": "Layer height",
    "infill": "Infill",
    "infillPattern": "Infill pattern",
    "walls": "Walls",
    "nozzle": "Nozzle",
    "bedTemp": "Bed temp",
    "hotendTemp": "Hotend temp",
    "orientation": "Orientation",
    "bedAdhesion": "Bed adhesion",
    "supportType": "Support type",
    "estPrintTime": "Est. print time",
    "estFilament": "Est. filament",
    "supportsRequired": "Supports required",
    "noSupports": "No supports required"
  },
  "es": {
    "title": "Ajustes de impresión",
    "layerHeight": "Altura de capa",
    "infill": "Relleno",
    "infillPattern": "Patrón de relleno",
    "walls": "Paredes",
    "nozzle": "Boquilla",
    "bedTemp": "Temp. cama",
    "hotendTemp": "Temp. hotend",
    "orientation": "Orientación",
    "bedAdhesion": "Adhesión a la cama",
    "supportType": "Tipo de soporte",
    "estPrintTime": "Tiempo estimado",
    "estFilament": "Filamento estimado",
    "supportsRequired": "Soportes necesarios",
    "noSupports": "Sin soportes necesarios"
  },
  "fr": {
    "title": "Paramètres d'impression",
    "layerHeight": "Hauteur de couche",
    "infill": "Remplissage",
    "infillPattern": "Motif de remplissage",
    "walls": "Périmètres",
    "nozzle": "Buse",
    "bedTemp": "Temp. plateau",
    "hotendTemp": "Temp. hotend",
    "orientation": "Orientation",
    "bedAdhesion": "Adhérence plateau",
    "supportType": "Type de support",
    "estPrintTime": "Durée estimée",
    "estFilament": "Filament estimé",
    "supportsRequired": "Supports nécessaires",
    "noSupports": "Aucun support nécessaire"
  },
  "de": {
    "title": "Druckeinstellungen",
    "layerHeight": "Schichthöhe",
    "infill": "Füllung",
    "infillPattern": "Füllmuster",
    "walls": "Wandlinien",
    "nozzle": "Düse",
    "bedTemp": "Betttemperatur",
    "hotendTemp": "Hotend-Temperatur",
    "orientation": "Ausrichtung",
    "bedAdhesion": "Haftung",
    "supportType": "Stützstruktur",
    "estPrintTime": "Geschätzte Druckzeit",
    "estFilament": "Geschätztes Filament",
    "supportsRequired": "Stützen erforderlich",
    "noSupports": "Keine Stützen erforderlich"
  },
  "it": {
    "title": "Impostazioni di stampa",
    "layerHeight": "Altezza layer",
    "infill": "Riempimento",
    "infillPattern": "Motivo riempimento",
    "walls": "Pareti",
    "nozzle": "Ugello",
    "bedTemp": "Temp. piano",
    "hotendTemp": "Temp. hotend",
    "orientation": "Orientamento",
    "bedAdhesion": "Adesione al piano",
    "supportType": "Tipo di supporto",
    "estPrintTime": "Tempo stimato",
    "estFilament": "Filamento stimato",
    "supportsRequired": "Supporti necessari",
    "noSupports": "Nessun supporto necessario"
  },
  "pt": {
    "title": "Configurações de impressão",
    "layerHeight": "Altura da camada",
    "infill": "Preenchimento",
    "infillPattern": "Padrão de preenchimento",
    "walls": "Paredes",
    "nozzle": "Bocal",
    "bedTemp": "Temp. mesa",
    "hotendTemp": "Temp. hotend",
    "orientation": "Orientação",
    "bedAdhesion": "Adesão à mesa",
    "supportType": "Tipo de suporte",
    "estPrintTime": "Tempo estimado",
    "estFilament": "Filamento estimado",
    "supportsRequired": "Suportes necessários",
    "noSupports": "Sem suportes necessários"
  },
  "ru": {
    "title": "Настройки печати",
    "layerHeight": "Высота слоя",
    "infill": "Заполнение",
    "infillPattern": "Паттерн заполнения",
    "walls": "Стенки",
    "nozzle": "Сопло",
    "bedTemp": "Темп. стола",
    "hotendTemp": "Темп. хотэнда",
    "orientation": "Ориентация",
    "bedAdhesion": "Адгезия стола",
    "supportType": "Тип поддержек",
    "estPrintTime": "Оценочное время",
    "estFilament": "Оценочный расход",
    "supportsRequired": "Поддержки нужны",
    "noSupports": "Поддержки не нужны"
  },
  "ja": {
    "title": "印刷設定",
    "layerHeight": "レイヤー高さ",
    "infill": "インフィル",
    "infillPattern": "インフィルパターン",
    "walls": "壁の数",
    "nozzle": "ノズル",
    "bedTemp": "ベッド温度",
    "hotendTemp": "ホットエンド温度",
    "orientation": "向き",
    "bedAdhesion": "ベッド密着",
    "supportType": "サポートタイプ",
    "estPrintTime": "印刷時間（目安）",
    "estFilament": "フィラメント（目安）",
    "supportsRequired": "サポート要",
    "noSupports": "サポート不要"
  },
  "zh": {
    "title": "打印设置",
    "layerHeight": "层高",
    "infill": "填充率",
    "infillPattern": "填充图案",
    "walls": "壁数",
    "nozzle": "喷嘴",
    "bedTemp": "热床温度",
    "hotendTemp": "喷头温度",
    "orientation": "摆放方向",
    "bedAdhesion": "热床附着",
    "supportType": "支撑类型",
    "estPrintTime": "预计打印时间",
    "estFilament": "预计耗材用量",
    "supportsRequired": "需要支撑",
    "noSupports": "无需支撑"
  },
  "ko": {
    "title": "출력 설정",
    "layerHeight": "레이어 높이",
    "infill": "채움",
    "infillPattern": "채움 패턴",
    "walls": "벽 개수",
    "nozzle": "노즐",
    "bedTemp": "베드 온도",
    "hotendTemp": "핫엔드 온도",
    "orientation": "방향",
    "bedAdhesion": "베드 접착",
    "supportType": "지지대 유형",
    "estPrintTime": "예상 출력 시간",
    "estFilament": "예상 필라멘트",
    "supportsRequired": "지지대 필요",
    "noSupports": "지지대 불필요"
  }
}
</i18n>
