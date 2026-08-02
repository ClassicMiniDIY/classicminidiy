<script lang="ts" setup>
  /**
   * Archive home activity block (design S6): Latest Additions, This Month, and
   * Most Wanted.
   *
   * There are deliberately NO completeness meters here. The product decision was
   * that an archive should show itself growing rather than show how incomplete
   * it is — a percentage that never reaches 100 reads as failure, a feed of
   * recent contributions reads as momentum.
   */
  import type { Database } from '~~/types/database';

  const { t, locale } = useI18n();
  const supabase = useSupabase();
  const { openWizard } = useContributeWizard();
  const { requests: mostWanted, load: loadMostWanted, requestItem, submitting } = useArchiveRequests();

  type LatestAddition =
    Database['public']['Functions']['get_archive_latest_additions']['Returns'][number];

  const latest = ref<LatestAddition[]>([]);
  const monthStats = ref<{ items: number; contributors: number } | null>(null);

  const ICONS: Record<string, string> = {
    wheel: 'fas fa-ring',
    registry: 'fas fa-clipboard-list',
    color: 'fas fa-brush',
    document: 'fas fa-file-lines',
  };

  const ENTRY_URLS: Record<string, (id: string) => string> = {
    wheel: (id) => `/archive/wheels/${id}`,
    color: (id) => `/archive/colors/${id}`,
    registry: () => '/archive/registry',
    document: () => '/archive/documents',
  };

  const entryUrl = (row: LatestAddition) =>
    (ENTRY_URLS[row.target_type as string] ?? (() => '/archive'))(row.target_id as string);

  const handleOf = (row: { username: string | null; display_name: string | null }) =>
    row.username ? `@${row.username}` : (row.display_name ?? t('someone'));

  /** "2d ago" without pulling in a date library. */
  const relativeTime = (iso: string) => {
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536000],
      ['month', 2592000],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [unit, size] of units) {
      if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
    }
    return rtf.format(0, 'minute');
  };

  const load = async () => {
    const [additions, stats] = await Promise.all([
      supabase.rpc('get_archive_latest_additions', { p_limit: 3 }),
      supabase.rpc('get_archive_month_stats'),
    ]);

    if (!additions.error) latest.value = (additions.data ?? []) as LatestAddition[];
    if (!stats.error && stats.data?.[0]) {
      monthStats.value = {
        items: Number(stats.data[0].items_this_month ?? 0),
        contributors: Number(stats.data[0].contributors_this_month ?? 0),
      };
    }
    await loadMostWanted(3);
  };

  /** "I have this" opens the wizard pre-filled and stamped with the request. */
  const fillGap = (request: (typeof mostWanted.value)[number]) => {
    openWizard({
      kind: request.target_type === 'wheel' ? 'wheel' : request.target_type === 'registry' ? 'registry' : 'document',
      targetType: request.target_type,
      targetId: request.target_id,
      targetTitle: request.title,
      requestId: request.id,
      origin: 'most_wanted',
    });
  };

  const addAsk = (request: (typeof mostWanted.value)[number]) =>
    requestItem({ title: request.title, targetType: request.target_type, targetId: request.target_id });

  onMounted(load);
</script>

