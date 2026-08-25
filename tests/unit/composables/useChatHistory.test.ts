import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const HISTORY_STORAGE_KEY = 'cmdiy_chat_history';
const MAX_ENTRIES = 20;
const ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

describe('useChatHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    (window.localStorage.getItem as any).mockReset();
    (window.localStorage.setItem as any).mockReset();
    (window.localStorage.removeItem as any).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function freshComposable() {
    const mod = await import('~/app/composables/useChatHistory');
    return mod.useChatHistory;
  }

  function stored(entries: any[]) {
    (window.localStorage.getItem as any).mockImplementation((key: string) =>
      key === HISTORY_STORAGE_KEY ? JSON.stringify(entries) : null
    );
  }

  function lastWrite() {
    const calls = (window.localStorage.setItem as any).mock.calls;
    return JSON.parse(calls[calls.length - 1][1]);
  }

  function entry(overrides: Partial<any> = {}) {
    return {
      threadId: 'thread-1',
      title: 'A chat',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      messageCount: 2,
      ...overrides,
    };
  }

  describe('load()', () => {
    it('reads entries newest first', async () => {
      // Timestamps must be recent: load() drops anything past ENTRY_MAX_AGE_MS,
      // so epoch-ish fixtures would be filtered out and prove nothing.
      const now = Date.now();
      stored([entry({ threadId: 'old', lastUsedAt: now - 5000 }), entry({ threadId: 'new', lastUsedAt: now - 1000 })]);
      const { entries, load } = (await freshComposable())();
      load();
      expect(entries.value.map((e) => e.threadId)).toEqual(['new', 'old']);
    });

    it('is empty when nothing is stored', async () => {
      stored([]);
      (window.localStorage.getItem as any).mockReturnValue(null);
      const { entries, load } = (await freshComposable())();
      load();
      expect(entries.value).toEqual([]);
    });

    it('survives malformed JSON rather than throwing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (window.localStorage.getItem as any).mockReturnValue('{not json');
      const { entries, load } = (await freshComposable())();
      expect(() => load()).not.toThrow();
      expect(entries.value).toEqual([]);
      warn.mockRestore();
    });

    it('drops entries that are not shaped like history rows', async () => {
      stored([entry({ threadId: 'good' }), { nonsense: true }, { threadId: '' }]);
      const { entries, load } = (await freshComposable())();
      load();
      expect(entries.value.map((e) => e.threadId)).toEqual(['good']);
    });

    it('drops entries past the max age', async () => {
      const now = Date.now();
      stored([
        entry({ threadId: 'fresh', lastUsedAt: now }),
        entry({ threadId: 'ancient', lastUsedAt: now - ENTRY_MAX_AGE_MS - 1 }),
      ]);
      const { entries, load } = (await freshComposable())();
      load();
      expect(entries.value.map((e) => e.threadId)).toEqual(['fresh']);
    });

    it('writes back only when cleanup actually removed something', async () => {
      stored([entry({ threadId: 'fresh', lastUsedAt: Date.now() })]);
      const { load } = (await freshComposable())();
      load();
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('record()', () => {
    it('adds a new conversation and persists it', async () => {
      stored([]);
      (window.localStorage.getItem as any).mockReturnValue(null);
      const { entries, load, record } = (await freshComposable())();
      load();
      record('thread-a', { title: 'Needles', messageCount: 2 });

      expect(entries.value).toHaveLength(1);
      expect(entries.value[0]).toMatchObject({ threadId: 'thread-a', title: 'Needles', messageCount: 2 });
      expect(lastWrite()[0].threadId).toBe('thread-a');
    });

    it('does not duplicate an existing thread', async () => {
      stored([entry({ threadId: 'thread-a' })]);
      const { entries, load, record } = (await freshComposable())();
      load();
      record('thread-a', { messageCount: 8 });

      expect(entries.value).toHaveLength(1);
      expect(entries.value[0].messageCount).toBe(8);
    });

    it('keeps the original title so later messages cannot rename a chat', async () => {
      stored([entry({ threadId: 'thread-a', title: 'First question' })]);
      const { entries, load, record } = (await freshComposable())();
      load();
      record('thread-a', { title: 'A totally different later message' });

      expect(entries.value[0].title).toBe('First question');
    });

    it('moves a revisited conversation back to the top', async () => {
      const now = Date.now();
      stored([entry({ threadId: 'a', lastUsedAt: now - 1000 }), entry({ threadId: 'b', lastUsedAt: now - 5000 })]);
      const { entries, load, record } = (await freshComposable())();
      load();
      // Guard the precondition: without it this test passes even when load()
      // discarded both entries and record() simply added the only row.
      expect(entries.value.map((e) => e.threadId)).toEqual(['a', 'b']);

      record('b', {});

      expect(entries.value[0].threadId).toBe('b');
    });

    it('caps the list length', async () => {
      const now = Date.now();
      stored(
        Array.from({ length: MAX_ENTRIES }, (_, i) =>
          entry({ threadId: `t${i}`, lastUsedAt: now - (MAX_ENTRIES - i) * 1000 })
        )
      );
      const { entries, load, record } = (await freshComposable())();
      load();
      expect(entries.value).toHaveLength(MAX_ENTRIES);

      record('brand-new', { title: 'New' });

      expect(entries.value).toHaveLength(MAX_ENTRIES);
      expect(entries.value[0].threadId).toBe('brand-new');
      // The oldest entry is the one that fell off.
      expect(entries.value.some((e) => e.threadId === 't0')).toBe(false);
    });

    it('ignores an empty thread id', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);
      const { entries, load, record } = (await freshComposable())();
      load();
      record('', { title: 'nope' });
      expect(entries.value).toEqual([]);
    });

    it('does not throw when storage rejects the write', async () => {
      (window.localStorage.getItem as any).mockReturnValue(null);
      (window.localStorage.setItem as any).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { load, record } = (await freshComposable())();
      load();
      expect(() => record('thread-a', { title: 'x' })).not.toThrow();
      warn.mockRestore();
    });
  });

  describe('remove() and clear()', () => {
    it('removes a single conversation', async () => {
      stored([entry({ threadId: 'a' }), entry({ threadId: 'b' })]);
      const { entries, load, remove } = (await freshComposable())();
      load();
      remove('a');
      expect(entries.value.map((e) => e.threadId)).toEqual(['b']);
    });

    it('clears everything and drops the storage key', async () => {
      stored([entry({ threadId: 'a' })]);
      const { entries, load, clear } = (await freshComposable())();
      load();
      clear();
      expect(entries.value).toEqual([]);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(HISTORY_STORAGE_KEY);
    });
  });

  describe('deriveTitle()', () => {
    it('collapses whitespace', async () => {
      const { deriveTitle } = (await freshComposable())();
      expect(deriveTitle('  what   needle\n\nfor a 1275? ')).toBe('what needle for a 1275?');
    });

    it('truncates long messages with an ellipsis', async () => {
      const { deriveTitle } = (await freshComposable())();
      const title = deriveTitle('x'.repeat(200));
      expect(title.length).toBeLessThanOrEqual(70);
      expect(title.endsWith('…')).toBe(true);
    });

    it('leaves a short message untouched', async () => {
      const { deriveTitle } = (await freshComposable())();
      expect(deriveTitle('Short one')).toBe('Short one');
    });
  });

  describe('SSR guard (process.client = false)', () => {
    it('does not touch localStorage on the server', async () => {
      (global as any).process = { ...process, client: false, server: true };

      const { entries, load, record, clear } = (await freshComposable())();
      (window.localStorage.getItem as any).mockClear();
      (window.localStorage.setItem as any).mockClear();
      (window.localStorage.removeItem as any).mockClear();

      load();
      record('thread-a', { title: 'x' });
      expect(window.localStorage.getItem).not.toHaveBeenCalled();
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
      expect(entries.value).toEqual([]);

      clear();
      expect(window.localStorage.removeItem).not.toHaveBeenCalled();

      (global as any).process = { ...process, client: true, server: false };
    });
  });
});
