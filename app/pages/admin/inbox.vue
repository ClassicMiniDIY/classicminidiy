<script lang="ts" setup>
  /**
   * Unified admin inbox (design S11).
   *
   * One queue for every submission type instead of a separate review screen per
   * kind. Admin is a surface of the site, not a separate world — same shell,
   * same account, plus an ADMIN chip.
   *
   * Sorted OLDEST FIRST by default, deliberately: the person who has been
   * waiting longest gets served first, which is the opposite of what a
   * newest-first feed does to a backlog.
   */
  import type { Database } from '~~/types/database';

  // Access is enforced by app/middleware/admin.global.ts for every /admin/** route.

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

  const { t } = useI18n();
  const supabase = useSupabase();
  const toast = useToast();

  useHead({
    title: 'Inbox - Admin - Classic Mini DIY',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  });

  const items = ref<Submission[]>([]);
  const loading = ref(true);
  const filter = ref<'all' | 'doc' | 'wheel' | 'registry' | 'color' | 'fix'>('all');
  const selected = ref<Set<string>>(new Set());
  const openItem = ref<Submission | null>(null);
  const bulkBusy = ref(false);

  const RAIL = [
    { key: 'inbox', label: 'inbox', icon: 'fas fa-inbox', to: '/admin/inbox' },
    { key: 'users', label: 'users', icon: 'fas fa-user', to: '/admin/users' },
    { key: 'archive', label: 'archive', icon: 'fas fa-book', to: '/admin/queue' },
    { key: 'exchange', label: 'exchange', icon: 'fas fa-shop', to: '/admin/exchange' },
    { key: 'models', label: 'models', icon: 'fas fa-cube', to: '/admin/models' },
    { key: 'settings', label: 'settings', icon: 'fas fa-gear', to: '/admin' },
  ] as const;

  /** Maps a submission onto the design's filter vocabulary. */
  const kindOf = (item: Submission): string => {
    if (item.type === 'edit_suggestion') return 'fix';
    if (item.target_type === 'wheel') return 'wheel';
    if (item.target_type === 'registry') return 'registry';
    if (item.target_type === 'color') return 'color';
    return 'doc';
  };

  const load = async () => {
    loading.value = true;
    try {
      const { data, error } = await supabase
        .from('submission_queue')
        .select(
          '*, submitter:public_profiles!submission_queue_submitted_by_fkey(username, display_name, avatar_url, trust_level, approved_submissions, rejected_submissions, created_at)'
        )
        .eq('status', 'pending')
        // Oldest first — the longest-waiting contributor is served first.
        .order('created_at', { ascending: true });

      if (error) throw error;
      items.value = (data ?? []) as unknown as Submission[];
      selected.value = new Set();
    } catch (error) {
      console.error('Failed to load admin inbox:', error);
      items.value = [];
    } finally {
      loading.value = false;
    }
  };

  const counts = computed(() =>
    items.value.reduce<Record<string, number>>((acc, item) => {
      const kind = kindOf(item);
      acc[kind] = (acc[kind] ?? 0) + 1;
      return acc;
    }, {})
  );

  const filters = computed(() => [
    { key: 'all' as const, label: t('filters.all'), count: items.value.length },
    ...(['doc', 'wheel', 'registry', 'color', 'fix'] as const)
      .filter((kind) => (counts.value[kind] ?? 0) > 0)
      .map((kind) => ({ key: kind, label: t(`filters.${kind}`), count: counts.value[kind] ?? 0 })),
  ]);

  const visible = computed(() =>
    filter.value === 'all' ? items.value : items.value.filter((item) => kindOf(item) === filter.value)
  );

  const toggle = (id: string) => {
    const next = new Set(selected.value);
    next.has(id) ? next.delete(id) : next.add(id);
    selected.value = next;
  };

  const titleOf = (item: Submission) =>
    (item.data as Record<string, any>)?.title || t(`filters.${kindOf(item)}`);

  const handleOf = (item: Submission) =>
    item.submitter?.username ? `@${item.submitter.username}` : (item.submitter?.display_name ?? t('unknown'));

  /**
   * Trusted contributors are suggested for auto-approval rather than
   * auto-approved. A reviewer stays in the loop — the queue is the only place a
   * bad entry gets caught, and "trusted" is earned from counts, not intent.
   */
  const trustedSelection = computed(() =>
    [...selected.value]
      .map((id) => items.value.find((item) => item.id === id))
      .filter((item): item is Submission => Boolean(item))
      .every((item) => item.submitter?.trust_level === 'trusted' || item.submitter?.trust_level === 'moderator')
  );

  const bulk = async (action: 'approve' | 'reject') => {
    if (selected.value.size === 0 || bulkBusy.value) return;
    bulkBusy.value = true;
    const ids = [...selected.value];
    let failed = 0;

    // Sequential, not Promise.all: each approval writes an archive row and fires
    // the credit/badge/Most-Wanted trigger, and a burst of those against the same
    // profile row is a needless lock contention risk for no wall-clock gain at
    // queue-sized batches.
    for (const id of ids) {
      try {
        await $adminFetch(`/api/admin/queue/${action}`, { method: 'POST', body: { id } });
      } catch {
        failed += 1;
      }
    }

    toast.add({
      title: failed === 0 ? t(`bulk.${action}_done`, { count: ids.length }) : t('bulk.partial', { failed }),
      color: failed === 0 ? 'success' : 'warning',
      icon: failed === 0 ? 'fas fa-circle-check' : 'fas fa-triangle-exclamation',
    });

    bulkBusy.value = false;
    await load();
  };

  const relativeAge = (iso: string) => {
    const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (hours < 24) return t('age.hours', { count: Math.max(1, hours) });
    return t('age.days', { count: Math.round(hours / 24) });
  };

  onMounted(load);
