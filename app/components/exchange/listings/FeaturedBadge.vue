<template>
  <div v-if="shouldShowBadge" class="inline-flex">
    <div class="badge badge-warning gap-1 font-medium">
      <i class="fas fa-star"></i>
      <span>{{ t('featured') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { isListingFeatured } from '~~/shared/utils/listingPromotion';

  const { t } = useI18n();

  type ListingTier = 'free' | 'paid';

  interface Props {
    tier: ListingTier;
    /** The listing's status. A premium listing is featured only while it is live. */
    status?: string | null;
  }

  const props = defineProps<Props>();

  const shouldShowBadge = computed(() => isListingFeatured(props));
</script>

<i18n lang="json">
{
  "en": { "featured": "Featured" },
  "es": { "featured": "Destacado" },
  "fr": { "featured": "En vedette" },
  "de": { "featured": "Hervorgehoben" },
  "it": { "featured": "In evidenza" },
  "pt": { "featured": "Destaque" },
  "ru": { "featured": "Рекомендуемое" },
  "ja": { "featured": "注目" },
  "zh": { "featured": "精选" },
  "ko": { "featured": "추천" }
}
</i18n>
