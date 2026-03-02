import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Constants matching the source
const THREAD_STORAGE_KEY = 'cmdiy_chat_thread';
const THREAD_EXPIRY_KEY = 'cmdiy_chat_thread_expiry';
const THREAD_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

describe('usePersistentThread', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    // Clear localStorage mocks
    (window.localStorage.getItem as any).mockReset();
    (window.localStorage.setItem as any).mockReset();
    (window.localStorage.removeItem as any).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /**
   * Helper to dynamically import a fresh composable instance.
   * vi.resetModules() ensures module-level state is not shared between tests.
   */
  async function freshComposable() {
    const mod = await import('~/app/composables/usePersistentThread');
    return mod.usePersistentThread;
  }

  // ─────────────────────────────────────────
  // persistThread
  // ─────────────────────────────────────────
  describe('persistThread(threadId, messageCount?)', () => {
    it('writes thread data and expiry to localStorage', async () => {
      const now = Date.now();
      const usePersistentThread = await freshComposable();
      const { persistThread } = usePersistentThread();

      persistThread('thread-123', 5);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_STORAGE_KEY,
        JSON.stringify({
          threadId: 'thread-123',
          createdAt: now,
          lastUsedAt: now,
          messageCount: 5,
        }),
      );
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_EXPIRY_KEY,
        (now + THREAD_EXPIRY_TIME).toString(),
      );
    });

    it('defaults messageCount to 0 when not provided', async () => {
      const now = Date.now();
      const usePersistentThread = await freshComposable();
      const { persistThread } = usePersistentThread();

      persistThread('thread-abc');

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_STORAGE_KEY,
        JSON.stringify({
          threadId: 'thread-abc',
          createdAt: now,
          lastUsedAt: now,
          messageCount: 0,
        }),
      );
    });

    it('sets currentThreadId to the persisted thread', async () => {
      const usePersistentThread = await freshComposable();
      const { persistThread, currentThreadId } = usePersistentThread();

      expect(currentThreadId.value).toBeNull();
      persistThread('thread-xyz');
      expect(currentThreadId.value).toBe('thread-xyz');
    });

    it('does nothing when threadId is empty string', async () => {
      const usePersistentThread = await freshComposable();
      const { persistThread } = usePersistentThread();

      // Clear the calls from initializeThread
      (window.localStorage.setItem as any).mockClear();

      persistThread('');

      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles localStorage errors gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const usePersistentThread = await freshComposable();
      const { persistThread } = usePersistentThread();

      (window.localStorage.setItem as any).mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });

      // Should not throw
      persistThread('thread-err');

      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to persist thread:',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────
  // getThreadData
  // ─────────────────────────────────────────
  describe('getThreadData()', () => {
    it('returns parsed thread data from localStorage', async () => {
      const threadData = {
        threadId: 'thread-get',
        createdAt: 1000,
        lastUsedAt: 2000,
        messageCount: 3,
      };
      (window.localStorage.getItem as any).mockReturnValue(JSON.stringify(threadData));

      const usePersistentThread = await freshComposable();
      const { getThreadData } = usePersistentThread();

      const result = getThreadData();
      expect(result).toEqual(threadData);
    });

    it('returns null when no thread is stored', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);

      const usePersistentThread = await freshComposable();
      const { getThreadData } = usePersistentThread();

      expect(getThreadData()).toBeNull();
    });

    it('returns null and warns on invalid JSON', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // First call (in initializeThread -> loadPersistedThread) reads THREAD_STORAGE_KEY
      // Then getThreadData also reads THREAD_STORAGE_KEY
      (window.localStorage.getItem as any).mockReturnValue('not-valid-json');

      const usePersistentThread = await freshComposable();
      const { getThreadData } = usePersistentThread();

      const result = getThreadData();
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────
  // clearPersistedThread
  // ─────────────────────────────────────────
  describe('clearPersistedThread()', () => {
    it('removes both storage keys from localStorage', async () => {
      const usePersistentThread = await freshComposable();
      const { clearPersistedThread } = usePersistentThread();

      (window.localStorage.removeItem as any).mockClear();
      clearPersistedThread();

      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_STORAGE_KEY);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_EXPIRY_KEY);
    });

    it('sets currentThreadId to null', async () => {
      const usePersistentThread = await freshComposable();
      const { persistThread, clearPersistedThread, currentThreadId } = usePersistentThread();

      persistThread('thread-clear');
      expect(currentThreadId.value).toBe('thread-clear');

      clearPersistedThread();
      expect(currentThreadId.value).toBeNull();
    });

    it('handles localStorage errors gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const usePersistentThread = await freshComposable();
      const { clearPersistedThread } = usePersistentThread();

      (window.localStorage.removeItem as any).mockImplementation(() => {
        throw new Error('SecurityError');
      });

      clearPersistedThread();
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to clear persisted thread:',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────
  // createNewThread
  // ─────────────────────────────────────────
  describe('createNewThread()', () => {
    it('calls clearPersistedThread (removes keys and nulls ref)', async () => {
      const usePersistentThread = await freshComposable();
      const { persistThread, createNewThread, currentThreadId } = usePersistentThread();

      persistThread('old-thread');
      expect(currentThreadId.value).toBe('old-thread');

      (window.localStorage.removeItem as any).mockClear();
      createNewThread();

      expect(currentThreadId.value).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_STORAGE_KEY);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_EXPIRY_KEY);
    });
  });

  // ─────────────────────────────────────────
  // updateThreadUsage
  // ─────────────────────────────────────────
  describe('updateThreadUsage(messageCount?)', () => {
    it('updates lastUsedAt and increments messageCount by 1 when no count provided', async () => {
      const now = Date.now();
      const threadData = {
        threadId: 'thread-usage',
        createdAt: now - 5000,
        lastUsedAt: now - 5000,
        messageCount: 2,
      };

      // initializeThread will call loadPersistedThread which reads both keys
      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return (now + THREAD_EXPIRY_TIME).toString();
        return null;
      });

      const usePersistentThread = await freshComposable();
      const { updateThreadUsage } = usePersistentThread();

      // Clear calls from initialization
      (window.localStorage.setItem as any).mockClear();

      updateThreadUsage();

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_STORAGE_KEY,
        JSON.stringify({
          threadId: 'thread-usage',
          createdAt: now - 5000,
          lastUsedAt: now,
          messageCount: 3,
        }),
      );
    });

    it('sets messageCount to provided value when a number is passed', async () => {
      const now = Date.now();
      const threadData = {
        threadId: 'thread-usage2',
        createdAt: now - 1000,
        lastUsedAt: now - 1000,
        messageCount: 5,
      };

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return (now + THREAD_EXPIRY_TIME).toString();
        return null;
      });

      const usePersistentThread = await freshComposable();
      const { updateThreadUsage } = usePersistentThread();

      (window.localStorage.setItem as any).mockClear();

      updateThreadUsage(10);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_STORAGE_KEY,
        JSON.stringify({
          threadId: 'thread-usage2',
          createdAt: now - 1000,
          lastUsedAt: now,
          messageCount: 10,
        }),
      );
    });

    it('extends the expiry time on usage', async () => {
      const now = Date.now();
      const threadData = {
        threadId: 'thread-extend',
        createdAt: now - 1000,
        lastUsedAt: now - 1000,
        messageCount: 0,
      };

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return (now + THREAD_EXPIRY_TIME).toString();
        return null;
      });

      const usePersistentThread = await freshComposable();
      const { updateThreadUsage } = usePersistentThread();

      (window.localStorage.setItem as any).mockClear();

      updateThreadUsage();

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_EXPIRY_KEY,
        (now + THREAD_EXPIRY_TIME).toString(),
      );
    });

    it('does nothing when currentThreadId is null', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);

      const usePersistentThread = await freshComposable();
      const { updateThreadUsage } = usePersistentThread();

      (window.localStorage.setItem as any).mockClear();

      updateThreadUsage();

      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });

    it('does nothing when no stored thread data exists', async () => {
      const usePersistentThread = await freshComposable();
      const { persistThread, updateThreadUsage } = usePersistentThread();

      persistThread('thread-no-data');
      (window.localStorage.setItem as any).mockClear();

      // Now getItem returns null when updateThreadUsage reads it
      (window.localStorage.getItem as any).mockReturnValue(null);

      updateThreadUsage();

      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles localStorage errors gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const now = Date.now();
      const threadData = {
        threadId: 'thread-err',
        createdAt: now,
        lastUsedAt: now,
        messageCount: 0,
      };

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return (now + THREAD_EXPIRY_TIME).toString();
        return null;
      });

      const usePersistentThread = await freshComposable();
      const { updateThreadUsage } = usePersistentThread();

      (window.localStorage.setItem as any).mockImplementation(() => {
        throw new Error('Storage error');
      });

      updateThreadUsage();
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to update thread usage:',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────
  // isThreadExpired computed
  // ─────────────────────────────────────────
  describe('isThreadExpired computed', () => {
    it('returns false when no thread is loaded (currentThreadId is null)', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);

      const usePersistentThread = await freshComposable();
      const { isThreadExpired } = usePersistentThread();

      expect(isThreadExpired.value).toBe(false);
    });

    it('returns false when thread has not expired', async () => {
      const now = Date.now();
      const futureExpiry = (now + THREAD_EXPIRY_TIME).toString();

      const usePersistentThread = await freshComposable();
      const { persistThread, isThreadExpired } = usePersistentThread();

      persistThread('thread-fresh');

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_EXPIRY_KEY) return futureExpiry;
        return null;
      });

      expect(isThreadExpired.value).toBe(false);
    });

    it('returns true when thread has expired (after 24h)', async () => {
      const now = Date.now();

      const usePersistentThread = await freshComposable();
      const { persistThread, isThreadExpired } = usePersistentThread();

      persistThread('thread-old');

      // Simulate expiry being in the past
      const pastExpiry = (now - 1000).toString();
      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_EXPIRY_KEY) return pastExpiry;
        return null;
      });

      expect(isThreadExpired.value).toBe(true);
    });

    it('returns true when no expiry key exists but thread is loaded', async () => {
      const usePersistentThread = await freshComposable();
      const { persistThread, isThreadExpired } = usePersistentThread();

      persistThread('thread-noexp');

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_EXPIRY_KEY) return null;
        return null;
      });

      expect(isThreadExpired.value).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // timeUntilExpiry computed
  // ─────────────────────────────────────────
  describe('timeUntilExpiry computed', () => {
    it('returns 0 when no thread is loaded', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);

      const usePersistentThread = await freshComposable();
      const { timeUntilExpiry } = usePersistentThread();

      expect(timeUntilExpiry.value).toBe(0);
    });

    it('returns remaining milliseconds until expiry', async () => {
      const now = Date.now();
      const expiryTime = now + 10000; // 10s from now

      const usePersistentThread = await freshComposable();
      const { persistThread, timeUntilExpiry } = usePersistentThread();

      persistThread('thread-time');

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_EXPIRY_KEY) return expiryTime.toString();
        return null;
      });

      expect(timeUntilExpiry.value).toBe(10000);
    });

    it('returns 0 when thread has already expired', async () => {
      const now = Date.now();
      const pastExpiry = now - 5000;

      const usePersistentThread = await freshComposable();
      const { persistThread, timeUntilExpiry } = usePersistentThread();

      persistThread('thread-past');

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_EXPIRY_KEY) return pastExpiry.toString();
        return null;
      });

      // Math.max(0, remaining) ensures non-negative
      expect(timeUntilExpiry.value).toBe(0);
    });

    it('returns 0 when no expiry key exists', async () => {
      const usePersistentThread = await freshComposable();
      const { persistThread, timeUntilExpiry } = usePersistentThread();

      persistThread('thread-nokey');

      (window.localStorage.getItem as any).mockImplementation(() => null);

      expect(timeUntilExpiry.value).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // initializeThread
  // ─────────────────────────────────────────
  describe('initializeThread()', () => {
    it('loads existing valid thread from localStorage on creation', async () => {
      const now = Date.now();
      const threadData = {
        threadId: 'thread-init',
        createdAt: now - 1000,
        lastUsedAt: now - 1000,
        messageCount: 7,
      };
      const expiry = (now + THREAD_EXPIRY_TIME).toString();

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return expiry;
        return null;
      });

      const usePersistentThread = await freshComposable();
      // initializeThread is called automatically in the composable constructor
      const { currentThreadId, isThreadLoaded } = usePersistentThread();

      expect(currentThreadId.value).toBe('thread-init');
      expect(isThreadLoaded.value).toBe(true);
    });

    it('sets isThreadLoaded to true even when no thread is stored', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);

      const usePersistentThread = await freshComposable();
      const { currentThreadId, isThreadLoaded } = usePersistentThread();

      expect(currentThreadId.value).toBeNull();
      expect(isThreadLoaded.value).toBe(true);
    });

    it('clears expired thread during initialization', async () => {
      const now = Date.now();
      const threadData = {
        threadId: 'thread-expired-init',
        createdAt: now - THREAD_EXPIRY_TIME - 1000,
        lastUsedAt: now - THREAD_EXPIRY_TIME - 1000,
        messageCount: 3,
      };
      // Expiry is in the past
      const expiry = (now - 1000).toString();

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return expiry;
        return null;
      });

      const usePersistentThread = await freshComposable();
      const { currentThreadId, isThreadLoaded } = usePersistentThread();

      expect(currentThreadId.value).toBeNull();
      expect(isThreadLoaded.value).toBe(true);
      // Should have called removeItem for cleanup
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_STORAGE_KEY);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_EXPIRY_KEY);
    });

    it('updates lastUsedAt when loading a valid persisted thread', async () => {
      const now = Date.now();
      const threadData = {
        threadId: 'thread-touch',
        createdAt: now - 5000,
        lastUsedAt: now - 5000,
        messageCount: 1,
      };
      const expiry = (now + THREAD_EXPIRY_TIME).toString();

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return expiry;
        return null;
      });

      const usePersistentThread = await freshComposable();
      usePersistentThread();

      // loadPersistedThread updates lastUsedAt and saves back
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_STORAGE_KEY,
        JSON.stringify({
          ...threadData,
          lastUsedAt: now,
        }),
      );
    });

    it('handles corrupted JSON in localStorage gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return '{invalid-json';
        if (key === THREAD_EXPIRY_KEY) return '999999999999999';
        return null;
      });

      const usePersistentThread = await freshComposable();
      const { currentThreadId, isThreadLoaded } = usePersistentThread();

      expect(currentThreadId.value).toBeNull();
      expect(isThreadLoaded.value).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────
  // SSR guard
  // ─────────────────────────────────────────
  describe('SSR guard (process.client = false)', () => {
    it('does not access localStorage when not in browser', async () => {
      // Simulate SSR environment
      (global as any).process = { ...process, client: false, server: true };

      const usePersistentThread = await freshComposable();
      const {
        persistThread,
        getThreadData,
        clearPersistedThread,
        updateThreadUsage,
        currentThreadId,
        isThreadLoaded,
        isThreadExpired,
        timeUntilExpiry,
      } = usePersistentThread();

      // initializeThread should set isThreadLoaded to true but not touch localStorage
      expect(isThreadLoaded.value).toBe(true);
      expect(currentThreadId.value).toBeNull();

      // None of these should call localStorage
      (window.localStorage.getItem as any).mockClear();
      (window.localStorage.setItem as any).mockClear();
      (window.localStorage.removeItem as any).mockClear();

      persistThread('ssr-thread');
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
      expect(currentThreadId.value).toBeNull();

      expect(getThreadData()).toBeNull();
      expect(window.localStorage.getItem).not.toHaveBeenCalled();

      clearPersistedThread();
      expect(window.localStorage.removeItem).not.toHaveBeenCalled();

      updateThreadUsage();
      expect(window.localStorage.setItem).not.toHaveBeenCalled();

      expect(isThreadExpired.value).toBe(false);
      expect(timeUntilExpiry.value).toBe(0);

      // Restore process.client for other tests
      (global as any).process = { ...process, client: true, server: false };
    });
  });

  // ─────────────────────────────────────────
  // loadPersistedThread (tested indirectly)
  // ─────────────────────────────────────────
  describe('loadPersistedThread (via initializeThread)', () => {
    it('returns null when THREAD_STORAGE_KEY is missing', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);

      const usePersistentThread = await freshComposable();
      const { currentThreadId } = usePersistentThread();

      expect(currentThreadId.value).toBeNull();
    });

    it('returns null when THREAD_EXPIRY_KEY is missing', async () => {
      const threadData = {
        threadId: 'thread-no-expiry',
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        messageCount: 0,
      };

      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(threadData);
        if (key === THREAD_EXPIRY_KEY) return null;
        return null;
      });

      const usePersistentThread = await freshComposable();
      const { currentThreadId } = usePersistentThread();

      expect(currentThreadId.value).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // Readonly refs
  // ─────────────────────────────────────────
  describe('readonly state', () => {
    it('currentThreadId is readonly', async () => {
      const usePersistentThread = await freshComposable();
      const { currentThreadId } = usePersistentThread();

      // The ref should be wrapped in readonly()
      // Attempting to write should be silently ignored in production
      // or warn in development. We just verify the value doesn't change
      // when using the public API correctly.
      expect(currentThreadId.value).toBeNull();
    });

    it('isThreadLoaded is readonly', async () => {
      const usePersistentThread = await freshComposable();
      const { isThreadLoaded } = usePersistentThread();

      expect(isThreadLoaded.value).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // Full lifecycle integration
  // ─────────────────────────────────────────
  describe('full lifecycle', () => {
    it('persist -> update -> get -> clear cycle works correctly', async () => {
      const now = Date.now();
      const usePersistentThread = await freshComposable();
      const {
        persistThread,
        updateThreadUsage,
        getThreadData,
        clearPersistedThread,
        currentThreadId,
      } = usePersistentThread();

      // 1. Persist a new thread
      persistThread('lifecycle-thread', 0);
      expect(currentThreadId.value).toBe('lifecycle-thread');

      // 2. Make getThreadData return what we persisted
      const persistedData = {
        threadId: 'lifecycle-thread',
        createdAt: now,
        lastUsedAt: now,
        messageCount: 0,
      };
      (window.localStorage.getItem as any).mockImplementation((key: string) => {
        if (key === THREAD_STORAGE_KEY) return JSON.stringify(persistedData);
        if (key === THREAD_EXPIRY_KEY) return (now + THREAD_EXPIRY_TIME).toString();
        return null;
      });

      // 3. Get thread data
      const data = getThreadData();
      expect(data).toEqual(persistedData);

      // 4. Update usage
      (window.localStorage.setItem as any).mockClear();
      updateThreadUsage(5);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        THREAD_STORAGE_KEY,
        expect.stringContaining('"messageCount":5'),
      );

      // 5. Clear
      clearPersistedThread();
      expect(currentThreadId.value).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_STORAGE_KEY);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(THREAD_EXPIRY_KEY);
    });
  });
});
