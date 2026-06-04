<script setup lang="ts">
  import type { IWheelsData, IWheelsDataReviewItem } from '../../../../data/models/wheels';
  import { WheelItemStatus } from '../../../../data/models/wheels';
  import { BREADCRUMB_VERSIONS } from '../../../../data/models/generic';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Admin - Wheels Review',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const { track } = useAnalytics();

  // State
  const errorMessage = ref('');
  const isProcessing = ref(false);
  const processingItemId = ref<string | null>(null);
  const selectedItem = ref<IWheelsDataReviewItem | null>(null);
  const showDeleteDialog = ref(false);
  const editingItems = ref(new Set<string>());
  const editedData = ref(new Map<string, Partial<IWheelsDataReviewItem>>());

  // API Data
  const {
    data: rawWheels,
    status: fetchStatus,
    refresh: refreshData,
  } = await useAdminFetch<IWheelsData[]>('/api/wheels/review/list');

  const wheelsToReview = ref<IWheelsDataReviewItem[]>([]);

  // Load wheel data
  async function loadWheelData() {
    console.log('Raw wheels from API:', rawWheels.value);
    if (!rawWheels.value) return;

    const wheels: IWheelsDataReviewItem[] = [];

    for (const wheel of rawWheels.value) {
      console.log('Processing wheel:', { uuid: wheel.uuid, name: wheel.name, newWheel: wheel.newWheel });

      // For wheels review, we want to show all wheels regardless of newWheel status
      // The newWheel check was preventing wheels from showing up
      wheels.push({
        ...wheel,
        oldWheel: wheel, // Use the wheel data itself as oldWheel for display
      });
    }

    wheelsToReview.value = wheels;
    console.log('Final wheels to review:', wheels);
  }

  async function approveItem(item: IWheelsDataReviewItem) {
    isProcessing.value = true;
    processingItemId.value = item.uuid;
    errorMessage.value = '';

    try {
      // Use edited data if available, otherwise use original item
      const dataToSave = editedData.value.get(item.uuid) || item;
      const { error } = await useAdminFetch('/api/wheels/review/save', {
        method: 'POST',
        body: {
          wheel: {
            new: dataToSave,
          },
        },
      });

      if (error.value) {
        throw new Error(error.value.data?.message || 'Failed to approve item');
      }

      // Clean up editing state
      editingItems.value.delete(item.uuid);
      editedData.value.delete(item.uuid);

      track('admin_action', { item_type: 'wheel', action: 'approve' });

      // Update status in place instead of removing
      if (wheelsToReview.value) {
        const index = wheelsToReview.value.findIndex((i) => i.uuid === item.uuid);
        if (index !== -1 && wheelsToReview.value[index]) {
          wheelsToReview.value[index].status = WheelItemStatus.APPROVED;
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

  function openDeleteDialog(item: IWheelsDataReviewItem) {
    selectedItem.value = item;
    showDeleteDialog.value = true;
  }

  // Inline editing functions
  function startEditing(item: IWheelsDataReviewItem) {
    editingItems.value.add(item.uuid);
    editedData.value.set(item.uuid, { ...item });
  }

  function cancelEditing(item: IWheelsDataReviewItem) {
    editingItems.value.delete(item.uuid);
    editedData.value.delete(item.uuid);
  }

  function saveEditing(item: IWheelsDataReviewItem) {
    const editedItem = editedData.value.get(item.uuid);
    if (editedItem && wheelsToReview.value) {
      const index = wheelsToReview.value.findIndex((i: IWheelsDataReviewItem) => i.uuid === item.uuid);
      if (index !== -1 && wheelsToReview.value[index]) {
        Object.assign(wheelsToReview.value[index], editedItem);
      }
    }
    editingItems.value.delete(item.uuid);
  }

  function updateEditedField(itemUuid: string, field: keyof IWheelsDataReviewItem, value: any) {
    const currentData = editedData.value.get(itemUuid) || {};
    editedData.value.set(itemUuid, { ...currentData, [field]: value });
  }

  function getDisplayValue(item: IWheelsDataReviewItem, field: keyof IWheelsDataReviewItem) {
    if (editingItems.value.has(item.uuid)) {
      const editedItem = editedData.value.get(item.uuid);
      return editedItem?.[field] ?? item[field];
    }
    return item[field];
  }

  function getStatusBadgeColor(status?: WheelItemStatus) {
    switch (status) {
      case WheelItemStatus.APPROVED:
        return 'success';
      case WheelItemStatus.REJECTED:
        return 'error';
      case WheelItemStatus.PENDING:
      default:
        return 'warning';
    }
  }

  function getStatusText(status?: WheelItemStatus) {
    switch (status) {
      case WheelItemStatus.APPROVED:
        return 'Approved';
      case WheelItemStatus.REJECTED:
        return 'Rejected';
      case WheelItemStatus.PENDING:
      default:
        return 'Pending';
    }
  }

  async function deleteItem() {
    if (!selectedItem.value) {
      showDeleteDialog.value = false;
      return;
    }

    isProcessing.value = true;
    processingItemId.value = selectedItem.value.uuid;
    errorMessage.value = '';

    try {
      const { error } = await useAdminFetch('/api/wheels/review/delete', {
        method: 'POST',
        body: {
          uuid: selectedItem.value.uuid,
          details: selectedItem.value,
        },
      });

      if (error.value) {
        throw new Error(error.value.data?.message || 'Failed to delete item');
      }

      track('admin_action', { item_type: 'wheel', action: 'reject' });

      // Update status to rejected instead of removing
      if (wheelsToReview.value && selectedItem.value) {
        const index = wheelsToReview.value.findIndex((i: IWheelsDataReviewItem) => i.uuid === selectedItem.value!.uuid);
        if (index !== -1 && wheelsToReview.value[index]) {
          wheelsToReview.value[index].status = WheelItemStatus.REJECTED;
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

  // Load initial data
  onMounted(() => {
    loadWheelData();
  });
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <Breadcrumb page="Wheels Review" :version="BREADCRUMB_VERSIONS.ADMIN" />

    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <span class="eyebrow">ADMIN</span>
        <h1 class="text-2xl font-bold">Wheels Review Queue</h1>
      </div>
      <button type="button" class="btn btn-primary" :disabled="fetchStatus === 'pending'" @click="() => refreshData()">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': fetchStatus === 'pending' }"></i>
        {{ fetchStatus === 'pending' ? 'Loading...' : 'Refresh' }}
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
    <div v-else-if="!wheelsToReview?.length" role="alert" class="alert alert-info">
      <i class="fas fa-circle-info"></i>
      <span>No wheels in the review queue.</span>
    </div>

    <!-- Wheels Table -->
    <div v-else class="overflow-x-auto">
      <table class="table table-zebra w-full text-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Width</th>
            <th>Offset</th>
            <th>Submitted By</th>
            <th>Email</th>
            <th>Status</th>
            <th class="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in wheelsToReview" :key="item.uuid">
            <tr>
              <!-- Name -->
              <td>
                <input
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(item, 'name') as string"
                  @input="updateEditedField(item.uuid, 'name', ($event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ item.name || '-' }}</span>
              </td>

              <!-- Type -->
              <td>
                <input
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(item, 'type') as string"
                  @input="updateEditedField(item.uuid, 'type', ($event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ item.type || '-' }}</span>
              </td>

              <!-- Size -->
              <td>
                <input
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(item, 'size') as string"
                  @input="updateEditedField(item.uuid, 'size', ($event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ item.size || '-' }}</span>
              </td>

              <!-- Width -->
              <td>
                <input
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(item, 'width') as string"
                  @input="updateEditedField(item.uuid, 'width', ($event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ item.width || '-' }}</span>
              </td>

              <!-- Offset -->
              <td>
                <input
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(item, 'offset') as string"
                  @input="updateEditedField(item.uuid, 'offset', ($event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ item.offset || '-' }}</span>
              </td>

              <!-- Submitted By -->
              <td>
                <input
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(item, 'userName') as string"
                  @input="updateEditedField(item.uuid, 'userName', ($event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ item.userName || '-' }}</span>
              </td>

              <!-- Email -->
              <td>
                <input
                  v-if="editingItems.has(item.uuid)"
                  type="email"
                  class="input input-bordered input-sm w-full"
                  :value="getDisplayValue(item, 'emailAddress') as string"
                  @input="updateEditedField(item.uuid, 'emailAddress', ($event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ item.emailAddress || '-' }}</span>
              </td>

              <!-- Status -->
              <td>
                <span class="badge" :class="`badge-${getStatusBadgeColor(item.status)}`">
                  {{ getStatusText(item.status) }}
                </span>
              </td>

              <!-- Actions -->
              <td class="text-center">
                <div class="flex gap-1 justify-center">
                  <!-- Edit Mode Actions -->
                  <template v-if="editingItems.has(item.uuid)">
                    <button
                      type="button"
                      class="btn btn-success btn-xs"
                      title="Save changes"
                      @click="saveEditing(item)"
                    >
                      <i class="fas fa-save"></i>
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Cancel editing"
                      @click="cancelEditing(item)"
                    >
                      <i class="fas fa-times"></i>
                    </button>
                  </template>

                  <!-- View Mode Actions -->
                  <template v-else>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Edit item"
                      :disabled="isProcessing"
                      @click="startEditing(item)"
                    >
                      <i class="fas fa-edit"></i>
                    </button>
                    <button
                      type="button"
                      class="btn btn-success btn-xs"
                      :disabled="isProcessing"
                      title="Approve item"
                      @click="approveItem(item)"
                    >
                      <i
                        v-if="isProcessing && processingItemId === item.uuid"
                        class="fas fa-spinner fa-spin"
                      ></i>
                      <i v-else class="fas fa-check"></i>
                    </button>
                    <button
                      type="button"
                      class="btn btn-error btn-xs"
                      :disabled="isProcessing"
                      title="Reject item"
                      @click="openDeleteDialog(item)"
                    >
                      <i class="fas fa-times"></i>
                    </button>
                  </template>
                </div>
              </td>
            </tr>

            <!-- Additional Details Row (expandable) -->
            <tr v-if="item.notes || item.referral" class="bg-base-200/50">
              <td colspan="9" class="py-2 px-4 border-t border-base-300">
                <div class="text-sm opacity-70">
                  <div v-if="item.notes" class="mb-1"><strong>Notes:</strong> {{ item.notes }}</div>
                  <div v-if="item.referral"><strong>Referral:</strong> {{ item.referral }}</div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Delete Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteDialog }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Confirm Rejection</h3>
        <p class="mb-4">Are you sure you want to reject this wheel submission? This action cannot be undone.</p>
        <div v-if="selectedItem" class="bg-base-200 p-4 rounded-lg mb-4">
          <p><strong>Wheel:</strong> {{ selectedItem.oldWheel?.name || 'Unknown' }}</p>
          <p><strong>Submitted by:</strong> {{ selectedItem.userName || 'Unknown' }}</p>
          <p><strong>Email:</strong> {{ selectedItem.emailAddress || 'No email provided' }}</p>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="showDeleteDialog = false">
            Cancel
          </button>
          <button type="button" class="btn btn-error" :disabled="isProcessing" @click="deleteItem">
            <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
            Reject Submission
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showDeleteDialog = false"></div>
    </dialog>
  </div>
</template>
