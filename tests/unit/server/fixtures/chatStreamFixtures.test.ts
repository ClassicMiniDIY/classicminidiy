/** @vitest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readUIMessageStream, uiMessageChunkSchema, type UIMessage, type UIMessageChunk } from 'ai';
import { CHAT_QUOTAS, MEMBERSHIP_URL } from '~~/shared/utils/chatTiers';
import {
  quota429Body,
  renderScenarioExpected,
  renderScenarioSse,
  scenarios,
} from '~~/tests/fixtures/chat-stream/scenarios';

/**
 * The recorded `/api/chat` stream fixtures are the parity contract with the
 * native Toolbox apps (toolbox-ios/docs/plans/2026-09-15-native-ai-chat.md
 * §5.1, §9.1). Each app copies `tests/fixtures/chat-stream/` verbatim and
 * asserts its own SSE parser turns the `.sse` bytes into the matching
 * `.expected.json`. This test is the Worker's half of that promise: the
 * fixtures must still be what THIS repo's installed `ai` package produces and
 * understands. An SDK upgrade that renames a part or changes the framing fails
 * here first, before either app is told the contract moved.
 *
 * Re-record with `bun run scripts/record-chat-stream-fixtures.ts`.
 */
const FIXTURE_DIR = join(fileURLToPath(new URL('../../../../', import.meta.url)), 'tests/fixtures/chat-stream');

/** The four stream scenarios every native parser must reproduce. */
const SCENARIOS = ['text-only', 'tool-call-video', 'tool-input-error', 'error-mid-stream'] as const;

/**
 * Split an SSE body into its `data:` payloads, the way a native client must:
 * events are delimited by a blank line, and network chunks do not align with
 * events. `[DONE]` terminates.
 */
function sseEvents(raw: string): string[] {
  const out: string[] = [];
  for (const block of raw.split('\n\n')) {
    const line = block.trim();
    if (!line) continue;
    expect(line.startsWith('data: '), `unexpected SSE line: ${line.slice(0, 60)}`).toBe(true);
    const payload = line.slice('data: '.length);
    if (payload === '[DONE]') break;
    out.push(payload);
  }
  return out;
}

async function chunksOf(raw: string): Promise<UIMessageChunk[]> {
  const chunks: UIMessageChunk[] = [];
  for (const payload of sseEvents(raw)) {
    const parsed = JSON.parse(payload);
    // Validate against the SDK's own schema, so a part the SDK no longer
    // recognises is a failure here rather than a silent skip on a phone.
    // `uiMessageChunkSchema` is lazy: call it for the Schema, then validate.
    const result = await uiMessageChunkSchema().validate!(parsed);
    expect(result.success, `chunk is not a valid UIMessageChunk: ${payload.slice(0, 80)}`).toBe(true);
    chunks.push(parsed as UIMessageChunk);
  }
  return chunks;
}

async function parse(raw: string): Promise<UIMessage> {
  const chunks = await chunksOf(raw);
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  let last: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream })) last = message;
  if (!last) throw new Error('readUIMessageStream produced no message');
  return last;
}

const read = (name: string) => readFileSync(join(FIXTURE_DIR, name), 'utf8');

