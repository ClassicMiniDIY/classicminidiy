<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
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
    title: t('title'),
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
</script>

<template>
  <Hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <Breadcrumb :page="t('breadcrumb_title')" />
    </div>

    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-4">{{ t('main_heading') }}</h1>
      <p class="mb-6 text-base">{{ t('description_text') }}</p>
      <USeparator />
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
    <div v-else>
      <!-- Filter chips row -->
      <div class="flex flex-wrap gap-6 mb-6">
        <!-- Status filters -->
        <div class="flex flex-wrap gap-2">
          <UButton
            size="sm"
            :color="statusFilter === 'all' ? 'primary' : 'neutral'"
            :variant="statusFilter === 'all' ? 'solid' : 'outline'"
            @click="statusFilter = 'all'"
          >
            {{ t('filters.all') }}
          </UButton>
          <UButton
            size="sm"
            :color="statusFilter === 'pending' ? 'warning' : 'neutral'"
            :variant="statusFilter === 'pending' ? 'solid' : 'outline'"
            @click="statusFilter = 'pending'"
          >
            {{ t('filters.pending') }}
          </UButton>
          <UButton
            size="sm"
            :color="statusFilter === 'approved' ? 'success' : 'neutral'"
            :variant="statusFilter === 'approved' ? 'solid' : 'outline'"
            @click="statusFilter = 'approved'"
          >
            {{ t('filters.approved') }}
          </UButton>
          <UButton
            size="sm"
            :color="statusFilter === 'rejected' ? 'error' : 'neutral'"
            :variant="statusFilter === 'rejected' ? 'solid' : 'outline'"
            @click="statusFilter = 'rejected'"
          >
            {{ t('filters.rejected') }}
          </UButton>
        </div>

        <USeparator orientation="vertical" class="hidden sm:block h-8" />

        <!-- Type filters -->
        <div class="flex flex-wrap gap-2">
          <UButton
            size="sm"
            :color="typeFilter === 'all' ? 'neutral' : 'neutral'"
            :variant="typeFilter === 'all' ? 'solid' : 'outline'"
            @click="typeFilter = 'all'"
          >
            {{ t('filters.all') }}
          </UButton>
          <UButton
            size="sm"
            :color="typeFilter === 'document' ? 'neutral' : 'neutral'"
            :variant="typeFilter === 'document' ? 'solid' : 'outline'"
            @click="typeFilter = 'document'"
          >
            <i class="fa-duotone fa-books mr-1"></i>
            {{ t('filters.documents') }}
          </UButton>
          <UButton
            size="sm"
            :color="typeFilter === 'registry' ? 'neutral' : 'neutral'"
            :variant="typeFilter === 'registry' ? 'solid' : 'outline'"
            @click="typeFilter = 'registry'"
          >
            <i class="fa-duotone fa-clipboard-list mr-1"></i>
            {{ t('filters.registry') }}
          </UButton>
          <UButton
            size="sm"
            :color="typeFilter === 'color' ? 'neutral' : 'neutral'"
            :variant="typeFilter === 'color' ? 'solid' : 'outline'"
            @click="typeFilter = 'color'"
          >
            <i class="fa-duotone fa-palette mr-1"></i>
            {{ t('filters.colors') }}
          </UButton>
          <UButton
            size="sm"
            :color="typeFilter === 'wheel' ? 'neutral' : 'neutral'"
            :variant="typeFilter === 'wheel' ? 'solid' : 'outline'"
            @click="typeFilter = 'wheel'"
          >
            <i class="fa-duotone fa-tire mr-1"></i>
            {{ t('filters.wheels') }}
          </UButton>
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
                  {{ item.type === 'new_item' ? t('submission.new_item') : item.type === 'edit_suggestion' ? t('submission.edit_suggestion') : t('submission.new_collection') }}
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
                  {{ t('submission.submitted') }}: {{ formatDate(item.createdAt) }}
                </span>
                <span v-if="item.reviewedAt">
                  <i class="fas fa-calendar-check mr-1"></i>
                  {{ t('submission.reviewed') }}: {{ formatDate(item.reviewedAt) }}
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
                  <template #title>{{ t('submission.reviewer_notes') }}</template>
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
                {{ item.status === 'pending' ? t('submission.status.pending') : item.status === 'approved' ? t('submission.status.approved') : t('submission.status.rejected') }}
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
        <h2 class="text-2xl font-bold mb-2">{{ t('empty.title') }}</h2>
        <p class="opacity-70 mb-6 max-w-md mx-auto">{{ t('empty.description') }}</p>
        <UButton to="/contribute" color="primary" variant="outline">
          {{ t('empty.contribute_link') }}
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
  "ru": {
    "title": "Мои заявки - Classic Mini DIY",
    "description": "Просматривайте историю заявок и отслеживайте статус ваших вкладов в архив Classic Mini DIY.",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Мои заявки",
    "main_heading": "Мои заявки",
    "description_text": "Отслеживайте статус всех ваших вкладов в архив Classic Mini DIY, включая документы, записи реестра, цвета и колёса.",
    "auth": {
      "sign_in_title": "Войдите для просмотра заявок",
      "sign_in_description": "Для просмотра истории заявок необходимо войти в систему. Создайте бесплатную учётную запись, чтобы начать.",
      "sign_in_button": "Войти для продолжения"
    },
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
    "submission": {
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
  },
  "ja": {
    "title": "私の申請 - Classic Mini DIY",
    "description": "申請履歴を確認し、Classic Mini DIY アーカイブへの貢献状況を追跡する。",
    "hero_title": "Classic Mini アーカイブ",
    "breadcrumb_title": "私の申請",
    "main_heading": "私の申請",
    "description_text": "ドキュメント、レジストリエントリ、カラー、ホイールを含む、Classic Mini DIY アーカイブへのすべての貢献状況を追跡します。",
    "auth": {
      "sign_in_title": "申請を確認するにはサインインしてください",
      "sign_in_description": "申請履歴を確認するにはサインインが必要です。無料アカウントを作成して始めましょう。",
      "sign_in_button": "続けるにはサインイン"
    },
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
    "submission": {
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
  },
  "zh": {
    "title": "我的提交 - Classic Mini DIY",
    "description": "查看您的提交历史并追踪您对 Classic Mini DIY 档案库贡献的状态。",
    "hero_title": "Classic Mini 档案库",
    "breadcrumb_title": "我的提交",
    "main_heading": "我的提交",
    "description_text": "追踪您对 Classic Mini DIY 档案库所有贡献的状态，包括文档、注册表条目、颜色和轮毂。",
    "auth": {
      "sign_in_title": "登录以查看提交",
      "sign_in_description": "您需要登录才能查看提交历史。创建免费账户即可开始。",
      "sign_in_button": "登录以继续"
    },
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
    "submission": {
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
  },
  "ko": {
    "title": "내 제출 - Classic Mini DIY",
    "description": "제출 기록을 확인하고 Classic Mini DIY 아카이브에 대한 기여 상태를 추적하세요.",
    "hero_title": "Classic Mini 아카이브",
    "breadcrumb_title": "내 제출",
    "main_heading": "내 제출",
    "description_text": "문서, 레지스트리 항목, 색상, 휠을 포함한 Classic Mini DIY 아카이브에 대한 모든 기여 상태를 추적하세요.",
    "auth": {
      "sign_in_title": "제출을 보려면 로그인하세요",
      "sign_in_description": "제출 기록을 보려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
      "sign_in_button": "계속하려면 로그인"
    },
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
    "submission": {
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
</i18n>
