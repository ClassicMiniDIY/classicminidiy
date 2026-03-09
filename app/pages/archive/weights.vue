<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();

  const { data: tables, status } = await useFetch('/api/weights');
  const activePanel = ref<string | null>(null);
  const tableHeaders = [
    { title: t('table_headers.item'), key: 'item' },
    { title: t('table_headers.kg'), key: 'weight' },
    { title: t('table_headers.lbs'), key: 'lbs' },
  ];
  const tableSearchQueries = ref<Record<string, string>>({});

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
        href: 'https://classicminidiy.com/archive/weights',
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
    ogUrl: 'https://classicminidiy.com/archive/weights',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/weights.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/weights.png',
  });

  function convertKgToLbs(weightInKg: number | null) {
    if (!weightInKg) return t('no_weight');
    return (weightInKg * 2.20462).toFixed(3);
  }

  // Filter function for table items
  const filterItems = (items: any[], tableName: string) => {
    const query = tableSearchQueries.value[tableName];
    if (!query) return items;
    const queryLower = query.toLowerCase();
    return items.filter((item: any) => item.item.toLowerCase().includes(queryLower));
  };
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
            <UButton to="/contact" variant="outline" class="mb-6">
              <i class="fas fa-paper-plane mr-2"></i>
              {{ t('contact_button') }}
            </UButton>
          </div>
        </div>
      </div>

      <div class="col-span-12">
        <!-- Loading state -->
        <div v-if="status === 'pending'" class="space-y-4">
          <USkeleton class="h-12 w-full" />
          <USkeleton class="h-12 w-full" />
          <USkeleton class="h-12 w-full" />
        </div>

        <!-- Content when loaded -->
        <div v-if="tables && status !== 'pending'" class="space-y-6">
          <UAccordion
            :items="Object.entries(tables || {}).map(([name, table]) => ({ label: table.title, value: name, table }))"
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
                    :placeholder="t('search_placeholder')"
                    v-model="tableSearchQueries[item.value]"
                    icon="i-fa6-solid-magnifying-glass"
                  />
                </div>
              </div>

              <!-- Table -->
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <!-- Table header -->
                  <thead>
                    <tr class="border-b border-default">
                      <th v-for="header in tableHeaders" :key="header.key" class="text-left p-2 font-medium">
                        {{ header.title }}
                      </th>
                    </tr>
                  </thead>

                  <!-- Table body -->
                  <tbody>
                    <template
                      v-for="(tableItem, itemIndex) in filterItems(item.table.items, item.value)"
                      :key="itemIndex"
                    >
                      <tr class="border-b border-default last:border-0 hover:bg-muted transition-colors">
                        <td class="p-2">{{ tableItem.item }}</td>
                        <td class="p-2">{{ tableItem.weight || '---' }}</td>
                        <td class="p-2">{{ convertKgToLbs(tableItem.weight) }}</td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </template>
          </UAccordion>
        </div>
      </div>

      <!-- Support section -->
      <div class="col-span-12 pb-15">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Weights & Measurements | Classic Mini DIY",
    "description": "Detailed weights & measurements for the Classic Mini can be found online right here at Classic Mini DIY.",
    "keywords": "Classic Mini weights, Mini Cooper measurements, part weights, Mini component weights, classic car specifications",
    "hero_title": "Weights & Measurements",
    "breadcrumb_title": "Weights & Measurements",
    "main_heading": "Mini Weights",
    "description_text": "Below you will find multiple searchable tables of weights for various parts of the Classic Mini. These weights were provided by an archive of the now offline miniweights.co.uk. If you see missing values or you would like to contribute please use the contact page below.",
    "contact_button": "Contact Us",
    "search_placeholder": "Search this table",
    "table_headers": {
      "item": "Item",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Classic Mini Weights & Measurements | Classic Mini DIY",
      "og_description": "Detailed weights & measurements for the Classic Mini can be found online right here at Classic Mini DIY.",
      "twitter_title": "Classic Mini Weights & Measurements",
      "twitter_description": "Detailed weights & measurements for the Classic Mini."
    }
  },
  "es": {
    "title": "Pesos y Medidas del Classic Mini | Classic Mini DIY",
    "description": "Pesos y medidas detallados para el Classic Mini se pueden encontrar en línea aquí mismo en Classic Mini DIY.",
    "keywords": "pesos Classic Mini, medidas Mini Cooper, pesos de piezas, pesos de componentes Mini, especificaciones autos clásicos",
    "hero_title": "Pesos y Medidas",
    "breadcrumb_title": "Pesos y Medidas",
    "main_heading": "Pesos del Mini",
    "description_text": "A continuación encontrarás múltiples tablas buscables de pesos para varias partes del Classic Mini. Estos pesos fueron proporcionados por un archivo del ahora desconectado miniweights.co.uk. Si ves valores faltantes o te gustaría contribuir, por favor haz clic en el enlace de abajo para enviarme un email.",
    "contact_button": "Contáctanos",
    "search_placeholder": "Buscar en esta tabla",
    "table_headers": {
      "item": "Artículo",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Pesos y Medidas del Classic Mini | Classic Mini DIY",
      "og_description": "Pesos y medidas detallados para el Classic Mini se pueden encontrar en línea aquí mismo en Classic Mini DIY.",
      "twitter_title": "Pesos y Medidas del Classic Mini",
      "twitter_description": "Pesos y medidas detallados para el Classic Mini."
    }
  },
  "fr": {
    "title": "Poids et Mesures du Classic Mini | Classic Mini DIY",
    "description": "Les poids et mesures détaillés pour le Classic Mini peuvent être trouvés en ligne ici même sur Classic Mini DIY.",
    "keywords": "poids Classic Mini, mesures Mini Cooper, poids des pièces, poids des composants Mini, spécifications voitures classiques",
    "hero_title": "Poids et Mesures",
    "breadcrumb_title": "Poids et Mesures",
    "main_heading": "Poids du Mini",
    "description_text": "Ci-dessous, vous trouverez plusieurs tableaux recherchables de poids pour diverses parties du Classic Mini. Ces poids ont été fournis par une archive du site maintenant hors ligne miniweights.co.uk. Si vous voyez des valeurs manquantes ou si vous souhaitez contribuer, veuillez cliquer sur le lien ci-dessous pour m'envoyer un email.",
    "contact_button": "Nous Contacter",
    "search_placeholder": "Rechercher dans ce tableau",
    "table_headers": {
      "item": "Article",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Poids et Mesures du Classic Mini | Classic Mini DIY",
      "og_description": "Les poids et mesures détaillés pour le Classic Mini peuvent être trouvés en ligne ici même sur Classic Mini DIY.",
      "twitter_title": "Poids et Mesures du Classic Mini",
      "twitter_description": "Poids et mesures détaillés pour le Classic Mini."
    }
  },
  "it": {
    "title": "Pesi e Misure del Classic Mini | Classic Mini DIY",
    "description": "Pesi e misure dettagliati per il Classic Mini possono essere trovati online proprio qui su Classic Mini DIY.",
    "keywords": "pesi Classic Mini, misure Mini Cooper, pesi parti, pesi componenti Mini, specifiche auto classiche",
    "hero_title": "Pesi e Misure",
    "breadcrumb_title": "Pesi e Misure",
    "main_heading": "Pesi del Mini",
    "description_text": "Di seguito troverai più tabelle ricercabili di pesi per varie parti del Classic Mini. Questi pesi sono stati forniti da un archivio del sito ora offline miniweights.co.uk. Se vedi valori mancanti o vorresti contribuire, per favore clicca sul link qui sotto per inviarmi un'email.",
    "contact_button": "Contattaci",
    "search_placeholder": "Cerca in questa tabella",
    "table_headers": {
      "item": "Articolo",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Pesi e Misure del Classic Mini | Classic Mini DIY",
      "og_description": "Pesi e misure dettagliati per il Classic Mini possono essere trovati online proprio qui su Classic Mini DIY.",
      "twitter_title": "Pesi e Misure del Classic Mini",
      "twitter_description": "Pesi e misure dettagliati per il Classic Mini."
    }
  },
  "de": {
    "title": "Classic Mini Gewichte & Maße | Classic Mini DIY",
    "description": "Detaillierte Gewichte & Maße für den Classic Mini können online hier bei Classic Mini DIY gefunden werden.",
    "keywords": "Classic Mini Gewichte, Mini Cooper Maße, Teilegewichte, Mini Komponentengewichte, Oldtimer Spezifikationen",
    "hero_title": "Gewichte & Maße",
    "breadcrumb_title": "Gewichte & Maße",
    "main_heading": "Mini Gewichte",
    "description_text": "Unten finden Sie mehrere durchsuchbare Tabellen mit Gewichten für verschiedene Teile des Classic Mini. Diese Gewichte wurden von einem Archiv der jetzt offline befindlichen Website miniweights.co.uk bereitgestellt. Wenn Sie fehlende Werte sehen oder beitragen möchten, klicken Sie bitte auf den unten stehenden Link, um mir eine E-Mail zu senden.",
    "contact_button": "Kontaktieren Sie uns",
    "search_placeholder": "Diese Tabelle durchsuchen",
    "table_headers": {
      "item": "Artikel",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Classic Mini Gewichte & Maße | Classic Mini DIY",
      "og_description": "Detaillierte Gewichte & Maße für den Classic Mini können online hier bei Classic Mini DIY gefunden werden.",
      "twitter_title": "Classic Mini Gewichte & Maße",
      "twitter_description": "Detaillierte Gewichte & Maße für den Classic Mini."
    }
  },
  "pt": {
    "title": "Pesos e Medidas do Classic Mini | Classic Mini DIY",
    "description": "Pesos e medidas detalhados para o Classic Mini podem ser encontrados online aqui mesmo no Classic Mini DIY.",
    "keywords": "pesos Classic Mini, medidas Mini Cooper, pesos de peças, pesos de componentes Mini, especificações carros clássicos",
    "hero_title": "Pesos e Medidas",
    "breadcrumb_title": "Pesos e Medidas",
    "main_heading": "Pesos do Mini",
    "description_text": "Abaixo você encontrará múltiplas tabelas pesquisáveis de pesos para várias partes do Classic Mini. Estes pesos foram fornecidos por um arquivo do agora offline miniweights.co.uk. Se você vir valores em falta ou gostaria de contribuir, por favor clique no link abaixo para me enviar um email.",
    "contact_button": "Entre em Contato",
    "search_placeholder": "Pesquisar nesta tabela",
    "table_headers": {
      "item": "Item",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Pesos e Medidas do Classic Mini | Classic Mini DIY",
      "og_description": "Pesos e medidas detalhados para o Classic Mini podem ser encontrados online aqui mesmo no Classic Mini DIY.",
      "twitter_title": "Pesos e Medidas do Classic Mini",
      "twitter_description": "Pesos e medidas detalhados para o Classic Mini."
    }
  },
  "ru": {
    "title": "Веса и Размеры Classic Mini | Classic Mini DIY",
    "description": "Подробные веса и размеры для Classic Mini можно найти онлайн прямо здесь на Classic Mini DIY.",
    "keywords": "веса Classic Mini, размеры Mini Cooper, веса деталей, веса компонентов Mini, спецификации классических автомобилей",
    "hero_title": "Веса и Размеры",
    "breadcrumb_title": "Веса и Размеры",
    "main_heading": "Веса Mini",
    "description_text": "Ниже вы найдете несколько поисковых таблиц весов для различных частей Classic Mini. Эти веса были предоставлены архивом теперь офлайн сайта miniweights.co.uk. Если вы видите отсутствующие значения или хотели бы внести вклад, пожалуйста, нажмите на ссылку ниже, чтобы отправить мне электронное письмо.",
    "contact_button": "Связаться с нами",
    "search_placeholder": "Поиск в этой таблице",
    "table_headers": {
      "item": "Элемент",
      "kg": "Кг",
      "lbs": "Фунты"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Веса и Размеры Classic Mini | Classic Mini DIY",
      "og_description": "Подробные веса и размеры для Classic Mini можно найти онлайн прямо здесь на Classic Mini DIY.",
      "twitter_title": "Веса и Размеры Classic Mini",
      "twitter_description": "Подробные веса и размеры для Classic Mini."
    }
  },
  "ja": {
    "title": "Classic Mini 重量・寸法 | Classic Mini DIY",
    "description": "Classic Miniの詳細な重量・寸法は、Classic Mini DIYでオンラインで見つけることができます。",
    "keywords": "Classic Mini 重量, Mini Cooper 寸法, パーツ重量, Mini コンポーネント重量, クラシックカー仕様",
    "hero_title": "重量・寸法",
    "breadcrumb_title": "重量・寸法",
    "main_heading": "Mini 重量",
    "description_text": "以下では、Classic Miniの様々な部品の重量に関する複数の検索可能な表を見つけることができます。これらの重量は、現在オフラインのminiweights.co.ukのアーカイブによって提供されました。欠落している値を見つけたり、貢献したい場合は、下のリンクをクリックして私にメールを送ってください。",
    "contact_button": "お問い合わせ",
    "search_placeholder": "この表を検索",
    "table_headers": {
      "item": "アイテム",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Classic Mini 重量・寸法 | Classic Mini DIY",
      "og_description": "Classic Miniの詳細な重量・寸法は、Classic Mini DIYでオンラインで見つけることができます。",
      "twitter_title": "Classic Mini 重量・寸法",
      "twitter_description": "Classic Miniの詳細な重量・寸法。"
    }
  },
  "zh": {
    "title": "Classic Mini 重量和尺寸 | Classic Mini DIY",
    "description": "Classic Mini的详细重量和尺寸可以在Classic Mini DIY在线找到。",
    "keywords": "Classic Mini重量, Mini Cooper尺寸, 零件重量, Mini组件重量, 经典汽车规格",
    "hero_title": "重量和尺寸",
    "breadcrumb_title": "重量和尺寸",
    "main_heading": "Mini重量",
    "description_text": "下面您将找到Classic Mini各个部件重量的多个可搜索表格。这些重量由现已离线的miniweights.co.uk的存档提供。如果您看到缺失的值或想要贡献，请点击下面的链接给我发送电子邮件。",
    "contact_button": "联系我们",
    "search_placeholder": "搜索此表",
    "table_headers": {
      "item": "项目",
      "kg": "公斤",
      "lbs": "磅"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Classic Mini 重量和尺寸 | Classic Mini DIY",
      "og_description": "Classic Mini的详细重量和尺寸可以在Classic Mini DIY在线找到。",
      "twitter_title": "Classic Mini 重量和尺寸",
      "twitter_description": "Classic Mini的详细重量和尺寸。"
    }
  },
  "ko": {
    "title": "Classic Mini 무게 및 치수 | Classic Mini DIY",
    "description": "Classic Mini의 상세한 무게 및 치수는 Classic Mini DIY에서 온라인으로 찾을 수 있습니다.",
    "keywords": "Classic Mini 무게, Mini Cooper 치수, 부품 무게, Mini 구성요소 무게, 클래식 자동차 사양",
    "hero_title": "무게 및 치수",
    "breadcrumb_title": "무게 및 치수",
    "main_heading": "Mini 무게",
    "description_text": "아래에서 Classic Mini의 다양한 부품에 대한 여러 검색 가능한 무게 표를 찾을 수 있습니다. 이러한 무게는 현재 오프라인인 miniweights.co.uk의 아카이브에서 제공되었습니다. 누락된 값을 보거나 기여하고 싶다면 아래 링크를 클릭하여 이메일을 보내주세요.",
    "contact_button": "문의하기",
    "search_placeholder": "이 표 검색",
    "table_headers": {
      "item": "항목",
      "kg": "Kg",
      "lbs": "Lbs"
    },
    "no_weight": "---",
    "seo": {
      "og_title": "Classic Mini 무게 및 치수 | Classic Mini DIY",
      "og_description": "Classic Mini의 상세한 무게 및 치수는 Classic Mini DIY에서 온라인으로 찾을 수 있습니다.",
      "twitter_title": "Classic Mini 무게 및 치수",
      "twitter_description": "Classic Mini의 상세한 무게 및 치수."
    }
  }
}
</i18n>
