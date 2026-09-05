<script lang="ts" setup>
  /**
   * /archive/parts/diagrams/[id] — a factory parts-list plate.
   *
   * The drawing is served from a private bucket through a signed-URL route, and
   * OUR OWN SVG overlay is drawn on top from stored hotspot geometry. The
   * source's interactive widget is never reused — only the coordinates, which
   * are in image-pixel space and map onto the `preview` render because every
   * size keeps the original aspect ratio.
   */
  interface Callout {
    calloutNumber: string;
    partNumber: string | null;
    partSlug: string | null;
    description: string | null;
    printedNumber: string | null;
    quantity: string | null;
    hotspot: Record<string, string> | null;
  }
  interface Diagram {
    id: string;
    title: string;
    catalogueSection: string | null;
    applicabilityText: string | null;
    imageWidth: number | null;
    imageHeight: number | null;
    hasImage: boolean;
    sourceUrl: string | null;
    source: { name: string; domain: string };
    callouts: Callout[];
  }

  const { t } = useI18n();
  const route = useRoute();
  const id = computed(() => String(route.params.id ?? ''));

  const { data: diagram, error } = await useFetch<Diagram>(
    `/api/archive/parts/diagrams/${encodeURIComponent(id.value)}`
  );

  if (error.value || !diagram.value) {
    throw createError({ statusCode: 404, statusMessage: 'Diagram not found', fatal: true });
  }

  const hovered = ref<string | null>(null);

  /**
   * Hotspot colours as SVG PRESENTATION ATTRIBUTES, not Tailwind classes.
   *
   * `class="fill-transparent"` looked right and rendered every hotspot as a
   * solid black blob over the artwork: the utility is never generated in this
   * build, so SVG fell back to its default fill of black. An attribute cannot
   * fail that way, and an unstyled shape here covers the drawing the page
   * exists to show.
   *
   * A warm amber rather than a theme colour: these drawings are black line art
   * on white, the overlay has to read against that in both light and dark mode,
   * and it must not be mistaken for part of the drawing.
   */
  function hotspotFill(calloutNumber: string): string {
    return hovered.value === calloutNumber ? 'rgba(245, 158, 11, 0.35)' : 'transparent';
  }
  function hotspotStroke(calloutNumber: string): string {
    return hovered.value === calloutNumber ? 'rgb(217, 119, 6)' : 'transparent';
  }

  /** Only callouts we can both place and link are drawn as hotspots. */
  const drawable = computed(() => (diagram.value?.callouts ?? []).filter((c) => c.hotspot && c.partSlug));

  // `preview` is 1600 wide against a ~1086 CSS-pixel column, so the drawing is
  // downscaled by the browser rather than upscaled. A 1000-wide preview was
  // being stretched, and it showed worst on the callout numbers a reader is
  // trying to read off the plate.
  const imageUrl = computed(() => `/api/archive/parts/diagram-image?diagram=${id.value}&size=preview`);
  const fullUrl = computed(() => `/api/archive/parts/diagram-image?diagram=${id.value}&size=full`);

  useHead({
    title: t('title', { title: diagram.value?.title ?? '' }),
    meta: [
      { key: 'description', name: 'description', content: t('description', { title: diagram.value?.title ?? '' }) },
    ],
    link: [{ rel: 'canonical', href: `https://www.classicminidiy.com/archive/parts/diagrams/${diagram.value?.id}` }],
  });
</script>

