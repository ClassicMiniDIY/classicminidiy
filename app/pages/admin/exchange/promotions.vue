<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">Social Posting</h1>
      <p class="text-base-content/70">Manage social media posts for listings</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <i class="fas fa-clock text-xl text-warning"></i>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ pendingSocialPromotions.length }}</div>
              <div class="text-sm text-base-content/70">Pending Posts</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-error/10 rounded-lg flex items-center justify-center">
              <i class="fas fa-triangle-exclamation text-xl text-error"></i>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ failedSocialPosts.length }}</div>
              <div class="text-sm text-base-content/70">Failed Posts</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <i class="fas fa-circle-check text-xl text-success"></i>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ successfulSocialPosts.length }}</div>
              <div class="text-sm text-base-content/70">Successfully Posted</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Failed Social Posts Section -->
    <div v-if="failedSocialPosts.length > 0" class="card bg-base-100 shadow mb-8 border-2 border-error/30">
      <div class="card-body">
        <h2 class="card-title mb-4 text-error">
          <i class="fas fa-triangle-exclamation"></i>
          Failed Social Media Posts
        </h2>
        <p class="text-sm text-base-content/70 mb-4">
          These listings had partial failures during social media posting. Click retry to attempt posting again.
        </p>

        <div class="space-y-4">
          <div v-for="item in failedSocialPosts" :key="item.listing.id" class="card bg-base-200">
            <div class="card-body p-4">
              <div class="flex flex-col md:flex-row md:items-center gap-4">
                <div class="flex items-center gap-3 flex-1">
                  <div class="avatar shrink-0">
                    <div class="w-16 h-16 rounded">
                      <img
                        v-if="item.listing.listing_photos?.[0]"
                        :src="getPhotoUrl(item.listing.listing_photos[0].storage_path)"
                        :alt="item.listing.title"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold">{{ item.listing.title }}</h3>
                    <p class="text-sm text-base-content/70">{{ item.listing.year }} {{ item.listing.model }}</p>
                  </div>
                </div>

                <div class="flex flex-col gap-2">
                  <!-- Platform Status -->
                  <div class="flex flex-wrap items-center gap-2 text-sm">
                    <span class="flex items-center gap-1" :class="item.hasFacebook ? 'text-success' : 'text-error'">
                      <i :class="item.hasFacebook ? 'fas fa-circle-check' : 'fas fa-circle-xmark'"></i>
                      Facebook
                    </span>
                    <span class="flex items-center gap-1" :class="item.hasInstagram ? 'text-success' : 'text-error'">
                      <i :class="item.hasInstagram ? 'fas fa-circle-check' : 'fas fa-circle-xmark'"></i>
                      Instagram
                    </span>
                    <span class="flex items-center gap-1" :class="item.hasBluesky ? 'text-success' : 'text-error'">
                      <i :class="item.hasBluesky ? 'fas fa-circle-check' : 'fas fa-circle-xmark'"></i>
                      Bluesky
                    </span>
                  </div>

                  <!-- Retry Buttons -->
                  <div class="flex flex-wrap gap-2">
                    <NuxtLink :to="`/exchange/listings/${item.listing.slug}`" target="_blank" class="btn btn-sm btn-ghost">
                      <i class="fas fa-eye"></i>
                      View
                    </NuxtLink>
                    <button
                      v-if="!item.hasFacebook"
                      @click="retrySocialPost(item.listing.id, ['facebook'])"
                      class="btn btn-sm btn-primary"
                      :class="{ loading: retryingId === item.listing.id }"
                      :disabled="retryingId === item.listing.id"
                    >
                      <i v-if="retryingId !== item.listing.id" class="fas fa-arrows-rotate"></i>
                      Retry FB
                    </button>
                    <button
                      v-if="!item.hasInstagram"
                      @click="retrySocialPost(item.listing.id, ['instagram'])"
                      class="btn btn-sm btn-primary"
                      :class="{ loading: retryingId === item.listing.id }"
                      :disabled="retryingId === item.listing.id"
                    >
                      <i v-if="retryingId !== item.listing.id" class="fas fa-arrows-rotate"></i>
                      Retry IG
                    </button>
                    <button
                      v-if="!item.hasBluesky"
                      @click="retrySocialPost(item.listing.id, ['bluesky'])"
                      class="btn btn-sm btn-primary"
                      :class="{ loading: retryingId === item.listing.id }"
                      :disabled="retryingId === item.listing.id"
                    >
                      <i v-if="retryingId !== item.listing.id" class="fas fa-arrows-rotate"></i>
                      Retry Bsky
                    </button>
                  </div>
                </div>
              </div>

              <!-- Last retry diagnostics — shown after a retry attempt returns failures -->
              <div v-if="retryErrors[item.listing.id]" class="mt-3 space-y-2">
                <div
                  v-for="(detail, platform) in retryErrors[item.listing.id]"
                  :key="platform"
                  class="alert alert-error alert-soft text-sm"
                >
                  <i class="fas fa-triangle-exclamation shrink-0"></i>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold capitalize">{{ platform }} failed</div>
                    <div class="break-words">{{ detail.error }}</div>
                    <details v-if="hasDiagnostics(detail)" class="mt-2">
                      <summary class="cursor-pointer text-xs opacity-80 hover:opacity-100">
                        Diagnostic details
                      </summary>
                      <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <template v-if="detail.errorCode !== undefined">
                          <dt class="opacity-70">Code</dt>
                          <dd><code>{{ detail.errorCode }}</code></dd>
                        </template>
                        <template v-if="detail.errorSubcode !== undefined">
                          <dt class="opacity-70">Subcode</dt>
                          <dd><code>{{ detail.errorSubcode }}</code></dd>
                        </template>
                        <template v-if="detail.errorType">
                          <dt class="opacity-70">Type</dt>
                          <dd><code>{{ detail.errorType }}</code></dd>
                        </template>
                        <template v-if="detail.userMessage">
                          <dt class="opacity-70">User msg</dt>
                          <dd class="break-words">{{ detail.userMessage }}</dd>
                        </template>
                        <template v-if="detail.fbtraceId">
                          <dt class="opacity-70">fbtrace_id</dt>
                          <dd class="flex items-center gap-2 min-w-0">
                            <code class="truncate flex-1 min-w-0">{{ detail.fbtraceId }}</code>
                            <button
                              type="button"
                              class="btn btn-xs btn-ghost shrink-0"
                              :title="`Copy ${detail.fbtraceId}`"
                              @click="copyToClipboard(detail.fbtraceId!)"
                            >
                              <i class="fas fa-clipboard text-xs"></i>
                              Copy
                            </button>
                          </dd>
                        </template>
                      </dl>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pending Social Media Posts -->
    <div class="card bg-base-100 shadow mb-8">
      <div class="card-body">
        <h2 class="card-title mb-4">
          <i class="fas fa-clock"></i>
          Pending Social Media Posts
        </h2>

        <div v-if="loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div v-else-if="pendingSocialPromotions.length === 0" class="text-center py-8 text-base-content/50">
          <i class="fas fa-circle-check text-4xl mx-auto mb-2 opacity-50"></i>
          <p>No pending social media posts</p>
        </div>

        <div v-else>
          <!-- Mobile Card View -->
          <div class="md:hidden space-y-4">
            <div v-for="listing in paginatedPending" :key="listing.id" class="card bg-base-200">
              <div class="card-body p-4">
                <div class="flex items-start gap-3 mb-3">
                  <div class="avatar shrink-0">
                    <div class="w-16 h-16 rounded">
                      <img
                        v-if="listing.listing_photos?.[0]"
                        :src="getPhotoUrl(listing.listing_photos[0].storage_path)"
                        :alt="listing.title"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold">{{ listing.title }}</h3>
                    <p class="text-sm text-base-content/70">{{ listing.year }} {{ listing.model }}</p>
                    <div class="mt-2">
                      <ExchangeListingsFeaturedBadge :tier="listing.tier" :featured-until="listing.featured_until" />
                    </div>
                  </div>
                </div>
                <div class="text-sm text-base-content/70 mb-3">
                  <i class="fas fa-calendar inline mr-1"></i>
                  {{ formatDate(listing.created_at) }}
                </div>
                <div class="flex gap-2">
                  <NuxtLink :to="`/exchange/listings/${listing.slug}`" target="_blank" class="btn btn-sm btn-ghost flex-1">
                    <i class="fas fa-eye"></i>
                    View
                  </NuxtLink>
                  <button
                    @click="autoPostToSocials(listing.id)"
                    class="btn btn-primary btn-sm flex-1"
                    :class="{ loading: postingId === listing.id }"
                    :disabled="postingId === listing.id"
                  >
                    <i v-if="postingId !== listing.id" class="fas fa-paper-plane"></i>
                    Post to Socials
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Desktop Table View -->
          <div class="hidden md:block overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th class="cursor-pointer select-none" @click="togglePendingSort('tier')">
                    <span class="flex items-center gap-1">
                      Tier
                      <i
                        class="text-xs"
                        :class="[getPendingSortIcon('tier'), { 'opacity-30': !isPendingSortedBy('tier') }]"
                      ></i>
                    </span>
                  </th>
                  <th class="cursor-pointer select-none" @click="togglePendingSort('created_at')">
                    <span class="flex items-center gap-1">
                      Created
                      <i
                        class="text-xs"
                        :class="[getPendingSortIcon('created_at'), { 'opacity-30': !isPendingSortedBy('created_at') }]"
                      ></i>
                    </span>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="listing in paginatedPending" :key="listing.id">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar">
                        <div class="w-12 h-12 rounded">
                          <img
                            v-if="listing.listing_photos?.[0]"
                            :src="getPhotoUrl(listing.listing_photos[0].storage_path)"
                            :alt="listing.title"
                            loading="lazy"
                          />
                        </div>
                      </div>
                      <div>
                        <div class="font-semibold">{{ listing.title }}</div>
                        <div class="text-sm text-base-content/70">{{ listing.year }} {{ listing.model }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <ExchangeListingsFeaturedBadge :tier="listing.tier" :featured-until="listing.featured_until" />
                  </td>
                  <td>{{ formatDate(listing.created_at) }}</td>
                  <td>
                    <div class="flex gap-2">
                      <NuxtLink
                        :to="`/exchange/listings/${listing.slug}`"
                        target="_blank"
                        class="btn btn-ghost btn-sm"
                        title="View listing"
                      >
                        <i class="fas fa-eye"></i>
                      </NuxtLink>
                      <button
                        @click="autoPostToSocials(listing.id)"
                        class="btn btn-primary btn-sm"
                        :class="{ loading: postingId === listing.id }"
                        :disabled="postingId === listing.id"
                        title="Auto-post to all social platforms"
                      >
                        <i v-if="postingId !== listing.id" class="fas fa-paper-plane"></i>
                        Post
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pending Pagination -->
          <div v-if="pendingTotalPages > 1" class="flex justify-center mt-4">
            <div class="join">
              <button class="join-item btn btn-sm" :disabled="pendingPage <= 1" @click="pendingPage--">
                <i class="fas fa-chevron-left"></i>
              </button>
              <button
                v-for="page in pendingTotalPages"
                :key="page"
                class="join-item btn btn-sm"
                :class="{ 'btn-active': page === pendingPage }"
                @click="pendingPage = page"
              >
                {{ page }}
              </button>
              <button class="join-item btn btn-sm" :disabled="pendingPage >= pendingTotalPages" @click="pendingPage++">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Successfully Posted -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title mb-4">
          <i class="fas fa-circle-check text-success"></i>
          Successfully Posted
        </h2>

        <div v-if="loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div v-else-if="successfulSocialPosts.length === 0" class="text-center py-8 text-base-content/50">
          <i class="fas fa-inbox text-4xl mx-auto mb-2 opacity-50"></i>
          <p>No successfully posted listings yet</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Listing</th>
                <th class="cursor-pointer select-none" @click="toggleSuccessSort('listing.created_at')">
                  <span class="flex items-center gap-1">
                    Posted
                    <i
                      class="text-xs"
                      :class="[getSuccessSortIcon('listing.created_at'), { 'opacity-30': !isSuccessSortedBy('listing.created_at') }]"
                    ></i>
                  </span>
                </th>
                <th>Facebook</th>
                <th>Instagram</th>
                <th>Bluesky</th>
                <th>Listing</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedSuccess" :key="item.listing.id">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="avatar">
                      <div class="w-12 h-12 rounded">
                        <img
                          v-if="item.listing.listing_photos?.[0]"
                          :src="getPhotoUrl(item.listing.listing_photos[0].storage_path)"
                          :alt="item.listing.title"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <div>
                      <div class="font-semibold">{{ item.listing.title }}</div>
                      <div class="text-sm text-base-content/70">{{ item.listing.year }} {{ item.listing.model }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ formatDate(item.listing.created_at) }}</td>
                <td>
                  <a
                    v-if="item.hasFacebook && item.features.facebook_post_id"
                    :href="`https://facebook.com/${item.features.facebook_post_id}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-ghost btn-sm"
                    title="View Facebook post"
                  >
                    <i class="fab fa-facebook"></i>
                    View
                  </a>
                  <span v-else-if="item.hasFacebook" class="text-success flex items-center gap-1">
                    <i class="fas fa-circle-check"></i>
                    Posted
                  </span>
                  <span v-else class="text-base-content/50">-</span>
                </td>
                <td>
                  <a
                    v-if="item.hasInstagram && item.features.instagram_post_id"
                    :href="`https://instagram.com/p/${item.features.instagram_post_id}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-ghost btn-sm"
                    title="View Instagram post"
                  >
                    <i class="fab fa-instagram"></i>
                    View
                  </a>
                  <span v-else-if="item.hasInstagram" class="text-success flex items-center gap-1">
                    <i class="fas fa-circle-check"></i>
                    Posted
                  </span>
                  <span v-else class="text-base-content/50">-</span>
                </td>
                <td>
                  <a
                    v-if="item.hasBluesky && item.features.bluesky_post_id"
                    :href="`https://bsky.app/profile/${blueskyHandle}/post/${item.features.bluesky_post_id}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-ghost btn-sm"
                    title="View Bluesky post"
                  >
                    <i class="fab fa-bluesky text-[#0085FF]"></i>
                    View
                  </a>
                  <span v-else-if="item.hasBluesky" class="text-success flex items-center gap-1">
                    <i class="fas fa-circle-check"></i>
                    Posted
                  </span>
                  <span v-else class="text-base-content/50">-</span>
                </td>
                <td>
                  <NuxtLink
                    :to="`/exchange/listings/${item.listing.slug}`"
                    target="_blank"
                    class="btn btn-ghost btn-sm"
                    title="View listing"
                  >
                    <i class="fas fa-eye"></i>
                    View
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Success Pagination -->
          <div v-if="successTotalPages > 1" class="flex justify-center mt-4">
            <div class="join">
              <button class="join-item btn btn-sm" :disabled="successPage <= 1" @click="successPage--">
                <i class="fas fa-chevron-left"></i>
              </button>
              <button
                v-for="page in successTotalPages"
                :key="page"
                class="join-item btn btn-sm"
                :class="{ 'btn-active': page === successPage }"
                @click="successPage = page"
              >
                {{ page }}
              </button>
              <button class="join-item btn btn-sm" :disabled="successPage >= successTotalPages" @click="successPage++">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ListingWithPhotos } from '~/composables/useListings';

  interface SocialPostInfo {
    listing: ListingWithPhotos;
    hasFacebook: boolean;
    hasInstagram: boolean;
    hasBluesky: boolean;
    features: Record<string, unknown>;
  }

  // Bluesky handle for constructing post URLs
  const blueskyHandle = useRuntimeConfig().public.blueskyHandle || 'theminiexchange.bsky.social';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Social Posting - Admin - The Mini Exchange',
    meta: [
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  });

  const supabase = useSupabase();
  const toast = useToast();
  const { getPhotoUrl } = useListings();
  const {
    toggleSort: togglePendingSort,
    getSortIcon: getPendingSortIcon,
    isSortedBy: isPendingSortedBy,
    sortFn: pendingSortFn,
  } = useTableSort('created_at', 'desc');
  const {
    toggleSort: toggleSuccessSort,
    getSortIcon: getSuccessSortIcon,
    isSortedBy: isSuccessSortedBy,
    sortFn: successSortFn,
  } = useTableSort('listing.created_at', 'desc');

  const PAGE_SIZE = 25;

  // Mirrors the server-side SocialPostResult shape (kept inline to avoid a
  // client-side import of server-only code).
  interface PlatformErrorDetail {
    error?: string;
    errorCode?: number;
    errorSubcode?: number;
    errorType?: string;
    fbtraceId?: string;
    userMessage?: string;
  }
  type PlatformKey = 'facebook' | 'instagram' | 'bluesky';
  type ListingErrorMap = Partial<Record<PlatformKey, PlatformErrorDetail>>;

  const loading = ref(true);
  const retryingId = ref<string | null>(null);
  const postingId = ref<string | null>(null);
  const pendingSocialPromotions = ref<ListingWithPhotos[]>([]);
  const failedSocialPosts = ref<SocialPostInfo[]>([]);
  const successfulSocialPosts = ref<SocialPostInfo[]>([]);
  // Per-listing diagnostic detail from the most recent retry attempt.
  const retryErrors = ref<Record<string, ListingErrorMap>>({});

  const hasDiagnostics = (detail: PlatformErrorDetail): boolean =>
    detail.errorCode !== undefined ||
    detail.errorSubcode !== undefined ||
    !!detail.fbtraceId ||
    !!detail.errorType ||
    !!detail.userMessage;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.add({ title: 'Copied', description: text, color: 'success' });
    } catch {
      toast.add({ title: 'Copy failed', description: 'Clipboard unavailable', color: 'error' });
    }
  };

  /** Pluck only the diagnostic fields off a result, skipping `success`/`postId`. */
  const pickErrorDetail = (result: any): PlatformErrorDetail => ({
    error: result?.error,
    errorCode: result?.errorCode,
    errorSubcode: result?.errorSubcode,
    errorType: result?.errorType,
    fbtraceId: result?.fbtraceId,
    userMessage: result?.userMessage,
  });

  /** Format a one-line summary safe for a toast (no fbtrace dumps). */
  const formatPlatformError = (platform: string, detail: PlatformErrorDetail): string => {
    const name = platform.charAt(0).toUpperCase() + platform.slice(1);
    return `${name}: ${detail.error || 'Unknown error'}`;
  };

  // Pagination
  const pendingPage = ref(1);
  const successPage = ref(1);

  const pendingTotalPages = computed(() => Math.ceil(pendingSocialPromotions.value.length / PAGE_SIZE));
  const successTotalPages = computed(() => Math.ceil(successfulSocialPosts.value.length / PAGE_SIZE));

  const sortedPending = computed(() => [...pendingSocialPromotions.value].sort(pendingSortFn));
  const sortedSuccess = computed(() => [...successfulSocialPosts.value].sort(successSortFn));

  const paginatedPending = computed(() => {
    const start = (pendingPage.value - 1) * PAGE_SIZE;
    return sortedPending.value.slice(start, start + PAGE_SIZE);
  });

  const paginatedSuccess = computed(() => {
    const start = (successPage.value - 1) * PAGE_SIZE;
    return sortedSuccess.value.slice(start, start + PAGE_SIZE);
  });

  // Load social posting data
  const loadSocialPosts = async () => {
    loading.value = true;
    pendingPage.value = 1;
    successPage.value = 1;

    try {
      // Fetch all active listings that need social media promotion
      const { data: socialData, error: socialError } = await applyPhotoOrdering(
        supabase
          .from('listings')
          .select(
            `
          *,
          listing_photos (
            id,
            storage_path,
            display_order,
            category
          )
        `
          )
          .eq('promoted_on_social', false)
          .eq('status', 'active')
          .not('status', 'in', '("example_free","example_paid")')
          .order('created_at', { ascending: false })
      );

      if (socialError) throw socialError;
      pendingSocialPromotions.value = socialData as ListingWithPhotos[];

      // Fetch listings with promotions data to determine success/failure status
      try {
        const { data: promotionData } = await supabase.from('listing_promotions').select('id, listing_id, features');

        if (promotionData && promotionData.length > 0) {
          const listingIds = promotionData.map((p) => p.listing_id);

          // Fetch listing details
          const { data: listingsData } = await applyPhotoOrdering(
            supabase
              .from('listings')
              .select(
                `
                id,
                title,
                slug,
                year,
                model,
                tier,
                payment_status,
                created_at,
                listing_photos (
                  id,
                  storage_path,
                  display_order,
                  category
                )
              `
              )
              .in('id', listingIds)
              .not('status', 'in', '("example_free","example_paid")')
              .order('created_at', { ascending: false })
          );

          if (listingsData) {
            const failed: SocialPostInfo[] = [];
            const successful: SocialPostInfo[] = [];

            for (const listing of listingsData) {
              const promo = promotionData.find((p) => p.listing_id === listing.id);
              if (!promo) continue;

              const features = (promo.features || {}) as Record<string, unknown>;
              const hasFacebook = !!features.facebook_post_id;
              const hasInstagram = !!features.instagram_post_id;
              const hasBluesky = !!features.bluesky_post_id;

              const postInfo: SocialPostInfo = {
                listing: listing as ListingWithPhotos,
                hasFacebook,
                hasInstagram,
                hasBluesky,
                features,
              };

              // Partial failure: at least one platform but not all three
              if ((hasFacebook || hasInstagram || hasBluesky) && !(hasFacebook && hasInstagram && hasBluesky)) {
                failed.push(postInfo);
              }
              // Success: all three platforms
              else if (hasFacebook && hasInstagram && hasBluesky) {
                successful.push(postInfo);
              }
            }

            failedSocialPosts.value = failed;
            successfulSocialPosts.value = successful;
          }
        }
      } catch (promoErr) {
        console.warn('Failed to fetch social post status:', promoErr);
      }
    } catch (error: any) {
      console.error('Failed to load social posts:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load social posting data',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  // Auto-post a listing to all social media platforms
  const autoPostToSocials = async (listingId: string) => {
    postingId.value = listingId;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await $fetch('/api/admin/exchange/social-retry', {
        method: 'POST',
        body: { listingId, platforms: ['facebook', 'instagram', 'bluesky'] },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.allSucceeded) {
        delete retryErrors.value[listingId];
        toast.add({
          title: 'Success',
          description: 'Successfully posted to all platforms',
          color: 'success',
        });
      } else {
        const errorMap: ListingErrorMap = {};
        const failures: string[] = [];
        for (const [platform, result] of Object.entries(response.results)) {
          if (!result || result.success) continue;
          const detail = pickErrorDetail(result);
          errorMap[platform as PlatformKey] = detail;
          failures.push(formatPlatformError(platform, detail));
        }
        retryErrors.value = { ...retryErrors.value, [listingId]: errorMap };

        toast.add({
          title: 'Partial Success',
          description: failures.length > 0 ? failures.join('. ') : 'Some platforms may have failed',
          color: 'warning',
        });
      }

      await loadSocialPosts();
    } catch (error: any) {
      console.error('Failed to post to social media:', error);
      toast.add({
        title: 'Error',
        description: error?.data?.message || 'Failed to post to social media',
        color: 'error',
      });
    } finally {
      postingId.value = null;
    }
  };

  // Retry social media post for failed platforms
  const retrySocialPost = async (listingId: string, platforms: ('facebook' | 'instagram' | 'bluesky')[]) => {
    retryingId.value = listingId;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await $fetch('/api/admin/exchange/social-retry', {
        method: 'POST',
        body: { listingId, platforms },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.allSucceeded) {
        // Clear stale diagnostics for the platforms we just successfully retried.
        const remaining = { ...(retryErrors.value[listingId] || {}) };
        for (const platform of platforms) delete remaining[platform];
        if (Object.keys(remaining).length === 0) {
          const next = { ...retryErrors.value };
          delete next[listingId];
          retryErrors.value = next;
        } else {
          retryErrors.value = { ...retryErrors.value, [listingId]: remaining };
        }

        toast.add({
          title: 'Success',
          description: `Successfully posted to ${platforms.join(' and ')}`,
          color: 'success',
        });
      } else {
        const errorMap: ListingErrorMap = { ...(retryErrors.value[listingId] || {}) };
        const failures: string[] = [];
        for (const [platform, result] of Object.entries(response.results)) {
          if (!result) continue;
          if (result.success) {
            delete errorMap[platform as PlatformKey];
            continue;
          }
          const detail = pickErrorDetail(result);
          errorMap[platform as PlatformKey] = detail;
          failures.push(formatPlatformError(platform, detail));
        }
        retryErrors.value = { ...retryErrors.value, [listingId]: errorMap };

        toast.add({
          title: 'Partial Failure',
          description: failures.length > 0 ? failures.join('. ') : 'Some platforms failed',
          color: 'warning',
        });
      }

      await loadSocialPosts();
    } catch (error: any) {
      console.error('Failed to retry social post:', error);
      toast.add({
        title: 'Error',
        description: error?.data?.message || 'Failed to retry social media post',
        color: 'error',
      });
    } finally {
      retryingId.value = null;
    }
  };

  onMounted(() => {
    loadSocialPosts();
  });
</script>
