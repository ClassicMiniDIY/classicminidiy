<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const route = useRoute();
  const { isAuthenticated } = useAuth();
  const uuid = ref(route.query.uuid?.toString());
  const newWheel = route.query.newWheel === 'true' ? true : false;

  useHead({
    title: $t('page_title'),
    meta: [
      {
        name: 'description',
        content: $t('description'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  useSeoMeta({
    ogTitle: $t('seo.og_title'),
    ogDescription: $t('seo.og_description'),
    ogUrl: 'https://classicminidiy.com/contribute/wheel',
    ogImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/wheels.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: $t('seo.twitter_title'),
    twitterDescription: $t('seo.twitter_description'),
    twitterImage: 'https://classicminidiy.s3.amazonaws.com/social-share/archive/wheels.png',
  });
</script>

<template>
  <div>
    <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
    <section class="py-4">
      <div class="container mx-auto px-4">
        <div class="mb-6">
          <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="$t('breadcrumb_title')" />
        </div>

        <!-- Auth Gate -->
        <div v-if="!isAuthenticated" class="max-w-lg mx-auto mt-8">
          <UCard>
            <div class="p-6 text-center">
              <div class="mb-4">
                <i class="fas fa-lock text-5xl text-muted"></i>
              </div>
              <h2 class="text-xl font-bold mb-2">{{ $t('sign_in_title') }}</h2>
              <p class="text-base mb-6 opacity-70">{{ $t('sign_in_description') }}</p>
              <UButton to="/login" color="primary" class="w-full">
                {{ $t('sign_in_button') }}
              </UButton>
            </div>
          </UCard>
        </div>

        <!-- Authenticated Content -->
        <div v-else class="mt-4">
          <WheelSubmit v-if="!newWheel" :uuid="uuid" />
          <WheelSubmit v-else :newWheel="true" />
        </div>
      </div>
    </section>

    <patreon-card size="large" />
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "page_title": "Submit Wheel - Classic Mini DIY",
    "description": "Submit a wheel to the Classic Mini wheels database",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Submit Wheel",
    "sign_in_title": "Sign In to Contribute",
    "sign_in_description": "You need to be signed in to submit wheels to the archive. Create a free account to get started.",
    "sign_in_button": "Sign In to Continue",
    "seo": {
      "og_title": "Submit Wheel - Classic Mini DIY",
      "og_description": "Submit a wheel to the Classic Mini wheels database",
      "twitter_title": "Submit Wheel - Classic Mini DIY",
      "twitter_description": "Submit a wheel to the Classic Mini wheels database"
    }
  },
  "es": {
    "page_title": "Enviar Rueda - Classic Mini DIY",
    "description": "Envia una rueda a la base de datos de ruedas Classic Mini",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Enviar Rueda",
    "sign_in_title": "Inicia Sesion para Contribuir",
    "sign_in_description": "Debes iniciar sesion para enviar ruedas al archivo. Crea una cuenta gratuita para empezar.",
    "sign_in_button": "Iniciar Sesion para Continuar",
    "seo": {
      "og_title": "Enviar Rueda - Classic Mini DIY",
      "og_description": "Envia una rueda a la base de datos de ruedas Classic Mini",
      "twitter_title": "Enviar Rueda - Classic Mini DIY",
      "twitter_description": "Envia una rueda a la base de datos de ruedas Classic Mini"
    }
  },
  "fr": {
    "page_title": "Soumettre une Roue - Classic Mini DIY",
    "description": "Soumettez une roue a la base de donnees de roues Classic Mini",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Soumettre une Roue",
    "sign_in_title": "Connectez-vous pour Contribuer",
    "sign_in_description": "Vous devez etre connecte pour soumettre des roues aux archives. Creez un compte gratuit pour commencer.",
    "sign_in_button": "Se Connecter pour Continuer",
    "seo": {
      "og_title": "Soumettre une Roue - Classic Mini DIY",
      "og_description": "Soumettez une roue a la base de donnees de roues Classic Mini",
      "twitter_title": "Soumettre une Roue - Classic Mini DIY",
      "twitter_description": "Soumettez une roue a la base de donnees de roues Classic Mini"
    }
  },
  "it": {
    "page_title": "Invia Ruota - Classic Mini DIY",
    "description": "Invia una ruota al database delle ruote Classic Mini",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Invia Ruota",
    "sign_in_title": "Accedi per Contribuire",
    "sign_in_description": "Devi essere connesso per inviare ruote all'archivio. Crea un account gratuito per iniziare.",
    "sign_in_button": "Accedi per Continuare",
    "seo": {
      "og_title": "Invia Ruota - Classic Mini DIY",
      "og_description": "Invia una ruota al database delle ruote Classic Mini",
      "twitter_title": "Invia Ruota - Classic Mini DIY",
      "twitter_description": "Invia una ruota al database delle ruote Classic Mini"
    }
  },
  "de": {
    "page_title": "Rad Einreichen - Classic Mini DIY",
    "description": "Reichen Sie ein Rad in der Classic Mini Raddatenbank ein",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Rad Einreichen",
    "sign_in_title": "Anmelden zum Beitragen",
    "sign_in_description": "Sie muessen angemeldet sein, um Raeder ins Archiv einzureichen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
    "sign_in_button": "Anmelden und Fortfahren",
    "seo": {
      "og_title": "Rad Einreichen - Classic Mini DIY",
      "og_description": "Reichen Sie ein Rad in der Classic Mini Raddatenbank ein",
      "twitter_title": "Rad Einreichen - Classic Mini DIY",
      "twitter_description": "Reichen Sie ein Rad in der Classic Mini Raddatenbank ein"
    }
  },
  "pt": {
    "page_title": "Enviar Roda - Classic Mini DIY",
    "description": "Envie uma roda para o banco de dados de rodas Classic Mini",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Enviar Roda",
    "sign_in_title": "Entre para Contribuir",
    "sign_in_description": "Voce precisa estar conectado para enviar rodas ao arquivo. Crie uma conta gratuita para comecar.",
    "sign_in_button": "Entrar para Continuar",
    "seo": {
      "og_title": "Enviar Roda - Classic Mini DIY",
      "og_description": "Envie uma roda para o banco de dados de rodas Classic Mini",
      "twitter_title": "Enviar Roda - Classic Mini DIY",
      "twitter_description": "Envie uma roda para o banco de dados de rodas Classic Mini"
    }
  },
  "ru": {
    "page_title": "Отправить колесо - Classic Mini DIY",
    "description": "Отправьте колесо в базу данных колес Classic Mini",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Отправить колесо",
    "sign_in_title": "Войдите, чтобы внести вклад",
    "sign_in_description": "Вам нужно войти в систему, чтобы отправить колеса в архив. Создайте бесплатную учетную запись, чтобы начать.",
    "sign_in_button": "Войти для продолжения",
    "seo": {
      "og_title": "Отправить колесо - Classic Mini DIY",
      "og_description": "Отправьте колесо в базу данных колес Classic Mini",
      "twitter_title": "Отправить колесо - Classic Mini DIY",
      "twitter_description": "Отправьте колесо в базу данных колес Classic Mini"
    }
  },
  "ja": {
    "page_title": "ホイールを提出 - Classic Mini DIY",
    "description": "クラシックミニのホイールデータベースにホイールを提出する",
    "hero_title": "クラシックミニアーカイブ",
    "breadcrumb_title": "ホイールを提出",
    "sign_in_title": "貢献するにはサインインしてください",
    "sign_in_description": "アーカイブにホイールを提出するにはサインインが必要です。無料アカウントを作成して始めましょう。",
    "sign_in_button": "サインインして続行",
    "seo": {
      "og_title": "ホイールを提出 - Classic Mini DIY",
      "og_description": "クラシックミニのホイールデータベースにホイールを提出する",
      "twitter_title": "ホイールを提出 - Classic Mini DIY",
      "twitter_description": "クラシックミニのホイールデータベースにホイールを提出する"
    }
  },
  "zh": {
    "page_title": "提交轮毂 - Classic Mini DIY",
    "description": "向经典迷你轮毂数据库提交轮毂",
    "hero_title": "经典迷你档案馆",
    "breadcrumb_title": "提交轮毂",
    "sign_in_title": "登录以贡献",
    "sign_in_description": "您需要登录才能向档案馆提交轮毂。创建免费帐户以开始。",
    "sign_in_button": "登录以继续",
    "seo": {
      "og_title": "提交轮毂 - Classic Mini DIY",
      "og_description": "向经典迷你轮毂数据库提交轮毂",
      "twitter_title": "提交轮毂 - Classic Mini DIY",
      "twitter_description": "向经典迷你轮毂数据库提交轮毂"
    }
  },
  "ko": {
    "page_title": "휠 제출 - Classic Mini DIY",
    "description": "클래식 미니 휠 데이터베이스에 휠을 제출하세요",
    "hero_title": "클래식 미니 아카이브",
    "breadcrumb_title": "휠 제출",
    "sign_in_title": "기여하려면 로그인하세요",
    "sign_in_description": "아카이브에 휠을 제출하려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
    "sign_in_button": "로그인하여 계속",
    "seo": {
      "og_title": "휠 제출 - Classic Mini DIY",
      "og_description": "클래식 미니 휠 데이터베이스에 휠을 제출하세요",
      "twitter_title": "휠 제출 - Classic Mini DIY",
      "twitter_description": "클래식 미니 휠 데이터베이스에 휠을 제출하세요"
    }
  }
}
</i18n>
