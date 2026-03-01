<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../data/models/generic';

  const { capture } = usePostHog();
  const { isAuthenticated } = useAuth();
  const { submitNewItem } = useSubmissions();

  const submissionSuccess = ref(false);
  const apiError = ref(false);
  const submissionId = ref('');
  const apiMessage = ref('');
  const processing = ref(false);

  const formData = reactive({
    type: '',
    title: '',
    code: '',
    author: '',
    year: null as number | null,
    description: '',
    fileUrl: '',
  });

  const typeOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'advert', label: 'Advert' },
    { value: 'catalogue', label: 'Catalogue' },
    { value: 'tuning', label: 'Tuning' },
    { value: 'electrical', label: 'Electrical' },
  ];

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
    ogTitle: $t('title'),
    ogDescription: $t('description'),
    ogUrl: 'https://classicminidiy.com/archive/documents/submit',
    ogType: 'website',
  });

  async function submit() {
    if (!formData.type) {
      apiError.value = true;
      apiMessage.value = $t('form.error.type_required');
      return;
    }

    if (!formData.title) {
      apiError.value = true;
      apiMessage.value = $t('form.error.title_required');
      return;
    }

    processing.value = true;
    try {
      const response = await submitNewItem('document', {
        type: formData.type,
        title: formData.title,
        code: formData.code || undefined,
        author: formData.author || undefined,
        year: formData.year || undefined,
        description: formData.description || undefined,
        filePath: formData.fileUrl || undefined,
      });

      if (response) {
        submissionSuccess.value = true;
        apiError.value = false;
        submissionId.value = response.id;

        capture('form_submitted', {
          form: 'document_submission',
          document_type: formData.type,
        });
      } else {
        throw new Error('No response from server');
      }
    } catch (error) {
      submissionSuccess.value = false;
      apiError.value = true;
      apiMessage.value = $t('form.error.default_message');
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
    formData.fileUrl = '';
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
      <p class="mb-6 text-base">{{ $t('description_text') }}</p>
      <USeparator />
    </div>

    <!-- Auth Gate -->
    <div v-if="!isAuthenticated" class="max-w-lg mx-auto">
      <UCard>
        <div class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-lock text-5xl text-muted"></i>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ $t('auth.sign_in_title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ $t('auth.sign_in_description') }}</p>
          <UButton to="/login" color="primary" class="w-full">
            {{ $t('auth.sign_in_button') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Form -->
    <div v-else class="max-w-2xl mx-auto">
      <UCard>
        <!-- Success State -->
        <div v-if="submissionSuccess" class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-check-circle text-6xl text-success"></i>
          </div>
          <h1 class="text-2xl font-bold mb-2">{{ $t('form.success.title') }}</h1>
          <h2 class="text-xl mb-6">{{ $t('form.success.subtitle') }}</h2>
          <div class="space-y-4 text-left max-w-md mx-auto">
            <div class="bg-muted p-4 rounded-lg">
              <p class="font-medium">{{ $t('form.success.submission_id') }}{{ submissionId }}</p>
              <p class="text-sm opacity-70">{{ $t('form.success.pending_review') }}</p>
            </div>
            <UButton @click="resetForm" color="primary" class="w-full">
              {{ $t('form.success.make_another') }}
            </UButton>
          </div>
        </div>

        <!-- Form Body -->
        <div v-else>
          <div class="flex items-center bg-primary text-primary-content -m-4 mb-4 p-4 rounded-t-lg">
            <i class="fas fa-file-arrow-up mr-2"></i>
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
              <!-- Type -->
              <UFormField :label="`${$t('form.fields.type.label')} *`">
                <USelect
                  id="type"
                  v-model="formData.type"
                  :items="typeOptions"
                  :placeholder="$t('form.fields.type.placeholder')"
                  class="w-full"
                  :disabled="processing"
                  required
                />
              </UFormField>

              <!-- Title -->
              <UFormField :label="`${$t('form.fields.title.label')} *`">
                <UInput
                  id="title"
                  type="text"
                  v-model="formData.title"
                  :placeholder="$t('form.fields.title.placeholder')"
                  class="w-full"
                  :disabled="processing"
                  required
                  icon="i-fa6-solid-heading"
                />
              </UFormField>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Code -->
                <UFormField :label="$t('form.fields.code.label')" :help="$t('form.fields.code.help')">
                  <UInput
                    id="code"
                    type="text"
                    v-model="formData.code"
                    :placeholder="$t('form.fields.code.placeholder')"
                    class="w-full"
                    :disabled="processing"
                    icon="i-fa6-solid-barcode"
                  />
                </UFormField>

                <!-- Author -->
                <UFormField :label="$t('form.fields.author.label')">
                  <UInput
                    id="author"
                    type="text"
                    v-model="formData.author"
                    :placeholder="$t('form.fields.author.placeholder')"
                    class="w-full"
                    :disabled="processing"
                    icon="i-fa6-solid-user"
                  />
                </UFormField>
              </div>

              <!-- Year -->
              <UFormField :label="$t('form.fields.year.label')">
                <UInput
                  id="year"
                  type="number"
                  v-model.number="formData.year"
                  :placeholder="$t('form.fields.year.placeholder')"
                  class="w-full"
                  :disabled="processing"
                  min="1959"
                  max="2000"
                  icon="i-fa6-solid-calendar-days"
                />
              </UFormField>

              <!-- Description -->
              <UFormField :label="$t('form.fields.description.label')">
                <UTextarea
                  id="description"
                  v-model="formData.description"
                  :placeholder="$t('form.fields.description.placeholder')"
                  class="w-full"
                  :disabled="processing"
                  :rows="4"
                />
              </UFormField>

              <!-- File URL -->
              <UFormField :label="$t('form.fields.file_url.label')" :help="$t('form.fields.file_url.help')">
                <UInput
                  id="fileUrl"
                  type="url"
                  v-model="formData.fileUrl"
                  :placeholder="$t('form.fields.file_url.placeholder')"
                  class="w-full"
                  :disabled="processing"
                  icon="i-fa6-solid-link"
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
</template>

<i18n lang="json">
{
  "en": {
    "title": "Submit a Document - Classic Mini DIY Archive",
    "description": "Submit a new document to the Classic Mini DIY archive for review and inclusion in the community database.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Submit Document",
    "main_heading": "Submit a Document",
    "description_text": "Help us grow the Classic Mini document archive by submitting a manual, advert, catalogue, tuning guide, or electrical diagram. Your submission will be reviewed by a moderator before being added to the archive.",
    "auth": {
      "sign_in_title": "Sign In to Contribute",
      "sign_in_description": "You need to be signed in to submit documents to the archive. Create a free account to get started.",
      "sign_in_button": "Sign In to Continue"
    },
    "form": {
      "title": "Submit Document",
      "fields": {
        "type": {
          "label": "Document Type",
          "placeholder": "Select a document type"
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
        "file_url": {
          "label": "File URL",
          "placeholder": "Direct link to PDF or document file",
          "help": "Optional: direct URL to the document file if publicly available"
        }
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
        "make_another": "Submit Another Document"
      },
      "error": {
        "title": "Submission Error",
        "default_message": "There was an error submitting your document. Please try again.",
        "title_required": "Please enter a document title.",
        "type_required": "Please select a document type."
      }
    }
  },
  "de": {
    "title": "Dokument einreichen - Classic Mini DIY Archiv",
    "description": "Reichen Sie ein neues Dokument zur Überprüfung und Aufnahme in das Classic Mini DIY Archiv ein.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Dokument einreichen",
    "main_heading": "Dokument einreichen",
    "description_text": "Helfen Sie uns, das Classic Mini Dokumentenarchiv zu erweitern, indem Sie ein Handbuch, eine Werbung, einen Katalog, eine Tuning-Anleitung oder einen Schaltplan einreichen. Ihre Einreichung wird von einem Moderator geprüft, bevor sie in das Archiv aufgenommen wird.",
    "auth": {
      "sign_in_title": "Anmelden zum Beitragen",
      "sign_in_description": "Sie müssen angemeldet sein, um Dokumente zum Archiv beizutragen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
      "sign_in_button": "Anmelden und fortfahren"
    },
    "form": {
      "title": "Dokument einreichen",
      "fields": {
        "type": {
          "label": "Dokumenttyp",
          "placeholder": "Dokumenttyp auswählen"
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
        "file_url": {
          "label": "Datei-URL",
          "placeholder": "Direktlink zur PDF- oder Dokumentdatei",
          "help": "Optional: Direkte URL zur Dokumentdatei, falls öffentlich verfügbar"
        }
      },
      "submit": {
        "button": "Dokument einreichen",
        "submitting": "Wird eingereicht..."
      },
      "success": {
        "title": "Einreichung erhalten!",
        "subtitle": "Vielen Dank für Ihren Beitrag",
        "submission_id": "Einreichungs-ID: ",
        "pending_review": "Ihre Einreichung wird von einem Moderator geprüft. Nach der Genehmigung erscheint sie im Dokumentenarchiv.",
        "make_another": "Weiteres Dokument einreichen"
      },
      "error": {
        "title": "Einreichungsfehler",
        "default_message": "Beim Einreichen Ihres Dokuments ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
        "title_required": "Bitte geben Sie einen Dokumenttitel ein.",
        "type_required": "Bitte wählen Sie einen Dokumenttyp aus."
      }
    }
  },
  "es": {
    "title": "Enviar un documento - Archivo Classic Mini DIY",
    "description": "Envíe un nuevo documento para su revisión e inclusión en la base de datos comunitaria de Classic Mini DIY.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Enviar documento",
    "main_heading": "Enviar un documento",
    "description_text": "Ayúdenos a ampliar el archivo de documentos Classic Mini enviando un manual, un anuncio, un catálogo, una guía de modificación o un diagrama eléctrico. Su envío será revisado por un moderador antes de ser añadido al archivo.",
    "auth": {
      "sign_in_title": "Inicia sesión para contribuir",
      "sign_in_description": "Debes iniciar sesión para enviar documentos al archivo. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar sesión para continuar"
    },
    "form": {
      "title": "Enviar documento",
      "fields": {
        "type": {
          "label": "Tipo de documento",
          "placeholder": "Seleccionar tipo de documento"
        },
        "title": {
          "label": "Título",
          "placeholder": "p. ej. Manual de taller Mini Cooper S 1964"
        },
        "code": {
          "label": "Código de pieza / documento",
          "placeholder": "p. ej. AKD4935",
          "help": "Número de pieza o identificador de documento opcional"
        },
        "author": {
          "label": "Autor / Editor",
          "placeholder": "p. ej. British Leyland"
        },
        "year": {
          "label": "Año",
          "placeholder": "p. ej. 1974"
        },
        "description": {
          "label": "Descripción",
          "placeholder": "Describa brevemente este documento y su contenido"
        },
        "file_url": {
          "label": "URL del archivo",
          "placeholder": "Enlace directo al PDF o archivo del documento",
          "help": "Opcional: URL directa al archivo del documento si está disponible públicamente"
        }
      },
      "submit": {
        "button": "Enviar documento",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "¡Envío recibido!",
        "subtitle": "Gracias por tu contribución",
        "submission_id": "ID de envío: ",
        "pending_review": "Tu envío está pendiente de revisión por un moderador. Una vez aprobado, aparecerá en el archivo de documentos.",
        "make_another": "Enviar otro documento"
      },
      "error": {
        "title": "Error de envío",
        "default_message": "Hubo un error al enviar tu documento. Por favor, inténtalo de nuevo.",
        "title_required": "Por favor, introduce un título para el documento.",
        "type_required": "Por favor, selecciona un tipo de documento."
      }
    }
  },
  "fr": {
    "title": "Soumettre un document - Archives Classic Mini DIY",
    "description": "Soumettez un nouveau document pour examen et inclusion dans la base de données communautaire Classic Mini DIY.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Soumettre un document",
    "main_heading": "Soumettre un document",
    "description_text": "Aidez-nous à enrichir les archives de documents Classic Mini en soumettant un manuel, une publicité, un catalogue, un guide de tuning ou un schéma électrique. Votre soumission sera examinée par un modérateur avant d'être ajoutée aux archives.",
    "auth": {
      "sign_in_title": "Connectez-vous pour contribuer",
      "sign_in_description": "Vous devez être connecté pour soumettre des documents aux archives. Créez un compte gratuit pour commencer.",
      "sign_in_button": "Se connecter pour continuer"
    },
    "form": {
      "title": "Soumettre un document",
      "fields": {
        "type": {
          "label": "Type de document",
          "placeholder": "Sélectionner un type de document"
        },
        "title": {
          "label": "Titre",
          "placeholder": "ex. Manuel d'atelier Mini Cooper S 1964"
        },
        "code": {
          "label": "Code pièce / document",
          "placeholder": "ex. AKD4935",
          "help": "Numéro de pièce ou identifiant de document optionnel"
        },
        "author": {
          "label": "Auteur / Éditeur",
          "placeholder": "ex. British Leyland"
        },
        "year": {
          "label": "Année",
          "placeholder": "ex. 1974"
        },
        "description": {
          "label": "Description",
          "placeholder": "Décrivez brièvement ce document et son contenu"
        },
        "file_url": {
          "label": "URL du fichier",
          "placeholder": "Lien direct vers le PDF ou le fichier document",
          "help": "Optionnel : URL directe vers le fichier document si disponible publiquement"
        }
      },
      "submit": {
        "button": "Soumettre le document",
        "submitting": "Soumission en cours..."
      },
      "success": {
        "title": "Soumission reçue !",
        "subtitle": "Merci pour votre contribution",
        "submission_id": "ID de soumission : ",
        "pending_review": "Votre soumission est en attente de révision par un modérateur. Une fois approuvée, elle apparaîtra dans les archives de documents.",
        "make_another": "Soumettre un autre document"
      },
      "error": {
        "title": "Erreur de soumission",
        "default_message": "Une erreur s'est produite lors de la soumission de votre document. Veuillez réessayer.",
        "title_required": "Veuillez saisir un titre de document.",
        "type_required": "Veuillez sélectionner un type de document."
      }
    }
  },
  "it": {
    "title": "Invia un documento - Archivio Classic Mini DIY",
    "description": "Invia un nuovo documento per la revisione e l'inclusione nel database della comunità Classic Mini DIY.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Invia documento",
    "main_heading": "Invia un documento",
    "description_text": "Aiutaci ad ampliare l'archivio di documenti Classic Mini inviando un manuale, un annuncio, un catalogo, una guida al tuning o uno schema elettrico. La tua proposta sarà esaminata da un moderatore prima di essere aggiunta all'archivio.",
    "auth": {
      "sign_in_title": "Accedi per contribuire",
      "sign_in_description": "Devi essere connesso per inviare documenti all'archivio. Crea un account gratuito per iniziare.",
      "sign_in_button": "Accedi per continuare"
    },
    "form": {
      "title": "Invia documento",
      "fields": {
        "type": {
          "label": "Tipo di documento",
          "placeholder": "Seleziona un tipo di documento"
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
        "file_url": {
          "label": "URL del file",
          "placeholder": "Link diretto al PDF o al file del documento",
          "help": "Facoltativo: URL diretto al file del documento se disponibile pubblicamente"
        }
      },
      "submit": {
        "button": "Invia documento",
        "submitting": "Invio in corso..."
      },
      "success": {
        "title": "Proposta ricevuta!",
        "subtitle": "Grazie per il tuo contributo",
        "submission_id": "ID proposta: ",
        "pending_review": "La tua proposta è in attesa di revisione da parte di un moderatore. Una volta approvata, apparirà nell'archivio documenti.",
        "make_another": "Invia un altro documento"
      },
      "error": {
        "title": "Errore di invio",
        "default_message": "Si è verificato un errore durante l'invio del documento. Riprova.",
        "title_required": "Inserisci un titolo per il documento.",
        "type_required": "Seleziona un tipo di documento."
      }
    }
  },
  "pt": {
    "title": "Enviar um documento - Arquivo Classic Mini DIY",
    "description": "Envie um novo documento para revisão e inclusão no banco de dados comunitário do Classic Mini DIY.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Enviar documento",
    "main_heading": "Enviar um documento",
    "description_text": "Ajude-nos a ampliar o arquivo de documentos Classic Mini enviando um manual, um anúncio, um catálogo, um guia de modificação ou um diagrama elétrico. Seu envio será revisado por um moderador antes de ser adicionado ao arquivo.",
    "auth": {
      "sign_in_title": "Entre para contribuir",
      "sign_in_description": "Você precisa estar conectado para enviar documentos ao arquivo. Crie uma conta gratuita para começar.",
      "sign_in_button": "Entrar para continuar"
    },
    "form": {
      "title": "Enviar documento",
      "fields": {
        "type": {
          "label": "Tipo de documento",
          "placeholder": "Selecionar tipo de documento"
        },
        "title": {
          "label": "Título",
          "placeholder": "ex. Manual de oficina Mini Cooper S 1964"
        },
        "code": {
          "label": "Código da peça / documento",
          "placeholder": "ex. AKD4935",
          "help": "Número de peça ou identificador de documento opcional"
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
          "label": "Descrição",
          "placeholder": "Descreva brevemente este documento e seu conteúdo"
        },
        "file_url": {
          "label": "URL do arquivo",
          "placeholder": "Link direto para o PDF ou arquivo do documento",
          "help": "Opcional: URL direta para o arquivo do documento se disponível publicamente"
        }
      },
      "submit": {
        "button": "Enviar documento",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "Envio recebido!",
        "subtitle": "Obrigado pela sua contribuição",
        "submission_id": "ID do envio: ",
        "pending_review": "Seu envio está pendente de revisão por um moderador. Uma vez aprovado, aparecerá no arquivo de documentos.",
        "make_another": "Enviar outro documento"
      },
      "error": {
        "title": "Erro no envio",
        "default_message": "Ocorreu um erro ao enviar seu documento. Por favor, tente novamente.",
        "title_required": "Por favor, insira um título para o documento.",
        "type_required": "Por favor, selecione um tipo de documento."
      }
    }
  },
  "nl": {
    "title": "Document indienen - Classic Mini DIY Archief",
    "description": "Dien een nieuw document in voor beoordeling en opname in de Classic Mini DIY gemeenschapsdatabase.",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Document indienen",
    "main_heading": "Document indienen",
    "description_text": "Help ons het Classic Mini documentenarchief uit te breiden door een handleiding, advertentie, catalogus, tuninggids of elektrisch schema in te dienen. Uw inzending wordt beoordeeld door een moderator voordat deze aan het archief wordt toegevoegd.",
    "auth": {
      "sign_in_title": "Inloggen om bij te dragen",
      "sign_in_description": "U moet ingelogd zijn om documenten in te dienen bij het archief. Maak een gratis account aan om te beginnen.",
      "sign_in_button": "Inloggen om door te gaan"
    },
    "form": {
      "title": "Document indienen",
      "fields": {
        "type": {
          "label": "Documenttype",
          "placeholder": "Selecteer een documenttype"
        },
        "title": {
          "label": "Titel",
          "placeholder": "bijv. Mini Cooper S Werkplaatshandboek 1964"
        },
        "code": {
          "label": "Onderdeel-/documentcode",
          "placeholder": "bijv. AKD4935",
          "help": "Optioneel onderdeel- of documentnummer"
        },
        "author": {
          "label": "Auteur / Uitgever",
          "placeholder": "bijv. British Leyland"
        },
        "year": {
          "label": "Jaar",
          "placeholder": "bijv. 1974"
        },
        "description": {
          "label": "Beschrijving",
          "placeholder": "Beschrijf dit document en de inhoud kort"
        },
        "file_url": {
          "label": "Bestands-URL",
          "placeholder": "Directe link naar PDF of documentbestand",
          "help": "Optioneel: directe URL naar het documentbestand indien openbaar beschikbaar"
        }
      },
      "submit": {
        "button": "Document indienen",
        "submitting": "Wordt ingediend..."
      },
      "success": {
        "title": "Inzending ontvangen!",
        "subtitle": "Bedankt voor uw bijdrage",
        "submission_id": "Inzending-ID: ",
        "pending_review": "Uw inzending wordt beoordeeld door een moderator. Na goedkeuring verschijnt het in het documentenarchief.",
        "make_another": "Nog een document indienen"
      },
      "error": {
        "title": "Inzendingsfout",
        "default_message": "Er is een fout opgetreden bij het indienen van uw document. Probeer het opnieuw.",
        "title_required": "Voer een documenttitel in.",
        "type_required": "Selecteer een documenttype."
      }
    }
  },
  "sv": {
    "title": "Skicka in ett dokument - Classic Mini DIY Arkiv",
    "description": "Skicka in ett nytt dokument för granskning och inkludering i Classic Mini DIY gemenskapsdatabasen.",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Skicka in dokument",
    "main_heading": "Skicka in ett dokument",
    "description_text": "Hjälp oss att utöka Classic Mini dokumentarkivet genom att skicka in en handbok, annons, katalog, tuningguide eller elschema. Ditt bidrag granskas av en moderator innan det läggs till i arkivet.",
    "auth": {
      "sign_in_title": "Logga in för att bidra",
      "sign_in_description": "Du måste vara inloggad för att skicka in dokument till arkivet. Skapa ett gratis konto för att komma igång.",
      "sign_in_button": "Logga in för att fortsätta"
    },
    "form": {
      "title": "Skicka in dokument",
      "fields": {
        "type": {
          "label": "Dokumenttyp",
          "placeholder": "Välj en dokumenttyp"
        },
        "title": {
          "label": "Titel",
          "placeholder": "t.ex. Mini Cooper S Verkstadshandbok 1964"
        },
        "code": {
          "label": "Del-/dokumentkod",
          "placeholder": "t.ex. AKD4935",
          "help": "Valfritt delnummer eller dokumentidentifierare"
        },
        "author": {
          "label": "Författare / Utgivare",
          "placeholder": "t.ex. British Leyland"
        },
        "year": {
          "label": "År",
          "placeholder": "t.ex. 1974"
        },
        "description": {
          "label": "Beskrivning",
          "placeholder": "Beskriv kortfattat detta dokument och dess innehåll"
        },
        "file_url": {
          "label": "Fil-URL",
          "placeholder": "Direktlänk till PDF eller dokumentfil",
          "help": "Valfritt: direkt URL till dokumentfilen om den är offentligt tillgänglig"
        }
      },
      "submit": {
        "button": "Skicka in dokument",
        "submitting": "Skickar in..."
      },
      "success": {
        "title": "Inlämning mottagen!",
        "subtitle": "Tack för ditt bidrag",
        "submission_id": "Inlämnings-ID: ",
        "pending_review": "Din inlämning väntar på granskning av en moderator. När den godkänts visas den i dokumentarkivet.",
        "make_another": "Skicka in ytterligare ett dokument"
      },
      "error": {
        "title": "Inlämningsfel",
        "default_message": "Ett fel uppstod när ditt dokument skickades in. Försök igen.",
        "title_required": "Ange en dokumenttitel.",
        "type_required": "Välj en dokumenttyp."
      }
    }
  },
  "da": {
    "title": "Indsend et dokument - Classic Mini DIY Arkiv",
    "description": "Indsend et nyt dokument til gennemsyn og inkludering i Classic Mini DIY fællesskabsdatabasen.",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Indsend dokument",
    "main_heading": "Indsend et dokument",
    "description_text": "Hjælp os med at udvide Classic Mini dokumentarkivet ved at indsende en håndbog, annonce, katalog, tuningguide eller eldiagram. Dit bidrag gennemgås af en moderator, inden det tilføjes til arkivet.",
    "auth": {
      "sign_in_title": "Log ind for at bidrage",
      "sign_in_description": "Du skal være logget ind for at indsende dokumenter til arkivet. Opret en gratis konto for at komme i gang.",
      "sign_in_button": "Log ind for at fortsætte"
    },
    "form": {
      "title": "Indsend dokument",
      "fields": {
        "type": {
          "label": "Dokumenttype",
          "placeholder": "Vælg en dokumenttype"
        },
        "title": {
          "label": "Titel",
          "placeholder": "f.eks. Mini Cooper S Værkstedshåndbog 1964"
        },
        "code": {
          "label": "Del-/dokumentkode",
          "placeholder": "f.eks. AKD4935",
          "help": "Valgfrit delnummer eller dokumentidentifikator"
        },
        "author": {
          "label": "Forfatter / Udgiver",
          "placeholder": "f.eks. British Leyland"
        },
        "year": {
          "label": "År",
          "placeholder": "f.eks. 1974"
        },
        "description": {
          "label": "Beskrivelse",
          "placeholder": "Beskriv kort dette dokument og dets indhold"
        },
        "file_url": {
          "label": "Fil-URL",
          "placeholder": "Direkte link til PDF eller dokumentfil",
          "help": "Valgfrit: direkte URL til dokumentfilen, hvis den er offentligt tilgængelig"
        }
      },
      "submit": {
        "button": "Indsend dokument",
        "submitting": "Indsender..."
      },
      "success": {
        "title": "Indsendelse modtaget!",
        "subtitle": "Tak for dit bidrag",
        "submission_id": "Indsendelsens ID: ",
        "pending_review": "Din indsendelse afventer gennemsyn af en moderator. Når den er godkendt, vises den i dokumentarkivet.",
        "make_another": "Indsend et andet dokument"
      },
      "error": {
        "title": "Indsendingsfejl",
        "default_message": "Der opstod en fejl ved indsendelse af dit dokument. Prøv igen.",
        "title_required": "Angiv en dokumenttitel.",
        "type_required": "Vælg en dokumenttype."
      }
    }
  },
  "no": {
    "title": "Send inn et dokument - Classic Mini DIY Arkiv",
    "description": "Send inn et nytt dokument for gjennomgang og inkludering i Classic Mini DIY fellesskapsdatabasen.",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Send inn dokument",
    "main_heading": "Send inn et dokument",
    "description_text": "Hjelp oss med å utvide Classic Mini dokumentarkivet ved å sende inn en håndbok, annonse, katalog, tuningguide eller elektrisk diagram. Ditt bidrag vil bli gjennomgått av en moderator før det legges til i arkivet.",
    "auth": {
      "sign_in_title": "Logg inn for å bidra",
      "sign_in_description": "Du må være logget inn for å sende inn dokumenter til arkivet. Opprett en gratis konto for å komme i gang.",
      "sign_in_button": "Logg inn for å fortsette"
    },
    "form": {
      "title": "Send inn dokument",
      "fields": {
        "type": {
          "label": "Dokumenttype",
          "placeholder": "Velg en dokumenttype"
        },
        "title": {
          "label": "Tittel",
          "placeholder": "f.eks. Mini Cooper S Verkstedhåndbok 1964"
        },
        "code": {
          "label": "Del-/dokumentkode",
          "placeholder": "f.eks. AKD4935",
          "help": "Valgfritt delnummer eller dokumentidentifikator"
        },
        "author": {
          "label": "Forfatter / Utgiver",
          "placeholder": "f.eks. British Leyland"
        },
        "year": {
          "label": "År",
          "placeholder": "f.eks. 1974"
        },
        "description": {
          "label": "Beskrivelse",
          "placeholder": "Beskriv kort dette dokumentet og dets innhold"
        },
        "file_url": {
          "label": "Fil-URL",
          "placeholder": "Direktelenke til PDF eller dokumentfil",
          "help": "Valgfritt: direkte URL til dokumentfilen hvis den er offentlig tilgjengelig"
        }
      },
      "submit": {
        "button": "Send inn dokument",
        "submitting": "Sender inn..."
      },
      "success": {
        "title": "Innsending mottatt!",
        "subtitle": "Takk for ditt bidrag",
        "submission_id": "Innsendingsens ID: ",
        "pending_review": "Din innsending venter på gjennomgang av en moderator. Når den er godkjent, vises den i dokumentarkivet.",
        "make_another": "Send inn et annet dokument"
      },
      "error": {
        "title": "Innsendingsfeil",
        "default_message": "Det oppstod en feil ved innsending av dokumentet ditt. Prøv igjen.",
        "title_required": "Skriv inn en dokumenttittel.",
        "type_required": "Velg en dokumenttype."
      }
    }
  }
}
</i18n>
