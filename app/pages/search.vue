<script lang="ts" setup>
  /**
   * Search results page (design S3 / M4).
   *
   * Filter pills use the same surface vocabulary as the omnisearch groups, and
   * every archive result credits its contributor — that credit is the point, not
   * decoration.
   *
   * `?q=` and `?surface=` are both query params, so this page MUST go through
   * useFacetedSeo(): without it nuxt-seo-utils canonicalises each permutation
   * into its own indexable near-duplicate, which is exactly the crawl trap the
   * repo already documents. Neither param is on the allowlist — a search results
   * page has nothing to index.
   */
  import type { SearchResponse, SearchResult } from '../../server/api/search/index.get';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const { openWizard } = useContributeWizard();
  const { rememberSearch } = useOmnisearch();

  const query = computed(() => String(route.query.q ?? '').trim());
  const surface = computed(() => String(route.query.surface ?? '') || 'all');

  useFacetedSeo('/search', { indexableParams: [] });

  useHead({ title: computed(() => (query.value ? t('title_with_query', { query: query.value }) : t('title'))) });

  const { data, status } = await useAsyncData(
    'omnisearch-results',
    () => {
      if (query.value.length < 2) {
        return Promise.resolve({ query: query.value, total: 0, results: [], counts: {} } as SearchResponse);
      }
      return $fetch<SearchResponse>('/api/search', { query: { q: query.value, limit: 60 } });
    },
    { watch: [query] }
  );

  const allResults = computed<SearchResult[]>(() => data.value?.results ?? []);
  const counts = computed(() => data.value?.counts ?? {});

  const filters = computed(() => {
    const surfaces = ['tools', 'wheels', 'archive', 'models', 'exchange'].filter((key) => (counts.value[key] ?? 0) > 0);
    return [
      { key: 'all', label: t('filters.all'), count: allResults.value.length },
      ...surfaces.map((key) => ({ key, label: surfaceLabel(key), count: counts.value[key] ?? 0 })),
    ];
  });

  const results = computed(() =>
    surface.value === 'all' ? allResults.value : allResults.value.filter((result) => result.surface === surface.value)
  );

  const setSurface = (key: string) => {
    router.replace({ query: { ...route.query, surface: key === 'all' ? undefined : key } });
  };

  const requestIt = () => openWizard({ mode: 'request', requestTitle: query.value, origin: 'search_results' });

  // Only remember a search that actually reached this page, not every keystroke
  // that hit the palette.
  onMounted(() => {
    if (query.value.length >= 2) rememberSearch(query.value);
  });
</script>

