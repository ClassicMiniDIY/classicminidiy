import type { H3Event } from 'h3';
import { FREE_TOOLS, getMcpAuth } from '../utils/mcpTiers';
import { recordMcpGated, recordMcpUsage } from '../utils/mcpUsage';

/**
 * Per-request MCP tool tiering + usage capture.
 * Design doc: docs/plans/2026-08-28-developer-api-subscription.md
 *
 * @nuxtjs/mcp-toolkit fires `mcp:config:resolved` per request AFTER resolving
 * the tool definitions and BEFORE building the MCP server from them, so
 * replacing entries in `config.tools` changes both what tools/list advertises
 * and what tools/call can reach. Two properties of that seam shape this code:
 *
 *  - The array ELEMENTS are shared module-level definition objects. Every
 *    transformation below returns a shallow COPY; mutating an element would
 *    leak one request's tier into every later request on the isolate.
 *  - The toolkit swallows hook exceptions and continues the request, so the
 *    gate must fail closed BY CONSTRUCTION: a missing/unresolved auth context
 *    yields the free tier (over-restriction, never exposure), and nothing in
 *    here throws on purpose.
 *
 * Free tier: paid-only tools stay VISIBLE in tools/list but gated — the
 * description carries the upgrade pointer (in-client upsell) and the handler
 * answers a clean isError result, which is also exactly what a direct
 * tools/call on a gated tool receives. All live handlers of every tier get the
 * usage wrapper (fire-and-forget; see server/utils/mcpUsage.ts).
 */

/** The subset of a toolkit tool definition this plugin touches. */
interface ToolDef {
  name: string;
  description?: string;
  cache?: unknown;
  handler: (...args: unknown[]) => unknown;
}

const UPGRADE_URL = 'https://classicminidiy.com/developers';

function gatedStub(tool: ToolDef, event: H3Event): ToolDef {
  return {
    ...tool,
    // No cache wrapper for a stub: a cached upsell answer under the tool's old
    // cache key could otherwise be served to a PAID caller of the same tool.
    cache: undefined,
    description: `${tool.description ?? ''} [Requires the CMDIY Developer API subscription — ${UPGRADE_URL}]`,
    handler: () => {
      try {
        recordMcpGated(event, tool.name);
      } catch {
        // capture is best-effort; the upsell answer must always be returned
      }
      return {
        content: [
          {
            type: 'text',
            text:
              `The "${tool.name}" tool requires a CMDIY Developer API subscription — your key is on the free tier. ` +
              `Free keys cover the calculators and reference tables; subscribe at ${UPGRADE_URL} to unlock ` +
              `the identification and archive tools and a higher rate limit.`,
          },
        ],
        isError: true,
      };
    },
  };
}

function withUsage(tool: ToolDef, event: H3Event): ToolDef {
  const original = tool.handler;
  return {
    ...tool,
    handler: async (...args: unknown[]) => {
      const result = await original(...args);
      // Only a call that produced a result counts; a throw is normalized to an
      // error result by the toolkit and is not usage. Recording itself is
      // best-effort and must never turn a good result into a failure.
      try {
        recordMcpUsage(event, tool.name);
      } catch {
        // swallowed on purpose
      }
      return result;
    },
  };
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook(
    'mcp:config:resolved',
    ({ config, event }: { config: { tools: ToolDef[] }; event: H3Event }) => {
      const tier = getMcpAuth(event)?.tier ?? 'free';
      config.tools = config.tools.map((tool) =>
        tier === 'free' && !FREE_TOOLS.has(tool.name) ? gatedStub(tool, event) : withUsage(tool, event)
      );
    }
  );
});
