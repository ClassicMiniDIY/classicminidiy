<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  // Track calculator loading state
  const isCalculatorLoaded = ref(false);

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
        href: 'https://classicminidiy.com/technical/needles',
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
    ogUrl: 'https://classicminidiy.com/technical/needles',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/needles.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitter_title'),
    twitterDescription: t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/needles.png',
  });

  // Add structured data for the tool
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('structured_data.name'),
    description: t('structured_data.description'),
    step: [
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.select_needles.name'),
        text: t('structured_data.steps.select_needles.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.add_to_comparison.name'),
        text: t('structured_data.steps.add_to_comparison.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.view_comparison.name'),
        text: t('structured_data.steps.view_comparison.text'),
      },
    ],
    tool: [
      {
        '@type': 'HowToTool',
        name: t('structured_data.tool_name'),
      },
    ],
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(howToJsonLd),
      },
    ],
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" text-size="text-3xl" :heroType="HERO_TYPES.TECH" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12 pt-6">
        <breadcrumb :version="BREADCRUMB_VERSIONS.TECH" :page="t('breadcrumb_title')"></breadcrumb>
      </div>
      <div class="col-span-12">
        <h1 class="fancy-font-bold text-2xl">{{ t('main_heading') }}</h1>
        <p class="text-lg pt-5">
          {{ t('description_text') }}
        </p>
      </div>
      <div class="col-span-12 border-t border-base-300 mt-5"></div>
      <div class="col-span-12">
        <ClientOnly fallback-tag="div" :fallback="t('ui.loading_fallback')">
          <div class="min-h-96 flex items-center justify-center" v-if="!isCalculatorLoaded">
            <div class="flex flex-col items-center space-y-4">
              <span class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></span>
              <p class="opacity-70">{{ t('ui.loading_text') }}</p>
            </div>
          </div>
          <LazyCalculatorsNeedles @vue:mounted="isCalculatorLoaded = true" />
        </ClientOnly>
      </div>
      <div class="col-span-12">
        <USeparator :label="t('ui.needle_charts_section')" />
      </div>
      <div class="col-span-12 text-center">
        <h2 class="fancy-font-book text-2xl">{{ t('ui.find_needle_heading') }}</h2>
        <h3 class="fancy-font-book text-lg">
          {{ t('ui.information_provided_by') }}
          <a
            href="https://www.7ent.com/pages/articles-tech-tips/chart-carburetor-needle.html"
            target="_blank"
            class="link link-primary"
            >{{ t('ui.seven_mini_parts_link') }}</a
          >
        </h3>
      </div>
      <div class="col-span-12">
        <NeedleTable />
      </div>
      <div class="col-span-12">
        <USeparator :label="t('ui.support_section')" />
      </div>
      <div class="col-span-12">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "SU Needles Chart & Comparison Tool | Classic Mini DIY",
    "description": "Compare SU carburettor needles for your Classic Mini with our interactive chart. Find the right needle profile for your engine build with this comprehensive comparison tool.",
    "keywords": "SU needles, carburettor needles, Classic Mini, needle comparison, SU carburettor, needle profiles, Mini Cooper",
    "hero_title": "Needle Configurator",
    "breadcrumb_title": "Needle Comparison",
    "og_title": "SU Needles Chart & Comparison Tool | Classic Mini DIY",
    "og_description": "Compare SU carburettor needles for your Classic Mini with our interactive chart. Find the right needle profile for your engine build.",
    "twitter_title": "SU Needles Chart & Comparison Tool | Classic Mini DIY",
    "twitter_description": "Compare SU carburettor needles for your Classic Mini with our interactive chart.",
    "main_heading": "SU Carburettor Needles Comparison Tool",
    "description_text": "One of the most confusing things about working on your Classic Mini often is the carburettor needle used on your car. Below you will find a multi-needle comparison chart which will allow you to compare needle profiles of multiple SU needles at the same time. Choose the needles you would like to compare and click Compare which will redraw the chart with new profiles. A huge thank you to the mintylamb site for posting this information publically.",
    "structured_data": {
      "name": "How to Compare SU Carburettor Needles",
      "description": "Compare different SU carburettor needles to find the right profile for your Classic Mini engine build.",
      "steps": {
        "select_needles": {
          "name": "Select Needles",
          "text": "Start typing the name of the needles you would like to compare in the dropdown menu."
        },
        "add_to_comparison": {
          "name": "Add to Comparison",
          "text": "Click the \"Add Needle\" button to add the selected needle to the comparison chart."
        },
        "view_comparison": {
          "name": "View Comparison",
          "text": "The chart will automatically update to show the profiles of all selected needles for comparison."
        }
      },
      "tool_name": "Interactive Needle Comparison Chart"
    },
    "ui": {
      "loading_fallback": "Loading needle comparison tool...",
      "loading_text": "Loading needle comparison tool...",
      "needle_charts_section": "Needle Charts",
      "find_needle_heading": "Find the needle for your carb",
      "information_provided_by": "Information provided by",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "Support"
    }
  },
  "es": {
    "title": "Gráfico de Agujas SU y Herramienta de Comparación | Classic Mini DIY",
    "description": "Compara las agujas del carburador SU para tu Classic Mini con nuestro gráfico interactivo. Encuentra el perfil de aguja correcto para la construcción de tu motor con esta herramienta de comparación integral.",
    "keywords": "agujas SU, agujas carburador, Classic Mini, comparación agujas, carburador SU, perfiles agujas, Mini Cooper",
    "hero_title": "Configurador de Agujas",
    "breadcrumb_title": "Comparación de Agujas",
    "og_title": "Gráfico de Agujas SU y Herramienta de Comparación | Classic Mini DIY",
    "og_description": "Compara las agujas del carburador SU para tu Classic Mini con nuestro gráfico interactivo. Encuentra el perfil de aguja correcto para la construcción de tu motor.",
    "twitter_title": "Gráfico de Agujas SU y Herramienta de Comparación | Classic Mini DIY",
    "twitter_description": "Compara las agujas del carburador SU para tu Classic Mini con nuestro gráfico interactivo.",
    "main_heading": "Herramienta de Comparación de Agujas de Carburador SU",
    "description_text": "Una de las cosas más confusas sobre trabajar en tu Classic Mini a menudo es la aguja del carburador usada en tu coche. A continuación encontrarás un gráfico de comparación de múltiples agujas que te permitirá comparar perfiles de agujas de múltiples agujas SU al mismo tiempo. Elige las agujas que te gustaría comparar y haz clic en Comparar que redibujará el gráfico con nuevos perfiles. Un gran agradecimiento al sitio mintylamb por publicar esta información públicamente.",
    "structured_data": {
      "name": "Cómo Comparar Agujas de Carburador SU",
      "description": "Compara diferentes agujas de carburador SU para encontrar el perfil correcto para la construcción de tu motor Classic Mini.",
      "steps": {
        "select_needles": {
          "name": "Seleccionar Agujas",
          "text": "Comienza escribiendo el nombre de las agujas que te gustaría comparar en el menú desplegable."
        },
        "add_to_comparison": {
          "name": "Agregar a Comparación",
          "text": "Haz clic en el botón \"Agregar Aguja\" para agregar la aguja seleccionada al gráfico de comparación."
        },
        "view_comparison": {
          "name": "Ver Comparación",
          "text": "El gráfico se actualizará automáticamente para mostrar los perfiles de todas las agujas seleccionadas para comparación."
        }
      },
      "tool_name": "Gráfico Interactivo de Comparación de Agujas"
    },
    "ui": {
      "loading_fallback": "Cargando herramienta de comparación de agujas...",
      "loading_text": "Cargando herramienta de comparación de agujas...",
      "needle_charts_section": "Gráficos de Agujas",
      "find_needle_heading": "Encuentra la aguja para tu carburador",
      "information_provided_by": "Información proporcionada por",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "Soporte"
    }
  },
  "fr": {
    "title": "Graphique des Aiguilles SU et Outil de Comparaison | Classic Mini DIY",
    "description": "Comparez les aiguilles de carburateur SU pour votre Classic Mini avec notre graphique interactif. Trouvez le bon profil d'aiguille pour la construction de votre moteur avec cet outil de comparaison complet.",
    "keywords": "aiguilles SU, aiguilles carburateur, Classic Mini, comparaison aiguilles, carburateur SU, profils aiguilles, Mini Cooper",
    "hero_title": "Configurateur d'Aiguilles",
    "breadcrumb_title": "Comparaison d'Aiguilles",
    "og_title": "Graphique des Aiguilles SU et Outil de Comparaison | Classic Mini DIY",
    "og_description": "Comparez les aiguilles de carburateur SU pour votre Classic Mini avec notre graphique interactif. Trouvez le bon profil d'aiguille pour la construction de votre moteur.",
    "twitter_title": "Graphique des Aiguilles SU et Outil de Comparaison | Classic Mini DIY",
    "twitter_description": "Comparez les aiguilles de carburateur SU pour votre Classic Mini avec notre graphique interactif.",
    "main_heading": "Outil de Comparaison des Aiguilles de Carburateur SU",
    "description_text": "L'une des choses les plus déroutantes lors du travail sur votre Classic Mini est souvent l'aiguille de carburateur utilisée sur votre voiture. Ci-dessous, vous trouverez un graphique de comparaison multi-aiguilles qui vous permettra de comparer les profils d'aiguilles de plusieurs aiguilles SU en même temps. Choisissez les aiguilles que vous aimeriez comparer et cliquez sur Comparer qui redessinera le graphique avec de nouveaux profils. Un grand merci au site mintylamb pour avoir publié ces informations publiquement.",
    "structured_data": {
      "name": "Comment Comparer les Aiguilles de Carburateur SU",
      "description": "Comparez différentes aiguilles de carburateur SU pour trouver le bon profil pour la construction de votre moteur Classic Mini.",
      "steps": {
        "select_needles": {
          "name": "Sélectionner les Aiguilles",
          "text": "Commencez à taper le nom des aiguilles que vous aimeriez comparer dans le menu déroulant."
        },
        "add_to_comparison": {
          "name": "Ajouter à la Comparaison",
          "text": "Cliquez sur le bouton \"Ajouter Aiguille\" pour ajouter l'aiguille sélectionnée au graphique de comparaison."
        },
        "view_comparison": {
          "name": "Voir la Comparaison",
          "text": "Le graphique se mettra automatiquement à jour pour montrer les profils de toutes les aiguilles sélectionnées pour comparaison."
        }
      },
      "tool_name": "Graphique Interactif de Comparaison d'Aiguilles"
    },
    "ui": {
      "loading_fallback": "Chargement de l'outil de comparaison d'aiguilles...",
      "loading_text": "Chargement de l'outil de comparaison d'aiguilles...",
      "needle_charts_section": "Graphiques d'Aiguilles",
      "find_needle_heading": "Trouvez l'aiguille pour votre carburateur",
      "information_provided_by": "Informations fournies par",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "Support"
    }
  },
  "it": {
    "title": "Grafico Aghi SU e Strumento di Confronto | Classic Mini DIY",
    "description": "Confronta gli aghi del carburatore SU per la tua Classic Mini con il nostro grafico interattivo. Trova il profilo dell'ago giusto per la costruzione del tuo motore con questo strumento di confronto completo.",
    "keywords": "aghi SU, aghi carburatore, Classic Mini, confronto aghi, carburatore SU, profili aghi, Mini Cooper",
    "hero_title": "Configuratore Aghi",
    "breadcrumb_title": "Confronto Aghi",
    "og_title": "Grafico Aghi SU e Strumento di Confronto | Classic Mini DIY",
    "og_description": "Confronta gli aghi del carburatore SU per la tua Classic Mini con il nostro grafico interattivo. Trova il profilo dell'ago giusto per la costruzione del tuo motore.",
    "twitter_title": "Grafico Aghi SU e Strumento di Confronto | Classic Mini DIY",
    "twitter_description": "Confronta gli aghi del carburatore SU per la tua Classic Mini con il nostro grafico interattivo.",
    "main_heading": "Strumento di Confronto Aghi Carburatore SU",
    "description_text": "Una delle cose più confuse nel lavorare sulla tua Classic Mini spesso è l'ago del carburatore usato sulla tua auto. Di seguito troverai un grafico di confronto multi-ago che ti permetterà di confrontare i profili degli aghi di più aghi SU contemporaneamente. Scegli gli aghi che vorresti confrontare e clicca Confronta che ridisegnerà il grafico con nuovi profili. Un grande ringraziamento al sito mintylamb per aver pubblicato queste informazioni pubblicamente.",
    "structured_data": {
      "name": "Come Confrontare gli Aghi del Carburatore SU",
      "description": "Confronta diversi aghi del carburatore SU per trovare il profilo giusto per la costruzione del tuo motore Classic Mini.",
      "steps": {
        "select_needles": {
          "name": "Seleziona Aghi",
          "text": "Inizia a digitare il nome degli aghi che vorresti confrontare nel menu a discesa."
        },
        "add_to_comparison": {
          "name": "Aggiungi al Confronto",
          "text": "Clicca il pulsante \"Aggiungi Ago\" per aggiungere l'ago selezionato al grafico di confronto."
        },
        "view_comparison": {
          "name": "Visualizza Confronto",
          "text": "Il grafico si aggiornerà automaticamente per mostrare i profili di tutti gli aghi selezionati per il confronto."
        }
      },
      "tool_name": "Grafico Interattivo di Confronto Aghi"
    },
    "ui": {
      "loading_fallback": "Caricamento strumento di confronto aghi...",
      "loading_text": "Caricamento strumento di confronto aghi...",
      "needle_charts_section": "Grafici Aghi",
      "find_needle_heading": "Trova l'ago per il tuo carburatore",
      "information_provided_by": "Informazioni fornite da",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "Supporto"
    }
  },
  "de": {
    "title": "SU Nadeln Diagramm & Vergleichstool | Classic Mini DIY",
    "description": "Vergleichen Sie SU Vergasernadeln für Ihren Classic Mini mit unserem interaktiven Diagramm. Finden Sie das richtige Nadelprofil für Ihren Motoraufbau mit diesem umfassenden Vergleichstool.",
    "keywords": "SU Nadeln, Vergasernadeln, Classic Mini, Nadelvergleich, SU Vergaser, Nadelprofile, Mini Cooper",
    "hero_title": "Nadel-Konfigurator",
    "breadcrumb_title": "Nadelvergleich",
    "og_title": "SU Nadeln Diagramm & Vergleichstool | Classic Mini DIY",
    "og_description": "Vergleichen Sie SU Vergasernadeln für Ihren Classic Mini mit unserem interaktiven Diagramm. Finden Sie das richtige Nadelprofil für Ihren Motoraufbau.",
    "twitter_title": "SU Nadeln Diagramm & Vergleichstool | Classic Mini DIY",
    "twitter_description": "Vergleichen Sie SU Vergasernadeln für Ihren Classic Mini mit unserem interaktiven Diagramm.",
    "main_heading": "SU Vergasernadeln Vergleichstool",
    "description_text": "Eines der verwirrendsten Dinge beim Arbeiten an Ihrem Classic Mini ist oft die Vergasernadel, die in Ihrem Auto verwendet wird. Unten finden Sie ein Multi-Nadel-Vergleichsdiagramm, mit dem Sie Nadelprofile mehrerer SU-Nadeln gleichzeitig vergleichen können. Wählen Sie die Nadeln aus, die Sie vergleichen möchten, und klicken Sie auf Vergleichen, wodurch das Diagramm mit neuen Profilen neu gezeichnet wird. Ein großer Dank an die mintylamb-Website für die öffentliche Veröffentlichung dieser Informationen.",
    "structured_data": {
      "name": "Wie man SU Vergasernadeln vergleicht",
      "description": "Vergleichen Sie verschiedene SU Vergasernadeln, um das richtige Profil für Ihren Classic Mini Motoraufbau zu finden.",
      "steps": {
        "select_needles": {
          "name": "Nadeln auswählen",
          "text": "Beginnen Sie mit der Eingabe des Namens der Nadeln, die Sie im Dropdown-Menü vergleichen möchten."
        },
        "add_to_comparison": {
          "name": "Zum Vergleich hinzufügen",
          "text": "Klicken Sie auf die Schaltfläche \"Nadel hinzufügen\", um die ausgewählte Nadel zum Vergleichsdiagramm hinzuzufügen."
        },
        "view_comparison": {
          "name": "Vergleich anzeigen",
          "text": "Das Diagramm wird automatisch aktualisiert, um die Profile aller ausgewählten Nadeln zum Vergleich anzuzeigen."
        }
      },
      "tool_name": "Interaktives Nadelvergleichsdiagramm"
    },
    "ui": {
      "loading_fallback": "Nadelvergleichstool wird geladen...",
      "loading_text": "Nadelvergleichstool wird geladen...",
      "needle_charts_section": "Nadeldiagramme",
      "find_needle_heading": "Finden Sie die Nadel für Ihren Vergaser",
      "information_provided_by": "Informationen bereitgestellt von",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "Support"
    }
  },
  "pt": {
    "title": "Gráfico de Agulhas SU e Ferramenta de Comparação | Classic Mini DIY",
    "description": "Compare as agulhas do carburador SU para o seu Classic Mini com o nosso gráfico interativo. Encontre o perfil de agulha certo para a construção do seu motor com esta ferramenta de comparação abrangente.",
    "keywords": "agulhas SU, agulhas carburador, Classic Mini, comparação agulhas, carburador SU, perfis agulhas, Mini Cooper",
    "hero_title": "Configurador de Agulhas",
    "breadcrumb_title": "Comparação de Agulhas",
    "og_title": "Gráfico de Agulhas SU e Ferramenta de Comparação | Classic Mini DIY",
    "og_description": "Compare as agulhas do carburador SU para o seu Classic Mini com o nosso gráfico interativo. Encontre o perfil de agulha certo para a construção do seu motor.",
    "twitter_title": "Gráfico de Agulhas SU e Ferramenta de Comparação | Classic Mini DIY",
    "twitter_description": "Compare as agulhas do carburador SU para o seu Classic Mini com o nosso gráfico interativo.",
    "main_heading": "Ferramenta de Comparação de Agulhas de Carburador SU",
    "description_text": "Uma das coisas mais confusas sobre trabalhar no seu Classic Mini muitas vezes é a agulha do carburador usada no seu carro. Abaixo você encontrará um gráfico de comparação multi-agulhas que permitirá comparar perfis de agulhas de múltiplas agulhas SU ao mesmo tempo. Escolha as agulhas que gostaria de comparar e clique em Comparar que redesenhará o gráfico com novos perfis. Um grande obrigado ao site mintylamb por publicar essas informações publicamente.",
    "structured_data": {
      "name": "Como Comparar Agulhas de Carburador SU",
      "description": "Compare diferentes agulhas de carburador SU para encontrar o perfil certo para a construção do seu motor Classic Mini.",
      "steps": {
        "select_needles": {
          "name": "Selecionar Agulhas",
          "text": "Comece digitando o nome das agulhas que gostaria de comparar no menu suspenso."
        },
        "add_to_comparison": {
          "name": "Adicionar à Comparação",
          "text": "Clique no botão \"Adicionar Agulha\" para adicionar a agulha selecionada ao gráfico de comparação."
        },
        "view_comparison": {
          "name": "Ver Comparação",
          "text": "O gráfico será automaticamente atualizado para mostrar os perfis de todas as agulhas selecionadas para comparação."
        }
      },
      "tool_name": "Gráfico Interativo de Comparação de Agulhas"
    },
    "ui": {
      "loading_fallback": "Carregando ferramenta de comparação de agulhas...",
      "loading_text": "Carregando ferramenta de comparação de agulhas...",
      "needle_charts_section": "Gráficos de Agulhas",
      "find_needle_heading": "Encontre a agulha para o seu carburador",
      "information_provided_by": "Informações fornecidas por",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "Suporte"
    }
  },
  "ru": {
    "title": "Схема игл SU и инструмент сравнения | Classic Mini DIY",
    "description": "Сравните иглы карбюратора SU для вашего Classic Mini с помощью нашей интерактивной схемы. Найдите правильный профиль иглы для сборки вашего двигателя с помощью этого комплексного инструмента сравнения.",
    "keywords": "иглы SU, иглы карбюратора, Classic Mini, сравнение игл, карбюратор SU, профили игл, Mini Cooper",
    "hero_title": "Конфигуратор игл",
    "breadcrumb_title": "Сравнение игл",
    "og_title": "Схема игл SU и инструмент сравнения | Classic Mini DIY",
    "og_description": "Сравните иглы карбюратора SU для вашего Classic Mini с помощью нашей интерактивной схемы. Найдите правильный профиль иглы для сборки вашего двигателя.",
    "twitter_title": "Схема игл SU и инструмент сравнения | Classic Mini DIY",
    "twitter_description": "Сравните иглы карбюратора SU для вашего Classic Mini с помощью нашей интерактивной схемы.",
    "main_heading": "Инструмент сравнения игл карбюратора SU",
    "description_text": "Одна из самых запутанных вещей при работе с вашим Classic Mini часто является игла карбюратора, используемая в вашем автомобиле. Ниже вы найдете схему сравнения нескольких игл, которая позволит вам сравнивать профили игл нескольких игл SU одновременно. Выберите иглы, которые вы хотели бы сравнить, и нажмите Сравнить, что перерисует схему с новыми профилями. Большое спасибо сайту mintylamb за публичную публикацию этой информации.",
    "structured_data": {
      "name": "Как сравнивать иглы карбюратора SU",
      "description": "Сравните различные иглы карбюратора SU, чтобы найти правильный профиль для сборки вашего двигателя Classic Mini.",
      "steps": {
        "select_needles": {
          "name": "Выберите иглы",
          "text": "Начните вводить название игл, которые вы хотели бы сравнить в выпадающем меню."
        },
        "add_to_comparison": {
          "name": "Добавить к сравнению",
          "text": "Нажмите кнопку \"Добавить иглу\", чтобы добавить выбранную иглу к схеме сравнения."
        },
        "view_comparison": {
          "name": "Просмотреть сравнение",
          "text": "Схема автоматически обновится, чтобы показать профили всех выбранных игл для сравнения."
        }
      },
      "tool_name": "Интерактивная схема сравнения игл"
    },
    "ui": {
      "loading_fallback": "Загрузка инструмента сравнения игл...",
      "loading_text": "Загрузка инструмента сравнения игл...",
      "needle_charts_section": "Схемы игл",
      "find_needle_heading": "Найдите иглу для вашего карбюратора",
      "information_provided_by": "Информация предоставлена",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "Поддержка"
    }
  },
  "ja": {
    "title": "SUニードルチャート＆比較ツール | Classic Mini DIY",
    "description": "インタラクティブチャートでClassic MiniのSUキャブレターニードルを比較しましょう。この包括的な比較ツールでエンジンビルドに適したニードルプロファイルを見つけてください。",
    "keywords": "SUニードル, キャブレターニードル, Classic Mini, ニードル比較, SUキャブレター, ニードルプロファイル, Mini Cooper",
    "hero_title": "ニードル設定ツール",
    "breadcrumb_title": "ニードル比較",
    "og_title": "SUニードルチャート＆比較ツール | Classic Mini DIY",
    "og_description": "インタラクティブチャートでClassic MiniのSUキャブレターニードルを比較しましょう。エンジンビルドに適したニードルプロファイルを見つけてください。",
    "twitter_title": "SUニードルチャート＆比較ツール | Classic Mini DIY",
    "twitter_description": "インタラクティブチャートでClassic MiniのSUキャブレターニードルを比較しましょう。",
    "main_heading": "SUキャブレターニードル比較ツール",
    "description_text": "Classic Miniで作業する際に最も混乱することの一つは、車に使用されているキャブレターニードルです。以下では、複数のSUニードルのニードルプロファイルを同時に比較できるマルチニードル比較チャートを見つけることができます。比較したいニードルを選択し、比較をクリックすると、新しいプロファイルでチャートが再描画されます。この情報を公開してくれたmintylamb サイトに大きな感謝を。",
    "structured_data": {
      "name": "SUキャブレターニードルの比較方法",
      "description": "Classic Miniエンジンビルドに適したプロファイルを見つけるために、異なるSUキャブレターニードルを比較します。",
      "steps": {
        "select_needles": {
          "name": "ニードルを選択",
          "text": "ドロップダウンメニューで比較したいニードルの名前を入力し始めてください。"
        },
        "add_to_comparison": {
          "name": "比較に追加",
          "text": "「ニードルを追加」ボタンをクリックして、選択したニードルを比較チャートに追加します。"
        },
        "view_comparison": {
          "name": "比較を表示",
          "text": "チャートは自動的に更新され、比較のために選択されたすべてのニードルのプロファイルを表示します。"
        }
      },
      "tool_name": "インタラクティブニードル比較チャート"
    },
    "ui": {
      "loading_fallback": "ニードル比較ツールを読み込み中...",
      "loading_text": "ニードル比較ツールを読み込み中...",
      "needle_charts_section": "ニードルチャート",
      "find_needle_heading": "キャブレター用のニードルを見つける",
      "information_provided_by": "情報提供",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "サポート"
    }
  },
  "zh": {
    "title": "SU针阀图表和比较工具 | Classic Mini DIY",
    "description": "使用我们的交互式图表比较Classic Mini的SU化油器针阀。使用这个全面的比较工具为您的发动机构建找到合适的针阀轮廓。",
    "keywords": "SU针阀, 化油器针阀, Classic Mini, 针阀比较, SU化油器, 针阀轮廓, Mini Cooper",
    "hero_title": "针阀配置器",
    "breadcrumb_title": "针阀比较",
    "og_title": "SU针阀图表和比较工具 | Classic Mini DIY",
    "og_description": "使用我们的交互式图表比较Classic Mini的SU化油器针阀。为您的发动机构建找到合适的针阀轮廓。",
    "twitter_title": "SU针阀图表和比较工具 | Classic Mini DIY",
    "twitter_description": "使用我们的交互式图表比较Classic Mini的SU化油器针阀。",
    "main_heading": "SU化油器针阀比较工具",
    "description_text": "在维修Classic Mini时最令人困惑的事情之一通常是汽车上使用的化油器针阀。下面您将找到一个多针阀比较图表，它将允许您同时比较多个SU针阀的针阀轮廓。选择您想要比较的针阀，然后点击比较，这将用新的轮廓重新绘制图表。非常感谢mintylamb网站公开发布这些信息。",
    "structured_data": {
      "name": "如何比较SU化油器针阀",
      "description": "比较不同的SU化油器针阀，为您的Classic Mini发动机构建找到合适的轮廓。",
      "steps": {
        "select_needles": {
          "name": "选择针阀",
          "text": "开始在下拉菜单中输入您想要比较的针阀名称。"
        },
        "add_to_comparison": {
          "name": "添加到比较",
          "text": "点击\"添加针阀\"按钮将选定的针阀添加到比较图表中。"
        },
        "view_comparison": {
          "name": "查看比较",
          "text": "图表将自动更新以显示所有选定针阀的轮廓进行比较。"
        }
      },
      "tool_name": "交互式针阀比较图表"
    },
    "ui": {
      "loading_fallback": "正在加载针阀比较工具...",
      "loading_text": "正在加载针阀比较工具...",
      "needle_charts_section": "针阀图表",
      "find_needle_heading": "为您的化油器找到针阀",
      "information_provided_by": "信息提供方",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "支持"
    }
  },
  "ko": {
    "title": "SU 니들 차트 및 비교 도구 | Classic Mini DIY",
    "description": "대화형 차트로 Classic Mini의 SU 카뷰레터 니들을 비교하세요. 이 포괄적인 비교 도구로 엔진 빌드에 적합한 니들 프로파일을 찾으세요.",
    "keywords": "SU 니들, 카뷰레터 니들, Classic Mini, 니들 비교, SU 카뷰레터, 니들 프로파일, Mini Cooper",
    "hero_title": "니들 구성기",
    "breadcrumb_title": "니들 비교",
    "og_title": "SU 니들 차트 및 비교 도구 | Classic Mini DIY",
    "og_description": "대화형 차트로 Classic Mini의 SU 카뷰레터 니들을 비교하세요. 엔진 빌드에 적합한 니들 프로파일을 찾으세요.",
    "twitter_title": "SU 니들 차트 및 비교 도구 | Classic Mini DIY",
    "twitter_description": "대화형 차트로 Classic Mini의 SU 카뷰레터 니들을 비교하세요.",
    "main_heading": "SU 카뷰레터 니들 비교 도구",
    "description_text": "Classic Mini 작업에서 가장 혼란스러운 것 중 하나는 종종 차에 사용된 카뷰레터 니들입니다. 아래에서 여러 SU 니들의 니들 프로파일을 동시에 비교할 수 있는 멀티 니들 비교 차트를 찾을 수 있습니다. 비교하고 싶은 니들을 선택하고 비교를 클릭하면 새로운 프로파일로 차트가 다시 그려집니다. 이 정보를 공개적으로 게시해준 mintylamb 사이트에 큰 감사를 드립니다.",
    "structured_data": {
      "name": "SU 카뷰레터 니들 비교 방법",
      "description": "Classic Mini 엔진 빌드에 적합한 프로파일을 찾기 위해 다양한 SU 카뷰레터 니들을 비교합니다.",
      "steps": {
        "select_needles": {
          "name": "니들 선택",
          "text": "드롭다운 메뉴에서 비교하고 싶은 니들의 이름을 입력하기 시작하세요."
        },
        "add_to_comparison": {
          "name": "비교에 추가",
          "text": "\"니들 추가\" 버튼을 클릭하여 선택한 니들을 비교 차트에 추가하세요."
        },
        "view_comparison": {
          "name": "비교 보기",
          "text": "차트는 비교를 위해 선택된 모든 니들의 프로파일을 표시하도록 자동으로 업데이트됩니다."
        }
      },
      "tool_name": "대화형 니들 비교 차트"
    },
    "ui": {
      "loading_fallback": "니들 비교 도구 로딩 중...",
      "loading_text": "니들 비교 도구 로딩 중...",
      "needle_charts_section": "니들 차트",
      "find_needle_heading": "카뷰레터용 니들 찾기",
      "information_provided_by": "정보 제공",
      "seven_mini_parts_link": "Seven Mini Parts",
      "support_section": "지원"
    }
  }
}
</i18n>

<style lang="scss">
  .b-tabs .tab-content {
    padding-left: 0px;
    padding-right: 0px;
  }
</style>
