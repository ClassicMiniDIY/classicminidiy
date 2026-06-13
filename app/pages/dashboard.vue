<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '~~/data/models/generic';

  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const route = useRoute();

  const tabs = [
    { to: '/dashboard/models', key: 'models', icon: 'fa-cube' },
    { to: '/dashboard/gear-configs', key: 'gear_configs', icon: 'fa-gears' },
    { to: '/dashboard/submissions', key: 'submissions', icon: 'fa-file-lines' },
    { to: '/dashboard/selling', key: 'selling', icon: 'fa-store' },
    { to: '/dashboard/purchases', key: 'purchases', icon: 'fa-bag-shopping' },
  ];

  useHead({
    title: t('title'),
    meta: [
      { name: 'description', content: t('description') },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });
</script>

<template>
  <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />

  <div class="container mx-auto px-4 py-6">
    <div class="mb-6">
      <breadcrumb :version="BREADCRUMB_VERSIONS.PROFILE" root />
    </div>

    <div class="mb-8">
      <PageIntro :eyebrow="t('eyebrow')" :title="t('hero_title')" as="h2" />
    </div>

    <!-- Auth gate -->
    <div v-if="!isAuthenticated" class="max-w-lg mx-auto">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-6 text-center">
          <div class="mb-4">
            <i class="fas fa-lock text-5xl opacity-40"></i>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ t('auth.sign_in_title') }}</h2>
          <p class="text-base mb-6 opacity-70">{{ t('auth.sign_in_description') }}</p>
          <NuxtLink to="/login" class="btn btn-primary btn-block">
            {{ t('auth.sign_in_button') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Authenticated content -->
    <template v-else>
      <!-- Routed tab bar -->
      <div role="tablist" class="tabs tabs-border mb-6">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          role="tab"
          class="tab gap-2"
          :class="{ 'tab-active': route.path === tab.to }"
        >
          <i class="fas" :class="tab.icon"></i>
          <span>{{ t(`tabs.${tab.key}`) }}</span>
        </NuxtLink>
      </div>

      <NuxtPage />
    </template>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Manage your 3D models, saved gear configurations, and archive submissions.",
    "hero_title": "Dashboard",
    "breadcrumb_title": "Dashboard",
    "eyebrow": "ACCOUNT",
    "tabs": { "models": "3D Models", "gear_configs": "Gear Configs", "submissions": "Submissions", "selling": "Selling", "purchases": "Purchases" },
    "auth": {
      "sign_in_title": "Sign In to View Dashboard",
      "sign_in_description": "You need to be signed in to access your dashboard. Create a free account to get started.",
      "sign_in_button": "Sign In to Continue"
    }
  },
  "es": {
    "title": "Panel - Classic Mini DIY",
    "description": "Administra tus modelos 3D, configuraciones de engranajes y envíos al archivo.",
    "hero_title": "Panel",
    "breadcrumb_title": "Panel",
    "eyebrow": "CUENTA",
    "tabs": { "models": "Modelos 3D", "gear_configs": "Engranajes", "submissions": "Envíos", "selling": "Ventas", "purchases": "Compras" },
    "auth": {
      "sign_in_title": "Inicia Sesión para Ver el Panel",
      "sign_in_description": "Debes iniciar sesión para acceder a tu panel. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar Sesión para Continuar"
    }
  },
  "fr": {
    "title": "Tableau de Bord - Classic Mini DIY",
    "description": "Gérez vos modèles 3D, configurations d'engrenages et soumissions à l'archive.",
    "hero_title": "Tableau de Bord",
    "breadcrumb_title": "Tableau de Bord",
    "eyebrow": "COMPTE",
    "tabs": { "models": "Modèles 3D", "gear_configs": "Engrenages", "submissions": "Soumissions", "selling": "Ventes", "purchases": "Achats" },
    "auth": {
      "sign_in_title": "Connectez-vous pour Voir le Tableau de Bord",
      "sign_in_description": "Vous devez être connecté pour accéder à votre tableau de bord. Créez un compte gratuit pour commencer.",
      "sign_in_button": "Se Connecter pour Continuer"
    }
  },
  "de": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Verwalten Sie Ihre 3D-Modelle, Getriebe-Konfigurationen und Archiv-Einreichungen.",
    "hero_title": "Dashboard",
    "breadcrumb_title": "Dashboard",
    "eyebrow": "KONTO",
    "tabs": { "models": "3D-Modelle", "gear_configs": "Getriebe", "submissions": "Einreichungen", "selling": "Verkauf", "purchases": "Käufe" },
    "auth": {
      "sign_in_title": "Anmelden zum Dashboard",
      "sign_in_description": "Sie müssen angemeldet sein, um auf Ihr Dashboard zuzugreifen. Erstellen Sie ein kostenloses Konto.",
      "sign_in_button": "Anmelden und Fortfahren"
    }
  },
  "it": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Gestisci i tuoi modelli 3D, configurazioni ingranaggi e proposte all'archivio.",
    "hero_title": "Dashboard",
    "breadcrumb_title": "Dashboard",
    "eyebrow": "ACCOUNT",
    "tabs": { "models": "Modelli 3D", "gear_configs": "Ingranaggi", "submissions": "Proposte", "selling": "Vendite", "purchases": "Acquisti" },
    "auth": {
      "sign_in_title": "Accedi per Vedere la Dashboard",
      "sign_in_description": "Devi essere connesso per accedere alla tua dashboard. Crea un account gratuito per iniziare.",
      "sign_in_button": "Accedi per Continuare"
    }
  },
  "pt": {
    "title": "Painel - Classic Mini DIY",
    "description": "Gerencie seus modelos 3D, configurações de engrenagens e envios ao arquivo.",
    "hero_title": "Painel",
    "breadcrumb_title": "Painel",
    "eyebrow": "CONTA",
    "tabs": { "models": "Modelos 3D", "gear_configs": "Engrenagens", "submissions": "Envios", "selling": "Vendas", "purchases": "Compras" },
    "auth": {
      "sign_in_title": "Entre para Ver o Painel",
      "sign_in_description": "Você precisa estar conectado para acessar seu painel. Crie uma conta gratuita para começar.",
      "sign_in_button": "Entrar para Continuar"
    }
  },
  "ru": {
    "title": "Панель управления - Classic Mini DIY",
    "description": "Управляйте 3D-моделями, конфигурациями передач и заявками в архив.",
    "hero_title": "Панель управления",
    "breadcrumb_title": "Панель управления",
    "eyebrow": "АККАУНТ",
    "tabs": { "models": "3D-модели", "gear_configs": "Передачи", "submissions": "Заявки", "selling": "Продажи", "purchases": "Покупки" },
    "auth": {
      "sign_in_title": "Войдите для Доступа к Панели",
      "sign_in_description": "Вы должны быть авторизованы для доступа к панели управления. Создайте бесплатную учётную запись.",
      "sign_in_button": "Войти и Продолжить"
    }
  },
  "ja": {
    "title": "ダッシュボード - Classic Mini DIY",
    "description": "3Dモデル、保存したギア設定、アーカイブ申請を管理します。",
    "hero_title": "ダッシュボード",
    "breadcrumb_title": "ダッシュボード",
    "eyebrow": "アカウント",
    "tabs": { "models": "3Dモデル", "gear_configs": "ギア設定", "submissions": "申請", "selling": "販売", "purchases": "購入" },
    "auth": {
      "sign_in_title": "ダッシュボード表示にはログインが必要です",
      "sign_in_description": "ダッシュボードにアクセスするにはログインが必要です。無料アカウントを作成して始めましょう。",
      "sign_in_button": "ログインして続ける"
    }
  },
  "zh": {
    "title": "仪表板 - Classic Mini DIY",
    "description": "管理您的 3D 模型、已保存的齿轮配置和档案提交。",
    "hero_title": "仪表板",
    "breadcrumb_title": "仪表板",
    "eyebrow": "账户",
    "tabs": { "models": "3D模型", "gear_configs": "齿轮配置", "submissions": "提交", "selling": "销售", "purchases": "购买" },
    "auth": {
      "sign_in_title": "登录以查看仪表板",
      "sign_in_description": "您需要登录才能访问您的仪表板。创建免费账户即可开始。",
      "sign_in_button": "登录并继续"
    }
  },
  "ko": {
    "title": "대시보드 - Classic Mini DIY",
    "description": "3D 모델, 저장된 기어 구성, 아카이브 제출을 관리하세요.",
    "hero_title": "대시보드",
    "breadcrumb_title": "대시보드",
    "eyebrow": "계정",
    "tabs": { "models": "3D 모델", "gear_configs": "기어 구성", "submissions": "제출", "selling": "판매", "purchases": "구매" },
    "auth": {
      "sign_in_title": "대시보드 보기를 위해 로그인하세요",
      "sign_in_description": "대시보드에 접근하려면 로그인해야 합니다. 무료 계정을 만들어 시작하세요.",
      "sign_in_button": "로그인하고 계속하기"
    }
  }
}
</i18n>
