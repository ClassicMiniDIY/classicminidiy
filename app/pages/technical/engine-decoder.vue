<script lang="ts" setup>
  import { h } from 'vue';
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';
  const { data: engineCodes } = await useFetch('/api/decoders/engine');
  const search = ref('');

  // Column definitions for Nuxt UI table
  const tableColumns = [
    {
      accessorKey: 'color',
      header: () => $t('table.headers.color'),
      cell: ({ row }) =>
        h('i', {
          class: `fas fa-circle pt-1 color-${row.getValue('size')}`,
        }),
      enableSorting: false,
    },
    {
      accessorKey: 'code',
      header: () => $t('table.headers.code'),
      cell: ({ row }) => row.getValue('code'),
    },
    {
      accessorKey: 'size',
      header: () => $t('table.headers.engine_size'),
      cell: ({ row }) => row.getValue('size'),
    },
    {
      accessorKey: 'variant',
      header: () => $t('table.headers.engine_variant'),
      cell: ({ row }) => row.getValue('variant'),
    },
    {
      accessorKey: 'gearbox',
      header: () => $t('table.headers.gearbox_details'),
      cell: ({ row }) => row.getValue('gearbox'),
    },
    {
      accessorKey: 'description',
      header: () => $t('table.headers.details'),
      cell: ({ row }) => row.getValue('description'),
    },
  ];

  const { capture } = usePostHog();

  // Computed property for filtered engine codes
  const filteredEngineCodes = computed(() => {
    if (!engineCodes.value) return [];
    if (!search.value) return engineCodes.value;

    const searchTerm = search.value.toLowerCase();
    return engineCodes.value.filter((item) => {
      return (
        item.code.toLowerCase().includes(searchTerm) ||
        item.size.toLowerCase().includes(searchTerm) ||
        item.variant.toLowerCase().includes(searchTerm) ||
        item.gearbox.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm)
      );
    });
  });

  let engineSearchTimer: ReturnType<typeof setTimeout> | null = null;
  watch(search, (val) => {
    if (!val) return;
    if (engineSearchTimer) clearTimeout(engineSearchTimer);
    engineSearchTimer = setTimeout(() => {
      capture('decoder_used', {
        decoder: 'engine',
        search_term: val,
        results_count: filteredEngineCodes.value.length,
      });
    }, 1000);
  });

  onUnmounted(() => {
    if (engineSearchTimer) clearTimeout(engineSearchTimer);
  });

  useHead({
    title: $t('title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: $t('description'),
      },
      {
        key: 'keywords',
        name: 'keywords',
        content: $t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/technical/engine-decoder',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // Dataset structured data for engine codes
  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Classic Mini Engine Code Database',
    description: $t('description'),
    url: 'https://classicminidiy.com/technical/engine-decoder',
    keywords: ['Classic Mini', 'engine codes', 'Mini Cooper', 'A-series engine'],
    creator: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
    },
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
    ogTitle: $t('og_title'),
    ogDescription: $t('og_description'),
    ogUrl: 'https://classicminidiy.com/technical/engine-decoder',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/engine-decoder.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('twitter_title'),
    twitterDescription: $t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/engine-decoder.png',
  });
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :subtitle="$t('keep_minis_driving')" :heroType="HERO_TYPES.TECH" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
      <div class="col-span-12">
        <breadcrumb class="my-4" :version="BREADCRUMB_VERSIONS.TECH" :page="$t('breadcrumb_title')"></breadcrumb>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="col-span-12 md:col-span-7">
            <h1 class="text-3xl font-bold mb-4">{{ $t('main_heading') }}</h1>
            <p class="mb-4">
              {{ $t('description_text') }}
            </p>
            <EnginePlateModal></EnginePlateModal>
          </div>
          <div class="col-span-12 md:col-span-5">
            <NuxtLink :to="'/technical/chassis-decoder'" :title="$t('chassis_decoder_card.link_title')" class="block">
              <UCard class="hover:shadow-lg transition-shadow">
                <div class="flex items-center">
                  <div class="shrink-0">
                    <picture>
                      <source
                        srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.webp"
                        type="image/webp"
                      />
                      <source
                        srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.png"
                        type="image/png"
                      />
                      <nuxt-img
                        loading="lazy"
                        src="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-blueprint-zoom-100.png"
                        :alt="$t('chassis_decoder_card.alt_text')"
                        class="w-16 h-16"
                      />
                    </picture>
                  </div>
                  <div class="ml-4">
                    <h2 class="text-xl font-semibold mb-2">
                      {{ $t('chassis_decoder_card.heading') }}
                    </h2>
                    <p class="text-gray-600">
                      {{ $t('chassis_decoder_card.description') }}
                    </p>
                  </div>
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-span-12">
        <div class="col-span-12 pb-5">
          <i class="fas fa-circle pl-1 color-850"></i>
          {{ $t('engine_sizes_legend.850cc') }}
          <i class="fas fa-circle pl-1 color-970"></i>
          {{ $t('engine_sizes_legend.970cc') }}
          <i class="fas fa-circle pl-1 color-997"></i>
          {{ $t('engine_sizes_legend.997cc') }}
          <i class="fas fa-circle pl-1 color-998"></i>
          {{ $t('engine_sizes_legend.998cc') }}
          <i class="fas fa-circle pl-1 color-1070"></i>
          {{ $t('engine_sizes_legend.1070cc') }}
          <i class="fas fa-circle pl-1 color-1100"></i>
          {{ $t('engine_sizes_legend.1100cc') }}
          <i class="fas fa-circle pl-1 color-1275"></i>
          {{ $t('engine_sizes_legend.1275cc') }}
        </div>
        <div class="col-span-12 md:col-span-6">
          <div class="pb-5">
            <UInput v-model="search" :placeholder="$t('search.placeholder')" class="w-full">
              <template #leading>
                <i class="fad fa-search"></i>
              </template>
            </UInput>
          </div>
        </div>
        <div class="col-span-12">
          <UCard>
            <template #header>
              <div class="flex items-center bg-muted -m-4 p-4 rounded-t-lg">
                <div>
                  <i class="fad fa-engine text-2xl"></i>
                </div>
                <h3 class="text-xl font-semibold ml-2">
                  {{ $t('table.title') }}
                </h3>
              </div>
            </template>

            <div class="w-full overflow-x-auto">
              <UTable :data="filteredEngineCodes" :columns="tableColumns" class="w-full min-w-full" />
            </div>
          </UCard>
        </div>
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator :label="$t('ui.support_section')" class="mb-4" />
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Tech - Mini Engine Plate Decoder",
    "description": "Decode your Classic Mini's Engine plate to determine the engine size and features of your car. This plate is located in the same place across all mini generations and is used to identify the engine size and features.",
    "keywords": "engine decoder, Classic Mini engine codes, A-series engine, Mini Cooper engine, engine plate decoder, engine identification, engine size lookup",
    "hero_title": "Engine Code Decoder",
    "breadcrumb_title": "Engine Sizes",
    "og_title": "Tech - Mini Engine Plate Decoder",
    "og_description": "Decode your Classic Mini's Engine plate to determine the engine size and features of your car. This plate is located in the same place across all mini generations and is used to identify the engine size and features.",
    "twitter_title": "Tech - Mini Engine Plate Decoder",
    "twitter_description": "Decode your Classic Mini's Engine plate to determine the engine size and features of your car.",
    "main_heading": "Engine Plate Decoder",
    "description_text": "The engine plate is a series of numbers and letters that are stamped on a metal plate that is riveted to the engine near the water pump. This plate is located in the same place across all mini generations and is used to identify the engine size and features.",
    "keep_minis_driving": "Keeping Minis Driving",
    "mini_toolbox": "Classic Mini Technical Toolbox",
    "chassis_decoder_card": {
      "link_title": "Link to Chassis Decoder Tool",
      "heading": "Need to decode your Chassis Number?",
      "description": "Click here to identify your car using our new chassis number decoding tool.",
      "alt_text": "Image of magnifying glass"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "Search your engine code"
    },
    "table": {
      "title": "Engine Codes",
      "headers": {
        "color": "",
        "code": "Code",
        "engine_size": "Engine Size",
        "engine_variant": "Engine Variant",
        "gearbox_details": "Gearbox Details",
        "details": "Details"
      }
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "es": {
    "title": "Técnico - Decodificador de Placa del Motor Mini",
    "description": "Decodifica la placa del motor de tu Classic Mini para determinar el tamaño del motor y las características de tu coche. Esta placa está ubicada en el mismo lugar en todas las generaciones de mini y se usa para identificar el tamaño del motor y las características.",
    "keywords": "decodificador de motor, códigos de motor Classic Mini, motor serie A, motor Mini Cooper, decodificador de placa de motor, identificación de motor, búsqueda de tamaño de motor",
    "hero_title": "Decodificador de Código de Motor",
    "breadcrumb_title": "Tamaños de Motor",
    "og_title": "Técnico - Decodificador de Placa del Motor Mini",
    "og_description": "Decodifica la placa del motor de tu Classic Mini para determinar el tamaño del motor y las características de tu coche. Esta placa está ubicada en el mismo lugar en todas las generaciones de mini y se usa para identificar el tamaño del motor y las características.",
    "twitter_title": "Técnico - Decodificador de Placa del Motor Mini",
    "twitter_description": "Decodifica la placa del motor de tu Classic Mini para determinar el tamaño del motor y las características de tu coche.",
    "main_heading": "Decodificador de Placa del Motor",
    "description_text": "La placa del motor es una serie de números y letras que están estampados en una placa metálica que está remachada al motor cerca de la bomba de agua. Esta placa está ubicada en el mismo lugar en todas las generaciones de mini y se usa para identificar el tamaño del motor y las características.",
    "keep_minis_driving": "Manteniendo los Minis en Marcha",
    "mini_toolbox": "Caja de Herramientas Técnicas del Classic Mini",
    "chassis_decoder_card": {
      "link_title": "Enlace a la Herramienta Decodificadora de Chasis",
      "heading": "¿Necesitas decodificar tu Número de Chasis?",
      "description": "Haz clic aquí para identificar tu coche usando nuestra nueva herramienta de decodificación de número de chasis.",
      "alt_text": "Imagen de lupa"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "Busca tu código de motor"
    },
    "table": {
      "title": "Códigos de Motor",
      "headers": {
        "color": "",
        "code": "Código",
        "engine_size": "Tamaño del Motor",
        "engine_variant": "Variante del Motor",
        "gearbox_details": "Detalles de la Caja de Cambios",
        "details": "Detalles"
      }
    },
    "ui": {
      "support_section": "Soporte"
    }
  },
  "fr": {
    "title": "Technique - Décodeur de Plaque Moteur Mini",
    "description": "Décodez la plaque moteur de votre Classic Mini pour déterminer la taille du moteur et les caractéristiques de votre voiture. Cette plaque est située au même endroit sur toutes les générations de mini et est utilisée pour identifier la taille du moteur et les caractéristiques.",
    "keywords": "décodeur de moteur, codes moteur Classic Mini, moteur série A, moteur Mini Cooper, décodeur plaque moteur, identification moteur, recherche taille moteur",
    "hero_title": "Décodeur de Code Moteur",
    "breadcrumb_title": "Tailles de Moteur",
    "og_title": "Technique - Décodeur de Plaque Moteur Mini",
    "og_description": "Décodez la plaque moteur de votre Classic Mini pour déterminer la taille du moteur et les caractéristiques de votre voiture. Cette plaque est située au même endroit sur toutes les générations de mini et est utilisée pour identifier la taille du moteur et les caractéristiques.",
    "twitter_title": "Technique - Décodeur de Plaque Moteur Mini",
    "twitter_description": "Décodez la plaque moteur de votre Classic Mini pour déterminer la taille du moteur et les caractéristiques de votre voiture.",
    "main_heading": "Décodeur de Plaque Moteur",
    "description_text": "La plaque moteur est une série de numéros et de lettres qui sont estampés sur une plaque métallique qui est rivetée au moteur près de la pompe à eau. Cette plaque est située au même endroit sur toutes les générations de mini et est utilisée pour identifier la taille du moteur et les caractéristiques.",
    "keep_minis_driving": "Garder les Minis en Marche",
    "mini_toolbox": "Boîte à Outils Technique Classic Mini",
    "chassis_decoder_card": {
      "link_title": "Lien vers l'Outil Décodeur de Châssis",
      "heading": "Besoin de décoder votre Numéro de Châssis ?",
      "description": "Cliquez ici pour identifier votre voiture en utilisant notre nouvel outil de décodage de numéro de châssis.",
      "alt_text": "Image de loupe"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "Recherchez votre code moteur"
    },
    "table": {
      "title": "Codes Moteur",
      "headers": {
        "color": "",
        "code": "Code",
        "engine_size": "Taille du Moteur",
        "engine_variant": "Variante du Moteur",
        "gearbox_details": "Détails de la Boîte de Vitesses",
        "details": "Détails"
      }
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "it": {
    "title": "Tecnico - Decodificatore Piastra Motore Mini",
    "description": "Decodifica la piastra del motore della tua Classic Mini per determinare la dimensione del motore e le caratteristiche della tua auto. Questa piastra si trova nello stesso posto su tutte le generazioni di mini ed è usata per identificare la dimensione del motore e le caratteristiche.",
    "keywords": "decodificatore motore, codici motore Classic Mini, motore serie A, motore Mini Cooper, decodificatore piastra motore, identificazione motore, ricerca dimensione motore",
    "hero_title": "Decodificatore Codice Motore",
    "breadcrumb_title": "Dimensioni Motore",
    "og_title": "Tecnico - Decodificatore Piastra Motore Mini",
    "og_description": "Decodifica la piastra del motore della tua Classic Mini per determinare la dimensione del motore e le caratteristiche della tua auto. Questa piastra si trova nello stesso posto su tutte le generazioni di mini ed è usata per identificare la dimensione del motore e le caratteristiche.",
    "twitter_title": "Tecnico - Decodificatore Piastra Motore Mini",
    "twitter_description": "Decodifica la piastra del motore della tua Classic Mini per determinare la dimensione del motore e le caratteristiche della tua auto.",
    "main_heading": "Decodificatore Piastra Motore",
    "description_text": "La piastra del motore è una serie di numeri e lettere che sono stampati su una piastra metallica che è rivettata al motore vicino alla pompa dell'acqua. Questa piastra si trova nello stesso posto su tutte le generazioni di mini ed è usata per identificare la dimensione del motore e le caratteristiche.",
    "keep_minis_driving": "Mantenere le Mini in Movimento",
    "mini_toolbox": "Cassetta degli Attrezzi Tecnica Classic Mini",
    "chassis_decoder_card": {
      "link_title": "Link allo Strumento Decodificatore Telaio",
      "heading": "Hai bisogno di decodificare il tuo Numero di Telaio?",
      "description": "Clicca qui per identificare la tua auto usando il nostro nuovo strumento di decodifica del numero di telaio.",
      "alt_text": "Immagine di lente d'ingrandimento"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "Cerca il tuo codice motore"
    },
    "table": {
      "title": "Codici Motore",
      "headers": {
        "color": "",
        "code": "Codice",
        "engine_size": "Dimensione Motore",
        "engine_variant": "Variante Motore",
        "gearbox_details": "Dettagli Cambio",
        "details": "Dettagli"
      }
    },
    "ui": {
      "support_section": "Supporto"
    }
  },
  "de": {
    "title": "Technik - Mini Motorplaketten-Decoder",
    "description": "Decodieren Sie die Motorplakette Ihres Classic Mini, um die Motorgröße und die Eigenschaften Ihres Autos zu bestimmen. Diese Plakette befindet sich bei allen Mini-Generationen an derselben Stelle und wird zur Identifizierung der Motorgröße und der Eigenschaften verwendet.",
    "keywords": "Motor-Decoder, Classic Mini Motorcodes, A-Serie Motor, Mini Cooper Motor, Motorplaketten-Decoder, Motor-Identifikation, Motorgröße-Suche",
    "hero_title": "Motorcode-Decoder",
    "breadcrumb_title": "Motorgrößen",
    "og_title": "Technik - Mini Motorplaketten-Decoder",
    "og_description": "Decodieren Sie die Motorplakette Ihres Classic Mini, um die Motorgröße und die Eigenschaften Ihres Autos zu bestimmen. Diese Plakette befindet sich bei allen Mini-Generationen an derselben Stelle und wird zur Identifizierung der Motorgröße und der Eigenschaften verwendet.",
    "twitter_title": "Technik - Mini Motorplaketten-Decoder",
    "twitter_description": "Decodieren Sie die Motorplakette Ihres Classic Mini, um die Motorgröße und die Eigenschaften Ihres Autos zu bestimmen.",
    "main_heading": "Motorplaketten-Decoder",
    "description_text": "Die Motorplakette ist eine Reihe von Zahlen und Buchstaben, die auf eine Metallplakette gestempelt sind, die in der Nähe der Wasserpumpe am Motor genietet ist. Diese Plakette befindet sich bei allen Mini-Generationen an derselben Stelle und wird zur Identifizierung der Motorgröße und der Eigenschaften verwendet.",
    "keep_minis_driving": "Minis am Fahren Halten",
    "mini_toolbox": "Classic Mini Technische Werkzeugkiste",
    "chassis_decoder_card": {
      "link_title": "Link zum Fahrgestell-Decoder-Tool",
      "heading": "Müssen Sie Ihre Fahrgestellnummer decodieren?",
      "description": "Klicken Sie hier, um Ihr Auto mit unserem neuen Fahrgestellnummer-Decodierungstool zu identifizieren.",
      "alt_text": "Bild einer Lupe"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "Suchen Sie Ihren Motorcode"
    },
    "table": {
      "title": "Motorcodes",
      "headers": {
        "color": "",
        "code": "Code",
        "engine_size": "Motorgröße",
        "engine_variant": "Motorvariante",
        "gearbox_details": "Getriebe-Details",
        "details": "Details"
      }
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "pt": {
    "title": "Técnico - Decodificador de Placa do Motor Mini",
    "description": "Decodifique a placa do motor do seu Classic Mini para determinar o tamanho do motor e as características do seu carro. Esta placa está localizada no mesmo lugar em todas as gerações de mini e é usada para identificar o tamanho do motor e as características.",
    "keywords": "decodificador de motor, códigos de motor Classic Mini, motor série A, motor Mini Cooper, decodificador placa de motor, identificação de motor, pesquisa de tamanho de motor",
    "hero_title": "Decodificador de Código do Motor",
    "breadcrumb_title": "Tamanhos de Motor",
    "og_title": "Técnico - Decodificador de Placa do Motor Mini",
    "og_description": "Decodifique a placa do motor do seu Classic Mini para determinar o tamanho do motor e as características do seu carro. Esta placa está localizada no mesmo lugar em todas as gerações de mini e é usada para identificar o tamanho do motor e as características.",
    "twitter_title": "Técnico - Decodificador de Placa do Motor Mini",
    "twitter_description": "Decodifique a placa do motor do seu Classic Mini para determinar o tamanho do motor e as características do seu carro.",
    "main_heading": "Decodificador de Placa do Motor",
    "description_text": "A placa do motor é uma série de números e letras que são estampados em uma placa metálica que é rebitada ao motor perto da bomba d'água. Esta placa está localizada no mesmo lugar em todas as gerações de mini e é usada para identificar o tamanho do motor e as características.",
    "keep_minis_driving": "Mantendo os Minis Rodando",
    "mini_toolbox": "Caixa de Ferramentas Técnicas do Classic Mini",
    "chassis_decoder_card": {
      "link_title": "Link para a Ferramenta Decodificadora de Chassi",
      "heading": "Precisa decodificar seu Número de Chassi?",
      "description": "Clique aqui para identificar seu carro usando nossa nova ferramenta de decodificação de número de chassi.",
      "alt_text": "Imagem de lupa"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "Pesquise seu código de motor"
    },
    "table": {
      "title": "Códigos de Motor",
      "headers": {
        "color": "",
        "code": "Código",
        "engine_size": "Tamanho do Motor",
        "engine_variant": "Variante do Motor",
        "gearbox_details": "Detalhes da Caixa de Câmbio",
        "details": "Detalhes"
      }
    },
    "ui": {
      "support_section": "Suporte"
    }
  },
  "ru": {
    "title": "Техника - Декодер Табличек Двигателя Mini",
    "description": "Декодируйте табличку двигателя вашего Classic Mini, чтобы определить размер двигателя и характеристики вашего автомобиля. Эта табличка расположена в одном и том же месте во всех поколениях mini и используется для идентификации размера двигателя и характеристик.",
    "keywords": "декодер двигателя, коды двигателей Classic Mini, двигатель серии A, двигатель Mini Cooper, декодер таблички двигателя, идентификация двигателя, поиск размера двигателя",
    "hero_title": "Декодер Кода Двигателя",
    "breadcrumb_title": "Размеры Двигателей",
    "og_title": "Техника - Декодер Табличек Двигателя Mini",
    "og_description": "Декодируйте табличку двигателя вашего Classic Mini, чтобы определить размер двигателя и характеристики вашего автомобиля. Эта табличка расположена в одном и том же месте во всех поколениях mini и используется для идентификации размера двигателя и характеристик.",
    "twitter_title": "Техника - Декодер Табличек Двигателя Mini",
    "twitter_description": "Декодируйте табличку двигателя вашего Classic Mini, чтобы определить размер двигателя и характеристики вашего автомобиля.",
    "main_heading": "Декодер Табличек Двигателя",
    "description_text": "Табличка двигателя - это серия цифр и букв, которые выштампованы на металлической табличке, которая приклепана к двигателю рядом с водяным насосом. Эта табличка расположена в одном и том же месте во всех поколениях mini и используется для идентификации размера двигателя и характеристик.",
    "keep_minis_driving": "Поддерживая Мини в Движении",
    "mini_toolbox": "Техническая Коробка Инструментов Classic Mini",
    "chassis_decoder_card": {
      "link_title": "Ссылка на Инструмент Декодера Шасси",
      "heading": "Нужно декодировать ваш Номер Шасси?",
      "description": "Нажмите здесь, чтобы идентифицировать ваш автомобиль, используя наш новый инструмент декодирования номера шасси.",
      "alt_text": "Изображение увеличительного стекла"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "Найдите ваш код двигателя"
    },
    "table": {
      "title": "Коды Двигателей",
      "headers": {
        "color": "",
        "code": "Код",
        "engine_size": "Размер Двигателя",
        "engine_variant": "Вариант Двигателя",
        "gearbox_details": "Детали Коробки Передач",
        "details": "Детали"
      }
    },
    "ui": {
      "support_section": "Поддержка"
    }
  },
  "ja": {
    "title": "技術 - ミニエンジンプレートデコーダー",
    "description": "クラシックミニのエンジンプレートをデコードして、車のエンジンサイズと特徴を決定します。このプレートはすべてのミニ世代で同じ場所にあり、エンジンサイズと特徴を識別するために使用されます。",
    "keywords": "エンジンデコーダー, クラシックミニ エンジンコード, Aシリーズエンジン, ミニクーパーエンジン, エンジンプレートデコーダー, エンジン識別, エンジンサイズ検索",
    "hero_title": "エンジンコードデコーダー",
    "breadcrumb_title": "エンジンサイズ",
    "og_title": "技術 - ミニエンジンプレートデコーダー",
    "og_description": "クラシックミニのエンジンプレートをデコードして、車のエンジンサイズと特徴を決定します。このプレートはすべてのミニ世代で同じ場所にあり、エンジンサイズと特徴を識別するために使用されます。",
    "twitter_title": "技術 - ミニエンジンプレートデコーダー",
    "twitter_description": "クラシックミニのエンジンプレートをデコードして、車のエンジンサイズと特徴を決定します。",
    "main_heading": "エンジンプレートデコーダー",
    "description_text": "エンジンプレートは、ウォーターポンプの近くのエンジンにリベット留めされた金属プレートに刻印された一連の数字と文字です。このプレートはすべてのミニ世代で同じ場所にあり、エンジンサイズと特徴を識別するために使用されます。",
    "keep_minis_driving": "ミニを走らせ続ける",
    "mini_toolbox": "クラシックミニ技術ツールボックス",
    "chassis_decoder_card": {
      "link_title": "シャーシデコーダーツールへのリンク",
      "heading": "シャーシ番号をデコードする必要がありますか？",
      "description": "新しいシャーシ番号デコードツールを使用して車を識別するにはここをクリック。",
      "alt_text": "虫眼鏡の画像"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "エンジンコードを検索"
    },
    "table": {
      "title": "エンジンコード",
      "headers": {
        "color": "",
        "code": "コード",
        "engine_size": "エンジンサイズ",
        "engine_variant": "エンジンバリアント",
        "gearbox_details": "ギアボックス詳細",
        "details": "詳細"
      }
    },
    "ui": {
      "support_section": "サポート"
    }
  },
  "zh": {
    "title": "技术 - 迷你发动机铭牌解码器",
    "description": "解码您的经典迷你发动机铭牌以确定您汽车的发动机尺寸和特征。该铭牌在所有迷你世代中都位于同一位置，用于识别发动机尺寸和特征。",
    "keywords": "发动机解码器, 经典迷你发动机代码, A系列发动机, 迷你库珀发动机, 发动机铭牌解码器, 发动机识别, 发动机尺寸查询",
    "hero_title": "发动机代码解码器",
    "breadcrumb_title": "发动机尺寸",
    "og_title": "技术 - 迷你发动机铭牌解码器",
    "og_description": "解码您的经典迷你发动机铭牌以确定您汽车的发动机尺寸和特征。该铭牌在所有迷你世代中都位于同一位置，用于识别发动机尺寸和特征。",
    "twitter_title": "技术 - 迷你发动机铭牌解码器",
    "twitter_description": "解码您的经典迷你发动机铭牌以确定您汽车的发动机尺寸和特征。",
    "main_heading": "发动机铭牌解码器",
    "description_text": "发动机铭牌是一系列数字和字母，印在铆接到水泵附近发动机上的金属铭牌上。该铭牌在所有迷你世代中都位于同一位置，用于识别发动机尺寸和特征。",
    "keep_minis_driving": "保持迷你车行驶",
    "mini_toolbox": "经典迷你技术工具箱",
    "chassis_decoder_card": {
      "link_title": "底盘解码器工具链接",
      "heading": "需要解码您的底盘号码吗？",
      "description": "点击这里使用我们新的底盘号码解码工具识别您的汽车。",
      "alt_text": "放大镜图像"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "搜索您的发动机代码"
    },
    "table": {
      "title": "发动机代码",
      "headers": {
        "color": "",
        "code": "代码",
        "engine_size": "发动机尺寸",
        "engine_variant": "发动机变体",
        "gearbox_details": "变速箱详情",
        "details": "详情"
      }
    },
    "ui": {
      "support_section": "支持"
    }
  },
  "ko": {
    "title": "기술 - 미니 엔진 플레이트 디코더",
    "description": "클래식 미니의 엔진 플레이트를 디코딩하여 자동차의 엔진 크기와 특징을 결정하세요. 이 플레이트는 모든 미니 세대에서 같은 위치에 있으며 엔진 크기와 특징을 식별하는 데 사용됩니다.",
    "keywords": "엔진 디코더, 클래식 미니 엔진 코드, A시리즈 엔진, 미니 쿠퍼 엔진, 엔진 플레이트 디코더, 엔진 식별, 엔진 크기 조회",
    "hero_title": "엔진 코드 디코더",
    "breadcrumb_title": "엔진 크기",
    "og_title": "기술 - 미니 엔진 플레이트 디코더",
    "og_description": "클래식 미니의 엔진 플레이트를 디코딩하여 자동차의 엔진 크기와 특징을 결정하세요. 이 플레이트는 모든 미니 세대에서 같은 위치에 있으며 엔진 크기와 특징을 식별하는 데 사용됩니다.",
    "twitter_title": "기술 - 미니 엔진 플레이트 디코더",
    "twitter_description": "클래식 미니의 엔진 플레이트를 디코딩하여 자동차의 엔진 크기와 특징을 결정하세요.",
    "main_heading": "엔진 플레이트 디코더",
    "description_text": "엔진 플레이트는 워터 펌프 근처의 엔진에 리벳으로 고정된 금속 플레이트에 스탬프된 일련의 숫자와 문자입니다. 이 플레이트는 모든 미니 세대에서 같은 위치에 있으며 엔진 크기와 특징을 식별하는 데 사용됩니다.",
    "keep_minis_driving": "미니를 계속 운전하게 하기",
    "mini_toolbox": "클래식 미니 기술 도구상자",
    "chassis_decoder_card": {
      "link_title": "섀시 디코더 도구 링크",
      "heading": "섀시 번호를 디코딩해야 하나요?",
      "description": "새로운 섀시 번호 디코딩 도구를 사용하여 자동차를 식별하려면 여기를 클릭하세요.",
      "alt_text": "돋보기 이미지"
    },
    "engine_sizes_legend": {
      "850cc": "850cc",
      "970cc": "970cc",
      "997cc": "997cc",
      "998cc": "998cc",
      "1070cc": "1070cc",
      "1100cc": "1100",
      "1275cc": "1275"
    },
    "search": {
      "placeholder": "엔진 코드 검색"
    },
    "table": {
      "title": "엔진 코드",
      "headers": {
        "color": "",
        "code": "코드",
        "engine_size": "엔진 크기",
        "engine_variant": "엔진 변형",
        "gearbox_details": "기어박스 세부사항",
        "details": "세부사항"
      }
    },
    "ui": {
      "support_section": "지원"
    }
  }
}
</i18n>
<style lang="scss">
  .color-850 {
    color: #e24329;
  }
  .color-970 {
    color: #4a7023;
  }
  .color-997 {
    color: #277dc2;
  }
  .color-998 {
    color: #f5c147;
  }
  .color-1070 {
    color: #71784e;
  }
  .color-1100 {
    color: #659cc8;
  }
  .color-1275 {
    color: #c57b57;
  }
</style>
