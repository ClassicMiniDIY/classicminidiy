<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { isAuthenticated } = useAuth();

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
</script>

<template>
  <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="$t('breadcrumb_title')" />
    </div>

    <!-- Auth Gate -->
    <div v-if="!isAuthenticated" class="max-w-lg mx-auto">
      <UCard>
        <div class="p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-lock text-5xl opacity-40"></i>
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
    <div v-else>
      <div class="grid grid-cols-12 gap-6">
        <!-- Heading -->
        <div class="col-span-12 md:col-span-8 md:col-start-3">
          <h1 class="text-3xl font-bold mb-2">{{ $t('heading') }}</h1>
          <p class="text-base opacity-70 mb-6">{{ $t('subtitle') }}</p>
          <USeparator class="mb-6" />
        </div>

        <!-- Registry Submission Form -->
        <div class="col-span-12 md:col-span-8 md:col-start-3">
          <RegistrySubmission />
        </div>

        <!-- Patreon Card -->
        <div class="col-span-12 md:col-span-8 md:col-start-3 mt-6">
          <patreon-card size="large" />
        </div>
      </div>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "page_title": "Contribute to Registry - Classic Mini DIY",
    "description": "Submit your Classic Mini to the community registry database.",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Registry",
    "sign_in_title": "Sign In to Contribute",
    "sign_in_description": "You need to be signed in to submit your Mini to the registry. Create a free account to get started.",
    "sign_in_button": "Sign In to Continue",
    "heading": "Submit to the Registry",
    "subtitle": "Add your Classic Mini to our community-driven registry. Your submission will be reviewed before being published."
  },
  "es": {
    "page_title": "Contribuir al Registro - Classic Mini DIY",
    "description": "Envie su Classic Mini a la base de datos del registro de la comunidad.",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Registro",
    "sign_in_title": "Inicia Sesion para Contribuir",
    "sign_in_description": "Debes iniciar sesion para enviar tu Mini al registro. Crea una cuenta gratuita para empezar.",
    "sign_in_button": "Iniciar Sesion para Continuar",
    "heading": "Enviar al Registro",
    "subtitle": "Agrega tu Classic Mini a nuestro registro impulsado por la comunidad. Tu envio sera revisado antes de ser publicado."
  },
  "fr": {
    "page_title": "Contribuer au Registre - Classic Mini DIY",
    "description": "Soumettez votre Classic Mini a la base de donnees du registre communautaire.",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Registre",
    "sign_in_title": "Connectez-vous pour Contribuer",
    "sign_in_description": "Vous devez etre connecte pour soumettre votre Mini au registre. Creez un compte gratuit pour commencer.",
    "sign_in_button": "Se Connecter pour Continuer",
    "heading": "Soumettre au Registre",
    "subtitle": "Ajoutez votre Classic Mini a notre registre communautaire. Votre soumission sera examinee avant publication."
  },
  "it": {
    "page_title": "Contribuisci al Registro - Classic Mini DIY",
    "description": "Invia la tua Classic Mini al database del registro della comunita.",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Registro",
    "sign_in_title": "Accedi per Contribuire",
    "sign_in_description": "Devi essere connesso per inviare la tua Mini al registro. Crea un account gratuito per iniziare.",
    "sign_in_button": "Accedi per Continuare",
    "heading": "Invia al Registro",
    "subtitle": "Aggiungi la tua Classic Mini al nostro registro guidato dalla comunita. La tua iscrizione sara esaminata prima della pubblicazione."
  },
  "de": {
    "page_title": "Zum Register Beitragen - Classic Mini DIY",
    "description": "Reichen Sie Ihren Classic Mini in der Community-Register-Datenbank ein.",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Register",
    "sign_in_title": "Anmelden zum Beitragen",
    "sign_in_description": "Sie muessen angemeldet sein, um Ihren Mini im Register einzureichen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
    "sign_in_button": "Anmelden und Fortfahren",
    "heading": "Zum Register Einreichen",
    "subtitle": "Fuegen Sie Ihren Classic Mini zu unserem gemeinschaftsgetriebenen Register hinzu. Ihre Einreichung wird vor der Veroeffentlichung ueberprueft."
  },
  "pt": {
    "page_title": "Contribuir para o Registro - Classic Mini DIY",
    "description": "Envie seu Classic Mini para o banco de dados do registro da comunidade.",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Registro",
    "sign_in_title": "Entre para Contribuir",
    "sign_in_description": "Voce precisa estar conectado para enviar seu Mini ao registro. Crie uma conta gratuita para comecar.",
    "sign_in_button": "Entrar para Continuar",
    "heading": "Enviar para o Registro",
    "subtitle": "Adicione seu Classic Mini ao nosso registro orientado pela comunidade. Seu envio sera revisado antes de ser publicado."
  },
  "ru": {
    "page_title": "Вклад в реестр - Classic Mini DIY",
    "description": "Отправьте свой Classic Mini в базу данных общественного реестра.",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Реестр",
    "sign_in_title": "Войдите, чтобы внести вклад",
    "sign_in_description": "Вам нужно войти в систему, чтобы отправить свой Mini в реестр. Создайте бесплатную учетную запись, чтобы начать.",
    "sign_in_button": "Войти для продолжения",
    "heading": "Отправить в реестр",
    "subtitle": "Добавьте свой Classic Mini в наш общественный реестр. Ваша заявка будет рассмотрена перед публикацией."
  },
  "ja": {
    "page_title": "レジストリに貢献 - Classic Mini DIY",
    "description": "あなたのクラシックミニをコミュニティレジストリデータベースに登録してください。",
    "hero_title": "クラシックミニアーカイブ",
    "breadcrumb_title": "レジストリ",
    "sign_in_title": "貢献するにはサインインしてください",
    "sign_in_description": "レジストリにミニを登録するにはサインインが必要です。無料アカウントを作成して始めましょう。",
    "sign_in_button": "サインインして続行",
    "heading": "レジストリに登録",
    "subtitle": "あなたのクラシックミニをコミュニティ主導のレジストリに追加してください。登録は公開前に審査されます。"
  },
  "zh": {
    "page_title": "贡献到注册 - Classic Mini DIY",
    "description": "将您的经典迷你提交到社区注册数据库。",
    "hero_title": "经典迷你档案馆",
    "breadcrumb_title": "注册",
    "sign_in_title": "登录以贡献",
    "sign_in_description": "您需要登录才能将您的迷你提交到注册表。创建免费帐户以开始。",
    "sign_in_button": "登录以继续",
    "heading": "提交到注册表",
    "subtitle": "将您的经典迷你添加到我们的社区驱动注册表。您的提交将在发布前进行审核。"
  },
  "ko": {
    "page_title": "레지스트리에 기여 - Classic Mini DIY",
    "description": "커뮤니티 레지스트리 데이터베이스에 클래식 미니를 등록하세요.",
    "hero_title": "클래식 미니 아카이브",
    "breadcrumb_title": "레지스트리",
    "sign_in_title": "기여하려면 로그인하세요",
    "sign_in_description": "레지스트리에 미니를 등록하려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
    "sign_in_button": "로그인하여 계속",
    "heading": "레지스트리에 등록",
    "subtitle": "커뮤니티 주도 레지스트리에 클래식 미니를 추가하세요. 등록은 게시 전에 검토됩니다."
  }
}
</i18n>
