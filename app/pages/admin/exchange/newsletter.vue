<template>
  <AdminExchangeShell>
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">Weekly Newsletter</h1>
      <p class="text-base-content/70">Manage the weekly digest sent to all subscribers</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid md:grid-cols-4 gap-4 mb-8">
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <i class="fas fa-users text-xl text-primary"></i>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ preview?.subscriberCount || 0 }}</div>
              <div class="text-sm text-base-content/70">Total Subscribers</div>
              <div v-if="preview?.shopifySubscriberCount" class="text-xs text-base-content/50 mt-0.5">
                {{ preview.profileSubscriberCount }} TME + {{ preview.shopifySubscriberCount }} Shopify
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
              <i class="far fa-star text-xl text-success"></i>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ preview?.totalPremiumThisWeek || 0 }}</div>
              <div class="text-sm text-base-content/70">Premium Listings</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
              <i class="fas fa-list text-xl text-info"></i>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ preview?.totalFreeThisWeek || 0 }}</div>
              <div class="text-sm text-base-content/70">Free Listings</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
              <i class="fas fa-clock text-xl text-warning"></i>
            </div>
            <div>
              <div class="text-2xl font-bold">{{ lastSentDisplay }}</div>
              <div class="text-sm text-base-content/70">Last Sent</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Newsletter Preview -->
    <div class="card bg-base-100 shadow mb-8">
      <div class="card-body">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 class="card-title">
              <i class="fas fa-eye text-xl"></i>
              Newsletter Preview
            </h2>
            <p class="text-sm text-base-content/70 mt-1">
              These {{ preview?.totalCount || 0 }} listings will be included in the next newsletter
            </p>
          </div>
          <div class="flex gap-2">
            <button @click="refreshPreview" class="btn btn-ghost btn-sm" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner loading-xs"></span>
              <i v-else class="fas fa-arrows-rotate"></i>
              Refresh
            </button>
          </div>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div v-else-if="!preview?.listings?.length" class="text-center py-12 text-base-content/50">
          <i class="fas fa-inbox text-4xl mx-auto mb-2 opacity-50"></i>
          <p>No listings available for this week's newsletter</p>
        </div>

        <div v-else>
          <iframe
            ref="emailPreviewFrame"
            :srcdoc="preview.emailHtml"
            class="w-full border border-base-300 rounded-lg"
            style="min-height: 600px"
            sandbox="allow-same-origin"
            @load="resizeIframe"
          ></iframe>
        </div>

        <!-- Actions -->
        <div class="divider"></div>
        <div class="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div class="text-sm text-base-content/70">
            <template v-if="!canSendNewsletter">
              <i class="fas fa-clock inline mr-1"></i>
              Next send available in {{ daysUntilNextSend }} day{{ daysUntilNextSend === 1 ? '' : 's' }}
            </template>
            <template v-else>
              <i class="fas fa-circle-check inline mr-1 text-success"></i>
              Ready to send
            </template>
          </div>
          <div class="flex gap-2">
            <button @click="openTestModal" class="btn btn-outline btn-sm" :disabled="!preview?.listings?.length">
              <i class="fas fa-paper-plane"></i>
              Send Test Email
            </button>
            <button
              @click="openSendModal"
              class="btn btn-primary btn-sm"
              :disabled="!preview?.listings?.length || sending"
            >
              <i class="fas fa-envelope"></i>
              Send to All ({{ preview?.subscriberCount || 0 }})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Send History -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title mb-4">
          <i class="fas fa-clock text-xl"></i>
          Send History
        </h2>

        <div v-if="historyLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="sendHistory.length === 0" class="text-center py-8 text-base-content/50">
          <i class="fas fa-boxes-stacked text-4xl mx-auto mb-2 opacity-50"></i>
          <p>No newsletters have been sent yet</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="cursor-pointer select-none" @click="toggleSort('sent_at')">
                  <span class="flex items-center gap-1">
                    Date
                    <i
                      class="text-xs"
                      :class="[getSortIcon('sent_at'), { 'opacity-30': !isSortedBy('sent_at') }]"
                    ></i>
                  </span>
                </th>
                <th class="cursor-pointer select-none" @click="toggleSort('recipient_count')">
                  <span class="flex items-center gap-1">
                    Recipients
                    <i
                      class="text-xs"
                      :class="[getSortIcon('recipient_count'), { 'opacity-30': !isSortedBy('recipient_count') }]"
                    ></i>
                  </span>
                </th>
                <th>Listings</th>
                <th class="cursor-pointer select-none" @click="toggleSort('status')">
                  <span class="flex items-center gap-1">
                    Status
                    <i
                      class="text-xs"
                      :class="[getSortIcon('status'), { 'opacity-30': !isSortedBy('status') }]"
                    ></i>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in sortedHistory" :key="record.id">
                <td>{{ formatDateTime(record.sent_at) }}</td>
                <td>{{ record.recipient_count }}</td>
                <td>
                  <span class="badge badge-success badge-sm mr-1">{{ record.premium_count }} premium</span>
                  <span v-if="record.free_count > 0" class="badge badge-info badge-sm"
                    >{{ record.free_count }} free</span
                  >
                </td>
                <td>
                  <span :class="getStatusBadgeClass(record.status)">
                    {{ record.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Test Email Modal -->
    <dialog ref="testModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Send Test Email</h3>
        <p class="text-base-content/70 mb-4">
          Send a test newsletter to preview how it will look. The email will be marked as a test.
        </p>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Email Address</legend>
          <input v-model="testEmail" type="email" placeholder="your@email.com" class="input input-bordered w-full" />
          <p class="text-xs text-base-content/50 mt-1">Leave blank to send to your account email</p>
        </fieldset>
        <div class="modal-action">
          <button @click="closeTestModal" class="btn btn-ghost">Cancel</button>
          <button @click="handleSendTest" class="btn btn-primary" :disabled="testSending">
            <span v-if="testSending" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-paper-plane"></i>
            Send Test
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Send Confirmation Modal -->
    <dialog ref="sendModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Send Newsletter to All Subscribers</h3>
        <div class="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
          <p class="text-sm">
            <i class="fas fa-triangle-exclamation inline mr-1 text-warning"></i>
            This will send the newsletter to <strong>{{ preview?.subscriberCount || 0 }}</strong> subscribers.
          </p>
          <p v-if="preview?.shopifySubscriberCount" class="text-xs text-base-content/50 mt-1 ml-6">
            {{ preview.profileSubscriberCount }} TME users + {{ preview.shopifySubscriberCount }} Shopify marketing subscribers
          </p>
        </div>
        <p class="text-base-content/70 mb-4">
          The newsletter will include {{ preview?.totalCount || 0 }} listings ({{ preview?.premiumCount || 0 }} premium,
          {{ preview?.freeCount || 0 }} free).
        </p>
        <template v-if="!canSendNewsletter">
          <div class="bg-info/10 border border-info/30 rounded-lg p-4 mb-4">
            <p class="text-sm">
              <i class="fas fa-circle-info inline mr-1 text-info"></i>
              Newsletter was sent within the last 6 days. You can still send with override if needed.
            </p>
          </div>
          <label class="flex items-center gap-2 mb-4 cursor-pointer">
            <input v-model="forceOverride" type="checkbox" class="checkbox checkbox-sm" />
            <span class="text-sm">Override and send anyway</span>
          </label>
        </template>
        <div class="modal-action">
          <button @click="closeSendModal" class="btn btn-ghost">Cancel</button>
          <button
            @click="handleSendToAll"
            class="btn btn-primary"
            :disabled="sending || (!canSendNewsletter && !forceOverride)"
          >
            <span v-if="sending" class="loading loading-spinner loading-sm"></span>
            <i v-else class="fas fa-envelope"></i>
            Send Newsletter
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
  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Weekly Newsletter - Admin - The Mini Exchange',
  });

  useSeoMeta({
    robots: 'noindex, nofollow',
  });

  const {
    loading,
    sending,
    testSending,
    preview,
    sendHistory,
    historyLoading,
    canSendNewsletter,
    daysUntilNextSend,
    fetchPreview,
    sendTestEmail,
    sendToAllSubscribers,
    fetchSendHistory,
  } = useNewsletter();

  const { toggleSort, getSortIcon, isSortedBy, sortFn } = useTableSort('sent_at', 'desc');

  const testModal = ref<HTMLDialogElement | null>(null);
  const sendModal = ref<HTMLDialogElement | null>(null);
  const emailPreviewFrame = ref<HTMLIFrameElement | null>(null);
  const testEmail = ref('');
  const forceOverride = ref(false);

  const resizeIframe = () => {
    const iframe = emailPreviewFrame.value;
    if (iframe?.contentDocument?.body) {
      iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + 'px';
    }
  };

  const sortedHistory = computed(() => [...sendHistory.value].sort(sortFn));

  // Computed

  const lastSentDisplay = computed(() => {
    if (!preview.value?.lastSentAt) return 'Never';
    const date = new Date(preview.value.lastSentAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDateTime(preview.value.lastSentAt);
  });

  // Methods
  const refreshPreview = async () => {
    await fetchPreview();
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'sending':
        return 'badge badge-info';
      case 'sent':
        return 'badge badge-success';
      case 'partial':
        return 'badge badge-warning';
      case 'failed':
        return 'badge badge-error';
      default:
        return 'badge';
    }
  };

  const openTestModal = () => {
    testEmail.value = '';
    testModal.value?.showModal();
  };

  const closeTestModal = () => {
    testModal.value?.close();
  };

  const handleSendTest = async () => {
    const success = await sendTestEmail(testEmail.value || undefined);
    if (success) {
      closeTestModal();
    }
  };

  const openSendModal = () => {
    forceOverride.value = false;
    sendModal.value?.showModal();
  };

  const closeSendModal = () => {
    sendModal.value?.close();
  };

  const handleSendToAll = async () => {
    const success = await sendToAllSubscribers(forceOverride.value);
    if (success) {
      closeSendModal();
    }
  };

  // Load data on mount
  onMounted(async () => {
    await Promise.all([fetchPreview(), fetchSendHistory()]);
  });
</script>
