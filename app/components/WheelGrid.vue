<script lang="ts" setup>
  import type { IWheelsData } from '../../data/models/wheels';
  import Fuse from 'fuse.js';

  const { t } = useI18n();

  // State management with proper typing
  const search = ref('');
  const size = ref('list');
  const page = ref(1);
  const selectedOffsets = ref<string[]>([]);
  const selectedMaterials = ref<string[]>([]);

  // Fetch wheels data from Supabase via composable
  const { listBySizeName } = useWheels();
  const {
    data: wheels,
    status,
    error,
  } = await useAsyncData(`wheels-${size.value}`, () => listBySizeName(size.value), {
    watch: [size],
    default: () => [],
  });

  // Create a Fuse instance for fuzzy searching with memoization
  const fuseInstance = computed(() => {
    if (!wheels.value?.length) return null;

    // Configure Fuse.js options
    const options = {
      keys: ['name', 'size', 'width', 'offset', 'type'],
      threshold: 0.4, // Lower threshold means more strict matching
      ignoreLocation: true,
      shouldSort: true,
    };

    return new Fuse(wheels.value, options);
  });

  // Efficient filtering with memoization using Fuse.js
  const filteredWheels = computed(() => {
    if (!wheels.value?.length) return [];
    const hasOffsetFilter = selectedOffsets.value.length > 0;
    const hasMaterialFilter = selectedMaterials.value.length > 0;
    // First apply material and offset filters
    let results = wheels.value.filter((wheel) => {
      // Only check filter matches when filters are active
      const offsetMatch = !hasOffsetFilter || selectedOffsets.value.includes(wheel.offset?.trim() || '');
      const materialMatch = !hasMaterialFilter || selectedMaterials.value.includes(wheel.type?.trim() || '');
      return offsetMatch && materialMatch;
    });

    // Then apply Fuse.js search if search term exists
    if (search.value && fuseInstance.value) {
      results = fuseInstance.value.search(search.value).map((result) => result.item);
    }

    return results;
  });

  // Computed property for active filters state
  const filtersActive = computed(
    () => selectedOffsets.value.length > 0 || selectedMaterials.value.length > 0 || search.value !== ''
  );

  // Helper function to clear all filters
  function clearFilters() {
    search.value = '';
    selectedOffsets.value = [];
    selectedMaterials.value = [];
  }

  // Default fallback image URL for reuse
  const DEFAULT_WHEEL_IMAGE = 'https://classicminidiy.s3.us-east-1.amazonaws.com/wheels/missing-wheel-image.png';

  // Helper function to get proper image URL with fallback
  function getWheelImageUrl(wheel: IWheelsData): string {
    if (
      !wheel.images?.[0]?.src ||
      wheel.images[0].src === 'https://classicminidiy.s3.amazonaws.com/cloud-icon/missing.svg'
    ) {
      return DEFAULT_WHEEL_IMAGE;
    }
    return wheel.images[0].src;
  }
</script>

