<script lang="ts" setup>
  /**
   * Review drawer (design S12).
   *
   * The point of the drawer is that a decision is made WITH context, not from a
   * row in a list: the new files, what the change does to the existing entry,
   * who the contributor is and what their record looks like, and what else the
   * decision sets off.
   *
   * Three outcomes, not two. "Ask for changes" exists so a reviewer never has to
   * choose between rejecting someone and letting a flawed entry through — it
   * keeps the submission alive and costs the contributor nothing.
   */
  import type { Database } from '~~/types/database';

  type Submission = Database['public']['Tables']['submission_queue']['Row'] & {
    submitter?: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      trust_level: string | null;
      approved_submissions: number | null;
      rejected_submissions: number | null;
      created_at: string | null;
    } | null;
  };

  const props = defineProps<{ submission: Submission | null }>();
  const emit = defineEmits<{ close: []; reviewed: [] }>();

  const { t } = useI18n();
  const supabase = useSupabase();
  const toast = useToast();

  const busy = ref<'approve' | 'changes' | 'reject' | null>(null);
  const notes = ref('');
  const showNotes = ref(false);
  /** The Most Wanted row this submission would clear, if any. */
  const linkedRequest = ref<{ id: string; title: string; ask_count: number } | null>(null);

  const REJECT_REASONS = ['duplicate', 'poor_quality', 'wrong_details', 'not_relevant', 'copyright'] as const;

  const data = computed<Record<string, any>>(() => (props.submission?.data as Record<string, any>) ?? {});
  const files = computed<{ url: string; category?: string }[]>(() =>
    Array.isArray(data.value.uploadedFiles) ? data.value.uploadedFiles : []
  );
  const isEdit = computed(() => props.submission?.type === 'edit_suggestion');
  const kindLabel = computed(() =>
    props.submission ? t(`kinds.${props.submission.target_type}`, props.submission.target_type) : ''
  );

  const handle = computed(() => {
    const submitter = props.submission?.submitter;
    if (!submitter) return t('unknown_contributor');
    return submitter.username ? `@${submitter.username}` : (submitter.display_name ?? t('unknown_contributor'));
  });

  const memberSince = computed(() => {
    const created = props.submission?.submitter?.created_at;
    return created ? new Date(created).getFullYear() : null;
  });

  /**
   * The side-effect note. Reading the request separately (rather than trusting
   * data.request_id blindly) means the drawer only promises to clear something
   * that is actually still open.
   */
  const loadLinkedRequest = async () => {
    linkedRequest.value = null;
    const requestId = data.value.request_id;
    if (!requestId) return;

    const { data: row } = await supabase
      .from('archive_requests')
      .select('id, title, ask_count, status')
      .eq('id', requestId)
      .eq('status', 'open')
      .maybeSingle();

    if (row) linkedRequest.value = { id: row.id, title: row.title, ask_count: row.ask_count };
  };

  watch(
    () => props.submission?.id,
    (id) => {
      notes.value = '';
      showNotes.value = false;
      if (id) loadLinkedRequest();
    },
    { immediate: true }
  );

  watch(
    () => Boolean(props.submission),
    (open) => {
      if (typeof document !== 'undefined') document.body.style.overflow = open ? 'hidden' : '';
    }
  );

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  });

  const act = async (kind: 'approve' | 'changes' | 'reject', reason?: string) => {
    if (!props.submission || busy.value) return;

    const endpoints = {
      approve: '/api/admin/queue/approve',
      changes: '/api/admin/queue/request-changes',
      reject: '/api/admin/queue/reject',
    } as const;

    const body: Record<string, unknown> = { id: props.submission.id };
    if (kind === 'changes') {
      if (!notes.value.trim()) {
        showNotes.value = true;
        toast.add({ title: t('notes_required'), color: 'warning', icon: 'fas fa-triangle-exclamation' });
        return;
      }
      body.reviewerNotes = notes.value.trim();
    } else if (kind === 'reject') {
      body.reviewerNotes = reason ? t(`reject_reasons.${reason}`) : notes.value.trim() || null;
    } else if (notes.value.trim()) {
      body.reviewerNotes = notes.value.trim();
    }

    busy.value = kind;
    try {
      await $adminFetch(endpoints[kind], { method: 'POST', body });
      toast.add({
        title: t(`toast.${kind}`),
        description: kind === 'approve' ? t('toast.approve_body') : undefined,
        color: kind === 'reject' ? 'warning' : 'success',
        icon: 'fas fa-circle-check',
      });
      emit('reviewed');
      emit('close');
    } catch (error: any) {
      toast.add({
        title: t('toast.failed'),
        description: error?.statusMessage ?? error?.message ?? '',
        color: 'error',
        icon: 'fas fa-circle-exclamation',
      });
    } finally {
      busy.value = null;
    }
  };
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="submission" class="fixed inset-0 z-[85]" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/35" aria-hidden="true" @click="emit('close')"></div>

        <aside class="drawer-panel absolute right-0 top-0 flex h-full w-full flex-col bg-base-100 shadow-2xl sm:w-[520px]">
          <!-- Header -->
          <div class="flex items-start gap-3 border-b border-base-300 px-5 py-4">
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-lg font-bold">{{ data.title || kindLabel }}</h3>
              <p class="mt-0.5 text-[12.5px] opacity-60">
                {{ kindLabel }} &middot;
                {{ isEdit ? t('addition_to_existing') : t('new_entry') }} &middot;
                {{ new Date(submission.created_at).toLocaleDateString() }}
              </p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-square" :aria-label="t('close')" @click="emit('close')">
              <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <!-- New files -->
            <div v-if="files.length" class="grid grid-cols-2 gap-2.5">
              <a
                v-for="file in files"
                :key="file.url"
                :href="file.url"
                target="_blank"
                rel="noopener noreferrer"
                class="relative block aspect-[4/3] overflow-hidden rounded-field bg-base-200"
              >
                <img :src="file.url" alt="" class="h-full w-full object-cover" />
                <span class="absolute bottom-0 left-0 right-0 bg-black/55 px-2 py-1 text-[11px] font-bold text-white">
                  {{ t('new_file') }}
                </span>
              </a>
            </div>

            <!-- Merge context -->
            <div v-if="isEdit && submission.target_id" class="rounded-field bg-base-200 px-3.5 py-3 text-[13.5px]">
              <i class="fas fa-code-merge text-primary" aria-hidden="true"></i>
              {{ files.length ? t('merge_photos', { count: files.length }) : t('merge_changes') }}
              <span v-if="data.target_hint" class="font-semibold">{{ data.target_hint }}</span>
            </div>

            <!-- What the contributor said -->
            <div v-if="data.reason" class="rounded-field border border-base-300 px-3.5 py-3">
              <p class="mb-1 text-[11.5px] font-bold uppercase tracking-[0.08em] opacity-55">{{ t('their_note') }}</p>
              <p class="whitespace-pre-wrap text-sm">{{ data.reason }}</p>
            </div>

            <!-- Structured payload for anything without a bespoke view -->
            <dl v-if="!data.reason" class="overflow-hidden rounded-field border border-base-300 text-sm">
              <div
                v-for="[key, value] in Object.entries(data).filter(
                  ([k, v]) => !['uploadedFiles', 'request_id', 'origin', 'changes'].includes(k) && v !== null && v !== ''
                )"
                :key="key"
                class="flex gap-3 border-b border-base-300 px-3.5 py-2 last:border-b-0"
              >
                <dt class="w-28 shrink-0 text-[12.5px] font-semibold opacity-55">{{ key }}</dt>
                <dd class="min-w-0 flex-1 break-words">{{ value }}</dd>
              </div>
            </dl>

            <!-- Contributor card: the track record is the whole reason this is here -->
            <div class="rounded-box border border-base-300 px-4 py-3.5">
              <p class="mb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] opacity-55">{{ t('contributor') }}</p>
              <div class="flex items-center gap-2.5">
                <span class="review-avatar">
                  <img
                    v-if="submission.submitter?.avatar_url"
                    :src="submission.submitter.avatar_url"
                    alt=""
                    class="h-full w-full object-cover"
                  />
                  <span v-else>{{ handle.replace('@', '').charAt(0).toUpperCase() }}</span>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold">
                    {{ handle }}
                    <span
                      v-if="submission.submitter?.trust_level"
                      class="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-accent"
                    >
                      {{ t(`tiers.${submission.submitter.trust_level}`, submission.submitter.trust_level) }}
                    </span>
                  </p>
                  <p class="mt-0.5 text-[12.5px] opacity-60">
                    {{ t('record', {
                      approved: submission.submitter?.approved_submissions ?? 0,
                      rejected: submission.submitter?.rejected_submissions ?? 0,
                    }) }}
                    <template v-if="memberSince"> &middot; {{ t('member_since', { year: memberSince }) }}</template>
                  </p>
                </div>
                <NuxtLink
                  v-if="submission.submitter?.username"
                  :to="`/users/${submission.submitter.username}`"
                  class="shrink-0 text-[12.5px] font-bold text-primary hover:underline"
                >
                  {{ t('full_record') }} &rarr;
                </NuxtLink>
              </div>
            </div>

            <!-- Side effects of approving -->
            <p v-if="linkedRequest" class="flex items-start gap-2 text-[13px] opacity-80">
              <i class="fas fa-circle-info mt-0.5 text-info" aria-hidden="true"></i>
              {{ t('clears_request', { title: linkedRequest.title, count: linkedRequest.ask_count }) }}
            </p>

            <!-- Reviewer note -->
            <div v-if="showNotes">
              <label class="mb-1 block text-[13px] font-semibold">{{ t('note_label') }}</label>
              <textarea
                v-model="notes"
                rows="3"
                class="textarea textarea-bordered w-full"
                :placeholder="t('note_placeholder')"
              ></textarea>
            </div>
            <button
              v-else
              type="button"
              class="self-start text-[13px] font-semibold text-primary hover:underline"
              @click="showNotes = true"
            >
              {{ t('add_note') }}
            </button>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-2.5 border-t border-base-300 bg-base-200 px-5 py-4">
            <button type="button" class="btn btn-primary" :disabled="!!busy" @click="act('approve')">
              <span v-if="busy === 'approve'" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-check" aria-hidden="true"></i>
              {{ t('approve_and_credit') }}
            </button>
            <button type="button" class="btn btn-outline btn-sm h-[42px]" :disabled="!!busy" @click="act('changes')">
              {{ t('ask_for_changes') }}
            </button>
            <div class="dropdown dropdown-top dropdown-end">
              <div tabindex="0" role="button" class="btn btn-outline btn-error btn-sm h-[42px]">
                {{ t('reject') }} <i class="fas fa-chevron-down text-[10px]" aria-hidden="true"></i>
              </div>
              <ul tabindex="0" class="dropdown-content menu z-10 mb-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
                <li v-for="reason in REJECT_REASONS" :key="reason">
                  <button type="button" @click="act('reject', reason)">{{ t(`reject_reasons.${reason}`) }}</button>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .review-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: none;
    overflow: hidden;
    border-radius: 9999px;
    background: var(--color-primary);
    color: var(--color-primary-content);
    font-size: 13px;
    font-weight: 700;
  }

  .drawer-enter-active,
  .drawer-leave-active {
    transition: opacity 0.2s ease;
  }
  .drawer-enter-active .drawer-panel,
  .drawer-leave-active .drawer-panel {
    transition: transform 0.25s ease;
  }
  .drawer-enter-from,
  .drawer-leave-to {
    opacity: 0;
  }
  .drawer-enter-from .drawer-panel,
  .drawer-leave-to .drawer-panel {
    transform: translateX(100%);
  }
