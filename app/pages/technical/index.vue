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
        href: 'https://www.classicminidiy.com/technical',
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
    ogUrl: 'https://www.classicminidiy.com/technical',
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
    url: 'https://www.classicminidiy.com/technical',
    itemListElement: ToolboxItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://www.classicminidiy.com${item.to}`,
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
    <breadcrumb :version="BREADCRUMB_VERSIONS.TECH" root></breadcrumb>

    <section class="pt-8">
      <div class="section-head">
        <div class="meta">
          <span class="eyebrow">{{ t('breadcrumb_subtitle') }}</span>
          <h2 class="text-3xl md:text-4xl">{{ t('main_heading') }}</h2>
          <p>{{ t('description_text') }}</p>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HomeToolCard
          v-for="tool in ToolboxItems"
          :key="tool.to"
          :to="tool.to"
          :icon="tool.iconName || 'fa-toolbox'"
          :icon-primary="tool.iconPrimary"
          :icon-secondary="tool.iconSecondary"
          :icon-secondary-opacity="tool.iconSecondaryOpacity"
          :title="t(tool.titleKey)"
          :description="tool.descKey ? t(tool.descKey) : ''"
          :kind="tool.kindKey ? t(tool.kindKey) : ''"
        />
      </div>
    </section>

    <div class="grid grid-cols-12 gap-4 mt-12">
      <div class="col-span-12 md:col-span-10 md:col-start-2">
        <div class="divider">{{ t('support_section') }}</div>
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
      "alignment_calculator": "Alignment Calculator",
      "parts_equivalency": "Parts Equivalency",
      "common_clearances": "Common Clearances",
      "kind": {
        "calculator": "Calculator",
        "decoder": "Decoder",
        "reference": "Reference"
      },
      "torque_specs_desc": "Every torque value for the A-series and aux components, in one searchable chart.",
      "chassis_decoder_desc": "Year, plant, and trim from your VIN/chassis number.",
      "engine_decoder_desc": "Decode A-series engine codes, displacement, and date stamps.",
      "needle_configurator_desc": "Compare SU HS2/HS4/HIF44 needle profiles side-by-side with chart overlays.",
      "gearbox_calculator_desc": "Final-drive math across SPi, MPi, and pre-Verto cars.",
      "compression_calculator_desc": "CR for any combo of bore, stroke, head cc and deck height.",
      "alignment_calculator_desc": "Visualize camber, caster, and toe live, with presets for stock, fast road, track, and boosted.",
      "parts_equivalency_desc": "Cross-reference part numbers across vendors and brands.",
      "common_clearances_desc": "Tappet gaps, bearing tolerances, and assembly clearances."
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
      "alignment_calculator": "Calculadora de alineación",
      "parts_equivalency": "Equivalencia de Piezas",
      "common_clearances": "Holguras Comunes",
      "kind": {
        "calculator": "Calculadora",
        "decoder": "Decodificador",
        "reference": "Referencia"
      },
      "torque_specs_desc": "Cada valor de par para los componentes del A-series y auxiliares, en una tabla buscable.",
      "chassis_decoder_desc": "Año, planta y acabado a partir de tu número VIN/chasis.",
      "engine_decoder_desc": "Decodifica códigos de motor A-series, cilindrada y sellos de fecha.",
      "needle_configurator_desc": "Compara perfiles de agujas SU HS2/HS4/HIF44 lado a lado con superposiciones gráficas.",
      "gearbox_calculator_desc": "Cálculos de transmisión final para SPi, MPi y coches pre-Verto.",
      "compression_calculator_desc": "CR para cualquier combinación de diámetro, carrera, cc de culata y altura de cubierta.",
      "alignment_calculator_desc": "Visualiza caída, avance y convergencia en vivo, con preajustes para estándar, carretera rápida, circuito y sobrealimentado.",
      "parts_equivalency_desc": "Referencias cruzadas de números de pieza entre proveedores y marcas.",
      "common_clearances_desc": "Ajustes de taqués, tolerancias de cojinetes y holguras de montaje."
    }
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
      "alignment_calculator": "Calculateur de géométrie",
      "parts_equivalency": "Équivalence des Pièces",
      "common_clearances": "Jeux Communs",
      "kind": {
        "calculator": "Calculatrice",
        "decoder": "Décodeur",
        "reference": "Référence"
      },
      "torque_specs_desc": "Chaque valeur de couple pour les composants A-series et auxiliaires, dans un tableau consultable.",
      "chassis_decoder_desc": "Année, usine et finition à partir de ton numéro VIN/châssis.",
      "engine_decoder_desc": "Décode les codes moteur A-series, la cylindrée et les frappes de date.",
      "needle_configurator_desc": "Compare des profils d'aiguilles SU HS2/HS4/HIF44 côte à côte avec superpositions graphiques.",
      "gearbox_calculator_desc": "Calculs de réduction finale pour SPi, MPi et voitures pré-Verto.",
      "compression_calculator_desc": "CR pour n'importe quelle combinaison d'alésage, course, cc de culasse et hauteur de pont.",
      "alignment_calculator_desc": "Visualisez carrossage, chasse et parallélisme en direct, avec des préréglages pour origine, route sportive, circuit et suralimentée.",
      "parts_equivalency_desc": "Recoupement des numéros de pièces entre fournisseurs et marques.",
      "common_clearances_desc": "Calage de soupapes, tolérances de paliers et jeux de montage."
    }
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
      "alignment_calculator": "Calcolatore di allineamento",
      "parts_equivalency": "Equivalenza Parti",
      "common_clearances": "Giochi Comuni",
      "kind": {
        "calculator": "Calcolatrice",
        "decoder": "Decodificatore",
        "reference": "Riferimento"
      },
      "torque_specs_desc": "Ogni valore di coppia per i componenti del A-series e ausiliari, in una tabella ricercabile.",
      "chassis_decoder_desc": "Anno, stabilimento e allestimento dal tuo numero VIN/telaio.",
      "engine_decoder_desc": "Decodifica codici motore A-series, cilindrata e marchi di data.",
      "needle_configurator_desc": "Confronta i profili degli aghi SU HS2/HS4/HIF44 fianco a fianco con overlay grafici.",
      "gearbox_calculator_desc": "Calcoli di trasmissione finale per SPi, MPi e auto pre-Verto.",
      "compression_calculator_desc": "CR per qualsiasi combinazione di alesaggio, corsa, cc della testata e altezza piano.",
      "alignment_calculator_desc": "Visualizza campanatura, incidenza e convergenza dal vivo, con preset per di serie, strada sportiva, pista e sovralimentata.",
      "parts_equivalency_desc": "Tabelle di corrispondenza dei codici ricambio tra fornitori e marchi.",
      "common_clearances_desc": "Gioco delle punterie, tolleranze dei cuscinetti e giochi di assemblaggio."
    }
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
      "alignment_calculator": "Achsvermessungsrechner",
      "parts_equivalency": "Teileäquivalenz",
      "common_clearances": "Übliche Spiele",
      "kind": {
        "calculator": "Rechner",
        "decoder": "Dekoder",
        "reference": "Referenz"
      },
      "torque_specs_desc": "Jeder Drehmomentwert für den A-Series und Nebenaggregate, in einer durchsuchbaren Tabelle.",
      "chassis_decoder_desc": "Jahr, Werk und Ausstattung aus deiner VIN/Fahrgestellnummer.",
      "engine_decoder_desc": "Dekodiere A-Series Motorcodes, Hubraum und Datumsstempel.",
      "needle_configurator_desc": "Vergleiche SU HS2/HS4/HIF44 Nadelprofile nebeneinander mit Diagramm-Overlays.",
      "gearbox_calculator_desc": "Achsantriebsmathematik für SPi, MPi und Pre-Verto-Fahrzeuge.",
      "compression_calculator_desc": "CR für jede Kombination aus Bohrung, Hub, Brennraumvolumen und Decköhe.",
      "alignment_calculator_desc": "Visualisiere Sturz, Nachlauf und Spur live, mit Voreinstellungen für Serie, schnelle Straße, Rennstrecke und aufgeladen.",
      "parts_equivalency_desc": "Querverweise von Teilenummern über Lieferanten und Marken hinweg.",
      "common_clearances_desc": "Ventilspiele, Lagertoleranzen und Montagespielmaße."
    }
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
      "alignment_calculator": "Calculadora de Alinhamento",
      "parts_equivalency": "Equivalência de Peças",
      "common_clearances": "Folgas Comuns",
      "kind": {
        "calculator": "Calculadora",
        "decoder": "Decodificador",
        "reference": "Referência"
      },
      "torque_specs_desc": "Cada valor de torque para os componentes do A-series e auxiliares, numa tabela pesquisável.",
      "chassis_decoder_desc": "Ano, fábrica e acabamento a partir do seu número VIN/chassi.",
      "engine_decoder_desc": "Decodifica códigos de motor A-series, cilindrada e marcações de data.",
      "needle_configurator_desc": "Compara perfis de agulhas SU HS2/HS4/HIF44 lado a lado com sobreposições gráficas.",
      "gearbox_calculator_desc": "Cálculos de transmissão final para SPi, MPi e carros pré-Verto.",
      "compression_calculator_desc": "CR para qualquer combinação de diâmetro, curso, cc do cabeçote e altura do platô.",
      "alignment_calculator_desc": "Visualize a cambagem, o cáster e a convergência ao vivo, com predefinições para série, estrada rápida, pista e turbo.",
      "parts_equivalency_desc": "Referência cruzada de números de peças entre fornecedores e marcas.",
      "common_clearances_desc": "Ajustes de tuchos, tolerâncias de mancais e folgas de montagem."
    }
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
      "alignment_calculator": "Калькулятор развал-схождения",
      "parts_equivalency": "Эквивалентность Деталей",
      "common_clearances": "Общие Зазоры",
      "kind": {
        "calculator": "Калькулятор",
        "decoder": "Декодер",
        "reference": "Справочник"
      },
      "torque_specs_desc": "Каждое значение момента затяжки для A-series и вспомогательных компонентов в одной таблице с поиском.",
      "chassis_decoder_desc": "Год, завод и комплектация из вашего VIN/номера шасси.",
      "engine_decoder_desc": "Расшифровка кодов двигателей A-series, рабочего объёма и клейм даты.",
      "needle_configurator_desc": "Сравните профили игл SU HS2/HS4/HIF44 параллельно с наложением графиков.",
      "gearbox_calculator_desc": "Математика главной передачи для SPi, MPi и до-Verto автомобилей.",
      "compression_calculator_desc": "CR для любого сочетания диаметра цилиндра, хода поршня, объёма ГБЦ и высоты деки.",
      "alignment_calculator_desc": "Визуализируйте развал, кастер и схождение вживую, с пресетами для стока, спорт-дороги, трека и наддува.",
      "parts_equivalency_desc": "Перекрёстная справка номеров деталей между поставщиками и брендами.",
      "common_clearances_desc": "Регулировки клапанов, допуски подшипников и сборочные зазоры."
    }
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
      "alignment_calculator": "アライメント計算機",
      "parts_equivalency": "部品等価性",
      "common_clearances": "一般的なクリアランス",
      "kind": {
        "calculator": "計算機",
        "decoder": "デコーダー",
        "reference": "リファレンス"
      },
      "torque_specs_desc": "A-シリーズと補機の全てのトルク値を、検索可能な一つのチャートに。",
      "chassis_decoder_desc": "VIN/シャシー番号から年式、工場、グレードを解析。",
      "engine_decoder_desc": "A-シリーズのエンジンコード、排気量、日付スタンプを解析。",
      "needle_configurator_desc": "SU HS2/HS4/HIF44のニードルプロファイルをグラフ重ね表示で並べて比較。",
      "gearbox_calculator_desc": "SPi、MPi、Verto以前の車のファイナルドライブ計算。",
      "compression_calculator_desc": "ボア、ストローク、ヘッドcc、デッキ高さの任意の組み合わせのCR。",
      "alignment_calculator_desc": "キャンバー、キャスター、トーをライブで可視化。ノーマル、ファストロード、トラック、過給のプリセット付き。",
      "parts_equivalency_desc": "ベンダーとブランド間の部品番号のクロスリファレンス。",
      "common_clearances_desc": "タペット隙間、ベアリング公差、組立クリアランス。"
    }
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
      "alignment_calculator": "四轮定位计算器",
      "parts_equivalency": "零件等效性",
      "common_clearances": "常见间隙",
      "kind": {
        "calculator": "计算器",
        "decoder": "解码器",
        "reference": "参考"
      },
      "torque_specs_desc": "一张可搜索的表格，涵盖 A-Series 和辅件的每一个扭矩值。",
      "chassis_decoder_desc": "从你的VIN/车架号解析年份、工厂和配置。",
      "engine_decoder_desc": "解码 A-Series 发动机代码、排量和日期戳。",
      "needle_configurator_desc": "通过图表叠加并排比较 SU HS2/HS4/HIF44 化油器针型。",
      "gearbox_calculator_desc": "适用于 SPi、MPi 和 Verto 之前车型的主减速比计算。",
      "compression_calculator_desc": "适用于任意缸径、行程、燃烧室容积和甲板高度组合的CR计算。",
      "alignment_calculator_desc": "实时可视化外倾角、主销后倾角和前束，配有原厂、高性能街道、赛道和增压预设。",
      "parts_equivalency_desc": "跨供应商和品牌的零件号交叉参考。",
      "common_clearances_desc": "气门间隙、轴承公差和装配间隙。"
    }
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
      "alignment_calculator": "얼라인먼트 계산기",
      "parts_equivalency": "부품 등가성",
      "common_clearances": "일반적인 클리어런스",
      "kind": {
        "calculator": "계산기",
        "decoder": "디코더",
        "reference": "참조"
      },
      "torque_specs_desc": "A-시리즈와 보조 부품의 모든 토크 값을 검색 가능한 하나의 차트에.",
      "chassis_decoder_desc": "VIN/섀시 번호로 연도, 공장, 트림 정보를 파악.",
      "engine_decoder_desc": "A-시리즈 엔진 코드, 배기량, 날짜 각인 해독.",
      "needle_configurator_desc": "차트 오버레이로 SU HS2/HS4/HIF44 니들 프로파일을 나란히 비교.",
      "gearbox_calculator_desc": "SPi, MPi, Verto 이전 차량을 위한 최종 감속비 계산.",
      "compression_calculator_desc": "보어, 스트로크, 헤드 cc, 데크 높이의 모든 조합에 대한 CR.",
      "alignment_calculator_desc": "캠버, 캐스터, 토를 실시간으로 시각화하고, 순정, 패스트 로드, 트랙, 부스트용 프리셋을 제공합니다.",
      "parts_equivalency_desc": "공급업체와 브랜드 간 부품 번호 교차 참조.",
      "common_clearances_desc": "태핏 갭, 베어링 공차, 조립 간극."
    }
  }
}
</i18n>
