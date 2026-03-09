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
      <UButton color="primary" @click="refresh" :disabled="isLoading" :loading="isLoading">
        <template #leading>
          <i v-if="!isLoading" class="fa-solid fa-refresh"></i>
        </template>
        Refresh
      </UButton>
    </div>

    <!-- Search and Filter Bar -->
    <div class="space-y-4 mb-8">
      <!-- Search -->
      <div class="max-w-md">
        <UInput
          v-model="searchQuery"
          placeholder="Search by name or email..."
          icon="i-fa6-solid-magnifying-glass"
          size="md"
          class="w-full"
        />
      </div>

      <!-- Trust Level Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium opacity-70 mr-1">Trust Level:</span>
        <UButton
          v-for="filter in trustLevelFilters"
          :key="filter.value"
          size="sm"
          :variant="activeTrustLevel === filter.value ? 'solid' : 'ghost'"
          :color="activeTrustLevel === filter.value ? 'primary' : 'neutral'"
          @click="activeTrustLevel = filter.value"
        >
          {{ filter.label }}
        </UButton>
      </div>
    </div>

    <!-- Error Messages -->
    <UAlert v-if="errorMessage" color="error" icon="i-fa6-solid-circle-xmark" :title="errorMessage" class="mb-6" />
    <UAlert
      v-if="fetchError"
      color="error"
      icon="i-fa6-solid-circle-xmark"
      :title="`Failed to load users: ${fetchError.data?.message || fetchError.message || 'Unknown error'}`"
      class="mb-6"
    >
      <template #actions>
        <UButton variant="outline" color="error" size="sm" @click="refreshData()"> Retry </UButton>
      </template>
    </UAlert>

    <!-- Loading State -->
    <div v-if="fetchStatus === 'pending'" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Empty State -->
    <UAlert
      v-else-if="!fetchError && !users.length"
      color="info"
      icon="i-fa6-solid-circle-info"
      title="No users found matching the current filters."
    />

    <!-- Users Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left p-2 font-medium bg-muted">User</th>
            <th class="text-left p-2 font-medium bg-muted">Trust Level</th>
            <th class="text-center p-2 font-medium bg-muted">Admin</th>
            <th class="text-left p-2 font-medium bg-muted">Submissions</th>
            <th class="text-left p-2 font-medium bg-muted">Joined</th>
            <th class="text-center p-2 font-medium bg-muted w-48">Change Trust Level</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="userItem in users"
            :key="userItem.id"
            class="border-b border-default last:border-0 hover:bg-muted transition-colors"
          >
            <!-- Avatar + Name/Email -->
            <td class="p-2">
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
                    <UBadge v-if="isSelf(userItem)" color="info" variant="subtle" size="xs" class="ml-1">You</UBadge>
                  </div>
                  <div class="text-xs opacity-60 truncate">{{ userItem.email }}</div>
                </div>
              </div>
            </td>

            <!-- Trust Level -->
            <td class="p-2">
              <UBadge :color="getTrustLevelBadgeColor(userItem.trust_level)" size="sm">
                {{ getTrustLevelLabel(userItem.trust_level) }}
              </UBadge>
            </td>

            <!-- Admin Toggle -->
            <td class="p-2 text-center">
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                :checked="userItem.is_admin"
                :disabled="isSelf(userItem) || isProcessing"
                @change="toggleAdmin(userItem)"
              />
            </td>

            <!-- Submissions -->
            <td class="p-2">
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
            <td class="p-2">
              <span class="text-xs opacity-70">{{ formatDate(userItem.created_at) }}</span>
            </td>

            <!-- Actions -->
            <td class="p-2 text-center">
              <template v-if="!isSelf(userItem)">
                <select
                  :value="userItem.trust_level"
                  class="select select-bordered select-xs w-full max-w-36"
                  @change="handleTrustLevelSelect(userItem, ($event.target as HTMLSelectElement).value)"
                  :disabled="isProcessing"
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
        <UButton size="sm" variant="ghost" :disabled="!hasPrevPage || isLoading" @click="goToPage(currentPage - 1)">
          <i class="fa-solid fa-chevron-left mr-1"></i>
          Previous
        </UButton>

        <div class="flex items-center gap-1">
          <template v-for="page in totalPages" :key="page">
            <UButton
              v-if="page - 1 === 0 || page - 1 === totalPages - 1 || Math.abs(page - 1 - currentPage) <= 1"
              size="xs"
              :variant="currentPage === page - 1 ? 'solid' : 'ghost'"
              :color="currentPage === page - 1 ? 'primary' : 'neutral'"
              @click="goToPage(page - 1)"
              :disabled="isLoading"
            >
              {{ page }}
            </UButton>
            <span v-else-if="Math.abs(page - 1 - currentPage) === 2" class="px-1 opacity-50">...</span>
          </template>
        </div>

        <UButton size="sm" variant="ghost" :disabled="!hasNextPage || isLoading" @click="goToPage(currentPage + 1)">
          Next
          <i class="fa-solid fa-chevron-right ml-1"></i>
        </UButton>
      </div>
    </div>

    <!-- Trust Level Change Confirmation Modal -->
    <UModal v-model:open="showTrustModal">
      <template #content>
        <div class="p-6">
          <h3 class="font-bold text-lg mb-4">Confirm Trust Level Change</h3>

          <!-- User Summary -->
          <div v-if="selectedUser" class="bg-muted p-4 rounded-lg mb-4">
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
              <UBadge :color="getTrustLevelBadgeColor(selectedUser.trust_level)" size="sm">
                {{ getTrustLevelLabel(selectedUser.trust_level) }}
              </UBadge>
              <i class="fa-solid fa-arrow-right opacity-50"></i>
              <UBadge :color="getTrustLevelBadgeColor(newTrustLevel)" size="sm">
                {{ getTrustLevelLabel(newTrustLevel) }}
              </UBadge>
            </div>
          </div>

          <!-- Danger Warning -->
          <UAlert v-if="isDangerousChange" color="warning" icon="i-fa6-solid-triangle-exclamation" class="mb-4">
            <template #title>
              <span v-if="newTrustLevel === 'moderator'">
                You are about to grant moderator status. This user will have elevated trust for content moderation.
              </span>
              <span v-else>
                You are about to remove moderator status from this user. They will lose elevated moderation trust.
              </span>
            </template>
          </UAlert>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="closeTrustModal" :disabled="isProcessing"> Cancel </UButton>
            <UButton
              :color="isDangerousChange ? 'warning' : 'primary'"
              @click="confirmTrustLevelChange"
              :disabled="isProcessing"
              :loading="isProcessing"
            >
              Confirm Change
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
