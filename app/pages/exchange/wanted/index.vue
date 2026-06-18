<template>
  <div>
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-4xl font-bold mb-2">{{ t('header.title') }}</h1>
            <p class="text-base-content/70">{{ t('header.count', { count: totalCount }) }}</p>
          </div>
          <NuxtLink to="/exchange/wanted/new" class="btn btn-primary">
            <i class="fas fa-plus"></i>
            {{ t('header.postCta') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Search Bar -->
    <section class="bg-base-200 py-6 border-b border-base-300">
      <div class="container">
        <div class="relative">
          <i
            class="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
          ></i>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('search.placeholder')"
            class="input input-bordered w-full pl-10"
          />
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <section class="py-8">
      <div class="container">
        <!-- Filter Bar -->
        <ExchangeWantedFilterBar
          v-model:category="filterCategory"
          v-model:condition-preference="filterCondition"
          v-model:budget-min="filterBudgetMin"
          v-model:budget-max="filterBudgetMax"
          v-model:country="filterCountry"
          @clear="clearFilters"
        />

        <!-- Results Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 mb-6">
          <div>
            <p class="text-base-content/70">
              <span v-if="loading">{{ t('results.searching') }}</span>
              <span v-else-if="totalCount > 0">
                {{ t('results.showing', { shown: wantedPosts.length, total: totalCount }) }}
              </span>
              <span v-else>{{ t('results.none') }}</span>
            </p>
          </div>

          <!-- Sort Dropdown -->
          <fieldset class="fieldset">
            <select v-model="sortBy" class="select select-bordered select-sm" :aria-label="t('sort.ariaLabel')">
              <option value="newest">{{ t('sort.newest') }}</option>
              <option value="oldest">{{ t('sort.oldest') }}</option>
              <option value="budget_high">{{ t('sort.budgetHigh') }}</option>
              <option value="budget_low">{{ t('sort.budgetLow') }}</option>
            </select>
          </fieldset>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="i in 6" :key="i" class="skeleton h-64 w-full rounded-lg"></div>
        </div>

        <!-- Results -->
        <template v-else-if="wantedPosts.length > 0">
          <!-- Desktop View: Table -->
          <div class="hidden md:block">
            <ExchangeWantedTable :posts="wantedPosts" :sort-by="sortBy" show-user-column @sort="handleTableSort" />
          </div>

          <!-- Mobile View: Card Grid -->
          <div class="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExchangeWantedCard v-for="post in wantedPosts" :key="post.id" :post="post" />
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-8">
            <button
              @click="prevPage"
              :disabled="currentPage <= 1"
              class="btn btn-outline btn-sm"
              :class="{ 'btn-disabled': currentPage <= 1 }"
            >
              <i class="fas fa-chevron-left"></i>
              {{ t('pagination.previous') }}
            </button>

            <span class="text-sm text-base-content/70">
              {{ t('pagination.pageOf', { current: currentPage, total: totalPages }) }}
            </span>

            <button
              @click="nextPage"
              :disabled="currentPage >= totalPages"
              class="btn btn-outline btn-sm"
              :class="{ 'btn-disabled': currentPage >= totalPages }"
            >
              {{ t('pagination.next') }}
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </template>

        <!-- Empty State -->
        <div v-else class="text-center py-16">
          <i class="fas fa-bullhorn text-6xl mx-auto mb-4 text-base-content/30"></i>
          <h3 class="text-xl font-semibold mb-2">{{ t('empty.title') }}</h3>
          <p class="text-base-content/70 mb-6">
            {{ t('empty.body') }}
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button class="btn btn-outline" @click="clearFilters">{{ t('empty.clearFilters') }}</button>
            <NuxtLink to="/exchange/wanted/new" class="btn btn-primary">
              <i class="fas fa-plus"></i>
              {{ t('empty.postCta') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({});

  const { t } = useI18n();
  const { capture } = usePostHog();
  const { wantedPosts, totalCount, loading, fetchWantedPosts } = useWantedPosts();

  // SEO metadata
  useSeoMeta({
    title: () => t('seo.title'),
    description: () => t('seo.description'),
    ogTitle: () => t('seo.ogTitle'),
    ogDescription: () => t('seo.ogDescription'),
    ogType: 'website',
    ogUrl: 'https://www.classicminidiy.com/exchange/wanted',
    twitterCard: 'summary_large_image',
  });

  // Filter and search state
  const searchQuery = ref('');
  const filterCategory = ref('');
  const filterCondition = ref('');
  const filterBudgetMin = ref<number | undefined>();
  const filterBudgetMax = ref<number | undefined>();
  const filterCountry = ref('');
  const currentPage = ref(1);
  const sortBy = ref<'newest' | 'oldest' | 'budget_high' | 'budget_low'>('newest');
  const perPage = 20;

  // Computed total pages
  const totalPages = computed(() => Math.ceil(totalCount.value / perPage));

  /**
   * Fetch wanted posts applying all current filters.
   */
  const loadPosts = async () => {
    await fetchWantedPosts({
      search: searchQuery.value || undefined,
      category: filterCategory.value || undefined,
      conditionPreference: filterCondition.value || undefined,
      budgetMin: filterBudgetMin.value,
      budgetMax: filterBudgetMax.value,
      country: filterCountry.value || undefined,
      page: currentPage.value,
      perPage,
      sortBy: sortBy.value,
    });
  };

  /**
   * Handle sort column clicks from WantedTable.
   * Maps table column names to the composable's sort values.
   */
  const handleTableSort = (column: string) => {
    switch (column) {
      case 'date':
        sortBy.value = sortBy.value === 'newest' ? 'oldest' : 'newest';
        break;
      case 'budget':
        sortBy.value = sortBy.value === 'budget_high' ? 'budget_low' : 'budget_high';
        break;
      default:
        break;
    }
  };

  /**
   * Reset all filters and search back to defaults.
   */
  const clearFilters = () => {
    searchQuery.value = '';
    filterCategory.value = '';
    filterCondition.value = '';
    filterBudgetMin.value = undefined;
    filterBudgetMax.value = undefined;
    filterCountry.value = '';
    currentPage.value = 1;
    sortBy.value = 'newest';
  };

  /**
   * Navigate to the previous page.
   */
  const prevPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  };

  /**
   * Navigate to the next page.
   */
  const nextPage = () => {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  };

  // Debounce search input at 500ms
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  watch(searchQuery, () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage.value = 1;
      loadPosts();
    }, 500);
  });

  // Watch non-search filters: reload immediately and reset page to 1
  watch([filterCategory, filterCondition, filterBudgetMin, filterBudgetMax, filterCountry, sortBy], () => {
    currentPage.value = 1;
    loadPosts();
  });

  // Watch page changes separately (no page reset needed)
  watch(currentPage, () => {
    loadPosts();
  });

  // Initial load and analytics
  onMounted(() => {
    loadPosts().then(() => {
      capture('wanted_browse_viewed', {
        total_results: totalCount.value,
        page: currentPage.value,
      });
    });
  });
