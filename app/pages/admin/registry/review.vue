<script setup lang="ts">
  import type { RegistryItem } from '../../../../data/models/registry';
  import { RegistryItemStatus } from '../../../../data/models/registry';
  import { BREADCRUMB_VERSIONS } from '../../../../data/models/generic';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Admin - Registry Review',
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
  const selectedItem = ref<RegistryItem | null>(null);
  const showDeleteDialog = ref(false);

  // Editing state
  const editingItems = ref<Set<string>>(new Set());
  const editedData = ref<Map<string, RegistryItem>>(new Map());

  // API Data
  const {
    data: registryItems,
    status: fetchStatus,
    refresh: refreshData,
  } = await useAdminFetch<RegistryItem[]>('/api/registry/queue/list');

  // Table Configuration
  const tableHeaders: TableHeader[] = [
    { title: 'Model', value: 'model', sortable: true },
    { title: 'Body Number', value: 'bodyNum', sortable: true },
    { title: 'Trim', value: 'trim' },
    { title: 'Name', value: 'submittedBy' },
    { title: 'Email', value: 'submittedByEmail' },
    { title: 'Year', value: 'year', align: 'center' },
    { title: 'Status', value: 'status', align: 'center' },
    { title: 'Actions', key: 'actions', align: 'center', width: '200px' },
  ];

  // Computed
  const isLoading = computed(() => fetchStatus.value === 'pending' || isProcessing.value);

  // Helper function to check if item is pending
  const isPending = (item: RegistryItem) => !item.status || item.status === RegistryItemStatus.PENDING;

  // Helper function to get status display text
  const getStatusDisplay = (item: RegistryItem) => {
    if (!item.status || item.status === RegistryItemStatus.PENDING) return 'P - Pending';
    if (item.status === RegistryItemStatus.APPROVED) return 'A - Approved';
    if (item.status === RegistryItemStatus.REJECTED) return 'R - Rejected';
    return item.status;
  };

  // Editing functions
  const startEditing = (item: RegistryItem) => {
    editingItems.value.add(item.uniqueId);
    editedData.value.set(item.uniqueId, { ...item });
  };

  const cancelEditing = (item: RegistryItem) => {
    editingItems.value.delete(item.uniqueId);
    editedData.value.delete(item.uniqueId);
  };

  const saveEditing = (item: RegistryItem) => {
    const editedItem = editedData.value.get(item.uniqueId);
    if (editedItem && registryItems.value) {
      const index = registryItems.value.findIndex((i) => i.uniqueId === item.uniqueId);
      if (index !== -1) {
        registryItems.value[index] = { ...editedItem };
      }
    }
    editingItems.value.delete(item.uniqueId);
    editedData.value.delete(item.uniqueId);
  };

  const isEditing = (item: RegistryItem) => editingItems.value.has(item.uniqueId);

  const getEditedValue = (item: RegistryItem, field: keyof RegistryItem) => {
    const editedItem = editedData.value.get(item.uniqueId);
    return editedItem ? editedItem[field] : item[field];
  };

  const updateEditedValue = (item: RegistryItem, field: keyof RegistryItem, value: any) => {
    const editedItem = editedData.value.get(item.uniqueId);
    if (editedItem) {
      editedItem[field] = value;
    }
  };

  const inputValue = (event: Event): string => (event.target as HTMLInputElement).value;
  const inputValueInt = (event: Event): number => parseInt(inputValue(event)) || 0;

  // Methods
  async function refresh() {
    if (isLoading.value) return;
    try {
      await refreshData();
      errorMessage.value = '';
    } catch (error) {
      errorMessage.value = 'Failed to refresh data. Please try again.';
      console.error('Refresh error:', error);
    }
  }

  async function approveItem(item: RegistryItem) {
    isProcessing.value = true;
    processingItemId.value = item.uniqueId;
    errorMessage.value = '';

    try {
      // Use edited data if available, otherwise use original item
      const dataToSave = editedData.value.get(item.uniqueId) || item;

      const { error } = await useAdminFetch('/api/registry/queue/save', {
        method: 'POST',
        body: {
          uuid: item.uniqueId,
          details: dataToSave,
        },
      });

      if (error.value) {
        throw new Error(error.value.data?.message || 'Failed to approve item');
      }

      // Clean up editing state
      editingItems.value.delete(item.uniqueId);
      editedData.value.delete(item.uniqueId);

      // Update item status to approved
      if (registryItems.value) {
        const index = registryItems.value.findIndex((i) => i.uniqueId === item.uniqueId);
        if (index !== -1 && registryItems.value[index]) {
          registryItems.value[index].status = RegistryItemStatus.APPROVED;
        }
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to approve item';
      console.error('Approve error:', error);
    } finally {
      isProcessing.value = false;
      processingItemId.value = null;
    }
  }

  function confirmDelete(item: RegistryItem) {
    selectedItem.value = item;
    showDeleteDialog.value = true;
  }

  async function deleteItem() {
    if (!selectedItem.value) {
      showDeleteDialog.value = false;
      return;
    }

    isProcessing.value = true;
    processingItemId.value = selectedItem.value.uniqueId;
    errorMessage.value = '';

    try {
      const { error } = await useAdminFetch('/api/registry/queue/reject', {
        method: 'POST',
        body: {
          uuid: selectedItem.value.uniqueId,
          details: selectedItem.value,
        },
      });

      if (error.value) {
        throw new Error(error.value.data?.message || 'Failed to delete item');
      }

      // Update item status to rejected
      if (registryItems.value && selectedItem.value) {
        const index = registryItems.value.findIndex((i) => i.uniqueId === selectedItem.value?.uniqueId);
        if (index !== -1 && registryItems.value[index]) {
          registryItems.value[index].status = RegistryItemStatus.REJECTED;
        }
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to delete item';
      console.error('Delete error:', error);
    } finally {
      isProcessing.value = false;
      showDeleteDialog.value = false;
      processingItemId.value = null;
      selectedItem.value = null;
    }
  }
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <div class="mb-6">
      <Breadcrumb page="Registry Review" :version="BREADCRUMB_VERSIONS.ADMIN" />
    </div>

    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Registry Queue</h1>
      <button type="button" class="btn btn-primary" :disabled="isLoading" @click="refresh">
        <i v-if="isLoading" class="fa-solid fa-refresh fa-spin"></i>
        <i v-else class="fa-solid fa-refresh mr-2"></i>
        {{ isLoading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>

    <!-- Admin authentication handled by login system -->

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
    <div v-else-if="!registryItems?.length" role="alert" class="alert alert-info">
      <i class="fas fa-circle-info"></i>
      <span>No registry items in the queue.</span>
    </div>

    <!-- Registry Items Table -->
    <div v-else class="overflow-x-auto">
      <table class="table table-zebra w-full text-sm">
        <thead>
          <tr>
            <th
              v-for="header in tableHeaders"
              :key="header.title"
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
          <tr v-for="item in registryItems" :key="item.uniqueId">
            <!-- Model -->
            <td>
              <input
                v-if="isEditing(item)"
                type="text"
                class="input input-bordered input-sm w-full"
                :value="getEditedValue(item, 'model') as string"
                @input="updateEditedValue(item, 'model', inputValue($event))"
              />
              <span v-else>{{ item.model || '-' }}</span>
            </td>

            <!-- Body Number -->
            <td>
              <input
                v-if="isEditing(item)"
                type="text"
                class="input input-bordered input-sm w-full"
                :value="getEditedValue(item, 'bodyNum') as string"
                @input="updateEditedValue(item, 'bodyNum', inputValue($event))"
              />
              <span v-else>{{ item.bodyNum || '-' }}</span>
            </td>

            <!-- Trim -->
            <td>
              <input
                v-if="isEditing(item)"
                type="text"
                class="input input-bordered input-sm w-full"
                :value="getEditedValue(item, 'trim') as string"
                @input="updateEditedValue(item, 'trim', inputValue($event))"
              />
              <span v-else>{{ item.trim || '-' }}</span>
            </td>

            <!-- Name -->
            <td>
              <input
                v-if="isEditing(item)"
                type="text"
                class="input input-bordered input-sm w-full"
                :value="getEditedValue(item, 'submittedBy') as string"
                @input="updateEditedValue(item, 'submittedBy', inputValue($event))"
              />
              <span v-else>{{ item.submittedBy || '-' }}</span>
            </td>

            <!-- Email -->
            <td>
              <input
                v-if="isEditing(item)"
                type="email"
                class="input input-bordered input-sm w-full"
                :value="getEditedValue(item, 'submittedByEmail') as string"
                @input="updateEditedValue(item, 'submittedByEmail', inputValue($event))"
              />
              <span v-else>{{ item.submittedByEmail || '-' }}</span>
            </td>

            <!-- Year -->
            <td class="text-center">
              <input
                v-if="isEditing(item)"
                type="number"
                class="input input-bordered input-sm w-20 text-center"
                :value="getEditedValue(item, 'year') as number"
                min="1959"
                max="2024"
                @input="updateEditedValue(item, 'year', inputValueInt($event))"
              />
              <span v-else>{{ item.year || '-' }}</span>
            </td>

            <!-- Status -->
            <td class="text-center">
              <span
                class="badge"
                :class="`badge-${
                  isPending(item) ? 'warning' : item.status === RegistryItemStatus.APPROVED ? 'success' : 'error'
                }`"
              >
                {{ getStatusDisplay(item) }}
              </span>
            </td>

            <!-- Actions -->
            <td class="space-x-1">
              <template v-if="isPending(item)">
                <template v-if="isEditing(item)">
                  <!-- Edit mode buttons -->
                  <button
                    type="button"
                    class="btn btn-success btn-xs"
                    :disabled="isProcessing"
                    @click="saveEditing(item)"
                  >
                    <i class="fa-solid fa-check"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="isProcessing"
                    @click="cancelEditing(item)"
                  >
                    <i class="fa-solid fa-times"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-xs"
                    :disabled="isProcessing"
                    @click="approveItem(item)"
                  >
                    <i
                      v-if="processingItemId === item.uniqueId && isProcessing"
                      class="fas fa-spinner fa-spin"
                    ></i>
                    <i v-else class="fa-solid fa-check-double"></i>
                  </button>
                </template>
                <template v-else>
                  <!-- View mode buttons -->
                  <button
                    type="button"
                    class="btn btn-info btn-xs"
                    :disabled="isProcessing"
                    @click="startEditing(item)"
                  >
                    <i class="fa-solid fa-edit"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-success btn-xs"
                    :disabled="isProcessing"
                    @click="approveItem(item)"
                  >
                    <i
                      v-if="processingItemId === item.uniqueId && isProcessing"
                      class="fas fa-spinner fa-spin"
                    ></i>
                    <i v-else class="fa-solid fa-check"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-error btn-xs"
                    :disabled="isProcessing"
                    @click="confirmDelete(item)"
                  >
                    <i class="fa-solid fa-times"></i>
                  </button>
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
    <dialog class="modal" :class="{ 'modal-open': showDeleteDialog }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Confirm Rejection</h3>
        <p class="mb-4">Are you sure you want to reject this registry item? This action cannot be undone.</p>
        <div class="modal-action">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="showDeleteDialog = false">
            Cancel
          </button>
          <button type="button" class="btn btn-error" :disabled="isProcessing" @click="deleteItem">
            <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
            Reject Item
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showDeleteDialog = false"></div>
    </dialog>
  </div>
</template>
