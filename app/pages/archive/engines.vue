<script lang="ts" setup>
  import { HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();

  const { data, status } = await useFetch('/api/engines');
  const tableHeaders: any[] = [
    { title: t('table_headers.size'), key: 'color' },
    { title: t('table_headers.original_block'), key: 'group' },
    { title: t('table_headers.engine_size'), key: 'engineSize' },
    { title: t('table_headers.bore_size'), key: 'boreSize' },
    { title: t('table_headers.over_bore'), key: 'overBore' },
    { title: t('table_headers.stroke'), key: 'stroke' },
    { title: t('table_headers.estimated_power'), key: 'power' },
    { title: t('table_headers.estimated_torque'), key: 'torque' },
  ];

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
  });
  useSeoMeta({
    ogTitle: t('seo.og_title'),
    ogDescription: t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/engines',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/engines.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/engines.png',
  });

  // Add structured data for the engine codes reference
  const engineCodesJsonLd = {
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
    url: 'https://classicminidiy.com/archive/engines',
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
        innerHTML: JSON.stringify(engineCodesJsonLd),
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
          <div class="col-span-12 md:col-span-4">
            <NuxtLink :to="'/technical/compression'" :title="t('compression_card.link_title')">
              <UCard class="hover:shadow-xl transition-shadow duration-300">
                <div class="flex items-start">
                  <div class="mr-4">
                    <figure class="w-16 h-16">
                      <picture>
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-calculator-100.webp"
                          type="image/webp"
                        />
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-calculator-100.png"
                          type="image/png"
                        />
                        <nuxt-img
                          src="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-calculator-100.png"
                          :alt="t('compression_card.alt_text')"
                          class="w-full h-full object-contain"
                        />
                      </picture>
                    </figure>
                  </div>
                  <div>
                    <h2 class="text-lg font-semibold">
                      {{ t('compression_card.title') }}
                    </h2>
                    <p>{{ t('compression_card.description') }}</p>
                  </div>
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-span-12">
        <div class="mb-5">
          <i class="fas fa-circle text-primary mr-2"></i> {{ t('legend.standard') }}
          <i class="fas fa-circle text-info mx-2"></i>
          {{ t('legend.standard_overbore') }}
          <i class="fas fa-circle text-error mx-2"></i>
          {{ t('legend.different_stroke') }}
        </div>
        <UCard>
          <template #header>
            <div class="flex items-center">
              <i class="fad fa-engine mr-2"></i>
              <span class="font-semibold text-lg">{{ t('table_title') }}</span>
            </div>
          </template>
          <div class="overflow-x-auto" v-if="data?.engines">
            <table class="w-full text-sm" :class="{ 'opacity-60': status === 'pending' }">
              <thead>
                <tr class="border-b border-default">
                  <th v-for="header in tableHeaders" :key="header.key" class="text-left p-2 font-medium">
                    {{ header.title }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in data.engines"
                  :key="index"
                  class="border-b border-default last:border-0 hover:bg-muted transition-colors"
                >
                  <td class="p-2">
                    <i class="fas fa-circle" :class="item.color"></i>
                  </td>
                  <td class="p-2">{{ item.group }}</td>
                  <td class="p-2">{{ item.engineSize }}</td>
                  <td class="p-2">{{ item.boreSize }}</td>
                  <td class="p-2">{{ item.overBore }}</td>
                  <td class="p-2">{{ item.stroke }}</td>
                  <td class="p-2">{{ item.power }}</td>
                  <td class="p-2">{{ item.torque }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="status === 'pending'" class="flex justify-center items-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span class="ml-2">{{ t('loading_text') }}</span>
            </div>
          </div>
        </UCard>
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator>
          <span class="text-sm text-muted">{{ t('support_divider') }}</span>
        </USeparator>
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2 pb-10">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .ref-icons {
    font-size: 0.5rem;
    vertical-align: middle;
    padding-bottom: 2px;
    &.mobile-v {
      font-size: 0.75rem;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "title": "Archive - Engines | Classic Mini DIY",
    "description": "A comprehensive database of Classic Mini engine specifications and data.",
    "keywords": "Classic Mini engines, Mini Cooper engine specs, engine data, classic car engines, Mini engine specifications",
    "hero_title": "Engines",
    "breadcrumb_title": "Engines",
    "main_heading": "Engine Specifications",
    "description_text": "Explore our comprehensive database of Classic Mini engine specifications. Find detailed information about bore sizes, stroke lengths, power outputs, and more for various Classic Mini engines.",
    "table_headers": {
      "size": "Size",
      "original_block": "Original Block",
      "engine_size": "Engine Size",
      "bore_size": "Bore Size",
      "over_bore": "Over Bore",
      "stroke": "Stroke",
      "estimated_power": "Est. Power",
      "estimated_torque": "Est. Torque"
    },
    "compression_card": {
      "link_title": "Calculate compression ratio for your Classic Mini engine",
      "alt_text": "Calculator icon",
      "title": "Compression Calculator",
      "description": "Calculate the compression ratio for your Classic Mini engine."
    },
    "legend": {
      "standard": "Standard bore and stroke",
      "standard_overbore": "Standard stroke, overbore",
      "different_stroke": "Different stroke"
    },
    "table_title": "Engine Specifications",
    "loading_text": "Loading engine data...",
    "support_divider": "Support",
    "seo": {
      "og_title": "Archive - Engines | Classic Mini DIY",
      "og_description": "A comprehensive database of Classic Mini engine specifications and data.",
      "twitter_title": "Classic Mini Engine Specifications",
      "twitter_description": "A comprehensive database of Classic Mini engine specifications and data."
    },
    "structured_data": {
      "headline": "Classic Mini Engine Specifications",
      "description": "A comprehensive database of Classic Mini engine specifications and data.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini Engine Specifications",
      "dataset_description": "Comprehensive database of Classic Mini engine specifications and technical data"
    }
  },
  "es": {
    "title": "Archivo - Motores | Classic Mini DIY",
    "description": "Una base de datos completa de especificaciones y datos de motores Classic Mini.",
    "keywords": "motores Classic Mini, especificaciones motor Mini Cooper, datos motor, motores autos clásicos, especificaciones motor Mini",
    "hero_title": "Motores",
    "breadcrumb_title": "Motores",
    "main_heading": "Especificaciones de Motor",
    "description_text": "Explora nuestra base de datos completa de especificaciones de motores Classic Mini. Encuentra información detallada sobre tamaños de cilindro, longitudes de carrera, potencias de salida y más para varios motores Classic Mini.",
    "table_headers": {
      "size": "Tamaño",
      "original_block": "Bloque Original",
      "engine_size": "Tamaño de Motor",
      "bore_size": "Tamaño de Cilindro",
      "over_bore": "Sobre Cilindro",
      "stroke": "Carrera",
      "estimated_power": "Potencia Est.",
      "estimated_torque": "Torque Est."
    },
    "compression_card": {
      "link_title": "Calcular relación de compresión para tu motor Classic Mini",
      "alt_text": "Icono de calculadora",
      "title": "Calculadora de Compresión",
      "description": "Calcula la relación de compresión para tu motor Classic Mini."
    },
    "legend": {
      "standard": "Cilindro y carrera estándar",
      "standard_overbore": "Carrera estándar, sobre cilindro",
      "different_stroke": "Carrera diferente"
    },
    "table_title": "Especificaciones de Motor",
    "loading_text": "Cargando datos de motor...",
    "support_divider": "Soporte",
    "seo": {
      "og_title": "Archivo - Motores | Classic Mini DIY",
      "og_description": "Una base de datos completa de especificaciones y datos de motores Classic Mini.",
      "twitter_title": "Especificaciones de Motor Classic Mini",
      "twitter_description": "Una base de datos completa de especificaciones y datos de motores Classic Mini."
    },
    "structured_data": {
      "headline": "Especificaciones de Motor Classic Mini",
      "description": "Una base de datos completa de especificaciones y datos de motores Classic Mini.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Especificaciones de Motor Classic Mini",
      "dataset_description": "Base de datos completa de especificaciones de motores Classic Mini y datos técnicos"
    }
  },
  "fr": {
    "title": "Archive - Moteurs | Classic Mini DIY",
    "description": "Une base de données complète des spécifications et données de moteurs Classic Mini.",
    "keywords": "moteurs Classic Mini, spécifications moteur Mini Cooper, données moteur, moteurs voitures classiques, spécifications moteur Mini",
    "hero_title": "Moteurs",
    "breadcrumb_title": "Moteurs",
    "main_heading": "Spécifications de Moteur",
    "description_text": "Explorez notre base de données complète des spécifications de moteurs Classic Mini. Trouvez des informations détaillées sur les tailles d'alésage, les longueurs de course, les puissances de sortie et plus pour divers moteurs Classic Mini.",
    "table_headers": {
      "size": "Taille",
      "original_block": "Bloc Original",
      "engine_size": "Taille de Moteur",
      "bore_size": "Taille d'Alésage",
      "over_bore": "Sur-Alésage",
      "stroke": "Course",
      "estimated_power": "Puissance Est.",
      "estimated_torque": "Couple Est."
    },
    "compression_card": {
      "link_title": "Calculer le taux de compression pour votre moteur Classic Mini",
      "alt_text": "Icône de calculatrice",
      "title": "Calculateur de Compression",
      "description": "Calculez le taux de compression pour votre moteur Classic Mini."
    },
    "legend": {
      "standard": "Alésage et course standard",
      "standard_overbore": "Course standard, sur-alésage",
      "different_stroke": "Course différente"
    },
    "table_title": "Spécifications de Moteur",
    "loading_text": "Chargement des données moteur...",
    "support_divider": "Support",
    "seo": {
      "og_title": "Archive - Moteurs | Classic Mini DIY",
      "og_description": "Une base de données complète des spécifications et données de moteurs Classic Mini.",
      "twitter_title": "Spécifications de Moteur Classic Mini",
      "twitter_description": "Une base de données complète des spécifications et données de moteurs Classic Mini."
    },
    "structured_data": {
      "headline": "Spécifications de Moteur Classic Mini",
      "description": "Une base de données complète des spécifications et données de moteurs Classic Mini.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Spécifications de Moteur Classic Mini",
      "dataset_description": "Base de données complète des spécifications de moteurs Classic Mini et données techniques"
    }
  },
  "it": {
    "title": "Archivio - Motori | Classic Mini DIY",
    "description": "Un database completo di specifiche e dati dei motori Classic Mini.",
    "keywords": "motori Classic Mini, specifiche motore Mini Cooper, dati motore, motori auto classiche, specifiche motore Mini",
    "hero_title": "Motori",
    "breadcrumb_title": "Motori",
    "main_heading": "Specifiche Motore",
    "description_text": "Esplora il nostro database completo delle specifiche dei motori Classic Mini. Trova informazioni dettagliate su dimensioni alesaggio, lunghezze corsa, potenze di uscita e altro per vari motori Classic Mini.",
    "table_headers": {
      "size": "Dimensione",
      "original_block": "Blocco Originale",
      "engine_size": "Dimensione Motore",
      "bore_size": "Dimensione Alesaggio",
      "over_bore": "Sovra-Alesaggio",
      "stroke": "Corsa",
      "estimated_power": "Potenza Stim.",
      "estimated_torque": "Coppia Stim."
    },
    "compression_card": {
      "link_title": "Calcola il rapporto di compressione per il tuo motore Classic Mini",
      "alt_text": "Icona calcolatrice",
      "title": "Calcolatore Compressione",
      "description": "Calcola il rapporto di compressione per il tuo motore Classic Mini."
    },
    "legend": {
      "standard": "Alesaggio e corsa standard",
      "standard_overbore": "Corsa standard, sovra-alesaggio",
      "different_stroke": "Corsa diversa"
    },
    "table_title": "Specifiche Motore",
    "loading_text": "Caricamento dati motore...",
    "support_divider": "Supporto",
    "seo": {
      "og_title": "Archivio - Motori | Classic Mini DIY",
      "og_description": "Un database completo di specifiche e dati dei motori Classic Mini.",
      "twitter_title": "Specifiche Motore Classic Mini",
      "twitter_description": "Un database completo di specifiche e dati dei motori Classic Mini."
    },
    "structured_data": {
      "headline": "Specifiche Motore Classic Mini",
      "description": "Un database completo di specifiche e dati dei motori Classic Mini.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Specifiche Motore Classic Mini",
      "dataset_description": "Database completo delle specifiche dei motori Classic Mini e dati tecnici"
    }
  },
  "de": {
    "title": "Archiv - Motoren | Classic Mini DIY",
    "description": "Eine umfassende Datenbank mit Classic Mini Motorspezifikationen und -daten.",
    "keywords": "Classic Mini Motoren, Mini Cooper Motorspezifikationen, Motordaten, Oldtimer Motoren, Mini Motorspezifikationen",
    "hero_title": "Motoren",
    "breadcrumb_title": "Motoren",
    "main_heading": "Motorspezifikationen",
    "description_text": "Erkunden Sie unsere umfassende Datenbank mit Classic Mini Motorspezifikationen. Finden Sie detaillierte Informationen über Bohrungsgrößen, Hublängen, Leistungsabgaben und mehr für verschiedene Classic Mini Motoren.",
    "table_headers": {
      "size": "Größe",
      "original_block": "Original Block",
      "engine_size": "Motorgröße",
      "bore_size": "Bohrungsgröße",
      "over_bore": "Überbohrung",
      "stroke": "Hub",
      "estimated_power": "Geschätzte Leistung",
      "estimated_torque": "Geschätztes Drehmoment"
    },
    "compression_card": {
      "link_title": "Verdichtungsverhältnis für Ihren Classic Mini Motor berechnen",
      "alt_text": "Rechner-Symbol",
      "title": "Verdichtungsrechner",
      "description": "Berechnen Sie das Verdichtungsverhältnis für Ihren Classic Mini Motor."
    },
    "legend": {
      "standard": "Standard Bohrung und Hub",
      "standard_overbore": "Standard Hub, Überbohrung",
      "different_stroke": "Anderer Hub"
    },
    "table_title": "Motorspezifikationen",
    "loading_text": "Motordaten werden geladen...",
    "support_divider": "Support",
    "seo": {
      "og_title": "Archiv - Motoren | Classic Mini DIY",
      "og_description": "Eine umfassende Datenbank mit Classic Mini Motorspezifikationen und -daten.",
      "twitter_title": "Classic Mini Motorspezifikationen",
      "twitter_description": "Eine umfassende Datenbank mit Classic Mini Motorspezifikationen und -daten."
    },
    "structured_data": {
      "headline": "Classic Mini Motorspezifikationen",
      "description": "Eine umfassende Datenbank mit Classic Mini Motorspezifikationen und -daten.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini Motorspezifikationen",
      "dataset_description": "Umfassende Datenbank mit Classic Mini Motorspezifikationen und technischen Daten"
    }
  },
  "pt": {
    "title": "Arquivo - Motores | Classic Mini DIY",
    "description": "Uma base de dados abrangente de especificações e dados de motores Classic Mini.",
    "keywords": "motores Classic Mini, especificações motor Mini Cooper, dados motor, motores carros clássicos, especificações motor Mini",
    "hero_title": "Motores",
    "breadcrumb_title": "Motores",
    "main_heading": "Especificações do Motor",
    "description_text": "Explore nossa base de dados abrangente de especificações de motores Classic Mini. Encontre informações detalhadas sobre tamanhos de cilindro, comprimentos de curso, potências de saída e mais para vários motores Classic Mini.",
    "table_headers": {
      "size": "Tamanho",
      "original_block": "Bloco Original",
      "engine_size": "Tamanho do Motor",
      "bore_size": "Tamanho do Cilindro",
      "over_bore": "Sobre-Cilindro",
      "stroke": "Curso",
      "estimated_power": "Potência Est.",
      "estimated_torque": "Torque Est."
    },
    "compression_card": {
      "link_title": "Calcular taxa de compressão para seu motor Classic Mini",
      "alt_text": "Ícone da calculadora",
      "title": "Calculadora de Compressão",
      "description": "Calcule a taxa de compressão para seu motor Classic Mini."
    },
    "legend": {
      "standard": "Cilindro e curso padrão",
      "standard_overbore": "Curso padrão, sobre-cilindro",
      "different_stroke": "Curso diferente"
    },
    "table_title": "Especificações do Motor",
    "loading_text": "Carregando dados do motor...",
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Arquivo - Motores | Classic Mini DIY",
      "og_description": "Uma base de dados abrangente de especificações e dados de motores Classic Mini.",
      "twitter_title": "Especificações de Motor Classic Mini",
      "twitter_description": "Uma base de dados abrangente de especificações e dados de motores Classic Mini."
    },
    "structured_data": {
      "headline": "Especificações de Motor Classic Mini",
      "description": "Uma base de dados abrangente de especificações e dados de motores Classic Mini.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Especificações de Motor Classic Mini",
      "dataset_description": "Base de dados abrangente de especificações de motores Classic Mini e dados técnicos"
    }
  },
  "ru": {
    "title": "Архив - Двигатели | Classic Mini DIY",
    "description": "Комплексная база данных спецификаций и данных двигателей Classic Mini.",
    "keywords": "двигатели Classic Mini, спецификации двигателя Mini Cooper, данные двигателя, двигатели классических автомобилей, спецификации двигателя Mini",
    "hero_title": "Двигатели",
    "breadcrumb_title": "Двигатели",
    "main_heading": "Спецификации Двигателя",
    "description_text": "Изучите нашу комплексную базу данных спецификаций двигателей Classic Mini. Найдите подробную информацию о размерах цилиндров, длинах хода, выходных мощностях и многом другом для различных двигателей Classic Mini.",
    "table_headers": {
      "size": "Размер",
      "original_block": "Оригинальный Блок",
      "engine_size": "Размер Двигателя",
      "bore_size": "Размер Цилиндра",
      "over_bore": "Расточка",
      "stroke": "Ход",
      "estimated_power": "Расчетная Мощность",
      "estimated_torque": "Расчетный Крутящий Момент"
    },
    "compression_card": {
      "link_title": "Рассчитать степень сжатия для вашего двигателя Classic Mini",
      "alt_text": "Значок калькулятора",
      "title": "Калькулятор Сжатия",
      "description": "Рассчитайте степень сжатия для вашего двигателя Classic Mini."
    },
    "legend": {
      "standard": "Стандартный цилиндр и ход",
      "standard_overbore": "Стандартный ход, расточка",
      "different_stroke": "Другой ход"
    },
    "table_title": "Спецификации Двигателя",
    "loading_text": "Загрузка данных двигателя...",
    "support_divider": "Поддержка",
    "seo": {
      "og_title": "Архив - Двигатели | Classic Mini DIY",
      "og_description": "Комплексная база данных спецификаций и данных двигателей Classic Mini.",
      "twitter_title": "Спецификации Двигателя Classic Mini",
      "twitter_description": "Комплексная база данных спецификаций и данных двигателей Classic Mini."
    },
    "structured_data": {
      "headline": "Спецификации Двигателя Classic Mini",
      "description": "Комплексная база данных спецификаций и данных двигателей Classic Mini.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Спецификации Двигателя Classic Mini",
      "dataset_description": "Комплексная база данных спецификаций двигателей Classic Mini и технических данных"
    }
  },
  "ja": {
    "title": "アーカイブ - エンジン | Classic Mini DIY",
    "description": "Classic Miniエンジンの仕様とデータの包括的なデータベース。",
    "keywords": "Classic Mini エンジン, Mini Cooper エンジン仕様, エンジンデータ, クラシックカーエンジン, Mini エンジン仕様",
    "hero_title": "エンジン",
    "breadcrumb_title": "エンジン",
    "main_heading": "エンジン仕様",
    "description_text": "Classic Miniエンジン仕様の包括的なデータベースを探索してください。様々なClassic Miniエンジンのボアサイズ、ストローク長、出力などの詳細情報を見つけてください。",
    "table_headers": {
      "size": "サイズ",
      "original_block": "オリジナルブロック",
      "engine_size": "エンジンサイズ",
      "bore_size": "ボアサイズ",
      "over_bore": "オーバーボア",
      "stroke": "ストローク",
      "estimated_power": "推定パワー",
      "estimated_torque": "推定トルク"
    },
    "compression_card": {
      "link_title": "Classic Miniエンジンの圧縮比を計算",
      "alt_text": "計算機アイコン",
      "title": "圧縮計算機",
      "description": "Classic Miniエンジンの圧縮比を計算します。"
    },
    "legend": {
      "standard": "標準ボアとストローク",
      "standard_overbore": "標準ストローク、オーバーボア",
      "different_stroke": "異なるストローク"
    },
    "table_title": "エンジン仕様",
    "loading_text": "エンジンデータを読み込み中...",
    "support_divider": "サポート",
    "seo": {
      "og_title": "アーカイブ - エンジン | Classic Mini DIY",
      "og_description": "Classic Miniエンジンの仕様とデータの包括的なデータベース。",
      "twitter_title": "Classic Mini エンジン仕様",
      "twitter_description": "Classic Miniエンジンの仕様とデータの包括的なデータベース。"
    },
    "structured_data": {
      "headline": "Classic Mini エンジン仕様",
      "description": "Classic Miniエンジンの仕様とデータの包括的なデータベース。",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini エンジン仕様",
      "dataset_description": "Classic Miniエンジン仕様と技術データの包括的なデータベース"
    }
  },
  "zh": {
    "title": "存档 - 发动机 | Classic Mini DIY",
    "description": "Classic Mini发动机规格和数据的综合数据库。",
    "keywords": "Classic Mini发动机, Mini Cooper发动机规格, 发动机数据, 经典汽车发动机, Mini发动机规格",
    "hero_title": "发动机",
    "breadcrumb_title": "发动机",
    "main_heading": "发动机规格",
    "description_text": "探索我们的Classic Mini发动机规格综合数据库。查找各种Classic Mini发动机的缸径尺寸、行程长度、功率输出等详细信息。",
    "table_headers": {
      "size": "尺寸",
      "original_block": "原装缸体",
      "engine_size": "发动机尺寸",
      "bore_size": "缸径尺寸",
      "over_bore": "扩缸",
      "stroke": "行程",
      "estimated_power": "估计功率",
      "estimated_torque": "估计扭矩"
    },
    "compression_card": {
      "link_title": "计算您的Classic Mini发动机压缩比",
      "alt_text": "计算器图标",
      "title": "压缩计算器",
      "description": "计算您的Classic Mini发动机的压缩比。"
    },
    "legend": {
      "standard": "标准缸径和行程",
      "standard_overbore": "标准行程，扩缸",
      "different_stroke": "不同行程"
    },
    "table_title": "发动机规格",
    "loading_text": "正在加载发动机数据...",
    "support_divider": "支持",
    "seo": {
      "og_title": "存档 - 发动机 | Classic Mini DIY",
      "og_description": "Classic Mini发动机规格和数据的综合数据库。",
      "twitter_title": "Classic Mini 发动机规格",
      "twitter_description": "Classic Mini发动机规格和数据的综合数据库。"
    },
    "structured_data": {
      "headline": "Classic Mini 发动机规格",
      "description": "Classic Mini发动机规格和数据的综合数据库。",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 发动机规格",
      "dataset_description": "Classic Mini发动机规格和技术数据的综合数据库"
    }
  },
  "ko": {
    "title": "아카이브 - 엔진 | Classic Mini DIY",
    "description": "Classic Mini 엔진 사양 및 데이터의 포괄적인 데이터베이스.",
    "keywords": "Classic Mini 엔진, Mini Cooper 엔진 사양, 엔진 데이터, 클래식 자동차 엔진, Mini 엔진 사양",
    "hero_title": "엔진",
    "breadcrumb_title": "엔진",
    "main_heading": "엔진 사양",
    "description_text": "Classic Mini 엔진 사양의 포괄적인 데이터베이스를 탐색하세요. 다양한 Classic Mini 엔진의 보어 크기, 스트로크 길이, 출력 등에 대한 자세한 정보를 찾아보세요.",
    "table_headers": {
      "size": "크기",
      "original_block": "원본 블록",
      "engine_size": "엔진 크기",
      "bore_size": "보어 크기",
      "over_bore": "오버 보어",
      "stroke": "스트로크",
      "estimated_power": "예상 출력",
      "estimated_torque": "예상 토크"
    },
    "compression_card": {
      "link_title": "Classic Mini 엔진의 압축비 계산",
      "alt_text": "계산기 아이콘",
      "title": "압축 계산기",
      "description": "Classic Mini 엔진의 압축비를 계산합니다."
    },
    "legend": {
      "standard": "표준 보어 및 스트로크",
      "standard_overbore": "표준 스트로크, 오버보어",
      "different_stroke": "다른 스트로크"
    },
    "table_title": "엔진 사양",
    "loading_text": "엔진 데이터 로딩 중...",
    "support_divider": "지원",
    "seo": {
      "og_title": "아카이브 - 엔진 | Classic Mini DIY",
      "og_description": "Classic Mini 엔진 사양 및 데이터의 포괄적인 데이터베이스.",
      "twitter_title": "Classic Mini 엔진 사양",
      "twitter_description": "Classic Mini 엔진 사양 및 데이터의 포괄적인 데이터베이스."
    },
    "structured_data": {
      "headline": "Classic Mini 엔진 사양",
      "description": "Classic Mini 엔진 사양 및 데이터의 포괄적인 데이터베이스.",
      "author_name": "Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 엔진 사양",
      "dataset_description": "Classic Mini 엔진 사양 및 기술 데이터의 포괄적인 데이터베이스"
    }
  }
}
</i18n>
