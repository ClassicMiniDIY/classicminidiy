<template>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-6xl mx-auto">
      <!-- Back button -->
      <NuxtLink to="/exchange/messages" class="btn btn-ghost btn-sm mb-4">
        <i class="fas fa-arrow-left"></i>
        {{ t('back') }}
      </NuxtLink>

      <!-- Loading state -->
      <div v-if="loading || !initialLoadComplete" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Error state -->
      <div v-else-if="!conversation" class="alert alert-error">
        <i class="fas fa-triangle-exclamation text-xl"></i>
        <span>{{ t('notFound') }}</span>
      </div>

      <!-- Conversation -->
      <div v-else class="flex flex-col lg:flex-row lg:gap-6">
        <div class="space-y-6 min-w-0 flex-1">
        <!-- Listing Info Header -->
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <!-- Listing-linked conversation -->
            <div v-if="conversation.listing" class="flex gap-4">
              <!-- Listing image -->
              <NuxtLink :to="`/exchange/listings/${conversation.listing.slug}`" class="avatar flex-shrink-0">
                <div class="w-20 h-20 rounded">
                  <img
                    v-if="listingImage"
                    :src="listingImage"
                    :alt="conversation.listing.title"
                    class="object-cover w-full h-full"
                    loading="lazy"
                  />
                  <div v-else class="w-full h-full bg-base-300 flex items-center justify-center">
                    <i class="fas fa-image text-2xl text-base-content/30"></i>
                  </div>
                </div>
              </NuxtLink>

              <!-- Listing details -->
              <div class="flex-1">
                <NuxtLink
                  :to="`/exchange/listings/${conversation.listing.slug}`"
                  class="link link-hover text-lg font-semibold mb-1 block"
                >
                  {{ conversation.listing.title }}
                </NuxtLink>

                <div class="flex items-center gap-4 text-sm">
                  <span class="font-bold text-primary text-lg">
                    ${{ conversation.listing.price?.toLocaleString() }}
                  </span>
                  <span class="text-base-content/60">{{ t('chattingWith', { name: otherParticipantName }) }}</span>
                </div>
              </div>
            </div>

            <!-- Orphan / wanted conversation (no associated listing) -->
            <div v-else class="flex gap-4">
              <div class="avatar flex-shrink-0">
                <div class="w-20 h-20 rounded">
                  <div class="w-full h-full bg-base-300 flex items-center justify-center">
                    <i class="fas fa-comments text-2xl text-base-content/30"></i>
                  </div>
                </div>
              </div>

              <div class="flex-1">
                <p class="text-lg font-semibold mb-1">{{ t('noListing') }}</p>
                <span class="text-base-content/60 text-sm">{{ t('chattingWith', { name: otherParticipantName }) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Safety Tips (dismissible) -->
        <ExchangeMessagesSafetyTips :conversation-id="conversationId" />

        <!-- Meeting Spot Suggestions -->
        <ExchangeMessagesMeetingSpotSuggestions
          v-if="conversation.listing?.latitude && conversation.listing?.longitude"
          :seller-lat="Number(conversation.listing.latitude)"
          :seller-lon="Number(conversation.listing.longitude)"
          :conversation-id="conversationId"
          @spot-suggested="handleMessageSent"
        />

        <!-- Messages -->
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-6">
            <h2 class="card-title mb-4">
              <i class="fas fa-comments text-xl"></i>
              {{ t('conversation') }}
            </h2>

            <div class="max-h-[500px] overflow-y-auto mb-6">
              <div v-if="hasOlderMessages" class="text-center py-2">
                <button class="btn btn-ghost btn-sm" @click="loadOlderMessages" :disabled="loadingOlder">
                  <span v-if="loadingOlder" class="loading loading-spinner loading-xs"></span>
                  {{ t('loadOlder') }}
                </button>
              </div>
              <ExchangeMessagesMessageList :messages="messages" :loading="messagesLoading" :conversation-id="conversationId" />
            </div>

            <!-- Message Composer -->
            <ExchangeMessagesMessageComposer
              :conversation-id="conversationId"
              :listing-id="conversation.listing?.id"
              :message-count="messages.length"
              @sent="handleMessageSent"
            />
          </div>
        </div>
        </div>

        <!-- Desktop-only shared images sidebar -->
        <div class="hidden lg:block lg:w-[300px] lg:flex-shrink-0">
          <ExchangeMessagesMessageImageGallery :messages="messages" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();

  definePageMeta({
    middleware: 'exchange-auth',
  });

  useSeoMeta({
    title: t('seo.title'),
    robots: 'noindex, nofollow',
  });

  const route = useRoute();
  const conversationId = computed(() => route.params.conversationId as string);

  const { fetchConversation, fetchMessages, markAsRead, getOtherParticipant, loading } = useMessages();
  const { getPhotoUrl } = useListings();
  const { capture } = usePostHog();
  const { user } = useAuth();

  const conversation = ref<any>(null);
  const messages = ref<any[]>([]);
  const messagesLoading = ref(false);
  const hasOlderMessages = ref(false);
  const loadingOlder = ref(false);
  const initialLoadComplete = ref(false);

  const otherParticipantName = computed(() => {
    if (!conversation.value) return '';
    const participant = getOtherParticipant(conversation.value);
    return participant?.name || t('unknownUser');
  });

  const listingImage = computed(() => {
    const photos = conversation.value?.listing?.listing_photos;
    if (!photos || photos.length === 0) return null;

    const primaryPhoto = photos.find((p: any) => p.is_primary);
    const photo = primaryPhoto || photos[0];

    return photo ? getPhotoUrl(photo.storage_path) : null;
  });

  // Load conversation and messages
  const loadConversation = async () => {
    conversation.value = await fetchConversation(conversationId.value);

    if (conversation.value) {
      messagesLoading.value = true;
      const result = await fetchMessages(conversationId.value);
      messages.value = result.messages;
      hasOlderMessages.value = result.hasMore;
      messagesLoading.value = false;

      // Track conversation opened with unread count
      const unreadCount =
        user.value?.id === conversation.value.buyer_id
          ? conversation.value.buyer_unread_count || 0
          : conversation.value.seller_unread_count || 0;

      capture('conversation_opened', {
        conversation_id: conversationId.value,
        unread_count: unreadCount,
      });

      // Mark messages as read (fire-and-forget, don't block UI)
      markAsRead(conversationId.value);
    }
    initialLoadComplete.value = true;
  };

  // Handle new message sent
  const handleMessageSent = async () => {
    // Fetch latest page to pick up the new message with sender data
    const result = await fetchMessages(conversationId.value);
    messages.value = result.messages;
    hasOlderMessages.value = result.hasMore;
  };

  // Load older messages (cursor-based pagination)
  const loadOlderMessages = async () => {
    if (!messages.value.length || loadingOlder.value) return;
    loadingOlder.value = true;
    try {
      const oldestMessage = messages.value[0];
      const result = await fetchMessages(conversationId.value, {
        before: oldestMessage.created_at,
      });
      messages.value = [...result.messages, ...messages.value];
      hasOlderMessages.value = result.hasMore;
    } finally {
      loadingOlder.value = false;
    }
  };

  // Load on mount
  onMounted(async () => {
    await loadConversation();
  });

  // Set up real-time subscription for new messages
  const supabase = useSupabase();

  onMounted(() => {
    const channel = supabase
      .channel(`conversation_${conversationId.value}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId.value}`,
        },
        async (payload: any) => {
          const newMessage = payload.new;
          // Only append if this message isn't already in our list
          if (newMessage && !messages.value.some((m: any) => m.id === newMessage.id)) {
            // Attach sender info from conversation participants
            if (conversation.value) {
              const sender =
                newMessage.sender_id === conversation.value.buyer_id
                  ? conversation.value.buyer
                  : conversation.value.seller;
              newMessage.sender = sender || null;
            }
            messages.value = [...messages.value, newMessage];
          }
          await markAsRead(conversationId.value);
        }
      )
      .subscribe();

    // Cleanup on unmount
    onBeforeUnmount(() => {
      supabase.removeChannel(channel);
    });
  });
</script>

<i18n lang="json">
{
  "en": {
    "seo": { "title": "Conversation - The Mini Exchange | Classic Mini DIY" },
    "back": "Back to Messages",
    "notFound": "Conversation not found",
    "chattingWith": "Chatting with {name}",
    "conversation": "Conversation",
    "loadOlder": "Load Older Messages",
    "unknownUser": "Unknown User",
    "noListing": "No associated listing"
  },
  "es": {
    "seo": { "title": "Conversación - The Mini Exchange | Classic Mini DIY" },
    "back": "Volver a Mensajes",
    "notFound": "Conversación no encontrada",
    "chattingWith": "Chateando con {name}",
    "conversation": "Conversación",
    "loadOlder": "Cargar mensajes anteriores",
    "unknownUser": "Usuario desconocido",
    "noListing": "Sin anuncio asociado"
  },
  "fr": {
    "seo": { "title": "Conversation - The Mini Exchange | Classic Mini DIY" },
    "back": "Retour aux messages",
    "notFound": "Conversation introuvable",
    "chattingWith": "Discussion avec {name}",
    "conversation": "Conversation",
    "loadOlder": "Charger les messages plus anciens",
    "unknownUser": "Utilisateur inconnu",
    "noListing": "Aucune annonce associée"
  },
  "de": {
    "seo": { "title": "Konversation - The Mini Exchange | Classic Mini DIY" },
    "back": "Zurück zu Nachrichten",
    "notFound": "Konversation nicht gefunden",
    "chattingWith": "Chat mit {name}",
    "conversation": "Konversation",
    "loadOlder": "Ältere Nachrichten laden",
    "unknownUser": "Unbekannter Benutzer",
    "noListing": "Kein zugehöriges Angebot"
  },
  "it": {
    "seo": { "title": "Conversazione - The Mini Exchange | Classic Mini DIY" },
    "back": "Torna ai messaggi",
    "notFound": "Conversazione non trovata",
    "chattingWith": "Stai chattando con {name}",
    "conversation": "Conversazione",
    "loadOlder": "Carica messaggi precedenti",
    "unknownUser": "Utente sconosciuto",
    "noListing": "Nessun annuncio associato"
  },
  "pt": {
    "seo": { "title": "Conversa - The Mini Exchange | Classic Mini DIY" },
    "back": "Voltar às mensagens",
    "notFound": "Conversa não encontrada",
    "chattingWith": "A conversar com {name}",
    "conversation": "Conversa",
    "loadOlder": "Carregar mensagens anteriores",
    "unknownUser": "Utilizador desconhecido",
    "noListing": "Sem anúncio associado"
  },
  "ru": {
    "seo": { "title": "Переписка - The Mini Exchange | Classic Mini DIY" },
    "back": "Назад к сообщениям",
    "notFound": "Переписка не найдена",
    "chattingWith": "Переписка с {name}",
    "conversation": "Переписка",
    "loadOlder": "Загрузить более старые сообщения",
    "unknownUser": "Неизвестный пользователь",
    "noListing": "Нет связанного объявления"
  },
  "ja": {
    "seo": { "title": "会話 - The Mini Exchange | Classic Mini DIY" },
    "back": "メッセージに戻る",
    "notFound": "会話が見つかりません",
    "chattingWith": "{name} とチャット中",
    "conversation": "会話",
    "loadOlder": "過去のメッセージを読み込む",
    "unknownUser": "不明なユーザー",
    "noListing": "関連する出品はありません"
  },
  "zh": {
    "seo": { "title": "会话 - The Mini Exchange | Classic Mini DIY" },
    "back": "返回消息",
    "notFound": "未找到会话",
    "chattingWith": "正在与 {name} 聊天",
    "conversation": "会话",
    "loadOlder": "加载更早的消息",
    "unknownUser": "未知用户",
    "noListing": "无关联商品"
  },
  "ko": {
    "seo": { "title": "대화 - The Mini Exchange | Classic Mini DIY" },
    "back": "메시지로 돌아가기",
    "notFound": "대화를 찾을 수 없습니다",
    "chattingWith": "{name} 님과 대화 중",
    "conversation": "대화",
    "loadOlder": "이전 메시지 불러오기",
    "unknownUser": "알 수 없는 사용자",
    "noListing": "연결된 매물 없음"
  }
}
</i18n>
