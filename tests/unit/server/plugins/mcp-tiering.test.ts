/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { hookRegistry } = vi.hoisted(() => {
  const hookRegistry: Record<string, Function> = {};
  (globalThis as any).defineNitroPlugin = (setup: Function) => setup;
  return { hookRegistry };
});

const { mockRecordUsage, mockRecordGated } = vi.hoisted(() => ({
  mockRecordUsage: vi.fn(),
  mockRecordGated: vi.fn(),
}));

vi.mock('~/server/utils/mcpUsage', () => ({
  recordMcpUsage: mockRecordUsage,
  recordMcpGated: mockRecordGated,
}));

import plugin from '~/server/plugins/mcp-tiering';
import { FREE_TOOLS } from '~/server/utils/mcpTiers';

/** Register the plugin against a fake nitroApp and return the hook fn. */
function hookFn(): Function {
  (plugin as unknown as Function)({
    hooks: {
      hook: (name: string, fn: Function) => {
        hookRegistry[name] = fn;
      },
    },
  });
  const fn = hookRegistry['mcp:config:resolved'];
  expect(fn).toBeTypeOf('function');
  return fn;
}

const freeName = [...FREE_TOOLS][0];

// The REAL shape the toolkit hands the hook: scanned definitions carry NO
// top-level `name` — only `_meta.filename` (the template emits
// `{ ...def, _meta: { filename } }`, and the display name is derived at
// registration, AFTER the hook). Tests that handed defs WITH names were
// exactly how the gate-everything-for-free-keys bug shipped to production.
function makeTools() {
  return [
    {
      _meta: { filename: `${freeName}.ts` },
      description: 'a free tool',
      cache: '1h',
      handler: vi.fn(async () => ({ content: [{ type: 'text', text: 'free-result' }] })),
    },
    {
      _meta: { filename: 'wheel-search.ts' },
      description: 'a paid tool',
      cache: undefined,
      handler: vi.fn(async () => ({ content: [{ type: 'text', text: 'paid-result' }] })),
    },
  ];
}

const byFilename = (tools: any[], filename: string) => tools.find((t) => t._meta?.filename === filename);

function eventWithTier(tier?: string) {
  return { context: tier ? { mcpAuth: { tier } } : {} } as any;
}

describe('server/plugins/mcp-tiering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('free tier: paid tools become visible-but-gated stubs with the upgrade pointer', async () => {
    const fn = hookFn();
    const tools = makeTools();
    const config = { tools: [...tools] };
    fn({ config, event: eventWithTier('free') });

    const gated = byFilename(config.tools, 'wheel-search.ts');
    expect(gated.description).toContain('/developers');
    // The stub must never inherit a cache wrapper — a cached upsell answer
    // under the real tool's key could be served to a paid caller.
    expect(gated.cache).toBeUndefined();

    const result = await gated.handler();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('/developers');
    // The name must be derived from _meta.filename — 'The "undefined" tool'
    // is what production shipped before this derivation existed.
    expect(result.content[0].text).toContain('"wheel-search"');
    expect(tools[1].handler).not.toHaveBeenCalled();
    expect(mockRecordGated).toHaveBeenCalledWith(expect.anything(), 'wheel-search');
  });

  it('free tier: free tools stay live and record usage after the call', async () => {
    const fn = hookFn();
    const tools = makeTools();
    const config = { tools: [...tools] };
    fn({ config, event: eventWithTier('free') });

    const free = byFilename(config.tools, `${freeName}.ts`);
    const result = await free.handler({ some: 'args' });
    expect(result.content[0].text).toBe('free-result');
    expect(tools[0].handler).toHaveBeenCalledWith({ some: 'args' });
    expect(mockRecordUsage).toHaveBeenCalledWith(expect.anything(), freeName);
  });

  it('an explicit top-level name still wins over the filename derivation', async () => {
    const fn = hookFn();
    const config = {
      tools: [
        {
          name: freeName,
          _meta: { filename: 'wheel-search.ts' },
          handler: vi.fn(async () => ({ content: [{ type: 'text', text: 'named-result' }] })),
        },
      ],
    };
    fn({ config, event: eventWithTier('free') });
    // Named as a free tool, so it stays live despite the paid-looking filename.
    const result = await (config.tools[0] as any).handler();
    expect(result.content[0].text).toBe('named-result');
  });

  it.each(['developer', 'internal'])('%s tier: every tool stays live', async (tier) => {
    const fn = hookFn();
    const config = { tools: makeTools() };
    fn({ config, event: eventWithTier(tier) });

    for (const tool of config.tools as any[]) {
      const result = await tool.handler();
      expect(result.isError).toBeUndefined();
    }
    expect(mockRecordUsage).toHaveBeenCalledTimes(2);
    expect(mockRecordGated).not.toHaveBeenCalled();
  });

  it('a missing auth context resolves to the FREE tier — fail closed by construction', async () => {
    const fn = hookFn();
    const config = { tools: makeTools() };
    fn({ config, event: eventWithTier(undefined) });

    const gated = byFilename(config.tools, 'wheel-search.ts');
    expect((await gated.handler()).isError).toBe(true);
  });

  it('never mutates the shared definition objects', () => {
    const fn = hookFn();
    const tools = makeTools();
    const originalPaidHandler = tools[1].handler;
    const originalPaidDescription = tools[1].description;
    const config = { tools: [...tools] };
    fn({ config, event: eventWithTier('free') });

    // The array was replaced with copies; the module-level defs are untouched.
    expect(tools[1].handler).toBe(originalPaidHandler);
    expect(tools[1].description).toBe(originalPaidDescription);
    expect(config.tools[1]).not.toBe(tools[1]);
  });

  it('usage recording failures never fail the tool call', async () => {
    mockRecordUsage.mockImplementation(() => {
      throw new Error('capture exploded');
    });
    const fn = hookFn();
    const config = { tools: makeTools() };
    fn({ config, event: eventWithTier('developer') });

    // The wrapper swallows a throwing capture: the caller still gets the
    // tool's real result, never an error caused by telemetry.
    const free = config.tools[0] as any;
    const result = await free.handler();
    expect(result.content[0].text).toBe('free-result');
  });
});
