<script lang="ts" setup>
  const route = useRoute();
  const router = useRouter();
  const switchLocalePath = useSwitchLocalePath();
  const { t, locale, locales, setLocale } = useI18n();
  const { user, userProfile, isAuthenticated, isAdmin, signOut } = useAuth();
  const { track, trackOutbound } = useAnalytics();

  const displayName = computed(() => {
    if (!user.value) return '';
    return userProfile.value?.display_name || user.value.email?.split('@')[0] || 'User';
  });

  const initials = computed(() => {
    const name = displayName.value;
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  });

  const isMobileMenuOpen = ref(false);

  const handleSignOut = async () => {
    isMobileMenuOpen.value = false;
    await signOut();
    router.push('/');
  };

  // Top-level navigation items (on-site pages)
  const navigationItems = computed(() => [
    {
      label: t('navigation.toolbox'),
      icon: 'fa-toolbox',
      to: '/technical',
    },
    {
      label: t('navigation.archive'),
      icon: 'fa-books',
      to: '/archive',
    },
    {
      label: t('navigation.models'),
      icon: 'fa-cube',
      to: '/models',
    },
    {
      label: t('navigation.maps'),
      icon: 'fa-computer-classic',
      to: '/maps',
    },
    {
      label: t('navigation.chat'),
      icon: 'fa-comments',
      to: '/chat',
    },
  ]);

  // Community link data (single source of truth for desktop + mobile)
  const communityLinks = computed(() => [
    {
      label: t('navigation.exchange'),
      faIcon: 'fa-shop',
      to: 'https://theminiexchange.com',
    },
    {
      label: t('navigation.blog'),
      faIcon: 'fa-pencil',
      to: 'https://news.classicminidiy.com/',
    },
    {
      label: t('navigation.store'),
      faIcon: 'fa-store',
      to: 'https://store.classicminidiy.com/',
    },
  ]);

  const currentLocale = computed(() => {
    return locales.value.find((i) => i.code === locale.value);
  });

  const availableLocales = computed(() => {
    return locales.value.filter((i) => i.code !== locale.value);
  });

  const getLanguageName = (localeCode: string): string => {
    const nativeNames: Record<string, string> = {
      en: 'English',
      de: 'Deutsch',
      es: 'Español',
      fr: 'Français',
      it: 'Italiano',
      pt: 'Português',
      ru: 'Русский',
      ja: '日本語',
      zh: '中文',
      ko: '한국어',
    };
    return nativeNames[localeCode] || localeCode;
  };

  const handleLanguageChange = async (localeCode: string) => {
    await setLocale(localeCode as any);
    await navigateTo(switchLocalePath(localeCode as any));
    isMobileMenuOpen.value = false;
    closeDropdowns();
  };

  const isActive = (path: string): boolean => {
    if (path.startsWith('http')) return false;
    return route.path === path || route.path.startsWith(path + '/');
  };

  const handleNavClick = (item: any) => {
    track('nav_item_clicked', { label: item.label, surface: 'mobile' });
    if (!item.to?.startsWith('http')) {
      isMobileMenuOpen.value = false;
    }
  };

  // DaisyUI dropdowns using `tabindex` + focus close via blur helper
  const closeDropdowns = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Lock body scroll when mobile menu open
  watch(isMobileMenuOpen, (open) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
  });
</script>