</script>

<template>
  <div class="min-h-[70vh]">
    <!-- ADMIN chip: same shell, flagged as a privileged surface. -->
    <div class="flex items-center gap-3 border-b border-base-300 px-4 py-3 lg:px-6">
      <span class="rounded bg-neutral px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-content">
        {{ t('admin') }}
      </span>
      <h1 class="text-lg font-bold">{{ t('heading') }}</h1>
    </div>

    <div class="flex flex-col lg:flex-row">
      <!-- Left rail; scrollable chip tabs on mobile (design M12) -->
      <nav
        class="flex shrink-0 gap-1 overflow-x-auto border-b border-base-300 bg-base-200 p-2.5 lg:w-[210px] lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-4"
      >
        <NuxtLink
          v-for="entry in RAIL"
          :key="entry.key"
          :to="entry.to"
          class="rail-link"
          :class="{ 'is-current': entry.key === 'inbox' }"
        >
          <i :class="[entry.icon, 'w-4']" aria-hidden="true"></i>
          {{ t(`rail.${entry.label}`) }}
          <span v-if="entry.key === 'inbox' && items.length" class="rail-count">{{ items.length }}</span>
        </NuxtLink>
      </nav>

      <div class="min-w-0 flex-1 px-4 py-5 lg:px-6">
        <!-- Type filters + sort -->
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <button
            v-for="entry in filters"
            :key="entry.key"
            type="button"
            class="type-pill"
            :class="{ 'is-active': filter === entry.key }"
            @click="filter = entry.key as any"
          >
            {{ entry.label }} {{ entry.count }}
          </button>
          <div class="flex-1"></div>
          <span class="text-[12.5px] opacity-55">{{ t('oldest_first') }}</span>
        </div>

        <div v-if="loading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg opacity-50"></span>
        </div>

        <div v-else-if="visible.length" class="overflow-hidden rounded-box border border-base-300 shadow-sm">
          <div
            v-for="item in visible"
            :key="item.id"
            class="queue-row"
            :class="{ 'is-selected': selected.has(item.id) }"
          >
            <button
              type="button"
              class="shrink-0 p-1"
              :aria-label="t('select')"
              @click.stop="toggle(item.id)"
            >
              <i
                :class="selected.has(item.id) ? 'fa-regular fa-square-check text-primary' : 'fa-regular fa-square opacity-50'"
                class="text-base"
                aria-hidden="true"
              ></i>
            </button>
            <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="openItem = item">
              <span class="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                {{ titleOf(item) }}
                <span class="kind-chip" :class="{ 'is-fix': kindOf(item) === 'fix' }">
                  {{ t(`chips.${kindOf(item)}`) }}
                </span>
              </span>
              <span class="hidden shrink-0 text-[12.5px] opacity-55 sm:inline">
                {{ handleOf(item) }}
                <template v-if="item.submitter?.trust_level === 'trusted'"> &middot; {{ t('top_wrench') }}</template>
              </span>
              <span class="shrink-0 text-[12.5px] opacity-55">{{ relativeAge(item.created_at) }}</span>
            </button>
          </div>
        </div>

        <div v-else class="rounded-box border border-base-300 bg-base-200 px-6 py-16 text-center">
          <i class="fas fa-inbox mb-3 block text-3xl opacity-30" aria-hidden="true"></i>
          <p class="text-lg font-bold">{{ t('empty_title') }}</p>
          <p class="mt-1 text-sm opacity-70">{{ t('empty_body') }}</p>
        </div>

        <!-- Bulk bar; sticky at the bottom on mobile (design M12) -->
        <div
          v-if="selected.size > 0"
          class="sticky bottom-0 z-10 mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-base-300 bg-base-100 py-3 lg:static lg:border-t-0"
        >
          <button type="button" class="btn btn-primary btn-sm h-[38px]" :disabled="bulkBusy" @click="bulk('approve')">
            <span v-if="bulkBusy" class="loading loading-spinner loading-xs"></span>
            <i v-else class="fas fa-check" aria-hidden="true"></i>
            {{ t('bulk.approve', { count: selected.size }) }}
          </button>
          <button type="button" class="btn btn-outline btn-sm h-[38px]" :disabled="bulkBusy" @click="bulk('reject')">
            {{ t('bulk.reject') }}
          </button>
          <span class="text-[12.5px] opacity-55">
            {{ t('bulk.selected', { count: selected.size }) }}
            <template v-if="trustedSelection"> &middot; {{ t('bulk.trusted_hint') }}</template>
          </span>
        </div>
      </div>
    </div>

    <AdminReviewDrawer :submission="openItem" @close="openItem = null" @reviewed="load()" />
  </div>
