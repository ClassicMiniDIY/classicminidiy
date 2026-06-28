<template>
  <div
    class="card bg-base-100 border border-base-200 overflow-hidden"
    :class="{ 'ring-1 ring-primary/40': group.totalUnread > 0 }"
  >
    <!-- Group header (click to toggle) -->
    <button
      type="button"
      class="w-full flex items-center gap-4 p-4 text-left hover:bg-base-200/60 transition-colors"
      :aria-expanded="isOpen"
      :aria-controls="`group-body-${group.id}`"
      @click="$emit('toggle')"
    >
      <!-- Listing thumbnail -->
      <div class="avatar flex-shrink-0">
        <div class="w-14 h-14 rounded">
          <img
            v-if="group.thumbnailUrl"
            :src="group.thumbnailUrl"
            :alt="group.title"
            class="object-cover w-full h-full"
            loading="lazy"
          />
          <div v-else class="w-full h-full bg-base-300 flex items-center justify-center">
            <i
              :class="group.kind === 'wanted_post' ? 'fas fa-magnifying-glass' : 'fas fa-image'"
              class="text-xl text-base-content/30"
            ></i>
          </div>
        </div>
      </div>

      <!-- Title + meta -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-semibold truncate">{{ group.title }}</h3>
          <span
            v-if="group.status === 'sold'"
            class="badge badge-xs badge-neutral shrink-0"
          >
            {{ t('sold') }}
          </span>
        </div>
        <div class="flex items-center gap-3 text-sm text-base-content/70">
          <span v-if="group.price !== null" class="font-semibold text-primary">
            ${{ group.price.toLocaleString() }}
          </span>
          <span class="flex items-center gap-1">
            <i class="fas fa-comments"></i>
            {{
              group.conversations.length === 1
                ? t('peopleCount', { count: group.conversations.length })
                : t('peopleCountPlural', { count: group.conversations.length })
            }}
          </span>
          <ClientOnly>
            <span class="text-base-content/50 hidden sm:inline">
              {{ t('lastActivity', { time: formatTime(group.latestMessageAt) }) }}
            </span>
          </ClientOnly>
        </div>
      </div>

      <!-- Unread badge + chevron -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span v-if="group.totalUnread > 0" class="badge badge-primary badge-sm">
          {{ t('unreadNew', { count: group.totalUnread }) }}
        </span>
        <i
          class="fas fa-chevron-down transition-transform"
          :class="{ 'rotate-180': isOpen }"
        ></i>
      </div>
    </button>

    <!-- Inner conversation list -->
    <div v-if="isOpen" :id="`group-body-${group.id}`" class="border-t border-base-200">
      <NuxtLink
        v-for="conversation in group.conversations"
        :key="conversation.id"
        :to="`/exchange/messages/${conversation.id}`"
        class="group/row flex items-center gap-3 px-4 py-3 hover:bg-base-200/80 active:bg-base-300 transition-colors border-b border-base-200 last:border-b-0 cursor-pointer"
      >
        <!-- Chat bubble icon (reinforces that the row opens a chat) -->
        <div class="flex-shrink-0 text-base-content/40 group-hover/row:text-primary transition-colors">
          <i class="fas fa-comment-dots"></i>
        </div>

        <!-- Person initial avatar -->
        <div class="avatar avatar-placeholder flex-shrink-0">
          <div class="bg-base-300 text-base-content/70 w-9 rounded-full">
            <span class="text-sm font-medium">{{ getInitial(conversation) }}</span>
          </div>
        </div>

        <!-- Name + timestamp -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <span
              class="font-medium truncate"
              :class="{ 'text-primary': hasUnreadMessages(conversation) }"
            >
              {{ getParticipantName(conversation) }}
            </span>
            <ClientOnly>
              <time class="text-xs text-base-content/60 flex-shrink-0">
                {{ formatTime(conversation.last_message_at) }}
              </time>
            </ClientOnly>
          </div>
          <div class="text-xs text-base-content/50 mt-0.5 flex items-center gap-1">
            <i class="fas fa-circle-arrow-right"></i>
            <span>{{ t('tapToOpen') }}</span>
          </div>
        </div>

        <!-- Unread badge -->
        <div v-if="hasUnreadMessages(conversation)" class="badge badge-primary badge-sm flex-shrink-0">
          {{ getUnreadCount(conversation) }}
        </div>

        <!-- Chevron affordance -->
        <i
          class="fas fa-chevron-right text-base-content/30 group-hover/row:text-base-content/70 group-hover/row:translate-x-0.5 transition-all flex-shrink-0"
        ></i>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Conversation } from '~/composables/useMessages';
  import { formatRelativeTime } from '~/utils/formatters';

  const { t } = useI18n();

  export interface ConversationGroup {
    kind: 'listing' | 'wanted_post' | 'orphan';
    id: string;
    title: string;
    thumbnailUrl: string | null;
    status: string | null;
    price: number | null;
    conversations: Conversation[];
    totalUnread: number;
    latestMessageAt: string;
  }

  interface Props {
    group: ConversationGroup;
    isOpen: boolean;
  }

  defineProps<Props>();
  defineEmits<{ toggle: [] }>();

  const { user } = useAuth();
  const { getOtherParticipant } = useMessages();

  const getParticipantName = (conversation: Conversation) => {
    const p = getOtherParticipant(conversation);
    return p?.name || t('unknownUser');
  };

  const getInitial = (conversation: Conversation) => {
    const name = getParticipantName(conversation);
    return name.charAt(0).toUpperCase() || '?';
  };

  const hasUnreadMessages = (conversation: Conversation) => {
    if (!user.value) return false;
    if (conversation.buyer_id === user.value.id) return conversation.buyer_unread_count > 0;
    if (conversation.seller_id === user.value.id) return conversation.seller_unread_count > 0;
    return false;
  };

  const getUnreadCount = (conversation: Conversation) => {
    if (!user.value) return 0;
    if (conversation.buyer_id === user.value.id) return conversation.buyer_unread_count;
    if (conversation.seller_id === user.value.id) return conversation.seller_unread_count;
    return 0;
  };

  // Shared helper — see utils/formatters.ts
  const formatTime = (timestamp: string) => formatRelativeTime(timestamp);
