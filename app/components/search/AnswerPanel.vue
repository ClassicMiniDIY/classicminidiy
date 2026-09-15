<script lang="ts" setup>
  /**
   * The bot's answer beside the results on /search
   * (docs/plans/2026-09-15-unified-search-phase-2.md).
   *
   * Opens only after the visitor selects the Ask row, so it is client-only by
   * construction: SSR never renders it and no `hasMounted` gate is needed.
   * One answer, then "Continue in chat": the thread is recorded into chat
   * history and /chat resumes it on arrival. No composer here — /chat owns
   * conversations, the quota wall and history.
   *
   * The stream is `useChatAnswer`, the same transport /chat uses. A 429
   * should not reach here (the Ask row does not open the panel at limit), but
   * a stale peek can be wrong, so a quota error closes the panel and asks the
   * row to refresh rather than rendering a wall /chat already owns.
   */
  import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
  import type { UIMessage } from 'ai';
  import type { QuotaExhausted } from '~/utils/chatQuotaError';
  import AssistantMessage from '../Chat/AssistantMessage.vue';
  import VideoResults from '../Chat/VideoResults.vue';
  import UsefulLinks from '../Chat/UsefulLinks.vue';
  import { messageText } from '~/utils/chatMessages';
  import { newThreadId, useChatAnswer } from '~/composables/useChatAnswer';

  const props = defineProps<{ query: string }>();
  const emit = defineEmits<{ close: [completed: boolean]; quota: [verdict: QuotaExhausted] }>();

  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const history = useChatHistory();
  const { track } = useAnalytics();

  const threadId = ref(newThreadId());
  const { messages, isLoading, sendMessage, stop, error, quotaError, videos, usefulLinks } = useChatAnswer({
    threadId,
    pageSlug: () => route.path,
  });

  const answer = computed(() => {
    const last = messages.value[messages.value.length - 1] as UIMessage | undefined;
    return last?.role === 'assistant' ? last : undefined;
  });

  /** Only until the first token; after that the streaming cursor is the signal. */
  const showThinking = computed(() => isLoading.value && !messageText(answer.value).trim());

  const completed = ref(false);
  /** Set before `stop()`, so a stream cut short is never counted as completed. */
  const closing = ref(false);
  const showGenericError = computed(() => !!error.value && !quotaError.value);

  watch(isLoading, (loading, was) => {
    if (was && !loading && answer.value && !error.value && !closing.value) {
      completed.value = true;
      track('search_answer_completed', {
        videos: videos.value.length,
        links: usefulLinks.value.length,
        chars: messageText(answer.value).length,
      });
    }
  });

  // The verdict travels with the event so the row can flip to its spent copy
  // from the route's answer, not from a peek that may fail again.
  watch(quotaError, (verdict) => {
    if (verdict) emit('quota', verdict);
  });

  const ask = () => {
    void sendMessage({ text: props.query });
  };

  onMounted(() => {
    // Recorded here rather than on the row, so a panel that never mounted
    // (a stale-peek close) is not counted as an opened answer.
    track('search_answer_opened', { query_length: props.query.length });
    ask();
  });

  const retry = () => {
    threadId.value = newThreadId();
    messages.value = [];
    ask();
  };

  /**
   * /chat resumes `history.entries[0]` on mount, so recording this thread as
   * the most recent entry IS the handoff. No `?message=`: the thread already
   * holds the question and the answer, and an auto-submit would send it twice.
   */
  const continueInChat = () => {
    // `load()` first: `record()` merges into the loaded list and persists the
    // result, so recording into an unloaded (empty) list would overwrite
    // every other conversation in this browser with this one.
    history.load();
    history.record(threadId.value, {
      title: history.deriveTitle(props.query),
      messages: messages.value as UIMessage[],
    });
    track('search_answer_continued');
    router.push({ path: '/chat', query: { source: 'search-panel' } });
  };

  const close = () => {
    closing.value = true;
    if (isLoading.value) stop();
    track('search_answer_closed', { completed: completed.value });
    emit('close', completed.value);
  };

  // A new query, a navigation, or "Continue in chat" unmounts the panel
  // mid-stream. `@ai-sdk/vue` registers no unmount hook of its own, so without
  // this the fetch stays open and an orphaned Chat keeps writing a detached
  // ref until the server finishes.
  onBeforeUnmount(() => {
    closing.value = true;
    if (isLoading.value) stop();
  });
