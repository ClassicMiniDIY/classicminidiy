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
  name?: string;
  description?: string;
  cache?: unknown;
  _meta?: { filename?: string };
  handler: (...args: unknown[]) => unknown;
}

/**
 * Resolve a definition's tool name the way the toolkit itself does. At hook
 * time the scanned definitions carry NO top-level `name` — the toolkit's
 * template emits `{ ...def, _meta: { filename } }` and only derives the name
 * from `_meta.filename` later, inside registerToolFromDefinition (see
 * enrichNameTitle in @nuxtjs/mcp-toolkit). Reading `tool.name` alone therefore
 * returned undefined for every tool in a real build, which made
 * `FREE_TOOLS.has(undefined)` false and gated ALL tools for free keys — while
 * unit tests (which handed defs WITH names) and the transport gate (whose env
 * key is internal tier, seeing everything) both stayed green.
 */
function toolName(tool: ToolDef): string | undefined {
  if (tool.name) return tool.name;
  // Tool filenames are already kebab-case in this repo (filename = tool name);
  // strip the extension exactly like enrichNameTitle does.
  return tool._meta?.filename?.replace(/\.(ts|js|mts|mjs)$/, '');
}

function gatedStub(tool: ToolDef, name: string, event: H3Event): ToolDef {
  // Built from siteUrl like every other server-side outbound link, rather than
  // a hand-maintained origin that rots inside MCP clients' cached descriptions.
  const upgradeUrl = `${((useRuntimeConfig(event).public.siteUrl as string) || 'https://www.classicminidiy.com').replace(/\/$/, '')}/developers`;
  return {
    ...tool,
    // No cache wrapper for a stub: a cached upsell answer under the tool's old
    // cache key could otherwise be served to a PAID caller of the same tool.
    cache: undefined,
    description: `${tool.description ?? ''} [Requires the CMDIY Developer API subscription — ${upgradeUrl}]`,
    handler: () => {
      try {
        recordMcpGated(event, name);
      } catch {
        // capture is best-effort; the upsell answer must always be returned
      }
      return {
        content: [
          {
            type: 'text',
            text:
              `The "${name}" tool requires a CMDIY Developer API subscription — your key is on the free tier. ` +
              `Free keys cover the calculators and reference tables; subscribe at ${upgradeUrl} to unlock ` +
              `the identification and archive tools and a higher rate limit.`,
          },
        ],
        isError: true,
      };
    },
  };
}

function withUsage(tool: ToolDef, name: string, event: H3Event): ToolDef {
  const original = tool.handler;
  return {
    ...tool,
    handler: async (...args: unknown[]) => {
      const result = await original(...args);
      // Only a call that produced a result counts; a throw is normalized to an
      // error result by the toolkit and is not usage. Recording itself is
      // best-effort and must never turn a good result into a failure.
      try {
        recordMcpUsage(event, name);
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
      config.tools = config.tools.map((tool) => {
        // Unresolvable name ⇒ treat as paid (gate it): over-restriction is the
        // safe failure direction for a revenue boundary.
        const name = toolName(tool) ?? '';
        return tier === 'free' && !FREE_TOOLS.has(name) ? gatedStub(tool, name, event) : withUsage(tool, name, event);
      });
    }
  );
});
