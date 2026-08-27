import { z } from 'zod';
import data from '../../../data/weights.json';
import { lookup, type LookupData } from '../../utils/mcpLookup';

/**
 * Vehicle Weights MCP Tool
 * Look up Classic Mini component and curb weights
 */
export default defineMcpTool({
  description:
    'Look up Classic Mini weights in kg. Curb weights for 12 model variants, plus roughly 530 individual component weights across Body, Engine, Transmission, Brakes, Interior, Suspension, Steering, Electrics, Fuel System and Lightweight Replacements. Useful for build planning, weight-saving comparisons and shipping estimates.',

  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        'Model or component, e.g. "Mk 1 Saloon", "van", "door", "subframe". Every word must match, so extra words narrow the result. Omit to browse a whole section.'
      ),
    section: z
      .string()
      .optional()
      .describe('Restrict to one section, e.g. "Curb Weights", "Body", "Brakes". Use a title from availableSections.'),
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
        `**Vehicle Weights** — ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'}` +
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
