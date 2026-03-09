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

        <!-- Contribute Banner -->
        <UCard class="mb-6 bg-primary/5">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <i class="fad fa-hand-holding-heart text-xl text-primary"></i>
              <div>
                <p class="font-medium">{{ $t('contribute_banner_title') }}</p>
                <p class="text-sm opacity-70">{{ $t('contribute_banner_description') }}</p>
              </div>
            </div>
            <UButton to="/contribute/registry" color="primary" variant="outline" size="sm">
              {{ $t('contribute_banner_button') }}
            </UButton>
          </div>
        </UCard>

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
    "contribute_banner_title": "Know something we're missing?",
    "contribute_banner_description": "Help grow the archive with your knowledge.",
    "contribute_banner_button": "Contribute",
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
    "keywords": "Classic Mini Registry, Mini Cooper Datenbank, registrierte Minis, Classic Mini Besitzer, Mini Fahrzeugregister, Oldtimer Mini Datenbank",
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
    "contribute_banner_title": "Wissen Sie etwas, das uns fehlt?",
    "contribute_banner_description": "Helfen Sie, das Archiv mit Ihrem Wissen zu erweitern.",
    "contribute_banner_button": "Beitragen",
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
    "keywords": "registro Classic Mini, base de datos Mini Cooper, Minis registrados, propietarios Classic Mini, registro de vehículos Mini, base de datos Mini clásico",
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
    "contribute_banner_title": "Sabes algo que nos falta?",
    "contribute_banner_description": "Ayuda a hacer crecer el archivo con tu conocimiento.",
    "contribute_banner_button": "Contribuir",
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
    "keywords": "registre Classic Mini, base de données Mini Cooper, Minis enregistrées, propriétaires Classic Mini, registre de véhicules Mini, base de données Mini vintage",
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
    "contribute_banner_title": "Vous savez quelque chose qui nous manque ?",
    "contribute_banner_description": "Aidez a enrichir l'archive avec vos connaissances.",
    "contribute_banner_button": "Contribuer",
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
    "keywords": "registro Classic Mini, database Mini Cooper, Mini registrate, proprietari Classic Mini, registro veicoli Mini, database Mini d'epoca",
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
    "contribute_banner_title": "Sai qualcosa che ci manca?",
    "contribute_banner_description": "Aiuta a far crescere l'archivio con le tue conoscenze.",
    "contribute_banner_button": "Contribuisci",
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
    "keywords": "registro Classic Mini, banco de dados Mini Cooper, Minis registrados, proprietários Classic Mini, registro de veículos Mini, banco de dados Mini clássico",
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
    "contribute_banner_title": "Sabe algo que nos falta?",
    "contribute_banner_description": "Ajude a expandir o arquivo com seu conhecimento.",
    "contribute_banner_button": "Contribuir",
    "support_divider": "Suporte",
    "seo": {
      "og_title": "Registro Classic Mini - Classic Mini DIY",
      "og_description": "Navegue e contribua para o banco de dados do registro Classic Mini",
      "twitter_title": "Registro Classic Mini - Classic Mini DIY",
      "twitter_description": "Navegue e contribua para o banco de dados do registro Classic Mini"
    }
  },
  "ru": {
    "title": "Реестр Classic Mini - Classic Mini DIY",
    "description": "Просматривайте и вносите вклад в базу данных реестра Classic Mini",
    "keywords": "реестр Classic Mini, база данных Mini Cooper, зарегистрированные Mini, владельцы Classic Mini, реестр автомобилей Mini, база данных винтажных Mini",
    "hero_title": "Реестр Classic Mini",
    "breadcrumb_title": "Реестр",
    "main_heading": "Реестр Classic Mini",
    "subtitle_count": "0",
    "subtitle": "Classic Mini зарегистрировано",
    "description_text": "Реестр Classic Mini — это управляемая сообществом база данных автомобилей Classic Mini. Помогите нам создать наиболее полный реестр, отправив данные вашего Mini.",
    "submission_status_text": "Хотите отслеживать статус вашей заявки?",
    "track_submission_button": "Отследить заявку",
    "table_headers": {
      "year": "Год",
      "model": "Модель",
      "trim": "Комплектация",
      "color": "Цвет"
    },
    "submit_card": {
      "title": "Добавьте ваш Mini",
      "description": "Добавьте ваш Classic Mini в наш реестр",
      "alt_text": "Иконка добавления Mini"
    },
    "submit_divider": "Добавьте ваш Mini",
    "contribute_banner_title": "Знаете что-то, чего нам не хватает?",
    "contribute_banner_description": "Помогите пополнить архив своими знаниями.",
    "contribute_banner_button": "Внести вклад",
    "support_divider": "Поддержка",
    "seo": {
      "og_title": "Реестр Classic Mini - Classic Mini DIY",
      "og_description": "Просматривайте и вносите вклад в базу данных реестра Classic Mini",
      "twitter_title": "Реестр Classic Mini - Classic Mini DIY",
      "twitter_description": "Просматривайте и вносите вклад в базу данных реестра Classic Mini"
    }
  },
  "ja": {
    "title": "クラシックミニ レジストリ - Classic Mini DIY",
    "description": "クラシックミニ レジストリ データベースを閲覧・投稿する",
    "keywords": "クラシックミニ レジストリ, ミニクーパー データベース, 登録済みミニ, クラシックミニ オーナー, ミニ車両登録, ビンテージミニ データベース",
    "hero_title": "クラシックミニ レジストリ",
    "breadcrumb_title": "レジストリ",
    "main_heading": "クラシックミニ レジストリ",
    "subtitle_count": "0",
    "subtitle": "台のクラシックミニが登録済み",
    "description_text": "クラシックミニ レジストリは、クラシックミニ車両のコミュニティ主導のデータベースです。あなたのミニの詳細を送信して、最も包括的なレジストリの構築にご協力ください。",
    "submission_status_text": "申請状況を確認しますか？",
    "track_submission_button": "申請を追跡",
    "table_headers": {
      "year": "年式",
      "model": "モデル",
      "trim": "グレード",
      "color": "カラー"
    },
    "submit_card": {
      "title": "あなたのミニを登録",
      "description": "あなたのクラシックミニをレジストリに追加",
      "alt_text": "ミニ登録アイコン"
    },
    "submit_divider": "あなたのミニを登録",
    "contribute_banner_title": "私たちが見落としていることを知っていますか？",
    "contribute_banner_description": "あなたの知識でアーカイブの充実にご協力ください。",
    "contribute_banner_button": "投稿する",
    "support_divider": "サポート",
    "seo": {
      "og_title": "クラシックミニ レジストリ - Classic Mini DIY",
      "og_description": "クラシックミニ レジストリ データベースを閲覧・投稿する",
      "twitter_title": "クラシックミニ レジストリ - Classic Mini DIY",
      "twitter_description": "クラシックミニ レジストリ データベースを閲覧・投稿する"
    }
  },
  "zh": {
    "title": "经典迷你注册表 - Classic Mini DIY",
    "description": "浏览并为经典迷你注册数据库做出贡献",
    "keywords": "经典迷你注册表, Mini Cooper数据库, 已注册迷你, 经典迷你车主, 迷你车辆登记, 老爷迷你数据库",
    "hero_title": "经典迷你注册表",
    "breadcrumb_title": "注册表",
    "main_heading": "经典迷你注册表",
    "subtitle_count": "0",
    "subtitle": "辆经典迷你已注册",
    "description_text": "经典迷你注册表是一个由社区驱动的经典迷你车辆数据库。请提交您的迷你车辆详情，帮助我们建立最全面的注册表。",
    "submission_status_text": "想要追踪您的提交状态吗？",
    "track_submission_button": "追踪提交",
    "table_headers": {
      "year": "年份",
      "model": "型号",
      "trim": "配置",
      "color": "颜色"
    },
    "submit_card": {
      "title": "提交您的迷你",
      "description": "将您的经典迷你添加到我们的注册表",
      "alt_text": "提交迷你图标"
    },
    "submit_divider": "提交您的迷你",
    "contribute_banner_title": "知道我们遗漏了什么吗？",
    "contribute_banner_description": "用您的知识帮助充实档案库。",
    "contribute_banner_button": "贡献",
    "support_divider": "支持",
    "seo": {
      "og_title": "经典迷你注册表 - Classic Mini DIY",
      "og_description": "浏览并为经典迷你注册数据库做出贡献",
      "twitter_title": "经典迷你注册表 - Classic Mini DIY",
      "twitter_description": "浏览并为经典迷你注册数据库做出贡献"
    }
  },
  "ko": {
    "title": "클래식 미니 레지스트리 - Classic Mini DIY",
    "description": "클래식 미니 레지스트리 데이터베이스 탐색 및 기여",
    "keywords": "클래식 미니 레지스트리, 미니 쿠퍼 데이터베이스, 등록된 미니, 클래식 미니 소유자, 미니 차량 등록부, 빈티지 미니 데이터베이스",
    "hero_title": "클래식 미니 레지스트리",
    "breadcrumb_title": "레지스트리",
    "main_heading": "클래식 미니 레지스트리",
    "subtitle_count": "0",
    "subtitle": "대의 클래식 미니가 등록됨",
    "description_text": "클래식 미니 레지스트리는 커뮤니티 기반의 클래식 미니 차량 데이터베이스입니다. 미니의 세부 정보를 제출하여 가장 포괄적인 레지스트리 구축에 도움을 주세요.",
    "submission_status_text": "제출 상태를 추적하시겠습니까?",
    "track_submission_button": "제출 추적",
    "table_headers": {
      "year": "연도",
      "model": "모델",
      "trim": "트림",
      "color": "색상"
    },
    "submit_card": {
      "title": "미니를 등록하세요",
      "description": "클래식 미니를 레지스트리에 추가하세요",
      "alt_text": "미니 등록 아이콘"
    },
    "submit_divider": "미니를 등록하세요",
    "contribute_banner_title": "우리가 놓친 내용을 알고 계신가요?",
    "contribute_banner_description": "당신의 지식으로 아카이브를 풍부하게 만들어 주세요.",
    "contribute_banner_button": "기여하기",
    "support_divider": "지원",
    "seo": {
      "og_title": "클래식 미니 레지스트리 - Classic Mini DIY",
      "og_description": "클래식 미니 레지스트리 데이터베이스 탐색 및 기여",
      "twitter_title": "클래식 미니 레지스트리 - Classic Mini DIY",
      "twitter_description": "클래식 미니 레지스트리 데이터베이스 탐색 및 기여"
    }
  }
}
</i18n>
