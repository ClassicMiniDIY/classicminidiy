<script lang="ts" setup>
  /**
   * Global navigation shell (design S1 / M1 / M2).
   *
   * One header on every page. The four destinations people move between —
   * Toolbox, Archive, Exchange, Chat — are always visible; everything else lives
   * under More. The Exchange link is promoted out of the old Community dropdown
   * because cross-navigation to the marketplace was the headline findability
   * complaint.
   *
   * The omnisearch trigger is a button, not an input: the real input lives in
   * the palette (OmniSearch.vue), and having two focusable text fields fighting
   * over the same query was the alternative.
   *
   * Language selection moved into the account dropdown / mobile drawer. Row 1 is
   * spec'd as search · theme · avatar, and a fourth control there crowded the
   * search field at laptop widths.
   */
  const route = useRoute();
  const router = useRouter();
  const switchLocalePath = useSwitchLocalePath();
  const { t, locale, locales, setLocale } = useI18n();
  const { user, userProfile, isAuthenticated, isAdmin, signOut } = useAuth();
  const { track, trackOutbound } = useAnalytics();
  const { open: openOmnisearch } = useOmnisearch();

  const displayName = computed(() => {
    if (!user.value) return '';
    return userProfile.value?.display_name || user.value.email?.split('@')[0] || 'User';
  });

  const handle = computed(() => (userProfile.value?.username ? `@${userProfile.value.username}` : displayName.value));

  const initials = computed(() => displayName.value.charAt(0).toUpperCase() || '?');

  const isMobileMenuOpen = ref(false);

  const handleSignOut = async () => {
    isMobileMenuOpen.value = false;
    await signOut();
    router.push('/');
  };

  /** Row 1, always visible. Icons are FA solid in brand orange. */
  const primaryLinks = computed(() => [
    { label: t('navigation.toolbox'), icon: 'fas fa-toolbox', to: '/technical', external: false },
    { label: t('navigation.archive'), icon: 'fas fa-book', to: '/archive', external: false },
    { label: t('navigation.exchange'), icon: 'fas fa-shop', to: '/exchange', external: false },
    { label: t('navigation.chat'), icon: 'fas fa-comments', to: '/chat', external: false },
  ]);

  /** The More dropdown, and the second block of the mobile drawer. */
  const secondaryLinks = computed(() => [
    { label: t('navigation.models'), icon: 'fas fa-cube', to: '/models', external: false },
    { label: t('navigation.maps'), icon: 'fas fa-map', to: '/maps', external: false },
    { label: t('navigation.store'), icon: 'fas fa-store', to: 'https://store.classicminidiy.com/', external: true },
    { label: t('navigation.news'), icon: 'fas fa-pencil', to: 'https://news.classicminidiy.com/', external: true },
    { label: t('navigation.about'), icon: 'fas fa-circle-info', to: '/about', external: false },
  ]);

  const currentLocale = computed(() => locales.value.find((i) => i.code === locale.value));
  const availableLocales = computed(() => locales.value.filter((i) => i.code !== locale.value));

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

  const isMoreActive = computed(() =>
    secondaryLinks.value.some((link) => !link.external && isActive(link.to as string))
  );

  const closeDropdowns = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const openSearch = (surface: string) => {
    isMobileMenuOpen.value = false;
    track('omnisearch_trigger_clicked', { surface });
    openOmnisearch();
  };

  const goToDrawerLink = (label: string) => {
    track('nav_item_clicked', { label, surface: 'mobile' });
    isMobileMenuOpen.value = false;
  };

  // Lock body scroll when the drawer is open
  watch(isMobileMenuOpen, (open) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
  });

  /**
   * `/` opens omnisearch from anywhere — but never while the caret is in a text
   * field, or the key would be swallowed instead of typed.
   */
  const onGlobalKeydown = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
    event.preventDefault();
    openSearch('hotkey');
  };

  onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onGlobalKeydown);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  });
</script>

