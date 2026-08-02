<script lang="ts" setup>
  /**
   * Omnisearch palette (design S2 / M3).
   *
   * Mounted once in app.vue. Desktop renders a 640px palette 72px from the top
   * over a black/50 dim (no blur — the design system explicitly says so).
   * Mobile renders a full-screen takeover with a Cancel affordance so the
   * keyboard can come up immediately.
   */
  const { t } = useI18n();
  const {
    isOpen,
    query,
    groups,
    flatResults,
    loading,
    highlighted,
    recent,
    close,
    debouncedSearch,
    goTo,
    viewAllResults,
    moveHighlight,
    selectHighlighted,
  } = useOmnisearch();

  const { requests: mostWanted, load: loadMostWanted } = useArchiveRequests();
  const { openWizard } = useContributeWizard();

  const inputRef = ref<HTMLInputElement | null>(null);

  /** Index of each result in the flattened list, so highlight survives grouping. */
  const flatIndex = (surface: string, id: string) =>
    flatResults.value.findIndex((result) => result.surface === surface && result.id === id);

  const hasQuery = computed(() => query.value.trim().length >= 2);
  const isEmpty = computed(() => hasQuery.value && !loading.value && flatResults.value.length === 0);

  watch(isOpen, async (open) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      if (mostWanted.value.length === 0) loadMostWanted(3);
      await nextTick();
      inputRef.value?.focus();
      inputRef.value?.select();
    }
  });

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectHighlighted();
    }
  };

  /**
   * "Request it" — the miss path that feeds Most Wanted. Sends the user into the
   * contribute wizard's request step with what they typed already filled in.
   */
  const requestIt = () => {
    const term = query.value.trim();
    close();
    openWizard({ mode: 'request', requestTitle: term });
  };

  const runFromRecent = (term: string) => {
    query.value = term;
    debouncedSearch();
  };
</script>

