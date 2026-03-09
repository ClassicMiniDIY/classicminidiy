<script lang="ts" setup>
  import { ToolboxItems, BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();

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
        href: 'https://classicminidiy.com/technical',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('ogTitle'),
    ogDescription: t('ogDescription'),
    ogUrl: 'https://classicminidiy.com/technical',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('twitterTitle'),
    twitterDescription: t('twitterDescription'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/technical.png',
  });

  // Add structured data for the technical toolbox collection
  const toolboxJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('structured_data.name'),
    description: t('structured_data.description'),
    url: 'https://classicminidiy.com/technical',
    itemListElement: ToolboxItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://classicminidiy.com${item.to}`,
      name: t(item.titleKey),
    })),
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(toolboxJsonLd),
      },
    ],
  });
</script>

<template>
  <hero
    :navigation="true"
    :title="t('hero_title')"
    textSize="text-3xl"
    :subtitle="t('hero_subtitle')"
    :heroType="HERO_TYPES.TECH"
  />
  <div class="container mx-auto px-4 pb-15 pt-6">
    <div class="grid grid-cols-1 gap-4">
      <div class="col-span-1 text-center">
        <breadcrumb :version="BREADCRUMB_VERSIONS.TECH" root></breadcrumb>
        <h2 class="fancy-font-book-oblique">{{ t('breadcrumb_subtitle') }}</h2>
        <h3 class="fancy-font-bold text-2xl">{{ t('main_heading') }}</h3>
      </div>
      <div class="col-span-1 text-center">
        <p class="text-lg py-5">
          {{ t('description_text') }}
        </p>
      </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-10">
      <div v-for="tool in ToolboxItems" :key="tool.to" class="col-span-1">
        <NuxtLink :to="tool.to" class="block h-full">
          <UCard class="text-center p-5 h-full hover:shadow-xl transition-shadow">
            <span class="text-4xl block" v-html="tool.iconHtml"> </span>
            <p class="text-lg mt-2">{{ t(tool.titleKey) }}</p>
          </UCard>
        </NuxtLink>
      </div>
    </div>
    <div class="grid grid-cols-12 gap-4 mt-6">
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <USeparator :label="t('support_section')" />
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
    "title": "Classic Mini Technical Toolbox | DIY Calculators & Specifications",
    "description": "Classic Mini technical tools and specifications for DIY mechanics. Access calculators, torque specs, needle charts, and more to maintain and upgrade your Mini.",
    "keywords": "Classic Mini technical tools, Mini Cooper specifications, SU needle chart, compression calculator, torque specs, DIY Mini maintenance, technical reference",
    "hero_title": "Classic Mini Technical Toolbox",
    "hero_subtitle": "Keeping Minis Driving",
    "ogTitle": "Classic Mini Technical Toolbox | DIY Calculators & Specifications",
    "ogDescription": "Classic Mini technical tools and specifications for DIY mechanics. Access calculators, torque specs, needle charts, and more to maintain and upgrade your Mini.",
    "twitterTitle": "Classic Mini Technical Toolbox",
    "twitterDescription": "DIY technical tools and specifications for Classic Mini maintenance and upgrades.",
    "structured_data": {
      "name": "Classic Mini Technical Toolbox",
      "description": "Collection of technical tools, calculators, and specifications for Classic Mini maintenance and upgrades."
    },
    "page_subtitle": "KEEPING MINIS DRIVING",
    "page_title": "The Technical Toolbox",
    "welcome_text": "One of the most important parts of Classic Mini DIY is the focus on getting out and working on your own car. So to make this easier for you, I have collected technical information from various sources and consolidated it right here on classicminidiy.com. These tools and calculators will help you maintain, upgrade, and troubleshoot your Classic Mini with confidence. From compression ratios to needle charts, everything you need is at your fingertips.",
    "support_section": "Support",
    "breadcrumb_subtitle": "KEEPING MINIS DRIVING",
    "main_heading": "The Technical Toolbox",
    "description_text": "One of the most important parts of Classic Mini DIY is the focus on getting out and working on your own car. So to make this easier for you, I have collected technical information from various sources and consolidated it right here on classicminidiy.com. These tools and calculators will help you maintain, upgrade, and troubleshoot your Classic Mini with confidence. From compression ratios to needle charts, everything you need is at your fingertips.",
    "toolbox": {
      "torque_specs": "Torque Specs",
      "chassis_decoder": "Chassis Number Decoder",
      "engine_decoder": "Engine Number Decoder",
      "needle_configurator": "Carb Needle Configurator",
      "gearbox_calculator": "Gearbox Calculator",
      "compression_calculator": "Compression Ratio Calculator",
      "parts_equivalency": "Parts Equivalency",
      "common_clearances": "Common Clearances"
    }
  },
  "es": {
    "title": "Caja de Herramientas Técnica Classic Mini DIY - Calculadoras y Herramientas",
    "description": "Herramientas técnicas esenciales para propietarios de Classic Mini. Calculadoras de compresión, caja de cambios, agujas de carburador y más para el mantenimiento y modificación.",
    "keywords": "Classic Mini, herramientas técnicas, calculadora compresión, calculadora caja cambios, agujas carburador, herramientas mantenimiento",
    "hero_title": "Caja de Herramientas Técnica Classic Mini",
    "hero_subtitle": "Manteniendo los Minis en Marcha",
    "ogTitle": "Caja de Herramientas Técnica Classic Mini | Calculadoras y Especificaciones DIY",
    "ogDescription": "Herramientas técnicas y especificaciones de Classic Mini para mecánicos DIY. Acceso a calculadoras, especificaciones de torque, tablas de agujas y más para mantener y mejorar tu Mini.",
    "twitterTitle": "Caja de Herramientas Técnica Classic Mini",
    "twitterDescription": "Herramientas técnicas DIY y especificaciones para mantenimiento y mejoras de Classic Mini.",
    "structured_data": {
      "name": "Caja de Herramientas Técnica Classic Mini",
      "description": "Colección de herramientas técnicas, calculadoras y especificaciones para mantenimiento y mejoras de Classic Mini."
    },
    "page_subtitle": "MANTENIENDO LOS MINIS EN MARCHA",
    "page_title": "La Caja de Herramientas Técnica",
    "welcome_text": "Una de las partes más importantes de Classic Mini DIY es el enfoque en salir y trabajar en tu propio coche. Para hacer esto más fácil para ti, he recopilado información técnica de varias fuentes y la he consolidado aquí en classicminidiy.com. Estas herramientas y calculadoras te ayudarán a mantener, mejorar y solucionar problemas de tu Classic Mini con confianza. Desde relaciones de compresión hasta tablas de agujas, todo lo que necesitas está al alcance de tus dedos.",
    "support_section": "Soporte",
    "breadcrumb_subtitle": "MANTENIENDO LOS MINIS EN MARCHA",
    "main_heading": "La Caja de Herramientas Técnica",
    "description_text": "Una de las partes más importantes de Classic Mini DIY es el enfoque en salir y trabajar en tu propio coche. Para hacer esto más fácil para ti, he recopilado información técnica de varias fuentes y la he consolidado aquí en classicminidiy.com. Estas herramientas y calculadoras te ayudarán a mantener, mejorar y solucionar problemas de tu Classic Mini con confianza. Desde relaciones de compresión hasta tablas de agujas, todo lo que necesitas está al alcance de tus dedos.",
    "toolbox": {
      "torque_specs": "Especificaciones de Torque",
      "chassis_decoder": "Decodificador de Número de Chasis",
      "engine_decoder": "Decodificador de Número de Motor",
      "needle_configurator": "Configurador de Agujas de Carburador",
      "gearbox_calculator": "Calculadora de Caja de Cambios",
      "compression_calculator": "Calculadora de Relación de Compresión",
      "parts_equivalency": "Equivalencia de Piezas",
      "common_clearances": "Holguras Comunes"
    },
    "breadcrumb_home": "Inicio",
    "breadcrumb_technical": "Técnico",
    "compression_calculator_title": "Calculadora de Compresión",
    "compression_calculator_description": "Calcula la relación de compresión para tu motor Classic Mini",
    "gearbox_calculator_title": "Calculadora de Caja de Cambios",
    "gearbox_calculator_description": "Analiza las relaciones de marchas y velocidades máximas",
    "needles_configurator_title": "Configurador de Agujas",
    "needles_configurator_description": "Encuentra las agujas de carburador perfectas para tu configuración",
    "chassis_decoder_title": "Decodificador de Chasis",
    "chassis_decoder_description": "Decodifica el número de chasis de tu Classic Mini",
    "engine_decoder_title": "Decodificador de Motor",
    "engine_decoder_description": "Identifica las especificaciones de tu motor por el código",
    "color_decoder_title": "Decodificador de Color",
    "color_decoder_description": "Encuentra el color original de tu Mini por el código",
    "support_title": "Apoya Nuestro Trabajo",
    "support_description": "Si estas herramientas te han sido útiles, considera apoyarnos en Patreon para ayudar a mantener y mejorar el sitio.",
    "support_button": "Apoyar en Patreon"
  },
  "fr": {
    "title": "Boîte à Outils Technique Classic Mini DIY - Calculatrices et Outils",
    "description": "Outils techniques essentiels pour les propriétaires de Classic Mini. Calculatrices de compression, boîte de vitesses, aiguilles de carburateur et plus pour l'entretien et la modification.",
    "keywords": "Classic Mini, outils techniques, calculatrice compression, calculatrice boîte vitesses, aiguilles carburateur, outils entretien",
    "hero_title": "Boîte à Outils Technique Classic Mini",
    "hero_subtitle": "Garder les Minis en Marche",
    "ogTitle": "Boîte à Outils Technique Classic Mini | Calculatrices et Spécifications DIY",
    "ogDescription": "Outils techniques et spécifications Classic Mini pour mécaniciens DIY. Accès aux calculatrices, spécifications de couple, tableaux d'aiguilles et plus pour entretenir et améliorer votre Mini.",
    "twitterTitle": "Boîte à Outils Technique Classic Mini",
    "twitterDescription": "Outils techniques DIY et spécifications pour l'entretien et les améliorations Classic Mini.",
    "structured_data": {
      "name": "Boîte à Outils Technique Classic Mini",
      "description": "Collection d'outils techniques, calculatrices et spécifications pour l'entretien et les améliorations Classic Mini."
    },
    "page_subtitle": "GARDER LES MINIS EN MARCHE",
    "page_title": "La Boîte à Outils Technique",
    "welcome_text": "L'une des parties les plus importantes de Classic Mini DIY est l'accent mis sur sortir et travailler sur votre propre voiture. Pour vous faciliter la tâche, j'ai rassemblé des informations techniques de diverses sources et les ai consolidées ici sur classicminidiy.com. Ces outils et calculatrices vous aideront à entretenir, améliorer et dépanner votre Classic Mini en toute confiance. Des rapports de compression aux tableaux d'aiguilles, tout ce dont vous avez besoin est à portée de main.",
    "support_section": "Support",
    "breadcrumb_subtitle": "GARDER LES MINIS EN MARCHE",
    "main_heading": "La Boîte à Outils Technique",
    "description_text": "L'une des parties les plus importantes de Classic Mini DIY est l'accent mis sur sortir et travailler sur votre propre voiture. Pour vous faciliter la tâche, j'ai rassemblé des informations techniques de diverses sources et les ai consolidées ici sur classicminidiy.com. Ces outils et calculatrices vous aideront à entretenir, améliorer et dépanner votre Classic Mini en toute confiance. Des rapports de compression aux tableaux d'aiguilles, tout ce dont vous avez besoin est à portée de main.",
    "toolbox": {
      "torque_specs": "Spécifications de Couple",
      "chassis_decoder": "Décodeur de Numéro de Châssis",
      "engine_decoder": "Décodeur de Numéro de Moteur",
      "needle_configurator": "Configurateur d'Aiguilles de Carburateur",
      "gearbox_calculator": "Calculatrice de Boîte de Vitesses",
      "compression_calculator": "Calculatrice de Rapport de Compression",
      "parts_equivalency": "Équivalence des Pièces",
      "common_clearances": "Jeux Communs"
    },
    "breadcrumb_home": "Accueil",
    "breadcrumb_technical": "Technique",
    "compression_calculator_title": "Calculatrice de Compression",
    "compression_calculator_description": "Calculez le taux de compression pour votre moteur Classic Mini",
    "gearbox_calculator_title": "Calculatrice de Boîte de Vitesses",
    "gearbox_calculator_description": "Analysez les rapports de vitesse et les vitesses maximales",
    "needles_configurator_title": "Configurateur d'Aiguilles",
    "needles_configurator_description": "Trouvez les aiguilles de carburateur parfaites pour votre configuration",
    "chassis_decoder_title": "Décodeur de Châssis",
    "chassis_decoder_description": "Décodez le numéro de châssis de votre Classic Mini",
    "engine_decoder_title": "Décodeur de Moteur",
    "engine_decoder_description": "Identifiez les spécifications de votre moteur par le code",
    "color_decoder_title": "Décodeur de Couleur",
    "color_decoder_description": "Trouvez la couleur d'origine de votre Mini par le code",
    "support_title": "Soutenez Notre Travail",
    "support_description": "Si ces outils vous ont été utiles, envisagez de nous soutenir sur Patreon pour aider à maintenir et améliorer le site.",
    "support_button": "Soutenir sur Patreon"
  },
  "it": {
    "title": "Cassetta degli Attrezzi Tecnica Classic Mini DIY - Calcolatrici e Strumenti",
    "description": "Strumenti tecnici essenziali per proprietari di Classic Mini. Calcolatrici di compressione, cambio, aghi carburatore e altro per manutenzione e modifiche.",
    "keywords": "Classic Mini, strumenti tecnici, calcolatrice compressione, calcolatrice cambio, aghi carburatore, strumenti manutenzione",
    "hero_title": "Cassetta degli Attrezzi Tecnica Classic Mini",
    "hero_subtitle": "Mantenere le Mini in Movimento",
    "ogTitle": "Cassetta degli Attrezzi Tecnica Classic Mini | Calcolatrici e Specifiche DIY",
    "ogDescription": "Strumenti tecnici e specifiche Classic Mini per meccanici DIY. Accesso a calcolatrici, specifiche di coppia, tabelle aghi e altro per mantenere e migliorare la tua Mini.",
    "twitterTitle": "Cassetta degli Attrezzi Tecnica Classic Mini",
    "twitterDescription": "Strumenti tecnici DIY e specifiche per manutenzione e miglioramenti Classic Mini.",
    "structured_data": {
      "name": "Cassetta degli Attrezzi Tecnica Classic Mini",
      "description": "Collezione di strumenti tecnici, calcolatrici e specifiche per manutenzione e miglioramenti Classic Mini."
    },
    "page_subtitle": "MANTENERE LE MINI IN MOVIMENTO",
    "page_title": "La Cassetta degli Attrezzi Tecnica",
    "welcome_text": "Una delle parti più importanti di Classic Mini DIY è l'attenzione al mettersi al lavoro sulla propria auto. Per rendere questo più facile per te, ho raccolto informazioni tecniche da varie fonti e le ho consolidate qui su classicminidiy.com. Questi strumenti e calcolatrici ti aiuteranno a mantenere, migliorare e risolvere i problemi della tua Classic Mini con fiducia. Dai rapporti di compressione alle tabelle degli aghi, tutto ciò di cui hai bisogno è a portata di mano.",
    "support_section": "Supporto",
    "breadcrumb_subtitle": "MANTENERE LE MINI IN MOVIMENTO",
    "main_heading": "La Cassetta degli Attrezzi Tecnica",
    "description_text": "Una delle parti più importanti di Classic Mini DIY è l'attenzione al mettersi al lavoro sulla propria auto. Per rendere questo più facile per te, ho raccolto informazioni tecniche da varie fonti e le ho consolidate qui su classicminidiy.com. Questi strumenti e calcolatrici ti aiuteranno a mantenere, migliorare e risolvere i problemi della tua Classic Mini con fiducia. Dai rapporti di compressione alle tabelle degli aghi, tutto ciò di cui hai bisogno è a portata di mano.",
    "toolbox": {
      "torque_specs": "Specifiche di Coppia",
      "chassis_decoder": "Decodificatore Numero Telaio",
      "engine_decoder": "Decodificatore Numero Motore",
      "needle_configurator": "Configuratore Aghi Carburatore",
      "gearbox_calculator": "Calcolatrice Cambio",
      "compression_calculator": "Calcolatrice Rapporto Compressione",
      "parts_equivalency": "Equivalenza Parti",
      "common_clearances": "Giochi Comuni"
    },
    "breadcrumb_home": "Home",
    "breadcrumb_technical": "Tecnico",
    "compression_calculator_title": "Calcolatrice di Compressione",
    "compression_calculator_description": "Calcola il rapporto di compressione per il tuo motore Classic Mini",
    "gearbox_calculator_title": "Calcolatrice del Cambio",
    "gearbox_calculator_description": "Analizza i rapporti delle marce e le velocità massime",
    "needles_configurator_title": "Configuratore Aghi",
    "needles_configurator_description": "Trova gli aghi del carburatore perfetti per la tua configurazione",
    "chassis_decoder_title": "Decodificatore Telaio",
    "chassis_decoder_description": "Decodifica il numero di telaio della tua Classic Mini",
    "engine_decoder_title": "Decodificatore Motore",
    "engine_decoder_description": "Identifica le specifiche del tuo motore tramite il codice",
    "color_decoder_title": "Decodificatore Colore",
    "color_decoder_description": "Trova il colore originale della tua Mini tramite il codice",
    "support_title": "Supporta il Nostro Lavoro",
    "support_description": "Se questi strumenti ti sono stati utili, considera di supportarci su Patreon per aiutare a mantenere e migliorare il sito.",
    "support_button": "Supporta su Patreon"
  },
  "de": {
    "title": "Classic Mini DIY Technischer Werkzeugkasten - Rechner und Werkzeuge",
    "description": "Wesentliche technische Werkzeuge für Classic Mini Besitzer. Kompressions-, Getriebe-, Vergaserdüsen-Rechner und mehr für Wartung und Modifikation.",
    "keywords": "Classic Mini, technische Werkzeuge, Kompressionsrechner, Getrieberechner, Vergaserdüsen, Wartungswerkzeuge",
    "hero_title": "Classic Mini Technischer Werkzeugkasten",
    "hero_subtitle": "Minis am Fahren Halten",
    "ogTitle": "Classic Mini Technischer Werkzeugkasten | DIY Rechner und Spezifikationen",
    "ogDescription": "Technische Werkzeuge und Spezifikationen für Classic Mini DIY-Mechaniker. Zugang zu Rechnern, Drehmomentspezifikationen, Düsentabellen und mehr zur Wartung und Verbesserung Ihres Mini.",
    "twitterTitle": "Classic Mini Technischer Werkzeugkasten",
    "twitterDescription": "DIY technische Werkzeuge und Spezifikationen für Classic Mini Wartung und Verbesserungen.",
    "structured_data": {
      "name": "Classic Mini Technischer Werkzeugkasten",
      "description": "Sammlung technischer Werkzeuge, Rechner und Spezifikationen für Classic Mini Wartung und Verbesserungen."
    },
    "page_subtitle": "MINIS AM FAHREN HALTEN",
    "page_title": "Der Technische Werkzeugkasten",
    "welcome_text": "Einer der wichtigsten Teile von Classic Mini DIY ist der Fokus darauf, rauszugehen und an Ihrem eigenen Auto zu arbeiten. Um Ihnen das zu erleichtern, habe ich technische Informationen aus verschiedenen Quellen gesammelt und hier auf classicminidiy.com konsolidiert. Diese Werkzeuge und Rechner helfen Ihnen dabei, Ihren Classic Mini selbstbewusst zu warten, zu verbessern und Probleme zu beheben. Von Kompressionsverhältnissen bis zu Düsentabellen - alles was Sie brauchen ist griffbereit.",
    "support_section": "Support",
    "breadcrumb_subtitle": "MINIS AM FAHREN HALTEN",
    "main_heading": "Der Technische Werkzeugkasten",
    "description_text": "Einer der wichtigsten Teile von Classic Mini DIY ist der Fokus darauf, rauszugehen und an Ihrem eigenen Auto zu arbeiten. Um Ihnen das zu erleichtern, habe ich technische Informationen aus verschiedenen Quellen gesammelt und hier auf classicminidiy.com konsolidiert. Diese Werkzeuge und Rechner helfen Ihnen dabei, Ihren Classic Mini selbstbewusst zu warten, zu verbessern und Probleme zu beheben. Von Kompressionsverhältnissen bis zu Düsentabellen - alles was Sie brauchen ist griffbereit.",
    "toolbox": {
      "torque_specs": "Drehmomentspezifikationen",
      "chassis_decoder": "Fahrgestellnummer-Decoder",
      "engine_decoder": "Motornummer-Decoder",
      "needle_configurator": "Vergaserdüsen-Konfigurator",
      "gearbox_calculator": "Getrieberechner",
      "compression_calculator": "Kompressionsverhältnis-Rechner",
      "parts_equivalency": "Teileäquivalenz",
      "common_clearances": "Übliche Spiele"
    },
    "breadcrumb_home": "Startseite",
    "breadcrumb_technical": "Technisch",
    "compression_calculator_title": "Kompressionsrechner",
    "compression_calculator_description": "Berechnen Sie das Kompressionsverhältnis für Ihren Classic Mini Motor",
    "gearbox_calculator_title": "Getrieberechner",
    "gearbox_calculator_description": "Analysieren Sie Getriebeübersetzungen und Höchstgeschwindigkeiten",
    "needles_configurator_title": "Düsen-Konfigurator",
    "needles_configurator_description": "Finden Sie die perfekten Vergaserdüsen für Ihre Konfiguration",
    "chassis_decoder_title": "Fahrgestell-Decoder",
    "chassis_decoder_description": "Entschlüsseln Sie die Fahrgestellnummer Ihres Classic Mini",
    "engine_decoder_title": "Motor-Decoder",
    "engine_decoder_description": "Identifizieren Sie die Spezifikationen Ihres Motors anhand des Codes",
    "color_decoder_title": "Farb-Decoder",
    "color_decoder_description": "Finden Sie die ursprüngliche Farbe Ihres Mini anhand des Codes",
    "support_title": "Unterstützen Sie Unsere Arbeit",
    "support_description": "Wenn diese Werkzeuge für Sie nützlich waren, erwägen Sie, uns auf Patreon zu unterstützen, um die Website zu erhalten und zu verbessern.",
    "support_button": "Auf Patreon Unterstützen"
  },
  "pt": {
    "title": "Caixa de Ferramentas Técnica Classic Mini DIY - Calculadoras e Ferramentas",
    "description": "Ferramentas técnicas essenciais para proprietários de Classic Mini. Calculadoras de compressão, câmbio, agulhas de carburador e mais para manutenção e modificação.",
    "keywords": "Classic Mini, ferramentas técnicas, calculadora compressão, calculadora câmbio, agulhas carburador, ferramentas manutenção",
    "hero_title": "Caixa de Ferramentas Técnica Classic Mini",
    "hero_subtitle": "Mantendo os Minis Rodando",
    "ogTitle": "Caixa de Ferramentas Técnica Classic Mini | Calculadoras e Especificações DIY",
    "ogDescription": "Ferramentas técnicas e especificações Classic Mini para mecânicos DIY. Acesso a calculadoras, especificações de torque, tabelas de agulhas e mais para manter e melhorar seu Mini.",
    "twitterTitle": "Caixa de Ferramentas Técnica Classic Mini",
    "twitterDescription": "Ferramentas técnicas DIY e especificações para manutenção e melhorias Classic Mini.",
    "structured_data": {
      "name": "Caixa de Ferramentas Técnica Classic Mini",
      "description": "Coleção de ferramentas técnicas, calculadoras e especificações para manutenção e melhorias Classic Mini."
    },
    "page_subtitle": "MANTENDO OS MINIS RODANDO",
    "page_title": "A Caixa de Ferramentas Técnica",
    "welcome_text": "Uma das partes mais importantes do Classic Mini DIY é o foco em sair e trabalhar no seu próprio carro. Para tornar isso mais fácil para você, coletei informações técnicas de várias fontes e as consolidei aqui no classicminidiy.com. Essas ferramentas e calculadoras ajudarão você a manter, melhorar e solucionar problemas do seu Classic Mini com confiança. De razões de compressão a tabelas de agulhas, tudo o que você precisa está ao seu alcance.",
    "support_section": "Suporte",
    "breadcrumb_subtitle": "MANTENDO OS MINIS RODANDO",
    "main_heading": "A Caixa de Ferramentas Técnica",
    "description_text": "Uma das partes mais importantes do Classic Mini DIY é o foco em sair e trabalhar no seu próprio carro. Para tornar isso mais fácil para você, coletei informações técnicas de várias fontes e as consolidei aqui no classicminidiy.com. Essas ferramentas e calculadoras ajudarão você a manter, melhorar e solucionar problemas do seu Classic Mini com confiança. De razões de compressão a tabelas de agulhas, tudo o que você precisa está ao seu alcance.",
    "toolbox": {
      "torque_specs": "Especificações de Torque",
      "chassis_decoder": "Decodificador de Número do Chassi",
      "engine_decoder": "Decodificador de Número do Motor",
      "needle_configurator": "Configurador de Agulhas do Carburador",
      "gearbox_calculator": "Calculadora de Câmbio",
      "compression_calculator": "Calculadora de Razão de Compressão",
      "parts_equivalency": "Equivalência de Peças",
      "common_clearances": "Folgas Comuns"
    },
    "breadcrumb_home": "Início",
    "breadcrumb_technical": "Técnico",
    "compression_calculator_title": "Calculadora de Compressão",
    "compression_calculator_description": "Calcule a taxa de compressão para seu motor Classic Mini",
    "gearbox_calculator_title": "Calculadora de Câmbio",
    "gearbox_calculator_description": "Analise as relações de marcha e velocidades máximas",
    "needles_configurator_title": "Configurador de Agulhas",
    "needles_configurator_description": "Encontre as agulhas de carburador perfeitas para sua configuração",
    "chassis_decoder_title": "Decodificador de Chassi",
    "chassis_decoder_description": "Decodifique o número do chassi do seu Classic Mini",
    "engine_decoder_title": "Decodificador de Motor",
    "engine_decoder_description": "Identifique as especificações do seu motor pelo código",
    "color_decoder_title": "Decodificador de Cor",
    "color_decoder_description": "Encontre a cor original do seu Mini pelo código",
    "support_title": "Apoie Nosso Trabalho",
    "support_description": "Se essas ferramentas foram úteis para você, considere nos apoiar no Patreon para ajudar a manter e melhorar o site.",
    "support_button": "Apoiar no Patreon"
  },
  "ru": {
    "title": "Технический Набор Инструментов Classic Mini DIY - Калькуляторы и Инструменты",
    "description": "Основные технические инструменты для владельцев Classic Mini. Калькуляторы сжатия, коробки передач, игл карбюратора и многое другое для обслуживания и модификации.",
    "keywords": "Classic Mini, технические инструменты, калькулятор сжатия, калькулятор коробки передач, иглы карбюратора, инструменты обслуживания",
    "hero_title": "Технический Набор Инструментов Classic Mini",
    "hero_subtitle": "Поддерживая Мини в Движении",
    "ogTitle": "Технический Набор Инструментов Classic Mini | DIY Калькуляторы и Спецификации",
    "ogDescription": "Технические инструменты и спецификации Classic Mini для DIY механиков. Доступ к калькуляторам, моментам затяжки, таблицам игл и многому другому для обслуживания и модернизации вашего Mini.",
    "twitterTitle": "Технический Набор Инструментов Classic Mini",
    "twitterDescription": "DIY технические инструменты и спецификации для обслуживания и модернизации Classic Mini.",
    "structured_data": {
      "name": "Технический Набор Инструментов Classic Mini",
      "description": "Коллекция технических инструментов, калькуляторов и спецификаций для обслуживания и модернизации Classic Mini."
    },
    "page_subtitle": "ПОДДЕРЖИВАЯ МИНИ В ДВИЖЕНИИ",
    "page_title": "Технический Набор Инструментов",
    "welcome_text": "Одна из самых важных частей Classic Mini DIY - это фокус на выходе и работе с собственным автомобилем. Чтобы облегчить это для вас, я собрал техническую информацию из различных источников и консолидировал ее прямо здесь на classicminidiy.com. Эти инструменты и калькуляторы помогут вам обслуживать, модернизировать и устранять неполадки вашего Classic Mini с уверенностью. От степеней сжатия до таблиц игл - все, что вам нужно, под рукой.",
    "support_section": "Поддержка",
    "breadcrumb_subtitle": "ПОДДЕРЖИВАЯ МИНИ В ДВИЖЕНИИ",
    "main_heading": "Технический Набор Инструментов",
    "description_text": "Одна из самых важных частей Classic Mini DIY - это фокус на выходе и работе с собственным автомобилем. Чтобы облегчить это для вас, я собрал техническую информацию из различных источников и консолидировал ее прямо здесь на classicminidiy.com. Эти инструменты и калькуляторы помогут вам обслуживать, модернизировать и устранять неполадки вашего Classic Mini с уверенностью. От степеней сжатия до таблиц игл - все, что вам нужно, под рукой.",
    "toolbox": {
      "torque_specs": "Моменты Затяжки",
      "chassis_decoder": "Декодер Номера Шасси",
      "engine_decoder": "Декодер Номера Двигателя",
      "needle_configurator": "Конфигуратор Игл Карбюратора",
      "gearbox_calculator": "Калькулятор Коробки Передач",
      "compression_calculator": "Калькулятор Степени Сжатия",
      "parts_equivalency": "Эквивалентность Деталей",
      "common_clearances": "Общие Зазоры"
    },
    "breadcrumb_home": "Главная",
    "breadcrumb_technical": "Техническое",
    "compression_calculator_title": "Калькулятор Сжатия",
    "compression_calculator_description": "Рассчитайте степень сжатия для вашего двигателя Classic Mini",
    "gearbox_calculator_title": "Калькулятор Коробки Передач",
    "gearbox_calculator_description": "Анализируйте передаточные числа и максимальные скорости",
    "needles_configurator_title": "Конфигуратор Игл",
    "needles_configurator_description": "Найдите идеальные иглы карбюратора для вашей конфигурации",
    "chassis_decoder_title": "Декодер Шасси",
    "chassis_decoder_description": "Расшифруйте номер шасси вашего Classic Mini",
    "engine_decoder_title": "Декодер Двигателя",
    "engine_decoder_description": "Определите характеристики вашего двигателя по коду",
    "color_decoder_title": "Декодер Цвета",
    "color_decoder_description": "Найдите оригинальный цвет вашего Mini по коду",
    "support_title": "Поддержите Нашу Работу",
    "support_description": "Если эти инструменты были полезны для вас, рассмотрите возможность поддержки нас на Patreon, чтобы помочь поддерживать и улучшать сайт.",
    "support_button": "Поддержать на Patreon",
    "Основные инструменты для владельцев Classic Mini": "Основные инструменты для владельцев Classic Mini",
    "Технический Набор Инструментов": "Технический Набор Инструментов"
  },
  "ja": {
    "title": "Classic Mini DIY テクニカルツールボックス - 計算機とツール",
    "description": "Classic Miniオーナーのための必須技術ツール。圧縮、ギアボックス、キャブレターニードル計算機など、メンテナンスと改造のためのツール。",
    "keywords": "Classic Mini, 技術ツール, 圧縮計算機, ギアボックス計算機, キャブレターニードル, メンテナンスツール",
    "hero_title": "Classic Mini テクニカルツールボックス",
    "hero_subtitle": "ミニを走らせ続ける",
    "ogTitle": "Classic Mini テクニカルツールボックス | DIY 計算機と仕様",
    "ogDescription": "DIYメカニック向けのClassic Mini技術ツールと仕様。計算機、トルク仕様、ニードルチャートなどにアクセスして、あなたのMiniを維持・アップグレードしましょう。",
    "twitterTitle": "Classic Mini テクニカルツールボックス",
    "twitterDescription": "Classic MiniのメンテナンスとアップグレードのためのDIY技術ツールと仕様。",
    "structured_data": {
      "name": "Classic Mini テクニカルツールボックス",
      "description": "Classic Miniのメンテナンスとアップグレードのための技術ツール、計算機、仕様のコレクション。"
    },
    "page_subtitle": "ミニを走らせ続ける",
    "page_title": "テクニカルツールボックス",
    "welcome_text": "Classic Mini DIYの最も重要な部分の一つは、自分の車に出て行って作業することに焦点を当てることです。これをより簡単にするために、私は様々なソースから技術情報を収集し、classicminidiy.comでそれを統合しました。これらのツールと計算機は、あなたがClassic Miniを自信を持って維持、アップグレード、トラブルシューティングするのに役立ちます。圧縮比からニードルチャートまで、必要なものはすべて手の届くところにあります。",
    "support_section": "サポート",
    "breadcrumb_subtitle": "ミニを走らせ続ける",
    "main_heading": "テクニカルツールボックス",
    "description_text": "Classic Mini DIYの最も重要な部分の一つは、自分の車に出て行って作業することに焦点を当てることです。これをより簡単にするために、私は様々なソースから技術情報を収集し、classicminidiy.comでそれを統合しました。これらのツールと計算機は、あなたがClassic Miniを自信を持って維持、アップグレード、トラブルシューティングするのに役立ちます。圧縮比からニードルチャートまで、必要なものはすべて手の届くところにあります。",
    "toolbox": {
      "torque_specs": "トルク仕様",
      "chassis_decoder": "シャシー番号デコーダー",
      "engine_decoder": "エンジン番号デコーダー",
      "needle_configurator": "キャブレターニードル設定ツール",
      "gearbox_calculator": "ギアボックス計算機",
      "compression_calculator": "圧縮比計算機",
      "parts_equivalency": "部品等価性",
      "common_clearances": "一般的なクリアランス"
    },
    "breadcrumb_home": "ホーム",
    "breadcrumb_technical": "テクニカル",
    "compression_calculator_title": "圧縮比計算機",
    "compression_calculator_description": "あなたのClassic Miniエンジンの圧縮比を計算",
    "gearbox_calculator_title": "ギアボックス計算機",
    "gearbox_calculator_description": "ギア比と最高速度を分析",
    "needles_configurator_title": "ニードル設定ツール",
    "needles_configurator_description": "あなたの設定に最適なキャブレターニードルを見つける",
    "chassis_decoder_title": "シャシーデコーダー",
    "chassis_decoder_description": "あなたのClassic Miniのシャシー番号をデコード",
    "engine_decoder_title": "エンジンデコーダー",
    "engine_decoder_description": "コードからあなたのエンジン仕様を特定",
    "color_decoder_title": "カラーデコーダー",
    "color_decoder_description": "コードからあなたのMiniの元の色を見つける",
    "support_title": "私たちの活動をサポート",
    "support_description": "これらのツールがお役に立った場合は、Patreonで私たちをサポートして、サイトの維持と改善にご協力ください。",
    "support_button": "Patreonでサポート"
  },
  "zh": {
    "title": "Classic Mini DIY 技术工具箱 - 计算器和工具",
    "description": "Classic Mini车主的必备技术工具。压缩、变速箱、化油器针计算器等，用于维护和改装。",
    "keywords": "Classic Mini, 技术工具, 压缩计算器, 变速箱计算器, 化油器针, 维护工具",
    "hero_title": "Classic Mini 技术工具箱",
    "hero_subtitle": "保持迷你车行驶",
    "ogTitle": "Classic Mini 技术工具箱 | DIY 计算器和规格",
    "ogDescription": "面向DIY机械师的Classic Mini技术工具和规格。访问计算器、扭矩规格、针表等，以维护和升级您的Mini。",
    "twitterTitle": "Classic Mini 技术工具箱",
    "twitterDescription": "用于Classic Mini维护和升级的DIY技术工具和规格。",
    "structured_data": {
      "name": "Classic Mini 技术工具箱",
      "description": "用于Classic Mini维护和升级的技术工具、计算器和规格集合。"
    },
    "page_subtitle": "保持迷你车行驶",
    "page_title": "技术工具箱",
    "welcome_text": "Classic Mini DIY最重要的部分之一是专注于走出去并在自己的汽车上工作。为了让您更容易做到这一点，我从各种来源收集了技术信息，并在classicminidiy.com上进行了整合。这些工具和计算器将帮助您自信地维护、升级和排除Classic Mini的故障。从压缩比到针表，您需要的一切都触手可及。",
    "support_section": "支持",
    "breadcrumb_subtitle": "保持迷你车行驶",
    "main_heading": "技术工具箱",
    "description_text": "Classic Mini DIY最重要的部分之一是专注于走出去并在自己的汽车上工作。为了让您更容易做到这一点，我从各种来源收集了技术信息，并在classicminidiy.com上进行了整合。这些工具和计算器将帮助您自信地维护、升级和排除Classic Mini的故障。从压缩比到针表，您需要的一切都触手可及。",
    "toolbox": {
      "torque_specs": "扭矩规格",
      "chassis_decoder": "底盘号解码器",
      "engine_decoder": "发动机号解码器",
      "needle_configurator": "化油器针配置器",
      "gearbox_calculator": "变速箱计算器",
      "compression_calculator": "压缩比计算器",
      "parts_equivalency": "零件等效性",
      "common_clearances": "常见间隙"
    },
    "breadcrumb_home": "首页",
    "breadcrumb_technical": "技术",
    "compression_calculator_title": "压缩比计算器",
    "compression_calculator_description": "计算您的Classic Mini发动机的压缩比",
    "gearbox_calculator_title": "变速箱计算器",
    "gearbox_calculator_description": "分析齿轮比和最高速度",
    "needles_configurator_title": "针配置器",
    "needles_configurator_description": "为您的配置找到完美的化油器针",
    "chassis_decoder_title": "底盘解码器",
    "chassis_decoder_description": "解码您的Classic Mini底盘号码",
    "engine_decoder_title": "发动机解码器",
    "engine_decoder_description": "通过代码识别您的发动机规格",
    "color_decoder_title": "颜色解码器",
    "color_decoder_description": "通过代码找到您的Mini原始颜色",
    "support_title": "支持我们的工作",
    "support_description": "如果这些工具对您有用，请考虑在Patreon上支持我们，帮助维护和改进网站。",
    "support_button": "在Patreon支持"
  },
  "ko": {
    "title": "Classic Mini DIY 기술 도구상자 - 계산기와 도구",
    "description": "Classic Mini 소유자를 위한 필수 기술 도구. 압축, 기어박스, 카뷰레터 니들 계산기 등 유지보수와 개조를 위한 도구.",
    "keywords": "Classic Mini, 기술 도구, 압축 계산기, 기어박스 계산기, 카뷰레터 니들, 유지보수 도구",
    "hero_title": "Classic Mini 기술 도구상자",
    "hero_subtitle": "미니를 계속 운전하게 하기",
    "ogTitle": "Classic Mini 기술 도구상자 | DIY 계산기와 사양",
    "ogDescription": "DIY 정비사를 위한 Classic Mini 기술 도구와 사양. 계산기, 토크 사양, 니들 차트 등에 액세스하여 Mini를 유지보수하고 업그레이드하세요.",
    "twitterTitle": "Classic Mini 기술 도구상자",
    "twitterDescription": "Classic Mini 유지보수와 업그레이드를 위한 DIY 기술 도구와 사양.",
    "structured_data": {
      "name": "Classic Mini 기술 도구상자",
      "description": "Classic Mini 유지보수와 업그레이드를 위한 기술 도구, 계산기, 사양 모음."
    },
    "page_subtitle": "미니를 계속 운전하게 하기",
    "page_title": "기술 도구상자",
    "welcome_text": "Classic Mini DIY의 가장 중요한 부분 중 하나는 나가서 자신의 차에서 작업하는 것에 초점을 맞추는 것입니다. 이를 더 쉽게 하기 위해, 저는 다양한 소스에서 기술 정보를 수집하고 classicminidiy.com에서 통합했습니다. 이러한 도구와 계산기는 Classic Mini를 자신 있게 유지보수, 업그레이드 및 문제 해결하는 데 도움이 될 것입니다. 압축비부터 니들 차트까지, 필요한 모든 것이 손끝에 있습니다.",
    "support_section": "지원",
    "breadcrumb_subtitle": "미니를 계속 운전하게 하기",
    "main_heading": "기술 도구상자",
    "description_text": "Classic Mini DIY의 가장 중요한 부분 중 하나는 나가서 자신의 차에서 작업하는 것에 초점을 맞추는 것입니다. 이를 더 쉽게 하기 위해, 저는 다양한 소스에서 기술 정보를 수집하고 classicminidiy.com에서 통합했습니다. 이러한 도구와 계산기는 Classic Mini를 자신 있게 유지보수, 업그레이드 및 문제 해결하는 데 도움이 될 것입니다. 압축비부터 니들 차트까지, 필요한 모든 것이 손끝에 있습니다.",
    "toolbox": {
      "torque_specs": "토크 사양",
      "chassis_decoder": "섀시 번호 디코더",
      "engine_decoder": "엔진 번호 디코더",
      "needle_configurator": "카뷰레터 니들 구성기",
      "gearbox_calculator": "기어박스 계산기",
      "compression_calculator": "압축비 계산기",
      "parts_equivalency": "부품 등가성",
      "common_clearances": "일반적인 클리어런스"
    },
    "breadcrumb_home": "홈",
    "breadcrumb_technical": "기술",
    "compression_calculator_title": "압축비 계산기",
    "compression_calculator_description": "당신의 Classic Mini 엔진의 압축비를 계산하세요",
    "gearbox_calculator_title": "기어박스 계산기",
    "gearbox_calculator_description": "기어비와 최고 속도를 분석하세요",
    "needles_configurator_title": "니들 구성기",
    "needles_configurator_description": "당신의 구성에 완벽한 카뷰레터 니들을 찾으세요",
    "chassis_decoder_title": "섀시 디코더",
    "chassis_decoder_description": "당신의 Classic Mini 섀시 번호를 디코드하세요",
    "engine_decoder_title": "엔진 디코더",
    "engine_decoder_description": "코드로 당신의 엔진 사양을 식별하세요",
    "color_decoder_title": "색상 디코더",
    "color_decoder_description": "코드로 당신의 Mini 원래 색상을 찾으세요",
    "support_title": "우리의 작업을 지원하세요",
    "support_description": "이 도구들이 유용했다면, Patreon에서 우리를 지원하여 사이트 유지와 개선에 도움을 주세요.",
    "support_button": "Patreon에서 지원"
  }
}
</i18n>