<template>
  <header class="main-nav sticky top-0 z-50 border-b border-base-300 bg-base-100">
    <div class="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 lg:h-16 lg:gap-3 lg:px-6">
      <!-- Mobile: hamburger -->
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square lg:hidden"
        :aria-label="t('mobile_menu_title')"
        @click="
          isMobileMenuOpen = true;
          track('mobile_menu_toggled', { state: 'open' });
        "
      >
        <i class="fas fa-bars text-lg" aria-hidden="true"></i>
      </button>

      <!-- Logo -->
      <NuxtLink to="/" class="shrink-0" :aria-label="t('logo_alt')">
        <nuxt-img
          :alt="t('logo_alt')"
          src="https://classicminidiy.s3.amazonaws.com/misc/Small-Black.png"
          class="logo-image h-7 w-auto lg:h-[34px]"
          width="128"
          height="37"
          format="webp"
          loading="eager"
          fetchpriority="high"
        />
      </NuxtLink>

      <!-- Desktop: primary links + More -->
      <nav class="ml-1 hidden items-center gap-0.5 lg:flex" :aria-label="t('primary_nav')">
        <NuxtLink
          v-for="link in primaryLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :class="{ 'is-active': isActive(link.to as string) }"
          @click="track('nav_item_clicked', { label: link.label, surface: 'desktop' })"
        >
          <i :class="[link.icon, 'nav-link-icon']" aria-hidden="true"></i>
          {{ link.label }}
        </NuxtLink>

        <div class="dropdown">
          <div tabindex="0" role="button" class="nav-link" :class="{ 'is-active': isMoreActive }">
            {{ t('navigation.more') }}
            <i class="fas fa-chevron-down text-[10px] opacity-60" aria-hidden="true"></i>
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu z-[60] mt-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
          >
            <li v-for="link in secondaryLinks" :key="link.to">
              <NuxtLink v-if="!link.external" :to="link.to" class="font-semibold" @click="closeDropdowns()">
                <i :class="[link.icon, 'w-4 text-secondary']" aria-hidden="true"></i>
                {{ link.label }}
              </NuxtLink>
              <a
                v-else
                :href="link.to"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold"
                @click="
                  closeDropdowns();
                  trackOutbound({ destination: link.to, label: link.label, group: 'more_nav' });
                "
              >
                <i :class="[link.icon, 'w-4 text-secondary']" aria-hidden="true"></i>
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <div class="flex-1"></div>

      <!-- Desktop omnisearch trigger -->
      <button
        type="button"
        class="omnisearch-trigger hidden lg:flex"
        :aria-label="t('search_placeholder')"
        @click="openSearch('header')"
      >
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <span class="flex-1 text-left">{{ t('search_placeholder') }}</span>
        <kbd class="kbd kbd-xs">/</kbd>
      </button>

      <!-- Mobile omnisearch icon -->
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square lg:hidden"
        :aria-label="t('search_placeholder')"
        @click="openSearch('mobile_header')"
      >
        <i class="fas fa-magnifying-glass text-base" aria-hidden="true"></i>
      </button>

      <ColorModeButton size="sm" />

      <!-- Account -->
      <div v-if="isAuthenticated" class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="avatar-button" :aria-label="displayName">
          <!-- Sized in px, not `h-full w-full`. A percentage against an
               auto-height parent resolves to `auto`, i.e. the image's INTRINSIC
               size — so if `.avatar-button` ever fails to constrain the box
               (scoped CSS not applied yet, style block dropped) a 1024px avatar
               renders at 1024px, overflows the header row, shrinks the
               omnisearch field and drags the account dropdown off-screen with
               it. Fixed px means the worst case is an unrounded avatar. -->
          <img
            v-if="userProfile?.avatar_url"
            :src="userProfile.avatar_url"
            :alt="displayName"
            class="h-[34px] w-[34px] rounded-full object-cover"
          />
          <span v-else>{{ initials }}</span>
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu z-[60] mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        >
          <li class="menu-title truncate">{{ handle }}</li>
          <li>
            <NuxtLink to="/profile" @click="closeDropdowns()">
              <i class="fas fa-user w-4" aria-hidden="true"></i>
              {{ t('profile.profile') }}
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/dashboard" @click="closeDropdowns()">
              <i class="fas fa-gauge w-4" aria-hidden="true"></i>
              {{ t('profile.dashboard') }}
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/dashboard/submissions" @click="closeDropdowns()">
              <i class="fas fa-paper-plane w-4" aria-hidden="true"></i>
              {{ t('profile.submissions') }}
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/membership" @click="closeDropdowns()">
              <i class="fas fa-star w-4" aria-hidden="true"></i>
              {{ t('profile.membership') }}
            </NuxtLink>
          </li>

          <li class="menu-title mt-1">{{ t('language_label') }}</li>
          <li>
            <details>
              <summary>
                <i class="fas fa-globe w-4" aria-hidden="true"></i>
                {{ getLanguageName(currentLocale?.code || 'en') }}
              </summary>
              <ul class="max-h-56 overflow-y-auto">
                <li v-for="loc in availableLocales" :key="loc.code">
                  <button type="button" @click="handleLanguageChange(loc.code)">{{ getLanguageName(loc.code) }}</button>
                </li>
              </ul>
            </details>
          </li>

          <li v-if="isAdmin" class="mt-1">
            <NuxtLink to="/admin/inbox" @click="closeDropdowns()">
              <i class="fas fa-shield-check w-4" aria-hidden="true"></i>
              {{ t('profile.admin') }}
            </NuxtLink>
          </li>
          <li>
            <button type="button" class="text-error" @click="handleSignOut">
              <i class="fas fa-arrow-right-from-bracket w-4" aria-hidden="true"></i>
              {{ t('profile.sign_out') }}
            </button>
          </li>
        </ul>
      </div>

      <!-- Signed out -->
      <div v-else class="flex items-center gap-2">
        <div class="dropdown dropdown-end hidden lg:block">
          <div tabindex="0" role="button" class="btn btn-ghost btn-sm" :aria-label="t('language_label')">
            <i class="fas fa-globe" aria-hidden="true"></i>
            <span class="text-xs font-medium">{{ currentLocale?.code?.toUpperCase() || 'EN' }}</span>
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu z-[60] mt-2 max-h-80 w-48 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
          >
            <li v-for="loc in availableLocales" :key="loc.code">
              <button type="button" @click="handleLanguageChange(loc.code)">{{ getLanguageName(loc.code) }}</button>
            </li>
          </ul>
        </div>
        <NuxtLink to="/login" class="btn btn-primary btn-sm">
          <i class="fas fa-right-to-bracket" aria-hidden="true"></i>
          <span class="hidden sm:inline">{{ t('profile.sign_in') }}</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Mobile drawer: 300px, LEFT edge, 250ms slide, black/50 backdrop (no blur) -->
    <Teleport to="body">
      <Transition name="mobile-drawer">
        <div v-if="isMobileMenuOpen" class="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true">
          <div class="absolute inset-0 bg-black/50" aria-hidden="true" @click="isMobileMenuOpen = false"></div>

          <aside class="absolute left-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col bg-base-100 shadow-2xl">
            <div class="flex h-14 items-center gap-3 border-b border-base-300 px-4">
              <nuxt-img
                :alt="t('logo_alt')"
                src="https://classicminidiy.s3.amazonaws.com/misc/Small-Black.png"
                class="logo-image h-7 w-auto"
                width="128"
                height="37"
                format="webp"
              />
              <div class="flex-1"></div>
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-square"
                :aria-label="t('close_menu')"
                @click="
                  isMobileMenuOpen = false;
                  track('mobile_menu_toggled', { state: 'closed' });
                "
              >
                <i class="fas fa-xmark text-lg" aria-hidden="true"></i>
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-2.5">
              <NuxtLink
                v-for="link in primaryLinks"
                :key="link.to"
                :to="link.to"
                class="drawer-link is-primary"
                :class="{ 'is-active': isActive(link.to as string) }"
                @click="goToDrawerLink(link.label)"
              >
                <i :class="[link.icon, 'w-[18px] text-secondary']" aria-hidden="true"></i>
                {{ link.label }}
              </NuxtLink>

              <div class="my-2 mx-1.5 h-px bg-base-300"></div>

              <template v-for="link in secondaryLinks" :key="link.to">
                <NuxtLink
                  v-if="!link.external"
                  :to="link.to"
                  class="drawer-link"
                  :class="{ 'is-active': isActive(link.to as string) }"
                  @click="goToDrawerLink(link.label)"
                >
                  <i :class="[link.icon, 'w-[18px] text-secondary']" aria-hidden="true"></i>
                  {{ link.label }}
                </NuxtLink>
                <a
                  v-else
                  :href="link.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="drawer-link"
                  @click="trackOutbound({ destination: link.to, label: link.label, group: 'more_nav' })"
                >
                  <i :class="[link.icon, 'w-[18px] text-secondary']" aria-hidden="true"></i>
                  {{ link.label }}
                </a>
              </template>

              <div class="my-2 mx-1.5 h-px bg-base-300"></div>

              <NuxtLink
                v-if="isAdmin"
                to="/admin/inbox"
                class="drawer-link"
                @click="goToDrawerLink(t('profile.admin'))"
              >
                <i class="fas fa-shield-check w-[18px] text-secondary" aria-hidden="true"></i>
                {{ t('profile.admin') }}
              </NuxtLink>

              <div class="px-3 pt-3">
                <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] opacity-55">
                  {{ t('language_label') }}
                </p>
                <div class="flex flex-wrap gap-1.5">
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
            </div>

            <!-- Profile row, pinned: contributor identity is present everywhere -->
            <div class="border-t border-base-300 p-3.5">
              <NuxtLink
                v-if="isAuthenticated"
                to="/profile"
                class="flex items-center gap-3"
                @click="goToDrawerLink('profile')"
              >
                <span class="avatar-button avatar-button--sm">
                  <!-- Fixed px for the same reason as the header avatar above;
                       matches `.avatar-button--sm`. -->
                  <img
                    v-if="userProfile?.avatar_url"
                    :src="userProfile.avatar_url"
                    :alt="displayName"
                    class="h-9 w-9 rounded-full object-cover"
                  />
                  <span v-else>{{ initials }}</span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold">{{ displayName }}</span>
                  <span class="block text-xs opacity-60">{{ t('view_profile') }}</span>
                </span>
                <i class="fas fa-chevron-right text-xs opacity-50" aria-hidden="true"></i>
              </NuxtLink>
              <template v-else>
                <NuxtLink to="/login" class="btn btn-primary btn-block" @click="isMobileMenuOpen = false">
                  <i class="fas fa-right-to-bracket" aria-hidden="true"></i>
                  {{ t('profile.sign_in') }}
                </NuxtLink>
              </template>
              <button
                v-if="isAuthenticated"
                type="button"
                class="btn btn-ghost btn-sm btn-block mt-2 justify-start text-error"
                @click="handleSignOut"
              >
                <i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
                {{ t('profile.sign_out') }}
              </button>
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

  /* 36px tall, 14px/600, orange icon, 0.5rem radius, base-200 on hover. */
  .nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    height: 36px;
    padding: 0 0.6875rem;
    border-radius: var(--radius-field, 0.5rem);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-base-content);
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 120ms ease;
  }
  .nav-link:hover,
  .nav-link:focus-visible {
    background: var(--color-base-200);
  }
  .nav-link-icon {
    color: var(--color-secondary);
  }
  .nav-link.is-active {
    background: var(--color-base-200);
    color: var(--color-primary);
  }

  .omnisearch-trigger {
    /* No `display` here on purpose. Scoped component CSS and a Tailwind utility
       are both single-class selectors, and the scoped block is injected last, so
       `display: flex` here would beat `hidden` and leak the desktop search field
       onto mobile. Display is owned by the `hidden lg:flex` on the element. */
    align-items: center;
    gap: 0.5rem;
    width: 250px;
    height: 38px;
    padding: 0 0.875rem;
    border: 1px solid var(--color-base-300);
    border-radius: var(--radius-field, 0.5rem);
    font-size: 14px;
    color: color-mix(in srgb, var(--color-base-content) 60%, transparent);
    cursor: text;
    transition: border-color 120ms ease;
  }
  .omnisearch-trigger:hover,
  .omnisearch-trigger:focus-visible {
    border-color: var(--color-primary);
  }

  .avatar-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 9999px;
    background: var(--color-primary);
    color: var(--color-primary-content);
    font-weight: 700;
    font-size: 14px;
    overflow: hidden;
    cursor: pointer;
  }
  .avatar-button--sm {
    width: 36px;
    height: 36px;
  }

  .drawer-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 44px;
    padding: 0 0.875rem;
    border-radius: var(--radius-field, 0.5rem);
    font-size: 14.5px;
    font-weight: 600;
    color: color-mix(in srgb, var(--color-base-content) 78%, transparent);
    text-decoration: none;
  }
  .drawer-link.is-primary {
    min-height: 46px;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-base-content);
  }
  .drawer-link:hover,
  .drawer-link.is-active {
    background: var(--color-base-200);
  }
  .drawer-link.is-active {
    color: var(--color-primary);
  }

  /* 250ms slide + 200ms backdrop fade. No bounce or overshoot anywhere. */
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
    transform: translateX(-100%);
  }
