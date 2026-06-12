<script setup lang="ts">
  import type { PrintSettings } from '~~/data/models/model-library';

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
    push('Layer height', s.layerHeight, 'fa-layer-group', ' mm');
    push('Infill', s.infillPercent, 'fa-percent', '%');
    push('Infill pattern', s.infillPattern, 'fa-border-all');
    push('Walls', s.wallCount, 'fa-grip-lines-vertical');
    push('Nozzle', s.nozzleSize, 'fa-circle-dot', ' mm');
    push('Bed temp', s.bedTempCelsius, 'fa-temperature-half', ' °C');
    push('Hotend temp', s.hotendTempCelsius, 'fa-fire', ' °C');
    push('Orientation', s.orientation, 'fa-arrows-up-down-left-right');
    push('Bed adhesion', s.bedAdhesion, 'fa-bars-staggered');
    push('Support type', s.supportType, 'fa-cubes-stacked');
    push('Est. print time', s.estimatedTimeHours, 'fa-clock', ' hr');
    push('Est. filament', s.estimatedFilamentGrams, 'fa-weight-hanging', ' g');
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
      <h3 class="card-title text-lg"><i class="fas fa-print text-primary mr-1"></i> Print settings</h3>

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
        {{ settings.supportsRequired ? 'Supports required' : 'No supports required' }}
      </div>

      <p v-if="settings?.notes" class="text-sm opacity-80 mt-2 whitespace-pre-line">{{ settings.notes }}</p>
    </div>
  </div>
</template>
