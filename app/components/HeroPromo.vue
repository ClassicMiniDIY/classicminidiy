<script setup lang="ts">
  import { DateTime } from 'luxon';
  import { HERO_TYPES } from '../../data/models/generic';

  interface PromoCta {
    text: string;
    url: string;
    icon?: string;
  }

  interface Promotion {
    id: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaUrl: string;
    backgroundImage: string;
    expiresAt: string;
    external?: boolean;
    secondaryCtas?: PromoCta[];
    mosaicImages?: string[];
  }

  const promotions: Promotion[] = [
    {
      id: 'mini-exchange-launch',
      title: 'The Mini Exchange is Live!',
      subtitle: 'Buy and sell Classic Minis on the brand new marketplace from Classic Mini DIY',
      ctaText: 'Visit The Mini Exchange',
      ctaUrl: 'https://theminiexchange.com',
      backgroundImage: '/hero-promos/og-image.jpg',
      expiresAt: '2027-01-01',
      external: true,
    },
    {
      id: 'classic-mini-toolbox-app',
      title: 'Classic Mini Toolbox App is Here!',
      subtitle: 'Take your favorite Classic Mini tools on the go — free on iOS and Android',
      ctaText: '',
      ctaUrl: '',
      backgroundImage: '',
      mosaicImages: [
        '/app-promo/screenshot-home.jpeg',
        '/app-promo/screenshot-maintenance.jpeg',
        '/app-promo/screenshot-torque.jpeg',
        '/app-promo/screenshot-needles.jpeg',
        '/app-promo/screenshot-gearbox.jpeg',
        '/app-promo/screenshot-compression.jpeg',
      ],
      expiresAt: '2027-01-01',
      external: true,
      secondaryCtas: [
        {
          text: 'Download on App Store',
          url: 'https://apps.apple.com/us/app/classic-mini-toolbox-cmdiy/id6751475172',
          icon: 'fab fa-apple',
        },
        {
          text: 'Get it on Google Play',
          url: 'https://play.google.com/store/apps/details?id=com.classicminidiy.toolbox',
          icon: 'fab fa-google-play',
        },
      ],
    },
  ];

  const { capture } = usePostHog();

  const today = DateTime.now();
  const activePromos = promotions.filter((p) => DateTime.fromISO(p.expiresAt) > today);

  // Default to first promo during SSR, randomize starting index on client
  const currentIndex = ref(0);
  const selectedPromo = computed(() => (activePromos.length > 0 ? activePromos[currentIndex.value] : null));

  let autoRotateInterval: ReturnType<typeof setInterval> | null = null;
  const AUTO_ROTATE_MS = 10000;

  const trackSlideChange = (promoId: string, method: 'dot' | 'arrow' | 'auto') => {
    capture('promo_slide_changed', { promo_id: promoId, method });
  };

  const goToPromo = (index: number) => {
    currentIndex.value = index;
    trackSlideChange(activePromos[index].id, 'dot');
    resetAutoRotate();
  };

  const nextPromo = (manual = false) => {
    currentIndex.value = (currentIndex.value + 1) % activePromos.length;
    trackSlideChange(activePromos[currentIndex.value].id, manual ? 'arrow' : 'auto');
  };

  const prevPromo = () => {
    currentIndex.value = (currentIndex.value - 1 + activePromos.length) % activePromos.length;
    trackSlideChange(activePromos[currentIndex.value].id, 'arrow');
  };

  const resetAutoRotate = () => {
    if (autoRotateInterval) clearInterval(autoRotateInterval);
    if (activePromos.length > 1) {
      autoRotateInterval = setInterval(() => nextPromo(), AUTO_ROTATE_MS);
    }
  };

  const handlePrevClick = () => {
    prevPromo();
    resetAutoRotate();
  };

  const handleNextClick = () => {
    nextPromo(true);
    resetAutoRotate();
  };

  onMounted(() => {
    if (activePromos.length > 1) {
      // Randomize starting slide on client
      currentIndex.value = Math.floor(Math.random() * activePromos.length);
      resetAutoRotate();
    }
    if (selectedPromo.value) {
      capture('promo_viewed', { promo_id: selectedPromo.value.id, total_active: activePromos.length });
    }
  });

  onUnmounted(() => {
    if (autoRotateInterval) clearInterval(autoRotateInterval);
  });

  const promoStyle = computed(() =>
    selectedPromo.value && !selectedPromo.value.mosaicImages?.length
      ? {
          backgroundImage: `url(${selectedPromo.value.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : {}
  );
</script>

<template>
  <!-- Active promo: render as hero-sized banner -->
  <section
    v-if="selectedPromo"
    class="hero-section relative flex bg-[#242424] min-h-80 sm:min-h-96 md:min-h-144"
    :style="promoStyle"
    role="region"
    aria-roledescription="carousel"
    aria-label="Promotions"
  >
    <!-- Mosaic background -->
    <div v-if="selectedPromo.mosaicImages?.length" class="absolute inset-0 mosaic-grid">
      <img
        v-for="(src, i) in selectedPromo.mosaicImages"
        :key="src"
        :src="src"
        :alt="`App screenshot ${i + 1}`"
        class="w-full h-full object-cover object-top"
        width="240"
        height="520"
        :loading="i < 3 ? 'eager' : 'lazy'"
        :fetchpriority="i === 0 ? 'high' : undefined"
      />
    </div>
    <div class="absolute inset-0 bg-black/60"></div>
    <div class="hero-content relative flex flex-col items-start justify-center w-full">
      <div class="px-6 sm:px-12 md:pl-20 py-10">
        <p class="text-white text-sm uppercase tracking-wide">
          {{ selectedPromo.subtitle }}
        </p>
        <h1 class="fancy-font-bold text-white text-4xl lg:text-5xl mt-2 special-title">
          {{ selectedPromo.title }}
        </h1>
        <!-- Multiple CTAs (e.g. App Store + Google Play) -->
        <div v-if="selectedPromo.secondaryCtas?.length" class="flex flex-col sm:flex-row gap-3 mt-6">
          <UButton
            v-for="cta in selectedPromo.secondaryCtas"
            :key="cta.url"
            :to="cta.url"
            target="_blank"
            external
            color="primary"
            size="lg"
            @click="capture('promo_cta_clicked', { promo_id: selectedPromo.id, cta_url: cta.url })"
          >
            <i v-if="cta.icon" :class="cta.icon" class="text-xl mr-2"></i>
            {{ cta.text }}
          </UButton>
        </div>

        <!-- Single CTA -->
        <UButton
          v-else-if="selectedPromo.ctaUrl"
          :to="selectedPromo.ctaUrl"
          :target="selectedPromo.external ? '_blank' : undefined"
          :external="selectedPromo.external"
          color="secondary"
          size="lg"
          class="mt-6"
          @click="capture('promo_cta_clicked', { promo_id: selectedPromo.id, cta_url: selectedPromo.ctaUrl })"
        >
          {{ selectedPromo.ctaText }}
          <i v-if="selectedPromo.external" class="fas fa-external-link-alt ml-2 text-sm"></i>
        </UButton>

        <!-- Dot indicators + nav when multiple promos are active -->
        <div v-if="activePromos.length > 1" class="flex items-center gap-3 mt-6">
          <button
            class="text-white/60 hover:text-white transition-colors"
            aria-label="Previous promotion"
            @click="handlePrevClick"
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
            @click="handleNextClick"
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

  .mosaic-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0;
    overflow: hidden;

    @media screen and (max-width: 767px) {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
