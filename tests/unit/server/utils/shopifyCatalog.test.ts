/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch, mockUseRuntimeConfig } = vi.hoisted(() => {
  const mockFetch = vi.fn();
  const mockUseRuntimeConfig = vi.fn();
  (globalThis as any).$fetch = mockFetch;
  (globalThis as any).useRuntimeConfig = mockUseRuntimeConfig;
  return { mockFetch, mockUseRuntimeConfig };
});

import {
  fetchProductByHandle,
  searchCatalogue,
  shopifyConfig,
  storeProductUrl,
  toCatalogueProduct,
  STORE_UTM,
} from '~~/server/utils/shopifyCatalog';

const CONFIG = { domain: 'store.classicminidiy.com', token: 'shpat_not_a_real_token' };

/** One Shopify product node, in the shape the Storefront API returns. */
function node(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Minilite 10x5 Wheel',
    handle: 'minilite-10x5',
    description: 'A wheel.',
    productType: 'Wheels',
    availableForSale: true,
    priceRange: {
      minVariantPrice: { amount: '145.00', currencyCode: 'GBP' },
      maxVariantPrice: { amount: '145.00', currencyCode: 'GBP' },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('storeProductUrl', () => {
  it('carries every UTM parameter, because the model is never asked to add them', () => {
    // The prompt this assistant replaced told the MODEL to append these, and
    // models forget — producing partial attribution that is indistinguishable
    // from organic traffic. Building the URL here is the whole mitigation.
    const url = new URL(storeProductUrl(CONFIG.domain, 'minilite-10x5'));

    expect(url.origin + url.pathname).toBe('https://store.classicminidiy.com/products/minilite-10x5');
    for (const [key, value] of Object.entries(STORE_UTM)) {
      expect(url.searchParams.get(key), `missing ${key}`).toBe(value);
    }
  });

  it('does not reuse the retired shop bot’s utm_source', () => {
    // Fifteen months of shop-bot traffic under `diy_chat_bot` must stay
    // separable from the rebuilt assistant's, or the measurement is worthless.
    expect(STORE_UTM.utm_source).not.toBe('diy_chat_bot');
  });

  it('escapes a handle rather than letting it alter the URL', () => {
    const url = new URL(storeProductUrl(CONFIG.domain, 'a b/../evil'));
    expect(url.pathname).toBe('/products/a%20b%2F..%2Fevil');
    expect(url.host).toBe('store.classicminidiy.com');
  });
});

describe('toCatalogueProduct', () => {
  it('maps price, stock and an attributed URL', () => {
    const product = toCatalogueProduct(node(), CONFIG.domain)!;
    expect(product.title).toBe('Minilite 10x5 Wheel');
    expect(product.price).toBe('£145.00');
    expect(product.priceVaries).toBe(false);
    expect(product.available).toBe(true);
    expect(product.url).toContain(`utm_source=${STORE_UTM.utm_source}`);
  });

  it('flags a variant price range so a "from" figure is never read as the price', () => {
    const product = toCatalogueProduct(
      node({
        priceRange: {
          minVariantPrice: { amount: '145.00', currencyCode: 'GBP' },
          maxVariantPrice: { amount: '190.00', currencyCode: 'GBP' },
        },
      }),
      CONFIG.domain
    )!;
    expect(product.priceVaries).toBe(true);
  });

  it('omits the description unless asked, and truncates it when asked', () => {
    expect(toCatalogueProduct(node(), CONFIG.domain)!.description).toBeUndefined();

    const long = toCatalogueProduct(node({ description: 'x'.repeat(900) }), CONFIG.domain, {
      withDescription: true,
    })!;
    expect(long.description).toHaveLength(600);
  });

  it('drops a node with no handle, because a product with no link is noise', () => {
    expect(toCatalogueProduct(node({ handle: '' }), CONFIG.domain)).toBeNull();
    expect(toCatalogueProduct(node({ title: '' }), CONFIG.domain)).toBeNull();
  });

  it('survives a missing price rather than throwing mid tool call', () => {
    const product = toCatalogueProduct(node({ priceRange: undefined }), CONFIG.domain)!;
    expect(product.price).toBeNull();
    expect(product.priceVaries).toBe(false);
  });
});

describe('searchCatalogue', () => {
  it('returns ok with mapped products on a healthy response', async () => {
    mockFetch.mockResolvedValue({ data: { products: { nodes: [node()] } } });

    const result = await searchCatalogue('minilite', 5, CONFIG);

    expect(result.outcome).toBe('ok');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].url).toContain('utm_medium=chat');
  });

  it('sends the Storefront token header and a hard timeout, never a retry', async () => {
    mockFetch.mockResolvedValue({ data: { products: { nodes: [] } } });
    await searchCatalogue('minilite', 5, CONFIG);

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('store.classicminidiy.com/api/');
    expect(url).toContain('/graphql.json');
    expect(options.headers['X-Shopify-Storefront-Access-Token']).toBe(CONFIG.token);
    // An Admin token would be sent as `X-Shopify-Access-Token`. Asserting the
    // header name is the cheapest standing check that this stayed Storefront.
    expect(options.headers['X-Shopify-Access-Token']).toBeUndefined();
    // 2s, and no second attempt: a retry could spend the caller's whole budget.
    expect(options.timeout).toBe(2000);
    expect(options.retry).toBe(0);
  });

  it('clamps the requested count so the model cannot ask for the whole catalogue', async () => {
    mockFetch.mockResolvedValue({ data: { products: { nodes: [] } } });
    await searchCatalogue('wheels', 500, CONFIG);
    expect(mockFetch.mock.calls[0]![1].body.variables.first).toBe(10);

    await searchCatalogue('wheels', 0, CONFIG);
    expect(mockFetch.mock.calls[1]![1].body.variables.first).toBe(1);
  });

  it('reports `unavailable`, not an empty result, when the call times out', async () => {
    // The failure this whole module is shaped around: the old agent swallowed
    // exactly this into an empty tool list and nothing anywhere said so.
    mockFetch.mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout')));

    const result = await searchCatalogue('minilite', 5, CONFIG);

    expect(result.outcome).toBe('unavailable');
    expect(result.products).toEqual([]);
    expect(result.reason).toContain('timeout');
  });

  it('reports `unavailable` on a non-200', async () => {
    mockFetch.mockRejectedValue(new Error('[POST] ... 401 Unauthorized'));
    await expect(searchCatalogue('minilite', 5, CONFIG)).resolves.toMatchObject({
      outcome: 'unavailable',
      products: [],
    });
  });

  it('reports `unavailable` when GraphQL returns errors inside a 200', async () => {
    // An expired Storefront token arrives exactly this way — HTTP 200 with an
    // `errors` array — so a non-throwing call is not yet a successful one.
    mockFetch.mockResolvedValue({ errors: [{ message: 'Invalid API key or access token' }] });

    const result = await searchCatalogue('minilite', 5, CONFIG);

    expect(result.outcome).toBe('unavailable');
    expect(result.reason).toContain('Invalid API key');
  });

  it('reports `not_configured` with no credentials, and makes no outbound call', async () => {
    const result = await searchCatalogue('minilite', 5, null);
    expect(result.outcome).toBe('not_configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('never throws, whatever the store does', async () => {
    mockFetch.mockRejectedValue('a string, not an Error');
    await expect(searchCatalogue('minilite', 5, CONFIG)).resolves.toMatchObject({ outcome: 'unavailable' });
  });
});

describe('fetchProductByHandle', () => {
  it('returns the product with its description', async () => {
    mockFetch.mockResolvedValue({ data: { product: node() } });

    const result = await fetchProductByHandle('minilite-10x5', CONFIG);

    expect(result.outcome).toBe('ok');
    expect(result.products[0].description).toBe('A wheel.');
  });

  it('treats an unknown handle as a real answer, not a fault', async () => {
    // `product: null` with no GraphQL error means "no such product". Calling
    // that `unavailable` would flag a healthy store as broken in telemetry.
    mockFetch.mockResolvedValue({ data: { product: null } });

    const result = await fetchProductByHandle('does-not-exist', CONFIG);

    expect(result.outcome).toBe('ok');
    expect(result.products).toEqual([]);
  });
});

describe('shopifyConfig', () => {
  it('is null unless BOTH halves are present', () => {
    mockUseRuntimeConfig.mockReturnValue({ SHOPIFY_STORE_DOMAIN: 'store.example.com', SHOPIFY_STOREFRONT_TOKEN: '' });
    expect(shopifyConfig()).toBeNull();

    mockUseRuntimeConfig.mockReturnValue({ SHOPIFY_STORE_DOMAIN: '', SHOPIFY_STOREFRONT_TOKEN: 'tok' });
    expect(shopifyConfig()).toBeNull();

    mockUseRuntimeConfig.mockReturnValue({
      SHOPIFY_STORE_DOMAIN: 'store.example.com',
      SHOPIFY_STOREFRONT_TOKEN: 'tok',
    });
    expect(shopifyConfig()).toEqual({ domain: 'store.example.com', token: 'tok' });
  });

  it('treats an unset Cloudflare secret (empty string) as unconfigured', () => {
    // Nitro resolves a missing runtime override to '', not undefined — the
    // documented Worker failure mode. A whitespace value is the same thing.
    mockUseRuntimeConfig.mockReturnValue({ SHOPIFY_STORE_DOMAIN: '  ', SHOPIFY_STOREFRONT_TOKEN: '   ' });
    expect(shopifyConfig()).toBeNull();
  });
});
