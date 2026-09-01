import type { H3Event } from 'h3';
import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { buildMcpTools } from '../utils/agentTools';
import { runOmnisearch } from '../utils/omnisearch';
import {
  fetchProductByHandle,
  searchCatalogue,
  shopifyConfig,
  storeRootUrl,
  type CatalogueResult,
  type ShopifyCatalogConfig,
} from '../utils/shopifyCatalog';

/**
 * The agent's full tool set: the eleven `/mcp` reference tools bridged
 * in-process (see server/utils/agentTools.ts), plus `site-search` and
 * `store-search`.
 *
 * `site-search` is the twelfth because the eleven answer SPECIFICATIONS and
 * nothing else. Without it the assistant has no way to say "that is covered on
 * this page", which is most of what a visitor to an archive actually wants — and
 * it is what replaces the generic web search the old agent leaned on for 331 of
 * 473 conversations. It runs the SAME `runOmnisearch()` the site's own search
 * box runs, so results cannot drift between the two.
 *
 * `store-search` is the thirteenth, and it is the one that needs justifying,
 * because the prompt this assistant replaced was a STORE assistant and the
 * measurement of it is unambiguous: across 473 conversations, generic web
 * search appeared in 331 threads and all eleven Classic Mini tools combined in
 * 11. Anything that pushes the assistant back toward selling is a regression.
 *
 * It earns its place only under a narrow reading: "where do I buy this" is a
 * real question the assistant currently answers by guessing or by saying
 * nothing. So the guidance in server/agent/prompt.ts is scoped by INTENT — the
 * reader asking to PURCHASE — and never by topic. Scoping by topic ("wheels" ->
 * search the store) is precisely what turns every technical answer into an
 * advert. A torque question gets `torque-specs` and nothing else.
 *
 * Design doc: docs/plans/2026-09-01-shopify-catalog-tool.md.
 */

/** Trimmed omnisearch row — the model does not need ids or icon classes. */
function forModel(result: {
  surface: string;
  title: string;
  subtitle: string | null;
  url: string;
  tag: string | null;
}) {
  return {
    surface: result.surface,
    title: result.title,
    summary: result.subtitle,
    // Absolute so the model can link it directly without inventing an origin.
    url: result.url.startsWith('http') ? result.url : `https://www.classicminidiy.com${result.url}`,
    tag: result.tag,
  };
}

export function siteSearchTool(hooks: AgentToolHooks = {}): Tool {
  return tool({
    description:
      'Search classicminidiy.com across every surface — technical toolbox pages, archive documents and manuals, ' +
      'wheels, paint colours, registry entries, 3D models and marketplace listings. Use it to find the page that ' +
      'covers a topic, and to answer anything the specification tools do not. Keyword queries work best.',
    inputSchema: z.object({
      query: z
        .string()
        .min(2)
        .describe('Keywords to search for, e.g. "hydrolastic suspension" or "Cooper S workshop manual".'),
      limit: z.number().int().positive().max(20).default(8).describe('Maximum results to return. Default 8.'),
    }),
    async execute({ query, limit }) {
      try {
        // recordMisses: false — these queries are the model's wording, not a
        // visitor's, and archive_search_misses feeds the public Most Wanted list.
        const { results, total } = await runOmnisearch(query, limit, { recordMisses: false });
        if (total === 0) {
          return {
            query,
            total: 0,
            results: [],
            hint: 'Nothing matched. Try broader or differently-worded keywords.',
          };
        }
        return { query, total, results: results.slice(0, limit).map(forModel) };
      } catch (error: any) {
        // Search being down must not abort the run — the model can still answer
        // from the specification tools, which are static data and unaffected.
        // It must not be SILENT either: see AgentToolHooks below.
        hooks.onDegraded?.(SITE_SEARCH_DEGRADED_MARKER, error?.message ? String(error.message) : undefined);
        return { query, error: `Site search is unavailable right now (${error?.message ?? 'unknown error'}).` };
      }
    },
  }) as Tool;
}

/**
 * Hooks the tool set reports back through.
 *
 * `onDegraded` exists because of one specific failure this codebase has already
 * paid for. The old agent's `/mcp` fetch sat in a bare try/except that fell back
 * to an EMPTY TOOL LIST, so a bad key silently demoted the assistant to generic
 * web search — and neither usage sink could see it, because `recordMcpUsage`
 * skips the internal tier and PostHog was told to emit nothing for it.
 *
 * A tool that degrades to "no results" has the same shape: the run looks
 * healthy, the answer is just worse. `tools_called` on `chat_run_completed`
 * cannot tell "the store had nothing" from "the store was unreachable", because
 * `store-search` appears either way.
 *
 * So a degraded call reports a MARKER — `store-search:unavailable` — plus the
 * underlying cause. The chat route collects markers into `tools_degraded` on
 * `chat_run_completed`, which makes the three states trivially separable: no
 * marker and no `store-search` means nobody asked about products; `store-search`
 * alone means the store answered; a marker means the lookup is broken and has
 * been since whenever it started appearing.
 *
 * The marker is deliberately NOT routed into `tools_called`. That array's length
 * is published as `tool_call_count`, so a degraded call would count as two tool
 * calls for one invocation, and every consumer that reads those entries as tool
 * names would see one that is not in `AGENT_TOOL_NAMES`.
 *
 * `reason` is separate from the marker rather than folded into it because a
 * Shopify error string is unbounded — as a marker it would be a high-cardinality
 * key and useless to group by. It is logged, not counted. Without it an expired
 * token, a lapsed API version pin, a timeout and an outage are one indistinct
 * signal, which is only half of what "make the failure visible" asks for.
 */
