<script setup lang="ts">
  import { HERO_TYPES } from '../../../../data/models/generic';
  import { ARCHIVE_TYPES, determineArchiveType, submitArchiveFile } from '../../../../data/models/helper-utils';

  const { path } = useRoute();
  const { capture } = usePostHog();
  const archiveType = determineArchiveType(path);
  const { data: manuals, status } = await useAsyncData(() => queryCollection('manuals').all());

  manuals?.value?.sort((a, b) => {
    const k1 = a.download === null ? 0 : 1;
    const k2 = b.download === null ? 0 : 2;
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
      title: $t('breadcrumb.manuals'),
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
        href: 'https://classicminidiy.com/archive/manuals',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // CollectionPage structured data for manuals archive
  const manualsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classic Mini Workshop Manuals Archive',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/manuals',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Classic Mini Workshop Manuals',
      description:
        'Collection of workshop manuals, service guides, and technical documentation for Classic Mini vehicles',
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
        innerHTML: JSON.stringify(manualsJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'classicminidiy.com/archive/manuals',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/archive/manuals.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/archive/manuals.png',
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
              <UButton color="primary" @click="submitArchiveFile(ARCHIVE_TYPES.MANUAL)">
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
          :content="manuals"
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
    "title": "Classic Mini Archive - Manuals",
    "description": "Curated collection of Classic Mini original manuals",
    "keywords": "Classic Mini workshop manuals, Mini Cooper service manual, repair guide, technical documentation, factory manual, Haynes manual, A-series engine manual",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Manuals",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archive",
      "manuals": "Manuals"
    },
    "main_heading": "Original Manuals",
    "description_text": "Free copies of the unabridged manuals. This is an effort to archive and compile all the various historical manuals and documents made for the classic mini. If you have any missing manuals, please consider contributing!",
    "actions": {
      "add_to_archive": "Add to Archive",
      "cover_server_costs": "Cover Server Costs"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Archive - Manuals",
      "og_description": "Curated collection of Classic Mini original manuals",
      "twitter_title": "Classic Mini Archive - Manuals",
      "twitter_description": "Curated collection of Classic Mini original manuals"
    }
  },
  "de": {
    "title": "Classic Mini Archiv - Handbücher",
    "description": "Kuratierte Sammlung von Classic Mini Original-Handbüchern",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Handbücher",
    "breadcrumb": {
      "home": "Startseite",
      "archive": "Archiv",
      "manuals": "Handbücher"
    },
    "main_heading": "Original-Handbücher",
    "description_text": "Kostenlose Kopien der ungekürzten Handbücher. Dies ist ein Versuch, alle verschiedenen historischen Handbücher und Dokumente für den Classic Mini zu archivieren und zu sammeln. Wenn Sie fehlende Handbücher haben, erwägen Sie bitte einen Beitrag!",
    "actions": {
      "add_to_archive": "Zum Archiv hinzufügen",
      "cover_server_costs": "Serverkosten decken"
    },
    "support_divider": "Unterstützung",
    "seo": {
      "og_title": "Classic Mini Archiv - Handbücher",
      "og_description": "Kuratierte Sammlung von Classic Mini Original-Handbüchern",
      "twitter_title": "Classic Mini Archiv - Handbücher",
      "twitter_description": "Kuratierte Sammlung von Classic Mini Original-Handbüchern"
    }
  },
  "es": {
    "title": "Archivo Classic Mini - Manuales",
    "description": "Colección curada de manuales originales del Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Manuales",
    "breadcrumb": {
      "home": "Inicio",
      "archive": "Archivo",
      "manuals": "Manuales"
    },
    "main_heading": "Manuales Originales",
    "description_text": "Copias gratuitas de los manuales completos. Este es un esfuerzo para archivar y compilar todos los diversos manuales y documentos históricos hechos para el Classic Mini. Si tienes manuales faltantes, ¡considera contribuir!",
    "actions": {
      "add_to_archive": "Agregar al Archivo",
      "cover_server_costs": "Cubrir Costos del Servidor"
    },
    "support_divider": "Soporte",
    "seo": {
      "og_title": "Archivo Classic Mini - Manuales",
      "og_description": "Colección curada de manuales originales del Classic Mini",
      "twitter_title": "Archivo Classic Mini - Manuales",
      "twitter_description": "Colección curada de manuales originales del Classic Mini"
    }
  },
  "fr": {
    "title": "Archives Classic Mini - Manuels",
    "description": "Collection organisée de manuels originaux Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Manuels",
    "breadcrumb": {
      "home": "Accueil",
      "archive": "Archive",
      "manuals": "Manuels"
    },
    "main_heading": "Manuels Originaux",
    "description_text": "Copies gratuites des manuels intégraux. Ceci est un effort pour archiver et compiler tous les divers manuels et documents historiques créés pour la Classic Mini. Si vous avez des manuels manquants, veuillez considérer contribuer !",
    "actions": {
      "add_to_archive": "Ajouter aux Archives",
      "cover_server_costs": "Couvrir les Coûts du Serveur"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Archives Classic Mini - Manuels",
      "og_description": "Collection organisée de manuels originaux Classic Mini",
      "twitter_title": "Archives Classic Mini - Manuels",
      "twitter_description": "Collection organisée de manuels originaux Classic Mini"
    }
  },
  "it": {
    "title": "Archivio Classic Mini - Manuali",
    "description": "Collezione curata di manuali originali Classic Mini",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Manuali",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archivio",
      "manuals": "Manuali"
    },
    "main_heading": "Manuali Originali",
    "description_text": "Copie gratuite dei manuali integrali. Questo è uno sforzo per archiviare e compilare tutti i vari manuali e documenti storici creati per la Classic Mini. Se hai manuali mancanti, considera di contribuire!",
    "actions": {
      "add_to_archive": "Aggiungi all'Archivio",
      "cover_server_costs": "Coprire i Costi del Server"
    },
    "support_divider": "Supporto",
    "seo": {
      "og_title": "Archivio Classic Mini - Manuali",
      "og_description": "Collezione curata di manuali originali Classic Mini",
      "twitter_title": "Archivio Classic Mini - Manuali",
      "twitter_description": "Collezione curata di manuali originali Classic Mini"
    }
  },
  "pt": {
    "title": "Arquivo Classic Mini - Manuais",
    "description": "Coleção curada de manuais originais Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Manuais",
    "breadcrumb": {
      "home": "Início",
      "archive": "Arquivo",
      "manuals": "Manuais"
    },
    "main_heading": "Manuais Originais",
    "description_text": "Cópias gratuitas dos manuais completos. Este é um esforço para arquivar e compilar todos os vários manuais e documentos históricos feitos para o Classic Mini. Se você tem manuais em falta, considere contribuir!",
    "actions": {
      "add_to_archive": "Adicionar ao Arquivo",
      "cover_server_costs": "Cobrir Custos do Servidor"
    },
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Arquivo Classic Mini - Manuais",
      "og_description": "Coleção curada de manuais originais Classic Mini",
      "twitter_title": "Arquivo Classic Mini - Manuais",
      "twitter_description": "Coleção curada de manuais originais Classic Mini"
    }
  },
  "nl": {
    "title": "Classic Mini Archief - Handleidingen",
    "description": "Gecureerde collectie van Classic Mini originele handleidingen",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Handleidingen",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archief",
      "manuals": "Handleidingen"
    },
    "main_heading": "Originele Handleidingen",
    "description_text": "Gratis kopieën van de onverkorte handleidingen. Dit is een poging om alle verschillende historische handleidingen en documenten gemaakt voor de Classic Mini te archiveren en compileren. Als je ontbrekende handleidingen hebt, overweeg dan om bij te dragen!",
    "actions": {
      "add_to_archive": "Toevoegen aan Archief",
      "cover_server_costs": "Serverkosten Dekken"
    },
    "support_divider": "Ondersteuning",
    "seo": {
      "og_title": "Classic Mini Archief - Handleidingen",
      "og_description": "Gecureerde collectie van Classic Mini originele handleidingen",
      "twitter_title": "Classic Mini Archief - Handleidingen",
      "twitter_description": "Gecureerde collectie van Classic Mini originele handleidingen"
    }
  },
  "sv": {
    "title": "Classic Mini Arkiv - Manualer",
    "description": "Kurerad samling av Classic Mini original manualer",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Manualer",
    "breadcrumb": {
      "home": "Hem",
      "archive": "Arkiv",
      "manuals": "Manualer"
    },
    "main_heading": "Original Manualer",
    "description_text": "Gratis kopior av de oförkortade manualerna. Detta är ett försök att arkivera och sammanställa alla olika historiska manualer och dokument gjorda för Classic Mini. Om du har saknade manualer, överväg att bidra!",
    "actions": {
      "add_to_archive": "Lägg till i Arkiv",
      "cover_server_costs": "Täck Serverkostnader"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Manualer",
      "og_description": "Kurerad samling av Classic Mini original manualer",
      "twitter_title": "Classic Mini Arkiv - Manualer",
      "twitter_description": "Kurerad samling av Classic Mini original manualer"
    }
  },
  "da": {
    "title": "Classic Mini Arkiv - Manualer",
    "description": "Kurateret samling af Classic Mini originale manualer",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Manualer",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "manuals": "Manualer"
    },
    "main_heading": "Originale Manualer",
    "description_text": "Gratis kopier af de uforkortede manualer. Dette er et forsøg på at arkivere og kompilere alle de forskellige historiske manualer og dokumenter lavet til Classic Mini. Hvis du har manglende manualer, overvej venligst at bidrage!",
    "actions": {
      "add_to_archive": "Tilføj til Arkiv",
      "cover_server_costs": "Dæk Serveromkostninger"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Manualer",
      "og_description": "Kurateret samling af Classic Mini originale manualer",
      "twitter_title": "Classic Mini Arkiv - Manualer",
      "twitter_description": "Kurateret samling af Classic Mini originale manualer"
    }
  },
  "no": {
    "title": "Classic Mini Arkiv - Manualer",
    "description": "Kuratert samling av Classic Mini originale manualer",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Manualer",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "manuals": "Manualer"
    },
    "main_heading": "Originale Manualer",
    "description_text": "Gratis kopier av de uforkortede manualene. Dette er et forsøk på å arkivere og kompilere alle de forskjellige historiske manualene og dokumentene laget for Classic Mini. Hvis du har manglende manualer, vennligst vurder å bidra!",
    "actions": {
      "add_to_archive": "Legg til i Arkiv",
      "cover_server_costs": "Dekk Serverkostnader"
    },
    "support_divider": "Støtte",
    "seo": {
      "og_title": "Classic Mini Arkiv - Manualer",
      "og_description": "Kuratert samling av Classic Mini originale manualer",
      "twitter_title": "Classic Mini Arkiv - Manualer",
      "twitter_description": "Kuratert samling av Classic Mini originale manualer"
    }
  }
}
</i18n>
