<template>
  <AdminExchangeShell>
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold mb-2">Moderation Queue</h1>
        <p class="text-base-content/70">
          <template v-if="!loading && totalCount > 0">
            {{ totalCount }} item{{ totalCount !== 1 ? 's' : '' }} need{{ totalCount === 1 ? 's' : '' }} review
          </template>
          <template v-else-if="!loading">No items pending moderation</template>
          <template v-else>Loading moderation queue...</template>
        </p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="loading" @click="refreshAll">
        <i class="fas fa-arrows-rotate" :class="{ 'animate-spin': loading }"></i>
        Refresh
      </button>
    </div>

    <!-- Tab Navigation -->
    <div class="tabs tabs-border mb-6">
      <button class="tab" :class="{ 'tab-active': activeTab === 'listings' }" @click="activeTab = 'listings'">
        Listings
        <span v-if="counts.listings > 0" class="badge badge-warning badge-sm ml-2">{{ counts.listings }}</span>
      </button>
      <button class="tab" :class="{ 'tab-active': activeTab === 'finds' }" @click="activeTab = 'finds'">
        Finds
        <span v-if="counts.finds > 0" class="badge badge-warning badge-sm ml-2">{{ counts.finds }}</span>
      </button>
      <button class="tab" :class="{ 'tab-active': activeTab === 'wanted' }" @click="activeTab = 'wanted'">
        Wanted
        <span v-if="counts.wanted > 0" class="badge badge-warning badge-sm ml-2">{{ counts.wanted }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="skeleton h-40 w-full"></div>
    </div>

    <!-- ===== LISTINGS TAB ===== -->
    <div v-else-if="activeTab === 'listings'">
      <div v-if="tabErrors.listings" class="alert alert-error mb-4">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ tabErrors.listings }}</span>
        <button class="btn btn-ghost btn-sm" @click="loadPendingListings">Retry</button>
      </div>
      <div v-else-if="pendingListings.length > 0" class="space-y-4">
        <div v-for="listing in pendingListings" :key="listing.id" class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <div class="flex flex-col md:flex-row gap-4">
              <!-- Thumbnail -->
              <div class="shrink-0">
                <div class="w-full md:w-32 aspect-video bg-base-300 rounded-lg overflow-hidden">
                  <img
                    v-if="getPrimaryPhoto(listing)"
                    :src="getPhotoUrl(getPrimaryPhoto(listing))"
                    :alt="listing.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <i class="fas fa-image text-2xl text-base-content/30"></i>
                  </div>
                </div>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-lg mb-1">{{ listing.title }}</h3>
                <div class="flex flex-wrap gap-3 text-sm text-base-content/70 mb-2">
                  <span v-if="listing.year || listing.model"> {{ listing.year }} {{ listing.model }} </span>
                  <span v-if="listing.price != null" class="font-semibold text-primary">
                    ${{ formatPrice(listing.price) }}
                  </span>
                </div>
                <div class="text-sm text-base-content/50 mb-3">
                  <span class="flex items-center gap-1">
                    <i class="fas fa-user"></i>
                    {{ listing.profiles?.display_name || 'Unknown' }}
                    <span v-if="listing.profiles?.email" class="text-base-content/40">
                      ({{ listing.profiles.email }})
                    </span>
                  </span>
                  <span class="flex items-center gap-1 mt-1">
                    <i class="fas fa-calendar"></i>
                    {{ formatDate(listing.created_at) }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap gap-2">
                  <button class="btn btn-success btn-sm gap-1" @click="approveListing(listing.id)">
                    <i class="fas fa-circle-check"></i>
                    Approve
                  </button>
                  <NuxtLink :to="`/exchange/listings/${listing.slug}`" target="_blank" class="btn btn-ghost btn-sm gap-1">
                    <i class="fas fa-eye"></i>
                    View
                  </NuxtLink>
                  <button
                    class="btn btn-error btn-sm btn-outline gap-1"
                    @click="openDeleteModal('listing', listing.id, listing.title)"
                  >
                    <i class="fas fa-trash"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Truncation notice -->
      <div v-if="listingsTotalCount > pendingListings.length" class="alert alert-info mt-4">
        <i class="fas fa-circle-info"></i>
        <span
          >Showing {{ pendingListings.length }} of {{ listingsTotalCount }} pending listings. Visit the
          <NuxtLink to="/admin/exchange/listings" class="link">full listings page</NuxtLink> to see all.
        </span>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!tabErrors.listings && pendingListings.length === 0"
        class="text-center py-16 card bg-base-100 shadow-sm"
      >
        <i class="fas fa-circle-check text-6xl mx-auto mb-4 text-success/50"></i>
        <h3 class="text-xl font-semibold mb-2">No Pending Listings</h3>
        <p class="text-base-content/70">All listings have been reviewed.</p>
      </div>
    </div>

    <!-- ===== FINDS TAB ===== -->
    <div v-else-if="activeTab === 'finds'">
      <div v-if="tabErrors.finds" class="alert alert-error mb-4">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ tabErrors.finds }}</span>
        <button class="btn btn-ghost btn-sm" @click="loadPendingFinds">Retry</button>
      </div>
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

                <!-- Actions -->
                <div class="flex flex-wrap gap-2">
                  <button class="btn btn-success btn-sm gap-1" @click="openApproveFindsModal(find)">
                    <i class="fas fa-circle-check"></i>
                    Approve
                  </button>
                  <button class="btn btn-error btn-sm btn-outline gap-1" @click="openRejectFindModal(find.id)">
                    <i class="fas fa-circle-xmark"></i>
                    Reject
                  </button>
                  <button
                    class="btn btn-ghost btn-sm gap-1"
                    :disabled="refetchingFindId === find.id"
                    @click="handleRefetchMetadata(find.id)"
                  >
                    <span v-if="refetchingFindId === find.id" class="loading loading-spinner loading-xs"></span>
                    <i v-else class="fas fa-arrows-rotate"></i>
                    {{ refetchingFindId === find.id ? 'Fetching...' : 'Re-fetch' }}
                  </button>
                  <button
                    class="btn btn-ghost btn-sm btn-error gap-1"
                    @click="openDeleteModal('find', find.id, find.title)"
                  >
                    <i class="fas fa-trash"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-16 card bg-base-100 shadow-sm">
        <i class="fas fa-circle-check text-6xl mx-auto mb-4 text-success/50"></i>
        <h3 class="text-xl font-semibold mb-2">No Pending Finds</h3>
        <p class="text-base-content/70">All finds have been reviewed.</p>
      </div>
    </div>

    <!-- ===== WANTED TAB ===== -->
    <div v-else-if="activeTab === 'wanted'">
      <div v-if="tabErrors.wanted" class="alert alert-error mb-4">
        <i class="fas fa-triangle-exclamation"></i>
        <span>{{ tabErrors.wanted }}</span>
        <button class="btn btn-ghost btn-sm" @click="loadWantedPosts">Retry</button>
      </div>
      <div v-else-if="wantedPosts.length > 0" class="space-y-4">
        <div v-for="post in wantedPosts" :key="post.id" class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <div class="flex flex-col md:flex-row gap-4">
              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-start gap-2 mb-2">
                  <h3 class="font-bold text-lg">{{ post.title }}</h3>
                  <span class="badge badge-sm badge-outline">{{ post.category }}</span>
                  <span v-if="post.moderation_status === 'flagged'" class="badge badge-sm badge-error"> Flagged </span>
                </div>

                <!-- Description preview -->
                <p class="text-sm text-base-content/60 line-clamp-2 mb-2">
                  {{ post.description }}
                </p>

                <!-- Moderation issues -->
                <div v-if="post.moderation_issues?.length" class="flex flex-wrap gap-1 mb-2">
                  <span v-for="issue in post.moderation_issues" :key="issue" class="badge badge-warning badge-sm">
                    {{ issue }}
                  </span>
                </div>

                <!-- User info -->
                <div class="text-sm text-base-content/50 mb-3">
                  <span class="flex items-center gap-1">
                    <i class="fas fa-user"></i>
                    {{ post.profiles?.display_name || post.profiles?.email || 'Unknown' }}
                  </span>
                  <span class="flex items-center gap-1 mt-1">
                    <i class="fas fa-calendar"></i>
                    {{ formatDate(post.created_at) }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap gap-2">
                  <button class="btn btn-success btn-sm gap-1" @click="approveWantedPost(post.id)">
                    <i class="fas fa-circle-check"></i>
                    Approve
                  </button>
                  <button class="btn btn-error btn-sm btn-outline gap-1" @click="rejectWantedPost(post.id)">
                    <i class="fas fa-circle-xmark"></i>
                    Reject
                  </button>
                  <button
                    class="btn btn-ghost btn-sm btn-error gap-1"
                    @click="openDeleteModal('wanted', post.id, post.title)"
                  >
                    <i class="fas fa-trash"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-16 card bg-base-100 shadow-sm">
        <i class="fas fa-circle-check text-6xl mx-auto mb-4 text-success/50"></i>
        <h3 class="text-xl font-semibold mb-2">No Pending Wanted Posts</h3>
        <p class="text-base-content/70">All wanted posts have been reviewed.</p>
      </div>
    </div>

    <!-- ===== DELETE CONFIRMATION MODAL ===== -->
    <dialog ref="deleteModalRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete {{ deleteTarget?.type }}</h3>
        <p class="py-4">
          Are you sure you want to delete
          <strong>{{ deleteTarget?.title }}</strong
          >? This action cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeDeleteModal">Cancel</button>
          <button class="btn btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- ===== FINDS APPROVE MODAL ===== -->
    <dialog ref="approveFindsModalRef" class="modal">
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
          <button class="btn btn-ghost" @click="closeApproveFindsModal">Cancel</button>
          <button class="btn btn-success" @click="confirmApproveFind">
            <i class="fas fa-circle-check"></i>
            Approve
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- ===== FINDS REJECTION MODAL ===== -->
    <dialog ref="rejectFindModalRef" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Reject Find</h3>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Rejection Reason (optional)</legend>
          <textarea
            v-model="findRejectionReason"
            rows="3"
            placeholder="e.g., Duplicate listing, not a Classic Mini, broken link..."
            class="textarea w-full"
          ></textarea>
        </fieldset>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeRejectFindModal">Cancel</button>
          <button class="btn btn-error" @click="confirmRejectFind">
            <i class="fas fa-circle-xmark"></i>
            Reject
          </button>
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
  import type { ExternalListing } from '~/composables/useExternalListings';
  import type { WantedPost } from '~/composables/useWantedPosts';
  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Moderation Queue - Admin - The Mini Exchange',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  // ---- Composables ----
  const route = useRoute();
  const router = useRouter();
  const supabase = useSupabase();
  const toast = useToast();
  const { getAllListings, updateListingStatus, deleteListing } = useAdmin();
  const { pendingFinds, fetchPending, approve, reject, refetchMetadata, deleteFind } = useExternalListingAdmin();
  const {
    formatPrice,
    formatDate,
    formatCurrency,
    formatFieldName,
    formatValue,
    getSourceDisplayName,
    getSourceBadgeClass,
    truncateUrl,
  } = useFormatters();

  // ---- State ----
  const loading = ref(true);
  const activeTab = ref<'listings' | 'finds' | 'wanted'>('listings');
  const tabErrors = ref<Record<string, string | null>>({
    listings: null,
    finds: null,
    wanted: null,
  });

  // Listings tab
  const pendingListings = ref<ListingWithPhotos[]>([]);
  const listingsTotalCount = ref(0);

  // Wanted tab
  const wantedPosts = ref<WantedPost[]>([]);

  // Finds tab
  const refetchingFindId = ref<string | null>(null);

  // Delete modal
  const deleteModalRef = ref<HTMLDialogElement | null>(null);
  const deleteTarget = ref<{ type: string; id: string; title: string } | null>(null);

  // Finds approve modal
  const approveFindsModalRef = ref<HTMLDialogElement | null>(null);
  const approvingFind = ref<ExternalListing | null>(null);
  const approveCommentary = ref('');
  const approveEditorsPick = ref(false);

  // Finds rejection modal
  const rejectFindModalRef = ref<HTMLDialogElement | null>(null);
  const rejectingFindId = ref<string | null>(null);
  const findRejectionReason = ref('');

  // ---- Computed counts ----
  const counts = computed(() => ({
    listings: pendingListings.value.length,
    finds: pendingFinds.value.length,
    wanted: wantedPosts.value.length,
  }));

  const totalCount = computed(() => counts.value.listings + counts.value.finds + counts.value.wanted);

  // ---- Tab URL sync ----
  watch(activeTab, (tab) => {
    router.replace({ query: { ...route.query, tab } });
  });

  // ---- Data loading ----
  const loadPendingListings = async () => {
    tabErrors.value.listings = null;
    try {
      const result = await getAllListings(1, 100, 'pending');
      pendingListings.value = result.listings;
      listingsTotalCount.value = result.total;
    } catch (error: any) {
      console.error('Error loading pending listings:', error);
      tabErrors.value.listings = 'Failed to load pending listings';
    }
  };

  const loadWantedPosts = async () => {
    tabErrors.value.wanted = null;
    try {
      const { data, error } = await supabase
        .from('wanted_posts')
        .select('*, profiles!wanted_posts_user_id_fkey(id, display_name, email, avatar_url)')
        .in('moderation_status', ['pending', 'flagged'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      wantedPosts.value = (data as unknown as WantedPost[]) || [];
    } catch (error: any) {
      console.error('Error loading wanted posts:', error);
      tabErrors.value.wanted = 'Failed to load wanted posts';
    }
  };

  const loadPendingFinds = async () => {
    tabErrors.value.finds = null;
    try {
      await fetchPending();
    } catch (error: any) {
      console.error('Error loading pending finds:', error);
      tabErrors.value.finds = 'Failed to load pending finds';
    }
  };

  const refreshAll = async () => {
    loading.value = true;
    await Promise.all([loadPendingListings(), loadPendingFinds(), loadWantedPosts()]);
    loading.value = false;
  };

  // ---- Photo helpers ----
  const getPrimaryPhoto = (listing: ListingWithPhotos) => {
    if (!listing.listing_photos?.length) return null;
    return listing.listing_photos.find((p: any) => p.is_primary) || listing.listing_photos[0];
  };

  const getPhotoUrl = (photo: any) => {
    if (!photo) return '';
    const { data } = supabase.storage.from('listing-photos').getPublicUrl(photo.storage_path);
    return data.publicUrl;
  };

  // ---- Listings actions ----
  const approveListing = async (listingId: string) => {
    try {
      await updateListingStatus(listingId, 'active');
      toast.add({
        title: 'Listing Approved',
        description: 'The listing is now active.',
        color: 'success',
      });
      pendingListings.value = pendingListings.value.filter((l) => l.id !== listingId);
    } catch (error: any) {
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to approve listing',
        color: 'error',
      });
    }
  };

  // ---- Finds actions ----
  const openApproveFindsModal = (find: ExternalListing) => {
    approvingFind.value = find;
    approveCommentary.value = '';
    approveEditorsPick.value = false;
    approveFindsModalRef.value?.showModal();
  };

  const closeApproveFindsModal = () => {
    approveFindsModalRef.value?.close();
    approvingFind.value = null;
  };

  const confirmApproveFind = async () => {
    if (!approvingFind.value) return;
    await approve(
      approvingFind.value.id,
      approveCommentary.value.trim() || undefined,
      approveEditorsPick.value || undefined
    );
    closeApproveFindsModal();
  };

  const openRejectFindModal = (id: string) => {
    rejectingFindId.value = id;
    findRejectionReason.value = '';
    rejectFindModalRef.value?.showModal();
  };

  const closeRejectFindModal = () => {
    rejectFindModalRef.value?.close();
    rejectingFindId.value = null;
  };

  const confirmRejectFind = async () => {
    if (!rejectingFindId.value) return;
    await reject(rejectingFindId.value, findRejectionReason.value.trim() || undefined);
    closeRejectFindModal();
  };

  const handleRefetchMetadata = async (id: string) => {
    if (refetchingFindId.value) return;
    refetchingFindId.value = id;
    try {
      await refetchMetadata(id);
      await fetchPending();
    } finally {
      refetchingFindId.value = null;
    }
  };

  // ---- Wanted actions ----
  const approveWantedPost = async (id: string) => {
    try {
      const { error } = await supabase
        .from('wanted_posts')
        .update({ status: 'active', moderation_status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      wantedPosts.value = wantedPosts.value.filter((p) => p.id !== id);
      toast.add({
        title: 'Wanted Post Approved',
        description: 'The wanted post is now active.',
        color: 'success',
      });
    } catch (error: any) {
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to approve wanted post',
        color: 'error',
      });
    }
  };

  const rejectWantedPost = async (id: string) => {
    try {
      const { error } = await supabase
        .from('wanted_posts')
        .update({ status: 'removed', moderation_status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      wantedPosts.value = wantedPosts.value.filter((p) => p.id !== id);
      toast.add({
        title: 'Wanted Post Rejected',
        description: 'The wanted post has been rejected.',
        color: 'warning',
      });
    } catch (error: any) {
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to reject wanted post',
        color: 'error',
      });
    }
  };

  // ---- Generic delete modal ----
  const openDeleteModal = (type: string, id: string, title: string) => {
    deleteTarget.value = { type, id, title };
    deleteModalRef.value?.showModal();
  };

  const closeDeleteModal = () => {
    deleteModalRef.value?.close();
    deleteTarget.value = null;
  };

  const confirmDelete = async () => {
    if (!deleteTarget.value) return;

    const { type, id } = deleteTarget.value;

    try {
      if (type === 'listing') {
        await deleteListing(id);
        pendingListings.value = pendingListings.value.filter((l) => l.id !== id);
      } else if (type === 'find') {
        await deleteFind(id);
      } else if (type === 'wanted') {
        const { error } = await supabase.from('wanted_posts').delete().eq('id', id);
        if (error) throw error;
        wantedPosts.value = wantedPosts.value.filter((p) => p.id !== id);
      }

      toast.add({
        title: 'Deleted',
        description: `The ${type} has been deleted.`,
        color: 'success',
      });
    } catch (error: any) {
      toast.add({
        title: 'Error',
        description: error.message || `Failed to delete ${type}`,
        color: 'error',
      });
    } finally {
      closeDeleteModal();
    }
  };

  // ---- Lifecycle ----
  onMounted(async () => {
    loading.value = true;
    await Promise.all([loadPendingListings(), loadPendingFinds(), loadWantedPosts()]);
    loading.value = false;

    // Auto-select tab from URL or busiest tab
    const queryTab = route.query.tab as string;
    if (['listings', 'finds', 'wanted'].includes(queryTab)) {
      activeTab.value = queryTab as typeof activeTab.value;
    } else {
      const entries = Object.entries(counts.value) as Array<[typeof activeTab.value, number]>;
      const busiest = entries.reduce((max, entry) => (entry[1] > max[1] ? entry : max));
      if (busiest[1] > 0) {
        activeTab.value = busiest[0];
      }
    }
  });
</script>
