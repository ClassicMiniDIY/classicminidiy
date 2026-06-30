<template>
  <section v-if="listings.length > 0" class="py-12 bg-base-200/50">
    <div class="container">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-2xl font-bold tracking-tight">{{ t('heading') }}</h2>
        <NuxtLink to="/exchange/listings" class="btn btn-ghost btn-sm gap-1">
          {{ t('viewAll') }}
          <i class="fas fa-arrow-right text-sm" />
        </NuxtLink>
      </div>

      <!-- BaT-style grid: image-forward cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <NuxtLink
          v-for="(listing, index) in listings"
          :key="listing.id"
          :to="`/exchange/listings/${listing.slug}`"
          class="group block rounded-lg overflow-hidden bg-base-100 shadow-sm hover:shadow-md transition-shadow"
          @click="trackClick(listing.id, index)"
        >
          <!-- Image: tall aspect ratio, BaT-style -->
          <figure class="relative aspect-[4/3] bg-base-300 overflow-hidden">
            <img
              v-if="getPrimaryPhoto(listing)"
              :src="getPrimaryPhoto(listing)"
              :alt="listing.title"
              class="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
              style="object-fit: contain"
              loading="lazy"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <i class="fas fa-image text-6xl text-base-content/20" />
            </div>

            <!-- Compact badge overlay (BaT-style) -->
            <div class="absolute top-3 left-3 flex gap-1.5">
              <span
                v-if="isExampleStatus(listing.status)"
                class="badge badge-secondary badge-sm font-bold shadow-sm gap-1"
              >
                {{ t('exampleListing') }}
              </span>
              <span v-else class="badge badge-warning badge-sm font-bold shadow-sm gap-1">
                <i class="fas fa-star text-xs" />
                {{ t('featured') }}
              </span>
            </div>

            <!-- Price overlay at bottom of image (editorial style) -->
            <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-3 px-4">
              <div class="text-white text-xl font-bold">
                {{ formatListingPrice(listing.price, formatCurrency(listing.price, getListingCurrency(listing))) }}
              </div>
              <div v-if="getConvertedPrice(listing)" class="text-white/70 text-xs">
                &approx; {{ formatCurrency(getConvertedPrice(listing)!, userCurrency) }}
              </div>
            </div>
          </figure>

          <!-- Card info below image -->
          <div class="p-4">
            <h3 class="font-bold text-base line-clamp-1 mb-1">{{ listing.title }}</h3>
            <div class="flex items-center gap-1.5 text-sm text-base-content/60">
              <template v-if="getCountryFlag(listing.country)">{{ getCountryFlag(listing.country) }}</template>
              <i v-else class="fas fa-location-dot text-sm shrink-0" />
              <span>{{ displayLocation(listing) }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import type { CurrencyCode } from '~/composables/useCurrency';
  import { isExampleStatus } from '~/composables/useExampleListings';
  import { getCountryFlag } from '~/utils/countryFlags';

  const props = withDefaults(
    defineProps<{
      listings: ListingWithPhotos[];
      userCurrency?: CurrencyCode;
    }>(),
    { userCurrency: undefined }
  );

  const { t } = useI18n();
  const { getPrimaryPhoto } = useListings();
  const {
    formatCurrency,
    convertCurrency,
    fetchExchangeRates,
    exchangeRates,
    userCurrency: globalUserCurrency,
  } = useCurrency();

  // Fall back to the global viewer currency when no override is passed
  const userCurrency = computed<CurrencyCode>(() => props.userCurrency ?? globalUserCurrency.value);
  const { formatListingPrice } = useFormatters();
  const { capture } = usePostHog();

  onMounted(() => {
    fetchExchangeRates();
  });

  const getListingCurrency = (listing: ListingWithPhotos): CurrencyCode => {
    return (listing.currency as CurrencyCode) || 'USD';
  };

  const getConvertedPrice = (listing: ListingWithPhotos): number | null => {
    const listingCurrency = getListingCurrency(listing);
    if (!exchangeRates.value) return null;
    if (listingCurrency === userCurrency.value) return null;
    if (!listing.price) return null;
    return convertCurrency(listing.price, listingCurrency, userCurrency.value);
  };

  const displayLocation = (listing: ListingWithPhotos): string => {
    const parts: string[] = [];
    if (listing.city) parts.push(listing.city);
    if (listing.country && listing.country !== 'United States') {
      parts.push(listing.country);
    } else if (listing.state_province) {
      parts.push(listing.state_province);
    }
    return parts.join(', ') || listing.location || '';
  };

  const trackClick = (listingId: string, index: number) => {
    capture('featured_carousel_interaction', {
      action: 'click',
      listing_id: listingId,
      position: index,
    });
  };
</script>

<i18n lang="json">
{
  "en": {
    "heading": "Featured Listings",
    "viewAll": "View All",
    "featured": "Featured",
    "exampleListing": "Example Listing"
  },
  "es": {
    "heading": "Anuncios Destacados",
    "viewAll": "Ver Todo",
    "featured": "Destacado",
    "exampleListing": "Anuncio de Ejemplo"
  },
  "fr": {
    "heading": "Annonces en Vedette",
    "viewAll": "Voir Tout",
    "featured": "En Vedette",
    "exampleListing": "Annonce Exemple"
  },
  "de": {
    "heading": "Empfohlene Inserate",
    "viewAll": "Alle Ansehen",
    "featured": "Empfohlen",
    "exampleListing": "Beispiel-Inserat"
  },
  "it": {
    "heading": "Annunci in Evidenza",
    "viewAll": "Vedi Tutti",
    "featured": "In Evidenza",
    "exampleListing": "Annuncio di Esempio"
  },
  "pt": {
    "heading": "Anúncios em Destaque",
    "viewAll": "Ver Todos",
    "featured": "Destaque",
    "exampleListing": "Anúncio de Exemplo"
  },
  "ru": {
    "heading": "Рекомендуемые Объявления",
    "viewAll": "Смотреть Все",
    "featured": "Рекомендуемое",
    "exampleListing": "Пример Объявления"
  },
  "ja": {
    "heading": "注目のリスティング",
    "viewAll": "すべて見る",
    "featured": "注目",
    "exampleListing": "サンプルリスティング"
  },
  "zh": {
    "heading": "精选列表",
    "viewAll": "查看全部",
    "featured": "精选",
    "exampleListing": "示例列表"
  },
  "ko": {
    "heading": "추천 매물",
    "viewAll": "전체 보기",
    "featured": "추천",
    "exampleListing": "예시 매물"
  }
}
</i18n>
