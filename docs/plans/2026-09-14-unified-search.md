# Unified search — one box, three tiers, no mode switch

Status: design + implementation plan. Branch `feature/unified-search`.
Follows `docs/plans/2026-09-04-chat-agent-knowledge-expansion.md`, which gave the
chat agent `site-search` and `video-search`. This change runs the same sources the
other way round: the search box gets the agent's data, and the agent becomes the
search box's last step instead of a separate product.

## The problem

Visitors do not understand why search and the DIY Mini Bot are two things. Several
have asked. The site presents two boxes with two behaviours, and the visitor has to
guess which one will answer before they type.

The last 30 days of PostHog say search is the surface people reach for, and that it
lets them down often:

| Signal                                | Count |
| ------------------------------------- | ----- |
| `omnisearch_opened`                   | 235   |
| `omnisearch_result_selected`          | 70    |
| `omnisearch_view_all`                 | 60    |
| `chat_message_sent`                   | 115   |
| `floating_chat_submitted` (home page) | 6     |

Search is opened three times as often as chat is used. About 45% of palette opens
end with no click. The homepage chat box is used six times a month.

`archive_search_misses` shows four kinds of miss. Three need no AI to fix:

| Kind                                   | Examples                                                | Fix                                  |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| Content exists, surface is not indexed | `brake bleeding`, `engine removal`, `12g940`, `pd16`    | Add videos, parts, suppliers         |
| Typo                                   | `fuel inection`, `themos`, `bagsport`                   | Trigram similarity, per-word ranking |
| Synonym gap                            | `comp ratio` → compression calculator                   | `searchTerms`, per-word matching     |
| Genuine question                       | `brake cylinder install`, `mini 1000cc 1980`, `haltech` | Hand to the bot                      |

The miss log itself is polluted. The 180ms debounce records every pause as a miss,
so `bad wo`, `bad wol` and `bad wolf` are three rows. `promote_search_miss` turns
those rows into public Most Wanted entries.

## Decisions (interview, 2026-09-14)

| Question                             | Decision                                                             |
| ------------------------------------ | -------------------------------------------------------------------- |
| Where the bot answers when escalated | Phase 1: hand off to `/chat`. Phase 2: inline panel on `/search`.    |
| How a query is classed as a question | Heuristics only. No model call on the free path.                     |
| Direct-answer cards                  | All four in phase 1: part, colour, chassis/engine, torque/clearance. |
| Bot row when quota is spent          | Row stays. Its action changes with the tier and the quota state.     |
| Ranking across eight surfaces        | Query-shaped surface order. Groups stay.                             |
| Where a video result lands           | YouTube, as an outbound link. No on-site video page in this change.  |
| Homepage `FloatingChatInput`         | Retired. The hero search box is the single entry.                    |

## The model

The visitor types into one box. They never choose a mode. The system answers in
three tiers, and only the third one costs anything.

1. **Instant.** Results and direct-answer cards from every surface, under 100ms, no
   AI. This is what the visitor sees while typing.
2. **Intent.** A heuristic reads the shape of the query and decides two things: which
   surface leads, and whether the "Ask DIY Mini Bot" row sits above or below the
   results. The row is always present. It is never the only option.
3. **The bot.** Only when the visitor selects the Ask row. The existing `/chat` page,
   quota and threads take over. Search never makes a model call.

## What gets built

### 1. Query analysis — `shared/utils/searchIntent.ts`

One pure function, shared by client and server so the palette and the API agree:

```ts
export type QueryKind = 'part-number' | 'colour-code' | 'chassis' | 'engine' | 'question' | 'lookup';

export interface SearchIntent {
  kind: QueryKind;
  /** Surface order for this query. First entry leads. */
  surfaceOrder: Surface[];
  /** Where the Ask row renders. */
  askPosition: 'top' | 'bottom';
}

export function analyseQuery(query: string): SearchIntent;
```

Detection, in this order, first match wins:

| Kind          | Signal                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `part-number` | `safePartNumberPattern` shape: letters+digits, 4–12 chars, no spaces (`12G940`)                                     |
| `colour-code` | `BLVC ####`, `GN37`, `CPT` shapes; the same patterns `color-lookup` accepts                                         |
| `chassis`     | A prefix present in `chassisRanges` followed by digits                                                              |
| `engine`      | A prefix present in `engineCodes.json` followed by digits                                                           |
| `question`    | Leading `how`, `why`, `what`, `when`, `which`, `should`, `can`, `does`, `is`, `do`; or a `?`; or five or more words |
| `lookup`      | Everything else                                                                                                     |

`askPosition` is `top` for `question` and `bottom` for the rest. It also becomes
`top` on the client when the result set is empty, so a zero-result query always
shows a next step before the "Request it" button.

Surface order by kind:

