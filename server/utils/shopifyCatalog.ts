import type { H3Event } from 'h3';
import { serverRuntimeConfig } from './runtimeConfig';

/**
 * Read-only view of the Classic Mini DIY Shopify store, for the chat agent.
 *
 * Design doc: docs/plans/2026-09-01-shopify-catalog-tool.md.
 *
 * FOUR THINGS HERE ARE NON-NEGOTIABLE, each because of a specific past failure.
 *
 *  1. STOREFRONT API, NEVER THE ADMIN API. `/api/chat` is unauthenticated by
 *     documented invariant (CLAUDE.md, "Security Invariants") — anyone on the
 *     internet can reach it, and the model decides when a tool fires. An Admin
 *     token can read customers and orders, so putting one behind that call is a
 *     data-exfiltration path rather than a feature. The Storefront token is
 *     public-scoped and read-only, and sees published products only. The
 *     credential name says which one it is; keep it that way.
 *
 *  2. READ-ONLY, TWO OPERATIONS. Search by keyword, and fetch one product by
 *     handle. Shopify's own Storefront MCP ships cart mutations; they are not
 *     bridged and must not be. A model deciding to mutate a visitor's cart is a
 *     class of bug this codebase has no reason to open.
 *
 *  3. UTM TAGGING HAPPENS HERE, IN CODE. The prompt this assistant replaced
 *     instructed the MODEL to append `utm_source=...` to every store link.
 *     Models forget, and the failure is invisible: partial attribution is
 *     indistinguishable from organic traffic, so the numbers look plausible and
 *     are wrong. `storeProductUrl()` builds the tagged URL, so the model cannot
 *     forget what it never had to do. `tests/unit/server/agent/prompt.test.ts`
 *     asserts `utm_source` never appears in the prompt — that assertion is the
 *     enforcement, so do not "helpfully" document the parameters there.
 *
 *  4. FAILURE DEGRADES TO EMPTY, AND IS COUNTED. The precedent is exact: the
 *     old agent fetched `/mcp` over HTTP inside a bare try/except that fell back
 *     to an EMPTY TOOL LIST, so a bad key silently demoted the assistant to
 *     generic web search with no error anywhere, for fifteen months. Every
 *     failure path below therefore returns a RESULT carrying an `outcome`
 *     discriminator rather than throwing or returning a bare `[]` — because
 *     "the store is unreachable" and "the store sells nothing matching that"
 *     must not look the same to the model, and must not look the same in
 *     telemetry. `server/agent/tools.ts` turns a non-`ok` outcome into a marker
 *     in `tools_called`; see the note there.
 *
 * A consequence worth stating: a stale `API_VERSION` below, an expired token and
 * a Shopify outage all land in the same `unavailable` outcome. That is correct —
 * the tool must never break a chat run — but it means the COUNTER is the only
 * thing standing between a broken store lookup and silence. Do not remove it.
 */

/**
 * Storefront API version, pinned.
 *
 * Shopify supports a version for 12 months from release and publishes quarterly
 * (Jan/Apr/Jul/Oct). An unsupported version is rejected by Shopify, which lands
 * here as `unavailable` — a working chat with a store lookup that never returns
 * anything. Bump this within the window; the degradation counter is what will
 * tell you it lapsed.
 */
const API_VERSION = '2026-07';

/** Hard ceiling on the outbound call, well inside the chat's own step budget. */
const TIMEOUT_MS = 2000;

/** Longest product description handed to the model, in characters. */
const DESCRIPTION_LIMIT = 600;

/**
 * Campaign tags for every link this module hands the model.
 *
 * Deliberately NOT the old bot's `diy_chat_bot`/`chat` pair: keeping that value
 * would blend fifteen months of shop-bot traffic into the rebuilt assistant's
 * numbers, and telling the two apart is most of why this is measured at all.
 */
export const STORE_UTM = {
  utm_source: 'classicminidiy',
  utm_medium: 'chat',
  utm_campaign: 'assistant',
} as const;

