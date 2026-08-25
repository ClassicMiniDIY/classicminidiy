# Chat UI Refresh — Audit and Plan

**Date:** 2026-08-25
**Surface:** `/chat` (CMDIY Assistant)
**Goal:** Restructure the chat interface along modern AI-assistant lines (Claude Chat as the
reference model) while keeping every existing capability. Produce a forward-looking audit of
what the assistant should gain next.

---

## 1. What exists today

| Piece            | File                                                  | Notes                                                               |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Page shell       | `app/pages/chat.vue`                                  | H1 + description, then a fixed-height box holding the window        |
| Chat window      | `app/components/Chat/ChatWindow.vue`                  | 622 lines; empty state, message list, composer, sidebar, disclaimer |
| Assistant bubble | `app/components/Chat/AssistantMessage.vue`            | Unstyled block, hover copy button                                   |
| User bubble      | `app/components/Chat/HumanMessage.vue`                | Right-aligned primary pill                                          |
| Markdown         | `app/components/Chat/MarkdownText.vue`                | `marked` + `highlight.js`, token fade-in, UTM rewriting on links    |
| Citations        | `Chat/UsefulLinks.vue`, `Chat/UsefulLinksSidebar.vue` | Tavily results, mobile inline / desktop right rail                  |
| Home entry point | `app/components/FloatingChatInput.vue`                | Fixed bottom-right box on `/`, routes to `/chat?message=`           |
| Transport        | `app/composables/useStreamProvider.ts`                | Hand-rolled SSE reader against `/api/langgraph`                     |
| Thread memory    | `app/composables/usePersistentThread.ts`              | One thread id in `localStorage`, 24h expiry                         |

Backend is a LangGraph deployment proxied through `server/api/langgraph/**`, intentionally
unauthenticated and rate limited per IP. Threads live server-side — `/api/langgraph/threads`
already lists them, and `/admin/threads` browses them.

---

## 2. Defects found

Verified in a running dev server at 1280x720 and 375x812.

### 2.1 Structural

1. **The page scrolls and the chat scrolls.** `chat.vue` wraps the window in
   `h-[calc(100vh-200px)] min-h-[600px]` inside a normal document flow. Document height is
   1149px against a 720px viewport, so the browser scrolls the whole page _and_ the message
   list scrolls inside it. Two scrollbars, and the site nav slides away mid-conversation.
2. **First paint jumps.** `onMounted` focuses the textarea. Because the page is taller than
   the viewport, focusing scrolls the document down — the user lands on a page whose header
   and nav have already scrolled off, with a band of empty space above. This is the single
   worst first impression on the surface.
3. **The composer is duplicated.** The identical textarea, send button and stop button are
   written twice — once in the empty branch, once in the conversation branch. Any composer
   change has to be made in both places or they drift.
4. **`isChatEmpty` swaps the whole layout.** The empty and conversation states are separate
   subtrees rather than one shell with a changing middle. That is why the composer had to be
   duplicated, and why the transition from empty to first message is a hard jump.

### 2.2 Mobile

5. **Message content overflows horizontally at 375px.** Assistant paragraphs and list items
   are clipped on the right edge ("You might fin", "It's just \$"). The `break-words` rules in
   the scoped style do not reach the markdown subtree, and the message column has no
   `min-w-0`.
6. **The disclaimer alert consumes roughly a fifth of a phone screen**, permanently, below the
   composer — a static legal notice given more pixels than the answer.
7. **The scroll-to-bottom button floats over message text** rather than over the composer,
   because it is positioned against a container whose right offset assumes the desktop rail.

### 2.3 Message rendering

8. **Streamed replies split into two blocks.** The first reply rendered as "I don", a
   paragraph break, then "'t have specific information…".

   The transport is not at fault — captured SSE shows `messages/partial` is _cumulative_ and
   carries a stable id, so the message updates in place correctly. The split is in
   `MarkdownText.vue`, which kept the message as two pieces: "settled" content parsed with
   `marked.parse()` (block level, so `"I don"` became `<p>I don</p>`) plus a tail of new
   words parsed with `marked.parseInline()` and rendered as sibling spans. Any chunk boundary
   landing mid-word therefore closed a paragraph in the middle of a word.

9. **Assistant replies have no visual identity.** No avatar, no role label, no container —
   the text simply starts at the left margin. Against a right-aligned solid user pill, the
   conversation reads lopsided.
