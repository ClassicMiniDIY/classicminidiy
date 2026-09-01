// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch, mockUseRuntimeConfig } = vi.hoisted(() => {
  const mockFetch = vi.fn();
  const mockUseRuntimeConfig = vi.fn(() => ({}));
  (globalThis as any).$fetch = mockFetch;
  (globalThis as any).useRuntimeConfig = mockUseRuntimeConfig;
  // The eleven bridged `/mcp` tools call these as Nitro auto-imports.
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = (data: any) => data;
  (globalThis as any).errorResult = (message: string) => ({ error: message });
  return { mockFetch, mockUseRuntimeConfig };
});

const { buildAgentTools, storeSearchTool, STORE_DEGRADED_MARKERS } = await import('~~/server/agent/tools');

const CONFIG = { domain: 'store.classicminidiy.com', token: 'storefront-token' };

/** Run a tool's `execute` the way the AI SDK does. */
function run(tool: any, args: Record<string, unknown>) {
  return tool.execute(args, { toolCallId: 'call-1', messages: [] });
}

function productNode() {
  return {
    title: 'Minilite 10x5 Wheel',
    handle: 'minilite-10x5',
    productType: 'Wheels',
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: '145.00', currencyCode: 'GBP' },
      maxVariantPrice: { amount: '145.00', currencyCode: 'GBP' },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRuntimeConfig.mockReturnValue({} as any);
});

describe('store-search', () => {
  it('returns products with links the model did not have to build', async () => {
    mockFetch.mockResolvedValue({ data: { products: { nodes: [productNode()] } } });

    const result: any = await run(storeSearchTool(CONFIG), { query: 'minilite wheels', limit: 5 });

    expect(result.checked).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].url).toContain('utm_source=classicminidiy');
    expect(result.products[0].available).toBe(true);
  });

  it('fetches by handle when given one, and does not search', async () => {
    mockFetch.mockResolvedValue({ data: { product: { ...productNode(), description: 'A wheel.' } } });

    const result: any = await run(storeSearchTool(CONFIG), { query: 'minilite', handle: 'minilite-10x5', limit: 5 });

    expect(result.products[0].description).toBe('A wheel.');
    expect(mockFetch.mock.calls[0]![1].body.variables).toEqual({ handle: 'minilite-10x5' });
  });

  it('takes no optional fields, so `tool()` can infer its schema', () => {
    // `ZodOptional` does not satisfy the `ai` package's schema parameter under
    // this dependency graph: the generic collapses to `never` and `tool()`
    // fails to typecheck, reporting the error against `execute` rather than the
    // schema. `.default('')` expresses "no handle" instead. This is asserted
    // because the fix is invisible and a future edit would naturally undo it.
    const shape = (storeSearchTool(CONFIG) as any).inputSchema?.shape ?? {};
    for (const [field, schema] of Object.entries<any>(shape)) {
      expect(schema?.constructor?.name, `${field} is a ZodOptional`).not.toBe('ZodOptional');
    }
  });

  it('distinguishes "the store has nothing" from "I could not check"', async () => {
    // These are different answers and only one of them is honest when the
    // lookup failed. Collapsing both to an empty list is how the assistant
    // would end up telling a visitor the shop does not stock something it does.
    mockFetch.mockResolvedValue({ data: { products: { nodes: [] } } });
    const empty: any = await run(storeSearchTool(CONFIG), { query: 'flux capacitor', limit: 5 });
    expect(empty.checked).toBe(true);
    expect(empty.note).toMatch(/nothing matching/i);

    mockFetch.mockRejectedValue(new Error('timeout'));
    const failed: any = await run(storeSearchTool(CONFIG), { query: 'minilite', limit: 5 });
    expect(failed.checked).toBe(false);
    expect(failed.note).toMatch(/could not check/i);
    expect(failed.note).toMatch(/says nothing about whether the store stocks it/i);
  });

  it('never throws out of execute, so a store fault cannot abort a chat run', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(run(storeSearchTool(CONFIG), { query: 'minilite', limit: 5 })).resolves.toMatchObject({
      checked: false,
      products: [],
    });
  });

  describe('the degradation marker', () => {
    // The precedent: the old agent's /mcp fetch fell back to an EMPTY TOOL LIST
    // inside a bare try/except, so a bad key demoted the assistant to generic
    // web search for fifteen months with no signal in either usage sink. A
    // store lookup that degrades to "no results" has exactly that shape, so the
    // failure has to be counted somewhere a dashboard can see it.
    it('reports `unavailable` when the store call fails', async () => {
      const onDegraded = vi.fn();
      mockFetch.mockRejectedValue(new Error('timeout'));

      await run(storeSearchTool(CONFIG, { onDegraded }), { query: 'minilite', limit: 5 });

      expect(onDegraded).toHaveBeenCalledWith(STORE_DEGRADED_MARKERS.unavailable);
    });

    it('reports `not-configured` separately, because the fix is different', async () => {
      const onDegraded = vi.fn();

      await run(storeSearchTool(null, { onDegraded }), { query: 'minilite', limit: 5 });

      expect(onDegraded).toHaveBeenCalledWith(STORE_DEGRADED_MARKERS.not_configured);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('stays silent when the store answered — including with no matches', async () => {
      // Otherwise the marker means "someone asked about products" rather than
      // "the lookup is broken", and the dashboard signal is worthless.
      const onDegraded = vi.fn();
      mockFetch.mockResolvedValue({ data: { products: { nodes: [] } } });

      await run(storeSearchTool(CONFIG, { onDegraded }), { query: 'flux capacitor', limit: 5 });

      expect(onDegraded).not.toHaveBeenCalled();
    });

    it('uses markers that are distinguishable from the tool name itself', () => {
      // They land in the same `tools_called` array as real tool names, so a
      // marker equal to `store-search` would be invisible.
      for (const marker of Object.values(STORE_DEGRADED_MARKERS)) {
        expect(marker).not.toBe('store-search');
        expect(marker.startsWith('store-search:')).toBe(true);
      }
    });
  });

  it('exposes no cart, checkout or customer operation', async () => {
    // Shopify's own Storefront MCP ships cart mutations. The tool surface here
    // is exactly two read operations and must stay that way.
    const schema = JSON.stringify((storeSearchTool(CONFIG) as any).inputSchema ?? {});
    const description = String((storeSearchTool(CONFIG) as any).description ?? '');
    for (const forbidden of ['cart', 'checkout', 'customer', 'order']) {
      expect(`${schema} ${description}`.toLowerCase(), `store-search mentions "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe('buildAgentTools', () => {
  it('includes store-search alongside the reference tools', () => {
    const tools = buildAgentTools();
    expect(Object.keys(tools)).toContain('store-search');
    expect(Object.keys(tools)).toContain('site-search');
    expect(Object.keys(tools)).toContain('torque-specs');
  });

  it('builds a working tool set with no event and no credentials', async () => {
    // Tests and any non-request caller must still get a tool set; the store
    // tool simply reports not-configured rather than the build throwing.
    const tools = buildAgentTools();
    await expect(run(tools['store-search'], { query: 'minilite', limit: 5 })).resolves.toMatchObject({
      checked: false,
    });
  });

  it('passes onDegraded through to the store tool', async () => {
    const onDegraded = vi.fn();
    const tools = buildAgentTools({ onDegraded });
    await run(tools['store-search'], { query: 'minilite', limit: 5 });
    expect(onDegraded).toHaveBeenCalledWith(STORE_DEGRADED_MARKERS.not_configured);
  });
});
