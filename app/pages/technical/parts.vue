<script lang="ts" setup>
  import { h } from 'vue';
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();

  interface PartItem {
    brand: string;
    part: string;
    info?: string;
    [key: string]: any; // For any additional properties
  }

  interface PartsTable {
    title: string;
    items: PartItem[];
  }

  const { data: tables } = await useFetch<Record<string, PartsTable>>('/api/parts');
  const searchValue = ref('');
  const activePanels = ref<Record<string, boolean>>({
    'Air Filters': true,
    'Oil Filters': true,
    Alternators: true,
  });

  const togglePanel = (panel: string) => {
    activePanels.value[panel] = !activePanels.value[panel];
  };

  // Column definitions for Nuxt UI table
  const tableColumns = [
    {
      accessorKey: 'brand',
      header: () => t('table_headers.brand'),
      cell: ({ row }) =>
        h(
          'span',
          {
            class: 'px-2 py-1 rounded bg-primary/10 text-primary font-medium',
          },
          row.getValue('brand')
        ),
    },
    {
      accessorKey: 'part',
      header: () => t('table_headers.part_number'),
      cell: ({ row }) =>
        h(
          'span',
          {
            class: 'px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium',
          },
          row.getValue('part')
        ),
    },
    {
      accessorKey: 'info',
      header: () => t('table_headers.usage_info'),
      cell: ({ row }) => row.getValue('info') || '',
    },
  ];

  // Function to filter items based on search
  const filterItems = (items: PartItem[]) => {
    if (!searchValue.value) return items;
    const query = searchValue.value.toLowerCase();
    return items.filter((item: PartItem) =>
      Object.values(item).some((val) => String(val).toLowerCase().includes(query))
    );
  };

  // Function to scroll to submissions section
  const scrollToSubmissions = () => {
    const element = document.getElementById('submissions-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Computed property for mailto link with prefilled information
  const mailtoLink = computed(() => {
    const subject = encodeURIComponent(t('mailto.subject'));
    const body = encodeURIComponent(t('mailto.body'));
    return `mailto:cole@classicminidiy.com?subject=${subject}&body=${body}`;
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
        name: 'keywords',
        content: t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/technical/parts',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // Dataset structured data for parts cross-reference database
  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Classic Mini Parts Equivalency Database',
    description: t('description'),
    url: 'https://classicminidiy.com/technical/parts',
    keywords: [
      'Classic Mini parts',
      'parts cross-reference',
      'Mini Cooper parts',
      'oil filter',
      'air filter',
      'alternator',
      'parts equivalency',
    ],
    creator: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
    license: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    isAccessibleForFree: true,
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'Brand',
        description: 'Aftermarket brand name',
      },
      {
        '@type': 'PropertyValue',
        name: 'Part Number',
        description: 'Manufacturer part number',
      },
    ],
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(datasetJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('og_title'),
    ogDescription: t('og_description'),
    ogUrl: 'https://classicminidiy.com/technical/parts',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/parts.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitter_title'),
    twitterDescription: t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/parts.png',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.TECH" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :version="BREADCRUMB_VERSIONS.TECH" :page="t('breadcrumb_title')" />
    </div>

    <!-- Description and Contact Card Section -->
    <div class="grid grid-cols-12 gap-6 mb-8">
      <div class="col-span-12 md:col-span-8">
        <h1 class="text-3xl font-bold mb-4">{{ t('main_heading') }}</h1>
        <p class="mb-4">{{ t('description_text') }}</p>
      </div>
      <div class="col-span-12 md:col-span-4">
        <a @click="scrollToSubmissions" :title="t('contact_card.link_title')" class="block cursor-pointer">
          <UCard class="hover:shadow-lg transition-shadow">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0">
                <div class="w-16 h-16 flex items-center justify-center">
                  <i class="fas fa-envelope text-4xl text-primary"></i>
                </div>
              </div>
              <div>
                <h2 class="text-xl font-semibold">
                  {{ t('contact_card.heading') }}
                </h2>
                <p class="mt-1">{{ t('contact_card.description') }}</p>
              </div>
            </div>
          </UCard>
        </a>
      </div>
    </div>

    <div class="space-y-4">
      <UCollapsible
        v-for="(table, name, index) in tables"
        :key="`${name}-${index}`"
        :default-open="activePanels[table.title]"
        class="border border-muted rounded-lg overflow-hidden"
      >
        <template #trigger>
          <div
            class="flex items-center justify-between w-full px-4 py-3 bg-primary text-primary-content font-semibold text-xl"
          >
            <span>{{ table.title }}</span>
            <i class="fas fa-chevron-down transition-transform"></i>
          </div>
        </template>
        <div class="p-4 bg-muted/50">
          <!-- Search field -->
          <div class="flex justify-end mb-4">
            <UInput v-model="searchValue" :placeholder="t('ui.search_placeholder')" class="w-full max-w-xs" />
          </div>

          <div class="w-full overflow-x-auto">
            <UTable :data="filterItems(table.items)" :columns="tableColumns" class="w-full min-w-full" />
          </div>
        </div>
      </UCollapsible>
    </div>

    <!-- Contact Section for Submissions -->
    <USeparator :label="t('ui.submissions_section')" class="my-12" />
    <div id="submissions-section" class="mb-8">
      <UCard>
        <div class="text-center">
          <div class="mb-4">
            <i class="fas fa-plus-circle text-6xl text-primary"></i>
          </div>
          <h2 class="text-2xl font-bold mb-4">{{ t('submissions.heading') }}</h2>
          <p class="text-lg mb-6">{{ t('submissions.description') }}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="text-left">
              <h3 class="font-semibold text-lg mb-2">{{ t('submissions.what_to_include.heading') }}</h3>
              <ul class="list-disc list-inside space-y-1">
                <li>{{ t('submissions.what_to_include.brand') }}</li>
                <li>{{ t('submissions.what_to_include.part_number') }}</li>
                <li>{{ t('submissions.what_to_include.fits') }}</li>
                <li>{{ t('submissions.what_to_include.store') }}</li>
              </ul>
            </div>
            <div class="text-left">
              <h3 class="font-semibold text-lg mb-2">{{ t('submissions.examples.heading') }}</h3>
              <ul class="list-disc list-inside space-y-1">
                <li>{{ t('submissions.examples.oil_filter') }}</li>
                <li>{{ t('submissions.examples.spark_plug') }}</li>
                <li>{{ t('submissions.examples.brake_pad') }}</li>
              </ul>
            </div>
          </div>
          <UButton :to="mailtoLink" color="primary" size="lg">
            <i class="fas fa-envelope mr-2"></i>
            {{ t('submissions.submit_button') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <USeparator :label="t('ui.support_section')" class="my-12" />
    <div class="mb-8">
      <patreon-card size="large" />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Tech - Parts Equivalency",
    "description": "A complete list of parts which can be found at local parts sellers",
    "keywords": "Classic Mini parts, parts equivalency, Mini Cooper parts, oil filter, air filter, alternator, cross-reference parts, local auto parts, aftermarket Mini parts",
    "hero_title": "Parts Equivalency",
    "breadcrumb_title": "Parts Equivalency",
    "og_title": "Tech - Parts Equivalency",
    "og_description": "A complete list of parts which can be found at local parts sellers",
    "twitter_title": "Tech - Parts Equivalency",
    "twitter_description": "A complete list of parts which can be found at local parts sellers",
    "main_heading": "Parts Equivalency",
    "description_text": "This page documents common part numbers for various Classic Mini parts that can be found at local stores near you. These equivalencies help you source parts without having to order specialty Mini parts, saving time and often money.",
    "contact_card": {
      "link_title": "Contact us to submit part information",
      "heading": "Know a matching part?",
      "description": "Submit your own known matching part numbers and brands to help the community.",
      "alt_text": "Contact form icon"
    },
    "table_headers": {
      "brand": "Brand",
      "part_number": "Part Number",
      "usage_info": "Usage Info"
    },
    "submissions": {
      "heading": "Submit Your Own Part Equivalencies",
      "description": "Help the Classic Mini community by sharing part numbers you've discovered that work perfectly in your Mini. Your contributions help fellow enthusiasts find parts at their local stores.",
      "what_to_include": {
        "heading": "What to Include:",
        "brand": "Brand name (e.g., Mann, Bosch, Champion)",
        "part_number": "Exact part number",
        "fits": "What Mini models/years it fits",
        "store": "Where you found it (optional)"
      },
      "examples": {
        "heading": "Examples:",
        "oil_filter": "Mann W610/3 oil filter for 998cc engines",
        "spark_plug": "NGK BP6ES plugs for standard tune",
        "brake_pad": "EBC GreenStuff pads for 7.5\" discs"
      },
      "submit_button": "Submit Parts Information"
    },
    "mailto": {
      "subject": "Parts Equivalency Submission - Classic Mini DIY",
      "body": "Hi Cole,\n\nI'd like to submit a parts equivalency for the Classic Mini DIY database:\n\nBrand Name: \nPart Number: \nWhat it fits (Mini model/year): \nWhere I found it (store/website): \nAdditional notes: \n\nThanks!\n"
    },
    "ui": {
      "search_placeholder": "Search...",
      "no_items_found": "No items found",
      "submissions_section": "Submit Parts",
      "support_section": "Support"
    }
  },
  "es": {
    "title": "Tech - Equivalencia de Piezas",
    "description": "Una lista completa de piezas que se pueden encontrar en vendedores de piezas locales",
    "keywords": "piezas Classic Mini, equivalencia de piezas, piezas Mini Cooper, filtro de aceite, filtro de aire, alternador, referencia cruzada de piezas, piezas de auto locales",
    "hero_title": "Equivalencia de Piezas",
    "breadcrumb_title": "Equivalencia de Piezas",
    "og_title": "Tech - Equivalencia de Piezas",
    "og_description": "Una lista completa de piezas que se pueden encontrar en vendedores de piezas locales",
    "twitter_title": "Tech - Equivalencia de Piezas",
    "twitter_description": "Una lista completa de piezas que se pueden encontrar en vendedores de piezas locales",
    "main_heading": "Equivalencia de Piezas",
    "description_text": "Esta página documenta números de pieza comunes para varias piezas del Classic Mini que se pueden encontrar en tiendas locales cerca de ti. Estas equivalencias te ayudan a conseguir piezas sin tener que ordenar piezas especializadas de Mini, ahorrando tiempo y a menudo dinero.",
    "contact_card": {
      "link_title": "Contáctanos para enviar información de piezas",
      "heading": "¿Conoces una pieza equivalente?",
      "description": "Envía tus propios números de pieza y marcas conocidas para ayudar a la comunidad.",
      "alt_text": "Icono de formulario de contacto"
    },
    "table_headers": {
      "brand": "Marca",
      "part_number": "Número de Pieza",
      "usage_info": "Información de Uso"
    },
    "submissions": {
      "heading": "Envía Tus Propias Equivalencias de Piezas",
      "description": "Ayuda a la comunidad del Classic Mini compartiendo números de pieza que has descubierto que funcionan perfectamente en tu Mini. Tus contribuciones ayudan a otros entusiastas a encontrar piezas en sus tiendas locales.",
      "what_to_include": {
        "heading": "Qué Incluir:",
        "brand": "Nombre de la marca (ej., Mann, Bosch, Champion)",
        "part_number": "Número de pieza exacto",
        "fits": "En qué modelos/años de Mini encaja",
        "store": "Dónde lo encontraste (opcional)"
      },
      "examples": {
        "heading": "Ejemplos:",
        "oil_filter": "Filtro de aceite Mann W610/3 para motores 998cc",
        "spark_plug": "Bujías NGK BP6ES para ajuste estándar",
        "brake_pad": "Pastillas EBC GreenStuff para discos de 7.5\""
      },
      "submit_button": "Enviar Información de Piezas"
    },
    "mailto": {
      "subject": "Envío de Equivalencia de Piezas - Classic Mini DIY",
      "body": "Hola Cole,\n\nMe gustaría enviar una equivalencia de piezas para la base de datos de Classic Mini DIY:\n\nNombre de la Marca: \nNúmero de Pieza: \nEn qué encaja (modelo/año Mini): \nDónde lo encontré (tienda/sitio web): \nNotas adicionales: \n\n¡Gracias!\n"
    },
    "ui": {
      "search_placeholder": "Buscar...",
      "no_items_found": "No se encontraron elementos",
      "submissions_section": "Enviar Piezas",
      "support_section": "Soporte"
    }
  },
  "fr": {
    "title": "Tech - Équivalence des Pièces",
    "description": "Une liste complète des pièces qui peuvent être trouvées chez les vendeurs de pièces locaux",
    "keywords": "pièces Classic Mini, équivalence de pièces, pièces Mini Cooper, filtre à huile, filtre à air, alternateur, référence croisée de pièces, pièces auto locales",
    "hero_title": "Équivalence des Pièces",
    "breadcrumb_title": "Équivalence des Pièces",
    "og_title": "Tech - Équivalence des Pièces",
    "og_description": "Une liste complète des pièces qui peuvent être trouvées chez les vendeurs de pièces locaux",
    "twitter_title": "Tech - Équivalence des Pièces",
    "twitter_description": "Une liste complète des pièces qui peuvent être trouvées chez les vendeurs de pièces locaux",
    "main_heading": "Équivalence des Pièces",
    "description_text": "Cette page documente les numéros de pièces communs pour diverses pièces du Classic Mini qui peuvent être trouvées dans les magasins locaux près de chez vous. Ces équivalences vous aident à vous procurer des pièces sans avoir à commander des pièces spécialisées Mini, économisant du temps et souvent de l'argent.",
    "contact_card": {
      "link_title": "Contactez-nous pour soumettre des informations sur les pièces",
      "heading": "Connaissez-vous une pièce équivalente?",
      "description": "Soumettez vos propres numéros de pièces et marques connues pour aider la communauté.",
      "alt_text": "Icône de formulaire de contact"
    },
    "table_headers": {
      "brand": "Marque",
      "part_number": "Numéro de Pièce",
      "usage_info": "Informations d'Utilisation"
    },
    "submissions": {
      "heading": "Soumettez Vos Propres Équivalences de Pièces",
      "description": "Aidez la communauté Classic Mini en partageant les numéros de pièces que vous avez découverts qui fonctionnent parfaitement dans votre Mini. Vos contributions aident les autres passionnés à trouver des pièces dans leurs magasins locaux.",
      "what_to_include": {
        "heading": "Que Inclure :",
        "brand": "Nom de marque (ex., Mann, Bosch, Champion)",
        "part_number": "Numéro de pièce exact",
        "fits": "Quels modèles/années Mini cela convient",
        "store": "Où vous l'avez trouvé (optionnel)"
      },
      "examples": {
        "heading": "Exemples :",
        "oil_filter": "Filtre à huile Mann W610/3 pour moteurs 998cc",
        "spark_plug": "Bougies NGK BP6ES pour réglage standard",
        "brake_pad": "Plaquettes EBC GreenStuff pour disques 7.5\""
      },
      "submit_button": "Soumettre Informations de Pièces"
    },
    "mailto": {
      "subject": "Soumission d'Équivalence de Pièces - Classic Mini DIY",
      "body": "Salut Cole,\n\nJ'aimerais soumettre une équivalence de pièces pour la base de données Classic Mini DIY :\n\nNom de Marque : \nNuméro de Pièce : \nCe que ça convient (modèle/année Mini) : \nOù je l'ai trouvé (magasin/site web) : \nNotes supplémentaires : \n\nMerci !\n"
    },
    "ui": {
      "search_placeholder": "Rechercher...",
      "no_items_found": "Aucun élément trouvé",
      "submissions_section": "Soumettre Pièces",
      "support_section": "Support"
    }
  },
  "it": {
    "title": "Tech - Equivalenza Parti",
    "description": "Un elenco completo di parti che possono essere trovate presso i venditori di parti locali",
    "keywords": "parti Classic Mini, equivalenza parti, parti Mini Cooper, filtro olio, filtro aria, alternatore, riferimento incrociato parti, ricambi auto locali",
    "hero_title": "Equivalenza Parti",
    "breadcrumb_title": "Equivalenza Parti",
    "og_title": "Tech - Equivalenza Parti",
    "og_description": "Un elenco completo di parti che possono essere trovate presso i venditori di parti locali",
    "twitter_title": "Tech - Equivalenza Parti",
    "twitter_description": "Un elenco completo di parti che possono essere trovate presso i venditori di parti locali",
    "main_heading": "Equivalenza Parti",
    "description_text": "Questa pagina documenta i numeri di parte comuni per varie parti del Classic Mini che possono essere trovate nei negozi locali vicino a te. Queste equivalenze ti aiutano a procurarti parti senza dover ordinare parti specializzate Mini, risparmiando tempo e spesso denaro.",
    "contact_card": {
      "link_title": "Contattaci per inviare informazioni sui pezzi",
      "heading": "Conosci una parte equivalente?",
      "description": "Invia i tuoi numeri di parte e marche conosciute per aiutare la comunità.",
      "alt_text": "Icona modulo di contatto"
    },
    "table_headers": {
      "brand": "Marca",
      "part_number": "Numero Parte",
      "usage_info": "Informazioni Utilizzo"
    },
    "submissions": {
      "heading": "Invia le Tue Equivalenze di Parti",
      "description": "Aiuta la comunità Classic Mini condividendo i numeri di parte che hai scoperto funzionare perfettamente nella tua Mini. I tuoi contributi aiutano altri appassionati a trovare parti nei loro negozi locali.",
      "what_to_include": {
        "heading": "Cosa Includere:",
        "brand": "Nome del marchio (es., Mann, Bosch, Champion)",
        "part_number": "Numero di parte esatto",
        "fits": "Quali modelli/anni Mini si adatta",
        "store": "Dove l'hai trovato (opzionale)"
      },
      "examples": {
        "heading": "Esempi:",
        "oil_filter": "Filtro olio Mann W610/3 per motori 998cc",
        "spark_plug": "Candele NGK BP6ES per messa a punto standard",
        "brake_pad": "Pastiglie EBC GreenStuff per dischi 7.5\""
      },
      "submit_button": "Invia Informazioni Parti"
    },
    "mailto": {
      "subject": "Invio Equivalenza Parti - Classic Mini DIY",
      "body": "Ciao Cole,\n\nVorrei inviare un'equivalenza di parti per il database Classic Mini DIY:\n\nNome Marca: \nNumero Parte: \nCosa si adatta (modello/anno Mini): \nDove l'ho trovato (negozio/sito web): \nNote aggiuntive: \n\nGrazie!\n"
    },
    "ui": {
      "search_placeholder": "Cerca...",
      "no_items_found": "Nessun elemento trovato",
      "submissions_section": "Invia Parti",
      "support_section": "Supporto"
    }
  },
  "de": {
    "title": "Tech - Teileäquivalenz",
    "description": "Eine vollständige Liste von Teilen, die bei lokalen Teilehändlern gefunden werden können",
    "keywords": "Classic Mini Teile, Teileäquivalenz, Mini Cooper Teile, Ölfilter, Luftfilter, Lichtmaschine, Teile-Querverweise, lokale Autoteile",
    "hero_title": "Teileäquivalenz",
    "breadcrumb_title": "Teileäquivalenz",
    "og_title": "Tech - Teileäquivalenz",
    "og_description": "Eine vollständige Liste von Teilen, die bei lokalen Teilehändlern gefunden werden können",
    "twitter_title": "Tech - Teileäquivalenz",
    "twitter_description": "Eine vollständige Liste von Teilen, die bei lokalen Teilehändlern gefunden werden können",
    "main_heading": "Teileäquivalenz",
    "description_text": "Diese Seite dokumentiert gängige Teilenummern für verschiedene Classic Mini Teile, die in lokalen Geschäften in Ihrer Nähe gefunden werden können. Diese Äquivalenzen helfen Ihnen, Teile zu beschaffen, ohne spezielle Mini-Teile bestellen zu müssen, was Zeit und oft Geld spart.",
    "contact_card": {
      "link_title": "Kontaktieren Sie uns, um Teileinformationen zu übermitteln",
      "heading": "Kennen Sie ein passendes Teil?",
      "description": "Übermitteln Sie Ihre eigenen bekannten passenden Teilenummern und Marken, um der Gemeinschaft zu helfen.",
      "alt_text": "Kontaktformular-Symbol"
    },
    "table_headers": {
      "brand": "Marke",
      "part_number": "Teilenummer",
      "usage_info": "Verwendungsinfo"
    },
    "submissions": {
      "heading": "Reichen Sie Ihre Eigenen Teileäquivalenzen Ein",
      "description": "Helfen Sie der Classic Mini Gemeinschaft, indem Sie Teilenummern teilen, die Sie entdeckt haben und die perfekt in Ihrem Mini funktionieren. Ihre Beiträge helfen anderen Enthusiasten, Teile in ihren lokalen Geschäften zu finden.",
      "what_to_include": {
        "heading": "Was zu Beinhalten:",
        "brand": "Markenname (z.B., Mann, Bosch, Champion)",
        "part_number": "Exakte Teilenummer",
        "fits": "Welche Mini Modelle/Jahre es passt",
        "store": "Wo Sie es gefunden haben (optional)"
      },
      "examples": {
        "heading": "Beispiele:",
        "oil_filter": "Mann W610/3 Ölfilter für 998cc Motoren",
        "spark_plug": "NGK BP6ES Zündkerzen für Standard-Abstimmung",
        "brake_pad": "EBC GreenStuff Bremsbeläge für 7.5\" Scheiben"
      },
      "submit_button": "Teileinformationen Einreichen"
    },
    "mailto": {
      "subject": "Teileäquivalenz-Einreichung - Classic Mini DIY",
      "body": "Hallo Cole,\n\nIch möchte eine Teileäquivalenz für die Classic Mini DIY Datenbank einreichen:\n\nMarkenname: \nTeilenummer: \nWas es passt (Mini Modell/Jahr): \nWo ich es gefunden habe (Geschäft/Website): \nZusätzliche Notizen: \n\nDanke!\n"
    },
    "ui": {
      "search_placeholder": "Suchen...",
      "no_items_found": "Keine Elemente gefunden",
      "submissions_section": "Teile Einreichen",
      "support_section": "Support"
    }
  },
  "pt": {
    "title": "Tech - Equivalência de Peças",
    "description": "Uma lista completa de peças que podem ser encontradas em vendedores de peças locais",
    "keywords": "peças Classic Mini, equivalência de peças, peças Mini Cooper, filtro de óleo, filtro de ar, alternador, referência cruzada de peças, peças de auto locais",
    "hero_title": "Equivalência de Peças",
    "breadcrumb_title": "Equivalência de Peças",
    "og_title": "Tech - Equivalência de Peças",
    "og_description": "Uma lista completa de peças que podem ser encontradas em vendedores de peças locais",
    "twitter_title": "Tech - Equivalência de Peças",
    "twitter_description": "Uma lista completa de peças que podem ser encontradas em vendedores de peças locais",
    "main_heading": "Equivalência de Peças",
    "description_text": "Esta página documenta números de peças comuns para várias peças do Classic Mini que podem ser encontradas em lojas locais perto de você. Essas equivalências ajudam você a obter peças sem ter que encomendar peças especializadas Mini, economizando tempo e frequentemente dinheiro.",
    "contact_card": {
      "link_title": "Entre em contato para enviar informações de peças",
      "heading": "Conhece uma peça equivalente?",
      "description": "Envie seus próprios números de peças e marcas conhecidas para ajudar a comunidade.",
      "alt_text": "Ícone de formulário de contato"
    },
    "table_headers": {
      "brand": "Marca",
      "part_number": "Número da Peça",
      "usage_info": "Informações de Uso"
    },
    "submissions": {
      "heading": "Envie Suas Próprias Equivalências de Peças",
      "description": "Ajude a comunidade Classic Mini compartilhando números de peças que você descobriu que funcionam perfeitamente no seu Mini. Suas contribuições ajudam outros entusiastas a encontrar peças em suas lojas locais.",
      "what_to_include": {
        "heading": "O Que Incluir:",
        "brand": "Nome da marca (ex., Mann, Bosch, Champion)",
        "part_number": "Número da peça exato",
        "fits": "Quais modelos/anos de Mini se encaixa",
        "store": "Onde você encontrou (opcional)"
      },
      "examples": {
        "heading": "Exemplos:",
        "oil_filter": "Filtro de óleo Mann W610/3 para motores 998cc",
        "spark_plug": "Velas NGK BP6ES para ajuste padrão",
        "brake_pad": "Pastilhas EBC GreenStuff para discos 7.5\""
      },
      "submit_button": "Enviar Informações de Peças"
    },
    "mailto": {
      "subject": "Envio de Equivalência de Peças - Classic Mini DIY",
      "body": "Oi Cole,\n\nGostaria de enviar uma equivalência de peças para o banco de dados Classic Mini DIY:\n\nNome da Marca: \nNúmero da Peça: \nO que se encaixa (modelo/ano Mini): \nOnde encontrei (loja/site): \nNotas adicionais: \n\nObrigado!\n"
    },
    "ui": {
      "search_placeholder": "Pesquisar...",
      "no_items_found": "Nenhum item encontrado",
      "submissions_section": "Enviar Peças",
      "support_section": "Suporte"
    }
  },
  "ru": {
    "title": "Tech - Эквивалентность деталей",
    "description": "Полный список деталей, которые можно найти у местных продавцов деталей",
    "keywords": "детали Classic Mini, эквивалентность деталей, детали Mini Cooper, масляный фильтр, воздушный фильтр, генератор, перекрестные ссылки деталей, местные автозапчасти",
    "hero_title": "Эквивалентность деталей",
    "breadcrumb_title": "Эквивалентность деталей",
    "og_title": "Tech - Эквивалентность деталей",
    "og_description": "Полный список деталей, которые можно найти у местных продавцов деталей",
    "twitter_title": "Tech - Эквивалентность деталей",
    "twitter_description": "Полный список деталей, которые можно найти у местных продавцов деталей",
    "main_heading": "Эквивалентность деталей",
    "description_text": "Эта страница документирует общие номера деталей для различных деталей Classic Mini, которые можно найти в местных магазинах рядом с вами. Эти эквиваленты помогают вам получать детали без необходимости заказывать специализированные детали Mini, экономя время и часто деньги.",
    "contact_card": {
      "link_title": "Свяжитесь с нами для отправки информации о деталях",
      "heading": "Знаете подходящую деталь?",
      "description": "Отправьте свои известные номера деталей и бренды, чтобы помочь сообществу.",
      "alt_text": "Иконка контактной формы"
    },
    "table_headers": {
      "brand": "Бренд",
      "part_number": "Номер детали",
      "usage_info": "Информация об использовании"
    },
    "submissions": {
      "heading": "Отправьте Свои Эквиваленты Деталей",
      "description": "Помогите сообществу Classic Mini, делясь номерами деталей, которые вы обнаружили и которые идеально работают в вашем Mini. Ваши вклады помогают другим энтузиастам находить детали в своих местных магазинах.",
      "what_to_include": {
        "heading": "Что Включить:",
        "brand": "Название бренда (напр., Mann, Bosch, Champion)",
        "part_number": "Точный номер детали",
        "fits": "Какие модели/годы Mini подходит",
        "store": "Где вы нашли (необязательно)"
      },
      "examples": {
        "heading": "Примеры:",
        "oil_filter": "Масляный фильтр Mann W610/3 для двигателей 998cc",
        "spark_plug": "Свечи NGK BP6ES для стандартной настройки",
        "brake_pad": "Колодки EBC GreenStuff для дисков 7.5\""
      },
      "submit_button": "Отправить Информацию о Деталях"
    },
    "mailto": {
      "subject": "Отправка Эквивалентности Деталей - Classic Mini DIY",
      "body": "Привет Cole,\n\nЯ хотел бы отправить эквивалентность деталей для базы данных Classic Mini DIY:\n\nНазвание Бренда: \nНомер Детали: \nК чему подходит (модель/год Mini): \nГде я нашёл (магазин/сайт): \nДополнительные замечания: \n\nСпасибо!\n"
    },
    "ui": {
      "search_placeholder": "Поиск...",
      "no_items_found": "Элементы не найдены",
      "submissions_section": "Отправить Детали",
      "support_section": "Поддержка"
    }
  },
  "ja": {
    "title": "Tech - パーツ互換性",
    "description": "地元のパーツ販売店で見つけることができるパーツの完全なリスト",
    "keywords": "クラシックミニ部品, パーツ互換性, ミニクーパー部品, オイルフィルター, エアフィルター, オルタネーター, 部品クロスリファレンス, 地元の自動車部品",
    "hero_title": "パーツ互換性",
    "breadcrumb_title": "パーツ互換性",
    "og_title": "Tech - パーツ互換性",
    "og_description": "地元のパーツ販売店で見つけることができるパーツの完全なリスト",
    "twitter_title": "Tech - パーツ互換性",
    "twitter_description": "地元のパーツ販売店で見つけることができるパーツの完全なリスト",
    "main_heading": "パーツ互換性",
    "description_text": "このページは、お近くの地元店舗で見つけることができる様々なクラシックミニパーツの一般的なパーツ番号を文書化しています。これらの等価物は、専用のミニパーツを注文する必要なくパーツを入手するのに役立ち、時間としばしばお金を節約できます。",
    "contact_card": {
      "link_title": "パーツ情報を送信するためにお問い合わせください",
      "heading": "一致するパーツをご存知ですか？",
      "description": "コミュニティを支援するために、あなたが知っている一致するパーツ番号とブランドを送信してください。",
      "alt_text": "お問い合わせフォームアイコン"
    },
    "table_headers": {
      "brand": "ブランド",
      "part_number": "パーツ番号",
      "usage_info": "使用情報"
    },
    "submissions": {
      "heading": "独自のパーツ等価品を提出してください",
      "description": "あなたのミニで完美に動作することを発見したパーツ番号を共有して、クラシックミニコミュニティを支援してください。あなたの貢献は、他のエンシュージアストが地元の店舗でパーツを見つけるのに役立ちます。",
      "what_to_include": {
        "heading": "含めるべき内容:",
        "brand": "ブランド名 (例: Mann、Bosch、Champion)",
        "part_number": "正確なパーツ番号",
        "fits": "適合するミニのモデル/年式",
        "store": "見つけた場所 (オプション)"
      },
      "examples": {
        "heading": "例:",
        "oil_filter": "998ccエンジン用Mann W610/3オイルフィルター",
        "spark_plug": "標準チューン用NGK BP6ESプラグ",
        "brake_pad": "7.5\"ディスク用EBC GreenStuffパッド"
      },
      "submit_button": "パーツ情報を送信"
    },
    "mailto": {
      "subject": "パーツ等価情報の提出 - Classic Mini DIY",
      "body": "Coleさん、こんにちは\n\nClassic Mini DIYデータベースにパーツ等価情報を提出したいと思います：\n\nブランド名: \nパーツ番号: \n適合する車種 (ミニモデル/年式): \n見つけた場所 (店舗/ウェブサイト): \n追加メモ: \n\nよろしくお願いします！\n"
    },
    "ui": {
      "search_placeholder": "検索...",
      "no_items_found": "アイテムが見つかりません",
      "submissions_section": "パーツ送信",
      "support_section": "サポート"
    }
  },
  "zh": {
    "title": "Tech - 零件等效性",
    "description": "可以在当地零件销售商处找到的零件完整列表",
    "keywords": "经典迷你零件, 零件等效性, 迷你库珀零件, 机油滤清器, 空气滤清器, 发电机, 零件交叉参考, 当地汽车零件",
    "hero_title": "零件等效性",
    "breadcrumb_title": "零件等效性",
    "og_title": "Tech - 零件等效性",
    "og_description": "可以在当地零件销售商处找到的零件完整列表",
    "twitter_title": "Tech - 零件等效性",
    "twitter_description": "可以在当地零件销售商处找到的零件完整列表",
    "main_heading": "零件等效性",
    "description_text": "本页面记录了各种经典迷你零件的常见零件号，这些零件可以在您附近的当地商店找到。这些等效信息可以帮助您采购零件，而无需订购专用的迷你零件，节省时间和费用。",
    "contact_card": {
      "link_title": "联系我们提交零件信息",
      "heading": "知道匹配的零件吗？",
      "description": "提交您知道的匹配零件号和品牌，帮助社区。",
      "alt_text": "联系表单图标"
    },
    "table_headers": {
      "brand": "品牌",
      "part_number": "零件号",
      "usage_info": "使用信息"
    },
    "submissions": {
      "heading": "提交您自己的零件等效信息",
      "description": "通过分享您发现的在您的Mini中完美工作的零件号来帮助经典Mini社区。您的贡献可以帮助其他爱好者在他们当地商店找到零件。",
      "what_to_include": {
        "heading": "包含内容：",
        "brand": "品牌名称 (例如，Mann、Bosch、Champion)",
        "part_number": "确切的零件号",
        "fits": "适合的Mini型号/年份",
        "store": "您找到它的地方 (可选)"
      },
      "examples": {
        "heading": "示例：",
        "oil_filter": "998cc发动机Mann W610/3机油滤清器",
        "spark_plug": "标准调校NGK BP6ES火花塞",
        "brake_pad": "7.5\"制动盘EBC GreenStuff制动片"
      },
      "submit_button": "提交零件信息"
    },
    "mailto": {
      "subject": "零件等效提交 - Classic Mini DIY",
      "body": "您好 Cole，\n\n我想为Classic Mini DIY数据库提交一个零件等效信息：\n\n品牌名称： \n零件号： \n适合车型（Mini型号/年份）： \n找到地点（商店/网站）： \n附加说明： \n\n谢谢！\n"
    },
    "ui": {
      "search_placeholder": "搜索...",
      "no_items_found": "未找到项目",
      "submissions_section": "提交零件",
      "support_section": "支持"
    }
  },
  "ko": {
    "title": "Tech - 부품 등가성",
    "description": "지역 부품 판매업체에서 찾을 수 있는 부품의 완전한 목록",
    "keywords": "클래식 미니 부품, 부품 등가성, 미니 쿠퍼 부품, 오일 필터, 에어 필터, 알터네이터, 부품 교차 참조, 지역 자동차 부품",
    "hero_title": "부품 등가성",
    "breadcrumb_title": "부품 등가성",
    "og_title": "Tech - 부품 등가성",
    "og_description": "지역 부품 판매업체에서 찾을 수 있는 부품의 완전한 목록",
    "twitter_title": "Tech - 부품 등가성",
    "twitter_description": "지역 부품 판매업체에서 찾을 수 있는 부품의 완전한 목록",
    "main_heading": "부품 등가성",
    "description_text": "이 페이지는 근처 지역 매장에서 찾을 수 있는 다양한 클래식 미니 부품의 일반적인 부품 번호를 문서화합니다. 이러한 등가 정보는 전문 미니 부품을 주문할 필요 없이 부품을 조달하는 데 도움을 주어 시간과 종종 비용을 절약합니다.",
    "contact_card": {
      "link_title": "부품 정보 제출을 위해 문의하세요",
      "heading": "매칭되는 부품을 알고 있나요?",
      "description": "커뮤니티를 도울 수 있도록 알고 있는 매칭 부품 번호와 브랜드를 제출하세요.",
      "alt_text": "연락처 양식 아이콘"
    },
    "table_headers": {
      "brand": "브랜드",
      "part_number": "부품 번호",
      "usage_info": "사용 정보"
    },
    "submissions": {
      "heading": "당신만의 부품 등가성 제출",
      "description": "당신의 미니에서 완벽하게 작동하는 것을 발견한 부품 번호를 공유하여 클래식 미니 커뮤니티를 도와주세요. 당신의 기여는 다른 애호가들이 지역 매장에서 부품을 찾는 데 도움이 됩니다.",
      "what_to_include": {
        "heading": "포함할 내용:",
        "brand": "브랜드 이름 (예: Mann, Bosch, Champion)",
        "part_number": "정확한 부품 번호",
        "fits": "어떤 미니 모델/연도에 맞는지",
        "store": "어디서 찾았는지 (선택사항)"
      },
      "examples": {
        "heading": "예시:",
        "oil_filter": "998cc 엔진용 Mann W610/3 오일필터",
        "spark_plug": "표준 튜닝용 NGK BP6ES 플러그",
        "brake_pad": "7.5\" 디스크용 EBC GreenStuff 패드"
      },
      "submit_button": "부품 정보 제출"
    },
    "mailto": {
      "subject": "부품 등가성 제출 - Classic Mini DIY",
      "body": "안녕하세요 Cole,\n\nClassic Mini DIY 데이터베이스에 부품 등가성을 제출하고 싶습니다:\n\n브랜드 이름: \n부품 번호: \n적합한 차량 (미니 모델/연도): \n찾은 곳 (매장/웹사이트): \n추가 메모: \n\n감사합니다!\n"
    },
    "ui": {
      "search_placeholder": "검색...",
      "no_items_found": "항목을 찾을 수 없음",
      "submissions_section": "부품 제출",
      "support_section": "지원"
    }
  }
}
</i18n>