/** How a catalogue call ended. Only `ok` means the store actually answered. */
export type CatalogueOutcome = 'ok' | 'not_configured' | 'unavailable';

export interface CatalogueProduct {
  title: string;
  /** Shopify product handle. Feed it back as `handle` for the full description. */
  handle: string;
  /**
   * Display price, pre-formatted. A RANGE ("$39.99 – $99.99") when the variants
   * differ, so it cannot be misread as a single price. See formatPriceRange().
   */
  price: string | null;
  /** True when `price` is a range rather than one figure. */
  priceVaries: boolean;
  /** ISO currency of `price`, so the model can disambiguate "$" when it matters. */
  currency: string | null;
  /**
   * Live stock, straight from Shopify, or null when Shopify did not say.
   *
   * Null rather than false: on a surface whose whole purpose is completing a
   * sale, reporting an absent field as "out of stock" tells a would-be buyer
   * the shop cannot sell them something it can.
   */
  available: boolean | null;
  productType: string | null;
  /** Present only on a by-handle fetch; search results stay compact. */
  description?: string;
  /** Absolute, and already carries STORE_UTM. Never build a store link by hand. */
  url: string;
}

export interface CatalogueResult {
  outcome: CatalogueOutcome;
  products: CatalogueProduct[];
  /** Set when `outcome` is not `ok`. Short, and safe to put in front of a model. */
  reason?: string;
}

export interface ShopifyCatalogConfig {
  /** Storefront host, e.g. `store.classicminidiy.com`. No scheme, no path. */
  domain: string;
  /** Storefront (NOT Admin) access token. */
  token: string;
}

/**
 * Resolve credentials from runtimeConfig. Returns null when either half is
 * missing, which is the `not_configured` path — distinct from `unavailable` on
 * purpose, because "no secret set" and "Shopify is down" need different fixes
 * and an unset Cloudflare secret resolves to an empty string rather than an
 * error (CLAUDE.md, "Build-time vs runtime secrets").
 */
export function shopifyConfig(event?: H3Event): ShopifyCatalogConfig | null {
  const config = event ? serverRuntimeConfig(event) : useRuntimeConfig();
  const domain = String((config as any).SHOPIFY_STORE_DOMAIN || '').trim();
  const token = String((config as any).SHOPIFY_STOREFRONT_TOKEN || '').trim();
  if (!domain || !token || !isStorefrontHostname(domain)) return null;
  return { domain, token };
}

/**
 * A bare hostname and nothing else.
 *
 * `callStorefront` interpolates this straight into the request URL, so an
 * unvalidated value decides where the Storefront token is SENT. A typo'd or
 * mispasted secret containing a path, a scheme, or userinfo
 * (`store.classicminidiy.com@elsewhere.example`) would post the credential to
 * another host while still reading correctly, and `storeProductUrl()` would
 * then hand every visitor links to it. The token is low-value by design; the
 * check costs a line and this module does not get to rely on that.
 */
