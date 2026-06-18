<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-4xl font-bold mb-2">{{ t('heading') }}</h1>
            <p class="text-base-content/70">
              <ClientOnly>{{ t('resultCount', { count: totalCount }) }}</ClientOnly>
            </p>
          </div>
          <NuxtLink to="/exchange/listings/new" class="btn btn-primary">
            <i class="fas fa-plus"></i>
            {{ t('postListing') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Search Bar -->
    <section class="bg-base-200 py-6 border-b border-base-300">
      <div class="container">
        <ExchangeListingsSearchBar v-model="searchQuery" />
      </div>
    </section>

    <!-- Main Content -->
    <section class="py-8">
      <div class="container">
        <div class="flex flex-col lg:flex-row gap-8">
          <!-- Sidebar Filters -->
          <aside class="lg:w-80 shrink-0">
            <!-- Mobile Filter Toggle -->
            <div class="lg:hidden mb-4">
              <button @click="filtersOpen = !filtersOpen" class="btn btn-outline w-full">
                <i class="fas fa-filter"></i>
                {{ filtersOpen ? t('hideFilters') : t('showFilters') }}
                <i :class="filtersOpen ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" class="ml-auto"></i>
              </button>
            </div>

            <!-- Filters Container -->
            <div class="lg:sticky lg:top-4" :class="{ hidden: !filtersOpen && !isDesktop }">
              <ExchangeListingsFilterSidebar
                v-model:category="selectedCategory"
                v-model:parts-subcategory="selectedPartsSubcategory"
                v-model:year-range="selectedYearRange"
                v-model:manufacturer="selectedManufacturer"
                v-model:model="selectedModel"
                v-model:condition="selectedCondition"
                v-model:price-range="selectedPriceRange"
                v-model:transmission="selectedTransmission"
                v-model:location="selectedLocation"
                v-model:distance="selectedDistance"
                v-model:shipping-available="selectedShippingAvailable"
                v-model:ships-international="selectedShipsInternational"
                v-model:free-shipping="selectedFreeShipping"
                :results-count="totalCount"
                @clear-filters="clearFilters"
              />
            </div>
          </aside>

          <!-- Listings Grid -->
          <div class="flex-1 min-w-0">
            <!-- Results Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <p class="text-base-content/70">
                  <ClientOnly>
                    <span v-if="loading">{{ t('searching') }}</span>
                    <span v-else-if="totalCount > 0">
                      {{ t('showingCount', { shown: listings.length, total: totalCount }) }}
                    </span>
                    <span v-else>{{ t('noResults') }}</span>
                  </ClientOnly>
                </p>
              </div>

              <div class="flex items-center gap-2">
                <!-- View Toggle -->
                <div class="join">
                  <button
                    @click="viewMode = 'grid'"
                    class="btn btn-sm join-item"
                    :class="{ 'btn-active': viewMode === 'grid' }"
                  >
                    <i class="fas fa-table-cells-large"></i>
                    {{ t('gridView') }}
                  </button>
                  <button
                    @click="viewMode = 'map'"
                    class="btn btn-sm join-item"
                    :class="{ 'btn-active': viewMode === 'map' }"
                  >
                    <i class="fas fa-map"></i>
                    {{ t('mapView') }}
                  </button>
                </div>

                <ExchangeListingsSortDropdown v-model="sortBy" :results-count="totalCount" />
              </div>
            </div>

            <!-- Results region (fetched client-side via performSearch() in onMounted/watch,
                 so wrap in ClientOnly to avoid an SSR/client hydration mismatch). -->
            <ClientOnly>
              <template #fallback>
                <div class="flex justify-center py-16">
                  <span class="loading loading-spinner loading-lg text-primary"></span>
                </div>
              </template>

              <!-- Loading State -->
              <div v-if="loading" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                <div v-for="i in 6" :key="i" class="skeleton h-80 w-full"></div>
              </div>

              <!-- Grid View -->
              <div v-if="viewMode === 'grid' && !loading && listings.length > 0">
                <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  <ExchangeListingsListingCard
                    v-for="(listing, index) in listings"
                    :key="listing.id"
                    :listing="listing"
                    :user-currency="userCurrency"
                    @click="trackListingClick(listing.id, index + 1)"
                  />
                </div>

                <!-- Pagination (Grid View Only) -->
                <div v-if="viewMode === 'grid' && totalPages > 1" class="flex justify-center items-center gap-2 mt-8">
                  <button
                    @click="prevPage"
                    :disabled="!hasPrevPage"
                    class="btn btn-outline btn-sm"
                    :class="{ 'btn-disabled': !hasPrevPage }"
                  >
                    <i class="fas fa-chevron-left"></i>
                    {{ t('prev') }}
                  </button>

                  <div class="flex gap-1">
                    <template v-for="page in paginationRange" :key="page">
                      <button
                        v-if="typeof page === 'number'"
                        @click="goToPage(page)"
                        class="btn btn-sm"
                        :class="page === currentPage ? 'btn-primary' : 'btn-outline'"
                      >
                        {{ page }}
                      </button>
                      <span v-else class="flex items-center px-2">...</span>
                    </template>
                  </div>

                  <button
                    @click="nextPage"
                    :disabled="!hasNextPage"
                    class="btn btn-outline btn-sm"
                    :class="{ 'btn-disabled': !hasNextPage }"
                  >
                    {{ t('next') }}
                    <i class="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>

              <!-- Map View -->
              <div v-if="viewMode === 'map' && !loading && listings.length > 0">
                <div class="h-[600px] rounded-lg overflow-hidden border border-base-300">
                  <ExchangeListingsMap
                    :listings="listingsWithCoordinates"
                    @markerClick="navigateTo(`/exchange/listings/${$event.slug}`)"
                  />
                </div>
                <div class="mt-4 text-sm text-base-content/70 text-center">
                  {{ t('mapShowing', { shown: listingsWithCoordinates.length, total: totalCount }) }}
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="!loading && listings.length === 0" class="text-center py-16">
                <i class="fas fa-inbox text-6xl mb-4 text-base-content/30"></i>
                <h3 class="text-xl font-semibold mb-2">{{ t('emptyTitle') }}</h3>
                <p class="text-base-content/70 mb-6">{{ t('emptyBody') }}</p>
                <button class="btn btn-outline" @click="clearFilters">{{ t('clearFilters') }}</button>
              </div>
            </ClientOnly>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { user } = useAuth();
  const { capture } = usePostHog();

  const {
    searchQuery,
    selectedCategory,
    selectedPartsSubcategory,
    selectedYearRange,
    selectedManufacturer,
    selectedModel,
    selectedCondition,
    selectedPriceRange,
    selectedTransmission,
    selectedLocation,
    selectedDistance,
    selectedShippingAvailable,
    selectedShipsInternational,
    selectedFreeShipping,
    sortBy,
    listings,
    loading,
    totalCount,
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    performSearch,
    clearFilters,
    nextPage,
    prevPage,
    goToPage,
    cleanup,
  } = useSearch();

  onBeforeUnmount(() => {
    cleanup();
  });

  // Remember the exact listings URL (with filters + ?page=N) so that a
  // listing detail page can render a "Back to Listings" button that
  // returns the user to this exact state. Fixes #83.
  const route = useRoute();
  const { rememberListingsReturnUrl } = useListingsReturnUrl();
  watch(
    () => route.fullPath,
    (fullPath) => {
      if (route.path === '/exchange/listings') {
        rememberListingsReturnUrl(fullPath);
      }
    },
    { immediate: true }
  );

  // SEO metadata
  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.title'),
    ogDescription: () => t('seo.ogDescription'),
    ogType: 'website',
    ogUrl: 'https://www.classicminidiy.com/exchange/listings',
    ogImage: `${config.public.siteUrl}/og-image.jpg`,
    twitterCard: 'summary_large_image',
  });

  // Schema.org CollectionPage markup
  useSchemaOrg([
    {
      '@type': 'CollectionPage',
      name: 'Classic Mini Listings',
      description: 'Classic Mini vehicles, engines, and parts for sale from enthusiasts worldwide.',
      url: 'https://www.classicminidiy.com/exchange/listings',
    },
  ]);

  const { userCurrency } = useCurrency();

  // Mobile filters toggle
  const filtersOpen = ref(false);
  const isDesktop = ref(false);

  // View mode toggle (grid vs map)
  const viewMode = ref<'grid' | 'map'>('grid');

  // Filter listings with valid coordinates for map display
  const listingsWithCoordinates = computed(() => {
    return listings.value.filter(
      (listing) =>
        listing.latitude &&
        listing.longitude &&
        !isNaN(listing.latitude) &&
        !isNaN(listing.longitude) &&
        listing.latitude >= -90 &&
        listing.latitude <= 90 &&
        listing.longitude >= -180 &&
        listing.longitude <= 180
    );
  });

  // Check if we're on desktop (for SSR compatibility)
  onMounted(() => {
    const checkDesktop = () => {
      isDesktop.value = window.innerWidth >= 1024; // lg breakpoint
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    onBeforeUnmount(() => {
      window.removeEventListener('resize', checkDesktop);
    });
  });

  // Compute pagination range for display
  const paginationRange = computed(() => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages.value <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages.value; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const start = Math.max(2, currentPage.value - 1);
      const end = Math.min(totalPages.value - 1, currentPage.value + 1);

      // Add ellipsis if needed
      if (start > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages.value - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages.value);
    }

    return pages;
  });

  // Track listing click from search results
  const trackListingClick = (listingId: string, position: number) => {
    capture('listing_clicked_from_search', {
      listing_id: listingId,
      position,
      query: searchQuery.value || undefined,
    });
  };

  // Perform initial search on mount
  onMounted(() => {
    performSearch();
  });
