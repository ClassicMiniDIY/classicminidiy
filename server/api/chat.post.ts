import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { buildAgentTools } from '../agent/tools';
import { buildSystemPrompt } from '../agent/prompt';
import { createChatRunTracker } from '../utils/chatUsage';

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
 * Deliberately UNAUTHENTICATED, like the proxy it replaces — the assistant has
 * to work for every anonymous visitor. `server/middleware/rate-limit.ts` and the
 * Cloudflare zone rate-limit rule are what stand in front of it. Metering for
 * the Sustaining Member tier arrives separately and must never turn this into a
 * route that can answer 401.
 */

/** Ceiling on tool-call rounds per message. Generous enough for a question that
 *  needs two or three lookups, low enough that a confused model cannot spend the
 *  budget in a loop. */
const MAX_STEPS = 6;

/** Guard the request body before it reaches a model. */
const MAX_MESSAGES = 40;
const MAX_CHARS = 24_000;

function textOf(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((part: any) => part?.type === 'text' && typeof part.text === 'string')
    .map((part: any) => part.text)
    .join(' ');
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
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
  const totalChars = messages.reduce((sum, message) => sum + textOf(message).length, 0);
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

  const tracker = createChatRunTracker(event, String(body?.threadId ?? 'anonymous'), body?.locale);

  const result = streamText({
    model: anthropic(((config.CHAT_MODEL as string) || 'claude-haiku-4-5-20251001').trim()),
    system: buildSystemPrompt({ locale: body?.locale, pageSlug: body?.pageSlug }),
    messages: convertToModelMessages(messages),
    tools: buildAgentTools(),
    stopWhen: stepCountIs(MAX_STEPS),
    onStepFinish({ toolCalls }) {
      // Feed the SAME telemetry the old proxy emitted, so `tools_called` is
      // comparable across the cutover rather than restarting from zero.
      for (const call of toolCalls ?? []) {
        tracker.observe({ type: 'ai', tool_calls: [{ name: (call as any).toolName }] });
      }
    },
    onFinish({ usage }) {
      tracker.observe({
        usage_metadata: {
          input_tokens: usage?.inputTokens ?? 0,
          output_tokens: usage?.outputTokens ?? 0,
        },
      });
      tracker.finish('completed');
    },
    onError({ error }) {
      console.error('[chat] stream failed:', error);
      tracker.finish('upstream_error', error instanceof Error ? error.message : String(error));
    },
  });

  return result.toUIMessageStreamResponse();
});
