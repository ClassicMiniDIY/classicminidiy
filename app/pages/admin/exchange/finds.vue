<template>
  <div>
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">Manage Finds</h1>
        <p class="text-base-content/70">Review and moderate community-submitted finds</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="loading" @click="refresh">
        <i class="fas fa-arrows-rotate" :class="{ 'animate-spin': loading }"></i>
        Refresh
      </button>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="stat bg-base-100 shadow-sm rounded-box p-4">
        <div class="stat-title text-xs">Pending</div>
        <div class="stat-value text-2xl text-warning">{{ pendingFinds.length }}</div>
      </div>
      <div class="stat bg-base-100 shadow-sm rounded-box p-4">
        <div class="stat-title text-xs">Approved</div>
        <div class="stat-value text-2xl text-success">{{ approvedCount }}</div>
      </div>
      <div class="stat bg-base-100 shadow-sm rounded-box p-4">
        <div class="stat-title text-xs">Rejected</div>
        <div class="stat-value text-2xl text-error">{{ rejectedCount }}</div>
      </div>
      <div class="stat bg-base-100 shadow-sm rounded-box p-4">
        <div class="stat-title text-xs">Total</div>
        <div class="stat-value text-2xl">{{ allTotal }}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs tabs-border mb-6">
      <button class="tab" :class="{ 'tab-active': activeTab === 'pending' }" @click="activeTab = 'pending'">
        Pending
        <span v-if="pendingFinds.length > 0" class="badge badge-warning badge-sm ml-2">
          {{ pendingFinds.length }}
        </span>
      </button>
      <button class="tab" :class="{ 'tab-active': activeTab === 'all' }" @click="activeTab = 'all'">All</button>
    </div>

    <!-- Pending Tab -->
    <div v-if="activeTab === 'pending'">
      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="skeleton h-40 w-full"></div>
      </div>

      <!-- Pending List -->
      <div v-else-if="pendingFinds.length > 0" class="space-y-4">
        <div v-for="find in pendingFinds" :key="find.id" class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <div class="flex flex-col md:flex-row gap-4">
              <!-- Thumbnail -->
              <div class="shrink-0">
                <div class="w-full md:w-48 aspect-video bg-base-300 rounded-lg overflow-hidden">
                  <img
                    v-if="find.og_image_url"
                    :src="find.og_image_url"
                    :alt="find.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <i class="fas fa-link text-3xl text-base-content/30"></i>
                  </div>
                </div>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <!-- Title & Source -->
                <div class="flex flex-wrap items-start gap-2 mb-2">
                  <h3 class="font-bold text-lg">{{ find.title }}</h3>
                  <span class="badge badge-sm" :class="getSourceBadgeClass(find.source_site)">
                    {{ getSourceDisplayName(find.source_site) }}
                  </span>
                </div>

                <!-- Metadata -->
                <div class="flex flex-wrap gap-3 text-sm text-base-content/70 mb-2">
                  <span v-if="find.year">
                    <i class="fas fa-calendar inline"></i>
                    {{ find.year }}
                  </span>
                  <span v-if="find.model">
                    <i class="fas fa-truck inline"></i>
                    {{ find.model }}
                  </span>
                  <span v-if="find.price != null || find.price_label" class="font-semibold text-primary">
                    {{ find.price_label || formatCurrency(find.price!) }}
                  </span>
                  <span v-if="find.category" class="badge badge-xs badge-outline">{{ find.category }}</span>
                </div>

                <!-- Submitter & Date -->
                <div class="text-sm text-base-content/50 mb-2">
                  Submitted by <strong>{{ find.profiles?.display_name || 'Unknown' }}</strong> on
                  {{ formatDate(find.created_at) }}
                </div>

                <!-- Description -->
                <p v-if="find.description" class="text-sm text-base-content/60 line-clamp-2 mb-3">
                  {{ find.description }}
                </p>

                <!-- Source URL -->
                <a
                  :href="find.source_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link link-primary text-sm inline-flex items-center gap-1 mb-3"
                >
                  <i class="fas fa-arrow-up-right-from-square"></i>
                  {{ truncateUrl(find.source_url) }}
                </a>

                <!-- Action Buttons -->
                <div class="flex flex-wrap gap-2">
                  <button class="btn btn-success btn-sm gap-1" @click="openApproveForm(find)">
                    <i class="fas fa-circle-check"></i>
                    Approve
                  </button>
                  <button class="btn btn-error btn-sm btn-outline gap-1" @click="handleReject(find.id)">
                    <i class="fas fa-circle-xmark"></i>
                    Reject
                  </button>
                  <button class="btn btn-ghost btn-sm gap-1" @click="openEditForm(find)">
                    <i class="fas fa-pen-to-square"></i>
                    Edit
                  </button>
                  <button
                    class="btn btn-ghost btn-sm gap-1"
                    :disabled="refetchingId === find.id"
                    @click="handleRefetchMetadata(find.id)"
                  >
                    <span v-if="refetchingId === find.id" class="loading loading-spinner loading-xs"></span>
                    <i v-else class="fas fa-arrows-rotate"></i>
                    {{ refetchingId === find.id ? 'Fetching...' : 'Re-fetch' }}
                  </button>
                  <button class="btn btn-ghost btn-sm btn-error gap-1" @click="handleDelete(find.id)">
                    <i class="fas fa-trash"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty Pending -->
      <div v-else class="text-center py-16 card bg-base-100 shadow-sm">
        <i class="fas fa-circle-check text-6xl mx-auto mb-4 text-success/50"></i>
        <h3 class="text-xl font-semibold mb-2">All Caught Up</h3>
        <p class="text-base-content/70">No pending finds to review.</p>
      </div>
    </div>

    <!-- All Tab -->
    <div v-if="activeTab === 'all'">
      <!-- Filters for All tab -->
      <div class="card bg-base-100 shadow-sm mb-6">
        <div class="card-body p-4">
          <div class="flex flex-wrap gap-4 items-center">
            <div class="form-control">
              <label for="status-filter" class="label">
                <span class="label-text text-xs">Status</span>
              </label>
              <select id="status-filter" v-model="allStatusFilter" class="select select-bordered select-sm">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div class="form-control">
              <label for="source-filter" class="label">
                <span class="label-text text-xs">Source</span>
              </label>
              <select id="source-filter" v-model="allSourceFilter" class="select select-bordered select-sm">
                <option value="">All Sources</option>
                <option value="bat">Bring a Trailer</option>
                <option value="carsandbids">Cars & Bids</option>
                <option value="copart">Copart</option>
                <option value="craigslist">Craigslist</option>
                <option value="facebook">Facebook</option>
                <option value="ebay">eBay</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="ml-auto self-end">
              <button
                class="btn btn-sm btn-outline gap-1"
                :disabled="bulkRefreshing || allFinds.length === 0"
                @click="handleBulkRefresh"
              >
                <span v-if="bulkRefreshing" class="loading loading-spinner loading-xs"></span>
                <i v-else class="fas fa-arrows-rotate"></i>
                Refresh All Metadata
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk Refresh Progress -->
      <div v-if="bulkRefreshing" class="card bg-base-100 shadow-sm mb-6">
        <div class="card-body p-4">
          <div class="flex items-center gap-3 mb-2">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="text-sm font-medium">
              Refreshing {{ bulkProgress.completed }} / {{ bulkProgress.total }}...
            </span>
          </div>
          <progress
            class="progress progress-primary w-full"
            :value="bulkProgress.completed"
            :max="bulkProgress.total"
          ></progress>
          <p v-if="bulkProgress.currentTitle" class="text-xs text-base-content/50 mt-1 truncate">
            {{ bulkProgress.currentTitle }}
          </p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="skeleton h-20 w-full"></div>
      </div>

      <!-- All Finds Table -->
      <div v-else-if="allFinds.length > 0" class="card bg-base-100 shadow-sm">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Find</th>
                <th>Source</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="find in allFinds" :key="find.id">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="avatar shrink-0">
                      <div class="mask mask-squircle w-12 h-12">
                        <img v-if="find.og_image_url" :src="find.og_image_url" :alt="find.title" loading="lazy" />
                        <div v-else class="bg-base-300 w-full h-full flex items-center justify-center">
                          <i class="fas fa-link text-base-content/30"></i>
                        </div>
                      </div>
                    </div>
                    <div class="min-w-0">
                      <div class="font-bold truncate max-w-[200px]">{{ find.title }}</div>
                      <div class="text-sm text-base-content/70">
                        {{ [find.year, find.model].filter(Boolean).join(' ') || 'No details' }}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-sm" :class="getSourceBadgeClass(find.source_site)">
                    {{ getSourceDisplayName(find.source_site) }}
                  </span>
                </td>
                <td>
                  <span class="badge badge-sm" :class="getStatusBadgeClass(find.status)">
                    {{ find.status }}
                  </span>
                  <span v-if="find.is_editors_pick" class="badge badge-sm badge-accent ml-1 gap-1">
                    <i class="fas fa-star"></i>
                    Pick
                  </span>
                </td>
                <td>
                  <div class="text-sm">
                    <div>{{ find.profiles?.display_name || 'Unknown' }}</div>
                    <div class="text-base-content/60">{{ formatDate(find.created_at) }}</div>
                  </div>
                </td>
                <td>
                  <div class="flex gap-1">
                    <a
                      :href="find.source_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-ghost btn-xs"
                      title="View source"
                    >
                      <i class="fas fa-arrow-up-right-from-square"></i>
                    </a>
                    <NuxtLink
                      v-if="find.status === 'approved'"
                      :to="`/exchange/finds/${find.slug}`"
                      class="btn btn-ghost btn-xs"
                      target="_blank"
                      title="View find page"
                    >
                      <i class="fas fa-eye"></i>
                    </NuxtLink>
                    <button class="btn btn-ghost btn-xs" title="Edit find" @click="openEditForm(find)">
                      <i class="fas fa-pen-to-square"></i>
                    </button>
                    <button
                      class="btn btn-ghost btn-xs"
                      :title="find.is_editors_pick ? `Remove Editor's Pick` : `Set Editor's Pick`"
                      @click="handleToggleEditorsPick(find.id)"
                    >
                      <i
                        :class="[
                          find.is_editors_pick ? 'fas fa-star' : 'far fa-star',
                          { 'text-accent': find.is_editors_pick },
                        ]"
                      ></i>
                    </button>
                    <button
                      class="btn btn-ghost btn-xs"
                      :title="refetchingId === find.id ? 'Fetching metadata...' : 'Re-fetch metadata'"
                      :disabled="refetchingId === find.id"
                      @click="handleRefetchMetadata(find.id)"
                    >
                      <span v-if="refetchingId === find.id" class="loading loading-spinner loading-xs"></span>
                      <i v-else class="fas fa-arrows-rotate"></i>
                    </button>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      title="Delete"
                      aria-label="Delete find"
                      @click="handleDelete(find.id)"
                    >
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty All -->
      <div v-else class="text-center py-16 card bg-base-100 shadow-sm">
        <i class="fas fa-inbox text-6xl mx-auto mb-4 text-base-content/30"></i>
        <h3 class="text-xl font-semibold mb-2">No Finds</h3>
        <p class="text-base-content/70">No finds match the current filters.</p>
      </div>
    </div>

    <!-- Approve Modal -->
    <dialog ref="approveModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Approve Find</h3>

        <div v-if="approvingFind" class="space-y-4">
          <p class="text-base-content/70">
            Approving: <strong>{{ approvingFind.title }}</strong>
          </p>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Editor's Commentary (optional)</legend>
            <textarea
              v-model="approveCommentary"
              class="textarea textarea-bordered w-full"
              placeholder="Add a note about why this find is interesting..."
              rows="3"
            ></textarea>
          </fieldset>

          <label class="flex items-center gap-3 cursor-pointer">
            <input v-model="approveEditorsPick" type="checkbox" class="checkbox checkbox-accent" />
            <span class="label-text">
              <i class="fas fa-star inline text-accent"></i>
              Mark as Editor's Pick
            </span>
          </label>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeApproveModal">Cancel</button>
          <button class="btn btn-success" @click="confirmApprove">
            <i class="fas fa-circle-check"></i>
            Approve
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Edit Modal -->
    <dialog ref="editModal" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Edit Find</h3>

        <div v-if="editingFind" class="space-y-4">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Title</legend>
            <input v-model="editForm.title" type="text" class="input input-bordered w-full" maxlength="300" />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Description</legend>
            <textarea
              v-model="editForm.description"
              class="textarea textarea-bordered w-full"
              rows="3"
              maxlength="2000"
            ></textarea>
          </fieldset>

          <div class="grid grid-cols-2 gap-4">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Year</legend>
              <input
                v-model.number="editForm.year"
                type="number"
                class="input input-bordered w-full"
                min="1959"
                max="2000"
              />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Model</legend>
              <input v-model="editForm.model" type="text" class="input input-bordered w-full" />
            </fieldset>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Price</legend>
              <input v-model.number="editForm.price" type="number" class="input input-bordered w-full" min="0" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Price Label</legend>
              <input
                v-model="editForm.price_label"
                type="text"
                class="input input-bordered w-full"
                placeholder="e.g. Current Bid, Asking Price"
              />
            </fieldset>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Category</legend>
              <select v-model="editForm.category" class="select select-bordered w-full">
                <option value="">None</option>
                <option value="vehicle">Vehicle</option>
                <option value="engine">Engine</option>
                <option value="parts">Parts</option>
              </select>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Tags</legend>
              <input
                v-model="editForm.tags"
                type="text"
                class="input input-bordered w-full"
                placeholder="comma-separated"
              />
            </fieldset>
          </div>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">OG Image URL</legend>
            <input
              v-model="editForm.og_image_url"
              type="url"
              class="input input-bordered w-full"
              placeholder="https://..."
            />
            <div v-if="editForm.og_image_url" class="mt-2">
              <img :src="editForm.og_image_url" alt="Preview" class="w-32 h-20 object-cover rounded" />
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Editor's Commentary</legend>
            <textarea
              v-model="editForm.editor_commentary"
              class="textarea textarea-bordered w-full"
              rows="3"
              maxlength="5000"
              placeholder="Public commentary about this find..."
            ></textarea>
          </fieldset>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeEditModal">Cancel</button>
          <button class="btn btn-primary" :disabled="!editForm.title.trim()" @click="confirmEdit">
            <i class="fas fa-check"></i>
            Save Changes
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog ref="deleteModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete Find</h3>
        <p class="py-4">Are you sure you want to delete this find? This action cannot be undone.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeDeleteModal">Cancel</button>
          <button class="btn btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  import type { ExternalListing } from '~/composables/useExternalListings';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Manage Finds - Admin - The Mini Exchange',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const {
    pendingFinds,
    allFinds,
    loading,
    fetchPending,
    fetchAll,
    approve,
    reject,
    refetchMetadata,
    bulkRefetchMetadata,
    toggleEditorsPick,
    updateFind,
    deleteFind,
  } = useExternalListingAdmin();

  const toast = useToast();
  const supabase = useSupabase();
  const { getSourceDisplayName, getSourceBadgeClass, formatCurrency, formatDate } = useFormatters();

  // Tab state
  const activeTab = ref<'pending' | 'all'>('pending');

  // All tab filters
  const allStatusFilter = ref('');
  const allSourceFilter = ref('');

  // Approve modal state
  const approveModal = ref<HTMLDialogElement | null>(null);
  const approvingFind = ref<ExternalListing | null>(null);
  const approveCommentary = ref('');
  const approveEditorsPick = ref(false);

  // Edit modal state
  const editModal = ref<HTMLDialogElement | null>(null);
  const editingFind = ref<ExternalListing | null>(null);
  const editForm = ref({
    title: '',
    description: '',
    year: null as number | null,
    model: '',
    price: null as number | null,
    price_label: '',
    category: '' as string,
    tags: '',
    editor_commentary: '',
    og_image_url: '',
  });

  // Re-fetch loading state (tracks which find ID is currently re-fetching)
  const refetchingId = ref<string | null>(null);

  // Bulk refresh state
  const bulkRefreshing = ref(false);
  const bulkProgress = ref({ completed: 0, total: 0, currentTitle: '' });

  // Delete modal state
  const deleteModal = ref<HTMLDialogElement | null>(null);
  const deletingFindId = ref<string | null>(null);

  // Stats
  const approvedCount = ref(0);
  const rejectedCount = ref(0);
  const allTotal = ref(0);

  // Status badge class
  const getStatusBadgeClass = (status: string): string => {
    const map: Record<string, string> = {
      pending: 'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-error',
      expired: 'badge-ghost',
    };
    return map[status] || 'badge-ghost';
  };

  // Truncate URL for display
  const truncateUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.length > 40 ? parsed.pathname.slice(0, 40) + '...' : parsed.pathname;
      return parsed.hostname + path;
    } catch {
      return url.length > 60 ? url.slice(0, 60) + '...' : url;
    }
  };

  // Open approve form modal
  const openApproveForm = (find: ExternalListing) => {
    approvingFind.value = find;
    approveCommentary.value = '';
    approveEditorsPick.value = false;
    approveModal.value?.showModal();
  };

  const closeApproveModal = () => {
    approveModal.value?.close();
    approvingFind.value = null;
  };

  const confirmApprove = async () => {
    if (!approvingFind.value) return;

    await approve(
      approvingFind.value.id,
      approveCommentary.value.trim() || undefined,
      approveEditorsPick.value || undefined
    );

    closeApproveModal();
    loadStats();
  };

  // Reject handler
  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return; // User cancelled
    await reject(id, reason || undefined);
    loadStats();
  };

  // Re-fetch metadata handler
  const handleRefetchMetadata = async (id: string) => {
    if (refetchingId.value) return; // Prevent duplicate clicks
    refetchingId.value = id;
    try {
      await refetchMetadata(id);
      // Reload the current tab data
      if (activeTab.value === 'pending') {
        await fetchPending();
      } else {
        await loadAllFinds();
      }
    } finally {
      refetchingId.value = null;
    }
  };

  // Bulk refresh metadata for all currently displayed finds
  const handleBulkRefresh = async () => {
    if (bulkRefreshing.value) return;

    const ids = allFinds.value.map((f) => f.id);
    if (ids.length === 0) return;

    const confirmed = confirm(`Refresh metadata for ${ids.length} finds? This may take a while.`);
    if (!confirmed) return;

    bulkRefreshing.value = true;
    bulkProgress.value = { completed: 0, total: ids.length, currentTitle: '' };

    try {
      await bulkRefetchMetadata(ids, (completed, total, currentTitle) => {
        bulkProgress.value = { completed, total, currentTitle };
      });
      // Reload the table
      await loadAllFinds();
    } finally {
      bulkRefreshing.value = false;
    }
  };

  // Toggle editor's pick
  const handleToggleEditorsPick = async (id: string) => {
    await toggleEditorsPick(id);
  };

  // Edit handlers
  const openEditForm = (find: ExternalListing) => {
    editingFind.value = find;
    editForm.value = {
      title: find.title,
      description: find.description || '',
      year: find.year,
      model: find.model || '',
      price: find.price,
      price_label: find.price_label || '',
      category: find.category || '',
      tags: (find.tags || []).join(', '),
      editor_commentary: find.editor_commentary || '',
      og_image_url: find.og_image_url || '',
    };
    editModal.value?.showModal();
  };

  const closeEditModal = () => {
    editModal.value?.close();
    editingFind.value = null;
  };

  const confirmEdit = async () => {
    if (!editingFind.value) return;

    const fields: Record<string, any> = {
      title: editForm.value.title.trim(),
      description: editForm.value.description.trim() || null,
      year: editForm.value.year || null,
      model: editForm.value.model.trim() || null,
      price: editForm.value.price ?? null,
      price_label: editForm.value.price_label.trim() || null,
      category: editForm.value.category || null,
      tags: editForm.value.tags
        .split(',')
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length > 0),
      editor_commentary: editForm.value.editor_commentary.trim() || null,
      og_image_url: editForm.value.og_image_url.trim() || null,
    };

    await updateFind(editingFind.value.id, fields);
    closeEditModal();

    // Reload current tab data
    if (activeTab.value === 'pending') {
      await fetchPending();
    } else {
      await loadAllFinds();
    }
  };

  // Delete handlers
  const handleDelete = (id: string) => {
    deletingFindId.value = id;
    deleteModal.value?.showModal();
  };

  const closeDeleteModal = () => {
    deleteModal.value?.close();
    deletingFindId.value = null;
  };

  const confirmDelete = async () => {
    if (!deletingFindId.value) return;

    try {
      await deleteFind(deletingFindId.value);
      loadStats();
    } catch (error: any) {
      console.error('Error deleting find:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to delete find',
        color: 'error',
      });
    } finally {
      closeDeleteModal();
    }
  };

  // Load stats (counts by status)
  const loadStats = async () => {
    try {
      const [approvedResult, rejectedResult, totalResult] = await Promise.all([
        supabase.from('external_listings').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('external_listings').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('external_listings').select('id', { count: 'exact', head: true }),
      ]);

      approvedCount.value = approvedResult.count || 0;
      rejectedCount.value = rejectedResult.count || 0;
      allTotal.value = totalResult.count || 0;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Load all finds with filters
  const loadAllFinds = async () => {
    await fetchAll({
      status: (allStatusFilter.value as any) || undefined,
      sourceSite: allSourceFilter.value || undefined,
    });
  };

  // Refresh current tab
  const refresh = async () => {
    if (activeTab.value === 'pending') {
      await fetchPending();
    } else {
      await loadAllFinds();
    }
    await loadStats();
  };

  // Watch tab changes
  watch(activeTab, (tab) => {
    if (tab === 'pending') {
      fetchPending();
    } else {
      loadAllFinds();
    }
  });

  // Watch all-tab filters
  watch([allStatusFilter, allSourceFilter], () => {
    if (activeTab.value === 'all') {
      loadAllFinds();
    }
  });

  // Initial load
  onMounted(() => {
    fetchPending();
    loadStats();
  });
</script>
