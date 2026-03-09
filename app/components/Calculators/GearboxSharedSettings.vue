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

  // USelect requires string values - serialize objects to JSON strings
  const tireOptions = computed(() =>
    options.tires.map((item) => ({
      label: item.label,
      value: JSON.stringify(item.value),
    }))
  );

  // Current tire type as a JSON string for USelect model-value
  const tireStringValue = computed(() => JSON.stringify(props.tireType));

  const speedoRatioOptions = computed(() =>
    options.speedosRatios.map((item) => ({
      label: item.label,
      value: String(item.value),
    }))
  );

  const rpmOptions = [
    { label: t('rpm_options.5000'), value: '5000' },
    { label: t('rpm_options.5500'), value: '5500' },
    { label: t('rpm_options.6000'), value: '6000' },
    { label: t('rpm_options.6500'), value: '6500' },
    { label: t('rpm_options.7000'), value: '7000' },
    { label: t('rpm_options.7500'), value: '7500' },
    { label: t('rpm_options.8000'), value: '8000' },
    { label: t('rpm_options.8500'), value: '8500' },
    { label: t('rpm_options.9000'), value: '9000' },
  ];
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold"><i class="fad fa-sliders mr-2"></i>{{ t('title') }}</h3>
        <div class="flex items-center gap-3">
          <label class="text-sm font-medium">{{ t('imperial_or_metric') }}</label>
          <USwitch :model-value="metric" color="primary" @update:model-value="emit('update:metric', $event)" />
        </div>
      </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium mb-2"> {{ t('tire_size') }} <i class="fad fa-tire"></i> </label>
        <USelect
          :model-value="tireStringValue"
          :items="tireOptions"
          value-key="value"
          class="w-full"
          @update:model-value="emit('update:tireType', JSON.parse($event))"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2">
          {{ t('speedo_drive_ratio') }} <i class="fad fa-percent"></i>
        </label>
        <USelect
          :model-value="String(speedoDrive)"
          :items="speedoRatioOptions"
          value-key="value"
          class="w-full"
          @update:model-value="emit('update:speedoDrive', parseFloat($event))"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2"> {{ t('max_rpm') }} <i class="fad fa-tachometer-alt"></i> </label>
        <USelect
          :model-value="String(maxRpm)"
          :items="rpmOptions"
          value-key="value"
          class="w-full"
          @update:model-value="emit('update:maxRpm', parseInt($event))"
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
  },
  "es": {
    "title": "Configuraciones Compartidas",
    "imperial_or_metric": "Imperial o Métrico",
    "tire_size": "Tamaño de Neumático",
    "speedo_drive_ratio": "Relación de Transmisión del Velocímetro",
    "max_rpm": "RPM Máximo"
  },
  "fr": {
    "title": "Paramètres Partagés",
    "imperial_or_metric": "Impérial ou métrique",
    "tire_size": "Taille de pneu",
    "speedo_drive_ratio": "Rapport d'entraînement compteur",
    "max_rpm": "RPM maximum"
  },
  "de": {
    "title": "Gemeinsame Einstellungen",
    "imperial_or_metric": "Imperial oder Metrisch",
    "tire_size": "Reifengröße",
    "speedo_drive_ratio": "Tacho-Antriebsverhältnis",
    "max_rpm": "Max. Drehzahl"
  },
  "it": {
    "title": "Impostazioni Condivise",
    "imperial_or_metric": "Imperiale o Metrico",
    "tire_size": "Dimensione Pneumatico",
    "speedo_drive_ratio": "Rapporto Trasmissione Tachimetro",
    "max_rpm": "Giri Max",
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
  },
  "pt": {
    "title": "Configurações Compartilhadas",
    "imperial_or_metric": "Imperial ou Métrico",
    "tire_size": "Tamanho do Pneu",
    "speedo_drive_ratio": "Relação de Acionamento do Velocímetro",
    "max_rpm": "RPM Máximo",
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
  },
  "ru": {
    "title": "Общие настройки",
    "imperial_or_metric": "Имперская или метрическая система",
    "tire_size": "Размер шины",
    "speedo_drive_ratio": "Передаточное отношение спидометра",
    "max_rpm": "Макс. об/мин",
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
    }
  },
  "ja": {
    "title": "共通設定",
    "imperial_or_metric": "ヤード・ポンド法またはメートル法",
    "tire_size": "タイヤサイズ",
    "speedo_drive_ratio": "スピードメーター駆動比",
    "max_rpm": "最大回転数",
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
  },
  "zh": {
    "title": "共享设置",
    "imperial_or_metric": "英制或公制",
    "tire_size": "轮胎尺寸",
    "speedo_drive_ratio": "速度表传动比",
    "max_rpm": "最大转速",
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
  },
  "ko": {
    "title": "공유 설정",
    "imperial_or_metric": "야드파운드법 또는 미터법",
    "tire_size": "타이어 크기",
    "speedo_drive_ratio": "속도계 구동비",
    "max_rpm": "최대 RPM",
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
