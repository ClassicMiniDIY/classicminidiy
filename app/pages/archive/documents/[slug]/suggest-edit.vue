<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../../data/models/generic';

  const { capture } = usePostHog();
  const route = useRoute();
  const slug = route.params.slug as string;
  const { user, isAuthenticated, waitForAuth } = useAuth();
  const supabase = useSupabase();

  await waitForAuth();

  // Fetch document row directly to get the ID (ArchiveDocumentItem doesn't expose it)
  const { data: docRow, status } = await useAsyncData(`doc-row-${slug}`, async () => {
    const { data } = await supabase
      .from('archive_documents')
      .select('id, title, description, code, slug')
      .eq('slug', slug)
      .eq('status', 'approved')
      .maybeSingle();
    return data;
  });

  useHead({
    title: $t('title'),
    meta: [
      { name: 'description', content: $t('description') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });

  useSeoMeta({
    ogTitle: $t('title'),
    ogDescription: $t('description'),
    ogType: 'website',
  });

  const submissionSuccess = ref(false);
  const apiError = ref(false);
  const apiMessage = ref('');
  const processing = ref(false);
  const submissionId = ref('');

  const formData = reactive({
    title: docRow.value?.title || '',
    code: docRow.value?.code || '',
    description: docRow.value?.description || '',
    reason: '',
  });

  // Keep formData in sync if docRow loads asynchronously
  watch(docRow, (newDoc) => {
    if (newDoc) {
      formData.title = newDoc.title || '';
      formData.code = newDoc.code || '';
      formData.description = newDoc.description || '';
    }
  });

  async function submit() {
    apiError.value = false;
    apiMessage.value = '';

    if (!formData.reason.trim()) {
      apiError.value = true;
      apiMessage.value = $t('form.error.reason_required');
      return;
    }

    if (!docRow.value?.id) {
      apiError.value = true;
      apiMessage.value = $t('form.error.default_message');
      return;
    }

    // Build changes object — only include fields that actually differ
    const changes: Record<string, { from: string; to: string }> = {};

    if (formData.title.trim() !== (docRow.value.title || '').trim()) {
      changes['title'] = { from: docRow.value.title || '', to: formData.title.trim() };
    }
    if (formData.code.trim() !== (docRow.value.code || '').trim()) {
      changes['code'] = { from: docRow.value.code || '', to: formData.code.trim() };
    }
    if (formData.description.trim() !== (docRow.value.description || '').trim()) {
      changes['description'] = { from: docRow.value.description || '', to: formData.description.trim() };
    }

    if (Object.keys(changes).length === 0) {
      apiError.value = true;
      apiMessage.value = $t('form.error.no_changes');
      return;
    }

    processing.value = true;

    try {
      const { submitEditSuggestion } = useSubmissions();
      const result = await submitEditSuggestion('document', docRow.value.id, changes, formData.reason.trim());

      submissionId.value = result.id;
      submissionSuccess.value = true;
      apiError.value = false;

      capture('edit_suggestion_submitted', {
        target_type: 'document',
        target_id: docRow.value.id,
        slug,
        changed_fields: Object.keys(changes),
      });
    } catch (error) {
      submissionSuccess.value = false;
      apiError.value = true;
      apiMessage.value = $t('form.error.default_message');
      console.error('Error submitting edit suggestion:', error);
    } finally {
      processing.value = false;
    }
  }
</script>

<template>
  <Hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <!-- Breadcrumb -->
    <div class="mb-6">
      <Breadcrumb :page="$t('breadcrumb_title')" subpage="Documents" subpageHref="/archive/documents" />
    </div>

    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-4">{{ $t('main_heading') }}</h1>
      <p class="mb-6 text-base">{{ $t('description_text') }}</p>
      <USeparator />
    </div>

    <!-- Auth gate -->
    <div v-if="!isAuthenticated">
      <UCard class="max-w-lg mx-auto text-center p-8">
        <div class="mb-4">
          <i class="fas fa-lock text-5xl text-warning"></i>
        </div>
        <h2 class="text-2xl font-bold mb-2">{{ $t('auth.sign_in_title') }}</h2>
        <p class="mb-6 opacity-70">{{ $t('auth.sign_in_description') }}</p>
        <UButton color="primary" to="/login" class="w-full">
          {{ $t('auth.sign_in_button') }}
        </UButton>
      </UCard>
    </div>

    <!-- Loading state -->
    <div v-else-if="status === 'pending'" class="flex justify-center p-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Not found state -->
    <div v-else-if="!docRow" class="max-w-lg mx-auto text-center p-8">
      <div class="mb-4">
        <i class="fas fa-file-slash text-5xl opacity-50"></i>
      </div>
      <h2 class="text-2xl font-bold mb-2">{{ $t('not_found.title') }}</h2>
      <p class="mb-6 opacity-70">{{ $t('not_found.description') }}</p>
      <UButton variant="outline" to="/archive/documents">
        {{ $t('not_found.back') }}
      </UButton>
    </div>

    <!-- Two-column form layout -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left column: Current Values -->
      <div class="lg:col-span-1">
        <UCard>
          <template #header>
            <div class="flex items-center bg-muted -m-4 p-4">
              <i class="fas fa-list-timeline mr-2"></i>
              <h2 class="text-lg font-semibold">{{ $t('current.title') }}</h2>
            </div>
          </template>

          <div class="space-y-4 p-2">
            <div>
              <label class="text-sm font-medium opacity-70">{{ $t('current.labels.title') }}</label>
              <p class="mt-1 text-sm font-medium">{{ docRow.title || '—' }}</p>
            </div>
            <USeparator />
            <div>
              <label class="text-sm font-medium opacity-70">{{ $t('current.labels.code') }}</label>
              <p class="mt-1 text-sm font-medium">{{ docRow.code || '—' }}</p>
            </div>
            <USeparator />
            <div>
              <label class="text-sm font-medium opacity-70">{{ $t('current.labels.description') }}</label>
              <p class="mt-1 text-sm">{{ docRow.description || '—' }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Right column: Edit Form -->
      <div class="lg:col-span-2">
        <UCard>
          <!-- Success state -->
          <div v-if="submissionSuccess" class="p-6 text-center">
            <div class="mb-4">
              <i class="fas fa-check-circle text-6xl text-success"></i>
            </div>
            <h2 class="text-2xl font-bold mb-2">{{ $t('form.success.title') }}</h2>
            <h3 class="text-xl mb-6 opacity-80">{{ $t('form.success.subtitle') }}</h3>
            <div class="space-y-4 text-left max-w-md mx-auto">
              <div class="bg-muted p-4 rounded-lg">
                <p class="font-medium">{{ $t('form.success.submission_id') }}{{ submissionId }}</p>
                <p class="text-sm opacity-70 mt-1">{{ $t('form.success.pending_review') }}</p>
              </div>
              <UButton
                variant="outline"
                :to="`/archive/documents/${slug}`"
                class="w-full"
              >
                {{ $t('form.success.back_to_document') }}
              </UButton>
            </div>
          </div>

          <!-- Form -->
          <div v-else>
            <div class="flex items-center bg-primary text-primary-content -m-4 mb-4 p-4 rounded-t-lg">
              <i class="fas fa-pen-to-square mr-2"></i>
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

              <form @submit.prevent="submit" class="space-y-4">
                <!-- Title -->
                <UFormField :label="$t('form.fields.title.label')">
                  <UInput
                    id="title"
                    type="text"
                    v-model="formData.title"
                    :placeholder="$t('form.fields.title.placeholder')"
                    class="w-full"
                    :disabled="processing"
                    icon="i-fa6-solid-heading"
                  />
                </UFormField>

                <!-- Code -->
                <UFormField :label="$t('form.fields.code.label')">
                  <UInput
                    id="code"
                    type="text"
                    v-model="formData.code"
                    :placeholder="$t('form.fields.code.placeholder')"
                    class="w-full"
                    :disabled="processing"
                    icon="i-fa6-solid-code"
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

                <USeparator />

                <!-- Reason (required) -->
                <UFormField
                  :label="`${$t('form.fields.reason.label')} *`"
                  :help="$t('form.fields.reason.help')"
                >
                  <UTextarea
                    id="reason"
                    v-model="formData.reason"
                    :placeholder="$t('form.fields.reason.placeholder')"
                    class="w-full"
                    :disabled="processing"
                    :rows="3"
                    required
                  />
                </UFormField>

                <div class="pt-4">
                  <UButton
                    type="submit"
                    color="primary"
                    class="w-full"
                    :disabled="processing"
                    :loading="processing"
                  >
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

<i18n lang="json">
{
  "en": {
    "title": "Suggest an Edit - Classic Mini Archive",
    "description": "Suggest corrections or improvements to an archive document listing",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Suggest Edit",
    "main_heading": "Suggest an Edit",
    "description_text": "Found something incorrect or incomplete? Help improve the archive by suggesting an edit to this document. Your suggestion will be reviewed by a moderator before any changes are applied.",
    "auth": {
      "sign_in_title": "Sign In Required",
      "sign_in_description": "You must be signed in to suggest edits to archive documents.",
      "sign_in_button": "Sign In"
    },
    "not_found": {
      "title": "Document Not Found",
      "description": "The document you are trying to edit could not be found.",
      "back": "Back to Documents"
    },
    "current": {
      "title": "Current Values",
      "labels": {
        "title": "Title",
        "code": "Code",
        "description": "Description"
      }
    },
    "form": {
      "title": "Proposed Changes",
      "fields": {
        "title": {
          "label": "Title",
          "placeholder": "Enter corrected title"
        },
        "code": {
          "label": "Code / Reference Number",
          "placeholder": "Enter corrected code"
        },
        "description": {
          "label": "Description",
          "placeholder": "Enter corrected description"
        },
        "reason": {
          "label": "Reason for Edit",
          "placeholder": "Explain why this change is needed...",
          "help": "Please describe the source of your correction (e.g. original document, factory records, etc.)"
        }
      },
      "submit": {
        "button": "Submit Edit Suggestion",
        "submitting": "Submitting..."
      },
      "success": {
        "title": "Suggestion Submitted!",
        "subtitle": "Thank you for helping improve the archive.",
        "submission_id": "Submission ID: ",
        "pending_review": "Your suggestion is pending review by a moderator. Once approved, the changes will be applied to the document.",
        "back_to_document": "Back to Document"
      },
      "error": {
        "title": "Submission Error",
        "default_message": "There was an error submitting your suggestion. Please try again.",
        "no_changes": "No changes detected. Please modify at least one field before submitting.",
        "reason_required": "Please provide a reason for your edit suggestion."
      }
    }
  },
  "de": {
    "title": "Bearbeitung vorschlagen - Classic Mini Archiv",
    "description": "Korrekturen oder Verbesserungen an einem Archivdokument vorschlagen",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Bearbeitung vorschlagen",
    "main_heading": "Bearbeitung vorschlagen",
    "description_text": "Etwas Falsches oder Unvollständiges gefunden? Helfen Sie dabei, das Archiv zu verbessern, indem Sie eine Bearbeitung für dieses Dokument vorschlagen. Ihr Vorschlag wird von einem Moderator geprüft, bevor Änderungen vorgenommen werden.",
    "auth": {
      "sign_in_title": "Anmeldung erforderlich",
      "sign_in_description": "Sie müssen angemeldet sein, um Bearbeitungen an Archivdokumenten vorzuschlagen.",
      "sign_in_button": "Anmelden"
    },
    "not_found": {
      "title": "Dokument nicht gefunden",
      "description": "Das Dokument, das Sie bearbeiten möchten, konnte nicht gefunden werden.",
      "back": "Zurück zu Dokumenten"
    },
    "current": {
      "title": "Aktuelle Werte",
      "labels": {
        "title": "Titel",
        "code": "Code",
        "description": "Beschreibung"
      }
    },
    "form": {
      "title": "Vorgeschlagene Änderungen",
      "fields": {
        "title": {
          "label": "Titel",
          "placeholder": "Korrigierten Titel eingeben"
        },
        "code": {
          "label": "Code / Referenznummer",
          "placeholder": "Korrigierten Code eingeben"
        },
        "description": {
          "label": "Beschreibung",
          "placeholder": "Korrigierte Beschreibung eingeben"
        },
        "reason": {
          "label": "Grund für die Bearbeitung",
          "placeholder": "Erklären Sie, warum diese Änderung erforderlich ist...",
          "help": "Bitte beschreiben Sie die Quelle Ihrer Korrektur (z.B. Originaldokument, Fabrikaufzeichnungen usw.)"
        }
      },
      "submit": {
        "button": "Bearbeitungsvorschlag einreichen",
        "submitting": "Wird eingereicht..."
      },
      "success": {
        "title": "Vorschlag eingereicht!",
        "subtitle": "Vielen Dank, dass Sie zur Verbesserung des Archivs beitragen.",
        "submission_id": "Einreichungs-ID: ",
        "pending_review": "Ihr Vorschlag wird von einem Moderator geprüft. Nach der Genehmigung werden die Änderungen am Dokument vorgenommen.",
        "back_to_document": "Zurück zum Dokument"
      },
      "error": {
        "title": "Einreichungsfehler",
        "default_message": "Bei der Einreichung Ihres Vorschlags ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
        "no_changes": "Keine Änderungen erkannt. Bitte ändern Sie mindestens ein Feld, bevor Sie einreichen.",
        "reason_required": "Bitte geben Sie einen Grund für Ihren Bearbeitungsvorschlag an."
      }
    }
  },
  "es": {
    "title": "Sugerir una edición - Archivo Classic Mini",
    "description": "Sugerir correcciones o mejoras a un documento del archivo",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Sugerir edición",
    "main_heading": "Sugerir una edición",
    "description_text": "¿Encontraste algo incorrecto o incompleto? Ayuda a mejorar el archivo sugiriendo una edición para este documento. Tu sugerencia será revisada por un moderador antes de aplicar cualquier cambio.",
    "auth": {
      "sign_in_title": "Inicio de sesión requerido",
      "sign_in_description": "Debes iniciar sesión para sugerir ediciones a los documentos del archivo.",
      "sign_in_button": "Iniciar sesión"
    },
    "not_found": {
      "title": "Documento no encontrado",
      "description": "El documento que intentas editar no pudo ser encontrado.",
      "back": "Volver a documentos"
    },
    "current": {
      "title": "Valores actuales",
      "labels": {
        "title": "Título",
        "code": "Código",
        "description": "Descripción"
      }
    },
    "form": {
      "title": "Cambios propuestos",
      "fields": {
        "title": {
          "label": "Título",
          "placeholder": "Ingresa el título corregido"
        },
        "code": {
          "label": "Código / Número de referencia",
          "placeholder": "Ingresa el código corregido"
        },
        "description": {
          "label": "Descripción",
          "placeholder": "Ingresa la descripción corregida"
        },
        "reason": {
          "label": "Motivo de la edición",
          "placeholder": "Explica por qué se necesita este cambio...",
          "help": "Por favor describe la fuente de tu corrección (p.ej. documento original, registros de fábrica, etc.)"
        }
      },
      "submit": {
        "button": "Enviar sugerencia de edición",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "¡Sugerencia enviada!",
        "subtitle": "Gracias por ayudar a mejorar el archivo.",
        "submission_id": "ID de envío: ",
        "pending_review": "Tu sugerencia está pendiente de revisión por un moderador. Una vez aprobada, los cambios se aplicarán al documento.",
        "back_to_document": "Volver al documento"
      },
      "error": {
        "title": "Error al enviar",
        "default_message": "Hubo un error al enviar tu sugerencia. Por favor intenta de nuevo.",
        "no_changes": "No se detectaron cambios. Por favor modifica al menos un campo antes de enviar.",
        "reason_required": "Por favor proporciona un motivo para tu sugerencia de edición."
      }
    }
  },
  "fr": {
    "title": "Suggérer une modification - Archives Classic Mini",
    "description": "Suggérer des corrections ou des améliorations à un document d'archive",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Suggérer une modification",
    "main_heading": "Suggérer une modification",
    "description_text": "Vous avez trouvé quelque chose d'incorrect ou d'incomplet ? Aidez à améliorer les archives en suggérant une modification pour ce document. Votre suggestion sera examinée par un modérateur avant l'application des changements.",
    "auth": {
      "sign_in_title": "Connexion requise",
      "sign_in_description": "Vous devez être connecté pour suggérer des modifications aux documents d'archive.",
      "sign_in_button": "Se connecter"
    },
    "not_found": {
      "title": "Document introuvable",
      "description": "Le document que vous essayez de modifier est introuvable.",
      "back": "Retour aux documents"
    },
    "current": {
      "title": "Valeurs actuelles",
      "labels": {
        "title": "Titre",
        "code": "Code",
        "description": "Description"
      }
    },
    "form": {
      "title": "Modifications proposées",
      "fields": {
        "title": {
          "label": "Titre",
          "placeholder": "Saisir le titre corrigé"
        },
        "code": {
          "label": "Code / Numéro de référence",
          "placeholder": "Saisir le code corrigé"
        },
        "description": {
          "label": "Description",
          "placeholder": "Saisir la description corrigée"
        },
        "reason": {
          "label": "Raison de la modification",
          "placeholder": "Expliquez pourquoi ce changement est nécessaire...",
          "help": "Veuillez décrire la source de votre correction (par ex. document original, archives d'usine, etc.)"
        }
      },
      "submit": {
        "button": "Soumettre la suggestion de modification",
        "submitting": "Envoi en cours..."
      },
      "success": {
        "title": "Suggestion soumise !",
        "subtitle": "Merci de contribuer à l'amélioration des archives.",
        "submission_id": "ID de soumission : ",
        "pending_review": "Votre suggestion est en attente de révision par un modérateur. Une fois approuvée, les modifications seront appliquées au document.",
        "back_to_document": "Retour au document"
      },
      "error": {
        "title": "Erreur de soumission",
        "default_message": "Une erreur s'est produite lors de la soumission de votre suggestion. Veuillez réessayer.",
        "no_changes": "Aucun changement détecté. Veuillez modifier au moins un champ avant de soumettre.",
        "reason_required": "Veuillez indiquer une raison pour votre suggestion de modification."
      }
    }
  },
  "it": {
    "title": "Suggerisci una modifica - Archivio Classic Mini",
    "description": "Suggerisci correzioni o miglioramenti a un documento dell'archivio",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Suggerisci modifica",
    "main_heading": "Suggerisci una modifica",
    "description_text": "Hai trovato qualcosa di errato o incompleto? Aiuta a migliorare l'archivio suggerendo una modifica a questo documento. Il tuo suggerimento sarà esaminato da un moderatore prima che vengano applicate modifiche.",
    "auth": {
      "sign_in_title": "Accesso richiesto",
      "sign_in_description": "Devi essere connesso per suggerire modifiche ai documenti dell'archivio.",
      "sign_in_button": "Accedi"
    },
    "not_found": {
      "title": "Documento non trovato",
      "description": "Il documento che stai cercando di modificare non è stato trovato.",
      "back": "Torna ai documenti"
    },
    "current": {
      "title": "Valori attuali",
      "labels": {
        "title": "Titolo",
        "code": "Codice",
        "description": "Descrizione"
      }
    },
    "form": {
      "title": "Modifiche proposte",
      "fields": {
        "title": {
          "label": "Titolo",
          "placeholder": "Inserisci il titolo corretto"
        },
        "code": {
          "label": "Codice / Numero di riferimento",
          "placeholder": "Inserisci il codice corretto"
        },
        "description": {
          "label": "Descrizione",
          "placeholder": "Inserisci la descrizione corretta"
        },
        "reason": {
          "label": "Motivo della modifica",
          "placeholder": "Spiega perché è necessaria questa modifica...",
          "help": "Descrivi la fonte della tua correzione (es. documento originale, archivi di fabbrica, ecc.)"
        }
      },
      "submit": {
        "button": "Invia suggerimento di modifica",
        "submitting": "Invio in corso..."
      },
      "success": {
        "title": "Suggerimento inviato!",
        "subtitle": "Grazie per contribuire al miglioramento dell'archivio.",
        "submission_id": "ID invio: ",
        "pending_review": "Il tuo suggerimento è in attesa di revisione da parte di un moderatore. Una volta approvato, le modifiche verranno applicate al documento.",
        "back_to_document": "Torna al documento"
      },
      "error": {
        "title": "Errore di invio",
        "default_message": "Si è verificato un errore durante l'invio del tuo suggerimento. Riprova.",
        "no_changes": "Nessuna modifica rilevata. Modifica almeno un campo prima di inviare.",
        "reason_required": "Fornisci un motivo per il tuo suggerimento di modifica."
      }
    }
  },
  "pt": {
    "title": "Sugerir uma edição - Arquivo Classic Mini",
    "description": "Sugerir correções ou melhorias a um documento do arquivo",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Sugerir edição",
    "main_heading": "Sugerir uma edição",
    "description_text": "Encontrou algo incorreto ou incompleto? Ajude a melhorar o arquivo sugerindo uma edição para este documento. Sua sugestão será revisada por um moderador antes de qualquer alteração ser aplicada.",
    "auth": {
      "sign_in_title": "Login necessário",
      "sign_in_description": "Você precisa estar conectado para sugerir edições em documentos do arquivo.",
      "sign_in_button": "Entrar"
    },
    "not_found": {
      "title": "Documento não encontrado",
      "description": "O documento que você está tentando editar não pôde ser encontrado.",
      "back": "Voltar para documentos"
    },
    "current": {
      "title": "Valores atuais",
      "labels": {
        "title": "Título",
        "code": "Código",
        "description": "Descrição"
      }
    },
    "form": {
      "title": "Alterações propostas",
      "fields": {
        "title": {
          "label": "Título",
          "placeholder": "Insira o título corrigido"
        },
        "code": {
          "label": "Código / Número de referência",
          "placeholder": "Insira o código corrigido"
        },
        "description": {
          "label": "Descrição",
          "placeholder": "Insira a descrição corrigida"
        },
        "reason": {
          "label": "Motivo da edição",
          "placeholder": "Explique por que essa alteração é necessária...",
          "help": "Descreva a fonte da sua correção (ex. documento original, registros de fábrica, etc.)"
        }
      },
      "submit": {
        "button": "Enviar sugestão de edição",
        "submitting": "Enviando..."
      },
      "success": {
        "title": "Sugestão enviada!",
        "subtitle": "Obrigado por ajudar a melhorar o arquivo.",
        "submission_id": "ID de envio: ",
        "pending_review": "Sua sugestão está pendente de revisão por um moderador. Após aprovação, as alterações serão aplicadas ao documento.",
        "back_to_document": "Voltar ao documento"
      },
      "error": {
        "title": "Erro ao enviar",
        "default_message": "Ocorreu um erro ao enviar sua sugestão. Por favor, tente novamente.",
        "no_changes": "Nenhuma alteração detectada. Modifique pelo menos um campo antes de enviar.",
        "reason_required": "Por favor, forneça um motivo para sua sugestão de edição."
      }
    }
  },
  "nl": {
    "title": "Een bewerking voorstellen - Classic Mini Archief",
    "description": "Correcties of verbeteringen voorstellen voor een archiefdocument",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Bewerking voorstellen",
    "main_heading": "Een bewerking voorstellen",
    "description_text": "Iets onjuists of onvolledig gevonden? Help het archief te verbeteren door een bewerking voor dit document voor te stellen. Uw voorstel wordt beoordeeld door een moderator voordat wijzigingen worden toegepast.",
    "auth": {
      "sign_in_title": "Inloggen vereist",
      "sign_in_description": "U moet ingelogd zijn om bewerkingen aan archiefdocumenten voor te stellen.",
      "sign_in_button": "Inloggen"
    },
    "not_found": {
      "title": "Document niet gevonden",
      "description": "Het document dat u probeert te bewerken, kon niet worden gevonden.",
      "back": "Terug naar documenten"
    },
    "current": {
      "title": "Huidige waarden",
      "labels": {
        "title": "Titel",
        "code": "Code",
        "description": "Beschrijving"
      }
    },
    "form": {
      "title": "Voorgestelde wijzigingen",
      "fields": {
        "title": {
          "label": "Titel",
          "placeholder": "Gecorrigeerde titel invoeren"
        },
        "code": {
          "label": "Code / Referentienummer",
          "placeholder": "Gecorrigeerde code invoeren"
        },
        "description": {
          "label": "Beschrijving",
          "placeholder": "Gecorrigeerde beschrijving invoeren"
        },
        "reason": {
          "label": "Reden voor bewerking",
          "placeholder": "Leg uit waarom deze wijziging nodig is...",
          "help": "Beschrijf de bron van uw correctie (bijv. origineel document, fabrieksgegevens, etc.)"
        }
      },
      "submit": {
        "button": "Bewerkingsvoorstel indienen",
        "submitting": "Indienen..."
      },
      "success": {
        "title": "Voorstel ingediend!",
        "subtitle": "Bedankt voor het helpen verbeteren van het archief.",
        "submission_id": "Indiening-ID: ",
        "pending_review": "Uw voorstel wordt beoordeeld door een moderator. Na goedkeuring worden de wijzigingen op het document toegepast.",
        "back_to_document": "Terug naar document"
      },
      "error": {
        "title": "Indieningsfout",
        "default_message": "Er is een fout opgetreden bij het indienen van uw voorstel. Probeer het opnieuw.",
        "no_changes": "Geen wijzigingen gedetecteerd. Wijzig minimaal één veld voordat u indient.",
        "reason_required": "Geef een reden op voor uw bewerkingsvoorstel."
      }
    }
  },
  "sv": {
    "title": "Föreslå en redigering - Classic Mini Arkiv",
    "description": "Föreslå korrigeringar eller förbättringar till ett arkivdokument",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Föreslå redigering",
    "main_heading": "Föreslå en redigering",
    "description_text": "Hittade du något felaktigt eller ofullständigt? Hjälp till att förbättra arkivet genom att föreslå en redigering för detta dokument. Ditt förslag granskas av en moderator innan några ändringar tillämpas.",
    "auth": {
      "sign_in_title": "Inloggning krävs",
      "sign_in_description": "Du måste vara inloggad för att föreslå redigeringar av arkivdokument.",
      "sign_in_button": "Logga in"
    },
    "not_found": {
      "title": "Dokumentet hittades inte",
      "description": "Dokumentet du försöker redigera kunde inte hittas.",
      "back": "Tillbaka till dokument"
    },
    "current": {
      "title": "Nuvarande värden",
      "labels": {
        "title": "Titel",
        "code": "Kod",
        "description": "Beskrivning"
      }
    },
    "form": {
      "title": "Föreslagna ändringar",
      "fields": {
        "title": {
          "label": "Titel",
          "placeholder": "Ange korrigerad titel"
        },
        "code": {
          "label": "Kod / Referensnummer",
          "placeholder": "Ange korrigerad kod"
        },
        "description": {
          "label": "Beskrivning",
          "placeholder": "Ange korrigerad beskrivning"
        },
        "reason": {
          "label": "Anledning till redigering",
          "placeholder": "Förklara varför denna ändring behövs...",
          "help": "Beskriv källan till din korrigering (t.ex. originaldokument, fabriksregister, etc.)"
        }
      },
      "submit": {
        "button": "Skicka redigeringsförslag",
        "submitting": "Skickar..."
      },
      "success": {
        "title": "Förslag skickat!",
        "subtitle": "Tack för att du hjälper till att förbättra arkivet.",
        "submission_id": "Inlämnings-ID: ",
        "pending_review": "Ditt förslag granskas av en moderator. När det godkänts tillämpas ändringarna på dokumentet.",
        "back_to_document": "Tillbaka till dokument"
      },
      "error": {
        "title": "Inlämningsfel",
        "default_message": "Ett fel uppstod när ditt förslag skickades. Försök igen.",
        "no_changes": "Inga ändringar identifierade. Ändra minst ett fält innan du skickar.",
        "reason_required": "Ange en anledning till ditt redigeringsförslag."
      }
    }
  },
  "da": {
    "title": "Foreslå en redigering - Classic Mini Arkiv",
    "description": "Foreslå korrektioner eller forbedringer til et arkivdokument",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Foreslå redigering",
    "main_heading": "Foreslå en redigering",
    "description_text": "Fandt du noget forkert eller ufuldstændigt? Hjælp med at forbedre arkivet ved at foreslå en redigering af dette dokument. Dit forslag gennemgås af en moderator, inden ændringer anvendes.",
    "auth": {
      "sign_in_title": "Log ind krævet",
      "sign_in_description": "Du skal være logget ind for at foreslå redigeringer af arkivdokumenter.",
      "sign_in_button": "Log ind"
    },
    "not_found": {
      "title": "Dokumentet blev ikke fundet",
      "description": "Det dokument, du forsøger at redigere, kunne ikke findes.",
      "back": "Tilbage til dokumenter"
    },
    "current": {
      "title": "Nuværende værdier",
      "labels": {
        "title": "Titel",
        "code": "Kode",
        "description": "Beskrivelse"
      }
    },
    "form": {
      "title": "Foreslåede ændringer",
      "fields": {
        "title": {
          "label": "Titel",
          "placeholder": "Angiv korrigeret titel"
        },
        "code": {
          "label": "Kode / Referencenummer",
          "placeholder": "Angiv korrigeret kode"
        },
        "description": {
          "label": "Beskrivelse",
          "placeholder": "Angiv korrigeret beskrivelse"
        },
        "reason": {
          "label": "Begrundelse for redigering",
          "placeholder": "Forklar, hvorfor denne ændring er nødvendig...",
          "help": "Beskriv kilden til din korrektion (f.eks. originaldokument, fabriksregistre osv.)"
        }
      },
      "submit": {
        "button": "Indsend redigeringsforslag",
        "submitting": "Indsender..."
      },
      "success": {
        "title": "Forslag indsendt!",
        "subtitle": "Tak fordi du hjælper med at forbedre arkivet.",
        "submission_id": "Indsendelse-ID: ",
        "pending_review": "Dit forslag afventer gennemgang af en moderator. Når det er godkendt, vil ændringerne blive anvendt på dokumentet.",
        "back_to_document": "Tilbage til dokument"
      },
      "error": {
        "title": "Indsendingsfejl",
        "default_message": "Der opstod en fejl ved indsendelse af dit forslag. Prøv igen.",
        "no_changes": "Ingen ændringer registreret. Rediger mindst ét felt, inden du indsender.",
        "reason_required": "Angiv en begrundelse for dit redigeringsforslag."
      }
    }
  },
  "no": {
    "title": "Foreslå en redigering - Classic Mini Arkiv",
    "description": "Foreslå rettelser eller forbedringer til et arkivdokument",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Foreslå redigering",
    "main_heading": "Foreslå en redigering",
    "description_text": "Fant du noe feil eller ufullstendig? Hjelp med å forbedre arkivet ved å foreslå en redigering av dette dokumentet. Forslaget ditt vil bli gjennomgått av en moderator før endringer anvendes.",
    "auth": {
      "sign_in_title": "Innlogging kreves",
      "sign_in_description": "Du må være logget inn for å foreslå redigeringer av arkivdokumenter.",
      "sign_in_button": "Logg inn"
    },
    "not_found": {
      "title": "Dokumentet ble ikke funnet",
      "description": "Dokumentet du prøver å redigere kunne ikke finnes.",
      "back": "Tilbake til dokumenter"
    },
    "current": {
      "title": "Gjeldende verdier",
      "labels": {
        "title": "Tittel",
        "code": "Kode",
        "description": "Beskrivelse"
      }
    },
    "form": {
      "title": "Foreslåtte endringer",
      "fields": {
        "title": {
          "label": "Tittel",
          "placeholder": "Skriv inn korrigert tittel"
        },
        "code": {
          "label": "Kode / Referansenummer",
          "placeholder": "Skriv inn korrigert kode"
        },
        "description": {
          "label": "Beskrivelse",
          "placeholder": "Skriv inn korrigert beskrivelse"
        },
        "reason": {
          "label": "Årsak til redigering",
          "placeholder": "Forklar hvorfor denne endringen er nødvendig...",
          "help": "Beskriv kilden til korreksjonen din (f.eks. originaldokument, fabrikkregistre osv.)"
        }
      },
      "submit": {
        "button": "Send inn redigeringsforslag",
        "submitting": "Sender inn..."
      },
      "success": {
        "title": "Forslag sendt inn!",
        "subtitle": "Takk for at du hjelper med å forbedre arkivet.",
        "submission_id": "Innsendelse-ID: ",
        "pending_review": "Forslaget ditt er under gjennomgang av en moderator. Når det er godkjent, vil endringene bli brukt på dokumentet.",
        "back_to_document": "Tilbake til dokument"
      },
      "error": {
        "title": "Innsendingsfeil",
        "default_message": "Det oppstod en feil ved innsending av forslaget ditt. Prøv igjen.",
        "no_changes": "Ingen endringer oppdaget. Endre minst ett felt før du sender inn.",
        "reason_required": "Oppgi en årsak til redigeringsforslaget ditt."
      }
    }
  }
}
</i18n>
