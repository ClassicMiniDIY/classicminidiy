<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';
  import Fuse from 'fuse.js';

  const { t } = useI18n();

  const { data: diagrams, status } = await useFetch('/api/diagrams');
  const activePanel = ref<string | null>(null);
  const searchQuery = ref('');

  // Prepare data for Fuse.js search
  const searchableItems = computed(() => {
    if (!diagrams.value) return [];

    const items: any[] = [];
    Object.entries(diagrams.value).forEach(([key, diagram]: [string, any]) => {
      diagram.items.forEach((item: any) => {
        items.push({
          ...item,
          category: diagram.title,
          searchableText: `${item.name} ${diagram.title} ${item.from || ''} ${item.to || ''}`,
        });
      });
    });

    return items;
  });

  // Configure Fuse.js options for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'name', weight: 0.7 },
      { name: 'category', weight: 0.2 },
      { name: 'searchableText', weight: 0.1 },
    ],
    threshold: 0.3, // Lower = more strict matching (0.0 = exact, 1.0 = match anything)
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    includeMatches: true,
  };

  // Computed property to filter all diagrams based on search query using Fuse.js
  const filteredResults = computed(() => {
    if (!searchQuery.value || searchQuery.value.length < 2 || !searchableItems.value.length) return [];

    const fuse = new Fuse(searchableItems.value, fuseOptions);
    const searchResults = fuse.search(searchQuery.value);

    // Return just the items (without Fuse.js metadata) sorted by score
    return searchResults.map((result) => result.item);
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
        href: 'https://classicminidiy.com/archive/electrical',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('seo.og_title'),
    ogDescription: t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/electrical',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/electrical.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/electrical.png',
  });

  // Add structured data for the electrical diagrams reference
  const electricalDiagramsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: t('structured_data.headline'),
    description: t('structured_data.description'),
    image: 'https://classicminidiy.s3.amazonaws.com/misc/archive-seo.jpg',
    author: {
      '@type': 'Person',
      name: t('structured_data.author_name'),
    },
    publisher: {
      '@type': 'Organization',
      name: t('structured_data.publisher_name'),
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/logo.png',
      },
    },
    url: 'https://classicminidiy.com/archive/electrical',
    mainEntity: {
      '@type': 'Dataset',
      name: t('structured_data.dataset_name'),
      description: t('structured_data.dataset_description'),
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(electricalDiagramsJsonLd),
      },
    ],
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :page="t('breadcrumb_title')"></breadcrumb>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-8">
            <h1 class="text-2xl font-bold mb-4">{{ t('main_heading') }}</h1>
            <p class="mb-6">
              {{ t('description_text') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Global Search -->
      <div v-if="diagrams && status !== 'pending'" class="col-span-12 mb-6">
        <div class="w-full max-w-md">
          <UInput
            v-model="searchQuery"
            :placeholder="t('search_placeholder')"
            type="search"
            class="w-full"
            icon="i-fa6-solid-magnifying-glass"
          />
        </div>
      </div>

      <div class="col-span-12">
        <!-- Search Results Pane -->
        <div v-if="searchQuery && filteredResults.length > 0" class="mb-6">
          <UCard>
            <template #header>
              <div class="bg-primary text-primary-content -m-4 p-4 rounded-t-lg">
                <h3 class="text-lg font-semibold">{{ t('search_results_title') }} ({{ filteredResults.length }})</h3>
              </div>
            </template>
            <ul class="divide-y divide-default">
              <li v-for="(result, index) in filteredResults" :key="`search-${index}-${result.name}`">
                <a
                  :href="result.link"
                  target="_blank"
                  class="flex justify-between py-4 hover:bg-muted rounded px-2 transition-colors"
                >
                  <div>
                    <div class="text-lg">{{ result.name }}</div>
                    <div class="text-sm opacity-70 flex items-center mt-1">
                      <i class="fa-solid fa-folder mr-2"></i>
                      <span>{{ result.category }}</span>
                    </div>
                    <div class="text-sm opacity-70 flex items-center mt-1">
                      <i class="fa-solid fa-calendar mr-2"></i>
                      <span v-if="result.from || result.to"
                        >{{ result.from || t('date_range.unknown_placeholder') }}{{ t('date_range.separator')
                        }}{{ result.to || t('date_range.unknown_placeholder') }}</span
                      >
                      <span v-else>{{ t('date_range.unknown') }}</span>
                    </div>
                  </div>
                  <UButton variant="ghost" size="lg" :aria-label="t('download_button_aria')">
                    <i class="fa-solid fa-download"></i>
                  </UButton>
                </a>
              </li>
            </ul>
          </UCard>
        </div>

        <!-- No Results Message -->
        <UAlert v-if="searchQuery && filteredResults.length === 0" color="info" class="mb-6">
          <template #icon>
            <i class="fa-solid fa-info-circle"></i>
          </template>
          <template #title>{{ t('no_results_message') }}</template>
        </UAlert>

        <!-- Loading state -->
        <div v-if="status === 'pending'" class="space-y-4">
          <USkeleton class="h-12 w-full" />
          <USkeleton class="h-12 w-full" />
          <USkeleton class="h-12 w-full" />
        </div>

        <!-- Content when loaded (hidden during search) -->
        <div v-if="diagrams && status !== 'pending' && !searchQuery" class="space-y-4">
          <UAccordion
            :items="
              Object.entries(diagrams).map(([key, diagram]) => ({
                label: diagram.title,
                value: key,
                diagram,
              }))
            "
            :ui="{
              trigger: 'text-lg font-semibold py-4',
            }"
          >
            <template #body="{ item }">
              <ul class="divide-y divide-default">
                <li v-for="(diagramItem, idx) in item.diagram.items" :key="`${idx}-${diagramItem.name}`">
                  <a
                    :href="diagramItem.link"
                    target="_blank"
                    class="flex justify-between py-4 hover:bg-muted px-4 transition-colors"
                  >
                    <div>
                      <div class="text-lg">{{ diagramItem.name }}</div>
                      <div class="text-lg opacity-70 flex items-center mt-1">
                        <i class="fa-solid fa-calendar mr-2"></i>
                        <span v-if="diagramItem.from || diagramItem.to"
                          >{{ diagramItem.from || t('date_range.unknown_placeholder') }}{{ t('date_range.separator')
                          }}{{ diagramItem.to || t('date_range.unknown_placeholder') }}</span
                        >
                        <span v-else>{{ t('date_range.unknown') }}</span>
                      </div>
                    </div>
                    <UButton variant="ghost" size="lg" :aria-label="t('download_button_aria')">
                      <i class="fa-solid fa-download"></i>
                    </UButton>
                  </a>
                </li>
              </ul>
            </template>
          </UAccordion>
        </div>
      </div>

      <!-- Support section -->
      <div class="col-span-12 mt-8 mb-10">
        <USeparator :label="t('support_divider')" class="mb-6" />
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Archive - Electrical Diagrams | Classic Mini DIY",
    "description": "Manually digitized and updated electrical diagrams for your Classic Mini Cooper.",
    "keywords": "Classic Mini electrical diagrams, Mini Cooper wiring, wiring diagrams, electrical schematics, classic car wiring",
    "hero_title": "Electrical Diagrams",
    "breadcrumb_title": "Electrical Diagrams",
    "main_heading": "Electrical Diagrams",
    "description_text": "Find the wiring diagrams you need with our collection of fully digitized diagrams sourced directly from The Mini Forum. Archived here for postarity and preservation.",
    "date_range": {
      "unknown": "Dates Unknown",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "Download diagram",
    "search_title": "Search Electrical Diagrams",
    "search_placeholder": "Search all electrical diagrams...",
    "search_results_title": "Search Results",
    "no_results_message": "No diagrams found matching your search.",
    "support_divider": "Support",
    "seo": {
      "og_title": "Archive - Electrical Diagrams | Classic Mini DIY",
      "og_description": "Manually digitized and updated electrical diagrams for your Classic Mini Cooper.",
      "twitter_title": "Classic Mini Electrical Diagrams",
      "twitter_description": "Manually digitized and updated electrical diagrams for your Classic Mini Cooper."
    },
    "structured_data": {
      "headline": "Classic Mini Electrical Diagrams",
      "description": "Manually digitized and updated electrical diagrams for your Classic Mini Cooper.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini Electrical Diagrams",
      "dataset_description": "Collection of digitized electrical diagrams for Classic Mini vehicles"
    }
  },
  "es": {
    "title": "Archivo - Diagramas Eléctricos | Classic Mini DIY",
    "description": "Diagramas eléctricos digitalizados y actualizados manualmente para tu Classic Mini Cooper.",
    "keywords": "diagramas eléctricos Classic Mini, cableado Mini Cooper, diagramas de cableado, esquemas eléctricos, cableado autos clásicos",
    "hero_title": "Diagramas Eléctricos",
    "breadcrumb_title": "Diagramas Eléctricos",
    "main_heading": "Diagramas Eléctricos",
    "description_text": "Encuentra los diagramas de cableado que necesitas con nuestra colección de diagramas completamente digitalizados obtenidos directamente de The Mini Forum. Archivados aquí para la posteridad y preservación.",
    "date_range": {
      "unknown": "Fechas Desconocidas",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "Descargar diagrama",
    "search_title": "Buscar Diagramas Eléctricos",
    "search_placeholder": "Buscar en todos los diagramas eléctricos...",
    "search_results_title": "Resultados de Búsqueda",
    "no_results_message": "No se encontraron diagramas que coincidan con su búsqueda.",
    "support_divider": "Soporte",
    "seo": {
      "og_title": "Archivo - Diagramas Eléctricos | Classic Mini DIY",
      "og_description": "Diagramas eléctricos digitalizados y actualizados manualmente para tu Classic Mini Cooper.",
      "twitter_title": "Diagramas Eléctricos Classic Mini",
      "twitter_description": "Diagramas eléctricos digitalizados y actualizados manualmente para tu Classic Mini Cooper."
    },
    "structured_data": {
      "headline": "Diagramas Eléctricos Classic Mini",
      "description": "Diagramas eléctricos digitalizados y actualizados manualmente para tu Classic Mini Cooper.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Diagramas Eléctricos Classic Mini",
      "dataset_description": "Colección de diagramas eléctricos digitalizados para vehículos Classic Mini"
    }
  },
  "fr": {
    "title": "Archive - Schémas Électriques | Classic Mini DIY",
    "description": "Schémas électriques numérisés et mis à jour manuellement pour votre Classic Mini Cooper.",
    "keywords": "schémas électriques Classic Mini, câblage Mini Cooper, schémas de câblage, schémas électriques, câblage voitures classiques",
    "hero_title": "Schémas Électriques",
    "breadcrumb_title": "Schémas Électriques",
    "main_heading": "Schémas Électriques",
    "description_text": "Trouvez les schémas de câblage dont vous avez besoin avec notre collection de schémas entièrement numérisés provenant directement de The Mini Forum. Archivés ici pour la postérité et la préservation.",
    "date_range": {
      "unknown": "Dates Inconnues",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "Télécharger le schéma",
    "search_title": "Rechercher Schémas Électriques",
    "search_placeholder": "Rechercher dans tous les schémas électriques...",
    "search_results_title": "Résultats de Recherche",
    "no_results_message": "Aucun schéma trouvé correspondant à votre recherche.",
    "support_divider": "Support",
    "seo": {
      "og_title": "Archive - Schémas Électriques | Classic Mini DIY",
      "og_description": "Schémas électriques numérisés et mis à jour manuellement pour votre Classic Mini Cooper.",
      "twitter_title": "Schémas Électriques Classic Mini",
      "twitter_description": "Schémas électriques numérisés et mis à jour manuellement pour votre Classic Mini Cooper."
    },
    "structured_data": {
      "headline": "Schémas Électriques Classic Mini",
      "description": "Schémas électriques numérisés et mis à jour manuellement pour votre Classic Mini Cooper.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Schémas Électriques Classic Mini",
      "dataset_description": "Collection de schémas électriques numérisés pour véhicules Classic Mini"
    }
  },
  "it": {
    "title": "Archivio - Schemi Elettrici | Classic Mini DIY",
    "description": "Schemi elettrici digitalizzati e aggiornati manualmente per la tua Classic Mini Cooper.",
    "keywords": "schemi elettrici Classic Mini, cablaggio Mini Cooper, schemi di cablaggio, schemi elettrici, cablaggio auto classiche",
    "hero_title": "Schemi Elettrici",
    "breadcrumb_title": "Schemi Elettrici",
    "main_heading": "Schemi Elettrici",
    "description_text": "Trova gli schemi di cablaggio di cui hai bisogno con la nostra collezione di schemi completamente digitalizzati provenienti direttamente da The Mini Forum. Archiviati qui per la posterità e la conservazione.",
    "date_range": {
      "unknown": "Date Sconosciute",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "Scarica schema",
    "search_title": "Cerca Schemi Elettrici",
    "search_placeholder": "Cerca in tutti gli schemi elettrici...",
    "search_results_title": "Risultati di Ricerca",
    "no_results_message": "Nessuno schema trovato corrispondente alla tua ricerca.",
    "support_divider": "Supporto",
    "seo": {
      "og_title": "Archivio - Schemi Elettrici | Classic Mini DIY",
      "og_description": "Schemi elettrici digitalizzati e aggiornati manualmente per la tua Classic Mini Cooper.",
      "twitter_title": "Schemi Elettrici Classic Mini",
      "twitter_description": "Schemi elettrici digitalizzati e aggiornati manualmente per la tua Classic Mini Cooper."
    },
    "structured_data": {
      "headline": "Schemi Elettrici Classic Mini",
      "description": "Schemi elettrici digitalizzati e aggiornati manualmente per la tua Classic Mini Cooper.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Schemi Elettrici Classic Mini",
      "dataset_description": "Collezione di schemi elettrici digitalizzati per veicoli Classic Mini"
    }
  },
  "de": {
    "title": "Archiv - Elektrische Schaltpläne | Classic Mini DIY",
    "description": "Manuell digitalisierte und aktualisierte elektrische Schaltpläne für Ihren Classic Mini Cooper.",
    "keywords": "Classic Mini Schaltpläne, Mini Cooper Verkabelung, Schaltpläne, elektrische Schaltbilder, Oldtimer Verkabelung",
    "hero_title": "Elektrische Schaltpläne",
    "breadcrumb_title": "Elektrische Schaltpläne",
    "main_heading": "Elektrische Schaltpläne",
    "description_text": "Finden Sie die Schaltpläne, die Sie benötigen, mit unserer Sammlung vollständig digitalisierter Diagramme, die direkt von The Mini Forum stammen. Hier für die Nachwelt und Erhaltung archiviert.",
    "date_range": {
      "unknown": "Daten Unbekannt",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "Schaltplan herunterladen",
    "search_title": "Elektrische Schaltpläne Suchen",
    "search_placeholder": "Alle elektrischen Schaltpläne durchsuchen...",
    "search_results_title": "Suchergebnisse",
    "no_results_message": "Keine Schaltpläne gefunden, die Ihrer Suche entsprechen.",
    "support_divider": "Support",
    "seo": {
      "og_title": "Archiv - Elektrische Schaltpläne | Classic Mini DIY",
      "og_description": "Manuell digitalisierte und aktualisierte elektrische Schaltpläne für Ihren Classic Mini Cooper.",
      "twitter_title": "Classic Mini Elektrische Schaltpläne",
      "twitter_description": "Manuell digitalisierte und aktualisierte elektrische Schaltpläne für Ihren Classic Mini Cooper."
    },
    "structured_data": {
      "headline": "Classic Mini Elektrische Schaltpläne",
      "description": "Manuell digitalisierte und aktualisierte elektrische Schaltpläne für Ihren Classic Mini Cooper.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini Elektrische Schaltpläne",
      "dataset_description": "Sammlung digitalisierter elektrischer Schaltpläne für Classic Mini Fahrzeuge"
    }
  },
  "pt": {
    "title": "Arquivo - Diagramas Elétricos | Classic Mini DIY",
    "description": "Diagramas elétricos digitalizados e atualizados manualmente para o seu Classic Mini Cooper.",
    "keywords": "diagramas elétricos Classic Mini, fiação Mini Cooper, diagramas de fiação, esquemas elétricos, fiação carros clássicos",
    "hero_title": "Diagramas Elétricos",
    "breadcrumb_title": "Diagramas Elétricos",
    "main_heading": "Diagramas Elétricos",
    "description_text": "Encontre os diagramas de fiação que você precisa com nossa coleção de diagramas totalmente digitalizados obtidos diretamente do The Mini Forum. Arquivados aqui para a posteridade e preservação.",
    "date_range": {
      "unknown": "Datas Desconhecidas",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "Baixar diagrama",
    "search_title": "Pesquisar Diagramas Elétricos",
    "search_placeholder": "Pesquisar em todos os diagramas elétricos...",
    "search_results_title": "Resultados da Pesquisa",
    "no_results_message": "Nenhum diagrama encontrado correspondente à sua pesquisa.",
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Arquivo - Diagramas Elétricos | Classic Mini DIY",
      "og_description": "Diagramas elétricos digitalizados e atualizados manualmente para o seu Classic Mini Cooper.",
      "twitter_title": "Diagramas Elétricos Classic Mini",
      "twitter_description": "Diagramas elétricos digitalizados e atualizados manualmente para o seu Classic Mini Cooper."
    },
    "structured_data": {
      "headline": "Diagramas Elétricos Classic Mini",
      "description": "Diagramas elétricos digitalizados e atualizados manualmente para o seu Classic Mini Cooper.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Diagramas Elétricos Classic Mini",
      "dataset_description": "Coleção de diagramas elétricos digitalizados para veículos Classic Mini"
    }
  },
  "ru": {
    "title": "Архив - Электрические Схемы | Classic Mini DIY",
    "description": "Вручную оцифрованные и обновленные электрические схемы для вашего Classic Mini Cooper.",
    "keywords": "электрические схемы Classic Mini, проводка Mini Cooper, схемы проводки, электрические схемы, проводка классических автомобилей",
    "hero_title": "Электрические Схемы",
    "breadcrumb_title": "Электрические Схемы",
    "main_heading": "Электрические Схемы",
    "description_text": "Найдите нужные вам схемы проводки с помощью нашей коллекции полностью оцифрованных диаграмм, полученных непосредственно с The Mini Forum. Заархивированы здесь для потомков и сохранения.",
    "date_range": {
      "unknown": "Даты Неизвестны",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "Скачать схему",
    "search_title": "Поиск Электрических Схем",
    "search_placeholder": "Поиск по всем электрическим схемам...",
    "search_results_title": "Результаты Поиска",
    "no_results_message": "Не найдено схем, соответствующих вашему запросу.",
    "support_divider": "Поддержка",
    "seo": {
      "og_title": "Архив - Электрические Схемы | Classic Mini DIY",
      "og_description": "Вручную оцифрованные и обновленные электрические схемы для вашего Classic Mini Cooper.",
      "twitter_title": "Электрические Схемы Classic Mini",
      "twitter_description": "Вручную оцифрованные и обновленные электрические схемы для вашего Classic Mini Cooper."
    },
    "structured_data": {
      "headline": "Электрические Схемы Classic Mini",
      "description": "Вручную оцифрованные и обновленные электрические схемы для вашего Classic Mini Cooper.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Электрические Схемы Classic Mini",
      "dataset_description": "Коллекция оцифрованных электрических схем для автомобилей Classic Mini"
    }
  },
  "ja": {
    "title": "アーカイブ - 電気図面 | Classic Mini DIY",
    "description": "Classic Mini Cooperの手動でデジタル化・更新された電気図面。",
    "keywords": "Classic Mini 電気図面, Mini Cooper 配線, 配線図, 電気回路図, クラシックカー配線",
    "hero_title": "電気図面",
    "breadcrumb_title": "電気図面",
    "main_heading": "電気図面",
    "description_text": "The Mini Forumから直接入手した完全にデジタル化された図面のコレクションで、必要な配線図を見つけてください。後世と保存のためにここにアーカイブされています。",
    "date_range": {
      "unknown": "日付不明",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "図面をダウンロード",
    "search_title": "電気図面を検索",
    "search_placeholder": "すべての電気図面を検索...",
    "search_results_title": "検索結果",
    "no_results_message": "検索に一致する図面が見つかりませんでした。",
    "support_divider": "サポート",
    "seo": {
      "og_title": "アーカイブ - 電気図面 | Classic Mini DIY",
      "og_description": "Classic Mini Cooperの手動でデジタル化・更新された電気図面。",
      "twitter_title": "Classic Mini 電気図面",
      "twitter_description": "Classic Mini Cooperの手動でデジタル化・更新された電気図面。"
    },
    "structured_data": {
      "headline": "Classic Mini 電気図面",
      "description": "Classic Mini Cooperの手動でデジタル化・更新された電気図面。",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 電気図面",
      "dataset_description": "Classic Mini車両用デジタル化電気図面のコレクション"
    }
  },
  "zh": {
    "title": "存档 - 电气图表 | Classic Mini DIY",
    "description": "为您的Classic Mini Cooper手动数字化和更新的电气图表。",
    "keywords": "Classic Mini电气图表, Mini Cooper线路, 线路图, 电气原理图, 经典汽车线路",
    "hero_title": "电气图表",
    "breadcrumb_title": "电气图表",
    "main_heading": "电气图表",
    "description_text": "通过我们直接从The Mini Forum获得的完全数字化图表集合，找到您需要的线路图。在此存档以供后代和保存。",
    "date_range": {
      "unknown": "日期未知",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "下载图表",
    "search_title": "搜索电气图表",
    "search_placeholder": "搜索所有电气图表...",
    "search_results_title": "搜索结果",
    "no_results_message": "未找到与您的搜索匹配的图表。",
    "support_divider": "支持",
    "seo": {
      "og_title": "存档 - 电气图表 | Classic Mini DIY",
      "og_description": "为您的Classic Mini Cooper手动数字化和更新的电气图表。",
      "twitter_title": "Classic Mini 电气图表",
      "twitter_description": "为您的Classic Mini Cooper手动数字化和更新的电气图表。"
    },
    "structured_data": {
      "headline": "Classic Mini 电气图表",
      "description": "为您的Classic Mini Cooper手动数字化和更新的电气图表。",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 电气图表",
      "dataset_description": "Classic Mini车辆数字化电气图表集合"
    }
  },
  "ko": {
    "title": "아카이브 - 전기 도면 | Classic Mini DIY",
    "description": "Classic Mini Cooper를 위한 수동으로 디지털화되고 업데이트된 전기 도면.",
    "keywords": "Classic Mini 전기 도면, Mini Cooper 배선, 배선도, 전기 회로도, 클래식 자동차 배선",
    "hero_title": "전기 도면",
    "breadcrumb_title": "전기 도면",
    "main_heading": "전기 도면",
    "description_text": "The Mini Forum에서 직접 얻은 완전히 디지털화된 도면 컬렉션으로 필요한 배선도를 찾으세요. 후세와 보존을 위해 여기에 보관되었습니다.",
    "date_range": {
      "unknown": "날짜 미상",
      "separator": " - ",
      "unknown_placeholder": "?"
    },
    "download_button_aria": "도면 다운로드",
    "search_title": "전기 도면 검색",
    "search_placeholder": "모든 전기 도면 검색...",
    "search_results_title": "검색 결과",
    "no_results_message": "검색과 일치하는 도면을 찾을 수 없습니다.",
    "support_divider": "지원",
    "seo": {
      "og_title": "아카이브 - 전기 도면 | Classic Mini DIY",
      "og_description": "Classic Mini Cooper를 위한 수동으로 디지털화되고 업데이트된 전기 도면.",
      "twitter_title": "Classic Mini 전기 도면",
      "twitter_description": "Classic Mini Cooper를 위한 수동으로 디지털화되고 업데이트된 전기 도면."
    },
    "structured_data": {
      "headline": "Classic Mini 전기 도면",
      "description": "Classic Mini Cooper를 위한 수동으로 디지털화되고 업데이트된 전기 도면.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 전기 도면",
      "dataset_description": "Classic Mini 차량용 디지털화된 전기 도면 컬렉션"
    }
  }
}
</i18n>