<template>
  <Teleport to="body">
    <Transition name="omnisearch">
      <div v-if="isOpen" class="fixed inset-0 z-[80]" role="dialog" aria-modal="true" :aria-label="t('aria_label')">
        <!-- Page dim: black/50, deliberately no blur -->
        <div class="absolute inset-0 bg-black/50" aria-hidden="true" @click="close()"></div>

        <div
          class="omnisearch-panel absolute inset-0 flex flex-col bg-base-100 sm:inset-auto sm:left-1/2 sm:top-[72px] sm:h-auto sm:max-h-[calc(100vh-140px)] sm:w-[640px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:rounded-box sm:shadow-2xl sm:overflow-hidden"
        >
          <!-- Input row -->
          <div class="flex items-center gap-3 border-b border-base-300 px-4 py-3 sm:px-5 sm:py-4">
            <i class="fas fa-magnifying-glass text-secondary" aria-hidden="true"></i>
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              class="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-[17px]"
              :placeholder="t('placeholder')"
              autocomplete="off"
              spellcheck="false"
              @input="debouncedSearch()"
              @keydown="onKeydown"
            />
            <span v-if="loading" class="loading loading-spinner loading-xs opacity-60"></span>
            <kbd class="kbd kbd-sm hidden sm:inline-flex">esc</kbd>
            <button type="button" class="btn btn-ghost btn-sm text-primary sm:hidden" @click="close()">
              {{ t('cancel') }}
            </button>
          </div>

          <!-- Results -->
          <div class="flex-1 overflow-y-auto px-2 py-2 sm:max-h-[420px]">
            <template v-if="hasQuery && flatResults.length > 0">
              <div v-for="group in groups" :key="group.surface" class="mb-1">
                <p class="mx-3 my-1 text-[11px] font-bold tracking-[0.08em] uppercase opacity-55">
                  {{ group.label }} &middot; {{ group.results.length }}
                </p>
                <button
                  v-for="result in group.results"
                  :key="`${result.surface}-${result.id}`"
                  type="button"
                  class="omnisearch-row flex min-h-11 w-full items-center gap-3 rounded-field px-3 py-2.5 text-left"
                  :class="{ 'is-active': flatIndex(group.surface, result.id) === highlighted }"
                  @mouseenter="highlighted = flatIndex(group.surface, result.id)"
                  @click="goTo(result)"
                >
                  <i :class="[result.icon, 'w-[18px] text-center text-primary']" aria-hidden="true"></i>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[14.5px] font-semibold">{{ result.title }}</span>
                    <span v-if="result.subtitle" class="block truncate text-xs opacity-60">{{ result.subtitle }}</span>
                  </span>
                  <span v-if="result.tag" class="badge badge-sm shrink-0 rounded-full bg-base-200 border-0 text-[11px]">
                    {{ result.tag }}
                  </span>
                </button>
              </div>
            </template>

            <!-- No results -->
            <div v-else-if="isEmpty" class="px-4 py-8 text-center">
              <i class="fas fa-magnifying-glass mb-3 block text-2xl opacity-30" aria-hidden="true"></i>
              <p class="font-semibold">{{ t('empty_title', { query: query.trim() }) }}</p>
              <p class="mt-1 text-sm opacity-70">{{ t('empty_body') }}</p>
              <button type="button" class="btn btn-secondary btn-sm mt-4" @click="requestIt()">
                <i class="fas fa-hand" aria-hidden="true"></i>
                {{ t('request_it') }}
              </button>
            </div>

            <!-- Idle: recent searches + top Most Wanted -->
            <div v-else-if="!hasQuery" class="px-1 py-1">
              <template v-if="recent.length">
                <p class="mx-3 my-1 text-[11px] font-bold tracking-[0.08em] uppercase opacity-55">
                  {{ t('recent') }}
                </p>
                <button
                  v-for="term in recent"
                  :key="term"
                  type="button"
                  class="omnisearch-row flex min-h-11 w-full items-center gap-3 rounded-field px-3 py-2.5 text-left"
                  @click="runFromRecent(term)"
                >
                  <i class="fas fa-clock-rotate-left w-[18px] text-center opacity-50" aria-hidden="true"></i>
                  <span class="flex-1 truncate text-[14.5px]">{{ term }}</span>
                </button>
              </template>

              <template v-if="mostWanted.length">
                <p class="mx-3 mt-3 mb-1 text-[11px] font-bold tracking-[0.08em] uppercase opacity-55">
                  {{ t('most_wanted') }}
                </p>
                <button
                  v-for="request in mostWanted"
                  :key="request.id"
                  type="button"
                  class="omnisearch-row flex min-h-11 w-full items-center gap-3 rounded-field px-3 py-2.5 text-left"
                  @click="runFromRecent(request.title)"
                >
                  <i class="fas fa-hand w-[18px] text-center text-secondary" aria-hidden="true"></i>
                  <span class="flex-1 truncate text-[14.5px]">{{ request.title }}</span>
                  <span class="badge badge-sm shrink-0 rounded-full bg-base-200 border-0 text-[11px]">
                    {{ t('asks', { count: request.ask_count }) }}
                  </span>
                </button>
              </template>

              <p v-if="!recent.length && !mostWanted.length" class="px-4 py-8 text-center text-sm opacity-60">
                {{ t('idle_hint') }}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div
            v-if="hasQuery && flatResults.length > 0"
            class="flex flex-col gap-2 border-t border-base-300 bg-base-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <span class="text-[13px] opacity-80">
              {{ t('cant_find') }}
              <button type="button" class="font-bold text-secondary hover:underline" @click="requestIt()">
                {{ t('request_it') }}
              </button>
              <span class="hidden sm:inline"> &mdash; {{ t('feeds_most_wanted') }}</span>
            </span>
            <button type="button" class="text-left text-[13px] font-bold text-primary hover:underline" @click="viewAllResults()">
              {{ t('view_all', { count: flatResults.length }) }} &rarr;
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .omnisearch-row.is-active,
  .omnisearch-row:hover {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }

  /* 250ms slide + 200ms backdrop fade, matching the drawer motion in MainNav. */
  .omnisearch-enter-active,
  .omnisearch-leave-active {
    transition: opacity 0.2s ease;
  }
  .omnisearch-enter-active .omnisearch-panel,
  .omnisearch-leave-active .omnisearch-panel {
    transition: transform 0.25s ease, opacity 0.25s ease;
  }
  .omnisearch-enter-from,
  .omnisearch-leave-to {
    opacity: 0;
  }
  .omnisearch-enter-from .omnisearch-panel,
  .omnisearch-leave-to .omnisearch-panel {
    opacity: 0;
    transform: translateY(-8px);
  }

  @media (min-width: 640px) {
    .omnisearch-enter-from .omnisearch-panel,
    .omnisearch-leave-to .omnisearch-panel {
      transform: translate(-50%, -8px);
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "aria_label": "Search everything",
    "placeholder": "Try \"brake bleeding\" or \"10x4.5 minilite\"…",
    "cancel": "Cancel",
    "recent": "Recent searches",
    "most_wanted": "Most wanted",
    "asks": "{count} asks",
    "idle_hint": "Search tools, the archive, wheels and The Mini Exchange.",
    "empty_title": "No results for \"{query}\"",
    "empty_body": "Nothing in the toolbox, archive or exchange matches that yet.",
    "cant_find": "Can't find it?",
    "request_it": "Request it",
    "feeds_most_wanted": "feeds Most Wanted",
    "view_all": "View all {count} results"
  },
  "es": {
    "aria_label": "Buscar en todo",
    "placeholder": "Prueba \"purga de frenos\" o \"10x4.5 minilite\"…",
    "cancel": "Cancelar",
    "recent": "Búsquedas recientes",
    "most_wanted": "Más buscados",
    "asks": "{count} peticiones",
    "idle_hint": "Busca herramientas, el archivo, ruedas y The Mini Exchange.",
    "empty_title": "Sin resultados para \"{query}\"",
    "empty_body": "Nada en las herramientas, el archivo o el mercado coincide todavía.",
    "cant_find": "¿No lo encuentras?",
    "request_it": "Pídelo",
    "feeds_most_wanted": "alimenta Más buscados",
    "view_all": "Ver los {count} resultados"
  },
  "fr": {
    "aria_label": "Tout rechercher",
    "placeholder": "Essayez \"purge des freins\" ou \"10x4.5 minilite\"…",
    "cancel": "Annuler",
    "recent": "Recherches récentes",
    "most_wanted": "Les plus demandés",
    "asks": "{count} demandes",
    "idle_hint": "Cherchez les outils, les archives, les jantes et The Mini Exchange.",
    "empty_title": "Aucun résultat pour \"{query}\"",
    "empty_body": "Rien dans les outils, les archives ou la petite annonce ne correspond encore.",
    "cant_find": "Vous ne trouvez pas ?",
    "request_it": "Demandez-le",
    "feeds_most_wanted": "alimente Les plus demandés",
    "view_all": "Voir les {count} résultats"
  },
  "de": {
    "aria_label": "Alles durchsuchen",
    "placeholder": "Versuche \"Bremsen entlüften\" oder \"10x4.5 minilite\"…",
    "cancel": "Abbrechen",
    "recent": "Letzte Suchen",
    "most_wanted": "Meistgesucht",
    "asks": "{count} Anfragen",
    "idle_hint": "Durchsuche Werkzeuge, Archiv, Räder und The Mini Exchange.",
    "empty_title": "Keine Ergebnisse für \"{query}\"",
    "empty_body": "Noch nichts in Werkzeugen, Archiv oder Marktplatz passt dazu.",
    "cant_find": "Nicht gefunden?",
    "request_it": "Anfragen",
    "feeds_most_wanted": "speist Meistgesucht",
    "view_all": "Alle {count} Ergebnisse anzeigen"
  },
  "it": {
    "aria_label": "Cerca ovunque",
    "placeholder": "Prova \"spurgo freni\" o \"10x4.5 minilite\"…",
    "cancel": "Annulla",
    "recent": "Ricerche recenti",
    "most_wanted": "Più richiesti",
    "asks": "{count} richieste",
    "idle_hint": "Cerca strumenti, archivio, cerchi e The Mini Exchange.",
    "empty_title": "Nessun risultato per \"{query}\"",
    "empty_body": "Niente negli strumenti, nell'archivio o nel mercato corrisponde ancora.",
    "cant_find": "Non lo trovi?",
    "request_it": "Richiedilo",
    "feeds_most_wanted": "alimenta Più richiesti",
    "view_all": "Vedi tutti i {count} risultati"
  },
  "pt": {
    "aria_label": "Pesquisar tudo",
    "placeholder": "Tente \"sangria de freios\" ou \"10x4.5 minilite\"…",
    "cancel": "Cancelar",
    "recent": "Pesquisas recentes",
    "most_wanted": "Mais procurados",
    "asks": "{count} pedidos",
    "idle_hint": "Pesquise ferramentas, o arquivo, rodas e The Mini Exchange.",
    "empty_title": "Sem resultados para \"{query}\"",
    "empty_body": "Nada nas ferramentas, no arquivo ou no mercado corresponde ainda.",
    "cant_find": "Não encontrou?",
    "request_it": "Peça",
    "feeds_most_wanted": "alimenta Mais procurados",
    "view_all": "Ver todos os {count} resultados"
  },
  "ru": {
    "aria_label": "Искать везде",
    "placeholder": "Попробуйте «прокачка тормозов» или «10x4.5 minilite»…",
    "cancel": "Отмена",
    "recent": "Недавние запросы",
    "most_wanted": "Самое востребованное",
    "asks": "запросов: {count}",
    "idle_hint": "Ищите инструменты, архив, диски и The Mini Exchange.",
    "empty_title": "Нет результатов по запросу «{query}»",
    "empty_body": "Пока ничего не найдено в инструментах, архиве или на площадке.",
    "cant_find": "Не нашли?",
    "request_it": "Запросить",
    "feeds_most_wanted": "пополняет «Самое востребованное»",
    "view_all": "Показать все результаты ({count})"
  },
  "ja": {
    "aria_label": "すべてを検索",
    "placeholder": "「ブレーキのエア抜き」や「10x4.5 minilite」など…",
    "cancel": "キャンセル",
    "recent": "最近の検索",
    "most_wanted": "リクエストの多い項目",
    "asks": "{count}件のリクエスト",
    "idle_hint": "ツール、アーカイブ、ホイール、The Mini Exchange を検索します。",
    "empty_title": "「{query}」の結果はありません",
    "empty_body": "ツール、アーカイブ、マーケットプレイスにまだ該当がありません。",
    "cant_find": "見つかりませんか？",
    "request_it": "リクエストする",
    "feeds_most_wanted": "リクエストの多い項目に反映されます",
    "view_all": "{count}件すべての結果を表示"
  },
  "zh": {
    "aria_label": "搜索全部",
    "placeholder": "试试“刹车排气”或“10x4.5 minilite”…",
    "cancel": "取消",
    "recent": "最近搜索",
    "most_wanted": "最想要",
    "asks": "{count} 次请求",
    "idle_hint": "搜索工具、档案馆、轮毂和 The Mini Exchange。",
    "empty_title": "没有“{query}”的结果",
    "empty_body": "工具、档案馆或市场中暂时没有匹配项。",
    "cant_find": "找不到？",
    "request_it": "请求收录",
    "feeds_most_wanted": "会加入最想要列表",
    "view_all": "查看全部 {count} 条结果"
  },
  "ko": {
    "aria_label": "전체 검색",
    "placeholder": "\"브레이크 블리딩\" 또는 \"10x4.5 minilite\" 등…",
    "cancel": "취소",
    "recent": "최근 검색",
    "most_wanted": "가장 많이 요청됨",
    "asks": "{count}건 요청",
    "idle_hint": "도구, 아카이브, 휠, The Mini Exchange를 검색하세요.",
    "empty_title": "\"{query}\"에 대한 결과가 없습니다",
    "empty_body": "도구, 아카이브, 마켓플레이스에 아직 일치하는 항목이 없습니다.",
    "cant_find": "찾지 못하셨나요?",
    "request_it": "요청하기",
    "feeds_most_wanted": "가장 많이 요청됨 목록에 반영됩니다",
    "view_all": "{count}개 결과 모두 보기"
  }
}
</i18n>
