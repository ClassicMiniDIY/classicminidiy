<script setup lang="ts">
  // Stage 3 browse page — exercises the ported useSearch data path + the
  // ExchangeListingsListingCard graph against the shared DB. The rich
  // FilterSidebar / SortDropdown / SearchBar / Map components land in the next
  // Stage 3 increment; this ships a working search box + grid + pagination.
  const { t } = useI18n();

  const { searchQuery, listings, loading, totalCount, currentPage, totalPages, hasNextPage, hasPrevPage, performSearch, nextPage, prevPage } =
    useSearch();

  onMounted(() => {
    performSearch();
  });

  useHead({
    title: t('seo.title'),
    meta: [{ key: 'description', name: 'description', content: t('seo.description') }],
    link: [{ rel: 'canonical', href: 'https://www.classicminidiy.com/exchange/listings' }],
  });
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold">{{ t('heading') }}</h1>
      <p class="text-base-content/70 mt-1">{{ t('subheading') }}</p>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <label class="input input-bordered flex items-center gap-2 max-w-xl">
        <i class="fas fa-magnifying-glass text-base-content/50"></i>
        <input v-model="searchQuery" type="search" class="grow" :placeholder="t('searchPlaceholder')" />
      </label>
    </div>

    <!-- Results are fetched client-side via performSearch() in onMounted, so the
         data-dependent area is ClientOnly to avoid an SSR/client hydration
         mismatch. The full browse page (next increment) moves the initial query
         to SSR via useAsyncData alongside the FilterSidebar/SortDropdown/Map. -->
    <ClientOnly>
      <template #fallback>
        <div class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </template>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-16">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Empty -->
      <div v-else-if="listings.length === 0" class="text-center py-16 text-base-content/60">
        <i class="fas fa-magnifying-glass text-4xl mb-3 opacity-40"></i>
        <p>{{ t('noResults') }}</p>
      </div>

      <!-- Results -->
      <template v-else>
        <p class="text-sm text-base-content/60 mb-4">{{ t('resultCount', { count: totalCount }) }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <ExchangeListingsListingCard v-for="listing in listings" :key="listing.id" :listing="listing" />
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-4 mt-8">
          <button class="btn btn-sm btn-outline" :disabled="!hasPrevPage" @click="prevPage">
            <i class="fas fa-chevron-left"></i>
            {{ t('prev') }}
          </button>
          <span class="text-sm text-base-content/70">{{ t('pageOf', { current: currentPage, total: totalPages }) }}</span>
          <button class="btn btn-sm btn-outline" :disabled="!hasNextPage" @click="nextPage">
            {{ t('next') }}
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<i18n lang="json">
{
  "en": { "seo": { "title": "Browse Listings — The Mini Exchange | Classic Mini DIY", "description": "Browse Classic Mini Coopers, engines, and parts for sale in the Classic Mini DIY marketplace." }, "heading": "Browse Listings", "subheading": "Classic Mini Coopers, engines, and parts for sale.", "searchPlaceholder": "Search listings…", "noResults": "No listings match your search.", "resultCount": "{count} listings", "prev": "Previous", "next": "Next", "pageOf": "Page {current} of {total}" },
  "es": { "seo": { "title": "Explorar anuncios — The Mini Exchange | Classic Mini DIY", "description": "Explora Classic Mini Cooper, motores y piezas en venta en el mercado de Classic Mini DIY." }, "heading": "Explorar anuncios", "subheading": "Classic Mini Cooper, motores y piezas en venta.", "searchPlaceholder": "Buscar anuncios…", "noResults": "Ningún anuncio coincide con tu búsqueda.", "resultCount": "{count} anuncios", "prev": "Anterior", "next": "Siguiente", "pageOf": "Página {current} de {total}" },
  "fr": { "seo": { "title": "Parcourir les annonces — The Mini Exchange | Classic Mini DIY", "description": "Parcourez les Classic Mini Cooper, moteurs et pièces à vendre sur la place de marché Classic Mini DIY." }, "heading": "Parcourir les annonces", "subheading": "Classic Mini Cooper, moteurs et pièces à vendre.", "searchPlaceholder": "Rechercher des annonces…", "noResults": "Aucune annonce ne correspond à votre recherche.", "resultCount": "{count} annonces", "prev": "Précédent", "next": "Suivant", "pageOf": "Page {current} sur {total}" },
  "de": { "seo": { "title": "Anzeigen durchsuchen — The Mini Exchange | Classic Mini DIY", "description": "Durchsuche Classic Mini Cooper, Motoren und Teile zum Verkauf auf dem Classic-Mini-DIY-Marktplatz." }, "heading": "Anzeigen durchsuchen", "subheading": "Classic Mini Cooper, Motoren und Teile zu verkaufen.", "searchPlaceholder": "Anzeigen suchen…", "noResults": "Keine Anzeigen entsprechen deiner Suche.", "resultCount": "{count} Anzeigen", "prev": "Zurück", "next": "Weiter", "pageOf": "Seite {current} von {total}" },
  "it": { "seo": { "title": "Sfoglia gli annunci — The Mini Exchange | Classic Mini DIY", "description": "Sfoglia Classic Mini Cooper, motori e ricambi in vendita nel mercato di Classic Mini DIY." }, "heading": "Sfoglia gli annunci", "subheading": "Classic Mini Cooper, motori e ricambi in vendita.", "searchPlaceholder": "Cerca annunci…", "noResults": "Nessun annuncio corrisponde alla tua ricerca.", "resultCount": "{count} annunci", "prev": "Precedente", "next": "Successivo", "pageOf": "Pagina {current} di {total}" },
  "pt": { "seo": { "title": "Explorar anúncios — The Mini Exchange | Classic Mini DIY", "description": "Explore Classic Mini Cooper, motores e peças à venda no mercado da Classic Mini DIY." }, "heading": "Explorar anúncios", "subheading": "Classic Mini Cooper, motores e peças à venda.", "searchPlaceholder": "Pesquisar anúncios…", "noResults": "Nenhum anúncio corresponde à sua pesquisa.", "resultCount": "{count} anúncios", "prev": "Anterior", "next": "Próximo", "pageOf": "Página {current} de {total}" },
  "ru": { "seo": { "title": "Просмотр объявлений — The Mini Exchange | Classic Mini DIY", "description": "Просматривайте Classic Mini Cooper, двигатели и запчасти на площадке Classic Mini DIY." }, "heading": "Просмотр объявлений", "subheading": "Classic Mini Cooper, двигатели и запчасти на продажу.", "searchPlaceholder": "Поиск объявлений…", "noResults": "Нет объявлений по вашему запросу.", "resultCount": "{count} объявлений", "prev": "Назад", "next": "Вперёд", "pageOf": "Страница {current} из {total}" },
  "ja": { "seo": { "title": "出品を見る — The Mini Exchange | Classic Mini DIY", "description": "Classic Mini DIY マーケットプレイスでクラシックミニ クーパー、エンジン、部品を探せます。" }, "heading": "出品を見る", "subheading": "クラシックミニ クーパー、エンジン、部品の販売。", "searchPlaceholder": "出品を検索…", "noResults": "条件に一致する出品はありません。", "resultCount": "{count} 件の出品", "prev": "前へ", "next": "次へ", "pageOf": "{total} ページ中 {current} ページ" },
  "zh": { "seo": { "title": "浏览刊登 — The Mini Exchange | Classic Mini DIY", "description": "在 Classic Mini DIY 交易市场浏览经典 Mini Cooper、发动机和零件。" }, "heading": "浏览刊登", "subheading": "出售经典 Mini Cooper、发动机和零件。", "searchPlaceholder": "搜索刊登…", "noResults": "没有符合搜索条件的刊登。", "resultCount": "{count} 条刊登", "prev": "上一页", "next": "下一页", "pageOf": "第 {current} 页，共 {total} 页" },
  "ko": { "seo": { "title": "매물 둘러보기 — The Mini Exchange | Classic Mini DIY", "description": "Classic Mini DIY 마켓플레이스에서 클래식 미니 쿠퍼, 엔진, 부품을 둘러보세요." }, "heading": "매물 둘러보기", "subheading": "판매 중인 클래식 미니 쿠퍼, 엔진, 부품.", "searchPlaceholder": "매물 검색…", "noResults": "검색과 일치하는 매물이 없습니다.", "resultCount": "매물 {count}건", "prev": "이전", "next": "다음", "pageOf": "{total}페이지 중 {current}페이지" }
}
</i18n>
