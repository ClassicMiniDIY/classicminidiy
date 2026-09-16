/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CHAT_CLIENT_HEADER,
  CHAT_ENTRY_POINTS,
  captureChatQuotaRefused,
  collectToolNames,
  createChatRunTracker,
  normalizeChatEntryPoint,
  parseChatClient,
  readChatClient,
} from '~~/server/utils/chatUsage';

// ---------------------------------------------------------------------------
// Chat run telemetry. The load-bearing assertion here is `tools_called`: it is
// the only signal anywhere that can tell us whether the assistant is reaching
// the Classic Mini MCP tools or silently answering from generic web search.
// The MCP server's own telemetry cannot — it skips both sinks for the internal
// env-key tier.
// ---------------------------------------------------------------------------

const captured: any[] = [];
const waitUntil = vi.fn();

vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({ public: { posthogPublicKey: 'phc_test' } }))
);
vi.stubGlobal(
  '$fetch',
  vi.fn((_url: string, opts: any) => {
    captured.push(opts.body);
    return Promise.resolve({});
  })
);

const fakeEvent = (headers: Record<string, string> = {}, chatAuth?: { tier: string; userId?: string }) =>
  ({ waitUntil, node: { req: { headers } }, context: chatAuth ? { chatAuth } : {} }) as any;

/** The event body of the single capture this run produced. */
const lastProps = () => captured.at(-1)!.properties;

beforeEach(() => {
  captured.length = 0;
  vi.clearAllMocks();
});

describe('collectToolNames', () => {
  it('finds a tool message anywhere in the chunk', () => {
    const chunk = {
      event: 'messages/complete',
      data: [{ type: 'tool', name: 'torque-specs', content: '{}' }],
    };
    expect([...collectToolNames(chunk, new Set())]).toEqual(['torque-specs']);
  });

  it('finds names on an assistant message tool_calls array', () => {
    const chunk = {
      event: 'messages/partial',
      data: { type: 'ai', tool_calls: [{ name: 'gearbox-calculator' }, { name: 'tavily_search' }] },
    };
    expect([...collectToolNames(chunk, new Set())].sort()).toEqual(['gearbox-calculator', 'tavily_search']);
  });

  it('reaches into the node->state shape used by updates chunks', () => {
    // `stream_mode: 'updates'` nests messages under the graph node name, which
    // is why the walk is shape-tolerant rather than reading one fixed path.
    const chunk = {
      event: 'updates',
      data: { tools: { messages: [{ type: 'tool', name: 'chassis-decoder' }] } },
    };
    expect([...collectToolNames(chunk, new Set())]).toEqual(['chassis-decoder']);
  });

  it('deduplicates a tool called across several chunks', () => {
    const seen = new Set<string>();
    collectToolNames({ data: { type: 'tool', name: 'torque-specs' } }, seen);
    collectToolNames({ data: { type: 'tool', name: 'torque-specs' } }, seen);
    expect([...seen]).toEqual(['torque-specs']);
  });

  it('returns nothing for a plain text answer', () => {
    const chunk = { event: 'messages/partial', data: { type: 'ai', content: 'The torque is 40 lb-ft.' } };
    expect([...collectToolNames(chunk, new Set())]).toEqual([]);
  });

  it('ignores malformed tool_calls entries rather than throwing', () => {
    const chunk = { data: { type: 'ai', tool_calls: [null, { name: 42 }, { name: '' }, { name: 'clearances' }] } };
    expect([...collectToolNames(chunk, new Set())]).toEqual(['clearances']);
  });

  it('terminates on a self-referential chunk', () => {
    const chunk: any = { data: { type: 'tool', name: 'wheel-search' } };
    chunk.self = chunk;
    expect(() => collectToolNames(chunk, new Set())).not.toThrow();
  });
});

