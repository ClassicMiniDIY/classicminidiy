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

  // Fetch data
  const {
    data: items,
    status: fetchStatus,
    refresh: refreshData,
  } = await useFetch<QueueItem[]>('/api/admin/queue/list', {
    query: queryParams,
    watch: [queryParams],
    default: () => [],
  });

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

  const formatFieldName = (field: string): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  };

  const formatDiffValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
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
      await $fetch('/api/admin/queue/approve', {
        method: 'POST',
        body: {
          id: itemToApprove.id,
          reviewerNotes: reviewerNotes.value || null,
        },
      });

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
      await $fetch('/api/admin/queue/reject', {
        method: 'POST',
        body: {
          id: itemToReject.id,
          reviewerNotes: reviewerNotes.value || null,
        },
      });

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
      <h1 class="text-2xl font-bold">Moderation Queue</h1>
      <UButton color="primary" @click="refresh" :disabled="isLoading">
        <span v-if="isLoading" class="fa-solid fa-refresh fa-spin"></span>
        <i v-else class="fa-solid fa-refresh mr-2"></i>
        {{ isLoading ? 'Loading...' : 'Refresh' }}
      </UButton>
    </div>

    <!-- Filter Bar -->
    <div class="space-y-4 mb-8">
      <!-- Target Type Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium opacity-70 mr-1">Type:</span>
        <UButton
          v-for="filter in targetTypeFilters"
          :key="filter.label"
          size="sm"
          :variant="activeTargetType === filter.value ? 'solid' : 'ghost'"
          :color="activeTargetType === filter.value ? 'primary' : 'neutral'"
          @click="activeTargetType = filter.value"
        >
          <i :class="filter.icon" class="mr-1.5"></i>
          {{ filter.label }}
        </UButton>
      </div>

      <!-- Status Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium opacity-70 mr-1">Status:</span>
        <UButton
          v-for="filter in statusFilters"
          :key="filter.value"
          size="xs"
          :variant="activeStatus === filter.value ? 'solid' : 'soft'"
          :color="activeStatus === filter.value ? 'primary' : 'neutral'"
          @click="activeStatus = filter.value"
        >
          {{ filter.label }}
        </UButton>
      </div>
    </div>

    <!-- Error Message -->
    <UAlert v-if="errorMessage" color="error" icon="i-fa6-solid-circle-xmark" :title="errorMessage" class="mb-6" />

    <!-- Loading State -->
    <div v-if="fetchStatus === 'pending'" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Empty State -->
    <UAlert
      v-else-if="!items?.length"
      color="info"
      icon="i-fa6-solid-circle-info"
      title="No submissions found matching the current filters."
    />

    <!-- Submission Cards -->
    <div v-else class="space-y-4">
      <UCard v-for="item in items" :key="item.id" class="hover:shadow-lg transition-shadow">
        <!-- Card Header Row -->
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <UBadge :color="getSubmissionTypeBadgeColor(item.type)" variant="subtle" size="sm">
            {{ getSubmissionTypeLabel(item.type) }}
          </UBadge>
          <UBadge :color="getTargetTypeBadgeColor(item.targetType)" variant="subtle" size="sm">
            {{ getTargetTypeLabel(item.targetType) }}
          </UBadge>
          <UBadge :color="getStatusBadgeColor(item.status)" size="sm">
            {{ getStatusLabel(item.status) }}
          </UBadge>
        </div>

        <!-- Submitter Info -->
        <div class="flex items-center gap-3 mb-4">
          <!-- Avatar -->
          <div
            v-if="item.submitterAvatar"
            class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
          >
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
            <UBadge
              :color="getTrustLevelBadgeColor(item.submitterTrustLevel)"
              variant="subtle"
              size="xs"
            >
              {{ getTrustLevelLabel(item.submitterTrustLevel) }}
            </UBadge>
            <span class="opacity-60">{{ formatDate(item.createdAt) }}</span>
          </div>
        </div>

        <!-- Data Preview (for new_item and new_collection) -->
        <div v-if="item.type !== 'edit_suggestion' && getPreviewFields(item).length > 0" class="mb-4">
          <div class="bg-muted rounded-lg p-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <div v-for="field in getPreviewFields(item)" :key="field.label" class="flex gap-2 text-sm py-0.5">
                <span class="font-medium opacity-70 min-w-24">{{ field.label }}:</span>
                <span>{{ field.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Suggestion Diff Table -->
        <div v-if="item.type === 'edit_suggestion' && getEditChanges(item).length > 0" class="mb-4">
          <div class="overflow-x-auto">
            <table class="w-full text-sm border border-default rounded-lg overflow-hidden">
              <thead>
                <tr class="bg-muted">
                  <th class="text-left p-2 font-medium">Field</th>
                  <th class="text-left p-2 font-medium">Current</th>
                  <th class="text-left p-2 font-medium">Proposed</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="change in getEditChanges(item)"
                  :key="change.field"
                  class="border-t border-default"
                >
                  <td class="p-2 font-medium">{{ formatFieldName(change.field) }}</td>
                  <td class="p-2 bg-error/10 text-error-700 dark:text-error-300">
                    {{ formatDiffValue(change.from) }}
                  </td>
                  <td class="p-2 bg-success/10 text-success-700 dark:text-success-300">
                    {{ formatDiffValue(change.to) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Edit Suggestion with no changes but has preview fields -->
        <div v-if="item.type === 'edit_suggestion' && getEditChanges(item).length === 0 && getPreviewFields(item).length > 0" class="mb-4">
          <div class="bg-muted rounded-lg p-3">
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
          <UAlert
            color="info"
            icon="i-fa6-solid-circle-info"
            :title="`Reviewer Notes: ${item.reviewerNotes}`"
          />
        </div>

        <!-- Action Buttons (only for pending items) -->
        <div v-if="item.status === 'pending'" class="flex justify-end gap-2 pt-2 border-t border-default">
          <UButton
            color="success"
            size="sm"
            @click="openApproveModal(item)"
            :disabled="isProcessing"
          >
            <i class="fa-solid fa-check mr-1.5"></i>
            Approve
          </UButton>
          <UButton
            color="error"
            size="sm"
            @click="openRejectModal(item)"
            :disabled="isProcessing"
          >
            <i class="fa-solid fa-times mr-1.5"></i>
            Reject
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Approve Modal -->
    <UModal v-model:open="showApproveModal">
      <template #content>
        <div class="p-6">
          <h3 class="font-bold text-lg mb-4">Approve Submission</h3>

          <!-- Submission Summary -->
          <div v-if="selectedItem" class="bg-muted p-4 rounded-lg mb-4">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <UBadge :color="getSubmissionTypeBadgeColor(selectedItem.type)" variant="subtle" size="sm">
                {{ getSubmissionTypeLabel(selectedItem.type) }}
              </UBadge>
              <UBadge :color="getTargetTypeBadgeColor(selectedItem.targetType)" variant="subtle" size="sm">
                {{ getTargetTypeLabel(selectedItem.targetType) }}
              </UBadge>
            </div>
            <p class="text-sm"><strong>Submitted by:</strong> {{ selectedItem.submitterName }}</p>
            <p class="text-sm"><strong>Date:</strong> {{ formatDate(selectedItem.createdAt) }}</p>
            <div v-if="getPreviewFields(selectedItem).length > 0" class="mt-2 pt-2 border-t border-default">
              <div v-for="field in getPreviewFields(selectedItem)" :key="field.label" class="text-sm">
                <strong>{{ field.label }}:</strong> {{ field.value }}
              </div>
            </div>
          </div>

          <!-- Reviewer Notes -->
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Reviewer Notes</label>
            <UTextarea
              v-model="reviewerNotes"
              placeholder="Optional notes for the submitter..."
              :rows="3"
              class="w-full"
            />
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="closeApproveModal" :disabled="isProcessing">
              Cancel
            </UButton>
            <UButton color="success" @click="approveItem" :disabled="isProcessing" :loading="isProcessing">
              Approve
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Reject Modal -->
    <UModal v-model:open="showRejectModal">
      <template #content>
        <div class="p-6">
          <h3 class="font-bold text-lg mb-4">Reject Submission</h3>

          <!-- Submission Summary -->
          <div v-if="selectedItem" class="bg-muted p-4 rounded-lg mb-4">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <UBadge :color="getSubmissionTypeBadgeColor(selectedItem.type)" variant="subtle" size="sm">
                {{ getSubmissionTypeLabel(selectedItem.type) }}
              </UBadge>
              <UBadge :color="getTargetTypeBadgeColor(selectedItem.targetType)" variant="subtle" size="sm">
                {{ getTargetTypeLabel(selectedItem.targetType) }}
              </UBadge>
            </div>
            <p class="text-sm"><strong>Submitted by:</strong> {{ selectedItem.submitterName }}</p>
            <p class="text-sm"><strong>Date:</strong> {{ formatDate(selectedItem.createdAt) }}</p>
            <div v-if="getPreviewFields(selectedItem).length > 0" class="mt-2 pt-2 border-t border-default">
              <div v-for="field in getPreviewFields(selectedItem)" :key="field.label" class="text-sm">
                <strong>{{ field.label }}:</strong> {{ field.value }}
              </div>
            </div>
          </div>

          <!-- Reviewer Notes -->
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Reviewer Notes</label>
            <UTextarea
              v-model="reviewerNotes"
              placeholder="Reason for rejection (visible to submitter)..."
              :rows="3"
              class="w-full"
            />
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="closeRejectModal" :disabled="isProcessing">
              Cancel
            </UButton>
            <UButton color="error" @click="rejectItem" :disabled="isProcessing" :loading="isProcessing">
              Reject
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