</template>

<style scoped>
  .rail-link {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex: none;
    padding: 0.5625rem 0.75rem;
    border-radius: var(--radius-field, 0.5rem);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--color-base-content);
    text-decoration: none;
  }
  .rail-link:hover {
    background: color-mix(in srgb, var(--color-base-content) 6%, transparent);
  }
  .rail-link.is-current {
    background: var(--color-primary);
    color: var(--color-primary-content);
    font-weight: 700;
  }
  .rail-count {
    margin-left: auto;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.25);
    padding: 0.0625rem 0.5rem;
    font-size: 12px;
  }

  .type-pill {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 0.8125rem;
    border: 1px solid var(--color-base-300);
    border-radius: 9999px;
    font-size: 12.5px;
    font-weight: 600;
    color: color-mix(in srgb, var(--color-base-content) 75%, transparent);
    cursor: pointer;
  }
  .type-pill.is-active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-content);
    font-weight: 700;
  }

  .queue-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.8125rem 1rem;
    border-bottom: 1px solid var(--color-base-300);
  }
  .queue-row:last-child {
    border-bottom: 0;
  }
  .queue-row.is-selected {
    background: color-mix(in srgb, var(--color-primary) 7%, transparent);
  }

  .kind-chip {
    display: inline-block;
    margin-left: 0.375rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    padding: 0.125rem 0.5625rem;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-accent);
  }
  .kind-chip.is-fix {
    background: color-mix(in srgb, var(--color-secondary) 15%, transparent);
    color: var(--color-secondary);
  }
</style>