</script>

<i18n lang="json">
{
  "en": {
    "seo": {
      "title": "Wanted Posts - Classic Mini Parts & Vehicles | Classic Mini DIY",
      "description": "Browse wanted posts from Classic Mini enthusiasts looking for vehicles, engines, and parts. Find what the community is searching for or post your own want.",
      "ogTitle": "Wanted Posts - Classic Mini DIY",
      "ogDescription": "Browse wanted posts from Classic Mini enthusiasts looking for vehicles, engines, and parts."
    },
    "header": {
      "title": "Wanted Posts",
      "count": "{count} wanted posts available",
      "postCta": "Post a Want"
    },
    "search": { "placeholder": "Search wanted posts..." },
    "results": {
      "searching": "Searching...",
      "showing": "Showing {shown} of {total} results",
      "none": "No wanted posts found"
    },
    "sort": {
      "ariaLabel": "Sort wanted posts",
      "newest": "Newest",
      "oldest": "Oldest",
      "budgetHigh": "Budget: High to Low",
      "budgetLow": "Budget: Low to High"
    },
    "pagination": { "previous": "Previous", "next": "Next", "pageOf": "Page {current} of {total}" },
    "empty": {
      "title": "No Wanted Posts Found",
      "body": "Try adjusting your search or filters, or post what you're looking for.",
      "clearFilters": "Clear All Filters",
      "postCta": "Post What You Need"
    }
  },
  "es": {
    "seo": {
      "title": "Anuncios de búsqueda - Piezas y vehículos Classic Mini | Classic Mini DIY",
      "description": "Explora los anuncios de búsqueda de entusiastas del Classic Mini que buscan vehículos, motores y piezas. Descubre lo que busca la comunidad o publica tu propia búsqueda.",
      "ogTitle": "Anuncios de búsqueda - Classic Mini DIY",
      "ogDescription": "Explora los anuncios de búsqueda de entusiastas del Classic Mini que buscan vehículos, motores y piezas."
    },
    "header": {
      "title": "Anuncios de búsqueda",
      "count": "{count} anuncios de búsqueda disponibles",
      "postCta": "Publicar una búsqueda"
    },
    "search": { "placeholder": "Buscar anuncios de búsqueda..." },
    "results": {
      "searching": "Buscando...",
      "showing": "Mostrando {shown} de {total} resultados",
      "none": "No se encontraron anuncios de búsqueda"
    },
    "sort": {
      "ariaLabel": "Ordenar anuncios de búsqueda",
      "newest": "Más recientes",
      "oldest": "Más antiguos",
      "budgetHigh": "Presupuesto: de mayor a menor",
      "budgetLow": "Presupuesto: de menor a mayor"
    },
    "pagination": { "previous": "Anterior", "next": "Siguiente", "pageOf": "Página {current} de {total}" },
    "empty": {
      "title": "No se encontraron anuncios de búsqueda",
      "body": "Prueba a ajustar tu búsqueda o filtros, o publica lo que estás buscando.",
      "clearFilters": "Borrar todos los filtros",
      "postCta": "Publica lo que necesitas"
    }
  },
  "fr": {
    "seo": {
      "title": "Annonces de recherche - Pièces et véhicules Classic Mini | Classic Mini DIY",
      "description": "Parcourez les annonces de recherche des passionnés de Classic Mini en quête de véhicules, moteurs et pièces. Découvrez ce que recherche la communauté ou publiez votre propre demande.",
      "ogTitle": "Annonces de recherche - Classic Mini DIY",
      "ogDescription": "Parcourez les annonces de recherche des passionnés de Classic Mini en quête de véhicules, moteurs et pièces."
    },
    "header": {
      "title": "Annonces de recherche",
      "count": "{count} annonces de recherche disponibles",
      "postCta": "Publier une recherche"
    },
    "search": { "placeholder": "Rechercher des annonces de recherche..." },
    "results": {
      "searching": "Recherche en cours...",
      "showing": "Affichage de {shown} sur {total} résultats",
      "none": "Aucune annonce de recherche trouvée"
    },
    "sort": {
      "ariaLabel": "Trier les annonces de recherche",
      "newest": "Plus récentes",
      "oldest": "Plus anciennes",
      "budgetHigh": "Budget : du plus élevé au plus bas",
      "budgetLow": "Budget : du plus bas au plus élevé"
    },
    "pagination": { "previous": "Précédent", "next": "Suivant", "pageOf": "Page {current} sur {total}" },
    "empty": {
      "title": "Aucune annonce de recherche trouvée",
      "body": "Essayez d'ajuster votre recherche ou vos filtres, ou publiez ce que vous cherchez.",
      "clearFilters": "Effacer tous les filtres",
      "postCta": "Publiez ce dont vous avez besoin"
    }
  },
  "de": {
    "seo": {
      "title": "Gesuche - Classic-Mini-Teile & Fahrzeuge | Classic Mini DIY",
      "description": "Durchstöbern Sie Gesuche von Classic-Mini-Enthusiasten, die nach Fahrzeugen, Motoren und Teilen suchen. Finden Sie heraus, was die Community sucht, oder veröffentlichen Sie Ihr eigenes Gesuch.",
      "ogTitle": "Gesuche - Classic Mini DIY",
      "ogDescription": "Durchstöbern Sie Gesuche von Classic-Mini-Enthusiasten, die nach Fahrzeugen, Motoren und Teilen suchen."
    },
    "header": {
      "title": "Gesuche",
      "count": "{count} Gesuche verfügbar",
      "postCta": "Gesuch aufgeben"
    },
    "search": { "placeholder": "Gesuche durchsuchen..." },
    "results": {
      "searching": "Suche läuft...",
      "showing": "{shown} von {total} Ergebnissen werden angezeigt",
      "none": "Keine Gesuche gefunden"
    },
    "sort": {
      "ariaLabel": "Gesuche sortieren",
      "newest": "Neueste",
      "oldest": "Älteste",
      "budgetHigh": "Budget: hoch nach niedrig",
      "budgetLow": "Budget: niedrig nach hoch"
    },
    "pagination": { "previous": "Zurück", "next": "Weiter", "pageOf": "Seite {current} von {total}" },
    "empty": {
      "title": "Keine Gesuche gefunden",
      "body": "Passen Sie Ihre Suche oder Filter an oder veröffentlichen Sie, wonach Sie suchen.",
      "clearFilters": "Alle Filter zurücksetzen",
      "postCta": "Veröffentlichen Sie, was Sie suchen"
    }
  },
  "it": {
    "seo": {
      "title": "Annunci di ricerca - Ricambi e veicoli Classic Mini | Classic Mini DIY",
      "description": "Sfoglia gli annunci di ricerca degli appassionati di Classic Mini in cerca di veicoli, motori e ricambi. Scopri cosa cerca la community o pubblica la tua richiesta.",
      "ogTitle": "Annunci di ricerca - Classic Mini DIY",
      "ogDescription": "Sfoglia gli annunci di ricerca degli appassionati di Classic Mini in cerca di veicoli, motori e ricambi."
    },
    "header": {
      "title": "Annunci di ricerca",
      "count": "{count} annunci di ricerca disponibili",
      "postCta": "Pubblica una ricerca"
    },
    "search": { "placeholder": "Cerca annunci di ricerca..." },
    "results": {
      "searching": "Ricerca in corso...",
      "showing": "Visualizzazione di {shown} di {total} risultati",
      "none": "Nessun annuncio di ricerca trovato"
    },
    "sort": {
      "ariaLabel": "Ordina annunci di ricerca",
      "newest": "Più recenti",
      "oldest": "Meno recenti",
      "budgetHigh": "Budget: dal più alto al più basso",
      "budgetLow": "Budget: dal più basso al più alto"
    },
    "pagination": { "previous": "Precedente", "next": "Successivo", "pageOf": "Pagina {current} di {total}" },
    "empty": {
      "title": "Nessun annuncio di ricerca trovato",
      "body": "Prova a modificare la ricerca o i filtri, oppure pubblica ciò che stai cercando.",
      "clearFilters": "Cancella tutti i filtri",
      "postCta": "Pubblica ciò di cui hai bisogno"
    }
  },
  "pt": {
    "seo": {
      "title": "Anúncios de procura - Peças e veículos Classic Mini | Classic Mini DIY",
      "description": "Navegue pelos anúncios de procura de entusiastas do Classic Mini à procura de veículos, motores e peças. Descubra o que a comunidade procura ou publique o seu próprio pedido.",
      "ogTitle": "Anúncios de procura - Classic Mini DIY",
      "ogDescription": "Navegue pelos anúncios de procura de entusiastas do Classic Mini à procura de veículos, motores e peças."
    },
    "header": {
      "title": "Anúncios de procura",
      "count": "{count} anúncios de procura disponíveis",
      "postCta": "Publicar uma procura"
    },
    "search": { "placeholder": "Pesquisar anúncios de procura..." },
    "results": {
      "searching": "A pesquisar...",
      "showing": "A mostrar {shown} de {total} resultados",
      "none": "Nenhum anúncio de procura encontrado"
    },
    "sort": {
      "ariaLabel": "Ordenar anúncios de procura",
      "newest": "Mais recentes",
      "oldest": "Mais antigos",
      "budgetHigh": "Orçamento: do maior para o menor",
      "budgetLow": "Orçamento: do menor para o maior"
    },
    "pagination": { "previous": "Anterior", "next": "Seguinte", "pageOf": "Página {current} de {total}" },
    "empty": {
      "title": "Nenhum anúncio de procura encontrado",
      "body": "Tente ajustar a sua pesquisa ou filtros, ou publique o que está à procura.",
      "clearFilters": "Limpar todos os filtros",
      "postCta": "Publique o que precisa"
    }
  },
  "ru": {
    "seo": {
      "title": "Объявления о поиске - Запчасти и автомобили Classic Mini | Classic Mini DIY",
      "description": "Просматривайте объявления о поиске от энтузиастов Classic Mini, которые ищут автомобили, двигатели и запчасти. Узнайте, что ищет сообщество, или разместите своё объявление.",
      "ogTitle": "Объявления о поиске - Classic Mini DIY",
      "ogDescription": "Просматривайте объявления о поиске от энтузиастов Classic Mini, которые ищут автомобили, двигатели и запчасти."
    },
    "header": {
      "title": "Объявления о поиске",
      "count": "Доступно объявлений о поиске: {count}",
      "postCta": "Разместить запрос"
    },
    "search": { "placeholder": "Поиск объявлений о поиске..." },
    "results": {
      "searching": "Поиск...",
      "showing": "Показано {shown} из {total} результатов",
      "none": "Объявления о поиске не найдены"
    },
    "sort": {
      "ariaLabel": "Сортировать объявления о поиске",
      "newest": "Сначала новые",
      "oldest": "Сначала старые",
      "budgetHigh": "Бюджет: по убыванию",
      "budgetLow": "Бюджет: по возрастанию"
    },
    "pagination": { "previous": "Назад", "next": "Далее", "pageOf": "Страница {current} из {total}" },
    "empty": {
      "title": "Объявления о поиске не найдены",
      "body": "Попробуйте изменить поиск или фильтры либо разместите то, что вы ищете.",
      "clearFilters": "Сбросить все фильтры",
      "postCta": "Разместите то, что вам нужно"
    }
  },
  "ja": {
    "seo": {
      "title": "求む投稿 - クラシックミニ部品＆車両 | Classic Mini DIY",
      "description": "車両、エンジン、部品を探しているクラシックミニ愛好家の求む投稿を閲覧できます。コミュニティが探しているものを見つけたり、自分の求む投稿を掲載したりできます。",
      "ogTitle": "求む投稿 - Classic Mini DIY",
      "ogDescription": "車両、エンジン、部品を探しているクラシックミニ愛好家の求む投稿を閲覧できます。"
    },
    "header": {
      "title": "求む投稿",
      "count": "求む投稿 {count} 件が掲載中",
      "postCta": "求む投稿を掲載"
    },
    "search": { "placeholder": "求む投稿を検索..." },
    "results": {
      "searching": "検索中...",
      "showing": "{total} 件中 {shown} 件を表示",
      "none": "求む投稿が見つかりませんでした"
    },
    "sort": {
      "ariaLabel": "求む投稿を並べ替え",
      "newest": "新しい順",
      "oldest": "古い順",
      "budgetHigh": "予算: 高い順",
      "budgetLow": "予算: 低い順"
    },
    "pagination": { "previous": "前へ", "next": "次へ", "pageOf": "{total} ページ中 {current} ページ" },
    "empty": {
      "title": "求む投稿が見つかりませんでした",
      "body": "検索条件やフィルターを調整するか、探しているものを掲載してみてください。",
      "clearFilters": "すべてのフィルターをクリア",
      "postCta": "必要なものを掲載"
    }
  },
  "zh": {
    "seo": {
      "title": "求购信息 - 经典 Mini 零件与车辆 | Classic Mini DIY",
      "description": "浏览经典 Mini 爱好者寻找车辆、发动机和零件的求购信息。了解社区在寻找什么，或发布你自己的求购信息。",
      "ogTitle": "求购信息 - Classic Mini DIY",
      "ogDescription": "浏览经典 Mini 爱好者寻找车辆、发动机和零件的求购信息。"
    },
    "header": {
      "title": "求购信息",
      "count": "共有 {count} 条求购信息",
      "postCta": "发布求购"
    },
    "search": { "placeholder": "搜索求购信息..." },
    "results": {
      "searching": "搜索中...",
      "showing": "显示 {total} 条结果中的 {shown} 条",
      "none": "未找到求购信息"
    },
    "sort": {
      "ariaLabel": "排序求购信息",
      "newest": "最新",
      "oldest": "最早",
      "budgetHigh": "预算：从高到低",
      "budgetLow": "预算：从低到高"
    },
    "pagination": { "previous": "上一页", "next": "下一页", "pageOf": "第 {current} 页，共 {total} 页" },
    "empty": {
      "title": "未找到求购信息",
      "body": "请尝试调整搜索或筛选条件，或发布你想要寻找的内容。",
      "clearFilters": "清除所有筛选",
      "postCta": "发布你需要的内容"
    }
  },
  "ko": {
    "seo": {
      "title": "구함 게시물 - 클래식 미니 부품 & 차량 | Classic Mini DIY",
      "description": "차량, 엔진, 부품을 찾는 클래식 미니 애호가들의 구함 게시물을 둘러보세요. 커뮤니티가 찾고 있는 것을 확인하거나 직접 구함 게시물을 올려 보세요.",
      "ogTitle": "구함 게시물 - Classic Mini DIY",
      "ogDescription": "차량, 엔진, 부품을 찾는 클래식 미니 애호가들의 구함 게시물을 둘러보세요."
    },
    "header": {
      "title": "구함 게시물",
      "count": "구함 게시물 {count}개 있음",
      "postCta": "구함 게시물 올리기"
    },
    "search": { "placeholder": "구함 게시물 검색..." },
    "results": {
      "searching": "검색 중...",
      "showing": "{total}개 중 {shown}개 표시",
      "none": "구함 게시물을 찾을 수 없습니다"
    },
    "sort": {
      "ariaLabel": "구함 게시물 정렬",
      "newest": "최신순",
      "oldest": "오래된순",
      "budgetHigh": "예산: 높은 순",
      "budgetLow": "예산: 낮은 순"
    },
    "pagination": { "previous": "이전", "next": "다음", "pageOf": "{total} 페이지 중 {current} 페이지" },
    "empty": {
      "title": "구함 게시물을 찾을 수 없습니다",
      "body": "검색이나 필터를 조정하거나 찾고 있는 것을 올려 보세요.",
      "clearFilters": "모든 필터 지우기",
      "postCta": "필요한 것을 올리기"
    }
  }
}
</i18n>
