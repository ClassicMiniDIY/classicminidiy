<template>
  <div class="card bg-base-200 border border-base-300">
    <!-- Header (always visible) -->
    <div
      class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
      @click="toggleExpand"
    >
      <!-- Listing Number -->
      <span class="badge badge-neutral badge-sm font-mono">{{ index + 1 }}</span>

      <!-- Title -->
      <span class="font-semibold flex-1 truncate">
        {{ listing.title || t('untitled') }}
      </span>

      <!-- Meta badges (hidden on mobile when collapsed for cleanliness) -->
      <div class="flex items-center gap-2">
        <span v-if="listing.price !== null && listing.price !== undefined" class="text-sm text-base-content/60 hidden sm:inline">
          {{ listing.price === 0 ? t('free') : t('priceUsd', { amount: listing.price }) }}
        </span>
        <span v-if="listing.partCondition" class="badge badge-ghost badge-sm hidden sm:inline-flex">
          {{ formatPartCondition(listing.partCondition) }}
        </span>
        <span v-if="listing.photos.length > 0" class="badge badge-ghost badge-sm hidden sm:inline-flex gap-1">
          <i class="fas fa-image text-xs"></i>
          {{ listing.photos.length }}
        </span>

        <!-- Validation status -->
        <span v-if="listing.isValid" class="badge badge-success badge-sm gap-1">
          <i class="fas fa-check text-xs"></i>
          <span class="hidden sm:inline">{{ t('status.ready') }}</span>
        </span>
        <span v-else-if="hasBeenValidated" class="badge badge-error badge-sm gap-1">
          <i class="fas fa-triangle-exclamation text-xs"></i>
          <span class="hidden sm:inline">{{ Object.keys(listing.errors).length }}</span>
        </span>

        <!-- Remove button -->
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square"
          @click.stop="$emit('remove')"
          :title="t('removeListing')"
        >
          <i class="fas fa-trash text-error/60"></i>
        </button>

        <!-- Expand/collapse chevron -->
        <i
          class="fas fa-chevron-down text-base-content/40 transition-transform duration-200"
          :class="{ 'rotate-180': listing.isExpanded }"
        ></i>
      </div>
    </div>

    <!-- Expanded Form -->
    <div v-show="listing.isExpanded" class="border-t border-base-300">
      <div class="p-4 space-y-4">
        <!-- Row 1: Title + Price -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <fieldset class="fieldset md:col-span-2">
            <legend class="fieldset-legend">{{ t('fields.title') }}</legend>
            <input
              v-model="listing.title"
              type="text"
              class="input input-bordered w-full"
              :class="{ 'input-error': showError('title') }"
              :placeholder="t('placeholders.title')"
              maxlength="100"
              @blur="touch('title')"
            />
            <p v-if="showError('title')" class="text-error text-xs mt-1">{{ listing.errors.title }}</p>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('fields.price') }}</legend>
            <div v-if="!isFree" class="join w-full">
              <span class="join-item btn btn-disabled">$</span>
              <input
                v-model.number="listing.price"
                type="number"
                class="input input-bordered join-item w-full"
                :class="{ 'input-error': showError('price') }"
                placeholder="0"
                min="1"
                @blur="touch('price')"
              />
            </div>
            <p v-if="isFree" class="text-sm text-success">{{ t('itemIsFree') }}</p>
            <label class="label cursor-pointer justify-start gap-2 mt-1">
              <input type="checkbox" class="toggle toggle-primary toggle-sm" :checked="isFree" @change="toggleFree" />
              <span class="label-text text-sm">{{ t('itemIsFree') }}</span>
            </label>
            <p v-if="showError('price')" class="text-error text-xs mt-1">{{ listing.errors.price }}</p>
          </fieldset>
        </div>

        <!-- Row 2: Part Condition + Subcategory -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('fields.partCondition') }}</legend>
            <select
              v-model="listing.partCondition"
              class="select select-bordered w-full"
              :class="{ 'select-error': showError('partCondition') }"
              @change="touch('partCondition')"
            >
              <option value="">{{ t('options.selectCondition') }}</option>
              <option value="new">{{ t('options.condition.new') }}</option>
              <option value="used_excellent">{{ t('options.condition.usedExcellent') }}</option>
              <option value="used_good">{{ t('options.condition.usedGood') }}</option>
              <option value="used_fair">{{ t('options.condition.usedFair') }}</option>
              <option value="rebuild">{{ t('options.condition.rebuild') }}</option>
              <option value="core">{{ t('options.condition.core') }}</option>
            </select>
            <p v-if="showError('partCondition')" class="text-error text-xs mt-1">{{ listing.errors.partCondition }}</p>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('fields.subcategory') }}</legend>
            <select v-model="listing.parts_subcategory" class="select select-bordered w-full">
              <option value="">{{ t('options.select') }}</option>
              <option value="body_exterior">{{ t('options.subcategory.bodyExterior') }}</option>
              <option value="engine_internals">{{ t('options.subcategory.engineInternals') }}</option>
              <option value="electrical">{{ t('options.subcategory.electrical') }}</option>
              <option value="suspension">{{ t('options.subcategory.suspension') }}</option>
              <option value="interior">{{ t('options.subcategory.interior') }}</option>
              <option value="wheels_tires">{{ t('options.subcategory.wheelsTires') }}</option>
              <option value="other">{{ t('options.subcategory.other') }}</option>
            </select>
          </fieldset>
        </div>

        <!-- Location -->
        <ExchangeListingsLocationAutocomplete v-model="locationModel" :error="showError('city') ? listing.errors.city : undefined" />

        <!-- Description -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{{ t('fields.description') }}</legend>
          <textarea
            v-model="listing.description"
            class="textarea textarea-bordered w-full h-24"
            :class="{ 'textarea-error': showError('description') }"
            :placeholder="t('placeholders.description')"
            @blur="touch('description')"
          ></textarea>
          <p v-if="showError('description')" class="text-error text-xs mt-1">{{ listing.errors.description }}</p>
        </fieldset>

        <!-- Photos -->
        <div>
          <ExchangeListingsWizardPhotoUploadSection
            :title="t('photos.title')"
            :description="t('photos.description')"
            :photos="listing.photos"
            :max-photos="3"
            @update:photos="updatePhotos"
          />
          <p v-if="showError('photos')" class="text-error text-xs mt-1">{{ listing.errors.photos }}</p>
        </div>

        <!-- Optional Fields -->
        <div class="divider text-xs text-base-content/40">{{ t('optionalDetails') }}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('fields.partNumber') }}</legend>
            <input
              v-model="listing.partNumber"
              type="text"
              class="input input-bordered w-full"
              :placeholder="t('placeholders.partNumber')"
            />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('fields.oemOrAftermarket') }}</legend>
            <select v-model="listing.oemOrAftermarket" class="select select-bordered w-full">
              <option value="">{{ t('options.select') }}</option>
              <option value="oem">{{ t('options.oem.oem') }}</option>
              <option value="aftermarket">{{ t('options.oem.aftermarket') }}</option>
              <option value="reproduction">{{ t('options.oem.reproduction') }}</option>
            </select>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('fields.quantityAvailable') }}</legend>
            <input
              v-model.number="listing.quantityAvailable"
              type="number"
              class="input input-bordered w-full"
              min="1"
            />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">{{ t('fields.fitsModels') }}</legend>
            <input
              v-model="fitsModelsInput"
              type="text"
              class="input input-bordered w-full"
              :placeholder="t('placeholders.fitsModels')"
              @blur="parseFitsModels"
            />
          </fieldset>

          <!-- Shipping -->
          <fieldset class="fieldset md:col-span-2">
            <legend class="fieldset-legend">{{ t('fields.shipping') }}</legend>
            <label class="flex items-center gap-2 cursor-pointer mb-2">
              <input v-model="listing.shippingAvailable" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
              <span class="text-sm">{{ t('shipping.available') }}</span>
            </label>
            <div v-if="listing.shippingAvailable" class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="listing.shipsTo" type="radio" value="domestic_only" class="radio radio-sm radio-primary" />
                <span class="text-sm">{{ t('shipping.domesticOnly') }}</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="listing.shipsTo" type="radio" value="international" class="radio radio-sm radio-primary" />
                <span class="text-sm">{{ t('shipping.international') }}</span>
              </label>
            </div>
            <p v-if="!listing.shippingAvailable" class="text-xs text-base-content/60">{{ t('shipping.pickupOnly') }}</p>
          </fieldset>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { BulkListingItem } from '~/types/bulk';

  const { t } = useI18n();

  const props = defineProps<{
    modelValue: BulkListingItem;
    index: number;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: BulkListingItem];
    remove: [];
  }>();

  const listing = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
  });

  // Track which fields the user has interacted with
  const touched = ref<Set<string>>(new Set());

  // Validate a single field inline (called on blur/change)
  const touch = (field: string) => {
    touched.value.add(field);
    validateField(field);
  };

  const validateField = (field: string) => {
    const errors = { ...listing.value.errors };

    switch (field) {
      case 'title':
        if (!listing.value.title?.trim()) errors.title = t('errors.title');
        else delete errors.title;
        break;
      case 'price':
        if (listing.value.price === null || listing.value.price === undefined || listing.value.price === ('' as any)) {
          errors.price = t('errors.priceRequired');
        } else if (listing.value.price < 0) {
          errors.price = t('errors.priceNegative');
        } else {
          delete errors.price;
        }
        break;
      case 'partCondition':
        if (!listing.value.partCondition) errors.partCondition = t('errors.partCondition');
        else delete errors.partCondition;
        break;
      case 'description':
        if (!listing.value.description?.trim()) errors.description = t('errors.description');
        else delete errors.description;
        break;
      case 'city':
        if (!listing.value.location.city?.trim()) errors.city = t('errors.city');
        else delete errors.city;
        break;
      case 'photos':
        if (listing.value.photos.length === 0) errors.photos = t('errors.photos');
        else delete errors.photos;
        break;
    }

    listing.value.errors = errors;
    listing.value.isValid = Object.keys(errors).length === 0;
  };

  // Show error only if the field has been touched by the user,
  // OR the parent triggered full validation (which sets showAllErrors)
  const showAllErrors = ref(false);

  const hasBeenValidated = computed(() => Object.keys(listing.value.errors).length > 0 && showAllErrors.value);

  const showError = (field: string) => {
    return listing.value.errors[field] && (touched.value.has(field) || showAllErrors.value);
  };

  // When parent runs full validation (clicking Continue), it sets errors directly.
  // We watch for errors appearing on untouched fields to flip showAllErrors.
  watch(() => listing.value.errors, (newErrors) => {
    const hasUntouchedErrors = Object.keys(newErrors).some(field => !touched.value.has(field));
    if (hasUntouchedErrors && Object.keys(newErrors).length > 0) {
      // Parent must have run full validation — show everything
      showAllErrors.value = true;
    }
  }, { deep: true });

  const isFree = computed(() => listing.value.price === 0);

  const toggleFree = (event: Event) => {
    const checked = (event.target as HTMLInputElement).checked;
    listing.value.price = checked ? 0 : null;
    touch('price');
  };

  const toggleExpand = () => {
    listing.value.isExpanded = !listing.value.isExpanded;
  };

  // Location two-way binding
  const locationModel = computed({
    get: () => listing.value.location,
    set: (value) => {
      listing.value.location = value;
      touch('city');
    },
  });

  // Photos
  const updatePhotos = (photos: any[]) => {
    listing.value.photos = photos;
    touch('photos');
  };

  // Fits models helper
  const fitsModelsInput = ref(props.modelValue.fitsModels?.join(', ') || '');

  watch(() => props.modelValue.fitsModels, (newVal) => {
    const joined = newVal?.join(', ') || '';
    if (joined !== fitsModelsInput.value) fitsModelsInput.value = joined;
  }, { deep: true });

  const parseFitsModels = () => {
    const models = fitsModelsInput.value
      .split(',')
      .map((m: string) => m.trim())
      .filter(Boolean);
    listing.value.fitsModels = models;
  };

  const formatPartCondition = (condition: string) => {
    const labels: Record<string, string> = {
      new: t('badgeCondition.new'),
      used_excellent: t('badgeCondition.usedExcellent'),
      used_good: t('badgeCondition.usedGood'),
      used_fair: t('badgeCondition.usedFair'),
      rebuild: t('badgeCondition.rebuild'),
      core: t('badgeCondition.core'),
    };
    return labels[condition] || condition;
  };
