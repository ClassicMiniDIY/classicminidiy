<template>
  <!-- Vertical Card Layout (default) -->
  <div v-if="variant === 'card'" class="relative">
    <!-- Remove Button (for watchlist) -->
    <button
      v-if="showRemoveButton"
      class="btn btn-circle btn-sm btn-error absolute -top-2 -right-2 z-10"
      :disabled="removeLoading"
      @click.prevent="$emit('remove', listing)"
    >
      <span v-if="removeLoading" class="loading loading-spinner loading-xs"></span>
      <i v-else class="fas fa-xmark"></i>
    </button>

    <NuxtLink
      :to="listingUrl"
      class="card bg-base-100 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer h-full"
      :class="isFeatured && !isExample ? 'ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]' : ''"
    >
      <!-- Image -->
      <figure class="relative">
        <div class="aspect-video bg-linear-to-br from-base-200 to-base-300 w-full">
          <img
            v-if="primaryPhoto"
            :src="primaryPhoto"
            :alt="listing.title"
            class="w-full h-full object-contain"
            style="object-fit: contain"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <i class="fas fa-image text-5xl text-base-content/30"></i>
          </div>
        </div>
      </figure>

      <!-- Card Body -->
      <div class="card-body">
        <div>
          <div class="flex items-start justify-between gap-2">
            <h3 class="card-title font-bold line-clamp-1 flex-1">{{ listing.title }}</h3>
            <!-- Price Drop Badge -->
            <ExchangeListingsPriceDropBadge
              v-if="listing.previous_price"
              :previous-price="listing.previous_price"
              :current-price="listing.price"
            />
            <!-- Status Badge -->
            <span v-if="showStatusBadge && listing.status" class="badge badge-sm shrink-0" :class="statusBadgeClass">
              {{ formatStatus(listing.status) }}
            </span>
            <span v-if="isExample" class="badge badge-sm badge-secondary shrink-0">{{ t('exampleListing') }}</span>
          </div>

          <!-- Price -->
          <div class="mt-1">
            <!-- Sold Price Display -->
            <template v-if="isSold">
              <div class="text-xl font-bold text-success">
                {{ formatListingPrice(soldPrice, formatCurrency(soldPrice, listingCurrency)) }}
                <span class="text-xs font-normal text-base-content/60 ml-1">{{ t('soldSuffix') }}</span>
              </div>
            </template>
            <!-- Active Listing Price Display -->
            <template v-else>
              <div class="text-xl font-bold" :class="listing.price === 0 ? 'text-success' : 'text-primary'">
                {{ formatListingPrice(listing.price, formatCurrency(listing.price, listingCurrency)) }}
              </div>
            </template>
            <!-- Conversion estimate -->
            <div v-if="convertedPrice && displayPrice !== 0" class="text-xs text-base-content/60">
              {{ t('aboutInCurrency', { amount: formatCurrency(convertedPrice, viewerCurrency), currency: viewerCurrency }) }}
            </div>
          </div>

          <!-- Vehicle subtitle: Year, Manufacturer, Model -->
          <p
            v-if="listing.listing_category === 'vehicle' && (listing.manufacturer || listing.model)"
            class="text-sm text-base-content/70 mt-1"
          >
            {{ [listing.year, formatManufacturer(listing.manufacturer), listing.model].filter(Boolean).join(' ') }}
          </p>
        </div>

        <p class="text-sm text-base-content/70">
          {{ truncatedDescription }}
        </p>

        <!-- Metadata row -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/60">
          <span v-if="displayLocation" class="flex items-center gap-1">
            <template v-if="countryFlag">{{ countryFlag }}</template>
            <i v-else class="fas fa-location-dot"></i>
            {{ displayLocation }}
          </span>
          <ExchangeListingsListingShippingBadge :listing="listing" />
        </div>

        <!-- Seller Info -->
        <div
          v-if="showSellerInfo && listing.profiles"
          class="flex items-center gap-2 pt-3 mt-3 border-t border-base-300"
        >
          <ExchangeAvatar
            :avatar-url="listing.profiles.avatar_url"
            :display-name="listing.profiles.display_name"
            :username="listing.profiles.username"
            size="xs"
          />
          <span class="text-sm font-medium truncate">
            {{ listing.profiles.display_name || listing.profiles.username || t('anonymous') }}
          </span>
        </div>

        <!-- Listing Analytics (inside card for dashboard) -->
        <ExchangeDashboardListingAnalytics v-if="showAnalytics" :listing-id="listing.id" />

        <!-- Quick Actions (Mark as Sold / Delete) -->
        <div
          v-if="showQuickActions && listing.status === 'active'"
          class="flex items-center gap-2 pt-3 mt-3 border-t border-base-300"
        >
          <button
            class="btn btn-sm btn-ghost flex-1 gap-1"
            :disabled="markingSold"
            @click.prevent="$emit('mark-sold', listing)"
          >
            <span v-if="markingSold" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-circle-check text-success"></i>
            <span>{{ t('markSoldShort') }}</span>
          </button>
          <button
            class="btn btn-sm btn-ghost flex-1 gap-1 text-error"
            :disabled="deleting"
            @click.prevent="$emit('delete', listing)"
          >
            <span v-if="deleting" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-trash"></i>
            <span>{{ t('delete') }}</span>
          </button>
        </div>

        <!-- Relist Action for terminal statuses -->
        <div
          v-if="showQuickActions && ['sold', 'expired', 'cancelled'].includes(listing.status)"
          class="flex items-center gap-2 pt-3 mt-3 border-t border-base-300"
        >
          <button
            class="btn btn-sm btn-ghost flex-1 gap-1"
            :disabled="relisting"
            @click.prevent="$emit('relist', listing)"
          >
            <span v-if="relisting" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-arrows-rotate text-primary"></i>
            <span>{{ t('relist') }}</span>
          </button>
          <button
            class="btn btn-sm btn-ghost flex-1 gap-1 text-error"
            :disabled="deleting"
            @click.prevent="$emit('delete', listing)"
          >
            <span v-if="deleting" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-trash"></i>
            <span>{{ t('delete') }}</span>
          </button>
        </div>
      </div>
    </NuxtLink>
  </div>

  <!-- Horizontal Card Layout -->
  <NuxtLink
    v-else-if="variant === 'horizontal'"
    :to="listingUrl"
    class="card card-side bg-base-100 shadow-sm hover:shadow-md transition-shadow"
  >
    <figure class="w-48 sm:w-64 bg-base-300 shrink-0">
      <div class="w-full h-full">
        <img
          v-if="primaryPhoto"
          :src="primaryPhoto"
          :alt="listing.title"
          class="w-full h-full object-contain"
          style="object-fit: contain"
          loading="lazy"
        />
        <div v-else class="flex items-center justify-center w-full h-full">
          <i class="fas fa-image text-4xl text-base-content/30"></i>
        </div>
      </div>
    </figure>

    <div class="card-body">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-2">
            <h3 class="card-title font-bold mb-1 line-clamp-1 flex-1">{{ listing.title }}</h3>
            <!-- Status Badge -->
            <span v-if="showStatusBadge && listing.status" class="badge badge-sm shrink-0" :class="statusBadgeClass">
              {{ formatStatus(listing.status) }}
            </span>
            <span v-if="isExample" class="badge badge-sm badge-secondary shrink-0">{{ t('exampleListing') }}</span>
          </div>
          <!-- Vehicle subtitle: Year, Manufacturer, Model -->
          <p
            v-if="listing.listing_category === 'vehicle' && (listing.manufacturer || listing.model)"
            class="text-base-content/70 mb-2 line-clamp-1"
          >
            {{ [listing.year, formatManufacturer(listing.manufacturer), listing.model].filter(Boolean).join(' ') }}
          </p>
          <p class="text-sm text-base-content/60 line-clamp-2">{{ listing.description }}</p>

          <div class="flex flex-wrap items-center gap-3 mt-3 text-sm text-base-content/60">
            <div v-if="displayLocation" class="flex items-center gap-1">
              <template v-if="countryFlag">{{ countryFlag }}</template>
              <i v-else class="fas fa-location-dot"></i>
              <span>{{ displayLocation }}</span>
            </div>
            <ExchangeListingsListingShippingBadge :listing="listing" />
          </div>
        </div>

        <!-- Price Section -->
        <div class="text-right shrink-0">
          <!-- Sold Price Display -->
          <template v-if="isSold">
            <div v-if="soldPrice !== 0" class="text-sm text-base-content/70">{{ t('soldFor') }}</div>
            <div class="text-2xl font-bold text-success">
              {{ formatListingPrice(soldPrice, formatCurrency(soldPrice, listingCurrency)) }}
            </div>
            <div v-if="convertedPrice && soldPrice !== 0" class="text-xs text-base-content/60">
              {{ t('about', { amount: formatCurrency(convertedPrice, viewerCurrency) }) }}
            </div>
          </template>
          <!-- Active Listing Price Display -->
          <template v-else>
            <div class="text-2xl font-bold" :class="listing.price === 0 ? 'text-success' : 'text-primary'">
              {{ formatListingPrice(listing.price, formatCurrency(listing.price, listingCurrency)) }}
            </div>
            <div v-if="convertedPrice && listing.price !== 0" class="text-xs text-base-content/60">
              {{ t('about', { amount: formatCurrency(convertedPrice, viewerCurrency) }) }}
            </div>
          </template>
        </div>
      </div>
    </div>
  </NuxtLink>

  <!-- Compact Horizontal Card Layout (for profile pages) -->
  <NuxtLink
    v-else
    :to="listingUrl"
    class="card card-side bg-base-200/50 hover:bg-base-200 shadow-sm hover:shadow-md transition-all"
  >
    <figure class="w-32 sm:w-40 bg-base-300 shrink-0">
      <div class="w-full h-full">
        <img
          v-if="primaryPhoto"
          :src="primaryPhoto"
          :alt="listing.title"
          class="w-full h-full object-contain"
          style="object-fit: contain"
          loading="lazy"
        />
        <div v-else class="flex items-center justify-center w-full h-full">
          <i class="fas fa-image text-2xl text-base-content/30"></i>
        </div>
      </div>
    </figure>

    <div class="card-body p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-sm sm:text-base line-clamp-1 mb-1">{{ listing.title }}</h3>
          <!-- Vehicle subtitle -->
          <p
            v-if="listing.listing_category === 'vehicle' && (listing.year || listing.model)"
            class="text-xs sm:text-sm text-base-content/70 mb-2"
          >
            {{ [listing.year, formatManufacturer(listing.manufacturer), listing.model].filter(Boolean).join(' ') }}
          </p>

          <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
            <div v-if="displayLocation" class="flex items-center gap-1">
              <template v-if="countryFlag">{{ countryFlag }}</template>
              <i v-else class="fas fa-location-dot"></i>
              <span>{{ displayLocation }}</span>
            </div>
            <ExchangeListingsListingShippingBadge :listing="listing" />
            <span v-if="showStatusBadge && listing.status" class="badge badge-sm" :class="statusBadgeClass">
              {{ formatStatus(listing.status) }}
            </span>
            <span v-if="isExample" class="badge badge-sm badge-secondary">{{ t('exampleListing') }}</span>
          </div>
        </div>

        <div class="text-right shrink-0">
          <!-- Sold Price Display -->
          <template v-if="isSold">
            <div v-if="soldPrice !== 0" class="text-xs text-base-content/70">{{ t('soldLabel') }}</div>
            <div class="text-sm sm:text-lg font-bold text-success">
              {{ formatListingPrice(soldPrice, formatCurrency(soldPrice, listingCurrency)) }}
            </div>
            <div v-if="convertedPrice && soldPrice !== 0" class="text-xs text-base-content/60">
              {{ t('about', { amount: formatCurrency(convertedPrice, viewerCurrency) }) }}
            </div>
          </template>
          <!-- Active Listing Price Display -->
          <template v-else>
            <div class="text-sm sm:text-lg font-bold" :class="listing.price === 0 ? 'text-success' : 'text-primary'">
              {{ formatListingPrice(listing.price, formatCurrency(listing.price, listingCurrency)) }}
            </div>
            <div v-if="convertedPrice && listing.price !== 0" class="text-xs text-base-content/60">
              {{ t('about', { amount: formatCurrency(convertedPrice, viewerCurrency) }) }}
            </div>
          </template>
          <!-- Quick Actions for compact variant -->
          <div v-if="showQuickActions && listing.status === 'active'" class="flex justify-end gap-1 mt-2">
            <button
              class="btn btn-xs btn-ghost btn-square"
              :disabled="markingSold"
              :title="t('markSold')"
              :aria-label="t('markSold')"
              @click.prevent="$emit('mark-sold', listing)"
            >
              <span v-if="markingSold" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-circle-check text-success"></i>
            </button>
            <button
              class="btn btn-xs btn-ghost btn-square text-error"
              :disabled="deleting"
              :title="t('delete')"
              :aria-label="t('deleteListing')"
              @click.prevent="$emit('delete', listing)"
            >
              <span v-if="deleting" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-trash"></i>
            </button>
          </div>
          <!-- Relist Action for compact variant -->
          <div
            v-if="showQuickActions && ['sold', 'expired', 'cancelled'].includes(listing.status)"
            class="flex justify-end gap-1 mt-2"
          >
            <button
              class="btn btn-xs btn-ghost btn-square"
              :disabled="relisting"
              :title="t('relist')"
              :aria-label="t('relistListing')"
              @click.prevent="$emit('relist', listing)"
            >
              <span v-if="relisting" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-arrows-rotate text-primary"></i>
            </button>
            <button
              class="btn btn-xs btn-ghost btn-square text-error"
              :disabled="deleting"
              :title="t('delete')"
              :aria-label="t('deleteListing')"
              @click.prevent="$emit('delete', listing)"
            >
              <span v-if="deleting" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import type { CurrencyCode } from '~/composables/useCurrency';
  import { isExampleStatus } from '~/composables/useExampleListings';
  import { getCountryFlag } from '~/utils/countryFlags';

  const { t } = useI18n();

  interface Props {
    listing: ListingWithPhotos;
    variant?: 'card' | 'horizontal' | 'compact';
    showSellerInfo?: boolean;
    showStatusBadge?: boolean;
    showRemoveButton?: boolean;
    removeLoading?: boolean;
    showQuickActions?: boolean;
    showAnalytics?: boolean;
    markingSold?: boolean;
    deleting?: boolean;
    relisting?: boolean;
    /**
     * Optional override for viewer currency. When omitted, the global
     * `useCurrency().userCurrency` is used — which is how the floating
     * currency chip and profile preference propagate app-wide.
     */
    userCurrency?: CurrencyCode;
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'card',
    showSellerInfo: true,
    showStatusBadge: false,
    showRemoveButton: false,
    removeLoading: false,
    showQuickActions: false,
    showAnalytics: false,
    markingSold: false,
    deleting: false,
    relisting: false,
    userCurrency: undefined,
  });

  defineEmits<{
    remove: [listing: ListingWithPhotos];
    'mark-sold': [listing: ListingWithPhotos];
    delete: [listing: ListingWithPhotos];
    relist: [listing: ListingWithPhotos];
  }>();

  const { getPhotoUrl } = useListings();
  const { formatStatus, formatManufacturer, formatListingPrice } = useFormatters();
  const {
    formatCurrency,
    convertCurrency,
    fetchExchangeRates,
    exchangeRates,
    userCurrency: globalUserCurrency,
  } = useCurrency();

  // Resolve the viewer currency: prop override if provided, otherwise the
  // app-wide preference from `useCurrency()` (driven by profile/localStorage).
  const viewerCurrency = computed<CurrencyCode>(() => props.userCurrency ?? globalUserCurrency.value);

  // Compute the correct link URL - drafts go to wizard, others go to detail page
  const listingUrl = computed(() => {
    if (props.listing.status === 'draft') {
      return `/exchange/listings/new?draft=${props.listing.id}`;
    }
    return `/exchange/listings/${props.listing.slug}`;
  });

  // Fetch exchange rates on mount (cached, so this is cheap)
  onMounted(() => {
    fetchExchangeRates();
  });

  // Get the listing's currency (default to USD for older listings)
  const listingCurrency = computed(() => (props.listing.currency as CurrencyCode) || 'USD');

  // Check if listing is sold
  const isSold = computed(() => props.listing.status === 'sold');

  // Get the sold/final price for sold listings
  const soldPrice = computed(() => {
    if (!isSold.value) return null;
    // Use final_price if available, otherwise fall back to price
    const finalPrice = props.listing.final_price;
    if (finalPrice) return finalPrice;
    return props.listing.price;
  });

  // Get the display price (sold price for sold listings, regular price otherwise)
  const displayPrice = computed(() => {
    if (isSold.value && soldPrice.value) return soldPrice.value;
    return props.listing.price;
  });

  // Compute converted price if currencies differ
  const convertedPrice = computed(() => {
    if (!exchangeRates.value) return null;
    if (listingCurrency.value === viewerCurrency.value) return null;

    const price = displayPrice.value;
    if (!price) return null;

    return convertCurrency(price, listingCurrency.value, viewerCurrency.value);
  });

  // Format display location from city/state or fallback to location field
  const displayLocation = computed(() => {
    if (props.listing.city && props.listing.state_province) {
      return `${props.listing.city}, ${props.listing.state_province}`;
    }
    return props.listing.location;
  });

  // Country flag emoji (empty string if no match)
  const countryFlag = computed(() => getCountryFlag(props.listing.country));

  // Truncate description to ~100 characters for card view
  const truncatedDescription = computed(() => {
    const desc = props.listing.description || '';
    const limit = 100;
    if (desc.length <= limit) return desc;
    // Find last space before limit to avoid cutting mid-word
    const truncated = desc.substring(0, limit);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
  });

  // Get primary photo or first photo
  const primaryPhoto = computed(() => {
    const photos = props.listing.listing_photos;
    if (!photos || photos.length === 0) return null;

    const primary = photos.find((p) => p.is_primary);
    const firstPhoto = primary || photos[0];

    return firstPhoto ? getPhotoUrl(firstPhoto.storage_path) : null;
  });

  // Check if listing is an example listing
  const isExample = computed(() => isExampleStatus(props.listing.status));

  // Check if listing is currently featured (paid tier with active featured_until)
  const isFeatured = computed(() => {
    if (props.listing.tier !== 'paid') return false;
    if (!props.listing.featured_until) return false;
    return new Date(props.listing.featured_until) > new Date();
  });

  // Status badge styling
  const statusBadgeClass = computed(() => {
    switch (props.listing.status) {
      case 'active':
        return 'badge-success';
      case 'draft':
        return 'badge-warning';
      case 'sold':
        return 'badge-info';
      case 'expired':
        return 'badge-error';
      case 'cancelled':
        return 'badge-ghost';
      case 'example_free':
        return 'badge-secondary';
      case 'example_paid':
        return 'badge-secondary';
      default:
        return 'badge-ghost';
    }
  });