export function isStorefrontHostname(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

/**
 * The canonical, attributed link to one product.
 *
 * Exported because it is the contract the UTM unit test asserts against, and
 * because anything else that ever links the store from a tool result must use
 * it rather than concatenating a URL.
 */
export function storeProductUrl(domain: string, handle: string): string {
  const url = new URL(`https://${domain}/products/${encodeURIComponent(handle)}`);
  for (const [key, value] of Object.entries(STORE_UTM)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * The storefront root, attributed the same way a product link is.
 *
 * Exists because the DEGRADED branch of `store-search` tells the model to point
 * at the shop, and a model told to link something it has not been given will
 * invent a URL — observed live, it produced `classicminidiy.com/store`, which is
 * not a page. Give it the link rather than the instruction alone.
 */
export function storeRootUrl(domain: string): string {
  const url = new URL(`https://${domain}/`);
  for (const [key, value] of Object.entries(STORE_UTM)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * Money formatting.
 *
 * `narrowSymbol` because the locale here is fixed and the store's currency is
 * not: plain `en-GB` renders USD as "US$39.99", which is a formatting artifact
 * of a locale nobody chose rather than a decision. The symbol alone is what a
 * reader expects, and `currency` is returned alongside the string so the model
 * can say "USD" when the reader is not American.
 *
 * NOT named `formatMoney`: `server/utils/exchange/feedBuilder.ts` exports that
 * name, Nitro auto-imports every `server/utils/**` export, and a second money
 * formatter under the same name is the shadowing hazard CLAUDE.md documents.
 * The two also disagree — that one rounds to whole units, this one keeps cents —
 * so a future edit that deleted this definition would silently bind to the
 * auto-import and drop the cents off every price in the store.
 *
 * An unknown currency returns NULL rather than a bare number. "39.99" with no
 * unit is a figure a model will present as dollars, and being wrong about a
 * price is worse than not quoting one.
 */
function formatStorefrontMoney(amount: string | null | undefined, currency: string | null | undefined): string | null {
  if (!amount || !currency) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(
      value
    );
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * The price to put in front of the model.
 *
 * A RANGE when the variants differ, never the minimum alone. Two of the first
 * three real products checked against the live store priced $39.99-$99.99 and
 * $30-$195, so a range is the common case here rather than the edge case — and
 * handing a model `price: "$39.99"` with a separate boolean is an invitation to
 * answer "it costs $39.99" about a $99.99 variant.
 *
 * `varies` is returned FROM here rather than computed beside it, so the flag
 * and the string cannot disagree. Comparing the raw amounts instead is subtly
 * wrong: Shopify does not fix the scale of its decimal strings, so a product
 * priced identically across variants can arrive as min `"10.0"` / max `"10.00"`
 * — different strings, one formatted price — and the model would be told the
 * price varies while being shown a single figure.
 */
function formatPriceRange(
  min: { amount?: string; currencyCode?: string } | undefined,
  max: { amount?: string; currencyCode?: string } | undefined
): { price: string | null; varies: boolean } {
  const low = formatStorefrontMoney(min?.amount, min?.currencyCode);
  if (!low) return { price: null, varies: false };
  const high = formatStorefrontMoney(max?.amount, max?.currencyCode);
  if (!high || high === low) return { price: low, varies: false };
  return { price: `${low} – ${high}`, varies: true };
}

/** Fields both queries read. Kept in one place so the two cannot drift. */
const SHARED_FIELDS = `
  title
  handle
  productType
  availableForSale
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
`;

/**
 * `description` is selected ONLY by the by-handle query.
 *
 * Search discards it — `toCatalogueProduct` is called without `withDescription`
 * there — so selecting it in the search would pull up to ten full descriptions
 * (kilobytes of marketing copy each) across a link with a hard 2s budget, and
 * charge Shopify's query cost for all of them, to throw every one away.
 */
const SEARCH_QUERY = `query CatalogueSearch($query: String!, $first: Int!) {
  products(first: $first, query: $query) {
    nodes { ${SHARED_FIELDS} }
  }
}`;

const PRODUCT_QUERY = `query CatalogueProduct($handle: String!) {
  product(handle: $handle) { ${SHARED_FIELDS} description }
}`;

interface RawProduct {
  title?: string;
  handle?: string;
  description?: string;
  productType?: string;
  availableForSale?: boolean;
  priceRange?: {
    minVariantPrice?: { amount?: string; currencyCode?: string };
    maxVariantPrice?: { amount?: string; currencyCode?: string };
  };
}

/** Shape one Shopify node into what the model sees. `withDescription` keeps search results compact. */
export function toCatalogueProduct(
  raw: RawProduct,
  domain: string,
  { withDescription = false }: { withDescription?: boolean } = {}
): CatalogueProduct | null {
  const handle = typeof raw?.handle === 'string' ? raw.handle : '';
  const title = typeof raw?.title === 'string' ? raw.title : '';
  // No handle means no link, and a product the reader cannot reach is noise.
  if (!handle || !title) return null;

  const min = raw.priceRange?.minVariantPrice;
  const max = raw.priceRange?.maxVariantPrice;
  const { price, varies } = formatPriceRange(min, max);

  const product: CatalogueProduct = {
    title,
    handle,
    price,
    priceVaries: varies,
    currency: price ? min?.currencyCode || null : null,
    available: typeof raw.availableForSale === 'boolean' ? raw.availableForSale : null,
    productType: raw.productType || null,
    url: storeProductUrl(domain, handle),
  };

  if (withDescription && typeof raw.description === 'string' && raw.description.trim()) {
    // Shopify descriptions run long; the model needs the gist, not the copy.
    // The ellipsis is load-bearing — without it the model cannot tell a
    // sentence that ended from one this cut off, and may quote the stump.
    const text = raw.description.trim();
    product.description = text.length > DESCRIPTION_LIMIT ? `${text.slice(0, DESCRIPTION_LIMIT)}…` : text;
  }

  return product;
}

/**
 * One Storefront GraphQL call.
 *
 * Never throws. `retry: 0` is deliberate — ofetch would otherwise be free to
 * spend the caller's whole budget on a second attempt, and a slow store answer
 * is worth less to a waiting visitor than a fast "I could not check".
 */
async function callStorefront(
  config: ShopifyCatalogConfig,
  query: string,
  variables: Record<string, unknown>
): Promise<{ data: any } | { reason: string }> {
  try {
    const response = await $fetch<{ data?: any; errors?: Array<{ message?: string }> }>(
      `https://${config.domain}/api/${API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': config.token,
        },
        body: { query, variables },
        timeout: TIMEOUT_MS,
        retry: 0,
      }
    );

    // GraphQL reports failures in a 200 body, so a non-throwing call is not yet
    // a successful one. An expired token arrives exactly this way.
    if (Array.isArray(response?.errors) && response.errors.length > 0) {
      return { reason: response.errors[0]?.message || 'the store returned an error' };
    }
    if (!response?.data) return { reason: 'the store returned no data' };
    return { data: response.data };
  } catch (error: any) {
    // Timeout, DNS, non-200, malformed JSON — all one outcome to the caller.
    // The message is kept short and is never surfaced verbatim to a visitor.
    return { reason: error?.message ? String(error.message).slice(0, 200) : 'the store did not respond' };
  }
}

/** Search published products by keyword. Never throws; see the module note on outcomes. */
export async function searchCatalogue(
  query: string,
  limit: number,
  config: ShopifyCatalogConfig | null
): Promise<CatalogueResult> {
  if (!config) return { outcome: 'not_configured', products: [], reason: 'the store lookup is not configured' };

  const first = Math.min(Math.max(Math.trunc(limit) || 1, 1), 10);
  const result = await callStorefront(config, SEARCH_QUERY, { query, first });
  if ('reason' in result) return { outcome: 'unavailable', products: [], reason: result.reason };

  const nodes = Array.isArray(result.data?.products?.nodes) ? result.data.products.nodes : [];
  const products = nodes
    .map((node: RawProduct) => toCatalogueProduct(node, config.domain))
    .filter((product: CatalogueProduct | null): product is CatalogueProduct => product !== null);

  return { outcome: 'ok', products };
}

/** Fetch one published product by handle. Never throws. */
export async function fetchProductByHandle(
  handle: string,
  config: ShopifyCatalogConfig | null
): Promise<CatalogueResult> {
  if (!config) return { outcome: 'not_configured', products: [], reason: 'the store lookup is not configured' };

  const result = await callStorefront(config, PRODUCT_QUERY, { handle });
  if ('reason' in result) return { outcome: 'unavailable', products: [], reason: result.reason };

  // A missing handle is `product: null` with no GraphQL error — a real answer
  // meaning "no such product", not a fault. It stays `ok` with no products.
  const product = result.data?.product
    ? toCatalogueProduct(result.data.product, config.domain, { withDescription: true })
    : null;

  return { outcome: 'ok', products: product ? [product] : [] };
}
