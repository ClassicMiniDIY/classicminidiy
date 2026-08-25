import type { Message, UseStreamContextProvider } from '../../data/models/chat';
import { usePersistentThread } from './usePersistentThread';

// Injection key for stream context
const StreamContextKey: InjectionKey<UseStreamContextProvider> = Symbol('StreamContext');

// Vue composition function to replace React's context
export function useStreamProvider() {
  const runtimeConfig = useRuntimeConfig();
  // Configuration state
  const assistantId = ref(runtimeConfig.NUXT_PUBLIC_LANGGRAPH_ASSISTANT_ID || 'agent');
  const isConfigured = computed(() => !!assistantId.value);

  // Use persistent thread management
  const persistentThread = usePersistentThread();

  // Thread ID comes from persistent storage
  const threadId = computed(() => persistentThread.currentThreadId.value);

  const setThreadId = (id: string | null) => {
    if (id) {
      // Persist the new thread ID
      persistentThread.persistThread(id);
    } else {
      // Clear the persisted thread
      persistentThread.clearPersistedThread();
    }
  };

  const createNewThread = () => {
    persistentThread.createNewThread();
  };

  const updateThreadUsage = (messageCount?: number) => {
    persistentThread.updateThreadUsage(messageCount);
  };

  return {
    assistantId: readonly(assistantId),
    threadId: readonly(threadId),
    isConfigured,
    isThreadLoaded: persistentThread.isThreadLoaded,
    isThreadExpired: persistentThread.isThreadExpired,
    setThreadId,
    createNewThread,
    updateThreadUsage,
    getThreadData: persistentThread.getThreadData,
  };
}

