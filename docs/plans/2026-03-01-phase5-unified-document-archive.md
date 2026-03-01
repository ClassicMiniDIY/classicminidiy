# Phase 5: Unified Document Archive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the four separate document listing pages (manuals, adverts, catalogues, tuning) into a single unified `/archive/documents` page with type filtering, search, sort, and collection support, with proper 301 redirects from old URLs.

**Architecture:** The existing `useArchiveDocuments` composable gets extended with methods for unified listing (all types), collection queries, and individual document/collection lookups by slug. New `DocumentCard` and `CollectionCard` components replace the inline rendering in `ArchiveLandingIterator`. The archive hub consolidates the four document tiles into one. Server middleware handles legacy slug redirects; static routeRules handle section-level redirects.

**Tech Stack:** Nuxt 4.3.1, @supabase/supabase-js, Nuxt UI 4.4.0, i18n (10 locales), TypeScript, daisyUI 5.0

**Repo:** Classic Mini DIY (`/Users/colegentry/Development/classicminidiy`), branch `archive-upgrade`

---

## Context

Phase 4 rewrote the data layer — all archive pages now query Supabase instead of DynamoDB/@nuxt/content. The four document listing pages (`manuals`, `adverts`, `catalogues`, `tuning`) each call `useArchiveDocuments().listByType(type)` and render via `ArchiveLandingIterator`. This phase merges them into one unified page.

**Important architectural notes:**
- The `/archive/electrical` page is NOT a document listing — it's an interactive wiring diagram viewer powered by a static JSON file (`data/wiringDiagrams.json`) with Fuse.js search. It stays separate and is NOT redirected.
- The `document_collections` table exists in Supabase (created in Phase 1) and may or may not have data. The unified page must handle collections gracefully (show them if they exist, otherwise just show standalone documents).
- The `archive_documents` table has a GIN full-text search index on `to_tsvector('english', title || description || code || author)`.
- The `[...slug].vue` catch-all page at the root currently handles individual document detail views. This will be replaced by explicit `/archive/documents/[slug].vue` route.

**Key files (read these before implementing):**
- `app/composables/useArchiveDocuments.ts` — current composable with `listByType()`, `getByPath()`, `getStorageUrl()`, `getThumbnailUrl()`
- `app/components/ArchiveLandingIterator.vue` — current card/table rendering with search, pagination, view toggle
- `app/pages/[...slug].vue` — current catch-all for document detail
- `app/pages/archive/index.vue` — hub page with 11 tiles
- `data/models/generic.ts` — `ArchiveItems` array and `ArchiveItem` interface
- `data/models/helper-utils.ts` — `ARCHIVE_TYPES` enum, `shareArchiveItem()`, `submitArchiveFile()`

---

## Task 1: Extend useArchiveDocuments Composable

**Files:**
- Modify: `app/composables/useArchiveDocuments.ts`

**Step 1: Add collection interface and new methods**

Add `ArchiveCollectionItem` interface and four new methods alongside the existing ones:

```typescript
export interface ArchiveCollectionItem {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  image: string;
  itemCount: number;
}
```

New methods to add:

