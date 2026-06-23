<template>
  <div v-if="listing">
    <!-- Page Header -->
    <section class="bg-base-100 border-b border-base-300 py-12">
      <div class="container">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-4xl font-bold mb-2">{{ t('pageHeading') }}</h1>
            <p class="text-base-content/70">{{ listing.title }}</p>
          </div>
          <NuxtLink :to="`/exchange/listings/${listing.slug}`" class="btn btn-ghost">
            <i class="fas fa-arrow-left"></i>
            {{ t('backToListing') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Form Section -->
    <section class="py-12">
      <div class="container">
        <div class="max-w-3xl mx-auto">
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body">
              <form @submit.prevent="handleSubmit" class="space-y-8">
                <!-- Basic Information -->
                <div>
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-2xl font-semibold">{{ t('basicInfo') }}</h2>
                  </div>

                  <div class="space-y-4">
                    <!-- Category Display (read-only) -->
                    <fieldset class="fieldset">
                      <legend class="fieldset-legend text-base">{{ t('listingCategory') }}</legend>
                      <div class="text-base">
                        <strong class="capitalize">{{ listing.listing_category }}</strong>
                        <span v-if="listing.parts_subcategory" class="ml-2">
                          - {{ formatSubcategory(listing.parts_subcategory) }}
                        </span>
                        <p class="text-sm text-base-content/60 mt-1">{{ t('categoryLocked') }}</p>
                      </div>
                    </fieldset>

                    <fieldset class="fieldset" data-field="title">
                      <legend class="fieldset-legend text-base">{{ t('fields.title') }}</legend>
                      <input
                        v-model="form.title"
                        type="text"
                        class="input input-lg w-full"
                        :class="{ 'input-error': errors.title }"
                      />
                      <p v-if="errors.title" class="text-error text-sm mt-1">{{ errors.title }}</p>
                    </fieldset>

                    <!-- Vehicle/Engine: Year and Model -->
                    <div v-if="isVehicleOrEngine">
                      <div class="grid md:grid-cols-2 gap-4">
                        <fieldset class="fieldset" data-field="year">
                          <legend class="fieldset-legend text-base">
                            {{ listing.listing_category === 'vehicle' ? t('fields.year') : t('fields.yearOptional') }}
                          </legend>
                          <input
                            v-model.number="form.year"
                            type="number"
                            min="1959"
                            max="2000"
                            class="input w-full"
                            :class="{ 'input-error': errors.year }"
                          />
                          <p v-if="errors.year" class="text-error text-sm mt-1">{{ errors.year }}</p>
                        </fieldset>

                        <!-- Manufacturer (Vehicles only) -->
                        <fieldset
                          v-if="listing.listing_category === 'vehicle'"
                          class="fieldset"
                          data-field="manufacturer"
                        >
                          <legend class="fieldset-legend text-base">{{ t('fields.manufacturer') }}</legend>
                          <select
                            v-model="form.manufacturer"
                            class="select w-full"
                            :class="{ 'select-error': errors.manufacturer }"
                          >
                            <option value="">{{ t('manufacturerOptions.placeholder') }}</option>
                            <option value="morris">{{ t('manufacturerOptions.morris') }}</option>
                            <option value="austin">{{ t('manufacturerOptions.austin') }}</option>
                            <option value="rover">{{ t('manufacturerOptions.rover') }}</option>
                            <option value="leyland">{{ t('manufacturerOptions.leyland') }}</option>
                            <option value="innocenti">{{ t('manufacturerOptions.innocenti') }}</option>
                            <option value="wolseley">{{ t('manufacturerOptions.wolseley') }}</option>
                            <option value="riley">{{ t('manufacturerOptions.riley') }}</option>
                            <option value="other">{{ t('manufacturerOptions.other') }}</option>
                          </select>
                          <p v-if="errors.manufacturer" class="text-error text-sm mt-1">{{ errors.manufacturer }}</p>
                        </fieldset>
                      </div>

                      <div class="grid md:grid-cols-2 gap-4 mt-4">
                        <fieldset class="fieldset" data-field="model">
                          <legend class="fieldset-legend text-base">
                            {{ listing.listing_category === 'vehicle' ? t('fields.model') : t('fields.modelOptional') }}
                          </legend>
                          <select v-model="form.model" class="select w-full" :class="{ 'select-error': errors.model }">
                            <option value="" disabled>{{ t('modelPlaceholder') }}</option>
                            <option v-for="option in modelOptions" :key="option.value" :value="option.value">
                              {{ option.label }}
                            </option>
                          </select>
                          <p v-if="errors.model" class="text-error text-sm mt-1">{{ errors.model }}</p>
                        </fieldset>
                      </div>
                    </div>

                    <!-- Parts: Part Number and Condition -->
                    <div v-if="isPartsCategory" class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.partNumber') }}</legend>
                        <input
                          v-model="form.part_number"
                          type="text"
                          :placeholder="t('placeholders.partNumber')"
                          class="input w-full"
                        />
                      </fieldset>

                      <fieldset class="fieldset" data-field="part_condition">
                        <legend class="fieldset-legend text-base">{{ t('fields.partCondition') }}</legend>
                        <select
                          v-model="form.part_condition"
                          class="select w-full"
                          :class="{ 'select-error': errors.part_condition }"
                        >
                          <option value="">{{ t('partConditionOptions.placeholder') }}</option>
                          <option value="new">{{ t('partConditionOptions.new') }}</option>
                          <option value="used_excellent">{{ t('partConditionOptions.usedExcellent') }}</option>
                          <option value="used_good">{{ t('partConditionOptions.usedGood') }}</option>
                          <option value="used_fair">{{ t('partConditionOptions.usedFair') }}</option>
                          <option value="rebuild">{{ t('partConditionOptions.rebuild') }}</option>
                          <option value="core">{{ t('partConditionOptions.core') }}</option>
                        </select>
                        <p v-if="errors.part_condition" class="text-error text-sm mt-1">{{ errors.part_condition }}</p>
                      </fieldset>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset" data-field="price">
                        <legend class="fieldset-legend text-base">{{ t('fields.price') }}</legend>
                        <label class="label cursor-pointer justify-start gap-3 mb-2">
                          <input
                            type="checkbox"
                            class="toggle toggle-primary"
                            :checked="isEditFree"
                            @change="toggleEditFree"
                          />
                          <span class="label-text font-medium">{{ t('itemIsFree') }}</span>
                        </label>
                        <label v-if="!isEditFree" class="input" :class="{ 'input-error': errors.price }">
                          <span class="text-base-content/50">$</span>
                          <input v-model.number="form.price" type="number" step="0.01" class="grow" />
                        </label>
                        <p v-if="isEditFree" class="text-sm text-success mt-1">
                          {{ t('freeHelp') }}
                        </p>
                        <p v-if="errors.price" class="text-error text-sm mt-1">{{ errors.price }}</p>
                      </fieldset>

                      <fieldset v-if="!isPartsCategory" class="fieldset" data-field="condition">
                        <legend class="fieldset-legend text-base">{{ t('fields.condition') }}</legend>
                        <select
                          v-model="form.condition"
                          class="select w-full"
                          :class="{ 'select-error': errors.condition }"
                        >
                          <option value="">{{ t('conditionOptions.placeholder') }}</option>
                          <option value="new">{{ t('conditionOptions.new') }}</option>
                          <option value="used">{{ t('conditionOptions.used') }}</option>
                          <option value="project">{{ t('conditionOptions.project') }}</option>
                          <option value="scrap">{{ t('conditionOptions.scrap') }}</option>
                        </select>
                        <p v-if="errors.condition" class="text-error text-sm mt-1">{{ errors.condition }}</p>
                      </fieldset>

                      <fieldset v-if="isPartsCategory" class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.quantityAvailable') }}</legend>
                        <input v-model.number="form.quantity_available" type="number" min="1" class="input w-full" />
                      </fieldset>
                    </div>

                    <!-- Parts: Additional Info -->
                    <div v-if="isPartsCategory" class="space-y-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.fitsModels') }}</legend>
                        <input
                          v-model="fitsModelsInput"
                          type="text"
                          :placeholder="t('placeholders.fitsModels')"
                          class="input w-full"
                        />
                        <p class="label text-base-content/50 text-sm">
                          {{ t('help.fitsModels') }}
                        </p>
                      </fieldset>

                      <div class="grid md:grid-cols-2 gap-4">
                        <fieldset class="fieldset">
                          <legend class="fieldset-legend text-base">{{ t('fields.partType') }}</legend>
                          <select v-model="form.oem_or_aftermarket" class="select w-full">
                            <option value="">{{ t('partTypeOptions.placeholder') }}</option>
                            <option value="oem">{{ t('partTypeOptions.oem') }}</option>
                            <option value="aftermarket">{{ t('partTypeOptions.aftermarket') }}</option>
                            <option value="reproduction">{{ t('partTypeOptions.reproduction') }}</option>
                          </select>
                        </fieldset>

                        <div class="flex flex-col gap-2 pt-8">
                          <label class="label cursor-pointer justify-start gap-3">
                            <input v-model="form.shipping_available" type="checkbox" class="checkbox" />
                            <span class="label-text">{{ t('fields.shippingAvailable') }}</span>
                          </label>
                        </div>
                      </div>

                      <fieldset v-if="form.shipping_available" class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.shippingCost') }}</legend>
                        <label class="input">
                          <span class="text-base-content/50">$</span>
                          <input
                            v-model.number="form.shipping_cost"
                            type="number"
                            step="0.01"
                            placeholder="15.00"
                            class="grow"
                          />
                        </label>
                        <p class="label text-base-content/50 text-sm">
                          {{ t('help.shippingCost') }}
                        </p>
                      </fieldset>
                    </div>

                    <!-- Color (for vehicles) -->
                    <fieldset v-if="isVehicleOrEngine" class="fieldset" data-field="color">
                      <legend class="fieldset-legend text-base">{{ t('fields.color') }}</legend>
                      <input
                        v-model="form.color"
                        type="text"
                        :placeholder="t('placeholders.color')"
                        class="input w-full"
                        :class="{ 'input-error': errors.color }"
                      />
                      <p v-if="errors.color" class="text-error text-sm mt-1">{{ errors.color }}</p>
                    </fieldset>

                    <div data-field="city">
                      <h3 class="fieldset-legend text-base mb-2">{{ t('fields.location') }}</h3>
                      <ExchangeListingsLocationAutocomplete v-model="locationData" :error="errors.city" />
                    </div>
                  </div>
                </div>

                <!-- Description -->
                <div>
                  <h2 class="text-2xl font-semibold mb-4">{{ t('descriptionHeading') }}</h2>
                  <fieldset class="fieldset" data-field="description">
                    <legend class="fieldset-legend text-base">{{ t('fields.description') }}</legend>
                    <textarea
                      v-model="form.description"
                      rows="8"
                      class="textarea textarea-lg w-full"
                      :class="{ 'textarea-error': errors.description }"
                    ></textarea>
                    <p v-if="errors.description" class="text-error text-sm mt-1">{{ errors.description }}</p>
                  </fieldset>
                </div>

                <!-- Specifications (Vehicle/Engine Only) -->
                <div v-if="isVehicleOrEngine">
                  <h2 class="text-2xl font-semibold mb-4">
                    {{ listing.listing_category === 'vehicle' ? t('specsHeading') : t('engineSpecsHeading') }}
                  </h2>
                  <div class="space-y-4">
                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset" data-field="mileage">
                        <legend class="fieldset-legend text-base">{{ t('fields.mileage') }}</legend>
                        <input
                          v-model.number="form.mileage"
                          type="number"
                          class="input w-full"
                          :class="{ 'input-error': errors.mileage }"
                        />
                        <p v-if="errors.mileage" class="text-error text-sm mt-1">{{ errors.mileage }}</p>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.engineSize') }}</legend>
                        <input
                          v-model="form.engine_size"
                          type="text"
                          :placeholder="t('placeholders.engineSize')"
                          class="input w-full"
                        />
                      </fieldset>
                    </div>
                  </div>
                </div>

                <!-- Heritage & Provenance (Vehicle Only) -->
                <div v-if="listing.listing_category === 'vehicle'">
                  <h2 class="text-2xl font-semibold mb-4">{{ t('heritageHeading') }}</h2>
                  <p class="text-base-content/70 mb-6">
                    {{ t('heritageIntro') }}
                  </p>

                  <div class="space-y-4">
                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.vinNumber') }}</legend>
                        <input
                          v-model="form.vin_number"
                          type="text"
                          :placeholder="t('placeholders.vinNumber')"
                          class="input w-full"
                        />
                        <p class="label text-base-content/50 text-sm">{{ t('help.vinNumber') }}</p>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.chassisNumber') }}</legend>
                        <input
                          v-model="form.chassis_number"
                          type="text"
                          :placeholder="t('placeholders.chassisNumber')"
                          class="input w-full"
                        />
                        <p class="label text-base-content/50 text-sm">{{ t('help.chassisNumber') }}</p>
                      </fieldset>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.buildDate') }}</legend>
                        <input
                          v-model="form.build_date"
                          type="text"
                          class="input w-full"
                          :placeholder="t('placeholders.buildDate')"
                        />
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.originalColor') }}</legend>
                        <input
                          v-model="form.original_color"
                          type="text"
                          :placeholder="t('placeholders.originalColor')"
                          class="input w-full"
                        />
                      </fieldset>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.previousOwners') }}</legend>
                        <input
                          v-model.number="form.previous_owners_count"
                          type="number"
                          min="0"
                          :placeholder="t('placeholders.previousOwners')"
                          class="input w-full"
                        />
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.restorationStatus') }}</legend>
                        <select v-model="form.restoration_status" class="select w-full">
                          <option value="">{{ t('restorationStatusPlaceholder') }}</option>
                          <option v-for="status in RESTORATION_STATUS" :key="status.value" :value="status.value">
                            {{ status.label }}
                          </option>
                        </select>
                      </fieldset>
                    </div>

                    <fieldset v-if="form.restoration_status && form.restoration_status !== 'original'" class="fieldset">
                      <legend class="fieldset-legend text-base">{{ t('fields.lastRestorationDate') }}</legend>
                      <input
                        v-model="form.last_restoration_date"
                        type="text"
                        class="input w-full"
                        :placeholder="t('placeholders.lastRestorationDate')"
                      />
                    </fieldset>

                    <div class="grid md:grid-cols-3 gap-4">
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.has_heritage_cert" type="checkbox" class="checkbox" />
                        <span class="label-text">{{ t('fields.heritageCert') }}</span>
                      </label>

                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.matching_numbers" type="checkbox" class="checkbox" />
                        <span class="label-text">{{ t('fields.matchingNumbers') }}</span>
                      </label>

                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.has_service_history" type="checkbox" class="checkbox" />
                        <span class="label-text">{{ t('fields.serviceHistory') }}</span>
                      </label>
                    </div>

                    <fieldset v-if="form.has_heritage_cert" class="fieldset">
                      <legend class="fieldset-legend text-base">{{ t('fields.heritageCertNumber') }}</legend>
                      <input
                        v-model="form.heritage_cert_number"
                        type="text"
                        :placeholder="t('placeholders.heritageCertNumber')"
                        class="input w-full"
                      />
                      <p class="label text-base-content/50 text-sm">{{ t('help.heritageCertNumber') }}</p>
                    </fieldset>

                    <fieldset v-if="form.has_heritage_cert" class="fieldset">
                      <legend class="fieldset-legend text-base">{{ t('fields.heritageCertDetails') }}</legend>
                      <textarea
                        v-model="form.heritage_cert_details"
                        rows="3"
                        :placeholder="t('placeholders.heritageCertDetails')"
                        class="textarea w-full"
                      ></textarea>
                    </fieldset>

                    <fieldset v-if="form.restoration_status && form.restoration_status !== 'original'" class="fieldset">
                      <legend class="fieldset-legend text-base">{{ t('fields.restorationDetails') }}</legend>
                      <textarea
                        v-model="form.restoration_details"
                        rows="4"
                        :placeholder="t('placeholders.restorationDetails')"
                        class="textarea w-full"
                      ></textarea>
                      <p class="label text-base-content/50 text-sm">
                        {{ t('help.restorationDetails') }}
                      </p>
                    </fieldset>
                  </div>
                </div>

                <!-- Detailed Specifications (Vehicle Only) -->
                <div v-if="listing.listing_category === 'vehicle'">
                  <h2 class="text-2xl font-semibold mb-4">{{ t('detailedSpecsHeading') }}</h2>
                  <p class="text-base-content/70 mb-6">
                    {{ t('detailedSpecsIntro') }}
                  </p>

                  <!-- Engine & Mechanical -->
                  <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                      <i class="fas fa-gear"></i>
                      {{ t('engineMechanical') }}
                    </h3>

                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.engineNumber') }}</legend>
                        <input
                          v-model="form.engine_number"
                          type="text"
                          :placeholder="t('placeholders.engineNumber')"
                          class="input w-full"
                        />
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.gearboxType') }}</legend>
                        <select v-model="form.gearbox_type" class="select w-full">
                          <option value="">{{ t('gearboxPlaceholder') }}</option>
                          <option v-for="option in GEARBOX_TYPES" :key="option.value" :value="option.value">
                            {{ option.label }}
                          </option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.carbType') }}</legend>
                        <select v-model="form.carb_type" class="select w-full">
                          <option value="">{{ t('carbTypeOptions.placeholder') }}</option>
                          <option value="single_su">{{ t('carbTypeOptions.singleSu') }}</option>
                          <option value="twin_su">{{ t('carbTypeOptions.twinSu') }}</option>
                          <option value="weber">{{ t('carbTypeOptions.weber') }}</option>
                          <option value="stromberg">{{ t('carbTypeOptions.stromberg') }}</option>
                          <option value="fuel_injection">{{ t('carbTypeOptions.fuelInjection') }}</option>
                          <option value="other">{{ t('carbTypeOptions.other') }}</option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.exhaustType') }}</legend>
                        <select v-model="form.exhaust_type" class="select w-full">
                          <option value="">{{ t('selectTypePlaceholder') }}</option>
                          <option v-for="type in EXHAUST_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.brakeType') }}</legend>
                        <select v-model="form.brake_type" class="select w-full">
                          <option value="">{{ t('brakeTypeOptions.placeholder') }}</option>
                          <option value="standard_drum">{{ t('brakeTypeOptions.standardDrum') }}</option>
                          <option value="disc_front">{{ t('brakeTypeOptions.discFront') }}</option>
                          <option value="four_wheel_disc">{{ t('brakeTypeOptions.fourWheelDisc') }}</option>
                        </select>
                      </fieldset>
                    </div>
                  </div>

                  <!-- Exterior & Body -->
                  <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                      <i class="fas fa-paintbrush"></i>
                      {{ t('exteriorBody') }}
                    </h3>

                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.roofColor') }}</legend>
                        <input
                          v-model="form.roof_color"
                          type="text"
                          :placeholder="t('placeholders.roofColor')"
                          class="input w-full"
                        />
                      </fieldset>

                      <fieldset v-if="form.has_stripes" class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.stripeColor') }}</legend>
                        <input
                          v-model="form.stripe_color"
                          type="text"
                          :placeholder="t('placeholders.stripeColor')"
                          class="input w-full"
                        />
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.wheelSize') }}</legend>
                        <select v-model="form.wheel_size" class="select w-full">
                          <option value="">{{ t('selectSizePlaceholder') }}</option>
                          <option v-for="size in WHEEL_SIZES" :key="size.value" :value="size.value">
                            {{ size.label }}
                          </option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.wheelType') }}</legend>
                        <select v-model="form.wheel_type" class="select w-full">
                          <option value="">{{ t('selectTypePlaceholder') }}</option>
                          <option v-for="type in WHEEL_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.bumperType') }}</legend>
                        <select v-model="form.bumper_type" class="select w-full">
                          <option value="">{{ t('selectTypePlaceholder') }}</option>
                          <option v-for="type in BUMPER_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.windowType') }}</legend>
                        <select v-model="form.window_type" class="select w-full">
                          <option value="">{{ t('selectTypePlaceholder') }}</option>
                          <option v-for="type in WINDOW_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </fieldset>
                    </div>

                    <!-- Checkboxes -->
                    <div class="grid md:grid-cols-2 gap-4 mt-4">
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.has_stripes" type="checkbox" class="checkbox" />
                        <span class="label-text">{{ t('fields.hasStripes') }}</span>
                      </label>

                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.has_sunroof" type="checkbox" class="checkbox" />
                        <span class="label-text">{{ t('fields.hasSunroof') }}</span>
                      </label>
                    </div>
                  </div>

                  <!-- Interior -->
                  <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                      <i class="fas fa-table-cells-large"></i>
                      {{ t('interior') }}
                    </h3>

                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.seatType') }}</legend>
                        <select v-model="form.seat_type" class="select w-full">
                          <option value="">{{ t('selectTypePlaceholder') }}</option>
                          <option v-for="type in SEAT_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.interiorColor') }}</legend>
                        <input
                          v-model="form.interior_color"
                          type="text"
                          :placeholder="t('placeholders.interiorColor')"
                          class="input w-full"
                        />
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.dashboardType') }}</legend>
                        <select v-model="form.dashboard_type" class="select w-full">
                          <option value="">{{ t('selectTypePlaceholder') }}</option>
                          <option v-for="type in DASHBOARD_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.steeringWheelType') }}</legend>
                        <select v-model="form.steering_wheel_type" class="select w-full">
                          <option value="">{{ t('selectTypePlaceholder') }}</option>
                          <option v-for="type in STEERING_WHEEL_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                      </fieldset>
                    </div>
                  </div>
                </div>

                <!-- Modifications & Condition (Vehicle Only) -->
                <div v-if="listing.listing_category === 'vehicle'">
                  <h2 class="text-2xl font-semibold mb-4">{{ t('modsHeading') }}</h2>
                  <p class="text-base-content/70 mb-6">{{ t('modsIntro') }}</p>

                  <!-- Factory Options -->
                  <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                      <i class="fas fa-gear"></i>
                      {{ t('factoryOptions') }}
                    </h3>
                    <div class="grid md:grid-cols-2 gap-3">
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.factory_options" type="checkbox" value="hydrolastic" class="checkbox" />
                        <span class="label-text">{{ t('factoryOptionLabels.hydrolastic') }}</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input
                          v-model="form.factory_options"
                          type="checkbox"
                          value="heated_rear_window"
                          class="checkbox"
                        />
                        <span class="label-text">{{ t('factoryOptionLabels.heatedRearWindow') }}</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.factory_options" type="checkbox" value="servo_brakes" class="checkbox" />
                        <span class="label-text">{{ t('factoryOptionLabels.servoBrakes') }}</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.factory_options" type="checkbox" value="radio" class="checkbox" />
                        <span class="label-text">{{ t('factoryOptionLabels.radio') }}</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.factory_options" type="checkbox" value="fog_lights" class="checkbox" />
                        <span class="label-text">{{ t('factoryOptionLabels.fogLights') }}</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.factory_options" type="checkbox" value="wood_dash" class="checkbox" />
                        <span class="label-text">{{ t('factoryOptionLabels.woodDash') }}</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input
                          v-model="form.factory_options"
                          type="checkbox"
                          value="reclining_seats"
                          class="checkbox"
                        />
                        <span class="label-text">{{ t('factoryOptionLabels.recliningSeats') }}</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.factory_options" type="checkbox" value="center_console" class="checkbox" />
                        <span class="label-text">{{ t('factoryOptionLabels.centerConsole') }}</span>
                      </label>
                    </div>
                  </div>

                  <!-- Modifications -->
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
                      <i class="fas fa-screwdriver-wrench"></i>
                      {{ t('modifications') }}
                    </h3>

                    <div class="space-y-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.engineMods') }}</legend>
                        <textarea
                          v-model="form.engine_mods"
                          rows="3"
                          :placeholder="t('placeholders.engineMods')"
                          class="textarea w-full"
                        ></textarea>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.suspensionMods') }}</legend>
                        <textarea
                          v-model="form.suspension_mods"
                          rows="3"
                          :placeholder="t('placeholders.suspensionMods')"
                          class="textarea w-full"
                        ></textarea>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.performanceUpgrades') }}</legend>
                        <textarea
                          v-model="form.performance_upgrades"
                          rows="3"
                          :placeholder="t('placeholders.performanceUpgrades')"
                          class="textarea w-full"
                        ></textarea>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.otherModifications') }}</legend>
                        <textarea
                          v-model="form.other_modifications"
                          rows="3"
                          :placeholder="t('placeholders.otherModifications')"
                          class="textarea w-full"
                        ></textarea>
                      </fieldset>
                    </div>
                  </div>

                  <!-- Condition Assessment -->
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
                      <i class="fas fa-clipboard-check"></i>
                      {{ t('conditionAssessment') }}
                    </h3>

                    <div class="grid md:grid-cols-2 gap-4">
                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.rustCondition') }}</legend>
                        <select v-model="form.rust_condition" class="select w-full">
                          <option value="">{{ t('conditionSelectPlaceholder') }}</option>
                          <option value="none_visible">{{ t('rustConditionOptions.noneVisible') }}</option>
                          <option value="minor_surface">{{ t('rustConditionOptions.minorSurface') }}</option>
                          <option value="moderate">{{ t('rustConditionOptions.moderate') }}</option>
                          <option value="significant">{{ t('rustConditionOptions.significant') }}</option>
                        </select>
                      </fieldset>

                      <fieldset class="fieldset">
                        <legend class="fieldset-legend text-base">{{ t('fields.undersideCondition') }}</legend>
                        <select v-model="form.underside_condition" class="select w-full">
                          <option value="">{{ t('conditionSelectPlaceholder') }}</option>
                          <option value="excellent">{{ t('undersideConditionOptions.excellent') }}</option>
                          <option value="good">{{ t('undersideConditionOptions.good') }}</option>
                          <option value="fair">{{ t('undersideConditionOptions.fair') }}</option>
                          <option value="needs_work">{{ t('undersideConditionOptions.needsWork') }}</option>
                        </select>
                      </fieldset>
                    </div>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 justify-end pt-4 border-t">
                  <NuxtLink :to="`/exchange/listings/${listing.slug}`" class="btn btn-ghost"> {{ t('cancel') }} </NuxtLink>
                  <button type="submit" :disabled="isSubmitting" class="btn btn-primary">
                    <i v-if="isSubmitting" class="fas fa-arrows-rotate animate-spin"></i>
                    <span v-else>{{ t('saveChanges') }}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
  <div v-else class="container py-12">
    <div class="flex justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    MODEL_OPTIONS,
    GEARBOX_TYPES,
    RESTORATION_STATUS,
    WHEEL_SIZES,
    WHEEL_TYPES,
    BUMPER_TYPES,
    WINDOW_TYPES,
    EXHAUST_TYPES,
    SEAT_TYPES,
    DASHBOARD_TYPES,
    STEERING_WHEEL_TYPES,
  } from '~/utils/miniSpecs';

  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  const route = useRoute();
  const router = useRouter();
  const { fetchListingBySlug } = useListings();
  const toast = useToast();

  const slug = computed(() => route.params.slug as string);

  // Format subcategory for display (defined before async operations)
  const formatSubcategory = (subcategory: string) => {
    return subcategory
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Model options - use shared constant from miniSpecs
  const modelOptions = MODEL_OPTIONS;

  // Fetch listing data
  const { data: listing, error: listingError } = await useAsyncData(`listing-${slug.value}`, () =>
    fetchListingBySlug(slug.value)
  );

  if (listingError.value || !listing.value) {
    throw createError({
      statusCode: 404,
      statusMessage: t('errors.notFound'),
    });
  }

  // Check if user owns this listing - runs on both server and client
  // Use Supabase's getUser() which works with session cookies on both environments
  const supabase = useSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser || listing.value.user_id !== authUser.id) {
    throw createError({
      statusCode: 403,
      statusMessage: t('errors.forbidden'),
    });
  }

  // Category helpers
  const isVehicleOrEngine = computed(() => ['vehicle', 'engine'].includes(listing.value?.listing_category || ''));
  const isPartsCategory = computed(() => listing.value?.listing_category === 'parts');

  // Free listing toggle
  const isEditFree = computed(() => form.price === 0);

  const toggleEditFree = (event: Event) => {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      form.price = 0;
    } else {
      form.price = null;
    }
  };

  // Form state - initialize with current listing data
  const form = reactive({
    title: listing.value.title,
    year: listing.value.year,
    manufacturer: listing.value.manufacturer || '',
    model: listing.value.model,
    price: listing.value.price,
    condition: listing.value.condition,
    description: listing.value.description,
    mileage: listing.value.mileage,
    engine_size: listing.value.engine_size,
    color: listing.value.color,
    // Heritage & Provenance fields (vehicle only)
    vin_number: listing.value.vin_number || '',
    chassis_number: listing.value.chassis_number || '',
    build_date: listing.value.build_date || '',
    original_color: listing.value.original_color || '',
    previous_owners_count: listing.value.previous_owners_count ?? null,
    restoration_status: listing.value.restoration_status || '',
    last_restoration_date: listing.value.last_restoration_date || '',
    has_heritage_cert: listing.value.has_heritage_cert ?? false,
    matching_numbers: listing.value.matching_numbers ?? false,
    has_service_history: listing.value.has_service_history ?? false,
    heritage_cert_number: listing.value.heritage_cert_number || '',
    heritage_cert_details: listing.value.heritage_cert_details || '',
    restoration_details: listing.value.restoration_details || '',
    // Detailed Specifications (vehicle only)
    engine_number: listing.value.engine_number || '',
    gearbox_type: listing.value.gearbox_type || '',
    carb_type: listing.value.carb_type || '',
    exhaust_type: listing.value.exhaust_type || '',
    brake_type: listing.value.brake_type || '',
    roof_color: listing.value.roof_color || '',
    has_stripes: listing.value.has_stripes ?? false,
    stripe_color: listing.value.stripe_color || '',
    wheel_size: listing.value.wheel_size || '',
    wheel_type: listing.value.wheel_type || '',
    bumper_type: listing.value.bumper_type || '',
    window_type: listing.value.window_type || '',
    has_sunroof: listing.value.has_sunroof ?? false,
    seat_type: listing.value.seat_type || '',
    interior_color: listing.value.interior_color || '',
    dashboard_type: listing.value.dashboard_type || '',
    steering_wheel_type: listing.value.steering_wheel_type || '',
    // Modifications & Condition (vehicle only)
    factory_options: listing.value.factory_options || [],
    engine_mods: listing.value.engine_mods || '',
    suspension_mods: listing.value.suspension_mods || '',
    performance_upgrades: listing.value.performance_upgrades || '',
    other_modifications: listing.value.other_modifications || '',
    rust_condition: listing.value.rust_condition || '',
    underside_condition: listing.value.underside_condition || '',
    // Parts-specific fields
    part_number: listing.value.part_number || '',
    part_condition: listing.value.part_condition || '',
    quantity_available: listing.value.quantity_available || 1,
    oem_or_aftermarket: listing.value.oem_or_aftermarket || '',
    shipping_available: listing.value.shipping_available ?? true,
    shipping_cost: listing.value.shipping_cost || null,
    // Location fields (with geocoding)
    city: listing.value.city || '',
    state_province: listing.value.state_province || '',
    country: listing.value.country || 'United States',
    postal_code: listing.value.postal_code || '',
    latitude: listing.value.latitude ?? null,
    longitude: listing.value.longitude ?? null,
    formatted_address: listing.value.formatted_address || listing.value.location || '',
  });

  // Fits models input (for parts)
  const fitsModelsInput = ref(Array.isArray(listing.value.fits_models) ? listing.value.fits_models.join(', ') : '');

  // Computed property to bridge location data between form and LocationAutocomplete component
  const locationData = computed({
    get: () => ({
      city: form.city,
      state_province: form.state_province,
      country: form.country,
      postal_code: form.postal_code,
      latitude: form.latitude,
      longitude: form.longitude,
      formatted_address: form.formatted_address,
    }),
    set: (value) => {
      form.city = value.city;
      form.state_province = value.state_province;
      form.country = value.country;
      form.postal_code = value.postal_code;
      form.latitude = value.latitude;
      form.longitude = value.longitude;
      form.formatted_address = value.formatted_address;
    },
  });

  const isSubmitting = ref(false);

  // Field-level validation errors
  interface FieldErrors {
    title?: string;
    year?: string;
    model?: string;
    manufacturer?: string;
    price?: string;
    condition?: string;
    part_condition?: string;
    description?: string;
    city?: string;
    mileage?: string;
    color?: string;
  }
  const errors = reactive<FieldErrors>({});

  // Clear specific error when field changes
  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      errors[field] = undefined;
    }
  };

  // Watch form fields to clear errors on change
  const fieldsToWatch: (keyof FieldErrors)[] = [
    'title',
    'year',
    'model',
    'manufacturer',
    'price',
    'condition',
    'part_condition',
    'description',
    'mileage',
    'color',
    'city',
  ];

  fieldsToWatch.forEach((field) => {
    watch(
      () => form[field as keyof typeof form],
      () => clearError(field)
    );
  });

  // Form validation - returns true if valid, false if errors exist
  const validateForm = (): boolean => {
    // Clear all existing errors first
    Object.keys(errors).forEach((key) => {
      errors[key as keyof FieldErrors] = undefined;
    });

    let hasErrors = false;

    // Common required fields
    if (!form.title?.trim()) {
      errors.title = t('validation.titleRequired');
      hasErrors = true;
    }
    if (!form.city?.trim()) {
      errors.city = t('validation.cityRequired');
      hasErrors = true;
    }
    if (!form.description?.trim()) {
      errors.description = t('validation.descriptionRequired');
      hasErrors = true;
    }

    // Price validation (0 is valid for free listings)
    if (form.price === null || form.price === undefined || form.price === '') {
      errors.price = t('validation.priceRequired');
      hasErrors = true;
    } else if (Number(form.price) < 0) {
      errors.price = t('validation.priceNegative');
      hasErrors = true;
    }

    // Vehicle specific validation
    if (listing.value?.listing_category === 'vehicle') {
      if (!form.year) {
        errors.year = t('validation.yearRequired');
        hasErrors = true;
      } else if (form.year < 1959 || form.year > 2000) {
        errors.year = t('validation.yearRange');
        hasErrors = true;
      }
      if (!form.model) {
        errors.model = t('validation.modelRequired');
        hasErrors = true;
      }
      if (!form.manufacturer) {
        errors.manufacturer = t('validation.manufacturerRequired');
        hasErrors = true;
      }
      if (!form.color?.trim()) {
        errors.color = t('validation.colorRequired');
        hasErrors = true;
      }
      if (!form.condition) {
        errors.condition = t('validation.conditionRequired');
        hasErrors = true;
      }
    }

    // Engine validation (year is optional but must be valid if provided)
    if (listing.value?.listing_category === 'engine') {
      if (form.year && (form.year < 1959 || form.year > 2000)) {
        errors.year = t('validation.yearRange');
        hasErrors = true;
      }
    }

    // Parts specific validation
    if (isPartsCategory.value) {
      if (!form.part_condition) {
        errors.part_condition = t('validation.partConditionRequired');
        hasErrors = true;
      }
    }

    return !hasErrors;
  };

  // Scroll to first error field
  const scrollToFirstError = () => {
    const firstErrorKey = Object.keys(errors).find((key) => errors[key as keyof FieldErrors]);
    if (firstErrorKey) {
      const element = document.querySelector(`[data-field="${firstErrorKey}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleSubmit = async () => {
    // Validate form before proceeding
    const isValid = validateForm();
    if (!isValid) {
      scrollToFirstError();
      return;
    }

    try {
      isSubmitting.value = true;

      // Build changes object (only include changed fields)
      const changes: Record<string, any> = {};

      (Object.keys(form) as Array<keyof typeof form>).forEach((key) => {
        const originalValue = listing.value![key as keyof typeof listing.value];
        const newValue = form[key];

        if (originalValue !== newValue && newValue !== null && newValue !== undefined && newValue !== '') {
          changes[key] = newValue;
        }
      });

      // Check parts-specific changes (if applicable)
      if (isPartsCategory.value && fitsModelsInput.value && listing.value) {
        const fitsModelsArray = fitsModelsInput.value
          .split(',')
          .map((m) => m.trim())
          .filter((m) => m);
        const currentFitsModels = listing.value.fits_models || [];
        if (JSON.stringify(fitsModelsArray) !== JSON.stringify(currentFitsModels)) {
          changes.fits_models = fitsModelsArray;
        }
      }

      if (Object.keys(changes).length === 0) {
        toast.add({
          title: t('toast.noChangesTitle'),
          description: t('toast.noChangesBody'),
          color: 'info',
        });
        return;
      }

      // Update listing directly
      const { error: updateError } = await supabase
        .from('listings')
        .update(changes)
        .eq('id', listing.value!.id)
        .eq('user_id', authUser!.id);

      if (updateError) throw updateError;

      // Fire-and-forget: notify watchers of price drop
      if (changes.price && listing.value?.price && changes.price < listing.value.price) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken) {
          $fetch('/api/exchange/notifications/price-drop', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: {
              listingId: listing.value.id,
              previousPrice: listing.value.price,
              newPrice: changes.price,
            },
          }).catch((err) => console.error('Failed to notify watchers of price drop:', err));
        }
      }

      toast.add({
        title: t('toast.updatedTitle'),
        description: t('toast.updatedBody'),
        color: 'success',
      });

      await router.push(`/exchange/listings/${slug.value}?edit=success`);
    } catch (error: any) {
      console.error('Failed to submit edit:', error);
      toast.add({
        title: t('toast.errorTitle'),
        description: error.message || t('toast.errorBody'),
        color: 'error',
      });
    } finally {
      isSubmitting.value = false;
    }
  };

  // SEO
  useSeoMeta({
    title: t('seo.title', { title: listing.value.title }),
    robots: 'noindex, nofollow',
  });
  useHead({
    link: [
      {
        rel: 'canonical',
        href: `https://www.classicminidiy.com/exchange/listings/${listing.value.slug}/edit`,
      },
    ],
  });
