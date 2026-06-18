<template>
  <div v-if="!hidden && relatedListings.length > 0">
    <!-- Section Header -->
    <div class="flex items-center gap-2 mb-6">
      <i class="fas fa-wand-magic-sparkles text-primary text-2xl"></i>
      <h2 class="text-2xl font-bold">{{ t('heading') }}</h2>
    </div>

    <!-- Listings Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink
          v-for="item in relatedListings"
          :key="item.id"
          :to="`/exchange/listings/${item.slug}`"
          class="bg-base-100 shadow-sm hover:shadow-md transition-shadow rounded-lg overflow-hidden"
        >
          <!-- Photo -->
          <div class="aspect-video bg-linear-to-br from-base-200 to-base-300">
            <img
              v-if="getItemPhotoUrl(item)"
              :src="getItemPhotoUrl(item)!"
              :alt="item.title"
              class="w-full h-full object-contain"
              loading="lazy"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <i class="fas fa-image text-base-content/30 text-5xl"></i>
            </div>
          </div>

          <!-- Info -->
          <div class="p-4">
            <h3 class="font-semibold line-clamp-1">{{ item.title }}</h3>
            <div class="text-lg font-bold mt-1" :class="item.price === 0 ? 'text-success' : 'text-primary'">
              {{ formatPrice(item.price) }}
            </div>
            <div v-if="item.location" class="flex items-center gap-1 text-sm text-base-content/60 mt-1">
              <i class="fas fa-location-dot"></i>
              <span class="truncate">{{ item.location }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
  </div>

  <!-- Loading State -->
  <div v-else-if="loading">
    <div class="flex items-center gap-2 mb-6">
      <div class="skeleton w-6 h-6 rounded"></div>
      <div class="skeleton h-8 w-56"></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in limit" :key="i" class="bg-base-100 shadow-sm rounded-lg overflow-hidden">
        <div class="skeleton aspect-video w-full"></div>
        <div class="p-4 space-y-2">
          <div class="skeleton h-5 w-3/4"></div>
          <div class="skeleton h-6 w-1/3"></div>
          <div class="skeleton h-4 w-1/2"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  interface RelatedListing {
    id: string;
    title: string;
    slug: string;
    price: number;
    location: string | null;
    primary_photo_url: string | null;
  }

  const props = withDefaults(
    defineProps<{
      listingId: string;
      limit?: number;
    }>(),
    {
      limit: 4,
    }
  );

  const supabase = useSupabase();
  const { getPhotoUrl } = useListings();
  const { formatCurrency } = useCurrency();

  const relatedListings = ref<RelatedListing[]>([]);
  const loading = ref(true);
  const hidden = ref(false);

  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) return t('contactForPrice');
    if (price === 0) return t('free');
    return formatCurrency(price, 'USD');
  };

  const getItemPhotoUrl = (item: RelatedListing): string | null => {
    if (!item.primary_photo_url) return null;
    return getPhotoUrl(item.primary_photo_url);
  };

  const fetchRelatedListings = async () => {
    loading.value = true;
    hidden.value = false;
    relatedListings.value = [];

    try {
      const { data, error } = await supabase.rpc('get_related_listings', {
        p_listing_id: props.listingId,
        p_limit: props.limit,
      });

      if (error) {
        console.error('Failed to fetch related listings:', error);
        hidden.value = true;
        return;
      }

      relatedListings.value = (data as RelatedListing[]) || [];
    } catch {
      hidden.value = true;
    } finally {
      loading.value = false;
    }
  };

  // Use watch instead of onMounted so data refreshes when navigating between listings
  watch(() => props.listingId, fetchRelatedListings, { immediate: true });
</script>

<i18n lang="json">
{
  "en": { "heading": "You Might Also Like", "contactForPrice": "Contact for price", "free": "Free" },
  "es": { "heading": "También te puede gustar", "contactForPrice": "Consultar precio", "free": "Gratis" },
  "fr": { "heading": "Vous aimerez aussi", "contactForPrice": "Prix sur demande", "free": "Gratuit" },
  "de": { "heading": "Das könnte dir auch gefallen", "contactForPrice": "Preis auf Anfrage", "free": "Kostenlos" },
  "it": { "heading": "Potrebbe interessarti anche", "contactForPrice": "Prezzo su richiesta", "free": "Gratis" },
  "pt": { "heading": "Você também pode gostar", "contactForPrice": "Consultar preço", "free": "Grátis" },
  "ru": { "heading": "Вам также может понравиться", "contactForPrice": "Цена по запросу", "free": "Бесплатно" },
  "ja": { "heading": "こちらもおすすめ", "contactForPrice": "価格はお問い合わせください", "free": "無料" },
  "zh": { "heading": "您可能也喜欢", "contactForPrice": "价格请咨询", "free": "免费" },
  "ko": { "heading": "이런 매물은 어때요", "contactForPrice": "가격 문의", "free": "무료" }
}
</i18n>
