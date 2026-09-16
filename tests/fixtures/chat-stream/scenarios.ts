/**
 * The scenarios behind the `/api/chat` stream fixtures, and the pipeline that
 * turns them into bytes.
 *
 * Shared by `scripts/record-chat-stream-fixtures.ts` (writes the files) and
 * `tests/unit/server/fixtures/chatStreamFixtures.test.ts` (regenerates each
 * scenario in memory and asserts the bytes still equal the committed file).
 * The second use is what makes the fixtures a two-way tripwire: a test that
 * only re-READS the committed bytes would stay green through a writer-side
 * change the reader tolerates, which is exactly the change that breaks a
 * native parser on live traffic.
 *
 * These files are the parity contract between the Worker and the two native
 * Toolbox apps (toolbox-ios/docs/plans/2026-09-15-native-ai-chat.md §5.1,
 * §6.2, §9). Each app copies them verbatim into its test resources, feeds the
 * `.sse` bytes to its own parser, and asserts it reproduces the matching
 * `.expected.json` — the `UIMessage` the web's `useChat` would have stored.
 * Two parsers that agree with these files agree with each other.
 *
 * Why a scripted model and not a live recording. What the fixtures pin is the
 * SSE framing and the part shapes, and both come from this repo's installed
 * `ai` package — `toUIMessageStreamResponse()` and the same `streamText` loop
 * the route runs — not from Anthropic. A scripted model makes the bytes
 * deterministic, so the recorder can be re-run after an SDK upgrade and the
 * diff read, and it is the only way to produce the two failure cases on
 * demand: a model stream that dies after the first sentence, and a tool call
 * whose input fails the tool's schema. A live recording would cost a few cents
 * and produce a new transcript every time.
 *
 */
