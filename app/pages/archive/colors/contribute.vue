<script lang="ts" setup>
  import type { PrettyColor, ColorQueueItem, ColorQueueSubmissionResponse } from '../../../../data/models/colors';
  import { HERO_TYPES } from '../../../../data/models/generic';

  const { capture } = usePostHog();
  const { query } = useRoute();
  const { data: color, status } = await useFetch<PrettyColor | null>(`/api/colors/single`, {
    query: {
      id: query.color,
    },
    // Only fetch if we have a color ID
    server: !!query.color,
    default: () => null,
  });

  watch(color, (newColor: PrettyColor | null) => {
    if (newColor) {
      formData.code = newColor.pretty.Code || '';
      formData.ditzlerPpgCode = newColor.pretty['Ditzler PPG Code'] || '';
      formData.duluxCode = newColor.pretty['Dulux Code'] || '';
      formData.name = newColor.pretty.Name || '';
      formData.shortCode = newColor.pretty['Short Code'] || '';
      formData.years = newColor.pretty.Years || '';
      formData.imageSwatch = newColor.raw.imageSwatch || '';
      formData.primaryColor = newColor.pretty['Primary Color'] || '';
    }
  });

  const submissionSuccess = ref(false);
  const apiError = ref(false);
  const submissionId = ref('');

  const apiMessage = ref('');
  const processing = ref(false);

  const formData = reactive({
    code: color.value?.pretty.Code || '',
    ditzlerPpgCode: color.value?.pretty['Ditzler PPG Code'] || '',
    duluxCode: color.value?.pretty['Dulux Code'] || '',
    name: color.value?.pretty.Name || '',
    shortCode: color.value?.pretty['Short Code'] || '',
    years: color.value?.pretty.Years || '',
    imageSwatch: color.value?.raw.imageSwatch || '',
    primaryColor: color.value?.pretty['Primary Color'] || '',
    submittedBy: '',
    submittedByEmail: '',
  });

  useHead({
    title: $t('title'),
    meta: [
      {
        name: 'description',
        content: $t('description'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/colors/contribute',
    ogType: 'website',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/colors.png',
  });

  async function submit() {
    // Validate submitter info
    if (!formData.submittedBy || !formData.submittedByEmail) {
      apiError.value = true;
      apiMessage.value = $t('form.error.submitter_required');
      return;
    }

    if (!formData.submittedByEmail.includes('@')) {
      apiError.value = true;
      apiMessage.value = $t('form.error.invalid_email');
      return;
    }

    if (!formData.name || !formData.code) {
      apiError.value = true;
      apiMessage.value = $t('form.error.name_code_required');
      return;
    }

    processing.value = true;
    try {
      const details: Partial<ColorQueueItem> = {
        code: formData.code,
        ditzlerPpgCode: formData.ditzlerPpgCode,
        duluxCode: formData.duluxCode,
        name: formData.name,
        shortCode: formData.shortCode,
        years: formData.years,
        imageSwatch: formData.imageSwatch,
        primaryColor: formData.primaryColor,
        submittedBy: formData.submittedBy,
        submittedByEmail: formData.submittedByEmail,
        hasSwatch: !!formData.imageSwatch,
        originalColorId: color.value?.raw.id || undefined,
      };

      const { data: response } = await useFetch<ColorQueueSubmissionResponse>('/api/colors/queue/submit', {
        method: 'POST',
        body: { details },
      });

      if (response.value) {
        submissionSuccess.value = true;
        apiError.value = false;
        submissionId.value = response.value.uuid;

        capture('form_submitted', {
          form: 'color_contribution',
          color_code: formData.code,
        });
      } else {
        throw new Error('No response from server');
      }
    } catch (error) {
      submissionSuccess.value = false;
      apiError.value = true;
      apiMessage.value = $t('form.error.submission_failed');
      console.error('Error submitting color contribution:', error);
    } finally {
      processing.value = false;
    }
  }
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <!-- Breadcrumb -->
    <div class="mb-6">
      <breadcrumb :page="$t('breadcrumb_title')" />
    </div>

    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-4">{{ $t('main_heading') }}</h1>
      <p class="mb-6 text-base">
        {{ $t('description_text') }}
      </p>
      <USeparator />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Current Data Card -->
      <div class="lg:col-span-1">
        <UCard>
          <template #header>
            <div class="flex items-center bg-muted -m-4 p-4">
              <i class="fas fa-list-timeline mr-2"></i>
              <h2 class="text-lg font-semibold">
                {{ $t('current_data.title') }}
              </h2>
            </div>
          </template>

          <div v-if="status === 'pending'" class="flex justify-center p-8">
            <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
          </div>

          <div v-else-if="status === 'success' && color" class="p-4">
            <div class="flex justify-center mb-4">
              <picture v-if="color.pretty.hasSwatch" class="block w-full max-w-xs">
                <source
                  :srcset="`https://classicminidiy.s3.amazonaws.com/colors/${color.pretty.Code}.webp`"
                  type="image/webp"
                />
                <source
                  :srcset="`https://classicminidiy.s3.amazonaws.com/colors/${color.pretty.Code}.jpg`"
                  type="image/jpg"
                />
                <img
                  loading="lazy"
                  alt="Color swatch"
                  :src="`https://classicminidiy.s3.amazonaws.com/colors/${color?.pretty?.Code}.jpg`"
                  class="w-full h-auto rounded-lg shadow"
                />
              </picture>
              <div v-else class="flex items-center justify-center py-8">
                <div class="text-center">
                  <i class="fas fa-spinner fa-spin text-3xl text-primary mb-2"></i>
                  <p class="text-sm text-gray-600">
                    {{ $t('current_data.loading') }}
                  </p>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <div v-if="color?.pretty">
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="text-sm font-medium text-gray-700">{{
                      $t('current_data.labels.primary_color')
                    }}</label>
                    <p class="mt-1 text-sm text-gray-900">
                      {{ color.pretty['Primary Color'] }}
                    </p>
                  </div>
                  <div>
                    <label class="text-sm font-medium text-gray-700">{{ $t('current_data.labels.code') }}</label>
                    <p class="mt-1 text-sm text-gray-900">
                      {{ color.pretty.Code }}
                    </p>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="text-sm font-medium text-gray-700">{{
                      $t('current_data.labels.ditzler_ppg_code')
                    }}</label>
                    <p class="mt-1 text-sm text-gray-900">
                      {{ color.pretty['Ditzler PPG Code'] || $t('current_data.na') }}
                    </p>
                  </div>
                  <div>
                    <label class="text-sm font-medium text-gray-700">{{ $t('current_data.labels.dulux_code') }}</label>
                    <p class="mt-1 text-sm text-gray-900">
                      {{ color.pretty['Dulux Code'] || $t('current_data.na') }}
                    </p>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="text-sm font-medium text-gray-700">{{ $t('current_data.labels.name') }}</label>
                    <p class="mt-1 text-sm text-gray-900">
                      {{ color.pretty.Name || $t('current_data.na') }}
                    </p>
                  </div>
                  <div>
                    <label class="text-sm font-medium text-gray-700">{{ $t('current_data.labels.short_code') }}</label>
                    <p class="mt-1 text-sm text-gray-900">
                      {{ color.pretty['Short Code'] || $t('current_data.na') }}
                    </p>
                  </div>
                </div>
                <div class="grid grid-cols-1 gap-4">
                  <div>
                    <label class="text-sm font-medium text-gray-700">{{ $t('current_data.labels.years_used') }}</label>
                    <p class="mt-1 text-sm text-gray-900">
                      {{ color.pretty.Years || $t('current_data.na') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Form Card -->
      <div class="lg:col-span-2">
        <UCard>
          <!-- Success Message -->
          <div v-if="submissionSuccess" class="p-6 text-center">
            <div class="mb-4">
              <i class="fas fa-check-circle text-6xl text-success"></i>
            </div>
            <h1 class="text-2xl font-bold mb-2">
              {{ $t('form.success.title') }}
            </h1>
            <h2 class="text-xl mb-6">{{ $t('form.success.subtitle') }}</h2>
            <div class="space-y-4 text-left max-w-md mx-auto">
              <div class="bg-muted p-4 rounded-lg">
                <p class="font-medium">{{ $t('form.success.submission_id') }}{{ submissionId }}</p>
                <p class="text-sm opacity-70">
                  {{ $t('form.success.pending_review') }}
                </p>
              </div>
              <UButton @click="submissionSuccess = false" color="primary" class="w-full">
                {{ $t('form.success.make_another') }}
              </UButton>
            </div>
          </div>

          <!-- Form -->
          <div v-else>
            <div class="flex items-center bg-primary text-primary-content -m-4 mb-4 p-4 rounded-t-lg">
              <i class="fas fa-sparkles mr-2"></i>
              <h2 class="text-lg font-semibold">{{ $t('form.title') }}</h2>
            </div>

            <div class="p-2">
              <!-- Error Alert -->
              <UAlert v-if="apiError" color="warning" class="mb-6">
                <template #icon>
                  <i class="fas fa-exclamation-triangle"></i>
                </template>
                <template #title>{{ $t('form.error.title') }}</template>
                <template #description>
                  {{ apiMessage || $t('form.error.default_message') }}
                </template>
              </UAlert>

              <!-- Form Fields -->
              <form @submit.prevent="submit" class="space-y-4">
                <!-- Submitter Information -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField :label="`${$t('form.fields.submitted_by.label')} *`">
                    <UInput
                      id="submittedBy"
                      type="text"
                      v-model="formData.submittedBy"
                      :placeholder="$t('form.fields.submitted_by.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      required
                      icon="i-fa6-solid-user"
                    />
                  </UFormField>

                  <UFormField :label="`${$t('form.fields.submitted_by_email.label')} *`">
                    <UInput
                      id="submittedByEmail"
                      type="email"
                      v-model="formData.submittedByEmail"
                      :placeholder="$t('form.fields.submitted_by_email.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      required
                      icon="i-fa6-solid-envelope"
                    />
                  </UFormField>
                </div>

                <USeparator />

                <!-- Color Information -->
                <UFormField :label="`${$t('form.fields.color_name.label')} *`">
                  <UInput
                    id="colorName"
                    type="text"
                    v-model="formData.name"
                    :placeholder="$t('form.fields.color_name.placeholder')"
                    class="w-full"
                    maxlength="30"
                    required
                    icon="i-fa6-solid-id-card"
                  />
                </UFormField>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField :label="$t('form.fields.primary_code.label')">
                    <UInput
                      id="code"
                      v-model="formData.code"
                      type="text"
                      :placeholder="$t('form.fields.primary_code.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      required
                      icon="i-fa6-solid-code"
                    />
                  </UFormField>

                  <UFormField :label="$t('form.fields.short_code.label')">
                    <UInput
                      id="shortCode"
                      v-model="formData.shortCode"
                      type="text"
                      :placeholder="$t('form.fields.short_code.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      icon="i-fa6-solid-code"
                    />
                  </UFormField>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField :label="$t('form.fields.ditzler_ppg_code.label')">
                    <UInput
                      id="ditzlerPpgCode"
                      v-model="formData.ditzlerPpgCode"
                      type="text"
                      :placeholder="$t('form.fields.ditzler_ppg_code.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      icon="i-fa6-solid-code"
                    />
                  </UFormField>

                  <UFormField :label="$t('form.fields.dulux_code.label')">
                    <UInput
                      id="duluxCode"
                      v-model="formData.duluxCode"
                      type="text"
                      :placeholder="$t('form.fields.dulux_code.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      icon="i-fa6-solid-code"
                    />
                  </UFormField>
                </div>

                <UFormField :label="$t('form.fields.years_used.label')">
                  <UInput
                    id="years"
                    v-model="formData.years"
                    type="text"
                    :placeholder="$t('form.fields.years_used.placeholder')"
                    class="w-full"
                    :disabled="processing"
                    icon="i-fa6-solid-calendar-days"
                  />
                </UFormField>

                <UFormField :label="$t('form.fields.image_swatch.label')" :help="$t('form.fields.image_swatch.help')">
                  <UInput
                    id="imageSwatch"
                    v-model="formData.imageSwatch"
                    type="text"
                    :placeholder="$t('form.fields.image_swatch.placeholder')"
                    class="w-full"
                    :disabled="processing"
                    icon="i-fa6-solid-image"
                  />
                </UFormField>

                <div class="pt-4">
                  <UButton type="submit" color="primary" class="w-full" :disabled="processing" :loading="processing">
                    {{ processing ? $t('form.submit.submitting') : $t('form.submit.button') }}
                  </UButton>
                </div>
              </form>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .filler-image {
    img,
    source {
      max-width: 200px;
      max-height: 200px;
    }
  }

  .badge-soft {
    background-color: rgba(0, 0, 0, 0.2);
    color: rgba(0, 0, 0, 0.7);
  }
</style>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Archive - Contribute Color",
    "description": "Contribute a new color to the Classic Mini color archive",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Contribute Color",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archive",
      "colors": "Colors",
      "contribute": "Contribute"
    },
    "main_heading": "Contribute Color",
    "description_text": "Help us expand the Classic Mini color archive by contributing a new color. Please provide as much detail as possible to help other enthusiasts. Your submission will be reviewed by an administrator before being added to the database.",
    "form": {
      "title": "Submit Color Contribution",
      "color_name": "Color Name",
      "color_code": "Color Code",
      "year_range": "Year Range",
      "manufacturer": "Manufacturer",
      "hex_color": "Hex Color",
      "description": "Description",
      "source": "Source",
      "submit": {
        "button": "Submit Color",
        "submitting": "Submitting..."
      },
      "cancel": "Cancel",
      "fields": {
        "submitted_by": {
          "label": "Your Name",
          "placeholder": "Enter your name"
        },
        "submitted_by_email": {
          "label": "Your Email",
          "placeholder": "Enter your email address"
        },
        "color_name": {
          "label": "Color Name",
          "placeholder": "Enter color name"
        },
        "primary_code": {
          "label": "Primary Code",
          "placeholder": "Enter primary code"
        },
        "short_code": {
          "label": "Short Code",
          "placeholder": "Enter short code"
        },
        "ditzler_ppg_code": {
          "label": "Ditzler/PPG Code",
          "placeholder": "Enter Ditzler/PPG code"
        },
        "dulux_code": {
          "label": "Dulux Code",
          "placeholder": "Enter Dulux code"
        },
        "years_used": {
          "label": "Years Used",
          "placeholder": "e.g., 1959-1967"
        },
        "image_swatch": {
          "label": "Image Swatch URL",
          "placeholder": "Enter URL to color swatch image",
          "help": "Optional: URL to an image showing this color"
        }
      },
      "success": {
        "title": "Submission Received!",
        "subtitle": "Thank you for your contribution",
        "submission_id": "Submission ID: ",
        "pending_review": "Your submission is pending review by an administrator. Once approved, it will appear in the color database.",
        "make_another": "Make Another Contribution"
      },
      "error": {
        "title": "Submission Error",
        "default_message": "There was an error submitting your contribution. Please try again.",
        "submitter_required": "Please enter your name and email address.",
        "invalid_email": "Please enter a valid email address.",
        "name_code_required": "Color name and code are required.",
        "submission_failed": "Failed to submit your contribution. Please try again."
      }
    },
    "current_data": {
      "title": "Current Color Data",
      "loading": "Loading color data...",
      "na": "N/A",
      "labels": {
        "primary_color": "Primary Color",
        "code": "Code",
        "ditzler_ppg_code": "Ditzler/PPG Code",
        "dulux_code": "Dulux Code",
        "name": "Name",
        "short_code": "Short Code",
        "years_used": "Years Used"
      }
    },
    "validation": {
      "color_name_required": "Color name is required",
      "color_code_required": "Color code is required",
      "year_range_required": "Year range is required",
      "hex_color_required": "Hex color is required",
      "hex_color_invalid": "Please enter a valid hex color (e.g., #FF0000)"
    },
    "messages": {
      "success": "Color submitted successfully! Thank you for your contribution.",
      "error": "There was an error submitting your color. Please try again."
    },
    "seo": {
      "og_title": "Classic Mini Archive - Contribute Color",
      "og_description": "Contribute a new color to the Classic Mini color archive",
      "twitter_title": "Classic Mini Archive - Contribute Color",
      "twitter_description": "Contribute a new color to the Classic Mini color archive"
    }
  },
  "de": {
    "title": "Classic Mini Archiv - Farbe Beitragen",
    "description": "Tragen Sie eine neue Farbe zum Classic Mini Farbarchiv bei",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Farbe Beitragen",
    "breadcrumb": {
      "home": "Startseite",
      "archive": "Archiv",
      "colors": "Farben",
      "contribute": "Beitragen"
    },
    "main_heading": "Farbe Beitragen",
    "description_text": "Helfen Sie uns, das Classic Mini Farbarchiv zu erweitern, indem Sie eine neue Farbe beitragen. Bitte geben Sie so viele Details wie möglich an, um anderen Enthusiasten zu helfen.",
    "form": {
      "color_name": "Farbname",
      "color_code": "Farbcode",
      "year_range": "Jahresbereich",
      "manufacturer": "Hersteller",
      "hex_color": "Hex-Farbe",
      "description": "Beschreibung",
      "source": "Quelle",
      "submit": "Farbe Einreichen",
      "cancel": "Abbrechen"
    },
    "validation": {
      "color_name_required": "Farbname ist erforderlich",
      "color_code_required": "Farbcode ist erforderlich",
      "year_range_required": "Jahresbereich ist erforderlich",
      "hex_color_required": "Hex-Farbe ist erforderlich",
      "hex_color_invalid": "Bitte geben Sie eine gültige Hex-Farbe ein (z.B. #FF0000)"
    },
    "messages": {
      "success": "Farbe erfolgreich eingereicht! Vielen Dank für Ihren Beitrag.",
      "error": "Es gab einen Fehler beim Einreichen Ihrer Farbe. Bitte versuchen Sie es erneut."
    },
    "seo": {
      "og_title": "Classic Mini Archiv - Farbe Beitragen",
      "og_description": "Tragen Sie eine neue Farbe zum Classic Mini Farbarchiv bei",
      "twitter_title": "Classic Mini Archiv - Farbe Beitragen",
      "twitter_description": "Tragen Sie eine neue Farbe zum Classic Mini Farbarchiv bei"
    }
  },
  "es": {
    "title": "Archivo Classic Mini - Contribuir Color",
    "description": "Contribuye con un nuevo color al archivo de colores Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Contribuir Color",
    "breadcrumb": {
      "home": "Inicio",
      "archive": "Archivo",
      "colors": "Colores",
      "contribute": "Contribuir"
    },
    "main_heading": "Contribuir Color",
    "description_text": "Ayúdanos a expandir el archivo de colores Classic Mini contribuyendo con un nuevo color. Por favor proporciona tantos detalles como sea posible para ayudar a otros entusiastas.",
    "form": {
      "color_name": "Nombre del Color",
      "color_code": "Código de Color",
      "year_range": "Rango de Años",
      "manufacturer": "Fabricante",
      "hex_color": "Color Hexadecimal",
      "description": "Descripción",
      "source": "Fuente",
      "submit": "Enviar Color",
      "cancel": "Cancelar"
    },
    "validation": {
      "color_name_required": "El nombre del color es requerido",
      "color_code_required": "El código de color es requerido",
      "year_range_required": "El rango de años es requerido",
      "hex_color_required": "El color hexadecimal es requerido",
      "hex_color_invalid": "Por favor ingresa un color hexadecimal válido (ej. #FF0000)"
    },
    "messages": {
      "success": "¡Color enviado exitosamente! Gracias por tu contribución.",
      "error": "Hubo un error al enviar tu color. Por favor intenta de nuevo."
    },
    "seo": {
      "og_title": "Archivo Classic Mini - Contribuir Color",
      "og_description": "Contribuye con un nuevo color al archivo de colores Classic Mini",
      "twitter_title": "Archivo Classic Mini - Contribuir Color",
      "twitter_description": "Contribuye con un nuevo color al archivo de colores Classic Mini"
    }
  },
  "fr": {
    "title": "Archives Classic Mini - Contribuer Couleur",
    "description": "Contribuez avec une nouvelle couleur aux archives de couleurs Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Contribuer Couleur",
    "breadcrumb": {
      "home": "Accueil",
      "archive": "Archive",
      "colors": "Couleurs",
      "contribute": "Contribuer"
    },
    "main_heading": "Contribuer Couleur",
    "description_text": "Aidez-nous à élargir les archives de couleurs Classic Mini en contribuant une nouvelle couleur. Veuillez fournir autant de détails que possible pour aider d'autres passionnés.",
    "form": {
      "color_name": "Nom de la Couleur",
      "color_code": "Code Couleur",
      "year_range": "Plage d'Années",
      "manufacturer": "Fabricant",
      "hex_color": "Couleur Hexadécimale",
      "description": "Description",
      "source": "Source",
      "submit": "Soumettre la Couleur",
      "cancel": "Annuler"
    },
    "validation": {
      "color_name_required": "Le nom de la couleur est requis",
      "color_code_required": "Le code couleur est requis",
      "year_range_required": "La plage d'années est requise",
      "hex_color_required": "La couleur hexadécimale est requise",
      "hex_color_invalid": "Veuillez entrer une couleur hexadécimale valide (ex. #FF0000)"
    },
    "messages": {
      "success": "Couleur soumise avec succès ! Merci pour votre contribution.",
      "error": "Il y a eu une erreur lors de la soumission de votre couleur. Veuillez réessayer."
    },
    "seo": {
      "og_title": "Archives Classic Mini - Contribuer Couleur",
      "og_description": "Contribuez avec une nouvelle couleur aux archives de couleurs Classic Mini",
      "twitter_title": "Archives Classic Mini - Contribuer Couleur",
      "twitter_description": "Contribuez avec une nouvelle couleur aux archives de couleurs Classic Mini"
    }
  },
  "it": {
    "title": "Archivio Classic Mini - Contribuisci Colore",
    "description": "Contribuisci con un nuovo colore all'archivio colori Classic Mini",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Contribuisci Colore",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archivio",
      "colors": "Colori",
      "contribute": "Contribuisci"
    },
    "main_heading": "Contribuisci Colore",
    "description_text": "Aiutaci ad espandere l'archivio colori Classic Mini contribuendo con un nuovo colore. Fornisci quanti più dettagli possibili per aiutare altri appassionati.",
    "form": {
      "color_name": "Nome Colore",
      "color_code": "Codice Colore",
      "year_range": "Intervallo Anni",
      "manufacturer": "Produttore",
      "hex_color": "Colore Esadecimale",
      "description": "Descrizione",
      "source": "Fonte",
      "submit": "Invia Colore",
      "cancel": "Annulla"
    },
    "validation": {
      "color_name_required": "Il nome del colore è richiesto",
      "color_code_required": "Il codice colore è richiesto",
      "year_range_required": "L'intervallo anni è richiesto",
      "hex_color_required": "Il colore esadecimale è richiesto",
      "hex_color_invalid": "Inserisci un colore esadecimale valido (es. #FF0000)"
    },
    "messages": {
      "success": "Colore inviato con successo! Grazie per il tuo contributo.",
      "error": "C'è stato un errore nell'invio del tuo colore. Riprova."
    },
    "seo": {
      "og_title": "Archivio Classic Mini - Contribuisci Colore",
      "og_description": "Contribuisci con un nuovo colore all'archivio colori Classic Mini",
      "twitter_title": "Archivio Classic Mini - Contribuisci Colore",
      "twitter_description": "Contribuisci con un nuovo colore all'archivio colori Classic Mini"
    }
  },
  "pt": {
    "title": "Arquivo Classic Mini - Contribuir Cor",
    "description": "Contribua com uma nova cor para o arquivo de cores Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Contribuir Cor",
    "breadcrumb": {
      "home": "Início",
      "archive": "Arquivo",
      "colors": "Cores",
      "contribute": "Contribuir"
    },
    "main_heading": "Contribuir Cor",
    "description_text": "Ajude-nos a expandir o arquivo de cores Classic Mini contribuindo com uma nova cor. Forneça o máximo de detalhes possível para ajudar outros entusiastas.",
    "form": {
      "color_name": "Nome da Cor",
      "color_code": "Código da Cor",
      "year_range": "Faixa de Anos",
      "manufacturer": "Fabricante",
      "hex_color": "Cor Hexadecimal",
      "description": "Descrição",
      "source": "Fonte",
      "submit": "Enviar Cor",
      "cancel": "Cancelar"
    },
    "validation": {
      "color_name_required": "O nome da cor é obrigatório",
      "color_code_required": "O código da cor é obrigatório",
      "year_range_required": "A faixa de anos é obrigatória",
      "hex_color_required": "A cor hexadecimal é obrigatória",
      "hex_color_invalid": "Por favor insira uma cor hexadecimal válida (ex. #FF0000)"
    },
    "messages": {
      "success": "Cor enviada com sucesso! Obrigado pela sua contribuição.",
      "error": "Houve um erro ao enviar sua cor. Tente novamente."
    },
    "seo": {
      "og_title": "Arquivo Classic Mini - Contribuir Cor",
      "og_description": "Contribua com uma nova cor para o arquivo de cores Classic Mini",
      "twitter_title": "Arquivo Classic Mini - Contribuir Cor",
      "twitter_description": "Contribua com uma nova cor para o arquivo de cores Classic Mini"
    }
  },
  "nl": {
    "title": "Classic Mini Archief - Kleur Bijdragen",
    "description": "Draag een nieuwe kleur bij aan het Classic Mini kleurenarchief",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Kleur Bijdragen",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archief",
      "colors": "Kleuren",
      "contribute": "Bijdragen"
    },
    "main_heading": "Kleur Bijdragen",
    "description_text": "Help ons het Classic Mini kleurenarchief uit te breiden door een nieuwe kleur bij te dragen. Verstrek zoveel mogelijk details om andere liefhebbers te helpen.",
    "form": {
      "color_name": "Kleurnaam",
      "color_code": "Kleurcode",
      "year_range": "Jaarbereik",
      "manufacturer": "Fabrikant",
      "hex_color": "Hex Kleur",
      "description": "Beschrijving",
      "source": "Bron",
      "submit": "Kleur Indienen",
      "cancel": "Annuleren"
    },
    "validation": {
      "color_name_required": "Kleurnaam is vereist",
      "color_code_required": "Kleurcode is vereist",
      "year_range_required": "Jaarbereik is vereist",
      "hex_color_required": "Hex kleur is vereist",
      "hex_color_invalid": "Voer een geldige hex kleur in (bijv. #FF0000)"
    },
    "messages": {
      "success": "Kleur succesvol ingediend! Bedankt voor je bijdrage.",
      "error": "Er was een fout bij het indienen van je kleur. Probeer het opnieuw."
    },
    "seo": {
      "og_title": "Classic Mini Archief - Kleur Bijdragen",
      "og_description": "Draag een nieuwe kleur bij aan het Classic Mini kleurenarchief",
      "twitter_title": "Classic Mini Archief - Kleur Bijdragen",
      "twitter_description": "Draag een nieuwe kleur bij aan het Classic Mini kleurenarchief"
    }
  },
  "sv": {
    "title": "Classic Mini Arkiv - Bidra Färg",
    "description": "Bidra med en ny färg till Classic Mini färgarkivet",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Bidra Färg",
    "breadcrumb": {
      "home": "Hem",
      "archive": "Arkiv",
      "colors": "Färger",
      "contribute": "Bidra"
    },
    "main_heading": "Bidra Färg",
    "description_text": "Hjälp oss att utöka Classic Mini färgarkivet genom att bidra med en ny färg. Vänligen ge så mycket detaljer som möjligt för att hjälpa andra entusiaster.",
    "form": {
      "color_name": "Färgnamn",
      "color_code": "Färgkod",
      "year_range": "Årsintervall",
      "manufacturer": "Tillverkare",
      "hex_color": "Hex Färg",
      "description": "Beskrivning",
      "source": "Källa",
      "submit": "Skicka Färg",
      "cancel": "Avbryt"
    },
    "validation": {
      "color_name_required": "Färgnamn krävs",
      "color_code_required": "Färgkod krävs",
      "year_range_required": "Årsintervall krävs",
      "hex_color_required": "Hex färg krävs",
      "hex_color_invalid": "Vänligen ange en giltig hex färg (t.ex. #FF0000)"
    },
    "messages": {
      "success": "Färg skickad framgångsrikt! Tack för ditt bidrag.",
      "error": "Det uppstod ett fel när din färg skickades. Försök igen."
    },
    "seo": {
      "og_title": "Classic Mini Arkiv - Bidra Färg",
      "og_description": "Bidra med en ny färg till Classic Mini färgarkivet",
      "twitter_title": "Classic Mini Arkiv - Bidra Färg",
      "twitter_description": "Bidra med en ny färg till Classic Mini färgarkivet"
    }
  },
  "da": {
    "title": "Classic Mini Arkiv - Bidrag Farve",
    "description": "Bidrag med en ny farve til Classic Mini farvearkivet",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Bidrag Farve",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "colors": "Farver",
      "contribute": "Bidrag"
    },
    "main_heading": "Bidrag Farve",
    "description_text": "Hjælp os med at udvide Classic Mini farvearkivet ved at bidrage med en ny farve. Venligst giv så mange detaljer som muligt for at hjælpe andre entusiaster.",
    "form": {
      "color_name": "Farvenavn",
      "color_code": "Farvekode",
      "year_range": "Årsinterval",
      "manufacturer": "Producent",
      "hex_color": "Hex Farve",
      "description": "Beskrivelse",
      "source": "Kilde",
      "submit": "Indsend Farve",
      "cancel": "Annuller"
    },
    "validation": {
      "color_name_required": "Farvenavn er påkrævet",
      "color_code_required": "Farvekode er påkrævet",
      "year_range_required": "Årsinterval er påkrævet",
      "hex_color_required": "Hex farve er påkrævet",
      "hex_color_invalid": "Venligst indtast en gyldig hex farve (f.eks. #FF0000)"
    },
    "messages": {
      "success": "Farve indsendt med succes! Tak for dit bidrag.",
      "error": "Der opstod en fejl ved indsendelse af din farve. Prøv igen."
    },
    "seo": {
      "og_title": "Classic Mini Arkiv - Bidrag Farve",
      "og_description": "Bidrag med en ny farve til Classic Mini farvearkivet",
      "twitter_title": "Classic Mini Arkiv - Bidrag Farve",
      "twitter_description": "Bidrag med en ny farve til Classic Mini farvearkivet"
    }
  },
  "no": {
    "title": "Classic Mini Arkiv - Bidra Farge",
    "description": "Bidra med en ny farge til Classic Mini fargearkivet",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Bidra Farge",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "colors": "Farger",
      "contribute": "Bidra"
    },
    "main_heading": "Bidra Farge",
    "description_text": "Hjelp oss å utvide Classic Mini fargearkivet ved å bidra med en ny farge. Vennligst gi så mange detaljer som mulig for å hjelpe andre entusiaster.",
    "form": {
      "color_name": "Fargenavn",
      "color_code": "Fargekode",
      "year_range": "Årsperiode",
      "manufacturer": "Produsent",
      "hex_color": "Hex Farge",
      "description": "Beskrivelse",
      "source": "Kilde",
      "submit": "Send inn Farge",
      "cancel": "Avbryt"
    },
    "validation": {
      "color_name_required": "Fargenavn er påkrevd",
      "color_code_required": "Fargekode er påkrevd",
      "year_range_required": "Årsperiode er påkrevd",
      "hex_color_required": "Hex farge er påkrevd",
      "hex_color_invalid": "Vennligst skriv inn en gyldig hex farge (f.eks. #FF0000)"
    },
    "messages": {
      "success": "Farge sendt inn med suksess! Takk for ditt bidrag.",
      "error": "Det oppstod en feil ved innsending av fargen din. Prøv igjen."
    },
    "seo": {
      "og_title": "Classic Mini Arkiv - Bidra Farge",
      "og_description": "Bidra med en ny farge til Classic Mini fargearkivet",
      "twitter_title": "Classic Mini Arkiv - Bidra Farge",
      "twitter_description": "Bidra med en ny farge til Classic Mini fargearkivet"
    }
  }
}
</i18n>
