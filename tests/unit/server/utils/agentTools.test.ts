// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// The tool files call bare `defineMcpTool` / `jsonResult` / `errorResult`, which
// Nitro auto-imports. Vitest applies no Nitro transform, so they are stubbed
// here with the toolkit's REAL implementations — an identity function and the
// two envelope builders — so `unwrapToolResult` is exercised against the shape
// production actually produces, rather than a flattened stand-in.
//
// IMPORTANT: because these are stubs, nothing in this file proves the
// auto-import works in a build. That is a different failure (`jsonResult is not
// defined`, thrown from inside a tool call) and it is exactly how /mcp 500'd for
// months with a green suite. It was verified separately by building for
// cloudflare_module and invoking the bridged tools through a real Nitro server.
vi.hoisted(() => {
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = (data: any, pretty = true) => ({
    content: [{ type: 'text', text: pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data) }],
  });
  (globalThis as any).errorResult = (message: string) => ({
    content: [{ type: 'text', text: message }],
    isError: true,
  });
});

const { AGENT_MCP_TOOL_NAMES, buildMcpTools, unwrapToolResult, toAiTool } = await import('~~/server/utils/agentTools');

describe('unwrapToolResult', () => {
  it('parses the JSON that jsonResult() stringified', () => {
    const envelope = (globalThis as any).jsonResult({ totalMatches: 2, matches: ['a', 'b'] });
    expect(unwrapToolResult(envelope)).toEqual({ totalMatches: 2, matches: ['a', 'b'] });
  });

  it('surfaces an errorResult as data, not an exception', () => {
    // Throwing would abort the whole run. "No rows matched, try fewer words" is
    // a useful next step for the model, so it has to come back as a value.
    const envelope = (globalThis as any).errorResult('No chassis number matched.');
    expect(unwrapToolResult(envelope)).toEqual({ error: 'No chassis number matched.' });
  });

  it('returns prose unchanged when the payload is not JSON', () => {
    expect(unwrapToolResult({ content: [{ type: 'text', text: 'plain prose' }] })).toBe('plain prose');
  });

  it('joins multiple text parts', () => {
    expect(
      unwrapToolResult({
        content: [
          { type: 'text', text: 'one' },
          { type: 'text', text: 'two' },
        ],
      })
    ).toBe('one\ntwo');
  });

  it('ignores non-text parts', () => {
    expect(
      unwrapToolResult({
        content: [
          { type: 'image', data: 'xxx' },
          { type: 'text', text: 'caption' },
        ],
      })
    ).toBe('caption');
  });

  it('passes through a value that is not an envelope', () => {
    expect(unwrapToolResult({ plain: 'object' })).toEqual({ plain: 'object' });
    expect(unwrapToolResult('a string')).toBe('a string');
    expect(unwrapToolResult(null)).toBeNull();
  });
});

describe('buildMcpTools', () => {
  const tools = buildMcpTools();

  it('exposes all twelve reference tools', () => {
    expect(AGENT_MCP_TOOL_NAMES).toEqual([
      'chassis-decoder',
      'clearances',
      'color-lookup',
      'compression-calculator',
      'engine-decoder',
      'gearbox-calculator',
      'needle-compare',
      'parts-equivalency',
      'parts-lookup',
      'torque-specs',
      'vehicle-weights',
      'wheel-search',
    ]);
    expect(Object.keys(tools).sort()).toEqual(AGENT_MCP_TOOL_NAMES);
  });

  it('includes the four paid-only tools', () => {
    // The Developer API paywall gates third-party programmatic access, not the
    // site's own assistant. Wrapping this registry in the mcp-tiering gate would
    // silently remove identification and archive lookups from the chat.
    for (const name of ['chassis-decoder', 'engine-decoder', 'wheel-search', 'color-lookup']) {
      expect(tools[name], `${name} must be available to the chat agent`).toBeDefined();
    }
  });

  it('gives every tool a description for the model to route on', () => {
    for (const [name, tool] of Object.entries(tools)) {
      expect((tool as any).description, `${name} has no description`).toBeTruthy();
    }
  });

  it('answers a real lookup end to end', async () => {
    const result: any = await (tools['torque-specs'] as any).execute({ query: 'main bearing', limit: 3 });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.matches[0].item).toHaveProperty('lbft');
  });

  it('preserves inputSchema defaults through z.object()', async () => {
    // compression-calculator is entirely defaults-driven. If the bridge ever
    // stops wrapping the ZodRawShape with z.object(), every default is lost and
    // the tool silently returns nulls instead of failing.
    const schema = (tools['compression-calculator'] as any).inputSchema as z.ZodTypeAny;
    const parsed = schema.parse({});
    expect(parsed).toMatchObject({ bore: expect.any(Number), stroke: expect.any(Number) });

    const result: any = await (tools['compression-calculator'] as any).execute(parsed);
    expect(result.results.compressionRatio).toBeGreaterThan(0);
    expect(result.results.engineCapacity).toBeGreaterThan(0);
  });
});

describe('the MCP request context stub', () => {
  it('throws on any property access rather than returning undefined', async () => {
    // No handler uses `extra` today. One that starts to must fail loudly here,
    // not silently read undefined from a request context that does not exist
    // when the tool runs in-process.
    const nosy = toAiTool('nosy', {
      description: 'reads extra',
      inputSchema: {},
      handler: (_args: unknown, extra: any) => extra.requestId,
    });
    await expect((nosy as any).execute({})).rejects.toThrow(/extra\.requestId/);
  });
});
