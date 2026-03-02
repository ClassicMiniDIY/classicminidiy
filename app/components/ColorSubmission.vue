<script lang="ts" setup>
  import type { Color, ColorQueueItem, ColorQueueSubmissionResponse } from '../../data/models/colors';

  const { t } = useI18n();

  interface TouchedFields {
    submittedBy: boolean;
    submittedByEmail: boolean;
    name: boolean;
    [key: string]: boolean;
  }

  interface DuplicateCheckResponse {
    hasDuplicates: boolean;
    matches: Color[];
  }

  const touchedFields = ref<TouchedFields>({
    submittedBy: false,
    submittedByEmail: false,
    name: false,
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

  const initialDetails: Partial<ColorQueueItem> = {
    name: '',
    code: '',
    shortCode: '',
    ditzlerPpgCode: '',
    duluxCode: '',
    years: '',
    primaryColor: '',
    submittedBy: '',
    submittedByEmail: '',
  };

  const details = ref({ ...initialDetails });
  const submissionSuccess = ref(false);
  const apiError = ref(false);
  const apiMessage = ref('');
  const submissionId = ref('');
  const processing = ref(false);

  // Duplicate detection state
  const duplicateMatches = ref<Color[]>([]);
  const showDuplicateWarning = ref(false);
  const checkingDuplicates = ref(false);
  const confirmedNoDuplicate = ref(false);

  function validateForm() {
    const requiredFields = [
      details.value.submittedBy,
      details.value.submittedByEmail && rules.value.email(details.value.submittedByEmail) === true,
      details.value.name,
    ];

    return requiredFields.every((field) => !!field);
  }

  // Check for duplicate colors
  async function checkForDuplicates(): Promise<boolean> {
    if (!details.value.name) return false;

    checkingDuplicates.value = true;
    try {
      const { data, error } = await useFetch<DuplicateCheckResponse>('/api/colors/queue/check-duplicate', {
        method: 'POST',
        body: {
          name: details.value.name,
          code: details.value.code,
        },
      });

      if (error.value) {
        // Log but don't block submission if duplicate check fails
        console.error('Error checking duplicates:', error.value);
        return false;
      }

      if (data.value?.hasDuplicates) {
        duplicateMatches.value = data.value.matches;
        showDuplicateWarning.value = true;
        return true;
      }
      return false;
    } catch (error) {
      // Network or unexpected errors - don't block submission
      console.error('Unexpected error checking duplicates:', error);
      return false;
    } finally {
      checkingDuplicates.value = false;
    }
  }

  async function submit() {
    // Mark all fields as touched when submitting
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = true;
    });

    if (!validateForm()) {
      return;
    }

    // Check for duplicates first (unless user has confirmed)
    if (!confirmedNoDuplicate.value) {
      const hasDuplicates = await checkForDuplicates();
      if (hasDuplicates) {
        return; // Show duplicate warning, don't submit yet
      }
    }

    processing.value = true;
    try {
      const colorDetails: Partial<ColorQueueItem> = {
        ...details.value,
        hasSwatch: false,
      };

      const { data, error } = await useFetch<ColorQueueSubmissionResponse>('/api/colors/queue/submit', {
        method: 'POST',
        body: { details: colorDetails },
      });

      if (error.value) {
        submissionSuccess.value = false;
        apiError.value = true;
        const errorData = error.value.data as { statusMessage?: string } | undefined;
        apiMessage.value = errorData?.statusMessage || error.value.message || t('error.api_unavailable');
        return;
      }

      if (data.value?.uuid) {
        submissionSuccess.value = true;
        submissionId.value = data.value.uuid;
        resetForm();
      } else {
        submissionSuccess.value = false;
        apiError.value = true;
        apiMessage.value = t('error.api_unavailable');
      }
    } catch (error: any) {
      submissionSuccess.value = false;
      apiError.value = true;
      apiMessage.value = error?.message || t('error.api_unavailable');
    } finally {
      processing.value = false;
    }
  }

  function proceedWithSubmission() {
    confirmedNoDuplicate.value = true;
    showDuplicateWarning.value = false;
    submit();
  }

  function cancelDuplicateSubmission() {
    showDuplicateWarning.value = false;
    duplicateMatches.value = [];
  }

  function editExistingColor(colorId: string) {
    showDuplicateWarning.value = false;
    navigateTo(`/contribute/color?color=${colorId}`);
  }

  function resetForm() {
    details.value = { ...initialDetails };
    confirmedNoDuplicate.value = false;
    duplicateMatches.value = [];
    // Reset touched state when form is reset
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = false;
    });
  }

  function submitAnotherColor() {
    submissionSuccess.value = false;
    apiError.value = false;
    submissionId.value = '';
  }
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-lg">{{ t('title') }}</h2>
    </template>

    <!-- Success State -->
    <div v-if="!processing && submissionSuccess && !apiError">
      <div class="text-center py-5">
        <i class="text-4xl text-success fa-duotone fa-box-check fa-beat py-5"></i>
        <h1 class="text-2xl font-bold mb-1">{{ t('success.thank_you') }}</h1>
        <h2 class="text-lg mb-4">
          {{ t('success.submitted_message') }}
        </h2>
        <div class="bg-muted p-4 rounded-lg mb-5 max-w-md mx-auto">
          <p class="font-medium">{{ t('success.submission_id') }} {{ submissionId }}</p>
          <p class="text-sm text-muted">{{ t('success.pending_review') }}</p>
        </div>
        <UButton color="primary" @click="submitAnotherColor()">
          <i class="fa-duotone fa-solid fa-plus-large mr-2"></i>
          {{ t('success.submit_another') }}
        </UButton>
      </div>
    </div>

    <!-- Duplicate Warning Modal -->
    <UModal v-model:open="showDuplicateWarning" :ui="{ width: 'max-w-2xl' }">
      <template #content>
        <div class="p-6">
          <h3 class="font-bold text-lg flex items-center gap-2 mb-4">
            <i class="fas fa-exclamation-triangle text-warning"></i>
            {{ t('duplicate.title') }}
          </h3>
          <p class="mb-4">{{ t('duplicate.message') }}</p>

          <div class="space-y-3 max-h-60 overflow-y-auto">
            <div
              v-for="match in duplicateMatches"
              :key="match.id"
              class="bg-muted p-4 rounded-lg flex justify-between items-center"
            >
              <div>
                <p class="font-medium">{{ match.name }}</p>
                <p class="text-sm text-muted">
                  {{ t('duplicate.code') }}: {{ match.code }}
                  <span v-if="match.shortCode"> | {{ t('duplicate.short_code') }}: {{ match.shortCode }}</span>
                </p>
              </div>
              <UButton size="sm" color="info" @click="editExistingColor(match.id)">
                <i class="fas fa-edit mr-1"></i>
                {{ t('duplicate.edit_existing') }}
              </UButton>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <UButton variant="outline" @click="cancelDuplicateSubmission">{{ t('duplicate.cancel') }}</UButton>
            <UButton color="warning" @click="proceedWithSubmission">
              <i class="fas fa-plus mr-2"></i>
              {{ t('duplicate.submit_anyway') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Form -->
    <div v-if="!submissionSuccess">
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
                (details.submittedByEmail === '' || rules.email(details.submittedByEmail) !== true) &&
                touchedFields.submittedByEmail
                  ? 'error'
                  : undefined
              "
              required
              @blur="touchedFields.submittedByEmail = true"
            />
            <p
              v-if="
                (details.submittedByEmail === '' || rules.email(details.submittedByEmail) !== true) &&
                touchedFields.submittedByEmail
              "
              class="text-sm text-error mt-1"
            >
              {{ details.submittedByEmail === '' ? t('validation.required') : t('validation.invalid_email') }}
            </p>
          </div>

          <!-- Color Details Section -->
          <div class="col-span-1 md:col-span-2">
            <h2 class="text-xl font-bold">{{ t('sections.color_details') }}</h2>
          </div>

          <!-- Color Name -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium"
                >{{ t('form_labels.color_name') }} <span class="text-error">*</span></span
              >
              <span class="text-sm text-muted"><i class="fad fa-palette"></i></span>
            </label>
            <UInput
              type="text"
              :placeholder="t('placeholders.color_name')"
              v-model="details.name"
              :color="details.name === '' && touchedFields.name ? 'error' : undefined"
              required
              @blur="touchedFields.name = true"
            />
            <p v-if="details.name === '' && touchedFields.name" class="text-sm text-error mt-1">
              {{ t('validation.required') }}
            </p>
          </div>

          <!-- BMC Code -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium">{{ t('form_labels.bmc_code') }}</span>
              <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
            </label>
            <UInput type="text" :placeholder="t('placeholders.bmc_code')" v-model="details.code" />
          </div>

          <!-- Short Code -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium">{{ t('form_labels.short_code') }}</span>
              <span class="text-sm text-muted"><i class="fad fa-tag"></i></span>
            </label>
            <UInput type="text" :placeholder="t('placeholders.short_code')" v-model="details.shortCode" />
          </div>

          <!-- Ditzler/PPG Code -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium">{{ t('form_labels.ditzler_ppg_code') }}</span>
              <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
            </label>
            <UInput type="text" :placeholder="t('placeholders.ditzler_ppg_code')" v-model="details.ditzlerPpgCode" />
          </div>

          <!-- Dulux Code -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium">{{ t('form_labels.dulux_code') }}</span>
              <span class="text-sm text-muted"><i class="fad fa-hashtag"></i></span>
            </label>
            <UInput type="text" :placeholder="t('placeholders.dulux_code')" v-model="details.duluxCode" />
          </div>

          <!-- Years Used -->
          <div class="w-full">
            <label class="flex justify-between items-center mb-1">
              <span class="text-sm font-medium">{{ t('form_labels.years_used') }}</span>
              <span class="text-sm text-muted"><i class="fad fa-calendar"></i></span>
            </label>
            <UInput type="text" :placeholder="t('placeholders.years_used')" v-model="details.years" />
          </div>
        </div>

        <!-- Error Alert & Submit Button -->
        <div class="mt-6">
          <UAlert v-if="apiError" color="error" class="mb-4">
            <template #icon>
              <i class="fa-duotone fa-circle-exclamation"></i>
            </template>
            <template #title>{{ t('error.title') }}</template>
            <template #description>{{ apiMessage || t('error.message') }}</template>
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
            :disabled="!validateForm() || processing || checkingDuplicates"
            :loading="processing || checkingDuplicates"
          >
            <i class="fad fa-paper-plane mr-2" v-if="!processing && !checkingDuplicates"></i>
            {{ checkingDuplicates ? t('checking_duplicates') : t('submit_button') }}
          </UButton>
        </div>
      </form>
    </div>
  </UCard>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Submit a New Color",
    "success": {
      "thank_you": "Thank you!",
      "submitted_message": "Your color submission has been received. Please allow 1-2 days for review.",
      "submission_id": "Submission ID:",
      "pending_review": "Your submission is pending review by an administrator. Once approved, it will appear in the color database.",
      "submit_another": "Submit Another Color"
    },
    "validation": {
      "required": "This field is required",
      "invalid_email": "Invalid email address"
    },
    "sections": {
      "personal_info": "Your Information",
      "color_details": "Color Details"
    },
    "form_labels": {
      "your_name": "Your Name",
      "your_email": "Your Email",
      "color_name": "Color Name",
      "bmc_code": "BMC Code",
      "short_code": "Short Code",
      "ditzler_ppg_code": "Ditzler/PPG Code",
      "dulux_code": "Dulux Code",
      "years_used": "Years Used"
    },
    "placeholders": {
      "name": "e.g. John Smith",
      "email": "e.g. john{'@'}example.com",
      "color_name": "e.g. Clipper Blue",
      "bmc_code": "e.g. GR29",
      "short_code": "e.g. BLVC47",
      "ditzler_ppg_code": "e.g. 2706",
      "dulux_code": "e.g. 23-3632",
      "years_used": "e.g. 1959-1967"
    },
    "duplicate": {
      "title": "Possible Duplicate Found",
      "message": "We found one or more existing colors that may match your submission. Please review the matches below and either edit the existing color or confirm your submission is a new color.",
      "code": "Code",
      "short_code": "Short Code",
      "edit_existing": "Edit This",
      "cancel": "Cancel",
      "submit_anyway": "Submit as New Color"
    },
    "error": {
      "title": "Submission Error",
      "message": "There was a problem submitting your color. Please try again later.",
      "dismiss": "Dismiss",
      "api_unavailable": "API is currently unavailable. Please try again later."
    },
    "checking_duplicates": "Checking for duplicates...",
    "submit_button": "Submit Color"
  },
  "de": {
    "title": "Eine neue Farbe einreichen",
    "success": {
      "thank_you": "Vielen Dank!",
      "submitted_message": "Ihre Farbeinreichung wurde erhalten. Bitte rechnen Sie mit 1-2 Tagen für die Überprüfung.",
      "submission_id": "Einreichungs-ID:",
      "pending_review": "Ihre Einreichung wartet auf die Überprüfung durch einen Administrator. Nach der Genehmigung erscheint sie in der Farbdatenbank.",
      "submit_another": "Eine weitere Farbe einreichen"
    },
    "validation": {
      "required": "Dieses Feld ist erforderlich",
      "invalid_email": "Ungültige E-Mail-Adresse"
    },
    "sections": {
      "personal_info": "Ihre Informationen",
      "color_details": "Farbdetails"
    },
    "form_labels": {
      "your_name": "Ihr Name",
      "your_email": "Ihre E-Mail",
      "color_name": "Farbname",
      "bmc_code": "BMC-Code",
      "short_code": "Kurzcode",
      "ditzler_ppg_code": "Ditzler/PPG-Code",
      "dulux_code": "Dulux-Code",
      "years_used": "Verwendete Jahre"
    },
    "placeholders": {
      "name": "z.B. Max Mustermann",
      "email": "z.B. max{'@'}beispiel.de",
      "color_name": "z.B. Clipper Blau",
      "bmc_code": "z.B. GR29",
      "short_code": "z.B. BLVC47",
      "ditzler_ppg_code": "z.B. 2706",
      "dulux_code": "z.B. 23-3632",
      "years_used": "z.B. 1959-1967"
    },
    "duplicate": {
      "title": "Mögliches Duplikat gefunden",
      "message": "Wir haben eine oder mehrere vorhandene Farben gefunden, die Ihrer Einreichung entsprechen könnten. Überprüfen Sie bitte die Übereinstimmungen unten und bearbeiten Sie entweder die vorhandene Farbe oder bestätigen Sie, dass Ihre Einreichung eine neue Farbe ist.",
      "code": "Code",
      "short_code": "Kurzcode",
      "edit_existing": "Diese bearbeiten",
      "cancel": "Abbrechen",
      "submit_anyway": "Als neue Farbe einreichen"
    },
    "error": {
      "title": "Einreichungsfehler",
      "message": "Es gab ein Problem bei der Einreichung Ihrer Farbe. Bitte versuchen Sie es später erneut.",
      "dismiss": "Schließen",
      "api_unavailable": "API ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut."
    },
    "checking_duplicates": "Überprüfe auf Duplikate...",
    "submit_button": "Farbe einreichen"
  },
  "es": {
    "title": "Enviar un nuevo color",
    "success": {
      "thank_you": "¡Gracias!",
      "submitted_message": "Tu envío de color ha sido recibido. Por favor permite 1-2 días para la revisión.",
      "submission_id": "ID de envío:",
      "pending_review": "Tu envío está pendiente de revisión por un administrador. Una vez aprobado, aparecerá en la base de datos de colores.",
      "submit_another": "Enviar otro color"
    },
    "validation": {
      "required": "Este campo es obligatorio",
      "invalid_email": "Dirección de correo inválida"
    },
    "sections": {
      "personal_info": "Tu información",
      "color_details": "Detalles del color"
    },
    "form_labels": {
      "your_name": "Tu nombre",
      "your_email": "Tu correo",
      "color_name": "Nombre del color",
      "bmc_code": "Código BMC",
      "short_code": "Código corto",
      "ditzler_ppg_code": "Código Ditzler/PPG",
      "dulux_code": "Código Dulux",
      "years_used": "Años utilizados"
    },
    "placeholders": {
      "name": "ej. Juan Pérez",
      "email": "ej. juan{'@'}ejemplo.com",
      "color_name": "ej. Azul Clipper",
      "bmc_code": "ej. GR29",
      "short_code": "ej. BLVC47",
      "ditzler_ppg_code": "ej. 2706",
      "dulux_code": "ej. 23-3632",
      "years_used": "ej. 1959-1967"
    },
    "duplicate": {
      "title": "Posible duplicado encontrado",
      "message": "Encontramos uno o más colores existentes que pueden coincidir con tu envío. Por favor revisa las coincidencias a continuación y edita el color existente o confirma que tu envío es un nuevo color.",
      "code": "Código",
      "short_code": "Código corto",
      "edit_existing": "Editar este",
      "cancel": "Cancelar",
      "submit_anyway": "Enviar como nuevo color"
    },
    "error": {
      "title": "Error de envío",
      "message": "Hubo un problema al enviar tu color. Por favor intenta de nuevo más tarde.",
      "dismiss": "Descartar",
      "api_unavailable": "La API no está disponible actualmente. Por favor intenta de nuevo más tarde."
    },
    "checking_duplicates": "Verificando duplicados...",
    "submit_button": "Enviar color"
  },
  "fr": {
    "title": "Soumettre une nouvelle couleur",
    "success": {
      "thank_you": "Merci !",
      "submitted_message": "Votre soumission de couleur a été reçue. Veuillez prévoir 1-2 jours pour l'examen.",
      "submission_id": "ID de soumission :",
      "pending_review": "Votre soumission est en attente d'examen par un administrateur. Une fois approuvée, elle apparaîtra dans la base de données des couleurs.",
      "submit_another": "Soumettre une autre couleur"
    },
    "validation": {
      "required": "Ce champ est requis",
      "invalid_email": "Adresse e-mail invalide"
    },
    "sections": {
      "personal_info": "Vos informations",
      "color_details": "Détails de la couleur"
    },
    "form_labels": {
      "your_name": "Votre nom",
      "your_email": "Votre e-mail",
      "color_name": "Nom de la couleur",
      "bmc_code": "Code BMC",
      "short_code": "Code court",
      "ditzler_ppg_code": "Code Ditzler/PPG",
      "dulux_code": "Code Dulux",
      "years_used": "Années d'utilisation"
    },
    "placeholders": {
      "name": "ex. Jean Dupont",
      "email": "ex. jean{'@'}exemple.com",
      "color_name": "ex. Bleu Clipper",
      "bmc_code": "ex. GR29",
      "short_code": "ex. BLVC47",
      "ditzler_ppg_code": "ex. 2706",
      "dulux_code": "ex. 23-3632",
      "years_used": "ex. 1959-1967"
    },
    "duplicate": {
      "title": "Doublon possible trouvé",
      "message": "Nous avons trouvé une ou plusieurs couleurs existantes qui pourraient correspondre à votre soumission. Veuillez examiner les correspondances ci-dessous et soit modifier la couleur existante, soit confirmer que votre soumission est une nouvelle couleur.",
      "code": "Code",
      "short_code": "Code court",
      "edit_existing": "Modifier",
      "cancel": "Annuler",
      "submit_anyway": "Soumettre comme nouvelle couleur"
    },
    "error": {
      "title": "Erreur de soumission",
      "message": "Un problème est survenu lors de la soumission de votre couleur. Veuillez réessayer plus tard.",
      "dismiss": "Fermer",
      "api_unavailable": "L'API est actuellement indisponible. Veuillez réessayer plus tard."
    },
    "checking_duplicates": "Vérification des doublons...",
    "submit_button": "Soumettre la couleur"
  },
  "it": {
    "title": "Invia un nuovo colore",
    "success": {
      "thank_you": "Grazie!",
      "submitted_message": "La tua proposta di colore è stata ricevuta. Attendi 1-2 giorni per la revisione.",
      "submission_id": "ID di invio:",
      "pending_review": "La tua proposta è in attesa di revisione da parte di un amministratore. Una volta approvata, apparirà nel database dei colori.",
      "submit_another": "Invia un altro colore"
    },
    "validation": {
      "required": "Questo campo è obbligatorio",
      "invalid_email": "Indirizzo email non valido"
    },
    "sections": {
      "personal_info": "Le tue informazioni",
      "color_details": "Dettagli del colore"
    },
    "form_labels": {
      "your_name": "Il tuo nome",
      "your_email": "La tua email",
      "color_name": "Nome del colore",
      "bmc_code": "Codice BMC",
      "short_code": "Codice breve",
      "ditzler_ppg_code": "Codice Ditzler/PPG",
      "dulux_code": "Codice Dulux",
      "years_used": "Anni utilizzati"
    },
    "placeholders": {
      "name": "es. Mario Rossi",
      "email": "es. mario{'@'}esempio.it",
      "color_name": "es. Blu Clipper",
      "bmc_code": "es. GR29",
      "short_code": "es. BLVC47",
      "ditzler_ppg_code": "es. 2706",
      "dulux_code": "es. 23-3632",
      "years_used": "es. 1959-1967"
    },
    "duplicate": {
      "title": "Possibile duplicato trovato",
      "message": "Abbiamo trovato uno o più colori esistenti che potrebbero corrispondere alla tua proposta. Controlla le corrispondenze qui sotto e modifica il colore esistente o conferma che la tua proposta è un nuovo colore.",
      "code": "Codice",
      "short_code": "Codice breve",
      "edit_existing": "Modifica questo",
      "cancel": "Annulla",
      "submit_anyway": "Invia come nuovo colore"
    },
    "error": {
      "title": "Errore di invio",
      "message": "Si è verificato un problema durante l'invio del tuo colore. Riprova più tardi.",
      "dismiss": "Chiudi",
      "api_unavailable": "L'API non è attualmente disponibile. Riprova più tardi."
    },
    "checking_duplicates": "Controllo duplicati...",
    "submit_button": "Invia colore"
  },
  "pt": {
    "title": "Enviar uma nova cor",
    "success": {
      "thank_you": "Obrigado!",
      "submitted_message": "O seu envio de cor foi recebido. Aguarde 1-2 dias para revisão.",
      "submission_id": "ID de envio:",
      "pending_review": "O seu envio está pendente de revisão por um administrador. Uma vez aprovado, aparecerá na base de dados de cores.",
      "submit_another": "Enviar outra cor"
    },
    "validation": {
      "required": "Este campo é obrigatório",
      "invalid_email": "Endereço de email inválido"
    },
    "sections": {
      "personal_info": "Suas informações",
      "color_details": "Detalhes da cor"
    },
    "form_labels": {
      "your_name": "Seu nome",
      "your_email": "Seu email",
      "color_name": "Nome da cor",
      "bmc_code": "Código BMC",
      "short_code": "Código curto",
      "ditzler_ppg_code": "Código Ditzler/PPG",
      "dulux_code": "Código Dulux",
      "years_used": "Anos utilizados"
    },
    "placeholders": {
      "name": "ex. João Silva",
      "email": "ex. joao{'@'}exemplo.com",
      "color_name": "ex. Azul Clipper",
      "bmc_code": "ex. GR29",
      "short_code": "ex. BLVC47",
      "ditzler_ppg_code": "ex. 2706",
      "dulux_code": "ex. 23-3632",
      "years_used": "ex. 1959-1967"
    },
    "duplicate": {
      "title": "Possível duplicado encontrado",
      "message": "Encontramos uma ou mais cores existentes que podem corresponder ao seu envio. Reveja as correspondências abaixo e edite a cor existente ou confirme que o seu envio é uma nova cor.",
      "code": "Código",
      "short_code": "Código curto",
      "edit_existing": "Editar esta",
      "cancel": "Cancelar",
      "submit_anyway": "Enviar como nova cor"
    },
    "error": {
      "title": "Erro de envio",
      "message": "Houve um problema ao enviar a sua cor. Tente novamente mais tarde.",
      "dismiss": "Fechar",
      "api_unavailable": "A API está atualmente indisponível. Tente novamente mais tarde."
    },
    "checking_duplicates": "Verificando duplicados...",
    "submit_button": "Enviar cor"
  },
  "ru": {
    "title": "Отправить новый цвет",
    "success": {
      "thank_you": "Спасибо!",
      "submitted_message": "Ваша заявка на цвет получена. Пожалуйста, подождите 1-2 дня для проверки.",
      "submission_id": "ID заявки:",
      "pending_review": "Ваша заявка ожидает проверки администратором. После утверждения она появится в базе данных цветов.",
      "submit_another": "Отправить другой цвет"
    },
    "validation": {
      "required": "Это поле обязательно",
      "invalid_email": "Неверный адрес электронной почты"
    },
    "sections": {
      "personal_info": "Ваша информация",
      "color_details": "Детали цвета"
    },
    "form_labels": {
      "your_name": "Ваше имя",
      "your_email": "Ваш email",
      "color_name": "Название цвета",
      "bmc_code": "Код BMC",
      "short_code": "Короткий код",
      "ditzler_ppg_code": "Код Ditzler/PPG",
      "dulux_code": "Код Dulux",
      "years_used": "Годы использования"
    },
    "placeholders": {
      "name": "напр. Иван Иванов",
      "email": "напр. ivan{'@'}example.com",
      "color_name": "напр. Синий Clipper",
      "bmc_code": "напр. GR29",
      "short_code": "напр. BLVC47",
      "ditzler_ppg_code": "напр. 2706",
      "dulux_code": "напр. 23-3632",
      "years_used": "напр. 1959-1967"
    },
    "duplicate": {
      "title": "Обнаружен возможный дубликат",
      "message": "Мы нашли один или несколько существующих цветов, которые могут совпадать с вашей заявкой. Пожалуйста, просмотрите совпадения ниже и либо отредактируйте существующий цвет, либо подтвердите, что ваша заявка - это новый цвет.",
      "code": "Код",
      "short_code": "Короткий код",
      "edit_existing": "Редактировать",
      "cancel": "Отмена",
      "submit_anyway": "Отправить как новый цвет"
    },
    "error": {
      "title": "Ошибка отправки",
      "message": "Возникла проблема при отправке вашего цвета. Пожалуйста, попробуйте позже.",
      "dismiss": "Закрыть",
      "api_unavailable": "API в настоящее время недоступен. Пожалуйста, попробуйте позже."
    },
    "checking_duplicates": "Проверка на дубликаты...",
    "submit_button": "Отправить цвет"
  },
  "ja": {
    "title": "新しいカラーを送信",
    "success": {
      "thank_you": "ありがとうございます！",
      "submitted_message": "カラーの送信を受け付けました。審査には1〜2日かかります。",
      "submission_id": "送信ID：",
      "pending_review": "送信内容は管理者による審査待ちです。承認されると、カラーデータベースに表示されます。",
      "submit_another": "別のカラーを送信"
    },
    "validation": {
      "required": "この項目は必須です",
      "invalid_email": "無効なメールアドレス"
    },
    "sections": {
      "personal_info": "あなたの情報",
      "color_details": "カラーの詳細"
    },
    "form_labels": {
      "your_name": "お名前",
      "your_email": "メールアドレス",
      "color_name": "カラー名",
      "bmc_code": "BMCコード",
      "short_code": "ショートコード",
      "ditzler_ppg_code": "Ditzler/PPGコード",
      "dulux_code": "Duluxコード",
      "years_used": "使用年"
    },
    "placeholders": {
      "name": "例：山田太郎",
      "email": "例：taro{'@'}example.com",
      "color_name": "例：クリッパーブルー",
      "bmc_code": "例：GR29",
      "short_code": "例：BLVC47",
      "ditzler_ppg_code": "例：2706",
      "dulux_code": "例：23-3632",
      "years_used": "例：1959-1967"
    },
    "duplicate": {
      "title": "重複の可能性が見つかりました",
      "message": "送信内容と一致する可能性のある既存のカラーが1つ以上見つかりました。以下の一致を確認して、既存のカラーを編集するか、送信が新しいカラーであることを確認してください。",
      "code": "コード",
      "short_code": "ショートコード",
      "edit_existing": "これを編集",
      "cancel": "キャンセル",
      "submit_anyway": "新しいカラーとして送信"
    },
    "error": {
      "title": "送信エラー",
      "message": "カラーの送信中に問題が発生しました。後でもう一度お試しください。",
      "dismiss": "閉じる",
      "api_unavailable": "APIは現在利用できません。後でもう一度お試しください。"
    },
    "checking_duplicates": "重複を確認中...",
    "submit_button": "カラーを送信"
  },
  "zh": {
    "title": "提交新颜色",
    "success": {
      "thank_you": "谢谢！",
      "submitted_message": "您的颜色提交已收到。请等待1-2天进行审核。",
      "submission_id": "提交ID：",
      "pending_review": "您的提交正在等待管理员审核。一旦获得批准，它将出现在颜色数据库中。",
      "submit_another": "提交另一个颜色"
    },
    "validation": {
      "required": "此字段为必填项",
      "invalid_email": "无效的邮箱地址"
    },
    "sections": {
      "personal_info": "您的信息",
      "color_details": "颜色详情"
    },
    "form_labels": {
      "your_name": "您的姓名",
      "your_email": "您的邮箱",
      "color_name": "颜色名称",
      "bmc_code": "BMC代码",
      "short_code": "简码",
      "ditzler_ppg_code": "Ditzler/PPG代码",
      "dulux_code": "Dulux代码",
      "years_used": "使用年份"
    },
    "placeholders": {
      "name": "例如：张三",
      "email": "例如：zhang{'@'}example.com",
      "color_name": "例如：快船蓝",
      "bmc_code": "例如：GR29",
      "short_code": "例如：BLVC47",
      "ditzler_ppg_code": "例如：2706",
      "dulux_code": "例如：23-3632",
      "years_used": "例如：1959-1967"
    },
    "duplicate": {
      "title": "发现可能的重复",
      "message": "我们发现一个或多个可能与您的提交匹配的现有颜色。请查看以下匹配项，然后编辑现有颜色或确认您的提交是新颜色。",
      "code": "代码",
      "short_code": "简码",
      "edit_existing": "编辑此项",
      "cancel": "取消",
      "submit_anyway": "作为新颜色提交"
    },
    "error": {
      "title": "提交错误",
      "message": "提交您的颜色时出现问题。请稍后再试。",
      "dismiss": "关闭",
      "api_unavailable": "API当前不可用。请稍后再试。"
    },
    "checking_duplicates": "正在检查重复项...",
    "submit_button": "提交颜色"
  },
  "ko": {
    "title": "새 색상 제출",
    "success": {
      "thank_you": "감사합니다!",
      "submitted_message": "색상 제출이 접수되었습니다. 검토까지 1-2일 정도 소요됩니다.",
      "submission_id": "제출 ID:",
      "pending_review": "제출 내용이 관리자 검토 대기 중입니다. 승인되면 색상 데이터베이스에 표시됩니다.",
      "submit_another": "다른 색상 제출"
    },
    "validation": {
      "required": "이 필드는 필수입니다",
      "invalid_email": "잘못된 이메일 주소"
    },
    "sections": {
      "personal_info": "귀하의 정보",
      "color_details": "색상 세부정보"
    },
    "form_labels": {
      "your_name": "이름",
      "your_email": "이메일",
      "color_name": "색상 이름",
      "bmc_code": "BMC 코드",
      "short_code": "짧은 코드",
      "ditzler_ppg_code": "Ditzler/PPG 코드",
      "dulux_code": "Dulux 코드",
      "years_used": "사용 연도"
    },
    "placeholders": {
      "name": "예: 홍길동",
      "email": "예: hong{'@'}example.com",
      "color_name": "예: 클리퍼 블루",
      "bmc_code": "예: GR29",
      "short_code": "예: BLVC47",
      "ditzler_ppg_code": "예: 2706",
      "dulux_code": "예: 23-3632",
      "years_used": "예: 1959-1967"
    },
    "duplicate": {
      "title": "중복 가능성 발견",
      "message": "제출 내용과 일치할 수 있는 기존 색상을 하나 이상 찾았습니다. 아래 일치 항목을 검토하고 기존 색상을 편집하거나 제출이 새 색상임을 확인하세요.",
      "code": "코드",
      "short_code": "짧은 코드",
      "edit_existing": "편집하기",
      "cancel": "취소",
      "submit_anyway": "새 색상으로 제출"
    },
    "error": {
      "title": "제출 오류",
      "message": "색상 제출 중 문제가 발생했습니다. 나중에 다시 시도하세요.",
      "dismiss": "닫기",
      "api_unavailable": "API를 현재 사용할 수 없습니다. 나중에 다시 시도하세요."
    },
    "checking_duplicates": "중복 확인 중...",
    "submit_button": "색상 제출"
  }
}
</i18n>
