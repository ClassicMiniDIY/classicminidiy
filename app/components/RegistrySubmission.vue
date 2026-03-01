<script lang="ts" setup>
  import type { RegistryItem } from '../../data/models/registry';

  const { t } = useI18n();
  const { submitRegistryEntry } = useRegistry();
  interface TouchedFields {
    submittedBy: boolean;
    submittedByEmail: boolean;
    year: boolean;
    model: boolean;
    trim: boolean;
    bodyType: boolean;
    engineSize: boolean;
    [key: string]: boolean;
  }

  const touchedFields = ref<TouchedFields>({
    submittedBy: false,
    submittedByEmail: false,
    year: false,
    model: false,
    trim: false,
    bodyType: false,
    engineSize: false,
  });
  const validationRules = () => ({
    required: (value: string) => !!value || t('validation.required'),
    email: (value: string) => {
      const pattern =
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      return pattern.test(value) || t('validation.invalid_email');
    },
  });

  const rules = ref(validationRules());

  // Options for USelect components
  const bodyTypeOptions = computed(() => [
    { label: t('body_types.saloon'), value: 'Saloon' },
    { label: t('body_types.pickup'), value: 'Pickup' },
    { label: t('body_types.estate'), value: 'Estate' },
    { label: t('body_types.cabriolet'), value: 'Cabriolet' },
    { label: t('body_types.clubman'), value: 'Clubman' },
    { label: t('body_types.van'), value: 'Van' },
    { label: t('body_types.hornet'), value: 'Hornet' },
  ]);

  const engineSizeOptions = [850, 997, 998, 1100, 1275].map((size) => ({
    label: String(size),
    value: size,
  }));

  const initialDetails: RegistryItem = {
    year: 1959,
    model: '',
    trim: '',
    bodyType: 'Saloon',
    engineSize: 850,
    color: '',
    bodyNum: '',
    engineNum: '',
    buildDate: [],
    notes: '',
    submittedBy: '',
    submittedByEmail: '',
    uniqueId: '',
  };

  const details = ref({ ...initialDetails });
  const issueCreated = ref(false);
  const apiError = ref(false);
  const apiMessage = ref('');
  const submission = ref<{
    number: number | null;
    url: string | null;
  }>({ number: null, url: null });
  const processing = ref(false);

  function validateForm() {
    const requiredFields = [
      details.value.submittedBy,
      details.value.submittedByEmail && rules.value.email(details.value.submittedByEmail),
      details.value.year,
      details.value.model,
      details.value.trim,
      details.value.bodyType,
      details.value.engineSize,
    ];

    return requiredFields.every((field) => !!field);
  }

  async function submit() {
    // Mark all fields as touched when submitting
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = true;
    });

    if (!validateForm()) {
      return;
    }

    processing.value = true;
    try {
      await submitRegistryEntry(details.value);
      issueCreated.value = true;
      resetForm();
    } catch (error) {
      issueCreated.value = false;
      apiError.value = true;
      console.error(error);
      apiMessage.value = t('error.api_unavailable');
    } finally {
      processing.value = false;
    }
  }

  function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return function (...args: Parameters<T>) {
      clearTimeout(timeout);
      // @ts-ignore
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const debouncedSubmit = debounce(submit, 300);

  function resetForm() {
    details.value = { ...initialDetails };
    // Reset touched state when form is reset
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = false;
    });
  }

  function submitAnotherMini() {
    issueCreated.value = false;
    apiError.value = false;
    submission.value = { number: null, url: null };
  }
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-lg">{{ t('title') }}</h2>
    </template>

    <!-- Success State -->
    <div v-if="!processing && issueCreated && submission && !apiError">
      <div class="text-center py-5">
        <i class="text-4xl text-success fa-duotone fa-box-check fa-beat py-5"></i>
        <h1 class="text-2xl font-bold mb-1">{{ t('success.thank_you') }}</h1>
        <h2 class="text-lg mb-4">
          {{ t('success.submitted_message') }}
        </h2>
        <ul class="mb-5">
          <li class="mb-2">
            {{ t('success.submission_details') }}
            <strong>{{ submission.number }}</strong>
          </li>
          <li>
            {{ t('success.track_submission') }}
            <a class="text-primary hover:underline" target="_blank" v-if="submission.url" :href="submission.url">
              {{ t('success.submission_link') }} {{ submission.number }}</a
            >
          </li>
        </ul>
        <UButton color="primary" @click="submitAnotherMini()">
          <i class="fa-duotone fa-solid fa-plus-large mr-2"></i>
          {{ t('success.submit_another') }}
        </UButton>
      </div>
    </div>

    <!-- Form -->
    <div v-if="!issueCreated">
      <form @submit.prevent="submit">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
          <!-- Personal Info Section -->
          <div class="col-span-1 md:col-span-2">
            <h2 class="text-xl font-bold">{{ t('sections.personal_info') }}</h2>
          </div>

          <!-- Your Name -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium"
                >{{ t('form_labels.your_name') }} <span class="text-error">*</span></span
              >
              <span class="text-sm text-muted"><i class="fad fa-user"></i></span>
            </label>
            <UInput
              type="text"
              :placeholder="t('placeholders.name')"
              v-model="details.submittedBy"
              :color="details.submittedBy === '' && touchedFields.submittedBy ? 'error' : undefined"
              required
              @blur="touchedFields.submittedBy = true"
            />
            <p v-if="details.submittedBy === '' && touchedFields.submittedBy" class="text-sm text-error mt-1">
              {{ t('validation.required') }}
            </p>
          </div>

          <!-- Your Email -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium"
                >{{ t('form_labels.your_email') }} <span class="text-error">*</span></span
              >
              <span class="text-sm text-muted"><i class="fad fa-at"></i></span>
            </label>
            <UInput
              type="email"
              :placeholder="t('placeholders.email')"
              v-model="details.submittedByEmail"
              :color="
                (details.submittedByEmail === '' || !rules.email(details.submittedByEmail)) &&
                touchedFields.submittedByEmail
                  ? 'error'
                  : undefined
              "
              required
              @blur="touchedFields.submittedByEmail = true"
            />
            <p
              v-if="
                (details.submittedByEmail === '' || !rules.email(details.submittedByEmail)) &&
                touchedFields.submittedByEmail
              "
              class="text-sm text-error mt-1"
            >
              {{ details.submittedByEmail === '' ? t('validation.required') : t('validation.invalid_email') }}
            </p>
          </div>

          <!-- Car Details Section -->
          <div class="col-span-1 md:col-span-2">
            <h2 class="text-xl font-bold">{{ t('sections.car_details') }}</h2>
          </div>

          <!-- Left Column -->
          <div class="space-y-4">
            <!-- Model Year -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium"
                  >{{ t('form_labels.model_year') }} <span class="text-error">*</span></span
                >
                <span class="text-sm text-muted"><i class="fad fa-calendar"></i></span>
              </label>
              <UInput
                type="number"
                min="1959"
                max="2000"
                v-model.number="details.year"
                :color="!details.year && touchedFields.year ? 'error' : undefined"
                required
                @blur="touchedFields.year = true"
              />
              <p v-if="!details.year && touchedFields.year" class="text-sm text-error mt-1">
                {{ t('validation.required') }}
              </p>
            </div>

            <!-- Model -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium">{{ t('form_labels.model') }} <span class="text-error">*</span></span>
                <span class="text-sm text-muted"><i class="fad fa-car"></i></span>
              </label>
              <UInput
                type="text"
                :placeholder="t('placeholders.model')"
                v-model="details.model"
                :color="details.model === '' && touchedFields.model ? 'error' : undefined"
                required
                @blur="touchedFields.model = true"
              />
              <p v-if="details.model === '' && touchedFields.model" class="text-sm text-error mt-1">
                {{ t('validation.required') }}
              </p>
            </div>

            <!-- Trim -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium">{{ t('form_labels.trim') }} <span class="text-error">*</span></span>
                <span class="text-sm text-muted"><i class="fad fa-scissors"></i></span>
              </label>
              <UInput
                type="text"
                :placeholder="t('placeholders.trim')"
                v-model="details.trim"
                :color="details.trim === '' && touchedFields.trim ? 'error' : undefined"
                required
                @blur="touchedFields.trim = true"
              />
              <p v-if="details.trim === '' && touchedFields.trim" class="text-sm text-error mt-1">
                {{ t('validation.required') }}
              </p>
            </div>

            <!-- Body Type -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium"
                  >{{ t('form_labels.body_type') }} <span class="text-error">*</span></span
                >
                <span class="text-sm text-muted"><i class="fad fa-cars"></i></span>
              </label>
              <USelect
                v-model="details.bodyType"
                :items="bodyTypeOptions"
                :color="details.bodyType === '' && touchedFields.bodyType ? 'error' : undefined"
                required
                @blur="touchedFields.bodyType = true"
                @change="touchedFields.bodyType = true"
              />
              <p v-if="details.bodyType === '' && touchedFields.bodyType" class="text-sm text-error mt-1">
                {{ t('validation.required') }}
              </p>
            </div>
          </div>

          <!-- Right Column -->
          <div class="space-y-4">
            <!-- Engine Size -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium"
                  >{{ t('form_labels.original_engine_size') }} <span class="text-error">*</span></span
                >
                <span class="text-sm text-muted"><i class="fad fa-engine"></i></span>
              </label>
              <USelect
                v-model.number="details.engineSize"
                :items="engineSizeOptions"
                :color="!details.engineSize && touchedFields.engineSize ? 'error' : undefined"
                required
                @blur="touchedFields.engineSize = true"
                @change="touchedFields.engineSize = true"
              />
              <p v-if="!details.engineSize && touchedFields.engineSize" class="text-sm text-error mt-1">
                {{ t('validation.required') }}
              </p>
            </div>

            <!-- Factory Color -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium">{{ t('form_labels.factory_color') }}</span>
                <span class="text-sm text-muted"><i class="fad fa-palette"></i></span>
              </label>
              <UInput type="text" :placeholder="t('placeholders.color')" v-model="details.color" />
            </div>

            <!-- Body Shell Number -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium">{{ t('form_labels.body_shell_number') }}</span>
                <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
              </label>
              <UInput type="text" :placeholder="t('placeholders.body_number')" v-model="details.bodyNum" />
            </div>

            <!-- Engine Plate Number -->
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium">{{ t('form_labels.engine_plate_number') }}</span>
                <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
              </label>
              <UInput type="text" :placeholder="t('placeholders.engine_number')" v-model="details.engineNum" />
            </div>
          </div>

          <!-- Special Notes -->
          <div class="col-span-1 md:col-span-2">
            <div class="w-full">
              <label class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium">{{ t('form_labels.special_notes') }}</span>
                <span class="text-sm text-muted"><i class="fad fa-note"></i></span>
              </label>
              <UTextarea :placeholder="t('placeholders.notes')" v-model="details.notes" :rows="4" />
            </div>
          </div>
        </div>

        <!-- Error Alert & Submit Button -->
        <div class="mt-6">
          <UAlert v-if="apiError" color="error" class="mb-4">
            <template #icon>
              <i class="fa-duotone fa-circle-exclamation"></i>
            </template>
            <template #title>{{ t('error.title') }}</template>
            <template #description>
              {{ t('error.message') }}
              <p class="mt-2">{{ t('error.check_entries') }}</p>
            </template>
            <template #actions>
              <UButton size="sm" variant="outline" @click="apiError = false">
                {{ t('error.dismiss') }}
              </UButton>
            </template>
          </UAlert>

          <UButton
            color="primary"
            size="lg"
            :disabled="!validateForm() || processing"
            :loading="processing"
            @click="debouncedSubmit()"
          >
            <i class="fad fa-paper-plane mr-2" v-if="!processing"></i>
            {{ t('submit_button') }}
          </UButton>
        </div>
      </form>
    </div>
  </UCard>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Submit Your Mini",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "Thank you!",
      "submitted_message": "Your registry entry has been submitted. Please allow 1-2 days for it to appear in the list.",
      "submission_details": "Your registry submission details is",
      "track_submission": "Track your submission here:",
      "submission_link": "Submission",
      "submit_another": "Submit Another Mini"
    },
    "validation": {
      "required": "This field is required to submit",
      "invalid_email": "Invalid e-mail."
    },
    "sections": {
      "personal_info": "Personal Info:",
      "car_details": "Car Details:"
    },
    "form_labels": {
      "your_name": "Your Name",
      "your_email": "Your Email",
      "model_year": "Model Year",
      "model": "Model",
      "trim": "Trim",
      "body_type": "Body Type",
      "original_engine_size": "Original Engine Size",
      "factory_color": "Factory Color",
      "body_shell_number": "Body Shell Number",
      "engine_plate_number": "Engine Plate Number",
      "special_notes": "Special or Additional Notes"
    },
    "placeholders": {
      "name": "ex. John Smith",
      "email": "ex. john{'@'}example.com",
      "model": "ex. Morris Mini",
      "trim": "ex. Mini 50",
      "color": "ex. Clipper Blue",
      "body_number": "ex. GB190fW",
      "engine_number": "ex. 12H4102",
      "notes": "ex. This car was only produced from 1959 to 1960"
    },
    "body_types": {
      "saloon": "Saloon",
      "pickup": "Pickup",
      "estate": "Estate",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Van",
      "hornet": "Hornet"
    },
    "error": {
      "title": "I'm Sorry!",
      "message": "There was a problem submitting your submission at this time, please try again later!",
      "check_entries": "Please check your entries and try again",
      "dismiss": "Dismiss",
      "api_unavailable": "API is currently unavailable. Please try again later."
    },
    "submit_button": "Submit"
  },
  "de": {
    "title": "Ihren Mini einreichen",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "Vielen Dank!",
      "submitted_message": "Ihr Registereintrag wurde eingereicht. Bitte rechnen Sie mit 1-2 Tagen, bis er in der Liste erscheint.",
      "submission_details": "Ihre Registereinreichung ist",
      "track_submission": "Verfolgen Sie Ihre Einreichung hier:",
      "submission_link": "Einreichung",
      "submit_another": "Einen weiteren Mini einreichen"
    },
    "validation": {
      "required": "Dieses Feld ist zum Absenden erforderlich",
      "invalid_email": "Ungültige E-Mail."
    },
    "sections": {
      "personal_info": "Persönliche Informationen:",
      "car_details": "Fahrzeugdetails:"
    },
    "form_labels": {
      "your_name": "Ihr Name",
      "your_email": "Ihre E-Mail",
      "model_year": "Modelljahr",
      "model": "Modell",
      "trim": "Ausstattung",
      "body_type": "Karosserietyp",
      "original_engine_size": "Original-Motorgröße",
      "factory_color": "Werksfarbe",
      "body_shell_number": "Karosserienummer",
      "engine_plate_number": "Motorplattennummer",
      "special_notes": "Besondere oder zusätzliche Notizen"
    },
    "placeholders": {
      "name": "z.B. Max Mustermann",
      "email": "z.B. max{'@'}beispiel.de",
      "model": "z.B. Morris Mini",
      "trim": "z.B. Mini 50",
      "color": "z.B. Clipper Blau",
      "body_number": "z.B. GB190fW",
      "engine_number": "z.B. 12H4102",
      "notes": "z.B. Dieses Auto wurde nur von 1959 bis 1960 produziert"
    },
    "body_types": {
      "saloon": "Limousine",
      "pickup": "Pickup",
      "estate": "Kombi",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Transporter",
      "hornet": "Hornet"
    },
    "error": {
      "title": "Es tut mir leid!",
      "message": "Es gab ein Problem beim Einreichen Ihrer Einreichung, bitte versuchen Sie es später erneut!",
      "check_entries": "Bitte überprüfen Sie Ihre Eingaben und versuchen Sie es erneut",
      "dismiss": "Schließen",
      "api_unavailable": "API ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut."
    },
    "submit_button": "Absenden"
  },
  "es": {
    "title": "Envía tu Mini",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "¡Gracias!",
      "submitted_message": "Tu entrada del registro ha sido enviada. Por favor permite 1-2 días para que aparezca en la lista.",
      "submission_details": "Los detalles de tu envío del registro son",
      "track_submission": "Rastrea tu envío aquí:",
      "submission_link": "Envío",
      "submit_another": "Enviar Otro Mini"
    },
    "validation": {
      "required": "Este campo es requerido para enviar",
      "invalid_email": "Correo electrónico inválido."
    },
    "sections": {
      "personal_info": "Información Personal:",
      "car_details": "Detalles del Coche:"
    },
    "form_labels": {
      "your_name": "Tu Nombre",
      "your_email": "Tu Correo Electrónico",
      "model_year": "Año del Modelo",
      "model": "Modelo",
      "trim": "Acabado",
      "body_type": "Tipo de Carrocería",
      "original_engine_size": "Tamaño Original del Motor",
      "factory_color": "Color de Fábrica",
      "body_shell_number": "Número del Chasis",
      "engine_plate_number": "Número de la Placa del Motor",
      "special_notes": "Notas Especiales o Adicionales"
    },
    "placeholders": {
      "name": "ej. Juan Pérez",
      "email": "ej. juan{'@'}ejemplo.com",
      "model": "ej. Morris Mini",
      "trim": "ej. Mini 50",
      "color": "ej. Azul Clipper",
      "body_number": "ej. GB190fW",
      "engine_number": "ej. 12H4102",
      "notes": "ej. Este coche solo se produjo de 1959 a 1960"
    },
    "body_types": {
      "saloon": "Sedán",
      "pickup": "Pickup",
      "estate": "Familiar",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Furgoneta",
      "hornet": "Hornet"
    },
    "error": {
      "title": "¡Lo Siento!",
      "message": "Hubo un problema enviando tu envío en este momento, ¡por favor inténtalo de nuevo más tarde!",
      "check_entries": "Por favor verifica tus entradas e inténtalo de nuevo",
      "dismiss": "Descartar",
      "api_unavailable": "La API no está disponible actualmente. Por favor inténtalo de nuevo más tarde."
    },
    "submit_button": "Enviar"
  },
  "fr": {
    "title": "Soumettre votre Mini",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "Merci !",
      "submitted_message": "Votre entrée de registre a été soumise. Veuillez compter 1-2 jours pour qu'elle apparaisse dans la liste.",
      "submission_details": "Les détails de votre soumission de registre sont",
      "track_submission": "Suivez votre soumission ici :",
      "submission_link": "Soumission",
      "submit_another": "Soumettre une autre Mini"
    },
    "validation": {
      "required": "Ce champ est requis pour soumettre",
      "invalid_email": "E-mail invalide."
    },
    "sections": {
      "personal_info": "Informations personnelles :",
      "car_details": "Détails de la voiture :"
    },
    "form_labels": {
      "your_name": "Votre nom",
      "your_email": "Votre e-mail",
      "model_year": "Année du modèle",
      "model": "Modèle",
      "trim": "Finition",
      "body_type": "Type de carrosserie",
      "original_engine_size": "Taille de moteur d'origine",
      "factory_color": "Couleur d'usine",
      "body_shell_number": "Numéro de coque de carrosserie",
      "engine_plate_number": "Numéro de plaque moteur",
      "special_notes": "Notes spéciales ou supplémentaires"
    },
    "placeholders": {
      "name": "ex. Jean Dupont",
      "email": "ex. jean{'@'}exemple.com",
      "model": "ex. Morris Mini",
      "trim": "ex. Mini 50",
      "color": "ex. Bleu Clipper",
      "body_number": "ex. GB190fW",
      "engine_number": "ex. 12H4102",
      "notes": "ex. Cette voiture n'a été produite que de 1959 à 1960"
    },
    "body_types": {
      "saloon": "Berline",
      "pickup": "Pick-up",
      "estate": "Break",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Fourgon",
      "hornet": "Hornet"
    },
    "error": {
      "title": "Je suis désolé !",
      "message": "Il y a eu un problème lors de la soumission de votre soumission pour le moment, veuillez réessayer plus tard !",
      "check_entries": "Veuillez vérifier vos entrées et réessayer",
      "dismiss": "Annuler",
      "api_unavailable": "L'API est actuellement indisponible. Veuillez réessayer plus tard."
    },
    "submit_button": "Soumettre"
  },
  "it": {
    "title": "Invia la tua Mini",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "Grazie!",
      "submitted_message": "La tua iscrizione al registro è stata inviata. Permettici 1-2 giorni perché appaia nell'elenco.",
      "submission_details": "I dettagli della tua iscrizione al registro sono",
      "track_submission": "Tieni traccia della tua iscrizione qui:",
      "submission_link": "Iscrizione",
      "submit_another": "Invia un'altra Mini"
    },
    "validation": {
      "required": "Questo campo è obbligatorio per l'invio",
      "invalid_email": "Email non valida."
    },
    "sections": {
      "personal_info": "Informazioni personali:",
      "car_details": "Dettagli auto:"
    },
    "form_labels": {
      "your_name": "Il tuo nome",
      "your_email": "La tua email",
      "model_year": "Anno del modello",
      "model": "Modello",
      "trim": "Allestimento",
      "body_type": "Tipo di carrozzeria",
      "original_engine_size": "Cilindrata motore originale",
      "factory_color": "Colore di fabbrica",
      "body_shell_number": "Numero scocca",
      "engine_plate_number": "Numero targhetta motore",
      "special_notes": "Note speciali o aggiuntive"
    },
    "placeholders": {
      "name": "es. Mario Rossi",
      "email": "es. mario{'@'}esempio.com",
      "model": "es. Morris Mini",
      "trim": "es. Mini 50",
      "color": "es. Clipper Blue",
      "body_number": "es. GB190fW",
      "engine_number": "es. 12H4102",
      "notes": "es. Quest'auto è stata prodotta solo dal 1959 al 1960"
    },
    "body_types": {
      "saloon": "Berlina",
      "pickup": "Pickup",
      "estate": "Familiare",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Furgone",
      "hornet": "Hornet"
    },
    "error": {
      "title": "Mi dispiace!",
      "message": "C'è stato un problema nell'inviare la tua iscrizione in questo momento, riprova più tardi!",
      "check_entries": "Controlla le tue voci e riprova",
      "dismiss": "Chiudi",
      "api_unavailable": "API attualmente non disponibile. Riprova più tardi."
    },
    "submit_button": "Invia"
  },
  "ja": {
    "title": "あなたのMiniを登録",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "ありがとうございます！",
      "submitted_message": "レジストリエントリが送信されました。リストに表示されるまで1～2日お待ちください。",
      "submission_details": "レジストリ送信の詳細は",
      "track_submission": "送信状況をここで確認:",
      "submission_link": "送信",
      "submit_another": "別のMiniを登録"
    },
    "validation": {
      "required": "このフィールドは送信に必要です",
      "invalid_email": "無効なメールアドレスです。"
    },
    "sections": {
      "personal_info": "個人情報:",
      "car_details": "車両詳細:"
    },
    "form_labels": {
      "your_name": "お名前",
      "your_email": "メールアドレス",
      "model_year": "年式",
      "model": "モデル",
      "trim": "トリム",
      "body_type": "ボディタイプ",
      "original_engine_size": "オリジナルエンジンサイズ",
      "factory_color": "工場色",
      "body_shell_number": "ボディシェル番号",
      "engine_plate_number": "エンジンプレート番号",
      "special_notes": "特別または追加の備考"
    },
    "placeholders": {
      "name": "例: 田中太郎",
      "email": "例: john{'@'}example.com",
      "model": "例: Morris Mini",
      "trim": "例: Mini 50",
      "color": "例: Clipper Blue",
      "body_number": "例: GB190fW",
      "engine_number": "例: 12H4102",
      "notes": "例: この車は1959年から1960年まで生産されました"
    },
    "body_types": {
      "saloon": "サルーン",
      "pickup": "ピックアップ",
      "estate": "エステート",
      "cabriolet": "カブリオレ",
      "clubman": "クラブマン",
      "van": "バン",
      "hornet": "ホーネット"
    },
    "error": {
      "title": "申し訳ございません！",
      "message": "現在、送信に問題が発生しています。後でもう一度お試しください！",
      "check_entries": "入力内容を確認して再度お試しください",
      "dismiss": "閉じる",
      "api_unavailable": "APIは現在利用できません。後でもう一度お試しください。"
    },
    "submit_button": "送信"
  },
  "ko": {
    "title": "미니 제출하기",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "감사합니다!",
      "submitted_message": "귀하의 레지스트리 항목이 제출되었습니다. 목록에 나타나기까지 1-2일 정도 소요됩니다.",
      "submission_details": "귀하의 레지스트리 제출 세부사항은",
      "track_submission": "여기에서 제출 상태를 추적하세요:",
      "submission_link": "제출",
      "submit_another": "다른 미니 제출하기"
    },
    "validation": {
      "required": "이 필드는 제출하기 위해 필수입니다",
      "invalid_email": "유효하지 않은 이메일입니다."
    },
    "sections": {
      "personal_info": "개인 정보:",
      "car_details": "차량 세부사항:"
    },
    "form_labels": {
      "your_name": "이름",
      "your_email": "이메일",
      "model_year": "모델 연도",
      "model": "모델",
      "trim": "트림",
      "body_type": "바디 타입",
      "original_engine_size": "원래 엔진 크기",
      "factory_color": "공장 색상",
      "body_shell_number": "바디 셸 번호",
      "engine_plate_number": "엔진 플레이트 번호",
      "special_notes": "특별하거나 추가 참고사항"
    },
    "placeholders": {
      "name": "예) 김철수",
      "email": "예) john{'@'}example.com",
      "model": "예) Morris Mini",
      "trim": "예) Mini 50",
      "color": "예) Clipper Blue",
      "body_number": "예) GB190fW",
      "engine_number": "예) 12H4102",
      "notes": "예) 이 차량은 1959년부터 1960년까지만 생산되었습니다"
    },
    "body_types": {
      "saloon": "세단",
      "pickup": "픽업",
      "estate": "에스테이트",
      "cabriolet": "카브리올레",
      "clubman": "클럽맨",
      "van": "밴",
      "hornet": "호넷"
    },
    "error": {
      "title": "죄송합니다!",
      "message": "현재 귀하의 제출을 처리하는 데 문제가 있습니다. 나중에 다시 시도해 주세요!",
      "check_entries": "입력 내용을 확인하고 다시 시도해 주세요",
      "dismiss": "닫기",
      "api_unavailable": "API를 현재 사용할 수 없습니다. 나중에 다시 시도해 주세요."
    },
    "submit_button": "제출"
  },
  "pt": {
    "title": "Envie Seu Mini",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "Obrigado!",
      "submitted_message": "Sua entrada no registro foi enviada. Por favor, aguarde 1-2 dias para aparecer na lista.",
      "submission_details": "Os detalhes da sua submissão do registro são",
      "track_submission": "Acompanhe sua submissão aqui:",
      "submission_link": "Submissão",
      "submit_another": "Enviar Outro Mini"
    },
    "validation": {
      "required": "Este campo é obrigatório para enviar",
      "invalid_email": "E-mail inválido."
    },
    "sections": {
      "personal_info": "Informações Pessoais:",
      "car_details": "Detalhes do Carro:"
    },
    "form_labels": {
      "your_name": "Seu Nome",
      "your_email": "Seu E-mail",
      "model_year": "Ano do Modelo",
      "model": "Modelo",
      "trim": "Versão",
      "body_type": "Tipo de Carroceria",
      "original_engine_size": "Tamanho Original do Motor",
      "factory_color": "Cor de Fábrica",
      "body_shell_number": "Número da Carroceria",
      "engine_plate_number": "Número da Placa do Motor",
      "special_notes": "Observações Especiais ou Adicionais"
    },
    "placeholders": {
      "name": "ex. João Silva",
      "email": "ex. joao{'@'}exemplo.com",
      "model": "ex. Morris Mini",
      "trim": "ex. Mini 50",
      "color": "ex. Azul Clipper",
      "body_number": "ex. GB190fW",
      "engine_number": "ex. 12H4102",
      "notes": "ex. Este carro foi produzido apenas de 1959 a 1960"
    },
    "body_types": {
      "saloon": "Sedan",
      "pickup": "Pickup",
      "estate": "Perua",
      "cabriolet": "Conversível",
      "clubman": "Clubman",
      "van": "Van",
      "hornet": "Hornet"
    },
    "error": {
      "title": "Desculpe!",
      "message": "Houve um problema ao enviar sua submissão no momento, tente novamente mais tarde!",
      "check_entries": "Verifique suas entradas e tente novamente",
      "dismiss": "Dispensar",
      "api_unavailable": "API está indisponível no momento. Tente novamente mais tarde."
    },
    "submit_button": "Enviar"
  },
  "ru": {
    "title": "Отправить ваш Мини",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "Спасибо!",
      "submitted_message": "Ваша запись в реестр была отправлена. Пожалуйста, подождите 1-2 дня, чтобы она появилась в списке.",
      "submission_details": "Детали вашей подачи в реестр",
      "track_submission": "Отследить вашу подачу здесь:",
      "submission_link": "Подача",
      "submit_another": "Отправить другой Мини"
    },
    "validation": {
      "required": "Это поле обязательно для заполнения",
      "invalid_email": "Неверный e-mail."
    },
    "sections": {
      "personal_info": "Личная информация:",
      "car_details": "Детали автомобиля:"
    },
    "form_labels": {
      "your_name": "Ваше имя",
      "your_email": "Ваш Email",
      "model_year": "Год модели",
      "model": "Модель",
      "trim": "Комплектация",
      "body_type": "Тип кузова",
      "original_engine_size": "Оригинальный объем двигателя",
      "factory_color": "Заводской цвет",
      "body_shell_number": "Номер кузова",
      "engine_plate_number": "Номер табличкы двигателя",
      "special_notes": "Особые или дополнительные примечания"
    },
    "placeholders": {
      "name": "например, Иван Иванов",
      "email": "например, ivan{'@'}example.com",
      "model": "например, Morris Mini",
      "trim": "например, Mini 50",
      "color": "например, Clipper Blue",
      "body_number": "например, GB190fW",
      "engine_number": "например, 12H4102",
      "notes": "например, Этот автомобиль производился только с 1959 по 1960 год"
    },
    "body_types": {
      "saloon": "Седан",
      "pickup": "Пикап",
      "estate": "Универсал",
      "cabriolet": "Кабриолет",
      "clubman": "Клабмэн",
      "van": "Фургон",
      "hornet": "Хорнет"
    },
    "error": {
      "title": "Извините!",
      "message": "Возникла проблема с отправкой вашей заявки в данный момент, пожалуйста, попробуйте позже!",
      "check_entries": "Пожалуйста, проверьте ваши записи и попробуйте снова",
      "dismiss": "Отклонить",
      "api_unavailable": "API в настоящее время недоступен. Пожалуйста, попробуйте позже."
    },
    "submit_button": "Отправить"
  },
  "zh": {
    "title": "提交您的Mini",
    "success": {
      "icon_beat": "fa-beat",
      "thank_you": "谢谢！",
      "submitted_message": "您的注册条目已提交。请等待1-2天以使其出现在列表中。",
      "submission_details": "您的注册提交详情为",
      "track_submission": "在此处跟踪您的提交：",
      "submission_link": "提交记录",
      "submit_another": "提交另一辆Mini"
    },
    "validation": {
      "required": "此字段为必填项",
      "invalid_email": "无效的电子邮件。"
    },
    "sections": {
      "personal_info": "个人信息：",
      "car_details": "汽车详情："
    },
    "form_labels": {
      "your_name": "您的姓名",
      "your_email": "您的邮箱",
      "model_year": "型号年份",
      "model": "型号",
      "trim": "配置",
      "body_type": "车身类型",
      "original_engine_size": "原装发动机排量",
      "factory_color": "出厂颜色",
      "body_shell_number": "车身编号",
      "engine_plate_number": "发动机铭牌编号",
      "special_notes": "特殊或附加说明"
    },
    "placeholders": {
      "name": "例：张三",
      "email": "例：john{'@'}example.com",
      "model": "例：Morris Mini",
      "trim": "例：Mini 50",
      "color": "例：蓝色",
      "body_number": "例：GB190fW",
      "engine_number": "例：12H4102",
      "notes": "例：此车仅在1959-1960年间生产"
    },
    "body_types": {
      "saloon": "轿车",
      "pickup": "皮卡",
      "estate": "旅行车",
      "cabriolet": "敞篷车",
      "clubman": "俱乐部版",
      "van": "厢式货车",
      "hornet": "大黄蜂"
    },
    "error": {
      "title": "抱歉！",
      "message": "目前提交您的申请时出现问题，请稍后重试！",
      "check_entries": "请检查您的条目并重试",
      "dismiss": "关闭",
      "api_unavailable": "API目前不可用。请稍后重试。"
    },
    "submit_button": "提交"
  }
}
</i18n>

<style lang="scss">
  .fad.fa-asterisk {
    font-size: 1rem !important;
  }
</style>