<i18n lang="json">
{
  "en": {
    "admin": "Admin",
    "heading": "Inbox",
    "oldest_first": "Oldest first",
    "select": "Select",
    "unknown": "Unknown",
    "top_wrench": "Top Wrench",
    "empty_title": "Queue is clear",
    "empty_body": "Nothing is waiting on a review right now.",
    "rail": {
      "inbox": "Inbox",
      "users": "Users",
      "archive": "Archive",
      "exchange": "Exchange",
      "models": "Models",
      "settings": "Settings"
    },
    "filters": { "all": "All", "doc": "Docs", "wheel": "Wheels", "registry": "Registry", "color": "Colours", "fix": "Fixes" },
    "chips": { "doc": "Doc", "wheel": "Wheel", "registry": "Registry", "color": "Colour", "fix": "Fix" },
    "age": { "hours": "{count}h", "days": "{count}d" },
    "bulk": {
      "approve": "Approve ({count})",
      "reject": "Reject…",
      "selected": "{count} selected",
      "trusted_hint": "suggestion: auto-approve (trusted contributor)",
      "approve_done": "Approved {count}",
      "reject_done": "Rejected {count}",
      "partial": "{failed} could not be processed"
    }
  },
  "es": {
    "admin": "Admin",
    "heading": "Bandeja",
    "oldest_first": "Más antiguos primero",
    "select": "Seleccionar",
    "unknown": "Desconocido",
    "top_wrench": "Llave de Oro",
    "empty_title": "La cola está vacía",
    "empty_body": "Ahora mismo no hay nada esperando revisión.",
    "rail": { "inbox": "Bandeja", "users": "Usuarios", "archive": "Archivo", "exchange": "Mercado", "models": "Modelos", "settings": "Ajustes" },
    "filters": { "all": "Todo", "doc": "Docs", "wheel": "Ruedas", "registry": "Registro", "color": "Colores", "fix": "Correcciones" },
    "chips": { "doc": "Doc", "wheel": "Rueda", "registry": "Registro", "color": "Color", "fix": "Corrección" },
    "age": { "hours": "{count} h", "days": "{count} d" },
    "bulk": {
      "approve": "Aprobar ({count})",
      "reject": "Rechazar…",
      "selected": "{count} seleccionados",
      "trusted_hint": "sugerencia: auto-aprobar (contribuyente de confianza)",
      "approve_done": "Aprobados: {count}",
      "reject_done": "Rechazados: {count}",
      "partial": "{failed} no se pudieron procesar"
    }
  },
  "fr": {
    "admin": "Admin",
    "heading": "Boîte de réception",
    "oldest_first": "Plus anciens d'abord",
    "select": "Sélectionner",
    "unknown": "Inconnu",
    "top_wrench": "Clé d'Or",
    "empty_title": "La file est vide",
    "empty_body": "Rien n'attend de relecture pour le moment.",
    "rail": { "inbox": "Boîte", "users": "Utilisateurs", "archive": "Archive", "exchange": "Marché", "models": "Modèles", "settings": "Réglages" },
    "filters": { "all": "Tout", "doc": "Docs", "wheel": "Jantes", "registry": "Registre", "color": "Couleurs", "fix": "Corrections" },
    "chips": { "doc": "Doc", "wheel": "Jante", "registry": "Registre", "color": "Couleur", "fix": "Correction" },
    "age": { "hours": "{count} h", "days": "{count} j" },
    "bulk": {
      "approve": "Approuver ({count})",
      "reject": "Refuser…",
      "selected": "{count} sélectionnés",
      "trusted_hint": "suggestion : approbation auto (contributeur de confiance)",
      "approve_done": "{count} approuvés",
      "reject_done": "{count} refusés",
      "partial": "{failed} n'ont pas pu être traités"
    }
  },
  "de": {
    "admin": "Admin",
    "heading": "Eingang",
    "oldest_first": "Älteste zuerst",
    "select": "Auswählen",
    "unknown": "Unbekannt",
    "top_wrench": "Meisterschrauber",
    "empty_title": "Die Liste ist leer",
    "empty_body": "Gerade wartet nichts auf eine Prüfung.",
    "rail": { "inbox": "Eingang", "users": "Nutzer", "archive": "Archiv", "exchange": "Marktplatz", "models": "Modelle", "settings": "Einstellungen" },
    "filters": { "all": "Alle", "doc": "Doks", "wheel": "Räder", "registry": "Register", "color": "Farben", "fix": "Korrekturen" },
    "chips": { "doc": "Dok", "wheel": "Rad", "registry": "Register", "color": "Farbe", "fix": "Korrektur" },
    "age": { "hours": "{count} Std", "days": "{count} T" },
    "bulk": {
      "approve": "Annehmen ({count})",
      "reject": "Ablehnen…",
      "selected": "{count} ausgewählt",
      "trusted_hint": "Vorschlag: automatisch annehmen (vertrauenswürdig)",
      "approve_done": "{count} angenommen",
      "reject_done": "{count} abgelehnt",
      "partial": "{failed} konnten nicht verarbeitet werden"
    }
  },
  "it": {
    "admin": "Admin",
    "heading": "Posta in arrivo",
    "oldest_first": "Prima i più vecchi",
    "select": "Seleziona",
    "unknown": "Sconosciuto",
    "top_wrench": "Chiave d'Oro",
    "empty_title": "La coda è vuota",
    "empty_body": "Al momento non c'è nulla in attesa di revisione.",
    "rail": { "inbox": "Posta", "users": "Utenti", "archive": "Archivio", "exchange": "Mercato", "models": "Modelli", "settings": "Impostazioni" },
    "filters": { "all": "Tutti", "doc": "Doc", "wheel": "Cerchi", "registry": "Registro", "color": "Colori", "fix": "Correzioni" },
    "chips": { "doc": "Doc", "wheel": "Cerchio", "registry": "Registro", "color": "Colore", "fix": "Correzione" },
    "age": { "hours": "{count} h", "days": "{count} g" },
    "bulk": {
      "approve": "Approva ({count})",
      "reject": "Respingi…",
      "selected": "{count} selezionati",
      "trusted_hint": "suggerimento: auto-approva (contributore fidato)",
      "approve_done": "{count} approvati",
      "reject_done": "{count} respinti",
      "partial": "{failed} non sono stati elaborati"
    }
  },
  "pt": {
    "admin": "Admin",
    "heading": "Caixa de entrada",
    "oldest_first": "Mais antigos primeiro",
    "select": "Selecionar",
    "unknown": "Desconhecido",
    "top_wrench": "Chave de Ouro",
    "empty_title": "A fila está vazia",
    "empty_body": "Neste momento não há nada à espera de revisão.",
    "rail": { "inbox": "Caixa", "users": "Utilizadores", "archive": "Arquivo", "exchange": "Mercado", "models": "Modelos", "settings": "Definições" },
    "filters": { "all": "Tudo", "doc": "Docs", "wheel": "Jantes", "registry": "Registo", "color": "Cores", "fix": "Correções" },
    "chips": { "doc": "Doc", "wheel": "Jante", "registry": "Registo", "color": "Cor", "fix": "Correção" },
    "age": { "hours": "{count} h", "days": "{count} d" },
    "bulk": {
      "approve": "Aprovar ({count})",
      "reject": "Recusar…",
      "selected": "{count} selecionados",
      "trusted_hint": "sugestão: aprovar automaticamente (contribuidor de confiança)",
      "approve_done": "{count} aprovados",
      "reject_done": "{count} recusados",
      "partial": "{failed} não puderam ser processados"
    }
  },
  "ru": {
    "admin": "Админ",
    "heading": "Входящие",
    "oldest_first": "Сначала старые",
    "select": "Выбрать",
    "unknown": "Неизвестно",
    "top_wrench": "Мастер",
    "empty_title": "Очередь пуста",
    "empty_body": "Сейчас ничего не ждёт проверки.",
    "rail": { "inbox": "Входящие", "users": "Пользователи", "archive": "Архив", "exchange": "Барахолка", "models": "Модели", "settings": "Настройки" },
    "filters": { "all": "Все", "doc": "Документы", "wheel": "Диски", "registry": "Реестр", "color": "Цвета", "fix": "Правки" },
    "chips": { "doc": "Док", "wheel": "Диск", "registry": "Реестр", "color": "Цвет", "fix": "Правка" },
    "age": { "hours": "{count} ч", "days": "{count} д" },
    "bulk": {
      "approve": "Принять ({count})",
      "reject": "Отклонить…",
      "selected": "выбрано: {count}",
      "trusted_hint": "подсказка: можно принять автоматически (проверенный автор)",
      "approve_done": "Принято: {count}",
      "reject_done": "Отклонено: {count}",
      "partial": "не удалось обработать: {failed}"
    }
  },
  "ja": {
    "admin": "管理",
    "heading": "受信トレイ",
    "oldest_first": "古い順",
    "select": "選択",
    "unknown": "不明",
    "top_wrench": "熟練メカ",
    "empty_title": "キューは空です",
    "empty_body": "現在、審査待ちのものはありません。",
    "rail": { "inbox": "受信トレイ", "users": "ユーザー", "archive": "アーカイブ", "exchange": "マーケット", "models": "モデル", "settings": "設定" },
    "filters": { "all": "すべて", "doc": "資料", "wheel": "ホイール", "registry": "レジストリ", "color": "カラー", "fix": "修正" },
    "chips": { "doc": "資料", "wheel": "ホイール", "registry": "レジストリ", "color": "カラー", "fix": "修正" },
    "age": { "hours": "{count}時間", "days": "{count}日" },
    "bulk": {
      "approve": "承認（{count}）",
      "reject": "却下…",
      "selected": "{count} 件選択中",
      "trusted_hint": "提案: 自動承認（信頼できる貢献者）",
      "approve_done": "{count} 件を承認しました",
      "reject_done": "{count} 件を却下しました",
      "partial": "{failed} 件を処理できませんでした"
    }
  },
  "zh": {
    "admin": "管理",
    "heading": "收件箱",
    "oldest_first": "最早优先",
    "select": "选择",
    "unknown": "未知",
    "top_wrench": "老师傅",
    "empty_title": "队列已清空",
    "empty_body": "目前没有待审核的内容。",
    "rail": { "inbox": "收件箱", "users": "用户", "archive": "档案馆", "exchange": "交易市场", "models": "模型", "settings": "设置" },
    "filters": { "all": "全部", "doc": "文档", "wheel": "轮毂", "registry": "注册库", "color": "颜色", "fix": "更正" },
    "chips": { "doc": "文档", "wheel": "轮毂", "registry": "注册", "color": "颜色", "fix": "更正" },
    "age": { "hours": "{count} 小时", "days": "{count} 天" },
    "bulk": {
      "approve": "通过（{count}）",
      "reject": "驳回…",
      "selected": "已选 {count} 项",
      "trusted_hint": "建议：自动通过（可信贡献者）",
      "approve_done": "已通过 {count} 项",
      "reject_done": "已驳回 {count} 项",
      "partial": "{failed} 项处理失败"
    }
  },
  "ko": {
    "admin": "관리",
    "heading": "수신함",
    "oldest_first": "오래된 순",
    "select": "선택",
    "unknown": "알 수 없음",
    "top_wrench": "베테랑",
    "empty_title": "대기열이 비었습니다",
    "empty_body": "지금은 검토를 기다리는 항목이 없습니다.",
    "rail": { "inbox": "수신함", "users": "사용자", "archive": "아카이브", "exchange": "마켓", "models": "모델", "settings": "설정" },
    "filters": { "all": "전체", "doc": "문서", "wheel": "휠", "registry": "레지스트리", "color": "색상", "fix": "수정" },
    "chips": { "doc": "문서", "wheel": "휠", "registry": "레지스트리", "color": "색상", "fix": "수정" },
    "age": { "hours": "{count}시간", "days": "{count}일" },
    "bulk": {
      "approve": "승인 ({count})",
      "reject": "반려…",
      "selected": "{count}건 선택됨",
      "trusted_hint": "제안: 자동 승인 (신뢰 기여자)",
      "approve_done": "{count}건 승인",
      "reject_done": "{count}건 반려",
      "partial": "{failed}건은 처리하지 못했습니다"
    }
  }
}
</i18n>
