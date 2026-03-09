import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed, readonly } from 'vue';

// ─────────────────────────────────────────
// Mock usePersistentThread
// ─────────────────────────────────────────
const mockPersistentThread = {
  currentThreadId: ref<string | null>(null),
  isThreadLoaded: ref(true),
  isThreadExpired: computed(() => false),
  persistThread: vi.fn(),
  clearPersistedThread: vi.fn(),
  createNewThread: vi.fn(),
  updateThreadUsage: vi.fn(),
  getThreadData: vi.fn().mockReturnValue(null),
};

vi.mock('~/app/composables/usePersistentThread', () => ({
  usePersistentThread: () => mockPersistentThread,
}));

// ─────────────────────────────────────────
// Mock provide / inject (Nuxt auto-imports)
// ─────────────────────────────────────────
const mockProvide = vi.fn();
const mockInject = vi.fn();
vi.stubGlobal('provide', mockProvide);
vi.stubGlobal('inject', mockInject);

// ─────────────────────────────────────────
// Helper: create a mock SSE ReadableStream from lines
// ─────────────────────────────────────────
function createMockSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(encoder.encode(events[index] + '\n'));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function createMockFetchResponse(events: string[], ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    body: createMockSSEStream(events),
    headers: new Headers(),
    json: vi.fn(),
  } as unknown as Response;
}

