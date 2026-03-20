<script lang="ts" setup>
  const route = useRoute();
  const router = useRouter();
  const switchLocalePath = useSwitchLocalePath();
  const { t, locale, locales, setLocale } = useI18n();
  const { user, userProfile, isAuthenticated, isAdmin, signOut } = useAuth();

  const displayName = computed(() => {
    if (!user.value) return '';
    return userProfile.value?.display_name || user.value.email?.split('@')[0] || 'User';
  });

  const initials = computed(() => {
    const name = displayName.value;
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  });

  const handleSignOut = async () => {
    isMobileMenuOpen.value = false;
    await signOut();
    router.push('/');
  };

  // Drawer state for mobile menu
  const isMobileMenuOpen = ref(false);

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
      icon: 'i-heroicons-building-storefront',
      faIcon: 'fa-shop',
      to: 'https://theminiexchange.com',
    },
    {
      label: t('navigation.blog'),
      icon: 'i-heroicons-pencil-square',
      faIcon: 'fa-pencil',
      to: 'https://classicminidiy.substack.com/',
    },
    {
      label: t('navigation.store'),
      icon: 'i-heroicons-shopping-bag',
      faIcon: 'fa-store',
      to: 'https://store.classicminidiy.com/',
    },
  ]);

  // Desktop dropdown format (nested array for UDropdownMenu)
  const communityItems = computed(() => [communityLinks.value]);

  // Get current locale info
  const currentLocale = computed(() => {
    return locales.value.find((i) => i.code === locale.value);
  });

  // Get available locales (excluding current)
  const availableLocales = computed(() => {
    return locales.value.filter((i) => i.code !== locale.value);
  });

  // Language dropdown items
  const languageItems = computed(() => {
    return availableLocales.value.map((loc) => ({
      label: getLanguageName(loc.code),
      onSelect: () => handleLanguageChange(loc.code),
    }));
  });

  // Language names in their native languages for better UX
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

  // Function to handle language change
  const handleLanguageChange = async (localeCode: string) => {
    await setLocale(localeCode as any);
    await navigateTo(switchLocalePath(localeCode as any));
    isMobileMenuOpen.value = false;
  };

  // Function to check if a route is active
  const isActive = (path: string): boolean => {
    if (path.startsWith('http')) return false;
    return route.path === path || route.path.startsWith(path + '/');
  };

  // Close mobile menu when navigating
  const handleNavClick = (item: any) => {
    if (!item.to?.startsWith('http')) {
      isMobileMenuOpen.value = false;
    }
  };
</script>

