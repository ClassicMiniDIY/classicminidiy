// @vitest-environment node
/**
 * The queue duplicate hint: scores only what code found, stores once, and
 * never throws into the admin list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ask = vi.fn();
const rpc = vi.fn();
const config: Record<string, string> = { TYPESAFE_API_KEY: 'k', TYPESAFE_QUEUE_MODE: 'on' };

vi.mock('~~/server/utils/typesafe', async () => {
  const actual = await vi.importActual<typeof import('~~/server/utils/typesafe')>('~~/server/utils/typesafe');
  return {
    ...actual,
    askTypeSafe: (...args: unknown[]) => ask(...args),
    typesafeConfigured: () => Boolean(config.TYPESAFE_API_KEY),
  };
});
vi.mock('~~/server/utils/runtimeConfig', () => ({ serverRuntimeConfig: () => config }));
vi.mock('~~/server/utils/supabase', () => ({ getServiceClient: () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }));

const mod = await import('~~/server/utils/queueDuplicates');
const event = {} as any;
const rows = [
  { id: 'a', name: 'Almond Green', code: 'GN37', detail: 'code GN37', exact_code: true, sim: 1 },
  { id: 'b', name: 'Almond Green', code: 'BLVC1212', detail: 'code BLVC1212', exact_code: false, sim: 1 },
  { id: 'c', name: 'Glen Green', code: 'GN40', detail: 'code GN40', exact_code: false, sim: 0.4 },
];
const sub = { id: 's1', targetType: 'color', data: { name: 'Almond Green', code: 'GN 37' } };
const scoreAnswer = (probs: Record<string, number>) => ({ probabilities: probs, score: 0, confidence: 0.8 });

beforeEach(() => {
  ask.mockReset();
  rpc.mockReset();
  config.TYPESAFE_API_KEY = 'k';
  config.TYPESAFE_QUEUE_MODE = 'on';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('buildDuplicateRequest', () => {
  it('asks one three-level score per candidate and sends only summary fields', () => {
    const req = mod.buildDuplicateRequest('color', { name: 'Almond Green', code: 'GN 37', secret: 'x' }, rows);
    expect(Object.keys(req.questions)).toEqual(['c0', 'c1', 'c2']);
    expect((req.questions.c0 as any).criteria).toHaveLength(3);
    expect(req.state.submission).toEqual({ name: 'Almond Green', code: 'GN 37' });
    expect(req.state.candidates[0]).toEqual({ name: 'Almond Green', code: 'GN37', detail: 'code GN37' });
  });
});

describe('hintSubmissionDuplicates', () => {
  it('is null when off or for other target types, without any call', async () => {
    config.TYPESAFE_QUEUE_MODE = '';
    expect(await mod.hintSubmissionDuplicates(event, sub)).toBeNull();
    config.TYPESAFE_QUEUE_MODE = 'on';
    expect(await mod.hintSubmissionDuplicates(event, { ...sub, targetType: 'registry' })).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('stores an empty hint when code finds no candidate, without asking the model', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: true, error: null });
    const hint = await mod.hintSubmissionDuplicates(event, sub);
    expect(hint).toEqual({ candidates: [], top: null });
    expect(ask).not.toHaveBeenCalled();
    expect(rpc.mock.calls[1]![0]).toBe('record_submission_duplicate_hint');
    expect(rpc.mock.calls[1]![1]).toMatchObject({ p_submission_id: 's1', p_version: 'none' });
  });

  it('scores the candidates, sorts by p_same, and names a top above the floor', async () => {
    rpc.mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: true, error: null });
    ask.mockResolvedValue({
      answers: {
        c0: scoreAnswer({ '0': 0.05, '1': 0.1, '2': 0.85 }),
        c1: scoreAnswer({ '0': 0.2, '1': 0.6, '2': 0.2 }),
        c2: scoreAnswer({ '0': 0.9, '1': 0.08, '2': 0.02 }),
      },
      model: 'jev-1.13.0',
      inputTokens: 900,
      durationMs: 300,
    });
    const hint = await mod.hintSubmissionDuplicates(event, sub);
    expect(hint!.candidates.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(hint!.candidates[0]).toMatchObject({ level: 'same', p_same: 0.85 });
    expect(hint!.candidates[1]).toMatchObject({ level: 'variant', p_variant: 0.6 });
    expect(hint!.top).toEqual({ id: 'a', level: 'same', p: 0.85 });
    expect(rpc.mock.calls[1]![1]).toMatchObject({ p_version: 'jev-1.13.0' });
  });

  it('has no top when the best candidate is different or under the floor', async () => {
    rpc
      .mockResolvedValueOnce({ data: rows.slice(0, 1), error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    ask.mockResolvedValue({
      answers: { c0: scoreAnswer({ '0': 0.5, '1': 0.3, '2': 0.2 }) },
      model: 'jev-1.13.0',
      inputTokens: 1,
      durationMs: 1,
    });
    const hint = await mod.hintSubmissionDuplicates(event, sub);
    expect(hint!.top).toBeNull();
    expect(hint!.candidates[0]!.level).toBe('different');
  });

  it('returns null and writes nothing when the model fails, so the next load retries', async () => {
    rpc.mockResolvedValueOnce({ data: rows, error: null });
    ask.mockRejectedValue(new Error('boom'));
    expect(await mod.hintSubmissionDuplicates(event, sub)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
