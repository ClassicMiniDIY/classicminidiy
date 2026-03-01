<script lang="ts" setup>
  import { shareArchiveItem, submitArchiveFile, type ARCHIVE_TYPES } from '../../data/models/helper-utils';

  interface ArchiveItem {
    title: string;
    description: string | null;
    image: string;
    download: string;
    code: string;
    path: string;
  }

  const { t } = useI18n();
  const search = ref('');
  const currentPage = ref(1);
  const itemsPerPage = 12;
  const viewMode = ref<'cards' | 'table'>('table');

  const props = defineProps({
    archiveType: {
      type: String as PropType<ARCHIVE_TYPES>,
      default: '',
    },
    content: {
      type: Array as PropType<ArchiveItem[] | null>,
      default: () => [],
    },
    loading: {
      type: String as PropType<'idle' | 'pending' | 'success' | 'error'>,
      default: 'idle',
    },
  });

  const filteredItems = computed(() => {
    if (!props.content) return [];

    return props.content.filter((item) => {
      const searchLower = search.value.toLowerCase();
      if (!searchLower) return true;

      return (
        item.title?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.code?.toLowerCase().includes(searchLower)
      );
    });
  });

  const paginatedItems = computed(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredItems.value.slice(startIndex, endIndex);
  });

  const pageCount = computed(() => {
    return Math.ceil(filteredItems.value.length / itemsPerPage);
  });

  function prevPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  function nextPage() {
    if (currentPage.value < pageCount.value) {
      currentPage.value++;
    }
  }
</script>