```typescript
const listAll = async (opts?: {
  type?: string;
  search?: string;
  sort?: 'title' | 'newest' | 'oldest';
}): Promise<ArchiveDocumentItem[]> => {
  let query = supabase
    .from('archive_documents')
    .select('*')
    .eq('status', 'approved');

  if (opts?.type) {
    query = query.eq('type', opts.type);
  }

  if (opts?.search) {
    query = query.textSearch('title', opts.search, { type: 'websearch' });
  }

  if (opts?.sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (opts?.sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else {
    query = query.order('title');
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = (data || []).map(mapToArchiveItem);
  // Sort items with downloads first
  items.sort((a, b) => {
    const k1 = a.download ? 1 : 0;
    const k2 = b.download ? 1 : 0;
    return k2 - k1;
  });

  return items;
};

const listCollections = async (opts?: {
  type?: string;
}): Promise<ArchiveCollectionItem[]> => {
  let query = supabase
    .from('document_collections')
    .select('*, archive_documents(count)')
    .eq('status', 'approved');

  if (opts?.type) {
    query = query.eq('type', opts.type);
  }

  query = query.order('title');

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title || '',
    description: row.description || '',
    image: getThumbnailUrl(row.thumbnail_path),
    itemCount: row.archive_documents?.[0]?.count || 0,
  }));
};

const getDocumentBySlug = async (slug: string): Promise<ArchiveDocumentItem | null> => {
  const { data, error } = await supabase
    .from('archive_documents')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (error || !data) return null;
  return mapToArchiveItem(data);
};

const getCollectionBySlug = async (slug: string): Promise<{
  collection: ArchiveCollectionItem;
  documents: ArchiveDocumentItem[];
} | null> => {
  const { data: collection, error } = await supabase
    .from('document_collections')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (error || !collection) return null;

  const { data: docs } = await supabase
    .from('archive_documents')
    .select('*')
    .eq('collection_id', collection.id)
    .eq('status', 'approved')
    .order('sort_order');

  return {
    collection: {
      id: collection.id,
      slug: collection.slug,
      type: collection.type,
      title: collection.title || '',
      description: collection.description || '',
      image: getThumbnailUrl(collection.thumbnail_path),
      itemCount: docs?.length || 0,
    },
    documents: (docs || []).map(mapToArchiveItem),
  };
};
```

Update the return statement to include the new methods:

```typescript
return {
  listByType,
  listAll,
  listCollections,
  getByPath,
  getDocumentBySlug,
  getCollectionBySlug,
  getStorageUrl,
  getThumbnailUrl,
};
```

**Note on search:** The `textSearch` with `websearch` type uses Postgres full-text search, which is supported by the GIN index already created on `archive_documents`. If `textSearch` produces poor results for partial matches, fall back to `ilike` filtering:

```typescript
if (opts?.search) {
  query = query.or(`title.ilike.%${opts.search}%,description.ilike.%${opts.search}%,code.ilike.%${opts.search}%`);
}
```

**Step 2: Commit**

---

## Task 2: Create DocumentCard Component

**Files:**
- Create: `app/components/archive/DocumentCard.vue`

**Step 1: Create the component**

Extract the card rendering from `ArchiveLandingIterator.vue` into a standalone component. This component renders a single archive document as a `UCard`.

```vue
<script lang="ts" setup>
  import type { ArchiveDocumentItem } from '../../composables/useArchiveDocuments';
  import { shareArchiveItem } from '../../data/models/helper-utils';

  const { t } = useI18n();

  defineProps<{
    item: ArchiveDocumentItem;
  }>();
</script>

<template>
  <UCard class="relative h-full flex flex-col">
    <template #header>
      <figure v-if="item.image" class="relative">
        <NuxtLink v-if="item.download" :to="item.path">
          <img :src="item.image" :alt="item.title" class="h-[150px] w-full object-cover rounded-t-lg" />
        </NuxtLink>
        <img v-else :src="item.image" :alt="item.title" class="h-[150px] w-full object-cover rounded-t-lg" />
        <div v-if="item.download" class="absolute top-2 right-2">
          <i
            :class="[
              'fad',
              'fa-file-' + (item.download.split('.').pop()?.toLowerCase() || ''),
              'text-2xl',
              'text-secondary',
            ]"
          ></i>
        </div>
      </figure>
      <div v-else class="flex justify-center items-center h-[150px] bg-muted rounded-t-lg relative">
        <i class="fad fa-image-slash text-4xl text-muted"></i>
        <div v-if="item.download" class="absolute top-2 right-2">
          <i
            :class="[
              'fad',
              'fa-file-' + (item.download.split('.').pop()?.toLowerCase() || ''),
              'text-2xl',
              'text-secondary',
            ]"
          ></i>
        </div>
      </div>
    </template>

    <NuxtLink :to="item.path" class="hover:underline">
      <h2 class="font-bold text-lg">{{ item.title }}</h2>
    </NuxtLink>
    <p v-if="item.code" class="text-sm text-muted">{{ item.code }}</p>
    <p v-if="item.description" class="text-sm my-2 line-clamp-2">{{ item.description }}</p>

    <template #footer>
      <div class="flex justify-between gap-2">
        <UButton variant="outline" size="sm" @click="shareArchiveItem(item.title, item.path)">
          <i class="fad fa-arrow-up-from-bracket mr-1"></i>
          {{ t('actions.share') }}
        </UButton>

        <UButton
          v-if="item.download"
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
</template>

<i18n lang="json">
{
  "en": {
    "actions": { "share": "Share", "download": "Download" }
  },
  "de": {
    "actions": { "share": "Teilen", "download": "Herunterladen" }
  },
  "es": {
    "actions": { "share": "Compartir", "download": "Descargar" }
  },
  "fr": {
    "actions": { "share": "Partager", "download": "Télécharger" }
  },
  "it": {
    "actions": { "share": "Condividi", "download": "Scarica" }
  },
  "pt": {
    "actions": { "share": "Compartilhar", "download": "Baixar" }
  },
  "ru": {
    "actions": { "share": "Поделиться", "download": "Скачать" }
  },
  "ja": {
    "actions": { "share": "共有", "download": "ダウンロード" }
  },
  "zh": {
    "actions": { "share": "分享", "download": "下载" }
  },
  "ko": {
    "actions": { "share": "공유", "download": "다운로드" }
  }
}
</i18n>
```

