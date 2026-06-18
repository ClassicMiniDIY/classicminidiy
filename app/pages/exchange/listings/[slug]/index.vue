<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="py-12">
      <div class="container">
        <div class="skeleton h-96 mb-6"></div>
        <div class="skeleton h-32"></div>
      </div>
    </div>

    <!-- Listing Content -->
    <div v-else-if="listing">
      <!-- Admin Preview Banner -->
      <div v-if="isAdminPreview" class="bg-warning border-b border-warning-content/20">
        <div class="container">
          <div class="flex items-center justify-between gap-3 py-3">
            <div class="flex items-center gap-3">
              <i class="fas fa-shield-halved text-warning-content shrink-0"></i>
              <p class="text-sm font-medium text-warning-content">
                {{ t('adminPreview.intro') }} <strong>{{ listing?.status }}</strong> {{ t('adminPreview.outro') }}
              </p>
            </div>
            <div v-if="listing?.status === 'pending'" class="flex gap-2 shrink-0">
              <button class="btn btn-sm btn-success" :disabled="approvingListing" @click="handleApproveListing">
                <span v-if="approvingListing" class="loading loading-spinner loading-xs"></span>
                <i v-else class="fas fa-circle-check"></i>
                {{ t('adminPreview.approve') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Example Listing Disclaimer -->
      <div v-if="isExampleListing" class="bg-secondary border-b border-secondary-content/20">
        <div class="container">
          <div class="flex items-center gap-3 py-3">
            <i class="fas fa-triangle-exclamation text-secondary-content shrink-0"></i>
            <p class="text-sm font-medium text-secondary-content">
              {{ t('exampleDisclaimer') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Back to Listings -->
      <div class="container pt-6">
        <NuxtLink
          :to="backToListingsUrl"
          class="btn btn-ghost btn-sm -ml-2"
          data-test="back-to-listings"
        >
          <i class="fas fa-arrow-left"></i>
          {{ t('backToListings') }}
        </NuxtLink>
      </div>

      <!-- Image Gallery -->
      <section class="bg-base-200">
        <div class="container">
          <div class="py-12">
            <ExchangeListingsPhotoGallery
              v-if="listing.listing_photos"
              :photos="listing.listing_photos"
              :listing-title="listing.title"
              :listing-category="listing.listing_category as 'vehicle' | 'engine' | 'parts'"
              :get-photo-url="getPhotoUrl"
            />
          </div>
        </div>
      </section>

      <!-- Listing Details -->
      <section class="py-12">
        <div class="container">
          <!-- Grid Layout: Content and Sidebar -->
          <div class="grid lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2 space-y-8 order-2 lg:order-1">
              <!-- Header -->
              <div>
                <h1 class="text-4xl font-bold mb-2">{{ listing.title }}</h1>

                <!-- Subtitle: structured identifying details per category -->
                <p v-if="listingSubtitle" class="text-lg text-base-content/70">
                  {{ listingSubtitle }}
                </p>
              </div>

              <!-- Description -->
              <div>
                <h2 class="text-2xl font-semibold mb-4">{{ t('sections.description') }}</h2>
                <p class="text-base-content/80 whitespace-pre-wrap">{{ listing.description }}</p>
              </div>

              <!-- Specifications -->
              <div>
                <h2 class="text-2xl font-semibold mb-4">{{ t('sections.specifications') }}</h2>
                <div class="grid sm:grid-cols-2 gap-4">
                  <!-- Vehicle-specific specs -->
                  <template v-if="listing.listing_category === 'vehicle'">
                    <div v-if="listing.mileage" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-chart-column text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.mileage') }}</div>
                        <div class="font-medium">{{ t('specs.milesValue', { miles: formatMileage(listing.mileage) }) }}</div>
                      </div>
                    </div>

                    <div v-if="listing.engine_size" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-gear text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.engineSize') }}</div>
                        <div class="font-medium">{{ listing.engine_size }}</div>
                      </div>
                    </div>

                    <div v-if="listing.transmission" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-arrows-rotate text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.transmission') }}</div>
                        <div class="font-medium">{{ formatTransmissionType(listing.transmission) }}</div>
                      </div>
                    </div>

                    <div v-if="listing.color" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-paintbrush text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.color') }}</div>
                        <div class="font-medium">{{ listing.color }}</div>
                      </div>
                    </div>
                  </template>

                  <!-- Engine-specific specs (series, displacement, condition, year shown in header) -->
                  <template v-else-if="listing.listing_category === 'engine'">
                    <div v-if="listing.engine_size" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-gear text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.engineSize') }}</div>
                        <div class="font-medium">{{ listing.engine_size }}</div>
                      </div>
                    </div>

                    <div v-if="listing.engine_plate_details" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-id-card text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.enginePlateDetails') }}</div>
                        <div class="font-medium font-mono">{{ listing.engine_plate_details }}</div>
                      </div>
                    </div>
                  </template>

                  <!-- Parts-specific specs (condition and subcategory shown in header) -->
                  <template v-else-if="listing.listing_category === 'parts'">
                    <div v-if="listing.part_number" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-hashtag text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.partNumber') }}</div>
                        <div class="font-medium">{{ listing.part_number }}</div>
                      </div>
                    </div>

                    <div v-if="listing.oem_or_aftermarket" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-screwdriver-wrench text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.type') }}</div>
                        <div class="font-medium">
                          {{
                            listing.oem_or_aftermarket === 'oem'
                              ? t('specs.oem')
                              : listing.oem_or_aftermarket === 'mixed'
                                ? t('specs.oemAftermarketMix')
                                : t('specs.aftermarket')
                          }}
                        </div>
                      </div>
                    </div>

                    <div v-if="listing.quantity_available" class="flex items-center gap-3 p-4 bg-base-200 rounded-lg">
                      <i class="fas fa-cube text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.quantityAvailable') }}</div>
                        <div class="font-medium">{{ listing.quantity_available }}</div>
                      </div>
                    </div>

                    <div
                      v-if="listing.fits_models && listing.fits_models.length > 0"
                      class="flex items-center gap-3 p-4 bg-base-200 rounded-lg"
                    >
                      <i class="fas fa-puzzle-piece text-2xl text-base-content/60"></i>
                      <div>
                        <div class="text-sm text-base-content/60">{{ t('specs.fitsModels') }}</div>
                        <div class="font-medium">{{ listing.fits_models.join(', ') }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Shipping info card (for parts and engines, hide for sold) -->
              <template v-if="listing.listing_category !== 'vehicle' && listing.status !== 'sold'">
                <div v-if="listing.shipping_available !== null" class="md:col-span-2 card bg-base-200 shadow-sm">
                  <div class="card-body gap-3">
                    <!-- Header -->
                    <div class="flex items-center justify-between">
                      <h3 class="flex items-center gap-2 font-semibold">
                        <i class="fas fa-truck text-primary"></i>
                        {{ t('shipping.title') }}
                      </h3>
                      <span v-if="!listing.shipping_available" class="badge badge-ghost">{{ t('shipping.pickupOnly') }}</span>
                      <span v-else-if="listing.shipping_cost === 0" class="badge badge-success"> {{ t('shipping.freeShipping') }} </span>
                    </div>

                    <template v-if="listing.shipping_available">
                      <!-- Methods -->
                      <div
                        v-if="listing.shipping_methods && listing.shipping_methods.length > 0"
                        class="flex flex-wrap gap-2"
                      >
                        <span
                          v-for="method in listing.shipping_methods"
                          :key="method"
                          class="badge badge-outline badge-sm"
                        >
                          {{ formatShippingMethod(method) }}
                        </span>
                      </div>

                      <!-- Cost & scope grid -->
                      <div class="grid sm:grid-cols-2 gap-3">
                        <div v-if="listing.shipping_cost !== null" class="text-sm">
                          <span class="text-base-content/60">{{ t('shipping.domestic') }}</span>
                          <span class="font-medium ml-1">
                            {{ listing.shipping_cost === 0 ? t('shipping.free') : `$${listing.shipping_cost}` }}
                          </span>
                        </div>
                        <div v-if="listing.shipping_cost_international !== null" class="text-sm">
                          <span class="text-base-content/60">{{ t('shipping.international') }}</span>
                          <span class="font-medium ml-1">
                            {{
                              listing.shipping_cost_international === 0
                                ? t('shipping.free')
                                : `$${listing.shipping_cost_international}`
                            }}
                          </span>
                        </div>
                        <div v-if="listing.ships_to" class="text-sm">
                          <span class="text-base-content/60">{{ t('shipping.shipsTo') }}</span>
                          <span class="font-medium ml-1">{{ formatShipsTo(listing.ships_to) }}</span>
                          <span
                            v-if="listing.ships_to === 'specific_countries' && listing.ships_to_countries?.length"
                            class="text-xs text-base-content/50 ml-1"
                          >
                            ({{ listing.ships_to_countries.join(', ') }})
                          </span>
                        </div>
                        <div
                          v-if="listing.estimated_delivery_days_min || listing.estimated_delivery_days_max"
                          class="text-sm"
                        >
                          <span class="text-base-content/60">{{ t('shipping.delivery') }}</span>
                          <span class="font-medium ml-1">
                            <template v-if="listing.estimated_delivery_days_min && listing.estimated_delivery_days_max">
                              {{ t('shipping.businessDaysRange', { min: listing.estimated_delivery_days_min, max: listing.estimated_delivery_days_max }) }}
                            </template>
                            <template v-else-if="listing.estimated_delivery_days_min">
                              {{ t('shipping.businessDaysMin', { min: listing.estimated_delivery_days_min }) }}
                            </template>
                            <template v-else> {{ t('shipping.businessDaysMax', { max: listing.estimated_delivery_days_max }) }} </template>
                          </span>
                        </div>
                      </div>

                      <!-- Package info -->
                      <div
                        v-if="listing.package_weight_kg || listing.package_dimensions"
                        class="flex gap-4 text-sm text-base-content/60"
                      >
                        <span v-if="listing.package_weight_kg" class="flex items-center gap-1">
                          <i class="fas fa-scale-balanced"></i>
                          {{ t('shipping.weightKg', { weight: listing.package_weight_kg }) }}
                        </span>
                        <span v-if="listing.package_dimensions" class="flex items-center gap-1">
                          <i class="fas fa-cube"></i>
                          {{ listing.package_dimensions }}
                        </span>
                      </div>

                      <!-- Carrier rate calculator link -->
                      <a
                        v-if="rateCalculatorUrl"
                        :href="rateCalculatorUrl"
                        target="_blank"
                        rel="noopener"
                        class="link link-primary text-sm flex items-center gap-1"
                      >
                        <i class="fas fa-calculator"></i>
                        {{ t('shipping.estimateCost') }}
                        <i class="fas fa-arrow-up-right-from-square"></i>
                      </a>
                    </template>

                    <!-- Tracking info (shown when available) -->
                    <div v-if="listing.tracking_number" class="mt-2 pt-3 border-t border-base-300">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-base-content/60">{{ t('shipping.tracking') }}</span>
                        <a
                          v-if="trackingUrl"
                          :href="trackingUrl"
                          target="_blank"
                          rel="noopener"
                          class="btn btn-xs btn-primary"
                        >
                          <i class="fas fa-arrow-up-right-from-square"></i>
                          {{ t('shipping.trackPackage') }}
                        </a>
                      </div>
                      <div class="font-mono text-sm mt-1">{{ listing.tracking_number }}</div>
                      <div v-if="listing.tracking_carrier" class="text-xs text-base-content/60">
                        {{ t('shipping.via', { carrier: formatCarrierName(listing.tracking_carrier) }) }}
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Vehicle-specific sections -->
              <template v-if="listing.listing_category === 'vehicle'">
                <!-- Heritage & Provenance Section -->
                <ExchangeListingsHeritageSection :listing="listing" />

                <!-- Detailed Specifications Section -->
                <ExchangeListingsSpecificationSection :listing="listing" />

                <!-- Modifications & Condition Section -->
                <ExchangeListingsModificationSection :listing="listing" />
              </template>

              <!-- Location Map (if coordinates available, hide for sold) -->
              <div v-if="listing.status !== 'sold' && listing.latitude && listing.longitude" class="mt-8">
                <h2 class="text-2xl font-semibold mb-4">{{ t('sections.location') }}</h2>
                <div class="rounded-lg overflow-hidden border border-base-300" style="height: 400px">
                  <ExchangeListingsMap
                    :listings="[
                      {
                        id: listing.id,
                        title: listing.title,
                        slug: listing.slug,
                        price: listing.price,
                        location: formatDisplayLocation(listing),
                        latitude: listing.latitude,
                        longitude: listing.longitude,
                      },
                    ]"
                    :center="[listing.longitude, listing.latitude]"
                    :zoom="12"
                  />
                </div>
                <p class="text-sm text-base-content/70 mt-2">
                  <template v-if="getCountryFlag(listing.country)">{{ getCountryFlag(listing.country) }}</template>
                  <i v-else class="fas fa-location-dot inline"></i>
                  {{ formatDisplayLocation(listing) }}
                </p>
              </div>

              <!-- Comments Section (hidden for example listings) -->
              <ExchangeListingsCommentSection v-if="!isExampleListing" :listing-id="listing.id" />

              <!-- Change History Section -->
              <div v-if="history.length > 0" class="mt-8">
                <h2 class="text-2xl font-semibold mb-4">{{ t('history.title') }}</h2>

                <div class="space-y-3">
                  <div v-for="change in displayedHistory" :key="change.id" class="card bg-base-200 p-4">
                    <div class="flex items-start gap-3">
                      <i class="fas fa-pencil shrink-0 mt-1 text-info"></i>
                      <div class="flex-1">
                        <div class="flex items-start justify-between gap-2">
                          <div>
                            <div class="font-medium">
                              {{ formatFieldName(change.field_name) }}
                            </div>
                            <div class="text-sm text-base-content/70 mt-1">
                              <span v-if="change.old_value" class="line-through opacity-60">{{
                                change.old_value
                              }}</span>
                              <i
                                v-if="change.old_value"
                                class="fas fa-arrow-right inline mx-1"
                              ></i>
                              <span class="font-medium">{{ change.new_value }}</span>
                            </div>
                          </div>
                          <div class="text-xs text-base-content/60 text-right shrink-0">
                            <div>{{ change.profiles?.display_name || change.profiles?.username || t('anonymous') }}</div>
                            <div>{{ formatDate(change.created_at) }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Show More / Show Less Button -->
                  <div v-if="history.length > 3" class="text-center">
                    <button @click="showAllHistory = !showAllHistory" class="btn btn-ghost btn-sm">
                      {{ showAllHistory ? t('history.showLess') : t('history.showMore', { count: history.length - 3 }) }}
                      <i
                        :class="showAllHistory ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"
                        class="ml-1"
                      ></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1 order-1 lg:order-2">
              <div class="lg:sticky lg:top-20">
                <div class="card bg-base-100 shadow-sm">
                  <div class="card-body">
                    <!-- Price / Sold Status -->
                    <div class="mb-6">
                      <template v-if="listing.status === 'sold'">
                        <div class="p-4 bg-success/10 rounded-lg">
                          <div class="flex items-center gap-3 mb-2">
                            <i class="fas fa-circle-check text-3xl text-success shrink-0"></i>
                            <div class="text-lg font-bold text-success">{{ t('sold.badge') }}</div>
                          </div>
                          <div v-if="soldPrice !== 0" class="text-sm text-base-content/60 mb-2">{{ t('sold.soldFor') }}</div>
                          <div class="text-3xl font-bold text-success">
                            {{ formatListingPrice(soldPrice, formatCurrency(soldPrice, listingCurrency)) }}
                          </div>
                          <div v-if="soldConvertedPrice && soldPrice !== 0" class="text-sm text-base-content/60 mt-1">
                            {{ t('aboutInCurrency', { amount: formatCurrency(soldConvertedPrice, userCurrency), currency: userCurrency }) }}
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <div v-if="listing.price !== 0" class="text-sm text-base-content/60 mb-1">{{ t('price.askingPrice') }}</div>
                        <div class="text-4xl font-bold" :class="listing.price === 0 ? 'text-success' : 'text-primary'">
                          {{ formatListingPrice(listing.price, formatCurrency(listing.price, listingCurrency)) }}
                        </div>
                        <div v-if="convertedPrice && listing.price !== 0" class="text-sm text-base-content/60 mt-1">
                          {{ t('aboutInCurrency', { amount: formatCurrency(convertedPrice, userCurrency), currency: userCurrency }) }}
                        </div>
                        <!-- Price Drop Indicator -->
                        <div
                          v-if="listing.previous_price && listing.previous_price > listing.price"
                          class="flex items-center gap-2 mt-2"
                        >
                          <ExchangeListingsPriceDropBadge
                            :previous-price="listing.previous_price"
                            :current-price="listing.price"
                          />
                          <span class="text-sm text-base-content/50 line-through">
                            {{ formatCurrency(listing.previous_price, listingCurrency) }}
                          </span>
                        </div>
                        <!-- Example listing price disclaimer -->
                        <div v-if="isExampleListing" class="mt-3 p-2 bg-secondary rounded-lg">
                          <p class="text-xs text-secondary-content font-medium inline-flex items-center gap-1">
                            <i class="fas fa-triangle-exclamation shrink-0"></i>
                            {{ t('price.exampleNotForSale') }}
                          </p>
                        </div>
                      </template>
                    </div>

                    <!-- Listing Details -->
                    <div class="mb-6 pb-6 border-b border-base-300 grid grid-cols-2 gap-3 text-sm">
                      <!-- Category -->
                      <div class="flex items-center gap-2">
                        <i
                          :class="
                            listing.listing_category === 'vehicle'
                              ? 'fas fa-truck'
                              : listing.listing_category === 'engine'
                                ? 'fas fa-gear'
                                : 'fas fa-screwdriver-wrench'
                          "
                          class="text-base-content/50 shrink-0"
                        ></i>
                        <span>{{ formatListingCategory(listing.listing_category || '') }}</span>
                      </div>

                      <!-- Condition -->
                      <div v-if="listingConditionLabel" class="flex items-center gap-2">
                        <i class="far fa-star text-base-content/50 shrink-0"></i>
                        <span
                          class="badge badge-sm"
                          :class="
                            listing.listing_category === 'vehicle' && listing.condition
                              ? getConditionBadgeClass(listing.condition)
                              : 'badge-info'
                          "
                        >
                          {{ listingConditionLabel }}
                        </span>
                      </div>

                      <!-- Location -->
                      <div v-if="formatDisplayLocation(listing)" class="flex items-center gap-2">
                        <template v-if="getCountryFlag(listing.country)">
                          <span class="shrink-0">{{ getCountryFlag(listing.country) }}</span>
                        </template>
                        <i v-else class="fas fa-location-dot text-base-content/50 shrink-0"></i>
                        <span class="truncate">{{ formatDisplayLocation(listing) }}</span>
                      </div>

                      <!-- Views -->
                      <div class="flex items-center gap-2">
                        <i class="fas fa-eye text-base-content/50 shrink-0"></i>
                        <span>{{ t('details.views', { count: listing.views_count }) }}</span>
                      </div>
                    </div>

                    <!-- Heritage Certificate Badge -->
                    <div
                      v-if="listing.listing_category === 'vehicle' && listing.has_heritage_cert"
                      class="mb-6 pb-6 border-b border-base-300"
                    >
                      <div class="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                        <i class="fas fa-circle-check text-3xl text-primary shrink-0"></i>
                        <div>
                          <div class="font-semibold text-primary">{{ t('heritage.certified') }}</div>
                          <div v-if="listing.heritage_cert_number" class="text-xs text-base-content/70 font-mono">
                            #{{ listing.heritage_cert_number }}
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Seller Info -->
                    <div
                      v-if="listing.profiles"
                      class="mb-6 pb-6 border-b border-base-300"
                    >
                      <div class="text-sm font-medium text-base-content/60 mb-3">{{ t('seller.label') }}</div>
                      <NuxtLink :to="`/users/${listing.user_id}`" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div class="avatar shrink-0">
                          <div class="w-12 h-12 rounded-full bg-base-300">
                            <img
                              v-if="listing.profiles.avatar_url"
                              :src="listing.profiles.avatar_url"
                              :alt="listing.profiles.display_name || t('seller.altFallback')"
                              loading="lazy"
                            />
                            <div
                              v-else
                              class="flex items-center justify-center h-full text-lg font-semibold text-base-content/70"
                            >
                              {{ getInitials(listing.profiles.display_name || listing.profiles.username || t('anonymous')) }}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div class="font-medium">
                            {{ listing.profiles.display_name || listing.profiles.username || t('anonymous') }}
                          </div>
                          <div
                            v-if="formatDisplayLocation(listing)"
                            class="text-sm text-base-content/60 flex items-center gap-1"
                          >
                            <template v-if="getCountryFlag(listing.country)">{{
                              getCountryFlag(listing.country)
                            }}</template>
                            <i v-else class="fas fa-location-dot"></i>
                            {{ formatDisplayLocation(listing) }}
                          </div>
                        </div>
                      </NuxtLink>

                      <!-- Seller Trust Signals -->
                      <ExchangeProfileSellerTrustSignals
                        v-if="listing.user_id"
                        :seller-id="listing.user_id"
                        class="mt-3"
                      />
                    </div>

                    <!-- Distance Card (hide for own listings, example listings, and sold listings) -->
                    <div
                      v-if="
                        !isOwnListing &&
                        !isExampleListing &&
                        listing.status !== 'sold' &&
                        listing.latitude &&
                        listing.longitude
                      "
                      class="mb-6 pb-6 border-b border-base-300"
                    >
                      <ExchangeListingsDistanceCard
                        :listing-lat="Number(listing.latitude)"
                        :listing-lon="Number(listing.longitude)"
                        :listing-city="listing.city || listing.location || t('details.listingLocationFallback')"
                      />
                    </div>

                    <!-- Action Buttons -->
                    <div class="space-y-3">
                      <!-- Owner Actions -->
                      <template v-if="isOwnListing">
                        <!-- Quick Actions: Mark as Sold / Delete (only for active listings) -->
                        <div v-if="listing.status === 'active'" class="flex gap-2">
                          <button class="btn btn-outline flex-1 gap-2" :disabled="markingSold" @click="handleMarkSold">
                            <span v-if="markingSold" class="loading loading-spinner loading-sm"></span>
                            <i v-else class="fas fa-circle-check text-xl text-success"></i>
                            {{ t('actions.markSold') }}
                          </button>
                          <button
                            class="btn btn-outline btn-error flex-1 gap-2"
                            :disabled="deleting"
                            @click="handleDelete"
                          >
                            <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
                            <i v-else class="fas fa-trash text-xl"></i>
                            {{ t('actions.delete') }}
                          </button>
                        </div>
                        <!-- Edit button only shown for non-sold listings -->
                        <NuxtLink
                          v-if="listing.status !== 'sold'"
                          :to="`/exchange/listings/${listing.slug}/edit`"
                          class="btn btn-primary btn-block"
                        >
                          <i class="fas fa-pen-to-square text-2xl"></i>
                          {{ t('actions.editListing') }}
                        </NuxtLink>
                        <NuxtLink to="/dashboard/listings" class="btn btn-outline btn-block">
                          <i class="fas fa-square-poll-vertical text-2xl"></i>
                          {{ t('actions.manageListings') }}
                        </NuxtLink>
                      </template>

                      <!-- Visitor Actions (hide for example and sold listings) -->
                      <template v-else-if="!isExampleListing && listing.status !== 'sold'">
                        <button
                          @click="handleContactSeller"
                          class="btn btn-primary btn-block"
                          :disabled="contactingLoading"
                        >
                          <i v-if="contactingLoading" class="fas fa-arrows-rotate text-2xl animate-spin"></i>
                          <i v-else class="fas fa-envelope text-2xl"></i>
                          {{ t('actions.messageSeller') }}
                        </button>

                        <!-- Watchlist Button -->
                        <button
                          @click="handleWatchlistToggle"
                          class="btn btn-block"
                          :class="isWatchlisted(listing.id) ? 'btn-error' : 'btn-outline'"
                        >
                          <i
                            :class="isWatchlisted(listing.id) ? 'fas fa-heart' : 'far fa-heart'"
                            class="text-2xl"
                          ></i>
                          {{ isWatchlisted(listing.id) ? t('actions.removeFromWatchlist') : t('actions.addToWatchlist') }}
                        </button>
                      </template>
                    </div>

                    <!-- Listed / Updated Date -->
                    <div
                      class="mt-6 pt-6 border-t border-base-300 text-sm text-base-content/60 flex items-center gap-2"
                    >
                      <i class="fas fa-calendar shrink-0"></i>
                      <span>
                        {{ t('dates.listed', { date: formatDate(listing.created_at || '') })
                        }}<template v-if="listing.updated_at !== listing.created_at">
                          {{ t('dates.updated', { date: formatDate(listing.updated_at || '') }) }}</template
                        >
                      </span>
                    </div>

                    <!-- Share Buttons -->
                    <div class="mt-6 pt-6 border-t border-base-300">
                      <ExchangeListingsShareButtons
                        :title="listing.title"
                        :url="currentUrl"
                        :description="listing.description"
                        :show-label="true"
                        :listing-id="listing.id"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Related Listings -->
      <section v-if="listing && listing.status !== 'sold'" class="py-12 bg-base-200">
        <div class="container">
          <ExchangeListingsRelatedListings :listing-id="listing.id" />
        </div>
      </section>

      <!-- Confirm Dialogs -->
      <ExchangeConfirmDialog
        ref="soldDialogRef"
        :title="t('confirm.markSold.title')"
        :message="t('confirm.markSold.message')"
        :confirm-text="t('confirm.markSold.confirm')"
        confirm-color="success"
        @confirm="confirmMarkSold"
      />
      <ExchangeConfirmDialog
        ref="deleteDialogRef"
        :title="t('confirm.delete.title')"
        :message="t('confirm.delete.message')"
        :confirm-text="t('confirm.delete.confirm')"
        confirm-color="error"
        @confirm="confirmDelete"
      />
    </div>

    <!-- Error State -->
    <div v-else class="py-20">
      <div class="container">
        <div class="text-center">
          <i class="fas fa-triangle-exclamation text-7xl mx-auto mb-4 text-base-content/30"></i>
          <h1 class="text-3xl font-bold mb-2">{{ t('notFound.title') }}</h1>
          <p class="text-base-content/70 mb-6">{{ t('notFound.message') }}</p>
          <NuxtLink to="/exchange/listings" class="btn btn-primary btn-lg">{{ t('notFound.browseAll') }}</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';
  import { getCountryFlag } from '~/utils/countryFlags';
  import type { CurrencyCode } from '~/composables/useCurrency';
  import { isExampleStatus } from '~/composables/useExampleListings';
  import {
    formatShippingMethod,
    formatShipsTo,
    getRateCalculatorUrl,
    getTrackingUrl,
    getAllCarriers,
  } from '~/utils/shippingCarriers';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const supabase = useSupabase();
  const toast = useToast();
  const { fetchListingBySlug, getPhotoUrl } = useListings();
  const { capture } = usePostHog();
  const { isWatchlisted, toggleWatchlist, fetchWatchlist } = useWatchlist();
  const { user, isAdmin } = useAuth();
  const { startConversation } = useMessages();
  const { updateListingStatus } = useAdmin();
  const { getListingsReturnUrl } = useListingsReturnUrl();
  const config = useRuntimeConfig();

  // "Back to Listings" button target — restores the exact page + filter
  // state the user had on the browse index (from sessionStorage, set by
  // pages/exchange/listings/index.vue). Falls back to /exchange/listings if no state.
  // Computed so it re-evaluates on client hydration, since sessionStorage
  // is only available in the browser.
  const backToListingsUrl = ref('/exchange/listings');
  onMounted(() => {
    backToListingsUrl.value = getListingsReturnUrl();
  });
  const { fetchProfile } = useProfile();
  const {
    formatMileage,
    formatDate,
    getConditionBadgeClass,
    getInitials,
    formatTransmissionType,
    formatFieldName,
    formatPartCondition,
    formatPartsSubcategory,
    formatCondition,
    formatEngineCondition,
    formatManufacturer,
    formatDisplayLocation,
    formatListingCategory,
    formatListingPrice,
  } = useFormatters();
  const { formatCurrency, convertCurrency, fetchExchangeRates, exchangeRates } = useCurrency();

  const listing = ref<ListingWithPhotos | null>(null);
  const loading = ref(true);
  const soldDialogRef = ref<{ show: () => void; hide: () => void } | null>(null);
  const deleteDialogRef = ref<{ show: () => void; hide: () => void } | null>(null);
  const markingSold = ref(false);
  const deleting = ref(false);
  const { userCurrency } = useCurrency();

  // Get listing's currency (default to USD for older listings)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listingCurrency = computed(() => ((listing.value as any)?.currency as CurrencyCode) || 'USD');

  // Get the sold/final price for sold listings
  const soldPrice = computed(() => {
    if (!listing.value || listing.value.status !== 'sold') return null;
    // Use final_price if available, otherwise fall back to price
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalPrice = (listing.value as any).final_price;
    if (finalPrice) return finalPrice;
    return listing.value.price;
  });

  // Compute converted price if currencies differ (for active listings)
  const convertedPrice = computed(() => {
    if (!exchangeRates.value || !listing.value?.price) return null;
    if (listingCurrency.value === userCurrency.value) return null;
    return convertCurrency(listing.value.price, listingCurrency.value, userCurrency.value);
  });

  // Compute converted sold price for sold listings
  const soldConvertedPrice = computed(() => {
    if (!exchangeRates.value || !soldPrice.value) return null;
    if (listingCurrency.value === userCurrency.value) return null;
    return convertCurrency(soldPrice.value, listingCurrency.value, userCurrency.value);
  });

  // Subtitle: structured identifying details per listing category
  const listingSubtitle = computed(() => {
    if (!listing.value) return '';
    const cat = listing.value.listing_category;
    if (cat === 'vehicle') {
      const parts = [listing.value.year, formatManufacturer(listing.value.manufacturer), listing.value.model].filter(
        Boolean
      );
      return parts.length > 0 ? parts.join(' ') : '';
    }
    if (cat === 'engine') {
      const parts = [listing.value.year, listing.value.engine_series, listing.value.engine_displacement].filter(
        Boolean
      );
      return parts.length > 0 ? parts.join(' · ') : '';
    }
    if (cat === 'parts' && listing.value.parts_subcategory) {
      return formatPartsSubcategory(listing.value.parts_subcategory);
    }
    return '';
  });

  const listingConditionLabel = computed(() => {
    if (!listing.value) return '';
    const cat = listing.value.listing_category;
    if (cat === 'vehicle' && listing.value.condition) return formatCondition(listing.value.condition);
    if (cat === 'engine' && listing.value.condition) return formatEngineCondition(listing.value.condition);
    if (listing.value.part_condition) return formatPartCondition(listing.value.part_condition);
    return '';
  });

  const rateCalculatorUrl = computed(() => {
    if (!listing.value?.country) return null;
    return getRateCalculatorUrl(listing.value.country);
  });

  const trackingUrl = computed(() => {
    if (!listing.value?.tracking_number || !listing.value?.tracking_carrier) return null;
    return getTrackingUrl(listing.value.tracking_carrier, listing.value.tracking_number);
  });

  const formatCarrierName = (carrierId: string) => {
    const carrier = getAllCarriers().find((c) => c.id === carrierId);
    return carrier?.name || carrierId;
  };

  // Current page URL for sharing
  const currentUrl = computed(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return `${config.public.siteUrl || 'https://www.classicminidiy.com'}/exchange/listings/${route.params.slug}`;
  });

  // Handle watchlist toggle
  const handleWatchlistToggle = async () => {
    if (listing.value) {
      await toggleWatchlist(listing.value.id);
    }
  };

  // Contact seller - start or open conversation
  const contactingLoading = ref(false);

  const isOwnListing = computed(() => {
    return user.value && listing.value && user.value.id === listing.value.user_id;
  });

  const isExampleListing = computed(() => listing.value && isExampleStatus(listing.value.status));

  // Admin preview: admin viewing a non-public listing they don't own
  const isAdminPreview = computed(() => {
    if (!listing.value || !isAdmin.value) return false;
    const publicStatuses = ['active', 'sold', 'example_free', 'example_paid'];
    return !publicStatuses.includes(listing.value.status);
  });

  const approvingListing = ref(false);

  const handleApproveListing = async () => {
    if (!listing.value) return;
    approvingListing.value = true;
    try {
      await updateListingStatus(listing.value.id, 'active');
      listing.value.status = 'active';
      toast.add({
        title: t('toast.approved.title'),
        description: t('toast.approved.description'),
        color: 'success',
      });
    } catch (error) {
      console.error('Failed to approve listing:', error);
      toast.add({
        title: t('toast.error.title'),
        description: t('toast.approveError'),
        color: 'error',
      });
    } finally {
      approvingListing.value = false;
    }
  };

  // Change history
  const supabaseClient = useSupabase();
  const history = ref<any[]>([]);
  const showAllHistory = ref(false);

  // Computed property to show only 3 changes by default
  const displayedHistory = computed(() => {
    if (showAllHistory.value || history.value.length <= 3) {
      return history.value;
    }
    return history.value.slice(0, 3);
  });

  const loadEditInfo = async () => {
    if (!listing.value) return;

    try {
      const { data, error } = await supabaseClient
        .from('listing_history')
        .select('*, profiles:public_profiles!listing_history_user_id_fkey(id, display_name, username)')
        .eq('listing_id', listing.value.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      history.value = data || [];
    } catch (error) {
      console.error('Failed to load change history:', error);
    }
  };

  const handleContactSeller = async () => {
    if (!listing.value) return;

    // Track contact seller click
    capture('contact_seller_clicked', {
      listing_id: listing.value.id,
      seller_id: listing.value.user_id,
    });

    // If user is not authenticated, redirect to login
    if (!user.value) {
      router.push({ query: { ...route.query, login: 'required' } });
      return;
    }

    // For authenticated users, use messaging system
    contactingLoading.value = true;

    try {
      const conversationId = await startConversation({
        listingId: listing.value.id,
        recipientId: listing.value.user_id,
      });

      if (conversationId) {
        // Navigate to the conversation
        router.push(`/exchange/messages/${conversationId}`);
      }
    } finally {
      contactingLoading.value = false;
    }
  };

  // Handle marking listing as sold - show dialog
  const handleMarkSold = () => {
    if (!listing.value) return;
    soldDialogRef.value?.show();
  };

  // Confirm mark as sold
  const confirmMarkSold = async () => {
    if (!listing.value) return;

    markingSold.value = true;
    try {
      const soldDate = new Date().toISOString();
      const { error } = await supabase
        .from('listings')
        .update({ status: 'sold', sold_date: soldDate })
        .eq('id', listing.value.id)
        .eq('user_id', user.value?.id);

      if (error) throw error;

      // Update local state
      listing.value.status = 'sold';
      listing.value.sold_date = soldDate;

      toast.add({
        title: t('toast.markedSold.title'),
        description: t('toast.markedSold.description'),
        color: 'success',
      });
    } catch (error) {
      console.error('Failed to mark listing as sold:', error);
      toast.add({
        title: t('toast.error.title'),
        description: t('toast.markSoldError'),
        color: 'error',
      });
    } finally {
      markingSold.value = false;
    }
  };

  // Handle deleting listing - show dialog
  const handleDelete = () => {
    if (!listing.value) return;
    deleteDialogRef.value?.show();
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!listing.value) return;

    deleting.value = true;
    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.value.id)
        .eq('user_id', user.value?.id);

      if (error) throw error;

      toast.add({
        title: t('toast.deleted.title'),
        description: t('toast.deleted.description'),
        color: 'success',
      });

      // Redirect to dashboard
      router.push('/dashboard/listings');
    } catch (error) {
      console.error('Failed to delete listing:', error);
      toast.add({
        title: t('toast.error.title'),
        description: t('toast.deleteError'),
        color: 'error',
      });
    } finally {
      deleting.value = false;
    }
  };

  // Track listing view (only once per page load)
  const hasTrackedView = ref(false);

  watch(
    () => listing.value,
    (newListing) => {
      if (newListing && !hasTrackedView.value && import.meta.client) {
        hasTrackedView.value = true;
        capture('listing_viewed', {
          listing_id: newListing.id,
          category: newListing.listing_category as 'vehicle' | 'engine' | 'parts',
          tier: newListing.tier as 'free' | 'paid',
          seller_id: newListing.user_id,
          referrer: document.referrer || undefined,
        });
      }
    },
    { immediate: true }
  );

  // Fetch listing data via useAsyncData so it runs during SSR (needed for OG meta tags)
  const slug = route.params.slug as string;
  const { data: fetchedListing } = await useAsyncData(`listing-${slug}`, () => fetchListingBySlug(slug));

  listing.value = fetchedListing.value;
  loading.value = !fetchedListing.value;

  // Set SEO metadata reactively (runs during SSR for social media crawlers)
  const siteUrl = config.public.siteUrl || 'https://www.classicminidiy.com';

  // Shared sorted photos: primary first, then by display_order
  const sortedPhotosByPrimary = computed(() => {
    if (!listing.value?.listing_photos?.length) return [];
    return [...listing.value.listing_photos].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });
  });

  const primaryPhotoUrl = computed(() => {
    const first = sortedPhotosByPrimary.value[0];
    return first?.storage_path ? getPhotoUrl(first.storage_path) : `${siteUrl}/og-image.jpg`;
  });

  const ogDescription = computed(() => {
    const rawDesc = listing.value?.description || '';
    if (rawDesc.length <= 160) return rawDesc;
    const truncated = rawDesc.substring(0, 160);
    const lastSentence = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSentence > 80 ? truncated.substring(0, lastSentence + 1) : truncated.substring(0, lastSpace) + '...';
  });

  useSeoMeta({
    title: () => (listing.value ? `${listing.value.title} - The Mini Exchange` : 'Listing - The Mini Exchange'),
    description: () => ogDescription.value,
    ogTitle: () => listing.value?.title || 'Listing',
    ogDescription: () => ogDescription.value,
    ogType: 'product',
    ogUrl: `${siteUrl}/exchange/listings/${slug}`,
    ogImage: () => primaryPhotoUrl.value,
    ogSiteName: 'The Mini Exchange',
    'og:price:amount': () =>
      listing.value?.price ? String(listing.value.price) : listing.value?.price === 0 ? '0' : undefined,
    'og:price:currency': () =>
      listing.value?.price || listing.value?.price === 0 ? (listing.value as any).currency || 'USD' : undefined,
    twitterCard: 'summary_large_image',
    twitterTitle: () => listing.value?.title || 'Listing',
    twitterDescription: () => ogDescription.value,
    twitterImage: () => primaryPhotoUrl.value,
    'twitter:label1': 'Price',
    'twitter:data1': () => {
      if (listing.value?.price === 0) return 'Free';
      if (!listing.value?.price) return 'Contact for price';
      const currency = (listing.value as any).currency || 'USD';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(listing.value.price);
    },
    'twitter:label2': 'Location',
    'twitter:data2': () => (listing.value ? formatDisplayLocation(listing.value) : '') || 'Not specified',
  });

  // Schema.org Product + BreadcrumbList markup (also SSR-compatible)
  if (listing.value) {
    const currency = (listing.value as any).currency || 'USD';
    const allPhotoUrls = sortedPhotosByPrimary.value.map((p) => getPhotoUrl(p.storage_path));

    const additionalProperties = [
      listing.value.year ? { '@type': 'PropertyValue', name: 'Year', value: String(listing.value.year) } : null,
      listing.value.model ? { '@type': 'PropertyValue', name: 'Model', value: listing.value.model } : null,
      listing.value.mileage
        ? { '@type': 'PropertyValue', name: 'Mileage', value: `${listing.value.mileage} miles` }
        : null,
      listing.value.transmission
        ? { '@type': 'PropertyValue', name: 'Transmission', value: listing.value.transmission }
        : null,
      listing.value.color ? { '@type': 'PropertyValue', name: 'Exterior Color', value: listing.value.color } : null,
    ].filter(Boolean);

    useSchemaOrg([
      {
        '@type': 'Product',
        name: listing.value.title,
        description: listing.value.description,
        image: allPhotoUrls.length > 0 ? allPhotoUrls : primaryPhotoUrl.value,
        url: `${siteUrl}/exchange/listings/${slug}`,
        brand: {
          '@type': 'Brand',
          name: 'Mini Cooper',
        },
        category: 'Classic Mini Cooper',
        offers: {
          '@type': 'Offer',
          price: listing.value.price || 0,
          priceCurrency: currency,
          availability:
            listing.value.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: `https://schema.org/${listing.value.condition === 'new' ? 'NewCondition' : 'UsedCondition'}`,
          seller: {
            '@type': 'Person',
            name: listing.value.profiles?.display_name || 'Seller',
            url: listing.value.profiles?.id ? `${siteUrl}/users/${listing.value.profiles.id}` : undefined,
          },
        },
        additionalProperty: additionalProperties,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Listings', item: `${siteUrl}/exchange/listings` },
          { '@type': 'ListItem', position: 3, name: listing.value.title },
        ],
      },
    ]);
  }

  // Client-only setup (keyboard nav, watchlist, currency, edit info)
  onMounted(async () => {
    // If SSR couldn't fetch the listing (e.g. pending listing where RLS requires
    // auth context), retry client-side where the user's session is available
    if (!listing.value && user.value) {
      try {
        const clientListing = await fetchListingBySlug(slug);
        if (clientListing) {
          listing.value = clientListing;
          loading.value = false;
        }
      } catch {
        // Listing genuinely not accessible - show not found
        loading.value = false;
      }
    }

    // Fetch watchlist if logged in
    if (user.value) {
      fetchWatchlist();
    }

    // Load edit information
    loadEditInfo();

    // Fetch exchange rates for currency conversion
    fetchExchangeRates();
  });