<template>
  <div v-if="diagram" class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <nav class="mb-4 text-sm">
      <NuxtLink to="/archive/parts" class="link link-hover">
        <i class="fas fa-chevron-left mr-1" />{{ t('back') }}
      </NuxtLink>
    </nav>

    <header class="mb-6">
      <h1 class="text-2xl font-bold sm:text-3xl">
        <span v-if="diagram.catalogueSection" class="font-mono text-base-content/60">
          {{ diagram.catalogueSection }}.
        </span>
        {{ diagram.title }}
      </h1>
      <p v-if="diagram.applicabilityText" class="mt-1 text-base-content/70">{{ diagram.applicabilityText }}</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <!-- The drawing, with our own overlay -->
      <figure v-if="diagram.hasImage && diagram.imageWidth && diagram.imageHeight" class="min-w-0">
        <div class="relative overflow-hidden rounded-box border border-base-300 bg-base-100">
          <img
            :src="imageUrl"
            :width="diagram.imageWidth"
            :height="diagram.imageHeight"
            :alt="t('image_alt', { title: diagram.title })"
            class="block h-auto w-full"
            loading="lazy"
            decoding="async"
          />
          <svg
            class="absolute inset-0 h-full w-full"
            :viewBox="`0 0 ${diagram.imageWidth} ${diagram.imageHeight}`"
            preserveAspectRatio="xMinYMin meet"
            role="presentation"
          >
            <NuxtLink
              v-for="callout in drawable"
              :key="`${callout.calloutNumber}-${callout.partSlug}`"
              :to="`/archive/parts/${callout.partSlug}`"
              custom
              #="{ navigate }"
            >
              <g
                class="cursor-pointer"
                @click="navigate"
                @mouseenter="hovered = callout.calloutNumber"
                @mouseleave="hovered = null"
              >
                <polygon
                  v-if="callout.hotspot?.points"
                  :points="callout.hotspot.points"
                  :fill="hotspotFill(callout.calloutNumber)"
                  :stroke="hotspotStroke(callout.calloutNumber)"
                  stroke-width="4"
                />
                <circle
                  v-else-if="callout.hotspot?.cx"
                  :cx="callout.hotspot.cx"
                  :cy="callout.hotspot.cy"
                  :r="callout.hotspot.r"
                  :fill="hotspotFill(callout.calloutNumber)"
                  :stroke="hotspotStroke(callout.calloutNumber)"
                  stroke-width="4"
                />
                <rect
                  v-else-if="callout.hotspot?.width"
                  :x="callout.hotspot.x"
                  :y="callout.hotspot.y"
                  :width="callout.hotspot.width"
                  :height="callout.hotspot.height"
                  :fill="hotspotFill(callout.calloutNumber)"
                  :stroke="hotspotStroke(callout.calloutNumber)"
                  stroke-width="4"
                />
              </g>
            </NuxtLink>
          </svg>
        </div>
        <figcaption class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/60">
          <a :href="fullUrl" target="_blank" rel="noopener" class="link">
            <i class="fas fa-magnifying-glass-plus mr-1" />{{ t('view_full') }}
          </a>
          <span>{{ t('hotspot_hint') }}</span>
        </figcaption>
      </figure>

      <div v-else class="rounded-box border border-base-300 p-6 text-center text-base-content/60">
        <i class="fas fa-image mb-2 block text-2xl" />
        <p>{{ t('no_drawing') }}</p>
        <a v-if="diagram.sourceUrl" :href="diagram.sourceUrl" target="_blank" rel="noopener nofollow" class="link">
          {{ t('view_at_source', { source: diagram.source.name }) }}
        </a>
      </div>

      <!-- The callout table -->
      <div class="min-w-0">
        <h2 class="mb-2 font-semibold">{{ t('callouts_heading', { count: diagram.callouts.length }) }}</h2>
        <div class="max-h-[70vh] overflow-y-auto rounded-box border border-base-300">
          <table class="table table-pin-rows table-sm">
            <thead>
              <tr>
                <th>{{ t('column_no') }}</th>
                <th>{{ t('column_part') }}</th>
                <th class="hidden sm:table-cell">{{ t('column_qty') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="callout in diagram.callouts"
                :key="`${callout.calloutNumber}-${callout.partSlug ?? 'x'}`"
                :class="hovered === callout.calloutNumber ? 'bg-primary/10' : ''"
                @mouseenter="hovered = callout.calloutNumber"
                @mouseleave="hovered = null"
              >
                <td class="font-mono font-semibold">{{ callout.calloutNumber }}</td>
                <td class="min-w-0">
                  <NuxtLink
                    v-if="callout.partSlug"
                    :to="`/archive/parts/${callout.partSlug}`"
                    class="link link-primary font-mono"
                  >
                    {{ callout.partNumber }}
                  </NuxtLink>
                  <span v-else class="font-mono text-base-content/60">{{ callout.printedNumber || '—' }}</span>
                  <div class="text-xs text-base-content/60">{{ callout.description || '' }}</div>
                </td>
                <td class="hidden sm:table-cell">{{ callout.quantity || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <p class="mt-8 text-xs text-base-content/50">
      {{ t('attribution', { source: diagram.source.name }) }}
      <a v-if="diagram.sourceUrl" :href="diagram.sourceUrl" target="_blank" rel="noopener nofollow" class="link">
        {{ t('view_at_source', { source: diagram.source.name }) }}
      </a>
    </p>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "{title} - Classic Mini Parts Plate",
    "description": "Factory parts-list plate {title}: numbered callouts linked to part numbers.",
    "back": "All part numbers",
    "image_alt": "Factory parts diagram: {title}",
    "view_full": "View full size",
    "hotspot_hint": "Click a part on the drawing, or a row in the table.",
    "no_drawing": "The drawing for this plate is not held here.",
    "view_at_source": "View at {source}",
    "callouts_heading": "Callouts ({count})",
    "column_no": "No.",
    "column_part": "Part",
    "column_qty": "Qty",
    "attribution": "Plate and part data from {source}."
  },
  "es": {
    "title": "{title} - Lámina de piezas del Classic Mini",
    "description": "Lámina de despiece de fábrica {title}: referencias numeradas enlazadas a números de pieza.",
    "back": "Todos los números de pieza",
    "image_alt": "Diagrama de piezas de fábrica: {title}",
    "view_full": "Ver a tamaño completo",
    "hotspot_hint": "Haga clic en una pieza del dibujo o en una fila de la tabla.",
    "no_drawing": "El dibujo de esta lámina no se conserva aquí.",
    "view_at_source": "Ver en {source}",
    "callouts_heading": "Referencias ({count})",
    "column_no": "N.º",
    "column_part": "Pieza",
    "column_qty": "Cant.",
    "attribution": "Datos de lámina y piezas de {source}."
  },
  "fr": {
    "title": "{title} - Planche de pièces Classic Mini",
    "description": "Planche d'usine {title} : repères numérotés liés aux références de pièces.",
    "back": "Toutes les références",
    "image_alt": "Planche de pièces d'usine : {title}",
    "view_full": "Voir en taille réelle",
    "hotspot_hint": "Cliquez sur une pièce du dessin ou sur une ligne du tableau.",
    "no_drawing": "Le dessin de cette planche n'est pas conservé ici.",
    "view_at_source": "Voir sur {source}",
    "callouts_heading": "Repères ({count})",
    "column_no": "N°",
    "column_part": "Pièce",
    "column_qty": "Qté",
    "attribution": "Données de planche et de pièces fournies par {source}."
  },
  "de": {
    "title": "{title} - Classic Mini Teiletafel",
    "description": "Werks-Teiletafel {title}: nummerierte Positionen mit Teilenummern verknüpft.",
    "back": "Alle Teilenummern",
    "image_alt": "Werks-Teilediagramm: {title}",
    "view_full": "In voller Größe ansehen",
    "hotspot_hint": "Klicken Sie auf ein Teil in der Zeichnung oder auf eine Tabellenzeile.",
    "no_drawing": "Die Zeichnung dieser Tafel liegt hier nicht vor.",
    "view_at_source": "Bei {source} ansehen",
    "callouts_heading": "Positionen ({count})",
    "column_no": "Nr.",
    "column_part": "Teil",
    "column_qty": "Menge",
    "attribution": "Tafel- und Teiledaten von {source}."
  },
  "it": {
    "title": "{title} - Tavola ricambi Classic Mini",
    "description": "Tavola ricambi di fabbrica {title}: riferimenti numerati collegati ai codici ricambio.",
    "back": "Tutti i codici ricambio",
    "image_alt": "Tavola ricambi di fabbrica: {title}",
    "view_full": "Vedi a dimensione piena",
    "hotspot_hint": "Fai clic su un ricambio nel disegno o su una riga della tabella.",
    "no_drawing": "Il disegno di questa tavola non è conservato qui.",
    "view_at_source": "Vedi su {source}",
    "callouts_heading": "Riferimenti ({count})",
    "column_no": "N.",
    "column_part": "Ricambio",
    "column_qty": "Qtà",
    "attribution": "Dati di tavola e ricambi da {source}."
  },
  "pt": {
    "title": "{title} - Prancha de peças do Classic Mini",
    "description": "Prancha de peças de fábrica {title}: referências numeradas ligadas a números de peça.",
    "back": "Todos os números de peça",
    "image_alt": "Diagrama de peças de fábrica: {title}",
    "view_full": "Ver em tamanho completo",
    "hotspot_hint": "Clique numa peça do desenho ou numa linha da tabela.",
    "no_drawing": "O desenho desta prancha não está guardado aqui.",
    "view_at_source": "Ver em {source}",
    "callouts_heading": "Referências ({count})",
    "column_no": "N.º",
    "column_part": "Peça",
    "column_qty": "Qtd.",
    "attribution": "Dados de prancha e peças de {source}."
  },
  "ru": {
    "title": "{title} - Схема деталей Classic Mini",
    "description": "Заводская схема деталей {title}: пронумерованные позиции со ссылками на номера деталей.",
    "back": "Все номера деталей",
    "image_alt": "Заводская схема деталей: {title}",
    "view_full": "Открыть в полном размере",
    "hotspot_hint": "Нажмите на деталь на схеме или на строку в таблице.",
    "no_drawing": "Изображение этой схемы здесь не хранится.",
    "view_at_source": "Посмотреть на {source}",
    "callouts_heading": "Позиции ({count})",
    "column_no": "№",
    "column_part": "Деталь",
    "column_qty": "Кол-во",
    "attribution": "Данные схемы и деталей предоставлены {source}."
  },
  "ja": {
    "title": "{title} - クラシックミニ 部品図版",
    "description": "工場部品図版 {title}: 番号付きの図番が部品番号にリンクしています。",
    "back": "すべての部品番号",
    "image_alt": "工場部品図: {title}",
    "view_full": "原寸で表示",
    "hotspot_hint": "図の部品、または表の行をクリックしてください。",
    "no_drawing": "この図版の画像はここにはありません。",
    "view_at_source": "{source} で見る",
    "callouts_heading": "図番 ({count})",
    "column_no": "番号",
    "column_part": "部品",
    "column_qty": "数量",
    "attribution": "図版および部品データ提供: {source}。"
  },
  "zh": {
    "title": "{title} - 经典 Mini 零件图版",
    "description": "原厂零件图版 {title}：编号图号与零件号相互链接。",
    "back": "全部零件号",
    "image_alt": "原厂零件图：{title}",
    "view_full": "查看原图",
    "hotspot_hint": "点击图中的零件，或表格中的一行。",
    "no_drawing": "此图版的图片未保存在此处。",
    "view_at_source": "在 {source} 查看",
    "callouts_heading": "图号（{count}）",
    "column_no": "编号",
    "column_part": "零件",
    "column_qty": "数量",
    "attribution": "图版及零件数据来自 {source}。"
  },
  "ko": {
    "title": "{title} - 클래식 미니 부품 도판",
    "description": "공장 부품 도판 {title}: 번호가 매겨진 도번이 부품 번호와 연결됩니다.",
    "back": "모든 부품 번호",
    "image_alt": "공장 부품 도면: {title}",
    "view_full": "원본 크기로 보기",
    "hotspot_hint": "도면의 부품 또는 표의 행을 클릭하세요.",
    "no_drawing": "이 도판의 이미지는 여기에 보관되어 있지 않습니다.",
    "view_at_source": "{source}에서 보기",
    "callouts_heading": "도번 ({count})",
    "column_no": "번호",
    "column_part": "부품",
    "column_qty": "수량",
    "attribution": "도판 및 부품 데이터 출처: {source}."
  }
}
</i18n>
