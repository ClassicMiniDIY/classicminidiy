<script setup lang="ts">
  import { getAllCountriesWithFlags } from '~/utils/countryFlags';

  // Shuffle array (Fisher-Yates)
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // All countries, randomized once per page load
  const items = useState('flag-marquee-items', () => shuffle(getAllCountriesWithFlags()));

  // Dynamic duration so scroll speed stays consistent regardless of item count
  const animationDuration = computed(() => `${items.value.length * 2}s`);
</script>

<template>
  <section class="relative overflow-hidden bg-base-200/50 border-b border-base-300 py-3">
    <!-- Gradient fades -->
    <div
      class="absolute left-0 top-0 bottom-0 w-16 sm:w-24 z-10 bg-linear-to-r from-base-200/50 to-transparent pointer-events-none"
    />
    <div
      class="absolute right-0 top-0 bottom-0 w-16 sm:w-24 z-10 bg-linear-to-l from-base-200/50 to-transparent pointer-events-none"
    />

    <!-- Scrolling row -->
    <div class="flex gap-6 animate-marquee">
      <!-- First set -->
      <div
        v-for="(item, index) in items"
        :key="`a-${index}`"
        class="flex items-center gap-1.5 shrink-0 text-sm text-base-content/70"
      >
        <span class="text-base">{{ item.flag }}</span>
        <span>{{ item.name }}</span>
      </div>
      <!-- Duplicate set for seamless loop -->
      <div
        v-for="(item, index) in items"
        :key="`b-${index}`"
        class="flex items-center gap-1.5 shrink-0 text-sm text-base-content/70"
      >
        <span class="text-base">{{ item.flag }}</span>
        <span>{{ item.name }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
  @keyframes marquee {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .animate-marquee {
    animation: marquee v-bind(animationDuration) linear infinite;
  }
</style>
