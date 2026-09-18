// @vitest-environment node
/**
 * The marketplace text screen and the model safety read: the pure halves,
 * and the "never breaks the route" posture of the impure one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ask = vi.fn();
const settingsRows = vi.fn();
const config: Record<string, string> = { TYPESAFE_API_KEY: 'k', TYPESAFE_MODELS_MODE: '' };

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
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({ in: () => Promise.resolve(settingsRows()) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}));

const screen = await import('~~/server/utils/exchange/screen');
const safety = await import('~~/server/utils/models/safetyRead');

const event = {} as any;
function n(p: number) {
  return { noul: p };
}
function goodAnswers(over: Record<string, unknown> = {}) {
  return {
    answers: {
      impersonation: n(0.02),
      off_platform: n(0.03),
      deposit: n(0.01),
      harassment: n(0),
      about_listing: n(0.9),
      severity: { score: 0.2 },
      ...over,
    },
    model: 'jev-1.13.0',
    inputTokens: 700,
    durationMs: 200,
  };
}

beforeEach(() => {
  ask.mockReset();
  settingsRows.mockReset();
  screen._resetScreenSettingsCache();
  config.TYPESAFE_API_KEY = 'k';
  config.TYPESAFE_MODELS_MODE = '';
  settingsRows.mockReturnValue({
    data: [
      { key: 'message_screen_mode', value: 'hold' },
      { key: 'message_screen_thresholds', value: { flag: 0.7, severity: 2 } },
    ],
    error: null,
  });
});

describe('decideScreen', () => {
  const t = screen.DEFAULT_THRESHOLDS;
  it('clears a clean message and tags exactly what tripped', () => {
    expect(screen.decideScreen(goodAnswers().answers as any, t)).toMatchObject({ decision: 'clear', tags: [] });
    const d = screen.decideScreen(
      goodAnswers({ impersonation: n(0.9), deposit: n(0.7), severity: { score: 2.5 } }).answers as any,
      t
    );
    expect(d.decision).toBe('hold');
    expect(d.tags).toEqual(['impersonation', 'deposit', 'severity']);
  });
  it('never holds on about_listing alone', () => {
    expect(screen.decideScreen(goodAnswers({ about_listing: n(0) }).answers as any, t).decision).toBe('clear');
  });
});

describe('parseScreenMode / parseThresholds', () => {
  it('is off unless shadow or hold, and bounds the thresholds', () => {
    expect(screen.parseScreenMode('HOLD')).toBe('hold');
    expect(screen.parseScreenMode('on')).toBe('off');
    expect(screen.parseThresholds({ flag: 5, severity: -1 })).toEqual({ flag: 1, severity: 0.5 });
    expect(screen.parseThresholds(null)).toEqual(screen.DEFAULT_THRESHOLDS);
  });
});

describe('screenMarketplaceText', () => {
  it('holds in hold mode, reports the mode, and sends only text, title and a context line', async () => {
    ask.mockResolvedValue(goodAnswers({ off_platform: n(0.95) }));
    const v = await screen.screenMarketplaceText(event, 'email me at ...', {
      caller: 'wanted-post-create',
      context: 'A wanted post',
      title: 'Wanted: HS4 carb',
    });
    expect(v).toMatchObject({ mode: 'hold', decision: 'hold', tags: ['off_platform'], model: 'jev-1.13.0' });
    const state = ask.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(state).sort()).toEqual(['context', 'text', 'title']);
  });

  it('reports shadow so the caller changes nothing', async () => {
    settingsRows.mockReturnValue({ data: [{ key: 'message_screen_mode', value: 'shadow' }], error: null });
    ask.mockResolvedValue(goodAnswers({ deposit: n(0.99) }));
    const v = await screen.screenMarketplaceText(event, 'send a deposit first', { caller: 'x', context: 'c' });
    expect(v.mode).toBe('shadow');
    expect(v.decision).toBe('hold');
  });

  it('is skipped when off, when the key is missing, when settings fail, and when the call throws', async () => {
    settingsRows.mockReturnValue({ data: [{ key: 'message_screen_mode', value: 'off' }], error: null });
    expect((await screen.screenMarketplaceText(event, 'hi', { caller: 'x', context: 'c' })).decision).toBe('skipped');
    expect(ask).not.toHaveBeenCalled();

    screen._resetScreenSettingsCache();
    settingsRows.mockReturnValue({ data: null, error: { message: 'boom' } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await screen.screenMarketplaceText(event, 'hi', { caller: 'x', context: 'c' })).mode).toBe('off');

    screen._resetScreenSettingsCache();
    settingsRows.mockReturnValue({ data: [{ key: 'message_screen_mode', value: 'hold' }], error: null });
    ask.mockRejectedValue(new Error('down'));
    const v = await screen.screenMarketplaceText(event, 'hi', { caller: 'x', context: 'c' });
    expect(v.decision).toBe('skipped');
    expect(v.mode).toBe('hold');
    warn.mockRestore();
  });

  it('keeps the last good mode when the settings read fails, instead of flipping the switch', async () => {
    ask.mockResolvedValue(goodAnswers({ deposit: n(0.95) }));
    expect((await screen.screenMarketplaceText(event, 'a', { caller: 'x', context: 'c' })).mode).toBe('hold');
    // Force a re-read that fails.
    settingsRows.mockReturnValue({ data: null, error: { message: 'boom' } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    const v = await screen.screenMarketplaceText(event, 'b', { caller: 'x', context: 'c' });
    vi.useRealTimers();
    warn.mockRestore();
    expect(v.mode).toBe('hold');
    expect(v.decision).toBe('hold');
  });

  it('caches the settings row for a minute', async () => {
    ask.mockResolvedValue(goodAnswers());
    await screen.screenMarketplaceText(event, 'a', { caller: 'x', context: 'c' });
    await screen.screenMarketplaceText(event, 'b', { caller: 'x', context: 'c' });
    expect(settingsRows).toHaveBeenCalledTimes(1);
  });
});

describe('model safety read', () => {
  it('isSafetyCritical is the seller flag OR the model at the threshold, never less', () => {
    expect(safety.isSafetyCritical(true, null)).toBe(true);
    expect(safety.isSafetyCritical(false, 0.7)).toBe(true);
    expect(safety.isSafetyCritical(false, 0.69)).toBe(false);
    expect(safety.isSafetyCritical(true, 0.01)).toBe(true);
    expect(safety.isSafetyCritical(null, null)).toBe(false);
  });

  it('does nothing unless TYPESAFE_MODELS_MODE is on', async () => {
    expect(await safety.readModelSafety(event, 'm1', { title: 'Brake bracket' })).toBeNull();
    expect(ask).not.toHaveBeenCalled();
    config.TYPESAFE_MODELS_MODE = 'on';
    ask.mockResolvedValue({
      answers: { safety_critical: n(0.91) },
      model: 'jev-1.13.0',
      inputTokens: 300,
      durationMs: 100,
    });
    expect(await safety.readModelSafety(event, 'm1', { title: 'Brake bracket' })).toEqual({
      p: 0.91,
      model: 'jev-1.13.0',
    });
  });

  it('never throws when the read fails', async () => {
    config.TYPESAFE_MODELS_MODE = 'on';
    ask.mockRejectedValue(new Error('down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await safety.readModelSafety(event, 'm1', { title: 'x' })).toBeNull();
    warn.mockRestore();
  });
});
