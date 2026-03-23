<script lang="ts" setup>
  import type { Vehicle } from '~/composables/useProfile';

  const { t } = useI18n();

  withDefaults(
    defineProps<{
      vehicles: Vehicle[];
      loading?: boolean;
    }>(),
    { loading: false }
  );
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="flex justify-center py-8">
    <span class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></span>
  </div>

  <!-- Empty state -->
  <div v-else-if="vehicles.length === 0" class="text-center py-8 opacity-60">
    <i class="fas fa-car text-4xl mb-3 block"></i>
    <p>{{ t('empty') }}</p>
  </div>

  <!-- Vehicle grid -->
  <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <div v-for="vehicle in vehicles" :key="vehicle.id" class="p-4 rounded-lg border">
      <p class="font-medium">{{ vehicle.name }}</p>
      <p v-if="vehicle.year || vehicle.make || vehicle.model" class="text-sm opacity-70 mt-1">
        <span v-if="vehicle.year">{{ vehicle.year }}</span>
        <span v-if="vehicle.make"> {{ vehicle.make }}</span>
        <span v-if="vehicle.model"> {{ vehicle.model }}</span>
      </p>
      <div v-if="vehicle.color" class="flex items-center gap-2 mt-2">
        <span class="w-3 h-3 rounded-full border" :style="{ backgroundColor: vehicle.color }"></span>
        <span class="text-xs opacity-60">{{ vehicle.color }}</span>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": { "empty": "No vehicles to display." },
  "es": { "empty": "No hay vehículos para mostrar." },
  "fr": { "empty": "Aucun véhicule à afficher." },
  "de": { "empty": "Keine Fahrzeuge vorhanden." },
  "it": { "empty": "Nessun veicolo da mostrare." },
  "pt": { "empty": "Nenhum veículo para exibir." },
  "ru": { "empty": "Нет транспортных средств для отображения." },
  "ja": { "empty": "表示する車両はありません。" },
  "zh": { "empty": "没有可显示的车辆。" },
  "ko": { "empty": "표시할 차량이 없습니다." }
}
</i18n>