</style>

<i18n lang="json">
{
  "en": {
    "close": "Close",
    "new_entry": "new entry",
    "addition_to_existing": "addition to existing entry",
    "new_file": "NEW",
    "merge_photos": "Adds {count} photo(s) to ",
    "merge_changes": "Applies changes to ",
    "their_note": "What they said",
    "contributor": "Contributor",
    "unknown_contributor": "Unknown",
    "record": "{approved} approved · {rejected} rejected",
    "member_since": "member since {year}",
    "full_record": "Full record",
    "clears_request": "This also clears \"{title}\" from Most Wanted ({count} asks).",
    "add_note": "+ Add a note for the contributor",
    "note_label": "Note to the contributor",
    "note_placeholder": "What should they change, or why is this being rejected?",
    "notes_required": "Add a note — that note is what they act on",
    "approve_and_credit": "Approve & credit",
    "ask_for_changes": "Ask for changes",
    "reject": "Reject",
    "kinds": {
      "document": "Document",
      "registry": "Registry entry",
      "wheel": "Wheel",
      "color": "Colour",
      "collection": "Collection"
    },
    "tiers": {
      "new": "New",
      "contributor": "Contributor",
      "trusted": "Top Wrench",
      "moderator": "Moderator",
      "admin": "Admin"
    },
    "reject_reasons": {
      "duplicate": "Already in the archive",
      "poor_quality": "Images or scan too low quality",
      "wrong_details": "Details do not check out",
      "not_relevant": "Not a Classic Mini item",
      "copyright": "Copyright concern"
    },
    "toast": {
      "approve": "Approved & credited",
      "approve_body": "The contributor's stats, badges and leaderboard place are updated.",
      "changes": "Changes requested",
      "reject": "Rejected",
      "failed": "That did not go through"
    }
  },
  "es": {
    "close": "Cerrar",
    "new_entry": "entrada nueva",
    "addition_to_existing": "añadido a una entrada existente",
    "new_file": "NUEVO",
    "merge_photos": "Añade {count} foto(s) a ",
    "merge_changes": "Aplica cambios a ",
    "their_note": "Lo que dijeron",
    "contributor": "Contribuyente",
    "unknown_contributor": "Desconocido",
    "record": "{approved} aprobados · {rejected} rechazados",
    "member_since": "miembro desde {year}",
    "full_record": "Historial completo",
    "clears_request": "Esto también quita \"{title}\" de Más buscados ({count} peticiones).",
    "add_note": "+ Añadir una nota para el contribuyente",
    "note_label": "Nota para el contribuyente",
    "note_placeholder": "¿Qué debe cambiar, o por qué se rechaza?",
    "notes_required": "Añade una nota — es lo que verán para actuar",
    "approve_and_credit": "Aprobar y acreditar",
    "ask_for_changes": "Pedir cambios",
    "reject": "Rechazar",
    "kinds": { "document": "Documento", "registry": "Entrada del registro", "wheel": "Rueda", "color": "Color", "collection": "Colección" },
    "tiers": { "new": "Nuevo", "contributor": "Contribuyente", "trusted": "Llave de Oro", "moderator": "Moderador", "admin": "Admin" },
    "reject_reasons": {
      "duplicate": "Ya está en el archivo",
      "poor_quality": "Imágenes o escaneo de baja calidad",
      "wrong_details": "Los datos no cuadran",
      "not_relevant": "No es un elemento de Classic Mini",
      "copyright": "Problema de derechos de autor"
    },
    "toast": {
      "approve": "Aprobado y acreditado",
      "approve_body": "Se actualizan sus estadísticas, insignias y puesto en la tabla.",
      "changes": "Cambios solicitados",
      "reject": "Rechazado",
      "failed": "No se pudo completar"
    }
  },
  "fr": {
    "close": "Fermer",
    "new_entry": "nouvelle entrée",
    "addition_to_existing": "ajout à une entrée existante",
    "new_file": "NOUVEAU",
    "merge_photos": "Ajoute {count} photo(s) à ",
    "merge_changes": "Applique des modifications à ",
    "their_note": "Ce qu'ils ont écrit",
    "contributor": "Contributeur",
    "unknown_contributor": "Inconnu",
    "record": "{approved} acceptées · {rejected} refusées",
    "member_since": "membre depuis {year}",
    "full_record": "Dossier complet",
    "clears_request": "Cela retire aussi « {title} » des Plus demandés ({count} demandes).",
    "add_note": "+ Ajouter une note pour le contributeur",
    "note_label": "Note au contributeur",
    "note_placeholder": "Que faut-il changer, ou pourquoi ce refus ?",
    "notes_required": "Ajoutez une note — c'est ce sur quoi ils agiront",
    "approve_and_credit": "Approuver et créditer",
    "ask_for_changes": "Demander des modifications",
    "reject": "Refuser",
    "kinds": { "document": "Document", "registry": "Entrée de registre", "wheel": "Jante", "color": "Couleur", "collection": "Collection" },
    "tiers": { "new": "Nouveau", "contributor": "Contributeur", "trusted": "Clé d'Or", "moderator": "Modérateur", "admin": "Admin" },
    "reject_reasons": {
      "duplicate": "Déjà dans les archives",
      "poor_quality": "Images ou scan de qualité insuffisante",
      "wrong_details": "Les informations ne concordent pas",
      "not_relevant": "Sans rapport avec la Classic Mini",
      "copyright": "Problème de droits d'auteur"
    },
    "toast": {
      "approve": "Approuvé et crédité",
      "approve_body": "Ses statistiques, badges et place au classement sont mis à jour.",
      "changes": "Modifications demandées",
      "reject": "Refusé",
      "failed": "L'opération a échoué"
    }
  },
  "de": {
    "close": "Schließen",
    "new_entry": "neuer Eintrag",
    "addition_to_existing": "Ergänzung eines bestehenden Eintrags",
    "new_file": "NEU",
    "merge_photos": "Fügt {count} Foto(s) hinzu zu ",
    "merge_changes": "Wendet Änderungen an auf ",
    "their_note": "Was geschrieben wurde",
    "contributor": "Beitragende Person",
    "unknown_contributor": "Unbekannt",
    "record": "{approved} angenommen · {rejected} abgelehnt",
    "member_since": "Mitglied seit {year}",
    "full_record": "Vollständige Historie",
    "clears_request": "Damit verschwindet auch „{title}“ aus Meistgesucht ({count} Anfragen).",
    "add_note": "+ Notiz für die beitragende Person",
    "note_label": "Notiz an die beitragende Person",
    "note_placeholder": "Was soll geändert werden, oder warum wird abgelehnt?",
    "notes_required": "Notiz ergänzen — daran orientieren sie sich",
    "approve_and_credit": "Annehmen & gutschreiben",
    "ask_for_changes": "Änderungen erbitten",
    "reject": "Ablehnen",
    "kinds": { "document": "Dokument", "registry": "Registereintrag", "wheel": "Rad", "color": "Farbe", "collection": "Sammlung" },
    "tiers": { "new": "Neu", "contributor": "Beitragend", "trusted": "Meisterschrauber", "moderator": "Moderator", "admin": "Admin" },
    "reject_reasons": {
      "duplicate": "Schon im Archiv",
      "poor_quality": "Bilder oder Scan zu schlecht",
      "wrong_details": "Angaben stimmen nicht",
      "not_relevant": "Kein Classic-Mini-Thema",
      "copyright": "Urheberrechtliche Bedenken"
    },
    "toast": {
      "approve": "Angenommen & gutgeschrieben",
      "approve_body": "Statistiken, Abzeichen und Platzierung werden aktualisiert.",
      "changes": "Änderungen erbeten",
      "reject": "Abgelehnt",
      "failed": "Das hat nicht geklappt"
    }
  },
  "it": {
    "close": "Chiudi",
    "new_entry": "nuova voce",
    "addition_to_existing": "aggiunta a una voce esistente",
    "new_file": "NUOVO",
    "merge_photos": "Aggiunge {count} foto a ",
    "merge_changes": "Applica modifiche a ",
    "their_note": "Cosa hanno scritto",
    "contributor": "Contributore",
    "unknown_contributor": "Sconosciuto",
    "record": "{approved} approvate · {rejected} respinte",
    "member_since": "membro dal {year}",
    "full_record": "Storico completo",
    "clears_request": "Questo rimuove anche \"{title}\" dai Più richiesti ({count} richieste).",
    "add_note": "+ Aggiungi una nota per il contributore",
    "note_label": "Nota per il contributore",
    "note_placeholder": "Cosa va cambiato, o perché viene respinta?",
    "notes_required": "Aggiungi una nota — è ciò su cui agiranno",
    "approve_and_credit": "Approva e accredita",
    "ask_for_changes": "Chiedi modifiche",
    "reject": "Respingi",
    "kinds": { "document": "Documento", "registry": "Voce del registro", "wheel": "Cerchio", "color": "Colore", "collection": "Collezione" },
    "tiers": { "new": "Nuovo", "contributor": "Contributore", "trusted": "Chiave d'Oro", "moderator": "Moderatore", "admin": "Admin" },
    "reject_reasons": {
      "duplicate": "Già presente nell'archivio",
      "poor_quality": "Immagini o scansione di bassa qualità",
      "wrong_details": "I dati non tornano",
      "not_relevant": "Non riguarda la Classic Mini",
      "copyright": "Problema di copyright"
    },
    "toast": {
      "approve": "Approvato e accreditato",
      "approve_body": "Statistiche, badge e posizione in classifica aggiornati.",
      "changes": "Modifiche richieste",
      "reject": "Respinto",
      "failed": "Operazione non riuscita"
    }
  },
  "pt": {
    "close": "Fechar",
    "new_entry": "entrada nova",
    "addition_to_existing": "adição a uma entrada existente",
    "new_file": "NOVO",
    "merge_photos": "Adiciona {count} foto(s) a ",
    "merge_changes": "Aplica alterações a ",
    "their_note": "O que escreveram",
    "contributor": "Contribuidor",
    "unknown_contributor": "Desconhecido",
    "record": "{approved} aprovadas · {rejected} recusadas",
    "member_since": "membro desde {year}",
    "full_record": "Histórico completo",
    "clears_request": "Isto também retira \"{title}\" dos Mais procurados ({count} pedidos).",
    "add_note": "+ Adicionar uma nota para o contribuidor",
    "note_label": "Nota para o contribuidor",
    "note_placeholder": "O que deve mudar, ou porque é recusada?",
    "notes_required": "Adicione uma nota — é sobre ela que vão agir",
    "approve_and_credit": "Aprovar e creditar",
    "ask_for_changes": "Pedir alterações",
    "reject": "Recusar",
    "kinds": { "document": "Documento", "registry": "Entrada de registo", "wheel": "Jante", "color": "Cor", "collection": "Coleção" },
    "tiers": { "new": "Novo", "contributor": "Contribuidor", "trusted": "Chave de Ouro", "moderator": "Moderador", "admin": "Admin" },
    "reject_reasons": {
      "duplicate": "Já está no arquivo",
      "poor_quality": "Imagens ou digitalização de baixa qualidade",
      "wrong_details": "Os dados não batem certo",
      "not_relevant": "Não é um item Classic Mini",
      "copyright": "Questão de direitos de autor"
    },
    "toast": {
      "approve": "Aprovado e creditado",
      "approve_body": "Estatísticas, distintivos e posição na tabela atualizados.",
      "changes": "Alterações pedidas",
      "reject": "Recusado",
      "failed": "Não foi possível concluir"
    }
  },
  "ru": {
    "close": "Закрыть",
    "new_entry": "новая запись",
    "addition_to_existing": "дополнение существующей записи",
    "new_file": "НОВОЕ",
    "merge_photos": "Добавляет фото ({count}) к ",
    "merge_changes": "Применяет правки к ",
    "their_note": "Комментарий автора",
    "contributor": "Автор",
    "unknown_contributor": "Неизвестно",
    "record": "принято: {approved} · отклонено: {rejected}",
    "member_since": "с нами с {year}",
    "full_record": "Вся история",
    "clears_request": "Это также уберёт «{title}» из «Самого востребованного» (запросов: {count}).",
    "add_note": "+ Добавить комментарий автору",
    "note_label": "Комментарий автору",
    "note_placeholder": "Что нужно изменить или почему отклонено?",
    "notes_required": "Добавьте комментарий — именно по нему автор будет действовать",
    "approve_and_credit": "Принять и зачесть",
    "ask_for_changes": "Запросить правки",
    "reject": "Отклонить",
    "kinds": { "document": "Документ", "registry": "Запись реестра", "wheel": "Диск", "color": "Цвет", "collection": "Коллекция" },
    "tiers": { "new": "Новичок", "contributor": "Участник", "trusted": "Мастер", "moderator": "Модератор", "admin": "Админ" },
    "reject_reasons": {
      "duplicate": "Уже есть в архиве",
      "poor_quality": "Слишком низкое качество изображений",
      "wrong_details": "Данные не сходятся",
      "not_relevant": "Не относится к Classic Mini",
      "copyright": "Вопрос по авторским правам"
    },
    "toast": {
      "approve": "Принято и зачтено",
      "approve_body": "Статистика, значки и место в рейтинге обновлены.",
      "changes": "Запрошены правки",
      "reject": "Отклонено",
      "failed": "Не удалось выполнить"
    }
  },
  "ja": {
    "close": "閉じる",
    "new_entry": "新規エントリー",
    "addition_to_existing": "既存エントリーへの追加",
    "new_file": "新規",
    "merge_photos": "{count} 枚の写真を追加します: ",
    "merge_changes": "変更を適用します: ",
    "their_note": "投稿者のコメント",
    "contributor": "貢献者",
    "unknown_contributor": "不明",
    "record": "承認 {approved} 件 · 却下 {rejected} 件",
    "member_since": "{year} 年から参加",
    "full_record": "全履歴",
    "clears_request": "これにより「{title}」も「リクエストの多い項目」から外れます（{count} 件のリクエスト）。",
    "add_note": "+ 投稿者へのメモを追加",
    "note_label": "投稿者へのメモ",
    "note_placeholder": "どこを直すべきか、または却下の理由は？",
    "notes_required": "メモを入力してください — 投稿者はこれを見て対応します",
    "approve_and_credit": "承認してクレジット",
    "ask_for_changes": "修正を依頼",
    "reject": "却下",
    "kinds": { "document": "資料", "registry": "レジストリ登録", "wheel": "ホイール", "color": "カラー", "collection": "コレクション" },
    "tiers": { "new": "新規", "contributor": "貢献者", "trusted": "熟練メカ", "moderator": "モデレーター", "admin": "管理者" },
    "reject_reasons": {
      "duplicate": "すでにアーカイブにあります",
      "poor_quality": "画像またはスキャンの品質が低い",
      "wrong_details": "内容が確認できません",
      "not_relevant": "クラシックミニに関係しません",
      "copyright": "著作権上の懸念"
    },
    "toast": {
      "approve": "承認してクレジットしました",
      "approve_body": "統計・バッジ・ランキングが更新されます。",
      "changes": "修正を依頼しました",
      "reject": "却下しました",
      "failed": "処理できませんでした"
    }
  },
  "zh": {
    "close": "关闭",
    "new_entry": "新条目",
    "addition_to_existing": "对现有条目的补充",
    "new_file": "新增",
    "merge_photos": "为其添加 {count} 张照片：",
    "merge_changes": "对其应用更改：",
    "their_note": "投稿者说明",
    "contributor": "贡献者",
    "unknown_contributor": "未知",
    "record": "通过 {approved} · 驳回 {rejected}",
    "member_since": "{year} 年加入",
    "full_record": "完整记录",
    "clears_request": "这同时会把“{title}”从最想要中移除（{count} 次请求）。",
    "add_note": "+ 给贡献者添加备注",
    "note_label": "给贡献者的备注",
    "note_placeholder": "需要改什么，或者为什么驳回？",
    "notes_required": "请填写备注 — 贡献者要照着它修改",
    "approve_and_credit": "通过并记功",
    "ask_for_changes": "要求修改",
    "reject": "驳回",
    "kinds": { "document": "文档", "registry": "注册条目", "wheel": "轮毂", "color": "颜色", "collection": "合集" },
    "tiers": { "new": "新人", "contributor": "贡献者", "trusted": "老师傅", "moderator": "版主", "admin": "管理员" },
    "reject_reasons": {
      "duplicate": "档案馆里已经有了",
      "poor_quality": "图片或扫描质量太低",
      "wrong_details": "信息对不上",
      "not_relevant": "与经典迷你无关",
      "copyright": "版权问题"
    },
    "toast": {
      "approve": "已通过并记功",
      "approve_body": "贡献者的统计、徽章和排名已更新。",
      "changes": "已要求修改",
      "reject": "已驳回",
      "failed": "操作未成功"
    }
  },
  "ko": {
    "close": "닫기",
    "new_entry": "새 항목",
    "addition_to_existing": "기존 항목에 추가",
    "new_file": "신규",
    "merge_photos": "사진 {count}장을 추가합니다: ",
    "merge_changes": "변경 사항을 적용합니다: ",
    "their_note": "기여자 설명",
    "contributor": "기여자",
    "unknown_contributor": "알 수 없음",
    "record": "승인 {approved} · 반려 {rejected}",
    "member_since": "{year}년부터 활동",
    "full_record": "전체 기록",
    "clears_request": "이렇게 하면 \"{title}\"도 가장 많이 요청됨에서 사라집니다({count}건 요청).",
    "add_note": "+ 기여자에게 메모 남기기",
    "note_label": "기여자에게 남길 메모",
    "note_placeholder": "무엇을 고쳐야 하는지, 또는 반려 사유는?",
    "notes_required": "메모를 입력하세요 — 기여자가 보고 대응합니다",
    "approve_and_credit": "승인 및 기여 반영",
    "ask_for_changes": "수정 요청",
    "reject": "반려",
    "kinds": { "document": "문서", "registry": "레지스트리 항목", "wheel": "휠", "color": "색상", "collection": "컬렉션" },
    "tiers": { "new": "신규", "contributor": "기여자", "trusted": "베테랑", "moderator": "모더레이터", "admin": "관리자" },
    "reject_reasons": {
      "duplicate": "이미 아카이브에 있음",
      "poor_quality": "이미지 또는 스캔 품질이 낮음",
      "wrong_details": "내용이 확인되지 않음",
      "not_relevant": "클래식 미니와 무관",
      "copyright": "저작권 문제"
    },
    "toast": {
      "approve": "승인하고 기여를 반영했습니다",
      "approve_body": "기여자의 통계, 배지, 순위가 업데이트됩니다.",
      "changes": "수정을 요청했습니다",
      "reject": "반려했습니다",
      "failed": "처리하지 못했습니다"
    }
  }
}
</i18n>
