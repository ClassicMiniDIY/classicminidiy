<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../data/models/generic';

  const { listApproved } = useRegistry();

  // Define table columns
  const tableHeaders = [
    { title: $t('table_headers.year'), key: 'year' },
    { title: $t('table_headers.model'), key: 'model' },
    { title: $t('table_headers.trim'), key: 'trim' },
    { title: $t('table_headers.color'), key: 'color' },
  ];

  const { data: registryItems, status } = await useAsyncData('registry-list', () => listApproved());

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
        href: 'https://classicminidiy.com/archive/registry',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // ItemList structured data for registry
  const registryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classic Mini Registry',
    description: $t('description'),
    url: 'https://classicminidiy.com/archive/registry',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Registered Classic Mini Vehicles',
      description: 'User-submitted Classic Mini vehicles with specifications',
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
        innerHTML: JSON.stringify(registryJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/registry',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/registry.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/registry.png',
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
            <h1 class="text-3xl font-bold">{{ $t('main_heading') }}</h1>
            <h2 class="text-xl mt-4">
              <strong>{{ registryItems?.length || $t('subtitle_count') }}</strong>
              {{ $t('subtitle') }}
            </h2>
            <p class="my-4">
              {{ $t('description_text') }}
            </p>
            <p class="font-bold mt-4 mb-5">{{ $t('submission_status_text') }}</p>
            <UButton to="/archive/registry/pending" color="primary">
              <i class="fa-duotone fa-clipboard-question mr-2"></i>
              {{ $t('track_submission_button') }}
            </UButton>
          </div>
          <div class="col-span-12 md:col-span-4">
            <a href="#submitAnchor" class="block">
              <UCard class="hover:shadow-2xl transition-shadow duration-300">
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <figure class="w-16 h-16">
                      <picture>
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-book-reading-100.webp"
                          type="image/webp"
                        />
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-book-reading-100.png"
                          type="image/png"
                        />
                        <nuxt-img
                          loading="lazy"
                          src="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-book-reading-100.png"
                          :alt="$t('submit_card.alt_text')"
                          class="w-16 h-16"
                        />
                      </picture>
                    </figure>
                  </div>
                  <div>
                    <h2 class="text-lg font-semibold">{{ $t('submit_card.title') }}</h2>
                    <p>
                      {{ $t('submit_card.description') }}
                    </p>
                  </div>
                </div>
              </UCard>
            </a>
          </div>
        </div>
      </div>
      <div class="col-span-12">
        <RegistryTable
          :items="registryItems || []"
          :loading="status === 'pending'"
          :tableHeaders="tableHeaders"
          :defaultPageSize="10"
        />
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator id="submitAnchor" :label="$t('submit_divider')" />
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <RegistrySubmission></RegistrySubmission>
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator :label="$t('support_divider')" />
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Registry - Classic Mini DIY",
    "description": "Browse and contribute to the Classic Mini registry database",
    "keywords": "Classic Mini registry, Mini Cooper database, registered Minis, Classic Mini owners, Mini vehicle registry, car registry, vintage Mini database",
    "hero_title": "Classic Mini Registry",
    "breadcrumb_title": "Registry",
    "main_heading": "Classic Mini Registry",
    "subtitle_count": "0",
    "subtitle": "Classic Minis registered",
    "description_text": "The Classic Mini Registry is a community-driven database of Classic Mini vehicles. Help us build the most comprehensive registry by submitting your Mini's details.",
    "submission_status_text": "Want to track your submission status?",
    "track_submission_button": "Track Submission",
    "table_headers": {
      "year": "Year",
      "model": "Model",
      "trim": "Trim",
      "color": "Color"
    },
    "submit_card": {
      "title": "Submit Your Mini",
      "description": "Add your Classic Mini to our registry",
      "alt_text": "Submit Mini Icon"
    },
    "submit_divider": "Submit Your Mini",
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Registry - Classic Mini DIY",
      "og_description": "Browse and contribute to the Classic Mini registry database",
      "twitter_title": "Classic Mini Registry - Classic Mini DIY",
      "twitter_description": "Browse and contribute to the Classic Mini registry database"
    }
  },
  "de": {
    "title": "Classic Mini Registry - Classic Mini DIY",
    "description": "Durchsuchen und beitragen zur Classic Mini Registry-Datenbank",
    "hero_title": "Classic Mini Registry",
    "breadcrumb_title": "Registry",
    "main_heading": "Classic Mini Registry",
    "subtitle_count": "0",
    "subtitle": "Classic Minis registriert",
    "description_text": "Die Classic Mini Registry ist eine gemeinschaftsgetriebene Datenbank von Classic Mini Fahrzeugen. Helfen Sie uns, die umfassendste Registry aufzubauen, indem Sie die Details Ihres Mini einreichen.",
    "submission_status_text": "Möchten Sie den Status Ihrer Einreichung verfolgen?",
    "track_submission_button": "Einreichung verfolgen",
    "table_headers": {
      "year": "Jahr",
      "model": "Modell",
      "trim": "Ausstattung",
      "color": "Farbe"
    },
    "submit_card": {
      "title": "Ihren Mini einreichen",
      "description": "Fügen Sie Ihren Classic Mini zu unserer Registry hinzu",
      "alt_text": "Mini einreichen Symbol"
    },
    "submit_divider": "Ihren Mini einreichen",
    "support_divider": "Unterstützung",
    "seo": {
      "og_title": "Classic Mini Registry - Classic Mini DIY",
      "og_description": "Durchsuchen und beitragen zur Classic Mini Registry-Datenbank",
      "twitter_title": "Classic Mini Registry - Classic Mini DIY",
      "twitter_description": "Durchsuchen und beitragen zur Classic Mini Registry-Datenbank"
    }
  },
  "es": {
    "title": "Registro Classic Mini - Classic Mini DIY",
    "description": "Navega y contribuye a la base de datos del registro Classic Mini",
    "hero_title": "Registro Classic Mini",
    "breadcrumb_title": "Registro",
    "main_heading": "Registro Classic Mini",
    "subtitle_count": "0",
    "subtitle": "Classic Minis registrados",
    "description_text": "El Registro Classic Mini es una base de datos impulsada por la comunidad de vehículos Classic Mini. Ayúdanos a construir el registro más completo enviando los detalles de tu Mini.",
    "submission_status_text": "¿Quieres rastrear el estado de tu envío?",
    "track_submission_button": "Rastrear Envío",
    "table_headers": {
      "year": "Año",
      "model": "Modelo",
      "trim": "Acabado",
      "color": "Color"
    },
    "submit_card": {
      "title": "Envía tu Mini",
      "description": "Agrega tu Classic Mini a nuestro registro",
      "alt_text": "Icono Enviar Mini"
    },
    "submit_divider": "Envía tu Mini",
    "support_divider": "Soporte",
    "seo": {
      "og_title": "Registro Classic Mini - Classic Mini DIY",
      "og_description": "Navega y contribuye a la base de datos del registro Classic Mini",
      "twitter_title": "Registro Classic Mini - Classic Mini DIY",
      "twitter_description": "Navega y contribuye a la base de datos del registro Classic Mini"
    }
  },
  "fr": {
    "title": "Registre Classic Mini - Classic Mini DIY",
    "description": "Parcourez et contribuez à la base de données du registre Classic Mini",
    "hero_title": "Registre Classic Mini",
    "breadcrumb_title": "Registre",
    "main_heading": "Registre Classic Mini",
    "subtitle_count": "0",
    "subtitle": "Classic Minis enregistrées",
    "description_text": "Le Registre Classic Mini est une base de données communautaire de véhicules Classic Mini. Aidez-nous à construire le registre le plus complet en soumettant les détails de votre Mini.",
    "submission_status_text": "Voulez-vous suivre le statut de votre soumission ?",
    "track_submission_button": "Suivre la Soumission",
    "table_headers": {
      "year": "Année",
      "model": "Modèle",
      "trim": "Finition",
      "color": "Couleur"
    },
    "submit_card": {
      "title": "Soumettez votre Mini",
      "description": "Ajoutez votre Classic Mini à notre registre",
      "alt_text": "Icône Soumettre Mini"
    },
    "submit_divider": "Soumettez votre Mini",
    "support_divider": "Support",
    "seo": {
      "og_title": "Registre Classic Mini - Classic Mini DIY",
      "og_description": "Parcourez et contribuez à la base de données du registre Classic Mini",
      "twitter_title": "Registre Classic Mini - Classic Mini DIY",
      "twitter_description": "Parcourez et contribuez à la base de données du registre Classic Mini"
    }
  },
  "it": {
    "title": "Registro Classic Mini - Classic Mini DIY",
    "description": "Sfoglia e contribuisci al database del registro Classic Mini",
    "hero_title": "Registro Classic Mini",
    "breadcrumb_title": "Registro",
    "main_heading": "Registro Classic Mini",
    "subtitle_count": "0",
    "subtitle": "Classic Mini registrate",
    "description_text": "Il Registro Classic Mini è un database guidato dalla comunità di veicoli Classic Mini. Aiutaci a costruire il registro più completo inviando i dettagli della tua Mini.",
    "submission_status_text": "Vuoi tracciare lo stato del tuo invio?",
    "track_submission_button": "Traccia Invio",
    "table_headers": {
      "year": "Anno",
      "model": "Modello",
      "trim": "Allestimento",
      "color": "Colore"
    },
    "submit_card": {
      "title": "Invia la tua Mini",
      "description": "Aggiungi la tua Classic Mini al nostro registro",
      "alt_text": "Icona Invia Mini"
    },
    "submit_divider": "Invia la tua Mini",
    "support_divider": "Supporto",
    "seo": {
      "og_title": "Registro Classic Mini - Classic Mini DIY",
      "og_description": "Sfoglia e contribuisci al database del registro Classic Mini",
      "twitter_title": "Registro Classic Mini - Classic Mini DIY",
      "twitter_description": "Sfoglia e contribuisci al database del registro Classic Mini"
    }
  },
  "pt": {
    "title": "Registro Classic Mini - Classic Mini DIY",
    "description": "Navegue e contribua para o banco de dados do registro Classic Mini",
    "hero_title": "Registro Classic Mini",
    "breadcrumb_title": "Registro",
    "main_heading": "Registro Classic Mini",
    "subtitle_count": "0",
    "subtitle": "Classic Minis registrados",
    "description_text": "O Registro Classic Mini é um banco de dados orientado pela comunidade de veículos Classic Mini. Ajude-nos a construir o registro mais abrangente enviando os detalhes do seu Mini.",
    "submission_status_text": "Quer acompanhar o status da sua submissão?",
    "track_submission_button": "Acompanhar Submissão",
    "table_headers": {
      "year": "Ano",
      "model": "Modelo",
      "trim": "Acabamento",
      "color": "Cor"
    },
    "submit_card": {
      "title": "Envie seu Mini",
      "description": "Adicione seu Classic Mini ao nosso registro",
      "alt_text": "Ícone Enviar Mini"
    },
    "submit_divider": "Envie seu Mini",
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Registro Classic Mini - Classic Mini DIY",
      "og_description": "Navegue e contribua para o banco de dados do registro Classic Mini",
      "twitter_title": "Registro Classic Mini - Classic Mini DIY",
      "twitter_description": "Navegue e contribua para o banco de dados do registro Classic Mini"
    }
  },
  "nl": {
    "title": "Classic Mini Register - Classic Mini DIY",
    "description": "Blader door en draag bij aan de Classic Mini register database",
    "hero_title": "Classic Mini Register",
    "breadcrumb_title": "Register",
    "main_heading": "Classic Mini Register",
    "subtitle_count": "0",
    "subtitle": "Classic Minis geregistreerd",
    "description_text": "Het Classic Mini Register is een door de gemeenschap gedreven database van Classic Mini voertuigen. Help ons het meest uitgebreide register te bouwen door de details van je Mini in te dienen.",
    "submission_status_text": "Wil je de status van je inzending volgen?",
    "track_submission_button": "Inzending Volgen",
    "table_headers": {
      "year": "Jaar",
      "model": "Model",
      "trim": "Uitvoering",
      "color": "Kleur"
    },
    "submit_card": {
      "title": "Dien je Mini in",
      "description": "Voeg je Classic Mini toe aan ons register",
      "alt_text": "Mini Indienen Pictogram"
    },
    "submit_divider": "Dien je Mini in",
    "support_divider": "Ondersteuning",
    "seo": {
      "og_title": "Classic Mini Register - Classic Mini DIY",
      "og_description": "Blader door en draag bij aan de Classic Mini register database",
      "twitter_title": "Classic Mini Register - Classic Mini DIY",
      "twitter_description": "Blader door en draag bij aan de Classic Mini register database"
    }
  },
  "sv": {
    "title": "Classic Mini Register - Classic Mini DIY",
    "description": "Bläddra i och bidra till Classic Mini register-databasen",
    "hero_title": "Classic Mini Register",
    "breadcrumb_title": "Register",
    "main_heading": "Classic Mini Register",
    "subtitle_count": "0",
    "subtitle": "Classic Minis registrerade",
    "description_text": "Classic Mini Registret är en community-driven databas av Classic Mini fordon. Hjälp oss att bygga det mest omfattande registret genom att skicka in din Minis detaljer.",
    "submission_status_text": "Vill du spåra din inlämnings status?",
    "track_submission_button": "Spåra Inlämning",
    "table_headers": {
      "year": "År",
      "model": "Modell",
      "trim": "Utrustning",
      "color": "Färg"
    },
    "submit_card": {
      "title": "Skicka in din Mini",
      "description": "Lägg till din Classic Mini i vårt register",
      "alt_text": "Skicka in Mini Ikon"
    },
    "submit_divider": "Skicka in din Mini",
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Register - Classic Mini DIY",
      "og_description": "Bläddra i och bidra till Classic Mini register-databasen",
      "twitter_title": "Classic Mini Register - Classic Mini DIY",
      "twitter_description": "Bläddra i och bidra till Classic Mini register-databasen"
    }
  },
  "da": {
    "title": "Classic Mini Register - Classic Mini DIY",
    "description": "Gennemse og bidrag til Classic Mini register-databasen",
    "hero_title": "Classic Mini Register",
    "breadcrumb_title": "Register",
    "main_heading": "Classic Mini Register",
    "subtitle_count": "0",
    "subtitle": "Classic Minis registreret",
    "description_text": "Classic Mini Registret er en fællesskabsdrevet database af Classic Mini køretøjer. Hjælp os med at bygge det mest omfattende register ved at indsende din Minis detaljer.",
    "submission_status_text": "Vil du spore din indleveringsstatus?",
    "track_submission_button": "Spor Indlevering",
    "table_headers": {
      "year": "År",
      "model": "Model",
      "trim": "Udstyr",
      "color": "Farve"
    },
    "submit_card": {
      "title": "Indsend din Mini",
      "description": "Tilføj din Classic Mini til vores register",
      "alt_text": "Indsend Mini Ikon"
    },
    "submit_divider": "Indsend din Mini",
    "support_divider": "Support",
    "seo": {
      "og_title": "Classic Mini Register - Classic Mini DIY",
      "og_description": "Gennemse og bidrag til Classic Mini register-databasen",
      "twitter_title": "Classic Mini Register - Classic Mini DIY",
      "twitter_description": "Gennemse og bidrag til Classic Mini register-databasen"
    }
  },
  "no": {
    "title": "Classic Mini Register - Classic Mini DIY",
    "description": "Bla gjennom og bidra til Classic Mini register-databasen",
    "hero_title": "Classic Mini Register",
    "breadcrumb_title": "Register",
    "main_heading": "Classic Mini Register",
    "subtitle_count": "0",
    "subtitle": "Classic Minis registrert",
    "description_text": "Classic Mini Registeret er en fellesskapsdrevet database av Classic Mini kjøretøy. Hjelp oss å bygge det mest omfattende registeret ved å sende inn din Minis detaljer.",
    "submission_status_text": "Vil du spore din innleveringsstatus?",
    "track_submission_button": "Spor Innlevering",
    "table_headers": {
      "year": "År",
      "model": "Modell",
      "trim": "Utstyr",
      "color": "Farge"
    },
    "submit_card": {
      "title": "Send inn din Mini",
      "description": "Legg til din Classic Mini i vårt register",
      "alt_text": "Send inn Mini Ikon"
    },
    "submit_divider": "Send inn din Mini",
    "support_divider": "Støtte",
    "seo": {
      "og_title": "Classic Mini Register - Classic Mini DIY",
      "og_description": "Bla gjennom og bidra til Classic Mini register-databasen",
      "twitter_title": "Classic Mini Register - Classic Mini DIY",
      "twitter_description": "Bla gjennom og bidra til Classic Mini register-databasen"
    }
  }
}
</i18n>
