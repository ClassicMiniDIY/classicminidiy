<script setup lang="ts">
  /**
   * Brand-colored badge marking a listing as sourced from an external site
   * ("Around the Web"). Font Awesome 6 has no per-site logos, so brand identity
   * is the solid brand color + site name. Used on cards and the detail page.
   */
  import { sourceConfig, type ExternalSourceSite } from '~~/data/models/external-sources';

  const props = withDefaults(defineProps<{ site: ExternalSourceSite; size?: 'sm' | 'md' | 'lg' }>(), {
    size: 'sm',
  });

  const cfg = computed(() => sourceConfig(props.site));
  const sizeClass = computed(() =>
    props.size === 'lg' ? 'badge-lg' : props.size === 'md' ? 'badge-md' : 'badge-sm'
  );
</script>

<template>
  <span
    class="badge gap-1 font-semibold border-0"
    :class="sizeClass"
    :style="{ backgroundColor: cfg.brandColor, color: cfg.textColor }"
  >
    <i class="fas fa-arrow-up-right-from-square text-[0.6rem]"></i>
    {{ cfg.label }}
  </span>
</template>
