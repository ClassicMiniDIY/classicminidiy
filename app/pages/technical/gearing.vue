<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';
  // Track calculator loading state
  const isCalculatorLoaded = ref(false);

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
        href: 'https://classicminidiy.com/technical/gearing',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // Add structured data for the calculator tool
  const calculatorJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: $t('structured_data.calculator_name'),
    applicationCategory: 'AutomotiveApplication',
    operatingSystem: 'Web Browser',
    description: $t('structured_data.calculator_description'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  // Add HowTo structured data
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: $t('structured_data.how_to_name'),
    description: $t('structured_data.how_to_description'),
    step: [
      {
        '@type': 'HowToStep',
        name: $t('structured_data.steps.select_gearbox.name'),
        text: $t('structured_data.steps.select_gearbox.text'),
      },
      {
        '@type': 'HowToStep',
        name: $t('structured_data.steps.enter_tire.name'),
        text: $t('structured_data.steps.enter_tire.text'),
      },
      {
        '@type': 'HowToStep',
        name: $t('structured_data.steps.select_final_drive.name'),
        text: $t('structured_data.steps.select_final_drive.text'),
      },
      {
        '@type': 'HowToStep',
        name: $t('structured_data.steps.view_results.name'),
        text: $t('structured_data.steps.view_results.text'),
      },
    ],
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(calculatorJsonLd),
      },
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(howToJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('og_title'),
    ogDescription: $t('og_description'),
    ogUrl: 'https://classicminidiy.com/technical/gearing',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/gearing.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('twitter_title'),
    twitterDescription: $t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/gearing.png',
  });
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.TECH" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :version="BREADCRUMB_VERSIONS.TECH" :page="$t('breadcrumb_title')"></breadcrumb>
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-8">
            <h1 class="text-3xl font-bold mb-4">{{ $t('main_heading') }}</h1>
            <p class="mb-4">
              {{ $t('description_text') }}
            </p>
          </div>
          <div class="col-span-12 md:col-span-4">
            <NuxtLink :to="'/archive/engines'" :title="$t('engine_sizes_card.link_title')" class="block">
              <UCard class="hover:shadow-lg transition-shadow">
                <div class="flex items-start space-x-4">
                  <div class="shrink-0">
                    <figure class="w-16 h-16">
                      <picture>
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-dashboard-100.webp"
                          type="image/webp"
                        />
                        <source
                          srcset="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-dashboard-100.png"
                          type="image/png"
                        />
                        <nuxt-img
                          loading="lazy"
                          src="https://classicminidiy.s3.amazonaws.com/cloud-icon/icons8-dashboard-100.png"
                          class="w-full h-full object-contain"
                          :alt="$t('engine_sizes_card.alt_text')"
                        />
                      </picture>
                    </figure>
                  </div>
                  <div>
                    <h2 class="text-xl font-semibold">
                      {{ $t('engine_sizes_card.heading') }}
                    </h2>
                    <p class="mt-1">{{ $t('engine_sizes_card.description') }}</p>
                  </div>
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <ClientOnly fallback-tag="div" :fallback="$t('ui.loading_fallback')">
          <div class="min-h-96 flex items-center justify-center" v-if="!isCalculatorLoaded">
            <div class="flex flex-col items-center space-y-4">
              <span class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></span>
              <p class="opacity-70">{{ $t('ui.loading_text') }}</p>
            </div>
          </div>
          <LazyCalculatorsGearbox @vue:mounted="isCalculatorLoaded = true" />
        </ClientOnly>
      </div>
      <div class="col-span-12 md:col-span-4 md:col-start-5">
        <USeparator :label="$t('ui.more_section')" />
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
    "title": "Tech - Gearing Calculator",
    "description": "Planning your next gearbox build? Use our brand new gearbox gearing calculator to generate information for your Classic Mini's gearbox refurb or upgrade.",
    "keywords": "gearbox calculator, Classic Mini gearing, gear ratios, speedometer gear, final drive ratio, Mini Cooper transmission, gearbox rebuild",
    "hero_title": "Gearbox Calculator",
    "breadcrumb_title": "Gearbox Calculator",
    "og_title": "Tech - Gearing Calculator",
    "og_description": "Planning your next gearbox build? Use our brand new gearbox gearing calculator to generate information for your Classic Mini's gearbox refurb or upgrade.",
    "twitter_title": "Tech - Gearing Calculator",
    "twitter_description": "Planning your next gearbox build? Use our brand new gearbox gearing calculator to generate information for your Classic Mini's gearbox refurb or upgrade.",
    "main_heading": "Gearbox Calculator",
    "description_text": "When building or rebuilding a gearbox, updaing your gear ratios, or changing out your speedometer sometimes you need to update some things. Using the Classic Mini DIY Gear Calculator below, you can determine the correct gearing for your for your new engine build and find the right speedo gear to use as well.",
    "engine_sizes_card": {
      "link_title": "Link to Engine Sizes",
      "heading": "What are standard engine sizes?",
      "description": "Click here to learn about common engine sizes in the classic mini.",
      "alt_text": "Engine size table image preview"
    },
    "structured_data": {
      "calculator_name": "Classic Mini Gearbox Calculator",
      "calculator_description": "An interactive calculator to determine gear ratios, speedometer gearing, and top speeds for Classic Mini gearbox builds.",
      "how_to_name": "How to Calculate Gearing for a Classic Mini Gearbox",
      "how_to_description": "Learn how to calculate the correct gearing for your Classic Mini gearbox using our interactive calculator.",
      "steps": {
        "select_gearbox": {
          "name": "Select Gearbox Type",
          "text": "Choose your gearbox type from the available options (A+, rod change, etc.)."
        },
        "enter_tire": {
          "name": "Enter Tire Size",
          "text": "Enter your tire dimensions to calculate accurate speed readings."
        },
        "select_final_drive": {
          "name": "Select Final Drive Ratio",
          "text": "Choose your final drive ratio from the dropdown or enter a custom value."
        },
        "view_results": {
          "name": "View Results",
          "text": "The calculator will display speed at RPM for each gear and recommended speedometer gear."
        }
      }
    },
    "ui": {
      "loading_fallback": "Loading gearbox calculator...",
      "loading_text": "Loading gearbox calculator...",
      "more_section": "More"
    }
  },
  "es": {
    "title": "Técnico - Calculadora de Engranajes",
    "description": "¿Planificando tu próxima construcción de caja de cambios? Usa nuestra nueva calculadora de engranajes de caja de cambios para generar información para la renovación o actualización de la caja de cambios de tu Classic Mini.",
    "keywords": "calculadora de caja de cambios, engranajes Classic Mini, relaciones de engranajes, engranaje velocímetro, relación de transmisión final, transmisión Mini Cooper, reconstrucción de caja de cambios",
    "hero_title": "Calculadora de Caja de Cambios",
    "breadcrumb_title": "Calculadora de Caja de Cambios",
    "og_title": "Técnico - Calculadora de Engranajes",
    "og_description": "¿Planificando tu próxima construcción de caja de cambios? Usa nuestra nueva calculadora de engranajes de caja de cambios para generar información para la renovación o actualización de la caja de cambios de tu Classic Mini.",
    "twitter_title": "Técnico - Calculadora de Engranajes",
    "twitter_description": "¿Planificando tu próxima construcción de caja de cambios? Usa nuestra nueva calculadora de engranajes de caja de cambios para generar información para la renovación o actualización de la caja de cambios de tu Classic Mini.",
    "main_heading": "Calculadora de Caja de Cambios",
    "description_text": "Al construir o reconstruir una caja de cambios, actualizar tus relaciones de engranajes, o cambiar tu velocímetro, a veces necesitas actualizar algunas cosas. Usando la Calculadora de Engranajes Classic Mini DIY a continuación, puedes determinar el engranaje correcto para la construcción de tu nuevo motor y encontrar el engranaje de velocímetro correcto para usar también.",
    "engine_sizes_card": {
      "link_title": "Enlace a Tamaños de Motor",
      "heading": "¿Cuáles son los tamaños estándar de motor?",
      "description": "Haz clic aquí para aprender sobre los tamaños comunes de motor en el classic mini.",
      "alt_text": "Vista previa de imagen de tabla de tamaños de motor"
    },
    "structured_data": {
      "calculator_name": "Calculadora de Caja de Cambios Classic Mini",
      "calculator_description": "Una calculadora interactiva para determinar las relaciones de engranajes, el engranaje del velocímetro y las velocidades máximas para la construcción de cajas de cambios del Classic Mini.",
      "how_to_name": "Cómo Calcular el Engranaje para una Caja de Cambios Classic Mini",
      "how_to_description": "Aprende cómo calcular el engranaje correcto para la caja de cambios de tu Classic Mini usando nuestra calculadora interactiva.",
      "steps": {
        "select_gearbox": {
          "name": "Seleccionar Tipo de Caja de Cambios",
          "text": "Elige el tipo de caja de cambios entre las opciones disponibles (A+, cambio de varilla, etc.)."
        },
        "enter_tire": {
          "name": "Introducir Tamaño de Neumático",
          "text": "Introduce las dimensiones de tu neumático para calcular lecturas de velocidad precisas."
        },
        "select_final_drive": {
          "name": "Seleccionar Relación de Transmisión Final",
          "text": "Elige tu relación de transmisión final del desplegable o introduce un valor personalizado."
        },
        "view_results": {
          "name": "Ver Resultados",
          "text": "La calculadora mostrará la velocidad a las RPM para cada marcha y el engranaje de velocímetro recomendado."
        }
      }
    },
    "ui": {
      "loading_fallback": "Cargando calculadora de caja de cambios...",
      "loading_text": "Cargando calculadora de caja de cambios...",
      "more_section": "Más"
    }
  },
  "fr": {
    "title": "Technique - Calculateur d'Engrenages",
    "description": "Vous planifiez votre prochaine construction de boîte de vitesses ? Utilisez notre tout nouveau calculateur d'engrenages de boîte de vitesses pour générer des informations pour la rénovation ou la mise à niveau de la boîte de vitesses de votre Classic Mini.",
    "keywords": "calculateur boîte de vitesses, engrenages Classic Mini, rapports de vitesse, pignon compteur, rapport de pont, transmission Mini Cooper, reconstruction boîte de vitesses",
    "hero_title": "Calculateur de Boîte de Vitesses",
    "breadcrumb_title": "Calculateur de Boîte de Vitesses",
    "og_title": "Technique - Calculateur d'Engrenages",
    "og_description": "Vous planifiez votre prochaine construction de boîte de vitesses ? Utilisez notre tout nouveau calculateur d'engrenages de boîte de vitesses pour générer des informations pour la rénovation ou la mise à niveau de la boîte de vitesses de votre Classic Mini.",
    "twitter_title": "Technique - Calculateur d'Engrenages",
    "twitter_description": "Vous planifiez votre prochaine construction de boîte de vitesses ? Utilisez notre tout nouveau calculateur d'engrenages de boîte de vitesses pour générer des informations pour la rénovation ou la mise à niveau de la boîte de vitesses de votre Classic Mini.",
    "main_heading": "Calculateur de Boîte de Vitesses",
    "description_text": "Lors de la construction ou de la reconstruction d'une boîte de vitesses, de la mise à jour de vos rapports de vitesse, ou du changement de votre compteur de vitesse, vous devez parfois mettre à jour certaines choses. En utilisant le Calculateur d'Engrenages Classic Mini DIY ci-dessous, vous pouvez déterminer l'engrenage correct pour la construction de votre nouveau moteur et trouver le bon engrenage de compteur à utiliser également.",
    "engine_sizes_card": {
      "link_title": "Lien vers les Tailles de Moteur",
      "heading": "Quelles sont les tailles de moteur standard ?",
      "description": "Cliquez ici pour en savoir plus sur les tailles de moteur communes dans la classic mini.",
      "alt_text": "Aperçu de l'image du tableau des tailles de moteur"
    },
    "structured_data": {
      "calculator_name": "Calculateur de Boîte de Vitesses Classic Mini",
      "calculator_description": "Un calculateur interactif pour déterminer les rapports de vitesse, l'engrenage du compteur de vitesse et les vitesses maximales pour la construction de boîtes de vitesses Classic Mini.",
      "how_to_name": "Comment Calculer les Rapports de Transmission pour une Boîte de Vitesses Classic Mini",
      "how_to_description": "Apprenez à calculer les bons rapports de transmission pour la boîte de vitesses de votre Classic Mini grâce à notre calculateur interactif.",
      "steps": {
        "select_gearbox": {
          "name": "Sélectionner le Type de Boîte de Vitesses",
          "text": "Choisissez votre type de boîte de vitesses parmi les options disponibles (A+, commande à tige, etc.)."
        },
        "enter_tire": {
          "name": "Saisir la Taille des Pneus",
          "text": "Entrez les dimensions de vos pneus pour calculer des lectures de vitesse précises."
        },
        "select_final_drive": {
          "name": "Sélectionner le Rapport de Pont",
          "text": "Choisissez votre rapport de pont dans la liste déroulante ou entrez une valeur personnalisée."
        },
        "view_results": {
          "name": "Voir les Résultats",
          "text": "Le calculateur affichera la vitesse en fonction des RPM pour chaque rapport et l'engrenage de compteur recommandé."
        }
      }
    },
    "ui": {
      "loading_fallback": "Chargement du calculateur de boîte de vitesses...",
      "loading_text": "Chargement du calculateur de boîte de vitesses...",
      "more_section": "Plus"
    }
  },
  "it": {
    "title": "Tecnico - Calcolatore Ingranaggi",
    "description": "Stai pianificando la tua prossima costruzione del cambio? Usa il nostro nuovissimo calcolatore di ingranaggi del cambio per generare informazioni per il rinnovamento o l'aggiornamento del cambio della tua Classic Mini.",
    "keywords": "calcolatore cambio, ingranaggi Classic Mini, rapporti di trasmissione, ingranaggio tachimetro, rapporto finale, trasmissione Mini Cooper, ricostruzione cambio",
    "hero_title": "Calcolatore Cambio",
    "breadcrumb_title": "Calcolatore Cambio",
    "og_title": "Tecnico - Calcolatore Ingranaggi",
    "og_description": "Stai pianificando la tua prossima costruzione del cambio? Usa il nostro nuovissimo calcolatore di ingranaggi del cambio per generare informazioni per il rinnovamento o l'aggiornamento del cambio della tua Classic Mini.",
    "twitter_title": "Tecnico - Calcolatore Ingranaggi",
    "twitter_description": "Stai pianificando la tua prossima costruzione del cambio? Usa il nostro nuovissimo calcolatore di ingranaggi del cambio per generare informazioni per il rinnovamento o l'aggiornamento del cambio della tua Classic Mini.",
    "main_heading": "Calcolatore Cambio",
    "description_text": "Quando si costruisce o ricostruisce un cambio, si aggiornano i rapporti degli ingranaggi, o si cambia il tachimetro, a volte è necessario aggiornare alcune cose. Utilizzando il Calcolatore Ingranaggi Classic Mini DIY qui sotto, puoi determinare l'ingranaggio corretto per la costruzione del tuo nuovo motore e trovare l'ingranaggio del tachimetro giusto da usare anche.",
    "engine_sizes_card": {
      "link_title": "Link alle Dimensioni Motore",
      "heading": "Quali sono le dimensioni standard del motore?",
      "description": "Clicca qui per saperne di più sulle dimensioni comuni del motore nella classic mini.",
      "alt_text": "Anteprima immagine tabella dimensioni motore"
    },
    "structured_data": {
      "calculator_name": "Calcolatore Cambio Classic Mini",
      "calculator_description": "Un calcolatore interattivo per determinare i rapporti di trasmissione, l'ingranaggio del tachimetro e le velocità massime per la costruzione del cambio del Classic Mini.",
      "how_to_name": "Come Calcolare il Rapporto di Trasmissione per un Cambio Classic Mini",
      "how_to_description": "Scopri come calcolare il rapporto di trasmissione corretto per il cambio della tua Classic Mini usando il nostro calcolatore interattivo.",
      "steps": {
        "select_gearbox": {
          "name": "Seleziona il Tipo di Cambio",
          "text": "Scegli il tipo di cambio tra le opzioni disponibili (A+, cambio a leva, ecc.)."
        },
        "enter_tire": {
          "name": "Inserisci la Dimensione del Pneumatico",
          "text": "Inserisci le dimensioni del pneumatico per calcolare letture di velocità accurate."
        },
        "select_final_drive": {
          "name": "Seleziona il Rapporto del Differenziale",
          "text": "Scegli il rapporto del differenziale dal menu a tendina o inserisci un valore personalizzato."
        },
        "view_results": {
          "name": "Visualizza i Risultati",
          "text": "Il calcolatore mostrerà la velocità agli RPM per ogni marcia e l'ingranaggio del tachimetro consigliato."
        }
      }
    },
    "ui": {
      "loading_fallback": "Caricamento calcolatore cambio...",
      "loading_text": "Caricamento calcolatore cambio...",
      "more_section": "Altro"
    }
  },
  "de": {
    "title": "Technik - Übersetzungsrechner",
    "description": "Planen Sie Ihren nächsten Getriebeaufbau? Verwenden Sie unseren brandneuen Getriebe-Übersetzungsrechner, um Informationen für die Renovierung oder das Upgrade des Getriebes Ihres Classic Mini zu generieren.",
    "keywords": "Getrieberechner, Classic Mini Übersetzung, Übersetzungsverhältnisse, Tachoantrieb, Achsübersetzung, Mini Cooper Getriebe, Getriebe-Überholung",
    "hero_title": "Getriebe-Rechner",
    "breadcrumb_title": "Getriebe-Rechner",
    "og_title": "Technik - Übersetzungsrechner",
    "og_description": "Planen Sie Ihren nächsten Getriebeaufbau? Verwenden Sie unseren brandneuen Getriebe-Übersetzungsrechner, um Informationen für die Renovierung oder das Upgrade des Getriebes Ihres Classic Mini zu generieren.",
    "twitter_title": "Technik - Übersetzungsrechner",
    "twitter_description": "Planen Sie Ihren nächsten Getriebeaufbau? Verwenden Sie unseren brandneuen Getriebe-Übersetzungsrechner, um Informationen für die Renovierung oder das Upgrade des Getriebes Ihres Classic Mini zu generieren.",
    "main_heading": "Getriebe-Rechner",
    "description_text": "Beim Aufbau oder Wiederaufbau eines Getriebes, der Aktualisierung Ihrer Übersetzungsverhältnisse oder dem Wechsel Ihres Tachometers müssen Sie manchmal einige Dinge aktualisieren. Mit dem Classic Mini DIY Übersetzungsrechner unten können Sie die richtige Übersetzung für Ihren neuen Motoraufbau bestimmen und das richtige Tachometer-Zahnrad zum Verwenden finden.",
    "engine_sizes_card": {
      "link_title": "Link zu Motorgrößen",
      "heading": "Was sind die Standard-Motorgrößen?",
      "description": "Klicken Sie hier, um mehr über die gängigen Motorgrößen im Classic Mini zu erfahren.",
      "alt_text": "Vorschaubild der Motorgrößen-Tabelle"
    },
    "structured_data": {
      "calculator_name": "Classic Mini Getriebe-Rechner",
      "calculator_description": "Ein interaktiver Rechner zur Bestimmung von Übersetzungsverhältnissen, Tachoantrieb und Höchstgeschwindigkeiten für Classic Mini Getriebeaufbauten.",
      "how_to_name": "Wie man die Übersetzung für ein Classic Mini Getriebe berechnet",
      "how_to_description": "Erfahren Sie, wie Sie mit unserem interaktiven Rechner die richtige Übersetzung für das Getriebe Ihres Classic Mini berechnen.",
      "steps": {
        "select_gearbox": {
          "name": "Getriebetyp auswählen",
          "text": "Wählen Sie Ihren Getriebetyp aus den verfügbaren Optionen (A+, Stangenschaltung usw.)."
        },
        "enter_tire": {
          "name": "Reifengröße eingeben",
          "text": "Geben Sie Ihre Reifenmaße ein, um genaue Geschwindigkeitswerte zu berechnen."
        },
        "select_final_drive": {
          "name": "Achsübersetzung auswählen",
          "text": "Wählen Sie Ihre Achsübersetzung aus dem Dropdown-Menü oder geben Sie einen benutzerdefinierten Wert ein."
        },
        "view_results": {
          "name": "Ergebnisse anzeigen",
          "text": "Der Rechner zeigt die Geschwindigkeit bei den RPM für jeden Gang und das empfohlene Tachometer-Zahnrad an."
        }
      }
    },
    "ui": {
      "loading_fallback": "Lade Getriebe-Rechner...",
      "loading_text": "Lade Getriebe-Rechner...",
      "more_section": "Mehr"
    }
  },
  "pt": {
    "title": "Técnico - Calculadora de Engrenagens",
    "description": "Planejando sua próxima construção de caixa de câmbio? Use nossa nova calculadora de engrenagens de caixa de câmbio para gerar informações para a renovação ou atualização da caixa de câmbio do seu Classic Mini.",
    "keywords": "calculadora de caixa de câmbio, engrenagens Classic Mini, relações de engrenagens, engrenagem velocímetro, relação de transmissão final, transmissão Mini Cooper, reconstrução de caixa de câmbio",
    "hero_title": "Calculadora de Caixa de Câmbio",
    "breadcrumb_title": "Calculadora de Caixa de Câmbio",
    "og_title": "Técnico - Calculadora de Engrenagens",
    "og_description": "Planejando sua próxima construção de caixa de câmbio? Use nossa nova calculadora de engrenagens de caixa de câmbio para gerar informações para a renovação ou atualização da caixa de câmbio do seu Classic Mini.",
    "twitter_title": "Técnico - Calculadora de Engrenagens",
    "twitter_description": "Planejando sua próxima construção de caixa de câmbio? Use nossa nova calculadora de engrenagens de caixa de câmbio para gerar informações para a renovação ou atualização da caixa de câmbio do seu Classic Mini.",
    "main_heading": "Calculadora de Caixa de Câmbio",
    "description_text": "Ao construir ou reconstruir uma caixa de câmbio, atualizar suas relações de engrenagem, ou trocar seu velocímetro, às vezes você precisa atualizar algumas coisas. Usando a Calculadora de Engrenagens Classic Mini DIY abaixo, você pode determinar a engrenagem correta para a construção do seu novo motor e encontrar a engrenagem de velocímetro certa para usar também.",
    "engine_sizes_card": {
      "link_title": "Link para Tamanhos de Motor",
      "heading": "Quais são os tamanhos padrão de motor?",
      "description": "Clique aqui para aprender sobre os tamanhos comuns de motor no classic mini.",
      "alt_text": "Visualização da imagem da tabela de tamanhos de motor"
    },
    "structured_data": {
      "calculator_name": "Calculadora de Caixa de Câmbio Classic Mini",
      "calculator_description": "Uma calculadora interativa para determinar relações de transmissão, engrenagem do velocímetro e velocidades máximas para construções de caixa de câmbio do Classic Mini.",
      "how_to_name": "Como Calcular a Transmissão para uma Caixa de Câmbio Classic Mini",
      "how_to_description": "Aprenda como calcular a transmissão correta para a caixa de câmbio do seu Classic Mini usando nossa calculadora interativa.",
      "steps": {
        "select_gearbox": {
          "name": "Selecionar Tipo de Caixa de Câmbio",
          "text": "Escolha o tipo de caixa de câmbio entre as opções disponíveis (A+, câmbio de haste, etc.)."
        },
        "enter_tire": {
          "name": "Inserir Tamanho do Pneu",
          "text": "Insira as dimensões do seu pneu para calcular leituras de velocidade precisas."
        },
        "select_final_drive": {
          "name": "Selecionar Relação de Transmissão Final",
          "text": "Escolha a relação de transmissão final no menu suspenso ou insira um valor personalizado."
        },
        "view_results": {
          "name": "Ver Resultados",
          "text": "A calculadora exibirá a velocidade em RPM para cada marcha e a engrenagem de velocímetro recomendada."
        }
      }
    },
    "ui": {
      "loading_fallback": "Carregando calculadora de caixa de câmbio...",
      "loading_text": "Carregando calculadora de caixa de câmbio...",
      "more_section": "Mais"
    }
  },
  "ru": {
    "title": "Техника - Калькулятор Передач",
    "description": "Планируете следующую сборку коробки передач? Используйте наш новый калькулятор передач коробки передач для генерации информации для ремонта или модернизации коробки передач вашего Classic Mini.",
    "keywords": "калькулятор коробки передач, передачи Classic Mini, передаточные числа, шестерня спидометра, главная передача, трансмиссия Mini Cooper, восстановление коробки передач",
    "hero_title": "Калькулятор Коробки Передач",
    "breadcrumb_title": "Калькулятор Коробки Передач",
    "og_title": "Техника - Калькулятор Передач",
    "og_description": "Планируете следующую сборку коробки передач? Используйте наш новый калькулятор передач коробки передач для генерации информации для ремонта или модернизации коробки передач вашего Classic Mini.",
    "twitter_title": "Техника - Калькулятор Передач",
    "twitter_description": "Планируете следующую сборку коробки передач? Используйте наш новый калькулятор передач коробки передач для генерации информации для ремонта или модернизации коробки передач вашего Classic Mini.",
    "main_heading": "Калькулятор Коробки Передач",
    "description_text": "При сборке или пересборке коробки передач, обновлении передаточных чисел или замене спидометра иногда нужно обновить некоторые вещи. Используя Калькулятор Передач Classic Mini DIY ниже, вы можете определить правильную передачу для сборки вашего нового двигателя и найти правильную шестерню спидометра для использования также.",
    "engine_sizes_card": {
      "link_title": "Ссылка на Размеры Двигателей",
      "heading": "Каковы стандартные размеры двигателей?",
      "description": "Нажмите здесь, чтобы узнать о распространенных размерах двигателей в classic mini.",
      "alt_text": "Предварительный просмотр изображения таблицы размеров двигателей"
    },
    "structured_data": {
      "calculator_name": "Калькулятор Коробки Передач Classic Mini",
      "calculator_description": "Интерактивный калькулятор для определения передаточных чисел, шестерни спидометра и максимальных скоростей для сборки коробки передач Classic Mini.",
      "how_to_name": "Как рассчитать передаточные числа для коробки передач Classic Mini",
      "how_to_description": "Узнайте, как рассчитать правильные передаточные числа для коробки передач вашего Classic Mini с помощью нашего интерактивного калькулятора.",
      "steps": {
        "select_gearbox": {
          "name": "Выбрать Тип Коробки Передач",
          "text": "Выберите тип коробки передач из доступных вариантов (A+, штанговое переключение и т.д.)."
        },
        "enter_tire": {
          "name": "Ввести Размер Шины",
          "text": "Введите размеры вашей шины для расчёта точных показаний скорости."
        },
        "select_final_drive": {
          "name": "Выбрать Передаточное Число Главной Передачи",
          "text": "Выберите передаточное число главной передачи из выпадающего списка или введите пользовательское значение."
        },
        "view_results": {
          "name": "Просмотреть Результаты",
          "text": "Калькулятор отобразит скорость при оборотах двигателя для каждой передачи и рекомендуемую шестерню спидометра."
        }
      }
    },
    "ui": {
      "loading_fallback": "Загрузка калькулятора коробки передач...",
      "loading_text": "Загрузка калькулятора коробки передач...",
      "more_section": "Больше"
    }
  },
  "ja": {
    "title": "技術 - ギア計算機",
    "description": "次のギアボックス構築を計画していますか？クラシックミニのギアボックス改修またはアップグレードの情報を生成するために、私たちの新しいギアボックスギア計算機を使用してください。",
    "keywords": "ギアボックス計算機, クラシックミニ ギアリング, ギア比, スピードメーターギア, ファイナルドライブ, ミニクーパー トランスミッション, ギアボックス再構築",
    "hero_title": "ギアボックス計算機",
    "breadcrumb_title": "ギアボックス計算機",
    "og_title": "技術 - ギア計算機",
    "og_description": "次のギアボックス構築を計画していますか？クラシックミニのギアボックス改修またはアップグレードの情報を生成するために、私たちの新しいギアボックスギア計算機を使用してください。",
    "twitter_title": "技術 - ギア計算機",
    "twitter_description": "次のギアボックス構築を計画していますか？クラシックミニのギアボックス改修またはアップグレードの情報を生成するために、私たちの新しいギアボックスギア計算機を使用してください。",
    "main_heading": "ギアボックス計算機",
    "description_text": "ギアボックスを構築または再構築する際、ギア比を更新する際、またはスピードメーターを交換する際、時々いくつかのことを更新する必要があります。下記のクラシックミニDIYギア計算機を使用して、新しいエンジン構築に適切なギアリングを決定し、使用する正しいスピードメーターギアも見つけることができます。",
    "engine_sizes_card": {
      "link_title": "エンジンサイズへのリンク",
      "heading": "標準的なエンジンサイズは何ですか？",
      "description": "クラシックミニの一般的なエンジンサイズについて学ぶにはここをクリック。",
      "alt_text": "エンジンサイズ表の画像プレビュー"
    },
    "structured_data": {
      "calculator_name": "Classic Mini ギアボックス計算機",
      "calculator_description": "Classic Mini のギアボックス構築における歯車比、スピードメーターギア、最高速度を算出するインタラクティブ計算機です。",
      "how_to_name": "Classic Mini ギアボックスのギアリングを計算する方法",
      "how_to_description": "インタラクティブ計算機を使用して、Classic Mini のギアボックスに適切なギアリングを計算する方法を学びます。",
      "steps": {
        "select_gearbox": {
          "name": "ギアボックスタイプを選択",
          "text": "利用可能なオプション（A+、ロッドチェンジなど）からギアボックスタイプを選択してください。"
        },
        "enter_tire": {
          "name": "タイヤサイズを入力",
          "text": "正確な速度計算のためにタイヤの寸法を入力してください。"
        },
        "select_final_drive": {
          "name": "ファイナルドライブ比を選択",
          "text": "ドロップダウンからファイナルドライブ比を選択するか、カスタム値を入力してください。"
        },
        "view_results": {
          "name": "結果を表示",
          "text": "計算機は各ギアのRPMごとの速度と推奨スピードメーターギアを表示します。"
        }
      }
    },
    "ui": {
      "loading_fallback": "ギアボックス計算機を読み込み中...",
      "loading_text": "ギアボックス計算機を読み込み中...",
      "more_section": "その他"
    }
  },
  "zh": {
    "title": "技术 - 齿轮计算器",
    "description": "正在计划您的下一个变速箱构建？使用我们全新的变速箱齿轮计算器为您的经典迷你变速箱翻新或升级生成信息。",
    "keywords": "变速箱计算器, 经典迷你齿轮, 齿轮比, 速度表齿轮, 最终传动比, 迷你库珀变速箱, 变速箱重建",
    "hero_title": "变速箱计算器",
    "breadcrumb_title": "变速箱计算器",
    "og_title": "技术 - 齿轮计算器",
    "og_description": "正在计划您的下一个变速箱构建？使用我们全新的变速箱齿轮计算器为您的经典迷你变速箱翻新或升级生成信息。",
    "twitter_title": "技术 - 齿轮计算器",
    "twitter_description": "正在计划您的下一个变速箱构建？使用我们全新的变速箱齿轮计算器为您的经典迷你变速箱翻新或升级生成信息。",
    "main_heading": "变速箱计算器",
    "description_text": "在构建或重建变速箱、更新齿轮比或更换速度表时，有时您需要更新一些东西。使用下面的经典迷你DIY齿轮计算器，您可以确定新发动机构建的正确齿轮传动，并找到合适的速度表齿轮使用。",
    "engine_sizes_card": {
      "link_title": "发动机尺寸链接",
      "heading": "标准发动机尺寸是什么？",
      "description": "点击这里了解经典迷你中常见的发动机尺寸。",
      "alt_text": "发动机尺寸表图像预览"
    },
    "structured_data": {
      "calculator_name": "Classic Mini 变速箱计算器",
      "calculator_description": "一个交互式计算器，用于确定 Classic Mini 变速箱构建的齿轮比、速度表齿轮和最高速度。",
      "how_to_name": "如何计算 Classic Mini 变速箱的传动比",
      "how_to_description": "通过我们的交互式计算器，学习如何为您的 Classic Mini 变速箱计算正确的传动比。",
      "steps": {
        "select_gearbox": {
          "name": "选择变速箱类型",
          "text": "从可用选项中选择您的变速箱类型（A+、拉杆换挡等）。"
        },
        "enter_tire": {
          "name": "输入轮胎尺寸",
          "text": "输入轮胎尺寸以计算准确的速度读数。"
        },
        "select_final_drive": {
          "name": "选择最终传动比",
          "text": "从下拉菜单中选择最终传动比，或输入自定义值。"
        },
        "view_results": {
          "name": "查看结果",
          "text": "计算器将显示每个档位在各转速下的速度以及推荐的速度表齿轮。"
        }
      }
    },
    "ui": {
      "loading_fallback": "正在加载变速箱计算器...",
      "loading_text": "正在加载变速箱计算器...",
      "more_section": "更多"
    }
  },
  "ko": {
    "title": "기술 - 기어 계산기",
    "description": "다음 기어박스 구축을 계획하고 계신가요? 클래식 미니 기어박스 개조 또는 업그레이드를 위한 정보를 생성하기 위해 우리의 새로운 기어박스 기어 계산기를 사용하세요.",
    "keywords": "기어박스 계산기, 클래식 미니 기어링, 기어비, 속도계 기어, 파이널 드라이브, 미니 쿠퍼 변속기, 기어박스 재구축",
    "hero_title": "기어박스 계산기",
    "breadcrumb_title": "기어박스 계산기",
    "og_title": "기술 - 기어 계산기",
    "og_description": "다음 기어박스 구축을 계획하고 계신가요? 클래식 미니 기어박스 개조 또는 업그레이드를 위한 정보를 생성하기 위해 우리의 새로운 기어박스 기어 계산기를 사용하세요.",
    "twitter_title": "기술 - 기어 계산기",
    "twitter_description": "다음 기어박스 구축을 계획하고 계신가요? 클래식 미니 기어박스 개조 또는 업그레이드를 위한 정보를 생성하기 위해 우리의 새로운 기어박스 기어 계산기를 사용하세요.",
    "main_heading": "기어박스 계산기",
    "description_text": "기어박스를 구축하거나 재구축할 때, 기어비를 업데이트하거나 속도계를 교체할 때 때로는 몇 가지를 업데이트해야 합니다. 아래의 클래식 미니 DIY 기어 계산기를 사용하여 새로운 엔진 구축에 올바른 기어링을 결정하고 사용할 올바른 속도계 기어도 찾을 수 있습니다.",
    "engine_sizes_card": {
      "link_title": "엔진 크기 링크",
      "heading": "표준 엔진 크기는 무엇입니까?",
      "description": "클래식 미니의 일반적인 엔진 크기에 대해 알아보려면 여기를 클릭하세요.",
      "alt_text": "엔진 크기 표 이미지 미리보기"
    },
    "structured_data": {
      "calculator_name": "Classic Mini 기어박스 계산기",
      "calculator_description": "Classic Mini 기어박스 구축을 위한 기어비, 속도계 기어, 최고 속도를 계산하는 인터랙티브 계산기입니다.",
      "how_to_name": "Classic Mini 기어박스의 기어링을 계산하는 방법",
      "how_to_description": "인터랙티브 계산기를 사용하여 Classic Mini 기어박스에 적합한 기어링을 계산하는 방법을 알아보세요.",
      "steps": {
        "select_gearbox": {
          "name": "기어박스 유형 선택",
          "text": "사용 가능한 옵션(A+, 로드 체인지 등)에서 기어박스 유형을 선택하세요."
        },
        "enter_tire": {
          "name": "타이어 크기 입력",
          "text": "정확한 속도 계산을 위해 타이어 치수를 입력하세요."
        },
        "select_final_drive": {
          "name": "파이널 드라이브 비율 선택",
          "text": "드롭다운에서 파이널 드라이브 비율을 선택하거나 사용자 정의 값을 입력하세요."
        },
        "view_results": {
          "name": "결과 보기",
          "text": "계산기는 각 기어의 RPM별 속도와 권장 속도계 기어를 표시합니다."
        }
      }
    },
    "ui": {
      "loading_fallback": "기어박스 계산기 로딩 중...",
      "loading_text": "기어박스 계산기 로딩 중...",
      "more_section": "더보기"
    }
  }
}
</i18n>
