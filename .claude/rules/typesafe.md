---
paths:
  - 'server/utils/typesafe.ts'
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
