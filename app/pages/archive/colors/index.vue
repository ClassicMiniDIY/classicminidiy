<script lang="ts" setup>
  import type { Color } from '../../../../data/models/colors';
  import { HERO_TYPES } from '../../../../data/models/generic';

  const { listColors } = useColors();
  const { data: colors, status } = await useAsyncData('colors-list', () => listColors());
  const pending = computed(() => status.value === 'pending');
  const search = ref('');
  const debouncedSearch = ref('');
  const currentPage = ref(1);
  const itemsPerPage = 24;

  // Debounce search input for better performance
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  watch(search, (newValue) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      debouncedSearch.value = newValue;
    }, 300);
  });

  onUnmounted(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
  });

  // Build all images for a color (swatch + community photos) for carousel
  const getColorImages = (color: Color): string[] => {
    const images: string[] = [];
    if (color.hasSwatch && color.imageSwatch) images.push(color.imageSwatch);
    if (color.images?.length) {
      for (const img of color.images) {
        if (img.url) images.push(img.url);
      }
    }
    return images;
  };

  const filteredColors = computed(() => {
    if (!colors.value) return [];
    if (!debouncedSearch.value.trim()) return colors.value;

    const searchTerm = debouncedSearch.value.toLowerCase().trim();
    return colors.value.filter(
      (color) =>
        (color.name?.toLowerCase() || '').includes(searchTerm) ||
        (color.shortCode?.toLowerCase() || '').includes(searchTerm) ||
        (color.code?.toLowerCase() || '').includes(searchTerm) ||
        (color.ditzlerPpgCode?.toLowerCase() || '').includes(searchTerm) ||
        (color.duluxCode?.toLowerCase() || '').includes(searchTerm)
    );
  });

  const paginatedColors = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredColors.value.slice(start, start + itemsPerPage);
  });

  const totalPages = computed(() => {
    return Math.ceil(filteredColors.value.length / itemsPerPage);
  });

  const shareColor = (color: Color) => {
    const url = `${window.location.origin}/archive/colors/${color.id}`;

    if (navigator.share) {
      navigator
        .share({
          title: `${$t('share.title')} ${color.name || $t('states.unnamed_color')}`,
          text: `${$t('share.text')} ${color.name || $t('states.unnamed_color')}`,
          url,
        })
        .catch(() => {
          // User cancelled or share failed - silently handle
        });
    } else {
      navigator.clipboard.writeText(url);
      alert($t('states.link_copied'));
    }
  };

  // Reset to first page when debounced search changes
  watch(debouncedSearch, () => {
    currentPage.value = 1;
  });

  useHead({
    title: $t('title'),
    meta: [
      {
        name: 'description',
        content: $t('description'),
      },
      {
        name: 'keywords',
        content: $t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/archive/colors',
      },
    ],
  });

  // Dataset structured data for colors database
  const colorsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Classic Mini Paint Color Database',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/colors',
    keywords: ['Classic Mini colors', 'paint codes', 'BMC colors', 'Mini Cooper paint'],
    creator: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
    license: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    isAccessibleForFree: true,
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'BMC Code',
        description: 'British Motor Corporation paint code',
      },
      {
        '@type': 'PropertyValue',
        name: 'Ditzler/PPG Code',
        description: 'Ditzler or PPG paint matching code',
      },
    ],
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(colorsJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/colors',
    ogType: 'website',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
  });
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4 pb-15">
    <!-- Breadcrumb -->
    <!-- Header -->
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :page="$t('breadcrumb_title')"></breadcrumb>

        <!-- Contribute Banner -->
        <UCard class="mb-6 bg-primary/5">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <i class="fad fa-hand-holding-heart text-xl text-primary"></i>
              <div>
                <p class="font-medium">{{ $t('contribute_banner_title') }}</p>
                <p class="text-sm opacity-70">{{ $t('contribute_banner_description') }}</p>
              </div>
            </div>
            <UButton to="/contribute/color" color="primary" variant="outline" size="sm">
              {{ $t('contribute_banner_button') }}
            </UButton>
          </div>
        </UCard>

        <h1 class="text-3xl font-bold">{{ $t('main_heading') }}</h1>
        <h2 class="text-xl mt-4">
          <strong>{{ colors?.length || '0' }}</strong>
          {{ $t('subtitle') }}
        </h2>
        <p class="my-4">
          {{ $t('description_text') }}
          <a href="http://mini-colours.co.uk" class="text-primary hover:underline">{{ $t('partner_link') }}</a>
          {{ $t('description_text_2') }}
        </p>
      </div>
      <div class="col-span-12">
        <USeparator class="my-4" />
      </div>

      <!-- Search -->
      <div class="col-span-12">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div class="flex items-center gap-2">
            <i class="fas fa-tire fa-spin text-primary text-2xl"></i>
            <h2 class="text-2xl font-semibold">{{ $t('search.card_title') }}</h2>
          </div>
          <div class="w-full md:w-96">
            <UInput
              v-model="search"
              type="text"
              :placeholder="$t('search.placeholder')"
              :aria-label="$t('search.placeholder')"
              icon="i-fa6-solid-magnifying-glass"
              class="w-full"
            />
          </div>
        </div>
        <p class="text-base mb-6">
          {{ $t('search.help_text') }}
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="col-span-12">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div v-for="i in 8" :key="'skeleton-' + i" class="card bg-base-100 shadow-sm">
            <figure class="aspect-4/3">
              <USkeleton class="w-full h-full" />
            </figure>
            <div class="card-body p-4">
              <USkeleton class="h-5 w-3/4" />
              <USkeleton class="h-4 w-1/2 mt-2" />
              <USkeleton class="h-4 w-2/3 mt-1" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!filteredColors.length" class="col-span-12">
        <UAlert color="info" icon="i-fa6-solid-circle-info" :title="$t('states.no_colors')" />
      </div>

      <!-- Color Cards Grid -->
      <div v-else class="col-span-12">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="color in paginatedColors"
            :key="color.id"
            :to="'/archive/colors/' + color.id"
            class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow group"
          >
            <!-- Image / Carousel -->
            <figure class="aspect-4/3 bg-muted overflow-hidden relative">
              <template v-if="getColorImages(color).length > 1">
                <div class="carousel w-full h-full" @click.stop>
                  <div
                    v-for="(img, idx) in getColorImages(color)"
                    :key="idx"
                    :id="`color-${color.id}-slide-${idx}`"
                    class="carousel-item w-full h-full"
                  >
                    <img
                      :src="img"
                      :alt="`${color.name || 'Color'} - image ${idx + 1}`"
                      loading="lazy"
                      class="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div class="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  <a
                    v-for="(img, idx) in getColorImages(color)"
                    :key="'dot-' + idx"
                    :href="`#color-${color.id}-slide-${idx}`"
                    class="w-2 h-2 rounded-full bg-base-100/60 hover:bg-base-100"
                    @click.stop.prevent="
                      $event.currentTarget?.closest('.carousel')
                        ?.querySelector(`#color-${color.id}-slide-${idx}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
                    "
                  ></a>
                </div>
              </template>
              <img
                v-else-if="getColorImages(color).length === 1"
                :src="getColorImages(color)[0]"
                :alt="`${color.name || 'Color'} swatch`"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <i class="fas fa-paint-roller text-4xl opacity-20"></i>
              </div>
            </figure>

            <!-- Card Body -->
            <div class="card-body p-4">
              <h3 class="card-title text-base">
                {{ color.name || $t('states.unnamed_color') }}
              </h3>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <UBadge v-if="color.code && color.code !== 'Unknown'" color="primary" variant="soft" size="xs">
                  {{ color.code }}
                </UBadge>
                <UBadge v-if="color.shortCode && color.shortCode !== 'Unknown'" color="neutral" variant="soft" size="xs">
                  {{ color.shortCode }}
                </UBadge>
              </div>
              <div class="text-xs text-muted mt-2 space-y-0.5">
                <p v-if="color.years && color.years !== 'Unknown'">
                  <i class="fas fa-calendar-days mr-1"></i>
                  {{ Array.isArray(color.years) ? color.years.join(', ') : color.years }}
                </p>
                <p v-if="color.ditzlerPpgCode && color.ditzlerPpgCode !== 'Unknown'">
                  <i class="fas fa-barcode mr-1"></i>
                  PPG: {{ color.ditzlerPpgCode }}
                </p>
              </div>
            </div>
          </NuxtLink>
        </div>

        <!-- Pagination -->
        <div v-if="filteredColors.length > itemsPerPage" class="flex justify-center mt-8">
          <div class="inline-flex rounded-md shadow-sm">
            <UButton
              :disabled="currentPage === 1"
              @click="currentPage = Math.max(1, currentPage - 1)"
              variant="outline"
              class="rounded-r-none"
            >
              «
            </UButton>
            <UButton variant="outline" class="rounded-none border-x-0" disabled>
              {{ $t('pagination.page') }} {{ currentPage }} {{ $t('pagination.of') }} {{ totalPages }}
            </UButton>
            <UButton
              :disabled="currentPage >= totalPages"
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
              variant="outline"
              class="rounded-l-none"
            >
              »
            </UButton>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Color Picker",
    "description": "Find the perfect color for your Classic Mini with our comprehensive color picker.",
    "keywords": "Classic Mini colors, Mini Cooper paint codes, BMC color codes, Ditzler PPG codes, Dulux paint codes, vintage Mini colors, paint color database",
    "hero_title": "Color Picker",
    "breadcrumb_title": "Color Swatches",
    "main_heading": "Classic Mini Color Picker",
    "subtitle": "colors in our database",
    "description_text": "In an effort to make more information available, Classic Mini DIY has partnered with",
    "description_text_2": "to provide you with a comprehensive list of the colors used on the Classic Mini throughout the years.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "Find your Color",
      "placeholder": "Search colors...",
      "help_text": "Use the search above to filter colors by name, code, or paint reference. Notice some data missing? Click a color to view details and contribute!"
    },
    "states": {
      "no_colors": "No colors found matching your search.",
      "unnamed_color": "Unnamed Color",
      "missing": "Missing",
      "link_copied": "Link copied to clipboard!"
    },
    "pagination": {
      "page": "Page",
      "of": "of"
    },
    "share": {
      "title": "Classic Mini Color:",
      "text": "Check out this Classic Mini color:"
    },
    "contribute_banner_title": "Know something we're missing?",
    "contribute_banner_description": "Help grow the archive with your knowledge.",
    "contribute_banner_button": "Contribute",
    "seo": {
      "og_title": "Classic Mini Color Picker | Classic Mini DIY",
      "og_description": "Find the perfect color for your Classic Mini with our comprehensive color picker and paint code reference.",
      "twitter_title": "Classic Mini Color Picker | Classic Mini DIY",
      "twitter_description": "Find the perfect color for your Classic Mini with our comprehensive color picker and paint code reference."
    }
  },
  "es": {
    "title": "Selector de Color",
    "description": "Encuentra el color perfecto para tu Classic Mini con nuestro completo selector de colores.",
    "keywords": "colores Classic Mini, códigos de pintura Mini Cooper, códigos de color BMC, códigos Ditzler PPG, códigos Dulux, colores Mini vintage, base de datos de colores de pintura",
    "hero_title": "Selector de Color",
    "breadcrumb_title": "Muestras de Color",
    "main_heading": "Selector de Color Classic Mini",
    "subtitle": "colores en nuestra base de datos",
    "description_text": "En un esfuerzo por hacer más información disponible, Classic Mini DIY se ha asociado con",
    "description_text_2": "para ofrecerte una lista completa de los colores utilizados en el Classic Mini a lo largo de los años.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "Encuentra tu Color",
      "placeholder": "Buscar colores...",
      "help_text": "Usa la búsqueda para filtrar colores por nombre, código o referencia de pintura. ¿Notas que falta algún dato? ¡Haz clic en un color para ver los detalles y contribuir!"
    },
    "states": {
      "no_colors": "No se encontraron colores que coincidan con tu búsqueda.",
      "unnamed_color": "Color sin nombre",
      "missing": "Faltante",
      "link_copied": "¡Enlace copiado al portapapeles!"
    },
    "pagination": {
      "page": "Página",
      "of": "de"
    },
    "share": {
      "title": "Color Classic Mini:",
      "text": "Mira este color del Classic Mini:"
    },
    "contribute_banner_title": "¿Sabes algo que nos falta?",
    "contribute_banner_description": "Ayuda a ampliar el archivo con tu conocimiento.",
    "contribute_banner_button": "Contribuir",
    "seo": {
      "og_title": "Selector de Color Classic Mini | Classic Mini DIY",
      "og_description": "Encuentra el color perfecto para tu Classic Mini con nuestro completo selector de colores y referencia de códigos de pintura.",
      "twitter_title": "Selector de Color Classic Mini | Classic Mini DIY",
      "twitter_description": "Encuentra el color perfecto para tu Classic Mini con nuestro completo selector de colores y referencia de códigos de pintura."
    }
  },
  "fr": {
    "title": "Sélecteur de Couleur",
    "description": "Trouvez la couleur parfaite pour votre Classic Mini avec notre sélecteur de couleurs complet.",
    "keywords": "couleurs Classic Mini, codes peinture Mini Cooper, codes couleur BMC, codes Ditzler PPG, codes Dulux, couleurs Mini vintage, base de données couleurs peinture",
    "hero_title": "Sélecteur de Couleur",
    "breadcrumb_title": "Échantillons de Couleur",
    "main_heading": "Sélecteur de Couleur Classic Mini",
    "subtitle": "couleurs dans notre base de données",
    "description_text": "Dans un effort pour rendre plus d'informations disponibles, Classic Mini DIY s'est associé à",
    "description_text_2": "pour vous fournir une liste complète des couleurs utilisées sur la Classic Mini au fil des années.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "Trouvez votre Couleur",
      "placeholder": "Rechercher des couleurs...",
      "help_text": "Utilisez la recherche ci-dessus pour filtrer les couleurs par nom, code ou référence de peinture. Vous remarquez des données manquantes ? Cliquez sur une couleur pour voir les détails et contribuer !"
    },
    "states": {
      "no_colors": "Aucune couleur trouvée correspondant à votre recherche.",
      "unnamed_color": "Couleur sans nom",
      "missing": "Manquant",
      "link_copied": "Lien copié dans le presse-papiers !"
    },
    "pagination": {
      "page": "Page",
      "of": "sur"
    },
    "share": {
      "title": "Couleur Classic Mini :",
      "text": "Découvrez cette couleur Classic Mini :"
    },
    "contribute_banner_title": "Vous savez quelque chose qui nous manque ?",
    "contribute_banner_description": "Aidez à enrichir l'archive avec vos connaissances.",
    "contribute_banner_button": "Contribuer",
    "seo": {
      "og_title": "Sélecteur de Couleur Classic Mini | Classic Mini DIY",
      "og_description": "Trouvez la couleur parfaite pour votre Classic Mini avec notre sélecteur de couleurs complet et la référence des codes peinture.",
      "twitter_title": "Sélecteur de Couleur Classic Mini | Classic Mini DIY",
      "twitter_description": "Trouvez la couleur parfaite pour votre Classic Mini avec notre sélecteur de couleurs complet et la référence des codes peinture."
    }
  },
  "it": {
    "title": "Selettore Colore",
    "description": "Trova il colore perfetto per la tua Classic Mini con il nostro selettore colori completo.",
    "keywords": "colori Classic Mini, codici vernice Mini Cooper, codici colore BMC, codici Ditzler PPG, codici Dulux, colori Mini vintage, database colori vernice",
    "hero_title": "Selettore Colore",
    "breadcrumb_title": "Campioni di Colore",
    "main_heading": "Selettore Colore Classic Mini",
    "subtitle": "colori nel nostro database",
    "description_text": "Nel tentativo di rendere disponibili più informazioni, Classic Mini DIY ha collaborato con",
    "description_text_2": "per fornirti un elenco completo dei colori utilizzati sulla Classic Mini nel corso degli anni.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "Trova il tuo Colore",
      "placeholder": "Cerca colori...",
      "help_text": "Usa la ricerca qui sopra per filtrare i colori per nome, codice o riferimento vernice. Noti qualche dato mancante? Clicca su un colore per vedere i dettagli e contribuire!"
    },
    "states": {
      "no_colors": "Nessun colore trovato corrispondente alla tua ricerca.",
      "unnamed_color": "Colore senza nome",
      "missing": "Mancante",
      "link_copied": "Link copiato negli appunti!"
    },
    "pagination": {
      "page": "Pagina",
      "of": "di"
    },
    "share": {
      "title": "Colore Classic Mini:",
      "text": "Guarda questo colore Classic Mini:"
    },
    "contribute_banner_title": "Sai qualcosa che ci manca?",
    "contribute_banner_description": "Aiuta ad arricchire l'archivio con le tue conoscenze.",
    "contribute_banner_button": "Contribuisci",
    "seo": {
      "og_title": "Selettore Colore Classic Mini | Classic Mini DIY",
      "og_description": "Trova il colore perfetto per la tua Classic Mini con il nostro selettore colori completo e la guida ai codici vernice.",
      "twitter_title": "Selettore Colore Classic Mini | Classic Mini DIY",
      "twitter_description": "Trova il colore perfetto per la tua Classic Mini con il nostro selettore colori completo e la guida ai codici vernice."
    }
  },
  "de": {
    "title": "Farbauswahl",
    "description": "Finden Sie die perfekte Farbe für Ihren Classic Mini mit unserem umfassenden Farbwähler.",
    "keywords": "Classic Mini Farben, Mini Cooper Lackcodes, BMC Farbcodes, Ditzler PPG Codes, Dulux Lackcodes, Oldtimer Mini Farben, Lackfarben-Datenbank",
    "hero_title": "Farbauswahl",
    "breadcrumb_title": "Farbmuster",
    "main_heading": "Classic Mini Farbauswahl",
    "subtitle": "Farben in unserer Datenbank",
    "description_text": "Um mehr Informationen bereitzustellen, hat Classic Mini DIY eine Partnerschaft mit",
    "description_text_2": "geschlossen, um Ihnen eine umfassende Liste der Farben zu bieten, die im Laufe der Jahre am Classic Mini verwendet wurden.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "Ihre Farbe finden",
      "placeholder": "Farben suchen...",
      "help_text": "Nutzen Sie die Suche, um Farben nach Name, Code oder Lackreferenz zu filtern. Fehlen Ihnen Daten? Klicken Sie auf eine Farbe, um Details anzuzeigen und beizutragen!"
    },
    "states": {
      "no_colors": "Keine Farben gefunden, die Ihrer Suche entsprechen.",
      "unnamed_color": "Unbenannte Farbe",
      "missing": "Fehlend",
      "link_copied": "Link in die Zwischenablage kopiert!"
    },
    "pagination": {
      "page": "Seite",
      "of": "von"
    },
    "share": {
      "title": "Classic Mini Farbe:",
      "text": "Schau dir diese Classic Mini Farbe an:"
    },
    "contribute_banner_title": "Wissen Sie etwas, das uns fehlt?",
    "contribute_banner_description": "Helfen Sie, das Archiv mit Ihrem Wissen zu erweitern.",
    "contribute_banner_button": "Beitragen",
    "seo": {
      "og_title": "Classic Mini Farbauswahl | Classic Mini DIY",
      "og_description": "Finden Sie die perfekte Farbe für Ihren Classic Mini mit unserem umfassenden Farbwähler und der Lackcodes-Referenz.",
      "twitter_title": "Classic Mini Farbauswahl | Classic Mini DIY",
      "twitter_description": "Finden Sie die perfekte Farbe für Ihren Classic Mini mit unserem umfassenden Farbwähler und der Lackcodes-Referenz."
    }
  },
  "pt": {
    "title": "Seletor de Cor",
    "description": "Encontre a cor perfeita para o seu Classic Mini com o nosso seletor de cores abrangente.",
    "keywords": "cores Classic Mini, códigos de tinta Mini Cooper, códigos de cor BMC, códigos Ditzler PPG, códigos Dulux, cores Mini vintage, banco de dados de cores de tinta",
    "hero_title": "Seletor de Cor",
    "breadcrumb_title": "Amostras de Cor",
    "main_heading": "Seletor de Cor Classic Mini",
    "subtitle": "cores na nossa base de dados",
    "description_text": "Num esforço para disponibilizar mais informação, o Classic Mini DIY estabeleceu uma parceria com",
    "description_text_2": "para fornecer uma lista abrangente das cores utilizadas no Classic Mini ao longo dos anos.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "Encontre a sua Cor",
      "placeholder": "Pesquisar cores...",
      "help_text": "Use a pesquisa acima para filtrar cores por nome, código ou referência de tinta. Notou algum dado em falta? Clique numa cor para ver os detalhes e contribuir!"
    },
    "states": {
      "no_colors": "Nenhuma cor encontrada que corresponda à sua pesquisa.",
      "unnamed_color": "Cor sem nome",
      "missing": "Em falta",
      "link_copied": "Link copiado para a área de transferência!"
    },
    "pagination": {
      "page": "Página",
      "of": "de"
    },
    "share": {
      "title": "Cor Classic Mini:",
      "text": "Veja esta cor do Classic Mini:"
    },
    "contribute_banner_title": "Sabe algo que nos falta?",
    "contribute_banner_description": "Ajude a expandir o arquivo com o seu conhecimento.",
    "contribute_banner_button": "Contribuir",
    "seo": {
      "og_title": "Seletor de Cor Classic Mini | Classic Mini DIY",
      "og_description": "Encontre a cor perfeita para o seu Classic Mini com o nosso seletor de cores abrangente e referência de códigos de tinta.",
      "twitter_title": "Seletor de Cor Classic Mini | Classic Mini DIY",
      "twitter_description": "Encontre a cor perfeita para o seu Classic Mini com o nosso seletor de cores abrangente e referência de códigos de tinta."
    }
  },
  "ru": {
    "title": "Выбор цвета",
    "description": "Найдите идеальный цвет для вашего Classic Mini с нашим полным подборщиком цветов.",
    "keywords": "цвета Classic Mini, коды краски Mini Cooper, коды цветов BMC, коды Ditzler PPG, коды Dulux, цвета ретро Mini, база данных цветов краски",
    "hero_title": "Выбор цвета",
    "breadcrumb_title": "Образцы цветов",
    "main_heading": "Подборщик цветов Classic Mini",
    "subtitle": "цветов в нашей базе данных",
    "description_text": "Стремясь сделать больше информации доступной, Classic Mini DIY наладил партнёрство с",
    "description_text_2": "чтобы предоставить вам исчерпывающий список цветов, использовавшихся на Classic Mini на протяжении многих лет.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "Найдите свой цвет",
      "placeholder": "Поиск цветов...",
      "help_text": "Используйте поиск выше для фильтрации цветов по названию, коду или артикулу краски. Заметили отсутствующие данные? Нажмите на цвет, чтобы просмотреть детали и внести вклад!"
    },
    "states": {
      "no_colors": "Цвета, соответствующие вашему запросу, не найдены.",
      "unnamed_color": "Цвет без названия",
      "missing": "Отсутствует",
      "link_copied": "Ссылка скопирована в буфер обмена!"
    },
    "pagination": {
      "page": "Страница",
      "of": "из"
    },
    "share": {
      "title": "Цвет Classic Mini:",
      "text": "Посмотрите этот цвет Classic Mini:"
    },
    "contribute_banner_title": "Знаете что-то, чего нам не хватает?",
    "contribute_banner_description": "Помогите пополнить архив своими знаниями.",
    "contribute_banner_button": "Внести вклад",
    "seo": {
      "og_title": "Подборщик цветов Classic Mini | Classic Mini DIY",
      "og_description": "Найдите идеальный цвет для вашего Classic Mini с нашим полным подборщиком цветов и справочником кодов краски.",
      "twitter_title": "Подборщик цветов Classic Mini | Classic Mini DIY",
      "twitter_description": "Найдите идеальный цвет для вашего Classic Mini с нашим полным подборщиком цветов и справочником кодов краски."
    }
  },
  "ja": {
    "title": "カラーピッカー",
    "description": "充実したカラーピッカーで、あなたのClassic Miniに最適な色を見つけましょう。",
    "keywords": "Classic Miniカラー, Mini Cooperペイントコード, BMCカラーコード, Ditzler PPGコード, Duluxペイントコード, ヴィンテージMiniカラー, ペイントカラーデータベース",
    "hero_title": "カラーピッカー",
    "breadcrumb_title": "カラースウォッチ",
    "main_heading": "Classic Mini カラーピッカー",
    "subtitle": "件のカラーがデータベースに登録されています",
    "description_text": "より多くの情報を提供するため、Classic Mini DIYは",
    "description_text_2": "と提携し、Classic Miniに長年使用されてきたカラーの包括的なリストをお届けします。",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "カラーを探す",
      "placeholder": "カラーを検索...",
      "help_text": "上の検索欄を使って、名前・コード・ペイントリファレンスでカラーを絞り込めます。データが不足していますか？カラーをクリックして詳細を確認し、情報を追加してください！"
    },
    "states": {
      "no_colors": "検索条件に一致するカラーが見つかりませんでした。",
      "unnamed_color": "名称未設定のカラー",
      "missing": "欠落",
      "link_copied": "リンクをクリップボードにコピーしました！"
    },
    "pagination": {
      "page": "ページ",
      "of": "/"
    },
    "share": {
      "title": "Classic Mini カラー：",
      "text": "このClassic Miniのカラーをチェックしてください："
    },
    "contribute_banner_title": "足りない情報をご存知ですか？",
    "contribute_banner_description": "あなたの知識でアーカイブを充実させてください。",
    "contribute_banner_button": "情報を提供する",
    "seo": {
      "og_title": "Classic Mini カラーピッカー | Classic Mini DIY",
      "og_description": "充実したカラーピッカーとペイントコード参照で、あなたのClassic Miniに最適な色を見つけましょう。",
      "twitter_title": "Classic Mini カラーピッカー | Classic Mini DIY",
      "twitter_description": "充実したカラーピッカーとペイントコード参照で、あなたのClassic Miniに最適な色を見つけましょう。"
    }
  },
  "zh": {
    "title": "颜色选择器",
    "description": "使用我们全面的颜色选择器，为您的Classic Mini找到完美的颜色。",
    "keywords": "Classic Mini颜色, Mini Cooper油漆代码, BMC颜色代码, Ditzler PPG代码, Dulux油漆代码, 复古Mini颜色, 油漆颜色数据库",
    "hero_title": "颜色选择器",
    "breadcrumb_title": "色板样本",
    "main_heading": "Classic Mini 颜色选择器",
    "subtitle": "种颜色收录于我们的数据库",
    "description_text": "为了提供更多信息，Classic Mini DIY 已与",
    "description_text_2": "合作，为您提供历年来Classic Mini所使用颜色的完整列表。",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "查找您的颜色",
      "placeholder": "搜索颜色...",
      "help_text": "使用上方的搜索栏按名称、代码或油漆参考筛选颜色。发现有数据缺失？点击颜色查看详情并贡献信息！"
    },
    "states": {
      "no_colors": "未找到与您搜索匹配的颜色。",
      "unnamed_color": "未命名颜色",
      "missing": "缺失",
      "link_copied": "链接已复制到剪贴板！"
    },
    "pagination": {
      "page": "第",
      "of": "页，共"
    },
    "share": {
      "title": "Classic Mini 颜色：",
      "text": "看看这款Classic Mini的颜色："
    },
    "contribute_banner_title": "您知道我们遗漏了什么吗？",
    "contribute_banner_description": "用您的知识帮助扩充档案库。",
    "contribute_banner_button": "贡献信息",
    "seo": {
      "og_title": "Classic Mini 颜色选择器 | Classic Mini DIY",
      "og_description": "使用我们全面的颜色选择器和油漆代码参考，为您的Classic Mini找到完美的颜色。",
      "twitter_title": "Classic Mini 颜色选择器 | Classic Mini DIY",
      "twitter_description": "使用我们全面的颜色选择器和油漆代码参考，为您的Classic Mini找到完美的颜色。"
    }
  },
  "ko": {
    "title": "컬러 피커",
    "description": "종합적인 컬러 피커로 Classic Mini에 딱 맞는 색상을 찾아보세요.",
    "keywords": "Classic Mini 색상, Mini Cooper 도료 코드, BMC 색상 코드, Ditzler PPG 코드, Dulux 도료 코드, 빈티지 Mini 색상, 도료 색상 데이터베이스",
    "hero_title": "컬러 피커",
    "breadcrumb_title": "컬러 스워치",
    "main_heading": "Classic Mini 컬러 피커",
    "subtitle": "개의 색상이 데이터베이스에 등록되어 있습니다",
    "description_text": "더 많은 정보를 제공하기 위해 Classic Mini DIY는",
    "description_text_2": "와 파트너십을 맺어 Classic Mini에 사용된 색상의 포괄적인 목록을 제공합니다.",
    "partner_link": "mini-colours.co.uk",
    "search": {
      "card_title": "색상 찾기",
      "placeholder": "색상 검색...",
      "help_text": "위 검색창을 사용해 이름, 코드, 도료 참조번호로 색상을 필터링하세요. 데이터가 누락된 것을 발견하셨나요? 색상을 클릭해 세부 정보를 확인하고 기여해 주세요!"
    },
    "states": {
      "no_colors": "검색어와 일치하는 색상을 찾을 수 없습니다.",
      "unnamed_color": "이름 없는 색상",
      "missing": "누락",
      "link_copied": "링크가 클립보드에 복사되었습니다!"
    },
    "pagination": {
      "page": "페이지",
      "of": "/"
    },
    "share": {
      "title": "Classic Mini 색상:",
      "text": "이 Classic Mini 색상을 확인해 보세요:"
    },
    "contribute_banner_title": "우리가 놓친 정보를 알고 계신가요?",
    "contribute_banner_description": "여러분의 지식으로 아카이브를 풍성하게 만들어 주세요.",
    "contribute_banner_button": "기여하기",
    "seo": {
      "og_title": "Classic Mini 컬러 피커 | Classic Mini DIY",
      "og_description": "종합적인 컬러 피커와 도료 코드 참조로 Classic Mini에 딱 맞는 색상을 찾아보세요.",
      "twitter_title": "Classic Mini 컬러 피커 | Classic Mini DIY",
      "twitter_description": "종합적인 컬러 피커와 도료 코드 참조로 Classic Mini에 딱 맞는 색상을 찾아보세요."
    }
  }
}
</i18n>
