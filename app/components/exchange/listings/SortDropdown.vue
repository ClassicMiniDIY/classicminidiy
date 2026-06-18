<template>
  <div class="flex items-center gap-2">
    <label for="listing-sort-select" class="label">
      <span class="label-text text-sm font-medium">{{ t('sortBy') }}</span>
    </label>
    <select id="listing-sort-select" v-model="sortBy" class="select select-sm">
      <option value="newest">{{ t('newestFirst') }}</option>
      <option value="oldest">{{ t('oldestFirst') }}</option>
      <option value="price_asc">{{ t('priceLowToHigh') }}</option>
      <option value="price_desc">{{ t('priceHighToLow') }}</option>
      <option value="year_asc">{{ t('yearOldestFirst') }}</option>
      <option value="year_desc">{{ t('yearNewestFirst') }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  const { capture } = usePostHog();

  const props = defineProps<{
    resultsCount?: number;
  }>();

  const sortBy = defineModel<string>({ required: true });

  // Map internal sort values to analytics sort values
  const mapSortToAnalytics = (sort: string): 'newest' | 'oldest' | 'price_low' | 'price_high' | null => {
    switch (sort) {
      case 'newest':
        return 'newest';
      case 'oldest':
        return 'oldest';
      case 'price_asc':
        return 'price_low';
      case 'price_desc':
        return 'price_high';
      default:
        return null;
    }
  };

  // Track sort changes
  watch(sortBy, (newValue, oldValue) => {
    // Only track if actually changed and not initial load
    if (newValue && newValue !== oldValue) {
      const analyticsSort = mapSortToAnalytics(newValue);
      if (analyticsSort) {
        capture('sort_changed', {
          sort_by: analyticsSort,
          results_count: props.resultsCount ?? 0,
        });
      }
    }
  });
</script>

<i18n lang="json">
{
  "en": { "sortBy": "Sort by:", "newestFirst": "Newest First", "oldestFirst": "Oldest First", "priceLowToHigh": "Price: Low to High", "priceHighToLow": "Price: High to Low", "yearOldestFirst": "Year: Oldest First", "yearNewestFirst": "Year: Newest First", "results": "{count} results" },
  "es": { "sortBy": "Ordenar por:", "newestFirst": "Más recientes primero", "oldestFirst": "Más antiguos primero", "priceLowToHigh": "Precio: de menor a mayor", "priceHighToLow": "Precio: de mayor a menor", "yearOldestFirst": "Año: más antiguos primero", "yearNewestFirst": "Año: más recientes primero", "results": "{count} resultados" },
  "fr": { "sortBy": "Trier par :", "newestFirst": "Plus récents d'abord", "oldestFirst": "Plus anciens d'abord", "priceLowToHigh": "Prix : du plus bas au plus élevé", "priceHighToLow": "Prix : du plus élevé au plus bas", "yearOldestFirst": "Année : du plus ancien au plus récent", "yearNewestFirst": "Année : du plus récent au plus ancien", "results": "{count} résultats" },
  "de": { "sortBy": "Sortieren nach:", "newestFirst": "Neueste zuerst", "oldestFirst": "Älteste zuerst", "priceLowToHigh": "Preis: aufsteigend", "priceHighToLow": "Preis: absteigend", "yearOldestFirst": "Jahr: älteste zuerst", "yearNewestFirst": "Jahr: neueste zuerst", "results": "{count} Ergebnisse" },
  "it": { "sortBy": "Ordina per:", "newestFirst": "Più recenti prima", "oldestFirst": "Più vecchi prima", "priceLowToHigh": "Prezzo: dal più basso al più alto", "priceHighToLow": "Prezzo: dal più alto al più basso", "yearOldestFirst": "Anno: dal più vecchio al più recente", "yearNewestFirst": "Anno: dal più recente al più vecchio", "results": "{count} risultati" },
  "pt": { "sortBy": "Ordenar por:", "newestFirst": "Mais recentes primeiro", "oldestFirst": "Mais antigos primeiro", "priceLowToHigh": "Preço: do menor ao maior", "priceHighToLow": "Preço: do maior ao menor", "yearOldestFirst": "Ano: dos mais antigos aos mais recentes", "yearNewestFirst": "Ano: dos mais recentes aos mais antigos", "results": "{count} resultados" },
  "ru": { "sortBy": "Сортировать по:", "newestFirst": "Сначала новые", "oldestFirst": "Сначала старые", "priceLowToHigh": "Цена: по возрастанию", "priceHighToLow": "Цена: по убыванию", "yearOldestFirst": "Год: сначала старые", "yearNewestFirst": "Год: сначала новые", "results": "{count} результатов" },
  "ja": { "sortBy": "並び替え:", "newestFirst": "新しい順", "oldestFirst": "古い順", "priceLowToHigh": "価格: 安い順", "priceHighToLow": "価格: 高い順", "yearOldestFirst": "年式: 古い順", "yearNewestFirst": "年式: 新しい順", "results": "{count} 件" },
  "zh": { "sortBy": "排序方式：", "newestFirst": "最新优先", "oldestFirst": "最早优先", "priceLowToHigh": "价格：从低到高", "priceHighToLow": "价格：从高到低", "yearOldestFirst": "年份：从旧到新", "yearNewestFirst": "年份：从新到旧", "results": "{count} 个结果" },
  "ko": { "sortBy": "정렬 기준:", "newestFirst": "최신순", "oldestFirst": "오래된순", "priceLowToHigh": "가격: 낮은순", "priceHighToLow": "가격: 높은순", "yearOldestFirst": "연식: 오래된순", "yearNewestFirst": "연식: 최신순", "results": "결과 {count}개" }
}
</i18n>
