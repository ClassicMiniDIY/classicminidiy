<script lang="ts" setup>
  import { h } from 'vue';
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();

  interface ClearanceItem {
    name: string;
    thou: string;
    mm: string;
    notes?: string;
    [key: string]: any;
  }

  interface ClearanceTable {
    title: string;
    items: ClearanceItem[];
    search?: string;
  }

  const { data: tables } = await useFetch<Record<string, ClearanceTable>>('/api/clearance');
  const searchValue = ref('');
  const expandedRows = ref<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    expandedRows.value[id] = !expandedRows.value[id];
  };

  // Column definitions for Nuxt UI table
  const tableColumns = [
    {
      accessorKey: 'name',
      header: () => t('table.headers.part'),
      cell: ({ row }) => row.getValue('name'),
    },
    {
      accessorKey: 'thou',
      header: () => t('table.headers.clearance_thou'),
      cell: ({ row }) => {
        const value = row.getValue('thou');
        return value
          ? h(
              'span',
              {
                class: 'px-2 py-1 rounded bg-primary/10 text-primary font-medium',
              },
              value
            )
          : t('table.no_value');
      },
    },
    {
      accessorKey: 'mm',
      header: () => t('table.headers.clearance_mm'),
      cell: ({ row }) => {
        const value = row.getValue('mm');
        return value
          ? h(
              'span',
              {
                class: 'px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium',
              },
              value
            )
          : t('table.no_value');
      },
    },
    {
      accessorKey: 'expand',
      header: () => t('table.headers.expand'),
      cell: ({ row }) => {
        const hasNotes = row.original.notes;
        const rowId = `${row.index}`;
        return hasNotes
          ? h(
              'button',
              {
                class: 'text-right w-full hover:text-primary transition-colors',
                onClick: () => toggleRow(rowId),
              },
              [
                h('i', {
                  class: `fas transition-transform duration-200 ${expandedRows.value[rowId] ? 'fa-chevron-up' : 'fa-chevron-down'}`,
                }),
              ]
            )
          : '';
      },
      enableSorting: false,
    },
  ];

  // Function to filter items based on search
  const filterItems = (items: ClearanceItem[], tableName: string) => {
    if (!searchValue.value) return items;
    const query = searchValue.value.toLowerCase();
    return items.filter((item: ClearanceItem) =>
      Object.values(item).some((val) => String(val).toLowerCase().includes(query))
    );
  };

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
        href: 'https://classicminidiy.com/technical/clearance',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // TechArticle and Dataset structured data for clearance specifications
  const techArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Classic Mini Clearance Specifications',
    description: t('description'),
    url: 'https://classicminidiy.com/technical/clearance',
    author: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
    mainEntityOfPage: 'https://classicminidiy.com/technical/clearance',
    about: {
      '@type': 'Thing',
      name: 'Classic Mini Engine and Mechanical Clearances',
    },
  };

  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Classic Mini Clearance Specifications Database',
    description: t('description'),
    url: 'https://classicminidiy.com/technical/clearance',
    keywords: [
      'Classic Mini clearances',
      'engine clearances',
      'valve clearances',
      'bearing clearances',
      'endfloat specifications',
      'Mini Cooper specifications',
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
        name: 'Clearance (thou)',
        unitText: 'thousandths of an inch',
      },
      {
        '@type': 'PropertyValue',
        name: 'Clearance (mm)',
        unitText: 'millimeters',
      },
    ],
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(techArticleJsonLd),
      },
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(datasetJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('og_title'),
    ogDescription: t('og_description'),
    ogUrl: 'https://classicminidiy.com/technical/clearance',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/clearance.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitter_title'),
    twitterDescription: t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/clearance.png',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.TECH" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :version="BREADCRUMB_VERSIONS.TECH" :page="t('breadcrumb_title')" />
    </div>

    <div class="space-y-6">
      <UAccordion
        :items="Object.entries(tables || {}).map(([name, table]) => ({ label: table.title, value: name, table }))"
        :default-value="Object.keys(tables || {})"
        multiple
        :ui="{
          trigger: 'text-lg font-semibold py-4',
        }"
      >
        <template #body="{ item }">
          <!-- Search field -->
          <div class="flex justify-end mb-4 mt-4">
            <div class="w-full max-w-xs">
              <UInput
                type="text"
                v-model="searchValue"
                :placeholder="t('search.placeholder')"
                icon="i-fa6-solid-magnifying-glass"
              />
            </div>
          </div>

          <div class="w-full overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default">
                  <th class="text-left p-2 font-medium">{{ t('table.headers.part') }}</th>
                  <th class="text-left p-2 font-medium">{{ t('table.headers.clearance_thou') }}</th>
                  <th class="text-left p-2 font-medium">{{ t('table.headers.clearance_mm') }}</th>
                  <th class="text-left p-2 font-medium">{{ t('table.headers.expand') }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(tableItem, itemIndex) in filterItems(item.table.items, item.value)" :key="itemIndex">
                  <tr
                    class="border-b border-default last:border-0 hover:bg-muted cursor-pointer transition-colors"
                    @click="toggleRow(`${item.value}-${itemIndex}`)"
                  >
                    <td class="p-2">{{ tableItem.name }}</td>
                    <td class="p-2">
                      <span v-if="tableItem.thou" class="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                        {{ tableItem.thou }}
                      </span>
                      <span v-else class="text-muted">{{ t('table.no_value') }}</span>
                    </td>
                    <td class="p-2">
                      <span
                        v-if="tableItem.mm"
                        class="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium"
                      >
                        {{ tableItem.mm }}
                      </span>
                      <span v-else class="text-muted">{{ t('table.no_value') }}</span>
                    </td>
                    <td class="p-2 text-right">
                      <i
                        v-if="tableItem.notes"
                        class="fas transition-transform duration-200"
                        :class="expandedRows[`${item.value}-${itemIndex}`] ? 'fa-chevron-up' : 'fa-chevron-down'"
                      ></i>
                    </td>
                  </tr>
                  <tr v-if="expandedRows[`${item.value}-${itemIndex}`] && tableItem.notes" class="bg-muted">
                    <td colspan="4" class="p-4">
                      <div class="font-semibold mb-2">
                        {{ t('table.extra_notes_title') }}
                      </div>
                      <div class="whitespace-pre-line">
                        {{ tableItem.notes }}
                      </div>
                    </td>
                  </tr>
                </template>
                <tr v-if="!filterItems(item.table.items, item.value).length">
                  <td colspan="4" class="text-center py-4 text-muted">
                    {{ t('table.no_items_found') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </UAccordion>
    </div>

    <USeparator class="my-12">
      <span class="text-sm text-muted">{{ t('ui.support_section') }}</span>
    </USeparator>
    <div class="mb-8">
      <patreon-card size="large" />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Tech - Mini Clearances",
    "description": "Detailed clearance specifications can be found online right here at Classic Mini DIY.",
    "keywords": "Classic Mini clearances, engine clearances, valve clearances, bearing clearances, endfloat specifications, Mini Cooper specifications, A-series engine clearances, crankshaft clearance",
    "hero_title": "Common Clearances",
    "breadcrumb_title": "Common Clearances",
    "og_title": "Tech - Mini Clearances",
    "og_description": "Detailed clearance specifications for the Classic Mini can be found online right here at Classic Mini DIY.",
    "twitter_title": "Tech - Mini Clearances",
    "twitter_description": "Detailed clearance specifications for the Classic Mini can be found online right here at Classic Mini DIY.",
    "table": {
      "headers": {
        "part": "Part",
        "clearance_thou": "Clearance/Endfloat (thou)",
        "clearance_mm": "Clearance/Endfloat (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "No items found",
      "extra_notes_title": "Extra Notes:",
      "no_notes_available": "No additional notes available."
    },
    "search": {
      "placeholder": "Search..."
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "es": {
    "title": "Tech - Holguras Mini",
    "description": "Las especificaciones detalladas de holguras se pueden encontrar en línea aquí mismo en Classic Mini DIY.",
    "keywords": "holguras Classic Mini, holguras del motor, holguras de válvulas, holguras de cojinetes, especificaciones de juego axial, especificaciones Mini Cooper, holguras motor serie A",
    "hero_title": "Holguras Comunes",
    "breadcrumb_title": "Holguras Comunes",
    "og_title": "Tech - Holguras Mini",
    "og_description": "Las especificaciones detalladas de holguras para el Classic Mini se pueden encontrar en línea aquí mismo en Classic Mini DIY.",
    "twitter_title": "Tech - Holguras Mini",
    "twitter_description": "Las especificaciones detalladas de holguras para el Classic Mini se pueden encontrar en línea aquí mismo en Classic Mini DIY.",
    "table": {
      "headers": {
        "part": "Pieza",
        "clearance_thou": "Holgura/Juego Axial (thou)",
        "clearance_mm": "Holgura/Juego Axial (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "No se encontraron elementos",
      "extra_notes_title": "Notas Adicionales:",
      "no_notes_available": "No hay notas adicionales disponibles."
    },
    "search": {
      "placeholder": "Buscar..."
    },
    "ui": {
      "support_section": "Soporte"
    }
  },
  "fr": {
    "title": "Tech - Jeux Mini",
    "description": "Les spécifications détaillées des jeux peuvent être trouvées en ligne ici même sur Classic Mini DIY.",
    "keywords": "jeux Classic Mini, jeux du moteur, jeux de soupapes, jeux de roulements, spécifications jeu axial, spécifications Mini Cooper, jeux moteur série A",
    "hero_title": "Jeux Communs",
    "breadcrumb_title": "Jeux Communs",
    "og_title": "Tech - Jeux Mini",
    "og_description": "Les spécifications détaillées des jeux pour la Classic Mini peuvent être trouvées en ligne ici même sur Classic Mini DIY.",
    "twitter_title": "Tech - Jeux Mini",
    "twitter_description": "Les spécifications détaillées des jeux pour la Classic Mini peuvent être trouvées en ligne ici même sur Classic Mini DIY.",
    "table": {
      "headers": {
        "part": "Pièce",
        "clearance_thou": "Jeu/Jeu Axial (thou)",
        "clearance_mm": "Jeu/Jeu Axial (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "Aucun élément trouvé",
      "extra_notes_title": "Notes Supplémentaires :",
      "no_notes_available": "Aucune note supplémentaire disponible."
    },
    "search": {
      "placeholder": "Rechercher..."
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "it": {
    "title": "Tech - Giochi Mini",
    "description": "Le specifiche dettagliate dei giochi possono essere trovate online proprio qui su Classic Mini DIY.",
    "keywords": "giochi Classic Mini, giochi del motore, giochi delle valvole, giochi dei cuscinetti, specifiche gioco assiale, specifiche Mini Cooper, giochi motore serie A",
    "hero_title": "Giochi Comuni",
    "breadcrumb_title": "Giochi Comuni",
    "og_title": "Tech - Giochi Mini",
    "og_description": "Le specifiche dettagliate dei giochi per la Classic Mini possono essere trovate online proprio qui su Classic Mini DIY.",
    "twitter_title": "Tech - Giochi Mini",
    "twitter_description": "Le specifiche dettagliate dei giochi per la Classic Mini possono essere trovate online proprio qui su Classic Mini DIY.",
    "table": {
      "headers": {
        "part": "Parte",
        "clearance_thou": "Gioco/Gioco Assiale (thou)",
        "clearance_mm": "Gioco/Gioco Assiale (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "Nessun elemento trovato",
      "extra_notes_title": "Note Aggiuntive:",
      "no_notes_available": "Nessuna nota aggiuntiva disponibile."
    },
    "search": {
      "placeholder": "Cerca..."
    },
    "ui": {
      "support_section": "Supporto"
    }
  },
  "de": {
    "title": "Tech - Mini Spiele",
    "description": "Detaillierte Spiel-Spezifikationen können online hier bei Classic Mini DIY gefunden werden.",
    "keywords": "Classic Mini Spiele, Motorspiele, Ventilspiele, Lagerspiele, Axialspiel Spezifikationen, Mini Cooper Spezifikationen, A-Serie Motorspiele",
    "hero_title": "Häufige Spiele",
    "breadcrumb_title": "Häufige Spiele",
    "og_title": "Tech - Mini Spiele",
    "og_description": "Detaillierte Spiel-Spezifikationen für den Classic Mini können online hier bei Classic Mini DIY gefunden werden.",
    "twitter_title": "Tech - Mini Spiele",
    "twitter_description": "Detaillierte Spiel-Spezifikationen für den Classic Mini können online hier bei Classic Mini DIY gefunden werden.",
    "table": {
      "headers": {
        "part": "Teil",
        "clearance_thou": "Spiel/Axialspiel (thou)",
        "clearance_mm": "Spiel/Axialspiel (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "Keine Elemente gefunden",
      "extra_notes_title": "Zusätzliche Hinweise:",
      "no_notes_available": "Keine zusätzlichen Hinweise verfügbar."
    },
    "search": {
      "placeholder": "Suchen..."
    },
    "ui": {
      "support_section": "Support"
    }
  },
  "pt": {
    "title": "Tech - Folgas Mini",
    "description": "Especificações detalhadas de folgas podem ser encontradas online aqui mesmo no Classic Mini DIY.",
    "keywords": "folgas Classic Mini, folgas do motor, folgas das válvulas, folgas dos rolamentos, especificações de folga axial, especificações Mini Cooper, folgas motor série A",
    "hero_title": "Folgas Comuns",
    "breadcrumb_title": "Folgas Comuns",
    "og_title": "Tech - Folgas Mini",
    "og_description": "Especificações detalhadas de folgas para o Classic Mini podem ser encontradas online aqui mesmo no Classic Mini DIY.",
    "twitter_title": "Tech - Folgas Mini",
    "twitter_description": "Especificações detalhadas de folgas para o Classic Mini podem ser encontradas online aqui mesmo no Classic Mini DIY.",
    "table": {
      "headers": {
        "part": "Peça",
        "clearance_thou": "Folga/Folga Axial (thou)",
        "clearance_mm": "Folga/Folga Axial (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "Nenhum item encontrado",
      "extra_notes_title": "Notas Adicionais:",
      "no_notes_available": "Nenhuma nota adicional disponível."
    },
    "search": {
      "placeholder": "Pesquisar..."
    },
    "ui": {
      "support_section": "Suporte"
    }
  },
  "ru": {
    "title": "Tech - Зазоры Mini",
    "description": "Подробные спецификации зазоров можно найти онлайн прямо здесь на Classic Mini DIY.",
    "keywords": "зазоры Classic Mini, зазоры двигателя, зазоры клапанов, зазоры подшипников, спецификации осевого зазора, спецификации Mini Cooper, зазоры двигателя серии A",
    "hero_title": "Общие Зазоры",
    "breadcrumb_title": "Общие Зазоры",
    "og_title": "Tech - Зазоры Mini",
    "og_description": "Подробные спецификации зазоров для Classic Mini можно найти онлайн прямо здесь на Classic Mini DIY.",
    "twitter_title": "Tech - Зазоры Mini",
    "twitter_description": "Подробные спецификации зазоров для Classic Mini можно найти онлайн прямо здесь на Classic Mini DIY.",
    "table": {
      "headers": {
        "part": "Деталь",
        "clearance_thou": "Зазор/Осевой Зазор (thou)",
        "clearance_mm": "Зазор/Осевой Зазор (мм)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "Элементы не найдены",
      "extra_notes_title": "Дополнительные Примечания:",
      "no_notes_available": "Дополнительные примечания недоступны."
    },
    "search": {
      "placeholder": "Поиск..."
    },
    "ui": {
      "support_section": "Поддержка"
    }
  },
  "ja": {
    "title": "Tech - ミニクリアランス",
    "description": "詳細なクリアランス仕様は、Classic Mini DIYでオンラインで見つけることができます。",
    "keywords": "クラシックミニクリアランス, エンジンクリアランス, バルブクリアランス, ベアリングクリアランス, エンドフロート仕様, ミニクーパー仕様, Aシリーズエンジンクリアランス",
    "hero_title": "一般的なクリアランス",
    "breadcrumb_title": "一般的なクリアランス",
    "og_title": "Tech - ミニクリアランス",
    "og_description": "クラシック・ミニの詳細なクリアランス仕様は、Classic Mini DIYでオンラインで見つけることができます。",
    "twitter_title": "Tech - ミニクリアランス",
    "twitter_description": "クラシック・ミニの詳細なクリアランス仕様は、Classic Mini DIYでオンラインで見つけることができます。",
    "table": {
      "headers": {
        "part": "部品",
        "clearance_thou": "クリアランス/エンドフロート (thou)",
        "clearance_mm": "クリアランス/エンドフロート (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "アイテムが見つかりません",
      "extra_notes_title": "追加注記:",
      "no_notes_available": "追加の注記はありません。"
    },
    "search": {
      "placeholder": "検索..."
    },
    "ui": {
      "support_section": "サポート"
    }
  },
  "zh": {
    "title": "Tech - 迷你间隙",
    "description": "详细的间隙规格可以在Classic Mini DIY在线找到。",
    "keywords": "经典迷你间隙, 发动机间隙, 气门间隙, 轴承间隙, 轴向间隙规格, 迷你库珀规格, A系列发动机间隙",
    "hero_title": "常见间隙",
    "breadcrumb_title": "常见间隙",
    "og_title": "Tech - 迷你间隙",
    "og_description": "经典迷你的详细间隙规格可以在Classic Mini DIY在线找到。",
    "twitter_title": "Tech - 迷你间隙",
    "twitter_description": "经典迷你的详细间隙规格可以在Classic Mini DIY在线找到。",
    "table": {
      "headers": {
        "part": "部件",
        "clearance_thou": "间隙/轴向间隙 (thou)",
        "clearance_mm": "间隙/轴向间隙 (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "未找到项目",
      "extra_notes_title": "附加说明:",
      "no_notes_available": "没有可用的附加说明。"
    },
    "search": {
      "placeholder": "搜索..."
    },
    "ui": {
      "support_section": "支持"
    }
  },
  "ko": {
    "title": "Tech - 미니 클리어런스",
    "description": "자세한 클리어런스 사양은 Classic Mini DIY에서 온라인으로 찾을 수 있습니다.",
    "keywords": "클래식 미니 클리어런스, 엔진 클리어런스, 밸브 클리어런스, 베어링 클리어런스, 엔드플로트 사양, 미니 쿠퍼 사양, A시리즈 엔진 클리어런스",
    "hero_title": "일반적인 클리어런스",
    "breadcrumb_title": "일반적인 클리어런스",
    "og_title": "Tech - 미니 클리어런스",
    "og_description": "클래식 미니의 자세한 클리어런스 사양은 Classic Mini DIY에서 온라인으로 찾을 수 있습니다.",
    "twitter_title": "Tech - 미니 클리어런스",
    "twitter_description": "클래식 미니의 자세한 클리어런스 사양은 Classic Mini DIY에서 온라인으로 찾을 수 있습니다.",
    "table": {
      "headers": {
        "part": "부품",
        "clearance_thou": "클리어런스/엔드플로트 (thou)",
        "clearance_mm": "클리어런스/엔드플로트 (mm)",
        "expand": ""
      },
      "no_value": "---",
      "no_items_found": "항목을 찾을 수 없습니다",
      "extra_notes_title": "추가 참고사항:",
      "no_notes_available": "추가 참고사항이 없습니다."
    },
    "search": {
      "placeholder": "검색..."
    },
    "ui": {
      "support_section": "지원"
    }
  }
}
</i18n>
