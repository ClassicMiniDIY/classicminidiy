import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';
import { serverRuntimeConfig } from './runtimeConfig';
import { getChatAuth } from './chatTiers';
import type { QuotaVerdict } from './chatQuota';

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

/**
 * Which client asked. `x-cmdiy-client` is sent by the native Toolbox apps as
 * `<platform>/<version>` (`ios/2.15.0`, `android/2.18.0-beta`); the web sends
 * nothing and is `web`. The platform prefix is validated strictly and the
 * version leniently, so a TestFlight or beta suffix survives but a scripted
 * caller cannot mint a fourth platform and split the dashboards.
 *
 * Design: toolbox-ios/docs/plans/2026-09-15-native-ai-chat.md §5.1.
 */
export const CHAT_CLIENT_HEADER = 'x-cmdiy-client';

export type ChatClient = 'ios' | 'android' | 'web';

const CHAT_CLIENT_PATTERN = /^(ios|android)\/[A-Za-z0-9.+-]{1,32}$/;

export function parseChatClient(raw: string | null | undefined): ChatClient {
  if (typeof raw !== 'string') return 'web';
  const match = CHAT_CLIENT_PATTERN.exec(raw.trim());
  return match ? (match[1] as ChatClient) : 'web';
}

export function readChatClient(event: H3Event): ChatClient {
  // Never throws: this feeds a log line and an analytics property, and a
  // request shape the header reader does not expect must not take a route
  // down (the thread-route unit tests build a bare event with no `node.req`).
  try {
    return parseChatClient(getRequestHeader(event, CHAT_CLIENT_HEADER));
  } catch {
    return 'web';
  }
}

/**
 * Note a native client on a chat route that emits no analytics of its own.
 *
 * The quota peek and the thread routes have no PostHog capture (a peek is not
 * a run), so a Worker log line is the only place app traffic on them is
 * visible. Web traffic is not logged: it is the bulk, and it is already
 * measured client-side.
 */
export function logNativeChatClient(event: H3Event, route: string): ChatClient {
  const client = readChatClient(event);
  if (client !== 'web') console.info(`[chat] ${route} from ${client}`);
  return client;
}

/**
 * Where in an app the question was asked from.
 *
 * Named `entryPoint` on the wire and `entry_point` on the event — never
 * `source`. The apps register `source` as their PostHog super property
 * (`ios` / `android`), and a property with that name would overwrite it.
 * Absent → `null`; present but not on the list → `unknown`, so a new screen
 * shows up as a count to investigate rather than as a free-text grouping key.
 */
export const CHAT_ENTRY_POINTS = [
  'tile',
  'history',
  'compression',
  'gearbox',
  'needles',
  'torque',
  'clearances',
  'wiring',
  'maintenance',
] as const;

export type ChatEntryPoint = (typeof CHAT_ENTRY_POINTS)[number] | 'unknown';

export function normalizeChatEntryPoint(raw: unknown): ChatEntryPoint | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'unknown';
  return (CHAT_ENTRY_POINTS as readonly string[]).includes(raw) ? (raw as ChatEntryPoint) : 'unknown';
}

/**
 * One PostHog capture, backgrounded through `waitUntil` and fully swallowed.
 *
 * Every event this file emits goes through here so the two things that must
 * never vary — the key check and the fire-and-forget posture — are written
 * once. `$process_person_profile: false` is set by the caller because it is
 * part of what each event promises, not a transport detail.
 */
