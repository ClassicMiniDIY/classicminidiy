<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { submitNewItem } = useSubmissions();
  const { capture } = usePostHog();

  useHead({
    title: t('page_title'),
    meta: [
      {
        name: 'description',
        content: t('description'),
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
    ogUrl: 'https://classicminidiy.com/contribute/wheel',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/wheels.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/wheels.png',
  });

  // Form state
  const name = ref('');
  const type = ref('');
  const size = ref('');
  const width = ref('');
  const offset = ref('');
  const manufacturer = ref('');
  const boltPattern = ref('');
  const centerBore = ref('');
  const weight = ref('');
  const notes = ref('');
  const photoFiles = ref<File[]>([]);

  // UI state
  const processing = ref(false);
  const submitted = ref(false);
  const submissionId = ref<string | null>(null);
  const apiError = ref(false);
  const photoError = ref('');

  // Touched field tracking
  interface TouchedFields {
    name: boolean;
    size: boolean;
    width: boolean;
    [key: string]: boolean;
  }

  const touchedFields = ref<TouchedFields>({
    name: false,
    size: false,
    width: false,
  });

  // Size options for USelect
  const sizeOptions = [
    { label: '10"', value: '10' },
    { label: '12"', value: '12' },
    { label: '13"', value: '13' },
  ];

  function validateForm(): boolean {
    return name.value.trim() !== '' && size.value !== '' && width.value.trim() !== '' && photoFiles.value.length >= 1;
  }

  async function submit() {
    // Mark all required fields as touched
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = true;
    });

    // Check photo requirement separately
    if (photoFiles.value.length === 0) {
      photoError.value = t('validation.photos_required');
    } else {
      photoError.value = '';
    }

    if (!validateForm()) {
      return;
    }

    processing.value = true;
    apiError.value = false;

    try {
      // 1. Create the submission
      const submission = await submitNewItem('wheel', {
        name: name.value.trim(),
        type: type.value.trim() || undefined,
        size: size.value,
        width: width.value.trim(),
        offset: offset.value.trim() || undefined,
        manufacturer: manufacturer.value.trim() || undefined,
        boltPattern: boltPattern.value.trim() || undefined,
        centerBore: centerBore.value.trim() || undefined,
        weight: weight.value.trim() || undefined,
        notes: notes.value.trim() || undefined,
      });

      // 2. Upload photos
      const formData = new FormData();
      photoFiles.value.forEach((file, i) => formData.append(`file${i}`, file));
      await useFetch('/api/archive/upload', {
        method: 'POST',
        body: formData,
        query: { bucket: 'archive-wheels', submissionId: submission.id },
      });

      // 3. Track with PostHog
      capture('form_submitted', {
        form: 'wheel_submission',
        wheel_name: name.value.trim(),
        wheel_size: size.value,
        photo_count: photoFiles.value.length,
      });

      // 4. Show success
      submissionId.value = submission.id;
      submitted.value = true;
    } catch (error) {
      console.error(error);
      apiError.value = true;
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
    name.value = '';
    type.value = '';
    size.value = '';
    width.value = '';
    offset.value = '';
    manufacturer.value = '';
    boltPattern.value = '';
    centerBore.value = '';
    weight.value = '';
    notes.value = '';
    photoFiles.value = [];
    photoError.value = '';
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = false;
    });
  }

  function submitAnother() {
    submitted.value = false;
    apiError.value = false;
    submissionId.value = null;
    resetForm();
  }
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
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
            <i class="fas fa-lock text-5xl opacity-40"></i>
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
            <div v-if="!processing && submitted && submissionId && !apiError">
              <div class="text-center py-5">
                <i class="text-4xl text-success fa-duotone fa-box-check fa-beat py-5"></i>
                <h1 class="text-2xl font-bold mb-1">{{ t('success.thank_you') }}</h1>
                <h2 class="text-lg mb-4">{{ t('success.submitted_message') }}</h2>
                <ul class="mb-5">
                  <li class="mb-2">
                    {{ t('success.submission_id') }}
                    <strong>{{ submissionId }}</strong>
                  </li>
                </ul>
                <div class="flex flex-col sm:flex-row gap-3 justify-center">
                  <UButton color="primary" @click="submitAnother()">
                    <i class="fa-duotone fa-solid fa-plus-large mr-2"></i>
                    {{ t('success.submit_another') }}
                  </UButton>
                  <UButton to="/dashboard" variant="outline">
                    <i class="fad fa-list mr-2"></i>
                    {{ t('success.view_submissions') }}
                  </UButton>
                </div>
              </div>
            </div>

            <!-- Form -->
            <div v-if="!submitted">
              <form @submit.prevent="submit">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                  <!-- Wheel Name -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.name') }} <span class="text-error">*</span></span>
                      <span class="text-sm text-muted"><i class="fad fa-tire"></i></span>
                    </label>
                    <UInput
                      type="text"
                      :placeholder="t('placeholders.name')"
                      v-model="name"
                      class="w-full"
                      :color="name.trim() === '' && touchedFields.name ? 'error' : undefined"
                      @blur="touchedFields.name = true"
                    />
                    <p v-if="name.trim() === '' && touchedFields.name" class="text-sm text-error mt-1">
                      {{ t('validation.required') }}
                    </p>
                  </div>

                  <!-- Type -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.type') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-shapes"></i></span>
                    </label>
                    <UInput type="text" :placeholder="t('placeholders.type')" v-model="type" class="w-full" />
                  </div>

                  <!-- Size -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.size') }} <span class="text-error">*</span></span>
                      <span class="text-sm text-muted"><i class="fad fa-ruler"></i></span>
                    </label>
                    <USelect
                      v-model="size"
                      :items="sizeOptions"
                      :placeholder="t('placeholders.size')"
                      class="w-full"
                      :color="size === '' && touchedFields.size ? 'error' : undefined"
                      @blur="touchedFields.size = true"
                      @change="touchedFields.size = true"
                    />
                    <p v-if="size === '' && touchedFields.size" class="text-sm text-error mt-1">
                      {{ t('validation.required') }}
                    </p>
                  </div>

                  <!-- Width -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.width') }} <span class="text-error">*</span></span>
                      <span class="text-sm text-muted"><i class="fad fa-arrows-left-right"></i></span>
                    </label>
                    <UInput
                      type="text"
                      :placeholder="t('placeholders.width')"
                      v-model="width"
                      class="w-full"
                      :color="width.trim() === '' && touchedFields.width ? 'error' : undefined"
                      @blur="touchedFields.width = true"
                    />
                    <p v-if="width.trim() === '' && touchedFields.width" class="text-sm text-error mt-1">
                      {{ t('validation.required') }}
                    </p>
                  </div>

                  <!-- Offset -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.offset') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-arrows-up-down"></i></span>
                    </label>
                    <UInput type="text" :placeholder="t('placeholders.offset')" v-model="offset" class="w-full" />
                  </div>

                  <!-- Manufacturer -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.manufacturer') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-industry"></i></span>
                    </label>
                    <UInput
                      type="text"
                      :placeholder="t('placeholders.manufacturer')"
                      v-model="manufacturer"
                      class="w-full"
                    />
                  </div>

                  <!-- Bolt Pattern -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.bolt_pattern') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-circle-bolt"></i></span>
                    </label>
                    <UInput
                      type="text"
                      :placeholder="t('placeholders.bolt_pattern')"
                      v-model="boltPattern"
                      class="w-full"
                    />
                  </div>

                  <!-- Center Bore -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.center_bore') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-bullseye"></i></span>
                    </label>
                    <UInput
                      type="text"
                      :placeholder="t('placeholders.center_bore')"
                      v-model="centerBore"
                      class="w-full"
                    />
                  </div>

                  <!-- Weight -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.weight') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-weight-hanging"></i></span>
                    </label>
                    <UInput type="text" :placeholder="t('placeholders.weight')" v-model="weight" class="w-full" />
                  </div>

                  <!-- Notes (full width) -->
                  <div class="col-span-1 md:col-span-2">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.notes') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-note"></i></span>
                    </label>
                    <UTextarea :placeholder="t('placeholders.notes')" v-model="notes" :rows="4" class="w-full" />
                  </div>

                  <!-- Photos (full width) -->
                  <div class="col-span-1 md:col-span-2">
                    <ContributeFileUpload
                      accept="image/jpeg,image/png"
                      :maxFiles="5"
                      :maxSizeMb="3"
                      :required="true"
                      :label="t('form.photos')"
                      @update:files="photoFiles = $event"
                    />
                    <p v-if="photoError" class="text-sm text-error mt-1">
                      <i class="fas fa-exclamation-circle mr-1"></i>
                      {{ photoError }}
                    </p>
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
                    :disabled="processing"
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
    "page_title": "Submit Wheel - Classic Mini DIY",
    "description": "Submit a wheel to the Classic Mini wheels database",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Submit Wheel",
    "sign_in_title": "Sign In to Contribute",
    "sign_in_description": "You need to be signed in to submit wheels to the archive. Create a free account to get started.",
    "sign_in_button": "Sign In to Continue",
    "heading": "Submit a Wheel",
    "subtitle": "Add a wheel to our community-driven archive. Your submission will be reviewed before being published.",
    "seo": {
      "og_title": "Submit Wheel - Classic Mini DIY",
      "og_description": "Submit a wheel to the Classic Mini wheels database",
      "twitter_title": "Submit Wheel - Classic Mini DIY",
      "twitter_description": "Submit a wheel to the Classic Mini wheels database"
    },
    "form": {
      "name": "Wheel Name",
      "type": "Type",
      "size": "Size",
      "width": "Width",
      "offset": "Offset",
      "manufacturer": "Manufacturer",
      "bolt_pattern": "Bolt Pattern",
      "center_bore": "Center Bore",
      "weight": "Weight",
      "notes": "Notes",
      "photos": "Wheel Photos"
    },
    "placeholders": {
      "name": "e.g. Minilite",
      "type": "e.g. Alloy, Steel",
      "size": "Select a size",
      "width": "e.g. 5.5J",
      "offset": "e.g. +20",
      "manufacturer": "e.g. Minilite Engineering",
      "bolt_pattern": "e.g. 4x101.6",
      "center_bore": "e.g. 76.2mm",
      "weight": "e.g. 4.5kg",
      "notes": "Any additional details about this wheel..."
    },
    "validation": {
      "required": "This field is required",
      "photos_required": "At least one photo is required"
    },
    "success": {
      "thank_you": "Thank you!",
      "submitted_message": "Your wheel has been submitted. Please allow 1-2 days for it to be reviewed and published.",
      "submission_id": "Your submission ID is",
      "submit_another": "Submit Another Wheel",
      "view_submissions": "View My Submissions"
    },
    "error": {
      "title": "Something went wrong",
      "message": "There was a problem submitting your wheel at this time. Please try again later.",
      "check_entries": "Please check your entries and try again.",
      "dismiss": "Dismiss"
    },
    "submit_button": "Submit Wheel"
  },
  "es": {
    "page_title": "Enviar Rueda - Classic Mini DIY",
    "description": "Envia una rueda a la base de datos de ruedas Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Enviar Rueda",
    "sign_in_title": "Inicia Sesion para Contribuir",
    "sign_in_description": "Debes iniciar sesion para enviar ruedas al archivo. Crea una cuenta gratuita para empezar.",
    "sign_in_button": "Iniciar Sesion para Continuar",
    "heading": "Enviar una Rueda",
    "subtitle": "Agrega una rueda a nuestro archivo comunitario. Tu envio sera revisado antes de ser publicado.",
    "seo": {
      "og_title": "Enviar Rueda - Classic Mini DIY",
      "og_description": "Envia una rueda a la base de datos de ruedas Classic Mini",
      "twitter_title": "Enviar Rueda - Classic Mini DIY",
      "twitter_description": "Envia una rueda a la base de datos de ruedas Classic Mini"
    },
    "form": {
      "name": "Nombre de la Rueda",
      "type": "Tipo",
      "size": "Tamano",
      "width": "Ancho",
      "offset": "Desplazamiento",
      "manufacturer": "Fabricante",
      "bolt_pattern": "Patron de Pernos",
      "center_bore": "Agujero Central",
      "weight": "Peso",
      "notes": "Notas",
      "photos": "Fotos de la Rueda"
    },
    "placeholders": {
      "name": "ej. Minilite",
      "type": "ej. Aleacion, Acero",
      "size": "Selecciona un tamano",
      "width": "ej. 5.5J",
      "offset": "ej. +20",
      "manufacturer": "ej. Minilite Engineering",
      "bolt_pattern": "ej. 4x101.6",
      "center_bore": "ej. 76.2mm",
      "weight": "ej. 4.5kg",
      "notes": "Detalles adicionales sobre esta rueda..."
    },
    "validation": {
      "required": "Este campo es obligatorio",
      "photos_required": "Se requiere al menos una foto"
    },
    "success": {
      "thank_you": "Gracias!",
      "submitted_message": "Tu rueda ha sido enviada. Por favor espera 1-2 dias para que sea revisada y publicada.",
      "submission_id": "Tu ID de envio es",
      "submit_another": "Enviar Otra Rueda",
      "view_submissions": "Ver Mis Envios"
    },
    "error": {
      "title": "Algo salio mal",
      "message": "Hubo un problema al enviar tu rueda en este momento. Por favor intentalo de nuevo mas tarde.",
      "check_entries": "Por favor verifica tus datos e intentalo de nuevo.",
      "dismiss": "Descartar"
    },
    "submit_button": "Enviar Rueda"
  },
  "fr": {
    "page_title": "Soumettre une Roue - Classic Mini DIY",
    "description": "Soumettez une roue a la base de donnees de roues Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Soumettre une Roue",
    "sign_in_title": "Connectez-vous pour Contribuer",
    "sign_in_description": "Vous devez etre connecte pour soumettre des roues aux archives. Creez un compte gratuit pour commencer.",
    "sign_in_button": "Se Connecter pour Continuer",
    "heading": "Soumettre une Roue",
    "subtitle": "Ajoutez une roue a nos archives communautaires. Votre soumission sera examinee avant publication.",
    "seo": {
      "og_title": "Soumettre une Roue - Classic Mini DIY",
      "og_description": "Soumettez une roue a la base de donnees de roues Classic Mini",
      "twitter_title": "Soumettre une Roue - Classic Mini DIY",
      "twitter_description": "Soumettez une roue a la base de donnees de roues Classic Mini"
    },
    "form": {
      "name": "Nom de la Roue",
      "type": "Type",
      "size": "Taille",
      "width": "Largeur",
      "offset": "Deport",
      "manufacturer": "Fabricant",
      "bolt_pattern": "Entraxe",
      "center_bore": "Alesage Central",
      "weight": "Poids",
      "notes": "Notes",
      "photos": "Photos de la Roue"
    },
    "placeholders": {
      "name": "ex. Minilite",
      "type": "ex. Alliage, Acier",
      "size": "Selectionnez une taille",
      "width": "ex. 5.5J",
      "offset": "ex. +20",
      "manufacturer": "ex. Minilite Engineering",
      "bolt_pattern": "ex. 4x101.6",
      "center_bore": "ex. 76.2mm",
      "weight": "ex. 4.5kg",
      "notes": "Details supplementaires sur cette roue..."
    },
    "validation": {
      "required": "Ce champ est obligatoire",
      "photos_required": "Au moins une photo est requise"
    },
    "success": {
      "thank_you": "Merci !",
      "submitted_message": "Votre roue a ete soumise. Veuillez compter 1-2 jours pour qu'elle soit examinee et publiee.",
      "submission_id": "Votre ID de soumission est",
      "submit_another": "Soumettre une Autre Roue",
      "view_submissions": "Voir Mes Soumissions"
    },
    "error": {
      "title": "Une erreur est survenue",
      "message": "Un probleme est survenu lors de la soumission de votre roue. Veuillez reessayer plus tard.",
      "check_entries": "Veuillez verifier vos donnees et reessayer.",
      "dismiss": "Fermer"
    },
    "submit_button": "Soumettre la Roue"
  },
  "it": {
    "page_title": "Invia Ruota - Classic Mini DIY",
    "description": "Invia una ruota al database delle ruote Classic Mini",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Invia Ruota",
    "sign_in_title": "Accedi per Contribuire",
    "sign_in_description": "Devi essere connesso per inviare ruote all'archivio. Crea un account gratuito per iniziare.",
    "sign_in_button": "Accedi per Continuare",
    "heading": "Invia una Ruota",
    "subtitle": "Aggiungi una ruota al nostro archivio comunitario. La tua sottomissione sara esaminata prima della pubblicazione.",
    "seo": {
      "og_title": "Invia Ruota - Classic Mini DIY",
      "og_description": "Invia una ruota al database delle ruote Classic Mini",
      "twitter_title": "Invia Ruota - Classic Mini DIY",
      "twitter_description": "Invia una ruota al database delle ruote Classic Mini"
    },
    "form": {
      "name": "Nome della Ruota",
      "type": "Tipo",
      "size": "Misura",
      "width": "Larghezza",
      "offset": "Offset",
      "manufacturer": "Produttore",
      "bolt_pattern": "Schema Bulloni",
      "center_bore": "Foro Centrale",
      "weight": "Peso",
      "notes": "Note",
      "photos": "Foto della Ruota"
    },
    "placeholders": {
      "name": "es. Minilite",
      "type": "es. Lega, Acciaio",
      "size": "Seleziona una misura",
      "width": "es. 5.5J",
      "offset": "es. +20",
      "manufacturer": "es. Minilite Engineering",
      "bolt_pattern": "es. 4x101.6",
      "center_bore": "es. 76.2mm",
      "weight": "es. 4.5kg",
      "notes": "Dettagli aggiuntivi su questa ruota..."
    },
    "validation": {
      "required": "Questo campo e obbligatorio",
      "photos_required": "E richiesta almeno una foto"
    },
    "success": {
      "thank_you": "Grazie!",
      "submitted_message": "La tua ruota e stata inviata. Attendi 1-2 giorni per la revisione e la pubblicazione.",
      "submission_id": "Il tuo ID di sottomissione e",
      "submit_another": "Invia un'Altra Ruota",
      "view_submissions": "Vedi le Mie Sottomissioni"
    },
    "error": {
      "title": "Qualcosa e andato storto",
      "message": "Si e verificato un problema durante l'invio della ruota. Riprova piu tardi.",
      "check_entries": "Controlla i tuoi dati e riprova.",
      "dismiss": "Chiudi"
    },
    "submit_button": "Invia Ruota"
  },
  "de": {
    "page_title": "Rad Einreichen - Classic Mini DIY",
    "description": "Reichen Sie ein Rad in der Classic Mini Raddatenbank ein",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Rad Einreichen",
    "sign_in_title": "Anmelden zum Beitragen",
    "sign_in_description": "Sie muessen angemeldet sein, um Raeder ins Archiv einzureichen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
    "sign_in_button": "Anmelden und Fortfahren",
    "heading": "Rad Einreichen",
    "subtitle": "Fuegen Sie ein Rad zu unserem gemeinschaftsgetriebenen Archiv hinzu. Ihre Einreichung wird vor der Veroeffentlichung ueberprueft.",
    "seo": {
      "og_title": "Rad Einreichen - Classic Mini DIY",
      "og_description": "Reichen Sie ein Rad in der Classic Mini Raddatenbank ein",
      "twitter_title": "Rad Einreichen - Classic Mini DIY",
      "twitter_description": "Reichen Sie ein Rad in der Classic Mini Raddatenbank ein"
    },
    "form": {
      "name": "Radname",
      "type": "Typ",
      "size": "Groesse",
      "width": "Breite",
      "offset": "Einpresstiefe",
      "manufacturer": "Hersteller",
      "bolt_pattern": "Lochkreis",
      "center_bore": "Zentrierbohrung",
      "weight": "Gewicht",
      "notes": "Notizen",
      "photos": "Radfotos"
    },
    "placeholders": {
      "name": "z.B. Minilite",
      "type": "z.B. Leichtmetall, Stahl",
      "size": "Groesse waehlen",
      "width": "z.B. 5.5J",
      "offset": "z.B. +20",
      "manufacturer": "z.B. Minilite Engineering",
      "bolt_pattern": "z.B. 4x101.6",
      "center_bore": "z.B. 76.2mm",
      "weight": "z.B. 4.5kg",
      "notes": "Weitere Details zu diesem Rad..."
    },
    "validation": {
      "required": "Dieses Feld ist erforderlich",
      "photos_required": "Mindestens ein Foto ist erforderlich"
    },
    "success": {
      "thank_you": "Vielen Dank!",
      "submitted_message": "Ihr Rad wurde eingereicht. Bitte rechnen Sie mit 1-2 Tagen fuer die Ueberpruefung und Veroeffentlichung.",
      "submission_id": "Ihre Einreichungs-ID ist",
      "submit_another": "Weiteres Rad Einreichen",
      "view_submissions": "Meine Einreichungen Anzeigen"
    },
    "error": {
      "title": "Etwas ist schiefgelaufen",
      "message": "Beim Einreichen Ihres Rades ist ein Problem aufgetreten. Bitte versuchen Sie es spaeter erneut.",
      "check_entries": "Bitte ueberpruefen Sie Ihre Eingaben und versuchen Sie es erneut.",
      "dismiss": "Schliessen"
    },
    "submit_button": "Rad Einreichen"
  },
  "pt": {
    "page_title": "Enviar Roda - Classic Mini DIY",
    "description": "Envie uma roda para o banco de dados de rodas Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Enviar Roda",
    "sign_in_title": "Entre para Contribuir",
    "sign_in_description": "Voce precisa estar conectado para enviar rodas ao arquivo. Crie uma conta gratuita para comecar.",
    "sign_in_button": "Entrar para Continuar",
    "heading": "Enviar uma Roda",
    "subtitle": "Adicione uma roda ao nosso arquivo comunitario. Seu envio sera revisado antes de ser publicado.",
    "seo": {
      "og_title": "Enviar Roda - Classic Mini DIY",
      "og_description": "Envie uma roda para o banco de dados de rodas Classic Mini",
      "twitter_title": "Enviar Roda - Classic Mini DIY",
      "twitter_description": "Envie uma roda para o banco de dados de rodas Classic Mini"
    },
    "form": {
      "name": "Nome da Roda",
      "type": "Tipo",
      "size": "Tamanho",
      "width": "Largura",
      "offset": "Offset",
      "manufacturer": "Fabricante",
      "bolt_pattern": "Furacão",
      "center_bore": "Furo Central",
      "weight": "Peso",
      "notes": "Notas",
      "photos": "Fotos da Roda"
    },
    "placeholders": {
      "name": "ex. Minilite",
      "type": "ex. Liga, Aco",
      "size": "Selecione um tamanho",
      "width": "ex. 5.5J",
      "offset": "ex. +20",
      "manufacturer": "ex. Minilite Engineering",
      "bolt_pattern": "ex. 4x101.6",
      "center_bore": "ex. 76.2mm",
      "weight": "ex. 4.5kg",
      "notes": "Detalhes adicionais sobre esta roda..."
    },
    "validation": {
      "required": "Este campo e obrigatorio",
      "photos_required": "Pelo menos uma foto e obrigatoria"
    },
    "success": {
      "thank_you": "Obrigado!",
      "submitted_message": "Sua roda foi enviada. Aguarde 1-2 dias para revisao e publicacao.",
      "submission_id": "Seu ID de envio e",
      "submit_another": "Enviar Outra Roda",
      "view_submissions": "Ver Meus Envios"
    },
    "error": {
      "title": "Algo deu errado",
      "message": "Houve um problema ao enviar sua roda. Por favor, tente novamente mais tarde.",
      "check_entries": "Verifique seus dados e tente novamente.",
      "dismiss": "Dispensar"
    },
    "submit_button": "Enviar Roda"
  },
  "ru": {
    "page_title": "Отправить колесо - Classic Mini DIY",
    "description": "Отправьте колесо в базу данных колес Classic Mini",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Отправить колесо",
    "sign_in_title": "Войдите, чтобы внести вклад",
    "sign_in_description": "Вам нужно войти в систему, чтобы отправить колеса в архив. Создайте бесплатную учетную запись, чтобы начать.",
    "sign_in_button": "Войти для продолжения",
    "heading": "Отправить колесо",
    "subtitle": "Добавьте колесо в наш общественный архив. Ваша заявка будет рассмотрена перед публикацией.",
    "seo": {
      "og_title": "Отправить колесо - Classic Mini DIY",
      "og_description": "Отправьте колесо в базу данных колес Classic Mini",
      "twitter_title": "Отправить колесо - Classic Mini DIY",
      "twitter_description": "Отправьте колесо в базу данных колес Classic Mini"
    },
    "form": {
      "name": "Название колеса",
      "type": "Тип",
      "size": "Размер",
      "width": "Ширина",
      "offset": "Вылет",
      "manufacturer": "Производитель",
      "bolt_pattern": "Разболтовка",
      "center_bore": "Центральное отверстие",
      "weight": "Вес",
      "notes": "Примечания",
      "photos": "Фото колеса"
    },
    "placeholders": {
      "name": "напр. Minilite",
      "type": "напр. Литой, Стальной",
      "size": "Выберите размер",
      "width": "напр. 5.5J",
      "offset": "напр. +20",
      "manufacturer": "напр. Minilite Engineering",
      "bolt_pattern": "напр. 4x101.6",
      "center_bore": "напр. 76.2мм",
      "weight": "напр. 4.5кг",
      "notes": "Дополнительные сведения об этом колесе..."
    },
    "validation": {
      "required": "Это поле обязательно",
      "photos_required": "Требуется хотя бы одна фотография"
    },
    "success": {
      "thank_you": "Спасибо!",
      "submitted_message": "Ваше колесо отправлено. Пожалуйста, подождите 1-2 дня для рассмотрения и публикации.",
      "submission_id": "Ваш ID заявки",
      "submit_another": "Отправить другое колесо",
      "view_submissions": "Мои заявки"
    },
    "error": {
      "title": "Что-то пошло не так",
      "message": "Возникла проблема при отправке колеса. Пожалуйста, попробуйте позже.",
      "check_entries": "Проверьте введенные данные и попробуйте снова.",
      "dismiss": "Закрыть"
    },
    "submit_button": "Отправить колесо"
  },
  "ja": {
    "page_title": "ホイールを提出 - Classic Mini DIY",
    "description": "クラシックミニのホイールデータベースにホイールを提出する",
    "hero_title": "クラシックミニアーカイブ",
    "breadcrumb_title": "ホイールを提出",
    "sign_in_title": "貢献するにはサインインしてください",
    "sign_in_description": "アーカイブにホイールを提出するにはサインインが必要です。無料アカウントを作成して始めましょう。",
    "sign_in_button": "サインインして続行",
    "heading": "ホイールを提出",
    "subtitle": "コミュニティ主導のアーカイブにホイールを追加してください。提出は公開前に審査されます。",
    "seo": {
      "og_title": "ホイールを提出 - Classic Mini DIY",
      "og_description": "クラシックミニのホイールデータベースにホイールを提出する",
      "twitter_title": "ホイールを提出 - Classic Mini DIY",
      "twitter_description": "クラシックミニのホイールデータベースにホイールを提出する"
    },
    "form": {
      "name": "ホイール名",
      "type": "タイプ",
      "size": "サイズ",
      "width": "幅",
      "offset": "オフセット",
      "manufacturer": "メーカー",
      "bolt_pattern": "ボルトパターン",
      "center_bore": "センターボア",
      "weight": "重量",
      "notes": "備考",
      "photos": "ホイール写真"
    },
    "placeholders": {
      "name": "例: Minilite",
      "type": "例: アルミ、スチール",
      "size": "サイズを選択",
      "width": "例: 5.5J",
      "offset": "例: +20",
      "manufacturer": "例: Minilite Engineering",
      "bolt_pattern": "例: 4x101.6",
      "center_bore": "例: 76.2mm",
      "weight": "例: 4.5kg",
      "notes": "このホイールに関する追加情報..."
    },
    "validation": {
      "required": "このフィールドは必須です",
      "photos_required": "少なくとも1枚の写真が必要です"
    },
    "success": {
      "thank_you": "ありがとうございます！",
      "submitted_message": "ホイールが提出されました。審査と公開まで1〜2日お待ちください。",
      "submission_id": "提出IDは",
      "submit_another": "別のホイールを提出",
      "view_submissions": "提出一覧を見る"
    },
    "error": {
      "title": "エラーが発生しました",
      "message": "ホイールの提出中に問題が発生しました。後でもう一度お試しください。",
      "check_entries": "入力内容を確認して再度お試しください。",
      "dismiss": "閉じる"
    },
    "submit_button": "ホイールを提出"
  },
  "zh": {
    "page_title": "提交轮毂 - Classic Mini DIY",
    "description": "向经典迷你轮毂数据库提交轮毂",
    "hero_title": "经典迷你档案馆",
    "breadcrumb_title": "提交轮毂",
    "sign_in_title": "登录以贡献",
    "sign_in_description": "您需要登录才能向档案馆提交轮毂。创建免费帐户以开始。",
    "sign_in_button": "登录以继续",
    "heading": "提交轮毂",
    "subtitle": "将轮毂添加到我们的社区档案。您的提交将在发布前进行审核。",
    "seo": {
      "og_title": "提交轮毂 - Classic Mini DIY",
      "og_description": "向经典迷你轮毂数据库提交轮毂",
      "twitter_title": "提交轮毂 - Classic Mini DIY",
      "twitter_description": "向经典迷你轮毂数据库提交轮毂"
    },
    "form": {
      "name": "轮毂名称",
      "type": "类型",
      "size": "尺寸",
      "width": "宽度",
      "offset": "偏距",
      "manufacturer": "制造商",
      "bolt_pattern": "螺栓图案",
      "center_bore": "中心孔",
      "weight": "重量",
      "notes": "备注",
      "photos": "轮毂照片"
    },
    "placeholders": {
      "name": "例：Minilite",
      "type": "例：铝合金、钢",
      "size": "选择尺寸",
      "width": "例：5.5J",
      "offset": "例：+20",
      "manufacturer": "例：Minilite Engineering",
      "bolt_pattern": "例：4x101.6",
      "center_bore": "例：76.2mm",
      "weight": "例：4.5kg",
      "notes": "关于此轮毂的其他详情..."
    },
    "validation": {
      "required": "此字段为必填项",
      "photos_required": "至少需要一张照片"
    },
    "success": {
      "thank_you": "谢谢！",
      "submitted_message": "您的轮毂已提交。请等待1-2天进行审核和发布。",
      "submission_id": "您的提交ID为",
      "submit_another": "提交另一个轮毂",
      "view_submissions": "查看我的提交"
    },
    "error": {
      "title": "出了点问题",
      "message": "提交轮毂时出现问题。请稍后再试。",
      "check_entries": "请检查您的数据并重试。",
      "dismiss": "关闭"
    },
    "submit_button": "提交轮毂"
  },
  "ko": {
    "page_title": "휠 제출 - Classic Mini DIY",
    "description": "클래식 미니 휠 데이터베이스에 휠을 제출하세요",
    "hero_title": "클래식 미니 아카이브",
    "breadcrumb_title": "휠 제출",
    "sign_in_title": "기여하려면 로그인하세요",
    "sign_in_description": "아카이브에 휠을 제출하려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
    "sign_in_button": "로그인하여 계속",
    "heading": "휠 제출",
    "subtitle": "커뮤니티 주도 아카이브에 휠을 추가하세요. 제출물은 게시 전에 검토됩니다.",
    "seo": {
      "og_title": "휠 제출 - Classic Mini DIY",
      "og_description": "클래식 미니 휠 데이터베이스에 휠을 제출하세요",
      "twitter_title": "휠 제출 - Classic Mini DIY",
      "twitter_description": "클래식 미니 휠 데이터베이스에 휠을 제출하세요"
    },
    "form": {
      "name": "휠 이름",
      "type": "유형",
      "size": "크기",
      "width": "너비",
      "offset": "오프셋",
      "manufacturer": "제조사",
      "bolt_pattern": "볼트 패턴",
      "center_bore": "센터 보어",
      "weight": "무게",
      "notes": "메모",
      "photos": "휠 사진"
    },
    "placeholders": {
      "name": "예) Minilite",
      "type": "예) 알로이, 스틸",
      "size": "크기 선택",
      "width": "예) 5.5J",
      "offset": "예) +20",
      "manufacturer": "예) Minilite Engineering",
      "bolt_pattern": "예) 4x101.6",
      "center_bore": "예) 76.2mm",
      "weight": "예) 4.5kg",
      "notes": "이 휠에 대한 추가 정보..."
    },
    "validation": {
      "required": "이 필드는 필수입니다",
      "photos_required": "최소 1장의 사진이 필요합니다"
    },
    "success": {
      "thank_you": "감사합니다!",
      "submitted_message": "휠이 제출되었습니다. 검토 및 게시까지 1-2일 정도 소요됩니다.",
      "submission_id": "제출 ID는",
      "submit_another": "다른 휠 제출",
      "view_submissions": "내 제출 보기"
    },
    "error": {
      "title": "문제가 발생했습니다",
      "message": "휠 제출 중 문제가 발생했습니다. 나중에 다시 시도해 주세요.",
      "check_entries": "입력 내용을 확인하고 다시 시도해 주세요.",
      "dismiss": "닫기"
    },
    "submit_button": "휠 제출"
  }
}
</i18n>
