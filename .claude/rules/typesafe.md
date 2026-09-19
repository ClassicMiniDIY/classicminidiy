---
paths:
  - 'server/utils/typesafe.ts'
  - 'server/utils/typesafeModes.ts'
  - 'server/utils/review/**'
  - 'server/api/admin/review/**'
  - 'app/components/admin/ReviewCard.vue'
  - 'app/composables/useReviewCards.ts'
  - 'server/api/admin/typesafe/**'
  - 'app/pages/admin/typesafe.vue'
  - 'server/agent/classifier.ts'
  - 'server/agent/classifierRun.ts'
  - 'server/api/chat.post.ts'
  - 'server/agent/prompt.ts'
  - 'server/utils/exchange/screen.ts'
  - 'server/utils/models/safetyRead.ts'
  - 'server/api/exchange/wanted/**'
  - 'server/api/exchange/contact-seller.post.ts'
  - 'server/api/models/index.post.ts'
  - 'server/api/models/*.patch.ts'
  - 'server/utils/searchTriage.ts'
  - 'server/api/search/miss.post.ts'
  - 'server/api/search/index.get.ts'
  - 'server/utils/queueDuplicates.ts'
  - 'server/utils/mcpRelatedPick.ts'
  - 'server/api/admin/queue/list.ts'
  - 'server/mcp/tools/torque-specs.ts'
  - 'server/mcp/tools/clearances.ts'
  - 'server/mcp/tools/vehicle-weights.ts'
  - 'server/mcp/tools/parts-equivalency.ts'
---

# TypeSafe (Jev) rules

TypeSafe answers typed questions (Choice / Noul / Score) over a piece of state
and generates no text. In this repo it makes the small judgments AROUND the
chat model, never in place of it. Programme and phase docs live in the private
supabase repo (`docs/plans/2026-09-17-typesafe-*.md`); this file is the part
that must survive any phase.

- **`server/utils/typesafe.ts` is the only reader of `TYPESAFE_API_KEY`**
  (runtime secret `NUXT_TYPESAFE_API_KEY`). Never public runtimeConfig, never
  imported from `app/`. An absent value is `''`; check `typesafeConfigured()`
  and degrade to "no judgment", never to an error the reader sees.
- **A Jev answer is a hint or a log line, never a gate.** It never blocks a
  message, never skips a tool, never authenticates or authorizes, never writes
  a status. `chat-auth`, the size caps and the prompt remain the security
  boundary: Jev reads state as text, not as hostile, and can be steered by it.
- **The model id is exact (`jev-1.13.0`), never `jev-latest`.** The API echoes
  the id it was asked for; storing an alias makes a model upgrade invisible.
  Bump `TYPESAFE_MODEL` deliberately and say so in the commit.
- **The chat classifier runs in parallel with the quota write and is
  collected with a ceiling** (`CLASSIFIER_CEILING_MS`). Off, misconfigured,
  slow, thrown or malformed all collapse to `hint: null` plus a `classifier`
  status on `chat_run_completed`. `TYPESAFE_CHAT_MODE` is `off` (default),
  `shadow` (analytics only) or `hint`; the switch is a runtime secret, so
  turning it off is not a deploy.
- **The hint lives in the DYNAMIC prompt half, after the cached static
  prefix.** Putting anything per-message before the static prompt breaks the
  Anthropic cache breakpoint; `cache_read_tokens` at ~0 is the symptom.
- **Jev cannot pick an omitted option.** The classifier's tool list is
  `toolGuidanceList()` from `prompt.ts`, the same text the model reads, so it
  can never name a tool the model does not have, and a name outside that list
  is treated as `none`.
- **Numbers, dates and codes are compared in code.** Never ask Jev whether
  one figure is larger, a year is in a range, or two part numbers match.
- **Every call is metered** (`typesafe_call`: caller, tokens, duration) and
  stamped on the run it served. A new caller adds a new `caller` tag; it does
  not reuse `chat-classifier`.
