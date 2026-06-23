<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Moderation Warning -->
    <div v-if="moderationWarning" class="alert alert-warning">
      <i class="fas fa-triangle-exclamation"></i>
      <span>{{ moderationWarning }}</span>
    </div>

    <!-- Title -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('titleLabel') }} *</legend>
      <input
        v-model="form.title"
        type="text"
        class="input input-bordered w-full"
        :class="{ 'input-error': errors.title }"
        :placeholder="t('titlePlaceholder')"
        maxlength="200"
        :aria-invalid="!!errors.title"
        :aria-describedby="errors.title ? 'title-error' : undefined"
      />
      <div class="flex justify-between mt-1">
        <p v-if="errors.title" id="title-error" class="text-error text-sm">{{ errors.title }}</p>
        <span v-else></span>
        <span class="text-sm text-base-content/60">{{ form.title.length }}/200</span>
      </div>
    </fieldset>

    <!-- Category -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('categoryLabel') }} *</legend>
      <select
        v-model="form.category"
        class="select select-bordered w-full"
        :class="{ 'select-error': errors.category }"
        :aria-invalid="!!errors.category"
        :aria-describedby="errors.category ? 'category-error' : undefined"
      >
        <option value="" disabled>{{ t('categorySelect') }}</option>
        <option value="vehicle">{{ t('categoryVehicle') }}</option>
        <option value="engine">{{ t('categoryEngine') }}</option>
        <option value="parts">{{ t('categoryParts') }}</option>
      </select>
      <p v-if="errors.category" id="category-error" class="text-error text-sm mt-1">{{ errors.category }}</p>
    </fieldset>

    <!-- Parts Subcategory (conditional) -->
    <fieldset v-if="form.category === 'parts'" class="fieldset">
      <legend class="fieldset-legend">{{ t('partTypeLabel') }} *</legend>
      <select
        v-model="form.partsSubcategory"
        class="select select-bordered w-full"
        :class="{ 'select-error': errors.partsSubcategory }"
        :aria-invalid="!!errors.partsSubcategory"
        :aria-describedby="errors.partsSubcategory ? 'parts-subcategory-error' : undefined"
      >
        <option value="" disabled>{{ t('partTypeSelect') }}</option>
        <option v-for="sub in partsSubcategories" :key="sub.value" :value="sub.value">
          {{ t(sub.labelKey) }}
        </option>
      </select>
      <p v-if="errors.partsSubcategory" id="parts-subcategory-error" class="text-error text-sm mt-1">
        {{ errors.partsSubcategory }}
      </p>
    </fieldset>

    <!-- Description -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('descriptionLabel') }} *</legend>
      <textarea
        v-model="form.description"
        class="textarea textarea-bordered w-full"
        :class="{ 'textarea-error': errors.description }"
        :placeholder="t('descriptionPlaceholder')"
        rows="5"
        maxlength="2000"
        :aria-invalid="!!errors.description"
        :aria-describedby="errors.description ? 'description-error' : undefined"
      ></textarea>
      <div class="flex justify-between mt-1">
        <p v-if="errors.description" id="description-error" class="text-error text-sm">{{ errors.description }}</p>
        <span v-else></span>
        <span class="text-sm text-base-content/60">{{ form.description.length }}/2000</span>
      </div>
    </fieldset>

    <!-- Condition Preference -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('conditionLabel') }}</legend>
      <select v-model="form.conditionPreference" class="select select-bordered w-full">
        <option value="any">{{ t('conditionAny') }}</option>
        <option value="excellent">{{ t('conditionExcellent') }}</option>
        <option value="good">{{ t('conditionGood') }}</option>
        <option value="fair">{{ t('conditionFair') }}</option>
        <option value="project">{{ t('conditionProject') }}</option>
      </select>
    </fieldset>

    <!-- Budget Range -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('budgetLabel') }}</legend>
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[120px]">
          <label class="label text-sm">{{ t('budgetMin') }}</label>
          <input
            v-model.number="form.budgetMin"
            type="number"
            class="input input-bordered w-full"
            placeholder="0"
            min="0"
          />
        </div>
        <div class="flex-1 min-w-[120px]">
          <label class="label text-sm">{{ t('budgetMax') }}</label>
          <input
            v-model.number="form.budgetMax"
            type="number"
            class="input input-bordered w-full"
            placeholder="0"
            min="0"
          />
        </div>
        <div class="w-28">
          <label class="label text-sm">{{ t('currencyLabel') }}</label>
          <select v-model="form.currency" class="select select-bordered w-full">
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>
      <p v-if="errors.budget" class="text-error text-sm mt-1">{{ errors.budget }}</p>
    </fieldset>

    <!-- Location -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ t('locationLabel') }}</legend>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="label text-sm">{{ t('cityLabel') }}</label>
          <input v-model="form.city" type="text" class="input input-bordered w-full" :placeholder="t('cityLabel')" />
        </div>
        <div>
          <label class="label text-sm">{{ t('stateProvinceLabel') }}</label>
          <input
            v-model="form.stateProvince"
            type="text"
            class="input input-bordered w-full"
            :placeholder="t('stateProvinceLabel')"
          />
        </div>
        <div>
          <label class="label text-sm">{{ t('countryLabel') }}</label>
          <input
            v-model="form.country"
            type="text"
            class="input input-bordered w-full"
            :placeholder="t('countryLabel')"
          />
        </div>
      </div>
    </fieldset>

    <!-- Submit -->
    <div class="flex justify-end pt-2">
      <button type="submit" class="btn btn-primary" :disabled="submitting">
        <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
        <i v-else class="fas fa-paper-plane"></i>
        {{ existingPost ? t('updatePost') : t('postAd') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
  import { checkMessageContent, getModerationWarning } from '~/utils/moderation';

  const { t } = useI18n();

  interface WantedFormData {
    title: string;
    description: string;
    category: string;
    partsSubcategory: string;
    conditionPreference: string;
    budgetMin: number | null;
    budgetMax: number | null;
    currency: string;
    city: string;
    stateProvince: string;
    country: string;
  }

  const props = defineProps<{
    existingPost?: {
      id: string;
      title: string;
      description: string;
      category: string;
      parts_subcategory?: string | null;
      condition_preference: string;
      budget_min?: number | null;
      budget_max?: number | null;
      currency: string;
      city?: string | null;
      state_province?: string | null;
      country?: string | null;
    };
    submitting?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'submit', data: WantedFormData): void;
  }>();

  const partsSubcategories = [
    { value: 'body_panels', labelKey: 'partBodyPanels' },
    { value: 'engine_parts', labelKey: 'partEngineParts' },
    { value: 'suspension', labelKey: 'partSuspension' },
    { value: 'brakes', labelKey: 'partBrakes' },
    { value: 'electrical', labelKey: 'partElectrical' },
    { value: 'interior', labelKey: 'partInterior' },
    { value: 'wheels_tyres', labelKey: 'partWheelsTyres' },
    { value: 'transmission', labelKey: 'partTransmission' },
    { value: 'cooling', labelKey: 'partCooling' },
    { value: 'fuel_system', labelKey: 'partFuelSystem' },
    { value: 'exhaust', labelKey: 'partExhaust' },
    { value: 'accessories', labelKey: 'partAccessories' },
    { value: 'other', labelKey: 'partOther' },
  ];

  // Form state
  const form = reactive<WantedFormData>({
    title: props.existingPost?.title ?? '',
    description: props.existingPost?.description ?? '',
    category: props.existingPost?.category ?? '',
    partsSubcategory: props.existingPost?.parts_subcategory ?? '',
    conditionPreference: props.existingPost?.condition_preference ?? 'any',
    budgetMin: props.existingPost?.budget_min ?? null,
    budgetMax: props.existingPost?.budget_max ?? null,
    currency: props.existingPost?.currency ?? 'USD',
    city: props.existingPost?.city ?? '',
    stateProvince: props.existingPost?.state_province ?? '',
    country: props.existingPost?.country ?? '',
  });

  const errors = reactive<Record<string, string>>({});
  const moderationWarning = ref('');

  // Clear parts subcategory when category changes away from parts
  watch(
    () => form.category,
    (newCategory) => {
      if (newCategory !== 'parts') {
        form.partsSubcategory = '';
      }
    }
  );

  const validate = (): boolean => {
    // Clear previous errors
    Object.keys(errors).forEach((key) => delete errors[key]);

    if (!form.title.trim()) {
      errors.title = t('errorTitleRequired');
    } else if (form.title.trim().length > 200) {
      errors.title = t('errorTitleTooLong');
    }

    if (!form.category) {
      errors.category = t('errorCategoryRequired');
    }

    if (form.category === 'parts' && !form.partsSubcategory) {
      errors.partsSubcategory = t('errorPartTypeRequired');
    }

    if (!form.description.trim()) {
      errors.description = t('errorDescriptionRequired');
    } else if (form.description.trim().length > 2000) {
      errors.description = t('errorDescriptionTooLong');
    }

    if (form.budgetMin !== null && form.budgetMax !== null && form.budgetMin > form.budgetMax) {
      errors.budget = t('errorBudgetRange');
    }

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    // Run content moderation on title and description
    const combinedText = `${form.title} ${form.description}`;
    const moderation = checkMessageContent(combinedText);

    if (!moderation.isClean) {
      moderationWarning.value = getModerationWarning(moderation.issues);
      // Show warning but still allow submission
    } else {
      moderationWarning.value = '';
    }

    emit('submit', { ...form });
  };
</script>

<i18n lang="json">
{
  "en": {
    "titleLabel": "Title",
    "titlePlaceholder": "e.g., Looking for 1275cc A-Series engine",
    "categoryLabel": "Category",
    "categorySelect": "Select a category...",
    "categoryVehicle": "Vehicle",
    "categoryEngine": "Engine",
    "categoryParts": "Parts",
    "partTypeLabel": "Part Type",
    "partTypeSelect": "Select a part type...",
    "partBodyPanels": "Body Panels",
    "partEngineParts": "Engine Parts",
    "partSuspension": "Suspension",
    "partBrakes": "Brakes",
    "partElectrical": "Electrical",
    "partInterior": "Interior",
    "partWheelsTyres": "Wheels & Tyres",
    "partTransmission": "Transmission",
    "partCooling": "Cooling",
    "partFuelSystem": "Fuel System",
    "partExhaust": "Exhaust",
    "partAccessories": "Accessories",
    "partOther": "Other",
    "descriptionLabel": "Description",
    "descriptionPlaceholder": "Describe what you're looking for in detail. Include any specific requirements, model years, conditions you'd accept, etc.",
    "conditionLabel": "Condition Preference",
    "conditionAny": "Any Condition",
    "conditionExcellent": "Excellent",
    "conditionGood": "Good",
    "conditionFair": "Fair",
    "conditionProject": "Project",
    "budgetLabel": "Budget Range",
    "budgetMin": "Min",
    "budgetMax": "Max",
    "currencyLabel": "Currency",
    "locationLabel": "Location",
    "cityLabel": "City",
    "stateProvinceLabel": "State / Province",
    "countryLabel": "Country",
    "updatePost": "Update Wanted Post",
    "postAd": "Post Wanted Ad",
    "errorTitleRequired": "Title is required",
    "errorTitleTooLong": "Title must be 200 characters or less",
    "errorCategoryRequired": "Category is required",
    "errorPartTypeRequired": "Part type is required when category is Parts",
    "errorDescriptionRequired": "Description is required",
    "errorDescriptionTooLong": "Description must be 2000 characters or less",
    "errorBudgetRange": "Minimum budget cannot exceed maximum budget"
  },
  "es": {
    "titleLabel": "Título",
    "titlePlaceholder": "p. ej., Busco motor 1275cc de la serie A",
    "categoryLabel": "Categoría",
    "categorySelect": "Selecciona una categoría...",
    "categoryVehicle": "Vehículo",
    "categoryEngine": "Motor",
    "categoryParts": "Piezas",
    "partTypeLabel": "Tipo de pieza",
    "partTypeSelect": "Selecciona un tipo de pieza...",
    "partBodyPanels": "Paneles de carrocería",
    "partEngineParts": "Piezas del motor",
    "partSuspension": "Suspensión",
    "partBrakes": "Frenos",
    "partElectrical": "Eléctrico",
    "partInterior": "Interior",
    "partWheelsTyres": "Llantas y neumáticos",
    "partTransmission": "Transmisión",
    "partCooling": "Refrigeración",
    "partFuelSystem": "Sistema de combustible",
    "partExhaust": "Escape",
    "partAccessories": "Accesorios",
    "partOther": "Otro",
    "descriptionLabel": "Descripción",
    "descriptionPlaceholder": "Describe en detalle lo que buscas. Incluye requisitos específicos, años del modelo, estados que aceptarías, etc.",
    "conditionLabel": "Preferencia de estado",
    "conditionAny": "Cualquier estado",
    "conditionExcellent": "Excelente",
    "conditionGood": "Bueno",
    "conditionFair": "Aceptable",
    "conditionProject": "Para proyecto",
    "budgetLabel": "Rango de presupuesto",
    "budgetMin": "Mín",
    "budgetMax": "Máx",
    "currencyLabel": "Moneda",
    "locationLabel": "Ubicación",
    "cityLabel": "Ciudad",
    "stateProvinceLabel": "Estado / Provincia",
    "countryLabel": "País",
    "updatePost": "Actualizar anuncio de búsqueda",
    "postAd": "Publicar anuncio de búsqueda",
    "errorTitleRequired": "El título es obligatorio",
    "errorTitleTooLong": "El título debe tener 200 caracteres o menos",
    "errorCategoryRequired": "La categoría es obligatoria",
    "errorPartTypeRequired": "El tipo de pieza es obligatorio cuando la categoría es Piezas",
    "errorDescriptionRequired": "La descripción es obligatoria",
    "errorDescriptionTooLong": "La descripción debe tener 2000 caracteres o menos",
    "errorBudgetRange": "El presupuesto mínimo no puede superar el máximo"
  },
  "fr": {
    "titleLabel": "Titre",
    "titlePlaceholder": "ex. : Recherche moteur série A 1275cc",
    "categoryLabel": "Catégorie",
    "categorySelect": "Sélectionnez une catégorie...",
    "categoryVehicle": "Véhicule",
    "categoryEngine": "Moteur",
    "categoryParts": "Pièces",
    "partTypeLabel": "Type de pièce",
    "partTypeSelect": "Sélectionnez un type de pièce...",
    "partBodyPanels": "Panneaux de carrosserie",
    "partEngineParts": "Pièces moteur",
    "partSuspension": "Suspension",
    "partBrakes": "Freins",
    "partElectrical": "Électrique",
    "partInterior": "Intérieur",
    "partWheelsTyres": "Jantes et pneus",
    "partTransmission": "Transmission",
    "partCooling": "Refroidissement",
    "partFuelSystem": "Système de carburant",
    "partExhaust": "Échappement",
    "partAccessories": "Accessoires",
    "partOther": "Autre",
    "descriptionLabel": "Description",
    "descriptionPlaceholder": "Décrivez en détail ce que vous recherchez. Incluez les exigences spécifiques, les années du modèle, les états que vous accepteriez, etc.",
    "conditionLabel": "Préférence d'état",
    "conditionAny": "Tout état",
    "conditionExcellent": "Excellent",
    "conditionGood": "Bon",
    "conditionFair": "Correct",
    "conditionProject": "Projet",
    "budgetLabel": "Fourchette de budget",
    "budgetMin": "Min",
    "budgetMax": "Max",
    "currencyLabel": "Devise",
    "locationLabel": "Emplacement",
    "cityLabel": "Ville",
    "stateProvinceLabel": "État / Province",
    "countryLabel": "Pays",
    "updatePost": "Mettre à jour l'annonce de recherche",
    "postAd": "Publier l'annonce de recherche",
    "errorTitleRequired": "Le titre est requis",
    "errorTitleTooLong": "Le titre ne doit pas dépasser 200 caractères",
    "errorCategoryRequired": "La catégorie est requise",
    "errorPartTypeRequired": "Le type de pièce est requis lorsque la catégorie est Pièces",
    "errorDescriptionRequired": "La description est requise",
    "errorDescriptionTooLong": "La description ne doit pas dépasser 2000 caractères",
    "errorBudgetRange": "Le budget minimum ne peut pas dépasser le maximum"
  },
  "de": {
    "titleLabel": "Titel",
    "titlePlaceholder": "z. B. Suche 1275cc A-Serie-Motor",
    "categoryLabel": "Kategorie",
    "categorySelect": "Kategorie auswählen...",
    "categoryVehicle": "Fahrzeug",
    "categoryEngine": "Motor",
    "categoryParts": "Teile",
    "partTypeLabel": "Teiletyp",
    "partTypeSelect": "Teiletyp auswählen...",
    "partBodyPanels": "Karosserieteile",
    "partEngineParts": "Motorteile",
    "partSuspension": "Fahrwerk",
    "partBrakes": "Bremsen",
    "partElectrical": "Elektrik",
    "partInterior": "Innenraum",
    "partWheelsTyres": "Räder & Reifen",
    "partTransmission": "Getriebe",
    "partCooling": "Kühlung",
    "partFuelSystem": "Kraftstoffsystem",
    "partExhaust": "Auspuff",
    "partAccessories": "Zubehör",
    "partOther": "Sonstiges",
    "descriptionLabel": "Beschreibung",
    "descriptionPlaceholder": "Beschreibe ausführlich, was du suchst. Nenne spezifische Anforderungen, Modelljahre, akzeptable Zustände usw.",
    "conditionLabel": "Zustandspräferenz",
    "conditionAny": "Beliebiger Zustand",
    "conditionExcellent": "Ausgezeichnet",
    "conditionGood": "Gut",
    "conditionFair": "Akzeptabel",
    "conditionProject": "Projekt",
    "budgetLabel": "Budgetbereich",
    "budgetMin": "Min",
    "budgetMax": "Max",
    "currencyLabel": "Währung",
    "locationLabel": "Standort",
    "cityLabel": "Stadt",
    "stateProvinceLabel": "Bundesland / Provinz",
    "countryLabel": "Land",
    "updatePost": "Gesuch aktualisieren",
    "postAd": "Gesuch aufgeben",
    "errorTitleRequired": "Titel ist erforderlich",
    "errorTitleTooLong": "Der Titel darf höchstens 200 Zeichen lang sein",
    "errorCategoryRequired": "Kategorie ist erforderlich",
    "errorPartTypeRequired": "Teiletyp ist erforderlich, wenn die Kategorie Teile ist",
    "errorDescriptionRequired": "Beschreibung ist erforderlich",
    "errorDescriptionTooLong": "Die Beschreibung darf höchstens 2000 Zeichen lang sein",
    "errorBudgetRange": "Das Mindestbudget darf das Höchstbudget nicht überschreiten"
  },
  "it": {
    "titleLabel": "Titolo",
    "titlePlaceholder": "es. Cerco motore serie A 1275cc",
    "categoryLabel": "Categoria",
    "categorySelect": "Seleziona una categoria...",
    "categoryVehicle": "Veicolo",
    "categoryEngine": "Motore",
    "categoryParts": "Ricambi",
    "partTypeLabel": "Tipo di ricambio",
    "partTypeSelect": "Seleziona un tipo di ricambio...",
    "partBodyPanels": "Pannelli carrozzeria",
    "partEngineParts": "Componenti motore",
    "partSuspension": "Sospensioni",
    "partBrakes": "Freni",
    "partElectrical": "Impianto elettrico",
    "partInterior": "Interni",
    "partWheelsTyres": "Cerchi e pneumatici",
    "partTransmission": "Trasmissione",
    "partCooling": "Raffreddamento",
    "partFuelSystem": "Impianto di alimentazione",
    "partExhaust": "Scarico",
    "partAccessories": "Accessori",
    "partOther": "Altro",
    "descriptionLabel": "Descrizione",
    "descriptionPlaceholder": "Descrivi in dettaglio ciò che cerchi. Includi requisiti specifici, anni del modello, condizioni che accetteresti, ecc.",
    "conditionLabel": "Preferenza di condizione",
    "conditionAny": "Qualsiasi condizione",
    "conditionExcellent": "Eccellente",
    "conditionGood": "Buono",
    "conditionFair": "Discreto",
    "conditionProject": "Da progetto",
    "budgetLabel": "Fascia di budget",
    "budgetMin": "Min",
    "budgetMax": "Max",
    "currencyLabel": "Valuta",
    "locationLabel": "Posizione",
    "cityLabel": "Città",
    "stateProvinceLabel": "Stato / Provincia",
    "countryLabel": "Paese",
    "updatePost": "Aggiorna annuncio di ricerca",
    "postAd": "Pubblica annuncio di ricerca",
    "errorTitleRequired": "Il titolo è obbligatorio",
    "errorTitleTooLong": "Il titolo deve contenere al massimo 200 caratteri",
    "errorCategoryRequired": "La categoria è obbligatoria",
    "errorPartTypeRequired": "Il tipo di ricambio è obbligatorio quando la categoria è Ricambi",
    "errorDescriptionRequired": "La descrizione è obbligatoria",
    "errorDescriptionTooLong": "La descrizione deve contenere al massimo 2000 caratteri",
    "errorBudgetRange": "Il budget minimo non può superare quello massimo"
  },
  "pt": {
    "titleLabel": "Título",
    "titlePlaceholder": "ex.: Procuro motor série A 1275cc",
    "categoryLabel": "Categoria",
    "categorySelect": "Selecione uma categoria...",
    "categoryVehicle": "Veículo",
    "categoryEngine": "Motor",
    "categoryParts": "Peças",
    "partTypeLabel": "Tipo de peça",
    "partTypeSelect": "Selecione um tipo de peça...",
    "partBodyPanels": "Painéis de carroceria",
    "partEngineParts": "Peças do motor",
    "partSuspension": "Suspensão",
    "partBrakes": "Freios",
    "partElectrical": "Elétrica",
    "partInterior": "Interior",
    "partWheelsTyres": "Rodas e pneus",
    "partTransmission": "Transmissão",
    "partCooling": "Arrefecimento",
    "partFuelSystem": "Sistema de combustível",
    "partExhaust": "Escapamento",
    "partAccessories": "Acessórios",
    "partOther": "Outro",
    "descriptionLabel": "Descrição",
    "descriptionPlaceholder": "Descreva em detalhes o que você procura. Inclua requisitos específicos, anos do modelo, condições que aceitaria, etc.",
    "conditionLabel": "Preferência de estado",
    "conditionAny": "Qualquer estado",
    "conditionExcellent": "Excelente",
    "conditionGood": "Bom",
    "conditionFair": "Razoável",
    "conditionProject": "Para projeto",
    "budgetLabel": "Faixa de orçamento",
    "budgetMin": "Mín",
    "budgetMax": "Máx",
    "currencyLabel": "Moeda",
    "locationLabel": "Localização",
    "cityLabel": "Cidade",
    "stateProvinceLabel": "Estado / Província",
    "countryLabel": "País",
    "updatePost": "Atualizar anúncio de procura",
    "postAd": "Publicar anúncio de procura",
    "errorTitleRequired": "O título é obrigatório",
    "errorTitleTooLong": "O título deve ter no máximo 200 caracteres",
    "errorCategoryRequired": "A categoria é obrigatória",
    "errorPartTypeRequired": "O tipo de peça é obrigatório quando a categoria é Peças",
    "errorDescriptionRequired": "A descrição é obrigatória",
    "errorDescriptionTooLong": "A descrição deve ter no máximo 2000 caracteres",
    "errorBudgetRange": "O orçamento mínimo não pode exceder o máximo"
  },
  "ru": {
    "titleLabel": "Заголовок",
    "titlePlaceholder": "напр., Ищу двигатель A-серии 1275cc",
    "categoryLabel": "Категория",
    "categorySelect": "Выберите категорию...",
    "categoryVehicle": "Автомобиль",
    "categoryEngine": "Двигатель",
    "categoryParts": "Запчасти",
    "partTypeLabel": "Тип запчасти",
    "partTypeSelect": "Выберите тип запчасти...",
    "partBodyPanels": "Кузовные панели",
    "partEngineParts": "Детали двигателя",
    "partSuspension": "Подвеска",
    "partBrakes": "Тормоза",
    "partElectrical": "Электрика",
    "partInterior": "Салон",
    "partWheelsTyres": "Колёса и шины",
    "partTransmission": "Трансмиссия",
    "partCooling": "Охлаждение",
    "partFuelSystem": "Топливная система",
    "partExhaust": "Выхлоп",
    "partAccessories": "Аксессуары",
    "partOther": "Другое",
    "descriptionLabel": "Описание",
    "descriptionPlaceholder": "Подробно опишите, что вы ищете. Укажите конкретные требования, годы выпуска, приемлемое состояние и т. д.",
    "conditionLabel": "Предпочтительное состояние",
    "conditionAny": "Любое состояние",
    "conditionExcellent": "Отличное",
    "conditionGood": "Хорошее",
    "conditionFair": "Удовлетворительное",
    "conditionProject": "Под восстановление",
    "budgetLabel": "Диапазон бюджета",
    "budgetMin": "Мин",
    "budgetMax": "Макс",
    "currencyLabel": "Валюта",
    "locationLabel": "Местоположение",
    "cityLabel": "Город",
    "stateProvinceLabel": "Регион / Область",
    "countryLabel": "Страна",
    "updatePost": "Обновить объявление о поиске",
    "postAd": "Разместить объявление о поиске",
    "errorTitleRequired": "Заголовок обязателен",
    "errorTitleTooLong": "Заголовок должен содержать не более 200 символов",
    "errorCategoryRequired": "Категория обязательна",
    "errorPartTypeRequired": "Тип запчасти обязателен, когда категория — Запчасти",
    "errorDescriptionRequired": "Описание обязательно",
    "errorDescriptionTooLong": "Описание должно содержать не более 2000 символов",
    "errorBudgetRange": "Минимальный бюджет не может превышать максимальный"
  },
  "ja": {
    "titleLabel": "タイトル",
    "titlePlaceholder": "例: 1275cc Aシリーズエンジンを探しています",
    "categoryLabel": "カテゴリ",
    "categorySelect": "カテゴリを選択...",
    "categoryVehicle": "車両",
    "categoryEngine": "エンジン",
    "categoryParts": "パーツ",
    "partTypeLabel": "パーツの種類",
    "partTypeSelect": "パーツの種類を選択...",
    "partBodyPanels": "ボディパネル",
    "partEngineParts": "エンジン部品",
    "partSuspension": "サスペンション",
    "partBrakes": "ブレーキ",
    "partElectrical": "電装",
    "partInterior": "内装",
    "partWheelsTyres": "ホイールとタイヤ",
    "partTransmission": "トランスミッション",
    "partCooling": "冷却",
    "partFuelSystem": "燃料システム",
    "partExhaust": "排気",
    "partAccessories": "アクセサリー",
    "partOther": "その他",
    "descriptionLabel": "説明",
    "descriptionPlaceholder": "探しているものを詳しく説明してください。具体的な要件、年式、許容できる状態などを含めてください。",
    "conditionLabel": "状態の希望",
    "conditionAny": "状態を問わない",
    "conditionExcellent": "極上",
    "conditionGood": "良好",
    "conditionFair": "並",
    "conditionProject": "レストア前提",
    "budgetLabel": "予算の範囲",
    "budgetMin": "最小",
    "budgetMax": "最大",
    "currencyLabel": "通貨",
    "locationLabel": "場所",
    "cityLabel": "市区町村",
    "stateProvinceLabel": "都道府県 / 州",
    "countryLabel": "国",
    "updatePost": "募集投稿を更新",
    "postAd": "募集広告を投稿",
    "errorTitleRequired": "タイトルは必須です",
    "errorTitleTooLong": "タイトルは200文字以内にしてください",
    "errorCategoryRequired": "カテゴリは必須です",
    "errorPartTypeRequired": "カテゴリがパーツの場合、パーツの種類は必須です",
    "errorDescriptionRequired": "説明は必須です",
    "errorDescriptionTooLong": "説明は2000文字以内にしてください",
    "errorBudgetRange": "最小予算は最大予算を超えることはできません"
  },
  "zh": {
    "titleLabel": "标题",
    "titlePlaceholder": "例如：寻找 1275cc A 系列发动机",
    "categoryLabel": "类别",
    "categorySelect": "选择一个类别……",
    "categoryVehicle": "车辆",
    "categoryEngine": "发动机",
    "categoryParts": "零件",
    "partTypeLabel": "零件类型",
    "partTypeSelect": "选择一个零件类型……",
    "partBodyPanels": "车身板件",
    "partEngineParts": "发动机零件",
    "partSuspension": "悬挂",
    "partBrakes": "刹车",
    "partElectrical": "电气",
    "partInterior": "内饰",
    "partWheelsTyres": "轮毂与轮胎",
    "partTransmission": "变速箱",
    "partCooling": "冷却",
    "partFuelSystem": "燃油系统",
    "partExhaust": "排气",
    "partAccessories": "配件",
    "partOther": "其他",
    "descriptionLabel": "描述",
    "descriptionPlaceholder": "详细描述您要寻找的物品。包括具体要求、车型年份、可接受的状态等。",
    "conditionLabel": "状态偏好",
    "conditionAny": "任何状态",
    "conditionExcellent": "极佳",
    "conditionGood": "良好",
    "conditionFair": "一般",
    "conditionProject": "待修复",
    "budgetLabel": "预算范围",
    "budgetMin": "最低",
    "budgetMax": "最高",
    "currencyLabel": "货币",
    "locationLabel": "位置",
    "cityLabel": "城市",
    "stateProvinceLabel": "州 / 省",
    "countryLabel": "国家",
    "updatePost": "更新求购帖",
    "postAd": "发布求购广告",
    "errorTitleRequired": "标题为必填项",
    "errorTitleTooLong": "标题不得超过 200 个字符",
    "errorCategoryRequired": "类别为必填项",
    "errorPartTypeRequired": "当类别为零件时，零件类型为必填项",
    "errorDescriptionRequired": "描述为必填项",
    "errorDescriptionTooLong": "描述不得超过 2000 个字符",
    "errorBudgetRange": "最低预算不能超过最高预算"
  },
  "ko": {
    "titleLabel": "제목",
    "titlePlaceholder": "예: 1275cc A 시리즈 엔진을 찾습니다",
    "categoryLabel": "카테고리",
    "categorySelect": "카테고리를 선택하세요...",
    "categoryVehicle": "차량",
    "categoryEngine": "엔진",
    "categoryParts": "부품",
    "partTypeLabel": "부품 유형",
    "partTypeSelect": "부품 유형을 선택하세요...",
    "partBodyPanels": "차체 패널",
    "partEngineParts": "엔진 부품",
    "partSuspension": "서스펜션",
    "partBrakes": "브레이크",
    "partElectrical": "전기 장치",
    "partInterior": "실내",
    "partWheelsTyres": "휠 및 타이어",
    "partTransmission": "변속기",
    "partCooling": "냉각",
    "partFuelSystem": "연료 시스템",
    "partExhaust": "배기",
    "partAccessories": "액세서리",
    "partOther": "기타",
    "descriptionLabel": "설명",
    "descriptionPlaceholder": "찾고 있는 것을 자세히 설명해 주세요. 구체적인 요구 사항, 모델 연식, 허용 가능한 상태 등을 포함하세요.",
    "conditionLabel": "상태 선호",
    "conditionAny": "모든 상태",
    "conditionExcellent": "최상",
    "conditionGood": "양호",
    "conditionFair": "보통",
    "conditionProject": "복원용",
    "budgetLabel": "예산 범위",
    "budgetMin": "최소",
    "budgetMax": "최대",
    "currencyLabel": "통화",
    "locationLabel": "위치",
    "cityLabel": "도시",
    "stateProvinceLabel": "주 / 도",
    "countryLabel": "국가",
    "updatePost": "구함 게시물 수정",
    "postAd": "구함 광고 게시",
    "errorTitleRequired": "제목은 필수입니다",
    "errorTitleTooLong": "제목은 200자 이하여야 합니다",
    "errorCategoryRequired": "카테고리는 필수입니다",
    "errorPartTypeRequired": "카테고리가 부품일 때 부품 유형은 필수입니다",
    "errorDescriptionRequired": "설명은 필수입니다",
    "errorDescriptionTooLong": "설명은 2000자 이하여야 합니다",
    "errorBudgetRange": "최소 예산은 최대 예산을 초과할 수 없습니다"
  }
}
</i18n>
