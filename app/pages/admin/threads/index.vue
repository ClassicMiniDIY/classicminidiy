<script setup lang="ts">
  import { HERO_TYPES } from '../../../../data/models/generic';

  // SEO and meta
  useHead({
    title: 'Chat Threads - Admin - Classic Mini DIY',
    meta: [
      {
        name: 'description',
        content: 'View and manage LangGraph chat threads from users.',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  // Define types
  interface Thread {
    thread_id: string;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, any>;
    status?: string;
    values?: any;
  }

  interface ThreadsResponse {
    success: boolean;
    threads: Thread[];
    count: number;
    filters: {
      limit: number;
      status?: string;
      metadata?: any;
    };
  }

  // Get user info from Supabase auth
  const { userProfile, signOut } = useAuth();

  // Reactive state
  const isLoading = ref(false);
  const filterStatus = ref<string>('');
  const searchQuery = ref('');

  // Fetch threads
  const { data: threadsData, refresh: refreshThreads } = await useAdminFetch<ThreadsResponse>('/api/admin/threads/list', {
    query: {
      limit: 100,
    },
  });

  const threads = computed(() => threadsData.value?.threads || []);

  // Filter threads based on search and status
  const filteredThreads = computed(() => {
    let result = threads.value;

    // Filter by status
    if (filterStatus.value) {
      result = result.filter((t) => t.status === filterStatus.value);
    }

    // Filter by search query (thread ID or metadata)
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter((t) => {
        const matchesId = t.thread_id.toLowerCase().includes(query);
        const matchesMetadata = JSON.stringify(t.metadata || {})
          .toLowerCase()
          .includes(query);
        return matchesId || matchesMetadata;
      });
    }

    return result;
  });

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Navigate to thread details
  const viewThread = (thread: Thread) => {
    navigateTo(`/admin/threads/${thread.thread_id}`);
  };

  // Refresh data
  const handleRefresh = async () => {
    isLoading.value = true;
    try {
      await refreshThreads();
    } finally {
      isLoading.value = false;
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    await navigateTo('/login');
  };

  // Get status badge color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'idle':
        return 'success';
      case 'busy':
        return 'warning';
      case 'interrupted':
        return 'info';
      case 'error':
        return 'error';
      default:
        return 'neutral';
    }
  };
</script>

<template>
  <div>
    <!-- Hero Section -->
    <Hero
      title="Chat Threads"
      subtitle="View and manage LangGraph chat threads from users"
      :heroType="HERO_TYPES.TECH"
      textSize="text-4xl"
    />

    <!-- Breadcrumb Navigation -->
    <div class="container mx-auto px-4 pt-10">
      <div class="flex justify-between items-center">
        <UBreadcrumb
          :items="[
            { label: 'Home', to: '/', icon: 'i-fa6-solid-house' },
            { label: 'Admin', to: '/admin' },
            { label: 'Chat Threads' },
          ]"
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

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <!-- Stats and Controls -->
      <UCard class="mb-8">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 class="text-2xl font-bold">Thread Overview</h2>
            <p class="opacity-70">
              Total threads: <span class="font-semibold">{{ threads.length }}</span> | Filtered:
              <span class="font-semibold">{{ filteredThreads.length }}</span>
            </p>
          </div>
          <UButton @click="handleRefresh" :disabled="isLoading" :loading="isLoading" color="primary">
            <template #leading>
              <i v-if="!isLoading" class="fad fa-refresh"></i>
            </template>
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </UButton>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <UFormField label="Search threads">
            <UInput
              v-model="searchQuery"
              type="text"
              placeholder="Search by thread ID or metadata..."
              icon="i-fa6-solid-magnifying-glass"
            />
          </UFormField>
          <UFormField label="Filter by status">
            <USelect
              v-model="filterStatus"
              :items="[
                { label: 'All statuses', value: '' },
                { label: 'Idle', value: 'idle' },
                { label: 'Busy', value: 'busy' },
                { label: 'Interrupted', value: 'interrupted' },
                { label: 'Error', value: 'error' },
              ]"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Threads Table -->
      <UCard>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default">
                <th class="text-left p-2 font-medium bg-muted">Thread ID</th>
                <th class="text-left p-2 font-medium bg-muted">Status</th>
                <th class="text-left p-2 font-medium bg-muted">Created</th>
                <th class="text-left p-2 font-medium bg-muted">Updated</th>
                <th class="text-left p-2 font-medium bg-muted">Metadata</th>
                <th class="text-left p-2 font-medium bg-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredThreads.length === 0">
                <td colspan="6" class="text-center py-8 opacity-50">
                  <i class="fad fa-inbox text-4xl mb-2 block"></i>
                  No threads found
                </td>
              </tr>
              <tr
                v-for="thread in filteredThreads"
                :key="thread.thread_id"
                class="border-b border-default last:border-0 hover:bg-muted transition-colors"
              >
                <td class="p-2">
                  <code class="text-xs">{{ thread.thread_id }}</code>
                </td>
                <td class="p-2">
                  <UBadge :color="getStatusColor(thread.status)">
                    {{ thread.status || 'unknown' }}
                  </UBadge>
                </td>
                <td class="p-2 text-sm">{{ formatDate(thread.created_at) }}</td>
                <td class="p-2 text-sm">{{ formatDate(thread.updated_at) }}</td>
                <td class="p-2 max-w-xs truncate">
                  <span v-if="thread.metadata" class="text-xs opacity-70">
                    {{ JSON.stringify(thread.metadata) }}
                  </span>
                  <span v-else class="text-xs opacity-50">No metadata</span>
                </td>
                <td class="p-2">
                  <UButton @click="viewThread(thread)" size="sm" variant="ghost">
                    <i class="fad fa-eye mr-1"></i>
                    View
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </div>
</template>
