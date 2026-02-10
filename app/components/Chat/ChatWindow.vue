<template>
  <!-- Chat Interface -->
  <div class="flex flex-col h-full bg-default">
    <!-- Experimental Disclaimer (always visible) -->

    <!-- Welcome Banner (shown when chat is empty) -->
    <div v-if="isChatEmpty && !isLoading" class="flex-1 flex items-center justify-center px-4">
      <div class="max-w-2xl mx-auto text-center space-y-6">
        <!-- Welcome Message -->
        <UCard class="bg-primary/10 border border-primary/20">
          <div class="flex flex-col items-center gap-4">
            <i class="fa-solid fa-comments text-primary text-4xl"></i>
            <div>
              <h3 class="font-semibold text-xl mb-3 text-primary">
                {{ t('welcome_title') }}
              </h3>
              <p class="text-base text-muted leading-relaxed">
                I'm your Classic Mini DIY assistant, here to help you with technical questions, decode chassis numbers,
                find parts information, navigate the archives, and provide guidance on Classic Mini restoration and
                maintenance. Ask me anything about your Classic Mini project!
              </p>
            </div>
          </div>
        </UCard>

        <!-- Centered Input Area (when chat is empty) -->
        <div class="w-full max-w-2xl">
          <form @submit.prevent="handleSubmit" class="relative">
            <div class="flex items-end gap-3 bg-muted rounded-2xl p-3 shadow-sm border border-default">
              <textarea
                ref="inputRef"
                v-model="input"
                @keydown="handleInputKeyDown"
                :placeholder="t('input_placeholder')"
                class="flex-1 bg-transparent resize-none outline-none min-h-6 max-h-32 placeholder:text-muted py-2 leading-6"
                rows="1"
              ></textarea>

              <UButton v-if="isLoading" @click="stopGeneration" type="button" size="sm" color="error" square>
                <i class="fa-solid fa-stop"></i>
              </UButton>

              <UButton v-else type="submit" size="sm" color="primary" square :disabled="!input.trim()">
                <i class="fa-solid fa-paper-plane"></i>
              </UButton>
            </div>
          </form>

          <!-- Report Issue Link Below Centered Input -->
          <div class="flex justify-center mt-3">
            <NuxtLink to="/contact">{{ t('report_issue') }}</NuxtLink>
            <i class="fa-solid fa-envelope text-xs ml-1"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Content (shown when messages exist) -->
    <div v-else class="flex flex-1 overflow-hidden relative">
      <!-- Main Chat Area -->
      <div class="flex flex-1 flex-col">
        <!-- Messages Area -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-6" @scroll="handleScroll">
          <div class="space-y-4 break-words max-w-none">
            <!-- Messages -->
            <template v-for="message in messages" :key="message.id">
              <div class="break-words overflow-wrap-anywhere">
                <HumanMessage v-if="message.type === 'human'" :message="message" :is-loading="isLoading" />
                <AssistantMessage v-else-if="message.type === 'ai'" :message="message" :is-loading="isLoading" />
              </div>
            </template>

            <div v-if="isLoading" class="flex h-8 items-center gap-1 rounded-2xl bg-muted px-4 py-2">
              <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-muted"></div>
              <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-muted animation-delay-500"></div>
              <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-muted animation-delay-1000"></div>
            </div>
            <!-- Useful Links from Tavily Search Results (Mobile Only) -->
            <UsefulLinks v-if="!isLoading && usefulLinks.length > 0" :links="usefulLinks" class="md:hidden" />
          </div>
        </div>

        <!-- Floating Scroll to Bottom Button -->
        <UButton
          v-if="showScrollButton"
          @click="scrollToBottom"
          class="absolute bottom-24 right-6 lg:right-80 shadow-lg hover:shadow-xl transition-all duration-200 z-10"
          size="sm"
          variant="outline"
          color="neutral"
          square
          title="Scroll to bottom"
        >
          <i class="fa-solid fa-chevron-down text-sm"></i>
        </UButton>
      </div>

      <!-- Right Sidebar for Useful Links (Desktop/Tablet Only) -->
      <div class="hidden md:flex md:flex-col md:w-80 md:border-l md:border-default md:bg-muted/50">
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Useful Links Sidebar -->
          <div v-if="!isLoading && usefulLinks.length > 0" class="sticky top-0">
            <UsefulLinksSidebar :links="usefulLinks" />
          </div>
          <!-- Placeholder when no links -->
          <div v-else class="text-center text-muted mt-8">
            <i class="fa-solid fa-link text-2xl mb-2 block"></i>
            <p class="text-sm">{{ t('useful_links_placeholder') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Input Area (when messages exist) -->
    <div v-if="!isChatEmpty || isLoading" class="p-4 bg-default">
      <form @submit.prevent="handleSubmit" class="relative">
        <div class="flex items-end gap-3 bg-muted rounded-2xl p-3 shadow-sm border border-default">
          <textarea
            ref="inputRef"
            v-model="input"
            @keydown="handleInputKeyDown"
            :placeholder="t('input_placeholder')"
            class="flex-1 bg-transparent resize-none outline-none min-h-6 max-h-32 placeholder:text-muted py-2 leading-6"
            rows="1"
          ></textarea>

          <UButton v-if="isLoading" @click="stopGeneration" type="button" size="sm" color="error" square>
            <i class="fa-solid fa-stop"></i>
          </UButton>

          <UButton v-else type="submit" size="sm" color="primary" square :disabled="!input.trim()">
            <i class="fa-solid fa-paper-plane"></i>
          </UButton>
        </div>
      </form>
      <UAlert color="warning" class="mt-3" icon="i-fa6-solid-triangle-exclamation">
        <template #title>{{ t('experimental_feature') }}</template>
        <template #description>
          {{ t('experimental_disclaimer') }} Always verify critical information with official documentation, qualified
          mechanics, or experienced Classic Mini enthusiasts.
        </template>
      </UAlert>

      <!-- Report Issue Link Below Chat -->
      <div class="flex justify-center mt-3">
        <NuxtLink to="/contact">{{ t('report_issue') }}</NuxtLink>
        <i class="fa-solid fa-envelope text-xs ml-1"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n();
  import { useStreamProvider } from '~/composables/useStreamProvider';
  import type { Message } from '../../../data/models/chat';
  import AssistantMessage from './AssistantMessage.vue';
  import HumanMessage from './HumanMessage.vue';
  import UsefulLinks from './UsefulLinks.vue';
  import UsefulLinksSidebar from './UsefulLinksSidebar.vue';

  const { assistantId, threadId, isConfigured, isThreadLoaded, setThreadId, updateThreadUsage, getThreadData } =
    useStreamProvider();

  // Reactive state
  const route = useRoute();
  const input = ref('');
  const inputRef = ref<HTMLTextAreaElement>();
  const messagesContainer = ref<HTMLDivElement>();
  const showScrollButton = ref(false);

  // Check if chat is empty (no messages and no persisted thread)
  const isChatEmpty = computed(() => {
    // If we have messages in the current context, chat is not empty
    if (streamContext?.messages.value && streamContext.messages.value.length > 0) {
      return false;
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

  // Determine if we should show the loading bubble
  const shouldShowLoadingBubble = computed(() => {
    if (!streamContext?.messages.value) return true; // Show if no messages yet

    const messages = streamContext.messages.value;
    if (messages.length === 0) return true; // Show if empty

    // Don't show loading bubble if the last message is already an AI message being streamed
    const lastMessage = messages[messages.length - 1];
    return lastMessage.type !== 'ai' && lastMessage.type !== 'assistant';
  });

  // Stream context
  let streamContext: ReturnType<typeof createStreamSession> | null = null;
  const streamContextInitialized = ref(false);

  // Methods

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

  const { capture } = usePostHog();

  async function handleSubmit() {
    if (!input.value.trim() || !streamContext || isLoading.value) return;

    const message = input.value.trim();

    capture('chat_message_sent', {
      message_length: message.length,
      is_first_message: isChatEmpty.value,
    });

    input.value = '';

    // Auto-resize textarea
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.style.height = 'auto';
      }
    });

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

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }

    // Auto-resize textarea
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.style.height = 'auto';
        inputRef.value.style.height = inputRef.value.scrollHeight + 'px';
      }
    });
  }

  function stopGeneration() {
    if (streamContext) {
      streamContext.stop();
    }
  }
  // Auto-resize textarea on input
  watch(input, () => {
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.style.height = 'auto';
        inputRef.value.style.height = inputRef.value.scrollHeight + 'px';
      }
    });
  });

  // Scroll to bottom function
  function scrollToBottom() {
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
          scrollToBottom();
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
            console.log('Auto-submitting message from query parameter:', input.value);
            handleSubmit();
          }
        });
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    nextTick(() => {
      // Just focus and scroll, auto-submission is handled by the watcher above
      if (inputRef.value) {
        inputRef.value.focus();
      }
      // Initial scroll to bottom
      scrollToBottom();
    });
  });