</script>

<i18n lang="json">
{
  "en": {
    "seo": {
      "title": "Browse Classic Mini Listings — The Mini Exchange | Classic Mini DIY",
      "description": "Find Classic Mini vehicles, engines, and parts for sale. Search by model, year, price, condition, and more.",
      "ogDescription": "Find Classic Mini vehicles, engines, and parts for sale from enthusiasts worldwide."
    },
    "heading": "Browse Listings",
    "resultCount": "{count} listings available",
    "postListing": "Post a Listing",
    "hideFilters": "Hide Filters",
    "showFilters": "Show Filters",
    "searching": "Searching...",
    "showingCount": "Showing {shown} of {total} listings",
    "noResults": "No listings found",
    "gridView": "Grid",
    "mapView": "Map",
    "mapShowing": "Showing {shown} of {total} listings with location data",
    "emptyTitle": "No Listings Found",
    "emptyBody": "Try adjusting your search or filters to find what you're looking for.",
    "clearFilters": "Clear All Filters",
    "prev": "Previous",
    "next": "Next"
  },
  "es": {
    "seo": {
      "title": "Explorar anuncios de Classic Mini — The Mini Exchange | Classic Mini DIY",
      "description": "Encuentra vehículos Classic Mini, motores y piezas en venta. Busca por modelo, año, precio, estado y más.",
      "ogDescription": "Encuentra vehículos Classic Mini, motores y piezas en venta de aficionados de todo el mundo."
    },
    "heading": "Explorar anuncios",
    "resultCount": "{count} anuncios disponibles",
    "postListing": "Publicar un anuncio",
    "hideFilters": "Ocultar filtros",
    "showFilters": "Mostrar filtros",
    "searching": "Buscando...",
    "showingCount": "Mostrando {shown} de {total} anuncios",
    "noResults": "No se encontraron anuncios",
    "gridView": "Cuadrícula",
    "mapView": "Mapa",
    "mapShowing": "Mostrando {shown} de {total} anuncios con datos de ubicación",
    "emptyTitle": "No se encontraron anuncios",
    "emptyBody": "Prueba a ajustar tu búsqueda o filtros para encontrar lo que buscas.",
    "clearFilters": "Borrar todos los filtros",
    "prev": "Anterior",
    "next": "Siguiente"
  },
  "fr": {
    "seo": {
      "title": "Parcourir les annonces Classic Mini — The Mini Exchange | Classic Mini DIY",
      "description": "Trouvez des Classic Mini, moteurs et pièces à vendre. Recherchez par modèle, année, prix, état et plus.",
      "ogDescription": "Trouvez des Classic Mini, moteurs et pièces à vendre proposés par des passionnés du monde entier."
    },
    "heading": "Parcourir les annonces",
    "resultCount": "{count} annonces disponibles",
    "postListing": "Publier une annonce",
    "hideFilters": "Masquer les filtres",
    "showFilters": "Afficher les filtres",
    "searching": "Recherche...",
    "showingCount": "Affichage de {shown} sur {total} annonces",
    "noResults": "Aucune annonce trouvée",
    "gridView": "Grille",
    "mapView": "Carte",
    "mapShowing": "Affichage de {shown} sur {total} annonces avec données de localisation",
    "emptyTitle": "Aucune annonce trouvée",
    "emptyBody": "Essayez d'ajuster votre recherche ou vos filtres pour trouver ce que vous cherchez.",
    "clearFilters": "Effacer tous les filtres",
    "prev": "Précédent",
    "next": "Suivant"
  },
  "de": {
    "seo": {
      "title": "Classic-Mini-Anzeigen durchsuchen — The Mini Exchange | Classic Mini DIY",
      "description": "Finde Classic Mini, Motoren und Teile zum Verkauf. Suche nach Modell, Baujahr, Preis, Zustand und mehr.",
      "ogDescription": "Finde Classic Mini, Motoren und Teile zum Verkauf von Enthusiasten weltweit."
    },
    "heading": "Anzeigen durchsuchen",
    "resultCount": "{count} Anzeigen verfügbar",
    "postListing": "Anzeige aufgeben",
    "hideFilters": "Filter ausblenden",
    "showFilters": "Filter anzeigen",
    "searching": "Suche läuft...",
    "showingCount": "{shown} von {total} Anzeigen werden angezeigt",
    "noResults": "Keine Anzeigen gefunden",
    "gridView": "Raster",
    "mapView": "Karte",
    "mapShowing": "{shown} von {total} Anzeigen mit Standortdaten werden angezeigt",
    "emptyTitle": "Keine Anzeigen gefunden",
    "emptyBody": "Passe deine Suche oder Filter an, um zu finden, was du suchst.",
    "clearFilters": "Alle Filter zurücksetzen",
    "prev": "Zurück",
    "next": "Weiter"
  },
  "it": {
    "seo": {
      "title": "Sfoglia gli annunci Classic Mini — The Mini Exchange | Classic Mini DIY",
      "description": "Trova Classic Mini, motori e ricambi in vendita. Cerca per modello, anno, prezzo, condizione e altro.",
      "ogDescription": "Trova Classic Mini, motori e ricambi in vendita da appassionati di tutto il mondo."
    },
    "heading": "Sfoglia gli annunci",
    "resultCount": "{count} annunci disponibili",
    "postListing": "Pubblica un annuncio",
    "hideFilters": "Nascondi filtri",
    "showFilters": "Mostra filtri",
    "searching": "Ricerca in corso...",
    "showingCount": "Visualizzazione di {shown} su {total} annunci",
    "noResults": "Nessun annuncio trovato",
    "gridView": "Griglia",
    "mapView": "Mappa",
    "mapShowing": "Visualizzazione di {shown} su {total} annunci con dati di posizione",
    "emptyTitle": "Nessun annuncio trovato",
    "emptyBody": "Prova a modificare la ricerca o i filtri per trovare ciò che cerchi.",
    "clearFilters": "Cancella tutti i filtri",
    "prev": "Precedente",
    "next": "Successivo"
  },
  "pt": {
    "seo": {
      "title": "Explorar anúncios Classic Mini — The Mini Exchange | Classic Mini DIY",
      "description": "Encontre Classic Mini, motores e peças à venda. Pesquise por modelo, ano, preço, condição e mais.",
      "ogDescription": "Encontre Classic Mini, motores e peças à venda de entusiastas de todo o mundo."
    },
    "heading": "Explorar anúncios",
    "resultCount": "{count} anúncios disponíveis",
    "postListing": "Publicar um anúncio",
    "hideFilters": "Ocultar filtros",
    "showFilters": "Mostrar filtros",
    "searching": "Pesquisando...",
    "showingCount": "Mostrando {shown} de {total} anúncios",
    "noResults": "Nenhum anúncio encontrado",
    "gridView": "Grade",
    "mapView": "Mapa",
    "mapShowing": "Mostrando {shown} de {total} anúncios com dados de localização",
    "emptyTitle": "Nenhum anúncio encontrado",
    "emptyBody": "Tente ajustar sua pesquisa ou filtros para encontrar o que procura.",
    "clearFilters": "Limpar todos os filtros",
    "prev": "Anterior",
    "next": "Próximo"
  },
  "ru": {
    "seo": {
      "title": "Просмотр объявлений Classic Mini — The Mini Exchange | Classic Mini DIY",
      "description": "Найдите Classic Mini, двигатели и запчасти на продажу. Поиск по модели, году, цене, состоянию и другому.",
      "ogDescription": "Найдите Classic Mini, двигатели и запчасти на продажу от энтузиастов со всего мира."
    },
    "heading": "Просмотр объявлений",
    "resultCount": "Доступно объявлений: {count}",
    "postListing": "Разместить объявление",
    "hideFilters": "Скрыть фильтры",
    "showFilters": "Показать фильтры",
    "searching": "Поиск...",
    "showingCount": "Показано {shown} из {total} объявлений",
    "noResults": "Объявления не найдены",
    "gridView": "Сетка",
    "mapView": "Карта",
    "mapShowing": "Показано {shown} из {total} объявлений с данными о местоположении",
    "emptyTitle": "Объявления не найдены",
    "emptyBody": "Попробуйте изменить поиск или фильтры, чтобы найти то, что ищете.",
    "clearFilters": "Сбросить все фильтры",
    "prev": "Назад",
    "next": "Вперёд"
  },
  "ja": {
    "seo": {
      "title": "クラシックミニの出品を見る — The Mini Exchange | Classic Mini DIY",
      "description": "販売中のクラシックミニ、エンジン、部品を探せます。モデル、年式、価格、状態などで検索。",
      "ogDescription": "世界中の愛好家が出品するクラシックミニ、エンジン、部品を探せます。"
    },
    "heading": "出品を見る",
    "resultCount": "{count} 件の出品があります",
    "postListing": "出品する",
    "hideFilters": "フィルターを隠す",
    "showFilters": "フィルターを表示",
    "searching": "検索中...",
    "showingCount": "{total} 件中 {shown} 件を表示",
    "noResults": "出品が見つかりません",
    "gridView": "グリッド",
    "mapView": "地図",
    "mapShowing": "位置情報のある {total} 件中 {shown} 件を表示",
    "emptyTitle": "出品が見つかりません",
    "emptyBody": "検索条件やフィルターを調整してお探しのものを見つけてください。",
    "clearFilters": "すべてのフィルターをクリア",
    "prev": "前へ",
    "next": "次へ"
  },
  "zh": {
    "seo": {
      "title": "浏览经典 Mini 刊登 — The Mini Exchange | Classic Mini DIY",
      "description": "查找出售的经典 Mini 车辆、发动机和零件。按车型、年份、价格、状况等搜索。",
      "ogDescription": "查找来自全球爱好者出售的经典 Mini 车辆、发动机和零件。"
    },
    "heading": "浏览刊登",
    "resultCount": "{count} 条刊登可用",
    "postListing": "发布刊登",
    "hideFilters": "隐藏筛选",
    "showFilters": "显示筛选",
    "searching": "搜索中...",
    "showingCount": "显示 {total} 条中的 {shown} 条刊登",
    "noResults": "未找到刊登",
    "gridView": "网格",
    "mapView": "地图",
    "mapShowing": "显示 {total} 条中带位置数据的 {shown} 条刊登",
    "emptyTitle": "未找到刊登",
    "emptyBody": "请尝试调整搜索或筛选条件以找到所需内容。",
    "clearFilters": "清除所有筛选",
    "prev": "上一页",
    "next": "下一页"
  },
  "ko": {
    "seo": {
      "title": "클래식 미니 매물 둘러보기 — The Mini Exchange | Classic Mini DIY",
      "description": "판매 중인 클래식 미니, 엔진, 부품을 찾아보세요. 모델, 연식, 가격, 상태 등으로 검색하세요.",
      "ogDescription": "전 세계 애호가가 판매하는 클래식 미니, 엔진, 부품을 찾아보세요."
    },
    "heading": "매물 둘러보기",
    "resultCount": "{count}건의 매물 이용 가능",
    "postListing": "매물 등록",
    "hideFilters": "필터 숨기기",
    "showFilters": "필터 표시",
    "searching": "검색 중...",
    "showingCount": "{total}건 중 {shown}건 표시",
    "noResults": "매물을 찾을 수 없습니다",
    "gridView": "그리드",
    "mapView": "지도",
    "mapShowing": "위치 데이터가 있는 {total}건 중 {shown}건 표시",
    "emptyTitle": "매물을 찾을 수 없습니다",
    "emptyBody": "검색어나 필터를 조정하여 찾으시는 항목을 확인하세요.",
    "clearFilters": "모든 필터 지우기",
    "prev": "이전",
    "next": "다음"
  }
}
</i18n>