describe('chat stream fixtures', () => {
  it('ships exactly the files the apps copy', () => {
    const files = readdirSync(FIXTURE_DIR).sort();
    expect(files).toEqual([
      'README.md',
      'error-mid-stream.expected.json',
      'error-mid-stream.sse',
      'quota-429.json',
      'scenarios.ts',
      'text-only.expected.json',
      'text-only.sse',
      'tool-call-video.expected.json',
      'tool-call-video.sse',
      'tool-input-error.expected.json',
      'tool-input-error.sse',
    ]);
  });

  describe.each(SCENARIOS)('%s', (name) => {
    const raw = read(`${name}.sse`);
    const expected = JSON.parse(read(`${name}.expected.json`)) as UIMessage;

    it('is SSE terminated by [DONE]', () => {
      expect(raw.endsWith('data: [DONE]\n\n')).toBe(true);
      expect(raw.startsWith('data: {"type":"start"}\n\n')).toBe(true);
    });

    it('parses with readUIMessageStream to the expected UIMessage', async () => {
      const message = await parse(raw);
      expect(message.role).toBe('assistant');
      expect(message.parts).toEqual(expected.parts);
    });

    it('is still exactly what the installed SDK writes for this scenario', async () => {
      // The writer-side half of the tripwire. Re-reading the committed bytes
      // (above) proves the SDK still tolerates them; this proves it still
      // PRODUCES them. A renamed field or a new chunk the reader shrugs off
      // would otherwise pass here and break a native parser on live traffic.
      const scenario = scenarios.find((entry) => entry.name === name);
      expect(scenario, `no scenario named ${name} in scenarios.ts`).toBeDefined();
      expect(await renderScenarioSse(scenario!)).toBe(raw);
      expect((await renderScenarioExpected(scenario!)).parts).toEqual(expected.parts);
    });

    it('opens with a step-start so the web replays the turn boundaries', () => {
      // `convertToModelMessages` splits an assistant turn on `step-start`. A
      // phone-authored thread without it replays differently on the web.
      expect(expected.parts[0]).toEqual({ type: 'step-start' });
    });
  });

  it('text-only: the text part is closed', () => {
    const expected = JSON.parse(read('text-only.expected.json')) as UIMessage;
    expect(expected.parts).toEqual([{ type: 'step-start' }, { type: 'text', text: expect.any(String), state: 'done' }]);
  });

  it('tool-call-video: the tool part carries the raw SDK state and a rail-shaped output', () => {
    const expected = JSON.parse(read('tool-call-video.expected.json')) as UIMessage;
    const tool = expected.parts.find((part) => part.type === 'tool-video-search') as any;
    expect(tool).toMatchObject({ toolCallId: 'call-video-1', state: 'output-available' });
    // Three videos across the rail threshold (0.4): two shown, one dropped —
    // the case `chatVideoRail.test.ts` and both native rail tests reproduce.
    const scores = tool.output.videos.map((video: { score: number }) => video.score);
    expect(scores.filter((score: number) => score >= 0.4)).toHaveLength(2);
    expect(scores.filter((score: number) => score < 0.4)).toHaveLength(1);
    // The turn continues after the tool, in a new step.
    expect(expected.parts.map((part) => part.type)).toEqual(['step-start', 'tool-video-search', 'step-start', 'text']);
  });

  it('tool-input-error: an invalid tool call is stored as output-error with rawInput, and the reply still finishes', () => {
    const raw = read('tool-input-error.sse');
    const types = sseEvents(raw).map((payload) => JSON.parse(payload).type);
    // The SDK follows `tool-input-error` with `tool-output-error` for the same
    // call and then asks the model again. Native parsers must accept both and
    // must not treat the first as fatal.
    expect(types).toContain('tool-input-error');
    expect(types.indexOf('tool-output-error')).toBeGreaterThan(types.indexOf('tool-input-error'));
    expect(types.at(-1)).toBe('finish');

    const expected = JSON.parse(read('tool-input-error.expected.json')) as UIMessage;
    const tool = expected.parts.find((part) => part.type === 'tool-video-search') as any;
    expect(tool).toMatchObject({ state: 'output-error', errorText: 'An error occurred.' });
    // What `useChat` stores for a rejected input is `rawInput`, not `input`.
    expect(tool.rawInput).toEqual({ query: '', limit: 'three' });
    expect(tool.input).toBeUndefined();
  });

  it('error-mid-stream: error is followed by finish, and the partial text stays', () => {
    const raw = read('error-mid-stream.sse');
    const types = sseEvents(raw).map((payload) => JSON.parse(payload).type);
    // `error` is NOT the last event. The SDK still emits `finish-step` and a
    // `finish` with `finishReason: "error"`. A parser that closes on `error`
    // and then chokes on the trailing events would lose the partial reply.
    expect(types).toEqual(['start', 'start-step', 'text-start', 'text-delta', 'error', 'finish-step', 'finish']);
    const errorEvent = sseEvents(raw)
      .map((payload) => JSON.parse(payload))
      .find((chunk) => chunk.type === 'error');
    expect(errorEvent.errorText).toBe('An error occurred.');

    const expected = JSON.parse(read('error-mid-stream.expected.json')) as UIMessage;
    // No `text-end` arrived, so the stored part is still `streaming`.
    expect(expected.parts).toEqual([
      { type: 'step-start' },
      { type: 'text', text: 'For a 998 with a stage one kit on an HS4, ', state: 'streaming' },
    ]);
  });

  it('quota-429.json is the production 429 body the apps classify', () => {
    const body = JSON.parse(read('quota-429.json'));
    expect(body).toEqual(quota429Body);
    expect(body).toMatchObject({
      error: true,
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      data: {
        tier: 'free',
        used: CHAT_QUOTAS.free.perMonth,
        limit: CHAT_QUOTAS.free.perMonth,
        upgradeUrl: MEMBERSHIP_URL,
      },
    });
    expect(Object.keys(body.data).sort()).toEqual(['limit', 'tier', 'upgradeUrl', 'used']);
  });
});
