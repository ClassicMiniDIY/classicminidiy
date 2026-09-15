import { computed, type Ref } from 'vue';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { parseQuotaError } from '~/utils/chatQuotaError';
import { selectRailVideos } from '~/utils/chatVideoRail';
import { selectUsefulLinks } from '~/utils/chatUsefulLinks';
import { CHAT_REQUEST_TRIM_TARGET, windowTranscript } from '~~/shared/utils/chatTranscript';

/**
 * One conversation with the assistant: the transport to `/api/chat`, the
 * request window, and the two rails derived from the transcript.
 *
 * Lifted out of `ChatWindow.vue` (design: docs/plans/2026-09-15-unified-search-phase-2.md)
 * so the `/search` answer panel and the `/chat` page share ONE transport
 * definition. Everything about how a request is shaped lives here; the shell
 * around it — composer, history, sync, the quota wall, scrolling — stays with
 * the page that owns it.
 *
 * Called during setup, like `useChat` itself. Nothing here reads storage or
 * the window, so it is SSR-safe; the callers keep their own `hasMounted`
 * gates for the state that is not.
 */

/**
 * How many recent messages travel with a request.
 *
 * The transcript on screen and in history is never trimmed — only the REQUEST
 * is windowed. Without this, a long conversation grows past the route's own
 * limits and every further send 413s, which the UI can only report as
 * "something went wrong, please try again" — advice that can never work,
 * leaving the visitor stuck with no way out but New chat and no hint that it
 * is the way out. Windowing here means the dead end cannot occur; the server
 * guard stays as defence against a crafted request, not as everyday UX.
 *
 * Well under the route's MAX_MESSAGES so a slow client and a strict server
 * cannot disagree at the boundary.
 *
 * A COUNT alone does not deliver that promise. The route's other limit is on
 * characters, and twenty-four messages are not a fixed number of them: an
 * assistant turn that called `vehicle-weights` or `torque-specs` carries
 * thousands of characters of rows, so a browsing conversation can cross the
 * character ceiling while sitting comfortably inside the message one.
 * `windowTranscript` applies both bounds against the same measurement the
 * route uses.
 */
export const REQUEST_MESSAGE_WINDOW = 24;

export interface ChatAnswerOptions {
  /** Local conversation id. Keys history; never sent to a thread store. */
  threadId: Ref<string>;
  /** The page the question was asked from, for the agent's context. */
  pageSlug: () => string;
}

/** Local conversation id. `randomUUID` needs a secure context; the fallback keeps http dev working. */
export function newThreadId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useChatAnswer({ threadId, pageSlug }: ChatAnswerOptions) {
  // `locale` is read at SEND time, so switching language mid-conversation
  // applies to the next message.
  const { locale } = useI18n();

  const { messages, status, error, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // A getter, so locale and page are read when the request is built rather
      // than frozen when the transport was constructed.
      body: () => ({
        locale: locale.value,
        pageSlug: pageSlug(),
        threadId: threadId.value,
      }),
      prepareSendMessagesRequest({ messages: outgoing, body }) {
        const windowed = windowTranscript(outgoing, {
          maxMessages: REQUEST_MESSAGE_WINDOW,
          maxChars: CHAT_REQUEST_TRIM_TARGET,
        });
        return { body: { ...body, messages: windowed } };
      },
    }),
    onError(err: Error) {
      console.error('[chat] request failed:', err);
    },
  });

  const isLoading = computed(() => status.value === 'submitted' || status.value === 'streaming');

  /**
   * The structured 429, when the live error is one. The transport puts the
   * response body in the error's message, so the route's verdict survives the
   * trip — see `app/utils/chatQuotaError.ts`.
   */
  const quotaError = computed(() => parseQuotaError(error.value));

  /** Video rail from the latest answer's `video-search` results. */
  const videos = computed(() => selectRailVideos(messages.value as UIMessage[]));

  /** Links rail from search-shaped tool results in the conversation. */
  const usefulLinks = computed(() => selectUsefulLinks(messages.value as UIMessage[]));

  return { messages, status, error, isLoading, sendMessage, stop, quotaError, videos, usefulLinks };
}
