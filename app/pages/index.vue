<script lang="ts" setup>
  const { t, tm, rt } = useI18n();
  const archiveFeatureItems = computed(() => (tm('home.archive_feature.items') as any[]).map((i) => rt(i)));

  // Normalize offset strings — some entries have "ET" baked in, some don't.
  const formatOffset = (raw: string | undefined): string => {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    return /^ET/i.test(trimmed) ? trimmed : `ET${trimmed}`;
  };

  // Pull the registry's prettiest 6 wheels for the home preview — rank by photo
  // count, break ties alphabetically. Skip placeholder/unnamed entries.
  // Cached server-side via useAsyncData.
  const { listAll } = useWheels();
  const { data: featuredWheels } = await useAsyncData('home-featured-wheels', async () => {
    try {
      const all = await listAll();
      const PLACEHOLDER_NAMES = /^(\(unnamed\)|unnamed|untitled|tbd|n\/a)$/i;
      return all
        .filter((w) => {
          if (!(w.images && w.images.length > 0)) return false;
          if (!w.name || w.name.trim().length < 3) return false;
          if (PLACEHOLDER_NAMES.test(w.name.trim())) return false;
          return true;
        })
        .sort((a, b) => {
          const photoDiff = (b.images?.length || 0) - (a.images?.length || 0);
          if (photoDiff !== 0) return photoDiff;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 6);
    } catch {
      return [];
    }
  });

  useHead({
    title: t('home.title'),
    meta: [
      {
        name: 'description',
        content: t('home.description'),
      },
      {
        name: 'keywords',
        content: t('home.keywords'),
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
    description: t('home.description'),
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
    ogTitle: t('home.title'),
    ogDescription: t('home.description'),
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
    ogUrl: 'https://classicminidiy.com',
    twitterCard: 'summary_large_image',
    twitterTitle: t('home.title'),
    twitterDescription: t('home.description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/root.jpg',
  });
</script>

<template>
  <HeroPromo />
  <div class="spacer layer"></div>

  <!-- Toolbox: 4-up tool card grid (design system) -->
  <section class="container mx-auto px-4 pt-10 pb-14">
    <div class="section-head">
      <div class="meta">
        <span class="eyebrow">{{ t('home.toolgrid.eyebrow') }}</span>
        <h2 class="text-3xl md:text-4xl">{{ t('home.toolgrid.heading') }}</h2>
        <p>{{ t('home.toolgrid.subheading') }}</p>
      </div>
      <NuxtLink to="/technical" class="btn btn-outline btn-sm">
        <i class="fad fa-table-cells mr-1"></i>{{ t('home.toolgrid.all_tools') }}
      </NuxtLink>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <HomeToolCard
        to="/technical/compression"
        icon="fa-calculator"
        icon-primary="#859369"
        :title="t('home.toolgrid.cards.compression.title')"
        :description="t('home.toolgrid.cards.compression.desc')"
        :kind="t('home.toolgrid.kind.calculator')"
      />
      <HomeToolCard
        to="/technical/gearing"
        icon="fa-gears"
        icon-primary="#c49031"
        :title="t('home.toolgrid.cards.gearing.title')"
        :description="t('home.toolgrid.cards.gearing.desc')"
        :kind="t('home.toolgrid.kind.calculator')"
      />
      <HomeToolCard
        to="/technical/chassis-decoder"
        icon="fa-hashtag"
        :title="t('home.toolgrid.cards.chassis.title')"
        :description="t('home.toolgrid.cards.chassis.desc')"
        :kind="t('home.toolgrid.kind.decoder')"
      />
      <HomeToolCard
        to="/technical/needles"
        icon="fa-chart-line"
        icon-primary="#b74d36"
        icon-secondary="#417bbd"
        :icon-secondary-opacity="0.8"
        :title="t('home.toolgrid.cards.needles.title')"
        :description="t('home.toolgrid.cards.needles.desc')"
        :kind="t('home.toolgrid.kind.calculator')"
      />
    </div>
  </section>

  <!-- Archive feature row (design system) -->
  <section class="bg-base-200">
    <div class="container mx-auto px-4 py-14">
      <div class="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div class="archive-feature__img"></div>
        <div>
          <span class="biglabel">{{ t('home.archive_feature.kicker') }}</span>
          <h3 class="text-2xl md:text-3xl font-bold mt-2 mb-3 leading-tight">
            {{ t('home.archive_feature.heading') }}
          </h3>
          <p class="lead mb-4">{{ t('home.archive_feature.body') }}</p>
          <ul class="list-none p-0 m-0 mb-5 flex flex-col gap-2">
            <li v-for="item in archiveFeatureItems" :key="item" class="flex gap-2.5 items-start text-sm">
              <i class="fad fa-circle-check text-secondary mt-1"></i>
              <span>{{ item }}</span>
            </li>
          </ul>
          <NuxtLink to="/archive" class="btn btn-primary">
            <i class="fad fa-books mr-2"></i>{{ t('home.archive_feature.cta') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>

  <!-- Wheel registry preview (design system) -->
  <section class="container mx-auto px-4 py-14">
    <div class="section-head">
      <div class="meta">
        <span class="eyebrow">{{ t('home.wheel_preview.eyebrow') }}</span>
        <h2 class="text-3xl md:text-4xl">{{ t('home.wheel_preview.heading') }}</h2>
        <p>{{ t('home.wheel_preview.subheading') }}</p>
      </div>
      <NuxtLink to="/contribute/wheels" class="btn btn-secondary btn-sm">
        <i class="fad fa-paper-plane mr-1"></i>{{ t('home.wheel_preview.cta') }}
      </NuxtLink>
    </div>
    <div v-if="featuredWheels?.length" class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <NuxtLink
        v-for="wheel in featuredWheels"
        :key="wheel.uuid"
        :to="`/archive/wheels/${wheel.uuid}`"
        class="wheel-card"
      >
        <div
          class="wheel-card__ph"
          :style="{ backgroundImage: `url(${wheel.images?.[0]?.src})` }"
          :aria-label="wheel.name"
        ></div>
        <div class="wheel-card__body">
          <h4>{{ wheel.name }}</h4>
          <div class="wheel-card__meta">
            <span v-if="wheel.size && wheel.width">{{ wheel.size }}×{{ wheel.width }}</span>
            <span v-else-if="wheel.size">{{ wheel.size }}"</span>
            <template v-if="wheel.offset">
              <span class="pip"></span>
              <span>{{ formatOffset(wheel.offset) }}</span>
            </template>
            <span class="pip"></span>
            <span>
              {{ wheel.images?.length || 0 }}
              {{ (wheel.images?.length || 0) === 1 ? t('home.wheel_preview.photo_one') : t('home.wheel_preview.photos') }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
    <p v-else class="text-center py-10 text-base-content/60">
      {{ t('home.wheel_preview.empty') }}
    </p>
  </section>

  <div class="container mx-auto px-4 pt-10">
    <div class="grid grid-cols-12 gap-4 pb-5">
      <div class="col-span-12"></div>
      <div class="col-span-12 md:col-span-8">
        <p class="eyebrow"><i class="fad fa-book mr-1"></i>{{ t('home.mission.title') }}</p>
        <h2 class="text-3xl font-bold pt-2 pb-3">{{ t('home.mission.heading') }}</h2>
        <p class="text-lg pb-5">
          {{ t('home.mission.content') }}
        </p>
        <stats />
      </div>
      <div class="col-span-12 md:col-span-4">
        <p class="eyebrow"><i class="fad fa-gift mr-1"></i>{{ t('home.support.title') }}</p>
        <h3 class="text-3xl font-bold pt-2 pb-3">{{ t('home.support.heading') }}</h3>
        <p class="text-lg pt-2 pb-3">
          {{ t('home.support.content') }}
        </p>
        <a
          class="btn is-patreon mr-3 text-lg"
          rel="noopener"
          href="https://patreon.com/classicminidiy"
          target="_blank"
        >
          <i class="fab fa-patreon mr-2" />
          {{ t('common.donate') }}
        </a>
        <a
          class="btn btn-neutral text-lg"
          rel="noopener"
          href="https://github.com/somethingnew71/classicminidiy"
          target="_blank"
        >
          <i class="fab fa-github mr-2" />
          {{ t('common.contribute') }}
        </a>
      </div>
      <div class="pt-20 pb-10 grid grid-cols-subgrid col-span-12 gap-4">
        <recent-videos></recent-videos>
      </div>
    </div>
  </div>

  <!-- Floating Chat Input -->
  <FloatingChatInput />
</template>

<style lang="scss">
  /* === Archive feature row image — flat green background w/ mascot illustration === */
  .archive-feature__img {
    aspect-ratio: 4 / 3;
    border-radius: 1rem;
    background-color: var(--cm-primary);
    background-image: url('https://classicminidiy.s3.amazonaws.com/misc/about-me.webp');
    background-size: cover;
    background-position: center;
    box-shadow: var(--shadow-lg);
  }

  /* === Wheel registry preview cards === */
  .wheel-card {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: var(--shadow-md);
    cursor: pointer;
    color: var(--fg-1);
    text-decoration: none;
    transition: transform var(--t-base) var(--ease-out), box-shadow var(--t-base) var(--ease-out);
  }
  .wheel-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    text-decoration: none;
  }
  .wheel-card__ph {
    aspect-ratio: 16 / 10;
    background-color: var(--bg-3);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .wheel-card__body {
    padding: 0.75rem 0.875rem 0.875rem;
  }
  .wheel-card__body h4 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
  }
  .wheel-card__meta {
    font-size: 0.6875rem;
    color: var(--fg-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    margin-top: 0.25rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .wheel-card__meta .pip {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--fg-3);
    display: inline-block;
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
      "toolgrid": {
        "eyebrow": "TOOLBOX",
        "heading": "Pop the bonnet, do the math.",
        "subheading": "A growing kit of calculators and decoders. No accounts, no ads, no nonsense.",
        "all_tools": "All tools",
        "kind": {
          "calculator": "Calculator",
          "decoder": "Decoder",
          "reference": "Reference"
        },
        "cards": {
          "compression": {
            "title": "Compression Ratio",
            "desc": "CR for any combo of bore, stroke, head cc and deck height."
          },
          "gearing": {
            "title": "Gear Ratio",
            "desc": "Final-drive math across SPi, MPi, and pre-Verto cars."
          },
          "chassis": {
            "title": "Chassis Decoder",
            "desc": "Year, plant, and trim from your VIN/chassis number."
          },
          "needles": {
            "title": "Carb Needle Configurator",
            "desc": "Compare SU HS2/HS4/HIF44 needle profiles side-by-side with chart overlays."
          }
        }
      },
      "archive_feature": {
        "kicker": "ARCHIVE",
        "heading": "The technical reference, kept alive.",
        "body": "Common clearances, tappet gaps, torque specs, electrical diagrams — the kind of dog-eared workshop manual content that's slowly disappearing from the internet, all free and searchable.",
        "items": [
          "Common clearances reference",
          "Engine block & head identification",
          "Wiring diagrams by year & model",
          "Carburettor needle library (SU HS2/HS4/HIF44)"
        ],
        "cta": "Browse the archive"
      },
      "wheel_preview": {
        "eyebrow": "WHEEL REGISTRY",
        "heading": "Community-fed library.",
        "subheading": "Every wheel ever fitted to a Classic Mini, photographed and spec'd by the people who own them.",
        "cta": "Submit yours",
        "photo_one": "photo",
        "photos": "photos",
        "empty": "No wheels in the registry yet. Be the first — send yours in."
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
