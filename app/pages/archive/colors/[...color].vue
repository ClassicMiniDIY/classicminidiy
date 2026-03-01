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
    title: $t('pages.archive.subpages.colors_detail.title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: $t('pages.archive.subpages.colors_detail.description'),
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
    ogTitle: $t('pages.archive.subpages.colors_detail.seo.og_title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    ogDescription: $t('pages.archive.subpages.colors_detail.seo.og_description'),
    ogUrl: `classicminidiy.com/archive/colors/${color?.value?.raw.id}`,
    ogImage: shareImage.value,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('pages.archive.subpages.colors_detail.seo.twitter_title_template', {
      name: color.value?.pretty.Name,
      code: color.value?.pretty.Code,
    }),
    twitterDescription: $t('pages.archive.subpages.colors_detail.seo.twitter_description'),
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
          <h1 class="text-3xl font-bold">{{ $t('pages.archive.subpages.colors_detail.hero_title') }}</h1>
        </div>
        <div class="text-sm">
          <ul class="flex items-center gap-2">
            <li>
              <NuxtLink to="/" class="hover:underline">{{
                $t('pages.archive.subpages.colors_detail.breadcrumb.home')
              }}</NuxtLink>
              <span class="mx-2">/</span>
            </li>
            <li>
              <NuxtLink to="/archive/colors" class="hover:underline">{{
                $t('pages.archive.subpages.colors_detail.breadcrumb.colors')
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
                {{ $t('pages.archive.subpages.colors_detail.primary_color_badge') }}
              </UBadge>
              <h3 class="text-5xl font-bold text-primary mb-6">{{ color.pretty.Code }}</h3>
            </div>

            <!-- Color Swatch -->
            <div class="w-full md:w-1/3 lg:w-1/4">
              <figure class="relative aspect-[4/3] rounded-xl overflow-hidden shadow-lg">
                <img
                  v-if="color.raw.hasSwatch && color.raw.imageSwatch"
                  :src="color.raw.imageSwatch"
                  :alt="$t('pages.archive.subpages.colors_detail.alt_text', { name: color.pretty.Name })"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center"
                >
                  <i class="fas fa-paint-roller text-6xl opacity-30"></i>
                </div>
              </figure>
            </div>
          </div>

          <!-- Color Details -->
          <USeparator :label="$t('pages.archive.subpages.colors_detail.details_divider')" class="my-6" />
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{ $t('pages.archive.subpages.colors_detail.stats.years') }}</span>
                <i class="fas fa-calendar-days text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty.Years }">
                {{ color.pretty.Years || $t('pages.archive.subpages.colors_detail.stats.missing') }}
              </div>
            </div>

            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{
                  $t('pages.archive.subpages.colors_detail.stats.short_code')
                }}</span>
                <i class="fas fa-code text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Short Code'] }">
                {{ color.pretty['Short Code'] || $t('pages.archive.subpages.colors_detail.stats.missing') }}
              </div>
            </div>

            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{
                  $t('pages.archive.subpages.colors_detail.stats.ditzler_ppg_code')
                }}</span>
                <i class="fas fa-barcode text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Ditzler PPG Code'] }">
                {{ color.pretty['Ditzler PPG Code'] || $t('pages.archive.subpages.colors_detail.stats.missing') }}
              </div>
            </div>

            <div class="bg-muted rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm opacity-70">{{
                  $t('pages.archive.subpages.colors_detail.stats.dulux_code')
                }}</span>
                <i class="fas fa-barcode text-xl text-primary"></i>
              </div>
              <div class="text-lg font-semibold truncate" :class="{ 'text-error': !color.pretty['Dulux Code'] }">
                {{ color.pretty['Dulux Code'] || $t('pages.archive.subpages.colors_detail.stats.missing') }}
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <USeparator :label="$t('pages.archive.subpages.colors_detail.share_divider')" class="my-6" />
          <div class="flex flex-wrap gap-4 justify-center">
            <UButton @click="copyUrl()" :color="copied ? 'success' : 'primary'">
              <i class="fas fa-link mr-2"></i>
              {{
                copied
                  ? $t('pages.archive.subpages.colors_detail.actions.copied')
                  : $t('pages.archive.subpages.colors_detail.actions.copy_link')
              }}
            </UButton>

            <UButton
              :to="`mailto:?subject=Mini Color Swatch - ${color.pretty.Name} | ${color.pretty.Code}&body=Color%20Name%20-%20${color.pretty.Name}%20%0ABMC%20Code%20-%20${color.pretty.Code}%20%0ADulux%20Code%20-%20${color.pretty['Dulux Code']}%20%0ADitzler%20Code%20-%20${color.pretty['Ditzler PPG Code']}%20`"
              color="secondary"
            >
              <i class="fas fa-envelope mr-2"></i>
              {{ $t('pages.archive.subpages.colors_detail.actions.email') }}
            </UButton>

            <UButton @click="shareColorItem(color.pretty.Name, color.pretty.ID)" color="neutral">
              <i class="fas fa-share-nodes mr-2"></i>
              {{ $t('pages.archive.subpages.colors_detail.actions.share') }}
            </UButton>

            <UButton :to="`/archive/colors/contribute?color=${color.raw.id}`" variant="outline">
              <i class="fas fa-edit mr-2"></i>
              {{ $t('pages.archive.subpages.colors_detail.actions.contribute') }}
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
    "title": "Classic Mini Archive - {colorName}",
    "description": "Details for Classic Mini color {colorName}",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archive",
      "colors": "Colors"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Color Code",
      "year_range": "Year Range",
      "manufacturer": "Manufacturer",
      "hex_color": "Hex Color",
      "description": "Description"
    },
    "actions": {
      "back_to_colors": "Back to Colors",
      "edit_color": "Edit Color"
    },
    "seo": {
      "og_title": "Classic Mini Archive - {colorName}",
      "og_description": "Details for Classic Mini color {colorName}",
      "twitter_title": "Classic Mini Archive - {colorName}",
      "twitter_description": "Details for Classic Mini color {colorName}"
    }
  },
  "de": {
    "title": "Classic Mini Archiv - {colorName}",
    "description": "Details für Classic Mini Farbe {colorName}",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Startseite",
      "archive": "Archiv",
      "colors": "Farben"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Farbcode",
      "year_range": "Jahresbereich",
      "manufacturer": "Hersteller",
      "hex_color": "Hex-Farbe",
      "description": "Beschreibung"
    },
    "actions": {
      "back_to_colors": "Zurück zu Farben",
      "edit_color": "Farbe Bearbeiten"
    },
    "seo": {
      "og_title": "Classic Mini Archiv - {colorName}",
      "og_description": "Details für Classic Mini Farbe {colorName}",
      "twitter_title": "Classic Mini Archiv - {colorName}",
      "twitter_description": "Details für Classic Mini Farbe {colorName}"
    }
  },
  "es": {
    "title": "Archivo Classic Mini - {colorName}",
    "description": "Detalles del color Classic Mini {colorName}",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Inicio",
      "archive": "Archivo",
      "colors": "Colores"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Código de Color",
      "year_range": "Rango de Años",
      "manufacturer": "Fabricante",
      "hex_color": "Color Hexadecimal",
      "description": "Descripción"
    },
    "actions": {
      "back_to_colors": "Volver a Colores",
      "edit_color": "Editar Color"
    },
    "seo": {
      "og_title": "Archivo Classic Mini - {colorName}",
      "og_description": "Detalles del color Classic Mini {colorName}",
      "twitter_title": "Archivo Classic Mini - {colorName}",
      "twitter_description": "Detalles del color Classic Mini {colorName}"
    }
  },
  "fr": {
    "title": "Archives Classic Mini - {colorName}",
    "description": "Détails de la couleur Classic Mini {colorName}",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Accueil",
      "archive": "Archive",
      "colors": "Couleurs"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Code Couleur",
      "year_range": "Plage d'Années",
      "manufacturer": "Fabricant",
      "hex_color": "Couleur Hexadécimale",
      "description": "Description"
    },
    "actions": {
      "back_to_colors": "Retour aux Couleurs",
      "edit_color": "Modifier la Couleur"
    },
    "seo": {
      "og_title": "Archives Classic Mini - {colorName}",
      "og_description": "Détails de la couleur Classic Mini {colorName}",
      "twitter_title": "Archives Classic Mini - {colorName}",
      "twitter_description": "Détails de la couleur Classic Mini {colorName}"
    }
  },
  "it": {
    "title": "Archivio Classic Mini - {colorName}",
    "description": "Dettagli del colore Classic Mini {colorName}",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archivio",
      "colors": "Colori"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Codice Colore",
      "year_range": "Intervallo Anni",
      "manufacturer": "Produttore",
      "hex_color": "Colore Esadecimale",
      "description": "Descrizione"
    },
    "actions": {
      "back_to_colors": "Torna ai Colori",
      "edit_color": "Modifica Colore"
    },
    "seo": {
      "og_title": "Archivio Classic Mini - {colorName}",
      "og_description": "Dettagli del colore Classic Mini {colorName}",
      "twitter_title": "Archivio Classic Mini - {colorName}",
      "twitter_description": "Dettagli del colore Classic Mini {colorName}"
    }
  },
  "pt": {
    "title": "Arquivo Classic Mini - {colorName}",
    "description": "Detalhes da cor Classic Mini {colorName}",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Início",
      "archive": "Arquivo",
      "colors": "Cores"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Código da Cor",
      "year_range": "Faixa de Anos",
      "manufacturer": "Fabricante",
      "hex_color": "Cor Hexadecimal",
      "description": "Descrição"
    },
    "actions": {
      "back_to_colors": "Voltar às Cores",
      "edit_color": "Editar Cor"
    },
    "seo": {
      "og_title": "Arquivo Classic Mini - {colorName}",
      "og_description": "Detalhes da cor Classic Mini {colorName}",
      "twitter_title": "Arquivo Classic Mini - {colorName}",
      "twitter_description": "Detalhes da cor Classic Mini {colorName}"
    }
  },
  "nl": {
    "title": "Classic Mini Archief - {colorName}",
    "description": "Details van Classic Mini kleur {colorName}",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archief",
      "colors": "Kleuren"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Kleurcode",
      "year_range": "Jaarbereik",
      "manufacturer": "Fabrikant",
      "hex_color": "Hex Kleur",
      "description": "Beschrijving"
    },
    "actions": {
      "back_to_colors": "Terug naar Kleuren",
      "edit_color": "Kleur Bewerken"
    },
    "seo": {
      "og_title": "Classic Mini Archief - {colorName}",
      "og_description": "Details van Classic Mini kleur {colorName}",
      "twitter_title": "Classic Mini Archief - {colorName}",
      "twitter_description": "Details van Classic Mini kleur {colorName}"
    }
  },
  "sv": {
    "title": "Classic Mini Arkiv - {colorName}",
    "description": "Detaljer för Classic Mini färg {colorName}",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Hem",
      "archive": "Arkiv",
      "colors": "Färger"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Färgkod",
      "year_range": "Årsintervall",
      "manufacturer": "Tillverkare",
      "hex_color": "Hex Färg",
      "description": "Beskrivning"
    },
    "actions": {
      "back_to_colors": "Tillbaka till Färger",
      "edit_color": "Redigera Färg"
    },
    "seo": {
      "og_title": "Classic Mini Arkiv - {colorName}",
      "og_description": "Detaljer för Classic Mini färg {colorName}",
      "twitter_title": "Classic Mini Arkiv - {colorName}",
      "twitter_description": "Detaljer för Classic Mini färg {colorName}"
    }
  },
  "da": {
    "title": "Classic Mini Arkiv - {colorName}",
    "description": "Detaljer for Classic Mini farve {colorName}",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "colors": "Farver"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Farvekode",
      "year_range": "Årsinterval",
      "manufacturer": "Producent",
      "hex_color": "Hex Farve",
      "description": "Beskrivelse"
    },
    "actions": {
      "back_to_colors": "Tilbage til Farver",
      "edit_color": "Rediger Farve"
    },
    "seo": {
      "og_title": "Classic Mini Arkiv - {colorName}",
      "og_description": "Detaljer for Classic Mini farve {colorName}",
      "twitter_title": "Classic Mini Arkiv - {colorName}",
      "twitter_description": "Detaljer for Classic Mini farve {colorName}"
    }
  },
  "no": {
    "title": "Classic Mini Arkiv - {colorName}",
    "description": "Detaljer for Classic Mini farge {colorName}",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "{colorName}",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "colors": "Farger"
    },
    "main_heading": "{colorName}",
    "color_details": {
      "color_code": "Fargekode",
      "year_range": "Årsperiode",
      "manufacturer": "Produsent",
      "hex_color": "Hex Farge",
      "description": "Beskrivelse"
    },
    "actions": {
      "back_to_colors": "Tilbake til Farger",
      "edit_color": "Rediger Farge"
    },
    "seo": {
      "og_title": "Classic Mini Arkiv - {colorName}",
      "og_description": "Detaljer for Classic Mini farge {colorName}",
      "twitter_title": "Classic Mini Arkiv - {colorName}",
      "twitter_description": "Detaljer for Classic Mini farge {colorName}"
    }
  }
}
</i18n>
