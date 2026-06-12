<script lang="ts" setup>
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
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

  function getSubmissionTitle(item: { data: Record<string, any>; targetType: string; type: string }): string {
    // For edit suggestions, data contains { changes, reason }
    if (item.type === 'edit_suggestion') {
      return item.data.reason || t('submissions.item.edit_suggestion');
    }
    // For collections, title may be nested under documents array
    if (item.type === 'new_collection' && item.data.documents?.[0]?.title) {
      return item.data.title || item.data.documents[0].title;
    }
    // Standard: check title, name, color_name, then fallback by type
    return item.data.title || item.data.name || item.data.color_name || item.data.model || t('submissions.item.untitled');
  }

  // Get detailed info for the expanded view
  function getSubmissionDetails(item: { data: Record<string, any>; targetType: string; type: string }): { label: string; value: string }[] {
    const details: { label: string; value: string }[] = [];
    const d = item.data;

    if (item.type === 'edit_suggestion') {
      if (d.reason) details.push({ label: t('submissions.detail.reason'), value: d.reason });
      if (d.changes) {
        Object.entries(d.changes as Record<string, { from: any; to: any }>).forEach(([field, change]) => {
          details.push({ label: field, value: `${change.from} → ${change.to}` });
        });
      }
      return details;
    }

    // Common fields
    if (d.title) details.push({ label: t('submissions.detail.title'), value: d.title });
    if (d.name) details.push({ label: t('submissions.detail.name'), value: d.name });
    if (d.color_name) details.push({ label: t('submissions.detail.name'), value: d.color_name });
    if (d.type) details.push({ label: t('submissions.detail.type'), value: d.type });
    if (d.description) details.push({ label: t('submissions.detail.description'), value: d.description });

    // Document-specific
    if (d.author) details.push({ label: t('submissions.detail.author'), value: d.author });
    if (d.code) details.push({ label: t('submissions.detail.code'), value: d.code });
    if (d.year) details.push({ label: t('submissions.detail.year'), value: String(d.year) });

    // Color-specific
    if (d.primary_code) details.push({ label: t('submissions.detail.code'), value: d.primary_code });
    if (d.hex) details.push({ label: t('submissions.detail.hex'), value: d.hex });

    // Wheel-specific
    if (d.size) details.push({ label: t('submissions.detail.size'), value: d.size });
    if (d.width) details.push({ label: t('submissions.detail.width'), value: d.width });
    if (d.offset) details.push({ label: t('submissions.detail.offset'), value: d.offset });

    // Registry-specific
    if (d.model) details.push({ label: t('submissions.detail.model'), value: d.model });
    if (d.trim) details.push({ label: t('submissions.detail.trim'), value: d.trim });
    if (d.chassis_number) details.push({ label: t('submissions.detail.chassis'), value: d.chassis_number });

    return details;
  }

  const expandedSubmission = ref<string | null>(null);

  function toggleSubmission(id: string) {
    expandedSubmission.value = expandedSubmission.value === id ? null : id;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  watch(
    isAuthenticated,
    async (authed) => {
      if (authed) {
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
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="fad fa-file-lines mr-2"></i>
          <h2 class="text-lg font-semibold">{{ t('submissions.title') }}</h2>
        </div>
        <div v-if="submissions.length > 0" class="flex items-center gap-3 text-sm">
          <span v-if="submissions.filter((s) => s.status === 'pending').length > 0" class="flex items-center gap-1">
            <span class="badge badge-warning badge-soft badge-sm">
              {{ submissions.filter((s) => s.status === 'pending').length }} {{ t('submissions.filters.pending') }}
            </span>
          </span>
          <span class="opacity-60">
            {{ t('submissions.total_count', { count: submissions.length }) }}
          </span>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="submissionsLoading" class="flex justify-center py-10">
        <span class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></span>
      </div>

      <div v-else>
        <!-- Filter chips row -->
        <div class="flex flex-wrap gap-4 mb-4">
          <!-- Status filters -->
          <div class="flex flex-wrap gap-1.5">
            <button
              class="btn btn-xs"
              :class="statusFilter === 'all' ? 'btn-primary' : 'btn-outline'"
              @click="statusFilter = 'all'"
            >
              {{ t('submissions.filters.all') }}
            </button>
            <button
              class="btn btn-xs"
              :class="statusFilter === 'pending' ? 'btn-warning' : 'btn-outline'"
              @click="statusFilter = 'pending'"
            >
              {{ t('submissions.filters.pending') }}
            </button>
            <button
              class="btn btn-xs"
              :class="statusFilter === 'approved' ? 'btn-success' : 'btn-outline'"
              @click="statusFilter = 'approved'"
            >
              {{ t('submissions.filters.approved') }}
            </button>
            <button
              class="btn btn-xs"
              :class="statusFilter === 'rejected' ? 'btn-error' : 'btn-outline'"
              @click="statusFilter = 'rejected'"
            >
              {{ t('submissions.filters.rejected') }}
            </button>
          </div>

          <div class="divider divider-horizontal hidden sm:flex"></div>

          <!-- Type filters -->
          <div class="flex flex-wrap gap-1.5">
            <button
              class="btn btn-xs"
              :class="typeFilter === 'all' ? 'btn-neutral' : 'btn-outline'"
              @click="typeFilter = 'all'"
            >
              {{ t('submissions.filters.all') }}
            </button>
            <button
              class="btn btn-xs"
              :class="typeFilter === 'document' ? 'btn-neutral' : 'btn-outline'"
              @click="typeFilter = 'document'"
            >
              <i class="fa-duotone fa-books mr-1"></i>
              {{ t('submissions.filters.documents') }}
            </button>
            <button
              class="btn btn-xs"
              :class="typeFilter === 'registry' ? 'btn-neutral' : 'btn-outline'"
              @click="typeFilter = 'registry'"
            >
              <i class="fa-duotone fa-clipboard-list mr-1"></i>
              {{ t('submissions.filters.registry') }}
            </button>
            <button
              class="btn btn-xs"
              :class="typeFilter === 'color' ? 'btn-neutral' : 'btn-outline'"
              @click="typeFilter = 'color'"
            >
              <i class="fa-duotone fa-palette mr-1"></i>
              {{ t('submissions.filters.colors') }}
            </button>
            <button
              class="btn btn-xs"
              :class="typeFilter === 'wheel' ? 'btn-neutral' : 'btn-outline'"
              @click="typeFilter = 'wheel'"
            >
              <i class="fa-duotone fa-tire mr-1"></i>
              {{ t('submissions.filters.wheels') }}
            </button>
          </div>
        </div>

        <!-- Submissions list -->
        <div v-if="filteredSubmissions.length > 0" class="space-y-3">
          <div
            v-for="item in filteredSubmissions"
            :key="item.id"
            class="border border-base-300 rounded-lg overflow-hidden transition-colors hover:border-primary/40 cursor-pointer"
            @click="toggleSubmission(item.id)"
          >
            <!-- Summary row (always visible) -->
            <div class="flex items-center gap-3 p-4">
              <i
                class="fas fa-chevron-right text-xs opacity-40 transition-transform"
                :class="{ 'rotate-90': expandedSubmission === item.id }"
              ></i>

              <!-- Type icon -->
              <i
                class="fa-duotone text-base opacity-60"
                :class="{
                  'fa-books': item.targetType === 'document',
                  'fa-clipboard-list': item.targetType === 'registry',
                  'fa-palette': item.targetType === 'color',
                  'fa-tire': item.targetType === 'wheel',
                  'fa-file': !['document', 'registry', 'color', 'wheel'].includes(item.targetType),
                }"
              ></i>

              <!-- Title & date -->
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold truncate">{{ getSubmissionTitle(item) }}</h4>
                <span class="text-xs opacity-50">{{ formatDate(item.createdAt) }}</span>
              </div>

              <!-- Status badge -->
              <span
                class="badge badge-sm"
                :class="item.status === 'pending' ? 'badge-warning' : item.status === 'approved' ? 'badge-success' : 'badge-error'"
              >
                {{
                  item.status === 'pending'
                    ? t('submissions.item.status.pending')
                    : item.status === 'approved'
                      ? t('submissions.item.status.approved')
                      : t('submissions.item.status.rejected')
                }}
              </span>
            </div>

            <!-- Expanded details -->
            <div v-if="expandedSubmission === item.id" class="border-t border-base-300 px-4 pb-4 pt-3 space-y-3">
              <!-- Type badges -->
              <div class="flex flex-wrap gap-2">
                <span class="badge badge-soft badge-sm" :class="item.type === 'new_item' ? 'badge-neutral' : 'badge-info'">
                  {{
                    item.type === 'new_item'
                      ? t('submissions.item.new_item')
                      : item.type === 'edit_suggestion'
                        ? t('submissions.item.edit_suggestion')
                        : t('submissions.item.new_collection')
                  }}
                </span>
                <span class="badge badge-neutral badge-outline badge-sm">
                  {{ item.targetType }}
                </span>
              </div>

              <!-- Detail fields -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="detail in getSubmissionDetails(item)" :key="detail.label" class="text-sm">
                  <span class="opacity-50">{{ detail.label }}:</span>
                  <span class="ml-1 font-medium">{{ detail.value }}</span>
                </div>
              </div>

              <!-- Dates -->
              <div class="flex flex-wrap gap-4 text-xs opacity-60">
                <span>
                  <i class="fas fa-calendar-plus mr-1"></i>
                  {{ t('submissions.item.submitted') }}: {{ formatDate(item.createdAt) }}
                </span>
                <span v-if="item.reviewedAt">
                  <i class="fas fa-calendar-check mr-1"></i>
                  {{ t('submissions.item.reviewed') }}: {{ formatDate(item.reviewedAt) }}
                </span>
              </div>

              <!-- Submission ID -->
              <p class="text-xs opacity-40 font-mono">ID: {{ item.id }}</p>

              <!-- Reviewer notes -->
              <div v-if="item.reviewerNotes && (item.status === 'approved' || item.status === 'rejected')">
                <div
                  role="alert"
                  class="alert alert-soft"
                  :class="item.status === 'approved' ? 'alert-success' : 'alert-error'"
                >
                  <div>
                    <div class="font-semibold">{{ t('submissions.item.reviewer_notes') }}</div>
                    <div class="text-sm">{{ item.reviewerNotes }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-10">
          <i class="fa-duotone fa-inbox text-5xl opacity-30 block mb-3"></i>
          <p class="font-semibold mb-1">{{ t('submissions.empty.title') }}</p>
          <p class="text-sm opacity-60 mb-4 max-w-sm mx-auto">{{ t('submissions.empty.description') }}</p>
          <NuxtLink to="/contribute" class="btn btn-primary btn-outline btn-sm">
            {{ t('submissions.empty.contribute_link') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "submissions": {
      "title": "My Submissions",
      "total_count": "{count} total",
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
        "edit_suggestion": "Edit Suggestion",
        "new_collection": "Collection",
        "untitled": "Untitled Submission",
        "status": { "pending": "Pending", "approved": "Approved", "rejected": "Rejected" },
        "reviewer_notes": "Reviewer Notes",
        "submitted": "Submitted",
        "reviewed": "Reviewed"
      },
      "detail": {
        "title": "Title",
        "name": "Name",
        "type": "Type",
        "description": "Description",
        "author": "Author",
        "code": "Code",
        "year": "Year",
        "hex": "Hex Color",
        "size": "Size",
        "width": "Width",
        "offset": "Offset",
        "model": "Model",
        "trim": "Trim",
        "chassis": "Chassis Number",
        "reason": "Reason"
      },
      "empty": {
        "title": "No Submissions Yet",
        "description": "You haven't made any contributions to the archive yet. Start by submitting a document, registering your Mini, or contributing a color.",
        "contribute_link": "Start Contributing"
      }
    }
  },
  "es": {
    "submissions": {
      "title": "Mis Envíos",
      "total_count": "{count} en total",
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
        "edit_suggestion": "Sugerencia de Edición",
        "new_collection": "Colección",
        "untitled": "Envío sin título",
        "status": { "pending": "Pendiente", "approved": "Aprobado", "rejected": "Rechazado" },
        "reviewer_notes": "Notas del Revisor",
        "submitted": "Enviado",
        "reviewed": "Revisado"
      },
      "detail": {
        "title": "Título",
        "name": "Nombre",
        "type": "Tipo",
        "description": "Descripción",
        "author": "Autor",
        "code": "Código",
        "year": "Año",
        "hex": "Color Hex",
        "size": "Tamaño",
        "width": "Ancho",
        "offset": "Offset",
        "model": "Modelo",
        "trim": "Acabado",
        "chassis": "Número de Chasis",
        "reason": "Motivo"
      },
      "empty": {
        "title": "Sin Envíos Aún",
        "description": "Aún no has hecho contribuciones al archivo. Comienza enviando un documento, registrando tu Mini o contribuyendo un color.",
        "contribute_link": "Empezar a Contribuir"
      }
    }
  },
  "fr": {
    "submissions": {
      "title": "Mes Soumissions",
      "total_count": "{count} au total",
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
        "edit_suggestion": "Suggestion de Modification",
        "new_collection": "Collection",
        "untitled": "Soumission sans titre",
        "status": { "pending": "En attente", "approved": "Approuvé", "rejected": "Rejeté" },
        "reviewer_notes": "Notes du Réviseur",
        "submitted": "Soumis",
        "reviewed": "Révisé"
      },
      "detail": {
        "title": "Titre",
        "name": "Nom",
        "type": "Type",
        "description": "Description",
        "author": "Auteur",
        "code": "Code",
        "year": "Année",
        "hex": "Couleur Hex",
        "size": "Taille",
        "width": "Largeur",
        "offset": "Décalage",
        "model": "Modèle",
        "trim": "Finition",
        "chassis": "Numéro de Châssis",
        "reason": "Raison"
      },
      "empty": {
        "title": "Aucune Soumission Pour l'Instant",
        "description": "Vous n'avez pas encore fait de contributions aux archives. Commencez par soumettre un document, enregistrer votre Mini ou contribuer une couleur.",
        "contribute_link": "Commencer à Contribuer"
      }
    }
  },
  "de": {
    "submissions": {
      "title": "Meine Einreichungen",
      "total_count": "{count} insgesamt",
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
        "edit_suggestion": "Bearbeitungsvorschlag",
        "new_collection": "Sammlung",
        "untitled": "Unbenannte Einreichung",
        "status": { "pending": "Ausstehend", "approved": "Genehmigt", "rejected": "Abgelehnt" },
        "reviewer_notes": "Prüfernotizen",
        "submitted": "Eingereicht",
        "reviewed": "Überprüft"
      },
      "detail": {
        "title": "Titel",
        "name": "Name",
        "type": "Typ",
        "description": "Beschreibung",
        "author": "Autor",
        "code": "Code",
        "year": "Jahr",
        "hex": "Hex-Farbe",
        "size": "Größe",
        "width": "Breite",
        "offset": "Einpresstiefe",
        "model": "Modell",
        "trim": "Ausstattung",
        "chassis": "Fahrgestellnummer",
        "reason": "Grund"
      },
      "empty": {
        "title": "Noch keine Einreichungen",
        "description": "Sie haben noch keine Beiträge zum Archiv geleistet. Beginnen Sie mit der Einreichung eines Dokuments, der Registrierung Ihres Mini oder der Einreichung einer Farbe.",
        "contribute_link": "Jetzt beitragen"
      }
    }
  },
  "it": {
    "submissions": {
      "title": "Le Mie Proposte",
      "total_count": "{count} in totale",
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
        "edit_suggestion": "Suggerimento di Modifica",
        "new_collection": "Raccolta",
        "untitled": "Proposta senza titolo",
        "status": { "pending": "In attesa", "approved": "Approvato", "rejected": "Rifiutato" },
        "reviewer_notes": "Note del Revisore",
        "submitted": "Inviato",
        "reviewed": "Revisionato"
      },
      "detail": {
        "title": "Titolo",
        "name": "Nome",
        "type": "Tipo",
        "description": "Descrizione",
        "author": "Autore",
        "code": "Codice",
        "year": "Anno",
        "hex": "Colore Hex",
        "size": "Dimensione",
        "width": "Larghezza",
        "offset": "Offset",
        "model": "Modello",
        "trim": "Allestimento",
        "chassis": "Numero di Telaio",
        "reason": "Motivo"
      },
      "empty": {
        "title": "Nessuna Proposta Ancora",
        "description": "Non hai ancora fatto contributi all'archivio. Inizia inviando un documento, registrando il tuo Mini o contribuendo un colore.",
        "contribute_link": "Inizia a Contribuire"
      }
    }
  },
  "pt": {
    "submissions": {
      "title": "Meus Envios",
      "total_count": "{count} no total",
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
        "edit_suggestion": "Sugestão de Edição",
        "new_collection": "Coleção",
        "untitled": "Envio sem título",
        "status": { "pending": "Pendente", "approved": "Aprovado", "rejected": "Rejeitado" },
        "reviewer_notes": "Notas do Revisor",
        "submitted": "Enviado",
        "reviewed": "Revisado"
      },
      "detail": {
        "title": "Título",
        "name": "Nome",
        "type": "Tipo",
        "description": "Descrição",
        "author": "Autor",
        "code": "Código",
        "year": "Ano",
        "hex": "Cor Hex",
        "size": "Tamanho",
        "width": "Largura",
        "offset": "Offset",
        "model": "Modelo",
        "trim": "Versão",
        "chassis": "Número do Chassi",
        "reason": "Motivo"
      },
      "empty": {
        "title": "Sem Envios Ainda",
        "description": "Você ainda não fez contribuições ao arquivo. Comece enviando um documento, registrando seu Mini ou contribuindo com uma cor.",
        "contribute_link": "Comece a Contribuir"
      }
    }
  },
  "ru": {
    "submissions": {
      "title": "Мои заявки",
      "total_count": "{count} всего",
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
        "edit_suggestion": "Предложение правки",
        "new_collection": "Коллекция",
        "untitled": "Заявка без названия",
        "status": { "pending": "Ожидает", "approved": "Одобрено", "rejected": "Отклонено" },
        "reviewer_notes": "Заметки проверяющего",
        "submitted": "Отправлено",
        "reviewed": "Проверено"
      },
      "detail": {
        "title": "Заголовок",
        "name": "Название",
        "type": "Тип",
        "description": "Описание",
        "author": "Автор",
        "code": "Код",
        "year": "Год",
        "hex": "Цвет Hex",
        "size": "Размер",
        "width": "Ширина",
        "offset": "Вылет",
        "model": "Модель",
        "trim": "Комплектация",
        "chassis": "Номер шасси",
        "reason": "Причина"
      },
      "empty": {
        "title": "Заявок пока нет",
        "description": "Вы ещё не внесли вклад в архив. Начните с отправки документа, регистрации вашего Mini или добавления цвета.",
        "contribute_link": "Начать вносить вклад"
      }
    }
  },
  "ja": {
    "submissions": {
      "title": "私の申請",
      "total_count": "{count} 件",
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
        "edit_suggestion": "編集提案",
        "new_collection": "コレクション",
        "untitled": "タイトルなしの申請",
        "status": { "pending": "審査中", "approved": "承認済み", "rejected": "却下" },
        "reviewer_notes": "レビュアーのメモ",
        "submitted": "提出日",
        "reviewed": "審査日"
      },
      "detail": {
        "title": "タイトル",
        "name": "名前",
        "type": "タイプ",
        "description": "説明",
        "author": "著者",
        "code": "コード",
        "year": "年式",
        "hex": "Hexカラー",
        "size": "サイズ",
        "width": "幅",
        "offset": "オフセット",
        "model": "モデル",
        "trim": "グレード",
        "chassis": "シャシー番号",
        "reason": "理由"
      },
      "empty": {
        "title": "申請はまだありません",
        "description": "アーカイブへの貢献がまだありません。ドキュメントの送信、ミニの登録、またはカラーの投稿から始めましょう。",
        "contribute_link": "貢献を始める"
      }
    }
  },
  "zh": {
    "submissions": {
      "title": "我的提交",
      "total_count": "共 {count} 个",
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
        "edit_suggestion": "编辑建议",
        "new_collection": "集合",
        "untitled": "未命名提交",
        "status": { "pending": "待审核", "approved": "已批准", "rejected": "已拒绝" },
        "reviewer_notes": "审核员备注",
        "submitted": "提交时间",
        "reviewed": "审核时间"
      },
      "detail": {
        "title": "标题",
        "name": "名称",
        "type": "类型",
        "description": "描述",
        "author": "作者",
        "code": "代码",
        "year": "年份",
        "hex": "Hex颜色",
        "size": "尺寸",
        "width": "宽度",
        "offset": "偏距",
        "model": "型号",
        "trim": "配置",
        "chassis": "底盘编号",
        "reason": "原因"
      },
      "empty": {
        "title": "暂无提交",
        "description": "您还没有为档案库做出任何贡献。从提交文档、注册您的迷你或贡献颜色开始吧。",
        "contribute_link": "开始贡献"
      }
    }
  },
  "ko": {
    "submissions": {
      "title": "내 제출",
      "total_count": "{count} 건",
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
        "edit_suggestion": "수정 제안",
        "new_collection": "컬렉션",
        "untitled": "제목 없는 제출",
        "status": { "pending": "대기 중", "approved": "승인됨", "rejected": "거부됨" },
        "reviewer_notes": "검토자 메모",
        "submitted": "제출일",
        "reviewed": "검토일"
      },
      "detail": {
        "title": "제목",
        "name": "이름",
        "type": "유형",
        "description": "설명",
        "author": "저자",
        "code": "코드",
        "year": "연도",
        "hex": "Hex 색상",
        "size": "크기",
        "width": "너비",
        "offset": "오프셋",
        "model": "모델",
        "trim": "트림",
        "chassis": "차대 번호",
        "reason": "사유"
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
