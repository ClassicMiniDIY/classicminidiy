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
              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="`/exchange/listings/${conversation.listing.slug}`"
                  class="link link-hover text-lg font-semibold mb-1 block"
                >
                  {{ conversation.listing.title }}
                </NuxtLink>

                <div class="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span class="font-bold text-primary text-lg">
                    ${{ conversation.listing.price?.toLocaleString() }}
                  </span>
                  <span class="text-base-content/60">{{ t('chattingWith', { name: otherParticipantName }) }}</span>
                  <span v-if="counterpartyIsNew" class="badge badge-warning badge-sm gap-1" :title="t('newAccountTitle')">
                    <i class="fas fa-wand-magic-sparkles"></i>
                    {{ t('newAccount') }}
                  </span>
                </div>
              </div>

              <!-- Per-user controls -->
              <div v-if="otherParticipantId" class="flex-shrink-0">
                <button
                  v-if="!isCounterpartyBlocked"
                  class="btn btn-ghost btn-sm text-base-content/60"
                  :title="t('blockTitle')"
                  @click="handleBlock"
                >
                  <i class="fas fa-ban"></i>
                  {{ t('block') }}
                </button>
                <button v-else class="btn btn-ghost btn-sm text-error" :title="t('unblockTitle')" @click="handleUnblock">
                  <i class="fas fa-ban"></i>
                  {{ t('unblock') }}
                </button>
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
              <ExchangeMessagesMessageList
                :messages="messages"
                :loading="messagesLoading"
                :conversation-id="conversationId"
                :counterparty-id="otherParticipantId"
                :counterparty-is-new="counterpartyIsNew"
              />
            </div>

            <!-- Blocked notice (replaces the composer) -->
            <div v-if="isCounterpartyBlocked" class="alert alert-warning">
              <i class="fas fa-ban text-xl"></i>
              <div class="text-sm">
                <p class="font-medium">{{ t('blockedNotice.title', { name: otherParticipantName }) }}</p>
                <p class="opacity-80">{{ t('blockedNotice.body') }}</p>
              </div>
              <button class="btn btn-sm btn-ghost" @click="handleUnblock">{{ t('unblock') }}</button>
            </div>

            <!-- Message Composer -->
            <ExchangeMessagesMessageComposer
              v-else
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
  const toast = useToast();
  const { isBlocked, blockUser, unblockUser, load: loadBlockedUsers } = useBlockedUsers();

  // Accounts younger than this are surfaced as "new" so recipients can spot
  // cold outreach from a freshly-created account.
  const NEW_ACCOUNT_AGE_DAYS = 7;

  const conversation = ref<any>(null);
  const messages = ref<any[]>([]);
  const messagesLoading = ref(false);
  const hasOlderMessages = ref(false);
  const loadingOlder = ref(false);
  const initialLoadComplete = ref(false);

  const otherParticipant = computed(() => {
    if (!conversation.value) return null;
    return getOtherParticipant(conversation.value);
  });

  const otherParticipantName = computed(() => otherParticipant.value?.name || t('unknownUser'));
  const otherParticipantId = computed(() => otherParticipant.value?.id);

  // Age-based "new account" signal (cold-outreach hint). Derived from the
  // public profile's created_at — no extra round-trip.
  const counterpartyIsNew = computed(() => {
    const createdAt = otherParticipant.value?.created_at;
    if (!createdAt) return false;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    return ageMs >= 0 && ageMs < NEW_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
  });

  const isCounterpartyBlocked = computed(() => isBlocked(otherParticipantId.value));

  const handleBlock = () => {
    const id = otherParticipantId.value;
    if (!id) return;
    blockUser(id);
    toast.add({
      title: t('blockToast.title'),
      description: t('blockToast.description', { name: otherParticipantName.value }),
      color: 'success',
    });
  };

  const handleUnblock = () => {
    const id = otherParticipantId.value;
    if (!id) return;
    unblockUser(id);
    toast.add({
      title: t('unblockToast.title'),
      description: t('unblockToast.description', { name: otherParticipantName.value }),
      color: 'info',
    });
  };

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
    loadBlockedUsers();
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
    "seo": {
      "title": "Conversation - The Mini Exchange | Classic Mini DIY"
    },
    "back": "Back to Messages",
    "notFound": "Conversation not found",
    "chattingWith": "Chatting with {name}",
    "conversation": "Conversation",
    "loadOlder": "Load Older Messages",
    "unknownUser": "Unknown User",
    "noListing": "No associated listing",
    "newAccount": "New account",
    "newAccountTitle": "This account was created recently. Be cautious with unexpected requests, off-platform links, or payment asks.",
    "block": "Block",
    "blockTitle": "Block this person — you won't see their messages here",
    "unblock": "Unblock",
    "unblockTitle": "Unblock this person",
    "blockedNotice": {
      "title": "You've blocked {name}.",
      "body": "Their messages are hidden and you can't reply. If they're breaking the rules, please report a message so our team can act. You can unblock them at any time."
    },
    "blockToast": {
      "title": "Blocked",
      "description": "You won't see messages from {name}. Report a message if they're breaking the rules."
    },
    "unblockToast": {
      "title": "Unblocked",
      "description": "You'll see messages from {name} again."
    }
  },
  "es": {
    "seo": {
      "title": "Conversación - The Mini Exchange | Classic Mini DIY"
    },
    "back": "Volver a Mensajes",
    "notFound": "Conversación no encontrada",
    "chattingWith": "Chateando con {name}",
    "conversation": "Conversación",
    "loadOlder": "Cargar mensajes anteriores",
    "unknownUser": "Usuario desconocido",
    "noListing": "Sin anuncio asociado",
    "newAccount": "Cuenta nueva",
    "newAccountTitle": "Esta cuenta se creó recientemente. Ten cuidado con solicitudes inesperadas, enlaces externos o peticiones de pago.",
    "block": "Bloquear",
    "blockTitle": "Bloquear a esta persona: no verás sus mensajes aquí",
    "unblock": "Desbloquear",
    "unblockTitle": "Desbloquear a esta persona",
    "blockedNotice": {
      "title": "Has bloqueado a {name}.",
      "body": "Sus mensajes están ocultos y no puedes responder. Si incumple las normas, reporta un mensaje para que nuestro equipo actúe. Puedes desbloquear en cualquier momento."
    },
    "blockToast": {
      "title": "Bloqueado",
      "description": "No verás mensajes de {name}. Reporta un mensaje si incumple las normas."
    },
    "unblockToast": {
      "title": "Desbloqueado",
      "description": "Volverás a ver los mensajes de {name}."
    }
  },
  "fr": {
    "seo": {
      "title": "Conversation - The Mini Exchange | Classic Mini DIY"
    },
    "back": "Retour aux messages",
    "notFound": "Conversation introuvable",
    "chattingWith": "Discussion avec {name}",
    "conversation": "Conversation",
    "loadOlder": "Charger les messages plus anciens",
    "unknownUser": "Utilisateur inconnu",
    "noListing": "Aucune annonce associée",
    "newAccount": "Nouveau compte",
    "newAccountTitle": "Ce compte a été créé récemment. Méfiez-vous des demandes inattendues, des liens externes ou des demandes de paiement.",
    "block": "Bloquer",
    "blockTitle": "Bloquer cette personne — vous ne verrez plus ses messages ici",
    "unblock": "Débloquer",
    "unblockTitle": "Débloquer cette personne",
    "blockedNotice": {
      "title": "Vous avez bloqué {name}.",
      "body": "Ses messages sont masqués et vous ne pouvez pas répondre. En cas d'infraction aux règles, signalez un message pour que notre équipe agisse. Vous pouvez débloquer à tout moment."
    },
    "blockToast": {
      "title": "Bloqué",
      "description": "Vous ne verrez plus les messages de {name}. Signalez un message en cas d'infraction."
    },
    "unblockToast": {
      "title": "Débloqué",
      "description": "Vous verrez à nouveau les messages de {name}."
    }
  },
  "de": {
    "seo": {
      "title": "Konversation - The Mini Exchange | Classic Mini DIY"
    },
    "back": "Zurück zu Nachrichten",
    "notFound": "Konversation nicht gefunden",
    "chattingWith": "Chat mit {name}",
    "conversation": "Konversation",
    "loadOlder": "Ältere Nachrichten laden",
    "unknownUser": "Unbekannter Benutzer",
    "noListing": "Kein zugehöriges Angebot",
    "newAccount": "Neues Konto",
    "newAccountTitle": "Dieses Konto wurde kürzlich erstellt. Sei vorsichtig bei unerwarteten Anfragen, externen Links oder Zahlungsaufforderungen.",
    "block": "Blockieren",
    "blockTitle": "Diese Person blockieren — ihre Nachrichten werden hier ausgeblendet",
    "unblock": "Entblocken",
    "unblockTitle": "Diese Person entblocken",
    "blockedNotice": {
      "title": "Du hast {name} blockiert.",
      "body": "Die Nachrichten sind ausgeblendet und du kannst nicht antworten. Bei Regelverstößen melde bitte eine Nachricht, damit unser Team handeln kann. Du kannst jederzeit entblocken."
    },
    "blockToast": {
      "title": "Blockiert",
      "description": "Du siehst keine Nachrichten von {name} mehr. Melde eine Nachricht bei Regelverstößen."
    },
    "unblockToast": {
      "title": "Entblockt",
      "description": "Du siehst Nachrichten von {name} wieder."
    }
  },
  "it": {
    "seo": {
      "title": "Conversazione - The Mini Exchange | Classic Mini DIY"
    },
    "back": "Torna ai messaggi",
    "notFound": "Conversazione non trovata",
    "chattingWith": "Stai chattando con {name}",
    "conversation": "Conversazione",
    "loadOlder": "Carica messaggi precedenti",
    "unknownUser": "Utente sconosciuto",
    "noListing": "Nessun annuncio associato",
    "newAccount": "Account nuovo",
    "newAccountTitle": "Questo account è stato creato di recente. Fai attenzione a richieste inaspettate, link esterni o richieste di pagamento.",
    "block": "Blocca",
    "blockTitle": "Blocca questa persona: non vedrai i suoi messaggi qui",
    "unblock": "Sblocca",
    "unblockTitle": "Sblocca questa persona",
    "blockedNotice": {
      "title": "Hai bloccato {name}.",
      "body": "I suoi messaggi sono nascosti e non puoi rispondere. Se viola le regole, segnala un messaggio così il nostro team può intervenire. Puoi sbloccare in qualsiasi momento."
    },
    "blockToast": {
      "title": "Bloccato",
      "description": "Non vedrai i messaggi di {name}. Segnala un messaggio se viola le regole."
    },
    "unblockToast": {
      "title": "Sbloccato",
      "description": "Vedrai di nuovo i messaggi di {name}."
    }
  },
  "pt": {
    "seo": {
      "title": "Conversa - The Mini Exchange | Classic Mini DIY"
    },
    "back": "Voltar às mensagens",
    "notFound": "Conversa não encontrada",
    "chattingWith": "A conversar com {name}",
    "conversation": "Conversa",
    "loadOlder": "Carregar mensagens anteriores",
    "unknownUser": "Utilizador desconhecido",
    "noListing": "Sem anúncio associado",
    "newAccount": "Conta nova",
    "newAccountTitle": "Esta conta foi criada recentemente. Tenha cuidado com pedidos inesperados, links externos ou pedidos de pagamento.",
    "block": "Bloquear",
    "blockTitle": "Bloquear esta pessoa — você não verá as mensagens dela aqui",
    "unblock": "Desbloquear",
    "unblockTitle": "Desbloquear esta pessoa",
    "blockedNotice": {
      "title": "Você bloqueou {name}.",
      "body": "As mensagens estão ocultas e você não pode responder. Se a pessoa violar as regras, denuncie uma mensagem para que nossa equipe possa agir. Você pode desbloquear a qualquer momento."
    },
    "blockToast": {
      "title": "Bloqueado",
      "description": "Você não verá mensagens de {name}. Denuncie uma mensagem se violar as regras."
    },
    "unblockToast": {
      "title": "Desbloqueado",
      "description": "Você verá as mensagens de {name} novamente."
    }
  },
  "ru": {
    "seo": {
      "title": "Переписка - The Mini Exchange | Classic Mini DIY"
    },
    "back": "Назад к сообщениям",
    "notFound": "Переписка не найдена",
    "chattingWith": "Переписка с {name}",
    "conversation": "Переписка",
    "loadOlder": "Загрузить более старые сообщения",
    "unknownUser": "Неизвестный пользователь",
    "noListing": "Нет связанного объявления",
    "newAccount": "Новый аккаунт",
    "newAccountTitle": "Этот аккаунт создан недавно. Будьте осторожны с неожиданными просьбами, внешними ссылками или запросами оплаты.",
    "block": "Заблокировать",
    "blockTitle": "Заблокировать этого пользователя — его сообщения здесь не будут видны",
    "unblock": "Разблокировать",
    "unblockTitle": "Разблокировать этого пользователя",
    "blockedNotice": {
      "title": "Вы заблокировали {name}.",
      "body": "Сообщения скрыты, и вы не можете отвечать. Если пользователь нарушает правила, пожалуйтесь на сообщение, чтобы наша команда приняла меры. Разблокировать можно в любой момент."
    },
    "blockToast": {
      "title": "Заблокировано",
      "description": "Вы не будете видеть сообщения от {name}. Пожалуйтесь на сообщение при нарушении правил."
    },
    "unblockToast": {
      "title": "Разблокировано",
      "description": "Вы снова будете видеть сообщения от {name}."
    }
  },
  "ja": {
    "seo": {
      "title": "会話 - The Mini Exchange | Classic Mini DIY"
    },
    "back": "メッセージに戻る",
    "notFound": "会話が見つかりません",
    "chattingWith": "{name} とチャット中",
    "conversation": "会話",
    "loadOlder": "過去のメッセージを読み込む",
    "unknownUser": "不明なユーザー",
    "noListing": "関連する出品はありません",
    "newAccount": "新規アカウント",
    "newAccountTitle": "このアカウントは最近作成されました。予期しない依頼、外部リンク、支払い要求にはご注意ください。",
    "block": "ブロック",
    "blockTitle": "この人をブロック — ここにメッセージが表示されなくなります",
    "unblock": "ブロック解除",
    "unblockTitle": "この人のブロックを解除",
    "blockedNotice": {
      "title": "{name} さんをブロックしています。",
      "body": "メッセージは非表示になり、返信できません。ルール違反がある場合はメッセージを報告してください。ブロックはいつでも解除できます。"
    },
    "blockToast": {
      "title": "ブロックしました",
      "description": "{name} さんからのメッセージは表示されません。ルール違反があれば報告してください。"
    },
    "unblockToast": {
      "title": "ブロック解除しました",
      "description": "{name} さんからのメッセージが再び表示されます。"
    }
  },
  "zh": {
    "seo": {
      "title": "会话 - The Mini Exchange | Classic Mini DIY"
    },
    "back": "返回消息",
    "notFound": "未找到会话",
    "chattingWith": "正在与 {name} 聊天",
    "conversation": "会话",
    "loadOlder": "加载更早的消息",
    "unknownUser": "未知用户",
    "noListing": "无关联商品",
    "newAccount": "新账户",
    "newAccountTitle": "该账户是最近创建的。请警惕意外的请求、站外链接或付款要求。",
    "block": "屏蔽",
    "blockTitle": "屏蔽此人——你将不会在这里看到其消息",
    "unblock": "取消屏蔽",
    "unblockTitle": "取消屏蔽此人",
    "blockedNotice": {
      "title": "你已屏蔽 {name}。",
      "body": "其消息已隐藏，你无法回复。如果对方违反规则，请举报消息以便我们的团队处理。你可以随时取消屏蔽。"
    },
    "blockToast": {
      "title": "已屏蔽",
      "description": "你将不会看到 {name} 的消息。如对方违规请举报消息。"
    },
    "unblockToast": {
      "title": "已取消屏蔽",
      "description": "你将再次看到 {name} 的消息。"
    }
  },
  "ko": {
    "seo": {
      "title": "대화 - The Mini Exchange | Classic Mini DIY"
    },
    "back": "메시지로 돌아가기",
    "notFound": "대화를 찾을 수 없습니다",
    "chattingWith": "{name} 님과 대화 중",
    "conversation": "대화",
    "loadOlder": "이전 메시지 불러오기",
    "unknownUser": "알 수 없는 사용자",
    "noListing": "연결된 매물 없음",
    "newAccount": "신규 계정",
    "newAccountTitle": "이 계정은 최근에 생성되었습니다. 예상치 못한 요청, 외부 링크 또는 결제 요구에 주의하세요.",
    "block": "차단",
    "blockTitle": "이 사용자를 차단 — 여기에서 메시지가 보이지 않게 됩니다",
    "unblock": "차단 해제",
    "unblockTitle": "이 사용자 차단 해제",
    "blockedNotice": {
      "title": "{name} 님을 차단했습니다.",
      "body": "메시지가 숨겨지고 답장할 수 없습니다. 규칙을 위반한다면 메시지를 신고해 주세요. 언제든지 차단을 해제할 수 있습니다."
    },
    "blockToast": {
      "title": "차단됨",
      "description": "{name} 님의 메시지가 보이지 않습니다. 규칙 위반 시 메시지를 신고하세요."
    },
    "unblockToast": {
      "title": "차단 해제됨",
      "description": "{name} 님의 메시지를 다시 볼 수 있습니다."
    }
  }
}
</i18n>
