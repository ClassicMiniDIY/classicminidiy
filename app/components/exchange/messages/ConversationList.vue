<template>
  <div class="space-y-2">
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Empty state -->
    <div v-else-if="conversations.length === 0" class="text-center py-16">
      <i class="fas fa-inbox text-6xl mb-4 text-base-content/30"></i>
      <h3 class="text-xl font-semibold mb-2">{{ t('emptyTitle') }}</h3>
      <p class="text-base-content/70 mb-6">{{ t('emptyBody') }}</p>
      <NuxtLink to="/exchange/listings" class="btn btn-primary">
        <i class="fas fa-magnifying-glass"></i>
        {{ t('browseListings') }}
      </NuxtLink>
    </div>

    <!-- Conversation list -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="conversation in conversations"
        :key="conversation.id"
        :to="`/exchange/messages/${conversation.id}`"
        class="card bg-base-100 hover:bg-base-200 transition-colors cursor-pointer"
        :class="{ 'shadow-md': hasUnreadMessages(conversation) }"
      >
        <div class="card-body p-4">
          <div class="flex gap-4">
            <!-- Listing thumbnail -->
            <div class="avatar flex-shrink-0">
              <div class="w-16 h-16 rounded">
                <img
                  v-if="getListingImage(conversation)"
                  :src="getListingImage(conversation)"
                  :alt="conversation.listing?.title"
                  class="object-cover w-full h-full"
                  loading="lazy"
                />
                <div v-else class="w-full h-full bg-base-300 flex items-center justify-center">
                  <i class="fas fa-image text-2xl text-base-content/30"></i>
                </div>
              </div>
            </div>

            <!-- Conversation details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2 mb-1">
                <!-- Other participant name -->
                <h3 class="font-semibold truncate" :class="{ 'text-primary': hasUnreadMessages(conversation) }">
                  {{ getOtherParticipantName(conversation) }}
                </h3>

                <!-- Timestamp -->
                <time class="text-xs text-base-content/60 flex-shrink-0">
                  {{ formatTime(conversation.last_message_at) }}
                </time>
              </div>

              <!-- Listing title + sold badge -->
              <p class="text-sm text-base-content/70 truncate mb-2 flex items-center gap-2">
                <span class="truncate">{{ conversation.listing?.title }}</span>
                <span v-if="conversation.listing?.status === 'sold'" class="badge badge-xs badge-neutral shrink-0">
                  {{ t('sold') }}
                </span>
              </p>

              <!-- Price -->
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-primary">
                  ${{ conversation.listing?.price?.toLocaleString() }}
                </span>

                <!-- Unread badge -->
                <div v-if="hasUnreadMessages(conversation)" class="badge badge-primary badge-sm">
                  {{ getUnreadCount(conversation) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Conversation } from '~/composables/useMessages';
  import { formatRelativeTime } from '~/utils/formatters';

  const { t } = useI18n();

  interface Props {
    conversations: Conversation[];
    loading?: boolean;
  }

  const props = defineProps<Props>();

  const { user } = useAuth();
  const { getOtherParticipant } = useMessages();
  const { getPhotoUrl } = useListings();

  // Get listing primary image
  const getListingImage = (conversation: Conversation) => {
    const photos = conversation.listing?.listing_photos;
    if (!photos || photos.length === 0) return null;

    const primaryPhoto = photos.find((p) => p.is_primary);
    const photo = primaryPhoto || photos[0];

    return photo ? getPhotoUrl(photo.storage_path) : null;
  };

  // Get other participant's name
  const getOtherParticipantName = (conversation: Conversation) => {
    const participant = getOtherParticipant(conversation);
    return participant?.name || t('unknownUser');
  };

  // Check if conversation has unread messages
  const hasUnreadMessages = (conversation: Conversation) => {
    if (!user.value) return false;

    if (conversation.buyer_id === user.value.id) {
      return conversation.buyer_unread_count > 0;
    } else if (conversation.seller_id === user.value.id) {
      return conversation.seller_unread_count > 0;
    }

    return false;
  };

  // Get unread count for current user
  const getUnreadCount = (conversation: Conversation) => {
    if (!user.value) return 0;

    if (conversation.buyer_id === user.value.id) {
      return conversation.buyer_unread_count;
    } else if (conversation.seller_id === user.value.id) {
      return conversation.seller_unread_count;
    }

    return 0;
  };

  // Shared helper — see utils/formatters.ts
  const formatTime = (timestamp: string) => formatRelativeTime(timestamp);
</script>

<i18n lang="json">
{
  "en": { "emptyTitle": "No messages yet", "emptyBody": "Start a conversation by contacting a seller on a listing", "browseListings": "Browse Listings", "sold": "Sold", "unknownUser": "Unknown User" },
  "es": { "emptyTitle": "Aún no hay mensajes", "emptyBody": "Inicia una conversación contactando a un vendedor en un anuncio", "browseListings": "Explorar anuncios", "sold": "Vendido", "unknownUser": "Usuario desconocido" },
  "fr": { "emptyTitle": "Aucun message pour le moment", "emptyBody": "Démarrez une conversation en contactant un vendeur sur une annonce", "browseListings": "Parcourir les annonces", "sold": "Vendu", "unknownUser": "Utilisateur inconnu" },
  "de": { "emptyTitle": "Noch keine Nachrichten", "emptyBody": "Starten Sie ein Gespräch, indem Sie einen Verkäufer zu einer Anzeige kontaktieren", "browseListings": "Anzeigen durchsuchen", "sold": "Verkauft", "unknownUser": "Unbekannter Benutzer" },
  "it": { "emptyTitle": "Ancora nessun messaggio", "emptyBody": "Avvia una conversazione contattando un venditore su un annuncio", "browseListings": "Sfoglia annunci", "sold": "Venduto", "unknownUser": "Utente sconosciuto" },
  "pt": { "emptyTitle": "Ainda não há mensagens", "emptyBody": "Inicie uma conversa entrando em contato com um vendedor em um anúncio", "browseListings": "Explorar anúncios", "sold": "Vendido", "unknownUser": "Usuário desconhecido" },
  "ru": { "emptyTitle": "Сообщений пока нет", "emptyBody": "Начните разговор, связавшись с продавцом по объявлению", "browseListings": "Просмотреть объявления", "sold": "Продано", "unknownUser": "Неизвестный пользователь" },
  "ja": { "emptyTitle": "メッセージはまだありません", "emptyBody": "出品の出品者に連絡して会話を始めましょう", "browseListings": "出品を見る", "sold": "売却済み", "unknownUser": "不明なユーザー" },
  "zh": { "emptyTitle": "暂无消息", "emptyBody": "通过联系刊登上的卖家开始对话", "browseListings": "浏览刊登", "sold": "已售", "unknownUser": "未知用户" },
  "ko": { "emptyTitle": "아직 메시지가 없습니다", "emptyBody": "매물의 판매자에게 연락하여 대화를 시작하세요", "browseListings": "매물 둘러보기", "sold": "판매됨", "unknownUser": "알 수 없는 사용자" }
}
</i18n>
