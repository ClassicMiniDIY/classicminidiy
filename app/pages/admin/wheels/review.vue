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
      <h1 class="text-2xl font-bold">Wheels Review Queue</h1>
      <UButton color="primary" @click="() => refreshData()" :disabled="fetchStatus === 'pending'">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': fetchStatus === 'pending' }"></i>
        {{ fetchStatus === 'pending' ? 'Loading...' : 'Refresh' }}
      </UButton>
    </div>

    <!-- Admin authentication handled by login system -->

    <!-- Error Message -->
    <UAlert v-if="errorMessage" color="error" icon="i-fa6-solid-circle-xmark" :title="errorMessage" class="mb-6" />

    <!-- Loading State -->
    <div v-if="fetchStatus === 'pending'" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Empty State -->
    <UAlert
      v-else-if="!wheelsToReview?.length"
      color="info"
      icon="i-fa6-solid-circle-info"
      title="No wheels in the review queue."
    />

    <!-- Wheels Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th class="text-left p-2 font-medium bg-muted">Name</th>
            <th class="text-left p-2 font-medium bg-muted">Type</th>
            <th class="text-left p-2 font-medium bg-muted">Size</th>
            <th class="text-left p-2 font-medium bg-muted">Width</th>
            <th class="text-left p-2 font-medium bg-muted">Offset</th>
            <th class="text-left p-2 font-medium bg-muted">Submitted By</th>
            <th class="text-left p-2 font-medium bg-muted">Email</th>
            <th class="text-left p-2 font-medium bg-muted">Status</th>
            <th class="text-center p-2 font-medium bg-muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in wheelsToReview" :key="item.uuid">
            <tr class="border-b border-default last:border-0 hover:bg-muted transition-colors">
              <!-- Name -->
              <td class="p-2">
                <UInput
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  size="sm"
                  class="w-full"
                  :model-value="getDisplayValue(item, 'name') as string"
                  @update:model-value="updateEditedField(item.uuid, 'name', $event)"
                />
                <span v-else>{{ item.name || '-' }}</span>
              </td>

              <!-- Type -->
              <td class="p-2">
                <UInput
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  size="sm"
                  class="w-full"
                  :model-value="getDisplayValue(item, 'type') as string"
                  @update:model-value="updateEditedField(item.uuid, 'type', $event)"
                />
                <span v-else>{{ item.type || '-' }}</span>
              </td>

              <!-- Size -->
              <td class="p-2">
                <UInput
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  size="sm"
                  class="w-full"
                  :model-value="getDisplayValue(item, 'size') as string"
                  @update:model-value="updateEditedField(item.uuid, 'size', $event)"
                />
                <span v-else>{{ item.size || '-' }}</span>
              </td>

              <!-- Width -->
              <td class="p-2">
                <UInput
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  size="sm"
                  class="w-full"
                  :model-value="getDisplayValue(item, 'width') as string"
                  @update:model-value="updateEditedField(item.uuid, 'width', $event)"
                />
                <span v-else>{{ item.width || '-' }}</span>
              </td>

              <!-- Offset -->
              <td class="p-2">
                <UInput
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  size="sm"
                  class="w-full"
                  :model-value="getDisplayValue(item, 'offset') as string"
                  @update:model-value="updateEditedField(item.uuid, 'offset', $event)"
                />
                <span v-else>{{ item.offset || '-' }}</span>
              </td>

              <!-- Submitted By -->
              <td class="p-2">
                <UInput
                  v-if="editingItems.has(item.uuid)"
                  type="text"
                  size="sm"
                  class="w-full"
                  :model-value="getDisplayValue(item, 'userName') as string"
                  @update:model-value="updateEditedField(item.uuid, 'userName', $event)"
                />
                <span v-else>{{ item.userName || '-' }}</span>
              </td>

              <!-- Email -->
              <td class="p-2">
                <UInput
                  v-if="editingItems.has(item.uuid)"
                  type="email"
                  size="sm"
                  class="w-full"
                  :model-value="getDisplayValue(item, 'emailAddress') as string"
                  @update:model-value="updateEditedField(item.uuid, 'emailAddress', $event)"
                />
                <span v-else>{{ item.emailAddress || '-' }}</span>
              </td>

              <!-- Status -->
              <td class="p-2">
                <UBadge :color="getStatusBadgeColor(item.status)">
                  {{ getStatusText(item.status) }}
                </UBadge>
              </td>

              <!-- Actions -->
              <td class="p-2 text-center">
                <div class="flex gap-1 justify-center">
                  <!-- Edit Mode Actions -->
                  <template v-if="editingItems.has(item.uuid)">
                    <UButton size="xs" color="success" @click="saveEditing(item)" title="Save changes">
                      <i class="fas fa-save"></i>
                    </UButton>
                    <UButton size="xs" variant="ghost" @click="cancelEditing(item)" title="Cancel editing">
                      <i class="fas fa-times"></i>
                    </UButton>
                  </template>

                  <!-- View Mode Actions -->
                  <template v-else>
                    <UButton
                      size="xs"
                      variant="ghost"
                      @click="startEditing(item)"
                      title="Edit item"
                      :disabled="isProcessing"
                    >
                      <i class="fas fa-edit"></i>
                    </UButton>
                    <UButton
                      size="xs"
                      color="success"
                      @click="approveItem(item)"
                      :disabled="isProcessing"
                      :loading="isProcessing && processingItemId === item.uuid"
                      title="Approve item"
                    >
                      <template #leading>
                        <i v-if="!(isProcessing && processingItemId === item.uuid)" class="fas fa-check"></i>
                      </template>
                    </UButton>
                    <UButton
                      size="xs"
                      color="error"
                      @click="openDeleteDialog(item)"
                      :disabled="isProcessing"
                      title="Reject item"
                    >
                      <i class="fas fa-times"></i>
                    </UButton>
                  </template>
                </div>
              </td>
            </tr>

            <!-- Additional Details Row (expandable) -->
            <tr v-if="item.notes || item.referral" class="bg-muted/50">
              <td colspan="9" class="py-2 px-4 border-t border-default">
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
    <UModal v-model:open="showDeleteDialog">
      <template #content>
        <div class="p-6">
          <h3 class="font-bold text-lg mb-4">Confirm Rejection</h3>
          <p class="mb-4">Are you sure you want to reject this wheel submission? This action cannot be undone.</p>
          <div v-if="selectedItem" class="bg-muted p-4 rounded-lg mb-4">
            <p><strong>Wheel:</strong> {{ selectedItem.oldWheel?.name || 'Unknown' }}</p>
            <p><strong>Submitted by:</strong> {{ selectedItem.userName || 'Unknown' }}</p>
            <p><strong>Email:</strong> {{ selectedItem.emailAddress || 'No email provided' }}</p>
          </div>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="showDeleteDialog = false" :disabled="isProcessing">Cancel</UButton>
            <UButton color="error" @click="deleteItem" :disabled="isProcessing" :loading="isProcessing">
              Reject Submission
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