</script>

<template>
  <!--
    Not a live region. The streaming reply is inside, and a live region would
    re-announce it on every token — the same reason ChatWindow.vue keeps the
    transcript out of one and uses a single sr-only status line.
  -->
  <section
    class="search-answer-panel flex flex-col rounded-box border border-secondary/30 bg-base-100 shadow-sm"
    :aria-label="t('aria_label')"
  >
    <span class="sr-only" role="status" aria-live="polite">{{ isLoading ? t('generating') : '' }}</span>
    <header class="flex items-start gap-3 border-b border-base-300 px-4 py-3">
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary"
        aria-hidden="true"
      >
        <i class="fas fa-robot"></i>
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[11px] font-bold tracking-[0.08em] uppercase opacity-55">{{ t('title') }}</span>
        <span class="block truncate text-[14.5px] font-semibold">&ldquo;{{ query }}&rdquo;</span>
      </span>
      <button type="button" class="btn btn-ghost btn-xs btn-square" :aria-label="t('close')" @click="close()">
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </header>

    <div class="flex flex-col gap-5 px-4 py-4">
      <div v-if="showThinking" class="flex items-center gap-3">
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary"
          aria-hidden="true"
        >
          <i class="fas fa-comments"></i>
        </div>
        <div class="flex items-center gap-1" aria-hidden="true">
          <span class="thinking-dot h-1.5 w-1.5 rounded-full bg-base-content/40"></span>
          <span class="thinking-dot h-1.5 w-1.5 rounded-full bg-base-content/40"></span>
          <span class="thinking-dot h-1.5 w-1.5 rounded-full bg-base-content/40"></span>
        </div>
      </div>

      <AssistantMessage v-if="answer" :message="answer" :is-loading="isLoading" :thread-id="threadId" />

      <div v-if="showGenericError" role="alert" class="alert alert-error">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        <span>{{ t('request_failed') }}</span>
        <button type="button" class="btn btn-sm" @click="retry()">{{ t('retry') }}</button>
      </div>

      <VideoResults v-if="!isLoading && videos.length > 0" :videos="videos" variant="inline" />
      <UsefulLinks v-if="!isLoading && usefulLinks.length > 0" :links="usefulLinks" />

      <p class="text-xs opacity-60">{{ t('disclaimer') }}</p>
    </div>

    <footer v-if="completed" class="flex flex-wrap items-center gap-2 border-t border-base-300 px-4 py-3">
      <button type="button" class="btn btn-primary btn-sm" @click="continueInChat()">
        <i class="fas fa-comments" aria-hidden="true"></i>
        {{ t('continue') }}
      </button>
      <button type="button" class="btn btn-ghost btn-sm" @click="close()">{{ t('done') }}</button>
    </footer>
  </section>
</template>

<style scoped>
  .thinking-dot {
    animation: thinkingPulse 1.4s ease-in-out infinite;
  }
  .thinking-dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .thinking-dot:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes thinkingPulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .thinking-dot {
      animation: none;
      opacity: 0.6;
    }
  }
</style>

