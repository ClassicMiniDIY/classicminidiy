<template>
  <div class="flex flex-wrap items-end gap-3">
    <!-- Source Site -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend text-xs">{{ t('source.label') }}</legend>
      <select
        :value="modelValue.sourceSite || ''"
        class="select select-bordered select-sm"
        @change="updateFilter('sourceSite', ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">{{ t('source.all') }}</option>
        <option value="bat">{{ t('source.bat') }}</option>
        <option value="carsandbids">{{ t('source.carsandbids') }}</option>
        <option value="copart">{{ t('source.copart') }}</option>
        <option value="craigslist">{{ t('source.craigslist') }}</option>
        <option value="facebook">{{ t('source.facebook') }}</option>
        <option value="ebay">{{ t('source.ebay') }}</option>
        <option value="other">{{ t('source.other') }}</option>
      </select>
    </fieldset>

    <!-- Category -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend text-xs">{{ t('category.label') }}</legend>
      <select
        :value="modelValue.category || ''"
        class="select select-bordered select-sm"
        @change="updateFilter('category', ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">{{ t('category.all') }}</option>
        <option value="vehicle">{{ t('category.vehicle') }}</option>
        <option value="engine">{{ t('category.engine') }}</option>
        <option value="parts">{{ t('category.parts') }}</option>
      </select>
    </fieldset>

    <!-- Sort -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend text-xs">{{ t('sort.label') }}</legend>
      <select
        :value="currentSort"
        class="select select-bordered select-sm"
        @change="updateSort(($event.target as HTMLSelectElement).value)"
      >
        <option value="newest">{{ t('sort.newest') }}</option>
        <option value="most_liked">{{ t('sort.mostLiked') }}</option>
        <option value="ending_soon">{{ t('sort.endingSoon') }}</option>
      </select>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
  import type { FindFilters } from '~/composables/useExternalListings';

  const { t } = useI18n();

  const props = defineProps<{
    modelValue: FindFilters;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: FindFilters];
  }>();

  const currentSort = computed(() => props.modelValue.sort || 'newest');

  /**
   * Update a single filter key and emit the full filters object.
   */
  const updateFilter = (key: keyof FindFilters, value: any) => {
    emit('update:modelValue', {
      ...props.modelValue,
      [key]: value,
      page: 1,
    });
  };

  const updateSort = (value: string) => {
    emit('update:modelValue', {
      ...props.modelValue,
      sort: value as FindFilters['sort'],
      page: 1,
    });
  };
</script>

<i18n lang="json">
{
  "en": {
    "source": { "label": "Source", "all": "All Sources", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "Other" },
    "category": { "label": "Category", "all": "All Categories", "vehicle": "Vehicle", "engine": "Engine", "parts": "Parts" },
    "sort": { "label": "Sort", "newest": "Newest", "mostLiked": "Most Liked", "endingSoon": "Ending Soon" }
  },
  "es": {
    "source": { "label": "Origen", "all": "Todos los orígenes", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "Otro" },
    "category": { "label": "Categoría", "all": "Todas las categorías", "vehicle": "Vehículo", "engine": "Motor", "parts": "Piezas" },
    "sort": { "label": "Ordenar", "newest": "Más recientes", "mostLiked": "Más populares", "endingSoon": "Terminan pronto" }
  },
  "fr": {
    "source": { "label": "Source", "all": "Toutes les sources", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "Autre" },
    "category": { "label": "Catégorie", "all": "Toutes les catégories", "vehicle": "Véhicule", "engine": "Moteur", "parts": "Pièces" },
    "sort": { "label": "Trier", "newest": "Plus récentes", "mostLiked": "Plus aimées", "endingSoon": "Se terminent bientôt" }
  },
  "de": {
    "source": { "label": "Quelle", "all": "Alle Quellen", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "Sonstige" },
    "category": { "label": "Kategorie", "all": "Alle Kategorien", "vehicle": "Fahrzeug", "engine": "Motor", "parts": "Teile" },
    "sort": { "label": "Sortieren", "newest": "Neueste", "mostLiked": "Beliebteste", "endingSoon": "Endet bald" }
  },
  "it": {
    "source": { "label": "Fonte", "all": "Tutte le fonti", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "Altro" },
    "category": { "label": "Categoria", "all": "Tutte le categorie", "vehicle": "Veicolo", "engine": "Motore", "parts": "Ricambi" },
    "sort": { "label": "Ordina", "newest": "Più recenti", "mostLiked": "Più apprezzate", "endingSoon": "In scadenza" }
  },
  "pt": {
    "source": { "label": "Origem", "all": "Todas as origens", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "Outro" },
    "category": { "label": "Categoria", "all": "Todas as categorias", "vehicle": "Veículo", "engine": "Motor", "parts": "Peças" },
    "sort": { "label": "Ordenar", "newest": "Mais recentes", "mostLiked": "Mais curtidas", "endingSoon": "Terminando em breve" }
  },
  "ru": {
    "source": { "label": "Источник", "all": "Все источники", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "Другое" },
    "category": { "label": "Категория", "all": "Все категории", "vehicle": "Автомобиль", "engine": "Двигатель", "parts": "Запчасти" },
    "sort": { "label": "Сортировка", "newest": "Новые", "mostLiked": "Популярные", "endingSoon": "Скоро завершатся" }
  },
  "ja": {
    "source": { "label": "ソース", "all": "すべてのソース", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "その他" },
    "category": { "label": "カテゴリー", "all": "すべてのカテゴリー", "vehicle": "車両", "engine": "エンジン", "parts": "パーツ" },
    "sort": { "label": "並び替え", "newest": "新着順", "mostLiked": "人気順", "endingSoon": "まもなく終了" }
  },
  "zh": {
    "source": { "label": "来源", "all": "所有来源", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "其他" },
    "category": { "label": "类别", "all": "所有类别", "vehicle": "整车", "engine": "发动机", "parts": "配件" },
    "sort": { "label": "排序", "newest": "最新", "mostLiked": "最受欢迎", "endingSoon": "即将结束" }
  },
  "ko": {
    "source": { "label": "출처", "all": "모든 출처", "bat": "Bring a Trailer", "carsandbids": "Cars & Bids", "copart": "Copart", "craigslist": "Craigslist", "facebook": "Facebook", "ebay": "eBay", "other": "기타" },
    "category": { "label": "카테고리", "all": "모든 카테고리", "vehicle": "차량", "engine": "엔진", "parts": "부품" },
    "sort": { "label": "정렬", "newest": "최신순", "mostLiked": "인기순", "endingSoon": "마감 임박" }
  }
}
</i18n>
