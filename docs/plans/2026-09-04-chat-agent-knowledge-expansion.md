# Chat agent knowledge expansion — trusted sources, Cole's videos, Mini history

Status: design + implementation plan. Branch `feature/chat-knowledge-expansion`.
Follows `docs/plans/2026-08-31-chat-rebuild.md`, which put the agent in this Worker
and gave it thirteen tools. This adds three capabilities that rebuild deliberately
left out, and corrects a behaviour it introduced.

## The problem, from real transcripts

Five test-user conversations, all of them a refusal:

| Asked                                                 | Answered                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| How do I install a windshield?                        | "The archive doesn't have windshield installation instructions."    |
| What fuel filter for a 1996 SPI?                      | "I don't have fuel filter part numbers in the archive."             |
| Why does 1st→2nd grind?                               | "I can't diagnose what's causing the grinding from symptoms alone." |
| What is the coolant routing?                          | "The archive doesn't have documentation on coolant routing."        |
| What year was the Mini disqualified from Monte Carlo? | "That's outside what I cover."                                      |

Every one of these is answerable. Four are answerable by a competent enthusiast
without leaving their chair, and Cole has published videos on several of them.

### Cause 1 — the prompt has no middle category

`server/agent/prompt.ts` sorts every question into two bins: **specification**
(tool-only, `Never state a specification from memory`) or **out of scope**
(`Do not answer general trivia`). There is no bin for procedure, general
mechanical knowledge, or history. So a windshield fitting question — which is
not a torque figure and not trivia — falls through to a refusal.

The safety rule compounds it. `Do not offer personalised diagnostic advice on a
safety-critical fault` is correct for brakes and steering. A synchro grinding on
the 1–2 shift is neither safety-critical nor undiagnosable, and the assistant
refused it anyway.

### Cause 2 — the model

`chat.post.ts` runs `claude-haiku-4-5-20251001` (the `CHAT_MODEL` default;
nothing sets it in production). Haiku is the wrong size for a judgement call
about whether a question is a specification or general knowledge, and it reads
a prompt full of prohibitions conservatively. It also cannot use the
dynamic-filtering `web_search_20260209` server tool, which needs Sonnet 4.6 or
better.

### Cause 3 — no route off the site

The thirteen tools are archive lookups, `site-search` and `store-search`. When
the archive misses, the agent has nowhere to go. It cannot read minispares, it
cannot read Cole's own videos, and it holds no history.

## What gets built

Four changes, in dependency order.

### 1. A trusted-source registry, and web search scoped to it

`data/trustedSources.ts` is one typed array. Each entry is a bare hostname plus
what it is good for:

```ts
{ id: 'minispares', name: 'Mini Spares', domain: 'minispares.com',
  kind: 'oem-parts', covers: 'OEM and heritage part numbers, …' }
```

`TRUSTED_DOMAINS` derives from it and feeds two things: the `allowedDomains`
argument of the Anthropic `web_search_20260209` server tool, and a generated
paragraph in the system prompt so the model knows what each source is for.
**Adding a source is one object.** Nothing else changes.

Anthropic runs the search; there is no crawler, no index and no second API key.
`maxUses: 4` caps a single turn. At the measured volume (473 conversations in
fifteen months) the $10/1,000-searches rate is under a dollar a month, and the
existing per-tier chat quota already bounds abuse.

Constraints the allowlist must satisfy (enforced by
`tests/static/trusted-sources.test.ts`): 1–64 entries, plain hostnames only, no
scheme, no path, no port, no IP address, no bare TLD, no single-label name.
Subdomains are covered automatically by the API.

Seed list — the six Cole named, plus two for history (§3):

| Domain                    | Kind                                 |
| ------------------------- | ------------------------------------ |
| minispares.com            | OEM parts                            |
| somerfordminis.co.uk      | OEM parts, original factory diagrams |
| minisport.com             | OEM parts                            |
| med-engineering.co.uk     | Aftermarket / performance            |
| calverst.com              | Aftermarket / performance            |
| russellengineering.com.au | Technical reference                  |
| aronline.co.uk            | BMC/BL marque history                |
| en.wikipedia.org          | General reference                    |

### 2. `video-search` over the whole channel

466 uploads. `server/api/youtube/videos.ts` only ever fetched the newest three,
so there was nothing to search.

