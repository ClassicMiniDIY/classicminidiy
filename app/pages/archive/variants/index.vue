<script lang="ts" setup>
  /**
   * Model Variants archive — the index (design R1, "Registry home").
   *
   * Every variant ever built, grouped by UK mark with the overseas and
   * coachbuilt cars in a final group. Filters are structured facets straight
   * off the schema (marque, era, body, engine) and live in the URL, which is
   * why this route is SSR (`prerender: false` in nuxt.config): a prerendered
   * copy would be generated with an empty query and hydrate a filtered link
   * into the wrong list. See the `/archive/suppliers` note there.
   */
  import { HERO_TYPES } from '../../../../data/models/generic';
  import {
    MARK_NUMBERS,
    MARK_RANGES,
    MARQUE_LABELS,
    OVERSEAS_GROUP,
    matchesEveryWord,
    variantSearchWords,
    yearsLabel,
    type ModelVariantCard,
    type VariantBody,
    type VariantMarque,
  } from '../../../../data/models/variants';

  const { t } = useI18n();
  const { track, trackSearch } = useAnalytics();
  const { openWizard } = useContributeWizard();
  const route = useRoute();
  const router = useRouter();

  useFacetedSeo('/archive/variants', { indexableParams: [] });

  const { listVariants } = useModelVariants();
  const { data } = await listVariants();

  const total = computed(() => data.value?.facets.total ?? 0);

  // ---- Filters (URL-backed) -------------------------------------------------
  const param = (key: string): string => {
    const raw = route.query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' ? value : '';
  };
  const query = computed(() => param('q'));
  const marque = computed(() => param('marque'));
  const mark = computed(() => param('mark'));
  const body = computed(() => param('body'));
  const engine = computed(() => param('engine'));
  const limitedOnly = computed(() => param('limited') === '1');

  const setParam = (key: string, value: string | null) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(route.query)) {
      const s = Array.isArray(v) ? v[0] : v;
      if (typeof s === 'string' && s) next[k] = s;
    }
    if (value) next[key] = value;
    else delete next[key];
    router.replace({ query: next });
    if (key !== 'q') track('archive_filter_changed', { section: 'variants', filter: key, value: value ?? '' });
  };
  const clearFilters = () => router.replace({ query: {} });
  const hasFilters = computed(() =>
    Boolean(query.value || marque.value || mark.value || body.value || engine.value || limitedOnly.value)
  );

  // A debounced search box: typing rewrites ?q= without a navigation per key.
  const searchText = ref(query.value);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  watch(searchText, (value) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setParam('q', value.trim() || null), 250);
  });
  // Tracked after the route settles so the count is this query's, not the last one's.
  watch(query, (value) => {
    if (value) trackSearch('variants', value, filtered.value.length);
    // Compare trimmed: the URL never carries the trailing space the user is
    // mid-way through typing, and resetting the box would eat it.
    if (value !== searchText.value.trim()) searchText.value = value;
  });

  /** Word-prefix match, never substring — the same builder the API and MCP tool use. */
  // Built once per data load, not per keystroke: the same words the API matches on.
  const searchWords = computed(
    () => new Map((data.value?.variants ?? []).map((v) => [v.slug, variantSearchWords(v)] as const))
  );
  const matches = (v: ModelVariantCard) => matchesEveryWord(searchWords.value.get(v.slug) ?? [], query.value);

  const filtered = computed(() =>
    (data.value?.variants ?? []).filter((v) => {
      if (marque.value && v.marque !== marque.value) return false;
      if (mark.value && String(v.mark ?? OVERSEAS_GROUP) !== mark.value) return false;
      if (body.value && v.body_style !== body.value) return false;
      if (engine.value && String(v.engine_cc ?? '') !== engine.value) return false;
      if (limitedOnly.value && !v.is_limited_edition) return false;
      return matches(v);
    })
  );

  interface Group {
    key: string;
    label: string;
    items: ModelVariantCard[];
  }
  const groups = computed<Group[]>(() => {
    const out: Group[] = [];
    for (const n of MARK_NUMBERS) {
      const items = filtered.value.filter((v) => v.mark === n);
      if (items.length)
        out.push({
          key: String(n),
          label: t('group_mark', {
            roman: MARK_RANGES[n]!.roman,
            start: MARK_RANGES[n]!.start,
            end: MARK_RANGES[n]!.end,
          }),
          items,
        });
    }
    const overseas = filtered.value.filter((v) => v.mark === null);
    if (overseas.length) out.push({ key: OVERSEAS_GROUP, label: t('group_overseas'), items: overseas });
    return out;
  });

  const marqueOptions = computed(() =>
    (data.value?.facets.marques ?? [])
      .map((f) => ({ value: f.value, label: MARQUE_LABELS[f.value as VariantMarque] ?? f.value, count: f.count }))
      .sort((a, b) => b.count - a.count)
  );
  const bodyOptions = computed(() =>
    (data.value?.facets.bodies ?? []).map((f) => ({
      value: f.value,
      label: t(`labels.body.${f.value as VariantBody}`),
      count: f.count,
    }))
  );
  const engineOptions = computed(() => data.value?.facets.engines ?? []);

  const cardMeta = (v: ModelVariantCard) =>
    [
      yearsLabel(v.year_start, v.year_end),
      v.engine_cc ? `${v.engine_cc} cc` : '',
      t(`labels.body.${v.body_style}`),
      v.photo_count > 0 ? t('card.photos', { n: v.photo_count }) : t('card.no_photos'),
    ]
      .filter(Boolean)
      .join(' · ');

  /** Opens the wizard on "new variant", pre-filling the mark when launched from a group tile. */
  const suggestVariant = (groupKey?: string) => {
    track('contribute_cta_clicked', {
      type: 'variant',
      location: groupKey ? 'archive_variants_group' : 'archive_variants',
    });
    openWizard({
      kind: 'variant',
      origin: 'archive_variants',
      currentValues: groupKey && groupKey !== OVERSEAS_GROUP ? { mark: groupKey } : {},
    });
  };

  // ---- SEO ------------------------------------------------------------------
  const pageTitle = computed(() => t('title'));
  const pageDescription = computed(() => t('description', { count: total.value }));
  const shareImage = 'https://classicminidiy.s3.amazonaws.com/social-share/archive.png';

  useHead({
    title: pageTitle,
    meta: [
      { key: 'description', name: 'description', content: pageDescription },
      { name: 'keywords', content: t('keywords') },
    ],
    link: [{ rel: 'preconnect', href: 'https://classicminidiy.s3.amazonaws.com' }],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Classic Mini Model Variants Archive',
          description: pageDescription.value,
          url: 'https://www.classicminidiy.com/archive/variants',
          mainEntity: {
            '@type': 'ItemList',
            name: 'Classic Mini model variants 1959–2000',
            numberOfItems: total.value,
          },
          provider: { '@type': 'Organization', name: 'Classic Mini DIY', url: 'https://www.classicminidiy.com' },
        }),
      },
    ],
  });

  useSeoMeta({
    ogTitle: pageTitle,
    ogDescription: pageDescription,
    ogUrl: 'https://www.classicminidiy.com/archive/variants',
    ogImage: shareImage,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: pageTitle,
    twitterDescription: pageDescription,
    twitterImage: shareImage,
  });