**Step 2: Commit**

---

## Task 3: Create CollectionCard Component

**Files:**
- Create: `app/components/archive/CollectionCard.vue`

**Step 1: Create the component**

A "stacked card" visual that shows a collection with an item count badge. Uses a CSS shadow/offset effect to create the stacked look.

```vue
<script lang="ts" setup>
  import type { ArchiveCollectionItem } from '../../composables/useArchiveDocuments';

  const { t } = useI18n();

  defineProps<{
    collection: ArchiveCollectionItem;
  }>();
</script>

<template>
  <NuxtLink :to="`/archive/documents/collection/${collection.slug}`" class="block group">
    <div class="relative">
      <!-- Stacked card shadow layers -->
      <div class="absolute inset-0 translate-x-1 translate-y-1 bg-base-300 rounded-lg"></div>
      <div class="absolute inset-0 translate-x-0.5 translate-y-0.5 bg-base-200 rounded-lg"></div>

      <UCard class="relative h-full">
        <template #header>
          <figure v-if="collection.image" class="relative">
            <img
              :src="collection.image"
              :alt="collection.title"
              class="h-[150px] w-full object-cover rounded-t-lg group-hover:opacity-90 transition-opacity"
            />
          </figure>
          <div v-else class="flex justify-center items-center h-[150px] bg-muted rounded-t-lg">
            <i class="fad fa-books text-4xl text-muted"></i>
          </div>
          <!-- Item count badge -->
          <div class="absolute top-2 right-2">
            <span class="badge badge-primary badge-lg font-bold">
              {{ collection.itemCount }} {{ t('items_label') }}
            </span>
          </div>
        </template>

        <h2 class="font-bold text-lg group-hover:underline">{{ collection.title }}</h2>
        <p v-if="collection.description" class="text-sm my-2 line-clamp-2 text-muted">
          {{ collection.description }}
        </p>

        <template #footer>
          <div class="flex justify-end">
            <span class="text-sm text-primary font-medium">
              {{ t('view_collection') }} <i class="fad fa-arrow-right ml-1"></i>
            </span>
          </div>
        </template>
      </UCard>
    </div>
  </NuxtLink>
</template>

<i18n lang="json">
{
  "en": {
    "items_label": "items",
    "view_collection": "View Collection"
  },
  "de": {
    "items_label": "Einträge",
    "view_collection": "Sammlung anzeigen"
  },
  "es": {
    "items_label": "elementos",
    "view_collection": "Ver Colección"
  },
  "fr": {
    "items_label": "éléments",
    "view_collection": "Voir la Collection"
  },
  "it": {
    "items_label": "elementi",
    "view_collection": "Vedi Collezione"
  },
  "pt": {
    "items_label": "itens",
    "view_collection": "Ver Coleção"
  },
  "ru": {
    "items_label": "элементов",
    "view_collection": "Просмотр Коллекции"
  },
  "ja": {
    "items_label": "アイテム",
    "view_collection": "コレクションを見る"
  },
  "zh": {
    "items_label": "项目",
    "view_collection": "查看合集"
  },
  "ko": {
    "items_label": "항목",
    "view_collection": "컬렉션 보기"
  }
}
</i18n>
```