| Kind          | Order                                                              |
| ------------- | ------------------------------------------------------------------ |
| `part-number` | parts, tools, archive, suppliers, exchange, wheels, models, videos |
| `colour-code` | archive, tools, exchange, wheels, models, parts, suppliers, videos |
| `chassis`     | tools, archive, exchange, wheels, models, parts, suppliers, videos |
| `engine`      | tools, archive, parts, exchange, wheels, models, suppliers, videos |
| `question`    | videos, tools, archive, parts, suppliers, wheels, models, exchange |
| `lookup`      | tools, wheels, archive, models, exchange, parts, suppliers, videos |

The `lookup` order is today's order with the three new surfaces appended, so an
existing query ranks the same as before.

A fixture table in `tests/unit/shared/searchIntent.test.ts` holds the real misses
from `archive_search_misses` with their expected kind and lead surface. Adding a
detector means adding rows, not rewriting the test.

### 2. Three new surfaces

`Surface` grows from five to eight: `tools | wheels | archive | models | exchange |
parts | suppliers | videos`. `SURFACE_LABELS` in `useOmnisearch.ts` and the icon map
grow with it.

**Videos.** `server/utils/youtubeCatalog.ts` already holds the whole channel in KV
with a 12-hour SWR cache, and `rankByWord` already ranks it for the chat tool.
`searchVideos(query)` in `omnisearch.ts` calls the same index and returns one
result per video with `url` set to the YouTube watch URL. The palette row renders
the thumbnail at 18px like an icon. Clicks go through `trackOutbound` with
`group: 'omnisearch_video'`, the same as the chat video cards.

**Parts.** The parts archive has a kill switch that RLS does not enforce for the
service role. `server/api/archive/parts/search.get.ts` filters declined sources by
hand. That logic lifts into `server/utils/partsSearch.ts` and is imported by the
route, by `omnisearch.ts` and by the `parts-lookup` MCP tool. It is never copied.
A part-number query hits `buildPartSearchFilter`; a word query hits the description
pattern. Results deep-link to `/archive/parts?q=`.

**Suppliers.** `data/models/suppliers.ts` is static. `searchSuppliers` uses the same
`rank()` as tools, on name, region and the categories list. Results link to
`/archive/suppliers#<slug>`.

### 3. Matching that survives a typo

**Postgres side.** `omnisearch()` ranks by `ILIKE` only. The migration in
`classicminidiy-supabase` adds a second tier: rows where
`similarity(name, p_query) > 0.3` join the result with rank 2, after the prefix and
substring tiers. `pg_trgm` and the `gin_trgm_ops` indexes are already there from the
original omnisearch migration, so `%` and `similarity()` use them. The RPC signature
does not change; consuming code is untouched. This migration can ship first and on
its own.

**In-process side.** `rank()` in `omnisearch.ts` is a substring check on the whole
query. It changes to per-word: split the query, score each word against name,
`searchTerms` and summary, sum the scores, divide by word count. This is the
`rankByWord` rule from `fuzzyRank.ts`, applied to the static sources. `comp ratio`
then matches the compression calculator on `comp` → `compression` (prefix) and
`ratio` (summary).

`searchTerms` in `toolbox-catalog.ts` gets a pass against the miss log. The rule
for the file stays: a term is a phrase a person typed, not a description.

### 4. Direct-answer cards

A direct answer renders the answer in the palette instead of a link to it. The API
returns them as a new array on `SearchResponse`:

```ts
export interface SearchResponse {
  query: string;
  intent: SearchIntent;
  answers: DirectAnswer[];
  total: number;
  results: SearchResult[];
  counts: Record<string, number>;
}

export type DirectAnswer =
  | { kind: 'part'; partNumber: string; description: string; system: string | null; sourceCount: number; url: string }
  | { kind: 'colour'; name: string; code: string | null; family: string | null; years: string | null; url: string }
  | { kind: 'chassis'; fields: { label: string; value: string }[]; url: string }
  | { kind: 'engine'; fields: { label: string; value: string }[]; url: string }
  | { kind: 'torque'; item: string; lbft: number; nm: number; section: string; url: string }
  | { kind: 'clearance'; item: string; thou: string; mm: string; section: string; url: string };
```

Each card has a detector, a lookup and a component. The lookups are the MCP tools'
own logic, imported, never copied:

| Card               | Detector                        | Lookup                                            | Component                  |
| ------------------ | ------------------------------- | ------------------------------------------------- | -------------------------- |
| Part               | `intent.kind === 'part-number'` | `partsSearch.ts` exact match on normalised number | `search/AnswerPart.vue`    |
| Colour             | `intent.kind === 'colour-code'` | `colors` table, `status = 'approved'`, code match | `search/AnswerColour.vue`  |
| Chassis            | `intent.kind === 'chassis'`     | `validateChassisNumber` from `chassisDecode.ts`   | `search/AnswerDecoded.vue` |
| Engine             | `intent.kind === 'engine'`      | The `engine-decoder` MCP tool's parse             | `search/AnswerDecoded.vue` |
| Torque / clearance | Noun map hit                    | `lookup()` from `mcpLookup.ts` on the mapped row  | `search/AnswerSpec.vue`    |

