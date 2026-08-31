import { ref } from 'vue';
import type { UIMessage } from 'ai';

/**
 * Local chat history for the CMDIY Assistant.
 *
 * This used to remember only WHICH threads this browser had talked to, because
 * the conversations themselves lived server-side in a LangGraph deployment. That
 * deployment is gone: the agent now runs in this Worker and holds no state
 * between requests, so the browser owns the transcript and this file IS the
 * store rather than an index into a remote one.
 *
 * Client-owned was the deliberate choice over a Supabase table. The assistant
 * has to work logged out, so a server-side store would mean inventing an
 * anonymous identifier and taking on a retention obligation for it — real
 * privacy surface for a feature answering a few dozen questions a month.
 * Synced, cross-device history is the natural thing to sell with the Sustaining
 * Member tier later, where every row has a real owner.
 *
 * Consequences, all intended: history does not survive clearing site data, and
 * does not follow a visitor to another browser or device.
 *
 * SSR note: nothing here may be read during component setup. The server has no
 * localStorage and always renders the empty chat, so branching a render on a
 * value read during setup is the structural hydration mismatch documented in
 * CLAUDE.md. Call `load()` from `onMounted`, the same way useRecentTools does.
 */

const HISTORY_STORAGE_KEY = 'cmdiy_chat_history';

/** Keep the list short; this is a convenience, not an archive. */
const MAX_ENTRIES = 20;

/** Entries older than this are dropped on load. */
const ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const TITLE_MAX_LENGTH = 70;

/**
 * Storage budget for the whole history, in characters.
 *
 * Now that entries carry full transcripts this is load-bearing rather than
 * theoretical. localStorage is typically ~5MB PER ORIGIN, shared with every
 * other key this site sets, and exceeding it throws — which would take out the
 * write that was in progress. ~1.5M characters leaves the rest of the origin
 * plenty of room, and the oldest conversations are dropped to stay under it.
 */
const MAX_STORED_CHARS = 1_500_000;

export interface ChatHistoryEntry {
  threadId: string;
  title: string;
  createdAt: number;
  lastUsedAt: number;
  messageCount: number;
  /** The transcript. Entries without one are dropped on load — see isValidEntry. */
  messages: UIMessage[];
}

export function useChatHistory() {
  const entries = ref<ChatHistoryEntry[]>([]);

  // Deliberately `process.client` — the vitest plugin rewrites
  // `import.meta.client` to a literal `(true)`, which would make the SSR guard
  // untestable.
  const isBrowser = process.client;

  function isValidEntry(value: any): value is ChatHistoryEntry {
    return (
      value &&
      typeof value.threadId === 'string' &&
      value.threadId.length > 0 &&
      typeof value.title === 'string' &&
      typeof value.lastUsedAt === 'number' &&
      // Entries written before the agent moved in-Worker hold only a REMOTE
      // thread id — the transcript lived in a LangGraph deployment that no
      // longer exists, so there is nothing left to restore and opening one
      // would show an empty conversation with no explanation. Dropping them on
      // load is the migration: a stale pointer is worse than an absent entry.
      Array.isArray(value.messages) &&
      value.messages.length > 0
    );
  }

  /**
   * Drop the oldest conversations until the payload fits the budget. Entries
   * arrive newest-first, so this always sheds the least recently used.
   */
  function withinBudget(next: ChatHistoryEntry[]): ChatHistoryEntry[] {
    let trimmed = next;
    while (trimmed.length > 1 && JSON.stringify(trimmed).length > MAX_STORED_CHARS) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed;
  }

  function persist(next: ChatHistoryEntry[]) {
    if (!isBrowser) return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(withinBudget(next)));
    } catch (error) {
      // Quota, or a locked-down browser. Retry once with only the current
      // conversation: losing older history beats losing the one in progress.
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next.slice(0, 1)));
      } catch {
        console.warn('Failed to persist chat history:', error);
      }
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
   * Insert or update a conversation. An existing entry keeps its original
   * title, so a conversation is not renamed by later messages.
   */
  function record(threadId: string, patch: { title?: string; messages?: UIMessage[] }) {
    if (!isBrowser || !threadId) return;

    const now = Date.now();
    const existing = entries.value.find((entry) => entry.threadId === threadId);
    const messages = patch.messages ?? existing?.messages ?? [];

    const updated: ChatHistoryEntry = existing
      ? {
          ...existing,
          lastUsedAt: now,
          messages,
          messageCount: messages.length,
          title: existing.title || patch.title || '',
        }
      : {
          threadId,
          title: patch.title || '',
          createdAt: now,
          lastUsedAt: now,
          messages,
          messageCount: messages.length,
        };

    const next = [updated, ...entries.value.filter((entry) => entry.threadId !== threadId)]
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_ENTRIES);

    entries.value = next;
    persist(next);
  }

  /** The transcript for a conversation, or an empty array if it has none. */
  function getMessages(threadId: string): UIMessage[] {
    return entries.value.find((entry) => entry.threadId === threadId)?.messages ?? [];
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

  return { entries, load, record, remove, clear, deriveTitle, getMessages };
}
