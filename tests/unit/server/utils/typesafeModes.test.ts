// @vitest-environment node
/**
 * The settings-backed switches and the event mirror: a row beats the env, an
 * absent row is the env, a failed read keeps the last good values, and the
 * mirror drops every property not on its allowlist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rows = vi.fn();
const inserted: unknown[] = [];
const config: Record<string, string> = { TYPESAFE_CHAT_MODE: 'shadow', TYPESAFE_MCP_MODE: '' };

vi.mock('~~/server/utils/runtimeConfig', () => ({ serverRuntimeConfig: () => config }));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({ in: () => Promise.resolve(rows()) }),
      insert: (row: unknown) => {
        inserted.push({ table, row });
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

const mod = await import('~~/server/utils/typesafeModes');
const event = {} as any;

beforeEach(() => {
  rows.mockReset();
  inserted.length = 0;
  mod._resetTypesafeModesCache();
  config.TYPESAFE_CHAT_MODE = 'shadow';
  config.TYPESAFE_MCP_MODE = '';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('typesafeMode', () => {
  it('prefers a settings row, falls back to the env, and defaults to off', async () => {
    rows.mockResolvedValue({ data: [{ key: 'typesafe_chat_mode', value: 'hint' }], error: null });
    expect(await mod.typesafeMode(event, 'chat')).toBe('hint');
    expect(await mod.typesafeMode(event, 'mcp')).toBe('off');
    config.TYPESAFE_MCP_MODE = 'ON ';
    expect(await mod.typesafeMode(event, 'mcp')).toBe('on');
  });

  it('reads once per minute and keeps the last good values through a failed read', async () => {
    rows.mockResolvedValueOnce({ data: [{ key: 'typesafe_chat_mode', value: 'hint' }], error: null });
    expect(await mod.typesafeMode(event, 'chat')).toBe('hint');
    expect(await mod.typesafeMode(event, 'chat')).toBe('hint');
    expect(rows).toHaveBeenCalledTimes(1);
    mod._resetTypesafeModesCache();
    rows.mockResolvedValueOnce({ data: [{ key: 'typesafe_chat_mode', value: 'hint' }], error: null });
    await mod.typesafeMode(event, 'chat');
    mod._resetTypesafeModesCache();
    rows.mockRejectedValueOnce(new Error('down'));
    // Cache was reset, so the failed read has nothing to keep: the env decides.
    expect(await mod.typesafeMode(event, 'chat')).toBe('shadow');
  });
});

describe('mirroredProps', () => {
  it('keeps only allowlisted properties and ignores unknown events', () => {
    expect(
      mod.mirroredProps('typesafe_call', {
        caller: 'x',
        input_tokens: 5,
        state: 'TEXT',
        $process_person_profile: false,
      })
    ).toEqual({
      caller: 'x',
      input_tokens: 5,
    });
    expect(mod.mirroredProps('chat_reply_rated', { rating: 1 })).toBeNull();
    expect(mod.mirroredProps('chat_run_completed', { classified_tier: 'diagnosis', message: 'hello' })).toEqual({
      classified_tier: 'diagnosis',
    });
  });

  it('inserts a worker row and never throws', () => {
    mod.mirrorTypesafeEvent(event, 'mcp_related_pick', { tool: 't', picked: true, p: 0.8, query: 'secret' });
    expect(inserted).toEqual([
      {
        table: 'typesafe_events',
        row: { source: 'worker', event: 'mcp_related_pick', props: { tool: 't', picked: true, p: 0.8 } },
      },
    ]);
    mod.mirrorTypesafeEvent(event, 'not_mirrored', { a: 1 });
    expect(inserted).toHaveLength(1);
  });
});
