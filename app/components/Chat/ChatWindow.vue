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

        <button type="button" class="btn btn-ghost btn-sm ml-auto gap-2 font-normal" @click="historyOpen = true">
          <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
          <span class="hidden sm:inline">{{ t('history') }}</span>
          <span class="sr-only sm:hidden">{{ t('history') }}</span>
          <!-- Count is rendered only after mount: it comes from localStorage,
               which the server cannot know, and rendering it during setup is
               the hydration mismatch documented in CLAUDE.md. -->
          <span v-if="hasMounted && history.entries.value.length > 0" class="badge badge-sm">
            {{ history.entries.value.length }}
          </span>
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <!-- Chat column: transcript and composer share a width, so the reading
           column never shifts when the rail's contents change.

           `min-w-0` is load-bearing, exactly as it is in AssistantMessage. A
           flex item defaults to `min-width: auto`, so without it this column
           refuses to shrink below the intrinsic width of its widest content —
           a long source URL or an unbroken part number — and pushes itself
           past the viewport instead of wrapping. -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
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

              <!-- Deliberately NOT `role="log"`: that role carries an implicit
               `aria-live="polite"`, which would make a screen reader re-announce
               the whole reply on every streamed token. The sr-only status region
               below is the single announcement point. -->
              <div v-else class="space-y-6">
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

                <!-- Below `lg` there is no room for a rail, so sources fall inline
                 under the transcript. From `lg` up the rail takes over. -->
                <UsefulLinks v-if="!isLoading && usefulLinks.length > 0" :links="usefulLinks" class="lg:hidden" />
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

      <!--
        Supplementary sources, beside the conversation rather than inside it.
        The rail is always present from `lg` up — including when empty — so the
        chat column keeps a constant width and nothing reflows mid-answer when
        a search returns.
      -->
      <aside
        class="hidden w-80 shrink-0 overflow-y-auto border-l border-base-300 bg-base-200/40 p-4 lg:block"
        :aria-label="t('useful_links_region')"
      >
        <UsefulLinksSidebar v-if="!isLoading && usefulLinks.length > 0" :links="usefulLinks" />
        <div v-else class="mt-8 text-center text-base-content/50">
          <i class="fas fa-link mb-2 block text-2xl" aria-hidden="true"></i>
          <p class="text-sm">{{ t('useful_links_placeholder') }}</p>
        </div>
      </aside>
    </div>

    <ChatHistoryDialog
      :entries="history.entries.value"
      :active-thread-id="streamContext?.threadId.value"
      :open="historyOpen"
      @select="handleSelectThread"
      @remove="handleRemoveThread"
      @clear="handleClearHistory"
      @close="historyOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
  // `locale` is read here, once, and injected into createStreamSession below.
  // Calling useI18n() a second time inside that function triggered vue-i18n's
  // "Duplicate useI18n calling by local scope" warning on every /chat load.
  const { t, locale } = useI18n();
  import { useStreamProvider } from '~/composables/useStreamProvider';
  import AssistantMessage from './AssistantMessage.vue';
  import ChatComposer from './ChatComposer.vue';
  import ChatEmptyState from './ChatEmptyState.vue';
  import ChatHistoryDialog from './ChatHistoryDialog.vue';
  import HumanMessage from './HumanMessage.vue';
  import UsefulLinks from './UsefulLinks.vue';
  import UsefulLinksSidebar from './UsefulLinksSidebar.vue';

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
  const historyOpen = ref(false);

  const history = useChatHistory();

  // The server never has a persisted thread, so SSR always renders the empty
  // (welcome) branch. The client reads localStorage during setup, so without
  // this gate a restored thread flips isChatEmpty to false on the very first
  // client render — a structural hydration mismatch that mangles the page DOM
  // on refresh (chat + footer interleaved). Stay "empty" until after mount.
  const hasMounted = ref(false);
  onMounted(() => {
    hasMounted.value = true;
    // Reads localStorage, so it must run after mount — same rule as
    // useRecentTools().load(); see CLAUDE.md.
    history.load();
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
          },
          // Passed as the ref, so switching language mid-conversation applies
          // to the next message rather than being frozen at creation.
          locale
        );
        provideStreamContext(streamContext);
        streamContextInitialized.value = true;
      }
    },
    { immediate: true }
  );

  // Record the conversation as soon as the thread id exists, rather than only
  // after the run finishes. `submit()` resolves when the stream closes, so
  // recording solely there loses the conversation if the visitor navigates
  // away or closes the tab mid-answer.
  watch(
    () => streamContext?.threadId.value,
    (id) => {
      if (!id || !hasMounted.value) return;
      const firstHuman = messages.value.find((m: any) => m.type === 'human');
      if (!firstHuman) return;
      history.record(id, {
        title: history.deriveTitle(getMessageText(firstHuman.content)),
        messageCount: messages.value.length,
      });
    }
  );

  // A persisted thread id the API rejects (deleted, expired, or never valid)
  // must be dropped, not retried. Before this, a bad id sat in localStorage and
  // re-requested a 422 on every single page load.
  watch(
    () => streamContext?.threadMissing.value,
    (missing) => {
      if (!missing) return;
      const staleId = streamContext?.threadId.value;
      if (staleId) history.remove(staleId);
      createNewThread();
      streamContext?.reset();
      forcedEmpty.value = true;
    }
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
    // Explicit, because the composer's watcher can be skipped on this path:
    // a starter sets the value and this clears it, and if both land in one
    // flush Vue sees no net change and never fires the callback, leaving the
    // field stuck at the height it measured for the prompt.
    nextTick(() => composerRef.value?.resize());

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
    recordCurrentThread(message);
  }

  /**
   * Add or refresh this conversation in local history.
   *
   * Called after submit, because the thread id does not exist until the run
   * starts — a brand new conversation only learns its id from the stream.
   */
  function recordCurrentThread(firstMessageFallback: string) {
    const id = streamContext?.threadId.value;
    if (!id) return;

    const firstHuman = messages.value.find((m: any) => m.type === 'human');
    const titleSource = firstHuman ? getMessageText(firstHuman.content) : firstMessageFallback;

    history.record(id, {
      title: history.deriveTitle(titleSource || firstMessageFallback),
      messageCount: messages.value.length,
    });
  }

  function getMessageText(content: any): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((item: any) => item?.type === 'text')
        .map((item: any) => item.text)
        .join(' ');
    }
    return '';
  }

  async function handleSelectThread(id: string) {
    if (!streamContext || id === streamContext.threadId.value) {
      historyOpen.value = false;
      return;
    }

    track('chat_history_thread_opened');
    historyOpen.value = false;
    forcedEmpty.value = false;
    input.value = '';

    await streamContext.loadThread(id);

    // The thread may be gone server-side. The threadMissing watcher has
    // already dropped it from history and cleared the persisted id, so
    // carrying on here would write the dead id straight back into both and
    // leave it 422-ing on every future page load — re-creating exactly the
    // loop threadMissing exists to break.
    if (streamContext.threadMissing.value) return;

    // Make it the active thread so a refresh returns to it.
    setThreadId(id);
    history.record(id, { messageCount: messages.value.length });
    nextTick(() => scrollToBottom(false));
  }

  function handleRemoveThread(id: string) {
    history.remove(id);
    // Removing the conversation you are currently in also ends it, otherwise
    // the composer would keep appending to a thread no longer listed.
    if (streamContext?.threadId.value === id) {
      handleNewChat();
    }
  }

  function handleClearHistory() {
    history.clear();
    historyOpen.value = false;
    handleNewChat();
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
    nextTick(() => {
      composerRef.value?.resize();
      composerRef.value?.focus();
    });
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
    "sr_generating": "Generating a response",
    "useful_links_region": "Useful links",
    "useful_links_placeholder": "Links appear here when I search for something",
    "history": "History"
  },
  "es": {
    "assistant_name": "Asistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Desplazar al final",
    "sr_generating": "Generando una respuesta",
    "useful_links_region": "Enlaces útiles",
    "useful_links_placeholder": "Los enlaces aparecen aquí cuando busco algo",
    "history": "Historial"
  },
  "fr": {
    "assistant_name": "Assistant CMDIY",
    "beta": "Bêta",
    "scroll_to_bottom": "Défiler vers le bas",
    "sr_generating": "Génération d'une réponse",
    "useful_links_region": "Liens utiles",
    "useful_links_placeholder": "Les liens apparaissent ici quand je fais une recherche",
    "history": "Historique"
  },
  "de": {
    "assistant_name": "CMDIY Assistent",
    "beta": "Beta",
    "scroll_to_bottom": "Nach unten scrollen",
    "sr_generating": "Antwort wird erzeugt",
    "useful_links_region": "Nützliche Links",
    "useful_links_placeholder": "Links erscheinen hier, wenn ich etwas suche",
    "history": "Verlauf"
  },
  "it": {
    "assistant_name": "Assistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Scorri in basso",
    "sr_generating": "Generazione di una risposta",
    "useful_links_region": "Link utili",
    "useful_links_placeholder": "I link appaiono qui quando cerco qualcosa",
    "history": "Cronologia"
  },
  "pt": {
    "assistant_name": "Assistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Rolar para baixo",
    "sr_generating": "Gerando uma resposta",
    "useful_links_region": "Links úteis",
    "useful_links_placeholder": "Os links aparecem aqui quando eu pesquiso algo",
    "history": "Histórico"
  },
  "ru": {
    "assistant_name": "Помощник CMDIY",
    "beta": "Бета",
    "scroll_to_bottom": "Прокрутить вниз",
    "sr_generating": "Формируется ответ",
    "useful_links_region": "Полезные ссылки",
    "useful_links_placeholder": "Ссылки появятся здесь, когда я что-то найду",
    "history": "История"
  },
  "ja": {
    "assistant_name": "CMDIYアシスタント",
    "beta": "ベータ",
    "scroll_to_bottom": "下までスクロール",
    "sr_generating": "回答を生成しています",
    "useful_links_region": "有用なリンク",
    "useful_links_placeholder": "検索するとここにリンクが表示されます",
    "history": "履歴"
  },
  "zh": {
    "assistant_name": "CMDIY助手",
    "beta": "测试版",
    "scroll_to_bottom": "滚动到底部",
    "sr_generating": "正在生成回复",
    "useful_links_region": "有用链接",
    "useful_links_placeholder": "当我搜索时，链接会显示在这里",
    "history": "历史记录"
  },
  "ko": {
    "assistant_name": "CMDIY 어시스턴트",
    "beta": "베타",
    "scroll_to_bottom": "맨 아래로 스크롤",
    "sr_generating": "응답을 생성하는 중",
    "useful_links_region": "유용한 링크",
    "useful_links_placeholder": "검색하면 여기에 링크가 표시됩니다",
    "history": "기록"
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
