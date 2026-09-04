import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { buildAgentTools, webSearchSupported } from '../agent/tools';
import { stripStaleWebSearchContent } from '../agent/transcript';
import { buildSystemPrompt } from '../agent/prompt';
import { createChatRunTracker } from '../utils/chatUsage';
import { consumeChatQuota, quotaExhaustedError, recordChatTokens } from '../utils/chatQuota';
import { getChatAuth, MEMBERSHIP_URL } from '../utils/chatTiers';
import { serverRuntimeConfig } from '../utils/runtimeConfig';

/**
 * The Classic Mini DIY assistant — the agent, in this Worker.
 *
 * Replaces the proxy to an externally hosted LangGraph deployment whose graph,
 * prompt and tool set all lived in another repo. That agent was a stock
 * `create_agent` ReAct loop with no custom topology, so `streamText` with a
 * `stopWhen` step budget IS the same loop, minus a platform, a Python service
 * and a network hop. The tools it needs live in this Worker; it no longer has to
 * reach back over public HTTP to get at them.
 *
 * OPTIONALLY authenticated, and it must never *require* auth. The assistant has
 * to work for every anonymous visitor — that is the point of the surface and why
 * it is indexed. `server/middleware/chat-auth.ts` resolves identity IF PRESENT
 * and fails open to the anonymous tier; this route then meters against that
 * tier. **A 401 is never a valid response from here.** An exhausted quota is a
 * 429 carrying an upgrade pointer, the same posture as the MCP free-tier gated
 * result. Underneath sit the in-process limiter and the Cloudflare zone
 * rate-limit rule.
 */

/** Ceiling on tool-call rounds per message. Generous enough for a question that
 *  needs two or three lookups, low enough that a confused model cannot spend the
 *  budget in a loop. */
const MAX_STEPS = 6;

/**
 * Guard the request body before it reaches a model.
 *
 * Measured AFTER `stripStaleWebSearchContent`, because that is the payload the
 * model is actually charged for. The guard exists to bound what a scripted
 * caller can push into a model on an UNAUTHENTICATED endpoint, and what it
 * should bound is the request that gets made, not the one that arrived.
 *
 * The ceiling was 24,000, went to 120,000 when `web_search` was added, and comes
 * back to 40,000 now that a finished search is compacted on replay. Measured on
 * the live path, one conversation, question -> answer -> follow-up:
 *
 *   - a single `tool-web_search` part: **13,734** characters (18,520 in a second
 *     run — it scales with how many results the search returned)
 *   - the first follow-up: **22,666 -> 10,367** characters replayed
 *   - the second: **23,847 -> 11,548**
 *
 * 24,000 was what refused that first follow-up before this change, and it is
 * still the wrong number to go back to: a real search conversation now grows by
 * roughly 1,200 characters per exchange from a ~10,000 base, so 24,000 would cut
 * one off after about nine messages. Conversation LENGTH is what `MAX_MESSAGES`
 * is for. 40,000 leaves that job to it while keeping this one — a bound on a
 * single unauthenticated request — at about 10k tokens. Beyond it sit the
 * per-tier quota in `consumeChatQuota`, the in-process limiter and the
 * Cloudflare zone rule.
 */
const MAX_MESSAGES = 40;
const MAX_CHARS = 40_000;

/**
 * Approximate the size a message contributes to the prompt.
 *
 * Counts EVERY part, not just text. The client replays the whole conversation
 * each turn, and an assistant turn carries tool parts whose `output` can dwarf
 * the prose — `wheel-search` and `torque-specs` return dozens of rows, and
 * `site-search` up to twenty results. Counting text alone let a tool-heavy
 * conversation read as a few hundred characters while carrying tens of
 * thousands into the model, so the ceiling this guard exists to enforce did not
 * hold.
 */