**Step 2: Commit**

---

## Task 4: Build Unified Documents Page

**Files:**
- Create: `app/pages/archive/documents/index.vue`

**Step 1: Create the page**

This is the main unified listing page. Features:
- Type filter chips (All, Manuals, Adverts, Catalogues, Tuning)
- Search bar with debounce
- Sort dropdown (Title, Newest, Oldest)
- Cards/Table view toggle (reuse pattern from ArchiveLandingIterator)
- Client-side pagination
- Collections displayed alongside standalone documents in cards view
- URL query param sync for `type` filter (supports `/archive/documents?type=manual`)

```vue
<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';
  import type { ArchiveDocumentItem, ArchiveCollectionItem } from '../../../composables/useArchiveDocuments';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  // Read type from query param (for redirect support)
  const activeType = ref<string>(
    (route.query.type as string) || 'all'
  );
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
  ];

  const { listAll, listCollections } = useArchiveDocuments();

  // Fetch documents
  const { data: documents, status } = await useAsyncData(
    () => `archive-docs-${activeType.value}-${sortBy.value}`,
    () => listAll({
      type: activeType.value === 'all' ? undefined : activeType.value,
      sort: sortBy.value,
    }),
    { watch: [activeType, sortBy] }
  );

  // Fetch collections
  const { data: collections } = await useAsyncData(
    () => `archive-collections-${activeType.value}`,
    () => listCollections({
      type: activeType.value === 'all' ? undefined : activeType.value,
    }),
    { watch: [activeType] }
  );

  // Client-side search filter
  const filteredDocuments = computed(() => {
    if (!documents.value) return [];
    if (!search.value) return documents.value;
    const q = search.value.toLowerCase();
    return documents.value.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q)
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
    meta: [
      { key: 'description', name: 'description', content: t('description') },
    ],
    link: [
      { rel: 'canonical', href: 'https://classicminidiy.com/archive/documents' },
    ],
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
            {{ t(filter.labelKey) }}
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
            <UButtonGroup>
              <UButton
                :color="viewMode === 'cards' ? 'primary' : 'neutral'"
                :variant="viewMode === 'cards' ? 'solid' : 'outline'"
                @click="viewMode = 'cards'"
              >
                <i class="fad fa-grid-2"></i>
              </UButton>
              <UButton
                :color="viewMode === 'table' ? 'primary' : 'neutral'"
                :variant="viewMode === 'table' ? 'solid' : 'outline'"
                @click="viewMode = 'table'"
              >
                <i class="fad fa-table"></i>
              </UButton>
            </UButtonGroup>
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
          <div v-if="filteredDocuments.length === 0 && (!collections || collections.length === 0)" class="text-center py-8">
            <UCard>
              <p class="text-muted">{{ t('empty_state') }}</p>
            </UCard>
          </div>

          <!-- Collections Row (cards view only, shown above documents) -->
          <div v-if="collections && collections.length > 0 && viewMode === 'cards' && !search" class="mb-8">
            <h2 class="text-lg font-semibold mb-4">{{ t('collections_heading') }}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <archive-collection-card
                v-for="col in collections"
                :key="col.id"
                :collection="col"
              />
            </div>
          </div>

          <!-- Documents Cards View -->
          <div v-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <archive-document-card
              v-for="item in paginatedDocuments"
              :key="item.title"
              :item="item"
            />
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
                  <th class="p-3 text-right">{{ t('table_headers.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in paginatedDocuments" :key="item.title" class="border-b border-default hover:bg-muted/50">
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
      "tuning": "Tuning"
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
      "actions": "Actions"
    },
    "pagination": {
      "page_text": "Page {current} of {total}"
    },
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
      "tuning": "Tuning"
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
      "actions": "Aktionen"
    },
    "pagination": {
      "page_text": "Seite {current} von {total}"
    },
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
      "tuning": "Modificaciones"
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
      "actions": "Acciones"
    },
    "pagination": {
      "page_text": "Página {current} de {total}"
    },
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
      "tuning": "Tuning"
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
      "actions": "Actions"
    },
    "pagination": {
      "page_text": "Page {current} sur {total}"
    },
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
      "tuning": "Tuning"
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
      "actions": "Azioni"
    },
    "pagination": {
      "page_text": "Pagina {current} di {total}"
    },
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
      "tuning": "Tuning"
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
      "actions": "Ações"
    },
    "pagination": {
      "page_text": "Página {current} de {total}"
    },
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
      "tuning": "Тюнинг"
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
      "actions": "Действия"
    },
    "pagination": {
      "page_text": "Страница {current} из {total}"
    },
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
      "tuning": "チューニング"
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
      "actions": "アクション"
    },
    "pagination": {
      "page_text": "{total}ページ中{current}ページ"
    },
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
      "tuning": "改装"
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
      "actions": "操作"
    },
    "pagination": {
      "page_text": "第{current}页，共{total}页"
    },
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
      "tuning": "튜닝"
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
      "actions": "동작"
    },
    "pagination": {
      "page_text": "{total} 페이지 중 {current} 페이지"
    },
    "support_divider": "지원"
  }
}
</i18n>
```