The torque and clearance card needs a map from what people type to a row. That map
is data, in `data/models/referenceNouns.ts`:

```ts
export const REFERENCE_NOUNS: ReferenceNoun[] = [
  {
    terms: ['flywheel', 'flywheel bolt', 'flywheel torque'],
    table: 'torque',
    section: 'engineTable',
    item: 'Flywheel bolt',
  },
  {
    terms: ['tappet', 'tappets', 'valve clearance', 'rocker clearance'],
    table: 'clearance',
    section: 'engine',
    item: 'Valve clearance',
  },
  // ...
];
```

The detector runs when a query word matches a term and the query has at most four
words. The `item` value must match a row in `torqueSpecs.json` or
`commonClearances.json` exactly; a static test walks the map and fails on a stale
row so the card can never render a wrong number. `data/models/units.ts` supplies
the unit labels, per the reference-data rule.

Cards render as the first group, labelled `Answer`. They are keyboard rows like any
other and their Enter goes to `url`. The palette caps answers at two.

### 5. The Ask row

One row, present whenever the query has two or more characters, positioned by
`intent.askPosition`:

```
[bot icon]  Ask DIY Mini Bot: "how do I bleed the brakes"        ⌘↵
```

Enter selects the highlighted result. `Cmd+Enter` (`Ctrl+Enter` on Windows) selects
the Ask row from anywhere. Selecting it calls `router.push({ path: '/chat', query:
{ message } })`, the handoff `FloatingChatInput` uses today, with
`source: 'omnisearch'` added so the chat page can attribute the thread.

**Quota state.** The row's copy and action depend on the visitor's tier and how
much of the quota is used:

| State                            | Row copy                                    | Action                  |
| -------------------------------- | ------------------------------------------- | ----------------------- |
| Quota available (any tier)       | Ask DIY Mini Bot: "…"                       | `/chat?message=`        |
| Anonymous, at limit              | Sign in to ask — 30 questions a month, free | `/login?redirect=/chat` |
| Free account, at limit           | Become a Sustaining Member — 100 a month    | `/membership`           |
| Member, at limit                 | Questions reset on the 1st                  | Disabled row            |
| Unknown (peek failed or pending) | Ask DIY Mini Bot: "…"                       | `/chat?message=`        |

The state comes from a new read-only route, `GET /api/chat/quota`, that returns
`{ tier, used, limit }` without consuming a message. `chatQuota.ts` gains a
`peekChatQuota(event)` beside `consumeChatQuota`; both read the same counter. The
palette fetches it once per open, after the input is focused, and stores it in
`useState` for the session. It never blocks the first render, and it is not
fetched on page load, which keeps the reasoning in `ChatWindow.vue` about not
adding a round trip in front of every chat load intact.

The row is client-only state (tier lives in localStorage) so it renders inside the
existing `hasMounted` gate in the palette; the fallback copy is the "quota
available" copy, so SSR and the first client paint agree.

### 6. Miss telemetry — record on commit, not on keystroke

`runOmnisearch` stops recording misses on the search call. The client records a
miss with `POST /api/search/miss { q }` when all of these hold: the last response
had zero results and zero answers, and one of Enter, Ask-row selection, palette
close, or 1.5s idle happened. The route calls the same `record_search_miss` RPC
with the same guard against model-generated text (`recordMisses` stays on the
`runOmnisearch` options for the agent path and is simply `false` from the HTTP
route now).

The `/search` page records the same way on load, once, because a load is a commit.

### 7. Retire `FloatingChatInput`

`app/components/FloatingChatInput.vue` is deleted, with its i18n block and the
`floating_chat_submitted` event. `app/pages/index.vue` drops the mount and the
`needsOnboarding` guard around it. The hero placeholder changes from "Search…" to
"Search or ask anything about your Mini" in all ten locales. `MainNav.vue` keeps
its z-index comment but the reference to the floater goes.

### 8. `/search` page

The page gets the same eight surfaces, the answer group, the Ask row at the top of
the results column, and the surface order from `intent`. Its `?surface=` filter
gains the three new values. `useFacetedSeo()` already handles the query params.

### 9. Analytics

New events, all through `track()`:

| Event                        | Properties                                   |
| ---------------------------- | -------------------------------------------- |
| `omnisearch_ask_selected`    | `kind`, `position`, `quota_state`, `results` |
| `omnisearch_answer_shown`    | `kind`                                       |
| `omnisearch_answer_selected` | `kind`                                       |
| `omnisearch_miss_committed`  | `kind`, `trigger`                            |