<template>
  <div class="mb-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
    <!-- Latest additions -->
    <div class="rounded-box border border-base-300 bg-base-100 p-5 shadow-md">
      <p class="mb-3 text-xs font-bold uppercase tracking-[0.08em] opacity-55">{{ t('latest_additions') }}</p>
      <div v-if="latest.length" class="flex flex-col gap-2.5">
        <div v-for="row in latest" :key="`${row.target_type}-${row.target_id}`" class="flex items-center gap-3">
          <i :class="[ICONS[row.target_type as string] ?? 'fas fa-box-archive', 'w-[18px] text-center text-primary']" aria-hidden="true"></i>
          <NuxtLink :to="entryUrl(row)" class="min-w-0 flex-1 truncate text-[14.5px] font-semibold hover:underline">
            {{ row.title }}
          </NuxtLink>
          <span class="shrink-0 text-[13px] opacity-60">
            <NuxtLink v-if="row.username" :to="`/users/${row.username}`" class="text-primary hover:underline">
              {{ handleOf(row) }}
            </NuxtLink>
            <span v-else>{{ handleOf(row) }}</span>
            &middot; {{ relativeTime(row.added_at as string) }}
          </span>
        </div>
      </div>
      <p v-else class="text-sm opacity-60">{{ t('no_additions') }}</p>
    </div>

    <!-- This month -->
    <div class="month-card rounded-box p-5">
      <p class="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-accent">{{ t('this_month') }}</p>
      <p class="text-[26px] font-extrabold leading-tight">
        {{ t('items_count', { count: monthStats?.items ?? 0 }) }}
        <span class="text-[15px] font-semibold opacity-70">
          {{ t('from_people', { count: monthStats?.contributors ?? 0 }) }}
        </span>
      </p>
      <NuxtLink to="/archive/contributors" class="mt-2.5 inline-block text-sm font-bold text-primary hover:underline">
        <i class="fas fa-trophy text-secondary" aria-hidden="true"></i>
        {{ t('leaderboard') }} &rarr;
      </NuxtLink>
    </div>
  </div>

  <!-- Most Wanted -->
  <div v-if="mostWanted.length" class="mb-5 rounded-box border border-base-300 bg-base-100 p-5 shadow-md">
    <p class="mb-3 text-xs font-bold uppercase tracking-[0.08em] opacity-55">
      {{ t('most_wanted') }}
      <span class="font-normal normal-case tracking-normal">&mdash; {{ t('most_wanted_hint') }}</span>
    </p>
    <div class="flex flex-col gap-2.5">
      <div
        v-for="request in mostWanted"
        :key="request.id"
        class="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-3"
      >
        <span class="min-w-0 flex-1 text-[14.5px] font-semibold">{{ request.title }}</span>
        <button
          type="button"
          class="badge badge-sm shrink-0 rounded-full border-0 bg-base-200 text-xs font-semibold"
          :disabled="request.asked_by_me || submitting"
          :title="request.asked_by_me ? t('already_asked') : t('add_ask')"
          @click="addAsk(request)"
        >
          {{ t('asks', { count: request.ask_count }) }}
        </button>
        <button type="button" class="btn btn-outline btn-secondary btn-xs h-[30px] shrink-0" @click="fillGap(request)">
          {{ t('i_have_this') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .month-card {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  }
</style>

<i18n lang="json">
{
  "en": {
    "latest_additions": "Latest additions",
    "no_additions": "Nothing added yet — be the first.",
    "this_month": "This month",
    "items_count": "{count} items",
    "from_people": "from {count} people",
    "leaderboard": "Contributor leaderboard",
    "most_wanted": "Most wanted",
    "most_wanted_hint": "asked for, still missing",
    "asks": "{count} asks",
    "add_ask": "Add your ask",
    "already_asked": "You have already asked for this",
    "i_have_this": "I have this",
    "someone": "a member"
  },
  "es": {
    "latest_additions": "Últimas incorporaciones",
    "no_additions": "Todavía no hay nada — sé el primero.",
    "this_month": "Este mes",
    "items_count": "{count} elementos",
    "from_people": "de {count} personas",
    "leaderboard": "Tabla de contribuyentes",
    "most_wanted": "Más buscados",
    "most_wanted_hint": "pedidos, aún ausentes",
    "asks": "{count} peticiones",
    "add_ask": "Añade tu petición",
    "already_asked": "Ya has pedido esto",
    "i_have_this": "Yo lo tengo",
    "someone": "un miembro"
  },
  "fr": {
    "latest_additions": "Derniers ajouts",
    "no_additions": "Rien encore — soyez le premier.",
    "this_month": "Ce mois-ci",
    "items_count": "{count} éléments",
    "from_people": "de {count} personnes",
    "leaderboard": "Classement des contributeurs",
    "most_wanted": "Les plus demandés",
    "most_wanted_hint": "demandés, toujours manquants",
    "asks": "{count} demandes",
    "add_ask": "Ajouter votre demande",
    "already_asked": "Vous l'avez déjà demandé",
    "i_have_this": "Je l'ai",
    "someone": "un membre"
  },
  "de": {
    "latest_additions": "Neueste Ergänzungen",
    "no_additions": "Noch nichts da — mach den Anfang.",
    "this_month": "Diesen Monat",
    "items_count": "{count} Einträge",
    "from_people": "von {count} Personen",
    "leaderboard": "Bestenliste der Beitragenden",
    "most_wanted": "Meistgesucht",
    "most_wanted_hint": "angefragt, noch nicht da",
    "asks": "{count} Anfragen",
    "add_ask": "Deine Anfrage hinzufügen",
    "already_asked": "Du hast das bereits angefragt",
    "i_have_this": "Habe ich",
    "someone": "ein Mitglied"
  },
  "it": {
    "latest_additions": "Ultime aggiunte",
    "no_additions": "Ancora niente — sii il primo.",
    "this_month": "Questo mese",
    "items_count": "{count} elementi",
    "from_people": "da {count} persone",
    "leaderboard": "Classifica dei contributori",
    "most_wanted": "Più richiesti",
    "most_wanted_hint": "richiesti, ancora mancanti",
    "asks": "{count} richieste",
    "add_ask": "Aggiungi la tua richiesta",
    "already_asked": "L'hai già richiesto",
    "i_have_this": "Ce l'ho",
    "someone": "un membro"
  },
  "pt": {
    "latest_additions": "Adições recentes",
    "no_additions": "Ainda nada — seja o primeiro.",
    "this_month": "Este mês",
    "items_count": "{count} itens",
    "from_people": "de {count} pessoas",
    "leaderboard": "Tabela de contribuidores",
    "most_wanted": "Mais procurados",
    "most_wanted_hint": "pedidos, ainda em falta",
    "asks": "{count} pedidos",
    "add_ask": "Adicione o seu pedido",
    "already_asked": "Já pediu isto",
    "i_have_this": "Eu tenho isto",
    "someone": "um membro"
  },
  "ru": {
    "latest_additions": "Последние поступления",
    "no_additions": "Пока ничего нет — станьте первым.",
    "this_month": "В этом месяце",
    "items_count": "записей: {count}",
    "from_people": "от {count} человек",
    "leaderboard": "Рейтинг участников",
    "most_wanted": "Самое востребованное",
    "most_wanted_hint": "просили, но всё ещё нет",
    "asks": "запросов: {count}",
    "add_ask": "Добавить свой запрос",
    "already_asked": "Вы уже это запрашивали",
    "i_have_this": "У меня это есть",
    "someone": "участник"
  },
  "ja": {
    "latest_additions": "最近の追加",
    "no_additions": "まだ何もありません — 最初の一件をどうぞ。",
    "this_month": "今月",
    "items_count": "{count} 件",
    "from_people": "{count} 人から",
    "leaderboard": "貢献者ランキング",
    "most_wanted": "リクエストの多い項目",
    "most_wanted_hint": "リクエスト済み、まだ未収録",
    "asks": "{count} 件のリクエスト",
    "add_ask": "自分もリクエストする",
    "already_asked": "すでにリクエスト済みです",
    "i_have_this": "持っています",
    "someone": "メンバー"
  },
  "zh": {
    "latest_additions": "最新收录",
    "no_additions": "还没有内容 — 来当第一个吧。",
    "this_month": "本月",
    "items_count": "{count} 项",
    "from_people": "来自 {count} 人",
    "leaderboard": "贡献者排行榜",
    "most_wanted": "最想要",
    "most_wanted_hint": "有人求，但还没有",
    "asks": "{count} 次请求",
    "add_ask": "我也想要",
    "already_asked": "你已经请求过了",
    "i_have_this": "我有这个",
    "someone": "一位成员"
  },
  "ko": {
    "latest_additions": "최근 추가",
    "no_additions": "아직 아무것도 없습니다 — 첫 번째가 되어 주세요.",
    "this_month": "이번 달",
    "items_count": "{count}건",
    "from_people": "{count}명이 참여",
    "leaderboard": "기여자 순위",
    "most_wanted": "가장 많이 요청됨",
    "most_wanted_hint": "요청되었지만 아직 없음",
    "asks": "{count}건 요청",
    "add_ask": "나도 요청하기",
    "already_asked": "이미 요청하셨습니다",
    "i_have_this": "제가 가지고 있어요",
    "someone": "회원"
  }
}
</i18n>
