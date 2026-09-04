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

const { mockOmnisearch } = vi.hoisted(() => ({ mockOmnisearch: vi.fn() }));
vi.mock('~~/server/utils/omnisearch', () => ({ runOmnisearch: mockOmnisearch }));

// `video-search` reaches YouTube through fetchJsonWithRetry, not $fetch.
const { mockFetchJson } = vi.hoisted(() => ({ mockFetchJson: vi.fn() }));
vi.mock('~~/server/utils/fetchJsonWithRetry', () => ({ fetchJsonWithRetry: mockFetchJson }));

const { buildAgentTools, siteSearchTool, storeSearchTool, STORE_DEGRADED_MARKERS, SITE_SEARCH_DEGRADED_MARKER } =
  await import('~~/server/agent/tools');

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
    it('reports `unavailable` when the store call fails, WITH the cause', async () => {
      // The marker alone cannot separate an expired token from a lapsed API
      // version from an outage, and "make the failure visible" is only half
      // done if the cause is computed and dropped.
      const onDegraded = vi.fn();
      mockFetch.mockRejectedValue(new Error('401 Unauthorized'));

      await run(storeSearchTool(CONFIG, { onDegraded }), { query: 'minilite', limit: 5 });

      expect(onDegraded).toHaveBeenCalledWith(STORE_DEGRADED_MARKERS.unavailable, expect.stringContaining('401'));
    });

    it('hands the model a real store link instead of an order to invent one', async () => {
      // Observed live: told to "point at the store" with no URL, the model
      // linked classicminidiy.com/store, which is not a page.
      mockFetch.mockRejectedValue(new Error('timeout'));
      const result: any = await run(storeSearchTool(CONFIG), { query: 'minilite', limit: 5 });
      expect(result.storeUrl).toContain('https://store.classicminidiy.com/');
      expect(result.storeUrl).toContain('utm_source=classicminidiy');
      expect(result.note).toMatch(/never write a store link that did not come from this tool/i);
    });

    it('reports `not-configured` separately, because the fix is different', async () => {
      const onDegraded = vi.fn();

      await run(storeSearchTool(null, { onDegraded }), { query: 'minilite', limit: 5 });

      expect(onDegraded).toHaveBeenCalledWith(STORE_DEGRADED_MARKERS.not_configured, expect.anything());
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

describe('site-search degradation', () => {
  it('reports through the same hook as the store tool', async () => {
    // Omnisearch being down otherwise looks exactly like a search that matched
    // nothing — the same silent degradation the hook exists to close, on the
    // tool carrying far more traffic than the store.
    const onDegraded = vi.fn();
    mockOmnisearch.mockRejectedValue(new Error('connection refused'));

    const result: any = await run(siteSearchTool({ onDegraded }), { query: 'hydrolastic', limit: 8 });

    expect(onDegraded).toHaveBeenCalledWith(SITE_SEARCH_DEGRADED_MARKER, expect.stringContaining('connection'));
    expect(result.error).toMatch(/unavailable/i);
  });

  it('stays silent when search merely matched nothing', async () => {
    const onDegraded = vi.fn();
    mockOmnisearch.mockResolvedValue({ results: [], total: 0 });

    await run(siteSearchTool({ onDegraded }), { query: 'nothing', limit: 8 });

    expect(onDegraded).not.toHaveBeenCalled();
  });
});

describe('buildAgentTools', () => {
  it('passes the request event through to the Shopify config', () => {
    // The seam that already shipped one defect: reading the credentials from
    // the wrong place still yields a working tool set, so nothing else fails.
    const event = { context: {}, __marker: 'the-event' } as any;
    mockUseRuntimeConfig.mockClear();
    buildAgentTools({ event });
    expect(mockUseRuntimeConfig).toHaveBeenCalledWith(event);
  });

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
    expect(onDegraded).toHaveBeenCalledWith(STORE_DEGRADED_MARKERS.not_configured, expect.anything());
  });
});

/**
 * The three tools added on 2026-09-04, after five of five test conversations
 * ended in a refusal. See docs/plans/2026-09-04-chat-agent-knowledge-expansion.md.
 */
const { videoSearchTool, historyTool, webSearchSupported, VIDEO_SEARCH_DEGRADED_MARKER } =
  await import('~~/server/agent/tools');
const { TRUSTED_DOMAINS } = await import('~~/data/trustedSources');

