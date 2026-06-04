<script setup lang="ts">
  const { t } = useI18n();
  const { track, trackSearch } = useAnalytics();
  import type { RegistryItem } from '../../data/models/registry';
  import { RegistryItemStatus } from '../../data/models/registry';
  import { useDebounce } from '../composables/useDebounce';

  interface Props {
    items: RegistryItem[] | null;
    loading?: boolean;
    tableHeaders?: { title: string; key: string; width?: string }[];
    defaultPageSize?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    loading: false,
    tableHeaders: () => [
      { title: 'Year', key: 'year' },
      { title: 'Model', key: 'model' },
      { title: 'Trim', key: 'trim' },
      { title: 'Color', key: 'color' },
    ],
    defaultPageSize: 10,
  });

  // State
  const searchValue = ref('');
  const expanded = ref<string[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(props.defaultPageSize);

  // Page size options for USelect
  const pageSizeOptions = computed(() => [
    { label: t('per_page_options.10'), value: 10 },
    { label: t('per_page_options.25'), value: 25 },
    { label: t('per_page_options.50'), value: 50 },
    { label: t('per_page_options.100'), value: 100 },
  ]);

  // Debounced search to avoid excessive filtering
  const debouncedSearch = useDebounce(searchValue, 300);

  // Reset to first page when search changes, and track the search
  watch(debouncedSearch, (query) => {
    currentPage.value = 1;
    if (query) {
      trackSearch('registry', query, filteredItems.value?.length);
    }
  });

  // Helper function to get status priority for sorting
  const getStatusPriority = (status: string | undefined) => {
    if (!status) return 4; // No status - lowest priority
    switch (status) {
      case RegistryItemStatus.PENDING:
        return 1; // Highest priority
      case RegistryItemStatus.APPROVED:
        return 2;
      case RegistryItemStatus.REJECTED:
        return 3;
      default:
        return 4;
    }
  };

  // Filter items based on debounced search and sort by status priority
  const filteredItems = computed(() => {
    if (!props.items) return null;

    // First filter by search term if provided
    let result = props.items;
    if (debouncedSearch.value) {
      const search = debouncedSearch.value.toLowerCase();
      result = result.filter((item) => {
        return Object.values(item).some((val) => val && typeof val === 'string' && val.toLowerCase().includes(search));
      });
    }

    // Then sort by status priority
    return [...result].sort((a, b) => {
      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);
      return priorityA - priorityB;
    });
  });

  // Calculate total pages
  const totalPages = computed(() => {
    if (!filteredItems.value) return 1;
    return Math.ceil(filteredItems.value.length / pageSize.value);
  });

  // Get paginated items
  const paginatedItems = computed(() => {
    if (!filteredItems.value) return [];
    const startIndex = (currentPage.value - 1) * pageSize.value;
    return filteredItems.value.slice(startIndex, startIndex + pageSize.value);
  });

  // Track page size changes
  watch(pageSize, (newSize) => {
    track('list_page_size_changed', { surface: 'registry', page_size: newSize });
  });

  // Toggle expanded row
  const toggleExpanded = (id: string) => {
    const index = expanded.value.indexOf(id);
    if (index === -1) {
      expanded.value.push(id);
      track('registry_row_expanded', { item_id: id, is_expanded: true });
    } else {
      expanded.value.splice(index, 1);
      track('registry_row_expanded', { item_id: id, is_expanded: false });
    }
  };

  // Change page
  const changePage = (page: number) => {
    currentPage.value = page;
    // Reset expanded rows when changing pages
    expanded.value = [];
    track('list_paginated', { surface: 'registry', page });
  };

  // Define type for pagination items
  type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

  // Helper function to convert status code to readable text

  const getStatusText = (status: string) => {
    switch (status) {
      case RegistryItemStatus.PENDING:
        return t('status.pending');
      case RegistryItemStatus.APPROVED:
        return t('status.approved');
      case RegistryItemStatus.REJECTED:
        return t('status.rejected');
      default:
        return t('status.unknown');
    }
  };

  // Get pagination array
  const paginationArray = computed<PaginationItem[]>(() => {
    const pages: PaginationItem[] = [];
    const maxVisiblePages = 5;

    if (totalPages.value <= maxVisiblePages) {
      // Show all pages if there are few
      for (let i = 1; i <= totalPages.value; i++) {
        pages.push(i);
      }
    } else {
      // Show a subset of pages with ellipsis
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(currentPage.value - halfVisible, 1);
      let endPage = Math.min(startPage + maxVisiblePages - 1, totalPages.value);

      // Adjust if we're near the end
      if (endPage === totalPages.value) {
        startPage = Math.max(endPage - maxVisiblePages + 1, 1);
      }

      // Add first page and ellipsis if needed
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) pages.push('ellipsis-start');
      }

      // Add visible page numbers
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis and last page if needed
      if (endPage < totalPages.value) {
        if (endPage < totalPages.value - 1) pages.push('ellipsis-end');
        pages.push(totalPages.value);
      }
    }

    return pages;
  });