</script>

<i18n lang="json">
{
  "en": { "exampleListing": "Example Listing", "soldSuffix": "sold", "soldFor": "Sold for", "soldLabel": "Sold", "aboutInCurrency": "About {amount} in {currency}", "about": "About {amount}", "markSoldShort": "Sold", "markSold": "Mark as Sold", "delete": "Delete", "deleteListing": "Delete listing", "relist": "Relist", "relistListing": "Relist listing", "anonymous": "Anonymous" },
  "es": { "exampleListing": "Anuncio de ejemplo", "soldSuffix": "vendido", "soldFor": "Vendido por", "soldLabel": "Vendido", "aboutInCurrency": "Aproximadamente {amount} en {currency}", "about": "Aproximadamente {amount}", "markSoldShort": "Vendido", "markSold": "Marcar como vendido", "delete": "Eliminar", "deleteListing": "Eliminar anuncio", "relist": "Volver a publicar", "relistListing": "Volver a publicar anuncio", "anonymous": "Anónimo" },
  "fr": { "exampleListing": "Annonce exemple", "soldSuffix": "vendu", "soldFor": "Vendu pour", "soldLabel": "Vendu", "aboutInCurrency": "Environ {amount} en {currency}", "about": "Environ {amount}", "markSoldShort": "Vendu", "markSold": "Marquer comme vendu", "delete": "Supprimer", "deleteListing": "Supprimer l'annonce", "relist": "Republier", "relistListing": "Republier l'annonce", "anonymous": "Anonyme" },
  "de": { "exampleListing": "Beispielanzeige", "soldSuffix": "verkauft", "soldFor": "Verkauft für", "soldLabel": "Verkauft", "aboutInCurrency": "Etwa {amount} in {currency}", "about": "Etwa {amount}", "markSoldShort": "Verkauft", "markSold": "Als verkauft markieren", "delete": "Löschen", "deleteListing": "Anzeige löschen", "relist": "Erneut einstellen", "relistListing": "Anzeige erneut einstellen", "anonymous": "Anonym" },
  "it": { "exampleListing": "Annuncio di esempio", "soldSuffix": "venduto", "soldFor": "Venduto a", "soldLabel": "Venduto", "aboutInCurrency": "Circa {amount} in {currency}", "about": "Circa {amount}", "markSoldShort": "Venduto", "markSold": "Segna come venduto", "delete": "Elimina", "deleteListing": "Elimina annuncio", "relist": "Ripubblica", "relistListing": "Ripubblica annuncio", "anonymous": "Anonimo" },
  "pt": { "exampleListing": "Anúncio de exemplo", "soldSuffix": "vendido", "soldFor": "Vendido por", "soldLabel": "Vendido", "aboutInCurrency": "Cerca de {amount} em {currency}", "about": "Cerca de {amount}", "markSoldShort": "Vendido", "markSold": "Marcar como vendido", "delete": "Excluir", "deleteListing": "Excluir anúncio", "relist": "Republicar", "relistListing": "Republicar anúncio", "anonymous": "Anônimo" },
  "ru": { "exampleListing": "Пример объявления", "soldSuffix": "продано", "soldFor": "Продано за", "soldLabel": "Продано", "aboutInCurrency": "Около {amount} в {currency}", "about": "Около {amount}", "markSoldShort": "Продано", "markSold": "Отметить как проданное", "delete": "Удалить", "deleteListing": "Удалить объявление", "relist": "Опубликовать снова", "relistListing": "Опубликовать объявление снова", "anonymous": "Аноним" },
  "ja": { "exampleListing": "サンプル出品", "soldSuffix": "売却済み", "soldFor": "販売価格", "soldLabel": "売却済み", "aboutInCurrency": "約 {amount}（{currency}）", "about": "約 {amount}", "markSoldShort": "売却済み", "markSold": "売却済みにする", "delete": "削除", "deleteListing": "出品を削除", "relist": "再出品", "relistListing": "出品を再出品", "anonymous": "匿名" },
  "zh": { "exampleListing": "示例刊登", "soldSuffix": "已售", "soldFor": "售出价", "soldLabel": "已售", "aboutInCurrency": "约 {amount}（{currency}）", "about": "约 {amount}", "markSoldShort": "已售", "markSold": "标记为已售", "delete": "删除", "deleteListing": "删除刊登", "relist": "重新刊登", "relistListing": "重新刊登", "anonymous": "匿名" },
  "ko": { "exampleListing": "예시 매물", "soldSuffix": "판매됨", "soldFor": "판매가", "soldLabel": "판매됨", "aboutInCurrency": "약 {amount} ({currency})", "about": "약 {amount}", "markSoldShort": "판매됨", "markSold": "판매됨으로 표시", "delete": "삭제", "deleteListing": "매물 삭제", "relist": "다시 등록", "relistListing": "매물 다시 등록", "anonymous": "익명" }
}
</i18n>
