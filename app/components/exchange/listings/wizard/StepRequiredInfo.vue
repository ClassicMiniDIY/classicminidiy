<template>
  <div>
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-x-8">
      <!-- LEFT COLUMN: Form Fields -->
      <div class="lg:col-span-3 space-y-6">
    <!-- Title -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('titleLabel') }}</legend>
      <input
        v-model="form.title"
        type="text"
        class="input input-bordered w-full"
        :class="{ 'input-error': errors.title }"
        :placeholder="titlePlaceholder"
        maxlength="100"
        :aria-invalid="!!errors.title"
        :aria-describedby="errors.title ? 'title-error' : undefined"
      />
      <p v-if="errors.title" id="title-error" class="text-error text-sm mt-1">{{ errors.title }}</p>
    </fieldset>

    <!-- Price -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend flex items-center gap-2">
        <span>{{ t('priceLabel') }}</span>
        <span class="tooltip tooltip-right" :data-tip="t('priceTooltip', { currency: form.currency })">
          <i class="fas fa-circle-info text-base-content/60"></i>
        </span>
      </legend>
      <label class="label cursor-pointer justify-start gap-3 mb-2">
        <input type="checkbox" class="toggle toggle-primary" :checked="isFree" @change="toggleFree" />
        <span class="label-text font-medium">{{ t('itemIsFree') }}</span>
      </label>
      <div v-if="!isFree" class="join w-full max-w-xs">
        <span class="join-item btn btn-disabled">{{ currencySymbol }}</span>
        <input
          v-model.number="form.price"
          type="number"
          class="input input-bordered join-item w-full"
          :class="{ 'input-error': errors.price }"
          placeholder="0"
          min="1"
          :aria-invalid="!!errors.price"
          :aria-describedby="errors.price ? 'price-error' : undefined"
        />
      </div>
      <p v-if="!isFree" class="text-xs text-base-content/60 mt-1">
        {{ t('pricedInPrefix') }} <span class="font-semibold">{{ form.currency }}</span> {{ t('pricedInSuffix') }}
        <NuxtLink to="/profile/edit" class="link link-primary">{{ t('changeCurrency') }}</NuxtLink>
      </p>
      <p v-if="isFree" class="text-sm text-success mt-1">{{ t('freeNotice') }}</p>
      <p v-if="errors.price" id="price-error" class="text-error text-sm mt-1">{{ errors.price }}</p>
    </fieldset>

    <!-- Vehicle-specific required fields -->
    <template v-if="category === 'vehicle'">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('yearLabel') }}</legend>
          <input
            v-model.number="form.year"
            type="number"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.year }"
            placeholder="1965"
            min="1959"
            max="2000"
            :aria-invalid="!!errors.year"
            :aria-describedby="errors.year ? 'year-error' : undefined"
          />
          <p v-if="errors.year" id="year-error" class="text-error text-sm mt-1">{{ errors.year }}</p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('manufacturerLabel') }}</legend>
          <select
            v-model="form.manufacturer"
            class="select select-bordered w-full"
            :class="{ 'select-error': errors.manufacturer }"
            :aria-invalid="!!errors.manufacturer"
            :aria-describedby="errors.manufacturer ? 'manufacturer-error' : undefined"
          >
            <option value="">{{ t('selectPlaceholder') }}</option>
            <option value="austin">Austin</option>
            <option value="morris">Morris</option>
            <option value="rover">Rover</option>
            <option value="leyland">Leyland</option>
            <option value="innocenti">Innocenti</option>
            <option value="wolseley">Wolseley</option>
            <option value="riley">Riley</option>
            <option value="other">{{ t('otherOption') }}</option>
          </select>
          <p v-if="errors.manufacturer" id="manufacturer-error" class="text-error text-sm mt-1">
            {{ errors.manufacturer }}
          </p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('modelLabel') }}</legend>
          <select
            v-model="form.model"
            class="select select-bordered w-full"
            :class="{ 'select-error': errors.model }"
            :aria-invalid="!!errors.model"
            :aria-describedby="errors.model ? 'model-error' : undefined"
          >
            <option value="">{{ t('selectPlaceholder') }}</option>
            <option value="Mini">Mini</option>
            <option value="Mini Cooper">Mini Cooper</option>
            <option value="Mini Cooper S">Mini Cooper S</option>
            <option value="Clubman">Clubman</option>
            <option value="Clubman GT">Clubman GT</option>
            <option value="1275 GT">1275 GT</option>
            <option value="Mini Moke">Mini Moke</option>
            <option value="Mini Van">Mini Van</option>
            <option value="Mini Pickup">Mini Pickup</option>
            <option value="Mini Traveller">Mini Traveller</option>
            <option value="Mini Countryman">Mini Countryman</option>
            <option value="Riley Elf">Riley Elf</option>
            <option value="Wolseley Hornet">Wolseley Hornet</option>
            <option value="Other">{{ t('otherOption') }}</option>
          </select>
          <p v-if="errors.model" id="model-error" class="text-error text-sm mt-1">{{ errors.model }}</p>
        </fieldset>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('mileageLabel') }}</legend>
          <input
            v-model.number="form.mileage"
            type="number"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.mileage }"
            placeholder="45000"
            min="0"
            :aria-invalid="!!errors.mileage"
            :aria-describedby="errors.mileage ? 'mileage-error' : undefined"
          />
          <p v-if="errors.mileage" id="mileage-error" class="text-error text-sm mt-1">{{ errors.mileage }}</p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('exteriorColorLabel') }}</legend>
          <input
            v-model="form.color"
            type="text"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.color }"
            :placeholder="t('colorPlaceholder')"
            :aria-invalid="!!errors.color"
            :aria-describedby="errors.color ? 'color-error' : undefined"
          />
          <p v-if="errors.color" id="color-error" class="text-error text-sm mt-1">{{ errors.color }}</p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('conditionLabel') }}</legend>
          <select
            v-model="form.condition"
            class="select select-bordered w-full"
            :class="{ 'select-error': errors.condition }"
            :aria-invalid="!!errors.condition"
            :aria-describedby="errors.condition ? 'condition-error' : undefined"
          >
            <option value="">{{ t('selectPlaceholder') }}</option>
            <option value="excellent">{{ t('vehicleCondExcellent') }}</option>
            <option value="good">{{ t('vehicleCondGood') }}</option>
            <option value="fair">{{ t('vehicleCondFair') }}</option>
            <option value="project">{{ t('vehicleCondProject') }}</option>
          </select>
          <p v-if="errors.condition" id="condition-error" class="text-error text-sm mt-1">{{ errors.condition }}</p>
        </fieldset>
      </div>
    </template>

    <!-- Engine-specific fields -->
    <template v-if="category === 'engine'">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('engineSeriesLabel') }}</legend>
          <select
            v-model="form.engineSeries"
            class="select select-bordered w-full"
            :class="{ 'select-error': errors.engineSeries }"
            :aria-invalid="!!errors.engineSeries"
            :aria-describedby="errors.engineSeries ? 'engineSeries-error' : undefined"
          >
            <option value="">{{ t('selectSeriesPlaceholder') }}</option>
            <option value="A-Series">A-Series</option>
            <option value="A+-Series">A+-Series</option>
          </select>
          <p v-if="errors.engineSeries" id="engineSeries-error" class="text-error text-sm mt-1">
            {{ errors.engineSeries }}
          </p>
          <p class="text-xs text-base-content/60 mt-1">
            {{ t('engineSeriesHelp') }}
          </p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('engineDisplacementLabel') }}</legend>
          <select
            v-model="form.engineDisplacement"
            class="select select-bordered w-full"
            :class="{ 'select-error': errors.engineDisplacement }"
            :aria-invalid="!!errors.engineDisplacement"
            :aria-describedby="errors.engineDisplacement ? 'engineDisplacement-error' : undefined"
          >
            <option value="">{{ t('selectDisplacementPlaceholder') }}</option>
            <optgroup :label="t('displacementStandard')">
              <option value="850cc">850cc</option>
              <option value="997cc">997cc</option>
              <option value="998cc">998cc</option>
              <option value="1098cc">1098cc</option>
              <option value="1275cc">1275cc</option>
            </optgroup>
            <optgroup :label="t('displacement998Overbore')">
              <option value="1014cc">1014cc</option>
              <option value="1030cc">1030cc</option>
              <option value="1046cc">1046cc</option>
              <option value="1062cc">1062cc</option>
            </optgroup>
            <optgroup :label="t('displacement1100Overbore')">
              <option value="1114cc">1114cc</option>
              <option value="1132cc">1132cc</option>
              <option value="1149cc">1149cc</option>
              <option value="1167cc">1167cc</option>
              <option value="1216cc">1216cc</option>
            </optgroup>
            <optgroup :label="t('displacement1275Overbore')">
              <option value="1293cc">1293cc</option>
              <option value="1302cc">1302cc</option>
              <option value="1311cc">1311cc</option>
              <option value="1330cc">1330cc</option>
              <option value="1361cc">1361cc</option>
              <option value="1379cc">1379cc</option>
              <option value="1398cc">1398cc</option>
              <option value="1406cc">1406cc</option>
              <option value="1426cc">1426cc</option>
              <option value="1440cc">1440cc</option>
              <option value="1460cc">1460cc</option>
              <option value="1479cc">1479cc</option>
            </optgroup>
            <optgroup :label="t('displacementOther')">
              <option value="other">{{ t('otherUnknownOption') }}</option>
            </optgroup>
          </select>
          <p v-if="errors.engineDisplacement" id="engineDisplacement-error" class="text-error text-sm mt-1">
            {{ errors.engineDisplacement }}
          </p>
        </fieldset>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('conditionLabel') }}</legend>
          <select
            v-model="form.condition"
            class="select select-bordered w-full"
            :class="{ 'select-error': errors.condition }"
            :aria-invalid="!!errors.condition"
            :aria-describedby="errors.condition ? 'condition-error' : undefined"
          >
            <option value="">{{ t('selectConditionPlaceholder') }}</option>
            <option value="rebuilt">{{ t('engineCondRebuilt') }}</option>
            <option value="running">{{ t('engineCondRunning') }}</option>
            <option value="running_fair">{{ t('engineCondRunningFair') }}</option>
            <option value="not_running">{{ t('engineCondNotRunning') }}</option>
            <option value="core">{{ t('engineCondCore') }}</option>
            <option value="parts_only">{{ t('engineCondPartsOnly') }}</option>
          </select>
          <p v-if="errors.condition" id="condition-error" class="text-error text-sm mt-1">{{ errors.condition }}</p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('yearOptionalLabel') }}</legend>
          <input
            v-model.number="form.year"
            type="number"
            class="input input-bordered w-full"
            placeholder="1965"
            min="1959"
            max="2000"
          />
        </fieldset>
      </div>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">{{ t('enginePlateLabel') }}</legend>
        <input
          v-model="form.enginePlateDetails"
          type="text"
          class="input input-bordered w-full"
          :class="{ 'input-error': errors.enginePlateDetails }"
          :placeholder="t('enginePlatePlaceholder')"
          :aria-invalid="!!errors.enginePlateDetails"
          :aria-describedby="errors.enginePlateDetails ? 'enginePlateDetails-error' : undefined"
        />
        <p v-if="errors.enginePlateDetails" id="enginePlateDetails-error" class="text-error text-sm mt-1">
          {{ errors.enginePlateDetails }}
        </p>
        <p class="text-xs text-base-content/60 mt-1">{{ t('enginePlateHelp') }}</p>
      </fieldset>
    </template>

    <!-- Parts-specific fields -->
    <template v-if="category === 'parts'">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">{{ t('partConditionLabel') }}</legend>
        <select
          v-model="form.partCondition"
          class="select select-bordered w-full"
          :class="{ 'select-error': errors.partCondition }"
          :aria-invalid="!!errors.partCondition"
          :aria-describedby="errors.partCondition ? 'partCondition-error' : undefined"
        >
          <option value="">{{ t('selectConditionPlaceholder') }}</option>
          <option value="new">{{ t('partCondNew') }}</option>
          <option value="used_excellent">{{ t('partCondUsedExcellent') }}</option>
          <option value="used_good">{{ t('partCondUsedGood') }}</option>
          <option value="used_fair">{{ t('partCondUsedFair') }}</option>
          <option value="rebuild">{{ t('partCondRebuild') }}</option>
          <option value="core">{{ t('partCondCore') }}</option>
        </select>
        <p v-if="errors.partCondition" id="partCondition-error" class="text-error text-sm mt-1">
          {{ errors.partCondition }}
        </p>
      </fieldset>
    </template>

    <!-- Location -->
    <div>
      <ExchangeListingsLocationAutocomplete v-model="locationModel" :error="errors.city" />
    </div>

    <!-- Description -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('descriptionLabel') }}</legend>
      <textarea
        v-model="form.description"
        class="textarea textarea-bordered w-full h-40"
        :class="{ 'textarea-error': errors.description }"
        :placeholder="descriptionPlaceholder"
        :aria-invalid="!!errors.description"
        :aria-describedby="errors.description ? 'description-error' : undefined"
      ></textarea>
      <p v-if="errors.description" id="description-error" class="text-error text-sm mt-1">{{ errors.description }}</p>
      <p class="text-sm text-base-content/70 mt-1">
        {{ t('descriptionHelp') }}
      </p>
    </fieldset>

      </div>

      <!-- RIGHT COLUMN: Photos (sticky on desktop) -->
      <div class="lg:col-span-2 lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-6">
    <!-- Photos Section -->
    <div>
      <h3 class="text-lg font-bold mb-4">{{ t('photosLabel') }}</h3>
      <p class="text-base-content/70 mb-4">
        {{ tier === 'paid' ? t('tierPremium') : t('tierFree') }} {{ t('tierAllowsUpTo') }}
        <strong>{{ category === 'vehicle' ? t('photosPerSection', { count: photoLimit }) : t('photosTotal', { count: photoLimit }) }}</strong
        >.
      </p>
      <p v-if="errors.photos" class="text-error text-sm mb-4">{{ errors.photos }}</p>

      <!-- Vehicle: 4 photo categories -->
      <div v-if="category === 'vehicle'" class="space-y-6">
        <ExchangeListingsWizardPhotoUploadSection
          v-for="section in photoSections"
          :key="section.id"
          :title="section.title"
          :description="section.description"
          :photos="photosModel[section.id as keyof typeof photosModel]"
          :max-photos="photoLimit"
          @update:photos="updatePhotos(section.id, $event)"
        />
      </div>

      <!-- Engine/Parts: single photo upload -->
      <div v-else>
        <ExchangeListingsWizardPhotoUploadSection
          :title="t('photosLabel')"
          :description="t('singleUploadDescription')"
          :photos="allPhotosFlat"
          :max-photos="photoLimit"
          @update:photos="updateAllPhotos"
        />
      </div>
    </div>

      </div>
    </div>

    <!-- Navigation -->
    <div class="flex justify-between pt-8">
      <button type="button" class="btn btn-ghost" @click="$emit('back')">
        <i class="fas fa-arrow-left"></i>
        {{ t('back') }}
      </button>
      <div class="flex gap-2">
        <button type="button" class="btn btn-outline" @click="$emit('save-draft')" :disabled="savingDraft">
          <span v-if="savingDraft" class="loading loading-spinner loading-sm"></span>
          <i v-else class="fas fa-bookmark"></i>
          {{ t('saveDraft') }}
        </button>
        <button type="button" class="btn btn-primary" @click="$emit('next')">
          {{ t('continue') }}
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { OptimizeResult } from '~/utils/imageOptimizer';

  const { t } = useI18n();

  const props = defineProps<{
    modelValue: any;
    photos: {
      body: OptimizeResult[];
      engine: OptimizeResult[];
      interior: OptimizeResult[];
      details: OptimizeResult[];
    };
    location: any;
    category: 'vehicle' | 'engine' | 'parts' | '';
    tier: 'free' | 'paid';
    errors: Record<string, string>;
    savingDraft?: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: any];
    'update:photos': [value: any];
    'update:location': [value: any];
    next: [];
    back: [];
    'save-draft': [];
  }>();

  const { SUPPORTED_CURRENCIES } = useCurrency();
  const { capture } = usePostHog();

  // Free listing toggle
  const isFree = computed(() => form.value.price === 0);

  const toggleFree = (event: Event) => {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      form.value.price = 0;
    } else {
      form.value.price = null;
    }
  };

  // Two-way binding helpers
  const form = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
  });

  const photosModel = computed({
    get: () => props.photos,
    set: (value) => emit('update:photos', value),
  });

  const locationModel = computed({
    get: () => props.location,
    set: (value) => emit('update:location', value),
  });

  // Photo limit based on tier and category
  const photoLimit = computed(() => {
    if (props.category === 'vehicle') {
      return props.tier === 'paid' ? 20 : 5;
    }
    return props.tier === 'paid' ? 15 : 10;
  });

  // Currency symbol
  const currencySymbol = computed(() => {
    const curr = SUPPORTED_CURRENCIES.find((c) => c.code === form.value.currency);
    return curr?.symbol || '$';
  });

  // Placeholders
  const titlePlaceholder = computed(() => {
    switch (props.category) {
      case 'vehicle':
        return t('titlePlaceholderVehicle');
      case 'engine':
        return t('titlePlaceholderEngine');
      case 'parts':
        return t('titlePlaceholderParts');
      default:
        return t('titlePlaceholderDefault');
    }
  });

  const descriptionPlaceholder = computed(() => {
    switch (props.category) {
      case 'vehicle':
        return t('descriptionPlaceholderVehicle');
      case 'engine':
        return t('descriptionPlaceholderEngine');
      case 'parts':
        return t('descriptionPlaceholderParts');
      default:
        return t('descriptionPlaceholderDefault');
    }
  });

  // Photo sections for vehicles
  const photoSections = computed(() => [
    { id: 'body', title: t('sectionBodyTitle'), description: t('sectionBodyDesc') },
    { id: 'engine', title: t('sectionEngineTitle'), description: t('sectionEngineDesc') },
    { id: 'interior', title: t('sectionInteriorTitle'), description: t('sectionInteriorDesc') },
    { id: 'details', title: t('sectionDetailsTitle'), description: t('sectionDetailsDesc') },
  ]);

  // For non-vehicle categories, flatten photos
  const allPhotosFlat = computed(() => {
    return [...props.photos.body, ...props.photos.engine, ...props.photos.interior, ...props.photos.details];
  });

  // Track photo count changes for analytics
  const previousPhotoCount = ref(0);

  const trackPhotosIfChanged = (newPhotos: typeof props.photos) => {
    const totalPhotos = Object.values(newPhotos).reduce((sum, arr) => sum + arr.length, 0);

    // Only track if photos were added (not removed)
    if (totalPhotos > previousPhotoCount.value) {
      const categoriesWithPhotos = Object.entries(newPhotos)
        .filter(([, arr]) => arr.length > 0)
        .map(([key]) => key);

      capture('photos_uploaded', {
        count: totalPhotos,
        categories: categoriesWithPhotos,
      });
    }

    previousPhotoCount.value = totalPhotos;
  };

  const updatePhotos = (sectionId: string, files: File[]) => {
    const newPhotos = {
      ...props.photos,
      [sectionId]: files,
    };
    emit('update:photos', newPhotos);
    trackPhotosIfChanged(newPhotos);
  };

  const updateAllPhotos = (files: File[]) => {
    // For non-vehicle, store all in 'body' category
    const newPhotos = {
      body: files,
      engine: [],
      interior: [],
      details: [],
    };
    emit('update:photos', newPhotos);
    trackPhotosIfChanged(newPhotos);
  };

  // Initialize previous photo count
  onMounted(() => {
    previousPhotoCount.value = Object.values(props.photos).reduce((sum, arr) => sum + arr.length, 0);
  });