**Step 2: Commit**

---

## Task 5: Build Document Detail Page

**Files:**
- Create: `app/pages/archive/documents/[slug].vue`

**Step 1: Create the page**

Replaces the catch-all `[...slug].vue` for document detail. Uses `getDocumentBySlug()` for clean slug-based lookup. Replicates the existing catch-all page's layout and functionality.

The page should follow the same pattern as the existing `[...slug].vue` but simplified:
- Use `route.params.slug` to get the slug directly
- Call `getDocumentBySlug(slug)` from the composable
- Show document with image, title, code, description, download/share buttons
- Include JSON-LD `DigitalDocument` structured data
- Include i18n translations in all 10 locales

**Reference:** Read `app/pages/[...slug].vue` for the full template structure. The new page should match its UI but use the cleaner slug-based API.

**Key difference from catch-all:** This page uses `route.params.slug` directly instead of parsing a full path. The composable's `getDocumentBySlug()` does a simple `eq('slug', slug)` query.

**Step 2: Commit**

---

## Task 6: Build Collection Detail Page

**Files:**
- Create: `app/pages/archive/documents/collection/[slug].vue`

**Step 1: Create the page**

Shows a collection with its items listed in sort order. Each item has a download link.

The page should:
- Call `getCollectionBySlug(slug)` from the composable
- Show collection title, description, thumbnail
- List all documents in the collection with their individual download links and thumbnails
- Include a "View Document" link per item that goes to `/archive/documents/{item.slug}`
- Include JSON-LD structured data
- Include i18n translations in all 10 locales

Template structure:
- Hero + breadcrumb (Archive > Documents > Collection Title)
- Collection header with title, description, thumbnail
- Grid or list of items in the collection
- Each item: thumbnail, title, code, description, download button
- Support section at bottom

**Step 2: Commit**

---

## Task 7: Update Archive Hub Page

**Files:**
- Modify: `data/models/generic.ts`
- Modify: `app/pages/archive/index.vue`

**Step 1: Update ArchiveItems in generic.ts**

Replace the four separate document tiles (Workshop Manuals, Adverts, Vendor Catalogues, Tuning and Modifications) with a single "Documents" tile:

Remove these four items:
```typescript
// REMOVE: Workshop Manuals (path: '/archive/manuals')
// REMOVE: Adverts (path: '/archive/adverts')
// REMOVE: Vendor Catalogues (path: '/archive/catalogues')
// REMOVE: Tuning and Modifications (path: '/archive/tuning')
```

Add one replacement:
```typescript
{
  title: 'Documents',
  description: '',
  image: 'https://cmdiy-archive.s3.us-east-1.amazonaws.com/manuals/images/manuals.jpg',
  path: '/archive/documents',
  iconHtml: '<i class="fa-duotone fa-books" style="--fa-primary-color: #71784e; --fa-secondary-color: #af6946; --fa-secondary-opacity: 0.7;"></i>',
  to: '/archive/documents',
},
```

The resulting hub should have 8 items: Mini Registry, Engine Sizes, Mini Weights, **Documents**, Electrical Diagrams, Wheel Library, Color Picker, Dimensions.

**Step 2: Commit**

---

## Task 8: Set Up 301 Redirects

**Files:**
- Modify: `nuxt.config.ts`
- Create: `server/middleware/legacy-archive-redirect.ts`

**Step 1: Add static route redirects in nuxt.config.ts**

In the `routeRules` section, add 301 redirects for the old section URLs:

```typescript
routeRules: {
  // ... existing rules ...
  '/archive/manuals': { redirect: { to: '/archive/documents?type=manual', statusCode: 301 } },
  '/archive/adverts': { redirect: { to: '/archive/documents?type=advert', statusCode: 301 } },
  '/archive/catalogues': { redirect: { to: '/archive/documents?type=catalogue', statusCode: 301 } },
  '/archive/tuning': { redirect: { to: '/archive/documents?type=tuning', statusCode: 301 } },
},
```

**Step 2: Create legacy slug redirect middleware**

This server middleware catches old URLs like `/archive/manuals/akd4935` and redirects to the new slug-based URL `/archive/documents/akd4935-workshop-manual`.

```typescript
// server/middleware/legacy-archive-redirect.ts
import { getServiceClient } from '../utils/supabase';

const LEGACY_PREFIXES = ['/archive/manuals/', '/archive/adverts/', '/archive/catalogues/', '/archive/tuning/'];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Only handle old document detail URLs
  const matchedPrefix = LEGACY_PREFIXES.find((prefix) => path.startsWith(prefix));
  if (!matchedPrefix) return;

  // Extract the legacy slug from the URL
  const legacySlug = path.slice(matchedPrefix.length).replace(/\/$/, '');
  if (!legacySlug) return;

  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('archive_documents')
      .select('slug')
      .eq('legacy_slug', legacySlug)
      .eq('status', 'approved')
      .maybeSingle();

    if (data?.slug) {
      return sendRedirect(event, `/archive/documents/${data.slug}`, 301);
    }

    // If no legacy_slug match, try direct slug match
    const { data: directMatch } = await supabase
      .from('archive_documents')
      .select('slug')
      .eq('slug', legacySlug)
      .eq('status', 'approved')
      .maybeSingle();

    if (directMatch?.slug) {
      return sendRedirect(event, `/archive/documents/${directMatch.slug}`, 301);
    }
  } catch {
    // If Supabase lookup fails, let the request continue to the catch-all
  }
});
```

**Note:** This middleware uses the service client because it runs server-side before page rendering. Legacy document URLs that can't be resolved will fall through to the catch-all `[...slug].vue` which still handles the lookup (backward compatibility during transition).

**Step 3: Commit**

---

## Task 9: Delete Old Pages and Clean Up

**Files:**
- Delete: `app/pages/archive/manuals/index.vue`
- Delete: `app/pages/archive/adverts/index.vue`
- Delete: `app/pages/archive/catalogues/index.vue`
- Delete: `app/pages/archive/tuning/index.vue`

**Step 1: Delete the four old listing pages**

These are fully replaced by `/archive/documents` with type filter.

**Step 2: Verify the `manuals/`, `adverts/`, `catalogues/`, `tuning/` directories**