`omnisearch_result_selected` gains `kind` and `position` (index in the flat list).
The chat handoff carries `source=omnisearch` so `chat_message_sent` can be split
by origin.

## Phase 2 — inline answer on `/search`

Not in this change. Designed here so phase 1 leaves room for it.

The `/search` page gets a right-hand panel that streams the bot's answer for the
current query, using the same `useChat` transport and quota panel `ChatWindow.vue`
owns. The panel is closed by default and opens from the Ask row on that page; the
palette keeps handing off to `/chat`. This needs the quota-exhausted panel, the
video cards and the degraded-tool markers lifted out of `ChatWindow.vue` into
components the search page can mount. That refactor is the bulk of phase 2 and is
the reason it is not phase 1.

## Not in this change

- **On-site video pages** (`/videos/[id]`, embedded player, related tools, SEO for
  466 videos). Real value, separate design doc. Video results link to YouTube.
- **A model-backed classifier.** The heuristic's failure mode is the Ask row on the
  wrong edge of the list. That is not worth a model call on an unauthenticated path.
- **A global cross-surface score.** Groups stay. Order is by query shape.
- **Search history sync.** Recents stay in localStorage.

## Supabase touchpoint

One migration in `classicminidiy-supabase`:
`<timestamp>_omnisearch_trigram_similarity.sql`, replacing `public.omnisearch(text,
integer)` with the similarity tier added to every surface's `UNION`. Grants are
restated per the local-stack rule. `types/database.ts` does not change because the
signature does not change. This migration is independent of the web work and ships
first.

## Test surface

| Test                                          | Tier   | Checks                                                                                          |
| --------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `tests/unit/shared/searchIntent.test.ts`      | unit   | Fixture table of real queries → kind, lead surface, ask position                                |
| `tests/unit/server/utils/omnisearch.test.ts`  | unit   | Per-word rank; surface order applied; new surfaces present; no miss recorded on the search call |
| `tests/unit/server/utils/partsSearch.test.ts` | unit   | Kill switch: a declined source never appears, fails closed on read error                        |
| `tests/unit/server/api/search-miss.test.ts`   | unit   | Records only a non-empty query; rejects >120 chars                                              |
| `tests/unit/server/api/chat-quota.test.ts`    | unit   | Peek never increments the counter; shape `{ tier, used, limit }`                                |
| `tests/static/reference-nouns.test.ts`        | static | Every `REFERENCE_NOUNS` row resolves to a real row in the JSON tables                           |
| `tests/static/api-contract.test.ts`           | static | `SearchResponse` gains `intent` and `answers`; agent `site-search` still parses it              |
| `tests/static/component-resolution.test.ts`   | static | `FloatingChatInput` is referenced nowhere                                                       |
| i18n completeness                             | static | Existing test covers the new strings                                                            |

## Success metrics

Read from PostHog 30 days after deploy, against the 30 days before:

| Metric                                                                     | Now  | Target                                      |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| Palette opens with no click, no view-all and no ask                        | ~45% | < 30%                                       |
| Zero-result commits as a share of committed searches                       | n/a  | < 15%                                       |
| `chat_message_sent` with `source=omnisearch`                               | 0    | > 25% of chat messages                      |
| Distinct `normalized_query` rows added to `archive_search_misses` per week | ~40  | < 15, and none that are prefixes of another |

## Implementation plan

Four PRs, each deployable on its own, in this order.

**PR A — `classicminidiy-supabase`: trigram tier in `omnisearch()`.**
Migration + a `tests/` SQL check that `fuel inection` returns the fuel injection
documents. Needs Cole's approval before push (schema change).

**PR B — web: foundations.**

1. `shared/utils/searchIntent.ts` + fixture test.
2. `server/utils/partsSearch.ts` lifted from the route; route and MCP tool import it.
3. Three new surfaces in `omnisearch.ts`; per-word `rank()`; `searchTerms` pass.
4. `SearchResponse.intent`; surface order applied server-side; `SURFACE_LABELS` grows.
5. Miss telemetry moves to `POST /api/search/miss` and commit triggers.
6. `/search` page: new surfaces and filter values.

**PR C — web: direct answers.**

1. `data/models/referenceNouns.ts` + static test.
2. `answers` on the response; the five lookups.
3. Four card components under `app/components/search/`; the `Answer` group in the
   palette and on `/search`.
4. Analytics events for answers.

**PR D — web: the Ask row and the retirement.**

1. `peekChatQuota` + `GET /api/chat/quota` + test.
2. The Ask row, keyboard binding, quota copy in ten locales.
3. `source=omnisearch` on the handoff; `chat_message_sent` attribution.
4. Delete `FloatingChatInput`; hero placeholder copy.
5. Analytics events for the row.

Each PR gets a Code Reviewer pass before it opens, per the usual loop.
