<script setup lang="ts">
  /**
   * Comment thread (keystone §11 PR 8). Reads approved comments from the server
   * route; posting/replying is a direct RLS insert via the authed Supabase client
   * (a trigger sets moderation_status from the author's trust — `new` users land
   * in `pending` and only see their own until approved). One level of threading.
   */
  import { DateTime } from 'luxon';

  const props = defineProps<{ modelId: string }>();

  const { t } = useI18n();
  const supabase = useSupabase();
  const { isAuthenticated, user } = useAuth();

  const { data, refresh, pending } = await useFetch(() => `/api/models/${props.modelId}/comments`);
  const comments = computed(() => data.value?.comments ?? []);
  const total = computed(() => data.value?.total ?? 0);

  const draft = ref('');
  const replyTo = ref<string | null>(null);
  const replyDraft = ref('');
  const posting = ref(false);
  const error = ref('');
  const pendingNote = ref(false);

  function rel(iso: string) {
    return DateTime.fromISO(iso).toRelative() || '';
  }

  async function post(content: string, parentId: string | null) {
    if (!isAuthenticated.value) return navigateTo('/login');
    const text = content.trim();
    if (!text || !user.value) return;
    posting.value = true;
    error.value = '';
    pendingNote.value = false;
    try {
      const { data: row, error: e } = await supabase
        .from('model_comments')
        .insert({ model_id: props.modelId, user_id: user.value.id, content: text.slice(0, 2000), parent_id: parentId })
        .select('id, moderation_status')
        .single();
      if (e) throw e;
      draft.value = '';
      replyDraft.value = '';
      replyTo.value = null;
      if (row?.moderation_status === 'approved') await refresh();
      else pendingNote.value = true;
    } catch (e: any) {
      error.value = e?.message || t('errorPost');
    } finally {
      posting.value = false;
    }
  }
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body">
      <h2 class="card-title text-lg"><i class="fas fa-comments text-primary mr-1"></i> {{ t('title', { count: total }) }}</h2>

      <!-- New comment -->
      <div v-if="isAuthenticated" class="mb-2">
        <textarea
          v-model="draft"
          rows="2"
          maxlength="2000"
          class="textarea textarea-bordered w-full"
          :placeholder="t('placeholder')"
        ></textarea>
        <div class="flex justify-between items-center mt-1">
          <span v-if="pendingNote" class="text-xs opacity-60"
            ><i class="fas fa-clock mr-1"></i> {{ t('pendingModeration') }}</span
          >
          <span v-else></span>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="posting || !draft.trim()"
            @click="post(draft, null)"
          >
            <span v-if="posting" class="loading loading-spinner loading-xs"></span> {{ t('post') }}
          </button>
        </div>
      </div>
      <p v-else class="text-sm opacity-70 mb-2">
        <NuxtLink to="/login" class="link link-primary">{{ t('signIn') }}</NuxtLink> {{ t('joinConversation') }}
      </p>
      <p v-if="error" class="text-error text-sm">{{ error }}</p>

      <div v-if="pending" class="py-6 text-center"><span class="loading loading-spinner text-primary"></span></div>
      <p v-else-if="comments.length === 0" class="text-sm opacity-60 py-2">{{ t('noComments') }}</p>

      <ul v-else class="space-y-4">
        <li v-for="c in comments" :key="c.id">
          <div class="flex gap-3">
            <img
              v-if="c.author?.avatarUrl"
              :src="c.author.avatarUrl"
              class="w-8 h-8 rounded-full object-cover shrink-0"
              :alt="c.author.displayName || ''"
            />
            <i v-else class="fas fa-circle-user text-2xl opacity-60 shrink-0"></i>
            <div class="flex-1 min-w-0">
              <p class="text-sm">
                <strong>{{ c.author?.displayName || c.author?.username || t('anonymous') }}</strong>
                <span class="opacity-50 text-xs ml-1"
                  >{{ rel(c.createdAt) }}<span v-if="c.editedAt"> · {{ t('edited') }}</span></span
                >
              </p>
              <p class="text-sm whitespace-pre-line">{{ c.content }}</p>
              <button
                v-if="isAuthenticated"
                type="button"
                class="btn btn-ghost btn-xs mt-1"
                @click="replyTo = replyTo === c.id ? null : c.id"
              >
                <i class="fas fa-reply mr-1"></i> {{ t('reply') }}
              </button>

              <!-- Reply form -->
              <div v-if="replyTo === c.id" class="mt-2">
                <textarea
                  v-model="replyDraft"
                  rows="2"
                  maxlength="2000"
                  class="textarea textarea-bordered textarea-sm w-full"
                  :placeholder="t('replyPlaceholder')"
                ></textarea>
                <div class="flex justify-end gap-2 mt-1">
                  <button type="button" class="btn btn-ghost btn-xs" @click="replyTo = null">{{ t('cancel') }}</button>
                  <button
                    type="button"
                    class="btn btn-primary btn-xs"
                    :disabled="posting || !replyDraft.trim()"
                    @click="post(replyDraft, c.id)"
                  >
                    {{ t('reply') }}
                  </button>
                </div>
              </div>

              <!-- Replies -->
              <ul v-if="c.replies?.length" class="mt-3 space-y-3 pl-4 border-l border-base-300">
                <li v-for="r in c.replies" :key="r.id" class="flex gap-3">
                  <img
                    v-if="r.author?.avatarUrl"
                    :src="r.author.avatarUrl"
                    class="w-7 h-7 rounded-full object-cover shrink-0"
                    :alt="r.author.displayName || ''"
                  />
                  <i v-else class="fas fa-circle-user text-xl opacity-60 shrink-0"></i>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm">
                      <strong>{{ r.author?.displayName || r.author?.username || t('anonymous') }}</strong>
                      <span class="opacity-50 text-xs ml-1">{{ rel(r.createdAt) }}</span>
                    </p>
                    <p class="text-sm whitespace-pre-line">{{ r.content }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "title": "Comments ({count})",
    "placeholder": "Share tips, ask a question…",
    "pendingModeration": "Your comment is awaiting moderation.",
    "post": "Post",
    "signIn": "Sign in",
    "joinConversation": "to join the conversation.",
    "noComments": "No comments yet — be the first.",
    "anonymous": "Anonymous",
    "edited": "edited",
    "reply": "Reply",
    "replyPlaceholder": "Write a reply…",
    "cancel": "Cancel",
    "errorPost": "Could not post your comment."
  },
  "es": {
    "title": "Comentarios ({count})",
    "placeholder": "Comparte consejos, haz una pregunta…",
    "pendingModeration": "Tu comentario está pendiente de moderación.",
    "post": "Publicar",
    "signIn": "Inicia sesión",
    "joinConversation": "para unirte a la conversación.",
    "noComments": "Aún no hay comentarios — sé el primero.",
    "anonymous": "Anónimo",
    "edited": "editado",
    "reply": "Responder",
    "replyPlaceholder": "Escribe una respuesta…",
    "cancel": "Cancelar",
    "errorPost": "No se pudo publicar tu comentario."
  },
  "fr": {
    "title": "Commentaires ({count})",
    "placeholder": "Partagez des astuces, posez une question…",
    "pendingModeration": "Votre commentaire est en attente de modération.",
    "post": "Publier",
    "signIn": "Connectez-vous",
    "joinConversation": "pour rejoindre la conversation.",
    "noComments": "Aucun commentaire pour l'instant — soyez le premier.",
    "anonymous": "Anonyme",
    "edited": "modifié",
    "reply": "Répondre",
    "replyPlaceholder": "Écrivez une réponse…",
    "cancel": "Annuler",
    "errorPost": "Impossible de publier votre commentaire."
  },
  "de": {
    "title": "Kommentare ({count})",
    "placeholder": "Tipps teilen, eine Frage stellen…",
    "pendingModeration": "Ihr Kommentar wartet auf Moderation.",
    "post": "Posten",
    "signIn": "Anmelden",
    "joinConversation": "um an der Unterhaltung teilzunehmen.",
    "noComments": "Noch keine Kommentare — sei der Erste.",
    "anonymous": "Anonym",
    "edited": "bearbeitet",
    "reply": "Antworten",
    "replyPlaceholder": "Eine Antwort schreiben…",
    "cancel": "Abbrechen",
    "errorPost": "Kommentar konnte nicht gepostet werden."
  },
  "it": {
    "title": "Commenti ({count})",
    "placeholder": "Condividi consigli, fai una domanda…",
    "pendingModeration": "Il tuo commento è in attesa di moderazione.",
    "post": "Pubblica",
    "signIn": "Accedi",
    "joinConversation": "per partecipare alla conversazione.",
    "noComments": "Ancora nessun commento — sii il primo.",
    "anonymous": "Anonimo",
    "edited": "modificato",
    "reply": "Rispondi",
    "replyPlaceholder": "Scrivi una risposta…",
    "cancel": "Annulla",
    "errorPost": "Impossibile pubblicare il commento."
  },
  "pt": {
    "title": "Comentários ({count})",
    "placeholder": "Compartilhe dicas, faça uma pergunta…",
    "pendingModeration": "Seu comentário está aguardando moderação.",
    "post": "Publicar",
    "signIn": "Entre",
    "joinConversation": "para participar da conversa.",
    "noComments": "Nenhum comentário ainda — seja o primeiro.",
    "anonymous": "Anônimo",
    "edited": "editado",
    "reply": "Responder",
    "replyPlaceholder": "Escreva uma resposta…",
    "cancel": "Cancelar",
    "errorPost": "Não foi possível publicar seu comentário."
  },
  "ru": {
    "title": "Комментарии ({count})",
    "placeholder": "Поделитесь советами, задайте вопрос…",
    "pendingModeration": "Ваш комментарий ожидает модерации.",
    "post": "Отправить",
    "signIn": "Войдите",
    "joinConversation": "чтобы присоединиться к разговору.",
    "noComments": "Комментариев пока нет — будьте первым.",
    "anonymous": "Аноним",
    "edited": "изменено",
    "reply": "Ответить",
    "replyPlaceholder": "Напишите ответ…",
    "cancel": "Отмена",
    "errorPost": "Не удалось опубликовать комментарий."
  },
  "ja": {
    "title": "コメント ({count})",
    "placeholder": "ヒントを共有したり、質問したりしましょう…",
    "pendingModeration": "コメントは審査待ちです。",
    "post": "投稿",
    "signIn": "ログイン",
    "joinConversation": "して会話に参加しましょう。",
    "noComments": "まだコメントがありません — 最初のコメントを書いてみましょう。",
    "anonymous": "匿名",
    "edited": "編集済み",
    "reply": "返信",
    "replyPlaceholder": "返信を書く…",
    "cancel": "キャンセル",
    "errorPost": "コメントを投稿できませんでした。"
  },
  "zh": {
    "title": "评论 ({count})",
    "placeholder": "分享技巧，提出问题…",
    "pendingModeration": "您的评论正在等待审核。",
    "post": "发布",
    "signIn": "登录",
    "joinConversation": "加入讨论。",
    "noComments": "暂无评论 — 来发第一条吧。",
    "anonymous": "匿名",
    "edited": "已编辑",
    "reply": "回复",
    "replyPlaceholder": "写下回复…",
    "cancel": "取消",
    "errorPost": "无法发布您的评论。"
  },
  "ko": {
    "title": "댓글 ({count})",
    "placeholder": "팁을 공유하거나 질문하세요…",
    "pendingModeration": "댓글이 검토 중입니다.",
    "post": "게시",
    "signIn": "로그인",
    "joinConversation": "하여 대화에 참여하세요.",
    "noComments": "아직 댓글이 없습니다 — 첫 번째로 남겨보세요.",
    "anonymous": "익명",
    "edited": "수정됨",
    "reply": "답글",
    "replyPlaceholder": "답글을 작성하세요…",
    "cancel": "취소",
    "errorPost": "댓글을 게시할 수 없습니다."
  }
}
</i18n>
