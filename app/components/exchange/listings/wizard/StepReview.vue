<template>
  <div class="-mx-4 sm:-mx-6 lg:-mx-8">
    <!-- Preview Banner -->
    <div class="bg-warning/20 border-b border-warning/30 px-4 py-3">
      <div class="container flex items-center justify-center gap-2 text-warning-content">
        <i class="fas fa-eye"></i>
        <span class="font-medium">{{ t('preview.mode') }}</span>
        <span class="text-sm opacity-80">{{ t('preview.subtitle') }}</span>
      </div>
    </div>

    <!-- Image Gallery -->
    <section class="bg-base-200">
      <div class="container">
        <div class="py-8 sm:py-12">
          <!-- Category Tabs (Vehicle listings only) -->
          <div v-if="totalPhotos > 0 && formData.category === 'vehicle'" class="mb-6">
            <div class="tabs tabs-box">
              <button @click="currentCategory = 'all'" class="tab" :class="{ 'tab-active': currentCategory === 'all' }">
                {{ t('tabs.all', { count: totalPhotos }) }}
              </button>
              <button
                v-if="photos.body.length > 0"
                @click="currentCategory = 'body'"
                class="tab"
                :class="{ 'tab-active': currentCategory === 'body' }"
              >
                <i class="fas fa-image mr-1"></i>
                {{ t('tabs.body', { count: photos.body.length }) }}
              </button>
              <button
                v-if="photos.engine.length > 0"
                @click="currentCategory = 'engine'"
                class="tab"
                :class="{ 'tab-active': currentCategory === 'engine' }"
              >
                <i class="fas fa-gear mr-1"></i>
                {{ t('tabs.engine', { count: photos.engine.length }) }}
              </button>
              <button
                v-if="photos.interior.length > 0"
                @click="currentCategory = 'interior'"
                class="tab"
                :class="{ 'tab-active': currentCategory === 'interior' }"
              >
                <i class="fas fa-table-cells-large mr-1"></i>
                {{ t('tabs.interior', { count: photos.interior.length }) }}
              </button>
              <button
                v-if="photos.details.length > 0"
                @click="currentCategory = 'details'"
                class="tab"
                :class="{ 'tab-active': currentCategory === 'details' }"
              >
                <i class="fas fa-wand-magic-sparkles mr-1"></i>
                {{ t('tabs.details', { count: photos.details.length }) }}
              </button>
            </div>
          </div>

          <!-- Single Photo - Centered and Large -->
          <div v-if="currentPhotos.length === 1" class="flex justify-center">
            <div class="relative max-w-3xl w-full aspect-4/3 rounded-lg overflow-hidden border-2 border-base-300">
              <img
                :src="currentPhotos[0].preview"
                :alt="formData.title"
                class="w-full h-full object-contain"
                style="object-fit: contain"
                loading="lazy"
              />
              <span class="absolute top-2 left-2 badge badge-primary badge-sm gap-1">
                <i class="fas fa-star text-xs"></i>
                {{ t('photos.primary') }}
              </span>
            </div>
          </div>

          <!-- Multiple Photos - Gallery Grid -->
          <div
            v-else-if="currentPhotos.length > 1"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <div
              v-for="(photo, index) in currentPhotos"
              :key="index"
              class="relative aspect-4/3 rounded-lg overflow-hidden border-2 border-base-300"
            >
              <img
                :src="photo.preview"
                :alt="`${formData.title} - ${t('photos.photoN', { n: index + 1 })}`"
                class="w-full h-full object-contain"
                style="object-fit: contain"
                loading="lazy"
              />
              <span v-if="index === 0" class="absolute top-2 left-2 badge badge-primary badge-sm gap-1">
                <i class="fas fa-star text-xs"></i>
                {{ t('photos.primary') }}
              </span>
            </div>
          </div>

          <!-- No Photos State -->
          <div
            v-else
            class="h-64 bg-base-100 rounded-lg border-2 border-dashed border-base-300 flex items-center justify-center"
          >
            <div class="text-center">
              <i class="fas fa-image text-6xl mx-auto mb-2 text-base-content/30"></i>
              <p class="text-base-content/60">{{ t('photos.none') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Listing Details -->
    <section class="py-8 sm:py-12">
      <div class="container">
        <!-- Grid Layout: Content and Sidebar -->
        <div class="grid lg:grid-cols-3 gap-8">
          <!-- Main Content -->
          <div class="lg:col-span-2 space-y-8 order-2 lg:order-1">
            <!-- Header -->
            <div>
              <div class="mb-4">
                <h1 class="text-3xl sm:text-4xl font-bold mb-2">{{ formData.title || t('header.untitled') }}</h1>
                <div class="flex items-center gap-4 text-base-content/70 flex-wrap">
                  <!-- Year (vehicles and engines only) -->
                  <div v-if="formData.year && formData.category !== 'parts'" class="flex items-center gap-1">
                    <i class="fas fa-calendar text-lg"></i>
                    <span>{{ formData.year }}</span>
                  </div>
                  <!-- Category badge -->
                  <div class="flex items-center gap-1">
                    <i
                      class="text-lg"
                      :class="
                        formData.category === 'vehicle'
                          ? 'fas fa-truck'
                          : formData.category === 'engine'
                            ? 'fas fa-gear'
                            : 'fas fa-screwdriver-wrench'
                      "
                    ></i>
                    <span class="capitalize">{{ formData.category }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <template v-if="getCountryFlag(location.country)">{{ getCountryFlag(location.country) }}</template>
                    <i v-else class="fas fa-location-dot text-lg"></i>
                    <span>{{ reviewLocation }}</span>
                  </div>
                  <div class="flex items-center gap-1 opacity-50">
                    <i class="fas fa-eye text-lg"></i>
                    <span>{{ t('header.views', { count: 0 }) }}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                <!-- Vehicle condition -->
                <span
                  v-if="formData.category === 'vehicle' && formData.condition"
                  class="badge"
                  :class="getConditionBadgeClass(formData.condition)"
                >
                  {{ formatCondition(formData.condition) }}
                </span>
                <!-- Parts condition -->
                <span v-else-if="formData.partCondition" class="badge badge-info">
                  {{ formatPartCondition(formData.partCondition) }}
                </span>
                <!-- Manufacturer (vehicles only) -->
                <span v-if="formData.manufacturer && formData.category === 'vehicle'" class="badge badge-ghost">
                  {{ formatManufacturer(formData.manufacturer) }}
                </span>
                <!-- Model -->
                <span v-if="formData.model" class="badge badge-ghost">
                  {{ formData.model }}
                </span>
                <!-- Engine size -->
                <span v-if="formData.engineSize" class="badge badge-ghost">
                  {{ formData.engineSize }}
                </span>
                <!-- Parts subcategory -->
                <span v-if="formData.parts_subcategory" class="badge badge-ghost">
                  {{ formatPartsSubcategory(formData.parts_subcategory) }}
                </span>
              </div>
            </div>

            <!-- Description -->
            <div>
              <h2 class="text-2xl font-semibold mb-4">{{ t('sections.description') }}</h2>
              <p class="text-base-content/80 whitespace-pre-wrap">
                {{ formData.description || t('sections.noDescription') }}
              </p>
            </div>

            <!-- Specifications -->
            <div v-if="hasSpecs">
              <h2 class="text-2xl font-semibold mb-4">{{ t('sections.specifications') }}</h2>
              <div class="grid sm:grid-cols-2 gap-4">
                <!-- Vehicle-specific specs -->
                <template v-if="formData.category === 'vehicle'">
                  <div v-if="formData.mileage !== null" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-chart-column text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.mileage') }}</div>
                      <div class="font-medium">{{ t('specs.mileageValue', { miles: formData.mileage?.toLocaleString() }) }}</div>
                    </div>
                  </div>

                  <div v-if="formData.engineSize" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-gear text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.engineSize') }}</div>
                      <div class="font-medium">{{ formData.engineSize }}</div>
                    </div>
                  </div>

                  <div v-if="formData.gearboxType" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-arrows-rotate text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.gearbox') }}</div>
                      <div class="font-medium">{{ formatGearbox(formData.gearboxType) }}</div>
                    </div>
                  </div>

                  <div v-if="formData.color" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-paintbrush text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.color') }}</div>
                      <div class="font-medium">{{ formData.color }}</div>
                    </div>
                  </div>
                </template>

                <!-- Parts-specific specs -->
                <template v-else-if="formData.category === 'parts'">
                  <div v-if="formData.partCondition" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-shield-halved text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.condition') }}</div>
                      <div class="font-medium">{{ formatPartCondition(formData.partCondition) }}</div>
                    </div>
                  </div>

                  <div v-if="formData.partNumber" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-hashtag text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.partNumber') }}</div>
                      <div class="font-medium">{{ formData.partNumber }}</div>
                    </div>
                  </div>

                  <div v-if="formData.oemOrAftermarket" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-screwdriver-wrench text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.type') }}</div>
                      <div class="font-medium">{{ formatOemType(formData.oemOrAftermarket) }}</div>
                    </div>
                  </div>

                  <div v-if="formData.quantityAvailable > 1" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                    <i class="fas fa-cube text-lg text-base-content/60"></i>
                    <div>
                      <div class="text-sm text-base-content/60">{{ t('specs.quantityAvailable') }}</div>
                      <div class="font-medium">{{ formData.quantityAvailable }}</div>
                    </div>
                  </div>

                  <div v-if="formData.shippingAvailable !== undefined" class="md:col-span-2 space-y-3">
                    <div class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-truck text-lg text-base-content/60"></i>
                      <div class="flex-1">
                        <div class="text-sm text-base-content/60">{{ t('specs.shipping') }}</div>
                        <div class="font-medium">
                          {{ formData.shippingAvailable ? t('specs.shippingAvailable') : t('specs.pickupOnly') }}
                        </div>
                      </div>
                    </div>

                    <template v-if="formData.shippingAvailable">
                      <div class="px-4">
                        <div v-if="formData.shipsTo" class="text-sm">
                          <span class="text-base-content/60">{{ t('specs.shipsTo') }}</span>
                          <span class="font-medium ml-1">{{ formatShipsTo(formData.shipsTo) }}</span>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </div>

            <!-- Heritage Section (Vehicle only) -->
            <div v-if="formData.category === 'vehicle' && hasHeritage" class="space-y-4">
              <h2 class="text-2xl font-semibold">{{ t('heritage.section') }}</h2>
              <div class="grid sm:grid-cols-2 gap-4">
                <div v-if="formData.vinNumber" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                  <i class="fas fa-id-card text-lg text-base-content/60"></i>
                  <div>
                    <div class="text-sm text-base-content/60">{{ t('heritage.vin') }}</div>
                    <div class="font-medium font-mono">{{ formData.vinNumber }}</div>
                  </div>
                </div>
                <div v-if="formData.engineNumber" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                  <i class="fas fa-gear text-lg text-base-content/60"></i>
                  <div>
                    <div class="text-sm text-base-content/60">{{ t('heritage.engineNumber') }}</div>
                    <div class="font-medium font-mono">{{ formData.engineNumber }}</div>
                  </div>
                </div>
                <div v-if="formData.originalColor" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                  <i class="fas fa-paintbrush text-lg text-base-content/60"></i>
                  <div>
                    <div class="text-sm text-base-content/60">{{ t('heritage.originalColor') }}</div>
                    <div class="font-medium">{{ formData.originalColor }}</div>
                  </div>
                </div>
                <div
                  v-if="formData.previousOwnersCount !== null"
                  class="flex items-center gap-3 p-4 bg-base-200 rounded-lg"
                >
                  <i class="fas fa-users text-lg text-base-content/60"></i>
                  <div>
                    <div class="text-sm text-base-content/60">{{ t('heritage.previousOwners') }}</div>
                    <div class="font-medium">{{ formData.previousOwnersCount }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Comments Placeholder -->
            <div class="opacity-50">
              <h2 class="text-2xl font-semibold mb-4">{{ t('qa.section') }}</h2>
              <div class="p-8 bg-base-200 rounded-lg text-center text-base-content/60">
                <i class="fas fa-comments text-5xl mx-auto mb-2 opacity-30"></i>
                <p>{{ t('qa.placeholder') }}</p>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="lg:col-span-1 order-1 lg:order-2">
            <div class="lg:sticky lg:top-20">
              <div class="card bg-base-100 shadow-sm border border-base-300">
                <div class="card-body">
                  <!-- Price -->
                  <div class="mb-6">
                    <div v-if="formData.price !== 0" class="text-sm text-base-content/60 mb-1">{{ t('sidebar.askingPrice') }}</div>
                    <div class="text-4xl font-bold" :class="formData.price === 0 ? 'text-success' : 'text-primary'">
                      {{ formatPrice(formData.price, formData.currency) }}
                    </div>
                  </div>

                  <!-- Heritage Certificate Badge -->
                  <div
                    v-if="formData.category === 'vehicle' && formData.hasHeritageCert"
                    class="mb-6 pb-6 border-b border-base-300"
                  >
                    <div class="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                      <i class="fas fa-circle-check text-2xl text-primary shrink-0"></i>
                      <div>
                        <div class="font-semibold text-primary">{{ t('sidebar.heritageCertified') }}</div>
                        <div v-if="formData.heritageCertNumber" class="text-xs text-base-content/70 font-mono">
                          #{{ formData.heritageCertNumber }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Tier Badge -->
                  <div v-if="formData.tier === 'paid'" class="mb-6 pb-6 border-b border-base-300">
                    <div class="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                      <i class="far fa-star text-2xl text-primary shrink-0"></i>
                      <div>
                        <div class="font-semibold text-primary">{{ t('sidebar.premiumListing') }}</div>
                        <div class="text-xs text-base-content/70">{{ t('sidebar.featuredDays') }}</div>
                      </div>
                    </div>
                  </div>

                  <!-- Contact Button (disabled in preview) -->
                  <button class="btn btn-primary btn-block mb-3" disabled>
                    <i class="fas fa-comments"></i>
                    {{ t('sidebar.contactSeller') }}
                  </button>

                  <!-- Watchlist Button (disabled in preview) -->
                  <button class="btn btn-outline btn-block" disabled>
                    <i class="fas fa-heart"></i>
                    {{ t('sidebar.saveToWatchlist') }}
                  </button>

                  <p class="text-xs text-center text-base-content/50 mt-4">{{ t('sidebar.buttonsDisabled') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Submit Section (sticky bottom) -->
    <div class="sticky bottom-0 bg-base-100 border-t border-base-300 px-4 py-4 shadow-lg">
      <div class="container">
        <div class="flex justify-between items-center gap-4">
          <button type="button" class="btn btn-ghost" @click="$emit('back')">
            <i class="fas fa-arrow-left"></i>
            {{ t('submit.backToEdit') }}
          </button>
          <div class="flex items-center gap-3">
            <span
              v-if="formData.tier === 'paid' && !isSustainingMember"
              class="text-sm text-base-content/70 hidden sm:block"
            >
              {{ t('submit.paymentNotice') }}
            </span>
            <button type="button" class="btn btn-primary btn-lg" :disabled="submitting" @click="$emit('next')">
              <span v-if="submitting" class="loading loading-spinner"></span>
              <template v-else>
                <i class="fas fa-paper-plane"></i>
                {{ formData.tier === 'paid' && !isSustainingMember ? t('submit.submitAndPay') : t('submit.submitListing') }}
              </template>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { CurrencyCode } from '~/composables/useCurrency';
  import type { OptimizeResult } from '~/utils/imageOptimizer';
  import { getCountryFlag } from '~/utils/countryFlags';
  import { formatShipsTo } from '~/utils/shippingCarriers';

  const { t } = useI18n();

  const props = defineProps<{
    formData: any;
    photos: {
      body: OptimizeResult[];
      engine: OptimizeResult[];
      interior: OptimizeResult[];
      details: OptimizeResult[];
    };
    location: any;
    submitting: boolean;
    isSustainingMember?: boolean;
  }>();

  defineEmits<{
    next: [];
    back: [];
  }>();

  const { formatCurrency } = useCurrency();

  const reviewLocation = computed(() => {
    const parts: string[] = [];
    if (props.location.city) parts.push(props.location.city);
    if (props.location.state_province) parts.push(props.location.state_province);
    if (props.location.country && props.location.country !== 'United States') {
      parts.push(props.location.country);
    }
    return parts.length > 0 ? parts.join(', ') : t('header.locationNotSet');
  });

  // Photo category switching
  const currentCategory = ref<'all' | 'body' | 'engine' | 'interior' | 'details'>('all');

  const allPhotos = computed(() => [
    ...props.photos.body,
    ...props.photos.engine,
    ...props.photos.interior,
    ...props.photos.details,
  ]);

  const currentPhotos = computed(() => {
    if (currentCategory.value === 'all') return allPhotos.value;
    return props.photos[currentCategory.value] || [];
  });

  const totalPhotos = computed(() => allPhotos.value.length);

  const hasSpecs = computed(() => {
    if (props.formData.category === 'vehicle') {
      return props.formData.mileage || props.formData.color || props.formData.engineSize || props.formData.gearboxType;
    }
    if (props.formData.category === 'parts') {
      return props.formData.partCondition || props.formData.partNumber || props.formData.oemOrAftermarket;
    }
    return false;
  });

  const hasHeritage = computed(() => {
    return (
      props.formData.vinNumber ||
      props.formData.engineNumber ||
      props.formData.originalColor ||
      props.formData.previousOwnersCount !== null
    );
  });

  const { formatManufacturer } = useFormatters();

  const formatPrice = (price: number | null, currency: CurrencyCode) => {
    if (price === 0 || price === null || price === undefined) return t('sidebar.free');
    return formatCurrency(price, currency);
  };

  const getConditionBadgeClass = (condition: string) => {
    switch (condition) {
      case 'excellent':
        return 'badge-success';
      case 'good':
        return 'badge-info';
      case 'fair':
        return 'badge-warning';
      case 'project':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  };

  const formatCondition = (condition: string) => {
    const labels: Record<string, string> = {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      project: 'Project',
    };
    return labels[condition] || condition;
  };

  const formatPartCondition = (condition: string) => {
    const labels: Record<string, string> = {
      new: 'New',
      used_excellent: 'Used - Excellent',
      used_good: 'Used - Good',
      used_fair: 'Used - Fair',
      for_parts: 'For Parts',
    };
    return labels[condition] || condition;
  };

  const formatGearbox = (type: string) => {
    const labels: Record<string, string> = {
      '3-synchro': '3-Synchro',
      '4-synchro': '4-Synchro',
      'rod-change': 'Rod Change',
      'magic-wand': 'Magic Wand',
      automatic: 'Automatic',
    };
    return labels[type] || type;
  };

  const formatOemType = (type: string) => {
    const labels: Record<string, string> = {
      oem: 'OEM / Genuine',
      aftermarket: 'Aftermarket',
      reproduction: 'Reproduction',
    };
    return labels[type] || type;
  };

  const formatPartsSubcategory = (subcategory: string) => {
    return subcategory
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
</script>

<i18n lang="json">
{
  "en": {
    "preview": { "mode": "Preview Mode", "subtitle": "- This is how your listing will appear to buyers" },
    "tabs": { "all": "All ({count})", "body": "Body ({count})", "engine": "Engine ({count})", "interior": "Interior ({count})", "details": "Details ({count})" },
    "photos": { "primary": "Primary", "photoN": "Photo {n}", "none": "No photos added" },
    "header": { "untitled": "Untitled Listing", "views": "{count} views", "locationNotSet": "Location not set" },
    "sections": { "description": "Description", "noDescription": "No description provided", "specifications": "Specifications" },
    "specs": { "mileage": "Mileage", "mileageValue": "{miles} miles", "engineSize": "Engine Size", "gearbox": "Gearbox", "color": "Color", "condition": "Condition", "partNumber": "Part Number", "type": "Type", "quantityAvailable": "Quantity Available", "shipping": "Shipping", "shippingAvailable": "Available", "pickupOnly": "Pickup Only", "shipsTo": "Ships to:" },
    "heritage": { "section": "Heritage & Provenance", "vin": "VIN / Chassis", "engineNumber": "Engine Number", "originalColor": "Original Color", "previousOwners": "Previous Owners" },
    "qa": { "section": "Questions & Answers", "placeholder": "Comments will appear here after your listing is published" },
    "sidebar": { "askingPrice": "Asking Price", "free": "Free", "heritageCertified": "Heritage Certified", "premiumListing": "Premium Listing", "featuredDays": "Featured for 30 days", "contactSeller": "Contact Seller", "saveToWatchlist": "Save to Watchlist", "buttonsDisabled": "Buttons disabled in preview mode" },
    "submit": { "backToEdit": "Back to Edit", "paymentNotice": "Payment of $10 via Stripe after submit", "submitAndPay": "Submit & Pay", "submitListing": "Submit Listing" }
  },
  "es": {
    "preview": { "mode": "Modo de vista previa", "subtitle": "- Así es como verán tu anuncio los compradores" },
    "tabs": { "all": "Todas ({count})", "body": "Carrocería ({count})", "engine": "Motor ({count})", "interior": "Interior ({count})", "details": "Detalles ({count})" },
    "photos": { "primary": "Principal", "photoN": "Foto {n}", "none": "No se han añadido fotos" },
    "header": { "untitled": "Anuncio sin título", "views": "{count} vistas", "locationNotSet": "Ubicación no establecida" },
    "sections": { "description": "Descripción", "noDescription": "No se proporcionó descripción", "specifications": "Especificaciones" },
    "specs": { "mileage": "Kilometraje", "mileageValue": "{miles} millas", "engineSize": "Cilindrada", "gearbox": "Caja de cambios", "color": "Color", "condition": "Estado", "partNumber": "Número de pieza", "type": "Tipo", "quantityAvailable": "Cantidad disponible", "shipping": "Envío", "shippingAvailable": "Disponible", "pickupOnly": "Solo recogida", "shipsTo": "Envía a:" },
    "heritage": { "section": "Historia y procedencia", "vin": "VIN / Bastidor", "engineNumber": "Número de motor", "originalColor": "Color original", "previousOwners": "Propietarios anteriores" },
    "qa": { "section": "Preguntas y respuestas", "placeholder": "Los comentarios aparecerán aquí después de publicar tu anuncio" },
    "sidebar": { "askingPrice": "Precio solicitado", "free": "Gratis", "heritageCertified": "Certificado de procedencia", "premiumListing": "Anuncio premium", "featuredDays": "Destacado durante 30 días", "contactSeller": "Contactar al vendedor", "saveToWatchlist": "Guardar en seguimiento", "buttonsDisabled": "Botones desactivados en modo vista previa" },
    "submit": { "backToEdit": "Volver a editar", "paymentNotice": "Pago de 10 $ mediante Stripe tras enviar", "submitAndPay": "Enviar y pagar", "submitListing": "Publicar anuncio" }
  },
  "fr": {
    "preview": { "mode": "Mode aperçu", "subtitle": "- Voici comment votre annonce apparaîtra aux acheteurs" },
    "tabs": { "all": "Toutes ({count})", "body": "Carrosserie ({count})", "engine": "Moteur ({count})", "interior": "Intérieur ({count})", "details": "Détails ({count})" },
    "photos": { "primary": "Principale", "photoN": "Photo {n}", "none": "Aucune photo ajoutée" },
    "header": { "untitled": "Annonce sans titre", "views": "{count} vues", "locationNotSet": "Lieu non défini" },
    "sections": { "description": "Description", "noDescription": "Aucune description fournie", "specifications": "Spécifications" },
    "specs": { "mileage": "Kilométrage", "mileageValue": "{miles} miles", "engineSize": "Cylindrée", "gearbox": "Boîte de vitesses", "color": "Couleur", "condition": "État", "partNumber": "Référence de pièce", "type": "Type", "quantityAvailable": "Quantité disponible", "shipping": "Expédition", "shippingAvailable": "Disponible", "pickupOnly": "Retrait uniquement", "shipsTo": "Expédie vers :" },
    "heritage": { "section": "Histoire et provenance", "vin": "VIN / Châssis", "engineNumber": "Numéro de moteur", "originalColor": "Couleur d'origine", "previousOwners": "Propriétaires précédents" },
    "qa": { "section": "Questions et réponses", "placeholder": "Les commentaires apparaîtront ici après la publication de votre annonce" },
    "sidebar": { "askingPrice": "Prix demandé", "free": "Gratuit", "heritageCertified": "Certifié provenance", "premiumListing": "Annonce premium", "featuredDays": "Mise en avant pendant 30 jours", "contactSeller": "Contacter le vendeur", "saveToWatchlist": "Ajouter aux favoris", "buttonsDisabled": "Boutons désactivés en mode aperçu" },
    "submit": { "backToEdit": "Retour à l'édition", "paymentNotice": "Paiement de 10 $ via Stripe après l'envoi", "submitAndPay": "Envoyer et payer", "submitListing": "Publier l'annonce" }
  },
  "de": {
    "preview": { "mode": "Vorschaumodus", "subtitle": "- So wird Ihre Anzeige für Käufer aussehen" },
    "tabs": { "all": "Alle ({count})", "body": "Karosserie ({count})", "engine": "Motor ({count})", "interior": "Innenraum ({count})", "details": "Details ({count})" },
    "photos": { "primary": "Hauptbild", "photoN": "Foto {n}", "none": "Keine Fotos hinzugefügt" },
    "header": { "untitled": "Anzeige ohne Titel", "views": "{count} Aufrufe", "locationNotSet": "Standort nicht festgelegt" },
    "sections": { "description": "Beschreibung", "noDescription": "Keine Beschreibung angegeben", "specifications": "Spezifikationen" },
    "specs": { "mileage": "Kilometerstand", "mileageValue": "{miles} Meilen", "engineSize": "Hubraum", "gearbox": "Getriebe", "color": "Farbe", "condition": "Zustand", "partNumber": "Teilenummer", "type": "Typ", "quantityAvailable": "Verfügbare Menge", "shipping": "Versand", "shippingAvailable": "Verfügbar", "pickupOnly": "Nur Abholung", "shipsTo": "Versand nach:" },
    "heritage": { "section": "Geschichte & Herkunft", "vin": "VIN / Fahrgestell", "engineNumber": "Motornummer", "originalColor": "Originalfarbe", "previousOwners": "Vorbesitzer" },
    "qa": { "section": "Fragen & Antworten", "placeholder": "Kommentare erscheinen hier, nachdem Ihre Anzeige veröffentlicht wurde" },
    "sidebar": { "askingPrice": "Verkaufspreis", "free": "Kostenlos", "heritageCertified": "Heritage-zertifiziert", "premiumListing": "Premium-Anzeige", "featuredDays": "30 Tage lang hervorgehoben", "contactSeller": "Verkäufer kontaktieren", "saveToWatchlist": "Zur Merkliste hinzufügen", "buttonsDisabled": "Schaltflächen im Vorschaumodus deaktiviert" },
    "submit": { "backToEdit": "Zurück zur Bearbeitung", "paymentNotice": "Zahlung von 10 $ via Stripe nach dem Absenden", "submitAndPay": "Absenden & bezahlen", "submitListing": "Anzeige absenden" }
  },
  "it": {
    "preview": { "mode": "Modalità anteprima", "subtitle": "- Ecco come apparirà il tuo annuncio agli acquirenti" },
    "tabs": { "all": "Tutte ({count})", "body": "Carrozzeria ({count})", "engine": "Motore ({count})", "interior": "Interni ({count})", "details": "Dettagli ({count})" },
    "photos": { "primary": "Principale", "photoN": "Foto {n}", "none": "Nessuna foto aggiunta" },
    "header": { "untitled": "Annuncio senza titolo", "views": "{count} visualizzazioni", "locationNotSet": "Posizione non impostata" },
    "sections": { "description": "Descrizione", "noDescription": "Nessuna descrizione fornita", "specifications": "Specifiche" },
    "specs": { "mileage": "Chilometraggio", "mileageValue": "{miles} miglia", "engineSize": "Cilindrata", "gearbox": "Cambio", "color": "Colore", "condition": "Condizione", "partNumber": "Codice ricambio", "type": "Tipo", "quantityAvailable": "Quantità disponibile", "shipping": "Spedizione", "shippingAvailable": "Disponibile", "pickupOnly": "Solo ritiro", "shipsTo": "Spedisce a:" },
    "heritage": { "section": "Storia e provenienza", "vin": "VIN / Telaio", "engineNumber": "Numero motore", "originalColor": "Colore originale", "previousOwners": "Proprietari precedenti" },
    "qa": { "section": "Domande e risposte", "placeholder": "I commenti appariranno qui dopo la pubblicazione del tuo annuncio" },
    "sidebar": { "askingPrice": "Prezzo richiesto", "free": "Gratis", "heritageCertified": "Provenienza certificata", "premiumListing": "Annuncio premium", "featuredDays": "In evidenza per 30 giorni", "contactSeller": "Contatta il venditore", "saveToWatchlist": "Salva nei preferiti", "buttonsDisabled": "Pulsanti disattivati in modalità anteprima" },
    "submit": { "backToEdit": "Torna alla modifica", "paymentNotice": "Pagamento di 10 $ tramite Stripe dopo l'invio", "submitAndPay": "Invia e paga", "submitListing": "Pubblica annuncio" }
  },
  "pt": {
    "preview": { "mode": "Modo de visualização", "subtitle": "- É assim que seu anúncio aparecerá para os compradores" },
    "tabs": { "all": "Todas ({count})", "body": "Carroceria ({count})", "engine": "Motor ({count})", "interior": "Interior ({count})", "details": "Detalhes ({count})" },
    "photos": { "primary": "Principal", "photoN": "Foto {n}", "none": "Nenhuma foto adicionada" },
    "header": { "untitled": "Anúncio sem título", "views": "{count} visualizações", "locationNotSet": "Localização não definida" },
    "sections": { "description": "Descrição", "noDescription": "Nenhuma descrição fornecida", "specifications": "Especificações" },
    "specs": { "mileage": "Quilometragem", "mileageValue": "{miles} milhas", "engineSize": "Cilindrada", "gearbox": "Câmbio", "color": "Cor", "condition": "Estado", "partNumber": "Número da peça", "type": "Tipo", "quantityAvailable": "Quantidade disponível", "shipping": "Envio", "shippingAvailable": "Disponível", "pickupOnly": "Apenas retirada", "shipsTo": "Envia para:" },
    "heritage": { "section": "História e procedência", "vin": "VIN / Chassi", "engineNumber": "Número do motor", "originalColor": "Cor original", "previousOwners": "Proprietários anteriores" },
    "qa": { "section": "Perguntas e respostas", "placeholder": "Os comentários aparecerão aqui após a publicação do seu anúncio" },
    "sidebar": { "askingPrice": "Preço pedido", "free": "Grátis", "heritageCertified": "Procedência certificada", "premiumListing": "Anúncio premium", "featuredDays": "Em destaque por 30 dias", "contactSeller": "Contatar vendedor", "saveToWatchlist": "Salvar na lista de interesses", "buttonsDisabled": "Botões desativados no modo de visualização" },
    "submit": { "backToEdit": "Voltar para editar", "paymentNotice": "Pagamento de US$ 10 via Stripe após o envio", "submitAndPay": "Enviar e pagar", "submitListing": "Publicar anúncio" }
  },
  "ru": {
    "preview": { "mode": "Режим предпросмотра", "subtitle": "- Так ваше объявление увидят покупатели" },
    "tabs": { "all": "Все ({count})", "body": "Кузов ({count})", "engine": "Двигатель ({count})", "interior": "Салон ({count})", "details": "Детали ({count})" },
    "photos": { "primary": "Главное", "photoN": "Фото {n}", "none": "Фотографии не добавлены" },
    "header": { "untitled": "Объявление без названия", "views": "{count} просмотров", "locationNotSet": "Местоположение не указано" },
    "sections": { "description": "Описание", "noDescription": "Описание не предоставлено", "specifications": "Характеристики" },
    "specs": { "mileage": "Пробег", "mileageValue": "{miles} миль", "engineSize": "Объём двигателя", "gearbox": "Коробка передач", "color": "Цвет", "condition": "Состояние", "partNumber": "Номер детали", "type": "Тип", "quantityAvailable": "Доступное количество", "shipping": "Доставка", "shippingAvailable": "Доступна", "pickupOnly": "Только самовывоз", "shipsTo": "Доставка в:" },
    "heritage": { "section": "История и происхождение", "vin": "VIN / Шасси", "engineNumber": "Номер двигателя", "originalColor": "Оригинальный цвет", "previousOwners": "Предыдущие владельцы" },
    "qa": { "section": "Вопросы и ответы", "placeholder": "Комментарии появятся здесь после публикации вашего объявления" },
    "sidebar": { "askingPrice": "Запрашиваемая цена", "free": "Бесплатно", "heritageCertified": "Происхождение подтверждено", "premiumListing": "Премиум-объявление", "featuredDays": "В рекомендуемых 30 дней", "contactSeller": "Связаться с продавцом", "saveToWatchlist": "Добавить в избранное", "buttonsDisabled": "Кнопки отключены в режиме предпросмотра" },
    "submit": { "backToEdit": "Назад к редактированию", "paymentNotice": "Оплата 10 $ через Stripe после отправки", "submitAndPay": "Отправить и оплатить", "submitListing": "Опубликовать объявление" }
  },
  "ja": {
    "preview": { "mode": "プレビューモード", "subtitle": "- 購入者にはこのように表示されます" },
    "tabs": { "all": "すべて ({count})", "body": "ボディ ({count})", "engine": "エンジン ({count})", "interior": "内装 ({count})", "details": "詳細 ({count})" },
    "photos": { "primary": "メイン", "photoN": "写真 {n}", "none": "写真が追加されていません" },
    "header": { "untitled": "無題の出品", "views": "{count} 回閲覧", "locationNotSet": "所在地が未設定" },
    "sections": { "description": "説明", "noDescription": "説明がありません", "specifications": "仕様" },
    "specs": { "mileage": "走行距離", "mileageValue": "{miles} マイル", "engineSize": "排気量", "gearbox": "ギアボックス", "color": "色", "condition": "状態", "partNumber": "部品番号", "type": "種類", "quantityAvailable": "在庫数", "shipping": "配送", "shippingAvailable": "可能", "pickupOnly": "引き取りのみ", "shipsTo": "配送先：" },
    "heritage": { "section": "来歴・由来", "vin": "VIN / 車台", "engineNumber": "エンジン番号", "originalColor": "オリジナルカラー", "previousOwners": "前オーナー数" },
    "qa": { "section": "質問と回答", "placeholder": "出品を公開するとコメントがここに表示されます" },
    "sidebar": { "askingPrice": "希望価格", "free": "無料", "heritageCertified": "ヘリテージ認証済み", "premiumListing": "プレミアム出品", "featuredDays": "30日間注目掲載", "contactSeller": "出品者に連絡", "saveToWatchlist": "ウォッチリストに保存", "buttonsDisabled": "プレビューモードではボタンは無効です" },
    "submit": { "backToEdit": "編集に戻る", "paymentNotice": "送信後にStripeで10ドルのお支払い", "submitAndPay": "送信して支払う", "submitListing": "出品する" }
  },
  "zh": {
    "preview": { "mode": "预览模式", "subtitle": "- 这是买家看到您刊登的样子" },
    "tabs": { "all": "全部 ({count})", "body": "车身 ({count})", "engine": "发动机 ({count})", "interior": "内饰 ({count})", "details": "细节 ({count})" },
    "photos": { "primary": "主图", "photoN": "照片 {n}", "none": "未添加照片" },
    "header": { "untitled": "无标题刊登", "views": "{count} 次浏览", "locationNotSet": "未设置位置" },
    "sections": { "description": "描述", "noDescription": "未提供描述", "specifications": "规格" },
    "specs": { "mileage": "里程", "mileageValue": "{miles} 英里", "engineSize": "排量", "gearbox": "变速箱", "color": "颜色", "condition": "状况", "partNumber": "零件号", "type": "类型", "quantityAvailable": "可售数量", "shipping": "运输", "shippingAvailable": "可运输", "pickupOnly": "仅限自取", "shipsTo": "运送至：" },
    "heritage": { "section": "来历与出处", "vin": "VIN / 车架", "engineNumber": "发动机号", "originalColor": "原厂颜色", "previousOwners": "前任车主" },
    "qa": { "section": "问答", "placeholder": "刊登发布后评论将显示在此处" },
    "sidebar": { "askingPrice": "要价", "free": "免费", "heritageCertified": "来历认证", "premiumListing": "高级刊登", "featuredDays": "推荐展示 30 天", "contactSeller": "联系卖家", "saveToWatchlist": "保存到关注列表", "buttonsDisabled": "预览模式下按钮已禁用" },
    "submit": { "backToEdit": "返回编辑", "paymentNotice": "提交后通过 Stripe 支付 10 美元", "submitAndPay": "提交并支付", "submitListing": "提交刊登" }
  },
  "ko": {
    "preview": { "mode": "미리보기 모드", "subtitle": "- 구매자에게 이렇게 표시됩니다" },
    "tabs": { "all": "전체 ({count})", "body": "차체 ({count})", "engine": "엔진 ({count})", "interior": "실내 ({count})", "details": "디테일 ({count})" },
    "photos": { "primary": "대표", "photoN": "사진 {n}", "none": "추가된 사진 없음" },
    "header": { "untitled": "제목 없는 매물", "views": "조회수 {count}", "locationNotSet": "위치가 설정되지 않음" },
    "sections": { "description": "설명", "noDescription": "설명이 제공되지 않음", "specifications": "사양" },
    "specs": { "mileage": "주행거리", "mileageValue": "{miles} 마일", "engineSize": "배기량", "gearbox": "변속기", "color": "색상", "condition": "상태", "partNumber": "부품 번호", "type": "종류", "quantityAvailable": "재고 수량", "shipping": "배송", "shippingAvailable": "가능", "pickupOnly": "직접 수령만", "shipsTo": "배송 지역:" },
    "heritage": { "section": "내력 및 출처", "vin": "VIN / 차대", "engineNumber": "엔진 번호", "originalColor": "원래 색상", "previousOwners": "이전 소유자" },
    "qa": { "section": "질문 및 답변", "placeholder": "매물이 게시되면 댓글이 여기에 표시됩니다" },
    "sidebar": { "askingPrice": "희망 가격", "free": "무료", "heritageCertified": "내력 인증됨", "premiumListing": "프리미엄 매물", "featuredDays": "30일간 추천 노출", "contactSeller": "판매자에게 문의", "saveToWatchlist": "관심목록에 저장", "buttonsDisabled": "미리보기 모드에서는 버튼이 비활성화됩니다" },
    "submit": { "backToEdit": "편집으로 돌아가기", "paymentNotice": "제출 후 Stripe로 $10 결제", "submitAndPay": "제출 및 결제", "submitListing": "매물 제출" }
  }
}
</i18n>
