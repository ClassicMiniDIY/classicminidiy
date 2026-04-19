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
  const { data: threadsData, refresh: refreshThreads } = await useAdminFetch<ThreadsResponse>(
    '/api/admin/threads/list',
    {
      query: {
        limit: 100,
      },
    }
  );

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
        <div class="breadcrumbs text-sm">
          <ul>
            <li>
              <NuxtLink to="/" class="link link-primary">
                <i class="fas fa-house mr-1"></i>
                Home
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/admin" class="link link-primary">Admin</NuxtLink>
            </li>
            <li><span>Chat Threads</span></li>
          </ul>
        </div>

        <div class="flex items-center gap-4">
          <span class="text-sm opacity-70"> Welcome, {{ userProfile?.display_name || userProfile?.email }} </span>
          <button type="button" class="btn btn-ghost btn-sm" @click="handleLogout">
            <i class="fad fa-sign-out mr-2"></i>
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
      <!-- Stats and Controls -->
      <div class="card bg-base-100 shadow-md border border-base-300 mb-8">
        <div class="card-body">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 class="text-2xl font-bold">Thread Overview</h2>
              <p class="opacity-70">
                Total threads: <span class="font-semibold">{{ threads.length }}</span> | Filtered:
                <span class="font-semibold">{{ filteredThreads.length }}</span>
              </p>
            </div>
            <button type="button" class="btn btn-primary" :disabled="isLoading" @click="handleRefresh">
              <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fad fa-refresh"></i>
              {{ isLoading ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>

          <!-- Filters -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text">Search threads</span>
              </div>
              <label class="input input-bordered flex items-center gap-2 w-full">
                <i class="fas fa-magnifying-glass opacity-60"></i>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="grow"
                  placeholder="Search by thread ID or metadata..."
                />
              </label>
            </label>
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text">Filter by status</span>
              </div>
              <select v-model="filterStatus" class="select select-bordered w-full">
                <option value="">All statuses</option>
                <option value="idle">Idle</option>
                <option value="busy">Busy</option>
                <option value="interrupted">Interrupted</option>
                <option value="error">Error</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <!-- Threads Table -->
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full text-sm">
              <thead>
                <tr>
                  <th>Thread ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Metadata</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredThreads.length === 0">
                  <td colspan="6" class="text-center py-8 opacity-50">
                    <i class="fad fa-inbox text-4xl mb-2 block"></i>
                    No threads found
                  </td>
                </tr>
                <tr v-for="thread in filteredThreads" :key="thread.thread_id">
                  <td>
                    <code class="text-xs">{{ thread.thread_id }}</code>
                  </td>
                  <td>
                    <span class="badge" :class="`badge-${getStatusColor(thread.status)}`">
                      {{ thread.status || 'unknown' }}
                    </span>
                  </td>
                  <td class="text-sm">{{ formatDate(thread.created_at) }}</td>
                  <td class="text-sm">{{ formatDate(thread.updated_at) }}</td>
                  <td class="max-w-xs truncate">
                    <span v-if="thread.metadata" class="text-xs opacity-70">
                      {{ JSON.stringify(thread.metadata) }}
                    </span>
                    <span v-else class="text-xs opacity-50">No metadata</span>
                  </td>
                  <td>
                    <button type="button" class="btn btn-ghost btn-sm" @click="viewThread(thread)">
                      <i class="fad fa-eye mr-1"></i>
                      View
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