describe('createChatRunTracker', () => {
  it('reports the tools a run used', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1', 'en');
    tracker.observe({ data: { type: 'ai', tool_calls: [{ name: 'torque-specs' }] } });
    tracker.observe({ data: { type: 'tool', name: 'torque-specs' } });
    tracker.observe({ data: { type: 'tool', name: 'clearances' } });
    tracker.finish('completed');

    expect(lastProps()).toMatchObject({
      outcome: 'completed',
      tools_called: ['clearances', 'torque-specs'],
      tool_call_count: 2,
      chunk_count: 3,
      locale: 'en',
    });
  });

  it('reports an EMPTY tool list when the assistant used no tools', () => {
    // This is the finding the whole file exists to surface: a real question
    // answered with zero Classic Mini tools means the agent's MCP wiring is
    // down, not that the question was unusual.
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.observe({ data: { type: 'ai', content: 'I think it is about 40 lb-ft.' } });
    tracker.finish('completed');

    expect(lastProps().tools_called).toEqual([]);
    expect(lastProps().tool_call_count).toBe(0);
  });

  it('records tool names without disturbing the stream metrics', () => {
    // recordToolCall must NOT advance chunk_count or stamp first-chunk time.
    // Routing tool calls through observe() silently redefined both under the
    // same names, so a dashboard comparing across the cutover compared two
    // different quantities.
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.recordToolCall('torque-specs');
    tracker.recordToolCall('clearances');
    tracker.recordToolCall('torque-specs');
    tracker.finish('completed');

    expect(lastProps()).toMatchObject({
      tools_called: ['clearances', 'torque-specs'],
      chunk_count: 0,
      time_to_first_chunk_ms: null,
    });
  });

  it('ignores an undefined or empty tool name', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.recordToolCall(undefined);
    tracker.recordToolCall('');
    tracker.finish('completed');
    expect(lastProps().tools_called).toEqual([]);
  });

  it('records a run the visitor abandoned', () => {
    // These consumed tokens and were previously recorded nowhere, which is
    // awkward when abandonment is the metric under investigation.
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.observe({ data: {} });
    tracker.finish('client_disconnect');
    expect(lastProps().outcome).toBe('client_disconnect');
  });

  it('records an upstream failure with its message', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.finish('upstream_error', 'graph exploded');
    expect(lastProps()).toMatchObject({ outcome: 'upstream_error', error_message: 'graph exploded' });
  });

  it('captures token usage without double-counting restated cumulative totals', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.observe({ data: { usage_metadata: { input_tokens: 1200, output_tokens: 30 } } });
    tracker.observe({ data: { usage_metadata: { input_tokens: 1200, output_tokens: 210 } } });
    tracker.finish('completed');
    expect(lastProps()).toMatchObject({ input_tokens: 1200, output_tokens: 210 });
  });

  it('measures time to first chunk separately from total duration', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.observe({ data: {} });
    tracker.finish('completed');
    expect(lastProps().time_to_first_chunk_ms).toBeTypeOf('number');
    expect(lastProps().duration_ms).toBeTypeOf('number');
  });

  it('leaves time to first chunk null when nothing ever streamed', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.finish('upstream_error', 'connect ECONNREFUSED');
    expect(lastProps().time_to_first_chunk_ms).toBeNull();
  });

  it('emits once even if finish is called twice', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.finish('completed');
    tracker.finish('client_disconnect');
    expect(captured).toHaveLength(1);
  });

  it('backgrounds the send so telemetry never delays the response', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.finish('completed');
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it('never builds a person profile out of anonymous chat traffic', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.finish('completed');
    expect(lastProps().$process_person_profile).toBe(false);
  });

  it('captures no message content', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.observe({ data: { type: 'human', content: 'what is my head gasket torque' } });
    tracker.observe({ data: { type: 'ai', content: 'It is 40 lb-ft.' } });
    tracker.finish('completed');
    const serialized = JSON.stringify(captured.at(-1));
    expect(serialized).not.toContain('head gasket');
    expect(serialized).not.toContain('40 lb-ft');
  });

  it('sends nothing when PostHog is not configured', () => {
    (globalThis as any).useRuntimeConfig.mockReturnValueOnce({ public: { posthogPublicKey: '' } });
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.finish('completed');
    expect(captured).toHaveLength(0);
  });

  it('survives a runtime with no waitUntil', () => {
    const tracker = createChatRunTracker({} as any, 'thread-1');
    expect(() => tracker.finish('completed')).not.toThrow();
    expect(captured).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The native-app contract: which client asked, from which screen, and the
// refusal event. toolbox-ios/docs/plans/2026-09-15-native-ai-chat.md §5.1, §9.1.
// ---------------------------------------------------------------------------

describe('parseChatClient', () => {
  it('accepts the two app platforms with a lenient version', () => {
    expect(parseChatClient('ios/1.2.3')).toBe('ios');
    expect(parseChatClient('android/2.18.0')).toBe('android');
    // TestFlight / beta suffixes and build metadata survive.
    expect(parseChatClient('ios/2.15.0-beta')).toBe('ios');
    expect(parseChatClient('android/2.18.0+42')).toBe('android');
    expect(parseChatClient('  ios/2.15.0 ')).toBe('ios');
  });

  it('resolves everything else to web', () => {
    expect(parseChatClient(undefined)).toBe('web');
    expect(parseChatClient(null)).toBe('web');
    expect(parseChatClient('')).toBe('web');
    expect(parseChatClient('curl/8')).toBe('web');
    expect(parseChatClient('ios')).toBe('web');
    expect(parseChatClient('ios/')).toBe('web');
    expect(parseChatClient('IOS/1.0')).toBe('web');
    expect(parseChatClient('windows/1.0')).toBe('web');
    // A scripted caller cannot mint a fourth platform via the version field.
    expect(parseChatClient('ios/1.0 android/2.0')).toBe('web');
    expect(parseChatClient(`ios/${'9'.repeat(33)}`)).toBe('web');
  });

  it('is read from the x-cmdiy-client header', () => {
    expect(CHAT_CLIENT_HEADER).toBe('x-cmdiy-client');
    expect(readChatClient(fakeEvent({ 'x-cmdiy-client': 'android/2.18.0' }))).toBe('android');
    expect(readChatClient(fakeEvent({}))).toBe('web');
    // A bare event with no request object is `web`, not a thrown error.
    expect(readChatClient({} as any)).toBe('web');
  });
});

describe('normalizeChatEntryPoint', () => {
  it('keeps the allowlisted screens', () => {
    for (const point of CHAT_ENTRY_POINTS) expect(normalizeChatEntryPoint(point)).toBe(point);
    expect([...CHAT_ENTRY_POINTS]).toEqual([
      'tile',
      'history',
      'compression',
      'gearbox',
      'needles',
      'torque',
      'clearances',
      'wiring',
      'maintenance',
    ]);
  });

  it('is null when absent and unknown when off the list', () => {
    // Absent is the web today (its context is `pageSlug`); off-list is a new
    // app screen that should show up as a count, not as a free-text key.
    expect(normalizeChatEntryPoint(undefined)).toBeNull();
    expect(normalizeChatEntryPoint(null)).toBeNull();
    expect(normalizeChatEntryPoint('settings')).toBe('unknown');
    expect(normalizeChatEntryPoint('')).toBe('unknown');
    expect(normalizeChatEntryPoint(42)).toBe('unknown');
    expect(normalizeChatEntryPoint({ tile: true })).toBe('unknown');
  });
});

describe('createChatRunTracker client and entry point', () => {
  it('defaults to web with no entry point', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1', 'en');
    tracker.finish('completed');
    expect(lastProps()).toMatchObject({ client: 'web', entry_point: null });
  });

  it.each(['completed', 'upstream_error', 'client_disconnect'] as const)(
    'stamps client and entry_point on a %s outcome',
    (outcome) => {
      // Through the constructor, the same path `locale` takes, so an
      // abandoned app run is never counted as a web abandonment.
      const tracker = createChatRunTracker(fakeEvent(), 'thread-1', 'en', 'ios', 'compression');
      tracker.finish(outcome, outcome === 'upstream_error' ? 'boom' : undefined);
      expect(lastProps()).toMatchObject({ outcome, client: 'ios', entry_point: 'compression' });
    }
  );

  it.each(['completed', 'upstream_error', 'client_disconnect'] as const)(
    'stamps the tier on a %s outcome',
    (outcome) => {
      const tracker = createChatRunTracker(fakeEvent({}, { tier: 'member', userId: 'u-1' }), 'thread-1');
      tracker.finish(outcome);
      expect(lastProps().tier).toBe('member');
    }
  );

  it('reports anonymous when the request carried no resolved tier', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1');
    tracker.finish('completed');
    expect(lastProps().tier).toBe('anonymous');
  });

  it('never uses a property named source', () => {
    const tracker = createChatRunTracker(fakeEvent(), 'thread-1', 'en', 'android', 'tile');
    tracker.finish('completed');
    expect(Object.keys(lastProps())).not.toContain('source');
  });
});

