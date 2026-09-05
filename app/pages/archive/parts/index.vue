<script lang="ts" setup>
  /**
   * /archive/parts — search the part-number archive.
   *
   * Data comes from a server route rather than a client Supabase query so the
   * page renders on the server for SEO, and because the retailer link lives in
   * a table anon deliberately cannot read.
   */
  interface PartRow {
    partNumber: string;
    slug: string;
    description: string | null;
    kind: string | null;
    system: string | null;
    source: string | null;
  }
  interface SearchResult {
    parts: PartRow[];
    total: number;
    page: number;
    pageSize: number;
    query: string | null;
  }

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  const searchTerm = ref(typeof route.query.q === 'string' ? route.query.q : '');
  const page = computed(() => Math.max(1, Number.parseInt(String(route.query.page ?? '1'), 10) || 1));

  // NOT the getter form of useFetch — that shape is banned in this repo. The
  // query is a reactive object instead, which re-fetches on change.
  const { data, pending, error } = await useFetch<SearchResult>('/api/archive/parts/search', {
    query: computed(() => ({ q: route.query.q ?? '', page: page.value })),
  });

  interface PlateRow {
    id: string;
    title: string;
    page: string | null;
    hasImage: boolean;
    parts: number | null;
  }
  interface SystemRow {
    system: string;
    sections: { section: string; plates: PlateRow[] }[];
    plateCount: number;
    partCount: number | null;
  }

  // Browse is the default view; search is the other way in, not the only one.
  const { data: browse } = await useFetch<{ systems: SystemRow[]; totalPlates: number; countsAvailable: boolean }>(
    '/api/archive/parts/sections'
  );
  const systems = computed(() => browse.value?.systems ?? []);
  const searching = computed(() => Boolean(route.query.q));

  const parts = computed(() => data.value?.parts ?? []);
  const total = computed(() => data.value?.total ?? 0);
  const totalPages = computed(() => Math.min(200, Math.ceil(total.value / (data.value?.pageSize || 24))));

  function submitSearch() {
    router.push({ path: '/archive/parts', query: searchTerm.value ? { q: searchTerm.value } : {} });
  }
  function goToPage(next: number) {
    router.push({ path: '/archive/parts', query: { ...route.query, page: String(next) } });
  }

  const numberFormat = new Intl.NumberFormat('en-US');

  useHead({
    title: t('title'),
    meta: [{ key: 'description', name: 'description', content: t('description') }],
  });

  // The page takes ?q= and ?page=. Only `page` stays indexable — a canonical
  // for every search term would spray thin duplicates into the index.
  useFacetedSeo('/archive/parts');
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header class="mb-6">
      <h1 class="mb-2 text-3xl font-bold">{{ t('heading') }}</h1>
      <p class="text-base-content/70">{{ t('intro', { count: numberFormat.format(total) }) }}</p>
    </header>

    <form class="mb-6 flex flex-wrap gap-2" @submit.prevent="submitSearch">
      <label class="input input-bordered flex min-w-0 flex-1 items-center gap-2">
        <i class="fas fa-magnifying-glass text-base-content/50" />
        <input
          v-model="searchTerm"
          type="search"
          class="min-w-0 grow"
          :placeholder="t('search_placeholder')"
          :aria-label="t('search_label')"
        />
      </label>
      <button type="submit" class="btn btn-primary">{{ t('search_button') }}</button>
    </form>

    <!-- Browse. Shown until a search narrows things down. -->
    <section v-if="!searching && systems.length" class="mb-10 space-y-8">
      <div v-for="system in systems" :key="system.system">
        <h2 class="mb-3 flex flex-wrap items-baseline gap-x-3 text-xl font-bold">
          {{ system.system }}
          <span class="text-sm font-normal text-base-content/60">
            {{ t('system_meta', { plates: system.plateCount }) }}
            <template v-if="system.partCount !== null">
              · {{ t('system_parts', { parts: system.partCount }) }}</template
            >
          </span>
        </h2>

        <div v-for="section in system.sections" :key="section.section" class="mb-5">
          <h3 class="mb-2 text-sm font-semibold text-base-content/80">{{ section.section }}</h3>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <NuxtLink
              v-for="plate in section.plates"
              :key="plate.id"
              :to="`/archive/parts/diagrams/${plate.id}`"
              class="group block"
            >
              <div class="aspect-square overflow-hidden rounded-box border border-base-300 bg-white">
                <img
                  v-if="plate.hasImage"
                  :src="`/api/archive/parts/diagram-image?diagram=${plate.id}&size=thumb`"
                  :alt="t('plate_alt', { title: plate.title })"
                  class="h-full w-full object-contain transition-transform group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <div v-else class="flex h-full items-center justify-center text-base-content/30">
                  <i class="fas fa-image text-2xl" />
                </div>
              </div>
              <p class="mt-1 line-clamp-2 text-xs text-base-content/80 group-hover:underline">{{ plate.title }}</p>
              <p v-if="plate.parts !== null" class="text-xs text-base-content/50">
                {{ t('plate_parts', { count: plate.parts }) }}
              </p>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <div v-if="pending" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div v-else-if="error" class="alert alert-error">
      <i class="fas fa-triangle-exclamation" />
      <span>{{ t('load_error') }}</span>
    </div>

    <div v-else-if="parts.length === 0" class="py-16 text-center text-base-content/60">
      <i class="fas fa-magnifying-glass mb-3 block text-3xl" />
      <p>{{ t('no_results') }}</p>
    </div>

    <template v-else-if="searching || parts.length">
      <div class="overflow-x-auto rounded-box border border-base-300">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>{{ t('column_number') }}</th>
              <th>{{ t('column_description') }}</th>
              <th class="hidden sm:table-cell">{{ t('column_source') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="part in parts" :key="part.slug">
              <td class="whitespace-nowrap font-mono font-semibold">
                <NuxtLink :to="`/archive/parts/${part.slug}`" class="link link-primary">
                  {{ part.partNumber }}
                </NuxtLink>
              </td>
              <td class="min-w-0 max-w-md break-words">{{ part.description || '—' }}</td>
              <td class="hidden whitespace-nowrap text-sm text-base-content/60 sm:table-cell">
                {{ part.source || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="mt-6 flex items-center justify-center gap-2">
        <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="goToPage(page - 1)">
          <i class="fas fa-chevron-left" />
          {{ t('previous') }}
        </button>
        <span class="text-sm text-base-content/70">{{ t('page_of', { page, total: totalPages }) }}</span>
        <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">
          {{ t('next') }}
          <i class="fas fa-chevron-right" />
        </button>
      </div>
    </template>

    <p class="mt-8 text-xs text-base-content/50">{{ t('attribution') }}</p>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Part Numbers - Classic Mini DIY",
    "description": "Search Classic Mini part numbers, supersessions and what each part fits.",
    "heading": "Part Numbers",
    "intro": "Search {count} Classic Mini part numbers, what replaced them, and what they fit.",
    "search_placeholder": "Part number or description, e.g. 12G2994 or idler gear",
    "search_label": "Search part numbers",
    "search_button": "Search",
    "column_number": "Part number",
    "column_description": "Description",
    "column_source": "Source",
    "no_results": "No parts matched. Try a shorter fragment of the number, or fewer words.",
    "load_error": "The parts archive could not be loaded.",
    "previous": "Previous",
    "next": "Next",
    "page_of": "Page {page} of {total}",
    "attribution": "Part data is compiled from public retailer catalogues and credited to its source on each part page.",
    "system_meta": "{plates} plates",
    "system_parts": "{parts} parts",
    "plate_alt": "Parts diagram: {title}",
    "plate_parts": "{count} parts"
  },
  "es": {
    "title": "Números de pieza del Classic Mini - Classic Mini DIY",
    "description": "Busque números de pieza del Classic Mini, sustituciones y a qué modelo corresponde cada pieza.",
    "heading": "Números de pieza",
    "intro": "Busque {count} números de pieza del Classic Mini, sus reemplazos y su aplicación.",
    "search_placeholder": "Número de pieza o descripción, p. ej. 12G2994 o engranaje intermedio",
    "search_label": "Buscar números de pieza",
    "search_button": "Buscar",
    "column_number": "Número de pieza",
    "column_description": "Descripción",
    "column_source": "Fuente",
    "no_results": "Ninguna pieza coincide. Pruebe con un fragmento más corto del número o menos palabras.",
    "load_error": "No se pudo cargar el archivo de piezas.",
    "previous": "Anterior",
    "next": "Siguiente",
    "page_of": "Página {page} de {total}",
    "attribution": "Los datos de piezas provienen de catálogos públicos de minoristas y se acreditan a su fuente en cada página.",
    "system_meta": "{plates} láminas",
    "system_parts": "{parts} piezas",
    "plate_alt": "Despiece: {title}",
    "plate_parts": "{count} piezas"
  },
  "fr": {
    "title": "Références de pièces Classic Mini - Classic Mini DIY",
    "description": "Recherchez les références de pièces Classic Mini, les remplacements et la compatibilité.",
    "heading": "Références de pièces",
    "intro": "Recherchez {count} références de pièces Classic Mini, leurs remplacements et leur compatibilité.",
    "search_placeholder": "Référence ou description, par ex. 12G2994 ou pignon intermédiaire",
    "search_label": "Rechercher des références",
    "search_button": "Rechercher",
    "column_number": "Référence",
    "column_description": "Description",
    "column_source": "Source",
    "no_results": "Aucune pièce trouvée. Essayez un fragment plus court ou moins de mots.",
    "load_error": "Impossible de charger l'archive des pièces.",
    "previous": "Précédent",
    "next": "Suivant",
    "page_of": "Page {page} sur {total}",
    "attribution": "Les données proviennent de catalogues publics de revendeurs et sont créditées sur chaque page.",
    "system_meta": "{plates} planches",
    "system_parts": "{parts} pièces",
    "plate_alt": "Planche de pièces : {title}",
    "plate_parts": "{count} pièces"
  },
  "de": {
    "title": "Classic Mini Teilenummern - Classic Mini DIY",
    "description": "Suchen Sie Classic Mini Teilenummern, Nachfolger und Verwendung.",
    "heading": "Teilenummern",
    "intro": "Durchsuchen Sie {count} Classic Mini Teilenummern, ihre Nachfolger und ihre Verwendung.",
    "search_placeholder": "Teilenummer oder Beschreibung, z. B. 12G2994 oder Zwischenrad",
    "search_label": "Teilenummern suchen",
    "search_button": "Suchen",
    "column_number": "Teilenummer",
    "column_description": "Beschreibung",
    "column_source": "Quelle",
    "no_results": "Kein Teil gefunden. Versuchen Sie einen kürzeren Teil der Nummer oder weniger Wörter.",
    "load_error": "Das Teilearchiv konnte nicht geladen werden.",
    "previous": "Zurück",
    "next": "Weiter",
    "page_of": "Seite {page} von {total}",
    "attribution": "Teiledaten stammen aus öffentlichen Händlerkatalogen und werden auf jeder Seite der Quelle zugeordnet.",
    "system_meta": "{plates} Tafeln",
    "system_parts": "{parts} Teile",
    "plate_alt": "Teilediagramm: {title}",
    "plate_parts": "{count} Teile"
  },
  "it": {
    "title": "Codici ricambio Classic Mini - Classic Mini DIY",
    "description": "Cerca i codici ricambio Classic Mini, le sostituzioni e le applicazioni.",
    "heading": "Codici ricambio",
    "intro": "Cerca tra {count} codici ricambio Classic Mini, le sostituzioni e le applicazioni.",
    "search_placeholder": "Codice o descrizione, es. 12G2994 o ingranaggio folle",
    "search_label": "Cerca codici ricambio",
    "search_button": "Cerca",
    "column_number": "Codice",
    "column_description": "Descrizione",
    "column_source": "Fonte",
    "no_results": "Nessun ricambio trovato. Prova un frammento più corto o meno parole.",
    "load_error": "Impossibile caricare l'archivio ricambi.",
    "previous": "Precedente",
    "next": "Successivo",
    "page_of": "Pagina {page} di {total}",
    "attribution": "I dati provengono da cataloghi pubblici di rivenditori e sono attribuiti alla fonte su ogni pagina.",
    "system_meta": "{plates} tavole",
    "system_parts": "{parts} ricambi",
    "plate_alt": "Tavola ricambi: {title}",
    "plate_parts": "{count} ricambi"
  },
  "pt": {
    "title": "Números de peça do Classic Mini - Classic Mini DIY",
    "description": "Pesquise números de peça do Classic Mini, substituições e aplicações.",
    "heading": "Números de peça",
    "intro": "Pesquise {count} números de peça do Classic Mini, as suas substituições e aplicações.",
    "search_placeholder": "Número de peça ou descrição, ex. 12G2994 ou engrenagem intermédia",
    "search_label": "Pesquisar números de peça",
    "search_button": "Pesquisar",
    "column_number": "Número de peça",
    "column_description": "Descrição",
    "column_source": "Fonte",
    "no_results": "Nenhuma peça encontrada. Tente um fragmento mais curto ou menos palavras.",
    "load_error": "Não foi possível carregar o arquivo de peças.",
    "previous": "Anterior",
    "next": "Seguinte",
    "page_of": "Página {page} de {total}",
    "attribution": "Os dados provêm de catálogos públicos de retalhistas e são creditados à fonte em cada página.",
    "system_meta": "{plates} pranchas",
    "system_parts": "{parts} peças",
    "plate_alt": "Diagrama de peças: {title}",
    "plate_parts": "{count} peças"
  },
  "ru": {
    "title": "Номера деталей Classic Mini - Classic Mini DIY",
    "description": "Поиск номеров деталей Classic Mini, замен и применимости.",
    "heading": "Номера деталей",
    "intro": "Поиск по {count} номерам деталей Classic Mini, их заменам и применимости.",
    "search_placeholder": "Номер детали или описание, например 12G2994",
    "search_label": "Поиск номеров деталей",
    "search_button": "Найти",
    "column_number": "Номер детали",
    "column_description": "Описание",
    "column_source": "Источник",
    "no_results": "Ничего не найдено. Попробуйте более короткий фрагмент номера или меньше слов.",
    "load_error": "Не удалось загрузить архив деталей.",
    "previous": "Назад",
    "next": "Далее",
    "page_of": "Страница {page} из {total}",
    "attribution": "Данные собраны из публичных каталогов продавцов и указаны с источником на каждой странице.",
    "system_meta": "схем: {plates}",
    "system_parts": "деталей: {parts}",
    "plate_alt": "Схема деталей: {title}",
    "plate_parts": "деталей: {count}"
  },
  "ja": {
    "title": "クラシックミニ 部品番号 - Classic Mini DIY",
    "description": "クラシックミニの部品番号、後継品番、適合を検索できます。",
    "heading": "部品番号",
    "intro": "{count} 件のクラシックミニ部品番号、後継品番、適合を検索できます。",
    "search_placeholder": "部品番号または説明（例: 12G2994）",
    "search_label": "部品番号を検索",
    "search_button": "検索",
    "column_number": "部品番号",
    "column_description": "説明",
    "column_source": "出典",
    "no_results": "該当する部品がありません。番号を短くするか、語句を減らしてください。",
    "load_error": "部品アーカイブを読み込めませんでした。",
    "previous": "前へ",
    "next": "次へ",
    "page_of": "{total} ページ中 {page} ページ",
    "attribution": "部品データは公開されている販売店カタログをもとに、各ページで出典を明記しています。",
    "system_meta": "図版 {plates} 件",
    "system_parts": "部品 {parts} 件",
    "plate_alt": "部品図: {title}",
    "plate_parts": "部品 {count} 件"
  },
  "zh": {
    "title": "经典 Mini 零件号 - Classic Mini DIY",
    "description": "搜索经典 Mini 零件号、替代件及适用车型。",
    "heading": "零件号",
    "intro": "搜索 {count} 个经典 Mini 零件号、替代件及适用车型。",
    "search_placeholder": "零件号或描述，例如 12G2994",
    "search_label": "搜索零件号",
    "search_button": "搜索",
    "column_number": "零件号",
    "column_description": "描述",
    "column_source": "来源",
    "no_results": "未找到零件。请尝试更短的编号片段或更少的关键词。",
    "load_error": "无法加载零件档案。",
    "previous": "上一页",
    "next": "下一页",
    "page_of": "第 {page} 页，共 {total} 页",
    "attribution": "零件数据整理自公开的零售商目录，并在每个页面标注来源。",
    "system_meta": "{plates} 张图版",
    "system_parts": "{parts} 个零件",
    "plate_alt": "零件图：{title}",
    "plate_parts": "{count} 个零件"
  },
  "ko": {
    "title": "클래식 미니 부품 번호 - Classic Mini DIY",
    "description": "클래식 미니 부품 번호, 대체 부품 및 적용 차종을 검색하세요.",
    "heading": "부품 번호",
    "intro": "{count}개의 클래식 미니 부품 번호와 대체 부품, 적용 차종을 검색하세요.",
    "search_placeholder": "부품 번호 또는 설명, 예: 12G2994",
    "search_label": "부품 번호 검색",
    "search_button": "검색",
    "column_number": "부품 번호",
    "column_description": "설명",
    "column_source": "출처",
    "no_results": "일치하는 부품이 없습니다. 번호를 짧게 하거나 단어를 줄여보세요.",
    "load_error": "부품 아카이브를 불러오지 못했습니다.",
    "previous": "이전",
    "next": "다음",
    "page_of": "{total} 페이지 중 {page} 페이지",
    "attribution": "부품 데이터는 공개된 판매점 카탈로그에서 정리했으며 각 페이지에 출처를 표기합니다.",
    "system_meta": "도판 {plates}개",
    "system_parts": "부품 {parts}개",
    "plate_alt": "부품 도면: {title}",
    "plate_parts": "부품 {count}개"
  }
}
</i18n>