<template>
  <UCard>
    <!-- Header section -->
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-lg"><i class="fad fa-tire fa-spin mr-2"></i> {{ t('title') }}</h2>
        <UTooltip v-if="filtersActive" :text="t('clear_filters')">
          <UButton variant="ghost" size="sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark mr-1"></i>
            {{ t('clear_filters') }}
          </UButton>
        </UTooltip>
      </div>
    </template>

    <div class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="col-span-1 md:col-span-1 mb-4">
          <UButtonGroup>
            <UButton
              :color="size === 'list' ? 'primary' : 'neutral'"
              :variant="size === 'list' ? 'solid' : 'outline'"
              @click="size = 'list'"
            >
              {{ t('all_sizes') }}
            </UButton>
            <UButton
              :color="size === 'ten' ? 'primary' : 'neutral'"
              :variant="size === 'ten' ? 'solid' : 'outline'"
              @click="size = 'ten'"
            >
              {{ t('ten_inch_wheels') }}
            </UButton>
            <UButton
              :color="size === 'twelve' ? 'primary' : 'neutral'"
              :variant="size === 'twelve' ? 'solid' : 'outline'"
              @click="size = 'twelve'"
            >
              {{ t('twelve_inch_wheels') }}
            </UButton>
            <UButton
              :color="size === 'thirteen' ? 'primary' : 'neutral'"
              :variant="size === 'thirteen' ? 'solid' : 'outline'"
              @click="size = 'thirteen'"
            >
              {{ t('thirteen_inch_wheels') }}
            </UButton>
          </UButtonGroup>
        </div>
      </div>

      <UInput v-model="search" :placeholder="t('search_placeholder')" icon="i-fa6-solid-magnifying-glass" size="lg" />
    </div>

    <!-- Content section -->
    <div>
      <!-- Error state -->
      <UAlert
        v-if="error"
        color="error"
        :title="error.message || t('error_loading')"
        icon="i-fa6-solid-circle-exclamation"
      />

      <!-- Loading state -->
      <div v-else-if="status === 'pending'" class="flex justify-center p-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>

      <!-- No results -->
      <div v-else-if="filteredWheels.length === 0" class="text-center p-8">
        <i class="fas fa-tire text-6xl text-muted mb-4"></i>
        <h3 class="text-xl font-semibold mb-2">{{ t('no_results_title') }}</h3>
        <p class="text-muted">{{ t('no_results_message') }}</p>
      </div>

      <!-- Grid of wheels -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <UCard
          v-for="wheel in filteredWheels.slice((page - 1) * 12, page * 12)"
          :key="wheel.uuid"
          class="hover:shadow-lg transition-shadow duration-300"
        >
          <template #header>
            <figure class="relative pt-[100%] bg-muted rounded-t-lg">
              <img
                :src="getWheelImageUrl(wheel)"
                :alt="wheel.name"
                class="absolute inset-0 w-full h-full object-contain p-4"
                loading="lazy"
              />
            </figure>
          </template>
          <h3 class="font-semibold text-lg mb-2">{{ wheel.name }}</h3>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div class="text-muted">{{ t('size_label') }}</div>
              <div class="font-medium">{{ wheel.size || t('not_available') }}</div>
            </div>
            <div>
              <div class="text-muted">{{ t('width_label') }}</div>
              <div class="font-medium">{{ wheel.width || t('not_available') }}</div>
            </div>
            <div>
              <div class="text-muted">{{ t('offset_label') }}</div>
              <div class="font-medium">{{ wheel.offset || t('not_available') }}</div>
            </div>
            <div>
              <div class="text-muted">{{ t('material_label') }}</div>
              <div class="font-medium">{{ wheel.type || t('not_available') }}</div>
            </div>
          </div>
          <template #footer>
            <div class="flex justify-end">
              <UButton :to="`/archive/wheels/${wheel.uuid}`" size="sm" color="secondary">
                {{ t('view_details') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </div>

    <!-- Pagination footer -->
    <template #footer>
      <div class="flex items-center justify-center">
        <UButtonGroup>
          <UButton :disabled="page === 1" @click="page > 1 && page--">
            <i class="fad fa-arrow-left"></i>
          </UButton>
          <UButton variant="ghost" color="neutral">
            {{ t('page_info', { current: page, total: Math.ceil(filteredWheels.length / 12) }) }}
          </UButton>
          <UButton
            :disabled="page >= Math.ceil(filteredWheels.length / 12)"
            @click="page < Math.ceil(filteredWheels.length / 12) && page++"
          >
            <i class="fad fa-arrow-right"></i>
          </UButton>
        </UButtonGroup>
      </div>
    </template>
  </UCard>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Wheel Registry",
    "clear_filters": "Clear Filters",
    "all_sizes": "All Sizes",
    "ten_inch_wheels": "10\" Wheels",
    "twelve_inch_wheels": "12\" Wheels",
    "thirteen_inch_wheels": "13\" Wheels",
    "search_label": "Search wheels",
    "search_placeholder": "Search by name, size, width, offset, or material...",
    "error_loading": "Error loading wheels",
    "no_results_title": "No wheels found",
    "no_results_message": "Try adjusting your search or filters",
    "size_label": "Size",
    "width_label": "Width",
    "offset_label": "Offset",
    "material_label": "Material",
    "not_available": "N/A",
    "view_details": "View Details",
    "page_info": "Page {current} of {total}"
  },
  "de": {
    "title": "Felgen-Register",
    "clear_filters": "Filter löschen",
    "all_sizes": "Alle Größen",
    "ten_inch_wheels": "10\" Felgen",
    "twelve_inch_wheels": "12\" Felgen",
    "thirteen_inch_wheels": "13\" Felgen",
    "search_label": "Felgen suchen",
    "search_placeholder": "Suche nach Name, Größe, Breite, Offset oder Material...",
    "error_loading": "Fehler beim Laden der Felgen",
    "no_results_title": "Keine Felgen gefunden",
    "no_results_message": "Versuchen Sie, Ihre Suche oder Filter anzupassen",
    "size_label": "Größe",
    "width_label": "Breite",
    "offset_label": "Offset",
    "material_label": "Material",
    "not_available": "N/V",
    "view_details": "Details anzeigen",
    "page_info": "Seite {current} von {total}"
  },
  "es": {
    "title": "Registro de Llantas",
    "clear_filters": "Limpiar Filtros",
    "all_sizes": "Todos los Tamaños",
    "ten_inch_wheels": "Llantas 10\"",
    "twelve_inch_wheels": "Llantas 12\"",
    "thirteen_inch_wheels": "Llantas 13\"",
    "search_label": "Buscar llantas",
    "search_placeholder": "Buscar por nombre, tamaño, ancho, offset o material...",
    "error_loading": "Error al cargar las llantas",
    "no_results_title": "No se encontraron llantas",
    "no_results_message": "Intenta ajustar tu búsqueda o filtros",
    "size_label": "Tamaño",
    "width_label": "Ancho",
    "offset_label": "Offset",
    "material_label": "Material",
    "not_available": "N/D",
    "view_details": "Ver Detalles",
    "page_info": "Página {current} de {total}"
  },
  "fr": {
    "title": "Registre des Jantes",
    "clear_filters": "Effacer les Filtres",
    "all_sizes": "Toutes les Tailles",
    "ten_inch_wheels": "Jantes 10\"",
    "twelve_inch_wheels": "Jantes 12\"",
    "thirteen_inch_wheels": "Jantes 13\"",
    "search_label": "Rechercher des jantes",
    "search_placeholder": "Rechercher par nom, taille, largeur, offset ou matériau...",
    "error_loading": "Erreur lors du chargement des jantes",
    "no_results_title": "Aucune jante trouvée",
    "no_results_message": "Essayez d'ajuster votre recherche ou vos filtres",
    "size_label": "Taille",
    "width_label": "Largeur",
    "offset_label": "Offset",
    "material_label": "Matériau",
    "not_available": "N/D",
    "view_details": "Voir les Détails",
    "page_info": "Page {current} sur {total}"
  },
  "it": {
    "title": "Registro Cerchi",
    "clear_filters": "Cancella Filtri",
    "all_sizes": "Tutte le Dimensioni",
    "ten_inch_wheels": "Cerchi 10\"",
    "twelve_inch_wheels": "Cerchi 12\"",
    "thirteen_inch_wheels": "Cerchi 13\"",
    "search_label": "Cerca cerchi",
    "search_placeholder": "Cerca per nome, dimensione, larghezza, offset o materiale...",
    "error_loading": "Errore nel caricamento dei cerchi",
    "no_results_title": "Nessun cerchio trovato",
    "no_results_message": "Prova ad aggiustare la tua ricerca o i filtri",
    "size_label": "Dimensione",
    "width_label": "Larghezza",
    "offset_label": "Offset",
    "material_label": "Materiale",
    "not_available": "N/D",
    "view_details": "Vedi Dettagli",
    "page_info": "Pagina {current} di {total}"
  },
  "ja": {
    "title": "ホイール登録",
    "clear_filters": "フィルターをクリア",
    "all_sizes": "すべてのサイズ",
    "ten_inch_wheels": "10\"ホイール",
    "twelve_inch_wheels": "12\"ホイール",
    "thirteen_inch_wheels": "13\"ホイール",
    "search_label": "ホイールを検索",
    "search_placeholder": "名前、サイズ、幅、オフセット、または材質で検索...",
    "error_loading": "ホイールの読み込みエラー",
    "no_results_title": "ホイールが見つかりません",
    "no_results_message": "検索またはフィルターを調整してください",
    "size_label": "サイズ",
    "width_label": "幅",
    "offset_label": "オフセット",
    "material_label": "材質",
    "not_available": "N/A",
    "view_details": "詳細を見る",
    "page_info": "ページ {current} / {total}"
  },
  "ko": {
    "title": "휠 등록부",
    "clear_filters": "필터 지우기",
    "all_sizes": "모든 크기",
    "ten_inch_wheels": "10\" 휠",
    "twelve_inch_wheels": "12\" 휠",
    "thirteen_inch_wheels": "13\" 휠",
    "search_label": "휠 검색",
    "search_placeholder": "이름, 크기, 너비, 오프셋 또는 재질로 검색...",
    "error_loading": "휠 로딩 오류",
    "no_results_title": "휠을 찾을 수 없습니다",
    "no_results_message": "검색 또는 필터를 조정해 보세요",
    "size_label": "크기",
    "width_label": "너비",
    "offset_label": "오프셋",
    "material_label": "재질",
    "not_available": "N/A",
    "view_details": "세부 정보 보기",
    "page_info": "페이지 {current} / {total}"
  },
  "pt": {
    "title": "Registro de Rodas",
    "clear_filters": "Limpar Filtros",
    "all_sizes": "Todos os Tamanhos",
    "ten_inch_wheels": "Rodas 10\"",
    "twelve_inch_wheels": "Rodas 12\"",
    "thirteen_inch_wheels": "Rodas 13\"",
    "search_label": "Pesquisar rodas",
    "search_placeholder": "Pesquisar por nome, tamanho, largura, offset ou material...",
    "error_loading": "Erro ao carregar rodas",
    "no_results_title": "Nenhuma roda encontrada",
    "no_results_message": "Tente ajustar sua pesquisa ou filtros",
    "size_label": "Tamanho",
    "width_label": "Largura",
    "offset_label": "Offset",
    "material_label": "Material",
    "not_available": "N/D",
    "view_details": "Ver Detalhes",
    "page_info": "Página {current} de {total}"
  },
  "ru": {
    "title": "Реестр Дисков",
    "clear_filters": "Очистить Фильтры",
    "all_sizes": "Все Размеры",
    "ten_inch_wheels": "Диски 10\"",
    "twelve_inch_wheels": "Диски 12\"",
    "thirteen_inch_wheels": "Диски 13\"",
    "search_label": "Поиск дисков",
    "search_placeholder": "Поиск по названию, размеру, ширине, вылету или материалу...",
    "error_loading": "Ошибка загрузки дисков",
    "no_results_title": "Диски не найдены",
    "no_results_message": "Попробуйте изменить поиск или фильтры",
    "size_label": "Размер",
    "width_label": "Ширина",
    "offset_label": "Вылет",
    "material_label": "Материал",
    "not_available": "Н/Д",
    "view_details": "Подробности",
    "page_info": "Страница {current} из {total}"
  },
  "zh": {
    "title": "轮毂注册表",
    "clear_filters": "清除过滤器",
    "all_sizes": "所有尺寸",
    "ten_inch_wheels": "10\"轮毂",
    "twelve_inch_wheels": "12\"轮毂",
    "thirteen_inch_wheels": "13\"轮毂",
    "search_label": "搜索轮毂",
    "search_placeholder": "按名称、尺寸、宽度、偏移量或材质搜索...",
    "error_loading": "加载轮毂时出错",
    "no_results_title": "未找到轮毂",
    "no_results_message": "尝试调整您的搜索或过滤器",
    "size_label": "尺寸",
    "width_label": "宽度",
    "offset_label": "偏移量",
    "material_label": "材质",
    "not_available": "不适用",
    "view_details": "查看详情",
    "page_info": "第 {current} 页，共 {total} 页"
  }
}
</i18n>

<style scoped>
  .wheel-chip {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    backdrop-filter: blur(4px);
    background-color: rgba(255, 255, 255, 0.8);
  }

  /* Custom styling for multi-select dropdowns */
  select[multiple] {
    min-height: 6rem;
  }

  /* Loading state for the card */
  .loading {
    position: relative;
    pointer-events: none;
  }

  .loading::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.7);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading::before {
    content: '';
    width: 2rem;
    height: 2rem;
    border: 3px solid #3b82f6;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    z-index: 11;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
