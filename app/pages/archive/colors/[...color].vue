<script lang="ts" setup>
  import { shareColorItem } from '../../../../data/models/helper-utils';
  import type { PrettyColor } from '../../../../data/models/colors';

  const { params } = useRoute();
  const colorId = Array.isArray(params.color) ? params.color[0] : params.color;
  const { getColor } = useColors();
  const { data: color, status } = await useAsyncData(`color-${colorId}`, () => getColor(colorId as string));

  const copied = ref(false);
  const shareImage = ref('');

  watch(color, (newColor) => {
    if (newColor?.raw.hasSwatch && newColor.raw.imageSwatch) {
      shareImage.value = newColor.raw.imageSwatch;
    } else {
      shareImage.value = 'https://classicminidiy.s3.amazonaws.com/misc/noSwatch.jpeg';
    }
  });

  async function copyUrl() {
    const url = `https://classicminidiy.com/archive/colors/${color?.value?.raw.id}`;
    try {
      await navigator.clipboard.writeText(url);
      copied.value = true;
      setTimeout(() => (copied.value = false), 1000);
    } catch ($e) {
      copied.value = false;
    }
  }

  useHead({
    title: $t('title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: $t('description'),
      },
    ],
    link: [
      {
        rel: 'preload',
        href: shareImage.value,
        as: 'image',
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    ogDescription: $t('seo.og_description'),
    ogUrl: `classicminidiy.com/archive/colors/${color?.value?.raw.id}`,
    ogImage: shareImage.value,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: shareImage.value,
  });
</script>

<template>
  <div class="min-h-screen bg-muted">
    <!-- Hero Section -->
    <div class="bg-primary text-primary-content py-8">
      <div class="container mx-auto px-4">
        <div class="flex items-center gap-2 mb-4">
          <i class="fas fa-palette text-3xl"></i>
          <h1 class="text-3xl font-bold">{{ $t('hero_title') }}</h1>
        </div>
        <div class="text-sm">
          <ul class="flex items-center gap-2">
            <li>
              <NuxtLink to="/" class="hover:underline">{{
                $t('breadcrumb.home')
              }}</NuxtLink>
              <span class="mx-2">/</span>
            </li>
            <li>
              <NuxtLink to="/archive/colors" class="hover:underline">{{
                $t('breadcrumb.colors')
              }}</NuxtLink>
              <span class="mx-2">/</span>
            </li>
            <li v-if="color">{{ color.pretty.Name }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <UCard>
        <div v-if="status === 'pending'" class="flex justify-center p-8">
          <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
        </div>

        <div v-else-if="color">
          <!-- Color Header -->
          <div class="flex flex-col md:flex-row gap-6 items-center">
            <!-- Color Info -->
            <div class="flex-1 text-center md:text-left">
              <h2 class="text-3xl font-bold mb-2">{{ color.pretty.Name }}</h2>
              <UBadge size="lg" color="primary" class="mb-4">
                <i class="fas fa-palette mr-1"></i>
                {{ $t('primary_color_badge') }}
              </UBadge>
              <h3 class="text-5xl font-bold text-primary mb-6">{{ color.pretty.Code }}</h3>
            </div>

            <!-- Color Swatch -->
            <div class="w-full md:w-1/3 lg:w-1/4">
              <figure class="relative aspect-[4/3] rounded-xl overflow-hidden shadow-lg">
                <img
                  v-if="color.raw.hasSwatch && color.raw.imageSwatch"
                  :src="color.raw.imageSwatch"
                  :alt="$t('alt_text', { name: color.pretty.Name })"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-linear-to-br from-muted to-muted/50 flex items-center justify-center"
                >
                  <i class="fas fa-paint-roller text-6xl opacity-30"></i>
                </div>
              </figure>
            </div>
          </div>

          <!-- Color Details -->
          <USeparator :label="$t('details_divider')" class="my-6" />
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{ $t('stats.years') }}</span>
                <i class="fas fa-calendar-days text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty.Years }">
                {{ color.pretty.Years || $t('stats.missing') }}
              </div>
            </div>

            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{
                  $t('stats.short_code')
                }}</span>
                <i class="fas fa-code text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Short Code'] }">
                {{ color.pretty['Short Code'] || $t('stats.missing') }}
              </div>
            </div>

            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{
                  $t('stats.ditzler_ppg_code')
                }}</span>
                <i class="fas fa-barcode text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Ditzler PPG Code'] }">
                {{ color.pretty['Ditzler PPG Code'] || $t('stats.missing') }}
              </div>
            </div>

            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{
                  $t('stats.dulux_code')
                }}</span>
                <i class="fas fa-barcode text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Dulux Code'] }">
                {{ color.pretty['Dulux Code'] || $t('stats.missing') }}
              </div>
            </div>
          </div>

          <!-- Community Photos -->
          <template v-if="color.raw.images && color.raw.images.length > 0">
            <USeparator :label="$t('community_photos_divider')" class="my-6" />
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="(photo, idx) in color.raw.images" :key="idx" class="rounded-xl overflow-hidden shadow-md">
                <img
                  :src="photo.url"
                  :alt="`${color.pretty.Name} - ${$t('community_photo_alt', { contributor: photo.contributor || $t('community_photo_anonymous') })}`"
                  loading="lazy"
                  class="w-full aspect-4/3 object-cover"
                />
                <div v-if="photo.contributor" class="p-2 bg-muted text-xs text-center">
                  <i class="fas fa-camera mr-1"></i>
                  {{ $t('community_photo_by', { name: photo.contributor }) }}
                </div>
              </div>
            </div>
          </template>

          <!-- Action Buttons -->
          <USeparator :label="$t('share_divider')" class="my-6" />
          <div class="flex flex-wrap gap-4 justify-center">
            <UButton @click="copyUrl()" :color="copied ? 'success' : 'primary'">
              <i class="fas fa-link mr-2"></i>
              {{
                copied
                  ? $t('actions.copied')
                  : $t('actions.copy_link')
              }}
            </UButton>

            <UButton @click="shareColorItem(color.pretty.Name, color.pretty.ID)" color="neutral">
              <i class="fas fa-share-nodes mr-2"></i>
              {{ $t('actions.share') }}
            </UButton>

            <UButton :to="`/contribute/color?color=${color.raw.id}`" variant="outline">
              <i class="fas fa-edit mr-2"></i>
              {{ $t('actions.contribute') }}
            </UButton>
          </div>
        </div>
      </UCard>
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
    }
  },
  "de": {
    "community_photos_divider": "Community Fotos",
    "community_photo_alt": "Foto beigetragen von {contributor}",
    "community_photo_anonymous": "Anonym",
    "community_photo_by": "Foto von {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini Lackfarben-Details und Codes",
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
    }
  },
  "es": {
    "community_photos_divider": "Fotos de la Comunidad",
    "community_photo_alt": "Foto contribuida por {contributor}",
    "community_photo_anonymous": "An\u00f3nimo",
    "community_photo_by": "Foto de {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Detalles y c\u00f3digos de pintura Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb": {
      "home": "Inicio",
      "colors": "Colores"
    },
    "primary_color_badge": "Color Classic Mini",
    "alt_text": "Muestra de color {name}",
    "details_divider": "Detalles del Color",
    "stats": {
      "years": "A\u00f1os de Uso",
      "missing": "Desconocido",
      "short_code": "C\u00f3digo Corto",
      "ditzler_ppg_code": "C\u00f3digo Ditzler/PPG",
      "dulux_code": "C\u00f3digo Dulux"
    },
    "share_divider": "Compartir y Contribuir",
    "actions": {
      "copy_link": "Copiar Enlace",
      "copied": "\u00a1Copiado!",
      "share": "Compartir",
      "contribute": "Contribuir"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Detalles y c\u00f3digos de pintura Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Detalles y c\u00f3digos de pintura Classic Mini"
    }
  },
  "fr": {
    "community_photos_divider": "Photos de la Communaut\u00e9",
    "community_photo_alt": "Photo contribu\u00e9e par {contributor}",
    "community_photo_anonymous": "Anonyme",
    "community_photo_by": "Photo de {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "D\u00e9tails et codes de peinture Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb": {
      "home": "Accueil",
      "colors": "Couleurs"
    },
    "primary_color_badge": "Couleur Classic Mini",
    "alt_text": "\u00c9chantillon de couleur {name}",
    "details_divider": "D\u00e9tails de la Couleur",
    "stats": {
      "years": "Ann\u00e9es d'Utilisation",
      "missing": "Inconnu",
      "short_code": "Code Court",
      "ditzler_ppg_code": "Code Ditzler/PPG",
      "dulux_code": "Code Dulux"
    },
    "share_divider": "Partager et Contribuer",
    "actions": {
      "copy_link": "Copier le Lien",
      "copied": "Copi\u00e9 !",
      "share": "Partager",
      "contribute": "Contribuer"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "D\u00e9tails et codes de peinture Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "D\u00e9tails et codes de peinture Classic Mini"
    }
  },
  "it": {
    "community_photos_divider": "Foto della Comunit\u00e0",
    "community_photo_alt": "Foto contribuita da {contributor}",
    "community_photo_anonymous": "Anonimo",
    "community_photo_by": "Foto di {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Dettagli e codici di vernice Classic Mini",
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
    }
  },
  "pt": {
    "community_photos_divider": "Fotos da Comunidade",
    "community_photo_alt": "Foto contribu\u00edda por {contributor}",
    "community_photo_anonymous": "An\u00f3nimo",
    "community_photo_by": "Foto de {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Detalhes e c\u00f3digos de tinta Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb": {
      "home": "In\u00edcio",
      "colors": "Cores"
    },
    "primary_color_badge": "Cor Classic Mini",
    "alt_text": "Amostra de cor {name}",
    "details_divider": "Detalhes da Cor",
    "stats": {
      "years": "Anos de Uso",
      "missing": "Desconhecido",
      "short_code": "C\u00f3digo Curto",
      "ditzler_ppg_code": "C\u00f3digo Ditzler/PPG",
      "dulux_code": "C\u00f3digo Dulux"
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
      "og_description": "Detalhes e c\u00f3digos de tinta Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Detalhes e c\u00f3digos de tinta Classic Mini"
    }
  },
  "ru": {
    "community_photos_divider": "\u0424\u043e\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0430",
    "community_photo_alt": "\u0424\u043e\u0442\u043e, \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u043d\u043e\u0435 {contributor}",
    "community_photo_anonymous": "\u0410\u043d\u043e\u043d\u0438\u043c",
    "community_photo_by": "\u0424\u043e\u0442\u043e \u043e\u0442 {name}",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "\u0414\u0435\u0442\u0430\u043b\u0438 \u0438 \u043a\u043e\u0434\u044b \u0446\u0432\u0435\u0442\u0430 \u043a\u0443\u0437\u043e\u0432\u0430 Classic Mini",
    "hero_title": "\u0410\u0440\u0445\u0438\u0432\u044b Classic Mini",
    "breadcrumb": {
      "home": "\u0413\u043b\u0430\u0432\u043d\u0430\u044f",
      "colors": "\u0426\u0432\u0435\u0442\u0430"
    },
    "primary_color_badge": "\u0426\u0432\u0435\u0442 Classic Mini",
    "alt_text": "\u041e\u0431\u0440\u0430\u0437\u0435\u0446 \u0446\u0432\u0435\u0442\u0430 {name}",
    "details_divider": "\u0414\u0435\u0442\u0430\u043b\u0438 \u0446\u0432\u0435\u0442\u0430",
    "stats": {
      "years": "\u0413\u043e\u0434\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f",
      "missing": "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e",
      "short_code": "\u041a\u0440\u0430\u0442\u043a\u0438\u0439 \u043a\u043e\u0434",
      "ditzler_ppg_code": "\u041a\u043e\u0434 Ditzler/PPG",
      "dulux_code": "\u041a\u043e\u0434 Dulux"
    },
    "share_divider": "\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f \u0438 \u0432\u043d\u0435\u0441\u0442\u0438 \u0432\u043a\u043b\u0430\u0434",
    "actions": {
      "copy_link": "\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443",
      "copied": "\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e!",
      "share": "\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f",
      "contribute": "\u0412\u043d\u0435\u0441\u0442\u0438 \u0432\u043a\u043b\u0430\u0434"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "\u0414\u0435\u0442\u0430\u043b\u0438 \u0438 \u043a\u043e\u0434\u044b \u0446\u0432\u0435\u0442\u0430 \u043a\u0443\u0437\u043e\u0432\u0430 Classic Mini",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "\u0414\u0435\u0442\u0430\u043b\u0438 \u0438 \u043a\u043e\u0434\u044b \u0446\u0432\u0435\u0442\u0430 \u043a\u0443\u0437\u043e\u0432\u0430 Classic Mini"
    }
  },
  "ja": {
    "community_photos_divider": "\u30b3\u30df\u30e5\u30cb\u30c6\u30a3\u30d5\u30a9\u30c8",
    "community_photo_alt": "{contributor}\u63d0\u4f9b\u306e\u5199\u771f",
    "community_photo_anonymous": "\u533f\u540d",
    "community_photo_by": "{name}\u306e\u5199\u771f",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini\u30da\u30a4\u30f3\u30c8\u30ab\u30e9\u30fc\u306e\u8a73\u7d30\u3068\u30b3\u30fc\u30c9",
    "hero_title": "Classic Mini\u30a2\u30fc\u30ab\u30a4\u30d6",
    "breadcrumb": {
      "home": "\u30db\u30fc\u30e0",
      "colors": "\u30ab\u30e9\u30fc"
    },
    "primary_color_badge": "Classic Mini\u30ab\u30e9\u30fc",
    "alt_text": "{name}\u30ab\u30e9\u30fc\u30b5\u30f3\u30d7\u30eb",
    "details_divider": "\u30ab\u30e9\u30fc\u8a73\u7d30",
    "stats": {
      "years": "\u4f7f\u7528\u5e74\u6570",
      "missing": "\u4e0d\u660e",
      "short_code": "\u30b7\u30e7\u30fc\u30c8\u30b3\u30fc\u30c9",
      "ditzler_ppg_code": "Ditzler/PPG\u30b3\u30fc\u30c9",
      "dulux_code": "Dulux\u30b3\u30fc\u30c9"
    },
    "share_divider": "\u30b7\u30a7\u30a2\u30fb\u8c37\u63f4",
    "actions": {
      "copy_link": "\u30ea\u30f3\u30af\u3092\u30b3\u30d4\u30fc",
      "copied": "\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f\uff01",
      "share": "\u30b7\u30a7\u30a2",
      "contribute": "\u8c37\u63f4\u3059\u308b"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Mini\u30da\u30a4\u30f3\u30c8\u30ab\u30e9\u30fc\u306e\u8a73\u7d30\u3068\u30b3\u30fc\u30c9",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Mini\u30da\u30a4\u30f3\u30c8\u30ab\u30e9\u30fc\u306e\u8a73\u7d30\u3068\u30b3\u30fc\u30c9"
    }
  },
  "zh": {
    "community_photos_divider": "\u793e\u533a\u7167\u7247",
    "community_photo_alt": "{contributor}\u63d0\u4f9b\u7684\u7167\u7247",
    "community_photo_anonymous": "\u533f\u540d",
    "community_photo_by": "{name}\u7684\u7167\u7247",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini\u6c46\u6f06\u989c\u8272\u8be6\u60c5\u548c\u4ee3\u7801",
    "hero_title": "Classic Mini\u6863\u6848\u9986",
    "breadcrumb": {
      "home": "\u9996\u9875",
      "colors": "\u989c\u8272"
    },
    "primary_color_badge": "Classic Mini\u989c\u8272",
    "alt_text": "{name}\u989c\u8272\u8272\u5361",
    "details_divider": "\u989c\u8272\u8be6\u60c5",
    "stats": {
      "years": "\u4f7f\u7528\u5e74\u4efd",
      "missing": "\u672a\u77e5",
      "short_code": "\u77ed\u4ee3\u7801",
      "ditzler_ppg_code": "Ditzler/PPG\u4ee3\u7801",
      "dulux_code": "Dulux\u4ee3\u7801"
    },
    "share_divider": "\u5206\u4eab\u4e0e\u8d21\u732e",
    "actions": {
      "copy_link": "\u590d\u5236\u94fe\u63a5",
      "copied": "\u5df2\u590d\u5236\uff01",
      "share": "\u5206\u4eab",
      "contribute": "\u8d21\u732e"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Mini\u6c46\u6f06\u989c\u8272\u8be6\u60c5\u548c\u4ee3\u7801",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Mini\u6c46\u6f06\u989c\u8272\u8be6\u60c5\u548c\u4ee3\u7801"
    }
  },
  "ko": {
    "community_photos_divider": "\ucee4\ubba4\ub2c8\ud2f0 \uc0ac\uc9c4",
    "community_photo_alt": "{contributor}\uc774(\uac00) \uc81c\uacf5\ud55c \uc0ac\uc9c4",
    "community_photo_anonymous": "\uc775\uba85",
    "community_photo_by": "{name}\uc758 \uc0ac\uc9c4",
    "title_template": "{name} - {code} | Classic Mini DIY",
    "description": "Classic Mini \ub3c4\ub8cc \uc0c9\uc0c1 \uc138\ubd80 \uc815\ubcf4 \ubc0f \ucf54\ub4dc",
    "hero_title": "Classic Mini \uc544\uce74\uc774\ube0c",
    "breadcrumb": {
      "home": "\ud648",
      "colors": "\uc0c9\uc0c1"
    },
    "primary_color_badge": "Classic Mini \uc0c9\uc0c1",
    "alt_text": "{name} \uc0c9\uc0c1 \uc0d8\ud50c",
    "details_divider": "\uc0c9\uc0c1 \uc138\ubd80 \uc815\ubcf4",
    "stats": {
      "years": "\uc0ac\uc6a9 \uc5f0\ub3c4",
      "missing": "\uc54c \uc218 \uc5c6\uc74c",
      "short_code": "\ub2e8\ucd95 \ucf54\ub4dc",
      "ditzler_ppg_code": "Ditzler/PPG \ucf54\ub4dc",
      "dulux_code": "Dulux \ucf54\ub4dc"
    },
    "share_divider": "\uacf5\uc720 \ubc0f \uae30\uc5ec",
    "actions": {
      "copy_link": "\ub9c1\ud06c \ubcf5\uc0ac",
      "copied": "\ubcf5\uc0ac\ub428!",
      "share": "\uacf5\uc720",
      "contribute": "\uae30\uc5ec\ud558\uae30"
    },
    "seo": {
      "og_title_template": "{name} - {code} | Classic Mini DIY",
      "og_description": "Classic Mini \ub3c4\ub8cc \uc0c9\uc0c1 \uc138\ubd80 \uc815\ubcf4 \ubc0f \ucf54\ub4dc",
      "twitter_title_template": "{name} - {code} | Classic Mini DIY",
      "twitter_description": "Classic Mini \ub3c4\ub8cc \uc0c9\uc0c1 \uc138\ubd80 \uc815\ubcf4 \ubc0f \ucf54\ub4dc"
    }
  }
}
</i18n>
