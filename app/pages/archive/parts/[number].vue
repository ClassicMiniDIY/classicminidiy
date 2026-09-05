<script lang="ts" setup>
  /**
   * /archive/parts/[number] — one part.
   *
   * The supersession chain is the reason this page exists: a superseded number
   * shown on its own is a confidently wrong answer, so `replacedBy` renders
   * first and loudly, above the description.
   */
  interface Related {
    partNumber: string;
    description: string | null;
    relation: string;
  }
  interface PartDetail {
    partNumber: string;
    slug: string;
    description: string | null;
    kind: string | null;
    system: string | null;
    category: string | null;
    sharesCalloutWith: { partNumber: string; slug: string; description: string | null }[];
    sharesCalloutWithTotal: number;
    notes: string | null;
    replacedBy: Related[];
    replaces: Related[];
    fits: string[];
    fitsTotal: number;
    appearsOn: {
      diagramId: string;
      title: string;
      section: string | null;
      calloutNumber: string;
      quantity: string | null;
      crop: {
        x: number;
        y: number;
        width: number;
        height: number;
        imageWidth: number;
        imageHeight: number;
        hotspot: { x: number; y: number; width: number; height: number };
      } | null;
    }[];
    appearsOnTotal: number;
    sourceUrls: { source: string; url: string }[];
    source: { name: string; domain: string } | null;
  }

  const { t } = useI18n();
  const route = useRoute();
  const number = computed(() => String(route.params.number ?? ''));

  const { data: part, error } = await useFetch<PartDetail>(`/api/archive/parts/${encodeURIComponent(number.value)}`);

  // Every dynamic archive route 404s on a miss rather than rendering an empty shell.
  if (error.value || !part.value) {
    throw createError({ statusCode: 404, statusMessage: 'Part not found', fatal: true });
  }

  const heading = computed(() => part.value?.partNumber ?? '');

  /** The plate views that can actually be drawn, best first. */
  const crops = computed(() => (part.value?.appearsOn ?? []).filter((a) => a.crop));

  /**
   * A crop is rendered by scaling the WHOLE plate inside a fixed square window
   * and offsetting it, rather than by generating a cropped image. No new
   * storage, no second request, and the browser already has the preview cached
   * from any other part on the same plate.
   */
  const CROP_BOX = 260;
  function cropStyle(crop: NonNullable<PartDetail['appearsOn'][number]['crop']>) {
    const scale = CROP_BOX / crop.width;
    return {
      width: `${crop.imageWidth * scale}px`,
      height: `${crop.imageHeight * scale}px`,
      transform: `translate(${-crop.x * scale}px, ${-crop.y * scale}px)`,
    };
  }
  /** The hotspot outline, in the same scaled space as the image above it. */
  function markerStyle(crop: NonNullable<PartDetail['appearsOn'][number]['crop']>) {
    const scale = CROP_BOX / crop.width;
    return {
      left: `${(crop.hotspot.x - crop.x) * scale}px`,
      top: `${(crop.hotspot.y - crop.y) * scale}px`,
      width: `${Math.max(crop.hotspot.width * scale, 10)}px`,
      height: `${Math.max(crop.hotspot.height * scale, 10)}px`,
    };
  }
  const summary = computed(() => part.value?.description || t('no_description'));

  useHead({
    title: t('title', { number: heading.value }),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: t('description', { number: heading.value, summary: summary.value }),
      },
    ],
    link: [{ rel: 'canonical', href: `https://www.classicminidiy.com/archive/parts/${part.value?.slug}` }],
  });
</script>

