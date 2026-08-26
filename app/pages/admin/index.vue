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

  const supabase = useSupabase();
  const { getStats, getMessageQueueCount } = useAdmin();
  const exchangeEnabled = useRuntimeConfig().public.exchangeEnabled;

  const loading = ref(true);

  const attention = reactive({
    submissions: 0,
    listings: 0,
    finds: 0,
    wanted: 0,
    messages: 0,
    models: 0,
    reports: 0,
  });

  const stats = reactive({
    totalUsers: 0,
    newUsers: 0,
    activeListings: 0,
    members: 0,
  });

  const marketplaceModeration = computed(() => attention.listings + attention.finds + attention.wanted);
  const totalAttention = computed(
    () =>
      attention.submissions + marketplaceModeration.value + attention.messages + attention.models + attention.reports
  );

  /**
   * Every count is loaded independently and swallows its own failure. One
   * unavailable table must degrade a single tile to zero, not blank the board —
   * this page is the first thing loaded after signing in.
   */
  const loadCounts = async () => {
    const settle = (p: Promise<unknown>) => p.catch(() => undefined);

    await Promise.all([
      settle(
        $adminFetch<{ count: number }>('/api/admin/queue/count').then((r) => {
          attention.submissions = r?.count || 0;
        })
      ),
      settle(
        getStats().then((s: any) => {
          stats.totalUsers = s.totalUsers || 0;
          stats.newUsers = s.newUsers || 0;
          stats.activeListings = s.activeListings || 0;
        })
      ),
      settle(
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .then(({ count }) => {
            stats.members = count || 0;
          })
      ),
      settle(
        supabase
          .from('models')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(({ count }) => {
            attention.models = count || 0;
          })
      ),
      settle(
        supabase
          .from('model_reports')
          .select('id', { count: 'exact', head: true })
          // Matches the Reports tab on /admin/models — a report being looked at
          // is still a report waiting on you.
          .in('status', ['open', 'reviewing'])
          .then(({ count }) => {
            attention.reports = count || 0;
          })
      ),
      ...(exchangeEnabled
        ? [
            settle(
              supabase
                .from('listings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .then(({ count }) => {
                  attention.listings = count || 0;
                })
            ),
            settle(
              supabase
                .from('external_listings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .then(({ count }) => {
                  attention.finds = count || 0;
                })
            ),
            settle(
              supabase
                .from('wanted_posts')
                .select('id', { count: 'exact', head: true })
                .in('moderation_status', ['pending', 'flagged'])
                .then(({ count }) => {
                  attention.wanted = count || 0;
                })
            ),
            settle(
              getMessageQueueCount().then((n: number) => {
                attention.messages = n || 0;
              })
            ),
          ]
        : []),
    ]);

    loading.value = false;
  };

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
        count: attention.submissions,
      },
    ];

    if (exchangeEnabled) {
      tiles.push({
        key: 'moderation',
        label: 'Marketplace moderation',
        hint: `${attention.listings} listings · ${attention.finds} finds · ${attention.wanted} wanted`,
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
        count: attention.messages,
      });
    }

    tiles.push({
      key: 'models',
      label: '3D model queue',
      hint: `${attention.reports} open report${attention.reports === 1 ? '' : 's'}`,
      icon: 'fas fa-cube',
      to: '/admin/models',
      count: attention.models + attention.reports,
    });

    return tiles;
  });

  onMounted(loadCounts);
</script>

<template>
  <AdminShell title="Dashboard" subtitle="What needs review right now across the site">
    <template #actions>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="loading" @click="loadCounts">
        <i class="fas fa-arrows-rotate" :class="{ 'animate-spin': loading }"></i>
        Refresh
      </button>
    </template>

    <!-- All-clear banner. A queue board that says nothing when empty makes you
         hunt for the emptiness; say it outright. -->
    <div
      v-if="!loading && totalAttention === 0"
      class="alert alert-success mb-6 border border-success/30 bg-success/10"
    >
      <i class="fas fa-circle-check"></i>
      <span>All caught up — nothing is waiting for review.</span>
    </div>

    <!-- Queues -->
    <div v-if="loading" class="mb-8 grid gap-4 sm:grid-cols-2">
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
    <div v-if="loading" class="grid grid-cols-2 gap-4 md:grid-cols-4">
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
        <div class="stat-value text-2xl text-warning">{{ stats.members }}</div>
        <div class="stat-desc text-xs">Active subscriptions</div>
      </div>
    </div>
  </AdminShell>
</template>