<template>
  <header class="bg-base-100 border-b border-base-300">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between py-3">
        <!-- Logo -->
        <NuxtLink to="/" class="shrink-0">
          <nuxt-img
            :alt="t('logo_alt')"
            src="https://classicminidiy.s3.amazonaws.com/misc/Small-Black.png"
            class="w-32 logo-image"
            width="128"
            height="37"
            loading="eager"
            fetchpriority="high"
          />
        </NuxtLink>

        <!-- Desktop Navigation -->
        <nav class="hidden lg:flex items-center gap-1">
          <NuxtLink
            v-for="item in navigationItems"
            :key="item.label"
            :to="item.to"
            :class="['btn btn-ghost btn-md font-bold', isActive(item.to as string) ? 'text-primary' : '']"
            @click="track('nav_item_clicked', { label: item.label, surface: 'desktop' })"
          >
            <i :class="['fad', item.icon, 'mr-1']"></i>
            {{ item.label }}
          </NuxtLink>

          <!-- Community dropdown -->
          <div class="dropdown dropdown-end">
            <div tabindex="0" role="button" class="btn btn-ghost btn-md font-bold">
              <i class="fad fa-users mr-1"></i>
              {{ t('navigation.community') }}
              <i class="fad fa-chevron-down text-xs ml-1"></i>
            </div>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box shadow-lg z-[60] mt-2 w-56 p-2 border border-base-300"
            >
              <li v-for="link in communityLinks" :key="link.to">
                <a
                  :href="link.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click="
                    closeDropdowns();
                    trackOutbound({ destination: link.to, label: link.label, group: 'community_nav' });
                  "
                >
                  <i :class="['fad', link.faIcon]"></i>
                  {{ link.label }}
                </a>
              </li>
            </ul>
          </div>
        </nav>

        <!-- Desktop Right Side Actions -->
        <div class="hidden lg:flex items-center gap-2">
          <!-- Language Switcher -->
          <div class="dropdown dropdown-end">
            <div tabindex="0" role="button" class="btn btn-ghost btn-sm">
              <i class="fad fa-globe mr-1"></i>
              <span class="text-xs font-medium">{{ currentLocale?.code?.toUpperCase() || 'EN' }}</span>
              <i class="fad fa-chevron-down text-xs ml-1"></i>
            </div>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box shadow-lg z-[60] mt-2 w-48 p-2 border border-base-300 max-h-80 overflow-y-auto"
            >
              <li v-for="loc in availableLocales" :key="loc.code">
                <button type="button" @click="handleLanguageChange(loc.code)">
                  {{ getLanguageName(loc.code) }}
                </button>
              </li>
            </ul>
          </div>

          <!-- Color Mode Toggle -->
          <ColorModeButton />

          <!-- Profile Dropdown (authenticated) -->
          <div v-if="isAuthenticated" class="dropdown dropdown-end">
            <div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-2">
              <div v-if="userProfile?.avatar_url" class="w-6 h-6 rounded-full overflow-hidden">
                <img :src="userProfile.avatar_url" :alt="displayName" class="w-full h-full object-cover" />
              </div>
              <div
                v-else
                class="w-6 h-6 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold"
              >
                {{ initials }}
              </div>
              <span class="hidden xl:inline text-sm">{{ displayName }}</span>
              <i class="fad fa-chevron-down text-xs"></i>
            </div>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box shadow-lg z-[60] mt-2 w-56 p-2 border border-base-300"
            >
              <li class="menu-title">{{ t('profile.account') }}</li>
              <li>
                <NuxtLink
                  to="/profile"
                  @click="
                    closeDropdowns();
                    track('nav_item_clicked', { label: t('profile.profile') });
                  "
                >
                  <i class="fas fa-user"></i>
                  {{ t('profile.profile') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/membership"
                  @click="
                    closeDropdowns();
                    track('nav_item_clicked', { label: t('profile.membership') });
                  "
                >
                  <i class="fas fa-star"></i>
                  {{ t('profile.membership') }}
                </NuxtLink>
              </li>
              <li class="menu-title mt-1">{{ t('profile.activity') }}</li>
              <li>
                <NuxtLink
                  to="/dashboard"
                  @click="
                    closeDropdowns();
                    track('nav_item_clicked', { label: t('profile.submissions') });
                  "
                >
                  <i class="fas fa-file-lines"></i>
                  {{ t('profile.submissions') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/contribute"
                  @click="
                    closeDropdowns();
                    track('nav_item_clicked', { label: t('profile.contribute') });
                  "
                >
                  <i class="fas fa-paper-plane"></i>
                  {{ t('profile.contribute') }}
                </NuxtLink>
              </li>
              <li class="menu-title mt-1">
                <span class="sr-only">{{ t('session_label') }}</span>
              </li>
              <li v-if="isAdmin">
                <NuxtLink
                  to="/admin"
                  @click="
                    closeDropdowns();
                    track('nav_item_clicked', { label: t('profile.admin') });
                  "
                >
                  <i class="fas fa-shield-check"></i>
                  {{ t('profile.admin') }}
                </NuxtLink>
              </li>
              <li>
                <button type="button" @click="handleSignOut">
                  <i class="fas fa-arrow-right-from-bracket"></i>
                  {{ t('profile.sign_out') }}
                </button>
              </li>
            </ul>
          </div>

          <!-- Sign In Button (not authenticated) -->
          <NuxtLink v-else to="/login" class="btn btn-primary btn-sm">
            <i class="fad fa-right-to-bracket mr-1"></i>
            {{ t('profile.sign_in') }}
          </NuxtLink>
        </div>

        <!-- Mobile Menu Button -->
        <div class="lg:hidden flex items-center gap-2">
          <ColorModeButton size="sm" />
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-square"
            :aria-label="t('mobile_menu_title')"
            @click="
              isMobileMenuOpen = true;
              track('mobile_menu_toggled', { state: 'open' });
            "
          >
            <i class="fad fa-bars text-xl"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Drawer (DaisyUI overlay + slide-in panel) -->
    <Teleport to="body">
      <Transition name="mobile-drawer">
        <div v-if="isMobileMenuOpen" class="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/50" aria-hidden="true" @click="isMobileMenuOpen = false"></div>

          <!-- Panel -->
          <aside
            class="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-base-100 shadow-xl overflow-y-auto flex flex-col"
          >
            <div class="flex items-center justify-between p-4 border-b border-base-300">
              <span class="font-semibold">{{ t('mobile_menu_title') }}</span>
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-square"
                :aria-label="t('close_menu')"
                @click="
                  isMobileMenuOpen = false;
                  track('mobile_menu_toggled', { state: 'closed' });
                "
              >
                <i class="fas fa-xmark text-lg"></i>
              </button>
            </div>

            <div class="flex-1 p-4 flex flex-col gap-2">
              <!-- Navigation Links -->
              <NuxtLink
                v-for="item in navigationItems"
                :key="item.label"
                :to="item.to"
                :class="[
                  'btn btn-ghost btn-block justify-start font-bold',
                  isActive(item.to as string) ? 'text-primary' : '',
                ]"
                @click="handleNavClick(item)"
              >
                <i :class="['fad', item.icon, 'mr-2']"></i>
                {{ item.label }}
              </NuxtLink>

              <div class="divider my-2"></div>

              <!-- Community Links -->
              <p class="text-sm opacity-70 px-2">{{ t('navigation.community') }}</p>
              <a
                v-for="link in communityLinks"
                :key="link.to"
                :href="link.to"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-ghost btn-block justify-start font-bold"
                @click="trackOutbound({ destination: link.to, label: link.label, group: 'community_nav' })"
              >
                <i :class="['fad', link.faIcon, 'mr-2']"></i>
                {{ link.label }}
              </a>

              <div class="divider my-2"></div>

              <!-- Language Selection -->
              <div class="px-2">
                <p class="text-sm opacity-70 mb-2">{{ t('language_label') }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="loc in availableLocales"
                    :key="loc.code"
                    type="button"
                    class="btn btn-outline btn-xs"
                    @click="handleLanguageChange(loc.code)"
                  >
                    {{ getLanguageName(loc.code) }}
                  </button>
                </div>
              </div>

              <div class="divider my-2"></div>

              <!-- Account Section -->
              <template v-if="isAuthenticated">
                <p class="text-sm opacity-70 px-2">{{ t('profile.account') }}</p>
                <div class="flex items-center gap-2 px-2 py-1">
                  <div v-if="userProfile?.avatar_url" class="w-8 h-8 rounded-full overflow-hidden shrink-0">
                    <img :src="userProfile.avatar_url" :alt="displayName" class="w-full h-full object-cover" />
                  </div>
                  <div
                    v-else
                    class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold shrink-0"
                  >
                    {{ initials }}
                  </div>
                  <span class="text-sm font-medium truncate">{{ displayName }}</span>
                </div>
                <NuxtLink
                  to="/profile"
                  class="btn btn-ghost btn-block justify-start font-bold"
                  @click="isMobileMenuOpen = false"
                >
                  <i class="fad fa-user mr-2"></i>
                  {{ t('profile.profile') }}
                </NuxtLink>
                <NuxtLink
                  to="/membership"
                  class="btn btn-ghost btn-block justify-start font-bold"
                  @click="isMobileMenuOpen = false"
                >
                  <i class="fad fa-star mr-2"></i>
                  {{ t('profile.membership') }}
                </NuxtLink>
                <p class="text-sm opacity-70 px-2 mt-2">{{ t('profile.activity') }}</p>
                <NuxtLink
                  to="/dashboard"
                  class="btn btn-ghost btn-block justify-start font-bold"
                  @click="isMobileMenuOpen = false"
                >
                  <i class="fad fa-file-lines mr-2"></i>
                  {{ t('profile.submissions') }}
                </NuxtLink>
                <NuxtLink
                  to="/contribute"
                  class="btn btn-ghost btn-block justify-start font-bold"
                  @click="isMobileMenuOpen = false"
                >
                  <i class="fad fa-paper-plane mr-2"></i>
                  {{ t('profile.contribute') }}
                </NuxtLink>
                <NuxtLink
                  v-if="isAdmin"
                  to="/admin"
                  class="btn btn-ghost btn-block justify-start font-bold"
                  @click="isMobileMenuOpen = false"
                >
                  <i class="fad fa-shield-check mr-2"></i>
                  {{ t('profile.admin') }}
                </NuxtLink>
                <button
                  type="button"
                  class="btn btn-ghost btn-block justify-start font-bold text-error"
                  @click="handleSignOut"
                >
                  <i class="fad fa-right-from-bracket mr-2"></i>
                  {{ t('profile.sign_out') }}
                </button>
              </template>
              <template v-else>
                <NuxtLink to="/login" class="btn btn-primary btn-block" @click="isMobileMenuOpen = false">
                  <i class="fad fa-right-to-bracket mr-2"></i>
                  {{ t('profile.sign_in') }}
                </NuxtLink>
              </template>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>

<style scoped>
  [data-theme='cmdiy-dark'] .logo-image {
    filter: invert(1);
  }

  /* Brand-orange duotone icons in the top nav (design system). */
  header nav :deep(.fad),
  header nav :deep(.fa-duotone) {
    --fa-secondary-color: var(--cm-secondary);
    --fa-secondary-opacity: 1;
  }
  /* Active link: primary olive carries the icon primary so the
     whole link reads as the active brand color. */
  header nav a.router-link-active :deep(.fad),
  header nav a.router-link-active :deep(.fa-duotone) {
    --fa-primary-color: var(--cm-primary);
  }

  .mobile-drawer-enter-active,
  .mobile-drawer-leave-active {
    transition: opacity 0.2s ease;
  }
  .mobile-drawer-enter-active aside,
  .mobile-drawer-leave-active aside {
    transition: transform 0.25s ease;
  }
  .mobile-drawer-enter-from,
  .mobile-drawer-leave-to {
    opacity: 0;
  }
  .mobile-drawer-enter-from aside,
  .mobile-drawer-leave-to aside {
    transform: translateX(100%);
  }
</style>

<i18n lang="json">
{
  "en": {
    "logo_alt": "Classic Mini DIY Logo",
    "navigation": {
      "toolbox": "Toolbox",
      "archive": "Archive",
      "models": "Models",
      "maps": "Maps",
      "chat": "Chat",
      "community": "Community",
      "exchange": "The Mini Exchange",
      "blog": "Blog",
      "store": "Store"
    },
    "profile": {
      "sign_in": "Sign In",
      "sign_out": "Sign Out",
      "account": "Account",
      "activity": "Activity",
      "admin": "Admin Dashboard",
      "submissions": "My Submissions",
      "profile": "Profile",
      "membership": "Membership",
      "dashboard": "Dashboard",
      "contribute": "Contribute"
    },
    "language_label": "Language",
    "mobile_menu_title": "Menu",
    "close_menu": "Close menu",
    "session_label": "Session"
  },
  "es": {
    "logo_alt": "Logo de Classic Mini DIY",
    "navigation": {
      "toolbox": "Herramientas",
      "archive": "Archivo",
      "models": "Modelos",
      "maps": "Mapas",
      "chat": "Chat",
      "community": "Comunidad",
      "exchange": "The Mini Exchange",
      "blog": "Blog",
      "store": "Tienda"
    },
    "profile": {
      "sign_in": "Iniciar sesión",
      "sign_out": "Cerrar sesión",
      "account": "Cuenta",
      "admin": "Panel de Admin",
      "submissions": "Mis envíos",
      "profile": "Perfil",
      "dashboard": "Panel",
      "contribute": "Contribuir"
    },
    "language_label": "Idioma",
    "mobile_menu_title": "Menú",
    "close_menu": "Cerrar menú",
    "session_label": "Sesión"
  },
  "fr": {
    "logo_alt": "Logo Classic Mini DIY",
    "navigation": {
      "toolbox": "Outils",
      "archive": "Archive",
      "models": "Modèles",
      "maps": "Cartes",
      "chat": "Chat",
      "community": "Communauté",
      "exchange": "The Mini Exchange",
      "blog": "Blog",
      "store": "Boutique"
    },
    "profile": {
      "sign_in": "Se connecter",
      "sign_out": "Se déconnecter",
      "account": "Compte",
      "admin": "Tableau de bord Admin",
      "submissions": "Mes soumissions",
      "profile": "Profil",
      "dashboard": "Tableau de Bord",
      "contribute": "Contribuer"
    },
    "language_label": "Langue",
    "mobile_menu_title": "Menu",
    "close_menu": "Fermer le menu",
    "session_label": "Session"
  },
  "de": {
    "logo_alt": "Classic Mini DIY Logo",
    "navigation": {
      "toolbox": "Werkzeuge",
      "archive": "Archiv",
      "models": "Modelle",
      "maps": "Karten",
      "chat": "Chat",
      "community": "Gemeinschaft",
      "exchange": "The Mini Exchange",
      "blog": "Blog",
      "store": "Shop"
    },
    "profile": {
      "sign_in": "Anmelden",
      "sign_out": "Abmelden",
      "account": "Konto",
      "admin": "Admin-Dashboard",
      "submissions": "Meine Einreichungen",
      "profile": "Profil",
      "dashboard": "Dashboard",
      "contribute": "Beitragen"
    },
    "language_label": "Sprache",
    "mobile_menu_title": "Menü",
    "close_menu": "Menü schließen",
    "session_label": "Sitzung"
  },
  "it": {
    "logo_alt": "Logo Classic Mini DIY",
    "navigation": {
      "toolbox": "Strumenti",
      "archive": "Archivio",
      "models": "Modelli",
      "maps": "Mappe",
      "chat": "Chat",
      "community": "Comunità",
      "exchange": "The Mini Exchange",
      "blog": "Blog",
      "store": "Negozio"
    },
    "profile": {
      "sign_in": "Accedi",
      "sign_out": "Esci",
      "account": "Account",
      "admin": "Pannello Admin",
      "submissions": "I miei invii",
      "profile": "Profilo",
      "dashboard": "Dashboard",
      "contribute": "Contribuisci"
    },
    "language_label": "Lingua",
    "mobile_menu_title": "Menu",
    "close_menu": "Chiudi menu",
    "session_label": "Sessione"
  },
  "ja": {
    "logo_alt": "Classic Mini DIY ロゴ",
    "navigation": {
      "toolbox": "ツールボックス",
      "archive": "アーカイブ",
      "models": "モデル",
      "maps": "マップ",
      "chat": "チャット",
      "community": "コミュニティ",
      "exchange": "The Mini Exchange",
      "blog": "ブログ",
      "store": "ストア"
    },
    "profile": {
      "sign_in": "ログイン",
      "sign_out": "ログアウト",
      "account": "アカウント",
      "admin": "管理ダッシュボード",
      "submissions": "投稿一覧",
      "profile": "プロフィール",
      "dashboard": "ダッシュボード",
      "contribute": "コントリビュート"
    },
    "language_label": "言語",
    "mobile_menu_title": "メニュー",
    "close_menu": "メニューを閉じる",
    "session_label": "セッション"
  },
  "ko": {
    "logo_alt": "Classic Mini DIY 로고",
    "navigation": {
      "toolbox": "도구상자",
      "archive": "아카이브",
      "models": "모델",
      "maps": "맵",
      "chat": "채팅",
      "community": "커뮤니티",
      "exchange": "The Mini Exchange",
      "blog": "블로그",
      "store": "스토어"
    },
    "profile": {
      "sign_in": "로그인",
      "sign_out": "로그아웃",
      "account": "계정",
      "admin": "관리자 대시보드",
      "submissions": "내 제출",
      "profile": "프로필",
      "dashboard": "대시보드",
      "contribute": "기여하기"
    },
    "language_label": "언어",
    "mobile_menu_title": "메뉴",
    "close_menu": "메뉴 닫기",
    "session_label": "세션"
  },
  "pt": {
    "logo_alt": "Logo Classic Mini DIY",
    "navigation": {
      "toolbox": "Ferramentas",
      "archive": "Arquivo",
      "models": "Modelos",
      "maps": "Mapas",
      "chat": "Chat",
      "community": "Comunidade",
      "exchange": "The Mini Exchange",
      "blog": "Blog",
      "store": "Loja"
    },
    "profile": {
      "sign_in": "Entrar",
      "sign_out": "Sair",
      "account": "Conta",
      "admin": "Painel Admin",
      "submissions": "Minhas submissões",
      "profile": "Perfil",
      "dashboard": "Painel",
      "contribute": "Contribuir"
    },
    "language_label": "Idioma",
    "mobile_menu_title": "Menu",
    "close_menu": "Fechar menu",
    "session_label": "Sessão"
  },
  "ru": {
    "logo_alt": "Логотип Classic Mini DIY",
    "navigation": {
      "toolbox": "Инструменты",
      "archive": "Архив",
      "models": "Модели",
      "maps": "Карты",
      "chat": "Чат",
      "community": "Сообщество",
      "exchange": "The Mini Exchange",
      "blog": "Блог",
      "store": "Магазин"
    },
    "profile": {
      "sign_in": "Войти",
      "sign_out": "Выйти",
      "account": "Аккаунт",
      "admin": "Панель администратора",
      "submissions": "Мои заявки",
      "profile": "Профиль",
      "dashboard": "Панель управления",
      "contribute": "Внести вклад"
    },
    "language_label": "Язык",
    "mobile_menu_title": "Меню",
    "close_menu": "Закрыть меню",
    "session_label": "Сеанс"
  },
  "zh": {
    "logo_alt": "Classic Mini DIY 徽标",
    "navigation": {
      "toolbox": "工具箱",
      "archive": "档案",
      "models": "模型",
      "maps": "地图",
      "chat": "聊天",
      "community": "社区",
      "exchange": "The Mini Exchange",
      "blog": "博客",
      "store": "商店"
    },
    "profile": {
      "sign_in": "登录",
      "sign_out": "退出",
      "account": "账户",
      "admin": "管理面板",
      "submissions": "我的提交",
      "profile": "个人资料",
      "dashboard": "仪表板",
      "contribute": "贡献"
    },
    "language_label": "语言",
    "mobile_menu_title": "菜单",
    "close_menu": "关闭菜单",
    "session_label": "会话"
  }
}
</i18n>
