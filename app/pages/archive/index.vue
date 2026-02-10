<script setup lang="ts">
  import { ArchiveItems, BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';
  import { ARCHIVE_TYPES, submitArchiveFile } from '../../../data/models/helper-utils';
  const { path } = useRoute();
  const { capture } = usePostHog();
  const { t } = useI18n();

  // Function to get translated archive item title
  const getArchiveItemTitle = (title: string) => {
    const titleMap: { [key: string]: string } = {
      'Mini Registry': 'archive_items.mini_registry',
      'Engine Sizes': 'archive_items.engine_sizes',
      'Mini Weights': 'archive_items.mini_weights',
      'Workshop Manuals': 'archive_items.workshop_manuals',
      'Electrical Diagrams': 'archive_items.electrical_diagrams',
      'Wheel Library': 'archive_items.wheel_library',
      'Color Picker': 'archive_items.color_picker',
      Adverts: 'archive_items.adverts',
      'Vendor Catalogues': 'archive_items.vendor_catalogues',
      'Tuning and Modifications': 'archive_items.tuning_modifications',
      Dimensions: 'archive_items.dimensions',
    };
    return $t(titleMap[title] || title);
  };

  // Enhanced SEO metadata
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
        href: 'https://classicminidiy.com/archive',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive.png',
  });

  // Add structured data for the archive collection
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: $t('structured_data.headline'),
    description: $t('structured_data.description'),
    image: 'https://classicminidiy.s3.amazonaws.com/misc/archive-seo.jpg',
    author: {
      '@type': 'Person',
      name: $t('structured_data.author_name'),
    },
    publisher: {
      '@type': 'Organization',
      name: $t('structured_data.publisher_name'),
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/logo.png',
      },
    },
    url: 'https://classicminidiy.com/archive',
    mainEntity: {
      '@type': 'Dataset',
      name: $t('structured_data.dataset_name'),
      description: $t('structured_data.dataset_description'),
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(collectionJsonLd),
      },
    ],
  });
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4 pb-15 pt-6">
    <div class="grid grid-cols-1 gap-4">
      <div class="col-span-1 text-center">
        <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" root></breadcrumb>
        <h1 class="text-2xl font-bold mb-4">{{ $t('main_heading') }}</h1>
      </div>
      <div class="col-span-1 text-center">
        <p class="text-lg py-5">
          {{ $t('description_text') }}
        </p>
        <p class="text-lg pb-5">
          {{ $t('maintenance_description') }}
        </p>
        <UButton class="mr-3 text-lg" color="primary" @click="submitArchiveFile(ARCHIVE_TYPES.GENERIC)">
          <i class="fa-duotone fa-paper-plane mr-2"></i>
          {{ $t('add_to_archive') }}
        </UButton>
        <UButton
          class="mr-3 text-lg"
          color="secondary"
          to="https://buy.stripe.com/3cs8yWe1P1ER3Oo5kl"
          target="_blank"
          external
          @click="capture('support_cta_clicked', { type: 'server_cost', location: path })"
        >
          <i class="fa-duotone fa-hand-holding-circle-dollar mr-2"></i>
          {{ $t('cover_server_costs') }}
        </UButton>
      </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-10">
      <div v-for="archive in ArchiveItems" :key="archive.to" class="col-span-1">
        <template v-if="archive.disabled">
          <UCard class="text-center p-5 h-full opacity-50 cursor-not-allowed">
            <p class="text-xs text-right">{{ $t('coming_soon') }}</p>
            <span class="text-4xl block" v-html="archive.iconHtml"> </span>
            <p class="text-lg mt-2">{{ getArchiveItemTitle(archive.title) }}</p>
          </UCard>
        </template>

        <NuxtLink v-else :to="archive.to" class="block h-full">
          <UCard class="text-center p-5 h-full hover:shadow-xl transition-shadow">
            <span class="text-4xl block" v-html="archive.iconHtml"> </span>
            <p class="text-lg mt-2">{{ getArchiveItemTitle(archive.title) }}</p>
          </UCard>
        </NuxtLink>
      </div>
    </div>
    <div class="grid grid-cols-12 gap-4 mt-6">
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator :label="$t('support_divider')" />
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
    "title": "Classic Mini DIY Archive - Historical Documents and Resources",
    "description": "Browse the Classic Mini DIY archive of historical documents, manuals, brochures, and resources. Preserve and share Classic Mini history with the community.",
    "keywords": "Classic Mini archive, historical documents, manuals, brochures, Classic Mini history, vintage documents",
    "hero_title": "Archive",
    "main_heading": "Classic Mini DIY Archive",
    "description_text": "Welcome to the Classic Mini DIY Archive - a comprehensive collection of historical documents, manuals, brochures, and resources dedicated to preserving Classic Mini history.",
    "maintenance_description": "This archive is maintained by the community and relies on contributions from Classic Mini enthusiasts worldwide. Help us preserve this valuable history for future generations.",
    "add_to_archive": "Add to Archive",
    "cover_server_costs": "Cover Server Costs",
    "coming_soon": "Coming Soon",
    "support_divider": "Support Our Work",
    "seo": {
      "og_title": "Classic Mini DIY Archive - Historical Documents",
      "og_description": "Browse historical Classic Mini documents, manuals, and resources in our comprehensive archive.",
      "twitter_title": "Classic Mini DIY Archive",
      "twitter_description": "Historical Classic Mini documents and resources"
    },
    "structured_data": {
      "headline": "Classic Mini DIY Archive Collection",
      "description": "Comprehensive archive of Classic Mini historical documents and resources",
      "author_name": "Classic Mini DIY Community",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini Historical Archive",
      "dataset_description": "Collection of historical documents, manuals, and resources for Classic Mini enthusiasts"
    },
    "archive_items": {
      "mini_registry": "Mini Registry",
      "engine_sizes": "Engine Sizes",
      "mini_weights": "Mini Weights",
      "workshop_manuals": "Workshop Manuals",
      "electrical_diagrams": "Electrical Diagrams",
      "wheel_library": "Wheel Library",
      "color_picker": "Color Picker",
      "adverts": "Adverts",
      "vendor_catalogues": "Vendor Catalogues",
      "tuning_modifications": "Tuning and Modifications",
      "dimensions": "Dimensions"
    }
  },
  "es": {
    "title": "Archivo Classic Mini DIY - Documentos Históricos y Recursos",
    "description": "Explora el archivo Classic Mini DIY de documentos históricos, manuales, folletos y recursos. Preserva y comparte la historia del Classic Mini con la comunidad.",
    "keywords": "archivo Classic Mini, documentos históricos, manuales, folletos, historia Classic Mini, documentos vintage",
    "hero_title": "Archivo",
    "main_heading": "Archivo Classic Mini DIY",
    "description_text": "Bienvenido al Archivo Classic Mini DIY - una colección completa de documentos históricos, manuales, folletos y recursos dedicados a preservar la historia del Classic Mini.",
    "maintenance_description": "Este archivo es mantenido por la comunidad y depende de las contribuciones de entusiastas del Classic Mini de todo el mundo. Ayúdanos a preservar esta valiosa historia para las futuras generaciones.",
    "add_to_archive": "Agregar al Archivo",
    "cover_server_costs": "Cubrir Costos del Servidor",
    "coming_soon": "Próximamente",
    "support_divider": "Apoya Nuestro Trabajo",
    "seo": {
      "og_title": "Archivo Classic Mini DIY - Documentos Históricos",
      "og_description": "Explora documentos históricos del Classic Mini, manuales y recursos en nuestro archivo completo.",
      "twitter_title": "Archivo Classic Mini DIY",
      "twitter_description": "Documentos históricos y recursos del Classic Mini"
    },
    "structured_data": {
      "headline": "Colección del Archivo Classic Mini DIY",
      "description": "Archivo completo de documentos históricos y recursos del Classic Mini",
      "author_name": "Comunidad Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Archivo Histórico Classic Mini",
      "dataset_description": "Colección de documentos históricos, manuales y recursos para entusiastas del Classic Mini"
    }
  },
  "fr": {
    "title": "Archive Classic Mini DIY - Documents Historiques et Ressources",
    "description": "Parcourez l'archive Classic Mini DIY de documents historiques, manuels, brochures et ressources. Préservez et partagez l'histoire du Classic Mini avec la communauté.",
    "keywords": "archive Classic Mini, documents historiques, manuels, brochures, histoire Classic Mini, documents vintage",
    "hero_title": "Archive",
    "main_heading": "Archive Classic Mini DIY",
    "description_text": "Bienvenue dans l'Archive Classic Mini DIY - une collection complète de documents historiques, manuels, brochures et ressources dédiés à la préservation de l'histoire du Classic Mini.",
    "maintenance_description": "Cette archive est maintenue par la communauté et dépend des contributions d'enthousiastes du Classic Mini du monde entier. Aidez-nous à préserver cette histoire précieuse pour les générations futures.",
    "add_to_archive": "Ajouter à l'Archive",
    "cover_server_costs": "Couvrir les Coûts du Serveur",
    "coming_soon": "Bientôt Disponible",
    "support_divider": "Soutenez Notre Travail",
    "seo": {
      "og_title": "Archive Classic Mini DIY - Documents Historiques",
      "og_description": "Parcourez les documents historiques du Classic Mini, manuels et ressources dans notre archive complète.",
      "twitter_title": "Archive Classic Mini DIY",
      "twitter_description": "Documents historiques et ressources du Classic Mini"
    },
    "structured_data": {
      "headline": "Collection de l'Archive Classic Mini DIY",
      "description": "Archive complète de documents historiques et ressources du Classic Mini",
      "author_name": "Communauté Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Archive Historique Classic Mini",
      "dataset_description": "Collection de documents historiques, manuels et ressources pour les enthousiastes du Classic Mini"
    },
    "archive_items": {
      "mini_registry": "Registre Mini",
      "engine_sizes": "Tailles de Moteur",
      "mini_weights": "Poids du Mini",
      "workshop_manuals": "Manuels d'Atelier",
      "electrical_diagrams": "Schémas Électriques",
      "wheel_library": "Bibliothèque de Roues",
      "color_picker": "Sélecteur de Couleur",
      "adverts": "Publicités",
      "vendor_catalogues": "Catalogues de Fournisseurs",
      "tuning_modifications": "Réglages et Modifications",
      "dimensions": "Dimensions"
    }
  },
  "it": {
    "title": "Archivio Classic Mini DIY - Documenti Storici e Risorse",
    "description": "Esplora l'archivio Classic Mini DIY di documenti storici, manuali, brochure e risorse. Preserva e condividi la storia del Classic Mini con la comunità.",
    "keywords": "archivio Classic Mini, documenti storici, manuali, brochure, storia Classic Mini, documenti vintage",
    "hero_title": "Archivio",
    "main_heading": "Archivio Classic Mini DIY",
    "description_text": "Benvenuto nell'Archivio Classic Mini DIY - una collezione completa di documenti storici, manuali, brochure e risorse dedicate alla preservazione della storia del Classic Mini.",
    "maintenance_description": "Questo archivio è mantenuto dalla comunità e dipende dai contributi di appassionati del Classic Mini di tutto il mondo. Aiutaci a preservare questa preziosa storia per le generazioni future.",
    "add_to_archive": "Aggiungi all'Archivio",
    "cover_server_costs": "Copri i Costi del Server",
    "coming_soon": "Prossimamente",
    "support_divider": "Supporta il Nostro Lavoro",
    "seo": {
      "og_title": "Archivio Classic Mini DIY - Documenti Storici",
      "og_description": "Esplora documenti storici del Classic Mini, manuali e risorse nel nostro archivio completo.",
      "twitter_title": "Archivio Classic Mini DIY",
      "twitter_description": "Documenti storici e risorse del Classic Mini"
    },
    "structured_data": {
      "headline": "Collezione dell'Archivio Classic Mini DIY",
      "description": "Archivio completo di documenti storici e risorse del Classic Mini",
      "author_name": "Comunità Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Archivio Storico Classic Mini",
      "dataset_description": "Collezione di documenti storici, manuali e risorse per appassionati del Classic Mini"
    },
    "archive_items": {
      "mini_registry": "Registro Mini",
      "engine_sizes": "Dimensioni Motore",
      "mini_weights": "Pesi del Mini",
      "workshop_manuals": "Manuali di Officina",
      "electrical_diagrams": "Schemi Elettrici",
      "wheel_library": "Libreria Ruote",
      "color_picker": "Selettore Colore",
      "adverts": "Pubblicità",
      "vendor_catalogues": "Cataloghi Fornitori",
      "tuning_modifications": "Messa a Punto e Modifiche",
      "dimensions": "Dimensioni"
    }
  },
  "de": {
    "title": "Classic Mini DIY Archiv - Historische Dokumente und Ressourcen",
    "description": "Durchsuchen Sie das Classic Mini DIY Archiv historischer Dokumente, Handbücher, Broschüren und Ressourcen. Bewahren und teilen Sie Classic Mini Geschichte mit der Community.",
    "keywords": "Classic Mini Archiv, historische Dokumente, Handbücher, Broschüren, Classic Mini Geschichte, Vintage-Dokumente",
    "hero_title": "Archiv",
    "main_heading": "Classic Mini DIY Archiv",
    "description_text": "Willkommen im Classic Mini DIY Archiv - einer umfassenden Sammlung historischer Dokumente, Handbücher, Broschüren und Ressourcen zur Bewahrung der Classic Mini Geschichte.",
    "maintenance_description": "Dieses Archiv wird von der Community gepflegt und ist auf Beiträge von Classic Mini Enthusiasten weltweit angewiesen. Helfen Sie uns, diese wertvolle Geschichte für zukünftige Generationen zu bewahren.",
    "add_to_archive": "Zum Archiv Hinzufügen",
    "cover_server_costs": "Serverkosten Decken",
    "coming_soon": "Demnächst",
    "support_divider": "Unterstützen Sie Unsere Arbeit",
    "seo": {
      "og_title": "Classic Mini DIY Archiv - Historische Dokumente",
      "og_description": "Durchsuchen Sie historische Classic Mini Dokumente, Handbücher und Ressourcen in unserem umfassenden Archiv.",
      "twitter_title": "Classic Mini DIY Archiv",
      "twitter_description": "Historische Classic Mini Dokumente und Ressourcen"
    },
    "structured_data": {
      "headline": "Classic Mini DIY Archiv-Sammlung",
      "description": "Umfassendes Archiv historischer Classic Mini Dokumente und Ressourcen",
      "author_name": "Classic Mini DIY Community",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini Historisches Archiv",
      "dataset_description": "Sammlung historischer Dokumente, Handbücher und Ressourcen für Classic Mini Enthusiasten"
    },
    "archive_items": {
      "mini_registry": "Mini Register",
      "engine_sizes": "Motorgrößen",
      "mini_weights": "Mini Gewichte",
      "workshop_manuals": "Werkstatthandbücher",
      "electrical_diagrams": "Schaltpläne",
      "wheel_library": "Felgen-Bibliothek",
      "color_picker": "Farbwähler",
      "adverts": "Werbeanzeigen",
      "vendor_catalogues": "Lieferantenkataloge",
      "tuning_modifications": "Tuning und Modifikationen",
      "dimensions": "Abmessungen"
    }
  },
  "pt": {
    "title": "Arquivo Classic Mini DIY - Documentos Históricos e Recursos",
    "description": "Navegue pelo arquivo Classic Mini DIY de documentos históricos, manuais, folhetos e recursos. Preserve e compartilhe a história do Classic Mini com a comunidade.",
    "keywords": "arquivo Classic Mini, documentos históricos, manuais, folhetos, história Classic Mini, documentos vintage",
    "hero_title": "Arquivo",
    "main_heading": "Arquivo Classic Mini DIY",
    "description_text": "Bem-vindo ao Arquivo Classic Mini DIY - uma coleção abrangente de documentos históricos, manuais, folhetos e recursos dedicados à preservação da história do Classic Mini.",
    "maintenance_description": "Este arquivo é mantido pela comunidade e depende de contribuições de entusiastas do Classic Mini do mundo todo. Ajude-nos a preservar esta valiosa história para as gerações futuras.",
    "add_to_archive": "Adicionar ao Arquivo",
    "cover_server_costs": "Cobrir Custos do Servidor",
    "coming_soon": "Em Breve",
    "support_divider": "Apoie Nosso Trabalho",
    "seo": {
      "og_title": "Arquivo Classic Mini DIY - Documentos Históricos",
      "og_description": "Navegue por documentos históricos do Classic Mini, manuais e recursos em nosso arquivo abrangente.",
      "twitter_title": "Arquivo Classic Mini DIY",
      "twitter_description": "Documentos históricos e recursos do Classic Mini"
    },
    "structured_data": {
      "headline": "Coleção do Arquivo Classic Mini DIY",
      "description": "Arquivo abrangente de documentos históricos e recursos do Classic Mini",
      "author_name": "Comunidade Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Arquivo Histórico Classic Mini",
      "dataset_description": "Coleção de documentos históricos, manuais e recursos para entusiastas do Classic Mini"
    },
    "archive_items": {
      "mini_registry": "Registro Mini",
      "engine_sizes": "Tamanhos de Motor",
      "mini_weights": "Pesos do Mini",
      "workshop_manuals": "Manuais de Oficina",
      "electrical_diagrams": "Diagramas Elétricos",
      "wheel_library": "Biblioteca de Rodas",
      "color_picker": "Seletor de Cor",
      "adverts": "Anúncios",
      "vendor_catalogues": "Catálogos de Fornecedores",
      "tuning_modifications": "Ajustes e Modificações",
      "dimensions": "Dimensões"
    }
  },
  "ru": {
    "title": "Архив Classic Mini DIY - Исторические Документы и Ресурсы",
    "description": "Просматривайте архив Classic Mini DIY исторических документов, руководств, брошюр и ресурсов. Сохраняйте и делитесь историей Classic Mini с сообществом.",
    "keywords": "архив Classic Mini, исторические документы, руководства, брошюры, история Classic Mini, винтажные документы",
    "hero_title": "Архив",
    "main_heading": "Архив Classic Mini DIY",
    "description_text": "Добро пожаловать в Архив Classic Mini DIY - всеобъемлющую коллекцию исторических документов, руководств, брошюр и ресурсов, посвященных сохранению истории Classic Mini.",
    "maintenance_description": "Этот архив поддерживается сообществом и зависит от вклада энтузиастов Classic Mini со всего мира. Помогите нам сохранить эту ценную историю для будущих поколений.",
    "add_to_archive": "Добавить в Архив",
    "cover_server_costs": "Покрыть Расходы на Сервер",
    "coming_soon": "Скоро",
    "support_divider": "Поддержите Нашу Работу",
    "seo": {
      "og_title": "Архив Classic Mini DIY - Исторические Документы",
      "og_description": "Просматривайте исторические документы Classic Mini, руководства и ресурсы в нашем всеобъемлющем архиве.",
      "twitter_title": "Архив Classic Mini DIY",
      "twitter_description": "Исторические документы и ресурсы Classic Mini"
    },
    "structured_data": {
      "headline": "Коллекция Архива Classic Mini DIY",
      "description": "Всеобъемлющий архив исторических документов и ресурсов Classic Mini",
      "author_name": "Сообщество Classic Mini DIY",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Исторический Архив Classic Mini",
      "dataset_description": "Коллекция исторических документов, руководств и ресурсов для энтузиастов Classic Mini"
    },
    "archive_items": {
      "mini_registry": "Реестр Mini",
      "engine_sizes": "Размеры Двигателя",
      "mini_weights": "Вес Mini",
      "workshop_manuals": "Руководства по Ремонту",
      "electrical_diagrams": "Электрические Схемы",
      "wheel_library": "Библиотека Колес",
      "color_picker": "Выбор Цвета",
      "adverts": "Реклама",
      "vendor_catalogues": "Каталоги Поставщиков",
      "tuning_modifications": "Тюнинг и Модификации",
      "dimensions": "Размеры"
    }
  },
  "ja": {
    "title": "Classic Mini DIY アーカイブ - 歴史的文書とリソース",
    "description": "Classic Mini DIYの歴史的文書、マニュアル、パンフレット、リソースのアーカイブを閲覧してください。コミュニティとClassic Miniの歴史を保存し共有しましょう。",
    "keywords": "Classic Miniアーカイブ, 歴史的文書, マニュアル, パンフレット, Classic Mini歴史, ヴィンテージ文書",
    "hero_title": "アーカイブ",
    "main_heading": "Classic Mini DIY アーカイブ",
    "description_text": "Classic Mini DIY アーカイブへようこそ - Classic Miniの歴史を保存することに専念した歴史的文書、マニュアル、パンフレット、リソースの包括的なコレクションです。",
    "maintenance_description": "このアーカイブはコミュニティによって維持され、世界中のClassic Mini愛好家からの貢献に依存しています。将来の世代のためにこの貴重な歴史を保存するのにご協力ください。",
    "add_to_archive": "アーカイブに追加",
    "cover_server_costs": "サーバー費用をカバー",
    "coming_soon": "近日公開",
    "support_divider": "私たちの活動をサポート",
    "seo": {
      "og_title": "Classic Mini DIY アーカイブ - 歴史的文書",
      "og_description": "包括的なアーカイブでClassic Miniの歴史的文書、マニュアル、リソースを閲覧してください。",
      "twitter_title": "Classic Mini DIY アーカイブ",
      "twitter_description": "Classic Miniの歴史的文書とリソース"
    },
    "structured_data": {
      "headline": "Classic Mini DIY アーカイブコレクション",
      "description": "Classic Miniの歴史的文書とリソースの包括的なアーカイブ",
      "author_name": "Classic Mini DIY コミュニティ",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 歴史的アーカイブ",
      "dataset_description": "Classic Mini愛好家のための歴史的文書、マニュアル、リソースのコレクション"
    },
    "archive_items": {
      "mini_registry": "Miniレジストリ",
      "engine_sizes": "エンジンサイズ",
      "mini_weights": "Mini重量",
      "workshop_manuals": "ワークショップマニュアル",
      "electrical_diagrams": "電気配線図",
      "wheel_library": "ホイールライブラリ",
      "color_picker": "カラーピッカー",
      "adverts": "広告",
      "vendor_catalogues": "ベンダーカタログ",
      "tuning_modifications": "チューニングと改造",
      "dimensions": "寸法"
    }
  },
  "zh": {
    "title": "Classic Mini DIY 档案 - 历史文档和资源",
    "description": "浏览Classic Mini DIY的历史文档、手册、小册子和资源档案。与社区保存和分享Classic Mini历史。",
    "keywords": "Classic Mini档案, 历史文档, 手册, 小册子, Classic Mini历史, 复古文档",
    "hero_title": "档案",
    "main_heading": "Classic Mini DIY 档案",
    "description_text": "欢迎来到Classic Mini DIY档案 - 一个致力于保存Classic Mini历史的历史文档、手册、小册子和资源的综合收藏。",
    "maintenance_description": "这个档案由社区维护，依赖于来自世界各地Classic Mini爱好者的贡献。帮助我们为后代保存这段宝贵的历史。",
    "add_to_archive": "添加到档案",
    "cover_server_costs": "支付服务器费用",
    "coming_soon": "即将推出",
    "support_divider": "支持我们的工作",
    "seo": {
      "og_title": "Classic Mini DIY 档案 - 历史文档",
      "og_description": "在我们的综合档案中浏览Classic Mini历史文档、手册和资源。",
      "twitter_title": "Classic Mini DIY 档案",
      "twitter_description": "Classic Mini历史文档和资源"
    },
    "structured_data": {
      "headline": "Classic Mini DIY 档案收藏",
      "description": "Classic Mini历史文档和资源的综合档案",
      "author_name": "Classic Mini DIY 社区",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 历史档案",
      "dataset_description": "为Classic Mini爱好者收集的历史文档、手册和资源"
    },
    "archive_items": {
      "mini_registry": "Mini注册表",
      "engine_sizes": "发动机尺寸",
      "mini_weights": "Mini重量",
      "workshop_manuals": "维修手册",
      "electrical_diagrams": "电路图",
      "wheel_library": "轮毂库",
      "color_picker": "颜色选择器",
      "adverts": "广告",
      "vendor_catalogues": "供应商目录",
      "tuning_modifications": "调校和改装",
      "dimensions": "尺寸"
    }
  },
  "ko": {
    "title": "Classic Mini DIY 아카이브 - 역사적 문서와 자료",
    "description": "Classic Mini DIY의 역사적 문서, 매뉴얼, 브로셔, 자료 아카이브를 탐색하세요. 커뮤니티와 함께 Classic Mini 역사를 보존하고 공유하세요.",
    "keywords": "Classic Mini 아카이브, 역사적 문서, 매뉴얼, 브로셔, Classic Mini 역사, 빈티지 문서",
    "hero_title": "아카이브",
    "main_heading": "Classic Mini DIY 아카이브",
    "description_text": "Classic Mini DIY 아카이브에 오신 것을 환영합니다 - Classic Mini 역사 보존에 전념하는 역사적 문서, 매뉴얼, 브로셔, 자료의 포괄적인 컬렉션입니다.",
    "maintenance_description": "이 아카이브는 커뮤니티에 의해 유지되며 전 세계 Classic Mini 애호가들의 기여에 의존합니다. 미래 세대를 위해 이 소중한 역사를 보존하는 데 도움을 주세요.",
    "add_to_archive": "아카이브에 추가",
    "cover_server_costs": "서버 비용 지원",
    "coming_soon": "곧 출시",
    "support_divider": "우리의 작업을 지원하세요",
    "seo": {
      "og_title": "Classic Mini DIY 아카이브 - 역사적 문서",
      "og_description": "포괄적인 아카이브에서 Classic Mini 역사적 문서, 매뉴얼, 자료를 탐색하세요.",
      "twitter_title": "Classic Mini DIY 아카이브",
      "twitter_description": "Classic Mini 역사적 문서와 자료"
    },
    "structured_data": {
      "headline": "Classic Mini DIY 아카이브 컬렉션",
      "description": "Classic Mini 역사적 문서와 자료의 포괄적인 아카이브",
      "author_name": "Classic Mini DIY 커뮤니티",
      "publisher_name": "Classic Mini DIY",
      "dataset_name": "Classic Mini 역사 아카이브",
      "dataset_description": "Classic Mini 애호가를 위한 역사적 문서, 매뉴얼, 자료 컬렉션"
    },
    "archive_items": {
      "mini_registry": "Mini 등록부",
      "engine_sizes": "엔진 크기",
      "mini_weights": "Mini 무게",
      "workshop_manuals": "워크샵 매뉴얼",
      "electrical_diagrams": "전기 배선도",
      "wheel_library": "휠 라이브러리",
      "color_picker": "색상 선택기",
      "adverts": "광고",
      "vendor_catalogues": "공급업체 카탈로그",
      "tuning_modifications": "튜닝 및 개조",
      "dimensions": "치수"
    }
  }
}
</i18n>
