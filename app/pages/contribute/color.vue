<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { capture } = usePostHog();
  const { query } = useRoute();
  const { isAuthenticated } = useAuth();
  const { getColor } = useColors();
  const { submitNewItem } = useSubmissions();

  // Pre-populate from existing color if ?color= query param exists
  const { data: color, status: colorStatus } = await useAsyncData(`contribute-color-${query.color || 'new'}`, () =>
    query.color ? getColor(query.color as string) : Promise.resolve(null)
  );

  const submissionSuccess = ref(false);
  const apiError = ref(false);
  const submissionId = ref('');
  const apiMessage = ref('');
  const processing = ref(false);
  const swatchFiles = ref<File[]>([]);
  const carPhotoFiles = ref<File[]>([]);

  // Touched field tracking for inline validation
  const touched = reactive({
    name: false,
    code: false,
  });

  const formData = reactive({
    name: color.value?.pretty.Name || '',
    code: color.value?.pretty.Code || '',
    shortCode: color.value?.pretty['Short Code'] || '',
    ditzlerPpgCode: color.value?.pretty['Ditzler PPG Code'] || '',
    duluxCode: color.value?.pretty['Dulux Code'] || '',
    hexValue: color.value?.raw.primaryColor || '',
    years: color.value?.pretty.Years || '',
  });

  // Pre-populate when async color data arrives
  watch(color, (newColor) => {
    if (newColor) {
      formData.name = newColor.pretty.Name || '';
      formData.code = newColor.pretty.Code || '';
      formData.shortCode = newColor.pretty['Short Code'] || '';
      formData.ditzlerPpgCode = newColor.pretty['Ditzler PPG Code'] || '';
      formData.duluxCode = newColor.pretty['Dulux Code'] || '';
      formData.hexValue = newColor.raw.primaryColor || '';
      formData.years = newColor.pretty.Years || '';
    }
  });

  // Inline validation errors
  const isValidHex = computed(() => {
    if (!formData.hexValue) return true;
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(formData.hexValue);
  });

  const isFormValid = computed(() => {
    return formData.name.trim() !== '' && formData.code.trim() !== '' && isValidHex.value;
  });

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
    ogUrl: 'https://classicminidiy.com/contribute/color',
    ogType: 'website',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
  });

  async function submit() {
    // Mark all fields as touched
    touched.name = true;
    touched.code = true;

    if (!isFormValid.value) {
      apiError.value = true;
      apiMessage.value = t('form.error.validation_failed');
      return;
    }

    processing.value = true;
    apiError.value = false;

    try {
      const submission = await submitNewItem('color', {
        name: formData.name.trim(),
        code: formData.code.trim(),
        shortCode: formData.shortCode.trim() || undefined,
        ditzlerPpgCode: formData.ditzlerPpgCode.trim() || undefined,
        duluxCode: formData.duluxCode.trim() || undefined,
        hexValue: formData.hexValue.trim() || undefined,
        years: formData.years.trim() || undefined,
        originalColorId: color.value?.raw.id || undefined,
      });

      if (!submission) {
        throw new Error('No response from server');
      }

      // Upload swatch files if provided
      if (swatchFiles.value.length > 0) {
        const uploadData = new FormData();
        swatchFiles.value.forEach((file, i) => uploadData.append(`file${i}`, file));

        const { error: uploadError } = await useFetch('/api/archive/upload', {
          method: 'POST',
          body: uploadData,
          query: { bucket: 'archive-colors', submissionId: submission.id, category: 'swatch' },
        });

        if (uploadError.value) {
          console.error('Error uploading swatch files:', uploadError.value);
        }
      }

      // Upload car photos if provided
      if (carPhotoFiles.value.length > 0) {
        const uploadData = new FormData();
        carPhotoFiles.value.forEach((file, i) => uploadData.append(`file${i}`, file));

        const { error: uploadError } = await useFetch('/api/archive/upload', {
          method: 'POST',
          body: uploadData,
          query: { bucket: 'archive-colors', submissionId: submission.id, category: 'car-photos' },
        });

        if (uploadError.value) {
          console.error('Error uploading car photos:', uploadError.value);
        }
      }

      submissionSuccess.value = true;
      apiError.value = false;
      submissionId.value = submission.id;

      capture('form_submitted', {
        form: 'color_contribution',
        color_code: formData.code,
        has_swatch_files: swatchFiles.value.length > 0,
        has_car_photos: carPhotoFiles.value.length > 0,
        source: 'contribute_hub',
      });
    } catch (error) {
      submissionSuccess.value = false;
      apiError.value = true;
      apiMessage.value = t('form.error.submission_failed');
      console.error('Error submitting color contribution:', error);
    } finally {
      processing.value = false;
    }
  }

  function resetForm() {
    submissionSuccess.value = false;
    apiError.value = false;
    submissionId.value = '';
    apiMessage.value = '';
    swatchFiles.value = [];
    carPhotoFiles.value = [];
    touched.name = false;
    touched.code = false;
    formData.name = '';
    formData.code = '';
    formData.shortCode = '';
    formData.ditzlerPpgCode = '';
    formData.duluxCode = '';
    formData.hexValue = '';
    formData.years = '';
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

        <!-- Current Data Card (when pre-populating) -->
        <div v-if="query.color && colorStatus === 'pending'" class="col-span-12 md:col-span-8 md:col-start-3">
          <div class="flex justify-center p-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </div>

        <!-- Form Card -->
        <div class="col-span-12 md:col-span-8 md:col-start-3">
          <UCard>
            <!-- Success State -->
            <div v-if="submissionSuccess" class="text-center py-5">
              <i class="text-4xl text-success fa-duotone fa-box-check fa-beat py-5"></i>
              <h1 class="text-2xl font-bold mb-1">{{ t('form.success.title') }}</h1>
              <h2 class="text-lg mb-4">{{ t('form.success.subtitle') }}</h2>
              <div class="space-y-4 max-w-md mx-auto">
                <UButton color="primary" @click="resetForm" class="w-full">
                  <i class="fa-duotone fa-solid fa-plus-large mr-2"></i>
                  {{ t('form.success.make_another') }}
                </UButton>
                <UButton to="/dashboard" color="neutral" variant="outline" class="w-full">
                  {{ t('form.success.view_submissions') }}
                </UButton>
              </div>
            </div>

            <!-- Form Body -->
            <div v-else>
              <!-- Form Fields -->
              <form @submit.prevent="submit" class="space-y-4">
                  <!-- Color Name (required) -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium"
                        >{{ t('form.fields.color_name.label') }} <span class="text-error">*</span></span
                      >
                      <span class="text-sm text-muted"><i class="fad fa-paintbrush"></i></span>
                    </label>
                    <UInput
                      id="colorName"
                      type="text"
                      v-model="formData.name"
                      :placeholder="t('form.fields.color_name.placeholder')"
                      class="w-full"
                      maxlength="100"
                      :disabled="processing"
                      :color="touched.name && !formData.name.trim() ? 'error' : undefined"
                      @blur="touched.name = true"
                    />
                    <p v-if="touched.name && !formData.name.trim()" class="text-sm text-error mt-1">
                      {{ t('form.validation.name_required') }}
                    </p>
                  </div>

                  <!-- Primary Code + Short Code -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium"
                          >{{ t('form.fields.primary_code.label') }} <span class="text-error">*</span></span
                        >
                        <span class="text-sm text-muted"><i class="fad fa-code"></i></span>
                      </label>
                      <UInput
                        id="primaryCode"
                        type="text"
                        v-model="formData.code"
                        :placeholder="t('form.fields.primary_code.placeholder')"
                        class="w-full"
                        :disabled="processing"
                        :color="touched.code && !formData.code.trim() ? 'error' : undefined"
                        @blur="touched.code = true"
                      />
                      <p v-if="touched.code && !formData.code.trim()" class="text-sm text-error mt-1">
                        {{ t('form.validation.code_required') }}
                      </p>
                    </div>

                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ t('form.fields.short_code.label') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-code"></i></span>
                      </label>
                      <UInput
                        id="shortCode"
                        type="text"
                        v-model="formData.shortCode"
                        :placeholder="t('form.fields.short_code.placeholder')"
                        class="w-full"
                        :disabled="processing"
                      />
                    </div>
                  </div>

                  <!-- Ditzler/PPG Code + Dulux Code -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ t('form.fields.ditzler_ppg_code.label') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-code"></i></span>
                      </label>
                      <UInput
                        id="ditzlerPpgCode"
                        type="text"
                        v-model="formData.ditzlerPpgCode"
                        :placeholder="t('form.fields.ditzler_ppg_code.placeholder')"
                        class="w-full"
                        :disabled="processing"
                      />
                    </div>

                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ t('form.fields.dulux_code.label') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-code"></i></span>
                      </label>
                      <UInput
                        id="duluxCode"
                        type="text"
                        v-model="formData.duluxCode"
                        :placeholder="t('form.fields.dulux_code.placeholder')"
                        class="w-full"
                        :disabled="processing"
                      />
                    </div>
                  </div>

                  <!-- Hex Value with color preview swatch -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.fields.hex_value.label') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
                    </label>
                    <div class="flex items-center gap-3">
                      <UInput
                        id="hexValue"
                        type="text"
                        v-model="formData.hexValue"
                        :placeholder="t('form.fields.hex_value.placeholder')"
                        class="w-full"
                        :disabled="processing"
                        :color="formData.hexValue && !isValidHex ? 'error' : undefined"
                      />
                      <div
                        v-if="formData.hexValue && isValidHex"
                        class="w-10 h-10 rounded-lg border-2 border-base-300 shrink-0 shadow-sm"
                        :style="{ backgroundColor: formData.hexValue }"
                        :title="formData.hexValue"
                      ></div>
                    </div>
                    <p v-if="formData.hexValue && !isValidHex" class="text-sm text-error mt-1">
                      {{ t('form.validation.hex_invalid') }}
                    </p>
                  </div>

                  <!-- Years Used -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ t('form.fields.years_used.label') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-calendar-days"></i></span>
                    </label>
                    <UInput
                      id="years"
                      type="text"
                      v-model="formData.years"
                      :placeholder="t('form.fields.years_used.placeholder')"
                      class="w-full"
                      :disabled="processing"
                    />
                  </div>

                  <!-- Swatch Photo -->
                  <div>
                    <USeparator class="my-2" />
                    <h3 class="text-lg font-semibold mb-1">{{ t('form.fields.swatch_photo.section_title') }}</h3>
                    <p class="text-sm opacity-70 mb-3">{{ t('form.fields.swatch_photo.description') }}</p>
                    <ContributeFileUpload
                      accept="image/jpeg,image/png"
                      :maxFiles="1"
                      :maxSizeMb="5"
                      :label="t('form.fields.swatch_photo.label')"
                      @update:files="swatchFiles = $event"
                    />
                  </div>

                  <!-- Car / Example Photos -->
                  <div>
                    <USeparator class="my-2" />
                    <h3 class="text-lg font-semibold mb-1">{{ t('form.fields.car_photos.section_title') }}</h3>
                    <p class="text-sm opacity-70 mb-3">{{ t('form.fields.car_photos.description') }}</p>
                    <ContributeFileUpload
                      accept="image/jpeg,image/png"
                      :maxFiles="5"
                      :maxSizeMb="5"
                      :label="t('form.fields.car_photos.label')"
                      @update:files="carPhotoFiles = $event"
                    />
                  </div>

                  <UAlert v-if="apiError" color="error" class="mb-4">
                    <template #icon>
                      <i class="fa-duotone fa-circle-exclamation"></i>
                    </template>
                    <template #title>{{ t('form.error.title') }}</template>
                    <template #description>
                      {{ apiMessage || t('form.error.default_message') }}
                    </template>
                    <template #actions>
                      <UButton size="sm" variant="outline" @click="apiError = false">
                        Dismiss
                      </UButton>
                    </template>
                  </UAlert>

                  <div class="pt-4">
                    <UButton type="submit" color="primary" size="lg" class="w-full" :disabled="processing" :loading="processing">
                      <i class="fad fa-paper-plane mr-2" v-if="!processing"></i>
                      {{ processing ? t('form.submit.submitting') : t('form.submit.button') }}
                    </UButton>
                  </div>
                </form>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "page_title": "Contribute Color - Classic Mini DIY Archive",
    "description": "Submit a new color or additional color information to the Classic Mini color archive.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Color",
    "sign_in_title": "Sign In to Contribute",
    "sign_in_description": "You need to be signed in to submit colors to the archive. Create a free account to get started.",
    "sign_in_button": "Sign In to Continue",
    "heading": "Contribute a Color",
    "subtitle": "Help us expand the Classic Mini color archive by contributing a new color or additional details. Your submission will be reviewed by a moderator before being published.",
    "seo": {
      "og_title": "Contribute Color - Classic Mini DIY Archive",
      "og_description": "Submit a new color to the Classic Mini color archive",
      "twitter_title": "Contribute Color - Classic Mini DIY Archive",
      "twitter_description": "Submit a new color to the Classic Mini color archive"
    },
    "form": {
      "title": "Submit Color Contribution",
      "fields": {
        "color_name": {
          "label": "Color Name",
          "placeholder": "e.g. Almond Green"
        },
        "primary_code": {
          "label": "Primary Color Code",
          "placeholder": "e.g. GN25"
        },
        "short_code": {
          "label": "Short Code",
          "placeholder": "e.g. AG"
        },
        "ditzler_ppg_code": {
          "label": "Ditzler/PPG Code",
          "placeholder": "e.g. 42635"
        },
        "dulux_code": {
          "label": "Dulux Code",
          "placeholder": "e.g. 6102"
        },
        "hex_value": {
          "label": "Hex Value",
          "placeholder": "e.g. #4A7C59"
        },
        "years_used": {
          "label": "Years Used",
          "placeholder": "e.g. 1959-1967"
        },
        "swatch_photo": {
          "section_title": "Paint Swatch Image",
          "description": "Upload a photo of the actual paint swatch or color chip. This is the primary reference image for this color.",
          "label": "Swatch Photo (1 image)"
        },
        "car_photos": {
          "section_title": "Example Car Photos",
          "description": "Upload photos of Classic Minis painted in this color. These help the community see how the color looks on actual cars.",
          "label": "Car Photos (up to 5 images)"
        }
      },
      "submit": {
        "button": "Submit Color",
        "submitting": "Submitting..."
      },
      "success": {
        "title": "Submission Received!",
        "subtitle": "Thank you for your contribution",
        "submission_id": "Submission ID: ",
        "pending_review": "Your submission is pending review by a moderator. Once approved, it will appear in the color archive.",
        "make_another": "Submit Another Color",
        "view_submissions": "View My Submissions"
      },
      "error": {
        "title": "Submission Error",
        "default_message": "There was an error submitting your contribution. Please try again.",
        "validation_failed": "Please fill in all required fields before submitting.",
        "submission_failed": "Failed to submit your contribution. Please try again."
      },
      "validation": {
        "name_required": "Color name is required.",
        "code_required": "Primary color code is required.",
        "hex_invalid": "Please enter a valid hex color (e.g. #FF0000)."
      }
    }
  },
  "es": {
    "page_title": "Contribuir Color - Archivo Classic Mini DIY",
    "description": "Envie un nuevo color o informacion adicional al archivo de colores Classic Mini.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Color",
    "sign_in_title": "Inicia Sesion para Contribuir",
    "sign_in_description": "Debes iniciar sesion para enviar colores al archivo. Crea una cuenta gratuita para empezar.",
    "sign_in_button": "Iniciar Sesion para Continuar",
    "heading": "Contribuir un Color",
    "subtitle": "Ayudanos a expandir el archivo de colores Classic Mini contribuyendo un nuevo color o detalles adicionales. Tu envio sera revisado por un moderador antes de ser publicado.",
    "seo": {
      "og_title": "Contribuir Color - Archivo Classic Mini DIY",
      "og_description": "Envie un nuevo color al archivo de colores Classic Mini",
      "twitter_title": "Contribuir Color - Archivo Classic Mini DIY",
      "twitter_description": "Envie un nuevo color al archivo de colores Classic Mini"
    },
    "form": {
      "title": "Enviar Contribucion de Color",
      "fields": {
        "color_name": {
          "label": "Nombre del Color",
          "placeholder": "ej. Almond Green"
        },
        "primary_code": {
          "label": "Codigo de Color Primario",
          "placeholder": "ej. GN25"
        },
        "short_code": {
          "label": "Codigo Corto",
          "placeholder": "ej. AG"
        },
        "ditzler_ppg_code": {
          "label": "Codigo Ditzler/PPG",
          "placeholder": "ej. 42635"
        },
        "dulux_code": {
          "label": "Codigo Dulux",
          "placeholder": "ej. 6102"
        },
        "hex_value": {
          "label": "Valor Hexadecimal",
          "placeholder": "ej. #4A7C59"
        },
        "years_used": {
          "label": "Anos de Uso",
          "placeholder": "ej. 1959-1967"
        },
        "swatch_photo": {
          "section_title": "Imagen de Muestra de Pintura",
          "description": "Sube una foto de la muestra de pintura o chip de color real. Esta es la imagen de referencia principal para este color.",
          "label": "Foto de Muestra (1 imagen)"
        },
        "car_photos": {
          "section_title": "Fotos de Ejemplo de Coches",
          "description": "Sube fotos de Classic Minis pintados en este color. Estas ayudan a la comunidad a ver como se ve el color en coches reales.",
          "label": "Fotos de Coches (hasta 5 imagenes)"
        }
      },
      "submit": {
        "button": "Enviar Color",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "Envio Recibido!",
        "subtitle": "Gracias por tu contribucion",
        "submission_id": "ID de Envio: ",
        "pending_review": "Tu envio esta pendiente de revision por un moderador. Una vez aprobado, aparecera en el archivo de colores.",
        "make_another": "Enviar Otro Color",
        "view_submissions": "Ver Mis Envios"
      },
      "error": {
        "title": "Error de Envio",
        "default_message": "Hubo un error al enviar tu contribucion. Por favor intenta de nuevo.",
        "validation_failed": "Por favor completa todos los campos obligatorios antes de enviar.",
        "submission_failed": "No se pudo enviar tu contribucion. Por favor intenta de nuevo."
      },
      "validation": {
        "name_required": "El nombre del color es obligatorio.",
        "code_required": "El codigo de color primario es obligatorio.",
        "hex_invalid": "Por favor ingresa un color hexadecimal valido (ej. #FF0000)."
      }
    }
  },
  "fr": {
    "page_title": "Contribuer Couleur - Archives Classic Mini DIY",
    "description": "Soumettez une nouvelle couleur ou des informations supplementaires aux archives de couleurs Classic Mini.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Couleur",
    "sign_in_title": "Connectez-vous pour Contribuer",
    "sign_in_description": "Vous devez etre connecte pour soumettre des couleurs aux archives. Creez un compte gratuit pour commencer.",
    "sign_in_button": "Se Connecter pour Continuer",
    "heading": "Contribuer une Couleur",
    "subtitle": "Aidez-nous a elargir les archives de couleurs Classic Mini en contribuant une nouvelle couleur ou des details supplementaires. Votre soumission sera examinee par un moderateur avant publication.",
    "seo": {
      "og_title": "Contribuer Couleur - Archives Classic Mini DIY",
      "og_description": "Soumettez une nouvelle couleur aux archives de couleurs Classic Mini",
      "twitter_title": "Contribuer Couleur - Archives Classic Mini DIY",
      "twitter_description": "Soumettez une nouvelle couleur aux archives de couleurs Classic Mini"
    },
    "form": {
      "title": "Soumettre une Contribution de Couleur",
      "fields": {
        "color_name": {
          "label": "Nom de la Couleur",
          "placeholder": "ex. Almond Green"
        },
        "primary_code": {
          "label": "Code Couleur Primaire",
          "placeholder": "ex. GN25"
        },
        "short_code": {
          "label": "Code Court",
          "placeholder": "ex. AG"
        },
        "ditzler_ppg_code": {
          "label": "Code Ditzler/PPG",
          "placeholder": "ex. 42635"
        },
        "dulux_code": {
          "label": "Code Dulux",
          "placeholder": "ex. 6102"
        },
        "hex_value": {
          "label": "Valeur Hexadecimale",
          "placeholder": "ex. #4A7C59"
        },
        "years_used": {
          "label": "Annees d'Utilisation",
          "placeholder": "ex. 1959-1967"
        },
        "swatch_photo": {
          "section_title": "Image d'Echantillon de Peinture",
          "description": "Telechargez une photo de l'echantillon de peinture ou du nuancier reel. C'est l'image de reference principale pour cette couleur.",
          "label": "Photo d'Echantillon (1 image)"
        },
        "car_photos": {
          "section_title": "Photos d'Exemple de Voitures",
          "description": "Telechargez des photos de Classic Minis peintes dans cette couleur. Elles aident la communaute a voir a quoi ressemble la couleur sur de vraies voitures.",
          "label": "Photos de Voitures (jusqu'a 5 images)"
        }
      },
      "submit": {
        "button": "Soumettre la Couleur",
        "submitting": "Soumission en cours..."
      },
      "success": {
        "title": "Soumission Recue !",
        "subtitle": "Merci pour votre contribution",
        "submission_id": "ID de Soumission : ",
        "pending_review": "Votre soumission est en attente de revision par un moderateur. Une fois approuvee, elle apparaitra dans les archives de couleurs.",
        "make_another": "Soumettre une Autre Couleur",
        "view_submissions": "Voir Mes Soumissions"
      },
      "error": {
        "title": "Erreur de Soumission",
        "default_message": "Une erreur s'est produite lors de la soumission de votre contribution. Veuillez reessayer.",
        "validation_failed": "Veuillez remplir tous les champs obligatoires avant de soumettre.",
        "submission_failed": "Impossible de soumettre votre contribution. Veuillez reessayer."
      },
      "validation": {
        "name_required": "Le nom de la couleur est requis.",
        "code_required": "Le code couleur primaire est requis.",
        "hex_invalid": "Veuillez entrer une couleur hexadecimale valide (ex. #FF0000)."
      }
    }
  },
  "it": {
    "page_title": "Contribuisci Colore - Archivio Classic Mini DIY",
    "description": "Invia un nuovo colore o informazioni aggiuntive all'archivio colori Classic Mini.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Colore",
    "sign_in_title": "Accedi per Contribuire",
    "sign_in_description": "Devi essere connesso per inviare colori all'archivio. Crea un account gratuito per iniziare.",
    "sign_in_button": "Accedi per Continuare",
    "heading": "Contribuisci un Colore",
    "subtitle": "Aiutaci ad espandere l'archivio colori Classic Mini contribuendo un nuovo colore o dettagli aggiuntivi. La tua proposta sara esaminata da un moderatore prima della pubblicazione.",
    "seo": {
      "og_title": "Contribuisci Colore - Archivio Classic Mini DIY",
      "og_description": "Invia un nuovo colore all'archivio colori Classic Mini",
      "twitter_title": "Contribuisci Colore - Archivio Classic Mini DIY",
      "twitter_description": "Invia un nuovo colore all'archivio colori Classic Mini"
    },
    "form": {
      "title": "Invia Contribuzione Colore",
      "fields": {
        "color_name": {
          "label": "Nome Colore",
          "placeholder": "es. Almond Green"
        },
        "primary_code": {
          "label": "Codice Colore Primario",
          "placeholder": "es. GN25"
        },
        "short_code": {
          "label": "Codice Breve",
          "placeholder": "es. AG"
        },
        "ditzler_ppg_code": {
          "label": "Codice Ditzler/PPG",
          "placeholder": "es. 42635"
        },
        "dulux_code": {
          "label": "Codice Dulux",
          "placeholder": "es. 6102"
        },
        "hex_value": {
          "label": "Valore Esadecimale",
          "placeholder": "es. #4A7C59"
        },
        "years_used": {
          "label": "Anni di Utilizzo",
          "placeholder": "es. 1959-1967"
        },
        "swatch_photo": {
          "section_title": "Immagine Campione di Vernice",
          "description": "Carica una foto del campione di vernice o chip colore reale. Questa e l'immagine di riferimento principale per questo colore.",
          "label": "Foto Campione (1 immagine)"
        },
        "car_photos": {
          "section_title": "Foto di Esempio di Auto",
          "description": "Carica foto di Classic Mini verniciate in questo colore. Queste aiutano la comunita a vedere come appare il colore su auto reali.",
          "label": "Foto di Auto (fino a 5 immagini)"
        }
      },
      "submit": {
        "button": "Invia Colore",
        "submitting": "Invio in corso..."
      },
      "success": {
        "title": "Proposta Ricevuta!",
        "subtitle": "Grazie per il tuo contributo",
        "submission_id": "ID Proposta: ",
        "pending_review": "La tua proposta e in attesa di revisione da parte di un moderatore. Una volta approvata, apparira nell'archivio colori.",
        "make_another": "Invia un Altro Colore",
        "view_submissions": "Visualizza le Mie Proposte"
      },
      "error": {
        "title": "Errore di Invio",
        "default_message": "Si e verificato un errore durante l'invio del tuo contributo. Riprova.",
        "validation_failed": "Compila tutti i campi obbligatori prima di inviare.",
        "submission_failed": "Impossibile inviare il tuo contributo. Riprova."
      },
      "validation": {
        "name_required": "Il nome del colore e obbligatorio.",
        "code_required": "Il codice colore primario e obbligatorio.",
        "hex_invalid": "Inserisci un colore esadecimale valido (es. #FF0000)."
      }
    }
  },
  "de": {
    "page_title": "Farbe Beitragen - Classic Mini DIY Archiv",
    "description": "Reichen Sie eine neue Farbe oder zusaetzliche Farbinformationen zum Classic Mini Farbarchiv ein.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Farbe",
    "sign_in_title": "Anmelden zum Beitragen",
    "sign_in_description": "Sie muessen angemeldet sein, um Farben zum Archiv beizutragen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
    "sign_in_button": "Anmelden und Fortfahren",
    "heading": "Farbe Beitragen",
    "subtitle": "Helfen Sie uns, das Classic Mini Farbarchiv zu erweitern, indem Sie eine neue Farbe oder zusaetzliche Details beitragen. Ihre Einreichung wird von einem Moderator geprueft, bevor sie veroeffentlicht wird.",
    "seo": {
      "og_title": "Farbe Beitragen - Classic Mini DIY Archiv",
      "og_description": "Reichen Sie eine neue Farbe zum Classic Mini Farbarchiv ein",
      "twitter_title": "Farbe Beitragen - Classic Mini DIY Archiv",
      "twitter_description": "Reichen Sie eine neue Farbe zum Classic Mini Farbarchiv ein"
    },
    "form": {
      "title": "Farbbeitrag Einreichen",
      "fields": {
        "color_name": {
          "label": "Farbname",
          "placeholder": "z.B. Almond Green"
        },
        "primary_code": {
          "label": "Primaerer Farbcode",
          "placeholder": "z.B. GN25"
        },
        "short_code": {
          "label": "Kurzcode",
          "placeholder": "z.B. AG"
        },
        "ditzler_ppg_code": {
          "label": "Ditzler/PPG Code",
          "placeholder": "z.B. 42635"
        },
        "dulux_code": {
          "label": "Dulux Code",
          "placeholder": "z.B. 6102"
        },
        "hex_value": {
          "label": "Hex-Wert",
          "placeholder": "z.B. #4A7C59"
        },
        "years_used": {
          "label": "Verwendungsjahre",
          "placeholder": "z.B. 1959-1967"
        },
        "swatch_photo": {
          "section_title": "Farbmuster-Bild",
          "description": "Laden Sie ein Foto des tatsaechlichen Farbmusters oder Farbchips hoch. Dies ist das primaere Referenzbild fuer diese Farbe.",
          "label": "Farbmuster-Foto (1 Bild)"
        },
        "car_photos": {
          "section_title": "Beispielfotos von Autos",
          "description": "Laden Sie Fotos von Classic Minis in dieser Farbe hoch. Diese helfen der Community zu sehen, wie die Farbe auf echten Autos aussieht.",
          "label": "Auto-Fotos (bis zu 5 Bilder)"
        }
      },
      "submit": {
        "button": "Farbe Einreichen",
        "submitting": "Wird eingereicht..."
      },
      "success": {
        "title": "Einreichung Erhalten!",
        "subtitle": "Vielen Dank fuer Ihren Beitrag",
        "submission_id": "Einreichungs-ID: ",
        "pending_review": "Ihre Einreichung wird von einem Moderator geprueft. Nach der Genehmigung erscheint sie im Farbarchiv.",
        "make_another": "Weitere Farbe Einreichen",
        "view_submissions": "Meine Einreichungen Anzeigen"
      },
      "error": {
        "title": "Einreichungsfehler",
        "default_message": "Beim Einreichen Ihres Beitrags ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
        "validation_failed": "Bitte fuellen Sie alle Pflichtfelder aus, bevor Sie einreichen.",
        "submission_failed": "Ihr Beitrag konnte nicht eingereicht werden. Bitte versuchen Sie es erneut."
      },
      "validation": {
        "name_required": "Der Farbname ist erforderlich.",
        "code_required": "Der primaere Farbcode ist erforderlich.",
        "hex_invalid": "Bitte geben Sie eine gueltige Hex-Farbe ein (z.B. #FF0000)."
      }
    }
  },
  "pt": {
    "page_title": "Contribuir Cor - Arquivo Classic Mini DIY",
    "description": "Envie uma nova cor ou informacoes adicionais ao arquivo de cores Classic Mini.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Cor",
    "sign_in_title": "Entre para Contribuir",
    "sign_in_description": "Voce precisa estar conectado para enviar cores ao arquivo. Crie uma conta gratuita para comecar.",
    "sign_in_button": "Entrar para Continuar",
    "heading": "Contribuir uma Cor",
    "subtitle": "Ajude-nos a expandir o arquivo de cores Classic Mini contribuindo uma nova cor ou detalhes adicionais. Seu envio sera revisado por um moderador antes de ser publicado.",
    "seo": {
      "og_title": "Contribuir Cor - Arquivo Classic Mini DIY",
      "og_description": "Envie uma nova cor ao arquivo de cores Classic Mini",
      "twitter_title": "Contribuir Cor - Arquivo Classic Mini DIY",
      "twitter_description": "Envie uma nova cor ao arquivo de cores Classic Mini"
    },
    "form": {
      "title": "Enviar Contribuicao de Cor",
      "fields": {
        "color_name": {
          "label": "Nome da Cor",
          "placeholder": "ex. Almond Green"
        },
        "primary_code": {
          "label": "Codigo de Cor Primario",
          "placeholder": "ex. GN25"
        },
        "short_code": {
          "label": "Codigo Curto",
          "placeholder": "ex. AG"
        },
        "ditzler_ppg_code": {
          "label": "Codigo Ditzler/PPG",
          "placeholder": "ex. 42635"
        },
        "dulux_code": {
          "label": "Codigo Dulux",
          "placeholder": "ex. 6102"
        },
        "hex_value": {
          "label": "Valor Hexadecimal",
          "placeholder": "ex. #4A7C59"
        },
        "years_used": {
          "label": "Anos de Uso",
          "placeholder": "ex. 1959-1967"
        },
        "swatch_photo": {
          "section_title": "Imagem de Amostra de Tinta",
          "description": "Envie uma foto da amostra de tinta ou chip de cor real. Esta e a imagem de referencia principal para esta cor.",
          "label": "Foto de Amostra (1 imagem)"
        },
        "car_photos": {
          "section_title": "Fotos de Exemplo de Carros",
          "description": "Envie fotos de Classic Minis pintados nesta cor. Estas ajudam a comunidade a ver como a cor fica em carros reais.",
          "label": "Fotos de Carros (ate 5 imagens)"
        }
      },
      "submit": {
        "button": "Enviar Cor",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "Envio Recebido!",
        "subtitle": "Obrigado pela sua contribuicao",
        "submission_id": "ID do Envio: ",
        "pending_review": "Seu envio esta pendente de revisao por um moderador. Uma vez aprovado, aparecera no arquivo de cores.",
        "make_another": "Enviar Outra Cor",
        "view_submissions": "Ver Meus Envios"
      },
      "error": {
        "title": "Erro no Envio",
        "default_message": "Ocorreu um erro ao enviar sua contribuicao. Por favor, tente novamente.",
        "validation_failed": "Por favor preencha todos os campos obrigatorios antes de enviar.",
        "submission_failed": "Nao foi possivel enviar sua contribuicao. Por favor, tente novamente."
      },
      "validation": {
        "name_required": "O nome da cor e obrigatorio.",
        "code_required": "O codigo de cor primario e obrigatorio.",
        "hex_invalid": "Por favor insira uma cor hexadecimal valida (ex. #FF0000)."
      }
    }
  },
  "ru": {
    "page_title": "Добавить цвет - Архив Classic Mini DIY",
    "description": "Отправьте новый цвет или дополнительную информацию о цвете в архив цветов Classic Mini.",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Цвет",
    "sign_in_title": "Войдите, чтобы внести вклад",
    "sign_in_description": "Вам нужно войти в систему, чтобы отправлять цвета в архив. Создайте бесплатную учетную запись, чтобы начать.",
    "sign_in_button": "Войти для продолжения",
    "heading": "Добавить цвет",
    "subtitle": "Помогите нам расширить архив цветов Classic Mini, добавив новый цвет или дополнительные детали. Ваша заявка будет рассмотрена модератором перед публикацией.",
    "seo": {
      "og_title": "Добавить цвет - Архив Classic Mini DIY",
      "og_description": "Отправьте новый цвет в архив цветов Classic Mini",
      "twitter_title": "Добавить цвет - Архив Classic Mini DIY",
      "twitter_description": "Отправьте новый цвет в архив цветов Classic Mini"
    },
    "form": {
      "title": "Отправить цветовой вклад",
      "fields": {
        "color_name": {
          "label": "Название цвета",
          "placeholder": "напр. Almond Green"
        },
        "primary_code": {
          "label": "Основной код цвета",
          "placeholder": "напр. GN25"
        },
        "short_code": {
          "label": "Короткий код",
          "placeholder": "напр. AG"
        },
        "ditzler_ppg_code": {
          "label": "Код Ditzler/PPG",
          "placeholder": "напр. 42635"
        },
        "dulux_code": {
          "label": "Код Dulux",
          "placeholder": "напр. 6102"
        },
        "hex_value": {
          "label": "Hex значение",
          "placeholder": "напр. #4A7C59"
        },
        "years_used": {
          "label": "Годы использования",
          "placeholder": "напр. 1959-1967"
        },
        "swatch_photo": {
          "section_title": "Изображение образца краски",
          "description": "Загрузите фото реального образца краски или цветового чипа. Это основное справочное изображение для данного цвета.",
          "label": "Фото образца (1 изображение)"
        },
        "car_photos": {
          "section_title": "Примеры фото автомобилей",
          "description": "Загрузите фото Classic Mini, окрашенных в этот цвет. Они помогут сообществу увидеть, как цвет выглядит на реальных автомобилях.",
          "label": "Фото автомобилей (до 5 изображений)"
        }
      },
      "submit": {
        "button": "Отправить цвет",
        "submitting": "Отправка..."
      },
      "success": {
        "title": "Заявка получена!",
        "subtitle": "Спасибо за ваш вклад",
        "submission_id": "ID заявки: ",
        "pending_review": "Ваша заявка ожидает проверки модератором. После одобрения она появится в архиве цветов.",
        "make_another": "Отправить другой цвет",
        "view_submissions": "Посмотреть мои заявки"
      },
      "error": {
        "title": "Ошибка отправки",
        "default_message": "Произошла ошибка при отправке вашего вклада. Пожалуйста, попробуйте снова.",
        "validation_failed": "Пожалуйста, заполните все обязательные поля перед отправкой.",
        "submission_failed": "Не удалось отправить ваш вклад. Пожалуйста, попробуйте снова."
      },
      "validation": {
        "name_required": "Название цвета обязательно.",
        "code_required": "Основной код цвета обязателен.",
        "hex_invalid": "Пожалуйста, введите допустимый hex цвет (напр. #FF0000)."
      }
    }
  },
  "ja": {
    "page_title": "カラーを投稿 - Classic Mini DIY アーカイブ",
    "description": "Classic Miniカラーアーカイブに新しいカラーまたは追加情報を送信してください。",
    "hero_title": "クラシックミニアーカイブ",
    "breadcrumb_title": "カラー",
    "sign_in_title": "投稿するにはサインインしてください",
    "sign_in_description": "アーカイブにカラーを送信するにはサインインが必要です。無料アカウントを作成して始めましょう。",
    "sign_in_button": "サインインして続行",
    "heading": "カラーを投稿",
    "subtitle": "新しいカラーや追加情報を投稿して、Classic Miniカラーアーカイブの拡充にご協力ください。送信内容はモデレーターによる審査後に公開されます。",
    "seo": {
      "og_title": "カラーを投稿 - Classic Mini DIY アーカイブ",
      "og_description": "Classic Miniカラーアーカイブに新しいカラーを送信",
      "twitter_title": "カラーを投稿 - Classic Mini DIY アーカイブ",
      "twitter_description": "Classic Miniカラーアーカイブに新しいカラーを送信"
    },
    "form": {
      "title": "カラー投稿を送信",
      "fields": {
        "color_name": {
          "label": "カラー名",
          "placeholder": "例: Almond Green"
        },
        "primary_code": {
          "label": "プライマリカラーコード",
          "placeholder": "例: GN25"
        },
        "short_code": {
          "label": "ショートコード",
          "placeholder": "例: AG"
        },
        "ditzler_ppg_code": {
          "label": "Ditzler/PPGコード",
          "placeholder": "例: 42635"
        },
        "dulux_code": {
          "label": "Duluxコード",
          "placeholder": "例: 6102"
        },
        "hex_value": {
          "label": "Hex値",
          "placeholder": "例: #4A7C59"
        },
        "years_used": {
          "label": "使用年数",
          "placeholder": "例: 1959-1967"
        },
        "swatch_photo": {
          "section_title": "塗料見本画像",
          "description": "実際の塗料見本またはカラーチップの写真をアップロードしてください。これがこの色の主要な参考画像となります。",
          "label": "見本写真（1枚）"
        },
        "car_photos": {
          "section_title": "車の例写真",
          "description": "この色で塗装されたClassic Miniの写真をアップロードしてください。実際の車での色の見え方をコミュニティに共有できます。",
          "label": "車の写真（最大5枚）"
        }
      },
      "submit": {
        "button": "カラーを送信",
        "submitting": "送信中..."
      },
      "success": {
        "title": "送信を受け付けました!",
        "subtitle": "ご協力ありがとうございます",
        "submission_id": "送信ID: ",
        "pending_review": "送信内容はモデレーターによる審査待ちです。承認されると、カラーアーカイブに表示されます。",
        "make_another": "別のカラーを送信",
        "view_submissions": "送信一覧を表示"
      },
      "error": {
        "title": "送信エラー",
        "default_message": "投稿の送信中にエラーが発生しました。もう一度お試しください。",
        "validation_failed": "送信前に必須フィールドをすべて入力してください。",
        "submission_failed": "投稿を送信できませんでした。もう一度お試しください。"
      },
      "validation": {
        "name_required": "カラー名は必須です。",
        "code_required": "プライマリカラーコードは必須です。",
        "hex_invalid": "有効なhexカラーを入力してください（例: #FF0000）。"
      }
    }
  },
  "zh": {
    "page_title": "贡献颜色 - Classic Mini DIY 档案馆",
    "description": "向Classic Mini颜色档案馆提交新颜色或额外颜色信息。",
    "hero_title": "经典迷你档案馆",
    "breadcrumb_title": "颜色",
    "sign_in_title": "登录以贡献",
    "sign_in_description": "您需要登录才能向档案馆提交颜色。创建免费帐户以开始。",
    "sign_in_button": "登录以继续",
    "heading": "贡献颜色",
    "subtitle": "通过贡献新颜色或额外信息，帮助我们扩展Classic Mini颜色档案馆。您的提交将在发布前由版主审核。",
    "seo": {
      "og_title": "贡献颜色 - Classic Mini DIY 档案馆",
      "og_description": "向Classic Mini颜色档案馆提交新颜色",
      "twitter_title": "贡献颜色 - Classic Mini DIY 档案馆",
      "twitter_description": "向Classic Mini颜色档案馆提交新颜色"
    },
    "form": {
      "title": "提交颜色贡献",
      "fields": {
        "color_name": {
          "label": "颜色名称",
          "placeholder": "例如 Almond Green"
        },
        "primary_code": {
          "label": "主要颜色代码",
          "placeholder": "例如 GN25"
        },
        "short_code": {
          "label": "简码",
          "placeholder": "例如 AG"
        },
        "ditzler_ppg_code": {
          "label": "Ditzler/PPG 代码",
          "placeholder": "例如 42635"
        },
        "dulux_code": {
          "label": "Dulux 代码",
          "placeholder": "例如 6102"
        },
        "hex_value": {
          "label": "十六进制值",
          "placeholder": "例如 #4A7C59"
        },
        "years_used": {
          "label": "使用年份",
          "placeholder": "例如 1959-1967"
        },
        "swatch_photo": {
          "section_title": "油漆色板图片",
          "description": "上传实际油漆色板或色卡的照片。这是该颜色的主要参考图片。",
          "label": "色板照片（1张图片）"
        },
        "car_photos": {
          "section_title": "汽车示例照片",
          "description": "上传喷涂此颜色的Classic Mini照片。这些照片帮助社区了解该颜色在实际汽车上的效果。",
          "label": "汽车照片（最多5张图片）"
        }
      },
      "submit": {
        "button": "提交颜色",
        "submitting": "提交中..."
      },
      "success": {
        "title": "提交已收到!",
        "subtitle": "感谢您的贡献",
        "submission_id": "提交ID: ",
        "pending_review": "您的提交正在等待版主审核。一旦批准，它将出现在颜色档案中。",
        "make_another": "提交另一个颜色",
        "view_submissions": "查看我的提交"
      },
      "error": {
        "title": "提交错误",
        "default_message": "提交您的贡献时出现错误。请重试。",
        "validation_failed": "请在提交前填写所有必填字段。",
        "submission_failed": "无法提交您的贡献。请重试。"
      },
      "validation": {
        "name_required": "颜色名称为必填项。",
        "code_required": "主要颜色代码为必填项。",
        "hex_invalid": "请输入有效的十六进制颜色（例如 #FF0000）。"
      }
    }
  },
  "ko": {
    "page_title": "색상 기여 - Classic Mini DIY 아카이브",
    "description": "Classic Mini 색상 아카이브에 새 색상 또는 추가 색상 정보를 제출하세요.",
    "hero_title": "클래식 미니 아카이브",
    "breadcrumb_title": "색상",
    "sign_in_title": "기여하려면 로그인하세요",
    "sign_in_description": "아카이브에 색상을 제출하려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
    "sign_in_button": "로그인하여 계속",
    "heading": "색상 기여",
    "subtitle": "새로운 색상이나 추가 정보를 기여하여 Classic Mini 색상 아카이브를 확장하는 데 도움을 주세요. 제출물은 게시 전에 관리자의 검토를 거칩니다.",
    "seo": {
      "og_title": "색상 기여 - Classic Mini DIY 아카이브",
      "og_description": "Classic Mini 색상 아카이브에 새 색상을 제출",
      "twitter_title": "색상 기여 - Classic Mini DIY 아카이브",
      "twitter_description": "Classic Mini 색상 아카이브에 새 색상을 제출"
    },
    "form": {
      "title": "색상 기여 제출",
      "fields": {
        "color_name": {
          "label": "색상 이름",
          "placeholder": "예: Almond Green"
        },
        "primary_code": {
          "label": "기본 색상 코드",
          "placeholder": "예: GN25"
        },
        "short_code": {
          "label": "약칭 코드",
          "placeholder": "예: AG"
        },
        "ditzler_ppg_code": {
          "label": "Ditzler/PPG 코드",
          "placeholder": "예: 42635"
        },
        "dulux_code": {
          "label": "Dulux 코드",
          "placeholder": "예: 6102"
        },
        "hex_value": {
          "label": "Hex 값",
          "placeholder": "예: #4A7C59"
        },
        "years_used": {
          "label": "사용 연도",
          "placeholder": "예: 1959-1967"
        },
        "swatch_photo": {
          "section_title": "페인트 색상 견본 이미지",
          "description": "실제 페인트 견본 또는 컬러 칩의 사진을 업로드하세요. 이것은 이 색상의 주요 참고 이미지입니다.",
          "label": "견본 사진 (1장)"
        },
        "car_photos": {
          "section_title": "자동차 예시 사진",
          "description": "이 색상으로 도장된 Classic Mini의 사진을 업로드하세요. 이는 커뮤니티가 실제 자동차에서 색상이 어떻게 보이는지 확인하는 데 도움이 됩니다.",
          "label": "자동차 사진 (최대 5장)"
        }
      },
      "submit": {
        "button": "색상 제출",
        "submitting": "제출 중..."
      },
      "success": {
        "title": "제출이 접수되었습니다!",
        "subtitle": "기여해 주셔서 감사합니다",
        "submission_id": "제출 ID: ",
        "pending_review": "제출물은 관리자의 검토를 기다리고 있습니다. 승인되면 색상 아카이브에 표시됩니다.",
        "make_another": "다른 색상 제출",
        "view_submissions": "내 제출 보기"
      },
      "error": {
        "title": "제출 오류",
        "default_message": "기여를 제출하는 중 오류가 발생했습니다. 다시 시도해 주세요.",
        "validation_failed": "제출 전에 모든 필수 필드를 작성해 주세요.",
        "submission_failed": "기여를 제출할 수 없습니다. 다시 시도해 주세요."
      },
      "validation": {
        "name_required": "색상 이름은 필수입니다.",
        "code_required": "기본 색상 코드는 필수입니다.",
        "hex_invalid": "유효한 hex 색상을 입력해 주세요 (예: #FF0000)."
      }
    }
  }
}
</i18n>
