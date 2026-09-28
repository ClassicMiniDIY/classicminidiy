<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '~~/data/models/generic';
  import type { AccountNavGroup } from '~/components/account/Shell.vue';

  const { t } = useI18n();
  const { isAuthenticated, loading: authLoading } = useAuth();

  /**
   * Auth state is only knowable AFTER mount, and the template must not branch
   * on it before then.
   *
   * The Supabase session lives in localStorage, so `isAuthenticated` is always
   * false during SSR and flips true once `initAuth()` runs. Branching a
   * `v-if`/`v-else` pair straight off it makes the server emit the sign-in gate
   * while the client's first render wants the dashboard shell — and Vue's
   * hydration repair MERGES the two subtrees rather than replacing one. That is
   * the mechanism that orphaned the account dropdown from its `.dropdown`
   * wrapper in MainNav; see the dropdown invariants in CLAUDE.md.
   *
   * This file is the parent layout route, so all 14 `/dashboard/*` children
   * inherited the mismatch.
   *
   * Three states rather than two, so a signed-in user never flashes the
   * sign-in CTA while the session is still resolving — same shape as
   * `app/pages/membership/index.vue`.
   */
  const hasMounted = ref(false);
  onMounted(() => (hasMounted.value = true));
  const authReady = computed(() => hasMounted.value && !authLoading.value);
  const isSignedIn = computed(() => authReady.value && isAuthenticated.value);

  // Marketplace (The Mini Exchange) sections append only when the consolidation
  // flag is live — their routes are 404'd by exchange-flag.global.ts until then.
  const exchangeEnabled = useRuntimeConfig().public.exchangeEnabled;

  // Grouped sidebar rather than a tab strip: twelve labelled tabs overflowed the
  // strip. Account settings (API keys, notifications) live on /settings.
  const navGroups = computed<AccountNavGroup[]>(() => [
    {
      label: t('groups.models'),
      entries: [
        { to: '/dashboard/models', label: t('tabs.models'), icon: 'fas fa-cube' },
        { to: '/dashboard/selling', label: t('tabs.selling'), icon: 'fas fa-store' },
        { to: '/dashboard/purchases', label: t('tabs.purchases'), icon: 'fas fa-bag-shopping' },
      ],
    },
    {
      label: t('groups.tools'),
      entries: [
        { to: '/dashboard/gear-configs', label: t('tabs.gear_configs'), icon: 'fas fa-gears' },
        { to: '/dashboard/alignment-configs', label: t('tabs.alignment_configs'), icon: 'fas fa-tire' },
      ],
    },
    {
      label: t('groups.contributions'),
      entries: [
        { to: '/dashboard/submissions', label: t('tabs.submissions'), icon: 'fas fa-file-lines' },
        { to: '/dashboard/external', label: t('tabs.external'), icon: 'fas fa-link' },
      ],
    },
    ...(exchangeEnabled
      ? [
          {
            label: t('groups.marketplace'),
            entries: [
              { to: '/dashboard/listings', label: t('tabs.listings'), icon: 'fas fa-tag' },
              { to: '/dashboard/wanted', label: t('tabs.wanted'), icon: 'fas fa-bullhorn' },
              { to: '/dashboard/saved-searches', label: t('tabs.saved_searches'), icon: 'fas fa-bookmark' },
            ],
          },
        ]
      : []),
  ]);

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

    <!-- Resolving the session: neither the gate nor the dashboard yet. The
         server renders this branch too, so SSR and the client's first render
         agree and hydration has nothing to repair. -->
    <div v-if="!authReady" class="max-w-lg mx-auto">
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body items-center text-center py-12">
          <i class="fas fa-spinner fa-spin text-3xl text-primary"></i>
        </div>
      </div>
    </div>

    <!-- Auth gate -->
    <div v-else-if="!isSignedIn" class="max-w-lg mx-auto">
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
      <AccountShell :groups="navGroups" :nav-label="t('nav_label')">
        <NuxtPage />
        <template #nav-footer>
          <NuxtLink to="/settings" class="btn btn-ghost btn-sm mt-3 w-full justify-start gap-3">
            <i class="fas fa-gear w-4" aria-hidden="true"></i>
            {{ t('settings_link') }}
          </NuxtLink>
        </template>
      </AccountShell>
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
    "tabs": {
      "models": "3D Models",
      "gear_configs": "Gear Configs",
      "alignment_configs": "Alignment",
      "submissions": "Submissions",
      "external": "External Links",
      "selling": "Selling",
      "purchases": "Purchases",
      "listings": "Listings",
      "wanted": "Wanted",
      "saved_searches": "Saved Searches"
    },
    "auth": {
      "sign_in_title": "Sign In to View Dashboard",
      "sign_in_description": "You need to be signed in to access your dashboard. Create a free account to get started.",
      "sign_in_button": "Sign In to Continue"
    },
    "groups": {
      "models": "3D models",
      "tools": "Saved tools",
      "contributions": "Contributions",
      "marketplace": "Marketplace"
    },
    "nav_label": "Dashboard sections",
    "settings_link": "Settings"
  },
  "es": {
    "title": "Panel - Classic Mini DIY",
    "description": "Administra tus modelos 3D, configuraciones de engranajes y envíos al archivo.",
    "hero_title": "Panel",
    "breadcrumb_title": "Panel",
    "eyebrow": "CUENTA",
    "tabs": {
      "models": "Modelos 3D",
      "gear_configs": "Engranajes",
      "alignment_configs": "Alineación",
      "submissions": "Envíos",
      "external": "Enlaces externos",
      "selling": "Ventas",
      "purchases": "Compras",
      "listings": "Anuncios",
      "wanted": "Buscados",
      "saved_searches": "Búsquedas guardadas"
    },
    "auth": {
      "sign_in_title": "Inicia Sesión para Ver el Panel",
      "sign_in_description": "Debes iniciar sesión para acceder a tu panel. Crea una cuenta gratuita para empezar.",
      "sign_in_button": "Iniciar Sesión para Continuar"
    },
    "groups": {
      "models": "Modelos 3D",
      "tools": "Herramientas guardadas",
      "contributions": "Contribuciones",
      "marketplace": "Mercado"
    },
    "nav_label": "Secciones del panel",
    "settings_link": "Ajustes"
  },
  "fr": {
    "title": "Tableau de Bord - Classic Mini DIY",
    "description": "Gérez vos modèles 3D, configurations d'engrenages et soumissions à l'archive.",
    "hero_title": "Tableau de Bord",
    "breadcrumb_title": "Tableau de Bord",
    "eyebrow": "COMPTE",
    "tabs": {
      "models": "Modèles 3D",
      "gear_configs": "Engrenages",
      "alignment_configs": "Géométrie",
      "submissions": "Soumissions",
      "external": "Liens externes",
      "selling": "Ventes",
      "purchases": "Achats",
      "listings": "Annonces",
      "wanted": "Recherches",
      "saved_searches": "Recherches enregistrées"
    },
    "auth": {
      "sign_in_title": "Connectez-vous pour Voir le Tableau de Bord",
      "sign_in_description": "Vous devez être connecté pour accéder à votre tableau de bord. Créez un compte gratuit pour commencer.",
      "sign_in_button": "Se Connecter pour Continuer"
    },
    "groups": {
      "models": "Modèles 3D",
      "tools": "Outils enregistrés",
      "contributions": "Contributions",
      "marketplace": "Marché"
    },
    "nav_label": "Sections du tableau de bord",
    "settings_link": "Paramètres"
  },
  "de": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Verwalten Sie Ihre 3D-Modelle, Getriebe-Konfigurationen und Archiv-Einreichungen.",
    "hero_title": "Dashboard",
    "breadcrumb_title": "Dashboard",
    "eyebrow": "KONTO",
    "tabs": {
      "models": "3D-Modelle",
      "gear_configs": "Getriebe",
      "alignment_configs": "Achseinstellung",
      "submissions": "Einreichungen",
      "external": "Externe Links",
      "selling": "Verkauf",
      "purchases": "Käufe",
      "listings": "Anzeigen",
      "wanted": "Gesuche",
      "saved_searches": "Gespeicherte Suchen"
    },
    "auth": {
      "sign_in_title": "Anmelden zum Dashboard",
      "sign_in_description": "Sie müssen angemeldet sein, um auf Ihr Dashboard zuzugreifen. Erstellen Sie ein kostenloses Konto.",
      "sign_in_button": "Anmelden und Fortfahren"
    },
    "groups": {
      "models": "3D-Modelle",
      "tools": "Gespeicherte Werkzeuge",
      "contributions": "Beiträge",
      "marketplace": "Marktplatz"
    },
    "nav_label": "Dashboard-Bereiche",
    "settings_link": "Einstellungen"
  },
  "it": {
    "title": "Dashboard - Classic Mini DIY",
    "description": "Gestisci i tuoi modelli 3D, configurazioni ingranaggi e proposte all'archivio.",
    "hero_title": "Dashboard",
    "breadcrumb_title": "Dashboard",
    "eyebrow": "ACCOUNT",
    "tabs": {
      "models": "Modelli 3D",
      "gear_configs": "Ingranaggi",
      "alignment_configs": "Allineamento",
      "submissions": "Proposte",
      "external": "Link esterni",
      "selling": "Vendite",
      "purchases": "Acquisti",
      "listings": "Annunci",
      "wanted": "Cercasi",
      "saved_searches": "Ricerche salvate"
    },
    "auth": {
      "sign_in_title": "Accedi per Vedere la Dashboard",
      "sign_in_description": "Devi essere connesso per accedere alla tua dashboard. Crea un account gratuito per iniziare.",
      "sign_in_button": "Accedi per Continuare"
    },
    "groups": {
      "models": "Modelli 3D",
      "tools": "Strumenti salvati",
      "contributions": "Contributi",
      "marketplace": "Mercato"
    },
    "nav_label": "Sezioni della dashboard",
    "settings_link": "Impostazioni"
  },
  "pt": {
    "title": "Painel - Classic Mini DIY",
    "description": "Gerencie seus modelos 3D, configurações de engrenagens e envios ao arquivo.",
    "hero_title": "Painel",
    "breadcrumb_title": "Painel",
    "eyebrow": "CONTA",
    "tabs": {
      "models": "Modelos 3D",
      "gear_configs": "Engrenagens",
      "alignment_configs": "Alinhamento",
      "submissions": "Envios",
      "external": "Links externos",
      "selling": "Vendas",
      "purchases": "Compras",
      "listings": "Anúncios",
      "wanted": "Procurados",
      "saved_searches": "Buscas salvas"
    },
    "auth": {
      "sign_in_title": "Entre para Ver o Painel",
      "sign_in_description": "Você precisa estar conectado para acessar seu painel. Crie uma conta gratuita para começar.",
      "sign_in_button": "Entrar para Continuar"
    },
    "groups": {
      "models": "Modelos 3D",
      "tools": "Ferramentas salvas",
      "contributions": "Contribuições",
      "marketplace": "Mercado"
    },
    "nav_label": "Seções do painel",
    "settings_link": "Configurações"
  },
  "ru": {
    "title": "Панель управления - Classic Mini DIY",
    "description": "Управляйте 3D-моделями, конфигурациями передач и заявками в архив.",
    "hero_title": "Панель управления",
    "breadcrumb_title": "Панель управления",
    "eyebrow": "АККАУНТ",
    "tabs": {
      "models": "3D-модели",
      "gear_configs": "Передачи",
      "alignment_configs": "Развал-схождение",
      "submissions": "Заявки",
      "external": "Внешние ссылки",
      "selling": "Продажи",
      "purchases": "Покупки",
      "listings": "Объявления",
      "wanted": "Запросы",
      "saved_searches": "Сохранённые поиски"
    },
    "auth": {
      "sign_in_title": "Войдите для Доступа к Панели",
      "sign_in_description": "Вы должны быть авторизованы для доступа к панели управления. Создайте бесплатную учётную запись.",
      "sign_in_button": "Войти и Продолжить"
    },
    "groups": {
      "models": "3D-модели",
      "tools": "Сохранённые инструменты",
      "contributions": "Вклад",
      "marketplace": "Маркетплейс"
    },
    "nav_label": "Разделы панели",
    "settings_link": "Настройки"
  },
  "ja": {
    "title": "ダッシュボード - Classic Mini DIY",
    "description": "3Dモデル、保存したギア設定、アーカイブ申請を管理します。",
    "hero_title": "ダッシュボード",
    "breadcrumb_title": "ダッシュボード",
    "eyebrow": "アカウント",
    "tabs": {
      "models": "3Dモデル",
      "gear_configs": "ギア設定",
      "alignment_configs": "アライメント",
      "submissions": "申請",
      "external": "外部リンク",
      "selling": "販売",
      "purchases": "購入",
      "listings": "出品",
      "wanted": "求む",
      "saved_searches": "保存した検索"
    },
    "auth": {
      "sign_in_title": "ダッシュボード表示にはログインが必要です",
      "sign_in_description": "ダッシュボードにアクセスするにはログインが必要です。無料アカウントを作成して始めましょう。",
      "sign_in_button": "ログインして続ける"
    },
    "groups": {
      "models": "3Dモデル",
      "tools": "保存したツール",
      "contributions": "投稿",
      "marketplace": "マーケットプレイス"
    },
    "nav_label": "ダッシュボードのセクション",
    "settings_link": "設定"
  },
  "zh": {
    "title": "仪表板 - Classic Mini DIY",
    "description": "管理您的 3D 模型、已保存的齿轮配置和档案提交。",
    "hero_title": "仪表板",
    "breadcrumb_title": "仪表板",
    "eyebrow": "账户",
    "tabs": {
      "models": "3D模型",
      "gear_configs": "齿轮配置",
      "alignment_configs": "四轮定位",
      "submissions": "提交",
      "external": "外部链接",
      "selling": "销售",
      "purchases": "购买",
      "listings": "刊登",
      "wanted": "求购",
      "saved_searches": "已保存搜索"
    },
    "auth": {
      "sign_in_title": "登录以查看仪表板",
      "sign_in_description": "您需要登录才能访问您的仪表板。创建免费账户即可开始。",
      "sign_in_button": "登录并继续"
    },
    "groups": {
      "models": "3D 模型",
      "tools": "已保存的工具",
      "contributions": "贡献",
      "marketplace": "市场"
    },
    "nav_label": "仪表板栏目",
    "settings_link": "设置"
  },
  "ko": {
    "title": "대시보드 - Classic Mini DIY",
    "description": "3D 모델, 저장된 기어 구성, 아카이브 제출을 관리하세요.",
    "hero_title": "대시보드",
    "breadcrumb_title": "대시보드",
    "eyebrow": "계정",
    "tabs": {
      "models": "3D 모델",
      "gear_configs": "기어 구성",
      "alignment_configs": "얼라인먼트",
      "submissions": "제출",
      "external": "외부 링크",
      "selling": "판매",
      "purchases": "구매",
      "listings": "매물",
      "wanted": "구함",
      "saved_searches": "저장한 검색"
    },
    "auth": {
      "sign_in_title": "대시보드 보기를 위해 로그인하세요",
      "sign_in_description": "대시보드에 접근하려면 로그인해야 합니다. 무료 계정을 만들어 시작하세요.",
      "sign_in_button": "로그인하고 계속하기"
    },
    "groups": {
      "models": "3D 모델",
      "tools": "저장된 도구",
      "contributions": "기여",
      "marketplace": "마켓플레이스"
    },
    "nav_label": "대시보드 섹션",
    "settings_link": "설정"
  }
}
</i18n>
