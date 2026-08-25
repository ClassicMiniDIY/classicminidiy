import { ref } from 'vue';

/**
 * Local chat history for the CMDIY Assistant.
 *
 * Threads themselves live server-side in LangGraph; this only remembers WHICH
 * threads this browser has talked to, so a visitor can get back to a recent
 * conversation. It is intentionally local-only and therefore does not survive
 * clearing site data, a different browser, or a different device — see the
 * "signed-in history" note in docs/plans/2026-08-25-chat-ui-refresh.md for
 * what a durable version would need.
 *
 * SSR note: nothing here may be read during component setup. The server has no
 * localStorage and always renders the empty chat, so branching a render on a
 * value read during setup is the structural hydration mismatch documented in
 * CLAUDE.md. Call `load()` from `onMounted`, the same way useRecentTools does.
 */

const HISTORY_STORAGE_KEY = 'cmdiy_chat_history';

/** Keep the list short; this is a convenience, not an archive. */
const MAX_ENTRIES = 20;

/** Entries older than this are dropped on load. Matches the thread expiry. */
const ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const TITLE_MAX_LENGTH = 70;

export interface ChatHistoryEntry {
  threadId: string;
  title: string;
  createdAt: number;
  lastUsedAt: number;
  messageCount: number;
}

export function useChatHistory() {
  const entries = ref<ChatHistoryEntry[]>([]);

  // Deliberately `process.client`, matching usePersistentThread — the vitest
  // plugin rewrites `import.meta.client` to a literal `(true)`, which would
  // make the SSR guard untestable.
  const isBrowser = process.client;

  function isValidEntry(value: any): value is ChatHistoryEntry {
    return (
      value &&
      typeof value.threadId === 'string' &&
      value.threadId.length > 0 &&
      typeof value.title === 'string' &&
      typeof value.lastUsedAt === 'number'
    );
  }

  function persist(next: ChatHistoryEntry[]) {
    if (!isBrowser) return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      // Quota or a locked-down browser. History is a convenience; never let it
      // take the chat down with it.
      console.warn('Failed to persist chat history:', error);
    }
  }

  /** Read the list from storage. Call from onMounted, never during setup. */
  function load() {
    if (!isBrowser) return;
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        entries.value = [];
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        entries.value = [];
        return;
      }

      const cutoff = Date.now() - ENTRY_MAX_AGE_MS;
      const cleaned = parsed
        .filter(isValidEntry)
        .filter((entry) => entry.lastUsedAt >= cutoff)
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        .slice(0, MAX_ENTRIES);

      entries.value = cleaned;

      // Write back only when the cleanup actually changed something.
      if (cleaned.length !== parsed.length) {
        persist(cleaned);
      }
    } catch (error) {
      console.warn('Failed to read chat history:', error);
      entries.value = [];
    }
  }

  /** Derive a readable title from the first thing the user said. */
  function deriveTitle(text: string): string {
    const collapsed = text.replace(/\s+/g, ' ').trim();
    if (collapsed.length <= TITLE_MAX_LENGTH) return collapsed;
    return `${collapsed.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
  }

  /**
   * Insert or update a thread. An existing entry keeps its original title, so
   * a conversation does not get renamed by later messages.
   */
  function record(threadId: string, patch: { title?: string; messageCount?: number }) {
    if (!isBrowser || !threadId) return;

    const now = Date.now();
    const existing = entries.value.find((entry) => entry.threadId === threadId);

    const updated: ChatHistoryEntry = existing
      ? {
          ...existing,
          lastUsedAt: now,
          messageCount: patch.messageCount ?? existing.messageCount,
          title: existing.title || patch.title || '',
        }
      : {
          threadId,
          title: patch.title || '',
          createdAt: now,
          lastUsedAt: now,
          messageCount: patch.messageCount ?? 0,
        };

    const next = [updated, ...entries.value.filter((entry) => entry.threadId !== threadId)]
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_ENTRIES);

    entries.value = next;
    persist(next);
  }

  function remove(threadId: string) {
    const next = entries.value.filter((entry) => entry.threadId !== threadId);
    entries.value = next;
    persist(next);
  }

  function clear() {
    entries.value = [];
    if (!isBrowser) return;
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear chat history:', error);
    }
  }

  return { entries, load, record, remove, clear, deriveTitle };
}
