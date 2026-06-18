<template>
  <div v-if="hasPriceDrop" class="badge badge-sm badge-error gap-1">
    <i class="fas fa-arrow-trend-down"></i>
    {{ t('priceDrop') }}
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  const props = defineProps<{
    previousPrice: number | null | undefined;
    currentPrice: number;
  }>();

  const hasPriceDrop = computed(() => {
    return (
      props.previousPrice != null &&
      props.previousPrice > 0 &&
      props.currentPrice > 0 &&
      props.currentPrice < props.previousPrice
    );
  });
</script>

<i18n lang="json">
{
  "en": { "priceDrop": "Price Drop" },
  "es": { "priceDrop": "Bajada de precio" },
  "fr": { "priceDrop": "Baisse de prix" },
  "de": { "priceDrop": "Preissenkung" },
  "it": { "priceDrop": "Prezzo ridotto" },
  "pt": { "priceDrop": "Preço reduzido" },
  "ru": { "priceDrop": "Снижение цены" },
  "ja": { "priceDrop": "値下げ" },
  "zh": { "priceDrop": "降价" },
  "ko": { "priceDrop": "가격 인하" }
}
</i18n>