<template>
  <header class="bg-white dark:bg-[#171717] border-b border-neutral-200 dark:border-neutral-800">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between py-3">
        <!-- Logo -->
        <NuxtLink to="/" class="shrink-0">
          <nuxt-img
            :alt="t('logo_alt')"
            src="https://classicminidiy.s3.amazonaws.com/misc/Small-Black.png"
            class="w-32 dark:invert"
          />
        </NuxtLink>

        <!-- Desktop Navigation -->
        <nav class="hidden lg:flex items-center gap-1">
          <UButton
            v-for="item in navigationItems"
            :key="item.label"
            :to="item.to"
            variant="ghost"
            :color="isActive(item.to as string) ? 'primary' : 'neutral'"
            size="md"
            class="font-bold"
          >
            <i :class="['fad', item.icon, 'mr-1']"></i>
            {{ item.label }}
          </UButton>

          <!-- Community dropdown -->
          <UDropdownMenu :items="communityItems">
            <UButton variant="ghost" color="neutral" size="md" class="font-bold">
              <i class="fad fa-users mr-1"></i>
              {{ t('navigation.community') }}
              <i class="fad fa-chevron-down text-xs ml-1"></i>
            </UButton>
          </UDropdownMenu>
        </nav>

        <!-- Desktop Right Side Actions -->
        <div class="hidden lg:flex items-center gap-2">
          <!-- Language Switcher -->
          <UDropdownMenu :items="[languageItems]">
            <UButton variant="ghost" color="neutral" size="sm">
              <i class="fad fa-globe mr-1"></i>
              <span class="text-xs font-medium">{{ currentLocale?.code?.toUpperCase() || 'EN' }}</span>
              <i class="fad fa-chevron-down text-xs ml-1"></i>
            </UButton>
          </UDropdownMenu>

          <!-- Color Mode Toggle -->
          <UColorModeButton />

          <!-- Profile Dropdown (authenticated) -->
          <UDropdownMenu
            v-if="isAuthenticated"
            :items="[
              [
                ...(isAdmin
                  ? [
                      {
                        label: t('profile.admin'),
                        icon: 'i-heroicons-shield-check',
                        to: '/admin',
                      },
                    ]
                  : []),
                {
                  label: t('profile.dashboard'),
                  icon: 'i-fa6-solid-gauge',
                  to: '/dashboard',
                },
                {
                  label: t('profile.submissions'),
                  icon: 'i-heroicons-document-text',
                  to: '/submissions',
                },
                {
                  label: t('profile.edit_profile'),
                  icon: 'i-fa6-solid-user-pen',
                  to: '/profile/edit',
                },
                {
                  label: t('profile.view_profile'),
                  icon: 'i-fa6-solid-user',
                  to: `/users/${user?.id}`,
                },
                {
                  label: t('profile.contribute'),
                  icon: 'i-fa6-solid-paper-plane',
                  to: '/contribute',
                },
              ],
              [
                {
                  label: t('profile.sign_out'),
                  icon: 'i-heroicons-arrow-right-on-rectangle',
                  onSelect: handleSignOut,
                },
              ],
            ]"
          >
            <UButton variant="ghost" color="neutral" size="sm" class="gap-2">
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
            </UButton>
          </UDropdownMenu>

          <!-- Sign In Button (not authenticated) -->
          <UButton v-else to="/login" variant="soft" color="primary" size="sm">
            <i class="fad fa-right-to-bracket mr-1"></i>
            {{ t('profile.sign_in') }}
          </UButton>
        </div>

        <!-- Mobile Menu Button -->
        <div class="lg:hidden flex items-center gap-2">
          <UColorModeButton size="sm" />
          <UButton variant="ghost" color="neutral" size="sm" square @click="isMobileMenuOpen = true" aria-label="Open menu">
            <i class="fad fa-bars text-xl"></i>
          </UButton>
        </div>
      </div>
    </div>

    <!-- Mobile Drawer -->
    <USlideover v-model:open="isMobileMenuOpen" side="right">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">{{ t('mobile_menu_title') }}</span>
        </div>
      </template>

      <template #body>
        <div class="flex flex-col gap-2">
          <!-- Navigation Links -->
          <UButton
            v-for="item in navigationItems"
            :key="item.label"
            :to="item.to"
            variant="ghost"
            :color="isActive(item.to as string) ? 'primary' : 'neutral'"
            block
            class="justify-start font-bold"
            @click="handleNavClick(item)"
          >
            <i :class="['fad', item.icon, 'mr-2']"></i>
            {{ item.label }}
          </UButton>

          <USeparator class="my-2" />

          <!-- Community Links -->
          <p class="text-sm text-muted px-2">{{ t('navigation.community') }}</p>
          <UButton
            v-for="link in communityLinks"
            :key="link.to"
            :to="link.to"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            color="neutral"
            block
            class="justify-start font-bold"
          >
            <i :class="['fad', link.faIcon, 'mr-2']"></i>
            {{ link.label }}
          </UButton>

          <USeparator class="my-2" />

          <!-- Language Selection -->
          <div class="px-2">
            <p class="text-sm text-muted mb-2">{{ t('language_label') }}</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="loc in availableLocales"
                :key="loc.code"
                variant="outline"
                color="neutral"
                size="xs"
                @click="handleLanguageChange(loc.code)"
              >
                {{ getLanguageName(loc.code) }}
              </UButton>
            </div>
          </div>

          <USeparator class="my-2" />

          <!-- Account Section -->
          <template v-if="isAuthenticated">
            <p class="text-sm text-muted px-2">{{ t('profile.account') }}</p>
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
            <UButton
              v-if="isAdmin"
              to="/admin"
              variant="ghost"
              color="neutral"
              block
              class="justify-start font-bold"
              @click="isMobileMenuOpen = false"
            >
              <i class="fad fa-shield-check mr-2"></i>
              {{ t('profile.admin') }}
            </UButton>
            <UButton
              to="/dashboard"
              variant="ghost"
              color="neutral"
              block
              class="justify-start font-bold"
              @click="isMobileMenuOpen = false"
            >
              <i class="fad fa-gauge mr-2"></i>
              {{ t('profile.dashboard') }}
            </UButton>
            <UButton
              to="/submissions"
              variant="ghost"
              color="neutral"
              block
              class="justify-start font-bold"
              @click="isMobileMenuOpen = false"
            >
              <i class="fad fa-file-lines mr-2"></i>
              {{ t('profile.submissions') }}
            </UButton>
            <UButton
              to="/profile/edit"
              variant="ghost"
              color="neutral"
              block
              class="justify-start font-bold"
              @click="isMobileMenuOpen = false"
            >
              <i class="fad fa-user-pen mr-2"></i>
              {{ t('profile.edit_profile') }}
            </UButton>
            <UButton
              :to="`/users/${user?.id}`"
              variant="ghost"
              color="neutral"
              block
              class="justify-start font-bold"
              @click="isMobileMenuOpen = false"
            >
              <i class="fad fa-user mr-2"></i>
              {{ t('profile.view_profile') }}
            </UButton>
            <UButton
              to="/contribute"
              variant="ghost"
              color="neutral"
              block
              class="justify-start font-bold"
              @click="isMobileMenuOpen = false"
            >
              <i class="fad fa-paper-plane mr-2"></i>
              {{ t('profile.contribute') }}
            </UButton>
            <UButton variant="ghost" color="error" block class="justify-start font-bold" @click="handleSignOut">
              <i class="fad fa-right-from-bracket mr-2"></i>
              {{ t('profile.sign_out') }}
            </UButton>
          </template>
          <template v-else>
            <UButton to="/login" variant="soft" color="primary" block @click="isMobileMenuOpen = false">
              <i class="fad fa-right-to-bracket mr-2"></i>
              {{ t('profile.sign_in') }}
            </UButton>
          </template>
        </div>
      </template>
    </USlideover>
  </header>