function captureServerEvent(event: H3Event, name: string, distinctId: string, properties: Record<string, unknown>) {
  try {
    const key = serverRuntimeConfig(event).public.posthogPublicKey as string;
    if (!key) return;

    const send = $fetch(`${POSTHOG_INGEST_HOST}/capture/`, {
      method: 'POST',
      body: {
        api_key: key,
        event: name,
        distinct_id: distinctId,
        properties,
      },
      timeout: 2000,
    }).catch(() => {
      // best-effort: capture must never affect serving
    });

    (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(send);
  } catch {
    // swallowed on purpose
  }
}

/**
 * A quota refusal, as an event.
 *
 * The 429 is thrown before the run tracker starts, so without this a refusal
 * emits nothing and the question the native quota wall exists to answer —
 * do refusals turn into memberships — has no numerator. `distinct_id` is the
 * thread id, the same convention as `chat_run_completed`, so a refusal
 * correlates with the runs that led to it.
 */
export function captureChatQuotaRefused(
  event: H3Event,
  verdict: QuotaVerdict,
  client: ChatClient,
  entryPoint: ChatEntryPoint | null,
  threadId = 'anonymous'
): void {
  captureServerEvent(event, 'chat_quota_refused', threadId, {
    tier: getChatAuth(event)?.tier ?? 'anonymous',
    client,
    entry_point: entryPoint,
    quota_used: verdict.used ?? null,
    quota_limit: verdict.limit ?? null,
    $process_person_profile: false,
  });
}

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
  /** Feed every chunk as it streams. Never throws. */
  observe(chunk: unknown): void;
  /**
   * Record a tool the run used, when the caller already knows the name and does
   * not need it dug out of a chunk.
   *
   * Separate from `observe` on purpose: `observe` also advances `chunk_count`
   * and stamps time-to-first-chunk, so routing tool calls through it would
   * redefine both metrics under their existing names.
   */
  recordToolCall(name: string | undefined): void;
  /**
   * Record how much of the prompt came from Anthropic's cache.
   *
   * Separate from `observe` for the same reason `recordToolCall` is: `observe`
   * advances chunk_count and stamps first-chunk time, and these numbers arrive
   * once at the end rather than per chunk.
   */
  recordCacheUsage(tokens: { read: number; written: number; uncached: number }): void;
  /**
   * Note that the reply pointed the reader at the membership.
   *
   * The three limits on that pointer (only when nothing was answered, never
   * beside safety guidance, once then drop) are prompt instructions, and a
   * prompt instruction is not a guarantee. Without a counter, a drift back
   * toward pitching on every reply — the failure the old shop-bot prompt
   * actually shipped — would be invisible until someone read transcripts.
   *
   * Separate from `observe` for the same reason the two above are: `observe`
   * advances chunk_count and stamps first-chunk time.
   */
  recordMembershipMention(): void;
  /**
   * Emit the run summary. Safe to call once; later calls are ignored.
   *
   * `extra` carries membership context — which tier the caller was on and where
   * they stand against their quota. Without it, `chat_run_completed` cannot
   * answer the two questions the paid tier exists to raise: whether members
   * actually use the assistant more, and whether anyone is near a ceiling.
   */
  finish(outcome: ChatRunOutcome, errorMessage?: string, extra?: Record<string, unknown>): void;
}

/**
 * Start tracking a run. `threadId` is the client-minted thread id — used as the
 * distinct id so a conversation's runs correlate, with person profiles off so
 * this never builds a person timeline out of anonymous chat traffic.
 *
 * `client` and `entryPoint` ride in here beside `locale`, not in the `finish`
 * extra bag, so every outcome (`completed`, `upstream_error`,
 * `client_disconnect`) carries them. An abandoned app run that lost its
 * `client` would be counted as a web abandonment.
 */
export function createChatRunTracker(
  event: H3Event,
  threadId: string,
  locale?: string,
  client: ChatClient = 'web',
  entryPoint: ChatEntryPoint | null = null
): ChatRunTracker {
  // Same argument as `client`: an aborted or errored run with no tier on its
  // event makes "member abandonment rate" uncomputable. Read once, here.
  const tier = getChatAuth(event)?.tier ?? 'anonymous';
  const startedAt = Date.now();
  const tools = new Set<string>();
  let membershipMentioned = false;
  const usage = { input: 0, output: 0 };
  const cache = { read: 0, written: 0, uncached: 0 };
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

    recordToolCall(name: string | undefined) {
      if (typeof name === 'string' && name) tools.add(name);
    },

    // Parameter deliberately NOT named `usage`: that would shadow the
    // closure-scope token accumulator above, and a later line touching
    // `usage.input` in here would silently record nothing. CLAUDE.md documents
    // shadowing as a live hazard class in this repo.
    recordMembershipMention() {
      membershipMentioned = true;
    },
    recordCacheUsage(tokens: { read: number; written: number; uncached: number }) {
      cache.read += tokens.read;
      cache.written += tokens.written;
      cache.uncached += tokens.uncached;
    },

    finish(outcome: ChatRunOutcome, errorMessage?: string, extra?: Record<string, unknown>) {
      if (done) return;
      done = true;
      captureServerEvent(event, 'chat_run_completed', threadId, {
        outcome,
        // The streaming baseline. If these two are equal the response was
        // buffered, however incremental the upstream looked.
        time_to_first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
        duration_ms: Date.now() - startedAt,
        chunk_count: chunkCount,
        // The reason this file exists. An empty array on a real question
        // means the assistant answered with no Classic Mini tool at all.
        tools_called: [...tools].sort(),
        membership_mentioned: membershipMentioned,
        tool_call_count: tools.size,
        input_tokens: usage.input || null,
        output_tokens: usage.output || null,
        cache_read_tokens: cache.read,
        cache_write_tokens: cache.written,
        cache_uncached_tokens: cache.uncached,
        locale: locale ?? null,
        client,
        entry_point: entryPoint,
        tier,
        error_message: errorMessage ?? null,
        ...(extra ?? {}),
        $process_person_profile: false,
      });
    },
  };
}