10. **The hover action row is always in the layout**, at `opacity-0`. It reserves vertical
    space under every message, adds an invisible 24px gap between turns, and is unreachable on
    touch devices, where there is no hover.
11. **The typing indicator is a full-width pill placed after the streaming text**, so during a
    reply the user sees the answer and then a loading bar underneath it.
12. **`HumanMessage` hardcodes `text-white`** instead of `text-primary-content`, so the pill
    can fail contrast under a theme whose primary is light.

### 2.4 Content and i18n

13. **The welcome paragraph is hardcoded English** in the template
    (`ChatWindow.vue:19-22`), while the heading beside it goes through `t()`. Nine locales
    get an English body under a translated title. The same applies to the second half of the
    disclaimer sentence (`ChatWindow.vue:167-168`).
14. **The "Report an issue" link has a stray envelope icon outside the anchor**, so the icon
    is not part of the click target and reads as loose punctuation.
15. **No conversation starters.** The empty state explains what the assistant can do in prose
    and then asks the user to compose a question from scratch. Every current assistant offers
    tappable examples instead, and they double as capability disclosure.

### 2.5 Accessibility

16. The message list is not a live region, so a screen reader is never told a reply arrived.
17. The scroll container is not focusable and has no accessible name, so keyboard users cannot
    scroll the transcript without a pointer.
18. Copy actions give no confirmation — no toast, no label swap — even though `useToast()`
    exists in the codebase.

### 2.6 Styling that was silently dead

Three separate sets of class and variable names in the chat components resolve to nothing.
None of them fail loudly; they just render as unstyled markup, which is a large part of why
the surface looked unfinished.

19. **`bg-default`, `border-default`, `bg-muted`, `text-muted`** in `UsefulLinks.vue` and
    `UsefulLinksSidebar.vue` are Nuxt UI semantic classes. `@nuxt/ui` was removed in
    `3c6d6125` and nothing in `main.css` defines them, so those source cards had no
    background, no border, and no muted text.
20. **`hsl(var(--bc))`, `hsl(var(--p))`, `hsl(var(--b2))`, `hsl(var(--b3))`, `hsl(var(--pf))`**
    throughout `MarkdownText.vue`'s stylesheet are daisyUI **4** variable names. daisyUI 5
    uses `--color-base-content`, `--color-primary`, … in OKLCH, so every colour, border and
    code background in that stylesheet was being dropped by the parser: inline code had no
    background, tables and blockquotes no borders, links no primary colour.
21. `MarkdownText.vue` renders assistant output — which includes text pulled from arbitrary
    web pages by the search tool — through `v-html` with **no sanitisation**. `dompurify` is
    already a pinned dependency used by the marketplace renderer.

### 2.7 State and transport

22. **Only one conversation is remembered, for 24 hours, in `localStorage`.** LangGraph is
    already storing every thread server-side and the API to list them exists. Users lose their
    history on expiry, on clearing site data, and on every other device.
23. **`stop()` only flips `isLoading` to false.** The `fetch` is never aborted, so the stream
    keeps arriving and keeps mutating `messages` after the user pressed stop. There is no
    `AbortController`.
24. **Errors render as a fake assistant message** ("I encountered an error: …") pushed into the
    transcript as if the assistant said it. There is no retry affordance.
25. **`process.client` / `process.dev`** are the deprecated Nuxt 2 globals. `process.dev` in
    `useStreamProvider.ts` is now `import.meta.dev`. **`process.client` in
    `usePersistentThread.ts` is staying**, deliberately: the vitest plugin in
    `vitest.config.ts` rewrites `import.meta.client` to the literal `(true)`, so the SSR-guard
    test — which simulates the server by setting `process.client = false`, and which protects
    the chat hydration invariant — cannot express itself against `import.meta.client`. The
    file now carries a comment saying so.

---

## 3. Target structure — Claude Chat as the model

What is worth copying from Claude's interface, and why:

| Trait                                                 | Why it matters here                                 |
| ----------------------------------------------------- | --------------------------------------------------- |
| Full-height app shell, one scroll region              | Removes the double scrollbar and the focus jump     |
| Single centred reading column, ~48rem                 | Long technical answers need a measured line length  |
| Assistant text unboxed, user turn in a soft pill      | Puts the weight on the answer, not on chrome        |
| Persistent composer pinned to the bottom              | The composer never moves between empty and active   |
| Empty state = greeting + composer + starters          | One focal point instead of a card stacked on a form |
| Actions appear on hover _and_ stay reachable on touch | Copy, retry, feedback without a hover dependency    |
| Citations attached under the message that used them   | Sources belong to a claim, not to a side rail       |
| Left rail for conversation history                    | Only worth adding once history is real (see §4)     |

