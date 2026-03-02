<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { capture } = usePostHog();
  const { isAuthenticated } = useAuth();
  const { submitNewItem } = useSubmissions();

  const submissionSuccess = ref(false);
  const apiError = ref(false);
  const submissionId = ref('');
  const apiMessage = ref('');
  const processing = ref(false);

  interface TouchedFields {
    year: boolean;
    model: boolean;
    trim: boolean;
    bodyType: boolean;
    engineSize: boolean;
    [key: string]: boolean;
  }

  const touchedFields = ref<TouchedFields>({
    year: false,
    model: false,
    trim: false,
    bodyType: false,
    engineSize: false,
  });

  const formData = reactive({
    year: 1959 as number,
    model: '',
    trim: '',
    bodyType: 'Saloon',
    engineSize: 850 as number,
    color: '',
    bodyNum: '',
    engineNum: '',
    notes: '',
  });

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

  useHead({
    title: t('seo.title'),
    meta: [
      {
        name: 'description',
        content: t('seo.description'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('seo.og_title'),
    ogDescription: t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/contribute/registry',
    ogType: 'website',
  });

  function validateForm(): boolean {
    return !!(formData.year && formData.model && formData.trim && formData.bodyType && formData.engineSize);
  }

  async function submit() {
    // Mark all fields as touched
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = true;
    });

    if (!validateForm()) {
      return;
    }

    processing.value = true;
    try {
      const response = await submitNewItem('registry', {
        year: formData.year,
        model: formData.model,
        trim: formData.trim,
        bodyType: formData.bodyType,
        engineSize: formData.engineSize,
        color: formData.color || undefined,
        bodyNum: formData.bodyNum || undefined,
        engineNum: formData.engineNum || undefined,
        notes: formData.notes || undefined,
      });

      if (response) {
        submissionSuccess.value = true;
        apiError.value = false;
        submissionId.value = response.id;

        capture('form_submitted', {
          form: 'registry_submission',
          year: formData.year,
          model: formData.model,
        });
      } else {
        throw new Error('No response from server');
      }
    } catch (error) {
      submissionSuccess.value = false;
      apiError.value = true;
      apiMessage.value = t('error.api_unavailable');
      console.error('Error submitting registry entry:', error);
    } finally {
      processing.value = false;
    }
  }

  function resetForm() {
    submissionSuccess.value = false;
    apiError.value = false;
    submissionId.value = '';
    apiMessage.value = '';
    formData.year = 1959;
    formData.model = '';
    formData.trim = '';
    formData.bodyType = 'Saloon';
    formData.engineSize = 850;
    formData.color = '';
    formData.bodyNum = '';
    formData.engineNum = '';
    formData.notes = '';
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = false;
    });
  }
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <!-- Breadcrumb -->
    <div class="mb-6">
      <breadcrumb
        :version="BREADCRUMB_VERSIONS.ARCHIVE"
        :page="t('breadcrumb_title')"
        subpage="Contribute"
        subpageHref="/contribute"
      />
    </div>

    <!-- Auth Gate -->
    <div v-if="!isAuthenticated" class="max-w-lg mx-auto">
      <UCard>
        <div class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-lock text-5xl text-muted"></i>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ t('sign_in_title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ t('sign_in_description') }}</p>
          <UButton to="/login" color="primary" class="w-full">
            {{ t('sign_in_button') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Authenticated Content -->
    <div v-else>
      <div class="grid grid-cols-12 gap-6">
        <!-- Heading -->
        <div class="col-span-12 md:col-span-8 md:col-start-3">
          <h1 class="text-3xl font-bold mb-2">{{ t('heading') }}</h1>
          <p class="text-base opacity-70 mb-6">{{ t('subtitle') }}</p>
          <USeparator class="mb-6" />
        </div>

        <!-- Form Card -->
        <div class="col-span-12 md:col-span-8 md:col-start-3">
          <UCard>
            <!-- Success State -->
            <div v-if="submissionSuccess" class="text-center py-5">
              <i class="text-4xl text-success fa-duotone fa-box-check fa-beat py-5"></i>
              <h1 class="text-2xl font-bold mb-1">{{ t('success.thank_you') }}</h1>
              <h2 class="text-lg mb-4">{{ t('success.submitted_message') }}</h2>
              <div class="space-y-4 max-w-md mx-auto">
                <UButton color="primary" @click="resetForm" class="w-full">
                  <i class="fa-duotone fa-solid fa-plus-large mr-2"></i>
                  {{ t('success.submit_another') }}
                </UButton>
                <UButton to="/submissions" color="neutral" variant="outline" class="w-full">
                  {{ t('success.view_submissions') }}
                </UButton>
              </div>
            </div>

            <!-- Form -->
            <div v-else>
              <form @submit.prevent="submit">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        v-model.number="formData.year"
                        :color="!formData.year && touchedFields.year ? 'error' : undefined"
                        :disabled="processing"
                        required
                        @blur="touchedFields.year = true"
                      />
                      <p v-if="!formData.year && touchedFields.year" class="text-sm text-error mt-1">
                        {{ t('validation.required') }}
                      </p>
                    </div>

                    <!-- Model -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium"
                          >{{ t('form_labels.model') }} <span class="text-error">*</span></span
                        >
                        <span class="text-sm text-muted"><i class="fad fa-car"></i></span>
                      </label>
                      <UInput
                        type="text"
                        :placeholder="t('placeholders.model')"
                        v-model="formData.model"
                        :color="formData.model === '' && touchedFields.model ? 'error' : undefined"
                        :disabled="processing"
                        required
                        @blur="touchedFields.model = true"
                      />
                      <p v-if="formData.model === '' && touchedFields.model" class="text-sm text-error mt-1">
                        {{ t('validation.required') }}
                      </p>
                    </div>

                    <!-- Trim -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium"
                          >{{ t('form_labels.trim') }} <span class="text-error">*</span></span
                        >
                        <span class="text-sm text-muted"><i class="fad fa-scissors"></i></span>
                      </label>
                      <UInput
                        type="text"
                        :placeholder="t('placeholders.trim')"
                        v-model="formData.trim"
                        :color="formData.trim === '' && touchedFields.trim ? 'error' : undefined"
                        :disabled="processing"
                        required
                        @blur="touchedFields.trim = true"
                      />
                      <p v-if="formData.trim === '' && touchedFields.trim" class="text-sm text-error mt-1">
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
                        v-model="formData.bodyType"
                        :items="bodyTypeOptions"
                        :color="formData.bodyType === '' && touchedFields.bodyType ? 'error' : undefined"
                        :disabled="processing"
                        required
                        @blur="touchedFields.bodyType = true"
                        @change="touchedFields.bodyType = true"
                      />
                      <p v-if="formData.bodyType === '' && touchedFields.bodyType" class="text-sm text-error mt-1">
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
                        v-model.number="formData.engineSize"
                        :items="engineSizeOptions"
                        :color="!formData.engineSize && touchedFields.engineSize ? 'error' : undefined"
                        :disabled="processing"
                        required
                        @blur="touchedFields.engineSize = true"
                        @change="touchedFields.engineSize = true"
                      />
                      <p v-if="!formData.engineSize && touchedFields.engineSize" class="text-sm text-error mt-1">
                        {{ t('validation.required') }}
                      </p>
                    </div>

                    <!-- Factory Color -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ t('form_labels.factory_color') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-palette"></i></span>
                      </label>
                      <UInput
                        type="text"
                        :placeholder="t('placeholders.color')"
                        v-model="formData.color"
                        :disabled="processing"
                      />
                    </div>

                    <!-- Body Shell Number -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ t('form_labels.body_shell_number') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
                      </label>
                      <UInput
                        type="text"
                        :placeholder="t('placeholders.body_number')"
                        v-model="formData.bodyNum"
                        :disabled="processing"
                      />
                    </div>

                    <!-- Engine Plate Number -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ t('form_labels.engine_plate_number') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
                      </label>
                      <UInput
                        type="text"
                        :placeholder="t('placeholders.engine_number')"
                        v-model="formData.engineNum"
                        :disabled="processing"
                      />
                    </div>
                  </div>

                  <!-- Special Notes (Full Width) -->
                  <div class="col-span-1 md:col-span-2">
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ t('form_labels.special_notes') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-note"></i></span>
                      </label>
                      <UTextarea
                        :placeholder="t('placeholders.notes')"
                        v-model="formData.notes"
                        :rows="4"
                        :disabled="processing"
                      />
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
                      {{ apiMessage || t('error.message') }}
                      <p class="mt-2">{{ t('error.check_entries') }}</p>
                    </template>
                    <template #actions>
                      <UButton size="sm" variant="outline" @click="apiError = false">
                        {{ t('error.dismiss') }}
                      </UButton>
                    </template>
                  </UAlert>

                  <UButton
                    type="submit"
                    color="primary"
                    size="lg"
                    class="w-full"
                    :disabled="!validateForm() || processing"
                    :loading="processing"
                  >
                    <i class="fad fa-paper-plane mr-2" v-if="!processing"></i>
                    {{ t('submit_button') }}
                  </UButton>
                </div>
              </form>
            </div>
          </UCard>
        </div>

        <!-- Patreon Card -->
        <div class="col-span-12 md:col-span-8 md:col-start-3 mt-6">
          <patreon-card size="large" />
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "seo": {
      "title": "Contribute to Registry - Classic Mini DIY",
      "description": "Submit your Classic Mini to the community registry database.",
      "og_title": "Contribute to Registry - Classic Mini DIY",
      "og_description": "Submit your Classic Mini to the community registry database."
    },
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Registry",
    "sign_in_title": "Sign In to Contribute",
    "sign_in_description": "You need to be signed in to submit your Mini to the registry. Create a free account to get started.",
    "sign_in_button": "Sign In to Continue",
    "heading": "Submit to the Registry",
    "subtitle": "Add your Classic Mini to our community-driven registry. Your submission will be reviewed before being published.",
    "success": {
      "thank_you": "Thank you!",
      "submitted_message": "Your submission has been received. Please allow 1-2 days for review.",
      "submit_another": "Submit Another Mini",
      "view_submissions": "View My Submissions"
    },
    "validation": {
      "required": "This field is required to submit"
    },
    "form_labels": {
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
      "model": "ex. Morris Mini Cooper",
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
  "es": {
    "seo": {
      "title": "Contribuir al Registro - Classic Mini DIY",
      "description": "Envie su Classic Mini a la base de datos del registro de la comunidad.",
      "og_title": "Contribuir al Registro - Classic Mini DIY",
      "og_description": "Envie su Classic Mini a la base de datos del registro de la comunidad."
    },
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Registro",
    "sign_in_title": "Inicia Sesion para Contribuir",
    "sign_in_description": "Debes iniciar sesion para enviar tu Mini al registro. Crea una cuenta gratuita para empezar.",
    "sign_in_button": "Iniciar Sesion para Continuar",
    "heading": "Enviar al Registro",
    "subtitle": "Agrega tu Classic Mini a nuestro registro impulsado por la comunidad. Tu envio sera revisado antes de ser publicado.",
    "success": {
      "thank_you": "¡Gracias!",
      "submitted_message": "Tu envio ha sido recibido. Por favor permite 1-2 dias para la revision.",
      "submit_another": "Enviar Otro Mini",
      "view_submissions": "Ver Mis Envios"
    },
    "validation": {
      "required": "Este campo es requerido para enviar"
    },
    "form_labels": {
      "model_year": "Ano del Modelo",
      "model": "Modelo",
      "trim": "Acabado",
      "body_type": "Tipo de Carroceria",
      "original_engine_size": "Tamano Original del Motor",
      "factory_color": "Color de Fabrica",
      "body_shell_number": "Numero del Chasis",
      "engine_plate_number": "Numero de la Placa del Motor",
      "special_notes": "Notas Especiales o Adicionales"
    },
    "placeholders": {
      "model": "ej. Morris Mini Cooper",
      "trim": "ej. Mini 50",
      "color": "ej. Azul Clipper",
      "body_number": "ej. GB190fW",
      "engine_number": "ej. 12H4102",
      "notes": "ej. Este coche solo se produjo de 1959 a 1960"
    },
    "body_types": {
      "saloon": "Sedan",
      "pickup": "Pickup",
      "estate": "Familiar",
      "cabriolet": "Cabriolet",
      "clubman": "Clubman",
      "van": "Furgoneta",
      "hornet": "Hornet"
    },
    "error": {
      "title": "¡Lo Siento!",
      "message": "Hubo un problema enviando tu envio en este momento, ¡por favor intentalo de nuevo mas tarde!",
      "check_entries": "Por favor verifica tus entradas e intentalo de nuevo",
      "dismiss": "Descartar",
      "api_unavailable": "La API no esta disponible actualmente. Por favor intentalo de nuevo mas tarde."
    },
    "submit_button": "Enviar"
  },
  "fr": {
    "seo": {
      "title": "Contribuer au Registre - Classic Mini DIY",
      "description": "Soumettez votre Classic Mini a la base de donnees du registre communautaire.",
      "og_title": "Contribuer au Registre - Classic Mini DIY",
      "og_description": "Soumettez votre Classic Mini a la base de donnees du registre communautaire."
    },
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Registre",
    "sign_in_title": "Connectez-vous pour Contribuer",
    "sign_in_description": "Vous devez etre connecte pour soumettre votre Mini au registre. Creez un compte gratuit pour commencer.",
    "sign_in_button": "Se Connecter pour Continuer",
    "heading": "Soumettre au Registre",
    "subtitle": "Ajoutez votre Classic Mini a notre registre communautaire. Votre soumission sera examinee avant publication.",
    "success": {
      "thank_you": "Merci !",
      "submitted_message": "Votre soumission a ete recue. Veuillez compter 1-2 jours pour la revision.",
      "submit_another": "Soumettre une autre Mini",
      "view_submissions": "Voir mes soumissions"
    },
    "validation": {
      "required": "Ce champ est requis pour soumettre"
    },
    "form_labels": {
      "model_year": "Annee du modele",
      "model": "Modele",
      "trim": "Finition",
      "body_type": "Type de carrosserie",
      "original_engine_size": "Taille de moteur d'origine",
      "factory_color": "Couleur d'usine",
      "body_shell_number": "Numero de coque de carrosserie",
      "engine_plate_number": "Numero de plaque moteur",
      "special_notes": "Notes speciales ou supplementaires"
    },
    "placeholders": {
      "model": "ex. Morris Mini Cooper",
      "trim": "ex. Mini 50",
      "color": "ex. Bleu Clipper",
      "body_number": "ex. GB190fW",
      "engine_number": "ex. 12H4102",
      "notes": "ex. Cette voiture n'a ete produite que de 1959 a 1960"
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
      "title": "Je suis desole !",
      "message": "Il y a eu un probleme lors de la soumission pour le moment, veuillez reessayer plus tard !",
      "check_entries": "Veuillez verifier vos entrees et reessayer",
      "dismiss": "Annuler",
      "api_unavailable": "L'API est actuellement indisponible. Veuillez reessayer plus tard."
    },
    "submit_button": "Soumettre"
  },
  "it": {
    "seo": {
      "title": "Contribuisci al Registro - Classic Mini DIY",
      "description": "Invia la tua Classic Mini al database del registro della comunita.",
      "og_title": "Contribuisci al Registro - Classic Mini DIY",
      "og_description": "Invia la tua Classic Mini al database del registro della comunita."
    },
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Registro",
    "sign_in_title": "Accedi per Contribuire",
    "sign_in_description": "Devi essere connesso per inviare la tua Mini al registro. Crea un account gratuito per iniziare.",
    "sign_in_button": "Accedi per Continuare",
    "heading": "Invia al Registro",
    "subtitle": "Aggiungi la tua Classic Mini al nostro registro guidato dalla comunita. La tua iscrizione sara esaminata prima della pubblicazione.",
    "success": {
      "thank_you": "Grazie!",
      "submitted_message": "La tua iscrizione e stata ricevuta. Permettici 1-2 giorni per la revisione.",
      "submit_another": "Invia un'altra Mini",
      "view_submissions": "Visualizza le mie proposte"
    },
    "validation": {
      "required": "Questo campo e obbligatorio per l'invio"
    },
    "form_labels": {
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
      "model": "es. Morris Mini Cooper",
      "trim": "es. Mini 50",
      "color": "es. Clipper Blue",
      "body_number": "es. GB190fW",
      "engine_number": "es. 12H4102",
      "notes": "es. Quest'auto e stata prodotta solo dal 1959 al 1960"
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
      "message": "C'e stato un problema nell'inviare la tua iscrizione in questo momento, riprova piu tardi!",
      "check_entries": "Controlla le tue voci e riprova",
      "dismiss": "Chiudi",
      "api_unavailable": "API attualmente non disponibile. Riprova piu tardi."
    },
    "submit_button": "Invia"
  },
  "de": {
    "seo": {
      "title": "Zum Register Beitragen - Classic Mini DIY",
      "description": "Reichen Sie Ihren Classic Mini in der Community-Register-Datenbank ein.",
      "og_title": "Zum Register Beitragen - Classic Mini DIY",
      "og_description": "Reichen Sie Ihren Classic Mini in der Community-Register-Datenbank ein."
    },
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Register",
    "sign_in_title": "Anmelden zum Beitragen",
    "sign_in_description": "Sie muessen angemeldet sein, um Ihren Mini im Register einzureichen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
    "sign_in_button": "Anmelden und Fortfahren",
    "heading": "Zum Register Einreichen",
    "subtitle": "Fuegen Sie Ihren Classic Mini zu unserem gemeinschaftsgetriebenen Register hinzu. Ihre Einreichung wird vor der Veroeffentlichung ueberprueft.",
    "success": {
      "thank_you": "Vielen Dank!",
      "submitted_message": "Ihre Einreichung wurde empfangen. Bitte rechnen Sie mit 1-2 Tagen fuer die Ueberpruefung.",
      "submit_another": "Einen weiteren Mini einreichen",
      "view_submissions": "Meine Einreichungen anzeigen"
    },
    "validation": {
      "required": "Dieses Feld ist zum Absenden erforderlich"
    },
    "form_labels": {
      "model_year": "Modelljahr",
      "model": "Modell",
      "trim": "Ausstattung",
      "body_type": "Karosserietyp",
      "original_engine_size": "Original-Motorgroesse",
      "factory_color": "Werksfarbe",
      "body_shell_number": "Karosserienummer",
      "engine_plate_number": "Motorplattennummer",
      "special_notes": "Besondere oder zusaetzliche Notizen"
    },
    "placeholders": {
      "model": "z.B. Morris Mini Cooper",
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
      "message": "Es gab ein Problem beim Einreichen Ihrer Einreichung, bitte versuchen Sie es spaeter erneut!",
      "check_entries": "Bitte ueberpruefen Sie Ihre Eingaben und versuchen Sie es erneut",
      "dismiss": "Schliessen",
      "api_unavailable": "API ist derzeit nicht verfuegbar. Bitte versuchen Sie es spaeter erneut."
    },
    "submit_button": "Absenden"
  },
  "pt": {
    "seo": {
      "title": "Contribuir para o Registro - Classic Mini DIY",
      "description": "Envie seu Classic Mini para o banco de dados do registro da comunidade.",
      "og_title": "Contribuir para o Registro - Classic Mini DIY",
      "og_description": "Envie seu Classic Mini para o banco de dados do registro da comunidade."
    },
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Registro",
    "sign_in_title": "Entre para Contribuir",
    "sign_in_description": "Voce precisa estar conectado para enviar seu Mini ao registro. Crie uma conta gratuita para comecar.",
    "sign_in_button": "Entrar para Continuar",
    "heading": "Enviar para o Registro",
    "subtitle": "Adicione seu Classic Mini ao nosso registro orientado pela comunidade. Seu envio sera revisado antes de ser publicado.",
    "success": {
      "thank_you": "Obrigado!",
      "submitted_message": "Seu envio foi recebido. Por favor, aguarde 1-2 dias para revisao.",
      "submit_another": "Enviar Outro Mini",
      "view_submissions": "Ver Meus Envios"
    },
    "validation": {
      "required": "Este campo e obrigatorio para enviar"
    },
    "form_labels": {
      "model_year": "Ano do Modelo",
      "model": "Modelo",
      "trim": "Versao",
      "body_type": "Tipo de Carroceria",
      "original_engine_size": "Tamanho Original do Motor",
      "factory_color": "Cor de Fabrica",
      "body_shell_number": "Numero da Carroceria",
      "engine_plate_number": "Numero da Placa do Motor",
      "special_notes": "Observacoes Especiais ou Adicionais"
    },
    "placeholders": {
      "model": "ex. Morris Mini Cooper",
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
      "cabriolet": "Conversivel",
      "clubman": "Clubman",
      "van": "Van",
      "hornet": "Hornet"
    },
    "error": {
      "title": "Desculpe!",
      "message": "Houve um problema ao enviar sua submissao no momento, tente novamente mais tarde!",
      "check_entries": "Verifique suas entradas e tente novamente",
      "dismiss": "Dispensar",
      "api_unavailable": "API esta indisponivel no momento. Tente novamente mais tarde."
    },
    "submit_button": "Enviar"
  },
  "ru": {
    "seo": {
      "title": "Вклад в реестр - Classic Mini DIY",
      "description": "Отправьте свой Classic Mini в базу данных общественного реестра.",
      "og_title": "Вклад в реестр - Classic Mini DIY",
      "og_description": "Отправьте свой Classic Mini в базу данных общественного реестра."
    },
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Реестр",
    "sign_in_title": "Войдите, чтобы внести вклад",
    "sign_in_description": "Вам нужно войти в систему, чтобы отправить свой Mini в реестр. Создайте бесплатную учетную запись, чтобы начать.",
    "sign_in_button": "Войти для продолжения",
    "heading": "Отправить в реестр",
    "subtitle": "Добавьте свой Classic Mini в наш общественный реестр. Ваша заявка будет рассмотрена перед публикацией.",
    "success": {
      "thank_you": "Спасибо!",
      "submitted_message": "Ваша заявка была получена. Пожалуйста, подождите 1-2 дня для рассмотрения.",
      "submit_another": "Отправить другой Мини",
      "view_submissions": "Посмотреть мои заявки"
    },
    "validation": {
      "required": "Это поле обязательно для заполнения"
    },
    "form_labels": {
      "model_year": "Год модели",
      "model": "Модель",
      "trim": "Комплектация",
      "body_type": "Тип кузова",
      "original_engine_size": "Оригинальный объем двигателя",
      "factory_color": "Заводской цвет",
      "body_shell_number": "Номер кузова",
      "engine_plate_number": "Номер таблички двигателя",
      "special_notes": "Особые или дополнительные примечания"
    },
    "placeholders": {
      "model": "например, Morris Mini Cooper",
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
  "ja": {
    "seo": {
      "title": "レジストリに貢献 - Classic Mini DIY",
      "description": "あなたのクラシックミニをコミュニティレジストリデータベースに登録してください。",
      "og_title": "レジストリに貢献 - Classic Mini DIY",
      "og_description": "あなたのクラシックミニをコミュニティレジストリデータベースに登録してください。"
    },
    "hero_title": "クラシックミニアーカイブ",
    "breadcrumb_title": "レジストリ",
    "sign_in_title": "貢献するにはサインインしてください",
    "sign_in_description": "レジストリにミニを登録するにはサインインが必要です。無料アカウントを作成して始めましょう。",
    "sign_in_button": "サインインして続行",
    "heading": "レジストリに登録",
    "subtitle": "あなたのクラシックミニをコミュニティ主導のレジストリに追加してください。登録は公開前に審査されます。",
    "success": {
      "thank_you": "ありがとうございます！",
      "submitted_message": "登録が受け付けられました。審査に1～2日お待ちください。",
      "submit_another": "別のMiniを登録",
      "view_submissions": "自分の登録を見る"
    },
    "validation": {
      "required": "このフィールドは送信に必要です"
    },
    "form_labels": {
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
      "model": "例: Morris Mini Cooper",
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
  "zh": {
    "seo": {
      "title": "贡献到注册 - Classic Mini DIY",
      "description": "将您的经典迷你提交到社区注册数据库。",
      "og_title": "贡献到注册 - Classic Mini DIY",
      "og_description": "将您的经典迷你提交到社区注册数据库。"
    },
    "hero_title": "经典迷你档案馆",
    "breadcrumb_title": "注册",
    "sign_in_title": "登录以贡献",
    "sign_in_description": "您需要登录才能将您的迷你提交到注册表。创建免费帐户以开始。",
    "sign_in_button": "登录以继续",
    "heading": "提交到注册表",
    "subtitle": "将您的经典迷你添加到我们的社区驱动注册表。您的提交将在发布前进行审核。",
    "success": {
      "thank_you": "谢谢！",
      "submitted_message": "您的提交已收到。请等待1-2天进行审核。",
      "submit_another": "提交另一辆Mini",
      "view_submissions": "查看我的提交"
    },
    "validation": {
      "required": "此字段为必填项"
    },
    "form_labels": {
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
      "model": "例：Morris Mini Cooper",
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
  },
  "ko": {
    "seo": {
      "title": "레지스트리에 기여 - Classic Mini DIY",
      "description": "커뮤니티 레지스트리 데이터베이스에 클래식 미니를 등록하세요.",
      "og_title": "레지스트리에 기여 - Classic Mini DIY",
      "og_description": "커뮤니티 레지스트리 데이터베이스에 클래식 미니를 등록하세요."
    },
    "hero_title": "클래식 미니 아카이브",
    "breadcrumb_title": "레지스트리",
    "sign_in_title": "기여하려면 로그인하세요",
    "sign_in_description": "레지스트리에 미니를 등록하려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
    "sign_in_button": "로그인하여 계속",
    "heading": "레지스트리에 등록",
    "subtitle": "커뮤니티 주도 레지스트리에 클래식 미니를 추가하세요. 등록은 게시 전에 검토됩니다.",
    "success": {
      "thank_you": "감사합니다!",
      "submitted_message": "귀하의 제출이 접수되었습니다. 검토를 위해 1-2일 소요됩니다.",
      "submit_another": "다른 미니 제출하기",
      "view_submissions": "내 제출 보기"
    },
    "validation": {
      "required": "이 필드는 제출하기 위해 필수입니다"
    },
    "form_labels": {
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
      "model": "예) Morris Mini Cooper",
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
  }
}
</i18n>
