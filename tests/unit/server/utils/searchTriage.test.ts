// @vitest-environment node
/**
 * The search-surface TypeSafe reads: the miss triage writes a label and never
 * throws; the intent shadow logs beside the regex kind and never returns
 * anything a caller could act on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ask = vi.fn();
const rpc = vi.fn();
const capture = vi.fn();
const config: Record<string, string> = { TYPESAFE_API_KEY: 'k', TYPESAFE_SEARCH_MODE: '' };

vi.mock('~~/server/utils/typesafe', async () => {
  const actual = await vi.importActual<typeof import('~~/server/utils/typesafe')>('~~/server/utils/typesafe');
  return {
    ...actual,
    askTypeSafe: (...args: unknown[]) => ask(...args),
    typesafeConfigured: () => Boolean(config.TYPESAFE_API_KEY),
  };
});
vi.mock('~~/server/utils/runtimeConfig', () => ({ serverRuntimeConfig: () => config }));
vi.mock('~~/server/utils/typesafeModes', () => ({
  typesafeMode: async (_e: unknown, surface: string) =>
    (
      ({
        chat: 'TYPESAFE_CHAT_MODE',
        models: 'TYPESAFE_MODELS_MODE',
        search: 'TYPESAFE_SEARCH_MODE',
        queue: 'TYPESAFE_QUEUE_MODE',
        mcp: 'TYPESAFE_MCP_MODE',
      }) as Record<string, string>
    )[surface]
      ? (
          config[
            (
              {
                chat: 'TYPESAFE_CHAT_MODE',
                models: 'TYPESAFE_MODELS_MODE',
                search: 'TYPESAFE_SEARCH_MODE',
                queue: 'TYPESAFE_QUEUE_MODE',
                mcp: 'TYPESAFE_MCP_MODE',
              } as Record<string, string>
            )[surface]!
          ] || 'off'
        )
          .trim()
          .toLowerCase()
      : 'off',
  mirrorTypesafeEvent: () => {},
}));
vi.mock('~~/server/utils/supabase', () => ({ getServiceClient: () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }));
vi.mock('~~/server/utils/chatUsage', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }));

const triage = await import('~~/server/utils/searchTriage');

const event = {} as any;
function c(choice: string, confidence = 0.8) {
  return { choice, confidence, probabilities: {} };
}
function answer(answers: Record<string, unknown>) {
  return { answers, model: 'jev-1.13.0', inputTokens: 500, durationMs: 120 };
}

beforeEach(() => {
  ask.mockReset();
  rpc.mockReset();
  capture.mockReset();
  config.TYPESAFE_API_KEY = 'k';
  config.TYPESAFE_SEARCH_MODE = '';
  rpc.mockResolvedValue({ data: true, error: null });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('typoCandidates', () => {
  it('shortlists catalogue names that share characters with the query', () => {
    const names = triage.typoCandidates('compresion ratio');
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThanOrEqual(5);
    expect(names.some((n) => /compression/i.test(n))).toBe(true);
  });

  it('returns nothing for a query nothing resembles', () => {
    expect(triage.typoCandidates('zzqx')).toEqual([]);
  });
});

describe('buildTriageRequest', () => {
  it('always offers `none` and lists every candidate as a correction', () => {
    const req = triage.buildTriageRequest('gearbox ratois');
    const options = Object.keys((req.questions.corrected as any).criteria);
    expect(options[0]).toBe('none');
    for (const c of req.candidates) expect(options).toContain(c);
    expect(req.state.surfaces).toHaveLength(8);
    expect(req.state.query).toBe('gearbox ratois');
  });
});

describe('triageSearchMiss', () => {
  it('writes the kind and, for a typo, the chosen candidate', async () => {
    const req = triage.buildTriageRequest('compresion ratio');
    const meant = req.candidates[0]!;
    ask.mockResolvedValue(answer({ kind: c('typo', 0.91), corrected: c(meant, 0.7) }));
    await triage.triageSearchMiss(event, 'compresion ratio');
    expect(rpc).toHaveBeenCalledWith('record_search_miss_triage', {
      p_query: 'compresion ratio',
      p_kind: 'typo',
      p_p: 0.91,
      p_corrected: meant,
      p_version: 'jev-1.13.0',
    });
  });

  it('drops the correction when the kind is not typo, or the choice is not a candidate', async () => {
    ask.mockResolvedValue(answer({ kind: c('missing_content', 0.66), corrected: c('Compression Ratio Calculator') }));
    await triage.triageSearchMiss(event, 'compresion ratio');
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_kind: 'missing_content', p_corrected: undefined });

    rpc.mockClear();
    ask.mockResolvedValue(answer({ kind: c('typo', 0.8), corrected: c('Something Invented') }));
    await triage.triageSearchMiss(event, 'compresion ratio');
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_kind: 'typo', p_corrected: undefined });
  });

  it('maps an unknown kind to junk rather than failing the write', async () => {
    ask.mockResolvedValue(answer({ kind: c('unexpected', 0.5), corrected: c('none') }));
    await triage.triageSearchMiss(event, 'anything at all');
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_kind: 'junk' });
  });

  it('does nothing without a key, and swallows an API failure', async () => {
    config.TYPESAFE_API_KEY = '';
    await triage.triageSearchMiss(event, 'compresion ratio');
    expect(ask).not.toHaveBeenCalled();

    config.TYPESAFE_API_KEY = 'k';
    ask.mockRejectedValue(new Error('boom'));
    await expect(triage.triageSearchMiss(event, 'compresion ratio')).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes an abort signal and no retries', async () => {
    ask.mockResolvedValue(answer({ kind: c('junk'), corrected: c('none') }));
    await triage.triageSearchMiss(event, 'compresion ratio');
    const meta = ask.mock.calls[0]![3] as any;
    expect(meta.caller).toBe('search-miss-triage');
    expect(meta.signal).toBeInstanceOf(AbortSignal);
    expect(meta.retry).toEqual({ maxRetries: 0 });
  });
});

describe('shadowSearchIntent', () => {
  it('is off unless the mode is shadow', async () => {
    const waits: Promise<unknown>[] = [];
    const ev = { waitUntil: (p: Promise<unknown>) => waits.push(p) } as any;
    triage.shadowSearchIntent(ev, 'wiper motor', { kind: 'lookup', lead: 'archive' });
    await Promise.all(waits);
    expect(ask).not.toHaveBeenCalled();
    config.TYPESAFE_SEARCH_MODE = 'shadow';
    config.TYPESAFE_API_KEY = '';
    triage.shadowSearchIntent(ev, 'wiper motor', { kind: 'lookup', lead: 'archive' });
    await Promise.all(waits);
    expect(ask).not.toHaveBeenCalled();
  });

  it('runs only for lookup and question kinds', async () => {
    config.TYPESAFE_SEARCH_MODE = 'shadow';
    ask.mockResolvedValue(answer({ kind: c('lookup'), lead: c('archive') }));
    const waits: Promise<unknown>[] = [];
    const ev = { waitUntil: (p: Promise<unknown>) => waits.push(p) } as any;
    triage.shadowSearchIntent(ev, '12G940', { kind: 'part-number', lead: 'parts' });
    await Promise.all(waits);
    expect(ask).not.toHaveBeenCalled();
    triage.shadowSearchIntent(ev, 'wiper motor', { kind: 'lookup', lead: 'archive' });
    await Promise.all(waits);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('logs agreement beside the regex answer and returns nothing', async () => {
    config.TYPESAFE_SEARCH_MODE = 'shadow';
    const waits: Promise<unknown>[] = [];
    const ev = { waitUntil: (p: Promise<unknown>) => waits.push(p) } as any;
    ask.mockResolvedValue(answer({ kind: c('question', 0.77), lead: c('videos', 0.6) }));
    const out = triage.shadowSearchIntent(ev, 'why does my mini overheat', { kind: 'question', lead: 'archive' });
    expect(out).toBeUndefined();
    await Promise.all(waits);
    expect(capture).toHaveBeenCalledTimes(1);
    const [, name, , props] = capture.mock.calls[0]!;
    expect(name).toBe('search_intent_shadow');
    expect(props).toMatchObject({
      regex_kind: 'question',
      model_kind: 'question',
      model_kind_p: 0.77,
      regex_lead: 'archive',
      model_lead: 'videos',
      agree_kind: true,
      agree_lead: false,
    });
  });

  it('counts a failure as an error outcome and never throws', async () => {
    config.TYPESAFE_SEARCH_MODE = 'shadow';
    const waits: Promise<unknown>[] = [];
    const ev = { waitUntil: (p: Promise<unknown>) => waits.push(p) } as any;
    ask.mockRejectedValue(new Error('boom'));
    triage.shadowSearchIntent(ev, 'wiper motor', { kind: 'lookup', lead: 'archive' });
    await expect(Promise.all(waits)).resolves.toBeDefined();
    expect(capture.mock.calls[0]![3]).toMatchObject({ outcome: 'error', regex_kind: 'lookup', regex_lead: 'archive' });
  });

  it('counts the ceiling as a timeout outcome', async () => {
    config.TYPESAFE_SEARCH_MODE = 'shadow';
    const waits: Promise<unknown>[] = [];
    const ev = { waitUntil: (p: Promise<unknown>) => waits.push(p) } as any;
    ask.mockImplementation(
      (_e: unknown, _s: unknown, _q: unknown, meta: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => meta.signal.addEventListener('abort', () => reject(new Error('aborted'))))
    );
    triage.shadowSearchIntent(ev, 'wiper motor', { kind: 'lookup', lead: 'archive' });
    await Promise.all(waits);
    expect(capture.mock.calls[0]![3]).toMatchObject({ outcome: 'timeout' });
  });
});