Concretely, the rebuilt shell is:

```
┌─ header: title, new-chat, (history) ────────────┐
│                                                 │
│   ┌── scroll region (the only one) ──────────┐  │
│   │   centred column, max-w-3xl              │  │
│   │   turns; citations under the turn         │  │
│   └───────────────────────────────────────────┘  │
│   ┌── composer, pinned ───────────────────────┐  │
│   │   textarea + send/stop + hint             │  │
│   └───────────────────────────────────────────┘  │
│   one-line disclaimer                            │
└─────────────────────────────────────────────────┘
```

The disclaimer drops from a yellow alert block to a single muted line under the composer —
the placement every mainstream assistant uses, and the one that stops it from outweighing the
content on a phone.

---

## 4. What this change ships

Structure, per the decisions taken on 2026-08-25:

- **`/chat` is a full-height app surface.** The page root carries `.chat-shell`, and the
  rules in `app/assets/css/main.css` key off it with `:has()` to turn the app wrapper into a
  flex column, remove the document scroll and hide the site footer. The transcript is the only
  scroll region. Fixes defects 1, 2 and 7.

  **This must not go back to `useHead({ bodyAttrs })`.** That was the first implementation and
  it made `nuxt-schema-org` throw during SSR on a cold dev server — `Cannot read properties of
undefined (reading 'webSiteResolver')` from its resolver preload — 500ing `/chat` until the
  module warmed up. Measured by hammering a freshly booted dev server: 3 failures per cold
  boot with `bodyAttrs` set, 0 without it, and 0 on `/` and `/technical/needles` either way.
  Same failure family as the Nuxt 4.5 / `nuxt-schema-org` breakage in the dependency-pin
  notes. A plain class keeps the shell out of the head pipeline entirely.

- **One composer, one shell.** New `Chat/ChatComposer.vue` is the single instance, pinned
  below the transcript in both states, with the control row _inside_ it — New chat and Report
  an issue on the left, keyboard hint and send/stop on the right. Fixes 3, 4 and 14.
- **New `Chat/ChatEmptyState.vue`** — greeting, translated body copy, and four conversation
  starters aimed at real tools (chassis, needles, torque, gearing). Fixes 13 and 15.
- **New chat actually exists.** `createStreamSession()` gained `reset()`, which the composer's
  New chat button drives. It is a method on the session rather than a rebuild of it, because
  `provideStreamContext()` may only run during setup.
- **The disclaimer is one muted line under the composer**, not a yellow alert block. Fixes 6.
- **Sources stay in a right rail on desktop, inline below `lg`.** Both `UsefulLinks.vue` and
  `UsefulLinksSidebar.vue` are restyled onto daisyUI tokens, fixing 19 and the desktop half
  of 5.

  This reverses an earlier decision in this branch. The rail was first removed in favour of
  Claude's citations-under-the-answer pattern, but the rail is the better fit here: it keeps
  the conversation in frame and states visually that the links are supplementary rather than
  part of the reply. The rail is deliberately rendered even when empty, so the reading column
  keeps a constant width and nothing reflows mid-answer when a search returns.

- **`MarkdownText.vue` parses the whole message in one pass.** The settled/animated split —
  and with it the per-token stagger animation — is removed, which is what caused the mid-word
  paragraph break. The caret is now a pseudo-element on the last block so it sits at the end
  of the final word instead of on its own line. The stylesheet moves to daisyUI 5 variables,
  and output is sanitised with DOMPurify. Fixes 8, 20 and 21.
- **Turn structure.** Assistant replies get an avatar and stay unboxed; the user turn keeps the
  brand pill but uses `text-primary-content`. Action rows are hover-revealed from `sm` up and
  permanently visible below it, so they are reachable on touch. Copy confirms with a label
  swap. Fixes 9, 10, 12 and 18.
- **The thinking indicator only shows before the first token** and no longer sits beneath a
  half-written reply. Fixes 11.
- **`stop()` aborts the run.** An `AbortController` per submit; aborting is not reported as an
  error. Fixes 23.
