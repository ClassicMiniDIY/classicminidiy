<template>
  <section v-if="listings.length > 0" class="py-12">
    <div class="container">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-2xl font-bold tracking-tight">{{ t('staffFavorites') }}</h2>
        <NuxtLink to="/exchange/listings" class="btn btn-ghost btn-sm gap-1">
          {{ t('viewAll') }}
          <i class="fas fa-arrow-right text-sm" />
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <NuxtLink
          v-for="listing in listings"
          :key="listing.id"
          :to="`/exchange/listings/${listing.slug}`"
          class="group block rounded-lg overflow-hidden bg-base-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <!-- Image -->
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
              <i class="fas fa-image text-5xl text-base-content/20" />
            </div>

            <!-- Compact Promoted badge -->
            <div class="absolute top-3 left-3">
              <span class="badge badge-primary badge-sm font-bold shadow-sm gap-1">
                <i class="fas fa-wand-magic-sparkles text-xs" />
                {{ t('promoted') }}
              </span>
            </div>

            <!-- Price overlay -->
            <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-6 pb-2 px-3">
              <div class="text-white text-lg font-bold">
                {{ formatListingPrice(listing.price, formatCurrency(listing.price, getListingCurrency(listing))) }}
              </div>
              <div v-if="getConvertedPrice(listing) && listing.price !== 0" class="text-white/70 text-xs">
                &approx; {{ formatCurrency(getConvertedPrice(listing)!, userCurrency) }}
              </div>
            </div>
          </figure>

          <!-- Card info -->
          <div class="p-3">
            <h3 class="font-semibold text-sm line-clamp-1 mb-1">{{ listing.title }}</h3>
            <div class="flex items-center gap-1 text-xs text-base-content/60">
              <template v-if="getCountryFlag(listing.country)">{{ getCountryFlag(listing.country) }}</template>
              <i v-else class="fas fa-location-dot text-xs shrink-0" />
              <span class="truncate">{{ displayLocation(listing) }}</span>
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
  import { getCountryFlag } from '~/utils/countryFlags';

  const { t } = useI18n();

  const props = withDefaults(
    defineProps<{
      listings: ListingWithPhotos[];
      userCurrency?: CurrencyCode;
    }>(),
    { userCurrency: undefined }
  );

  const { getPrimaryPhoto } = useListings();
  const {
    formatCurrency,
    convertCurrency,
    fetchExchangeRates,
    exchangeRates,
    userCurrency: globalUserCurrency,
  } = useCurrency();
  const userCurrency = computed<CurrencyCode>(() => props.userCurrency ?? globalUserCurrency.value);
  const { formatListingPrice } = useFormatters();

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
    return parts.join(', ') || listing.location || 'Unknown';
  };
</script>

<i18n lang="json">
{
  "en": {
    "staffFavorites": "Staff Favorites",
    "viewAll": "View All",
    "promoted": "Promoted"
  },
  "es": {
    "staffFavorites": "Favoritos del equipo",
    "viewAll": "Ver todo",
    "promoted": "Destacado"
  },
  "fr": {
    "staffFavorites": "Coups de coeur",
    "viewAll": "Voir tout",
    "promoted": "Mis en avant"
  },
  "de": {
    "staffFavorites": "Team-Favoriten",
    "viewAll": "Alle anzeigen",
    "promoted": "Beworben"
  },
  "it": {
    "staffFavorites": "Preferiti dello staff",
    "viewAll": "Vedi tutto",
    "promoted": "In evidenza"
  },
  "pt": {
    "staffFavorites": "Favoritos da equipe",
    "viewAll": "Ver tudo",
    "promoted": "Promovido"
  },
  "ru": {
    "staffFavorites": "Избранное редакции",
    "viewAll": "Смотреть все",
    "promoted": "Продвигаемое"
  },
  "ja": {
    "staffFavorites": "スタッフのおすすめ",
    "viewAll": "すべて見る",
    "promoted": "注目"
  },
  "zh": {
    "staffFavorites": "员工精选",
    "viewAll": "查看全部",
    "promoted": "推广"
  },
  "ko": {
    "staffFavorites": "스태프 추천",
    "viewAll": "전체 보기",
    "promoted": "프로모션"
  }
}
</i18n>
