// @vitest-environment node
/**
 * The near-miss pick: a hint beside `related`, never a change to it, and
 * nothing at all without the switch, the event, or two rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ask = vi.fn();
const capture = vi.fn();
const config: Record<string, string> = { TYPESAFE_API_KEY: 'k', TYPESAFE_MCP_MODE: '' };

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
vi.mock('~~/server/utils/chatUsage', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }));

// The toolkit's auto-imports, stubbed the same way the agent bridge tests do.
(globalThis as any).defineMcpTool = (config: any) => config;
(globalThis as any).jsonResult = (data: any) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

const mod = await import('~~/server/utils/mcpRelatedPick');
const torque = (await import('~~/server/mcp/tools/torque-specs')).default as any;

const event = {} as any;
const related = [
  {
    section: 'engineTable',
    sectionTitle: 'Engine',
    excludedBy: 'bolts',
    item: { name: 'Main Bearing Nuts', lbft: '67', notes: '1275' },
  },
  {
    section: 'engineTable',
    sectionTitle: 'Engine',
    excludedBy: 'bolts',
    item: { name: 'Main Bearing Set Screws', lbft: '63', notes: '970/1071' },
  },
];

beforeEach(() => {
  ask.mockReset();
  capture.mockReset();
  config.TYPESAFE_API_KEY = 'k';
  config.TYPESAFE_MCP_MODE = 'on';
});

describe('pickRelated', () => {
  it('is null without the switch, without an event, or with fewer than two rows', async () => {
    config.TYPESAFE_MCP_MODE = '';
    expect(await mod.pickRelated(event, 'torque-specs', 'fastener', 'main bearing bolts 1275', related)).toBeNull();
    config.TYPESAFE_MCP_MODE = 'on';
    expect(await mod.pickRelated(undefined, 'torque-specs', 'fastener', 'main bearing bolts 1275', related)).toBeNull();
    expect(await mod.pickRelated(event, 'torque-specs', 'fastener', 'x', related.slice(0, 1))).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });

  it('offers every row plus none, and returns the index with its confidence', async () => {
    ask.mockResolvedValue({
      answers: { pick: { choice: '0', confidence: 0.82, probabilities: {} } },
      model: 'jev-1.13.0',
      inputTokens: 300,
      durationMs: 90,
    });
    const pick = await mod.pickRelated(event, 'torque-specs', 'fastener', 'main bearing bolts 1275', related);
    expect(pick).toEqual({ index: 0, p: 0.82 });
    const questions = ask.mock.calls[0]![2] as any;
    expect(Object.keys(questions.pick.criteria)).toEqual(['0', '1', 'none']);
    expect(questions.pick.criteria['0']).toContain('Main Bearing Nuts');
    expect(capture.mock.calls[0]![3]).toMatchObject({ tool: 'torque-specs', rows: 2, picked: true, p: 0.82 });
  });

  it('is null on none, on an out-of-range index, under the floor, and on failure', async () => {
    ask.mockResolvedValue({
      answers: { pick: { choice: 'none', confidence: 0.9, probabilities: {} } },
      model: 'jev-1.13.0',
      inputTokens: 1,
      durationMs: 1,
    });
    expect(await mod.pickRelated(event, 't', 's', 'q w', related)).toBeNull();
    ask.mockResolvedValue({
      answers: { pick: { choice: '7', confidence: 0.9, probabilities: {} } },
      model: 'jev-1.13.0',
      inputTokens: 1,
      durationMs: 1,
    });
    expect(await mod.pickRelated(event, 't', 's', 'q w', related)).toBeNull();
    ask.mockResolvedValue({
      answers: { pick: { choice: '1', confidence: mod.RELATED_PICK_MIN - 0.01, probabilities: {} } },
      model: 'jev-1.13.0',
      inputTokens: 1,
      durationMs: 1,
    });
    expect(await mod.pickRelated(event, 't', 's', 'q w', related)).toBeNull();
    ask.mockRejectedValue(new Error('boom'));
    expect(await mod.pickRelated(event, 't', 's', 'q w', related)).toBeNull();
  });
});

describe('relatedPickNote', () => {
  it('names the row and says it is a hint', () => {
    const note = mod.relatedPickNote({ index: 1, p: 0.7 }, related as any)!;
    expect(note).toContain('Main Bearing Set Screws');
    expect(note).toContain('0.70');
    expect(note).toMatch(/hint/);
    expect(mod.relatedPickNote(null, related as any)).toBeUndefined();
  });
});

describe('torque-specs with the pick', () => {
  it('keeps every related row and adds relatedPick beside them', async () => {
    ask.mockResolvedValue({
      answers: { pick: { choice: '1', confidence: 0.77, probabilities: {} } },
      model: 'jev-1.13.0',
      inputTokens: 1,
      durationMs: 1,
    });
    const raw = await torque.handler({ query: 'main bearing bolts 1275', limit: 50 }, { event });
    const out = JSON.parse(raw.content[0].text);
    expect(out.related.length).toBeGreaterThanOrEqual(2);
    expect(out.relatedPick).toEqual({ index: 1, p: 0.77 });
    expect(out.relatedNote).toContain('relatedPick');
    // The same call without the switch: identical rows, no pick.
    config.TYPESAFE_MCP_MODE = '';
    const plain = JSON.parse(
      (await torque.handler({ query: 'main bearing bolts 1275', limit: 50 }, { event })).content[0].text
    );
    expect(plain.related).toEqual(out.related);
    expect(plain.relatedPick).toBeNull();
  });
});
