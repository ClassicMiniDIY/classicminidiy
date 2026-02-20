<script lang="ts" setup>
  import { DateTime } from 'luxon';

  const birthday = DateTime.local(1989, 5, 11);
  const today = DateTime.now();
  const age = ref<string | undefined>(today.diff(birthday, 'years').toObject().years?.toFixed(0));

  useHead({
    title: $t('home.title'),
    meta: [
      {
        name: 'description',
        content: $t('home.description'),
      },
      {
        name: 'keywords',
        content: $t('home.keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // WebSite structured data for home page
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Classic Mini DIY',
    url: 'https://classicminidiy.com',
    description: $t('home.description'),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://classicminidiy.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Classic Mini DIY',
      logo: {
        '@type': 'ImageObject',
        url: 'https://classicminidiy.s3.amazonaws.com/misc/seo-images/avatar.jpg',
      },
      sameAs: [
        'https://www.youtube.com/c/ClassicMiniDIY',
        'https://www.facebook.com/classicminidiy',
        'https://www.instagram.com/classicminidiy/',
      ],
    },
  };

  // Add JSON-LD structured data to head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(websiteJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('home.title'),
    ogDescription: $t('home.description'),
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
    ogUrl: 'https://classicminidiy.com',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('home.title'),
    twitterDescription: $t('home.description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
  });
</script>

<template>
  <HeroPromo />
  <div class="spacer layer"></div>
  <div class="container mx-auto px-4 pt-10">
    <div class="grid grid-cols-12 gap-4 pb-5">
      <div class="col-span-12"></div>
      <div class="col-span-12 md:col-span-8">
        <h2 class="fancy-font-book-oblique"><i class="fad fa-book"></i> {{ $t('home.mission.title') }}</h2>
        <h3 class="text-3xl font-bold pt-2 pb-3">{{ $t('home.mission.heading') }}</h3>
        <p class="text-lg pb-5">
          {{ $t('home.mission.content') }}
        </p>
        <stats />
      </div>
      <div class="col-span-12 md:col-span-4">
        <h3 class="fancy-font-book-oblique"><i class="fad fa-gift"></i> {{ $t('home.support.title') }}</h3>
        <h4 class="text-3xl font-bold pt-2 pb-3">{{ $t('home.support.heading') }}</h4>
        <p class="text-lg pt-2 pb-3">
          {{ $t('home.support.content') }}
        </p>
        <UButton
          class="mr-3 text-lg is-patreon"
          rel="noopener"
          to="https://patreon.com/classicminidiy"
          target="_blank"
          external
        >
          <i class="fab fa-patreon mr-2" />
          {{ $t('common.donate') }}
        </UButton>
        <UButton
          class="text-lg"
          variant="outline"
          rel="noopener"
          to="https://github.com/somethingnew71/classicminidiy"
          target="_blank"
          external
        >
          <i class="fab fa-github mr-2" />
          {{ $t('common.contribute') }}
        </UButton>
      </div>
      <div class="pt-20 pb-10 grid grid-cols-subgrid col-span-12 gap-4">
        <recent-videos></recent-videos>
      </div>
    </div>
  </div>
  <div class="spacer layer1"></div>
  <div class="bg-[#f0f0f0] dark:bg-[#171717]">
    <div class="container mx-auto px-4 pt-10">
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 md:col-span-5">
          <video autoplay loop muted playsinline>
            <source src="https://classicminidiy.s3.amazonaws.com/misc/grey-tool-animation.webm" type="video/webm" />
            <source src="https://classicminidiy.s3.amazonaws.com/misc/grey-tool-animation.mp4" type="video/mp4" />
          </video>
        </div>
        <div class="col-span-12 md:col-span-7">
          <h3 class="fancy-font-book-oblique"><i class="fad fa-handshake-alt"></i> {{ $t('home.toolbox.title') }}</h3>
          <h3 class="text-3xl font-bold">{{ $t('home.toolbox.heading') }}</h3>
          <h4 class="fancy-font-book-oblique pt-5 pb-5">{{ $t('home.toolbox.subtitle') }}</h4>
          <p class="pb-5 text-lg">
            {{ $t('home.toolbox.content') }}
          </p>
          <UButton color="primary" class="text-lg" to="/technical"> {{ $t('home.toolbox.button') }} </UButton>
        </div>
      </div>
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 md:col-span-8 lg:col-span-6">
          <h3 class="fancy-font-book-oblique pb-5">
            <i class="fad fa-hands-heart"></i> {{ $t('home.patreon.title') }}
          </h3>
          <h3 class="text-3xl font-bold pb-5">{{ $t('home.patreon.heading') }}</h3>
          <p class="text-lg">
            {{ $t('home.patreon.content') }}
          </p>
          <UButton
            class="mt-5 mb-5 is-patreon"
            rel="noopener"
            to="https://patreon.com/classicminidiy"
            target="_blank"
            external
          >
            <i class="fab fa-patreon mr-2" />
            {{ $t('home.patreon.button') }}
          </UButton>

          <div class="max-w-2xl mx-auto">
            <UCard class="mt-5 max-w-md">
              <template #header>
                <h3 class="text-xl font-bold leading-none">{{ $t('home.patreon.benefits.title') }}</h3>
              </template>
              <ul role="list" class="divide-y divide-default benefits-list">
                <li class="py-3 sm:py-4">
                  <div class="flex items-center space-x-4">
                    <div class="shrink-0">
                      <i class="text-h4 fab fa-discord pt-2"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-lg font-medium">{{ $t('home.patreon.benefits.discord') }}</p>
                    </div>
                  </div>
                </li>
                <li class="py-3 sm:py-4">
                  <div class="flex items-center space-x-4">
                    <div class="shrink-0">
                      <i class="text-h4 fad fa-video pt-2"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-lg font-medium">{{ $t('home.patreon.benefits.early_access') }}</p>
                    </div>
                  </div>
                </li>
                <li class="py-3 sm:py-4">
                  <div class="flex items-center space-x-4">
                    <div class="shrink-0">
                      <i class="text-h4 fad fa-gift pt-2"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-lg font-medium">{{ $t('home.patreon.benefits.gifts') }}</p>
                    </div>
                  </div>
                </li>
                <li class="py-3 sm:py-4">
                  <div class="flex items-center space-x-4">
                    <div class="shrink-0">
                      <i class="text-h4 fad fa-circle-info pt-2"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-lg font-medium">{{ $t('home.patreon.benefits.insider') }}</p>
                    </div>
                  </div>
                </li>
              </ul>
            </UCard>
          </div>
        </div>
        <div class="col-span-12 md:col-span-6">
          <browser class="browser is-hidden-touch" />
        </div>
      </div>
    </div>
  </div>
  <div class="spacer layer2"></div>
  <div class="mb-5">
    <div class="container mx-auto px-4">
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 md:col-span-7 mb-5 pb-10">
          <h3 class="fancy-font-bold text-2xl"><i class="fad fa-address-card"></i> {{ $t('home.about.title') }}</h3>
          <h4 class="fancy-font-book-oblique pt-5">{{ $t('home.about.name') }}</h4>
          <p>
            {{ $t('home.about.bio', { age: age }) }}
          </p>
          <h3 class="fancy-font-book-oblique pt-10">{{ $t('home.about.promise_title') }}</h3>
          <p>
            {{ $t('home.about.promise') }}
          </p>
        </div>
        <div class="col-span-12 md:col-span-5 avatar-container">
          <nuxt-img
            src="https://classicminidiy.s3.amazonaws.com/misc/about-me.webp"
            alt="Image of my car on jack stands"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Floating Chat Input -->
  <FloatingChatInput />
</template>

<style lang="scss">
  .animation-section,
  .avatar-container img {
    max-width: 90%;
    margin: auto;
    margin-top: 35px;
    display: block;
    border-radius: 50px;
  }
</style>

<i18n lang="json">
{
  "en": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "YOUR FRIENDLY NEIGHBORHOOD"
    },
    "common": {
      "donate": "Donate",
      "contribute": "Contribute"
    },
    "home": {
      "title": "Classic Mini DIY | Your Friendly Neighborhood Classic Mini Resource",
      "description": "Classic Mini DIY - Your complete resource for Classic Mini restoration, maintenance, and modification. DIY tutorials, technical guides, and community support.",
      "keywords": "classic mini, mini cooper, mini restoration, DIY car repair, classic mini parts, mini cooper maintenance, british cars, classic car restoration, mini toolbox, automotive DIY",
      "mission": {
        "title": "THE MINI MISSION",
        "heading": "Keeping the Classics on the Road",
        "content": "Classic Mini DIY started out of my small driveway workshop in 2015. I always focus on two things: keeping your Classic Mini on the road and making DIY car work accessible for all skill levels. I make DIY videos and tutorials showing exactly how to complete a wide range of jobs on your Classic Mini. I also partner with world-class manufacturers to deliver top-of-the-line products to personalize and ensure the performance of your Classic Mini."
      },
      "support": {
        "title": "SUPPORT THE MISSION",
        "heading": "Support",
        "content": "Classic Mini DIY is supported by our viewers. If you are interested in helping to keep the channel alive, consider supporting on Patreon or if you have skills in JS and modern web technologies, please consider supporting the open source codebase on github."
      },
      "toolbox": {
        "title": "THE COMPLETELY FREE",
        "heading": "Classic Mini Toolbox",
        "subtitle": "THE TOOLKIT FOR THE DIY MECHANIC",
        "content": "One of the largest reasons for starting this channel, was about making infromation related to working your Mini Cooper more accessible. In service to this goal I have created the Classic Mini Toolbox. Combining information from all over the web to bring you one location to find anything you need.",
        "button": "Open the toolbox"
      },
      "patreon": {
        "title": "SUPPORT THE CHANNEL",
        "heading": "Become a Patreon",
        "content": "Classic Mini DIY is completely free resource supported by our viewers. If you are interested in helping to keep the channel alive, consider supporting on Patreon.",
        "button": "Become a Member",
        "benefits": {
          "title": "Membership Includes",
          "discord": "Access to Live DIY Chat",
          "early_access": "Early Access to videos",
          "gifts": "Free gifts and merch",
          "insider": "Insider information and much more..."
        }
      },
      "about": {
        "title": "About Me",
        "name": "MY NAME IS COLE",
        "bio": "I am a {age}-year-old Web Developer working in the financial industry. My experience in the automotive industry comes from 2 years of training on heavy diesel machinery and 8 years of Classic Mini ownership. With this experience, I do my best to provide the most comprehensive and technically correct information I can.",
        "promise_title": "MY PROMISE",
        "promise": "I will provide you with all the knowledge I can to the best of my ability. I will also accept feedback in the event that I get something incorrect. I am an enthusiast and not a complete expert so from time to time I will make mistakes."
      }
    }
  },
  "es": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "TU RECURSO AMIGABLE DEL BARRIO"
    },
    "common": {
      "donate": "Donar",
      "contribute": "Contribuir"
    },
    "home": {
      "title": "Classic Mini DIY | Tu Recurso Amigable del Barrio para Classic Mini",
      "description": "Classic Mini DIY - Tu recurso completo para restauración, mantenimiento y modificación de Classic Mini. Tutoriales DIY, guías técnicas y apoyo comunitario.",
      "keywords": "classic mini, mini cooper, restauración mini, reparación de coches DIY, piezas classic mini, mantenimiento mini cooper, coches británicos, restauración coches clásicos",
      "mission": {
        "title": "LA MISIÓN MINI",
        "heading": "Manteniendo los Clásicos en la Carretera",
        "content": "Classic Mini DIY comenzó en mi pequeño taller de entrada en 2015. Siempre me enfoco en dos cosas: mantener tu Classic Mini en la carretera y hacer el trabajo DIY de automóviles accesible para todos los niveles de habilidad. Hago videos DIY y tutoriales mostrando exactamente cómo completar una amplia gama de trabajos en tu Classic Mini. También me asocio con fabricantes de clase mundial para entregar productos de primera línea para personalizar y asegurar el rendimiento de tu Classic Mini."
      },
      "support": {
        "title": "APOYA LA MISIÓN",
        "heading": "Apoyo",
        "content": "Classic Mini DIY es apoyado por nuestros espectadores. Si estás interesado en ayudar a mantener el canal vivo, considera apoyar en Patreon o si tienes habilidades en JS y tecnologías web modernas, por favor considera apoyar la base de código de código abierto en github."
      },
      "toolbox": {
        "title": "LA COMPLETAMENTE GRATUITA",
        "heading": "Caja de Herramientas Classic Mini",
        "subtitle": "EL CONJUNTO DE HERRAMIENTAS PARA EL MECÁNICO DIY",
        "content": "Una de las razones más grandes para comenzar este canal, fue hacer más accesible la información relacionada con trabajar en tu Mini Cooper. En servicio a este objetivo he creado la Caja de Herramientas Classic Mini. Combinando información de toda la web para traerte un lugar donde encontrar todo lo que necesitas.",
        "button": "Abrir la caja de herramientas"
      },
      "patreon": {
        "title": "APOYA EL CANAL",
        "heading": "Conviértete en Patreon",
        "content": "Classic Mini DIY es un recurso completamente gratuito apoyado por nuestros espectadores. Si estás interesado en ayudar a mantener el canal vivo, considera apoyar en Patreon.",
        "button": "Conviértete en Miembro",
        "benefits": {
          "title": "La Membresía Incluye",
          "discord": "Acceso al Chat DIY en Vivo",
          "early_access": "Acceso Temprano a videos",
          "gifts": "Regalos gratuitos y mercancía",
          "insider": "Información privilegiada y mucho más..."
        }
      },
      "about": {
        "title": "Acerca de Mí",
        "name": "MI NOMBRE ES COLE",
        "bio": "Soy un Desarrollador Web de {age} años trabajando en la industria financiera. Mi experiencia en la industria automotriz viene de 2 años de entrenamiento en maquinaria diesel pesada y 8 años de propiedad de Classic Mini. Con esta experiencia, hago mi mejor esfuerzo para proporcionar la información más completa y técnicamente correcta que puedo.",
        "promise_title": "MI PROMESA",
        "promise": "Te proporcionaré todo el conocimiento que pueda con la mejor de mis habilidades. También aceptaré comentarios en caso de que me equivoque en algo. Soy un entusiasta y no un experto completo, así que de vez en cuando cometeré errores."
      }
    }
  },
  "fr": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "VOTRE RESSOURCE AMICALE DE QUARTIER"
    },
    "common": {
      "donate": "Faire un don",
      "contribute": "Contribuer"
    },
    "home": {
      "title": "Classic Mini DIY | Votre Ressource Amicale de Quartier pour Classic Mini",
      "description": "Classic Mini DIY - Votre ressource complète pour la restauration, l'entretien et la modification de Classic Mini. Tutoriels DIY, guides techniques et support communautaire.",
      "keywords": "classic mini, mini cooper, restauration mini, réparation voiture DIY, pièces classic mini, entretien mini cooper, voitures britanniques, restauration voitures classiques",
      "mission": {
        "title": "LA MISSION MINI",
        "heading": "Garder les Classiques sur la Route",
        "content": "Classic Mini DIY a commencé dans mon petit atelier d'allée en 2015. Je me concentre toujours sur deux choses : garder votre Classic Mini sur la route et rendre le travail DIY automobile accessible à tous les niveaux de compétence. Je fais des vidéos DIY et des tutoriels montrant exactement comment accomplir une large gamme de travaux sur votre Classic Mini. Je m'associe également avec des fabricants de classe mondiale pour livrer des produits haut de gamme pour personnaliser et assurer les performances de votre Classic Mini."
      },
      "support": {
        "title": "SOUTENIR LA MISSION",
        "heading": "Soutien",
        "content": "Classic Mini DIY est soutenu par nos spectateurs. Si vous êtes intéressé à aider à maintenir la chaîne en vie, considérez soutenir sur Patreon ou si vous avez des compétences en JS et technologies web modernes, veuillez considérer soutenir la base de code open source sur github."
      },
      "toolbox": {
        "title": "LA COMPLÈTEMENT GRATUITE",
        "heading": "Boîte à Outils Classic Mini",
        "subtitle": "LA TROUSSE À OUTILS POUR LE MÉCANICIEN DIY",
        "content": "Une des plus grandes raisons pour commencer cette chaîne, était de rendre l'information liée au travail sur votre Mini Cooper plus accessible. Au service de cet objectif j'ai créé la Boîte à Outils Classic Mini. Combinant des informations de partout sur le web pour vous apporter un endroit où trouver tout ce dont vous avez besoin.",
        "button": "Ouvrir la boîte à outils"
      },
      "patreon": {
        "title": "SOUTENIR LA CHAÎNE",
        "heading": "Devenir un Patreon",
        "content": "Classic Mini DIY est une ressource complètement gratuite soutenue par nos spectateurs. Si vous êtes intéressé à aider à maintenir la chaîne en vie, considérez soutenir sur Patreon.",
        "button": "Devenir Membre",
        "benefits": {
          "title": "L'Adhésion Inclut",
          "discord": "Accès au Chat DIY en Direct",
          "early_access": "Accès Anticipé aux vidéos",
          "gifts": "Cadeaux gratuits et marchandises",
          "insider": "Informations privilégiées et bien plus..."
        }
      },
      "about": {
        "title": "À Propos de Moi",
        "name": "MON NOM EST COLE",
        "bio": "Je suis un Développeur Web de {age} ans travaillant dans l'industrie financière. Mon expérience dans l'industrie automobile vient de 2 ans de formation sur les machines diesel lourdes et 8 ans de propriété de Classic Mini. Avec cette expérience, je fais de mon mieux pour fournir l'information la plus complète et techniquement correcte que je peux.",
        "promise_title": "MA PROMESSE",
        "promise": "Je vous fournirai toute la connaissance que je peux au meilleur de mes capacités. J'accepterai également les commentaires dans le cas où j'obtiens quelque chose d'incorrect. Je suis un passionné et non un expert complet donc de temps en temps je ferai des erreurs."
      }
    }
  },
  "it": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "LA TUA RISORSA AMICHEVOLE DI QUARTIERE"
    },
    "common": {
      "donate": "Dona",
      "contribute": "Contribuisci"
    },
    "home": {
      "title": "Classic Mini DIY | La Tua Risorsa Amichevole di Quartiere per Classic Mini",
      "description": "Classic Mini DIY - La tua risorsa completa per restauro, manutenzione e modifica di Classic Mini. Tutorial fai-da-te, guide tecniche e supporto della comunità.",
      "keywords": "classic mini, mini cooper, restauro mini, riparazione auto fai-da-te, ricambi classic mini, manutenzione mini cooper, auto britanniche, restauro auto classiche",
      "mission": {
        "title": "LA MISSIONE MINI",
        "heading": "Mantenere i Classici sulla Strada",
        "content": "Classic Mini DIY è iniziato nel mio piccolo laboratorio del vialetto nel 2015. Mi concentro sempre su due cose: mantenere la tua Classic Mini sulla strada e rendere il lavoro fai-da-te automobilistico accessibile a tutti i livelli di abilità. Creo video fai-da-te e tutorial che mostrano esattamente come completare una vasta gamma di lavori sulla tua Classic Mini. Collaboro anche con produttori di classe mondiale per fornire prodotti di prima qualità per personalizzare e garantire le prestazioni della tua Classic Mini."
      },
      "support": {
        "title": "SOSTIENI LA MISSIONE",
        "heading": "Supporto",
        "content": "Classic Mini DIY è supportato dai nostri spettatori. Se sei interessato ad aiutare a mantenere vivo il canale, considera di supportare su Patreon o se hai competenze in JS e tecnologie web moderne, considera di supportare la base di codice open source su github."
      },
      "toolbox": {
        "title": "LA COMPLETAMENTE GRATUITA",
        "heading": "Cassetta degli Attrezzi Classic Mini",
        "subtitle": "IL KIT DI STRUMENTI PER IL MECCANICO FAI-DA-TE",
        "content": "Una delle ragioni principali per iniziare questo canale era rendere più accessibili le informazioni relative al lavoro sulla tua Mini Cooper. Al servizio di questo obiettivo ho creato la Cassetta degli Attrezzi Classic Mini. Combinando informazioni da tutto il web per portarti un posto dove trovare tutto ciò di cui hai bisogno.",
        "button": "Apri la cassetta degli attrezzi"
      },
      "patreon": {
        "title": "SOSTIENI IL CANALE",
        "heading": "Diventa un Patreon",
        "content": "Classic Mini DIY è una risorsa completamente gratuita supportata dai nostri spettatori. Se sei interessato ad aiutare a mantenere vivo il canale, considera di supportare su Patreon.",
        "button": "Diventa Membro",
        "benefits": {
          "title": "L'Iscrizione Include",
          "discord": "Accesso alla Chat DIY dal Vivo",
          "early_access": "Accesso Anticipato ai video",
          "gifts": "Regali gratuiti e merchandise",
          "insider": "Informazioni privilegiate e molto altro..."
        }
      },
      "about": {
        "title": "Chi Sono",
        "name": "IL MIO NOME È COLE",
        "bio": "Sono uno Sviluppatore Web di {age} anni che lavora nell'industria finanziaria. La mia esperienza nell'industria automobilistica deriva da 2 anni di formazione su macchinari diesel pesanti e 8 anni di proprietà di Classic Mini. Con questa esperienza, faccio del mio meglio per fornire le informazioni più complete e tecnicamente corrette che posso.",
        "promise_title": "LA MIA PROMESSA",
        "promise": "Ti fornirò tutta la conoscenza che posso al meglio delle mie capacità. Accetterò anche feedback nel caso in cui sbagli qualcosa. Sono un appassionato e non un esperto completo, quindi di tanto in tanto commetterò errori."
      }
    }
  },
  "de": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "IHRE FREUNDLICHE NACHBARSCHAFTSRESSOURCE"
    },
    "common": {
      "donate": "Spenden",
      "contribute": "Beitragen"
    },
    "home": {
      "title": "Classic Mini DIY | Ihre Freundliche Nachbarschaftsressource für Classic Mini",
      "description": "Classic Mini DIY - Ihre vollständige Ressource für Classic Mini Restaurierung, Wartung und Modifikation. DIY-Tutorials, technische Anleitungen und Community-Support.",
      "keywords": "classic mini, mini cooper, mini restaurierung, DIY autoreparatur, classic mini ersatzteile, mini cooper wartung, britische autos, oldtimer restaurierung",
      "mission": {
        "title": "DIE MINI MISSION",
        "heading": "Die Klassiker auf der Straße halten",
        "content": "Classic Mini DIY begann in meiner kleinen Einfahrt-Werkstatt im Jahr 2015. Ich konzentriere mich immer auf zwei Dinge: Ihren Classic Mini auf der Straße zu halten und DIY-Autoarbeit für alle Fertigkeitsstufen zugänglich zu machen. Ich erstelle DIY-Videos und Tutorials, die genau zeigen, wie man eine breite Palette von Arbeiten an Ihrem Classic Mini durchführt. Ich arbeite auch mit Weltklasse-Herstellern zusammen, um erstklassige Produkte zu liefern, um Ihren Classic Mini zu personalisieren und die Leistung zu gewährleisten."
      },
      "support": {
        "title": "UNTERSTÜTZEN SIE DIE MISSION",
        "heading": "Unterstützung",
        "content": "Classic Mini DIY wird von unseren Zuschauern unterstützt. Wenn Sie daran interessiert sind, den Kanal am Leben zu erhalten, ziehen Sie in Betracht, auf Patreon zu unterstützen, oder wenn Sie Fähigkeiten in JS und modernen Web-Technologien haben, ziehen Sie bitte in Betracht, die Open-Source-Codebasis auf GitHub zu unterstützen."
      },
      "toolbox": {
        "title": "DIE VÖLLIG KOSTENLOSE",
        "heading": "Classic Mini Werkzeugkasten",
        "subtitle": "DAS TOOLKIT FÜR DEN DIY-MECHANIKER",
        "content": "Einer der größten Gründe für den Start dieses Kanals war es, Informationen über die Arbeit an Ihrem Mini Cooper zugänglicher zu machen. Im Dienste dieses Ziels habe ich den Classic Mini Werkzeugkasten erstellt. Kombiniert Informationen aus dem gesamten Web, um Ihnen einen Ort zu bieten, an dem Sie alles finden, was Sie brauchen.",
        "button": "Werkzeugkasten öffnen"
      },
      "patreon": {
        "title": "UNTERSTÜTZEN SIE DEN KANAL",
        "heading": "Werden Sie ein Patreon",
        "content": "Classic Mini DIY ist eine völlig kostenlose Ressource, die von unseren Zuschauern unterstützt wird. Wenn Sie daran interessiert sind, den Kanal am Leben zu erhalten, ziehen Sie in Betracht, auf Patreon zu unterstützen.",
        "button": "Mitglied werden",
        "benefits": {
          "title": "Mitgliedschaft beinhaltet",
          "discord": "Zugang zum Live DIY Chat",
          "early_access": "Frühzugang zu Videos",
          "gifts": "Kostenlose Geschenke und Merchandise",
          "insider": "Insider-Informationen und vieles mehr..."
        }
      },
      "about": {
        "title": "Über mich",
        "name": "MEIN NAME IST COLE",
        "bio": "Ich bin ein {age}-jähriger Webentwickler, der in der Finanzbranche arbeitet. Meine Erfahrung in der Automobilindustrie stammt aus 2 Jahren Ausbildung an schweren Dieselmaschinen und 8 Jahren Classic Mini Besitz. Mit dieser Erfahrung gebe ich mein Bestes, um die umfassendsten und technisch korrektesten Informationen zu liefern, die ich kann.",
        "promise_title": "MEIN VERSPRECHEN",
        "promise": "Ich werde Ihnen alles Wissen zur Verfügung stellen, das ich nach besten Kräften kann. Ich werde auch Feedback akzeptieren, falls ich etwas falsch verstehe. Ich bin ein Enthusiast und kein vollständiger Experte, also werde ich von Zeit zu Zeit Fehler machen."
      }
    }
  },
  "pt": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "SEU RECURSO AMIGÁVEL DA VIZINHANÇA"
    },
    "common": {
      "donate": "Doar",
      "contribute": "Contribuir"
    },
    "home": {
      "title": "Classic Mini DIY | Seu Recurso Amigável da Vizinhança para Classic Mini",
      "description": "Classic Mini DIY - Seu recurso completo para restauração, manutenção e modificação de Classic Mini. Tutoriais DIY, guias técnicos e suporte da comunidade.",
      "keywords": "classic mini, mini cooper, restauração mini, reparo de carros DIY, peças classic mini, manutenção mini cooper, carros britânicos, restauração carros clássicos",
      "mission": {
        "title": "A MISSÃO MINI",
        "heading": "Mantendo os Clássicos na Estrada",
        "content": "Classic Mini DIY começou na minha pequena oficina da garagem em 2015. Sempre me foco em duas coisas: manter seu Classic Mini na estrada e tornar o trabalho DIY automotivo acessível para todos os níveis de habilidade. Faço vídeos DIY e tutoriais mostrando exatamente como completar uma ampla gama de trabalhos no seu Classic Mini. Também faço parcerias com fabricantes de classe mundial para entregar produtos de primeira linha para personalizar e garantir o desempenho do seu Classic Mini."
      },
      "support": {
        "title": "APOIE A MISSÃO",
        "heading": "Apoio",
        "content": "Classic Mini DIY é apoiado pelos nossos espectadores. Se você está interessado em ajudar a manter o canal vivo, considere apoiar no Patreon ou se você tem habilidades em JS e tecnologias web modernas, por favor considere apoiar a base de código open source no github."
      },
      "toolbox": {
        "title": "A COMPLETAMENTE GRATUITA",
        "heading": "Caixa de Ferramentas Classic Mini",
        "subtitle": "O KIT DE FERRAMENTAS PARA O MECÂNICO DIY",
        "content": "Uma das maiores razões para começar este canal foi tornar as informações relacionadas ao trabalho no seu Mini Cooper mais acessíveis. A serviço deste objetivo criei a Caixa de Ferramentas Classic Mini. Combinando informações de toda a web para trazer a você um local onde encontrar tudo que precisa.",
        "button": "Abrir a caixa de ferramentas"
      },
      "patreon": {
        "title": "APOIE O CANAL",
        "heading": "Torne-se um Patreon",
        "content": "Classic Mini DIY é um recurso completamente gratuito apoiado pelos nossos espectadores. Se você está interessado em ajudar a manter o canal vivo, considere apoiar no Patreon.",
        "button": "Torne-se Membro",
        "benefits": {
          "title": "A Associação Inclui",
          "discord": "Acesso ao Chat DIY ao Vivo",
          "early_access": "Acesso Antecipado aos vídeos",
          "gifts": "Presentes gratuitos e mercadorias",
          "insider": "Informações privilegiadas e muito mais..."
        }
      },
      "about": {
        "title": "Sobre Mim",
        "name": "MEU NOME É COLE",
        "bio": "Sou um Desenvolvedor Web de {age} anos trabalhando na indústria financeira. Minha experiência na indústria automotiva vem de 2 anos de treinamento em máquinas diesel pesadas e 8 anos de propriedade de Classic Mini. Com esta experiência, faço o meu melhor para fornecer as informações mais abrangentes e tecnicamente corretas que posso.",
        "promise_title": "MINHA PROMESSA",
        "promise": "Fornecerei todo o conhecimento que posso com o melhor das minhas habilidades. Também aceitarei feedback no caso de eu errar algo. Sou um entusiasta e não um especialista completo, então de tempos em tempos cometerei erros."
      }
    }
  },
  "ru": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "ВАШ ДРУЖЕЛЮБНЫЙ СОСЕДСКИЙ РЕСУРС"
    },
    "common": {
      "donate": "Пожертвовать",
      "contribute": "Внести вклад"
    },
    "home": {
      "title": "Classic Mini DIY | Ваш Дружелюбный Соседский Ресурс для Classic Mini",
      "description": "Classic Mini DIY - Ваш полный ресурс для реставрации, обслуживания и модификации Classic Mini. DIY учебники, технические руководства и поддержка сообщества.",
      "keywords": "classic mini, mini cooper, реставрация мини, ремонт автомобилей своими руками, запчасти classic mini, обслуживание mini cooper, британские автомобили, реставрация классических авто",
      "mission": {
        "title": "МИССИЯ МИНИ",
        "heading": "Сохраняя Классику на Дорогах",
        "content": "Classic Mini DIY начался в моей маленькой гаражной мастерской в 2015 году. Я всегда сосредотачиваюсь на двух вещах: сохранить ваш Classic Mini на дороге и сделать DIY автомобильную работу доступной для всех уровней навыков. Я создаю DIY видео и учебники, показывающие точно, как выполнить широкий спектр работ на вашем Classic Mini. Я также сотрудничаю с производителями мирового класса для поставки первоклассных продуктов для персонализации и обеспечения производительности вашего Classic Mini."
      },
      "support": {
        "title": "ПОДДЕРЖИТЕ МИССИЮ",
        "heading": "Поддержка",
        "content": "Classic Mini DIY поддерживается нашими зрителями. Если вы заинтересованы в том, чтобы помочь сохранить канал живым, рассмотрите поддержку на Patreon или если у вас есть навыки в JS и современных веб-технологиях, пожалуйста, рассмотрите поддержку базы кода с открытым исходным кодом на github."
      },
      "toolbox": {
        "title": "ПОЛНОСТЬЮ БЕСПЛАТНЫЙ",
        "heading": "Набор Инструментов Classic Mini",
        "subtitle": "НАБОР ИНСТРУМЕНТОВ ДЛЯ DIY МЕХАНИКА",
        "content": "Одной из главных причин для запуска этого канала было сделать информацию, связанную с работой на вашем Mini Cooper, более доступной. В служении этой цели я создал Набор Инструментов Classic Mini. Объединяя информацию со всего интернета, чтобы принести вам одно место, где можно найти все, что вам нужно.",
        "button": "Открыть набор инструментов"
      },
      "patreon": {
        "title": "ПОДДЕРЖИТЕ КАНАЛ",
        "heading": "Станьте Патреоном",
        "content": "Classic Mini DIY - это полностью бесплатный ресурс, поддерживаемый нашими зрителями. Если вы заинтересованы в том, чтобы помочь сохранить канал живым, рассмотрите поддержку на Patreon.",
        "button": "Стать Участником",
        "benefits": {
          "title": "Членство Включает",
          "discord": "Доступ к Живому DIY Чату",
          "early_access": "Ранний Доступ к видео",
          "gifts": "Бесплатные подарки и товары",
          "insider": "Инсайдерская информация и многое другое..."
        }
      },
      "about": {
        "title": "Обо Мне",
        "name": "МЕНЯ ЗОВУТ КОУЛ",
        "bio": "Я {age}-летний Веб-Разработчик, работающий в финансовой индустрии. Мой опыт в автомобильной индустрии происходит от 2 лет обучения на тяжелой дизельной технике и 8 лет владения Classic Mini. С этим опытом я делаю все возможное, чтобы предоставить самую полную и технически правильную информацию, которую могу.",
        "promise_title": "МОЕ ОБЕЩАНИЕ",
        "promise": "Я предоставлю вам все знания, которые могу, в меру своих способностей. Я также приму обратную связь в случае, если я получу что-то неправильно. Я энтузиаст, а не полный эксперт, поэтому время от времени я буду делать ошибки."
      }
    }
  },
  "ja": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "あなたの親しみやすい近所のリソース"
    },
    "common": {
      "donate": "寄付",
      "contribute": "貢献"
    },
    "home": {
      "title": "Classic Mini DIY | あなたの親しみやすい近所のClassic Miniリソース",
      "description": "Classic Mini DIY - Classic Miniの復元、メンテナンス、改造のための完全なリソース。DIYチュートリアル、技術ガイド、コミュニティサポート。",
      "keywords": "クラシックミニ, ミニクーパー, ミニ修復, DIY車修理, クラシックミニ部品, ミニクーパーメンテナンス, 英国車, クラシックカー修復",
      "mission": {
        "title": "ミニミッション",
        "heading": "クラシックを道路に保つ",
        "content": "Classic Mini DIYは2015年に私の小さなドライブウェイワークショップから始まりました。私は常に2つのことに焦点を当てています：あなたのClassic Miniを道路に保つことと、すべてのスキルレベルでDIY自動車作業をアクセシブルにすることです。私はあなたのClassic Miniで幅広い作業を完了する方法を正確に示すDIYビデオとチュートリアルを作成します。また、世界クラスのメーカーと提携して、あなたのClassic Miniをパーソナライズし、パフォーマンスを確保するためのトップクラスの製品を提供します。"
      },
      "support": {
        "title": "ミッションをサポート",
        "heading": "サポート",
        "content": "Classic Mini DIYは視聴者によってサポートされています。チャンネルを生き続けるのを手伝うことに興味がある場合は、Patreonでのサポートを検討するか、JSと現代のウェブ技術のスキルがある場合は、githubでオープンソースコードベースのサポートを検討してください。"
      },
      "toolbox": {
        "title": "完全に無料の",
        "heading": "Classic Miniツールボックス",
        "subtitle": "DIYメカニック用のツールキット",
        "content": "このチャンネルを始める最大の理由の一つは、あなたのMini Cooperでの作業に関連する情報をよりアクセシブルにすることでした。この目標に奉仕するために、私はClassic Miniツールボックスを作成しました。ウェブ全体からの情報を組み合わせて、必要なすべてを見つけることができる一つの場所をお届けします。",
        "button": "ツールボックスを開く"
      },
      "patreon": {
        "title": "チャンネルをサポート",
        "heading": "Patreonになる",
        "content": "Classic Mini DIYは視聴者によってサポートされている完全に無料のリソースです。チャンネルを生き続けるのを手伝うことに興味がある場合は、Patreonでのサポートを検討してください。",
        "button": "メンバーになる",
        "benefits": {
          "title": "メンバーシップに含まれるもの",
          "discord": "ライブDIYチャットへのアクセス",
          "early_access": "ビデオへの早期アクセス",
          "gifts": "無料ギフトとグッズ",
          "insider": "インサイダー情報などなど..."
        }
      },
      "about": {
        "title": "私について",
        "name": "私の名前はコール",
        "bio": "私は金融業界で働く{age}歳のウェブ開発者です。自動車業界での私の経験は、重いディーゼル機械での2年間の訓練と8年間のClassic Mini所有から来ています。この経験により、私ができる限り最も包括的で技術的に正確な情報を提供するよう最善を尽くします。",
        "promise_title": "私の約束",
        "promise": "私の能力の最善を尽くして、できる限りの知識をあなたに提供します。また、何か間違ったことがあった場合にはフィードバックも受け入れます。私は愛好家であり完全な専門家ではないので、時々間違いを犯すでしょう。"
      }
    }
  },
  "zh": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "您友好的邻里资源"
    },
    "common": {
      "donate": "捐赠",
      "contribute": "贡献"
    },
    "home": {
      "title": "Classic Mini DIY | 您友好的邻里Classic Mini资源",
      "description": "Classic Mini DIY - 您的Classic Mini修复、维护和改装完整资源。DIY教程、技术指南和社区支持。",
      "keywords": "经典迷你, 迷你库珀, 迷你修复, DIY汽车维修, 经典迷你配件, 迷你库珀保养, 英国汽车, 经典汽车修复",
      "mission": {
        "title": "迷你使命",
        "heading": "让经典车保持在路上",
        "content": "Classic Mini DIY始于2015年我的小车道工作室。我始终专注于两件事：让您的Classic Mini保持在路上，并使DIY汽车工作对所有技能水平都可访问。我制作DIY视频和教程，准确展示如何在您的Classic Mini上完成各种工作。我还与世界级制造商合作，提供顶级产品来个性化并确保您的Classic Mini的性能。"
      },
      "support": {
        "title": "支持使命",
        "heading": "支持",
        "content": "Classic Mini DIY由我们的观众支持。如果您有兴趣帮助保持频道活跃，请考虑在Patreon上支持，或者如果您有JS和现代网络技术技能，请考虑在github上支持开源代码库。"
      },
      "toolbox": {
        "title": "完全免费的",
        "heading": "Classic Mini工具箱",
        "subtitle": "DIY机械师的工具包",
        "content": "启动这个频道的最大原因之一是让与您的Mini Cooper工作相关的信息更加可访问。为了服务这个目标，我创建了Classic Mini工具箱。结合来自整个网络的信息，为您带来一个可以找到所需一切的地方。",
        "button": "打开工具箱"
      },
      "patreon": {
        "title": "支持频道",
        "heading": "成为Patreon",
        "content": "Classic Mini DIY是由我们的观众支持的完全免费资源。如果您有兴趣帮助保持频道活跃，请考虑在Patreon上支持。",
        "button": "成为会员",
        "benefits": {
          "title": "会员包括",
          "discord": "访问实时DIY聊天",
          "early_access": "视频早期访问",
          "gifts": "免费礼品和商品",
          "insider": "内幕信息等等..."
        }
      },
      "about": {
        "title": "关于我",
        "name": "我的名字是科尔",
        "bio": "我是一名在金融行业工作的{age}岁网络开发者。我在汽车行业的经验来自2年的重型柴油机械培训和8年的Classic Mini拥有经验。凭借这些经验，我尽我所能提供最全面和技术上正确的信息。",
        "promise_title": "我的承诺",
        "promise": "我将尽我所能为您提供所有知识。如果我得到不正确的东西，我也会接受反馈。我是一个爱好者而不是完全的专家，所以我会时不时地犯错误。"
      }
    }
  },
  "ko": {
    "hero": {
      "home_title": "Classic Mini DIY",
      "home_subtitle": "당신의 친근한 동네 리소스"
    },
    "common": {
      "donate": "기부",
      "contribute": "기여"
    },
    "home": {
      "title": "Classic Mini DIY | 당신의 친근한 동네 Classic Mini 리소스",
      "description": "Classic Mini DIY - Classic Mini 복원, 유지보수 및 개조를 위한 완전한 리소스. DIY 튜토리얼, 기술 가이드 및 커뮤니티 지원.",
      "keywords": "클래식 미니, 미니 쿠퍼, 미니 복원, DIY 자동차 수리, 클래식 미니 부품, 미니 쿠퍼 유지보수, 영국 자동차, 클래식 자동차 복원",
      "mission": {
        "title": "미니 미션",
        "heading": "클래식을 도로에 유지하기",
        "content": "Classic Mini DIY는 2015년 제 작은 진입로 작업장에서 시작되었습니다. 저는 항상 두 가지에 집중합니다: 당신의 Classic Mini를 도로에 유지하는 것과 모든 기술 수준에서 DIY 자동차 작업을 접근 가능하게 만드는 것입니다. 저는 당신의 Classic Mini에서 광범위한 작업을 완료하는 방법을 정확히 보여주는 DIY 비디오와 튜토리얼을 만듭니다. 또한 세계적 수준의 제조업체와 파트너십을 맺어 당신의 Classic Mini를 개인화하고 성능을 보장하는 최고급 제품을 제공합니다."
      },
      "support": {
        "title": "미션 지원",
        "heading": "지원",
        "content": "Classic Mini DIY는 시청자들의 지원을 받습니다. 채널을 살려두는 데 도움을 주는 데 관심이 있으시면 Patreon에서 지원을 고려해 주시거나, JS와 현대 웹 기술에 기술이 있으시면 github에서 오픈 소스 코드베이스 지원을 고려해 주세요."
      },
      "toolbox": {
        "title": "완전히 무료인",
        "heading": "Classic Mini 도구상자",
        "subtitle": "DIY 정비사를 위한 툴킷",
        "content": "이 채널을 시작한 가장 큰 이유 중 하나는 당신의 Mini Cooper 작업과 관련된 정보를 더 접근하기 쉽게 만드는 것이었습니다. 이 목표를 위해 저는 Classic Mini 도구상자를 만들었습니다. 웹 전체의 정보를 결합하여 필요한 모든 것을 찾을 수 있는 한 곳을 제공합니다.",
        "button": "도구상자 열기"
      },
      "patreon": {
        "title": "채널 지원",
        "heading": "Patreon 되기",
        "content": "Classic Mini DIY는 시청자들의 지원을 받는 완전히 무료 리소스입니다. 채널을 살려두는 데 도움을 주는 데 관심이 있으시면 Patreon에서 지원을 고려해 주세요.",
        "button": "회원 되기",
        "benefits": {
          "title": "멤버십 포함 사항",
          "discord": "라이브 DIY 채팅 액세스",
          "early_access": "비디오 조기 액세스",
          "gifts": "무료 선물 및 상품",
          "insider": "내부자 정보 등등..."
        }
      },
      "about": {
        "title": "저에 대해",
        "name": "제 이름은 콜입니다",
        "bio": "저는 금융 업계에서 일하는 {age}세 웹 개발자입니다. 자동차 업계에서의 제 경험은 중장비 디젤 기계에 대한 2년간의 훈련과 8년간의 Classic Mini 소유에서 나옵니다. 이 경험으로 저는 제가 할 수 있는 가장 포괄적이고 기술적으로 정확한 정보를 제공하기 위해 최선을 다합니다.",
        "promise_title": "제 약속",
        "promise": "저는 제 능력의 최선을 다해 제가 할 수 있는 모든 지식을 제공할 것입니다. 또한 제가 잘못된 것을 얻는 경우 피드백도 받아들일 것입니다. 저는 열정가이지 완전한 전문가가 아니므로 때때로 실수를 할 것입니다."
      }
    }
  }
}
</i18n>

<style lang="scss" scoped>
  .benefits-list {
    .fa-discord {
      color: #7289da;
    }
    .fa-video {
      color: #ff5500;
    }
    .fa-gift {
      color: #45a65e;
    }
    .fa-circle-info {
      color: #ff9900;
    }
  }

  .bg-color-section {
    background-color: #f0f0f0;
  }

  :global(.dark) .bg-color-section {
    background-color: #171717;
  }

  .phone {
    z-index: 2;
    position: relative;
  }
  .panel-icon-home {
    max-width: 70px;
    margin: auto;
  }
  .panel-icon {
    height: 3em;
    width: 3em;
  }
  .grow {
    transition: all 0.2s ease-in-out;
  }
  .grow:hover {
    transform: scale(1.1);
  }
  .footer {
    a {
      font-weight: bold;
    }
  }
</style>
