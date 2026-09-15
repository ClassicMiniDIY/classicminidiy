import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// ---------------------------------------------------------------------------
// useChatAnswer — the one transport to /api/chat, shared by /chat and the
// /search answer panel.
//
// What must not drift when the shell around it changes: the request body
// carries locale, the page and the thread id read at SEND time; the outgoing
// transcript is windowed; the rails and the quota verdict derive from the
// transcript alone.
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({ transportOptions: null as any, chat: null as any }));

vi.mock('ai', () => ({
  DefaultChatTransport: class {
    constructor(options: any) {
      state.transportOptions = options;
    }
  },
}));
vi.mock('@ai-sdk/vue', async () => {
  const { ref: vueRef, shallowRef: vueShallowRef } = await import('vue');
  state.chat = {
    messages: vueShallowRef<any[]>([]),
    status: vueRef('ready'),
    error: vueRef<Error | undefined>(undefined),
    sendMessage: vi.fn(),
    stop: vi.fn(),
  };
  return { useChat: () => state.chat };
});
const transportOptions = {
  get value() {
    return state.transportOptions;
  },
};
const messages = () => state.chat.messages;
const status = () => state.chat.status;
const error = () => state.chat.error;

const localeRef = ref('en');
(global as any).useI18n = () => ({ t: (k: string) => k, locale: localeRef });

const { useChatAnswer, REQUEST_MESSAGE_WINDOW } = await import('~/composables/useChatAnswer');

beforeEach(() => {
  messages().value = [];
  status().value = 'ready';
  error().value = undefined;
  localeRef.value = 'en';
});

describe('useChatAnswer', () => {
  it('sends locale, page and thread id as read at request time', () => {
    const threadId = ref('t-1');
    let page = '/search';
    useChatAnswer({ threadId, pageSlug: () => page });
    expect(transportOptions.value.api).toBe('/api/chat');

    localeRef.value = 'de';
    threadId.value = 't-2';
    page = '/chat';
    expect(transportOptions.value.body()).toEqual({ locale: 'de', pageSlug: '/chat', threadId: 't-2' });
  });

  it('windows the outgoing transcript to the request limit', () => {
    useChatAnswer({ threadId: ref('t'), pageSlug: () => '/' });
    const outgoing = Array.from({ length: REQUEST_MESSAGE_WINDOW + 10 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 ? 'assistant' : 'user',
      parts: [{ type: 'text', text: `message ${i}` }],
    }));
    const request = transportOptions.value.prepareSendMessagesRequest({ messages: outgoing, body: { x: 1 } });
    expect(request.body.x).toBe(1);
    expect(request.body.messages.length).toBeLessThanOrEqual(REQUEST_MESSAGE_WINDOW);
    expect(request.body.messages.at(-1)?.id).toBe(outgoing.at(-1)?.id);
  });

  it('derives loading, the rails and the quota verdict from the transcript', () => {
    const answer = useChatAnswer({ threadId: ref('t'), pageSlug: () => '/' });
    expect(answer.isLoading.value).toBe(false);
    status().value = 'streaming';
    expect(answer.isLoading.value).toBe(true);

    messages().value = [
      {
        id: 'a',
        role: 'assistant',
        parts: [
          { type: 'tool-site-search', output: { results: [{ url: '/x', title: 'X', score: 0.5 }] } },
          {
            type: 'tool-video-search',
            output: {
              videos: [
                {
                  videoId: 'v',
                  title: 'V',
                  url: 'https://www.youtube.com/watch?v=v',
                  thumbnail: '',
                  publishedAt: '2024-01-01T00:00:00Z',
                  score: 0.9,
                },
              ],
            },
          },
        ],
      },
    ];
    expect(answer.usefulLinks.value.map((l) => l.url)).toEqual(['/x']);
    expect(answer.videos.value.map((v) => v.videoId)).toEqual(['v']);

    expect(answer.quotaError.value).toBeNull();
    error().value = new Error(JSON.stringify({ statusCode: 429, data: { tier: 'anonymous', used: 15, limit: 15 } }));
    expect(answer.quotaError.value?.tier).toBe('anonymous');
  });
});