export interface AgentToolHooks {
  /**
   * Called when a tool answered degraded, with a `<tool>:<reason>` marker to
   * count and the underlying cause to log.
   */
  onDegraded?: (marker: string, reason?: string) => void;
}

/**
 * `site-search` reports here too, and that is the point of a shared hook.
 *
 * Omnisearch being down leaves `site-search` in `tools_called` looking exactly
 * like a search that matched nothing — the same silent degradation this
 * mechanism exists to close, on the tool that carries far more of the
 * assistant's traffic than the store ever will.
 */
export const SITE_SEARCH_DEGRADED_MARKER = 'site-search:unavailable';

/** Markers `store-search` can report. Exported so a dashboard query has a source of truth. */
export const STORE_DEGRADED_MARKERS = {
  not_configured: 'store-search:not-configured',
  unavailable: 'store-search:unavailable',
} as const;

/**
 * The Classic Mini DIY store, read-only.
 *
 * Two operations and no more: keyword search, and one product by handle. No
 * cart, no checkout, no customer data — see the note in
 * `server/utils/shopifyCatalog.ts` for why that boundary is not negotiable.
 */
export function storeSearchTool(config: ShopifyCatalogConfig | null, hooks: AgentToolHooks = {}): Tool {
  return tool({
    // "everything the store sells" rather than "parts and products": on the
    // behavioural pass the narrower wording made the model REFUSE a direct
    // purchase question about a t-shirt, reasoning that merchandise was outside
    // the tool. This widens what the model believes is IN the catalogue; it does
    // not widen WHEN the tool fires, which is the sentence after it.
    description:
      'Search the Classic Mini DIY store for anything it sells — parts, ECU maps, tools, books and merchandise — ' +
      'with live price and stock. Use it ONLY when someone is asking where to BUY something, never to answer a ' +
      'specification. Returns a link per product; use that link exactly as given.',
    // NOTE: no `.optional()` anywhere, and that is a type constraint rather
    // than a design choice. `ZodOptional` does not satisfy the `ai` package's
    // schema parameter under this dependency graph — the generic collapses to
    // `never` and `tool()` reports "no overload matches this call" on the whole
    // definition, which reads as a mistake in `execute` and is not. `.default()`
    // is fine and still marks the field not-required in the JSON Schema the
    // model sees, so an empty `handle` is how "no handle" is expressed.
    inputSchema: z.object({
      query: z
        .string()
        .min(2)
        .describe('What the person wants to buy, in keywords, e.g. "Minilite wheels" or "SU needle".'),
      handle: z
        .string()
        .default('')
        .describe(
          'Optional. A product handle from an earlier result, to fetch that one product with its full description.'
        ),
      limit: z.number().int().positive().max(10).default(5).describe('Maximum products to return. Default 5.'),
    }),
    async execute({ query, handle, limit }) {
      const result: CatalogueResult = handle
        ? await fetchProductByHandle(handle, config)
        : await searchCatalogue(query, limit, config);

      if (result.outcome !== 'ok') {
        hooks.onDegraded?.(STORE_DEGRADED_MARKERS[result.outcome], result.reason);
        // The model is told the lookup FAILED, never handed a bare empty list.
        // "We do not sell that" and "I could not check" are different answers,
        // and only one of them is honest here.
        //
        // `storeUrl` ships WITH the instruction to link the store. Telling a
        // model to point somewhere without giving it the address is how it ends
        // up inventing one: observed live, this branch produced a link to
        // `classicminidiy.com/store`, which is not a page.
        return {
          checked: false,
          products: [],
          storeUrl: config ? storeRootUrl(config.domain) : undefined,
          note:
            'The store lookup is unavailable right now, so this says nothing about whether the store stocks it. ' +
            'Say you could not check the shop and link `storeUrl` if it is present. Never claim it is not sold, ' +
            'and never write a store link that did not come from this tool.',
        };
      }

      if (result.products.length === 0) {
        return {
          checked: true,
          products: [],
          note: 'The store has nothing matching that. Try broader keywords, or say the shop does not carry it.',
        };
      }

      return { checked: true, products: result.products };
    },
  }) as Tool;
}

/**
 * Everything the chat agent can call.
 *
 * `event` is optional so tests and any future non-request caller still build a
 * working tool set; it is passed by the chat route so the Shopify credentials
 * are read per-request, which is what CLAUDE.md asks for over a module-scope
 * `useRuntimeConfig()`.
 */
export function buildAgentTools({ event, ...hooks }: AgentToolHooks & { event?: H3Event } = {}): Record<string, Tool> {
  return {
    ...buildMcpTools(),
    'site-search': siteSearchTool(hooks),
    'store-search': storeSearchTool(shopifyConfig(event), hooks),
  };
}
