<template>
  <div class="space-y-4">
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Empty state -->
    <div v-else-if="messages.length === 0" class="text-center py-12">
      <i class="fas fa-comments text-6xl mx-auto text-base-content/30 mb-4 block"></i>
      <p class="text-base-content/60">{{ t('empty') }}</p>
    </div>

    <!-- Messages -->
    <div v-else ref="messagesContainer" class="space-y-4">
      <div v-for="message in visibleMessages" :key="message.id">
        <!-- System message (admin injected) -->
        <div v-if="message.is_system_message" class="flex justify-center my-4">
          <div class="alert alert-info max-w-md py-2 px-4">
            <i class="fas fa-shield-halved"></i>
            <span class="text-sm">{{ message.content }}</span>
          </div>
        </div>

        <!-- Regular message -->
        <div v-else class="flex group" :class="{ 'justify-end': isOwnMessage(message.sender_id) }">
          <div class="max-w-[75%]">
            <!-- Message bubble -->
            <div
              class="chat"
              :class="{
                'chat-end': isOwnMessage(message.sender_id),
                'chat-start': !isOwnMessage(message.sender_id),
              }"
            >
              <!-- Sender name (only for other person's messages) -->
              <div v-if="!isOwnMessage(message.sender_id)" class="chat-header mb-1 flex items-center gap-2">
                <span class="text-sm font-medium">{{ getSenderName(message) }}</span>
                <!-- New-account signal: helps recipients spot cold outreach from a fresh account -->
                <span v-if="isNewAccountSender(message)" class="badge badge-warning badge-xs gap-1" :title="t('newAccountTitle')">
                  <i class="fas fa-wand-magic-sparkles"></i>
                  {{ t('newAccount') }}
                </span>
              </div>

              <!-- Message content -->
              <div
                class="chat-bubble"
                :class="
                  isOwnMessage(message.sender_id)
                    ? 'chat-bubble-primary'
                    : 'bg-base-300 text-base-content'
                "
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div class="prose-message break-words" v-html="renderedContent(message)"></div>

                <!-- Attachments -->
                <div
                  v-if="message.attachments && message.attachments.length > 0"
                  class="mt-2 grid grid-cols-2 gap-2"
                  :class="{ 'grid-cols-1': message.attachments.length === 1 }"
                >
                  <ExchangeMessagesMessageAttachmentThumbnail
                    v-for="attachment in message.attachments"
                    :key="attachment.id"
                    :attachment="attachment"
                  />
                </div>

                <!-- Moderation flag -->
                <div v-if="message.moderation_status === 'flagged'" class="mt-2 pt-2 border-t border-current/20">
                  <div class="flex items-center gap-2 text-xs opacity-75">
                    <i class="fas fa-triangle-exclamation"></i>
                    <span>{{ t('flagged') }}</span>
                  </div>
                </div>

                <!-- Pending (held) indicator — only shown to the sender of their
                     own held message. The recipient never sees a pending message. -->
                <div
                  v-if="message.moderation_status === 'pending' && isOwnMessage(message.sender_id)"
                  class="mt-2 pt-2 border-t border-current/20"
                >
                  <div class="flex items-center gap-2 text-xs opacity-75">
                    <i class="fas fa-clock"></i>
                    <span>{{ t('pendingNotice') }}</span>
                  </div>
                </div>
              </div>

              <!-- Timestamp and report button -->
              <div class="chat-footer mt-1 opacity-60 flex items-center gap-1">
                <ClientOnly><time class="text-xs">{{ formatMessageTime(message.created_at) }}</time></ClientOnly>
                <span
                  v-if="isOwnMessage(message.sender_id)"
                  class="text-xs ml-2"
                  :title="message.is_read ? t('read') : t('sent')"
                >
                  {{ message.is_read ? '✓✓' : '✓' }}
                </span>
                <button
                  v-if="!isOwnMessage(message.sender_id)"
                  class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  :title="t('report')"
                  @click="openReport(message)"
                >
                  <i class="fas fa-flag"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scroll anchor -->
      <div ref="scrollAnchor" class="h-px"></div>

      <!-- Report Message Modal -->
      <ExchangeMessagesReportMessageModal
        v-if="reportTargetMessage"
        ref="reportModal"
        :message-id="reportTargetMessage.id"
        :conversation-id="props.conversationId"
        @reported="onMessageReported"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Message } from '~/composables/useMessages';
  import { renderMessageMarkdown } from '~/utils/markdown';
  import { formatRelativeTime } from '~/utils/formatters';

  const { t } = useI18n();

  interface Props {
    messages: Message[];
    loading?: boolean;
    conversationId: string;
    /** The other participant's id — used to tag their messages with a "new account" badge. */
    counterpartyId?: string;
    /** When true, the counterparty is a recently-created account (cold-outreach signal). */
    counterpartyIsNew?: boolean;
  }

  const props = defineProps<Props>();

  const { isBlocked } = useBlockedUsers();

  // Memoize rendered markdown per message id to avoid re-parsing on every
  // re-render (scroll, unread-count updates, etc.).
  const renderCache = new Map<string, string>();
  const renderedContent = (message: Message) => {
    const cached = renderCache.get(message.id);
    if (cached !== undefined) return cached;
    const html = renderMessageMarkdown(message.content);
    renderCache.set(message.id, html);
    return html;
  };

  const { user } = useAuth();
  const messagesContainer = ref<HTMLElement>();
  const scrollAnchor = ref<HTMLElement>();

  // Report message state
  const reportModal = ref<InstanceType<typeof ExchangeMessagesReportMessageModal> | null>(null);
  const reportTargetMessage = ref<Message | null>(null);

  const openReport = (message: Message) => {
    reportTargetMessage.value = message;
    nextTick(() => {
      reportModal.value?.open();
    });
  };

  const onMessageReported = () => {
    reportTargetMessage.value = null;
  };

  // Check if message is from current user
  const isOwnMessage = (senderId: string) => {
    return user.value?.id === senderId;
  };

  // Messages actually rendered to the current user.
  // - A 'pending' (held) message is only visible to its own sender; the
  //   recipient never sees it. RLS already enforces this server-side, but we
  //   filter client-side too as defense-in-depth (realtime/cache could surface
  //   a row that slips past).
  // - Messages from blocked/muted users are hidden from the current user's view.
  const visibleMessages = computed(() =>
    props.messages.filter((message) => {
      const own = isOwnMessage(message.sender_id);
      if (message.moderation_status === 'pending' && !own) return false;
      if (!own && isBlocked(message.sender_id)) return false;
      return true;
    })
  );

  // Tag a counterparty's messages with a "new account" badge so recipients can
  // spot cold outreach from a freshly-created account.
  const isNewAccountSender = (message: Message) =>
    !!props.counterpartyIsNew && !isOwnMessage(message.sender_id) && message.sender_id === props.counterpartyId;

  // Get sender display name
  const getSenderName = (message: Message) => {
    if (message.sender) {
      return message.sender.display_name || message.sender.username || t('anonymous');
    }
    return t('unknownUser');
  };

  // Format message timestamp — shared helper keeps behavior consistent
  // across all messaging UI surfaces.
  const formatMessageTime = (timestamp: string) => formatRelativeTime(timestamp, { includeTime: true });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    nextTick(() => {
      scrollAnchor.value?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  // Watch for new messages and scroll
  watch(
    () => props.messages.length,
    () => {
      scrollToBottom();
    },
    { immediate: true }
  );

  // Scroll to bottom on mount
  onMounted(() => {
    scrollToBottom();
  });
</script>

<i18n lang="json">
{
  "en": {"empty": "No messages yet. Start the conversation!", "flagged": "Message flagged for review", "report": "Report message", "sent": "Sent", "read": "Read", "anonymous": "Anonymous", "unknownUser": "Unknown User", "newAccount": "New account", "newAccountTitle": "This account was created recently. Be cautious with unexpected requests, links, or payment asks.", "pendingNotice": "Pending review — the other person won't see this until it's approved"},
  "es": {"empty": "Aún no hay mensajes. ¡Inicia la conversación!", "flagged": "Mensaje marcado para revisión", "report": "Reportar mensaje", "sent": "Enviado", "read": "Leído", "anonymous": "Anónimo", "unknownUser": "Usuario desconocido", "newAccount": "Cuenta nueva", "newAccountTitle": "Esta cuenta se creó recientemente. Ten cuidado con solicitudes, enlaces o peticiones de pago inesperadas.", "pendingNotice": "Pendiente de revisión: la otra persona no lo verá hasta que se apruebe"},
  "fr": {"empty": "Aucun message pour le moment. Lancez la conversation !", "flagged": "Message signalé pour examen", "report": "Signaler le message", "sent": "Envoyé", "read": "Lu", "anonymous": "Anonyme", "unknownUser": "Utilisateur inconnu", "newAccount": "Nouveau compte", "newAccountTitle": "Ce compte a été créé récemment. Méfiez-vous des demandes, liens ou demandes de paiement inattendus.", "pendingNotice": "En attente de vérification — l'autre personne ne le verra pas avant son approbation"},
  "de": {"empty": "Noch keine Nachrichten. Starte die Unterhaltung!", "flagged": "Nachricht zur Überprüfung gemeldet", "report": "Nachricht melden", "sent": "Gesendet", "read": "Gelesen", "anonymous": "Anonym", "unknownUser": "Unbekannter Benutzer", "newAccount": "Neues Konto", "newAccountTitle": "Dieses Konto wurde kürzlich erstellt. Sei vorsichtig bei unerwarteten Anfragen, Links oder Zahlungsaufforderungen.", "pendingNotice": "Wartet auf Überprüfung — die andere Person sieht dies erst nach der Freigabe"},
  "it": {"empty": "Ancora nessun messaggio. Inizia la conversazione!", "flagged": "Messaggio segnalato per revisione", "report": "Segnala messaggio", "sent": "Inviato", "read": "Letto", "anonymous": "Anonimo", "unknownUser": "Utente sconosciuto", "newAccount": "Account nuovo", "newAccountTitle": "Questo account è stato creato di recente. Fai attenzione a richieste, link o richieste di pagamento inaspettate.", "pendingNotice": "In attesa di revisione: l'altra persona non lo vedrà finché non sarà approvato"},
  "pt": {"empty": "Ainda não há mensagens. Inicie a conversa!", "flagged": "Mensagem sinalizada para revisão", "report": "Denunciar mensagem", "sent": "Enviado", "read": "Lido", "anonymous": "Anônimo", "unknownUser": "Usuário desconhecido", "newAccount": "Conta nova", "newAccountTitle": "Esta conta foi criada recentemente. Tenha cuidado com solicitações, links ou pedidos de pagamento inesperados.", "pendingNotice": "Aguardando revisão — a outra pessoa só verá após a aprovação"},
  "ru": {"empty": "Сообщений пока нет. Начните разговор!", "flagged": "Сообщение отмечено для проверки", "report": "Пожаловаться на сообщение", "sent": "Отправлено", "read": "Прочитано", "anonymous": "Аноним", "unknownUser": "Неизвестный пользователь", "newAccount": "Новый аккаунт", "newAccountTitle": "Этот аккаунт создан недавно. Будьте осторожны с неожиданными просьбами, ссылками или запросами оплаты.", "pendingNotice": "Ожидает проверки — собеседник не увидит это до одобрения"},
  "ja": {"empty": "まだメッセージはありません。会話を始めましょう！", "flagged": "メッセージが確認のため報告されました", "report": "メッセージを報告", "sent": "送信済み", "read": "既読", "anonymous": "匿名", "unknownUser": "不明なユーザー", "newAccount": "新規アカウント", "newAccountTitle": "このアカウントは最近作成されました。予期しない依頼、リンク、支払い要求にはご注意ください。", "pendingNotice": "審査待ち — 承認されるまで相手には表示されません"},
  "zh": {"empty": "还没有消息。开始对话吧！", "flagged": "消息已被举报待审核", "report": "举报消息", "sent": "已发送", "read": "已读", "anonymous": "匿名", "unknownUser": "未知用户", "newAccount": "新账户", "newAccountTitle": "该账户是最近创建的。请警惕意外的请求、链接或付款要求。", "pendingNotice": "等待审核——在批准之前对方不会看到此消息"},
  "ko": {"empty": "아직 메시지가 없습니다. 대화를 시작하세요!", "flagged": "메시지가 검토를 위해 신고되었습니다", "report": "메시지 신고", "sent": "전송됨", "read": "읽음", "anonymous": "익명", "unknownUser": "알 수 없는 사용자", "newAccount": "신규 계정", "newAccountTitle": "이 계정은 최근에 생성되었습니다. 예상치 못한 요청, 링크 또는 결제 요구에 주의하세요.", "pendingNotice": "검토 대기 중 — 승인될 때까지 상대방에게 표시되지 않습니다"}
}
</i18n>

<style scoped>
  .prose-message :deep(p) {
    margin: 0;
    white-space: pre-wrap;
  }
  .prose-message :deep(p + p) {
    margin-top: 0.5rem;
  }
  .prose-message :deep(ul),
  .prose-message :deep(ol) {
    margin: 0.25rem 0;
    padding-left: 1.25rem;
  }
  .prose-message :deep(li) {
    margin: 0.125rem 0;
  }
  .prose-message :deep(code) {
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
    background-color: rgba(0, 0, 0, 0.15);
    font-size: 0.9em;
  }
  .prose-message :deep(pre) {
    margin: 0.5rem 0;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background-color: rgba(0, 0, 0, 0.2);
    overflow-x: auto;
  }
  .prose-message :deep(pre code) {
    background-color: transparent;
    padding: 0;
  }
  .prose-message :deep(a) {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose-message :deep(strong) {
    font-weight: 700;
  }
</style>