// Stream session management
export function createStreamSession(
  assistantId: string,
  threadId: string | null = null,
  onThreadCreated?: (threadId: string) => void
) {
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const currentThreadId = ref<string | null>(threadId);
  const error = ref<string | null>(null);

  // Aborts the in-flight run. Without this, `stop()` only flipped `isLoading`
  // to false while the stream kept arriving and kept mutating `messages`, so
  // the reply carried on growing after the user pressed stop.
  let abortController: AbortController | null = null;

  // Get locale at the top level of the composable
  const { locale } = useI18n();

  // Track message count for thread persistence
  const messageCount = computed(() => messages.value.length);

  // Transform API URL for our Nuxt proxy
  const proxyApiUrl = '/api/langgraph';

  // Load historical messages if thread exists
  const loadThreadHistory = async () => {
    if (!currentThreadId.value) return;

    try {
      const endpoint = `${proxyApiUrl}/threads/${currentThreadId.value}/state`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const threadState = await response.json();
        if (threadState && threadState.values && threadState.values.messages) {
          const threadMessages = threadState.values.messages;
          if (Array.isArray(threadMessages) && threadMessages.length > 0) {
            messages.value = threadMessages;
          }
        }
      } else {
        console.warn('Failed to load thread history:', response.status, response.statusText);
      }
    } catch (error) {
      console.warn('Error loading thread history:', error);
    }
  };

  // Load history when session is created with existing thread
  if (currentThreadId.value) {
    loadThreadHistory();
  }

  const submit = async (input: any, options: any = {}) => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    isLoading.value = true;
    error.value = null;

    // Add user message to the UI immediately
    if (input.messages && Array.isArray(input.messages)) {
      for (const msg of input.messages) {
        if (msg.type === 'human' && msg.content) {
          messages.value.push({
            id: `human-${Date.now()}-${Math.random()}`,
            type: 'human',
            content: msg.content,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    try {
      const threadIdForUrl = currentThreadId.value || 'new';
      const endpoint = `${proxyApiUrl}/threads/${threadIdForUrl}/runs/stream`;
      const payload: any = {
        assistant_id: assistantId,
        input: input,
        stream_mode: options.streamMode || ['messages', 'updates'],
      };

      // Add language metadata with explicit instructions
      const languageInstructions = {
        en: 'Please respond in English',
        de: 'Bitte antworten Sie auf Deutsch',
        es: 'Por favor responde en español',
        fr: 'Veuillez répondre en français',
        it: 'Si prega di rispondere in italiano',
        pt: 'Por favor responda em português',
        ru: 'Пожалуйста, отвечайте на русском языке',
        ja: '日本語で回答してください',
        zh: '请用中文回答',
        ko: '한국어로 답변해 주세요',
      };

      const metadata = {
        language: locale.value,
        user_locale: locale.value,
        language_instruction: languageInstructions[locale.value] || languageInstructions.en,
        ...options.metadata,
      };
      payload.metadata = metadata;
      if (options.checkpoint) {
        payload.config = {
          configurable: {
            checkpoint_id: options.checkpoint.id,
          },
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        let dataBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataContent = line.slice(6);

              if (dataContent === '[DONE]') {
                break;
              }
              dataBuffer += dataContent;
              try {
                const data = JSON.parse(dataBuffer);
                handleStreamEvent(data, options);
                dataBuffer = ''; // Reset buffer after successful parse
              } catch (e) {
                if (dataBuffer.length > 50000) {
                  console.error(
                    'Failed to parse stream data after accumulating:',
                    e,
                    'Content length:',
                    dataBuffer.length
                  );
                  dataBuffer = ''; // Reset to prevent memory issues
                }
              }
            } else if (line.trim() === '') {
              if (dataBuffer) {
                try {
                  const data = JSON.parse(dataBuffer);
                  handleStreamEvent(data, options);
                  dataBuffer = ''; // Reset buffer after successful parse
                } catch (e) {
                  // Still incomplete, continue accumulating
                  console.error('Failed to parse stream data:', e);
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      // The user pressing stop is not a failure — say nothing.
      if (err?.name === 'AbortError' || signal.aborted) {
        return;
      }

      console.error('Stream submission failed:', err);
      error.value = err.message || 'Failed to send message. Please try again.';

      // Add an error message to the chat
      messages.value.push({
        id: `error-${Date.now()}`,
        type: 'ai',
        content: `I encountered an error: ${error.value}. Please try again or refresh the page.`,
        created_at: new Date().toISOString(),
      });
    } finally {
      isLoading.value = false;
    }
  };

  function handleStreamEvent(event: any, options: any) {
    if (event.event === 'thread_id') {
      const newThreadId = event.data?.thread_id;
      if (newThreadId) {
        const wasNewThread = !currentThreadId.value;
        currentThreadId.value = newThreadId;

        // Call the callback if a new thread was created
        if (wasNewThread && onThreadCreated) {
          onThreadCreated(newThreadId);
        }
      }
    } else if (event.event === 'messages/partial' || event.event === 'messages/stream') {
      // Handle array of messages (LangGraph returns messages as an array)
      const messageUpdates = Array.isArray(event.data) ? event.data : [event.data];

      for (const messageUpdate of messageUpdates) {
        // Only process messages with valid content
        if (!hasValidContent(messageUpdate)) {
          continue;
        }

        // Check if this message already exists by ID
        const existingIndex = messages.value.findIndex((m: any) => m.id === messageUpdate.id);

        if (existingIndex >= 0) {
          // Update existing message in place - replace content completely for streaming updates
          messages.value[existingIndex] = { ...messages.value[existingIndex], ...messageUpdate };
        } else {
          // For new AI messages during streaming, check if we should merge with the last AI message
          const lastMessage = messages.value[messages.value.length - 1];
          const isNewMessageAI = messageUpdate.type === 'ai' || messageUpdate.type === 'assistant';
          const isLastMessageAI = lastMessage && (lastMessage.type === 'ai' || lastMessage.type === 'assistant');

          // Only merge if both are AI messages AND the last message doesn't have a proper ID yet
          // (indicating it's still being streamed)
          if (isNewMessageAI && isLastMessageAI && lastMessage.id.startsWith('ai-')) {
            // Replace the temporary message with the real one from the server
            messages.value[messages.value.length - 1] = messageUpdate;
          } else if (isNewMessageAI && isLastMessageAI && !messageUpdate.id.includes('run')) {
            // If both are AI messages but this looks like a continuation, update the last one
            const currentContent = getContentString(messageUpdate.content);
            lastMessage.content = currentContent;
            lastMessage.id = messageUpdate.id;
            if (messageUpdate.created_at) {
              lastMessage.created_at = messageUpdate.created_at;
            }
            if (messageUpdate.tool_calls) {
              lastMessage.tool_calls = messageUpdate.tool_calls;
            }
          } else {
            // Add as new message
            messages.value.push(messageUpdate);
          }
        }
      }
    } else if (event.event === 'messages/complete') {
      // Handle array of messages (LangGraph may return messages as an array)
      const completedMessages = Array.isArray(event.data) ? event.data : [event.data];

      for (const completedMessage of completedMessages) {
        // Only process messages with valid content
        if (!hasValidContent(completedMessage)) {
          // Remove any existing empty message with this ID
          const existingIndex = messages.value.findIndex((m: any) => m.id === completedMessage.id);
          if (existingIndex >= 0) {
            messages.value.splice(existingIndex, 1);
          }
          continue;
        }

        const existingIndex = messages.value.findIndex((m: any) => m.id === completedMessage.id);

        if (existingIndex >= 0) {
          // Update existing message
          messages.value[existingIndex] = completedMessage;
        } else {
          // Check if we should group this with the last message
          const lastMessage = messages.value[messages.value.length - 1];
          if (shouldGroupWithLastMessage(completedMessage, lastMessage)) {
            // Merge with the last message instead of creating a new one
            const currentContent = getContentString(completedMessage.content);
            const lastContent = getContentString(lastMessage.content);

            if (currentContent.trim()) {
              lastMessage.content = lastContent + (lastContent ? '\n\n' : '') + currentContent;

              // Merge tool calls if any
              if (completedMessage.tool_calls && completedMessage.tool_calls.length > 0) {
                lastMessage.tool_calls = [...(lastMessage.tool_calls || []), ...completedMessage.tool_calls];
              }

              // Update timestamp and ID to the latest
              if (completedMessage.created_at) {
                lastMessage.created_at = completedMessage.created_at;
              }
              lastMessage.id = completedMessage.id; // Use the latest message ID
            }
          } else {
            // Add as new message
            messages.value.push(completedMessage);
          }
        }
      }
    } else if (event.event === 'updates') {
      // Handle 'updates' event which contains node execution updates
      if (event.data && event.data.messages) {
        // Process new messages from the event
        const newMessages = event.data.messages.filter(hasValidContent);

        // Merge with existing messages instead of replacing
        for (const newMsg of newMessages) {
          const existingIndex = messages.value.findIndex((m: any) => m.id === newMsg.id);
          if (existingIndex >= 0) {
            // Update existing message
            messages.value[existingIndex] = { ...messages.value[existingIndex], ...newMsg };
          } else {
            // Add new message if it doesn't exist
            messages.value.push(newMsg);
          }
        }
      }
    } else if (event.event === 'values') {
      // Handle 'values' event type which might contain messages (fallback)
      if (event.data && event.data.messages) {
        // Process new messages from the event
        const newMessages = event.data.messages.filter(hasValidContent);

        // Merge with existing messages instead of replacing
        for (const newMsg of newMessages) {
          const existingIndex = messages.value.findIndex((m: any) => m.id === newMsg.id);
          if (existingIndex >= 0) {
            // Update existing message
            messages.value[existingIndex] = { ...messages.value[existingIndex], ...newMsg };
          } else {
            // Add new message if it doesn't exist
            messages.value.push(newMsg);
          }
        }
      }
    } else if (Array.isArray(event) && event.length === 2) {
      // Handle multi-mode streaming tuples: [streamMode, chunk]
      const [streamMode, chunk] = event;
      if (streamMode === 'messages' && typeof chunk === 'string') {
        // Handle token-level streaming - append to last AI message
        const lastMessage = messages.value[messages.value.length - 1];
        if (lastMessage && (lastMessage.type === 'ai' || lastMessage.type === 'assistant')) {
          const currentContent = getContentString(lastMessage.content);
          lastMessage.content = currentContent + chunk;
        } else {
          // Create a new AI message if there isn't one
          messages.value.push({
            id: `ai-${Date.now()}`,
            type: 'ai',
            content: chunk,
            created_at: new Date().toISOString(),
          });
        }
      } else if (streamMode === 'updates' || streamMode === 'values') {
        // Recursively handle the chunk as a normal event
        handleStreamEvent({ event: streamMode, data: chunk }, options);
      }
    } else {
      // Log unhandled events for debugging (only in development)
      if (import.meta.dev) {
        console.debug('Unhandled stream event:', event.event, event);
      }
    }
  }

  // Helper function to check if a message has valid content
  function hasValidContent(message: any): boolean {
    if (!message) return false;

    // Always include human messages
    if (message.type === 'human') return true;

    // For AI messages, check if they have meaningful content
    if (message.type === 'ai' || message.type === 'assistant') {
      const content = getContentString(message.content);
      const hasText = Boolean(content && content.trim().length > 0);
      const hasToolCalls = Boolean(message.tool_calls && message.tool_calls.length > 0);
      return hasText || hasToolCalls;
    }

    // For tool messages, check if they have content
    if (message.type === 'tool') {
      const content = getContentString(message.content);
      return Boolean(content && content.trim().length > 0);
    }

    return false;
  }

  // Helper function to extract content string from various formats
  function getContentString(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && item.text) return item.text;
          if (item && typeof item === 'object' && item.content) return item.content;
          return '';
        })
        .join(' ');
    }
    if (typeof content === 'object' && content.text) return content.text;
    if (typeof content === 'object' && content.content) return content.content;
    return String(content);
  }

  // Helper function to check if a message should be grouped with the last message
  function shouldGroupWithLastMessage(newMessage: any, lastMessage: any): boolean {
    if (!lastMessage || !newMessage) return false;

    // Only group AI messages with AI messages
    const isNewMessageAI = newMessage.type === 'ai' || newMessage.type === 'assistant';
    const isLastMessageAI = lastMessage.type === 'ai' || lastMessage.type === 'assistant';

    return isNewMessageAI && isLastMessageAI;
  }

  // Helper function to group consecutive AI messages
  function groupConsecutiveMessages(messages: any[]): any[] {
    if (!messages || messages.length === 0) return [];

    const grouped: any[] = [];
    let currentGroup: any[] = [];
    let lastType = '';

    for (const message of messages) {
      const messageType = message.type;

      // If this is the same type as the last message and it's an AI message, group them
      if (
        messageType === lastType &&
        (messageType === 'ai' || messageType === 'assistant') &&
        currentGroup.length > 0
      ) {
        // Merge content of consecutive AI messages
        const lastMessage = currentGroup[currentGroup.length - 1];
        const currentContent = getContentString(message.content);
        const lastContent = getContentString(lastMessage.content);

        if (currentContent.trim()) {
          // Append content to the last message in the group
          lastMessage.content = lastContent + (lastContent ? '\n\n' : '') + currentContent;

          // Merge tool calls if any
          if (message.tool_calls && message.tool_calls.length > 0) {
            lastMessage.tool_calls = [...(lastMessage.tool_calls || []), ...message.tool_calls];
          }

          // Update timestamp to the latest
          if (message.created_at) {
            lastMessage.created_at = message.created_at;
          }
        }
      } else {
        // Different type or first message, start a new group
        if (currentGroup.length > 0) {
          grouped.push(...currentGroup);
        }
        currentGroup = [{ ...message }];
        lastType = messageType;
      }
    }

    // Add the last group
    if (currentGroup.length > 0) {
      grouped.push(...currentGroup);
    }

    return grouped;
  }

  const getMessagesMetadata = (message: Message) => {
    // Placeholder implementation for message metadata
    return {
      firstSeenState: {
        parent_checkpoint: null,
        values: { messages: messages.value },
      },
    };
  };

  const stop = () => {
    abortController?.abort();
    abortController = null;
    isLoading.value = false;
  };

  /**
   * Start a fresh conversation in the existing session.
   *
   * This is deliberately a method on the session rather than a rebuild of it:
   * `provideStreamContext()` may only run during setup (see the chat hydration
   * invariant in CLAUDE.md), so the provided object has to stay the same one
   * for the life of the component.
   */
  const reset = () => {
    stop();
    messages.value = [];
    currentThreadId.value = null;
    error.value = null;
  };

  return {
    messages,
    isLoading,
    error,
    submit,
    stop,
    reset,
    threadId: currentThreadId,
    getMessagesMetadata,
  };
}

// Provide the stream context
export function provideStreamContext(context: UseStreamContextProvider) {
  provide(StreamContextKey, context);
}

// Use the stream context
export function useStreamContext(): UseStreamContextProvider {
  const context = inject(StreamContextKey);
  if (!context) {
    throw new Error('useStreamContext must be used within a StreamProvider');
  }
  return context;
}
