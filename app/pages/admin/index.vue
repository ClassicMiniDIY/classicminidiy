<script setup lang="ts">
  /**
   * Admin home — a triage board, not a launcher.
   *
   * The card grid this replaced was pure navigation: seven links that told you
   * nothing until you clicked one. Navigation now lives in <AdminShell>'s
   * sidebar, on every admin page, so this page's job is the thing the sidebar
   * cannot do — say what is waiting and how big it is.
   *
   * Marketplace analytics deliberately stay on /admin/exchange. Duplicating the
   * charts here is how the two pages drifted apart in the first place.
   */
  useHead({
    title: 'Admin Dashboard - Classic Mini DIY',
    meta: [
      { name: 'description', content: 'Admin dashboard for Classic Mini DIY.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  });

  const { getStats } = useAdmin();
  const exchangeEnabled = useRuntimeConfig().public.exchangeEnabled;

  // Shared with <AdminShell>'s sidebar badges — one TTL-cached load feeds both,
  // rather than each surface querying the same six things on first paint.
  const { counts: attention, moderation: marketplaceModeration, loading, ready, refresh } = useAdminCounts();

  const stats = reactive({
    totalUsers: 0,
    newUsers: 0,
    activeListings: 0,
  });

  const totalAttention = computed(
    () =>
      attention.value.submissions +
      marketplaceModeration.value +
      attention.value.messages +
      attention.value.models +
      attention.value.reports
  );

  /** Site totals, separate from the queue counts because they are this page's
   *  alone. Failure is swallowed for the same reason: one unavailable table
   *  must degrade a tile, not blank the first screen after signing in. */
  const loadStats = async () => {
    try {
      const s: any = await getStats();
      stats.totalUsers = s.totalUsers || 0;
      stats.newUsers = s.newUsers || 0;
      stats.activeListings = s.activeListings || 0;
    } catch {
      /* non-critical */
    }
  };

  const reload = () => Promise.all([refresh(), loadStats()]);

  /** Skeleton while the first load is still outstanding as well as during a
   *  refresh — `loading` alone is false before the first load starts. */
  const pending = computed(() => loading.value || !ready.value);

  interface QueueTile {
    key: string;
    label: string;
    hint: string;
    icon: string;
    to: string;
    count: number;
  }

  const queues = computed<QueueTile[]>(() => {
    const tiles: QueueTile[] = [
      {
        key: 'submissions',
        label: 'Archive submissions',
        hint: 'Documents, registry, colours, wheels, fixes',
        icon: 'fas fa-inbox',
        to: '/admin/queue',
        count: attention.value.submissions,
      },
    ];

    if (exchangeEnabled) {
      tiles.push({
        key: 'moderation',
        label: 'Marketplace moderation',
        hint: `${attention.value.listings} listings · ${attention.value.finds} finds · ${attention.value.wanted} wanted`,
        icon: 'fas fa-shield-halved',
        to: '/admin/exchange/moderation',
        count: marketplaceModeration.value,
      });
      tiles.push({
        key: 'messages',
        label: 'Reported messages',
        hint: 'Flagged marketplace conversations',
        icon: 'fas fa-comments',
        to: '/admin/exchange/messages',
        count: attention.value.messages,
      });
    }

    tiles.push({
      key: 'models',
      label: '3D model queue',
      hint: `${attention.value.reports} open report${attention.value.reports === 1 ? '' : 's'}`,
      icon: 'fas fa-cube',
      to: '/admin/models',
      count: attention.value.models + attention.value.reports,
    });

    return tiles;
  });

  onMounted(reload);
</script>

<template>
  <AdminShell title="Dashboard" subtitle="What needs review right now across the site">
    <template #actions>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="pending" @click="reload">
        <i class="fas fa-arrows-rotate" :class="{ 'animate-spin': pending }"></i>
        Refresh
      </button>
    </template>

    <!-- All-clear banner. A queue board that says nothing when empty makes you
         hunt for the emptiness; say it outright. -->
    <div
      v-if="!pending && totalAttention === 0"
      class="alert alert-success mb-6 border border-success/30 bg-success/10"
    >
      <i class="fas fa-circle-check"></i>
      <span>All caught up — nothing is waiting for review.</span>
    </div>

    <!-- Queues -->
    <div v-if="pending" class="mb-8 grid gap-4 sm:grid-cols-2">
      <div v-for="i in 4" :key="i" class="skeleton h-24 w-full rounded-box"></div>
    </div>
    <div v-else class="mb-8 grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="queue in queues"
        :key="queue.key"
        :to="queue.to"
        class="card border shadow-sm transition-colors"
        :class="
          queue.count > 0
            ? 'border-warning/30 bg-warning/10 hover:bg-warning/20'
            : 'border-base-300 bg-base-100 hover:bg-base-200'
        "
      >
        <div class="card-body flex-row items-center justify-between gap-4 py-4">
          <div class="flex min-w-0 items-center gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              :class="queue.count > 0 ? 'bg-warning/20 text-warning' : 'bg-base-200 text-base-content/50'"
            >
              <i :class="[queue.icon, 'text-xl']" aria-hidden="true"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 font-bold">
                {{ queue.label }}
                <span v-if="queue.count > 0" class="badge badge-warning badge-sm">{{ queue.count }}</span>
              </div>
              <p class="truncate text-sm text-base-content/60">{{ queue.hint }}</p>
            </div>
          </div>
          <i class="fas fa-chevron-right text-base-content/40" aria-hidden="true"></i>
        </div>
      </NuxtLink>
    </div>

    <!-- Site totals. Deliberately four numbers, not a dashboard — the
         marketplace charts live on /admin/exchange. -->
    <h2 class="mb-3 text-sm font-bold uppercase tracking-wider text-base-content/60">Site at a glance</h2>
    <div v-if="pending" class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div v-for="i in 4" :key="i" class="skeleton h-24 w-full rounded-box"></div>
    </div>
    <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div class="stat rounded-box bg-base-100 p-4 shadow-sm">
        <div class="stat-figure text-primary"><i class="fas fa-users text-2xl"></i></div>
        <div class="stat-title text-xs">Total users</div>
        <div class="stat-value text-2xl text-primary">{{ stats.totalUsers }}</div>
        <div class="stat-desc text-xs">Registered accounts</div>
      </div>
      <div class="stat rounded-box bg-base-100 p-4 shadow-sm">
        <div class="stat-figure text-success"><i class="fas fa-user-plus text-2xl"></i></div>
        <div class="stat-title text-xs">New users</div>
        <div class="stat-value text-2xl text-success">{{ stats.newUsers }}</div>
        <div class="stat-desc text-xs">Last 7 days</div>
      </div>
      <div v-if="exchangeEnabled" class="stat rounded-box bg-base-100 p-4 shadow-sm">
        <div class="stat-figure text-secondary"><i class="fas fa-tag text-2xl"></i></div>
        <div class="stat-title text-xs">Active listings</div>
        <div class="stat-value text-2xl text-secondary">{{ stats.activeListings }}</div>
        <div class="stat-desc text-xs">Currently live</div>
      </div>
      <div class="stat rounded-box bg-base-100 p-4 shadow-sm">
        <div class="stat-figure text-warning"><i class="fas fa-heart text-2xl"></i></div>
        <div class="stat-title text-xs">Sustaining members</div>
        <div class="stat-value text-2xl text-warning">{{ attention.members }}</div>
        <div class="stat-desc text-xs">Active subscriptions</div>
      </div>
    </div>
  </AdminShell>
</template>