- The stream contract the native apps parse carries no classifier data. The
  fixtures in `tests/fixtures/chat-stream` must not change for this feature.
- **The marketplace text screen (`server/utils/exchange/screen.ts`) reads the
  same `platform_settings.message_screen_mode` row as the private-message
  screen in the supabase repo**, cached a minute per isolate. `hold` flags a
  wanted post exactly as the regex layer does (`status`/`moderation_status` =
  `flagged`, tags into `moderation_issues`); `shadow` logs; a seller inquiry is
  an email with nothing to hold and is only logged (`contact_seller_screened`).
  A `skipped` verdict means the route proceeds as it did before the screen.
- **The model safety read (`server/utils/models/safetyRead.ts`) writes
  `models.safety_model_p` through the service client only** and never
  `safety_critical`. The detail page shows the strong disclaimer on
  `isSafetyCritical(flag, p)` = seller flag OR `p >= 0.7`; the model only ever
  adds caution. Off unless `TYPESAFE_MODELS_MODE=on`.
- **The search surface stays regex on every path a visitor waits on.**
  `server/utils/searchTriage.ts` runs only after the fact: the miss triage
  labels a row `record_search_miss()` already wrote (`triage_*` columns, via
  `record_search_miss_triage`), and the intent shadow (`TYPESAFE_SEARCH_MODE
= shadow`) logs `search_intent_shadow` beside the regex kind with a
  `INTENT_SHADOW_CEILING_MS` ceiling. Neither changes `/api/search`'s
  response, the surface order, or `shared/utils/searchIntent.ts`; a reorder
  from a model answer is a later change with its own switch.
  `promote_search_miss()` stays a human act.
- **The queue duplicate hint scores only candidates code found.**
  `server/utils/queueDuplicates.ts` asks one Score per row that
  `find_submission_duplicates` (exact code, then trigram name) returned and
  stores the result once per pending submission (`TYPESAFE_QUEUE_MODE=on`).
  The card shows it; the approve route still inserts unless the admin picks
  "attach", which sends the existing `editedData.originalColorId`. No
  auto-merge, no auto-reject, colours and wheels only.
- **`relatedPick` is a hint beside `related`, never a filter on it.**
  `server/utils/mcpRelatedPick.ts` runs only when a table tool's near-miss
  list has two or more rows, only with a request event (`extra.event`, the one
  key a tool may read from its MCP context; the tiering plugin and the chat
  bridge both attach it) and only with `TYPESAFE_MCP_MODE=on`. `lookup()` in
  `mcpLookup.ts` stays synchronous and pure; the rows and their order do not
  change; a pick under `RELATED_PICK_MIN` is no pick.
- **A surface's mode is `typesafeMode(event, surface)` from
  `server/utils/typesafeModes.ts`, never the env directly.** A
  `platform_settings` row (`typesafe_<surface>_mode`, written only by the
  private repo's `set_typesafe_mode()`) beats the `TYPESAFE_*_MODE` env; an
  absent row is the env; rows are cached a minute per isolate and a failed
  read keeps the last good values. `/admin/typesafe` is the page that flips
  them and reads `typesafe_readout()`; its bars are constants in the page.
- **`typesafe_events` gets numbers, enums and ids only.** The mirror behind
  `captureServerEvent` uses the per-event allowlist in `typesafeModes.ts`;
  adding a text property (a message, a query, the state) to that list is the
  one change it must refuse.
- **The review card (`server/utils/review/`) is a hint on every submission;
  `auto` is only the surface's own approval path running.** `reviewSubmission`
  writes `review_hint` through `record_review_hint()` and returns
  `autoEligible`; the per-surface adapter in `surfaces.ts` then does exactly
  what the human route does (listings: status + published_at + audit + seller
  email; finds: status + published_at) or nothing (wanted, archive, models
  have no auto path; models never will here). A card never rejects. Gates are
  `platform_settings.review_gate_<surface>`, thresholds one row; a failed
  read keeps last values. State carries the submitter's trust level as a
  word and never a name, email or id; years and formats are checked in code
  and passed as findings.
