<template>
  <!--
    One shell, one scroll region.

    The empty and conversation states used to be separate subtrees, each with
    its own copy of the composer, inside a fixed-height box that itself sat in a
    scrolling document. That produced two scrollbars, a composer that had to be
    edited in two places, and a page that scrolled itself out from under the nav
    on load. Now the transcript is the only thing that scrolls and the composer
    is a single instance pinned beneath it.
  -->
  <div class="flex h-full min-h-0 flex-col bg-base-100">
    <header class="shrink-0 border-b border-base-300">
      <div class="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <h1 class="text-sm font-semibold">{{ t('assistant_name') }}</h1>
        <span class="badge badge-ghost badge-sm">{{ t('beta') }}</span>
      </div>
    </header>

    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto"
        :class="isChatEmpty ? 'flex' : ''"
        @scroll="handleScroll"
      >
        <div
          class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6"
          :class="isChatEmpty ? 'flex flex-col justify-center' : ''"
        >
          <ChatEmptyState v-if="isChatEmpty" @pick="handleStarter" />

          <div v-else class="space-y-6" role="log">
            <template v-for="message in messages" :key="message.id">
              <HumanMessage v-if="message.type === 'human'" :message="message" :is-loading="isLoading" />
              <AssistantMessage v-else-if="message.type === 'ai'" :message="message" :is-loading="isLoading" />
            </template>

            <!-- Shown only while waiting for the first token. Once text starts
                 arriving the streaming cursor carries the signal, so the
                 indicator no longer sits underneath a half-written reply. -->
            <div v-if="showThinkingIndicator" class="flex items-center gap-3 sm:gap-4">
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

            <!-- Sources sit under the transcript they belong to, at every
                 breakpoint. The desktop layout previously reserved a permanent
                 320px rail that held an empty placeholder for most of a session. -->
            <UsefulLinks v-if="!isLoading && usefulLinks.length > 0" :links="usefulLinks" />
          </div>
        </div>
      </div>

      <!-- Announces stream state without reading every streamed token aloud. -->
      <p class="sr-only" role="status" aria-live="polite">
        {{ isLoading ? t('sr_generating') : '' }}
      </p>

      <button
        v-if="showScrollButton"
        @click="scrollToBottom(true)"
        class="btn btn-circle btn-sm absolute bottom-4 left-1/2 -translate-x-1/2 border-base-300 bg-base-100 shadow-md"
        :title="t('scroll_to_bottom')"
        :aria-label="t('scroll_to_bottom')"
      >
        <i class="fas fa-arrow-down text-xs" aria-hidden="true"></i>
      </button>
    </div>

    <div class="shrink-0 border-t border-base-300 bg-base-100">
      <div class="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
        <ChatComposer
          ref="composerRef"
          v-model="input"
          :is-loading="isLoading"
          :disable-new-chat="isChatEmpty && !isLoading"
          @submit="handleSubmit"
          @stop="stopGeneration"
          @new-chat="handleNewChat"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  import { useStreamProvider } from '~/composables/useStreamProvider';
  import AssistantMessage from './AssistantMessage.vue';
  import ChatComposer from './ChatComposer.vue';
  import ChatEmptyState from './ChatEmptyState.vue';
  import HumanMessage from './HumanMessage.vue';
  import UsefulLinks from './UsefulLinks.vue';

  const {
    assistantId,
    threadId,
    isConfigured,
    isThreadLoaded,
    setThreadId,
    createNewThread,
    updateThreadUsage,
    getThreadData,
  } = useStreamProvider();

  // Reactive state
  const route = useRoute();
  const input = ref('');
  const composerRef = ref<InstanceType<typeof ChatComposer>>();
  const messagesContainer = ref<HTMLDivElement>();
  const showScrollButton = ref(false);

  // The server never has a persisted thread, so SSR always renders the empty
  // (welcome) branch. The client reads localStorage during setup, so without
  // this gate a restored thread flips isChatEmpty to false on the very first
  // client render — a structural hydration mismatch that mangles the page DOM
  // on refresh (chat + footer interleaved). Stay "empty" until after mount.
  const hasMounted = ref(false);
  onMounted(() => {
    hasMounted.value = true;
  });

  // Set when the user starts a new chat, so a stale persisted thread cannot
  // pull the view back out of the empty state.
  const forcedEmpty = ref(false);

  // Check if chat is empty (no messages and no persisted thread)
  const isChatEmpty = computed(() => {
    // Match the server-rendered welcome branch during hydration
    if (!hasMounted.value) {
      return true;
    }

    // If we have messages in the current context, chat is not empty
    if (streamContext?.messages.value && streamContext.messages.value.length > 0) {
      return false;
    }

    if (forcedEmpty.value) {
      return true;
    }

    // If we have a persisted thread with messages, chat is not empty
    if (threadId.value && isThreadLoaded.value) {
      const threadData = getThreadData();
      if (threadData && threadData.messageCount > 0) {
        return false;
      }
    }

    // Otherwise, chat is empty
    return true;
  });

  // Extract useful links from Tavily search results in the current conversation
  const usefulLinks = computed(() => {
    if (!streamContext?.messages.value) return [];

    const links: Array<{ url: string; title: string; content: string; score: number }> = [];

    // Look through all messages for Tavily search results
    for (const message of streamContext.messages.value) {
      if (message.type === 'tool' && message.name === 'tavily_search') {
        try {
          const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
          const searchData = JSON.parse(content);

          if (searchData.results && Array.isArray(searchData.results)) {
            for (const result of searchData.results) {
              if (result.url && result.title && result.content && typeof result.score === 'number') {
                links.push({
                  url: result.url,
                  title: result.title,
                  content: result.content,
                  score: result.score,
                });
              }
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    }

    // Sort by score (highest first) and limit to top 5
    return links.sort((a, b) => b.score - a.score).slice(0, 5);
  });

  // Stream context
  let streamContext: ReturnType<typeof createStreamSession> | null = null;
  const streamContextInitialized = ref(false);

  // Create stream session when configuration is ready
  watch(
    [isConfigured, assistantId, isThreadLoaded],
    () => {
      if (
        isConfigured.value &&
        isThreadLoaded.value &&
        !streamContextInitialized.value &&
        assistantId.value &&
        typeof assistantId.value === 'string'
      ) {
        streamContext = createStreamSession(
          assistantId.value,
          threadId.value || '',
          // Callback when new thread is created
          (newThreadId: string) => {
            setThreadId(newThreadId);
          }
        );
        provideStreamContext(streamContext);
        streamContextInitialized.value = true;
      }
    },
    { immediate: true }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    if (streamContext) {
      streamContext.stop();
      streamContext = null;
      streamContextInitialized.value = false;
    }
  });

  // Computed properties
  const messages = computed(() => streamContext?.messages.value || []);
  const isLoading = computed(() => streamContext?.isLoading.value || false);

  // Only while nothing has been written yet — once the assistant is streaming
  // text, its own cursor is the progress signal.
  const showThinkingIndicator = computed(() => {
    if (!isLoading.value) return false;
    const last = messages.value[messages.value.length - 1];
    if (!last) return true;
    if (last.type !== 'ai' && last.type !== 'assistant') return true;
    const content = last.content;
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('')
          : '';
    return text.trim().length === 0;
  });

  const { capture } = usePostHog();
  const { track } = useAnalytics();

  async function handleSubmit() {
    if (!input.value.trim() || !streamContext || isLoading.value) return;

    const message = input.value.trim();

    capture('chat_message_sent', {
      message_length: message.length,
      is_first_message: isChatEmpty.value,
    });

    input.value = '';
    forcedEmpty.value = false;

    // Submit message with metadata
    const metadata = {
      pageSlug: route.path,
    };

    await streamContext.submit(
      { messages: [{ type: 'human', content: message }] },
      {
        // Use default streamMode from composable for optimized streaming
        metadata,
      }
    );

    // Update thread usage after submitting a message
    updateThreadUsage();
  }

  function handleStarter(prompt: string) {
    if (isLoading.value) return;
    capture('chat_starter_used', { prompt });
    input.value = prompt;
    nextTick(() => handleSubmit());
  }

  function handleNewChat() {
    if (!streamContext) return;
    track('chat_new_conversation');
    streamContext.reset();
    createNewThread();
    input.value = '';
    forcedEmpty.value = true;
    showScrollButton.value = false;
    nextTick(() => composerRef.value?.focus());
  }

  function stopGeneration() {
    if (streamContext) {
      streamContext.stop();
    }
  }

  // Scroll to bottom function
  function scrollToBottom(fromButton = false) {
    if (fromButton) {
      track('chat_scroll_to_bottom');
    }
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  }

  // Handle scroll event to show/hide scroll button
  function handleScroll() {
    if (messagesContainer.value) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      showScrollButton.value = !isNearBottom;
    }
  }

  // Auto-scroll to bottom when new messages arrive
  watch(
    messages,
    () => {
      nextTick(() => {
        if (messagesContainer.value && !showScrollButton.value) {
          scrollToBottom(false);
        }
      });
    },
    { deep: true }
  );

  // Handle pre-populated message from query parameter
  const hasAutoSubmitted = ref(false);

  // Watch for stream context initialization and auto-submit if needed
  watch(
    streamContextInitialized,
    (initialized) => {
      if (!initialized || hasAutoSubmitted.value) return;

      const queryMessage = route.query.message;
      if (
        queryMessage &&
        typeof queryMessage === 'string' &&
        queryMessage.trim() &&
        streamContext &&
        isConfigured.value
      ) {
        hasAutoSubmitted.value = true;
        input.value = queryMessage.trim();

        // Wait for next tick to ensure everything is fully initialized
        nextTick(() => {
          if (streamContext && input.value.trim()) {
            handleSubmit();
          }
        });
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    nextTick(() => {
      composerRef.value?.focus();
      scrollToBottom(false);
    });
  });
</script>

<i18n lang="json">
{
  "en": {
    "assistant_name": "CMDIY Assistant",
    "beta": "Beta",
    "scroll_to_bottom": "Scroll to bottom",
    "sr_generating": "Generating a response"
  },
  "es": {
    "assistant_name": "Asistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Desplazar al final",
    "sr_generating": "Generando una respuesta"
  },
  "fr": {
    "assistant_name": "Assistant CMDIY",
    "beta": "Bêta",
    "scroll_to_bottom": "Défiler vers le bas",
    "sr_generating": "Génération d'une réponse"
  },
  "de": {
    "assistant_name": "CMDIY Assistent",
    "beta": "Beta",
    "scroll_to_bottom": "Nach unten scrollen",
    "sr_generating": "Antwort wird erzeugt"
  },
  "it": {
    "assistant_name": "Assistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Scorri in basso",
    "sr_generating": "Generazione di una risposta"
  },
  "pt": {
    "assistant_name": "Assistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Rolar para baixo",
    "sr_generating": "Gerando uma resposta"
  },
  "ru": {
    "assistant_name": "Помощник CMDIY",
    "beta": "Бета",
    "scroll_to_bottom": "Прокрутить вниз",
    "sr_generating": "Формируется ответ"
  },
  "ja": {
    "assistant_name": "CMDIYアシスタント",
    "beta": "ベータ",
    "scroll_to_bottom": "下までスクロール",
    "sr_generating": "回答を生成しています"
  },
  "zh": {
    "assistant_name": "CMDIY助手",
    "beta": "测试版",
    "scroll_to_bottom": "滚动到底部",
    "sr_generating": "正在生成回复"
  },
  "ko": {
    "assistant_name": "CMDIY 어시스턴트",
    "beta": "베타",
    "scroll_to_bottom": "맨 아래로 스크롤",
    "sr_generating": "응답을 생성하는 중"
  }
}
</i18n>

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
