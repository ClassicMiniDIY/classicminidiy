<script setup lang="ts">
  interface Props {
    eyebrow?: string;
    title: string;
    description?: string;
    /** Render the title as <h1> (default) or <h2>. */
    as?: 'h1' | 'h2';
  }

  withDefaults(defineProps<Props>(), {
    eyebrow: '',
    description: '',
    as: 'h1',
  });
</script>

<template>
  <div class="section-head">
    <div class="meta">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <component :is="as" class="fancy-font-bold text-3xl md:text-4xl page-intro__title">
        {{ title }}
      </component>
      <p v-if="description" class="lead">{{ description }}</p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="page-intro__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
  .page-intro__title {
    line-height: 1.1;
    letter-spacing: var(--tracking-tight);
    margin: 0;
  }
  .page-intro__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
