<template>
  <!-- NOT `.container`. That helper caps at max-w-7xl (1280px), which is right
       for reading-width article pages and wrong for a dense internal tool: once
       the 16rem section rail and the gutters come out of 1280 the content column
       is ~928px, and the widest admin tables need ~1000-1100px. The result was
       that /admin/users, /admin/exchange/listings and .../wanted clipped their
       LAST column — the trust-level select, the row action menu — on a 1440px
       display, so the primary control on each row could only be reached by
       scrolling the table sideways.

       1400px, not wider: that is `MainNav`'s own `max-w-[1400px]`, and the admin
       body has to line up with the site header above it. At `max-w-[1600px]` the
       ADMIN strip and breadcrumb started 100px LEFT of the site logo on a 1920px
       display — the same misalignment this file's hero notes warn about. 1400
       still leaves 1048px for the table, comfortably over the ~975px it needs. -->
  <div class="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
    <!-- Breadcrumb -->
    <div class="mb-4">
      <Breadcrumb :page="breadcrumb || title" :version="BREADCRUMB_VERSIONS.ADMIN" :root="isRoot" />
    </div>

    <!-- Identity strip. Admin is a privileged surface of the same site, so it
         says so explicitly rather than looking like any other page. -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-4">
      <span
        class="rounded bg-neutral px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-content"
      >
        Admin
      </span>
      <div class="flex items-center gap-4">
        <span class="text-sm opacity-70">{{ userProfile?.display_name || userProfile?.email }}</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="handleLogout">
          <i class="fas fa-arrow-right-from-bracket mr-2"></i>
          Sign out
        </button>
      </div>
    </div>

    <div class="flex flex-col lg:flex-row gap-6 lg:gap-8">
      <!-- Section nav.
           Pages here render without a layout (app.vue has no NuxtLayout), so the
           shell owns the container bounds AND the nav that every /admin page
           wraps itself in. Admin is English-only — see the i18n notes in
           CLAUDE.md.

           Below `lg` the same ~20 entries stacked would push the page content
           clean off the first screen, so the nav collapses to one dropdown
           labelled with wherever you currently are. -->
      <div class="lg:hidden">
        <div class="dropdown w-full">
          <button tabindex="0" class="btn btn-outline w-full justify-between">
            <span class="flex items-center gap-2">
              <i :class="[currentEntry?.icon || 'fas fa-gauge-high', 'w-4']" aria-hidden="true"></i>
              {{ currentEntry?.label || 'Admin' }}
            </span>
            <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
          <ul
            tabindex="0"
            class="dropdown-content menu z-10 mt-1 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
          >
            <template v-for="group in visibleGroups" :key="`m-${group.label}`">
              <li class="menu-title text-xs uppercase tracking-wider">{{ group.label }}</li>
              <li v-for="entry in group.entries" :key="`m-${entry.to}`">
                <NuxtLink :to="entry.to" :exact-active-class="entry.exact ? 'active' : undefined">
                  <i :class="[entry.icon, 'w-4']" aria-hidden="true"></i>
                  {{ entry.label }}
                  <span v-if="badgeFor(entry)" class="badge badge-sm" :class="entry.badgeClass">
                    {{ badgeFor(entry) }}
                  </span>
                </NuxtLink>
              </li>
            </template>
          </ul>
        </div>
      </div>

      <aside class="hidden lg:block lg:w-64 lg:flex-shrink-0">
        <nav aria-label="Admin sections">
          <ul class="menu w-full rounded-box border border-base-300 bg-base-100 shadow-sm lg:sticky lg:top-24">
            <template v-for="group in visibleGroups" :key="group.label">
              <li class="menu-title text-xs uppercase tracking-wider">{{ group.label }}</li>
              <li v-for="entry in group.entries" :key="entry.to">
                <NuxtLink
                  :to="entry.to"
                  :active-class="entry.exact ? undefined : 'active'"
                  :exact-active-class="entry.exact ? 'active' : undefined"
                >
                  <i :class="[entry.icon, 'w-4']" aria-hidden="true"></i>
                  {{ entry.label }}
                  <span v-if="badgeFor(entry)" class="badge badge-sm" :class="entry.badgeClass">
                    {{ badgeFor(entry) }}
                  </span>
                </NuxtLink>
              </li>
            </template>
          </ul>
        </nav>
      </aside>

      <!-- Page content -->
      <div class="min-w-0 flex-1">
        <div v-if="title" class="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="mb-1 text-3xl font-bold">{{ title }}</h1>
            <p v-if="subtitle" class="text-base-content/70">{{ subtitle }}</p>
          </div>
          <slot name="actions" />
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  interface NavEntry {
    label: string;
    to: string;
    icon: string;
    /** Highlight only on an exact path match — for section index routes whose
     *  path is a prefix of every sibling (`/admin`, `/admin/exchange`). */
    exact?: boolean;
    badge?: 'submissions' | 'moderation' | 'messages';
    badgeClass?: string;
    /** Rendered only when the marketing allowlist probe approves. */
    marketingOnly?: boolean;
  }

  defineProps<{
    /** Page heading. Omit to render your own header inside the slot. */
    title?: string;
    subtitle?: string;
    /** Breadcrumb leaf, when it should differ from `title`. */
    breadcrumb?: string;
  }>();

  const route = useRoute();
  const { userProfile, signOut } = useAuth();

  // Shared with the /admin dashboard so the two do not load the same counts
  // twice, and TTL-cached so moving between admin sections does not refire them.
  const { counts, moderation, load: loadCounts } = useAdminCounts();

  const exchangeEnabled = useRuntimeConfig().public.exchangeEnabled;

  const NAV_GROUPS: { label: string; entries: NavEntry[]; exchangeOnly?: boolean }[] = [
    {
      label: 'Overview',
      entries: [{ label: 'Dashboard', to: '/admin', icon: 'fas fa-gauge-high', exact: true }],
    },
    {
      label: 'Review',
      entries: [
        {
          label: 'Submissions',
          to: '/admin/queue',
          icon: 'fas fa-inbox',
          badge: 'submissions',
          badgeClass: 'badge-primary',
        },
        {
          label: 'Marketplace',
          to: '/admin/exchange/moderation',
          icon: 'fas fa-shield-halved',
          badge: 'moderation',
          badgeClass: 'badge-warning',
        },
        { label: '3D Models', to: '/admin/models', icon: 'fas fa-cube' },
        { label: 'Parts Sources', to: '/admin/parts', icon: 'fas fa-gears' },
      ],
    },
    {
      label: 'Marketplace',
      exchangeOnly: true,
      entries: [
        { label: 'Overview', to: '/admin/exchange', icon: 'fas fa-chart-column', exact: true },
        { label: 'Listings', to: '/admin/exchange/listings', icon: 'fas fa-tag' },
        {
          label: 'Messages',
          to: '/admin/exchange/messages',
          icon: 'fas fa-comments',
          badge: 'messages',
          badgeClass: 'badge-error',
        },
        { label: 'Finds', to: '/admin/exchange/finds', icon: 'fas fa-globe' },
        { label: 'Wanted Posts', to: '/admin/exchange/wanted', icon: 'fas fa-bullhorn' },
        { label: 'Social Posting', to: '/admin/exchange/promotions', icon: 'fas fa-share-nodes' },
        { label: 'Announcements', to: '/admin/exchange/announcements', icon: 'fas fa-tower-broadcast' },
        { label: 'Newsletter', to: '/admin/exchange/newsletter', icon: 'fas fa-newspaper' },
      ],
    },
    {
      label: 'Community',
      entries: [
        { label: 'Users', to: '/admin/users', icon: 'fas fa-users-gear' },
        { label: 'Membership', to: '/admin/membership', icon: 'fas fa-id-card' },
        { label: 'Developer API', to: '/admin/developer', icon: 'fas fa-code' },
        { label: 'Discord Roster', to: '/admin/discord', icon: 'fab fa-discord' },
      ],
    },
    {
      label: 'Email',
      entries: [
        {
          label: 'Marketing',
          to: '/admin/marketing',
          icon: 'fas fa-envelope-open-text',
          marketingOnly: true,
        },
        { label: 'Mail DNS', to: '/admin/email', icon: 'fas fa-envelope-circle-check' },
      ],
    },
  ];

  // Marketing Email is allowlist-gated (MARKETING_ADMIN_EMAILS, server-side) —
  // only render the entry for admins the access probe approves.
  const { allowed: marketingAllowed, check: checkMarketingAccess } = useMarketingAccess();

  const visibleGroups = computed(() =>
    NAV_GROUPS.map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => !entry.marketingOnly || marketingAllowed.value === true),
    })).filter((group) => group.entries.length > 0 && (!group.exchangeOnly || exchangeEnabled))
  );

  /** The deepest entry whose path matches the current route — used to label the
   *  mobile dropdown with wherever you actually are. */
  const currentEntry = computed(() => {
    const path = route.path;
    let best: NavEntry | undefined;
    for (const group of visibleGroups.value) {
      for (const entry of group.entries) {
        const matches = entry.exact ? path === entry.to : path === entry.to || path.startsWith(`${entry.to}/`);
        if (matches && (!best || entry.to.length > best.to.length)) best = entry;
      }
    }
    return best;
  });

  const badgeFor = (entry: NavEntry) => {
    if (!entry.badge) return 0;
    return entry.badge === 'moderation' ? moderation.value : counts.value[entry.badge];
  };

  const isRoot = computed(() => route.path === '/admin');

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    await navigateTo('/login');
  };

  onMounted(() => {
    loadCounts();
    checkMarketingAccess();
  });

  // Re-check the badges when moving between admin sections. Wrapped, not passed
  // by reference: the watcher hands its callback (newPath, oldPath), and
  // `load(force)` would read that truthy path as force=true and defeat the cache.
  watch(
    () => route.path,
    () => loadCounts()
  );
</script>
