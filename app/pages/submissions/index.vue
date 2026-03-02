<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { isAuthenticated } = useAuth();
  const { listMySubmissions } = useSubmissions();

  const { data: submissions, status } = await useAsyncData('my-submissions', () => listMySubmissions());

  // Status filter
  const statusFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');
  // Type filter
  const typeFilter = ref<'all' | 'document' | 'registry' | 'color' | 'wheel'>('all');

  const filteredSubmissions = computed(() => {
    if (!submissions.value) return [];
    let result = submissions.value;

    if (statusFilter.value !== 'all') {
      result = result.filter((item) => item.status === statusFilter.value);
    }

    if (typeFilter.value !== 'all') {
      result = result.filter((item) => item.targetType === typeFilter.value);
    }

    return result;
  });

  function getTitle(item: { data: Record<string, any> }): string {
    return item.data.title || item.data.name || 'Untitled';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

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
</script>

<template>
  <Hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <Breadcrumb :page="$t('breadcrumb_title')" />
    </div>

    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-4">{{ $t('main_heading') }}</h1>
      <p class="mb-6 text-base">{{ $t('description_text') }}</p>
      <USeparator />
    </div>

    <!-- Auth gate -->
    <div v-if="!isAuthenticated" class="max-w-lg mx-auto">
      <UCard>
        <div class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-lock text-5xl opacity-40"></i>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ $t('auth.sign_in_title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ $t('auth.sign_in_description') }}</p>
          <UButton to="/login" color="primary" class="w-full">
            {{ $t('auth.sign_in_button') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Authenticated content -->
    <div v-else>
      <!-- Filter chips row -->
      <div class="flex flex-wrap gap-6 mb-6">
        <!-- Status filters -->
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-sm"
            :class="statusFilter === 'all' ? 'btn-primary' : 'btn-outline'"
            @click="statusFilter = 'all'"
          >
            {{ $t('filters.all') }}
          </button>
          <button
            class="btn btn-sm"
            :class="statusFilter === 'pending' ? 'btn-warning' : 'btn-outline'"
            @click="statusFilter = 'pending'"
          >
            {{ $t('filters.pending') }}
          </button>
          <button
            class="btn btn-sm"
            :class="statusFilter === 'approved' ? 'btn-success' : 'btn-outline'"
            @click="statusFilter = 'approved'"
          >
            {{ $t('filters.approved') }}
          </button>
          <button
            class="btn btn-sm"
            :class="statusFilter === 'rejected' ? 'btn-error' : 'btn-outline'"
            @click="statusFilter = 'rejected'"
          >
            {{ $t('filters.rejected') }}
          </button>
        </div>

        <USeparator orientation="vertical" class="hidden sm:block h-8" />

        <!-- Type filters -->
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-sm"
            :class="typeFilter === 'all' ? 'btn-neutral' : 'btn-outline'"
            @click="typeFilter = 'all'"
          >
            {{ $t('filters.all') }}
          </button>
          <button
            class="btn btn-sm"
            :class="typeFilter === 'document' ? 'btn-neutral' : 'btn-outline'"
            @click="typeFilter = 'document'"
          >
            <i class="fa-duotone fa-books mr-1"></i>
            {{ $t('filters.documents') }}
          </button>
          <button
            class="btn btn-sm"
            :class="typeFilter === 'registry' ? 'btn-neutral' : 'btn-outline'"
            @click="typeFilter = 'registry'"
          >
            <i class="fa-duotone fa-clipboard-list mr-1"></i>
            {{ $t('filters.registry') }}
          </button>
          <button
            class="btn btn-sm"
            :class="typeFilter === 'color' ? 'btn-neutral' : 'btn-outline'"
            @click="typeFilter = 'color'"
          >
            <i class="fa-duotone fa-palette mr-1"></i>
            {{ $t('filters.colors') }}
          </button>
          <button
            class="btn btn-sm"
            :class="typeFilter === 'wheel' ? 'btn-neutral' : 'btn-outline'"
            @click="typeFilter = 'wheel'"
          >
            <i class="fa-duotone fa-tire mr-1"></i>
            {{ $t('filters.wheels') }}
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="status === 'pending'" class="flex justify-center py-16">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Submissions list -->
      <div v-else-if="filteredSubmissions.length > 0" class="space-y-4">
        <UCard v-for="item in filteredSubmissions" :key="item.id">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div class="flex-1 min-w-0">
              <!-- Badge row -->
              <div class="flex flex-wrap gap-2 mb-2">
                <!-- Type badge -->
                <UBadge
                  :color="item.type === 'new_item' ? 'neutral' : 'info'"
                  variant="soft"
                  size="sm"
                >
                  {{ item.type === 'new_item' ? $t('submission.new_item') : item.type === 'edit_suggestion' ? $t('submission.edit_suggestion') : $t('submission.new_collection') }}
                </UBadge>

                <!-- Target type badge -->
                <UBadge color="neutral" variant="outline" size="sm">
                  <template v-if="item.targetType === 'document'">
                    <i class="fa-duotone fa-books mr-1"></i>
                  </template>
                  <template v-else-if="item.targetType === 'registry'">
                    <i class="fa-duotone fa-clipboard-list mr-1"></i>
                  </template>
                  <template v-else-if="item.targetType === 'color'">
                    <i class="fa-duotone fa-palette mr-1"></i>
                  </template>
                  <template v-else-if="item.targetType === 'wheel'">
                    <i class="fa-duotone fa-tire mr-1"></i>
                  </template>
                  <template v-else>
                    <i class="fa-duotone fa-file mr-1"></i>
                  </template>
                  {{ item.targetType }}
                </UBadge>
              </div>

              <!-- Title -->
              <h3 class="text-base font-semibold truncate">{{ getTitle(item) }}</h3>

              <!-- Dates -->
              <div class="flex flex-wrap gap-4 mt-2 text-sm opacity-60">
                <span>
                  <i class="fas fa-calendar-plus mr-1"></i>
                  {{ $t('submission.submitted') }}: {{ formatDate(item.createdAt) }}
                </span>
                <span v-if="item.reviewedAt">
                  <i class="fas fa-calendar-check mr-1"></i>
                  {{ $t('submission.reviewed') }}: {{ formatDate(item.reviewedAt) }}
                </span>
              </div>

              <!-- Reviewer notes -->
              <div
                v-if="item.reviewerNotes && (item.status === 'approved' || item.status === 'rejected')"
                class="mt-3"
              >
                <UAlert
                  :color="item.status === 'approved' ? 'success' : 'error'"
                  variant="soft"
                  size="sm"
                >
                  <template #title>{{ $t('submission.reviewer_notes') }}</template>
                  <template #description>{{ item.reviewerNotes }}</template>
                </UAlert>
              </div>
            </div>

            <!-- Status badge -->
            <div class="shrink-0">
              <UBadge
                :color="item.status === 'pending' ? 'warning' : item.status === 'approved' ? 'success' : 'error'"
                size="md"
              >
                {{ item.status === 'pending' ? $t('submission.status.pending') : item.status === 'approved' ? $t('submission.status.approved') : $t('submission.status.rejected') }}
              </UBadge>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-16">
        <div class="mb-4">
          <i class="fa-duotone fa-inbox text-6xl opacity-30"></i>
        </div>
        <h2 class="text-2xl font-bold mb-2">{{ $t('empty.title') }}</h2>
        <p class="opacity-70 mb-6 max-w-md mx-auto">{{ $t('empty.description') }}</p>
        <UButton to="/contribute" color="primary" variant="outline">
          {{ $t('empty.contribute_link') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "My Submissions - Classic Mini DIY",
    "description": "View your submission history and track the status of your contributions to the Classic Mini DIY archive.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "My Submissions",
    "main_heading": "My Submissions",
    "description_text": "Track the status of all your contributions to the Classic Mini DIY archive, including documents, registry entries, colors, and wheels.",
    "auth": {
      "sign_in_title": "Sign In to View Submissions",
      "sign_in_description": "You need to be signed in to view your submission history. Create a free account to get started.",
      "sign_in_button": "Sign In to Continue"
    },
    "filters": {
      "all": "All",
      "pending": "Pending",
      "approved": "Approved",
      "rejected": "Rejected",
      "documents": "Documents",
      "registry": "Registry",
      "colors": "Colors",
      "wheels": "Wheels"
    },
    "submission": {
      "new_item": "New",
      "edit_suggestion": "Edit",
      "new_collection": "Collection",
      "status": {
        "pending": "Pending",
        "approved": "Approved",
        "rejected": "Rejected"
      },
      "reviewer_notes": "Reviewer Notes",
      "submitted": "Submitted",
      "reviewed": "Reviewed"
    },
    "empty": {
      "title": "No Submissions Yet",
      "description": "You haven't made any contributions to the archive yet. Start by submitting a document, registering your Mini, or contributing a color.",
      "contribute_link": "Start Contributing"
    }
  },
  "de": {
    "title": "Meine Einreichungen - Classic Mini DIY",
    "description": "Sehen Sie Ihren Einreichungsverlauf und verfolgen Sie den Status Ihrer Beiträge zum Classic Mini DIY Archiv.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Meine Einreichungen",
    "main_heading": "Meine Einreichungen",
    "description_text": "Verfolgen Sie den Status aller Ihrer Beiträge zum Classic Mini DIY Archiv, einschließlich Dokumente, Registrierungseinträge, Farben und Räder.",
    "auth": {
      "sign_in_title": "Anmelden zum Anzeigen der Einreichungen",
      "sign_in_description": "Sie müssen angemeldet sein, um Ihren Einreichungsverlauf anzuzeigen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
      "sign_in_button": "Anmelden und fortfahren"
    },
    "filters": {
      "all": "Alle",
      "pending": "Ausstehend",
      "approved": "Genehmigt",
      "rejected": "Abgelehnt",
      "documents": "Dokumente",
      "registry": "Register",
      "colors": "Farben",
      "wheels": "Räder"
    },
    "submission": {
      "new_item": "Neu",
      "edit_suggestion": "Bearbeitung",
      "new_collection": "Sammlung",
      "status": {
        "pending": "Ausstehend",
        "approved": "Genehmigt",
        "rejected": "Abgelehnt"
      },
      "reviewer_notes": "Prüfernotizen",
      "submitted": "Eingereicht",
      "reviewed": "Überprüft"
    },
    "empty": {
      "title": "Noch keine Einreichungen",
      "description": "Sie haben noch keine Beiträge zum Archiv geleistet. Beginnen Sie mit der Einreichung eines Dokuments, der Registrierung Ihres Mini oder der Einreichung einer Farbe.",
      "contribute_link": "Jetzt beitragen"
    }
  },
  "es": {
    "title": "Mis Envíos - Classic Mini DIY",
    "description": "Ver tu historial de envíos y hacer seguimiento al estado de tus contribuciones al archivo Classic Mini DIY.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Mis Envíos",
    "main_heading": "Mis Envíos",
    "description_text": "Realiza el seguimiento del estado de todas tus contribuciones al archivo Classic Mini DIY, incluyendo documentos, entradas del registro, colores y ruedas.",
    "auth": {
      "sign_in_title": "Inicia Sesión para Ver los Envíos",
      "sign_in_description": "Debes iniciar sesión para ver tu historial de envíos. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar Sesión para Continuar"
    },
    "filters": {
      "all": "Todos",
      "pending": "Pendiente",
      "approved": "Aprobado",
      "rejected": "Rechazado",
      "documents": "Documentos",
      "registry": "Registro",
      "colors": "Colores",
      "wheels": "Ruedas"
    },
    "submission": {
      "new_item": "Nuevo",
      "edit_suggestion": "Edición",
      "new_collection": "Colección",
      "status": {
        "pending": "Pendiente",
        "approved": "Aprobado",
        "rejected": "Rechazado"
      },
      "reviewer_notes": "Notas del Revisor",
      "submitted": "Enviado",
      "reviewed": "Revisado"
    },
    "empty": {
      "title": "Sin Envíos Aún",
      "description": "Aún no has hecho contribuciones al archivo. Comienza enviando un documento, registrando tu Mini o contribuyendo un color.",
      "contribute_link": "Empezar a Contribuir"
    }
  },
  "fr": {
    "title": "Mes Soumissions - Classic Mini DIY",
    "description": "Consultez votre historique de soumissions et suivez le statut de vos contributions aux archives Classic Mini DIY.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Mes Soumissions",
    "main_heading": "Mes Soumissions",
    "description_text": "Suivez le statut de toutes vos contributions aux archives Classic Mini DIY, y compris les documents, les entrées du registre, les couleurs et les roues.",
    "auth": {
      "sign_in_title": "Connectez-vous pour Voir les Soumissions",
      "sign_in_description": "Vous devez être connecté pour consulter votre historique de soumissions. Créez un compte gratuit pour commencer.",
      "sign_in_button": "Se Connecter pour Continuer"
    },
    "filters": {
      "all": "Tous",
      "pending": "En attente",
      "approved": "Approuvé",
      "rejected": "Rejeté",
      "documents": "Documents",
      "registry": "Registre",
      "colors": "Couleurs",
      "wheels": "Roues"
    },
    "submission": {
      "new_item": "Nouveau",
      "edit_suggestion": "Modification",
      "new_collection": "Collection",
      "status": {
        "pending": "En attente",
        "approved": "Approuvé",
        "rejected": "Rejeté"
      },
      "reviewer_notes": "Notes du Réviseur",
      "submitted": "Soumis",
      "reviewed": "Révisé"
    },
    "empty": {
      "title": "Aucune Soumission Pour l'Instant",
      "description": "Vous n'avez pas encore fait de contributions aux archives. Commencez par soumettre un document, enregistrer votre Mini ou contribuer une couleur.",
      "contribute_link": "Commencer a Contribuer"
    }
  },
  "it": {
    "title": "Le Mie Proposte - Classic Mini DIY",
    "description": "Visualizza la cronologia delle tue proposte e monitora lo stato dei tuoi contributi all'archivio Classic Mini DIY.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Le Mie Proposte",
    "main_heading": "Le Mie Proposte",
    "description_text": "Monitora lo stato di tutti i tuoi contributi all'archivio Classic Mini DIY, inclusi documenti, voci del registro, colori e ruote.",
    "auth": {
      "sign_in_title": "Accedi per Vedere le Proposte",
      "sign_in_description": "Devi essere connesso per visualizzare la cronologia delle tue proposte. Crea un account gratuito per iniziare.",
      "sign_in_button": "Accedi per Continuare"
    },
    "filters": {
      "all": "Tutti",
      "pending": "In attesa",
      "approved": "Approvato",
      "rejected": "Rifiutato",
      "documents": "Documenti",
      "registry": "Registro",
      "colors": "Colori",
      "wheels": "Ruote"
    },
    "submission": {
      "new_item": "Nuovo",
      "edit_suggestion": "Modifica",
      "new_collection": "Raccolta",
      "status": {
        "pending": "In attesa",
        "approved": "Approvato",
        "rejected": "Rifiutato"
      },
      "reviewer_notes": "Note del Revisore",
      "submitted": "Inviato",
      "reviewed": "Revisionato"
    },
    "empty": {
      "title": "Nessuna Proposta Ancora",
      "description": "Non hai ancora fatto contributi all'archivio. Inizia inviando un documento, registrando il tuo Mini o contribuendo un colore.",
      "contribute_link": "Inizia a Contribuire"
    }
  },
  "pt": {
    "title": "Meus Envios - Classic Mini DIY",
    "description": "Veja seu histórico de envios e acompanhe o status de suas contribuições ao arquivo Classic Mini DIY.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Meus Envios",
    "main_heading": "Meus Envios",
    "description_text": "Acompanhe o status de todas as suas contribuições ao arquivo Classic Mini DIY, incluindo documentos, entradas do registro, cores e rodas.",
    "auth": {
      "sign_in_title": "Entre para Ver os Envios",
      "sign_in_description": "Você precisa estar conectado para ver seu histórico de envios. Crie uma conta gratuita para começar.",
      "sign_in_button": "Entrar para Continuar"
    },
    "filters": {
      "all": "Todos",
      "pending": "Pendente",
      "approved": "Aprovado",
      "rejected": "Rejeitado",
      "documents": "Documentos",
      "registry": "Registro",
      "colors": "Cores",
      "wheels": "Rodas"
    },
    "submission": {
      "new_item": "Novo",
      "edit_suggestion": "Edição",
      "new_collection": "Coleção",
      "status": {
        "pending": "Pendente",
        "approved": "Aprovado",
        "rejected": "Rejeitado"
      },
      "reviewer_notes": "Notas do Revisor",
      "submitted": "Enviado",
      "reviewed": "Revisado"
    },
    "empty": {
      "title": "Sem Envios Ainda",
      "description": "Você ainda não fez contribuições ao arquivo. Comece enviando um documento, registrando seu Mini ou contribuindo com uma cor.",
      "contribute_link": "Comece a Contribuir"
    }
  },
  "nl": {
    "title": "Mijn Inzendingen - Classic Mini DIY",
    "description": "Bekijk uw inzendingsgeschiedenis en volg de status van uw bijdragen aan het Classic Mini DIY archief.",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Mijn Inzendingen",
    "main_heading": "Mijn Inzendingen",
    "description_text": "Volg de status van al uw bijdragen aan het Classic Mini DIY archief, inclusief documenten, registerinvoer, kleuren en wielen.",
    "auth": {
      "sign_in_title": "Inloggen om Inzendingen te Bekijken",
      "sign_in_description": "U moet ingelogd zijn om uw inzendingsgeschiedenis te bekijken. Maak een gratis account aan om te beginnen.",
      "sign_in_button": "Inloggen om Door te Gaan"
    },
    "filters": {
      "all": "Alle",
      "pending": "In behandeling",
      "approved": "Goedgekeurd",
      "rejected": "Afgewezen",
      "documents": "Documenten",
      "registry": "Register",
      "colors": "Kleuren",
      "wheels": "Wielen"
    },
    "submission": {
      "new_item": "Nieuw",
      "edit_suggestion": "Bewerking",
      "new_collection": "Collectie",
      "status": {
        "pending": "In behandeling",
        "approved": "Goedgekeurd",
        "rejected": "Afgewezen"
      },
      "reviewer_notes": "Beoordelaarnotities",
      "submitted": "Ingediend",
      "reviewed": "Beoordeeld"
    },
    "empty": {
      "title": "Nog Geen Inzendingen",
      "description": "U heeft nog geen bijdragen aan het archief gemaakt. Begin met het indienen van een document, het registreren van uw Mini of het bijdragen van een kleur.",
      "contribute_link": "Begin met Bijdragen"
    }
  },
  "sv": {
    "title": "Mina Inlämningar - Classic Mini DIY",
    "description": "Visa din inlämningshistorik och spåra statusen för dina bidrag till Classic Mini DIY arkivet.",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Mina Inlämningar",
    "main_heading": "Mina Inlämningar",
    "description_text": "Spåra statusen för alla dina bidrag till Classic Mini DIY arkivet, inklusive dokument, registerposter, färger och hjul.",
    "auth": {
      "sign_in_title": "Logga In för att Se Inlämningar",
      "sign_in_description": "Du måste vara inloggad för att se din inlämningshistorik. Skapa ett gratis konto för att komma igång.",
      "sign_in_button": "Logga In för att Fortsätta"
    },
    "filters": {
      "all": "Alla",
      "pending": "Väntande",
      "approved": "Godkänd",
      "rejected": "Avvisad",
      "documents": "Dokument",
      "registry": "Register",
      "colors": "Färger",
      "wheels": "Hjul"
    },
    "submission": {
      "new_item": "Ny",
      "edit_suggestion": "Redigering",
      "new_collection": "Samling",
      "status": {
        "pending": "Väntande",
        "approved": "Godkänd",
        "rejected": "Avvisad"
      },
      "reviewer_notes": "Granskningsanteckningar",
      "submitted": "Skickad",
      "reviewed": "Granskad"
    },
    "empty": {
      "title": "Inga Inlämningar Ännu",
      "description": "Du har inte gjort några bidrag till arkivet ännu. Börja med att skicka in ett dokument, registrera din Mini eller bidra med en färg.",
      "contribute_link": "Borja Bidra"
    }
  },
  "da": {
    "title": "Mine Indsendelser - Classic Mini DIY",
    "description": "Se din indsendelseshistorik og følg status på dine bidrag til Classic Mini DIY arkivet.",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Mine Indsendelser",
    "main_heading": "Mine Indsendelser",
    "description_text": "Følg status på alle dine bidrag til Classic Mini DIY arkivet, herunder dokumenter, registerposter, farver og hjul.",
    "auth": {
      "sign_in_title": "Log Ind for at Se Indsendelser",
      "sign_in_description": "Du skal være logget ind for at se din indsendelseshistorik. Opret en gratis konto for at komme i gang.",
      "sign_in_button": "Log Ind for at Fortsætte"
    },
    "filters": {
      "all": "Alle",
      "pending": "Afventer",
      "approved": "Godkendt",
      "rejected": "Afvist",
      "documents": "Dokumenter",
      "registry": "Register",
      "colors": "Farver",
      "wheels": "Hjul"
    },
    "submission": {
      "new_item": "Ny",
      "edit_suggestion": "Redigering",
      "new_collection": "Samling",
      "status": {
        "pending": "Afventer",
        "approved": "Godkendt",
        "rejected": "Afvist"
      },
      "reviewer_notes": "Reviewernotater",
      "submitted": "Indsendt",
      "reviewed": "Gennemgået"
    },
    "empty": {
      "title": "Ingen Indsendelser Endnu",
      "description": "Du har endnu ikke gjort bidrag til arkivet. Start med at indsende et dokument, registrere din Mini eller bidrage med en farve.",
      "contribute_link": "Begynd at Bidrage"
    }
  },
  "no": {
    "title": "Mine Innsendinger - Classic Mini DIY",
    "description": "Se din innsendingshistorikk og følg statusen til dine bidrag til Classic Mini DIY arkivet.",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Mine Innsendinger",
    "main_heading": "Mine Innsendinger",
    "description_text": "Følg statusen til alle dine bidrag til Classic Mini DIY arkivet, inkludert dokumenter, registerposter, farger og hjul.",
    "auth": {
      "sign_in_title": "Logg Inn for å Se Innsendinger",
      "sign_in_description": "Du må være logget inn for å se din innsendingshistorikk. Opprett en gratis konto for å komme i gang.",
      "sign_in_button": "Logg Inn for å Fortsette"
    },
    "filters": {
      "all": "Alle",
      "pending": "Venter",
      "approved": "Godkjent",
      "rejected": "Avvist",
      "documents": "Dokumenter",
      "registry": "Register",
      "colors": "Farger",
      "wheels": "Hjul"
    },
    "submission": {
      "new_item": "Ny",
      "edit_suggestion": "Redigering",
      "new_collection": "Samling",
      "status": {
        "pending": "Venter",
        "approved": "Godkjent",
        "rejected": "Avvist"
      },
      "reviewer_notes": "Reviewernotater",
      "submitted": "Sendt inn",
      "reviewed": "Gjennomgått"
    },
    "empty": {
      "title": "Ingen Innsendinger Ennå",
      "description": "Du har ennå ikke gjort bidrag til arkivet. Start med å sende inn et dokument, registrere din Mini eller bidra med en farge.",
      "contribute_link": "Begynn a Bidra"
    }
  }
}
</i18n>
