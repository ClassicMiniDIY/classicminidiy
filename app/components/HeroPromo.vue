<script setup lang="ts">
  import { DateTime } from 'luxon';
  import { HERO_TYPES } from '../../data/models/generic';

  const { t } = useI18n();

  // Master switch for the hero promo carousel.
  // Flip to `true` to re-enable rotating banners — all promo data,
  // analytics, auto-rotate, and dot-indicator code below stays intact
  // and untouched. When false, the home hero falls back to the static
  // car-photo <hero> with the YOUR FRIENDLY NEIGHBORHOOD eyebrow.
  const ENABLE_PROMOS = false;

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
  // When the feature flag is off, treat the active list as empty so the
  // template falls through to the static <hero>. All downstream code
  // (auto-rotate, analytics, dot indicators) becomes a no-op naturally.
  const activePromos = ENABLE_PROMOS
    ? promotions.filter((p) => DateTime.fromISO(p.expiresAt) > today)
    : [];

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
    :aria-label="t('aria.carousel')"
  >
    <!-- Mosaic background -->
    <div v-if="selectedPromo.mosaicImages?.length" class="absolute inset-0 mosaic-grid">
      <img
        v-for="(src, i) in selectedPromo.mosaicImages"
        :key="src"
        :src="src"
        :alt="t('aria.screenshot', { n: i + 1 })"
        class="w-full h-full object-cover object-top"
        width="240"
        height="520"
        loading="eager"
        :fetchpriority="i === 0 ? 'high' : undefined"
      />
    </div>
    <div class="absolute inset-0 bg-black/60"></div>
    <div class="hero-content relative flex flex-col items-start justify-center w-full">
      <div class="px-6 sm:px-12 md:pl-20 py-10">
        <p class="eyebrow">
          {{ selectedPromo.subtitle }}
        </p>
        <h1 class="fancy-font-bold text-white text-4xl lg:text-5xl mt-2 special-title">
          {{ selectedPromo.title }}
        </h1>
        <!-- Multiple CTAs (e.g. App Store + Google Play) -->
        <div v-if="selectedPromo.secondaryCtas?.length" class="flex flex-col sm:flex-row gap-3 mt-6">
          <NuxtLink
            v-for="cta in selectedPromo.secondaryCtas"
            :key="cta.url"
            :to="cta.url"
            target="_blank"
            external
            class="btn btn-primary btn-lg"
            @click="capture('promo_cta_clicked', { promo_id: selectedPromo.id, cta_url: cta.url })"
          >
            <i v-if="cta.icon" :class="cta.icon" class="text-xl mr-2"></i>
            {{ cta.text }}
          </NuxtLink>
        </div>

        <!-- Single CTA -->
        <NuxtLink
          v-else-if="selectedPromo.ctaUrl"
          :to="selectedPromo.ctaUrl"
          :target="selectedPromo.external ? '_blank' : undefined"
          :external="selectedPromo.external"
          class="btn btn-secondary btn-lg mt-6"
          @click="capture('promo_cta_clicked', { promo_id: selectedPromo.id, cta_url: selectedPromo.ctaUrl })"
        >
          {{ selectedPromo.ctaText }}
          <i v-if="selectedPromo.external" class="fas fa-external-link-alt ml-2 text-sm"></i>
        </NuxtLink>

        <!-- Dot indicators + nav when multiple promos are active -->
        <div v-if="activePromos.length > 1" class="flex items-center gap-3 mt-6">
          <button
            class="text-white/60 hover:text-white transition-colors"
            :aria-label="t('aria.previous')"
            @click="handlePrevClick"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
          <button
            v-for="(promo, index) in activePromos"
            :key="promo.id"
            class="w-2.5 h-2.5 rounded-full transition-colors cursor-pointer"
            :class="promo.id === selectedPromo?.id ? 'bg-white' : 'bg-white/40 hover:bg-white/60'"
            :aria-label="t('aria.go_to', { n: index + 1 })"
            @click="goToPromo(index)"
          />
          <button
            class="text-white/60 hover:text-white transition-colors"
            :aria-label="t('aria.next')"
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

<i18n lang="json">
{
  "en": {
    "aria": {
      "carousel": "Promotions",
      "screenshot": "App screenshot {n}",
      "previous": "Previous promotion",
      "next": "Next promotion",
      "go_to": "Go to promotion {n}"
    }
  },
  "es": {
    "aria": {
      "carousel": "Promociones",
      "screenshot": "Captura de pantalla {n}",
      "previous": "Promoción anterior",
      "next": "Promoción siguiente",
      "go_to": "Ir a la promoción {n}"
    }
  },
  "fr": {
    "aria": {
      "carousel": "Promotions",
      "screenshot": "Capture d'écran {n}",
      "previous": "Promotion précédente",
      "next": "Promotion suivante",
      "go_to": "Aller à la promotion {n}"
    }
  },
  "de": {
    "aria": {
      "carousel": "Aktionen",
      "screenshot": "App-Screenshot {n}",
      "previous": "Vorherige Aktion",
      "next": "Nächste Aktion",
      "go_to": "Zur Aktion {n}"
    }
  },
  "it": {
    "aria": {
      "carousel": "Promozioni",
      "screenshot": "Schermata {n}",
      "previous": "Promozione precedente",
      "next": "Promozione successiva",
      "go_to": "Vai alla promozione {n}"
    }
  },
  "pt": {
    "aria": {
      "carousel": "Promoções",
      "screenshot": "Captura de tela {n}",
      "previous": "Promoção anterior",
      "next": "Próxima promoção",
      "go_to": "Ir para promoção {n}"
    }
  },
  "ru": {
    "aria": {
      "carousel": "Промоакции",
      "screenshot": "Скриншот приложения {n}",
      "previous": "Предыдущая промоакция",
      "next": "Следующая промоакция",
      "go_to": "Перейти к промоакции {n}"
    }
  },
  "ja": {
    "aria": {
      "carousel": "プロモーション",
      "screenshot": "アプリのスクリーンショット {n}",
      "previous": "前のプロモーション",
      "next": "次のプロモーション",
      "go_to": "プロモーション {n} へ"
    }
  },
  "zh": {
    "aria": {
      "carousel": "促销活动",
      "screenshot": "应用截图 {n}",
      "previous": "上一个促销",
      "next": "下一个促销",
      "go_to": "前往促销 {n}"
    }
  },
  "ko": {
    "aria": {
      "carousel": "프로모션",
      "screenshot": "앱 스크린샷 {n}",
      "previous": "이전 프로모션",
      "next": "다음 프로모션",
      "go_to": "프로모션 {n}으로 이동"
    }
  }
}
</i18n>