</script>

<i18n lang="json">
{
  "en": {
    "titleLabel": "Listing Title *",
    "priceLabel": "Price *",
    "priceTooltip": "Your listings are priced in {currency} (from your profile). To change it, update your profile.",
    "itemIsFree": "This item is free",
    "pricedInPrefix": "Priced in",
    "pricedInSuffix": "— set from your profile.",
    "changeCurrency": "Change currency in profile",
    "freeNotice": "This listing will show as \"Free\" to buyers",
    "yearLabel": "Year *",
    "manufacturerLabel": "Manufacturer *",
    "modelLabel": "Model *",
    "selectPlaceholder": "Select...",
    "otherOption": "Other",
    "mileageLabel": "Mileage *",
    "exteriorColorLabel": "Exterior Color *",
    "colorPlaceholder": "Tartan Red",
    "conditionLabel": "Condition *",
    "vehicleCondExcellent": "Excellent - Concours/Show Quality",
    "vehicleCondGood": "Good - Daily Driver Quality",
    "vehicleCondFair": "Fair - Needs Some Work",
    "vehicleCondProject": "Project - Needs Restoration",
    "engineSeriesLabel": "Engine Series *",
    "selectSeriesPlaceholder": "Select series...",
    "engineSeriesHelp": "A+ engines (1980+) have improved oil seals and revised internals",
    "engineDisplacementLabel": "Engine Displacement *",
    "selectDisplacementPlaceholder": "Select displacement...",
    "displacementStandard": "Standard Sizes",
    "displacement998Overbore": "998 Overbore",
    "displacement1100Overbore": "1100 Overbore",
    "displacement1275Overbore": "1275 Overbore",
    "displacementOther": "Other",
    "otherUnknownOption": "Other / Unknown",
    "selectConditionPlaceholder": "Select condition...",
    "engineCondRebuilt": "Rebuilt / Reconditioned",
    "engineCondRunning": "Running - Good Condition",
    "engineCondRunningFair": "Running - Fair Condition",
    "engineCondNotRunning": "Not Running - Complete",
    "engineCondCore": "Core / For Rebuild",
    "engineCondPartsOnly": "For Parts Only",
    "yearOptionalLabel": "Year (Optional)",
    "enginePlateLabel": "Engine Plate Details *",
    "enginePlatePlaceholder": "e.g., 12H397, 99H, AEG prefix...",
    "enginePlateHelp": "Enter the engine number/prefix from the engine plate if visible",
    "partConditionLabel": "Part Condition *",
    "partCondNew": "New - Unused",
    "partCondUsedExcellent": "Used - Excellent Condition",
    "partCondUsedGood": "Used - Good Condition",
    "partCondUsedFair": "Used - Fair Condition",
    "partCondRebuild": "Rebuild / Rebuildable",
    "partCondCore": "Core / For Parts",
    "descriptionLabel": "Description *",
    "descriptionHelp": "Be detailed! Include history, known issues, recent work, and why you're selling.",
    "photosLabel": "Photos *",
    "tierPremium": "Premium",
    "tierFree": "Free",
    "tierAllowsUpTo": "tier allows up to",
    "photosPerSection": "{count} photos per section",
    "photosTotal": "{count} photos total",
    "singleUploadDescription": "Add photos of your item from multiple angles",
    "sectionBodyTitle": "Body & Exterior",
    "sectionBodyDesc": "Show all angles, paint condition, any damage",
    "sectionEngineTitle": "Engine Bay",
    "sectionEngineDesc": "Engine, components, modifications",
    "sectionInteriorTitle": "Interior",
    "sectionInteriorDesc": "Seats, dashboard, trim, carpet",
    "sectionDetailsTitle": "Details",
    "sectionDetailsDesc": "VIN plates, badges, unique features, issues",
    "back": "Back",
    "saveDraft": "Save Draft",
    "continue": "Continue",
    "titlePlaceholderVehicle": "e.g., 1965 Austin Mini Cooper S - Restored",
    "titlePlaceholderEngine": "e.g., 1275cc A-Series Engine - Rebuilt",
    "titlePlaceholderParts": "e.g., Original Mini Cooper S Grille Badge",
    "titlePlaceholderDefault": "Enter a descriptive title...",
    "descriptionPlaceholderVehicle": "Describe your Mini in detail. Include history, modifications, known issues, service history, and reason for selling...",
    "descriptionPlaceholderEngine": "Describe the engine condition, any rebuilds, modifications, and what it came out of...",
    "descriptionPlaceholderParts": "Describe the part condition, compatibility, and any relevant details...",
    "descriptionPlaceholderDefault": "Enter a detailed description..."
  },
  "es": {
    "titleLabel": "Título del anuncio *",
    "priceLabel": "Precio *",
    "priceTooltip": "Tus anuncios tienen precio en {currency} (desde tu perfil). Para cambiarlo, actualiza tu perfil.",
    "itemIsFree": "Este artículo es gratis",
    "pricedInPrefix": "Precio en",
    "pricedInSuffix": "— establecido desde tu perfil.",
    "changeCurrency": "Cambiar la moneda en el perfil",
    "freeNotice": "Este anuncio se mostrará como \"Gratis\" a los compradores",
    "yearLabel": "Año *",
    "manufacturerLabel": "Fabricante *",
    "modelLabel": "Modelo *",
    "selectPlaceholder": "Seleccionar...",
    "otherOption": "Otro",
    "mileageLabel": "Kilometraje *",
    "exteriorColorLabel": "Color exterior *",
    "colorPlaceholder": "Rojo Tartan",
    "conditionLabel": "Estado *",
    "vehicleCondExcellent": "Excelente - Calidad de concurso/exposición",
    "vehicleCondGood": "Bueno - Calidad de uso diario",
    "vehicleCondFair": "Regular - Necesita algo de trabajo",
    "vehicleCondProject": "Proyecto - Necesita restauración",
    "engineSeriesLabel": "Serie del motor *",
    "selectSeriesPlaceholder": "Seleccionar serie...",
    "engineSeriesHelp": "Los motores A+ (1980+) tienen retenes de aceite mejorados e internos revisados",
    "engineDisplacementLabel": "Cilindrada del motor *",
    "selectDisplacementPlaceholder": "Seleccionar cilindrada...",
    "displacementStandard": "Tamaños estándar",
    "displacement998Overbore": "998 sobremedida",
    "displacement1100Overbore": "1100 sobremedida",
    "displacement1275Overbore": "1275 sobremedida",
    "displacementOther": "Otro",
    "otherUnknownOption": "Otro / Desconocido",
    "selectConditionPlaceholder": "Seleccionar estado...",
    "engineCondRebuilt": "Reconstruido / Reacondicionado",
    "engineCondRunning": "En marcha - Buen estado",
    "engineCondRunningFair": "En marcha - Estado regular",
    "engineCondNotRunning": "No funciona - Completo",
    "engineCondCore": "Base / Para reconstruir",
    "engineCondPartsOnly": "Solo para piezas",
    "yearOptionalLabel": "Año (opcional)",
    "enginePlateLabel": "Detalles de la placa del motor *",
    "enginePlatePlaceholder": "p. ej., 12H397, 99H, prefijo AEG...",
    "enginePlateHelp": "Introduce el número/prefijo del motor de la placa si es visible",
    "partConditionLabel": "Estado de la pieza *",
    "partCondNew": "Nueva - Sin usar",
    "partCondUsedExcellent": "Usada - Estado excelente",
    "partCondUsedGood": "Usada - Buen estado",
    "partCondUsedFair": "Usada - Estado regular",
    "partCondRebuild": "Reconstruible",
    "partCondCore": "Base / Para piezas",
    "descriptionLabel": "Descripción *",
    "descriptionHelp": "¡Sé detallado! Incluye el historial, problemas conocidos, trabajos recientes y por qué vendes.",
    "photosLabel": "Fotos *",
    "tierPremium": "Premium",
    "tierFree": "Gratis",
    "tierAllowsUpTo": "el nivel permite hasta",
    "photosPerSection": "{count} fotos por sección",
    "photosTotal": "{count} fotos en total",
    "singleUploadDescription": "Añade fotos de tu artículo desde varios ángulos",
    "sectionBodyTitle": "Carrocería y exterior",
    "sectionBodyDesc": "Muestra todos los ángulos, estado de la pintura, cualquier daño",
    "sectionEngineTitle": "Vano motor",
    "sectionEngineDesc": "Motor, componentes, modificaciones",
    "sectionInteriorTitle": "Interior",
    "sectionInteriorDesc": "Asientos, salpicadero, tapicería, alfombras",
    "sectionDetailsTitle": "Detalles",
    "sectionDetailsDesc": "Placas VIN, insignias, características únicas, problemas",
    "back": "Atrás",
    "saveDraft": "Guardar borrador",
    "continue": "Continuar",
    "titlePlaceholderVehicle": "p. ej., Austin Mini Cooper S 1965 - Restaurado",
    "titlePlaceholderEngine": "p. ej., Motor A-Series 1275cc - Reconstruido",
    "titlePlaceholderParts": "p. ej., Insignia de parrilla original Mini Cooper S",
    "titlePlaceholderDefault": "Introduce un título descriptivo...",
    "descriptionPlaceholderVehicle": "Describe tu Mini en detalle. Incluye el historial, modificaciones, problemas conocidos, historial de mantenimiento y motivo de la venta...",
    "descriptionPlaceholderEngine": "Describe el estado del motor, reconstrucciones, modificaciones y de qué vehículo procede...",
    "descriptionPlaceholderParts": "Describe el estado de la pieza, compatibilidad y cualquier detalle relevante...",
    "descriptionPlaceholderDefault": "Introduce una descripción detallada..."
  },
  "fr": {
    "titleLabel": "Titre de l'annonce *",
    "priceLabel": "Prix *",
    "priceTooltip": "Vos annonces sont en {currency} (selon votre profil). Pour changer, mettez à jour votre profil.",
    "itemIsFree": "Cet article est gratuit",
    "pricedInPrefix": "Prix en",
    "pricedInSuffix": "— défini depuis votre profil.",
    "changeCurrency": "Changer la devise dans le profil",
    "freeNotice": "Cette annonce s'affichera comme « Gratuit » pour les acheteurs",
    "yearLabel": "Année *",
    "manufacturerLabel": "Constructeur *",
    "modelLabel": "Modèle *",
    "selectPlaceholder": "Sélectionner...",
    "otherOption": "Autre",
    "mileageLabel": "Kilométrage *",
    "exteriorColorLabel": "Couleur extérieure *",
    "colorPlaceholder": "Rouge Tartan",
    "conditionLabel": "État *",
    "vehicleCondExcellent": "Excellent - Qualité concours/exposition",
    "vehicleCondGood": "Bon - Qualité d'usage quotidien",
    "vehicleCondFair": "Correct - Nécessite des travaux",
    "vehicleCondProject": "Projet - Nécessite une restauration",
    "engineSeriesLabel": "Série du moteur *",
    "selectSeriesPlaceholder": "Sélectionner la série...",
    "engineSeriesHelp": "Les moteurs A+ (1980+) ont des joints d'huile améliorés et des pièces internes révisées",
    "engineDisplacementLabel": "Cylindrée du moteur *",
    "selectDisplacementPlaceholder": "Sélectionner la cylindrée...",
    "displacementStandard": "Tailles standard",
    "displacement998Overbore": "998 réalésé",
    "displacement1100Overbore": "1100 réalésé",
    "displacement1275Overbore": "1275 réalésé",
    "displacementOther": "Autre",
    "otherUnknownOption": "Autre / Inconnu",
    "selectConditionPlaceholder": "Sélectionner l'état...",
    "engineCondRebuilt": "Refait / Reconditionné",
    "engineCondRunning": "En marche - Bon état",
    "engineCondRunningFair": "En marche - État correct",
    "engineCondNotRunning": "Ne tourne pas - Complet",
    "engineCondCore": "Base / À refaire",
    "engineCondPartsOnly": "Pour pièces uniquement",
    "yearOptionalLabel": "Année (facultatif)",
    "enginePlateLabel": "Détails de la plaque moteur *",
    "enginePlatePlaceholder": "ex. 12H397, 99H, préfixe AEG...",
    "enginePlateHelp": "Saisissez le numéro/préfixe moteur de la plaque s'il est visible",
    "partConditionLabel": "État de la pièce *",
    "partCondNew": "Neuf - Inutilisé",
    "partCondUsedExcellent": "Occasion - État excellent",
    "partCondUsedGood": "Occasion - Bon état",
    "partCondUsedFair": "Occasion - État correct",
    "partCondRebuild": "Reconditionnable",
    "partCondCore": "Base / Pour pièces",
    "descriptionLabel": "Description *",
    "descriptionHelp": "Soyez détaillé ! Incluez l'historique, les problèmes connus, les travaux récents et la raison de la vente.",
    "photosLabel": "Photos *",
    "tierPremium": "Premium",
    "tierFree": "Gratuit",
    "tierAllowsUpTo": "le niveau autorise jusqu'à",
    "photosPerSection": "{count} photos par section",
    "photosTotal": "{count} photos au total",
    "singleUploadDescription": "Ajoutez des photos de votre article sous plusieurs angles",
    "sectionBodyTitle": "Carrosserie et extérieur",
    "sectionBodyDesc": "Montrez tous les angles, l'état de la peinture, tout dommage",
    "sectionEngineTitle": "Compartiment moteur",
    "sectionEngineDesc": "Moteur, composants, modifications",
    "sectionInteriorTitle": "Intérieur",
    "sectionInteriorDesc": "Sièges, tableau de bord, garnitures, moquette",
    "sectionDetailsTitle": "Détails",
    "sectionDetailsDesc": "Plaques VIN, insignes, caractéristiques uniques, problèmes",
    "back": "Retour",
    "saveDraft": "Enregistrer le brouillon",
    "continue": "Continuer",
    "titlePlaceholderVehicle": "ex. Austin Mini Cooper S 1965 - Restaurée",
    "titlePlaceholderEngine": "ex. Moteur A-Series 1275cc - Refait",
    "titlePlaceholderParts": "ex. Badge de calandre Mini Cooper S d'origine",
    "titlePlaceholderDefault": "Saisissez un titre descriptif...",
    "descriptionPlaceholderVehicle": "Décrivez votre Mini en détail. Incluez l'historique, les modifications, les problèmes connus, l'historique d'entretien et la raison de la vente...",
    "descriptionPlaceholderEngine": "Décrivez l'état du moteur, les reconditionnements, les modifications et de quel véhicule il provient...",
    "descriptionPlaceholderParts": "Décrivez l'état de la pièce, la compatibilité et tout détail pertinent...",
    "descriptionPlaceholderDefault": "Saisissez une description détaillée..."
  },
  "de": {
    "titleLabel": "Anzeigentitel *",
    "priceLabel": "Preis *",
    "priceTooltip": "Deine Anzeigen sind in {currency} ausgepreist (aus deinem Profil). Zum Ändern aktualisiere dein Profil.",
    "itemIsFree": "Dieser Artikel ist kostenlos",
    "pricedInPrefix": "Ausgepreist in",
    "pricedInSuffix": "— aus deinem Profil festgelegt.",
    "changeCurrency": "Währung im Profil ändern",
    "freeNotice": "Diese Anzeige wird Käufern als „Kostenlos\" angezeigt",
    "yearLabel": "Jahr *",
    "manufacturerLabel": "Hersteller *",
    "modelLabel": "Modell *",
    "selectPlaceholder": "Auswählen...",
    "otherOption": "Andere",
    "mileageLabel": "Kilometerstand *",
    "exteriorColorLabel": "Außenfarbe *",
    "colorPlaceholder": "Tartan-Rot",
    "conditionLabel": "Zustand *",
    "vehicleCondExcellent": "Ausgezeichnet - Concours-/Ausstellungsqualität",
    "vehicleCondGood": "Gut - Alltagsfahrzeug-Qualität",
    "vehicleCondFair": "Brauchbar - Etwas Arbeit nötig",
    "vehicleCondProject": "Projekt - Restaurierung nötig",
    "engineSeriesLabel": "Motorserie *",
    "selectSeriesPlaceholder": "Serie auswählen...",
    "engineSeriesHelp": "A+-Motoren (ab 1980) haben verbesserte Öldichtungen und überarbeitete Innenteile",
    "engineDisplacementLabel": "Hubraum *",
    "selectDisplacementPlaceholder": "Hubraum auswählen...",
    "displacementStandard": "Standardgrößen",
    "displacement998Overbore": "998 aufgebohrt",
    "displacement1100Overbore": "1100 aufgebohrt",
    "displacement1275Overbore": "1275 aufgebohrt",
    "displacementOther": "Andere",
    "otherUnknownOption": "Andere / Unbekannt",
    "selectConditionPlaceholder": "Zustand auswählen...",
    "engineCondRebuilt": "Überholt / Aufbereitet",
    "engineCondRunning": "Läuft - Guter Zustand",
    "engineCondRunningFair": "Läuft - Brauchbarer Zustand",
    "engineCondNotRunning": "Läuft nicht - Komplett",
    "engineCondCore": "Basis / Zum Überholen",
    "engineCondPartsOnly": "Nur für Teile",
    "yearOptionalLabel": "Jahr (optional)",
    "enginePlateLabel": "Details des Motorschilds *",
    "enginePlatePlaceholder": "z. B. 12H397, 99H, AEG-Präfix...",
    "enginePlateHelp": "Gib die Motornummer/das Präfix vom Motorschild ein, falls sichtbar",
    "partConditionLabel": "Teilezustand *",
    "partCondNew": "Neu - Unbenutzt",
    "partCondUsedExcellent": "Gebraucht - Ausgezeichneter Zustand",
    "partCondUsedGood": "Gebraucht - Guter Zustand",
    "partCondUsedFair": "Gebraucht - Brauchbarer Zustand",
    "partCondRebuild": "Überholbar",
    "partCondCore": "Basis / Für Teile",
    "descriptionLabel": "Beschreibung *",
    "descriptionHelp": "Sei ausführlich! Nenne Historie, bekannte Probleme, kürzliche Arbeiten und warum du verkaufst.",
    "photosLabel": "Fotos *",
    "tierPremium": "Premium",
    "tierFree": "Kostenlos",
    "tierAllowsUpTo": "Stufe erlaubt bis zu",
    "photosPerSection": "{count} Fotos pro Bereich",
    "photosTotal": "{count} Fotos insgesamt",
    "singleUploadDescription": "Füge Fotos deines Artikels aus mehreren Blickwinkeln hinzu",
    "sectionBodyTitle": "Karosserie & Außen",
    "sectionBodyDesc": "Zeige alle Blickwinkel, Lackzustand, eventuelle Schäden",
    "sectionEngineTitle": "Motorraum",
    "sectionEngineDesc": "Motor, Komponenten, Modifikationen",
    "sectionInteriorTitle": "Innenraum",
    "sectionInteriorDesc": "Sitze, Armaturenbrett, Verkleidung, Teppich",
    "sectionDetailsTitle": "Details",
    "sectionDetailsDesc": "VIN-Schilder, Embleme, Besonderheiten, Probleme",
    "back": "Zurück",
    "saveDraft": "Entwurf speichern",
    "continue": "Weiter",
    "titlePlaceholderVehicle": "z. B. 1965 Austin Mini Cooper S - Restauriert",
    "titlePlaceholderEngine": "z. B. 1275cc A-Series Motor - Überholt",
    "titlePlaceholderParts": "z. B. Original Mini Cooper S Kühlergrill-Emblem",
    "titlePlaceholderDefault": "Gib einen aussagekräftigen Titel ein...",
    "descriptionPlaceholderVehicle": "Beschreibe deinen Mini ausführlich. Nenne Historie, Modifikationen, bekannte Probleme, Wartungshistorie und Verkaufsgrund...",
    "descriptionPlaceholderEngine": "Beschreibe den Motorzustand, etwaige Überholungen, Modifikationen und aus welchem Fahrzeug er stammt...",
    "descriptionPlaceholderParts": "Beschreibe den Zustand des Teils, die Kompatibilität und alle relevanten Details...",
    "descriptionPlaceholderDefault": "Gib eine ausführliche Beschreibung ein..."
  },
  "it": {
    "titleLabel": "Titolo dell'annuncio *",
    "priceLabel": "Prezzo *",
    "priceTooltip": "I tuoi annunci hanno prezzi in {currency} (dal tuo profilo). Per cambiarla, aggiorna il profilo.",
    "itemIsFree": "Questo articolo è gratuito",
    "pricedInPrefix": "Prezzo in",
    "pricedInSuffix": "— impostato dal tuo profilo.",
    "changeCurrency": "Cambia valuta nel profilo",
    "freeNotice": "Questo annuncio sarà mostrato come \"Gratis\" agli acquirenti",
    "yearLabel": "Anno *",
    "manufacturerLabel": "Produttore *",
    "modelLabel": "Modello *",
    "selectPlaceholder": "Seleziona...",
    "otherOption": "Altro",
    "mileageLabel": "Chilometraggio *",
    "exteriorColorLabel": "Colore esterno *",
    "colorPlaceholder": "Rosso Tartan",
    "conditionLabel": "Condizione *",
    "vehicleCondExcellent": "Eccellente - Qualità concorso/esposizione",
    "vehicleCondGood": "Buona - Qualità uso quotidiano",
    "vehicleCondFair": "Discreta - Richiede del lavoro",
    "vehicleCondProject": "Progetto - Richiede restauro",
    "engineSeriesLabel": "Serie motore *",
    "selectSeriesPlaceholder": "Seleziona serie...",
    "engineSeriesHelp": "I motori A+ (dal 1980) hanno paraoli migliorati e parti interne riviste",
    "engineDisplacementLabel": "Cilindrata motore *",
    "selectDisplacementPlaceholder": "Seleziona cilindrata...",
    "displacementStandard": "Misure standard",
    "displacement998Overbore": "998 maggiorato",
    "displacement1100Overbore": "1100 maggiorato",
    "displacement1275Overbore": "1275 maggiorato",
    "displacementOther": "Altro",
    "otherUnknownOption": "Altro / Sconosciuto",
    "selectConditionPlaceholder": "Seleziona condizione...",
    "engineCondRebuilt": "Ricostruito / Revisionato",
    "engineCondRunning": "Funzionante - Buone condizioni",
    "engineCondRunningFair": "Funzionante - Condizioni discrete",
    "engineCondNotRunning": "Non funzionante - Completo",
    "engineCondCore": "Base / Da ricostruire",
    "engineCondPartsOnly": "Solo per ricambi",
    "yearOptionalLabel": "Anno (opzionale)",
    "enginePlateLabel": "Dettagli della targhetta motore *",
    "enginePlatePlaceholder": "es. 12H397, 99H, prefisso AEG...",
    "enginePlateHelp": "Inserisci il numero/prefisso del motore dalla targhetta se visibile",
    "partConditionLabel": "Condizione del pezzo *",
    "partCondNew": "Nuovo - Non usato",
    "partCondUsedExcellent": "Usato - Condizioni eccellenti",
    "partCondUsedGood": "Usato - Buone condizioni",
    "partCondUsedFair": "Usato - Condizioni discrete",
    "partCondRebuild": "Ricostruibile",
    "partCondCore": "Base / Per ricambi",
    "descriptionLabel": "Descrizione *",
    "descriptionHelp": "Sii dettagliato! Includi storia, problemi noti, lavori recenti e perché stai vendendo.",
    "photosLabel": "Foto *",
    "tierPremium": "Premium",
    "tierFree": "Gratis",
    "tierAllowsUpTo": "il livello consente fino a",
    "photosPerSection": "{count} foto per sezione",
    "photosTotal": "{count} foto in totale",
    "singleUploadDescription": "Aggiungi foto del tuo articolo da più angolazioni",
    "sectionBodyTitle": "Carrozzeria ed esterni",
    "sectionBodyDesc": "Mostra tutte le angolazioni, lo stato della vernice, eventuali danni",
    "sectionEngineTitle": "Vano motore",
    "sectionEngineDesc": "Motore, componenti, modifiche",
    "sectionInteriorTitle": "Interni",
    "sectionInteriorDesc": "Sedili, cruscotto, rivestimenti, tappetini",
    "sectionDetailsTitle": "Dettagli",
    "sectionDetailsDesc": "Targhette VIN, stemmi, caratteristiche uniche, problemi",
    "back": "Indietro",
    "saveDraft": "Salva bozza",
    "continue": "Continua",
    "titlePlaceholderVehicle": "es. Austin Mini Cooper S 1965 - Restaurata",
    "titlePlaceholderEngine": "es. Motore A-Series 1275cc - Ricostruito",
    "titlePlaceholderParts": "es. Stemma griglia originale Mini Cooper S",
    "titlePlaceholderDefault": "Inserisci un titolo descrittivo...",
    "descriptionPlaceholderVehicle": "Descrivi la tua Mini in dettaglio. Includi storia, modifiche, problemi noti, cronologia di manutenzione e motivo della vendita...",
    "descriptionPlaceholderEngine": "Descrivi le condizioni del motore, eventuali ricostruzioni, modifiche e da quale veicolo proviene...",
    "descriptionPlaceholderParts": "Descrivi le condizioni del pezzo, la compatibilità e ogni dettaglio rilevante...",
    "descriptionPlaceholderDefault": "Inserisci una descrizione dettagliata..."
  },
  "pt": {
    "titleLabel": "Título do anúncio *",
    "priceLabel": "Preço *",
    "priceTooltip": "Seus anúncios têm preço em {currency} (do seu perfil). Para alterar, atualize seu perfil.",
    "itemIsFree": "Este item é gratuito",
    "pricedInPrefix": "Preço em",
    "pricedInSuffix": "— definido a partir do seu perfil.",
    "changeCurrency": "Alterar moeda no perfil",
    "freeNotice": "Este anúncio será exibido como \"Grátis\" para os compradores",
    "yearLabel": "Ano *",
    "manufacturerLabel": "Fabricante *",
    "modelLabel": "Modelo *",
    "selectPlaceholder": "Selecionar...",
    "otherOption": "Outro",
    "mileageLabel": "Quilometragem *",
    "exteriorColorLabel": "Cor externa *",
    "colorPlaceholder": "Vermelho Tartan",
    "conditionLabel": "Condição *",
    "vehicleCondExcellent": "Excelente - Qualidade de concurso/exposição",
    "vehicleCondGood": "Boa - Qualidade de uso diário",
    "vehicleCondFair": "Razoável - Precisa de algum trabalho",
    "vehicleCondProject": "Projeto - Precisa de restauração",
    "engineSeriesLabel": "Série do motor *",
    "selectSeriesPlaceholder": "Selecionar série...",
    "engineSeriesHelp": "Motores A+ (1980+) têm retentores de óleo aprimorados e internos revisados",
    "engineDisplacementLabel": "Cilindrada do motor *",
    "selectDisplacementPlaceholder": "Selecionar cilindrada...",
    "displacementStandard": "Tamanhos padrão",
    "displacement998Overbore": "998 retificado",
    "displacement1100Overbore": "1100 retificado",
    "displacement1275Overbore": "1275 retificado",
    "displacementOther": "Outro",
    "otherUnknownOption": "Outro / Desconhecido",
    "selectConditionPlaceholder": "Selecionar condição...",
    "engineCondRebuilt": "Reconstruído / Recondicionado",
    "engineCondRunning": "Funcionando - Boa condição",
    "engineCondRunningFair": "Funcionando - Condição razoável",
    "engineCondNotRunning": "Não funciona - Completo",
    "engineCondCore": "Base / Para reconstruir",
    "engineCondPartsOnly": "Apenas para peças",
    "yearOptionalLabel": "Ano (opcional)",
    "enginePlateLabel": "Detalhes da placa do motor *",
    "enginePlatePlaceholder": "ex.: 12H397, 99H, prefixo AEG...",
    "enginePlateHelp": "Insira o número/prefixo do motor da placa, se visível",
    "partConditionLabel": "Condição da peça *",
    "partCondNew": "Nova - Sem uso",
    "partCondUsedExcellent": "Usada - Excelente condição",
    "partCondUsedGood": "Usada - Boa condição",
    "partCondUsedFair": "Usada - Condição razoável",
    "partCondRebuild": "Recondicionável",
    "partCondCore": "Base / Para peças",
    "descriptionLabel": "Descrição *",
    "descriptionHelp": "Seja detalhado! Inclua histórico, problemas conhecidos, trabalhos recentes e por que está vendendo.",
    "photosLabel": "Fotos *",
    "tierPremium": "Premium",
    "tierFree": "Grátis",
    "tierAllowsUpTo": "o nível permite até",
    "photosPerSection": "{count} fotos por seção",
    "photosTotal": "{count} fotos no total",
    "singleUploadDescription": "Adicione fotos do seu item de vários ângulos",
    "sectionBodyTitle": "Carroceria e exterior",
    "sectionBodyDesc": "Mostre todos os ângulos, estado da pintura, qualquer dano",
    "sectionEngineTitle": "Cofre do motor",
    "sectionEngineDesc": "Motor, componentes, modificações",
    "sectionInteriorTitle": "Interior",
    "sectionInteriorDesc": "Bancos, painel, acabamentos, carpete",
    "sectionDetailsTitle": "Detalhes",
    "sectionDetailsDesc": "Placas VIN, emblemas, características únicas, problemas",
    "back": "Voltar",
    "saveDraft": "Salvar rascunho",
    "continue": "Continuar",
    "titlePlaceholderVehicle": "ex.: Austin Mini Cooper S 1965 - Restaurado",
    "titlePlaceholderEngine": "ex.: Motor A-Series 1275cc - Reconstruído",
    "titlePlaceholderParts": "ex.: Emblema de grade original Mini Cooper S",
    "titlePlaceholderDefault": "Insira um título descritivo...",
    "descriptionPlaceholderVehicle": "Descreva seu Mini em detalhes. Inclua histórico, modificações, problemas conhecidos, histórico de manutenção e motivo da venda...",
    "descriptionPlaceholderEngine": "Descreva o estado do motor, reconstruções, modificações e de qual veículo ele saiu...",
    "descriptionPlaceholderParts": "Descreva o estado da peça, compatibilidade e quaisquer detalhes relevantes...",
    "descriptionPlaceholderDefault": "Insira uma descrição detalhada..."
  },
  "ru": {
    "titleLabel": "Заголовок объявления *",
    "priceLabel": "Цена *",
    "priceTooltip": "Цены ваших объявлений указаны в {currency} (из вашего профиля). Чтобы изменить, обновите профиль.",
    "itemIsFree": "Этот товар бесплатный",
    "pricedInPrefix": "Цена в",
    "pricedInSuffix": "— задано в вашем профиле.",
    "changeCurrency": "Изменить валюту в профиле",
    "freeNotice": "Это объявление будет показано покупателям как «Бесплатно»",
    "yearLabel": "Год *",
    "manufacturerLabel": "Производитель *",
    "modelLabel": "Модель *",
    "selectPlaceholder": "Выберите...",
    "otherOption": "Другое",
    "mileageLabel": "Пробег *",
    "exteriorColorLabel": "Цвет кузова *",
    "colorPlaceholder": "Красный Tartan",
    "conditionLabel": "Состояние *",
    "vehicleCondExcellent": "Отличное - Конкурсное/выставочное качество",
    "vehicleCondGood": "Хорошее - Качество для ежедневной езды",
    "vehicleCondFair": "Удовлетворительное - Требует доработки",
    "vehicleCondProject": "Проект - Требует реставрации",
    "engineSeriesLabel": "Серия двигателя *",
    "selectSeriesPlaceholder": "Выберите серию...",
    "engineSeriesHelp": "Двигатели A+ (с 1980 г.) имеют улучшенные сальники и переработанные внутренние детали",
    "engineDisplacementLabel": "Объём двигателя *",
    "selectDisplacementPlaceholder": "Выберите объём...",
    "displacementStandard": "Стандартные размеры",
    "displacement998Overbore": "998 расточенный",
    "displacement1100Overbore": "1100 расточенный",
    "displacement1275Overbore": "1275 расточенный",
    "displacementOther": "Другое",
    "otherUnknownOption": "Другое / Неизвестно",
    "selectConditionPlaceholder": "Выберите состояние...",
    "engineCondRebuilt": "Восстановленный / Отремонтированный",
    "engineCondRunning": "Рабочий - Хорошее состояние",
    "engineCondRunningFair": "Рабочий - Удовлетворительное состояние",
    "engineCondNotRunning": "Нерабочий - Комплектный",
    "engineCondCore": "Основа / Под восстановление",
    "engineCondPartsOnly": "Только на запчасти",
    "yearOptionalLabel": "Год (необязательно)",
    "enginePlateLabel": "Данные таблички двигателя *",
    "enginePlatePlaceholder": "напр., 12H397, 99H, префикс AEG...",
    "enginePlateHelp": "Введите номер/префикс двигателя с таблички, если он виден",
    "partConditionLabel": "Состояние детали *",
    "partCondNew": "Новая - Не использовалась",
    "partCondUsedExcellent": "Б/у - Отличное состояние",
    "partCondUsedGood": "Б/у - Хорошее состояние",
    "partCondUsedFair": "Б/у - Удовлетворительное состояние",
    "partCondRebuild": "Поддаётся восстановлению",
    "partCondCore": "Основа / На запчасти",
    "descriptionLabel": "Описание *",
    "descriptionHelp": "Будьте подробны! Укажите историю, известные проблемы, недавние работы и причину продажи.",
    "photosLabel": "Фотографии *",
    "tierPremium": "Премиум",
    "tierFree": "Бесплатный",
    "tierAllowsUpTo": "уровень допускает до",
    "photosPerSection": "{count} фото на раздел",
    "photosTotal": "{count} фото всего",
    "singleUploadDescription": "Добавьте фотографии товара с разных ракурсов",
    "sectionBodyTitle": "Кузов и экстерьер",
    "sectionBodyDesc": "Покажите все ракурсы, состояние краски, любые повреждения",
    "sectionEngineTitle": "Моторный отсек",
    "sectionEngineDesc": "Двигатель, компоненты, модификации",
    "sectionInteriorTitle": "Салон",
    "sectionInteriorDesc": "Сиденья, приборная панель, отделка, ковролин",
    "sectionDetailsTitle": "Детали",
    "sectionDetailsDesc": "Таблички VIN, эмблемы, особенности, проблемы",
    "back": "Назад",
    "saveDraft": "Сохранить черновик",
    "continue": "Продолжить",
    "titlePlaceholderVehicle": "напр., Austin Mini Cooper S 1965 - Восстановлен",
    "titlePlaceholderEngine": "напр., Двигатель A-Series 1275cc - Восстановлен",
    "titlePlaceholderParts": "напр., Оригинальная эмблема решётки Mini Cooper S",
    "titlePlaceholderDefault": "Введите содержательный заголовок...",
    "descriptionPlaceholderVehicle": "Опишите ваш Mini подробно. Укажите историю, модификации, известные проблемы, историю обслуживания и причину продажи...",
    "descriptionPlaceholderEngine": "Опишите состояние двигателя, восстановления, модификации и из какого автомобиля он снят...",
    "descriptionPlaceholderParts": "Опишите состояние детали, совместимость и любые важные подробности...",
    "descriptionPlaceholderDefault": "Введите подробное описание..."
  },
  "ja": {
    "titleLabel": "出品タイトル *",
    "priceLabel": "価格 *",
    "priceTooltip": "出品はプロフィールに基づき {currency} で価格設定されます。変更するにはプロフィールを更新してください。",
    "itemIsFree": "この商品は無料です",
    "pricedInPrefix": "通貨：",
    "pricedInSuffix": "— プロフィールから設定されています。",
    "changeCurrency": "プロフィールで通貨を変更",
    "freeNotice": "この出品は購入者に「無料」と表示されます",
    "yearLabel": "年式 *",
    "manufacturerLabel": "メーカー *",
    "modelLabel": "モデル *",
    "selectPlaceholder": "選択...",
    "otherOption": "その他",
    "mileageLabel": "走行距離 *",
    "exteriorColorLabel": "外装色 *",
    "colorPlaceholder": "タータンレッド",
    "conditionLabel": "状態 *",
    "vehicleCondExcellent": "優良 - コンクール/ショー品質",
    "vehicleCondGood": "良好 - 日常使用品質",
    "vehicleCondFair": "普通 - 多少の作業が必要",
    "vehicleCondProject": "プロジェクト - レストアが必要",
    "engineSeriesLabel": "エンジンシリーズ *",
    "selectSeriesPlaceholder": "シリーズを選択...",
    "engineSeriesHelp": "A+エンジン（1980年以降）はオイルシールが改良され内部が見直されています",
    "engineDisplacementLabel": "エンジン排気量 *",
    "selectDisplacementPlaceholder": "排気量を選択...",
    "displacementStandard": "標準サイズ",
    "displacement998Overbore": "998 オーバーボア",
    "displacement1100Overbore": "1100 オーバーボア",
    "displacement1275Overbore": "1275 オーバーボア",
    "displacementOther": "その他",
    "otherUnknownOption": "その他 / 不明",
    "selectConditionPlaceholder": "状態を選択...",
    "engineCondRebuilt": "リビルド / リコンディション済み",
    "engineCondRunning": "始動可 - 良好な状態",
    "engineCondRunningFair": "始動可 - 普通の状態",
    "engineCondNotRunning": "始動不可 - 完品",
    "engineCondCore": "コア / リビルド用",
    "engineCondPartsOnly": "部品取り用のみ",
    "yearOptionalLabel": "年式（任意）",
    "enginePlateLabel": "エンジンプレートの詳細 *",
    "enginePlatePlaceholder": "例：12H397、99H、AEG接頭辞...",
    "enginePlateHelp": "見える場合はエンジンプレートのエンジン番号/接頭辞を入力してください",
    "partConditionLabel": "部品の状態 *",
    "partCondNew": "新品 - 未使用",
    "partCondUsedExcellent": "中古 - 優良な状態",
    "partCondUsedGood": "中古 - 良好な状態",
    "partCondUsedFair": "中古 - 普通の状態",
    "partCondRebuild": "リビルド可能",
    "partCondCore": "コア / 部品取り用",
    "descriptionLabel": "説明 *",
    "descriptionHelp": "詳しく書きましょう！履歴、既知の問題、最近の作業、売却理由を含めてください。",
    "photosLabel": "写真 *",
    "tierPremium": "プレミアム",
    "tierFree": "無料",
    "tierAllowsUpTo": "プランで許可される最大枚数：",
    "photosPerSection": "セクションごとに {count} 枚",
    "photosTotal": "合計 {count} 枚",
    "singleUploadDescription": "商品の写真を複数の角度から追加してください",
    "sectionBodyTitle": "ボディ＆外装",
    "sectionBodyDesc": "全角度、塗装の状態、損傷を表示",
    "sectionEngineTitle": "エンジンルーム",
    "sectionEngineDesc": "エンジン、部品、改造",
    "sectionInteriorTitle": "内装",
    "sectionInteriorDesc": "シート、ダッシュボード、トリム、カーペット",
    "sectionDetailsTitle": "詳細",
    "sectionDetailsDesc": "VINプレート、エンブレム、特徴、問題点",
    "back": "戻る",
    "saveDraft": "下書きを保存",
    "continue": "続行",
    "titlePlaceholderVehicle": "例：1965 Austin Mini Cooper S - レストア済み",
    "titlePlaceholderEngine": "例：1275cc A-Seriesエンジン - リビルド済み",
    "titlePlaceholderParts": "例：純正 Mini Cooper S グリルバッジ",
    "titlePlaceholderDefault": "わかりやすいタイトルを入力...",
    "descriptionPlaceholderVehicle": "あなたのMiniを詳しく説明してください。履歴、改造、既知の問題、整備履歴、売却理由を含めてください...",
    "descriptionPlaceholderEngine": "エンジンの状態、リビルド、改造、搭載されていた車両を説明してください...",
    "descriptionPlaceholderParts": "部品の状態、適合性、関連する詳細を説明してください...",
    "descriptionPlaceholderDefault": "詳しい説明を入力..."
  },
  "zh": {
    "titleLabel": "刊登标题 *",
    "priceLabel": "价格 *",
    "priceTooltip": "您的刊登以 {currency} 定价（来自您的个人资料）。如需更改，请更新个人资料。",
    "itemIsFree": "此物品免费",
    "pricedInPrefix": "定价货币：",
    "pricedInSuffix": "— 由您的个人资料设置。",
    "changeCurrency": "在个人资料中更改货币",
    "freeNotice": "此刊登将向买家显示为\"免费\"",
    "yearLabel": "年份 *",
    "manufacturerLabel": "制造商 *",
    "modelLabel": "型号 *",
    "selectPlaceholder": "选择...",
    "otherOption": "其他",
    "mileageLabel": "里程 *",
    "exteriorColorLabel": "外观颜色 *",
    "colorPlaceholder": "格纹红",
    "conditionLabel": "状况 *",
    "vehicleCondExcellent": "优秀 - 比赛/展示级品质",
    "vehicleCondGood": "良好 - 日常驾驶品质",
    "vehicleCondFair": "一般 - 需要一些维修",
    "vehicleCondProject": "项目车 - 需要修复",
    "engineSeriesLabel": "发动机系列 *",
    "selectSeriesPlaceholder": "选择系列...",
    "engineSeriesHelp": "A+ 发动机（1980年以后）拥有改良的油封和经过修订的内部结构",
    "engineDisplacementLabel": "发动机排量 *",
    "selectDisplacementPlaceholder": "选择排量...",
    "displacementStandard": "标准尺寸",
    "displacement998Overbore": "998 扩缸",
    "displacement1100Overbore": "1100 扩缸",
    "displacement1275Overbore": "1275 扩缸",
    "displacementOther": "其他",
    "otherUnknownOption": "其他 / 未知",
    "selectConditionPlaceholder": "选择状况...",
    "engineCondRebuilt": "重建 / 翻新",
    "engineCondRunning": "可运转 - 状况良好",
    "engineCondRunningFair": "可运转 - 状况一般",
    "engineCondNotRunning": "不可运转 - 完整",
    "engineCondCore": "核心件 / 待重建",
    "engineCondPartsOnly": "仅供拆件",
    "yearOptionalLabel": "年份（可选）",
    "enginePlateLabel": "发动机铭牌详情 *",
    "enginePlatePlaceholder": "例如：12H397、99H、AEG 前缀...",
    "enginePlateHelp": "如可见，请输入发动机铭牌上的发动机编号/前缀",
    "partConditionLabel": "零件状况 *",
    "partCondNew": "全新 - 未使用",
    "partCondUsedExcellent": "二手 - 状况极佳",
    "partCondUsedGood": "二手 - 状况良好",
    "partCondUsedFair": "二手 - 状况一般",
    "partCondRebuild": "可翻新",
    "partCondCore": "核心件 / 供拆件",
    "descriptionLabel": "描述 *",
    "descriptionHelp": "请详细描述！包括历史、已知问题、近期维修以及出售原因。",
    "photosLabel": "照片 *",
    "tierPremium": "高级",
    "tierFree": "免费",
    "tierAllowsUpTo": "等级最多允许",
    "photosPerSection": "每个部分 {count} 张照片",
    "photosTotal": "总共 {count} 张照片",
    "singleUploadDescription": "从多个角度添加您物品的照片",
    "sectionBodyTitle": "车身与外观",
    "sectionBodyDesc": "展示所有角度、油漆状况、任何损伤",
    "sectionEngineTitle": "发动机舱",
    "sectionEngineDesc": "发动机、部件、改装",
    "sectionInteriorTitle": "内饰",
    "sectionInteriorDesc": "座椅、仪表板、内饰、地毯",
    "sectionDetailsTitle": "细节",
    "sectionDetailsDesc": "VIN 铭牌、徽标、独特特征、问题",
    "back": "返回",
    "saveDraft": "保存草稿",
    "continue": "继续",
    "titlePlaceholderVehicle": "例如：1965 Austin Mini Cooper S - 已修复",
    "titlePlaceholderEngine": "例如：1275cc A-Series 发动机 - 已重建",
    "titlePlaceholderParts": "例如：原装 Mini Cooper S 进气格栅徽标",
    "titlePlaceholderDefault": "输入描述性标题...",
    "descriptionPlaceholderVehicle": "详细描述您的 Mini。包括历史、改装、已知问题、保养记录和出售原因...",
    "descriptionPlaceholderEngine": "描述发动机状况、任何重建、改装以及它来自哪辆车...",
    "descriptionPlaceholderParts": "描述零件状况、兼容性和任何相关细节...",
    "descriptionPlaceholderDefault": "输入详细描述..."
  },
  "ko": {
    "titleLabel": "매물 제목 *",
    "priceLabel": "가격 *",
    "priceTooltip": "매물은 프로필 기준 {currency}로 가격이 책정됩니다. 변경하려면 프로필을 업데이트하세요.",
    "itemIsFree": "이 상품은 무료입니다",
    "pricedInPrefix": "가격 통화:",
    "pricedInSuffix": "— 프로필에서 설정됨.",
    "changeCurrency": "프로필에서 통화 변경",
    "freeNotice": "이 매물은 구매자에게 \"무료\"로 표시됩니다",
    "yearLabel": "연식 *",
    "manufacturerLabel": "제조사 *",
    "modelLabel": "모델 *",
    "selectPlaceholder": "선택...",
    "otherOption": "기타",
    "mileageLabel": "주행거리 *",
    "exteriorColorLabel": "외장 색상 *",
    "colorPlaceholder": "타탄 레드",
    "conditionLabel": "상태 *",
    "vehicleCondExcellent": "최상 - 콩쿠르/쇼 품질",
    "vehicleCondGood": "양호 - 일상 주행 품질",
    "vehicleCondFair": "보통 - 약간의 작업 필요",
    "vehicleCondProject": "프로젝트 - 복원 필요",
    "engineSeriesLabel": "엔진 시리즈 *",
    "selectSeriesPlaceholder": "시리즈 선택...",
    "engineSeriesHelp": "A+ 엔진(1980년 이후)은 개선된 오일 씰과 개정된 내부 부품을 갖추고 있습니다",
    "engineDisplacementLabel": "엔진 배기량 *",
    "selectDisplacementPlaceholder": "배기량 선택...",
    "displacementStandard": "표준 사이즈",
    "displacement998Overbore": "998 오버보어",
    "displacement1100Overbore": "1100 오버보어",
    "displacement1275Overbore": "1275 오버보어",
    "displacementOther": "기타",
    "otherUnknownOption": "기타 / 미상",
    "selectConditionPlaceholder": "상태 선택...",
    "engineCondRebuilt": "재생 / 리컨디션",
    "engineCondRunning": "구동 가능 - 양호한 상태",
    "engineCondRunningFair": "구동 가능 - 보통 상태",
    "engineCondNotRunning": "구동 불가 - 완품",
    "engineCondCore": "코어 / 재생용",
    "engineCondPartsOnly": "부품용으로만",
    "yearOptionalLabel": "연식 (선택)",
    "enginePlateLabel": "엔진 플레이트 정보 *",
    "enginePlatePlaceholder": "예: 12H397, 99H, AEG 접두사...",
    "enginePlateHelp": "보이는 경우 엔진 플레이트의 엔진 번호/접두사를 입력하세요",
    "partConditionLabel": "부품 상태 *",
    "partCondNew": "새것 - 미사용",
    "partCondUsedExcellent": "중고 - 최상 상태",
    "partCondUsedGood": "중고 - 양호한 상태",
    "partCondUsedFair": "중고 - 보통 상태",
    "partCondRebuild": "재생 가능",
    "partCondCore": "코어 / 부품용",
    "descriptionLabel": "설명 *",
    "descriptionHelp": "자세히 작성하세요! 이력, 알려진 문제, 최근 작업, 판매 이유를 포함하세요.",
    "photosLabel": "사진 *",
    "tierPremium": "프리미엄",
    "tierFree": "무료",
    "tierAllowsUpTo": "등급에서 허용하는 최대",
    "photosPerSection": "섹션당 사진 {count}장",
    "photosTotal": "총 사진 {count}장",
    "singleUploadDescription": "여러 각도에서 찍은 물품 사진을 추가하세요",
    "sectionBodyTitle": "차체 및 외관",
    "sectionBodyDesc": "모든 각도, 도장 상태, 손상 여부를 보여주세요",
    "sectionEngineTitle": "엔진룸",
    "sectionEngineDesc": "엔진, 부품, 개조",
    "sectionInteriorTitle": "실내",
    "sectionInteriorDesc": "시트, 대시보드, 트림, 카펫",
    "sectionDetailsTitle": "세부 정보",
    "sectionDetailsDesc": "VIN 플레이트, 엠블럼, 고유 특징, 문제점",
    "back": "뒤로",
    "saveDraft": "임시저장",
    "continue": "계속",
    "titlePlaceholderVehicle": "예: 1965 Austin Mini Cooper S - 복원됨",
    "titlePlaceholderEngine": "예: 1275cc A-Series 엔진 - 재생됨",
    "titlePlaceholderParts": "예: 정품 Mini Cooper S 그릴 배지",
    "titlePlaceholderDefault": "설명적인 제목을 입력하세요...",
    "descriptionPlaceholderVehicle": "Mini를 자세히 설명하세요. 이력, 개조, 알려진 문제, 정비 이력, 판매 이유를 포함하세요...",
    "descriptionPlaceholderEngine": "엔진 상태, 재생 이력, 개조, 어떤 차량에서 나온 것인지 설명하세요...",
    "descriptionPlaceholderParts": "부품 상태, 호환성, 관련 세부 정보를 설명하세요...",
    "descriptionPlaceholderDefault": "자세한 설명을 입력하세요..."
  }
}
</i18n>
