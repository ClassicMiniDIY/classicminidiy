<script lang="ts" setup>
  import type { ArchiveCollectionItem } from '../../composables/useArchiveDocuments';

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
              {{ collection.itemCount }} {{ $t('items_label') }}
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
              {{ $t('view_collection') }} <i class="fad fa-arrow-right ml-1"></i>
            </span>
          </div>
        </template>
      </UCard>
    </div>
  </NuxtLink>
</template>

<i18n lang="json">
{
  "en": { "items_label": "items", "view_collection": "View Collection" },
  "de": { "items_label": "Einträge", "view_collection": "Sammlung anzeigen" },
  "es": { "items_label": "elementos", "view_collection": "Ver Colección" },
  "fr": { "items_label": "éléments", "view_collection": "Voir la Collection" },
  "it": { "items_label": "elementi", "view_collection": "Vedi Collezione" },
  "pt": { "items_label": "itens", "view_collection": "Ver Coleção" },
  "ru": { "items_label": "элементов", "view_collection": "Просмотр Коллекции" },
  "ja": { "items_label": "アイテム", "view_collection": "コレクションを見る" },
  "zh": { "items_label": "项目", "view_collection": "查看合集" },
  "ko": { "items_label": "항목", "view_collection": "컬렉션 보기" }
}
</i18n>
