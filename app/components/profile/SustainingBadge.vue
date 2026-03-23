<script lang="ts" setup>
  withDefaults(
    defineProps<{
      size?: 'sm' | 'md';
    }>(),
    { size: 'md' }
  );
</script>

<template>
  <span
    class="inline-flex items-center gap-1 font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
    :class="size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'"
  >
    <i class="fas fa-star" :class="size === 'sm' ? 'text-[10px]' : 'text-xs'"></i>
    Sustaining Member
  </span>
</template>
