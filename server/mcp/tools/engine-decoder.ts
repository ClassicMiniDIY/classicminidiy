import { z } from 'zod';
import engineCodes from '../../../data/engineCodes.json';

/**
 * Engine Decoder MCP Tool
 * Identify a Classic Mini engine from its cast/stamped prefix code.
 *
 * Sibling to chassis-decoder: the chassis number identifies the CAR, this
 * identifies the ENGINE currently in it — which on a 60-year-old Mini is very
 * often not the one it left the factory with.
 */

interface EngineCode {
  code: string;
  size: string;
  variant: string;
  gearbox: string;
  description: string;
}

const codes = engineCodes as EngineCode[];

/** Fields worth matching a free-text query against. */
function haystack(entry: EngineCode): string {
  return `${entry.code} ${entry.size} ${entry.variant} ${entry.gearbox} ${entry.description}`.toLowerCase();
}

export default defineMcpTool({
  description:
    'Identify a Classic Mini engine from its prefix code (the letters and numbers cast or stamped on the block, e.g. "8A", "12H", "99H"). Returns capacity, variant, gearbox type and a description. Can also search by capacity (e.g. "1275") or by description text. Note this identifies the engine currently fitted, which on a Classic Mini is frequently not the original.',

  inputSchema: {
    code: z
      .string()
      .min(1)
      .max(20)
      .optional()
      .describe(
        'Engine prefix code as cast or stamped on the block, e.g. "8A", "12H", "99H". Matched exactly first, then as a prefix — so a partial code still returns candidates.'
      ),
    query: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe(
        'Free-text search across code, capacity, variant, gearbox and description, e.g. "1275 Cooper S" or "automatic". Every word must match. Use instead of `code` when you do not have the exact prefix.'
      ),
    limit: z.number().int().positive().max(200).default(25).describe('Maximum entries to return. Default 25.'),
  },

  async handler({ code, query, limit }) {
    if (!code && !query) {
      return errorResult(
        'Provide either `code` (an engine prefix such as "12H") or `query` (free text such as "1275 Cooper S").'
      );
    }

    let matches: EngineCode[] = [];
    let matchType = 'none';

    if (code) {
      const needle = code.trim().toLowerCase();
      const exact = codes.filter((e) => e.code.toLowerCase() === needle);
      if (exact.length > 0) {
        matches = exact;
        matchType = 'exact';
      } else {
        // A partial code is far more common than a typo here — blocks are worn,
        // painted over and half-legible — so fall back to a prefix match rather
        // than reporting nothing.
        matches = codes.filter((e) => e.code.toLowerCase().startsWith(needle));
        matchType = matches.length > 0 ? 'prefix' : 'none';
      }
    } else if (query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      matches = codes.filter((e) => {
        const hay = haystack(e);
        return terms.every((t) => hay.includes(t));
      });
      matchType = matches.length > 0 ? 'search' : 'none';
    }

    if (matches.length === 0) {
      return jsonResult({
        inputs: { code: code ?? null, query: query ?? null },
        matchType: 'none',
        totalMatches: 0,
        matches: [],
        hint: 'No engine code matched. Prefix codes are short (2-4 characters) and start with the capacity digit — 8 for 850, 9 for 997/998, 10 for 1098, 12 for 1275. Try just the first two characters.',
      });
    }

    const returned = matches.slice(0, limit);

    return jsonResult({
      inputs: { code: code ?? null, query: query ?? null },
      matchType,
      totalMatches: matches.length,
      returned: returned.length,
      truncated: matches.length > returned.length,
      matches: returned.map((e) => ({
        code: e.code,
        capacityCc: e.size,
        variant: e.variant || null,
        gearbox: e.gearbox || null,
        description: e.description,
      })),
      formattedText: [
        `**Engine Decoder** — ${matches.length} match${matches.length === 1 ? '' : 'es'}` +
          (matchType === 'prefix' ? ' (no exact code; showing prefix matches)' : ''),
        '',
        ...returned.map(
          (e) =>
            `- **${e.code}** — ${e.size}cc${e.variant ? `, ${e.variant}` : ''}${e.gearbox ? `, ${e.gearbox}` : ''}: ${e.description}`
        ),
      ].join('\n'),
    });
  },
});