</script>

<i18n lang="json">
{
  "en": { "sold": "Sold", "peopleCount": "{count} person", "peopleCountPlural": "{count} people", "lastActivity": "Last: {time}", "unreadNew": "{count} new", "tapToOpen": "Tap to open conversation", "unknownUser": "Unknown User" },
  "es": { "sold": "Vendido", "peopleCount": "{count} persona", "peopleCountPlural": "{count} personas", "lastActivity": "Último: {time}", "unreadNew": "{count} nuevos", "tapToOpen": "Toca para abrir la conversación", "unknownUser": "Usuario desconocido" },
  "fr": { "sold": "Vendu", "peopleCount": "{count} personne", "peopleCountPlural": "{count} personnes", "lastActivity": "Dernier : {time}", "unreadNew": "{count} nouveaux", "tapToOpen": "Appuyez pour ouvrir la conversation", "unknownUser": "Utilisateur inconnu" },
  "de": { "sold": "Verkauft", "peopleCount": "{count} Person", "peopleCountPlural": "{count} Personen", "lastActivity": "Zuletzt: {time}", "unreadNew": "{count} neue", "tapToOpen": "Tippen, um die Unterhaltung zu öffnen", "unknownUser": "Unbekannter Benutzer" },
  "it": { "sold": "Venduto", "peopleCount": "{count} persona", "peopleCountPlural": "{count} persone", "lastActivity": "Ultimo: {time}", "unreadNew": "{count} nuovi", "tapToOpen": "Tocca per aprire la conversazione", "unknownUser": "Utente sconosciuto" },
  "pt": { "sold": "Vendido", "peopleCount": "{count} pessoa", "peopleCountPlural": "{count} pessoas", "lastActivity": "Último: {time}", "unreadNew": "{count} novos", "tapToOpen": "Toque para abrir a conversa", "unknownUser": "Usuário desconhecido" },
  "ru": { "sold": "Продано", "peopleCount": "{count} человек", "peopleCountPlural": "{count} человек", "lastActivity": "Последнее: {time}", "unreadNew": "{count} новых", "tapToOpen": "Нажмите, чтобы открыть разговор", "unknownUser": "Неизвестный пользователь" },
  "ja": { "sold": "売却済み", "peopleCount": "{count}人", "peopleCountPlural": "{count}人", "lastActivity": "最終: {time}", "unreadNew": "新着 {count}件", "tapToOpen": "タップして会話を開く", "unknownUser": "不明なユーザー" },
  "zh": { "sold": "已售", "peopleCount": "{count} 人", "peopleCountPlural": "{count} 人", "lastActivity": "最近：{time}", "unreadNew": "{count} 条新消息", "tapToOpen": "点按打开对话", "unknownUser": "未知用户" },
  "ko": { "sold": "판매됨", "peopleCount": "{count}명", "peopleCountPlural": "{count}명", "lastActivity": "마지막: {time}", "unreadNew": "새 메시지 {count}개", "tapToOpen": "탭하여 대화 열기", "unknownUser": "알 수 없는 사용자" }
}
</i18n>
