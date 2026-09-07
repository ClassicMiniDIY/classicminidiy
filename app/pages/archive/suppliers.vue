<script lang="ts" setup>
  /**
   * /archive/suppliers — where to buy Classic Mini parts, worldwide.
   *
   * A CURATED LIST, NOT A CRAWL, and the distinction is the point. The
   * part-number archive crawls three British shops, so a reader in Melbourne or
   * Osaka searching a part number today gets three British links and a customs
   * bill. Crawling seventy shops to fix that would mean seventy legality
   * reviews, seventy parsers and seventy crawl budgets, and the fourteenth UK
   * generalist would only add a buy link to parts that already have three.
   *
   * A list of shops answers "where can I buy Mini parts?" completely, costs no
   * traffic to anybody, and ships now. The crawl stays a deliberate, reviewable
   * set that answers the different question, "who has THIS part number?".
   *
   * Design: classicminidiy-supabase/docs/plans/2026-09-07-supplier-expansion.md.
   *
   * Static data, imported at build time — there is no server route and no
   * database read, because none of this changes without a commit.
   */
  import suppliersData from '~~/data/suppliers.json';
  import {
    SUPPLIER_FILTER_TAGS,
    SUPPLIER_GROUP_ORDER,
    flagFor,
    type Supplier,
    type SupplierGroup,
    type SupplierTag,
  } from '~~/data/models/suppliers';

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  const suppliers = suppliersData as Supplier[];

  /**
   * The filters live in the URL, not in a bare ref.
   *
   * Two reasons, and the first is a hard rule in this repo: a template must
   * never branch structurally on state the server cannot see. Query params are
   * on the request, so the filtered view renders identically on the server and
   * the client and there is no hydration repair. The second is that a reader who
   * has narrowed the list to "Japan, trim" can send that link to somebody.
   */
  const activeGroup = computed<SupplierGroup | null>(() => {
    const raw = typeof route.query.region === 'string' ? route.query.region : '';
    return (SUPPLIER_GROUP_ORDER as string[]).includes(raw) ? (raw as SupplierGroup) : null;
  });

  const activeTag = computed<SupplierTag | null>(() => {
    const raw = typeof route.query.tag === 'string' ? route.query.tag : '';
    return (SUPPLIER_FILTER_TAGS as string[]).includes(raw) ? (raw as SupplierTag) : null;
  });

  const search = ref(typeof route.query.q === 'string' ? route.query.q : '');

  const filtered = computed(() => {
    const needle = search.value.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (activeGroup.value && s.group !== activeGroup.value) return false;
      if (activeTag.value && !s.tags.includes(activeTag.value)) return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        (s.nameLocal ?? '').toLowerCase().includes(needle) ||
        s.speciality.toLowerCase().includes(needle) ||
        s.country.toLowerCase() === needle
      );
    });
  });

  /** The filtered list, grouped and in display order. Empty groups are dropped. */
  const grouped = computed(() =>
    SUPPLIER_GROUP_ORDER.map((group) => ({
      group,
      entries: filtered.value.filter((s) => s.group === group),
    })).filter((section) => section.entries.length > 0)
  );

  /**
   * How many suppliers each filter would leave.
   *
   * Counted against the OTHER active filters rather than against the whole list,
   * so a chip showing "12" means twelve results if you press it — not twelve
   * somewhere in the directory. A count that does not survive being clicked is a
   * worse guide than no count.
   */
  const tagCounts = computed(() => {
    const base = suppliers.filter((s) => !activeGroup.value || s.group === activeGroup.value);
    return Object.fromEntries(
      SUPPLIER_FILTER_TAGS.map((tag) => [tag, base.filter((s) => s.tags.includes(tag)).length])
    ) as Record<SupplierTag, number>;
  });

  const groupCounts = computed(() => {
    const base = suppliers.filter((s) => !activeTag.value || s.tags.includes(activeTag.value));
    return Object.fromEntries(
      SUPPLIER_GROUP_ORDER.map((group) => [group, base.filter((s) => s.group === group).length])
    ) as Record<SupplierGroup, number>;
  });

  const countryCount = computed(() => new Set(suppliers.map((s) => s.country)).size);

  function setQuery(patch: Record<string, string | undefined>): void {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...route.query, ...patch })) {
      if (typeof value === 'string' && value.length > 0) query[key] = value;
    }
    router.replace({ query });
  }

  function toggleGroup(group: SupplierGroup): void {
    setQuery({ region: activeGroup.value === group ? undefined : group });
  }

  function toggleTag(tag: SupplierTag): void {
    setQuery({ tag: activeTag.value === tag ? undefined : tag });
  }

  function clearFilters(): void {
    search.value = '';
    router.replace({ query: {} });
  }

  useHead({
    title: t('title'),
    meta: [{ key: 'description', name: 'description', content: t('description') }],
  });

  // ogUrl is set explicitly because the site default is the root, and unhead
  // warns — correctly — that a canonical of /archive/suppliers beside an og:url
  // of / describes two different pages to two different readers.
  //
  // NO ogImage. There is no share card for this page yet, and the two wrong
  // answers are both worse than none: an empty string, which unhead coerces to
  // `true` and nuxt-og-image then 500s the whole SSR render on, and an invented
  // S3 path, which would 404 silently in every social preview. Omitting it lets
  // the site default stand.
  useSeoMeta({
    ogTitle: t('heading'),
    ogDescription: t('description'),
    ogUrl: 'https://www.classicminidiy.com/archive/suppliers',
    ogType: 'website',
  });

  // Region and tag are filters, so they must not be indexable: a canonical per
  // permutation sprays near-duplicates of one list into the index. Nothing here
  // paginates, so nothing stays indexable but the bare path.
  useFacetedSeo('/archive/suppliers', { indexableParams: [] });
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header class="mb-6">
      <h1 class="mb-2 text-3xl font-bold">{{ t('heading') }}</h1>
      <p class="max-w-3xl text-base-content/70">
        {{ t('intro', { suppliers: suppliers.length, countries: countryCount }) }}
      </p>
    </header>

    <!--
      Said up front, not in a footnote. This is a list of shops and nothing more:
      it makes no claim about stock, price or fitment, and a shop appearing here
      is not a recommendation or a commercial arrangement.
    -->
    <div class="mb-6 alert">
      <i class="fas fa-circle-info" />
      <span>{{ t('disclaimer') }}</span>
    </div>

    <section class="mb-6 space-y-3" :aria-label="t('filters_label')">
      <label class="input input-bordered flex w-full items-center gap-2">
        <i class="fas fa-magnifying-glass text-base-content/50" />
        <input
          v-model="search"
          type="search"
          class="min-w-0 grow"
          :placeholder="t('search_placeholder')"
          :aria-label="t('search_label')"
        />
      </label>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="group in SUPPLIER_GROUP_ORDER"
          :key="group"
          type="button"
          class="btn btn-sm"
          :class="activeGroup === group ? 'btn-primary' : 'btn-outline'"
          :aria-pressed="activeGroup === group"
          @click="toggleGroup(group)"
        >
          {{ t(`group.${group}`) }}
          <span class="badge badge-sm">{{ groupCounts[group] }}</span>
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="tag in SUPPLIER_FILTER_TAGS"
          :key="tag"
          type="button"
          class="btn btn-xs"
          :class="activeTag === tag ? 'btn-secondary' : 'btn-ghost'"
          :aria-pressed="activeTag === tag"
          @click="toggleTag(tag)"
        >
          {{ t(`tag.${tag}`) }}
          <span class="opacity-60">{{ tagCounts[tag] }}</span>
        </button>
      </div>

      <div v-if="activeGroup || activeTag || search" class="flex items-center gap-3 text-sm">
        <span class="text-base-content/70">{{ t('showing', { count: filtered.length }) }}</span>
        <button type="button" class="btn btn-ghost btn-xs" @click="clearFilters">
          <i class="fas fa-xmark" />
          {{ t('clear') }}
        </button>
      </div>
    </section>

    <p v-if="filtered.length === 0" class="py-16 text-center text-base-content/60">
      <i class="fas fa-shop mb-3 block text-3xl" />
      {{ t('no_results') }}
    </p>

    <section v-for="section in grouped" :key="section.group" class="mb-10">
      <h2 class="mb-3 flex flex-wrap items-baseline gap-x-3 text-xl font-bold">
        {{ t(`group.${section.group}`) }}
        <span class="text-sm font-normal text-base-content/60">
          {{ t('group_count', { count: section.entries.length }) }}
        </span>
      </h2>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="supplier in section.entries"
          :id="supplier.id"
          :key="supplier.id"
          class="card card-compact border border-base-300 bg-base-100"
          :class="supplier.ours ? 'border-primary' : ''"
        >
          <div class="card-body">
            <h3 class="card-title text-base">
              <!--
                rel="noopener" because these open in a new tab, and "nofollow"
                because a directory of sixty-eight outbound links is exactly the
                shape that reads as link selling. The reader still gets the link.
              -->
              <a :href="supplier.url" target="_blank" rel="noopener nofollow" class="link link-hover break-words">
                {{ supplier.name }}
              </a>
              <span v-if="supplier.ours" class="badge badge-primary badge-sm">{{ t('ours') }}</span>
            </h3>

            <p v-if="supplier.nameLocal" class="-mt-1 text-sm text-base-content/60">{{ supplier.nameLocal }}</p>

            <p class="text-sm text-base-content/80">{{ supplier.speciality }}</p>

            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <span class="badge badge-ghost badge-sm gap-1">
                <span aria-hidden="true">{{ flagFor(supplier.country) }}</span>
                {{ t(`country.${supplier.country}`) }}
              </span>
              <!--
                Rendered only when the site SAYS it ships worldwide. Null means it
                did not say, which is the commonest case — showing "does not ship
                internationally" there would tell a reader in Japan that a shop
                which ships everywhere does not.
              -->
              <span v-if="supplier.shipsInternationally === true" class="badge badge-ghost badge-sm gap-1">
                <i class="fas fa-earth-americas" />
                {{ t('ships_worldwide') }}
              </span>
              <span v-for="tag in supplier.tags" :key="tag" class="badge badge-outline badge-sm">
                {{ t(`tag.${tag}`) }}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <footer class="mt-10 space-y-2 border-t border-base-300 pt-6 text-xs text-base-content/60">
      <p>{{ t('provenance') }}</p>
      <p>
        {{ t('corrections') }}
        <NuxtLink to="/archive/parts" class="link">{{ t('parts_link') }}</NuxtLink>
      </p>
    </footer>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Parts Suppliers Worldwide - Classic Mini DIY",
    "description": "A directory of classic Mini parts suppliers in the UK, United States, Australia, New Zealand, Europe and Japan.",
    "heading": "Where to Buy Mini Parts",
    "intro": "{suppliers} classic Mini parts suppliers across {countries} countries. Each one was checked by hand before it was listed.",
    "disclaimer": "A list of shops, nothing more. It does not say what any of them has in stock, what anything costs, or whether a part fits your car.",
    "filters_label": "Filter suppliers",
    "search_placeholder": "Shop name, speciality or country code",
    "search_label": "Search suppliers",
    "showing": "{count} shown",
    "clear": "Clear filters",
    "no_results": "No suppliers match those filters.",
    "group_count": "{count} suppliers",
    "ours": "Ours",
    "ships_worldwide": "Ships worldwide",
    "provenance": "Every entry was fetched and read before it was added. Shops that had closed, moved domain or turned out not to sell Mini parts were left out.",
    "corrections": "Something missing, moved or closed? Let us know. Looking for a specific part number instead?",
    "parts_link": "Search the part-number archive",
    "group": {
      "uk-generalist": "United Kingdom - full range",
      "uk-performance": "United Kingdom - performance and engineering",
      "uk-trim-body": "United Kingdom - trim and body",
      "us": "United States",
      "anz": "Australia and New Zealand",
      "europe": "Continental Europe",
      "japan": "Japan"
    },
    "tag": {
      "full-range": "Full range",
      "heritage": "Heritage",
      "engine": "Engine",
      "transmission": "Transmission",
      "suspension-brakes": "Suspension and brakes",
      "electrical": "Electrical",
      "body-panels": "Body and panels",
      "trim-interior": "Trim and interior",
      "wheels-tyres": "Wheels and tyres",
      "performance": "Performance",
      "restoration": "Restoration",
      "used-parts": "Used parts",
      "services": "Services"
    },
    "country": {
      "GB": "United Kingdom",
      "US": "United States",
      "AU": "Australia",
      "NZ": "New Zealand",
      "JP": "Japan",
      "DE": "Germany",
      "NL": "Netherlands",
      "FR": "France",
      "ES": "Spain",
      "BE": "Belgium",
      "CH": "Switzerland",
      "IE": "Ireland"
    }
  },
  "es": {
    "title": "Proveedores de piezas del Classic Mini en todo el mundo - Classic Mini DIY",
    "description": "Directorio de proveedores de piezas del Classic Mini en el Reino Unido, Estados Unidos, Australia, Nueva Zelanda, Europa y Japón.",
    "heading": "Dónde comprar piezas de Mini",
    "intro": "{suppliers} proveedores de piezas del Classic Mini en {countries} países. Cada uno fue comprobado a mano antes de incluirlo.",
    "disclaimer": "Es una lista de tiendas, nada más. No indica el stock de ninguna de ellas, ni los precios, ni si una pieza encaja en su coche.",
    "filters_label": "Filtrar proveedores",
    "search_placeholder": "Nombre, especialidad o código de país",
    "search_label": "Buscar proveedores",
    "showing": "{count} mostrados",
    "clear": "Borrar filtros",
    "no_results": "Ningún proveedor coincide con esos filtros.",
    "group_count": "{count} proveedores",
    "ours": "Nuestra",
    "ships_worldwide": "Envía a todo el mundo",
    "provenance": "Cada entrada fue consultada y leída antes de añadirla. Se excluyeron las tiendas cerradas, con dominio cambiado o que no venden piezas de Mini.",
    "corrections": "¿Falta alguna, ha cambiado o ha cerrado? Díganoslo. ¿Busca un número de pieza concreto?",
    "parts_link": "Buscar en el archivo de números de pieza",
    "group": {
      "uk-generalist": "Reino Unido - gama completa",
      "uk-performance": "Reino Unido - rendimiento e ingeniería",
      "uk-trim-body": "Reino Unido - tapicería y carrocería",
      "us": "Estados Unidos",
      "anz": "Australia y Nueva Zelanda",
      "europe": "Europa continental",
      "japan": "Japón"
    },
    "tag": {
      "full-range": "Gama completa",
      "heritage": "Original",
      "engine": "Motor",
      "transmission": "Transmisión",
      "suspension-brakes": "Suspensión y frenos",
      "electrical": "Eléctrico",
      "body-panels": "Carrocería y paneles",
      "trim-interior": "Tapicería e interior",
      "wheels-tyres": "Llantas y neumáticos",
      "performance": "Rendimiento",
      "restoration": "Restauración",
      "used-parts": "Piezas usadas",
      "services": "Servicios"
    },
    "country": {
      "GB": "Reino Unido",
      "US": "Estados Unidos",
      "AU": "Australia",
      "NZ": "Nueva Zelanda",
      "JP": "Japón",
      "DE": "Alemania",
      "NL": "Países Bajos",
      "FR": "Francia",
      "ES": "España",
      "BE": "Bélgica",
      "CH": "Suiza",
      "IE": "Irlanda"
    }
  },
  "fr": {
    "title": "Fournisseurs de pièces Classic Mini dans le monde - Classic Mini DIY",
    "description": "Annuaire des fournisseurs de pièces Classic Mini au Royaume-Uni, aux États-Unis, en Australie, en Nouvelle-Zélande, en Europe et au Japon.",
    "heading": "Où acheter des pièces de Mini",
    "intro": "{suppliers} fournisseurs de pièces Classic Mini dans {countries} pays. Chacun a été vérifié à la main avant d'être répertorié.",
    "disclaimer": "Une liste de boutiques, rien de plus. Elle n'indique ni les stocks, ni les prix, ni si une pièce convient à votre voiture.",
    "filters_label": "Filtrer les fournisseurs",
    "search_placeholder": "Nom, spécialité ou code pays",
    "search_label": "Rechercher un fournisseur",
    "showing": "{count} affichés",
    "clear": "Effacer les filtres",
    "no_results": "Aucun fournisseur ne correspond à ces filtres.",
    "group_count": "{count} fournisseurs",
    "ours": "Le nôtre",
    "ships_worldwide": "Expédie dans le monde entier",
    "provenance": "Chaque entrée a été consultée et lue avant d'être ajoutée. Les boutiques fermées, ayant changé de domaine ou ne vendant pas de pièces Mini ont été écartées.",
    "corrections": "Un manque, un déménagement, une fermeture ? Dites-le-nous. Vous cherchez plutôt une référence précise ?",
    "parts_link": "Rechercher dans les références de pièces",
    "group": {
      "uk-generalist": "Royaume-Uni - gamme complète",
      "uk-performance": "Royaume-Uni - performance et ingénierie",
      "uk-trim-body": "Royaume-Uni - sellerie et carrosserie",
      "us": "États-Unis",
      "anz": "Australie et Nouvelle-Zélande",
      "europe": "Europe continentale",
      "japan": "Japon"
    },
    "tag": {
      "full-range": "Gamme complète",
      "heritage": "Origine",
      "engine": "Moteur",
      "transmission": "Transmission",
      "suspension-brakes": "Suspension et freins",
      "electrical": "Électricité",
      "body-panels": "Carrosserie et panneaux",
      "trim-interior": "Sellerie et intérieur",
      "wheels-tyres": "Jantes et pneus",
      "performance": "Performance",
      "restoration": "Restauration",
      "used-parts": "Pièces d'occasion",
      "services": "Services"
    },
    "country": {
      "GB": "Royaume-Uni",
      "US": "États-Unis",
      "AU": "Australie",
      "NZ": "Nouvelle-Zélande",
      "JP": "Japon",
      "DE": "Allemagne",
      "NL": "Pays-Bas",
      "FR": "France",
      "ES": "Espagne",
      "BE": "Belgique",
      "CH": "Suisse",
      "IE": "Irlande"
    }
  },
  "de": {
    "title": "Classic Mini Teilehändler weltweit - Classic Mini DIY",
    "description": "Ein Verzeichnis von Classic Mini Teilehändlern in Großbritannien, den USA, Australien, Neuseeland, Europa und Japan.",
    "heading": "Wo man Mini-Teile kauft",
    "intro": "{suppliers} Classic Mini Teilehändler in {countries} Ländern. Jeder wurde vor der Aufnahme von Hand geprüft.",
    "disclaimer": "Eine Liste von Händlern, mehr nicht. Sie sagt nichts über Lagerbestand, Preise oder darüber, ob ein Teil zu Ihrem Auto passt.",
    "filters_label": "Händler filtern",
    "search_placeholder": "Name, Spezialgebiet oder Ländercode",
    "search_label": "Händler suchen",
    "showing": "{count} angezeigt",
    "clear": "Filter zurücksetzen",
    "no_results": "Kein Händler passt zu diesen Filtern.",
    "group_count": "{count} Händler",
    "ours": "Unser",
    "ships_worldwide": "Weltweiter Versand",
    "provenance": "Jeder Eintrag wurde vor der Aufnahme abgerufen und gelesen. Geschlossene Händler, Domainwechsel und Anbieter ohne Mini-Teile blieben außen vor.",
    "corrections": "Fehlt etwas, ist umgezogen oder geschlossen? Sagen Sie uns Bescheid. Suchen Sie stattdessen eine Teilenummer?",
    "parts_link": "Das Teilenummernarchiv durchsuchen",
    "group": {
      "uk-generalist": "Großbritannien - Vollsortiment",
      "uk-performance": "Großbritannien - Leistung und Technik",
      "uk-trim-body": "Großbritannien - Innenausstattung und Karosserie",
      "us": "Vereinigte Staaten",
      "anz": "Australien und Neuseeland",
      "europe": "Kontinentaleuropa",
      "japan": "Japan"
    },
    "tag": {
      "full-range": "Vollsortiment",
      "heritage": "Original",
      "engine": "Motor",
      "transmission": "Getriebe",
      "suspension-brakes": "Fahrwerk und Bremsen",
      "electrical": "Elektrik",
      "body-panels": "Karosserie und Bleche",
      "trim-interior": "Innenausstattung",
      "wheels-tyres": "Räder und Reifen",
      "performance": "Leistung",
      "restoration": "Restaurierung",
      "used-parts": "Gebrauchtteile",
      "services": "Dienstleistungen"
    },
    "country": {
      "GB": "Großbritannien",
      "US": "Vereinigte Staaten",
      "AU": "Australien",
      "NZ": "Neuseeland",
      "JP": "Japan",
      "DE": "Deutschland",
      "NL": "Niederlande",
      "FR": "Frankreich",
      "ES": "Spanien",
      "BE": "Belgien",
      "CH": "Schweiz",
      "IE": "Irland"
    }
  },
  "it": {
    "title": "Fornitori di ricambi Classic Mini nel mondo - Classic Mini DIY",
    "description": "Un elenco di fornitori di ricambi per Classic Mini nel Regno Unito, negli Stati Uniti, in Australia, Nuova Zelanda, Europa e Giappone.",
    "heading": "Dove comprare ricambi Mini",
    "intro": "{suppliers} fornitori di ricambi Classic Mini in {countries} paesi. Ognuno è stato verificato a mano prima di essere inserito.",
    "disclaimer": "Un elenco di negozi, nulla di più. Non indica le disponibilità, i prezzi, né se un pezzo si adatta alla vostra auto.",
    "filters_label": "Filtra i fornitori",
    "search_placeholder": "Nome, specialità o codice paese",
    "search_label": "Cerca fornitori",
    "showing": "{count} mostrati",
    "clear": "Azzera i filtri",
    "no_results": "Nessun fornitore corrisponde a questi filtri.",
    "group_count": "{count} fornitori",
    "ours": "Nostro",
    "ships_worldwide": "Spedisce in tutto il mondo",
    "provenance": "Ogni voce è stata consultata e letta prima di essere aggiunta. Sono stati esclusi i negozi chiusi, quelli che hanno cambiato dominio e quelli che non vendono ricambi Mini.",
    "corrections": "Manca qualcosa, si è spostato o ha chiuso? Faccelo sapere. Cercate invece un numero di ricambio?",
    "parts_link": "Cerca nell'archivio dei numeri di ricambio",
    "group": {
      "uk-generalist": "Regno Unito - gamma completa",
      "uk-performance": "Regno Unito - prestazioni e meccanica",
      "uk-trim-body": "Regno Unito - interni e carrozzeria",
      "us": "Stati Uniti",
      "anz": "Australia e Nuova Zelanda",
      "europe": "Europa continentale",
      "japan": "Giappone"
    },
    "tag": {
      "full-range": "Gamma completa",
      "heritage": "Originale",
      "engine": "Motore",
      "transmission": "Trasmissione",
      "suspension-brakes": "Sospensioni e freni",
      "electrical": "Impianto elettrico",
      "body-panels": "Carrozzeria e lamierati",
      "trim-interior": "Interni e rivestimenti",
      "wheels-tyres": "Cerchi e pneumatici",
      "performance": "Prestazioni",
      "restoration": "Restauro",
      "used-parts": "Ricambi usati",
      "services": "Servizi"
    },
    "country": {
      "GB": "Regno Unito",
      "US": "Stati Uniti",
      "AU": "Australia",
      "NZ": "Nuova Zelanda",
      "JP": "Giappone",
      "DE": "Germania",
      "NL": "Paesi Bassi",
      "FR": "Francia",
      "ES": "Spagna",
      "BE": "Belgio",
      "CH": "Svizzera",
      "IE": "Irlanda"
    }
  },
  "pt": {
    "title": "Fornecedores de peças Classic Mini no mundo - Classic Mini DIY",
    "description": "Um diretório de fornecedores de peças Classic Mini no Reino Unido, Estados Unidos, Austrália, Nova Zelândia, Europa e Japão.",
    "heading": "Onde comprar peças de Mini",
    "intro": "{suppliers} fornecedores de peças Classic Mini em {countries} países. Cada um foi verificado à mão antes de ser listado.",
    "disclaimer": "Uma lista de lojas, nada mais. Não indica o stock de nenhuma delas, os preços, nem se uma peça serve no seu carro.",
    "filters_label": "Filtrar fornecedores",
    "search_placeholder": "Nome, especialidade ou código do país",
    "search_label": "Pesquisar fornecedores",
    "showing": "{count} mostrados",
    "clear": "Limpar filtros",
    "no_results": "Nenhum fornecedor corresponde a esses filtros.",
    "group_count": "{count} fornecedores",
    "ours": "Nosso",
    "ships_worldwide": "Envia para todo o mundo",
    "provenance": "Cada entrada foi consultada e lida antes de ser adicionada. Lojas encerradas, com domínio alterado ou que não vendem peças de Mini ficaram de fora.",
    "corrections": "Falta alguma, mudou ou fechou? Diga-nos. Procura antes um número de peça?",
    "parts_link": "Pesquisar o arquivo de números de peça",
    "group": {
      "uk-generalist": "Reino Unido - gama completa",
      "uk-performance": "Reino Unido - desempenho e engenharia",
      "uk-trim-body": "Reino Unido - estofos e carroçaria",
      "us": "Estados Unidos",
      "anz": "Austrália e Nova Zelândia",
      "europe": "Europa continental",
      "japan": "Japão"
    },
    "tag": {
      "full-range": "Gama completa",
      "heritage": "Original",
      "engine": "Motor",
      "transmission": "Transmissão",
      "suspension-brakes": "Suspensão e travões",
      "electrical": "Elétrica",
      "body-panels": "Carroçaria e chapa",
      "trim-interior": "Estofos e interior",
      "wheels-tyres": "Jantes e pneus",
      "performance": "Desempenho",
      "restoration": "Restauro",
      "used-parts": "Peças usadas",
      "services": "Serviços"
    },
    "country": {
      "GB": "Reino Unido",
      "US": "Estados Unidos",
      "AU": "Austrália",
      "NZ": "Nova Zelândia",
      "JP": "Japão",
      "DE": "Alemanha",
      "NL": "Países Baixos",
      "FR": "França",
      "ES": "Espanha",
      "BE": "Bélgica",
      "CH": "Suíça",
      "IE": "Irlanda"
    }
  },
  "ru": {
    "title": "Поставщики запчастей для Classic Mini по всему миру - Classic Mini DIY",
    "description": "Каталог поставщиков запчастей для Classic Mini в Великобритании, США, Австралии, Новой Зеландии, Европе и Японии.",
    "heading": "Где купить запчасти для Mini",
    "intro": "{suppliers} поставщиков запчастей для Classic Mini в {countries} странах. Каждый проверен вручную перед добавлением.",
    "disclaimer": "Это список магазинов и не более того. Он не сообщает о наличии, ценах и о том, подойдёт ли деталь вашему автомобилю.",
    "filters_label": "Фильтр поставщиков",
    "search_placeholder": "Название, специализация или код страны",
    "search_label": "Поиск поставщиков",
    "showing": "показано: {count}",
    "clear": "Сбросить фильтры",
    "no_results": "Нет поставщиков, подходящих под эти фильтры.",
    "group_count": "поставщиков: {count}",
    "ours": "Наш",
    "ships_worldwide": "Доставка по всему миру",
    "provenance": "Каждая запись была загружена и прочитана перед добавлением. Закрытые магазины, сменившие домен и не продающие запчасти для Mini не включены.",
    "corrections": "Чего-то не хватает, магазин переехал или закрылся? Сообщите нам. Ищете конкретный номер детали?",
    "parts_link": "Искать в архиве номеров деталей",
    "group": {
      "uk-generalist": "Великобритания - полный ассортимент",
      "uk-performance": "Великобритания - тюнинг и инженерия",
      "uk-trim-body": "Великобритания - отделка и кузов",
      "us": "США",
      "anz": "Австралия и Новая Зеландия",
      "europe": "Континентальная Европа",
      "japan": "Япония"
    },
    "tag": {
      "full-range": "Полный ассортимент",
      "heritage": "Оригинальные",
      "engine": "Двигатель",
      "transmission": "Трансмиссия",
      "suspension-brakes": "Подвеска и тормоза",
      "electrical": "Электрика",
      "body-panels": "Кузов и панели",
      "trim-interior": "Отделка и салон",
      "wheels-tyres": "Диски и шины",
      "performance": "Тюнинг",
      "restoration": "Реставрация",
      "used-parts": "Бывшие в употреблении",
      "services": "Услуги"
    },
    "country": {
      "GB": "Великобритания",
      "US": "США",
      "AU": "Австралия",
      "NZ": "Новая Зеландия",
      "JP": "Япония",
      "DE": "Германия",
      "NL": "Нидерланды",
      "FR": "Франция",
      "ES": "Испания",
      "BE": "Бельгия",
      "CH": "Швейцария",
      "IE": "Ирландия"
    }
  },
  "ja": {
    "title": "世界のクラシックミニ パーツ販売店 - Classic Mini DIY",
    "description": "英国、米国、オーストラリア、ニュージーランド、ヨーロッパ、日本のクラシックミニ パーツ販売店ディレクトリ。",
    "heading": "ミニのパーツを買える店",
    "intro": "{countries}か国、{suppliers}軒のクラシックミニ パーツ販売店。掲載前にすべて手作業で確認しています。",
    "disclaimer": "これは店舗の一覧にすぎません。在庫、価格、お車への適合については何も示していません。",
    "filters_label": "販売店を絞り込む",
    "search_placeholder": "店名、専門分野、国コード",
    "search_label": "販売店を検索",
    "showing": "{count}件を表示",
    "clear": "絞り込みを解除",
    "no_results": "条件に合う販売店がありません。",
    "group_count": "{count}軒",
    "ours": "当サイト",
    "ships_worldwide": "海外発送あり",
    "provenance": "掲載前にすべてのサイトを取得して内容を確認しました。閉店した店、ドメインが変わった店、ミニのパーツを扱っていない店は除外しています。",
    "corrections": "掲載漏れ、移転、閉店にお気づきですか。ご連絡ください。特定の部品番号をお探しですか。",
    "parts_link": "部品番号アーカイブを検索",
    "group": {
      "uk-generalist": "英国 - 総合",
      "uk-performance": "英国 - 高性能・エンジニアリング",
      "uk-trim-body": "英国 - 内装・ボディ",
      "us": "米国",
      "anz": "オーストラリア・ニュージーランド",
      "europe": "ヨーロッパ大陸",
      "japan": "日本"
    },
    "tag": {
      "full-range": "総合",
      "heritage": "純正・復刻",
      "engine": "エンジン",
      "transmission": "トランスミッション",
      "suspension-brakes": "サスペンション・ブレーキ",
      "electrical": "電装",
      "body-panels": "ボディ・パネル",
      "trim-interior": "内装",
      "wheels-tyres": "ホイール・タイヤ",
      "performance": "高性能",
      "restoration": "レストア",
      "used-parts": "中古パーツ",
      "services": "サービス"
    },
    "country": {
      "GB": "英国",
      "US": "米国",
      "AU": "オーストラリア",
      "NZ": "ニュージーランド",
      "JP": "日本",
      "DE": "ドイツ",
      "NL": "オランダ",
      "FR": "フランス",
      "ES": "スペイン",
      "BE": "ベルギー",
      "CH": "スイス",
      "IE": "アイルランド"
    }
  },
  "zh": {
    "title": "全球经典 Mini 配件供应商 - Classic Mini DIY",
    "description": "英国、美国、澳大利亚、新西兰、欧洲和日本的经典 Mini 配件供应商目录。",
    "heading": "在哪里购买 Mini 配件",
    "intro": "{countries} 个国家的 {suppliers} 家经典 Mini 配件供应商。每一家在收录前都经过人工核对。",
    "disclaimer": "这只是一份店铺名单。它不说明任何店铺的库存、价格，也不说明某个零件是否适配您的车。",
    "filters_label": "筛选供应商",
    "search_placeholder": "店名、专长或国家代码",
    "search_label": "搜索供应商",
    "showing": "显示 {count} 家",
    "clear": "清除筛选",
    "no_results": "没有符合条件的供应商。",
    "group_count": "{count} 家",
    "ours": "本站",
    "ships_worldwide": "支持全球配送",
    "provenance": "每一条在加入前都已抓取并阅读。已停业、更换域名或并不销售 Mini 配件的店铺未予收录。",
    "corrections": "有遗漏、迁移或停业的店铺吗？请告诉我们。想查找具体零件号？",
    "parts_link": "搜索零件号档案",
    "group": {
      "uk-generalist": "英国 - 全系列",
      "uk-performance": "英国 - 性能与工程",
      "uk-trim-body": "英国 - 内饰与车身",
      "us": "美国",
      "anz": "澳大利亚和新西兰",
      "europe": "欧洲大陆",
      "japan": "日本"
    },
    "tag": {
      "full-range": "全系列",
      "heritage": "原厂与复刻",
      "engine": "发动机",
      "transmission": "变速器",
      "suspension-brakes": "悬挂与制动",
      "electrical": "电气",
      "body-panels": "车身与钣件",
      "trim-interior": "内饰",
      "wheels-tyres": "轮毂与轮胎",
      "performance": "性能",
      "restoration": "修复",
      "used-parts": "二手件",
      "services": "服务"
    },
    "country": {
      "GB": "英国",
      "US": "美国",
      "AU": "澳大利亚",
      "NZ": "新西兰",
      "JP": "日本",
      "DE": "德国",
      "NL": "荷兰",
      "FR": "法国",
      "ES": "西班牙",
      "BE": "比利时",
      "CH": "瑞士",
      "IE": "爱尔兰"
    }
  },
  "ko": {
    "title": "전 세계 클래식 미니 부품 공급업체 - Classic Mini DIY",
    "description": "영국, 미국, 호주, 뉴질랜드, 유럽, 일본의 클래식 미니 부품 공급업체 디렉터리.",
    "heading": "미니 부품을 살 수 있는 곳",
    "intro": "{countries}개국 {suppliers}곳의 클래식 미니 부품 공급업체. 모두 등록 전에 직접 확인했습니다.",
    "disclaimer": "가게 목록일 뿐입니다. 재고나 가격, 부품이 차에 맞는지는 알려주지 않습니다.",
    "filters_label": "공급업체 필터",
    "search_placeholder": "상호, 전문 분야, 국가 코드",
    "search_label": "공급업체 검색",
    "showing": "{count}곳 표시",
    "clear": "필터 지우기",
    "no_results": "조건에 맞는 공급업체가 없습니다.",
    "group_count": "{count}곳",
    "ours": "본 사이트",
    "ships_worldwide": "해외 배송",
    "provenance": "모든 항목은 추가 전에 직접 접속해 내용을 확인했습니다. 폐업했거나 도메인이 바뀌었거나 미니 부품을 팔지 않는 곳은 제외했습니다.",
    "corrections": "빠졌거나 이전했거나 문을 닫은 곳이 있나요? 알려주세요. 특정 부품 번호를 찾고 계신가요?",
    "parts_link": "부품 번호 아카이브 검색",
    "group": {
      "uk-generalist": "영국 - 종합",
      "uk-performance": "영국 - 퍼포먼스 및 엔지니어링",
      "uk-trim-body": "영국 - 내장 및 보디",
      "us": "미국",
      "anz": "호주 및 뉴질랜드",
      "europe": "유럽 대륙",
      "japan": "일본"
    },
    "tag": {
      "full-range": "종합",
      "heritage": "순정 및 복각",
      "engine": "엔진",
      "transmission": "변속기",
      "suspension-brakes": "서스펜션 및 브레이크",
      "electrical": "전장",
      "body-panels": "보디 및 패널",
      "trim-interior": "내장",
      "wheels-tyres": "휠 및 타이어",
      "performance": "퍼포먼스",
      "restoration": "복원",
      "used-parts": "중고 부품",
      "services": "서비스"
    },
    "country": {
      "GB": "영국",
      "US": "미국",
      "AU": "호주",
      "NZ": "뉴질랜드",
      "JP": "일본",
      "DE": "독일",
      "NL": "네덜란드",
      "FR": "프랑스",
      "ES": "스페인",
      "BE": "벨기에",
      "CH": "스위스",
      "IE": "아일랜드"
    }
  }
}
</i18n>
