# Unified search, phase 2 — the bot answers beside the results

Status: implemented on `feature/unified-search-phase-2` (2026-09-15). Branch `feature/unified-search-phase-2`.
Follows `docs/plans/2026-09-14-unified-search.md`, whose phase 1 shipped on
2026-09-15 (#849, #850, #851, `classicminidiy-supabase#117`). Phase 1 made the
Ask row hand a question to `/chat`. Phase 2 answers it on `/search`, beside the
results the visitor came for.

## Decisions (interview, 2026-09-15)

| Question                       | Decision                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ |
| When the answer starts         | On click of the Ask row only. No model call and no quota until asked.    |
| Where it lives                 | A sticky right panel on desktop; stacked above the results on mobile.    |
| Follow-ups                     | One answer, then "Continue in chat", which opens `/chat` on that thread. |
| What the panel shows           | Answer text, the video rail, the useful-links rail. No store products.   |
| Quota spent                    | The Ask row's phase-1 copy handles it; the panel never opens at limit.   |
| On-site video pages            | Descoped. Video cards link to YouTube, as on `/chat`.                    |
| Model-backed intent classifier | Descoped. Heuristics stay; revisit only if the 30-day numbers demand it. |

The palette is unchanged: it still hands off to `/chat`. The palette is 640px
and modal; an answer with two rails does not fit it, and the page is one
keystroke away.

## The model

`/search?q=how do i bleed the brakes` renders as in phase 1: the Ask row, the
answer cards, the results. Selecting the Ask row on the page no longer
navigates. The row becomes the header of a panel that opens beside the results
and streams the bot's answer to the query, followed by the videos and links
its tools found. One button under the answer, "Continue in chat", carries the
thread to `/chat`. The results column is untouched throughout: the visitor
reads the answer and the list side by side.

## What gets built

### 1. The stream, lifted out of `ChatWindow.vue` — `app/composables/useChatAnswer.ts`

`ChatWindow.vue` owns one `useChat()` call with a `DefaultChatTransport` to
`/api/chat`, a windowed `prepareSendMessagesRequest`, and two pure reducers over
the messages: `selectRailVideos` (already in `app/utils/chatVideoRail.ts`) and
the useful-links reducer (inline in the component today). The composable takes
the transport and the reducers and leaves the shell:

```ts
export function useChatAnswer(options: { threadId: Ref<string>; pageSlug: () => string }) {
  // useChat + DefaultChatTransport + windowTranscript, verbatim from ChatWindow.vue
  return { messages, status, error, isLoading, sendMessage, stop, videos, usefulLinks, quotaError };
}
```

`ChatWindow.vue` switches to it in the same PR, so there is one transport
definition, not two. The useful-links reducer moves to
`app/utils/chatUsefulLinks.ts` as a pure function with a unit test, like the
video rail. `quotaError` is `parseQuotaError(error)`, already a pure function.

Every rule in `.claude/rules/security.md` about `/chat` hydration holds for the
composable: it is called during setup (it calls `useI18n` through `useChat`'s
locale getter), and nothing branches on its state before `hasMounted`.

### 2. The panel — `app/components/search/AnswerPanel.vue`

Props: `query`. Owns one `useChatAnswer` with a fresh `threadId` per open.
Renders, top to bottom:

1. A header: the bot icon, "DIY Mini Bot", the query in quotes, a close
   button.
2. `<ChatAssistantMessage>` for the streaming answer, with the existing
   thinking indicator until the first token.
3. `<ChatVideoResults variant="inline">` when the rail is non-empty.
4. `<ChatUsefulLinks>` when non-empty.
5. A footer: "Continue in chat" (primary) and "Done" (closes the panel).

Error states: a 429 cannot happen here (the row does not open the panel at
limit, and the peek guards it), but a stale peek can be wrong, so the panel
handles `quotaError` by closing and handing the route's verdict to the page,
which seeds the row's quota state from it — not by re-peeking, since a peek
that failed once can fail again and the row would offer the bot twice. Any other error renders `/chat`'s "Something went wrong" copy
with a retry.

Layout: on `lg+` the results column keeps `max-w-[900px]` and the panel sits
in a sticky `aside` to its right (`top-20`, own scroll). Below `lg` the panel
renders above the results, full width, not sticky. The panel is client-only
by construction: it mounts only after a click, so SSR never renders it and no
`hasMounted` gate is needed on the page.

### 3. The Ask row on `/search` opens the panel

`SearchAskRow` gains an optional `inline` prop. With it, selecting the row in
the `available` state emits `ask` instead of routing; the page opens the
panel and calls `sendMessage({ text: query })` once. The spent states keep
their phase-1 targets. The palette does not pass `inline`, so its behaviour is
unchanged. `askBot` in `useOmnisearch` grows a `{ inline: true }` option that
tracks and returns without navigating.

### 4. "Continue in chat"

`/chat` resumes `useChatHistory().entries[0]` on mount. So the button is:

```ts
history.record(threadId, { title: query, messages });
router.push({ path: '/chat', query: { source: 'search-panel' } });
```

No `?message=`: the thread already holds the question and the answer, and an
auto-submit would send it twice. `chat_message_sent.source` gains
`search-panel` in its allowlist.

Members' synced history (`useChatSync`) picks the thread up the same way it
picks up any recorded entry; nothing new.

### 5. Analytics

| Event                     | Properties                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `search_answer_opened`    | `query_length` (`kind` and `results` are already on `omnisearch_ask_selected`, which fires first with `inline: true`) |
| `search_answer_completed` | `videos`, `links`, `chars`                                                                                            |
| `search_answer_continued` | (none)                                                                                                                |
| `search_answer_closed`    | `completed` (bool)                                                                                                    |

`omnisearch_ask_selected` keeps firing from the row with `inline: true`.

## Not in this change

- The palette answering inline. It hands off to `/chat`.
- A composer in the panel. One answer, then `/chat`.
- Store products, degraded-tool notices, history dialog. `/chat` keeps them.
- On-site video pages; a model-backed classifier. Descoped on 2026-09-15.

## Test surface

| Test                                               | Checks                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/utils/chatUsefulLinks.test.ts`         | Reducer: score fallback ordering, cap, malformed results skipped                                                          |
| `tests/unit/composables/useChatAnswer.test.ts`     | Transport body carries locale, pageSlug, threadId; window applied                                                         |
| `tests/unit/components/search/AnswerPanel.test.ts` | Opens empty, renders answer + rails from a fixture transcript, continue records the thread and routes without `?message=` |
| `tests/static/hydration-auth-gates.test.ts`        | Existing; the panel is behind a click, never in SSR                                                                       |
| `tests/static/chat-route-contracts.test.ts`        | Existing; `/api/chat` untouched                                                                                           |
| i18n completeness                                  | Existing; ten locales in `AnswerPanel.vue`                                                                                |

## Success metrics

Read 30 days after deploy: share of `omnisearch_ask_selected` with
`inline: true` that reach `search_answer_completed` (target > 80%); share of
completed answers that continue to `/chat` (a low number is fine; it means the
answer sufficed); no change in `/chat` error rate after the transport lift.

## Implementation plan

One PR, three commits, each green on its own:

1. **Lift the stream.** `useChatAnswer.ts`, `chatUsefulLinks.ts`, `ChatWindow.vue`
   on the composable. Behaviour of `/chat` identical; the unit tests are the
   proof, plus a manual pass on `/chat`.
2. **The panel.** `AnswerPanel.vue`, the `inline` prop on `SearchAskRow`, the
   `/search` layout, "Continue in chat", ten locales.
3. **Analytics and docs.** Events, the `source` allowlist, `.claude/rules/`
   updates, this doc's status line.

Code Reviewer pass before the PR opens.