function sizeOf(message: UIMessage): number {
  let total = 0;
  for (const part of message.parts ?? []) {
    const anyPart = part as any;
    if (anyPart?.type === 'text' && typeof anyPart.text === 'string') {
      total += anyPart.text.length;
      continue;
    }
    // Tool parts, reasoning, files: measure the serialised payload. A part that
    // cannot be serialised (a cycle) is charged a nominal amount rather than
    // throwing — this is a size estimate, not a validator.
    try {
      total += JSON.stringify(anyPart)?.length ?? 0;
    } catch {
      total += 1_000;
    }
  }
  return total;
}

export default defineEventHandler(async (event) => {
  const config = serverRuntimeConfig(event);
  const apiKey = config.ANTHROPIC_API_KEY as string;

  if (!apiKey) {
    // An absent runtimeConfig value is an empty string, not undefined, so this
    // has to be an explicit check — see the 2026-08-26 chat outage, where an
    // empty key produced a 403 from upstream and a green deploy.
    throw createError({ statusCode: 503, statusMessage: 'The assistant is not configured' });
  }

  const body = await readBody<{
    messages?: UIMessage[];
    locale?: string;
    pageSlug?: string;
    threadId?: string;
  }>(event);
  const messages = body?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'messages is required' });
  }
  if (messages.length > MAX_MESSAGES) {
    throw createError({ statusCode: 413, statusMessage: 'Conversation too long — start a new chat' });
  }

  // Before the size guard and before the conversion, so both see the payload
  // that will actually be sent. A finished `web_search` replays ~14k characters
  // of encrypted page text that only the turn that ran it could ever use. See
  // server/agent/transcript.ts.
  const replayed = stripStaleWebSearchContent(messages);

  const totalChars = replayed.reduce((sum, message) => sum + sizeOf(message), 0);
  if (totalChars > MAX_CHARS) {
    throw createError({ statusCode: 413, statusMessage: 'Conversation too long — start a new chat' });
  }

  const anthropic = createAnthropic({
    apiKey,
    // Routed through Cloudflare AI Gateway when configured: caching, rate
    // limiting and analytics, free and with no markup on inference. Unset falls
    // back to calling Anthropic directly, so a missing gateway degrades to
    // "works, with less observability" rather than an outage.
    baseURL: (config.AI_GATEWAY_ANTHROPIC_URL as string) || undefined,
  });

  // `threadId` is client-supplied and becomes the analytics distinct id, so it
  // is accepted only in the shape the client actually generates. Anything else
  // is a scripted caller, and letting it through would let one poison the
  // `tools_called` data the rebuild is being judged on — either by flooding
  // distinct ids or by collapsing every run onto one.
  const rawThreadId = typeof body?.threadId === 'string' ? body.threadId : '';
  const threadId = /^[A-Za-z0-9_-]{1,64}$/.test(rawThreadId) ? rawThreadId : 'anonymous';

  // BEFORE the model runs. A quota checked afterwards is not a quota — the
  // tokens are already spent. Every failure path inside allows the request, so
  // an unavailable counter degrades the ceiling rather than the assistant.
  const verdict = await consumeChatQuota(event);
  if (!verdict.allowed) throw quotaExhaustedError(event, verdict);

  const tracker = createChatRunTracker(event, threadId, body?.locale);

  /**
   * Tools that answered degraded this run, e.g. `store-search:unavailable`.
   *
   * Reported as its own `tools_degraded` property rather than mixed into
   * `tools_called`, so neither that array nor `tool_call_count` is distorted by
   * a failure signal. The `reason` is logged rather than counted: a Shopify or
   * Postgres error string is unbounded and would be a useless grouping key, but
   * without it every cause collapses into one indistinct marker.
   */
  const degraded = new Set<string>();
  const recordDegraded = (marker: string, reason?: string) => {
    degraded.add(marker);
    console.warn(`[chat] tool degraded: ${marker}${reason ? ` — ${reason}` : ''}`);
  };
  const degradedList = () => (degraded.size ? [...degraded].sort() : undefined);

  // convertToModelMessages is ASYNC in AI SDK v7 (it was synchronous in v6).
  // Passing the promise straight to streamText fails inside standardizePrompt
  // with "messages.some is not a function" — a message that names neither the
  // call nor the missing await, and which only appears at runtime because the
  // route's own error handler catches it and streams a generic error.
  const modelMessages = await convertToModelMessages(replayed);

  /**
   * Cache hit rate, on the run event.
   *
   * Turning caching on without measuring it means a breakpoint that silently
   * stops matching — a reordered prompt, a tool description edited per-request
   * — would cost 10x on the prefix with no symptom at all. `cache_read_tokens`
   * at ~0 across a day is the signal that the prefix stopped being stable.
   */
  const recordCache = (usage: any) =>
    tracker.recordCacheUsage({
      read: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
      written: usage?.inputTokenDetails?.cacheWriteTokens ?? 0,
      uncached: usage?.inputTokenDetails?.noCacheTokens ?? 0,
    });

  // Carries the last few characters between deltas so a URL split across two
  // of them is still matched. Bounded by the URL's own length.
  let membershipTail = '';

  /**
   * The default moved from Haiku 4.5 to Sonnet 5 on 2026-09-04.
   *
   * Not a cost decision — at the measured volume (473 conversations in fifteen
   * months) the difference is cents. It is a judgement decision. The tier
   * hierarchy this prompt now depends on asks the model to sort each question
   * into specification / procedure / diagnosis, and Haiku read a prompt full of
   * prohibitions conservatively enough to refuse five of five test questions.
   * Sonnet is also the floor for `web_search_20260209`; `webSearchSupported()`
   * in server/agent/tools.ts drops that tool rather than 400 if this is ever
   * moved back down.
   */
  const modelId = ((config.CHAT_MODEL as string) || 'claude-sonnet-5').trim();

  const result = streamText({
    model: anthropic(modelId),
    // `isMember` is why the tier is read here and not only for analytics: the
    // membership pointer lives in the prompt's static half, so without it a
    // paying member asking an unanswerable question is sold the subscription
    // they already pay for.
    // `hasWebSearch` keeps the prompt and the tool set telling the same story.
    // `buildAgentTools` withholds `web_search` from a model that cannot accept
    // `web_search_20260209`; without this the prompt would still name the tool
    // and list eight trusted domains, and the model would report searches it had
    // no way to run. Same predicate, one source of truth.
    system: buildSystemPrompt({
      locale: body?.locale,
      pageSlug: body?.pageSlug,
      isMember: getChatAuth(event)?.tier === 'member',
      hasWebSearch: webSearchSupported(modelId),
    }),
    // Cache the tool definitions and the system prompt.
    //
    // Anthropic's cache prefix runs tools -> system -> messages, so a breakpoint
    // on the SYSTEM block covers both — measured at 6,332 tokens written on the
    // live path, of which the twelve tool schemas are the bulk. A breakpoint on
    // a tool instead covers only the tools, which was verified and is the easy
    // mistake to make.
    //
    // Worth it because of the TOOL LOOP, not because of cross-user reuse. Every
    // step of a single turn re-sends the whole prefix seconds apart, so the
    // 5-minute window is a guaranteed hit within one answer. Measured against
    // the live API at Haiku 4.5 pricing: a two-call turn costs $0.0080 cached
    // against $0.0119 uncached (33% less), a three-call turn 52% less. A turn
    // that calls NO tool is ~25% worse, since it pays the write and never reads
    // — but making turns use tools is the entire point of this rebuild, and the
    // no-tool case is the cheap one anyway.
    //
    // (An earlier note here argued the opposite. It reasoned only about
    // cross-REQUEST caching at ~40 messages/month, where writes do mostly
    // expire unread, and missed the intra-turn loop entirely.)
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
    messages: modelMessages,
    // `event` so the Shopify credentials are read per-request; `onDegraded` so a
    // tool that answers degraded is counted instead of being indistinguishable
    // from one that simply found nothing. Markers go to their OWN field, never
    // into `tools_called` — that array's length is published as
    // `tool_call_count`, so a marker there would count one invocation twice.
    // `youtubeApiKey` so `video-search` can page the uploads playlist, and
    // `modelId` so the Anthropic-executed `web_search` tool is only offered to
    // a model that accepts it.
    tools: buildAgentTools({
      event,
      youtubeApiKey: (config.YOUTUBE_API_KEY as string) || '',
      modelId,
      onDegraded: recordDegraded,
    }),
    stopWhen: stepCountIs(MAX_STEPS),
    // Every part of the stream, so time-to-first-chunk keeps meaning
    // time-to-first-token and chunk_count keeps meaning stream length. Feeding
    // only tool calls here would silently redefine both under the same names,
    // and the Phase 0 streaming baseline they exist to be compared against
    // would be measuring something else.
    onChunk({ chunk }) {
      tracker.observe(chunk);
      // Did this reply point the reader at the membership?
      //
      // The three limits on that pointer are prompt instructions, and a prompt
      // instruction is not a guarantee — so it is counted, and a drift back
      // toward pitching on every reply shows up in `chat_run_completed`
      // instead of only in transcripts.
      //
      // Two things make the naive version silently never fire, and both were
      // written wrong here first. The URL is streamed in pieces, so a single
      // delta almost never contains all of it — hence the carried tail, which
      // holds exactly enough of the previous delta for a URL straddling the
      // boundary to be seen, and no more. And the SDK types a text delta with
      // `text` in one shape and `delta` in another, so reading only one field
      // yields `undefined` against a live stream while every test that builds
      // the other shape passes.
      if (chunk.type === 'text-delta') {
        const piece = (chunk as { text?: string; delta?: string }).text ?? (chunk as { delta?: string }).delta;
        if (typeof piece === 'string') {
          const combined = membershipTail + piece;
          if (combined.includes(MEMBERSHIP_URL)) tracker.recordMembershipMention();
          membershipTail = combined.slice(-MEMBERSHIP_URL.length);
        }
      }
    },
    onStepFinish({ toolCalls, usage }) {
      for (const call of toolCalls ?? []) {
        tracker.recordToolCall((call as any).toolName);
      }
      // Per STEP, not only at the end. A run the visitor aborts, or one that
      // errors on a later step, still paid for the cache write its first step
      // performed — recording only in onFinish dropped those entirely and made
      // the read/write ratio read far too optimistic.
      recordCache(usage);
    },
    onFinish({ usage }) {
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      tracker.observe({ usage_metadata: { input_tokens: inputTokens, output_tokens: outputTokens } });
      recordChatTokens(event, inputTokens, outputTokens);

      tracker.finish('completed', undefined, {
        tier: getChatAuth(event)?.tier,
        quota_used: verdict.used,
        quota_limit: verdict.limit,
        // True when the ceiling could not be evaluated and the run was allowed
        // anyway. A KV binding that breaks after a deploy leaves anonymous chat
        // unbounded, and without this the only evidence would be a console line
        // nobody reads.
        quota_degraded: verdict.degraded === true,
        tools_degraded: degradedList(),
      });
    },
    onAbort() {
      // The visitor pressed stop or navigated away. These runs consumed tokens
      // and were previously recorded nowhere, which is awkward given
      // abandonment is the metric the whole rebuild is being judged on.
      tracker.finish('client_disconnect', undefined, { tools_degraded: degradedList() });
    },
    onError({ error }) {
      console.error('[chat] stream failed:', error);
      tracker.finish('upstream_error', error instanceof Error ? error.message : String(error), {
        tools_degraded: degradedList(),
      });
    },
  });

  return result.toUIMessageStreamResponse();
});