<template>
  <div class="w-full">
    <!-- Search Header and View Toggle -->
    <div class="mb-8 w-full">
      <div class="flex flex-col lg:flex-row gap-4 items-end">
        <div class="flex-1">
          <UInput
            v-model="search"
            :placeholder="t('search_placeholder')"
            icon="i-fa6-solid-magnifying-glass"
            size="lg"
          />
        </div>

        <!-- View Mode Toggle -->
        <UButtonGroup>
          <UButton
            :color="viewMode === 'cards' ? 'primary' : 'neutral'"
            :variant="viewMode === 'cards' ? 'solid' : 'outline'"
            @click="viewMode = 'cards'"
          >
            <i class="fad fa-grid-2 mr-2"></i>
            {{ t('view_modes.cards') }}
          </UButton>
          <UButton
            :color="viewMode === 'table' ? 'primary' : 'neutral'"
            :variant="viewMode === 'table' ? 'solid' : 'outline'"
            @click="viewMode = 'table'"
          >
            <i class="fad fa-table mr-2"></i>
            {{ t('view_modes.table') }}
          </UButton>
        </UButtonGroup>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading === 'pending'">
      <!-- Cards Loading Skeleton -->
      <div v-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <UCard v-for="k in 12" :key="k" class="animate-pulse">
          <template #header>
            <div class="h-[150px] bg-muted rounded-t-lg"></div>
          </template>
          <div class="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-muted rounded w-1/2 mb-4"></div>
          <div class="h-3 bg-muted rounded w-full"></div>
          <template #footer>
            <div class="flex justify-between gap-2">
              <div class="h-8 bg-muted rounded w-1/4"></div>
              <div class="h-8 bg-muted rounded w-1/4"></div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Table Loading Skeleton -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b border-default">
            <tr>
              <th class="hidden md:table-cell p-3 text-left">{{ t('table_headers.image') }}</th>
              <th class="hidden md:table-cell p-3 text-center">{{ t('table_headers.file_type') }}</th>
              <th class="p-3 text-left">{{ t('table_headers.title') }}</th>
              <th class="p-3 text-right">{{ t('table_headers.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="k in 12" :key="k" class="animate-pulse border-b border-default">
              <td class="p-3"><div class="h-12 w-12 bg-muted rounded"></div></td>
              <td class="p-3"><div class="h-4 bg-muted rounded w-3/4"></div></td>
              <td class="p-3"><div class="h-4 bg-muted rounded w-full"></div></td>
              <td class="p-3"><div class="h-8 bg-muted rounded w-1/2"></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Content Views -->
    <div v-else>
      <!-- Empty State -->
      <div v-if="filteredItems.length === 0" class="text-center py-8">
        <UCard>
          <p class="text-muted">{{ t('empty_state') }}</p>
        </UCard>
      </div>

      <!-- Cards View -->
      <div v-else-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard v-for="item in paginatedItems" :key="item.title" class="relative">
          <!-- Image Section -->
          <template #header>
            <figure v-if="item.image && item.image !== ''" class="relative">
              <a v-if="item.download && item.download !== ''" :href="item.download" target="_blank">
                <img :src="item.image" :alt="item.title" class="h-[150px] w-full object-cover rounded-t-lg" />
              </a>
              <img v-else :src="item.image" :alt="item.title" class="h-[150px] w-full object-cover rounded-t-lg" />
              <!-- File Type Icon -->
              <div v-if="item.download" class="absolute top-2 right-2">
                <i
                  :class="[
                    'fad',
                    'fa-file-' + (item?.download?.split('.').pop()?.toLowerCase() || ''),
                    'text-2xl',
                    'text-secondary',
                  ]"
                ></i>
              </div>
            </figure>
            <div v-else class="flex justify-center items-center h-[150px] bg-muted rounded-t-lg relative">
              <i class="fad fa-image-slash text-4xl text-muted"></i>
              <!-- File Type Icon -->
              <div v-if="item.download" class="absolute top-2 right-2">
                <i
                  :class="[
                    'fad',
                    'fa-file-' + (item?.download?.split('.').pop()?.toLowerCase() || ''),
                    'text-2xl',
                    'text-secondary',
                  ]"
                ></i>
              </div>
            </div>
          </template>

          <!-- Title and Code -->
          <h2 class="font-bold text-lg">{{ item.title }}</h2>
          <p class="text-sm text-muted">{{ t('sort_key_label') }} {{ item.code }}</p>

          <!-- Description -->
          <p class="text-sm my-2">{{ item.description }}</p>

          <!-- Actions -->
          <template #footer>
            <div class="flex justify-between gap-2">
              <UButton variant="outline" size="sm" @click="shareArchiveItem(item.title, item.path)">
                <i class="fad fa-arrow-up-from-bracket mr-1"></i>
                {{ t('actions.share') }}
              </UButton>

              <UButton
                v-if="item.download && item.download !== ''"
                :to="item.download"
                target="_blank"
                size="sm"
                color="primary"
              >
                <i class="fad fa-download mr-1"></i> {{ t('actions.download') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Table View -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <!-- head -->
          <thead class="border-b border-default">
            <tr>
              <th class="hidden md:table-cell p-3 text-left">{{ t('table_headers.image') }}</th>
              <th class="hidden md:table-cell p-3 text-center">{{ t('table_headers.file_type') }}</th>
              <th class="p-3 text-left">{{ t('table_headers.title') }}</th>
              <th class="p-3 text-right">{{ t('table_headers.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedItems" :key="item.title" class="border-b border-default hover:bg-muted/50">
              <!-- Image -->
              <td class="hidden md:table-cell p-3">
                <div class="flex items-center gap-3">
                  <div class="h-12 w-12 rounded-lg overflow-hidden">
                    <a v-if="item.download && item.download !== ''" :href="item.download" target="_blank">
                      <img
                        v-if="item.image && item.image !== ''"
                        :src="item.image"
                        :alt="item.title"
                        class="h-12 w-12 object-cover"
                      />
                      <div v-else class="flex justify-center items-center h-12 w-12 bg-muted">
                        <i class="fad fa-image-slash text-lg text-muted"></i>
                      </div>
                    </a>
                    <img
                      v-else-if="item.image && item.image !== ''"
                      :src="item.image"
                      :alt="item.title"
                      class="h-12 w-12 object-cover"
                    />
                    <div v-else class="flex justify-center items-center h-12 w-12 bg-muted">
                      <i class="fad fa-image-slash text-lg text-muted"></i>
                    </div>
                  </div>
                </div>
              </td>

              <!-- File Type -->
              <td class="hidden md:table-cell p-3">
                <div class="flex justify-center">
                  <UTooltip
                    v-if="item.download && item.download !== ''"
                    :text="item.download.split('.').pop()?.toUpperCase() || ''"
                  >
                    <i
                      :class="[
                        'fad',
                        'fa-file-' + (item?.download?.split('.').pop()?.toLowerCase() || ''),
                        'text-2xl',
                        'text-secondary',
                      ]"
                    ></i>
                  </UTooltip>
                  <UTooltip v-else :text="t('labels.no_file')">
                    <i class="fad fa-question-circle text-2xl text-warning"></i>
                  </UTooltip>
                </div>
              </td>

              <!-- Title and Description -->
              <td class="p-3">
                <div>
                  <div class="font-bold">{{ item.title }}</div>
                  <div class="text-sm text-muted">{{ item.description }}</div>
                </div>
              </td>

              <!-- Actions -->
              <td class="p-3 text-right">
                <div class="flex gap-2 justify-end">
                  <UButton
                    variant="ghost"
                    color="secondary"
                    square
                    @click="shareArchiveItem(item.title, item.path)"
                    :title="t('actions.share')"
                  >
                    <i class="fad fa-arrow-up-from-bracket"></i>
                  </UButton>

                  <UButton
                    v-if="item.download && item.download !== ''"
                    :to="item.download"
                    target="_blank"
                    variant="ghost"
                    color="primary"
                    square
                    :title="t('actions.download')"
                  >
                    <i class="fad fa-download"></i>
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
          <!-- foot -->
          <tfoot class="border-t border-default">
            <tr>
              <th class="hidden md:table-cell p-3 text-left">{{ t('table_headers.image') }}</th>
              <th class="hidden md:table-cell p-3 text-center">{{ t('table_headers.file_type') }}</th>
              <th class="p-3 text-left">{{ t('table_headers.title') }}</th>
              <th class="p-3 text-right">{{ t('table_headers.actions') }}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pageCount > 1" class="flex justify-center items-center mt-8">
        <UButtonGroup>
          <UButton size="sm" :disabled="currentPage === 1" @click="prevPage" square>
            <i class="fad fa-arrow-left"></i>
          </UButton>
          <UButton size="sm" variant="ghost" color="neutral">
            {{ t('pagination.page_text', { current: currentPage, total: pageCount }) }}
          </UButton>
          <UButton size="sm" :disabled="currentPage >= pageCount" @click="nextPage" square>
            <i class="fad fa-arrow-right"></i>
          </UButton>
        </UButtonGroup>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "search_placeholder": "Search for anything (ex. MPI, Cooper S, Carburettor HIF44)",
    "empty_state": "No items meeting current filters exist",
    "sort_key_label": "Sort Key:",
    "view_modes": {
      "cards": "Cards",
      "table": "Table"
    },
    "table_headers": {
      "image": "Image",
      "file_type": "Type",
      "title": "Title",
      "description": "Description",
      "actions": "Actions"
    },
    "labels": {
      "no_file": "No File"
    },
    "actions": {
      "share": "Share",
      "contribute": "Contribute",
      "download": "Download"
    },
    "pagination": {
      "page_text": "Page {current} of {total}"
    }
  },
  "de": {
    "search_placeholder": "Suche nach allem (z.B. MPI, Cooper S, Vergaser HIF44)",
    "empty_state": "Es existieren keine Elemente, die den aktuellen Filtern entsprechen",
    "sort_key_label": "Sortierschlüssel:",
    "view_modes": {
      "cards": "Karten",
      "table": "Tabelle"
    },
    "table_headers": {
      "image": "Bild",
      "file_type": "Typ",
      "title": "Titel",
      "description": "Beschreibung",
      "actions": "Aktionen"
    },
    "labels": {
      "no_file": "Keine Datei"
    },
    "actions": {
      "share": "Teilen",
      "contribute": "Beitragen",
      "download": "Herunterladen"
    },
    "pagination": {
      "page_text": "Seite {current} von {total}"
    }
  },
  "es": {
    "search_placeholder": "Buscar cualquier cosa (ej. MPI, Cooper S, Carburador HIF44)",
    "empty_state": "No existen elementos que cumplan los filtros actuales",
    "sort_key_label": "Clave de Ordenamiento:",
    "view_modes": {
      "cards": "Tarjetas",
      "table": "Tabla"
    },
    "table_headers": {
      "image": "Imagen",
      "file_type": "Tipo",
      "title": "Título",
      "description": "Descripción",
      "actions": "Acciones"
    },
    "labels": {
      "no_file": "Sin Archivo"
    },
    "actions": {
      "share": "Compartir",
      "contribute": "Contribuir",
      "download": "Descargar"
    },
    "pagination": {
      "page_text": "Página {current} de {total}"
    }
  },
  "fr": {
    "search_placeholder": "Rechercher n'importe quoi (ex. MPI, Cooper S, Carburateur HIF44)",
    "empty_state": "Aucun élément répondant aux filtres actuels n'existe",
    "sort_key_label": "Clé de tri :",
    "view_modes": {
      "cards": "Cartes",
      "table": "Tableau"
    },
    "table_headers": {
      "image": "Image",
      "file_type": "Type",
      "title": "Titre",
      "description": "Description",
      "actions": "Actions"
    },
    "labels": {
      "no_file": "Aucun Fichier"
    },
    "actions": {
      "share": "Partager",
      "contribute": "Contribuer",
      "download": "Télécharger"
    },
    "pagination": {
      "page_text": "Page {current} sur {total}"
    }
  },
  "it": {
    "search_placeholder": "Cerca qualsiasi cosa (es. MPI, Cooper S, Carburatore HIF44)",
    "empty_state": "Non esistono elementi che soddisfano i filtri attuali",
    "sort_key_label": "Chiave di ordinamento:",
    "view_modes": {
      "cards": "Schede",
      "table": "Tabella"
    },
    "table_headers": {
      "image": "Immagine",
      "file_type": "Tipo",
      "title": "Titolo",
      "description": "Descrizione",
      "actions": "Azioni"
    },
    "labels": {
      "no_file": "Nessun File"
    },
    "actions": {
      "share": "Condividi",
      "contribute": "Contribuisci",
      "download": "Scarica"
    },
    "pagination": {
      "page_text": "Pagina {current} di {total}"
    }
  },
  "pt": {
    "search_placeholder": "Pesquisar por qualquer coisa (ex. MPI, Cooper S, Carburador HIF44)",
    "empty_state": "Não existem itens que atendam aos filtros atuais",
    "sort_key_label": "Chave de Ordenação:",
    "view_modes": {
      "cards": "Cartões",
      "table": "Tabela"
    },
    "table_headers": {
      "image": "Imagem",
      "file_type": "Tipo",
      "title": "Título",
      "description": "Descrição",
      "actions": "Ações"
    },
    "labels": {
      "no_file": "Sem Arquivo"
    },
    "actions": {
      "share": "Compartilhar",
      "contribute": "Contribuir",
      "download": "Baixar"
    },
    "pagination": {
      "page_text": "Página {current} de {total}"
    }
  },
  "ru": {
    "search_placeholder": "Поиск чего угодно (например, MPI, Cooper S, Carburettor HIF44)",
    "empty_state": "Не существует элементов, соответствующих текущим фильтрам",
    "sort_key_label": "Ключ сортировки:",
    "view_modes": {
      "cards": "Карточки",
      "table": "Таблица"
    },
    "table_headers": {
      "image": "Изображение",
      "file_type": "Тип",
      "title": "Название",
      "description": "Описание",
      "actions": "Действия"
    },
    "labels": {
      "no_file": "Нет Файла"
    },
    "actions": {
      "share": "Поделиться",
      "contribute": "Внести вклад",
      "download": "Скачать"
    },
    "pagination": {
      "page_text": "Страница {current} из {total}"
    }
  },
  "ja": {
    "search_placeholder": "何でも検索 (例: MPI、Cooper S、Carburettor HIF44)",
    "empty_state": "現在のフィルターに一致する項目がありません",
    "sort_key_label": "ソートキー:",
    "view_modes": {
      "cards": "カード",
      "table": "テーブル"
    },
    "table_headers": {
      "image": "画像",
      "file_type": "タイプ",
      "title": "タイトル",
      "description": "説明",
      "actions": "アクション"
    },
    "labels": {
      "no_file": "ファイルなし"
    },
    "actions": {
      "share": "共有",
      "contribute": "貢献",
      "download": "ダウンロード"
    },
    "pagination": {
      "page_text": "ページ{current}/{total}"
    }
  },
  "zh": {
    "search_placeholder": "搜索任何内容（例：MPI、Cooper S、化油器HIF44）",
    "empty_state": "没有符合当前筛选条件的项目",
    "sort_key_label": "排序关键字：",
    "view_modes": {
      "cards": "卡片",
      "table": "表格"
    },
    "table_headers": {
      "image": "图片",
      "file_type": "类型",
      "title": "标题",
      "description": "描述",
      "actions": "操作"
    },
    "labels": {
      "no_file": "无文件"
    },
    "actions": {
      "share": "分享",
      "contribute": "贡献",
      "download": "下载"
    },
    "pagination": {
      "page_text": "第{current}页，共{total}页"
    }
  },
  "ko": {
    "search_placeholder": "무엇이든 검색하세요 (예: MPI, Cooper S, Carburettor HIF44)",
    "empty_state": "현재 필터에 맞는 항목이 없습니다",
    "sort_key_label": "정렬 키:",
    "view_modes": {
      "cards": "카드",
      "table": "테이블"
    },
    "table_headers": {
      "image": "이미지",
      "file_type": "유형",
      "title": "제목",
      "description": "설명",
      "actions": "동작"
    },
    "labels": {
      "no_file": "파일 없음"
    },
    "actions": {
      "share": "공유",
      "contribute": "기여하기",
      "download": "다운로드"
    },
    "pagination": {
      "page_text": "{total} 페이지 중 {current} 페이지"
    }
  }
}
</i18n>

<style lang="scss">
  .card-title,
  .card-body p {
    -webkit-hyphens: unset;
    hyphens: unset;
    overflow-wrap: unset;
    overflow: unset;
    white-space: unset;
    text-overflow: unset;
    word-break: unset;
    word-wrap: unset;
  }
</style>