describe('captureChatQuotaRefused', () => {
  it('emits chat_quota_refused with the tier, client and entry point', () => {
    const event = fakeEvent({ 'x-cmdiy-client': 'ios/2.15.0' }, { tier: 'free', userId: 'u-1' });
    captureChatQuotaRefused(event, { allowed: false, used: 30, limit: 30 }, 'ios', 'gearbox', 'thread-9');
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe('chat_quota_refused');
    expect(captured[0].distinct_id).toBe('thread-9');
    expect(lastProps()).toEqual({
      tier: 'free',
      client: 'ios',
      entry_point: 'gearbox',
      quota_used: 30,
      quota_limit: 30,
      $process_person_profile: false,
    });
  });

  it('resolves a missing tier to anonymous and a missing threadId to the anonymous id', () => {
    captureChatQuotaRefused(fakeEvent(), { allowed: false }, 'web', null);
    expect(captured[0].distinct_id).toBe('anonymous');
    expect(lastProps()).toMatchObject({ tier: 'anonymous', client: 'web', entry_point: null, quota_used: null });
  });

  it('backgrounds the send and sends nothing without a PostHog key', () => {
    captureChatQuotaRefused(fakeEvent(), { allowed: false, used: 100, limit: 100 }, 'android', 'tile');
    expect(waitUntil).toHaveBeenCalledOnce();

    (globalThis as any).useRuntimeConfig.mockReturnValueOnce({ public: { posthogPublicKey: '' } });
    captureChatQuotaRefused(fakeEvent(), { allowed: false }, 'android', 'tile');
    expect(captured).toHaveLength(1);
  });
});