<i18n lang="json">
{
  "en": {
    "aria_label": "Answer from DIY Mini Bot",
    "title": "DIY Mini Bot",
    "close": "Close answer",
    "generating": "Generating a response",
    "request_failed": "Something went wrong. Please try again.",
    "retry": "Try again",
    "continue": "Continue in chat",
    "done": "Done",
    "disclaimer": "Experimental and can be wrong. Verify anything critical against official documentation or a qualified mechanic."
  },
  "es": {
    "aria_label": "Respuesta de DIY Mini Bot",
    "title": "DIY Mini Bot",
    "close": "Cerrar respuesta",
    "generating": "Generando una respuesta",
    "request_failed": "Algo salió mal. Inténtalo de nuevo.",
    "retry": "Reintentar",
    "continue": "Continuar en el chat",
    "done": "Listo",
    "disclaimer": "Experimental y puede equivocarse. Verifica lo importante con la documentación oficial o un mecánico cualificado."
  },
  "fr": {
    "aria_label": "Réponse de DIY Mini Bot",
    "title": "DIY Mini Bot",
    "close": "Fermer la réponse",
    "generating": "Génération d’une réponse",
    "request_failed": "Une erreur est survenue. Réessayez.",
    "retry": "Réessayer",
    "continue": "Continuer dans le chat",
    "done": "Terminé",
    "disclaimer": "Expérimental et parfois erroné. Vérifiez tout point critique avec la documentation officielle ou un mécanicien qualifié."
  },
  "de": {
    "aria_label": "Antwort von DIY Mini Bot",
    "title": "DIY Mini Bot",
    "close": "Antwort schließen",
    "generating": "Antwort wird erstellt",
    "request_failed": "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    "retry": "Erneut versuchen",
    "continue": "Im Chat fortsetzen",
    "done": "Fertig",
    "disclaimer": "Experimentell und kann falsch sein. Prüfe alles Wichtige anhand der offiziellen Dokumentation oder mit einer Fachwerkstatt."
  },
  "it": {
    "aria_label": "Risposta di DIY Mini Bot",
    "title": "DIY Mini Bot",
    "close": "Chiudi risposta",
    "generating": "Generazione della risposta",
    "request_failed": "Qualcosa è andato storto. Riprova.",
    "retry": "Riprova",
    "continue": "Continua nella chat",
    "done": "Fatto",
    "disclaimer": "Sperimentale e può sbagliare. Verifica ogni dato critico con la documentazione ufficiale o un meccanico qualificato."
  },
  "pt": {
    "aria_label": "Resposta do DIY Mini Bot",
    "title": "DIY Mini Bot",
    "close": "Fechar resposta",
    "generating": "A gerar uma resposta",
    "request_failed": "Algo correu mal. Tente novamente.",
    "retry": "Tentar novamente",
    "continue": "Continuar no chat",
    "done": "Concluído",
    "disclaimer": "Experimental e pode estar errado. Confirme o que for crítico na documentação oficial ou com um mecânico qualificado."
  },
  "ru": {
    "aria_label": "Ответ DIY Mini Bot",
    "title": "DIY Mini Bot",
    "close": "Закрыть ответ",
    "generating": "Генерация ответа",
    "request_failed": "Что-то пошло не так. Попробуйте ещё раз.",
    "retry": "Повторить",
    "continue": "Продолжить в чате",
    "done": "Готово",
    "disclaimer": "Экспериментально и может ошибаться. Проверяйте всё важное по официальной документации или у квалифицированного механика."
  },
  "ja": {
    "aria_label": "DIY Mini Bot の回答",
    "title": "DIY Mini Bot",
    "close": "回答を閉じる",
    "generating": "回答を生成中",
    "request_failed": "問題が発生しました。もう一度お試しください。",
    "retry": "再試行",
    "continue": "チャットで続ける",
    "done": "完了",
    "disclaimer": "実験的な機能で、誤りを含むことがあります。重要な点は公式資料や整備士に確認してください。"
  },
  "zh": {
    "aria_label": "DIY Mini Bot 的回答",
    "title": "DIY Mini Bot",
    "close": "关闭回答",
    "generating": "正在生成回答",
    "request_failed": "出了点问题，请重试。",
    "retry": "重试",
    "continue": "在聊天中继续",
    "done": "完成",
    "disclaimer": "实验性功能，可能出错。关键内容请以官方文档或专业技师为准。"
  },
  "ko": {
    "aria_label": "DIY Mini Bot의 답변",
    "title": "DIY Mini Bot",
    "close": "답변 닫기",
    "generating": "답변 생성 중",
    "request_failed": "문제가 발생했습니다. 다시 시도해 주세요.",
    "retry": "다시 시도",
    "continue": "채팅에서 계속하기",
    "done": "완료",
    "disclaimer": "실험적인 기능이며 틀릴 수 있습니다. 중요한 내용은 공식 문서나 전문 정비사에게 확인하세요."
  }
}
</i18n>
