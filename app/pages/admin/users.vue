<script setup lang="ts">
  import { nextTick } from 'vue';
  import { BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Admin - User Management',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  // Types
  interface UserItem {
    id: string;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
    trust_level: 'new' | 'contributor' | 'trusted' | 'moderator' | 'admin';
    is_admin: boolean;
    total_submissions: number;
    approved_submissions: number;
    rejected_submissions: number;
    created_at: string;
  }

  type TrustLevel = UserItem['trust_level'];

  interface TrustLevelFilter {
    label: string;
    value: string;
  }

  // Current user
  const { user: currentUser } = useAuth();

  // Trust level configuration — 'admin' is a separate boolean flag, not a trust level
  const trustLevels: TrustLevel[] = ['new', 'contributor', 'trusted', 'moderator'];

  const trustLevelFilters: TrustLevelFilter[] = [
    { label: 'All', value: 'all' },
    { label: 'New', value: 'new' },
    { label: 'Contributor', value: 'contributor' },
    { label: 'Trusted', value: 'trusted' },
    { label: 'Moderator', value: 'moderator' },
    { label: 'Admin', value: 'admin' },
  ];

  // Filter state
  const searchQuery = ref('');
  const activeTrustLevel = ref('all');
  const currentPage = ref(0);
  const pageSize = 50;

  // Debounced search
  let searchTimeout: ReturnType<typeof setTimeout>;
  const debouncedSearch = ref('');
  watch(searchQuery, (val) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      debouncedSearch.value = val;
      currentPage.value = 0;
    }, 300);
  });

  // Reset page when filter changes
  watch(activeTrustLevel, () => {
    currentPage.value = 0;
  });

  // Query params
  const queryParams = computed(() => {
    const params: Record<string, string | number> = {
      limit: pageSize,
      offset: currentPage.value * pageSize,
    };
    if (debouncedSearch.value) params.search = debouncedSearch.value;
    if (activeTrustLevel.value !== 'all') params.trustLevel = activeTrustLevel.value;
    return params;
  });

  // Fetch data — uses useAdminFetch to inject auth header and skip SSR
  const {
    data: response,
    status: fetchStatus,
    error: fetchError,
    refresh: refreshData,
  } = await useAdminFetch<{ users: UserItem[]; total: number }>('/api/admin/users/list', {
    query: queryParams,
    watch: [queryParams],
    default: () => ({ users: [], total: 0 }),
  });

  // State
  const errorMessage = ref('');
  const isProcessing = ref(false);

  // Trust level change modal
  const showTrustModal = ref(false);
  const selectedUser = ref<UserItem | null>(null);
  const newTrustLevel = ref<TrustLevel>('new');

  // Computed
  const isLoading = computed(() => fetchStatus.value === 'pending' || isProcessing.value);
  const users = computed(() => response.value?.users ?? []);
  const totalUsers = computed(() => response.value?.total ?? 0);
  const totalPages = computed(() => Math.ceil(totalUsers.value / pageSize));
  const hasNextPage = computed(() => currentPage.value < totalPages.value - 1);
  const hasPrevPage = computed(() => currentPage.value > 0);

  // Trust level changes to/from moderator are notable
  const isDangerousChange = computed(() => {
    if (!selectedUser.value) return false;
    const currentLevel = selectedUser.value.trust_level;
    return newTrustLevel.value === 'moderator' || currentLevel === 'moderator';
  });

  // --- Helpers ---

  const getTrustLevelBadgeColor = (level: TrustLevel): string => {
    switch (level) {
      case 'admin':
        return 'primary';
      case 'moderator':
        return 'warning';
      case 'trusted':
        return 'success';
      case 'contributor':
        return 'info';
      case 'new':
      default:
        return 'neutral';
    }
  };

  const getTrustLevelLabel = (level: TrustLevel): string => {
    switch (level) {
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      case 'trusted':
        return 'Trusted';
      case 'contributor':
        return 'Contributor';
      case 'new':
      default:
        return 'New';
    }
  };

  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isSelf = (userItem: UserItem): boolean => {
    return currentUser.value?.id === userItem.id;
  };

  // --- Actions ---

  async function refresh() {
    if (isLoading.value) return;
    try {
      await refreshData();
      errorMessage.value = '';
    } catch (error) {
      errorMessage.value = 'Failed to refresh data. Please try again.';
    }
  }

  function openTrustModal(userItem: UserItem, level: TrustLevel) {
    selectedUser.value = userItem;
    newTrustLevel.value = level;
    showTrustModal.value = true;
  }

  async function closeTrustModal() {
    showTrustModal.value = false;
    await nextTick();
    selectedUser.value = null;
  }

  async function confirmTrustLevelChange() {
    if (!selectedUser.value) {
      showTrustModal.value = false;
      return;
    }

    const userToUpdate = selectedUser.value;
    isProcessing.value = true;
    errorMessage.value = '';

    try {
      await $adminFetch('/api/admin/users/update-trust', {
        method: 'POST',
        body: {
          userId: userToUpdate.id,
          trustLevel: newTrustLevel.value,
        },
      });

      // Update trust level locally — is_admin is independent and not changed here
      if (response.value?.users) {
        const index = response.value.users.findIndex((u) => u.id === userToUpdate.id);
        if (index !== -1 && response.value.users[index]) {
          response.value.users[index].trust_level = newTrustLevel.value;
        }
      }

      showTrustModal.value = false;
      await nextTick();
      selectedUser.value = null;
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to update trust level';
    } finally {
      isProcessing.value = false;
    }
  }

  function handleTrustLevelSelect(userItem: UserItem, level: string) {
    if (level === userItem.trust_level) return;
    openTrustModal(userItem, level as TrustLevel);
  }

  // --- Admin toggle (independent of trust level) ---
  async function toggleAdmin(userItem: UserItem) {
    if (isSelf(userItem)) return;

    const newValue = !userItem.is_admin;
    isProcessing.value = true;
    errorMessage.value = '';

    try {
      await $adminFetch('/api/admin/users/toggle-admin', {
        method: 'POST',
        body: {
          userId: userItem.id,
          isAdmin: newValue,
        },
      });

      // Update locally
      if (response.value?.users) {
        const index = response.value.users.findIndex((u) => u.id === userItem.id);
        if (index !== -1 && response.value.users[index]) {
          response.value.users[index].is_admin = newValue;
        }
      }
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to update admin status';
    } finally {
      isProcessing.value = false;
    }
  }

  function goToPage(page: number) {
    if (page >= 0 && page < totalPages.value) {
      currentPage.value = page;
    }
  }
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <div class="mb-6">
      <Breadcrumb page="User Management" :version="BREADCRUMB_VERSIONS.ADMIN" />
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <h1 class="text-2xl font-bold">User Management</h1>
      <button type="button" class="btn btn-primary" :disabled="isLoading" @click="refresh">
        <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fa-solid fa-refresh"></i>
        Refresh
      </button>
    </div>

    <!-- Search and Filter Bar -->
    <div class="space-y-4 mb-8">
      <!-- Search -->
      <div class="max-w-md">
        <label class="input input-bordered flex items-center gap-2 w-full">
          <i class="fas fa-magnifying-glass opacity-60"></i>
          <input v-model="searchQuery" type="text" class="grow" placeholder="Search by name or email..." />
        </label>
      </div>

      <!-- Trust Level Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium opacity-70 mr-1">Trust Level:</span>
        <button
          v-for="filter in trustLevelFilters"
          :key="filter.value"
          type="button"
          class="btn btn-sm"
          :class="activeTrustLevel === filter.value ? 'btn-primary' : 'btn-ghost'"
          @click="activeTrustLevel = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <!-- Error Messages -->
    <div v-if="errorMessage" role="alert" class="alert alert-error mb-6">
      <i class="fas fa-circle-xmark"></i>
      <span>{{ errorMessage }}</span>
    </div>
    <div v-if="fetchError" role="alert" class="alert alert-error mb-6">
      <i class="fas fa-circle-xmark"></i>
      <span>Failed to load users: {{ fetchError.data?.message || fetchError.message || 'Unknown error' }}</span>
      <button type="button" class="btn btn-outline btn-error btn-sm" @click="refreshData()">Retry</button>
    </div>

    <!-- Loading State -->
    <div v-if="fetchStatus === 'pending'" class="flex justify-center my-8">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!fetchError && !users.length" role="alert" class="alert alert-info">
      <i class="fas fa-circle-info"></i>
      <span>No users found matching the current filters.</span>
    </div>

    <!-- Users Table -->
    <div v-else class="overflow-x-auto">
      <table class="table table-zebra w-full text-sm">
        <thead>
          <tr>
            <th>User</th>
            <th>Trust Level</th>
            <th class="text-center">Admin</th>
            <th>Submissions</th>
            <th>Joined</th>
            <th class="text-center w-48">Change Trust Level</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="userItem in users" :key="userItem.id">
            <!-- Avatar + Name/Email -->
            <td>
              <div class="flex items-center gap-3">
                <!-- Avatar -->
                <div v-if="userItem.avatar_url" class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <img
                    :src="userItem.avatar_url"
                    :alt="userItem.display_name || userItem.email"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div
                  v-else
                  class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0"
                >
                  {{ getInitials(userItem.display_name) }}
                </div>

                <div class="min-w-0">
                  <div class="font-medium truncate">
                    {{ userItem.display_name || 'No display name' }}
                    <span v-if="isSelf(userItem)" class="badge badge-soft badge-info badge-xs ml-1">You</span>
                  </div>
                  <div class="text-xs opacity-60 truncate">{{ userItem.email }}</div>
                </div>
              </div>
            </td>

            <!-- Trust Level -->
            <td>
              <span class="badge badge-sm" :class="`badge-${getTrustLevelBadgeColor(userItem.trust_level)}`">
                {{ getTrustLevelLabel(userItem.trust_level) }}
              </span>
            </td>

            <!-- Admin Toggle -->
            <td class="text-center">
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                :checked="userItem.is_admin"
                :disabled="isSelf(userItem) || isProcessing"
                @change="toggleAdmin(userItem)"
              />
            </td>

            <!-- Submissions -->
            <td>
              <div class="text-xs space-y-0.5">
                <div>{{ userItem.total_submissions }} total</div>
                <div class="opacity-70">
                  <span class="text-success">{{ userItem.approved_submissions }} approved</span>
                  <span class="mx-1">/</span>
                  <span class="text-error">{{ userItem.rejected_submissions }} rejected</span>
                </div>
              </div>
            </td>

            <!-- Joined -->
            <td>
              <span class="text-xs opacity-70">{{ formatDate(userItem.created_at) }}</span>
            </td>

            <!-- Actions -->
            <td class="text-center">
              <template v-if="!isSelf(userItem)">
                <select
                  :value="userItem.trust_level"
                  class="select select-bordered select-xs w-full max-w-36"
                  :disabled="isProcessing"
                  @change="handleTrustLevelSelect(userItem, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="level in trustLevels" :key="level" :value="level">
                    {{ getTrustLevelLabel(level) }}
                  </option>
                </select>
              </template>
              <template v-else>
                <span class="text-xs opacity-50">Cannot edit self</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Result Count -->
      <div class="flex items-center justify-between mt-4 text-sm opacity-70">
        <span>
          Showing {{ currentPage * pageSize + 1 }}-{{ Math.min((currentPage + 1) * pageSize, totalUsers) }} of
          {{ totalUsers }} users
        </span>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-4">
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="!hasPrevPage || isLoading"
          @click="goToPage(currentPage - 1)"
        >
          <i class="fa-solid fa-chevron-left mr-1"></i>
          Previous
        </button>

        <div class="flex items-center gap-1">
          <template v-for="page in totalPages" :key="page">
            <button
              v-if="page - 1 === 0 || page - 1 === totalPages - 1 || Math.abs(page - 1 - currentPage) <= 1"
              type="button"
              class="btn btn-xs"
              :class="currentPage === page - 1 ? 'btn-primary' : 'btn-ghost'"
              :disabled="isLoading"
              @click="goToPage(page - 1)"
            >
              {{ page }}
            </button>
            <span v-else-if="Math.abs(page - 1 - currentPage) === 2" class="px-1 opacity-50">...</span>
          </template>
        </div>

        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="!hasNextPage || isLoading"
          @click="goToPage(currentPage + 1)"
        >
          Next
          <i class="fa-solid fa-chevron-right ml-1"></i>
        </button>
      </div>
    </div>

    <!-- Trust Level Change Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showTrustModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Confirm Trust Level Change</h3>

        <!-- User Summary -->
        <div v-if="selectedUser" class="bg-base-200 p-4 rounded-lg mb-4">
          <div class="flex items-center gap-3 mb-3">
            <div v-if="selectedUser.avatar_url" class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <img
                :src="selectedUser.avatar_url"
                :alt="selectedUser.display_name || selectedUser.email"
                class="w-full h-full object-cover"
              />
            </div>
            <div
              v-else
              class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0"
            >
              {{ getInitials(selectedUser.display_name) }}
            </div>
            <div>
              <p class="font-medium">{{ selectedUser.display_name || 'No display name' }}</p>
              <p class="text-sm opacity-60">{{ selectedUser.email }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 text-sm">
            <span class="badge badge-sm" :class="`badge-${getTrustLevelBadgeColor(selectedUser.trust_level)}`">
              {{ getTrustLevelLabel(selectedUser.trust_level) }}
            </span>
            <i class="fa-solid fa-arrow-right opacity-50"></i>
            <span class="badge badge-sm" :class="`badge-${getTrustLevelBadgeColor(newTrustLevel)}`">
              {{ getTrustLevelLabel(newTrustLevel) }}
            </span>
          </div>
        </div>

        <!-- Danger Warning -->
        <div v-if="isDangerousChange" role="alert" class="alert alert-warning mb-4">
          <i class="fas fa-triangle-exclamation"></i>
          <span v-if="newTrustLevel === 'moderator'">
            You are about to grant moderator status. This user will have elevated trust for content moderation.
          </span>
          <span v-else>
            You are about to remove moderator status from this user. They will lose elevated moderation trust.
          </span>
        </div>

        <!-- Actions -->
        <div class="modal-action">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="closeTrustModal">
            Cancel
          </button>
          <button
            type="button"
            class="btn"
            :class="isDangerousChange ? 'btn-warning' : 'btn-primary'"
            :disabled="isProcessing"
            @click="confirmTrustLevelChange"
          >
            <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
            Confirm Change
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeTrustModal"></div>
    </dialog>
  </div>
</template>