import { z } from 'zod';
import { readUIMessageStream, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { CHAT_QUOTAS, MEMBERSHIP_URL } from '../../../shared/utils/chatTiers';

/** The `video-search` result shape from `server/agent/tools.ts`, verbatim. */
const VIDEO_RESULTS = {
  query: 'brake bleeding',
  checked: true,
  videos: [
    {
      videoId: 'fx1Kq9ZQ8xA',
      title: 'How to bleed the brakes on a Classic Mini',
      url: 'https://www.youtube.com/watch?v=fx1Kq9ZQ8xA',
      thumbnail: 'https://i.ytimg.com/vi/fx1Kq9ZQ8xA/hqdefault.jpg',
      publishedAt: '2023-04-12T14:00:00Z',
      score: 0.61,
    },
    {
      videoId: 'Qm2vT7rYz0c',
      title: 'Classic Mini rear brake adjustment',
      url: 'https://www.youtube.com/watch?v=Qm2vT7rYz0c',
      thumbnail: 'https://i.ytimg.com/vi/Qm2vT7rYz0c/hqdefault.jpg',
      publishedAt: '2022-09-03T10:30:00Z',
      score: 0.47,
    },
    {
      videoId: 'Lp0aXd3wN9E',
      title: 'Steering rack rebuild',
      url: 'https://www.youtube.com/watch?v=Lp0aXd3wN9E',
      thumbnail: 'https://i.ytimg.com/vi/Lp0aXd3wN9E/hqdefault.jpg',
      publishedAt: '2021-01-19T09:00:00Z',
      score: 0.31,
    },
  ],
};

const videoSearch = tool({
  description: 'Search the Classic Mini DIY YouTube channel.',
  inputSchema: z.object({
    query: z.string().min(2),
    limit: z.number().int().positive().max(6).default(3),
  }),
  async execute() {
    return VIDEO_RESULTS;
  },
});

const usage = {
  inputTokens: { total: 1200, noCache: 200, cacheRead: 1000, cacheWrite: 0 },
  outputTokens: { total: 40, text: 40, reasoning: 0 },
  raw: {},
};

// The V3 provider spec carries the finish reason as `{ unified, raw }`; a bare
// string reads as `undefined` and the loop stops after one step.
const finish = (reason: 'stop' | 'tool-calls') => ({
  type: 'finish' as const,
  finishReason: { unified: reason, raw: reason },
  usage,
});

const textParts = (id: string, deltas: string[]) => [
  { type: 'text-start' as const, id },
  ...deltas.map((delta) => ({ type: 'text-delta' as const, id, delta })),
  { type: 'text-end' as const, id },
];

const stepStream = (parts: unknown[]) => ({
  stream: simulateReadableStream({ chunks: [{ type: 'stream-start', warnings: [] }, ...parts] as any[] }),
});

export interface Scenario {
  name: string;
  prompt: string;
  /** A factory: a ReadableStream can be read once, and each scenario is run twice. */
  steps: () => { stream: ReadableStream<any> }[];
}

export const scenarios: Scenario[] = [
  {
    name: 'text-only',
    prompt: 'What is the torque for the cylinder head nuts on a 1275?',
    steps: () => [
      stepStream([
        ...textParts('txt-1', [
          'The cylinder head nuts on an A-series 1275 torque to ',
          '**42 lb-ft** (57 Nm), in the sequence from the centre outwards.',
        ]),
        finish('stop'),
      ]),
    ],
  },
  {
    name: 'tool-call-video',
    prompt: 'How do I bleed the brakes?',
    steps: () => [
      stepStream([
        { type: 'tool-input-start', id: 'call-video-1', toolName: 'video-search' },
        { type: 'tool-input-delta', id: 'call-video-1', delta: '{"query":"brake' },
        { type: 'tool-input-delta', id: 'call-video-1', delta: ' bleeding","limit":3}' },
        { type: 'tool-input-end', id: 'call-video-1' },
        {
          type: 'tool-call',
          toolCallId: 'call-video-1',
          toolName: 'video-search',
          input: '{"query":"brake bleeding","limit":3}',
        },
        finish('tool-calls'),
      ]),
      stepStream([
        ...textParts('txt-2', [
          'Start at the wheel furthest from the master cylinder (rear nearside), ',
          'then work towards it. Cole has a video on the whole job.',
        ]),
        finish('stop'),
      ]),
    ],
  },
  {
    name: 'tool-input-error',
    prompt: 'Any videos on brakes?',
    steps: () => [
      stepStream([
        { type: 'tool-input-start', id: 'call-video-2', toolName: 'video-search' },
        { type: 'tool-input-delta', id: 'call-video-2', delta: '{"query":"","limit":"three"}' },
        { type: 'tool-input-end', id: 'call-video-2' },
        // Fails `inputSchema`: `query` is too short and `limit` is a string.
        // The SDK turns this into a `tool-input-error` chunk instead of running
        // the tool, then asks the model again with the error as a tool result.
        {
          type: 'tool-call',
          toolCallId: 'call-video-2',
          toolName: 'video-search',
          input: '{"query":"","limit":"three"}',
        },
        finish('tool-calls'),
      ]),
      stepStream([
        ...textParts('txt-3', ['I could not run the video search just now. Try asking for a specific job.']),
        finish('stop'),
      ]),
    ],
  },
  {
    name: 'error-mid-stream',
    prompt: 'Which SU needle for a 998 with a stage one kit?',
    // The provider reports a dropped upstream connection as an `error` stream
    // part after the text it already had (this is how `@ai-sdk/anthropic`
    // surfaces a mid-stream failure), and `streamText` forwards it as an
    // `error` chunk whose text is the route's `onError` default. The SDK then
    // still emits `finish-step` and `finish` (`finishReason: "error"`) before
    // `[DONE]`; the open text part is left `state: "streaming"`.
    steps: () => [
      stepStream([
        { type: 'text-start', id: 'txt-4' },
        { type: 'text-delta', id: 'txt-4', delta: 'For a 998 with a stage one kit on an HS4, ' },
        { type: 'error', error: new Error('upstream connection reset') },
      ]),
    ],
  },
];

function run(scenario: Scenario) {
  return streamText({
    model: new MockLanguageModelV3({ doStream: scenario.steps() as any }),
    messages: [{ role: 'user', content: scenario.prompt }],
    tools: { 'video-search': videoSearch },
    stopWhen: stepCountIs(6),
    onError() {
      // The route logs and records this; the fixtures stay quiet.
    },
  });
}

/** The exact bytes the route would send for this scenario. */
export async function renderScenarioSse(scenario: Scenario): Promise<string> {
  // The same response the route returns, so the bytes are what a phone sees.
  return run(scenario).toUIMessageStreamResponse().text();
}

/** What the web's `useChat` would have stored after this scenario's stream. */
export async function renderScenarioExpected(scenario: Scenario): Promise<UIMessage> {
  let last: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: run(scenario).toUIMessageStream() })) {
    last = message;
  }
  if (!last) throw new Error(`${scenario.name}: readUIMessageStream produced no message`);
  return last;
}

/**
 * The quota refusal, in the exact shape Nitro's production error handler
 * serialises (`error: true`, `url`, `statusCode`, `statusMessage`, `message`,
 * `data`). `message` text is copy and the apps must never key on it; they key
 * on `statusCode` and `data.tier`.
 */
export const quota429Body = {
  error: true,
  url: 'https://www.classicminidiy.com/api/chat',
  statusCode: 429,
  statusMessage: 'Too Many Requests',
  message:
    'You have reached the monthly message limit. ' +
    `Sustaining Members get a much higher allowance — ${MEMBERSHIP_URL}`,
  data: {
    tier: 'free',
    used: CHAT_QUOTAS.free.perMonth,
    limit: CHAT_QUOTAS.free.perMonth,
    upgradeUrl: MEMBERSHIP_URL,
  },
};
