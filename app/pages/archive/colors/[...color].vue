<script lang="ts" setup>
  import { shareColorItem } from '../../../../data/models/helper-utils';
  import type { PrettyColor } from '../../../../data/models/colors';
  import type { ModelVariantCard } from '~~/data/models/variants';

  const { t } = useI18n();
  const { track } = useAnalytics();
  const { params } = useRoute();
  const colorId = Array.isArray(params.color) ? params.color[0] : params.color;
  const { getColor } = useColors();
  const { data: color, status } = await useAsyncData(`color-${colorId}`, () => getColor(colorId as string));

  // Same soft-404 as the wheel detail page: the template has no v-else after
  // `v-else-if="color"`, so an unresolvable id rendered an empty shell with a 200.
  // Every id the colors re-seed regenerated lands here, so answer with a real 404.
  if (!color.value) {
    throw createError({ statusCode: 404, statusMessage: 'Color not found', fatal: true });
  }

  // Model variants this colour was offered on (model_variant_colors.color_id).
  // Non-blocking: a failure leaves the block out rather than failing the page.
  const { data: offeredOn } = await useFetch<{ variants: ModelVariantCard[] }>('/api/archive/variants', {
    key: `color-variants-${colorId}`,
    query: { color: colorId },
    default: () => ({ variants: [] }),
  });
  const offeredOnVariants = computed(() => offeredOn.value?.variants ?? []);

  const copied = ref(false);
  // Computed (not ref + watch) so the value is populated during SSR — a lazy
  // watch never fires server-side, which left og:image/twitter:image as '' and
  // crashed nuxt-og-image's tags:afterResolve hook (unhead coerces '' to true).
  const shareImage = computed(() => {
    if (color.value?.raw.hasSwatch && color.value.raw.imageSwatch) {
      return color.value.raw.imageSwatch;
    }
    return 'https://classicminidiy.s3.amazonaws.com/misc/noSwatch.jpeg';
  });

  async function copyUrl() {
    const url = `https://www.classicminidiy.com/archive/colors/${color?.value?.raw.id}`;
    try {
      await navigator.clipboard.writeText(url);
      copied.value = true;
      setTimeout(() => (copied.value = false), 1000);
      track('color_link_copied', { color_id: color?.value?.raw.id, color_name: color?.value?.pretty.Name });
    } catch ($e) {
      copied.value = false;
    }
  }

  function shareColor() {
    const c = color?.value;
    if (!c) return;
    shareColorItem(c.pretty.Name, c.pretty.ID);
    const method = typeof navigator !== 'undefined' && navigator.share ? 'web_share' : 'clipboard';
    track('color_shared', { color_id: c.raw.id, method });
  }

  useHead({
    title: t('title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: t('description'),
      },
    ],
    link: [
      {
        rel: 'preload',
        href: shareImage,
        as: 'image',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('seo.og_title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    ogDescription: t('seo.og_description'),
    ogUrl: `classicminidiy.com/archive/colors/${color?.value?.raw.id}`,
    ogImage: shareImage,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: shareImage,
  });
</script>

<template>
  <div class="min-h-screen bg-muted">
    <!-- Hero Section -->
    <div class="bg-primary text-primary-content py-8">
      <div class="container mx-auto px-4">
        <div class="flex items-center gap-2 mb-4">
          <i class="fas fa-palette text-3xl"></i>
          <PageIntro :eyebrow="t('eyebrow')" :title="t('hero_title')" :description="t('description')" />
        </div>
        <div class="text-sm">
          <ul class="flex items-center gap-2">
            <li>
              <NuxtLink to="/" class="hover:underline">{{ t('breadcrumb.home') }}</NuxtLink>
              <span class="mx-2">/</span>
            </li>
            <li>
              <NuxtLink to="/archive/colors" class="hover:underline">{{ t('breadcrumb.colors') }}</NuxtLink>
              <span class="mx-2">/</span>
            </li>
            <li v-if="color">{{ color.pretty.Name }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <div v-if="status === 'pending'" class="flex justify-center p-8">
            <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
          </div>

          <div v-else-if="color">
            <!-- Color Header -->
            <div class="flex flex-col md:flex-row gap-6 items-center">
              <!-- Color Info -->
              <div class="flex-1 text-center md:text-left">
                <h2 class="text-3xl font-bold mb-2">{{ color.pretty.Name }}</h2>
                <span class="badge badge-primary badge-lg mb-4">
                  <i class="fas fa-palette mr-1"></i>
                  {{ t('primary_color_badge') }}
                </span>
                <h3 class="text-5xl font-bold text-primary mb-6">{{ color.pretty.Code }}</h3>
              </div>

              <!-- Color Swatch -->
              <div class="w-full md:w-1/3 lg:w-1/4">
                <figure class="relative aspect-[4/3] rounded-xl overflow-hidden shadow-lg">
                  <img
                    v-if="color.raw.hasSwatch && color.raw.imageSwatch"
                    :src="color.raw.imageSwatch"
                    :alt="t('alt_text', { name: color.pretty.Name })"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full bg-linear-to-br from-base-200 to-base-200/50 flex items-center justify-center"
                  >
                    <i class="fas fa-paint-roller text-6xl opacity-30"></i>
                  </div>
                </figure>
              </div>
            </div>

            <!-- Color Details -->
            <div class="divider my-6">{{ t('details_divider') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-base-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm opacity-70">{{ t('stats.years') }}</span>
                  <i class="fas fa-calendar-days text-xl text-primary"></i>
                </div>
                <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty.Years }">
                  {{ color.pretty.Years || t('stats.missing') }}
                </div>
              </div>

              <div class="bg-base-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm opacity-70">{{ t('stats.short_code') }}</span>
                  <i class="fas fa-code text-xl text-primary"></i>
                </div>
                <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Short Code'] }">
                  {{ color.pretty['Short Code'] || t('stats.missing') }}
                </div>
              </div>

              <div class="bg-base-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm opacity-70">{{ t('stats.ditzler_ppg_code') }}</span>
                  <i class="fas fa-barcode text-xl text-primary"></i>
                </div>
                <div
                  class="text-lg font-semibold truncate"
                  :class="{ 'text-error': !color.pretty['Ditzler PPG Code'] }"
                >
                  {{ color.pretty['Ditzler PPG Code'] || t('stats.missing') }}
                </div>
              </div>

              <div class="bg-base-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm opacity-70">{{ t('stats.dulux_code') }}</span>
                  <i class="fas fa-barcode text-xl text-primary"></i>
                </div>
                <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Dulux Code'] }">
                  {{ color.pretty['Dulux Code'] || t('stats.missing') }}
                </div>
              </div>
            </div>

            <!-- Community Photos -->
            <template v-if="color.raw.images && color.raw.images.length > 0">
              <div class="divider my-6">{{ t('community_photos_divider') }}</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div v-for="(photo, idx) in color.raw.images" :key="idx" class="rounded-xl overflow-hidden shadow-md">
                  <img
                    :src="photo.url"
                    :alt="`${color.pretty.Name} - ${t('community_photo_alt', { contributor: photo.contributor || t('community_photo_anonymous') })}`"
                    loading="lazy"
                    class="w-full aspect-4/3 object-cover"
                  />
                  <div v-if="photo.contributor" class="p-2 bg-base-200 text-xs text-center">
                    <i class="fas fa-camera mr-1"></i>
                    {{ t('community_photo_by', { name: photo.contributor }) }}
                  </div>
                </div>
              </div>
            </template>

            <!-- Model variants offered in this colour -->
            <template v-if="offeredOnVariants.length">
              <div class="divider my-6">{{ t('offered_on_divider') }}</div>
              <div class="flex flex-wrap gap-2 justify-center">
                <NuxtLink
                  v-for="v in offeredOnVariants"
                  :key="v.slug"
                  :to="`/archive/variants/${v.slug}`"
                  class="badge badge-outline badge-lg gap-1 hover:badge-primary"
                >
                  <i class="fas fa-car-side text-xs" aria-hidden="true"></i>{{ v.name }}
                  <span v-if="v.year_start" class="opacity-60">{{ v.year_start }}</span>
                </NuxtLink>
              </div>
            </template>

            <!-- Action Buttons -->
            <div class="divider my-6">{{ t('share_divider') }}</div>
            <div class="flex flex-wrap gap-4 justify-center">
              <button type="button" class="btn" :class="copied ? 'btn-success' : 'btn-primary'" @click="copyUrl()">
                <i class="fas fa-link mr-2"></i>
                {{ copied ? t('actions.copied') : t('actions.copy_link') }}
              </button>

              <button type="button" class="btn btn-neutral" @click="shareColor">
                <i class="fas fa-share-nodes mr-2"></i>
                {{ t('actions.share') }}
              </button>

              <NuxtLink
                :to="`/contribute/color?color=${color.raw.id}`"
                class="btn btn-outline"
                @click="track('contribute_cta_clicked', { type: 'color', location: 'color_detail' })"
              >
                <i class="fas fa-edit mr-2"></i>
                {{ t('actions.contribute') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  figure {
    transition: transform 0.3s ease;
  }

  figure:hover {
    transform: translateY(-4px);
  }
</style>

<i18n lang="json">
{
  "en": {
    "community_photos_divider": "Community Photos",
    "community_photo_alt": "Photo contributed by {contributor}",
    "community_photo_anonymous": "Anonymous",
    "community_photo_by": "Photo by {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini paint color details and codes",
    "eyebrow": "COLOR LIBRARY",
    "hero_title": "Classic Mini Archives",
    "breadcrumb": {
      "home": "Home",
      "colors": "Colors"
    },
    "primary_color_badge": "Classic Mini Color",
    "alt_text": "{name} color swatch",
    "details_divider": "Color Details",
    "stats": {
      "years": "Years Used",
      "missing": "Unknown",
      "short_code": "Short Code",
      "ditzler_ppg_code": "Ditzler/PPG Code",
      "dulux_code": "Dulux Code"
    },
    "share_divider": "Share & Contribute",
    "actions": {
      "copy_link": "Copy Link",
      "copied": "Copied!",
      "share": "Share",
      "contribute": "Contribute"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Mini paint color details and codes",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Mini paint color details and codes"
    },
    "offered_on_divider": "Factory colour on"
  },
  "de": {
    "community_photos_divider": "Community Fotos",
    "community_photo_alt": "Foto beigetragen von {contributor}",
    "community_photo_anonymous": "Anonym",
    "community_photo_by": "Foto von {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini Lackfarben-Details und Codes",
    "eyebrow": "FARB-BIBLIOTHEK",
    "hero_title": "Classic Mini Archive",
    "breadcrumb": {
      "home": "Startseite",
      "colors": "Farben"
    },
    "primary_color_badge": "Classic Mini Farbe",
    "alt_text": "{name} Farbmuster",
    "details_divider": "Farbdetails",
    "stats": {
      "years": "Verwendete Jahre",
      "missing": "Unbekannt",
      "short_code": "Kurzcode",
      "ditzler_ppg_code": "Ditzler/PPG Code",
      "dulux_code": "Dulux Code"
    },
    "share_divider": "Teilen & Beitragen",
    "actions": {
      "copy_link": "Link Kopieren",
      "copied": "Kopiert!",
      "share": "Teilen",
      "contribute": "Beitragen"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Mini Lackfarben-Details und Codes",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Mini Lackfarben-Details und Codes"
    },
    "offered_on_divider": "Werksfarbe bei"
  },
  "es": {
    "community_photos_divider": "Fotos de la Comunidad",
    "community_photo_alt": "Foto contribuida por {contributor}",
    "community_photo_anonymous": "Anónimo",
    "community_photo_by": "Foto de {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Detalles y códigos de pintura Classic Mini",
    "eyebrow": "BIBLIOTECA DE COLORES",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb": {
      "home": "Inicio",
      "colors": "Colores"
    },
    "primary_color_badge": "Color Classic Mini",
    "alt_text": "Muestra de color {name}",
    "details_divider": "Detalles del Color",
    "stats": {
      "years": "Años de Uso",
      "missing": "Desconocido",
      "short_code": "Código Corto",
      "ditzler_ppg_code": "Código Ditzler/PPG",
      "dulux_code": "Código Dulux"
    },
    "share_divider": "Compartir y Contribuir",
    "actions": {
      "copy_link": "Copiar Enlace",
      "copied": "¡Copiado!",
      "share": "Compartir",
      "contribute": "Contribuir"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Detalles y códigos de pintura Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Detalles y códigos de pintura Classic Mini"
    },
    "offered_on_divider": "Color de fábrica en"
  },
  "fr": {
    "community_photos_divider": "Photos de la Communauté",
    "community_photo_alt": "Photo contribuée par {contributor}",
    "community_photo_anonymous": "Anonyme",
    "community_photo_by": "Photo de {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Détails et codes de peinture Classic Mini",
    "eyebrow": "BIBLIOTHÈQUE DE COULEURS",
    "hero_title": "Archives Classic Mini",
    "breadcrumb": {
      "home": "Accueil",
      "colors": "Couleurs"
    },
    "primary_color_badge": "Couleur Classic Mini",
    "alt_text": "Échantillon de couleur {name}",
    "details_divider": "Détails de la Couleur",
    "stats": {
      "years": "Années d'Utilisation",
      "missing": "Inconnu",
      "short_code": "Code Court",
      "ditzler_ppg_code": "Code Ditzler/PPG",
      "dulux_code": "Code Dulux"
    },
    "share_divider": "Partager et Contribuer",
    "actions": {
      "copy_link": "Copier le Lien",
      "copied": "Copié !",
      "share": "Partager",
      "contribute": "Contribuer"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Détails et codes de peinture Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Détails et codes de peinture Classic Mini"
    },
    "offered_on_divider": "Couleur d'usine sur"
  },
  "it": {
    "community_photos_divider": "Foto della Comunità",
    "community_photo_alt": "Foto contribuita da {contributor}",
    "community_photo_anonymous": "Anonimo",
    "community_photo_by": "Foto di {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Dettagli e codici di vernice Classic Mini",
    "eyebrow": "LIBRERIA COLORI",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb": {
      "home": "Home",
      "colors": "Colori"
    },
    "primary_color_badge": "Colore Classic Mini",
    "alt_text": "Campione di colore {name}",
    "details_divider": "Dettagli del Colore",
    "stats": {
      "years": "Anni di Utilizzo",
      "missing": "Sconosciuto",
      "short_code": "Codice Breve",
      "ditzler_ppg_code": "Codice Ditzler/PPG",
      "dulux_code": "Codice Dulux"
    },
    "share_divider": "Condividi e Contribuisci",
    "actions": {
      "copy_link": "Copia Link",
      "copied": "Copiato!",
      "share": "Condividi",
      "contribute": "Contribuisci"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Dettagli e codici di vernice Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Dettagli e codici di vernice Classic Mini"
    },
    "offered_on_divider": "Colore di fabbrica su"
  },
  "pt": {
    "community_photos_divider": "Fotos da Comunidade",
    "community_photo_alt": "Foto contribuída por {contributor}",
    "community_photo_anonymous": "Anónimo",
    "community_photo_by": "Foto de {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Detalhes e códigos de tinta Classic Mini",
    "eyebrow": "BIBLIOTECA DE CORES",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb": {
      "home": "Início",
      "colors": "Cores"
    },
    "primary_color_badge": "Cor Classic Mini",
    "alt_text": "Amostra de cor {name}",
    "details_divider": "Detalhes da Cor",
    "stats": {
      "years": "Anos de Uso",
      "missing": "Desconhecido",
      "short_code": "Código Curto",
      "ditzler_ppg_code": "Código Ditzler/PPG",
      "dulux_code": "Código Dulux"
    },
    "share_divider": "Compartilhar e Contribuir",
    "actions": {
      "copy_link": "Copiar Link",
      "copied": "Copiado!",
      "share": "Compartilhar",
      "contribute": "Contribuir"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Detalhes e códigos de tinta Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Detalhes e códigos de tinta Classic Mini"
    },
    "offered_on_divider": "Cor de fábrica em"
  },
  "ru": {
    "community_photos_divider": "Фото сообщества",
    "community_photo_alt": "Фото, предоставленное {contributor}",
    "community_photo_anonymous": "Аноним",
    "community_photo_by": "Фото от {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Детали и коды цвета кузова Classic Mini",
    "eyebrow": "БИБЛИОТЕКА ЦВЕТОВ",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb": {
      "home": "Главная",
      "colors": "Цвета"
    },
    "primary_color_badge": "Цвет Classic Mini",
    "alt_text": "Образец цвета {name}",
    "details_divider": "Детали цвета",
    "stats": {
      "years": "Годы использования",
      "missing": "Неизвестно",
      "short_code": "Краткий код",
      "ditzler_ppg_code": "Код Ditzler/PPG",
      "dulux_code": "Код Dulux"
    },
    "share_divider": "Поделиться и внести вклад",
    "actions": {
      "copy_link": "Копировать ссылку",
      "copied": "Скопировано!",
      "share": "Поделиться",
      "contribute": "Внести вклад"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Детали и коды цвета кузова Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Детали и коды цвета кузова Classic Mini"
    },
    "offered_on_divider": "Заводской цвет на"
  },
  "ja": {
    "community_photos_divider": "コミュニティフォト",
    "community_photo_alt": "{contributor}提供の写真",
    "community_photo_anonymous": "匿名",
    "community_photo_by": "{name}の写真",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Miniペイントカラーの詳細とコード",
    "eyebrow": "カラーライブラリ",
    "hero_title": "Classic Miniアーカイブ",
    "breadcrumb": {
      "home": "ホーム",
      "colors": "カラー"
    },
    "primary_color_badge": "Classic Miniカラー",
    "alt_text": "{name}カラーサンプル",
    "details_divider": "カラー詳細",
    "stats": {
      "years": "使用年数",
      "missing": "不明",
      "short_code": "ショートコード",
      "ditzler_ppg_code": "Ditzler/PPGコード",
      "dulux_code": "Duluxコード"
    },
    "share_divider": "シェア・谷援",
    "actions": {
      "copy_link": "リンクをコピー",
      "copied": "コピーしました！",
      "share": "シェア",
      "contribute": "谷援する"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Miniペイントカラーの詳細とコード",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Miniペイントカラーの詳細とコード"
    },
    "offered_on_divider": "この工場カラーの採用車種"
  },
  "zh": {
    "community_photos_divider": "社区照片",
    "community_photo_alt": "{contributor}提供的照片",
    "community_photo_anonymous": "匿名",
    "community_photo_by": "{name}的照片",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini汆漆颜色详情和代码",
    "eyebrow": "颜色库",
    "hero_title": "Classic Mini档案馆",
    "breadcrumb": {
      "home": "首页",
      "colors": "颜色"
    },
    "primary_color_badge": "Classic Mini颜色",
    "alt_text": "{name}颜色色卡",
    "details_divider": "颜色详情",
    "stats": {
      "years": "使用年份",
      "missing": "未知",
      "short_code": "短代码",
      "ditzler_ppg_code": "Ditzler/PPG代码",
      "dulux_code": "Dulux代码"
    },
    "share_divider": "分享与贡献",
    "actions": {
      "copy_link": "复制链接",
      "copied": "已复制！",
      "share": "分享",
      "contribute": "贡献"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Mini汆漆颜色详情和代码",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Mini汆漆颜色详情和代码"
    },
    "offered_on_divider": "采用此原厂颜色的车型"
  },
  "ko": {
    "community_photos_divider": "커뮤니티 사진",
    "community_photo_alt": "{contributor}이(가) 제공한 사진",
    "community_photo_anonymous": "익명",
    "community_photo_by": "{name}의 사진",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini 도료 색상 세부 정보 및 코드",
    "eyebrow": "색상 라이브러리",
    "hero_title": "Classic Mini 아카이브",
    "breadcrumb": {
      "home": "홈",
      "colors": "색상"
    },
    "primary_color_badge": "Classic Mini 색상",
    "alt_text": "{name} 색상 샘플",
    "details_divider": "색상 세부 정보",
    "stats": {
      "years": "사용 연도",
      "missing": "알 수 없음",
      "short_code": "단축 코드",
      "ditzler_ppg_code": "Ditzler/PPG 코드",
      "dulux_code": "Dulux 코드"
    },
    "share_divider": "공유 및 기여",
    "actions": {
      "copy_link": "링크 복사",
      "copied": "복사됨!",
      "share": "공유",
      "contribute": "기여하기"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Mini 도료 색상 세부 정보 및 코드",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Mini 도료 색상 세부 정보 및 코드"
    },
    "offered_on_divider": "이 공장 색상이 적용된 모델"
  }
}
</i18n>
