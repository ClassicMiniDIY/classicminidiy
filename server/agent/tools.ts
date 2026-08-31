import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { buildMcpTools } from '../utils/agentTools';
import { runOmnisearch } from '../utils/omnisearch';

/**
 * The agent's full tool set: the eleven `/mcp` reference tools bridged
 * in-process (see server/utils/agentTools.ts) plus `site-search`.
 *
 * `site-search` is the twelfth because the eleven answer SPECIFICATIONS and
 * nothing else. Without it the assistant has no way to say "that is covered on
 * this page", which is most of what a visitor to an archive actually wants — and
 * it is what replaces the generic web search the old agent leaned on for 331 of
 * 473 conversations. It runs the SAME `runOmnisearch()` the site's own search
 * box runs, so results cannot drift between the two.
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

export function siteSearchTool(): Tool {
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
        const { results, total } = await runOmnisearch(query, limit);
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
        return { query, error: `Site search is unavailable right now (${error?.message ?? 'unknown error'}).` };
      }
    },
  }) as Tool;
}

/** Everything the chat agent can call. */
export function buildAgentTools(): Record<string, Tool> {
  return {
    ...buildMcpTools(),
    'site-search': siteSearchTool(),
  };
}