</script>

<i18n lang="json">
{
  "en": {
    "pageHeading": "Edit Listing",
    "backToListing": "Back to Listing",
    "basicInfo": "Basic Information",
    "listingCategory": "Listing Category",
    "categoryLocked": "Category cannot be changed after creation",
    "modelPlaceholder": "Select model",
    "restorationStatusPlaceholder": "Select status",
    "gearboxPlaceholder": "Select gearbox type",
    "selectTypePlaceholder": "Select type",
    "selectSizePlaceholder": "Select size",
    "conditionSelectPlaceholder": "Select condition",
    "itemIsFree": "This item is free",
    "freeHelp": "This listing will show as \"Free\" to buyers",
    "descriptionHeading": "Description",
    "specsHeading": "Specifications",
    "engineSpecsHeading": "Engine Specifications",
    "heritageHeading": "Heritage & Provenance",
    "heritageIntro": "Optional details that add value and authenticity to your listing",
    "detailedSpecsHeading": "Detailed Specifications",
    "detailedSpecsIntro": "Add detailed specifications to help buyers understand your Mini's configuration",
    "engineMechanical": "Engine & Mechanical",
    "exteriorBody": "Exterior & Body",
    "interior": "Interior",
    "modsHeading": "Modifications & Condition",
    "modsIntro": "Document any modifications and provide a condition assessment",
    "factoryOptions": "Factory Options",
    "modifications": "Modifications",
    "conditionAssessment": "Condition Assessment",
    "cancel": "Cancel",
    "saveChanges": "Save Changes",
    "fields": {
      "title": "Listing Title *",
      "year": "Year *",
      "yearOptional": "Year",
      "manufacturer": "Manufacturer *",
      "model": "Model *",
      "modelOptional": "Model",
      "partNumber": "Part Number",
      "partCondition": "Part Condition *",
      "price": "Price *",
      "condition": "Condition *",
      "quantityAvailable": "Quantity Available",
      "fitsModels": "Fits Models",
      "partType": "Part Type",
      "shippingAvailable": "Shipping Available",
      "shippingCost": "Shipping Cost",
      "color": "Color *",
      "location": "Location *",
      "description": "Description *",
      "mileage": "Mileage",
      "engineSize": "Engine Size",
      "vinNumber": "VIN Number",
      "chassisNumber": "Chassis Number",
      "buildDate": "Build Date",
      "originalColor": "Original Factory Color",
      "previousOwners": "Previous Owners",
      "restorationStatus": "Restoration Status",
      "lastRestorationDate": "Last Restoration Date",
      "heritageCert": "Heritage Certificate",
      "matchingNumbers": "Matching Numbers",
      "serviceHistory": "Service History Available",
      "heritageCertNumber": "Heritage Certificate Number",
      "heritageCertDetails": "Heritage Certificate Details",
      "restorationDetails": "Restoration Work Details",
      "engineNumber": "Engine Number",
      "gearboxType": "Gearbox Type",
      "carbType": "Carburetor Type",
      "exhaustType": "Exhaust Type",
      "brakeType": "Brake Type",
      "roofColor": "Roof Color (if different)",
      "stripeColor": "Stripe Color",
      "wheelSize": "Wheel Size",
      "wheelType": "Wheel Type",
      "bumperType": "Bumper Type",
      "windowType": "Window Type",
      "hasStripes": "Has Stripes",
      "hasSunroof": "Has Sunroof",
      "seatType": "Seat Type",
      "interiorColor": "Interior Color/Trim",
      "dashboardType": "Dashboard Type",
      "steeringWheelType": "Steering Wheel Type",
      "engineMods": "Engine Modifications",
      "suspensionMods": "Suspension Modifications",
      "performanceUpgrades": "Performance Upgrades",
      "otherModifications": "Other Modifications",
      "rustCondition": "Rust Condition",
      "undersideCondition": "Underside Condition"
    },
    "placeholders": {
      "partNumber": "e.g., GHF101, 13H2677",
      "fitsModels": "e.g., Mini Cooper, Cooper S, 1275 GT (comma-separated)",
      "color": "e.g., Flame Red, British Racing Green",
      "engineSize": "e.g., 1275cc",
      "vinNumber": "e.g., XAD123456",
      "chassisNumber": "e.g., AB-L-12345",
      "buildDate": "e.g., March 1967 or 15/06/1972",
      "originalColor": "e.g., Tartan Red",
      "previousOwners": "Number of previous owners",
      "lastRestorationDate": "e.g., Summer 2019 or 2020",
      "heritageCertNumber": "e.g., 12345/ABCD",
      "heritageCertDetails": "Describe the heritage certificate information...",
      "restorationDetails": "Describe the restoration work completed...",
      "engineNumber": "e.g., 9FXXXX12345",
      "roofColor": "e.g., Old English White",
      "stripeColor": "e.g., White, Black",
      "interiorColor": "e.g., Black vinyl, Beige cloth",
      "engineMods": "Describe any engine modifications (big bore kit, ported head, etc.)",
      "suspensionMods": "Describe suspension modifications (lowered, uprated, coilovers, etc.)",
      "performanceUpgrades": "Describe performance upgrades (turbo, supercharger, ECU, etc.)",
      "otherModifications": "Any other notable modifications"
    },
    "help": {
      "fitsModels": "Which Mini models is this part compatible with?",
      "shippingCost": "Leave blank if shipping cost varies by location",
      "vinNumber": "Vehicle Identification Number",
      "chassisNumber": "Body/chassis plate number",
      "heritageCertNumber": "BMIHT certificate number",
      "restorationDetails": "Include details about work done, parts replaced, upgrades, etc."
    },
    "manufacturerOptions": {
      "placeholder": "Select manufacturer",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "Other"
    },
    "partConditionOptions": {
      "placeholder": "Select condition",
      "new": "New",
      "usedExcellent": "Used - Excellent",
      "usedGood": "Used - Good",
      "usedFair": "Used - Fair",
      "rebuild": "Rebuild/Refurbished",
      "core": "Core (needs rebuild)"
    },
    "conditionOptions": {
      "placeholder": "Select condition",
      "new": "New",
      "used": "Used",
      "project": "Project",
      "scrap": "Scrap"
    },
    "partTypeOptions": {
      "placeholder": "Select type",
      "oem": "OEM (Original Equipment)",
      "aftermarket": "Aftermarket",
      "reproduction": "Reproduction"
    },
    "carbTypeOptions": {
      "placeholder": "Select type",
      "singleSu": "Single SU",
      "twinSu": "Twin SU",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "Fuel Injection",
      "other": "Other"
    },
    "brakeTypeOptions": {
      "placeholder": "Select type",
      "standardDrum": "Standard Drum (4-wheel)",
      "discFront": "Disc Front, Drum Rear",
      "fourWheelDisc": "Four-Wheel Disc"
    },
    "rustConditionOptions": {
      "noneVisible": "None Visible",
      "minorSurface": "Minor Surface Rust",
      "moderate": "Moderate",
      "significant": "Significant"
    },
    "undersideConditionOptions": {
      "excellent": "Excellent",
      "good": "Good",
      "fair": "Fair",
      "needsWork": "Needs Work"
    },
    "factoryOptionLabels": {
      "hydrolastic": "Hydrolastic Suspension",
      "heatedRearWindow": "Heated Rear Window",
      "servoBrakes": "Servo-Assisted Brakes",
      "radio": "Original Radio",
      "fogLights": "Fog Lights",
      "woodDash": "Wood Veneer Dashboard",
      "recliningSeats": "Reclining Seats",
      "centerConsole": "Center Console"
    },
    "validation": {
      "titleRequired": "Title is required",
      "cityRequired": "City is required",
      "descriptionRequired": "Description is required",
      "priceRequired": "Price is required (or mark as free)",
      "priceNegative": "Price cannot be negative",
      "yearRequired": "Year is required",
      "yearRange": "Year must be between 1959 and 2000",
      "modelRequired": "Model is required",
      "manufacturerRequired": "Manufacturer is required",
      "colorRequired": "Color is required",
      "conditionRequired": "Condition is required",
      "partConditionRequired": "Part condition is required"
    },
    "toast": {
      "noChangesTitle": "No Changes",
      "noChangesBody": "No changes were made to the listing.",
      "updatedTitle": "Listing Updated",
      "updatedBody": "Your changes have been saved.",
      "errorTitle": "Error",
      "errorBody": "Failed to submit changes. Please try again."
    },
    "errors": {
      "notFound": "Listing not found",
      "forbidden": "You do not have permission to edit this listing"
    },
    "seo": {
      "title": "Edit {title} - Classic Mini DIY"
    }
  },
  "es": {
    "pageHeading": "Editar anuncio",
    "backToListing": "Volver al anuncio",
    "basicInfo": "Información básica",
    "listingCategory": "Categoría del anuncio",
    "categoryLocked": "La categoría no se puede cambiar después de la creación",
    "modelPlaceholder": "Seleccionar modelo",
    "restorationStatusPlaceholder": "Seleccionar estado",
    "gearboxPlaceholder": "Seleccionar tipo de caja de cambios",
    "selectTypePlaceholder": "Seleccionar tipo",
    "selectSizePlaceholder": "Seleccionar tamaño",
    "conditionSelectPlaceholder": "Seleccionar estado",
    "itemIsFree": "Este artículo es gratis",
    "freeHelp": "Este anuncio se mostrará como \"Gratis\" a los compradores",
    "descriptionHeading": "Descripción",
    "specsHeading": "Especificaciones",
    "engineSpecsHeading": "Especificaciones del motor",
    "heritageHeading": "Patrimonio y procedencia",
    "heritageIntro": "Detalles opcionales que añaden valor y autenticidad a tu anuncio",
    "detailedSpecsHeading": "Especificaciones detalladas",
    "detailedSpecsIntro": "Añade especificaciones detalladas para ayudar a los compradores a entender la configuración de tu Mini",
    "engineMechanical": "Motor y mecánica",
    "exteriorBody": "Exterior y carrocería",
    "interior": "Interior",
    "modsHeading": "Modificaciones y estado",
    "modsIntro": "Documenta cualquier modificación y proporciona una evaluación del estado",
    "factoryOptions": "Opciones de fábrica",
    "modifications": "Modificaciones",
    "conditionAssessment": "Evaluación del estado",
    "cancel": "Cancelar",
    "saveChanges": "Guardar cambios",
    "fields": {
      "title": "Título del anuncio *",
      "year": "Año *",
      "yearOptional": "Año",
      "manufacturer": "Fabricante *",
      "model": "Modelo *",
      "modelOptional": "Modelo",
      "partNumber": "Número de pieza",
      "partCondition": "Estado de la pieza *",
      "price": "Precio *",
      "condition": "Estado *",
      "quantityAvailable": "Cantidad disponible",
      "fitsModels": "Modelos compatibles",
      "partType": "Tipo de pieza",
      "shippingAvailable": "Envío disponible",
      "shippingCost": "Coste de envío",
      "color": "Color *",
      "location": "Ubicación *",
      "description": "Descripción *",
      "mileage": "Kilometraje",
      "engineSize": "Cilindrada",
      "vinNumber": "Número VIN",
      "chassisNumber": "Número de chasis",
      "buildDate": "Fecha de fabricación",
      "originalColor": "Color original de fábrica",
      "previousOwners": "Propietarios anteriores",
      "restorationStatus": "Estado de restauración",
      "lastRestorationDate": "Fecha de la última restauración",
      "heritageCert": "Certificado de patrimonio",
      "matchingNumbers": "Números coincidentes",
      "serviceHistory": "Historial de servicio disponible",
      "heritageCertNumber": "Número del certificado de patrimonio",
      "heritageCertDetails": "Detalles del certificado de patrimonio",
      "restorationDetails": "Detalles del trabajo de restauración",
      "engineNumber": "Número de motor",
      "gearboxType": "Tipo de caja de cambios",
      "carbType": "Tipo de carburador",
      "exhaustType": "Tipo de escape",
      "brakeType": "Tipo de freno",
      "roofColor": "Color del techo (si es diferente)",
      "stripeColor": "Color de las franjas",
      "wheelSize": "Tamaño de rueda",
      "wheelType": "Tipo de rueda",
      "bumperType": "Tipo de parachoques",
      "windowType": "Tipo de ventana",
      "hasStripes": "Tiene franjas",
      "hasSunroof": "Tiene techo solar",
      "seatType": "Tipo de asiento",
      "interiorColor": "Color/tapizado interior",
      "dashboardType": "Tipo de salpicadero",
      "steeringWheelType": "Tipo de volante",
      "engineMods": "Modificaciones del motor",
      "suspensionMods": "Modificaciones de la suspensión",
      "performanceUpgrades": "Mejoras de rendimiento",
      "otherModifications": "Otras modificaciones",
      "rustCondition": "Estado del óxido",
      "undersideCondition": "Estado de los bajos"
    },
    "placeholders": {
      "partNumber": "p. ej., GHF101, 13H2677",
      "fitsModels": "p. ej., Mini Cooper, Cooper S, 1275 GT (separados por comas)",
      "color": "p. ej., Rojo llama, Verde British Racing",
      "engineSize": "p. ej., 1275cc",
      "vinNumber": "p. ej., XAD123456",
      "chassisNumber": "p. ej., AB-L-12345",
      "buildDate": "p. ej., marzo de 1967 o 15/06/1972",
      "originalColor": "p. ej., Rojo tartán",
      "previousOwners": "Número de propietarios anteriores",
      "lastRestorationDate": "p. ej., verano de 2019 o 2020",
      "heritageCertNumber": "p. ej., 12345/ABCD",
      "heritageCertDetails": "Describe la información del certificado de patrimonio...",
      "restorationDetails": "Describe el trabajo de restauración realizado...",
      "engineNumber": "p. ej., 9FXXXX12345",
      "roofColor": "p. ej., Old English White",
      "stripeColor": "p. ej., Blanco, Negro",
      "interiorColor": "p. ej., Vinilo negro, Tela beige",
      "engineMods": "Describe cualquier modificación del motor (kit de gran cilindrada, culata trabajada, etc.)",
      "suspensionMods": "Describe modificaciones de la suspensión (rebajada, mejorada, roscados, etc.)",
      "performanceUpgrades": "Describe mejoras de rendimiento (turbo, compresor, ECU, etc.)",
      "otherModifications": "Cualquier otra modificación notable"
    },
    "help": {
      "fitsModels": "¿Con qué modelos de Mini es compatible esta pieza?",
      "shippingCost": "Déjalo en blanco si el coste de envío varía según la ubicación",
      "vinNumber": "Número de identificación del vehículo",
      "chassisNumber": "Número de placa de carrocería/chasis",
      "heritageCertNumber": "Número de certificado BMIHT",
      "restorationDetails": "Incluye detalles sobre el trabajo realizado, piezas reemplazadas, mejoras, etc."
    },
    "manufacturerOptions": {
      "placeholder": "Seleccionar fabricante",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "Otro"
    },
    "partConditionOptions": {
      "placeholder": "Seleccionar estado",
      "new": "Nuevo",
      "usedExcellent": "Usado - Excelente",
      "usedGood": "Usado - Bueno",
      "usedFair": "Usado - Aceptable",
      "rebuild": "Reconstruido/Reacondicionado",
      "core": "Núcleo (necesita reconstrucción)"
    },
    "conditionOptions": {
      "placeholder": "Seleccionar estado",
      "new": "Nuevo",
      "used": "Usado",
      "project": "Proyecto",
      "scrap": "Para desguace"
    },
    "partTypeOptions": {
      "placeholder": "Seleccionar tipo",
      "oem": "OEM (Equipo original)",
      "aftermarket": "Aftermarket",
      "reproduction": "Reproducción"
    },
    "carbTypeOptions": {
      "placeholder": "Seleccionar tipo",
      "singleSu": "SU simple",
      "twinSu": "SU doble",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "Inyección de combustible",
      "other": "Otro"
    },
    "brakeTypeOptions": {
      "placeholder": "Seleccionar tipo",
      "standardDrum": "Tambor estándar (4 ruedas)",
      "discFront": "Disco delantero, tambor trasero",
      "fourWheelDisc": "Disco en las cuatro ruedas"
    },
    "rustConditionOptions": {
      "noneVisible": "Ninguno visible",
      "minorSurface": "Óxido superficial leve",
      "moderate": "Moderado",
      "significant": "Significativo"
    },
    "undersideConditionOptions": {
      "excellent": "Excelente",
      "good": "Bueno",
      "fair": "Aceptable",
      "needsWork": "Necesita trabajo"
    },
    "factoryOptionLabels": {
      "hydrolastic": "Suspensión Hydrolastic",
      "heatedRearWindow": "Luneta térmica",
      "servoBrakes": "Frenos asistidos por servo",
      "radio": "Radio original",
      "fogLights": "Faros antiniebla",
      "woodDash": "Salpicadero de chapa de madera",
      "recliningSeats": "Asientos reclinables",
      "centerConsole": "Consola central"
    },
    "validation": {
      "titleRequired": "El título es obligatorio",
      "cityRequired": "La ciudad es obligatoria",
      "descriptionRequired": "La descripción es obligatoria",
      "priceRequired": "El precio es obligatorio (o márcalo como gratis)",
      "priceNegative": "El precio no puede ser negativo",
      "yearRequired": "El año es obligatorio",
      "yearRange": "El año debe estar entre 1959 y 2000",
      "modelRequired": "El modelo es obligatorio",
      "manufacturerRequired": "El fabricante es obligatorio",
      "colorRequired": "El color es obligatorio",
      "conditionRequired": "El estado es obligatorio",
      "partConditionRequired": "El estado de la pieza es obligatorio"
    },
    "toast": {
      "noChangesTitle": "Sin cambios",
      "noChangesBody": "No se realizaron cambios en el anuncio.",
      "updatedTitle": "Anuncio actualizado",
      "updatedBody": "Tus cambios se han guardado.",
      "errorTitle": "Error",
      "errorBody": "No se pudieron enviar los cambios. Inténtalo de nuevo."
    },
    "errors": {
      "notFound": "Anuncio no encontrado",
      "forbidden": "No tienes permiso para editar este anuncio"
    },
    "seo": {
      "title": "Editar {title} - Classic Mini DIY"
    }
  },
  "fr": {
    "pageHeading": "Modifier l'annonce",
    "backToListing": "Retour à l'annonce",
    "basicInfo": "Informations de base",
    "listingCategory": "Catégorie de l'annonce",
    "categoryLocked": "La catégorie ne peut pas être modifiée après la création",
    "modelPlaceholder": "Sélectionner un modèle",
    "restorationStatusPlaceholder": "Sélectionner un statut",
    "gearboxPlaceholder": "Sélectionner un type de boîte de vitesses",
    "selectTypePlaceholder": "Sélectionner un type",
    "selectSizePlaceholder": "Sélectionner une taille",
    "conditionSelectPlaceholder": "Sélectionner un état",
    "itemIsFree": "Cet article est gratuit",
    "freeHelp": "Cette annonce s'affichera comme « Gratuit » pour les acheteurs",
    "descriptionHeading": "Description",
    "specsHeading": "Spécifications",
    "engineSpecsHeading": "Spécifications du moteur",
    "heritageHeading": "Patrimoine et provenance",
    "heritageIntro": "Détails facultatifs qui ajoutent de la valeur et de l'authenticité à votre annonce",
    "detailedSpecsHeading": "Spécifications détaillées",
    "detailedSpecsIntro": "Ajoutez des spécifications détaillées pour aider les acheteurs à comprendre la configuration de votre Mini",
    "engineMechanical": "Moteur et mécanique",
    "exteriorBody": "Extérieur et carrosserie",
    "interior": "Intérieur",
    "modsHeading": "Modifications et état",
    "modsIntro": "Documentez toute modification et fournissez une évaluation de l'état",
    "factoryOptions": "Options d'usine",
    "modifications": "Modifications",
    "conditionAssessment": "Évaluation de l'état",
    "cancel": "Annuler",
    "saveChanges": "Enregistrer les modifications",
    "fields": {
      "title": "Titre de l'annonce *",
      "year": "Année *",
      "yearOptional": "Année",
      "manufacturer": "Fabricant *",
      "model": "Modèle *",
      "modelOptional": "Modèle",
      "partNumber": "Numéro de pièce",
      "partCondition": "État de la pièce *",
      "price": "Prix *",
      "condition": "État *",
      "quantityAvailable": "Quantité disponible",
      "fitsModels": "Modèles compatibles",
      "partType": "Type de pièce",
      "shippingAvailable": "Livraison disponible",
      "shippingCost": "Frais de livraison",
      "color": "Couleur *",
      "location": "Localisation *",
      "description": "Description *",
      "mileage": "Kilométrage",
      "engineSize": "Cylindrée",
      "vinNumber": "Numéro VIN",
      "chassisNumber": "Numéro de châssis",
      "buildDate": "Date de fabrication",
      "originalColor": "Couleur d'usine d'origine",
      "previousOwners": "Propriétaires précédents",
      "restorationStatus": "État de restauration",
      "lastRestorationDate": "Date de la dernière restauration",
      "heritageCert": "Certificat de patrimoine",
      "matchingNumbers": "Numéros concordants",
      "serviceHistory": "Carnet d'entretien disponible",
      "heritageCertNumber": "Numéro du certificat de patrimoine",
      "heritageCertDetails": "Détails du certificat de patrimoine",
      "restorationDetails": "Détails des travaux de restauration",
      "engineNumber": "Numéro de moteur",
      "gearboxType": "Type de boîte de vitesses",
      "carbType": "Type de carburateur",
      "exhaustType": "Type d'échappement",
      "brakeType": "Type de frein",
      "roofColor": "Couleur du toit (si différente)",
      "stripeColor": "Couleur des bandes",
      "wheelSize": "Taille de roue",
      "wheelType": "Type de roue",
      "bumperType": "Type de pare-chocs",
      "windowType": "Type de vitres",
      "hasStripes": "Avec bandes",
      "hasSunroof": "Avec toit ouvrant",
      "seatType": "Type de siège",
      "interiorColor": "Couleur/garniture intérieure",
      "dashboardType": "Type de tableau de bord",
      "steeringWheelType": "Type de volant",
      "engineMods": "Modifications du moteur",
      "suspensionMods": "Modifications de la suspension",
      "performanceUpgrades": "Améliorations de performance",
      "otherModifications": "Autres modifications",
      "rustCondition": "État de la rouille",
      "undersideCondition": "État du dessous de caisse"
    },
    "placeholders": {
      "partNumber": "p. ex., GHF101, 13H2677",
      "fitsModels": "p. ex., Mini Cooper, Cooper S, 1275 GT (séparés par des virgules)",
      "color": "p. ex., Rouge flamme, Vert British Racing",
      "engineSize": "p. ex., 1275cc",
      "vinNumber": "p. ex., XAD123456",
      "chassisNumber": "p. ex., AB-L-12345",
      "buildDate": "p. ex., mars 1967 ou 15/06/1972",
      "originalColor": "p. ex., Rouge tartan",
      "previousOwners": "Nombre de propriétaires précédents",
      "lastRestorationDate": "p. ex., été 2019 ou 2020",
      "heritageCertNumber": "p. ex., 12345/ABCD",
      "heritageCertDetails": "Décrivez les informations du certificat de patrimoine...",
      "restorationDetails": "Décrivez les travaux de restauration effectués...",
      "engineNumber": "p. ex., 9FXXXX12345",
      "roofColor": "p. ex., Old English White",
      "stripeColor": "p. ex., Blanc, Noir",
      "interiorColor": "p. ex., Vinyle noir, Tissu beige",
      "engineMods": "Décrivez les modifications du moteur (kit gros alésage, culasse retravaillée, etc.)",
      "suspensionMods": "Décrivez les modifications de la suspension (abaissée, renforcée, combinés filetés, etc.)",
      "performanceUpgrades": "Décrivez les améliorations de performance (turbo, compresseur, ECU, etc.)",
      "otherModifications": "Toute autre modification notable"
    },
    "help": {
      "fitsModels": "Avec quels modèles de Mini cette pièce est-elle compatible ?",
      "shippingCost": "Laissez vide si les frais de livraison varient selon le lieu",
      "vinNumber": "Numéro d'identification du véhicule",
      "chassisNumber": "Numéro de plaque de caisse/châssis",
      "heritageCertNumber": "Numéro de certificat BMIHT",
      "restorationDetails": "Incluez des détails sur les travaux effectués, les pièces remplacées, les améliorations, etc."
    },
    "manufacturerOptions": {
      "placeholder": "Sélectionner un fabricant",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "Autre"
    },
    "partConditionOptions": {
      "placeholder": "Sélectionner un état",
      "new": "Neuf",
      "usedExcellent": "Occasion - Excellent",
      "usedGood": "Occasion - Bon",
      "usedFair": "Occasion - Correct",
      "rebuild": "Reconstruit/Reconditionné",
      "core": "Pièce de base (à reconstruire)"
    },
    "conditionOptions": {
      "placeholder": "Sélectionner un état",
      "new": "Neuf",
      "used": "Occasion",
      "project": "Projet",
      "scrap": "Épave"
    },
    "partTypeOptions": {
      "placeholder": "Sélectionner un type",
      "oem": "OEM (équipement d'origine)",
      "aftermarket": "Marché secondaire",
      "reproduction": "Reproduction"
    },
    "carbTypeOptions": {
      "placeholder": "Sélectionner un type",
      "singleSu": "SU simple",
      "twinSu": "Double SU",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "Injection de carburant",
      "other": "Autre"
    },
    "brakeTypeOptions": {
      "placeholder": "Sélectionner un type",
      "standardDrum": "Tambour standard (4 roues)",
      "discFront": "Disque avant, tambour arrière",
      "fourWheelDisc": "Disque aux quatre roues"
    },
    "rustConditionOptions": {
      "noneVisible": "Aucune visible",
      "minorSurface": "Rouille de surface mineure",
      "moderate": "Modérée",
      "significant": "Importante"
    },
    "undersideConditionOptions": {
      "excellent": "Excellent",
      "good": "Bon",
      "fair": "Correct",
      "needsWork": "Travaux nécessaires"
    },
    "factoryOptionLabels": {
      "hydrolastic": "Suspension Hydrolastic",
      "heatedRearWindow": "Lunette arrière dégivrante",
      "servoBrakes": "Freins assistés",
      "radio": "Radio d'origine",
      "fogLights": "Antibrouillards",
      "woodDash": "Tableau de bord en placage de bois",
      "recliningSeats": "Sièges inclinables",
      "centerConsole": "Console centrale"
    },
    "validation": {
      "titleRequired": "Le titre est requis",
      "cityRequired": "La ville est requise",
      "descriptionRequired": "La description est requise",
      "priceRequired": "Le prix est requis (ou marquez comme gratuit)",
      "priceNegative": "Le prix ne peut pas être négatif",
      "yearRequired": "L'année est requise",
      "yearRange": "L'année doit être comprise entre 1959 et 2000",
      "modelRequired": "Le modèle est requis",
      "manufacturerRequired": "Le fabricant est requis",
      "colorRequired": "La couleur est requise",
      "conditionRequired": "L'état est requis",
      "partConditionRequired": "L'état de la pièce est requis"
    },
    "toast": {
      "noChangesTitle": "Aucune modification",
      "noChangesBody": "Aucune modification n'a été apportée à l'annonce.",
      "updatedTitle": "Annonce mise à jour",
      "updatedBody": "Vos modifications ont été enregistrées.",
      "errorTitle": "Erreur",
      "errorBody": "Échec de l'envoi des modifications. Veuillez réessayer."
    },
    "errors": {
      "notFound": "Annonce introuvable",
      "forbidden": "Vous n'êtes pas autorisé à modifier cette annonce"
    },
    "seo": {
      "title": "Modifier {title} - Classic Mini DIY"
    }
  },
  "de": {
    "pageHeading": "Anzeige bearbeiten",
    "backToListing": "Zurück zur Anzeige",
    "basicInfo": "Grundlegende Informationen",
    "listingCategory": "Anzeigenkategorie",
    "categoryLocked": "Die Kategorie kann nach der Erstellung nicht geändert werden",
    "modelPlaceholder": "Modell auswählen",
    "restorationStatusPlaceholder": "Status auswählen",
    "gearboxPlaceholder": "Getriebetyp auswählen",
    "selectTypePlaceholder": "Typ auswählen",
    "selectSizePlaceholder": "Größe auswählen",
    "conditionSelectPlaceholder": "Zustand auswählen",
    "itemIsFree": "Dieser Artikel ist kostenlos",
    "freeHelp": "Diese Anzeige wird Käufern als \"Kostenlos\" angezeigt",
    "descriptionHeading": "Beschreibung",
    "specsHeading": "Spezifikationen",
    "engineSpecsHeading": "Motorspezifikationen",
    "heritageHeading": "Herkunft & Provenienz",
    "heritageIntro": "Optionale Angaben, die Ihrer Anzeige Wert und Authentizität verleihen",
    "detailedSpecsHeading": "Detaillierte Spezifikationen",
    "detailedSpecsIntro": "Fügen Sie detaillierte Spezifikationen hinzu, damit Käufer die Konfiguration Ihres Mini verstehen",
    "engineMechanical": "Motor & Mechanik",
    "exteriorBody": "Außen & Karosserie",
    "interior": "Innenraum",
    "modsHeading": "Modifikationen & Zustand",
    "modsIntro": "Dokumentieren Sie alle Modifikationen und geben Sie eine Zustandsbewertung ab",
    "factoryOptions": "Werksoptionen",
    "modifications": "Modifikationen",
    "conditionAssessment": "Zustandsbewertung",
    "cancel": "Abbrechen",
    "saveChanges": "Änderungen speichern",
    "fields": {
      "title": "Anzeigentitel *",
      "year": "Baujahr *",
      "yearOptional": "Baujahr",
      "manufacturer": "Hersteller *",
      "model": "Modell *",
      "modelOptional": "Modell",
      "partNumber": "Teilenummer",
      "partCondition": "Teilezustand *",
      "price": "Preis *",
      "condition": "Zustand *",
      "quantityAvailable": "Verfügbare Menge",
      "fitsModels": "Passende Modelle",
      "partType": "Teiletyp",
      "shippingAvailable": "Versand verfügbar",
      "shippingCost": "Versandkosten",
      "color": "Farbe *",
      "location": "Standort *",
      "description": "Beschreibung *",
      "mileage": "Kilometerstand",
      "engineSize": "Hubraum",
      "vinNumber": "Fahrgestellnummer (VIN)",
      "chassisNumber": "Chassisnummer",
      "buildDate": "Baudatum",
      "originalColor": "Originale Werksfarbe",
      "previousOwners": "Vorbesitzer",
      "restorationStatus": "Restaurierungsstatus",
      "lastRestorationDate": "Datum der letzten Restaurierung",
      "heritageCert": "Heritage-Zertifikat",
      "matchingNumbers": "Übereinstimmende Nummern",
      "serviceHistory": "Scheckheft verfügbar",
      "heritageCertNumber": "Nummer des Heritage-Zertifikats",
      "heritageCertDetails": "Details zum Heritage-Zertifikat",
      "restorationDetails": "Details zu den Restaurierungsarbeiten",
      "engineNumber": "Motornummer",
      "gearboxType": "Getriebetyp",
      "carbType": "Vergasertyp",
      "exhaustType": "Auspufftyp",
      "brakeType": "Bremstyp",
      "roofColor": "Dachfarbe (falls abweichend)",
      "stripeColor": "Streifenfarbe",
      "wheelSize": "Radgröße",
      "wheelType": "Radtyp",
      "bumperType": "Stoßstangentyp",
      "windowType": "Fenstertyp",
      "hasStripes": "Mit Streifen",
      "hasSunroof": "Mit Schiebedach",
      "seatType": "Sitztyp",
      "interiorColor": "Innenraumfarbe/-ausstattung",
      "dashboardType": "Armaturenbretttyp",
      "steeringWheelType": "Lenkradtyp",
      "engineMods": "Motormodifikationen",
      "suspensionMods": "Fahrwerksmodifikationen",
      "performanceUpgrades": "Leistungssteigerungen",
      "otherModifications": "Sonstige Modifikationen",
      "rustCondition": "Rostzustand",
      "undersideCondition": "Zustand der Unterseite"
    },
    "placeholders": {
      "partNumber": "z. B. GHF101, 13H2677",
      "fitsModels": "z. B. Mini Cooper, Cooper S, 1275 GT (durch Kommas getrennt)",
      "color": "z. B. Flame Red, British Racing Green",
      "engineSize": "z. B. 1275ccm",
      "vinNumber": "z. B. XAD123456",
      "chassisNumber": "z. B. AB-L-12345",
      "buildDate": "z. B. März 1967 oder 15.06.1972",
      "originalColor": "z. B. Tartan Red",
      "previousOwners": "Anzahl der Vorbesitzer",
      "lastRestorationDate": "z. B. Sommer 2019 oder 2020",
      "heritageCertNumber": "z. B. 12345/ABCD",
      "heritageCertDetails": "Beschreiben Sie die Informationen des Heritage-Zertifikats...",
      "restorationDetails": "Beschreiben Sie die durchgeführten Restaurierungsarbeiten...",
      "engineNumber": "z. B. 9FXXXX12345",
      "roofColor": "z. B. Old English White",
      "stripeColor": "z. B. Weiß, Schwarz",
      "interiorColor": "z. B. Schwarzes Vinyl, Beiger Stoff",
      "engineMods": "Beschreiben Sie alle Motormodifikationen (Big-Bore-Kit, bearbeiteter Kopf usw.)",
      "suspensionMods": "Beschreiben Sie Fahrwerksmodifikationen (tiefergelegt, verstärkt, Gewindefahrwerk usw.)",
      "performanceUpgrades": "Beschreiben Sie Leistungssteigerungen (Turbo, Kompressor, ECU usw.)",
      "otherModifications": "Sonstige bemerkenswerte Modifikationen"
    },
    "help": {
      "fitsModels": "Mit welchen Mini-Modellen ist dieses Teil kompatibel?",
      "shippingCost": "Leer lassen, wenn die Versandkosten je nach Standort variieren",
      "vinNumber": "Fahrzeug-Identifizierungsnummer",
      "chassisNumber": "Karosserie-/Chassisplattennummer",
      "heritageCertNumber": "BMIHT-Zertifikatsnummer",
      "restorationDetails": "Geben Sie Details zu durchgeführten Arbeiten, ersetzten Teilen, Upgrades usw. an."
    },
    "manufacturerOptions": {
      "placeholder": "Hersteller auswählen",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "Andere"
    },
    "partConditionOptions": {
      "placeholder": "Zustand auswählen",
      "new": "Neu",
      "usedExcellent": "Gebraucht - Ausgezeichnet",
      "usedGood": "Gebraucht - Gut",
      "usedFair": "Gebraucht - Brauchbar",
      "rebuild": "Überholt/Aufgearbeitet",
      "core": "Austauschteil (überholungsbedürftig)"
    },
    "conditionOptions": {
      "placeholder": "Zustand auswählen",
      "new": "Neu",
      "used": "Gebraucht",
      "project": "Projekt",
      "scrap": "Schrott"
    },
    "partTypeOptions": {
      "placeholder": "Typ auswählen",
      "oem": "OEM (Originalausrüstung)",
      "aftermarket": "Zubehörmarkt",
      "reproduction": "Reproduktion"
    },
    "carbTypeOptions": {
      "placeholder": "Typ auswählen",
      "singleSu": "Einzel-SU",
      "twinSu": "Doppel-SU",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "Einspritzung",
      "other": "Andere"
    },
    "brakeTypeOptions": {
      "placeholder": "Typ auswählen",
      "standardDrum": "Standard-Trommel (4 Räder)",
      "discFront": "Scheibe vorne, Trommel hinten",
      "fourWheelDisc": "Scheibenbremse an allen vier Rädern"
    },
    "rustConditionOptions": {
      "noneVisible": "Nicht sichtbar",
      "minorSurface": "Leichter Oberflächenrost",
      "moderate": "Mäßig",
      "significant": "Erheblich"
    },
    "undersideConditionOptions": {
      "excellent": "Ausgezeichnet",
      "good": "Gut",
      "fair": "Brauchbar",
      "needsWork": "Überarbeitung nötig"
    },
    "factoryOptionLabels": {
      "hydrolastic": "Hydrolastic-Federung",
      "heatedRearWindow": "Beheizbare Heckscheibe",
      "servoBrakes": "Servounterstützte Bremsen",
      "radio": "Originalradio",
      "fogLights": "Nebelscheinwerfer",
      "woodDash": "Armaturenbrett mit Holzfurnier",
      "recliningSeats": "Liegesitze",
      "centerConsole": "Mittelkonsole"
    },
    "validation": {
      "titleRequired": "Titel ist erforderlich",
      "cityRequired": "Stadt ist erforderlich",
      "descriptionRequired": "Beschreibung ist erforderlich",
      "priceRequired": "Preis ist erforderlich (oder als kostenlos markieren)",
      "priceNegative": "Der Preis darf nicht negativ sein",
      "yearRequired": "Baujahr ist erforderlich",
      "yearRange": "Das Baujahr muss zwischen 1959 und 2000 liegen",
      "modelRequired": "Modell ist erforderlich",
      "manufacturerRequired": "Hersteller ist erforderlich",
      "colorRequired": "Farbe ist erforderlich",
      "conditionRequired": "Zustand ist erforderlich",
      "partConditionRequired": "Teilezustand ist erforderlich"
    },
    "toast": {
      "noChangesTitle": "Keine Änderungen",
      "noChangesBody": "An der Anzeige wurden keine Änderungen vorgenommen.",
      "updatedTitle": "Anzeige aktualisiert",
      "updatedBody": "Ihre Änderungen wurden gespeichert.",
      "errorTitle": "Fehler",
      "errorBody": "Änderungen konnten nicht gesendet werden. Bitte versuchen Sie es erneut."
    },
    "errors": {
      "notFound": "Anzeige nicht gefunden",
      "forbidden": "Sie haben keine Berechtigung, diese Anzeige zu bearbeiten"
    },
    "seo": {
      "title": "{title} bearbeiten - Classic Mini DIY"
    }
  },
  "it": {
    "pageHeading": "Modifica annuncio",
    "backToListing": "Torna all'annuncio",
    "basicInfo": "Informazioni di base",
    "listingCategory": "Categoria dell'annuncio",
    "categoryLocked": "La categoria non può essere modificata dopo la creazione",
    "modelPlaceholder": "Seleziona modello",
    "restorationStatusPlaceholder": "Seleziona stato",
    "gearboxPlaceholder": "Seleziona tipo di cambio",
    "selectTypePlaceholder": "Seleziona tipo",
    "selectSizePlaceholder": "Seleziona misura",
    "conditionSelectPlaceholder": "Seleziona condizione",
    "itemIsFree": "Questo articolo è gratuito",
    "freeHelp": "Questo annuncio verrà mostrato come \"Gratis\" agli acquirenti",
    "descriptionHeading": "Descrizione",
    "specsHeading": "Specifiche",
    "engineSpecsHeading": "Specifiche del motore",
    "heritageHeading": "Storia e provenienza",
    "heritageIntro": "Dettagli facoltativi che aggiungono valore e autenticità al tuo annuncio",
    "detailedSpecsHeading": "Specifiche dettagliate",
    "detailedSpecsIntro": "Aggiungi specifiche dettagliate per aiutare gli acquirenti a comprendere la configurazione della tua Mini",
    "engineMechanical": "Motore e meccanica",
    "exteriorBody": "Esterni e carrozzeria",
    "interior": "Interni",
    "modsHeading": "Modifiche e condizioni",
    "modsIntro": "Documenta eventuali modifiche e fornisci una valutazione delle condizioni",
    "factoryOptions": "Optional di fabbrica",
    "modifications": "Modifiche",
    "conditionAssessment": "Valutazione delle condizioni",
    "cancel": "Annulla",
    "saveChanges": "Salva modifiche",
    "fields": {
      "title": "Titolo dell'annuncio *",
      "year": "Anno *",
      "yearOptional": "Anno",
      "manufacturer": "Produttore *",
      "model": "Modello *",
      "modelOptional": "Modello",
      "partNumber": "Codice ricambio",
      "partCondition": "Condizione del ricambio *",
      "price": "Prezzo *",
      "condition": "Condizione *",
      "quantityAvailable": "Quantità disponibile",
      "fitsModels": "Modelli compatibili",
      "partType": "Tipo di ricambio",
      "shippingAvailable": "Spedizione disponibile",
      "shippingCost": "Costo di spedizione",
      "color": "Colore *",
      "location": "Posizione *",
      "description": "Descrizione *",
      "mileage": "Chilometraggio",
      "engineSize": "Cilindrata",
      "vinNumber": "Numero VIN",
      "chassisNumber": "Numero di telaio",
      "buildDate": "Data di costruzione",
      "originalColor": "Colore originale di fabbrica",
      "previousOwners": "Proprietari precedenti",
      "restorationStatus": "Stato di restauro",
      "lastRestorationDate": "Data dell'ultimo restauro",
      "heritageCert": "Certificato di patrimonio",
      "matchingNumbers": "Numeri corrispondenti",
      "serviceHistory": "Storico tagliandi disponibile",
      "heritageCertNumber": "Numero del certificato di patrimonio",
      "heritageCertDetails": "Dettagli del certificato di patrimonio",
      "restorationDetails": "Dettagli dei lavori di restauro",
      "engineNumber": "Numero di motore",
      "gearboxType": "Tipo di cambio",
      "carbType": "Tipo di carburatore",
      "exhaustType": "Tipo di scarico",
      "brakeType": "Tipo di freni",
      "roofColor": "Colore del tetto (se diverso)",
      "stripeColor": "Colore delle strisce",
      "wheelSize": "Misura cerchi",
      "wheelType": "Tipo di cerchi",
      "bumperType": "Tipo di paraurti",
      "windowType": "Tipo di finestrini",
      "hasStripes": "Con strisce",
      "hasSunroof": "Con tetto apribile",
      "seatType": "Tipo di sedili",
      "interiorColor": "Colore/rivestimento interni",
      "dashboardType": "Tipo di cruscotto",
      "steeringWheelType": "Tipo di volante",
      "engineMods": "Modifiche al motore",
      "suspensionMods": "Modifiche alle sospensioni",
      "performanceUpgrades": "Migliorie prestazionali",
      "otherModifications": "Altre modifiche",
      "rustCondition": "Condizione della ruggine",
      "undersideCondition": "Condizione del sottoscocca"
    },
    "placeholders": {
      "partNumber": "es., GHF101, 13H2677",
      "fitsModels": "es., Mini Cooper, Cooper S, 1275 GT (separati da virgola)",
      "color": "es., Rosso fiamma, Verde British Racing",
      "engineSize": "es., 1275cc",
      "vinNumber": "es., XAD123456",
      "chassisNumber": "es., AB-L-12345",
      "buildDate": "es., marzo 1967 o 15/06/1972",
      "originalColor": "es., Rosso tartan",
      "previousOwners": "Numero di proprietari precedenti",
      "lastRestorationDate": "es., estate 2019 o 2020",
      "heritageCertNumber": "es., 12345/ABCD",
      "heritageCertDetails": "Descrivi le informazioni del certificato di patrimonio...",
      "restorationDetails": "Descrivi i lavori di restauro eseguiti...",
      "engineNumber": "es., 9FXXXX12345",
      "roofColor": "es., Old English White",
      "stripeColor": "es., Bianco, Nero",
      "interiorColor": "es., Vinile nero, Tessuto beige",
      "engineMods": "Descrivi eventuali modifiche al motore (kit maggiorazione, testata lavorata, ecc.)",
      "suspensionMods": "Descrivi le modifiche alle sospensioni (ribassate, maggiorate, coilover, ecc.)",
      "performanceUpgrades": "Descrivi le migliorie prestazionali (turbo, compressore, ECU, ecc.)",
      "otherModifications": "Qualsiasi altra modifica rilevante"
    },
    "help": {
      "fitsModels": "Con quali modelli di Mini è compatibile questo ricambio?",
      "shippingCost": "Lascia vuoto se il costo di spedizione varia in base alla località",
      "vinNumber": "Numero di identificazione del veicolo",
      "chassisNumber": "Numero della targhetta scocca/telaio",
      "heritageCertNumber": "Numero del certificato BMIHT",
      "restorationDetails": "Includi dettagli su lavori svolti, ricambi sostituiti, migliorie, ecc."
    },
    "manufacturerOptions": {
      "placeholder": "Seleziona produttore",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "Altro"
    },
    "partConditionOptions": {
      "placeholder": "Seleziona condizione",
      "new": "Nuovo",
      "usedExcellent": "Usato - Eccellente",
      "usedGood": "Usato - Buono",
      "usedFair": "Usato - Discreto",
      "rebuild": "Ricostruito/Rigenerato",
      "core": "Da rigenerare"
    },
    "conditionOptions": {
      "placeholder": "Seleziona condizione",
      "new": "Nuovo",
      "used": "Usato",
      "project": "Progetto",
      "scrap": "Da rottamare"
    },
    "partTypeOptions": {
      "placeholder": "Seleziona tipo",
      "oem": "OEM (Equipaggiamento originale)",
      "aftermarket": "Aftermarket",
      "reproduction": "Riproduzione"
    },
    "carbTypeOptions": {
      "placeholder": "Seleziona tipo",
      "singleSu": "SU singolo",
      "twinSu": "SU doppio",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "Iniezione",
      "other": "Altro"
    },
    "brakeTypeOptions": {
      "placeholder": "Seleziona tipo",
      "standardDrum": "Tamburo standard (4 ruote)",
      "discFront": "Disco anteriore, tamburo posteriore",
      "fourWheelDisc": "Disco sulle quattro ruote"
    },
    "rustConditionOptions": {
      "noneVisible": "Nessuna visibile",
      "minorSurface": "Lieve ruggine superficiale",
      "moderate": "Moderata",
      "significant": "Significativa"
    },
    "undersideConditionOptions": {
      "excellent": "Eccellente",
      "good": "Buona",
      "fair": "Discreta",
      "needsWork": "Necessita interventi"
    },
    "factoryOptionLabels": {
      "hydrolastic": "Sospensione Hydrolastic",
      "heatedRearWindow": "Lunotto termico",
      "servoBrakes": "Freni servoassistiti",
      "radio": "Radio originale",
      "fogLights": "Fendinebbia",
      "woodDash": "Cruscotto in radica",
      "recliningSeats": "Sedili reclinabili",
      "centerConsole": "Console centrale"
    },
    "validation": {
      "titleRequired": "Il titolo è obbligatorio",
      "cityRequired": "La città è obbligatoria",
      "descriptionRequired": "La descrizione è obbligatoria",
      "priceRequired": "Il prezzo è obbligatorio (o contrassegna come gratuito)",
      "priceNegative": "Il prezzo non può essere negativo",
      "yearRequired": "L'anno è obbligatorio",
      "yearRange": "L'anno deve essere compreso tra 1959 e 2000",
      "modelRequired": "Il modello è obbligatorio",
      "manufacturerRequired": "Il produttore è obbligatorio",
      "colorRequired": "Il colore è obbligatorio",
      "conditionRequired": "La condizione è obbligatoria",
      "partConditionRequired": "La condizione del ricambio è obbligatoria"
    },
    "toast": {
      "noChangesTitle": "Nessuna modifica",
      "noChangesBody": "Nessuna modifica è stata apportata all'annuncio.",
      "updatedTitle": "Annuncio aggiornato",
      "updatedBody": "Le tue modifiche sono state salvate.",
      "errorTitle": "Errore",
      "errorBody": "Invio delle modifiche non riuscito. Riprova."
    },
    "errors": {
      "notFound": "Annuncio non trovato",
      "forbidden": "Non hai il permesso di modificare questo annuncio"
    },
    "seo": {
      "title": "Modifica {title} - Classic Mini DIY"
    }
  },
  "pt": {
    "pageHeading": "Editar anúncio",
    "backToListing": "Voltar ao anúncio",
    "basicInfo": "Informações básicas",
    "listingCategory": "Categoria do anúncio",
    "categoryLocked": "A categoria não pode ser alterada após a criação",
    "modelPlaceholder": "Selecionar modelo",
    "restorationStatusPlaceholder": "Selecionar estado",
    "gearboxPlaceholder": "Selecionar tipo de caixa de velocidades",
    "selectTypePlaceholder": "Selecionar tipo",
    "selectSizePlaceholder": "Selecionar tamanho",
    "conditionSelectPlaceholder": "Selecionar condição",
    "itemIsFree": "Este item é gratuito",
    "freeHelp": "Este anúncio será exibido como \"Grátis\" para os compradores",
    "descriptionHeading": "Descrição",
    "specsHeading": "Especificações",
    "engineSpecsHeading": "Especificações do motor",
    "heritageHeading": "História e proveniência",
    "heritageIntro": "Detalhes opcionais que acrescentam valor e autenticidade ao seu anúncio",
    "detailedSpecsHeading": "Especificações detalhadas",
    "detailedSpecsIntro": "Adicione especificações detalhadas para ajudar os compradores a entender a configuração do seu Mini",
    "engineMechanical": "Motor e mecânica",
    "exteriorBody": "Exterior e carroçaria",
    "interior": "Interior",
    "modsHeading": "Modificações e condição",
    "modsIntro": "Documente quaisquer modificações e forneça uma avaliação da condição",
    "factoryOptions": "Opções de fábrica",
    "modifications": "Modificações",
    "conditionAssessment": "Avaliação da condição",
    "cancel": "Cancelar",
    "saveChanges": "Guardar alterações",
    "fields": {
      "title": "Título do anúncio *",
      "year": "Ano *",
      "yearOptional": "Ano",
      "manufacturer": "Fabricante *",
      "model": "Modelo *",
      "modelOptional": "Modelo",
      "partNumber": "Número da peça",
      "partCondition": "Condição da peça *",
      "price": "Preço *",
      "condition": "Condição *",
      "quantityAvailable": "Quantidade disponível",
      "fitsModels": "Modelos compatíveis",
      "partType": "Tipo de peça",
      "shippingAvailable": "Envio disponível",
      "shippingCost": "Custo de envio",
      "color": "Cor *",
      "location": "Localização *",
      "description": "Descrição *",
      "mileage": "Quilometragem",
      "engineSize": "Cilindrada",
      "vinNumber": "Número VIN",
      "chassisNumber": "Número do chassis",
      "buildDate": "Data de fabrico",
      "originalColor": "Cor original de fábrica",
      "previousOwners": "Proprietários anteriores",
      "restorationStatus": "Estado de restauro",
      "lastRestorationDate": "Data do último restauro",
      "heritageCert": "Certificado de património",
      "matchingNumbers": "Números coincidentes",
      "serviceHistory": "Histórico de manutenção disponível",
      "heritageCertNumber": "Número do certificado de património",
      "heritageCertDetails": "Detalhes do certificado de património",
      "restorationDetails": "Detalhes do trabalho de restauro",
      "engineNumber": "Número do motor",
      "gearboxType": "Tipo de caixa de velocidades",
      "carbType": "Tipo de carburador",
      "exhaustType": "Tipo de escape",
      "brakeType": "Tipo de travão",
      "roofColor": "Cor do tejadilho (se diferente)",
      "stripeColor": "Cor das faixas",
      "wheelSize": "Tamanho da jante",
      "wheelType": "Tipo de jante",
      "bumperType": "Tipo de para-choques",
      "windowType": "Tipo de vidros",
      "hasStripes": "Com faixas",
      "hasSunroof": "Com teto de abrir",
      "seatType": "Tipo de bancos",
      "interiorColor": "Cor/estofo interior",
      "dashboardType": "Tipo de tablier",
      "steeringWheelType": "Tipo de volante",
      "engineMods": "Modificações do motor",
      "suspensionMods": "Modificações da suspensão",
      "performanceUpgrades": "Melhorias de desempenho",
      "otherModifications": "Outras modificações",
      "rustCondition": "Condição da ferrugem",
      "undersideCondition": "Condição da parte inferior"
    },
    "placeholders": {
      "partNumber": "ex., GHF101, 13H2677",
      "fitsModels": "ex., Mini Cooper, Cooper S, 1275 GT (separados por vírgulas)",
      "color": "ex., Vermelho chama, Verde British Racing",
      "engineSize": "ex., 1275cc",
      "vinNumber": "ex., XAD123456",
      "chassisNumber": "ex., AB-L-12345",
      "buildDate": "ex., março de 1967 ou 15/06/1972",
      "originalColor": "ex., Vermelho tartan",
      "previousOwners": "Número de proprietários anteriores",
      "lastRestorationDate": "ex., verão de 2019 ou 2020",
      "heritageCertNumber": "ex., 12345/ABCD",
      "heritageCertDetails": "Descreva as informações do certificado de património...",
      "restorationDetails": "Descreva o trabalho de restauro realizado...",
      "engineNumber": "ex., 9FXXXX12345",
      "roofColor": "ex., Old English White",
      "stripeColor": "ex., Branco, Preto",
      "interiorColor": "ex., Vinil preto, Tecido bege",
      "engineMods": "Descreva quaisquer modificações do motor (kit de maior cilindrada, cabeça trabalhada, etc.)",
      "suspensionMods": "Descreva modificações da suspensão (rebaixada, reforçada, coilovers, etc.)",
      "performanceUpgrades": "Descreva melhorias de desempenho (turbo, compressor, ECU, etc.)",
      "otherModifications": "Quaisquer outras modificações notáveis"
    },
    "help": {
      "fitsModels": "Com que modelos de Mini é esta peça compatível?",
      "shippingCost": "Deixe em branco se o custo de envio variar conforme a localização",
      "vinNumber": "Número de identificação do veículo",
      "chassisNumber": "Número da chapa da carroçaria/chassis",
      "heritageCertNumber": "Número do certificado BMIHT",
      "restorationDetails": "Inclua detalhes sobre o trabalho realizado, peças substituídas, melhorias, etc."
    },
    "manufacturerOptions": {
      "placeholder": "Selecionar fabricante",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "Outro"
    },
    "partConditionOptions": {
      "placeholder": "Selecionar condição",
      "new": "Novo",
      "usedExcellent": "Usado - Excelente",
      "usedGood": "Usado - Bom",
      "usedFair": "Usado - Razoável",
      "rebuild": "Reconstruído/Recondicionado",
      "core": "Para reconstrução"
    },
    "conditionOptions": {
      "placeholder": "Selecionar condição",
      "new": "Novo",
      "used": "Usado",
      "project": "Projeto",
      "scrap": "Sucata"
    },
    "partTypeOptions": {
      "placeholder": "Selecionar tipo",
      "oem": "OEM (Equipamento original)",
      "aftermarket": "Aftermarket",
      "reproduction": "Reprodução"
    },
    "carbTypeOptions": {
      "placeholder": "Selecionar tipo",
      "singleSu": "SU simples",
      "twinSu": "SU duplo",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "Injeção",
      "other": "Outro"
    },
    "brakeTypeOptions": {
      "placeholder": "Selecionar tipo",
      "standardDrum": "Tambor padrão (4 rodas)",
      "discFront": "Disco à frente, tambor atrás",
      "fourWheelDisc": "Disco nas quatro rodas"
    },
    "rustConditionOptions": {
      "noneVisible": "Nenhuma visível",
      "minorSurface": "Ferrugem superficial ligeira",
      "moderate": "Moderada",
      "significant": "Significativa"
    },
    "undersideConditionOptions": {
      "excellent": "Excelente",
      "good": "Bom",
      "fair": "Razoável",
      "needsWork": "Necessita de trabalho"
    },
    "factoryOptionLabels": {
      "hydrolastic": "Suspensão Hydrolastic",
      "heatedRearWindow": "Óculo traseiro térmico",
      "servoBrakes": "Travões servoassistidos",
      "radio": "Rádio original",
      "fogLights": "Faróis de nevoeiro",
      "woodDash": "Tablier em folheado de madeira",
      "recliningSeats": "Bancos reclináveis",
      "centerConsole": "Consola central"
    },
    "validation": {
      "titleRequired": "O título é obrigatório",
      "cityRequired": "A cidade é obrigatória",
      "descriptionRequired": "A descrição é obrigatória",
      "priceRequired": "O preço é obrigatório (ou marque como grátis)",
      "priceNegative": "O preço não pode ser negativo",
      "yearRequired": "O ano é obrigatório",
      "yearRange": "O ano deve estar entre 1959 e 2000",
      "modelRequired": "O modelo é obrigatório",
      "manufacturerRequired": "O fabricante é obrigatório",
      "colorRequired": "A cor é obrigatória",
      "conditionRequired": "A condição é obrigatória",
      "partConditionRequired": "A condição da peça é obrigatória"
    },
    "toast": {
      "noChangesTitle": "Sem alterações",
      "noChangesBody": "Não foram feitas alterações ao anúncio.",
      "updatedTitle": "Anúncio atualizado",
      "updatedBody": "As suas alterações foram guardadas.",
      "errorTitle": "Erro",
      "errorBody": "Falha ao enviar as alterações. Tente novamente."
    },
    "errors": {
      "notFound": "Anúncio não encontrado",
      "forbidden": "Não tem permissão para editar este anúncio"
    },
    "seo": {
      "title": "Editar {title} - Classic Mini DIY"
    }
  },
  "ru": {
    "pageHeading": "Редактировать объявление",
    "backToListing": "Назад к объявлению",
    "basicInfo": "Основная информация",
    "listingCategory": "Категория объявления",
    "categoryLocked": "Категорию нельзя изменить после создания",
    "modelPlaceholder": "Выберите модель",
    "restorationStatusPlaceholder": "Выберите статус",
    "gearboxPlaceholder": "Выберите тип коробки передач",
    "selectTypePlaceholder": "Выберите тип",
    "selectSizePlaceholder": "Выберите размер",
    "conditionSelectPlaceholder": "Выберите состояние",
    "itemIsFree": "Этот товар бесплатный",
    "freeHelp": "Это объявление будет показано покупателям как «Бесплатно»",
    "descriptionHeading": "Описание",
    "specsHeading": "Характеристики",
    "engineSpecsHeading": "Характеристики двигателя",
    "heritageHeading": "История и происхождение",
    "heritageIntro": "Необязательные сведения, повышающие ценность и подлинность вашего объявления",
    "detailedSpecsHeading": "Подробные характеристики",
    "detailedSpecsIntro": "Добавьте подробные характеристики, чтобы помочь покупателям понять конфигурацию вашего Mini",
    "engineMechanical": "Двигатель и механика",
    "exteriorBody": "Экстерьер и кузов",
    "interior": "Салон",
    "modsHeading": "Модификации и состояние",
    "modsIntro": "Задокументируйте все модификации и дайте оценку состояния",
    "factoryOptions": "Заводские опции",
    "modifications": "Модификации",
    "conditionAssessment": "Оценка состояния",
    "cancel": "Отмена",
    "saveChanges": "Сохранить изменения",
    "fields": {
      "title": "Заголовок объявления *",
      "year": "Год *",
      "yearOptional": "Год",
      "manufacturer": "Производитель *",
      "model": "Модель *",
      "modelOptional": "Модель",
      "partNumber": "Номер детали",
      "partCondition": "Состояние детали *",
      "price": "Цена *",
      "condition": "Состояние *",
      "quantityAvailable": "Доступное количество",
      "fitsModels": "Совместимые модели",
      "partType": "Тип детали",
      "shippingAvailable": "Доставка доступна",
      "shippingCost": "Стоимость доставки",
      "color": "Цвет *",
      "location": "Местоположение *",
      "description": "Описание *",
      "mileage": "Пробег",
      "engineSize": "Объём двигателя",
      "vinNumber": "VIN-номер",
      "chassisNumber": "Номер шасси",
      "buildDate": "Дата выпуска",
      "originalColor": "Оригинальный заводской цвет",
      "previousOwners": "Предыдущие владельцы",
      "restorationStatus": "Статус реставрации",
      "lastRestorationDate": "Дата последней реставрации",
      "heritageCert": "Сертификат происхождения",
      "matchingNumbers": "Совпадающие номера",
      "serviceHistory": "История обслуживания доступна",
      "heritageCertNumber": "Номер сертификата происхождения",
      "heritageCertDetails": "Сведения о сертификате происхождения",
      "restorationDetails": "Сведения о реставрационных работах",
      "engineNumber": "Номер двигателя",
      "gearboxType": "Тип коробки передач",
      "carbType": "Тип карбюратора",
      "exhaustType": "Тип выхлопа",
      "brakeType": "Тип тормозов",
      "roofColor": "Цвет крыши (если отличается)",
      "stripeColor": "Цвет полос",
      "wheelSize": "Размер колёс",
      "wheelType": "Тип колёс",
      "bumperType": "Тип бампера",
      "windowType": "Тип стёкол",
      "hasStripes": "С полосами",
      "hasSunroof": "С люком",
      "seatType": "Тип сидений",
      "interiorColor": "Цвет/обивка салона",
      "dashboardType": "Тип приборной панели",
      "steeringWheelType": "Тип руля",
      "engineMods": "Модификации двигателя",
      "suspensionMods": "Модификации подвески",
      "performanceUpgrades": "Улучшения производительности",
      "otherModifications": "Прочие модификации",
      "rustCondition": "Состояние коррозии",
      "undersideCondition": "Состояние днища"
    },
    "placeholders": {
      "partNumber": "напр., GHF101, 13H2677",
      "fitsModels": "напр., Mini Cooper, Cooper S, 1275 GT (через запятую)",
      "color": "напр., Flame Red, British Racing Green",
      "engineSize": "напр., 1275 куб. см",
      "vinNumber": "напр., XAD123456",
      "chassisNumber": "напр., AB-L-12345",
      "buildDate": "напр., март 1967 или 15.06.1972",
      "originalColor": "напр., Tartan Red",
      "previousOwners": "Число предыдущих владельцев",
      "lastRestorationDate": "напр., лето 2019 или 2020",
      "heritageCertNumber": "напр., 12345/ABCD",
      "heritageCertDetails": "Опишите сведения сертификата происхождения...",
      "restorationDetails": "Опишите выполненные реставрационные работы...",
      "engineNumber": "напр., 9FXXXX12345",
      "roofColor": "напр., Old English White",
      "stripeColor": "напр., Белый, Чёрный",
      "interiorColor": "напр., Чёрный винил, Бежевая ткань",
      "engineMods": "Опишите любые модификации двигателя (увеличение объёма, доработанная головка и т. д.)",
      "suspensionMods": "Опишите модификации подвески (занижение, усиление, койловеры и т. д.)",
      "performanceUpgrades": "Опишите улучшения производительности (турбо, нагнетатель, ЭБУ и т. д.)",
      "otherModifications": "Любые другие заметные модификации"
    },
    "help": {
      "fitsModels": "С какими моделями Mini совместима эта деталь?",
      "shippingCost": "Оставьте пустым, если стоимость доставки зависит от местоположения",
      "vinNumber": "Идентификационный номер транспортного средства",
      "chassisNumber": "Номер таблички кузова/шасси",
      "heritageCertNumber": "Номер сертификата BMIHT",
      "restorationDetails": "Укажите сведения о выполненных работах, заменённых деталях, доработках и т. д."
    },
    "manufacturerOptions": {
      "placeholder": "Выберите производителя",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "Другой"
    },
    "partConditionOptions": {
      "placeholder": "Выберите состояние",
      "new": "Новое",
      "usedExcellent": "Б/у - отличное",
      "usedGood": "Б/у - хорошее",
      "usedFair": "Б/у - удовлетворительное",
      "rebuild": "Восстановлено/отремонтировано",
      "core": "Под восстановление"
    },
    "conditionOptions": {
      "placeholder": "Выберите состояние",
      "new": "Новое",
      "used": "Б/у",
      "project": "Проект",
      "scrap": "На запчасти"
    },
    "partTypeOptions": {
      "placeholder": "Выберите тип",
      "oem": "OEM (оригинальное оборудование)",
      "aftermarket": "Неоригинальное",
      "reproduction": "Реплика"
    },
    "carbTypeOptions": {
      "placeholder": "Выберите тип",
      "singleSu": "Одинарный SU",
      "twinSu": "Двойной SU",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "Впрыск топлива",
      "other": "Другой"
    },
    "brakeTypeOptions": {
      "placeholder": "Выберите тип",
      "standardDrum": "Стандартные барабанные (4 колеса)",
      "discFront": "Дисковые спереди, барабанные сзади",
      "fourWheelDisc": "Дисковые на четырёх колёсах"
    },
    "rustConditionOptions": {
      "noneVisible": "Не видна",
      "minorSurface": "Незначительная поверхностная коррозия",
      "moderate": "Умеренная",
      "significant": "Значительная"
    },
    "undersideConditionOptions": {
      "excellent": "Отличное",
      "good": "Хорошее",
      "fair": "Удовлетворительное",
      "needsWork": "Требует ремонта"
    },
    "factoryOptionLabels": {
      "hydrolastic": "Подвеска Hydrolastic",
      "heatedRearWindow": "Обогрев заднего стекла",
      "servoBrakes": "Тормоза с усилителем",
      "radio": "Оригинальное радио",
      "fogLights": "Противотуманные фары",
      "woodDash": "Приборная панель с деревянным шпоном",
      "recliningSeats": "Откидывающиеся сиденья",
      "centerConsole": "Центральная консоль"
    },
    "validation": {
      "titleRequired": "Заголовок обязателен",
      "cityRequired": "Город обязателен",
      "descriptionRequired": "Описание обязательно",
      "priceRequired": "Цена обязательна (или отметьте как бесплатно)",
      "priceNegative": "Цена не может быть отрицательной",
      "yearRequired": "Год обязателен",
      "yearRange": "Год должен быть между 1959 и 2000",
      "modelRequired": "Модель обязательна",
      "manufacturerRequired": "Производитель обязателен",
      "colorRequired": "Цвет обязателен",
      "conditionRequired": "Состояние обязательно",
      "partConditionRequired": "Состояние детали обязательно"
    },
    "toast": {
      "noChangesTitle": "Нет изменений",
      "noChangesBody": "Изменения в объявление не вносились.",
      "updatedTitle": "Объявление обновлено",
      "updatedBody": "Ваши изменения сохранены.",
      "errorTitle": "Ошибка",
      "errorBody": "Не удалось отправить изменения. Попробуйте ещё раз."
    },
    "errors": {
      "notFound": "Объявление не найдено",
      "forbidden": "У вас нет прав на редактирование этого объявления"
    },
    "seo": {
      "title": "Редактировать {title} - Classic Mini DIY"
    }
  },
  "ja": {
    "pageHeading": "出品を編集",
    "backToListing": "出品に戻る",
    "basicInfo": "基本情報",
    "listingCategory": "出品カテゴリー",
    "categoryLocked": "カテゴリーは作成後に変更できません",
    "modelPlaceholder": "モデルを選択",
    "restorationStatusPlaceholder": "ステータスを選択",
    "gearboxPlaceholder": "ギアボックスの種類を選択",
    "selectTypePlaceholder": "種類を選択",
    "selectSizePlaceholder": "サイズを選択",
    "conditionSelectPlaceholder": "状態を選択",
    "itemIsFree": "この商品は無料です",
    "freeHelp": "この出品は購入者に「無料」と表示されます",
    "descriptionHeading": "説明",
    "specsHeading": "仕様",
    "engineSpecsHeading": "エンジン仕様",
    "heritageHeading": "来歴と由来",
    "heritageIntro": "出品に価値と信頼性を加える任意の詳細情報",
    "detailedSpecsHeading": "詳細仕様",
    "detailedSpecsIntro": "購入者があなたのMiniの構成を理解できるよう詳細仕様を追加してください",
    "engineMechanical": "エンジンとメカニカル",
    "exteriorBody": "外装とボディ",
    "interior": "内装",
    "modsHeading": "改造と状態",
    "modsIntro": "改造内容を記録し、状態評価を提供してください",
    "factoryOptions": "工場オプション",
    "modifications": "改造",
    "conditionAssessment": "状態評価",
    "cancel": "キャンセル",
    "saveChanges": "変更を保存",
    "fields": {
      "title": "出品タイトル *",
      "year": "年式 *",
      "yearOptional": "年式",
      "manufacturer": "メーカー *",
      "model": "モデル *",
      "modelOptional": "モデル",
      "partNumber": "部品番号",
      "partCondition": "部品の状態 *",
      "price": "価格 *",
      "condition": "状態 *",
      "quantityAvailable": "在庫数",
      "fitsModels": "適合モデル",
      "partType": "部品の種類",
      "shippingAvailable": "発送可能",
      "shippingCost": "送料",
      "color": "色 *",
      "location": "所在地 *",
      "description": "説明 *",
      "mileage": "走行距離",
      "engineSize": "排気量",
      "vinNumber": "VIN番号",
      "chassisNumber": "シャシー番号",
      "buildDate": "製造日",
      "originalColor": "オリジナル工場色",
      "previousOwners": "前オーナー数",
      "restorationStatus": "レストア状況",
      "lastRestorationDate": "最終レストア日",
      "heritageCert": "ヘリテージ証明書",
      "matchingNumbers": "マッチングナンバー",
      "serviceHistory": "整備履歴あり",
      "heritageCertNumber": "ヘリテージ証明書番号",
      "heritageCertDetails": "ヘリテージ証明書の詳細",
      "restorationDetails": "レストア作業の詳細",
      "engineNumber": "エンジン番号",
      "gearboxType": "ギアボックスの種類",
      "carbType": "キャブレターの種類",
      "exhaustType": "エキゾーストの種類",
      "brakeType": "ブレーキの種類",
      "roofColor": "ルーフカラー（異なる場合）",
      "stripeColor": "ストライプの色",
      "wheelSize": "ホイールサイズ",
      "wheelType": "ホイールの種類",
      "bumperType": "バンパーの種類",
      "windowType": "ウィンドウの種類",
      "hasStripes": "ストライプあり",
      "hasSunroof": "サンルーフあり",
      "seatType": "シートの種類",
      "interiorColor": "内装色/トリム",
      "dashboardType": "ダッシュボードの種類",
      "steeringWheelType": "ステアリングホイールの種類",
      "engineMods": "エンジン改造",
      "suspensionMods": "サスペンション改造",
      "performanceUpgrades": "性能アップグレード",
      "otherModifications": "その他の改造",
      "rustCondition": "錆の状態",
      "undersideCondition": "下回りの状態"
    },
    "placeholders": {
      "partNumber": "例: GHF101、13H2677",
      "fitsModels": "例: Mini Cooper、Cooper S、1275 GT（カンマ区切り）",
      "color": "例: Flame Red、British Racing Green",
      "engineSize": "例: 1275cc",
      "vinNumber": "例: XAD123456",
      "chassisNumber": "例: AB-L-12345",
      "buildDate": "例: 1967年3月 または 1972/06/15",
      "originalColor": "例: Tartan Red",
      "previousOwners": "前オーナーの人数",
      "lastRestorationDate": "例: 2019年夏 または 2020年",
      "heritageCertNumber": "例: 12345/ABCD",
      "heritageCertDetails": "ヘリテージ証明書の情報を記入してください...",
      "restorationDetails": "実施したレストア作業を記入してください...",
      "engineNumber": "例: 9FXXXX12345",
      "roofColor": "例: Old English White",
      "stripeColor": "例: 白、黒",
      "interiorColor": "例: 黒ビニール、ベージュ生地",
      "engineMods": "エンジン改造を記入してください（ビッグボアキット、ポート加工ヘッドなど）",
      "suspensionMods": "サスペンション改造を記入してください（ローダウン、強化、車高調など）",
      "performanceUpgrades": "性能アップグレードを記入してください（ターボ、スーパーチャージャー、ECUなど）",
      "otherModifications": "その他の注目すべき改造"
    },
    "help": {
      "fitsModels": "この部品はどのMiniモデルに適合しますか?",
      "shippingCost": "送料が所在地によって異なる場合は空欄にしてください",
      "vinNumber": "車両識別番号",
      "chassisNumber": "ボディ/シャシープレート番号",
      "heritageCertNumber": "BMIHT証明書番号",
      "restorationDetails": "実施した作業、交換部品、アップグレードなどの詳細を含めてください。"
    },
    "manufacturerOptions": {
      "placeholder": "メーカーを選択",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "その他"
    },
    "partConditionOptions": {
      "placeholder": "状態を選択",
      "new": "新品",
      "usedExcellent": "中古 - 極上",
      "usedGood": "中古 - 良好",
      "usedFair": "中古 - 並",
      "rebuild": "再生/リファービッシュ",
      "core": "コア（要再生）"
    },
    "conditionOptions": {
      "placeholder": "状態を選択",
      "new": "新品",
      "used": "中古",
      "project": "プロジェクト",
      "scrap": "スクラップ"
    },
    "partTypeOptions": {
      "placeholder": "種類を選択",
      "oem": "OEM（純正）",
      "aftermarket": "アフターマーケット",
      "reproduction": "リプロダクション"
    },
    "carbTypeOptions": {
      "placeholder": "種類を選択",
      "singleSu": "シングルSU",
      "twinSu": "ツインSU",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "燃料噴射",
      "other": "その他"
    },
    "brakeTypeOptions": {
      "placeholder": "種類を選択",
      "standardDrum": "標準ドラム（4輪）",
      "discFront": "フロントディスク、リアドラム",
      "fourWheelDisc": "4輪ディスク"
    },
    "rustConditionOptions": {
      "noneVisible": "視認なし",
      "minorSurface": "軽度の表面錆",
      "moderate": "中程度",
      "significant": "重度"
    },
    "undersideConditionOptions": {
      "excellent": "極上",
      "good": "良好",
      "fair": "並",
      "needsWork": "要修理"
    },
    "factoryOptionLabels": {
      "hydrolastic": "ハイドロラスティックサスペンション",
      "heatedRearWindow": "熱線リアウィンドウ",
      "servoBrakes": "サーボアシストブレーキ",
      "radio": "純正ラジオ",
      "fogLights": "フォグランプ",
      "woodDash": "木目調ダッシュボード",
      "recliningSeats": "リクライニングシート",
      "centerConsole": "センターコンソール"
    },
    "validation": {
      "titleRequired": "タイトルは必須です",
      "cityRequired": "市区町村は必須です",
      "descriptionRequired": "説明は必須です",
      "priceRequired": "価格は必須です（または無料に設定）",
      "priceNegative": "価格を負の値にすることはできません",
      "yearRequired": "年式は必須です",
      "yearRange": "年式は1959年から2000年の間でなければなりません",
      "modelRequired": "モデルは必須です",
      "manufacturerRequired": "メーカーは必須です",
      "colorRequired": "色は必須です",
      "conditionRequired": "状態は必須です",
      "partConditionRequired": "部品の状態は必須です"
    },
    "toast": {
      "noChangesTitle": "変更なし",
      "noChangesBody": "出品に変更はありませんでした。",
      "updatedTitle": "出品を更新しました",
      "updatedBody": "変更が保存されました。",
      "errorTitle": "エラー",
      "errorBody": "変更の送信に失敗しました。もう一度お試しください。"
    },
    "errors": {
      "notFound": "出品が見つかりません",
      "forbidden": "この出品を編集する権限がありません"
    },
    "seo": {
      "title": "{title} を編集 - Classic Mini DIY"
    }
  },
  "zh": {
    "pageHeading": "编辑刊登",
    "backToListing": "返回刊登",
    "basicInfo": "基本信息",
    "listingCategory": "刊登类别",
    "categoryLocked": "创建后无法更改类别",
    "modelPlaceholder": "选择型号",
    "restorationStatusPlaceholder": "选择状态",
    "gearboxPlaceholder": "选择变速箱类型",
    "selectTypePlaceholder": "选择类型",
    "selectSizePlaceholder": "选择尺寸",
    "conditionSelectPlaceholder": "选择状况",
    "itemIsFree": "此物品免费",
    "freeHelp": "此刊登将向买家显示为\"免费\"",
    "descriptionHeading": "描述",
    "specsHeading": "规格",
    "engineSpecsHeading": "发动机规格",
    "heritageHeading": "历史与来源",
    "heritageIntro": "可选的详细信息可为您的刊登增添价值和真实性",
    "detailedSpecsHeading": "详细规格",
    "detailedSpecsIntro": "添加详细规格以帮助买家了解您的Mini的配置",
    "engineMechanical": "发动机与机械",
    "exteriorBody": "外观与车身",
    "interior": "内饰",
    "modsHeading": "改装与状况",
    "modsIntro": "记录任何改装并提供状况评估",
    "factoryOptions": "原厂选装",
    "modifications": "改装",
    "conditionAssessment": "状况评估",
    "cancel": "取消",
    "saveChanges": "保存更改",
    "fields": {
      "title": "刊登标题 *",
      "year": "年份 *",
      "yearOptional": "年份",
      "manufacturer": "制造商 *",
      "model": "型号 *",
      "modelOptional": "型号",
      "partNumber": "零件编号",
      "partCondition": "零件状况 *",
      "price": "价格 *",
      "condition": "状况 *",
      "quantityAvailable": "可售数量",
      "fitsModels": "适配车型",
      "partType": "零件类型",
      "shippingAvailable": "提供配送",
      "shippingCost": "运费",
      "color": "颜色 *",
      "location": "位置 *",
      "description": "描述 *",
      "mileage": "里程",
      "engineSize": "排量",
      "vinNumber": "VIN号码",
      "chassisNumber": "底盘号",
      "buildDate": "制造日期",
      "originalColor": "原厂颜色",
      "previousOwners": "前车主数量",
      "restorationStatus": "修复状态",
      "lastRestorationDate": "最近修复日期",
      "heritageCert": "传承证书",
      "matchingNumbers": "编号匹配",
      "serviceHistory": "有保养记录",
      "heritageCertNumber": "传承证书编号",
      "heritageCertDetails": "传承证书详情",
      "restorationDetails": "修复工作详情",
      "engineNumber": "发动机号",
      "gearboxType": "变速箱类型",
      "carbType": "化油器类型",
      "exhaustType": "排气类型",
      "brakeType": "制动类型",
      "roofColor": "车顶颜色（如不同）",
      "stripeColor": "条纹颜色",
      "wheelSize": "轮毂尺寸",
      "wheelType": "轮毂类型",
      "bumperType": "保险杠类型",
      "windowType": "车窗类型",
      "hasStripes": "带条纹",
      "hasSunroof": "带天窗",
      "seatType": "座椅类型",
      "interiorColor": "内饰颜色/材质",
      "dashboardType": "仪表台类型",
      "steeringWheelType": "方向盘类型",
      "engineMods": "发动机改装",
      "suspensionMods": "悬挂改装",
      "performanceUpgrades": "性能升级",
      "otherModifications": "其他改装",
      "rustCondition": "锈蚀状况",
      "undersideCondition": "底部状况"
    },
    "placeholders": {
      "partNumber": "例如：GHF101、13H2677",
      "fitsModels": "例如：Mini Cooper、Cooper S、1275 GT（用逗号分隔）",
      "color": "例如：火焰红、英国赛车绿",
      "engineSize": "例如：1275cc",
      "vinNumber": "例如：XAD123456",
      "chassisNumber": "例如：AB-L-12345",
      "buildDate": "例如：1967年3月 或 1972/06/15",
      "originalColor": "例如：Tartan Red",
      "previousOwners": "前车主数量",
      "lastRestorationDate": "例如：2019年夏 或 2020年",
      "heritageCertNumber": "例如：12345/ABCD",
      "heritageCertDetails": "描述传承证书信息……",
      "restorationDetails": "描述已完成的修复工作……",
      "engineNumber": "例如：9FXXXX12345",
      "roofColor": "例如：Old English White",
      "stripeColor": "例如：白色、黑色",
      "interiorColor": "例如：黑色乙烯基、米色织物",
      "engineMods": "描述任何发动机改装（大缸径套件、气道加工缸盖等）",
      "suspensionMods": "描述悬挂改装（降低、强化、绞牙等）",
      "performanceUpgrades": "描述性能升级（涡轮、机械增压、ECU等）",
      "otherModifications": "任何其他值得注意的改装"
    },
    "help": {
      "fitsModels": "此零件兼容哪些Mini车型?",
      "shippingCost": "如运费因地区而异，请留空",
      "vinNumber": "车辆识别号码",
      "chassisNumber": "车身/底盘铭牌号码",
      "heritageCertNumber": "BMIHT证书编号",
      "restorationDetails": "包括已完成的工作、更换的零件、升级等详情。"
    },
    "manufacturerOptions": {
      "placeholder": "选择制造商",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "其他"
    },
    "partConditionOptions": {
      "placeholder": "选择状况",
      "new": "全新",
      "usedExcellent": "二手 - 极好",
      "usedGood": "二手 - 良好",
      "usedFair": "二手 - 一般",
      "rebuild": "重建/翻新",
      "core": "核心件（需重建）"
    },
    "conditionOptions": {
      "placeholder": "选择状况",
      "new": "全新",
      "used": "二手",
      "project": "项目车",
      "scrap": "报废"
    },
    "partTypeOptions": {
      "placeholder": "选择类型",
      "oem": "OEM（原厂配件）",
      "aftermarket": "副厂",
      "reproduction": "复刻"
    },
    "carbTypeOptions": {
      "placeholder": "选择类型",
      "singleSu": "单SU",
      "twinSu": "双SU",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "燃油喷射",
      "other": "其他"
    },
    "brakeTypeOptions": {
      "placeholder": "选择类型",
      "standardDrum": "标准鼓刹（四轮）",
      "discFront": "前盘后鼓",
      "fourWheelDisc": "四轮盘刹"
    },
    "rustConditionOptions": {
      "noneVisible": "无可见锈蚀",
      "minorSurface": "轻微表面锈",
      "moderate": "中度",
      "significant": "严重"
    },
    "undersideConditionOptions": {
      "excellent": "极好",
      "good": "良好",
      "fair": "一般",
      "needsWork": "需要处理"
    },
    "factoryOptionLabels": {
      "hydrolastic": "液压悬挂",
      "heatedRearWindow": "后窗加热",
      "servoBrakes": "助力制动",
      "radio": "原厂收音机",
      "fogLights": "雾灯",
      "woodDash": "木饰面仪表台",
      "recliningSeats": "可调节座椅",
      "centerConsole": "中央控制台"
    },
    "validation": {
      "titleRequired": "标题为必填项",
      "cityRequired": "城市为必填项",
      "descriptionRequired": "描述为必填项",
      "priceRequired": "价格为必填项（或标记为免费）",
      "priceNegative": "价格不能为负",
      "yearRequired": "年份为必填项",
      "yearRange": "年份必须在1959到2000之间",
      "modelRequired": "型号为必填项",
      "manufacturerRequired": "制造商为必填项",
      "colorRequired": "颜色为必填项",
      "conditionRequired": "状况为必填项",
      "partConditionRequired": "零件状况为必填项"
    },
    "toast": {
      "noChangesTitle": "无更改",
      "noChangesBody": "未对刊登进行任何更改。",
      "updatedTitle": "刊登已更新",
      "updatedBody": "您的更改已保存。",
      "errorTitle": "错误",
      "errorBody": "提交更改失败。请重试。"
    },
    "errors": {
      "notFound": "未找到刊登",
      "forbidden": "您无权编辑此刊登"
    },
    "seo": {
      "title": "编辑 {title} - Classic Mini DIY"
    }
  },
  "ko": {
    "pageHeading": "매물 수정",
    "backToListing": "매물로 돌아가기",
    "basicInfo": "기본 정보",
    "listingCategory": "매물 카테고리",
    "categoryLocked": "생성 후에는 카테고리를 변경할 수 없습니다",
    "modelPlaceholder": "모델 선택",
    "restorationStatusPlaceholder": "상태 선택",
    "gearboxPlaceholder": "변속기 유형 선택",
    "selectTypePlaceholder": "유형 선택",
    "selectSizePlaceholder": "크기 선택",
    "conditionSelectPlaceholder": "상태 선택",
    "itemIsFree": "이 물품은 무료입니다",
    "freeHelp": "이 매물은 구매자에게 \"무료\"로 표시됩니다",
    "descriptionHeading": "설명",
    "specsHeading": "사양",
    "engineSpecsHeading": "엔진 사양",
    "heritageHeading": "내력 및 출처",
    "heritageIntro": "매물의 가치와 진정성을 더하는 선택 정보",
    "detailedSpecsHeading": "상세 사양",
    "detailedSpecsIntro": "구매자가 Mini의 구성을 이해할 수 있도록 상세 사양을 추가하세요",
    "engineMechanical": "엔진 및 기계",
    "exteriorBody": "외장 및 차체",
    "interior": "실내",
    "modsHeading": "개조 및 상태",
    "modsIntro": "개조 내용을 기록하고 상태 평가를 제공하세요",
    "factoryOptions": "공장 옵션",
    "modifications": "개조",
    "conditionAssessment": "상태 평가",
    "cancel": "취소",
    "saveChanges": "변경 사항 저장",
    "fields": {
      "title": "매물 제목 *",
      "year": "연식 *",
      "yearOptional": "연식",
      "manufacturer": "제조사 *",
      "model": "모델 *",
      "modelOptional": "모델",
      "partNumber": "부품 번호",
      "partCondition": "부품 상태 *",
      "price": "가격 *",
      "condition": "상태 *",
      "quantityAvailable": "재고 수량",
      "fitsModels": "호환 모델",
      "partType": "부품 유형",
      "shippingAvailable": "배송 가능",
      "shippingCost": "배송 비용",
      "color": "색상 *",
      "location": "위치 *",
      "description": "설명 *",
      "mileage": "주행 거리",
      "engineSize": "배기량",
      "vinNumber": "VIN 번호",
      "chassisNumber": "섀시 번호",
      "buildDate": "제조일",
      "originalColor": "원래 공장 색상",
      "previousOwners": "이전 소유자",
      "restorationStatus": "복원 상태",
      "lastRestorationDate": "마지막 복원일",
      "heritageCert": "헤리티지 인증서",
      "matchingNumbers": "번호 일치",
      "serviceHistory": "정비 이력 있음",
      "heritageCertNumber": "헤리티지 인증서 번호",
      "heritageCertDetails": "헤리티지 인증서 세부 정보",
      "restorationDetails": "복원 작업 세부 정보",
      "engineNumber": "엔진 번호",
      "gearboxType": "변속기 유형",
      "carbType": "기화기 유형",
      "exhaustType": "배기 유형",
      "brakeType": "브레이크 유형",
      "roofColor": "지붕 색상 (다른 경우)",
      "stripeColor": "스트라이프 색상",
      "wheelSize": "휠 크기",
      "wheelType": "휠 유형",
      "bumperType": "범퍼 유형",
      "windowType": "창문 유형",
      "hasStripes": "스트라이프 있음",
      "hasSunroof": "선루프 있음",
      "seatType": "시트 유형",
      "interiorColor": "실내 색상/트림",
      "dashboardType": "대시보드 유형",
      "steeringWheelType": "스티어링 휠 유형",
      "engineMods": "엔진 개조",
      "suspensionMods": "서스펜션 개조",
      "performanceUpgrades": "성능 업그레이드",
      "otherModifications": "기타 개조",
      "rustCondition": "녹 상태",
      "undersideCondition": "하부 상태"
    },
    "placeholders": {
      "partNumber": "예: GHF101, 13H2677",
      "fitsModels": "예: Mini Cooper, Cooper S, 1275 GT (쉼표로 구분)",
      "color": "예: Flame Red, British Racing Green",
      "engineSize": "예: 1275cc",
      "vinNumber": "예: XAD123456",
      "chassisNumber": "예: AB-L-12345",
      "buildDate": "예: 1967년 3월 또는 1972/06/15",
      "originalColor": "예: Tartan Red",
      "previousOwners": "이전 소유자 수",
      "lastRestorationDate": "예: 2019년 여름 또는 2020년",
      "heritageCertNumber": "예: 12345/ABCD",
      "heritageCertDetails": "헤리티지 인증서 정보를 설명하세요...",
      "restorationDetails": "완료된 복원 작업을 설명하세요...",
      "engineNumber": "예: 9FXXXX12345",
      "roofColor": "예: Old English White",
      "stripeColor": "예: 흰색, 검은색",
      "interiorColor": "예: 검정 비닐, 베이지 천",
      "engineMods": "엔진 개조 내용을 설명하세요 (빅 보어 키트, 포팅 헤드 등)",
      "suspensionMods": "서스펜션 개조 내용을 설명하세요 (로우다운, 강화, 코일오버 등)",
      "performanceUpgrades": "성능 업그레이드를 설명하세요 (터보, 슈퍼차저, ECU 등)",
      "otherModifications": "기타 주목할 만한 개조"
    },
    "help": {
      "fitsModels": "이 부품은 어떤 Mini 모델과 호환됩니까?",
      "shippingCost": "배송 비용이 위치에 따라 다른 경우 비워 두세요",
      "vinNumber": "차량 식별 번호",
      "chassisNumber": "차체/섀시 플레이트 번호",
      "heritageCertNumber": "BMIHT 인증서 번호",
      "restorationDetails": "수행한 작업, 교체한 부품, 업그레이드 등에 대한 세부 정보를 포함하세요."
    },
    "manufacturerOptions": {
      "placeholder": "제조사 선택",
      "morris": "Morris",
      "austin": "Austin",
      "rover": "Rover",
      "leyland": "Leyland",
      "innocenti": "Innocenti",
      "wolseley": "Wolseley",
      "riley": "Riley",
      "other": "기타"
    },
    "partConditionOptions": {
      "placeholder": "상태 선택",
      "new": "신품",
      "usedExcellent": "중고 - 최상",
      "usedGood": "중고 - 양호",
      "usedFair": "중고 - 보통",
      "rebuild": "재생/리퍼비시",
      "core": "코어 (재생 필요)"
    },
    "conditionOptions": {
      "placeholder": "상태 선택",
      "new": "신품",
      "used": "중고",
      "project": "프로젝트",
      "scrap": "폐차"
    },
    "partTypeOptions": {
      "placeholder": "유형 선택",
      "oem": "OEM (정품)",
      "aftermarket": "애프터마켓",
      "reproduction": "복제품"
    },
    "carbTypeOptions": {
      "placeholder": "유형 선택",
      "singleSu": "싱글 SU",
      "twinSu": "트윈 SU",
      "weber": "Weber",
      "stromberg": "Stromberg",
      "fuelInjection": "연료 분사",
      "other": "기타"
    },
    "brakeTypeOptions": {
      "placeholder": "유형 선택",
      "standardDrum": "표준 드럼 (4륜)",
      "discFront": "전륜 디스크, 후륜 드럼",
      "fourWheelDisc": "4륜 디스크"
    },
    "rustConditionOptions": {
      "noneVisible": "보이지 않음",
      "minorSurface": "경미한 표면 녹",
      "moderate": "보통",
      "significant": "심각함"
    },
    "undersideConditionOptions": {
      "excellent": "최상",
      "good": "양호",
      "fair": "보통",
      "needsWork": "작업 필요"
    },
    "factoryOptionLabels": {
      "hydrolastic": "하이드로래스틱 서스펜션",
      "heatedRearWindow": "열선 뒷유리",
      "servoBrakes": "서보 보조 브레이크",
      "radio": "정품 라디오",
      "fogLights": "안개등",
      "woodDash": "우드 베니어 대시보드",
      "recliningSeats": "리클라이닝 시트",
      "centerConsole": "센터 콘솔"
    },
    "validation": {
      "titleRequired": "제목은 필수입니다",
      "cityRequired": "도시는 필수입니다",
      "descriptionRequired": "설명은 필수입니다",
      "priceRequired": "가격은 필수입니다 (또는 무료로 표시)",
      "priceNegative": "가격은 음수일 수 없습니다",
      "yearRequired": "연식은 필수입니다",
      "yearRange": "연식은 1959년에서 2000년 사이여야 합니다",
      "modelRequired": "모델은 필수입니다",
      "manufacturerRequired": "제조사는 필수입니다",
      "colorRequired": "색상은 필수입니다",
      "conditionRequired": "상태는 필수입니다",
      "partConditionRequired": "부품 상태는 필수입니다"
    },
    "toast": {
      "noChangesTitle": "변경 없음",
      "noChangesBody": "매물에 변경 사항이 없습니다.",
      "updatedTitle": "매물 업데이트됨",
      "updatedBody": "변경 사항이 저장되었습니다.",
      "errorTitle": "오류",
      "errorBody": "변경 사항 제출에 실패했습니다. 다시 시도해 주세요."
    },
    "errors": {
      "notFound": "매물을 찾을 수 없습니다",
      "forbidden": "이 매물을 수정할 권한이 없습니다"
    },
    "seo": {
      "title": "{title} 수정 - Classic Mini DIY"
    }
  }
}
</i18n>
