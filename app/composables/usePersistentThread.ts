import { ref, computed, watch } from 'vue';

// Storage key for thread persistence
const THREAD_STORAGE_KEY = 'cmdiy_chat_thread';
const THREAD_EXPIRY_KEY = 'cmdiy_chat_thread_expiry';

// Thread expiry time (24 hours in milliseconds)
const THREAD_EXPIRY_TIME = 24 * 60 * 60 * 1000;

export interface PersistentThreadData {
  threadId: string;
  createdAt: number;
  lastUsedAt: number;
  messageCount: number;
}

/**
 * Composable for managing persistent chat threads
 * Handles thread storage, expiry, and automatic cleanup
 */
export function usePersistentThread() {
  const currentThreadId = ref<string | null>(null);
  const isThreadLoaded = ref(false);

  // Check if we're in a browser environment (use process.client for Nuxt SSR)
  const isBrowser = process.client;

  /**
   * Load thread from localStorage if it exists and is still valid
   */
  const loadPersistedThread = (): string | null => {
    if (!isBrowser) return null;

    try {
      const storedThread = localStorage.getItem(THREAD_STORAGE_KEY);
      const storedExpiry = localStorage.getItem(THREAD_EXPIRY_KEY);

      if (!storedThread || !storedExpiry) {
        return null;
      }

      const threadData: PersistentThreadData = JSON.parse(storedThread);
      const expiryTime = parseInt(storedExpiry);

      // Check if thread has expired
      if (Date.now() > expiryTime) {
        clearPersistedThread();
        return null;
      }

      // Update last used time
      threadData.lastUsedAt = Date.now();
      localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threadData));

      return threadData.threadId;
    } catch (error) {
      console.warn('Failed to load persisted thread:', error);
      clearPersistedThread();
      return null;
    }
  };

  /**
   * Save thread to localStorage with expiry
   */
  const persistThread = (threadId: string, messageCount: number = 0) => {
    if (!isBrowser || !threadId) return;

    try {
      const now = Date.now();
      const threadData: PersistentThreadData = {
        threadId,
        createdAt: now,
        lastUsedAt: now,
        messageCount,
      };

      const expiryTime = now + THREAD_EXPIRY_TIME;

      localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threadData));
      localStorage.setItem(THREAD_EXPIRY_KEY, expiryTime.toString());

      currentThreadId.value = threadId;
    } catch (error) {
      console.warn('Failed to persist thread:', error);
    }
  };

  /**
   * Update thread usage (increment message count, update last used time)
   */
  const updateThreadUsage = (messageCount?: number) => {
    if (!isBrowser || !currentThreadId.value) return;

    try {
      const storedThread = localStorage.getItem(THREAD_STORAGE_KEY);
      if (!storedThread) return;

      const threadData: PersistentThreadData = JSON.parse(storedThread);
      threadData.lastUsedAt = Date.now();

      if (typeof messageCount === 'number') {
        threadData.messageCount = messageCount;
      } else {
        threadData.messageCount += 1;
      }

      localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threadData));

      // Extend expiry time on usage
      const newExpiryTime = Date.now() + THREAD_EXPIRY_TIME;
      localStorage.setItem(THREAD_EXPIRY_KEY, newExpiryTime.toString());
    } catch (error) {
      console.warn('Failed to update thread usage:', error);
    }
  };

  /**
   * Clear persisted thread data
   */
  const clearPersistedThread = () => {
    if (!isBrowser) return;

    try {
      localStorage.removeItem(THREAD_STORAGE_KEY);
      localStorage.removeItem(THREAD_EXPIRY_KEY);
      currentThreadId.value = null;
    } catch (error) {
      console.warn('Failed to clear persisted thread:', error);
    }
  };

  /**
   * Get thread data from storage
   */
  const getThreadData = (): PersistentThreadData | null => {
    if (!isBrowser) return null;

    try {
      const storedThread = localStorage.getItem(THREAD_STORAGE_KEY);
      if (!storedThread) return null;

      return JSON.parse(storedThread);
    } catch (error) {
      console.warn('Failed to get thread data:', error);
      return null;
    }
  };

  /**
   * Initialize thread on composable creation
   */
  const initializeThread = () => {
    if (!isBrowser) {
      isThreadLoaded.value = true;
      return;
    }

    const persistedThreadId = loadPersistedThread();
    if (persistedThreadId) {
      currentThreadId.value = persistedThreadId;
    }
    isThreadLoaded.value = true;
  };

  /**
   * Create a new thread (clears existing one)
   */
  const createNewThread = () => {
    clearPersistedThread();
    // Don't set a new thread ID here - let the chat system create it
    // and then we'll persist it when it's created
  };

  /**
   * Check if current thread is expired
   */
  const isThreadExpired = computed(() => {
    if (!isBrowser || !currentThreadId.value) return false;

    try {
      const storedExpiry = localStorage.getItem(THREAD_EXPIRY_KEY);
      if (!storedExpiry) return true;

      return Date.now() > parseInt(storedExpiry);
    } catch (error) {
      return true;
    }
  });

  /**
   * Get time until thread expires (in milliseconds)
   */
  const timeUntilExpiry = computed(() => {
    if (!isBrowser || !currentThreadId.value) return 0;

    try {
      const storedExpiry = localStorage.getItem(THREAD_EXPIRY_KEY);
      if (!storedExpiry) return 0;

      const expiryTime = parseInt(storedExpiry);
      const remaining = expiryTime - Date.now();
      return Math.max(0, remaining);
    } catch (error) {
      return 0;
    }
  });

  // Initialize on creation. NOTE: this reads localStorage synchronously during
  // setup, so client state can differ from the SSR HTML — anything that renders
  // from currentThreadId/getThreadData must not branch on it until after mount
  // (see isChatEmpty in ChatWindow.vue) or hydration mismatches corrupt the DOM.
  initializeThread();

  // Watch for thread expiry and clean up automatically
  if (isBrowser) {
    watch(isThreadExpired, (expired) => {
      if (expired && currentThreadId.value) {
        clearPersistedThread();
      }
    });
  }

  return {
    // State
    currentThreadId: readonly(currentThreadId),
    isThreadLoaded: readonly(isThreadLoaded),
    isThreadExpired,
    timeUntilExpiry,

    // Methods
    persistThread,
    updateThreadUsage,
    clearPersistedThread,
    createNewThread,
    getThreadData,

    // Internal method for manual initialization if needed
    initializeThread,
  };
}