</script>

<i18n lang="json">
{
  "en": {
    "experimental_feature": "Experimental Feature:",
    "experimental_disclaimer": "This AI assistant is in beta and should not be used as your only source of technical information.",
    "welcome_title": "Welcome to Classic Mini DIY Assistant",
    "input_placeholder": "Ask me anything about your Classic Mini...",
    "report_issue": "Report an issue with the chat",
    "useful_links_placeholder": "Useful links will appear here after I search for information",
    "loading_chat": "Loading chat..."
  },
  "es": {
    "experimental_feature": "Función Experimental:",
    "experimental_disclaimer": "Este asistente de IA está en beta y no debe usarse como su única fuente de información técnica.",
    "welcome_title": "Bienvenido al Asistente de Classic Mini DIY",
    "input_placeholder": "Pregúntame cualquier cosa sobre tu Classic Mini...",
    "report_issue": "Reportar un problema con el chat",
    "useful_links_placeholder": "Los enlaces útiles aparecerán aquí después de que busque información",
    "loading_chat": "Cargando chat..."
  },
  "fr": {
    "experimental_feature": "Fonctionnalité Expérimentale:",
    "experimental_disclaimer": "Cet assistant IA est en version bêta et ne doit pas être utilisé comme votre seule source d'informations techniques.",
    "welcome_title": "Bienvenue dans l'Assistant Classic Mini DIY",
    "input_placeholder": "Demandez-moi n'importe quoi sur votre Classic Mini...",
    "report_issue": "Signaler un problème avec le chat",
    "useful_links_placeholder": "Les liens utiles apparaîtront ici après que j'aie recherché des informations",
    "loading_chat": "Chargement du chat..."
  },
  "de": {
    "experimental_feature": "Experimentelle Funktion:",
    "experimental_disclaimer": "Dieser KI-Assistent befindet sich in der Beta-Phase und sollte nicht als einzige Quelle für technische Informationen verwendet werden.",
    "welcome_title": "Willkommen beim Classic Mini DIY Assistenten",
    "input_placeholder": "Fragen Sie mich alles über Ihren Classic Mini...",
    "report_issue": "Ein Problem mit dem Chat melden",
    "useful_links_placeholder": "Nützliche Links erscheinen hier, nachdem ich nach Informationen gesucht habe",
    "loading_chat": "Chat wird geladen..."
  },
  "it": {
    "experimental_feature": "Funzione Sperimentale:",
    "experimental_disclaimer": "Questo assistente IA è in beta e non dovrebbe essere usato come unica fonte di informazioni tecniche.",
    "welcome_title": "Benvenuto nell'Assistente Classic Mini DIY",
    "input_placeholder": "Chiedimi qualsiasi cosa sul tuo Classic Mini...",
    "report_issue": "Segnala un problema con la chat",
    "useful_links_placeholder": "I link utili appariranno qui dopo che avrò cercato informazioni",
    "loading_chat": "Caricamento chat..."
  },
  "ja": {
    "experimental_feature": "実験的機能:",
    "experimental_disclaimer": "このAIアシスタントはベータ版であり、技術情報の唯一の情報源として使用すべきではありません。",
    "welcome_title": "Classic Mini DIY アシスタントへようこそ",
    "input_placeholder": "あなたのClassic Miniについて何でもお聞きください...",
    "report_issue": "チャットの問題を報告する",
    "useful_links_placeholder": "情報を検索した後、有用なリンクがここに表示されます",
    "loading_chat": "チャットを読み込んでいます..."
  },
  "ko": {
    "experimental_feature": "실험적 기능:",
    "experimental_disclaimer": "이 AI 어시스턴트는 베타 버전이며 기술 정보의 유일한 소스로 사용해서는 안 됩니다.",
    "welcome_title": "Classic Mini DIY 어시스턴트에 오신 것을 환영합니다",
    "input_placeholder": "당신의 Classic Mini에 대해 무엇이든 물어보세요...",
    "report_issue": "채팅 문제 신고",
    "useful_links_placeholder": "정보를 검색한 후 유용한 링크가 여기에 나타납니다",
    "loading_chat": "채팅 로딩 중..."
  },
  "pt": {
    "experimental_feature": "Recurso Experimental:",
    "experimental_disclaimer": "Este assistente de IA está em beta e não deve ser usado como sua única fonte de informações técnicas.",
    "welcome_title": "Bem-vindo ao Assistente Classic Mini DIY",
    "input_placeholder": "Pergunte-me qualquer coisa sobre seu Classic Mini...",
    "report_issue": "Relatar um problema com o chat",
    "useful_links_placeholder": "Links úteis aparecerão aqui depois que eu pesquisar informações",
    "loading_chat": "Carregando chat..."
  },
  "ru": {
    "experimental_feature": "Экспериментальная функция:",
    "experimental_disclaimer": "Этот ИИ-помощник находится в бета-версии и не должен использоваться как единственный источник технической информации.",
    "welcome_title": "Добро пожаловать в помощник Classic Mini DIY",
    "input_placeholder": "Спросите меня что-нибудь о вашем Classic Mini...",
    "report_issue": "Сообщить о проблеме с чатом",
    "useful_links_placeholder": "Полезные ссылки появятся здесь после того, как я найду информацию",
    "loading_chat": "Загрузка чата..."
  },
  "zh": {
    "experimental_feature": "实验性功能：",
    "experimental_disclaimer": "这个AI助手处于测试阶段，不应作为技术信息的唯一来源。",
    "welcome_title": "欢迎使用Classic Mini DIY助手",
    "input_placeholder": "询问我关于您的Classic Mini的任何问题...",
    "report_issue": "报告聊天问题",
    "useful_links_placeholder": "在我搜索信息后，有用的链接将出现在这里",
    "loading_chat": "加载聊天中..."
  }
}
</i18n>

<style scoped>
  /* Ensure text wrapping in chat messages */
  .break-words {
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
  }

  .overflow-wrap-anywhere {
    overflow-wrap: anywhere;
  }

  /* Ensure chat window content doesn't overflow */
  .chat-content {
    max-width: 100%;
    overflow-x: hidden;
  }

  /* Force text content to wrap within containers */
  .chat-content * {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
</style>
