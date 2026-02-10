<script setup lang="ts">
  import { HERO_TYPES } from '../../../../data/models/generic';
  import { ARCHIVE_TYPES, determineArchiveType, submitArchiveFile } from '../../../../data/models/helper-utils';

  const { path } = useRoute();
  const { capture } = usePostHog();
  const archiveType = determineArchiveType(path);
  const { data: adverts, status } = await useAsyncData(() => queryCollection('adverts').all());

  adverts?.value?.sort((a, b) => {
    const k1 = a.download === null ? 0 : 1;
    const k2 = b.download === null ? 0 : 2;
    return k2 - k1;
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
        name: 'keywords',
        content: $t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/archive/adverts',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // CollectionPage structured data for adverts archive
  const advertsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classic Mini Advertisements Archive',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/adverts',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Classic Mini Period Advertisements',
      description: 'Collection of historical advertisements and promotional materials for Classic Mini vehicles',
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
        innerHTML: JSON.stringify(advertsJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'classicminidiy.com/archive/adverts',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/archive/adverts.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/archive/adverts.png',
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
            <p class="mb-6">
              {{ $t('description_text') }}
            </p>
            <div class="flex flex-wrap gap-3 mb-6">
              <UButton color="primary" @click="submitArchiveFile(ARCHIVE_TYPES.ADVERT)">
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
          :content="adverts"
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
    "title": "Classic Mini Archive - Advertisements",
    "description": "Curated collection of Classic Mini advertisements",
    "keywords": "Classic Mini advertisements, Mini Cooper ads, vintage Mini advertising, period brochures, promotional materials, historical Mini marketing",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Advertisements",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archive",
      "adverts": "Advertisements"
    },
    "main_heading": "Classic Advertisements",
    "description_text": "Free copies of the unabridged advertisements. This is an effort to archive and compile all the various historical advertisements and documents made for the classic mini. If you have any missing advertisements, please consider contributing!",
    "actions": {
      "add_to_archive": "Add to Archive",
      "cover_server_costs": "Cover Server Costs"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Archive - Advertisements",
      "og_description": "Curated collection of Classic Mini advertisements",
      "twitter_title": "Classic Mini Archive - Advertisements",
      "twitter_description": "Curated collection of Classic Mini advertisements"
    }
  },
  "de": {
    "title": "Classic Mini Archiv - Werbeanzeigen",
    "description": "Kuratierte Sammlung von Classic Mini Werbeanzeigen",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Werbeanzeigen",
    "breadcrumb": {
      "home": "Startseite",
      "archive": "Archiv",
      "adverts": "Werbeanzeigen"
    },
    "main_heading": "Klassische Werbeanzeigen",
    "description_text": "Kostenlose Kopien der ungekürzten Werbeanzeigen. Dies ist ein Versuch, alle verschiedenen historischen Werbeanzeigen und Dokumente für den Classic Mini zu archivieren und zu sammeln. Wenn Sie fehlende Werbeanzeigen haben, erwägen Sie bitte einen Beitrag!",
    "actions": {
      "add_to_archive": "Zum Archiv hinzufügen",
      "cover_server_costs": "Serverkosten decken"
    },
    "support_divider": "Unterstützung",
    "seo": {
      "og_title": "Classic Mini Archiv - Werbeanzeigen",
      "og_description": "Kuratierte Sammlung von Classic Mini Werbeanzeigen",
      "twitter_title": "Classic Mini Archiv - Werbeanzeigen",
      "twitter_description": "Kuratierte Sammlung von Classic Mini Werbeanzeigen"
    }
  },
  "es": {
    "title": "Archivo Classic Mini - Anuncios",
    "description": "Colección curada de anuncios Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Anuncios",
    "breadcrumb": {
      "home": "Inicio",
      "archive": "Archivo",
      "adverts": "Anuncios"
    },
    "main_heading": "Anuncios Clásicos",
    "description_text": "Copias gratuitas de los anuncios completos. Este es un esfuerzo para archivar y compilar todos los diversos anuncios y documentos históricos hechos para el Classic Mini. Si tienes anuncios faltantes, ¡considera contribuir!",
    "actions": {
      "add_to_archive": "Agregar al Archivo",
      "cover_server_costs": "Cubrir Costos del Servidor"
    },
    "support_divider": "Soporte",
    "seo": {
      "og_title": "Archivo Classic Mini - Anuncios",
      "og_description": "Colección curada de anuncios Classic Mini",
      "twitter_title": "Archivo Classic Mini - Anuncios",
      "twitter_description": "Colección curada de anuncios Classic Mini"
    }
  },
  "fr": {
    "title": "Archives Classic Mini - Publicités",
    "description": "Collection organisée de publicités Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Publicités",
    "breadcrumb": {
      "home": "Accueil",
      "archive": "Archive",
      "adverts": "Publicités"
    },
    "main_heading": "Publicités Classiques",
    "description_text": "Copies gratuites des publicités intégrales. Ceci est un effort pour archiver et compiler toutes les diverses publicités et documents historiques créés pour la Classic Mini. Si vous avez des publicités manquantes, veuillez considérer contribuer !",
    "actions": {
      "add_to_archive": "Ajouter aux Archives",
      "cover_server_costs": "Couvrir les Coûts du Serveur"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Archives Classic Mini - Publicités",
      "og_description": "Collection organisée de publicités Classic Mini",
      "twitter_title": "Archives Classic Mini - Publicités",
      "twitter_description": "Collection organisée de publicités Classic Mini"
    }
  },
  "it": {
    "title": "Archivio Classic Mini - Pubblicità",
    "description": "Collezione curata di pubblicità Classic Mini",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Pubblicità",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archivio",
      "adverts": "Pubblicità"
    },
    "main_heading": "Pubblicità Classiche",
    "description_text": "Copie gratuite delle pubblicità integrali. Questo è uno sforzo per archiviare e compilare tutte le varie pubblicità e documenti storici creati per la Classic Mini. Se hai pubblicità mancanti, considera di contribuire!",
    "actions": {
      "add_to_archive": "Aggiungi all'Archivio",
      "cover_server_costs": "Coprire i Costi del Server"
    },
    "support_divider": "Supporto",
    "seo": {
      "og_title": "Archivio Classic Mini - Pubblicità",
      "og_description": "Collezione curata di pubblicità Classic Mini",
      "twitter_title": "Archivio Classic Mini - Pubblicità",
      "twitter_description": "Collezione curata di pubblicità Classic Mini"
    }
  },
  "pt": {
    "title": "Arquivo Classic Mini - Anúncios",
    "description": "Coleção curada de anúncios Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Anúncios",
    "breadcrumb": {
      "home": "Início",
      "archive": "Arquivo",
      "adverts": "Anúncios"
    },
    "main_heading": "Anúncios Clássicos",
    "description_text": "Cópias gratuitas dos anúncios completos. Este é um esforço para arquivar e compilar todos os vários anúncios e documentos históricos feitos para o Classic Mini. Se você tem anúncios em falta, considere contribuir!",
    "actions": {
      "add_to_archive": "Adicionar ao Arquivo",
      "cover_server_costs": "Cobrir Custos do Servidor"
    },
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Arquivo Classic Mini - Anúncios",
      "og_description": "Coleção curada de anúncios Classic Mini",
      "twitter_title": "Arquivo Classic Mini - Anúncios",
      "twitter_description": "Coleção curada de anúncios Classic Mini"
    }
  },
  "nl": {
    "title": "Classic Mini Archief - Advertenties",
    "description": "Gecureerde collectie van Classic Mini advertenties",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Advertenties",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archief",
      "adverts": "Advertenties"
    },
    "main_heading": "Klassieke Advertenties",
    "description_text": "Gratis kopieën van de onverkorte advertenties. Dit is een poging om alle verschillende historische advertenties en documenten gemaakt voor de Classic Mini te archiveren en compileren. Als je ontbrekende advertenties hebt, overweeg dan om bij te dragen!",
    "actions": {
      "add_to_archive": "Toevoegen aan Archief",
      "cover_server_costs": "Serverkosten Dekken"
    },
    "support_divider": "Ondersteuning",
    "seo": {
      "og_title": "Classic Mini Archief - Advertenties",
      "og_description": "Gecureerde collectie van Classic Mini advertenties",
      "twitter_title": "Classic Mini Archief - Advertenties",
      "twitter_description": "Gecureerde collectie van Classic Mini advertenties"
    }
  },
  "sv": {
    "title": "Classic Mini Arkiv - Annonser",
    "description": "Kurerad samling av Classic Mini annonser",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Annonser",
    "breadcrumb": {
      "home": "Hem",
      "archive": "Arkiv",
      "adverts": "Annonser"
    },
    "main_heading": "Klassiska Annonser",
    "description_text": "Gratis kopior av de oförkortade annonserna. Detta är ett försök att arkivera och sammanställa alla olika historiska annonser och dokument gjorda för Classic Mini. Om du har saknade annonser, överväg att bidra!",
    "actions": {
      "add_to_archive": "Lägg till i Arkiv",
      "cover_server_costs": "Täck Serverkostnader"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Annonser",
      "og_description": "Kurerad samling av Classic Mini annonser",
      "twitter_title": "Classic Mini Arkiv - Annonser",
      "twitter_description": "Kurerad samling av Classic Mini annonser"
    }
  },
  "da": {
    "title": "Classic Mini Arkiv - Annoncer",
    "description": "Kurateret samling af Classic Mini annoncer",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Annoncer",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "adverts": "Annoncer"
    },
    "main_heading": "Klassiske Annoncer",
    "description_text": "Gratis kopier af de uforkortede annoncer. Dette er et forsøg på at arkivere og kompilere alle de forskellige historiske annoncer og dokumenter lavet til Classic Mini. Hvis du har manglende annoncer, overvej venligst at bidrage!",
    "actions": {
      "add_to_archive": "Tilføj til Arkiv",
      "cover_server_costs": "Dæk Serveromkostninger"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Annoncer",
      "og_description": "Kurateret samling af Classic Mini annoncer",
      "twitter_title": "Classic Mini Arkiv - Annoncer",
      "twitter_description": "Kurateret samling af Classic Mini annoncer"
    }
  },
  "no": {
    "title": "Classic Mini Arkiv - Annonser",
    "description": "Kuratert samling av Classic Mini annonser",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Annonser",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "adverts": "Annonser"
    },
    "main_heading": "Klassiske Annonser",
    "description_text": "Gratis kopier av de uforkortede annonsene. Dette er et forsøk på å arkivere og kompilere alle de forskjellige historiske annonsene og dokumentene laget for Classic Mini. Hvis du har manglende annonser, vennligst vurder å bidra!",
    "actions": {
      "add_to_archive": "Legg til i Arkiv",
      "cover_server_costs": "Dekk Serverkostnader"
    },
    "support_divider": "Støtte",
    "seo": {
      "og_title": "Classic Mini Arkiv - Annonser",
      "og_description": "Kuratert samling av Classic Mini annonser",
      "twitter_title": "Classic Mini Arkiv - Annonser",
      "twitter_description": "Kuratert samling av Classic Mini annonser"
    }
  }
}
</i18n>
