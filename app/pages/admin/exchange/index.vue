<template>
  <div>
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">Dashboard Overview</h1>
      <p class="text-base-content/70">Platform statistics and metrics</p>
    </div>

    <!-- Moderation Queue Card -->
    <div v-if="loading" class="skeleton h-20 w-full rounded-lg mb-6"></div>
    <NuxtLink
      v-if="!loading"
      to="/admin/exchange/moderation"
      class="card shadow-sm mb-6 transition-colors"
      :class="
        totalModeration > 0
          ? 'bg-warning/10 border border-warning/30 hover:bg-warning/20'
          : 'bg-success/10 border border-success/30 hover:bg-success/15'
      "
    >
      <div class="card-body py-4 flex-row items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-full" :class="totalModeration > 0 ? 'bg-warning/20' : 'bg-success/20'">
            <i
              class="fas fa-shield-halved text-2xl"
              :class="totalModeration > 0 ? 'text-warning' : 'text-success'"
            ></i>
          </div>
          <div>
            <div class="text-lg font-bold">
              <template v-if="totalModeration > 0">
                {{ totalModeration }} item{{ totalModeration !== 1 ? 's' : '' }} need{{
                  totalModeration === 1 ? 's' : ''
                }}
                review
              </template>
              <template v-else>All caught up</template>
            </div>
            <div v-if="totalModeration > 0" class="flex flex-wrap gap-2 mt-1">
              <NuxtLink
                v-if="moderationCounts.listings > 0"
                to="/admin/exchange/moderation?tab=listings"
                class="badge badge-warning badge-sm gap-1"
                @click.stop
              >
                {{ moderationCounts.listings }} Listing{{ moderationCounts.listings !== 1 ? 's' : '' }}
              </NuxtLink>
              <NuxtLink
                v-if="moderationCounts.finds > 0"
                to="/admin/exchange/moderation?tab=finds"
                class="badge badge-warning badge-sm gap-1"
                @click.stop
              >
                {{ moderationCounts.finds }} Find{{ moderationCounts.finds !== 1 ? 's' : '' }}
              </NuxtLink>
              <NuxtLink
                v-if="moderationCounts.wanted > 0"
                to="/admin/exchange/moderation?tab=wanted"
                class="badge badge-warning badge-sm gap-1"
                @click.stop
              >
                {{ moderationCounts.wanted }} Wanted
              </NuxtLink>
            </div>
            <p v-else class="text-sm text-success/70">No items pending moderation</p>
          </div>
        </div>
        <i class="fas fa-chevron-right text-base-content/50"></i>
      </div>
    </NuxtLink>

    <!-- Loading State -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="skeleton h-28 w-full rounded-lg"></div>
    </div>

    <!-- Stats Grid -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <!-- Total Users -->
      <div class="stat bg-base-100 shadow-sm rounded-lg p-4">
        <div class="stat-figure text-primary">
          <i class="fas fa-users text-2xl"></i>
        </div>
        <div class="stat-title text-xs">Total Users</div>
        <div class="stat-value text-primary text-2xl">{{ stats.totalUsers }}</div>
        <div class="stat-desc text-xs">Registered accounts</div>
      </div>

      <!-- New Users (7d) -->
      <div class="stat bg-base-100 shadow-sm rounded-lg p-4">
        <div class="stat-figure text-success">
          <i class="fas fa-user-plus text-2xl"></i>
        </div>
        <div class="stat-title text-xs">New Users</div>
        <div class="stat-value text-success text-2xl">{{ stats.newUsers }}</div>
        <div class="stat-desc text-xs">Last 7 days</div>
      </div>

      <!-- Total Listings -->
      <div class="stat bg-base-100 shadow-sm rounded-lg p-4">
        <div class="stat-figure text-secondary">
          <i class="fas fa-layer-group text-2xl"></i>
        </div>
        <div class="stat-title text-xs">Total Listings</div>
        <div class="stat-value text-secondary text-2xl">{{ stats.totalListings }}</div>
        <div class="stat-desc text-xs">All time</div>
      </div>

      <!-- Active Listings -->
      <div class="stat bg-base-100 shadow-sm rounded-lg p-4">
        <div class="stat-figure text-success">
          <i class="fas fa-circle-check text-2xl"></i>
        </div>
        <div class="stat-title text-xs">Active</div>
        <div class="stat-value text-success text-2xl">{{ stats.activeListings }}</div>
        <div class="stat-desc text-xs">Currently live</div>
      </div>

      <!-- Sold Listings -->
      <div class="stat bg-base-100 shadow-sm rounded-lg p-4">
        <div class="stat-figure text-info">
          <i class="fas fa-dollar-sign text-2xl"></i>
        </div>
        <div class="stat-title text-xs">Sold</div>
        <div class="stat-value text-info text-2xl">{{ stats.soldListings }}</div>
        <div class="stat-desc text-xs">Successfully sold</div>
      </div>

      <!-- Total Watchlists -->
      <div class="stat bg-base-100 shadow-sm rounded-lg p-4">
        <div class="stat-figure text-accent">
          <i class="fas fa-heart text-2xl"></i>
        </div>
        <div class="stat-title text-xs">Watchlists</div>
        <div class="stat-value text-accent text-2xl">{{ stats.totalWatchlists }}</div>
        <div class="stat-desc text-xs">Total saves</div>
      </div>
    </div>

    <!-- Charts Section -->
    <div v-if="!loading" class="grid lg:grid-cols-2 gap-6 mt-8">
      <!-- New Listings per day -->
      <ClientOnly>
        <ExchangeAdminLineChart
          title="New Listings (30 days)"
          :labels="chartLabels"
          :datasets="[
            {
              label: 'Listings',
              data: listingsChartData,
              borderColor: 'oklch(0.65 0.19 250)',
              backgroundColor: 'oklch(0.65 0.19 250 / 0.1)',
            },
          ]"
        />
        <template #fallback>
          <div class="skeleton h-80 w-full rounded-lg"></div>
        </template>
      </ClientOnly>

      <!-- New Users per day -->
      <ClientOnly>
        <ExchangeAdminLineChart
          title="New Users (30 days)"
          :labels="chartLabels"
          :datasets="[
            {
              label: 'Users',
              data: usersChartData,
              borderColor: 'oklch(0.65 0.19 160)',
              backgroundColor: 'oklch(0.65 0.19 160 / 0.1)',
            },
          ]"
        />
        <template #fallback>
          <div class="skeleton h-80 w-full rounded-lg"></div>
        </template>
      </ClientOnly>

      <!-- Listings by Status -->
      <ClientOnly>
        <ExchangeAdminDoughnutChart
          v-if="statusLabels.length > 0"
          title="Listings by Status"
          :labels="statusLabels"
          :data="statusData"
          :colors="statusColors"
        />
        <div v-else class="card bg-base-100 shadow-sm">
          <div class="card-body items-center justify-center h-80">
            <p class="text-base-content/50">No listing data for status chart</p>
          </div>
        </div>
        <template #fallback>
          <div class="skeleton h-80 w-full rounded-lg"></div>
        </template>
      </ClientOnly>

      <!-- Quick Actions -->
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="card-title text-base">Quick Actions</h3>

          <div class="divider my-1"></div>

          <!-- Example Listings Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">Example Listings</p>
              <p class="text-xs text-base-content/60">Show or hide example listings across the site</p>
            </div>
            <label class="label cursor-pointer gap-2">
              <span class="text-xs text-base-content/60">{{ examplesVisible ? 'Visible' : 'Hidden' }}</span>
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                :checked="examplesVisible"
                :disabled="togglingExamples"
                @change="toggleExamples"
              />
            </label>
          </div>

          <div class="divider my-1"></div>

          <!-- Storage Cleanup -->
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">Storage Cleanup</p>
              <p class="text-xs text-base-content/60">Remove orphaned image files from storage</p>
              <div v-if="cleanupResult" class="text-xs mt-1">
                <span class="text-success">Deleted {{ cleanupResult.deletedCount }}</span>
                <span class="text-base-content/60"> / {{ cleanupResult.totalFilesChecked }} checked</span>
              </div>
            </div>
            <button class="btn btn-outline btn-error btn-sm" :disabled="cleaningUp" @click="runStorageCleanup">
              <i v-if="cleaningUp" class="fas fa-arrows-rotate animate-spin"></i>
              <i v-else class="fas fa-trash"></i>
              {{ cleaningUp ? 'Cleaning...' : 'Cleanup' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Admin Dashboard - The Mini Exchange',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const { getStats, getTrendData, cleanupOrphanedStorage } = useAdmin();
  const { showExamples, loadVisibility, setExampleVisibility } = useExampleListings();
  const supabase = useSupabase();
  const toast = useToast();

  const loading = ref(true);
  const cleaningUp = ref(false);
  const togglingExamples = ref(false);
  const examplesVisible = ref(true);
  const cleanupResult = ref<{
    totalFilesChecked: number;
    orphanedFilesFound: number;
    deletedCount: number;
    failedCount: number;
  } | null>(null);

  const moderationCounts = ref({
    listings: 0,
    finds: 0,
    wanted: 0,
  });
  const totalModeration = computed(
    () => moderationCounts.value.listings + moderationCounts.value.finds + moderationCounts.value.wanted
  );

  const stats = ref({
    totalUsers: 0,
    newUsers: 0,
    totalListings: 0,
    activeListings: 0,
    pendingListings: 0,
    draftListings: 0,
    soldListings: 0,
    recentListings: 0,
    totalWatchlists: 0,
  });

  // Chart data
  const chartLabels = ref<string[]>([]);
  const listingsChartData = ref<number[]>([]);
  const usersChartData = ref<number[]>([]);
  const statusLabels = ref<string[]>([]);
  const statusData = ref<number[]>([]);
  const statusColors = ref<string[]>([]);

  /**
   * Build an array of date labels for the last 30 days and map count data to it.
   */
  const buildDayLabels = () => {
    const labels: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().slice(0, 10));
    }
    return labels;
  };

  const loadStats = async () => {
    try {
      const [statsData, trendData] = await Promise.all([getStats(), getTrendData()]);

      stats.value = statsData;

      // Build chart data
      const labels = buildDayLabels();
      chartLabels.value = labels.map((d) => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      listingsChartData.value = labels.map((d) => trendData.listingsByDay[d] || 0);
      usersChartData.value = labels.map((d) => trendData.usersByDay[d] || 0);

      // Status chart - ordered for visual clarity
      const statusConfig: Record<string, { label: string; color: string }> = {
        active_paid: { label: 'Active (Paid)', color: 'oklch(0.55 0.19 145)' },
        active_free: { label: 'Active (Free)', color: 'oklch(0.7 0.17 155)' },
        pending: { label: 'Pending', color: 'oklch(0.75 0.18 80)' },
        draft: { label: 'Draft', color: 'oklch(0.7 0.1 250)' },
        sold: { label: 'Sold', color: 'oklch(0.65 0.19 250)' },
        expired: { label: 'Expired', color: 'oklch(0.6 0.15 30)' },
        cancelled: { label: 'Cancelled', color: 'oklch(0.65 0.24 15)' },
      };
      const orderedKeys = ['active_paid', 'active_free', 'pending', 'draft', 'sold', 'expired', 'cancelled'];
      const entries = orderedKeys
        .filter((key) => (trendData.statusCounts[key] || 0) > 0)
        .map((key) => ({ key, count: trendData.statusCounts[key], ...statusConfig[key] }));
      statusLabels.value = entries.map((e) => e.label);
      statusData.value = entries.map((e) => e.count);
      statusColors.value = entries.map((e) => e.color);

      // Fetch moderation counts and watchlist total
      const [pendingListingsResult, pendingFindsResult, pendingWantedResult, watchlistResult] = await Promise.all([
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('external_listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('wanted_posts')
          .select('id', { count: 'exact', head: true })
          .in('moderation_status', ['pending', 'flagged']),
        supabase.from('watchlist').select('id', { count: 'exact', head: true }),
      ]);

      moderationCounts.value = {
        listings: pendingListingsResult.count || 0,
        finds: pendingFindsResult.count || 0,
        wanted: pendingWantedResult.count || 0,
      };
      stats.value.totalWatchlists = watchlistResult.count || 0;
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to load statistics',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  const toggleExamples = async () => {
    togglingExamples.value = true;
    const newValue = !examplesVisible.value;

    try {
      await setExampleVisibility(newValue);
      examplesVisible.value = newValue;

      toast.add({
        title: newValue ? 'Examples Visible' : 'Examples Hidden',
        description: newValue
          ? 'Example listings are now shown across the site.'
          : 'Example listings are now hidden from the site.',
        color: 'success',
      });
    } catch (error: any) {
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to update example listing visibility',
        color: 'error',
      });
    } finally {
      togglingExamples.value = false;
    }
  };

  const runStorageCleanup = async () => {
    cleaningUp.value = true;
    cleanupResult.value = null;

    try {
      const result = await cleanupOrphanedStorage();
      cleanupResult.value = result as any;

      toast.add({
        title: 'Cleanup Complete',
        description: `Deleted ${result.deletedCount} orphaned files out of ${result.orphanedFilesFound} found`,
        color: 'success',
      });
    } catch (error: any) {
      console.error('Error during cleanup:', error);
      toast.add({
        title: 'Cleanup Failed',
        description: error.message || 'Failed to clean up storage',
        color: 'error',
      });
    } finally {
      cleaningUp.value = false;
    }
  };

  onMounted(async () => {
    await loadVisibility();
    examplesVisible.value = showExamples.value;
    loadStats();
  });
</script>
