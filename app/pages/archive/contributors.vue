<script lang="ts" setup>
  /**
   * Contributor leaderboard (design S10).
   *
   * Ranked on items AND reach, so a person who added three things a thousand
   * people used outranks someone who added ten nobody opened — the explicit
   * intent is that quality beats spam.
   *
   * The month window resets so newcomers always have a shot; that is a product
   * decision, not an implementation detail, and the footnote says so on the page.
   */
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const { t } = useI18n();
  const supabase = useSupabase();
  const { user, isAuthenticated } = useAuth();

  interface Row {
    rank: number;
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    items: number;
    helped: number;
  }

  // Not named `window` — shadowing the global inside a component is a trap
  // waiting for the first person who adds a `window.matchMedia` call here.
  const boardWindow = ref<'month' | 'all'>('month');
  const rows = ref<Row[]>([]);
  const myRow = ref<{ rank: number; items: number; helped: number; items_to_top_ten: number } | null>(null);
  const loading = ref(true);

  const load = async () => {
    loading.value = true;
    try {
      const board = await supabase.rpc('get_contributor_leaderboard', { p_window: boardWindow.value, p_limit: 10 });
      rows.value = ((board.data ?? []) as unknown as Row[]).map((row) => ({ ...row, rank: Number(row.rank) }));

      if (isAuthenticated.value) {
        const mine = await supabase.rpc('get_my_leaderboard_row', { p_window: boardWindow.value });
        const first = mine.data?.[0];
        myRow.value = first
          ? {
              rank: Number(first.rank),
              items: Number(first.items),
              helped: Number(first.helped),
              items_to_top_ten: Number(first.items_to_top_ten),
            }
          : null;
      } else {
        myRow.value = null;
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      rows.value = [];
    } finally {
      loading.value = false;
    }
  };

  /** True when the caller is already visible in the top ten — no pinned duplicate. */
  const showPinnedRow = computed(() => myRow.value !== null && myRow.value.rank > 10);

  const handleOf = (row: Row) => (row.username ? `@${row.username}` : (row.display_name ?? t('anonymous')));
  const initialOf = (row: Row) => (row.display_name ?? row.username ?? '?').charAt(0).toUpperCase();
  const profileUrl = (row: Row) => (row.username ? `/users/${row.username}` : `/users/${row.user_id}`);

  watch(boardWindow, load);

  /**
   * Open on All Time when the current month has nobody on it.
   *
   * The month window is the intended default — it resets so newcomers always
   * have a shot — but landing on "Nobody on the board yet" is a dead end,
   * especially in the first days of a month, and especially when it is reached
   * from the archive card that just showed an all-time figure. Falls back only
   * once, on first load; the toggle stays fully under the visitor's control
   * after that.
   */
  onMounted(async () => {
    await load();
    if (rows.value.length === 0 && boardWindow.value === 'month') {
      boardWindow.value = 'all';
    }
  });

  useHead({ title: t('title') });
  useSeoMeta({
    ogTitle: t('title'),
    ogDescription: t('description'),
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive.png',
    twitterCard: 'summary_large_image',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" title-tag="p" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="mx-auto w-full max-w-[900px] px-4 py-7 lg:py-9">
    <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="t('breadcrumb')" />

    <div class="mt-6 mb-5 flex flex-wrap items-end gap-4">
      <div class="flex-1">
        <p class="text-[13px] font-bold uppercase tracking-[0.08em] text-secondary">{{ t('eyebrow') }}</p>
        <h1 class="fancy-font-bold mt-1 text-3xl lg:text-4xl">{{ t('heading') }}</h1>
      </div>
      <div class="join">
        <button
          type="button"
          class="btn join-item btn-sm"
          :class="boardWindow === 'month' ? 'btn-primary' : 'btn-outline'"
          @click="boardWindow = 'month'"
        >
          {{ t('this_month') }}
        </button>
        <button
          type="button"
          class="btn join-item btn-sm"
          :class="boardWindow === 'all' ? 'btn-primary' : 'btn-outline'"
          @click="boardWindow = 'all'"
        >
          {{ t('all_time') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg opacity-50"></span>
    </div>

    <div v-else-if="rows.length" class="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-md">
      <NuxtLink
        v-for="row in rows"
        :key="row.user_id"
        :to="profileUrl(row)"
        class="flex items-center gap-3.5 border-b border-base-300 px-4 py-3.5 last:border-b-0 hover:bg-base-200 sm:px-5"
      >
        <span class="w-6 shrink-0 text-base font-extrabold" :class="row.rank === 1 ? 'text-secondary' : 'opacity-55'">
          {{ row.rank }}
        </span>
        <span class="board-avatar">
          <img v-if="row.avatar_url" :src="row.avatar_url" :alt="handleOf(row)" class="h-full w-full object-cover" />
          <span v-else>{{ initialOf(row) }}</span>
        </span>
        <span class="min-w-0 flex-1 truncate text-[15px] font-bold">{{ handleOf(row) }}</span>
        <span class="shrink-0 text-[13.5px] opacity-75">{{ t('items', { count: row.items }, row.items) }}</span>
        <span class="hidden shrink-0 text-[13.5px] opacity-75 sm:inline">
          <i class="fas fa-user-group text-[11px] text-primary" aria-hidden="true"></i>
          {{ t('helped', { count: row.helped }, row.helped) }}
        </span>
      </NuxtLink>

      <!-- Your row, pinned: the gap-to-next nudge only makes sense outside the top ten. -->
      <div v-if="showPinnedRow && myRow" class="pinned-row flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
        <span class="w-6 shrink-0 text-base font-extrabold text-secondary">{{ myRow.rank }}</span>
        <span class="board-avatar">{{ (user?.email ?? 'Y').charAt(0).toUpperCase() }}</span>
        <span class="min-w-0 flex-1 truncate text-[15px] font-bold">{{ t('you') }}</span>
        <span class="shrink-0 text-[13.5px] opacity-75">{{ t('items', { count: myRow.items }, myRow.items) }}</span>
        <span v-if="myRow.items_to_top_ten > 0" class="shrink-0 text-[13.5px] font-semibold text-secondary">
          {{ t('gap_to_top', { count: myRow.items_to_top_ten }) }}
        </span>
      </div>
    </div>

    <div v-else class="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center">
      <i class="fas fa-trophy mb-3 block text-3xl opacity-30" aria-hidden="true"></i>
      <p class="text-lg font-bold">{{ t('empty_title') }}</p>
      <p class="mt-1 text-sm opacity-70">{{ t('empty_body') }}</p>
      <NuxtLink to="/archive" class="btn btn-secondary mt-5">{{ t('empty_cta') }}</NuxtLink>
    </div>

    <p class="mt-3.5 px-0.5 text-[13px] opacity-55">{{ t('footnote') }}</p>
  </div>
</template>

<style scoped>
  .board-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex: none;
    overflow: hidden;
    border-radius: 9999px;
    background: var(--color-primary);
    color: var(--color-primary-content);
    font-size: 14px;
    font-weight: 700;
  }

  .pinned-row {
    background: color-mix(in srgb, var(--color-secondary) 7%, transparent);
    border-top: 2px solid var(--color-secondary);
  }
</style>

<i18n lang="json">
{
  "en": {
    "title": "Archive Contributors — Classic Mini DIY",
    "description": "The people keeping the Classic Mini archive alive.",
    "hero_title": "Archive",
    "breadcrumb": "Contributors",
    "eyebrow": "ARCHIVE",
    "heading": "Contributors",
    "this_month": "This Month",
    "all_time": "All Time",
    "items": "{count} item | {count} items",
    "helped": "{count} helped | {count} helped",
    "you": "You",
    "anonymous": "A member",
    "gap_to_top": "{count} items from the top 10",
    "empty_title": "Nobody on the board yet",
    "empty_body": "Be the first contribution of the month.",
    "empty_cta": "Browse the archive",
    "footnote": "\"Helped\" counts downloads and views of the things you've added. Resets monthly so newcomers always have a shot."
  },
  "es": {
    "title": "Contribuyentes del Archivo — Classic Mini DIY",
    "description": "Las personas que mantienen vivo el archivo Classic Mini.",
    "hero_title": "Archivo",
    "breadcrumb": "Contribuyentes",
    "eyebrow": "ARCHIVO",
    "heading": "Contribuyentes",
    "this_month": "Este mes",
    "all_time": "Histórico",
    "items": "{count} elemento | {count} elementos",
    "helped": "{count} ayudado | {count} ayudados",
    "you": "Tú",
    "anonymous": "Un miembro",
    "gap_to_top": "{count} elementos para el top 10",
    "empty_title": "Todavía no hay nadie en la tabla",
    "empty_body": "Sé la primera contribución del mes.",
    "empty_cta": "Explorar el archivo",
    "footnote": "\"Ayudados\" cuenta descargas y vistas de lo que has añadido. Se reinicia cada mes para que los nuevos siempre tengan opción."
  },
  "fr": {
    "title": "Contributeurs des Archives — Classic Mini DIY",
    "description": "Les personnes qui font vivre les archives Classic Mini.",
    "hero_title": "Archive",
    "breadcrumb": "Contributeurs",
    "eyebrow": "ARCHIVE",
    "heading": "Contributeurs",
    "this_month": "Ce mois-ci",
    "all_time": "Depuis toujours",
    "items": "{count} élément | {count} éléments",
    "helped": "{count} aidé | {count} aidés",
    "you": "Vous",
    "anonymous": "Un membre",
    "gap_to_top": "{count} éléments du top 10",
    "empty_title": "Personne au classement pour l'instant",
    "empty_body": "Soyez la première contribution du mois.",
    "empty_cta": "Parcourir les archives",
    "footnote": "« Aidés » compte les téléchargements et vues de ce que vous avez ajouté. Remis à zéro chaque mois pour laisser leur chance aux nouveaux."
  },
  "de": {
    "title": "Archiv-Beitragende — Classic Mini DIY",
    "description": "Die Menschen, die das Classic-Mini-Archiv am Leben halten.",
    "hero_title": "Archiv",
    "breadcrumb": "Beitragende",
    "eyebrow": "ARCHIV",
    "heading": "Beitragende",
    "this_month": "Diesen Monat",
    "all_time": "Gesamt",
    "items": "{count} Eintrag | {count} Einträge",
    "helped": "{count} geholfen | {count} geholfen",
    "you": "Du",
    "anonymous": "Ein Mitglied",
    "gap_to_top": "{count} Einträge bis in die Top 10",
    "empty_title": "Noch niemand auf der Liste",
    "empty_body": "Sei der erste Beitrag des Monats.",
    "empty_cta": "Archiv durchstöbern",
    "footnote": "„Geholfen“ zählt Downloads und Aufrufe der Inhalte, die du hinzugefügt hast. Wird monatlich zurückgesetzt, damit Neue immer eine Chance haben."
  },
  "it": {
    "title": "Contributori dell'Archivio — Classic Mini DIY",
    "description": "Le persone che tengono vivo l'archivio Classic Mini.",
    "hero_title": "Archivio",
    "breadcrumb": "Contributori",
    "eyebrow": "ARCHIVIO",
    "heading": "Contributori",
    "this_month": "Questo mese",
    "all_time": "Sempre",
    "items": "{count} elemento | {count} elementi",
    "helped": "{count} aiutato | {count} aiutati",
    "you": "Tu",
    "anonymous": "Un membro",
    "gap_to_top": "{count} elementi dalla top 10",
    "empty_title": "Ancora nessuno in classifica",
    "empty_body": "Sii il primo contributo del mese.",
    "empty_cta": "Esplora l'archivio",
    "footnote": "\"Aiutati\" conta download e visualizzazioni di ciò che hai aggiunto. Si azzera ogni mese così i nuovi hanno sempre una possibilità."
  },
  "pt": {
    "title": "Contribuidores do Arquivo — Classic Mini DIY",
    "description": "As pessoas que mantêm o arquivo Classic Mini vivo.",
    "hero_title": "Arquivo",
    "breadcrumb": "Contribuidores",
    "eyebrow": "ARQUIVO",
    "heading": "Contribuidores",
    "this_month": "Este mês",
    "all_time": "Sempre",
    "items": "{count} item | {count} itens",
    "helped": "{count} ajudado | {count} ajudados",
    "you": "Você",
    "anonymous": "Um membro",
    "gap_to_top": "{count} itens para o top 10",
    "empty_title": "Ainda ninguém na tabela",
    "empty_body": "Seja a primeira contribuição do mês.",
    "empty_cta": "Explorar o arquivo",
    "footnote": "\"Ajudados\" conta downloads e visualizações do que adicionou. Reinicia todos os meses para que os novos tenham sempre hipótese."
  },
  "ru": {
    "title": "Участники архива — Classic Mini DIY",
    "description": "Люди, благодаря которым архив Classic Mini живёт.",
    "hero_title": "Архив",
    "breadcrumb": "Участники",
    "eyebrow": "АРХИВ",
    "heading": "Участники",
    "this_month": "За месяц",
    "all_time": "За всё время",
    "items": "записей: {count}",
    "helped": "помогли: {count}",
    "you": "Вы",
    "anonymous": "Участник",
    "gap_to_top": "до топ-10: {count}",
    "empty_title": "В таблице пока никого",
    "empty_body": "Станьте первым вкладом месяца.",
    "empty_cta": "Открыть архив",
    "footnote": "«Помогли» — это загрузки и просмотры добавленных вами материалов. Сбрасывается каждый месяц, чтобы у новичков всегда был шанс."
  },
  "ja": {
    "title": "アーカイブ貢献者 — Classic Mini DIY",
    "description": "クラシックミニのアーカイブを支えている人たち。",
    "hero_title": "アーカイブ",
    "breadcrumb": "貢献者",
    "eyebrow": "アーカイブ",
    "heading": "貢献者",
    "this_month": "今月",
    "all_time": "累計",
    "items": "{count} 件",
    "helped": "{count} 人の役に立ちました",
    "you": "あなた",
    "anonymous": "メンバー",
    "gap_to_top": "トップ10まであと {count} 件",
    "empty_title": "まだ誰もランキングにいません",
    "empty_body": "今月の最初の貢献者になりましょう。",
    "empty_cta": "アーカイブを見る",
    "footnote": "「役に立ちました」は追加された内容のダウンロード数と閲覧数です。毎月リセットされるので、新しい方にも常にチャンスがあります。"
  },
  "zh": {
    "title": "档案馆贡献者 — Classic Mini DIY",
    "description": "让经典迷你档案馆持续生长的人们。",
    "hero_title": "档案馆",
    "breadcrumb": "贡献者",
    "eyebrow": "档案馆",
    "heading": "贡献者",
    "this_month": "本月",
    "all_time": "全部时间",
    "items": "{count} 项",
    "helped": "{count} 人受益",
    "you": "你",
    "anonymous": "一位成员",
    "gap_to_top": "距离前十还差 {count} 项",
    "empty_title": "榜单还是空的",
    "empty_body": "来做本月的第一份贡献吧。",
    "empty_cta": "浏览档案馆",
    "footnote": "“受益”统计你所添加内容的下载量和浏览量。每月重置，新人永远有机会。"
  },
  "ko": {
    "title": "아카이브 기여자 — Classic Mini DIY",
    "description": "클래식 미니 아카이브를 살아 있게 하는 사람들.",
    "hero_title": "아카이브",
    "breadcrumb": "기여자",
    "eyebrow": "아카이브",
    "heading": "기여자",
    "this_month": "이번 달",
    "all_time": "전체 기간",
    "items": "{count}건",
    "helped": "{count}명에게 도움",
    "you": "회원님",
    "anonymous": "회원",
    "gap_to_top": "상위 10위까지 {count}건",
    "empty_title": "아직 순위에 아무도 없습니다",
    "empty_body": "이번 달 첫 기여자가 되어 보세요.",
    "empty_cta": "아카이브 둘러보기",
    "footnote": "'도움'은 등록하신 항목의 다운로드 수와 조회 수입니다. 매달 초기화되어 새로 오신 분도 항상 기회가 있습니다."
  }
}
</i18n>
