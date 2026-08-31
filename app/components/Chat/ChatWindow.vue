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
              <!--
                `&& !quotaExhausted` is load-bearing. Without it, starting a new
                chat after hitting the ceiling emptied the transcript, which sent
                the render down this branch and took the explanation with it —
                leaving a disabled composer reading "Message limit reached" above
                starter prompts that could not be used, and nothing saying why.
                Falling through to the branch below keeps the panel on screen
                even with no messages.
              -->
              <ChatEmptyState v-if="isChatEmpty && !quotaExhausted" @pick="handleStarter" />

              <!-- Deliberately NOT `role="log"`: that role carries an implicit
               `aria-live="polite"`, which would make a screen reader re-announce
               the whole reply on every streamed token. The sr-only status region
               below is the single announcement point. -->
              <div v-else class="space-y-6">
                <template v-for="message in messages" :key="message.id">
                  <HumanMessage v-if="message.role === 'user'" :message="message" :is-loading="isLoading" />
                  <AssistantMessage
                    v-else-if="message.role === 'assistant'"
                    :message="message"
                    :is-loading="isLoading"
                    :thread-id="threadId"
                  />
                </template>

                <!-- The request itself failed (network, 429, 503). Rendered as
                     chrome, NOT as an assistant turn: a failure dressed up as a
                     reply is indistinguishable from the assistant saying
                     something went wrong, and only one of those is true. -->
                <!-- Hitting a ceiling is not a failure, so it does not get the
                     failure treatment. See QuotaLimitPanel. -->
                <QuotaLimitPanel v-if="quotaExhausted" :quota="quotaExhausted" />

                <div v-else-if="error" role="alert" class="alert alert-error">
                  <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
                  <span>{{ t('request_failed') }}</span>
                </div>

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
              :disabled="!!quotaExhausted"
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
      :entries="historyEntries"
      :active-thread-id="threadId"
      :open="historyOpen"
      @select="handleSelectThread"
      @remove="handleRemoveThread"
      @clear="handleClearHistory"
      @close="historyOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
  // Explicit vue imports rather than the auto-imports.
  //
  // Nuxt's auto-import declarations resolve to overloads that reject the calls
  // used here — `ref<T>()` with no argument reports "Expected 1 arguments", and
  // `nextTick(cb)` reports "Expected 0 arguments". Both are correct Vue usage
  // and correct at runtime; only the ambient types disagree. Importing from
  // 'vue' takes the real signatures and clears the errors, the same way the
  // composables in app/composables/ already do.
  //
  // This is an explicit IMPORT, not a local binding — it does not trip the
  // auto-import shadowing gotcha in CLAUDE.md, which is about a local
  // `const ref = ...` suppressing the injection for the whole file.
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { DefaultChatTransport, type UIMessage } from 'ai';
  import { parseQuotaError } from '~/utils/chatQuotaError';
  import { useChat } from '@ai-sdk/vue';
  import AssistantMessage from './AssistantMessage.vue';
  import ChatComposer from './ChatComposer.vue';
  import ChatEmptyState from './ChatEmptyState.vue';
  import ChatHistoryDialog from './ChatHistoryDialog.vue';
  import HumanMessage from './HumanMessage.vue';
  import QuotaLimitPanel from './QuotaLimitPanel.vue';
  import UsefulLinks from './UsefulLinks.vue';
  import UsefulLinksSidebar from './UsefulLinksSidebar.vue';

  /**
   * The assistant, talking to `/api/chat` in this Worker.
   *
   * What this replaces: a 665-line hand-port of the LangGraph SDK's React-only
   * `useStream` hook, plus a client-side thread store, plus eight proxy routes.
   * The AI SDK ships a documented stream protocol and a Vue binding for it, so
   * all of that is now `useChat`.
   *
   * Two things that went away entirely, rather than being ported:
   *
   *  - **Remote thread ids.** The agent is stateless between requests, so there
   *    is no server thread to lose, and with it goes the whole `threadMissing`
   *    404/410/422 cleanup path that existed to stop a dead id re-requesting
   *    itself on every page load forever. The id here is generated locally and
   *    only ever keys local history.
   *  - **`usePersistentThread`.** Its entire job was holding that remote id.
   *    `useChatHistory` now stores the transcripts themselves.
   *
   * The hydration invariant is UNCHANGED and gets stricter, because more state
   * is client-only now: the server always renders the empty/welcome branch, so
   * nothing may branch the template on stored state until after `onMounted`.
   * See `hasMounted` below and the note in CLAUDE.md.
   */

  // `locale` is read once here and sent with each request, so switching
  // language mid-conversation applies to the next message.
  const { t, locale } = useI18n();

  const route = useRoute();
  const input = ref('');
  const composerRef = ref<InstanceType<typeof ChatComposer>>();
  const messagesContainer = ref<HTMLDivElement>();
  const showScrollButton = ref(false);
  const historyOpen = ref(false);

  const history = useChatHistory();
  const sync = useChatSync();
  const { isSustainingMember } = useAuth();

  /**
   * Whether this browser is syncing conversations to the account.
   *
   * Gated on `hasMounted` as well as membership: `isSustainingMember` reads a
   * profile loaded client-side, so it is false during SSR and flips true after
   * `initAuth()` — branching on it directly is the structural hydration
   * mismatch documented in CLAUDE.md. Same rule as `MainNav`'s `isSignedIn`.
   */
  // The server never has stored state, so SSR always renders the welcome
  // branch. Reading localStorage during setup would flip this on the first
  // client render — the structural hydration mismatch that mangled this page.
  const hasMounted = ref(false);

  const syncEnabled = computed(() => hasMounted.value && isSustainingMember.value);

  /**
   * Pull the account's conversations once membership is known, then upload any
   * that exist only in this browser.
   *
   * At setup scope like every other watcher here — `syncEnabled` already folds
   * in `hasMounted`, so there is nothing to gain from deferring the watcher
   * itself, and putting it inside `onMounted` implied an ordering requirement
   * that does not exist.
   *
   * Not awaited anywhere: a slow or unavailable sync must never delay the chat
   * becoming usable, and the local copy is already on screen.
   */
  watch(
    syncEnabled,
    async (on) => {
      if (!on) return;
      const pulled = await sync.pull();
      if (!pulled) return;
      // The backfill is what makes the benefit visible to someone who was
      // already using the assistant before they subscribed.
      await sync.backfill(
        history.entries.value.map((entry) => ({
          threadId: entry.threadId,
          title: entry.title,
          messages: entry.messages,
        }))
      );
    },
    { immediate: true }
  );

  /**
   * The history dialog's list: local conversations plus any that exist only on
   * the server (another device, or this browser after its storage was cleared).
   *
   * Local wins on a collision. It is the working copy, so it is at least as
   * fresh as anything the server has — the push is debounced, so the server is
   * by definition a little behind.
   */
  const asTime = (value: string): number => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  };

  const historyEntries = computed(() => {
    const local = history.entries.value;
    if (!syncEnabled.value) return local;

    const localIds = new Set(local.map((entry) => entry.threadId));
    const remoteOnly = sync.remote.value
      .filter((entry) => !localIds.has(entry.threadId))
      .map((entry) => ({
        threadId: entry.threadId,
        title: entry.title,
        messageCount: entry.messageCount,
        // `Number.isFinite`, not `||`: Date.parse returns NaN for an
        // unparseable string and 0 for the epoch, and `||` treats both the
        // same — so a malformed timestamp would sort to the top of the list as
        // though it were brand new.
        createdAt: asTime(entry.createdAt),
        lastUsedAt: asTime(entry.updatedAt),
        messages: [],
      }));

    return [...local, ...remoteOnly].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  });

  /** Local conversation id. Keys history; never sent to a thread store. */
  const threadId = ref<string>('');

  function newThreadId(): string {
    // randomUUID needs a secure context; every browser that can reach /chat
    // over HTTPS has it, but a fallback keeps local HTTP dev working.
    return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * NOTE: there is no `setMessages`. `useChat` exposes `messages` as a
   * ShallowRef you assign directly — `messages.value = [...]`. Destructuring a
   * `setMessages` that does not exist threw "setMessages is not a function" and
   * 500'd /chat on any visit that restored a conversation. It went unnoticed
   * because the return value had been cast to `any`; the cast is gone, so the
   * compiler catches this class of mistake now.
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
   */
  const REQUEST_MESSAGE_WINDOW = 24;

  const { messages, status, error, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // A getter, so locale and page are read at SEND time rather than frozen
      // when the transport was constructed.
      body: () => ({
        locale: locale.value,
        pageSlug: route.path,
        threadId: threadId.value,
      }),
      prepareSendMessagesRequest({ messages: outgoing, body }) {
        return { body: { ...body, messages: outgoing.slice(-REQUEST_MESSAGE_WINDOW) } };
      },
    }),
    onError(err: Error) {
      console.error('[chat] request failed:', err);
    },
  });

  const isLoading = computed(() => status.value === 'submitted' || status.value === 'streaming');

  /**
   * The quota details when the last failure was a 429, else null.
   *
   * The transport puts the response body in the error's message, so the
   * structured 429 the route sends survives the trip — see
   * `app/utils/chatQuotaError.ts` for why parsing it matters more than for a
   * normal error.
   */
  const quotaExhausted = computed(() => parseQuotaError(error.value));

  onMounted(() => {
    hasMounted.value = true;
    // Reads localStorage, so it must run after mount — same rule as
    // useRecentTools().load(); see CLAUDE.md.
    history.load();

    // Resume the most recent conversation, if there is one.
    const mostRecent = history.entries.value[0];
    if (mostRecent?.messages?.length) {
      threadId.value = mostRecent.threadId;
      messages.value = mostRecent.messages;
    } else {
      threadId.value = newThreadId();
    }

    nextTick(() => {
      composerRef.value?.focus();
      scrollToBottom(false);
      maybeAutoSubmit();
    });
  });

  const isChatEmpty = computed(() => {
    // Match the server-rendered welcome branch during hydration.
    if (!hasMounted.value) return true;
    return messages.value.length === 0;
  });

  /**
   * Links rail, built from search-shaped tool results in this conversation.
   *
   * Matched by result SHAPE rather than tool name. It was coupled to
   * `tavily_search` — a tool that lived in a different repo — so renaming it
   * would have emptied the rail with no error anywhere. Shape-matching means
   * `site-search` populates it without a second code path.
   */
  const MAX_USEFUL_LINKS = 5;

  interface UsefulLink {
    url: string;
    title: string;
    content: string;
    score: number;
  }

  const usefulLinks = computed<UsefulLink[]>(() => {
    const links: UsefulLink[] = [];

    for (const message of messages.value as UIMessage[]) {
      for (const part of message.parts ?? []) {
        // Tool parts are typed `tool-<name>`; the payload lands on `output`
        // once the call resolves.
        const output = (part as any).output;
        if (!output || !Array.isArray(output.results)) continue;

        output.results.forEach((result: any, index: number) => {
          if (!result || typeof result.url !== 'string' || typeof result.title !== 'string') return;
          links.push({
            url: result.url,
            title: result.title,
            content: typeof result.summary === 'string' ? result.summary : (result.content ?? ''),
            // Descending fallback preserves a tool's own ordering when it
            // reports no score. Below 1, so a real score always outranks it.
            score: typeof result.score === 'number' ? result.score : 1 / (index + 2),
          });
        });
      }
    }

    return links.sort((a, b) => b.score - a.score).slice(0, MAX_USEFUL_LINKS);
  });

  /** Only until the first token — after that the streaming cursor is the signal. */
  const showThinkingIndicator = computed(() => {
    if (!isLoading.value) return false;
    const last = messages.value[messages.value.length - 1] as UIMessage | undefined;
    if (!last || last.role !== 'assistant') return true;
    const text = (last.parts ?? [])
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => part.text)
      .join('');
    return text.trim().length === 0;
  });

  const { capture } = usePostHog();
  const { track } = useAnalytics();

  function messageText(message: UIMessage | undefined): string {
    if (!message) return '';
    return (message.parts ?? [])
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => part.text)
      .join(' ');
  }

  /**
   * Persist the conversation, and keep the transcript scrolled.
   *
   * ONE deep watcher, not two: `messages` grows by a token at a time while
   * streaming, and a deep watcher walks the whole transcript on every change,
   * so a second one doubles that traversal on the hottest path in the component.
   *
   * The write is DEBOUNCED, which is the load-bearing part. `history.record()`
   * serialises every stored conversation and calls `localStorage.setItem`
   * synchronously on the main thread; a measured answer streamed 299 chunks, so
   * writing per token meant ~300 megabyte-scale serialise-and-write cycles for a
   * single reply, and visible jank on a phone. Scrolling still runs every tick —
   * it is cheap and has to track the stream.
   *
   * It stays a watcher rather than a call after `sendMessage`, because that
   * promise resolves when the stream closes: recording only there loses the
   * conversation if the visitor navigates away mid-answer. The flush on unmount
   * below covers the debounce window for the same reason.
   */
  const PERSIST_DEBOUNCE_MS = 500;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function persistNow() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const current = messages.value as UIMessage[];
    if (!hasMounted.value || !threadId.value || current.length === 0) return;
    const firstUser = current.find((message) => message.role === 'user');
    const title = history.deriveTitle(messageText(firstUser));
    history.record(threadId.value, { title, messages: current });
  }

  /**
   * Upload the conversation. Separate from the local write on purpose.
   *
   * The local write has to be frequent — it is what survives a crash or a
   * navigation mid-answer. The network push does not: pushing on the same
   * debounce meant a multi-step tool run, whose pauses exceed the debounce
   * while a tool executes, uploaded the whole growing transcript two or three
   * times per answer, each upload immediately superseded by the next.
   *
   * Fire-and-forget. The local copy is the working one, so a failed push costs
   * sync rather than the conversation — useChatSync swallows its own errors.
   */
  function pushNow() {
    const current = messages.value as UIMessage[];
    if (!syncEnabled.value || !threadId.value || current.length === 0) return;
    const firstUser = current.find((message) => message.role === 'user');
    void sync.push(threadId.value, history.deriveTitle(messageText(firstUser)), current);
  }

  // Once the stream closes, and once when the visitor leaves mid-answer.
  watch(isLoading, (loading, wasLoading) => {
    if (wasLoading && !loading) pushNow();
  });

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
  }

  watch(
    messages,
    () => {
      schedulePersist();
      nextTick(() => {
        if (messagesContainer.value && !showScrollButton.value) scrollToBottom(false);
      });
    },
    { deep: true }
  );

  // A pending debounce must not lose the last tokens of an answer when the
  // visitor navigates away the moment it finishes.
  onBeforeUnmount(() => {
    persistNow();
    pushNow();
  });

  // Same reason, for a tab close or reload, which unmounts nothing.
  // `keepalive` on the sync request is what lets the push actually leave the
  // browser here; an ordinary fetch is cancelled by the unload.
  const flushAll = () => {
    persistNow();
    pushNow();
  };
  onMounted(() => {
    window.addEventListener('pagehide', flushAll);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', flushAll);
  });

  async function handleSubmit() {
    const text = input.value.trim();
    if (!text || isLoading.value) return;

    capture('chat_message_sent', {
      message_length: text.length,
      is_first_message: messages.value.length === 0,
    });

    input.value = '';
    // Explicit, because the composer's watcher can be skipped on this path: a
    // starter sets the value and this clears it, and if both land in one flush
    // Vue sees no net change and never fires the callback, leaving the field
    // stuck at the height it measured for the prompt.
    nextTick(() => composerRef.value?.resize());

    await sendMessage({ text });
  }

  async function handleSelectThread(id: string) {
    if (id === threadId.value) {
      historyOpen.value = false;
      return;
    }
    track('chat_history_thread_opened');
    historyOpen.value = false;
    input.value = '';
    stop();
    threadId.value = id;

    const local = history.getMessages(id);
    if (local.length > 0) {
      messages.value = local;
    } else if (syncEnabled.value) {
      // A conversation from another device: the list carries its title but not
      // its transcript, so fetch it now rather than shipping twenty of them to
      // render a list.
      messages.value = [];
      const remote = await sync.pullThread(id);
      // Guard against a slow fetch landing after the user moved on again.
      if (remote && threadId.value === id) messages.value = remote;
    } else {
      messages.value = [];
    }

    nextTick(() => scrollToBottom(false));
  }

  function handleRemoveThread(id: string) {
    history.remove(id);
    // A delete that only removes the local copy would resurrect the
    // conversation on the next pull, which reads as the delete not working.
    if (syncEnabled.value) void sync.remove(id);
    // Removing the conversation you are in also ends it, otherwise the composer
    // would keep appending to one no longer listed.
    if (threadId.value === id) handleNewChat();
  }

  function handleClearHistory() {
    history.clear();
    if (syncEnabled.value) void sync.clear();
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
    track('chat_new_conversation');
    stop();
    messages.value = [];
    threadId.value = newThreadId();
    input.value = '';
    showScrollButton.value = false;
    nextTick(() => {
      composerRef.value?.resize();
      composerRef.value?.focus();
    });
  }

  function stopGeneration() {
    stop();
  }

  function scrollToBottom(fromButton = false) {
    if (fromButton) track('chat_scroll_to_bottom');
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  }

  function handleScroll() {
    if (!messagesContainer.value) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
    showScrollButton.value = scrollHeight - scrollTop - clientHeight >= 100;
  }

  /** `/chat?message=…` from FloatingChatInput. Runs once, after mount. */
  const hasAutoSubmitted = ref(false);

  function maybeAutoSubmit() {
    if (hasAutoSubmitted.value) return;
    const queryMessage = route.query.message;
    if (typeof queryMessage !== 'string' || !queryMessage.trim()) return;
    hasAutoSubmitted.value = true;
    // A query message starts a NEW conversation rather than appending to the
    // one just restored from history, which is what a visitor arriving from the
    // floating input expects.
    if (messages.value.length > 0) {
      messages.value = [];
      threadId.value = newThreadId();
    }
    input.value = queryMessage.trim();
    nextTick(() => handleSubmit());
  }
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
    "history": "History",
    "request_failed": "Something went wrong sending that. Please try again."
  },
  "es": {
    "assistant_name": "Asistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Desplazar al final",
    "sr_generating": "Generando una respuesta",
    "useful_links_region": "Enlaces útiles",
    "useful_links_placeholder": "Los enlaces aparecen aquí cuando busco algo",
    "history": "Historial",
    "request_failed": "Algo salió mal al enviar eso. Inténtalo de nuevo."
  },
  "fr": {
    "assistant_name": "Assistant CMDIY",
    "beta": "Bêta",
    "scroll_to_bottom": "Défiler vers le bas",
    "sr_generating": "Génération d'une réponse",
    "useful_links_region": "Liens utiles",
    "useful_links_placeholder": "Les liens apparaissent ici quand je fais une recherche",
    "history": "Historique",
    "request_failed": "Une erreur s'est produite lors de l'envoi. Veuillez réessayer."
  },
  "de": {
    "assistant_name": "CMDIY Assistent",
    "beta": "Beta",
    "scroll_to_bottom": "Nach unten scrollen",
    "sr_generating": "Antwort wird erzeugt",
    "useful_links_region": "Nützliche Links",
    "useful_links_placeholder": "Links erscheinen hier, wenn ich etwas suche",
    "history": "Verlauf",
    "request_failed": "Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut."
  },
  "it": {
    "assistant_name": "Assistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Scorri in basso",
    "sr_generating": "Generazione di una risposta",
    "useful_links_region": "Link utili",
    "useful_links_placeholder": "I link appaiono qui quando cerco qualcosa",
    "history": "Cronologia",
    "request_failed": "Si è verificato un errore durante l'invio. Riprova."
  },
  "pt": {
    "assistant_name": "Assistente CMDIY",
    "beta": "Beta",
    "scroll_to_bottom": "Rolar para baixo",
    "sr_generating": "Gerando uma resposta",
    "useful_links_region": "Links úteis",
    "useful_links_placeholder": "Os links aparecem aqui quando eu pesquiso algo",
    "history": "Histórico",
    "request_failed": "Algo deu errado ao enviar. Tente novamente."
  },
  "ru": {
    "assistant_name": "Помощник CMDIY",
    "beta": "Бета",
    "scroll_to_bottom": "Прокрутить вниз",
    "sr_generating": "Формируется ответ",
    "useful_links_region": "Полезные ссылки",
    "useful_links_placeholder": "Ссылки появятся здесь, когда я что-то найду",
    "history": "История",
    "request_failed": "Не удалось отправить сообщение. Попробуйте ещё раз."
  },
  "ja": {
    "assistant_name": "CMDIYアシスタント",
    "beta": "ベータ",
    "scroll_to_bottom": "下までスクロール",
    "sr_generating": "回答を生成しています",
    "useful_links_region": "有用なリンク",
    "useful_links_placeholder": "検索するとここにリンクが表示されます",
    "history": "履歴",
    "request_failed": "送信中に問題が発生しました。もう一度お試しください。"
  },
  "zh": {
    "assistant_name": "CMDIY助手",
    "beta": "测试版",
    "scroll_to_bottom": "滚动到底部",
    "sr_generating": "正在生成回复",
    "useful_links_region": "有用链接",
    "useful_links_placeholder": "当我搜索时，链接会显示在这里",
    "history": "历史记录",
    "request_failed": "发送时出现问题，请重试。"
  },
  "ko": {
    "assistant_name": "CMDIY 어시스턴트",
    "beta": "베타",
    "scroll_to_bottom": "맨 아래로 스크롤",
    "sr_generating": "응답을 생성하는 중",
    "useful_links_region": "유용한 링크",
    "useful_links_placeholder": "검색하면 여기에 링크가 표시됩니다",
    "history": "기록",
    "request_failed": "전송 중 문제가 발생했습니다. 다시 시도해 주세요."
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
