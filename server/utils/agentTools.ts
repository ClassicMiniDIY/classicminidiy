import { z } from 'zod';
import { tool, type Tool } from 'ai';

import chassisDecoder from '../mcp/tools/chassis-decoder';
import clearances from '../mcp/tools/clearances';
import colorLookup from '../mcp/tools/color-lookup';
import compressionCalculator from '../mcp/tools/compression-calculator';
import engineDecoder from '../mcp/tools/engine-decoder';
import gearboxCalculator from '../mcp/tools/gearbox-calculator';
import needleCompare from '../mcp/tools/needle-compare';
import partsEquivalency from '../mcp/tools/parts-equivalency';
import torqueSpecs from '../mcp/tools/torque-specs';
import vehicleWeights from '../mcp/tools/vehicle-weights';
import wheelSearch from '../mcp/tools/wheel-search';

/**
 * Bridge the `/mcp` tool definitions into AI SDK tools, so the site's own
 * assistant calls them IN-PROCESS instead of over HTTP.
 *
 * WHY THIS SHAPE
 * `defineMcpTool` in @nuxtjs/mcp-toolkit is an identity function — literally
 * `return definition`. Every file under `server/mcp/tools/` is therefore a plain
 * `{ description, inputSchema, handler }` object, and adapting one costs the
 * twenty lines below with **no tool logic duplicated**. That matters: the
 * previous architecture reached these same tools from another repo over public
 * HTTP with a key that silently degraded to an empty tool list.
 *
 * FOUR THINGS THAT ARE EASY TO GET WRONG
 *
 *  1. `inputSchema` is a `ZodRawShape` (a bare object of Zod types), NOT a
 *     `ZodObject`. It has to be wrapped with `z.object()`. Wrapping preserves
 *     `.default()`, which is load-bearing — `compression-calculator` is entirely
 *     defaults-driven and receives almost nothing explicitly.
 *
 *  2. The handlers take `(args, extra)`. None of the eleven touches `extra`
 *     today, so it is passed a proxy that THROWS on any property access. A
 *     future tool that starts using it then fails loudly in a test rather than
 *     reading `undefined` from a request context that does not exist here.
 *
 *  3. Auto-imports. The tool files call bare `defineMcpTool`, `jsonResult` and
 *     `errorResult`, which Nitro injects. Importing them from `server/utils/`
 *     keeps them inside the same transform — but that must be proven by a BUILD,
 *     never assumed. A miss throws `jsonResult is not defined` from inside a tool
 *     call, which is invisible to unit tests that stub `defineMcpTool` and call
 *     `.handler()` directly. That exact blind spot is how `/mcp` 500'd for months
 *     with a green suite.
 *
 *  4. The import list above is a second registry and could drift from the
 *     filesystem, so `tests/static/agent-tool-registry.test.ts` pins it to
 *     `server/mcp/tools/*.ts` and fails if a tool is added and not wired here.
 *
 * PAID-ONLY TOOLS ARE INCLUDED ON PURPOSE. `chassis-decoder`, `engine-decoder`,
 * `wheel-search` and `color-lookup` sit behind the Developer API paywall on
 * `/mcp`. That paywall gates THIRD-PARTY programmatic access; it was never meant
 * to gate our own assistant answering a visitor's question. Do not "fix" this by
 * running the registry through `server/plugins/mcp-tiering.ts` — that would
 * quietly remove identification and archive lookups from the chat.
 *
 * The toolkit's `cache` option is deliberately not honoured here. It is applied
 * by `registerToolFromDefinition` at MCP registration time; in-process we call
 * the handler directly. Two tools declare one, both over static JSON, so the
 * saving is nil and reimplementing the cache-key rules would be a second source
 * of truth for no gain.
 */

/**
 * The subset of a toolkit definition this bridge reads.
 *
 * `extra` is `any` rather than `unknown` on purpose. The toolkit types it as
 * `McpRequestExtra`, and parameter contravariance means a handler declared with
 * `unknown` there is NOT assignable from one declared with the real type — all
 * eleven imports fail to typecheck. `any` is the right escape for a parameter
 * this bridge deliberately substitutes; NO_MCP_EXTRA below is what actually
 * enforces that no handler reads it.
 */
interface McpToolDefinition {
  description?: string;
  inputSchema?: Readonly<Record<string, z.ZodTypeAny>>;
  handler: (args: any, extra: any) => unknown;
}

/**
 * Filename -> definition. Keys are the MCP tool names (filename = tool name),
 * and they are what the model sees, so they must stay stable: renaming one
 * invalidates the prompt's tool guidance and any saved evaluation.
 */
const DEFINITIONS: Record<string, McpToolDefinition> = {
  'chassis-decoder': chassisDecoder,
  clearances,
  'color-lookup': colorLookup,
  'compression-calculator': compressionCalculator,
  'engine-decoder': engineDecoder,
  'gearbox-calculator': gearboxCalculator,
  'needle-compare': needleCompare,
  'parts-equivalency': partsEquivalency,
  'torque-specs': torqueSpecs,
  'vehicle-weights': vehicleWeights,
  'wheel-search': wheelSearch,
};

/** Names the bridge exposes, for the registry test and the prompt builder. */
export const AGENT_MCP_TOOL_NAMES = Object.keys(DEFINITIONS).sort();

/**
 * Stand-in for the MCP request context. Throws rather than returning undefined
 * so a handler that starts depending on it is caught immediately.
 */
const NO_MCP_EXTRA = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(
        `MCP tool tried to read \`extra.${String(property)}\`, which does not exist when the tool ` +
          `runs in-process from the chat agent. Give the tool what it needs through its inputSchema instead.`
      );
    },
  }
);

/**
 * Turn a toolkit result into something worth putting in front of a model.
 *
 * `jsonResult()` wraps data as `{content:[{type:'text',text:'<pretty JSON>'}]}`.
 * Handing that through verbatim would give the model JSON nested inside a string
 * inside an envelope, so the payload is unwrapped and re-parsed. `errorResult()`
 * sets `isError`, which is surfaced as a plain message the model can act on —
 * "no rows matched, try fewer words" is a useful next step, and throwing would
 * instead abort the whole run.
 */
export function unwrapToolResult(result: unknown): unknown {
  if (result === null || typeof result !== 'object') return result;

  const envelope = result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
  if (!Array.isArray(envelope.content)) return result;

  const text = envelope.content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');

  if (envelope.isError) return { error: text || 'The tool reported an error.' };

  try {
    return JSON.parse(text);
  } catch {
    // textResult() and friends return prose, which is already usable.
    return text;
  }
}

/** Adapt one toolkit definition to an AI SDK tool. */
export function toAiTool(name: string, definition: McpToolDefinition): Tool {
  return tool({
    description: definition.description,
    inputSchema: z.object(definition.inputSchema ?? {}),
    async execute(args: unknown) {
      const result = await definition.handler(args, NO_MCP_EXTRA);
      return unwrapToolResult(result);
    },
  }) as Tool;
}

/** Every Classic Mini reference tool, keyed by the name the model calls. */
export function buildMcpTools(): Record<string, Tool> {
  return Object.fromEntries(Object.entries(DEFINITIONS).map(([name, def]) => [name, toAiTool(name, def)]));
}
