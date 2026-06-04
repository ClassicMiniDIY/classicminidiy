<script setup lang="ts">
  import { nextTick } from 'vue';
  import { BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Admin - Moderation Queue',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  // Types
  interface QueueItem {
    id: string;
    type: 'new_item' | 'edit_suggestion' | 'new_collection';
    targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel';
    targetId: string | null;
    status: 'pending' | 'approved' | 'rejected';
    data: Record<string, any>;
    collectionNames: Record<string, string>;
    reviewerNotes: string | null;
    reviewedAt: string | null;
    createdAt: string;
    submittedBy: string;
    submitterName: string;
    submitterEmail: string | null;
    submitterAvatar: string | null;
    submitterTrustLevel: 'new' | 'contributor' | 'trusted' | 'moderator' | 'admin';
  }

  interface TargetTypeFilter {
    label: string;
    value: string | null;
    icon: string;
  }

  interface StatusFilter {
    label: string;
    value: string;
  }

  // Filter configuration
  const targetTypeFilters: TargetTypeFilter[] = [
    { label: 'All', value: null, icon: 'fad fa-layer-group' },
    { label: 'Documents', value: 'document', icon: 'fad fa-books' },
    { label: 'Registry', value: 'registry', icon: 'fad fa-clipboard-list' },
    { label: 'Colors', value: 'color', icon: 'fad fa-palette' },
    { label: 'Wheels', value: 'wheel', icon: 'fad fa-tire' },
  ];

  const statusFilters: StatusFilter[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ];

  // Filter state
  const activeTargetType = ref<string | null>(null);
  const activeStatus = ref('pending');

  // Build query params
  const queryParams = computed(() => {
    const params: Record<string, string> = { status: activeStatus.value };
    if (activeTargetType.value) params.targetType = activeTargetType.value;
    return params;
  });

  // Fetch data — uses useAdminFetch to inject auth header and skip SSR
  const {
    data: items,
    status: fetchStatus,
    error: fetchError,
    refresh: refreshData,
  } = await useAdminFetch<QueueItem[]>('/api/admin/queue/list', {
    query: queryParams,
    watch: [queryParams],
    default: () => [],
  });

  const { track } = useAnalytics();

  // State
  const errorMessage = ref('');
  const isProcessing = ref(false);

  // Modal state
  const showApproveModal = ref(false);
  const showRejectModal = ref(false);
  const selectedItem = ref<QueueItem | null>(null);
  const reviewerNotes = ref('');

  // Computed
  const isLoading = computed(() => fetchStatus.value === 'pending' || isProcessing.value);

  // --- Helpers ---

  const getSubmissionTypeLabel = (type: QueueItem['type']): string => {
    switch (type) {
      case 'new_item':
        return 'New Submission';
      case 'edit_suggestion':
        return 'Edit Suggestion';
      case 'new_collection':
        return 'New Collection';
      default:
        return type;
    }
  };

  const getSubmissionTypeBadgeColor = (type: QueueItem['type']): string => {
    switch (type) {
      case 'new_item':
        return 'primary';
      case 'edit_suggestion':
        return 'info';
      case 'new_collection':
        return 'secondary';
      default:
        return 'neutral';
    }
  };

  const getTargetTypeBadgeColor = (targetType: QueueItem['targetType']): string => {
    switch (targetType) {
      case 'document':
        return 'neutral';
      case 'registry':
        return 'primary';
      case 'color':
        return 'warning';
      case 'wheel':
        return 'secondary';
      case 'collection':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getTargetTypeLabel = (targetType: QueueItem['targetType']): string => {
    switch (targetType) {
      case 'document':
        return 'Document';
      case 'registry':
        return 'Registry';
      case 'color':
        return 'Color';
      case 'wheel':
        return 'Wheel';
      case 'collection':
        return 'Collection';
      default:
        return targetType;
    }
  };

  const getStatusBadgeColor = (status: QueueItem['status']): string => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getStatusLabel = (status: QueueItem['status']): string => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const getTrustLevelBadgeColor = (level: QueueItem['submitterTrustLevel']): string => {
    switch (level) {
      case 'admin':
        return 'error';
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

  const getTrustLevelLabel = (level: QueueItem['submitterTrustLevel']): string => {
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

  const getInitials = (name: string): string => {
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Returns uploaded file images from a queue item for preview.
   * Handles both legacy string[] format and new { url, category }[] format.
   */
  const getUploadedImages = (item: QueueItem): { url: string; category: string }[] => {
    const files = item.data?.uploadedFiles;
    if (!Array.isArray(files)) return [];
    return files.map((f: any) =>
      typeof f === 'string' ? { url: f, category: 'general' } : { url: f.url, category: f.category || 'general' }
    );
  };

  /**
   * Returns the key data fields to preview for a given target type.
   */
  const getPreviewFields = (item: QueueItem): { label: string; value: string }[] => {
    const data = item.data || {};
    const fields: { label: string; value: string }[] = [];

    switch (item.targetType) {
      case 'color':
        if (data.name) fields.push({ label: 'Name', value: data.name });
        if (data.code) fields.push({ label: 'Code', value: data.code });
        if (data.shortCode) fields.push({ label: 'Short Code', value: data.shortCode });
        if (data.primaryColor) fields.push({ label: 'Hex', value: data.primaryColor });
        break;
      case 'wheel':
        if (data.name) fields.push({ label: 'Name', value: data.name });
        if (data.size) fields.push({ label: 'Size', value: `${data.size}"` });
        if (data.type || data.wheel_type) fields.push({ label: 'Type', value: data.type || data.wheel_type });
        if (data.manufacturer) fields.push({ label: 'Manufacturer', value: data.manufacturer });
        break;
      case 'registry':
        if (data.model) fields.push({ label: 'Model', value: data.model });
        if (data.year) fields.push({ label: 'Year', value: String(data.year) });
        if (data.bodyNum || data.body_number)
          fields.push({ label: 'Body Number', value: data.bodyNum || data.body_number });
        if (data.color) fields.push({ label: 'Color', value: data.color });
        break;
      case 'document':
        if (data.title) fields.push({ label: 'Title', value: data.title });
        if (data.type) fields.push({ label: 'Type', value: data.type });
        if (data.code) fields.push({ label: 'Code', value: data.code });
        if (data.author) fields.push({ label: 'Author', value: data.author });
        break;
      default:
        // Generic: show first few keys
        for (const [key, val] of Object.entries(data).slice(0, 4)) {
          if (val != null && typeof val !== 'object') {
            fields.push({ label: key, value: String(val) });
          }
        }
    }

    return fields;
  };

  /**
   * For edit suggestions, extract the diff changes.
   */
  const getEditChanges = (item: QueueItem): { field: string; from: any; to: any }[] => {
    if (item.type !== 'edit_suggestion' || !item.data?.changes) return [];
    const changes = item.data.changes;
    return Object.entries(changes).map(([field, diff]: [string, any]) => ({
      field,
      from: diff?.from ?? '-',
      to: diff?.to ?? '-',
    }));
  };

  const FRIENDLY_FIELD_LABELS: Record<string, string> = {
    collection_id: 'Collection',
    _new_collection_title: 'New Collection Title',
    _new_collection_description: 'New Collection Description',
  };

  const formatFieldName = (field: string): string => {
    if (FRIENDLY_FIELD_LABELS[field]) return FRIENDLY_FIELD_LABELS[field];
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  };

  const formatDiffValue = (value: any, field?: string, item?: QueueItem): string => {
    if (value === null || value === undefined) return '-';
    if (field === 'collection_id') {
      if (value === '__new__') return 'New Collection (see details below)';
      // Resolve UUID to friendly name
      const name = item?.collectionNames?.[value];
      if (name) return name;
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
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

  function openApproveModal(item: QueueItem) {
    selectedItem.value = item;
    reviewerNotes.value = '';
    showApproveModal.value = true;
  }

  function openRejectModal(item: QueueItem) {
    selectedItem.value = item;
    reviewerNotes.value = '';
    showRejectModal.value = true;
  }

  async function closeApproveModal() {
    showApproveModal.value = false;
    await nextTick();
    selectedItem.value = null;
    reviewerNotes.value = '';
  }

  async function closeRejectModal() {
    showRejectModal.value = false;
    await nextTick();
    selectedItem.value = null;
    reviewerNotes.value = '';
  }

  async function approveItem() {
    if (!selectedItem.value) {
      showApproveModal.value = false;
      return;
    }

    const itemToApprove = selectedItem.value;
    isProcessing.value = true;
    errorMessage.value = '';

    try {
      await $adminFetch('/api/admin/queue/approve', {
        method: 'POST',
        body: {
          id: itemToApprove.id,
          reviewerNotes: reviewerNotes.value || null,
        },
      });

      track('admin_action', { item_type: 'queue', action: 'approve' });

      // Update item status locally
      if (items.value) {
        const index = items.value.findIndex((i) => i.id === itemToApprove.id);
        if (index !== -1 && items.value[index]) {
          items.value[index].status = 'approved';
          items.value[index].reviewerNotes = reviewerNotes.value || null;
          items.value[index].reviewedAt = new Date().toISOString();
        }
      }

      showApproveModal.value = false;
      await nextTick();
      selectedItem.value = null;
      reviewerNotes.value = '';
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to approve submission';
    } finally {
      isProcessing.value = false;
    }
  }

  async function rejectItem() {
    if (!selectedItem.value) {
      showRejectModal.value = false;
      return;
    }

    const itemToReject = selectedItem.value;
    isProcessing.value = true;
    errorMessage.value = '';

    try {
      await $adminFetch('/api/admin/queue/reject', {
        method: 'POST',
        body: {
          id: itemToReject.id,
          reviewerNotes: reviewerNotes.value || null,
        },
      });

      track('admin_action', { item_type: 'queue', action: 'reject' });

      // Update item status locally
      if (items.value) {
        const index = items.value.findIndex((i) => i.id === itemToReject.id);
        if (index !== -1 && items.value[index]) {
          items.value[index].status = 'rejected';
          items.value[index].reviewerNotes = reviewerNotes.value || null;
          items.value[index].reviewedAt = new Date().toISOString();
        }
      }

      showRejectModal.value = false;
      await nextTick();
      selectedItem.value = null;
      reviewerNotes.value = '';
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to reject submission';
    } finally {
      isProcessing.value = false;
    }
  }
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <div class="mb-6">
      <Breadcrumb page="Moderation Queue" :version="BREADCRUMB_VERSIONS.ADMIN" />
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <span class="eyebrow">ADMIN</span>
        <h1 class="text-2xl font-bold">Moderation Queue</h1>
      </div>
      <button type="button" class="btn btn-primary" :disabled="isLoading" @click="refresh">
        <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fa-solid fa-refresh mr-2"></i>
        Refresh
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="space-y-4 mb-8">
      <!-- Target Type Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium opacity-70 mr-1">Type:</span>
        <button
          v-for="filter in targetTypeFilters"
          :key="filter.label"
          type="button"
          class="btn btn-sm"
          :class="activeTargetType === filter.value ? 'btn-primary' : 'btn-ghost'"
          @click="activeTargetType = filter.value"
        >
          <i :class="filter.icon" class="mr-1.5"></i>
          {{ filter.label }}
        </button>
      </div>

      <!-- Status Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium opacity-70 mr-1">Status:</span>
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          type="button"
          class="btn btn-xs"
          :class="activeStatus === filter.value ? 'btn-primary' : 'btn-soft btn-neutral'"
          @click="activeStatus = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" role="alert" class="alert alert-error mb-6">
      <i class="fas fa-circle-xmark"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Loading State -->
    <div v-if="fetchStatus === 'pending'" class="flex justify-center my-8">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!items?.length" role="alert" class="alert alert-info">
      <i class="fas fa-circle-info"></i>
      <span>No submissions found matching the current filters.</span>
    </div>

    <!-- Submission Cards -->
    <div v-else class="space-y-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="card bg-base-100 shadow-md border border-base-300 hover:shadow-lg transition-shadow"
      >
        <div class="card-body">
          <!-- Card Header Row -->
          <div class="flex flex-wrap items-center gap-2 mb-4">
            <span class="badge badge-soft badge-sm" :class="`badge-${getSubmissionTypeBadgeColor(item.type)}`">
              {{ getSubmissionTypeLabel(item.type) }}
            </span>
            <span class="badge badge-soft badge-sm" :class="`badge-${getTargetTypeBadgeColor(item.targetType)}`">
              {{ getTargetTypeLabel(item.targetType) }}
            </span>
            <span class="badge badge-sm" :class="`badge-${getStatusBadgeColor(item.status)}`">
              {{ getStatusLabel(item.status) }}
            </span>
          </div>

          <!-- Submitter Info -->
          <div class="flex items-center gap-3 mb-4">
            <!-- Avatar -->
            <div v-if="item.submitterAvatar" class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <img :src="item.submitterAvatar" :alt="item.submitterName" class="w-full h-full object-cover" />
            </div>
            <div
              v-else
              class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0"
            >
              {{ getInitials(item.submitterName) }}
            </div>

            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-medium">{{ item.submitterName }}</span>
              <span
                class="badge badge-soft badge-xs"
                :class="`badge-${getTrustLevelBadgeColor(item.submitterTrustLevel)}`"
              >
                {{ getTrustLevelLabel(item.submitterTrustLevel) }}
              </span>
              <span class="opacity-60">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>

          <!-- Data Preview (for new_item and new_collection) -->
          <div v-if="item.type !== 'edit_suggestion' && getPreviewFields(item).length > 0" class="mb-4">
            <div class="bg-base-200 rounded-lg p-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <div v-for="field in getPreviewFields(item)" :key="field.label" class="flex gap-2 text-sm py-0.5">
                  <span class="font-medium opacity-70 min-w-24">{{ field.label }}:</span>
                  <span>{{ field.value }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Uploaded Images Preview -->
          <div v-if="getUploadedImages(item).length > 0" class="mb-4">
            <p class="text-sm font-medium opacity-70 mb-2">Uploaded Files</p>
            <div class="flex flex-wrap gap-3">
              <div v-for="(img, idx) in getUploadedImages(item)" :key="idx" class="relative">
                <a :href="img.url" target="_blank" rel="noopener">
                  <img
                    :src="img.url"
                    :alt="`Upload ${idx + 1}`"
                    class="h-24 w-24 object-cover rounded-lg border border-base-300 hover:opacity-80 transition-opacity"
                  />
                </a>
                <span
                  v-if="img.category !== 'general'"
                  class="badge badge-soft badge-neutral badge-xs absolute bottom-1 left-1"
                >
                  {{ img.category }}
                </span>
              </div>
            </div>
          </div>

          <!-- Edit Suggestion Diff Table -->
          <div v-if="item.type === 'edit_suggestion' && getEditChanges(item).length > 0" class="mb-4">
            <div class="overflow-x-auto">
              <table class="table table-sm w-full border border-base-300 rounded-lg overflow-hidden">
                <thead>
                  <tr class="bg-base-200">
                    <th class="text-left p-2 font-medium">Field</th>
                    <th class="text-left p-2 font-medium">Current</th>
                    <th class="text-left p-2 font-medium">Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="change in getEditChanges(item)" :key="change.field" class="border-t border-base-300">
                    <td class="p-2 font-medium">{{ formatFieldName(change.field) }}</td>
                    <td class="p-2 bg-error/10 text-error">
                      {{ formatDiffValue(change.from, change.field, item) }}
                    </td>
                    <td class="p-2 bg-success/10 text-success">
                      {{ formatDiffValue(change.to, change.field, item) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Edit Suggestion Reason -->
          <div v-if="item.type === 'edit_suggestion' && item.data?.reason" class="mb-4">
            <div class="bg-info/5 border border-info/20 rounded-lg p-3">
              <p class="text-sm font-medium opacity-70 mb-1">
                <i class="fad fa-comment-dots mr-1"></i>
                Reason for Change
              </p>
              <p class="text-sm">{{ item.data.reason }}</p>
            </div>
          </div>

          <!-- Edit Suggestion with no changes but has preview fields -->
          <div
            v-if="
              item.type === 'edit_suggestion' && getEditChanges(item).length === 0 && getPreviewFields(item).length > 0
            "
            class="mb-4"
          >
            <div class="bg-base-200 rounded-lg p-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <div v-for="field in getPreviewFields(item)" :key="field.label" class="flex gap-2 text-sm py-0.5">
                  <span class="font-medium opacity-70 min-w-24">{{ field.label }}:</span>
                  <span>{{ field.value }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Reviewer Notes (if already reviewed) -->
          <div v-if="item.reviewerNotes" class="mb-4">
            <div role="alert" class="alert alert-info">
              <i class="fas fa-circle-info"></i>
              <span>Reviewer Notes: {{ item.reviewerNotes }}</span>
            </div>
          </div>

          <!-- Action Buttons (only for pending items) -->
          <div v-if="item.status === 'pending'" class="card-actions justify-end pt-2 border-t border-base-300">
            <button
              type="button"
              class="btn btn-success btn-sm"
              :disabled="isProcessing"
              @click="openApproveModal(item)"
            >
              <i class="fa-solid fa-check mr-1.5"></i>
              Approve
            </button>
            <button type="button" class="btn btn-error btn-sm" :disabled="isProcessing" @click="openRejectModal(item)">
              <i class="fa-solid fa-times mr-1.5"></i>
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Approve Modal -->
    <dialog class="modal" :class="{ 'modal-open': showApproveModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Approve Submission</h3>

        <!-- Submission Summary -->
        <div v-if="selectedItem" class="bg-base-200 p-4 rounded-lg mb-4">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="badge badge-soft badge-sm" :class="`badge-${getSubmissionTypeBadgeColor(selectedItem.type)}`">
              {{ getSubmissionTypeLabel(selectedItem.type) }}
            </span>
            <span
              class="badge badge-soft badge-sm"
              :class="`badge-${getTargetTypeBadgeColor(selectedItem.targetType)}`"
            >
              {{ getTargetTypeLabel(selectedItem.targetType) }}
            </span>
          </div>
          <p class="text-sm"><strong>Submitted by:</strong> {{ selectedItem.submitterName }}</p>
          <p class="text-sm"><strong>Date:</strong> {{ formatDate(selectedItem.createdAt) }}</p>
          <div v-if="getPreviewFields(selectedItem).length > 0" class="mt-2 pt-2 border-t border-base-300">
            <div v-for="field in getPreviewFields(selectedItem)" :key="field.label" class="text-sm">
              <strong>{{ field.label }}:</strong> {{ field.value }}
            </div>
          </div>
          <div v-if="getUploadedImages(selectedItem).length > 0" class="mt-2 pt-2 border-t border-base-300">
            <p class="text-xs font-medium opacity-70 mb-1">Uploaded Files</p>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="(img, idx) in getUploadedImages(selectedItem)"
                :key="idx"
                :src="img.url"
                :alt="`Upload ${idx + 1}`"
                class="h-16 w-16 object-cover rounded border border-base-300"
              />
            </div>
          </div>
        </div>

        <!-- Reviewer Notes -->
        <label class="form-control w-full mb-4">
          <div class="label">
            <span class="label-text">Reviewer Notes</span>
          </div>
          <textarea
            v-model="reviewerNotes"
            class="textarea textarea-bordered w-full"
            placeholder="Optional notes for the submitter..."
            rows="3"
          ></textarea>
        </label>

        <!-- Actions -->
        <div class="modal-action">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="closeApproveModal">
            Cancel
          </button>
          <button type="button" class="btn btn-success" :disabled="isProcessing" @click="approveItem">
            <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
            Approve
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeApproveModal"></div>
    </dialog>

    <!-- Reject Modal -->
    <dialog class="modal" :class="{ 'modal-open': showRejectModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Reject Submission</h3>

        <!-- Submission Summary -->
        <div v-if="selectedItem" class="bg-base-200 p-4 rounded-lg mb-4">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="badge badge-soft badge-sm" :class="`badge-${getSubmissionTypeBadgeColor(selectedItem.type)}`">
              {{ getSubmissionTypeLabel(selectedItem.type) }}
            </span>
            <span
              class="badge badge-soft badge-sm"
              :class="`badge-${getTargetTypeBadgeColor(selectedItem.targetType)}`"
            >
              {{ getTargetTypeLabel(selectedItem.targetType) }}
            </span>
          </div>
          <p class="text-sm"><strong>Submitted by:</strong> {{ selectedItem.submitterName }}</p>
          <p class="text-sm"><strong>Date:</strong> {{ formatDate(selectedItem.createdAt) }}</p>
          <div v-if="getPreviewFields(selectedItem).length > 0" class="mt-2 pt-2 border-t border-base-300">
            <div v-for="field in getPreviewFields(selectedItem)" :key="field.label" class="text-sm">
              <strong>{{ field.label }}:</strong> {{ field.value }}
            </div>
          </div>
          <div v-if="getUploadedImages(selectedItem).length > 0" class="mt-2 pt-2 border-t border-base-300">
            <p class="text-xs font-medium opacity-70 mb-1">Uploaded Files</p>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="(img, idx) in getUploadedImages(selectedItem)"
                :key="idx"
                :src="img.url"
                :alt="`Upload ${idx + 1}`"
                class="h-16 w-16 object-cover rounded border border-base-300"
              />
            </div>
          </div>
        </div>

        <!-- Reviewer Notes -->
        <label class="form-control w-full mb-4">
          <div class="label">
            <span class="label-text">Reviewer Notes</span>
          </div>
          <textarea
            v-model="reviewerNotes"
            class="textarea textarea-bordered w-full"
            placeholder="Reason for rejection (visible to submitter)..."
            rows="3"
          ></textarea>
        </label>

        <!-- Actions -->
        <div class="modal-action">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="closeRejectModal">
            Cancel
          </button>
          <button type="button" class="btn btn-error" :disabled="isProcessing" @click="rejectItem">
            <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
            Reject
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeRejectModal"></div>
    </dialog>
  </div>
</template>