</script>

<template>
  <div class="card bg-base-100 shadow-md border border-base-300">
    <div class="card-body">
      <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <label class="input w-full max-w-md">
          <i class="fas fa-magnifying-glass opacity-60"></i>
          <input type="text" v-model="searchValue" :placeholder="t('search_placeholder')" />
        </label>
        <div class="flex items-center gap-2">
          <span v-if="items?.length" class="badge badge-primary badge-lg">
            {{ items?.length }} {{ t('total_minis') }}
          </span>
          <select v-model="pageSize" class="select select-bordered select-sm">
            <option v-for="opt in pageSizeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="table w-full text-left">
          <thead class="border-b border-base-300">
            <tr>
              <th class="w-10 p-3"></th>
              <th
                v-for="header in tableHeaders"
                :key="header.key"
                class="p-3 font-semibold"
                :class="header.width ? `w-[${header.width}]` : ''"
              >
                {{ header.title }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-300">
            <template v-if="paginatedItems.length">
              <template v-for="(item, index) in paginatedItems" :key="item.uniqueId">
                <tr class="hover:bg-base-200 cursor-pointer transition-colors" @click="toggleExpanded(item.uniqueId)">
                  <td class="p-3">
                    <button type="button" class="btn btn-ghost btn-xs btn-square">
                      <i
                        :class="
                          expanded.includes(item.uniqueId) ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'
                        "
                      ></i>
                    </button>
                  </td>
                  <td v-for="header in tableHeaders" :key="header.key" class="p-3">
                    <template v-if="header.key === 'status' && item.status">
                      <span
                        class="badge"
                        :class="
                          item.status === RegistryItemStatus.PENDING
                            ? 'badge-primary'
                            : item.status === RegistryItemStatus.APPROVED
                              ? 'badge-success'
                              : 'badge-error'
                        "
                      >
                        {{ getStatusText(item.status) }}
                      </span>
                    </template>
                    <template v-else>{{ item[header.key] || t('no_data') }}</template>
                  </td>
                </tr>
                <tr v-if="expanded.includes(item.uniqueId)" class="bg-base-200/50">
                  <td></td>
                  <td colspan="2" class="p-4">
                    <div class="grid grid-cols-1 gap-2">
                      <div>
                        <strong>{{ t('expanded_details.build_date') }}</strong>
                        <div>{{ item.buildDate || t('no_data') }}</div>
                      </div>
                      <div>
                        <strong>{{ t('expanded_details.body_number') }}</strong>
                        <div>{{ item.bodyNum || t('no_data') }}</div>
                      </div>
                      <div>
                        <strong>{{ t('expanded_details.engine_number') }}</strong>
                        <div>{{ item.engineNum || t('no_data') }}</div>
                      </div>
                    </div>
                  </td>
                  <td colspan="2" class="p-4">
                    <div class="grid grid-cols-1 gap-2">
                      <div>
                        <strong>{{ t('expanded_details.submitted_by') }}</strong>
                        <div>{{ item.submittedBy || t('no_data') }}</div>
                      </div>
                      <div>
                        <strong>{{ t('expanded_details.notes') }}</strong>
                        <div>{{ item.notes || t('no_data') }}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
            <tr v-else>
              <td colspan="5" class="text-center py-8 text-base-content/70">{{ t('no_items_found') }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="flex justify-center mt-6" v-if="totalPages > 1">
          <div class="join">
            <!-- Previous button -->
            <button
              type="button"
              class="btn btn-outline join-item"
              :disabled="currentPage === 1"
              @click="currentPage > 1 && changePage(currentPage - 1)"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>

            <!-- Page numbers -->
            <template v-for="(page, index) in paginationArray" :key="index">
              <button
                v-if="page === 'ellipsis-start' || page === 'ellipsis-end'"
                type="button"
                class="btn btn-outline join-item"
                disabled
              >
                ...
              </button>
              <button
                v-else
                type="button"
                class="btn join-item"
                :class="currentPage === page ? 'btn-primary' : 'btn-outline'"
                @click="changePage(page as number)"
              >
                {{ page }}
              </button>
            </template>

            <!-- Next button -->
            <button
              type="button"
              class="btn btn-outline join-item"
              :disabled="currentPage === totalPages"
              @click="currentPage < totalPages && changePage(currentPage + 1)"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "search_placeholder": "Search for any detail",
    "total_minis": "Total Minis",
    "per_page_options": {
      "10": "10 per page",
      "25": "25 per page",
      "50": "50 per page",
      "100": "100 per page"
    },
    "status": {
      "pending": "Pending",
      "approved": "Approved",
      "rejected": "Rejected",
      "unknown": "Unknown"
    },
    "expanded_details": {
      "build_date": "Build Date:",
      "body_number": "Body #:",
      "engine_number": "Engine #:",
      "submitted_by": "Submitted by:",
      "notes": "Notes:"
    },
    "no_items_found": "No items found",
    "no_data": "---"
  },
  "de": {
    "search_placeholder": "Suche nach beliebigen Details",
    "total_minis": "Minis insgesamt",
    "per_page_options": {
      "10": "10 pro Seite",
      "25": "25 pro Seite",
      "50": "50 pro Seite",
      "100": "100 pro Seite"
    },
    "status": {
      "pending": "Ausstehend",
      "approved": "Genehmigt",
      "rejected": "Abgelehnt",
      "unknown": "Unbekannt"
    },
    "expanded_details": {
      "build_date": "Baudatum:",
      "body_number": "Karosserie-Nr.:",
      "engine_number": "Motor-Nr.:",
      "submitted_by": "Eingereicht von:",
      "notes": "Notizen:"
    },
    "no_items_found": "Keine Elemente gefunden",
    "no_data": "---"
  },
  "es": {
    "search_placeholder": "Buscar cualquier detalle",
    "total_minis": "Total de Minis",
    "per_page_options": {
      "10": "10 por página",
      "25": "25 por página",
      "50": "50 por página",
      "100": "100 por página"
    },
    "status": {
      "pending": "Pendiente",
      "approved": "Aprobado",
      "rejected": "Rechazado",
      "unknown": "Desconocido"
    },
    "expanded_details": {
      "build_date": "Fecha de Fabricación:",
      "body_number": "Número de Carrocería:",
      "engine_number": "Número de Motor:",
      "submitted_by": "Enviado por:",
      "notes": "Notas:"
    },
    "no_items_found": "No se encontraron elementos",
    "no_data": "---"
  },
  "fr": {
    "search_placeholder": "Rechercher n'importe quel détail",
    "total_minis": "Total de Minis",
    "per_page_options": {
      "10": "10 par page",
      "25": "25 par page",
      "50": "50 par page",
      "100": "100 par page"
    },
    "status": {
      "pending": "En attente",
      "approved": "Approuvé",
      "rejected": "Rejeté",
      "unknown": "Inconnu"
    },
    "expanded_details": {
      "build_date": "Date de construction :",
      "body_number": "N° de carrosserie :",
      "engine_number": "N° de moteur :",
      "submitted_by": "Soumis par :",
      "notes": "Notes :"
    },
    "no_items_found": "Aucun élément trouvé",
    "no_data": "---"
  },
  "it": {
    "search_placeholder": "Cerca qualsiasi dettaglio",
    "total_minis": "Mini totali",
    "per_page_options": {
      "10": "10 per pagina",
      "25": "25 per pagina",
      "50": "50 per pagina",
      "100": "100 per pagina"
    },
    "status": {
      "pending": "In attesa",
      "approved": "Approvato",
      "rejected": "Rifiutato",
      "unknown": "Sconosciuto"
    },
    "expanded_details": {
      "build_date": "Data di costruzione:",
      "body_number": "N. scocca:",
      "engine_number": "N. motore:",
      "submitted_by": "Inviato da:",
      "notes": "Note:"
    },
    "no_items_found": "Nessun elemento trovato",
    "no_data": "---"
  },
  "pt": {
    "search_placeholder": "Pesquisar por qualquer detalhe",
    "total_minis": "Total de Minis",
    "per_page_options": {
      "10": "10 por página",
      "25": "25 por página",
      "50": "50 por página",
      "100": "100 por página"
    },
    "status": {
      "pending": "Pendente",
      "approved": "Aprovado",
      "rejected": "Rejeitado",
      "unknown": "Desconhecido"
    },
    "expanded_details": {
      "build_date": "Data de Fabricação:",
      "body_number": "Nº da Carroceria:",
      "engine_number": "Nº do Motor:",
      "submitted_by": "Enviado por:",
      "notes": "Observações:"
    },
    "no_items_found": "Nenhum item encontrado",
    "no_data": "---"
  },
  "ru": {
    "search_placeholder": "Поиск по любым деталям",
    "total_minis": "Всего Мини",
    "per_page_options": {
      "10": "10 на странице",
      "25": "25 на странице",
      "50": "50 на странице",
      "100": "100 на странице"
    },
    "status": {
      "pending": "Ожидает",
      "approved": "Одобрено",
      "rejected": "Отклонено",
      "unknown": "Неизвестно"
    },
    "expanded_details": {
      "build_date": "Дата сборки:",
      "body_number": "Номер кузова:",
      "engine_number": "Номер двигателя:",
      "submitted_by": "Отправлено:",
      "notes": "Примечания:"
    },
    "no_items_found": "Элементы не найдены",
    "no_data": "---"
  },
  "ja": {
    "search_placeholder": "詳細を検索",
    "total_minis": "Total Minis",
    "per_page_options": {
      "10": "10件ずつ表示",
      "25": "25件ずつ表示",
      "50": "50件ずつ表示",
      "100": "100件ずつ表示"
    },
    "status": {
      "pending": "保留中",
      "approved": "承認済み",
      "rejected": "拒否",
      "unknown": "不明"
    },
    "expanded_details": {
      "build_date": "製造日:",
      "body_number": "ボディ番号:",
      "engine_number": "エンジン番号:",
      "submitted_by": "投稿者:",
      "notes": "備考:"
    },
    "no_items_found": "項目が見つかりません",
    "no_data": "---"
  },
  "zh": {
    "search_placeholder": "搜索任何详细信息",
    "total_minis": "Mini总数",
    "per_page_options": {
      "10": "每页10项",
      "25": "每页25项",
      "50": "每页50项",
      "100": "每页100项"
    },
    "status": {
      "pending": "待审核",
      "approved": "已批准",
      "rejected": "已拒绝",
      "unknown": "未知"
    },
    "expanded_details": {
      "build_date": "制造日期：",
      "body_number": "车身编号：",
      "engine_number": "发动机编号：",
      "submitted_by": "提交者：",
      "notes": "备注："
    },
    "no_items_found": "未找到项目",
    "no_data": "---"
  },
  "ko": {
    "search_placeholder": "모든 세부사항 검색",
    "total_minis": "총 미니 대수",
    "per_page_options": {
      "10": "페이지당 10개",
      "25": "페이지당 25개",
      "50": "페이지당 50개",
      "100": "페이지당 100개"
    },
    "status": {
      "pending": "대기 중",
      "approved": "승인됨",
      "rejected": "거부됨",
      "unknown": "알 수 없음"
    },
    "expanded_details": {
      "build_date": "제조 날짜:",
      "body_number": "바디 번호:",
      "engine_number": "엔진 번호:",
      "submitted_by": "제출자:",
      "notes": "참고사항:"
    },
    "no_items_found": "항목을 찾을 수 없습니다",
    "no_data": "---"
  }
}
</i18n>
