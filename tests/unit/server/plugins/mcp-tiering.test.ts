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

function makeTools() {
  return [
    {
      name: freeName,
      description: 'a free tool',
      cache: '1h',
      handler: vi.fn(async () => ({ content: [{ type: 'text', text: 'free-result' }] })),
    },
    {
      name: 'wheel-search',
      description: 'a paid tool',
      cache: undefined,
      handler: vi.fn(async () => ({ content: [{ type: 'text', text: 'paid-result' }] })),
    },
  ];
}

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

    const gated = config.tools.find((t: any) => t.name === 'wheel-search') as any;
    expect(gated.description).toContain('/developers');
    // The stub must never inherit a cache wrapper — a cached upsell answer
    // under the real tool's key could be served to a paid caller.
    expect(gated.cache).toBeUndefined();

    const result = await gated.handler();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('/developers');
    expect(tools[1].handler).not.toHaveBeenCalled();
    expect(mockRecordGated).toHaveBeenCalledWith(expect.anything(), 'wheel-search');
  });

  it('free tier: free tools stay live and record usage after the call', async () => {
    const fn = hookFn();
    const tools = makeTools();
    const config = { tools: [...tools] };
    fn({ config, event: eventWithTier('free') });

    const free = config.tools.find((t: any) => t.name === freeName) as any;
    const result = await free.handler({ some: 'args' });
    expect(result.content[0].text).toBe('free-result');
    expect(tools[0].handler).toHaveBeenCalledWith({ some: 'args' });
    expect(mockRecordUsage).toHaveBeenCalledWith(expect.anything(), freeName);
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

    const gated = config.tools.find((t: any) => t.name === 'wheel-search') as any;
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