</script>

<i18n lang="json">
{
  "en": {
    "untitled": "Untitled Listing",
    "free": "Free",
    "priceUsd": "${amount}",
    "status": { "ready": "Ready" },
    "removeListing": "Remove listing",
    "itemIsFree": "This item is free",
    "optionalDetails": "Optional Details",
    "fields": { "title": "Title *", "price": "Price *", "partCondition": "Part Condition *", "subcategory": "Subcategory", "description": "Description *", "partNumber": "Part Number", "oemOrAftermarket": "OEM / Aftermarket", "quantityAvailable": "Quantity Available", "fitsModels": "Fits Models", "shipping": "Shipping" },
    "placeholders": { "title": "e.g., Original Mini Cooper S Grille Badge", "description": "Describe the part condition, compatibility, and any relevant details...", "partNumber": "e.g., AHH5594", "fitsModels": "e.g., Mk1, Mk2, Cooper S (comma separated)" },
    "options": {
      "select": "Select...",
      "selectCondition": "Select condition...",
      "condition": { "new": "New - Unused", "usedExcellent": "Used - Excellent", "usedGood": "Used - Good", "usedFair": "Used - Fair", "rebuild": "Rebuild / Rebuildable", "core": "Core / For Parts" },
      "subcategory": { "bodyExterior": "Body Panels & Trim", "engineInternals": "Engine & Drivetrain Parts", "electrical": "Electrical & Lighting", "suspension": "Suspension & Brakes", "interior": "Interior & Upholstery", "wheelsTires": "Wheels & Tires", "other": "Accessories & Other" },
      "oem": { "oem": "OEM / Genuine", "aftermarket": "Aftermarket", "reproduction": "Reproduction" }
    },
    "photos": { "title": "Photos *", "description": "Add 1-3 photos of this part" },
    "shipping": { "available": "Shipping Available", "domesticOnly": "Domestic Only", "international": "International", "pickupOnly": "Listing will show as \"Pickup Only\"" },
    "errors": { "title": "Title is required", "priceRequired": "Price is required", "priceNegative": "Price cannot be negative", "partCondition": "Part condition is required", "description": "Description is required", "city": "Location is required", "photos": "At least one photo is required" },
    "badgeCondition": { "new": "New", "usedExcellent": "Excellent", "usedGood": "Good", "usedFair": "Fair", "rebuild": "Rebuild", "core": "Core" }
  },
  "es": {
    "untitled": "Anuncio sin título",
    "free": "Gratis",
    "priceUsd": "{amount} USD",
    "status": { "ready": "Listo" },
    "removeListing": "Eliminar anuncio",
    "itemIsFree": "Este artículo es gratis",
    "optionalDetails": "Detalles opcionales",
    "fields": { "title": "Título *", "price": "Precio *", "partCondition": "Condición de la pieza *", "subcategory": "Subcategoría", "description": "Descripción *", "partNumber": "Número de pieza", "oemOrAftermarket": "OEM / Aftermarket", "quantityAvailable": "Cantidad disponible", "fitsModels": "Modelos compatibles", "shipping": "Envío" },
    "placeholders": { "title": "p. ej., Insignia original de parrilla Mini Cooper S", "description": "Describe la condición de la pieza, la compatibilidad y cualquier detalle relevante...", "partNumber": "p. ej., AHH5594", "fitsModels": "p. ej., Mk1, Mk2, Cooper S (separados por comas)" },
    "options": {
      "select": "Seleccionar...",
      "selectCondition": "Seleccionar condición...",
      "condition": { "new": "Nuevo - Sin usar", "usedExcellent": "Usado - Excelente", "usedGood": "Usado - Bueno", "usedFair": "Usado - Aceptable", "rebuild": "Reconstruido / Reconstruible", "core": "Núcleo / Para piezas" },
      "subcategory": { "bodyExterior": "Paneles y molduras de carrocería", "engineInternals": "Piezas de motor y transmisión", "electrical": "Eléctrica e iluminación", "suspension": "Suspensión y frenos", "interior": "Interior y tapicería", "wheelsTires": "Ruedas y neumáticos", "other": "Accesorios y otros" },
      "oem": { "oem": "OEM / Original", "aftermarket": "Aftermarket", "reproduction": "Reproducción" }
    },
    "photos": { "title": "Fotos *", "description": "Añade de 1 a 3 fotos de esta pieza" },
    "shipping": { "available": "Envío disponible", "domesticOnly": "Solo nacional", "international": "Internacional", "pickupOnly": "El anuncio se mostrará como \"Solo recogida\"" },
    "errors": { "title": "El título es obligatorio", "priceRequired": "El precio es obligatorio", "priceNegative": "El precio no puede ser negativo", "partCondition": "La condición de la pieza es obligatoria", "description": "La descripción es obligatoria", "city": "La ubicación es obligatoria", "photos": "Se requiere al menos una foto" },
    "badgeCondition": { "new": "Nuevo", "usedExcellent": "Excelente", "usedGood": "Bueno", "usedFair": "Aceptable", "rebuild": "Reconstruido", "core": "Núcleo" }
  },
  "fr": {
    "untitled": "Annonce sans titre",
    "free": "Gratuit",
    "priceUsd": "{amount} USD",
    "status": { "ready": "Prêt" },
    "removeListing": "Supprimer l'annonce",
    "itemIsFree": "Cet article est gratuit",
    "optionalDetails": "Détails facultatifs",
    "fields": { "title": "Titre *", "price": "Prix *", "partCondition": "État de la pièce *", "subcategory": "Sous-catégorie", "description": "Description *", "partNumber": "Numéro de pièce", "oemOrAftermarket": "OEM / Aftermarket", "quantityAvailable": "Quantité disponible", "fitsModels": "Modèles compatibles", "shipping": "Livraison" },
    "placeholders": { "title": "ex. : Badge de calandre Mini Cooper S d'origine", "description": "Décrivez l'état de la pièce, la compatibilité et tout détail pertinent...", "partNumber": "ex. : AHH5594", "fitsModels": "ex. : Mk1, Mk2, Cooper S (séparés par des virgules)" },
    "options": {
      "select": "Sélectionner...",
      "selectCondition": "Sélectionner l'état...",
      "condition": { "new": "Neuf - Non utilisé", "usedExcellent": "Occasion - Excellent", "usedGood": "Occasion - Bon", "usedFair": "Occasion - Correct", "rebuild": "Reconstruit / Reconstructible", "core": "Pièce de base / Pour pièces" },
      "subcategory": { "bodyExterior": "Panneaux et garnitures de carrosserie", "engineInternals": "Pièces moteur et transmission", "electrical": "Électricité et éclairage", "suspension": "Suspension et freins", "interior": "Intérieur et sellerie", "wheelsTires": "Roues et pneus", "other": "Accessoires et autres" },
      "oem": { "oem": "OEM / Authentique", "aftermarket": "Aftermarket", "reproduction": "Reproduction" }
    },
    "photos": { "title": "Photos *", "description": "Ajoutez 1 à 3 photos de cette pièce" },
    "shipping": { "available": "Livraison disponible", "domesticOnly": "National uniquement", "international": "International", "pickupOnly": "L'annonce s'affichera comme « Retrait uniquement »" },
    "errors": { "title": "Le titre est obligatoire", "priceRequired": "Le prix est obligatoire", "priceNegative": "Le prix ne peut pas être négatif", "partCondition": "L'état de la pièce est obligatoire", "description": "La description est obligatoire", "city": "La localisation est obligatoire", "photos": "Au moins une photo est requise" },
    "badgeCondition": { "new": "Neuf", "usedExcellent": "Excellent", "usedGood": "Bon", "usedFair": "Correct", "rebuild": "Reconstruit", "core": "Pièce de base" }
  },
  "de": {
    "untitled": "Anzeige ohne Titel",
    "free": "Kostenlos",
    "priceUsd": "{amount} USD",
    "status": { "ready": "Bereit" },
    "removeListing": "Anzeige entfernen",
    "itemIsFree": "Dieser Artikel ist kostenlos",
    "optionalDetails": "Optionale Angaben",
    "fields": { "title": "Titel *", "price": "Preis *", "partCondition": "Teilezustand *", "subcategory": "Unterkategorie", "description": "Beschreibung *", "partNumber": "Teilenummer", "oemOrAftermarket": "OEM / Zubehör", "quantityAvailable": "Verfügbare Menge", "fitsModels": "Passende Modelle", "shipping": "Versand" },
    "placeholders": { "title": "z. B. Original Mini Cooper S Kühlergrill-Emblem", "description": "Beschreiben Sie den Zustand des Teils, die Kompatibilität und alle relevanten Details...", "partNumber": "z. B. AHH5594", "fitsModels": "z. B. Mk1, Mk2, Cooper S (durch Kommas getrennt)" },
    "options": {
      "select": "Auswählen...",
      "selectCondition": "Zustand auswählen...",
      "condition": { "new": "Neu - Unbenutzt", "usedExcellent": "Gebraucht - Ausgezeichnet", "usedGood": "Gebraucht - Gut", "usedFair": "Gebraucht - Akzeptabel", "rebuild": "Überholt / Überholbar", "core": "Grundteil / Für Teile" },
      "subcategory": { "bodyExterior": "Karosserieteile & Zierleisten", "engineInternals": "Motor- & Antriebsteile", "electrical": "Elektrik & Beleuchtung", "suspension": "Fahrwerk & Bremsen", "interior": "Innenraum & Polsterung", "wheelsTires": "Räder & Reifen", "other": "Zubehör & Sonstiges" },
      "oem": { "oem": "OEM / Original", "aftermarket": "Zubehör", "reproduction": "Reproduktion" }
    },
    "photos": { "title": "Fotos *", "description": "Fügen Sie 1-3 Fotos dieses Teils hinzu" },
    "shipping": { "available": "Versand verfügbar", "domesticOnly": "Nur Inland", "international": "International", "pickupOnly": "Anzeige wird als „Nur Abholung\" angezeigt" },
    "errors": { "title": "Titel ist erforderlich", "priceRequired": "Preis ist erforderlich", "priceNegative": "Preis darf nicht negativ sein", "partCondition": "Teilezustand ist erforderlich", "description": "Beschreibung ist erforderlich", "city": "Standort ist erforderlich", "photos": "Mindestens ein Foto ist erforderlich" },
    "badgeCondition": { "new": "Neu", "usedExcellent": "Ausgezeichnet", "usedGood": "Gut", "usedFair": "Akzeptabel", "rebuild": "Überholt", "core": "Grundteil" }
  },
  "it": {
    "untitled": "Annuncio senza titolo",
    "free": "Gratis",
    "priceUsd": "{amount} USD",
    "status": { "ready": "Pronto" },
    "removeListing": "Rimuovi annuncio",
    "itemIsFree": "Questo articolo è gratuito",
    "optionalDetails": "Dettagli facoltativi",
    "fields": { "title": "Titolo *", "price": "Prezzo *", "partCondition": "Condizione del pezzo *", "subcategory": "Sottocategoria", "description": "Descrizione *", "partNumber": "Numero pezzo", "oemOrAftermarket": "OEM / Aftermarket", "quantityAvailable": "Quantità disponibile", "fitsModels": "Modelli compatibili", "shipping": "Spedizione" },
    "placeholders": { "title": "es. Stemma griglia originale Mini Cooper S", "description": "Descrivi la condizione del pezzo, la compatibilità e qualsiasi dettaglio rilevante...", "partNumber": "es. AHH5594", "fitsModels": "es. Mk1, Mk2, Cooper S (separati da virgole)" },
    "options": {
      "select": "Seleziona...",
      "selectCondition": "Seleziona condizione...",
      "condition": { "new": "Nuovo - Non usato", "usedExcellent": "Usato - Eccellente", "usedGood": "Usato - Buono", "usedFair": "Usato - Discreto", "rebuild": "Ricostruito / Ricostruibile", "core": "Pezzo base / Per ricambi" },
      "subcategory": { "bodyExterior": "Pannelli e finiture carrozzeria", "engineInternals": "Componenti motore e trasmissione", "electrical": "Impianto elettrico e illuminazione", "suspension": "Sospensioni e freni", "interior": "Interni e tappezzeria", "wheelsTires": "Ruote e pneumatici", "other": "Accessori e altro" },
      "oem": { "oem": "OEM / Originale", "aftermarket": "Aftermarket", "reproduction": "Riproduzione" }
    },
    "photos": { "title": "Foto *", "description": "Aggiungi 1-3 foto di questo pezzo" },
    "shipping": { "available": "Spedizione disponibile", "domesticOnly": "Solo nazionale", "international": "Internazionale", "pickupOnly": "L'annuncio verrà mostrato come \"Solo ritiro\"" },
    "errors": { "title": "Il titolo è obbligatorio", "priceRequired": "Il prezzo è obbligatorio", "priceNegative": "Il prezzo non può essere negativo", "partCondition": "La condizione del pezzo è obbligatoria", "description": "La descrizione è obbligatoria", "city": "La posizione è obbligatoria", "photos": "È richiesta almeno una foto" },
    "badgeCondition": { "new": "Nuovo", "usedExcellent": "Eccellente", "usedGood": "Buono", "usedFair": "Discreto", "rebuild": "Ricostruito", "core": "Pezzo base" }
  },
  "pt": {
    "untitled": "Anúncio sem título",
    "free": "Grátis",
    "priceUsd": "{amount} USD",
    "status": { "ready": "Pronto" },
    "removeListing": "Remover anúncio",
    "itemIsFree": "Este item é grátis",
    "optionalDetails": "Detalhes opcionais",
    "fields": { "title": "Título *", "price": "Preço *", "partCondition": "Condição da peça *", "subcategory": "Subcategoria", "description": "Descrição *", "partNumber": "Número da peça", "oemOrAftermarket": "OEM / Aftermarket", "quantityAvailable": "Quantidade disponível", "fitsModels": "Modelos compatíveis", "shipping": "Envio" },
    "placeholders": { "title": "ex.: Emblema original da grade Mini Cooper S", "description": "Descreva a condição da peça, a compatibilidade e quaisquer detalhes relevantes...", "partNumber": "ex.: AHH5594", "fitsModels": "ex.: Mk1, Mk2, Cooper S (separados por vírgulas)" },
    "options": {
      "select": "Selecionar...",
      "selectCondition": "Selecionar condição...",
      "condition": { "new": "Novo - Sem uso", "usedExcellent": "Usado - Excelente", "usedGood": "Usado - Bom", "usedFair": "Usado - Razoável", "rebuild": "Recondicionado / Recondicionável", "core": "Peça base / Para peças" },
      "subcategory": { "bodyExterior": "Painéis e acabamentos da carroceria", "engineInternals": "Peças de motor e transmissão", "electrical": "Elétrica e iluminação", "suspension": "Suspensão e freios", "interior": "Interior e estofamento", "wheelsTires": "Rodas e pneus", "other": "Acessórios e outros" },
      "oem": { "oem": "OEM / Original", "aftermarket": "Aftermarket", "reproduction": "Reprodução" }
    },
    "photos": { "title": "Fotos *", "description": "Adicione 1 a 3 fotos desta peça" },
    "shipping": { "available": "Envio disponível", "domesticOnly": "Somente nacional", "international": "Internacional", "pickupOnly": "O anúncio será exibido como \"Apenas retirada\"" },
    "errors": { "title": "O título é obrigatório", "priceRequired": "O preço é obrigatório", "priceNegative": "O preço não pode ser negativo", "partCondition": "A condição da peça é obrigatória", "description": "A descrição é obrigatória", "city": "A localização é obrigatória", "photos": "É necessária pelo menos uma foto" },
    "badgeCondition": { "new": "Novo", "usedExcellent": "Excelente", "usedGood": "Bom", "usedFair": "Razoável", "rebuild": "Recondicionado", "core": "Peça base" }
  },
  "ru": {
    "untitled": "Объявление без названия",
    "free": "Бесплатно",
    "priceUsd": "{amount} USD",
    "status": { "ready": "Готово" },
    "removeListing": "Удалить объявление",
    "itemIsFree": "Этот товар бесплатный",
    "optionalDetails": "Дополнительные сведения",
    "fields": { "title": "Название *", "price": "Цена *", "partCondition": "Состояние детали *", "subcategory": "Подкатегория", "description": "Описание *", "partNumber": "Номер детали", "oemOrAftermarket": "OEM / Неоригинал", "quantityAvailable": "Доступное количество", "fitsModels": "Подходящие модели", "shipping": "Доставка" },
    "placeholders": { "title": "напр., Оригинальная эмблема решётки Mini Cooper S", "description": "Опишите состояние детали, совместимость и любые важные подробности...", "partNumber": "напр., AHH5594", "fitsModels": "напр., Mk1, Mk2, Cooper S (через запятую)" },
    "options": {
      "select": "Выбрать...",
      "selectCondition": "Выберите состояние...",
      "condition": { "new": "Новое - Неиспользованное", "usedExcellent": "Б/у - Отличное", "usedGood": "Б/у - Хорошее", "usedFair": "Б/у - Удовлетворительное", "rebuild": "Восстановленное / Восстанавливаемое", "core": "На запчасти" },
      "subcategory": { "bodyExterior": "Кузовные панели и молдинги", "engineInternals": "Детали двигателя и трансмиссии", "electrical": "Электрика и освещение", "suspension": "Подвеска и тормоза", "interior": "Салон и обивка", "wheelsTires": "Колёса и шины", "other": "Аксессуары и прочее" },
      "oem": { "oem": "OEM / Оригинал", "aftermarket": "Неоригинал", "reproduction": "Реплика" }
    },
    "photos": { "title": "Фотографии *", "description": "Добавьте 1-3 фотографии этой детали" },
    "shipping": { "available": "Доставка доступна", "domesticOnly": "Только по стране", "international": "Международная", "pickupOnly": "Объявление будет отображаться как «Только самовывоз»" },
    "errors": { "title": "Название обязательно", "priceRequired": "Цена обязательна", "priceNegative": "Цена не может быть отрицательной", "partCondition": "Состояние детали обязательно", "description": "Описание обязательно", "city": "Местоположение обязательно", "photos": "Требуется хотя бы одна фотография" },
    "badgeCondition": { "new": "Новое", "usedExcellent": "Отличное", "usedGood": "Хорошее", "usedFair": "Удовлетворительное", "rebuild": "Восстановленное", "core": "На запчасти" }
  },
  "ja": {
    "untitled": "無題の出品",
    "free": "無料",
    "priceUsd": "{amount} USD",
    "status": { "ready": "準備完了" },
    "removeListing": "出品を削除",
    "itemIsFree": "この商品は無料です",
    "optionalDetails": "任意の詳細",
    "fields": { "title": "タイトル *", "price": "価格 *", "partCondition": "部品の状態 *", "subcategory": "サブカテゴリー", "description": "説明 *", "partNumber": "部品番号", "oemOrAftermarket": "OEM / 社外品", "quantityAvailable": "在庫数", "fitsModels": "適合モデル", "shipping": "配送" },
    "placeholders": { "title": "例：純正 Mini Cooper S グリルバッジ", "description": "部品の状態、適合性、その他関連する詳細を記載してください...", "partNumber": "例：AHH5594", "fitsModels": "例：Mk1, Mk2, Cooper S（カンマ区切り）" },
    "options": {
      "select": "選択...",
      "selectCondition": "状態を選択...",
      "condition": { "new": "新品 - 未使用", "usedExcellent": "中古 - 非常に良い", "usedGood": "中古 - 良い", "usedFair": "中古 - 可", "rebuild": "再生品 / 再生可能", "core": "コア / 部品取り用" },
      "subcategory": { "bodyExterior": "ボディパネル・トリム", "engineInternals": "エンジン・駆動系部品", "electrical": "電装・ライト", "suspension": "サスペンション・ブレーキ", "interior": "内装・内張り", "wheelsTires": "ホイール・タイヤ", "other": "アクセサリー・その他" },
      "oem": { "oem": "OEM / 純正", "aftermarket": "社外品", "reproduction": "復刻品" }
    },
    "photos": { "title": "写真 *", "description": "この部品の写真を1～3枚追加してください" },
    "shipping": { "available": "配送可能", "domesticOnly": "国内のみ", "international": "国際配送", "pickupOnly": "出品は「引き取りのみ」と表示されます" },
    "errors": { "title": "タイトルは必須です", "priceRequired": "価格は必須です", "priceNegative": "価格を負の値にすることはできません", "partCondition": "部品の状態は必須です", "description": "説明は必須です", "city": "所在地は必須です", "photos": "写真が少なくとも1枚必要です" },
    "badgeCondition": { "new": "新品", "usedExcellent": "非常に良い", "usedGood": "良い", "usedFair": "可", "rebuild": "再生品", "core": "コア" }
  },
  "zh": {
    "untitled": "未命名刊登",
    "free": "免费",
    "priceUsd": "{amount} 美元",
    "status": { "ready": "就绪" },
    "removeListing": "移除刊登",
    "itemIsFree": "此商品免费",
    "optionalDetails": "可选详情",
    "fields": { "title": "标题 *", "price": "价格 *", "partCondition": "零件状况 *", "subcategory": "子分类", "description": "描述 *", "partNumber": "零件编号", "oemOrAftermarket": "原厂 / 副厂", "quantityAvailable": "可用数量", "fitsModels": "适配车型", "shipping": "运输" },
    "placeholders": { "title": "例如：原厂 Mini Cooper S 进气格栅徽标", "description": "请描述零件状况、兼容性以及任何相关细节...", "partNumber": "例如：AHH5594", "fitsModels": "例如：Mk1、Mk2、Cooper S（用逗号分隔）" },
    "options": {
      "select": "选择...",
      "selectCondition": "选择状况...",
      "condition": { "new": "全新 - 未使用", "usedExcellent": "二手 - 极佳", "usedGood": "二手 - 良好", "usedFair": "二手 - 一般", "rebuild": "翻新 / 可翻新", "core": "核心件 / 配件用" },
      "subcategory": { "bodyExterior": "车身板件与装饰条", "engineInternals": "发动机与传动部件", "electrical": "电气与照明", "suspension": "悬挂与制动", "interior": "内饰与软装", "wheelsTires": "轮毂与轮胎", "other": "配件与其他" },
      "oem": { "oem": "原厂 / 正品", "aftermarket": "副厂", "reproduction": "复刻" }
    },
    "photos": { "title": "照片 *", "description": "添加 1-3 张此零件的照片" },
    "shipping": { "available": "提供运输", "domesticOnly": "仅限国内", "international": "国际", "pickupOnly": "刊登将显示为“仅限自取”" },
    "errors": { "title": "标题为必填项", "priceRequired": "价格为必填项", "priceNegative": "价格不能为负", "partCondition": "零件状况为必填项", "description": "描述为必填项", "city": "位置为必填项", "photos": "至少需要一张照片" },
    "badgeCondition": { "new": "全新", "usedExcellent": "极佳", "usedGood": "良好", "usedFair": "一般", "rebuild": "翻新", "core": "核心件" }
  },
  "ko": {
    "untitled": "제목 없는 매물",
    "free": "무료",
    "priceUsd": "{amount} USD",
    "status": { "ready": "준비됨" },
    "removeListing": "매물 삭제",
    "itemIsFree": "이 품목은 무료입니다",
    "optionalDetails": "선택 세부정보",
    "fields": { "title": "제목 *", "price": "가격 *", "partCondition": "부품 상태 *", "subcategory": "하위 카테고리", "description": "설명 *", "partNumber": "부품 번호", "oemOrAftermarket": "OEM / 애프터마켓", "quantityAvailable": "보유 수량", "fitsModels": "적합 모델", "shipping": "배송" },
    "placeholders": { "title": "예: 정품 Mini Cooper S 그릴 배지", "description": "부품 상태, 호환성 및 관련 세부 정보를 설명하세요...", "partNumber": "예: AHH5594", "fitsModels": "예: Mk1, Mk2, Cooper S (쉼표로 구분)" },
    "options": {
      "select": "선택...",
      "selectCondition": "상태 선택...",
      "condition": { "new": "새 제품 - 미사용", "usedExcellent": "중고 - 최상", "usedGood": "중고 - 양호", "usedFair": "중고 - 보통", "rebuild": "재생 / 재생 가능", "core": "코어 / 부품용" },
      "subcategory": { "bodyExterior": "차체 패널 및 트림", "engineInternals": "엔진 및 구동계 부품", "electrical": "전기 및 조명", "suspension": "서스펜션 및 브레이크", "interior": "실내 및 시트", "wheelsTires": "휠 및 타이어", "other": "액세서리 및 기타" },
      "oem": { "oem": "OEM / 정품", "aftermarket": "애프터마켓", "reproduction": "복제품" }
    },
    "photos": { "title": "사진 *", "description": "이 부품의 사진을 1~3장 추가하세요" },
    "shipping": { "available": "배송 가능", "domesticOnly": "국내 전용", "international": "국제", "pickupOnly": "매물이 \"직접 수령만\"으로 표시됩니다" },
    "errors": { "title": "제목은 필수입니다", "priceRequired": "가격은 필수입니다", "priceNegative": "가격은 음수일 수 없습니다", "partCondition": "부품 상태는 필수입니다", "description": "설명은 필수입니다", "city": "위치는 필수입니다", "photos": "사진이 최소 한 장 필요합니다" },
    "badgeCondition": { "new": "새 제품", "usedExcellent": "최상", "usedGood": "양호", "usedFair": "보통", "rebuild": "재생", "core": "코어" }
  }
}
</i18n>
