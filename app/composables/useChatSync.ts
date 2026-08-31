import { ref } from 'vue';
import type { UIMessage } from 'ai';

/**
 * Server-side conversation sync — the Sustaining Member capability.
 *
 * The browser's localStorage stays the WORKING COPY. This is a sync target, not
 * the live store, so every call here fails soft: a Supabase blip, an expired
 * session or a 403 degrades the member to local-only history and never takes
 * the chat down. That is the same fail-open reasoning as
 * `server/middleware/chat-auth.ts`, applied on the client.
 *
 * Consequence worth stating: a failed sync is silent by design. `lastError` is
 * exposed so a future settings surface can say "not synced" without this module
 * deciding to interrupt someone mid-conversation about it.
 */

/** Metadata for a conversation that exists on the server. */
export interface RemoteThread {
  threadId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Matches the list route's limit and the database trigger's cap. */
const MAX_SYNCED = 20;

export function useChatSync() {
  const supabase = useSupabase();

  const remote = ref<RemoteThread[]>([]);
  const lastError = ref<string | null>(null);

  /**
   * The caller's access token, or null.
   *
   * The Supabase session lives in localStorage rather than a cookie, so every
   * `/api/**` call that needs the user must carry an explicit Bearer header —
   * see the note in CLAUDE.md. Reading it per call rather than caching keeps a
   * refreshed token from going stale mid-session.
   */
  async function token(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T | null> {
    const accessToken = await token();
    if (!accessToken) return null;

    try {
      const result = await $fetch<T>(path, {
        method: (init.method as any) ?? 'GET',
        body: init.body as any,
        headers: { Authorization: `Bearer ${accessToken}` },
        // Survives page unload. The last push before someone navigates away is
        // fired from a `pagehide` handler, and an ordinary fetch is cancelled
        // there — so those final messages reached localStorage and silently
        // never reached the server.
        keepalive: true,
      });
      lastError.value = null;
      return result;
    } catch (error: any) {
      // 403 is the expected answer for a non-member and is not worth recording
      // as a fault — it simply means this account does not have the benefit.
      if (error?.statusCode !== 403) {
        lastError.value = error?.statusMessage ?? error?.message ?? 'Sync unavailable';
        console.warn('[chat sync] request failed:', path, lastError.value);
      }
      return null;
    }
  }

  /** Fetch the member's conversation list. Returns false when sync is unavailable. */
  async function pull(): Promise<boolean> {
    const result = await call<{ threads: RemoteThread[] }>('/api/chat/threads');
    if (!result) return false;
    remote.value = result.threads ?? [];
    return true;
  }

  /** Fetch one conversation's transcript. */
  async function pullThread(threadId: string): Promise<UIMessage[] | null> {
    const result = await call<{ messages: UIMessage[] }>(`/api/chat/threads/${threadId}`);
    return result?.messages ?? null;
  }

  /** Upsert one conversation. */
  async function push(threadId: string, title: string, messages: UIMessage[]): Promise<void> {
    const saved = await call<RemoteThread>(`/api/chat/threads/${threadId}`, {
      method: 'PUT',
      body: { title, messages },
    });
    if (!saved) return;
    // Keep the local list in step so the dialog does not need a round trip to
    // show a conversation the user is in the middle of — capped at the same
    // twenty the list route and the database trigger enforce, so all three
    // agree. Without the cap the dialog would list conversations the server has
    // already trimmed, and opening one would 404: an expired conversation
    // reading as a broken one.
    remote.value = [saved, ...remote.value.filter((entry) => entry.threadId !== threadId)].slice(0, MAX_SYNCED);
  }

  /**
   * Upload conversations that exist only in this browser.
   *
   * Without this the feature is invisible to the people most likely to want
   * it: someone who has been using the assistant, subscribes, opens a second
   * device and finds nothing, because their existing conversations sit in the
   * first browser's localStorage and would only sync if that browser happened
   * to reopen each one and send another message.
   *
   * Sequential rather than parallel, and deliberately so — twenty transcripts
   * fired at once is a burst against the caller's own write throttle, and this
   * runs in the background where finishing a second later costs nothing. Stops
   * at the first failure rather than hammering a server that is already
   * refusing; the next page load retries.
   */
  async function backfill(local: Array<{ threadId: string; title: string; messages: UIMessage[] }>): Promise<number> {
    const known = new Set(remote.value.map((entry) => entry.threadId));
    const missing = local.filter((entry) => !known.has(entry.threadId) && entry.messages.length > 0);

    let uploaded = 0;
    for (const entry of missing) {
      const before = remote.value.length;
      await push(entry.threadId, entry.title, entry.messages);
      if (remote.value.length === before) break;
      uploaded += 1;
    }
    return uploaded;
  }

  async function remove(threadId: string): Promise<void> {
    await call(`/api/chat/threads/${threadId}`, { method: 'DELETE' });
    remote.value = remote.value.filter((entry) => entry.threadId !== threadId);
  }

  async function clear(): Promise<void> {
    await call('/api/chat/threads', { method: 'DELETE' });
    remote.value = [];
  }

  return { remote, lastError, pull, pullThread, push, backfill, remove, clear };
}
