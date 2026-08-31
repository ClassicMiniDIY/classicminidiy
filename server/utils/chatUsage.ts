import type { H3Event } from 'h3';
import { serverRuntimeConfig } from './runtimeConfig';

/**
 * Per-run telemetry for the AI chat.
 *
 * This exists to answer one question that nothing else currently can: **which
 * tools does the assistant actually call?**
 *
 * The agent lives in a separate repo and reaches our `/mcp` endpoint over HTTP
 * with a key that defaults to the string `"."`, wrapped in a bare try/except
 * that continues with an empty tool list. So a wrong key silently ships a bot
 * with ZERO Classic Mini tools, degraded to generic web search, with no health
 * signal anywhere. The MCP server's own telemetry cannot see this either:
 * `recordMcpUsage` skips the Supabase counter for the internal env-key tier
 * (no `api_keys` row) and deliberately emits nothing to PostHog for it. Both
 * sinks are blind by design, which leaves the chat side as the only place the
 * answer can come from.
 *
 * It also captures the streaming baseline — time-to-first-token vs total
 * duration — that the rebuild has to beat, and which is the only way to tell
 * from the outside whether the response is genuinely incremental.
 *
 * Deliberately NOT captured: prompt text, reply text, or anything a user typed.
 * These are volume, latency and routing metrics. Question content belongs in
 * the thread store, not in an analytics event.
 *
 * Hand-rolled capture matching server/utils/mcpUsage.ts — `posthog-node` stays
 * uninstalled, and every send is backgrounded through `event.waitUntil` so
 * telemetry can never delay or fail a chat response.
 */

const POSTHOG_INGEST_HOST = process.env.POSTHOG_INGEST_HOST || 'https://us.i.posthog.com';

/** How a run ended. `client_disconnect` is a user pressing stop or navigating. */
export type ChatRunOutcome = 'completed' | 'upstream_error' | 'client_disconnect';

/** Guard against a pathological chunk graph costing real CPU on the hot path. */
const MAX_WALK_DEPTH = 6;

/**
 * Collect tool names out of one LangGraph stream chunk.
 *
 * Shape-tolerant on purpose: the chunk is `{event, data}` where `data` is a
 * message, an array of messages, or a node->state record depending on
 * `stream_mode`, and the assistant's tool set is defined in another repo. Two
 * shapes carry a tool name — a `type: 'tool'` message, and `tool_calls[]` on an
 * assistant message — so both are matched wherever they appear rather than at
 * one fixed path.
 */
export function collectToolNames(node: unknown, into: Set<string>, depth = 0): Set<string> {
  if (depth > MAX_WALK_DEPTH || node === null || typeof node !== 'object') return into;

  if (Array.isArray(node)) {
    for (const item of node) collectToolNames(item, into, depth + 1);
    return into;
  }

  const record = node as Record<string, unknown>;

  if (record.type === 'tool' && typeof record.name === 'string' && record.name) {
    into.add(record.name);
  }

  if (Array.isArray(record.tool_calls)) {
    for (const call of record.tool_calls) {
      const name = (call as Record<string, unknown> | null)?.name;
      if (typeof name === 'string' && name) into.add(name);
    }
  }

  for (const value of Object.values(record)) {
    collectToolNames(value, into, depth + 1);
  }

  return into;
}

/** Pull LangChain's `usage_metadata` token counts out of a chunk, if present. */
function collectUsage(node: unknown, into: { input: number; output: number }, depth = 0): void {
  if (depth > MAX_WALK_DEPTH || node === null || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) collectUsage(item, into, depth + 1);
    return;
  }

  const record = node as Record<string, unknown>;
  const usage = record.usage_metadata as Record<string, unknown> | undefined;
  if (usage && typeof usage === 'object') {
    // Take the MAX rather than summing: streamed messages restate cumulative
    // totals for the same message, so summing double-counts a single run.
    if (typeof usage.input_tokens === 'number') into.input = Math.max(into.input, usage.input_tokens);
    if (typeof usage.output_tokens === 'number') into.output = Math.max(into.output, usage.output_tokens);
  }

  for (const value of Object.values(record)) collectUsage(value, into, depth + 1);
}

export interface ChatRunTracker {
  /** Feed every chunk as it is proxied. Never throws. */
  observe(chunk: unknown): void;
  /** Emit the run summary. Safe to call once; later calls are ignored. */
  finish(outcome: ChatRunOutcome, errorMessage?: string): void;
}

/**
 * Start tracking a run. `threadId` is the LangGraph thread UUID — used as the
 * distinct id so a conversation's runs correlate, with person profiles off so
 * this never builds a person timeline out of anonymous chat traffic.
 */
export function createChatRunTracker(event: H3Event, threadId: string, locale?: string): ChatRunTracker {
  const startedAt = Date.now();
  const tools = new Set<string>();
  const usage = { input: 0, output: 0 };
  let firstChunkAt: number | null = null;
  let chunkCount = 0;
  let done = false;

  return {
    observe(chunk: unknown) {
      try {
        chunkCount += 1;
        if (firstChunkAt === null) firstChunkAt = Date.now();
        collectToolNames(chunk, tools);
        collectUsage(chunk, usage);
      } catch {
        // Telemetry must never break the stream it is measuring.
      }
    },

    finish(outcome: ChatRunOutcome, errorMessage?: string) {
      if (done) return;
      done = true;
      try {
        const key = serverRuntimeConfig(event).public.posthogPublicKey as string;
        if (!key) return;

        const send = $fetch(`${POSTHOG_INGEST_HOST}/capture/`, {
          method: 'POST',
          body: {
            api_key: key,
            event: 'chat_run_completed',
            distinct_id: threadId,
            properties: {
              outcome,
              // The streaming baseline. If these two are equal the response was
              // buffered, however incremental the upstream looked.
              time_to_first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
              duration_ms: Date.now() - startedAt,
              chunk_count: chunkCount,
              // The reason this file exists. An empty array on a real question
              // means the assistant answered with no Classic Mini tool at all.
              tools_called: [...tools].sort(),
              tool_call_count: tools.size,
              input_tokens: usage.input || null,
              output_tokens: usage.output || null,
              locale: locale ?? null,
              error_message: errorMessage ?? null,
              $process_person_profile: false,
            },
          },
          timeout: 2000,
        }).catch(() => {
          // best-effort: capture must never affect serving
        });

        (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(send);
      } catch {
        // swallowed on purpose
      }
    },
  };
}
