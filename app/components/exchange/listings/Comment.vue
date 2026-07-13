<template>
  <div class="flex gap-3" :class="{ 'ml-12': isReply }">
    <!-- Avatar -->
    <ExchangeAvatar :avatar-url="comment.user.avatar_url" :display-name="comment.user.display_name" size="sm" class="shrink-0" />

    <!-- Comment Content -->
    <div class="flex-1 min-w-0">
      <!-- Comment Header -->
      <div class="flex items-center gap-2 mb-1 flex-wrap">
        <span class="font-semibold text-sm">
          {{ displayName }}
        </span>

        <!-- Seller Badge -->
        <span v-if="comment.is_seller_response" class="badge badge-sm badge-primary"> {{ t('seller') }} </span>

        <!-- Question Badge -->
        <span v-if="comment.is_question" class="badge badge-sm badge-info"> {{ t('question') }} </span>

        <!-- Timestamp — client-only: relative time drifts vs server, causing
             hydration mismatches. -->
        <ClientOnly>
          <span class="text-xs text-base-content/60">
            {{ formatTimeAgo(comment.created_at) }}
          </span>
        </ClientOnly>

        <!-- Edited indicator -->
        <span v-if="comment.updated_at !== comment.created_at" class="text-xs text-base-content/50"> {{ t('edited') }} </span>
      </div>

      <!-- Comment Text -->
      <p class="text-sm text-base-content/90 whitespace-pre-wrap break-words mb-2">
        {{ comment.content }}
      </p>

      <!-- Actions -->
      <div class="flex items-center gap-3 text-xs">
        <!-- Reply Button -->
        <button v-if="!isReply && user" @click="showReplyForm = !showReplyForm" class="btn btn-ghost btn-xs">
          <i class="fas fa-comment"></i>
          {{ showReplyForm ? t('cancelReply') : t('reply') }}
        </button>

        <!-- Flag Button -->
        <button
          v-if="user && comment.user_id !== user.id"
          @click="handleFlag"
          :disabled="flagging"
          class="btn btn-ghost btn-xs text-warning hover:text-warning"
        >
          <i class="fas fa-flag"></i>
          {{ flagging ? t('flagging') : t('flag') }}
        </button>

        <!-- Delete Button (only for comment owner or admin) -->
        <button
          v-if="user && (comment.user_id === user.id || isAdmin)"
          @click="handleDelete"
          :disabled="deleting"
          class="btn btn-ghost btn-xs text-error hover:text-error"
        >
          <i class="fas fa-trash"></i>
          {{ deleting ? t('deleting') : t('delete') }}
        </button>
      </div>

      <!-- Inline Reply Form -->
      <div v-if="showReplyForm && user" class="mt-4 space-y-3 bg-base-200 p-4 rounded-lg">
        <div class="flex items-center gap-2 text-sm text-base-content/70 mb-2">
          <i class="fas fa-share"></i>
          <span>{{ t('replyingTo', { name: displayName }) }}</span>
        </div>

        <textarea
          v-model="replyContent"
          :placeholder="t('replyPlaceholder')"
          class="textarea textarea-bordered w-full"
          rows="3"
          maxlength="2000"
          :disabled="submitting"
        ></textarea>

        <div class="flex items-center justify-between">
          <span class="text-xs text-base-content/60"> {{ replyContent.length }}/2000 </span>

          <div class="flex items-center gap-2">
            <button @click="showReplyForm = false" :disabled="submitting" class="btn btn-ghost btn-sm">{{ t('cancel') }}</button>
            <button
              @click="handleSubmitReply"
              :disabled="!replyContent.trim() || submitting"
              class="btn btn-primary btn-sm"
            >
              <i v-if="!submitting" class="fas fa-paper-plane"></i>
              <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
              {{ submitting ? t('posting') : t('postReply') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Replies -->
      <div v-if="comment.replies && comment.replies.length > 0" class="mt-4 space-y-4">
        <ExchangeListingsComment
          v-for="reply in comment.replies"
          :key="reply.id"
          :comment="reply"
          :listing-id="listingId"
          :is-reply="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Comment } from '~/composables/useComments';

  const { t } = useI18n();

  const props = defineProps<{
    comment: Comment;
    listingId: string;
    isReply?: boolean;
  }>();

  const { user } = useAuth();
  const { postComment, flagComment, deleteComment, submitting } = useComments(props.listingId);

  const flagging = ref(false);
  const deleting = ref(false);
  const showReplyForm = ref(false);
  const replyContent = ref('');

  // Never derive a display name from email — commenter emails must not reach
  // this component (profiles split; comments API returns display_name only).
  const displayName = computed(() => {
    return props.comment.user.display_name || t('anonymous');
  });

  // Check if user is admin (you'll need to add this to your useAuth composable)
  const isAdmin = computed(() => {
    // This will need to be implemented in your auth system
    return false; // Placeholder
  });

  // Format timestamp as "time ago"
  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return t('justNow');
    if (seconds < 3600) return t('minutesAgo', { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('hoursAgo', { count: Math.floor(seconds / 3600) });
    if (seconds < 604800) return t('daysAgo', { count: Math.floor(seconds / 86400) });

    return date.toLocaleDateString();
  };

  // Handle submitting a reply
  const handleSubmitReply = async () => {
    const success = await postComment(replyContent.value, props.comment.id, false);

    if (success) {
      replyContent.value = '';
      showReplyForm.value = false;
    }
  };

  // Handle flagging a comment
  const handleFlag = async () => {
    if (!user.value) return;

    const confirmed = confirm(t('confirmFlag'));
    if (!confirmed) return;

    flagging.value = true;
    try {
      await flagComment(props.comment.id);
    } finally {
      flagging.value = false;
    }
  };

  // Handle deleting a comment
  const handleDelete = async () => {
    if (!user.value) return;

    const confirmed = confirm(t('confirmDelete'));
    if (!confirmed) return;

    deleting.value = true;
    try {
      await deleteComment(props.comment.id);
    } finally {
      deleting.value = false;
    }
  };
</script>

<i18n lang="json">
{
  "en": {
    "seller": "Seller",
    "question": "Question",
    "edited": "(edited)",
    "reply": "Reply",
    "cancelReply": "Cancel Reply",
    "flag": "Flag",
    "flagging": "Flagging...",
    "delete": "Delete",
    "deleting": "Deleting...",
    "replyingTo": "Replying to {name}",
    "replyPlaceholder": "Write your reply...",
    "cancel": "Cancel",
    "postReply": "Post Reply",
    "posting": "Posting...",
    "anonymous": "Anonymous",
    "justNow": "just now",
    "minutesAgo": "{count}m ago",
    "hoursAgo": "{count}h ago",
    "daysAgo": "{count}d ago",
    "confirmFlag": "Are you sure you want to flag this comment as inappropriate?",
    "confirmDelete": "Are you sure you want to delete this comment?"
  },
  "es": {
    "seller": "Vendedor",
    "question": "Pregunta",
    "edited": "(editado)",
    "reply": "Responder",
    "cancelReply": "Cancelar respuesta",
    "flag": "Reportar",
    "flagging": "Reportando...",
    "delete": "Eliminar",
    "deleting": "Eliminando...",
    "replyingTo": "Respondiendo a {name}",
    "replyPlaceholder": "Escribe tu respuesta...",
    "cancel": "Cancelar",
    "postReply": "Publicar respuesta",
    "posting": "Publicando...",
    "anonymous": "Anónimo",
    "justNow": "ahora mismo",
    "minutesAgo": "hace {count} min",
    "hoursAgo": "hace {count} h",
    "daysAgo": "hace {count} d",
    "confirmFlag": "¿Seguro que quieres reportar este comentario como inapropiado?",
    "confirmDelete": "¿Seguro que quieres eliminar este comentario?"
  },
  "fr": {
    "seller": "Vendeur",
    "question": "Question",
    "edited": "(modifié)",
    "reply": "Répondre",
    "cancelReply": "Annuler la réponse",
    "flag": "Signaler",
    "flagging": "Signalement...",
    "delete": "Supprimer",
    "deleting": "Suppression...",
    "replyingTo": "Réponse à {name}",
    "replyPlaceholder": "Écrivez votre réponse...",
    "cancel": "Annuler",
    "postReply": "Publier la réponse",
    "posting": "Publication...",
    "anonymous": "Anonyme",
    "justNow": "à l'instant",
    "minutesAgo": "il y a {count} min",
    "hoursAgo": "il y a {count} h",
    "daysAgo": "il y a {count} j",
    "confirmFlag": "Êtes-vous sûr de vouloir signaler ce commentaire comme inapproprié ?",
    "confirmDelete": "Êtes-vous sûr de vouloir supprimer ce commentaire ?"
  },
  "de": {
    "seller": "Verkäufer",
    "question": "Frage",
    "edited": "(bearbeitet)",
    "reply": "Antworten",
    "cancelReply": "Antwort abbrechen",
    "flag": "Melden",
    "flagging": "Wird gemeldet...",
    "delete": "Löschen",
    "deleting": "Wird gelöscht...",
    "replyingTo": "Antwort an {name}",
    "replyPlaceholder": "Schreibe deine Antwort...",
    "cancel": "Abbrechen",
    "postReply": "Antwort senden",
    "posting": "Wird gesendet...",
    "anonymous": "Anonym",
    "justNow": "gerade eben",
    "minutesAgo": "vor {count} Min.",
    "hoursAgo": "vor {count} Std.",
    "daysAgo": "vor {count} T.",
    "confirmFlag": "Möchtest du diesen Kommentar wirklich als unangemessen melden?",
    "confirmDelete": "Möchtest du diesen Kommentar wirklich löschen?"
  },
  "it": {
    "seller": "Venditore",
    "question": "Domanda",
    "edited": "(modificato)",
    "reply": "Rispondi",
    "cancelReply": "Annulla risposta",
    "flag": "Segnala",
    "flagging": "Segnalazione...",
    "delete": "Elimina",
    "deleting": "Eliminazione...",
    "replyingTo": "Risposta a {name}",
    "replyPlaceholder": "Scrivi la tua risposta...",
    "cancel": "Annulla",
    "postReply": "Pubblica risposta",
    "posting": "Pubblicazione...",
    "anonymous": "Anonimo",
    "justNow": "proprio ora",
    "minutesAgo": "{count} min fa",
    "hoursAgo": "{count} h fa",
    "daysAgo": "{count} g fa",
    "confirmFlag": "Vuoi davvero segnalare questo commento come inappropriato?",
    "confirmDelete": "Vuoi davvero eliminare questo commento?"
  },
  "pt": {
    "seller": "Vendedor",
    "question": "Pergunta",
    "edited": "(editado)",
    "reply": "Responder",
    "cancelReply": "Cancelar resposta",
    "flag": "Denunciar",
    "flagging": "Denunciando...",
    "delete": "Excluir",
    "deleting": "Excluindo...",
    "replyingTo": "Respondendo a {name}",
    "replyPlaceholder": "Escreva sua resposta...",
    "cancel": "Cancelar",
    "postReply": "Publicar resposta",
    "posting": "Publicando...",
    "anonymous": "Anônimo",
    "justNow": "agora mesmo",
    "minutesAgo": "há {count} min",
    "hoursAgo": "há {count} h",
    "daysAgo": "há {count} d",
    "confirmFlag": "Tem certeza de que deseja denunciar este comentário como inadequado?",
    "confirmDelete": "Tem certeza de que deseja excluir este comentário?"
  },
  "ru": {
    "seller": "Продавец",
    "question": "Вопрос",
    "edited": "(изменено)",
    "reply": "Ответить",
    "cancelReply": "Отменить ответ",
    "flag": "Пожаловаться",
    "flagging": "Отправка жалобы...",
    "delete": "Удалить",
    "deleting": "Удаление...",
    "replyingTo": "Ответ для {name}",
    "replyPlaceholder": "Напишите свой ответ...",
    "cancel": "Отмена",
    "postReply": "Опубликовать ответ",
    "posting": "Публикация...",
    "anonymous": "Аноним",
    "justNow": "только что",
    "minutesAgo": "{count} мин назад",
    "hoursAgo": "{count} ч назад",
    "daysAgo": "{count} дн назад",
    "confirmFlag": "Вы уверены, что хотите пожаловаться на этот комментарий как неприемлемый?",
    "confirmDelete": "Вы уверены, что хотите удалить этот комментарий?"
  },
  "ja": {
    "seller": "出品者",
    "question": "質問",
    "edited": "(編集済み)",
    "reply": "返信",
    "cancelReply": "返信をキャンセル",
    "flag": "報告",
    "flagging": "報告中...",
    "delete": "削除",
    "deleting": "削除中...",
    "replyingTo": "{name} に返信",
    "replyPlaceholder": "返信を入力...",
    "cancel": "キャンセル",
    "postReply": "返信を投稿",
    "posting": "投稿中...",
    "anonymous": "匿名",
    "justNow": "たった今",
    "minutesAgo": "{count}分前",
    "hoursAgo": "{count}時間前",
    "daysAgo": "{count}日前",
    "confirmFlag": "このコメントを不適切として報告してもよろしいですか？",
    "confirmDelete": "このコメントを削除してもよろしいですか？"
  },
  "zh": {
    "seller": "卖家",
    "question": "提问",
    "edited": "(已编辑)",
    "reply": "回复",
    "cancelReply": "取消回复",
    "flag": "举报",
    "flagging": "举报中...",
    "delete": "删除",
    "deleting": "删除中...",
    "replyingTo": "回复 {name}",
    "replyPlaceholder": "写下你的回复...",
    "cancel": "取消",
    "postReply": "发布回复",
    "posting": "发布中...",
    "anonymous": "匿名",
    "justNow": "刚刚",
    "minutesAgo": "{count} 分钟前",
    "hoursAgo": "{count} 小时前",
    "daysAgo": "{count} 天前",
    "confirmFlag": "确定要将此评论举报为不当内容吗？",
    "confirmDelete": "确定要删除此评论吗？"
  },
  "ko": {
    "seller": "판매자",
    "question": "질문",
    "edited": "(수정됨)",
    "reply": "답글",
    "cancelReply": "답글 취소",
    "flag": "신고",
    "flagging": "신고 중...",
    "delete": "삭제",
    "deleting": "삭제 중...",
    "replyingTo": "{name}님에게 답글",
    "replyPlaceholder": "답글을 작성하세요...",
    "cancel": "취소",
    "postReply": "답글 게시",
    "posting": "게시 중...",
    "anonymous": "익명",
    "justNow": "방금 전",
    "minutesAgo": "{count}분 전",
    "hoursAgo": "{count}시간 전",
    "daysAgo": "{count}일 전",
    "confirmFlag": "이 댓글을 부적절한 콘텐츠로 신고하시겠습니까?",
    "confirmDelete": "이 댓글을 삭제하시겠습니까?"
  }
}
</i18n>
