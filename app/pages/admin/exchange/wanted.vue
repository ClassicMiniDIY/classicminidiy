<template>
  <AdminExchangeShell>
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">Wanted Post Moderation</h1>
        <p class="text-base-content/70">Review and moderate wanted posts from the community</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="loading" @click="loadPosts">
        <i class="fas fa-arrows-rotate" :class="{ 'animate-spin': loading }"></i>
        Refresh
      </button>
    </div>

    <!-- Filters -->
    <div class="card bg-base-100 shadow-sm mb-6">
      <div class="card-body">
        <div class="flex flex-wrap gap-4 items-center">
          <div class="form-control">
            <label for="status-filter" class="label">
              <span class="label-text">Filter by Status</span>
            </label>
            <select id="status-filter" v-model="selectedStatus" class="select select-bordered w-full max-w-xs">
              <option value="all">All Statuses</option>
              <option value="flagged">Flagged</option>
              <option value="active">Active</option>
              <option value="removed">Removed</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div class="form-control flex-1">
            <label class="label">
              <span class="label-text">Search</span>
            </label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by title or description..."
              class="input input-bordered w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 5" :key="i" class="skeleton h-32 w-full"></div>
    </div>

    <!-- Posts (Mobile + Desktop) -->
    <div v-else-if="filteredPosts.length > 0">
      <!-- Mobile Card View -->
      <div class="md:hidden space-y-4">
        <div v-for="post in filteredPosts" :key="post.id" class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <!-- Header -->
            <div class="flex items-start gap-3 mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="font-bold truncate">{{ post.title }}</h3>
                <p class="text-sm text-base-content/70 line-clamp-2 mt-1">{{ post.description }}</p>
              </div>
              <div class="flex flex-col gap-1 shrink-0">
                <span class="badge badge-sm" :class="getStatusBadgeClass(post.status)">
                  {{ formatStatus(post.status) }}
                </span>
                <span class="badge badge-sm" :class="getModerationBadgeClass(post.moderation_status)">
                  {{ formatModerationStatus(post.moderation_status) }}
                </span>
              </div>
            </div>

            <!-- Moderation Issues -->
            <div v-if="post.moderation_issues && post.moderation_issues.length > 0" class="mb-3">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(issue, idx) in post.moderation_issues"
                  :key="idx"
                  class="badge badge-warning badge-sm gap-1"
                >
                  <i class="fas fa-triangle-exclamation"></i>
                  {{ issue }}
                </span>
              </div>
            </div>

            <!-- User and Date Info -->
            <div class="text-sm space-y-1 mb-3">
              <div class="flex items-center gap-2">
                <i class="fas fa-user text-base-content/50"></i>
                <span class="font-medium">{{ post.profiles?.display_name || 'Unknown' }}</span>
                <span class="text-base-content/50">{{ post.profiles?.email }}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fas fa-tag text-base-content/50"></i>
                <span class="capitalize">{{ post.category }}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fas fa-calendar text-base-content/50"></i>
                <span class="text-base-content/70">{{ formatDate(post.created_at) }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <NuxtLink :to="`/exchange/wanted/${post.id}`" class="btn btn-sm btn-ghost flex-1" target="_blank">
                <i class="fas fa-eye"></i>
                View
              </NuxtLink>
              <div class="dropdown dropdown-end">
                <button tabindex="0" class="btn btn-sm btn-ghost">
                  <i class="fas fa-ellipsis-vertical"></i>
                </button>
                <ul
                  tabindex="0"
                  class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-[9999]"
                >
                  <li v-if="post.status !== 'active' || post.moderation_status !== 'approved'">
                    <a @click="confirmAction(post.id, 'approve')">
                      <i class="fas fa-circle-check text-success"></i>
                      Approve
                    </a>
                  </li>
                  <li v-if="post.status !== 'removed'">
                    <a @click="confirmAction(post.id, 'reject')">
                      <i class="fas fa-circle-xmark text-warning"></i>
                      Reject
                    </a>
                  </li>
                  <li class="border-t border-base-300 mt-1 pt-1">
                    <a @click="confirmAction(post.id, 'delete')" class="text-error">
                      <i class="fas fa-trash"></i>
                      Delete
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden md:block card bg-base-100 shadow-sm">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Post</th>
                <th>User</th>
                <th class="cursor-pointer select-none" @click="toggleSort('category')">
                  <span class="flex items-center gap-1">
                    Category
                    <i
                      class="text-xs"
                      :class="[getSortIcon('category'), { 'opacity-30': !isSortedBy('category') }]"
                    ></i>
                  </span>
                </th>
                <th class="cursor-pointer select-none" @click="toggleSort('status')">
                  <span class="flex items-center gap-1">
                    Status
                    <i class="text-xs" :class="[getSortIcon('status'), { 'opacity-30': !isSortedBy('status') }]"></i>
                  </span>
                </th>
                <th class="cursor-pointer select-none" @click="toggleSort('moderation_status')">
                  <span class="flex items-center gap-1">
                    Moderation
                    <i
                      class="text-xs"
                      :class="[getSortIcon('moderation_status'), { 'opacity-30': !isSortedBy('moderation_status') }]"
                    ></i>
                  </span>
                </th>
                <th class="cursor-pointer select-none" @click="toggleSort('created_at')">
                  <span class="flex items-center gap-1">
                    Created
                    <i
                      class="text-xs"
                      :class="[getSortIcon('created_at'), { 'opacity-30': !isSortedBy('created_at') }]"
                    ></i>
                  </span>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="post in filteredPosts" :key="post.id">
                <td>
                  <div class="max-w-xs">
                    <div class="font-bold truncate">{{ post.title }}</div>
                    <div class="text-sm text-base-content/70 line-clamp-1">{{ post.description }}</div>
                    <div
                      v-if="post.moderation_issues && post.moderation_issues.length > 0"
                      class="flex flex-wrap gap-1 mt-1"
                    >
                      <span
                        v-for="(issue, idx) in post.moderation_issues"
                        :key="idx"
                        class="badge badge-warning badge-xs gap-1"
                      >
                        <i class="fas fa-triangle-exclamation"></i>
                        {{ issue }}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="text-sm">
                    <div class="font-medium">{{ post.profiles?.display_name || 'Unknown' }}</div>
                    <div class="text-base-content/70">{{ post.profiles?.email }}</div>
                  </div>
                </td>
                <td>
                  <span class="capitalize">{{ post.category }}</span>
                </td>
                <td>
                  <span class="badge badge-sm" :class="getStatusBadgeClass(post.status)">
                    {{ formatStatus(post.status) }}
                  </span>
                </td>
                <td>
                  <span class="badge badge-sm" :class="getModerationBadgeClass(post.moderation_status)">
                    {{ formatModerationStatus(post.moderation_status) }}
                  </span>
                </td>
                <td>
                  <span class="text-sm">{{ formatDate(post.created_at) }}</span>
                </td>
                <td>
                  <div class="flex gap-2">
                    <NuxtLink
                      :to="`/exchange/wanted/${post.id}`"
                      class="btn btn-ghost btn-xs"
                      target="_blank"
                      aria-label="View wanted post"
                    >
                      <i class="fas fa-eye"></i>
                    </NuxtLink>
                    <div class="dropdown dropdown-end">
                      <button tabindex="0" class="btn btn-ghost btn-xs">
                        <i class="fas fa-ellipsis-vertical"></i>
                      </button>
                      <ul
                        tabindex="0"
                        class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-[9999]"
                      >
                        <li v-if="post.status !== 'active' || post.moderation_status !== 'approved'">
                          <a @click="confirmAction(post.id, 'approve')">
                            <i class="fas fa-circle-check text-success"></i>
                            Approve
                          </a>
                        </li>
                        <li v-if="post.status !== 'removed'">
                          <a @click="confirmAction(post.id, 'reject')">
                            <i class="fas fa-circle-xmark text-warning"></i>
                            Reject
                          </a>
                        </li>
                        <li class="border-t border-base-300 mt-1 pt-1">
                          <a @click="confirmAction(post.id, 'delete')" class="text-error">
                            <i class="fas fa-trash"></i>
                            Delete
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <!-- Bottom padding for dropdown space -->
          <div class="h-48"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-16 card bg-base-100 shadow-sm">
      <i class="fas fa-inbox text-6xl mx-auto mb-4 text-base-content/30"></i>
      <h3 class="text-xl font-semibold mb-2">No Wanted Posts Found</h3>
      <p class="text-base-content/70">Try adjusting your filters</p>
    </div>

    <!-- Action Confirmation Modal -->
    <dialog ref="actionModalRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ actionModalTitle }}</h3>
        <p class="py-4">{{ actionModalMessage }}</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="cancelAction">Cancel</button>
          <button class="btn" :class="actionModalButtonClass" :disabled="actionLoading" @click="executeAction">
            <span v-if="actionLoading" class="loading loading-spinner loading-xs"></span>
            {{ actionModalConfirmText }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="cancelAction">close</button>
      </form>
    </dialog>
  </AdminExchangeShell>
</template>

<script setup lang="ts">
  import type { WantedPost } from '~/composables/useWantedPosts';

  definePageMeta({
    layout: 'admin',
  });

  useSeoMeta({
    title: 'Wanted Post Moderation - Admin - The Mini Exchange',
    robots: 'noindex, nofollow',
  });

  const supabase = useSupabase();
  const toast = useToast();
  const { handleError } = useErrorHandler();
  const { toggleSort, getSortIcon, isSortedBy, sortFn } = useTableSort('created_at', 'desc');

  // State
  const posts = ref<WantedPost[]>([]);
  const loading = ref(true);
  const selectedStatus = ref('all');
  const searchQuery = ref('');

  // Action modal state
  const actionModalRef = ref<HTMLDialogElement | null>(null);
  const pendingAction = ref<{ id: string; type: 'approve' | 'reject' | 'delete' } | null>(null);
  const actionLoading = ref(false);

  /**
   * Computed: modal title based on pending action.
   */
  const actionModalTitle = computed(() => {
    switch (pendingAction.value?.type) {
      case 'approve':
        return 'Approve Wanted Post';
      case 'reject':
        return 'Reject Wanted Post';
      case 'delete':
        return 'Delete Wanted Post';
      default:
        return 'Confirm Action';
    }
  });

  const actionModalMessage = computed(() => {
    switch (pendingAction.value?.type) {
      case 'approve':
        return 'This will set the post to active with an approved moderation status. It will be visible to all users.';
      case 'reject':
        return 'This will remove the post and mark it as rejected. The user will no longer see it as active.';
      case 'delete':
        return 'Are you sure you want to permanently delete this wanted post? This action cannot be undone.';
      default:
        return 'Are you sure?';
    }
  });

  const actionModalConfirmText = computed(() => {
    switch (pendingAction.value?.type) {
      case 'approve':
        return 'Approve';
      case 'reject':
        return 'Reject';
      case 'delete':
        return 'Delete';
      default:
        return 'Confirm';
    }
  });

  const actionModalButtonClass = computed(() => {
    switch (pendingAction.value?.type) {
      case 'approve':
        return 'btn-success';
      case 'reject':
        return 'btn-warning';
      case 'delete':
        return 'btn-error';
      default:
        return 'btn-primary';
    }
  });

  /**
   * Filter posts by local search query.
   */
  const filteredPosts = computed(() => {
    let filtered = posts.value;

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.profiles?.display_name?.toLowerCase().includes(query) ||
          p.profiles?.email?.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort(sortFn);
  });

  /**
   * Fetch all wanted posts for admin moderation.
   */
  const loadPosts = async () => {
    loading.value = true;

    try {
      // Email lives on profile_private (sensitive-column split) — embed via
      // profiles and flatten so the template keeps reading profiles.email.
      let query = supabase
        .from('wanted_posts')
        .select('*, profiles!wanted_posts_user_id_fkey(id, display_name, avatar_url, profile_private ( email ))')
        .order('created_at', { ascending: false });

      if (selectedStatus.value && selectedStatus.value !== 'all') {
        // For "flagged" filter, match moderation_status instead of status
        if (selectedStatus.value === 'flagged') {
          query = query.eq('moderation_status', 'flagged');
        } else {
          query = query.eq('status', selectedStatus.value);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      posts.value = ((data as any[]) || []).map((p) => {
        if (!p.profiles) return p;
        const { profile_private: priv, ...profile } = p.profiles;
        return { ...p, profiles: { ...profile, email: priv?.email ?? null } };
      }) as WantedPost[];
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to load wanted posts' });
    } finally {
      loading.value = false;
    }
  };

  /**
   * Update a post's status and moderation status.
   */
  const adminUpdateStatus = async (id: string, status: string, moderationStatus: string) => {
    const { error } = await supabase
      .from('wanted_posts')
      .update({ status, moderation_status: moderationStatus })
      .eq('id', id);

    if (error) throw error;
  };

  /**
   * Delete a wanted post permanently.
   */
  const adminDeletePost = async (id: string) => {
    const { error } = await supabase.from('wanted_posts').delete().eq('id', id);

    if (error) throw error;
  };

  /**
   * Open the confirmation modal for a given action.
   */
  const confirmAction = (id: string, type: 'approve' | 'reject' | 'delete') => {
    pendingAction.value = { id, type };
    actionModalRef.value?.showModal();
  };

  /**
   * Cancel and close the action modal.
   */
  const cancelAction = () => {
    actionModalRef.value?.close();
    pendingAction.value = null;
  };

  /**
   * Execute the pending admin action.
   */
  const executeAction = async () => {
    if (!pendingAction.value) return;

    const { id, type } = pendingAction.value;
    actionLoading.value = true;

    try {
      switch (type) {
        case 'approve':
          await adminUpdateStatus(id, 'active', 'approved');
          toast.add({
            title: 'Post Approved',
            description: 'The wanted post is now active and visible.',
            color: 'success',
          });
          break;

        case 'reject':
          await adminUpdateStatus(id, 'removed', 'rejected');
          toast.add({
            title: 'Post Rejected',
            description: 'The wanted post has been removed.',
            color: 'warning',
          });
          break;

        case 'delete':
          await adminDeletePost(id);
          toast.add({
            title: 'Post Deleted',
            description: 'The wanted post has been permanently deleted.',
            color: 'success',
          });
          break;
      }

      actionModalRef.value?.close();
      pendingAction.value = null;
      await loadPosts();
    } catch (error) {
      handleError(error, { toastTitle: `Failed to ${type} wanted post` });
    } finally {
      actionLoading.value = false;
    }
  };

  /**
   * Format status for display.
   */
  const formatStatus = (status: string): string => {
    const labels: Record<string, string> = {
      active: 'Active',
      fulfilled: 'Fulfilled',
      expired: 'Expired',
      removed: 'Removed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  /**
   * Format moderation status for display.
   */
  const formatModerationStatus = (status: string): string => {
    const labels: Record<string, string> = {
      approved: 'Approved',
      pending: 'Pending',
      flagged: 'Flagged',
      rejected: 'Rejected',
    };
    return labels[status] || status;
  };

  /**
   * Get badge class for post status.
   */
  const getStatusBadgeClass = (status: string): string => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      fulfilled: 'badge-info',
      expired: 'badge-error',
      removed: 'badge-ghost',
      cancelled: 'badge-ghost',
    };
    return classes[status] || 'badge-ghost';
  };

  /**
   * Get badge class for moderation status.
   */
  const getModerationBadgeClass = (status: string): string => {
    const classes: Record<string, string> = {
      approved: 'badge-success',
      pending: 'badge-warning',
      flagged: 'badge-error',
      rejected: 'badge-ghost',
    };
    return classes[status] || 'badge-ghost';
  };

  /**
   * Format a date string to locale date.
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Watch filter changes
  watch(selectedStatus, () => {
    loadPosts();
  });

  onMounted(() => {
    loadPosts();
  });
</script>
