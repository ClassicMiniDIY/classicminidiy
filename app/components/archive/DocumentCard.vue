<script lang="ts" setup>
  import type { ArchiveDocumentItem } from '../../composables/useArchiveDocuments';
  import { shareArchiveItem } from '../../../data/models/helper-utils';

  const { t } = useI18n();
  const { track, trackDownload } = useAnalytics();

  defineProps<{
    item: ArchiveDocumentItem;
  }>();
</script>

<template>
  <div class="card bg-base-100 shadow-md border border-base-300 relative h-full flex flex-col">
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
      <div v-if="item.language && item.language !== 'en'" class="absolute top-2 left-2">
        <span class="badge badge-sm badge-info font-bold">
          {{ item.language.toUpperCase() }}
        </span>
      </div>
    </figure>
    <div v-else class="flex justify-center items-center h-[150px] bg-base-200 rounded-t-lg relative">
      <i class="fad fa-image-slash text-4xl opacity-70"></i>
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
      <div v-if="item.language && item.language !== 'en'" class="absolute top-2 left-2">
        <span class="badge badge-sm badge-info font-bold">
          {{ item.language.toUpperCase() }}
        </span>
      </div>
    </div>

    <div class="card-body">
      <NuxtLink :to="item.path" class="hover:underline">
        <h2 class="font-bold text-lg">{{ item.title }}</h2>
      </NuxtLink>
      <p v-if="item.code" class="text-sm opacity-70">{{ item.code }}</p>
      <p v-if="item.description" class="text-sm my-2 line-clamp-2">{{ item.description }}</p>

      <div class="card-actions justify-between gap-2 mt-auto">
        <button class="btn btn-outline btn-sm" @click="() => { shareArchiveItem(item.title, item.path); track('document_shared', { document_id: item.id, method: navigator.share ? 'web_share' : 'clipboard', location: 'card' }); }">
          <i class="fad fa-arrow-up-from-bracket mr-1"></i>
          {{ t('actions.share') }}
        </button>

        <NuxtLink
          v-if="item.download"
          :to="item.download"
          target="_blank"
          class="btn btn-sm btn-primary"
          @click="trackDownload({ document_id: item.id, file_type: item.download.split('.').pop()?.toUpperCase(), location: 'card', name: item.title })"
        >
          <i class="fad fa-download mr-1"></i> {{ t('actions.download') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": { "actions": { "share": "Share", "download": "Download" } },
  "de": { "actions": { "share": "Teilen", "download": "Herunterladen" } },
  "es": { "actions": { "share": "Compartir", "download": "Descargar" } },
  "fr": { "actions": { "share": "Partager", "download": "Télécharger" } },
  "it": { "actions": { "share": "Condividi", "download": "Scarica" } },
  "pt": { "actions": { "share": "Compartilhar", "download": "Baixar" } },
  "ru": { "actions": { "share": "Поделиться", "download": "Скачать" } },
  "ja": { "actions": { "share": "共有", "download": "ダウンロード" } },
  "zh": { "actions": { "share": "分享", "download": "下载" } },
  "ko": { "actions": { "share": "공유", "download": "다운로드" } }
}
</i18n>
