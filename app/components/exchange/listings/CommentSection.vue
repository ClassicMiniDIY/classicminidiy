<template>
  <div class="card bg-base-100">
    <div class="card-body">
      <!-- Section Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-2xl font-bold">
          {{ t('header.title') }}
          <span class="text-base-content/60 text-lg ml-2">({{ totalComments }})</span>
        </h3>

        <!-- Sort Dropdown -->
        <select v-model="sortBy" class="select select-sm select-bordered" :aria-label="t('sort.ariaLabel')">
          <option value="newest">{{ t('sort.newest') }}</option>
          <option value="oldest">{{ t('sort.oldest') }}</option>
          <option value="questions">{{ t('sort.questions') }}</option>
        </select>
      </div>

      <!-- Comment Form -->
      <div class="mb-8">
        <div v-if="user" class="bg-base-200 rounded-lg p-4 space-y-3">
          <!-- Textarea -->
          <textarea
            v-model="newComment"
            :placeholder="t('form.placeholder')"
            class="textarea textarea-bordered bg-base-100 w-full"
            rows="3"
            maxlength="2000"
            :disabled="submitting"
            :aria-label="t('form.ariaLabel')"
          ></textarea>

          <!-- Character count and actions -->
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="isQuestion" type="checkbox" class="checkbox checkbox-sm" :disabled="submitting" />
              <span class="text-sm">{{ t('form.markAsQuestion') }}</span>
            </label>

            <div class="flex items-center gap-3">
              <span class="text-xs text-base-content/60"> {{ newComment.length }}/2000 </span>
              <button @click="handleSubmit" :disabled="!newComment.trim() || submitting" class="btn btn-primary btn-sm">
                <i v-if="!submitting" class="fas fa-paper-plane"></i>
                <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
                {{ submitting ? t('form.posting') : t('form.post') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Sign in prompt -->
        <div v-else class="alert alert-info">
          <i class="fas fa-circle-info"></i>
          <span>{{ t('signInPrompt') }}</span>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="flex gap-3">
          <div class="skeleton w-10 h-10 rounded-full"></div>
          <div class="flex-1 space-y-2">
            <div class="skeleton h-4 w-32"></div>
            <div class="skeleton h-16 w-full"></div>
          </div>
        </div>
      </div>

      <!-- Comments List -->
      <div v-else-if="sortedComments.length > 0" class="space-y-6">
        <ExchangeListingsComment
          v-for="comment in sortedComments"
          :key="comment.id"
          :comment="comment"
          :listing-id="listingId"
        />
      </div>

      <!-- Load More Comments -->
      <div v-if="hasMore" class="text-center mt-6">
        <button class="btn btn-outline btn-sm" @click="loadMore" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          {{ t('loadMore') }}
        </button>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-12">
        <i class="fas fa-comments text-6xl mx-auto text-base-content/30 mb-3"></i>
        <p class="text-base-content/60">{{ t('empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const props = defineProps<{
    listingId: string;
    externalListingId?: string;
  }>();

  const { t } = useI18n();

  const { user } = useAuth();
  const { capture } = usePostHog();

  // Determine the target ID and type for comments
  const commentTargetId = props.externalListingId || props.listingId;
  const commentTargetType = props.externalListingId ? ('external' as const) : ('listing' as const);
  const { comments, loading, submitting, totalComments, hasMore, fetchComments, loadMore, postComment } = useComments(
    commentTargetId,
    commentTargetType
  );

  // Form state
  const newComment = ref('');
  const isQuestion = ref(false);
  const sortBy = ref('newest');

  // Track comments view (only once per mount)
  const hasTrackedView = ref(false);
  watch(
    () => comments.value,
    (newComments) => {
      if (newComments && !hasTrackedView.value && !loading.value) {
        capture('comments_viewed', {
          listing_id: props.listingId,
          comment_count: newComments.length,
        });
        hasTrackedView.value = true;
      }
    },
    { immediate: true }
  );

  // Sorted comments
  const sortedComments = computed(() => {
    const sorted = [...comments.value];

    switch (sortBy.value) {
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'questions':
        return sorted.sort((a, b) => {
          if (a.is_question && !b.is_question) return -1;
          if (!a.is_question && b.is_question) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      case 'newest':
      default:
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  });

  // Handle submitting a comment
  const handleSubmit = async () => {
    const success = await postComment(newComment.value, null, isQuestion.value);

    if (success) {
      newComment.value = '';
      isQuestion.value = false;
    }
  };

  // Fetch comments on mount
  onMounted(() => {
    fetchComments();
  });
</script>

<i18n lang="json">
{
  "en": {
    "header": { "title": "Comments & Questions" },
    "sort": { "ariaLabel": "Sort comments", "newest": "Newest First", "oldest": "Oldest First", "questions": "Questions First" },
    "form": { "placeholder": "Ask a question or leave a comment...", "ariaLabel": "Write a comment or question", "markAsQuestion": "Mark as question", "post": "Post Comment", "posting": "Posting..." },
    "signInPrompt": "Please sign in to post comments and ask questions",
    "loadMore": "Load More Comments",
    "empty": "No comments yet. Be the first to comment!"
  },
  "es": {
    "header": { "title": "Comentarios y preguntas" },
    "sort": { "ariaLabel": "Ordenar comentarios", "newest": "Más recientes primero", "oldest": "Más antiguos primero", "questions": "Preguntas primero" },
    "form": { "placeholder": "Haz una pregunta o deja un comentario...", "ariaLabel": "Escribe un comentario o pregunta", "markAsQuestion": "Marcar como pregunta", "post": "Publicar comentario", "posting": "Publicando..." },
    "signInPrompt": "Inicia sesión para publicar comentarios y hacer preguntas",
    "loadMore": "Cargar más comentarios",
    "empty": "Aún no hay comentarios. ¡Sé el primero en comentar!"
  },
  "fr": {
    "header": { "title": "Commentaires et questions" },
    "sort": { "ariaLabel": "Trier les commentaires", "newest": "Plus récents d'abord", "oldest": "Plus anciens d'abord", "questions": "Questions d'abord" },
    "form": { "placeholder": "Posez une question ou laissez un commentaire...", "ariaLabel": "Écrire un commentaire ou une question", "markAsQuestion": "Marquer comme question", "post": "Publier le commentaire", "posting": "Publication..." },
    "signInPrompt": "Veuillez vous connecter pour publier des commentaires et poser des questions",
    "loadMore": "Charger plus de commentaires",
    "empty": "Aucun commentaire pour le moment. Soyez le premier à commenter !"
  },
  "de": {
    "header": { "title": "Kommentare und Fragen" },
    "sort": { "ariaLabel": "Kommentare sortieren", "newest": "Neueste zuerst", "oldest": "Älteste zuerst", "questions": "Fragen zuerst" },
    "form": { "placeholder": "Stelle eine Frage oder hinterlasse einen Kommentar...", "ariaLabel": "Kommentar oder Frage schreiben", "markAsQuestion": "Als Frage markieren", "post": "Kommentar posten", "posting": "Wird gepostet..." },
    "signInPrompt": "Bitte melde dich an, um Kommentare zu posten und Fragen zu stellen",
    "loadMore": "Mehr Kommentare laden",
    "empty": "Noch keine Kommentare. Sei der Erste, der kommentiert!"
  },
  "it": {
    "header": { "title": "Commenti e domande" },
    "sort": { "ariaLabel": "Ordina commenti", "newest": "Più recenti prima", "oldest": "Più vecchi prima", "questions": "Domande prima" },
    "form": { "placeholder": "Fai una domanda o lascia un commento...", "ariaLabel": "Scrivi un commento o una domanda", "markAsQuestion": "Segna come domanda", "post": "Pubblica commento", "posting": "Pubblicazione..." },
    "signInPrompt": "Accedi per pubblicare commenti e fare domande",
    "loadMore": "Carica altri commenti",
    "empty": "Ancora nessun commento. Sii il primo a commentare!"
  },
  "pt": {
    "header": { "title": "Comentários e perguntas" },
    "sort": { "ariaLabel": "Ordenar comentários", "newest": "Mais recentes primeiro", "oldest": "Mais antigos primeiro", "questions": "Perguntas primeiro" },
    "form": { "placeholder": "Faça uma pergunta ou deixe um comentário...", "ariaLabel": "Escreva um comentário ou pergunta", "markAsQuestion": "Marcar como pergunta", "post": "Publicar comentário", "posting": "Publicando..." },
    "signInPrompt": "Faça login para publicar comentários e fazer perguntas",
    "loadMore": "Carregar mais comentários",
    "empty": "Ainda não há comentários. Seja o primeiro a comentar!"
  },
  "ru": {
    "header": { "title": "Комментарии и вопросы" },
    "sort": { "ariaLabel": "Сортировать комментарии", "newest": "Сначала новые", "oldest": "Сначала старые", "questions": "Сначала вопросы" },
    "form": { "placeholder": "Задайте вопрос или оставьте комментарий...", "ariaLabel": "Напишите комментарий или вопрос", "markAsQuestion": "Отметить как вопрос", "post": "Опубликовать комментарий", "posting": "Публикация..." },
    "signInPrompt": "Войдите, чтобы оставлять комментарии и задавать вопросы",
    "loadMore": "Загрузить больше комментариев",
    "empty": "Комментариев пока нет. Будьте первым, кто оставит комментарий!"
  },
  "ja": {
    "header": { "title": "コメントと質問" },
    "sort": { "ariaLabel": "コメントを並べ替え", "newest": "新しい順", "oldest": "古い順", "questions": "質問を優先" },
    "form": { "placeholder": "質問するかコメントを残してください...", "ariaLabel": "コメントまたは質問を書く", "markAsQuestion": "質問としてマーク", "post": "コメントを投稿", "posting": "投稿中..." },
    "signInPrompt": "コメントの投稿や質問にはサインインしてください",
    "loadMore": "コメントをもっと読み込む",
    "empty": "まだコメントはありません。最初のコメントを投稿しましょう！"
  },
  "zh": {
    "header": { "title": "评论与提问" },
    "sort": { "ariaLabel": "排序评论", "newest": "最新优先", "oldest": "最早优先", "questions": "提问优先" },
    "form": { "placeholder": "提出问题或留下评论...", "ariaLabel": "撰写评论或提问", "markAsQuestion": "标记为提问", "post": "发布评论", "posting": "发布中..." },
    "signInPrompt": "请登录后发布评论和提问",
    "loadMore": "加载更多评论",
    "empty": "暂无评论。来发表第一条评论吧！"
  },
  "ko": {
    "header": { "title": "댓글 및 질문" },
    "sort": { "ariaLabel": "댓글 정렬", "newest": "최신순", "oldest": "오래된순", "questions": "질문 우선" },
    "form": { "placeholder": "질문하거나 댓글을 남겨보세요...", "ariaLabel": "댓글 또는 질문 작성", "markAsQuestion": "질문으로 표시", "post": "댓글 게시", "posting": "게시 중..." },
    "signInPrompt": "댓글을 게시하고 질문하려면 로그인하세요",
    "loadMore": "댓글 더 보기",
    "empty": "아직 댓글이 없습니다. 첫 번째로 댓글을 남겨보세요!"
  }
}
</i18n>
