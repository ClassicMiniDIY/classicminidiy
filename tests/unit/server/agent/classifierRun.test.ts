// @vitest-environment node
/**
 * The classifier run handle: the part that can fail, and must fail into
 * "went without it". `askTypeSafe` is mocked; no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = (data: any) => data;
  (globalThis as any).errorResult = (message: string) => ({ error: message });
});

const ask = vi.fn();
const config = { TYPESAFE_API_KEY: 'k', TYPESAFE_CHAT_MODE: 'hint' };

vi.mock('~~/server/utils/typesafe', async () => {
  const actual = await vi.importActual<typeof import('~~/server/utils/typesafe')>('~~/server/utils/typesafe');
  return {
    ...actual,
    askTypeSafe: (...args: unknown[]) => ask(...args),
    typesafeConfigured: () => Boolean(config.TYPESAFE_API_KEY),
  };
});
vi.mock('~~/server/utils/runtimeConfig', () => ({ serverRuntimeConfig: () => config }));

const { runClassifier, userTurns, CLASSIFIER_CEILING_MS } = await import('~~/server/agent/classifierRun');

const event = {} as any;
const tools = [{ name: 'torque-specs', use: 'torque' }];
const messages = [
  { role: 'user', parts: [{ type: 'text', text: 'first' }] },
  { role: 'assistant', parts: [{ type: 'text', text: 'reply' }] },
  {
    role: 'user',
    parts: [
      { type: 'text', text: 'main bearing torque?' },
      { type: 'file', url: 'x' },
    ],
  },
] as any;

function goodAnswer() {
  return {
    answers: {
      tier: { type: 'choice', choice: 'specification', confidence: 0.9, probabilities: { specification: 0.9 } },
      tool: { type: 'choice', choice: 'torque-specs', confidence: 0.8, probabilities: { 'torque-specs': 0.8 } },
      tool_only: { type: 'noul', noul: 0.6 },
      safety_critical: { type: 'noul', noul: 0.1 },
      about_mini: { type: 'noul', noul: 0.9 },
      injection: { type: 'noul', noul: 0.01 },
      harmful: { type: 'noul', noul: 0.01 },
      severity: { type: 'score', score: 0.1, confidence: 0.9, legend: {}, probabilities: {} },
    },
    model: 'jev-1.13.0',
    inputTokens: 1800,
    durationMs: 300,
  };
}

beforeEach(() => {
  ask.mockReset();
  config.TYPESAFE_API_KEY = 'k';
  config.TYPESAFE_CHAT_MODE = 'hint';
});

describe('userTurns', () => {
  it('takes text parts of the last two user messages only', () => {
    expect(userTurns(messages)).toEqual({ latest: 'main bearing torque?', previous: 'first' });
  });
});

describe('runClassifier', () => {
  it('is off, and never calls TypeSafe, when the mode is unset', async () => {
    config.TYPESAFE_CHAT_MODE = '';
    const run = runClassifier(event, { messages, tools });
    expect(await run.collect()).toMatchObject({ mode: 'off', hint: null, analytics: { classifier: 'off' } });
    expect(ask).not.toHaveBeenCalled();
  });

  it('is skipped, not off, when the mode is set but the key is missing', async () => {
    config.TYPESAFE_API_KEY = '';
    const run = runClassifier(event, { messages, tools });
    expect((await run.collect()).analytics).toEqual({ classifier: 'skipped' });
    expect(ask).not.toHaveBeenCalled();
  });

  it('starts the call immediately, before collect()', () => {
    ask.mockReturnValue(new Promise(() => {}));
    runClassifier(event, { messages, tools });
    expect(ask).toHaveBeenCalledTimes(1);
    const [, state] = ask.mock.calls[0]!;
    expect(state.message).toBe('main bearing torque?');
    expect(state.previous).toBe('first');
  });

  it('hints in hint mode and only stamps analytics in shadow mode', async () => {
    ask.mockResolvedValue(goodAnswer());
    const hinted = await runClassifier(event, { messages, tools }).collect();
    expect(hinted.hint).toContain('`torque-specs`');
    expect(hinted.analytics).toMatchObject({
      classifier: 'hint',
      classifier_hinted: true,
      classified_tier: 'specification',
    });

    config.TYPESAFE_CHAT_MODE = 'shadow';
    const shadow = await runClassifier(event, { messages, tools }).collect();
    expect(shadow.hint).toBeNull();
    expect(shadow.analytics).toMatchObject({
      classifier: 'shadow',
      classifier_hinted: false,
      classified_tool: 'torque-specs',
    });
  });

  it('collapses a thrown call to error with no hint', async () => {
    ask.mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await runClassifier(event, { messages, tools }).collect();
    expect(r.hint).toBeNull();
    expect(r.analytics).toMatchObject({ classifier: 'error' });
    warn.mockRestore();
  });

  it('gives up at the ceiling, aborts the call, and says skipped', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    ask.mockImplementation((_e: unknown, _s: unknown, _q: unknown, meta: { signal?: AbortSignal }) => {
      signal = meta.signal;
      return new Promise(() => {});
    });
    const pending = runClassifier(event, { messages, tools }).collect();
    await vi.advanceTimersByTimeAsync(CLASSIFIER_CEILING_MS + 1);
    const r = await pending;
    expect(r.hint).toBeNull();
    expect(r.analytics).toMatchObject({ classifier: 'skipped' });
    expect(signal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it('reports what it has so far for a run that ends early', async () => {
    ask.mockResolvedValue(goodAnswer());
    const run = runClassifier(event, { messages, tools });
    expect(run.analyticsSoFar()).toEqual({ classifier: 'skipped' });
    await run.collect();
    expect(run.analyticsSoFar()).toMatchObject({ classifier: 'hint', classified_tier: 'specification' });
  });
});