</style>

<i18n lang="json">
{
  "en": {
    "logo_alt": "Classic Mini DIY Logo",
    "primary_nav": "Primary",
    "search_placeholder": "Search everything…",
    "view_profile": "View profile",
    "navigation": {
      "toolbox": "Toolbox",
      "archive": "Archive",
      "exchange": "Exchange",
      "chat": "Chat",
      "more": "More",
      "models": "Models",
      "maps": "Maps",
      "store": "Store",
      "news": "News",
      "about": "About"
    },
    "profile": {
      "sign_in": "Sign In",
      "sign_out": "Sign Out",
      "admin": "Admin",
      "submissions": "My Submissions",
      "profile": "Profile",
      "membership": "Membership",
      "dashboard": "Dashboard"
    },
    "language_label": "Language",
    "mobile_menu_title": "Menu",
    "close_menu": "Close menu"
  },
  "es": {
    "logo_alt": "Logo de Classic Mini DIY",
    "primary_nav": "Principal",
    "search_placeholder": "Buscar en todo…",
    "view_profile": "Ver perfil",
    "navigation": {
      "toolbox": "Herramientas",
      "archive": "Archivo",
      "exchange": "Mercado",
      "chat": "Chat",
      "more": "Más",
      "models": "Modelos",
      "maps": "Mapas",
      "store": "Tienda",
      "news": "Noticias",
      "about": "Acerca de"
    },
    "profile": {
      "sign_in": "Iniciar sesión",
      "sign_out": "Cerrar sesión",
      "admin": "Admin",
      "submissions": "Mis envíos",
      "profile": "Perfil",
      "membership": "Membresía",
      "dashboard": "Panel"
    },
    "language_label": "Idioma",
    "mobile_menu_title": "Menú",
    "close_menu": "Cerrar menú"
  },
  "fr": {
    "logo_alt": "Logo Classic Mini DIY",
    "primary_nav": "Principal",
    "search_placeholder": "Tout rechercher…",
    "view_profile": "Voir le profil",
    "navigation": {
      "toolbox": "Outils",
      "archive": "Archive",
      "exchange": "Marché",
      "chat": "Chat",
      "more": "Plus",
      "models": "Modèles",
      "maps": "Cartes",
      "store": "Boutique",
      "news": "Actualités",
      "about": "À propos"
    },
    "profile": {
      "sign_in": "Se connecter",
      "sign_out": "Se déconnecter",
      "admin": "Admin",
      "submissions": "Mes soumissions",
      "profile": "Profil",
      "membership": "Adhésion",
      "dashboard": "Tableau de bord"
    },
    "language_label": "Langue",
    "mobile_menu_title": "Menu",
    "close_menu": "Fermer le menu"
  },
  "de": {
    "logo_alt": "Classic Mini DIY Logo",
    "primary_nav": "Hauptnavigation",
    "search_placeholder": "Alles durchsuchen…",
    "view_profile": "Profil ansehen",
    "navigation": {
      "toolbox": "Werkzeuge",
      "archive": "Archiv",
      "exchange": "Marktplatz",
      "chat": "Chat",
      "more": "Mehr",
      "models": "Modelle",
      "maps": "Karten",
      "store": "Shop",
      "news": "News",
      "about": "Über uns"
    },
    "profile": {
      "sign_in": "Anmelden",
      "sign_out": "Abmelden",
      "admin": "Admin",
      "submissions": "Meine Einreichungen",
      "profile": "Profil",
      "membership": "Mitgliedschaft",
      "dashboard": "Dashboard"
    },
    "language_label": "Sprache",
    "mobile_menu_title": "Menü",
    "close_menu": "Menü schließen"
  },
  "it": {
    "logo_alt": "Logo Classic Mini DIY",
    "primary_nav": "Principale",
    "search_placeholder": "Cerca ovunque…",
    "view_profile": "Vedi profilo",
    "navigation": {
      "toolbox": "Strumenti",
      "archive": "Archivio",
      "exchange": "Mercato",
      "chat": "Chat",
      "more": "Altro",
      "models": "Modelli",
      "maps": "Mappe",
      "store": "Negozio",
      "news": "Notizie",
      "about": "Chi siamo"
    },
    "profile": {
      "sign_in": "Accedi",
      "sign_out": "Esci",
      "admin": "Admin",
      "submissions": "I miei invii",
      "profile": "Profilo",
      "membership": "Abbonamento",
      "dashboard": "Dashboard"
    },
    "language_label": "Lingua",
    "mobile_menu_title": "Menu",
    "close_menu": "Chiudi menu"
  },
  "pt": {
    "logo_alt": "Logo Classic Mini DIY",
    "primary_nav": "Principal",
    "search_placeholder": "Pesquisar tudo…",
    "view_profile": "Ver perfil",
    "navigation": {
      "toolbox": "Ferramentas",
      "archive": "Arquivo",
      "exchange": "Mercado",
      "chat": "Chat",
      "more": "Mais",
      "models": "Modelos",
      "maps": "Mapas",
      "store": "Loja",
      "news": "Notícias",
      "about": "Sobre"
    },
    "profile": {
      "sign_in": "Entrar",
      "sign_out": "Sair",
      "admin": "Admin",
      "submissions": "Minhas submissões",
      "profile": "Perfil",
      "membership": "Assinatura",
      "dashboard": "Painel"
    },
    "language_label": "Idioma",
    "mobile_menu_title": "Menu",
    "close_menu": "Fechar menu"
  },
  "ru": {
    "logo_alt": "Логотип Classic Mini DIY",
    "primary_nav": "Основное",
    "search_placeholder": "Искать везде…",
    "view_profile": "Открыть профиль",
    "navigation": {
      "toolbox": "Инструменты",
      "archive": "Архив",
      "exchange": "Барахолка",
      "chat": "Чат",
      "more": "Ещё",
      "models": "Модели",
      "maps": "Карты",
      "store": "Магазин",
      "news": "Новости",
      "about": "О нас"
    },
    "profile": {
      "sign_in": "Войти",
      "sign_out": "Выйти",
      "admin": "Админ",
      "submissions": "Мои заявки",
      "profile": "Профиль",
      "membership": "Подписка",
      "dashboard": "Панель управления"
    },
    "language_label": "Язык",
    "mobile_menu_title": "Меню",
    "close_menu": "Закрыть меню"
  },
  "ja": {
    "logo_alt": "Classic Mini DIY ロゴ",
    "primary_nav": "メイン",
    "search_placeholder": "すべてを検索…",
    "view_profile": "プロフィールを見る",
    "navigation": {
      "toolbox": "ツールボックス",
      "archive": "アーカイブ",
      "exchange": "マーケット",
      "chat": "チャット",
      "more": "その他",
      "models": "モデル",
      "maps": "マップ",
      "store": "ストア",
      "news": "ニュース",
      "about": "概要"
    },
    "profile": {
      "sign_in": "ログイン",
      "sign_out": "ログアウト",
      "admin": "管理",
      "submissions": "投稿一覧",
      "profile": "プロフィール",
      "membership": "メンバーシップ",
      "dashboard": "ダッシュボード"
    },
    "language_label": "言語",
    "mobile_menu_title": "メニュー",
    "close_menu": "メニューを閉じる"
  },
  "zh": {
    "logo_alt": "Classic Mini DIY 徽标",
    "primary_nav": "主导航",
    "search_placeholder": "搜索全部…",
    "view_profile": "查看个人资料",
    "navigation": {
      "toolbox": "工具箱",
      "archive": "档案",
      "exchange": "交易市场",
      "chat": "聊天",
      "more": "更多",
      "models": "模型",
      "maps": "地图",
      "store": "商店",
      "news": "新闻",
      "about": "关于"
    },
    "profile": {
      "sign_in": "登录",
      "sign_out": "退出",
      "admin": "管理",
      "submissions": "我的提交",
      "profile": "个人资料",
      "membership": "会员",
      "dashboard": "仪表板"
    },
    "language_label": "语言",
    "mobile_menu_title": "菜单",
    "close_menu": "关闭菜单"
  },
  "ko": {
    "logo_alt": "Classic Mini DIY 로고",
    "primary_nav": "기본",
    "search_placeholder": "전체 검색…",
    "view_profile": "프로필 보기",
    "navigation": {
      "toolbox": "도구상자",
      "archive": "아카이브",
      "exchange": "마켓",
      "chat": "채팅",
      "more": "더보기",
      "models": "모델",
      "maps": "맵",
      "store": "스토어",
      "news": "뉴스",
      "about": "소개"
    },
    "profile": {
      "sign_in": "로그인",
      "sign_out": "로그아웃",
      "admin": "관리",
      "submissions": "내 제출",
      "profile": "프로필",
      "membership": "멤버십",
      "dashboard": "대시보드"
    },
    "language_label": "언어",
    "mobile_menu_title": "메뉴",
    "close_menu": "메뉴 닫기"
  }
}
</i18n>
