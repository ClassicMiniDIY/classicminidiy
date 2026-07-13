<template>
  <AdminExchangeShell>
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">Manage Listings</h1>
        <p class="text-base-content/70">View and manage all platform listings</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="loading" @click="loadListings">
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
            <select
              id="status-filter"
              v-model="selectedStatus"
              class="select select-bordered w-full max-w-xs"
            >
              <option :value="null">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="sold">Sold</option>
              <option value="expired">Expired</option>
              <option value="example_free">Example (Free)</option>
              <option value="example_paid">Example (Paid)</option>
            </select>
          </div>
          <div class="form-control flex-1">
            <label class="label">
              <span class="label-text">Search</span>
            </label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by title..."
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

    <!-- Listings (Mobile + Desktop) -->
    <div v-else-if="filteredListings.length > 0">
      <!-- Mobile Card View -->
      <div class="md:hidden space-y-4">
        <div v-for="listing in filteredListings" :key="listing.id" class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <!-- Header with image and title -->
            <div class="flex items-start gap-3 mb-3">
              <div class="avatar shrink-0">
                <div class="mask mask-squircle w-16 h-16">
                  <img
                    v-if="getPrimaryPhoto(listing)"
                    :src="getPhotoUrl(getPrimaryPhoto(listing))"
                    :alt="listing.title"
                    loading="lazy"
                  />
                  <div v-else class="bg-base-300 w-full h-full flex items-center justify-center">
                    <i class="fas fa-image text-base-content/30"></i>
                  </div>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold truncate">{{ listing.title }}</h3>
                <p class="text-sm text-base-content/70">{{ listing.year }} {{ listing.model }}</p>
                <div class="mt-1">
                  <p class="text-lg font-semibold">${{ formatPrice(listing.price) }}</p>
                </div>
              </div>
              <div class="flex flex-col gap-1 shrink-0">
                <span class="badge badge-sm" :class="getStatusBadgeClass(listing.status)">
                  {{ formatStatus(listing.status) }}
                </span>
                <span class="badge badge-sm" :class="getTierBadgeClass(listing.tier)">
                  {{ formatTier(listing.tier) }}
                </span>
              </div>
            </div>

            <!-- User and Date Info -->
            <div class="text-sm space-y-1 mb-3">
              <div class="flex items-center gap-2">
                <i class="fas fa-user text-base-content/50"></i>
                <span class="font-medium">{{ listing.profiles?.display_name || 'Unknown' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fas fa-calendar text-base-content/50"></i>
                <span class="text-base-content/70">{{ formatDate(listing.created_at) }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <NuxtLink :to="`/exchange/listings/${listing.slug}`" class="btn btn-sm btn-ghost flex-1" target="_blank">
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
                  <li v-if="listing.status !== 'active'">
                    <a @click="confirmChangeStatus(listing.id, 'active')">
                      <i class="fas fa-circle-check"></i>
                      Mark as Active
                    </a>
                  </li>
                  <li v-if="listing.status !== 'sold'">
                    <a @click="confirmChangeStatus(listing.id, 'sold')">
                      <i class="fas fa-dollar-sign"></i>
                      Mark as Sold
                    </a>
                  </li>
                  <li v-if="listing.status !== 'expired'">
                    <a @click="confirmChangeStatus(listing.id, 'expired')">
                      <i class="fas fa-clock"></i>
                      Mark as Expired
                    </a>
                  </li>
                  <li v-if="['sold', 'expired', 'cancelled'].includes(listing.status)">
                    <a @click="handleRelist(listing.id)">
                      <i class="fas fa-arrows-rotate"></i>
                      Relist
                    </a>
                  </li>
                  <li v-if="listing.status !== 'example_free'" class="border-t border-base-300 mt-1 pt-1">
                    <a @click="confirmChangeStatus(listing.id, 'example_free')">
                      <i class="fas fa-flask"></i>
                      Set Example (Free)
                    </a>
                  </li>
                  <li v-if="listing.status !== 'example_paid'">
                    <a @click="confirmChangeStatus(listing.id, 'example_paid')">
                      <i class="fas fa-flask"></i>
                      Set Example (Paid)
                    </a>
                  </li>
                  <li v-if="listing.tier !== 'paid'" class="border-t border-base-300 mt-1 pt-1">
                    <a @click="confirmChangeTier(listing.id, 'paid')">
                      <i class="fas fa-circle-arrow-up"></i>
                      Upgrade to Premium
                    </a>
                  </li>
                  <li
                    v-if="listing.tier !== 'free'"
                    :class="{ 'border-t border-base-300 mt-1 pt-1': listing.tier === 'paid' }"
                  >
                    <a @click="confirmChangeTier(listing.id, 'free')">
                      <i class="fas fa-circle-arrow-down"></i>
                      Downgrade to Free
                    </a>
                  </li>
                  <li class="border-t border-base-300 mt-1 pt-1">
                    <a @click="confirmDelete(listing)" class="text-error">
                      <i class="fas fa-trash"></i>
                      Delete Listing
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
                <th>Listing</th>
                <th>User</th>
                <th class="cursor-pointer select-none" @click="toggleSort('price')">
                  <span class="flex items-center gap-1">
                    Price
                    <i
                      class="text-xs"
                      :class="[getSortIcon('price'), { 'opacity-30': !isSortedBy('price') }]"
                    ></i>
                  </span>
                </th>
                <th class="cursor-pointer select-none" @click="toggleSort('status')">
                  <span class="flex items-center gap-1">
                    Status
                    <i
                      class="text-xs"
                      :class="[getSortIcon('status'), { 'opacity-30': !isSortedBy('status') }]"
                    ></i>
                  </span>
                </th>
                <th class="cursor-pointer select-none" @click="toggleSort('tier')">
                  <span class="flex items-center gap-1">
                    Tier
                    <i class="text-xs" :class="[getSortIcon('tier'), { 'opacity-30': !isSortedBy('tier') }]"></i>
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
              <tr v-for="listing in filteredListings" :key="listing.id">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="avatar">
                      <div class="mask mask-squircle w-12 h-12">
                        <img
                          v-if="getPrimaryPhoto(listing)"
                          :src="getPhotoUrl(getPrimaryPhoto(listing))"
                          :alt="listing.title"
                          loading="lazy"
                        />
                        <div v-else class="bg-base-300 w-full h-full flex items-center justify-center">
                          <i class="fas fa-image text-base-content/30"></i>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div class="font-bold">{{ listing.title }}</div>
                      <div class="text-sm text-base-content/70">{{ listing.year }} {{ listing.model }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="text-sm">
                    <div class="font-medium">{{ listing.profiles?.display_name || 'Unknown' }}</div>
                    <div class="text-base-content/70">{{ listing.profiles?.email }}</div>
                  </div>
                </td>
                <td>
                  <span class="font-semibold">${{ formatPrice(listing.price) }}</span>
                </td>
                <td>
                  <span class="badge badge-sm" :class="getStatusBadgeClass(listing.status)">
                    {{ formatStatus(listing.status) }}
                  </span>
                </td>
                <td>
                  <span class="badge badge-sm" :class="getTierBadgeClass(listing.tier)">
                    {{ formatTier(listing.tier) }}
                  </span>
                </td>
                <td>
                  <span class="text-sm">{{ formatDate(listing.created_at) }}</span>
                </td>
                <td>
                  <div class="flex gap-2">
                    <NuxtLink
                      :to="`/exchange/listings/${listing.slug}`"
                      class="btn btn-ghost btn-xs"
                      target="_blank"
                      aria-label="View listing"
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
                        <li v-if="listing.status !== 'active'">
                          <a @click="confirmChangeStatus(listing.id, 'active')">
                            <i class="fas fa-circle-check"></i>
                            Mark as Active
                          </a>
                        </li>
                        <li v-if="listing.status !== 'sold'">
                          <a @click="confirmChangeStatus(listing.id, 'sold')">
                            <i class="fas fa-dollar-sign"></i>
                            Mark as Sold
                          </a>
                        </li>
                        <li v-if="listing.status !== 'expired'">
                          <a @click="confirmChangeStatus(listing.id, 'expired')">
                            <i class="fas fa-clock"></i>
                            Mark as Expired
                          </a>
                        </li>
                        <li v-if="['sold', 'expired', 'cancelled'].includes(listing.status)">
                          <a @click="handleRelist(listing.id)">
                            <i class="fas fa-arrows-rotate"></i>
                            Relist
                          </a>
                        </li>
                        <li v-if="listing.status !== 'example_free'" class="border-t border-base-300 mt-1 pt-1">
                          <a @click="confirmChangeStatus(listing.id, 'example_free')">
                            <i class="fas fa-flask"></i>
                            Set Example (Free)
                          </a>
                        </li>
                        <li v-if="listing.status !== 'example_paid'">
                          <a @click="confirmChangeStatus(listing.id, 'example_paid')">
                            <i class="fas fa-flask"></i>
                            Set Example (Paid)
                          </a>
                        </li>
                        <li v-if="listing.tier !== 'paid'" class="border-t border-base-300 mt-1 pt-1">
                          <a @click="confirmChangeTier(listing.id, 'paid')">
                            <i class="fas fa-circle-arrow-up"></i>
                            Upgrade to Premium
                          </a>
                        </li>
                        <li
                          v-if="listing.tier !== 'free'"
                          :class="{ 'border-t border-base-300 mt-1 pt-1': listing.tier === 'paid' }"
                        >
                          <a @click="confirmChangeTier(listing.id, 'free')">
                            <i class="fas fa-circle-arrow-down"></i>
                            Downgrade to Free
                          </a>
                        </li>
                        <li class="border-t border-base-300 mt-1 pt-1">
                          <a @click="confirmDelete(listing)" class="text-error">
                            <i class="fas fa-trash"></i>
                            Delete Listing
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <!-- Bottom padding to allow dropdown space -->
          <div class="h-48"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-16 card bg-base-100 shadow-sm">
      <i class="fas fa-inbox text-6xl mx-auto mb-4 text-base-content/30"></i>
      <h3 class="text-xl font-semibold mb-2">No Listings Found</h3>
      <p class="text-base-content/70">Try adjusting your filters</p>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && totalPages > 1" class="flex justify-center mt-8">
      <div class="join">
        <button class="join-item btn" :disabled="currentPage === 1" @click="currentPage--">«</button>
        <button class="join-item btn">Page {{ currentPage }} of {{ totalPages }}</button>
        <button class="join-item btn" :disabled="currentPage === totalPages" @click="currentPage++">»</button>
      </div>
    </div>

    <!-- Action Confirmation Modal -->
    <dialog ref="actionModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Confirm Action</h3>
        <p class="py-4">
          Are you sure you want to
          <template v-if="pendingAction?.type === 'status'">
            change this listing's status to <strong>{{ formatStatus(pendingAction.value) }}</strong>
          </template>
          <template v-else-if="pendingAction?.type === 'tier'">
            change this listing's tier to <strong>{{ formatTier(pendingAction.value) }}</strong> </template
          >?
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="cancelPendingAction">Cancel</button>
          <button class="btn btn-primary" @click="executePendingAction">Confirm</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog ref="deleteModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete Listing</h3>
        <p class="py-4">
          Are you sure you want to delete
          <strong>{{ listingToDelete?.title }}</strong>
          ? This action cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeDeleteModal">Cancel</button>
          <button class="btn btn-error" @click="handleDelete">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </AdminExchangeShell>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Manage Listings - Admin - The Mini Exchange',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const { getAllListings, deleteListing, updateListingStatus, updateListingTier, relistListing } = useAdmin();
  const { formatPrice, formatDate, formatStatus, formatTier } = useFormatters();
  const { sortColumn, toggleSort, getSortIcon, isSortedBy, sortFn } = useTableSort('created_at', 'desc');
  const toast = useToast();

  const loading = ref(true);
  const listings = ref<ListingWithPhotos[]>([]);
  const currentPage = ref(1);
  const totalListings = ref(0);
  const itemsPerPage = 20;
  const selectedStatus = ref<string | null>(null);
  const searchQuery = ref('');
  const deleteModal = ref<HTMLDialogElement | null>(null);
  const listingToDelete = ref<ListingWithPhotos | null>(null);
  const pendingAction = ref<{ type: 'status' | 'tier'; listingId: string; value: string } | null>(null);
  const actionModal = ref<HTMLDialogElement | null>(null);

  const totalPages = computed(() => Math.ceil(totalListings.value / itemsPerPage));

  const filteredListings = computed(() => {
    let filtered = listings.value;

    // Filter by search query
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((l) => l.title.toLowerCase().includes(query) || l.model.toLowerCase().includes(query));
    }

    return [...filtered].sort(sortFn);
  });

  const loadListings = async () => {
    loading.value = true;
    try {
      const result = await getAllListings(currentPage.value, itemsPerPage, selectedStatus.value || undefined);
      listings.value = result.listings;
      totalListings.value = result.total;
    } catch (error: any) {
      console.error('Error loading listings:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to load listings',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  const changeStatus = async (listingId: string, status: string) => {
    try {
      await updateListingStatus(listingId, status);
      toast.add({
        title: 'Success',
        description: 'Listing status updated',
        color: 'success',
      });
      await loadListings();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to update status',
        color: 'error',
      });
    }
  };

  const changeTier = async (listingId: string, tier: 'free' | 'paid') => {
    try {
      await updateListingTier(listingId, tier);
      toast.add({
        title: 'Success',
        description: `Listing tier updated to ${tier}`,
        color: 'success',
      });
      await loadListings();
    } catch (error: any) {
      console.error('Error updating tier:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to update tier',
        color: 'error',
      });
    }
  };

  const handleRelist = async (listingId: string) => {
    try {
      await relistListing(listingId);
      toast.add({
        title: 'Success',
        description: 'Listing has been relisted',
        color: 'success',
      });
      await loadListings();
    } catch (error: any) {
      console.error('Error relisting:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to relist listing',
        color: 'error',
      });
    }
  };

  const confirmChangeStatus = (listingId: string, status: string) => {
    pendingAction.value = { type: 'status', listingId, value: status };
    actionModal.value?.showModal();
  };

  const confirmChangeTier = (listingId: string, tier: string) => {
    pendingAction.value = { type: 'tier', listingId, value: tier };
    actionModal.value?.showModal();
  };

  const executePendingAction = async () => {
    if (!pendingAction.value) return;
    const { type, listingId, value } = pendingAction.value;
    actionModal.value?.close();
    pendingAction.value = null;

    if (type === 'status') {
      await changeStatus(listingId, value);
    } else {
      await changeTier(listingId, value as 'free' | 'paid');
    }
  };

  const cancelPendingAction = () => {
    actionModal.value?.close();
    pendingAction.value = null;
  };

  const confirmDelete = (listing: ListingWithPhotos) => {
    listingToDelete.value = listing;
    deleteModal.value?.showModal();
  };

  const closeDeleteModal = () => {
    deleteModal.value?.close();
    listingToDelete.value = null;
  };

  const handleDelete = async () => {
    if (!listingToDelete.value) return;

    try {
      await deleteListing(listingToDelete.value.id);
      toast.add({
        title: 'Success',
        description: 'Listing deleted successfully',
        color: 'success',
      });
      closeDeleteModal();
      await loadListings();
    } catch (error: any) {
      console.error('Error deleting listing:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to delete listing',
        color: 'error',
      });
    }
  };

  const getPrimaryPhoto = (listing: ListingWithPhotos) => {
    if (!listing.listing_photos || listing.listing_photos.length === 0) return null;
    return listing.listing_photos.find((p) => p.is_primary) || listing.listing_photos[0];
  };

  const getPhotoUrl = (photo: any) => {
    if (!photo) return '';
    const supabase = useSupabase();
    const { data } = supabase.storage.from('listing-photos').getPublicUrl(photo.storage_path);
    return data.publicUrl;
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      pending: 'badge-warning',
      active: 'badge-success',
      draft: 'badge-ghost',
      sold: 'badge-info',
      expired: 'badge-error',
      example_free: 'badge-secondary',
      example_paid: 'badge-secondary',
    };
    return classes[status.toLowerCase()] || 'badge-ghost';
  };

  const getTierBadgeClass = (tier: string) => {
    return tier === 'paid' ? 'badge-warning' : 'badge-ghost';
  };

  // Watch for filter changes
  watch([selectedStatus, currentPage], () => {
    loadListings();
  });

  onMounted(() => {
    loadListings();
  });
</script>