<template>
  <div v-if="part" class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <nav class="mb-4 text-sm">
      <NuxtLink to="/archive/parts" class="link link-hover">
        <i class="fas fa-chevron-left mr-1" />{{ t('back') }}
      </NuxtLink>
    </nav>

    <header class="mb-6">
      <div v-if="part.system || part.category" class="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span v-if="part.system" class="badge badge-neutral">{{ part.system }}</span>
        <span v-if="part.category" class="text-base-content/60">{{ part.category }}</span>
      </div>
      <h1 class="font-mono text-3xl font-bold">{{ part.partNumber }}</h1>
      <p class="mt-1 text-lg text-base-content/80">{{ summary }}</p>
    </header>

    <!-- Superseded: the single most important thing on the page. -->
    <div v-if="part.replacedBy.length" class="alert alert-warning mb-6">
      <i class="fas fa-arrow-right-arrow-left" />
      <div class="min-w-0">
        <p class="font-semibold">{{ t('superseded_heading') }}</p>
        <ul class="mt-1 space-y-1">
          <li v-for="r in part.replacedBy" :key="r.partNumber">
            <NuxtLink :to="`/archive/parts/${r.partNumber}`" class="link font-mono font-semibold">
              {{ r.partNumber }}
            </NuxtLink>
            <span v-if="r.description" class="text-sm"> — {{ r.description }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <section v-if="part.replaces.length" class="rounded-box border border-base-300 p-4">
        <h2 class="mb-2 font-semibold">{{ t('replaces_heading') }}</h2>
        <ul class="space-y-1">
          <li v-for="r in part.replaces" :key="r.partNumber">
            <NuxtLink :to="`/archive/parts/${r.partNumber}`" class="link font-mono">{{ r.partNumber }}</NuxtLink>
            <span v-if="r.description" class="text-sm text-base-content/70"> — {{ r.description }}</span>
          </li>
        </ul>
      </section>

      <section v-if="part.fits.length" class="rounded-box border border-base-300 p-4">
        <h2 class="mb-2 font-semibold">{{ t('fits_heading') }}</h2>
        <ul class="space-y-1 text-sm">
          <li v-for="fit in part.fits" :key="fit">{{ fit }}</li>
        </ul>
        <p v-if="part.fitsTotal > part.fits.length" class="mt-2 text-xs text-base-content/60">
          {{ t('fits_more', { count: part.fitsTotal - part.fits.length }) }}
        </p>
      </section>

      <section v-if="part.appearsOn.length" class="rounded-box border border-base-300 p-4 md:col-span-2">
        <h2 class="mb-3 font-semibold">{{ t('plates_heading') }}</h2>

        <!-- Where the part sits, cropped from the plate it appears on. -->
        <div v-if="crops.length" class="mb-4 flex flex-wrap gap-4">
          <NuxtLink
            v-for="plate in crops.slice(0, 3)"
            :key="`crop-${plate.diagramId}-${plate.calloutNumber}`"
            :to="`/archive/parts/diagrams/${plate.diagramId}`"
            class="group block"
          >
            <div
              class="relative overflow-hidden rounded-box border border-base-300 bg-white"
              :style="{ width: '260px', height: '260px' }"
            >
              <img
                :src="`/api/archive/parts/diagram-image?diagram=${plate.diagramId}&size=preview`"
                :alt="t('crop_alt', { title: plate.title, number: plate.calloutNumber })"
                class="max-w-none origin-top-left"
                :style="cropStyle(plate.crop!)"
                loading="lazy"
                decoding="async"
              />
              <span
                class="pointer-events-none absolute rounded-full ring-2 ring-amber-500 ring-offset-1"
                :style="markerStyle(plate.crop!)"
              />
            </div>
            <p class="mt-1 max-w-[260px] truncate text-xs text-base-content/70 group-hover:underline">
              {{ plate.title }} — {{ t('callout', { number: plate.calloutNumber }) }}
            </p>
          </NuxtLink>
        </div>

        <ul class="space-y-1 text-sm">
          <li v-for="plate in part.appearsOn" :key="`${plate.diagramId}-${plate.calloutNumber}`">
            <NuxtLink :to="`/archive/parts/diagrams/${plate.diagramId}`" class="link">
              {{ plate.title }}
            </NuxtLink>
            <span class="text-base-content/60">
              — {{ t('callout', { number: plate.calloutNumber })
              }}<template v-if="plate.quantity"> · {{ t('qty', { qty: plate.quantity }) }}</template>
            </span>
          </li>
        </ul>
      </section>

      <section v-if="part.sharesCalloutWith.length" class="rounded-box border border-base-300 p-4">
        <h2 class="mb-1 font-semibold">{{ t('siblings_heading') }}</h2>
        <p class="mb-2 text-xs text-base-content/60">{{ t('siblings_hint') }}</p>
        <ul class="space-y-1 text-sm">
          <li v-for="sib in part.sharesCalloutWith" :key="sib.slug">
            <NuxtLink :to="`/archive/parts/${sib.slug}`" class="link font-mono">{{ sib.partNumber }}</NuxtLink>
            <span v-if="sib.description" class="text-base-content/70"> — {{ sib.description }}</span>
          </li>
        </ul>
        <p v-if="part.sharesCalloutWithTotal > part.sharesCalloutWith.length" class="mt-2 text-xs text-base-content/60">
          {{ t('siblings_more', { count: part.sharesCalloutWithTotal - part.sharesCalloutWith.length }) }}
        </p>
      </section>

      <section v-if="part.sourceUrls.length" class="rounded-box border border-base-300 p-4">
        <h2 class="mb-2 font-semibold">{{ t('where_heading') }}</h2>
        <ul class="space-y-1 text-sm">
          <li v-for="link in part.sourceUrls" :key="link.url">
            <a :href="link.url" target="_blank" rel="noopener noreferrer nofollow" class="link link-primary">
              {{ link.source }}
              <i class="fas fa-arrow-up-right-from-square ml-1 text-xs" />
            </a>
          </li>
        </ul>
      </section>
    </div>

    <p v-if="part.source" class="mt-8 text-xs text-base-content/50">
      {{ t('attribution', { source: part.source.name }) }}
    </p>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "{number} - Classic Mini Part Number",
    "description": "{number}: {summary}. Supersessions, applicability and factory plate references.",
    "back": "All part numbers",
    "no_description": "No description recorded",
    "superseded_heading": "This part has been superseded. Use instead:",
    "replaces_heading": "Replaces",
    "fits_heading": "Fits",
    "fits_more": "and {count} more",
    "plates_heading": "Appears on",
    "callout": "callout {number}",
    "where_heading": "Where to find it",
    "attribution": "Part data from {source}.",
    "crop_alt": "Detail of {title} showing callout {number}",
    "qty": "qty {qty}",
    "siblings_heading": "Also at this position",
    "siblings_hint": "Other parts sharing the same numbered callout on the plate.",
    "siblings_more": "and {count} more"
  },
  "es": {
    "title": "{number} - Número de pieza del Classic Mini",
    "description": "{number}: {summary}. Sustituciones, aplicaciones y referencias de láminas de fábrica.",
    "back": "Todos los números de pieza",
    "no_description": "Sin descripción registrada",
    "superseded_heading": "Esta pieza ha sido sustituida. Use en su lugar:",
    "replaces_heading": "Sustituye a",
    "fits_heading": "Compatible con",
    "fits_more": "y {count} más",
    "plates_heading": "Aparece en",
    "callout": "referencia {number}",
    "where_heading": "Dónde encontrarla",
    "attribution": "Datos de pieza de {source}.",
    "crop_alt": "Detalle de {title} mostrando la referencia {number}",
    "qty": "cant. {qty}",
    "siblings_heading": "También en esta posición",
    "siblings_hint": "Otras piezas que comparten la misma referencia numerada en la lámina.",
    "siblings_more": "y {count} más"
  },
  "fr": {
    "title": "{number} - Référence de pièce Classic Mini",
    "description": "{number} : {summary}. Remplacements, compatibilité et références des planches d'usine.",
    "back": "Toutes les références",
    "no_description": "Aucune description enregistrée",
    "superseded_heading": "Cette pièce a été remplacée. Utilisez plutôt :",
    "replaces_heading": "Remplace",
    "fits_heading": "Compatible avec",
    "fits_more": "et {count} de plus",
    "plates_heading": "Apparaît sur",
    "callout": "repère {number}",
    "where_heading": "Où la trouver",
    "attribution": "Données de pièce fournies par {source}.",
    "crop_alt": "Détail de {title} montrant le repère {number}",
    "qty": "qté {qty}",
    "siblings_heading": "Également à ce repère",
    "siblings_hint": "Autres pièces partageant le même repère numéroté sur la planche.",
    "siblings_more": "et {count} de plus"
  },
  "de": {
    "title": "{number} - Classic Mini Teilenummer",
    "description": "{number}: {summary}. Nachfolger, Verwendung und Werkstafel-Referenzen.",
    "back": "Alle Teilenummern",
    "no_description": "Keine Beschreibung erfasst",
    "superseded_heading": "Dieses Teil wurde ersetzt. Stattdessen verwenden:",
    "replaces_heading": "Ersetzt",
    "fits_heading": "Passend für",
    "fits_more": "und {count} weitere",
    "plates_heading": "Erscheint auf",
    "callout": "Position {number}",
    "where_heading": "Wo erhältlich",
    "attribution": "Teiledaten von {source}.",
    "crop_alt": "Ausschnitt aus {title} mit Position {number}",
    "qty": "Menge {qty}",
    "siblings_heading": "Ebenfalls an dieser Position",
    "siblings_hint": "Weitere Teile mit derselben nummerierten Position auf der Tafel.",
    "siblings_more": "und {count} weitere"
  },
  "it": {
    "title": "{number} - Codice ricambio Classic Mini",
    "description": "{number}: {summary}. Sostituzioni, applicazioni e riferimenti alle tavole di fabbrica.",
    "back": "Tutti i codici ricambio",
    "no_description": "Nessuna descrizione registrata",
    "superseded_heading": "Questo ricambio è stato sostituito. Usare invece:",
    "replaces_heading": "Sostituisce",
    "fits_heading": "Compatibile con",
    "fits_more": "e altri {count}",
    "plates_heading": "Presente su",
    "callout": "riferimento {number}",
    "where_heading": "Dove trovarlo",
    "attribution": "Dati ricambio da {source}.",
    "crop_alt": "Dettaglio di {title} con il riferimento {number}",
    "qty": "qtà {qty}",
    "siblings_heading": "Anche in questa posizione",
    "siblings_hint": "Altri ricambi che condividono lo stesso riferimento numerato sulla tavola.",
    "siblings_more": "e altri {count}"
  },
  "pt": {
    "title": "{number} - Número de peça do Classic Mini",
    "description": "{number}: {summary}. Substituições, aplicações e referências das pranchas de fábrica.",
    "back": "Todos os números de peça",
    "no_description": "Sem descrição registada",
    "superseded_heading": "Esta peça foi substituída. Use em vez disso:",
    "replaces_heading": "Substitui",
    "fits_heading": "Compatível com",
    "fits_more": "e mais {count}",
    "plates_heading": "Aparece em",
    "callout": "referência {number}",
    "where_heading": "Onde encontrar",
    "attribution": "Dados de peça de {source}.",
    "crop_alt": "Detalhe de {title} mostrando a referência {number}",
    "qty": "qtd. {qty}",
    "siblings_heading": "Também nesta posição",
    "siblings_hint": "Outras peças que partilham a mesma referência numerada na prancha.",
    "siblings_more": "e mais {count}"
  },
  "ru": {
    "title": "{number} - Номер детали Classic Mini",
    "description": "{number}: {summary}. Замены, применимость и ссылки на заводские схемы.",
    "back": "Все номера деталей",
    "no_description": "Описание не записано",
    "superseded_heading": "Эта деталь заменена. Используйте:",
    "replaces_heading": "Заменяет",
    "fits_heading": "Подходит к",
    "fits_more": "и ещё {count}",
    "plates_heading": "Встречается на",
    "callout": "позиция {number}",
    "where_heading": "Где найти",
    "attribution": "Данные о детали предоставлены {source}.",
    "crop_alt": "Фрагмент {title} с позицией {number}",
    "qty": "кол-во {qty}",
    "siblings_heading": "Также в этой позиции",
    "siblings_hint": "Другие детали с тем же номером позиции на схеме.",
    "siblings_more": "и ещё {count}"
  },
  "ja": {
    "title": "{number} - クラシックミニ 部品番号",
    "description": "{number}: {summary}。後継品番、適合、工場図版の参照。",
    "back": "すべての部品番号",
    "no_description": "説明は登録されていません",
    "superseded_heading": "この部品は後継品に置き換わりました。代わりに使用:",
    "replaces_heading": "置き換え対象",
    "fits_heading": "適合",
    "fits_more": "他 {count} 件",
    "plates_heading": "掲載図版",
    "callout": "図版番号 {number}",
    "where_heading": "入手先",
    "attribution": "部品データ提供: {source}。",
    "crop_alt": "{title} の図番 {number} 付近",
    "qty": "数量 {qty}",
    "siblings_heading": "この図番の他の部品",
    "siblings_hint": "同じ図番を共有する他の部品です。",
    "siblings_more": "他 {count} 件"
  },
  "zh": {
    "title": "{number} - 经典 Mini 零件号",
    "description": "{number}：{summary}。替代件、适用车型及原厂图版索引。",
    "back": "全部零件号",
    "no_description": "未记录描述",
    "superseded_heading": "此零件已被替代。请改用：",
    "replaces_heading": "替代了",
    "fits_heading": "适用于",
    "fits_more": "以及另外 {count} 项",
    "plates_heading": "出现于",
    "callout": "图号 {number}",
    "where_heading": "何处购买",
    "attribution": "零件数据来自 {source}。",
    "crop_alt": "{title} 中图号 {number} 的局部",
    "qty": "数量 {qty}",
    "siblings_heading": "同一图号的其他零件",
    "siblings_hint": "在图版上共用同一编号的其他零件。",
    "siblings_more": "以及另外 {count} 项"
  },
  "ko": {
    "title": "{number} - 클래식 미니 부품 번호",
    "description": "{number}: {summary}. 대체 부품, 적용 차종 및 공장 도판 참조.",
    "back": "모든 부품 번호",
    "no_description": "설명이 기록되지 않았습니다",
    "superseded_heading": "이 부품은 대체되었습니다. 대신 사용하세요:",
    "replaces_heading": "대체 대상",
    "fits_heading": "적용",
    "fits_more": "외 {count}건",
    "plates_heading": "수록 도판",
    "callout": "도번 {number}",
    "where_heading": "구입처",
    "attribution": "부품 데이터 출처: {source}.",
    "crop_alt": "{title}의 도번 {number} 부분",
    "qty": "수량 {qty}",
    "siblings_heading": "같은 도번의 다른 부품",
    "siblings_hint": "도판에서 같은 번호를 공유하는 다른 부품입니다.",
    "siblings_more": "외 {count}건"
  }
}
</i18n>
