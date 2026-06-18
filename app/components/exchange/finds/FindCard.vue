<template>
  <NuxtLink
    :to="`/exchange/finds/${find.slug}`"
    class="card bg-base-100 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer h-full"
  >
    <!-- Image -->
    <figure class="relative">
      <div class="aspect-video bg-linear-to-br from-base-200 to-base-300 w-full">
        <img
          v-if="find.og_image_url && !imageError"
          :src="find.og_image_url"
          :alt="find.title"
          class="w-full h-full object-cover"
          loading="lazy"
          @error="imageError = true"
        />
        <div v-else class="w-full h-full flex items-center justify-center">
          <i class="fas fa-link text-5xl text-base-content/30"></i>
        </div>
      </div>

      <!-- Source site badge -->
      <ExchangeFindsSourceSiteBadge :site="find.source_site" class="absolute top-2 left-2 shadow-sm" />

      <!-- Editor's Pick badge -->
      <span v-if="find.is_editors_pick" class="badge badge-sm badge-accent absolute top-2 right-2 gap-1">
        <i class="fas fa-star"></i>
        {{ t('editorsPick') }}
      </span>
    </figure>

    <!-- Card Body -->
    <div class="card-body p-4">
      <!-- Title -->
      <h3 class="card-title text-base font-bold line-clamp-2">{{ find.title }}</h3>

      <!-- Year / Model -->
      <p v-if="find.year || find.model" class="text-sm text-base-content/70">
        {{ [find.year, find.model].filter(Boolean).join(' ') }}
      </p>

      <!-- Price -->
      <div v-if="find.price != null" class="text-lg font-bold text-primary">
        {{ find.price_label || formatPrice(find.price) }}
      </div>
      <div v-else-if="find.price_label" class="text-lg font-bold text-primary">
        {{ find.price_label }}
      </div>

      <!-- Auction countdown -->
      <div
        v-if="auctionLabel"
        class="flex items-center gap-1 text-sm"
        :class="auctionEnded ? 'text-base-content/50' : 'text-warning'"
      >
        <i :class="auctionEnded ? 'fas fa-clock' : 'fas fa-fire'"></i>
        {{ auctionLabel }}
      </div>

      <!-- Description snippet -->
      <p v-if="find.description" class="text-sm text-base-content/60 line-clamp-2">
        {{ find.description }}
      </p>

      <!-- Tags -->
      <div v-if="find.tags && find.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
        <span v-for="tag in displayTags" :key="tag" class="badge badge-xs badge-outline">
          {{ tag }}
        </span>
        <span v-if="find.tags.length > 3" class="badge badge-xs badge-ghost"> +{{ find.tags.length - 3 }} </span>
      </div>

      <!-- Footer row -->
      <div class="flex items-center justify-between text-xs text-base-content/50 mt-auto pt-2">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <i class="fas fa-heart"></i>
            {{ find.like_count }}
          </span>
          <span class="flex items-center gap-1">
            <i class="fas fa-comment"></i>
            {{ find.comment_count }}
          </span>
        </div>
        <ExchangeFindsSourceSiteBadge :site="find.source_site" icon-only />
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
  import type { ExternalListing } from '~/composables/useExternalListings';

  const { t } = useI18n();

  interface Props {
    find: ExternalListing;
  }

  const props = defineProps<Props>();

  const imageError = ref(false);

  // Format price as currency
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Only show first 3 tags
  const displayTags = computed(() => {
    return props.find.tags?.slice(0, 3) || [];
  });

  // Don't show auction countdown if the listing is already sold
  const isSold = computed(() => {
    return props.find.price_label ? /sold/i.test(props.find.price_label) : false;
  });

  // Auction countdown logic
  const auctionEnded = computed(() => {
    if (!props.find.auction_end_time || isSold.value) return false;
    return new Date(props.find.auction_end_time) <= new Date();
  });

  const auctionLabel = computed(() => {
    if (!props.find.auction_end_time || isSold.value) return null;

    const endTime = new Date(props.find.auction_end_time);
    const now = new Date();

    if (endTime <= now) {
      return t('ended');
    }

    const diffMs = endTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;

    if (diffDays > 0) {
      return t('endsInDays', { days: diffDays, hours: remainingHours });
    }
    return t('endsInHours', { hours: diffHours, minutes: diffMinutes });
  });
</script>

<i18n lang="json">
{
  "en": { "editorsPick": "Editor's Pick", "ended": "Ended", "endsInDays": "Ends in {days}d {hours}h", "endsInHours": "Ends in {hours}h {minutes}m" },
  "es": { "editorsPick": "Selección del editor", "ended": "Finalizada", "endsInDays": "Termina en {days}d {hours}h", "endsInHours": "Termina en {hours}h {minutes}m" },
  "fr": { "editorsPick": "Choix de la rédaction", "ended": "Terminée", "endsInDays": "Se termine dans {days}j {hours}h", "endsInHours": "Se termine dans {hours}h {minutes}m" },
  "de": { "editorsPick": "Redaktionstipp", "ended": "Beendet", "endsInDays": "Endet in {days}T {hours}Std", "endsInHours": "Endet in {hours}Std {minutes}Min" },
  "it": { "editorsPick": "Scelta della redazione", "ended": "Terminata", "endsInDays": "Termina tra {days}g {hours}h", "endsInHours": "Termina tra {hours}h {minutes}min" },
  "pt": { "editorsPick": "Escolha do editor", "ended": "Encerrada", "endsInDays": "Termina em {days}d {hours}h", "endsInHours": "Termina em {hours}h {minutes}min" },
  "ru": { "editorsPick": "Выбор редакции", "ended": "Завершено", "endsInDays": "Завершится через {days}д {hours}ч", "endsInHours": "Завершится через {hours}ч {minutes}м" },
  "ja": { "editorsPick": "編集者のおすすめ", "ended": "終了", "endsInDays": "残り {days}日 {hours}時間", "endsInHours": "残り {hours}時間 {minutes}分" },
  "zh": { "editorsPick": "编辑精选", "ended": "已结束", "endsInDays": "{days}天 {hours}小时后结束", "endsInHours": "{hours}小时 {minutes}分钟后结束" },
  "ko": { "editorsPick": "편집자 추천", "ended": "종료됨", "endsInDays": "{days}일 {hours}시간 후 종료", "endsInHours": "{hours}시간 {minutes}분 후 종료" }
}
</i18n>
