<script setup lang="ts">
  import { HERO_TYPES } from '../../../../data/models/generic';
  import { ARCHIVE_TYPES, determineArchiveType, submitArchiveFile } from '../../../../data/models/helper-utils';

  const { path } = useRoute();
  const { capture } = usePostHog();
  const archiveType = determineArchiveType(path);
  const { data: tuning, status } = await useAsyncData(() => queryCollection('tuning').all());

  tuning?.value?.sort((a, b) => {
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
      title: $t('breadcrumb.tuning'),
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
        href: 'https://classicminidiy.com/archive/tuning',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // CollectionPage structured data for tuning archive
  const tuningJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classic Mini Tuning & Performance Archive',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/tuning',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Classic Mini Tuning Guides',
      description: 'Collection of performance tuning guides and specifications for Classic Mini vehicles',
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
        innerHTML: JSON.stringify(tuningJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'classicminidiy.com/archive/tuning',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/archive/tuning.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/archive/tuning.png',
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
              <UButton color="primary" @click="submitArchiveFile(ARCHIVE_TYPES.TUNING)">
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
        <ArchiveLandingIterator :archiveType="archiveType" :content="tuning" :loading="status"></ArchiveLandingIterator>
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
    "title": "Classic Mini Archive - Tuning",
    "description": "Curated collection of Classic Mini tuning guides and resources",
    "keywords": "Classic Mini tuning, Mini Cooper performance, engine tuning, A-series tuning, performance modifications, speed tuning, racing Mini",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archive",
      "tuning": "Tuning"
    },
    "main_heading": "Tuning Guides & Resources",
    "description_text": "Free copies of tuning guides and performance resources. This is an effort to archive and compile all the various historical tuning documents and guides made for the classic mini. If you have any missing tuning resources, please consider contributing!",
    "actions": {
      "add_to_archive": "Add to Archive",
      "cover_server_costs": "Cover Server Costs"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Archive - Tuning",
      "og_description": "Curated collection of Classic Mini tuning guides and resources",
      "twitter_title": "Classic Mini Archive - Tuning",
      "twitter_description": "Curated collection of Classic Mini tuning guides and resources"
    }
  },
  "de": {
    "title": "Classic Mini Archiv - Tuning",
    "description": "Kuratierte Sammlung von Classic Mini Tuning-Anleitungen und Ressourcen",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Startseite",
      "archive": "Archiv",
      "tuning": "Tuning"
    },
    "main_heading": "Tuning-Anleitungen & Ressourcen",
    "description_text": "Kostenlose Kopien von Tuning-Anleitungen und Performance-Ressourcen. Dies ist ein Versuch, alle verschiedenen historischen Tuning-Dokumente und Anleitungen für den Classic Mini zu archivieren und zu sammeln. Wenn Sie fehlende Tuning-Ressourcen haben, erwägen Sie bitte einen Beitrag!",
    "actions": {
      "add_to_archive": "Zum Archiv hinzufügen",
      "cover_server_costs": "Serverkosten decken"
    },
    "support_divider": "Unterstützung",
    "seo": {
      "og_title": "Classic Mini Archiv - Tuning",
      "og_description": "Kuratierte Sammlung von Classic Mini Tuning-Anleitungen und Ressourcen",
      "twitter_title": "Classic Mini Archiv - Tuning",
      "twitter_description": "Kuratierte Sammlung von Classic Mini Tuning-Anleitungen und Ressourcen"
    }
  },
  "es": {
    "title": "Archivo Classic Mini - Tuning",
    "description": "Colección curada de guías de tuning y recursos del Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Inicio",
      "archive": "Archivo",
      "tuning": "Tuning"
    },
    "main_heading": "Guías de Tuning y Recursos",
    "description_text": "Copias gratuitas de guías de tuning y recursos de rendimiento. Este es un esfuerzo para archivar y compilar todos los diversos documentos y guías de tuning históricos hechos para el Classic Mini. Si tienes recursos de tuning faltantes, ¡considera contribuir!",
    "actions": {
      "add_to_archive": "Agregar al Archivo",
      "cover_server_costs": "Cubrir Costos del Servidor"
    },
    "support_divider": "Soporte",
    "seo": {
      "og_title": "Archivo Classic Mini - Tuning",
      "og_description": "Colección curada de guías de tuning y recursos del Classic Mini",
      "twitter_title": "Archivo Classic Mini - Tuning",
      "twitter_description": "Colección curada de guías de tuning y recursos del Classic Mini"
    }
  },
  "fr": {
    "title": "Archives Classic Mini - Tuning",
    "description": "Collection organisée de guides de tuning et ressources Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Accueil",
      "archive": "Archive",
      "tuning": "Tuning"
    },
    "main_heading": "Guides de Tuning et Ressources",
    "description_text": "Copies gratuites de guides de tuning et ressources de performance. Ceci est un effort pour archiver et compiler tous les divers documents et guides de tuning historiques créés pour la Classic Mini. Si vous avez des ressources de tuning manquantes, veuillez considérer contribuer !",
    "actions": {
      "add_to_archive": "Ajouter aux Archives",
      "cover_server_costs": "Couvrir les Coûts du Serveur"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Archives Classic Mini - Tuning",
      "og_description": "Collection organisée de guides de tuning et ressources Classic Mini",
      "twitter_title": "Archives Classic Mini - Tuning",
      "twitter_description": "Collection organisée de guides de tuning et ressources Classic Mini"
    }
  },
  "it": {
    "title": "Archivio Classic Mini - Tuning",
    "description": "Collezione curata di guide di tuning e risorse Classic Mini",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archivio",
      "tuning": "Tuning"
    },
    "main_heading": "Guide di Tuning e Risorse",
    "description_text": "Copie gratuite di guide di tuning e risorse di performance. Questo è uno sforzo per archiviare e compilare tutti i vari documenti e guide di tuning storici creati per la Classic Mini. Se hai risorse di tuning mancanti, considera di contribuire!",
    "actions": {
      "add_to_archive": "Aggiungi all'Archivio",
      "cover_server_costs": "Coprire i Costi del Server"
    },
    "support_divider": "Supporto",
    "seo": {
      "og_title": "Archivio Classic Mini - Tuning",
      "og_description": "Collezione curata di guide di tuning e risorse Classic Mini",
      "twitter_title": "Archivio Classic Mini - Tuning",
      "twitter_description": "Collezione curata di guide di tuning e risorse Classic Mini"
    }
  },
  "pt": {
    "title": "Arquivo Classic Mini - Tuning",
    "description": "Coleção curada de guias de tuning e recursos Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Início",
      "archive": "Arquivo",
      "tuning": "Tuning"
    },
    "main_heading": "Guias de Tuning e Recursos",
    "description_text": "Cópias gratuitas de guias de tuning e recursos de performance. Este é um esforço para arquivar e compilar todos os vários documentos e guias de tuning históricos feitos para o Classic Mini. Se você tem recursos de tuning em falta, considere contribuir!",
    "actions": {
      "add_to_archive": "Adicionar ao Arquivo",
      "cover_server_costs": "Cobrir Custos do Servidor"
    },
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Arquivo Classic Mini - Tuning",
      "og_description": "Coleção curada de guias de tuning e recursos Classic Mini",
      "twitter_title": "Arquivo Classic Mini - Tuning",
      "twitter_description": "Coleção curada de guias de tuning e recursos Classic Mini"
    }
  },
  "nl": {
    "title": "Classic Mini Archief - Tuning",
    "description": "Gecureerde collectie van Classic Mini tuning gidsen en bronnen",
    "hero_title": "Classic Mini Archieven",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Home",
      "archive": "Archief",
      "tuning": "Tuning"
    },
    "main_heading": "Tuning Gidsen & Bronnen",
    "description_text": "Gratis kopieën van tuning gidsen en prestatie bronnen. Dit is een poging om alle verschillende historische tuning documenten en gidsen gemaakt voor de Classic Mini te archiveren en compileren. Als je ontbrekende tuning bronnen hebt, overweeg dan om bij te dragen!",
    "actions": {
      "add_to_archive": "Toevoegen aan Archief",
      "cover_server_costs": "Serverkosten Dekken"
    },
    "support_divider": "Ondersteuning",
    "seo": {
      "og_title": "Classic Mini Archief - Tuning",
      "og_description": "Gecureerde collectie van Classic Mini tuning gidsen en bronnen",
      "twitter_title": "Classic Mini Archief - Tuning",
      "twitter_description": "Gecureerde collectie van Classic Mini tuning gidsen en bronnen"
    }
  },
  "sv": {
    "title": "Classic Mini Arkiv - Tuning",
    "description": "Kurerad samling av Classic Mini tuning-guider och resurser",
    "hero_title": "Classic Mini Arkiv",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Hem",
      "archive": "Arkiv",
      "tuning": "Tuning"
    },
    "main_heading": "Tuning-guider & Resurser",
    "description_text": "Gratis kopior av tuning-guider och prestanda resurser. Detta är ett försök att arkivera och sammanställa alla olika historiska tuning-dokument och guider gjorda för Classic Mini. Om du har saknade tuning-resurser, överväg att bidra!",
    "actions": {
      "add_to_archive": "Lägg till i Arkiv",
      "cover_server_costs": "Täck Serverkostnader"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Tuning",
      "og_description": "Kurerad samling av Classic Mini tuning-guider och resurser",
      "twitter_title": "Classic Mini Arkiv - Tuning",
      "twitter_description": "Kurerad samling av Classic Mini tuning-guider och resurser"
    }
  },
  "da": {
    "title": "Classic Mini Arkiv - Tuning",
    "description": "Kurateret samling af Classic Mini tuning-guider og ressourcer",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "tuning": "Tuning"
    },
    "main_heading": "Tuning-guider & Ressourcer",
    "description_text": "Gratis kopier af tuning-guider og performance ressourcer. Dette er et forsøg på at arkivere og kompilere alle de forskellige historiske tuning-dokumenter og guider lavet til Classic Mini. Hvis du har manglende tuning-ressourcer, overvej venligst at bidrage!",
    "actions": {
      "add_to_archive": "Tilføj til Arkiv",
      "cover_server_costs": "Dæk Serveromkostninger"
    },
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Arkiv - Tuning",
      "og_description": "Kurateret samling af Classic Mini tuning-guider og ressourcer",
      "twitter_title": "Classic Mini Arkiv - Tuning",
      "twitter_description": "Kurateret samling af Classic Mini tuning-guider og ressourcer"
    }
  },
  "no": {
    "title": "Classic Mini Arkiv - Tuning",
    "description": "Kuratert samling av Classic Mini tuning-guider og ressurser",
    "hero_title": "Classic Mini Arkiver",
    "breadcrumb_title": "Tuning",
    "breadcrumb": {
      "home": "Hjem",
      "archive": "Arkiv",
      "tuning": "Tuning"
    },
    "main_heading": "Tuning-guider & Ressurser",
    "description_text": "Gratis kopier av tuning-guider og ytelse ressurser. Dette er et forsøk på å arkivere og kompilere alle de forskjellige historiske tuning-dokumentene og guidene laget for Classic Mini. Hvis du har manglende tuning-ressurser, vennligst vurder å bidra!",
    "actions": {
      "add_to_archive": "Legg til i Arkiv",
      "cover_server_costs": "Dekk Serverkostnader"
    },
    "support_divider": "Støtte",
    "seo": {
      "og_title": "Classic Mini Arkiv - Tuning",
      "og_description": "Kuratert samling av Classic Mini tuning-guider og ressurser",
      "twitter_title": "Classic Mini Arkiv - Tuning",
      "twitter_description": "Kuratert samling av Classic Mini tuning-guider og ressurser"
    }
  }
}
</i18n>
