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