</script>

<template>
  <div>
    <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
    <ArchiveSubnav active-key="variants" />
    <div class="container mx-auto px-4">
      <breadcrumb :page="t('breadcrumb_title')" class="my-6"></breadcrumb>

      <!-- Contribute banner -->
      <div class="card bg-base-100 shadow-sm border border-base-300 mb-6 bg-primary/5">
        <div class="card-body">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <i class="fad fa-hand-holding-heart text-xl text-primary"></i>
              <div>
                <p class="font-medium">{{ t('contribute_banner_title') }}</p>
                <p class="text-sm opacity-70">{{ t('contribute_banner_description') }}</p>
              </div>
            </div>
            <button type="button" class="btn btn-primary btn-outline btn-sm" @click="suggestVariant()">
              {{ t('contribute_banner_button') }}
            </button>
          </div>
        </div>
      </div>

      <PageIntro
        :eyebrow="t('eyebrow')"
        :title="t('main_heading')"
        :description="t('description_text', { count: total })"
        as="h2"
      />

      <!-- Filters -->
      <div class="mt-6 flex flex-wrap items-center gap-2">
        <label class="input input-bordered flex items-center gap-2 w-full sm:w-72">
          <i class="fas fa-magnifying-glass opacity-60" aria-hidden="true"></i>
          <input
            v-model="searchText"
            type="search"
            class="grow"
            :placeholder="t('filters.search_placeholder', { count: total })"
            :aria-label="t('filters.search_label')"
          />
        </label>
        <select
          class="select select-bordered w-auto"
          :aria-label="t('filters.marque')"
          @change="setParam('marque', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="" :selected="!marque">{{ t('filters.marque') }}</option>
          <option v-for="o in marqueOptions" :key="o.value" :value="o.value" :selected="o.value === marque">
            {{ o.label }} ({{ o.count }})
          </option>
        </select>
        <select
          class="select select-bordered w-auto"
          :aria-label="t('filters.era')"
          @change="setParam('mark', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="" :selected="!mark">{{ t('filters.era') }}</option>
          <option v-for="n in MARK_NUMBERS" :key="n" :value="String(n)" :selected="String(n) === mark">
            Mk {{ MARK_RANGES[n]!.roman }} · {{ MARK_RANGES[n]!.start }}–{{ MARK_RANGES[n]!.end }}
          </option>
          <option :value="OVERSEAS_GROUP" :selected="mark === OVERSEAS_GROUP">{{ t('group_overseas') }}</option>
        </select>
        <select
          class="select select-bordered w-auto"
          :aria-label="t('filters.body')"
          @change="setParam('body', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="" :selected="!body">{{ t('filters.body') }}</option>
          <option v-for="o in bodyOptions" :key="o.value" :value="o.value" :selected="o.value === body">
            {{ o.label }} ({{ o.count }})
          </option>
        </select>
        <select
          class="select select-bordered w-auto"
          :aria-label="t('filters.engine')"
          @change="setParam('engine', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="" :selected="!engine">{{ t('filters.engine') }}</option>
          <option
            v-for="o in engineOptions"
            :key="o.value"
            :value="String(o.value)"
            :selected="String(o.value) === engine"
          >
            {{ o.value }} cc ({{ o.count }})
          </option>
        </select>
        <label class="label cursor-pointer gap-2 px-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            :checked="limitedOnly"
            @change="setParam('limited', ($event.target as HTMLInputElement).checked ? '1' : null)"
          />
          <span class="label-text">{{ t('filters.limited') }}</span>
        </label>
        <button v-if="hasFilters" type="button" class="btn btn-ghost btn-sm" @click="clearFilters">
          <i class="fas fa-xmark" aria-hidden="true"></i> {{ t('filters.clear') }}
        </button>
        <div class="flex-1"></div>
        <button type="button" class="btn btn-outline btn-secondary btn-sm" @click="suggestVariant()">
          <i class="fas fa-plus" aria-hidden="true"></i> {{ t('missing_variant') }}
        </button>
      </div>

      <p class="mt-3 text-sm opacity-70" aria-live="polite">{{ t('result_count', { n: filtered.length, total }) }}</p>

      <!-- Groups -->
      <section v-for="group in groups" :key="group.key" class="mt-8">
        <p class="mb-3 text-xs font-bold tracking-[0.08em] uppercase opacity-60">{{ group.label }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="v in group.items"
            :key="v.slug"
            :to="`/archive/variants/${v.slug}`"
            class="card bg-base-100 border border-base-300 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
          >
            <figure v-if="v.photo_url" class="aspect-[16/10] bg-base-200 overflow-hidden m-0">
              <NuxtImg
                :src="v.photo_url"
                :alt="v.name"
                format="webp"
                loading="lazy"
                class="w-full h-full object-cover"
              />
            </figure>
            <div
              v-else
              class="aspect-[16/10] bg-base-200 flex flex-col items-center justify-center gap-1.5 text-center px-3"
            >
              <i class="fas fa-camera text-2xl text-secondary" aria-hidden="true"></i>
              <span class="text-xs font-semibold text-secondary">{{ t('card.missing_photos') }}</span>
            </div>
            <div class="card-body p-4">
              <div class="flex items-start gap-2">
                <h3 class="text-[15px] font-semibold leading-snug flex-1">{{ v.name }}</h3>
                <span
                  v-if="v.is_limited_edition"
                  class="badge badge-sm badge-secondary badge-outline whitespace-nowrap"
                  :title="t('card.limited')"
                  >{{ t('card.limited_short') }}</span
                >
              </div>
              <p class="text-xs opacity-70 m-0">{{ cardMeta(v) }}</p>
              <p class="text-[11px] font-semibold text-primary m-0">
                <i class="fas fa-box-archive" aria-hidden="true"></i>
                {{ v.spec_count >= 10 ? t('card.preserved') : t('card.specs_partial', { n: v.spec_count }) }}
              </p>
            </div>
          </NuxtLink>
          <button
            type="button"
            class="rounded-xl border border-dashed border-base-300 flex flex-col items-center justify-center gap-2 p-6 text-center opacity-80 hover:opacity-100 hover:border-secondary transition-colors min-h-40"
            @click="suggestVariant(group.key)"
          >
            <i class="fas fa-plus text-xl text-secondary" aria-hidden="true"></i>
            <span class="text-sm font-semibold">{{ t('submit_tile', { group: group.label }) }}</span>
            <span class="text-sm font-bold text-secondary">{{ t('submit_link') }}</span>
          </button>
        </div>
      </section>

      <div v-if="groups.length === 0" class="card bg-base-200 mt-8">
        <div class="card-body items-center text-center">
          <i class="fas fa-magnifying-glass text-3xl opacity-40" aria-hidden="true"></i>
          <h3 class="font-semibold">{{ t('empty_title') }}</h3>
          <p class="text-sm opacity-70">{{ t('empty_body') }}</p>
          <button type="button" class="btn btn-sm btn-ghost" @click="clearFilters">{{ t('filters.clear') }}</button>
        </div>
      </div>

      <footer class="bg-base-200 text-center p-6 rounded-lg mt-10">
        <h2 class="text-xl font-bold mb-2">{{ t('footer.title') }}</h2>
        <p class="pb-2">
          {{ t('footer.description') }}
          <i class="fad fa-tombstone" aria-hidden="true"></i> austinminiwebsearch.com
        </p>
        <p class="text-sm opacity-70 m-0">{{ t('footer.wayback') }}</p>
      </footer>
      <div class="divider my-4"></div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Model Variants: Every Mini Ever Built, With Specs",
    "description": "Structured factory specs for {count} Classic Mini variants, 1959–2000: engine, power, torque, gearing, wheels, weight, top speed, production numbers and colours. From the Austin Seven to the Cooper Sport.",
    "keywords": "Classic Mini models, Mini variants, Mini Cooper S specs, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, Mini limited editions, Mini production numbers",
    "hero_title": "Classic Mini Model Variants",
    "breadcrumb_title": "Model Variants",
    "eyebrow": "MODEL VARIANTS",
    "main_heading": "Every Mini ever built.",
    "description_text": "Structured specs for {count} factory variants, 1959–2000 — preserved from the austinminiwebsearch.com archive and kept current by owners like you.",
    "contribute_banner_title": "Know a variant, a spec, or a photo we're missing?",
    "contribute_banner_description": "Every correction is reviewed and credited to you on the page.",
    "contribute_banner_button": "Contribute",
    "filters": {
      "search_placeholder": "Filter {count} models…",
      "search_label": "Filter model variants",
      "marque": "Marque",
      "era": "Era",
      "body": "Body style",
      "engine": "Engine",
      "limited": "Limited editions only",
      "clear": "Clear filters"
    },
    "missing_variant": "Missing a variant?",
    "result_count": "{n} of {total} variants",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "OVERSEAS & COACHBUILT",
    "card": {
      "photos": "{n} photos",
      "no_photos": "0 photos",
      "missing_photos": "Missing photos — add yours",
      "preserved": "Full spec sheet",
      "specs_partial": "{n} of 12 specs",
      "limited": "Limited edition",
      "limited_short": "LE"
    },
    "submit_tile": "Know a {group} variant we're missing?",
    "submit_link": "Submit it →",
    "empty_title": "No variant matches those filters",
    "empty_body": "Try fewer words, or clear a filter. Overseas cars (Innocenti, Authi) carry no mark number.",
    "footer": {
      "title": "Preserved from",
      "description": "This archive was seeded from the now-defunct enthusiast site",
      "wayback": "Recovered from the Internet Archive's Wayback Machine (January 2023 capture). Photos are being recovered separately; specs are corrected by contributors."
    },
    "labels": {
      "body": {
        "saloon": "Saloon",
        "estate": "Estate",
        "van": "Van",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    }
  },
  "es": {
    "title": "Variantes del Classic Mini: Todos los Mini fabricados, con especificaciones",
    "description": "Especificaciones de fábrica estructuradas de {count} variantes del Classic Mini, 1959–2000: motor, potencia, par, desarrollo, llantas, peso, velocidad máxima, producción y colores. Del Austin Seven al Cooper Sport.",
    "keywords": "modelos Classic Mini, variantes Mini, especificaciones Mini Cooper S, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, ediciones limitadas Mini, cifras de producción Mini",
    "hero_title": "Variantes del Classic Mini",
    "breadcrumb_title": "Variantes de modelo",
    "eyebrow": "VARIANTES DE MODELO",
    "main_heading": "Todos los Mini jamás fabricados.",
    "description_text": "Especificaciones estructuradas de {count} variantes de fábrica, 1959–2000 — preservadas del archivo austinminiwebsearch.com y mantenidas al día por propietarios como tú.",
    "contribute_banner_title": "¿Conoces una variante, un dato o una foto que nos falta?",
    "contribute_banner_description": "Cada corrección se revisa y se te acredita en la página.",
    "contribute_banner_button": "Contribuir",
    "filters": {
      "search_placeholder": "Filtrar {count} modelos…",
      "search_label": "Filtrar variantes de modelo",
      "marque": "Marca",
      "era": "Época",
      "body": "Carrocería",
      "engine": "Motor",
      "limited": "Solo ediciones limitadas",
      "clear": "Borrar filtros"
    },
    "missing_variant": "¿Falta una variante?",
    "result_count": "{n} de {total} variantes",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "EXTRANJERO Y CARROCEROS",
    "card": {
      "photos": "{n} fotos",
      "no_photos": "0 fotos",
      "missing_photos": "Faltan fotos — añade las tuyas",
      "preserved": "Ficha completa",
      "specs_partial": "{n} de 12 datos",
      "limited": "Edición limitada",
      "limited_short": "EL"
    },
    "submit_tile": "¿Conoces una variante {group} que nos falta?",
    "submit_link": "Envíala →",
    "empty_title": "Ninguna variante coincide con esos filtros",
    "empty_body": "Prueba con menos palabras o quita un filtro. Los coches extranjeros (Innocenti, Authi) no tienen número de Mark.",
    "footer": {
      "title": "Preservado de",
      "description": "Este archivo se creó a partir del desaparecido sitio de aficionados",
      "wayback": "Recuperado de la Wayback Machine de Internet Archive (captura de enero de 2023). Las fotos se recuperan por separado; los datos los corrigen los colaboradores."
    },
    "labels": {
      "body": {
        "saloon": "Berlina",
        "estate": "Familiar",
        "van": "Furgoneta",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabrio"
      }
    }
  },
  "fr": {
    "title": "Variantes de la Classic Mini : toutes les Mini jamais produites, avec fiches techniques",
    "description": "Fiches techniques d'usine structurées pour {count} variantes de Classic Mini, 1959–2000 : moteur, puissance, couple, pont, jantes, poids, vitesse maxi, production et couleurs. De l'Austin Seven à la Cooper Sport.",
    "keywords": "modèles Classic Mini, variantes Mini, fiche technique Mini Cooper S, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, séries limitées Mini, chiffres de production Mini",
    "hero_title": "Variantes de la Classic Mini",
    "breadcrumb_title": "Variantes de modèle",
    "eyebrow": "VARIANTES DE MODÈLE",
    "main_heading": "Toutes les Mini jamais produites.",
    "description_text": "Fiches structurées pour {count} variantes d'usine, 1959–2000 — préservées de l'archive austinminiwebsearch.com et tenues à jour par des propriétaires comme vous.",
    "contribute_banner_title": "Vous connaissez une variante, une donnée ou une photo qui nous manque ?",
    "contribute_banner_description": "Chaque correction est relue et créditée à votre nom sur la page.",
    "contribute_banner_button": "Contribuer",
    "filters": {
      "search_placeholder": "Filtrer {count} modèles…",
      "search_label": "Filtrer les variantes",
      "marque": "Marque",
      "era": "Époque",
      "body": "Carrosserie",
      "engine": "Moteur",
      "limited": "Séries limitées uniquement",
      "clear": "Effacer les filtres"
    },
    "missing_variant": "Une variante manque ?",
    "result_count": "{n} sur {total} variantes",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "EXPORT ET CARROSSIERS",
    "card": {
      "photos": "{n} photos",
      "no_photos": "0 photo",
      "missing_photos": "Photos manquantes — ajoutez les vôtres",
      "preserved": "Fiche complète",
      "specs_partial": "{n} sur 12 données",
      "limited": "Série limitée",
      "limited_short": "SL"
    },
    "submit_tile": "Vous connaissez une variante {group} qui nous manque ?",
    "submit_link": "Proposez-la →",
    "empty_title": "Aucune variante ne correspond à ces filtres",
    "empty_body": "Essayez moins de mots ou retirez un filtre. Les voitures d'export (Innocenti, Authi) n'ont pas de numéro de Mark.",
    "footer": {
      "title": "Préservé depuis",
      "description": "Cette archive a été constituée à partir du site d'amateurs aujourd'hui disparu",
      "wayback": "Récupéré via la Wayback Machine d'Internet Archive (capture de janvier 2023). Les photos sont récupérées séparément ; les données sont corrigées par les contributeurs."
    },
    "labels": {
      "body": {
        "saloon": "Berline",
        "estate": "Break",
        "van": "Fourgonnette",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    }
  },
  "de": {
    "title": "Classic Mini Modellvarianten: Jeder je gebaute Mini, mit technischen Daten",
    "description": "Strukturierte Werksdaten für {count} Classic Mini Varianten, 1959–2000: Motor, Leistung, Drehmoment, Übersetzung, Räder, Gewicht, Höchstgeschwindigkeit, Stückzahlen und Farben. Vom Austin Seven bis zum Cooper Sport.",
    "keywords": "Classic Mini Modelle, Mini Varianten, Mini Cooper S technische Daten, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, Mini Sondermodelle, Mini Produktionszahlen",
    "hero_title": "Classic Mini Modellvarianten",
    "breadcrumb_title": "Modellvarianten",
    "eyebrow": "MODELLVARIANTEN",
    "main_heading": "Jeder Mini, der je gebaut wurde.",
    "description_text": "Strukturierte Daten für {count} Werksvarianten, 1959–2000 — bewahrt aus dem Archiv austinminiwebsearch.com und von Besitzern wie Ihnen aktuell gehalten.",
    "contribute_banner_title": "Kennen Sie eine Variante, einen Wert oder ein Foto, das uns fehlt?",
    "contribute_banner_description": "Jede Korrektur wird geprüft und Ihnen auf der Seite gutgeschrieben.",
    "contribute_banner_button": "Beitragen",
    "filters": {
      "search_placeholder": "{count} Modelle filtern…",
      "search_label": "Modellvarianten filtern",
      "marque": "Marke",
      "era": "Ära",
      "body": "Karosserie",
      "engine": "Motor",
      "limited": "Nur Sondermodelle",
      "clear": "Filter löschen"
    },
    "missing_variant": "Fehlt eine Variante?",
    "result_count": "{n} von {total} Varianten",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "ÜBERSEE & KAROSSERIEBAUER",
    "card": {
      "photos": "{n} Fotos",
      "no_photos": "0 Fotos",
      "missing_photos": "Fotos fehlen — fügen Sie Ihre hinzu",
      "preserved": "Vollständiges Datenblatt",
      "specs_partial": "{n} von 12 Werten",
      "limited": "Sondermodell",
      "limited_short": "SM"
    },
    "submit_tile": "Kennen Sie eine {group} Variante, die uns fehlt?",
    "submit_link": "Einreichen →",
    "empty_title": "Keine Variante passt zu diesen Filtern",
    "empty_body": "Versuchen Sie weniger Wörter oder entfernen Sie einen Filter. Überseefahrzeuge (Innocenti, Authi) haben keine Mark-Nummer.",
    "footer": {
      "title": "Bewahrt aus",
      "description": "Dieses Archiv wurde aus der inzwischen eingestellten Enthusiasten-Website übernommen",
      "wayback": "Wiederhergestellt aus der Wayback Machine des Internet Archive (Aufnahme Januar 2023). Fotos werden separat wiederhergestellt; die Daten werden von Beitragenden korrigiert."
    },
    "labels": {
      "body": {
        "saloon": "Limousine",
        "estate": "Kombi",
        "van": "Kastenwagen",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    }
  },
  "it": {
    "title": "Varianti della Classic Mini: tutte le Mini mai costruite, con schede tecniche",
    "description": "Schede tecniche di fabbrica strutturate per {count} varianti di Classic Mini, 1959–2000: motore, potenza, coppia, rapporto al ponte, cerchi, peso, velocità massima, produzione e colori. Dalla Austin Seven alla Cooper Sport.",
    "keywords": "modelli Classic Mini, varianti Mini, scheda tecnica Mini Cooper S, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, edizioni limitate Mini, numeri di produzione Mini",
    "hero_title": "Varianti della Classic Mini",
    "breadcrumb_title": "Varianti di modello",
    "eyebrow": "VARIANTI DI MODELLO",
    "main_heading": "Tutte le Mini mai costruite.",
    "description_text": "Schede strutturate per {count} varianti di fabbrica, 1959–2000 — preservate dall'archivio austinminiwebsearch.com e tenute aggiornate da proprietari come te.",
    "contribute_banner_title": "Conosci una variante, un dato o una foto che ci manca?",
    "contribute_banner_description": "Ogni correzione viene revisionata e accreditata a te sulla pagina.",
    "contribute_banner_button": "Contribuisci",
    "filters": {
      "search_placeholder": "Filtra {count} modelli…",
      "search_label": "Filtra le varianti",
      "marque": "Marca",
      "era": "Epoca",
      "body": "Carrozzeria",
      "engine": "Motore",
      "limited": "Solo edizioni limitate",
      "clear": "Azzera filtri"
    },
    "missing_variant": "Manca una variante?",
    "result_count": "{n} di {total} varianti",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "ESTERO E CARROZZIERI",
    "card": {
      "photos": "{n} foto",
      "no_photos": "0 foto",
      "missing_photos": "Foto mancanti — aggiungi le tue",
      "preserved": "Scheda completa",
      "specs_partial": "{n} di 12 dati",
      "limited": "Edizione limitata",
      "limited_short": "EL"
    },
    "submit_tile": "Conosci una variante {group} che ci manca?",
    "submit_link": "Inviala →",
    "empty_title": "Nessuna variante corrisponde a questi filtri",
    "empty_body": "Prova con meno parole o togli un filtro. Le auto estere (Innocenti, Authi) non hanno numero di Mark.",
    "footer": {
      "title": "Preservato da",
      "description": "Questo archivio è stato ricavato dal sito amatoriale ormai chiuso",
      "wayback": "Recuperato dalla Wayback Machine di Internet Archive (acquisizione di gennaio 2023). Le foto vengono recuperate a parte; i dati sono corretti dai contributori."
    },
    "labels": {
      "body": {
        "saloon": "Berlina",
        "estate": "Giardinetta",
        "van": "Furgone",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    }
  },
  "pt": {
    "title": "Variantes do Classic Mini: todos os Mini já construídos, com especificações",
    "description": "Especificações de fábrica estruturadas de {count} variantes do Classic Mini, 1959–2000: motor, potência, binário, relação final, jantes, peso, velocidade máxima, produção e cores. Do Austin Seven ao Cooper Sport.",
    "keywords": "modelos Classic Mini, variantes Mini, especificações Mini Cooper S, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, edições limitadas Mini, números de produção Mini",
    "hero_title": "Variantes do Classic Mini",
    "breadcrumb_title": "Variantes de modelo",
    "eyebrow": "VARIANTES DE MODELO",
    "main_heading": "Todos os Mini já construídos.",
    "description_text": "Especificações estruturadas de {count} variantes de fábrica, 1959–2000 — preservadas do arquivo austinminiwebsearch.com e mantidas atualizadas por proprietários como você.",
    "contribute_banner_title": "Conhece uma variante, um dado ou uma foto que nos falta?",
    "contribute_banner_description": "Cada correção é revista e creditada a si na página.",
    "contribute_banner_button": "Contribuir",
    "filters": {
      "search_placeholder": "Filtrar {count} modelos…",
      "search_label": "Filtrar variantes de modelo",
      "marque": "Marca",
      "era": "Época",
      "body": "Carroçaria",
      "engine": "Motor",
      "limited": "Apenas edições limitadas",
      "clear": "Limpar filtros"
    },
    "missing_variant": "Falta uma variante?",
    "result_count": "{n} de {total} variantes",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "ESTRANGEIRO E CARROÇADORES",
    "card": {
      "photos": "{n} fotos",
      "no_photos": "0 fotos",
      "missing_photos": "Faltam fotos — adicione as suas",
      "preserved": "Ficha completa",
      "specs_partial": "{n} de 12 dados",
      "limited": "Edição limitada",
      "limited_short": "EL"
    },
    "submit_tile": "Conhece uma variante {group} que nos falta?",
    "submit_link": "Envie-a →",
    "empty_title": "Nenhuma variante corresponde a esses filtros",
    "empty_body": "Tente menos palavras ou remova um filtro. Os carros estrangeiros (Innocenti, Authi) não têm número de Mark.",
    "footer": {
      "title": "Preservado de",
      "description": "Este arquivo foi criado a partir do já extinto site de entusiastas",
      "wayback": "Recuperado da Wayback Machine do Internet Archive (captura de janeiro de 2023). As fotos estão a ser recuperadas separadamente; os dados são corrigidos pelos contribuidores."
    },
    "labels": {
      "body": {
        "saloon": "Berlina",
        "estate": "Carrinha",
        "van": "Furgão",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    }
  },
  "ru": {
    "title": "Модификации Classic Mini: все выпущенные Mini с характеристиками",
    "description": "Структурированные заводские характеристики {count} модификаций Classic Mini, 1959–2000: двигатель, мощность, момент, главная передача, колёса, масса, максимальная скорость, тираж и цвета. От Austin Seven до Cooper Sport.",
    "keywords": "модели Classic Mini, модификации Mini, характеристики Mini Cooper S, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, лимитированные Mini, тираж Mini",
    "hero_title": "Модификации Classic Mini",
    "breadcrumb_title": "Модификации",
    "eyebrow": "МОДИФИКАЦИИ",
    "main_heading": "Все Mini, которые когда-либо выпускались.",
    "description_text": "Структурированные характеристики {count} заводских модификаций, 1959–2000 — сохранены из архива austinminiwebsearch.com и поддерживаются владельцами, такими как вы.",
    "contribute_banner_title": "Знаете модификацию, характеристику или фото, которых у нас нет?",
    "contribute_banner_description": "Каждое исправление проверяется и указывается на странице с вашим именем.",
    "contribute_banner_button": "Помочь",
    "filters": {
      "search_placeholder": "Фильтр по {count} моделям…",
      "search_label": "Фильтр модификаций",
      "marque": "Марка",
      "era": "Эпоха",
      "body": "Кузов",
      "engine": "Двигатель",
      "limited": "Только лимитированные",
      "clear": "Сбросить фильтры"
    },
    "missing_variant": "Не хватает модификации?",
    "result_count": "{n} из {total} модификаций",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "ЗАРУБЕЖНЫЕ И КУЗОВНЫЕ",
    "card": {
      "photos": "Фото: {n}",
      "no_photos": "Фото: 0",
      "missing_photos": "Нет фото — добавьте свои",
      "preserved": "Полная спецификация",
      "specs_partial": "{n} из 12 параметров",
      "limited": "Лимитированная серия",
      "limited_short": "ЛС"
    },
    "submit_tile": "Знаете модификацию {group}, которой у нас нет?",
    "submit_link": "Отправить →",
    "empty_title": "Ни одна модификация не подходит под фильтры",
    "empty_body": "Попробуйте меньше слов или снимите фильтр. У зарубежных машин (Innocenti, Authi) нет номера Mark.",
    "footer": {
      "title": "Сохранено из",
      "description": "Этот архив основан на закрывшемся сайте энтузиастов",
      "wayback": "Восстановлено из Wayback Machine Интернет-архива (снимок января 2023). Фото восстанавливаются отдельно; характеристики исправляют участники."
    },
    "labels": {
      "body": {
        "saloon": "Седан",
        "estate": "Универсал",
        "van": "Фургон",
        "pickup": "Пикап",
        "moke": "Moke",
        "cabriolet": "Кабриолет"
      }
    }
  },
  "ja": {
    "title": "クラシックMiniモデルバリエーション：生産された全Miniのスペック",
    "description": "1959〜2000年のクラシックMini {count}バリエーションの構造化された工場スペック：エンジン、出力、トルク、ファイナル、ホイール、重量、最高速度、生産台数、カラー。Austin SevenからCooper Sportまで。",
    "keywords": "クラシックMini モデル, Mini バリエーション, Mini Cooper S スペック, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, Mini 限定車, Mini 生産台数",
    "hero_title": "クラシックMiniモデルバリエーション",
    "breadcrumb_title": "モデルバリエーション",
    "eyebrow": "モデルバリエーション",
    "main_heading": "生産されたすべてのMini。",
    "description_text": "1959〜2000年の{count}種の工場バリエーションの構造化スペック — austinminiwebsearch.comのアーカイブから保存し、あなたのようなオーナーが最新に保っています。",
    "contribute_banner_title": "未掲載のバリエーション、スペック、写真をご存じですか？",
    "contribute_banner_description": "すべての修正は審査され、ページにあなたの名前で記載されます。",
    "contribute_banner_button": "投稿する",
    "filters": {
      "search_placeholder": "{count}モデルを絞り込む…",
      "search_label": "モデルバリエーションを絞り込む",
      "marque": "メーカー",
      "era": "年代",
      "body": "ボディ",
      "engine": "エンジン",
      "limited": "限定車のみ",
      "clear": "フィルターを解除"
    },
    "missing_variant": "バリエーションが足りない？",
    "result_count": "{total}件中{n}件",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "海外・コーチビルド",
    "card": {
      "photos": "写真{n}枚",
      "no_photos": "写真0枚",
      "missing_photos": "写真がありません — 追加してください",
      "preserved": "スペック完備",
      "specs_partial": "12項目中{n}項目",
      "limited": "限定車",
      "limited_short": "限定"
    },
    "submit_tile": "未掲載の{group}バリエーションをご存じですか？",
    "submit_link": "投稿する →",
    "empty_title": "条件に合うバリエーションがありません",
    "empty_body": "語数を減らすかフィルターを外してください。海外車（Innocenti、Authi）にはMark番号がありません。",
    "footer": {
      "title": "保存元",
      "description": "このアーカイブは、閉鎖された愛好家サイトから作成されました",
      "wayback": "Internet ArchiveのWayback Machine（2023年1月取得）から復元。写真は別途復元中、スペックは投稿者が修正しています。"
    },
    "labels": {
      "body": {
        "saloon": "サルーン",
        "estate": "エステート",
        "van": "バン",
        "pickup": "ピックアップ",
        "moke": "モーク",
        "cabriolet": "カブリオレ"
      }
    }
  },
  "zh": {
    "title": "经典Mini车型变体：所有生产过的Mini及其参数",
    "description": "1959–2000年{count}款经典Mini变体的结构化原厂参数：发动机、功率、扭矩、主减速比、车轮、重量、最高时速、产量和颜色。从Austin Seven到Cooper Sport。",
    "keywords": "经典Mini车型, Mini变体, Mini Cooper S参数, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, Mini限量版, Mini产量",
    "hero_title": "经典Mini车型变体",
    "breadcrumb_title": "车型变体",
    "eyebrow": "车型变体",
    "main_heading": "所有生产过的Mini。",
    "description_text": "1959–2000年{count}款原厂变体的结构化参数 — 保存自austinminiwebsearch.com档案，并由像你一样的车主持续更新。",
    "contribute_banner_title": "知道我们缺少的变体、参数或照片吗？",
    "contribute_banner_description": "每条修正都会经过审核，并在页面上署上你的名字。",
    "contribute_banner_button": "贡献",
    "filters": {
      "search_placeholder": "筛选{count}款车型…",
      "search_label": "筛选车型变体",
      "marque": "品牌",
      "era": "年代",
      "body": "车身",
      "engine": "发动机",
      "limited": "仅限量版",
      "clear": "清除筛选"
    },
    "missing_variant": "缺少某个变体？",
    "result_count": "{total}款中的{n}款",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "海外与改装厂车型",
    "card": {
      "photos": "{n}张照片",
      "no_photos": "0张照片",
      "missing_photos": "缺少照片 — 添加你的",
      "preserved": "参数完整",
      "specs_partial": "12项中的{n}项",
      "limited": "限量版",
      "limited_short": "限量"
    },
    "submit_tile": "知道我们缺少的{group}变体吗？",
    "submit_link": "提交 →",
    "empty_title": "没有符合筛选条件的变体",
    "empty_body": "尝试减少关键词或移除筛选。海外车型（Innocenti、Authi）没有Mark编号。",
    "footer": {
      "title": "保存自",
      "description": "本档案的数据来自已关闭的爱好者网站",
      "wayback": "从Internet Archive的Wayback Machine（2023年1月快照）恢复。照片正在单独恢复；参数由贡献者修正。"
    },
    "labels": {
      "body": {
        "saloon": "轿车",
        "estate": "旅行车",
        "van": "厢式车",
        "pickup": "皮卡",
        "moke": "Moke",
        "cabriolet": "敞篷车"
      }
    }
  },
  "ko": {
    "title": "클래식 Mini 모델 변형: 생산된 모든 Mini와 제원",
    "description": "1959–2000년 클래식 Mini {count}개 변형의 구조화된 공장 제원: 엔진, 출력, 토크, 종감속비, 휠, 중량, 최고 속도, 생산 대수, 색상. Austin Seven부터 Cooper Sport까지.",
    "keywords": "클래식 Mini 모델, Mini 변형, Mini Cooper S 제원, Mini 1275 GT, Mini Clubman, Innocenti Mini, Authi Mini, Mini 한정판, Mini 생산 대수",
    "hero_title": "클래식 Mini 모델 변형",
    "breadcrumb_title": "모델 변형",
    "eyebrow": "모델 변형",
    "main_heading": "생산된 모든 Mini.",
    "description_text": "1959–2000년 {count}개 공장 변형의 구조화된 제원 — austinminiwebsearch.com 아카이브에서 보존하고 여러분 같은 오너가 최신으로 유지합니다.",
    "contribute_banner_title": "누락된 변형, 제원, 사진을 알고 계신가요?",
    "contribute_banner_description": "모든 수정은 검토를 거쳐 페이지에 여러분의 이름으로 표시됩니다.",
    "contribute_banner_button": "기여하기",
    "filters": {
      "search_placeholder": "{count}개 모델 필터…",
      "search_label": "모델 변형 필터",
      "marque": "브랜드",
      "era": "시대",
      "body": "차체",
      "engine": "엔진",
      "limited": "한정판만",
      "clear": "필터 초기화"
    },
    "missing_variant": "변형이 빠져 있나요?",
    "result_count": "{total}개 중 {n}개",
    "group_mark": "MK {roman} · {start}–{end}",
    "group_overseas": "해외 및 코치빌드",
    "card": {
      "photos": "사진 {n}장",
      "no_photos": "사진 0장",
      "missing_photos": "사진 없음 — 추가해 주세요",
      "preserved": "제원 완비",
      "specs_partial": "12개 중 {n}개",
      "limited": "한정판",
      "limited_short": "한정"
    },
    "submit_tile": "누락된 {group} 변형을 알고 계신가요?",
    "submit_link": "제출하기 →",
    "empty_title": "조건에 맞는 변형이 없습니다",
    "empty_body": "단어를 줄이거나 필터를 해제해 보세요. 해외 차량(Innocenti, Authi)에는 Mark 번호가 없습니다.",
    "footer": {
      "title": "보존 출처",
      "description": "이 아카이브는 지금은 사라진 동호인 사이트에서 가져왔습니다",
      "wayback": "Internet Archive의 Wayback Machine(2023년 1월 캡처)에서 복원. 사진은 별도로 복원 중이며 제원은 기여자가 수정합니다."
    },
    "labels": {
      "body": {
        "saloon": "살룬",
        "estate": "에스테이트",
        "van": "밴",
        "pickup": "픽업",
        "moke": "Moke",
        "cabriolet": "카브리올레"
      }
    }
  }
}
</i18n>
