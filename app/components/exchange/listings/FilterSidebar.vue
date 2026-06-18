<template>
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="card-title text-lg">{{ t('filters') }}</h3>
        <button v-if="hasActiveFilters" class="btn btn-ghost btn-sm" @click="onClearFilters">
          <i class="fas fa-xmark text-xl"></i>
          {{ t('clearAll') }}
        </button>
      </div>

      <!-- Category Filter -->
      <div class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('category') }}</label>
        <select v-model="selectedCategory" class="select select-sm w-full">
          <option value="">{{ t('allCategories') }}</option>
          <option value="vehicle">{{ t('categoryVehicles') }}</option>
          <option value="engine">{{ t('categoryEngines') }}</option>
          <option value="parts">{{ t('categoryParts') }}</option>
        </select>
      </div>

      <!-- Parts Subcategory Filter (shown when Parts is selected) -->
      <div v-if="selectedCategory === 'parts'" class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('partType') }}</label>
        <select v-model="selectedPartsSubcategory" class="select select-sm w-full">
          <option value="">{{ t('allPartTypes') }}</option>
          <option value="body_exterior">{{ t('partBodyExterior') }}</option>
          <option value="interior">{{ t('partInterior') }}</option>
          <option value="wheels_tires">{{ t('partWheelsTires') }}</option>
          <option value="engine_internals">{{ t('partEngineInternals') }}</option>
          <option value="suspension">{{ t('partSuspension') }}</option>
          <option value="electrical">{{ t('partElectrical') }}</option>
          <option value="other">{{ t('partOther') }}</option>
        </select>
      </div>

      <div class="divider my-0"></div>

      <!-- Year Range Filter -->
      <div class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('year') }}</label>
        <select v-model="selectedYearRange" class="select select-sm w-full">
          <option value="">{{ t('allYears') }}</option>
          <option value="1960s">1959-1969</option>
          <option value="1970s">1970-1979</option>
          <option value="1980s">1980-1989</option>
          <option value="1990s">1990-2000</option>
        </select>
      </div>

      <div class="divider my-0"></div>

      <!-- Manufacturer Filter (Vehicles only) -->
      <div v-if="!selectedCategory || selectedCategory === 'vehicle'" class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('manufacturer') }}</label>
        <select v-model="selectedManufacturer" class="select select-sm w-full">
          <option value="">{{ t('allManufacturers') }}</option>
          <option value="morris">Morris</option>
          <option value="austin">Austin</option>
          <option value="rover">Rover</option>
          <option value="leyland">Leyland</option>
          <option value="innocenti">Innocenti</option>
          <option value="wolseley">Wolseley</option>
          <option value="riley">Riley</option>
          <option value="other">{{ t('manufacturerOther') }}</option>
        </select>
      </div>

      <div class="divider my-0"></div>

      <!-- Model Filter -->
      <div class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('model') }}</label>
        <select v-model="selectedModel" class="select select-sm w-full">
          <option value="">{{ t('allModels') }}</option>
          <option value="Mini">Mini</option>
          <option value="Seven">Seven</option>
          <option value="Mini-Minor">Mini-Minor</option>
          <option value="Cooper">Cooper</option>
          <option value="Cooper S">Cooper S</option>
          <option value="Clubman">Clubman</option>
          <option value="Clubman Estate">Clubman Estate</option>
          <option value="Mini 1000">Mini 1000</option>
          <option value="1275 GT">1275 GT</option>
          <option value="Elf">Elf</option>
          <option value="Hornet">Hornet</option>
          <option value="Moke">Moke</option>
          <option value="Countryman">Countryman</option>
          <option value="Traveller">Traveller</option>
          <option value="Van">Van</option>
          <option value="Pickup">Pickup</option>
          <option value="Other">{{ t('modelOther') }}</option>
        </select>
      </div>

      <div class="divider my-0"></div>

      <!-- Condition Filter -->
      <div class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('condition') }}</label>
        <select v-model="selectedCondition" class="select select-sm w-full">
          <option value="">{{ t('allConditions') }}</option>
          <option value="excellent">{{ t('conditionExcellent') }}</option>
          <option value="good">{{ t('conditionGood') }}</option>
          <option value="fair">{{ t('conditionFair') }}</option>
          <option value="project">{{ t('conditionProject') }}</option>
        </select>
      </div>

      <div class="divider my-0"></div>

      <!-- Price Range Filter -->
      <div class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('priceRange') }}</label>
        <select v-model="selectedPriceRange" class="select select-sm w-full">
          <option value="">{{ t('allPrices') }}</option>
          <option value="free">{{ t('priceFree') }}</option>
          <option value="under-10k">{{ t('priceUnder10k') }}</option>
          <option value="10k-20k">$10,000 - $20,000</option>
          <option value="20k-30k">$20,000 - $30,000</option>
          <option value="30k-50k">$30,000 - $50,000</option>
          <option value="over-50k">{{ t('priceOver50k') }}</option>
        </select>
      </div>

      <div class="divider my-0"></div>

      <!-- Transmission Filter -->
      <div class="mb-3">
        <label class="text-sm font-medium mb-1 block">{{ t('transmission') }}</label>
        <select v-model="selectedTransmission" class="select select-sm w-full">
          <option value="">{{ t('allTransmissions') }}</option>
          <option value="magic_wand">Magic Wand</option>
          <option value="3_synchro_remote">3-Synchro Remote</option>
          <option value="4_synchro_remote">4-Synchro Remote</option>
          <option value="rod_change">Rod Change</option>
          <option value="automatic">{{ t('transmissionAutomatic') }}</option>
        </select>
      </div>

      <div class="divider my-0"></div>

      <!-- Location Filter -->
      <div class="mb-2">
        <label class="text-sm font-medium mb-1 block">{{ t('location') }}</label>
        <label class="input input-sm flex items-center gap-2">
          <i class="fas fa-location-dot text-base-content/50"></i>
          <input v-model="selectedLocation" type="text" :placeholder="t('locationPlaceholder')" class="grow" />
        </label>

        <!-- Distance Filter (shown when location is entered) -->
        <div v-if="selectedLocation" class="mt-2">
          <label class="text-xs text-base-content/70 mb-1 block">{{ t('distance') }}</label>
          <select v-model="selectedDistance" class="select select-sm w-full">
            <option value="25">{{ t('distanceWithin', { miles: 25 }) }}</option>
            <option value="50">{{ t('distanceWithin', { miles: 50 }) }}</option>
            <option value="100">{{ t('distanceWithin', { miles: 100 }) }}</option>
            <option value="250">{{ t('distanceWithin', { miles: 250 }) }}</option>
            <option value="500">{{ t('distanceWithin', { miles: 500 }) }}</option>
            <option value="">{{ t('distanceAny') }}</option>
          </select>
        </div>
      </div>

      <!-- Active Filter Badges -->
      <div v-if="hasActiveFilters" class="mt-3 pt-3 border-t border-base-300">
        <p class="text-xs text-base-content/70 mb-2">{{ t('activeFilters') }}</p>
        <div class="flex flex-wrap gap-2">
          <div v-if="selectedCategory" class="badge badge-ghost gap-2">
            {{ getCategoryLabel(selectedCategory) }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedCategory = ''"
              :aria-label="t('removeCategoryFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedPartsSubcategory" class="badge badge-ghost gap-2">
            {{ getPartsSubcategoryLabel(selectedPartsSubcategory) }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedPartsSubcategory = ''"
              :aria-label="t('removePartsSubcategoryFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedYearRange" class="badge badge-ghost gap-2">
            {{ getYearRangeLabel(selectedYearRange) }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedYearRange = ''"
              :aria-label="t('removeYearFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedManufacturer" class="badge badge-ghost gap-2">
            {{ getManufacturerLabel(selectedManufacturer) }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedManufacturer = ''"
              :aria-label="t('removeManufacturerFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedModel" class="badge badge-ghost gap-2">
            {{ selectedModel }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedModel = ''"
              :aria-label="t('removeModelFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedCondition" class="badge badge-ghost gap-2">
            {{ selectedCondition }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedCondition = ''"
              :aria-label="t('removeConditionFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedPriceRange" class="badge badge-ghost gap-2">
            {{ getPriceRangeLabel(selectedPriceRange) }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedPriceRange = ''"
              :aria-label="t('removePriceFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedTransmission" class="badge badge-ghost gap-2">
            {{ getTransmissionLabel(selectedTransmission) }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="selectedTransmission = ''"
              :aria-label="t('removeTransmissionFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="selectedLocation" class="badge badge-ghost gap-2">
            {{ selectedLocation }}{{ selectedDistance ? ` (${selectedDistance} mi)` : '' }}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              @click="clearLocationFilter"
              :aria-label="t('removeLocationFilter')"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Save Search Button -->
      <ExchangeListingsSaveSearchButton
        v-if="hasActiveFilters"
        :filters="currentFilters"
        :filter-summary="filterSummaryText"
        class="mt-3"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useDebounceFn } from '@vueuse/core';
  import {
    getCategoryLabel,
    getPartsSubcategoryLabel,
    getYearRangeLabel,
    getPriceRangeLabel,
    getTransmissionLabel,
    getManufacturerLabel,
  } from '~/utils/filterLabels';

  const { t } = useI18n();
  const { capture } = usePostHog();

  const props = defineProps<{
    resultsCount?: number;
  }>();

  const selectedCategory = defineModel<string>('category', { required: true });
  const selectedPartsSubcategory = defineModel<string>('partsSubcategory', { required: true });
  const selectedYearRange = defineModel<string>('yearRange', { required: true });
  const selectedManufacturer = defineModel<string>('manufacturer', { required: true });
  const selectedModel = defineModel<string>('model', { required: true });
  const selectedCondition = defineModel<string>('condition', { required: true });
  const selectedPriceRange = defineModel<string>('priceRange', { required: true });
  const selectedTransmission = defineModel<string>('transmission', { required: true });
  const selectedLocation = defineModel<string>('location', { required: true });
  const selectedDistance = defineModel<string>('distance', { required: true });

  // Track filter application
  const trackFilterApplied = (
    filterType: 'category' | 'year' | 'price' | 'condition' | 'transmission' | 'location' | 'model',
    value: string | number | [number, number]
  ) => {
    if (value) {
      capture('filter_applied', {
        filter_type: filterType,
        filter_value: value,
        results_count: props.resultsCount ?? 0,
      });
    }
  };

  // Watch for filter changes and track analytics
  watch(selectedCategory, (newValue) => {
    trackFilterApplied('category', newValue);
  });

  watch(selectedYearRange, (newValue) => {
    trackFilterApplied('year', newValue);
  });

  watch(selectedModel, (newValue) => {
    trackFilterApplied('model', newValue);
  });

  watch(selectedCondition, (newValue) => {
    trackFilterApplied('condition', newValue);
  });

  watch(selectedPriceRange, (newValue) => {
    trackFilterApplied('price', newValue);
  });

  watch(selectedTransmission, (newValue) => {
    trackFilterApplied('transmission', newValue);
  });

  // Debounced location tracking to avoid tracking every keystroke
  const debouncedLocationTrack = useDebounceFn((value: string) => {
    trackFilterApplied('location', value);
  }, 1000);

  watch(selectedLocation, (newValue) => {
    if (newValue) {
      debouncedLocationTrack(newValue);
    }
  });

  // Clear parts subcategory when category changes from parts
  watch(selectedCategory, (newCategory) => {
    if (newCategory !== 'parts') {
      selectedPartsSubcategory.value = '';
    }
  });

  // Clear distance when location is cleared
  watch(selectedLocation, (newLocation) => {
    if (!newLocation) {
      selectedDistance.value = '';
    }
  });

  // Helper to clear both location and distance
  const clearLocationFilter = () => {
    selectedLocation.value = '';
    selectedDistance.value = '';
  };

  const emit = defineEmits<{
    clearFilters: [];
  }>();

  const hasActiveFilters = computed(
    () =>
      !!(
        selectedCategory.value ||
        selectedPartsSubcategory.value ||
        selectedYearRange.value ||
        selectedManufacturer.value ||
        selectedModel.value ||
        selectedCondition.value ||
        selectedPriceRange.value ||
        selectedTransmission.value ||
        selectedLocation.value ||
        selectedDistance.value
      )
  );

  const onClearFilters = () => {
    emit('clearFilters');
  };

  // Computed filter state for SaveSearchButton
  const currentFilters = computed(() => {
    const f: Record<string, string> = {};
    if (selectedCategory.value) f.listing_category = selectedCategory.value;
    if (selectedPartsSubcategory.value) f.parts_subcategory = selectedPartsSubcategory.value;
    if (selectedYearRange.value) f.year_range = selectedYearRange.value;
    if (selectedManufacturer.value) f.manufacturer = selectedManufacturer.value;
    if (selectedModel.value) f.model = selectedModel.value;
    if (selectedCondition.value) f.condition = selectedCondition.value;
    if (selectedPriceRange.value) f.price_range = selectedPriceRange.value;
    if (selectedTransmission.value) f.transmission = selectedTransmission.value;
    if (selectedLocation.value) f.location = selectedLocation.value;
    return f;
  });

  const filterSummaryText = computed(() => {
    const parts: string[] = [];
    if (selectedCategory.value) parts.push(getCategoryLabel(selectedCategory.value));
    if (selectedModel.value) parts.push(selectedModel.value);
    if (selectedYearRange.value) parts.push(getYearRangeLabel(selectedYearRange.value));
    if (selectedPriceRange.value) parts.push(getPriceRangeLabel(selectedPriceRange.value));
    if (selectedCondition.value) parts.push(selectedCondition.value);
    if (selectedTransmission.value) parts.push(getTransmissionLabel(selectedTransmission.value));
    if (selectedLocation.value) parts.push(selectedLocation.value);
    return parts.join(', ');
  });
</script>

<i18n lang="json">
{
  "en": {
    "filters": "Filters",
    "clearAll": "Clear All",
    "category": "Category",
    "allCategories": "All Categories",
    "categoryVehicles": "Vehicles",
    "categoryEngines": "Engines",
    "categoryParts": "Parts",
    "partType": "Part Type",
    "allPartTypes": "All Part Types",
    "partBodyExterior": "Body & Exterior",
    "partInterior": "Interior",
    "partWheelsTires": "Wheels & Tires",
    "partEngineInternals": "Engine Internals",
    "partSuspension": "Suspension",
    "partElectrical": "Electrical",
    "partOther": "Other",
    "year": "Year",
    "allYears": "All Years",
    "manufacturer": "Manufacturer",
    "allManufacturers": "All Manufacturers",
    "manufacturerOther": "Other",
    "model": "Model",
    "allModels": "All Models",
    "modelOther": "Other",
    "condition": "Condition",
    "allConditions": "All Conditions",
    "conditionExcellent": "Excellent",
    "conditionGood": "Good",
    "conditionFair": "Fair",
    "conditionProject": "Project",
    "priceRange": "Price Range",
    "allPrices": "All Prices",
    "priceFree": "Free",
    "priceUnder10k": "Under $10,000",
    "priceOver50k": "Over $50,000",
    "transmission": "Transmission",
    "allTransmissions": "All Transmissions",
    "transmissionAutomatic": "Automatic",
    "location": "Location",
    "locationPlaceholder": "City, State, or Zip",
    "distance": "Distance",
    "distanceWithin": "Within {miles} miles",
    "distanceAny": "Any distance",
    "activeFilters": "Active Filters:",
    "removeCategoryFilter": "Remove category filter",
    "removePartsSubcategoryFilter": "Remove parts subcategory filter",
    "removeYearFilter": "Remove year filter",
    "removeManufacturerFilter": "Remove manufacturer filter",
    "removeModelFilter": "Remove model filter",
    "removeConditionFilter": "Remove condition filter",
    "removePriceFilter": "Remove price filter",
    "removeTransmissionFilter": "Remove transmission filter",
    "removeLocationFilter": "Remove location filter"
  },
  "es": {
    "filters": "Filtros",
    "clearAll": "Borrar todo",
    "category": "Categoría",
    "allCategories": "Todas las categorías",
    "categoryVehicles": "Vehículos",
    "categoryEngines": "Motores",
    "categoryParts": "Piezas",
    "partType": "Tipo de pieza",
    "allPartTypes": "Todos los tipos de piezas",
    "partBodyExterior": "Carrocería y exterior",
    "partInterior": "Interior",
    "partWheelsTires": "Ruedas y neumáticos",
    "partEngineInternals": "Internos del motor",
    "partSuspension": "Suspensión",
    "partElectrical": "Eléctrico",
    "partOther": "Otro",
    "year": "Año",
    "allYears": "Todos los años",
    "manufacturer": "Fabricante",
    "allManufacturers": "Todos los fabricantes",
    "manufacturerOther": "Otro",
    "model": "Modelo",
    "allModels": "Todos los modelos",
    "modelOther": "Otro",
    "condition": "Estado",
    "allConditions": "Todos los estados",
    "conditionExcellent": "Excelente",
    "conditionGood": "Bueno",
    "conditionFair": "Aceptable",
    "conditionProject": "Proyecto",
    "priceRange": "Rango de precios",
    "allPrices": "Todos los precios",
    "priceFree": "Gratis",
    "priceUnder10k": "Menos de $10,000",
    "priceOver50k": "Más de $50,000",
    "transmission": "Transmisión",
    "allTransmissions": "Todas las transmisiones",
    "transmissionAutomatic": "Automática",
    "location": "Ubicación",
    "locationPlaceholder": "Ciudad, estado o código postal",
    "distance": "Distancia",
    "distanceWithin": "Dentro de {miles} millas",
    "distanceAny": "Cualquier distancia",
    "activeFilters": "Filtros activos:",
    "removeCategoryFilter": "Quitar filtro de categoría",
    "removePartsSubcategoryFilter": "Quitar filtro de tipo de pieza",
    "removeYearFilter": "Quitar filtro de año",
    "removeManufacturerFilter": "Quitar filtro de fabricante",
    "removeModelFilter": "Quitar filtro de modelo",
    "removeConditionFilter": "Quitar filtro de estado",
    "removePriceFilter": "Quitar filtro de precio",
    "removeTransmissionFilter": "Quitar filtro de transmisión",
    "removeLocationFilter": "Quitar filtro de ubicación"
  },
  "fr": {
    "filters": "Filtres",
    "clearAll": "Tout effacer",
    "category": "Catégorie",
    "allCategories": "Toutes les catégories",
    "categoryVehicles": "Véhicules",
    "categoryEngines": "Moteurs",
    "categoryParts": "Pièces",
    "partType": "Type de pièce",
    "allPartTypes": "Tous les types de pièces",
    "partBodyExterior": "Carrosserie et extérieur",
    "partInterior": "Intérieur",
    "partWheelsTires": "Roues et pneus",
    "partEngineInternals": "Internes moteur",
    "partSuspension": "Suspension",
    "partElectrical": "Électrique",
    "partOther": "Autre",
    "year": "Année",
    "allYears": "Toutes les années",
    "manufacturer": "Fabricant",
    "allManufacturers": "Tous les fabricants",
    "manufacturerOther": "Autre",
    "model": "Modèle",
    "allModels": "Tous les modèles",
    "modelOther": "Autre",
    "condition": "État",
    "allConditions": "Tous les états",
    "conditionExcellent": "Excellent",
    "conditionGood": "Bon",
    "conditionFair": "Correct",
    "conditionProject": "Projet",
    "priceRange": "Fourchette de prix",
    "allPrices": "Tous les prix",
    "priceFree": "Gratuit",
    "priceUnder10k": "Moins de 10 000 $",
    "priceOver50k": "Plus de 50 000 $",
    "transmission": "Transmission",
    "allTransmissions": "Toutes les transmissions",
    "transmissionAutomatic": "Automatique",
    "location": "Emplacement",
    "locationPlaceholder": "Ville, région ou code postal",
    "distance": "Distance",
    "distanceWithin": "Dans un rayon de {miles} miles",
    "distanceAny": "N'importe quelle distance",
    "activeFilters": "Filtres actifs :",
    "removeCategoryFilter": "Supprimer le filtre de catégorie",
    "removePartsSubcategoryFilter": "Supprimer le filtre de type de pièce",
    "removeYearFilter": "Supprimer le filtre d'année",
    "removeManufacturerFilter": "Supprimer le filtre de fabricant",
    "removeModelFilter": "Supprimer le filtre de modèle",
    "removeConditionFilter": "Supprimer le filtre d'état",
    "removePriceFilter": "Supprimer le filtre de prix",
    "removeTransmissionFilter": "Supprimer le filtre de transmission",
    "removeLocationFilter": "Supprimer le filtre d'emplacement"
  },
  "de": {
    "filters": "Filter",
    "clearAll": "Alle löschen",
    "category": "Kategorie",
    "allCategories": "Alle Kategorien",
    "categoryVehicles": "Fahrzeuge",
    "categoryEngines": "Motoren",
    "categoryParts": "Teile",
    "partType": "Teiletyp",
    "allPartTypes": "Alle Teiletypen",
    "partBodyExterior": "Karosserie & Außenbereich",
    "partInterior": "Innenraum",
    "partWheelsTires": "Räder & Reifen",
    "partEngineInternals": "Motorinnenteile",
    "partSuspension": "Fahrwerk",
    "partElectrical": "Elektrik",
    "partOther": "Sonstiges",
    "year": "Jahr",
    "allYears": "Alle Jahre",
    "manufacturer": "Hersteller",
    "allManufacturers": "Alle Hersteller",
    "manufacturerOther": "Sonstiges",
    "model": "Modell",
    "allModels": "Alle Modelle",
    "modelOther": "Sonstiges",
    "condition": "Zustand",
    "allConditions": "Alle Zustände",
    "conditionExcellent": "Ausgezeichnet",
    "conditionGood": "Gut",
    "conditionFair": "Akzeptabel",
    "conditionProject": "Projekt",
    "priceRange": "Preisspanne",
    "allPrices": "Alle Preise",
    "priceFree": "Kostenlos",
    "priceUnder10k": "Unter 10.000 $",
    "priceOver50k": "Über 50.000 $",
    "transmission": "Getriebe",
    "allTransmissions": "Alle Getriebe",
    "transmissionAutomatic": "Automatik",
    "location": "Standort",
    "locationPlaceholder": "Stadt, Bundesland oder PLZ",
    "distance": "Entfernung",
    "distanceWithin": "Innerhalb von {miles} Meilen",
    "distanceAny": "Beliebige Entfernung",
    "activeFilters": "Aktive Filter:",
    "removeCategoryFilter": "Kategoriefilter entfernen",
    "removePartsSubcategoryFilter": "Teiletyp-Filter entfernen",
    "removeYearFilter": "Jahresfilter entfernen",
    "removeManufacturerFilter": "Herstellerfilter entfernen",
    "removeModelFilter": "Modellfilter entfernen",
    "removeConditionFilter": "Zustandsfilter entfernen",
    "removePriceFilter": "Preisfilter entfernen",
    "removeTransmissionFilter": "Getriebefilter entfernen",
    "removeLocationFilter": "Standortfilter entfernen"
  },
  "it": {
    "filters": "Filtri",
    "clearAll": "Cancella tutto",
    "category": "Categoria",
    "allCategories": "Tutte le categorie",
    "categoryVehicles": "Veicoli",
    "categoryEngines": "Motori",
    "categoryParts": "Ricambi",
    "partType": "Tipo di ricambio",
    "allPartTypes": "Tutti i tipi di ricambio",
    "partBodyExterior": "Carrozzeria ed esterni",
    "partInterior": "Interni",
    "partWheelsTires": "Ruote e pneumatici",
    "partEngineInternals": "Interni motore",
    "partSuspension": "Sospensioni",
    "partElectrical": "Impianto elettrico",
    "partOther": "Altro",
    "year": "Anno",
    "allYears": "Tutti gli anni",
    "manufacturer": "Produttore",
    "allManufacturers": "Tutti i produttori",
    "manufacturerOther": "Altro",
    "model": "Modello",
    "allModels": "Tutti i modelli",
    "modelOther": "Altro",
    "condition": "Condizione",
    "allConditions": "Tutte le condizioni",
    "conditionExcellent": "Eccellente",
    "conditionGood": "Buono",
    "conditionFair": "Discreto",
    "conditionProject": "Progetto",
    "priceRange": "Fascia di prezzo",
    "allPrices": "Tutti i prezzi",
    "priceFree": "Gratuito",
    "priceUnder10k": "Sotto i $10.000",
    "priceOver50k": "Oltre i $50.000",
    "transmission": "Trasmissione",
    "allTransmissions": "Tutte le trasmissioni",
    "transmissionAutomatic": "Automatica",
    "location": "Posizione",
    "locationPlaceholder": "Città, regione o CAP",
    "distance": "Distanza",
    "distanceWithin": "Entro {miles} miglia",
    "distanceAny": "Qualsiasi distanza",
    "activeFilters": "Filtri attivi:",
    "removeCategoryFilter": "Rimuovi filtro categoria",
    "removePartsSubcategoryFilter": "Rimuovi filtro tipo di ricambio",
    "removeYearFilter": "Rimuovi filtro anno",
    "removeManufacturerFilter": "Rimuovi filtro produttore",
    "removeModelFilter": "Rimuovi filtro modello",
    "removeConditionFilter": "Rimuovi filtro condizione",
    "removePriceFilter": "Rimuovi filtro prezzo",
    "removeTransmissionFilter": "Rimuovi filtro trasmissione",
    "removeLocationFilter": "Rimuovi filtro posizione"
  },
  "pt": {
    "filters": "Filtros",
    "clearAll": "Limpar tudo",
    "category": "Categoria",
    "allCategories": "Todas as categorias",
    "categoryVehicles": "Veículos",
    "categoryEngines": "Motores",
    "categoryParts": "Peças",
    "partType": "Tipo de peça",
    "allPartTypes": "Todos os tipos de peças",
    "partBodyExterior": "Carroceria e exterior",
    "partInterior": "Interior",
    "partWheelsTires": "Rodas e pneus",
    "partEngineInternals": "Internos do motor",
    "partSuspension": "Suspensão",
    "partElectrical": "Elétrica",
    "partOther": "Outro",
    "year": "Ano",
    "allYears": "Todos os anos",
    "manufacturer": "Fabricante",
    "allManufacturers": "Todos os fabricantes",
    "manufacturerOther": "Outro",
    "model": "Modelo",
    "allModels": "Todos os modelos",
    "modelOther": "Outro",
    "condition": "Estado",
    "allConditions": "Todos os estados",
    "conditionExcellent": "Excelente",
    "conditionGood": "Bom",
    "conditionFair": "Razoável",
    "conditionProject": "Projeto",
    "priceRange": "Faixa de preço",
    "allPrices": "Todos os preços",
    "priceFree": "Grátis",
    "priceUnder10k": "Abaixo de $10.000",
    "priceOver50k": "Acima de $50.000",
    "transmission": "Transmissão",
    "allTransmissions": "Todas as transmissões",
    "transmissionAutomatic": "Automática",
    "location": "Localização",
    "locationPlaceholder": "Cidade, estado ou CEP",
    "distance": "Distância",
    "distanceWithin": "Em até {miles} milhas",
    "distanceAny": "Qualquer distância",
    "activeFilters": "Filtros ativos:",
    "removeCategoryFilter": "Remover filtro de categoria",
    "removePartsSubcategoryFilter": "Remover filtro de tipo de peça",
    "removeYearFilter": "Remover filtro de ano",
    "removeManufacturerFilter": "Remover filtro de fabricante",
    "removeModelFilter": "Remover filtro de modelo",
    "removeConditionFilter": "Remover filtro de estado",
    "removePriceFilter": "Remover filtro de preço",
    "removeTransmissionFilter": "Remover filtro de transmissão",
    "removeLocationFilter": "Remover filtro de localização"
  },
  "ru": {
    "filters": "Фильтры",
    "clearAll": "Очистить всё",
    "category": "Категория",
    "allCategories": "Все категории",
    "categoryVehicles": "Автомобили",
    "categoryEngines": "Двигатели",
    "categoryParts": "Запчасти",
    "partType": "Тип запчасти",
    "allPartTypes": "Все типы запчастей",
    "partBodyExterior": "Кузов и экстерьер",
    "partInterior": "Интерьер",
    "partWheelsTires": "Колёса и шины",
    "partEngineInternals": "Внутренние детали двигателя",
    "partSuspension": "Подвеска",
    "partElectrical": "Электрика",
    "partOther": "Другое",
    "year": "Год",
    "allYears": "Все годы",
    "manufacturer": "Производитель",
    "allManufacturers": "Все производители",
    "manufacturerOther": "Другое",
    "model": "Модель",
    "allModels": "Все модели",
    "modelOther": "Другое",
    "condition": "Состояние",
    "allConditions": "Все состояния",
    "conditionExcellent": "Отличное",
    "conditionGood": "Хорошее",
    "conditionFair": "Удовлетворительное",
    "conditionProject": "Проект",
    "priceRange": "Диапазон цен",
    "allPrices": "Все цены",
    "priceFree": "Бесплатно",
    "priceUnder10k": "До $10 000",
    "priceOver50k": "Свыше $50 000",
    "transmission": "Коробка передач",
    "allTransmissions": "Все коробки передач",
    "transmissionAutomatic": "Автоматическая",
    "location": "Местоположение",
    "locationPlaceholder": "Город, регион или индекс",
    "distance": "Расстояние",
    "distanceWithin": "В пределах {miles} миль",
    "distanceAny": "Любое расстояние",
    "activeFilters": "Активные фильтры:",
    "removeCategoryFilter": "Убрать фильтр категории",
    "removePartsSubcategoryFilter": "Убрать фильтр типа запчасти",
    "removeYearFilter": "Убрать фильтр года",
    "removeManufacturerFilter": "Убрать фильтр производителя",
    "removeModelFilter": "Убрать фильтр модели",
    "removeConditionFilter": "Убрать фильтр состояния",
    "removePriceFilter": "Убрать фильтр цены",
    "removeTransmissionFilter": "Убрать фильтр коробки передач",
    "removeLocationFilter": "Убрать фильтр местоположения"
  },
  "ja": {
    "filters": "フィルター",
    "clearAll": "すべてクリア",
    "category": "カテゴリー",
    "allCategories": "すべてのカテゴリー",
    "categoryVehicles": "車両",
    "categoryEngines": "エンジン",
    "categoryParts": "パーツ",
    "partType": "パーツの種類",
    "allPartTypes": "すべてのパーツの種類",
    "partBodyExterior": "ボディ・外装",
    "partInterior": "内装",
    "partWheelsTires": "ホイール・タイヤ",
    "partEngineInternals": "エンジン内部",
    "partSuspension": "サスペンション",
    "partElectrical": "電装",
    "partOther": "その他",
    "year": "年式",
    "allYears": "すべての年式",
    "manufacturer": "メーカー",
    "allManufacturers": "すべてのメーカー",
    "manufacturerOther": "その他",
    "model": "モデル",
    "allModels": "すべてのモデル",
    "modelOther": "その他",
    "condition": "状態",
    "allConditions": "すべての状態",
    "conditionExcellent": "優",
    "conditionGood": "良",
    "conditionFair": "可",
    "conditionProject": "レストア素材",
    "priceRange": "価格帯",
    "allPrices": "すべての価格",
    "priceFree": "無料",
    "priceUnder10k": "$10,000未満",
    "priceOver50k": "$50,000超",
    "transmission": "トランスミッション",
    "allTransmissions": "すべてのトランスミッション",
    "transmissionAutomatic": "オートマチック",
    "location": "場所",
    "locationPlaceholder": "市区町村、都道府県、または郵便番号",
    "distance": "距離",
    "distanceWithin": "{miles}マイル以内",
    "distanceAny": "距離を問わない",
    "activeFilters": "適用中のフィルター:",
    "removeCategoryFilter": "カテゴリーフィルターを削除",
    "removePartsSubcategoryFilter": "パーツの種類フィルターを削除",
    "removeYearFilter": "年式フィルターを削除",
    "removeManufacturerFilter": "メーカーフィルターを削除",
    "removeModelFilter": "モデルフィルターを削除",
    "removeConditionFilter": "状態フィルターを削除",
    "removePriceFilter": "価格フィルターを削除",
    "removeTransmissionFilter": "トランスミッションフィルターを削除",
    "removeLocationFilter": "場所フィルターを削除"
  },
  "zh": {
    "filters": "筛选",
    "clearAll": "全部清除",
    "category": "类别",
    "allCategories": "所有类别",
    "categoryVehicles": "整车",
    "categoryEngines": "发动机",
    "categoryParts": "配件",
    "partType": "配件类型",
    "allPartTypes": "所有配件类型",
    "partBodyExterior": "车身与外观",
    "partInterior": "内饰",
    "partWheelsTires": "轮毂与轮胎",
    "partEngineInternals": "发动机内部件",
    "partSuspension": "悬挂",
    "partElectrical": "电气",
    "partOther": "其他",
    "year": "年份",
    "allYears": "所有年份",
    "manufacturer": "制造商",
    "allManufacturers": "所有制造商",
    "manufacturerOther": "其他",
    "model": "型号",
    "allModels": "所有型号",
    "modelOther": "其他",
    "condition": "状况",
    "allConditions": "所有状况",
    "conditionExcellent": "极佳",
    "conditionGood": "良好",
    "conditionFair": "一般",
    "conditionProject": "待修复",
    "priceRange": "价格区间",
    "allPrices": "所有价格",
    "priceFree": "免费",
    "priceUnder10k": "低于 $10,000",
    "priceOver50k": "高于 $50,000",
    "transmission": "变速箱",
    "allTransmissions": "所有变速箱",
    "transmissionAutomatic": "自动",
    "location": "位置",
    "locationPlaceholder": "城市、州或邮编",
    "distance": "距离",
    "distanceWithin": "{miles} 英里以内",
    "distanceAny": "任意距离",
    "activeFilters": "已启用筛选：",
    "removeCategoryFilter": "移除类别筛选",
    "removePartsSubcategoryFilter": "移除配件类型筛选",
    "removeYearFilter": "移除年份筛选",
    "removeManufacturerFilter": "移除制造商筛选",
    "removeModelFilter": "移除型号筛选",
    "removeConditionFilter": "移除状况筛选",
    "removePriceFilter": "移除价格筛选",
    "removeTransmissionFilter": "移除变速箱筛选",
    "removeLocationFilter": "移除位置筛选"
  },
  "ko": {
    "filters": "필터",
    "clearAll": "모두 지우기",
    "category": "카테고리",
    "allCategories": "모든 카테고리",
    "categoryVehicles": "차량",
    "categoryEngines": "엔진",
    "categoryParts": "부품",
    "partType": "부품 유형",
    "allPartTypes": "모든 부품 유형",
    "partBodyExterior": "차체 및 외장",
    "partInterior": "내장",
    "partWheelsTires": "휠 및 타이어",
    "partEngineInternals": "엔진 내부",
    "partSuspension": "서스펜션",
    "partElectrical": "전장",
    "partOther": "기타",
    "year": "연식",
    "allYears": "모든 연식",
    "manufacturer": "제조사",
    "allManufacturers": "모든 제조사",
    "manufacturerOther": "기타",
    "model": "모델",
    "allModels": "모든 모델",
    "modelOther": "기타",
    "condition": "상태",
    "allConditions": "모든 상태",
    "conditionExcellent": "최상",
    "conditionGood": "양호",
    "conditionFair": "보통",
    "conditionProject": "복원용",
    "priceRange": "가격대",
    "allPrices": "모든 가격",
    "priceFree": "무료",
    "priceUnder10k": "$10,000 미만",
    "priceOver50k": "$50,000 초과",
    "transmission": "변속기",
    "allTransmissions": "모든 변속기",
    "transmissionAutomatic": "자동",
    "location": "위치",
    "locationPlaceholder": "도시, 주 또는 우편번호",
    "distance": "거리",
    "distanceWithin": "{miles}마일 이내",
    "distanceAny": "거리 제한 없음",
    "activeFilters": "적용된 필터:",
    "removeCategoryFilter": "카테고리 필터 제거",
    "removePartsSubcategoryFilter": "부품 유형 필터 제거",
    "removeYearFilter": "연식 필터 제거",
    "removeManufacturerFilter": "제조사 필터 제거",
    "removeModelFilter": "모델 필터 제거",
    "removeConditionFilter": "상태 필터 제거",
    "removePriceFilter": "가격 필터 제거",
    "removeTransmissionFilter": "변속기 필터 제거",
    "removeLocationFilter": "위치 필터 제거"
  }
}
</i18n>
