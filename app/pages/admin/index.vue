<script setup lang="ts">
  import { HERO_TYPES } from '../../../data/models/generic';
  import type { RegistryItem } from '../../../data/models/registry';
  import { RegistryItemStatus } from '../../../data/models/registry';
  import type { IWheelsDataReviewItem } from '../../../data/models/wheels';
  import { WheelItemStatus } from '../../../data/models/wheels';
  import type { ColorQueueItem } from '../../../data/models/colors';
  import { ColorItemStatus } from '../../../data/models/colors';

  // SEO and meta
  useHead({
    title: 'Admin Dashboard - Classic Mini DIY',
    meta: [
      {
        name: 'description',
        content: 'Admin dashboard for managing Classic Mini DIY submissions and content.',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  // Get user info from Supabase auth
  const { userProfile, signOut } = useAuth();

  // Fetch stats data
  const { data: registryStats, refresh: refreshRegistryStats } =
    await useFetch<RegistryItem[]>('/api/registry/queue/list');
  const { data: wheelsStats, refresh: refreshWheelsStats } =
    await useFetch<IWheelsDataReviewItem[]>('/api/wheels/review/list');
  const { data: colorsStats, refresh: refreshColorsStats } = await useFetch<ColorQueueItem[]>('/api/colors/queue/list');

  // Refresh state
  const isRefreshing = ref(false);

  // Refresh function
  const refreshStats = async () => {
    isRefreshing.value = true;
    try {
      await Promise.all([refreshRegistryStats(), refreshWheelsStats(), refreshColorsStats()]);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    } finally {
      isRefreshing.value = false;
    }
  };

  // Helper functions to check if items are pending
  const isPending = (item: RegistryItem) => !item.status || item.status === RegistryItemStatus.PENDING;
  const isWheelPending = (item: IWheelsDataReviewItem) => !item.status || item.status === WheelItemStatus.PENDING;
  const isColorPending = (item: ColorQueueItem) => !item.status || item.status === ColorItemStatus.PENDING;

  // Computed stats
  const registryCount = computed(() => {
    if (!Array.isArray(registryStats.value)) return 0;
    return registryStats.value.filter(isPending).length;
  });

  const wheelsCount = computed(() => {
    if (!Array.isArray(wheelsStats.value)) return 0;
    return wheelsStats.value.filter(isWheelPending).length;
  });

  const colorsCount = computed(() => {
    if (!Array.isArray(colorsStats.value)) return 0;
    return colorsStats.value.filter(isColorPending).length;
  });

  const lastUpdated = computed(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  });

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    await navigateTo('/login');
  };

  // Helper function
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
</script>
<template>
  <div>
    <!-- Hero Section -->
    <Hero
      title="Admin Dashboard"
      subtitle="Manage submissions and content for Classic Mini DIY"
      :heroType="HERO_TYPES.TECH"
      textSize="text-4xl"
    />

    <!-- Breadcrumb Navigation -->
    <div class="container mx-auto px-4 pt-10">
      <div class="flex justify-between items-center">
        <UBreadcrumb
          :items="[{ label: 'Home', to: '/', icon: 'i-fa6-solid-house' }, { label: 'Admin' }]"
          :ui="{
            item: 'text-primary-600 dark:text-primary-400',
            link: 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300',
            linkActive: 'text-neutral-500 dark:text-neutral-400 font-medium',
            separator: 'text-neutral-400 dark:text-neutral-500',
            icon: 'text-primary-600 dark:text-primary-400',
          }"
        />

        <div class="flex items-center gap-4">
          <span class="text-sm opacity-70"> Welcome, {{ userProfile?.display_name || userProfile?.email }} </span>
          <UButton @click="handleLogout" variant="ghost" size="sm">
            <i class="fad fa-sign-out mr-2"></i>
            Logout
          </UButton>
        </div>
      </div>
    </div>

    <!-- Admin Components Grid -->
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- Registry Review Card -->
        <UCard class="hover:shadow-2xl transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-clipboard-list text-2xl text-primary"></i>
            </div>
            <h2 class="text-xl font-bold">Registry Review</h2>
          </div>

          <p class="opacity-70 mb-6">Review and manage Classic Mini registry submissions from users.</p>

          <div class="space-y-3 mb-6">
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-check-circle text-success"></i>
              <span>Approve submissions</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-times-circle text-error"></i>
              <span>Reject invalid entries</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-edit text-info"></i>
              <span>Edit submission details</span>
            </div>
          </div>

          <div class="flex justify-end">
            <UButton to="/admin/registry/review" color="primary">
              <i class="fad fa-arrow-right mr-2"></i>
              Manage Registry
            </UButton>
          </div>
        </UCard>

        <!-- Wheels Review Card -->
        <UCard class="hover:shadow-2xl transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-tire text-2xl text-secondary"></i>
            </div>
            <h2 class="text-xl font-bold">Wheels Review</h2>
          </div>

          <p class="opacity-70 mb-6">Review and manage wheel and tire submissions from the community.</p>

          <div class="space-y-3 mb-6">
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-check-circle text-success"></i>
              <span>Approve wheel data</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-times-circle text-error"></i>
              <span>Remove duplicates</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-edit text-info"></i>
              <span>Validate specifications</span>
            </div>
          </div>

          <div class="flex justify-end">
            <UButton to="/admin/wheels/review" color="secondary">
              <i class="fad fa-arrow-right mr-2"></i>
              Manage Wheels
            </UButton>
          </div>
        </UCard>

        <!-- Colors Review Card -->
        <UCard class="hover:shadow-2xl transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-palette text-2xl text-warning"></i>
            </div>
            <h2 class="text-xl font-bold">Colors Review</h2>
          </div>

          <p class="opacity-70 mb-6">Review and manage color database submissions from the community.</p>

          <div class="space-y-3 mb-6">
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-check-circle text-success"></i>
              <span>Approve color entries</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-times-circle text-error"></i>
              <span>Reject invalid data</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-edit text-info"></i>
              <span>Edit color details</span>
            </div>
          </div>

          <div class="flex justify-end">
            <UButton to="/admin/colors/review" color="warning">
              <i class="fad fa-arrow-right mr-2"></i>
              Manage Colors
            </UButton>
          </div>
        </UCard>

        <!-- Chat Threads Card -->
        <UCard class="hover:shadow-2xl transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
              <i class="fad fa-messages text-2xl text-info"></i>
            </div>
            <h2 class="text-xl font-bold">Chat Threads</h2>
          </div>

          <p class="opacity-70 mb-6">
            View and manage LangGraph chat threads from users interacting with the AI assistant.
          </p>

          <div class="space-y-3 mb-6">
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-list text-info"></i>
              <span>Browse all chat threads</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-filter text-info"></i>
              <span>Filter by status and metadata</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <i class="fad fa-eye text-info"></i>
              <span>View thread history and state</span>
            </div>
          </div>

          <div class="flex justify-end">
            <UButton to="/admin/threads" color="info">
              <i class="fad fa-arrow-right mr-2"></i>
              View Threads
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Admin Stats Section -->
      <div class="mt-16 max-w-4xl mx-auto">
        <UCard class="bg-muted">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold">Quick Stats</h3>
            <UButton @click="refreshStats" :disabled="isRefreshing" :loading="isRefreshing" variant="ghost" size="sm">
              <template #leading>
                <i v-if="!isRefreshing" class="fad fa-refresh"></i>
              </template>
              {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
            </UButton>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div class="p-4 rounded-lg">
              <div class="text-primary mb-2">
                <i class="fad fa-clipboard-list text-3xl"></i>
              </div>
              <div class="text-sm opacity-70">Registry Queue</div>
              <div class="text-3xl font-bold text-primary">{{ registryCount || '0' }}</div>
              <div class="text-xs opacity-60">Pending submissions</div>
            </div>

            <div class="p-4 rounded-lg">
              <div class="text-secondary mb-2">
                <i class="fad fa-tire text-3xl"></i>
              </div>
              <div class="text-sm opacity-70">Wheels Queue</div>
              <div class="text-3xl font-bold text-secondary">{{ wheelsCount || '0' }}</div>
              <div class="text-xs opacity-60">Pending reviews</div>
            </div>

            <div class="p-4 rounded-lg">
              <div class="text-warning mb-2">
                <i class="fad fa-palette text-3xl"></i>
              </div>
              <div class="text-sm opacity-70">Colors Queue</div>
              <div class="text-3xl font-bold text-warning">{{ colorsCount || '0' }}</div>
              <div class="text-xs opacity-60">Pending reviews</div>
            </div>

            <div class="p-4 rounded-lg">
              <div class="text-info mb-2">
                <i class="fad fa-clock text-3xl"></i>
              </div>
              <div class="text-sm opacity-70">Last Updated</div>
              <div class="text-lg font-bold text-info">{{ lastUpdated }}</div>
              <div class="text-xs opacity-60">{{ formatDate(new Date()) }}</div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
