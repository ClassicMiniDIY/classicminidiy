<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { configs, loading, fetchConfigs, updateConfig, deleteConfig } = useGearConfigs();
  const { listMySubmissions } = useSubmissions();

  const submissions = ref<Awaited<ReturnType<typeof listMySubmissions>>>([]);
  const submissionsLoading = ref(false);
  const statusFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const typeFilter = ref<'all' | 'document' | 'registry' | 'color' | 'wheel'>('all');

  const filteredSubmissions = computed(() => {
    let result = submissions.value;
    if (statusFilter.value !== 'all') {
      result = result.filter((item) => item.status === statusFilter.value);
    }
    if (typeFilter.value !== 'all') {
      result = result.filter((item) => item.targetType === typeFilter.value);
    }
    return result;
  });

  function getSubmissionTitle(item: { data: Record<string, any> }): string {
    return item.data.title || item.data.name || 'Untitled';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  // Fetch configs and submissions when authenticated
  watch(
    isAuthenticated,
    async (authed) => {
      if (authed) {
        await fetchConfigs();
        submissionsLoading.value = true;
        try {
          submissions.value = await listMySubmissions();
        } finally {
          submissionsLoading.value = false;
        }
      }
    },
    { immediate: true }
  );

  async function togglePublic(id: string, isPublic: boolean) {
    await updateConfig(id, { is_public: !isPublic });
  }

  async function handleDelete(id: string) {
    await deleteConfig(id);
  }

  useHead({
    title: t('title'),
    meta: [
      { name: 'description', content: t('description') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :page="t('breadcrumb_title')" :version="BREADCRUMB_VERSIONS.PROFILE" />
    </div>

    <!-- Auth gate -->
    <div v-if="!isAuthenticated" class="max-w-lg mx-auto">
      <UCard>
        <div class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-lock text-5xl opacity-40"></i>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ t('auth.sign_in_title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ t('auth.sign_in_description') }}</p>
          <UButton to="/login" color="primary" class="w-full">
            {{ t('auth.sign_in_button') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Authenticated content -->
    <div v-else class="max-w-4xl mx-auto space-y-6">
      <!-- Saved Gear Configurations -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <i class="fad fa-gears mr-2"></i>
              <h2 class="text-lg font-semibold">{{ t('gear_configs.title') }}</h2>
            </div>
            <UButton to="/technical/gearing" variant="outline" size="sm" icon="i-fa6-solid-calculator">
              {{ t('gear_configs.open_calculator') }}
            </UButton>
          </div>
        </template>

        <div v-if="loading" class="flex justify-center py-8">
          <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
        </div>

        <div v-else-if="configs.length === 0" class="text-center py-8 opacity-60">
          <i class="fas fa-inbox text-4xl mb-3 block"></i>
          <p class="mb-4">{{ t('gear_configs.empty') }}</p>
          <UButton to="/technical/gearing" color="primary" variant="soft">
            {{ t('gear_configs.go_to_calculator') }}
          </UButton>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="config in configs"
            :key="config.id"
            class="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border gap-4"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ config.name }}</p>
              <p class="text-xs opacity-60 mt-1">
                {{ config.gearset }} · {{ config.final_drive }}:1 · {{ config.drop_gear }}:1
              </p>
              <p class="text-xs opacity-40 mt-1">
                {{ t('gear_configs.tire') }}: {{ config.tire }} · {{ t('gear_configs.rpm') }}: {{ config.max_rpm }}
              </p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="flex items-center gap-2">
                <label class="text-xs opacity-60">{{ t('gear_configs.public') }}</label>
                <USwitch
                  :model-value="config.is_public"
                  size="sm"
                  @update:model-value="togglePublic(config.id, config.is_public)"
                />
              </div>
              <UButton
                size="sm"
                variant="ghost"
                color="error"
                icon="i-fa6-solid-trash"
                :title="t('gear_configs.delete')"
                @click="handleDelete(config.id)"
              />
            </div>
          </div>
        </div>
      </UCard>

      <!-- My Submissions -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fad fa-file-lines mr-2"></i>
              <h2 class="text-lg font-semibold">{{ t('submissions.title') }}</h2>
              <UBadge v-if="submissions.length > 0" color="neutral" variant="soft" size="sm">
                {{ submissions.length }}
              </UBadge>
            </div>
          </div>
        </template>

        <!-- Loading state -->
        <div v-if="submissionsLoading" class="flex justify-center py-10">
          <span class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></span>
        </div>

        <div v-else>
          <!-- Filter chips row -->
          <div class="flex flex-wrap gap-4 mb-4">
            <!-- Status filters -->
            <div class="flex flex-wrap gap-1.5">
              <UButton
                size="xs"
                :color="statusFilter === 'all' ? 'primary' : 'neutral'"
                :variant="statusFilter === 'all' ? 'solid' : 'outline'"
                @click="statusFilter = 'all'"
              >
                {{ t('submissions.filters.all') }}
              </UButton>
              <UButton
                size="xs"
                :color="statusFilter === 'pending' ? 'warning' : 'neutral'"
                :variant="statusFilter === 'pending' ? 'solid' : 'outline'"
                @click="statusFilter = 'pending'"
              >
                {{ t('submissions.filters.pending') }}
              </UButton>
              <UButton
                size="xs"
                :color="statusFilter === 'approved' ? 'success' : 'neutral'"
                :variant="statusFilter === 'approved' ? 'solid' : 'outline'"
                @click="statusFilter = 'approved'"
              >
                {{ t('submissions.filters.approved') }}
              </UButton>
              <UButton
                size="xs"
                :color="statusFilter === 'rejected' ? 'error' : 'neutral'"
                :variant="statusFilter === 'rejected' ? 'solid' : 'outline'"
                @click="statusFilter = 'rejected'"
              >
                {{ t('submissions.filters.rejected') }}
              </UButton>
            </div>

            <USeparator orientation="vertical" class="hidden sm:block h-6" />

            <!-- Type filters -->
            <div class="flex flex-wrap gap-1.5">
              <UButton
                size="xs"
                :variant="typeFilter === 'all' ? 'solid' : 'outline'"
                color="neutral"
                @click="typeFilter = 'all'"
              >
                {{ t('submissions.filters.all') }}
              </UButton>
              <UButton
                size="xs"
                :variant="typeFilter === 'document' ? 'solid' : 'outline'"
                color="neutral"
                @click="typeFilter = 'document'"
              >
                <i class="fa-duotone fa-books mr-1"></i>
                {{ t('submissions.filters.documents') }}
              </UButton>
              <UButton
                size="xs"
                :variant="typeFilter === 'registry' ? 'solid' : 'outline'"
                color="neutral"
                @click="typeFilter = 'registry'"
              >
                <i class="fa-duotone fa-clipboard-list mr-1"></i>
                {{ t('submissions.filters.registry') }}
              </UButton>
              <UButton
                size="xs"
                :variant="typeFilter === 'color' ? 'solid' : 'outline'"
                color="neutral"
                @click="typeFilter = 'color'"
              >
                <i class="fa-duotone fa-palette mr-1"></i>
                {{ t('submissions.filters.colors') }}
              </UButton>
              <UButton
                size="xs"
                :variant="typeFilter === 'wheel' ? 'solid' : 'outline'"
                color="neutral"
                @click="typeFilter = 'wheel'"
              >
                <i class="fa-duotone fa-tire mr-1"></i>
                {{ t('submissions.filters.wheels') }}
              </UButton>
            </div>
          </div>

          <!-- Submissions list -->
          <div v-if="filteredSubmissions.length > 0" class="space-y-3">
            <UCard v-for="item in filteredSubmissions" :key="item.id">
              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <!-- Badge row -->
                  <div class="flex flex-wrap gap-2 mb-2">
                    <UBadge :color="item.type === 'new_item' ? 'neutral' : 'info'" variant="soft" size="sm">
                      {{
                        item.type === 'new_item'
                          ? t('submissions.item.new_item')
                          : item.type === 'edit_suggestion'
                            ? t('submissions.item.edit_suggestion')
                            : t('submissions.item.new_collection')
                      }}
                    </UBadge>
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

                  <h4 class="text-sm font-semibold truncate">{{ getSubmissionTitle(item) }}</h4>

                  <div class="flex flex-wrap gap-4 mt-1.5 text-xs opacity-60">
                    <span>
                      <i class="fas fa-calendar-plus mr-1"></i>
                      {{ t('submissions.item.submitted') }}: {{ formatDate(item.createdAt) }}
                    </span>
                    <span v-if="item.reviewedAt">
                      <i class="fas fa-calendar-check mr-1"></i>
                      {{ t('submissions.item.reviewed') }}: {{ formatDate(item.reviewedAt) }}
                    </span>
                  </div>

                  <div
                    v-if="item.reviewerNotes && (item.status === 'approved' || item.status === 'rejected')"
                    class="mt-2"
                  >
                    <UAlert :color="item.status === 'approved' ? 'success' : 'error'" variant="soft" size="sm">
                      <template #title>{{ t('submissions.item.reviewer_notes') }}</template>
                      <template #description>{{ item.reviewerNotes }}</template>
                    </UAlert>
                  </div>
                </div>

                <div class="shrink-0">
                  <UBadge
                    :color="
                      item.status === 'pending' ? 'warning' : item.status === 'approved' ? 'success' : 'error'
                    "
                    size="sm"
                  >
                    {{
                      item.status === 'pending'
                        ? t('submissions.item.status.pending')
                        : item.status === 'approved'
                          ? t('submissions.item.status.approved')
                          : t('submissions.item.status.rejected')
                    }}
                  </UBadge>
                </div>
              </div>
            </UCard>
          </div>

          <!-- Empty state -->
          <div v-else class="text-center py-10">
            <i class="fa-duotone fa-inbox text-5xl opacity-30 block mb-3"></i>
            <p class="font-semibold mb-1">{{ t('submissions.empty.title') }}</p>
            <p class="text-sm opacity-60 mb-4 max-w-sm mx-auto">{{ t('submissions.empty.description') }}</p>
            <UButton to="/contribute" color="primary" variant="outline" size="sm">
              {{ t('submissions.empty.contribute_link') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Manage your saved gear configurations and account settings.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Dashboard",
    "auth": {
      "sign_in_title": "Sign In to View Dashboard",
      "sign_in_description": "You need to be signed in to access your dashboard. Create a free account to get started.",
      "sign_in_button": "Sign In to Continue"
    },
    "gear_configs": {
      "title": "Saved Gear Configurations",
      "open_calculator": "Open Calculator",
      "empty": "No saved configurations yet. Use the gearing calculator to save your first configuration.",
      "go_to_calculator": "Go to Gearing Calculator",
      "tire": "Tire",
      "rpm": "Max RPM",
      "public": "Public",
      "delete": "Delete configuration"
    },
    "submissions": {
      "title": "My Submissions",
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
      "item": {
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
    }
  },
  "es": {
    "title": "Panel - Classic Mini DIY",
    "description": "Administra tus configuraciones de engranajes guardadas.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Panel",
    "auth": {
      "sign_in_title": "Inicia Sesión para Ver el Panel",
      "sign_in_description": "Debes iniciar sesión para acceder a tu panel. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar Sesión para Continuar"
    },
    "gear_configs": {
      "title": "Configuraciones de Engranajes Guardadas",
      "open_calculator": "Abrir Calculadora",
      "empty": "Aún no hay configuraciones guardadas. Usa la calculadora de engranajes para guardar tu primera configuración.",
      "go_to_calculator": "Ir a la Calculadora de Engranajes",
      "tire": "Neumático",
      "rpm": "RPM Máximo",
      "public": "Público",
      "delete": "Eliminar configuración"
    },
    "submissions": {
      "title": "Mis Envíos",
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
      "item": {
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
    }
  },
  "fr": {
    "title": "Tableau de Bord - Classic Mini DIY",
    "description": "Gérez vos configurations d'engrenages sauvegardées.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Tableau de Bord",
    "auth": {
      "sign_in_title": "Connectez-vous pour Voir le Tableau de Bord",
      "sign_in_description": "Vous devez être connecté pour accéder à votre tableau de bord. Créez un compte gratuit pour commencer.",
      "sign_in_button": "Se Connecter pour Continuer"
    },
    "gear_configs": {
      "title": "Configurations d'Engrenages Sauvegardées",
      "open_calculator": "Ouvrir le Calculateur",
      "empty": "Aucune configuration sauvegardée. Utilisez le calculateur d'engrenages pour sauvegarder votre première configuration.",
      "go_to_calculator": "Aller au Calculateur d'Engrenages",
      "tire": "Pneu",
      "rpm": "RPM Max",
      "public": "Public",
      "delete": "Supprimer la configuration"
    },
    "submissions": {
      "title": "Mes Soumissions",
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
      "item": {
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
        "contribute_link": "Commencer à Contribuer"
      }
    }
  },
  "de": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Verwalten Sie Ihre gespeicherten Getriebe-Konfigurationen.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Dashboard",
    "auth": {
      "sign_in_title": "Anmelden zum Dashboard",
      "sign_in_description": "Sie müssen angemeldet sein, um auf Ihr Dashboard zuzugreifen. Erstellen Sie ein kostenloses Konto.",
      "sign_in_button": "Anmelden und Fortfahren"
    },
    "gear_configs": {
      "title": "Gespeicherte Getriebe-Konfigurationen",
      "open_calculator": "Rechner öffnen",
      "empty": "Noch keine gespeicherten Konfigurationen. Verwenden Sie den Getrieberechner, um Ihre erste Konfiguration zu speichern.",
      "go_to_calculator": "Zum Getrieberechner",
      "tire": "Reifen",
      "rpm": "Max Drehzahl",
      "public": "Öffentlich",
      "delete": "Konfiguration löschen"
    },
    "submissions": {
      "title": "Meine Einreichungen",
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
      "item": {
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
    }
  },
  "it": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Gestisci le tue configurazioni ingranaggi salvate.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Dashboard",
    "auth": {
      "sign_in_title": "Accedi per Vedere la Dashboard",
      "sign_in_description": "Devi essere connesso per accedere alla tua dashboard. Crea un account gratuito per iniziare.",
      "sign_in_button": "Accedi per Continuare"
    },
    "gear_configs": {
      "title": "Configurazioni Ingranaggi Salvate",
      "open_calculator": "Apri Calcolatore",
      "empty": "Nessuna configurazione salvata. Usa il calcolatore degli ingranaggi per salvare la tua prima configurazione.",
      "go_to_calculator": "Vai al Calcolatore Ingranaggi",
      "tire": "Pneumatico",
      "rpm": "RPM Max",
      "public": "Pubblico",
      "delete": "Elimina configurazione"
    },
    "submissions": {
      "title": "Le Mie Proposte",
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
      "item": {
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
    }
  },
  "pt": {
    "title": "Painel - Classic Mini DIY",
    "description": "Gerencie suas configurações de engrenagens salvas.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Painel",
    "auth": {
      "sign_in_title": "Entre para Ver o Painel",
      "sign_in_description": "Você precisa estar conectado para acessar seu painel. Crie uma conta gratuita para começar.",
      "sign_in_button": "Entrar para Continuar"
    },
    "gear_configs": {
      "title": "Configurações de Engrenagens Salvas",
      "open_calculator": "Abrir Calculadora",
      "empty": "Nenhuma configuração salva. Use a calculadora de engrenagens para salvar sua primeira configuração.",
      "go_to_calculator": "Ir para a Calculadora de Engrenagens",
      "tire": "Pneu",
      "rpm": "RPM Máx",
      "public": "Público",
      "delete": "Excluir configuração"
    },
    "submissions": {
      "title": "Meus Envios",
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
      "item": {
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
    }
  },
  "ru": {
    "title": "Панель управления - Classic Mini DIY",
    "description": "Управляйте сохранёнными конфигурациями передач.",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Панель управления",
    "auth": {
      "sign_in_title": "Войдите для Доступа к Панели",
      "sign_in_description": "Вы должны быть авторизованы для доступа к панели управления. Создайте бесплатную учётную запись.",
      "sign_in_button": "Войти и Продолжить"
    },
    "gear_configs": {
      "title": "Сохранённые конфигурации передач",
      "open_calculator": "Открыть калькулятор",
      "empty": "Нет сохранённых конфигураций. Используйте калькулятор передач для сохранения первой конфигурации.",
      "go_to_calculator": "Перейти к калькулятору передач",
      "tire": "Шина",
      "rpm": "Макс. об/мин",
      "public": "Публичный",
      "delete": "Удалить конфигурацию"
    },
    "submissions": {
      "title": "Мои заявки",
      "filters": {
        "all": "Все",
        "pending": "Ожидает",
        "approved": "Одобрено",
        "rejected": "Отклонено",
        "documents": "Документы",
        "registry": "Реестр",
        "colors": "Цвета",
        "wheels": "Колёса"
      },
      "item": {
        "new_item": "Новый",
        "edit_suggestion": "Правка",
        "new_collection": "Коллекция",
        "status": {
          "pending": "Ожидает",
          "approved": "Одобрено",
          "rejected": "Отклонено"
        },
        "reviewer_notes": "Заметки проверяющего",
        "submitted": "Отправлено",
        "reviewed": "Проверено"
      },
      "empty": {
        "title": "Заявок пока нет",
        "description": "Вы ещё не внесли вклад в архив. Начните с отправки документа, регистрации вашего Mini или добавления цвета.",
        "contribute_link": "Начать вносить вклад"
      }
    }
  },
  "ja": {
    "title": "ダッシュボード - Classic Mini DIY",
    "description": "保存したギア設定を管理します。",
    "hero_title": "Classic Mini アーカイブ",
    "breadcrumb_title": "ダッシュボード",
    "auth": {
      "sign_in_title": "ダッシュボード表示にはログインが必要です",
      "sign_in_description": "ダッシュボードにアクセスするにはログインが必要です。無料アカウントを作成して始めましょう。",
      "sign_in_button": "ログインして続ける"
    },
    "gear_configs": {
      "title": "保存済みギア設定",
      "open_calculator": "計算機を開く",
      "empty": "保存済み設定がまだありません。ギア計算機を使用して最初の設定を保存しましょう。",
      "go_to_calculator": "ギア計算機へ",
      "tire": "タイヤ",
      "rpm": "最大RPM",
      "public": "公開",
      "delete": "設定を削除"
    },
    "submissions": {
      "title": "私の申請",
      "filters": {
        "all": "すべて",
        "pending": "審査中",
        "approved": "承認済み",
        "rejected": "却下",
        "documents": "ドキュメント",
        "registry": "レジストリ",
        "colors": "カラー",
        "wheels": "ホイール"
      },
      "item": {
        "new_item": "新規",
        "edit_suggestion": "編集",
        "new_collection": "コレクション",
        "status": {
          "pending": "審査中",
          "approved": "承認済み",
          "rejected": "却下"
        },
        "reviewer_notes": "レビュアーのメモ",
        "submitted": "提出日",
        "reviewed": "審査日"
      },
      "empty": {
        "title": "申請はまだありません",
        "description": "アーカイブへの貢献がまだありません。ドキュメントの送信、ミニの登録、またはカラーの投稿から始めましょう。",
        "contribute_link": "貢献を始める"
      }
    }
  },
  "zh": {
    "title": "仪表板 - Classic Mini DIY",
    "description": "管理您保存的齿轮配置。",
    "hero_title": "Classic Mini 档案",
    "breadcrumb_title": "仪表板",
    "auth": {
      "sign_in_title": "登录以查看仪表板",
      "sign_in_description": "您需要登录才能访问您的仪表板。创建免费账户即可开始。",
      "sign_in_button": "登录并继续"
    },
    "gear_configs": {
      "title": "已保存的齿轮配置",
      "open_calculator": "打开计算器",
      "empty": "还没有保存的配置。使用齿轮计算器保存您的第一个配置。",
      "go_to_calculator": "前往齿轮计算器",
      "tire": "轮胎",
      "rpm": "最大转速",
      "public": "公开",
      "delete": "删除配置"
    },
    "submissions": {
      "title": "我的提交",
      "filters": {
        "all": "全部",
        "pending": "待审核",
        "approved": "已批准",
        "rejected": "已拒绝",
        "documents": "文档",
        "registry": "注册表",
        "colors": "颜色",
        "wheels": "轮毂"
      },
      "item": {
        "new_item": "新建",
        "edit_suggestion": "编辑",
        "new_collection": "集合",
        "status": {
          "pending": "待审核",
          "approved": "已批准",
          "rejected": "已拒绝"
        },
        "reviewer_notes": "审核员备注",
        "submitted": "提交时间",
        "reviewed": "审核时间"
      },
      "empty": {
        "title": "暂无提交",
        "description": "您还没有为档案库做出任何贡献。从提交文档、注册您的迷你或贡献颜色开始吧。",
        "contribute_link": "开始贡献"
      }
    }
  },
  "ko": {
    "title": "대시보드 - Classic Mini DIY",
    "description": "저장된 기어 구성을 관리하세요.",
    "hero_title": "Classic Mini 아카이브",
    "breadcrumb_title": "대시보드",
    "auth": {
      "sign_in_title": "대시보드 보기를 위해 로그인하세요",
      "sign_in_description": "대시보드에 접근하려면 로그인해야 합니다. 무료 계정을 만들어 시작하세요.",
      "sign_in_button": "로그인하고 계속하기"
    },
    "gear_configs": {
      "title": "저장된 기어 구성",
      "open_calculator": "계산기 열기",
      "empty": "저장된 구성이 아직 없습니다. 기어 계산기를 사용하여 첫 번째 구성을 저장하세요.",
      "go_to_calculator": "기어 계산기로 이동",
      "tire": "타이어",
      "rpm": "최대 RPM",
      "public": "공개",
      "delete": "구성 삭제"
    },
    "submissions": {
      "title": "내 제출",
      "filters": {
        "all": "전체",
        "pending": "대기 중",
        "approved": "승인됨",
        "rejected": "거부됨",
        "documents": "문서",
        "registry": "레지스트리",
        "colors": "색상",
        "wheels": "휠"
      },
      "item": {
        "new_item": "신규",
        "edit_suggestion": "수정",
        "new_collection": "컬렉션",
        "status": {
          "pending": "대기 중",
          "approved": "승인됨",
          "rejected": "거부됨"
        },
        "reviewer_notes": "검토자 메모",
        "submitted": "제출일",
        "reviewed": "검토일"
      },
      "empty": {
        "title": "제출이 아직 없습니다",
        "description": "아직 아카이브에 기여한 내용이 없습니다. 문서 제출, 미니 등록, 또는 색상 기여로 시작하세요.",
        "contribute_link": "기여 시작하기"
      }
    }
  }
}
</i18n>
