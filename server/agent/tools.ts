import type { H3Event } from 'h3';
import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { buildMcpTools } from '../utils/agentTools';
import { runOmnisearch } from '../utils/omnisearch';
import { getVideoIndex, searchVideoIndex } from '../utils/youtubeCatalog';
import { historyByCategory, searchHistory, HISTORY_CATEGORIES } from '../utils/historySearch';
import { TRUSTED_DOMAINS } from '../../data/trustedSources';
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
 *
 * THREE MORE were added after five of five test conversations ended in a
 * refusal — see docs/plans/2026-09-04-chat-agent-knowledge-expansion.md. All
 * three answer the same diagnosis: the agent had no route to anything the
 * archive did not already hold, so a question about fitting a windscreen, the
 * coolant route, a grinding synchro or the 1966 Monte Carlo got "that's outside
 * what I cover" from a site whose entire subject it is.
 *
 * `video-search` reaches Cole's own 450+ videos, which is the answer the site
 * should have been giving first all along.
 * `mini-history` is a static corpus, so history stops being trivia.
 * `web_search` is Anthropic's server-side search pinned to the allowlist in
 * `data/trustedSources.ts` — the specialists Cole would name himself, and
 * nothing else.
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

/**
 * `video-search` reports here too, and it matters more than it looks.
 *
 * The video index is the one tool here that depends on a THIRD-PARTY quota.
 * YouTube's Data API allows 10,000 units a day across the whole site, and the
 * homepage rail spends from the same budget. If that budget is exhausted, or
 * the key is rotated and not redeployed, this tool starts returning "no videos
 * matched" — which is indistinguishable from Cole simply never having covered
 * the subject, and would quietly undo the entire reason the tool exists.
 */
export const VIDEO_SEARCH_DEGRADED_MARKER = 'video-search:unavailable';

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
 * Cole's YouTube channel, searchable.
 *
 * The reason this exists: Cole publishes DIY videos on many of the jobs people
 * ask about, and the assistant was answering "the archive doesn't have
 * windshield installation instructions" while a video on the subject existed.
 * The site had no way to find it — `server/api/youtube/videos.ts` only ever
 * fetched the newest three uploads for the homepage rail.
 *
 * Results come back under `videos`, NOT `results`, and that is load-bearing.
 * `usefulLinks` in `app/components/Chat/ChatWindow.vue` shape-matches any tool
 * output with a `results` array of `{ url, title }`, so naming the field
 * `results` would silently fill the "Useful Links" rail with videos and defeat
 * the dedicated video rail this tool was built to feed.
 */
export function videoSearchTool(apiKey: string, hooks: AgentToolHooks = {}): Tool {
  return tool({
    description:
      "Search Classic Mini DIY's own YouTube channel — over 450 videos by Cole covering repairs, rebuilds, " +
      'installations, diagnosis and buying advice. Use it whenever someone asks HOW to do a job on the car, ' +
      'before pointing them anywhere else. Returns a link and thumbnail per video; use the link exactly as given.',
    inputSchema: z.object({
      query: z
        .string()
        .min(2)
        .describe('The job or subject, in keywords, e.g. "windscreen replacement" or "subframe removal".'),
      limit: z.number().int().positive().max(6).default(3).describe('Maximum videos to return. Default 3.'),
    }),
    async execute({ query, limit }) {
      try {
        const index = await getVideoIndex(apiKey);
        const videos = searchVideoIndex(index, query, limit);

        if (videos.length === 0) {
          return {
            query,
            checked: true,
            videos: [],
            note: 'No video on the channel matches that. Answer from the archive and your own knowledge instead, and do not invent a video link.',
          };
        }
        return { query, checked: true, videos };
      } catch (error: any) {
        hooks.onDegraded?.(VIDEO_SEARCH_DEGRADED_MARKER, error?.message ? String(error.message) : undefined);
        // `checked: false` is the whole point of this branch. "Cole has no video
        // on this" and "I could not look" are different answers, and only one is
        // honest. Never let a lookup failure be reported as an absence.
        return {
          query,
          checked: false,
          videos: [],
          note: 'The video lookup is unavailable right now, so this says nothing about whether a video exists. Answer the question itself and do not claim the channel has nothing on it.',
        };
      }
    },
  }) as Tool;
}

/**
 * The Classic Mini history corpus.
 *
 * Static JSON in `data/miniHistory.json`, so this cannot fail and has no
 * degraded path — which is exactly why it is worth having alongside web search.
 * The prompt that preceded this tool told the model "Do not answer general
 * trivia", and it duly refused to say which year the works Minis were
 * disqualified from the Monte Carlo Rally.
 */
