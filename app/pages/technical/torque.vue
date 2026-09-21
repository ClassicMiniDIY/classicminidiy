<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { trackSearch, track } = useAnalytics();
  const { data: tables, status } = await useFetch('/api/torque');
  const tableSearchQueries = ref<Record<string, string>>({});
  const expandedTables = ref<Record<string, boolean>>({});

  const toggleTable = (key: string, tableName: string) => {
    expandedTables.value[key] = !expandedTables.value[key];
    track('reference_table_toggled', { surface: 'torque', table_name: tableName });
  };

  // Per-table debounced search tracking
  const torqueSearchTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  watch(
    tableSearchQueries,
    (queries) => {
      for (const [key, val] of Object.entries(queries)) {
        if (torqueSearchTimers[key]) clearTimeout(torqueSearchTimers[key]);
        torqueSearchTimers[key] = setTimeout(() => {
          const tableData = (tables.value as any)?.[key];
          const tableName = tableData?.title || key;
          const resultsCount = tableData ? filterItems(tableData.items, key).length : 0;
          trackSearch('torque', val, resultsCount, { table_name: tableName });
        }, 400);
      }
    },
    { deep: true }
  );

  onUnmounted(() => {
    Object.values(torqueSearchTimers).forEach(clearTimeout);
  });

  useHead({
    title: t('title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: t('description'),
      },
      {
        key: 'keywords',
        name: 'keywords',
        content: t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://www.classicminidiy.com/technical/torque',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('og_title'),
    ogDescription: t('og_description'),
    ogUrl: 'https://www.classicminidiy.com/technical/torque',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/torque.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitter_title'),
    twitterDescription: t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/torque.png',
  });

  // Add structured data for the torque specifications reference
  const torqueSpecsJsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: t('structured_data.headline'),
    description: t('structured_data.description'),
    image: 'https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.png',
    // The founder Person (Cole Gentry) — defined in the site-wide schema-org base
    // graph (app/app.vue #founder). @id-referenced so consumers link author → entity.
    author: {
      '@id': 'https://www.classicminidiy.com/#founder',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/logo.png',
      },
    },
    url: 'https://www.classicminidiy.com/technical/torque',
    mainEntity: {
      '@type': 'Dataset',
      name: t('structured_data.dataset_name'),
      description: t('structured_data.dataset_description'),
      variableMeasured: t('structured_data.variable_measured'),
    },
  }));

  // No FAQPage JSON-LD here by design. Google requires FAQ markup to match content
  // that is VISIBLE on the page, and a visible Q&A block was judged to add nothing
  // for human readers on a page that is already a spec table. Rather than ship
  // markup without its on-page counterpart, the generated Q&As go to the
  // machine-readable channel only: /llms-full.txt, via server/plugins/llms-faq.ts.
  // Don't re-add FAQPage schema unless the questions are also rendered.
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: () => JSON.stringify(torqueSpecsJsonLd.value),
      },
    ],
  });

  // Imperial torque column header, derived from every row rather than the first.
  //
  // No current row is lb-in: the Electrical section had been filed that way in
  // error and the source publishes it in lb-ft like every other section. The
  // branch stays because manuals DO publish small fasteners in pound-inches, and
  // a row that arrives in them must not be labelled pound-feet — that is a
  // twelvefold misreading of a torque figure. Inspecting every row rather than
  // row zero is what makes that safe; a mixed table names both units.
  const imperialHeader = (items: any[]) => {
    const rows = items ?? [];
    const hasLbin = rows.some((row) => row?.lbin != null);
    const hasLbft = rows.some((row) => row?.lbft != null);
    if (hasLbin && hasLbft) return `${t('table_headers.torque_lbft')} / ${t('table_headers.torque_lbin')}`;
    return hasLbin ? t('table_headers.torque_lbin') : t('table_headers.torque_lbft');
  };

  // Filter function for table items
  const filterItems = (items: any[], tableName: string) => {
    const query = tableSearchQueries.value[tableName];
    if (!query) return items;
    const queryLower = query.toLowerCase();
    return items.filter(
      (item: any) =>
        item.name.toLowerCase().includes(queryLower) || (item.notes && item.notes.toLowerCase().includes(queryLower))
    );
  };
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :textSize="'text-3xl'" :heroType="HERO_TYPES.TECH" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :version="BREADCRUMB_VERSIONS.TECH" :page="t('breadcrumb_title')"></breadcrumb>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-8">
            <PageIntro
              :eyebrow="t('eyebrow')"
              :title="t('main_heading')"
              :description="t('description_text')"
              as="h2"
            />
          </div>
        </div>
      </div>
      <div class="col-span-12">
        <!-- Loading state -->
        <div v-if="status === 'pending'" class="space-y-4">
          <div class="skeleton h-12 w-full"></div>
          <div class="skeleton h-12 w-full"></div>
          <div class="skeleton h-12 w-full"></div>
        </div>

        <!-- Content when loaded -->
        <div v-if="tables && status !== 'pending'" class="space-y-4">
          <div
            v-for="(table, key) in tables"
            :key="key"
            class="collapse collapse-arrow border border-base-300 bg-base-100 rounded-lg"
          >
            <input type="checkbox" :checked="expandedTables[key]" @change="toggleTable(key, table.title)" />
            <!-- A real heading, not a div: search engines label an excerpted table
                 with the nearest preceding heading, and every table here sat under
                 the single page H2, so a "Wheel Nuts" row surfaced as generic
                 "Torque Specifications". -->
            <h3 class="collapse-title text-lg font-semibold py-4">
              {{ table.title }}
            </h3>
            <div class="collapse-content">
              <div class="pt-2">
                <!-- Search field -->
                <div class="flex justify-end mb-4">
                  <label class="input input-bordered flex items-center gap-2 w-full max-w-xs">
                    <i class="fas fa-magnifying-glass text-base-content/60"></i>
                    <input
                      v-model="tableSearchQueries[key]"
                      type="text"
                      :placeholder="t('ui.search_placeholder')"
                      class="grow"
                    />
                  </label>
                </div>

                <!-- Table -->
                <div class="w-full overflow-x-auto">
                  <table class="table w-full min-w-full">
                    <caption class="sr-only">
                      {{
                        t('table_caption', { section: table.title })
                      }}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{{ t('table_headers.fastener') }}</th>
                        <th scope="col">{{ imperialHeader(table.items) }}</th>
                        <th scope="col">{{ t('table_headers.torque_nm') }}</th>
                        <th scope="col">{{ t('table_headers.notes') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, idx) in filterItems(table.items, key)" :key="idx">
                        <td>{{ row.name }}</td>
                        <td>
                          <!--
                            `!= null` is not enough: a row can publish an empty
                            string where the source gives no figure (the M5
                            fastener lists a spanner size only), and an empty
                            string is not null — it rendered as a blank coloured
                            pill, which reads as a value that failed to load
                            rather than one that does not exist.
                          -->
                          <span
                            v-if="row.lbft || row.lbin"
                            class="px-2 py-1 rounded bg-primary/10 text-primary font-medium"
                          >
                            {{ row.lbft || row.lbin }}
                          </span>
                          <span v-else class="text-base-content/60">&mdash;</span>
                        </td>
                        <td>
                          <span v-if="row.nm" class="px-2 py-1 rounded bg-info/20 text-info font-medium">
                            {{ row.nm }}
                          </span>
                          <span v-else class="text-base-content/60">&mdash;</span>
                        </td>
                        <td>{{ row.notes || t('ui.no_notes') }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Support section -->
      <div class="col-span-12 mt-8 mb-10">
        <div class="divider mb-6">{{ t('support_divider') }}</div>
        <patreon-card size="large" />
      </div>
    </div>

    <div class="pb-12">
      <ToolFooter slug="torque" />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Torque Specifications Chart | Classic Mini DIY",
    "description": "Classic Mini torque settings for every fastener: wheel nuts, cylinder head, flywheel, hub nuts, suspension, gearbox and body, in lb-ft and Nm.",
    "keywords": "Classic Mini torque specs, Mini Cooper fasteners, torque specifications, engine torque values, suspension torque, Mini maintenance, classic car specifications",
    "hero_title": "Torque Specs",
    "breadcrumb_title": "Torque Specs",
    "main_heading": "Torque Specifications",
    "description_text": "Classic Mini torque settings for every fastener: wheel nuts, cylinder head, flywheel, hub nuts, suspension, gearbox and body, in lb-ft and Nm.",
    "support_divider": "Support",
    "og_title": "Classic Mini Torque Specifications Chart | Classic Mini DIY",
    "og_description": "Classic Mini torque settings for every fastener: wheel nuts, cylinder head, flywheel, hub nuts, suspension, gearbox and body, in lb-ft and Nm.",
    "twitter_title": "Classic Mini Torque Specifications Chart",
    "twitter_description": "Complete torque specifications for Classic Mini fasteners. Reference chart for engine, suspension, drivetrain, and body fasteners.",
    "structured_data": {
      "headline": "Classic Mini Torque Specifications Chart",
      "description": "Classic Mini torque settings for every fastener: wheel nuts, cylinder head, flywheel, hub nuts, suspension, gearbox and body, in lb-ft and Nm.",
      "dataset_name": "Classic Mini Torque Specifications",
      "dataset_description": "Comprehensive dataset of torque specifications for Classic Mini fasteners",
      "variable_measured": "Fastener Name, Torque in lb/ft, Torque in Nm, Additional Notes"
    },
    "table_headers": {
      "fastener": "Fastener",
      "torque_lbft": "Torque (lb/ft)",
      "torque_lbin": "Torque (lb/in)",
      "torque_nm": "Torque (Nm)",
      "notes": "Notes"
    },
    "ui": {
      "search_placeholder": "Search this table",
      "no_notes": "---"
    },
    "eyebrow": "REFERENCE",
    "table_caption": "Classic Mini {section} torque settings in lb-ft and Nm"
  },
  "es": {
    "title": "Tabla de Especificaciones de Torque Classic Mini | Classic Mini DIY",
    "description": "Pares de apriete Classic Mini para cada sujetador: tuercas de rueda, culata, volante, tuercas de buje, suspensión, caja de cambios y carrocería, en lb-ft y Nm.",
    "keywords": "especificaciones torque Classic Mini, sujetadores Mini Cooper, especificaciones torque, valores torque motor, torque suspensión, mantenimiento Mini, especificaciones auto clásico",
    "hero_title": "Especificaciones de Torque",
    "breadcrumb_title": "Especificaciones de Torque",
    "main_heading": "Especificaciones de Torque",
    "description_text": "Pares de apriete Classic Mini para cada sujetador: tuercas de rueda, culata, volante, tuercas de buje, suspensión, caja de cambios y carrocería, en lb-ft y Nm.",
    "support_divider": "Soporte",
    "og_title": "Tabla de Especificaciones de Torque Classic Mini | Classic Mini DIY",
    "og_description": "Pares de apriete Classic Mini para cada sujetador: tuercas de rueda, culata, volante, tuercas de buje, suspensión, caja de cambios y carrocería, en lb-ft y Nm.",
    "twitter_title": "Tabla de Especificaciones de Torque Classic Mini",
    "twitter_description": "Especificaciones completas de torque para sujetadores Classic Mini. Tabla de referencia para sujetadores de motor, suspensión, tren motriz y carrocería.",
    "structured_data": {
      "headline": "Tabla de Especificaciones de Torque Classic Mini",
      "description": "Pares de apriete Classic Mini para cada sujetador: tuercas de rueda, culata, volante, tuercas de buje, suspensión, caja de cambios y carrocería, en lb-ft y Nm.",
      "dataset_name": "Especificaciones de Torque Classic Mini",
      "dataset_description": "Conjunto de datos completo de especificaciones de torque para sujetadores Classic Mini",
      "variable_measured": "Nombre del Sujetador, Torque en lb/ft, Torque en Nm, Notas Adicionales"
    },
    "table_headers": {
      "fastener": "Sujetador",
      "torque_lbft": "Torque (lb/ft)",
      "torque_lbin": "Torque (lb/in)",
      "torque_nm": "Torque (Nm)",
      "notes": "Notas"
    },
    "ui": {
      "search_placeholder": "Buscar en esta tabla",
      "no_notes": "---"
    },
    "eyebrow": "REFERENCIA",
    "table_caption": "Pares de apriete Classic Mini de {section} en lb-ft y Nm"
  },
  "fr": {
    "title": "Tableau des Spécifications de Couple Classic Mini | Classic Mini DIY",
    "description": "Couples de serrage Classic Mini pour chaque fixation : écrous de roue, culasse, volant moteur, écrous de moyeu, suspension, boîte de vitesses et carrosserie, en lb-ft et Nm.",
    "keywords": "spécifications couple Classic Mini, fixations Mini Cooper, spécifications couple, valeurs couple moteur, couple suspension, entretien Mini, spécifications voiture classique",
    "hero_title": "Spécifications de Couple",
    "breadcrumb_title": "Spécifications de Couple",
    "main_heading": "Spécifications de Couple",
    "description_text": "Couples de serrage Classic Mini pour chaque fixation : écrous de roue, culasse, volant moteur, écrous de moyeu, suspension, boîte de vitesses et carrosserie, en lb-ft et Nm.",
    "support_divider": "Support",
    "og_title": "Tableau des Spécifications de Couple Classic Mini | Classic Mini DIY",
    "og_description": "Couples de serrage Classic Mini pour chaque fixation : écrous de roue, culasse, volant moteur, écrous de moyeu, suspension, boîte de vitesses et carrosserie, en lb-ft et Nm.",
    "twitter_title": "Tableau des Spécifications de Couple Classic Mini",
    "twitter_description": "Spécifications complètes de couple pour les fixations Classic Mini. Tableau de référence pour les fixations moteur, suspension, transmission et carrosserie.",
    "structured_data": {
      "headline": "Tableau des Spécifications de Couple Classic Mini",
      "description": "Couples de serrage Classic Mini pour chaque fixation : écrous de roue, culasse, volant moteur, écrous de moyeu, suspension, boîte de vitesses et carrosserie, en lb-ft et Nm.",
      "dataset_name": "Spécifications de Couple Classic Mini",
      "dataset_description": "Jeu de données complet des spécifications de couple pour les fixations Classic Mini",
      "variable_measured": "Nom de la Fixation, Couple en lb/ft, Couple en Nm, Notes Supplémentaires"
    },
    "table_headers": {
      "fastener": "Fixation",
      "torque_lbft": "Couple (lb/ft)",
      "torque_lbin": "Couple (lb/in)",
      "torque_nm": "Couple (Nm)",
      "notes": "Notes"
    },
    "ui": {
      "search_placeholder": "Rechercher dans ce tableau",
      "no_notes": "---"
    },
    "eyebrow": "RÉFÉRENCE",
    "table_caption": "Couples de serrage Classic Mini {section} en lb-ft et Nm"
  },
  "it": {
    "title": "Tabella Specifiche di Coppia Classic Mini | Classic Mini DIY",
    "description": "Coppie di serraggio Classic Mini per ogni fissaggio: dadi ruota, testata, volano, dadi mozzo, sospensioni, cambio e carrozzeria, in lb-ft e Nm.",
    "keywords": "specifiche coppia Classic Mini, elementi fissaggio Mini Cooper, specifiche coppia, valori coppia motore, coppia sospensioni, manutenzione Mini, specifiche auto classica",
    "hero_title": "Specifiche di Coppia",
    "breadcrumb_title": "Specifiche di Coppia",
    "main_heading": "Specifiche di Coppia",
    "description_text": "Coppie di serraggio Classic Mini per ogni fissaggio: dadi ruota, testata, volano, dadi mozzo, sospensioni, cambio e carrozzeria, in lb-ft e Nm.",
    "support_divider": "Supporto",
    "og_title": "Tabella Specifiche di Coppia Classic Mini | Classic Mini DIY",
    "og_description": "Coppie di serraggio Classic Mini per ogni fissaggio: dadi ruota, testata, volano, dadi mozzo, sospensioni, cambio e carrozzeria, in lb-ft e Nm.",
    "twitter_title": "Tabella Specifiche di Coppia Classic Mini",
    "twitter_description": "Specifiche complete di coppia per elementi di fissaggio Classic Mini. Tabella di riferimento per elementi di fissaggio motore, sospensioni, trasmissione e carrozzeria.",
    "structured_data": {
      "headline": "Tabella Specifiche di Coppia Classic Mini",
      "description": "Coppie di serraggio Classic Mini per ogni fissaggio: dadi ruota, testata, volano, dadi mozzo, sospensioni, cambio e carrozzeria, in lb-ft e Nm.",
      "dataset_name": "Specifiche di Coppia Classic Mini",
      "dataset_description": "Set di dati completo delle specifiche di coppia per elementi di fissaggio Classic Mini",
      "variable_measured": "Nome Elemento di Fissaggio, Coppia in lb/ft, Coppia in Nm, Note Aggiuntive"
    },
    "table_headers": {
      "fastener": "Elemento di Fissaggio",
      "torque_lbft": "Coppia (lb/ft)",
      "torque_lbin": "Coppia (lb/in)",
      "torque_nm": "Coppia (Nm)",
      "notes": "Note"
    },
    "ui": {
      "search_placeholder": "Cerca in questa tabella",
      "no_notes": "---"
    },
    "eyebrow": "RIFERIMENTO",
    "table_caption": "Coppie di serraggio Classic Mini {section} in lb-ft e Nm"
  },
  "de": {
    "title": "Classic Mini Drehmoment-Spezifikationstabelle | Classic Mini DIY",
    "description": "Classic Mini Anzugsdrehmomente für jede Schraubverbindung: Radmuttern, Zylinderkopf, Schwungrad, Nabenmuttern, Fahrwerk, Getriebe und Karosserie, in lb-ft und Nm.",
    "keywords": "Classic Mini Drehmoment-Spezifikationen, Mini Cooper Befestigungselemente, Drehmoment-Spezifikationen, Motor-Drehmomentwerte, Fahrwerk-Drehmoment, Mini-Wartung, Oldtimer-Spezifikationen",
    "hero_title": "Drehmoment-Spezifikationen",
    "breadcrumb_title": "Drehmoment-Spezifikationen",
    "main_heading": "Drehmoment-Spezifikationen",
    "description_text": "Classic Mini Anzugsdrehmomente für jede Schraubverbindung: Radmuttern, Zylinderkopf, Schwungrad, Nabenmuttern, Fahrwerk, Getriebe und Karosserie, in lb-ft und Nm.",
    "support_divider": "Support",
    "og_title": "Classic Mini Drehmoment-Spezifikationstabelle | Classic Mini DIY",
    "og_description": "Classic Mini Anzugsdrehmomente für jede Schraubverbindung: Radmuttern, Zylinderkopf, Schwungrad, Nabenmuttern, Fahrwerk, Getriebe und Karosserie, in lb-ft und Nm.",
    "twitter_title": "Classic Mini Drehmoment-Spezifikationstabelle",
    "twitter_description": "Vollständige Drehmoment-Spezifikationen für Classic Mini Befestigungselemente. Referenztabelle für Motor-, Fahrwerk-, Antriebsstrang- und Karosseriebefestigungen.",
    "structured_data": {
      "headline": "Classic Mini Drehmoment-Spezifikationstabelle",
      "description": "Classic Mini Anzugsdrehmomente für jede Schraubverbindung: Radmuttern, Zylinderkopf, Schwungrad, Nabenmuttern, Fahrwerk, Getriebe und Karosserie, in lb-ft und Nm.",
      "dataset_name": "Classic Mini Drehmoment-Spezifikationen",
      "dataset_description": "Umfassender Datensatz von Drehmoment-Spezifikationen für Classic Mini Befestigungselemente",
      "variable_measured": "Befestigungsname, Drehmoment in lb/ft, Drehmoment in Nm, Zusätzliche Hinweise"
    },
    "table_headers": {
      "fastener": "Befestigung",
      "torque_lbft": "Drehmoment (lb/ft)",
      "torque_lbin": "Drehmoment (lb/in)",
      "torque_nm": "Drehmoment (Nm)",
      "notes": "Hinweise"
    },
    "ui": {
      "search_placeholder": "Diese Tabelle durchsuchen",
      "no_notes": "---"
    },
    "eyebrow": "REFERENZ",
    "table_caption": "Classic Mini Anzugsdrehmomente {section} in lb-ft und Nm"
  },
  "pt": {
    "title": "Tabela de Especificações de Torque Classic Mini | Classic Mini DIY",
    "description": "Binários de aperto Classic Mini para cada fixação: porcas de roda, cabeça do motor, volante, porcas de cubo, suspensão, caixa de velocidades e carroçaria, em lb-ft e Nm.",
    "keywords": "especificações torque Classic Mini, fixadores Mini Cooper, especificações torque, valores torque motor, torque suspensão, manutenção Mini, especificações carro clássico",
    "hero_title": "Especificações de Torque",
    "breadcrumb_title": "Especificações de Torque",
    "main_heading": "Especificações de Torque",
    "description_text": "Binários de aperto Classic Mini para cada fixação: porcas de roda, cabeça do motor, volante, porcas de cubo, suspensão, caixa de velocidades e carroçaria, em lb-ft e Nm.",
    "support_divider": "Suporte",
    "og_title": "Tabela de Especificações de Torque Classic Mini | Classic Mini DIY",
    "og_description": "Binários de aperto Classic Mini para cada fixação: porcas de roda, cabeça do motor, volante, porcas de cubo, suspensão, caixa de velocidades e carroçaria, em lb-ft e Nm.",
    "twitter_title": "Tabela de Especificações de Torque Classic Mini",
    "twitter_description": "Especificações completas de torque para fixadores Classic Mini. Tabela de referência para fixadores de motor, suspensão, trem de força e carroceria.",
    "structured_data": {
      "headline": "Tabela de Especificações de Torque Classic Mini",
      "description": "Binários de aperto Classic Mini para cada fixação: porcas de roda, cabeça do motor, volante, porcas de cubo, suspensão, caixa de velocidades e carroçaria, em lb-ft e Nm.",
      "dataset_name": "Especificações de Torque Classic Mini",
      "dataset_description": "Conjunto de dados abrangente de especificações de torque para fixadores Classic Mini",
      "variable_measured": "Nome do Fixador, Torque em lb/ft, Torque em Nm, Notas Adicionais"
    },
    "table_headers": {
      "fastener": "Fixador",
      "torque_lbft": "Torque (lb/ft)",
      "torque_lbin": "Torque (lb/in)",
      "torque_nm": "Torque (Nm)",
      "notes": "Notas"
    },
    "ui": {
      "search_placeholder": "Pesquisar nesta tabela",
      "no_notes": "---"
    },
    "eyebrow": "REFERÊNCIA",
    "table_caption": "Binários de aperto Classic Mini {section} em lb-ft e Nm"
  },
  "ru": {
    "title": "Таблица Спецификаций Крутящего Момента Classic Mini | Classic Mini DIY",
    "description": "Моменты затяжки Classic Mini для каждого крепежа: колёсные гайки, головка блока, маховик, гайки ступиц, подвеска, коробка передач и кузов, в lb-ft и Нм.",
    "keywords": "спецификации крутящего момента Classic Mini, крепежные элементы Mini Cooper, спецификации крутящего момента, значения крутящего момента двигателя, крутящий момент подвески, обслуживание Mini, спецификации классического автомобиля",
    "hero_title": "Спецификации Крутящего Момента",
    "breadcrumb_title": "Спецификации Крутящего Момента",
    "main_heading": "Спецификации Крутящего Момента",
    "description_text": "Моменты затяжки Classic Mini для каждого крепежа: колёсные гайки, головка блока, маховик, гайки ступиц, подвеска, коробка передач и кузов, в lb-ft и Нм.",
    "support_divider": "Поддержка",
    "og_title": "Таблица Спецификаций Крутящего Момента Classic Mini | Classic Mini DIY",
    "og_description": "Моменты затяжки Classic Mini для каждого крепежа: колёсные гайки, головка блока, маховик, гайки ступиц, подвеска, коробка передач и кузов, в lb-ft и Нм.",
    "twitter_title": "Таблица Спецификаций Крутящего Момента Classic Mini",
    "twitter_description": "Полные спецификации крутящего момента для крепежных элементов Classic Mini. Справочная таблица для крепежных элементов двигателя, подвески, трансмиссии и кузова.",
    "structured_data": {
      "headline": "Таблица Спецификаций Крутящего Момента Classic Mini",
      "description": "Моменты затяжки Classic Mini для каждого крепежа: колёсные гайки, головка блока, маховик, гайки ступиц, подвеска, коробка передач и кузов, в lb-ft и Нм.",
      "dataset_name": "Спецификации Крутящего Момента Classic Mini",
      "dataset_description": "Комплексный набор данных спецификаций крутящего момента для крепежных элементов Classic Mini",
      "variable_measured": "Название Крепежного Элемента, Крутящий Момент в lb/ft, Крутящий Момент в Nm, Дополнительные Примечания"
    },
    "table_headers": {
      "fastener": "Крепежный Элемент",
      "torque_lbft": "Крутящий Момент (lb/ft)",
      "torque_lbin": "Крутящий Момент (lb/in)",
      "torque_nm": "Крутящий Момент (Nm)",
      "notes": "Примечания"
    },
    "ui": {
      "search_placeholder": "Поиск в этой таблице",
      "no_notes": "---"
    },
    "eyebrow": "СПРАВОЧНИК",
    "table_caption": "Моменты затяжки Classic Mini {section} в lb-ft и Нм"
  },
  "ja": {
    "title": "クラシック・ミニ トルク仕様表 | Classic Mini DIY",
    "description": "Classic Miniの全締結部の締め付けトルク：ホイールナット、シリンダーヘッド、フライホイール、ハブナット、サスペンション、ギアボックス、ボディをlb-ftとNmで収録。",
    "keywords": "クラシック・ミニ トルク仕様、ミニクーパー 締結具、トルク仕様、エンジントルク値、サスペンショントルク、ミニメンテナンス、クラシックカー仕様",
    "hero_title": "トルク仕様",
    "breadcrumb_title": "トルク仕様",
    "main_heading": "トルク仕様",
    "description_text": "Classic Miniの全締結部の締め付けトルク：ホイールナット、シリンダーヘッド、フライホイール、ハブナット、サスペンション、ギアボックス、ボディをlb-ftとNmで収録。",
    "support_divider": "サポート",
    "og_title": "クラシック・ミニ トルク仕様表 | Classic Mini DIY",
    "og_description": "Classic Miniの全締結部の締め付けトルク：ホイールナット、シリンダーヘッド、フライホイール、ハブナット、サスペンション、ギアボックス、ボディをlb-ftとNmで収録。",
    "twitter_title": "クラシック・ミニ トルク仕様表",
    "twitter_description": "クラシック・ミニ締結具の完全なトルク仕様。エンジン、サスペンション、ドライブトレイン、ボディ締結具の参照表。",
    "structured_data": {
      "headline": "クラシック・ミニ トルク仕様表",
      "description": "Classic Miniの全締結部の締め付けトルク：ホイールナット、シリンダーヘッド、フライホイール、ハブナット、サスペンション、ギアボックス、ボディをlb-ftとNmで収録。",
      "dataset_name": "クラシック・ミニ トルク仕様",
      "dataset_description": "クラシック・ミニ締結具のトルク仕様の包括的なデータセット",
      "variable_measured": "締結具名, lb/ftでのトルク, Nmでのトルク, 追加注記"
    },
    "table_headers": {
      "fastener": "締結具",
      "torque_lbft": "トルク (lb/ft)",
      "torque_lbin": "トルク (lb/in)",
      "torque_nm": "トルク (Nm)",
      "notes": "注記"
    },
    "ui": {
      "search_placeholder": "この表を検索",
      "no_notes": "---"
    },
    "eyebrow": "リファレンス",
    "table_caption": "Classic Mini {section} 締め付けトルク（lb-ft・Nm）"
  },
  "zh": {
    "title": "经典迷你扭矩规格表 | Classic Mini DIY",
    "description": "Classic Mini各紧固件的扭矩规格：轮毂螺母、缸盖、飞轮、轮毂螺母、悬挂、变速箱和车身，以lb-ft和Nm表示。",
    "keywords": "经典迷你扭矩规格，迷你库珀紧固件，扭矩规格，发动机扭矩值，悬挂扭矩，迷你维护，经典汽车规格",
    "hero_title": "扭矩规格",
    "breadcrumb_title": "扭矩规格",
    "main_heading": "扭矩规格",
    "description_text": "Classic Mini各紧固件的扭矩规格：轮毂螺母、缸盖、飞轮、轮毂螺母、悬挂、变速箱和车身，以lb-ft和Nm表示。",
    "support_divider": "支持",
    "og_title": "经典迷你扭矩规格表 | Classic Mini DIY",
    "og_description": "Classic Mini各紧固件的扭矩规格：轮毂螺母、缸盖、飞轮、轮毂螺母、悬挂、变速箱和车身，以lb-ft和Nm表示。",
    "twitter_title": "经典迷你扭矩规格表",
    "twitter_description": "经典迷你紧固件的完整扭矩规格。发动机、悬挂、传动系统和车身紧固件的参考表。",
    "structured_data": {
      "headline": "经典迷你扭矩规格表",
      "description": "Classic Mini各紧固件的扭矩规格：轮毂螺母、缸盖、飞轮、轮毂螺母、悬挂、变速箱和车身，以lb-ft和Nm表示。",
      "dataset_name": "经典迷你扭矩规格",
      "dataset_description": "经典迷你紧固件扭矩规格的综合数据集",
      "variable_measured": "紧固件名称, lb/ft扭矩, Nm扭矩, 附加说明"
    },
    "table_headers": {
      "fastener": "紧固件",
      "torque_lbft": "扭矩 (lb/ft)",
      "torque_lbin": "扭矩 (lb/in)",
      "torque_nm": "扭矩 (Nm)",
      "notes": "说明"
    },
    "ui": {
      "search_placeholder": "搜索此表",
      "no_notes": "---"
    },
    "eyebrow": "参考",
    "table_caption": "Classic Mini {section} 扭矩规格（lb-ft和Nm）"
  },
  "ko": {
    "title": "클래식 미니 토크 사양표 | Classic Mini DIY",
    "description": "Classic Mini 모든 체결부의 조임 토크: 휠 너트, 실린더 헤드, 플라이휠, 허브 너트, 서스펜션, 기어박스, 차체를 lb-ft와 Nm으로 수록.",
    "keywords": "클래식 미니 토크 사양, 미니 쿠퍼 체결구, 토크 사양, 엔진 토크 값, 서스펜션 토크, 미니 유지보수, 클래식 자동차 사양",
    "hero_title": "토크 사양",
    "breadcrumb_title": "토크 사양",
    "main_heading": "토크 사양",
    "description_text": "Classic Mini 모든 체결부의 조임 토크: 휠 너트, 실린더 헤드, 플라이휠, 허브 너트, 서스펜션, 기어박스, 차체를 lb-ft와 Nm으로 수록.",
    "support_divider": "지원",
    "og_title": "클래식 미니 토크 사양표 | Classic Mini DIY",
    "og_description": "Classic Mini 모든 체결부의 조임 토크: 휠 너트, 실린더 헤드, 플라이휠, 허브 너트, 서스펜션, 기어박스, 차체를 lb-ft와 Nm으로 수록.",
    "twitter_title": "클래식 미니 토크 사양표",
    "twitter_description": "클래식 미니 체결구의 완전한 토크 사양. 엔진, 서스펜션, 드라이브트레인 및 차체 체결구의 참조표.",
    "structured_data": {
      "headline": "클래식 미니 토크 사양표",
      "description": "Classic Mini 모든 체결부의 조임 토크: 휠 너트, 실린더 헤드, 플라이휠, 허브 너트, 서스펜션, 기어박스, 차체를 lb-ft와 Nm으로 수록.",
      "dataset_name": "클래식 미니 토크 사양",
      "dataset_description": "클래식 미니 체결구 토크 사양의 포괄적인 데이터셋",
      "variable_measured": "체결구 이름, lb/ft 토크, Nm 토크, 추가 참고사항"
    },
    "table_headers": {
      "fastener": "체결구",
      "torque_lbft": "토크 (lb/ft)",
      "torque_lbin": "토크 (lb/in)",
      "torque_nm": "토크 (Nm)",
      "notes": "참고사항"
    },
    "ui": {
      "search_placeholder": "이 표 검색",
      "no_notes": "---"
    },
    "eyebrow": "참조",
    "table_caption": "Classic Mini {section} 조임 토크 (lb-ft 및 Nm)"
  }
}
</i18n>
