import { z } from 'zod';
import data from '../../../data/parts.json';
import { lookup, type LookupData } from '../../utils/mcpLookup';

/**
 * Parts Equivalency MCP Tool
 * Cross-reference Classic Mini part numbers between brands
 */
export default defineMcpTool({
  description:
    'Cross-reference Classic Mini service part numbers between brands. Covers three categories only: oil filters (18 entries), air filters (4) and alternators (2). Search by brand, part number, or application (e.g. "K&N", "1275", "SPI").',

  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        'Brand, part number or application, e.g. "K&N 1275", "E-2601", "oil filter". Every word must match, so extra words narrow the result. Omit to browse a whole section.'
      ),
    section: z
      .string()
      .optional()
      .describe('Restrict to one category, e.g. "Air Filters" or "Oil Filters". Use a title from availableSections.'),
    limit: z.number().int().positive().max(200).default(50).describe('Maximum rows to return. Default 50.'),
  },

  async handler({ query, section, limit }) {
    const result = lookup(data as unknown as LookupData, { query, section, limit });

    if (result.totalMatches === 0) {
      return jsonResult({
        query: query ?? null,
        section: section ?? null,
        totalMatches: 0,
        matches: [],
        availableSections: result.availableSections,
        hint: 'No rows matched. Try fewer words, or browse a section from availableSections.',
      });
    }

    return jsonResult({
      query: query ?? null,
      section: section ?? null,
      totalMatches: result.totalMatches,
      returned: result.matches.length,
      truncated: result.truncated,
      matches: result.matches,
      availableSections: result.availableSections,
      formattedText: [
        `**Parts Equivalency** — ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'}` +
          (result.truncated ? ` (showing ${result.matches.length})` : ''),
        '',
        ...result.matches.map((m) => `- [${m.sectionTitle}] ${JSON.stringify(m.item)}`),
      ].join('\n'),
    });
  },

  // Not cached: this searches a bundled JSON object in memory, so a cache
  // round-trip would cost more than the search it replaces. (The args are all
  // scalars, so the toolkit's default key WOULD be safe here — unlike the
  // gearbox tool's object-valued tire_type. It simply is not worth it.)
});
