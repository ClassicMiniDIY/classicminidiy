<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    size?: 'xs' | 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' }
);

const { isDark, toggle } = useColorMode();
const { track } = useAnalytics();

// SSR always renders light mode, but the persisted preference (localStorage) is
// applied during client setup — gate on mount so the first client render matches
// the server markup and hydration stays clean.
const hasMounted = ref(false);
onMounted(() => {
  hasMounted.value = true;
});
const showDark = computed(() => hasMounted.value && isDark.value);

function handleToggle() {
  toggle();
  track('color_mode_toggled', { new_mode: isDark.value ? 'light' : 'dark' });
}

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'btn-xs';
    case 'sm':
      return 'btn-sm';
    case 'lg':
      return 'btn-lg';
    default:
      return '';
  }
});
</script>

<template>
  <button
    :class="['btn btn-ghost btn-circle', sizeClass]"
    :aria-label="showDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="handleToggle"
  >
    <i v-if="showDark" class="fas fa-sun" aria-hidden="true"></i>
    <i v-else class="fas fa-moon" aria-hidden="true"></i>
  </button>
</template>