`server/utils/youtubeCatalog.ts` pages the uploads playlist
(`UUZIUfOFhrQ9nrR06IOoAJ2Q`, 50 per call, ~10 calls, 10 quota units) into a
trimmed index — id, title, truncated description, publish date, thumbnail — and
wraps it in `defineCachedFunction` at 12 hours with `swr: true`. On Cloudflare
that lands in the `CACHE` KV namespace already mounted in `nuxt.config.ts`, so
one visitor pays the refresh and everyone else reads KV. Search is Fuse.js
(already a dependency) over title and description.

The tool returns its rows under `videos`, **not** `results`. That is deliberate:
`usefulLinks` in `ChatWindow.vue` shape-matches on `output.results`, and videos
must not silently fill the links rail.

Prompt rule: when a question is a procedure or a how-to, call `video-search` and
link Cole's video before pointing anywhere else.

### 3. A Mini history corpus

`data/miniHistory.json` (types in `data/models/history.ts`), searched by
`server/utils/historySearch.ts` and exposed as the `mini-history` tool. Covers
origins and the Issigonis brief, the Mk1–Mk7 timeline, Cooper and Cooper S,
competition history including the 1966 Monte Carlo disqualification, badge
engineering and the overseas builds, suspension eras, and production milestones
through the final car in October 2000.

Web search (§1) covers the long tail; the corpus is what makes the common
questions authoritative and offline.

> **This corpus needs Cole's factual review before merge.** It is written from
> general knowledge, published on a site people trust for accuracy, and I am not
> the domain expert. Dates and attributions in particular.

The prompt's `## Out of scope` section is rewritten: history is in scope.

### 4. UI — videos read as videos

Two treatments, both requested:

- **`ChatVideoResults` rail.** Thumbnail, title, publish date, beside the answer
  on desktop and inline on mobile — the same two-slot arrangement `UsefulLinks`
  already uses in `ChatWindow.vue`. Populated by shape-matching `output.videos`,
  so no new stream plumbing.
- **Inline cards.** `app/utils/chatMarkdown.ts` gets a branch in its existing
  `link` renderer: a `youtube.com/watch` or `youtu.be` href renders as a card
  with a play glyph and the thumbnail instead of a bare underlined URL. It is
  emitted as `<a>`/`<span>`/`<img>`, all already in `ALLOWED_TAGS`, so DOMPurify
  needs no change and the no-raw-HTML rule holds.

### 5. Prompt rewrite — three tiers, not two

The load-bearing change. `staticPrompt()` gains an explicit hierarchy:

1. **Specifications** — torque, clearances, ratios, part numbers, weights,
   needles, paint codes. Tool call or nothing. Unchanged, and restated as
   strictly as before.
2. **Procedure, general knowledge and history** — answer it. Ground it in a
   video, the archive, or a trusted source where one exists. Say when something
   is general practice rather than a documented Mini figure.
3. **Diagnosis** — walk through likely causes for a non-safety-critical fault,
   ordered by likelihood, and say what would confirm each. Safety-critical work
   (brakes, steering, suspension, structural, major engine) still goes to a
   qualified mechanic.

`CHAT_MODEL` moves to `claude-sonnet-5`.

## Not in this change

**Scraping Somerford's parts diagrams into a part-number database.** It is a
genuinely good idea and a different project: a crawler, a schema (which would
live in `classicminidiy-supabase`, not here), a refresh cadence, and a
terms-of-service question about bulk-extracting a commercial retailer's
catalogue. It deserves its own design doc. Web search covers Somerford in the
meantime — the model can read a diagram page it finds, it just cannot enumerate
them.

## Test surface

- `tests/static/trusted-sources.test.ts` — allowlist shape and the 64-entry cap.
- `tests/unit/server/agent/prompt.test.ts` — existing pins still hold
  (`AGENT_TOOL_NAMES` equals `Object.keys(buildAgentTools()).sort()`, every tool
  named, membership limits, no shop-bot framing), plus new assertions for the
  three tiers and for history being in scope.
- `tests/unit/server/utils/youtubeCatalog.test.ts` — paging, trimming, ranking,
  and the degraded path.
- `tests/unit/server/utils/historySearch.test.ts` — ranking and no-match.
- `tests/unit/app/utils/chatMarkdown.test.ts` — YouTube hrefs become cards,
  everything else is untouched, sanitizer output unchanged.

## Rollout

`CHAT_MODEL=claude-sonnet-5` is a Worker environment variable, set separately
from the deploy. The code change is safe on Haiku — `web_search_20260209` is the
only Sonnet-gated piece, and the registry falls back to naming sources rather
than reading them if the tool is rejected.

Watch `chat_run_completed` after merge: `tools_called` should show
`video-search` and `web_search` appearing, `tools_degraded` should stay empty,
and the refusal rate is the number this is judged on.
