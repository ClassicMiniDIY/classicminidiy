<script setup lang="ts">
  /**
   * Liability banner for printed parts (keystone §12). Always shows the general
   * "as-is, not certified for road use" note; escalates to a prominent warning
   * when the model is flagged `safety_critical`.
   */
  withDefaults(defineProps<{ safetyCritical?: boolean }>(), { safetyCritical: false });
</script>

<template>
  <div role="note" class="alert" :class="safetyCritical ? 'alert-warning' : 'alert-info alert-soft'">
    <i class="fas text-lg" :class="safetyCritical ? 'fa-triangle-exclamation' : 'fa-circle-info'"></i>
    <div class="text-sm">
      <p v-if="safetyCritical" class="font-bold">Safety-critical part — print and use at your own risk</p>
      <p :class="safetyCritical ? 'mt-1' : 'font-semibold'">
        These files are provided <strong>as-is</strong> and are <strong>not certified for road use</strong>. You are
        responsible for verifying any part's strength, fit, and suitability before fitting it to a vehicle. Classic Mini
        DIY and the model's author accept no liability for printed parts.
        <span v-if="safetyCritical">
          This model has been flagged as safety-critical — take extra care and do not use it for structural, braking,
          steering, or fuel-system applications without independent engineering review.
        </span>
      </p>
    </div>
  </div>
</template>