- **Accessibility.** An `sr-only` `role="status"` region announces generation state without
  reading every streamed token; `role="log"` on the transcript; the composer textarea has a
  real label; icons are `aria-hidden`; icon-only buttons keep `sr-only` text below `sm`.
  Fixes 16, and the announcement half of 17.

Verified against a dev server at 1280x720 and 375x812, in both themes: no document scroll
(`scrollHeight === innerHeight`), no horizontal overflow at 375px
(`scrollWidth === innerWidth`), streaming renders as one block, New chat resets to the empty
state. `bun run test` — 4864 passed. `bun run build` — clean.

Not addressed here, and still open from §2: 17 (transcript not keyboard-focusable) and
24 (errors as fake assistant turns). Item 22 is now partly addressed — see the local chat
history note in §5.

A related defect found later and fixed: a persisted thread id the API rejects (404/410/422)
was retried on every page load forever, because `loadThreadHistory()` only warned. The
session now raises `threadMissing`, and the window drops the id from both the current-thread
slot and local history. The 422s that surfaced this were actually the unit suite leaking real
network calls — `fetch` was unstubbed in `tests/setup/vitest.setup.ts`, so a fixture thread id
was proxied to the live LangGraph deployment whenever the suite ran alongside a dev server.
`fetch` is now stubbed globally.

---

## 5. Forward-looking improvements

Ordered by value against effort. None of these are required for the visual refresh.

### Near term

- ~~**Real conversation history.**~~ **Shipped (local).** `useChatHistory` keeps a list of
  thread ids in localStorage (max 20, dropped after 30 days) and the header's History dialog
  reopens any of them — the threads themselves were already server-side in LangGraph, so this
  needed no schema work. It is per-browser only: clearing site data, another browser or
  another device all start empty. Making it durable and cross-device is the "signed-in
  memory" item below, and would mean storing the id list against the profile.
- **Abort the stream on stop.** An `AbortController` per submit; `stop()` aborts it. Fixes
  defect 21.
- **Error turns as errors.** A dedicated error state with a Retry button that resubmits the
  last user turn, instead of a counterfeit assistant message.
- **Conversation starters.** Four to six seeded prompts on the empty state, drawn from the real
  toolbox surfaces (chassis decode, needle choice, torque lookup, gearing). Doubles as
  capability disclosure and as an analytics signal about intent.
- **Tool-call transparency.** The assistant already calls tools (Tavily search, and the MCP
  calculators). Showing a collapsed "Searched the archive" / "Ran the compression calculator"
  row while it happens is both reassuring and a differentiator no general assistant can match.

### Medium term

- **Deep links into the site.** When the assistant decodes a chassis number or computes a gear
  ratio, the answer should end in a link to the tool with the values pre-filled. This is the
  strongest argument for a site-specific assistant over a general one.
- **Message feedback.** Thumbs up/down per reply, written to PostHog with the thread id. This
  is the only way to know whether answers are actually good, and it feeds prompt iteration.
- **Attachments.** A photo of a part, a carb, a wiring loom, or a log file is the most natural
  input in this domain and the assistant cannot accept one today.
- **Continue-from-a-page.** The composer already sends `pageSlug` in metadata. An "Ask about
  this page" affordance on archive and technical pages would use it properly.

### Longer term

- **Signed-in memory.** Vehicles are already modelled in Supabase; an assistant that knows the
  user runs a 1275 with an HIF44 answers better on the first try.
- **Voice input** for the garage case, where hands are dirty and typing is not happening.
- **Shareable transcripts.** A read-only permalink for a good answer, which is also an SEO and
  GEO surface if it renders server-side.

---

## 6. Notes for later

- **`/sw.js` 404 noise in dev is not a chat bug.** `@vite-pwa/nuxt` has no `devOptions`, so no
  service worker is generated by `nuxi dev`, while a browser that registered the production
  worker keeps polling `/sw.js`. That request fell through to the catch-all page, which
  correctly 404s but printed a fatal stack trace every few seconds and buried real errors.
  `server/middleware/dev-service-worker-404.ts` answers those paths directly, gated on
  `import.meta.dev` so production still serves the real worker from static output.

---

## 7. Non-goals

- No change to the LangGraph graph, prompts, or tool set.
- No authentication on `/chat` — the assistant stays open to anonymous visitors, per the
  security invariant in `CLAUDE.md`.
- No new icon library; Font Awesome 6 class form only.
- No component library beyond daisyUI 5.
