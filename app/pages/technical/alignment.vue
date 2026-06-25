<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const isCalculatorLoaded = ref(false);

  useHead({
    title: t('title'),
    meta: [
      { key: 'description', name: 'description', content: t('description') },
      { key: 'keywords', name: 'keywords', content: t('keywords') },
    ],
    link: [
      { rel: 'canonical', href: 'https://www.classicminidiy.com/technical/alignment' },
      { rel: 'preconnect', href: 'https://classicminidiy.s3.amazonaws.com' },
    ],
  });

  const calculatorJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('structured_data.calculator_name'),
    applicationCategory: 'AutomotiveApplication',
    operatingSystem: 'Web Browser',
    description: t('structured_data.calculator_description'),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('structured_data.how_to_name'),
    description: t('structured_data.how_to_description'),
    step: [
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.preset.name'),
        text: t('structured_data.steps.preset.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.adjust.name'),
        text: t('structured_data.steps.adjust.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.visualize.name'),
        text: t('structured_data.steps.visualize.text'),
      },
      {
        '@type': 'HowToStep',
        name: t('structured_data.steps.save.name'),
        text: t('structured_data.steps.save.text'),
      },
    ],
  };

  useHead({
    script: [
      { type: 'application/ld+json', innerHTML: JSON.stringify(calculatorJsonLd) },
      { type: 'application/ld+json', innerHTML: JSON.stringify(howToJsonLd) },
    ],
  });

  useSeoMeta({
    ogTitle: t('og_title'),
    ogDescription: t('og_description'),
    ogUrl: 'https://www.classicminidiy.com/technical/alignment',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitter_title'),
    twitterDescription: t('twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical.png',
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.TECH" />
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <breadcrumb class="my-6" :version="BREADCRUMB_VERSIONS.TECH" :page="t('breadcrumb_title')"></breadcrumb>
        <PageIntro :eyebrow="t('eyebrow')" :title="t('main_heading')" :description="t('description_text')" as="h2" />
      </div>
      <div class="col-span-12">
        <ClientOnly>
          <div class="min-h-96 flex items-center justify-center" v-if="!isCalculatorLoaded">
            <div class="flex flex-col items-center space-y-4">
              <span class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></span>
              <p class="opacity-70">{{ t('ui.loading_text') }}</p>
            </div>
          </div>
          <LazyCalculatorsAlignment @vue:mounted="isCalculatorLoaded = true" />
          <template #fallback>
            <div class="min-h-96 flex items-center justify-center">
              <div class="flex flex-col items-center space-y-4">
                <span class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></span>
                <p class="opacity-70">{{ t('ui.loading_text') }}</p>
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <div class="divider">{{ t('support_section') }}</div>
        <patreon-card size="large" />
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Tech - Alignment Calculator",
    "description": "Set up and visualize your Classic Mini's wheel alignment — camber, caster, and toe — with a live top-down diagram, research-derived presets, and saveable setups.",
    "keywords": "Classic Mini alignment, camber, caster, toe, wheel alignment calculator, Mini suspension geometry, fast road alignment, track alignment, negative camber",
    "hero_title": "Alignment Calculator",
    "breadcrumb_title": "Alignment Calculator",
    "og_title": "Classic Mini Alignment Calculator",
    "og_description": "Dial in camber, caster, and toe with a live top-down diagram and proven presets — from factory through performance and track to boosted. Save your setups and keep a driving journal.",
    "twitter_title": "Classic Mini Alignment Calculator",
    "twitter_description": "Dial in camber, caster, and toe with a live diagram and proven presets. Save your setups and keep a driving journal.",
    "main_heading": "Alignment Calculator",
    "description_text": "Visualize and plan your Classic Mini's wheel alignment in real time. Start from a preset (factory, stock road, performance, track, or boosted), fine-tune camber, caster, and toe, and watch the top-down diagram update live. Sign in to save setups and keep a dated driving journal for each one.",
    "eyebrow": "CALCULATOR",
    "support_section": "Support",
    "ui": {
      "loading_text": "Loading alignment calculator..."
    },
    "structured_data": {
      "calculator_name": "Classic Mini Alignment Calculator",
      "calculator_description": "An interactive tool to set up and visualize Classic Mini wheel alignment (camber, caster, toe) with presets and saveable configurations.",
      "how_to_name": "How to Set Up Classic Mini Wheel Alignment",
      "how_to_description": "Use presets and a live diagram to plan camber, caster, and toe for a Classic Mini.",
      "steps": {
        "preset": {
          "name": "Pick a preset",
          "text": "Choose a starting point — factory, stock road, performance, track, or boosted."
        },
        "adjust": {
          "name": "Adjust the angles",
          "text": "Fine-tune front and rear camber, caster, and toe with the sliders."
        },
        "visualize": {
          "name": "Read the diagram",
          "text": "Watch the top-down and elevation views update live as you change settings."
        },
        "save": {
          "name": "Save your setup",
          "text": "Sign in to save the configuration and keep a dated driving journal."
        }
      }
    }
  },
  "es": {
    "title": "Técnica - Calculadora de alineación",
    "description": "Configura y visualiza la alineación de las ruedas de tu Classic Mini — caída, avance y convergencia — con un diagrama cenital en vivo, preajustes basados en investigación y configuraciones que puedes guardar.",
    "keywords": "alineación Classic Mini, caída, avance, convergencia, calculadora de alineación de ruedas, geometría de suspensión Mini, alineación de carretera rápida, alineación de circuito, caída negativa",
    "hero_title": "Calculadora de alineación",
    "breadcrumb_title": "Calculadora de alineación",
    "og_title": "Calculadora de alineación Classic Mini",
    "twitter_title": "Calculadora de alineación Classic Mini",
    "twitter_description": "Ajusta caída, avance y convergencia con un diagrama en vivo y preajustes probados. Guarda tus configuraciones y mantén un diario de conducción.",
    "main_heading": "Calculadora de alineación",
    "eyebrow": "CALCULADORA",
    "support_section": "Apoyo",
    "ui": {
      "loading_text": "Cargando calculadora de alineación..."
    },
    "structured_data": {
      "calculator_name": "Calculadora de alineación Classic Mini",
      "calculator_description": "Una herramienta interactiva para configurar y visualizar la alineación de las ruedas del Classic Mini (caída, avance, convergencia) con preajustes y configuraciones que se pueden guardar.",
      "how_to_name": "Cómo configurar la alineación de las ruedas del Classic Mini",
      "how_to_description": "Usa preajustes y un diagrama en vivo para planificar la caída, el avance y la convergencia de un Classic Mini.",
      "steps": {
        "preset": {
          "name": "Elige un preajuste",
          "text": "Elige un punto de partida: de fábrica, calle de serie, deportivo, circuito o sobrealimentado."
        },
        "adjust": {
          "name": "Ajusta los ángulos",
          "text": "Ajusta con precisión la caída, el avance y la convergencia delanteras y traseras con los controles deslizantes."
        },
        "visualize": {
          "name": "Lee el diagrama",
          "text": "Observa cómo las vistas cenital y de alzado se actualizan en vivo a medida que cambias los ajustes."
        },
        "save": {
          "name": "Guarda tu configuración",
          "text": "Inicia sesión para guardar la configuración y mantener un diario de conducción fechado."
        }
      }
    },
    "description_text": "Visualiza y planifica la alineación de las ruedas de tu Classic Mini en tiempo real. Parte de un reglaje predefinido (de fábrica, calle de serie, deportivo, circuito o sobrealimentado), ajusta con precisión la caída, el avance y la convergencia, y observa cómo el diagrama en planta se actualiza en vivo. Inicia sesión para guardar reglajes y llevar un diario de conducción fechado para cada uno.",
    "og_description": "Afina la caída, el avance y la convergencia con un diagrama en planta en vivo y reglajes predefinidos probados: desde el de fábrica, pasando por deportivo y circuito, hasta sobrealimentado. Guarda tus reglajes y lleva un diario de conducción."
  },
  "fr": {
    "title": "Tech - Calculateur de géométrie",
    "description": "Configurez et visualisez la géométrie des roues de votre Classic Mini — carrossage, chasse et parallélisme — avec un schéma en vue de dessus en direct, des préréglages issus de recherches et des réglages enregistrables.",
    "keywords": "géométrie Classic Mini, carrossage, chasse, parallélisme, calculateur de géométrie des roues, géométrie de suspension Mini, géométrie route sportive, géométrie circuit, carrossage négatif",
    "hero_title": "Calculateur de géométrie",
    "breadcrumb_title": "Calculateur de géométrie",
    "og_title": "Calculateur de géométrie Classic Mini",
    "twitter_title": "Calculateur de géométrie Classic Mini",
    "twitter_description": "Réglez carrossage, chasse et parallélisme avec un schéma en direct et des préréglages éprouvés. Enregistrez vos réglages et tenez un journal de conduite.",
    "main_heading": "Calculateur de géométrie",
    "eyebrow": "CALCULATEUR",
    "support_section": "Soutien",
    "ui": {
      "loading_text": "Chargement du calculateur de géométrie..."
    },
    "structured_data": {
      "calculator_name": "Calculateur de géométrie Classic Mini",
      "calculator_description": "Un outil interactif pour configurer et visualiser la géométrie des roues d'une Classic Mini (carrossage, chasse, parallélisme) avec des préréglages et des configurations enregistrables.",
      "how_to_name": "Comment régler la géométrie des roues d'une Classic Mini",
      "how_to_description": "Utilisez des préréglages et un schéma en direct pour planifier carrossage, chasse et parallélisme d'une Classic Mini.",
      "steps": {
        "preset": {
          "name": "Choisissez un préréglage",
          "text": "Choisissez un point de départ — origine, route d'origine, sport, circuit ou suralimenté."
        },
        "adjust": {
          "name": "Ajustez les angles",
          "text": "Affinez carrossage, chasse et parallélisme avant et arrière avec les curseurs."
        },
        "visualize": {
          "name": "Lisez le schéma",
          "text": "Regardez les vues de dessus et de face se mettre à jour en direct à mesure que vous modifiez les réglages."
        },
        "save": {
          "name": "Enregistrez votre réglage",
          "text": "Connectez-vous pour enregistrer la configuration et tenir un journal de conduite daté."
        }
      }
    },
    "description_text": "Visualisez et planifiez la géométrie des roues de votre Classic Mini en temps réel. Partez d'un préréglage (origine, route d'origine, sport, circuit ou suralimenté), ajustez finement le carrossage, la chasse et le parallélisme, et regardez le schéma vu de dessus se mettre à jour en direct. Connectez-vous pour enregistrer vos réglages et tenir un journal de conduite daté pour chacun.",
    "og_description": "Réglez le carrossage, la chasse et le parallélisme avec un schéma vu de dessus en direct et des préréglages éprouvés — de l'origine au sport et au circuit en passant par le suralimenté. Enregistrez vos réglages et tenez un journal de conduite."
  },
  "de": {
    "title": "Technik - Achsvermessungsrechner",
    "description": "Richte die Achseinstellung deines Classic Mini ein und visualisiere sie — Sturz, Nachlauf und Spur — mit einer Live-Draufsicht, recherchierten Voreinstellungen und speicherbaren Setups.",
    "keywords": "Classic Mini Achsvermessung, Sturz, Nachlauf, Spur, Achsvermessungsrechner, Mini Fahrwerksgeometrie, Achseinstellung schnelle Straße, Achseinstellung Rennstrecke, negativer Sturz",
    "hero_title": "Achsvermessungsrechner",
    "breadcrumb_title": "Achsvermessungsrechner",
    "og_title": "Classic Mini Achsvermessungsrechner",
    "twitter_title": "Classic Mini Achsvermessungsrechner",
    "twitter_description": "Stelle Sturz, Nachlauf und Spur mit einem Live-Diagramm und bewährten Voreinstellungen ein. Speichere deine Setups und führe ein Fahrtenjournal.",
    "main_heading": "Achsvermessungsrechner",
    "eyebrow": "RECHNER",
    "support_section": "Unterstützung",
    "ui": {
      "loading_text": "Achsvermessungsrechner wird geladen..."
    },
    "structured_data": {
      "calculator_name": "Classic Mini Achsvermessungsrechner",
      "calculator_description": "Ein interaktives Werkzeug, um die Achseinstellung eines Classic Mini (Sturz, Nachlauf, Spur) einzurichten und zu visualisieren, mit Voreinstellungen und speicherbaren Konfigurationen.",
      "how_to_name": "So richtest du die Achseinstellung eines Classic Mini ein",
      "how_to_description": "Nutze Voreinstellungen und ein Live-Diagramm, um Sturz, Nachlauf und Spur für einen Classic Mini zu planen.",
      "steps": {
        "preset": {
          "name": "Eine Voreinstellung wählen",
          "text": "Wähle einen Ausgangspunkt — Werkseinstellung, Serie Straße, Performance, Rennstrecke oder aufgeladen."
        },
        "adjust": {
          "name": "Die Winkel anpassen",
          "text": "Feine Sturz, Nachlauf und Spur vorne und hinten mit den Schiebereglern ab."
        },
        "visualize": {
          "name": "Das Diagramm ablesen",
          "text": "Beobachte, wie sich die Drauf- und Seitenansicht live aktualisieren, während du die Einstellungen änderst."
        },
        "save": {
          "name": "Dein Setup speichern",
          "text": "Melde dich an, um die Konfiguration zu speichern und ein datiertes Fahrtenjournal zu führen."
        }
      }
    },
    "description_text": "Visualisiere und plane die Achsvermessung deines Classic Mini in Echtzeit. Starte von einer Voreinstellung (Werkseinstellung, Serie Straße, Performance, Rennstrecke oder aufgeladen), justiere Sturz, Nachlauf und Spur fein und beobachte, wie sich das Draufsicht-Diagramm live aktualisiert. Melde dich an, um Setups zu speichern und für jedes ein datiertes Fahrtenbuch zu führen.",
    "og_description": "Stelle Sturz, Nachlauf und Spur mit einem Live-Draufsicht-Diagramm und bewährten Voreinstellungen ein — von Werkseinstellung über Performance und Rennstrecke bis aufgeladen. Speichere deine Setups und führe ein Fahrtenbuch."
  },
  "it": {
    "title": "Tech - Calcolatore di allineamento",
    "description": "Imposta e visualizza l'allineamento delle ruote della tua Classic Mini — campanatura, incidenza e convergenza — con un diagramma dall'alto in tempo reale, preset derivati da ricerche e configurazioni salvabili.",
    "keywords": "allineamento Classic Mini, campanatura, incidenza, convergenza, calcolatore allineamento ruote, geometria sospensioni Mini, allineamento strada sportiva, allineamento pista, campanatura negativa",
    "hero_title": "Calcolatore di allineamento",
    "breadcrumb_title": "Calcolatore di allineamento",
    "og_title": "Calcolatore di allineamento Classic Mini",
    "twitter_title": "Calcolatore di allineamento Classic Mini",
    "twitter_description": "Regola campanatura, incidenza e convergenza con un diagramma in tempo reale e preset collaudati. Salva le tue configurazioni e tieni un diario di guida.",
    "main_heading": "Calcolatore di allineamento",
    "eyebrow": "CALCOLATORE",
    "support_section": "Supporto",
    "ui": {
      "loading_text": "Caricamento del calcolatore di allineamento..."
    },
    "structured_data": {
      "calculator_name": "Calcolatore di allineamento Classic Mini",
      "calculator_description": "Uno strumento interattivo per impostare e visualizzare l'allineamento delle ruote della Classic Mini (campanatura, incidenza, convergenza) con preset e configurazioni salvabili.",
      "how_to_name": "Come impostare l'allineamento delle ruote della Classic Mini",
      "how_to_description": "Usa preset e un diagramma in tempo reale per pianificare campanatura, incidenza e convergenza di una Classic Mini.",
      "steps": {
        "preset": {
          "name": "Scegli un preset",
          "text": "Scegli un punto di partenza — originale, strada standard, sportivo, pista o sovralimentato."
        },
        "adjust": {
          "name": "Regola gli angoli",
          "text": "Affina campanatura, incidenza e convergenza anteriori e posteriori con i cursori."
        },
        "visualize": {
          "name": "Leggi il diagramma",
          "text": "Guarda le viste dall'alto e in elevazione aggiornarsi dal vivo mentre modifichi le impostazioni."
        },
        "save": {
          "name": "Salva la tua configurazione",
          "text": "Accedi per salvare la configurazione e tenere un diario di guida datato."
        }
      }
    },
    "description_text": "Visualizza e pianifica l'assetto delle ruote della tua Classic Mini in tempo reale. Parti da un preset (originale, strada standard, sportivo, pista o sovralimentato), regola con precisione campanatura, incidenza e convergenza, e guarda lo schema dall'alto aggiornarsi dal vivo. Accedi per salvare gli assetti e tenere un diario di guida datato per ciascuno.",
    "og_description": "Metti a punto campanatura, incidenza e convergenza con uno schema dall'alto dal vivo e preset collaudati — dall'originale allo sportivo e alla pista fino al sovralimentato. Salva i tuoi assetti e tieni un diario di guida."
  },
  "pt": {
    "title": "Técnico - Calculadora de Alinhamento",
    "description": "Configure e visualize o alinhamento das rodas do seu Classic Mini — cambagem, cáster e convergência — com um diagrama de cima ao vivo, predefinições derivadas de pesquisa e configurações guardáveis.",
    "keywords": "alinhamento Classic Mini, cambagem, cáster, convergência, calculadora de alinhamento de rodas, geometria de suspensão Mini, alinhamento estrada rápida, alinhamento de pista, cambagem negativa",
    "hero_title": "Calculadora de Alinhamento",
    "breadcrumb_title": "Calculadora de Alinhamento",
    "og_title": "Calculadora de Alinhamento do Classic Mini",
    "twitter_title": "Calculadora de Alinhamento do Classic Mini",
    "twitter_description": "Acerte a cambagem, o cáster e a convergência com um diagrama ao vivo e predefinições comprovadas. Guarde as suas configurações e mantenha um diário de condução.",
    "main_heading": "Calculadora de Alinhamento",
    "eyebrow": "CALCULADORA",
    "support_section": "Apoio",
    "ui": {
      "loading_text": "A carregar a calculadora de alinhamento..."
    },
    "structured_data": {
      "calculator_name": "Calculadora de Alinhamento do Classic Mini",
      "calculator_description": "Uma ferramenta interativa para configurar e visualizar o alinhamento das rodas do Classic Mini (cambagem, cáster, convergência) com predefinições e configurações guardáveis.",
      "how_to_name": "Como Configurar o Alinhamento das Rodas do Classic Mini",
      "how_to_description": "Use predefinições e um diagrama ao vivo para planear a cambagem, o cáster e a convergência de um Classic Mini.",
      "steps": {
        "preset": {
          "name": "Escolha uma predefinição",
          "text": "Escolha um ponto de partida — fábrica, estrada original, desportivo, pista ou turbo."
        },
        "adjust": {
          "name": "Ajuste os ângulos",
          "text": "Afine a cambagem, o cáster e a convergência dianteiros e traseiros com os controlos deslizantes."
        },
        "visualize": {
          "name": "Leia o diagrama",
          "text": "Veja as vistas de cima e de elevação atualizarem-se ao vivo à medida que altera as definições."
        },
        "save": {
          "name": "Guarde a sua configuração",
          "text": "Inicie sessão para guardar a configuração e manter um diário de condução datado."
        }
      }
    },
    "description_text": "Visualize e planeie o alinhamento das rodas do seu Classic Mini em tempo real. Comece a partir de uma predefinição (fábrica, estrada original, desportivo, pista ou turbo), afine a caída, o avance e a convergência, e veja o diagrama de vista superior atualizar-se ao vivo. Inicie sessão para guardar configurações e manter um diário de condução datado para cada uma.",
    "og_description": "Acerte a caída, o avance e a convergência com um diagrama de vista superior ao vivo e predefinições comprovadas — de fábrica, passando por desportivo e pista, até turbo. Guarde as suas configurações e mantenha um diário de condução."
  },
  "ru": {
    "title": "Техника — Калькулятор развал-схождения",
    "description": "Настройте и визуализируйте развал-схождение вашего Classic Mini — развал, кастер и схождение — с живой схемой вида сверху, пресетами на основе исследований и сохраняемыми настройками.",
    "keywords": "развал-схождение Classic Mini, развал, кастер, схождение, калькулятор развал-схождения, геометрия подвески Mini, настройка для спорт-дороги, настройка для трека, отрицательный развал",
    "hero_title": "Калькулятор развал-схождения",
    "breadcrumb_title": "Калькулятор развал-схождения",
    "og_title": "Калькулятор развал-схождения Classic Mini",
    "twitter_title": "Калькулятор развал-схождения Classic Mini",
    "twitter_description": "Настройте развал, кастер и схождение с живой схемой и проверенными пресетами. Сохраняйте свои настройки и ведите журнал поездок.",
    "main_heading": "Калькулятор развал-схождения",
    "eyebrow": "КАЛЬКУЛЯТОР",
    "support_section": "Поддержка",
    "ui": {
      "loading_text": "Загрузка калькулятора развал-схождения..."
    },
    "structured_data": {
      "calculator_name": "Калькулятор развал-схождения Classic Mini",
      "calculator_description": "Интерактивный инструмент для настройки и визуализации развал-схождения Classic Mini (развал, кастер, схождение) с пресетами и сохраняемыми конфигурациями.",
      "how_to_name": "Как настроить развал-схождение колёс Classic Mini",
      "how_to_description": "Используйте пресеты и живую схему, чтобы спланировать развал, кастер и схождение для Classic Mini.",
      "steps": {
        "preset": {
          "name": "Выберите пресет",
          "text": "Выберите отправную точку — заводская, сток дорога, спорт, трек или наддувная."
        },
        "adjust": {
          "name": "Отрегулируйте углы",
          "text": "Точно подстройте передний и задний развал, кастер и схождение ползунками."
        },
        "visualize": {
          "name": "Читайте схему",
          "text": "Наблюдайте, как виды сверху и сбоку обновляются вживую по мере изменения настроек."
        },
        "save": {
          "name": "Сохраните свою настройку",
          "text": "Войдите, чтобы сохранить конфигурацию и вести датированный журнал поездок."
        }
      }
    },
    "description_text": "Визуализируйте и планируйте развал-схождение вашего Classic Mini в реальном времени. Начните с пресета (заводская, сток дорога, спорт, трек или наддувный), точно настройте развал, кастор и схождение и наблюдайте, как схема вида сверху обновляется вживую. Войдите, чтобы сохранять настройки и вести датированный журнал поездок для каждой из них.",
    "og_description": "Настройте развал, кастор и схождение с живой схемой вида сверху и проверенными пресетами — от заводской через спорт и трек до наддувной. Сохраняйте настройки и ведите журнал поездок."
  },
  "ja": {
    "title": "テック - アライメント計算機",
    "description": "ライブの上面図、調査に基づくプリセット、保存可能なセットアップを使って、Classic Miniのホイールアライメント（キャンバー、キャスター、トー）を設定・可視化します。",
    "keywords": "Classic Mini アライメント, キャンバー, キャスター, トー, ホイールアライメント計算機, Mini サスペンションジオメトリー, ファストロードアライメント, トラックアライメント, ネガティブキャンバー",
    "hero_title": "アライメント計算機",
    "breadcrumb_title": "アライメント計算機",
    "og_title": "Classic Mini アライメント計算機",
    "twitter_title": "Classic Mini アライメント計算機",
    "twitter_description": "ライブ図と実証済みプリセットで、キャンバー、キャスター、トーを設定。セットアップを保存してドライビングジャーナルを記録できます。",
    "main_heading": "アライメント計算機",
    "eyebrow": "計算機",
    "support_section": "サポート",
    "ui": {
      "loading_text": "アライメント計算機を読み込み中..."
    },
    "structured_data": {
      "calculator_name": "Classic Mini アライメント計算機",
      "calculator_description": "プリセットと保存可能な設定を使って、Classic Miniのホイールアライメント（キャンバー、キャスター、トー）を設定・可視化するインタラクティブツール。",
      "how_to_name": "Classic Miniのホイールアライメントの設定方法",
      "how_to_description": "プリセットとライブ図を使って、Classic Miniのキャンバー、キャスター、トーを計画します。",
      "steps": {
        "preset": {
          "name": "プリセットを選ぶ",
          "text": "出発点を選びましょう――ファクトリー、ストックロード、パフォーマンス、トラック、または過給。"
        },
        "adjust": {
          "name": "角度を調整する",
          "text": "スライダーでフロントとリアのキャンバー、キャスター、トーを微調整します。"
        },
        "visualize": {
          "name": "図を読む",
          "text": "設定を変更すると、上面図と立面図がライブで更新される様子を確認できます。"
        },
        "save": {
          "name": "セットアップを保存する",
          "text": "サインインして設定を保存し、日付付きのドライビングジャーナルを記録します。"
        }
      }
    },
    "description_text": "Classic Miniのホイールアライメントをリアルタイムで可視化し、プランニングできます。プリセット（ファクトリー、ストックロード、パフォーマンス、トラック、過給）から始め、キャンバー・キャスター・トーを微調整しながら、上面図のダイアグラムがライブで更新される様子を確認できます。サインインすればセットアップを保存し、それぞれに日付付きのドライビングジャーナルを残せます。",
    "og_description": "ライブの上面図ダイアグラムと実証済みのプリセット――ファクトリーからパフォーマンス、トラック、そして過給まで――でキャンバー・キャスター・トーを追い込めます。セットアップを保存し、ドライビングジャーナルを残しましょう。"
  },
  "zh": {
    "title": "技术 - 四轮定位计算器",
    "description": "设置并可视化您的 Classic Mini 四轮定位——外倾角、主销后倾角和前束——配有实时俯视图、研究得出的预设以及可保存的设置。",
    "keywords": "Classic Mini 四轮定位, 外倾角, 主销后倾角, 前束, 四轮定位计算器, Mini 悬挂几何, 高性能街道定位, 赛道定位, 负外倾角",
    "hero_title": "四轮定位计算器",
    "breadcrumb_title": "四轮定位计算器",
    "og_title": "Classic Mini 四轮定位计算器",
    "twitter_title": "Classic Mini 四轮定位计算器",
    "twitter_description": "通过实时图示和成熟预设精准调校外倾角、主销后倾角和前束。保存您的设置并记录驾驶日志。",
    "main_heading": "四轮定位计算器",
    "eyebrow": "计算器",
    "support_section": "支持",
    "ui": {
      "loading_text": "正在加载四轮定位计算器..."
    },
    "structured_data": {
      "calculator_name": "Classic Mini 四轮定位计算器",
      "calculator_description": "一款用于设置和可视化 Classic Mini 四轮定位（外倾角、主销后倾角、前束）的交互式工具，配有预设和可保存的配置。",
      "how_to_name": "如何设置 Classic Mini 四轮定位",
      "how_to_description": "使用预设和实时图示来规划 Classic Mini 的外倾角、主销后倾角和前束。",
      "steps": {
        "preset": {
          "name": "选择预设",
          "text": "选择一个起点——原厂、街道原厂、运动、赛道或增压。"
        },
        "adjust": {
          "name": "调整角度",
          "text": "使用滑块微调前后轮的外倾角、主销后倾角和前束。"
        },
        "visualize": {
          "name": "查看图示",
          "text": "在更改设置时观看俯视图和立面图实时更新。"
        },
        "save": {
          "name": "保存您的设置",
          "text": "登录以保存配置并记录带日期的驾驶日志。"
        }
      }
    },
    "description_text": "实时可视化并规划你的 Classic Mini 四轮定位。从预设方案入手（原厂、街道原厂、运动、赛道或增压），微调外倾角、后倾角与前束，看着俯视示意图实时更新。登录即可保存设定，并为每套设定保留带日期的驾驶日志。",
    "og_description": "借助实时俯视示意图与久经验证的预设方案，精准调校外倾角、后倾角与前束——从原厂、运动、赛道到增压一应俱全。保存你的设定并记录驾驶日志。"
  },
  "ko": {
    "title": "기술 - 얼라인먼트 계산기",
    "description": "실시간 평면도, 연구 기반 프리셋, 저장 가능한 세팅으로 Classic Mini의 휠 얼라인먼트 — 캠버, 캐스터, 토 — 를 설정하고 시각화하세요.",
    "keywords": "Classic Mini 얼라인먼트, 캠버, 캐스터, 토, 휠 얼라인먼트 계산기, Mini 서스펜션 지오메트리, 패스트 로드 얼라인먼트, 트랙 얼라인먼트, 네거티브 캠버",
    "hero_title": "얼라인먼트 계산기",
    "breadcrumb_title": "얼라인먼트 계산기",
    "og_title": "Classic Mini 얼라인먼트 계산기",
    "twitter_title": "Classic Mini 얼라인먼트 계산기",
    "twitter_description": "실시간 다이어그램과 검증된 프리셋으로 캠버, 캐스터, 토를 세팅하세요. 세팅을 저장하고 주행 저널을 기록하세요.",
    "main_heading": "얼라인먼트 계산기",
    "eyebrow": "계산기",
    "support_section": "후원",
    "ui": {
      "loading_text": "얼라인먼트 계산기를 불러오는 중..."
    },
    "structured_data": {
      "calculator_name": "Classic Mini 얼라인먼트 계산기",
      "calculator_description": "프리셋과 저장 가능한 구성으로 Classic Mini 휠 얼라인먼트(캠버, 캐스터, 토)를 설정하고 시각화하는 인터랙티브 도구입니다.",
      "how_to_name": "Classic Mini 휠 얼라인먼트 세팅 방법",
      "how_to_description": "프리셋과 실시간 다이어그램을 사용해 Classic Mini의 캠버, 캐스터, 토를 계획하세요.",
      "steps": {
        "preset": {
          "name": "프리셋 선택",
          "text": "시작점을 선택하세요 — 공장 사양, 기본 도로, 퍼포먼스, 트랙, 부스트."
        },
        "adjust": {
          "name": "각도 조정",
          "text": "슬라이더로 앞뒤 캠버, 캐스터, 토를 미세 조정하세요."
        },
        "visualize": {
          "name": "다이어그램 확인",
          "text": "설정을 변경하면 평면도와 입면도가 실시간으로 갱신되는 모습을 확인하세요."
        },
        "save": {
          "name": "세팅 저장",
          "text": "로그인하여 구성을 저장하고 날짜가 기록된 주행 저널을 남기세요."
        }
      }
    },
    "description_text": "Classic Mini의 휠 얼라인먼트를 실시간으로 시각화하고 계획하세요. 프리셋(공장 사양, 기본 도로, 퍼포먼스, 트랙, 부스트)에서 시작해 캠버, 캐스터, 토를 미세 조정하고 위에서 본 도면이 실시간으로 갱신되는 모습을 확인하세요. 로그인하면 세팅을 저장하고 각 세팅마다 날짜별 주행 일지를 기록할 수 있습니다.",
    "og_description": "실시간 위에서 본 도면과 검증된 프리셋으로 캠버, 캐스터, 토를 세팅하세요 — 공장 사양부터 퍼포먼스와 트랙, 부스트까지. 세팅을 저장하고 주행 일지를 기록하세요."
  }
}
</i18n>