describe('video-search', () => {
  beforeEach(async () => {
    // `getVideoIndex` memoises a defineCachedFunction wrapper on first call, so
    // the Nitro auto-import has to exist before it and the memo has to be
    // dropped between tests — otherwise one test's stub serves the next.
    (globalThis as any).defineCachedFunction = (fn: any) => fn;
    const { resetVideoIndexCache } = await import('~~/server/utils/youtubeCatalog');
    resetVideoIndexCache();
    mockFetchJson.mockReset();
  });

  it('returns Cole videos under `videos`, never `results`', async () => {
    // LOAD-BEARING. `usefulLinks` in ChatWindow.vue shape-matches ANY tool
    // output carrying a `results` array of `{ url, title }`. Naming this field
    // `results` would silently fill the Useful Links rail with YouTube links and
    // leave the dedicated video rail empty.
    mockFetchJson.mockResolvedValueOnce({
      items: [
        {
          snippet: {
            title: 'How To Replace A Classic Mini Windscreen',
            description: 'Removing the old screen and fitting new rubber.',
            publishedAt: '2024-05-01T10:00:00Z',
            thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/maxres.jpg' } },
            resourceId: { videoId: 'aaaaaaaaaaa' },
          },
        },
      ],
    });

    const out: any = await run(videoSearchTool('key'), { query: 'windscreen', limit: 3 });

    expect(out.checked).toBe(true);
    expect(out).not.toHaveProperty('results');
    expect(out.videos).toHaveLength(1);
    expect(out.videos[0].url).toBe('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    expect(out.videos[0].thumbnail).toContain('i.ytimg.com');
  });

  it('distinguishes "no video covers this" from "I could not look"', async () => {
    // A successful search that matched nothing must say so as a MATCH failure,
    // so the model answers from elsewhere instead of claiming the channel is
    // broken. The degraded case below is the opposite signal.
    mockFetchJson.mockResolvedValueOnce({
      items: [
        {
          snippet: {
            title: 'Rebuilding A Classic Mini Gearbox',
            description: 'Synchro replacement.',
            publishedAt: '2024-05-01T10:00:00Z',
            thumbnails: {},
            resourceId: { videoId: 'bbbbbbbbbbb' },
          },
        },
      ],
    });

    const out: any = await run(videoSearchTool('key'), { query: 'sourdough hydration', limit: 3 });
    expect(out.checked).toBe(true);
    expect(out.videos).toEqual([]);
    expect(out.note).toMatch(/do not invent/i);
  });

  it('reports a lookup failure as `checked: false`, not as an absence', async () => {
    // "Cole has no video on this" and "I could not look" are different answers,
    // and only one of them is honest. An empty list with no signal would make
    // the assistant claim the channel has nothing on a subject it covers.
    const onDegraded = vi.fn();
    const out: any = await run(videoSearchTool('', { onDegraded }), { query: 'windscreen', limit: 3 });

    expect(out.checked).toBe(false);
    expect(out.videos).toEqual([]);
    expect(out.note).toMatch(/unavailable/i);
    expect(onDegraded).toHaveBeenCalledWith(VIDEO_SEARCH_DEGRADED_MARKER, expect.stringMatching(/not configured/i));
  });
});

describe('mini-history', () => {
  it('answers the question the old prompt refused', async () => {
    const out: any = await run(historyTool(), {
      query: 'what year was the mini disqualified from monte carlo',
      category: '',
      limit: 3,
    });
    expect(out.entries[0].id).toBe('monte-carlo-1966-disqualification');
  });

  it('returns a whole category when asked for one', async () => {
    const out: any = await run(historyTool(), { query: 'coopers', category: 'cooper', limit: 6 });
    expect(out.entries.length).toBeGreaterThan(1);
    expect(out.entries.every((e: any) => e.category === 'cooper')).toBe(true);
  });

  it('still searches when the category is not a real one', async () => {
    // REGRESSION. `category` is a free string — the enum lives in its `describe`,
    // which is documentation, not validation. Branching on truthiness meant a
    // plausible-but-wrong value discarded the query without searching it, and
    // the tool reported the corpus had nothing on the Monte Carlo Rally, which
    // it covers in two entries.
    const out: any = await run(historyTool(), {
      query: 'monte carlo disqualified',
      category: 'rally',
      limit: 3,
    });
    expect(out.entries[0].id).toBe('monte-carlo-1966-disqualification');
  });

  it('does not hand the model the search tags', async () => {
    // Tags exist to be matched, never to be read. They phrase themselves as
    // questions ("when was the mini made"), so a model that sees them can quote
    // one back as though it were corpus content — and six of them replay into
    // every later turn against the MAX_CHARS budget.
    const out: any = await run(historyTool(), { query: 'issigonis', category: '', limit: 3 });
    expect(out.entries[0]).not.toHaveProperty('tags');
    // The fields an answer is actually built from must survive the trim.
    for (const field of ['id', 'title', 'period', 'summary', 'detail']) {
      expect(out.entries[0], field).toHaveProperty(field);
    }
  });

  it('tells the model to search rather than guess when it has nothing', async () => {
    const out: any = await run(historyTool(), { query: 'sourdough starter hydration', category: '', limit: 3 });
    expect(out.entries).toEqual([]);
    expect(out.note).toMatch(/web_search|unsure/i);
  });
});

describe('web_search', () => {
  it('is offered to a model that supports it, and withheld from one that does not', () => {
    // `web_search_20260209` needs Sonnet 4.6 or better. On Haiku the request is
    // rejected outright, so the tool has to be dropped rather than 400 the
    // whole conversation.
    expect(Object.keys(buildAgentTools({ modelId: 'claude-sonnet-5' }))).toContain('web_search');
    expect(Object.keys(buildAgentTools({ modelId: 'claude-haiku-4-5-20251001' }))).not.toContain('web_search');
    expect(webSearchSupported('claude-opus-5')).toBe(true);
    expect(webSearchSupported('claude-haiku-4-5-20251001')).toBe(false);
  });

  it('defaults to including it, so an omitted modelId is not a quiet downgrade', () => {
    expect(Object.keys(buildAgentTools())).toContain('web_search');
  });

  it('is pinned to the trusted allowlist, and only to it', () => {
    const tool: any = buildAgentTools({ modelId: 'claude-sonnet-5' })['web_search'];

    // Anthropic executes this one, so there is no handler to test. What CAN go
    // wrong is the configuration: an empty or missing allowlist is not a
    // degraded search, it is unrestricted web access — the exact failure the
    // chat rebuild exists to undo, arriving silently.
    expect(tool.isProviderExecuted).toBe(true);
    expect(tool.id).toBe('anthropic.web_search_20260209');
    expect(tool.args.allowedDomains).toEqual(TRUSTED_DOMAINS);
    expect(tool.args.allowedDomains.length).toBeGreaterThan(0);
    expect(tool.args.maxUses).toBeGreaterThan(0);
    expect(tool.args.blockedDomains, 'allowed and blocked are mutually exclusive').toBeUndefined();
  });
});