export function historyTool(): Tool {
  return tool({
    description:
      'Look up Classic Mini history — origins and the Issigonis design brief, the Mk1 to Mk7 timeline, Cooper ' +
      'and Cooper S, rallying and the Monte Carlo results, badge-engineered variants and overseas assembly, ' +
      'production figures and the end of production. Use it for any question about the past of the car, the ' +
      'company or the people.',
    // No `.optional()` anywhere — see the note on store-search's schema for why
    // ZodOptional breaks `tool()` under this dependency graph. An empty
    // `category` is how "no category" is expressed.
    inputSchema: z.object({
      query: z.string().min(2).describe('Keywords, e.g. "monte carlo disqualified" or "when did production end".'),
      category: z
        .string()
        .default('')
        .describe(
          `Optional. Return every entry in one category instead of searching. One of: ${HISTORY_CATEGORIES.join(', ')}.`
        ),
      limit: z.number().int().positive().max(6).default(3).describe('Maximum entries to return. Default 3.'),
    }),
    async execute({ query, category, limit }) {
      const entries = category ? historyByCategory(category).slice(0, limit) : searchHistory(query, limit);

      if (entries.length === 0) {
        return {
          query,
          entries: [],
          note: 'The history corpus has nothing on that. Try `web_search` against the trusted history sources, or say plainly that you are unsure rather than guessing a date.',
        };
      }
      return { query, entries };
    },
  }) as Tool;
}

/**
 * Web search, restricted to `data/trustedSources.ts`.
 *
 * Anthropic executes this one — there is no handler here, no crawler and no
 * second API key. The provider is imported for its tool DEFINITIONS only, so
 * the default `anthropic` instance is correct even though the chat route builds
 * its own client with the gateway base URL; nothing about this call touches
 * credentials.
 *
 * The allowlist is the entire safety argument. Unrestricted search would fix
 * the refusals and reintroduce the failure the chat rebuild exists to undo — the
 * agent it replaced reached for generic web search in 331 of 473 conversations
 * and for the site's own eleven reference tools in 11. Confined to a handful of
 * Mini specialists, a search cannot become the lazy default: it has nothing to
 * say about most questions, and everything it does return is a source Cole
 * would name himself.
 *
 * `maxUses` bounds one turn. It is not a cost control — at the measured volume
 * the spend is under a dollar a month — it is a loop control, the same argument
 * as MAX_STEPS in the chat route.
 *
 * MODEL-GATED. `web_search_20260209` needs Sonnet 4.6 or better; on Haiku the
 * request is rejected. `CHAT_MODEL` moves to Sonnet 5 with this change, and
 * `webSearchSupported()` below is what keeps the tool set valid if it is ever
 * moved back.
 */
export function webSearchTool(): Tool {
  return anthropic.tools.webSearch_20260209({
    maxUses: 4,
    allowedDomains: TRUSTED_DOMAINS,
  }) as unknown as Tool;
}

/**
 * Whether a model can be given `web_search_20260209`.
 *
 * Deliberately a DENYLIST of the known-unsupported families rather than an
 * allowlist of supported ones: an allowlist silently drops the tool the day a
 * newer model id appears in `CHAT_MODEL`, and a silently missing tool is the
 * precise failure mode this file's `onDegraded` machinery exists to prevent.
 * Being wrong in this direction produces a loud API error on the first request
 * after a deploy instead of a quietly worse assistant.
 */
export function webSearchSupported(modelId: string): boolean {
  return !/haiku|claude-3/i.test(modelId);
}

/**
 * Everything the chat agent can call.
 *
 * `event` is optional so tests and any future non-request caller still build a
 * working tool set; it is passed by the chat route so the Shopify credentials
 * are read per-request, which is what CLAUDE.md asks for over a module-scope
 * `useRuntimeConfig()`.
 *
 * `modelId` gates `web_search` only. It defaults to a model that supports the
 * tool so the DEFAULT tool set is the full one — a test or a caller that omits
 * it gets the same agent production has, rather than a quietly reduced one.
 */
export function buildAgentTools({
  event,
  youtubeApiKey = '',
  modelId = 'claude-sonnet-5',
  ...hooks
}: AgentToolHooks & { event?: H3Event; youtubeApiKey?: string; modelId?: string } = {}): Record<string, Tool> {
  return {
    ...buildMcpTools(),
    'mini-history': historyTool(),
    'site-search': siteSearchTool(hooks),
    'store-search': storeSearchTool(shopifyConfig(event), hooks),
    'video-search': videoSearchTool(youtubeApiKey, hooks),
    // The key is the tool name Anthropic sees, so it must be exactly
    // `web_search` — a renamed key is not a renamed tool, it is a 400.
    ...(webSearchSupported(modelId) ? { web_search: webSearchTool() } : {}),
  };
}
