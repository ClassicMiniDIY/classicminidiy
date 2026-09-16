# `/chat` hydration and shell invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02. The enforced contract lives in `.claude/rules/security.md`; this file keeps the reasoning.

## AI-Powered Features (`app/chat`)

- **CMDIY Assistant** - LangGraph-powered conversational AI with context awareness
- **Model Context Protocol (MCP) Server** - AI integration with calculators and tools
- **Streaming Responses** - Real-time AI chat with persistent conversation threads
- **Hydration invariant**: `/chat` is SSR'd and the server always renders the empty/welcome branch. Stored conversations live in localStorage (`useChatHistory`), so nothing may branch the template on them until after `onMounted` (see the `hasMounted` gate in `ChatWindow.vue`) — otherwise refreshing with a saved conversation causes a structural hydration mismatch that corrupts the page DOM. The rule got STRICTER at the 2026-08-31 cutover, not looser: the transcript itself is client-owned now, so more of the page depends on state the server cannot see. `useChatHistory.load()` and the conversation restore both run in `onMounted`, never during setup.

- **`/chat`'s full-height shell is CSS-only, keyed off `.chat-shell` with `:has()` in
  `app/assets/css/main.css` — never `useHead({ bodyAttrs })`.** Setting body attributes from
  that page's head made `nuxt-schema-org` throw during SSR on a cold dev server (`Cannot read
properties of undefined (reading 'webSiteResolver')` out of its resolver preload) and 500 the
  route until the module warmed up. Measured at 3 failures per cold boot with `bodyAttrs` and 0
  without, while `/` and `/technical/needles` stayed clean either way — the same
  `nuxt-schema-org` fragility as the Nuxt 4.5 pin note. Keep the shell out of the head pipeline.

## Native client contract (2026-09-16)

The Toolbox apps (iOS, Android) call `/api/chat` directly with a Supabase JWT rather than
through an Edge Function, because the Worker already holds the tools, the key, the tier gate
and the quota. Three things were added for them and each has a reason worth keeping:

- `x-cmdiy-client` and `entryPoint` exist so app spend and per-screen usage are visible on
  `chat_run_completed`. They ride through `createChatRunTracker` and not the `finish` extra bag
  because an abandoned run never reaches `onFinish`; carried only there, every app abandonment
  would be counted as a web abandonment. The entry-point field is `entry_point`, never `source`:
  the apps register `source` as their PostHog super property and a same-named event property
  would overwrite it.
- `chat_quota_refused` exists because the 429 is thrown before the run tracker starts, so a
  refusal used to emit nothing and the "refused → membership" conversion had no numerator.
- The `abortSignal` wiring: `streamText` only runs `onAbort` when its signal fires, and before
  this nothing fired it. A visitor pressing stop left the model running to completion on the
  Worker's clock, recorded as `completed`, and `client_disconnect` was a permanent zero. Two
  sources feed one controller: the Cloudflare `Request.signal` (production) and the Node
  response `close` event guarded by `writableFinished === false` (dev). Verified in PostHog
  from a dev run; the Workers path should be confirmed by reading `client_disconnect` counts
  after the first deploy. Aborted runs record the finished steps' tokens from `onAbort`'s
  `steps`, since `onFinish` does not run for them.
- The recorded stream fixtures are produced through the real `streamText →
toUIMessageStreamResponse()` pipeline with a scripted model, not a live recording: the bytes
  are deterministic and the two failure cases can be produced on demand. Two facts they pin
  that the design doc's wording did not: `error` is followed by `finish-step` and `finish`
  (`finishReason: "error"`), and a rejected tool input is stored as `rawInput`, not `input`.
