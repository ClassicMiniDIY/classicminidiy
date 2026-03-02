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
  const isCollection = ref(false);

  const documentFiles = ref<File[]>([]);
  const thumbnailFiles = ref<File[]>([]);

  interface TouchedFields {
    type: boolean;
    title: boolean;
    collectionTitle: boolean;
    documentFiles: boolean;
    [key: string]: boolean;
  }

  const touchedFields = ref<TouchedFields>({
    type: false,
    title: false,
    collectionTitle: false,
    documentFiles: false,
  });

  const formData = reactive({
    type: '',
    title: '',
    code: '',
    author: '',
    year: null as number | null,
    description: '',
    collectionTitle: '',
    collectionDescription: '',
  });

  const typeOptions = computed(() => [
    { value: 'manual', label: t('form.fields.type.options.manual') },
    { value: 'advert', label: t('form.fields.type.options.advert') },
    { value: 'catalogue', label: t('form.fields.type.options.catalogue') },
    { value: 'tuning', label: t('form.fields.type.options.tuning') },
    { value: 'electrical', label: t('form.fields.type.options.electrical') },
  ]);

  const maxDocumentFiles = computed(() => (isCollection.value ? 10 : 5));

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
    ogUrl: 'https://classicminidiy.com/contribute/document',
    ogType: 'website',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
  });

  function validateForm(): boolean {
    if (!formData.type) return false;
    if (!formData.title) return false;
    if (documentFiles.value.length === 0) return false;
    if (isCollection.value && !formData.collectionTitle) return false;
    return true;
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
    apiError.value = false;
    apiMessage.value = '';

    try {
      const itemData: Record<string, any> = {
        type: formData.type,
        title: formData.title,
        code: formData.code || undefined,
        author: formData.author || undefined,
        year: formData.year || undefined,
        description: formData.description || undefined,
      };

      let targetType: 'document' | 'collection';

      if (isCollection.value) {
        targetType = 'collection';
        itemData.title = formData.collectionTitle;
        itemData.description = formData.collectionDescription || undefined;
        itemData.documents = [
          {
            type: formData.type,
            title: formData.title,
            code: formData.code || undefined,
            author: formData.author || undefined,
            year: formData.year || undefined,
            description: formData.description || undefined,
          },
        ];
      } else {
        targetType = 'document';
      }

      const response = await submitNewItem(targetType, itemData);

      if (!response) {
        throw new Error('No response from server');
      }

      // Upload document files
      const docFormData = new FormData();
      documentFiles.value.forEach((file, i) => docFormData.append(`file${i}`, file));
      const { error: docUploadError } = await useFetch('/api/archive/upload', {
        method: 'POST',
        body: docFormData,
        query: { bucket: 'archive-documents', submissionId: response.id },
      });

      if (docUploadError.value) {
        console.error('Document upload error:', docUploadError.value);
      }

      // Upload thumbnail if provided (only for non-collection)
      if (!isCollection.value && thumbnailFiles.value.length > 0) {
        const thumbFormData = new FormData();
        thumbnailFiles.value.forEach((file, i) => thumbFormData.append(`file${i}`, file));
        const { error: thumbUploadError } = await useFetch('/api/archive/upload', {
          method: 'POST',
          body: thumbFormData,
          query: { bucket: 'archive-thumbnails', submissionId: response.id },
        });

        if (thumbUploadError.value) {
          console.error('Thumbnail upload error:', thumbUploadError.value);
        }
      }

      submissionSuccess.value = true;
      apiError.value = false;
      submissionId.value = response.id;

      capture('form_submitted', {
        form: 'document_submission',
        document_type: formData.type,
        is_collection: isCollection.value,
        file_count: documentFiles.value.length,
        source: 'contribute_hub',
      });
    } catch (error) {
      submissionSuccess.value = false;
      apiError.value = true;
      apiMessage.value = t('form.error.default_message');
      console.error('Error submitting document:', error);
    } finally {
      processing.value = false;
    }
  }

  function resetForm() {
    submissionSuccess.value = false;
    apiError.value = false;
    submissionId.value = '';
    apiMessage.value = '';
    formData.type = '';
    formData.title = '';
    formData.code = '';
    formData.author = '';
    formData.year = null;
    formData.description = '';
    formData.collectionTitle = '';
    formData.collectionDescription = '';
    isCollection.value = false;
    documentFiles.value = [];
    thumbnailFiles.value = [];
    Object.keys(touchedFields.value).forEach((key: string) => {
      touchedFields.value[key] = false;
    });
  }
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb
        :version="BREADCRUMB_VERSIONS.ARCHIVE"
        :page="$t('breadcrumb_title')"
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
          <h2 class="text-xl font-bold mb-2">{{ $t('sign_in_title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ $t('sign_in_description') }}</p>
          <UButton to="/login" color="primary" class="w-full">
            {{ $t('sign_in_button') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Authenticated Content -->
    <div v-else>
      <div class="grid grid-cols-12 gap-6">
        <!-- Heading -->
        <div class="col-span-12 md:col-span-8 md:col-start-3">
          <h1 class="text-3xl font-bold mb-2">{{ $t('heading') }}</h1>
          <p class="text-base opacity-70 mb-6">{{ $t('subtitle') }}</p>
          <USeparator class="mb-6" />
        </div>

        <!-- Form Card -->
        <div class="col-span-12 md:col-span-8 md:col-start-3">
          <UCard>
            <!-- Success State -->
            <div v-if="submissionSuccess" class="p-6 text-center">
              <div class="mb-4">
                <i class="fad fa-box-check fa-beat text-6xl text-success"></i>
              </div>
              <h1 class="text-2xl font-bold mb-2">{{ $t('form.success.title') }}</h1>
              <h2 class="text-xl mb-6">{{ $t('form.success.subtitle') }}</h2>
              <div class="space-y-4 text-left max-w-md mx-auto">
                <div class="bg-base-200 p-4 rounded-lg">
                  <p class="font-medium">{{ $t('form.success.submission_id') }}{{ submissionId }}</p>
                  <p class="text-sm opacity-70">{{ $t('form.success.pending_review') }}</p>
                </div>
                <UButton @click="resetForm" color="primary" class="w-full">
                  {{ $t('form.success.make_another') }}
                </UButton>
                <UButton to="/submissions" color="neutral" variant="outline" class="w-full">
                  {{ $t('form.success.view_submissions') }}
                </UButton>
              </div>
            </div>

            <!-- Form Body -->
            <div v-else>
              <div class="flex items-center bg-primary text-primary-content -m-4 mb-4 p-4 rounded-t-lg">
                <i class="fad fa-file-arrow-up mr-2"></i>
                <h2 class="text-lg font-semibold">{{ $t('form.card_title') }}</h2>
              </div>

              <div class="p-2">
                <!-- Error Alert -->
                <UAlert v-if="apiError" color="warning" class="mb-6">
                  <template #icon>
                    <i class="fad fa-circle-exclamation"></i>
                  </template>
                  <template #title>{{ $t('form.error.title') }}</template>
                  <template #description>
                    {{ apiMessage || $t('form.error.default_message') }}
                  </template>
                </UAlert>

                <!-- Form Fields -->
                <form @submit.prevent="submit" class="space-y-4">
                  <!-- Type -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium"
                        >{{ $t('form.fields.type.label') }} <span class="text-error">*</span></span
                      >
                      <span class="text-sm text-muted"><i class="fad fa-folder-open"></i></span>
                    </label>
                    <USelect
                      v-model="formData.type"
                      :items="typeOptions"
                      :placeholder="$t('form.fields.type.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      :color="formData.type === '' && touchedFields.type ? 'error' : undefined"
                      @blur="touchedFields.type = true"
                      @change="touchedFields.type = true"
                    />
                    <p v-if="formData.type === '' && touchedFields.type" class="text-sm text-error mt-1">
                      {{ $t('form.error.type_required') }}
                    </p>
                  </div>

                  <!-- Title -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium"
                        >{{ $t('form.fields.title.label') }} <span class="text-error">*</span></span
                      >
                      <span class="text-sm text-muted"><i class="fad fa-heading"></i></span>
                    </label>
                    <UInput
                      type="text"
                      v-model="formData.title"
                      :placeholder="$t('form.fields.title.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      :color="formData.title === '' && touchedFields.title ? 'error' : undefined"
                      @blur="touchedFields.title = true"
                    />
                    <p v-if="formData.title === '' && touchedFields.title" class="text-sm text-error mt-1">
                      {{ $t('form.error.title_required') }}
                    </p>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Code -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ $t('form.fields.code.label') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-barcode"></i></span>
                      </label>
                      <UInput
                        type="text"
                        v-model="formData.code"
                        :placeholder="$t('form.fields.code.placeholder')"
                        class="w-full"
                        :disabled="processing"
                      />
                      <p class="text-xs opacity-50 mt-1">{{ $t('form.fields.code.help') }}</p>
                    </div>

                    <!-- Author -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ $t('form.fields.author.label') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-user-pen"></i></span>
                      </label>
                      <UInput
                        type="text"
                        v-model="formData.author"
                        :placeholder="$t('form.fields.author.placeholder')"
                        class="w-full"
                        :disabled="processing"
                      />
                    </div>
                  </div>

                  <!-- Year -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ $t('form.fields.year.label') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-calendar"></i></span>
                    </label>
                    <UInput
                      type="number"
                      v-model.number="formData.year"
                      :placeholder="$t('form.fields.year.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      min="1959"
                      max="2000"
                    />
                  </div>

                  <!-- Description -->
                  <div class="w-full">
                    <label class="flex justify-between items-center mb-1">
                      <span class="text-sm font-medium">{{ $t('form.fields.description.label') }}</span>
                      <span class="text-sm text-muted"><i class="fad fa-align-left"></i></span>
                    </label>
                    <UTextarea
                      v-model="formData.description"
                      :placeholder="$t('form.fields.description.placeholder')"
                      class="w-full"
                      :disabled="processing"
                      :rows="4"
                    />
                  </div>

                  <!-- Document Files -->
                  <div class="w-full">
                    <FileUpload
                      accept="application/pdf,image/jpeg,image/png"
                      :maxFiles="maxDocumentFiles"
                      :maxSizeMb="10"
                      :required="true"
                      :label="$t('form.fields.document_files.label')"
                      @update:files="documentFiles = $event"
                    />
                    <p
                      v-if="documentFiles.length === 0 && touchedFields.documentFiles"
                      class="text-sm text-error mt-1"
                    >
                      {{ $t('form.error.files_required') }}
                    </p>
                  </div>

                  <!-- Thumbnail (non-collection only) -->
                  <div v-if="!isCollection" class="w-full">
                    <FileUpload
                      accept="image/jpeg,image/png"
                      :maxFiles="1"
                      :maxSizeMb="5"
                      :required="false"
                      :label="$t('form.fields.thumbnail.label')"
                      @update:files="thumbnailFiles = $event"
                    />
                    <p class="text-xs opacity-50 mt-1">{{ $t('form.fields.thumbnail.help') }}</p>
                  </div>

                  <USeparator />

                  <!-- Collection Toggle -->
                  <div class="w-full">
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        class="toggle toggle-primary"
                        v-model="isCollection"
                        :disabled="processing"
                      />
                      <div>
                        <span class="text-sm font-medium">{{ $t('form.collection.toggle') }}</span>
                        <p class="text-xs opacity-50">{{ $t('form.collection.toggle_help') }}</p>
                      </div>
                    </label>
                  </div>

                  <!-- Collection Fields -->
                  <div v-if="isCollection" class="space-y-4 p-4 bg-base-200 rounded-lg">
                    <h3 class="text-lg font-semibold">
                      <i class="fad fa-layer-group mr-2"></i>
                      {{ $t('form.collection.section_title') }}
                    </h3>

                    <!-- Collection Title -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium"
                          >{{ $t('form.collection.title_label') }} <span class="text-error">*</span></span
                        >
                        <span class="text-sm text-muted"><i class="fad fa-bookmark"></i></span>
                      </label>
                      <UInput
                        type="text"
                        v-model="formData.collectionTitle"
                        :placeholder="$t('form.collection.title_placeholder')"
                        class="w-full"
                        :disabled="processing"
                        :color="
                          isCollection && formData.collectionTitle === '' && touchedFields.collectionTitle
                            ? 'error'
                            : undefined
                        "
                        @blur="touchedFields.collectionTitle = true"
                      />
                      <p
                        v-if="isCollection && formData.collectionTitle === '' && touchedFields.collectionTitle"
                        class="text-sm text-error mt-1"
                      >
                        {{ $t('form.error.collection_title_required') }}
                      </p>
                    </div>

                    <!-- Collection Description -->
                    <div class="w-full">
                      <label class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium">{{ $t('form.collection.description_label') }}</span>
                        <span class="text-sm text-muted"><i class="fad fa-align-left"></i></span>
                      </label>
                      <UTextarea
                        v-model="formData.collectionDescription"
                        :placeholder="$t('form.collection.description_placeholder')"
                        class="w-full"
                        :disabled="processing"
                        :rows="3"
                      />
                    </div>
                  </div>

                  <!-- Submit Button -->
                  <div class="pt-4">
                    <UButton
                      type="submit"
                      color="primary"
                      size="lg"
                      class="w-full"
                      :disabled="!validateForm() || processing"
                      :loading="processing"
                      @click="touchedFields.documentFiles = true"
                    >
                      <i class="fad fa-paper-plane mr-2" v-if="!processing"></i>
                      {{ processing ? $t('form.submit.submitting') : $t('form.submit.button') }}
                    </UButton>
                  </div>
                </form>
              </div>
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
    "page_title": "Submit a Document - Classic Mini DIY Archive",
    "description": "Submit a new document to the Classic Mini DIY archive for review and inclusion in the community database.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Submit Document",
    "sign_in_title": "Sign In to Contribute",
    "sign_in_description": "You need to be signed in to submit documents to the archive. Create a free account to get started.",
    "sign_in_button": "Sign In to Continue",
    "heading": "Submit a Document",
    "subtitle": "Help us grow the Classic Mini document archive by submitting a manual, advert, catalogue, tuning guide, or electrical diagram. Your submission will be reviewed by a moderator before being added to the archive.",
    "seo": {
      "og_title": "Submit a Document - Classic Mini DIY Archive",
      "og_description": "Contribute documents to the Classic Mini DIY community archive.",
      "twitter_title": "Submit a Document - Classic Mini DIY Archive",
      "twitter_description": "Contribute documents to the Classic Mini DIY community archive."
    },
    "form": {
      "card_title": "Submit Document",
      "fields": {
        "type": {
          "label": "Document Type",
          "placeholder": "Select a document type",
          "options": {
            "manual": "Manual",
            "advert": "Advert",
            "catalogue": "Catalogue",
            "tuning": "Tuning",
            "electrical": "Electrical"
          }
        },
        "title": {
          "label": "Title",
          "placeholder": "e.g. Mini Cooper S Workshop Manual 1964"
        },
        "code": {
          "label": "Part / Document Code",
          "placeholder": "e.g. AKD4935",
          "help": "Optional part number or document identifier"
        },
        "author": {
          "label": "Author / Publisher",
          "placeholder": "e.g. British Leyland"
        },
        "year": {
          "label": "Year",
          "placeholder": "e.g. 1974"
        },
        "description": {
          "label": "Description",
          "placeholder": "Briefly describe this document and its contents"
        },
        "document_files": {
          "label": "Document Files"
        },
        "thumbnail": {
          "label": "Thumbnail",
          "help": "Optional cover image for the document listing"
        }
      },
      "collection": {
        "toggle": "This is part of a collection",
        "toggle_help": "Enable this if you are uploading multiple related documents as a group",
        "section_title": "Collection Details",
        "title_label": "Collection Title",
        "title_placeholder": "e.g. BMC Workshop Manuals Series",
        "description_label": "Collection Description",
        "description_placeholder": "Describe what ties these documents together"
      },
      "submit": {
        "button": "Submit Document",
        "submitting": "Submitting..."
      },
      "success": {
        "title": "Submission Received!",
        "subtitle": "Thank you for your contribution",
        "submission_id": "Submission ID: ",
        "pending_review": "Your submission is pending review by a moderator. Once approved, it will appear in the document archive.",
        "make_another": "Submit Another Document",
        "view_submissions": "View My Submissions"
      },
      "error": {
        "title": "Submission Error",
        "default_message": "There was an error submitting your document. Please try again.",
        "title_required": "Please enter a document title.",
        "type_required": "Please select a document type.",
        "files_required": "Please upload at least one document file.",
        "collection_title_required": "Please enter a collection title."
      }
    }
  },
  "es": {
    "page_title": "Enviar un documento - Archivo Classic Mini DIY",
    "description": "Envie un nuevo documento para su revision e inclusion en la base de datos comunitaria de Classic Mini DIY.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Enviar documento",
    "sign_in_title": "Inicia sesion para contribuir",
    "sign_in_description": "Debes iniciar sesion para enviar documentos al archivo. Crea una cuenta gratuita para empezar.",
    "sign_in_button": "Iniciar sesion para continuar",
    "heading": "Enviar un documento",
    "subtitle": "Ayudenos a ampliar el archivo de documentos Classic Mini enviando un manual, un anuncio, un catalogo, una guia de modificacion o un diagrama electrico. Su envio sera revisado por un moderador antes de ser anadido al archivo.",
    "seo": {
      "og_title": "Enviar un documento - Archivo Classic Mini DIY",
      "og_description": "Contribuya con documentos al archivo comunitario de Classic Mini DIY.",
      "twitter_title": "Enviar un documento - Archivo Classic Mini DIY",
      "twitter_description": "Contribuya con documentos al archivo comunitario de Classic Mini DIY."
    },
    "form": {
      "card_title": "Enviar documento",
      "fields": {
        "type": {
          "label": "Tipo de documento",
          "placeholder": "Seleccionar tipo de documento",
          "options": {
            "manual": "Manual",
            "advert": "Anuncio",
            "catalogue": "Catalogo",
            "tuning": "Preparacion",
            "electrical": "Electrico"
          }
        },
        "title": {
          "label": "Titulo",
          "placeholder": "p. ej. Manual de taller Mini Cooper S 1964"
        },
        "code": {
          "label": "Codigo de pieza / documento",
          "placeholder": "p. ej. AKD4935",
          "help": "Numero de pieza o identificador de documento opcional"
        },
        "author": {
          "label": "Autor / Editor",
          "placeholder": "p. ej. British Leyland"
        },
        "year": {
          "label": "Ano",
          "placeholder": "p. ej. 1974"
        },
        "description": {
          "label": "Descripcion",
          "placeholder": "Describa brevemente este documento y su contenido"
        },
        "document_files": {
          "label": "Archivos del documento"
        },
        "thumbnail": {
          "label": "Miniatura",
          "help": "Imagen de portada opcional para el listado del documento"
        }
      },
      "collection": {
        "toggle": "Esto es parte de una coleccion",
        "toggle_help": "Active esto si esta subiendo varios documentos relacionados como grupo",
        "section_title": "Detalles de la coleccion",
        "title_label": "Titulo de la coleccion",
        "title_placeholder": "p. ej. Serie de manuales de taller BMC",
        "description_label": "Descripcion de la coleccion",
        "description_placeholder": "Describa que une estos documentos"
      },
      "submit": {
        "button": "Enviar documento",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "Envio recibido!",
        "subtitle": "Gracias por tu contribucion",
        "submission_id": "ID de envio: ",
        "pending_review": "Tu envio esta pendiente de revision por un moderador. Una vez aprobado, aparecera en el archivo de documentos.",
        "make_another": "Enviar otro documento",
        "view_submissions": "Ver mis envios"
      },
      "error": {
        "title": "Error de envio",
        "default_message": "Hubo un error al enviar tu documento. Por favor, intentalo de nuevo.",
        "title_required": "Por favor, introduce un titulo para el documento.",
        "type_required": "Por favor, selecciona un tipo de documento.",
        "files_required": "Por favor, sube al menos un archivo de documento.",
        "collection_title_required": "Por favor, introduce un titulo para la coleccion."
      }
    }
  },
  "fr": {
    "page_title": "Soumettre un document - Archives Classic Mini DIY",
    "description": "Soumettez un nouveau document pour examen et inclusion dans la base de donnees communautaire Classic Mini DIY.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Soumettre un document",
    "sign_in_title": "Connectez-vous pour contribuer",
    "sign_in_description": "Vous devez etre connecte pour soumettre des documents aux archives. Creez un compte gratuit pour commencer.",
    "sign_in_button": "Se connecter pour continuer",
    "heading": "Soumettre un document",
    "subtitle": "Aidez-nous a enrichir les archives de documents Classic Mini en soumettant un manuel, une publicite, un catalogue, un guide de tuning ou un schema electrique. Votre soumission sera examinee par un moderateur avant d'etre ajoutee aux archives.",
    "seo": {
      "og_title": "Soumettre un document - Archives Classic Mini DIY",
      "og_description": "Contribuez des documents aux archives communautaires de Classic Mini DIY.",
      "twitter_title": "Soumettre un document - Archives Classic Mini DIY",
      "twitter_description": "Contribuez des documents aux archives communautaires de Classic Mini DIY."
    },
    "form": {
      "card_title": "Soumettre un document",
      "fields": {
        "type": {
          "label": "Type de document",
          "placeholder": "Selectionner un type de document",
          "options": {
            "manual": "Manuel",
            "advert": "Publicite",
            "catalogue": "Catalogue",
            "tuning": "Preparation",
            "electrical": "Electrique"
          }
        },
        "title": {
          "label": "Titre",
          "placeholder": "ex. Manuel d'atelier Mini Cooper S 1964"
        },
        "code": {
          "label": "Code piece / document",
          "placeholder": "ex. AKD4935",
          "help": "Numero de piece ou identifiant de document optionnel"
        },
        "author": {
          "label": "Auteur / Editeur",
          "placeholder": "ex. British Leyland"
        },
        "year": {
          "label": "Annee",
          "placeholder": "ex. 1974"
        },
        "description": {
          "label": "Description",
          "placeholder": "Decrivez brievement ce document et son contenu"
        },
        "document_files": {
          "label": "Fichiers du document"
        },
        "thumbnail": {
          "label": "Vignette",
          "help": "Image de couverture optionnelle pour la fiche du document"
        }
      },
      "collection": {
        "toggle": "Ceci fait partie d'une collection",
        "toggle_help": "Activez cette option si vous telechargez plusieurs documents lies en groupe",
        "section_title": "Details de la collection",
        "title_label": "Titre de la collection",
        "title_placeholder": "ex. Serie de manuels d'atelier BMC",
        "description_label": "Description de la collection",
        "description_placeholder": "Decrivez ce qui relie ces documents"
      },
      "submit": {
        "button": "Soumettre le document",
        "submitting": "Soumission en cours..."
      },
      "success": {
        "title": "Soumission recue !",
        "subtitle": "Merci pour votre contribution",
        "submission_id": "ID de soumission : ",
        "pending_review": "Votre soumission est en attente de revision par un moderateur. Une fois approuvee, elle apparaitra dans les archives de documents.",
        "make_another": "Soumettre un autre document",
        "view_submissions": "Voir mes soumissions"
      },
      "error": {
        "title": "Erreur de soumission",
        "default_message": "Une erreur s'est produite lors de la soumission de votre document. Veuillez reessayer.",
        "title_required": "Veuillez saisir un titre de document.",
        "type_required": "Veuillez selectionner un type de document.",
        "files_required": "Veuillez telecharger au moins un fichier de document.",
        "collection_title_required": "Veuillez saisir un titre de collection."
      }
    }
  },
  "it": {
    "page_title": "Invia un documento - Archivio Classic Mini DIY",
    "description": "Invia un nuovo documento per la revisione e l'inclusione nel database della comunita Classic Mini DIY.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Invia documento",
    "sign_in_title": "Accedi per contribuire",
    "sign_in_description": "Devi essere connesso per inviare documenti all'archivio. Crea un account gratuito per iniziare.",
    "sign_in_button": "Accedi per continuare",
    "heading": "Invia un documento",
    "subtitle": "Aiutaci ad ampliare l'archivio di documenti Classic Mini inviando un manuale, un annuncio, un catalogo, una guida al tuning o uno schema elettrico. La tua proposta sara esaminata da un moderatore prima di essere aggiunta all'archivio.",
    "seo": {
      "og_title": "Invia un documento - Archivio Classic Mini DIY",
      "og_description": "Contribuisci con documenti all'archivio comunitario di Classic Mini DIY.",
      "twitter_title": "Invia un documento - Archivio Classic Mini DIY",
      "twitter_description": "Contribuisci con documenti all'archivio comunitario di Classic Mini DIY."
    },
    "form": {
      "card_title": "Invia documento",
      "fields": {
        "type": {
          "label": "Tipo di documento",
          "placeholder": "Seleziona un tipo di documento",
          "options": {
            "manual": "Manuale",
            "advert": "Annuncio",
            "catalogue": "Catalogo",
            "tuning": "Preparazione",
            "electrical": "Elettrico"
          }
        },
        "title": {
          "label": "Titolo",
          "placeholder": "es. Manuale d'officina Mini Cooper S 1964"
        },
        "code": {
          "label": "Codice ricambio / documento",
          "placeholder": "es. AKD4935",
          "help": "Numero di ricambio o identificatore documento opzionale"
        },
        "author": {
          "label": "Autore / Editore",
          "placeholder": "es. British Leyland"
        },
        "year": {
          "label": "Anno",
          "placeholder": "es. 1974"
        },
        "description": {
          "label": "Descrizione",
          "placeholder": "Descrivi brevemente questo documento e il suo contenuto"
        },
        "document_files": {
          "label": "File del documento"
        },
        "thumbnail": {
          "label": "Miniatura",
          "help": "Immagine di copertina opzionale per la scheda del documento"
        }
      },
      "collection": {
        "toggle": "Questo fa parte di una collezione",
        "toggle_help": "Attiva questa opzione se stai caricando piu documenti correlati come gruppo",
        "section_title": "Dettagli della collezione",
        "title_label": "Titolo della collezione",
        "title_placeholder": "es. Serie di manuali d'officina BMC",
        "description_label": "Descrizione della collezione",
        "description_placeholder": "Descrivi cosa collega questi documenti"
      },
      "submit": {
        "button": "Invia documento",
        "submitting": "Invio in corso..."
      },
      "success": {
        "title": "Proposta ricevuta!",
        "subtitle": "Grazie per il tuo contributo",
        "submission_id": "ID proposta: ",
        "pending_review": "La tua proposta e in attesa di revisione da parte di un moderatore. Una volta approvata, apparira nell'archivio documenti.",
        "make_another": "Invia un altro documento",
        "view_submissions": "Visualizza le mie proposte"
      },
      "error": {
        "title": "Errore di invio",
        "default_message": "Si e verificato un errore durante l'invio del documento. Riprova.",
        "title_required": "Inserisci un titolo per il documento.",
        "type_required": "Seleziona un tipo di documento.",
        "files_required": "Carica almeno un file di documento.",
        "collection_title_required": "Inserisci un titolo per la collezione."
      }
    }
  },
  "de": {
    "page_title": "Dokument einreichen - Classic Mini DIY Archiv",
    "description": "Reichen Sie ein neues Dokument zur Ueberpruefung und Aufnahme in das Classic Mini DIY Archiv ein.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Dokument einreichen",
    "sign_in_title": "Anmelden zum Beitragen",
    "sign_in_description": "Sie muessen angemeldet sein, um Dokumente zum Archiv beizutragen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
    "sign_in_button": "Anmelden und fortfahren",
    "heading": "Dokument einreichen",
    "subtitle": "Helfen Sie uns, das Classic Mini Dokumentenarchiv zu erweitern, indem Sie ein Handbuch, eine Werbung, einen Katalog, eine Tuning-Anleitung oder einen Schaltplan einreichen. Ihre Einreichung wird von einem Moderator geprueft, bevor sie in das Archiv aufgenommen wird.",
    "seo": {
      "og_title": "Dokument einreichen - Classic Mini DIY Archiv",
      "og_description": "Tragen Sie Dokumente zum Gemeinschaftsarchiv von Classic Mini DIY bei.",
      "twitter_title": "Dokument einreichen - Classic Mini DIY Archiv",
      "twitter_description": "Tragen Sie Dokumente zum Gemeinschaftsarchiv von Classic Mini DIY bei."
    },
    "form": {
      "card_title": "Dokument einreichen",
      "fields": {
        "type": {
          "label": "Dokumenttyp",
          "placeholder": "Dokumenttyp auswaehlen",
          "options": {
            "manual": "Handbuch",
            "advert": "Werbung",
            "catalogue": "Katalog",
            "tuning": "Tuning",
            "electrical": "Elektrik"
          }
        },
        "title": {
          "label": "Titel",
          "placeholder": "z.B. Mini Cooper S Werkstatthandbuch 1964"
        },
        "code": {
          "label": "Teil-/Dokumentcode",
          "placeholder": "z.B. AKD4935",
          "help": "Optionale Teilenummer oder Dokumentkennung"
        },
        "author": {
          "label": "Autor / Herausgeber",
          "placeholder": "z.B. British Leyland"
        },
        "year": {
          "label": "Jahr",
          "placeholder": "z.B. 1974"
        },
        "description": {
          "label": "Beschreibung",
          "placeholder": "Beschreiben Sie dieses Dokument und seinen Inhalt kurz"
        },
        "document_files": {
          "label": "Dokumentdateien"
        },
        "thumbnail": {
          "label": "Vorschaubild",
          "help": "Optionales Titelbild fuer den Dokumenteintrag"
        }
      },
      "collection": {
        "toggle": "Dies ist Teil einer Sammlung",
        "toggle_help": "Aktivieren Sie dies, wenn Sie mehrere zusammengehoerige Dokumente als Gruppe hochladen",
        "section_title": "Sammlungsdetails",
        "title_label": "Sammlungstitel",
        "title_placeholder": "z.B. BMC Werkstatthandbuch-Serie",
        "description_label": "Sammlungsbeschreibung",
        "description_placeholder": "Beschreiben Sie, was diese Dokumente verbindet"
      },
      "submit": {
        "button": "Dokument einreichen",
        "submitting": "Wird eingereicht..."
      },
      "success": {
        "title": "Einreichung erhalten!",
        "subtitle": "Vielen Dank fuer Ihren Beitrag",
        "submission_id": "Einreichungs-ID: ",
        "pending_review": "Ihre Einreichung wird von einem Moderator geprueft. Nach der Genehmigung erscheint sie im Dokumentenarchiv.",
        "make_another": "Weiteres Dokument einreichen",
        "view_submissions": "Meine Einreichungen anzeigen"
      },
      "error": {
        "title": "Einreichungsfehler",
        "default_message": "Beim Einreichen Ihres Dokuments ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
        "title_required": "Bitte geben Sie einen Dokumenttitel ein.",
        "type_required": "Bitte waehlen Sie einen Dokumenttyp aus.",
        "files_required": "Bitte laden Sie mindestens eine Dokumentdatei hoch.",
        "collection_title_required": "Bitte geben Sie einen Sammlungstitel ein."
      }
    }
  },
  "pt": {
    "page_title": "Enviar um documento - Arquivo Classic Mini DIY",
    "description": "Envie um novo documento para revisao e inclusao no banco de dados comunitario do Classic Mini DIY.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Enviar documento",
    "sign_in_title": "Entre para contribuir",
    "sign_in_description": "Voce precisa estar conectado para enviar documentos ao arquivo. Crie uma conta gratuita para comecar.",
    "sign_in_button": "Entrar para continuar",
    "heading": "Enviar um documento",
    "subtitle": "Ajude-nos a ampliar o arquivo de documentos Classic Mini enviando um manual, um anuncio, um catalogo, um guia de modificacao ou um diagrama eletrico. Seu envio sera revisado por um moderador antes de ser adicionado ao arquivo.",
    "seo": {
      "og_title": "Enviar um documento - Arquivo Classic Mini DIY",
      "og_description": "Contribua com documentos para o arquivo comunitario do Classic Mini DIY.",
      "twitter_title": "Enviar um documento - Arquivo Classic Mini DIY",
      "twitter_description": "Contribua com documentos para o arquivo comunitario do Classic Mini DIY."
    },
    "form": {
      "card_title": "Enviar documento",
      "fields": {
        "type": {
          "label": "Tipo de documento",
          "placeholder": "Selecionar tipo de documento",
          "options": {
            "manual": "Manual",
            "advert": "Anuncio",
            "catalogue": "Catalogo",
            "tuning": "Preparacao",
            "electrical": "Eletrico"
          }
        },
        "title": {
          "label": "Titulo",
          "placeholder": "ex. Manual de oficina Mini Cooper S 1964"
        },
        "code": {
          "label": "Codigo da peca / documento",
          "placeholder": "ex. AKD4935",
          "help": "Numero de peca ou identificador de documento opcional"
        },
        "author": {
          "label": "Autor / Editor",
          "placeholder": "ex. British Leyland"
        },
        "year": {
          "label": "Ano",
          "placeholder": "ex. 1974"
        },
        "description": {
          "label": "Descricao",
          "placeholder": "Descreva brevemente este documento e seu conteudo"
        },
        "document_files": {
          "label": "Arquivos do documento"
        },
        "thumbnail": {
          "label": "Miniatura",
          "help": "Imagem de capa opcional para a listagem do documento"
        }
      },
      "collection": {
        "toggle": "Isto faz parte de uma colecao",
        "toggle_help": "Ative isto se voce esta enviando varios documentos relacionados como grupo",
        "section_title": "Detalhes da colecao",
        "title_label": "Titulo da colecao",
        "title_placeholder": "ex. Serie de manuais de oficina BMC",
        "description_label": "Descricao da colecao",
        "description_placeholder": "Descreva o que une esses documentos"
      },
      "submit": {
        "button": "Enviar documento",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "Envio recebido!",
        "subtitle": "Obrigado pela sua contribuicao",
        "submission_id": "ID do envio: ",
        "pending_review": "Seu envio esta pendente de revisao por um moderador. Uma vez aprovado, aparecera no arquivo de documentos.",
        "make_another": "Enviar outro documento",
        "view_submissions": "Ver meus envios"
      },
      "error": {
        "title": "Erro no envio",
        "default_message": "Ocorreu um erro ao enviar seu documento. Por favor, tente novamente.",
        "title_required": "Por favor, insira um titulo para o documento.",
        "type_required": "Por favor, selecione um tipo de documento.",
        "files_required": "Por favor, envie pelo menos um arquivo de documento.",
        "collection_title_required": "Por favor, insira um titulo para a colecao."
      }
    }
  },
  "ru": {
    "page_title": "Отправить документ - Архив Classic Mini DIY",
    "description": "Отправьте новый документ на проверку и включение в базу данных сообщества Classic Mini DIY.",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Отправить документ",
    "sign_in_title": "Войдите, чтобы внести вклад",
    "sign_in_description": "Вам нужно войти в систему, чтобы отправлять документы в архив. Создайте бесплатную учетную запись, чтобы начать.",
    "sign_in_button": "Войти для продолжения",
    "heading": "Отправить документ",
    "subtitle": "Помогите нам пополнить архив документов Classic Mini, отправив руководство, рекламу, каталог, руководство по тюнингу или электрическую схему. Ваша заявка будет рассмотрена модератором перед добавлением в архив.",
    "seo": {
      "og_title": "Отправить документ - Архив Classic Mini DIY",
      "og_description": "Внесите документы в архив сообщества Classic Mini DIY.",
      "twitter_title": "Отправить документ - Архив Classic Mini DIY",
      "twitter_description": "Внесите документы в архив сообщества Classic Mini DIY."
    },
    "form": {
      "card_title": "Отправить документ",
      "fields": {
        "type": {
          "label": "Тип документа",
          "placeholder": "Выберите тип документа",
          "options": {
            "manual": "Руководство",
            "advert": "Реклама",
            "catalogue": "Каталог",
            "tuning": "Тюнинг",
            "electrical": "Электрика"
          }
        },
        "title": {
          "label": "Название",
          "placeholder": "напр. Руководство по ремонту Mini Cooper S 1964"
        },
        "code": {
          "label": "Код детали / документа",
          "placeholder": "напр. AKD4935",
          "help": "Необязательный номер детали или идентификатор документа"
        },
        "author": {
          "label": "Автор / Издатель",
          "placeholder": "напр. British Leyland"
        },
        "year": {
          "label": "Год",
          "placeholder": "напр. 1974"
        },
        "description": {
          "label": "Описание",
          "placeholder": "Кратко опишите этот документ и его содержание"
        },
        "document_files": {
          "label": "Файлы документа"
        },
        "thumbnail": {
          "label": "Миниатюра",
          "help": "Необязательное изображение обложки для карточки документа"
        }
      },
      "collection": {
        "toggle": "Это часть коллекции",
        "toggle_help": "Включите это, если вы загружаете несколько связанных документов как группу",
        "section_title": "Детали коллекции",
        "title_label": "Название коллекции",
        "title_placeholder": "напр. Серия руководств по ремонту BMC",
        "description_label": "Описание коллекции",
        "description_placeholder": "Опишите, что связывает эти документы"
      },
      "submit": {
        "button": "Отправить документ",
        "submitting": "Отправка..."
      },
      "success": {
        "title": "Заявка получена!",
        "subtitle": "Спасибо за ваш вклад",
        "submission_id": "ID заявки: ",
        "pending_review": "Ваша заявка ожидает проверки модератором. После одобрения она появится в архиве документов.",
        "make_another": "Отправить еще один документ",
        "view_submissions": "Посмотреть мои заявки"
      },
      "error": {
        "title": "Ошибка отправки",
        "default_message": "Произошла ошибка при отправке документа. Пожалуйста, попробуйте снова.",
        "title_required": "Пожалуйста, введите название документа.",
        "type_required": "Пожалуйста, выберите тип документа.",
        "files_required": "Пожалуйста, загрузите хотя бы один файл документа.",
        "collection_title_required": "Пожалуйста, введите название коллекции."
      }
    }
  },
  "ja": {
    "page_title": "ドキュメントを提出 - Classic Mini DIY アーカイブ",
    "description": "Classic Mini DIY アーカイブに新しいドキュメントを提出して、レビューとコミュニティデータベースへの掲載を依頼します。",
    "hero_title": "クラシックミニアーカイブ",
    "breadcrumb_title": "ドキュメント提出",
    "sign_in_title": "貢献するにはサインインしてください",
    "sign_in_description": "アーカイブにドキュメントを提出するにはサインインが必要です。無料アカウントを作成して始めましょう。",
    "sign_in_button": "サインインして続行",
    "heading": "ドキュメントを提出",
    "subtitle": "マニュアル、広告、カタログ、チューニングガイド、電気図面を提出して、クラシックミニのドキュメントアーカイブの拡充にご協力ください。提出物はアーカイブに追加される前にモデレーターによって審査されます。",
    "seo": {
      "og_title": "ドキュメントを提出 - Classic Mini DIY アーカイブ",
      "og_description": "Classic Mini DIY コミュニティアーカイブにドキュメントを提供してください。",
      "twitter_title": "ドキュメントを提出 - Classic Mini DIY アーカイブ",
      "twitter_description": "Classic Mini DIY コミュニティアーカイブにドキュメントを提供してください。"
    },
    "form": {
      "card_title": "ドキュメント提出",
      "fields": {
        "type": {
          "label": "ドキュメントタイプ",
          "placeholder": "ドキュメントタイプを選択",
          "options": {
            "manual": "マニュアル",
            "advert": "広告",
            "catalogue": "カタログ",
            "tuning": "チューニング",
            "electrical": "電気"
          }
        },
        "title": {
          "label": "タイトル",
          "placeholder": "例: Mini Cooper S ワークショップマニュアル 1964"
        },
        "code": {
          "label": "部品/ドキュメントコード",
          "placeholder": "例: AKD4935",
          "help": "オプションの部品番号またはドキュメント識別子"
        },
        "author": {
          "label": "著者/出版社",
          "placeholder": "例: British Leyland"
        },
        "year": {
          "label": "年",
          "placeholder": "例: 1974"
        },
        "description": {
          "label": "説明",
          "placeholder": "このドキュメントとその内容を簡単に説明してください"
        },
        "document_files": {
          "label": "ドキュメントファイル"
        },
        "thumbnail": {
          "label": "サムネイル",
          "help": "ドキュメント一覧用のオプションのカバー画像"
        }
      },
      "collection": {
        "toggle": "これはコレクションの一部です",
        "toggle_help": "関連する複数のドキュメントをグループとしてアップロードする場合に有効にしてください",
        "section_title": "コレクション詳細",
        "title_label": "コレクションタイトル",
        "title_placeholder": "例: BMC ワークショップマニュアルシリーズ",
        "description_label": "コレクションの説明",
        "description_placeholder": "これらのドキュメントを結びつけるものを説明してください"
      },
      "submit": {
        "button": "ドキュメントを提出",
        "submitting": "提出中..."
      },
      "success": {
        "title": "提出を受け付けました！",
        "subtitle": "ご貢献ありがとうございます",
        "submission_id": "提出ID: ",
        "pending_review": "提出物はモデレーターによる審査待ちです。承認されると、ドキュメントアーカイブに表示されます。",
        "make_another": "別のドキュメントを提出",
        "view_submissions": "提出物を確認"
      },
      "error": {
        "title": "提出エラー",
        "default_message": "ドキュメントの提出中にエラーが発生しました。もう一度お試しください。",
        "title_required": "ドキュメントのタイトルを入力してください。",
        "type_required": "ドキュメントタイプを選択してください。",
        "files_required": "少なくとも1つのドキュメントファイルをアップロードしてください。",
        "collection_title_required": "コレクションのタイトルを入力してください。"
      }
    }
  },
  "zh": {
    "page_title": "提交文档 - Classic Mini DIY 档案馆",
    "description": "提交新文档到 Classic Mini DIY 档案馆，经审核后纳入社区数据库。",
    "hero_title": "经典迷你档案馆",
    "breadcrumb_title": "提交文档",
    "sign_in_title": "登录以贡献",
    "sign_in_description": "您需要登录才能向档案馆提交文档。创建免费帐户以开始。",
    "sign_in_button": "登录以继续",
    "heading": "提交文档",
    "subtitle": "通过提交手册、广告、目录、调校指南或电气图纸，帮助我们扩充经典迷你文档档案。您的提交将由管理员审核后添加到档案中。",
    "seo": {
      "og_title": "提交文档 - Classic Mini DIY 档案馆",
      "og_description": "为 Classic Mini DIY 社区档案馆贡献文档。",
      "twitter_title": "提交文档 - Classic Mini DIY 档案馆",
      "twitter_description": "为 Classic Mini DIY 社区档案馆贡献文档。"
    },
    "form": {
      "card_title": "提交文档",
      "fields": {
        "type": {
          "label": "文档类型",
          "placeholder": "选择文档类型",
          "options": {
            "manual": "手册",
            "advert": "广告",
            "catalogue": "目录",
            "tuning": "调校",
            "electrical": "电气"
          }
        },
        "title": {
          "label": "标题",
          "placeholder": "例：Mini Cooper S 维修手册 1964"
        },
        "code": {
          "label": "零件/文档代码",
          "placeholder": "例：AKD4935",
          "help": "可选的零件编号或文档标识符"
        },
        "author": {
          "label": "作者/出版商",
          "placeholder": "例：British Leyland"
        },
        "year": {
          "label": "年份",
          "placeholder": "例：1974"
        },
        "description": {
          "label": "描述",
          "placeholder": "简要描述此文档及其内容"
        },
        "document_files": {
          "label": "文档文件"
        },
        "thumbnail": {
          "label": "缩略图",
          "help": "文档列表的可选封面图片"
        }
      },
      "collection": {
        "toggle": "这是合集的一部分",
        "toggle_help": "如果您正在上传多个相关文档作为一组，请启用此选项",
        "section_title": "合集详情",
        "title_label": "合集标题",
        "title_placeholder": "例：BMC 维修手册系列",
        "description_label": "合集描述",
        "description_placeholder": "描述这些文档之间的联系"
      },
      "submit": {
        "button": "提交文档",
        "submitting": "提交中..."
      },
      "success": {
        "title": "提交已收到！",
        "subtitle": "感谢您的贡献",
        "submission_id": "提交ID：",
        "pending_review": "您的提交正等待管理员审核。审核通过后将显示在文档档案中。",
        "make_another": "提交另一个文档",
        "view_submissions": "查看我的提交"
      },
      "error": {
        "title": "提交错误",
        "default_message": "提交文档时发生错误。请重试。",
        "title_required": "请输入文档标题。",
        "type_required": "请选择文档类型。",
        "files_required": "请至少上传一个文档文件。",
        "collection_title_required": "请输入合集标题。"
      }
    }
  },
  "ko": {
    "page_title": "문서 제출 - Classic Mini DIY 아카이브",
    "description": "Classic Mini DIY 아카이브에 새 문서를 제출하여 검토 및 커뮤니티 데이터베이스에 포함시킵니다.",
    "hero_title": "클래식 미니 아카이브",
    "breadcrumb_title": "문서 제출",
    "sign_in_title": "기여하려면 로그인하세요",
    "sign_in_description": "아카이브에 문서를 제출하려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
    "sign_in_button": "로그인하여 계속",
    "heading": "문서 제출",
    "subtitle": "매뉴얼, 광고, 카탈로그, 튜닝 가이드 또는 전기 도면을 제출하여 클래식 미니 문서 아카이브를 확장하는 데 도움을 주세요. 제출물은 아카이브에 추가되기 전에 관리자가 검토합니다.",
    "seo": {
      "og_title": "문서 제출 - Classic Mini DIY 아카이브",
      "og_description": "Classic Mini DIY 커뮤니티 아카이브에 문서를 기여하세요.",
      "twitter_title": "문서 제출 - Classic Mini DIY 아카이브",
      "twitter_description": "Classic Mini DIY 커뮤니티 아카이브에 문서를 기여하세요."
    },
    "form": {
      "card_title": "문서 제출",
      "fields": {
        "type": {
          "label": "문서 유형",
          "placeholder": "문서 유형 선택",
          "options": {
            "manual": "매뉴얼",
            "advert": "광고",
            "catalogue": "카탈로그",
            "tuning": "튜닝",
            "electrical": "전기"
          }
        },
        "title": {
          "label": "제목",
          "placeholder": "예: Mini Cooper S 정비 매뉴얼 1964"
        },
        "code": {
          "label": "부품/문서 코드",
          "placeholder": "예: AKD4935",
          "help": "선택적 부품 번호 또는 문서 식별자"
        },
        "author": {
          "label": "저자/출판사",
          "placeholder": "예: British Leyland"
        },
        "year": {
          "label": "연도",
          "placeholder": "예: 1974"
        },
        "description": {
          "label": "설명",
          "placeholder": "이 문서와 그 내용을 간략히 설명하세요"
        },
        "document_files": {
          "label": "문서 파일"
        },
        "thumbnail": {
          "label": "썸네일",
          "help": "문서 목록용 선택적 표지 이미지"
        }
      },
      "collection": {
        "toggle": "이것은 컬렉션의 일부입니다",
        "toggle_help": "여러 관련 문서를 그룹으로 업로드하는 경우 활성화하세요",
        "section_title": "컬렉션 세부사항",
        "title_label": "컬렉션 제목",
        "title_placeholder": "예: BMC 정비 매뉴얼 시리즈",
        "description_label": "컬렉션 설명",
        "description_placeholder": "이 문서들을 연결하는 것을 설명하세요"
      },
      "submit": {
        "button": "문서 제출",
        "submitting": "제출 중..."
      },
      "success": {
        "title": "제출이 접수되었습니다!",
        "subtitle": "기여해 주셔서 감사합니다",
        "submission_id": "제출 ID: ",
        "pending_review": "제출물이 관리자의 검토를 기다리고 있습니다. 승인되면 문서 아카이브에 표시됩니다.",
        "make_another": "다른 문서 제출",
        "view_submissions": "내 제출물 보기"
      },
      "error": {
        "title": "제출 오류",
        "default_message": "문서를 제출하는 중 오류가 발생했습니다. 다시 시도해 주세요.",
        "title_required": "문서 제목을 입력해 주세요.",
        "type_required": "문서 유형을 선택해 주세요.",
        "files_required": "최소 하나의 문서 파일을 업로드해 주세요.",
        "collection_title_required": "컬렉션 제목을 입력해 주세요."
      }
    }
  }
}
</i18n>
