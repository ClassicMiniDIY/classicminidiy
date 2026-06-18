<template>
  <span v-if="listing.shipping_available" class="badge badge-xs badge-outline gap-0.5">
    <i class="fas fa-truck"></i>
    {{ t('ships') }}
  </span>
  <span v-else-if="showPickupBadge" class="badge badge-xs badge-ghost gap-1"> {{ t('pickupOnly') }} </span>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';

  const { t } = useI18n();

  const props = defineProps<{
    listing: ListingWithPhotos;
  }>();

  const showPickupBadge = computed(() => {
    const category = props.listing.listing_category;
    return (category === 'parts' || category === 'engine') && !props.listing.shipping_available;
  });
</script>

<i18n lang="json">
{
  "en": { "ships": "Ships", "pickupOnly": "Pickup Only" },
  "es": { "ships": "Envío", "pickupOnly": "Solo recogida" },
  "fr": { "ships": "Expédition", "pickupOnly": "Retrait uniquement" },
  "de": { "ships": "Versand", "pickupOnly": "Nur Abholung" },
  "it": { "ships": "Spedizione", "pickupOnly": "Solo ritiro" },
  "pt": { "ships": "Envio", "pickupOnly": "Apenas retirada" },
  "ru": { "ships": "Доставка", "pickupOnly": "Только самовывоз" },
  "ja": { "ships": "配送可", "pickupOnly": "引き取りのみ" },
  "zh": { "ships": "可邮寄", "pickupOnly": "仅自取" },
  "ko": { "ships": "배송 가능", "pickupOnly": "직접 수령만" }
}
</i18n>