<template>
  <div class="mx-auto w-full max-w-[1232px] px-4 py-7 lg:px-6 lg:py-9">
    <h1 class="text-2xl font-bold lg:text-[26px]">
      {{ query ? t('heading', { count: allResults.length, query }) : t('heading_empty') }}
    </h1>
    <p class="mt-1 text-sm opacity-60 lg:text-[15px]">{{ t('subheading') }}</p>

    <!-- Filter pills — same surface vocabulary as the palette groups -->
    <div v-if="allResults.length" class="mt-5 flex flex-wrap gap-2">
      <button
        v-for="filter in filters"
        :key="filter.key"
        type="button"
        class="filter-pill"
        :class="{ 'is-active': surface === filter.key }"
        @click="setSurface(filter.key)"
      >
        {{ filter.label }} {{ filter.count }}
      </button>
    </div>

    <div v-if="status === 'pending'" class="mt-8 flex justify-center py-12">
      <span class="loading loading-spinner loading-lg opacity-50"></span>
    </div>

    <div v-else-if="results.length" class="mt-6 flex max-w-[900px] flex-col gap-3">
      <NuxtLink
        v-for="result in results"
        :key="`${result.surface}-${result.id}`"
        :to="result.url"
        class="result-card"
      >
        <span class="result-thumb">
          <i :class="[result.icon, 'text-xl text-primary']" aria-hidden="true"></i>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-bold lg:text-base">{{ result.title }}</span>
          <span class="mt-0.5 block text-[13px] opacity-60">
            {{ result.subtitle }}
            <template v-if="result.contributorUsername">
              &middot; {{ t('added_by') }}
              <span class="font-semibold text-primary">@{{ result.contributorUsername }}</span>
            </template>
          </span>
        </span>
        <span v-if="result.verified" class="hidden shrink-0 text-xs font-semibold text-success sm:inline">
          <i class="fas fa-circle-check" aria-hidden="true"></i> {{ t('verified') }}
        </span>
        <span v-else-if="result.surface === 'exchange'" class="hidden shrink-0 text-xs font-bold text-secondary sm:inline">
          {{ t('for_sale') }}
        </span>
      </NuxtLink>
    </div>

    <!-- Nothing found -->
    <div v-else class="mt-8 rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center">
      <i class="fas fa-magnifying-glass mb-3 block text-3xl opacity-30" aria-hidden="true"></i>
      <p class="text-lg font-bold">{{ query ? t('empty_title', { query }) : t('empty_no_query') }}</p>
      <p class="mt-1 text-sm opacity-70">{{ t('empty_body') }}</p>
      <button v-if="query" type="button" class="btn btn-secondary mt-5" @click="requestIt()">
        <i class="fas fa-hand" aria-hidden="true"></i>
        {{ t('request_it') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
  .filter-pill {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 0.875rem;
    border: 1px solid var(--color-base-300);
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    color: color-mix(in srgb, var(--color-base-content) 75%, transparent);
    cursor: pointer;
  }
  .filter-pill.is-active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-content);
    font-weight: 700;
  }

  .result-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--color-base-300);
    border-radius: var(--radius-box, 0.75rem);
    background: var(--color-base-100);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
    text-decoration: none;
    color: inherit;
    transition: box-shadow 120ms ease;
  }
  .result-card:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
  }

  .result-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 60px;
    flex: none;
    border-radius: var(--radius-field, 0.5rem);
    background: var(--color-base-200);
  }
  @media (max-width: 640px) {
    .result-thumb {
      width: 64px;
      height: 48px;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "title": "Search — Classic Mini DIY",
    "title_with_query": "\"{query}\" — Search",
    "heading": "{count} results for \"{query}\"",
    "heading_empty": "Search",
    "subheading": "Across the Toolbox, Archive, and The Mini Exchange",
    "added_by": "added by",
    "verified": "Verified",
    "for_sale": "For Sale",
    "filters": { "all": "All" },
    "empty_title": "No results for \"{query}\"",
    "empty_no_query": "What are you looking for?",
    "empty_body": "Try fewer words, or ask the community to fill the gap.",
    "request_it": "Request it"
  },
  "es": {
    "title": "Buscar — Classic Mini DIY",
    "title_with_query": "\"{query}\" — Búsqueda",
    "heading": "{count} resultados para \"{query}\"",
    "heading_empty": "Buscar",
    "subheading": "En las herramientas, el archivo y The Mini Exchange",
    "added_by": "añadido por",
    "verified": "Verificado",
    "for_sale": "En venta",
    "filters": { "all": "Todo" },
    "empty_title": "Sin resultados para \"{query}\"",
    "empty_no_query": "¿Qué estás buscando?",
    "empty_body": "Prueba con menos palabras o pide a la comunidad que cubra el hueco.",
    "request_it": "Pídelo"
  },
  "fr": {
    "title": "Recherche — Classic Mini DIY",
    "title_with_query": "« {query} » — Recherche",
    "heading": "{count} résultats pour « {query} »",
    "heading_empty": "Recherche",
    "subheading": "Dans les outils, les archives et The Mini Exchange",
    "added_by": "ajouté par",
    "verified": "Vérifié",
    "for_sale": "À vendre",
    "filters": { "all": "Tout" },
    "empty_title": "Aucun résultat pour « {query} »",
    "empty_no_query": "Que cherchez-vous ?",
    "empty_body": "Essayez moins de mots, ou demandez à la communauté de combler le manque.",
    "request_it": "Demandez-le"
  },
  "de": {
    "title": "Suche — Classic Mini DIY",
    "title_with_query": "„{query}“ — Suche",
    "heading": "{count} Ergebnisse für „{query}“",
    "heading_empty": "Suche",
    "subheading": "In Werkzeugen, Archiv und The Mini Exchange",
    "added_by": "hinzugefügt von",
    "verified": "Geprüft",
    "for_sale": "Zu verkaufen",
    "filters": { "all": "Alle" },
    "empty_title": "Keine Ergebnisse für „{query}“",
    "empty_no_query": "Wonach suchst du?",
    "empty_body": "Versuche weniger Wörter, oder bitte die Community, die Lücke zu füllen.",
    "request_it": "Anfragen"
  },
  "it": {
    "title": "Cerca — Classic Mini DIY",
    "title_with_query": "\"{query}\" — Ricerca",
    "heading": "{count} risultati per \"{query}\"",
    "heading_empty": "Cerca",
    "subheading": "Tra strumenti, archivio e The Mini Exchange",
    "added_by": "aggiunto da",
    "verified": "Verificato",
    "for_sale": "In vendita",
    "filters": { "all": "Tutti" },
    "empty_title": "Nessun risultato per \"{query}\"",
    "empty_no_query": "Cosa stai cercando?",
    "empty_body": "Prova con meno parole, o chiedi alla community di colmare la lacuna.",
    "request_it": "Richiedilo"
  },
  "pt": {
    "title": "Pesquisa — Classic Mini DIY",
    "title_with_query": "\"{query}\" — Pesquisa",
    "heading": "{count} resultados para \"{query}\"",
    "heading_empty": "Pesquisa",
    "subheading": "Nas ferramentas, no arquivo e no The Mini Exchange",
    "added_by": "adicionado por",
    "verified": "Verificado",
    "for_sale": "À venda",
    "filters": { "all": "Tudo" },
    "empty_title": "Sem resultados para \"{query}\"",
    "empty_no_query": "O que procura?",
    "empty_body": "Tente menos palavras, ou peça à comunidade para preencher a lacuna.",
    "request_it": "Peça"
  },
  "ru": {
    "title": "Поиск — Classic Mini DIY",
    "title_with_query": "«{query}» — Поиск",
    "heading": "Результатов по запросу «{query}»: {count}",
    "heading_empty": "Поиск",
    "subheading": "По инструментам, архиву и The Mini Exchange",
    "added_by": "добавил",
    "verified": "Проверено",
    "for_sale": "Продаётся",
    "filters": { "all": "Всё" },
    "empty_title": "Нет результатов по запросу «{query}»",
    "empty_no_query": "Что вы ищете?",
    "empty_body": "Попробуйте меньше слов или попросите сообщество закрыть пробел.",
    "request_it": "Запросить"
  },
  "ja": {
    "title": "検索 — Classic Mini DIY",
    "title_with_query": "「{query}」— 検索",
    "heading": "「{query}」の結果 {count} 件",
    "heading_empty": "検索",
    "subheading": "ツールボックス、アーカイブ、The Mini Exchange を横断",
    "added_by": "投稿者",
    "verified": "確認済み",
    "for_sale": "販売中",
    "filters": { "all": "すべて" },
    "empty_title": "「{query}」の結果はありません",
    "empty_no_query": "何をお探しですか？",
    "empty_body": "語数を減らすか、コミュニティにリクエストしてみてください。",
    "request_it": "リクエストする"
  },
  "zh": {
    "title": "搜索 — Classic Mini DIY",
    "title_with_query": "“{query}” — 搜索",
    "heading": "“{query}”的 {count} 条结果",
    "heading_empty": "搜索",
    "subheading": "涵盖工具箱、档案馆和 The Mini Exchange",
    "added_by": "贡献者",
    "verified": "已验证",
    "for_sale": "出售中",
    "filters": { "all": "全部" },
    "empty_title": "没有“{query}”的结果",
    "empty_no_query": "你在找什么？",
    "empty_body": "试试更少的关键词，或者请社区补上这块内容。",
    "request_it": "请求收录"
  },
  "ko": {
    "title": "검색 — Classic Mini DIY",
    "title_with_query": "\"{query}\" — 검색",
    "heading": "\"{query}\" 검색 결과 {count}건",
    "heading_empty": "검색",
    "subheading": "도구상자, 아카이브, The Mini Exchange 전체",
    "added_by": "등록",
    "verified": "확인됨",
    "for_sale": "판매 중",
    "filters": { "all": "전체" },
    "empty_title": "\"{query}\"에 대한 결과가 없습니다",
    "empty_no_query": "무엇을 찾고 계신가요?",
    "empty_body": "검색어를 줄이거나, 커뮤니티에 요청해 보세요.",
    "request_it": "요청하기"
  }
}
</i18n>
