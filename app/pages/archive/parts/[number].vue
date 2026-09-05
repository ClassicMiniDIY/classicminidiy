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
    notes: string | null;
    replacedBy: Related[];
    replaces: Related[];
    fits: string[];
    fitsTotal: number;
    appearsOn: { diagramId: string; title: string; catalogueSection: string | null; calloutNumber: string }[];
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

      <section v-if="part.appearsOn.length" class="rounded-box border border-base-300 p-4">
        <h2 class="mb-2 font-semibold">{{ t('plates_heading') }}</h2>
        <ul class="space-y-1 text-sm">
          <li v-for="plate in part.appearsOn" :key="`${plate.diagramId}-${plate.calloutNumber}`">
            <NuxtLink :to="`/archive/parts/diagrams/${plate.diagramId}`" class="link">
              {{ plate.title }}
            </NuxtLink>
            <span class="text-base-content/60"> — {{ t('callout', { number: plate.calloutNumber }) }}</span>
          </li>
        </ul>
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
    "attribution": "Part data from {source}."
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
    "attribution": "Datos de pieza de {source}."
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
    "attribution": "Données de pièce fournies par {source}."
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
    "attribution": "Teiledaten von {source}."
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
    "attribution": "Dati ricambio da {source}."
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
    "attribution": "Dados de peça de {source}."
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
    "attribution": "Данные о детали предоставлены {source}."
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
    "attribution": "部品データ提供: {source}。"
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
    "attribution": "零件数据来自 {source}。"
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
    "attribution": "부품 데이터 출처: {source}."
  }
}
</i18n>
