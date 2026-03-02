<script lang="ts" setup>
  import { BREADCRUMB_VERSIONS, HERO_TYPES } from '../../../data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated, userProfile } = useAuth();

  useHead({
    title: $t('page_title'),
    meta: [
      {
        name: 'description',
        content: $t('subtitle'),
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const contributionTypes = [
    {
      to: '/contribute/document',
      icon: 'fa-duotone fa-books',
      titleKey: 'document_title',
      descriptionKey: 'document_description',
    },
    {
      to: '/contribute/color',
      icon: 'fa-duotone fa-brush',
      titleKey: 'color_title',
      descriptionKey: 'color_description',
    },
    {
      to: '/contribute/wheel',
      icon: 'fa-duotone fa-tire',
      titleKey: 'wheel_title',
      descriptionKey: 'wheel_description',
    },
    {
      to: '/contribute/registry',
      icon: 'fa-duotone fa-clipboard-list',
      titleKey: 'registry_title',
      descriptionKey: 'registry_description',
    },
  ];
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
      <!-- Heading -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold mb-2">{{ $t('heading') }}</h1>
        <p class="text-base opacity-70">{{ $t('subtitle') }}</p>
      </div>

      <!-- 2x2 Contribution Type Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <NuxtLink v-for="item in contributionTypes" :key="item.to" :to="item.to">
          <UCard class="h-full hover:shadow-xl transition-shadow">
            <div class="text-center p-6">
              <i :class="item.icon" class="text-4xl text-primary mb-4 block"></i>
              <h2 class="text-lg font-bold mb-2">{{ $t(item.titleKey) }}</h2>
              <p class="text-sm opacity-70">{{ $t(item.descriptionKey) }}</p>
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <!-- User Stats Card -->
      <div v-if="userProfile" class="max-w-3xl mx-auto mt-8">
        <UCard>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
            <div>
              <h3 class="text-lg font-bold mb-1">{{ $t('stats_title') }}</h3>
              <p class="text-sm opacity-70">
                {{ $t('stats_description', { total: userProfile.total_submissions, approved: userProfile.approved_submissions }) }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <UBadge
                :color="userProfile.trust_level === 'admin' || userProfile.trust_level === 'moderator' ? 'primary' : userProfile.trust_level === 'trusted' ? 'success' : userProfile.trust_level === 'contributor' ? 'info' : 'neutral'"
                variant="soft"
              >
                {{ userProfile.trust_level }}
              </UBadge>
              <UButton to="/submissions" color="primary" variant="outline">
                {{ $t('view_all') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </div>
    <div class="max-w-3xl mx-auto mt-8 mb-10">
      <patreon-card size="large" />
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "page_title": "Contribute - Classic Mini DIY",
    "hero_title": "Classic Mini Archives",
    "breadcrumb_title": "Contribute",
    "sign_in_title": "Sign In to Contribute",
    "sign_in_description": "You need to be signed in to contribute to the archive. Create a free account to get started.",
    "sign_in_button": "Sign In to Continue",
    "heading": "Contribute to the Archive",
    "subtitle": "Help preserve Classic Mini history by sharing your knowledge and data with the community.",
    "document_title": "Document",
    "document_description": "Manuals, adverts, catalogues, tuning guides",
    "color_title": "Color",
    "color_description": "Paint colors and swatches",
    "wheel_title": "Wheel",
    "wheel_description": "Fitment data and photos",
    "registry_title": "Registry",
    "registry_description": "Register your Classic Mini",
    "stats_title": "Your Contributions",
    "stats_description": "{total} submitted, {approved} approved",
    "view_all": "View All"
  },
  "es": {
    "page_title": "Contribuir - Classic Mini DIY",
    "hero_title": "Archivos Classic Mini",
    "breadcrumb_title": "Contribuir",
    "sign_in_title": "Inicia Sesion para Contribuir",
    "sign_in_description": "Debes iniciar sesion para contribuir al archivo. Crea una cuenta gratuita para empezar.",
    "sign_in_button": "Iniciar Sesion para Continuar",
    "heading": "Contribuir al Archivo",
    "subtitle": "Ayuda a preservar la historia del Classic Mini compartiendo tus conocimientos y datos con la comunidad.",
    "document_title": "Documento",
    "document_description": "Manuales, anuncios, catalogos, guias de tuning",
    "color_title": "Color",
    "color_description": "Colores de pintura y muestras",
    "wheel_title": "Rueda",
    "wheel_description": "Datos de montaje y fotos",
    "registry_title": "Registro",
    "registry_description": "Registra tu Classic Mini",
    "stats_title": "Tus Contribuciones",
    "stats_description": "{total} enviados, {approved} aprobados",
    "view_all": "Ver Todos"
  },
  "fr": {
    "page_title": "Contribuer - Classic Mini DIY",
    "hero_title": "Archives Classic Mini",
    "breadcrumb_title": "Contribuer",
    "sign_in_title": "Connectez-vous pour Contribuer",
    "sign_in_description": "Vous devez etre connecte pour contribuer aux archives. Creez un compte gratuit pour commencer.",
    "sign_in_button": "Se Connecter pour Continuer",
    "heading": "Contribuer aux Archives",
    "subtitle": "Aidez a preserver l'histoire de la Classic Mini en partageant vos connaissances et donnees avec la communaute.",
    "document_title": "Document",
    "document_description": "Manuels, publicites, catalogues, guides de tuning",
    "color_title": "Couleur",
    "color_description": "Couleurs de peinture et echantillons",
    "wheel_title": "Roue",
    "wheel_description": "Donnees de montage et photos",
    "registry_title": "Registre",
    "registry_description": "Enregistrez votre Classic Mini",
    "stats_title": "Vos Contributions",
    "stats_description": "{total} soumises, {approved} approuvees",
    "view_all": "Voir Tout"
  },
  "it": {
    "page_title": "Contribuisci - Classic Mini DIY",
    "hero_title": "Archivi Classic Mini",
    "breadcrumb_title": "Contribuisci",
    "sign_in_title": "Accedi per Contribuire",
    "sign_in_description": "Devi essere connesso per contribuire all'archivio. Crea un account gratuito per iniziare.",
    "sign_in_button": "Accedi per Continuare",
    "heading": "Contribuisci all'Archivio",
    "subtitle": "Aiuta a preservare la storia della Classic Mini condividendo le tue conoscenze e i tuoi dati con la comunita.",
    "document_title": "Documento",
    "document_description": "Manuali, pubblicita, cataloghi, guide di tuning",
    "color_title": "Colore",
    "color_description": "Colori di vernice e campioni",
    "wheel_title": "Ruota",
    "wheel_description": "Dati di montaggio e foto",
    "registry_title": "Registro",
    "registry_description": "Registra la tua Classic Mini",
    "stats_title": "I Tuoi Contributi",
    "stats_description": "{total} inviati, {approved} approvati",
    "view_all": "Vedi Tutti"
  },
  "de": {
    "page_title": "Beitragen - Classic Mini DIY",
    "hero_title": "Classic Mini Archive",
    "breadcrumb_title": "Beitragen",
    "sign_in_title": "Anmelden zum Beitragen",
    "sign_in_description": "Sie muessen angemeldet sein, um zum Archiv beizutragen. Erstellen Sie ein kostenloses Konto, um zu beginnen.",
    "sign_in_button": "Anmelden und Fortfahren",
    "heading": "Zum Archiv Beitragen",
    "subtitle": "Helfen Sie, die Geschichte des Classic Mini zu bewahren, indem Sie Ihr Wissen und Ihre Daten mit der Community teilen.",
    "document_title": "Dokument",
    "document_description": "Handbuecher, Werbung, Kataloge, Tuning-Anleitungen",
    "color_title": "Farbe",
    "color_description": "Lackfarben und Farbmuster",
    "wheel_title": "Rad",
    "wheel_description": "Einbaudaten und Fotos",
    "registry_title": "Register",
    "registry_description": "Registrieren Sie Ihren Classic Mini",
    "stats_title": "Ihre Beitraege",
    "stats_description": "{total} eingereicht, {approved} genehmigt",
    "view_all": "Alle Anzeigen"
  },
  "pt": {
    "page_title": "Contribuir - Classic Mini DIY",
    "hero_title": "Arquivos Classic Mini",
    "breadcrumb_title": "Contribuir",
    "sign_in_title": "Entre para Contribuir",
    "sign_in_description": "Voce precisa estar conectado para contribuir ao arquivo. Crie uma conta gratuita para comecar.",
    "sign_in_button": "Entrar para Continuar",
    "heading": "Contribuir para o Arquivo",
    "subtitle": "Ajude a preservar a historia do Classic Mini compartilhando seus conhecimentos e dados com a comunidade.",
    "document_title": "Documento",
    "document_description": "Manuais, anuncios, catalogos, guias de tuning",
    "color_title": "Cor",
    "color_description": "Cores de tinta e amostras",
    "wheel_title": "Roda",
    "wheel_description": "Dados de montagem e fotos",
    "registry_title": "Registro",
    "registry_description": "Registre seu Classic Mini",
    "stats_title": "Suas Contribuicoes",
    "stats_description": "{total} enviados, {approved} aprovados",
    "view_all": "Ver Todos"
  },
  "ru": {
    "page_title": "Вклад - Classic Mini DIY",
    "hero_title": "Архивы Classic Mini",
    "breadcrumb_title": "Вклад",
    "sign_in_title": "Войдите, чтобы внести вклад",
    "sign_in_description": "Вам нужно войти в систему, чтобы внести вклад в архив. Создайте бесплатную учетную запись, чтобы начать.",
    "sign_in_button": "Войти для продолжения",
    "heading": "Внести вклад в архив",
    "subtitle": "Помогите сохранить историю Classic Mini, поделившись своими знаниями и данными с сообществом.",
    "document_title": "Документ",
    "document_description": "Руководства, реклама, каталоги, руководства по тюнингу",
    "color_title": "Цвет",
    "color_description": "Цвета краски и образцы",
    "wheel_title": "Колесо",
    "wheel_description": "Данные о установке и фото",
    "registry_title": "Реестр",
    "registry_description": "Зарегистрируйте свой Classic Mini",
    "stats_title": "Ваши вклады",
    "stats_description": "{total} отправлено, {approved} одобрено",
    "view_all": "Показать все"
  },
  "ja": {
    "page_title": "貢献 - Classic Mini DIY",
    "hero_title": "クラシックミニアーカイブ",
    "breadcrumb_title": "貢献",
    "sign_in_title": "貢献するにはサインインしてください",
    "sign_in_description": "アーカイブに貢献するにはサインインが必要です。無料アカウントを作成して始めましょう。",
    "sign_in_button": "サインインして続行",
    "heading": "アーカイブに貢献する",
    "subtitle": "知識とデータをコミュニティと共有して、クラシックミニの歴史の保存にご協力ください。",
    "document_title": "ドキュメント",
    "document_description": "マニュアル、広告、カタログ、チューニングガイド",
    "color_title": "カラー",
    "color_description": "塗装色とスウォッチ",
    "wheel_title": "ホイール",
    "wheel_description": "フィットメントデータと写真",
    "registry_title": "レジストリ",
    "registry_description": "あなたのクラシックミニを登録",
    "stats_title": "あなたの貢献",
    "stats_description": "{total}件提出、{approved}件承認済み",
    "view_all": "すべて表示"
  },
  "zh": {
    "page_title": "贡献 - Classic Mini DIY",
    "hero_title": "经典迷你档案馆",
    "breadcrumb_title": "贡献",
    "sign_in_title": "登录以贡献",
    "sign_in_description": "您需要登录才能为档案馆做出贡献。创建免费帐户以开始。",
    "sign_in_button": "登录以继续",
    "heading": "为档案馆做出贡献",
    "subtitle": "通过与社区分享您的知识和数据，帮助保存经典迷你的历史。",
    "document_title": "文档",
    "document_description": "手册、广告、目录、调校指南",
    "color_title": "颜色",
    "color_description": "油漆颜色和色板",
    "wheel_title": "轮毂",
    "wheel_description": "安装数据和照片",
    "registry_title": "注册",
    "registry_description": "注册您的经典迷你",
    "stats_title": "您的贡献",
    "stats_description": "已提交{total}项，已批准{approved}项",
    "view_all": "查看全部"
  },
  "ko": {
    "page_title": "기여 - Classic Mini DIY",
    "hero_title": "클래식 미니 아카이브",
    "breadcrumb_title": "기여",
    "sign_in_title": "기여하려면 로그인하세요",
    "sign_in_description": "아카이브에 기여하려면 로그인이 필요합니다. 무료 계정을 만들어 시작하세요.",
    "sign_in_button": "로그인하여 계속",
    "heading": "아카이브에 기여하기",
    "subtitle": "지식과 데이터를 커뮤니티와 공유하여 클래식 미니의 역사 보존에 도움을 주세요.",
    "document_title": "문서",
    "document_description": "매뉴얼, 광고, 카탈로그, 튜닝 가이드",
    "color_title": "색상",
    "color_description": "페인트 색상 및 견본",
    "wheel_title": "휠",
    "wheel_description": "장착 데이터 및 사진",
    "registry_title": "레지스트리",
    "registry_description": "클래식 미니를 등록하세요",
    "stats_title": "나의 기여",
    "stats_description": "{total}개 제출, {approved}개 승인",
    "view_all": "모두 보기"
  }
}
</i18n>
