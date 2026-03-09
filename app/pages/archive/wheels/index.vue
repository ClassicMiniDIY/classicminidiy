<script lang="ts" setup>
  import { HERO_TYPES } from '../../../../data/models/generic';

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
        name: 'keywords',
        content: t('keywords'),
      },
    ],
    link: [
      {
        rel: 'canonical',
        href: 'https://classicminidiy.com/archive/wheels',
      },
      {
        rel: 'preconnect',
        href: 'https://classicminidiy.s3.amazonaws.com',
      },
    ],
  });

  // CollectionPage structured data for wheels archive
  const wheelsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classic Mini Wheels Archive',
    description: t('description'),
    url: 'https://classicminidiy.com/archive/wheels',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Classic Mini Wheel Fitment Database',
      description: 'Comprehensive database of wheels that fit Classic Mini vehicles',
      itemListElement: {
        '@type': 'ListItem',
        name: 'Classic Mini Compatible Wheels',
      },
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
        innerHTML: JSON.stringify(wheelsJsonLd),
      },
    ],
  });

  useSeoMeta({
    ogTitle: t('seo.og_title'),
    ogDescription: t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/archive/wheels',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/wheels.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: t('seo.twitter_title'),
    twitterDescription: t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/wheels.png',
  });
</script>

<template>
  <div>
    <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
    <div class="container mx-auto px-4">
      <breadcrumb :page="t('breadcrumb_title')" class="my-6"></breadcrumb>

      <!-- Contribute Banner -->
      <UCard class="mb-6 bg-primary/5">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <i class="fad fa-hand-holding-heart text-xl text-primary"></i>
            <div>
              <p class="font-medium">{{ t('contribute_banner_title') }}</p>
              <p class="text-sm opacity-70">{{ t('contribute_banner_description') }}</p>
            </div>
          </div>
          <UButton to="/contribute/wheel" color="primary" variant="outline" size="sm">
            {{ t('contribute_banner_button') }}
          </UButton>
        </div>
      </UCard>

      <div class="grid grid-cols-12 gap-4 items-center">
        <div class="col-span-12 md:col-span-8">
          <h1 class="text-3xl font-bold mb-2">{{ t('main_heading') }}</h1>
          <p class="pb-5">
            {{ t('description_text') }}
          </p>
        </div>
        <div class="col-span-12 md:col-span-4">
          <NuxtLink :to="'/contribute/wheel?newWheel=true'" :title="t('add_wheel_card.link_title')">
            <UCard class="hover:shadow-2xl transition-shadow">
              <div class="flex items-start">
                <div class="mr-4">
                  <i class="fad fa-rectangle-history-circle-plus text-3xl"></i>
                </div>
                <div>
                  <h2 class="text-lg font-semibold">{{ t('add_wheel_card.title') }}</h2>
                  <p>{{ t('add_wheel_card.description') }}</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </div>
      <USeparator class="my-4" />
      <div class="grid grid-cols-12 gap-4 mb-4">
        <div class="col-span-12">
          <WheelGrid></WheelGrid>
        </div>
      </div>
      <footer class="bg-muted text-center p-6 rounded-lg">
        <div>
          <h2 class="text-xl font-bold mb-2">
            {{ t('footer.title') }}
            <a
              href="https://www.mini-forum.de/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
              >Mini-Forum.de</a
            >.
          </h2>
          <p class="pb-5">
            {{ t('footer.description') }}
            <i class="fad fa-tombstone"></i>www.wheeldictionary.net
          </p>
        </div>
      </footer>
      <USeparator class="my-4" />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Classic Mini Wheels Archive - Classic Mini DIY",
    "description": "Browse and contribute to the Classic Mini wheels database",
    "keywords": "Classic Mini wheels, Mini Cooper wheels, wheel fitment, wheel database, aftermarket wheels, factory wheels, wheel offset, bolt pattern",
    "hero_title": "Classic Mini Wheels",
    "breadcrumb_title": "Wheels",
    "main_heading": "Classic Mini Wheels Archive",
    "description_text": "Explore our comprehensive database of Classic Mini wheels. From original factory options to aftermarket alternatives, find detailed information about wheels that fit your Classic Mini.",
    "add_wheel_card": {
      "title": "Add a Wheel",
      "description": "Contribute to our wheels database",
      "link_title": "Add a new wheel to the database"
    },
    "contribute_banner_title": "Know something we're missing?",
    "contribute_banner_description": "Help grow the archive with your knowledge.",
    "contribute_banner_button": "Contribute",
    "footer": {
      "title": "Special thanks to",
      "description": "This database was originally sourced from the now-defunct"
    },
    "seo": {
      "og_title": "Classic Mini Wheels Archive - Classic Mini DIY",
      "og_description": "Browse and contribute to the Classic Mini wheels database",
      "twitter_title": "Classic Mini Wheels Archive - Classic Mini DIY",
      "twitter_description": "Browse and contribute to the Classic Mini wheels database"
    }
  },
  "es": {
    "title": "Archivo de Llantas Classic Mini - Classic Mini DIY",
    "description": "Explora y contribuye a la base de datos de llantas del Classic Mini",
    "keywords": "llantas Classic Mini, llantas Mini Cooper, fitment de llantas, base de datos de llantas, llantas aftermarket, llantas de fábrica, offset de llantas, patrón de tornillos",
    "hero_title": "Llantas Classic Mini",
    "breadcrumb_title": "Llantas",
    "main_heading": "Archivo de Llantas Classic Mini",
    "description_text": "Explora nuestra completa base de datos de llantas para el Classic Mini. Desde las opciones originales de fábrica hasta alternativas aftermarket, encuentra información detallada sobre llantas que se adaptan a tu Classic Mini.",
    "add_wheel_card": {
      "title": "Añadir una Llanta",
      "description": "Contribuye a nuestra base de datos de llantas",
      "link_title": "Añadir una nueva llanta a la base de datos"
    },
    "contribute_banner_title": "¿Sabes algo que nos falta?",
    "contribute_banner_description": "Ayuda a hacer crecer el archivo con tus conocimientos.",
    "contribute_banner_button": "Contribuir",
    "footer": {
      "title": "Agradecimiento especial a",
      "description": "Esta base de datos fue obtenida originalmente del ya desaparecido"
    },
    "seo": {
      "og_title": "Archivo de Llantas Classic Mini - Classic Mini DIY",
      "og_description": "Explora y contribuye a la base de datos de llantas del Classic Mini",
      "twitter_title": "Archivo de Llantas Classic Mini - Classic Mini DIY",
      "twitter_description": "Explora y contribuye a la base de datos de llantas del Classic Mini"
    }
  },
  "fr": {
    "title": "Archive des Jantes Classic Mini - Classic Mini DIY",
    "description": "Parcourez et contribuez à la base de données des jantes Classic Mini",
    "keywords": "jantes Classic Mini, jantes Mini Cooper, fitment de jantes, base de données de jantes, jantes aftermarket, jantes d'origine, offset de jante, entraxe",
    "hero_title": "Jantes Classic Mini",
    "breadcrumb_title": "Jantes",
    "main_heading": "Archive des Jantes Classic Mini",
    "description_text": "Explorez notre base de données complète des jantes pour la Classic Mini. Des options d'origine aux alternatives aftermarket, trouvez des informations détaillées sur les jantes compatibles avec votre Classic Mini.",
    "add_wheel_card": {
      "title": "Ajouter une Jante",
      "description": "Contribuez à notre base de données de jantes",
      "link_title": "Ajouter une nouvelle jante à la base de données"
    },
    "contribute_banner_title": "Vous savez quelque chose qui nous manque ?",
    "contribute_banner_description": "Aidez à enrichir l'archive avec vos connaissances.",
    "contribute_banner_button": "Contribuer",
    "footer": {
      "title": "Remerciements particuliers à",
      "description": "Cette base de données a été initialement extraite du site aujourd'hui disparu"
    },
    "seo": {
      "og_title": "Archive des Jantes Classic Mini - Classic Mini DIY",
      "og_description": "Parcourez et contribuez à la base de données des jantes Classic Mini",
      "twitter_title": "Archive des Jantes Classic Mini - Classic Mini DIY",
      "twitter_description": "Parcourez et contribuez à la base de données des jantes Classic Mini"
    }
  },
  "it": {
    "title": "Archivio Cerchi Classic Mini - Classic Mini DIY",
    "description": "Sfoglia e contribuisci al database dei cerchi Classic Mini",
    "keywords": "cerchi Classic Mini, cerchi Mini Cooper, fitment cerchi, database cerchi, cerchi aftermarket, cerchi originali, offset cerchio, bullonatura",
    "hero_title": "Cerchi Classic Mini",
    "breadcrumb_title": "Cerchi",
    "main_heading": "Archivio Cerchi Classic Mini",
    "description_text": "Esplora il nostro database completo di cerchi per la Classic Mini. Dalle opzioni originali di fabbrica alle alternative aftermarket, trova informazioni dettagliate sui cerchi compatibili con la tua Classic Mini.",
    "add_wheel_card": {
      "title": "Aggiungi un Cerchio",
      "description": "Contribuisci al nostro database di cerchi",
      "link_title": "Aggiungi un nuovo cerchio al database"
    },
    "contribute_banner_title": "Sai qualcosa che ci manca?",
    "contribute_banner_description": "Aiuta a far crescere l'archivio con le tue conoscenze.",
    "contribute_banner_button": "Contribuisci",
    "footer": {
      "title": "Un ringraziamento speciale a",
      "description": "Questo database è stato originalmente ricavato dal defunto"
    },
    "seo": {
      "og_title": "Archivio Cerchi Classic Mini - Classic Mini DIY",
      "og_description": "Sfoglia e contribuisci al database dei cerchi Classic Mini",
      "twitter_title": "Archivio Cerchi Classic Mini - Classic Mini DIY",
      "twitter_description": "Sfoglia e contribuisci al database dei cerchi Classic Mini"
    }
  },
  "de": {
    "title": "Classic Mini Felgen-Archiv - Classic Mini DIY",
    "description": "Durchsuchen und erweitern Sie die Classic Mini Felgen-Datenbank",
    "keywords": "Classic Mini Felgen, Mini Cooper Felgen, Felgen-Fitment, Felgen-Datenbank, Aftermarket-Felgen, Serienfelgen, Felgeneinpresstiefe, Lochkreis",
    "hero_title": "Classic Mini Felgen",
    "breadcrumb_title": "Felgen",
    "main_heading": "Classic Mini Felgen-Archiv",
    "description_text": "Erkunden Sie unsere umfangreiche Datenbank mit Classic Mini Felgen. Von originalen Serienfelgen bis zu Aftermarket-Alternativen – finden Sie detaillierte Informationen zu Felgen, die zu Ihrem Classic Mini passen.",
    "add_wheel_card": {
      "title": "Felge hinzufügen",
      "description": "Zur Felgen-Datenbank beitragen",
      "link_title": "Eine neue Felge zur Datenbank hinzufügen"
    },
    "contribute_banner_title": "Wissen Sie etwas, das uns fehlt?",
    "contribute_banner_description": "Helfen Sie, das Archiv mit Ihrem Wissen zu erweitern.",
    "contribute_banner_button": "Beitragen",
    "footer": {
      "title": "Besonderer Dank an",
      "description": "Diese Datenbank wurde ursprünglich von der inzwischen eingestellten Website bezogen"
    },
    "seo": {
      "og_title": "Classic Mini Felgen-Archiv - Classic Mini DIY",
      "og_description": "Durchsuchen und erweitern Sie die Classic Mini Felgen-Datenbank",
      "twitter_title": "Classic Mini Felgen-Archiv - Classic Mini DIY",
      "twitter_description": "Durchsuchen und erweitern Sie die Classic Mini Felgen-Datenbank"
    }
  },
  "pt": {
    "title": "Arquivo de Rodas Classic Mini - Classic Mini DIY",
    "description": "Navegue e contribua para a base de dados de rodas do Classic Mini",
    "keywords": "rodas Classic Mini, rodas Mini Cooper, fitment de rodas, base de dados de rodas, rodas aftermarket, rodas de fábrica, offset de roda, padrão de parafusos",
    "hero_title": "Rodas Classic Mini",
    "breadcrumb_title": "Rodas",
    "main_heading": "Arquivo de Rodas Classic Mini",
    "description_text": "Explore a nossa base de dados abrangente de rodas para o Classic Mini. Desde as opções originais de fábrica até alternativas aftermarket, encontre informações detalhadas sobre rodas que se encaixam no seu Classic Mini.",
    "add_wheel_card": {
      "title": "Adicionar uma Roda",
      "description": "Contribua para a nossa base de dados de rodas",
      "link_title": "Adicionar uma nova roda à base de dados"
    },
    "contribute_banner_title": "Sabe algo que nos falta?",
    "contribute_banner_description": "Ajude a expandir o arquivo com o seu conhecimento.",
    "contribute_banner_button": "Contribuir",
    "footer": {
      "title": "Agradecimento especial a",
      "description": "Esta base de dados foi originalmente retirada do extinto"
    },
    "seo": {
      "og_title": "Arquivo de Rodas Classic Mini - Classic Mini DIY",
      "og_description": "Navegue e contribua para a base de dados de rodas do Classic Mini",
      "twitter_title": "Arquivo de Rodas Classic Mini - Classic Mini DIY",
      "twitter_description": "Navegue e contribua para a base de dados de rodas do Classic Mini"
    }
  },
  "ru": {
    "title": "Архив дисков Classic Mini - Classic Mini DIY",
    "description": "Просматривайте и пополняйте базу данных дисков Classic Mini",
    "keywords": "диски Classic Mini, диски Mini Cooper, подбор дисков, база данных дисков, тюнинговые диски, заводские диски, вылет диска, болтовой рисунок",
    "hero_title": "Диски Classic Mini",
    "breadcrumb_title": "Диски",
    "main_heading": "Архив дисков Classic Mini",
    "description_text": "Изучите нашу обширную базу данных дисков для Classic Mini. От оригинальных заводских вариантов до тюнинговых альтернатив — найдите подробную информацию о дисках, подходящих для вашего Classic Mini.",
    "add_wheel_card": {
      "title": "Добавить диск",
      "description": "Пополните нашу базу данных дисков",
      "link_title": "Добавить новый диск в базу данных"
    },
    "contribute_banner_title": "Знаете то, чего нам не хватает?",
    "contribute_banner_description": "Помогите пополнить архив своими знаниями.",
    "contribute_banner_button": "Внести вклад",
    "footer": {
      "title": "Особая благодарность",
      "description": "Эта база данных изначально была получена с ныне несуществующего сайта"
    },
    "seo": {
      "og_title": "Архив дисков Classic Mini - Classic Mini DIY",
      "og_description": "Просматривайте и пополняйте базу данных дисков Classic Mini",
      "twitter_title": "Архив дисков Classic Mini - Classic Mini DIY",
      "twitter_description": "Просматривайте и пополняйте базу данных дисков Classic Mini"
    }
  },
  "ja": {
    "title": "クラシックミニ ホイール アーカイブ - Classic Mini DIY",
    "description": "クラシックミニのホイールデータベースを閲覧・投稿する",
    "keywords": "クラシックミニ ホイール, ミニクーパー ホイール, ホイールフィットメント, ホイールデータベース, アフターマーケット ホイール, 純正ホイール, ホイールオフセット, ボルトパターン",
    "hero_title": "クラシックミニ ホイール",
    "breadcrumb_title": "ホイール",
    "main_heading": "クラシックミニ ホイール アーカイブ",
    "description_text": "クラシックミニのホイールに関する充実したデータベースをご覧ください。純正オプションからアフターマーケットの代替品まで、あなたのクラシックミニに合うホイールの詳細情報をご確認いただけます。",
    "add_wheel_card": {
      "title": "ホイールを追加",
      "description": "ホイールデータベースに貢献する",
      "link_title": "新しいホイールをデータベースに追加する"
    },
    "contribute_banner_title": "私たちが見逃していることをご存知ですか？",
    "contribute_banner_description": "あなたの知識でアーカイブの充実にご協力ください。",
    "contribute_banner_button": "投稿する",
    "footer": {
      "title": "特別な感謝を",
      "description": "このデータベースは現在閉鎖された以下のサイトを元に作成されました"
    },
    "seo": {
      "og_title": "クラシックミニ ホイール アーカイブ - Classic Mini DIY",
      "og_description": "クラシックミニのホイールデータベースを閲覧・投稿する",
      "twitter_title": "クラシックミニ ホイール アーカイブ - Classic Mini DIY",
      "twitter_description": "クラシックミニのホイールデータベースを閲覧・投稿する"
    }
  },
  "zh": {
    "title": "经典迷你轮毂档案 - Classic Mini DIY",
    "description": "浏览并为经典迷你轮毂数据库做出贡献",
    "keywords": "经典迷你轮毂, 迷你库珀轮毂, 轮毂匹配, 轮毂数据库, 改装轮毂, 原厂轮毂, 轮毂偏距, 螺栓孔距",
    "hero_title": "经典迷你轮毂",
    "breadcrumb_title": "轮毂",
    "main_heading": "经典迷你轮毂档案",
    "description_text": "探索我们完整的经典迷你轮毂数据库。从原厂选项到改装替代品，查找适合您经典迷你的轮毂详细信息。",
    "add_wheel_card": {
      "title": "添加轮毂",
      "description": "为我们的轮毂数据库做贡献",
      "link_title": "向数据库添加新轮毂"
    },
    "contribute_banner_title": "知道我们遗漏的内容吗？",
    "contribute_banner_description": "用您的知识帮助扩充档案。",
    "contribute_banner_button": "贡献",
    "footer": {
      "title": "特别感谢",
      "description": "该数据库最初来源于现已停运的"
    },
    "seo": {
      "og_title": "经典迷你轮毂档案 - Classic Mini DIY",
      "og_description": "浏览并为经典迷你轮毂数据库做出贡献",
      "twitter_title": "经典迷你轮毂档案 - Classic Mini DIY",
      "twitter_description": "浏览并为经典迷你轮毂数据库做出贡献"
    }
  },
  "ko": {
    "title": "클래식 미니 휠 아카이브 - Classic Mini DIY",
    "description": "클래식 미니 휠 데이터베이스를 탐색하고 기여하세요",
    "keywords": "클래식 미니 휠, 미니 쿠퍼 휠, 휠 피트먼트, 휠 데이터베이스, 애프터마켓 휠, 순정 휠, 휠 오프셋, 볼트 패턴",
    "hero_title": "클래식 미니 휠",
    "breadcrumb_title": "휠",
    "main_heading": "클래식 미니 휠 아카이브",
    "description_text": "클래식 미니 휠에 관한 방대한 데이터베이스를 탐색하세요. 순정 옵션부터 애프터마켓 대안까지, 클래식 미니에 맞는 휠에 대한 자세한 정보를 찾아보세요.",
    "add_wheel_card": {
      "title": "휠 추가",
      "description": "휠 데이터베이스에 기여하세요",
      "link_title": "데이터베이스에 새 휠 추가하기"
    },
    "contribute_banner_title": "우리가 놓친 내용을 알고 계신가요?",
    "contribute_banner_description": "당신의 지식으로 아카이브를 성장시켜 주세요.",
    "contribute_banner_button": "기여하기",
    "footer": {
      "title": "특별한 감사를",
      "description": "이 데이터베이스는 현재 폐쇄된 다음 사이트에서 원래 제공받았습니다"
    },
    "seo": {
      "og_title": "클래식 미니 휠 아카이브 - Classic Mini DIY",
      "og_description": "클래식 미니 휠 데이터베이스를 탐색하고 기여하세요",
      "twitter_title": "클래식 미니 휠 아카이브 - Classic Mini DIY",
      "twitter_description": "클래식 미니 휠 데이터베이스를 탐색하고 기여하세요"
    }
  }
}
</i18n>
