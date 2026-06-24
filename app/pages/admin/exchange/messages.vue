<template>
  <div>
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold">Message Management</h1>
        <p class="text-base-content/70 mt-2">Review reported messages and browse conversations</p>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="loading" @click="refreshCurrentTab">
        <i class="fas fa-arrows-rotate" :class="{ 'animate-spin': loading }"></i>
        Refresh
      </button>
    </div>

    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-border mb-6">
      <button role="tab" class="tab" :class="{ 'tab-active': activeTab === 'queue' }" @click="activeTab = 'queue'">
        Moderation Queue
        <span v-if="queueCount > 0" class="badge badge-error badge-sm ml-2">{{ queueCount }}</span>
      </button>
      <button role="tab" class="tab" :class="{ 'tab-active': activeTab === 'browser' }" @click="activeTab = 'browser'">
        Conversation Browser
      </button>
    </div>

    <!-- Moderation Queue Tab -->
    <div v-if="activeTab === 'queue'">
      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="skeleton h-48 w-full"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="queueItems.length === 0" class="text-center py-20 card bg-base-100 shadow-sm">
        <i class="fas fa-circle-check text-7xl mx-auto mb-4 text-success/50"></i>
        <h3 class="text-2xl font-semibold mb-2">All Clear</h3>
        <p class="text-base-content/70">No messages need moderation review</p>
      </div>

      <!-- Queue Items -->
      <div v-else class="space-y-4">
        <div v-for="item in queueItems" :key="item.id" class="card bg-base-100 shadow-sm">
          <div class="card-body">
            <!-- Header: sender info + report reason -->
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="avatar placeholder">
                  <div class="bg-neutral text-neutral-content w-10 rounded-full flex items-center justify-center">
                    <span>{{ getInitials(item.sender?.display_name || item.sender?.email) }}</span>
                  </div>
                </div>
                <div>
                  <div class="font-bold">{{ item.sender?.display_name || item.sender?.email || 'Unknown' }}</div>
                  <div class="text-sm text-base-content/70">{{ item.sender?.email }}</div>
                  <div class="flex gap-1 mt-1">
                    <span v-if="(item.sender?.warning_count || 0) > 0" class="badge badge-warning badge-xs">
                      {{ item.sender?.warning_count }} warning{{ (item.sender?.warning_count || 0) > 1 ? 's' : '' }}
                    </span>
                    <span v-if="item.sender?.is_banned" class="badge badge-error badge-xs">Banned</span>
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs text-base-content/50">{{ formatDate(item.created_at) }}</div>
                <div v-if="item.reported_at" class="text-xs text-error mt-1">
                  Reported {{ formatDate(item.reported_at) }}
                </div>
              </div>
            </div>

            <!-- Report reason or auto-detection issues -->
            <div class="mt-3">
              <div v-if="item.report_reason" class="alert alert-error py-2">
                <i class="fas fa-flag"></i>
                <span class="text-sm"><strong>User report:</strong> {{ item.report_reason }}</span>
              </div>
              <div v-else-if="item.moderation_issues?.length" class="alert alert-warning py-2">
                <i class="fas fa-triangle-exclamation"></i>
                <span class="text-sm"> <strong>Auto-detected:</strong> {{ item.moderation_issues.join(', ') }} </span>
              </div>
            </div>

            <!-- Flagged message content -->
            <div class="bg-base-200 rounded-lg p-4 mt-2">
              <p class="whitespace-pre-wrap break-words">{{ item.content }}</p>
            </div>

            <!-- Conversation context -->
            <div v-if="item.conversation" class="mt-2 text-sm text-base-content/70">
              <span>Conversation between </span>
              <strong>{{ item.conversation.buyer?.display_name || item.conversation.buyer?.email }}</strong>
              <span> and </span>
              <strong>{{ item.conversation.seller?.display_name || item.conversation.seller?.email }}</strong>
              <span v-if="item.conversation.listing"> about </span>
              <NuxtLink
                v-if="item.conversation.listing"
                :to="`/exchange/listings/${item.conversation.listing.slug}`"
                class="link link-primary"
              >
                {{ item.conversation.listing.title }}
              </NuxtLink>
            </div>

            <!-- Action buttons -->
            <div class="card-actions justify-end mt-4">
              <button class="btn btn-ghost btn-sm" @click="handleDismiss(item.id)">
                <i class="fas fa-check"></i>
                Dismiss
              </button>
              <button class="btn btn-warning btn-sm" @click="openWarnModal(item)">
                <i class="fas fa-triangle-exclamation"></i>
                Warn User
              </button>
              <button class="btn btn-error btn-sm" @click="handleDeleteMessage(item)">
                <i class="fas fa-trash"></i>
                Delete Message
              </button>
              <button
                v-if="!item.sender?.is_banned"
                class="btn btn-error btn-outline btn-sm"
                @click="handleBanUser(item.sender!)"
              >
                <i class="fas fa-ban"></i>
                Ban User
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Queue Pagination -->
      <div v-if="!loading && queueTotalPages > 1" class="flex justify-center mt-8">
        <div class="join">
          <button class="join-item btn" :disabled="queuePage === 1" @click="queuePage--">«</button>
          <button class="join-item btn">Page {{ queuePage }} of {{ queueTotalPages }}</button>
          <button class="join-item btn" :disabled="queuePage === queueTotalPages" @click="queuePage++">»</button>
        </div>
      </div>
    </div>

    <!-- Conversation Browser Tab -->
    <div v-if="activeTab === 'browser'">
      <!-- Filters -->
      <div class="card bg-base-100 shadow-sm mb-6">
        <div class="card-body py-4">
          <div class="flex flex-wrap gap-4 items-end">
            <div class="form-control flex-1">
              <label class="label"><span class="label-text">Search</span></label>
              <input
                v-model="browserSearch"
                type="text"
                placeholder="Search by user name or email..."
                class="input input-bordered w-full"
              />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Flagged Only</span></label>
              <input v-model="browserFlaggedOnly" type="checkbox" class="toggle toggle-error" />
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="skeleton h-20 w-full"></div>
      </div>

      <!-- Conversations list -->
      <div v-else-if="conversations.length > 0" class="space-y-2">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="card bg-base-100 shadow-sm cursor-pointer hover:bg-base-200 transition-colors"
          @click="toggleConversation(conv.id)"
        >
          <div class="card-body py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div>
                  <span class="font-medium">{{ conv.buyer?.display_name || conv.buyer?.email }}</span>
                  <i class="fas fa-right-left mx-2 text-base-content/50"></i>
                  <span class="font-medium">{{ conv.seller?.display_name || conv.seller?.email }}</span>
                </div>
                <span v-if="conv.listing" class="badge badge-ghost badge-sm">
                  {{ conv.listing.title }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-base-content/50">{{ formatDate(conv.last_message_at) }}</span>
                <i :class="expandedConversation === conv.id ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
              </div>
            </div>
          </div>

          <!-- Expanded conversation detail -->
          <div v-if="expandedConversation === conv.id" class="border-t border-base-300" @click.stop>
            <div class="p-4 max-h-96 overflow-y-auto space-y-3">
              <div v-if="loadingMessages" class="flex justify-center py-4">
                <span class="loading loading-spinner"></span>
              </div>
              <div v-else>
                <div
                  v-for="msg in expandedMessages"
                  :key="msg.id"
                  class="flex gap-3 p-2 rounded-lg"
                  :class="{
                    'bg-error/10': msg.deleted_at,
                    'bg-warning/10': msg.moderation_status === 'flagged' && !msg.deleted_at,
                    'bg-info/10': msg.is_system_message,
                  }"
                >
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm">
                        {{ msg.sender?.display_name || msg.sender?.email || 'Unknown' }}
                      </span>
                      <span class="text-xs text-base-content/50">{{ formatDate(msg.created_at) }}</span>
                      <span v-if="msg.is_system_message" class="badge badge-info badge-xs">System</span>
                      <span v-if="msg.moderation_status === 'flagged'" class="badge badge-warning badge-xs"
                        >Flagged</span
                      >
                      <span v-if="msg.deleted_at" class="badge badge-error badge-xs">Deleted</span>
                    </div>
                    <p class="text-sm mt-1 whitespace-pre-wrap" :class="{ 'line-through opacity-50': msg.deleted_at }">
                      {{ msg.content }}
                    </p>
                  </div>
                  <!-- Inline actions -->
                  <div v-if="!msg.deleted_at && !msg.is_system_message" class="flex gap-1 shrink-0">
                    <button
                      class="btn btn-ghost btn-xs"
                      title="Delete message"
                      aria-label="Delete message"
                      @click="handleDeleteMessage(msg)"
                    >
                      <i class="fas fa-trash text-error"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-20 card bg-base-100 shadow-sm">
        <i class="fas fa-comments text-7xl mx-auto mb-4 text-base-content/30"></i>
        <h3 class="text-2xl font-semibold mb-2">No Conversations</h3>
        <p class="text-base-content/70">No conversations found</p>
      </div>

      <!-- Browser Pagination -->
      <div v-if="!loading && browserTotalPages > 1" class="flex justify-center mt-8">
        <div class="join">
          <button class="join-item btn" :disabled="browserPage === 1" @click="browserPage--">«</button>
          <button class="join-item btn">Page {{ browserPage }} of {{ browserTotalPages }}</button>
          <button class="join-item btn" :disabled="browserPage === browserTotalPages" @click="browserPage++">»</button>
        </div>
      </div>
    </div>

    <!-- Warn User Modal -->
    <dialog ref="warnModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Warn User</h3>
        <p class="py-2 text-base-content/70">
          Send a warning to <strong>{{ warnTarget?.sender?.display_name || warnTarget?.sender?.email }}</strong
          >. This will inject a system message into the conversation and increment their warning count.
        </p>
        <div class="mt-2">
          <textarea
            v-model="warnReason"
            class="textarea textarea-bordered w-full"
            rows="3"
            placeholder="Optional: reason for the warning..."
          ></textarea>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeWarnModal">Cancel</button>
          <button class="btn btn-warning" :disabled="warningSending" @click="handleWarnUser">
            <span v-if="warningSending" class="loading loading-spinner loading-sm"></span>
            Send Warning
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Ban Confirmation Modal -->
    <dialog ref="banModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Ban User</h3>
        <p class="py-4">
          Are you sure you want to ban
          <strong>{{ banTarget?.display_name || banTarget?.email }}</strong
          >? This will prevent them from logging in and using the platform.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeBanModal">Cancel</button>
          <button class="btn btn-error" @click="handleConfirmBan">Ban User</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
  import type { MessageQueueItem, AdminConversation } from '~/composables/useAdmin';

  definePageMeta({
    layout: 'admin',
  });

  useHead({
    title: 'Message Management - Admin - The Mini Exchange',
  });

  useSeoMeta({
    robots: 'noindex, nofollow',
  });

  const {
    getMessageQueue,
    getMessageQueueCount,
    getAdminConversations,
    getAdminConversationMessages,
    adminDeleteMessage,
    adminWarnUser,
    dismissReport,
    toggleUserBan,
  } = useAdmin();
  const toast = useToast();

  // Shared state
  const loading = ref(false);
  const activeTab = ref<'queue' | 'browser'>('queue');

  // Queue state
  const queueItems = ref<MessageQueueItem[]>([]);
  const queueCount = ref(0);
  const queuePage = ref(1);
  const queueTotal = ref(0);
  const itemsPerPage = 20;
  const queueTotalPages = computed(() => Math.ceil(queueTotal.value / itemsPerPage));

  // Browser state
  const conversations = ref<AdminConversation[]>([]);
  const browserPage = ref(1);
  const browserTotal = ref(0);
  const browserSearch = ref('');
  const browserFlaggedOnly = ref(false);
  const browserTotalPages = computed(() => Math.ceil(browserTotal.value / itemsPerPage));
  const expandedConversation = ref<string | null>(null);
  const expandedMessages = ref<any[]>([]);
  const loadingMessages = ref(false);

  // Warn modal state
  const warnModal = ref<HTMLDialogElement | null>(null);
  const warnTarget = ref<MessageQueueItem | null>(null);
  const warnReason = ref('');
  const warningSending = ref(false);

  // Ban modal state
  const banModal = ref<HTMLDialogElement | null>(null);
  const banTarget = ref<any>(null);

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Data loading
  const loadQueue = async () => {
    loading.value = true;
    try {
      const [result, count] = await Promise.all([
        getMessageQueue(queuePage.value, itemsPerPage),
        getMessageQueueCount(),
      ]);
      queueItems.value = result.items;
      queueTotal.value = result.total;
      queueCount.value = count;
    } catch (error: any) {
      console.error('Error loading queue:', error);
      toast.add({ title: 'Error', description: error.message || 'Failed to load moderation queue', color: 'error' });
    } finally {
      loading.value = false;
    }
  };

  const loadConversations = async () => {
    loading.value = true;
    try {
      const result = await getAdminConversations(browserPage.value, itemsPerPage, {
        search: browserSearch.value || undefined,
        flaggedOnly: browserFlaggedOnly.value,
      });
      conversations.value = result.conversations;
      browserTotal.value = result.total;
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      toast.add({ title: 'Error', description: error.message || 'Failed to load conversations', color: 'error' });
    } finally {
      loading.value = false;
    }
  };

  const toggleConversation = async (conversationId: string) => {
    if (expandedConversation.value === conversationId) {
      expandedConversation.value = null;
      expandedMessages.value = [];
      return;
    }

    expandedConversation.value = conversationId;
    loadingMessages.value = true;
    try {
      expandedMessages.value = await getAdminConversationMessages(conversationId);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.add({ title: 'Error', description: 'Failed to load messages', color: 'error' });
    } finally {
      loadingMessages.value = false;
    }
  };

  const refreshCurrentTab = () => {
    if (activeTab.value === 'queue') loadQueue();
    else loadConversations();
  };

  // Actions
  const handleDismiss = async (messageId: string) => {
    try {
      await dismissReport(messageId);
      toast.add({ title: 'Dismissed', description: 'Report has been dismissed', color: 'success' });
      await loadQueue();
    } catch (error: any) {
      toast.add({ title: 'Error', description: error.message, color: 'error' });
    }
  };

  const handleDeleteMessage = async (item: any) => {
    try {
      await adminDeleteMessage(item.id, item.conversation_id, item.sender_id);
      toast.add({ title: 'Deleted', description: 'Message has been deleted', color: 'success' });
      if (activeTab.value === 'queue') await loadQueue();
      else if (expandedConversation.value) {
        expandedMessages.value = await getAdminConversationMessages(expandedConversation.value);
      }
    } catch (error: any) {
      toast.add({ title: 'Error', description: error.message, color: 'error' });
    }
  };

  const openWarnModal = (item: MessageQueueItem) => {
    warnTarget.value = item;
    warnReason.value = '';
    warnModal.value?.showModal();
  };

  const closeWarnModal = () => {
    warnModal.value?.close();
    warnTarget.value = null;
  };

  const handleWarnUser = async () => {
    if (!warnTarget.value) return;

    warningSending.value = true;
    try {
      await adminWarnUser(
        warnTarget.value.sender_id,
        warnTarget.value.conversation_id,
        warnReason.value.trim() || undefined
      );
      toast.add({
        title: 'Warning Sent',
        description: 'User has been warned and a system message was injected',
        color: 'success',
      });
      closeWarnModal();
      await loadQueue();
    } catch (error: any) {
      toast.add({ title: 'Error', description: error.message, color: 'error' });
    } finally {
      warningSending.value = false;
    }
  };

  const handleBanUser = (user: any) => {
    banTarget.value = user;
    banModal.value?.showModal();
  };

  const closeBanModal = () => {
    banModal.value?.close();
    banTarget.value = null;
  };

  const handleConfirmBan = async () => {
    if (!banTarget.value) return;
    try {
      await toggleUserBan(banTarget.value.id, true);
      toast.add({ title: 'User Banned', description: 'User has been banned from the platform', color: 'success' });
      closeBanModal();
      await loadQueue();
    } catch (error: any) {
      toast.add({ title: 'Error', description: error.message, color: 'error' });
    }
  };

  // Helpers
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '??';
    return (
      name
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??'
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Watchers
  watch(activeTab, (tab) => {
    if (tab === 'queue') loadQueue();
    else loadConversations();
  });

  watch(queuePage, () => loadQueue());
  watch(browserPage, () => loadConversations());
  watch(browserFlaggedOnly, () => {
    browserPage.value = 1;
    loadConversations();
  });
  watch(browserSearch, () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      browserPage.value = 1;
      loadConversations();
    }, 300);
  });

  // Reset state on mount
  onBeforeMount(() => {
    queueItems.value = [];
    conversations.value = [];
    loading.value = true;
  });

  onMounted(() => {
    loadQueue();
  });
</script>
