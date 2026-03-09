<script lang="js" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();

  // Enhanced SEO metadata
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
        href: 'https://classicminidiy.com/technical/compression',
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
    ogUrl: 'https://classicminidiy.com/technical/compression',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/compression.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitter_title'),
    twitterDescription: t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical/compression.png',
  });

  // Add structured data for the calculator tool
  const calculatorJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('structured_data.calculator_name'),
    applicationCategory: 'AutomotiveApplication',
    operatingSystem: 'Web Browser',
    description: t('structured_data.calculator_description'),
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
    name: t('structured_data.how_to_name'),
    description: t('structured_data.how_to_description'),
    step: [
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.piston_dish.name'),
        text: t('structured_data.steps.piston_dish.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.head_volume.name'),
        text: t('structured_data.steps.head_volume.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.deck_height.name'),
        text: t('structured_data.steps.deck_height.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.bore_stroke.name'),
        text: t('structured_data.steps.bore_stroke.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.gasket_thickness.name'),
        text: t('structured_data.steps.gasket_thickness.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.view_results.name'),
        text: t('structured_data.steps.view_results.text'),
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
</script>

<template>
  <hero :navigation="true" :heroType="HERO_TYPES.TECH" />
  <div class="container mx-auto px-4 pb-10">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :version="BREADCRUMB_VERSIONS.TECH" :page="t('breadcrumb_title')"></breadcrumb>
        <div class="grid grid-cols-11 md:grid-cols-12 gap-6">
          <div class="col-span-12 md:col-span-8">
            <h1 class="text-3xl font-bold mb-4">{{ t('main_heading') }}</h1>
            <p class="mb-4">
              {{ t('description_text') }}
            </p>
          </div>
          <div class="col-span-12 md:col-span-4">
            <NuxtLink :to="'/archive/engines'" :title="t('engine_sizes_card.link_title')" class="block">
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
                          :alt="t('engine_sizes_card.alt_text')"
                          class="w-full h-full object-contain"
                        />
                      </picture>
                    </figure>
                  </div>
                  <div>
                    <h2 class="text-xl font-semibold">
                      {{ t('engine_sizes_card.heading') }}
                    </h2>
                    <p class="mt-1">{{ t('engine_sizes_card.description') }}</p>
                  </div>
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </div>
      </div>
      <div class="col-span-12">
        <CalculatorsCompression />
      </div>
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator :label="t('ui.more_section')" />
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
    "title": "Compression Ratio Calculator for Classic Mini Engines | Classic Mini DIY",
    "description": "Calculate the compression ratio for your Classic Mini engine build with our interactive calculator. Plan your engine modifications with precision using this easy-to-use tool.",
    "keywords": "compression ratio, Classic Mini engine, engine build, compression calculator, Mini Cooper engine, piston dish, head volume",
    "hero_title": "Compression Ratio Calculator",
    "breadcrumb_title": "Compression Ratio Calculator",
    "og_title": "Compression Ratio Calculator for Classic Mini Engines | Classic Mini DIY",
    "og_description": "Calculate the compression ratio for your Classic Mini engine build with our interactive calculator. Plan your engine modifications with precision.",
    "twitter_title": "Compression Ratio Calculator for Classic Mini Engines",
    "twitter_description": "Calculate the compression ratio for your Classic Mini engine build with our interactive calculator.",
    "main_heading": "Compression Ratio Calculator",
    "description_text": "When building a performance Classic Mini engine one of the most important figures to determine is the compression ratio. Using the Classic Mini DIY Compression Ratio Calculator below, you can determine the ideal compression for your new engine build.",
    "engine_sizes_card": {
      "link_title": "Link to Engine Sizes",
      "heading": "What are standard engine sizes?",
      "description": "Click here to learn about common engine sizes in the classic mini.",
      "alt_text": "Engine size table image preview"
    },
    "structured_data": {
      "calculator_name": "Classic Mini Compression Ratio Calculator",
      "calculator_description": "An interactive calculator to determine the compression ratio for Classic Mini engine builds based on various parameters like piston dish, head volume, bore, and stroke.",
      "how_to_name": "How to Calculate Compression Ratio for a Classic Mini Engine",
      "how_to_description": "Learn how to calculate the compression ratio for your Classic Mini engine build using our interactive calculator.",
      "steps": {
        "piston_dish": {
          "name": "Enter Piston Dish Value",
          "text": "Enter the piston dish value in cc."
        },
        "head_volume": {
          "name": "Enter Head Volume",
          "text": "Enter the head volume in cc."
        },
        "deck_height": {
          "name": "Enter Deck Height",
          "text": "Enter the deck height in inches."
        },
        "bore_stroke": {
          "name": "Enter Bore and Stroke",
          "text": "Enter the bore and stroke measurements in mm."
        },
        "gasket_thickness": {
          "name": "Enter Gasket Thickness",
          "text": "Select the gasket thickness or enter a custom value."
        },
        "view_results": {
          "name": "View Results",
          "text": "The calculator will automatically display the compression ratio and engine capacity."
        }
      }
    },
    "ui": {
      "more_section": "More"
    }
  },
  "es": {
    "title": "Calculadora de Relación de Compresión para Motores Classic Mini | Classic Mini DIY",
    "description": "Calcula la relación de compresión para la construcción de tu motor Classic Mini con nuestra calculadora interactiva. Planifica las modificaciones de tu motor con precisión usando esta herramienta fácil de usar.",
    "keywords": "relación de compresión, motor Classic Mini, construcción motor, calculadora compresión, motor Mini Cooper, plato pistón, volumen culata",
    "hero_title": "Calculadora de Relación de Compresión",
    "breadcrumb_title": "Calculadora de Relación de Compresión",
    "og_title": "Calculadora de Relación de Compresión para Motores Classic Mini | Classic Mini DIY",
    "og_description": "Calcula la relación de compresión para la construcción de tu motor Classic Mini con nuestra calculadora interactiva. Planifica las modificaciones de tu motor con precisión.",
    "twitter_title": "Calculadora de Relación de Compresión para Motores Classic Mini",
    "twitter_description": "Calcula la relación de compresión para la construcción de tu motor Classic Mini con nuestra calculadora interactiva.",
    "main_heading": "Calculadora de Relación de Compresión",
    "description_text": "Al construir un motor Classic Mini de rendimiento, una de las cifras más importantes a determinar es la relación de compresión. Usando la Calculadora de Relación de Compresión Classic Mini DIY a continuación, puedes determinar la compresión ideal para la construcción de tu nuevo motor.",
    "engine_sizes_card": {
      "link_title": "Enlace a Tamaños de Motor",
      "heading": "¿Cuáles son los tamaños estándar de motor?",
      "description": "Haz clic aquí para aprender sobre los tamaños comunes de motor en el classic mini.",
      "alt_text": "Vista previa de imagen de tabla de tamaños de motor"
    },
    "structured_data": {
      "calculator_name": "Calculadora de Relación de Compresión Classic Mini",
      "calculator_description": "Una calculadora interactiva para determinar la relación de compresión para construcciones de motor Classic Mini basada en varios parámetros como plato del pistón, volumen de culata, diámetro y carrera.",
      "how_to_name": "Cómo Calcular la Relación de Compresión para un Motor Classic Mini",
      "how_to_description": "Aprende cómo calcular la relación de compresión para la construcción de tu motor Classic Mini usando nuestra calculadora interactiva.",
      "steps": {
        "piston_dish": {
          "name": "Ingresar Valor del Plato del Pistón",
          "text": "Ingresa el valor del plato del pistón en cc."
        },
        "head_volume": {
          "name": "Ingresar Volumen de Culata",
          "text": "Ingresa el volumen de la culata en cc."
        },
        "deck_height": {
          "name": "Ingresar Altura de Cubierta",
          "text": "Ingresa la altura de la cubierta en pulgadas."
        },
        "bore_stroke": {
          "name": "Ingresar Diámetro y Carrera",
          "text": "Ingresa las medidas de diámetro y carrera en mm."
        },
        "gasket_thickness": {
          "name": "Ingresar Grosor de Junta",
          "text": "Selecciona el grosor de la junta o ingresa un valor personalizado."
        },
        "view_results": {
          "name": "Ver Resultados",
          "text": "La calculadora mostrará automáticamente la relación de compresión y la capacidad del motor."
        }
      }
    },
    "ui": {
      "more_section": "Más"
    }
  },
  "fr": {
    "title": "Calculateur de Taux de Compression pour Moteurs Classic Mini | Classic Mini DIY",
    "description": "Calculez le taux de compression pour votre construction de moteur Classic Mini avec notre calculateur interactif. Planifiez vos modifications de moteur avec précision en utilisant cet outil facile à utiliser.",
    "keywords": "taux de compression, moteur Classic Mini, construction moteur, calculateur compression, moteur Mini Cooper, cuvette piston, volume culasse",
    "hero_title": "Calculateur de Taux de Compression",
    "breadcrumb_title": "Calculateur de Taux de Compression",
    "og_title": "Calculateur de Taux de Compression pour Moteurs Classic Mini | Classic Mini DIY",
    "og_description": "Calculez le taux de compression pour votre construction de moteur Classic Mini avec notre calculateur interactif. Planifiez vos modifications de moteur avec précision.",
    "twitter_title": "Calculateur de Taux de Compression pour Moteurs Classic Mini",
    "twitter_description": "Calculez le taux de compression pour votre construction de moteur Classic Mini avec notre calculateur interactif.",
    "main_heading": "Calculateur de Taux de Compression",
    "description_text": "Lors de la construction d'un moteur Classic Mini de performance, l'un des chiffres les plus importants à déterminer est le taux de compression. En utilisant le Calculateur de Taux de Compression Classic Mini DIY ci-dessous, vous pouvez déterminer la compression idéale pour votre nouvelle construction de moteur.",
    "engine_sizes_card": {
      "link_title": "Lien vers les Tailles de Moteur",
      "heading": "Quelles sont les tailles de moteur standard ?",
      "description": "Cliquez ici pour en savoir plus sur les tailles de moteur communes dans la classic mini.",
      "alt_text": "Aperçu de l'image du tableau des tailles de moteur"
    },
    "structured_data": {
      "calculator_name": "Calculateur de Taux de Compression Classic Mini",
      "calculator_description": "Un calculateur interactif pour déterminer le taux de compression pour les constructions de moteur Classic Mini basé sur divers paramètres comme la cuvette du piston, le volume de culasse, l'alésage et la course.",
      "how_to_name": "Comment Calculer le Taux de Compression pour un Moteur Classic Mini",
      "how_to_description": "Apprenez comment calculer le taux de compression pour votre construction de moteur Classic Mini en utilisant notre calculateur interactif.",
      "steps": {
        "piston_dish": {
          "name": "Entrer la Valeur de la Cuvette du Piston",
          "text": "Entrez la valeur de la cuvette du piston en cc."
        },
        "head_volume": {
          "name": "Entrer le Volume de Culasse",
          "text": "Entrez le volume de la culasse en cc."
        },
        "deck_height": {
          "name": "Entrer la Hauteur de Pont",
          "text": "Entrez la hauteur de pont en pouces."
        },
        "bore_stroke": {
          "name": "Entrer l'Alésage et la Course",
          "text": "Entrez les mesures d'alésage et de course en mm."
        },
        "gasket_thickness": {
          "name": "Entrer l'Épaisseur du Joint",
          "text": "Sélectionnez l'épaisseur du joint ou entrez une valeur personnalisée."
        },
        "view_results": {
          "name": "Voir les Résultats",
          "text": "Le calculateur affichera automatiquement le taux de compression et la capacité du moteur."
        }
      }
    },
    "ui": {
      "more_section": "Plus"
    }
  },
  "it": {
    "title": "Calcolatore Rapporto di Compressione per Motori Classic Mini | Classic Mini DIY",
    "description": "Calcola il rapporto di compressione per la costruzione del tuo motore Classic Mini con il nostro calcolatore interattivo. Pianifica le modifiche del motore con precisione usando questo strumento facile da usare.",
    "keywords": "rapporto compressione, motore Classic Mini, costruzione motore, calcolatore compressione, motore Mini Cooper, piatto pistone, volume testata",
    "hero_title": "Calcolatore Rapporto di Compressione",
    "breadcrumb_title": "Calcolatore Rapporto di Compressione",
    "og_title": "Calcolatore Rapporto di Compressione per Motori Classic Mini | Classic Mini DIY",
    "og_description": "Calcola il rapporto di compressione per la costruzione del tuo motore Classic Mini con il nostro calcolatore interattivo. Pianifica le modifiche del motore con precisione.",
    "twitter_title": "Calcolatore Rapporto di Compressione per Motori Classic Mini",
    "twitter_description": "Calcola il rapporto di compressione per la costruzione del tuo motore Classic Mini con il nostro calcolatore interattivo.",
    "main_heading": "Calcolatore Rapporto di Compressione",
    "description_text": "Quando si costruisce un motore Classic Mini ad alte prestazioni, una delle cifre più importanti da determinare è il rapporto di compressione. Utilizzando il Calcolatore Rapporto di Compressione Classic Mini DIY qui sotto, puoi determinare la compressione ideale per la costruzione del tuo nuovo motore.",
    "engine_sizes_card": {
      "link_title": "Link alle Dimensioni Motore",
      "heading": "Quali sono le dimensioni standard del motore?",
      "description": "Clicca qui per saperne di più sulle dimensioni comuni del motore nella classic mini.",
      "alt_text": "Anteprima immagine tabella dimensioni motore"
    },
    "structured_data": {
      "calculator_name": "Calcolatore Rapporto di Compressione Classic Mini",
      "calculator_description": "Un calcolatore interattivo per determinare il rapporto di compressione per costruzioni motore Classic Mini basato su vari parametri come piatto pistone, volume testata, alesaggio e corsa.",
      "how_to_name": "Come Calcolare il Rapporto di Compressione per un Motore Classic Mini",
      "how_to_description": "Impara come calcolare il rapporto di compressione per la costruzione del tuo motore Classic Mini usando il nostro calcolatore interattivo.",
      "steps": {
        "piston_dish": {
          "name": "Inserire Valore Piatto Pistone",
          "text": "Inserisci il valore del piatto del pistone in cc."
        },
        "head_volume": {
          "name": "Inserire Volume Testata",
          "text": "Inserisci il volume della testata in cc."
        },
        "deck_height": {
          "name": "Inserire Altezza Piano",
          "text": "Inserisci l'altezza del piano in pollici."
        },
        "bore_stroke": {
          "name": "Inserire Alesaggio e Corsa",
          "text": "Inserisci le misure di alesaggio e corsa in mm."
        },
        "gasket_thickness": {
          "name": "Inserire Spessore Guarnizione",
          "text": "Seleziona lo spessore della guarnizione o inserisci un valore personalizzato."
        },
        "view_results": {
          "name": "Visualizza Risultati",
          "text": "Il calcolatore mostrerà automaticamente il rapporto di compressione e la capacità del motore."
        }
      }
    },
    "ui": {
      "more_section": "Altro"
    }
  },
  "de": {
    "title": "Verdichtungsverhältnis-Rechner für Classic Mini Motoren | Classic Mini DIY",
    "description": "Berechnen Sie das Verdichtungsverhältnis für Ihren Classic Mini Motoraufbau mit unserem interaktiven Rechner. Planen Sie Ihre Motormodifikationen präzise mit diesem benutzerfreundlichen Tool.",
    "keywords": "Verdichtungsverhältnis, Classic Mini Motor, Motoraufbau, Verdichtungsrechner, Mini Cooper Motor, Kolbenmulde, Kopfvolumen",
    "hero_title": "Verdichtungsverhältnis-Rechner",
    "breadcrumb_title": "Verdichtungsverhältnis-Rechner",
    "og_title": "Verdichtungsverhältnis-Rechner für Classic Mini Motoren | Classic Mini DIY",
    "og_description": "Berechnen Sie das Verdichtungsverhältnis für Ihren Classic Mini Motoraufbau mit unserem interaktiven Rechner. Planen Sie Ihre Motormodifikationen präzise.",
    "twitter_title": "Verdichtungsverhältnis-Rechner für Classic Mini Motoren",
    "twitter_description": "Berechnen Sie das Verdichtungsverhältnis für Ihren Classic Mini Motoraufbau mit unserem interaktiven Rechner.",
    "main_heading": "Verdichtungsverhältnis-Rechner",
    "description_text": "Beim Aufbau eines Leistungs-Classic Mini Motors ist eine der wichtigsten zu bestimmenden Zahlen das Verdichtungsverhältnis. Mit dem Classic Mini DIY Verdichtungsverhältnis-Rechner unten können Sie die ideale Verdichtung für Ihren neuen Motoraufbau bestimmen.",
    "engine_sizes_card": {
      "link_title": "Link zu Motorgrößen",
      "heading": "Was sind die Standard-Motorgrößen?",
      "description": "Klicken Sie hier, um mehr über die gängigen Motorgrößen im Classic Mini zu erfahren.",
      "alt_text": "Vorschaubild der Motorgrößen-Tabelle"
    },
    "structured_data": {
      "calculator_name": "Classic Mini Verdichtungsverhältnis-Rechner",
      "calculator_description": "Ein interaktiver Rechner zur Bestimmung des Verdichtungsverhältnisses für Classic Mini Motoraufbauten basierend auf verschiedenen Parametern wie Kolbenmulde, Kopfvolumen, Bohrung und Hub.",
      "how_to_name": "Wie man das Verdichtungsverhältnis für einen Classic Mini Motor berechnet",
      "how_to_description": "Lernen Sie, wie Sie das Verdichtungsverhältnis für Ihren Classic Mini Motoraufbau mit unserem interaktiven Rechner berechnen.",
      "steps": {
        "piston_dish": {
          "name": "Kolbenmulden-Wert eingeben",
          "text": "Geben Sie den Kolbenmulden-Wert in ccm ein."
        },
        "head_volume": {
          "name": "Kopfvolumen eingeben",
          "text": "Geben Sie das Kopfvolumen in ccm ein."
        },
        "deck_height": {
          "name": "Deckhöhe eingeben",
          "text": "Geben Sie die Deckhöhe in Zoll ein."
        },
        "bore_stroke": {
          "name": "Bohrung und Hub eingeben",
          "text": "Geben Sie die Bohrung und Hub-Maße in mm ein."
        },
        "gasket_thickness": {
          "name": "Dichtungsdicke eingeben",
          "text": "Wählen Sie die Dichtungsdicke oder geben Sie einen benutzerdefinierten Wert ein."
        },
        "view_results": {
          "name": "Ergebnisse anzeigen",
          "text": "Der Rechner zeigt automatisch das Verdichtungsverhältnis und die Motorkapazität an."
        }
      }
    },
    "ui": {
      "more_section": "Mehr"
    }
  },
  "pt": {
    "title": "Calculadora de Taxa de Compressão para Motores Classic Mini | Classic Mini DIY",
    "description": "Calcule a taxa de compressão para a construção do seu motor Classic Mini com nossa calculadora interativa. Planeje suas modificações de motor com precisão usando esta ferramenta fácil de usar.",
    "keywords": "taxa de compressão, motor Classic Mini, construção motor, calculadora compressão, motor Mini Cooper, prato pistão, volume cabeçote",
    "hero_title": "Calculadora de Taxa de Compressão",
    "breadcrumb_title": "Calculadora de Taxa de Compressão",
    "og_title": "Calculadora de Taxa de Compressão para Motores Classic Mini | Classic Mini DIY",
    "og_description": "Calcule a taxa de compressão para a construção do seu motor Classic Mini com nossa calculadora interativa. Planeje suas modificações de motor com precisão.",
    "twitter_title": "Calculadora de Taxa de Compressão para Motores Classic Mini",
    "twitter_description": "Calcule a taxa de compressão para a construção do seu motor Classic Mini com nossa calculadora interativa.",
    "main_heading": "Calculadora de Taxa de Compressão",
    "description_text": "Ao construir um motor Classic Mini de performance, um dos números mais importantes a determinar é a taxa de compressão. Usando a Calculadora de Taxa de Compressão Classic Mini DIY abaixo, você pode determinar a compressão ideal para a construção do seu novo motor.",
    "engine_sizes_card": {
      "link_title": "Link para Tamanhos de Motor",
      "heading": "Quais são os tamanhos padrão de motor?",
      "description": "Clique aqui para aprender sobre os tamanhos comuns de motor no classic mini.",
      "alt_text": "Visualização da imagem da tabela de tamanhos de motor"
    },
    "structured_data": {
      "calculator_name": "Calculadora de Taxa de Compressão Classic Mini",
      "calculator_description": "Uma calculadora interativa para determinar a taxa de compressão para construções de motor Classic Mini baseada em vários parâmetros como prato do pistão, volume do cabeçote, diâmetro e curso.",
      "how_to_name": "Como Calcular a Taxa de Compressão para um Motor Classic Mini",
      "how_to_description": "Aprenda como calcular a taxa de compressão para a construção do seu motor Classic Mini usando nossa calculadora interativa.",
      "steps": {
        "piston_dish": {
          "name": "Inserir Valor do Prato do Pistão",
          "text": "Insira o valor do prato do pistão em cc."
        },
        "head_volume": {
          "name": "Inserir Volume do Cabeçote",
          "text": "Insira o volume do cabeçote em cc."
        },
        "deck_height": {
          "name": "Inserir Altura do Deck",
          "text": "Insira a altura do deck em polegadas."
        },
        "bore_stroke": {
          "name": "Inserir Diâmetro e Curso",
          "text": "Insira as medidas de diâmetro e curso em mm."
        },
        "gasket_thickness": {
          "name": "Inserir Espessura da Junta",
          "text": "Selecione a espessura da junta ou insira um valor personalizado."
        },
        "view_results": {
          "name": "Ver Resultados",
          "text": "A calculadora mostrará automaticamente a taxa de compressão e a capacidade do motor."
        }
      }
    },
    "ui": {
      "more_section": "Mais"
    }
  },
  "ru": {
    "title": "Калькулятор Степени Сжатия для Двигателей Classic Mini | Classic Mini DIY",
    "description": "Рассчитайте степень сжатия для сборки вашего двигателя Classic Mini с помощью нашего интерактивного калькулятора. Планируйте модификации двигателя точно, используя этот простой в использовании инструмент.",
    "keywords": "степень сжатия, двигатель Classic Mini, сборка двигателя, калькулятор сжатия, двигатель Mini Cooper, тарелка поршня, объем головки",
    "hero_title": "Калькулятор Степени Сжатия",
    "breadcrumb_title": "Калькулятор Степени Сжатия",
    "og_title": "Калькулятор Степени Сжатия для Двигателей Classic Mini | Classic Mini DIY",
    "og_description": "Рассчитайте степень сжатия для сборки вашего двигателя Classic Mini с помощью нашего интерактивного калькулятора. Планируйте модификации двигателя точно.",
    "twitter_title": "Калькулятор Степени Сжатия для Двигателей Classic Mini",
    "twitter_description": "Рассчитайте степень сжатия для сборки вашего двигателя Classic Mini с помощью нашего интерактивного калькулятора.",
    "main_heading": "Калькулятор Степени Сжатия",
    "description_text": "При сборке производительного двигателя Classic Mini одним из самых важных показателей для определения является степень сжатия. Используя Калькулятор Степени Сжатия Classic Mini DIY ниже, вы можете определить идеальное сжатие для сборки вашего нового двигателя.",
    "engine_sizes_card": {
      "link_title": "Ссылка на Размеры Двигателей",
      "heading": "Каковы стандартные размеры двигателей?",
      "description": "Нажмите здесь, чтобы узнать о распространенных размерах двигателей в classic mini.",
      "alt_text": "Предварительный просмотр изображения таблицы размеров двигателей"
    },
    "structured_data": {
      "calculator_name": "Калькулятор Степени Сжатия Classic Mini",
      "calculator_description": "Интерактивный калькулятор для определения степени сжатия для сборок двигателей Classic Mini на основе различных параметров, таких как тарелка поршня, объем головки, диаметр цилиндра и ход поршня.",
      "how_to_name": "Как Рассчитать Степень Сжатия для Двигателя Classic Mini",
      "how_to_description": "Узнайте, как рассчитать степень сжатия для сборки вашего двигателя Classic Mini, используя наш интерактивный калькулятор.",
      "steps": {
        "piston_dish": {
          "name": "Ввести Значение Тарелки Поршня",
          "text": "Введите значение тарелки поршня в куб. см."
        },
        "head_volume": {
          "name": "Ввести Объем Головки",
          "text": "Введите объем головки в куб. см."
        },
        "deck_height": {
          "name": "Ввести Высоту Деки",
          "text": "Введите высоту деки в дюймах."
        },
        "bore_stroke": {
          "name": "Ввести Диаметр и Ход",
          "text": "Введите размеры диаметра и хода в мм."
        },
        "gasket_thickness": {
          "name": "Ввести Толщину Прокладки",
          "text": "Выберите толщину прокладки или введите пользовательское значение."
        },
        "view_results": {
          "name": "Просмотреть Результаты",
          "text": "Калькулятор автоматически отобразит степень сжатия и объем двигателя."
        }
      }
    },
    "ui": {
      "more_section": "Больше"
    }
  },
  "ja": {
    "title": "クラシックミニエンジン用圧縮比計算機 | Classic Mini DIY",
    "description": "インタラクティブな計算機でクラシックミニエンジンビルドの圧縮比を計算します。この使いやすいツールで正確にエンジン改造を計画しましょう。",
    "keywords": "圧縮比, クラシックミニエンジン, エンジンビルド, 圧縮計算機, ミニクーパーエンジン, ピストンディッシュ, ヘッドボリューム",
    "hero_title": "圧縮比計算機",
    "breadcrumb_title": "圧縮比計算機",
    "og_title": "クラシックミニエンジン用圧縮比計算機 | Classic Mini DIY",
    "og_description": "インタラクティブな計算機でクラシックミニエンジンビルドの圧縮比を計算します。正確にエンジン改造を計画しましょう。",
    "twitter_title": "クラシックミニエンジン用圧縮比計算機",
    "twitter_description": "インタラクティブな計算機でクラシックミニエンジンビルドの圧縮比を計算します。",
    "main_heading": "圧縮比計算機",
    "description_text": "パフォーマンス向けクラシックミニエンジンを構築する際、決定すべき最も重要な数値の一つが圧縮比です。下記のクラシックミニDIY圧縮比計算機を使用して、新しいエンジンビルドに最適な圧縮比を決定できます。",
    "engine_sizes_card": {
      "link_title": "エンジンサイズへのリンク",
      "heading": "標準的なエンジンサイズは何ですか？",
      "description": "クラシックミニの一般的なエンジンサイズについて学ぶにはここをクリック。",
      "alt_text": "エンジンサイズ表の画像プレビュー"
    },
    "structured_data": {
      "calculator_name": "クラシックミニ圧縮比計算機",
      "calculator_description": "ピストンディッシュ、ヘッドボリューム、ボア、ストロークなどの様々なパラメータに基づいてクラシックミニエンジンビルドの圧縮比を決定するインタラクティブ計算機。",
      "how_to_name": "クラシックミニエンジンの圧縮比を計算する方法",
      "how_to_description": "インタラクティブ計算機を使用してクラシックミニエンジンビルドの圧縮比を計算する方法を学びます。",
      "steps": {
        "piston_dish": {
          "name": "ピストンディッシュ値を入力",
          "text": "ピストンディッシュの値をccで入力します。"
        },
        "head_volume": {
          "name": "ヘッドボリュームを入力",
          "text": "ヘッドのボリュームをccで入力します。"
        },
        "deck_height": {
          "name": "デッキハイトを入力",
          "text": "デッキハイトをインチで入力します。"
        },
        "bore_stroke": {
          "name": "ボアとストロークを入力",
          "text": "ボアとストロークの寸法をmmで入力します。"
        },
        "gasket_thickness": {
          "name": "ガスケット厚を入力",
          "text": "ガスケットの厚さを選択するか、カスタム値を入力します。"
        },
        "view_results": {
          "name": "結果を表示",
          "text": "計算機が自動的に圧縮比とエンジン容量を表示します。"
        }
      }
    },
    "ui": {
      "more_section": "その他"
    }
  },
  "zh": {
    "title": "经典迷你发动机压缩比计算器 | Classic Mini DIY",
    "description": "使用我们的交互式计算器计算您的经典迷你发动机构建的压缩比。使用这个易于使用的工具精确规划您的发动机改装。",
    "keywords": "压缩比, 经典迷你发动机, 发动机构建, 压缩计算器, 迷你库珀发动机, 活塞盘, 缸盖容积",
    "hero_title": "压缩比计算器",
    "breadcrumb_title": "压缩比计算器",
    "og_title": "经典迷你发动机压缩比计算器 | Classic Mini DIY",
    "og_description": "使用我们的交互式计算器计算您的经典迷你发动机构建的压缩比。精确规划您的发动机改装。",
    "twitter_title": "经典迷你发动机压缩比计算器",
    "twitter_description": "使用我们的交互式计算器计算您的经典迷你发动机构建的压缩比。",
    "main_heading": "压缩比计算器",
    "description_text": "在构建高性能经典迷你发动机时，需要确定的最重要数字之一是压缩比。使用下面的经典迷你DIY压缩比计算器，您可以确定新发动机构建的理想压缩比。",
    "engine_sizes_card": {
      "link_title": "发动机尺寸链接",
      "heading": "标准发动机尺寸是什么？",
      "description": "点击这里了解经典迷你中常见的发动机尺寸。",
      "alt_text": "发动机尺寸表图像预览"
    },
    "structured_data": {
      "calculator_name": "经典迷你压缩比计算器",
      "calculator_description": "基于活塞盘、缸盖容积、缸径和行程等各种参数确定经典迷你发动机构建压缩比的交互式计算器。",
      "how_to_name": "如何计算经典迷你发动机的压缩比",
      "how_to_description": "学习如何使用我们的交互式计算器计算您的经典迷你发动机构建的压缩比。",
      "steps": {
        "piston_dish": {
          "name": "输入活塞盘值",
          "text": "以cc为单位输入活塞盘值。"
        },
        "head_volume": {
          "name": "输入缸盖容积",
          "text": "以cc为单位输入缸盖容积。"
        },
        "deck_height": {
          "name": "输入甲板高度",
          "text": "以英寸为单位输入甲板高度。"
        },
        "bore_stroke": {
          "name": "输入缸径和行程",
          "text": "以mm为单位输入缸径和行程尺寸。"
        },
        "gasket_thickness": {
          "name": "输入垫片厚度",
          "text": "选择垫片厚度或输入自定义值。"
        },
        "view_results": {
          "name": "查看结果",
          "text": "计算器将自动显示压缩比和发动机容量。"
        }
      }
    },
    "ui": {
      "more_section": "更多"
    }
  },
  "ko": {
    "title": "클래식 미니 엔진용 압축비 계산기 | Classic Mini DIY",
    "description": "인터랙티브 계산기로 클래식 미니 엔진 빌드의 압축비를 계산하세요. 이 사용하기 쉬운 도구로 엔진 개조를 정확하게 계획하세요.",
    "keywords": "압축비, 클래식 미니 엔진, 엔진 빌드, 압축 계산기, 미니 쿠퍼 엔진, 피스톤 디시, 헤드 볼륨",
    "hero_title": "압축비 계산기",
    "breadcrumb_title": "압축비 계산기",
    "og_title": "클래식 미니 엔진용 압축비 계산기 | Classic Mini DIY",
    "og_description": "인터랙티브 계산기로 클래식 미니 엔진 빌드의 압축비를 계산하세요. 엔진 개조를 정확하게 계획하세요.",
    "twitter_title": "클래식 미니 엔진용 압축비 계산기",
    "twitter_description": "인터랙티브 계산기로 클래식 미니 엔진 빌드의 압축비를 계산하세요.",
    "main_heading": "압축비 계산기",
    "description_text": "고성능 클래식 미니 엔진을 구축할 때 결정해야 할 가장 중요한 수치 중 하나는 압축비입니다. 아래의 클래식 미니 DIY 압축비 계산기를 사용하여 새로운 엔진 빌드에 이상적인 압축비를 결정할 수 있습니다.",
    "engine_sizes_card": {
      "link_title": "엔진 크기 링크",
      "heading": "표준 엔진 크기는 무엇입니까?",
      "description": "클래식 미니의 일반적인 엔진 크기에 대해 알아보려면 여기를 클릭하세요.",
      "alt_text": "엔진 크기 표 이미지 미리보기"
    },
    "structured_data": {
      "calculator_name": "클래식 미니 압축비 계산기",
      "calculator_description": "피스톤 디시, 헤드 볼륨, 보어, 스트로크 등 다양한 매개변수를 기반으로 클래식 미니 엔진 빌드의 압축비를 결정하는 인터랙티브 계산기.",
      "how_to_name": "클래식 미니 엔진의 압축비를 계산하는 방법",
      "how_to_description": "인터랙티브 계산기를 사용하여 클래식 미니 엔진 빌드의 압축비를 계산하는 방법을 배우세요.",
      "steps": {
        "piston_dish": {
          "name": "피스톤 디시 값 입력",
          "text": "피스톤 디시 값을 cc로 입력하세요."
        },
        "head_volume": {
          "name": "헤드 볼륨 입력",
          "text": "헤드 볼륨을 cc로 입력하세요."
        },
        "deck_height": {
          "name": "데크 높이 입력",
          "text": "데크 높이를 인치로 입력하세요."
        },
        "bore_stroke": {
          "name": "보어와 스트로크 입력",
          "text": "보어와 스트로크 치수를 mm로 입력하세요."
        },
        "gasket_thickness": {
          "name": "가스켓 두께 입력",
          "text": "가스켓 두께를 선택하거나 사용자 정의 값을 입력하세요."
        },
        "view_results": {
          "name": "결과 보기",
          "text": "계산기가 자동으로 압축비와 엔진 용량을 표시합니다."
        }
      }
    },
    "ui": {
      "more_section": "더보기"
    }
  }
}
</i18n>
