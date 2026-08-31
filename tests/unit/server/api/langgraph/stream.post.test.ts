/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/langgraph/threads/:threadId/runs/stream
//
// The only chat transport the UI uses, and until 2026-08-31 the only handler
// under server/api/langgraph/** with no test at all. Everything asserted here
// is a property that shipped broken:
//
//   * a wildcard CORS header on an unauthenticated route that spends money
//   * string chunks in a stream used as a Response body
//   * the `[DONE]` sentinel, which the client treats as end-of-stream — if it
//     is ever dropped on the error path the composer spins forever
//
// These are transport contracts, not agent behaviour, so the LangGraph client
// is mocked wholesale. What the graph returns is irrelevant here; what matters
// is how this route frames it.
// ---------------------------------------------------------------------------

let streamChunks: unknown[] = [];
let streamError: Error | null = null;
let createdThreadId = 'thread-created';
let createThreadShouldThrow = false;

const runsStream = vi.fn(() => {
  // An async iterable, matching the SDK's `client.runs.stream()` return.
  return (async function* () {
    for (const chunk of streamChunks) yield chunk;
    if (streamError) throw streamError;
  })();
});

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('setResponseStatus', vi.fn());
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({ NODE_ENV: 'test' }))
);

vi.mock('~/server/utils/langgraph', () => ({
  createLangGraphClient: vi.fn(() => ({ runs: { stream: runsStream } })),
  createThreadIfNeeded: vi.fn(async (_client: unknown, threadId: string) => {
    if (createThreadShouldThrow) throw new Error('upstream refused');
    return threadId === 'new' || !threadId ? createdThreadId : threadId;
  }),
}));

const handler = (await import('~~/server/api/langgraph/threads/[threadId]/runs/stream.post')).default;

/** Drain a Response body, returning the raw chunks and the decoded text. */
async function drain(response: Response) {
  const reader = response.body!.getReader();
  const chunks: unknown[] = [];
  let text = '';
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    text += decoder.decode(value as Uint8Array, { stream: true });
  }
  return { chunks, text };
}

/** The SSE payloads, in order, with the `data: ` framing removed. */
function events(text: string): string[] {
  return text
    .split('\n\n')
    .filter((block) => block.startsWith('data: '))
    .map((block) => block.slice('data: '.length));
}

function callHandler(body: Record<string, unknown> = { assistant_id: 'agent', input: { messages: [] } }) {
  (globalThis as any).readBody.mockResolvedValue(body);
  return handler({} as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  streamChunks = [{ event: 'messages/partial', data: 'hello' }];
  streamError = null;
  createdThreadId = 'thread-created';
  createThreadShouldThrow = false;
  (globalThis as any).useRuntimeConfig.mockReturnValue({ NODE_ENV: 'test' });
  (globalThis as any).getRouterParam.mockReturnValue('thread-1');
});

describe('POST /api/langgraph/.../runs/stream', () => {
  describe('request validation', () => {
    it('400s without a thread id', async () => {
      (globalThis as any).getRouterParam.mockReturnValue(undefined);
      const result = await callHandler();
      expect((globalThis as any).setResponseStatus).toHaveBeenCalledWith({}, 400);
      expect(result).toEqual({ error: 'Thread ID is required' });
    });

    it('400s without an assistant_id', async () => {
      const result = await callHandler({ input: { messages: [] } });
      expect((globalThis as any).setResponseStatus).toHaveBeenCalledWith({}, 400);
      expect(result).toEqual({ error: 'assistant_id is required' });
    });

    it('500s when the thread cannot be created, without opening a stream', async () => {
      createThreadShouldThrow = true;
      const result = await callHandler();
      expect((globalThis as any).setResponseStatus).toHaveBeenCalledWith({}, 500);
      expect(result).toMatchObject({ error: 'Failed to create thread' });
      expect(runsStream).not.toHaveBeenCalled();
    });
  });

  describe('response headers', () => {
    it('never answers with a wildcard CORS header', async () => {
      const response = (await callHandler()) as Response;
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      // Belt and braces: nothing set one on the event either, which is where
      // the second copy of these headers used to live.
      const headerNames = (globalThis as any).setHeader.mock.calls.map((c: any[]) => String(c[1]).toLowerCase());
      expect(headerNames).not.toContain('access-control-allow-origin');
    });

    it('is served as an event stream', async () => {
      const response = (await callHandler()) as Response;
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });
  });

  describe('stream framing', () => {
    it('enqueues Uint8Array chunks, never strings', async () => {
      const response = (await callHandler()) as Response;
      const { chunks } = await drain(response);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk).toBeInstanceOf(Uint8Array);
      }
    });

    it('sends the thread id first, then the graph chunks', async () => {
      const response = (await callHandler()) as Response;
      const { text } = await drain(response);
      const [first, second] = events(text);
      expect(JSON.parse(first)).toEqual({ event: 'thread_id', data: { thread_id: 'thread-1' } });
      expect(JSON.parse(second)).toEqual({ event: 'messages/partial', data: 'hello' });
    });

    it("resolves 'new' to a freshly created thread id", async () => {
      (globalThis as any).getRouterParam.mockReturnValue('new');
      const response = (await callHandler()) as Response;
      const { text } = await drain(response);
      expect(JSON.parse(events(text)[0]!)).toEqual({
        event: 'thread_id',
        data: { thread_id: 'thread-created' },
      });
      expect(runsStream).toHaveBeenCalledWith('thread-created', 'agent', expect.anything());
    });

    it('terminates with [DONE]', async () => {
      const response = (await callHandler()) as Response;
      const { text } = await drain(response);
      expect(events(text).at(-1)).toBe('[DONE]');
    });

    it('reports an upstream failure as an error event AND still terminates', async () => {
      // The hang this guards against: if the sentinel were only emitted on the
      // happy path, a mid-stream upstream failure would leave the composer
      // spinning with no error shown.
      streamError = new Error('graph exploded');
      const response = (await callHandler()) as Response;
      const { text } = await drain(response);
      const seen = events(text);
      expect(JSON.parse(seen.at(-2)!)).toEqual({ error: 'graph exploded' });
      expect(seen.at(-1)).toBe('[DONE]');
    });

    it('still terminates when the graph yields nothing at all', async () => {
      streamChunks = [];
      const response = (await callHandler()) as Response;
      const { text } = await drain(response);
      expect(events(text).at(-1)).toBe('[DONE]');
    });
  });

  describe('run options', () => {
    it('forwards stream_mode and merges unknown keys into the run config', async () => {
      await callHandler({
        assistant_id: 'agent',
        input: { messages: [] },
        stream_mode: ['messages', 'updates'],
        config: { configurable: { thread_id: 'x' } },
      });
      expect(runsStream).toHaveBeenCalledWith(
        'thread-1',
        'agent',
        expect.objectContaining({
          streamMode: ['messages', 'updates'],
          config: { configurable: { thread_id: 'x' } },
        })
      );
    });

    it('stamps the environment onto caller metadata rather than replacing it', async () => {
      await callHandler({
        assistant_id: 'agent',
        input: { messages: [] },
        metadata: { language_instruction: 'Answer in French' },
      });
      expect(runsStream).toHaveBeenCalledWith(
        'thread-1',
        'agent',
        expect.objectContaining({
          metadata: { environment: 'test', language_instruction: 'Answer in French' },
        })
      );
    });

    it('sends no metadata key at all when the caller supplied none', async () => {
      await callHandler();
      expect(runsStream.mock.calls[0]![2]).not.toHaveProperty('metadata');
    });
  });
});
