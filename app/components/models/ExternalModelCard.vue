<script setup lang="ts">
  /**
   * Browse-grid card for an external listing ("Around the Web"). Mirrors
   * ModelCard's layout but links to the external detail route, shows a
   * source-site badge where the price badge sits, and surfaces the source
   * author + like/outbound-click counts instead of downloads.
   */
  import type { ExternalModelCard } from '~~/data/models/external-models';

  defineProps<{ model: ExternalModelCard }>();
  const { t } = useI18n();
</script>

<template>
  <NuxtLink
    :to="`/models/external/${model.slug}`"
    class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
  >
    <figure class="relative aspect-[4/3] bg-base-200 overflow-hidden">
      <img
        v-if="model.primaryImage"
        :src="model.primaryImage"
        :alt="model.title"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-base-content/30">
        <i class="fas fa-cube text-4xl"></i>
      </div>
      <span v-if="model.isFeatured" class="absolute top-2 left-2 badge badge-primary badge-sm gap-1">
        <i class="fas fa-star text-[0.6rem]"></i> {{ t('featured') }}
      </span>
      <ModelsSourceBadge :site="model.sourceSite" size="sm" class="absolute bottom-2 right-2" />
    </figure>

    <div class="card-body p-4 gap-1">
      <h3 class="font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
        {{ model.title }}
      </h3>
      <p v-if="model.summary" class="text-sm opacity-70 line-clamp-2">{{ model.summary }}</p>

      <div class="flex items-center justify-between mt-2 text-xs opacity-70">
        <span class="flex items-center gap-1.5 min-w-0">
          <i class="fas fa-circle-user text-base"></i>
          <span class="truncate">{{ model.sourceAuthorName || t('anonymous') }}</span>
        </span>
        <span class="flex items-center gap-3 shrink-0">
          <span :title="t('likes')"><i class="fas fa-heart"></i> {{ model.likeCount }}</span>
          <span :title="t('visits')"><i class="fas fa-arrow-up-right-from-square"></i> {{ model.clickCount }}</span>
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<i18n lang="json">
{
  "en": { "featured": "Featured", "anonymous": "Unknown maker", "likes": "Likes", "visits": "Outbound visits" },
  "es": { "featured": "Destacado", "anonymous": "Autor desconocido", "likes": "Me gusta", "visits": "Visitas externas" },
  "fr": { "featured": "En vedette", "anonymous": "Créateur inconnu", "likes": "J'aime", "visits": "Visites sortantes" },
  "de": { "featured": "Empfohlen", "anonymous": "Unbekannter Ersteller", "likes": "Gefällt mir", "visits": "Externe Besuche" },
  "it": { "featured": "In evidenza", "anonymous": "Autore sconosciuto", "likes": "Mi piace", "visits": "Visite esterne" },
  "pt": { "featured": "Destaque", "anonymous": "Autor desconhecido", "likes": "Curtidas", "visits": "Visitas externas" },
  "ru": { "featured": "Рекомендуем", "anonymous": "Автор неизвестен", "likes": "Нравится", "visits": "Внешние переходы" },
  "ja": { "featured": "おすすめ", "anonymous": "作者不明", "likes": "いいね", "visits": "外部アクセス" },
  "zh": { "featured": "精选", "anonymous": "未知作者", "likes": "点赞", "visits": "外部访问" },
  "ko": { "featured": "추천", "anonymous": "작자 미상", "likes": "좋아요", "visits": "외부 방문" }
}
</i18n>
