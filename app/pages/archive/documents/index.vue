<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  // Read type from query param (for redirect support)
  const activeType = ref<string>((route.query.type as string) || 'all');
  const search = ref('');
  const sortBy = ref<'title' | 'newest' | 'oldest'>('title');
  const viewMode = ref<'cards' | 'table'>('table');
  const currentPage = ref(1);
  const itemsPerPage = 12;

  const typeFilters = [
    { value: 'all', labelKey: 'filters.all' },
    { value: 'manual', labelKey: 'filters.manuals' },
    { value: 'advert', labelKey: 'filters.adverts' },
    { value: 'catalogue', labelKey: 'filters.catalogues' },
    { value: 'tuning', labelKey: 'filters.tuning' },
    { value: 'electrical', labelKey: 'filters.electrical' },
  ];

  const { listAll, listCollections, getDocumentTypeCounts } = useArchiveDocuments();

  // Fetch documents
  const { data: documents, status } = await useAsyncData(
    () => `archive-docs-${activeType.value}-${sortBy.value}`,
    () =>
      listAll({
        type: activeType.value === 'all' ? undefined : activeType.value,
        sort: sortBy.value,
      }),
    { watch: [activeType, sortBy] },
  );

  // Fetch collections
  const { data: collections } = await useAsyncData(
    () => `archive-collections-${activeType.value}`,
    () =>
      listCollections({
        type: activeType.value === 'all' ? undefined : activeType.value,
      }),
    { watch: [activeType] },
  );

  // Fetch type counts for filter chips
  const { data: typeCounts } = await useAsyncData('archive-doc-type-counts', () => getDocumentTypeCounts());

  const totalCount = computed(() => {
    if (!typeCounts.value) return 0;
    return Object.values(typeCounts.value).reduce((sum, n) => sum + n, 0);
  });

  const getFilterCount = (value: string): number => {
    if (value === 'all') return totalCount.value;
    return typeCounts.value?.[value] ?? 0;
  };

  // Client-side search filter
  const filteredDocuments = computed(() => {
    if (!documents.value) return [];
    if (!search.value) return documents.value;
    const q = search.value.toLowerCase();
    return documents.value.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.author?.toLowerCase().includes(q),
    );
  });

  const paginatedDocuments = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredDocuments.value.slice(start, start + itemsPerPage);
  });

  const pageCount = computed(() => Math.ceil(filteredDocuments.value.length / itemsPerPage));

  // Sync type filter with URL query param
  watch(activeType, (val) => {
    currentPage.value = 1;
    router.replace({
      query: val === 'all' ? {} : { type: val },
    });
  });

  watch(search, () => {
    currentPage.value = 1;
  });

  function prevPage() {
    if (currentPage.value > 1) currentPage.value--;
  }

  function nextPage() {
    if (currentPage.value < pageCount.value) currentPage.value++;
  }

  // SEO
  useHead({
    title: t('title'),
    meta: [{ key: 'description', name: 'description', content: t('description') }],
    link: [{ rel: 'canonical', href: 'https://classicminidiy.com/archive/documents' }],
  });

  useSeoMeta({
    ogTitle: t('title'),
    ogDescription: t('description'),
    ogUrl: 'https://classicminidiy.com/archive/documents',
    ogType: 'website',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :page="t('breadcrumb_title')" />

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
          <div class="col-span-12 md:col-span-8">
            <h1 class="text-2xl font-bold mb-4">{{ t('main_heading') }}</h1>
            <p>{{ t('description_text') }}</p>
          </div>
        </div>

        <!-- Contribute Banner -->
        <UCard class="mb-6 bg-primary/5">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <i class="fad fa-hand-holding-heart text-xl text-primary"></i>
              <div>
                <p class="font-medium">{{ t('contribute_banner_title') }}</p>
                <p class="text-sm opacity-70">{{ t('contribute_banner_description') }}</p>
              </div>
            </div>
            <UButton to="/contribute/document" color="primary" variant="outline" size="sm">
              {{ t('contribute_banner_button') }}
            </UButton>
          </div>
        </UCard>

        <!-- Type Filter Chips -->
        <div class="flex flex-wrap gap-2 mb-6">
          <UButton
            v-for="filter in typeFilters"
            :key="filter.value"
            :color="activeType === filter.value ? 'primary' : 'neutral'"
            :variant="activeType === filter.value ? 'solid' : 'outline'"
            size="sm"
            @click="activeType = filter.value"
          >
            {{ t(filter.labelKey) }} ({{ getFilterCount(filter.value) }})
          </UButton>
        </div>

        <!-- Search + Sort + View Toggle -->
        <div class="flex flex-col lg:flex-row gap-4 items-end mb-8">
          <div class="flex-1">
            <UInput
              v-model="search"
              :placeholder="t('search_placeholder')"
              icon="i-fa6-solid-magnifying-glass"
              size="lg"
            />
          </div>

          <div class="flex gap-2">
            <!-- Sort Dropdown -->
            <USelect
              v-model="sortBy"
              :items="[
                { value: 'title', label: t('sort.title') },
                { value: 'newest', label: t('sort.newest') },
                { value: 'oldest', label: t('sort.oldest') },
              ]"
            />

            <!-- View Mode Toggle -->
            <div class="join">
              <UButton
                class="join-item"
                :color="viewMode === 'cards' ? 'primary' : 'neutral'"
                :variant="viewMode === 'cards' ? 'solid' : 'outline'"
                @click="viewMode = 'cards'"
              >
                <i class="fad fa-grid-2"></i>
              </UButton>
              <UButton
                class="join-item"
                :color="viewMode === 'table' ? 'primary' : 'neutral'"
                :variant="viewMode === 'table' ? 'solid' : 'outline'"
                @click="viewMode = 'table'"
              >
                <i class="fad fa-table"></i>
              </UButton>
            </div>
          </div>
        </div>

        <!-- Results count -->
        <p class="text-sm text-muted mb-4">
          {{ t('results_count', { count: filteredDocuments.length }) }}
        </p>

        <!-- Loading Skeleton -->
        <div v-if="status === 'pending'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UCard v-for="k in 12" :key="k" class="animate-pulse">
            <template #header>
              <div class="h-[150px] bg-muted rounded-t-lg"></div>
            </template>
            <div class="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div class="h-3 bg-muted rounded w-1/2"></div>
          </UCard>
        </div>

        <!-- Content -->
        <div v-else>
          <!-- Empty State -->
          <div
            v-if="filteredDocuments.length === 0 && (!collections || collections.length === 0)"
            class="text-center py-8"
          >
            <UCard>
              <p class="text-muted">{{ t('empty_state') }}</p>
            </UCard>
          </div>

          <!-- Collections Row (cards view only, shown above documents) -->
          <div v-if="collections && collections.length > 0 && viewMode === 'cards' && !search" class="mb-8">
            <h2 class="text-lg font-semibold mb-4">{{ t('collections_heading') }}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <archive-collection-card v-for="col in collections" :key="col.id" :collection="col" />
            </div>
          </div>

          <!-- Documents Cards View -->
          <div v-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <archive-document-card v-for="item in paginatedDocuments" :key="item.title" :item="item" />
          </div>

          <!-- Documents Table View -->
          <div v-else class="overflow-x-auto">
            <!-- Reuse same table pattern from ArchiveLandingIterator -->
            <table class="w-full">
              <thead class="border-b border-default">
                <tr>
                  <th class="hidden md:table-cell p-3 text-left">{{ t('table_headers.image') }}</th>
                  <th class="hidden md:table-cell p-3 text-center">{{ t('table_headers.file_type') }}</th>
                  <th class="p-3 text-left">{{ t('table_headers.title') }}</th>
                  <th class="hidden lg:table-cell p-3 text-left">{{ t('table_headers.author') }}</th>
                  <th class="p-3 text-right">{{ t('table_headers.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in paginatedDocuments"
                  :key="item.title"
                  class="border-b border-default hover:bg-muted/50"
                >
                  <td class="hidden md:table-cell p-3">
                    <div class="h-12 w-12 rounded-lg overflow-hidden">
                      <img
                        v-if="item.image"
                        :src="item.image"
                        :alt="item.title"
                        class="h-12 w-12 object-cover"
                      />
                      <div v-else class="flex justify-center items-center h-12 w-12 bg-muted">
                        <i class="fad fa-image-slash text-lg text-muted"></i>
                      </div>
                    </div>
                  </td>
                  <td class="hidden md:table-cell p-3">
                    <div class="flex justify-center">
                      <i
                        v-if="item.download"
                        :class="[
                          'fad',
                          'fa-file-' + (item.download.split('.').pop()?.toLowerCase() || ''),
                          'text-2xl text-secondary',
                        ]"
                      ></i>
                      <i v-else class="fad fa-question-circle text-2xl text-warning"></i>
                    </div>
                  </td>
                  <td class="p-3">
                    <NuxtLink :to="item.path" class="hover:underline">
                      <div class="font-bold">{{ item.title }}</div>
                    </NuxtLink>
                    <div class="text-sm text-muted">{{ item.description }}</div>
                  </td>
                  <td class="hidden lg:table-cell p-3 text-muted">{{ item.author || '\u2014' }}</td>
                  <td class="p-3 text-right">
                    <div class="flex gap-2 justify-end">
                      <UButton
                        v-if="item.download"
                        :to="item.download"
                        target="_blank"
                        variant="ghost"
                        color="primary"
                        square
                      >
                        <i class="fad fa-download"></i>
                      </UButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="pageCount > 1" class="flex justify-center items-center mt-8">
            <div class="join">
              <UButton class="join-item" size="sm" :disabled="currentPage === 1" @click="prevPage" square>
                <i class="fad fa-arrow-left"></i>
              </UButton>
              <UButton class="join-item" size="sm" variant="ghost" color="neutral">
                {{ t('pagination.page_text', { current: currentPage, total: pageCount }) }}
              </UButton>
              <UButton class="join-item" size="sm" :disabled="currentPage >= pageCount" @click="nextPage" square>
                <i class="fad fa-arrow-right"></i>
              </UButton>
            </div>
          </div>
        </div>

        <!-- Support section -->
        <div class="mt-8 mb-10">
          <USeparator :label="t('support_divider')" class="mb-6" />
          <patreon-card size="large" />
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Archive - Documents | Classic Mini DIY",
    "description": "Browse workshop manuals, adverts, vendor catalogues, and tuning guides for the Classic Mini Cooper.",
    "hero_title": "Document Archive",
    "breadcrumb_title": "Documents",
    "main_heading": "Document Archive",
    "description_text": "Browse our collection of workshop manuals, vintage advertisements, vendor catalogues, and tuning guides for the Classic Mini Cooper. All curated and organized for easy viewing.",
    "filters": {
      "all": "All",
      "manuals": "Manuals",
      "adverts": "Adverts",
      "catalogues": "Catalogues",
      "tuning": "Tuning",
      "electrical": "Electrical"
    },
    "search_placeholder": "Search documents (ex. MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "Title (A-Z)",
      "newest": "Newest",
      "oldest": "Oldest"
    },
    "results_count": "{count} documents found",
    "collections_heading": "Collections",
    "empty_state": "No documents found matching your filters.",
    "table_headers": {
      "image": "Image",
      "file_type": "Type",
      "title": "Title",
      "author": "Author",
      "actions": "Actions"
    },
    "pagination": {
      "page_text": "Page {current} of {total}"
    },
    "contribute_banner_title": "Know something we're missing?",
    "contribute_banner_description": "Help grow the archive with your knowledge.",
    "contribute_banner_button": "Contribute",
    "support_divider": "Support"
  },
  "de": {
    "title": "Archiv - Dokumente | Classic Mini DIY",
    "description": "Durchsuchen Sie Werkstatthandbücher, Werbung, Händlerkataloge und Tuning-Anleitungen für den Classic Mini Cooper.",
    "hero_title": "Dokumentenarchiv",
    "breadcrumb_title": "Dokumente",
    "main_heading": "Dokumentenarchiv",
    "description_text": "Durchsuchen Sie unsere Sammlung von Werkstatthandbüchern, historischen Anzeigen, Händlerkatalogen und Tuning-Anleitungen für den Classic Mini Cooper.",
    "filters": {
      "all": "Alle",
      "manuals": "Handbücher",
      "adverts": "Anzeigen",
      "catalogues": "Kataloge",
      "tuning": "Tuning",
      "electrical": "Elektrik"
    },
    "search_placeholder": "Dokumente suchen (z.B. MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "Titel (A-Z)",
      "newest": "Neueste",
      "oldest": "Älteste"
    },
    "results_count": "{count} Dokumente gefunden",
    "collections_heading": "Sammlungen",
    "empty_state": "Keine Dokumente gefunden.",
    "table_headers": {
      "image": "Bild",
      "file_type": "Typ",
      "title": "Titel",
      "author": "Autor",
      "actions": "Aktionen"
    },
    "pagination": {
      "page_text": "Seite {current} von {total}"
    },
    "contribute_banner_title": "Wissen Sie etwas, das uns fehlt?",
    "contribute_banner_description": "Helfen Sie, das Archiv mit Ihrem Wissen zu erweitern.",
    "contribute_banner_button": "Beitragen",
    "support_divider": "Support"
  },
  "es": {
    "title": "Archivo - Documentos | Classic Mini DIY",
    "description": "Explore manuales de taller, anuncios, catálogos de proveedores y guías de modificación para el Classic Mini Cooper.",
    "hero_title": "Archivo de Documentos",
    "breadcrumb_title": "Documentos",
    "main_heading": "Archivo de Documentos",
    "description_text": "Explore nuestra colección de manuales de taller, anuncios históricos, catálogos de proveedores y guías de modificación para el Classic Mini Cooper.",
    "filters": {
      "all": "Todos",
      "manuals": "Manuales",
      "adverts": "Anuncios",
      "catalogues": "Catálogos",
      "tuning": "Modificaciones",
      "electrical": "Eléctrico"
    },
    "search_placeholder": "Buscar documentos (ej. MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "Título (A-Z)",
      "newest": "Más recientes",
      "oldest": "Más antiguos"
    },
    "results_count": "{count} documentos encontrados",
    "collections_heading": "Colecciones",
    "empty_state": "No se encontraron documentos.",
    "table_headers": {
      "image": "Imagen",
      "file_type": "Tipo",
      "title": "Título",
      "author": "Autor",
      "actions": "Acciones"
    },
    "pagination": {
      "page_text": "Página {current} de {total}"
    },
    "contribute_banner_title": "Sabes algo que nos falta?",
    "contribute_banner_description": "Ayuda a hacer crecer el archivo con tu conocimiento.",
    "contribute_banner_button": "Contribuir",
    "support_divider": "Soporte"
  },
  "fr": {
    "title": "Archive - Documents | Classic Mini DIY",
    "description": "Parcourez les manuels d'atelier, publicités, catalogues et guides de tuning pour la Classic Mini Cooper.",
    "hero_title": "Archive de Documents",
    "breadcrumb_title": "Documents",
    "main_heading": "Archive de Documents",
    "description_text": "Parcourez notre collection de manuels d'atelier, publicités historiques, catalogues et guides de tuning pour la Classic Mini Cooper.",
    "filters": {
      "all": "Tous",
      "manuals": "Manuels",
      "adverts": "Publicités",
      "catalogues": "Catalogues",
      "tuning": "Tuning",
      "electrical": "Électrique"
    },
    "search_placeholder": "Rechercher des documents (ex. MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "Titre (A-Z)",
      "newest": "Plus récents",
      "oldest": "Plus anciens"
    },
    "results_count": "{count} documents trouvés",
    "collections_heading": "Collections",
    "empty_state": "Aucun document trouvé.",
    "table_headers": {
      "image": "Image",
      "file_type": "Type",
      "title": "Titre",
      "author": "Auteur",
      "actions": "Actions"
    },
    "pagination": {
      "page_text": "Page {current} sur {total}"
    },
    "contribute_banner_title": "Vous savez quelque chose qui nous manque ?",
    "contribute_banner_description": "Aidez à enrichir l'archive avec vos connaissances.",
    "contribute_banner_button": "Contribuer",
    "support_divider": "Support"
  },
  "it": {
    "title": "Archivio - Documenti | Classic Mini DIY",
    "description": "Sfoglia manuali, pubblicità, cataloghi e guide di tuning per la Classic Mini Cooper.",
    "hero_title": "Archivio Documenti",
    "breadcrumb_title": "Documenti",
    "main_heading": "Archivio Documenti",
    "description_text": "Sfoglia la nostra collezione di manuali, pubblicità storiche, cataloghi e guide di tuning per la Classic Mini Cooper.",
    "filters": {
      "all": "Tutti",
      "manuals": "Manuali",
      "adverts": "Pubblicità",
      "catalogues": "Cataloghi",
      "tuning": "Tuning",
      "electrical": "Elettrico"
    },
    "search_placeholder": "Cerca documenti (es. MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "Titolo (A-Z)",
      "newest": "Più recenti",
      "oldest": "Più vecchi"
    },
    "results_count": "{count} documenti trovati",
    "collections_heading": "Collezioni",
    "empty_state": "Nessun documento trovato.",
    "table_headers": {
      "image": "Immagine",
      "file_type": "Tipo",
      "title": "Titolo",
      "author": "Autore",
      "actions": "Azioni"
    },
    "pagination": {
      "page_text": "Pagina {current} di {total}"
    },
    "contribute_banner_title": "Sai qualcosa che ci manca?",
    "contribute_banner_description": "Aiuta a far crescere l'archivio con le tue conoscenze.",
    "contribute_banner_button": "Contribuisci",
    "support_divider": "Supporto"
  },
  "pt": {
    "title": "Arquivo - Documentos | Classic Mini DIY",
    "description": "Navegue pelos manuais, anúncios, catálogos e guias de tuning para o Classic Mini Cooper.",
    "hero_title": "Arquivo de Documentos",
    "breadcrumb_title": "Documentos",
    "main_heading": "Arquivo de Documentos",
    "description_text": "Navegue pela nossa coleção de manuais, anúncios históricos, catálogos e guias de tuning para o Classic Mini Cooper.",
    "filters": {
      "all": "Todos",
      "manuals": "Manuais",
      "adverts": "Anúncios",
      "catalogues": "Catálogos",
      "tuning": "Tuning",
      "electrical": "Elétrico"
    },
    "search_placeholder": "Pesquisar documentos (ex. MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "Título (A-Z)",
      "newest": "Mais recentes",
      "oldest": "Mais antigos"
    },
    "results_count": "{count} documentos encontrados",
    "collections_heading": "Coleções",
    "empty_state": "Nenhum documento encontrado.",
    "table_headers": {
      "image": "Imagem",
      "file_type": "Tipo",
      "title": "Título",
      "author": "Autor",
      "actions": "Ações"
    },
    "pagination": {
      "page_text": "Página {current} de {total}"
    },
    "contribute_banner_title": "Sabe algo que nos falta?",
    "contribute_banner_description": "Ajude a expandir o arquivo com seu conhecimento.",
    "contribute_banner_button": "Contribuir",
    "support_divider": "Suporte"
  },
  "ru": {
    "title": "Архив - Документы | Classic Mini DIY",
    "description": "Просматривайте руководства, рекламу, каталоги и руководства по тюнингу для Classic Mini Cooper.",
    "hero_title": "Архив Документов",
    "breadcrumb_title": "Документы",
    "main_heading": "Архив Документов",
    "description_text": "Просматривайте нашу коллекцию руководств, исторической рекламы, каталогов и руководств по тюнингу для Classic Mini Cooper.",
    "filters": {
      "all": "Все",
      "manuals": "Руководства",
      "adverts": "Реклама",
      "catalogues": "Каталоги",
      "tuning": "Тюнинг",
      "electrical": "Электрика"
    },
    "search_placeholder": "Поиск документов (напр. MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "Название (А-Я)",
      "newest": "Новейшие",
      "oldest": "Старейшие"
    },
    "results_count": "{count} документов найдено",
    "collections_heading": "Коллекции",
    "empty_state": "Документы не найдены.",
    "table_headers": {
      "image": "Изображение",
      "file_type": "Тип",
      "title": "Название",
      "author": "Автор",
      "actions": "Действия"
    },
    "pagination": {
      "page_text": "Страница {current} из {total}"
    },
    "contribute_banner_title": "Знаете что-то, что мы упустили?",
    "contribute_banner_description": "Помогите расширить архив своими знаниями.",
    "contribute_banner_button": "Внести вклад",
    "support_divider": "Поддержка"
  },
  "ja": {
    "title": "アーカイブ - ドキュメント | Classic Mini DIY",
    "description": "Classic Mini Cooperのワークショップマニュアル、広告、カタログ、チューニングガイドを閲覧。",
    "hero_title": "ドキュメントアーカイブ",
    "breadcrumb_title": "ドキュメント",
    "main_heading": "ドキュメントアーカイブ",
    "description_text": "Classic Mini Cooperのワークショップマニュアル、歴史的な広告、カタログ、チューニングガイドのコレクションを閲覧してください。",
    "filters": {
      "all": "すべて",
      "manuals": "マニュアル",
      "adverts": "広告",
      "catalogues": "カタログ",
      "tuning": "チューニング",
      "electrical": "電装"
    },
    "search_placeholder": "ドキュメントを検索（例：MPI、Cooper S、AKD4935）",
    "sort": {
      "title": "タイトル（A-Z）",
      "newest": "最新",
      "oldest": "最古"
    },
    "results_count": "{count}件のドキュメント",
    "collections_heading": "コレクション",
    "empty_state": "ドキュメントが見つかりません。",
    "table_headers": {
      "image": "画像",
      "file_type": "タイプ",
      "title": "タイトル",
      "author": "著者",
      "actions": "アクション"
    },
    "pagination": {
      "page_text": "{total}ページ中{current}ページ"
    },
    "contribute_banner_title": "何か見落としがありますか？",
    "contribute_banner_description": "あなたの知識でアーカイブの充実にご協力ください。",
    "contribute_banner_button": "貢献する",
    "support_divider": "サポート"
  },
  "zh": {
    "title": "存档 - 文件 | Classic Mini DIY",
    "description": "浏览Classic Mini Cooper的车间手册、广告、供应商目录和改装指南。",
    "hero_title": "文件存档",
    "breadcrumb_title": "文件",
    "main_heading": "文件存档",
    "description_text": "浏览我们的Classic Mini Cooper车间手册、历史广告、供应商目录和改装指南合集。",
    "filters": {
      "all": "全部",
      "manuals": "手册",
      "adverts": "广告",
      "catalogues": "目录",
      "tuning": "改装",
      "electrical": "电气"
    },
    "search_placeholder": "搜索文件（例：MPI、Cooper S、AKD4935）",
    "sort": {
      "title": "标题（A-Z）",
      "newest": "最新",
      "oldest": "最旧"
    },
    "results_count": "找到 {count} 个文件",
    "collections_heading": "合集",
    "empty_state": "未找到文件。",
    "table_headers": {
      "image": "图片",
      "file_type": "类型",
      "title": "标题",
      "author": "作者",
      "actions": "操作"
    },
    "pagination": {
      "page_text": "第{current}页，共{total}页"
    },
    "contribute_banner_title": "我们遗漏了什么吗？",
    "contribute_banner_description": "用您的知识帮助扩充档案。",
    "contribute_banner_button": "贡献",
    "support_divider": "支持"
  },
  "ko": {
    "title": "아카이브 - 문서 | Classic Mini DIY",
    "description": "Classic Mini Cooper의 정비 매뉴얼, 광고, 카탈로그 및 튜닝 가이드를 찾아보세요.",
    "hero_title": "문서 아카이브",
    "breadcrumb_title": "문서",
    "main_heading": "문서 아카이브",
    "description_text": "Classic Mini Cooper의 정비 매뉴얼, 역사적 광고, 카탈로그 및 튜닝 가이드 컬렉션을 찾아보세요.",
    "filters": {
      "all": "전체",
      "manuals": "매뉴얼",
      "adverts": "광고",
      "catalogues": "카탈로그",
      "tuning": "튜닝",
      "electrical": "전기"
    },
    "search_placeholder": "문서 검색 (예: MPI, Cooper S, AKD4935)",
    "sort": {
      "title": "제목 (A-Z)",
      "newest": "최신순",
      "oldest": "오래된순"
    },
    "results_count": "{count}개 문서 발견",
    "collections_heading": "컬렉션",
    "empty_state": "문서를 찾을 수 없습니다.",
    "table_headers": {
      "image": "이미지",
      "file_type": "유형",
      "title": "제목",
      "author": "저자",
      "actions": "동작"
    },
    "pagination": {
      "page_text": "{total} 페이지 중 {current} 페이지"
    },
    "contribute_banner_title": "우리가 놓친 것을 알고 계신가요?",
    "contribute_banner_description": "당신의 지식으로 아카이브를 풍성하게 만들어주세요.",
    "contribute_banner_button": "기여하기",
    "support_divider": "지원"
  }
}
</i18n>
