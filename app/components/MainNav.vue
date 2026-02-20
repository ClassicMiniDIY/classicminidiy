<script lang="ts" setup>
  const route = useRoute();
  const switchLocalePath = useSwitchLocalePath();
  const { t, locale, locales, setLocale } = useI18n();

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

  // Community dropdown items (external links)
  const communityItems = computed(() => [
    [
      {
        label: t('navigation.exchange'),
        icon: 'i-heroicons-building-storefront',
        to: 'https://theminiexchange.com',
      },
      {
        label: t('navigation.blog'),
        icon: 'i-heroicons-pencil-square',
        to: 'https://classicminidiy.substack.com/',
      },
      {
        label: t('navigation.store'),
        icon: 'i-heroicons-shopping-bag',
        to: 'https://store.classicminidiy.com/',
      },
    ],
  ]);

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

          <!-- Patreon Button -->
          <UButton to="https://patreon.com/classicminidiy" target="_blank" class="is-patreon" size="sm">
            <i class="fab fa-patreon mr-1"></i>
            {{ t('donate_button') }}
          </UButton>
        </div>

        <!-- Mobile Menu Button -->
        <div class="lg:hidden flex items-center gap-2">
          <UColorModeButton size="sm" />
          <UButton variant="ghost" color="neutral" size="sm" square @click="isMobileMenuOpen = true">
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
            to="https://theminiexchange.com"
            target="_blank"
            variant="ghost"
            color="neutral"
            block
            class="justify-start font-bold"
          >
            <i class="fad fa-shop mr-2"></i>
            {{ t('navigation.exchange') }}
          </UButton>
          <UButton
            to="https://classicminidiy.substack.com/"
            target="_blank"
            variant="ghost"
            color="neutral"
            block
            class="justify-start font-bold"
          >
            <i class="fad fa-pencil mr-2"></i>
            {{ t('navigation.blog') }}
          </UButton>
          <UButton
            to="https://store.classicminidiy.com/"
            target="_blank"
            variant="ghost"
            color="neutral"
            block
            class="justify-start font-bold"
          >
            <i class="fad fa-store mr-2"></i>
            {{ t('navigation.store') }}
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

          <!-- Patreon Button -->
          <UButton to="https://patreon.com/classicminidiy" target="_blank" class="is-patreon" block>
            <i class="fab fa-patreon mr-2"></i>
            {{ t('donate_button') }}
          </UButton>
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
    "donate_button": "Join CMDIY",
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
    "donate_button": "Únete a CMDIY",
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
    "donate_button": "Rejoindre CMDIY",
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
    "donate_button": "CMDIY beitreten",
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
    "donate_button": "Unisciti a CMDIY",
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
    "donate_button": "CMDIYに参加",
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
    "donate_button": "CMDIY 가입",
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
    "donate_button": "Junte-se ao CMDIY",
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
    "donate_button": "Присоединиться к CMDIY",
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
    "donate_button": "加入 CMDIY",
    "language_label": "语言",
    "mobile_menu_title": "菜单"
  }
}
</i18n>