Check if these directories are now empty. If `manuals/` only contained `index.vue`, the directory can be deleted. (The old individual document URLs like `/archive/manuals/akd4935` are now handled by the server middleware from Task 8, not by page files.)

**Step 3: Update or keep `ArchiveLandingIterator.vue`**

Check if `ArchiveLandingIterator.vue` is still used anywhere after removing the four pages. Search for `ArchiveLandingIterator` across the codebase:
- If no remaining references: delete it
- If still referenced elsewhere: keep it

**Step 4: Commit**

---

## Task 10: Update `[...slug].vue` Catch-All

**Files:**
- Modify: `app/pages/[...slug].vue`

**Step 1: Add redirect logic for old document URLs**

The catch-all currently handles document detail for any URL. With the new `/archive/documents/[slug].vue` page, documents that have proper slugs should show there. The catch-all should still work as a fallback, but add a note/redirect:

If the path matches `/archive/(manuals|adverts|catalogues|tuning)/something`, and the document was found via legacy_slug lookup, use `navigateTo()` to redirect to `/archive/documents/${document.slug}` (client-side redirect as backup to the server middleware).

**Alternatively**, if the server middleware from Task 8 handles all legacy redirects reliably, the catch-all can be simplified to only handle non-archive paths or show a 404 for unmatched archive paths.

**Implementation decision:** Read the current `[...slug].vue` and decide whether to:
1. Add client-side redirect logic for legacy archive URLs
2. Leave it as-is (it still works via `getByPath()`)
3. Simplify it to handle only non-document paths

Option 2 is safest for now — the server middleware handles the redirect, and the catch-all serves as a fallback.

**Step 2: Commit**

---

## Task 11: Build Verification

**Step 1: Run `bun run build`**

Verify no build errors. Check for:
- Missing imports
- Broken references to deleted files
- TypeScript errors

**Step 2: Verify routes**

Manually check these routes work:
- `/archive` — hub page shows "Documents" tile instead of 4 separate tiles
- `/archive/documents` — unified page loads with all documents, type filters work
- `/archive/documents?type=manual` — filters to manuals only
- `/archive/documents/{slug}` — document detail page loads
- `/archive/documents/collection/{slug}` — collection detail (if collections exist)
- `/archive/manuals` — 301 redirects to `/archive/documents?type=manual`
- `/archive/adverts` — 301 redirects to `/archive/documents?type=advert`
- `/archive/manuals/akd4935` — server middleware redirects to `/archive/documents/{real-slug}`
- `/archive/electrical` — still works (NOT redirected)
- `/archive/registry`, `/archive/colors`, `/archive/wheels` — still work unchanged

**Step 3: Verify no broken references**

Search codebase for references to deleted pages:
- `/archive/manuals` as a string (should only appear in redirects now)
- `/archive/adverts` as a string
- `ArchiveLandingIterator` (should be gone or still used)

**Step 4: Commit**

---

## Summary of Changes

| Action | File |
|--------|------|
| Modify | `app/composables/useArchiveDocuments.ts` (add 4 new methods) |
| Create | `app/components/archive/DocumentCard.vue` |
| Create | `app/components/archive/CollectionCard.vue` |
| Create | `app/pages/archive/documents/index.vue` |
| Create | `app/pages/archive/documents/[slug].vue` |
| Create | `app/pages/archive/documents/collection/[slug].vue` |
| Modify | `data/models/generic.ts` (consolidate hub tiles) |
| Modify | `app/pages/archive/index.vue` (if needed for hub changes) |
| Modify | `nuxt.config.ts` (add routeRules redirects) |
| Create | `server/middleware/legacy-archive-redirect.ts` |
| Delete | `app/pages/archive/manuals/index.vue` |
| Delete | `app/pages/archive/adverts/index.vue` |
| Delete | `app/pages/archive/catalogues/index.vue` |
| Delete | `app/pages/archive/tuning/index.vue` |
| Maybe Delete | `app/components/ArchiveLandingIterator.vue` |
| Modify | `app/pages/[...slug].vue` (optional simplification) |
