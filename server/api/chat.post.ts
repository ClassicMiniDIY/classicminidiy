import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { buildAgentTools } from '../agent/tools';
import { buildSystemPrompt } from '../agent/prompt';
import { createChatRunTracker } from '../utils/chatUsage';
import { consumeChatQuota, quotaExhaustedError, recordChatTokens } from '../utils/chatQuota';
import { getChatAuth } from '../utils/chatTiers';
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

/** Guard the request body before it reaches a model. */
const MAX_MESSAGES = 40;
const MAX_CHARS = 24_000;

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
  const totalChars = messages.reduce((sum, message) => sum + sizeOf(message), 0);
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

  // convertToModelMessages is ASYNC in AI SDK v7 (it was synchronous in v6).
  // Passing the promise straight to streamText fails inside standardizePrompt
  // with "messages.some is not a function" — a message that names neither the
  // call nor the missing await, and which only appears at runtime because the
  // route's own error handler catches it and streams a generic error.
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic(((config.CHAT_MODEL as string) || 'claude-haiku-4-5-20251001').trim()),
    system: buildSystemPrompt({ locale: body?.locale, pageSlug: body?.pageSlug }),
    messages: modelMessages,
    tools: buildAgentTools(),
    stopWhen: stepCountIs(MAX_STEPS),
    // Every part of the stream, so time-to-first-chunk keeps meaning
    // time-to-first-token and chunk_count keeps meaning stream length. Feeding
    // only tool calls here would silently redefine both under the same names,
    // and the Phase 0 streaming baseline they exist to be compared against
    // would be measuring something else.
    onChunk({ chunk }) {
      tracker.observe(chunk);
    },
    onStepFinish({ toolCalls }) {
      for (const call of toolCalls ?? []) {
        tracker.recordToolCall((call as any).toolName);
      }
    },
    onFinish({ usage }) {
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      tracker.observe({ usage_metadata: { input_tokens: inputTokens, output_tokens: outputTokens } });
      recordChatTokens(event, inputTokens, outputTokens);
      tracker.finish('completed', undefined, {
        tier: getChatAuth(event)?.tier,
        quotaUsed: verdict.used,
        quotaLimit: verdict.limit,
      });
    },
    onAbort() {
      // The visitor pressed stop or navigated away. These runs consumed tokens
      // and were previously recorded nowhere, which is awkward given
      // abandonment is the metric the whole rebuild is being judged on.
      tracker.finish('client_disconnect');
    },
    onError({ error }) {
      console.error('[chat] stream failed:', error);
      tracker.finish('upstream_error', error instanceof Error ? error.message : String(error));
    },
  });

  return result.toUIMessageStreamResponse();
});
