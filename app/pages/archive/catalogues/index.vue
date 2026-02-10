<script setup lang="ts">
  import { HERO_TYPES } from '../../../../data/models/generic';
  import { ARCHIVE_TYPES, determineArchiveType, submitArchiveFile } from '../../../../data/models/helper-utils';

  const { path } = useRoute();
  const { capture } = usePostHog();
  const archiveType = determineArchiveType(path);
  const { data: catalogues, status } = await useAsyncData(() => queryCollection('catalogues').all());

  catalogues?.value?.sort((a, b) => {
    const k1 = a.image === null ? 0 : 1;
    const k2 = b.image === null ? 0 : 2;
    return k2 - k1;
  });

  const crumbs = ref([
    {
      title: $t('breadcrumb.home'),
      disabled: false,
      href: '/',
    },
    {
      title: $t('breadcrumb.archive'),
      disabled: false,
      href: '/archive',
    },
    {
      title: $t('breadcrumb.catalogues'),
      disabled: true,
    },
  ]);

  useHead({
    title: $t('title'),
    meta: [
      {
        key: 'description',
        name: 'description',
        content: $t('description'),
      },
      {
        name: 'keywords',
        content: $t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/archive/catalogues',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // CollectionPage structured data for catalogues archive
  const cataloguesJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classic Mini Parts Catalogues Archive',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/catalogues',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Classic Mini Parts Catalogues',
      description: 'Collection of historical parts catalogues and documentation for Classic Mini vehicles',
    },
    provider: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      url: 'https://classicminidiy.com',
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(cataloguesJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'classicminidiy.com/archive/catalogues',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/archive/catalogues.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/archive/catalogues.png',
  });
</script>
<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :page="$t('breadcrumb_title')"></breadcrumb>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-8">
            <h1 class="text-2xl font-bold mb-4">{{ $t('main_heading') }}</h1>
            <p class="mb-6">{{ $t('description_text') }}</p>
            <div class="flex flex-wrap gap-3 mb-6">
              <UButton color="primary" @click="submitArchiveFile(ARCHIVE_TYPES.CATALOGUES)">
                <i class="fad fa-paper-plane mr-2"></i>
                {{ $t('actions.add_to_archive') }}
              </UButton>
              <UButton
                color="secondary"
                to="https://buy.stripe.com/3cs8yWe1P1ER3Oo5kl"
                target="_blank"
                @click="capture('support_cta_clicked', { type: 'server_cost', location: path })"
              >
                <i class="fad fa-hand-holding-circle-dollar mr-2"></i>
                {{ $t('actions.cover_server_costs') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <div class="col-span-12">
        <ArchiveLandingIterator
          :archiveType="archiveType"
          :content="catalogues"
          :loading="status"
        ></ArchiveLandingIterator>
      </div>

      <!-- Support section -->
      <div class="col-span-12 mt-8 mb-10">
        <USeparator :label="$t('support_divider')" />
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Archive - Catalogues",
    "description": "Curated collection of Classic Mini vendor catalogues",
    "keywords": "Classic Mini parts catalogues, Mini Cooper vendor catalogues, parts list, historical catalogues, Mini parts documentation, vendor documentation",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Catalogues",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archive",
      "catalogues": "Catalogues"
    },
    "main_heading": "Vendor Catalogues",
    "description_text": "Free copies of the unabridged vendor catalogues. This is an effort to archive and compile all the various historical catalogues and documents made for the classic mini. If you have any missing catalogues, please consider contributing!",
    "actions": {
      "add_to_archive": "Add to Archive",
      "cover_server_costs": "Cover Server Costs"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Archive - Catalogues",
      "og_description": "Curated collection of Classic Mini vendor catalogues",
      "twitter_title": "Classic Mini Archive - Catalogues",
      "twitter_description": "Curated collection of Classic Mini vendor catalogues"
    }
  },
  "de": {
    "title": "Classic Mini Archiv - Kataloge",
    "description": "Kuratierte Sammlung von Classic Mini Händlerkatalogen",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Kataloge",
    "breadcrumb": {
      "home": "Startseite",
      "archive": "Archiv",
      "catalogues": "Kataloge"
    },
    "main_heading": "Händlerkataloge",
    "description_text": "Kostenlose Kopien der ungekürzten Händlerkataloge. Dies ist ein Versuch, alle verschiedenen historischen Kataloge und Dokumente für den Classic Mini zu archivieren und zu sammeln. Wenn Sie fehlende Kataloge haben, erwägen Sie bitte einen Beitrag!",
    "actions": {
      "add_to_archive": "Zum Archiv hinzufügen",
      "cover_server_costs": "Serverkosten decken"
    },
    "support_divider": "Unterstützung",
    "seo": {
      "og_title": "Classic Mini Archiv - Kataloge",
      "og_description": "Kuratierte Sammlung von Classic Mini Händlerkatalogen",
      "twitter_title": "Classic Mini Archiv - Kataloge",
      "twitter_description": "Kuratierte Sammlung von Classic Mini Händlerkatalogen"
    }
  },
  "es": {
    "title": "Archivo Classic Mini - Catálogos",
    "description": "Colección curada de catálogos de proveedores Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Catálogos",
    "breadcrumb": {
      "home": "Inicio",
      "archive": "Archivo",
      "catalogues": "Catálogos"
    },
    "main_heading": "Catálogos de Proveedores",
    "description_text": "Copias gratuitas de los catálogos completos de proveedores. Este es un esfuerzo para archivar y compilar todos los diversos catálogos y documentos históricos hechos para el Classic Mini. Si tienes catálogos faltantes, ¡considera contribuir!",
    "actions": {
      "add_to_archive": "Agregar al Archivo",
      "cover_server_costs": "Cubrir Costos del Servidor"
    },
    "support_divider": "Soporte",
    "seo": {
      "og_title": "Archivo Classic Mini - Catálogos",
      "og_description": "Colección curada de catálogos de proveedores Classic Mini",
      "twitter_title": "Archivo Classic Mini - Catálogos",
      "twitter_description": "Colección curada de catálogos de proveedores Classic Mini"
    }
  },
  "fr": {
    "title": "Archives Classic Mini - Catalogues",
    "description": "Collection organisée de catalogues de fournisseurs Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Catalogues",
    "breadcrumb": {
      "home": "Accueil",
      "archive": "Archive",
      "catalogues": "Catalogues"
    },
    "main_heading": "Catalogues de Fournisseurs",
    "description_text": "Copies gratuites des catalogues intégraux de fournisseurs. Ceci est un effort pour archiver et compiler tous les divers catalogues et documents historiques créés pour la Classic Mini. Si vous avez des catalogues manquants, veuillez considérer contribuer !",
    "actions": {
      "add_to_archive": "Ajouter aux Archives",
      "cover_server_costs": "Couvrir les Coûts du Serveur"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Archives Classic Mini - Catalogues",
      "og_description": "Collection organisée de catalogues de fournisseurs Classic Mini",
      "twitter_title": "Archives Classic Mini - Catalogues",
      "twitter_description": "Collection organisée de catalogues de fournisseurs Classic Mini"
    }
  },
  "it": {
    "title": "Archivio Classic Mini - Cataloghi",
    "description": "Collezione curata di cataloghi fornitori Classic Mini",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Cataloghi",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archivio",
      "catalogues": "Cataloghi"
    },
    "main_heading": "Cataloghi Fornitori",
    "description_text": "Copie gratuite dei cataloghi integrali dei fornitori. Questo è uno sforzo per archiviare e compilare tutti i vari cataloghi e documenti storici creati per la Classic Mini. Se hai cataloghi mancanti, considera di contribuire!",
    "actions": {
      "add_to_archive": "Aggiungi all'Archivio",
      "cover_server_costs": "Coprire i Costi del Server"
    },
    "support_divider": "Supporto",
    "seo": {
      "og_title": "Archivio Classic Mini - Cataloghi",
      "og_description": "Collezione curata di cataloghi fornitori Classic Mini",
      "twitter_title": "Archivio Classic Mini - Cataloghi",
      "twitter_description": "Collezione curata di cataloghi fornitori Classic Mini"
    }
  },
  "pt": {
    "title": "Arquivo Classic Mini - Catálogos",
    "description": "Coleção curada de catálogos de fornecedores Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Catálogos",
    "breadcrumb": {
      "home": "Início",
      "archive": "Arquivo",
      "catalogues": "Catálogos"
    },
    "main_heading": "Catálogos de Fornecedores",
    "description_text": "Cópias gratuitas dos catálogos completos de fornecedores. Este é um esforço para arquivar e compilar todos os vários catálogos e documentos históricos feitos para o Classic Mini. Se você tem catálogos em falta, considere contribuir!",
    "actions": {
      "add_to_archive": "Adicionar ao Arquivo",
      "cover_server_costs": "Cobrir Custos do Servidor"
    },
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Arquivo Classic Mini - Catálogos",
      "og_description": "Coleção curada de catálogos de fornecedores Classic Mini",
      "twitter_title": "Arquivo Classic Mini - Catálogos",
      "twitter_description": "Coleção curada de catálogos de fornecedores Classic Mini"
    }
  },
  "nl": {
    "title": "Classic Mini Archief - Catalogi",
    "description": "Gecureerde collectie van Classic Mini leverancierscatalogi",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Catalogi",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archief",
      "catalogues": "Catalogi"
    },
    "main_heading": "Leverancierscatalogi",
    "description_text": "Gratis kopieën van de onverkorte leverancierscatalogi. Dit is een poging om alle verschillende historische catalogi en documenten gemaakt voor de Classic Mini te archiveren en compileren. Als je ontbrekende catalogi hebt, overweeg dan om bij te dragen!",
    "actions": {
      "add_to_archive": "Toevoegen aan Archief",
      "cover_server_costs": "Serverkosten Dekken"
    },
    "support_divider": "Ondersteuning",
    "seo": {
      "og_title": "Classic Mini Archief - Catalogi",
      "og_description": "Gecureerde collectie van Classic Mini leverancierscatalogi",
      "twitter_title": "Classic Mini Archief - Catalogi",
      "twitter_description": "Gecureerde collectie van Classic Mini leverancierscatalogi"
    }
  },
  "sv": {
    "title": "Classic Mini Arkiv - Kataloger",
    "description": "Kurerad samling av Classic Mini leverantörskataloger",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Kataloger",
    "breadcrumb": {
      "home": "Hem",
      "archive": "Arkiv",
      "catalogues": "Kataloger"
    },
    "main_heading": "Leverantörskataloger",
    "description_text": "Gratis kopior av de oförkortade leverantörskatalogerna. Detta är ett försök att arkivera och sammanställa alla olika historiska kataloger och dokument gjorda för Classic Mini. Om du har saknade kataloger, överväg att bidra!",
    "actions": {
      "add_to_archive": "Lägg till i Arkiv",
      "cover_server_costs": "Täck Serverkostnader"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Kataloger",
      "og_description": "Kurerad samling av Classic Mini leverantörskataloger",
      "twitter_title": "Classic Mini Arkiv - Kataloger",
      "twitter_description": "Kurerad samling av Classic Mini leverantörskataloger"
    }
  },
  "da": {
    "title": "Classic Mini Arkiv - Kataloger",
    "description": "Kurateret samling af Classic Mini leverandørkataloger",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Kataloger",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "catalogues": "Kataloger"
    },
    "main_heading": "Leverandørkataloger",
    "description_text": "Gratis kopier af de uforkortede leverandørkataloger. Dette er et forsøg på at arkivere og kompilere alle de forskellige historiske kataloger og dokumenter lavet til Classic Mini. Hvis du har manglende kataloger, overvej venligst at bidrage!",
    "actions": {
      "add_to_archive": "Tilføj til Arkiv",
      "cover_server_costs": "Dæk Serveromkostninger"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Kataloger",
      "og_description": "Kurateret samling af Classic Mini leverandørkataloger",
      "twitter_title": "Classic Mini Arkiv - Kataloger",
      "twitter_description": "Kurateret samling af Classic Mini leverandørkataloger"
    }
  },
  "no": {
    "title": "Classic Mini Arkiv - Kataloger",
    "description": "Kuratert samling av Classic Mini leverandørkataloger",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Kataloger",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "catalogues": "Kataloger"
    },
    "main_heading": "Leverandørkataloger",
    "description_text": "Gratis kopier av de uforkortede leverandørkatalogene. Dette er et forsøk på å arkivere og kompilere alle de forskjellige historiske katalogene og dokumentene laget for Classic Mini. Hvis du har manglende kataloger, vennligst vurder å bidra!",
    "actions": {
      "add_to_archive": "Legg til i Arkiv",
      "cover_server_costs": "Dekk Serverkostnader"
    },
    "support_divider": "Støtte",
    "seo": {
      "og_title": "Classic Mini Arkiv - Kataloger",
      "og_description": "Kuratert samling av Classic Mini leverandørkataloger",
      "twitter_title": "Classic Mini Arkiv - Kataloger",
      "twitter_description": "Kuratert samling av Classic Mini leverandørkataloger"
    }
  }
}
</i18n>
