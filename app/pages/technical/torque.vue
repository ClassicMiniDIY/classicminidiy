<script lang="ts" setup>
  import { h } from 'vue';
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { data: tables, status } = await useFetch('/api/torque');
  const tableSearchQueries = ref<Record<string, string>>({});

  const tableColumns = [
    {
      accessorKey: 'name',
      header: () => t('table_headers.fastener'),
      cell: ({ row }) => row.getValue('name'),
    },
    {
      accessorKey: 'lbft',
      header: () => t('table_headers.torque_lbft'),
      cell: ({ row }) =>
        h(
          'span',
          {
            class: 'px-2 py-1 rounded bg-primary/10 text-primary font-medium',
          },
          row.getValue('lbft')
        ),
    },
    {
      accessorKey: 'nm',
      header: () => t('table_headers.torque_nm'),
      cell: ({ row }) =>
        h(
          'span',
          {
            class: 'px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium',
          },
          row.getValue('nm')
        ),
    },
    {
      accessorKey: 'notes',
      header: () => t('table_headers.notes'),
      cell: ({ row }) => row.getValue('notes') || t('ui.no_notes'),
    },
  ];
  const activePanel = ref<string | null>(null);

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
        href: 'https://classicminidiy.com/technical/torque',
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
    ogUrl: 'https://classicminidiy.com/technical/torque',
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
    author: {
      '@type': 'Person',
      name: 'Classic Mini DIY',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/logo.png',
      },
    },
    url: 'https://classicminidiy.com/technical/torque',
    mainEntity: {
      '@type': 'Dataset',
      name: t('structured_data.dataset_name'),
      description: t('structured_data.dataset_description'),
      variableMeasured: t('structured_data.variable_measured'),
    },
  }));

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: () => JSON.stringify(torqueSpecsJsonLd.value),
      },
    ],
  });

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
            <h1 class="text-2xl font-bold mb-4">{{ t('main_heading') }}</h1>
            <p class="mb-6">
              {{ t('description_text') }}
            </p>
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
        <div v-if="tables && status !== 'pending'" class="space-y-4">
          <UAccordion
            :items="
              Object.entries(tables).map(([key, table]) => ({
                label: table.title,
                value: key,
                table,
              }))
            "
            :ui="{
              trigger: 'text-lg font-semibold py-4',
            }"
          >
            <template #body="{ item }">
              <!-- Search field -->
              <div class="flex justify-end mb-4">
                <UInput
                  type="text"
                  :placeholder="t('ui.search_placeholder')"
                  v-model="tableSearchQueries[item.value]"
                  class="w-full max-w-xs"
                  icon="i-fa6-solid-magnifying-glass"
                />
              </div>

              <!-- Table -->
              <div class="w-full overflow-x-auto">
                <UTable
                  :data="filterItems(item.table.items, item.value)"
                  :columns="tableColumns"
                  class="w-full min-w-full"
                />
              </div>
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
    "title": "Classic Mini Torque Specifications Chart | Classic Mini DIY",
    "description": "Complete torque specifications for Classic Mini fasteners. Reference chart for engine, suspension, drivetrain, and body fasteners with values in lb/ft and Nm.",
    "keywords": "Classic Mini torque specs, Mini Cooper fasteners, torque specifications, engine torque values, suspension torque, Mini maintenance, classic car specifications",
    "hero_title": "Torque Specs",
    "breadcrumb_title": "Torque Specs",
    "main_heading": "Torque Specifications",
    "description_text": "Complete torque specifications for Classic Mini fasteners. Reference chart for engine, suspension, drivetrain, and body fasteners with values in lb/ft and Nm.",
    "support_divider": "Support",
    "og_title": "Classic Mini Torque Specifications Chart | Classic Mini DIY",
    "og_description": "Complete torque specifications for Classic Mini fasteners. Reference chart for engine, suspension, drivetrain, and body fasteners with values in lb/ft and Nm.",
    "twitter_title": "Classic Mini Torque Specifications Chart",
    "twitter_description": "Complete torque specifications for Classic Mini fasteners. Reference chart for engine, suspension, drivetrain, and body fasteners.",
    "structured_data": {
      "headline": "Classic Mini Torque Specifications Chart",
      "description": "Complete torque specifications for Classic Mini fasteners. Reference chart for engine, suspension, drivetrain, and body fasteners with values in lb/ft and Nm.",
      "dataset_name": "Classic Mini Torque Specifications",
      "dataset_description": "Comprehensive dataset of torque specifications for Classic Mini fasteners",
      "variable_measured": "Fastener Name, Torque in lb/ft, Torque in Nm, Additional Notes"
    },
    "table_headers": {
      "fastener": "Fastener",
      "torque_lbft": "Torque (lb/ft)",
      "torque_nm": "Torque (Nm)",
      "notes": "Notes"
    },
    "ui": {
      "search_placeholder": "Search this table",
      "no_notes": "---"
    }
  },
  "es": {
    "title": "Tabla de Especificaciones de Torque Classic Mini | Classic Mini DIY",
    "description": "Especificaciones completas de torque para sujetadores Classic Mini. Tabla de referencia para sujetadores de motor, suspensión, tren motriz y carrocería con valores en lb/ft y Nm.",
    "keywords": "especificaciones torque Classic Mini, sujetadores Mini Cooper, especificaciones torque, valores torque motor, torque suspensión, mantenimiento Mini, especificaciones auto clásico",
    "hero_title": "Especificaciones de Torque",
    "breadcrumb_title": "Especificaciones de Torque",
    "main_heading": "Especificaciones de Torque",
    "description_text": "Especificaciones completas de torque para sujetadores Classic Mini. Tabla de referencia para sujetadores de motor, suspensión, tren motriz y carrocería con valores en lb/ft y Nm.",
    "support_divider": "Soporte",
    "og_title": "Tabla de Especificaciones de Torque Classic Mini | Classic Mini DIY",
    "og_description": "Especificaciones completas de torque para sujetadores Classic Mini. Tabla de referencia para sujetadores de motor, suspensión, tren motriz y carrocería con valores en lb/ft y Nm.",
    "twitter_title": "Tabla de Especificaciones de Torque Classic Mini",
    "twitter_description": "Especificaciones completas de torque para sujetadores Classic Mini. Tabla de referencia para sujetadores de motor, suspensión, tren motriz y carrocería.",
    "structured_data": {
      "headline": "Tabla de Especificaciones de Torque Classic Mini",
      "description": "Especificaciones completas de torque para sujetadores Classic Mini. Tabla de referencia para sujetadores de motor, suspensión, tren motriz y carrocería con valores en lb/ft y Nm.",
      "dataset_name": "Especificaciones de Torque Classic Mini",
      "dataset_description": "Conjunto de datos completo de especificaciones de torque para sujetadores Classic Mini",
      "variable_measured": "Nombre del Sujetador, Torque en lb/ft, Torque en Nm, Notas Adicionales"
    },
    "table_headers": {
      "fastener": "Sujetador",
      "torque_lbft": "Torque (lb/ft)",
      "torque_nm": "Torque (Nm)",
      "notes": "Notas"
    },
    "ui": {
      "search_placeholder": "Buscar en esta tabla",
      "no_notes": "---"
    }
  },
  "fr": {
    "title": "Tableau des Spécifications de Couple Classic Mini | Classic Mini DIY",
    "description": "Spécifications complètes de couple pour les fixations Classic Mini. Tableau de référence pour les fixations moteur, suspension, transmission et carrosserie avec valeurs en lb/ft et Nm.",
    "keywords": "spécifications couple Classic Mini, fixations Mini Cooper, spécifications couple, valeurs couple moteur, couple suspension, entretien Mini, spécifications voiture classique",
    "hero_title": "Spécifications de Couple",
    "breadcrumb_title": "Spécifications de Couple",
    "main_heading": "Spécifications de Couple",
    "description_text": "Spécifications complètes de couple pour les fixations Classic Mini. Tableau de référence pour les fixations moteur, suspension, transmission et carrosserie avec valeurs en lb/ft et Nm.",
    "support_divider": "Support",
    "og_title": "Tableau des Spécifications de Couple Classic Mini | Classic Mini DIY",
    "og_description": "Spécifications complètes de couple pour les fixations Classic Mini. Tableau de référence pour les fixations moteur, suspension, transmission et carrosserie avec valeurs en lb/ft et Nm.",
    "twitter_title": "Tableau des Spécifications de Couple Classic Mini",
    "twitter_description": "Spécifications complètes de couple pour les fixations Classic Mini. Tableau de référence pour les fixations moteur, suspension, transmission et carrosserie.",
    "structured_data": {
      "headline": "Tableau des Spécifications de Couple Classic Mini",
      "description": "Spécifications complètes de couple pour les fixations Classic Mini. Tableau de référence pour les fixations moteur, suspension, transmission et carrosserie avec valeurs en lb/ft et Nm.",
      "dataset_name": "Spécifications de Couple Classic Mini",
      "dataset_description": "Jeu de données complet des spécifications de couple pour les fixations Classic Mini",
      "variable_measured": "Nom de la Fixation, Couple en lb/ft, Couple en Nm, Notes Supplémentaires"
    },
    "table_headers": {
      "fastener": "Fixation",
      "torque_lbft": "Couple (lb/ft)",
      "torque_nm": "Couple (Nm)",
      "notes": "Notes"
    },
    "ui": {
      "search_placeholder": "Rechercher dans ce tableau",
      "no_notes": "---"
    }
  },
  "it": {
    "title": "Tabella Specifiche di Coppia Classic Mini | Classic Mini DIY",
    "description": "Specifiche complete di coppia per elementi di fissaggio Classic Mini. Tabella di riferimento per elementi di fissaggio motore, sospensioni, trasmissione e carrozzeria con valori in lb/ft e Nm.",
    "keywords": "specifiche coppia Classic Mini, elementi fissaggio Mini Cooper, specifiche coppia, valori coppia motore, coppia sospensioni, manutenzione Mini, specifiche auto classica",
    "hero_title": "Specifiche di Coppia",
    "breadcrumb_title": "Specifiche di Coppia",
    "main_heading": "Specifiche di Coppia",
    "description_text": "Specifiche complete di coppia per elementi di fissaggio Classic Mini. Tabella di riferimento per elementi di fissaggio motore, sospensioni, trasmissione e carrozzeria con valori in lb/ft e Nm.",
    "support_divider": "Supporto",
    "og_title": "Tabella Specifiche di Coppia Classic Mini | Classic Mini DIY",
    "og_description": "Specifiche complete di coppia per elementi di fissaggio Classic Mini. Tabella di riferimento per elementi di fissaggio motore, sospensioni, trasmissione e carrozzeria con valori in lb/ft e Nm.",
    "twitter_title": "Tabella Specifiche di Coppia Classic Mini",
    "twitter_description": "Specifiche complete di coppia per elementi di fissaggio Classic Mini. Tabella di riferimento per elementi di fissaggio motore, sospensioni, trasmissione e carrozzeria.",
    "structured_data": {
      "headline": "Tabella Specifiche di Coppia Classic Mini",
      "description": "Specifiche complete di coppia per elementi di fissaggio Classic Mini. Tabella di riferimento per elementi di fissaggio motore, sospensioni, trasmissione e carrozzeria con valori in lb/ft e Nm.",
      "dataset_name": "Specifiche di Coppia Classic Mini",
      "dataset_description": "Set di dati completo delle specifiche di coppia per elementi di fissaggio Classic Mini",
      "variable_measured": "Nome Elemento di Fissaggio, Coppia in lb/ft, Coppia in Nm, Note Aggiuntive"
    },
    "table_headers": {
      "fastener": "Elemento di Fissaggio",
      "torque_lbft": "Coppia (lb/ft)",
      "torque_nm": "Coppia (Nm)",
      "notes": "Note"
    },
    "ui": {
      "search_placeholder": "Cerca in questa tabella",
      "no_notes": "---"
    }
  },
  "de": {
    "title": "Classic Mini Drehmoment-Spezifikationstabelle | Classic Mini DIY",
    "description": "Vollständige Drehmoment-Spezifikationen für Classic Mini Befestigungselemente. Referenztabelle für Motor-, Fahrwerk-, Antriebsstrang- und Karosseriebefestigungen mit Werten in lb/ft und Nm.",
    "keywords": "Classic Mini Drehmoment-Spezifikationen, Mini Cooper Befestigungselemente, Drehmoment-Spezifikationen, Motor-Drehmomentwerte, Fahrwerk-Drehmoment, Mini-Wartung, Oldtimer-Spezifikationen",
    "hero_title": "Drehmoment-Spezifikationen",
    "breadcrumb_title": "Drehmoment-Spezifikationen",
    "main_heading": "Drehmoment-Spezifikationen",
    "description_text": "Vollständige Drehmoment-Spezifikationen für Classic Mini Befestigungselemente. Referenztabelle für Motor-, Fahrwerk-, Antriebsstrang- und Karosseriebefestigungen mit Werten in lb/ft und Nm.",
    "support_divider": "Support",
    "og_title": "Classic Mini Drehmoment-Spezifikationstabelle | Classic Mini DIY",
    "og_description": "Vollständige Drehmoment-Spezifikationen für Classic Mini Befestigungselemente. Referenztabelle für Motor-, Fahrwerk-, Antriebsstrang- und Karosseriebefestigungen mit Werten in lb/ft und Nm.",
    "twitter_title": "Classic Mini Drehmoment-Spezifikationstabelle",
    "twitter_description": "Vollständige Drehmoment-Spezifikationen für Classic Mini Befestigungselemente. Referenztabelle für Motor-, Fahrwerk-, Antriebsstrang- und Karosseriebefestigungen.",
    "structured_data": {
      "headline": "Classic Mini Drehmoment-Spezifikationstabelle",
      "description": "Vollständige Drehmoment-Spezifikationen für Classic Mini Befestigungselemente. Referenztabelle für Motor-, Fahrwerk-, Antriebsstrang- und Karosseriebefestigungen mit Werten in lb/ft und Nm.",
      "dataset_name": "Classic Mini Drehmoment-Spezifikationen",
      "dataset_description": "Umfassender Datensatz von Drehmoment-Spezifikationen für Classic Mini Befestigungselemente",
      "variable_measured": "Befestigungsname, Drehmoment in lb/ft, Drehmoment in Nm, Zusätzliche Hinweise"
    },
    "table_headers": {
      "fastener": "Befestigung",
      "torque_lbft": "Drehmoment (lb/ft)",
      "torque_nm": "Drehmoment (Nm)",
      "notes": "Hinweise"
    },
    "ui": {
      "search_placeholder": "Diese Tabelle durchsuchen",
      "no_notes": "---"
    }
  },
  "pt": {
    "title": "Tabela de Especificações de Torque Classic Mini | Classic Mini DIY",
    "description": "Especificações completas de torque para fixadores Classic Mini. Tabela de referência para fixadores de motor, suspensão, trem de força e carroceria com valores em lb/ft e Nm.",
    "keywords": "especificações torque Classic Mini, fixadores Mini Cooper, especificações torque, valores torque motor, torque suspensão, manutenção Mini, especificações carro clássico",
    "hero_title": "Especificações de Torque",
    "breadcrumb_title": "Especificações de Torque",
    "main_heading": "Especificações de Torque",
    "description_text": "Especificações completas de torque para fixadores Classic Mini. Tabela de referência para fixadores de motor, suspensão, trem de força e carroceria com valores em lb/ft e Nm.",
    "support_divider": "Suporte",
    "og_title": "Tabela de Especificações de Torque Classic Mini | Classic Mini DIY",
    "og_description": "Especificações completas de torque para fixadores Classic Mini. Tabela de referência para fixadores de motor, suspensão, trem de força e carroceria com valores em lb/ft e Nm.",
    "twitter_title": "Tabela de Especificações de Torque Classic Mini",
    "twitter_description": "Especificações completas de torque para fixadores Classic Mini. Tabela de referência para fixadores de motor, suspensão, trem de força e carroceria.",
    "structured_data": {
      "headline": "Tabela de Especificações de Torque Classic Mini",
      "description": "Especificações completas de torque para fixadores Classic Mini. Tabela de referência para fixadores de motor, suspensão, trem de força e carroceria com valores em lb/ft e Nm.",
      "dataset_name": "Especificações de Torque Classic Mini",
      "dataset_description": "Conjunto de dados abrangente de especificações de torque para fixadores Classic Mini",
      "variable_measured": "Nome do Fixador, Torque em lb/ft, Torque em Nm, Notas Adicionais"
    },
    "table_headers": {
      "fastener": "Fixador",
      "torque_lbft": "Torque (lb/ft)",
      "torque_nm": "Torque (Nm)",
      "notes": "Notas"
    },
    "ui": {
      "search_placeholder": "Pesquisar nesta tabela",
      "no_notes": "---"
    }
  },
  "ru": {
    "title": "Таблица Спецификаций Крутящего Момента Classic Mini | Classic Mini DIY",
    "description": "Полные спецификации крутящего момента для крепежных элементов Classic Mini. Справочная таблица для крепежных элементов двигателя, подвески, трансмиссии и кузова со значениями в lb/ft и Nm.",
    "keywords": "спецификации крутящего момента Classic Mini, крепежные элементы Mini Cooper, спецификации крутящего момента, значения крутящего момента двигателя, крутящий момент подвески, обслуживание Mini, спецификации классического автомобиля",
    "hero_title": "Спецификации Крутящего Момента",
    "breadcrumb_title": "Спецификации Крутящего Момента",
    "main_heading": "Спецификации Крутящего Момента",
    "description_text": "Полные спецификации крутящего момента для крепежных элементов Classic Mini. Справочная таблица для крепежных элементов двигателя, подвески, трансмиссии и кузова со значениями в lb/ft и Nm.",
    "support_divider": "Поддержка",
    "og_title": "Таблица Спецификаций Крутящего Момента Classic Mini | Classic Mini DIY",
    "og_description": "Полные спецификации крутящего момента для крепежных элементов Classic Mini. Справочная таблица для крепежных элементов двигателя, подвески, трансмиссии и кузова со значениями в lb/ft и Nm.",
    "twitter_title": "Таблица Спецификаций Крутящего Момента Classic Mini",
    "twitter_description": "Полные спецификации крутящего момента для крепежных элементов Classic Mini. Справочная таблица для крепежных элементов двигателя, подвески, трансмиссии и кузова.",
    "structured_data": {
      "headline": "Таблица Спецификаций Крутящего Момента Classic Mini",
      "description": "Полные спецификации крутящего момента для крепежных элементов Classic Mini. Справочная таблица для крепежных элементов двигателя, подвески, трансмиссии и кузова со значениями в lb/ft и Nm.",
      "dataset_name": "Спецификации Крутящего Момента Classic Mini",
      "dataset_description": "Комплексный набор данных спецификаций крутящего момента для крепежных элементов Classic Mini",
      "variable_measured": "Название Крепежного Элемента, Крутящий Момент в lb/ft, Крутящий Момент в Nm, Дополнительные Примечания"
    },
    "table_headers": {
      "fastener": "Крепежный Элемент",
      "torque_lbft": "Крутящий Момент (lb/ft)",
      "torque_nm": "Крутящий Момент (Nm)",
      "notes": "Примечания"
    },
    "ui": {
      "search_placeholder": "Поиск в этой таблице",
      "no_notes": "---"
    }
  },
  "ja": {
    "title": "クラシック・ミニ トルク仕様表 | Classic Mini DIY",
    "description": "クラシック・ミニ締結具の完全なトルク仕様。エンジン、サスペンション、ドライブトレイン、ボディ締結具のlb/ftおよびNm値を含む参照表。",
    "keywords": "クラシック・ミニ トルク仕様、ミニクーパー 締結具、トルク仕様、エンジントルク値、サスペンショントルク、ミニメンテナンス、クラシックカー仕様",
    "hero_title": "トルク仕様",
    "breadcrumb_title": "トルク仕様",
    "main_heading": "トルク仕様",
    "description_text": "クラシック・ミニ締結具の完全なトルク仕様。エンジン、サスペンション、ドライブトレイン、ボディ締結具のlb/ftおよびNm値を含む参照表。",
    "support_divider": "サポート",
    "og_title": "クラシック・ミニ トルク仕様表 | Classic Mini DIY",
    "og_description": "クラシック・ミニ締結具の完全なトルク仕様。エンジン、サスペンション、ドライブトレイン、ボディ締結具のlb/ftおよびNm値を含む参照表。",
    "twitter_title": "クラシック・ミニ トルク仕様表",
    "twitter_description": "クラシック・ミニ締結具の完全なトルク仕様。エンジン、サスペンション、ドライブトレイン、ボディ締結具の参照表。",
    "structured_data": {
      "headline": "クラシック・ミニ トルク仕様表",
      "description": "クラシック・ミニ締結具の完全なトルク仕様。エンジン、サスペンション、ドライブトレイン、ボディ締結具のlb/ftおよびNm値を含む参照表。",
      "dataset_name": "クラシック・ミニ トルク仕様",
      "dataset_description": "クラシック・ミニ締結具のトルク仕様の包括的なデータセット",
      "variable_measured": "締結具名, lb/ftでのトルク, Nmでのトルク, 追加注記"
    },
    "table_headers": {
      "fastener": "締結具",
      "torque_lbft": "トルク (lb/ft)",
      "torque_nm": "トルク (Nm)",
      "notes": "注記"
    },
    "ui": {
      "search_placeholder": "この表を検索",
      "no_notes": "---"
    }
  },
  "zh": {
    "title": "经典迷你扭矩规格表 | Classic Mini DIY",
    "description": "经典迷你紧固件的完整扭矩规格。发动机、悬挂、传动系统和车身紧固件的参考表，包含lb/ft和Nm值。",
    "keywords": "经典迷你扭矩规格，迷你库珀紧固件，扭矩规格，发动机扭矩值，悬挂扭矩，迷你维护，经典汽车规格",
    "hero_title": "扭矩规格",
    "breadcrumb_title": "扭矩规格",
    "main_heading": "扭矩规格",
    "description_text": "经典迷你紧固件的完整扭矩规格。发动机、悬挂、传动系统和车身紧固件的参考表，包含lb/ft和Nm值。",
    "support_divider": "支持",
    "og_title": "经典迷你扭矩规格表 | Classic Mini DIY",
    "og_description": "经典迷你紧固件的完整扭矩规格。发动机、悬挂、传动系统和车身紧固件的参考表，包含lb/ft和Nm值。",
    "twitter_title": "经典迷你扭矩规格表",
    "twitter_description": "经典迷你紧固件的完整扭矩规格。发动机、悬挂、传动系统和车身紧固件的参考表。",
    "structured_data": {
      "headline": "经典迷你扭矩规格表",
      "description": "经典迷你紧固件的完整扭矩规格。发动机、悬挂、传动系统和车身紧固件的参考表，包含lb/ft和Nm值。",
      "dataset_name": "经典迷你扭矩规格",
      "dataset_description": "经典迷你紧固件扭矩规格的综合数据集",
      "variable_measured": "紧固件名称, lb/ft扭矩, Nm扭矩, 附加说明"
    },
    "table_headers": {
      "fastener": "紧固件",
      "torque_lbft": "扭矩 (lb/ft)",
      "torque_nm": "扭矩 (Nm)",
      "notes": "说明"
    },
    "ui": {
      "search_placeholder": "搜索此表",
      "no_notes": "---"
    }
  },
  "ko": {
    "title": "클래식 미니 토크 사양표 | Classic Mini DIY",
    "description": "클래식 미니 체결구의 완전한 토크 사양. 엔진, 서스펜션, 드라이브트레인 및 차체 체결구의 lb/ft 및 Nm 값을 포함한 참조표.",
    "keywords": "클래식 미니 토크 사양, 미니 쿠퍼 체결구, 토크 사양, 엔진 토크 값, 서스펜션 토크, 미니 유지보수, 클래식 자동차 사양",
    "hero_title": "토크 사양",
    "breadcrumb_title": "토크 사양",
    "main_heading": "토크 사양",
    "description_text": "클래식 미니 체결구의 완전한 토크 사양. 엔진, 서스펜션, 드라이브트레인 및 차체 체결구의 lb/ft 및 Nm 값을 포함한 참조표.",
    "support_divider": "지원",
    "og_title": "클래식 미니 토크 사양표 | Classic Mini DIY",
    "og_description": "클래식 미니 체결구의 완전한 토크 사양. 엔진, 서스펜션, 드라이브트레인 및 차체 체결구의 lb/ft 및 Nm 값을 포함한 참조표.",
    "twitter_title": "클래식 미니 토크 사양표",
    "twitter_description": "클래식 미니 체결구의 완전한 토크 사양. 엔진, 서스펜션, 드라이브트레인 및 차체 체결구의 참조표.",
    "structured_data": {
      "headline": "클래식 미니 토크 사양표",
      "description": "클래식 미니 체결구의 완전한 토크 사양. 엔진, 서스펜션, 드라이브트레인 및 차체 체결구의 lb/ft 및 Nm 값을 포함한 참조표.",
      "dataset_name": "클래식 미니 토크 사양",
      "dataset_description": "클래식 미니 체결구 토크 사양의 포괄적인 데이터셋",
      "variable_measured": "체결구 이름, lb/ft 토크, Nm 토크, 추가 참고사항"
    },
    "table_headers": {
      "fastener": "체결구",
      "torque_lbft": "토크 (lb/ft)",
      "torque_nm": "토크 (Nm)",
      "notes": "참고사항"
    },
    "ui": {
      "search_placeholder": "이 표 검색",
      "no_notes": "---"
    }
  }
}
</i18n>