</template>

<i18n lang="json">
{
  "en": {
    "logo_alt": "Classic Mini DIY Logo",
    "navigation": {
      "toolbox": "Toolbox",
      "archive": "Archive",
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
      "admin": "Admin Dashboard",
      "submissions": "My Submissions",
      "edit_profile": "Edit Profile",
      "view_profile": "View Profile",
      "dashboard": "Dashboard",
      "contribute": "Contribute"
    },
    "language_label": "Language",
    "mobile_menu_title": "Menu"
  },
  "es": {
    "logo_alt": "Logo de Classic Mini DIY",
    "navigation": {
      "toolbox": "Herramientas",
      "archive": "Archivo",
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
      "edit_profile": "Editar Perfil",
      "view_profile": "Ver Perfil",
      "dashboard": "Panel",
      "contribute": "Contribuir"
    },
    "language_label": "Idioma",
    "mobile_menu_title": "Menú"
  },
  "fr": {
    "logo_alt": "Logo Classic Mini DIY",
    "navigation": {
      "toolbox": "Outils",
      "archive": "Archive",
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
      "edit_profile": "Modifier le Profil",
      "view_profile": "Voir le Profil",
      "dashboard": "Tableau de Bord",
      "contribute": "Contribuer"
    },
    "language_label": "Langue",
    "mobile_menu_title": "Menu"
  },
  "de": {
    "logo_alt": "Classic Mini DIY Logo",
    "navigation": {
      "toolbox": "Werkzeuge",
      "archive": "Archiv",
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
      "edit_profile": "Profil Bearbeiten",
      "view_profile": "Profil Anzeigen",
      "dashboard": "Dashboard",
      "contribute": "Beitragen"
    },
    "language_label": "Sprache",
    "mobile_menu_title": "Menü"
  },
  "it": {
    "logo_alt": "Logo Classic Mini DIY",
    "navigation": {
      "toolbox": "Strumenti",
      "archive": "Archivio",
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
      "edit_profile": "Modifica Profilo",
      "view_profile": "Visualizza Profilo",
      "dashboard": "Dashboard",
      "contribute": "Contribuisci"
    },
    "language_label": "Lingua",
    "mobile_menu_title": "Menu"
  },
  "ja": {
    "logo_alt": "Classic Mini DIY ロゴ",
    "navigation": {
      "toolbox": "ツールボックス",
      "archive": "アーカイブ",
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
      "edit_profile": "プロフィール編集",
      "view_profile": "プロフィール表示",
      "dashboard": "ダッシュボード",
      "contribute": "コントリビュート"
    },
    "language_label": "言語",
    "mobile_menu_title": "メニュー"
  },
  "ko": {
    "logo_alt": "Classic Mini DIY 로고",
    "navigation": {
      "toolbox": "도구상자",
      "archive": "아카이브",
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
      "edit_profile": "프로필 편집",
      "view_profile": "프로필 보기",
      "dashboard": "대시보드",
      "contribute": "기여하기"
    },
    "language_label": "언어",
    "mobile_menu_title": "메뉴"
  },
  "pt": {
    "logo_alt": "Logo Classic Mini DIY",
    "navigation": {
      "toolbox": "Ferramentas",
      "archive": "Arquivo",
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
      "edit_profile": "Editar Perfil",
      "view_profile": "Ver Perfil",
      "dashboard": "Painel",
      "contribute": "Contribuir"
    },
    "language_label": "Idioma",
    "mobile_menu_title": "Menu"
  },
  "ru": {
    "logo_alt": "Логотип Classic Mini DIY",
    "navigation": {
      "toolbox": "Инструменты",
      "archive": "Архив",
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
      "edit_profile": "Редактировать Профиль",
      "view_profile": "Просмотр Профиля",
      "dashboard": "Панель управления",
      "contribute": "Внести вклад"
    },
    "language_label": "Язык",
    "mobile_menu_title": "Меню"
  },
  "zh": {
    "logo_alt": "Classic Mini DIY 徽标",
    "navigation": {
      "toolbox": "工具箱",
      "archive": "档案",
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
      "edit_profile": "编辑个人资料",
      "view_profile": "查看个人资料",
      "dashboard": "仪表板",
      "contribute": "贡献"
    },
    "language_label": "语言",
    "mobile_menu_title": "菜单"
  }
}
</i18n>