</script>

<i18n lang="json">
{
  "en": {
    "adminPreview": { "intro": "Admin Preview — This listing is", "outro": "and not visible to the public.", "approve": "Approve" },
    "exampleDisclaimer": "This is an example listing for demonstration purposes and is not for sale.",
    "backToListings": "Back to Listings",
    "anonymous": "Anonymous",
    "sections": { "description": "Description", "specifications": "Specifications", "location": "Location" },
    "specs": { "mileage": "Mileage", "milesValue": "{miles} miles", "engineSize": "Engine Size", "transmission": "Transmission", "color": "Color", "enginePlateDetails": "Engine Plate Details", "partNumber": "Part Number", "type": "Type", "oem": "OEM", "oemAftermarketMix": "OEM & Aftermarket Mix", "aftermarket": "Aftermarket", "quantityAvailable": "Quantity Available", "fitsModels": "Fits Models" },
    "shipping": { "title": "Shipping", "pickupOnly": "Pickup Only", "freeShipping": "Free Shipping", "domestic": "Domestic:", "international": "International:", "free": "Free", "shipsTo": "Ships to:", "delivery": "Delivery:", "businessDaysRange": "{min}-{max} business days", "businessDaysMin": "{min}+ business days", "businessDaysMax": "Up to {max} business days", "weightKg": "{weight} kg", "estimateCost": "Estimate shipping cost", "tracking": "Tracking", "trackPackage": "Track Package", "via": "via {carrier}" },
    "history": { "title": "Change History", "showLess": "Show Less", "showMore": "Show {count} More" },
    "sold": { "badge": "SOLD", "soldFor": "Sold for" },
    "aboutInCurrency": "About {amount} in {currency}",
    "price": { "askingPrice": "Asking Price", "exampleNotForSale": "Example listing — not for sale" },
    "details": { "views": "{count} views", "listingLocationFallback": "Listing location" },
    "heritage": { "certified": "Heritage Certified" },
    "seller": { "label": "Seller", "altFallback": "Seller" },
    "actions": { "markSold": "Mark Sold", "delete": "Delete", "editListing": "Edit Listing", "manageListings": "Manage Listings", "messageSeller": "Message Seller", "removeFromWatchlist": "Remove from Watchlist", "addToWatchlist": "Add to Watchlist" },
    "dates": { "listed": "Listed {date}", "updated": "· Updated {date}" },
    "confirm": { "markSold": { "title": "Mark as Sold", "message": "Mark this listing as sold? Congratulations on your sale!", "confirm": "Mark Sold" }, "delete": { "title": "Delete Listing", "message": "Are you sure you want to delete this listing? This action cannot be undone.", "confirm": "Delete" } },
    "notFound": { "title": "Listing Not Found", "message": "The listing you're looking for doesn't exist or has been removed.", "browseAll": "Browse All Listings" },
    "toast": { "approved": { "title": "Listing Approved", "description": "This listing is now active and visible to all users." }, "approveError": "Failed to approve listing. Please try again.", "markedSold": { "title": "Listing Marked as Sold", "description": "Congratulations on your sale!" }, "markSoldError": "Failed to mark listing as sold. Please try again.", "deleted": { "title": "Listing Deleted", "description": "Your listing has been permanently deleted." }, "deleteError": "Failed to delete listing. Please try again.", "error": { "title": "Error" } }
  },
  "es": {
    "adminPreview": { "intro": "Vista previa de administrador — Este anuncio está", "outro": "y no es visible para el público.", "approve": "Aprobar" },
    "exampleDisclaimer": "Este es un anuncio de ejemplo con fines de demostración y no está en venta.",
    "backToListings": "Volver a los anuncios",
    "anonymous": "Anónimo",
    "sections": { "description": "Descripción", "specifications": "Especificaciones", "location": "Ubicación" },
    "specs": { "mileage": "Kilometraje", "milesValue": "{miles} millas", "engineSize": "Cilindrada", "transmission": "Transmisión", "color": "Color", "enginePlateDetails": "Detalles de la placa del motor", "partNumber": "Número de pieza", "type": "Tipo", "oem": "OEM", "oemAftermarketMix": "Mezcla OEM y posventa", "aftermarket": "Posventa", "quantityAvailable": "Cantidad disponible", "fitsModels": "Modelos compatibles" },
    "shipping": { "title": "Envío", "pickupOnly": "Solo recogida", "freeShipping": "Envío gratis", "domestic": "Nacional:", "international": "Internacional:", "free": "Gratis", "shipsTo": "Envía a:", "delivery": "Entrega:", "businessDaysRange": "{min}-{max} días hábiles", "businessDaysMin": "{min}+ días hábiles", "businessDaysMax": "Hasta {max} días hábiles", "weightKg": "{weight} kg", "estimateCost": "Estimar costo de envío", "tracking": "Seguimiento", "trackPackage": "Rastrear paquete", "via": "vía {carrier}" },
    "history": { "title": "Historial de cambios", "showLess": "Mostrar menos", "showMore": "Mostrar {count} más" },
    "sold": { "badge": "VENDIDO", "soldFor": "Vendido por" },
    "aboutInCurrency": "Aproximadamente {amount} en {currency}",
    "price": { "askingPrice": "Precio solicitado", "exampleNotForSale": "Anuncio de ejemplo — no está en venta" },
    "details": { "views": "{count} vistas", "listingLocationFallback": "Ubicación del anuncio" },
    "heritage": { "certified": "Certificado de patrimonio" },
    "seller": { "label": "Vendedor", "altFallback": "Vendedor" },
    "actions": { "markSold": "Marcar como vendido", "delete": "Eliminar", "editListing": "Editar anuncio", "manageListings": "Gestionar anuncios", "messageSeller": "Enviar mensaje al vendedor", "removeFromWatchlist": "Quitar de la lista de seguimiento", "addToWatchlist": "Añadir a la lista de seguimiento" },
    "dates": { "listed": "Publicado {date}", "updated": "· Actualizado {date}" },
    "confirm": { "markSold": { "title": "Marcar como vendido", "message": "¿Marcar este anuncio como vendido? ¡Felicidades por tu venta!", "confirm": "Marcar como vendido" }, "delete": { "title": "Eliminar anuncio", "message": "¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.", "confirm": "Eliminar" } },
    "notFound": { "title": "Anuncio no encontrado", "message": "El anuncio que buscas no existe o ha sido eliminado.", "browseAll": "Explorar todos los anuncios" },
    "toast": { "approved": { "title": "Anuncio aprobado", "description": "Este anuncio ahora está activo y es visible para todos los usuarios." }, "approveError": "No se pudo aprobar el anuncio. Inténtalo de nuevo.", "markedSold": { "title": "Anuncio marcado como vendido", "description": "¡Felicidades por tu venta!" }, "markSoldError": "No se pudo marcar el anuncio como vendido. Inténtalo de nuevo.", "deleted": { "title": "Anuncio eliminado", "description": "Tu anuncio se ha eliminado permanentemente." }, "deleteError": "No se pudo eliminar el anuncio. Inténtalo de nuevo.", "error": { "title": "Error" } }
  },
  "fr": {
    "adminPreview": { "intro": "Aperçu administrateur — Cette annonce est", "outro": "et n'est pas visible par le public.", "approve": "Approuver" },
    "exampleDisclaimer": "Ceci est une annonce exemple à des fins de démonstration et n'est pas à vendre.",
    "backToListings": "Retour aux annonces",
    "anonymous": "Anonyme",
    "sections": { "description": "Description", "specifications": "Caractéristiques", "location": "Emplacement" },
    "specs": { "mileage": "Kilométrage", "milesValue": "{miles} miles", "engineSize": "Cylindrée", "transmission": "Transmission", "color": "Couleur", "enginePlateDetails": "Détails de la plaque moteur", "partNumber": "Numéro de pièce", "type": "Type", "oem": "OEM", "oemAftermarketMix": "Mélange OEM et adaptable", "aftermarket": "Adaptable", "quantityAvailable": "Quantité disponible", "fitsModels": "Modèles compatibles" },
    "shipping": { "title": "Expédition", "pickupOnly": "Retrait uniquement", "freeShipping": "Livraison gratuite", "domestic": "National :", "international": "International :", "free": "Gratuit", "shipsTo": "Expédie vers :", "delivery": "Livraison :", "businessDaysRange": "{min}-{max} jours ouvrables", "businessDaysMin": "{min}+ jours ouvrables", "businessDaysMax": "Jusqu'à {max} jours ouvrables", "weightKg": "{weight} kg", "estimateCost": "Estimer les frais d'expédition", "tracking": "Suivi", "trackPackage": "Suivre le colis", "via": "via {carrier}" },
    "history": { "title": "Historique des modifications", "showLess": "Afficher moins", "showMore": "Afficher {count} de plus" },
    "sold": { "badge": "VENDU", "soldFor": "Vendu pour" },
    "aboutInCurrency": "Environ {amount} en {currency}",
    "price": { "askingPrice": "Prix demandé", "exampleNotForSale": "Annonce exemple — non à vendre" },
    "details": { "views": "{count} vues", "listingLocationFallback": "Emplacement de l'annonce" },
    "heritage": { "certified": "Certifié patrimoine" },
    "seller": { "label": "Vendeur", "altFallback": "Vendeur" },
    "actions": { "markSold": "Marquer comme vendu", "delete": "Supprimer", "editListing": "Modifier l'annonce", "manageListings": "Gérer les annonces", "messageSeller": "Contacter le vendeur", "removeFromWatchlist": "Retirer de la liste de suivi", "addToWatchlist": "Ajouter à la liste de suivi" },
    "dates": { "listed": "Publié {date}", "updated": "· Mis à jour {date}" },
    "confirm": { "markSold": { "title": "Marquer comme vendu", "message": "Marquer cette annonce comme vendue ? Félicitations pour votre vente !", "confirm": "Marquer comme vendu" }, "delete": { "title": "Supprimer l'annonce", "message": "Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible.", "confirm": "Supprimer" } },
    "notFound": { "title": "Annonce introuvable", "message": "L'annonce que vous recherchez n'existe pas ou a été supprimée.", "browseAll": "Parcourir toutes les annonces" },
    "toast": { "approved": { "title": "Annonce approuvée", "description": "Cette annonce est maintenant active et visible par tous les utilisateurs." }, "approveError": "Échec de l'approbation de l'annonce. Veuillez réessayer.", "markedSold": { "title": "Annonce marquée comme vendue", "description": "Félicitations pour votre vente !" }, "markSoldError": "Échec du marquage de l'annonce comme vendue. Veuillez réessayer.", "deleted": { "title": "Annonce supprimée", "description": "Votre annonce a été définitivement supprimée." }, "deleteError": "Échec de la suppression de l'annonce. Veuillez réessayer.", "error": { "title": "Erreur" } }
  },
  "de": {
    "adminPreview": { "intro": "Admin-Vorschau — Diese Anzeige ist", "outro": "und für die Öffentlichkeit nicht sichtbar.", "approve": "Genehmigen" },
    "exampleDisclaimer": "Dies ist eine Beispielanzeige zu Demonstrationszwecken und steht nicht zum Verkauf.",
    "backToListings": "Zurück zu den Anzeigen",
    "anonymous": "Anonym",
    "sections": { "description": "Beschreibung", "specifications": "Spezifikationen", "location": "Standort" },
    "specs": { "mileage": "Kilometerstand", "milesValue": "{miles} Meilen", "engineSize": "Hubraum", "transmission": "Getriebe", "color": "Farbe", "enginePlateDetails": "Motorplakettendetails", "partNumber": "Teilenummer", "type": "Typ", "oem": "OEM", "oemAftermarketMix": "Mischung aus OEM und Zubehör", "aftermarket": "Zubehör", "quantityAvailable": "Verfügbare Menge", "fitsModels": "Passende Modelle" },
    "shipping": { "title": "Versand", "pickupOnly": "Nur Abholung", "freeShipping": "Kostenloser Versand", "domestic": "Inland:", "international": "International:", "free": "Kostenlos", "shipsTo": "Versand nach:", "delivery": "Lieferung:", "businessDaysRange": "{min}-{max} Werktage", "businessDaysMin": "{min}+ Werktage", "businessDaysMax": "Bis zu {max} Werktage", "weightKg": "{weight} kg", "estimateCost": "Versandkosten schätzen", "tracking": "Sendungsverfolgung", "trackPackage": "Paket verfolgen", "via": "über {carrier}" },
    "history": { "title": "Änderungsverlauf", "showLess": "Weniger anzeigen", "showMore": "{count} weitere anzeigen" },
    "sold": { "badge": "VERKAUFT", "soldFor": "Verkauft für" },
    "aboutInCurrency": "Etwa {amount} in {currency}",
    "price": { "askingPrice": "Angebotspreis", "exampleNotForSale": "Beispielanzeige — nicht zum Verkauf" },
    "details": { "views": "{count} Aufrufe", "listingLocationFallback": "Anzeigenstandort" },
    "heritage": { "certified": "Heritage-zertifiziert" },
    "seller": { "label": "Verkäufer", "altFallback": "Verkäufer" },
    "actions": { "markSold": "Als verkauft markieren", "delete": "Löschen", "editListing": "Anzeige bearbeiten", "manageListings": "Anzeigen verwalten", "messageSeller": "Verkäufer kontaktieren", "removeFromWatchlist": "Von der Merkliste entfernen", "addToWatchlist": "Zur Merkliste hinzufügen" },
    "dates": { "listed": "Eingestellt {date}", "updated": "· Aktualisiert {date}" },
    "confirm": { "markSold": { "title": "Als verkauft markieren", "message": "Diese Anzeige als verkauft markieren? Glückwunsch zu deinem Verkauf!", "confirm": "Als verkauft markieren" }, "delete": { "title": "Anzeige löschen", "message": "Möchtest du diese Anzeige wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.", "confirm": "Löschen" } },
    "notFound": { "title": "Anzeige nicht gefunden", "message": "Die gesuchte Anzeige existiert nicht oder wurde entfernt.", "browseAll": "Alle Anzeigen durchsuchen" },
    "toast": { "approved": { "title": "Anzeige genehmigt", "description": "Diese Anzeige ist jetzt aktiv und für alle Nutzer sichtbar." }, "approveError": "Anzeige konnte nicht genehmigt werden. Bitte erneut versuchen.", "markedSold": { "title": "Anzeige als verkauft markiert", "description": "Glückwunsch zu deinem Verkauf!" }, "markSoldError": "Anzeige konnte nicht als verkauft markiert werden. Bitte erneut versuchen.", "deleted": { "title": "Anzeige gelöscht", "description": "Deine Anzeige wurde dauerhaft gelöscht." }, "deleteError": "Anzeige konnte nicht gelöscht werden. Bitte erneut versuchen.", "error": { "title": "Fehler" } }
  },
  "it": {
    "adminPreview": { "intro": "Anteprima amministratore — Questo annuncio è", "outro": "e non è visibile al pubblico.", "approve": "Approva" },
    "exampleDisclaimer": "Questo è un annuncio di esempio a scopo dimostrativo e non è in vendita.",
    "backToListings": "Torna agli annunci",
    "anonymous": "Anonimo",
    "sections": { "description": "Descrizione", "specifications": "Specifiche", "location": "Posizione" },
    "specs": { "mileage": "Chilometraggio", "milesValue": "{miles} miglia", "engineSize": "Cilindrata", "transmission": "Trasmissione", "color": "Colore", "enginePlateDetails": "Dettagli targhetta motore", "partNumber": "Numero ricambio", "type": "Tipo", "oem": "OEM", "oemAftermarketMix": "Mix OEM e aftermarket", "aftermarket": "Aftermarket", "quantityAvailable": "Quantità disponibile", "fitsModels": "Modelli compatibili" },
    "shipping": { "title": "Spedizione", "pickupOnly": "Solo ritiro", "freeShipping": "Spedizione gratuita", "domestic": "Nazionale:", "international": "Internazionale:", "free": "Gratis", "shipsTo": "Spedisce a:", "delivery": "Consegna:", "businessDaysRange": "{min}-{max} giorni lavorativi", "businessDaysMin": "{min}+ giorni lavorativi", "businessDaysMax": "Fino a {max} giorni lavorativi", "weightKg": "{weight} kg", "estimateCost": "Stima i costi di spedizione", "tracking": "Tracciamento", "trackPackage": "Traccia pacco", "via": "tramite {carrier}" },
    "history": { "title": "Cronologia modifiche", "showLess": "Mostra meno", "showMore": "Mostra altri {count}" },
    "sold": { "badge": "VENDUTO", "soldFor": "Venduto a" },
    "aboutInCurrency": "Circa {amount} in {currency}",
    "price": { "askingPrice": "Prezzo richiesto", "exampleNotForSale": "Annuncio di esempio — non in vendita" },
    "details": { "views": "{count} visualizzazioni", "listingLocationFallback": "Posizione annuncio" },
    "heritage": { "certified": "Certificato Heritage" },
    "seller": { "label": "Venditore", "altFallback": "Venditore" },
    "actions": { "markSold": "Segna come venduto", "delete": "Elimina", "editListing": "Modifica annuncio", "manageListings": "Gestisci annunci", "messageSeller": "Contatta il venditore", "removeFromWatchlist": "Rimuovi dalla lista", "addToWatchlist": "Aggiungi alla lista" },
    "dates": { "listed": "Pubblicato {date}", "updated": "· Aggiornato {date}" },
    "confirm": { "markSold": { "title": "Segna come venduto", "message": "Segnare questo annuncio come venduto? Congratulazioni per la vendita!", "confirm": "Segna come venduto" }, "delete": { "title": "Elimina annuncio", "message": "Sei sicuro di voler eliminare questo annuncio? Questa azione non può essere annullata.", "confirm": "Elimina" } },
    "notFound": { "title": "Annuncio non trovato", "message": "L'annuncio che cerchi non esiste o è stato rimosso.", "browseAll": "Sfoglia tutti gli annunci" },
    "toast": { "approved": { "title": "Annuncio approvato", "description": "Questo annuncio è ora attivo e visibile a tutti gli utenti." }, "approveError": "Impossibile approvare l'annuncio. Riprova.", "markedSold": { "title": "Annuncio segnato come venduto", "description": "Congratulazioni per la vendita!" }, "markSoldError": "Impossibile segnare l'annuncio come venduto. Riprova.", "deleted": { "title": "Annuncio eliminato", "description": "Il tuo annuncio è stato eliminato definitivamente." }, "deleteError": "Impossibile eliminare l'annuncio. Riprova.", "error": { "title": "Errore" } }
  },
  "pt": {
    "adminPreview": { "intro": "Pré-visualização de administrador — Este anúncio está", "outro": "e não é visível ao público.", "approve": "Aprovar" },
    "exampleDisclaimer": "Este é um anúncio de exemplo para fins de demonstração e não está à venda.",
    "backToListings": "Voltar aos anúncios",
    "anonymous": "Anônimo",
    "sections": { "description": "Descrição", "specifications": "Especificações", "location": "Localização" },
    "specs": { "mileage": "Quilometragem", "milesValue": "{miles} milhas", "engineSize": "Cilindrada", "transmission": "Transmissão", "color": "Cor", "enginePlateDetails": "Detalhes da placa do motor", "partNumber": "Número da peça", "type": "Tipo", "oem": "OEM", "oemAftermarketMix": "Mistura OEM e aftermarket", "aftermarket": "Aftermarket", "quantityAvailable": "Quantidade disponível", "fitsModels": "Modelos compatíveis" },
    "shipping": { "title": "Envio", "pickupOnly": "Apenas retirada", "freeShipping": "Frete grátis", "domestic": "Nacional:", "international": "Internacional:", "free": "Grátis", "shipsTo": "Envia para:", "delivery": "Entrega:", "businessDaysRange": "{min}-{max} dias úteis", "businessDaysMin": "{min}+ dias úteis", "businessDaysMax": "Até {max} dias úteis", "weightKg": "{weight} kg", "estimateCost": "Estimar custo de envio", "tracking": "Rastreamento", "trackPackage": "Rastrear pacote", "via": "via {carrier}" },
    "history": { "title": "Histórico de alterações", "showLess": "Mostrar menos", "showMore": "Mostrar mais {count}" },
    "sold": { "badge": "VENDIDO", "soldFor": "Vendido por" },
    "aboutInCurrency": "Cerca de {amount} em {currency}",
    "price": { "askingPrice": "Preço pedido", "exampleNotForSale": "Anúncio de exemplo — não está à venda" },
    "details": { "views": "{count} visualizações", "listingLocationFallback": "Localização do anúncio" },
    "heritage": { "certified": "Certificado de patrimônio" },
    "seller": { "label": "Vendedor", "altFallback": "Vendedor" },
    "actions": { "markSold": "Marcar como vendido", "delete": "Excluir", "editListing": "Editar anúncio", "manageListings": "Gerenciar anúncios", "messageSeller": "Enviar mensagem ao vendedor", "removeFromWatchlist": "Remover da lista de observação", "addToWatchlist": "Adicionar à lista de observação" },
    "dates": { "listed": "Publicado {date}", "updated": "· Atualizado {date}" },
    "confirm": { "markSold": { "title": "Marcar como vendido", "message": "Marcar este anúncio como vendido? Parabéns pela sua venda!", "confirm": "Marcar como vendido" }, "delete": { "title": "Excluir anúncio", "message": "Tem certeza de que deseja excluir este anúncio? Esta ação não pode ser desfeita.", "confirm": "Excluir" } },
    "notFound": { "title": "Anúncio não encontrado", "message": "O anúncio que você procura não existe ou foi removido.", "browseAll": "Explorar todos os anúncios" },
    "toast": { "approved": { "title": "Anúncio aprovado", "description": "Este anúncio agora está ativo e visível para todos os usuários." }, "approveError": "Falha ao aprovar o anúncio. Tente novamente.", "markedSold": { "title": "Anúncio marcado como vendido", "description": "Parabéns pela sua venda!" }, "markSoldError": "Falha ao marcar o anúncio como vendido. Tente novamente.", "deleted": { "title": "Anúncio excluído", "description": "Seu anúncio foi excluído permanentemente." }, "deleteError": "Falha ao excluir o anúncio. Tente novamente.", "error": { "title": "Erro" } }
  },
  "ru": {
    "adminPreview": { "intro": "Предпросмотр администратора — Это объявление имеет статус", "outro": "и недоступно для публики.", "approve": "Одобрить" },
    "exampleDisclaimer": "Это пример объявления в демонстрационных целях, оно не продаётся.",
    "backToListings": "Назад к объявлениям",
    "anonymous": "Аноним",
    "sections": { "description": "Описание", "specifications": "Характеристики", "location": "Местоположение" },
    "specs": { "mileage": "Пробег", "milesValue": "{miles} миль", "engineSize": "Объём двигателя", "transmission": "Коробка передач", "color": "Цвет", "enginePlateDetails": "Данные таблички двигателя", "partNumber": "Номер детали", "type": "Тип", "oem": "OEM", "oemAftermarketMix": "Смесь OEM и неоригинальных", "aftermarket": "Неоригинальная", "quantityAvailable": "Доступное количество", "fitsModels": "Подходящие модели" },
    "shipping": { "title": "Доставка", "pickupOnly": "Только самовывоз", "freeShipping": "Бесплатная доставка", "domestic": "По стране:", "international": "Международная:", "free": "Бесплатно", "shipsTo": "Доставка в:", "delivery": "Срок доставки:", "businessDaysRange": "{min}-{max} рабочих дней", "businessDaysMin": "{min}+ рабочих дней", "businessDaysMax": "До {max} рабочих дней", "weightKg": "{weight} кг", "estimateCost": "Оценить стоимость доставки", "tracking": "Отслеживание", "trackPackage": "Отследить посылку", "via": "через {carrier}" },
    "history": { "title": "История изменений", "showLess": "Показать меньше", "showMore": "Показать ещё {count}" },
    "sold": { "badge": "ПРОДАНО", "soldFor": "Продано за" },
    "aboutInCurrency": "Около {amount} в {currency}",
    "price": { "askingPrice": "Запрашиваемая цена", "exampleNotForSale": "Пример объявления — не для продажи" },
    "details": { "views": "{count} просмотров", "listingLocationFallback": "Местоположение объявления" },
    "heritage": { "certified": "Сертифицировано Heritage" },
    "seller": { "label": "Продавец", "altFallback": "Продавец" },
    "actions": { "markSold": "Отметить как проданное", "delete": "Удалить", "editListing": "Редактировать объявление", "manageListings": "Управление объявлениями", "messageSeller": "Написать продавцу", "removeFromWatchlist": "Удалить из списка отслеживания", "addToWatchlist": "Добавить в список отслеживания" },
    "dates": { "listed": "Опубликовано {date}", "updated": "· Обновлено {date}" },
    "confirm": { "markSold": { "title": "Отметить как проданное", "message": "Отметить это объявление как проданное? Поздравляем с продажей!", "confirm": "Отметить как проданное" }, "delete": { "title": "Удалить объявление", "message": "Вы уверены, что хотите удалить это объявление? Это действие нельзя отменить.", "confirm": "Удалить" } },
    "notFound": { "title": "Объявление не найдено", "message": "Объявление, которое вы ищете, не существует или было удалено.", "browseAll": "Просмотреть все объявления" },
    "toast": { "approved": { "title": "Объявление одобрено", "description": "Это объявление теперь активно и видно всем пользователям." }, "approveError": "Не удалось одобрить объявление. Попробуйте ещё раз.", "markedSold": { "title": "Объявление отмечено как проданное", "description": "Поздравляем с продажей!" }, "markSoldError": "Не удалось отметить объявление как проданное. Попробуйте ещё раз.", "deleted": { "title": "Объявление удалено", "description": "Ваше объявление было удалено навсегда." }, "deleteError": "Не удалось удалить объявление. Попробуйте ещё раз.", "error": { "title": "Ошибка" } }
  },
  "ja": {
    "adminPreview": { "intro": "管理者プレビュー — この出品は", "outro": "で、一般には公開されていません。", "approve": "承認" },
    "exampleDisclaimer": "これはデモ用のサンプル出品であり、販売対象ではありません。",
    "backToListings": "出品一覧に戻る",
    "anonymous": "匿名",
    "sections": { "description": "説明", "specifications": "仕様", "location": "場所" },
    "specs": { "mileage": "走行距離", "milesValue": "{miles} マイル", "engineSize": "エンジン排気量", "transmission": "トランスミッション", "color": "色", "enginePlateDetails": "エンジンプレート詳細", "partNumber": "部品番号", "type": "タイプ", "oem": "OEM", "oemAftermarketMix": "OEM・社外品の混合", "aftermarket": "社外品", "quantityAvailable": "在庫数", "fitsModels": "適合モデル" },
    "shipping": { "title": "配送", "pickupOnly": "引き取りのみ", "freeShipping": "送料無料", "domestic": "国内:", "international": "国際:", "free": "無料", "shipsTo": "発送先:", "delivery": "お届け:", "businessDaysRange": "{min}〜{max} 営業日", "businessDaysMin": "{min}+ 営業日", "businessDaysMax": "最大 {max} 営業日", "weightKg": "{weight} kg", "estimateCost": "送料を見積もる", "tracking": "追跡", "trackPackage": "荷物を追跡", "via": "{carrier} 経由" },
    "history": { "title": "変更履歴", "showLess": "表示を減らす", "showMore": "さらに {count} 件を表示" },
    "sold": { "badge": "売却済み", "soldFor": "販売価格" },
    "aboutInCurrency": "約 {amount}（{currency}）",
    "price": { "askingPrice": "希望価格", "exampleNotForSale": "サンプル出品 — 販売対象外" },
    "details": { "views": "{count} 回表示", "listingLocationFallback": "出品場所" },
    "heritage": { "certified": "ヘリテージ認定" },
    "seller": { "label": "出品者", "altFallback": "出品者" },
    "actions": { "markSold": "売却済みにする", "delete": "削除", "editListing": "出品を編集", "manageListings": "出品を管理", "messageSeller": "出品者にメッセージ", "removeFromWatchlist": "ウォッチリストから削除", "addToWatchlist": "ウォッチリストに追加" },
    "dates": { "listed": "{date} に出品", "updated": "· {date} に更新" },
    "confirm": { "markSold": { "title": "売却済みにする", "message": "この出品を売却済みにしますか？ ご成約おめでとうございます！", "confirm": "売却済みにする" }, "delete": { "title": "出品を削除", "message": "この出品を削除してもよろしいですか？ この操作は取り消せません。", "confirm": "削除" } },
    "notFound": { "title": "出品が見つかりません", "message": "お探しの出品は存在しないか、削除されました。", "browseAll": "すべての出品を見る" },
    "toast": { "approved": { "title": "出品を承認しました", "description": "この出品は有効になり、すべてのユーザーに表示されます。" }, "approveError": "出品の承認に失敗しました。もう一度お試しください。", "markedSold": { "title": "出品を売却済みにしました", "description": "ご成約おめでとうございます！" }, "markSoldError": "出品を売却済みにできませんでした。もう一度お試しください。", "deleted": { "title": "出品を削除しました", "description": "出品は完全に削除されました。" }, "deleteError": "出品の削除に失敗しました。もう一度お試しください。", "error": { "title": "エラー" } }
  },
  "zh": {
    "adminPreview": { "intro": "管理员预览 — 此刊登状态为", "outro": "，对公众不可见。", "approve": "批准" },
    "exampleDisclaimer": "这是用于演示的示例刊登，不出售。",
    "backToListings": "返回刊登列表",
    "anonymous": "匿名",
    "sections": { "description": "描述", "specifications": "规格", "location": "位置" },
    "specs": { "mileage": "里程", "milesValue": "{miles} 英里", "engineSize": "发动机排量", "transmission": "变速箱", "color": "颜色", "enginePlateDetails": "发动机铭牌详情", "partNumber": "零件编号", "type": "类型", "oem": "原厂", "oemAftermarketMix": "原厂与副厂混合", "aftermarket": "副厂", "quantityAvailable": "可用数量", "fitsModels": "适配车型" },
    "shipping": { "title": "配送", "pickupOnly": "仅自取", "freeShipping": "免运费", "domestic": "国内:", "international": "国际:", "free": "免费", "shipsTo": "配送至:", "delivery": "送达:", "businessDaysRange": "{min}-{max} 个工作日", "businessDaysMin": "{min}+ 个工作日", "businessDaysMax": "最多 {max} 个工作日", "weightKg": "{weight} 公斤", "estimateCost": "估算运费", "tracking": "物流追踪", "trackPackage": "追踪包裹", "via": "通过 {carrier}" },
    "history": { "title": "变更历史", "showLess": "收起", "showMore": "显示另外 {count} 条" },
    "sold": { "badge": "已售", "soldFor": "售出价" },
    "aboutInCurrency": "约 {amount}（{currency}）",
    "price": { "askingPrice": "要价", "exampleNotForSale": "示例刊登 — 不出售" },
    "details": { "views": "{count} 次浏览", "listingLocationFallback": "刊登位置" },
    "heritage": { "certified": "传承认证" },
    "seller": { "label": "卖家", "altFallback": "卖家" },
    "actions": { "markSold": "标记为已售", "delete": "删除", "editListing": "编辑刊登", "manageListings": "管理刊登", "messageSeller": "联系卖家", "removeFromWatchlist": "从关注列表移除", "addToWatchlist": "加入关注列表" },
    "dates": { "listed": "发布于 {date}", "updated": "· 更新于 {date}" },
    "confirm": { "markSold": { "title": "标记为已售", "message": "将此刊登标记为已售？恭喜成交！", "confirm": "标记为已售" }, "delete": { "title": "删除刊登", "message": "确定要删除此刊登吗？此操作无法撤销。", "confirm": "删除" } },
    "notFound": { "title": "未找到刊登", "message": "您查找的刊登不存在或已被移除。", "browseAll": "浏览所有刊登" },
    "toast": { "approved": { "title": "刊登已批准", "description": "此刊登现已生效，对所有用户可见。" }, "approveError": "批准刊登失败。请重试。", "markedSold": { "title": "刊登已标记为已售", "description": "恭喜成交！" }, "markSoldError": "无法将刊登标记为已售。请重试。", "deleted": { "title": "刊登已删除", "description": "您的刊登已被永久删除。" }, "deleteError": "删除刊登失败。请重试。", "error": { "title": "错误" } }
  },
  "ko": {
    "adminPreview": { "intro": "관리자 미리보기 — 이 매물의 상태는", "outro": "이며 공개되지 않습니다.", "approve": "승인" },
    "exampleDisclaimer": "이것은 시연용 예시 매물이며 판매 대상이 아닙니다.",
    "backToListings": "매물 목록으로 돌아가기",
    "anonymous": "익명",
    "sections": { "description": "설명", "specifications": "사양", "location": "위치" },
    "specs": { "mileage": "주행거리", "milesValue": "{miles} 마일", "engineSize": "엔진 배기량", "transmission": "변속기", "color": "색상", "enginePlateDetails": "엔진 플레이트 정보", "partNumber": "부품 번호", "type": "유형", "oem": "OEM", "oemAftermarketMix": "OEM 및 애프터마켓 혼합", "aftermarket": "애프터마켓", "quantityAvailable": "재고 수량", "fitsModels": "호환 모델" },
    "shipping": { "title": "배송", "pickupOnly": "직접 수령만", "freeShipping": "무료 배송", "domestic": "국내:", "international": "국제:", "free": "무료", "shipsTo": "배송 지역:", "delivery": "배송:", "businessDaysRange": "영업일 {min}~{max}일", "businessDaysMin": "영업일 {min}일 이상", "businessDaysMax": "최대 영업일 {max}일", "weightKg": "{weight} kg", "estimateCost": "배송비 견적", "tracking": "배송 조회", "trackPackage": "패키지 추적", "via": "{carrier} 경유" },
    "history": { "title": "변경 내역", "showLess": "간략히 보기", "showMore": "{count}개 더 보기" },
    "sold": { "badge": "판매됨", "soldFor": "판매가" },
    "aboutInCurrency": "약 {amount} ({currency})",
    "price": { "askingPrice": "희망 가격", "exampleNotForSale": "예시 매물 — 판매 대상 아님" },
    "details": { "views": "조회수 {count}회", "listingLocationFallback": "매물 위치" },
    "heritage": { "certified": "헤리티지 인증" },
    "seller": { "label": "판매자", "altFallback": "판매자" },
    "actions": { "markSold": "판매됨으로 표시", "delete": "삭제", "editListing": "매물 편집", "manageListings": "매물 관리", "messageSeller": "판매자에게 메시지", "removeFromWatchlist": "관심 목록에서 제거", "addToWatchlist": "관심 목록에 추가" },
    "dates": { "listed": "{date} 등록", "updated": "· {date} 업데이트" },
    "confirm": { "markSold": { "title": "판매됨으로 표시", "message": "이 매물을 판매됨으로 표시할까요? 판매를 축하합니다!", "confirm": "판매됨으로 표시" }, "delete": { "title": "매물 삭제", "message": "이 매물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.", "confirm": "삭제" } },
    "notFound": { "title": "매물을 찾을 수 없습니다", "message": "찾으시는 매물이 존재하지 않거나 삭제되었습니다.", "browseAll": "모든 매물 둘러보기" },
    "toast": { "approved": { "title": "매물 승인됨", "description": "이 매물은 이제 활성화되어 모든 사용자에게 표시됩니다." }, "approveError": "매물 승인에 실패했습니다. 다시 시도해 주세요.", "markedSold": { "title": "매물이 판매됨으로 표시됨", "description": "판매를 축하합니다!" }, "markSoldError": "매물을 판매됨으로 표시하지 못했습니다. 다시 시도해 주세요.", "deleted": { "title": "매물 삭제됨", "description": "매물이 영구적으로 삭제되었습니다." }, "deleteError": "매물 삭제에 실패했습니다. 다시 시도해 주세요.", "error": { "title": "오류" } }
  }
}
</i18n>
