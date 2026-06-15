<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';
  import { clearanceFaqs } from '~/utils/geo/generateFaqs';
  import { buildFaqPage } from '~/utils/schema/faqPage';

  const { t } = useI18n();
  const { trackSearch, track } = useAnalytics();

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
  const expandedTables = ref<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    expandedRows.value[id] = !expandedRows.value[id];
  };

  const toggleTable = (id: string, tableName: string) => {
    expandedTables.value[id] = !expandedTables.value[id];
    track('reference_table_toggled', { surface: 'clearance', table_name: tableName });
  };

  // Debounced search tracking
  let clearanceSearchTimer: ReturnType<typeof setTimeout> | null = null;
  watch(searchValue, (val) => {
    if (clearanceSearchTimer) clearTimeout(clearanceSearchTimer);
    clearanceSearchTimer = setTimeout(() => {
      const query = val.toLowerCase();
      const totalResults = tables.value
        ? Object.values(tables.value).reduce(
            (sum, table) =>
              sum +
              table.items.filter((item: ClearanceItem) =>
                Object.values(item).some((v) => String(v).toLowerCase().includes(query))
              ).length,
            0
          )
        : 0;
      trackSearch('clearance', val, totalResults);
    }, 400);
  });

  onUnmounted(() => {
    if (clearanceSearchTimer) clearTimeout(clearanceSearchTimer);
  });

  // Function to filter items based on search
  const filterItems = (items: ClearanceItem[], tableName: string) => {
    if (!searchValue.value) return items;
    const query = searchValue.value.toLowerCase();
    return items.filter((item: ClearanceItem) =>
      Object.values(item).some((val) => String(val).toLowerCase().includes(query))
    );
  };

  // Default all tables to expanded (matching previous :default-value behavior)
  watchEffect(() => {
    if (tables.value) {
      Object.keys(tables.value).forEach((name) => {
        if (expandedTables.value[name] === undefined) {
          expandedTables.value[name] = true;
        }
      });
    }
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
        href: 'https://www.classicminidiy.com/technical/clearance',
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
    url: 'https://www.classicminidiy.com/technical/clearance',
    author: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://www.classicminidiy.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://www.classicminidiy.com',
    },
    mainEntityOfPage: 'https://www.classicminidiy.com/technical/clearance',
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
    url: 'https://www.classicminidiy.com/technical/clearance',
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
      url: 'https://www.classicminidiy.com',
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

  // FAQPage JSON-LD only (no visible block — answers derive from the clearance
  // tables already on the page; structured data for AI engines, not a UX surface).
  const clearanceFaqList = clearanceFaqs();
  const clearanceFaqNode = buildFaqPage(clearanceFaqList);

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
      ...(clearanceFaqNode
        ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(clearanceFaqNode) }]
        : []),
    ],
  });

  useSeoMeta({
    ogTitle: t('og_title'),
    ogDescription: t('og_description'),
    ogUrl: 'https://www.classicminidiy.com/technical/clearance',
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

    <div class="mb-8">
      <PageIntro :eyebrow="t('eyebrow')" :title="t('main_heading')" :description="t('description_text')" as="h2" />
    </div>

    <div class="join join-vertical w-full space-y-2">
      <div
        v-for="(table, name) in tables || {}"
        :key="name"
        class="collapse collapse-arrow join-item border border-base-300 bg-base-100"
      >
        <input
          type="checkbox"
          :checked="!!expandedTables[name]"
          @change="toggleTable(name, table.title)"
          :aria-label="table.title"
        />
        <div class="collapse-title text-lg font-semibold">{{ table.title }}</div>
        <div class="collapse-content">
          <!-- Search field -->
          <div class="flex justify-end mb-4 mt-4">
            <div class="w-full max-w-xs">
              <label class="input input-bordered flex items-center gap-2">
                <i class="fas fa-magnifying-glass"></i>
                <input v-model="searchValue" type="text" class="grow" :placeholder="t('search.placeholder')" />
              </label>
            </div>
          </div>

          <div class="w-full overflow-x-auto">
            <table class="table w-full text-sm">
              <thead>
                <tr>
                  <th class="text-left p-2 font-medium">{{ t('table.headers.part') }}</th>
                  <th class="text-left p-2 font-medium">{{ t('table.headers.clearance_thou') }}</th>
                  <th class="text-left p-2 font-medium">{{ t('table.headers.clearance_mm') }}</th>
                  <th class="text-left p-2 font-medium">{{ t('table.headers.expand') }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(tableItem, itemIndex) in filterItems(table.items, name)" :key="itemIndex">
                  <tr
                    class="hover:bg-base-200 cursor-pointer transition-colors"
                    @click="toggleRow(`${name}-${itemIndex}`)"
                  >
                    <td class="p-2">{{ tableItem.name }}</td>
                    <td class="p-2">
                      <span v-if="tableItem.thou" class="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                        {{ tableItem.thou }}
                      </span>
                      <span v-else class="text-base-content/60">{{ t('table.no_value') }}</span>
                    </td>
                    <td class="p-2">
                      <span v-if="tableItem.mm" class="badge badge-info">
                        {{ tableItem.mm }}
                      </span>
                      <span v-else class="text-base-content/60">{{ t('table.no_value') }}</span>
                    </td>
                    <td class="p-2 text-right">
                      <i
                        v-if="tableItem.notes"
                        class="fas transition-transform duration-200"
                        :class="expandedRows[`${name}-${itemIndex}`] ? 'fa-chevron-up' : 'fa-chevron-down'"
                      ></i>
                    </td>
                  </tr>
                  <tr v-if="expandedRows[`${name}-${itemIndex}`] && tableItem.notes" class="bg-base-200">
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
                <tr v-if="!filterItems(table.items, name).length">
                  <td colspan="4" class="text-center py-4 text-base-content/60">
                    {{ t('table.no_items_found') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="divider my-12">
      <span class="text-sm text-base-content/70">{{ t('ui.support_section') }}</span>
    </div>
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
    "eyebrow": "REFERENCE",
    "main_heading": "Common Clearances",
    "description_text": "Detailed clearance specifications can be found online right here at Classic Mini DIY.",
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
    "eyebrow": "REFERENCIA",
    "main_heading": "Holguras Comunes",
    "description_text": "Las especificaciones detalladas de holguras se pueden encontrar en línea aquí mismo en Classic Mini DIY.",
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
    "eyebrow": "RÉFÉRENCE",
    "main_heading": "Jeux Communs",
    "description_text": "Les spécifications détaillées des jeux peuvent être trouvées en ligne ici même sur Classic Mini DIY.",
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
    "eyebrow": "RIFERIMENTO",
    "main_heading": "Giochi Comuni",
    "description_text": "Le specifiche dettagliate dei giochi possono essere trovate online proprio qui su Classic Mini DIY.",
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
    "eyebrow": "REFERENZ",
    "main_heading": "Häufige Spiele",
    "description_text": "Detaillierte Spiel-Spezifikationen können online hier bei Classic Mini DIY gefunden werden.",
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
    "eyebrow": "REFERÊNCIA",
    "main_heading": "Folgas Comuns",
    "description_text": "Especificações detalhadas de folgas podem ser encontradas online aqui mesmo no Classic Mini DIY.",
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
    "eyebrow": "СПРАВОЧНИК",
    "main_heading": "Общие Зазоры",
    "description_text": "Подробные спецификации зазоров можно найти онлайн прямо здесь на Classic Mini DIY.",
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
    "eyebrow": "リファレンス",
    "main_heading": "一般的なクリアランス",
    "description_text": "詳細なクリアランス仕様は、Classic Mini DIYでオンラインで見つけることができます。",
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
    "eyebrow": "参考",
    "main_heading": "常见间隙",
    "description_text": "详细的间隙规格可以在Classic Mini DIY在线找到。",
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
    "eyebrow": "참조",
    "main_heading": "일반적인 클리어런스",
    "description_text": "자세한 클리어런스 사양은 Classic Mini DIY에서 온라인으로 찾을 수 있습니다.",
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
