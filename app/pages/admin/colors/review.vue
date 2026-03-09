<script setup lang="ts">
  import { nextTick } from 'vue';
  import type { ColorQueueItem } from '../../../../data/models/colors';
  import { ColorItemStatus } from '../../../../data/models/colors';
  import { BREADCRUMB_VERSIONS } from '../../../../data/models/generic';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Admin - Colors Review',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  interface TableHeader {
    title: string;
    value?: string;
    key?: string;
    sortable?: boolean;
    align?: 'start' | 'center' | 'end';
    width?: string;
  }

  // State
  const errorMessage = ref('');
  const isProcessing = ref(false);
  const processingItemId = ref<string | null>(null);
  const selectedItem = ref<ColorQueueItem | null>(null);
  const showDeleteDialog = ref(false);

  // Editing state - using reactive objects instead of Set/Map for proper reactivity
  const editingItems = reactive<Record<string, boolean>>({});
  const editedData = reactive<Record<string, ColorQueueItem>>({});

  // API Data
  const {
    data: colorItems,
    status: fetchStatus,
    refresh: refreshData,
  } = await useAdminFetch<ColorQueueItem[]>('/api/colors/queue/list');

  // Table Configuration
  const tableHeaders: TableHeader[] = [
    { title: 'Images', value: 'uploadedFiles' },
    { title: 'Name', value: 'name', sortable: true },
    { title: 'Code', value: 'code', sortable: true },
    { title: 'Short Code', value: 'shortCode' },
    { title: 'PPG Code', value: 'ditzlerPpgCode' },
    { title: 'Dulux Code', value: 'duluxCode' },
    { title: 'Years', value: 'years' },
    { title: 'Submitted By', value: 'submittedBy' },
    { title: 'Email', value: 'submittedByEmail' },
    { title: 'Status', value: 'status', align: 'center' },
    { title: 'Actions', key: 'actions', align: 'center', width: '200px' },
  ];

  // Computed
  const isLoading = computed(() => fetchStatus.value === 'pending' || isProcessing.value);

  // Helper to extract uploaded images (handles both string[] and { url, category }[] formats)
  const getUploadedImages = (item: ColorQueueItem): { url: string; category: string }[] => {
    const files = (item as any).uploadedFiles;
    if (!Array.isArray(files)) return [];
    return files.map((f: any) =>
      typeof f === 'string' ? { url: f, category: 'general' } : { url: f.url, category: f.category || 'general' }
    );
  };

  // Helper function to check if item is pending
  const isPending = (item: ColorQueueItem) => !item.status || item.status === ColorItemStatus.PENDING;

  // Helper function to get status display text
  const getStatusDisplay = (item: ColorQueueItem) => {
    if (!item.status || item.status === ColorItemStatus.PENDING) return 'P - Pending';
    if (item.status === ColorItemStatus.APPROVED) return 'A - Approved';
    if (item.status === ColorItemStatus.REJECTED) return 'R - Rejected';
    return item.status;
  };

  // Helper function to get status badge color
  const getStatusBadgeColor = (item: ColorQueueItem) => {
    if (!item.status || item.status === ColorItemStatus.PENDING) return 'warning';
    if (item.status === ColorItemStatus.APPROVED) return 'success';
    if (item.status === ColorItemStatus.REJECTED) return 'error';
    return 'neutral';
  };

  // Editing functions
  const startEditing = (item: ColorQueueItem) => {
    editingItems[item.id] = true;
    editedData[item.id] = { ...item };
  };

  const cancelEditing = (item: ColorQueueItem) => {
    delete editingItems[item.id];
    delete editedData[item.id];
  };

  const saveEditing = (item: ColorQueueItem) => {
    const editedItem = editedData[item.id];
    if (editedItem && colorItems.value) {
      const index = colorItems.value.findIndex((i) => i.id === item.id);
      if (index !== -1) {
        colorItems.value[index] = { ...editedItem };
      }
    }
    delete editingItems[item.id];
    delete editedData[item.id];
  };

  const isEditing = (item: ColorQueueItem) => !!editingItems[item.id];

  const getEditedValue = (item: ColorQueueItem, field: keyof ColorQueueItem) => {
    const editedItem = editedData[item.id];
    return editedItem ? editedItem[field] : item[field];
  };

  const updateEditedValue = <K extends keyof ColorQueueItem>(
    item: ColorQueueItem,
    field: K,
    value: ColorQueueItem[K]
  ) => {
    const editedItem = editedData[item.id];
    if (editedItem) {
      editedItem[field] = value;
    }
  };

  // Methods
  async function refresh() {
    if (isLoading.value) return;
    try {
      await refreshData();
      errorMessage.value = '';
    } catch (error) {
      errorMessage.value = 'Failed to refresh data. Please try again.';
    }
  }

  async function approveItem(item: ColorQueueItem) {
    isProcessing.value = true;
    processingItemId.value = item.id;
    errorMessage.value = '';

    try {
      // Use edited data if available, otherwise use original item
      const dataToSave = editedData[item.id] || item;

      const { error } = await useAdminFetch('/api/colors/queue/save', {
        method: 'POST',
        body: {
          uuid: item.id,
          details: dataToSave,
        },
      });

      if (error.value) {
        throw new Error(error.value.data?.message || error.value.statusMessage || 'Failed to approve item');
      }

      // Clean up editing state
      delete editingItems[item.id];
      delete editedData[item.id];

      // Update item status to approved
      if (colorItems.value) {
        const index = colorItems.value.findIndex((i) => i.id === item.id);
        if (index !== -1 && colorItems.value[index]) {
          colorItems.value[index].status = ColorItemStatus.APPROVED;
        }
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to approve item';
    } finally {
      isProcessing.value = false;
      processingItemId.value = null;
    }
  }

  function confirmDelete(item: ColorQueueItem) {
    selectedItem.value = item;
    showDeleteDialog.value = true;
  }

  async function closeDeleteDialog() {
    showDeleteDialog.value = false;
    await nextTick();
    selectedItem.value = null;
  }

  async function deleteItem() {
    if (!selectedItem.value) {
      showDeleteDialog.value = false;
      return;
    }

    const itemToReject = selectedItem.value;
    isProcessing.value = true;
    processingItemId.value = itemToReject.id;
    errorMessage.value = '';

    try {
      await $adminFetch('/api/colors/queue/reject', {
        method: 'POST',
        body: {
          uuid: itemToReject.id,
          details: itemToReject,
        },
      });

      // Update item status to rejected
      if (colorItems.value) {
        const index = colorItems.value.findIndex((i) => i.id === itemToReject.id);
        if (index !== -1 && colorItems.value[index]) {
          colorItems.value[index].status = ColorItemStatus.REJECTED;
        }
      }

      // Close dialog after successful rejection
      showDeleteDialog.value = false;
      await nextTick();
      selectedItem.value = null;
    } catch (error: any) {
      errorMessage.value = error?.data?.message || error?.message || 'Failed to reject item';
    } finally {
      isProcessing.value = false;
      processingItemId.value = null;
    }
  }
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <div class="mb-6">
      <Breadcrumb page="Colors Review" :version="BREADCRUMB_VERSIONS.ADMIN" />
    </div>

    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Colors Queue</h1>
      <UButton color="primary" @click="refresh" :disabled="isLoading">
        <span v-if="isLoading" class="fa-solid fa-refresh fa-spin"></span>
        <i v-else class="fa-solid fa-refresh mr-2"></i>
        {{ isLoading ? 'Loading...' : 'Refresh' }}
      </UButton>
    </div>

    <!-- Error Message -->
    <UAlert v-if="errorMessage" color="error" icon="i-fa6-solid-circle-xmark" :title="errorMessage" class="mb-6" />

    <!-- Loading State -->
    <div v-if="fetchStatus === 'pending'" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Empty State -->
    <UAlert
      v-else-if="!colorItems?.length"
      color="info"
      icon="i-fa6-solid-circle-info"
      title="No color submissions in the queue."
    />

    <!-- Color Items Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th
              v-for="header in tableHeaders"
              :key="header.title"
              class="text-left p-2 font-medium bg-muted"
              :class="{
                'text-center': header.align === 'center',
                'text-right': header.align === 'end',
                'w-50': header.width === '200px',
              }"
            >
              {{ header.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in colorItems"
            :key="item.id"
            class="border-b border-default last:border-0 hover:bg-muted transition-colors"
          >
            <!-- Images -->
            <td class="p-2">
              <div v-if="getUploadedImages(item).length > 0" class="flex gap-1">
                <a
                  v-for="(img, idx) in getUploadedImages(item)"
                  :key="idx"
                  :href="img.url"
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    :src="img.url"
                    :alt="`Upload ${idx + 1}`"
                    class="h-12 w-12 object-cover rounded border border-default hover:opacity-80 transition-opacity"
                  />
                </a>
              </div>
              <span v-else class="text-xs opacity-50">No images</span>
            </td>

            <!-- Name -->
            <td class="p-2">
              <UInput
                v-if="isEditing(item)"
                type="text"
                size="sm"
                class="w-full"
                aria-label="Color name"
                :model-value="getEditedValue(item, 'name') as string"
                @update:model-value="updateEditedValue(item, 'name', $event)"
              />
              <span v-else>{{ item.name || '-' }}</span>
            </td>

            <!-- Code -->
            <td class="p-2">
              <UInput
                v-if="isEditing(item)"
                type="text"
                size="sm"
                class="w-full"
                aria-label="BMC code"
                :model-value="getEditedValue(item, 'code') as string"
                @update:model-value="updateEditedValue(item, 'code', $event)"
              />
              <span v-else>{{ item.code || '-' }}</span>
            </td>

            <!-- Short Code -->
            <td class="p-2">
              <UInput
                v-if="isEditing(item)"
                type="text"
                size="sm"
                class="w-full"
                aria-label="Short code"
                :model-value="getEditedValue(item, 'shortCode') as string"
                @update:model-value="updateEditedValue(item, 'shortCode', $event)"
              />
              <span v-else>{{ item.shortCode || '-' }}</span>
            </td>

            <!-- PPG Code -->
            <td class="p-2">
              <UInput
                v-if="isEditing(item)"
                type="text"
                size="sm"
                class="w-full"
                aria-label="Ditzler/PPG code"
                :model-value="getEditedValue(item, 'ditzlerPpgCode') as string"
                @update:model-value="updateEditedValue(item, 'ditzlerPpgCode', $event)"
              />
              <span v-else>{{ item.ditzlerPpgCode || '-' }}</span>
            </td>

            <!-- Dulux Code -->
            <td class="p-2">
              <UInput
                v-if="isEditing(item)"
                type="text"
                size="sm"
                class="w-full"
                aria-label="Dulux code"
                :model-value="getEditedValue(item, 'duluxCode') as string"
                @update:model-value="updateEditedValue(item, 'duluxCode', $event)"
              />
              <span v-else>{{ item.duluxCode || '-' }}</span>
            </td>

            <!-- Years -->
            <td class="p-2">
              <UInput
                v-if="isEditing(item)"
                type="text"
                size="sm"
                class="w-full"
                aria-label="Years used"
                :model-value="getEditedValue(item, 'years') as string"
                @update:model-value="updateEditedValue(item, 'years', $event)"
              />
              <span v-else>{{ item.years || '-' }}</span>
            </td>

            <!-- Submitted By -->
            <td class="p-2">
              <span>{{ item.submittedBy || '-' }}</span>
            </td>

            <!-- Email -->
            <td class="p-2">
              <span>{{ item.submittedByEmail || '-' }}</span>
            </td>

            <!-- Status -->
            <td class="p-2 text-center">
              <UBadge :color="getStatusBadgeColor(item)">
                {{ getStatusDisplay(item) }}
              </UBadge>
            </td>

            <!-- Actions -->
            <td class="p-2 space-x-1">
              <template v-if="isPending(item)">
                <template v-if="isEditing(item)">
                  <!-- Edit mode buttons -->
                  <UButton size="xs" color="success" @click="saveEditing(item)" :disabled="isProcessing">
                    <i class="fa-solid fa-check"></i>
                  </UButton>
                  <UButton size="xs" variant="ghost" @click="cancelEditing(item)" :disabled="isProcessing">
                    <i class="fa-solid fa-times"></i>
                  </UButton>
                  <UButton
                    size="xs"
                    color="primary"
                    @click="approveItem(item)"
                    :disabled="isProcessing"
                    :loading="processingItemId === item.id && isProcessing"
                  >
                    <template #leading>
                      <i v-if="!(processingItemId === item.id && isProcessing)" class="fa-solid fa-check-double"></i>
                    </template>
                  </UButton>
                </template>
                <template v-else>
                  <!-- View mode buttons -->
                  <UButton size="xs" color="info" @click="startEditing(item)" :disabled="isProcessing">
                    <i class="fa-solid fa-edit"></i>
                  </UButton>
                  <UButton
                    size="xs"
                    color="success"
                    @click="approveItem(item)"
                    :disabled="isProcessing"
                    :loading="processingItemId === item.id && isProcessing"
                  >
                    <template #leading>
                      <i v-if="!(processingItemId === item.id && isProcessing)" class="fa-solid fa-check"></i>
                    </template>
                  </UButton>
                  <UButton size="xs" color="error" @click="confirmDelete(item)" :disabled="isProcessing">
                    <i class="fa-solid fa-times"></i>
                  </UButton>
                </template>
              </template>
              <template v-else>
                <span class="text-gray-500 text-xs">No actions available</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteDialog">
      <template #content>
        <div class="p-6">
          <h3 class="font-bold text-lg mb-4">Confirm Rejection</h3>
          <p class="mb-4">Are you sure you want to reject this color submission? This action cannot be undone.</p>
          <div v-show="selectedItem" class="bg-muted p-4 rounded-lg mb-4">
            <p><strong>Color:</strong> {{ selectedItem?.name }} ({{ selectedItem?.code }})</p>
            <p><strong>Submitted by:</strong> {{ selectedItem?.submittedBy || 'Unknown' }}</p>
            <p><strong>Email:</strong> {{ selectedItem?.submittedByEmail || 'No email provided' }}</p>
          </div>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="closeDeleteDialog" :disabled="isProcessing">Cancel</UButton>
            <UButton color="error" @click="deleteItem" :disabled="isProcessing" :loading="isProcessing">
              Reject Submission
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
