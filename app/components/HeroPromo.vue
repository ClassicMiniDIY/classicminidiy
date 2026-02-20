<script setup lang="ts">
  import { DateTime } from 'luxon';
  import { HERO_TYPES } from '../../data/models/generic';

  interface Promotion {
    id: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaUrl: string;
    backgroundImage: string;
    expiresAt: string;
    external?: boolean;
  }

  const promotions: Promotion[] = [
    {
      id: 'mini-exchange-launch',
      title: 'The Mini Exchange is Live!',
      subtitle: 'Buy and sell Classic Minis on the brand new marketplace from Classic Mini DIY',
      ctaText: 'Visit The Mini Exchange',
      ctaUrl: 'https://theminiexchange.com',
      backgroundImage: 'https://classicminidiy.s3.amazonaws.com/misc/promo-mini-exchange.webp',
      expiresAt: '2027-01-01',
      external: true,
    },
    {
      id: 'turbo-engine-giveaway',
      title: 'Win a Turbocharged A-Series Engine',
      subtitle: 'Enter the Classic Mini DIY giveaway — drawing March 6th!',
      ctaText: 'Enter the Giveaway',
      ctaUrl: 'https://raffall.com/404519/enter-raffle-to-win-turbocharged-classic-mini-a-series-engine-hosted-by-cole-gentry',
      backgroundImage: 'https://classicminidiy.s3.amazonaws.com/misc/promo-engine-giveaway.webp',
      expiresAt: '2026-03-06',
      external: true,
    },
  ];

  const today = DateTime.now();
  const activePromos = promotions.filter((p) => DateTime.fromISO(p.expiresAt) > today);

  // Default to first promo during SSR, randomize starting index on client
  const currentIndex = ref(0);
  const selectedPromo = computed(() => (activePromos.length > 0 ? activePromos[currentIndex.value] : null));

  let autoRotateInterval: ReturnType<typeof setInterval> | null = null;
  const AUTO_ROTATE_MS = 6000;

  const goToPromo = (index: number) => {
    currentIndex.value = index;
    resetAutoRotate();
  };

  const nextPromo = () => {
    currentIndex.value = (currentIndex.value + 1) % activePromos.length;
  };

  const prevPromo = () => {
    currentIndex.value = (currentIndex.value - 1 + activePromos.length) % activePromos.length;
  };

  const resetAutoRotate = () => {
    if (autoRotateInterval) clearInterval(autoRotateInterval);
    if (activePromos.length > 1) {
      autoRotateInterval = setInterval(nextPromo, AUTO_ROTATE_MS);
    }
  };

  onMounted(() => {
    if (activePromos.length > 1) {
      // Randomize starting slide on client
      currentIndex.value = Math.floor(Math.random() * activePromos.length);
      autoRotateInterval = setInterval(nextPromo, AUTO_ROTATE_MS);
    }
  });

  onUnmounted(() => {
    if (autoRotateInterval) clearInterval(autoRotateInterval);
  });

  const promoStyle = computed(() =>
    selectedPromo.value
      ? {
          backgroundImage: `url(${selectedPromo.value.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : {},
  );
</script>

<template>
  <!-- Active promo: render as hero-sized banner -->
  <section
    v-if="selectedPromo"
    class="hero-section flex bg-[#242424] md:h-144 sm:h-96"
    :style="promoStyle"
  >
    <div class="hero-content flex flex-col items-start justify-center w-full">
      <div class="pl-20">
        <p class="text-white text-sm uppercase tracking-wide">
          {{ selectedPromo.subtitle }}
        </p>
        <h1 class="fancy-font-bold text-white text-4xl lg:text-5xl mt-2 special-title">
          {{ selectedPromo.title }}
        </h1>
        <UButton
          :to="selectedPromo.ctaUrl"
          :target="selectedPromo.external ? '_blank' : undefined"
          :external="selectedPromo.external"
          color="primary"
          size="lg"
          class="mt-6"
        >
          {{ selectedPromo.ctaText }}
          <i v-if="selectedPromo.external" class="fas fa-external-link-alt ml-2 text-sm"></i>
        </UButton>

        <!-- Dot indicators + nav when multiple promos are active -->
        <div v-if="activePromos.length > 1" class="flex items-center gap-3 mt-6">
          <button
            class="text-white/60 hover:text-white transition-colors"
            aria-label="Previous promotion"
            @click="prevPromo"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
          <button
            v-for="(promo, index) in activePromos"
            :key="promo.id"
            class="w-2.5 h-2.5 rounded-full transition-colors cursor-pointer"
            :class="promo.id === selectedPromo?.id ? 'bg-white' : 'bg-white/40 hover:bg-white/60'"
            :aria-label="`Go to promotion ${index + 1}`"
            @click="goToPromo(index)"
          />
          <button
            class="text-white/60 hover:text-white transition-colors"
            aria-label="Next promotion"
            @click="nextPromo"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- No active promos: fall back to original hero -->
  <hero
    v-else
    :titleKey="'home_title'"
    :subtitleKey="'home_subtitle'"
    :special="true"
    :heroType="HERO_TYPES.HOME"
    :background="'/backdrop2'"
  />
</template>

<style lang="scss" scoped>
  .hero-section {
    .special-title {
      font-size: 100px;
    }

    @media screen and (max-width: 1023px) {
      .special-title {
        font-size: 2rem;
      }
    }
  }
</style>