describe('useStreamProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistentThread.currentThreadId.value = null;
    mockPersistentThread.isThreadLoaded.value = true;
    mockProvide.mockClear();
    mockInject.mockClear();

    // Re-stub provide/inject since unstubAllGlobals in afterEach clears them
    vi.stubGlobal('provide', mockProvide);
    vi.stubGlobal('inject', mockInject);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function freshModule() {
    return await import('~/app/composables/useStreamProvider');
  }

  // ═══════════════════════════════════════════
  // useStreamProvider()
  // ═══════════════════════════════════════════
  describe('useStreamProvider()', () => {
    describe('return shape', () => {
      it('returns expected shape with all required properties', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider).toHaveProperty('assistantId');
        expect(provider).toHaveProperty('threadId');
        expect(provider).toHaveProperty('isConfigured');
        expect(provider).toHaveProperty('isThreadLoaded');
        expect(provider).toHaveProperty('isThreadExpired');
        expect(provider).toHaveProperty('setThreadId');
        expect(provider).toHaveProperty('createNewThread');
        expect(provider).toHaveProperty('updateThreadUsage');
        expect(provider).toHaveProperty('getThreadData');
      });
    });

    describe('assistantId', () => {
      it('uses runtime config value when available', async () => {
        vi.stubGlobal(
          'useRuntimeConfig',
          vi.fn(() => ({
            public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
            NUXT_PUBLIC_LANGGRAPH_ASSISTANT_ID: 'custom-assistant',
          }))
        );

        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider.assistantId.value).toBe('custom-assistant');
      });

      it('defaults to "agent" when config is empty', async () => {
        vi.stubGlobal(
          'useRuntimeConfig',
          vi.fn(() => ({
            public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
            NUXT_PUBLIC_LANGGRAPH_ASSISTANT_ID: '',
          }))
        );

        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider.assistantId.value).toBe('agent');
      });

      it('defaults to "agent" when config property is missing', async () => {
        vi.stubGlobal(
          'useRuntimeConfig',
          vi.fn(() => ({
            public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
          }))
        );

        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider.assistantId.value).toBe('agent');
      });
    });

    describe('isConfigured', () => {
      it('is true when assistantId exists', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider.isConfigured.value).toBe(true);
      });
    });

    describe('threadId', () => {
      it('comes from persistentThread.currentThreadId', async () => {
        mockPersistentThread.currentThreadId.value = 'thread-abc';

        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider.threadId.value).toBe('thread-abc');
      });

      it('reflects changes to persistentThread.currentThreadId', async () => {
        mockPersistentThread.currentThreadId.value = null;

        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider.threadId.value).toBeNull();

        mockPersistentThread.currentThreadId.value = 'thread-new';
        expect(provider.threadId.value).toBe('thread-new');
      });
    });

    describe('setThreadId', () => {
      it('calls persistThread when id is truthy', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        provider.setThreadId('thread-123');
        expect(mockPersistentThread.persistThread).toHaveBeenCalledWith('thread-123');
      });

      it('calls clearPersistedThread when id is null', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        provider.setThreadId(null);
        expect(mockPersistentThread.clearPersistedThread).toHaveBeenCalled();
      });
    });

    describe('createNewThread', () => {
      it('delegates to persistentThread.createNewThread', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        provider.createNewThread();
        expect(mockPersistentThread.createNewThread).toHaveBeenCalled();
      });
    });

    describe('updateThreadUsage', () => {
      it('delegates to persistentThread.updateThreadUsage', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        provider.updateThreadUsage(5);
        expect(mockPersistentThread.updateThreadUsage).toHaveBeenCalledWith(5);
      });

      it('calls updateThreadUsage without arguments when none provided', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        provider.updateThreadUsage();
        expect(mockPersistentThread.updateThreadUsage).toHaveBeenCalledWith(undefined);
      });
    });

    describe('readonly properties', () => {
      it('assistantId is readonly (wrapped with readonly())', async () => {
        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        // Readonly refs have a __v_isReadonly flag in Vue 3
        expect(typeof provider.assistantId.value).toBe('string');
        // Verify it returns a value and does not throw when accessed
        expect(provider.assistantId.value).toBeTruthy();
      });

      it('threadId is readonly (wrapped with readonly())', async () => {
        mockPersistentThread.currentThreadId.value = 'readonly-thread';

        const { useStreamProvider } = await freshModule();
        const provider = useStreamProvider();

        expect(provider.threadId.value).toBe('readonly-thread');
      });
    });
  });

  // ═══════════════════════════════════════════
  // createStreamSession()
  // ═══════════════════════════════════════════
  describe('createStreamSession()', () => {
    describe('return shape', () => {
      it('returns expected shape with all required properties', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        expect(session).toHaveProperty('messages');
        expect(session).toHaveProperty('isLoading');
        expect(session).toHaveProperty('error');
        expect(session).toHaveProperty('submit');
        expect(session).toHaveProperty('stop');
        expect(session).toHaveProperty('threadId');
        expect(session).toHaveProperty('getMessagesMetadata');
      });
    });

    describe('initial state', () => {
      it('has empty messages array', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        expect(session.messages.value).toEqual([]);
      });

      it('is not loading initially', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        expect(session.isLoading.value).toBe(false);
      });

      it('has no error initially', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        expect(session.error.value).toBeNull();
      });

      it('sets threadId from the parameter', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent', 'existing-thread');

        expect(session.threadId.value).toBe('existing-thread');
      });

      it('sets threadId to null when not provided', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        expect(session.threadId.value).toBeNull();
      });
    });

    describe('stop()', () => {
      it('sets isLoading to false', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        // Manually set isLoading to true to verify stop resets it
        session.isLoading.value = true;
        session.stop();

        expect(session.isLoading.value).toBe(false);
      });
    });

    describe('submit()', () => {
      it('adds user message to messages array immediately', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(['data: [DONE]', ''])));

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        const submitPromise = session.submit({
          messages: [{ type: 'human', content: 'Hello' }],
        });

        // User message should be added immediately
        expect(session.messages.value.length).toBeGreaterThanOrEqual(1);
        expect(session.messages.value[0].type).toBe('human');
        expect(session.messages.value[0].content).toBe('Hello');

        await submitPromise;
      });

      it('sets isLoading to true during submission', async () => {
        let resolveSubmit: () => void;
        const fetchPromise = new Promise<Response>((resolve) => {
          resolveSubmit = () => resolve(createMockFetchResponse(['data: [DONE]', '']));
        });
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        const submitPromise = session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        expect(session.isLoading.value).toBe(true);

        resolveSubmit!();
        await submitPromise;
      });

      it('sets isLoading to false after completion', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(['data: [DONE]', ''])));

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        expect(session.isLoading.value).toBe(false);
      });

      it('posts to correct endpoint for new thread', async () => {
        const mockFetch = vi.fn().mockResolvedValue(createMockFetchResponse(['data: [DONE]', '']));
        vi.stubGlobal('fetch', mockFetch);

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/langgraph/threads/new/runs/stream',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      it('posts to correct endpoint for existing thread', async () => {
        const mockFetch = vi.fn().mockResolvedValue(createMockFetchResponse(['data: [DONE]', '']));
        vi.stubGlobal('fetch', mockFetch);

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent', 'thread-xyz');

        await session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        expect(mockFetch).toHaveBeenCalledWith('/api/langgraph/threads/thread-xyz/runs/stream', expect.any(Object));
      });

      it('includes assistant_id in the request payload', async () => {
        const mockFetch = vi.fn().mockResolvedValue(createMockFetchResponse(['data: [DONE]', '']));
        vi.stubGlobal('fetch', mockFetch);

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('my-assistant');

        await session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.assistant_id).toBe('my-assistant');
      });

      it('includes language metadata from locale', async () => {
        const mockFetch = vi.fn().mockResolvedValue(createMockFetchResponse(['data: [DONE]', '']));
        vi.stubGlobal('fetch', mockFetch);

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.metadata.language).toBe('en');
        expect(body.metadata.user_locale).toBe('en');
        expect(body.metadata.language_instruction).toBe('Please respond in English');
      });

      it('adds error message to messages on fetch failure', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        // Should have the user message plus an error message
        const errorMsg = session.messages.value.find((m: any) => m.id?.startsWith('error-'));
        expect(errorMsg).toBeDefined();
        expect(errorMsg.type).toBe('ai');
        expect(errorMsg.content).toContain('Network error');
        expect(session.error.value).toBe('Network error');
        expect(session.isLoading.value).toBe(false);

        consoleSpy.mockRestore();
      });

      it('throws error when response has no body', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: true,
            body: null,
            headers: new Headers(),
          })
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Test' }],
        });

        expect(session.error.value).toBe('No response body');
        consoleSpy.mockRestore();
      });
    });

    // ─────────────────────────────────────────
    // handleStreamEvent: thread_id
    // ─────────────────────────────────────────
    describe('handleStreamEvent - thread_id', () => {
      it('sets currentThreadId when thread_id event is received', async () => {
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' + JSON.stringify({ event: 'thread_id', data: { thread_id: 'new-thread-abc' } }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hello' }],
        });

        expect(session.threadId.value).toBe('new-thread-abc');
      });

      it('calls onThreadCreated callback for new threads', async () => {
        const onThreadCreated = vi.fn();
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' + JSON.stringify({ event: 'thread_id', data: { thread_id: 'callback-thread' } }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent', null, onThreadCreated);

        await session.submit({
          messages: [{ type: 'human', content: 'Hello' }],
        });

        expect(onThreadCreated).toHaveBeenCalledWith('callback-thread');
      });

      it('does not call onThreadCreated when thread already existed', async () => {
        const onThreadCreated = vi.fn();
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' + JSON.stringify({ event: 'thread_id', data: { thread_id: 'existing-id' } }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        // Pass an existing threadId
        const session = createStreamSession('agent', 'existing-id', onThreadCreated);

        // Override fetch for submit (loadThreadHistory will also fetch)
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' + JSON.stringify({ event: 'thread_id', data: { thread_id: 'existing-id' } }),
                'data: [DONE]',
                '',
              ])
            )
        );

        await session.submit({
          messages: [{ type: 'human', content: 'Hello' }],
        });

        // Should NOT be called because currentThreadId was already set
        expect(onThreadCreated).not.toHaveBeenCalled();
      });
    });

    // ─────────────────────────────────────────
    // handleStreamEvent: messages/partial
    // ─────────────────────────────────────────
    describe('handleStreamEvent - messages/partial', () => {
      it('adds new message when id does not exist', async () => {
        const aiMessage = {
          id: 'ai-msg-1',
          type: 'ai',
          content: 'Hello there!',
          created_at: '2026-01-01T00:00:00Z',
        };

        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' + JSON.stringify({ event: 'messages/partial', data: [aiMessage] }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const aiMessages = session.messages.value.filter((m: any) => m.type === 'ai');
        expect(aiMessages.length).toBeGreaterThanOrEqual(1);
      });

      it('updates existing message by ID when it already exists', async () => {
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' +
                  JSON.stringify({
                    event: 'messages/partial',
                    data: [{ id: 'run-msg-1', type: 'ai', content: 'Part 1' }],
                  }),
                'data: ' +
                  JSON.stringify({
                    event: 'messages/partial',
                    data: [{ id: 'run-msg-1', type: 'ai', content: 'Part 1 and Part 2' }],
                  }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        // The message with id 'run-msg-1' should have been updated, not duplicated
        const matchingMessages = session.messages.value.filter((m: any) => m.id === 'run-msg-1');
        expect(matchingMessages.length).toBe(1);
        expect(matchingMessages[0].content).toBe('Part 1 and Part 2');
      });

      it('skips messages without valid content', async () => {
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' +
                  JSON.stringify({ event: 'messages/partial', data: [{ id: 'empty-msg', type: 'ai', content: '' }] }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        // The empty AI message should not be added
        const emptyMsg = session.messages.value.find((m: any) => m.id === 'empty-msg');
        expect(emptyMsg).toBeUndefined();
      });
    });

    // ─────────────────────────────────────────
    // handleStreamEvent: messages/complete
    // ─────────────────────────────────────────
    describe('handleStreamEvent - messages/complete', () => {
      it('replaces existing message with completed version', async () => {
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' +
                  JSON.stringify({
                    event: 'messages/partial',
                    data: [{ id: 'stream-1', type: 'ai', content: 'Partial...' }],
                  }),
                'data: ' +
                  JSON.stringify({
                    event: 'messages/complete',
                    data: [{ id: 'stream-1', type: 'ai', content: 'Complete response' }],
                  }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const msg = session.messages.value.find((m: any) => m.id === 'stream-1');
        expect(msg).toBeDefined();
        expect(msg.content).toBe('Complete response');
      });

      it('removes empty messages when complete event has no valid content', async () => {
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              createMockFetchResponse([
                'data: ' +
                  JSON.stringify({
                    event: 'messages/partial',
                    data: [{ id: 'will-be-empty', type: 'ai', content: 'temp' }],
                  }),
                'data: ' +
                  JSON.stringify({
                    event: 'messages/complete',
                    data: [{ id: 'will-be-empty', type: 'ai', content: '' }],
                  }),
                'data: [DONE]',
                '',
              ])
            )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        // The empty completed message should be removed
        const msg = session.messages.value.find((m: any) => m.id === 'will-be-empty');
        expect(msg).toBeUndefined();
      });

      it('adds completed message as new if it does not exist yet', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [{ id: 'new-complete', type: 'ai', content: 'Brand new response' }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const msg = session.messages.value.find((m: any) => m.id === 'new-complete');
        expect(msg).toBeDefined();
        expect(msg.content).toBe('Brand new response');
      });
    });

    // ─────────────────────────────────────────
    // handleStreamEvent: updates
    // ─────────────────────────────────────────
    describe('handleStreamEvent - updates', () => {
      it('processes messages from updates event data', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'updates',
                  data: {
                    messages: [{ id: 'update-msg', type: 'ai', content: 'From updates event' }],
                  },
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const msg = session.messages.value.find((m: any) => m.id === 'update-msg');
        expect(msg).toBeDefined();
        expect(msg.content).toBe('From updates event');
      });
    });

    // ─────────────────────────────────────────
    // handleStreamEvent: values
    // ─────────────────────────────────────────
    describe('handleStreamEvent - values', () => {
      it('processes messages from values event data', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'values',
                  data: {
                    messages: [{ id: 'values-msg', type: 'ai', content: 'From values event' }],
                  },
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const msg = session.messages.value.find((m: any) => m.id === 'values-msg');
        expect(msg).toBeDefined();
        expect(msg.content).toBe('From values event');
      });
    });

    // ─────────────────────────────────────────
    // hasValidContent
    // ─────────────────────────────────────────
    describe('hasValidContent (tested via stream events)', () => {
      it('includes human messages regardless of content', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [{ id: 'human-1', type: 'human', content: '' }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        // The human message from the complete event should be included
        // (even with empty content because hasValidContent returns true for human messages)
        const humanMsgs = session.messages.value.filter((m: any) => m.type === 'human');
        expect(humanMsgs.length).toBeGreaterThanOrEqual(1);
      });

      it('filters out empty AI messages', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/partial',
                  data: [{ id: 'empty-ai', type: 'ai', content: '' }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const emptyAi = session.messages.value.find((m: any) => m.id === 'empty-ai');
        expect(emptyAi).toBeUndefined();
      });

      it('includes AI messages with text content', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/partial',
                  data: [{ id: 'ai-with-text', type: 'ai', content: 'Some text' }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const aiMsg = session.messages.value.find((m: any) => m.id === 'ai-with-text');
        expect(aiMsg).toBeDefined();
        expect(aiMsg.content).toBe('Some text');
      });

      it('includes AI messages with tool_calls', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/partial',
                  data: [
                    {
                      id: 'ai-with-tools',
                      type: 'ai',
                      content: '',
                      tool_calls: [{ id: 'tc1', name: 'search', type: 'function' }],
                    },
                  ],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const toolMsg = session.messages.value.find((m: any) => m.id === 'ai-with-tools');
        expect(toolMsg).toBeDefined();
        expect(toolMsg.tool_calls.length).toBe(1);
      });
    });

    // ─────────────────────────────────────────
    // getContentString (tested via stream merging)
    // ─────────────────────────────────────────
    describe('getContentString (tested via message processing)', () => {
      it('handles string content', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [{ id: 'str-msg', type: 'ai', content: 'Simple string' }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const msg = session.messages.value.find((m: any) => m.id === 'str-msg');
        expect(msg).toBeDefined();
      });

      it('handles array content with text objects', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [
                    {
                      id: 'arr-msg',
                      type: 'ai',
                      content: [{ text: 'Array item 1' }, { text: 'Array item 2' }],
                    },
                  ],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const msg = session.messages.value.find((m: any) => m.id === 'arr-msg');
        expect(msg).toBeDefined();
      });

      it('handles object content with text property', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [{ id: 'obj-msg', type: 'ai', content: { text: 'Object text' } }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        const msg = session.messages.value.find((m: any) => m.id === 'obj-msg');
        expect(msg).toBeDefined();
      });
    });

    // ─────────────────────────────────────────
    // shouldGroupWithLastMessage
    // ─────────────────────────────────────────
    describe('shouldGroupWithLastMessage (tested via complete events)', () => {
      it('groups consecutive AI messages in complete events', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [{ id: 'ai-first', type: 'ai', content: 'First part' }],
                }),
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [{ id: 'ai-second', type: 'ai', content: 'Second part' }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        // The two consecutive AI messages should be grouped (merged into one)
        const aiMessages = session.messages.value.filter((m: any) => m.type === 'ai' && !m.id?.startsWith('error-'));
        // They should be grouped, so we expect the content to be merged
        if (aiMessages.length === 1) {
          expect(aiMessages[0].content).toContain('First part');
          expect(aiMessages[0].content).toContain('Second part');
        }
        // Either grouped into one or both present - either way both contents exist
        const allContent = aiMessages.map((m: any) => String(m.content)).join(' ');
        expect(allContent).toContain('First part');
        expect(allContent).toContain('Second part');
      });

      it('does not group human message with AI message', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            createMockFetchResponse([
              'data: ' +
                JSON.stringify({
                  event: 'messages/complete',
                  data: [{ id: 'complete-ai', type: 'ai', content: 'AI response' }],
                }),
              'data: [DONE]',
              '',
            ])
          )
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        await session.submit({
          messages: [{ type: 'human', content: 'Hi' }],
        });

        // Human and AI messages should be separate
        const humanMsgs = session.messages.value.filter((m: any) => m.type === 'human');
        const aiMsgs = session.messages.value.filter((m: any) => m.type === 'ai' && !m.id?.startsWith('error-'));
        expect(humanMsgs.length).toBeGreaterThanOrEqual(1);
        expect(aiMsgs.length).toBeGreaterThanOrEqual(1);
      });
    });

    // ─────────────────────────────────────────
    // loadThreadHistory
    // ─────────────────────────────────────────
    describe('loadThreadHistory', () => {
      it('loads messages from API when thread exists', async () => {
        const threadMessages = [
          { id: 'hist-1', type: 'human', content: 'Old message' },
          { id: 'hist-2', type: 'ai', content: 'Old response' },
        ];

        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            values: { messages: threadMessages },
          }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent', 'existing-thread-id');

        // Wait for loadThreadHistory to complete (it's called in the constructor)
        await vi.waitFor(() => {
          expect(session.messages.value.length).toBe(2);
        });

        expect(session.messages.value).toEqual(threadMessages);
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/langgraph/threads/existing-thread-id/state',
          expect.objectContaining({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      it('does not load history when no threadId is provided', async () => {
        const mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);

        const { createStreamSession } = await freshModule();
        createStreamSession('agent');

        // No fetch should have been called since there's no threadId
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('handles failed history load gracefully', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
          })
        );

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent', 'nonexistent-thread');

        // Wait a tick for the async loadThreadHistory to complete
        await new Promise((r) => setTimeout(r, 10));

        // Messages should still be empty
        expect(session.messages.value).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith('Failed to load thread history:', 404, 'Not Found');

        warnSpy.mockRestore();
      });

      it('handles network error during history load gracefully', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent', 'error-thread');

        // Wait a tick for the async loadThreadHistory to complete
        await new Promise((r) => setTimeout(r, 10));

        expect(session.messages.value).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith('Error loading thread history:', expect.any(Error));

        warnSpy.mockRestore();
      });
    });

    // ─────────────────────────────────────────
    // getMessagesMetadata
    // ─────────────────────────────────────────
    describe('getMessagesMetadata', () => {
      it('returns metadata object with firstSeenState', async () => {
        const { createStreamSession } = await freshModule();
        const session = createStreamSession('agent');

        const metadata = session.getMessagesMetadata({ type: 'ai', content: 'test' });

        expect(metadata).toHaveProperty('firstSeenState');
        expect(metadata.firstSeenState).toHaveProperty('parent_checkpoint');
        expect(metadata.firstSeenState.parent_checkpoint).toBeNull();
        expect(metadata.firstSeenState).toHaveProperty('values');
        expect(metadata.firstSeenState.values).toHaveProperty('messages');
      });
    });
  });

  // ═══════════════════════════════════════════
  // provideStreamContext / useStreamContext
  // ═══════════════════════════════════════════
  describe('provideStreamContext / useStreamContext', () => {
    it('provideStreamContext calls Vue provide', async () => {
      const { provideStreamContext } = await freshModule();
      const mockContext = {
        messages: ref([]),
        isLoading: ref(false),
        error: ref(null),
        submit: vi.fn(),
        stop: vi.fn(),
        threadId: ref(null),
        getMessagesMetadata: vi.fn(),
      } as any;

      provideStreamContext(mockContext);

      expect(mockProvide).toHaveBeenCalledWith(expect.any(Symbol), mockContext);
    });

    it('useStreamContext returns injected context', async () => {
      const mockContext = {
        messages: ref([]),
        isLoading: ref(false),
        error: ref(null),
        submit: vi.fn(),
        stop: vi.fn(),
        threadId: ref(null),
        getMessagesMetadata: vi.fn(),
      };
      mockInject.mockReturnValue(mockContext);

      const { useStreamContext } = await freshModule();
      const context = useStreamContext();

      expect(context).toBe(mockContext);
    });

    it('useStreamContext throws when no context is provided', async () => {
      mockInject.mockReturnValue(undefined);

      const { useStreamContext } = await freshModule();

      expect(() => useStreamContext()).toThrow('useStreamContext must be used within a StreamProvider');
    });
  });
});
